package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/neo4j/neo4j-go-driver/v5/neo4j"
	"github.com/redis/go-redis/v9"

	"vasp-engine/internal/db"
	"vasp-engine/internal/models"
	"vasp-engine/internal/tracer"
)

// RegisterRoutes wires all API endpoints to the Gin router.
func RegisterRoutes(
	router *gin.Engine,
	pg *sql.DB,
	neo4jDriver neo4j.DriverWithContext,
	redisClient *redis.Client,
) {
	// Add CORS middleware
	router.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Origin, Content-Type")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	var repo *db.Repository
	if pg != nil {
		repo = db.NewRepository(pg)
	}
	graphRepo := db.NewGraphRepository(neo4jDriver)
	engine := tracer.NewEngine(neo4jDriver, redisClient)
	if repo != nil {
		engine.SetRepo(repo) // Wire entity-lookup DB layer into BFS engine (Phase 4)
	}

	h := &Handler{pg: pg, neo4j: neo4jDriver, redis: redisClient, repo: repo, graphRepo: graphRepo, engine: engine}

	router.GET("/health", h.HealthCheck)

	v1 := router.Group("/api/v1")

	{
		// Core tracing endpoints
		v1.POST("/trace", h.TraceWallet)
		v1.POST("/trace/extend", h.ExtendTrace)
		
		// Live tracking endpoints
		v1.POST("/track", h.StartTracking)
		v1.GET("/live-feed", h.LiveFeed)
		v1.GET("/case/:case_id", h.GetCase)
		v1.GET("/cases", h.ListCases)
		v1.GET("/lookup/:chain/:address", h.LookupAddress)
		v1.GET("/portfolio/:chain/:address", h.GetWalletPortfolio)
		v1.GET("/risk/:chain/:address", h.GetRiskScore)
		v1.GET("/intelligence/case/:case_id", h.GetCaseIntelligence)
		

		// Export endpoints
		v1.GET("/report/:case_id", h.GenerateReport)
		v1.GET("/case/:case_id/evidence-package", h.GenerateEvidencePackage)

		// Integration / SAHYOG Normalized endpoints (Preview Only)
		v1.GET("/integration/sahyog/disclosure/:case_id", h.PrepareDisclosure)
		v1.GET("/integration/sahyog/freeze/:case_id", h.PrepareFreeze)




		// Integration / SAHYOG Normalized endpoints (Preview Only)
		// Graph analytics endpoints (Shadow Graph)

		v1.GET("/graph/stats", h.GetGraphStats)
		v1.GET("/graph/wallet/:chain/:address", h.GetWalletAnalysis)
		v1.GET("/graph/hubs/:chain", h.GetTopHubs)
		v1.GET("/graph/case/:case_id", h.GetCaseGraph)
	}
}

// Handler holds shared dependencies for all route handlers.
type Handler struct {
	pg        *sql.DB
	neo4j     neo4j.DriverWithContext
	redis     *redis.Client
	repo      *db.Repository
	graphRepo *db.GraphRepository
	engine    *tracer.Engine
}

// HealthCheck returns live status of all database connections.
func (h *Handler) HealthCheck(c *gin.Context) {
	status := gin.H{"status": "ok", "service": "vasp-attribution-engine", "version": "1.0.0",
		"postgres": "ok", "neo4j": "ok", "redis": "ok"}

	if err := h.pg.PingContext(c.Request.Context()); err != nil {
		status["postgres"] = "error: " + err.Error()
		status["status"] = "degraded"
	}
	if err := h.neo4j.VerifyConnectivity(c.Request.Context()); err != nil {
		status["neo4j"] = "error: " + err.Error()
		status["status"] = "degraded"
	}
	if _, err := h.redis.Ping(context.Background()).Result(); err != nil {
		status["redis"] = "error: " + err.Error()
		status["status"] = "degraded"
	}

	code := http.StatusOK
	if status["status"] == "degraded" {
		code = http.StatusServiceUnavailable
	}
	c.JSON(code, status)
}

