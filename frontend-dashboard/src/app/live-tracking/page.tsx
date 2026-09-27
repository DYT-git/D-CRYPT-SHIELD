"use client";

import { useState, useEffect } from "react";
import {
  ZapIcon,
  NetworkIcon,
  SearchIcon,
  ShieldIcon,
  ClockIcon,
  TrashIcon,
  FilterIcon,
  CopyIcon,
  CheckCircleIcon,
} from "@/components/Icons";
import DemoBadge from "@/components/DemoBadge";

const CHAINS = [
  { id: "ethereum", label: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  { id: "bitcoin",  label: "Bitcoin",  logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032" },
  { id: "tron",     label: "Tron",     logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032" },
  { id: "bnb",      label: "BNB Chain",logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032" },
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export default function LiveTrackingPage() {
  const [address, setAddress]             = useState("");
  const [chain, setChain]                 = useState("ethereum");
  const [officerEmail, setOfficerEmail]   = useState("");
  const [isTracking, setIsTracking]       = useState(false);
  const [activeTrackers, setActiveTrackers] = useState<any[]>([]);
  const [liveFeed, setLiveFeed]           = useState<any[]>([]);
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string | null>(null);
  const [copiedAddr, setCopiedAddr]       = useState<string | null>(null);

  // Persist Trackers to LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("dcrypt_active_trackers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveTrackers(parsed);
        parsed.forEach((t: any) => {
          fetch(`${API}/api/v1/track`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ address: t.address, chain: t.chain, asset: t.asset, action: "add", officer_email: t.email || "" }),
          }).catch(() => {});
        });
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("dcrypt_active_trackers", JSON.stringify(activeTrackers));
  }, [activeTrackers]);

  // SSE feed
  useEffect(() => {
    const sse = new EventSource(`${API}/api/v1/live-feed`);
    sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping" || data.type === "keepalive" || !data.message || !data.message.trim()) {
          return;
        }
        setLiveFeed(prev => [{
          id: Math.random().toString(),
          time: new Date().toLocaleTimeString(),
          type: data.type || "system",
          message: data.message,
          target: data.target,
        }, ...prev].slice(0, 60));
      } catch (e) {
        console.error("SSE parse error", e);
      }
    };
    sse.onerror = () => {};
    return () => sse.close();
  }, []);

  const handleStartTracking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address.trim()) return;
    setIsTracking(true);
    try {
      const res = await fetch(`${API}/api/v1/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, chain, asset: "all", action: "add", officer_email: officerEmail }),
      });
      if (res.ok) {
        setActiveTrackers(prev => {
          if (prev.find(t => t.address.toLowerCase() === address.toLowerCase())) return prev;
          return [{
            id: `TRK-${Math.floor(Math.random() * 1000)}`,
            address, chain,
            email: officerEmail,
            status: "listening",
            started: new Date().toLocaleTimeString(),
          }, ...prev];
        });
        setAddress("");
        setOfficerEmail("");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsTracking(false);
    }
  };

  const handleRemoveTarget = async (e: React.MouseEvent, targetAddress: string) => {
    e.stopPropagation();
    try {
      await fetch(`${API}/api/v1/track`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: targetAddress, action: "remove" }),
      });
      setActiveTrackers(prev => prev.filter(t => t.address.toLowerCase() !== targetAddress.toLowerCase()));
      if (selectedWalletFilter?.toLowerCase() === targetAddress.toLowerCase()) setSelectedWalletFilter(null);
    } catch (err) {}
  };

  const handleCopy = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopiedAddr(addr);
    setTimeout(() => setCopiedAddr(null), 1800);
  };


  const filteredFeed = liveFeed.filter(feed => {
    if (!selectedWalletFilter) return true;
    if (feed.type === "system") return true;
    return feed.target?.toLowerCase() === selectedWalletFilter.toLowerCase();
  });

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-6 animate-fade-in pb-16">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight flex items-center">
          Live Interception Engine
          <DemoBadge id="live_tracking" />
        </h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium">
          Deploy real-time WebSocket listeners to capture on-chain movements as blocks are mined.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">

        {/* Left: Form */}
        <div className="lg:col-span-1 flex flex-col gap-4">

          <form onSubmit={handleStartTracking} className="bg-white border border-[#ECF1F2] rounded-2xl p-5 flex flex-col gap-4 shadow-sm">
            <h2 className="text-[13px] font-bold text-[#273339]">Deploy Telemetry Target</h2>

            <div>
              <label className="flex items-center text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">
                Target Wallet Address
                <DemoBadge id="live_target" />
              </label>
              <div className="relative flex items-center">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-mono font-bold text-[#90999E] bg-[#F5F7F7] border border-[#ECF1F2] px-1.5 py-0.5 rounded">
                  0x
                </span>
                <input
                  type="text"
                  required
                  placeholder="Paste suspect address…"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl pl-10 pr-3 py-2.5 text-[12px] font-mono text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">
                Network Layer
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CHAINS.map(c => {
                  const isActive = chain === c.id;
                  return (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => setChain(c.id)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border text-[12px] font-bold transition-all cursor-pointer ${
                        isActive
                          ? "bg-[#F0F4FF] border-[#3770FF] text-[#3770FF] shadow-xs"
                          : "bg-white border-[#ECF1F2] text-[#616B70] hover:border-[#D0DADB]"
                      }`}
                    >
                      <img src={c.logo} alt={c.label} className="w-4 h-4 object-contain shrink-0" />
                      <span className="truncate">{c.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">
                Officer Alert Email <span className="text-[#90999E] font-normal normal-case">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="officer@agency.gov.in"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-3.5 py-2.5 text-[12px] text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
              />
            </div>

            <button
              type="submit"
              disabled={isTracking || !address.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#273339] hover:bg-[#1C252A] text-white font-bold text-[13px] py-3 rounded-xl transition-all shadow-xs disabled:opacity-60 cursor-pointer"
            >
              <ZapIcon size={14} className={isTracking ? "animate-pulse text-amber-400" : "text-amber-400"} />
              {isTracking ? "Deploying Engine…" : "Deploy Live Listener"}
            </button>
          </form>

          {/* Architecture note */}
          <div className="bg-[#F8FAFA] border border-[#ECF1F2] rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
              <ShieldIcon size={13} className="text-[#3770FF] shrink-0" />
              <p className="text-[11px] font-bold text-[#273339] uppercase tracking-wider font-eyebrow">Daemon Separation</p>
            </div>
            <p className="text-[11px] text-[#616B70] leading-relaxed font-medium">
              WebSocket trackers operate autonomously on the Go backend. Closing this browser tab will not stop surveillance.
            </p>
          </div>
        </div>

        {/* Right: Active Trackers + Hardware Terminal Window */}
        <div className="lg:col-span-2 flex flex-col bg-white border border-[#ECF1F2] rounded-2xl overflow-hidden shadow-sm">

          {/* Section header */}
          <div className="px-5 py-4 border-b border-[#ECF1F2] flex items-center justify-between bg-white">
            <div className="flex items-center gap-2">
              <NetworkIcon size={15} className="text-[#3770FF]" />
              <h2 className="text-[13px] font-bold text-[#273339]">Active Interception Nodes</h2>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider font-eyebrow">WSS Live</span>
            </div>
          </div>

          {/* Tracker table */}
          <div className="overflow-x-auto min-h-[140px]">
            {activeTrackers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[140px] gap-2">
                <ZapIcon size={20} className="text-[#D0DADB]" />
                <p className="text-[12px] text-[#90999E] font-medium">No target listeners active. Deploy above.</p>
              </div>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-[#F8FAFA] border-b border-[#ECF1F2]">
                    <th className="px-5 py-2.5 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Target Wallet</th>
                    <th className="px-5 py-2.5 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Network</th>
                    <th className="px-5 py-2.5 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow">Status</th>
                    <th className="px-5 py-2.5 text-[10px] font-bold text-[#90999E] uppercase tracking-wider font-eyebrow text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F7F7]">
                  {activeTrackers.map((t, i) => {
                    const isSelected = selectedWalletFilter?.toLowerCase() === t.address.toLowerCase();
                    const isCopied = copiedAddr === t.address;
                    return (
                      <tr
                        key={i}
                        onClick={() => setSelectedWalletFilter(isSelected ? null : t.address)}
                        className={`transition-colors cursor-pointer ${isSelected ? "bg-blue-50/50" : "hover:bg-[#F8FAFA]"}`}
                      >
                        <td className="px-5 py-3">
                          <div className="inline-flex items-center gap-1.5 bg-white border border-[#D0DADB] rounded-md px-2 py-0.5 shadow-2xs">
                            <code className="text-[11px] font-mono font-bold text-[#273339]">
                              {t.address.length > 20 ? `${t.address.slice(0, 8)}…${t.address.slice(-6)}` : t.address}
                            </code>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleCopy(t.address); }}
                              title="Copy address"
                              className="text-[#90999E] hover:text-[#3770FF]"
                            >
                              {isCopied ? <CheckCircleIcon size={11} className="text-emerald-600" /> : <CopyIcon size={11} />}
                            </button>
                          </div>
                          <div className="text-[10px] text-[#90999E] mt-0.5 flex items-center gap-1">
                            <ClockIcon size={9} /> Started {t.started}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-[#3770FF] bg-[#F0F4FF] border border-[#D2E0FF] px-2 py-0.5 rounded uppercase">
                            {t.chain}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border bg-emerald-50 border-emerald-200 text-emerald-700 uppercase tracking-wider">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                            Listening
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={(e) => { e.stopPropagation(); setSelectedWalletFilter(isSelected ? null : t.address); }}
                              className={`p-1.5 rounded-md border transition-all cursor-pointer ${isSelected ? "bg-[#3770FF] text-white border-[#3770FF]" : "bg-white text-[#90999E] hover:text-[#3770FF] border-[#ECF1F2]"}`}
                              title="Filter terminal by target"
                            >
                              <FilterIcon size={12} />
                            </button>
                            <button
                              onClick={(e) => handleRemoveTarget(e, t.address)}
                              className="p-1.5 rounded-md border bg-white border-[#ECF1F2] text-[#90999E] hover:text-red-500 hover:bg-red-50 transition-all cursor-pointer"
                              title="Terminate listener"
                            >
                              <TrashIcon size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* ── Framed Hardware Terminal Window ── */}
          <div className="border-t border-[#ECF1F2] bg-[#0E131F] text-slate-300">
            {/* Terminal Window Header Bar with Dots */}
            <div className="px-4 py-2.5 border-b border-slate-800 bg-[#0A0E17] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
                </div>
                <span className="text-[10px] font-mono text-slate-400 font-bold uppercase tracking-wider">
                  D-CRYPT // TELEMETRY CONSOLE
                </span>
                {selectedWalletFilter && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-mono">
                    Filtered: {selectedWalletFilter.slice(0, 8)}…
                    <button onClick={() => setSelectedWalletFilter(null)} className="ml-1 hover:text-white">×</button>
                  </span>
                )}
              </div>
              <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                WSS READY
              </span>
            </div>

            {/* Terminal Output */}
            <div className="font-mono text-[11px] p-4 flex flex-col gap-2 h-[220px] overflow-y-auto custom-scrollbar">
              {filteredFeed.map(feed => (
                <div key={feed.id} className="flex gap-2.5 items-start">
                  <span className="text-slate-500 shrink-0 select-none text-[10px] pt-0.5">[{feed.time}]</span>
                  <div className={`flex-1 p-2 rounded border leading-snug whitespace-pre-wrap font-mono ${
                    feed.type === "initiated" ? "bg-amber-500/10 border-amber-500/30 text-amber-300" :
                    feed.type === "confirmed" ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold shadow-xs" :
                    feed.type === "telemetry" ? "bg-sky-500/10 border-sky-500/25 text-sky-300 text-[10.5px]" :
                    "bg-slate-900/90 border-slate-800 text-slate-300 text-[10.5px]"
                  }`}>
                    {feed.message}
                  </div>
                </div>
              ))}
              {filteredFeed.length === 0 && (
                <div className="text-slate-600 italic py-4">Awaiting live blockchain telemetry blocks…</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}