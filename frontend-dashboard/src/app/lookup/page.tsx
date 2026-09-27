"use client";

import { useState } from "react";
import {
  BuildingIcon,
  SearchIcon,
  CheckCircleIcon,
  AlertCircleIcon,
  DatabaseIcon,
  NetworkIcon,
  RefreshIcon,
  ChevronDown,
} from "@/components/Icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const VASPS = [
  { name: "Binance",         type: "Centralized Exchange", chain: "multi",    addresses: 12400, risk: "low",      country: "Global",     verified: true  },
  { name: "Coinbase",        type: "Centralized Exchange", chain: "ethereum", addresses: 8200,  risk: "low",      country: "USA",        verified: true  },
  { name: "OKX",             type: "Centralized Exchange", chain: "multi",    addresses: 7100,  risk: "low",      country: "Seychelles", verified: true  },
  { name: "Huobi",           type: "Centralized Exchange", chain: "multi",    addresses: 5300,  risk: "medium",   country: "Global",     verified: true  },
  { name: "Kraken",          type: "Centralized Exchange", chain: "multi",    addresses: 4800,  risk: "low",      country: "USA",        verified: true  },
  { name: "KuCoin",          type: "Centralized Exchange", chain: "multi",    addresses: 3900,  risk: "medium",   country: "Seychelles", verified: true  },
  { name: "FixedFloat",      type: "Instant Swap",         chain: "multi",    addresses: 420,   risk: "high",     country: "Unknown",    verified: false },
  { name: "Tornado Cash",    type: "Privacy Mixer",        chain: "ethereum", addresses: 1100,  risk: "critical", country: "Decentralized", verified: true },
  { name: "ChipMixer",       type: "Darknet Mixer",        chain: "bitcoin",  addresses: 880,   risk: "critical", country: "Unknown",    verified: true  },
  { name: "Wormhole Bridge", type: "Cross-chain Bridge",   chain: "multi",    addresses: 240,   risk: "medium",   country: "Multi-sig",  verified: true  },
  { name: "LocalBitcoins",   type: "P2P Escrow",           chain: "bitcoin",  addresses: 3100,  risk: "high",     country: "Finland",    verified: true  },
  { name: "Paxful",          type: "P2P Marketplace",      chain: "bitcoin",  addresses: 2700,  risk: "high",     country: "USA",        verified: true  },
];

