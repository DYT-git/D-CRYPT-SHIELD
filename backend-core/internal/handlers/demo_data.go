package handlers

import (
	"time"
	"vasp-engine/internal/models"
)

var DemoCases = map[string]string{
	"0x742d35Cc6634C0532925a3b844Bc454e4438f44e": "demo-coindcx-vasp", // Cyber Extortion / Phishing to Indian VASP
	"0x098B716B8Aaf215190988513afF39BA65EdAB176": "demo-mixer",        // Ronin Heist to Tornado Cash
	"0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8": "demo-p2p-binance", // Telegram UPI Task Scam to Binance
	"0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1": "demo-normal",      // Safe DeFi Whale Benchmark
	"0x71660c4005BA85c37ccec55d0C4493E66Fe775d3": "demo-safe-vasp",   // Exchange Verification Benchmark
	"0xccea73a0d4b5eaa5125ce656f471abf065901fda": "demo-coindcx-vasp", // Ransomware Transfer TxHash suspect
	"0x892aF0E2A1C3b7C2E4C4B53D89b3F8D3A7B9C1E2": "demo-mixer",        // Generic fallback TxHash suspect
}

func getDemoCase(demoType, caseID, suspectAddress string) *models.CaseResult {
	now := time.Now().UTC()

	switch demoType {
	case "demo-coindcx-vasp":
		return &models.CaseResult{
			CaseID:         caseID,
			SuspectAddress: suspectAddress,
			Chain:          "ethereum",
			Status:         "completed",
			HopsTraced:     4,
			Confidence:     99.4,
			RiskScore:      89.2,
			SubmittedBy:    "Inspector Sharma (Cyber Cell I4C)",
			CreatedAt:      now.Add(-25 * time.Minute).Format(time.RFC3339),
			CompletedAt:    now.Add(-2 * time.Minute).Format(time.RFC3339),
			ReportHash:     "3a8f9c1b7e4d2a6f8b0e1d3c5a7f9b2d4e6a8c0f1b3d5e7a9c2b4d6e8f0a1b2c",
			FoundVASP: &models.VASPHit{
				Address:    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
				Chain:      "ethereum",
				VASPName:   "CoinDCX (Neblio Technologies Pvt Ltd)",
				VASPType:   "exchange",
				Confidence: 99.4,
				RiskLevel:  "high",
				Source:     "FIU-IND Registration Registry (Reg #FIU-IND/CAS/2023/0014)",
			},
			RankedCandidates: []models.AttributionCandidate{
				{
					EntityID:        1001,
					EntityName:      "CoinDCX India",
					EntityType:      "VASP / Centralized Exchange",
					Confidence:      99.4,
					ConfidenceLevel: "Very Strong",
					AttributionType: "Direct KYC Gateway Deposit",
					PrimaryEvidence: models.AttributionEvidence{
						MatchType:      "deposit_address",
						MatchedAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
						AddressType:    "deposit_address",
						Source: models.SourceProvenance{
							Name:         "FIU-IND VASP Registry",
							SourceType:   "regulatory",
							Reliability:  1.0,
							LastVerified: now,
						},
						PathMetrics: models.PathMetrics{
							HopDistance:           4,
							ValueAtCandidate:      48375.20,
							InitialTracedValue:    48450.00,
							ValueContinuityPct:     99.8,
							ContinuityMethodology: "case_amount",
							TemporalSpanHours:     0.32,
							TimestampsMonotonic:   true,
						},
						Explanation: "14.2280 ETH deposited into CoinDCX hot gateway after 3 peeling mule hops within 18 minutes. Fully attributed to Indian VASP.",
					},
					Limitations: []string{
						"Beneficiary account KYC requires Section 91 CrPC notice to Nodal Officer (nodal.officer@coindcx.com)",
					},
				},
			},
			Path: []models.TraceHop{
				{
					HopNumber:   1,
					FromAddress: suspectAddress,
					ToAddress:   "0x388C818CA8B9251b393131C08a73683246A16633",
					TxHash:      "0x4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
					Amount:      14.2500,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-18 * time.Minute),
					EntityName:  "Layer 1 Mule (Transit Aggregator)",
					IsVASP:      false,
				},
				{
					HopNumber:   2,
					FromAddress: "0x388C818CA8B9251b393131C08a73683246A16633",
					ToAddress:   "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
					TxHash:      "0x8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f",
					Amount:      14.2420,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-13 * time.Minute),
					EntityName:  "Layer 2 Mule (Peel Chain Collector)",
					IsVASP:      false,
				},
				{
					HopNumber:   3,
					FromAddress: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5",
					ToAddress:   "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
					TxHash:      "0x1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e",
					Amount:      14.2350,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-7 * time.Minute),
					EntityName:  "Pre-CEX Consolidation Node",
					IsVASP:      false,
				},
				{
					HopNumber:   4,
					FromAddress: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97",
					ToAddress:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
					TxHash:      "0x6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
					Amount:      14.2280,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-3 * time.Minute),
					EntityName:  "CoinDCX (Neblio Technologies Pvt Ltd)",
					IsVASP:      true,
				},
			},
		}

	case "demo-mixer":
		return &models.CaseResult{
			CaseID:         caseID,
			SuspectAddress: suspectAddress,
			Chain:          "ethereum",
			Status:         "completed",
			HopsTraced:     4,
			Confidence:     99.8,
			RiskScore:      99.8,
			SubmittedBy:    "CERT-In Cyber Forensics",
			CreatedAt:      now.Add(-40 * time.Minute).Format(time.RFC3339),
			CompletedAt:    now.Add(-5 * time.Minute).Format(time.RFC3339),
			ReportHash:     "7f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b",
			FoundVASP: &models.VASPHit{
				Address:    "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
				Chain:      "ethereum",
				VASPName:   "Tornado Cash (0.1 ETH Vault)",
				VASPType:   "mixer",
				Confidence: 99.8,
				RiskLevel:  "critical",
				Source:     "OFAC SDN Sanctions List & Smart Contract Tag",
			},
			Path: []models.TraceHop{
				{
					HopNumber:   1,
					FromAddress: suspectAddress,
					ToAddress:   "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					TxHash:      "0x3f5c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a",
					Amount:      100.0,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-35 * time.Minute),
					EntityName:  "Heist Staging Relay",
					IsVASP:      false,
				},
				{
					HopNumber:   2,
					FromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
					ToAddress:   "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
					TxHash:      "0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
					Amount:      100.0,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-28 * time.Minute),
					EntityName:  "Tornado Cash (0.1 ETH Vault - OFAC Sanctioned)",
					IsVASP:      true,
				},
				{
					HopNumber:   3,
					FromAddress: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
					ToAddress:   "0x220866B1A2219f40e72f5c628B65D54268cA3A9D",
					TxHash:      "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b",
					Amount:      99.85,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-15 * time.Minute),
					EntityName:  "Railgun Privacy Proxy Relayer",
					IsVASP:      false,
				},
				{
					HopNumber:   4,
					FromAddress: "0x220866B1A2219f40e72f5c628B65D54268cA3A9D",
					ToAddress:   "0xaf30162fb46241477dd5c33a9ec1a49db23c5fb3",
					TxHash:      "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
					Amount:      99.70,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-6 * time.Minute),
					EntityName:  "Stargate Bridge (Cross-Chain Transit to Tron)",
					IsVASP:      true,
				},
			},
		}

	case "demo-p2p-binance":
		return &models.CaseResult{
			CaseID:         caseID,
			SuspectAddress: suspectAddress,
			Chain:          "ethereum",
			Status:         "completed",
			HopsTraced:     3,
			Confidence:     98.6,
			RiskScore:      91.5,
			SubmittedBy:    "Special Task Force (STF Cyber)",
			CreatedAt:      now.Add(-30 * time.Minute).Format(time.RFC3339),
			CompletedAt:    now.Add(-4 * time.Minute).Format(time.RFC3339),
			ReportHash:     "9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d",
			FoundVASP: &models.VASPHit{
				Address:    "0x28C6c06298d514Db089934071355E5743bf21d60",
				Chain:      "ethereum",
				VASPName:   "Binance Hot Wallet 14",
				VASPType:   "exchange",
				Confidence: 98.6,
				RiskLevel:  "high",
				Source:     "FIU-IND VASP Circular #FIU-IND/CAS/2024/0089",
			},
			Path: []models.TraceHop{
				{
					HopNumber:   1,
					FromAddress: suspectAddress,
					ToAddress:   "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
					TxHash:      "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d",
					Amount:      45000.0,
					TokenSymbol: "USDT",
					Timestamp:   now.Add(-22 * time.Minute),
					EntityName:  "Binance P2P Merchant Escrow",
					IsVASP:      false,
				},
				{
					HopNumber:   2,
					FromAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8",
					ToAddress:   "0xF977814e90dA44bFA03b6295A0616a897441aceC",
					TxHash:      "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d",
					Amount:      44950.0,
					TokenSymbol: "USDT",
					Timestamp:   now.Add(-14 * time.Minute),
					EntityName:  "P2P Rapid Transit Mule",
					IsVASP:      false,
				},
				{
					HopNumber:   3,
					FromAddress: "0xF977814e90dA44bFA03b6295A0616a897441aceC",
					ToAddress:   "0x28C6c06298d514Db089934071355E5743bf21d60",
					TxHash:      "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f",
					Amount:      44910.0,
					TokenSymbol: "USDT",
					Timestamp:   now.Add(-5 * time.Minute),
					EntityName:  "Binance Hot Wallet 14 (FIU-IND Registered)",
					IsVASP:      true,
				},
			},
		}

	case "demo-normal":
		return &models.CaseResult{
			CaseID:         caseID,
			SuspectAddress: suspectAddress,
			Chain:          "ethereum",
			Status:         "completed",
			HopsTraced:     2,
			Confidence:     98.0,
			RiskScore:      12.0,
			SubmittedBy:    "Compliance Analyst",
			CreatedAt:      now.Add(-50 * time.Minute).Format(time.RFC3339),
			CompletedAt:    now.Add(-10 * time.Minute).Format(time.RFC3339),
			FoundVASP: &models.VASPHit{
				Address:    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
				Chain:      "ethereum",
				VASPName:   "Aave V3 Lending Pool",
				VASPType:   "defi",
				Confidence: 98.0,
				RiskLevel:  "low",
				Source:     "On-Chain Protocol Contract",
			},
			Path: []models.TraceHop{
				{
					HopNumber:   1,
					FromAddress: suspectAddress,
					ToAddress:   "0xE592427A0AEce92De3Edee1F18E0157C05861564",
					TxHash:      "0x1111111111111111111111111111111111111111111111111111111111111111",
					Amount:      50.0,
					TokenSymbol: "ETH",
					Timestamp:   now.Add(-45 * time.Minute),
					EntityName:  "Uniswap V3 Swap Router",
					IsVASP:      false,
				},
				{
					HopNumber:   2,
					FromAddress: "0xE592427A0AEce92De3Edee1F18E0157C05861564",
					ToAddress:   "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
					TxHash:      "0x2222222222222222222222222222222222222222222222222222222222222222",
					Amount:      170000.0,
					TokenSymbol: "USDC",
					Timestamp:   now.Add(-30 * time.Minute),
					EntityName:  "Aave V3 Lending Pool",
					IsVASP:      true,
				},
			},
		}

	default:
		return &models.CaseResult{
			CaseID:         caseID,
			SuspectAddress: suspectAddress,
			Chain:          "ethereum",
			Status:         "completed",
			HopsTraced:     1,
			Confidence:     98.0,
			RiskScore:      22.0,
			SubmittedBy:    "Compliance Analyst",
			CreatedAt:      now.Add(-10 * time.Minute).Format(time.RFC3339),
			CompletedAt:    now.Add(-1 * time.Minute).Format(time.RFC3339),
			FoundVASP: &models.VASPHit{
				Address:    "0x28C6c06298d514Db089934071355E5743bf21d60",
				Chain:      "ethereum",
				VASPName:   "Binance",
				VASPType:   "exchange",
				Confidence: 98.0,
				RiskLevel:  "low",
			},
		}
	}
}

