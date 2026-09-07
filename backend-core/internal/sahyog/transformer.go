package sahyog

import (
	"errors"
	"vasp-engine/internal/models"
)

// TransformToDisclosure converts a core CaseResult into a NormalizedDisclosureRequest
func TransformToDisclosure(caseData *models.CaseResult) (*models.NormalizedDisclosureRequest, error) {
	if caseData == nil {
		return nil, errors.New("incomplete case data")
	}
	if len(caseData.RankedCandidates) == 0 {
		return nil, errors.New("no ranked VASP candidate found")
	}

	primary := caseData.RankedCandidates[0]

	req := &models.NormalizedDisclosureRequest{
		CaseReference:         caseData.CaseID,
		SuspectWallet:         caseData.SuspectAddress,
		Chain:                 caseData.Chain,
		IdentifiedVASP:        primary.EntityName,
		AttributionConfidence: primary.Confidence,
		ReportHash:            caseData.ReportHash, // Missing report hash handled safely (just empty string)
		PrimaryEvidence:       primary.PrimaryEvidence.Explanation,
	}

	var txs []string
	for _, hop := range primary.PrimaryEvidence.Path {
		if hop.TxHash != "" {
			txs = append(txs, hop.TxHash)
		}
		if hop.CrossChain != nil && hop.CrossChain.DestTxHash != "" {
			txs = append(txs, hop.CrossChain.DestTxHash)
		}
	}
	req.RelevantTxHashes = txs

	return req, nil
}

// TransformToFreeze converts a core CaseResult into a NormalizedFreezeRequest
func TransformToFreeze(caseData *models.CaseResult) (*models.NormalizedFreezeRequest, error) {
	if caseData == nil {
		return nil, errors.New("incomplete case data")
	}
	if len(caseData.RankedCandidates) == 0 {
		return nil, errors.New("no ranked VASP candidate found")
	}

	primary := caseData.RankedCandidates[0]

	req := &models.NormalizedFreezeRequest{
		CaseReference:  caseData.CaseID,
		TargetVASP:     primary.EntityName,
		SuspectWallet:  caseData.SuspectAddress,
		ReportHash:     caseData.ReportHash,
		EstimatedValue: primary.PrimaryEvidence.PathMetrics.ValueAtCandidate,
	}

	var txs []string
	var lastAsset string
	for _, hop := range primary.PrimaryEvidence.Path {
		if hop.TxHash != "" {
			txs = append(txs, hop.TxHash)
		}
		if hop.CrossChain != nil && hop.CrossChain.DestTxHash != "" {
			txs = append(txs, hop.CrossChain.DestTxHash)
		}
		
		if hop.TokenSymbol != "" {
			lastAsset = hop.TokenSymbol
		} else if hop.AssetIdentifier != "" {
			lastAsset = hop.AssetIdentifier
		}
	}
	
	// If ValueAtCandidate is missing, try last hop amount
	if req.EstimatedValue == 0 && len(primary.PrimaryEvidence.Path) > 0 {
		req.EstimatedValue = primary.PrimaryEvidence.Path[len(primary.PrimaryEvidence.Path)-1].Amount
	}

	req.RelevantTxHashes = txs
	
	// Fallback for missing asset
	if lastAsset == "" {
		lastAsset = caseData.Chain
	}
	req.AssetSymbol = lastAsset

	return req, nil
}
