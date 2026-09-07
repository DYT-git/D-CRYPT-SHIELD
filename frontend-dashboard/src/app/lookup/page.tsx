"use client";
import { useState } from "react";
import {
  BuildingIcon, SearchIcon, CheckCircleIcon, AlertCircleIcon,
  DatabaseIcon, NetworkIcon, RefreshIcon,
} from "@/components/Icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

// ─────────────────────────────────────────────────────────────
// Static VASP registry (local reference — always available)
// ─────────────────────────────────────────────────────────────
const VASPS = [
  { name: "Binance",        type: "Exchange",          chain: "multi",    addresses: 12400, risk: "low",      country: "Global",     verified: true  },
  { name: "Coinbase",       type: "Exchange",          chain: "ethereum", addresses: 8200,  risk: "low",      country: "USA",        verified: true  },
  { name: "OKX",            type: "Exchange",          chain: "multi",    addresses: 7100,  risk: "low",      country: "Seychelles", verified: true  },
  { name: "Huobi",          type: "Exchange",          chain: "multi",    addresses: 5300,  risk: "medium",   country: "Global",     verified: true  },
  { name: "Kraken",         type: "Exchange",          chain: "multi",    addresses: 4800,  risk: "low",      country: "USA",        verified: true  },
  { name: "KuCoin",         type: "Exchange",          chain: "multi",    addresses: 3900,  risk: "medium",   country: "Seychelles", verified: true  },
  { name: "FixedFloat",     type: "Swap Service",      chain: "multi",    addresses: 420,   risk: "high",     country: "Unknown",    verified: false },
  { name: "Tornado Cash",   type: "Mixer",             chain: "ethereum", addresses: 1100,  risk: "critical", country: "N/A",        verified: true  },
  { name: "ChipMixer",      type: "Mixer",             chain: "bitcoin",  addresses: 880,   risk: "critical", country: "Unknown",    verified: true  },
  { name: "Wormhole Bridge",type: "Cross-chain Bridge",chain: "multi",    addresses: 240,   risk: "medium",   country: "N/A",        verified: true  },
  { name: "LocalBitcoins",  type: "P2P Exchange",      chain: "bitcoin",  addresses: 3100,  risk: "high",     country: "Finland",    verified: true  },
  { name: "Paxful",         type: "P2P Exchange",      chain: "bitcoin",  addresses: 2700,  risk: "high",     country: "USA",        verified: true  },
];

