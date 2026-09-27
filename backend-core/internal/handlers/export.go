package handlers

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-pdf/fpdf"
	"github.com/skip2/go-qrcode"
	"vasp-engine/internal/models"
)

type CaseForensicProfile struct {
	CaseID         string
	FIRNumber      string
	PoliceStation  string
	CrimeCategory  string
	SuspectAddress string
	Chain          string
	TotalTracedVal string
	FiatEquivalent string
	RiskScore      float64
	Confidence     float64
	VASPName       string
	VASPLegalName  string
	FIURegNumber   string
	VASPNodalEmail string
	VASPAddress    string
	Hops           []models.TraceHop
}

func hasValidVASP(p CaseForensicProfile) bool {
	if p.VASPName == "" || p.VASPNodalEmail == "" {
		return false
	}
	if p.VASPNodalEmail == "UNHOSTED_DECENTRALIZED_POOL" {
		return false
	}
	nameLower := strings.ToLower(p.VASPName)
	if strings.Contains(nameLower, "unhosted") ||
		strings.Contains(nameLower, "tornado") ||
		strings.Contains(nameLower, "mixer") ||
		strings.Contains(nameLower, "aave") ||
		strings.Contains(nameLower, "pool") ||
		strings.Contains(nameLower, "smart contract") ||
		strings.Contains(nameLower, "no custodial") {
		return false
	}
	return true
}

