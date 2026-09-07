package db

import (
	"context"
	"fmt"
	"log"
	"strings"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
)

// ============================================================
// GraphRepository — All Neo4j operations for the Shadow Graph
// ============================================================
// The Shadow Graph is our local, self-healing copy of the blockchain.
// Every time the BFS engine traces a wallet, we permanently store
// all nodes (wallets) and edges (transactions) in Neo4j.
// Over time this cache grows, and repeat queries become instant.
// ============================================================

type GraphRepository struct {
	driver neo4j.DriverWithContext
}

func NewGraphRepository(driver neo4j.DriverWithContext) *GraphRepository {
	return &GraphRepository{driver: driver}
}

// WalletNode represents a wallet in the Neo4j graph
type WalletNode struct {
	Address   string
	Chain     string
	Label     string  // e.g. "Binance", "Unknown", "Tornado Cash"
	WalletType string // "exchange", "mixer", "unknown", "suspect"
	RiskLevel string  // "low", "medium", "high", "critical"
	IsVASP    bool
	FirstSeen time.Time
	LastSeen  time.Time
}

// TransactionEdge represents a transaction between two wallets
type TransactionEdge struct {
	TxHash    string
	FromAddr  string
	ToAddr    string
	Chain     string
	Amount    float64
	ValueUSD  float64
	Token     string
	Timestamp time.Time
	CaseID    string
}

// ──────────────────────────────────────────────────────────────────────────────
// SHADOW GRAPH — Persistence Layer
// Saves every traced wallet and transaction permanently to Neo4j
// ──────────────────────────────────────────────────────────────────────────────

// UpsertWallet creates or updates a Wallet node in Neo4j.
// Uses MERGE so re-tracing the same wallet never creates duplicates.
func (r *GraphRepository) UpsertWallet(ctx context.Context, wallet WalletNode) error {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	query := `
		MERGE (w:Wallet {address: $address, chain: $chain})
		ON CREATE SET
			w.label      = $label,
			w.type       = $wallet_type,
			w.risk_level = $risk_level,
			w.is_vasp    = $is_vasp,
			w.first_seen = $first_seen,
			w.last_seen  = $last_seen
		ON MATCH SET
			w.label      = CASE WHEN $label <> 'unknown' THEN $label ELSE w.label END,
			w.risk_level = CASE WHEN $risk_level <> 'low' THEN $risk_level ELSE w.risk_level END,
			w.is_vasp    = $is_vasp OR w.is_vasp,
			w.last_seen  = $last_seen
	`

	_, err := session.Run(ctx, query, map[string]any{
		"address":     strings.ToLower(wallet.Address),
		"chain":       wallet.Chain,
		"label":       wallet.Label,
		"wallet_type": wallet.WalletType,
		"risk_level":  wallet.RiskLevel,
		"is_vasp":     wallet.IsVASP,
		"first_seen":  wallet.FirstSeen.Unix(),
		"last_seen":   wallet.LastSeen.Unix(),
	})
	return err
}

// UpsertTransaction creates or updates a SENT relationship between two wallet nodes.
func (r *GraphRepository) UpsertTransaction(ctx context.Context, tx TransactionEdge) error {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	// Ensure both wallet nodes exist first, then create the relationship
	query := `
		MERGE (from:Wallet {address: $from_addr, chain: $chain})
		MERGE (to:Wallet {address: $to_addr, chain: $chain})
		MERGE (from)-[t:SENT {tx_hash: $tx_hash}]->(to)
		ON CREATE SET
			t.amount     = $amount,
			t.value_usd  = $value_usd,
			t.token      = $token,
			t.timestamp  = $timestamp,
			t.case_id    = $case_id
	`

	_, err := session.Run(ctx, query, map[string]any{
		"from_addr": strings.ToLower(tx.FromAddr),
		"to_addr":   strings.ToLower(tx.ToAddr),
		"chain":     tx.Chain,
		"tx_hash":   tx.TxHash,
		"amount":    tx.Amount,
		"value_usd": tx.ValueUSD,
		"token":     tx.Token,
		"timestamp": tx.Timestamp.Unix(),
		"case_id":   tx.CaseID,
	})
	return err
}

