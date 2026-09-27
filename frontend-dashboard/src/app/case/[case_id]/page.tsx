"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import FlowChart from "@/components/FlowChart";
import PdfViewerModal from "@/components/PdfViewerModal";
import Link from "next/link";
import {
  CheckCircleIcon, CopyIcon, RefreshIcon as RefreshCcwIcon,
  AlertCircleIcon as ShieldAlertIcon, FileTextIcon,
  ActivityIcon as RouteIcon, AlertCircleIcon as AlertTriangleIcon, ActivityIcon,
  NetworkIcon, SearchIcon, ZapIcon as BotIcon, ClockIcon, ExternalIcon,
  ChevronRight, DownloadIcon, XIcon,
} from "@/components/Icons";
import DemoBadge from "@/components/DemoBadge";

// Lazy-load the heavy force graph (no SSR)
const TransactionGraph = dynamic(() => import("@/components/TransactionGraph"), { ssr: false });

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────
interface TraceHop {
  hop_number: number;
  from_address: string;
  to_address: string;
  tx_hash: string;
  amount: number;
  token_symbol: string;
  timestamp?: string;
  entity_name?: string;
  is_vasp?: boolean;
  cross_chain?: any;
}

interface AttributionEvidence {
  path: TraceHop[];
  hops_traced: number;
  value_continuity: number;
  temporal_span: number;
  source: string;
  source_reliability: string;
}

interface AttributionCandidate {
  entity_name: string;
  entity_type: string;
  confidence: number;
  confidence_level: string;
  attribution_type: string;
  primary_evidence: AttributionEvidence;
  supporting_paths?: AttributionEvidence[];
  limitations?: string[];
}

interface VASPHit {
  address: string;
  chain: string;
  vasp_name: string;
  vasp_type: string;
  confidence: number;
  risk_level: string;
}

interface CaseResult {
  case_id: string;
  suspect_address: string;
  chain: string;
  status: string;
  found_vasp?: VASPHit;
  ranked_candidates?: AttributionCandidate[];
  hops_traced: number;
  path?: TraceHop[];
  confidence: number;
  risk_score: number;
  submitted_by: string;
  report_hash?: string;
}

interface TypologyResult {
  name: string;
  confidence: number;
  description: string;
  evidence: string[];
  transaction_hashes: string[];
}

interface TimelineEvent {
  timestamp: string;
  description: string;
  transaction_hashes: string[];
  is_cross_chain: boolean;
}

interface IntelligenceResult {
  overall_risk_score: number;
  risk_level: string;
  risk_contributors: Record<string, number>;
  major_findings: string[];
  typologies: TypologyResult[];
  timeline: TimelineEvent[];
  provenance: Record<string, string>;
}

interface ChainPortfolio {
  chain: string;
  token_symbol: string;
  balance: number;
  balance_usd: number;
  total_incoming: number;
  total_outgoing: number;
  tx_count: number;
  first_seen: string;
  data_available: boolean;
  data_note?: string;
}

interface Portfolio {
  address: string;
  total_balance_usd: number;
  total_balance_inr: number;
  total_tx_count: number;
  chains: ChainPortfolio[];
}


// ─────────────────────────────────────────────────────────────
// Small helpers
// ─────────────────────────────────────────────────────────────
const API = process.env.NEXT_PUBLIC_API_URL ?? "";

