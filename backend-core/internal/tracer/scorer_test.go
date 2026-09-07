package tracer

import (
	"math"
	"strings"
	"testing"
	"time"

	"vasp-engine/internal/models"
)

// ── Test helpers ─────────────────────────────────────────────────────────────

func makeEntityAddr(entityID int64, entityName, entityType, addrType, source, sourceType string, reliability float64, daysOld int) models.EntityAddress {
	return models.EntityAddress{
		EntityID:    entityID,
		EntityName:  entityName,
		EntityType:  entityType,
		Address:     "0x" + strings.Repeat("a", 40),
		Chain:       "ethereum",
		AddressType: addrType,
		Source:      source,
		SourceType:  sourceType,
		Reliability: reliability,
		LastVerified: time.Now().AddDate(0, 0, -daysOld),
	}
}

func makePath(hops int, amount float64) []models.TraceHop {
	var path []models.TraceHop
	for i := 0; i < hops; i++ {
		path = append(path, models.TraceHop{
			HopNumber:   i + 1,
			FromAddress: "0xfrom",
			ToAddress:   "0xto",
			TxHash:      "0xhash",
			Amount:      amount,
			TokenSymbol: "ETH",
			Timestamp:   time.Now().Add(time.Duration(i) * time.Hour),
		})
	}
	return path
}

// ── Unit tests ────────────────────────────────────────────────────────────────

// T1. Direct known deposit address — expect Very Strong (≥90)
func TestScorer_DirectDepositAddress(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(1, "Binance", "exchange", "deposit_address", "Chainalysis", "intelligence_vendor", 0.95, 10),
			Path:        makePath(1, 10000),
			HopDistance: 1,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 10000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	c := results[0]
	if c.ConfidenceLevel != "Very Strong" {
		t.Errorf("T1: expected Very Strong, got %s (score=%.1f)", c.ConfidenceLevel, c.Confidence)
	}
	if c.AttributionType != "Direct Deposit" {
		t.Errorf("T1: expected Direct Deposit attribution type, got %s", c.AttributionType)
	}
}

// T2. Known hot wallet — expect Strong or Very Strong
func TestScorer_HotWallet(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(2, "Kraken", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 30),
			Path:        makePath(2, 5000),
			HopDistance: 2,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 5000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	c := results[0]
	if c.Confidence < 50 {
		t.Errorf("T2: hot wallet should be >= 50, got %.1f", c.Confidence)
	}
}

// T3. Entity-associated address (role unclear) — expect Moderate
func TestScorer_EntityAssociatedAddress(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(3, "WazirX", "exchange", "entity_associated", "OSINT", "osint", 0.80, 60),
			Path:        makePath(3, 2000),
			HopDistance: 3,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 2000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	c := results[0]
	if c.ConfidenceLevel != "Moderate" && c.ConfidenceLevel != "Weak" {
		// entity_associated with 3-hop path should not be Very Strong or Strong
		t.Errorf("T3: entity_associated at 3 hops should be Moderate/Weak, got %s (%.1f)", c.ConfidenceLevel, c.Confidence)
	}
}

// T4. Cluster/WCC associated address — expect Weak AND contains limitation warning
func TestScorer_ClusterAssociatedAddress(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(4, "SomeExchange", "exchange", "cluster_associated", "WCC", "heuristic", 0.40, 5),
			Path:        makePath(2, 1000),
			HopDistance: 2,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 1000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	c := results[0]
	if c.ConfidenceLevel != "Weak" {
		t.Errorf("T4: cluster_associated must be Weak, got %s (%.1f)", c.ConfidenceLevel, c.Confidence)
	}
	found := false
	for _, l := range c.Limitations {
		if strings.Contains(l, "WCC graph inference") {
			found = true
		}
	}
	if !found {
		t.Errorf("T4: cluster_associated must produce WCC inference limitation warning")
	}
}

// T5. Same entity, multiple addresses — expect deduplication into one candidate
// with SupportingPaths containing the additional addresses
func TestScorer_MultipleAddressesSameEntity(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(5, "Binance", "exchange", "hot_wallet", "OSINT", "osint", 0.95, 10),
			Path:        makePath(1, 8000),
			HopDistance: 1,
		},
		{
			EntityAddr:  makeEntityAddr(5, "Binance", "exchange", "deposit_address", "Chainalysis", "intelligence_vendor", 0.98, 5),
			Path:        makePath(2, 3000),
			HopDistance: 2,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 10000})
	if len(results) != 1 {
		t.Fatalf("T5: expected 1 deduplicated candidate, got %d", len(results))
	}
	c := results[0]
	if c.EntityName != "Binance" {
		t.Errorf("T5: expected Binance, got %s", c.EntityName)
	}
	// Supporting paths must exist
	if len(c.SupportingPaths) == 0 {
		t.Errorf("T5: expected at least 1 supporting path for second address")
	}
}

