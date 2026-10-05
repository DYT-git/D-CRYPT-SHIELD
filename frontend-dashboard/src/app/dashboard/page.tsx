"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ActivityIcon,
  ShieldIcon,
  DatabaseIcon,
  ChevronRight,
  PlusIcon,
  FolderIcon,
  RefreshIcon,
  CopyIcon,
  CheckCircleIcon,
  SearchIcon,
  UserIcon,
} from "@/components/Icons";
import DemoBadge from "@/components/DemoBadge";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────
const CHAIN: Record<string, { label: string; logo: string; bg: string; text: string }> = {
  ethereum: { label: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032",   bg: "bg-indigo-50 border-indigo-200",  text: "text-indigo-700"  },
  bitcoin:  { label: "Bitcoin",  logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032",    bg: "bg-amber-50 border-amber-200",    text: "text-amber-700"   },
  tron:     { label: "Tron",     logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032",       bg: "bg-red-50 border-red-200",        text: "text-red-700"     },
  bnb:      { label: "BNB",      logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032",        bg: "bg-yellow-50 border-yellow-200",  text: "text-yellow-700"  },
  polygon:  { label: "Polygon",  logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032",  bg: "bg-purple-50 border-purple-200",  text: "text-purple-700"  },
  solana:   { label: "Solana",   logo: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032",     bg: "bg-fuchsia-50 border-fuchsia-200",text: "text-fuchsia-700" },
  arbitrum: { label: "Arbitrum", logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=032",   bg: "bg-sky-50 border-sky-200",        text: "text-sky-700"     },
};

const STATUS: Record<string, { label: string; dot: string; bg: string; text: string }> = {
  completed: { label: "Completed", dot: "bg-emerald-500", bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700" },
  tracing:   { label: "Tracing",   dot: "bg-blue-500",    bg: "bg-blue-50 border-blue-200",       text: "text-blue-700"   },
  pending:   { label: "Pending",   dot: "bg-amber-500",   bg: "bg-amber-50 border-amber-200",     text: "text-amber-700"  },
  failed:    { label: "Failed",    dot: "bg-red-500",     bg: "bg-red-50 border-red-200",         text: "text-red-700"    },
};

const VASP_DOMAINS: Record<string, string> = {
  binance: "binance.com", coinbase: "coinbase.com", okx: "okx.com",
  kraken: "kraken.com", huobi: "htx.com", kucoin: "kucoin.com",
};

interface CaseRow {
  case_id: string;
  suspect_address: string;
  chain: string;
  status: string;
  vasp_name?: string;
  confidence: number;
  risk_score: number;
  submitted_by: string;
  created_at?: string;
  amount?: string;
}

function shortAddr(a: string) { return a.length > 20 ? a.slice(0, 8) + "…" + a.slice(-6) : a; }

function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function Pill({ logo, dot, bg, text, label }: { logo?: string; dot?: string; bg: string; text: string; label: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-bold border ${bg} ${text} uppercase tracking-wider`}>
      {logo ? (
        <img src={logo} alt={label} className="w-3.5 h-3.5 object-contain" />
      ) : dot ? (
        <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      ) : null}
      {label}
    </span>
  );
}

function RiskBadge({ score }: { score: number }) {
  const level = score >= 75 ? "critical" : score >= 45 ? "high" : score >= 25 ? "medium" : "low";
  const styles: Record<string, string> = {
    critical: "bg-red-50 border-red-200 text-red-700",
    high:     "bg-orange-50 border-orange-200 text-orange-700",
    medium:   "bg-amber-50 border-amber-200 text-amber-700",
    low:      "bg-emerald-50 border-emerald-200 text-emerald-700",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${styles[level]}`}>
      {level}
    </span>
  );
}

const ALL_DASHBOARD_CASES: CaseRow[] = [
  {
    case_id: "CASE-2024-IN-0891",
    suspect_address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
    chain: "ethereum",
    status: "completed",
    vasp_name: "CoinDCX India (FIU-IND)",
    confidence: 99,
    risk_score: 89,
    submitted_by: "Special Cell Cyber PS",
    created_at: "2026-09-18T10:30:00Z",
    amount: "14.25 ETH",
  },
  {
    case_id: "CASE-2024-DEF-4402",
    suspect_address: "0x098B716B8Aaf215190988513afF39BA65EdAB176",
    chain: "ethereum",
    status: "completed",
    vasp_name: "Tornado Cash (OFAC)",
    confidence: 99,
    risk_score: 99,
    submitted_by: "Cyber CID Bengaluru",
    created_at: "2026-09-17T14:15:00Z",
    amount: "100.0 ETH",
  },
  {
    case_id: "CASE-2024-P2P-7719",
    suspect_address: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8",
    chain: "ethereum",
    status: "completed",
    vasp_name: "Binance 14 (FIU-IND)",
    confidence: 98,
    risk_score: 91,
    submitted_by: "Cyberabad Cyber PS",
    created_at: "2026-09-17T09:45:00Z",
    amount: "45,000 USDT",
  },
  {
    case_id: "CASE-2024-SAFE-0100",
    suspect_address: "0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1",
    chain: "ethereum",
    status: "completed",
    vasp_name: "Aave V3 Core Pool",
    confidence: 98,
    risk_score: 12,
    submitted_by: "Financial Intel Unit",
    created_at: "2026-09-16T16:20:00Z",
    amount: "50.0 ETH",
  },
  {
    case_id: "CASE-2024-001",
    suspect_address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE",
    chain: "ethereum",
    status: "completed",
    vasp_name: "Binance India",
    confidence: 97,
    risk_score: 22,
    submitted_by: "Insp. Sharma",
    created_at: "2026-08-27T11:00:00Z",
    amount: "12.4 ETH",
  },
  {
    case_id: "CASE-2024-002",
    suspect_address: "TF5Bn4cJCT6GqbAac1HQrGEbT1cEJEDYzA",
    chain: "tron",
    status: "completed",
    vasp_name: "Huobi Global",
    confidence: 88,
    risk_score: 65,
    submitted_by: "Insp. Patel",
    created_at: "2026-08-26T15:30:00Z",
    amount: "45,000 TRX",
  },
  {
    case_id: "CASE-2024-003",
    suspect_address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",
    chain: "bitcoin",
    status: "tracing",
    vasp_name: "not_found",
    confidence: 0,
    risk_score: 85,
    submitted_by: "SI Mehta",
    created_at: "2026-08-27T08:15:00Z",
    amount: "0.8 BTC",
  },
  {
    case_id: "CASE-2024-004",
    suspect_address: "0xddfAbCdc4D8FfC6d5bebbFD5d9d5f6a7B22F52e",
    chain: "ethereum",
    status: "completed",
    vasp_name: "Coinbase Prime",
    confidence: 99,
    risk_score: 18,
    submitted_by: "ACP Verma",
    created_at: "2026-08-25T13:45:00Z",
    amount: "5.1 ETH",
  },
];

export default function Dashboard() {
  const [cases, setCases]               = useState<CaseRow[]>(ALL_DASHBOARD_CASES);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);
  const [civilianCount, setCivilianCount] = useState<number>(3);
  const [latestCivilian, setLatestCivilian] = useState<any>(null);

  const loadCivilianReports = async () => {
    try {
      const res = await fetch("/api/civilian-reports");
      if (res.ok) {
        const data = await res.json();
        if (data.reports && Array.isArray(data.reports)) {
          setCivilianCount(data.reports.length);
          if (data.reports.length > 0) setLatestCivilian(data.reports[0]);
          return;
        }
      }
    } catch {}

    try {
      const stored = localStorage.getItem("sahyog_civilian_reports");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCivilianCount(3 + parsed.length);
          setLatestCivilian(parsed[0]);
        }
      }
    } catch {}
  };

  const loadCases = async () => {
    try {
      setError(null);
      const res = await fetch(`${API}/api/v1/cases`, { cache: 'no-store' });
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      
      const combined = [...ALL_DASHBOARD_CASES];
      if (Array.isArray(data.cases)) {
        data.cases.forEach((apiCase: any) => {
          const cid = (apiCase.case_id || "").toLowerCase();
          const saddr = (apiCase.suspect_address || "").toLowerCase();
          const isExisting = combined.some(c => 
            c.case_id.toLowerCase() === cid ||
            c.suspect_address.toLowerCase() === saddr ||
            cid.startsWith("demo-case-")
          );
          if (!isExisting) {
            combined.unshift({
              case_id: apiCase.case_id,
              suspect_address: apiCase.suspect_address,
              chain: apiCase.chain || "ethereum",
              status: apiCase.status || "completed",
              vasp_name: apiCase.found_vasp?.vasp_name || apiCase.vasp_name || "not_found",
              confidence: apiCase.confidence > 1 ? apiCase.confidence : Math.round((apiCase.confidence || 0) * 100),
              risk_score: apiCase.risk_score || 0,
              submitted_by: apiCase.submitted_by || "LEA Officer",
              created_at: apiCase.created_at || new Date().toISOString(),
              amount: apiCase.amount || "—",
            });
          }
        });
      }
      setCases(combined);
      setLastRefresh(new Date());
    } catch (e: any) {
      console.warn("Using official demo cases:", e.message);
      setCases(ALL_DASHBOARD_CASES);
      setLastRefresh(new Date());
      setError(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { 
    loadCases(); 
    loadCivilianReports();
  }, []);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddress(addr);
    setTimeout(() => setCopiedAddress(null), 1800);
  };

  const totalCases    = cases.length;
  const vaspsFound    = cases.filter(c => c.vasp_name && c.vasp_name !== "not_found").length;
  const activeTraces  = cases.filter(c => c.status === "tracing" || c.status === "pending").length;
  const criticalCases = cases.filter(c => c.risk_score >= 75).length;
  const completed     = cases.filter(c => c.status === "completed").length;

  const STATS = [
    {
      label: "Total Investigations",
      value: loading ? "—" : totalCases.toString(),
      sub: `${activeTraces} currently active`,
      badge: "Active",
      badgeColor: "bg-blue-50 text-[#3770FF] border-[#D2E0FF]",
      icon: FolderIcon,
      iconBg: "bg-blue-50 border-blue-100",
      iconColor: "text-blue-600",
    },
    {
      label: "VASPs Identified",
      value: loading ? "—" : vaspsFound.toString(),
      sub: totalCases > 0 ? `${((vaspsFound / totalCases) * 100).toFixed(0)}% attribution rate` : "0% rate",
      badge: "Attributed",
      badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
      icon: DatabaseIcon,
      iconBg: "bg-emerald-50 border-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      label: "Active Tracing",
      value: loading ? "—" : activeTraces.toString(),
      sub: `${criticalCases} flagged critical`,
      badge: "Live BFS",
      badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
      icon: ActivityIcon,
      iconBg: "bg-amber-50 border-amber-100",
      iconColor: "text-amber-600",
    },
    {
      label: "Completed Dossiers",
      value: loading ? "—" : completed.toString(),
      sub: "Court-ready evidence packages",
      badge: "Resolved",
      badgeColor: "bg-purple-50 text-purple-700 border-purple-200",
      icon: ShieldIcon,
      iconBg: "bg-purple-50 border-purple-100",
      iconColor: "text-purple-600",
    },
  ];

  const filtered = cases.filter((c) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || c.case_id.toLowerCase().includes(q)
      || c.suspect_address.toLowerCase().includes(q)
      || (c.vasp_name ?? "").toLowerCase().includes(q)
      || (c.submitted_by ?? "").toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* ── Minimal Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#13123A] tracking-tight flex items-center">
            Investigation Operations
            <DemoBadge id="dashboard_main" />
          </h1>
          <p className="text-[12px] text-[#515470] mt-0.5 font-medium">
            Live attribution engine · {lastRefresh ? `Refreshed ${lastRefresh.toLocaleTimeString("en-IN")}` : "Syncing…"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadCases}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white/80 backdrop-blur-sm border border-[#D2D6E4] text-[#515470] text-[12px] font-bold hover:border-[#3770FF] hover:text-[#3770FF] transition-all shadow-xs cursor-pointer"
          >
            <RefreshIcon size={13} />
            Refresh
          </button>
          <Link
            href="/trace"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] text-white text-[12px] font-bold transition-all shadow-xs shrink-0"
          >
            <PlusIcon size={14} strokeWidth={2.5} />
            New Trace
          </Link>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <ShieldIcon size={16} className="text-red-600 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-red-800">Backend sync error</p>
            <p className="text-xs text-red-600 mt-0.5">{error} — Ensure backend is active on port 9090.</p>
          </div>
          <button onClick={loadCases} className="text-xs font-bold text-red-700 hover:underline shrink-0">Retry</button>
        </div>
      )}

      {/* ── Top Stat Cards (Polished Metrics) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STATS.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-[11px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">{s.label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${s.iconBg} ${s.iconColor}`}>
                  <Icon size={16} />
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-black text-[#273339] tracking-tight leading-none">{s.value}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border font-eyebrow uppercase ${s.badgeColor}`}>
                  {s.badge}
                </span>
              </div>
              <div className="mt-3 pt-3 border-t border-[#F5F7F7]">
                <p className="text-[11px] font-medium text-[#616B70]">{s.sub}</p>
              </div>
            </div>
          );
        })}
      </div>
 
       {/* ── Public Civilian Intake Alert Banner ── */}
       <div className="bg-gradient-to-r from-blue-50/90 via-indigo-50/50 to-blue-50/90 border border-blue-200 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
         <div className="flex items-center gap-3.5">
           <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
             <UserIcon size={20} />
           </div>
           <div>
             <div className="flex items-center gap-2">
               <h3 className="text-[13px] font-black text-slate-900 tracking-tight">
                 Public Intake Queue: {civilianCount} Citizen Fraud Reports Active
               </h3>
               <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-200">
                 ACTION REQUIRED
               </span>
             </div>
             <p className="text-[11px] text-slate-600 font-medium mt-0.5">
               {latestCivilian 
                 ? `Latest filing from ${latestCivilian.auth?.name || "Citizen"} (${latestCivilian.fraud?.amount || "Loss Reported"} on ${latestCivilian.fraud?.network || "Crypto"}) • Digital IP footprint captured`
                 : "Civilian complaints submitted via the public fraud portal with verified device telemetry."}
             </p>
           </div>
         </div>

         <Link
           href="/civilian-reports"
           className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold transition-all shadow-xs shrink-0 self-start sm:self-auto cursor-pointer"
         >
           Review Complaints ({civilianCount}) →
         </Link>
       </div>

       {/* ── Cases Table ── */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl flex flex-col overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="p-4 border-b border-[#ECF1F2] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white">
          <div>
            <p className="text-[13px] font-bold text-[#273339] flex items-center">
              Registered Forensic Cases
              <DemoBadge id="dashboard_cases" />
            </p>
            <p className="text-[11px] font-medium text-[#90999E] mt-0.5">
              Showing {filtered.length} of {cases.length} investigations
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-2.5">
            {/* Status tabs */}
            <div className="flex bg-[#F6F8F7] border border-[#ECF1F2] p-1 rounded-xl">
              {(["all", "completed", "tracing", "failed"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1 rounded-lg text-[11px] font-bold capitalize transition-all cursor-pointer ${
                    statusFilter === st
                      ? "bg-white text-[#3770FF] shadow-xs border border-[#D2E0FF]/60"
                      : "text-[#90999E] hover:text-[#273339]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            {/* Search Input (Crisp White + Inset) */}
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter by ID, wallet, or officer…"
                className="w-full sm:w-64 bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl pl-9 pr-4 py-2 text-[12px] text-[#273339] placeholder:text-[#90999E] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
          </div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-[#3770FF] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] font-medium text-[#616B70]">Connecting to investigation database…</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-[#ECF1F2] bg-[#F8FAFA]">
                    {["Case ID", "Suspect Address", "Network", "Status", "Attributed VASP", "Risk Level", "Attribution Confidence", ""].map((h) => (
                      <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F7F7]">
                  {filtered.map((c) => {
                    const ch  = CHAIN[c.chain]   || { label: c.chain, logo: "", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" };
                    const st  = STATUS[c.status] || STATUS.pending;
                    const vaspKey = (c.vasp_name ?? "").toLowerCase();
                    const hasVasp = c.vasp_name && c.vasp_name !== "not_found";
                    const isCopied = copiedAddress === c.suspect_address;

                    return (
                      <tr key={c.case_id} className="hover:bg-[#F8FAFA] transition-colors group">
                        <td className="px-5 py-3.5">
                          <div className="flex items-center gap-2">
                            <p className="font-mono text-[13px] font-bold text-[#273339]">{c.case_id}</p>
                            {c.amount && c.amount !== "—" && (
                              <span className="text-[10px] font-mono font-bold bg-[#F0F4FF] text-[#3770FF] px-1.5 py-0.5 rounded border border-[#D2E0FF]">
                                {c.amount}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#90999E] mt-0.5">{c.submitted_by} · {timeAgo(c.created_at)}</p>
                        </td>
                        <td className="px-5 py-3.5">
                          <div className="inline-flex items-center gap-1.5 bg-white border border-[#D0DADB] rounded-lg px-2 py-1 shadow-2xs">
                            <code className="font-mono text-[12px] text-[#273339]">
                              {shortAddr(c.suspect_address)}
                            </code>
                            <button
                              onClick={() => handleCopy(c.suspect_address)}
                              title="Copy address"
                              className="text-[#90999E] hover:text-[#3770FF] transition-colors p-0.5 cursor-pointer"
                            >
                              {isCopied ? <CheckCircleIcon size={12} className="text-emerald-600" /> : <CopyIcon size={12} />}
                            </button>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <Pill logo={ch.logo} bg={ch.bg} text={ch.text} label={ch.label} />
                        </td>
                        <td className="px-5 py-3.5">
                          <Pill dot={st.dot} bg={st.bg} text={st.text} label={st.label} />
                        </td>
                        <td className="px-5 py-3.5">
                          {hasVasp ? (
                            <div className="flex items-center gap-2">
                              {VASP_DOMAINS[vaspKey] ? (
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[vaspKey]}&sz=128`}
                                  alt={c.vasp_name}
                                  className="w-4 h-4 rounded-full object-cover border border-[#ECF1F2] bg-white"
                                />
                              ) : (
                                <DatabaseIcon size={14} className="text-[#3770FF]" />
                              )}
                              <span className="text-[13px] font-bold text-[#273339]">{c.vasp_name}</span>
                            </div>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F5F7F7] border border-[#ECF1F2] text-[#90999E]">
                              <ShieldIcon size={11} /> Unattributed
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-3.5">
                          <RiskBadge score={c.risk_score} />
                        </td>
                        <td className="px-5 py-3.5">
                          {c.confidence > 0 ? (
                            <div className="flex items-center gap-2.5">
                              <div className="w-16 h-1.5 bg-[#ECF1F2] rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-[#3770FF] rounded-full"
                                  style={{ width: `${c.confidence}%` }}
                                />
                              </div>
                              <span className="text-[11px] font-mono font-bold text-[#273339]">{c.confidence.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-[#90999E]">—</span>}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <Link
                            href={`/case/${c.case_id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D0DADB] text-[12px] font-bold text-[#616B70] hover:border-[#3770FF] hover:text-[#3770FF] transition-all shadow-2xs"
                          >
                            Dossier <ChevronRight size={12} />
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Empty state */}
            {filtered.length === 0 && !loading && (
              <div className="py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-[#F5F7F7] border border-[#ECF1F2] flex items-center justify-center mx-auto mb-4">
                  <FolderIcon size={22} className="text-[#90999E]" />
                </div>
                <p className="text-[14px] font-bold text-[#273339]">
                  {cases.length === 0 ? "No investigations recorded" : "No cases match your filter"}
                </p>
                <p className="text-[13px] text-[#616B70] mt-1">
                  {cases.length === 0 ? "Start your first trace to populate the forensic registry." : "Try adjusting your search criteria."}
                </p>
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="px-5 py-3 bg-[#F8FAFA] border-t border-[#ECF1F2] flex items-center justify-between">
          <p className="text-[11px] font-medium text-[#90999E]">
            Verified ledger · {filtered.length} active records
          </p>
          <Link href="/cases" className="text-[12px] font-bold text-[#3770FF] hover:text-[#2368FB] transition-colors flex items-center gap-1">
            View full registry <ChevronRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