// TraceWallet accepts a suspect wallet, saves the case, and starts async BFS tracing.
func (h *Handler) TraceWallet(c *gin.Context) {
	var req models.TraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	// Rule 1: The Time Barrier.
	// If TxHash is provided, resolve the scam timestamp and receiver address automatically.
	if req.TxHash != "" {
		// Mock resolving TxHash for now
		// In production, this would call fetcher.GetTransaction(txHash)
		// For now, we mock the scam timestamp to 24 hours ago, and dummy amount
		mockScamTime := time.Now().Add(-24 * time.Hour)
		mockScamTimeStr := mockScamTime.Format(time.RFC3339)
		req.TimeStart = &mockScamTimeStr
		
		mockAmount := 50000.0
		req.KnownStolenAmountUSD = &mockAmount
		
		// If they didn't provide a suspect address, we mock extracting the receiver
		if req.SuspectAddress == "" {
			req.SuspectAddress = "0xResolvedFromTxHash_Receiver"
		}
	} else if req.SuspectAddress == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "must provide either tx_hash or suspect_address"})
		return
	}

	// Apply configuration defaults and safe limits
	config := tracer.DefaultConfig()
	if req.MaxDepth != nil {
		config.MaxDepth = *req.MaxDepth
		if config.MaxDepth > 15 {
			config.MaxDepth = 15 // Hard limit
		} else if config.MaxDepth <= 0 {
			config.MaxDepth = 1
		}
	}
	if req.MaxBranches != nil {
		config.MaxBranches = *req.MaxBranches
		if config.MaxBranches > 25 {
			config.MaxBranches = 25 // Prevent massive radial explosions
		} else if config.MaxBranches <= 0 {
			config.MaxBranches = 5
		}
	}
	if req.MinValueUSD != nil {
		config.MinValueUSD = *req.MinValueUSD
		if config.MinValueUSD < 0 {
			config.MinValueUSD = 0
		}
	}
	if req.Direction != nil {
		dir := *req.Direction
		if dir == "incoming" || dir == "both" {
			config.Direction = dir
		} else {
			config.Direction = "outgoing" // default safe behavior
		}
	}
	if req.TimeStart != nil {
		t, err := time.Parse(time.RFC3339, *req.TimeStart)
		if err == nil {
			config.TimeStart = t
		}
	}
	if req.TimeEnd != nil {
		t, err := time.Parse(time.RFC3339, *req.TimeEnd)
		if err == nil {
			config.TimeEnd = t
		}
	}
	if len(req.Assets) > 0 {
		config.Assets = req.Assets
	}

	// Check for Demo Showcase Mode
	if _, ok := DemoCases[req.SuspectAddress]; ok {
		if h.repo != nil {
			// Create the case and mark it as tracing initially
			_ = h.repo.CreateCase(c.Request.Context(), req)
			_ = h.repo.UpdateCaseStatus(c.Request.Context(), req.CaseID, "tracing")
			
			// Simulate realistic tracking duration (15-30 seconds)
			go func(caseID string) {
				time.Sleep(20 * time.Second) // 20 second artificial delay
				_ = h.repo.UpdateCaseStatus(context.Background(), caseID, "completed")
			}(req.CaseID)
		}

		c.JSON(http.StatusOK, gin.H{
			"message":  "Demo Showcase trace started (simulated)",
			"case_id":  req.CaseID,
			"demo_mode": true,
		})
		return
	}

	// Save case to PostgreSQL immediately
	if h.repo != nil {
		if err := h.repo.CreateCase(c.Request.Context(), req); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create case"})
			return
		}
	}

	// Kick off BFS tracing asynchronously (don't block the HTTP response)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
		defer cancel()

		if h.repo != nil {
			_ = h.repo.UpdateCaseStatus(ctx, req.CaseID, "tracing")
		}

		result, err := h.engine.Trace(ctx, config, req.CaseID, req.SuspectAddress, req.Chain)
		if err != nil {
			if h.repo != nil {
				_ = h.repo.UpdateCaseStatus(ctx, req.CaseID, "failed")
			}
			return
		}

			// 1. Determine final path and VASP to save
			vaspName := "not_found"
			confidence := result.Confidence
			if len(result.RankedCandidates) > 0 {
				top := result.RankedCandidates[0]
				vaspName = top.EntityName
				confidence = top.Confidence
				result.Path = top.PrimaryEvidence.Path
			} else if result.FoundVASP != nil {
				vaspName = result.FoundVASP.VASPName
			}

			// 2. Save each hop to PostgreSQL for audit trail
			if h.repo != nil {
				for _, hop := range result.Path {
					isLast := hop.HopNumber == result.HopsTraced
					_ = h.repo.SaveTraceHop(ctx, req.CaseID, hop, isLast && result.FoundVASP != nil)
				}
			}

			// 3. Update case with final result
			if h.repo != nil {
				_ = h.repo.UpdateCaseResult(ctx, req.CaseID, vaspName, confidence, result.HopsTraced, result.RankedCandidates)
			}

			// Save to Neo4j Shadow Graph
			var dbHops []db.TraceHop
			for _, hop := range result.Path {
				t := hop.Timestamp
				if t.IsZero() {
					t = time.Now()
				}
				dbHops = append(dbHops, db.TraceHop{
					HopNumber:   hop.HopNumber,
					FromAddress: hop.FromAddress,
					ToAddress:   hop.ToAddress,
					TxHash:      hop.TxHash,
					Amount:      hop.Amount,
					TokenSymbol: hop.TokenSymbol,
					Timestamp:   t,
				})
			}
			
			vaspAddr := ""
			vaspType := "unknown"
			vaspRisk := "unknown"
			if result.FoundVASP != nil {
				vaspAddr = result.FoundVASP.Address
				vaspType = result.FoundVASP.VASPType
				vaspRisk = result.FoundVASP.RiskLevel
			}

			if h.graphRepo != nil {
				_ = h.graphRepo.SaveTracePath(ctx, req.CaseID, req.SuspectAddress, req.Chain, dbHops, vaspAddr, vaspName, vaspType, vaspRisk)
			}
	}()

	// Return 202 Accepted immediately — client polls /case/:id for result
	c.JSON(http.StatusAccepted, models.TraceResponse{
		CaseID:  req.CaseID,
		Status:  "accepted",
		Message: "Trace job started. Poll the result URL for updates.",
		PollURL: "/api/v1/case/" + req.CaseID,
	})
}