// T6. Competing VASPs — both returned, higher-scoring comes first
func TestScorer_CompetingVASPs(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(1, "Binance", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10),
			Path:        makePath(1, 5000),
			HopDistance: 1,
		},
		{
			EntityAddr:  makeEntityAddr(2, "Coinbase", "exchange", "entity_associated", "OSINT", "osint", 0.70, 90),
			Path:        makePath(4, 500),
			HopDistance: 4,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 5000})
	if len(results) != 2 {
		t.Fatalf("T6: expected 2 candidates, got %d", len(results))
	}
	// Binance (hot_wallet, 1 hop, high value) should rank above Coinbase (entity_associated, 4 hops)
	if results[0].EntityName != "Binance" {
		t.Errorf("T6: Binance should outrank Coinbase, got %s first", results[0].EntityName)
	}
}

// T7. Unrelated VASP interaction (very low value continuity) — should be Weak
func TestScorer_UnrelatedVASPInteraction(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(3, "Uniswap", "dex", "service_wallet", "OSINT", "osint", 0.85, 20),
			Path:        makePath(2, 1), // Only $1 reached the VASP
			HopDistance: 2,
		},
	}
	// $1 out of $50,000 stolen = 0.002% continuity
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 50000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result")
	}
	c := results[0]
	if c.ConfidenceLevel != "Weak" {
		t.Errorf("T7: near-zero value continuity must produce Weak confidence, got %s (%.1f)", c.ConfidenceLevel, c.Confidence)
	}
}

// T8. High-value direct path vs low-value short path
// High-value long path should outscore low-value short path
func TestScorer_HighValueVsShortLowValue(t *testing.T) {
	// 5-hop path with $9000 value
	longHighValue := RawCandidate{
		EntityAddr:  makeEntityAddr(1, "Binance", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10),
		Path:        makePath(5, 9000),
		HopDistance: 5,
	}
	// 1-hop path with $0.50 value
	shortLowValue := RawCandidate{
		EntityAddr:  makeEntityAddr(2, "GateIO", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10),
		Path:        makePath(1, 0.50),
		HopDistance: 1,
	}
	results := ScoreCandidates([]RawCandidate{longHighValue, shortLowValue}, ScorerConfig{KnownStolenAmountUSD: 10000})
	if len(results) != 2 {
		t.Fatalf("expected 2 results")
	}
	// Both use same address type and source; the key difference is value continuity
	// Binance: 90% continuity at 5 hops > GateIO: 0.005% continuity at 1 hop
	if results[0].EntityName != "Binance" {
		t.Errorf("T8: high-value long path should outscore low-value short path, got %s first", results[0].EntityName)
	}
}

// T9. Stale OSINT label (>180 days) — must produce a limitation warning
func TestScorer_StaleOSINTLabel(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(10, "OldExchange", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 400),
			Path:        makePath(1, 5000),
			HopDistance: 1,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 5000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result")
	}
	c := results[0]
	// Score must be lower than a fresh label
	freshCandidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(11, "NewExchange", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 5),
			Path:        makePath(1, 5000),
			HopDistance: 1,
		},
	}
	freshResults := ScoreCandidates(freshCandidates, ScorerConfig{KnownStolenAmountUSD: 5000})
	if c.Confidence >= freshResults[0].Confidence {
		t.Errorf("T9: stale label (400 days) should score lower than fresh label (5 days). Stale=%.1f Fresh=%.1f",
			c.Confidence, freshResults[0].Confidence)
	}
	// Must warn investigator
	hasStaleWarning := false
	for _, l := range c.Limitations {
		if strings.Contains(l, "verify before use in legal proceedings") {
			hasStaleWarning = true
		}
	}
	if !hasStaleWarning {
		t.Errorf("T9: stale label must produce limitation warning")
	}
}

// T10. Bridge endpoint — must be excluded from ranked candidates
// (bridges are handled in bfs.go FoundBridges, not passed to ScoreCandidates)
func TestScorer_BridgeEndpoint(t *testing.T) {
	// Bridge raw candidates should never be passed to ScoreCandidates.
	// This test verifies that if no candidates are passed, nil is returned.
	results := ScoreCandidates(nil, ScorerConfig{})
	if results != nil {
		t.Errorf("T10: nil candidates should return nil, not empty slice")
	}
}

// T11. Mixer endpoint — should return Weak (entity_associated, mixer type)
func TestScorer_MixerEndpoint(t *testing.T) {
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(20, "Tornado Cash", "mixer", "service_wallet", "OFAC", "regulatory", 1.0, 1),
			Path:        makePath(1, 5000),
			HopDistance: 1,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 5000})
	if len(results) != 1 {
		t.Fatalf("expected 1 result")
	}
	c := results[0]
	if c.EntityType != "mixer" {
		t.Errorf("T11: mixer entity_type must be preserved, got %s", c.EntityType)
	}
	// OFAC + service_wallet + 1 hop → expect Strong or higher
	if c.Confidence < 50 {
		t.Errorf("T11: OFAC-sourced mixer at 1 hop should be ≥50, got %.1f", c.Confidence)
	}
}

