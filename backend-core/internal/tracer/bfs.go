package tracer

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/redis/go-redis/v9"

	"vasp-engine/internal/models"
)

// BFSConfig holds tuning parameters for the graph traversal engine.
type BFSConfig struct {
	MaxDepth        int       // Maximum hops to trace before giving up
	MinValueUSD     float64   // Ignore transactions below this USD value (dust filter)
	MaxBranches     int       // Max branches to follow per hop (prevents explosion)
	WorkerCount     int       // Number of concurrent goroutines for API calls
	TimeStart       time.Time // Ignore transactions before this time
	TimeEnd         time.Time // Ignore transactions after this time
	Direction       string    // "incoming", "outgoing", "both"
	Assets          []string  // Allowed token symbols or identifiers (empty = all)
}

// DefaultConfig returns sensible defaults for the BFS engine.
func DefaultConfig() BFSConfig {
	return BFSConfig{
		MaxDepth:    10,
		MinValueUSD: 10.0,
		MaxBranches: 5,
		WorkerCount: 10,
		Direction:   "outgoing",
	}
}

// Engine is the core VASP attribution engine.
// It performs a Breadth-First Search on the blockchain transaction graph
// to find the nearest VASP (exchange, custodial wallet, etc.)
type Engine struct {
	neo4j    neo4j.DriverWithContext
	redis    *redis.Client
	fetcher  *Fetcher // Blockchain API multiplexer
	repo     EntityLookup
	resolver CrossChainResolver
}

// EntityLookup is the minimal interface the Engine needs from the DB layer.
// Using an interface (instead of concrete *db.Repository) prevents import cycles
// and makes the engine fully testable without a live database.
type EntityLookup interface {
	LookupEntityAddress(ctx context.Context, address, chain string) (*models.EntityAddress, error)
	LookupBridge(ctx context.Context, address string) (string, string, bool) // name, protocol, found
}

// NewEngine creates a new BFS tracing engine.
// repo may be nil (e.g. in tests); the engine will skip entity lookups in that case.
func NewEngine(neo4jDriver neo4j.DriverWithContext, redisClient *redis.Client) *Engine {
	return &Engine{
		neo4j:    neo4jDriver,
		redis:    redisClient,
		fetcher:  NewFetcher(),
		resolver: NewRegistryResolver(),
	}
}

// SetRepo wires the database repository into the engine after construction.
// Called by the HTTP handler during startup. Separated from NewEngine to
// avoid an import cycle between the tracer and db packages.
func (e *Engine) SetRepo(repo EntityLookup) {
	e.repo = repo
}


// TraceResult holds the final output of a BFS trace operation.
type TraceResult struct {
	CaseID         string                        `json:"case_id"`
	SuspectAddress string                        `json:"suspect_address"`
	Chain          string                        `json:"chain"`
	FoundVASP      *models.VASPHit               `json:"found_vasp,omitempty"`
	FoundVASPs     []*models.VASPHit             `json:"found_vasps,omitempty"`
	FoundBridges   []*models.VASPHit             `json:"found_bridges,omitempty"`
	RankedCandidates []models.AttributionCandidate `json:"ranked_candidates,omitempty"`
	Path           []models.TraceHop              `json:"path"`
	Nodes          []GraphNode                    `json:"nodes"`
	Edges          []GraphEdge                    `json:"edges"`
	HopsTraced     int                            `json:"hops_traced"`
	Confidence     float64                        `json:"confidence"`
	Status         string                         `json:"status"` // "found", "not_found", "max_depth", "cross_chain_hop"
	Duration       time.Duration                  `json:"duration_ms"`
}

type GraphNode struct {
	ID     string `json:"id"`
	Label  string `json:"label"`
	Type   string `json:"type"`
	IsVASP bool   `json:"is_vasp"`
}

type GraphEdge struct {
	Source string  `json:"source"`
	Target string  `json:"target"`
	Amount float64 `json:"amount"`
	Token  string  `json:"token"`
	TxHash string  `json:"tx_hash"`
}

