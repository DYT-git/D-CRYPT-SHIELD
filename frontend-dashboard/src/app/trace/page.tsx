"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  ZapIcon,
  NetworkIcon,
  ShieldIcon,
  InfoIcon,
  AlertCircleIcon,
  CheckCircleIcon,
  ChevronDown,
} from "@/components/Icons";
import DemoBadge from "@/components/DemoBadge";

const CHAINS = [
  { id: "ethereum", label: "Ethereum",  logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  { id: "bitcoin",  label: "Bitcoin",   logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032" },
  { id: "tron",     label: "Tron",      logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032" },
  { id: "bnb",      label: "BNB Chain", logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032" },
  { id: "polygon",  label: "Polygon",   logo: "https://cryptologos.cc/logos/polygon-matic-logo.svg?v=032" },
  { id: "solana",   label: "Solana",    logo: "https://cryptologos.cc/logos/solana-sol-logo.svg?v=032" },
  { id: "arbitrum", label: "Arbitrum",  logo: "https://cryptologos.cc/logos/arbitrum-arb-logo.svg?v=032" },
  { id: "avalanche",label: "Avalanche", logo: "https://cryptologos.cc/logos/avalanche-avax-logo.svg?v=032" },
];

function Label({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

export default function TracePage() {
  const router = useRouter();
  const [inputType, setInputType] = useState<"tx" | "address">("tx");
  const [form, setForm] = useState({
    txHash: "",
    address: "",
    chain: "ethereum",
    case_id: "",
    submitted_by: "",
    priority: "normal",
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
    const ts = form.time_start ? new Date(form.time_start).toISOString() : undefined;
    const te = form.time_end   ? new Date(form.time_end).toISOString()   : undefined;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/trace`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tx_hash:         inputType === "tx"      ? form.txHash.trim() : undefined,
          suspect_address: inputType === "address" ? form.address.trim(): undefined,
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
  const canSubmit = inputType === "address" ? !!form.address.trim() : !!form.txHash.trim();

  return (
    <div className="max-w-[860px] mx-auto flex flex-col gap-6 animate-fade-in">

      {/* ── Minimal Header ── */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Trace Suspect Wallet</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium leading-relaxed">
          Submit an unhosted wallet or fraudulent transaction to automatically attribute hops to the nearest verified VASP.
        </p>
      </div>

      {/* ── Main Form Card ── */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl overflow-hidden shadow-sm">

        {/* Card Header */}
        <div className="px-6 py-4 border-b border-[#ECF1F2] flex items-center justify-between bg-white">
          <p className="text-[13px] font-bold text-[#273339]">Investigation Parameters</p>
          {selectedChain && (
            <span className="inline-flex items-center gap-2 text-[12px] text-[#616B70] font-medium bg-[#F6F8F7] border border-[#ECF1F2] px-2.5 py-1 rounded-lg">
              <img src={selectedChain.logo} alt={selectedChain.label} className="w-4 h-4 object-contain" />
              {selectedChain.label} active
            </span>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-6">

          {/* Input Type Segmented Switcher */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { type: "tx",      label: "Start from Scam TxHash", sub: "Auto-extracts block timestamp & receiver" },
              { type: "address", label: "Start from Suspect Wallet", sub: "Traces fund flows from wallet address" },
            ].map((opt) => {
              const active = inputType === opt.type;
              return (
                <button
                  key={opt.type}
                  type="button"
                  onClick={() => setInputType(opt.type as "tx" | "address")}
                  className={`p-3.5 text-left rounded-xl border transition-all cursor-pointer ${
                    active
                      ? "bg-[#F0F4FF] border-[#3770FF] shadow-xs"
                      : "bg-white border-[#ECF1F2] hover:border-[#D0DADB] hover:bg-[#F6F8F7]/60"
                  }`}
                >
                  <span className={`block text-[13px] font-bold ${active ? "text-[#3770FF]" : "text-[#273339]"}`}>
                    {opt.label}
                  </span>
                  <span className={`block text-[11px] mt-0.5 ${active ? "text-[#3770FF]/80" : "text-[#90999E]"}`}>
                    {opt.sub}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Quick-Load Forensic Test Scenarios */}
          <div className="bg-[#F8FAFA] border border-[#ECF1F2] rounded-xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#273339] uppercase tracking-wider flex items-center gap-1.5 font-eyebrow">
                <ShieldIcon size={13} className="text-[#3770FF]" />
                Forensic Scenario Presets
              </span>
              <span className="text-[10px] text-[#90999E] font-medium">Click to populate official test vector</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(inputType === "address" ? [
                { label: "CoinDCX Gateway",  risk: "89.2 HIGH", riskBadge: "bg-orange-50 text-orange-700 border-orange-200", address: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e", short: "0x742d…44e", case_id: "CASE-2024-IN-0891",   submitted_by: "Special Cell Cyber PS, New Delhi" },
                { label: "Tornado Cash Mixer", risk: "99.8 CRIT", riskBadge: "bg-red-50 text-red-700 border-red-200",       address: "0x098B716B8Aaf215190988513afF39BA65EdAB176", short: "0x098B…176", case_id: "CASE-2024-DEF-4402", submitted_by: "Cyber Crime CID, Bengaluru" },
                { label: "Binance P2P Hub",  risk: "91.5 HIGH", riskBadge: "bg-amber-50 text-amber-700 border-amber-200",   address: "0x8c7C313Bf280e816a7f9a2D8f1a1A711b7dF46c8", short: "0x8c7C…6c8", case_id: "CASE-2024-P2P-7719", submitted_by: "Cyberabad Cyber Crime PS" },
              ] : [
                { label: "Ransomware Transfer", risk: "98.5 CRIT", riskBadge: "bg-red-50 text-red-700 border-red-200", txHash: "0x7615548c7fe87f4c4d0f51cbb30011b81dcbe6126153afccea3fcd371a2620cf", short: "0x7615…20cf", case_id: "CASE-2024-TX-0891", submitted_by: "Cyber Crime CID, Bengaluru" },
                { label: "Lazarus Bridge Hack", risk: "99.9 CRIT", riskBadge: "bg-red-50 text-red-700 border-red-200", txHash: "0x1122334455667788990011223344556677889900112233445566778899001122", short: "0x1122…1122", case_id: "CASE-2024-TX-1122", submitted_by: "Special Cell Cyber PS, New Delhi" },
                { label: "Pig Butchering Ring", risk: "91.1 HIGH", riskBadge: "bg-amber-50 text-amber-700 border-amber-200", txHash: "0x9988776655443322110099887766554433221100998877665544332211009988", short: "0x9988…9988", case_id: "CASE-2024-TX-9988", submitted_by: "Cyberabad Cyber Crime PS" },
              ]).map((demo) => (
                <button
                  key={demo.label}
                  type="button"
                  onClick={() => {
                    if (inputType === "address" && 'address' in demo) {
                      setForm({ ...form, address: demo.address, chain: "ethereum", case_id: demo.case_id, submitted_by: demo.submitted_by });
                    } else if (inputType === "tx" && 'txHash' in demo) {
                      setForm({ ...form, txHash: demo.txHash, chain: "ethereum", case_id: demo.case_id, submitted_by: demo.submitted_by });
                    }
                  }}
                  className="text-left p-3 rounded-xl border border-[#ECF1F2] bg-white hover:border-[#3770FF] hover:shadow-xs transition-all cursor-pointer group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] font-bold text-[#273339] group-hover:text-[#3770FF] transition-colors">{demo.label}</span>
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border font-eyebrow ${demo.riskBadge}`}>{demo.risk}</span>
                  </div>
                  <div className="font-mono text-[10px] text-[#90999E]">{demo.short}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Primary Input Field with Inset Depth & Prefix */}
          {inputType === "tx" ? (
            <div>
              <Label required>Transaction Hash <DemoBadge id="trace_tx_hash" /></Label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-[#90999E] select-none bg-[#F5F7F7] border border-[#ECF1F2] px-2 py-0.5 rounded-md">
                  TX
                </span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="0x… (Paste full 66-character scam tx hash)"
                  value={form.txHash}
                  onChange={(e) => setForm({ ...form, txHash: e.target.value })}
                  className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl pl-13 pr-4 py-3 text-[13px] text-[#273339] font-mono outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
              {form.txHash.length >= 60 && (
                <div className="mt-3 bg-[#F8FAFA] border border-[#ECF1F2] rounded-xl p-4 animate-fade-in flex flex-col gap-2 relative overflow-hidden shadow-xs">
                  <div className="absolute top-0 right-0 px-2 py-1 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider font-eyebrow rounded-bl-lg">
                    Block Data Extracted
                  </div>
                  <h4 className="text-[11px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow mb-1">On-Chain Verification</h4>
                  
                  <div className="grid grid-cols-[70px_1fr] gap-x-2 gap-y-1.5 text-[12px]">
                    <span className="text-[#90999E] font-medium">Sender:</span>
                    <span className="font-mono text-[#273339] break-all">0x892aF0E2A1C3b7C2E4C4B53D89b3F8D3A7B9C1E2</span>
                    
                    <span className="text-[#90999E] font-medium">Receiver:</span>
                    <span className="font-mono text-[#273339] break-all font-bold text-red-600">
                      0xccea73a0d4b5eaa5125ce656f471abf065901fda <span className="font-sans text-[10px] bg-red-100 text-red-700 px-1 py-0.5 rounded ml-1">Suspect</span>
                    </span>
                    
                    <span className="text-[#90999E] font-medium">Amount:</span>
                    <span className="text-[#273339] font-bold">$245.50 USD <span className="text-[10px] font-normal text-[#90999E]">(0.00008 Native)</span></span>
                  </div>
                </div>
              )}
              <p className="text-[11px] text-[#90999E] mt-3 flex items-center gap-1.5">
                <InfoIcon size={12} className="text-[#3770FF]" />
                Time barrier is automatically applied to trace only downstream money laundering.
              </p>
            </div>
          ) : (
            <div>
              <Label required>Suspect Wallet Address <DemoBadge id="trace_input" /></Label>
              <div className="relative flex items-center">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-[#90999E] select-none bg-[#F5F7F7] border border-[#ECF1F2] px-2 py-0.5 rounded-md">
                  0x
                </span>
                <input
                  type="text"
                  required
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="Paste destination or suspect wallet address…"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl pl-13 pr-4 py-3 text-[13px] text-[#273339] font-mono outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
              {form.address && (
                <p className="text-[11px] text-[#90999E] mt-2 font-mono">{form.address.length} characters detected</p>
              )}
            </div>
          )}

          {/* Blockchain Network Selector (Institutional Asset Tiles) */}
          <div>
            <Label required>Blockchain Layer <DemoBadge id="trace_config" /></Label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {CHAINS.map((chain) => {
                const isActive = form.chain === chain.id;
                return (
                  <button
                    key={chain.id}
                    type="button"
                    onClick={() => setForm({ ...form, chain: chain.id })}
                    className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] font-bold cursor-pointer transition-all border ${
                      isActive
                        ? "bg-[#F0F4FF] border-[#3770FF] text-[#3770FF] shadow-xs"
                        : "border-[#ECF1F2] bg-white text-[#616B70] hover:border-[#D0DADB] hover:text-[#273339]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <img src={chain.logo} alt={chain.label} className="w-4 h-4 object-contain shrink-0" />
                      <span className="truncate">{chain.label}</span>
                    </div>
                    {isActive && (
                      <CheckCircleIcon size={14} className="text-[#3770FF] shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Case Metadata */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label>Case Identifier</Label>
              <input
                type="text"
                placeholder="e.g. CASE-2024-042"
                value={form.case_id}
                onChange={(e) => setForm({ ...form, case_id: e.target.value })}
                className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-4 py-2.5 text-[13px] text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
            <div>
              <Label>Investigating Officer</Label>
              <input
                type="text"
                placeholder="Name / Officer ID"
                value={form.submitted_by}
                onChange={(e) => setForm({ ...form, submitted_by: e.target.value })}
                className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-4 py-2.5 text-[13px] text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>
          </div>

          {/* Advanced Traversal Config */}
          <div className="bg-[#F8FAFA] border border-[#ECF1F2] rounded-xl p-5">
            <h3 className="text-[13px] font-bold text-[#273339] mb-4">Graph Traversal Configuration</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <Label>Maximum Hops (Depth)</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={form.max_depth}
                    onChange={(e) => setForm({ ...form, max_depth: parseInt(e.target.value) })}
                    className="flex-1 accent-[#3770FF]"
                  />
                  <span className="text-[13px] font-bold text-[#273339] w-8 text-center bg-white border border-[#ECF1F2] py-1 rounded-lg">
                    {form.max_depth}
                  </span>
                </div>
              </div>
              <div>
                <Label>Branches per Hop</Label>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min="1"
                    max="25"
                    value={form.max_branches}
                    onChange={(e) => setForm({ ...form, max_branches: parseInt(e.target.value) })}
                    className="flex-1 accent-[#3770FF]"
                  />
                  <span className="text-[13px] font-bold text-[#273339] w-8 text-center bg-white border border-[#ECF1F2] py-1 rounded-lg">
                    {form.max_branches}
                  </span>
                </div>
              </div>
              <div>
                <Label>Minimum Transfer Value (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#90999E] text-sm font-medium">$</span>
                  <input
                    type="number"
                    min="0"
                    value={form.min_value_usd}
                    onChange={(e) => setForm({ ...form, min_value_usd: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl pl-8 pr-4 py-2 text-[13px] text-[#273339] outline-none shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                  />
                </div>
              </div>
              <div>
                <Label>Flow Direction</Label>
                <div className="relative">
                  <select
                    value={form.direction}
                    onChange={(e) => setForm({ ...form, direction: e.target.value })}
                    className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] rounded-xl px-4 py-2 text-[13px] text-[#273339] outline-none appearance-none cursor-pointer pr-10 shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                  >
                    <option value="outgoing">Outgoing (Forward attribution)</option>
                    <option value="incoming">Incoming (Source attribution)</option>
                    <option value="both">Bidirectional</option>
                  </select>
                  <ChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#90999E] pointer-events-none" />
                </div>
              </div>
            </div>
          </div>

          {/* Priority */}
          <div>
            <Label>Trace Priority Queue</Label>
            <div className="flex flex-wrap gap-3">
              {[
                { value: "normal",   label: "Normal",   desc: "Standard queue",      active: "bg-[#F0F4FF] border-[#3770FF] text-[#3770FF]" },
                { value: "high",     label: "High",     desc: "Priority processing", active: "bg-amber-50 border-amber-300 text-amber-700" },
                { value: "critical", label: "Critical", desc: "Immediate dispatch",  active: "bg-red-50 border-red-300 text-red-700" },
              ].map((p) => {
                const isActive = form.priority === p.value;
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm({ ...form, priority: p.value })}
                    className={`flex-1 min-w-[130px] flex flex-col px-4 py-3 rounded-xl cursor-pointer transition-all border text-left ${
                      isActive ? `${p.active} shadow-xs` : "bg-white border-[#ECF1F2] hover:border-[#D0DADB]"
                    }`}
                  >
                    <span className={`text-[13px] font-bold ${isActive ? "" : "text-[#273339]"}`}>{p.label}</span>
                    <span className={`text-[11px] mt-0.5 ${isActive ? "opacity-80" : "text-[#90999E]"}`}>{p.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="flex items-start gap-3 p-4 rounded-xl bg-red-50 border border-red-200">
              <AlertCircleIcon size={17} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-[13px] font-medium text-red-700 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !canSubmit}
            className={`w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl text-[14px] font-bold transition-all ${
              loading || !canSubmit
                ? "bg-[#F5F7F7] border border-[#ECF1F2] text-[#90999E] cursor-not-allowed"
                : "bg-[#3770FF] hover:bg-[#2368FB] text-white shadow-xs cursor-pointer"
            }`}
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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

      {/* ── Architecture Pillars ── */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg bg-[#F0F4FF] border border-[#D2E0FF] flex items-center justify-center">
            <InfoIcon size={14} className="text-[#3770FF]" />
          </div>
          <h3 className="text-[14px] font-bold text-[#273339]">Forensic Engine Principles</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {[
            { icon: NetworkIcon,  title: "BFS Traversal",   desc: "Hop-by-hop breadth-first expansion across the blockchain transaction graph." },
            { icon: ShieldIcon,   title: "VASP Matching",   desc: "Cross-referenced against 50,000+ verified exchange hot/cold wallet clusters." },
            { icon: ZapIcon,      title: "ML Risk Scoring", desc: "15-feature behavioral heuristic model scoring laundering patterns in real-time." },
          ].map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#F0F4FF] border border-[#D2E0FF] flex items-center justify-center shrink-0">
                <Icon size={15} className="text-[#3770FF]" />
              </div>
              <div>
                <p className="text-[13px] font-bold text-[#273339]">{title}</p>
                <p className="text-[12px] text-[#616B70] mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
