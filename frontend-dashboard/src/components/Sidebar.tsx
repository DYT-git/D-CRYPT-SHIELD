"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardIcon, SearchIcon, ActivityIcon, FileTextIcon, ShieldIcon, SettingsIcon, SunIcon, MoonIcon, ZapIcon } from "./Icons";
import { useTheme } from "./ThemeProvider";

export default function Sidebar() {
  const pathname = usePathname();
  const { theme, toggleTheme } = useTheme();

  const navGroups = [
    {
      title: "Investigations",
      links: [
        { href: "/", label: "Dashboard", icon: DashboardIcon },
        { href: "/trace", label: "Trace Wallet", icon: ActivityIcon },
        { href: "/live-tracking", label: "Live Tracking", icon: ZapIcon },
        { href: "/cases", label: "All Cases", icon: ShieldIcon },
      ]
    },
    {
      title: "Intelligence",
      links: [
        { href: "/lookup", label: "VASP Database", icon: SearchIcon },
        { href: "/reports", label: "Intel Reports", icon: FileTextIcon },
      ]
    },
    {
      title: "Preferences",
      links: [
        { href: "/settings", label: "Settings", icon: SettingsIcon },
      ]
    }
  ];

  return (
    <div className="w-[260px] h-full bg-white flex flex-col py-6 border-r border-slate-200 shadow-[2px_0_10px_rgba(0,0,0,0.02)]">
      
      {/* Brand */}
      <div className="px-6 mb-8 flex items-center gap-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm shrink-0">
          <ShieldIcon size={16} className="text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-black text-slate-900 tracking-tight leading-tight">D-CRYPT Tracer</span>
          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mt-0.5">LEA Investigation Portal</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col gap-6 overflow-y-auto px-4 scrollbar-hide">
        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-3 mb-1">
              {group.title}
            </span>
            {group.links.map((link) => {
              const active = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`
                    flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all duration-200 group
                    ${active 
                      ? "bg-blue-50 text-blue-700 shadow-sm border border-blue-100/50" 
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-transparent"
                    }
                  `}
                >
                  <link.icon 
                    size={16} 
                    className={active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600 transition-colors"} 
                  />
                  {link.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer Controls */}
      <div className="px-4 mt-auto pt-6 flex flex-col gap-2">
        {/* Dark mode toggle */}
        <button
          onClick={toggleTheme}
          className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-[12px] font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50 border border-transparent transition-all duration-200"
        >
          {theme === "dark"
            ? <SunIcon size={16} className="text-amber-500" />
            : <MoonIcon size={16} className="text-slate-400" />
          }
          {theme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>

        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-col gap-3 shadow-sm hover:border-slate-300 transition-colors cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-[11px] border border-blue-200 shrink-0">
              AS
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-bold text-slate-900 truncate">Insp. A. Sharma</p>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest truncate mt-0.5">Cyber Cell Unit</p>
            </div>
          </div>
          <div className="h-px w-full bg-slate-200"></div>
          <div className="flex items-center gap-2 px-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 relative">
              <div className="absolute inset-0 rounded-full bg-emerald-500 animate-ping opacity-75"></div>
            </div>
            <p className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">D-CRYPT Core Online</p>
          </div>
        </div>
      </div>
    </div>
  );
}