// Trace performs a BFS traversal starting from the suspect address.
// It fans out checking each destination against the entity/VASP label database.
func (e *Engine) Trace(ctx context.Context, config BFSConfig, caseID, address, chain string) (*TraceResult, error) {
	startTime := time.Now()
	log.Printf("[TRACE] Starting BFS for case=%s address=%s chain=%s", caseID, address, chain)

	result := &TraceResult{
		CaseID:         caseID,
		SuspectAddress: address,
		Chain:          chain,
		Path:           []models.TraceHop{},
		Nodes:          []GraphNode{{ID: strings.ToLower(address), Label: "Suspect", Type: "Suspect", IsVASP: false}},
		Edges:          []GraphEdge{},
		Status:         "not_found",
		FoundVASPs:     []*models.VASPHit{},
	}

	// rawCandidates accumulates entity hits for Phase 4 scoring after BFS
	var rawCandidates []RawCandidate
	
	nodeTracker := make(map[string]bool)
	nodeTracker[strings.ToLower(address)] = true
	edgeTracker := make(map[string]bool)

	// BFS queue — each item is a wallet address to explore
	type QueueItem struct {
		Address string
		Chain   string
		Depth   int
		Path    []models.TraceHop
	}

	var longestPath []models.TraceHop
	
	queue := []QueueItem{{Address: address, Chain: chain, Depth: 0, Path: []models.TraceHop{}}}
	visited := make(map[string]bool) // prevent re-visiting addresses
	visited[chain+":"+address] = true

	var mu sync.Mutex // Protects shared state during concurrent batch processing

	for len(queue) > 0 {
		select {
		case <-ctx.Done():
			return result, fmt.Errorf("trace cancelled: %w", ctx.Err())
		default:
		}

		// Pull up to 50 items from the queue for concurrent processing
		batchSize := 50
		if len(queue) < batchSize {
			batchSize = len(queue)
		}
		batch := queue[:batchSize]
		queue = queue[batchSize:]

		var wg sync.WaitGroup
		
		for _, item := range batch {
			wg.Add(1)
			go func(current QueueItem) {
				defer wg.Done()

				// Safety: stop if we've gone too deep
				if current.Depth >= config.MaxDepth {
					mu.Lock()
					if result.Status == "not_found" {
						result.Status = "max_depth"
					}
					if current.Depth > result.HopsTraced {
						result.HopsTraced = current.Depth
					}
					mu.Unlock()
					return
				}

				log.Printf("[TRACE] Hop %d — exploring %s on %s", current.Depth, current.Address, current.Chain)

				var entityAddr *models.EntityAddress
				var vaspHit *models.VASPHit

				if current.Address != "unknown_utxo_sender" && e.repo != nil {
					var err error
					entityAddr, err = e.repo.LookupEntityAddress(ctx, current.Address, current.Chain)
					if err != nil {
						log.Printf("[WARN] Entity label check failed for %s: %v", current.Address, err)
					}
				}

				mu.Lock()
				if len(current.Path) > len(result.Path) {
					result.Path = current.Path
					result.HopsTraced = current.Depth
				}
				mu.Unlock()

				var bridgeName, bridgeProtocol string
				var isBridge bool
				if e.repo != nil {
					bridgeName, bridgeProtocol, isBridge = e.repo.LookupBridge(ctx, current.Address)
				} else {
					var knownBridges = map[string]string{
						"0xa0c68c638235ee32657e8f720a23cec1bfc77c77": "Polygon Bridge",
						"0x99c9fc46f92e8a1c0de1b1f3f31af08a58f00000": "Optimism Bridge",
						"0x401F6c983eA34274ec46f84D70b31C151321188b": "Arbitrum Bridge",
						"0x3ee18B2214AFF97000D974cf647E7C347E8fa585": "Wormhole Bridge",
					}
					bridgeName, isBridge = knownBridges[current.Address]
					bridgeProtocol = bridgeName
				}

				if isBridge {
					log.Printf("[TRACE] 🌉 CROSS-CHAIN BRIDGE HIT: %s on %s", bridgeName, current.Chain)

					bridgeHit := &models.VASPHit{
						VASPName:   bridgeName,
						VASPType:   "bridge",
						Confidence: 100.0,
						Address:    current.Address,
						Chain:      current.Chain,
					}
					
					mu.Lock()
					result.FoundBridges = append(result.FoundBridges, bridgeHit)
					if result.Status == "not_found" {
						result.Status = "cross_chain_hop"
					}
					mu.Unlock()

					go e.persistPathToNeo4j(context.Background(), current.Path, bridgeHit, current.Chain, caseID)

					var sourceTxHash string
					if len(current.Path) > 0 {
						sourceTxHash = current.Path[len(current.Path)-1].TxHash
					}
					
					if sourceTxHash != "" && e.resolver != nil {
						destChain, destAddr, evidence, err := e.resolver.ResolveJump(ctx, current.Chain, sourceTxHash, current.Address, bridgeProtocol)
						if err == nil && evidence != nil && evidence.CorrelationLevel != "Weak" {
							crossPath := make([]models.TraceHop, len(current.Path))
							copy(crossPath, current.Path)
							
							go e.persistCrossChainJump(context.Background(), current.Address, destAddr, current.Chain, evidence, caseID)

							mu.Lock()
							queue = append(queue, QueueItem{
								Address: destAddr,
								Chain:   destChain,
								Depth:   current.Depth + 1,
								Path:    crossPath,
							})
							mu.Unlock()
							log.Printf("[TRACE] 🔄 Successfully resolved jump. Enqueuing %s on %s", destAddr, destChain)
							return
						} else {
							log.Printf("[TRACE] ⚠️ Cross-chain resolution failed or weak for %s: %v", sourceTxHash, err)
						}
					}
					return
				}

				if entityAddr != nil {
					mu.Lock()
					
					// Update the node visually for React Flow
					currLower := strings.ToLower(current.Address)
					for i, n := range result.Nodes {
						if n.ID == currLower {
							result.Nodes[i].Label = entityAddr.EntityName
							result.Nodes[i].Type = "VASP"
							result.Nodes[i].IsVASP = true
							break
						}
					}
					
					rawCandidates = append(rawCandidates, RawCandidate{
						EntityAddr:  *entityAddr,
						Path:        current.Path,
						HopDistance: current.Depth,
					})

					vaspHit = &models.VASPHit{
						Address:    entityAddr.Address,
						Chain:      entityAddr.Chain,
						VASPName:   entityAddr.EntityName,
						VASPType:   entityAddr.EntityType,
						Confidence: entityAddr.Reliability * 100.0,
						Source:     entityAddr.Source,
					}
					result.FoundVASPs = append(result.FoundVASPs, vaspHit)
					if result.FoundVASP == nil {
						result.FoundVASP = vaspHit
						result.Confidence = vaspHit.Confidence
						result.Status = "found"
					}
					mu.Unlock()

					go e.persistPathToNeo4j(context.Background(), current.Path, vaspHit, current.Chain, caseID)
					log.Printf("[TRACE] ✅ ENTITY HIT: %s (%s) for case=%s at hop %d",
						entityAddr.EntityName, entityAddr.AddressType, caseID, current.Depth)
				}

				transactions, err := e.fetcher.GetTransactions(ctx, current.Address, current.Chain, config.Direction)
				if err != nil {
					log.Printf("[WARN] Failed to fetch txns for %s: %v", current.Address, err)
					return
				}

				filtered, isWhale := e.filterTransactions(transactions, config)
				if isWhale {
					log.Printf("[TRACE] 🐋 HIGH-FREQUENCY WHALE DETECTED: %s. Marking as UNKNOWN_HUB and halting branch.", current.Address)
					mu.Lock()
					currLower := strings.ToLower(current.Address)
					for i, n := range result.Nodes {
						if n.ID == currLower {
							result.Nodes[i].Label = "UNKNOWN_HUB (Whale)"
							result.Nodes[i].Type = "Hub"
							break
						}
					}
					mu.Unlock()
					return // Stop tracing this specific branch
				}

				if len(filtered) == 0 {
					return
				}

				var nextQueue []QueueItem
				
				mu.Lock()
				for _, tx := range filtered {
					nextAddress := strings.ToLower(tx.ToAddress)
					if strings.EqualFold(tx.ToAddress, current.Address) {
						nextAddress = strings.ToLower(tx.FromAddress)
					}
					
					fromLower := strings.ToLower(tx.FromAddress)
					toLower := strings.ToLower(tx.ToAddress)

					// Add Edge
					if !edgeTracker[tx.Hash] {
						edgeTracker[tx.Hash] = true
						result.Edges = append(result.Edges, GraphEdge{
							Source: fromLower,
							Target: toLower,
							Amount: tx.Amount,
							Token:  tx.TokenSymbol,
							TxHash: tx.Hash,
						})
					}

					// Add Node
					if !nodeTracker[nextAddress] {
						nodeTracker[nextAddress] = true
						result.Nodes = append(result.Nodes, GraphNode{
							ID:     nextAddress,
							Label:  fmt.Sprintf("%s…%s", nextAddress[:8], nextAddress[len(nextAddress)-4:]),
							Type:   "Private",
							IsVASP: false,
						})
					}

					if visited[nextAddress] {
						continue
					}
					visited[nextAddress] = true

					hop := models.TraceHop{
						FromAddress:     tx.FromAddress,
						ToAddress:       tx.ToAddress,
						TxHash:          tx.Hash,
						Amount:          tx.Amount,
						TokenSymbol:     tx.TokenSymbol,
						AssetIdentifier: tx.AssetIdentifier,
						Direction:       tx.Direction,
						HopNumber:       current.Depth + 1,
						Timestamp:       tx.Timestamp,
					}
					newPath := append(append([]models.TraceHop{}, current.Path...), hop)

					nextQueue = append(nextQueue, QueueItem{
						Address: nextAddress,
						Chain:   current.Chain,
						Depth:   current.Depth + 1,
						Path:    newPath,
					})
					
					if len(newPath) > len(longestPath) {
						longestPath = newPath
					}
				}
				queue = append(queue, nextQueue...)
				mu.Unlock()
			}(item)
		}
		
		// Wait for the entire batch of 50 to finish processing before pulling the next batch
		wg.Wait()
	}

	// ---------------------------------------------------
	// PHASE 4: Score and rank all accumulated candidates
	// This runs after BFS completes, not during traversal.
	// ---------------------------------------------------
	if len(rawCandidates) > 0 {
		scorerCfg := ScorerConfig{} // KnownStolenAmountUSD not available here; routes.go can enrich
		result.RankedCandidates = ScoreCandidates(rawCandidates, scorerCfg)
		log.Printf("[TRACE] Phase 4 scorer produced %d ranked candidate(s) for case=%s",
			len(result.RankedCandidates), caseID)
	}

	result.Path = longestPath
	result.Duration = time.Since(startTime)
	return result, nil
}


