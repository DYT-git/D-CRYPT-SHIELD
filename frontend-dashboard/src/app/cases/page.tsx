"use client";

import { useState } from "react";
import Link from "next/link";
import {
  FolderIcon,
  SearchIcon,
  CheckCircleIcon,
  ClockIcon,
  XCircleIcon,
  ExternalIcon,
  PlusIcon,
  CopyIcon,
  ChevronDown,
} from "@/components/Icons";

const ALL_CASES = [
  { id: "CASE-2024-IN-0891",   address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", chain: "ethereum", status: "completed", vasp: "CoinDCX India (FIU-IND)", confidence: 99, hops: 4, risk: "high",     submitted: "Special Cell Cyber PS", ts: "2026-09-18", amount: "14.25 ETH"   },
  { id: "CASE-2024-DEF-4402",  address: "0x098B716B8Aaf215190988513afF39BA65EdAB176", chain: "ethereum", status: "completed", vasp: "Tornado Cash (OFAC)",    confidence: 99, hops: 4, risk: "critical", submitted: "Cyber CID Bengaluru",   ts: "2026-09-17", amount: "100.0 ETH"  },
  { id: "CASE-2024-P2P-7719",  address: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8", chain: "ethereum", status: "completed", vasp: "Binance 14 (FIU-IND)",  confidence: 98, hops: 3, risk: "high",     submitted: "Cyberabad Cyber PS",    ts: "2026-09-17", amount: "45,000 USDT"},
  { id: "CASE-2024-SAFE-0100", address: "0x5c43B1eD97e52d009611D89b74fA829FE4ac56b1", chain: "ethereum", status: "completed", vasp: "Aave V3 Core Pool",      confidence: 98, hops: 2, risk: "low",      submitted: "Financial Intel Unit",  ts: "2026-09-16", amount: "50.0 ETH"   },
  { id: "CASE-2024-001",       address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", chain: "ethereum", status: "completed", vasp: "Binance India",          confidence: 97, hops: 3, risk: "low",      submitted: "Insp. Sharma",         ts: "2026-08-27", amount: "12.4 ETH"   },
  { id: "CASE-2024-002",       address: "TF5Bn4cJCT6GqbAac1HQrGEbT1cEJEDYzA",         chain: "tron",     status: "completed", vasp: "Huobi Global",           confidence: 88, hops: 5, risk: "medium",   submitted: "Insp. Patel",          ts: "2026-08-26", amount: "45,000 TRX" },
  { id: "CASE-2024-003",       address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",            chain: "bitcoin",  status: "tracing",   vasp: null,                     confidence: 0,  hops: 7, risk: "high",     submitted: "SI Mehta",             ts: "2026-08-27", amount: "0.8 BTC"    },
  { id: "CASE-2024-004",       address: "0xddfAbCdc4D8FfC6d5bebbFD5d9d5f6a7B22F52e", chain: "ethereum", status: "completed", vasp: "Coinbase Prime",         confidence: 99, hops: 2, risk: "low",      submitted: "ACP Verma",            ts: "2026-08-25", amount: "5.1 ETH"    },
];

const CHAIN_META: Record<string, { label: string; color: string; dot: string; logo: string }> = {
  ethereum: { label: "Ethereum", color: "bg-indigo-50 border-indigo-200 text-indigo-700",   dot: "bg-indigo-500", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  bitcoin:  { label: "Bitcoin",  color: "bg-amber-50 border-amber-200 text-amber-700",      dot: "bg-amber-500",  logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032"  },
  tron:     { label: "Tron",     color: "bg-red-50 border-red-200 text-red-700",            dot: "bg-red-500",    logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032"     },
  bnb:      { label: "BNB",      color: "bg-yellow-50 border-yellow-200 text-yellow-700",   dot: "bg-yellow-500", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032"      },
  polygon:  { label: "Polygon",  color: "bg-purple-50 border-purple-200 text-purple-700",   dot: "bg-purple-500", logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032"},
  solana:   { label: "Solana",   color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700",dot: "bg-fuchsia-500",logo: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032"   },
};

const VASP_DOMAINS: Record<string, string> = {
  binance: "binance.com", coinbase: "coinbase.com", okx: "okx.com",
  kraken: "kraken.com", huobi: "htx.com", kucoin: "kucoin.com",
};

const TOKEN_LOGOS: Record<string, string> = {
  ETH:  "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032",
  BTC:  "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032",
  TRX:  "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032",
  BNB:  "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032",
  MATIC:"https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032",
  SOL:  "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.svg?v=032",
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<{size?:number;className?:string}> }> = {
  completed: { label: "Completed", color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircleIcon },
  tracing:   { label: "Tracing",   color: "bg-blue-50 border-blue-200 text-blue-700",           icon: ClockIcon       },
  pending:   { label: "Pending",   color: "bg-amber-50 border-amber-200 text-amber-700",         icon: ClockIcon       },
  failed:    { label: "Failed",    color: "bg-red-50 border-red-200 text-red-700",               icon: XCircleIcon     },
};

const RISK_STYLES: Record<string, string> = {
  low:      "bg-emerald-50 border-emerald-200 text-emerald-700",
  medium:   "bg-amber-50 border-amber-200 text-amber-700",
  high:     "bg-orange-50 border-orange-200 text-orange-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

function shortAddr(addr: string) {
  return addr.length > 20 ? addr.slice(0, 8) + "…" + addr.slice(-6) : addr;
}

export default function CasesPage() {
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chainFilter, setChainFilter]   = useState("all");
  const [copiedAddr, setCopiedAddr]     = useState<string | null>(null);

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 1800);
  };

  const filtered = ALL_CASES.filter((c) => {
    const matchSearch = !search ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      (c.vasp || "").toLowerCase().includes(search.toLowerCase()) ||
      c.submitted.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchChain  = chainFilter  === "all" || c.chain  === chainFilter;
    return matchSearch && matchStatus && matchChain;
  });

  const counts = {
    total:     ALL_CASES.length,
    completed: ALL_CASES.filter(c => c.status === "completed").length,
    active:    ALL_CASES.filter(c => c.status === "tracing" || c.status === "pending").length,
    failed:    ALL_CASES.filter(c => c.status === "failed").length,
  };

  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-[#273339] tracking-tight">Active Investigations</h1>
          <p className="text-[12px] text-[#616B70] mt-0.5 font-medium">{counts.total} registered forensic files</p>
        </div>
        <Link
          href="/trace"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] text-white text-[12px] font-bold transition-all shadow-xs shrink-0"
        >
          <PlusIcon size={14} />
          New Investigation
        </Link>
      </div>

      {/* Summary KPI Pills */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { label: "Total Files",  count: counts.total,     color: "bg-white border-[#ECF1F2] text-[#273339]" },
          { label: "Resolved",     count: counts.completed, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "In Flight",    count: counts.active,    color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Unresolved",   count: counts.failed,    color: "bg-red-50 border-red-200 text-red-700" },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-[13px] font-bold shadow-2xs ${s.color}`}>
            <span className="text-[16px] leading-none">{s.count}</span>
            <span className="font-semibold text-[11px] opacity-70 font-eyebrow uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter Toolbar with Inset Inputs */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl p-4 flex flex-col sm:flex-row gap-3 shadow-2xs">
        <div className="relative flex-1 min-w-[200px] flex items-center">
          <SearchIcon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#90999E]" />
          <input
            className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl pl-9 pr-4 py-2 text-[12px] text-[#273339] placeholder:text-[#90999E] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            placeholder="Search by ID, suspect address, VASP, or officer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-3 pr-8 py-2 text-[12px] text-[#273339] outline-none cursor-pointer appearance-none min-w-[140px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <option value="all">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="tracing">Tracing</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={chainFilter}
            onChange={(e) => setChainFilter(e.target.value)}
            className="bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-3 pr-8 py-2 text-[12px] text-[#273339] outline-none cursor-pointer appearance-none min-w-[130px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <option value="all">All Chains</option>
            {Object.entries(CHAIN_META).map(([id, m]) => (
              <option key={id} value={id}>{m.label}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
        </div>
      </div>

      {/* Cases Table */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl overflow-hidden shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-[#ECF1F2] bg-white flex items-center justify-between">
          <p className="text-[13px] font-bold text-[#273339]">Investigation Records</p>
          <p className="text-[11px] text-[#90999E] font-medium">{filtered.length} of {ALL_CASES.length} matches</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-[#ECF1F2] bg-[#F8FAFA]">
                {["Case ID", "Suspect Address", "Network", "Seized Volume", "Status", "Attributed VASP", "Risk Tier", "Hops", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F7F7]">
              {filtered.map((c) => {
                const statusM = STATUS_META[c.status] || STATUS_META.pending;
                const StatusIcon = statusM.icon;
                const chainM = CHAIN_META[c.chain] || { label: c.chain, color: "bg-[#F5F7F7] border-[#ECF1F2] text-[#616B70]", dot: "bg-slate-400", logo: "" };
                const amountParts = c.amount.split(" ");
                const amountNum   = amountParts[0];
                const amountToken = amountParts[1];
                const isCopied    = copiedAddr === c.address;

                return (
                  <tr key={c.id} className="hover:bg-[#F8FAFA] transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-[13px] font-bold text-[#273339]">{c.id}</p>
                      <p className="text-[11px] text-[#90999E] mt-0.5">{c.submitted} · {c.ts}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="inline-flex items-center gap-1.5 bg-white border border-[#D0DADB] rounded-lg px-2 py-0.5 shadow-2xs">
                        <code className="font-mono text-[12px] text-[#273339]">{shortAddr(c.address)}</code>
                        <button
                          onClick={() => handleCopy(c.address)}
                          title="Copy full address"
                          className="text-[#90999E] hover:text-[#3770FF] transition-colors"
                        >
                          {isCopied ? <CheckCircleIcon size={11} className="text-emerald-600" /> : <CopyIcon size={11} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${chainM.color}`}>
                        {chainM.logo ? (
                          <img src={chainM.logo} alt={chainM.label} className="w-3.5 h-3.5 object-contain" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chainM.dot}`} />
                        )}
                        {chainM.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] font-mono font-medium text-[#273339]">
                        <span>{amountNum}</span>
                        {amountToken && TOKEN_LOGOS[amountToken] && (
                          <img src={TOKEN_LOGOS[amountToken]} alt={amountToken} className="w-3.5 h-3.5 object-contain" />
                        )}
                        <span>{amountToken}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-bold tracking-wide ${statusM.color} ${c.status === "tracing" ? "animate-pulse" : ""}`}>
                        <StatusIcon size={11} />
                        {statusM.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.vasp ? (
                        <div className="flex items-center gap-2">
                          {VASP_DOMAINS[(c.vasp.split(" ")[0] || "").toLowerCase()] && (
                            <img
                              src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[(c.vasp.split(" ")[0] || "").toLowerCase()]}&sz=128`}
                              alt={c.vasp}
                              className="w-4 h-4 rounded-full object-cover border border-[#ECF1F2] shrink-0 bg-white"
                            />
                          )}
                          <span className="text-[13px] font-bold text-[#273339]">{c.vasp}</span>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-[#F5F7F7] border border-[#ECF1F2] text-[#90999E]">
                          Unattributed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider font-eyebrow ${RISK_STYLES[c.risk] || "bg-[#F5F7F7] border-[#ECF1F2] text-[#616B70]"}`}>
                        {c.risk}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-mono font-bold text-[#616B70]">{c.hops > 0 ? c.hops : "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Link
                        href={`/case/${c.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#D0DADB] text-[12px] font-bold text-[#616B70] hover:border-[#3770FF] hover:text-[#3770FF] transition-all shadow-2xs"
                      >
                        View <ExternalIcon size={11} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
