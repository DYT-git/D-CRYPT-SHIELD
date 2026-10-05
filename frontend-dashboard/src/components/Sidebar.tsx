"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  DashboardIcon,
  ActivityIcon,
  ZapIcon,
  FolderIcon,
  DatabaseIcon,
  FileTextIcon,
  SettingsIcon,
  UserIcon,
} from "./Icons";

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [civilianCount, setCivilianCount] = useState<number>(3);

  useEffect(() => {
    setRole(localStorage.getItem("userRole"));

    const checkIntake = async () => {
      try {
        const res = await fetch("/api/civilian-reports");
        if (res.ok) {
          const data = await res.json();
          if (data.reports) setCivilianCount(data.reports.length);
          return;
        }
      } catch {}
      try {
        const stored = localStorage.getItem("sahyog_civilian_reports");
        if (stored) {
          const parsed = JSON.parse(stored);
          setCivilianCount(3 + parsed.length);
        }
      } catch {}
    };

    checkIntake();
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem("userRole");
    router.push("/");
  };

  const navLinks =
    role === "civilian"
      ? [
          { href: "/civilian", label: "Submit Report", icon: FileTextIcon },
        ]
      : [
          { href: "/dashboard", label: "Dashboard", icon: DashboardIcon },
          { href: "/civilian-reports", label: "Public Intake", icon: UserIcon },
          { href: "/trace", label: "Trace Wallet", icon: ActivityIcon },
          { href: "/live-tracking", label: "Live Tracking", icon: ZapIcon },
          { href: "/cases", label: "All Cases", icon: FolderIcon },
          { href: "/lookup", label: "VASP Database", icon: DatabaseIcon },
          { href: "/reports", label: "Intel Reports", icon: FileTextIcon },
          { href: "/settings", label: "Settings", icon: SettingsIcon },
        ];

  return (
    <aside className="w-64 h-full bg-white/85 backdrop-blur-xl flex flex-col border-r border-[#13123A]/8 shadow-2xs font-sans select-none shrink-0">
      
      {/* ── Top Corner Brand: Crisp, Midnight Ink Wordmark ── */}
      <div className="h-16 px-6 flex items-center border-b border-[#13123A]/8">
        <Link href={role === "civilian" ? "/civilian" : "/dashboard"} className="flex items-center group">
          <span className="text-[19px] font-black tracking-[-0.02em] text-[#0F172A] uppercase font-eyebrow flex items-center gap-1.5 leading-none group-hover:opacity-90 transition-opacity">
            D-CRYPT <span className="text-[#2563EB]">SHIELD</span>
          </span>
        </Link>
      </div>

      {/* ── Main Navigation List ── */}
      <nav className="flex-1 px-3 pt-5 pb-3 flex flex-col gap-1 overflow-y-auto scrollbar-hide">
        <div className="px-3 pb-2 text-[10px] font-bold text-[#757995] uppercase tracking-wider font-eyebrow">
          {role === "civilian" ? "Civilian Portal" : "Forensic Console"}
        </div>

        {navLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== "/dashboard" && pathname.startsWith(link.href));
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`relative flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[13px] font-bold transition-all duration-150 ${
                isActive
                  ? "bg-[#3770FF]/10 text-[#3770FF] shadow-2xs font-bold"
                  : "text-[#515470] hover:text-[#13123A] hover:bg-white/60"
              }`}
            >
              {/* Left active indicator bar */}
              {isActive && (
                <span className="absolute left-0 top-2 bottom-2 w-1 bg-[#3770FF] rounded-r-full" />
              )}
              <Icon
                size={17}
                className={isActive ? "text-[#3770FF]" : "text-[#757995]"}
                strokeWidth={isActive ? 2 : 1.75}
              />
              <span className="truncate flex-1">{link.label}</span>
              {link.href === "/civilian-reports" && civilianCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 font-mono">
                  {civilianCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Bottom Officer Profile & Sign Out ── */}
      <div className="p-4 border-t border-[#13123A]/8 bg-white/40 backdrop-blur-sm flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-[#D2E0FF] text-[#3770FF] font-mono font-bold flex items-center justify-center text-[12px] border border-[#B8D0FF] shrink-0">
            {role === "civilian" ? "CV" : "AS"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#13123A] truncate leading-tight">
              {role === "civilian" ? "Civilian User" : "Insp. A. Sharma"}
            </p>
            <p className="text-[10px] text-[#757995] font-medium truncate mt-0.5 font-eyebrow uppercase tracking-wide">
              {role === "civilian" ? "Verified Citizen" : "Special Cell Unit"}
            </p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-[#757995] hover:text-[#A32C00] hover:bg-red-50/70 transition-colors flex items-center justify-between cursor-pointer"
        >
          <span>End Session</span>
          <span className="text-[10px] uppercase font-eyebrow">Sign Out →</span>
        </button>
      </div>
    </aside>
  );
}
