"use client";
import { useState } from "react";
import { ShieldIcon, NetworkIcon, ActivityIcon } from "@/components/Icons";

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const handleSave = () => { setSaved(true); setTimeout(() => setSaved(false), 2000); };

  return (
    <div className="flex flex-col gap-8 max-w-2xl animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 shadow-sm">
          <ShieldIcon size={18} className="text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Settings</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Configure the D-CRYPT Tracer system preferences</p>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <NetworkIcon size={16} className="text-blue-600" />
          <p className="text-[15px] font-bold text-slate-900">API Configuration</p>
        </div>
        <div className="p-6 flex flex-col gap-5">
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Backend API URL</label>
            <input defaultValue="http://localhost:9090"
              className="w-full bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none transition-all font-mono" />
            <p className="text-[11px] text-slate-400 mt-1.5">The Go backend server address. Default: http://localhost:9090</p>
          </div>
          <div>
            <label className="block text-[12px] font-semibold text-slate-700 uppercase tracking-wider mb-2">Max Trace Depth (Hops)</label>
            <input type="number" defaultValue={10} min={1} max={20}
              className="w-32 bg-white border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 outline-none transition-all" />
            <p className="text-[11px] text-slate-400 mt-1.5">Maximum number of hops to trace per BFS run.</p>
          </div>
        </div>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <ActivityIcon size={16} className="text-emerald-600" />
          <p className="text-[15px] font-bold text-slate-900">System Information</p>
        </div>
        <div className="p-6 grid grid-cols-2 gap-4">
          {[
            ["Frontend Version", "Next.js 16.3.3"],
            ["Backend Engine", "Go 1.27 / Gin"],
            ["ML Service", "Python 3.10 (Native)"],
            ["Database", "PostgreSQL + Neo4j"],
            ["Organization", "Ministry of Home Affairs"],
            ["Platform", "D-CRYPT Tracer v1.0"],
          ].map(([label, value]) => (
            <div key={label} className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</p>
              <p className="text-sm font-bold text-slate-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={handleSave} className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-all shadow-sm">
          {saved ? "Saved!" : "Save Changes"}
        </button>
        <button className="px-5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-bold transition-all shadow-sm">
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}