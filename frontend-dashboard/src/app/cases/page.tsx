"use client";
import { useState } from "react";
import Link from "next/link";
import {
  FolderIcon, SearchIcon, CheckCircleIcon,
  ClockIcon, XCircleIcon, ExternalIcon, AlertCircleIcon, PlusIcon,
  MoreHorizontalIcon,
} from "@/components/Icons";

const ALL_CASES = [
  { id: "CASE-2024-001", address: "0x3f5CE5FBFe3E9af3971dD833D26bA9b5C936f0bE", chain: "ethereum", status: "completed", vasp: "Binance",   confidence: 97, hops: 3, risk: "low",     submitted: "Insp. Sharma",  ts: "2026-08-27", amount: "12.4 ETH"  },
  { id: "CASE-2024-002", address: "TF5Bn4cJCT6GqbAac1HQrGEbT1cEJEDYzA",         chain: "tron",     status: "completed", vasp: "Huobi",    confidence: 88, hops: 5, risk: "medium",  submitted: "Insp. Patel",   ts: "2026-08-26", amount: "45,000 TRX"},
  { id: "CASE-2024-003", address: "1A1zP1eP5QGefi2DMPTfTL5SLmv7Divf",            chain: "bitcoin",  status: "tracing",   vasp: null,       confidence: 0,  hops: 7, risk: "high",    submitted: "SI Mehta",      ts: "2026-08-27", amount: "0.8 BTC"   },
  { id: "CASE-2024-004", address: "0xddfAbCdc4D8FfC6d5bebbFD5d9d5f6a7B22F52e", chain: "ethereum", status: "completed", vasp: "Coinbase", confidence: 99, hops: 2, risk: "low",     submitted: "ACP Verma",     ts: "2026-08-25", amount: "5.1 ETH"  },
  { id: "CASE-2024-005", address: "0x2910543Af39abA0Cd09dBa440E3F60A0b2f8960", chain: "bnb",      status: "failed",    vasp: null,       confidence: 0,  hops: 10,risk: "critical", submitted: "Insp. Sharma",  ts: "2026-08-24", amount: "120 BNB"  },
  { id: "CASE-2024-006", address: "9xDQeMf3TPZFpGJ9j3dq7s8mGnMcRgqUh5",          chain: "solana",   status: "completed", vasp: "OKX",      confidence: 85, hops: 4, risk: "medium",  submitted: "SI Nair",       ts: "2026-08-23", amount: "200 SOL"  },
  { id: "CASE-2024-007", address: "0x71C7656EC7ab88b098defB751B7401B5f6d8976F", chain: "polygon",  status: "pending",   vasp: null,       confidence: 0,  hops: 0, risk: "high",    submitted: "DCP Rao",       ts: "2026-08-27", amount: "8,000 MATIC"},
  { id: "CASE-2024-008", address: "0x56Eddb7aa87536c09CCc2793473599fD21A8b17",  chain: "ethereum", status: "completed", vasp: "Kraken",   confidence: 91, hops: 6, risk: "medium",  submitted: "Insp. Singh",   ts: "2026-08-22", amount: "2.9 ETH"  },
];

