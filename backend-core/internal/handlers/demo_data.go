package handlers

import (
	"time"
	"vasp-engine/internal/models"
)

var DemoCases = map[string]string{
	"0x098B716B8Aaf215190988513afF39BA65EdAB176": "demo-mixer", // Ronin Hacker
	"0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8": "demo-scam-vasp", // Phishing scammer
	"0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1": "demo-normal", // Normal defi whale
	"0x71660c4005BA85c37ccec55d0C4493E66Fe775d3": "demo-safe-vasp",
	"0x4b7f877d9c12563f456cbbcf82b8ef79c6d16cc1": "demo-tx-hash",
}

func getDemoCase(demoType, caseID, suspectAddress string) *models.CaseResult {
	now := time.Now().UTC()
	risk := 88.0
	conf := 92.5
	if demoType == "demo-normal" || demoType == "demo-safe-vasp" {
		risk = 15.0
		conf = 98.0
	} else if demoType == "demo-mixer" {
		risk = 99.9
		conf = 99.0
	}
	
	return &models.CaseResult{
		CaseID:         caseID,
		SuspectAddress: suspectAddress,
		Chain:          "ethereum",
		Status:         "completed",
		HopsTraced:     4,
		Confidence:     conf,
		RiskScore:      risk,
		SubmittedBy:    "demo-user",
		CreatedAt:      now.Add(-5 * time.Minute).Format(time.RFC3339),
		Path: []models.TraceHop{
			{HopNumber: 1, FromAddress: suspectAddress, ToAddress: "0xIntermediary1", Amount: 1500.5, TokenSymbol: "ETH", Timestamp: now.Add(-4 * time.Minute)},
			{HopNumber: 2, FromAddress: "0xIntermediary1", ToAddress: "0xIntermediary2", Amount: 1500.0, TokenSymbol: "ETH", Timestamp: now.Add(-3 * time.Minute)},
			{HopNumber: 3, FromAddress: "0xIntermediary2", ToAddress: "0xEndpoint", Amount: 1499.0, TokenSymbol: "ETH", EntityName: "Endpoint", IsVASP: true, Timestamp: now.Add(-2 * time.Minute)},
		},
	}
}

func getDemoGraph(demoType, caseID, suspectAddress string) map[string]interface{} {
	nodes := []map[string]interface{}{
		{"address": suspectAddress, "name": "SUSPECT ORIGIN", "is_vasp": false},
		{"address": "0xHop1_A", "name": "Layer 1 - A", "is_vasp": false},
		{"address": "0xHop1_B", "name": "Layer 1 - B", "is_vasp": false},
		{"address": "0xHop1_C", "name": "Layer 1 - C", "is_vasp": false},
		{"address": "0xHop2_Consolidator", "name": "Consolidation Wallet", "is_vasp": false},
		{"address": "0xEndpoint1", "name": "Endpoint 1", "is_vasp": true},
		{"address": "0xEndpoint2", "name": "Endpoint 2", "is_vasp": true},
	}
	
	edges := []map[string]interface{}{
		{"from_address": suspectAddress, "to_address": "0xHop1_A", "amount": 500, "token": "ETH"},
		{"from_address": suspectAddress, "to_address": "0xHop1_B", "amount": 600, "token": "ETH"},
		{"from_address": suspectAddress, "to_address": "0xHop1_C", "amount": 400, "token": "ETH"},
		{"from_address": "0xHop1_A", "to_address": "0xHop2_Consolidator", "amount": 499, "token": "ETH"},
		{"from_address": "0xHop1_B", "to_address": "0xHop2_Consolidator", "amount": 599, "token": "ETH"},
		{"from_address": "0xHop1_C", "to_address": "0xHop2_Consolidator", "amount": 399, "token": "ETH"},
		{"from_address": "0xHop2_Consolidator", "to_address": "0xEndpoint1", "amount": 1000, "token": "ETH"},
		{"from_address": "0xHop2_Consolidator", "to_address": "0xEndpoint2", "amount": 497, "token": "ETH"},
	}
	
	if demoType == "demo-normal" {
		nodes[5]["name"] = "Aave V3 Pool"
		nodes[5]["type"] = "DeFi"
		nodes[6]["name"] = "Uniswap Router"
		nodes[6]["type"] = "DeFi"
	} else if demoType == "demo-safe-vasp" {
		nodes[5]["name"] = "Coinbase Wallet"
		nodes[5]["type"] = "VASP"
		nodes[6]["name"] = "Kraken Deposit"
		nodes[6]["type"] = "VASP"
	} else if demoType == "demo-mixer" {
		nodes[5]["name"] = "Tornado Cash (Mixer)"
		nodes[5]["type"] = "Mixer"
		nodes[6]["name"] = "eTornado Router"
		nodes[6]["type"] = "Mixer"
	} else {
		nodes[5]["name"] = "Binance Deposit"
		nodes[5]["type"] = "VASP"
		nodes[6]["name"] = "Huobi Hot Wallet"
		nodes[6]["type"] = "VASP"
	}
	
	return map[string]interface{}{
		"nodes": nodes,
		"edges": edges,
	}
}

