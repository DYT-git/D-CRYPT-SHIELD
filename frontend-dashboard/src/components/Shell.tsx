"use client";
import { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { MenuIcon, XIcon, ShieldIcon } from "./Icons";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans selection:bg-blue-100">
      
      {/* Desktop Sidebar */}
      <div className="hidden md:block h-full shrink-0">
        <Sidebar />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        
        {/* Mobile Topbar */}
        <div className="md:hidden bg-white flex items-center justify-between p-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-sm">
              <ShieldIcon size={16} className="text-white" />
            </div>
            <span className="text-base font-black text-slate-900 tracking-tight">D-CRYPT Tracer</span>
          </div>
          <button 
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 text-slate-500 hover:text-slate-900 transition-colors"
          >
            <MenuIcon size={20} />
          </button>
        </div>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-y-auto relative scroll-smooth">
          <div className="p-6 md:p-10 max-w-[1400px] mx-auto w-full">
            {children}
          </div>
        </main>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div 
            className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm" 
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 bg-white h-full shadow-2xl flex flex-col">
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-900 transition-colors z-50"
            >
              <XIcon size={20} />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}
