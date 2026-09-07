package models

import "time"

// Transaction represents a single blockchain transaction between two addresses.
type Transaction struct {
	Hash            string    `json:"hash"`
	FromAddress     string    `json:"from_address"`
	ToAddress       string    `json:"to_address"`
	Amount          float64   `json:"amount"`
	ValueUSD        float64   `json:"value_usd"`
	TokenSymbol     string    `json:"token_symbol"`
	AssetIdentifier string    `json:"asset_identifier"` // e.g. "native", or "ethereum+erc20+0xdac17f958d2ee523a2206206994597c13d831ec7"
	Direction       string    `json:"direction"`        // "incoming" or "outgoing" relative to the queried address
	Chain           string    `json:"chain"`
	Timestamp       time.Time `json:"timestamp"`
	BlockNumber     int64     `json:"block_number"`
	PriceFetched    float64   `json:"price_fetched"` // Live USD price at time of fetch
}

// TraceHop represents one hop in the BFS path from suspect to VASP.
type TraceHop struct {
	HopNumber       int       `json:"hop_number"`
	FromAddress     string    `json:"from_address"`
	ToAddress       string    `json:"to_address"`
	TxHash          string    `json:"tx_hash"`
	Amount          float64   `json:"amount"`
	TokenSymbol     string    `json:"token_symbol"`
	AssetIdentifier string    `json:"asset_identifier"`
	Direction       string    `json:"direction"`
	Timestamp       time.Time `json:"timestamp"`
	CrossChain      *CrossChainEvidence `json:"cross_chain,omitempty"`
	EntityName      string              `json:"entity_name,omitempty"`
	IsVASP          bool                `json:"is_vasp"`
}

// CrossChainEvidence represents deterministic protocol evidence linking a hop across chains.
type CrossChainEvidence struct {
	SourceChain      string    `json:"source_chain"`
	SourceTxHash     string    `json:"source_tx_hash"`
	DestChain        string    `json:"dest_chain"`
	DestTxHash       string    `json:"dest_tx_hash"`
	BridgeProtocol   string    `json:"bridge_protocol"`
	CorrelationLevel string    `json:"correlation_level"` // "Verified", "Strong Inferred", "Moderate Inference", "Weak"
	MessageID        string    `json:"message_id,omitempty"`
	TimeDeltaSeconds int64     `json:"time_delta_seconds"`
}

// VASPHit represents a confirmed VASP attribution result.
// Preserved from Phase 3 for backward compatibility.
type VASPHit struct {
	Address    string  `json:"address"`
	Chain      string  `json:"chain"`
	VASPName   string  `json:"vasp_name"`   // e.g. "Binance", "WazirX"
	VASPType   string  `json:"vasp_type"`   // e.g. "exchange", "mixer", "hot_wallet"
	Confidence float64 `json:"confidence"`  // 0-100
	RiskLevel  string  `json:"risk_level"`  // "low", "medium", "high", "critical"
	Source     string  `json:"source"`      // e.g. "etherscan_tag", "osint"
}

// ============================================================
// PHASE 4 — ENTITY & ATTRIBUTION MODELS
// ============================================================

// Entity represents a normalized logical organization (e.g. "Binance").
// One entity may own many blockchain addresses.
type Entity struct {
	ID           int64  `json:"id"`
	Name         string `json:"name"`         // e.g. "Binance"
	EntityType   string `json:"entity_type"`  // "exchange", "mixer", "bridge", "defi_protocol", etc.
	Jurisdiction string `json:"jurisdiction"` // Optional: "Cayman Islands", "USA"
}

// EntityAddress is a single blockchain address associated with an Entity,
// along with its attribution semantics and source provenance.
// AddressType values ordered by attribution strength (strongest first):
//
//	deposit_address    — Per-user unique deposit address
//	hot_wallet         — VASP infrastructure operational wallet
//	cold_wallet        — Known cold storage
//	service_wallet     — Fee/operational wallet
//	exchange_controlled — General exchange-owned address
//	entity_associated  — Confirmed association, exact role unknown
//	cluster_associated — WCC/heuristic inference (weakest; never sole basis)
type EntityAddress struct {
	EntityID    int64     `json:"entity_id"`
	EntityName  string    `json:"entity_name"`
	EntityType  string    `json:"entity_type"`
	Address     string    `json:"address"`
	Chain       string    `json:"chain"`
	AddressType string    `json:"address_type"`
	Source      string    `json:"source"`
	SourceType  string    `json:"source_type"` // "intelligence_vendor", "osint", "regulatory", "manual", "heuristic"
	Reliability float64   `json:"reliability"` // 0.00 – 1.00
	LastVerified time.Time `json:"last_verified"`
}

// SourceProvenance records where a piece of attribution evidence came from.
type SourceProvenance struct {
	Name          string    `json:"name"`           // e.g. "Chainalysis", "OFAC", "OSINT"
	SourceType    string    `json:"source_type"`    // "intelligence_vendor", "regulatory", "osint", "heuristic"
	Reliability   float64   `json:"reliability"`    // 0.00 – 1.00
	LastVerified  time.Time `json:"last_verified"`
	FreshnessDays int       `json:"freshness_days"` // Days since last_verified
	IsStale       bool      `json:"is_stale"`       // True if > 180 days since last_verified
}

// PathMetrics captures evidence about the transaction path to a candidate.
type PathMetrics struct {
	HopDistance         int     `json:"hop_distance"`
	ValueAtCandidate    float64 `json:"value_at_candidate_usd"`
	InitialTracedValue  float64 `json:"initial_traced_value_usd"`
	ValueContinuityPct  float64 `json:"value_continuity_pct"`    // 0–100
	// "case_amount" if TraceRequest.KnownStolenAmountUSD was provided,
	// "first_hop_value" if calculated from the first traced transaction.
	ContinuityMethodology string  `json:"continuity_methodology"`
	TemporalSpanHours     float64 `json:"temporal_span_hours"`   // Time first→last hop
	TimestampsMonotonic   bool    `json:"timestamps_monotonic"`  // All hops strictly increasing?
}