const CHAIN_META: Record<string, { label: string; color: string; dot: string; logo: string }> = {
  ethereum: { label: "Ethereum", color: "bg-indigo-50 border-indigo-200 text-indigo-700", dot: "bg-indigo-500", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  bitcoin:  { label: "Bitcoin",  color: "bg-amber-50 border-amber-200 text-amber-700",  dot: "bg-amber-500", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032"  },
  tron:     { label: "Tron",     color: "bg-red-50 border-red-200 text-red-700",    dot: "bg-red-500", logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032"    },
  bnb:      { label: "BNB",      color: "bg-yellow-50 border-yellow-200 text-yellow-700", dot: "bg-yellow-500", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032" },
  polygon:  { label: "Polygon",  color: "bg-purple-50 border-purple-200 text-purple-700", dot: "bg-purple-500", logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" },
  solana:   { label: "Solana",   color: "bg-fuchsia-50 border-fuchsia-200 text-fuchsia-700", dot: "bg-fuchsia-500", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032" },
};

const VASP_DOMAINS: Record<string, string> = {
  "binance": "binance.com",
  "coinbase": "coinbase.com",
  "okx": "okx.com",
  "kraken": "kraken.com",
  "huobi": "htx.com",
  "kucoin": "kucoin.com",
};

const TOKEN_LOGOS: Record<string, string> = {
  ETH: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032",
  BTC: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032",
  TRX: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032",
  BNB: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032",
  MATIC: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032",
  SOL: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032",
};

const STATUS_META: Record<string, { label: string; color: string; icon: React.FC<{size?:number;className?:string}> }> = {
  completed: { label: "Completed", color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: CheckCircleIcon },
  tracing:   { label: "Tracing",   color: "bg-blue-50 border-blue-200 text-blue-700",     icon: ClockIcon       },
  pending:   { label: "Pending",   color: "bg-amber-50 border-amber-200 text-amber-700",    icon: ClockIcon       },
  failed:    { label: "Failed",    color: "bg-red-50 border-red-200 text-red-700",      icon: XCircleIcon     },
};

const RISK_TEXT: Record<string, string> = {
  low: "text-emerald-700", medium: "text-amber-700", high: "text-orange-700", critical: "text-red-700",
};

function shortAddr(addr: string) {
  return addr.length > 20 ? addr.slice(0, 10) + "…" + addr.slice(-8) : addr;
}

export default function CasesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [chainFilter, setChainFilter] = useState("all");

  const filtered = ALL_CASES.filter((c) => {
    const matchSearch = !search ||
      c.id.toLowerCase().includes(search.toLowerCase()) ||
      c.address.toLowerCase().includes(search.toLowerCase()) ||
      (c.vasp || "").toLowerCase().includes(search.toLowerCase()) ||
      c.submitted.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "all" || c.status === statusFilter;
    const matchChain  = chainFilter  === "all" || c.chain === chainFilter;
    return matchSearch && matchStatus && matchChain;
  });

  const counts = {
    total: ALL_CASES.length,
    completed: ALL_CASES.filter((c) => c.status === "completed").length,
    tracing: ALL_CASES.filter((c) => c.status === "tracing" || c.status === "pending").length,
    failed: ALL_CASES.filter((c) => c.status === "failed").length,
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
            <FolderIcon size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight m-0">All Cases</h1>
            <p className="text-sm font-medium text-slate-500 mt-1.5">{counts.total} total investigations</p>
          </div>
        </div>
        <Link
          href="/trace"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[13px] font-semibold transition-colors shadow-sm shrink-0"
        >
          <PlusIcon size={16} />
          New Investigation
        </Link>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-2.5">
        {[
          { label: "Total",     count: counts.total,     color: "bg-white border-slate-200 text-slate-700" },
          { label: "Completed", count: counts.completed, color: "bg-emerald-50 border-emerald-200 text-emerald-700" },
          { label: "Active",    count: counts.tracing,   color: "bg-blue-50 border-blue-200 text-blue-700" },
          { label: "Failed",    count: counts.failed,    color: "bg-red-50 border-red-200 text-red-700" },
        ].map((s) => (
          <div key={s.label} className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg border text-[13px] font-bold shadow-sm ${s.color}`}>
            <span>{s.count}</span>
            <span className="opacity-80 font-semibold text-[12px]">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-3 shadow-sm">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <SearchIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            className="w-full bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-9 pr-4 py-2 text-[13px] text-slate-900 placeholder:text-slate-400 outline-none transition-shadow shadow-sm"
            placeholder="Search by ID, address, VASP, or officer…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2 text-[13px] text-slate-900 outline-none transition-shadow cursor-pointer shadow-sm appearance-none min-w-[150px]"
        >
          <option value="all">All Statuses</option>
          <option value="completed">Completed</option>
          <option value="tracing">Tracing</option>
          <option value="pending">Pending</option>
          <option value="failed">Failed</option>
        </select>

        {/* Chain filter */}
        <select
          value={chainFilter}
          onChange={(e) => setChainFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2 text-[13px] text-slate-900 outline-none transition-shadow cursor-pointer shadow-sm appearance-none min-w-[150px]"
        >
          <option value="all">All Chains</option>
          {Object.entries(CHAIN_META).map(([id, m]) => (
            <option key={id} value={id}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-3">
          <p className="text-sm font-semibold text-slate-900 tracking-wide m-0">Investigation Records</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left whitespace-nowrap">
            <thead>
              <tr className="border-b border-slate-200 bg-white">
                {["Case ID", "Suspect Address", "Network", "Amount", "Status", "VASP Found", "Risk", "Hops", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((c) => {
                const statusM = STATUS_META[c.status] || STATUS_META.pending;
                const StatusIcon = statusM.icon;
                const chainM = CHAIN_META[c.chain] || { label: c.chain, color: "bg-slate-50 border-slate-200 text-slate-700", dot: "bg-slate-400" };
                return (
                  <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-mono text-[13px] font-semibold text-slate-900">{c.id}</p>
                      <p className="text-[11px] font-medium text-slate-500 mt-1">{c.submitted} · {c.ts}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <code className="font-mono text-[12px] text-slate-600 px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200">{shortAddr(c.address)}</code>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wide ${chainM.color}`}>
                        {chainM.logo ? (
                          <img src={chainM.logo} alt={chainM.label} className="w-3.5 h-3.5 object-contain" />
                        ) : (
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${chainM.dot}`} />
                        )}
                        {chainM.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-[12px] font-mono font-medium text-slate-600">
                        <span>{c.amount.split(" ")[0]}</span>
                        {c.amount.split(" ")[1] && TOKEN_LOGOS[c.amount.split(" ")[1]] && (
                          <img src={TOKEN_LOGOS[c.amount.split(" ")[1]]} alt={c.amount.split(" ")[1]} className="w-3.5 h-3.5 object-contain" />
                        )}
                        <span>{c.amount.split(" ")[1]}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[11px] font-semibold tracking-wide ${statusM.color} ${c.status === "tracing" ? "animate-pulse" : ""}`}>
                        <StatusIcon size={12} />
                        {statusM.label}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      {c.vasp ? (
                        <div className="flex items-center gap-2">
                          {VASP_DOMAINS[c.vasp.toLowerCase()] && (
                            <img src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[c.vasp.toLowerCase()]}&sz=128`} alt={c.vasp} className="w-4 h-4 rounded-full object-cover border border-slate-200 shrink-0 bg-white" />
                          )}
                          <span className="text-[13px] font-bold text-slate-900">{c.vasp}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-medium">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-[11px] font-semibold uppercase tracking-wider ${RISK_TEXT[c.risk]}`}>{c.risk}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-[12px] font-mono font-medium text-slate-500">{c.hops > 0 ? c.hops : "—"}</span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/case/${c.id}`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-[12px] font-bold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all"
                        >
                          View <ExternalIcon size={12} />
                        </Link>
                        <button className="p-1.5 rounded-lg bg-white border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] text-slate-400 hover:bg-slate-50 hover:text-slate-900 transition-all">
                          <MoreHorizontalIcon size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-20 text-center bg-slate-50/50">
                    <div className="w-12 h-12 bg-white border border-slate-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                      <SearchIcon size={20} className="text-slate-400" />
                    </div>
                    <p className="text-[14px] font-bold text-slate-900 m-0">No investigations found</p>
                    <p className="text-[13px] font-medium text-slate-500 mt-1 mb-5 m-0 max-w-sm mx-auto">
                      We couldn't find any cases matching your current search and filter criteria.
                    </p>
                    <button 
                      onClick={() => { setSearch(""); setStatusFilter("all"); setChainFilter("all"); }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-[13px] font-bold text-slate-700 hover:bg-slate-50 transition-all shadow-sm"
                    >
                      Clear Filters
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200">
          <p className="text-[12px] font-medium text-slate-500">Showing {filtered.length} of {ALL_CASES.length} cases</p>
        </div>
      </div>
    </div>
  );
}