// SaveTracePath saves the entire BFS path (all hops) in a single batch write.
// This is called once after a trace completes for maximum efficiency.
func (r *GraphRepository) SaveTracePath(ctx context.Context, caseID, suspectAddr, chain string,
	hops []TraceHop, vaspAddr, vaspName, vaspType, riskLevel string) error {

	log.Printf("[GRAPH] Saving %d-hop trace path for case %s to Neo4j Shadow Graph", len(hops), caseID)

	// Save suspect node
	err := r.UpsertWallet(ctx, WalletNode{
		Address:    suspectAddr,
		Chain:      chain,
		Label:      "Suspect",
		WalletType: "suspect",
		RiskLevel:  "high",
		IsVASP:     false,
		FirstSeen:  time.Now(),
		LastSeen:   time.Now(),
	})
	if err != nil {
		return fmt.Errorf("failed to save suspect node: %w", err)
	}

	// Save each hop as a node + edge
	for _, hop := range hops {
		isVASP := hop.ToAddress == vaspAddr && vaspAddr != ""
		label := "unknown"
		wType := "unknown"
		risk := "low"

		if isVASP {
			label = vaspName
			wType = vaspType
			risk = riskLevel
		}

		// Save destination wallet
		_ = r.UpsertWallet(ctx, WalletNode{
			Address:    hop.ToAddress,
			Chain:      chain,
			Label:      label,
			WalletType: wType,
			RiskLevel:  risk,
			IsVASP:     isVASP,
			FirstSeen:  hop.Timestamp,
			LastSeen:   hop.Timestamp,
		})

		// Save transaction edge
		_ = r.UpsertTransaction(ctx, TransactionEdge{
			TxHash:    hop.TxHash,
			FromAddr:  hop.FromAddress,
			ToAddr:    hop.ToAddress,
			Chain:     chain,
			Amount:    hop.Amount,
			ValueUSD:  hop.Amount,
			Token:     hop.TokenSymbol,
			Timestamp: hop.Timestamp,
			CaseID:    caseID,
		})
	}

	log.Printf("[GRAPH] Shadow Graph updated: %d nodes, %d edges saved for case %s", len(hops)+1, len(hops), caseID)
	return nil
}

// TraceHop is a local copy of models.TraceHop to avoid import cycle
type TraceHop struct {
	HopNumber   int
	FromAddress string
	ToAddress   string
	TxHash      string
	Amount      float64
	TokenSymbol string
	Timestamp   time.Time
}

// ──────────────────────────────────────────────────────────────────────────────
// GRAPH ANALYTICS — Advanced Neo4j Queries
// Run powerful graph algorithms to surface hidden criminal networks
// ──────────────────────────────────────────────────────────────────────────────

// WalletAnalysis holds the result of a deep graph analysis on a wallet
type WalletAnalysis struct {
	Address          string                   `json:"address"`
	Chain            string                   `json:"chain"`
	DirectNeighbors  int                      `json:"direct_neighbors"`
	ClusterSize      int                      `json:"cluster_size"`       // WCC result
	PageRankScore    float64                  `json:"pagerank_score"`     // Centrality
	SharedClusters   []string                 `json:"shared_clusters"`    // Wallets in same cluster
	IncomingVolume   float64                  `json:"incoming_volume_usd"`
	OutgoingVolume   float64                  `json:"outgoing_volume_usd"`
	IsHub            bool                     `json:"is_hub"`             // True if high PageRank
	ConnectedCases   []string                 `json:"connected_cases"`    // Cases this wallet appears in
	ShortestPaths    []ShortestPath           `json:"shortest_paths_to_vasps"`
}

type ShortestPath struct {
	ToVASP     string  `json:"to_vasp"`
	HopCount   int     `json:"hop_count"`
	Confidence float64 `json:"confidence"`
}

