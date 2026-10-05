"use client";
import { useState, useEffect } from "react";
import { ShieldIcon, AlertCircleIcon, FileTextIcon, CheckCircleIcon } from "@/components/Icons";

export default function CivilianPage() {
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [network, setNetwork] = useState("Ethereum (ETH)");
  const [amount, setAmount] = useState("");
  const [scammer, setScammer] = useState("");
  const [txn, setTxn] = useState("");
  const [description, setDescription] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    
    // Validation
    const ethAddressRegex = /^(0x)?[0-9a-fA-F]{40}$/;
    const trxAddressRegex = /^T[a-zA-Z0-9]{33}$/;
    
    if (network.includes("Tron") && !trxAddressRegex.test(scammer)) {
      setError("Invalid Tron address format. Must start with 'T'.");
      return;
    } else if (!network.includes("Tron") && !ethAddressRegex.test(scammer)) {
      setError("Invalid EVM wallet address format.");
      return;
    }

    if (txn && !/^(0x)?[0-9a-fA-F]{64}$/.test(txn) && !txn.match(/^[a-zA-Z0-9]{64}$/)) {
      setError("Invalid Transaction Hash format.");
      return;
    }

    setLoading(true);

    try {
      // Extract Digital Footprint
      let ipData = { ip: "192.168.1.1", org: "Unknown ISP" };
      try {
        const ipRes = await fetch("https://ipapi.co/json/");
        if (ipRes.ok) {
          ipData = await ipRes.json();
        }
      } catch (err) {
        // fallback
      }

      const isVerified = localStorage.getItem("userRole") === "civilian";
      
      const newReport = {
        id: `CIV-${Math.floor(1000 + Math.random() * 9000)}`,
        submitted_at: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + " IST",
        auth: {
          verified: isVerified,
          provider: isVerified ? "Google OAuth" : "Guest Mode (Direct URL)",
          name: isVerified ? "Verified Citizen" : "Anonymous",
          email: isVerified ? "citizen@gmail.com" : "N/A",
        },
        device: {
          ip: ipData.ip || "Unknown",
          isp: (ipData as any).org || "Unknown ISP",
          vpn_detected: (ipData as any).org?.toLowerCase().includes("vpn") || (ipData as any).org?.toLowerCase().includes("datacenter") || false,
          user_agent: navigator.userAgent,
          resolution: `${window.innerWidth}x${window.innerHeight}`,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        fraud: {
          network: network,
          amount: amount,
          scammer: scammer,
          description: description,
          txn_hash: txn
        },
        status: "QUEUED"
      };

      // Sync to shared server API endpoint so officers on any device see it immediately
      try {
        await fetch("/api/civilian-reports", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newReport),
        });
      } catch (apiErr) {
        console.warn("Server API sync fallback:", apiErr);
      }

      const existingReports = JSON.parse(localStorage.getItem("sahyog_civilian_reports") || "[]");
      localStorage.setItem("sahyog_civilian_reports", JSON.stringify([newReport, ...existingReports]));

      setSubmitted(true);
    } catch (err) {
      setError("Failed to submit report. Please try again.");
    }
    setLoading(false);
  };

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto flex flex-col items-center justify-center gap-4 py-20 animate-fade-in text-center">
        <div className="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-2">
          <CheckCircleIcon size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900">Report Submitted Successfully</h2>
        <p className="text-sm text-slate-600 max-w-md mb-2">
          Your fraud report has been successfully registered. Digital footprints (IP, Device) have been secured. The Law Enforcement tracing engine has added the suspect wallet to the auto-investigation queue.
        </p>
        <button 
          onClick={() => {
            setSubmitted(false);
            setAmount(""); setScammer(""); setTxn(""); setDescription("");
          }}
          className="mt-4 font-bold text-sm text-blue-600 hover:text-blue-700 underline cursor-pointer"
        >
          Submit another report
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 animate-fade-in">

      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Report Fraudulent Transaction</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium leading-relaxed">
          Submit details about a scam or hack. Law Enforcement will review your submission and trace funds on-chain. Your device telemetry will be logged for verification.
        </p>
      </div>

      <div className="bg-white border border-[#ECF1F2] rounded-2xl shadow-sm overflow-hidden relative">
        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            
            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-xl text-[12px] font-medium flex items-center gap-2">
                <AlertCircleIcon size={16} /> {error}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Blockchain Network</label>
                <select value={network} onChange={e => setNetwork(e.target.value)} className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] focus:outline-none focus:border-blue-500 transition-colors">
                  <option>Ethereum (ETH)</option>
                  <option>Polygon (MATIC)</option>
                  <option>Binance Smart Chain (BSC)</option>
                  <option>Tron (TRX)</option>
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Amount Stolen</label>
                <input required value={amount} onChange={e => setAmount(e.target.value)} type="text" placeholder="e.g. 2.5 ETH or 5000 USDT" className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Scammer&apos;s Wallet Address</label>
              <input required value={scammer} onChange={e => setScammer(e.target.value)} type="text" placeholder="0x..." className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl font-mono text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Transaction Hash (Optional)</label>
              <input value={txn} onChange={e => setTxn(e.target.value)} type="text" placeholder="0x..." className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl font-mono text-[13px] focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#90999E] uppercase tracking-widest mb-2 font-eyebrow">Description of Fraud</label>
              <textarea required value={description} onChange={e => setDescription(e.target.value)} placeholder="Briefly describe how the fraud occurred..." rows={4} className="w-full bg-[#F6F8F7] border border-[#ECF1F2] text-[#273339] px-4 py-3 rounded-xl text-[13px] resize-none focus:outline-none focus:border-blue-500 transition-colors" />
            </div>
            <div className="pt-3 border-t border-[#ECF1F2] flex justify-end">
              <button disabled={loading} type="submit" className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold py-3 px-8 rounded-xl text-[13px] transition-colors shadow-md cursor-pointer flex items-center gap-2">
                {loading ? "Extracting Telemetry & Submitting..." : "Submit Official Report"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