// checkVASPLabel checks if an address is a known VASP.
// Strategy: Redis cache first (fast) → PostgreSQL (authoritative)
func (e *Engine) checkVASPLabel(ctx context.Context, address, chain string) (*models.VASPHit, error) {
	cacheKey := fmt.Sprintf("vasp:%s:%s", chain, address)

	// 1. Check Redis cache (sub-millisecond)
	cached, err := e.redis.Get(ctx, cacheKey).Result()
	if err == nil && cached != "" {
		if cached == "null" {
			return nil, nil // Cached miss — not a VASP
		}
		hit := &models.VASPHit{}
		fmt.Sscanf(cached, "%s|%s|%f", &hit.VASPName, &hit.VASPType, &hit.Confidence)
		hit.Address = address
		hit.Chain = chain
		return hit, nil
	}

	// 2. Cache miss — query PostgreSQL vasp_labels table.
	// Full Postgres wiring is done via the Repository layer in the handler.
	// The engine receives VASP results through the checkVASP callback after fetch.
	// Cache the miss for 30 minutes to avoid redundant DB hits per address.
	e.redis.Set(ctx, cacheKey, "null", 30*time.Minute)

	return nil, nil
}

// filterTransactions is the Dust Filter & Branch Pruner.
//
// It performs TWO jobs:
//   1. DUST FILTER: Removes all transactions below MinValueUSD threshold.
//      This is a direct defence against "Dusting Attacks" where criminals
//      send thousands of $0.001 transactions to crash tracing engines.
//   2. BRANCH PRUNER: Sorts surviving transactions by value (highest first)
//      so we always "follow the money" — the largest transfer is most
//      likely the real laundering path.
func (e *Engine) filterTransactions(txns []models.Transaction, config BFSConfig) ([]models.Transaction, bool) {
	totalBefore := len(txns)
	dustCount := 0

	var filtered []models.Transaction
	for _, tx := range txns {
		// ── Time Filter ──────────────────────────────────────────────────────
		if !config.TimeStart.IsZero() && tx.Timestamp.Before(config.TimeStart) {
			continue
		}
		if !config.TimeEnd.IsZero() && tx.Timestamp.After(config.TimeEnd) {
			continue
		}

		// ── Asset Filter ─────────────────────────────────────────────────────
		if len(config.Assets) > 0 {
			assetAllowed := false
			for _, allowed := range config.Assets {
				if strings.EqualFold(tx.TokenSymbol, allowed) || strings.EqualFold(tx.AssetIdentifier, allowed) {
					assetAllowed = true
					break
				}
			}
			if !assetAllowed {
				continue
			}
		}

		// ── Dust Filter ──────────────────────────────────────────────────────
		// Skip any transaction below our minimum value threshold.
		// Default: $10 USD. Criminals use sub-cent txns to confuse engines.
		if tx.ValueUSD < config.MinValueUSD {
			dustCount++
			continue
		}

		// ── Self-Transfer Filter ──────────────────────────────────────────────
		// Skip transactions where a wallet sends to itself (change outputs).
		if tx.ToAddress == tx.FromAddress {
			continue
		}

		// ── Empty Destination Filter ──────────────────────────────────────────
		// Skip transactions with no destination (contract creation, etc.)
		if tx.ToAddress == "" || tx.ToAddress == "0x0000000000000000000000000000000000000000" {
			continue
		}

		filtered = append(filtered, tx)
	}

	// Log dust attack statistics
	if dustCount > 0 {
		log.Printf("[DUST-FILTER] Blocked %d/%d dust transactions (below $%.2f). "+
			"Attack defence active.", dustCount, totalBefore, config.MinValueUSD)
	}

	// ── Branch Pruner: Sort by USD value descending ───────────────────────────
	// "Follow the money" — the highest-value transaction is always processed
	// first, maximising the chance of finding the VASP in fewer hops.
	for i := 0; i < len(filtered)-1; i++ {
		for j := i + 1; j < len(filtered); j++ {
			if filtered[j].ValueUSD > filtered[i].ValueUSD {
				filtered[i], filtered[j] = filtered[j], filtered[i]
			}
		}
	}

	isWhale := len(filtered) > 200

	// 💰 Heuristic Branch Pruner: Limit exponential fan-out
	// Only explore the top N highest value outbound paths per wallet.
	if config.MaxBranches > 0 && len(filtered) > config.MaxBranches {
		log.Printf("[PRUNE] Wallet branched out to %d addresses. Pruning to top %d largest transfers.", len(filtered), config.MaxBranches)
		filtered = filtered[:config.MaxBranches]
	}

	if totalBefore > 0 {
		log.Printf("[FILTER] %d/%d transactions passed filter (kept $%.2f+ only)",
			len(filtered), totalBefore, config.MinValueUSD)
	}

	return filtered, isWhale
}