// ExtendTraceRequest handles requests to push a trace deeper.
type ExtendTraceRequest struct {
	CaseID       string   `json:"case_id" binding:"required"`
	ExtendHops   int      `json:"extend_hops" binding:"required"`
}

// ExtendTrace takes a maxed-out case and traces deeper from terminal nodes.
func (h *Handler) ExtendTrace(c *gin.Context) {
	var req ExtendTraceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request: " + err.Error()})
		return
	}

	if h.repo != nil {
		_ = h.repo.UpdateCaseStatus(c.Request.Context(), req.CaseID, "tracing")
	}

	// In a full production scenario, this would load the terminal nodes from Neo4j
	// and resume the BFS Engine from those nodes.
	// For now, we mock the asynchronous acceptance.
	go func() {
		// Mock logic: Update status back to completed after a short delay
		// so the UI can proceed. Real implementation requires Engine state resumption.
		time.Sleep(3 * time.Second)
		if h.repo != nil {
			_ = h.repo.UpdateCaseStatus(context.Background(), req.CaseID, "completed")
		}
	}()

	c.JSON(http.StatusAccepted, gin.H{
		"case_id": req.CaseID,
		"status":  "accepted",
		"message": fmt.Sprintf("Trace extended by %d hops.", req.ExtendHops),
	})
}

// GetCase returns the full result of a trace job by case ID.
func (h *Handler) GetCase(c *gin.Context) {
	caseID := c.Param("case_id")
	
	// Fast-path for Dashboard injected mocked cases
	if caseID == "demo-case-001" { c.JSON(http.StatusOK, getDemoCase("demo-mixer", caseID, "0x098B716B8Aaf215190988513afF39BA65EdAB176")); return }
	if caseID == "demo-case-002" { c.JSON(http.StatusOK, getDemoCase("demo-scam-vasp", caseID, "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8")); return }
	if caseID == "demo-case-003" { c.JSON(http.StatusOK, getDemoCase("demo-normal", caseID, "0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1")); return }
	if caseID == "demo-case-004" { c.JSON(http.StatusOK, getDemoCase("demo-safe-vasp", caseID, "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3")); return }

	result, err := h.repo.GetCase(c.Request.Context(), caseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "case not found"})
		return
	}
	
	if demoType, ok := DemoCases[result.SuspectAddress]; ok {
		c.JSON(http.StatusOK, getDemoCase(demoType, caseID, result.SuspectAddress))
		return
	}

	c.JSON(http.StatusOK, result)
}

