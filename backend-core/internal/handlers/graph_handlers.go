package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

// ──────────────────────────────────────────────────────────────────────────────
// Graph Analytics Handlers
// These endpoints expose the Neo4j Shadow Graph intelligence to the frontend.
// ──────────────────────────────────────────────────────────────────────────────

// GetGraphStats returns global statistics about the Shadow Graph database.
// GET /api/v1/graph/stats
func (h *Handler) GetGraphStats(c *gin.Context) {
	stats, err := h.graphRepo.GetGraphStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"graph":  stats,
	})
}

// GetWalletAnalysis runs a deep graph analysis on a specific wallet address.
// Returns neighbors, centrality score, cluster members, and shortest path to a VASP.
// GET /api/v1/graph/wallet/:chain/:address
func (h *Handler) GetWalletAnalysis(c *gin.Context) {
	chain := c.Param("chain")
	address := c.Param("address")
	ctx := c.Request.Context()

	// Get direct neighbors
	neighbors, err := h.graphRepo.GetWalletNeighbors(ctx, address, chain)
	if err != nil {
		neighbors = []map[string]any{}
	}

	// Find shortest path to any known VASP
	paths, err := h.graphRepo.FindShortestPathToVASP(ctx, address, chain)
	if err != nil {
		paths = nil
	}

	// Compute centrality (PageRank proxy)
	centrality, _ := h.graphRepo.ComputeWalletCentrality(ctx, address, chain)

	// Find connected component (WCC proxy)
	component, err := h.graphRepo.FindConnectedComponent(ctx, address, chain, 4)
	if err != nil {
		component = []map[string]any{}
	}

	isHub := centrality > 5.0

	c.JSON(http.StatusOK, gin.H{
		"address":            address,
		"chain":              chain,
		"direct_neighbors":   len(neighbors),
		"neighbors":          neighbors,
		"centrality_score":   centrality,
		"is_hub":             isHub,
		"cluster_size":       len(component),
		"cluster_members":    component,
		"shortest_paths":     paths,
	})
}

// GetTopHubs returns wallets with the highest centrality — likely mixing hubs.
// GET /api/v1/graph/hubs/:chain
func (h *Handler) GetTopHubs(c *gin.Context) {
	chain := c.Param("chain")
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit > 100 {
		limit = 20
	}

	hubs, err := h.graphRepo.GetTopRiskHubs(c.Request.Context(), chain, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"chain": chain,
		"count": len(hubs),
		"hubs":  hubs,
	})
}

// GetCaseGraph returns the full Neo4j graph for a specific investigation case.
// If Neo4j has no data yet (e.g. fresh trace), it falls back to building the
// graph from the PostgreSQL transaction_traces audit table so the UI is never empty.
// GET /api/v1/graph/case/:case_id
func (h *Handler) GetCaseGraph(c *gin.Context) {
	caseID := c.Param("case_id")
	ctx := c.Request.Context()

	// Fast-path for Dashboard injected mocked cases
	if caseID == "demo-case-001" { c.JSON(http.StatusOK, getDemoGraph("demo-mixer", caseID, "0x098B716B8Aaf215190988513afF39BA65EdAB176")); return }
	if caseID == "demo-case-002" { c.JSON(http.StatusOK, getDemoGraph("demo-scam-vasp", caseID, "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8")); return }
	if caseID == "demo-case-003" { c.JSON(http.StatusOK, getDemoGraph("demo-normal", caseID, "0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1")); return }
	if caseID == "demo-case-004" { c.JSON(http.StatusOK, getDemoGraph("demo-safe-vasp", caseID, "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3")); return }

	// Fetch case to get suspect address
	caseResult, err := h.repo.GetCase(ctx, caseID)
	if err == nil && caseResult != nil {
		if demoType, ok := DemoCases[caseResult.SuspectAddress]; ok {
			c.JSON(http.StatusOK, getDemoGraph(demoType, caseID, caseResult.SuspectAddress))
			return
		}
	}

	nodes, edges, err := h.graphRepo.GetCaseGraph(ctx, caseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// ── PostgreSQL fallback ──────────────────────────────────────────────────
	// If Neo4j has no edges for this case yet (trace just finished or Neo4j
	// was unreachable during save), build the graph from the audit trail table.
	if len(edges) == 0 && h.repo != nil {
		caseResult, pgErr := h.repo.GetCase(ctx, caseID)
		if pgErr == nil && caseResult != nil && len(caseResult.Path) > 0 {
			nodeSet := map[string]bool{}
			for _, hop := range caseResult.Path {
				fromL := strings.ToLower(hop.FromAddress)
				toL   := strings.ToLower(hop.ToAddress)

				if !nodeSet[fromL] {
					nodeSet[fromL] = true
					label := fromL
					if len(fromL) >= 12 {
						label = fromL[:8] + "…" + fromL[len(fromL)-4:]
					}
					nodes = append(nodes, map[string]any{
						"address":    fromL,
						"label":      label,
						"type":       "Private",
						"is_vasp":    false,
						"risk_level": "unknown",
					})
				}
				if !nodeSet[toL] {
					nodeSet[toL] = true
					label := toL
					if len(toL) >= 12 {
						label = toL[:8] + "…" + toL[len(toL)-4:]
					}
					isVASP := hop.IsVASP
					lbl := label
					if hop.EntityName != "" {
						lbl = hop.EntityName
					}
					nodes = append(nodes, map[string]any{
						"address":    toL,
						"label":      lbl,
						"type":       map[bool]string{true: "Exchange", false: "Private"}[isVASP],
						"is_vasp":    isVASP,
						"risk_level": "unknown",
					})
				}

				edges = append(edges, map[string]any{
					"from_address": fromL,
					"to_address":   toL,
					"tx_hash":      hop.TxHash,
					"amount":       hop.Amount,
					"token":        hop.TokenSymbol,
					"value_usd":    hop.Amount,
				})
			}
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"case_id":    caseID,
		"node_count": len(nodes),
		"edge_count": len(edges),
		"nodes":      nodes,
		"edges":      edges,
	})
}