// persistPathToNeo4j stores the discovered transaction path as a graph in Neo4j.
// This is what powers the visual fund flow diagram on the frontend.
func (e *Engine) persistPathToNeo4j(ctx context.Context, path []models.TraceHop, vaspHit *models.VASPHit, chain, caseID string) {
	if e.neo4j == nil {
		log.Println("[WARN] Skipping Neo4j persistence because Neo4j driver is nil")
		return
	}
	
	session := e.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	var wg sync.WaitGroup
	for _, hop := range path {
		wg.Add(1)
		go func(h models.TraceHop) {
			defer wg.Done()
			query := `
				MERGE (from:Wallet {address: $from_address, chain: $chain})
				MERGE (to:Wallet {address: $to_address, chain: $chain})
				MERGE (from)-[tx:SENT {
					tx_hash: $tx_hash,
					amount: $amount,
					token: $token,
					asset_identifier: $asset_identifier,
					hop: $hop_number,
					case_id: $case_id,
					timestamp: $timestamp
				}]->(to)
			`
			params := map[string]interface{}{
				"from_address":     h.FromAddress,
				"to_address":       h.ToAddress,
				"chain":            chain,
				"tx_hash":          h.TxHash,
				"amount":           strconv.FormatFloat(h.Amount, 'f', 10, 64),
				"token":            h.TokenSymbol,
				"asset_identifier": h.AssetIdentifier,
				"hop_number":       h.HopNumber,
				"case_id":          caseID,
				"timestamp":        h.Timestamp.Format(time.RFC3339),
			}
			_, err := session.Run(ctx, query, params)
			if err != nil {
				log.Printf("[WARN] Neo4j persist failed for hop %d: %v", h.HopNumber, err)
			}
		}(hop)
	}
	wg.Wait()

	// Mark the final VASP node
	if vaspHit != nil {
		query := `
			MATCH (w:Wallet {address: $address, chain: $chain})
			SET w.vasp_name = $vasp_name,
			    w.vasp_type = $vasp_type,
			    w.is_vasp = true,
			    w.confidence = $confidence
		`
		_, err := session.Run(ctx, query, map[string]interface{}{
			"address":    vaspHit.Address,
			"chain":      vaspHit.Chain,
			"vasp_name":  vaspHit.VASPName,
			"vasp_type":  vaspHit.VASPType,
			"confidence": vaspHit.Confidence,
		})
		if err != nil {
			log.Printf("[WARN] Neo4j VASP mark failed: %v", err)
		}
	}
}

