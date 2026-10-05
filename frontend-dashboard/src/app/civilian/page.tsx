"use client";
import { useState } from "react";
import { ShieldIcon, AlertCircleIcon, FileTextIcon, CheckCircleIcon } from "@/components/Icons";

export default function CivilianPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 py-20 animate-fade-in text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2">
          <CheckCircleIcon size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Report Submitted Successfully</h2>
        <p className="text-sm text-slate-600 max-w-md">
          Your fraud report has been successfully registered. The Law Enforcement tracing engine has already added the suspect wallet to the auto-investigation queue.
        </p>
        <button 
          onClick={() => setSubmitted(false)}
          className="mt-6 font-bold text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Report Fraudulent Transaction</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium leading-relaxed">
          Submit details about a scam or hack. Law Enforcement will review your submission and trace funds on-chain.
        </p>
      </div>

      {/* Form Area */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl shadow-sm overflow-hidden relative">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Blockchain Network</label>
                <select className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] focus:outline-none focus:border-blue-500 transition-colors">
                  <option>Ethereum (ETH)</option>
                  <option>Polygon (MATIC)</option>
                  <option>Binance Smart Chain (BSC)</option>
                  <option>Tron (TRX)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Amount Stolen</label>
                <input required type="text" placeholder="e.g. 2.5 ETH or 5000 USDT" className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Scammer&apos;s Wallet Address</label>
              <input required type="text" placeholder="0x..." className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl font-mono text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Transaction Hash (Optional)</label>
              <input type="text" placeholder="0x..." className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl font-mono text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Description of Fraud</label>
              <textarea required placeholder="Briefly describe how the fraud occurred..." rows={4} className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] resize-none focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div className="pt-3 border-t border-[#ECF1F2] flex justify-end">
              <button type="submit" className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-8 rounded-xl text-[13px] transition-colors shadow-md">
                Submit Official Report
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