const RISK_BADGES: Record<string, { label: string; style: string }> = {
  low:      { label: "VERIFIED LOW RISK",   style: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  medium:   { label: "MODERATE RISK",      style: "bg-amber-50 text-amber-700 border-amber-200" },
  high:     { label: "HIGH RISK ESCROW",    style: "bg-orange-50 text-orange-700 border-orange-200" },
  critical: { label: "CRITICAL SANCTIONED", style: "bg-red-50 text-red-700 border-red-200" },
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
  { id: "ethereum", label: "ETH" },
  { id: "bitcoin",  label: "BTC" },
  { id: "tron",     label: "TRX" },
  { id: "bnb",      label: "BNB" },
  { id: "polygon",  label: "MATIC" },
  { id: "solana",   label: "SOL" },
];

interface LookupHit {
  address: string;
  chain: string;
  is_vasp: boolean;
  vasp?: { vasp_name: string; vasp_type: string; confidence: number; risk_level: string };
}

export default function LookupPage() {
  const [search, setSearch]         = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [riskFilter, setRiskFilter] = useState("all");
  const [lookupAddr, setLookupAddr]       = useState("");
  const [lookupChain, setLookupChain]     = useState("ethereum");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult]   = useState<LookupHit | null>(null);
  const [lookupError, setLookupError]     = useState<string | null>(null);

  const types = Array.from(new Set(VASPS.map(v => v.type)));

  const filtered = VASPS.filter(v => {
    const q = search.toLowerCase();
    const matchSearch = !q || v.name.toLowerCase().includes(q) || v.type.toLowerCase().includes(q) || v.country.toLowerCase().includes(q);
    const matchType   = typeFilter === "all" || v.type === typeFilter;
    const matchRisk   = riskFilter === "all" || v.risk === riskFilter;
    return matchSearch && matchType && matchRisk;
  });

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
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">VASP Attribution Registry</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium">
          {VASPS.length} verified exchange and mixer entities · Real-time unhosted address verification
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Tracked Entities", value: VASPS.length,                                         icon: DatabaseIcon,    iconBg: "bg-blue-50 border-blue-100",     iconColor: "text-blue-600" },
          { label: "Verified VASPs",   value: VASPS.filter(v => v.verified).length,                 icon: CheckCircleIcon, iconBg: "bg-emerald-50 border-emerald-100", iconColor: "text-emerald-600" },
          { label: "Sanctioned Mixers",value: VASPS.filter(v => v.risk === "critical").length,      icon: AlertCircleIcon, iconBg: "bg-red-50 border-red-100",        iconColor: "text-red-600" },
          { label: "Cluster Footprint",value: VASPS.reduce((a, v) => a + v.addresses, 0).toLocaleString(), icon: NetworkIcon, iconBg: "bg-purple-50 border-purple-100", iconColor: "text-purple-600" },
        ].map(s => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="stat-card p-5 flex items-center gap-4">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${s.iconBg}`}>
                <Icon size={17} className={s.iconColor} />
              </div>
              <div>
                <p className="text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">{s.label}</p>
                <p className="text-xl font-black text-[#273339] mt-0.5 leading-none">{s.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Address Lookup Terminal Card */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <SearchIcon size={14} className="text-[#3770FF]" />
          <h3 className="text-[14px] font-bold text-[#273339]">Instant Address Attribution Check</h3>
        </div>
        <p className="text-[12px] text-[#616B70] mb-4">
          Query any unhosted wallet address to check if it clusters into known exchange hot-wallets or sanctioned mixers.
        </p>

        <div className="flex flex-col sm:flex-row gap-2.5">
          {/* Chain Selector Pills */}
          <div className="flex gap-1 bg-[#F6F8F7] border border-[#ECF1F2] p-1 rounded-xl shrink-0">
            {CHAINS_FOR_LOOKUP.map(c => {
              const active = lookupChain === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setLookupChain(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    active
                      ? "bg-white text-[#3770FF] shadow-xs border border-[#D2E0FF]/60"
                      : "text-[#90999E] hover:text-[#273339]"
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>

          <div className="relative flex-1 flex items-center">
            <input
              placeholder="Paste destination address (0x… or bc1… or T…)…"
              value={lookupAddr}
              onChange={(e) => { setLookupAddr(e.target.value); setLookupResult(null); setLookupError(null); }}
              onKeyDown={(e) => e.key === "Enter" && handleLookup()}
              className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-4 py-2.5 text-[13px] text-[#273339] font-mono outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            />
          </div>

          <button
            onClick={handleLookup}
            disabled={lookupLoading || !lookupAddr.trim()}
            className="px-5 py-2.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] disabled:bg-[#ECF1F2] disabled:text-[#90999E] text-white text-[13px] font-bold flex items-center justify-center gap-2 transition-all shadow-xs shrink-0 cursor-pointer"
          >
            {lookupLoading ? <RefreshIcon size={13} className="animate-spin" /> : <SearchIcon size={13} />}
            <span>{lookupLoading ? "Checking…" : "Lookup"}</span>
          </button>
        </div>

        {/* Error */}
        {lookupError && (
          <div className="mt-3.5 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2.5">
            <AlertCircleIcon size={14} className="text-red-600 shrink-0 mt-0.5" />
            <p className="text-[12px] font-medium text-red-700">{lookupError}</p>
          </div>
        )}

        {/* Result */}
        {lookupResult && (
          <div className={`mt-4 p-4 rounded-xl border ${lookupResult.is_vasp ? "bg-emerald-50/70 border-emerald-200" : "bg-[#F8FAFA] border-[#ECF1F2]"}`}>
            {lookupResult.is_vasp && lookupResult.vasp ? (
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                    <BuildingIcon size={18} className="text-emerald-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold text-[#273339]">{lookupResult.vasp.vasp_name}</p>
                      <CheckCircleIcon size={13} className="text-emerald-600" />
                    </div>
                    <p className="text-[11px] text-[#616B70]">{lookupResult.vasp.vasp_type} · {lookupResult.chain.toUpperCase()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded border uppercase bg-emerald-50 text-emerald-700 border-emerald-200 font-eyebrow">
                    {lookupResult.vasp.confidence}% CONFIDENCE
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2.5">
                <AlertCircleIcon size={15} className="text-[#90999E] shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#616B70]">
                  Address is not catalogued in our verified VASP registry. It may be an unhosted private wallet or new mixer cluster.
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <SearchIcon size={13} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#90999E]" />
          <input
            placeholder="Search entity name, country, or type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-9 pr-4 py-2 text-[12px] text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          />
        </div>
        <div className="relative">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-3 pr-8 py-2 text-[12px] text-[#273339] outline-none cursor-pointer appearance-none min-w-[150px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <option value="all">All Entity Types</option>
            {types.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
        </div>
        <div className="relative">
          <select
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
            className="bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-3 pr-8 py-2 text-[12px] text-[#273339] outline-none cursor-pointer appearance-none min-w-[140px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
          >
            <option value="all">All Risk Tiers</option>
            <option value="low">Low Risk</option>
            <option value="medium">Medium Risk</option>
            <option value="high">High Risk</option>
            <option value="critical">Critical Risk</option>
          </select>
          <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
        </div>
      </div>

      {/* VASP Card Grid (Polished Institutional Tiles) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(vasp => {
          const badge = RISK_BADGES[vasp.risk] || { label: vasp.risk, style: "bg-slate-50 text-slate-700 border-slate-200" };
          return (
            <div
              key={vasp.name}
              className="bg-white border border-[#ECF1F2] rounded-2xl p-5 transition-all hover:border-[#3770FF]/60 hover:shadow-md hover:-translate-y-0.5 flex flex-col shadow-2xs"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F6F8F7] border border-[#ECF1F2] flex items-center justify-center shrink-0 overflow-hidden">
                    {VASP_DOMAINS[vasp.name.toLowerCase()] ? (
                      <img
                        src={`https://www.google.com/s2/favicons?domain=${VASP_DOMAINS[vasp.name.toLowerCase()]}&sz=128`}
                        alt={vasp.name}
                        className="w-full h-full object-cover bg-white"
                      />
                    ) : <BuildingIcon size={16} className="text-[#90999E]" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-[14px] font-bold text-[#273339]">{vasp.name}</p>
                      {vasp.verified && <CheckCircleIcon size={13} className="text-[#3770FF]" />}
                    </div>
                    <p className="text-[11px] text-[#90999E]">{vasp.type}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 flex-1">
                <div className="bg-[#F8FAFA] rounded-xl p-2.5 text-center border border-[#ECF1F2]">
                  <p className="text-[9px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Addresses</p>
                  <p className="text-[12px] font-bold text-[#273339] mt-0.5">{vasp.addresses.toLocaleString()}</p>
                </div>
                <div className="bg-[#F8FAFA] rounded-xl p-2.5 text-center border border-[#ECF1F2] flex flex-col items-center justify-center">
                  <p className="text-[9px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Chain</p>
                  <p className="flex items-center justify-center gap-1 text-[11px] font-bold text-[#616B70] capitalize mt-0.5 truncate">
                    {CHAIN_LOGOS[vasp.chain.toLowerCase()] && (
                      <img src={CHAIN_LOGOS[vasp.chain.toLowerCase()]} alt={vasp.chain} className="w-3.5 h-3.5 object-contain shrink-0" />
                    )}
                    {vasp.chain}
                  </p>
                </div>
                <div className="bg-[#F8FAFA] rounded-xl p-2.5 text-center border border-[#ECF1F2]">
                  <p className="text-[9px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Jurisdiction</p>
                  <p className="text-[11px] font-bold text-[#616B70] mt-0.5 truncate">{vasp.country}</p>
                </div>
              </div>

              {/* Clean Forensic Risk Badge instead of battery bar */}
              <div className="pt-2 border-t border-[#F5F7F7] flex items-center justify-between">
                <span className={`text-[9px] font-bold px-2 py-0.5 rounded border font-eyebrow uppercase ${badge.style}`}>
                  {badge.label}
                </span>
                <span className="text-[10px] text-[#90999E] font-medium font-eyebrow">
                  FIU Registry
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
