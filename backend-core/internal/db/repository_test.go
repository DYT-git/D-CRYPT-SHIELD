package db

import (
	"encoding/json"
	"testing"
	"time"

	"vasp-engine/internal/models"
)

// TestAttributionSerialization tests that RankedCandidates can be serialized
// and deserialized without losing any of the complex nested fields from Phase 4.
func TestAttributionSerialization(t *testing.T) {
	// 1. Create a dummy AttributionCandidate with full nested data
	original := []models.AttributionCandidate{
		{
			EntityID:        123,
			EntityName:      "Test Exchange",
			EntityType:      "exchange",
			Confidence:      95.5,
			ConfidenceLevel: "Very Strong",
			AttributionType: "Direct Deposit",
			PrimaryEvidence: models.AttributionEvidence{
				MatchType:      "entity_lookup",
				MatchedAddress: "0x123",
				AddressType:    "deposit_address",
				Source: models.SourceProvenance{
					Name:          "OSINT",
					SourceType:    "osint",
					Reliability:   0.9,
					LastVerified:  time.Now().Truncate(time.Second), // Truncate to second for JSON roundtrip
					FreshnessDays: 10,
					IsStale:       false,
				},
				Path: []models.TraceHop{
					{
						HopNumber:       1,
						FromAddress:     "0xabc",
						ToAddress:       "0x123",
						TxHash:          "0xtx",
						Amount:          100.0,
						TokenSymbol:     "ETH",
						AssetIdentifier: "native",
					},
				},
				PathMetrics: models.PathMetrics{
					HopDistance:           1,
					ValueAtCandidate:      100.0,
					InitialTracedValue:    100.0,
					ValueContinuityPct:    100.0,
					ContinuityMethodology: "first_hop_value",
					TemporalSpanHours:     0,
					TimestampsMonotonic:   true,
				},
				AddressTypeWeight:   1.0,
				SourceWeight:        0.9,
				PathDecayMultiplier: 1.0,
				Explanation:         "Test explanation",
			},
			SupportingPaths: []models.AttributionEvidence{},
			Limitations:     []string{"Test limitation"},
		},
	}

	// 2. Marshal to JSON (simulate what UpdateCaseResult does)
	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal: %v", err)
	}

	// 3. Unmarshal back to a new slice (simulate what GetCase does)
	var restored []models.AttributionCandidate
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Failed to unmarshal: %v", err)
	}

	// 4. Verify the data survives
	if len(restored) != 1 {
		t.Fatalf("Expected 1 candidate, got %d", len(restored))
	}
	c := restored[0]
	if c.EntityName != "Test Exchange" {
		t.Errorf("Expected EntityName 'Test Exchange', got '%s'", c.EntityName)
	}
	if c.PrimaryEvidence.Source.Name != "OSINT" {
		t.Errorf("Expected Source Name 'OSINT', got '%s'", c.PrimaryEvidence.Source.Name)
	}
	if len(c.PrimaryEvidence.Path) != 1 {
		t.Fatalf("Expected 1 hop in path, got %d", len(c.PrimaryEvidence.Path))
	}
	if c.PrimaryEvidence.Path[0].Amount != 100.0 {
		t.Errorf("Expected path amount 100.0, got %f", c.PrimaryEvidence.Path[0].Amount)
	}
	if c.PrimaryEvidence.PathMetrics.ContinuityMethodology != "first_hop_value" {
		t.Errorf("Expected continuity methodology 'first_hop_value', got '%s'", c.PrimaryEvidence.PathMetrics.ContinuityMethodology)
	}
	if len(c.Limitations) != 1 || c.Limitations[0] != "Test limitation" {
		t.Errorf("Expected Limitations ['Test limitation'], got %v", c.Limitations)
	}
}

// TestNilSerialization ensures that when rankedCandidates is nil,
// it handles it gracefully (which happens when BFS finds no VASPs).
func TestNilSerialization(t *testing.T) {
	var original []models.AttributionCandidate = nil
	data, err := json.Marshal(original)
	if err != nil {
		t.Fatalf("Failed to marshal nil slice: %v", err)
	}
	if string(data) != "null" {
		t.Errorf("Expected 'null' JSON for nil slice, got '%s'", string(data))
	}

	var restored []models.AttributionCandidate
	if err := json.Unmarshal(data, &restored); err != nil {
		t.Fatalf("Failed to unmarshal 'null': %v", err)
	}
	if restored != nil {
		t.Errorf("Expected restored slice to be nil, got %v", restored)
	}
}