func getDemoIntelligence(demoType, caseID string) map[string]interface{} {
	if demoType == "demo-normal" {
		return map[string]interface{}{
			"overall_risk_score": 15.0,
			"risk_level":         "LOW",
			"risk_contributors": map[string]float64{"High Volume Activity": 15.0},
			"major_findings": []string{"Normal DeFi interactions detected.", "Funds deployed into Aave V3 lending pool.", "No suspicious hops."},
			"typologies": []map[string]interface{}{{"name": "DeFi_Yield_Farming", "confidence": 0.98, "description": "Typical decentralized finance behavior.", "transaction_hashes": []string{"0xdefi1"}}},
		}
	} else if demoType == "demo-mixer" {
		return map[string]interface{}{
			"overall_risk_score": 99.9,
			"risk_level":         "CRITICAL",
			"risk_contributors": map[string]float64{"Mixer Interaction": 60.5, "Peel Chain Pattern": 25.0, "Structuring": 14.4},
			"major_findings": []string{"Funds systematically split into 3 paths immediately after theft.", "1000 ETH successfully obfuscated through Tornado Cash mixer."},
			"typologies": []map[string]interface{}{{"name": "Mixer_Obfuscation", "confidence": 0.99, "description": "Direct interaction with a known decentralized mixing service (Tornado Cash).", "transaction_hashes": []string{"0xmix123"}}},
		}
	} else if demoType == "demo-safe-vasp" {
		return map[string]interface{}{
			"overall_risk_score": 22.0,
			"risk_level":         "LOW",
			"risk_contributors": map[string]float64{"Large Exchange Transfer": 22.0},
			"major_findings": []string{"User consolidated funds before sending to centralized exchanges.", "Deposited heavily into Coinbase and Kraken for liquidation."},
			"typologies": []map[string]interface{}{{"name": "CEX_Liquidation", "confidence": 0.85, "description": "Standard deposit to Centralized Exchanges.", "transaction_hashes": []string{"0xcex123"}}},
		}
	}
	
	// Default (scammer to VASP)
	return map[string]interface{}{
		"overall_risk_score": 88.5,
		"risk_level":         "HIGH",
		"risk_contributors": map[string]float64{"Fast Turnover": 40.0, "Structuring (Smurfing)": 35.5, "Known Phishing Wallet": 13.0},
		"major_findings": []string{"Rapid consolidation observed at Layer 2 within 4 minutes.", "Remaining funds parked in Binance deposit address (freeze recommended)."},
		"typologies": []map[string]interface{}{{"name": "Peel_Chain_Evasion", "confidence": 0.94, "description": "Systematic siphoning of a large balance through smaller incremental transfers.", "transaction_hashes": []string{"0xabc123"}}},
	}
}