const RISK_META: Record<string, { color: string; bg: string; fill: string }> = {
  low:      { color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", fill: "bg-emerald-500" },
  medium:   { color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",     fill: "bg-amber-500"   },
  high:     { color: "text-orange-700",  bg: "bg-orange-50 border-orange-200",   fill: "bg-orange-500"  },
  critical: { color: "text-red-700",     bg: "bg-red-50 border-red-200",         fill: "bg-red-600"     },
};

const CHAIN_LOGOS: Record<string, string> = {
  ethereum: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032",
  bitcoin:  "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032",
  tron:     "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032",
  bnb:      "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032",
  polygon:  "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032",
  solana:   "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032",
};

const VASP_DOMAINS: Record<string, string> = {
  binance: "binance.com", coinbase: "coinbase.com", okx: "okx.com",
  kraken: "kraken.com", huobi: "htx.com", kucoin: "kucoin.com",
  fixedfloat: "fixedfloat.com", localbitcoins: "localbitcoins.com",
  paxful: "paxful.com", "wormhole bridge": "wormhole.com",
};

const CHAINS_FOR_LOOKUP = [
  { id: "ethereum", label: "ETH"     },
  { id: "bitcoin",  label: "BTC"     },
  { id: "tron",     label: "TRX"     },
  { id: "bnb",      label: "BNB"     },
  { id: "polygon",  label: "MATIC"   },
  { id: "solana",   label: "SOL"     },
];

// ─────────────────────────────────────────────────────────────
// Lookup Result types
// ─────────────────────────────────────────────────────────────
interface LookupHit {
  address: string;
  chain: string;
  is_vasp: boolean;
  vasp?: {
    vasp_name: string;
    vasp_type: string;
    confidence: number;
    risk_level: string;
  };
}

export default function LookupPage() {
  // ── VASP registry filter state ──
  const [search,     setSearch]     = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");

  // ── Address lookup state ──
  const [lookupAddr,    setLookupAddr]    = useState("");
  const [lookupChain,   setLookupChain]   = useState("ethereum");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult,  setLookupResult]  = useState<LookupHit | null>(null);
  const [lookupError,   setLookupError]   = useState<string | null>(null);

  const types = Array.from(new Set(VASPS.map((v) => v.type)));

  const filtered = VASPS.filter((v) => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q) || v.country.toLowerCase().includes(q);
    const matchType   = typeFilter === "all" || v.type === typeFilter;
    const matchRisk   = riskFilter === "all" || v.risk === riskFilter;
    return matchSearch && matchType && matchRisk;
  });

  // ── Address lookup handler ──
  const handleLookup = async () => {
    const addr = lookupAddr.trim();
    if (!addr) return;
    setLookupLoading(true);
    setLookupResult(null);
    setLookupError(null);
    try {
      const res  = await fetch(`${API}/api/v1/lookup/${lookupChain}/${encodeURIComponent(addr)}`);
      const data: LookupHit = await res.json();
      if (!res.ok) throw new Error((data as any).error || "Lookup failed");
      setLookupResult(data);
    } catch (e: any) {
      setLookupError(e.message ?? "Unexpected error during lookup");
    } finally {
      setLookupLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-8 animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <BuildingIcon size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight m-0">VASP Attribution Database</h1>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed font-medium">
            {VASPS.length} labelled entities · Live address check via backend DB
          </p>
        </div>
      </div>

      {/* ── DB Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Entities",  value: VASPS.length,                                                                          icon: DatabaseIcon,    color: "text-blue-600",    bg: "bg-blue-50 border-blue-100"     },
          { label: "Verified",        value: VASPS.filter((v) => v.verified).length,                                                icon: CheckCircleIcon, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-100"},
          { label: "High / Critical", value: VASPS.filter((v) => v.risk === "high" || v.risk === "critical").length,                icon: AlertCircleIcon, color: "text-red-600",     bg: "bg-red-50 border-red-100"       },
          { label: "Total Addresses", value: VASPS.reduce((a, v) => a + v.addresses, 0).toLocaleString(),                          icon: NetworkIcon,     color: "text-purple-600",  bg: "bg-purple-50 border-purple-100" },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl p-5 flex items-center gap-4 shadow-sm">
              <div className={`w-10 h-10 rounded-xl border ${s.bg} flex items-center justify-center shrink-0`}>
                <Icon size={18} className={s.color} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{s.label}</p>
                <p className="text-xl font-bold text-slate-900 mt-1 leading-none">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Direct Address Lookup ── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <SearchIcon size={16} className="text-blue-600" />
          <h3 className="text-[15px] font-bold text-slate-900 m-0">Direct Address Lookup</h3>
        </div>
        <p className="text-[13px] font-medium text-slate-500 mb-4">
          Paste any blockchain address to instantly check if it belongs to a known VASP in our database.
        </p>

        {/* Input row */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Chain selector */}
          <div className="flex gap-1.5 bg-slate-100 border border-slate-200 p-1 rounded-xl">
            {CHAINS_FOR_LOOKUP.map((c) => (
              <button
                key={c.id}
                onClick={() => setLookupChain(c.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                  lookupChain === c.id
                    ? "bg-white text-blue-700 shadow-sm border border-slate-200/50"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
          <input
            placeholder="0x… or bc1… or T…"
            value={lookupAddr}
            onChange={(e) => { setLookupAddr(e.target.value); setLookupResult(null); setLookupError(null); }}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="flex-1 bg-slate-50 border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 rounded-xl px-4 py-3 text-[13px] text-slate-900 font-mono outline-none transition-all shadow-sm"
          />
          <button
            onClick={handleLookup}
            disabled={lookupLoading || !lookupAddr.trim()}
            className="px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-colors shadow-sm shrink-0"
          >
            {lookupLoading
              ? <RefreshIcon size={14} className="animate-spin" />
              : <SearchIcon size={14} />}
            {lookupLoading ? "Checking…" : "Check"}
          </button>
        </div>

        {/* Result panel */}
        {lookupError && (
          <div className="mt-4 p-4 rounded-xl bg-red-50 border border-red-200 flex items-start gap-3">
            <AlertCircleIcon size={16} className="text-red-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-red-800">Lookup Failed</p>
              <p className="text-xs text-red-600 mt-0.5">{lookupError}</p>
            </div>
          </div>
        )}

        {lookupResult && (
          <div className={`mt-4 p-5 rounded-xl border ${lookupResult.is_vasp ? "bg-emerald-50 border-emerald-200" : "bg-slate-50 border-slate-200"}`}>
            {lookupResult.is_vasp && lookupResult.vasp ? (
              /* ── VASP HIT ── */
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                    {VASP_DOMAINS[lookupResult.vasp.vasp_name.toLowerCase()] ? (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[lookupResult.vasp.vasp_name.toLowerCase()]}&sz=128`}
                        alt={lookupResult.vasp.vasp_name}
                        className="w-6 h-6 object-contain"
                      />
                    ) : (
                      <BuildingIcon size={18} className="text-emerald-600" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-bold text-emerald-900">{lookupResult.vasp.vasp_name}</p>
                      <CheckCircleIcon size={15} className="text-emerald-600" />
                    </div>
                    <p className="text-xs font-medium text-emerald-700">{lookupResult.vasp.vasp_type}</p>
                  </div>
                  <div className="ml-auto text-right">
                    <p className="text-xl font-black text-emerald-700">{lookupResult.vasp.confidence}%</p>
                    <p className="text-[10px] font-bold text-emerald-600 uppercase">Confidence</p>
                  </div>
                </div>
                <div className="flex gap-3 flex-wrap">
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${RISK_META[lookupResult.vasp.risk_level]?.bg ?? "bg-slate-50 border-slate-200"} ${RISK_META[lookupResult.vasp.risk_level]?.color ?? "text-slate-600"} uppercase tracking-widest`}>
                    {lookupResult.vasp.risk_level} risk
                  </span>
                  <span className="text-[11px] font-medium text-emerald-700 bg-white border border-emerald-200 px-2 py-0.5 rounded">
                    {lookupResult.chain.toUpperCase()} Network
                  </span>
                </div>
                <code className="text-[11px] font-mono text-emerald-800 break-all bg-white/50 border border-emerald-100 px-3 py-2 rounded-lg">
                  {lookupResult.address}
                </code>
              </div>
            ) : (
              /* ── NOT IN DB ── */
              <div className="flex items-start gap-3">
                <AlertCircleIcon size={18} className="text-slate-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-slate-700">Not in VASP Database</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Address <code className="font-mono bg-slate-100 px-1 rounded">{lookupAddr.slice(0, 12)}…</code> on{" "}
                    <strong>{lookupChain}</strong> is not attributed to any known VASP in our database.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">
                    This does not mean the address is safe. Run a full trace to investigate fund flows.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] font-medium text-slate-500 mt-3">
          Powered by our internal OSINT-seeded attribution database · {VASPS.reduce((a, v) => a + v.addresses, 0).toLocaleString()}+ labelled addresses
        </p>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            placeholder="Search by name, type, country…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-slate-900 outline-none transition-shadow shadow-sm"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="flex-1 min-w-[150px] bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-[13px] text-slate-900 outline-none cursor-pointer shadow-sm appearance-none"
        >
          <option value="all">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select
          value={riskFilter}
          onChange={(e) => setRiskFilter(e.target.value)}
          className="flex-1 min-w-[150px] bg-white border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-2.5 text-[13px] text-slate-900 outline-none cursor-pointer shadow-sm appearance-none"
        >
          <option value="all">All Risk Levels</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* ── VASP Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((vasp) => {
          const risk = RISK_META[vasp.risk] || { color: "text-slate-600", bg: "bg-slate-50 border-slate-200", fill: "bg-slate-400" };
          return (
            <div
              key={vasp.name}
              className="bg-white border border-slate-200 rounded-2xl p-5 transition-all hover:border-slate-300 hover:shadow-md flex flex-col shadow-sm"
            >
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 overflow-hidden">
                    {VASP_DOMAINS[vasp.name.toLowerCase()] ? (
                      <img src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[vasp.name.toLowerCase()]}&sz=128`} alt={vasp.name} className="w-full h-full object-cover bg-white" />
                    ) : (
                      <BuildingIcon size={16} className="text-slate-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold text-slate-900 m-0">{vasp.name}</p>
                      {vasp.verified && <CheckCircleIcon size={14} className="text-blue-600" />}
                    </div>
                    <p className="text-xs font-medium text-slate-500 mt-0.5 m-0">{vasp.type}</p>
                  </div>
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-md border ${risk.bg} ${risk.color}`}>
                  {vasp.risk}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2.5 mb-5 flex-1">
                <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Addresses</p>
                  <p className="text-[13px] font-bold text-slate-900 mt-1">{vasp.addresses.toLocaleString()}</p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100 flex flex-col items-center justify-center">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0 mb-1.5">Chain</p>
                  <p className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-slate-700 capitalize m-0 truncate">
                    {CHAIN_LOGOS[vasp.chain.toLowerCase()] && (
                      <img src={CHAIN_LOGOS[vasp.chain.toLowerCase()]} alt={vasp.chain} className="w-3.5 h-3.5 object-contain shrink-0" />
                    )}
                    {vasp.chain}
                  </p>
                </div>
                <div className="bg-slate-50 rounded-xl p-2.5 text-center border border-slate-100">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider m-0">Country</p>
                  <p className="text-[11px] font-bold text-slate-700 mt-1.5 truncate">{vasp.country}</p>
                </div>
              </div>

              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${risk.fill} transition-all duration-500`}
                  style={{ width: vasp.risk === "low" ? "25%" : vasp.risk === "medium" ? "50%" : vasp.risk === "high" ? "75%" : "100%" }}
                />
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="col-span-full py-16 text-center">
            <AlertCircleIcon size={28} className="text-slate-400 mx-auto mb-3" />
            <p className="text-[13px] font-medium text-slate-500 m-0">No VASPs match your search</p>
          </div>
        )}
      </div>
    </div>
  );
}
