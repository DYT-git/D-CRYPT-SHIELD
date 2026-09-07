"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon, ZapIcon, NetworkIcon, ShieldIcon,
  InfoIcon, AlertCircleIcon,
} from "@/components/Icons";

const CHAINS = [
  { id: "ethereum", label: "Ethereum",  dot: "bg-indigo-500", border: "border-indigo-200", bg: "bg-indigo-50", text: "text-indigo-700", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  { id: "bitcoin",  label: "Bitcoin",   dot: "bg-amber-500",  border: "border-amber-200",  bg: "bg-amber-50",  text: "text-amber-700", logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032" },
  { id: "tron",     label: "Tron",      dot: "bg-red-500",    border: "border-red-200",    bg: "bg-red-50",    text: "text-red-700", logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032" },
  { id: "bnb",      label: "BNB Chain", dot: "bg-yellow-500", border: "border-yellow-200", bg: "bg-yellow-50", text: "text-yellow-700", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032" },
  { id: "polygon",  label: "Polygon",   dot: "bg-purple-500", border: "border-purple-200", bg: "bg-purple-50", text: "text-purple-700", logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" },
  { id: "solana",   label: "Solana",    dot: "bg-fuchsia-500",border: "border-fuchsia-200",bg: "bg-fuchsia-50",text: "text-fuchsia-700", logo: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032" },
  { id: "arbitrum", label: "Arbitrum",  dot: "bg-sky-500",    border: "border-sky-200",    bg: "bg-sky-50",    text: "text-sky-700", logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=032" },
  { id: "avalanche",label: "Avalanche", dot: "bg-rose-500",   border: "border-rose-200",   bg: "bg-rose-50",   text: "text-rose-700", logo: "https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=032" },
];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export default function TracePage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<"tx" | "address">("tx");
  const [form, setForm] = useState({
    txHash: "", address: "", chain: "ethereum", case_id: "", submitted_by: "", priority: "normal",
    max_depth: 10,
    max_branches: 5,
    min_value_usd: 10,
    time_start: "",
    time_end: "",
    direction: "outgoing",
    assets: "all",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputType === "tx" && !form.txHash.trim()) return;
    if (inputType === "address" && !form.address.trim()) return;
    
    setLoading(true);
    setError("");
    
    // Format dates to RFC3339 if provided
    const ts = form.time_start ? new Date(form.time_start).toISOString() : undefined;
    const te = form.time_end ? new Date(form.time_end).toISOString() : undefined;

    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_hash: inputType === "tx" ? form.txHash.trim() : undefined,
          suspect_address: inputType === "address" ? form.address.trim() : undefined,
          chain: form.chain,
          case_id: form.case_id.trim() || `CASE-${Date.now()}`,
          submitted_by: form.submitted_by.trim() || "LEA Officer",
          max_depth: form.max_depth,
          max_branches: form.max_branches,
          min_value_usd: form.min_value_usd,
          time_start: ts,
          time_end: te,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      router.push(`/case/${data.case_id}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unexpected error");
      setLoading(false);
    }
  };

  const selectedChain = CHAINS.find((c) => c.id === form.chain);

  return (
    <div className="max-w-[800px] mx-auto flex flex-col gap-8 animate-fade-in">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <SearchIcon size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight m-0">
            Trace Suspect Wallet
          </h1>
          <p className="text-sm text-slate-500 mt-1.5 leading-relaxed font-medium">
            Submit a wallet address to automatically trace it to the nearest VASP or exchange using BFS and ML scoring.
          </p>
        </div>
      </div>

      {/* ── Form Card ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Card Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <p className="text-[14px] font-semibold text-slate-900 m-0">Investigation Parameters</p>
          {selectedChain && (
            <span className="inline-flex items-center gap-2 text-[12px] text-slate-600 font-medium">
              {selectedChain.logo ? (
                <img src={selectedChain.logo} alt={selectedChain.label} className="w-3.5 h-3.5 object-contain" />
              ) : (
                <span className={`w-1.5 h-1.5 rounded-full ${selectedChain.dot}`} />
              )}
              {selectedChain.label} selected
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">
          
          {/* Input Type Toggle */}
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setInputType("tx")}
              className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all ${
                inputType === "tx" 
                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Start from TxHash (Auto-Time)
            </button>
            <button
              type="button"
              onClick={() => setInputType("address")}
              className={`flex-1 py-3 text-sm font-bold rounded-xl border transition-all ${
                inputType === "address" 
                ? "bg-blue-50 border-blue-500 text-blue-700 shadow-sm" 
                : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
              }`}
            >
              Start from Wallet (Manual)
            </button>
          </div>

          {/* Dynamic Input */}
          {inputType === "tx" ? (
            <div>
              <Label required>Scam Transaction Hash</Label>
              <input
                type="text"
                required={inputType === "tx"}
                autoComplete="off"
                spellCheck={false}
                placeholder="0x… (We will auto-extract timestamp & receiver)"
                value={form.txHash}
                onChange={(e) => setForm({ ...form, txHash: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-900 font-mono outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              <p className="text-[11px] text-slate-500 mt-2 font-medium flex items-center gap-1.5">
                <ZapIcon size={12} className="text-amber-500" />
                Time Barrier will be set automatically to prevent tracing history before this tx.
              </p>
            </div>
          ) : (
            <div>
              <Label required>Suspect Wallet Address</Label>
              <input
                type="text"
                required={inputType === "address"}
                autoComplete="off"
                spellCheck={false}
                placeholder="0x… or bc1… or T… or any chain address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-900 font-mono outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
              {form.address && (
                <p className="text-[11px] text-slate-500 mt-2 font-mono font-medium">
                  {form.address.length} characters
                </p>
              )}
            </div>
          )}

          {/* Chain Selection */}
          <div>
            <Label required>Blockchain Network</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
              {CHAINS.map((chain) => {
                const isActive = form.chain === chain.id;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setForm({ ...form, chain: chain.id })}
                    className={`
                      flex items-center gap-2 px-3 py-2.5 rounded-lg text-[13px] font-semibold cursor-pointer transition-all duration-200 border
                      ${isActive 
                        ? `${chain.bg} ${chain.border} ${chain.text} shadow-sm` 
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"}
                    `}
                  >
                    {chain.logo ? (
                      <img src={chain.logo} alt={chain.label} className="w-4 h-4 object-contain shrink-0" />
                    ) : (
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${chain.dot}`} />
                    )}
                    {chain.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case ID + Officer */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Case ID</Label>
              <input
                type="text"
                placeholder="e.g. CASE-2024-042"
                value={form.case_id}
                onChange={(e) => setForm({ ...form, case_id: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-900 outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
            <div>
              <Label>Investigating Officer</Label>
              <input
                type="text"
                placeholder="Name / Badge ID"
                value={form.submitted_by}
                onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-[13px] text-slate-900 outline-none transition-all shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>
          </div>

          
          {/* Phase 3 Trace Configuration */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 mt-2">
            <h3 className="text-[13px] font-bold text-slate-900 mb-4">Advanced Configuration (Phase 3)</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label>Max Depth (Hops)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1" max="15"
                    value={form.max_depth}
                    onChange={(e) => setForm({ ...form, max_depth: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-[13px] font-bold text-slate-700 w-6 text-center">{form.max_depth}</span>
                </div>
              </div>

              <div>
                <Label>Max Branches (per Hop)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1" max="25"
                    value={form.max_branches}
                    onChange={(e) => setForm({ ...form, max_branches: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <span className="text-[13px] font-bold text-slate-700 w-6 text-center">{form.max_branches}</span>
                </div>
              </div>
              
              <div>
                <Label>Minimum Value (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    value={form.min_value_usd}
                    onChange={(e) => setForm({ ...form, min_value_usd: parseFloat(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg pl-7 pr-3 py-2 text-[13px] outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <Label>Time Start (Optional)</Label>
                <input
                  type="date"
                  value={form.time_start}
                  onChange={(e) => setForm({ ...form, time_start: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <Label>Time End (Optional)</Label>
                <input
                  type="date"
                  value={form.time_end}
                  onChange={(e) => setForm({ ...form, time_end: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <Label>Direction</Label>
                <select
                  value={form.direction}
                  onChange={(e) => setForm({ ...form, direction: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                >
                  <option value="outgoing">Outgoing (Forward)</option>
                  <option value="incoming">Incoming (Backward)</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div>
                <Label>Assets (Comma separated, or "all")</Label>
                <input
                  type="text"
                  placeholder="e.g. USDT, USDC, ETH"
                  value={form.assets}
                  onChange={(e) => setForm({ ...form, assets: e.target.value })}
                  className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label>Trace Priority</Label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "normal",   label: "Normal",   desc: "Standard queue",      activeStyle: "bg-blue-50 border-blue-200 text-blue-700", iconCol: "text-blue-600" },
                { value: "high",     label: "High",     desc: "Priority processing", activeStyle: "bg-amber-50 border-amber-200 text-amber-700", iconCol: "text-amber-600" },
                { value: "critical", label: "Critical", desc: "Immediate dispatch",  activeStyle: "bg-red-50 border-red-200 text-red-700", iconCol: "text-red-600" },
              ].map((p) => {
                const isActive = form.priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p.value })}
                    className={`
                      flex-1 min-w-[140px] flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all duration-200 border text-left
                      ${isActive ? `${p.activeStyle} shadow-sm` : 'bg-white border-slate-200 hover:bg-slate-50 hover:border-slate-300'}
                    `}
                  >
                    <span className={`text-[13px] font-bold ${isActive ? p.iconCol : 'text-slate-700'}`}>{p.label}</span>
                    <span className={`text-[11px] font-medium mt-0.5 ${isActive ? p.iconCol : 'text-slate-500'}`}>{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error state */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircleIcon size={18} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium text-red-700 m-0 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !form.address.trim()}
            className={`
              w-full flex items-center justify-center gap-2.5 p-3.5 rounded-xl text-[13px] font-bold transition-all duration-200 shadow-sm
              ${loading || !form.address.trim() 
                ? "bg-slate-100 border border-slate-200 text-slate-400 cursor-not-allowed" 
                : "bg-blue-600 border border-transparent hover:bg-blue-700 text-white"}
            `}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin-slow" />
                Submitting to BFS Engine…
              </>
            ) : (
              <>
                <ZapIcon size={16} />
                Launch Trace
              </>
            )}
          </button>
        </form>
      </div>

      {/* ── Info Card ─────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-6 h-6 rounded-md bg-slate-100 border border-slate-200 flex items-center justify-center">
            <InfoIcon size={14} className="text-slate-500" />
          </div>
          <h3 className="text-[14px] font-bold text-slate-900 m-0">How the trace engine works</h3>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {[
            { icon: NetworkIcon,  title: "BFS Traversal",    desc: "Breadth-first search traces hop-by-hop across the blockchain transaction graph" },
            { icon: ShieldIcon,   title: "VASP Matching",    desc: "Each destination is cross-referenced against our 50,000+ labelled VASP address database" },
            { icon: ZapIcon,      title: "ML Risk Scoring",  desc: "15-feature ML model scores each wallet for laundering typologies and risk level" },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
                <Icon size={16} className="text-blue-600" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-slate-900 m-0">{title}</p>
                <p className="text-[12px] text-slate-500 mt-1 leading-relaxed font-medium">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
