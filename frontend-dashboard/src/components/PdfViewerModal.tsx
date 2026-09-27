"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import {
  FileTextIcon, DownloadIcon, PrinterIcon, XIcon,
  ShieldIcon, RefreshIcon, AlertCircleIcon, ExternalIcon, CheckCircleIcon,
  CopyIcon, Maximize2Icon, Minimize2Icon,
} from "@/components/Icons";

interface PdfViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  statuteBadge: string;
  pdfUrl: string;
  fileName: string;
  caseId: string;
}

export default function PdfViewerModal({
  isOpen,
  onClose,
  title,
  statuteBadge,
  pdfUrl,
  fileName,
  caseId,
}: PdfViewerModalProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [canonicalHash, setCanonicalHash] = useState<string | null>(null);
  const [docHash, setDocHash] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (!isOpen || !pdfUrl) return;

    let active = true;
    setLoading(true);
    setError(null);
    setBlobUrl(null);
    setCopiedHash(false);

    fetch(pdfUrl)
      .then(async (res) => {
        if (!res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errJson = await res.json();
            throw new Error(errJson.message || errJson.error || `HTTP ${res.status}`);
          }
          throw new Error(`Failed to load document (Status ${res.status})`);
        }
        
        // Extract cryptographic evidence headers
        const cHash = res.headers.get("x-evidence-canonical-sha256");
        const dHash = res.headers.get("x-evidence-document-sha256");
        if (active) {
          if (cHash) setCanonicalHash(cHash);
          if (dHash) setDocHash(dHash);
        }

        return res.blob();
      })
      .then((blob) => {
        if (!active) return;
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Failed to generate judicial PDF");
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen, pdfUrl]);

  // Clean up blob URL on close
  useEffect(() => {
    return () => {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [blobUrl]);

  // Handle ESC key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        if (isFullscreen) {
          setIsFullscreen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, isFullscreen, onClose]);

  if (!isOpen || typeof document === "undefined") return null;

  const handleDownload = () => {
    if (!blobUrl) return;
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      try {
        iframeRef.current.contentWindow.print();
      } catch (e) {
        if (blobUrl) {
          const win = window.open(blobUrl, "_blank");
          win?.focus();
          win?.print();
        }
      }
    }
  };

  const handleCopyHash = () => {
    const hash = canonicalHash || docHash;
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 md:p-7 animate-fade-in">
      {/* Transparent backdrop: reveals the case behind cleanly without blur */}
      <div
        className="fixed inset-0 bg-black/40 transition-opacity cursor-pointer"
        onClick={onClose}
      />

      {/* Middle-aligned Pop-Up Container */}
      <div
        className={`relative w-full ${
          isFullscreen ? "max-w-[98vw] h-[96vh]" : "max-w-5xl h-[88vh]"
        } bg-white rounded-2xl shadow-2xl border border-[#D2D6E4] flex flex-col overflow-hidden z-10 transition-all duration-200`}
      >
        {/* Fixed Top Header & Controls */}
        <div className="px-5 py-3 border-b border-[#E2E8F0] bg-[#F8FAFC] flex flex-col gap-2.5 shrink-0">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Title & Badges */}
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center shrink-0">
                <FileTextIcon size={16} className="text-[#3770FF]" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-bold text-[#13123A] truncate font-heading">{title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono border ${
                    statuteBadge.includes("102") || statuteBadge.includes("106")
                      ? "bg-red-50 text-red-700 border-red-200"
                      : "bg-blue-50 text-[#3770FF] border-blue-200"
                  }`}>
                    {statuteBadge}
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-300 font-mono">
                    {caseId}
                  </span>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={onClose}
                title="Close viewer (Esc)"
                className="p-1.5 rounded-xl hover:bg-slate-200/80 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <XIcon size={18} />
              </button>
            </div>
          </div>

          {/* Sub Control Bar: SHA-256 Seal Chip + Action Controls */}
          <div className="flex items-center justify-between gap-3 flex-wrap pt-2 border-t border-slate-200/60 text-xs">
            {/* SHA-256 Interactive Seal Chip */}
            <div className="flex items-center gap-2 min-w-0">
              {canonicalHash ? (
                <button
                  onClick={handleCopyHash}
                  title="Click to copy full 64-character SHA-256 evidence seal"
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-2xs font-mono text-[11px] cursor-pointer"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${copiedHash ? "bg-green-500" : "bg-emerald-500 animate-pulse"}`} />
                  <span className="font-semibold">{copiedHash ? "SHA-256 Copied!" : "SHA-256:"}</span>
                  <span className="text-slate-600 font-normal">
                    {copiedHash ? "" : `${canonicalHash.slice(0, 8)}…${canonicalHash.slice(-8)}`}
                  </span>
                  {copiedHash ? (
                    <CheckCircleIcon size={12} className="text-green-600 ml-0.5" />
                  ) : (
                    <CopyIcon size={11} className="text-slate-400 ml-0.5" />
                  )}
                </button>
              ) : (
                <span className="text-[11px] text-slate-500 flex items-center gap-1">
                  <ShieldIcon size={12} className="text-slate-400" />
                  <span>NIST FIPS 180-4 Seal</span>
                </span>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Fullscreen / Theater Toggle */}
              <button
                onClick={() => setIsFullscreen((prev) => !prev)}
                title={isFullscreen ? "Restore standard popup view" : "Expand to fullscreen view"}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs cursor-pointer"
              >
                {isFullscreen ? (
                  <>
                    <Minimize2Icon size={13} />
                    <span className="hidden sm:inline">Restore</span>
                  </>
                ) : (
                  <>
                    <Maximize2Icon size={13} />
                    <span className="hidden sm:inline">Maximize</span>
                  </>
                )}
              </button>

              {/* Direct Print */}
              <button
                onClick={handlePrint}
                disabled={loading || !!error}
                title="Print Certified Document"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <PrinterIcon size={13} />
                <span className="hidden sm:inline">Print</span>
              </button>

              {/* Download PDF */}
              <button
                onClick={handleDownload}
                disabled={loading || !!error}
                title="Download Certified PDF"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#3770FF] hover:bg-[#2368FB] text-white text-xs font-bold transition-all shadow-2xs disabled:opacity-50 cursor-pointer"
              >
                <DownloadIcon size={13} />
                <span>Download</span>
              </button>

              {/* External Tab Popout */}
              {blobUrl && (
                <a
                  href={blobUrl}
                  target="_blank"
                  rel="noreferrer"
                  title="Open PDF in independent browser tab"
                  className="p-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 transition-colors"
                >
                  <ExternalIcon size={14} />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Pop-up Body: Embedded PDF Stream with native scroll & controls */}
        <div className="flex-1 bg-[#4A5568]/10 relative overflow-hidden flex items-center justify-center">
          {loading && (
            <div className="flex flex-col items-center gap-3 p-6 text-center animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-white/90 border border-slate-200 flex items-center justify-center shadow-lg">
                <RefreshIcon size={22} className="text-[#3770FF] animate-spin" />
              </div>
              <p className="text-sm font-bold text-[#13123A]">Compiling Certified Exhibit…</p>
              <p className="text-xs text-slate-500 max-w-xs">
                Generating Section 65B compliance verification seals and audit trail ledger.
              </p>
            </div>
          )}

          {error && (
            <div className="max-w-md p-6 bg-white rounded-2xl border border-red-200 shadow-xl text-center m-4 animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-200 text-red-600 flex items-center justify-center mx-auto mb-3">
                <AlertCircleIcon size={22} />
              </div>
              <h4 className="text-base font-bold text-[#13123A] mb-1">Document Unavailable</h4>
              <p className="text-xs text-slate-600 leading-relaxed mb-4">{error}</p>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                Close Viewer
              </button>
            </div>
          )}

          {!loading && !error && blobUrl && (
            <iframe
              ref={iframeRef}
              src={`${blobUrl}#toolbar=1&navpanes=0`}
              title={title}
              className="w-full h-full border-0 bg-white block"
            />
          )}
        </div>

        {/* Fixed Footer Bar */}
        <div className="px-5 py-2.5 border-t border-[#E2E8F0] bg-white flex items-center justify-between text-[11px] text-slate-500 shrink-0 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <ShieldIcon size={13} className="text-emerald-600" />
            <span className="font-semibold text-slate-700">Sec 65B IEA / 63 BSA Certified</span>
            <span className="text-slate-300 hidden sm:inline">|</span>
            <span className="hidden sm:inline">Tamper-Evident SHA-256 Checksum</span>
          </div>
          <div className="flex items-center gap-3 text-[10px]">
            <span className="text-slate-400">
              Press <kbd className="px-1.5 py-0.5 rounded bg-slate-100 border border-slate-300 font-mono text-slate-600">Esc</kbd> to close
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