// T12. No candidates (unknown endpoint) — must return nil
func TestScorer_NoCandidate(t *testing.T) {
	results := ScoreCandidates([]RawCandidate{}, ScorerConfig{})
	if len(results) != 0 {
		t.Errorf("T12: empty candidates should produce empty results, got %d", len(results))
	}
}

// T13. Correlated evidence — two paths from the SAME source must not double-count confidence
func TestScorer_CorrelatedEvidenceNoDuplication(t *testing.T) {
	// Two addresses for the same entity, both from the same OSINT source
	candidates := []RawCandidate{
		{
			EntityAddr:  makeEntityAddr(30, "SameSourceExchange", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10),
			Path:        makePath(1, 5000),
			HopDistance: 1,
		},
		{
			EntityAddr:  makeEntityAddr(30, "SameSourceExchange", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10),
			Path:        makePath(1, 4500),
			HopDistance: 1,
		},
	}
	results := ScoreCandidates(candidates, ScorerConfig{KnownStolenAmountUSD: 10000})
	if len(results) != 1 {
		t.Fatalf("T13: correlated evidence must produce exactly 1 deduplicated candidate")
	}
	// Single-candidate confidence should be same as primary path alone (no inflation)
	singleCandidate := []RawCandidate{candidates[0]}
	singleResult := ScoreCandidates(singleCandidate, ScorerConfig{KnownStolenAmountUSD: 10000})
	if math.Abs(results[0].Confidence-singleResult[0].Confidence) > 0.1 {
		t.Errorf("T13: correlated evidence must not inflate confidence. "+
			"Combined=%.1f, Single=%.1f", results[0].Confidence, singleResult[0].Confidence)
	}
}

// T14. Value continuity calculation: case_amount vs first_hop_value methodology
func TestScorer_ValueContinuityMethodology(t *testing.T) {
	path := makePath(2, 500)

	// With known stolen amount
	r1 := ScoreCandidates([]RawCandidate{
		{EntityAddr: makeEntityAddr(1, "A", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10), Path: path},
	}, ScorerConfig{KnownStolenAmountUSD: 10000})

	// Without known stolen amount (uses first hop)
	r2 := ScoreCandidates([]RawCandidate{
		{EntityAddr: makeEntityAddr(1, "A", "exchange", "hot_wallet", "OSINT", "osint", 0.90, 10), Path: path},
	}, ScorerConfig{})

	if len(r1) == 0 || len(r2) == 0 {
		t.Fatal("T14: expected results from both configurations")
	}
	if r1[0].PrimaryEvidence.PathMetrics.ContinuityMethodology != "case_amount" {
		t.Errorf("T14: known stolen amount must set methodology=case_amount")
	}
	if r2[0].PrimaryEvidence.PathMetrics.ContinuityMethodology != "first_hop_value" {
		t.Errorf("T14: unknown stolen amount must set methodology=first_hop_value")
	}
}

// ── Helper: verify confidence band thresholds ─────────────────────────────────
func TestConfidenceLevelBands(t *testing.T) {
	cases := []struct {
		score    float64
		expected string
	}{
		{95.0, "Very Strong"},
		{90.0, "Very Strong"},
		{89.9, "Strong"},
		{75.0, "Strong"},
		{74.9, "Moderate"},
		{50.0, "Moderate"},
		{49.9, "Weak"},
		{0.0, "Weak"},
	}
	for _, tc := range cases {
		got := confidenceLevel(tc.score)
		if got != tc.expected {
			t.Errorf("confidenceLevel(%.1f) = %s, want %s", tc.score, got, tc.expected)
		}
	}
}

// ── Helper: path decay is monotonically decreasing with hop count ─────────────
func TestPathDecayMonotonicity(t *testing.T) {
	continuity := 100.0
	prev := pathDecayMultiplier(1, continuity)
	for hops := 2; hops <= 15; hops++ {
		curr := pathDecayMultiplier(hops, continuity)
		if curr >= prev {
			t.Errorf("pathDecayMultiplier must decrease with hops. hop=%d: curr=%.4f prev=%.4f", hops, curr, prev)
		}
		prev = curr
	}
}

// ── Helper: address type weights are correct and ordered ────────────────────────
func TestAddressTypeWeightOrdering(t *testing.T) {
	types := []string{
		"deposit_address",
		"hot_wallet",
		"cold_wallet",
		"exchange_controlled",
		"service_wallet",
		"entity_associated",
		"cluster_associated",
		"unknown",
	}
	prev := 2.0
	for _, at := range types {
		w := addressTypeWeight(at)
		if w >= prev {
			t.Errorf("addressTypeWeight ordering violated at %s: %.2f >= %.2f", at, w, prev)
		}
		prev = w
	}
}
