"use client";
import { ShieldIcon, AlertCircleIcon, FileTextIcon } from "@/components/Icons";

export default function CivilianPage() {
  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Report Fraudulent Transaction</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium leading-relaxed">
          Submit details about a scam or hack. Law Enforcement will review your submission and trace funds on-chain.
        </p>
      </div>

      {/* Locked Notice */}
      <div className="bg-[#1a1f2e] border border-slate-700/60 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center gap-5 shadow-lg">
        <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-center shrink-0">
          <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest font-eyebrow">Integration Pending</span>
          </div>
          <h3 className="text-[14px] font-bold text-white mb-1">Civilian Portal Locked</h3>
          <p className="text-[12px] text-slate-400 leading-relaxed max-w-lg">
            Full civic integration requires the official government Sahyog API (currently restricted). 
            For this demonstration we focused on the core engineering of the LEA Officer engine. 
            The civilian UI is disabled but fully designed.
          </p>
        </div>
      </div>

      {/* Form Preview (blurred) */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl shadow-sm overflow-hidden relative">

        {/* Blur overlay */}
        <div className="absolute inset-0 bg-white/75 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center gap-3">
          <div className="bg-[#1a1f2e] text-white px-5 py-2.5 rounded-xl font-bold text-[13px] flex items-center gap-2.5 shadow-2xl border border-slate-700">
            <svg className="w-4 h-4 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Portal in Development Mode
          </div>
          <p className="text-[12px] text-[#90999E] font-medium">Available post Sahyog API integration</p>
        </div>

        <div className="p-6">
          <form className="flex flex-col gap-5 opacity-30 select-none pointer-events-none">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Blockchain Network</label>
                <select disabled className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#616B70] px-4 py-3 rounded-xl cursor-not-allowed text-[13px]">
                  <option>Ethereum (ETH)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Amount Stolen</label>
                <input disabled type="text" placeholder="e.g. 2.5 ETH" className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#616B70] px-4 py-3 rounded-xl cursor-not-allowed text-[13px]" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Scammer&apos;s Wallet Address</label>
              <input disabled type="text" placeholder="0x…" className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#616B70] px-4 py-3 rounded-xl font-mono text-[13px] cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Description</label>
              <textarea disabled rows={3} className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#616B70] px-4 py-3 rounded-xl cursor-not-allowed text-[13px] resize-none" />
            </div>
            <div className="pt-3 border-t border-[#ECF1F2] flex justify-end">
              <button disabled className="bg-[#D0DADB] text-[#90999E] font-bold py-3 px-8 rounded-xl cursor-not-allowed text-[13px]">
                Submit Official Report
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