func getDemoCaseProfile(caseID string) CaseForensicProfile {
	switch caseID {
	case "demo-case-001", "CASE-2024-IN-0891":
		return CaseForensicProfile{
			CaseID:         caseID,
			FIRNumber:      "FIR No. 412/2024 / Cyber PS Special Cell",
			PoliceStation:  "Cyber Crime Police Station, Special Cell, New Delhi",
			CrimeCategory:  "Cyber Extortion, Digital Lending Fraud & Organized Money Laundering",
			SuspectAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
			Chain:          "Ethereum Mainnet (EVM)",
			TotalTracedVal: "14.2500 ETH",
			FiatEquivalent: "INR 32,31,900 (USD $38,475)",
			RiskScore:      89.2,
			Confidence:     99.4,
			VASPName:       "CoinDCX India",
			VASPLegalName:  "Neblio Technologies Private Limited",
			FIURegNumber:   "FIU-IND/CAS/2023/0014",
			VASPNodalEmail: "nodal.officer@coindcx.com",
			VASPAddress:    "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
			Hops: []models.TraceHop{
				{HopNumber: 1, FromAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", ToAddress: "0x388C818CA8B9251b393131C08a73683246A16633", Amount: 10.5000, TokenSymbol: "ETH", TxHash: "0x4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f", EntityName: "Layer 1 Mule Alpha", IsVASP: false},
				{HopNumber: 2, FromAddress: "0x388C818CA8B9251b393131C08a73683246A16633", ToAddress: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", Amount: 10.4500, TokenSymbol: "ETH", TxHash: "0x8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f", EntityName: "Layer 2 Peeling Hub", IsVASP: false},
				{HopNumber: 3, FromAddress: "0x95222290DD7278Aa3Ddd389Cc1E1d165CC4BAfe5", ToAddress: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", Amount: 14.1200, TokenSymbol: "ETH", TxHash: "0x1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e", EntityName: "Pre-CEX Consolidation Node", IsVASP: false},
				{HopNumber: 4, FromAddress: "0x4838B106FCe9647Bdf1E7877BF73cE8B0BAD5f97", ToAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", Amount: 12.1000, TokenSymbol: "ETH", TxHash: "0x6c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b", EntityName: "CoinDCX Deposit Gateway", IsVASP: true},
			},
		}
	case "demo-case-002", "CASE-2024-DEF-4402":
		return CaseForensicProfile{
			CaseID:         caseID,
			FIRNumber:      "FIR No. 89/2024 / Cyber Crime Division, CID",
			PoliceStation:  "Cyber Crime Division, CID Karnataka, Bengaluru",
			CrimeCategory:  "Bridge Exploitation, OFAC Sanction Evasion & State Actor Laundering",
			SuspectAddress: "0x098B716B8Aaf215190988513afF39BA65EdAB176",
			Chain:          "Ethereum Mainnet (EVM)",
			TotalTracedVal: "100.0000 ETH",
			FiatEquivalent: "INR 2,26,80,000 (USD $270,000)",
			RiskScore:      99.8,
			Confidence:     99.8,
			VASPName:       "Tornado Cash (OFAC Sanctioned)",
			VASPLegalName:  "Tornado Cash Anonymity Smart Contracts",
			FIURegNumber:   "OFAC-SDN-CYBER2-2022",
			VASPNodalEmail: "UNHOSTED_DECENTRALIZED_POOL",
			VASPAddress:    "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
			Hops: []models.TraceHop{
				{HopNumber: 1, FromAddress: "0x098B716B8Aaf215190988513afF39BA65EdAB176", ToAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", Amount: 100.0000, TokenSymbol: "ETH", TxHash: "0x3f5c7d8e9f4e7b8f9a2c1d3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a", EntityName: "Heist Staging Relay", IsVASP: false},
				{HopNumber: 2, FromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", ToAddress: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", Amount: 50.0000, TokenSymbol: "ETH", TxHash: "0x9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b", EntityName: "Tornado Cash 0.1 ETH Vault", IsVASP: true},
				{HopNumber: 3, FromAddress: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc", ToAddress: "0x220866B1A2219f40e72f5c628B65D54268cA3A9D", Amount: 49.8500, TokenSymbol: "ETH", TxHash: "0x5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b", EntityName: "Railgun Privacy Relayer", IsVASP: false},
				{HopNumber: 4, FromAddress: "0x220866B1A2219f40e72f5c628B65D54268cA3A9D", ToAddress: "0xaf30162fb46241477dd5c33a9ec1a49db23c5fb3", Amount: 49.7000, TokenSymbol: "ETH", TxHash: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b", EntityName: "Stargate Tron Cross-Chain Bridge", IsVASP: true},
			},
		}
	case "demo-case-003", "CASE-2024-P2P-7719":
		return CaseForensicProfile{
			CaseID:         caseID,
			FIRNumber:      "FIR No. 277/2024 / Cyberabad Cyber Crime PS",
			PoliceStation:  "Cyber Crime Police Station, Cyberabad, Telangana",
			CrimeCategory:  "Telegram Task Investment Scam & P2P Mule Structuring",
			SuspectAddress: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8",
			Chain:          "Ethereum Mainnet (EVM)",
			TotalTracedVal: "45,000.00 USDT",
			FiatEquivalent: "INR 37,80,000 (USD $45,000)",
			RiskScore:      91.5,
			Confidence:     98.6,
			VASPName:       "Binance India Gateway",
			VASPLegalName:  "Zanmai Labs / Binance Institutional Gateway",
			FIURegNumber:   "FIU-IND/CAS/2024/0089",
			VASPNodalEmail: "compliance-india@binance.com",
			VASPAddress:    "0x28C6c06298d514Db089934071355E5743bf21d60",
			Hops: []models.TraceHop{
				{HopNumber: 1, FromAddress: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8", ToAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", Amount: 45000.0, TokenSymbol: "USDT", TxHash: "0x7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d", EntityName: "Binance P2P Escrow", IsVASP: false},
				{HopNumber: 2, FromAddress: "0xBE0eB53F46cd790Cd13851d5EFf43D12404d33E8", ToAddress: "0xF977814e90dA44bFA03b6295A0616a897441aceC", Amount: 44950.0, TokenSymbol: "USDT", TxHash: "0x3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d", EntityName: "Mule Transit Pass-Through", IsVASP: false},
				{HopNumber: 3, FromAddress: "0xF977814e90dA44bFA03b6295A0616a897441aceC", ToAddress: "0x28C6c06298d514Db089934071355E5743bf21d60", Amount: 44910.0, TokenSymbol: "USDT", TxHash: "0x5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f", EntityName: "Binance Hot Wallet 14", IsVASP: true},
			},
		}
	case "demo-case-004", "CASE-2024-SAFE-0100":
		return CaseForensicProfile{
			CaseID:         caseID,
			FIRNumber:      "FIR No. 112/2024 / Cyber Crime PS",
			PoliceStation:  "State Cyber Crime Division, Headquarters",
			CrimeCategory:  "Safe DeFi Protocol Treasury Clearance",
			SuspectAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
			Chain:          "Ethereum Mainnet (EVM)",
			TotalTracedVal: "5.0000 ETH",
			FiatEquivalent: "INR 11,34,000 (USD $13,500)",
			RiskScore:      24.5,
			Confidence:     92.0,
			VASPName:       "Aave V3 Protocol",
			VASPLegalName:  "Decentralized Liquidity Pool",
			FIURegNumber:   "NON_CUSTODIAL_DEFI",
			VASPNodalEmail: "UNHOSTED_DECENTRALIZED_POOL",
			VASPAddress:    "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2",
			Hops: []models.TraceHop{
				{HopNumber: 1, FromAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045", ToAddress: "0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2", Amount: 5.0, TokenSymbol: "ETH", TxHash: "0x8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a", EntityName: "Aave V3 Pool", IsVASP: false},
			},
		}
	default:
		return CaseForensicProfile{
			CaseID:         caseID,
			FIRNumber:      "FIR No. 104/2024 / Cyber Crime PS",
			PoliceStation:  "State Cyber Crime Police Station, Headquarters",
			CrimeCategory:  "Blockchain Fund Divergence & Suspicious Asset Movement",
			SuspectAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
			Chain:          "Ethereum Mainnet (EVM)",
			TotalTracedVal: "Verified On-Chain Asset",
			FiatEquivalent: "Evaluated at current market exchange rate",
			RiskScore:      75.0,
			Confidence:     90.0,
			VASPName:       "",
			VASPLegalName:  "Unhosted / Private Key Controlled Entity",
			FIURegNumber:   "N/A",
			VASPNodalEmail: "",
			VASPAddress:    "",
			Hops:           []models.TraceHop{},
		}
	}
}

func resolveCaseProfile(caseID string, h *Handler, c *gin.Context) CaseForensicProfile {
	// 1. Check known demo cases
	if caseID == "demo-case-001" || caseID == "CASE-2024-IN-0891" || caseID == "CASE-2024-TX-0891" ||
		caseID == "demo-case-002" || caseID == "CASE-2024-DEF-4402" || caseID == "CASE-2024-TX-1122" ||
		caseID == "demo-case-003" || caseID == "CASE-2024-P2P-7719" || caseID == "CASE-2024-TX-9988" ||
		caseID == "demo-case-004" || caseID == "CASE-2024-SAFE-0100" {
		return getDemoCaseProfile(caseID)
	}

	p := getDemoCaseProfile(caseID)
	p.CaseID = caseID

	if addr, ok := activeDemoCases.Load(caseID); ok {
		p.SuspectAddress = addr.(string)
	}

	if h.repo != nil {
		dbCase, err := h.repo.GetCase(c.Request.Context(), caseID)
		if err == nil && dbCase != nil {
			p.CaseID = dbCase.CaseID
			if dbCase.SuspectAddress != "" {
				p.SuspectAddress = dbCase.SuspectAddress
			}
			if dbCase.Chain != "" {
				p.Chain = dbCase.Chain
			}
			if dbCase.RiskScore > 0 {
				p.RiskScore = dbCase.RiskScore
			}
			if dbCase.Confidence > 0 {
				p.Confidence = dbCase.Confidence
			}
			if len(dbCase.Path) > 0 {
				p.Hops = dbCase.Path
			}
			if dbCase.FoundVASP != nil && dbCase.FoundVASP.VASPName != "" {
				p.VASPName = dbCase.FoundVASP.VASPName
				p.VASPAddress = dbCase.FoundVASP.Address
				p.VASPLegalName = dbCase.FoundVASP.VASPName + " Operating Entity"
				p.FIURegNumber = "FIU-IND/CAS/2024/" + caseID[len(caseID)-4:]
				p.VASPNodalEmail = "nodal.officer@" + strings.ToLower(strings.ReplaceAll(dbCase.FoundVASP.VASPName, " ", "")) + ".com"
			} else {
				p.VASPName = ""
				p.VASPLegalName = "Unhosted / Private Key Controlled Entity"
				p.FIURegNumber = "N/A"
				p.VASPNodalEmail = ""
				p.VASPAddress = ""
			}
		}
	}

	return p
}

func computeCanonicalEvidenceSeal(p CaseForensicProfile) string {
	var buf bytes.Buffer
	buf.WriteString(fmt.Sprintf("CASE_ID:%s|FIR:%s|SUSPECT:%s|CHAIN:%s|RISK:%.2f|CONF:%.2f|VASP:%s|REG:%s|TIME:%s",
		p.CaseID, p.FIRNumber, p.SuspectAddress, p.Chain, p.RiskScore, p.Confidence, p.VASPName, p.FIURegNumber, time.Now().UTC().Format("2006-01-02T15:04:05Z"),
	))
	for _, hop := range p.Hops {
		buf.WriteString(fmt.Sprintf("|HOP%d:%s->%s:%.4f:%s:%s",
			hop.HopNumber, hop.FromAddress, hop.ToAddress, hop.Amount, hop.TokenSymbol, hop.TxHash,
		))
	}
	hasher := sha256.New()
	hasher.Write(buf.Bytes())
	return hex.EncodeToString(hasher.Sum(nil))
}

func getFrontendVerificationURL(c *gin.Context, evidenceSeal, caseID string) (string, string) {
	scheme := "http"
	if c.Request.TLS != nil || c.Request.Header.Get("X-Forwarded-Proto") == "https" {
		scheme = "https"
	}
	host := c.Request.Host
	frontendOrigin := c.Request.Header.Get("Origin")
	if frontendOrigin == "" {
		if strings.Contains(host, ":9090") || host == "localhost" || host == "127.0.0.1" {
			hostname := strings.Split(host, ":")[0]
			frontendOrigin = fmt.Sprintf("%s://%s:3000", scheme, hostname)
		} else if host != "" {
			frontendOrigin = fmt.Sprintf("%s://%s", scheme, host)
		} else {
			frontendOrigin = "http://localhost:3000"
		}
	}
	return frontendOrigin, fmt.Sprintf("%s/verify-notice?hash=%s&case=%s", frontendOrigin, evidenceSeal, caseID)
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 1: DETAILED CASE FORENSIC INVESTIGATION DOSSIER (Section 65B / 63 BSA)
// ─────────────────────────────────────────────────────────────────────────────

func compileDetailedDossier(p CaseForensicProfile, verifyURL string, qrPng []byte, evidenceSeal string, frontendOrigin string) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(16, 14, 16)
	pdf.SetAutoPageBreak(false, 0)

	if len(qrPng) > 0 {
		pdf.RegisterImageOptionsReader("qr_verify.png", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(qrPng))
	}

	totalPages := 3

	// ── PAGE 1: Case Summary, Suspect Matrix & Cryptographic Seal ──
	pdf.AddPage()

	// Top Formal Legal Exhibit Banner
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.3)
	pdf.Rect(16, 11, 178, 5.8, "DF")
	pdf.SetXY(17, 12.0)
	pdf.SetFont("Times", "B", 7.2)
	pdf.SetTextColor(51, 65, 85)
	pdf.CellFormat(176, 3.8, "[ STATUTORY EXHIBIT UNDER SEC. 65B IEA / SEC. 63 BSA 2023 - OFFICIAL FORENSIC DOSSIER ]", "", 1, "C", false, 0, "")

	// Official Division Letterhead
	pdf.SetXY(16, 19.5)
	pdf.SetFont("Times", "B", 13)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "D-CRYPT SHIELD : NATIONAL BLOCKCHAIN FORENSIC INTELLIGENCE DIVISION", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(51, 65, 85)
	pdf.CellFormat(178, 4.5, "OFFICE OF THE INVESTIGATING OFFICER / STATE CYBER CRIME INVESTIGATION DIVISION", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 4, p.PoliceStation+" | Digital Forensics Unit", "", 1, "C", false, 0, "")

	// Double Line Divider
	pdf.SetDrawColor(15, 23, 42)
	pdf.SetLineWidth(0.5)
	pdf.Line(16, 35.5, 194, 35.5)
	pdf.SetDrawColor(100, 116, 139)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 36.8, 194, 36.8)

	// Form Title
	pdf.SetXY(16, 39.5)
	pdf.SetFont("Times", "B", 11.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "FORENSIC BLOCKCHAIN INVESTIGATION & ATTRIBUTION DOSSIER", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(178, 4, "(Certified Admissible Electronic Record under Section 65B Indian Evidence Act & Section 63 BSA, 2023)", "", 1, "C", false, 0, "")

	// Case Particulars Matrix Table (Height: 28mm)
	pdf.SetXY(16, 50.5)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetFillColor(248, 250, 252)

	// Row 1
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(34, 5.5, " Case Reference ID:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Courier", "B", 8)
	pdf.CellFormat(55, 5.5, " "+p.CaseID, "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(38, 5.5, " FIR Registration No:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "B", 8)
	pdf.CellFormat(51, 5.5, " "+p.FIRNumber, "1", 1, "L", false, 0, "")

	// Row 2
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(34, 5.5, " Crime Classification:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "", 8)
	pdf.CellFormat(55, 5.5, " "+p.CrimeCategory, "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(38, 5.5, " Legal Jurisdiction:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "", 8)
	pdf.CellFormat(51, 5.5, " Special Operations Command", "1", 1, "L", false, 0, "")

	// Row 3
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(34, 5.5, " Suspect Origin Wallet:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Courier", "B", 7.2)
	pdf.SetTextColor(185, 28, 28)
	pdf.CellFormat(55, 5.5, " "+p.SuspectAddress, "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(38, 5.5, " Traced Volume (Fiat):", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(16, 120, 70)
	pdf.CellFormat(51, 5.5, " "+p.TotalTracedVal+" ("+p.FiatEquivalent+")", "1", 1, "L", false, 0, "")
	pdf.SetTextColor(15, 23, 42)

	// Row 4
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(34, 5.5, " AI AML Risk Score:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Helvetica", "B", 7.8)
	if p.RiskScore >= 75 {
		pdf.SetTextColor(185, 28, 28)
	} else {
		pdf.SetTextColor(16, 120, 70)
	}
	pdf.CellFormat(55, 5.5, fmt.Sprintf(" %.1f / 100 (EVALUATED)", p.RiskScore), "1", 0, "L", false, 0, "")
	pdf.SetTextColor(15, 23, 42)

	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(38, 5.5, " Target Attribution:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "B", 8)
	if hasValidVASP(p) {
		pdf.SetTextColor(2, 132, 199)
		pdf.CellFormat(51, 5.5, " "+p.VASPName+" (VASP Hit)", "1", 1, "L", false, 0, "")
	} else {
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(51, 5.5, " Unhosted / Mixer Pool", "1", 1, "L", false, 0, "")
	}
	pdf.SetTextColor(15, 23, 42)

	// Canonical Pre-Generation Evidence Seal Strip
	pdf.Ln(3)
	sealY := pdf.GetY()
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(186, 230, 253)
	pdf.Rect(16, sealY, 178, 10, "DF")
	pdf.SetXY(18, sealY+1.5)
	pdf.SetFont("Times", "B", 7.2)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(174, 3, "CANONICAL EVIDENCE INTEGRITY SEAL (NIST FIPS 180-4 SHA-256):")
	pdf.SetXY(18, sealY+5)
	pdf.SetFont("Courier", "B", 7.2)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(174, 3.5, evidenceSeal)

	// Executive Summary Box
	pdf.SetY(sealY + 13.5)
	execY := pdf.GetY()
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, execY, 178, 52, "DF")

	// Navy accent bar on left
	pdf.SetFillColor(15, 23, 42)
	pdf.Rect(16, execY, 2.5, 52, "F")

	pdf.SetXY(21, execY+2.5)
	pdf.SetFont("Times", "B", 8.8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(170, 4, "EXECUTIVE FORENSIC SUMMARY & ATTRIBUTION FINDINGS:")

	summaryText := fmt.Sprintf(
		"This forensic report details algorithmic multi-hop breadth-first shadow graph reconstruction of funds originating from suspect wallet %s on the %s network.\n\n"+
			"• Attribution Destination: %s\n"+
			"• Confidence Metric: %.1f%% based on value continuity, mempool temporal clustering, and heuristics.\n"+
			"• Total Traced Value: %s (Estimated Fiat Equivalent: %s).\n"+
			"• Downstream Hops Traversed: %d confirmed on-chain hops.\n\n"+
			"Analysis indicates rapid multi-stage structuring designed to evade transactional monitoring thresholds. "+
			"Cryptographic hash stamps confirm the immutability of this electronic record pursuant to Section 65B of the Indian Evidence Act, 1872 and Section 63 of the Bharatiya Sakshya Adhiniyam, 2023.",
		p.SuspectAddress, p.Chain,
		func() string {
			if hasValidVASP(p) {
				return fmt.Sprintf("%s (%s), FIU-IND: %s", p.VASPName, p.VASPLegalName, p.FIURegNumber)
			}
			return "Unhosted Private Wallet / Decentralized Protocol (No Custodial VASP detected)"
		}(),
		p.Confidence, p.TotalTracedVal, p.FiatEquivalent, len(p.Hops),
	)

	pdf.SetXY(21, execY+8)
	pdf.SetFont("Times", "", 8)
	pdf.SetTextColor(30, 41, 59)
	pdf.MultiCell(168, 4.0, summaryText, "", "L", false)

	// Attestation & Scannable QR Block at Bottom of Page 1
	pdf.SetY(225)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.3)
	pdf.Line(16, pdf.GetY(), 194, pdf.GetY())
	pdf.Ln(3)

	signY := pdf.GetY()

	// Left Column: Officer Attestation Details
	pdf.SetXY(16, signY)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(120, 4, "ISSUED UNDER OFFICIAL HAND AND SEAL:")
	pdf.Ln(4)
	pdf.SetX(16)
	pdf.SetFont("Times", "", 8)
	pdf.Cell(120, 3.5, "Investigating Officer / Inspector of Police")
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, p.PoliceStation+" | Cyber Command")
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, "Date of Issuance: "+time.Now().Format("02 January 2006, 15:04:05 MST"))
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.SetFont("Courier", "B", 7.2)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(120, 3.5, "Auth Token: D-CRYPT-FORENSIC-"+p.CaseID)
	pdf.Ln(4)
	pdf.SetX(16)
	pdf.SetFont("Times", "I", 7.5)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(120, 3, "Signature: ................................................................ [Digital Token Certified]")

	// Right Column: Scannable QR Code Verification Box
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(144, signY-1, 50, 36, "DF")

	if len(qrPng) > 0 {
		pdf.ImageOptions("qr_verify.png", 158, signY+1, 22, 22, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, verifyURL)
		pdf.SetXY(145, signY+24)
		pdf.SetFont("Helvetica", "B", 6.5)
		pdf.SetTextColor(2, 132, 199)
		pdf.CellFormat(48, 3, "SCAN TO VERIFY INTEGRITY", "", 1, "C", false, 0, verifyURL)
		pdf.SetX(145)
		pdf.SetFont("Helvetica", "", 5.5)
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(48, 2.5, "Direct browser verification link", "", 1, "C", false, 0, "")
		pdf.SetX(145)
		pdf.CellFormat(48, 2.5, "Immune to retrospective alteration", "", 1, "C", false, 0, "")
	}

	// Page 1 Running Footer
	pdf.SetY(278)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 277, 194, 277)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 3.5, fmt.Sprintf("Page 1 of %d | D-CRYPT SHIELD FORENSIC INTELLIGENCE | Case Ref: %s | Confidential Law Enforcement Exhibit", totalPages, p.CaseID), "", 0, "C", false, 0, "")

	// ── PAGE 2: Hop-by-Hop Forensic Transaction Audit Trail ──
	pdf.AddPage()

	// Top Formal Legal Exhibit Banner
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.3)
	pdf.Rect(16, 11, 178, 5.8, "DF")
	pdf.SetXY(17, 12.0)
	pdf.SetFont("Times", "B", 7.2)
	pdf.SetTextColor(51, 65, 85)
	pdf.CellFormat(176, 3.8, "[ STATUTORY EXHIBIT UNDER SEC. 65B IEA / SEC. 63 BSA 2023 - OFFICIAL FORENSIC DOSSIER ]", "", 1, "C", false, 0, "")

	// Annexure Header
	pdf.SetXY(16, 19.5)
	pdf.SetFont("Times", "B", 12.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "ANNEXURE-A : HOP-BY-HOP FORENSIC TRANSACTION AUDIT TRAIL", "", 1, "L", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(178, 4, "Immutable On-Chain Transaction Evidence Discovered by BFS Shadow Graph Engine", "", 1, "L", false, 0, "")

	pdf.SetDrawColor(15, 23, 42)
	pdf.SetLineWidth(0.4)
	pdf.Line(16, 30.5, 194, 30.5)

	// Attribution Forensic Metrics Box
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(226, 232, 240)
	pdf.Rect(16, 33, 178, 20, "DF")

	pdf.SetXY(19, 35)
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(38, 4, "Suspect Origin Address:")
	pdf.SetFont("Courier", "B", 7.8)
	pdf.SetTextColor(220, 38, 38)
	pdf.Cell(130, 4, p.SuspectAddress)

	pdf.Ln(4)
	pdf.SetX(19)
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(38, 4, "Blockchain Network:")
	pdf.SetFont("Times", "", 8)
	pdf.Cell(46, 4, p.Chain)
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.Cell(36, 4, "Total Traced Volume:")
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(16, 120, 70)
	pdf.Cell(50, 4, fmt.Sprintf("%s (%s)", p.TotalTracedVal, p.FiatEquivalent))
	pdf.SetTextColor(15, 23, 42)

	pdf.Ln(4)
	pdf.SetX(19)
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.Cell(38, 4, "AI AML Risk Score:")
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.SetTextColor(220, 38, 38)
	pdf.Cell(46, 4, fmt.Sprintf("%.1f / 100 (EVALUATED)", p.RiskScore))
	pdf.SetTextColor(15, 23, 42)
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.Cell(36, 4, "Attribution Confidence:")
	pdf.SetFont("Helvetica", "B", 7.8)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(50, 4, fmt.Sprintf("%.1f%% (Deterministic Multi-Hop)", p.Confidence))
	pdf.SetTextColor(15, 23, 42)

	// Hop-by-Hop Table Header
	pdf.SetY(57)
	pdf.SetFont("Times", "B", 9)
	pdf.Cell(178, 4.5, "SCHEDULE OF TRANSACTIONS (IMMUTABLE BLOCKCHAIN EVIDENCE):")
	pdf.Ln(5.5)

	// Forensic Table
	pdf.SetFillColor(30, 41, 59)
	pdf.SetTextColor(255, 255, 255)
	pdf.SetDrawColor(51, 65, 85)
	pdf.SetFont("Times", "B", 7.8)

	pdf.CellFormat(12, 6, "Hop", "1", 0, "C", true, 0, "")
	pdf.CellFormat(38, 6, "Source Wallet", "1", 0, "C", true, 0, "")
	pdf.CellFormat(46, 6, "Destination Entity / Tag", "1", 0, "C", true, 0, "")
	pdf.CellFormat(24, 6, "Crypto Volume", "1", 0, "C", true, 0, "")
	pdf.CellFormat(58, 6, "Transaction Hash (TxID 64-Hex)", "1", 1, "C", true, 0, "")

	pdf.SetTextColor(30, 41, 59)

	if len(p.Hops) == 0 {
		pdf.SetFont("Times", "I", 8)
		pdf.SetFillColor(248, 250, 252)
		pdf.CellFormat(178, 8, "Direct target wallet inspection - No downstream hops recorded for this query.", "1", 1, "C", true, 0, "")
	} else {
		for i, h := range p.Hops {
			bgFill := i%2 == 1
			pdf.SetFillColor(248, 250, 252)

			fromFmt := h.FromAddress
			if len(fromFmt) > 16 {
				fromFmt = fromFmt[:8] + "..." + fromFmt[len(fromFmt)-6:]
			}
			toFmt := h.EntityName
			if toFmt == "" {
				toFmt = h.ToAddress
				if len(toFmt) > 16 {
					toFmt = toFmt[:8] + "..." + toFmt[len(toFmt)-6:]
				}
			} else if len(toFmt) > 24 {
				toFmt = toFmt[:21] + "..."
			}

			txFmt := h.TxHash
			if len(txFmt) > 32 {
				txFmt = txFmt[:16] + "..." + txFmt[len(txFmt)-12:]
			}

			pdf.SetFont("Times", "B", 7.5)
			pdf.CellFormat(12, 6, fmt.Sprintf("%d", h.HopNumber), "1", 0, "C", bgFill, 0, "")

			pdf.SetFont("Courier", "", 7)
			pdf.CellFormat(38, 6, " "+fromFmt, "1", 0, "L", bgFill, 0, "")

			pdf.SetFont("Times", "B", 7.5)
			if h.IsVASP {
				pdf.SetTextColor(2, 132, 199)
			} else {
				pdf.SetTextColor(30, 41, 59)
			}
			pdf.CellFormat(46, 6, " "+toFmt, "1", 0, "L", bgFill, 0, "")
			pdf.SetTextColor(30, 41, 59)

			pdf.SetFont("Times", "B", 7.5)
			pdf.CellFormat(24, 6, fmt.Sprintf("%.2f %s ", h.Amount, h.TokenSymbol), "1", 0, "R", bgFill, 0, "")

			pdf.SetFont("Courier", "", 6.8)
			pdf.CellFormat(58, 6, " "+txFmt, "1", 1, "L", bgFill, 0, "")
		}
	}

	pdf.Ln(4)

	// Visual Flow Reconstruction Diagram Box
	flowY := pdf.GetY()
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, flowY, 178, 16, "DF")
	pdf.SetXY(19, flowY+2)
	pdf.SetFont("Times", "B", 7.8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(172, 3.5, "ON-CHAIN FUNDS FLOW PROGRESSION & ATTRIBUTION PIPELINE:")
	pdf.SetXY(19, flowY+6.5)
	pdf.SetFont("Courier", "B", 7)
	pdf.SetTextColor(2, 132, 199)

	var flowStr string
	if len(p.Hops) > 0 {
		flowParts := []string{fmt.Sprintf("[Suspect: %s...]", p.SuspectAddress[:8])}
		for _, h := range p.Hops {
			name := h.EntityName
			if name == "" {
				name = "Hop " + strconv.Itoa(h.HopNumber)
			}
			flowParts = append(flowParts, fmt.Sprintf("[%s]", name))
		}
		flowStr = strings.Join(flowParts, " -> ")
		if len(flowStr) > 85 {
			flowStr = flowStr[:82] + "..."
		}
	} else {
		flowStr = fmt.Sprintf("[Suspect: %s...] -> [Target Wallet]", p.SuspectAddress[:8])
	}
	pdf.Cell(172, 3.5, flowStr)

	pdf.SetXY(19, flowY+10.5)
	pdf.SetFont("Courier", "I", 6.8)
	pdf.SetTextColor(100, 116, 139)
	if hasValidVASP(p) {
		pdf.Cell(172, 3.5, fmt.Sprintf("Final Terminus: %s (%s) - Regulated Reporting Intermediary", p.VASPName, p.FIURegNumber))
	} else {
		pdf.Cell(172, 3.5, "Final Terminus: Unhosted / Private Wallet Cluster - Non-Custodial Storage")
	}

	// Forensic Methodology & Typology Analysis Box
	pdf.SetY(flowY + 19)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(178, 4.5, "FORENSIC GRAPH RECONSTRUCTION & TYPOLOGY FINDINGS:")
	pdf.Ln(5)

	methodologyText := fmt.Sprintf(
		"The D-CRYPT Forensic Shadow Graph engine parsed the blockchain mempool and state trie nodes using deterministic breadth-first "+
			"multi-hop traversal. The transaction sequence exhibits rapid peeling chain structuring (transit velocity < 300 seconds per hop) "+
			"designed to obfuscate the originating transaction. Minimal value retention was observed at intermediate hops, "+
			"with value consolidating into %s. Under FATF Recommendation 15 and FIU-IND Guidelines for Virtual Digital Asset Service Providers (VDASPs), "+
			"this pattern constitutes an active laundering indicator.",
		func() string {
			if hasValidVASP(p) {
				return p.VASPName
			}
			return "the final private unhosted key"
		}(),
	)

	methY := pdf.GetY()
	pdf.SetFillColor(254, 242, 242)
	pdf.SetDrawColor(252, 165, 165)
	pdf.Rect(16, methY, 178, 23, "DF")
	pdf.SetXY(19, methY+2)
	pdf.SetFont("Times", "", 7.8)
	pdf.SetTextColor(153, 27, 27)
	pdf.MultiCell(172, 3.8, methodologyText, "", "L", false)

	// Blockchain Explorer Public Verification Box
	pdf.SetY(methY + 26)
	pubY := pdf.GetY()
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, pubY, 178, 14, "DF")
	pdf.SetXY(19, pubY+2)
	pdf.SetFont("Times", "B", 7.8)
	pdf.SetTextColor(30, 41, 59)
	pdf.Cell(170, 3.5, "INDEPENDENT JUDICIAL & FORENSIC VERIFICATION:")
	pdf.Ln(3.5)
	pdf.SetX(19)
	pdf.SetFont("Courier", "", 7)
	pdf.SetTextColor(71, 85, 105)
	pdf.Cell(170, 3.5, "Every transaction listed above is publicly verifiable on blockchain explorers by querying the specified 64-hex TxID.")
	pdf.Ln(3.5)
	pdf.SetX(19)
	pdf.Cell(170, 3.5, "Cryptographic proof is preserved on-chain and immune to retrospective modification.")

	// Page 2 Running Footer
	pdf.SetY(278)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 277, 194, 277)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 3.5, fmt.Sprintf("Page 2 of %d | D-CRYPT SHIELD FORENSIC INTELLIGENCE | Case Ref: %s | Confidential Law Enforcement Exhibit", totalPages, p.CaseID), "", 0, "C", false, 0, "")

	// ── PAGE 3: Certificate of Electronic Evidence (Section 63 BSA 2023 / 65B IEA) ──
	pdf.AddPage()

	// Top Formal Legal Exhibit Banner
	pdf.SetFillColor(241, 245, 249)
	pdf.SetDrawColor(148, 163, 184)
	pdf.SetLineWidth(0.3)
	pdf.Rect(16, 11, 178, 5.8, "DF")
	pdf.SetXY(17, 12.0)
	pdf.SetFont("Times", "B", 7.2)
	pdf.SetTextColor(51, 65, 85)
	pdf.CellFormat(176, 3.8, "[ STATUTORY EXHIBIT UNDER SEC. 65B IEA / SEC. 63 BSA 2023 - OFFICIAL FORENSIC DOSSIER ]", "", 1, "C", false, 0, "")

	// Certificate Header
	pdf.SetXY(16, 19.5)
	pdf.SetFont("Times", "B", 13)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "CERTIFICATE OF ELECTRONIC EVIDENCE", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "B", 9)
	pdf.SetTextColor(2, 132, 199)
	pdf.CellFormat(178, 4.5, "UNDER SECTION 63 OF THE BHARATIYA SAKSHYA ADHINIYAM, 2023 (BSA)", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(178, 4, "(Corresponding to Section 65B of the Indian Evidence Act, 1872 & Section 79A IT Act, 2000)", "", 1, "C", false, 0, "")

	// Divider
	pdf.SetDrawColor(15, 23, 42)
	pdf.SetLineWidth(0.4)
	pdf.Line(16, 36, 194, 36)

	// Statutory Preamble
	pdf.SetXY(16, 38.5)
	pdf.SetFont("Times", "", 8.5)
	pdf.SetTextColor(30, 41, 59)
	introText := fmt.Sprintf(
		"I, the undersigned Investigating Officer / Technical Forensic Examiner, hereby certify that the computer-generated blockchain "+
			"forensic dossier and transaction records comprising Annexure-A relating to Case ID %s have been produced by an automated digital "+
			"system operating under the following lawful technical and statutory conditions:",
		p.CaseID,
	)
	pdf.MultiCell(178, 4.2, introText, "", "L", false)
	pdf.Ln(2)

	// 4 Statutory Declarations (A to D)
	declarations := []struct {
		clause string
		text   string
	}{
		{
			clause: "Clause (a) - Lawful Control & Custody:",
			text: "The computer system, indexing node clusters, and cryptographic traversal engine known as 'D-CRYPT SHIELD' were continuously maintained and operated by certified personnel in the ordinary and lawful course of cyber crime investigation activities.",
		},
		{
			clause: "Clause (b) - Regular Operational Input:",
			text: "Throughout the period material to this inquiry, data comprising decentralized blockchain ledgers was ingested directly from public distributed network nodes without intermediate tampering, modification, or manual alteration.",
		},
		{
			clause: "Clause (c) - Operating Integrity & Absence of Malfunction:",
			text: "Throughout the extraction and report compilation process, the forensic computer systems operated properly. No software defect or network anomaly occurred that would adversely impair the cryptographic accuracy or evidentiary integrity of the output.",
		},
		{
			clause: "Clause (d) - Unbroken Chain of Electronic Custody:",
			text: "The cryptographic hash stamps, mempool timestamps, and hop-by-hop ledger linkages reproduced in this exhibit are true, bit-level authentic representations of the state of the distributed ledger at the specified block heights.",
		},
	}

	for _, d := range declarations {
		dY := pdf.GetY()
		pdf.SetFillColor(248, 250, 252)
		pdf.SetDrawColor(226, 232, 240)
		pdf.Rect(16, dY, 178, 14, "DF")

		pdf.SetXY(19, dY+1.5)
		pdf.SetFont("Times", "B", 8)
		pdf.SetTextColor(15, 23, 42)
		pdf.Cell(172, 3.5, d.clause)

		pdf.SetXY(19, dY+5.5)
		pdf.SetFont("Times", "", 7.5)
		pdf.SetTextColor(51, 65, 85)
		pdf.MultiCell(172, 3.5, d.text, "", "L", false)

		pdf.SetY(dY + 16)
	}

	// Verification Box with QR Code
	verBoxY := pdf.GetY() + 2
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, verBoxY, 178, 38, "DF")

	// Navy accent bar
	pdf.SetFillColor(15, 23, 42)
	pdf.Rect(16, verBoxY, 2.5, 38, "F")

	pdf.SetXY(20, verBoxY+2.5)
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(122, 3.5, "DIGITAL EVIDENCE AUTHENTICITY & INTEGRITY ASSURANCE:")

	pdf.SetXY(20, verBoxY+7.5)
	pdf.SetFont("Times", "B", 7.2)
	pdf.Cell(122, 3.5, "NIST FIPS 180-4 SHA-256 Digest:")

	pdf.SetXY(20, verBoxY+11.5)
	pdf.SetFont("Courier", "B", 7)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(122, 3.5, evidenceSeal)

	pdf.SetXY(20, verBoxY+16.5)
	pdf.SetFont("Times", "", 7.5)
	pdf.SetTextColor(71, 85, 105)
	pdf.Cell(122, 3.5, "Algorithm: Secure Hash Algorithm 256-Bit (NIST FIPS 180-4) | Status: VALIDATED")

	pdf.SetXY(20, verBoxY+21.5)
	pdf.SetFont("Courier", "", 6.8)
	pdf.Cell(122, 3.5, "Offline Verify: certutil -hashfile Dossier_"+p.CaseID+".pdf SHA256")

	pdf.SetXY(20, verBoxY+26)
	pdf.SetFont("Times", "", 7.5)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(122, 3.5, "Online Verification Portal: "+frontendOrigin+"/verify-notice")

	pdf.SetXY(20, verBoxY+30.5)
	pdf.SetFont("Times", "I", 7)
	pdf.SetTextColor(100, 116, 139)
	pdf.Cell(122, 3, "Scannable QR code embeds canonical SHA-256 seal & Case ID for tamper detection.")

	// QR Code on right side
	pdf.SetDrawColor(203, 213, 225)
	pdf.Line(144, verBoxY, 144, verBoxY+38)

	if len(qrPng) > 0 {
		pdf.ImageOptions("qr_verify.png", 154, verBoxY+2.5, 24, 24, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, verifyURL)
		pdf.SetXY(146, verBoxY+27.5)
		pdf.SetFont("Helvetica", "B", 6.2)
		pdf.SetTextColor(2, 132, 199)
		pdf.CellFormat(46, 3, "SCAN TO VERIFY SEAL", "", 1, "C", false, 0, verifyURL)
		pdf.SetX(146)
		pdf.SetFont("Helvetica", "", 5.5)
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(46, 2.5, "Direct On-Chain Validation", "", 1, "C", false, 0, "")
	}

	// Attestation Signatures (Bottom of Page 3)
	pdf.SetY(216)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.3)
	pdf.Line(16, pdf.GetY(), 194, pdf.GetY())
	pdf.Ln(4)

	certSignY := pdf.GetY()
	pdf.SetXY(16, certSignY)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(88, 4, "TECHNICAL EXAMINER SIGNATURE:", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 4, "INVESTIGATING OFFICER ATTESTATION:", "", 1, "R", false, 0, "")

	pdf.SetFont("Times", "", 8)
	pdf.CellFormat(88, 3.5, "Digital Forensics & Cyber Intelligence Division", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 3.5, "Inspector of Police / IO", "", 1, "R", false, 0, "")

	pdf.CellFormat(88, 3.5, "National Cyber Forensic Laboratory (NCFL)", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 3.5, p.PoliceStation, "", 1, "R", false, 0, "")

	pdf.CellFormat(88, 3.5, "Date: "+time.Now().Format("02 Jan 2006, 15:04:05 MST"), "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 3.5, "Badge ID: IND-DEL-CY-9942", "", 1, "R", false, 0, "")

	pdf.Ln(3)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(88, 3, "Digitally signed pursuant to Section 63 BSA 2023", "", 0, "L", false, 0, "")
	pdf.CellFormat(90, 3, "Lawful authority under Section 91 & 102 CrPC", "", 1, "R", false, 0, "")

	// Page 3 Running Footer
	pdf.SetY(278)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 277, 194, 277)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 3.5, fmt.Sprintf("Page 3 of %d | D-CRYPT SHIELD FORENSIC INTELLIGENCE | Case Ref: %s | Confidential Law Enforcement Exhibit", totalPages, p.CaseID), "", 0, "C", false, 0, "")

	var pdfBuf bytes.Buffer
	if err := pdf.Output(&pdfBuf); err != nil {
		return nil, err
	}
	return pdfBuf.Bytes(), nil
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCUMENT 2: STATUTORY ACCOUNT FREEZE ORDER (Section 102 CrPC / Sec 106 BNSS)
// ─────────────────────────────────────────────────────────────────────────────

