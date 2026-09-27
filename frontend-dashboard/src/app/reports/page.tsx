"use client";

import Link from "next/link";
import { FileTextIcon, DownloadIcon, ExternalIcon, ShieldIcon, CheckCircleIcon } from "@/components/Icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const SAMPLE_REPORTS = [
  { id: "RPT-2026-001", case_id: "demo-case-001", title: "Cyber Extortion to CoinDCX Gateway",    generated: "2026-09-17", risk: "high",     vasp: "CoinDCX (FIU-IND)",   pages: 8,  size: "1.2 MB" },
  { id: "RPT-2026-002", case_id: "demo-case-002", title: "Ronin State Heist Mixer Obfuscation",    generated: "2026-09-17", risk: "critical", vasp: "Tornado Cash (OFAC)", pages: 12, size: "1.6 MB" },
  { id: "RPT-2026-003", case_id: "demo-case-003", title: "Telegram UPI Task Scam to Binance",      generated: "2026-09-17", risk: "high",     vasp: "Binance 14 (FIU-IND)",pages: 7,  size: "0.9 MB" },
  { id: "RPT-2026-004", case_id: "demo-case-004", title: "Safe DeFi Protocol Treasury Clearance",  generated: "2026-09-17", risk: "low",      vasp: "Aave V3 Pool",        pages: 5,  size: "0.6 MB" },
];

const RISK_STYLES: Record<string, string> = {
  low:      "bg-emerald-50 border-emerald-200 text-emerald-700",
  medium:   "bg-amber-50 border-amber-200 text-amber-700",
  high:     "bg-orange-50 border-orange-200 text-orange-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-6 animate-fade-in">

      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#273339] tracking-tight">Court-Admissible Dossiers</h1>
        <p className="text-[12px] text-[#616B70] mt-0.5 font-medium">
          Cryptographically sealed PDF audit reports for judicial submission & FIR evidence attachment
        </p>
      </div>

      {/* Official Cryptographic Clearance Block */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <ShieldIcon size={18} className="text-[#3770FF]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <p className="text-[13px] font-bold text-[#273339]">Evidence Integrity Verification</p>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase font-eyebrow">
                SHA-256 Verified
              </span>
            </div>
            <p className="text-[12px] text-[#616B70] mt-0.5">
              All generated dossiers are hashed and timestamped to comply with Section 65B of the Indian Evidence Act.
            </p>
          </div>
        </div>
      </div>

      {/* Reports Table */}
      <div className="bg-white border border-[#ECF1F2] rounded-2xl overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-[#ECF1F2] bg-white flex items-center justify-between">
          <div>
            <p className="text-[13px] font-bold text-[#273339]">Generated Dossiers</p>
            <p className="text-[11px] text-[#90999E] mt-0.5">{SAMPLE_REPORTS.length} court dossiers available</p>
          </div>
          <FileTextIcon size={15} className="text-[#3770FF]" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-[#ECF1F2] bg-[#F8FAFA]">
                {["Dossier ID", "Case Reference", "Investigation Title", "Risk Tier", "Identified VASP", "Issued Date", ""].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] font-bold text-[#90999E] uppercase tracking-wider whitespace-nowrap font-eyebrow">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F7F7]">
              {SAMPLE_REPORTS.map((r) => (
                <tr key={r.id} className="hover:bg-[#F8FAFA] transition-colors">
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <p className="font-mono text-[13px] font-bold text-[#273339]">{r.id}</p>
                    <p className="text-[10px] text-[#90999E] mt-0.5">{r.pages} pages · {r.size}</p>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <Link href={"/case/" + r.case_id} className="text-[12px] font-mono font-bold text-[#3770FF] hover:text-[#2368FB] hover:underline flex items-center gap-1 transition-colors">
                      {r.case_id} <ExternalIcon size={10} />
                    </Link>
                  </td>
                  <td className="px-5 py-3.5">
                    <p className="text-[13px] font-semibold text-[#273339] max-w-[260px] truncate">{r.title}</p>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border uppercase tracking-wider font-eyebrow ${RISK_STYLES[r.risk] || "bg-[#F5F7F7] border-[#ECF1F2] text-[#616B70]"}`}>
                      {r.risk}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-[13px] font-semibold text-[#273339]">{r.vasp}</span>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <span className="text-[12px] text-[#90999E]">{r.generated}</span>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    <a
                      href={API + "/api/v1/report/" + r.case_id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] text-white text-[12px] font-bold transition-all shadow-xs"
                      download
                    >
                      <DownloadIcon size={12} /> Download PDF
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}