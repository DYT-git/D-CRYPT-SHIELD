"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  ShieldIcon, 
  AlertCircleIcon, 
  FileTextIcon, 
  CheckCircleIcon, 
  UserIcon, 
  NetworkIcon,
  RefreshIcon,
  ZapIcon,
  ActivityIcon
} from "@/components/Icons";

const MOCK_REPORTS = [
  {
    id: "CIV-8891",
    submitted_at: "Today, 14:22 IST",
    auth: {
      verified: true,
      provider: "Google OAuth",
      name: "Ramesh Kumar",
      email: "ramesh.kumar88@gmail.com",
    },
    device: {
      ip: "103.18.23.99",
      isp: "Jio Infocomm Ltd",
      vpn_detected: false,
      user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/116.0",
      resolution: "1920x1080",
      timezone: "Asia/Kolkata",
    },
    fraud: {
      network: "Ethereum (ETH)",
      amount: "2.4 ETH",
      scammer: "0x742d35Cc6634C0532925a3b844Bc454e4438f44e",
      description: "I received a Telegram message offering a part-time job reviewing hotels. After the first payment, they asked me to deposit crypto to unlock VIP tasks. They froze my funds and demanded more."
    },
    status: "PROCESSING_BFS"
  },
  {
    id: "CIV-8892",
    submitted_at: "Today, 15:05 IST",
    auth: {
      verified: false,
      provider: "Guest Mode (Direct URL)",
      name: "Anonymous Citizen",
      email: "N/A",
    },
    device: {
      ip: "193.122.44.11",
      isp: "Mullvad VPN / Datacamp Ltd",
      vpn_detected: true,
      user_agent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15",
      resolution: "1440x900",
      timezone: "Europe/London (Mismatch Detected)",
    },
    fraud: {
      network: "Tron (TRX)",
      amount: "4,500 USDT",
      scammer: "TG49rL7YtP6A9v3X8w5Z1q2KxJmN8cU9sL",
      description: "Invested in a yield farming platform called DeFi-Max. When I tried to withdraw my USDT, the contract threw an error and my balance was drained."
    },
    status: "PENDING_REVIEW"
  },
  {
    id: "CIV-8893",
    submitted_at: "Today, 16:10 IST",
    auth: {
      verified: true,
      provider: "Google OAuth",
      name: "Anjali Desai",
      email: "anjali.d99@yahoo.in",
    },
    device: {
      ip: "49.36.14.21",
      isp: "Airtel Broadband",
      vpn_detected: false,
      user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15",
      resolution: "390x844",
      timezone: "Asia/Kolkata",
    },
    fraud: {
      network: "Polygon (MATIC)",
      amount: "15,000 MATIC",
      scammer: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      description: "Clicked on a phishing link disguised as a MetaMask airdrop. Signed a malicious contract that transferred all my MATIC to the scammer."
    },
    status: "QUEUED"
  }
];