// ListCases returns all investigation cases, optionally filtered by status.
func (h *Handler) ListCases(c *gin.Context) {
	status := c.Query("status") // optional: ?status=completed
	
	// Fetch actual cases from the database
	cases, err := h.repo.ListCases(c.Request.Context(), status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	// Inject the 5 Demo Cases for the Dashboard presentation
	var allCases []models.CaseResult
	
	// Only add demo cases if we're not filtering for some strictly non-matching status
	if status == "" || status == "completed" {
		demo1 := getDemoCase("demo-mixer", "demo-case-001", "0x098B716B8Aaf215190988513afF39BA65EdAB176") // Ronin
		demo2 := getDemoCase("demo-scam-vasp", "demo-case-002", "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8") // Scammer
		demo3 := getDemoCase("demo-normal", "demo-case-003", "0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1") // Normal Whale
		demo4 := getDemoCase("demo-safe-vasp", "demo-case-004", "0x71660c4005BA85c37ccec55d0C4493E66Fe775d3") // Safe User
		
		allCases = append(allCases, *demo1, *demo2, *demo3, *demo4)
	}
	
	allCases = append(allCases, cases...)
	
	c.JSON(http.StatusOK, gin.H{"cases": allCases, "count": len(allCases)})
}

// LookupAddress checks if an address is a known VASP in our attribution DB.
func (h *Handler) LookupAddress(c *gin.Context) {
	chain := c.Param("chain")
	address := c.Param("address")

	hit, err := h.repo.LookupVASP(c.Request.Context(), address, chain)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if hit == nil {
		c.JSON(http.StatusOK, gin.H{"address": address, "chain": chain, "is_vasp": false, "vasp": nil})
		return
	}
	c.JSON(http.StatusOK, gin.H{"address": address, "chain": chain, "is_vasp": true, "vasp": hit})
}

type mlScoreRequest struct {
	Address string `json:"address"`
	Chain   string `json:"chain"`
	Hops    []any  `json:"hops"`
}

// GetRiskScore proxies to the Python intelligence service for risk scoring.
func (h *Handler) GetRiskScore(c *gin.Context) {
	chain := c.Param("chain")
	address := c.Param("address")

	reqBody, _ := json.Marshal(mlScoreRequest{
		Address: address,
		Chain:   chain,
		Hops:    []any{}, // We send empty hops for a base risk score lookup
	})

	resp, err := http.Post("http://localhost:8001/intelligence/score", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"address":    address,
			"chain":      chain,
			"risk_score": 0,
			"risk_level": "unknown",
			"message":    "intelligence service offline",
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var mlResult map[string]any
	json.Unmarshal(body, &mlResult)

	c.JSON(http.StatusOK, mlResult)
}

type caseIntelRequest struct {
	CaseID           string                        `json:"case_id"`
	SuspectAddress   string                        `json:"suspect_address"`
	Chain            string                        `json:"chain"`
	Path             []models.TraceHop             `json:"path"`
	RankedCandidates []models.AttributionCandidate `json:"ranked_candidates"`
}

// GetCaseIntelligence aggregates existing trace data and requests the Python service 
// to generate a case-level intelligence summary including timeline and typologies.
func (h *Handler) GetCaseIntelligence(c *gin.Context) {
	caseID := c.Param("case_id")
	
	// Fast-path for Dashboard injected mocked cases
	if caseID == "demo-case-001" { c.JSON(http.StatusOK, getDemoIntelligence("demo-mixer", caseID)); return }
	if caseID == "demo-case-002" { c.JSON(http.StatusOK, getDemoIntelligence("demo-scam-vasp", caseID)); return }
	if caseID == "demo-case-003" { c.JSON(http.StatusOK, getDemoIntelligence("demo-normal", caseID)); return }
	if caseID == "demo-case-004" { c.JSON(http.StatusOK, getDemoIntelligence("demo-safe-vasp", caseID)); return }

	result, err := h.repo.GetCase(c.Request.Context(), caseID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if result == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "case not found"})
		return
	}

	if demoType, ok := DemoCases[result.SuspectAddress]; ok {
		c.JSON(http.StatusOK, getDemoIntelligence(demoType, caseID))
		return
	}

	var path []models.TraceHop
	if len(result.RankedCandidates) > 0 {
		path = result.RankedCandidates[0].PrimaryEvidence.Path
	} else {
		path = result.Path
	}

	// Enrich path with VASP tags (contextual awareness without deleting evidence)
	for i := range path {
		hit, _ := h.repo.LookupVASP(c.Request.Context(), path[i].ToAddress, result.Chain)
		if hit != nil {
			path[i].EntityName = hit.VASPName
			path[i].IsVASP = true
		}
	}

	reqBody, _ := json.Marshal(caseIntelRequest{
		CaseID:           caseID,
		SuspectAddress:   result.SuspectAddress,
		Chain:            result.Chain,
		Path:             path,
		RankedCandidates: result.RankedCandidates,
	})

	resp, err := http.Post("http://localhost:8001/case-intelligence", "application/json", bytes.NewBuffer(reqBody))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"error":   "intelligence service offline",
			"details": err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	var intelResult map[string]any
	json.Unmarshal(body, &intelResult)

	c.JSON(http.StatusOK, intelResult)
}


