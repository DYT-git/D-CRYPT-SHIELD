package sahyog

import (
	"testing"
	"vasp-engine/internal/models"
)

func TestTransformToDisclosure(t *testing.T) {
	// Test 1: Complete case -> correct disclosure payload
	caseData := &models.CaseResult{
		CaseID:         "TEST-123",
		SuspectAddress: "0xabc",
		Chain:          "ethereum",
		ReportHash:     "hash123",
		RankedCandidates: []models.AttributionCandidate{
			{
				EntityName: "Binance",
				Confidence: 99.9,
				PrimaryEvidence: models.AttributionEvidence{
					Explanation: "Direct deposit",
					Path: []models.TraceHop{
						{TxHash: "tx1"},
						{TxHash: "tx2", CrossChain: &models.CrossChainEvidence{DestTxHash: "tx3"}},
					},
				},
			},
			{
				EntityName: "Kraken", // Primary should be selected
				Confidence: 80.0,
			},
		},
	}

	req, err := TransformToDisclosure(caseData)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if req.CaseReference != "TEST-123" {
		t.Errorf("Expected TEST-123, got %s", req.CaseReference)
	}
	if req.IdentifiedVASP != "Binance" {
		t.Errorf("Expected Binance, got %s", req.IdentifiedVASP)
	}
	if req.AttributionConfidence != 99.9 {
		t.Errorf("Expected 99.9, got %f", req.AttributionConfidence)
	}
	if len(req.RelevantTxHashes) != 3 || req.RelevantTxHashes[2] != "tx3" {
		t.Errorf("Expected 3 tx hashes including cross-chain, got %v", req.RelevantTxHashes)
	}

	// Test 2: Missing attribution -> safe error
	caseDataNoAttr := &models.CaseResult{
		CaseID: "TEST-456",
	}
	_, err = TransformToDisclosure(caseDataNoAttr)
	if err == nil {
		t.Error("Expected error for missing attribution")
	}
}

func TestTransformToFreeze(t *testing.T) {
	// Test 3: Complete case -> correct freeze payload
	caseData := &models.CaseResult{
		CaseID:         "TEST-123",
		SuspectAddress: "0xabc",
		Chain:          "ethereum",
		ReportHash:     "hash123",
		RankedCandidates: []models.AttributionCandidate{
			{
				EntityName: "Binance",
				PrimaryEvidence: models.AttributionEvidence{
					PathMetrics: models.PathMetrics{
						ValueAtCandidate: 5000.0,
					},
					Path: []models.TraceHop{
						{TxHash: "tx1", TokenSymbol: "USDT"},
					},
				},
			},
		},
	}

	req, err := TransformToFreeze(caseData)
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}

	if req.TargetVASP != "Binance" {
		t.Errorf("Expected Binance, got %s", req.TargetVASP)
	}
	if req.EstimatedValue != 5000.0 {
		t.Errorf("Expected 5000.0, got %f", req.EstimatedValue)
	}
	if req.AssetSymbol != "USDT" {
		t.Errorf("Expected USDT, got %s", req.AssetSymbol)
	}
}