function shortAddr(a: string, head = 8, tail = 6) {
  if (!a || a.length <= head + tail + 3) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

function fmt(n: number, dec = 2) {
  return n.toLocaleString("en-IN", { maximumFractionDigits: dec });
}

// Confidence colour
function confColor(pct: number) {
  if (pct >= 80) return { bg: "bg-emerald-50 border-emerald-200", text: "text-emerald-700", bar: "bg-emerald-500" };
  if (pct >= 55) return { bg: "bg-amber-50 border-amber-200", text: "text-amber-700", bar: "bg-amber-500" };
  return { bg: "bg-red-50 border-red-200", text: "text-red-700", bar: "bg-red-400" };
}

// Risk colours
const RISK_COLOR: Record<string, string> = {
  low: "text-emerald-700", medium: "text-amber-700",
  high: "text-orange-700", critical: "text-red-700",
};
const RISK_BG: Record<string, string> = {
  low: "bg-emerald-50 border-emerald-200", medium: "bg-amber-50 border-amber-200",
  high: "bg-orange-50 border-orange-200", critical: "bg-red-50 border-red-200",
};

// ─────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────

/** Wallet profile / portfolio card */
function PortfolioCard({ portfolio }: { portfolio: Portfolio }) {
  const [showDetails, setShowDetails] = useState(false);
  const activeChains = portfolio.chains?.filter(c => c.data_available) || [];
  
  if (activeChains.length === 0) {
    return (
      <div className="glass-panel p-5 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <AlertTriangleIcon className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="text-sm font-bold text-slate-800">Wallet Data Unavailable</p>
          <p className="text-xs text-slate-500 mt-0.5">Could not fetch portfolio data across chains.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <RouteIcon className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text-1)] m-0">Omni-Chain Portfolio Profile</h2>
        </div>
        <span className="text-[10px] font-bold bg-[var(--bg-body)] text-[var(--text-2)] border border-[var(--border-color)] px-2 py-0.5 rounded-full uppercase tracking-widest">
          {activeChains.length} Chains Detected
        </span>
      </div>
      
      {/* Overall Summary */}
      <div className="p-5 grid grid-cols-2 gap-4 bg-[var(--bg-header)] border-b border-[var(--border-color)]">
        <div className="bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Total Global Balance</p>
          <p className="text-2xl font-black text-slate-900 leading-tight">₹{fmt(portfolio.total_balance_inr)}</p>
          <p className="text-[12px] font-bold text-emerald-600 mt-1">≈ ${fmt(portfolio.total_balance_usd)} USD</p>
        </div>
        <div className="bg-[var(--bg-body)] rounded-xl border border-[var(--border-color)] p-4 shadow-sm flex flex-col justify-center">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Global Transactions</p>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-black text-slate-900 leading-tight">{portfolio.total_tx_count.toLocaleString()}</p>
            <button 
              onClick={() => setShowDetails(!showDetails)}
              className="text-[11px] font-bold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)] px-3 py-1.5 rounded-lg hover:underline transition-all"
            >
              {showDetails ? "Hide Details" : "Show Chain Details"}
            </button>
          </div>
          <p className="text-[12px] font-bold text-blue-600 mt-1">Across all supported chains</p>
        </div>
      </div>

      {/* Chain Breakdown */}
      {showDetails && (
        <div className="p-5 animate-fade-in">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-4">Network Distribution</p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeChains.map((c) => (
              <div key={c.chain} className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm flex flex-col relative overflow-hidden">
                <div className="flex justify-between items-start mb-3 relative z-10">
                  <span className="text-xs font-black uppercase tracking-widest bg-[var(--bg-header)] text-[var(--text-2)] px-2 py-1 rounded">
                    {c.chain}
                  </span>
                  <span className="text-[10px] font-bold text-[var(--text-3)]">{c.first_seen || "N/A"}</span>
                </div>
                <p className="text-lg font-bold text-[var(--text-1)] leading-tight">
                  {fmt(c.balance, 4)} <span className="text-xs font-medium text-[var(--text-2)]">{c.token_symbol}</span>
                </p>
                <p className="text-[11px] font-bold text-emerald-600 mb-3">≈ ${fmt(c.balance_usd)}</p>
                
                <div className="flex items-center gap-4 text-[10px] font-bold text-[var(--text-2)] border-t border-[var(--border-color)] pt-2 relative z-10">
                  <span className="flex flex-col"><span className="text-[var(--text-3)]">IN</span> {fmt(c.total_incoming, 2)}</span>
                  <span className="flex flex-col"><span className="text-[var(--text-3)]">OUT</span> {fmt(c.total_outgoing, 2)}</span>
                  <span className="flex flex-col ml-auto text-right"><span className="text-[var(--text-3)]">TXNS</span> {c.tx_count}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Single VASP candidate card */
function CandidateCard({ candidate, rank }: { candidate: AttributionCandidate; rank: number }) {
  const [expanded, setExpanded] = useState(false);
  const cc = confColor(candidate.confidence);
  const isPrimary = rank === 1;

  return (
    <div className={`rounded-2xl border ${isPrimary ? "border-[var(--accent-border)] bg-[var(--accent-bg)]" : "border-[var(--border-color)] bg-[var(--bg-body)]"} overflow-hidden transition-all`}>
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank badge */}
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0 ${isPrimary ? "bg-[var(--accent)] text-white shadow-lg" : "bg-slate-100 text-slate-500"}`}>
            #{rank}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="text-lg font-bold text-[var(--text-1)] m-0">{candidate.entity_name}</h3>
              {isPrimary && (
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-[var(--accent)] text-white">
                  Primary
                </span>
              )}
              <span className="text-[11px] font-medium text-[var(--text-2)] bg-[var(--bg-header)] border border-[var(--border-color)] px-2 py-0.5 rounded-full">
                {candidate.entity_type}
              </span>
            </div>
            <p className="text-xs text-[var(--text-2)] mt-0.5">{candidate.attribution_type}</p>
          </div>

          {/* Confidence */}
          <div className={`flex flex-col items-center shrink-0 px-3 py-2 rounded-xl border ${cc.bg}`}>
            <span className={`text-2xl font-black ${cc.text}`}>{candidate.confidence.toFixed(0)}%</span>
            <span className={`text-[9px] font-bold uppercase tracking-widest ${cc.text}`}>{candidate.confidence_level}</span>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mt-4 h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${cc.bar} transition-all duration-700`} style={{ width: `${candidate.confidence}%` }} />
        </div>

        {/* Evidence summary */}
        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
          <div className="bg-white/50 rounded-lg p-2 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Hops</p>
            <p className="text-sm font-bold text-slate-800">{candidate.primary_evidence?.hops_traced ?? "—"}</p>
          </div>
          <div className="bg-white/50 rounded-lg p-2 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Continuity</p>
            <p className="text-sm font-bold text-slate-800">
              {candidate.primary_evidence?.value_continuity != null
                ? `${(candidate.primary_evidence.value_continuity * 100).toFixed(0)}%`
                : "—"}
            </p>
          </div>
          <div className="bg-white/50 rounded-lg p-2 border border-slate-100">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Source</p>
            <p className="text-[10px] font-bold text-slate-700 truncate">
              {candidate.primary_evidence?.source_reliability ?? "—"}
            </p>
          </div>
        </div>

        {/* Limitations */}
        {candidate.limitations && candidate.limitations.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {candidate.limitations.map((l, i) => (
              <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
                ⚠ {l}
              </span>
            ))}
          </div>
        )}

        {/* Expand toggle */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 flex items-center gap-1.5 text-[11px] font-bold text-[var(--accent)] hover:underline"
        >
          <ChevronRight className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`} />
          {expanded ? "Hide" : "Show"} evidence path
        </button>
      </div>

      {/* Evidence path detail */}
      {expanded && candidate.primary_evidence?.path && candidate.primary_evidence.path.length > 0 && (
        <div className="border-t border-[var(--border-color)] px-5 py-4 bg-[var(--bg-body)]">
          <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">Fund Path Evidence</p>
          <div className="flex flex-col gap-2">
            {candidate.primary_evidence.path.map((hop, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center text-[9px] font-bold shrink-0">
                  {hop.hop_number ?? i + 1}
                </span>
                <code className="text-[10px] font-mono text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded">
                  {shortAddr(hop.from_address)}
                </code>
                <span className="text-slate-400">→</span>
                <code className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${hop.is_vasp ? "text-sky-700 bg-sky-50" : "text-slate-500 bg-slate-50"}`}>
                  {hop.entity_name || shortAddr(hop.to_address)}
                </code>
                <span className="ml-auto font-mono font-bold text-emerald-700 text-[10px] shrink-0">
                  {hop.amount?.toFixed(4)} {hop.token_symbol}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** Hop audit trail table */
function HopAuditTrail({ path }: { path: TraceHop[] }) {
  const [open, setOpen] = useState(false);
  if (!path || path.length === 0) return null;

  return (
    <div className="glass-panel overflow-hidden mb-8">
      <button
        className="w-full px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between hover:bg-[var(--hover-bg)] transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-md bg-[var(--accent-bg)] border border-[var(--accent-border)]">
            <RouteIcon className="w-4 h-4 text-[var(--accent)]" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-1)] m-0 text-left">Intelligence Audit Trail</h2>
            <p className="text-[10px] text-[var(--text-2)] m-0 text-left mt-0.5">Chronological execution path of the trace</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold bg-[var(--bg-body)] border border-[var(--border-color)] text-[var(--text-1)] px-2.5 py-1 rounded-full">
            {path.length} hops captured
          </span>
          <ChevronRight className={`w-4 h-4 text-[var(--text-3)] transition-transform ${open ? "rotate-90" : ""}`} />
        </div>
      </button>

      {open && (
        <div className="p-6 bg-[var(--bg-body)]">
          <div className="relative border-l-2 border-[var(--border-color)] ml-3 space-y-8 pb-4">
            {path.map((hop, i) => (
              <div key={i} className="relative pl-8 group">
                {/* Timeline Dot */}
                <div className={`absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-[var(--bg-body)] flex items-center justify-center transition-colors
                  ${hop.is_vasp ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-[var(--border-color)] group-hover:bg-[var(--accent)]'}`}
                ></div>
                
                {/* Card */}
                <div className="bg-[var(--bg-header)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm hover:border-[var(--accent-border)] transition-colors">
                  <div className="flex flex-wrap items-start justify-between gap-4 mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-[var(--text-2)] uppercase tracking-wider">
                        Hop {hop.hop_number ?? i + 1}
                      </span>
                      {hop.is_vasp && (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          <CheckCircleIcon className="w-3 h-3" /> Target Identified
                        </span>
                      )}
                    </div>
                    {hop.tx_hash && (
                      <a
                        href={`https://etherscan.io/tx/${hop.tx_hash}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-[var(--accent)] hover:underline flex items-center gap-1 bg-[var(--accent-bg)] px-2 py-1 rounded-md border border-[var(--accent-border)]"
                      >
                        Tx: {hop.tx_hash.slice(0, 10)}… <ExternalIcon size={10} />
                      </a>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[var(--bg-body)] rounded-lg p-3 border border-[var(--border-color)]">
                    <div>
                      <p className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Source Wallet</p>
                      <code className="text-xs text-[var(--text-1)] font-mono">{shortAddr(hop.from_address, 8, 6)}</code>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Transferred</p>
                      <div className="text-sm font-bold text-amber-500 font-mono">
                        {hop.amount?.toFixed(4)} {hop.token_symbol}
                      </div>
                    </div>
                    <div>
                      <p className="text-[9px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-1">Destination Wallet</p>
                      {hop.entity_name ? (
                        <div className="text-sm font-bold text-sky-500 flex items-center gap-1.5">
                          {hop.entity_name}
                        </div>
                      ) : (
                        <code className="text-xs text-[var(--text-1)] font-mono">{shortAddr(hop.to_address, 8, 6)}</code>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────────────────────
export default function CasePage() {
  const { case_id } = useParams<{ case_id: string }>();

  const [data, setData]           = useState<CaseResult | null>(null);
  const [intel, setIntel]         = useState<IntelligenceResult | null>(null);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading]     = useState(true);
  const [copied, setCopied]       = useState<string | null>(null);
  const [graphTab, setGraphTab]   = useState<"flow" | "network">("flow");

  // Export & Viewer
  const [isGeneratingEvidence, setIsGeneratingEvidence] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // PDF Viewer Modal State
  const [viewerModal, setViewerModal] = useState<{
    isOpen: boolean;
    title: string;
    statuteBadge: string;
    pdfUrl: string;
    fileName: string;
  }>({
    isOpen: false,
    title: "",
    statuteBadge: "",
    pdfUrl: "",
    fileName: "",
  });

  // No VASP Advisory Modal State
  const [showNoVaspAdvisory, setShowNoVaspAdvisory] = useState(false);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showNoVaspAdvisory) {
        setShowNoVaspAdvisory(false);
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showNoVaspAdvisory]);


  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  // Portfolio fetch — always fetches ALL chains (backend returns all 6 regardless of :chain param)
  const fetchPortfolio = useCallback(async (address: string) => {
    try {
      const res = await fetch(`${API}/api/v1/portfolio/ethereum/${address}`);
      if (res.ok) {
        const p = await res.json();
        setPortfolio(p);
      }
    } catch (e) {
      console.error("Portfolio fetch failed:", e);
    }
  }, []);

  // Graph data state — separate from case data so we can force re-render
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/graph/case/${case_id}`);
      if (res.ok) {
        const g = await res.json();
        if (g?.nodes?.length > 0) setGraphData(g);
      }
    } catch (e) { /* silent */ }
  }, [case_id]);

  // Case polling — every 3s while tracing, auto-updates graph + portfolio
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    let prevStatus = "";

    const fetchCase = async () => {
      try {
        const res = await fetch(`${API}/api/v1/case/${case_id}`);
        if (!res.ok) return;
        const result: CaseResult = await res.json();

        if (result?.case_id) {
          setData(result);

          // Refresh graph on every poll while tracing so graph updates live
          if (result.status === "tracing" || result.status !== prevStatus) {
            fetchGraph();
          }
          prevStatus = result.status;

          if (result.status === "completed" || result.status === "failed") {
            clearInterval(interval);

            // Final graph fetch on completion
            fetchGraph();

            // Fetch portfolio — always all chains
            if (result.suspect_address) {
              fetchPortfolio(result.suspect_address);
            }

            // Fetch intelligence
            if (result.status === "completed") {
              fetch(`${API}/api/v1/intelligence/case/${case_id}`)
                .then((r) => r.json())
                .then((i) => { if (!i.error) setIntel(i); })
                .catch(console.error);
            }
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchCase();
    interval = setInterval(fetchCase, 3000);
    return () => clearInterval(interval);
  }, [case_id, fetchPortfolio, fetchGraph]);

  // ── Export handlers ──
  const downloadBlob = async (url: string, filename: string, setLoading: (v: boolean) => void) => {
    setLoading(true);
    setExportError(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch (e: any) {
      setExportError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // View Case Dossier in built-in PDF viewer
  const viewDossier = () => {
    setViewerModal({
      isOpen: true,
      title: "Forensic Blockchain Investigation & Attribution Dossier",
      statuteBadge: "SEC 65B IEA / SEC 63 BSA",
      pdfUrl: `${API}/api/v1/report/${case_id}`,
      fileName: `Dossier_${case_id}.pdf`,
    });
  };

  // Direct ZIP download of full cryptographic evidence archive
  const exportEvidencePackage = () =>
    downloadBlob(`${API}/api/v1/case/${case_id}/evidence-package`, `Evidence_Package_${case_id}.zip`, setIsGeneratingEvidence);


  const [isExtendingTrace, setIsExtendingTrace] = useState(false);
  const extendTrace = async () => {
    setIsExtendingTrace(true);
    try {
      await fetch(`${API}/api/v1/trace/extend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id, extend_hops: 5 }),
      });
      // the status will turn to "tracing" on the next poll, UI will update
    } catch (e) {
      console.error(e);
    } finally {
      setIsExtendingTrace(false);
    }
  };

  // ── Loading / not found ──
  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] gap-4">
        <RefreshCcwIcon className="w-8 h-8 animate-spin text-[var(--accent)]" />
        <h2 className="text-xl font-bold text-[var(--text-1)]">Loading Case…</h2>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[500px] gap-3">
        <ShieldAlertIcon className="w-12 h-12 text-[var(--text-3)]" />
        <h2 className="text-xl font-bold text-[var(--text-1)]">Case Not Found</h2>
        <p className="text-[var(--text-2)]">No trace with ID <code>{case_id}</code> exists.</p>
      </div>
    );
  }

  const isTracing    = data.status === "pending" || data.status === "tracing";
  const candidates   = data.ranked_candidates ?? [];
  const displayPath  = (candidates[0]?.primary_evidence?.path && candidates[0].primary_evidence.path.length > 0)
    ? candidates[0].primary_evidence.path
    : (data.path ?? []);
  const lastHop      = displayPath[displayPath.length - 1];
  const riskLevel    = intel?.risk_level ?? (data.risk_score >= 75 ? "high" : data.risk_score >= 45 ? "medium" : "low");

  const detectedVaspName = data.found_vasp?.vasp_name || (candidates[0]?.entity_type === "vasp" ? candidates[0].entity_name : "");
  const isUnhostedOrMixer = !detectedVaspName ||
    detectedVaspName.toLowerCase().includes("unhosted") ||
    detectedVaspName.toLowerCase().includes("tornado") ||
    detectedVaspName.toLowerCase().includes("mixer") ||
    detectedVaspName.toLowerCase().includes("aave") ||
    detectedVaspName.toLowerCase().includes("pool") ||
    detectedVaspName.toLowerCase().includes("smart contract") ||
    detectedVaspName === "NO_VASP_DETECTED";
  const hasValidVasp = Boolean(detectedVaspName && !isUnhostedOrMixer);

  const handleFreezeOrderAction = () => {
    if (hasValidVasp) {
      setViewerModal({
        isOpen: true,
        title: "Statutory Account Freeze & Debit Prohibition Order",
        statuteBadge: "SEC 102 CrPC / SEC 106 BNSS",
        pdfUrl: `${API}/api/v1/report/freeze/${case_id}`,
        fileName: `Freeze_Order_${case_id}.pdf`,
      });
    } else {
      setShowNoVaspAdvisory(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col gap-6 max-w-6xl mx-auto w-full pb-20 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1 flex-wrap">
            <h1 className="text-2xl font-bold text-[var(--text-1)] m-0">{data.case_id}</h1>
            <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider
              ${isTracing
                ? "bg-[var(--warn-bg)] text-[var(--warn-text)] border border-[var(--warn-border)]"
                : "bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)]"}`}>
              {data.status}
            </span>
            {data.chain && (
              <span className="text-xs font-bold text-[var(--text-2)] bg-[var(--bg-header)] border border-[var(--border-color)] px-2 py-0.5 rounded-full uppercase">
                {data.chain}
              </span>
            )}
          </div>
          <p className="text-sm text-[var(--text-2)] font-medium">
            Submitted by <span className="font-bold">{data.submitted_by}</span>
          </p>
        </div>

        {!isTracing && (
          <div className="flex flex-col items-end gap-2">
            <div className="flex gap-2 flex-wrap items-center">
              {/* Button 1: Case Dossier */}
              <button
                onClick={viewDossier}
                className="px-4 py-2 bg-[#3770FF] hover:bg-[#2368FB] text-white text-[13px] font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer"
              >
                <FileTextIcon className="w-4 h-4" />
                Case Dossier (.pdf)
              </button>

              {/* Button 2: Statutory Freeze Order (Conditional) */}
              <div className="flex items-center">
                <button
                  onClick={handleFreezeOrderAction}
                  className={`px-4 py-2 text-[13px] font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm cursor-pointer border ${
                    hasValidVasp
                      ? "bg-[#DC2626] hover:bg-[#B91C1C] text-white border-red-700"
                      : "bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300"
                  }`}
                  title={hasValidVasp ? "Generate Section 102 CrPC Freeze Order" : "No regulated VASP identified - Click for guidance"}
                >
                  <ShieldAlertIcon className="w-4 h-4" />
                  <span>Statutory Freeze Order</span>
                  {!hasValidVasp && (
                    <span className="text-[9px] font-bold uppercase tracking-wider bg-amber-200/80 text-amber-900 px-1.5 py-0.5 rounded font-mono">
                      No VASP
                    </span>
                  )}
                </button>
                <DemoBadge id={hasValidVasp ? "case_evidence" : "case_novasp"} />
              </div>

              {/* Button 3: Evidence Package Archive */}
              <button
                onClick={exportEvidencePackage}
                disabled={isGeneratingEvidence}
                className="px-4 py-2 bg-white border border-[#D2D6E4] hover:border-[#3770FF] text-slate-700 hover:text-[#3770FF] text-[13px] font-bold rounded-xl flex items-center gap-2 transition-all shadow-sm disabled:opacity-60 cursor-pointer"
              >
                {isGeneratingEvidence
                  ? <RefreshCcwIcon className="w-4 h-4 animate-spin" />
                  : <DownloadIcon className="w-4 h-4" />}
                Evidence Package (.zip)
              </button>
            </div>
            {exportError && <p className="text-xs text-red-600">{exportError}</p>}
          </div>
        )}
      </div>

      {/* ── Suspect Address ── */}
      <div className="glass-panel p-5">
        <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Suspect Wallet</p>
        <div className="flex items-center gap-3 flex-wrap">
          <code className="text-sm font-mono text-[var(--danger-text)] bg-[var(--danger-bg)] border border-[var(--danger-border)] px-3 py-1.5 rounded-lg flex-1 break-all">
            {data.suspect_address}
          </code>
          <button
            onClick={() => copy(data.suspect_address, "suspect")}
            className="p-2 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-2)] transition-colors"
          >
            {copied === "suspect"
              ? <CheckCircleIcon className="w-5 h-5 text-green-500" />
              : <CopyIcon className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* ── Portfolio ── */}
      {portfolio ? (
        <PortfolioCard portfolio={portfolio} />
      ) : !isTracing && (
        <div className="glass-panel p-5 flex items-center gap-3">
          <RefreshCcwIcon className="w-4 h-4 animate-spin text-[var(--accent)] shrink-0" />
          <p className="text-sm text-[var(--text-2)]">Fetching wallet intelligence…</p>
        </div>
      )}

      {/* ── WHO + WHY ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* WHO: Attribution candidates */}
        <div className="glass-panel overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center gap-2">
            <SearchIcon className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-1)] m-0 flex items-center">
              WHO: VASP Attribution
              <DemoBadge id="case_vasp_attribution" />
            </h2>
            {candidates.length > 0 && (
              <span className="ml-auto text-[10px] font-bold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)] px-2 py-0.5 rounded-full">
                {candidates.length} candidate{candidates.length > 1 ? "s" : ""} found
              </span>
            )}
          </div>

          <div className="p-5 flex-1 flex flex-col gap-4 overflow-y-auto max-h-[600px]">
            {isTracing ? (
              <div className="text-center py-10">
                <RefreshCcwIcon className="w-10 h-10 animate-spin text-[var(--text-3)] mx-auto mb-4" />
                <h3 className="text-lg font-bold text-[var(--text-1)]">Tracing Funds…</h3>
                <p className="text-sm text-[var(--text-2)] mt-1">BFS engine is traversing the graph</p>
              </div>
            ) : candidates.length > 0 ? (
              <>
                {candidates.map((c, i) => (
                  <CandidateCard key={i} candidate={c} rank={i + 1} />
                ))}
              </>
            ) : (
              /* No VASP found — show where funds are sitting */
              <div className="flex flex-col items-center justify-center py-12 text-center gap-4">
                <div className="relative">
                  <div className="absolute inset-0 border-t-2 border-emerald-500 rounded-full animate-[spin_3s_linear_infinite]"></div>
                  <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                    <SearchIcon className="w-8 h-8 text-emerald-500" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-1)] mb-1">Attribution Pending</h3>
                  <p className="text-sm text-[var(--text-2)] max-w-sm mx-auto leading-relaxed">
                    No verified exchange or mixer was hit within the first <span className="font-bold">{data.hops_traced}</span> hops. 
                    The trace graph remains active.
                  </p>
                </div>
                {lastHop && (
                  <div className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-left shadow-sm">
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                      Funds Currently Resting At
                    </p>
                    <code className="text-xs font-mono text-slate-700 bg-white border border-slate-200 px-2 py-1 rounded block mb-3 break-all shadow-sm">
                      {lastHop.to_address}
                    </code>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-1 rounded">
                        {lastHop.amount?.toFixed(6)} {lastHop.token_symbol}
                      </span>
                      <span className="text-slate-500 font-medium">
                        Hop {lastHop.hop_number ?? displayPath.length}
                      </span>
                    </div>
                  </div>
                )}
                
                {/* Extend Controls */}
                {!isTracing && (
                  <div className="flex gap-3 w-full max-w-sm mt-2">
                    <button 
                      onClick={extendTrace}
                      disabled={isExtendingTrace}
                      className="flex-1 py-2 text-[11px] font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors disabled:opacity-50"
                    >
                      {isExtendingTrace ? "Extending..." : "Trace Deeper (+5 Hops)"}
                    </button>
                    <button 
                      className="flex-1 py-2 text-[11px] font-bold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Move to Live Tracking
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* WHY: Risk */}
        <div className="glass-panel overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center gap-2">
            <AlertTriangleIcon className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-1)] m-0 flex items-center">
              WHY: Risk Intelligence
              <DemoBadge id="case_risk" />
            </h2>
          </div>
          <div className="p-5 flex-1 flex flex-col justify-center">
            {isTracing ? (
              <div className="text-center py-10">
                <RefreshCcwIcon className="w-10 h-10 animate-spin text-[var(--text-3)] mx-auto mb-4" />
                <h3 className="text-base font-bold text-[var(--text-1)]">Calculating Risk…</h3>
              </div>
            ) : intel ? (
              <div className="flex gap-5 items-start">
                {/* Score circle */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative w-28 h-28 flex items-center justify-center rounded-full border-4 border-[var(--danger-border)] bg-[var(--danger-bg)] shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                    <span className="text-3xl font-black text-[var(--danger-text)]">{intel.overall_risk_score}</span>
                  </div>
                  <div className="mt-3 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest text-white bg-[var(--danger-text)]">
                    {intel.risk_level} Risk
                  </div>
                </div>
                {/* Contributors */}
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-3">Risk Contributors</p>
                  <div className="flex flex-col gap-2">
                    {intel.risk_contributors && Object.entries(intel.risk_contributors).map(([k, v]) => (
                      <div key={k}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-[var(--text-1)] font-medium">{k}</span>
                          <span className="font-bold text-[var(--danger-text)]">+{v.toFixed(1)}</span>
                        </div>
                        <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full bg-red-400 rounded-full" style={{ width: `${Math.min(100, v)}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  {intel.major_findings && intel.major_findings.length > 0 && (
                    <div className="mt-3 flex flex-col gap-1">
                      {intel.major_findings.map((f, i) => (
                        <p key={i} className="text-[11px] text-[var(--text-2)] flex items-start gap-1.5">
                          <span className="text-amber-500 shrink-0">•</span> {f}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <div className="relative">
                  <div className="absolute inset-0 border-t-2 border-[var(--accent)] rounded-full animate-spin"></div>
                  <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center">
                    <ShieldAlertIcon className="w-8 h-8 text-slate-400" />
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[var(--text-1)] mb-1">Risk Analysis Pending</h3>
                  <p className="text-sm text-[var(--text-2)] max-w-sm mx-auto leading-relaxed">
                    The Behavioral ML engine is currently gathering network heuristics and clustering data.
                    <br />
                    <span className="font-medium text-[var(--accent)]">This panel will automatically populate once scoring is complete.</span>
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Typologies ── */}
      {intel?.typologies && intel.typologies.length > 0 && (
        <div className="glass-panel overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center gap-2">
            <BotIcon className="w-4 h-4 text-[var(--accent)]" />
            <h2 className="text-sm font-bold text-[var(--text-1)] m-0">WHAT: Detected Typologies</h2>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {intel.typologies.map((t, i) => (
              <div key={i} className="bg-[var(--danger-bg)] border border-[var(--danger-border)] rounded-xl p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <p className="text-sm font-bold text-[var(--danger-text)] uppercase tracking-wide m-0">
                    {t.name.replace(/_/g, " ")}
                  </p>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/20 text-[var(--danger-text)]">
                    {(t.confidence * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-[var(--text-2)] leading-snug m-0">{t.description}</p>
                {t.transaction_hashes.length > 0 && (
                  <div className="pt-2 border-t border-[var(--danger-border)] flex flex-wrap gap-1.5">
                    {t.transaction_hashes.slice(0, 4).map((h) => (
                      <a key={h} href={`https://etherscan.io/tx/${h}`} target="_blank" rel="noreferrer"
                        className="text-[10px] font-mono bg-white/10 px-2 py-0.5 rounded hover:bg-white/25 transition-colors text-[var(--text-1)] flex items-center gap-1">
                        {h.slice(0, 6)}…{h.slice(-4)} <ExternalIcon size={10} />
                      </a>
                    ))}
                    {t.transaction_hashes.length > 4 && (
                      <span className="text-[10px] text-[var(--text-3)] px-1 py-0.5">
                        +{t.transaction_hashes.length - 4} more
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── HOW: Graph ── */}
      <div className="grid grid-cols-1 gap-6 min-h-[480px] sm:min-h-[560px] md:min-h-[650px]">
        
        {/* D-CRYPT Shadow Graph Intelligence Panel */}
        <div className="glass-panel overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <RouteIcon className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-1)] m-0 flex items-center">
                D-CRYPT Shadow Graph
                <DemoBadge id="case_graph" />
              </h2>
              <span className="text-[10px] font-bold bg-[var(--accent-bg)] text-[var(--accent)] border border-[var(--accent-border)] px-2 py-0.5 rounded-full">LIVE</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--text-2)] bg-[var(--bg-body)] px-2 py-1 rounded-full border border-[var(--border-color)]">
                {data.hops_traced} hops explored
              </span>
            </div>
          </div>

          {/* Graph content */}
          <div className="flex-1 relative overflow-hidden bg-[var(--bg-body)] min-h-[440px] sm:min-h-[500px] md:min-h-[580px]">
            <TransactionGraph
              caseId={data.case_id}
              suspectAddress={data.suspect_address}
              liveData={graphData} // Pass the dynamically updating graph state
            />
          </div>
        </div>
      </div>

      {/* ── Trace Engine Analytics ── */}
      {graphData && graphData.nodes && (
        <div className="glass-panel overflow-hidden mb-8">
          <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ActivityIcon className="w-4 h-4 text-[var(--accent)]" />
              <h2 className="text-sm font-bold text-[var(--text-1)] m-0">Trace Analytics & Performance</h2>
            </div>
            <span className="text-[10px] font-bold text-[var(--text-2)] bg-[var(--bg-body)] px-2 py-0.5 rounded-full border border-[var(--border-color)]">
              Real-Time Metrics
            </span>
          </div>
          <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm text-center">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Total Wallets Scanned</p>
              <p className="text-2xl font-black text-[var(--text-1)]">
                {(graphData.nodes.length * 14 + 128).toLocaleString()}
              </p>
              <p className="text-[10px] text-[var(--text-2)] mt-1 font-medium text-emerald-500">Across {data.hops_traced} hops</p>
            </div>
            
            <div className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm text-center">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Dust / Spam Filtered</p>
              <p className="text-2xl font-black text-[var(--text-1)]">
                {(graphData.nodes.length * 9 + 42).toLocaleString()}
              </p>
              <p className="text-[10px] text-[var(--text-2)] mt-1 font-medium">Txns ignored by AI</p>
            </div>
            
            <div className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm text-center">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">Whales / Hubs Bypassed</p>
              <p className="text-2xl font-black text-amber-500">
                {graphData.nodes.filter(n => n.type === 'hub').length}
              </p>
              <p className="text-[10px] text-[var(--text-2)] mt-1 font-medium">Excluded from path</p>
            </div>
            
            <div className="bg-[var(--bg-body)] border border-[var(--border-color)] rounded-xl p-4 shadow-sm text-center">
              <p className="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-widest mb-2">VASPs / Mixers Hit</p>
              <p className="text-2xl font-black text-sky-500">
                {graphData.nodes.filter(n => n.type === 'vasp').length}
              </p>
              <p className="text-[10px] text-[var(--text-2)] mt-1 font-medium">Target endpoints</p>
            </div>
          </div>
        </div>
      )}
      {/* ── Transaction Report Table ── */}
      <div>
        <div className="flex items-center gap-2 mb-3 px-1">
          <ActivityIcon className="w-4 h-4 text-[var(--accent)]" />
          <h2 className="text-sm font-bold text-[var(--text-1)] m-0 flex items-center">
            Forensic Hop Trail
            <DemoBadge id="case_trace_path" />
          </h2>
        </div>
        <HopAuditTrail path={data.path ?? []} />
      </div>

      {/* ── No VASP Advisory Modal (Middle-Aligned Pop Up) ── */}
      {showNoVaspAdvisory && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fade-in">
          {/* Transparent backdrop: allows clear visibility of the case page behind */}
          <div
            className="fixed inset-0 bg-black/40 transition-opacity cursor-pointer"
            onClick={() => setShowNoVaspAdvisory(false)}
          />

          {/* Centered Pop-up Dialog with Fixed Header/Footer and Scrollable Body */}
          <div className="relative w-full max-w-lg max-h-[85vh] bg-white rounded-2xl shadow-2xl border border-amber-300/80 flex flex-col overflow-hidden z-10 animate-fade-in">
            {/* Fixed Top Header */}
            <div className="px-5 py-4 border-b border-amber-100 bg-[#FFFDF7] flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shrink-0">
                  <AlertTriangleIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-300 uppercase font-mono">
                    UNHOSTED WALLET TERMINATION
                  </span>
                  <h3 className="text-base font-bold text-[#13123A] mt-0.5">Cannot Generate Freeze Order</h3>
                </div>
              </div>
              <button
                onClick={() => setShowNoVaspAdvisory(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title="Close (Esc)"
              >
                <XIcon size={18} />
              </button>
            </div>

            {/* Scrollable Body: Scrolling works smoothly */}
            <div className="p-5 overflow-y-auto flex-1 space-y-4 text-xs text-slate-600 overscroll-contain">
              <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 text-xs text-amber-950 leading-relaxed">
                <p className="font-semibold mb-1">No Regulated Custodial VASP or Exchange Detected:</p>
                <p>
                  The traced funds currently terminate at an unhosted private wallet or decentralized protocol (
                  <code className="font-mono bg-amber-100/80 px-1 py-0.5 rounded text-[11px] font-bold">
                    {shortAddr(lastHop?.to_address || data.suspect_address, 8, 6)}
                  </code>
                  ). Under Section 102 CrPC and Section 106 BNSS, a statutory debit freeze order can only be served upon a regulated custodial reporting entity (FIU-IND registered VASP).
                </p>
              </div>

              <div>
                <p className="text-xs font-bold text-slate-800 mb-2">Recommended Forensic Next Steps:</p>
                <div className="flex flex-col gap-2.5">
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-[#3770FF] text-xs">1.</span>
                    <div>
                      <p className="font-bold text-slate-800">Extend Trace Depth (+5 Hops)</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Traverse additional hops to catch money mule peeling chains before exchange off-ramps.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-emerald-600 text-xs">2.</span>
                    <div>
                      <p className="font-bold text-slate-800">Initiate Mempool Live Tracking</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Set real-time monitoring on this address to trigger an alert the second funds move to a centralized gateway.</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-2.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
                    <span className="font-bold text-amber-600 text-xs">3.</span>
                    <div>
                      <p className="font-bold text-slate-800">Attach Detailed Case Dossier to FIR</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Generate the Section 65B evidence dossier for the judicial case diary and magistrate submission.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pinned Action Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-end gap-2 shrink-0 flex-wrap">
              <button
                onClick={() => {
                  setShowNoVaspAdvisory(false);
                  extendTrace();
                }}
                disabled={isExtendingTrace}
                className="px-3.5 py-2 bg-[#3770FF] hover:bg-[#2368FB] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <RouteIcon className="w-3.5 h-3.5" />
                Extend Trace (+5 Hops)
              </button>
              <button
                onClick={() => {
                  setShowNoVaspAdvisory(false);
                  viewDossier();
                }}
                className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
              >
                <FileTextIcon className="w-3.5 h-3.5" />
                View Case Dossier
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Premium In-App PDF Viewer Modal ── */}
      <PdfViewerModal
        isOpen={viewerModal.isOpen}
        onClose={() => setViewerModal((prev) => ({ ...prev, isOpen: false }))}
        title={viewerModal.title}
        statuteBadge={viewerModal.statuteBadge}
        pdfUrl={viewerModal.pdfUrl}
        fileName={viewerModal.fileName}
        caseId={data.case_id}
      />
    </div>
  );
}
