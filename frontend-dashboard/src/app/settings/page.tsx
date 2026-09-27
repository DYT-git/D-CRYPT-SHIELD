"use client";

import { useState } from "react";
import { NetworkIcon, ActivityIcon, CheckCircleIcon } from "@/components/Icons";
import { useDemoMode } from "@/contexts/DemoModeContext";

export default function SettingsPage() {
  const { isDemoMode, setIsDemoMode, demoVoice, setDemoVoice } = useDemoMode();
  const [saved, setSaved] = useState(false);
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex flex-col gap-6 max-w-2xl animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Engine Settings</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium">Configure network node endpoints and traversal parameters</p>
      </div>

      {/* API Config */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#ECF1F2] bg-white flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#F0F4FF] border border-[#D2E0FF] flex items-center justify-center">
            <NetworkIcon size={13} className="text-[#3770FF]" />
          </div>
          <p className="text-[13px] font-bold text-[#273339]">Backend RPC Configuration</p>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">Backend API URL</label>
            <input
              defaultValue="http://localhost:9090"
              className="w-full bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-4 py-2.5 text-[13px] text-[#273339] outline-none transition-all font-mono shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            />
            <p className="text-[11px] text-[#90999E] mt-1.5">Default Go backend listener port: http://localhost:9090</p>
          </div>
          <div>
            <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-wider mb-2 font-eyebrow">Default Max Depth (Hops)</label>
            <input
              type="number"
              defaultValue={10}
              min={1}
              max={20}
              className="w-32 bg-white border border-[#D0DADB] focus:border-[#3770FF] focus:ring-4 focus:ring-[#3770FF]/10 rounded-xl px-4 py-2 text-[13px] text-[#273339] outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]"
            />
            <p className="text-[11px] text-[#90999E] mt-1.5">Maximum recursion depth for multi-hop BFS runs.</p>
          </div>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#ECF1F2] bg-white flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center">
            <ActivityIcon size={13} className="text-emerald-600" />
          </div>
          <p className="text-[13px] font-bold text-[#273339]">Architecture Stack</p>
        </div>
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[
            ["Frontend Engine",   "Next.js 16.3.3 (Turbopack)"],
            ["Backend Daemon",    "Go 1.27 / Gin Core"],
            ["Intelligence ML",   "Python 3.10 (Native Heuristics)"],
            ["Graph Persistence", "PostgreSQL + Neo4j Cypher"],
            ["Deployment Target", "D-CRYPT SHIELD Build v1.0.4"],
            ["Forensic Standard", "Section 65B Indian Evidence Act"],
          ].map(([label, value]) => (
            <div key={label} className="bg-[#F8FAFA] border border-[#ECF1F2] rounded-xl p-3.5">
              <p className="text-[10px] font-bold text-[#90999E] uppercase tracking-wider mb-1 font-eyebrow">{label}</p>
              <p className="text-[12px] font-bold text-[#273339] font-mono">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Presenter / Video Demo Mode */}
      <div className="bg-white border border-purple-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-purple-100 bg-purple-50/50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-purple-100 border border-purple-200 flex items-center justify-center">
              <span className="text-purple-600 font-mono font-bold text-xs italic">i</span>
            </div>
            <div>
              <p className="text-[13px] font-bold text-[#273339]">Video Presenter Mode</p>
              <p className="text-[10px] text-slate-500 font-medium">Injects explainer popup buttons across the UI</p>
            </div>
          </div>
          
          {/* Toggle Button */}
          <button
            onClick={() => setIsDemoMode(!isDemoMode)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none cursor-pointer ${
              isDemoMode ? "bg-purple-600" : "bg-slate-300"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                isDemoMode ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        
        {/* Voice Selection row (only visible when demo mode is active) */}
        {isDemoMode && (
          <div className="px-5 py-4 bg-white flex items-center justify-between">
            <div>
              <p className="text-[12px] font-bold text-[#273339]">AI Voice Type</p>
              <p className="text-[10px] text-slate-500 font-medium">Select presenter accent and tone</p>
            </div>
            
            <div className="flex bg-[#F5F7F7] border border-[#ECF1F2] p-1 rounded-xl">
              <button
                onClick={() => setDemoVoice('male')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  demoVoice === 'male'
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-[#90999E] hover:text-[#273339]"
                }`}
              >
                Male (UK/US)
              </button>
              <button
                onClick={() => setDemoVoice('female')}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  demoVoice === 'female'
                    ? "bg-white text-purple-700 shadow-xs border border-purple-200"
                    : "text-[#90999E] hover:text-[#273339]"
                }`}
              >
                Female (UK/US)
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleSave}
          className="px-5 py-2.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] text-white text-[13px] font-bold transition-all shadow-xs flex items-center gap-2 cursor-pointer"
        >
          {saved ? <><CheckCircleIcon size={14} /> Saved!</> : "Save Preferences"}
        </button>
        <button className="px-5 py-2.5 rounded-xl bg-white border border-[#D0DADB] hover:border-[#3770FF] text-[#616B70] hover:text-[#273339] text-[13px] font-bold transition-all shadow-2xs cursor-pointer">
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}