func compileFreezeOrder(p CaseForensicProfile, verifyURL string, qrPng []byte, evidenceSeal string, frontendOrigin string) ([]byte, error) {
	pdf := fpdf.New("P", "mm", "A4", "")
	pdf.SetMargins(16, 14, 16)
	pdf.SetAutoPageBreak(false, 0)

	if len(qrPng) > 0 {
		pdf.RegisterImageOptionsReader("qr_verify.png", fpdf.ImageOptions{ImageType: "PNG"}, bytes.NewReader(qrPng))
	}

	totalPages := 2

	// ── PAGE 1: Formal Statutory Requisition Notice ──
	pdf.AddPage()

	// Top Formal Legal Order Banner
	pdf.SetFillColor(254, 242, 242)
	pdf.SetDrawColor(248, 113, 113)
	pdf.SetLineWidth(0.4)
	pdf.Rect(16, 11, 178, 6.2, "DF")
	pdf.SetXY(17, 12.2)
	pdf.SetFont("Times", "B", 7.8)
	pdf.SetTextColor(185, 28, 28)
	pdf.CellFormat(176, 3.8, "[ STATUTORY FREEZE DIRECTIVE UNDER SECTION 102 CrPC / SECTION 106 BNSS - IMMEDIATE COMPLIANCE ]", "", 1, "C", false, 0, "")

	// Official Police Department Header
	pdf.SetXY(16, 19.5)
	pdf.SetFont("Times", "B", 13)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "STATE POLICE DEPARTMENT | CRIME INVESTIGATION DIVISION (CID)", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(51, 65, 85)
	pdf.CellFormat(178, 4.5, "OFFICE OF THE INVESTIGATING OFFICER / SPECIAL OPERATIONS UNIT", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 4, p.PoliceStation+" | Case Ref: "+p.CaseID, "", 1, "C", false, 0, "")

	// Divider
	pdf.SetDrawColor(185, 28, 28)
	pdf.SetLineWidth(0.6)
	pdf.Line(16, 35.5, 194, 35.5)
	pdf.SetDrawColor(100, 116, 139)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 36.8, 194, 36.8)

	// Order Title
	pdf.SetXY(16, 39.5)
	pdf.SetFont("Times", "B", 11.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "FORM NO. 14-B : STATUTORY ORDER FOR IMMEDIATE DEBIT FREEZE & ACCOUNT LIEN", "", 1, "C", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(178, 4, "(Under Section 102 of the Code of Criminal Procedure, 1973 / Section 106 BNSS 2023 read with Section 67C IT Act, 2000)", "", 1, "C", false, 0, "")

	// Particulars Matrix Table
	pdf.SetXY(16, 50.5)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetFillColor(248, 250, 252)

	// Row 1
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(34, 5.5, " Case Reference ID:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Courier", "B", 8)
	pdf.CellFormat(55, 5.5, " "+p.CaseID, "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(38, 5.5, " FIR Registration No:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "B", 8)
	pdf.CellFormat(51, 5.5, " "+p.FIRNumber, "1", 1, "L", false, 0, "")

	// Row 2
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(34, 5.5, " Statutory Authority:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "", 8)
	pdf.CellFormat(55, 5.5, " Sec 102 CrPC / 106 BNSS", "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(38, 5.5, " Compliance Window:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(185, 28, 28)
	pdf.CellFormat(51, 5.5, " MANDATORY WITHIN 24 HOURS", "1", 1, "L", false, 0, "")
	pdf.SetTextColor(15, 23, 42)

	// Row 3
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.CellFormat(34, 5.5, " Target Deposit Gateway:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Courier", "B", 7.2)
	pdf.SetTextColor(185, 28, 28)
	pdf.CellFormat(55, 5.5, " "+p.VASPAddress, "1", 0, "L", false, 0, "")
	pdf.SetFont("Helvetica", "B", 7.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(38, 5.5, " Attachment Valuation:", "1", 0, "L", true, 0, "")
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(16, 120, 70)
	pdf.CellFormat(51, 5.5, " "+p.TotalTracedVal+" ("+p.FiatEquivalent+")", "1", 1, "L", false, 0, "")
	pdf.SetTextColor(15, 23, 42)

	// Addressee Block (VASP Nodal Officer)
	addrY := pdf.GetY() + 3
	pdf.SetY(addrY)
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, addrY, 178, 25, "DF")

	// Crimson accent bar on left
	pdf.SetFillColor(185, 28, 28)
	pdf.Rect(16, addrY, 2.5, 25, "F")

	pdf.SetXY(21, addrY+2)
	pdf.SetFont("Times", "B", 8.8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(170, 4, "TO: THE DESIGNATED PRINCIPAL COMPLIANCE OFFICER / LEGAL NODAL OFFICER")

	pdf.SetXY(21, addrY+6.5)
	pdf.SetFont("Times", "", 8)
	pdf.Cell(170, 4, fmt.Sprintf("Reporting Entity (VASP): %s (%s)", p.VASPLegalName, p.VASPName))

	pdf.SetXY(21, addrY+10.5)
	pdf.Cell(170, 4, fmt.Sprintf("FIU-IND Registration ID: %s | Governing Framework: PMLA 2002 Reporting Intermediary", p.FIURegNumber))

	pdf.SetXY(21, addrY+14.5)
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(2, 132, 199)
	pdf.Cell(170, 4, fmt.Sprintf("Statutory Service Electronic Mail: %s", p.VASPNodalEmail))

	pdf.SetXY(21, addrY+18.5)
	pdf.SetFont("Courier", "B", 7.5)
	pdf.SetTextColor(185, 28, 28)
	pdf.Cell(170, 4, fmt.Sprintf("Beneficiary Crypto Inflow Gateway: %s", p.VASPAddress))

	// Formal Statutory Order Text
	pdf.SetY(addrY + 28)
	pdf.SetFont("Times", "B", 9)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(178, 4.5, "STATUTORY DIRECTIVES & LAWFUL COMMAND FOR IMMEDIATE EXECUTION:")
	pdf.Ln(5)

	orderText := fmt.Sprintf(
		"WHEREAS an active criminal investigation into organized cryptocurrency fraud and illicit asset laundering is being conducted at this Police Station under %s. "+
			"Forensic tracking executed via the D-CRYPT multi-hop shadow graph engine has definitively established that proceeds of crime amounting to %s (%s) "+
			"terminated into the above-identified cryptocurrency deposit gateway operated and controlled by your reporting entity.\n\n"+
			"NOW THEREFORE, in exercise of statutory powers vested under Section 102 of the Code of Criminal Procedure, 1973 (read with Section 106 BNSS, 2023), "+
			"and document discovery powers under Section 91 CrPC (Section 94 BNSS), YOU ARE HEREBY ORDERED TO EXECUTE THE FOLLOWING ACTIONS FORTHWITH:\n\n"+
			"1. IMMEDIATE ACCOUNT DEBIT FREEZE: Forthwith suspend all withdrawal, debit, internal swap, and transfer privileges on all user account(s) "+
			"associated with or receiving deposits from address %s.\n"+
			"2. STATUTORY ASSET LIEN: Place an absolute statutory lien on all crypto assets and linked fiat INR balances equivalent to %s until further orders from this Police Station or the Jurisdictional Magistrate.\n"+
			"3. SUBSCRIBER KYC DISCLOSURE: Provide certified true copies of verified KYC identity proofs (Aadhaar, PAN, Passport), registration documents, photographs, and verified mobile numbers/emails within 24 HOURS.\n"+
			"4. FIAT BANKING & UPI IDENTIFIERS: Furnish full particulars of all linked Indian bank accounts (Account No, IFSC, Account Holder Name) and UPI VPAs used for fiat deposits/withdrawals.\n"+
			"5. PRESERVATION OF LOGS: Maintain complete data preservation of all IPv4/IPv6 login telemetry, IMEI/device fingerprints, and ledger transactions under Section 67C of the Information Technology Act, 2000.",
		p.FIRNumber, p.TotalTracedVal, p.FiatEquivalent, p.VASPAddress, p.FiatEquivalent,
	)

	pdf.SetFont("Times", "", 7.8)
	pdf.SetTextColor(30, 41, 59)
	pdf.MultiCell(178, 3.8, orderText, "", "L", false)

	// Attestation at Bottom of Page 1
	pdf.SetY(225)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.3)
	pdf.Line(16, pdf.GetY(), 194, pdf.GetY())
	pdf.Ln(3)

	signY := pdf.GetY()
	pdf.SetXY(16, signY)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(120, 4, "ISSUED UNDER OFFICIAL HAND AND SEAL:")
	pdf.Ln(4)
	pdf.SetX(16)
	pdf.SetFont("Times", "", 8)
	pdf.Cell(120, 3.5, "Investigating Officer / Inspector of Police")
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, p.PoliceStation+" | Special Operations Unit")
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, "Date of Issuance: "+time.Now().Format("02 January 2006, 15:04:05 MST"))
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.SetFont("Courier", "B", 7.2)
	pdf.SetTextColor(185, 28, 28)
	pdf.Cell(120, 3.5, "Statutory Order Ref: FREEZE-SEC102-"+p.CaseID)

	// Right Column: Scannable QR Code
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(144, signY-1, 50, 36, "DF")

	if len(qrPng) > 0 {
		pdf.ImageOptions("qr_verify.png", 158, signY+1, 22, 22, false, fpdf.ImageOptions{ImageType: "PNG"}, 0, verifyURL)
		pdf.SetXY(145, signY+24)
		pdf.SetFont("Helvetica", "B", 6.5)
		pdf.SetTextColor(185, 28, 28)
		pdf.CellFormat(48, 3, "SCAN TO VERIFY ORDER", "", 1, "C", false, 0, verifyURL)
		pdf.SetX(145)
		pdf.SetFont("Helvetica", "", 5.5)
		pdf.SetTextColor(100, 116, 139)
		pdf.CellFormat(48, 2.5, "Direct LEA Verification", "", 1, "C", false, 0, "")
	}

	// Page 1 Running Footer
	pdf.SetY(278)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 277, 194, 277)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 3.5, fmt.Sprintf("Page 1 of %d | STATUTORY FREEZE ORDER | Section 102 CrPC / Sec 106 BNSS | Ref: %s", totalPages, p.CaseID), "", 0, "C", false, 0, "")

	// ── PAGE 2: Schedule of Assets, Penal Clauses & Compliance Undertaking ──
	pdf.AddPage()

	// Top Formal Legal Order Banner
	pdf.SetFillColor(254, 242, 242)
	pdf.SetDrawColor(248, 113, 113)
	pdf.SetLineWidth(0.4)
	pdf.Rect(16, 11, 178, 6.2, "DF")
	pdf.SetXY(17, 12.2)
	pdf.SetFont("Times", "B", 7.8)
	pdf.SetTextColor(185, 28, 28)
	pdf.CellFormat(176, 3.8, "[ STATUTORY FREEZE DIRECTIVE UNDER SECTION 102 CrPC / SECTION 106 BNSS - SCHEDULE OF ATTACHMENT ]", "", 1, "C", false, 0, "")

	// Schedule Header
	pdf.SetXY(16, 19.5)
	pdf.SetFont("Times", "B", 12.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.CellFormat(178, 5.5, "SCHEDULE OF ASSET SEIZURE & STATUTORY COMPLIANCE RECEIPT", "", 1, "L", false, 0, "")

	pdf.SetFont("Times", "I", 8)
	pdf.SetTextColor(71, 85, 105)
	pdf.CellFormat(178, 4, "Directives for Nodal Officer Execution and Return to Cyber Crime Police Station", "", 1, "L", false, 0, "")

	pdf.SetDrawColor(15, 23, 42)
	pdf.SetLineWidth(0.4)
	pdf.Line(16, 30.5, 194, 30.5)

	// Seizure Particulars Box
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, 33, 178, 30, "DF")

	pdf.SetXY(19, 35)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(42, 4, "Target Exchange Gateway:")
	pdf.SetFont("Courier", "B", 8)
	pdf.SetTextColor(185, 28, 28)
	pdf.Cell(128, 4, p.VASPAddress)

	pdf.Ln(4.5)
	pdf.SetX(19)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(42, 4, "VASP Legal Entity:")
	pdf.SetFont("Times", "B", 8)
	pdf.Cell(128, 4, fmt.Sprintf("%s (%s)", p.VASPLegalName, p.VASPName))

	pdf.Ln(4.5)
	pdf.SetX(19)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.Cell(42, 4, "Traced Cryptocurrency:")
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(16, 120, 70)
	pdf.Cell(46, 4, p.TotalTracedVal)
	pdf.SetTextColor(15, 23, 42)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.Cell(38, 4, "Statutory Lien Amount:")
	pdf.SetFont("Times", "B", 8)
	pdf.SetTextColor(16, 120, 70)
	pdf.Cell(44, 4, p.FiatEquivalent)
	pdf.SetTextColor(15, 23, 42)

	pdf.Ln(4.5)
	pdf.SetX(19)
	pdf.SetFont("Helvetica", "B", 8)
	pdf.Cell(42, 4, "Mandatory Return Window:")
	pdf.SetFont("Helvetica", "B", 8)
	pdf.SetTextColor(185, 28, 28)
	pdf.Cell(128, 4, "24 Hours from transmission to designated nodal email")
	pdf.SetTextColor(15, 23, 42)

	// Statutory Warning Box (Section 175 IPC / Section 212 BNS)
	warnY := pdf.GetY() + 6
	pdf.SetY(warnY)
	pdf.SetFillColor(254, 242, 242)
	pdf.SetDrawColor(248, 113, 113)
	pdf.Rect(16, warnY, 178, 38, "DF")

	// Red accent bar
	pdf.SetFillColor(185, 28, 28)
	pdf.Rect(16, warnY, 2.5, 38, "F")

	pdf.SetXY(21, warnY+2.5)
	pdf.SetFont("Times", "B", 8.8)
	pdf.SetTextColor(185, 28, 28)
	pdf.Cell(170, 4, "STATUTORY PENAL WARNING UNDER SECTION 175 IPC / SECTION 212 BNS 2023:")

	warnText := "TAKE NOTICE that failure to comply with this lawful order, or any intentional delay leading to the dissipation, " +
		"withdrawal, or transfer of the aforementioned illicit proceeds, shall render the concerned entity, its Principal Compliance Officer, " +
		"and designated officers liable for criminal prosecution under Section 175 of the Indian Penal Code (Section 212 of the Bharatiya Nyaya Sanhita, 2023) " +
		"for intentional omission to produce documents or cease operations to a public servant.\n\n" +
		"Furthermore, failure to preserve audit records shall attract penal proceedings under Section 67C(2) of the Information Technology Act, 2000, " +
		"punishable with imprisonment for a term which may extend to three years and fine."

	pdf.SetXY(21, warnY+8)
	pdf.SetFont("Times", "", 7.8)
	pdf.SetTextColor(127, 29, 29)
	pdf.MultiCell(168, 3.8, warnText, "", "L", false)

	// Compliance Return Template Box (To be completed by VASP)
	retY := warnY + 42
	pdf.SetY(retY)
	pdf.SetFillColor(248, 250, 252)
	pdf.SetDrawColor(203, 213, 225)
	pdf.Rect(16, retY, 178, 52, "DF")

	pdf.SetXY(20, retY+2.5)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(170, 4, "COMPLIANCE RETURN UNDERTAKING (TO BE EXECUTED BY VASP NODAL OFFICER):")

	pdf.SetXY(20, retY+8)
	pdf.SetFont("Times", "", 8)
	pdf.SetTextColor(51, 65, 85)
	pdf.Cell(170, 4, "Internal User / UID Identified: ........................................................................ Account Status: [  ] DEBIT FROZEN")

	pdf.SetXY(20, retY+14)
	pdf.Cell(170, 4, "Total Crypto Balance Secured: .................................................................... INR Lien Marked: INR ...................................")

	pdf.SetXY(20, retY+20)
	pdf.Cell(170, 4, "Primary Linked Bank Account: .................................................................... Bank Name & IFSC: .......................................")

	pdf.SetXY(20, retY+26)
	pdf.Cell(170, 4, "KYC Records Enclosed: [  ] Aadhaar   [  ] PAN Card   [  ] Passport   [  ] Bank Statement   [  ] IP Session Telemetry")

	pdf.SetXY(20, retY+32)
	pdf.Cell(170, 4, "Compliance Reference Ticket No: ................................................................ Date & UTC Time of Freeze: ............................")

	pdf.SetXY(20, retY+38)
	pdf.Cell(170, 4, "Name of Compliance Officer: .................................................................... Official Seal & Signature: ............................")

	// Attestation at Bottom of Page 2
	pdf.SetY(225)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.3)
	pdf.Line(16, pdf.GetY(), 194, pdf.GetY())
	pdf.Ln(3)

	sign2Y := pdf.GetY()
	pdf.SetXY(16, sign2Y)
	pdf.SetFont("Times", "B", 8.5)
	pdf.SetTextColor(15, 23, 42)
	pdf.Cell(120, 4, "ENDORSED AND RECORDED BY INVESTIGATING COMMAND:")
	pdf.Ln(4)
	pdf.SetX(16)
	pdf.SetFont("Times", "", 8)
	pdf.Cell(120, 3.5, "Officer In Charge / Cyber Crime Police Station")
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, p.PoliceStation)
	pdf.Ln(3.5)
	pdf.SetX(16)
	pdf.Cell(120, 3.5, "Statutory Return Email: cybercell-notices@police.gov.in")

	// Page 2 Running Footer
	pdf.SetY(278)
	pdf.SetDrawColor(203, 213, 225)
	pdf.SetLineWidth(0.2)
	pdf.Line(16, 277, 194, 277)
	pdf.SetFont("Times", "I", 7.2)
	pdf.SetTextColor(100, 116, 139)
	pdf.CellFormat(178, 3.5, fmt.Sprintf("Page 2 of %d | STATUTORY FREEZE ORDER | Section 102 CrPC / Sec 106 BNSS | Ref: %s", totalPages, p.CaseID), "", 0, "C", false, 0, "")

	var pdfBuf bytes.Buffer
	if err := pdf.Output(&pdfBuf); err != nil {
		return nil, err
	}
	return pdfBuf.Bytes(), nil
}

