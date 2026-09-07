"use client";
import { useState, useEffect } from "react";
import { ZapIcon, NetworkIcon, SearchIcon, ShieldIcon, ClockIcon, TrashIcon, FilterIcon } from "@/components/Icons";

const CHAINS = [
  { id: "ethereum", label: "Ethereum", logo: "https://cryptologos.cc/logos/ethereum-eth-logo.svg?v=032" },
  { id: "bitcoin",  label: "Bitcoin",  logo: "https://cryptologos.cc/logos/bitcoin-btc-logo.svg?v=032" },
  { id: "tron",     label: "Tron",     logo: "https://cryptologos.cc/logos/tron-trx-logo.svg?v=032" },
  { id: "bnb",      label: "BNB Chain",logo: "https://cryptologos.cc/logos/bnb-bnb-logo.svg?v=032" },
];

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:9090";

export default function LiveTrackingPage() {
  const [address, setAddress] = useState("");
  const [chain, setChain] = useState("ethereum");
  const [asset, setAsset] = useState("native"); 
  const [officerEmail, setOfficerEmail] = useState("");
  const [isTracking, setIsTracking] = useState(false);
  
  const [activeTrackers, setActiveTrackers] = useState<any[]>([]);
  const [liveFeed, setLiveFeed] = useState<any[]>([]);
  const [selectedWalletFilter, setSelectedWalletFilter] = useState<string | null>(null);

  // 1. Persist Trackers to LocalStorage
  useEffect(() => {
    const saved = localStorage.getItem("dcrypt_active_trackers");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setActiveTrackers(parsed);
        // Re-emit them to the backend just in case the server restarted
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

  // 2. Listen to SSE feed
  useEffect(() => {
    const sse = new EventSource(`${API}/api/v1/live-feed`);
    
    sse.onmessage = (event) => {
      const data = JSON.parse(event.data);
      setLiveFeed(prev => [{
        id: Math.random().toString(),
        time: new Date().toLocaleTimeString(),
        type: data.type,
        message: data.message,
        target: data.target // We extract the target from the backend payload!
      }, ...prev].slice(0, 50)); 
    };

    sse.onerror = () => {
      console.log("SSE disconnected, reconnecting...");
    };

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
        body: JSON.stringify({ address, chain, asset, action: "add", officer_email: officerEmail }),
      });
      
      if (res.ok) {
        setActiveTrackers(prev => {
          // avoid duplicates
          if (prev.find(t => t.address.toLowerCase() === address.toLowerCase())) return prev;
          return [{
            id: `TRK-${Math.floor(Math.random()*1000)}`,
            address,
            chain,
            email: officerEmail,
            asset: asset === "native" ? "Native Only" : "All Tokens",
            status: "listening",
            started: new Date().toLocaleTimeString()
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
      if (selectedWalletFilter?.toLowerCase() === targetAddress.toLowerCase()) {
        setSelectedWalletFilter(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredFeed = liveFeed.filter(feed => {
    if (!selectedWalletFilter) return true;
    if (feed.type === 'system') return true; // always show system logs
    return feed.target?.toLowerCase() === selectedWalletFilter.toLowerCase();
  });

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-8 animate-fade-in pb-20">
      
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
          <ZapIcon size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight m-0">Live Interception Engine</h1>
          <p className="text-sm text-slate-500 mt-1.5 font-medium">
            Deploy exact-match listeners to intercept global WSS blocks natively in real-time.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Form */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          <form onSubmit={handleStartTracking} className="glass-panel p-6 flex flex-col gap-5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Target Wallet Address</label>
              <div className="relative">
                <SearchIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  required
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono text-slate-900 outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">Network Layer</label>
              <div className="grid grid-cols-2 gap-2">
                {CHAINS.map(c => (
                  <button
                    type="button"
                    key={c.id}
                    onClick={() => setChain(c.id)}
                    className={`flex items-center gap-2 p-2 rounded-xl border text-[12px] font-bold transition-all ${
                      chain === c.id 
                        ? "bg-amber-50 border-amber-200 text-amber-700 shadow-sm" 
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    <img src={c.logo} alt={c.label} className="w-4 h-4 object-contain" />
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div>
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                Officer Alert Email <span className="text-amber-500 normal-case ml-1 font-semibold">(Optional)</span>
              </label>
              <input
                type="email"
                placeholder="officer@agency.gov.in"
                value={officerEmail}
                onChange={(e) => setOfficerEmail(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 outline-none transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isTracking}
              className="mt-2 w-full flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm py-3 rounded-xl transition-all shadow-md disabled:opacity-70"
            >
              <ZapIcon size={16} className={isTracking ? "animate-pulse text-amber-400" : "text-amber-400"} />
              {isTracking ? "Deploying Tracker..." : "Deploy Tracker Engine"}
            </button>
          </form>
          
          <div className="glass-panel p-5 bg-amber-50/50 border-amber-200/50">
            <div className="flex items-center gap-2 mb-2">
              <ShieldIcon size={14} className="text-amber-600" />
              <p className="text-[11px] font-bold text-amber-800 uppercase tracking-widest">Engine Separation Active</p>
            </div>
            <p className="text-xs text-amber-700/80 leading-relaxed font-medium">
              Trackers run natively on the backend via Websockets. You can safely close or refresh this tab.
            </p>
          </div>
        </div>

        {/* Right Column: Active Trackers & Feed */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass-panel overflow-hidden flex flex-col h-full min-h-[500px]">
            
            <div className="px-5 py-4 border-b border-[var(--border-color)] bg-[var(--bg-header)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <NetworkIcon className="w-4 h-4 text-[var(--accent)]" />
                <h2 className="text-sm font-bold text-[var(--text-1)] m-0">Active Listening Engines</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">WSS Connected</span>
              </div>
            </div>

            <div className="p-0 overflow-x-auto min-h-[150px]">
              {activeTrackers.length === 0 ? (
                <div className="flex items-center justify-center h-full text-slate-400 text-sm font-medium py-10">
                  No active trackers. Deploy an engine to begin.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Wallet</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Network</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Status</th>
                      <th className="px-5 py-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeTrackers.map((t, i) => {
                      const isSelected = selectedWalletFilter?.toLowerCase() === t.address.toLowerCase();
                      return (
                        <tr 
                          key={i} 
                          onClick={() => setSelectedWalletFilter(isSelected ? null : t.address)}
                          className={`transition-colors cursor-pointer ${isSelected ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}
                        >
                          <td className="px-5 py-4">
                            <code className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded border border-slate-200">
                              {t.address.length > 20 ? `${t.address.slice(0, 8)}...${t.address.slice(-6)}` : t.address}
                            </code>
                            <div className="text-[10px] text-slate-400 mt-1 font-medium flex items-center gap-1">
                              <ClockIcon size={10} /> Started {t.started}
                            </div>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-block w-max text-[10px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded uppercase">{t.chain}</span>
                          </td>
                          <td className="px-5 py-4">
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold border bg-emerald-50 border-emerald-200 text-emerald-700 uppercase tracking-wider">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                              Listening
                            </span>
                          </td>
                          <td className="px-5 py-4">
                            <div className="flex gap-2">
                              <button 
                                onClick={(e) => { e.stopPropagation(); setSelectedWalletFilter(isSelected ? null : t.address); }}
                                className={`p-1.5 rounded-lg border transition-all ${isSelected ? 'bg-amber-100 text-amber-700 border-amber-300 shadow-inner' : 'bg-white text-slate-400 hover:text-amber-600 border-slate-200'}`}
                                title="Filter Terminal to this wallet"
                              >
                                <FilterIcon size={14} />
                              </button>
                              <button 
                                onClick={(e) => handleRemoveTarget(e, t.address)}
                                className="p-1.5 rounded-lg border bg-white border-slate-200 text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all"
                                title="Stop tracking & remove"
                              >
                                <TrashIcon size={14} />
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
            
            {/* Live Feed Area */}
            <div className="mt-auto border-t border-[var(--border-color)] bg-slate-950 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <p className="text-[12px] font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
                    <ZapIcon size={14} className="text-amber-500" />
                    D-CRYPT TACTICAL TELEMETRY CONSOLE
                  </p>
                  {selectedWalletFilter && (
                    <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded border border-amber-500/30 flex items-center gap-1 font-mono">
                      Filtering: {selectedWalletFilter.slice(0,6)}...
                      <button onClick={() => setSelectedWalletFilter(null)} className="ml-1 hover:text-white">&times;</button>
                    </span>
                  )}
                </div>
                
                <span className="text-[10px] text-slate-500 font-mono flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  {liveFeed.length > 0 ? "Receiving telemetry..." : "Awaiting blocks..."}
                </span>
              </div>
              
              <div className="font-mono text-[11px] flex flex-col gap-3 h-[250px] overflow-y-auto pr-2 custom-scrollbar">
                
                {filteredFeed.map(feed => (
                  <div key={feed.id} className={`flex gap-3 items-start animate-fade-in ${
                    feed.type === 'initiated' ? 'text-amber-400' :
                    feed.type === 'confirmed' ? 'text-emerald-400' :
                    'text-slate-400' // system
                  }`}>
                    <span className="shrink-0 opacity-60">[{feed.time}]</span>
                    <div className={`flex-1 p-2 rounded border ${
                      feed.type === 'initiated' ? 'bg-amber-500/10 border-amber-500/30 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                      feed.type === 'confirmed' ? 'bg-emerald-500/10 border-emerald-500/30' :
                      'bg-slate-800/50 border-slate-700'
                    }`}>
                      {feed.message}
                    </div>
                  </div>
                ))}

                {filteredFeed.length === 0 && (
                   <div className="text-slate-500 italic mt-2 ml-14">No logs found for this filter.</div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}