func getDemoGraph(demoType, caseID, suspectAddress string) map[string]interface{} {
	switch demoType {
	case "demo-coindcx-vasp":
		nodes := []map[string]interface{}{
			{"address": suspectAddress, "name": "SUSPECT ORIGIN", "label": "0x742d…44e (Suspect)", "type": "suspect", "is_vasp": false, "risk_level": "critical"},
			{"address": "0x388C818CA8B9251b393131C08a73683246A16633", "name": "Layer 1 - Mule Alpha", "label": "0x388C…633 (Mule A)", "type": "hub", "is_vasp": false, "risk_level": "high"},
			{"address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "name": "Layer 1 - Gas Sponsor", "label": "0x71C7…76F (Gas Relayer)", "type": "intermediary", "is_vasp": false, "risk_level": "medium"},
			{"address": "0x267be1C1D684F7404342345d1d6a362f6b8D6f78", "name": "Layer 1 - Micro Splitter", "label": "0x267b…f78 (Splitter)", "type": "intermediary", "is_vasp": false, "risk_level": "medium"},
			{"address": "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", "name": "Layer 2 - Peeling Hub", "label": "0x9522…fe5 (Peel Hub)", "type": "hub", "is_vasp": false, "risk_level": "high"},
			{"address": "0x514910771AF9Ca656af840dff83E8264EcF986CA", "name": "Layer 2 - Escrow Transit", "label": "0x5149…6CA (Transit)", "type": "intermediary", "is_vasp": false, "risk_level": "medium"},
			{"address": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", "name": "Pre-CEX Consolidation Node", "label": "0x4838…f97 (Aggregator)", "type": "hub", "is_vasp": false, "risk_level": "high"},
			{"address": "0x1111111254fb6c44bac0bed2854e76f90643097d", "name": "1inch Aggregator", "label": "1inch Swap Protocol", "type": "intermediary", "is_vasp": false, "risk_level": "low"},
			{"address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "name": "CoinDCX Deposit Gateway", "label": "CoinDCX India (FIU-IND)", "type": "vasp", "is_vasp": true, "risk_level": "resolved"},
			{"address": "0x28C6c06298d514Db089934071355E5743bf21d60", "name": "WazirX Binance Omnibus", "label": "WazirX / Binance Hub", "type": "vasp", "is_vasp": true, "risk_level": "resolved"},
		}

		edges := []map[string]interface{}{
			{"from_address": suspectAddress, "to_address": "0x388C818CA8B9251b393131C08a73683246A16633", "amount": 10.50, "token": "ETH", "tx_hash": "0x4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f"},
			{"from_address": suspectAddress, "to_address": "0x267be1C1D684F7404342345d1d6a362f6b8D6f78", "amount": 3.75, "token": "ETH", "tx_hash": "0x7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b"},
			{"from_address": "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", "to_address": "0x388C818CA8B9251b393131C08a73683246A16633", "amount": 0.15, "token": "ETH", "tx_hash": "0x9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a"},
			{"from_address": "0x388C818CA8B9251b393131C08a73683246A16633", "to_address": "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", "amount": 10.45, "token": "ETH", "tx_hash": "0x8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f"},
			{"from_address": "0x267be1C1D684F7404342345d1d6a362f6b8D6f78", "to_address": "0x514910771AF9Ca656af840dff83E8264EcF986CA", "amount": 3.72, "token": "ETH", "tx_hash": "0x3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c"},
			{"from_address": "0x514910771AF9Ca656af840dff83E8264EcF986CA", "to_address": "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", "amount": 3.70, "token": "ETH", "tx_hash": "0x2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d"},
			{"from_address": "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", "to_address": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", "amount": 14.12, "token": "ETH", "tx_hash": "0x1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e"},
			{"from_address": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", "to_address": "0x1111111254fb6c44bac0bed2854e76f90643097d", "amount": 2.00, "token": "ETH", "tx_hash": "0x5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a"},
			{"from_address": "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", "to_address": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "amount": 12.10, "token": "ETH", "tx_hash": "0x6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b"},
			{"from_address": "0x1111111254fb6c44bac0bed2854e76f90643097d", "to_address": "0x28C6c06298d514Db089934071355E5743bf21d60", "amount": 6800.0, "token": "USDT", "tx_hash": "0x8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a"},
		}
		return map[string]interface{}{"nodes": nodes, "edges": edges}

	case "demo-mixer":
		nodes := []map[string]interface{}{
			{"address": suspectAddress, "name": "Ronin Heist Suspect", "label": "0x098B…176 (Suspect)", "type": "suspect", "is_vasp": false, "risk_level": "critical"},
			{"address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "name": "Layer 1 Relay", "label": "0xd8dA…045 (Relay)", "type": "hub", "is_vasp": false, "risk_level": "critical"},
			{"address": "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", "name": "Tornado Cash (0.1 ETH Vault)", "label": "Tornado.Cash (OFAC)", "type": "vasp", "is_vasp": true, "risk_level": "critical"},
			{"address": "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", "name": "Tornado Cash (100 ETH Vault)", "label": "Tornado 100 ETH Pool", "type": "vasp", "is_vasp": true, "risk_level": "critical"},
			{"address": "0x220866B1A2219f40e72f5c628B65D54268cA3A9D", "name": "Railgun Privacy Proxy", "label": "Railgun Relayer", "type": "intermediary", "is_vasp": false, "risk_level": "high"},
			{"address": "0xaf30162fb46241477dd5c33a9ec1a49db23c5fb3", "name": "Stargate Bridge Router", "label": "Stargate Bridge (Tron Exit)", "type": "vasp", "is_vasp": true, "risk_level": "high"},
		}
		edges := []map[string]interface{}{
			{"from_address": suspectAddress, "to_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "amount": 100.0, "token": "ETH", "tx_hash": "0x3f5c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a"},
			{"from_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "to_address": "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", "amount": 50.0, "token": "ETH", "tx_hash": "0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"},
			{"from_address": "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", "to_address": "0x47CE0C6eD5B0Ce3d3A51fdb1C52DC66a7c3c2936", "amount": 50.0, "token": "ETH", "tx_hash": "0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e"},
			{"from_address": "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", "to_address": "0x220866B1A2219f40e72f5c628B65D54268cA3A9D", "amount": 49.85, "token": "ETH", "tx_hash": "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b"},
			{"from_address": "0x220866B1A2219f40e72f5c628B65D54268cA3A9D", "to_address": "0xaf30162fb46241477dd5c33a9ec1a49db23c5fb3", "amount": 49.70, "token": "ETH", "tx_hash": "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"},
		}
		return map[string]interface{}{"nodes": nodes, "edges": edges}

	case "demo-p2p-binance":
		nodes := []map[string]interface{}{
			{"address": suspectAddress, "name": "P2P Scam Suspect", "label": "0x8c7C…6c8 (Suspect)", "type": "suspect", "is_vasp": false, "risk_level": "high"},
			{"address": "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", "name": "P2P Merchant Escrow", "label": "0xBE0e…3E8 (Escrow)", "type": "hub", "is_vasp": false, "risk_level": "high"},
			{"address": "0xF977814e90dA44bFA03b6295A0616a897441aceC", "name": "Mule Transit Pass-Through", "label": "0xF977…ceC (Mule)", "type": "intermediary", "is_vasp": false, "risk_level": "high"},
			{"address": "0x28C6c06298d514Db089934071355E5743bf21d60", "name": "Binance Hot Wallet 14", "label": "Binance 14 (FIU-IND)", "type": "vasp", "is_vasp": true, "risk_level": "resolved"},
		}
		edges := []map[string]interface{}{
			{"from_address": suspectAddress, "to_address": "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", "amount": 45000.0, "token": "USDT", "tx_hash": "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d"},
			{"from_address": "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", "to_address": "0xF977814e90dA44bFA03b6295A0616a897441aceC", "amount": 44950.0, "token": "USDT", "tx_hash": "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d"},
			{"from_address": "0xF977814e90dA44bFA03b6295A0616a897441aceC", "to_address": "0x28C6c06298d514Db089934071355E5743bf21d60", "amount": 44910.0, "token": "USDT", "tx_hash": "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f"},
		}
		return map[string]interface{}{"nodes": nodes, "edges": edges}

	default:
		nodes := []map[string]interface{}{
			{"address": suspectAddress, "name": "DeFi Treasury Whale", "label": "0x5c43…6b1 (Whale)", "type": "suspect", "is_vasp": false, "risk_level": "low"},
			{"address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "name": "Uniswap V3 Router", "label": "Uniswap V3 Protocol", "type": "intermediary", "is_vasp": false, "risk_level": "low"},
			{"address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "name": "Aave V3 Lending Pool", "label": "Aave V3 Core Pool", "type": "vasp", "is_vasp": true, "risk_level": "low"},
		}
		edges := []map[string]interface{}{
			{"from_address": suspectAddress, "to_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "amount": 50.0, "token": "ETH", "tx_hash": "0x1111111111111111111111111111111111111111111111111111111111111111"},
			{"from_address": "0xE592427A0AEce92De3Edee1F18E0157C05861564", "to_address": "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", "amount": 170000.0, "token": "USDC", "tx_hash": "0x2222222222222222222222222222222222222222222222222222222222222222"},
		}
		return map[string]interface{}{"nodes": nodes, "edges": edges}
	}
}

func getDemoIntelligence(demoType, caseID string) map[string]interface{} {
	switch demoType {
	case "demo-coindcx-vasp":
		return map[string]interface{}{
			"overall_risk_score": 89.2,
			"risk_level":         "HIGH",
			"risk_contributors": map[string]float64{
				"Peel Chain Layering Velocity": 38.5,
				"Mule Structuring (Smurfing)": 27.0,
				"Immediate CEX Off-Ramp":       23.7,
			},
			"major_findings": []string{
				"Extortion proceeds of 14.25 ETH (approx. INR 32,80,000) structured across 3 mule hops within 18 minutes.",
				"Rapid transit profile identified: Zero holding time at intermediary wallets (funds forwarded within 300 seconds of receipt).",
				"Terminal hop terminates at CoinDCX KYC-bound gateway (Address: 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48).",
				"Statutory Action: Issue Section 91 CrPC notice to Nodal Officer (nodal.officer@coindcx.com) to freeze beneficiary account under Section 102 CrPC.",
			},
			"typologies": []map[string]interface{}{
				{
					"name":        "Peel_Chain_Structuring",
					"confidence":  0.962,
					"description": "Systematic division and forwarding of illicit funds through intermediate unhosted wallets to evade threshold monitoring.",
					"transaction_hashes": []string{
						"0x4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
						"0x8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f",
					},
				},
				{
					"name":        "Rapid_Transit_Mule_Network",
					"confidence":  0.938,
					"description": "High-velocity pass-through mule network with near-zero latency and automatic balance depletion.",
					"transaction_hashes": []string{
						"0x1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e",
					},
				},
				{
					"name":        "FIU_Registered_VASP_OffRamp",
					"confidence":  0.994,
					"description": "Direct deposit into FIU-IND registered entity CoinDCX for fiat off-ramping into Indian banking channels.",
					"transaction_hashes": []string{
						"0x6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b",
					},
				},
			},
		}

	case "demo-mixer":
		return map[string]interface{}{
			"overall_risk_score": 99.8,
			"risk_level":         "CRITICAL",
			"risk_contributors": map[string]float64{
				"Decentralized Mixer Interaction":      62.0,
				"OFAC Sanctioned Entity Connection":    25.0,
				"Cross-Chain Liquidity Bridge Evasion": 12.8,
			},
			"major_findings": []string{
				"Heist proceeds routed through Tornado Cash 0.1 ETH and 100 ETH mixer pools (OFAC Sanctioned).",
				"Relayer-assisted unlinked withdrawal through Railgun privacy proxy protocol.",
				"Cross-chain bridging attempted via Stargate to convert into Tron-based USDT.",
			},
			"typologies": []map[string]interface{}{
				{
					"name":        "Mixer_Obfuscation",
					"confidence":  0.999,
					"description": "Direct interaction with Tornado Cash mixing smart contracts.",
					"transaction_hashes": []string{
						"0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b",
						"0x4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e",
					},
				},
				{
					"name":        "Cross_Chain_Hopping",
					"confidence":  0.941,
					"description": "Layering across blockchain networks to sever deterministic forensic graph continuity.",
					"transaction_hashes": []string{
						"0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b",
					},
				},
			},
		}

	case "demo-p2p-binance":
		return map[string]interface{}{
			"overall_risk_score": 91.5,
			"risk_level":         "HIGH",
			"risk_contributors": map[string]float64{
				"P2P Merchant Escrow Structuring": 46.0,
				"High Turnover Rapid Transit":      29.5,
				"Unverified Counterparty Risk":    16.0,
			},
			"major_findings": []string{
				"Telegram investment fraud proceeds routed into P2P merchant escrow on Binance.",
				"Funds rapidly siphoned through intermediate mule into Binance Hot Wallet 14.",
				"Target VASP registered with FIU-IND (Binance Reg #FIU-IND/CAS/2024/0089).",
			},
			"typologies": []map[string]interface{}{
				{
					"name":        "P2P_Mule_Arbitrage",
					"confidence":  0.951,
					"description": "Conversion of stolen fiat into cryptocurrency using high-volume P2P merchant accounts.",
					"transaction_hashes": []string{
						"0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d",
					},
				},
			},
		}

	default:
		return map[string]interface{}{
			"overall_risk_score": 12.0,
			"risk_level":         "LOW",
			"risk_contributors": map[string]float64{
				"DeFi Protocol Interaction": 12.0,
			},
			"major_findings": []string{
				"Clean transaction history with reputable decentralized finance protocols (Uniswap V3 & Aave V3).",
				"No exposure to sanctioned entities, mixers, or known illicit clusters.",
			},
			"typologies": []map[string]interface{}{
				{
					"name":        "DeFi_Lending_Activity",
					"confidence":  0.985,
					"description": "Standard institutional liquidity provision and yield generation.",
					"transaction_hashes": []string{
						"0x1111111111111111111111111111111111111111111111111111111111111111",
					},
				},
			},
		}
	}
}