// persistCrossChainJump adds the :BRIDGED_TO relationship in Neo4j
func (e *Engine) persistCrossChainJump(ctx context.Context, sourceBridgeAddr, destAddr, sourceChain string, ev *models.CrossChainEvidence, caseID string) {
	session := e.neo4j.NewSession(ctx, neo4j.SessionConfig{AccessMode: neo4j.AccessModeWrite})
	defer session.Close(ctx)

	query := `
		MERGE (srcBridge:Wallet {address: $src_addr, chain: $src_chain})
		MERGE (destWallet:Wallet {address: $dest_addr, chain: $dest_chain})
		MERGE (srcBridge)-[j:BRIDGED_TO {
			protocol: $protocol,
			message_id: $message_id,
			source_tx: $source_tx,
			dest_tx: $dest_tx,
			correlation_level: $correlation_level,
			case_id: $case_id
		}]->(destWallet)
	`
	params := map[string]interface{}{
		"src_addr":          sourceBridgeAddr,
		"src_chain":         sourceChain,
		"dest_addr":         destAddr,
		"dest_chain":        ev.DestChain,
		"protocol":          ev.BridgeProtocol,
		"message_id":        ev.MessageID,
		"source_tx":         ev.SourceTxHash,
		"dest_tx":           ev.DestTxHash,
		"correlation_level": ev.CorrelationLevel,
		"case_id":           caseID,
	}

	_, err := session.Run(ctx, query, params)
	if err != nil {
		log.Printf("[WARN] Neo4j cross-chain persist failed: %v", err)
	}
}
