"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Sidebar from "./Sidebar";
import { MenuIcon, XIcon } from "./Icons";

export default function Shell({ children }: { children: React.ReactNode }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const role = localStorage.getItem("userRole");
    if (!role && pathname !== "/") {
      router.push("/");
    }
  }, [pathname, router]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  if (!isMounted) return null; // Prevent hydration mismatch

  if (pathname === "/") {
    return <main className="font-sans min-h-screen">{children}</main>;
  }

  return (
    <div className="flex h-screen bg-transparent text-[#13123A] overflow-hidden font-sans selection:bg-[#3770FF]/20">
      
      {/* ── Desktop Side Navigation ── */}
      <div className="hidden md:block h-full shrink-0 z-20">
        <Sidebar />
      </div>

      {/* ── Main Canvas Content Area ── */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        
        {/* Mobile Top Header */}
        <div className="md:hidden bg-white flex items-center justify-between px-5 py-4 border-b border-[#ECF1F2] shrink-0">
          <Link href="/" className="flex items-center">
            <span className="text-[17px] font-black tracking-[-0.02em] text-[#0F172A] uppercase font-eyebrow flex items-center gap-1.5 leading-none">
              D-CRYPT <span className="text-[#2563EB]">SHIELD</span>
            </span>
          </Link>
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 rounded-lg text-[#616B70] hover:text-[#273339] hover:bg-[#F6F8F7] transition-colors"
          >
            <MenuIcon size={20} />
          </button>
        </div>

        {/* Scrollable Main Window */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-5 md:p-8 lg:p-10 max-w-[1500px] w-full mx-auto scroll-smooth">
          {children}
        </main>
      </div>

      {/* ── Mobile Drawer ── */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-white h-full shadow-2xl flex flex-col z-10 animate-fade-in">
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="absolute top-4 right-4 text-[#90999E] hover:text-[#273339] p-1.5 rounded-lg transition-colors z-20"
            >
              <XIcon size={18} />
            </button>
            <Sidebar />
          </div>
        </div>
      )}
    </div>
  );
}