// GetWalletNeighbors returns all wallets directly connected to an address
func (r *GraphRepository) GetWalletNeighbors(ctx context.Context, address, chain string) ([]map[string]any, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := `
		MATCH (w:Wallet {address: $address, chain: $chain})-[t:SENT]-(neighbor:Wallet)
		RETURN 
			neighbor.address AS address,
			neighbor.chain AS chain,
			neighbor.label AS label,
			neighbor.type AS type,
			neighbor.risk_level AS risk_level,
			neighbor.is_vasp AS is_vasp,
			count(t) AS tx_count,
			sum(t.value_usd) AS total_usd
		ORDER BY total_usd DESC
		LIMIT 50
	`

	result, err := session.Run(ctx, query, map[string]any{
		"address": strings.ToLower(address),
		"chain":   chain,
	})
	if err != nil {
		return nil, err
	}

	var neighbors []map[string]any
	for result.Next(ctx) {
		record := result.Record()
		neighbors = append(neighbors, record.AsMap())
	}
	return neighbors, result.Err()
}

// FindShortestPathToVASP uses Neo4j's built-in shortest path to find
// the minimum number of hops between a wallet and any known VASP.
func (r *GraphRepository) FindShortestPathToVASP(ctx context.Context, address, chain string) ([]ShortestPath, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := `
		MATCH (start:Wallet {address: $address, chain: $chain}),
			  (vasp:Wallet {is_vasp: true, chain: $chain})
		MATCH path = shortestPath((start)-[:SENT*..10]->(vasp))
		RETURN 
			vasp.label AS vasp_name,
			length(path) AS hops,
			vasp.risk_level AS risk_level
		ORDER BY hops ASC
		LIMIT 5
	`

	result, err := session.Run(ctx, query, map[string]any{
		"address": strings.ToLower(address),
		"chain":   chain,
	})
	if err != nil {
		return nil, err
	}

	var paths []ShortestPath
	for result.Next(ctx) {
		record := result.Record()
		hops, _ := record.Get("hops")
		vasp, _ := record.Get("vasp_name")
		hopCount, _ := hops.(int64)
		vaspName, _ := vasp.(string)
		confidence := 1.0 / float64(hopCount+1)

		paths = append(paths, ShortestPath{
			ToVASP:     vaspName,
			HopCount:   int(hopCount),
			Confidence: confidence,
		})
	}
	return paths, result.Err()
}

// ComputeWalletCentrality runs a simplified PageRank-style centrality measure
// by counting how many unique cases a wallet appears in and how many connections it has.
// Full GDS PageRank requires Neo4j Enterprise; this version works on Community edition.
func (r *GraphRepository) ComputeWalletCentrality(ctx context.Context, address, chain string) (float64, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := `
		MATCH (w:Wallet {address: $address, chain: $chain})
		OPTIONAL MATCH (w)-[out:SENT]->()
		OPTIONAL MATCH ()-[in:SENT]->(w)
		RETURN 
			count(DISTINCT out) AS out_degree,
			count(DISTINCT in) AS in_degree,
			count(DISTINCT in.case_id) AS case_count
	`

	result, err := session.Run(ctx, query, map[string]any{
		"address": strings.ToLower(address),
		"chain":   chain,
	})
	if err != nil {
		return 0, err
	}

	if result.Next(ctx) {
		record := result.Record()
		outDeg, _ := record.Get("out_degree")
		inDeg, _ := record.Get("in_degree")
		cases, _ := record.Get("case_count")

		out, _ := outDeg.(int64)
		in, _ := inDeg.(int64)
		c, _ := cases.(int64)

		// Simple centrality: weighted sum of connections and case appearances
		centrality := float64(out+in)*0.3 + float64(c)*0.7
		return centrality, result.Err()
	}
	return 0, result.Err()
}

// FindConnectedComponent returns all wallets in the same "cluster" as the given address.
// This is our community version of Weakly Connected Components (WCC).
// Identifies all wallets that are reachable from the suspect address (the criminal's network).
func (r *GraphRepository) FindConnectedComponent(ctx context.Context, address, chain string, maxDepth int) ([]map[string]any, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := fmt.Sprintf(`
		MATCH (start:Wallet {address: $address, chain: $chain})
		MATCH (start)-[:SENT*1..%d]-(member:Wallet)
		RETURN DISTINCT
			member.address AS address,
			member.label AS label,
			member.type AS type,
			member.is_vasp AS is_vasp,
			member.risk_level AS risk_level
		ORDER BY member.is_vasp DESC, member.risk_level DESC
		LIMIT 200
	`, maxDepth)

	result, err := session.Run(ctx, query, map[string]any{
		"address": strings.ToLower(address),
		"chain":   chain,
	})
	if err != nil {
		return nil, err
	}

	var members []map[string]any
	for result.Next(ctx) {
		members = append(members, result.Record().AsMap())
	}
	return members, result.Err()
}

