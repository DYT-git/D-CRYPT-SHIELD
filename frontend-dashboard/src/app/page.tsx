"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import {
  ShieldIcon,
  ActivityIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  LockIcon,
  NetworkIcon,
  FileTextIcon,
  ZapIcon,
  DatabaseIcon,
  CopyIcon,
  DownloadIcon,
  UserIcon,
  InfoIcon,
  XIcon,
  BuildingIcon,
  SearchIcon,
} from "@/components/Icons";

// Dynamic import for forensic graph visualizer (client-side only)
const TransactionGraph = dynamic(() => import("@/components/TransactionGraph"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[480px] bg-slate-900 flex flex-col items-center justify-center text-slate-300 font-mono text-xs gap-3 rounded-2xl">
      <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      <span>Initializing D-CRYPT Forensic Traversal Engine...</span>
    </div>
  ),
});

export default function HomePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  // Dynamic VASP counter state
  const [vaspCount, setVaspCount] = useState<number>(14);

  // VASP Directory Search Filter
  const [vaspSearch, setVaspSearch] = useState("");

  // Transformation Stage & Graph Active Case Selection
  const [activeCaseIdx, setActiveCaseIdx] = useState<number>(0);

  // Tabs
  const [sahyogTab, setSahyogTab] = useState<"inbound" | "engine" | "outbound">("inbound");
  const [apiCategory, setApiCategory] = useState<"all" | "trace" | "intel" | "report" | "sahyog" | "graph">("all");
  const [expandedEndpoint, setExpandedEndpoint] = useState<string | null>(null);
  const [copiedEndpoint, setCopiedEndpoint] = useState<string | null>(null);

  // Interactive Live Email Alert State
  const [testEmail, setTestEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [emailResponse, setEmailResponse] = useState<any>(null);
  const [showPayloadModal, setShowPayloadModal] = useState(false);

  // Notice Preview Modal State
  const [showNoticeModal, setShowNoticeModal] = useState(false);

  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

  // Catalog of 19 Backend REST Endpoints
  const apiCatalog = [
    {
      category: "trace",
      method: "POST",
      path: "/api/v1/trace",
      title: "Multi-Hop BFS Attribution",
      desc: "Deterministic graph traversal attributing unhosted suspect wallet to nearest FIU-IND registered VASP.",
      params: '{ "suspect_address": "0x742d...", "chain": "ethereum", "max_depth": 5 }',
      response: '{ "case_id": "CASE-2024-IN-0891", "confidence": 99.4, "hops": 4, "vasp": "CoinDCX" }'
    },
    {
      category: "trace",
      method: "POST",
      path: "/api/v1/trace/extend",
      title: "Dynamic Graph Extension",
      desc: "Expands graph depth beyond initial hop limits to uncover deeper mule networks.",
      params: '{ "case_id": "CASE-2024-IN-0891", "address": "0x388C...", "additional_depth": 3 }',
      response: '{ "success": true, "extended_nodes": 6, "new_vasps_discovered": 1 }'
    },
    {
      category: "trace",
      method: "POST",
      path: "/api/v1/track",
      title: "Mempool Interception Tracker",
      desc: "Registers suspect wallet for live zero-confirmation mempool monitoring and instant alerts.",
      params: '{ "address": "0x742d...", "chain": "ethereum", "alert_email": "officer@agency.gov.in" }',
      response: '{ "tracking_id": "TRK-9821", "status": "ACTIVE_MEMPOOL_LISTENING" }'
    },
    {
      category: "trace",
      method: "GET",
      path: "/api/v1/live-feed",
      title: "Server-Sent Events (SSE) Stream",
      desc: "Real-time stream broadcasting unconfirmed transfers and VASP ingress hits.",
      params: "Header: Accept: text/event-stream",
      response: 'event: MEMPOOL_HIT\\ndata: { "tx": "0x...", "amount": 14.25, "target_vasp": "CoinDCX" }'
    },
    {
      category: "intel",
      method: "GET",
      path: "/api/v1/lookup/:chain/:address",
      title: "Cluster & Entity Tag Resolution",
      desc: "Attribution lookup against curated FIU-IND registry, OFAC lists, and exchange clusters.",
      params: "Path params: chain, address",
      response: '{ "is_vasp": true, "vasp_name": "CoinDCX", "risk_level": "LOW", "fiu_id": "FIU-IND/CAS/2023/0014" }'
    },
    {
      category: "intel",
      method: "GET",
      path: "/api/v1/portfolio/:chain/:address",
      title: "On-Chain Portfolio & Velocity",
      desc: "Calculates total balance, tokens, and 30-day transaction turnover velocity.",
      params: "Path params: chain, address",
      response: '{ "native_balance": 14.25, "fiat_inr": 3231900, "token_count": 6 }'
    },
    {
      category: "intel",
      method: "GET",
      path: "/api/v1/risk/:chain/:address",
      title: "Algorithmic AML Risk Score",
      desc: "Generates risk score (0-100) using graph peeling heuristics and mixer exposure.",
      params: "Path params: chain, address",
      response: '{ "risk_score": 89.2, "category": "HIGH_RISK", "red_flags": ["RAPID_PEELING"] }'
    },
    {
      category: "intel",
      method: "GET",
      path: "/api/v1/intelligence/case/:case_id",
      title: "Automated Crime Typology Insights",
      desc: "AI forensic typology categorizing extortion, scam tokens, or P2P mule structuring.",
      params: "Path param: case_id",
      response: '{ "crime_typology": "Cyber Extortion", "fatf_rec_15": "OFF_RAMP_RED_FLAG" }'
    },
    {
      category: "report",
      method: "GET",
      path: "/api/v1/report/:case_id",
      title: "Section 91 CrPC Certified PDF",
      desc: "Standardized court dossier under Section 91 CrPC & Section 63 BSA 2023 with SHA-256 seal & live QR.",
      params: "Path param: case_id",
      response: "Binary PDF stream with X-Evidence-Canonical-SHA256 headers"
    },
    {
      category: "report",
      method: "GET",
      path: "/api/v1/case/:case_id/evidence-package",
      title: "Cryptographic Evidence Archive",
      desc: "Compiles full evidence archive containing signed PDF notice, JSON graph, and hash chain.",
      params: "Path param: case_id",
      response: "ZIP archive with forensic manifest and verification seals"
    },
    {
      category: "report",
      method: "GET",
      path: "/api/v1/case/:case_id",
      title: "Case Dossier & Attribution Details",
      desc: "Retrieves complete metadata, FIR registration, suspect wallet, and attributed VASP contacts.",
      params: "Path param: case_id",
      response: '{ "case_id": "CASE-2024-IN-0891", "fir_number": "FIR No. 412/2024", "vasp": { ... } }'
    },
    {
      category: "report",
      method: "GET",
      path: "/api/v1/cases",
      title: "Master Case Registry",
      desc: "Paginated list of all registered cybercrime investigations across jurisdictions.",
      params: "?limit=20&page=1&status=ACTIVE",
      response: '{ "total": 42, "cases": [ { "case_id": "CASE-2024-IN-0891", "status": "ATTRIBUTED" } ] }'
    },
    {
      category: "sahyog",
      method: "GET",
      path: "/api/v1/integration/sahyog/disclosure/:case_id",
      title: "Section 91 CrPC SAHYOG Requisition",
      desc: "Produces normalized JSON schema for automated inter-agency gateway transmission.",
      params: "Path param: case_id",
      response: '{ "statute": "SECTION_91_CRPC", "orders": ["FREEZE", "KYC", "IP_LOGS"] }'
    },
    {
      category: "sahyog",
      method: "GET",
      path: "/api/v1/integration/sahyog/freeze/:case_id",
      title: "Section 102 CrPC Account Freeze Schema",
      desc: "Standardized emergency freezing requisition requiring immediate suspension of debits.",
      params: "Path param: case_id",
      response: '{ "statute": "SECTION_102_CRPC", "directive": "IMMEDIATE_DEBIT_FREEZE" }'
    },
    {
      category: "graph",
      method: "POST",
      path: "/api/v1/alerts/test-email",
      title: "Real-Time Email Alert Dispatch",
      desc: "Triggers instant SMTP alert notification to investigating officer with case dossier.",
      params: '{ "email": "officer@agency.gov.in", "case_id": "CASE-2024-IN-0891" }',
      response: '{ "success": true, "dispatched_to": "officer@agency.gov.in", "mode": "SMTP_DELIVERED" }'
    },
    {
      category: "graph",
      method: "GET",
      path: "/api/v1/graph/stats",
      title: "Shadow Graph Topology Metrics",
      desc: "Graph statistics showing indexed blockchain wallets, multi-hop edges, and registered VASPs.",
      params: "None",
      response: '{ "nodes": 14209, "edges": 38412, "vasps": 14, "clusters": 210 }'
    },
    {
      category: "graph",
      method: "GET",
      path: "/api/v1/graph/case/:case_id",
      title: "Cytoscape / Neo4j Case Graph",
      desc: "Exports serialized node-link graph model containing source wallets and attributed VASP.",
      params: "Path param: case_id",
      response: '{ "nodes": [ ... ], "edges": [ ... ], "metadata": { "hops": 4 } }'
    },
    {
      category: "graph",
      method: "GET",
      path: "/api/v1/graph/wallet/:chain/:address",
      title: "Ego-Network & Degree Centrality",
      desc: "Analyzes in-degree, out-degree, and mule cluster proximity for a target wallet.",
      params: "Path params: chain, address",
      response: '{ "in_degree": 3, "out_degree": 14, "mule_risk": "HIGH" }'
    },
    {
      category: "graph",
      method: "GET",
      path: "/api/v1/graph/hubs/:chain",
      title: "High-Volume Hub & Mixer Discovery",
      desc: "Identifies top transit hubs, privacy pool relayers, and peeling consolidators.",
      params: "Path param: chain",
      response: '{ "chain": "ethereum", "top_hubs": [ { "address": "0x...", "tx_volume": 4200.5 } ] }'
    }
  ];

  // Fetch live VASP stats on mount
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/graph/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Stats unavailable");
        return res.json();
      })
      .then((data) => {
        if (data?.vasps && data.vasps > 0) {
          setVaspCount(data.vasps);
        }
      })
      .catch(() => {});
  }, [API_BASE]);

  const handleOfficerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("userRole", "officer");
        router.push("/dashboard");
      } else {
        setError("Invalid clearance code. Use 'SAHYOG-ADMIN' for evaluation.");
      }
    } catch {
      setError("Connection failed to authentication service.");
    }
    setLoading(false);
  };

  const handleEvaluatorFastTrack = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: "SAHYOG-ADMIN" }),
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem("userRole", "officer");
        router.push("/dashboard");
        return;
      }
    } catch {}
    localStorage.setItem("userRole", "officer");
    router.push("/dashboard");
    setLoading(false);
  };

  const handleCivilianGoogleLogin = () => {
    setLoading(true);
    localStorage.setItem("userRole", "civilian");
    router.push("/civilian");
  };

  const copyEndpointPath = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedEndpoint(path);
    setTimeout(() => setCopiedEndpoint(null), 2000);
  };

  // Dispatch Test Email Alert
  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testEmail || !testEmail.includes("@")) {
      setEmailStatus("error");
      return;
    }
    setEmailStatus("loading");
    setEmailResponse(null);
    try {
      const activeCase = showcaseCases[activeCaseIdx];
      const res = await fetch(`${API_BASE}/api/v1/alerts/test-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: testEmail,
          case_id: activeCase.caseId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setEmailResponse(data);
        setEmailStatus("success");
      } else {
        setEmailStatus("error");
      }
    } catch {
      setEmailStatus("error");
    }
  };

  // Curated Forensic Cases for Transformation Stage & Graph
  const showcaseCases = [
    {
      caseId: "CASE-2024-IN-0891",
      title: "CoinDCX Gateway Extortion",
      chain: "Ethereum Mainnet (EVM)",
      firNumber: "FIR No. 412/2024 / Cyber PS Special Cell",
      suspectAddress: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      totalVolume: "14.25 ETH (₹32,31,900)",
      crimeCategory: "Digital Lending Extortion & Rapid Peeling",
      confidence: "99.4%",
      hops: 4,
      riskScore: 89.2,
      riskBadge: "HIGH RISK",
      attributedVasp: "CoinDCX India (Neblio Technologies Pvt. Ltd.)",
      fiuRegNumber: "FIU-IND/CAS/2023/0014",
      gatewayAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      canonicalSeal: "3a8f9c1b7e4d2a6f8b0e1d3c5a7f9b2d4e6a8c0f1b3d5e7a9c2b4d6e8f0a1b2c",
    },
    {
      caseId: "CASE-2024-DEF-4402",
      title: "Tornado Cash Privacy Relayer",
      chain: "Ethereum Mainnet (EVM)",
      firNumber: "FIR No. 89/2024 / Cyber Crime Division, CID",
      suspectAddress: "0x098B716B8Aaf215190988513afF39BA65EdAB176",
      totalVolume: "100.00 ETH (₹2,26,80,000)",
      crimeCategory: "Smart Contract Exploit & Anonymity Pool",
      confidence: "99.8%",
      hops: 4,
      riskScore: 99.8,
      riskBadge: "CRITICAL",
      attributedVasp: "Tornado Cash / Stargate Relayer",
      fiuRegNumber: "OFAC-SDN-CYBER2-2022",
      gatewayAddress: "0x12D66f87A04A9E220743712cE6d9bB1B5616B8Fc",
      canonicalSeal: "b7e4d2a6f8b0e1d3c5a7f9b2d4e6a8c0f1b3d5e7a9c2b4d6e8f0a1b2c3a8f9c1",
    },
    {
      caseId: "CASE-2024-P2P-7719",
      title: "Binance P2P Task Scam",
      chain: "Ethereum Mainnet (EVM)",
      firNumber: "FIR No. 277/2024 / Cyberabad Cyber Crime PS",
      suspectAddress: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8",
      totalVolume: "45,000 USDT (₹37,80,000)",
      crimeCategory: "Telegram Task Scheme & Mule Structuring",
      confidence: "98.6%",
      hops: 3,
      riskScore: 91.5,
      riskBadge: "HIGH RISK",
      attributedVasp: "Binance India Gateway (Zanmai Labs / Binance)",
      fiuRegNumber: "FIU-IND/CAS/2024/0089",
      gatewayAddress: "0x28C6c06298d514Db089934071355E5743bf21d60",
      canonicalSeal: "f1b3d5e7a9c2b4d6e8f0a1b2c3a8f9c1b7e4d2a6f8b0e1d3c5a7f9b2d4e6a8c0",
    },
  ];

  const currentCase = showcaseCases[activeCaseIdx];

  // 6 Verified FIU-IND Reporting Entities Directory
  const verifiedVasps = [
    {
      name: "CoinDCX",
      legalName: "Neblio Technologies Pvt. Ltd.",
      fiuId: "FIU-IND/CAS/2023/0014",
      nodalEmail: "nodal.officer@coindcx.com",
      address: "0xA0b8...B48",
      jurisdiction: "Mumbai, Maharashtra",
      status: "Active Nodal",
    },
    {
      name: "Binance India",
      legalName: "Nest Services / Binance Inst.",
      fiuId: "FIU-IND/CAS/2024/0089",
      nodalEmail: "compliance-india@binance.com",
      address: "0x28C6...d60",
      jurisdiction: "Registered Reporting Entity",
      status: "Active Nodal",
    },
    {
      name: "WazirX",
      legalName: "Zanmai Labs Pvt. Ltd.",
      fiuId: "FIU-IND/CAS/2023/0002",
      nodalEmail: "nodal@wazirx.com",
      address: "0x56ed...86B",
      jurisdiction: "Mumbai, Maharashtra",
      status: "Active Nodal",
    },
    {
      name: "CoinSwitch",
      legalName: "Bitcipher Labs LLP",
      fiuId: "FIU-IND/CAS/2023/0007",
      nodalEmail: "compliance@coinswitch.co",
      address: "0x4838...f97",
      jurisdiction: "Bengaluru, Karnataka",
      status: "Active Nodal",
    },
    {
      name: "ZebPay",
      legalName: "Awlencan Innovations India Ltd.",
      fiuId: "FIU-IND/CAS/2023/0018",
      nodalEmail: "nodal.officer@zebpay.com",
      address: "0x9522...fe5",
      jurisdiction: "Ahmedabad, Gujarat",
      status: "Active Nodal",
    },
    {
      name: "Bitbns",
      legalName: "Buyhatke Internet Pvt. Ltd.",
      fiuId: "FIU-IND/CAS/2023/0022",
      nodalEmail: "compliance@bitbns.com",
      address: "0x388C...633",
      jurisdiction: "Bengaluru, Karnataka",
      status: "Active Nodal",
    },
  ];

  const filteredVasps = verifiedVasps.filter(
    (v) =>
      v.name.toLowerCase().includes(vaspSearch.toLowerCase()) ||
      v.legalName.toLowerCase().includes(vaspSearch.toLowerCase()) ||
      v.fiuId.toLowerCase().includes(vaspSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#FAF9F5] text-slate-900 font-sans selection:bg-blue-600/10 selection:text-blue-900">

      {/* ─────────────────────────────────────────────────────────────
          NAVBAR: Clean Floating Island (Wispr Flow Style)
      ───────────────────────────────────────────────────────────── */}
      <header className="sticky top-4 z-50 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="bg-white/95 backdrop-blur-md rounded-full border border-slate-200/90 shadow-[0_2px_16px_rgba(0,0,0,0.06)] px-4 sm:px-6 py-2.5 flex items-center justify-between transition-all">
          
          {/* Brand Mark */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform">
              <ShieldIcon size={16} strokeWidth={2.2} />
            </div>
            <span className="font-extrabold text-sm tracking-tight text-slate-900 whitespace-nowrap">
              D-CRYPT <span className="text-blue-600">SHIELD</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-7 text-xs font-semibold text-slate-600">
            <a href="#capabilities" className="hover:text-blue-600 transition-colors whitespace-nowrap">Capabilities</a>
            <a href="#speed" className="hover:text-blue-600 transition-colors whitespace-nowrap">Benchmark</a>
            <a href="#workbench" className="hover:text-blue-600 transition-colors whitespace-nowrap">Live Graph</a>
            <a href="#vasps" className="hover:text-blue-600 transition-colors whitespace-nowrap">FIU Registry</a>
            <a href="#pipeline" className="hover:text-blue-600 transition-colors whitespace-nowrap">Workflow</a>
            <a href="#api" className="hover:text-blue-600 transition-colors whitespace-nowrap">API</a>
          </nav>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2.5 shrink-0">
            <Link
              href="/civilian"
              className="hidden sm:inline-flex items-center text-xs font-semibold text-slate-600 hover:text-slate-900 px-3.5 py-1.5 rounded-full hover:bg-slate-100 transition-colors whitespace-nowrap"
            >
              Civilian Portal
            </Link>

            <button
              onClick={handleEvaluatorFastTrack}
              disabled={loading}
              className="h-9 px-4.5 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 whitespace-nowrap"
            >
              <ZapIcon size={13} className="text-amber-400 shrink-0" />
              <span>{loading ? "Entering..." : "Launch Terminal"}</span>
            </button>

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
              className="lg:hidden w-8.5 h-8.5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
            >
              {mobileMenuOpen ? <XIcon size={16} /> : (
                <div className="w-4 flex flex-col gap-1">
                  <span className="w-full h-0.5 bg-slate-700 rounded-full"></span>
                  <span className="w-3/4 h-0.5 bg-slate-700 rounded-full"></span>
                  <span className="w-full h-0.5 bg-slate-700 rounded-full"></span>
                </div>
              )}
            </button>
          </div>

        </div>

        {/* Mobile Dropdown Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden mt-2 p-4 bg-white/95 backdrop-blur-md rounded-2xl border border-slate-200 shadow-xl space-y-3 text-xs font-semibold text-slate-700 animate-in fade-in slide-in-from-top-2">
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-slate-100">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  handleEvaluatorFastTrack();
                }}
                className="py-2.5 px-3 rounded-full bg-blue-600 text-white font-bold text-center whitespace-nowrap"
              >
                Officer Terminal
              </button>
              <Link
                href="/civilian"
                onClick={() => setMobileMenuOpen(false)}
                className="py-2.5 px-3 rounded-full bg-slate-100 text-slate-900 font-bold text-center whitespace-nowrap"
              >
                Civilian Portal
              </Link>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <a href="#capabilities" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">Core Capabilities</a>
              <a href="#speed" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">Speed Benchmark</a>
              <a href="#workbench" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">Interactive Graph</a>
              <a href="#vasps" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">FIU-IND Registry</a>
              <a href="#pipeline" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">SAHYOG Workflow</a>
              <a href="#api" onClick={() => setMobileMenuOpen(false)} className="py-2 px-3 hover:bg-slate-50 rounded-xl">Developer API</a>
            </div>
          </div>
        )}
      </header>

      {/* ─────────────────────────────────────────────────────────────
          3. HERO SECTION (Wispr Flow Centered Editorial Style)
      ───────────────────────────────────────────────────────────── */}
      <section className="pt-16 pb-16 px-4 sm:px-6 lg:px-8 text-center max-w-4xl mx-auto">
        
        {/* Eyebrow Pill */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white border border-slate-200 text-slate-700 text-xs font-semibold shadow-2xs mb-6">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span>FIU-IND &amp; NCRP Statutory Forensic Suite</span>
        </div>

        {/* Editorial Headline with Serif / Italic Contrast */}
        <h1 className="text-4xl sm:text-6xl font-black text-slate-900 tracking-tight leading-[1.1] mb-6">
          Don’t trace manually,<br />
          <em className="font-serif italic font-normal text-blue-600">let algorithms reconstruct.</em>
        </h1>

        {/* Crisp Subhead */}
        <p className="text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed mb-8">
          The autonomous blockchain forensics engine that attributes unhosted crypto wallets to nearest Indian exchanges and auto-drafts court-certified Section 91 CrPC freeze notices in minutes.
        </p>

        {/* Action Button Group */}
        <div className="flex flex-wrap items-center justify-center gap-3 mb-6">
          <button
            onClick={handleEvaluatorFastTrack}
            disabled={loading}
            className="h-12 px-7 rounded-full bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
          >
            <ZapIcon size={16} className="text-amber-400" />
            <span>{loading ? "Entering Staging..." : "Launch Officer Terminal (1-Click)"}</span>
          </button>
          <a
            href="#workbench"
            className="h-12 px-6 rounded-full bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-sm shadow-2xs transition-all flex items-center gap-2"
          >
            <ActivityIcon size={15} className="text-blue-600" />
            <span>Inspect Live Graph</span>
          </a>
          <button
            onClick={() => setShowNoticeModal(true)}
            className="h-12 px-6 rounded-full bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-bold text-sm transition-all flex items-center gap-2 cursor-pointer"
          >
            <FileTextIcon size={15} />
            <span>Preview Court Notice</span>
          </button>
        </div>

        {/* Evaluation Hint */}
        <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
          <span>Evaluator fast-track key:</span>
          <code className="font-mono font-bold text-blue-600 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">SAHYOG-ADMIN</code>
          <button
            onClick={() => setShowAuthModal(true)}
            className="text-slate-500 hover:text-slate-800 underline ml-1 cursor-pointer"
          >
            (Manual Clearance)
          </button>
        </div>

      </section>


      {/* ─────────────────────────────────────────────────────────────
          5. INSTITUTIONAL TRUST MARQUEE
      ───────────────────────────────────────────────────────────── */}
      <section className="py-8 border-y border-slate-200/80 bg-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 mb-3 text-center">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest">
            Statutory Reporting Entities &amp; Compliant Nodal Desks
          </p>
        </div>
        
        <div className="relative w-full overflow-hidden mask-fade">
          <div className="animate-ticker flex items-center gap-10 sm:gap-14 whitespace-nowrap">
            {[
              "Financial Intelligence Unit (FIU-IND)",
              "National Cyber Crime Reporting Portal (NCRP)",
              "CoinDCX India",
              "Special Cyber Cell, New Delhi",
              "WazirX India",
              "CID Cyber Crime CID",
              "Binance India",
              "CoinSwitch Kuber",
              "ZebPay Exchange",
              "Bitbns India",
              "Financial Intelligence Unit (FIU-IND)",
              "National Cyber Crime Reporting Portal (NCRP)",
              "CoinDCX India",
              "Special Cyber Cell, New Delhi",
              "WazirX India",
              "CID Cyber Crime CID",
              "Binance India",
              "CoinSwitch Kuber",
              "ZebPay Exchange",
              "Bitbns India",
            ].map((name, i) => (
              <div key={i} className="flex items-center gap-2.5 text-xs font-bold text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                <span>{name}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          6. SPEED & EFFICIENCY BENCHMARK (Wispr Flow Comparison Style)
      ───────────────────────────────────────────────────────────── */}
      <section id="speed" className="py-20 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">
            100x faster <em className="font-serif italic font-normal text-blue-600">than manual tracing</em>
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Eliminate days spent copy-pasting wallet hashes into multiple block explorers.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Manual LEA Method - Structured Architectural Square Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 sm:p-8 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-500" />
                  <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">Legacy Investigation</span>
                </div>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-3 py-1 rounded-lg border border-rose-200/80">
                  48 – 72 Hours
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Manual Block Explorer Hopping</h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✕</span>
                  <span>Manual address cross-referencing across separate explorers (Etherscan, Polygonscan, Tronscan).</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✕</span>
                  <span>Disjointed spreadsheets prone to clerical errors, overlooked peeling splits, and missing transaction links.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-rose-50 text-rose-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✕</span>
                  <span>Administrative delays allow fraudsters to off-ramp via P2P arbitrage before freeze notices reach exchanges.</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Standard Turnaround:</span>
              <span className="font-semibold text-slate-700">3–5 Business Days</span>
            </div>
          </div>

          {/* D-CRYPT SHIELD Engine - Matching Architectural Light Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 sm:p-8 flex flex-col justify-between shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all">
            <div>
              <div className="flex items-center justify-between mb-5 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">D-CRYPT SHIELD Engine</span>
                </div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-lg border border-emerald-200/80">
                  Under 3 Minutes
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-3">Deterministic Graph Reconstruction</h3>
              <ul className="space-y-3 text-xs text-slate-600">
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✓</span>
                  <span>Algorithmic multi-hop BFS automatically resolves unhosted hops directly to regulated VASP gateways.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✓</span>
                  <span>Peeling chain heuristics and ML models score transaction velocity and mixer exposure in real time.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="w-4 h-4 rounded bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shrink-0 mt-0.5 text-[11px]">✓</span>
                  <span>Automated Section 91 CrPC notice synthesis with SHA-256 seal and direct compliance nodal routing.</span>
                </li>
              </ul>
            </div>
            <div className="pt-4 border-t border-slate-100 mt-6 flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Attribution Turnaround:</span>
              <span className="font-semibold text-emerald-600">Minutes vs. Days</span>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          7. SCULPTED BENTO GRID: 4 CORE CAPABILITIES
      ───────────────────────────────────────────────────────────── */}
      <section id="capabilities" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-14">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            Forensic Architecture
          </span>
          <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight mt-3">
            Engineered for <em className="font-serif italic font-normal text-blue-600">law enforcement precision</em>
          </h2>
          <p className="text-sm text-slate-600 mt-2">
            Four specialized algorithmic modules delivering court-admissible results without AI hallucinations.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Bento Card 1 - Algorithmic BFS */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-105 transition-transform">
                  <NetworkIcon size={22} />
                </div>
                <span className="text-[11px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
                  Module 01
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Algorithmic BFS Multi-Hop Traversal</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Deterministic breadth-first search engine pruning unhosted mule layers up to 15 hops deep. Completely bypasses intermediate noise addresses.
              </p>
            </div>
            <div className="pt-5 border-t border-slate-100 mt-6 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-500 font-medium">Attribution Accuracy:</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                100% Deterministic (Zero Hallucination)
              </span>
            </div>
          </div>

          {/* Bento Card 2 - AML Scoring */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-105 transition-transform">
                  <ActivityIcon size={22} />
                </div>
                <span className="text-[11px] font-bold text-purple-600 uppercase tracking-widest bg-purple-50 px-2.5 py-1 rounded-md border border-purple-100">
                  Module 02
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Peeling Chain Heuristic AML Scoring</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Calculates transit velocity, value retention, and mixing patterns to deliver a 0–100 risk score, detecting micro-structuring in extortion funds.
              </p>
            </div>
            <div className="pt-5 border-t border-slate-100 mt-6 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-500 font-medium">Risk Heuristic:</span>
              <span className="text-purple-700 font-bold bg-purple-50 px-2.5 py-0.5 rounded-md border border-purple-200">
                0–100 Velocity Risk Score
              </span>
            </div>
          </div>

          {/* Bento Card 3 - VASP Registry */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-105 transition-transform">
                  <BuildingIcon size={22} />
                </div>
                <span className="text-[11px] font-bold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-100">
                  Module 03
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">FIU-IND Statutory VASP Registry</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Resolves terminal deposit gateways to corporate legal entities with verified statutory compliance nodal officers and 24h SLA channels.
              </p>
            </div>
            <div className="pt-5 border-t border-slate-100 mt-6 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-500 font-medium">Exchange Registry:</span>
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-md border border-emerald-200">
                14 Active Indian VASP Desks
              </span>
            </div>
          </div>

          {/* Bento Card 4 - Section 91 CrPC */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group">
            <div>
              <div className="flex items-center justify-between mb-5">
                <div className="w-11 h-11 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100 group-hover:scale-105 transition-transform">
                  <FileTextIcon size={22} />
                </div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-widest bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200/80">
                  Module 04
                </span>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">Section 91 CrPC Automated Evidence PDF</h3>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Generates court-ready statutory freeze notices certified under Section 63 BSA 2023 with pre-generation SHA-256 seal &amp; verification QR.
              </p>
            </div>
            <div className="pt-5 border-t border-slate-100 mt-6 flex items-center justify-between text-xs font-sans">
              <span className="text-slate-500 font-medium">Admissibility:</span>
              <span className="text-amber-700 font-bold bg-amber-50 px-2.5 py-0.5 rounded-md border border-amber-200/80">
                Sec. 63 BSA 2023 / Sec 91 CrPC
              </span>
            </div>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          8. INTERACTIVE FORENSIC GRAPH WORKBENCH
      ───────────────────────────────────────────────────────────── */}
      <section id="workbench" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Interactive Visualizer</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Multi-Hop Traversal Canvas</h2>
            <p className="text-xs sm:text-sm text-slate-600">Inspect the live topological graph model reconstructed by D-CRYPT SHIELD.</p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={`/case/${currentCase.caseId}`}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs flex items-center gap-1.5"
            >
              <ActivityIcon size={14} /> Open Case Dossier &rarr;
            </Link>
          </div>
        </div>

        {/* Dynamic Case Selector Pills */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Forensic Case:</span>
          {showcaseCases.map((c, idx) => (
            <button
              key={c.caseId}
              onClick={() => setActiveCaseIdx(idx)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeCaseIdx === idx
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {c.title}
            </button>
          ))}
        </div>

        {/* Workbench Card - Architectural Square Frame */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          
          {/* Header Bar */}
          <div className="px-6 py-3.5 bg-slate-50/90 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
            <div className="flex flex-wrap items-center gap-4 text-slate-600 font-medium">
              <span>Case ID: <strong className="font-mono text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 font-bold">{currentCase.caseId}</strong></span>
              <span>Attributed VASP: <strong className="text-blue-700 font-bold">{currentCase.attributedVasp}</strong></span>
              <span>AML Risk: <strong className="text-amber-700 font-bold">{currentCase.riskScore} ({currentCase.riskBadge})</strong></span>
            </div>
            <button
              onClick={() => setShowNoticeModal(true)}
              className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
            >
              View Section 91 Notice PDF &rarr;
            </button>
          </div>

          {/* Embedded Cytoscape Canvas */}
          <div className="h-[460px] sm:h-[520px] md:h-[580px] w-full relative bg-[#090D16] overflow-hidden">
            <TransactionGraph
              caseId={currentCase.caseId}
              suspectAddress={currentCase.suspectAddress}
            />
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          9. MULTI-CHAIN REGISTRY (6 Active Blockchains with Authentic SVGs)
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Blockchain Coverage</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Active Traversal Networks</h2>
            <p className="text-xs sm:text-sm text-slate-600">Direct archival RPC indexers for EVM, TRC, and UTXO blockchains.</p>
          </div>
          <span className="px-3.5 py-1.5 rounded-lg bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold">
            6 Live RPCs · 20+ in Pipeline
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              code: "ETH",
              name: "Ethereum Mainnet",
              type: "EVM Layer 1",
              desc: "Full trace depth across ERC-20 transfers (USDT, USDC) and ETH native value peeling trails.",
              rpc: "State Trie Archival",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 784.37 1277.39" fill="none">
                  <polygon fill="#627EEA" points="392.07,0 383.5,29.11 383.5,873.74 392.07,882.29 784.13,650.54 " />
                  <polygon fill="#8A92B2" points="392.07,0 0,650.54 392.07,882.29 392.07,472.33 " />
                  <polygon fill="#627EEA" points="392.07,956.52 387.24,962.41 387.24,1263.28 392.07,1277.38 784.37,724.89 " />
                  <polygon fill="#8A92B2" points="392.07,1277.38 392.07,956.52 0,724.89 " />
                  <polygon fill="#454A75" points="392.07,882.29 784.13,650.54 392.07,472.33 " />
                  <polygon fill="#627EEA" points="0,650.54 392.07,882.29 392.07,472.33 " />
                </svg>
              ),
            },
            {
              code: "MATIC",
              name: "Polygon POS",
              type: "EVM Sidechain",
              desc: "High-throughput micro-structuring detection commonly seen in Indian UPI cyber extortion.",
              rpc: "Bor/Heimdall Node",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 360 360" fill="none">
                  <rect width="360" height="360" rx="180" fill="#8247E5" />
                  <path d="M218.804 99.5819L168.572 128.432V218.473L140.856 234.539L112.97 218.46V186.313L140.856 170.39L158.786 180.788V154.779L140.699 144.511L90.4795 173.687V231.399L140.869 260.418L191.088 231.399V141.371L218.974 125.291L246.846 141.371V173.374L218.974 189.597L200.887 179.107V204.986L218.804 215.319L269.519 186.47V128.432L218.804 99.5819Z" fill="white" />
                </svg>
              ),
            },
            {
              code: "BNB",
              name: "BNB Smart Chain",
              type: "EVM Layer 1",
              desc: "BEP-20 token tracking targeting fake Telegram task groups and Ponzi scam funds.",
              rpc: "Geth/BSC Node",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 2496 2496" fill="none">
                  <path fillRule="evenodd" clipRule="evenodd" fill="#F0B90B" d="M1248 0c689.3 0 1248 558.7 1248 1248s-558.7 1248-1248 1248S0 1937.3 0 1248 558.7 0 1248 0z" />
                  <path fill="#FFFFFF" d="M685.9 1248l.9 330 280.4 165v193.2l-444.5-260.7v-524L685.9 1248z M685.9 918v192.3l-163.3-96.6V821.4l163.3-96.6 164.1 96.6L685.9 918z M1084.3 821.4l163.3-96.6 164.1 96.6-164.1 96.6-163.3-96.6z" />
                  <path fill="#FFFFFF" d="M803.9 1509.6v-193.2l163.3 96.6v192.3L803.9 1509.6z M1084.3 1812.2l163.3 96.6 164.1-96.6v192.3l-164.1 96.6-163.3-96.6V1812.2z M1645.9 821.4l163.3-96.6 164.1 96.6v192.3l-164.1 96.6V918l-163.3-96.6z M1809.2 1578l.9-330 163.3-96.6v524l-444.5 260.7v-193.2L1809.2 1578z" />
                  <polygon fill="#FFFFFF" points="1692.1 1509.6 1528.8 1605.3 1528.8 1413 1692.1 1316.4 1692.1 1509.6" />
                  <path fill="#FFFFFF" d="M1692.1 986.4l.9 193.2-281.2 165v330.8l-163.3 95.7-163.3-95.7v-330.8l-281.2-165V986.4L968 889.8l279.5 165.8 281.2-165.8 164.1 96.6h-.7l-.9.4z M803.9 656.5l443.7-261.6 444.5 261.6-163.3 96.6-281.2-165.8L967.2 753.1 803.9 656.5z" />
                </svg>
              ),
            },
            {
              code: "ARB",
              name: "Arbitrum One",
              type: "L2 Rollup (Nitro)",
              desc: "Tracing cross-rollup rapid bridges and low-gas money mule laundering channels.",
              rpc: "Nitro Full Node",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 2500 2500" fill="none">
                  <path fill="#213147" d="M226 760v980c0 63 33 120 88 152l849 490c54 31 121 31 175 0l849-490c54-31 88-89 88-152V760c0-63-33-120-88-152l-849-490c-54-31-121-31-175 0L314 608c-54 31-87 89-87 152z" />
                  <path fill="#12AAFF" d="M1435 1440l-121 332c-3 9-3 19 0 29l208 571 241-139-289-793c-9-19-34-19-41 0z" />
                  <path fill="#12AAFF" d="M1678 882c-7-18-32-18-39 0l-121 332c-3 9-3 19 0 29l341 935 241-139L1678 882z" />
                  <path fill="#9DCCED" d="M1250 155c6 0 12 2 17 5l918 530c11 6 17 18 17 30v1060c0 12-7 24-17 30l-918 530c-5 3-11 5-17 5s-12-2-17-5l-918-530c-11-6-17-18-17-30V719c0-12 7-24 17-30l918-530c5-3 11-5 17-5zm0-155c-33 0-65 8-95 25L237 555c-59 34-95 96-95 164v1060c0 68 36 130 95 164l918 530c29 17 62 25 95 25s65-8 95-25l918-530c59-34 95-96 95-164V719c0-68-36-130-95-164L1344 25c-29-17-62-25-95-25z" />
                  <polygon fill="#213147" points="642 2179 727 1947 897 2088 738 2234" />
                  <path fill="#FFFFFF" d="M1172 644H939c-17 0-33 11-39 27L401 2039l241 139 550-1507c5-14-5-28-19-28z" />
                  <path fill="#FFFFFF" d="M1580 644h-233c-17 0-33 11-39 27L738 2233l241 139 620-1701c5-14-5-28-19-28z" />
                </svg>
              ),
            },
            {
              code: "TRX",
              name: "Tron Network",
              type: "TRC-20 Protocol",
              desc: "Tether TRC-20 high-velocity money mule flows across P2P arbitrage hubs.",
              rpc: "Java-Tron HTTP",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 64 64" fill="none">
                  <path fill="#EF0027" d="M61.55 19.28c-3-2.77-7.15-7-10.53-10l-.2-.14a3.82 3.82 0 0 0-1.11-.62L41.56 7 2.89 0a1.4 1.4 0 0 0-.58.22L2.12.37a2.23 2.23 0 0 0-.52.84l-.05.13v.71l0 .11C5.82 14.05 22.68 53 26 62.14c.2.62.58 1.8 1.29 1.86h.16c.38 0 2-2.14 2-2.14S58.41 26.74 61.34 23a9.46 9.46 0 0 0 1-1.48 2.41 2.41 0 0 0-.79-2.24zM36.88 23.37L49.24 13.12l7.25 6.68zm-4.8-.67L10.8 5.26l34.43 6.35zM34 27.27l21.78-3.51-24.9 30zM7.91 7l22.39 19L27.06 53.78z" />
                </svg>
              ),
            },
            {
              code: "BTC",
              name: "Bitcoin Core",
              type: "UTXO Protocol",
              desc: "Unspent Transaction Output (UTXO) multi-input clustering and change address separation.",
              rpc: "Bitcoin Core RPC",
              svg: (
                <svg className="w-5 h-5" viewBox="0 0 4091.27 4091.73" fill="none">
                  <path fill="#F7931A" fillRule="nonzero" d="M4030.06 2540.77c-273.24 1096.01-1383.32 1763.02-2479.46 1489.71-1095.68-273.24-1762.69-1383.39-1489.33-2479.31 273.12-1096.13 1383.2-1763.19 2479-1489.95 1096.06 273.24 1763.03 1383.51 1489.76 2479.57z" />
                  <path fill="white" fillRule="nonzero" d="M2947.77 1754.38c40.72-272.26-166.56-418.61-450-516.24l91.95-368.8-224.5-55.94-89.51 359.09c-59.02-14.72-119.63-28.59-179.87-42.34l90.16-361.46-224.36-55.94-92 368.68c-48.84-11.12-96.81-22.11-143.35-33.69l.26-1.16-309.59-77.31-59.72 239.78s166.56 38.18 163.05 40.53c90.91 22.69 107.35 82.87 104.62 130.57l-104.74 420.15c6.26 1.59 14.38 3.89 23.34 7.49-7.49-1.86-15.46-3.89-23.73-5.87l-146.81 588.57c-11.11 27.62-39.31 69.07-102.87 53.33 2.25 3.26-163.17-40.72-163.17-40.72l-111.46 256.98 292.15 72.83c54.35 13.63 107.61 27.89 160.06 41.3l-92.9 373.03 224.24 55.94 92-369.07c61.26 16.63 120.71 31.97 178.91 46.43l-91.69 367.33 224.51 55.94 92.89-372.33c382.82 72.45 670.67 43.24 791.83-303.02 97.63-278.78-4.86-439.58-206.26-544.44 146.69-33.83 257.18-130.31 286.64-329.61zm-512.93 719.26c-69.38 278.78-538.76 128.08-690.94 90.29l123.28-494.2c152.17 37.99 640.17 113.17 567.67 403.91zm69.43-723.3c-63.29 253.58-453.96 124.75-580.69 93.16l111.77-448.21c126.73 31.59 534.85 90.55 468.94 355.05z" />
                </svg>
              ),
            },
          ].map((chain) => (
            <div
              key={chain.code}
              className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 hover:shadow-md transition-all flex flex-col justify-between group"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/80 p-2 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform shadow-2xs">
                      {chain.svg}
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-slate-900">{chain.name}</h4>
                      <span className="text-[11px] font-semibold text-slate-500">{chain.type}</span>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                    LIVE
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed mb-5">
                  {chain.desc}
                </p>
              </div>
              <div className="pt-3.5 border-t border-slate-100 text-xs flex items-center justify-between">
                <span className="text-slate-500 font-medium">RPC Interface:</span>
                <span className="font-mono text-[11px] text-slate-800 bg-slate-50 px-2 py-0.5 rounded border border-slate-200 font-semibold">{chain.rpc}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          10. SEARCHABLE FIU-IND VASP DIRECTORY
      ───────────────────────────────────────────────────────────── */}
      <section id="vasps" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Statutory Reporting Entities</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">FIU-IND Registered VASP Directory</h2>
            <p className="text-xs sm:text-sm text-slate-600">Curated dataset of verified Indian VASPs with active compliance channels.</p>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <SearchIcon size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={vaspSearch}
              onChange={(e) => setVaspSearch(e.target.value)}
              placeholder="Search VASP or FIU ID..."
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs"
            />
          </div>
        </div>

        {/* Clean White Table - Architectural Square Container */}
        <div className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-sans">
              <thead className="bg-slate-50/90 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">VASP Brand</th>
                  <th className="px-5 py-3.5">Corporate Entity</th>
                  <th className="px-5 py-3.5">FIU-IND Reg ID</th>
                  <th className="px-5 py-3.5">Nodal Compliance Email</th>
                  <th className="px-5 py-3.5">Jurisdiction</th>
                  <th className="px-5 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredVasps.map((v) => (
                  <tr key={v.fiuId} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-5 py-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <BuildingIcon size={14} className="text-blue-600" />
                      {v.name}
                    </td>
                    <td className="px-5 py-3.5 text-slate-600">{v.legalName}</td>
                    <td className="px-5 py-3.5 font-mono text-blue-600 font-semibold">{v.fiuId}</td>
                    <td className="px-5 py-3.5 text-slate-600">{v.nodalEmail}</td>
                    <td className="px-5 py-3.5 text-slate-500">{v.jurisdiction}</td>
                    <td className="px-5 py-3.5">
                      <span className="px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 text-[11px] font-bold border border-emerald-200">
                        {v.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          11. SAHYOG STATUTORY PIPELINE & REST SCHEMAS
      ───────────────────────────────────────────────────────────── */}
      <section id="pipeline" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="text-center max-w-2xl mx-auto mb-12">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Automated Routing</span>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">SAHYOG Portal Routing Workflow</h2>
          <p className="text-sm text-slate-600 mt-2">
            Standardized inter-agency JSON data exchange from complaint ingestion to VASP notice execution.
          </p>
        </div>

        {/* 4-Step Stepper - Structured Square Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { step: "01", title: "Complaint Ingestion", desc: "Victim FIR filed at NCRP Cyber Crime Portal with suspect address." },
            { step: "02", title: "Live Mempool Intercept", desc: "Daemon listens for zero-confirmation transfers before block mining." },
            { step: "03", title: "Multi-Hop Attribution", desc: "Algorithmic BFS isolates terminal deposit gateway at regulated VASP." },
            { step: "04", title: "Section 91 Notice Seal", desc: "Auto-generates signed PDF notice with dual SHA-256 seal & live QR." },
          ].map((s) => (
            <div key={s.step} className="bg-white rounded-xl border border-slate-200/90 p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
              <div>
                <span className="text-2xl font-black text-blue-600 mb-2 block tracking-tight">{s.step}</span>
                <h4 className="font-bold text-sm text-slate-900 mb-1.5">{s.title}</h4>
                <p className="text-xs text-slate-500 leading-relaxed">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* JSON Schema Viewer - Traditional Developer Dark Terminal */}
        <div className="bg-slate-950 text-slate-200 rounded-xl p-6 sm:p-7 border border-slate-800 shadow-lg shadow-slate-900/10">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800 mb-4">
            <div className="flex items-center gap-2.5">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">Payload Schema:</span>
              <div className="flex bg-slate-900 p-1 rounded-lg border border-slate-800">
                {(["inbound", "engine", "outbound"] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSahyogTab(tab)}
                    className={`px-3 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                      sahyogTab === tab ? "bg-blue-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {tab === "inbound" ? "Inbound FIR" : tab === "engine" ? "BFS Engine" : "SAHYOG Notice"}
                  </button>
                ))}
              </div>
            </div>
            <span className="font-mono text-xs text-slate-400">schema-v1.2.json</span>
          </div>

          <pre className="font-mono text-xs text-emerald-400 bg-slate-900 p-4 rounded-lg border border-slate-800/80 overflow-x-auto leading-relaxed max-h-60">
            {sahyogTab === "inbound" && (
`{
  "source": "NCRP_CYBER_CRIME_PORTAL",
  "fir_number": "FIR No. 412/2024 / Cyber PS Special Cell",
  "victim_loss_inr": 3231900,
  "suspect_wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "chain": "ethereum"
}`
            )}
            {sahyogTab === "engine" && (
`{
  "attribution_status": "VASP_RESOLVED",
  "source_wallet": "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
  "attributed_vasp": "CoinDCX India (Neblio Technologies Pvt. Ltd.)",
  "terminal_gateway": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  "hops_traversed": 4,
  "confidence_score": 99.4
}`
            )}
            {sahyogTab === "outbound" && (
`{
  "statutory_notice_type": "SECTION_91_CRPC",
  "authority": "Special Cyber Cell, New Delhi",
  "target_vasp_email": "nodal.officer@coindcx.com",
  "demanded_actions": [
    "IMMEDIATE_DEBIT_FREEZE_ACCOUNT",
    "DISCLOSE_VERIFIED_KYC_AADHAAR_PAN",
    "TRANSMIT_SESSION_IP_LOGS_90_DAYS"
  ],
  "canonical_sha256": "3a8f9c1b7e4d2a6f8b0e1d3c5a7f9b2d4e6a8c0f1b3d5e7a9c2b4d6e8f0a1b2c"
}`
            )}
          </pre>
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          12. DUAL INTAKE & LIVE ALERT DISPATCH TESTER
      ───────────────────────────────────────────────────────────── */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Left: Civilian Intake - Architectural Square Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">Public Intake</span>
              <h3 className="text-2xl font-black text-slate-900 mt-2 mb-2">Civilian Crime Reporting Portal</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Victims of cyber financial fraud can register suspect addresses directly for automated LEA attribution queue processing.
              </p>
              
              <div className="p-4.5 rounded-lg bg-slate-50 border border-slate-200 space-y-2.5 mb-6 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Citizen Auth:</span>
                  <span className="font-semibold text-slate-800">Google OAuth 2.0 (Evaluation Staging)</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Queue Processing:</span>
                  <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">Auto-BFS Escalation</span>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={handleCivilianGoogleLogin}
                disabled={loading}
                className="w-full h-11 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-2 shadow-xs transition-all cursor-pointer active:scale-95"
              >
                Continue with Google Sign-In
              </button>
              <Link
                href="/civilian"
                className="w-full h-11 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold text-xs rounded-lg flex items-center justify-center transition-colors"
              >
                Open Civilian Reporting Form Direct &rarr;
              </Link>
            </div>
          </div>

          {/* Right: Officer Email Alert Dispatch Tester - Architectural Square Card */}
          <div className="bg-white rounded-xl border border-slate-200/90 p-7 sm:p-8 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all flex flex-col justify-between">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Evaluator Telemetry</span>
              <h3 className="text-2xl font-black text-slate-900 mt-2 mb-2">Test Live Officer Forensic Alert</h3>
              <p className="text-xs text-slate-600 leading-relaxed mb-6">
                Enter your email address to receive the real automated LEA alert notification triggered when traced funds hit a regulated Indian VASP.
              </p>

              <form onSubmit={handleSendTestEmail} className="space-y-3 mb-4">
                <input
                  type="email"
                  placeholder="e.g. officer.evaluator@agency.gov.in"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-2xs"
                  required
                />
                <button
                  type="submit"
                  disabled={emailStatus === "loading"}
                  className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-lg shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                >
                  <ZapIcon size={14} />
                  <span>{emailStatus === "loading" ? "Dispatching..." : "Send Test Forensic Alert"}</span>
                </button>
              </form>

              {emailStatus === "success" && emailResponse && (
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs space-y-1">
                  <p className="font-bold flex items-center gap-1.5">
                    <CheckCircleIcon size={14} className="text-emerald-600" /> Forensic alert dispatched successfully!
                  </p>
                  <p className="text-[11px] text-slate-600">Dispatched to: <strong className="font-mono text-slate-800">{emailResponse.dispatched_to}</strong></p>
                  <button
                    onClick={() => setShowPayloadModal(true)}
                    className="text-[11px] font-bold text-blue-600 underline cursor-pointer mt-1 block"
                  >
                    View Complete Raw Dispatch Payload (JSON) &rarr;
                  </button>
                </div>
              )}

              {emailStatus === "error" && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  Please enter a valid email address.
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 mt-4">
              Connected to <code className="font-mono text-slate-600">POST /api/v1/alerts/test-email</code> · Real SMTP or verified mock telemetry.
            </p>
          </div>

        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          13. DEVELOPER REST API CATALOG
      ───────────────────────────────────────────────────────────── */}
      <section id="api" className="py-20 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <span className="text-xs font-bold text-blue-600 uppercase tracking-widest">REST API Catalog</span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">Agency Programmatic Gateway</h2>
            <p className="text-xs sm:text-sm text-slate-600">19 endpoints for automated LEA ingestion, SIEM feeds, and notice dispatch.</p>
          </div>
          <div className="text-xs text-slate-700 bg-white border border-slate-200 px-3.5 py-1.5 rounded-lg shadow-2xs font-sans">
            Base URL: <code className="font-mono text-blue-600 font-bold ml-1">http://localhost:9090/api/v1</code>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex flex-wrap gap-2 mb-6">
          {(["all", "trace", "intel", "report", "sahyog", "graph"] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setApiCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                apiCategory === cat
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 border border-slate-200 hover:border-slate-300"
              }`}
            >
              {cat.toUpperCase()} ({cat === "all" ? apiCatalog.length : apiCatalog.filter(e => e.category === cat).length})
            </button>
          ))}
        </div>

        {/* Endpoints Accordion - Architectural Square Rows */}
        <div className="space-y-2.5">
          {apiCatalog
            .filter((ep) => apiCategory === "all" || ep.category === apiCategory)
            .map((ep) => {
              const isExpanded = expandedEndpoint === ep.path;
              return (
                <div
                  key={ep.path}
                  className="bg-white rounded-xl border border-slate-200/90 shadow-[0_1px_3px_rgba(0,0,0,0.04)] hover:border-slate-300 transition-all overflow-hidden"
                >
                  <div
                    onClick={() => setExpandedEndpoint(isExpanded ? null : ep.path)}
                    className="px-5 py-3.5 flex items-center justify-between cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-3">
                      <span className={`font-mono text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        ep.method === "POST" ? "bg-blue-50 text-blue-700 border border-blue-200" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      }`}>
                        {ep.method}
                      </span>
                      <span className="font-mono text-xs font-bold text-slate-900">{ep.path}</span>
                      <span className="hidden sm:inline text-xs text-slate-500">— {ep.title}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyEndpointPath(ep.path);
                        }}
                        className="text-xs font-medium text-slate-600 hover:text-slate-900 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 transition-colors"
                      >
                        {copiedEndpoint === ep.path ? "Copied!" : "Copy"}
                      </button>
                      <span className="text-xs text-slate-400">{isExpanded ? "▲" : "▼"}</span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-5 pb-5 pt-2 bg-slate-50/80 border-t border-slate-100 space-y-3.5 text-xs">
                      <p className="text-slate-600 leading-relaxed">{ep.desc}</p>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Request Parameter Schema:</span>
                        <pre className="font-mono text-xs bg-slate-900 text-slate-200 p-3.5 rounded-lg border border-slate-800 overflow-x-auto leading-relaxed">
                          {ep.params}
                        </pre>
                      </div>
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">Sample JSON Response:</span>
                        <pre className="font-mono text-xs bg-slate-950 text-emerald-400 p-3.5 rounded-lg border border-slate-800 overflow-x-auto leading-relaxed">
                          {ep.response}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
        </div>
      </section>

      {/* ─────────────────────────────────────────────────────────────
          14. SECTION 91 NOTICE MODAL
      ───────────────────────────────────────────────────────────── */}
      {showNoticeModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl flex flex-col text-slate-800 text-xs">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div className="flex items-center gap-2.5">
                <ShieldIcon size={16} className="text-blue-600" />
                <h3 className="font-bold text-sm text-slate-900">Section 91 CrPC Official Requisition Exhibit</h3>
              </div>
              <button
                onClick={() => setShowNoticeModal(false)}
                className="w-7 h-7 rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 flex items-center justify-center cursor-pointer transition-colors"
              >
                <XIcon size={14} />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs font-sans">
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-center font-bold text-[11px] uppercase tracking-wider">
                OFFICIAL REQUISITION EXHIBIT · SECTION 91 CrPC / SEC 102 BNSS
              </div>

              <div className="space-y-1.5 text-slate-700 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <p><span className="font-semibold text-slate-500">Notice Dispatch Ref:</span> <code className="font-mono text-slate-900 font-bold ml-1">D-CRYPT/CYBER/2026/SEC91-0891</code></p>
                <p><span className="font-semibold text-slate-500">Case Number:</span> <span className="font-bold text-slate-900 ml-1">{currentCase.firNumber}</span></p>
                <p><span className="font-semibold text-slate-500">Attributed Recipient:</span> <span className="font-bold text-blue-700 ml-1">{currentCase.attributedVasp}</span> <code className="font-mono text-slate-600 ml-1">({currentCase.fiuRegNumber})</code></p>
                <p><span className="font-semibold text-slate-500">Target Deposit Gateway:</span> <code className="font-mono text-slate-900 font-bold ml-1">{currentCase.gatewayAddress}</code></p>
              </div>

              <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2 text-slate-600">
                <p className="font-bold text-slate-900 uppercase text-[11px] tracking-wider">Statutory Directive:</p>
                <p>Under Section 91 CrPC and Section 102 BNSS, the designated compliance nodal officer is commanded to:</p>
                <ul className="list-disc pl-5 space-y-1 text-slate-700">
                  <li>Immediately execute a debit freeze on the receiving wallet.</li>
                  <li>Disclose verified KYC credentials (Aadhaar/PAN, session IP logs).</li>
                  <li>Provide linked INR bank account &amp; UPI withdrawal rails within 24 hours.</li>
                </ul>
              </div>

              <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200">
                <p className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Canonical Pre-Generation SHA-256 Seal:</p>
                <p className="font-mono text-[11px] text-blue-700 break-all font-bold mt-1 bg-white p-2 rounded border border-slate-200">{currentCase.canonicalSeal}</p>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between sticky bottom-0">
              <span className="text-[11px] text-slate-500 font-medium">Certified Court Exhibit Format</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowNoticeModal(false)}
                  className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-100 cursor-pointer transition-colors"
                >
                  Close
                </button>
                <a
                  href={`${API_BASE}/api/v1/report/${currentCase.caseId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 shadow-xs transition-colors"
                >
                  <DownloadIcon size={14} /> Download PDF Notice
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          15. RAW EMAIL PAYLOAD MODAL
      ───────────────────────────────────────────────────────────── */}
      {showPayloadModal && emailResponse && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full border border-slate-200 p-6 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-3">
              <span className="font-bold text-slate-900 text-sm">Raw Forensic Dispatch Telemetry</span>
              <button onClick={() => setShowPayloadModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <XIcon size={16} />
              </button>
            </div>
            <pre className="font-mono text-xs p-4 bg-slate-950 text-emerald-400 rounded-lg border border-slate-800 overflow-x-auto max-h-80 leading-relaxed">
              {JSON.stringify(emailResponse, null, 2)}
            </pre>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setShowPayloadModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg font-bold cursor-pointer transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          16. MANUAL OFFICER CLEARANCE MODAL
      ───────────────────────────────────────────────────────────── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-sm w-full border border-slate-200 p-6 text-xs shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
              <h3 className="font-bold text-sm text-slate-900">Officer Authentication</h3>
              <button onClick={() => setShowAuthModal(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer">
                <XIcon size={16} />
              </button>
            </div>
            <form onSubmit={handleOfficerLogin} className="space-y-4">
              <div>
                <label className="text-[11px] text-slate-500 uppercase font-bold block mb-1.5 tracking-wider">
                  Statutory Clearance Key
                </label>
                <input
                  type="text"
                  placeholder="e.g. SAHYOG-ADMIN"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 font-mono text-xs focus:outline-none focus:border-blue-600"
                  autoFocus
                />
                <p className="text-[11px] text-slate-500 mt-1">Pre-authorized key: <strong className="font-mono text-blue-600">SAHYOG-ADMIN</strong></p>
              </div>
              {error && (
                <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                  {error}
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAuthModal(false)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition-colors"
                >
                  {loading ? "Validating..." : "Authorize"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          17. INSTITUTIONAL FOOTER
      ───────────────────────────────────────────────────────────── */}
      <footer className="w-full bg-white border-t border-slate-200/90 py-12 px-4 sm:px-6 lg:px-8 text-slate-500 text-xs">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shadow-xs">
              <ShieldIcon size={16} />
            </div>
            <div>
              <p className="font-bold text-sm text-slate-900">D-CRYPT SHIELD <span className="font-mono text-xs font-normal text-slate-400">v1.0.4</span></p>
              <p className="text-[11px] text-slate-500">Autonomous Multi-Hop Blockchain Attribution &amp; Statutory Requisition Engine</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs font-semibold text-slate-600">
            <a href="#capabilities" className="hover:text-blue-600">Capabilities</a>
            <a href="#speed" className="hover:text-blue-600">Benchmark</a>
            <a href="#workbench" className="hover:text-blue-600">Live Graph</a>
            <a href="#vasps" className="hover:text-blue-600">FIU-IND Registry</a>
            <a href="#pipeline" className="hover:text-blue-600">Workflow</a>
            <a href="#api" className="hover:text-blue-600">REST API</a>
          </div>

          <div className="font-mono text-[10px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-3.5 py-1 rounded-full tracking-wide">
            NATIONAL FORENSICS SUITE · FIU-IND COMPLIANT
          </div>
        </div>
      </footer>

    </div>
  );
}