// AttributionEvidence is the structured justification for one candidate path.
// Designed to be fully investigator-auditable:
//
//	Candidate → Evidence → Transaction → Blockchain record.
type AttributionEvidence struct {
	// Why this candidate was generated
	MatchType string `json:"match_type"` // "direct_hit", "entity_lookup", "cluster_associated"

	// Address that triggered the match
	MatchedAddress string `json:"matched_address"`
	AddressType    string `json:"address_type"` // e.g. "deposit_address", "hot_wallet"

	// Source provenance
	Source SourceProvenance `json:"source"`

	// Full path of hops leading to this candidate
	Path        []TraceHop  `json:"path"`
	PathMetrics PathMetrics `json:"path_metrics"`

	// Scoring transparency (normalized 0–1 factors before multiplication)
	AddressTypeWeight   float64 `json:"address_type_weight"`
	SourceWeight        float64 `json:"source_weight"`
	PathDecayMultiplier float64 `json:"path_decay_multiplier"`

	// Plain-English explanation for the investigator
	Explanation string `json:"explanation"`
}

// AttributionCandidate is an investigator-facing VASP attribution result.
// Multiple raw BFS hits for the same entity are deduplicated into one candidate.
// Phase 3 FoundVASPs remains on CaseResult for backward compatibility.
type AttributionCandidate struct {
	// Entity identification
	EntityID   int64  `json:"entity_id"`
	EntityName string `json:"entity_name"` // e.g. "Binance"
	EntityType string `json:"entity_type"` // e.g. "exchange"

	// Attribution confidence — INDEPENDENT of criminal risk score.
	// Answers: "How strong is the evidence this fund flow reached this VASP?"
	// Does NOT answer: "How criminal/dangerous is this wallet?"
	Confidence      float64 `json:"confidence"`       // 0–100
	ConfidenceLevel string  `json:"confidence_level"` // "Very Strong" | "Strong" | "Moderate" | "Weak"

	// Summary attribution type
	AttributionType string `json:"attribution_type"` // e.g. "Direct Deposit", "Infrastructure", "Entity Association"

	// Strongest supporting evidence path
	PrimaryEvidence AttributionEvidence `json:"primary_evidence"`

	// Additional paths for the same entity (not double-counted in confidence)
	SupportingPaths []AttributionEvidence `json:"supporting_paths,omitempty"`

	// Investigator caveats (stale labels, low continuity, etc.)
	Limitations []string `json:"limitations,omitempty"`
}

// TraceRequest is the JSON body accepted by POST /api/v1/trace
type TraceRequest struct {
	TxHash         string `json:"tx_hash,omitempty"` // Preferred input for auto-timestamping
	SuspectAddress string `json:"suspect_address"`   // Required if TxHash is not provided
	Chain          string `json:"chain" binding:"required"` // e.g. "ethereum", "bitcoin"
	CaseID         string `json:"case_id" binding:"required"`
	SubmittedBy    string `json:"submitted_by"`
	CallbackURL    string `json:"callback_url"` // SAHYOG webhook URL for async response

	// Optional: known stolen amount for value continuity.
	// If omitted, continuity is calculated from the first traced hop.
	KnownStolenAmountUSD *float64 `json:"known_stolen_amount_usd,omitempty"`

	// Phase 3 configuration parameters (all optional, safe defaults applied server-side)
	MaxDepth    *int     `json:"max_depth,omitempty"`
	MaxBranches *int     `json:"max_branches,omitempty"`
	MinValueUSD *float64 `json:"min_value_usd,omitempty"`
	TimeStart   *string  `json:"time_start,omitempty"`
	TimeEnd     *string  `json:"time_end,omitempty"`
	Direction   *string  `json:"direction,omitempty"` // "incoming", "outgoing", "both"
	Assets      []string `json:"assets,omitempty"`
}

// TraceResponse is returned immediately after POST /api/v1/trace (async)
type TraceResponse struct {
	CaseID  string `json:"case_id"`
	Status  string `json:"status"`  // "accepted"
	Message string `json:"message"`
	PollURL string `json:"poll_url"` // e.g. /api/v1/case/{case_id}
}

// CaseResult is the full result returned by GET /api/v1/case/:id
type CaseResult struct {
	CaseID         string `json:"case_id"`
	SuspectAddress string `json:"suspect_address"`
	Chain          string `json:"chain"`
	Status         string `json:"status"` // "pending", "tracing", "completed", "failed"

	// ── Phase 3 backward-compatible fields (preserved) ──
	FoundVASP    *VASPHit   `json:"found_vasp,omitempty"`
	FoundVASPs   []*VASPHit `json:"found_vasps,omitempty"`
	FoundBridges []*VASPHit `json:"found_bridges,omitempty"`
	Path         []TraceHop `json:"path"`
	HopsTraced   int        `json:"hops_traced"`
	Confidence   float64    `json:"confidence"`
	RiskScore    float64    `json:"risk_score"`

	// ── Phase 4: ranked, deduplicated attribution candidates ──
	// Confidence here is attribution confidence, NOT the criminal risk score.
	RankedCandidates []AttributionCandidate `json:"ranked_candidates,omitempty"`

	SubmittedBy string `json:"submitted_by"`
	CreatedAt   string `json:"created_at"`
	CompletedAt string `json:"completed_at,omitempty"`
	ReportHash  string `json:"report_hash,omitempty"`
}