// GetTopRiskHubs returns the wallets with the highest centrality in the graph.
// These are the most likely "mixing hubs" or central distribution points.
func (r *GraphRepository) GetTopRiskHubs(ctx context.Context, chain string, limit int) ([]map[string]any, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := `
		MATCH (w:Wallet {chain: $chain})
		OPTIONAL MATCH (w)-[out:SENT]->()
		OPTIONAL MATCH ()-[in:SENT]->(w)
		WITH w,
			 count(DISTINCT out) AS out_degree,
			 count(DISTINCT in) AS in_degree,
			 count(DISTINCT in.case_id) AS case_count
		WHERE (out_degree + in_degree) > 2
		RETURN
			w.address AS address,
			w.label AS label,
			w.type AS type,
			w.is_vasp AS is_vasp,
			w.risk_level AS risk_level,
			out_degree,
			in_degree,
			case_count,
			(out_degree + in_degree) * 0.3 + case_count * 0.7 AS centrality_score
		ORDER BY centrality_score DESC
		LIMIT $limit
	`

	result, err := session.Run(ctx, query, map[string]any{
		"chain": chain,
		"limit": limit,
	})
	if err != nil {
		return nil, err
	}

	var hubs []map[string]any
	for result.Next(ctx) {
		hubs = append(hubs, result.Record().AsMap())
	}
	return hubs, result.Err()
}

// GetCaseGraph returns the full transaction graph for a specific case
// for rendering in the React Flow visualization on the frontend.
func (r *GraphRepository) GetCaseGraph(ctx context.Context, caseID string) ([]map[string]any, []map[string]any, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	// Get all nodes involved in this case
	nodeQuery := `
		MATCH (w:Wallet)-[t:SENT {case_id: $case_id}]-()
		RETURN DISTINCT
			w.address AS address,
			w.chain AS chain,
			w.label AS label,
			w.type AS type,
			w.is_vasp AS is_vasp,
			w.risk_level AS risk_level
	`
	nodeResult, err := session.Run(ctx, nodeQuery, map[string]any{"case_id": caseID})
	if err != nil {
		return nil, nil, err
	}
	var nodes []map[string]any
	for nodeResult.Next(ctx) {
		nodes = append(nodes, nodeResult.Record().AsMap())
	}

	// Get all edges for this case
	edgeQuery := `
		MATCH (from:Wallet)-[t:SENT {case_id: $case_id}]->(to:Wallet)
		RETURN
			from.address AS from_address,
			to.address AS to_address,
			t.tx_hash AS tx_hash,
			t.amount AS amount,
			t.token AS token,
			t.value_usd AS value_usd,
			t.timestamp AS timestamp
		ORDER BY t.timestamp ASC
	`
	edgeResult, err := session.Run(ctx, edgeQuery, map[string]any{"case_id": caseID})
	if err != nil {
		return nil, nil, err
	}
	var edges []map[string]any
	for edgeResult.Next(ctx) {
		edges = append(edges, edgeResult.Record().AsMap())
	}

	return nodes, edges, nil
}

// GetGraphStats returns summary statistics for the entire Shadow Graph
func (r *GraphRepository) GetGraphStats(ctx context.Context) (map[string]any, error) {
	session := r.driver.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeRead})
	defer session.Close(ctx)

	query := `
		MATCH (w:Wallet) 
		WITH count(w) AS total_wallets
		MATCH ()-[t:SENT]->()
		WITH total_wallets, count(t) AS total_txns
		MATCH (v:Wallet {is_vasp: true})
		WITH total_wallets, total_txns, count(v) AS vasp_count
		MATCH (s:Wallet {type: 'suspect'})
		RETURN total_wallets, total_txns, vasp_count, count(s) AS suspect_count
	`

	result, err := session.Run(ctx, query, nil)
	if err != nil {
		return nil, err
	}

	if result.Next(ctx) {
		return result.Record().AsMap(), result.Err()
	}
	return map[string]any{
		"total_wallets":  0,
		"total_txns":     0,
		"vasp_count":     0,
		"suspect_count":  0,
	}, nil
}
