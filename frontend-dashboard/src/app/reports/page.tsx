"use client";
import Link from "next/link";
import { FileTextIcon, DownloadIcon, ExternalIcon, ShieldIcon } from "@/components/Icons";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

const SAMPLE_REPORTS = [
  { id: "RPT-2026-001", case_id: "demo-case-001", title: "Ronin Hack Mixer Trace", generated: "2026-09-07", risk: "critical", vasp: "Tornado Cash", pages: 12, size: "1.4 MB" },
  { id: "RPT-2026-002", case_id: "demo-case-002", title: "Phishing Scammer Attribution", generated: "2026-09-07", risk: "high", vasp: "Binance", pages: 9, size: "0.9 MB" },
  { id: "RPT-2026-003", case_id: "demo-case-003", title: "Aave DeFi Whale Analysis", generated: "2026-09-07", risk: "low", vasp: "Aave Protocol", pages: 7, size: "0.7 MB" },
  { id: "RPT-2026-004", case_id: "demo-case-004", title: "Safe VASP User Clearance", generated: "2026-09-07", risk: "low", vasp: "Kraken", pages: 5, size: "0.5 MB" },
];

const RISK_STYLES: Record<string, string> = {
  low: "bg-emerald-50 border-emerald-200 text-emerald-700",
  medium: "bg-amber-50 border-amber-200 text-amber-700",
  high: "bg-orange-50 border-orange-200 text-orange-700",
  critical: "bg-red-50 border-red-200 text-red-700",
};

export default function ReportsPage() {
  return (
    <div className="flex flex-col gap-8 animate-fade-in">
      <div className="flex items-start gap-4">
        <div className="w-11 h-11 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0 shadow-sm">
          <FileTextIcon size={18} className="text-blue-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Intelligence Reports</h1>
          <p className="text-sm text-slate-500 mt-1 font-medium">Downloadable PDF audit reports for all completed investigations</p>
        </div>
      </div>
      <div className="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-200">
        <ShieldIcon size={16} className="text-blue-600 shrink-0" />
        <p className="text-sm font-medium text-blue-800">All reports are cryptographically hashed and timestamped for court-admissible evidence.</p>
      </div>
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-slate-200 bg-slate-50">
          <p className="text-[15px] font-bold text-slate-900">Generated Reports</p>
          <p className="text-[11px] font-medium text-slate-400 mt-0.5">{SAMPLE_REPORTS.length} reports available</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                {["Report ID", "Case", "Title", "Risk", "VASP Found", "Date", ""].map((h) => (
                  <th key={h} className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-widest whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {SAMPLE_REPORTS.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <p className="font-mono text-[13px] font-bold text-slate-900">{r.id}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{r.pages} pages</p>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Link href={"/case/" + r.case_id} className="text-[12px] font-mono text-blue-600 hover:underline flex items-center gap-1">
                      {r.case_id} <ExternalIcon size={10} />
                    </Link>
                  </td>
                  <td className="px-6 py-4"><p className="text-sm font-semibold text-slate-800">{r.title}</p></td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={"inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold border uppercase tracking-wider " + (RISK_STYLES[r.risk] || "bg-slate-50 border-slate-200 text-slate-600")}>{r.risk}</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="text-sm font-semibold text-slate-700">{r.vasp}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap"><span className="text-[12px] text-slate-500">{r.generated}</span></td>
                  <td className="px-6 py-4 text-right whitespace-nowrap">
                    <a href={API + "/api/v1/report/" + r.case_id} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[12px] font-bold transition-all shadow-sm" download>
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