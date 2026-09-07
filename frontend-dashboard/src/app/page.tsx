"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import {
  ActivityIcon, ShieldIcon, DatabaseIcon, ArrowUpIcon, ArrowDownIcon,
  ChevronRight, PlusIcon, CalendarIcon, DownloadIcon, MoreHorizontalIcon,
  FolderIcon, NetworkIcon, ExternalIcon, RefreshIcon,
} from "@/components/Icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─────────────────────────────────────────────────────────────
// Constants / helpers
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

const RISK_BG:   Record<string, string> = { low: "bg-emerald-500", medium: "bg-amber-500", high: "bg-orange-500", critical: "bg-red-600" };
const RISK_TEXT: Record<string, string> = { low: "text-emerald-700", medium: "text-amber-700", high: "text-orange-700", critical: "text-red-700" };

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
}

function shortAddr(a: string) { return a.length > 22 ? a.slice(0, 10) + "…" + a.slice(-8) : a; }
function timeAgo(iso?: string): string {
  if (!iso) return "—";
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} days ago`;
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

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [cases, setCases]           = useState<CaseRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [lastRefresh, setLastRefresh]   = useState<Date | null>(null);

  const loadCases = async () => {
    try {
      setError(null);
      const res = await fetch(`${API}/api/v1/cases`);
      if (!res.ok) throw new Error(`API error ${res.status}`);
      const data = await res.json();
      // Backend returns { cases: [...], count: N }
      setCases(Array.isArray(data.cases) ? data.cases : []);
      setLastRefresh(new Date());
    } catch (e: any) {
      setError(e.message ?? "Failed to load cases");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadCases(); }, []);

  // ── Derived stats from real data ──
  const totalCases     = cases.length;
  const vaspsFound     = cases.filter(c => c.vasp_name && c.vasp_name !== "not_found").length;
  const activeTraces   = cases.filter(c => c.status === "tracing" || c.status === "pending").length;
  const criticalCases  = cases.filter(c => c.risk_score >= 75).length;
  const avgHops        = 0; // Not returned per-row; skip or compute from separate endpoint

  const STATS = [
    {
      label: "Total Cases",
      value: loading ? "—" : totalCases.toString(),
      deltaValue: activeTraces.toString(),
      deltaLabel: "currently active",
      deltaType: activeTraces > 0 ? "positive" : "positive",
      icon: FolderIcon,
      iconBg: "bg-blue-50", iconColor: "text-blue-600", iconBorder: "border-blue-100",
    },
    {
      label: "VASPs Identified",
      value: loading ? "—" : vaspsFound.toString(),
      deltaValue: totalCases > 0 ? `${((vaspsFound / totalCases) * 100).toFixed(0)}%` : "0%",
      deltaLabel: "success rate",
      deltaType: "positive",
      icon: DatabaseIcon,
      iconBg: "bg-emerald-50", iconColor: "text-emerald-600", iconBorder: "border-emerald-100",
    },
    {
      label: "Active Traces",
      value: loading ? "—" : activeTraces.toString(),
      deltaValue: criticalCases.toString(),
      deltaLabel: "flagged critical",
      deltaType: criticalCases > 0 ? "negative" : "positive",
      icon: ActivityIcon,
      iconBg: "bg-amber-50", iconColor: "text-amber-600", iconBorder: "border-amber-100",
    },
    {
      label: "Completed",
      value: loading ? "—" : cases.filter(c => c.status === "completed").length.toString(),
      deltaValue: cases.filter(c => c.status === "failed").length.toString(),
      deltaLabel: "failed",
      deltaType: cases.filter(c => c.status === "failed").length > 0 ? "negative" : "positive",
      icon: NetworkIcon,
      iconBg: "bg-purple-50", iconColor: "text-purple-600", iconBorder: "border-purple-100",
    },
  ];


  // ── Filter ──
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
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Investigation Dashboard</h1>
          <p className="text-[13px] font-bold text-slate-500 mt-1.5 uppercase tracking-widest">
            D-CRYPT Tracer · Ministry of Home Affairs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadCases}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[13px] font-bold hover:bg-slate-50 hover:border-slate-300 transition-colors shadow-[0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <RefreshIcon size={14} className="text-slate-500" />
            Refresh
          </button>
          <Link
            href="/trace"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-bold transition-all shadow-sm shrink-0"
          >
            <PlusIcon size={16} strokeWidth={2.5} />
            New Trace
          </Link>
        </div>
      </div>

      {/* ── Error banner ── */}
      {error && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
          <ShieldIcon size={16} className="text-red-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-red-800">Could not load cases from backend</p>
            <p className="text-xs text-red-600 mt-0.5">{error} — Is the backend running on port 9090?</p>
          </div>
          <button onClick={loadCases} className="ml-auto text-xs font-bold text-red-700 hover:underline">Retry</button>
        </div>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {STATS.map((s) => {
          const Icon = s.icon;
          const isPositive = s.deltaType === "positive";
          const TrendIcon = isPositive ? ArrowUpIcon : ArrowDownIcon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</p>
                  <p className="text-3xl font-bold text-slate-900 mt-2 tracking-tight">{s.value}</p>
                </div>
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border shadow-sm ${s.iconBg} ${s.iconColor} ${s.iconBorder}`}>
                  <Icon size={20} />
                </div>
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${isPositive ? "bg-emerald-50 border-emerald-200 text-emerald-700" : "bg-red-50 border-red-200 text-red-700"}`}>
                  <TrendIcon size={12} strokeWidth={3} />
                  {s.deltaValue}
                </span>
                <span className="text-[12px] font-medium text-slate-500">{s.deltaLabel}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Cases Table ── */}
      <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">

        {/* Toolbar */}
        <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50/50">
          <div>
            <p className="text-[15px] font-bold text-slate-900">Recent Investigations</p>
            <p className="text-[11px] font-medium text-slate-400 mt-0.5">
              Live from DB · Last refreshed {lastRefresh ? lastRefresh.toLocaleTimeString("en-IN") : "..."}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            {/* Status tabs */}
            <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
              {(["all", "completed", "tracing", "failed"] as const).map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg text-[12px] font-bold capitalize transition-all duration-200 ${
                    statusFilter === st
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200/50"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
            {/* Search */}
            <div className="relative">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
              </svg>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cases…"
                className="w-full sm:w-60 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-9 pr-4 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition-all shadow-sm"
              />
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm font-medium text-slate-500">Loading cases from backend…</p>
          </div>
        ) : (
          <>
            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left whitespace-nowrap">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    {["Case ID", "Suspect Address", "Network", "Status", "VASP Found", "Risk", "Confidence", ""].map((h) => (
                      <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((c) => {
                    const ch = CHAIN[c.chain]   || { label: c.chain, logo: "", bg: "bg-slate-50 border-slate-200", text: "text-slate-700" };
                    const st = STATUS[c.status] || STATUS.pending;
                    const rb = RISK_BG[c.risk_score >= 75 ? "critical" : c.risk_score >= 45 ? "high" : c.risk_score >= 25 ? "medium" : "low"]   || "bg-slate-300";
                    const rt = RISK_TEXT[c.risk_score >= 75 ? "critical" : c.risk_score >= 45 ? "high" : c.risk_score >= 25 ? "medium" : "low"] || "text-slate-500";
                    const vaspKey = (c.vasp_name ?? "").toLowerCase();
                    const hasVasp = c.vasp_name && c.vasp_name !== "not_found";

                    return (
                      <tr key={c.case_id} className="hover:bg-slate-50 transition-colors group">
                        <td className="px-6 py-4">
                          <p className="font-mono text-[13px] font-bold text-slate-900">{c.case_id}</p>
                          <p className="text-[11px] font-medium text-slate-500 mt-1">
                            {c.submitted_by} · {timeAgo(c.created_at)}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <code className="font-mono text-[12px] text-slate-600 px-2 py-1 rounded-md bg-slate-100 border border-slate-200">
                            {shortAddr(c.suspect_address)}
                          </code>
                        </td>
                        <td className="px-6 py-4">
                          <Pill logo={ch.logo} bg={ch.bg} text={ch.text} label={ch.label} />
                        </td>
                        <td className="px-6 py-4">
                          <Pill dot={st.dot} bg={st.bg} text={st.text} label={st.label} />
                        </td>
                        <td className="px-6 py-4">
                          {hasVasp ? (
                            <div className="flex items-center gap-2">
                              {VASP_DOMAINS[vaspKey] && (
                                <img
                                  src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[vaspKey]}&sz=128`}
                                  alt={c.vasp_name}
                                  className="w-4 h-4 rounded-full object-cover border border-slate-200 bg-white"
                                />
                              )}
                              <span className="text-[13px] font-bold text-slate-900">{c.vasp_name}</span>
                            </div>
                          ) : (
                            <span className="text-slate-400 font-medium">—</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider ${
                            c.risk_score >= 75 ? "bg-red-50 border-red-200 text-red-700"
                            : c.risk_score >= 45 ? "bg-orange-50 border-orange-200 text-orange-700"
                            : c.risk_score >= 25 ? "bg-amber-50 border-amber-200 text-amber-700"
                            : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}>
                            {c.risk_score >= 75 ? "critical" : c.risk_score >= 45 ? "high" : c.risk_score >= 25 ? "medium" : "low"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {c.confidence > 0 ? (
                            <div className="flex items-center gap-3">
                              <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shadow-inner">
                                <div className={`h-full ${rb} rounded-full`} style={{ width: `${c.confidence}%` }} />
                              </div>
                              <span className="text-[11px] font-mono font-bold text-slate-600">{c.confidence.toFixed(0)}%</span>
                            </div>
                          ) : <span className="text-slate-400 font-medium">—</span>}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/case/${c.case_id}`}
                            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                          >
                            View <ExternalIcon size={12} />
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
                <FolderIcon size={28} className="text-slate-300 mx-auto mb-3" />
                <p className="text-sm font-bold text-slate-500">
                  {cases.length === 0 ? "No cases yet — start your first trace!" : "No cases match your filter."}
                </p>
                {cases.length === 0 && (
                  <Link href="/trace" className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors">
                    <PlusIcon size={14} /> Start New Trace
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <p className="text-[12px] font-bold text-slate-500">
            Showing {filtered.length} of {cases.length} cases
          </p>
          <Link href="/cases" className="text-[12px] font-bold text-blue-600 hover:text-blue-700 transition-colors uppercase tracking-wider">
            View all cases →
          </Link>
        </div>
      </div>
    </div>
  );
}