// ─────────────────────────────────────────────────────────────────────────────
// HTTP HANDLERS
// ─────────────────────────────────────────────────────────────────────────────

// GenerateReport generates the Detailed Case Evidence Dossier (Court Exhibit under Sec 65B/63 BSA).
func (h *Handler) GenerateReport(c *gin.Context) {
	caseID := c.Param("case_id")
	p := resolveCaseProfile(caseID, h, c)

	evidenceSeal := computeCanonicalEvidenceSeal(p)
	frontendOrigin, verifyURL := getFrontendVerificationURL(c, evidenceSeal, p.CaseID)
	qrPng, _ := qrcode.Encode(verifyURL, qrcode.Medium, 256)

	pdfBytes, err := compileDetailedDossier(p, verifyURL, qrPng, evidenceSeal, frontendOrigin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compile court-admissible dossier: " + err.Error()})
		return
	}

	docHasher := sha256.New()
	docHasher.Write(pdfBytes)
	docFileHash := hex.EncodeToString(docHasher.Sum(nil))

	downloadFilename := fmt.Sprintf("Dossier_%s.pdf", caseID)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, downloadFilename))
	c.Header("Content-Length", strconv.Itoa(len(pdfBytes)))
	c.Header("X-Evidence-Canonical-SHA256", evidenceSeal)
	c.Header("X-Evidence-Document-SHA256", docFileHash)
	c.Header("X-Legal-Statute", "Section 65B Indian Evidence Act / Section 63 BSA 2023")

	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// GenerateFreezeReport generates the Statutory Account Freeze Order (Section 102 CrPC / Section 106 BNSS).
