"use client";

import React from "react";
import { AlertCircleIcon, ShieldIcon, CheckCircleIcon, ZapIcon } from "./Icons";

interface EngineStatusBannerProps {
  onSelectPreset?: () => void;
  className?: string;
}

export default function EngineStatusBanner({ onSelectPreset, className = "" }: EngineStatusBannerProps) {
  return (
    <div
      className={`rounded-2xl border border-amber-200/90 bg-gradient-to-r from-amber-50/90 via-orange-50/70 to-amber-50/90 p-5 shadow-xs transition-all ${className}`}
    >
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-9 h-9 rounded-xl bg-amber-100 border border-amber-300/80 flex items-center justify-center shrink-0 mt-0.5 shadow-xs">
            <ZapIcon size={18} className="text-amber-700" />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-bold text-amber-900 uppercase tracking-wider font-eyebrow">
                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                Live Crawler Offline · Fast Evaluation Mode Active
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900 border border-amber-300">
                SANDBOX PRESETS ONLY
              </span>
            </div>

            <p className="text-[12.5px] text-amber-950/85 leading-relaxed font-medium max-w-2xl">
              To guarantee instantaneous sub-second response times and prevent external RPC rate-limiting while our next-generation multi-chain crawler daemon undergoes architectural upgrades, 
              <strong> custom address crawling is temporarily paused</strong>. The final live production engine will be released for the <strong>SIH Grand Finale</strong> (or deployed live as we continue building more advanced heuristic clustering and dark-pool tracing models). In the meantime, please explore our verified, pre-indexed forensic cases below with zero latency.
            </p>

            <div className="flex flex-wrap items-center gap-3 mt-1 text-[11px] text-amber-800/90 font-medium">
              <span className="flex items-center gap-1">
                <CheckCircleIcon size={13} className="text-emerald-600" /> Pre-loaded real-world fraud cases ready
              </span>
              <span className="flex items-center gap-1">
                <CheckCircleIcon size={13} className="text-emerald-600" /> Zero-latency interactive graph
              </span>
              <span className="flex items-center gap-1">
                <CheckCircleIcon size={13} className="text-emerald-600" /> Final live engine slated for SIH Grand Finale release (advanced models in active build)
              </span>
            </div>
          </div>
        </div>

        {onSelectPreset && (
          <button
            type="button"
            onClick={onSelectPreset}
            className="sm:self-center px-3.5 py-2 rounded-xl bg-amber-900 text-white font-bold text-xs hover:bg-amber-950 transition-colors shadow-xs shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            Load Case #1 &rarr;
          </button>
        )}
      </div>
    </div>
  );
}
