import React from "react";
import { useDemoMode } from "@/contexts/DemoModeContext";

export default function DemoBadge({ id, className = "" }: { id: string; className?: string }) {
  const { isDemoMode, setActiveDemoId } = useDemoMode();

  if (!isDemoMode) return null;

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setActiveDemoId(id);
      }}
      className={`relative group inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-800 border border-slate-600 shadow-sm hover:bg-slate-700 hover:border-slate-400 hover:scale-110 transition-all duration-300 z-40 cursor-pointer ml-2 align-middle ${className}`}
      title="Explanation for video"
    >
      <span className="font-mono text-xs font-bold italic text-white group-hover:text-amber-400 transition-colors">
        i
      </span>
      {/* Subtle glowing ring effect on hover */}
      <span className="absolute inset-0 rounded-full border border-amber-400/0 group-hover:border-amber-400/50 group-hover:animate-ping opacity-20"></span>
    </button>
  );
}