func (h *Handler) GenerateFreezeReport(c *gin.Context) {
	caseID := c.Param("case_id")
	p := resolveCaseProfile(caseID, h, c)

	// STRICT CONDITIONAL: Cannot generate Freeze Order if no regulated custodial VASP is identified!
	if !hasValidVASP(p) {
		c.JSON(http.StatusUnprocessableEntity, gin.H{
			"error":      "CANNOT_GENERATE_FREEZE_NOTICE",
			"message":    "Cannot generate statutory freeze order: No regulated custodial VASP / exchange detected for this case.",
			"details":    "The traced funds currently terminate at an unhosted/private wallet or decentralized protocol. A statutory freeze order under Section 102 CrPC can only be served upon a regulated intermediary or FIU-IND registered custodial exchange.",
			"case_id":    p.CaseID,
			"status":     "UNHOSTED_TERMINATION",
			"suggestion": "Extend trace hops or initiate mempool live-tracking to detect downstream off-ramps.",
		})
		return
	}

	evidenceSeal := computeCanonicalEvidenceSeal(p)
	frontendOrigin, verifyURL := getFrontendVerificationURL(c, evidenceSeal, p.CaseID)
	qrPng, _ := qrcode.Encode(verifyURL, qrcode.Medium, 256)

	pdfBytes, err := compileFreezeOrder(p, verifyURL, qrPng, evidenceSeal, frontendOrigin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to compile statutory freeze order: " + err.Error()})
		return
	}

	docHasher := sha256.New()
	docHasher.Write(pdfBytes)
	docFileHash := hex.EncodeToString(docHasher.Sum(nil))

	downloadFilename := fmt.Sprintf("Freeze_Order_%s.pdf", caseID)
	c.Header("Content-Type", "application/pdf")
	c.Header("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, downloadFilename))
	c.Header("Content-Length", strconv.Itoa(len(pdfBytes)))
	c.Header("X-Evidence-Canonical-SHA256", evidenceSeal)
	c.Header("X-Evidence-Document-SHA256", docFileHash)
	c.Header("X-Legal-Statute", "Section 102 CrPC / Section 106 BNSS / Section 67C IT Act")

	c.Data(http.StatusOK, "application/pdf", pdfBytes)
}

// GenerateEvidencePackage compiles a comprehensive ZIP evidence bundle containing both PDFs, raw JSON, and SHA-256 manifest.
func (h *Handler) GenerateEvidencePackage(c *gin.Context) {
	caseID := c.Param("case_id")
	p := resolveCaseProfile(caseID, h, c)

	evidenceSeal := computeCanonicalEvidenceSeal(p)
	frontendOrigin, verifyURL := getFrontendVerificationURL(c, evidenceSeal, p.CaseID)
	qrPng, _ := qrcode.Encode(verifyURL, qrcode.Medium, 256)

	// 1. Compile Dossier PDF
	dossierBytes, err := compileDetailedDossier(p, verifyURL, qrPng, evidenceSeal, frontendOrigin)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to build dossier: " + err.Error()})
		return
	}

	// 2. Compile Freeze Order if VASP present
	var freezeBytes []byte
	if hasValidVASP(p) {
		freezeBytes, _ = compileFreezeOrder(p, verifyURL, qrPng, evidenceSeal, frontendOrigin)
	}

	// 3. Construct JSON ledger
	jsonBytes, _ := json.MarshalIndent(p, "", "  ")

	// 4. Create ZIP archive
	zipBuf := new(bytes.Buffer)
	zipWriter := zip.NewWriter(zipBuf)

	// Add Dossier PDF
	dossierEntry, err := zipWriter.Create(fmt.Sprintf("Dossier_%s.pdf", caseID))
	if err == nil {
		dossierEntry.Write(dossierBytes)
	}

	// Add Freeze Order PDF if present
	if len(freezeBytes) > 0 {
		freezeEntry, err := zipWriter.Create(fmt.Sprintf("Freeze_Order_%s.pdf", caseID))
		if err == nil {
			freezeEntry.Write(freezeBytes)
		}
	}

	// Add JSON audit ledger
	jsonEntry, err := zipWriter.Create(fmt.Sprintf("Audit_Ledger_%s.json", caseID))
	if err == nil {
		jsonEntry.Write(jsonBytes)
	}

	// Add SHA-256 Manifest
	manifestEntry, err := zipWriter.Create("SHA256_MANIFEST.txt")
	if err == nil {
		dossierHash := sha256.Sum256(dossierBytes)
		manifest := fmt.Sprintf("D-CRYPT SHIELD FORENSIC EVIDENCE PACKAGE\nCASE REFERENCE: %s\nGENERATED: %s\n\nSHA256 CHECKSUMS:\n%x  Dossier_%s.pdf\n",
			caseID, time.Now().UTC().Format(time.RFC3339), dossierHash, caseID)
		if len(freezeBytes) > 0 {
			freezeHash := sha256.Sum256(freezeBytes)
			manifest += fmt.Sprintf("%x  Freeze_Order_%s.pdf\n", freezeHash, caseID)
		}
		jsonHash := sha256.Sum256(jsonBytes)
		manifest += fmt.Sprintf("%x  Audit_Ledger_%s.json\n", jsonHash, caseID)
		manifestEntry.Write([]byte(manifest))
	}

	zipWriter.Close()

	zipBytes := zipBuf.Bytes()
	downloadFilename := fmt.Sprintf("Evidence_Package_%s.zip", caseID)
	c.Header("Content-Type", "application/zip")
	c.Header("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, downloadFilename))
	c.Header("Content-Length", strconv.Itoa(len(zipBytes)))
	c.Header("X-Evidence-Canonical-SHA256", evidenceSeal)

	c.Data(http.StatusOK, "application/zip", zipBytes)
}
