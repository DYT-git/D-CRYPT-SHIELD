import type { Metadata } from "next";
import "./globals.css";
import Shell from "@/components/Shell";
import { ThemeProvider } from "@/components/ThemeProvider";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import DemoModal from "@/components/DemoModal";

export const metadata: Metadata = {
  title: "D-CRYPT SHIELD | Blockchain Forensics & VASP Attribution",
  description: "Automated Multi-Hop Attribution of Unhosted Wallets to Nearest VASPs & Court Requisition Engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&family=Montserrat:wght@500;600;700;800;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        <DemoModeProvider>
          <ThemeProvider>
            <Shell>{children}</Shell>
            <DemoModal />
          </ThemeProvider>
        </DemoModeProvider>
      </body>
    </html>
  );
}