export default function CivilianReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<any[]>(MOCK_REPORTS);
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchReports = async () => {
    setRefreshing(true);
    let combined = [...MOCK_REPORTS];

    // 1. Try reading from shared server API
    try {
      const res = await fetch("/api/civilian-reports");
      if (res.ok) {
        const data = await res.json();
        if (data.reports && Array.isArray(data.reports)) {
          combined = data.reports;
        }
      }
    } catch (e) {
      console.warn("API fetch fallback:", e);
    }

    // 2. Merge with any local storage submissions
    try {
      const stored = localStorage.getItem("sahyog_civilian_reports");
      if (stored) {
        const localList = JSON.parse(stored);
        if (Array.isArray(localList)) {
          localList.forEach((item) => {
            if (!combined.some((c) => c.id === item.id)) {
              combined.unshift(item);
            }
          });
        }
      }
    } catch (e) {
      console.warn("Local storage parse fallback:", e);
    }

    setReports(combined);
    if (!selectedReport && combined.length > 0) {
      setSelectedReport(combined[0]);
    } else if (selectedReport) {
      const updated = combined.find((r) => r.id === selectedReport.id);
      if (updated) setSelectedReport(updated);
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  useEffect(() => {
    if (reports.length > 0 && !selectedReport) {
      setSelectedReport(reports[0]);
    }
  }, [reports, selectedReport]);

  const handleTriggerTrace = (report: any) => {
    const netLower = (report.fraud.network || "").toLowerCase();
    const chainSlug = netLower.includes("tron")
      ? "tron"
      : netLower.includes("polygon") || netLower.includes("matic")
      ? "polygon"
      : netLower.includes("binance") || netLower.includes("bsc")
      ? "bnb"
      : "ethereum";

    localStorage.setItem(
      "trace_preset_override",
      JSON.stringify({
        address: report.fraud.scammer,
        chain: chainSlug,
        case_id: report.id,
        submitted_by: `Civilian Complaint (${report.auth.name})`,
        amount: report.fraud.amount,
      })
    );

    router.push(
      `/trace?address=${encodeURIComponent(report.fraud.scammer)}&chain=${chainSlug}&case_id=${encodeURIComponent(
        report.id
      )}`
    );
  };

  const handleLiveWatch = (report: any) => {
    const netLower = (report.fraud.network || "").toLowerCase();
    const chainSlug = netLower.includes("tron")
      ? "tron"
      : netLower.includes("polygon") || netLower.includes("matic")
      ? "polygon"
      : netLower.includes("binance") || netLower.includes("bsc")
      ? "bnb"
      : "ethereum";

    router.push(
      `/live-tracking?address=${encodeURIComponent(report.fraud.scammer)}&chain=${chainSlug}`
    );
  };

  if (!selectedReport) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-80px)] text-slate-500 font-medium">
        Loading civilian reports queue...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-80px)] animate-fade-in">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-black text-[#273339] tracking-tight">Public Intake Queue</h1>
            <span className="bg-blue-100 text-blue-700 text-[11px] font-bold px-2 py-0.5 rounded-full border border-blue-200">
              {reports.length} Active Complaints
            </span>
          </div>
          <p className="text-[12px] text-[#616B70] mt-0.5 font-medium leading-relaxed">
            Direct fraud complaints submitted by civilians. Automatically captures device telemetry, IP footprint, and suspect wallet addresses.
          </p>
        </div>

        <button
          onClick={fetchReports}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-[12px] font-bold text-slate-700 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
        >
          <RefreshIcon size={14} className={refreshing ? "animate-spin text-blue-600" : "text-slate-500"} />
          {refreshing ? "Refreshing..." : "Refresh Queue"}
        </button>
      </div>

      <div className="flex gap-6 flex-1 min-h-0 pb-6">
        
        {/* Left Column: Report List */}
        <div className="w-1/3 flex flex-col gap-3 overflow-y-auto pr-2 custom-scrollbar">
          {reports.map((report) => (
            <button
              key={report.id}
              onClick={() => setSelectedReport(report)}
              className={`w-full text-left p-4 rounded-xl border transition-all cursor-pointer ${
                selectedReport.id === report.id
                  ? "bg-blue-50/80 border-blue-300 shadow-xs ring-1 ring-blue-400/20"
                  : "bg-white border-slate-200 hover:border-blue-300 hover:shadow-xs"
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <span className="text-[11px] font-bold font-mono text-slate-500">{report.id}</span>
                {report.auth.verified ? (
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircleIcon size={10} /> Verified
                  </span>
                ) : (
                  <span className="text-[10px] font-bold bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <AlertCircleIcon size={10} /> Unverified
                  </span>
                )}
              </div>
              <h3 className="text-[13px] font-bold text-slate-900 mb-1 line-clamp-1">{report.fraud.description}</h3>
              <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium">
                <span className="font-bold text-slate-700">{report.fraud.amount}</span>
                <span>{report.submitted_at}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Right Column: Detailed View */}
        <div className="w-2/3 bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col overflow-y-auto custom-scrollbar">
          
          <div className="p-6 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 rounded-t-2xl">
            <div>
              <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                Intake Dossier: <span className="font-mono text-blue-600">{selectedReport.id}</span>
              </h2>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                Received via Civilian Victim Intake Gateway • SAHYOG Schema Compatible
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => handleLiveWatch(selectedReport)}
                className="bg-slate-900 hover:bg-black text-white font-bold px-3 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <ZapIcon size={13} className="text-amber-400" />
                Live Watch Target
              </button>
              <button 
                onClick={() => handleTriggerTrace(selectedReport)}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-lg text-xs transition-colors shadow-2xs cursor-pointer flex items-center gap-1.5"
              >
                <ActivityIcon size={13} />
                Trigger Automated BFS Trace
              </button>
            </div>
          </div>

          <div className="p-6 space-y-7">
            
            {/* Identity & Verification */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 font-eyebrow">
                <UserIcon size={14} className="text-blue-500" /> Claimant Identity & Auth
              </h4>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="block text-slate-500 mb-1">Verification Status</span>
                  {selectedReport.auth.verified ? (
                    <span className="font-bold text-emerald-600 flex items-center gap-1">
                      <CheckCircleIcon size={14} /> Authenticated ({selectedReport.auth.provider})
                    </span>
                  ) : (
                    <span className="font-bold text-rose-600 flex items-center gap-1">
                      <AlertCircleIcon size={14} /> Anonymous ({selectedReport.auth.provider})
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">Complainant Name</span>
                  <span className="font-bold text-slate-900">{selectedReport.auth.name}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">Registered Contact Email</span>
                  <span className="font-semibold text-slate-700 font-mono">{selectedReport.auth.email}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">Filing Timestamp</span>
                  <span className="font-semibold text-slate-700">{selectedReport.submitted_at}</span>
                </div>
              </div>
            </div>

            {/* Device & Network Telemetry */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 font-eyebrow">
                <NetworkIcon size={14} className="text-purple-500" /> Digital Footprint Extraction
              </h4>
              <div className={`border rounded-xl p-4 grid grid-cols-2 gap-4 text-xs ${selectedReport.device.vpn_detected ? 'bg-orange-50/70 border-orange-200' : 'bg-slate-50 border-slate-200'}`}>
                <div>
                  <span className="block text-slate-500 mb-1">IP Address</span>
                  <span className="font-bold text-slate-900 font-mono">{selectedReport.device.ip}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">Network / ISP Gateway</span>
                  <span className="font-semibold text-slate-700">{selectedReport.device.isp}</span>
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">VPN / Proxy Detected</span>
                  {selectedReport.device.vpn_detected ? (
                    <span className="font-bold text-rose-600 flex items-center gap-1 bg-rose-100 px-2 py-0.5 rounded w-max">
                      <AlertCircleIcon size={12} /> Yes (Anonymized Routing)
                    </span>
                  ) : (
                    <span className="font-bold text-emerald-600 flex items-center gap-1 bg-emerald-100 px-2 py-0.5 rounded w-max">
                      <CheckCircleIcon size={12} /> No (Residential IP Verified)
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-slate-500 mb-1">Device Timezone</span>
                  <span className={`font-semibold ${selectedReport.device.vpn_detected ? 'text-rose-600' : 'text-slate-700'}`}>
                    {selectedReport.device.timezone}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-slate-500 mb-1">Browser Client Signature</span>
                  <span className="font-mono text-[11px] text-slate-600 bg-white p-2.5 rounded border border-slate-200 block break-all">
                    {selectedReport.device.user_agent} • Screen: {selectedReport.device.resolution}
                  </span>
                </div>
              </div>
            </div>

            {/* Fraud Details */}
            <div>
              <h4 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2 font-eyebrow">
                <ShieldIcon size={14} className="text-emerald-500" /> Fraud & Blockchain Evidence
              </h4>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col gap-4 text-xs">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-slate-500 mb-1">Target Blockchain</span>
                    <span className="font-bold text-slate-900">{selectedReport.fraud.network}</span>
                  </div>
                  <div>
                    <span className="block text-slate-500 mb-1">Reported Loss Amount</span>
                    <span className="font-bold text-slate-900 text-sm text-rose-600">{selectedReport.fraud.amount}</span>
                  </div>
                </div>

                <div>
                  <span className="block text-slate-500 mb-1">Suspect Scammer Wallet Address</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-blue-600 font-bold bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-200 select-all break-all text-[12px]">
                      {selectedReport.fraud.scammer}
                    </span>
                  </div>
                </div>

                {selectedReport.fraud.txn_hash && (
                  <div>
                    <span className="block text-slate-500 mb-1">Transaction Hash (TxID)</span>
                    <span className="font-mono text-slate-700 bg-white px-2.5 py-1 rounded border border-slate-200 select-all break-all text-[11px] block">
                      {selectedReport.fraud.txn_hash}
                    </span>
                  </div>
                )}

                <div>
                  <span className="block text-slate-500 mb-1">Victim's Official Statement</span>
                  <p className="text-slate-700 leading-relaxed p-3.5 bg-white border border-slate-200 rounded-lg italic">
                    "{selectedReport.fraud.description}"
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
