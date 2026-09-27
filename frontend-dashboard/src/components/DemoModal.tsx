"use client";

import React, { useEffect, useState, useRef } from "react";
import { createPortal } from "react-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";
import demoConfig from "@/config/demoText.json";

type DemoKey = keyof typeof demoConfig;

export default function DemoModal() {
  const { activeDemoId, setActiveDemoId, demoVoice } = useDemoMode();
  
  // Karaoke State
  const [activeBlock, setActiveBlock] = useState<number | null>(null); // -1 = Title, 0+ = Paragraphs
  const [wordIndex, setWordIndex] = useState(0);
  const [wordLen, setWordLen] = useState(0);
  const cancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveDemoId(null);
    };
    if (activeDemoId) window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [activeDemoId, setActiveDemoId]);

  useEffect(() => {
    if (!activeDemoId || typeof window === 'undefined') return;
    
    const content = demoConfig[activeDemoId as DemoKey];
    if (!content) return;
    const paragraphs = content.text.split("\n\n");
    let isCancelled = false;

    cancelRef.current = () => {
      isCancelled = true;
      window.speechSynthesis.cancel();
      setActiveBlock(null);
    };

    const startSpeech = async () => {
      window.speechSynthesis.cancel(); // clear queue

      // Load voices (Chrome loads them async)
      let voices = window.speechSynthesis.getVoices();
      if (voices.length === 0) {
        await new Promise<void>(resolve => {
          const handler = () => {
            voices = window.speechSynthesis.getVoices();
            window.speechSynthesis.removeEventListener('voiceschanged', handler);
            resolve();
          };
          window.speechSynthesis.addEventListener('voiceschanged', handler);
        });
      }

      // Pick the best natural English voice available based on user setting
      let voice;
      if (demoVoice === 'female') {
        voice = voices.find(v => 
          v.name.includes("Aria") || 
          v.name.includes("Jenny") || 
          v.name.includes("Google UK English Female") || 
          v.name.includes("Zira") || 
          v.name.includes("Samantha") || 
          (v.lang.startsWith("en-") && v.name.includes("Female") && v.name.includes("Natural"))
        ) || voices.find(v => v.lang.startsWith("en-") && (v.name.includes("Female") || v.name.includes("female")));
      } else {
        voice = voices.find(v => 
          v.name.includes("Guy") || 
          v.name.includes("Mark") || 
          v.name.includes("Google UK English Male") || 
          v.name.includes("David") || 
          v.name.includes("Daniel") || 
          (v.lang.startsWith("en-") && v.name.includes("Male") && v.name.includes("Natural"))
        ) || voices.find(v => v.lang.startsWith("en-") && (v.name.includes("Male") || v.name.includes("male")));
      }
      // Ultimate fallback if nothing matched the gender
      if (!voice) voice = voices.find(v => v.lang.startsWith("en-")) || voices[0];

      const speak = (text: string, blockIdx: number) => new Promise<void>(resolve => {
        if (isCancelled) return resolve();
        
        const utterance = new SpeechSynthesisUtterance(text);
        if (voice) utterance.voice = voice;
        utterance.rate = 0.95; 
        utterance.pitch = 1.0;

        utterance.onstart = () => {
          if (isCancelled) {
            window.speechSynthesis.cancel();
            return resolve();
          }
          setActiveBlock(blockIdx);
          setWordIndex(0);
          setWordLen(0);
        };

        utterance.onboundary = (e) => {
          if (e.name === 'word') {
            setWordIndex(e.charIndex);
            setWordLen(e.charLength);
          }
        };

        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();

        window.speechSynthesis.speak(utterance);
      });

      await new Promise(r => setTimeout(r, 400));
      
      if (!isCancelled) await speak(content.title, -1);
      for (let i = 0; i < paragraphs.length; i++) {
        if (!isCancelled) await speak(paragraphs[i], i);
      }
      
      if (!isCancelled) setActiveBlock(null);
    };

    startSpeech();

    return () => {
      if (cancelRef.current) cancelRef.current();
    };
  }, [activeDemoId, demoVoice]);

  if (!activeDemoId || typeof document === "undefined") return null;
  const content = demoConfig[activeDemoId as DemoKey] as { 
    layout: 'fullscreen' | 'copilot', 
    title: string, 
    text: string 
  };
  if (!content) return null;

  const isFullscreen = content.layout === 'fullscreen';
  const paragraphs = content.text.split("\n\n");
  const isTitleActive = activeBlock === -1;
  
  // Title slice calculation
  const tBefore = isTitleActive ? content.title.slice(0, wordIndex) : content.title;
  const tHigh = isTitleActive ? content.title.slice(wordIndex, wordIndex + wordLen) : '';
  const tAfter = isTitleActive ? content.title.slice(wordIndex + wordLen) : '';

  // Audio Wave Component (used in both layouts)
  const AudioWave = () => (
    <div style={{ display: "flex", gap: "2.5px", alignItems: "flex-end", height: isFullscreen ? "10px" : "12px", opacity: activeBlock !== null ? 1 : 0.4 }}>
      <span style={{ width: "3px", background: "#f59e0b", animation: activeBlock !== null ? "wave 1s infinite ease-in-out" : "none", height: activeBlock !== null ? "100%" : "3px", borderRadius: "2px" }} />
      <span style={{ width: "3px", background: "#f59e0b", animation: activeBlock !== null ? "wave 1.2s infinite ease-in-out 0.2s" : "none", height: activeBlock !== null ? "60%" : "3px", borderRadius: "2px" }} />
      <span style={{ width: "3px", background: "#f59e0b", animation: activeBlock !== null ? "wave 0.8s infinite ease-in-out 0.4s" : "none", height: activeBlock !== null ? "80%" : "3px", borderRadius: "2px" }} />
    </div>
  );

  return createPortal(
    <div
      onClick={() => isFullscreen && setActiveDemoId(null)}
      style={
        isFullscreen 
          ? {
              // FULLSCREEN LAYOUT (Blocks clicks, dims background)
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              background: "rgba(8, 8, 10, 0.92)",
              backdropFilter: "blur(8px) saturate(0.5)",
              animation: "overlayIn 0.4s ease forwards",
            }
          : {
              // COPILOT LAYOUT (Transparent wrapper, allows clicks on app)
              position: "fixed",
              inset: 0,
              zIndex: 99999,
              pointerEvents: "none", // Critical: lets you click the app behind it
              display: "flex",
              alignItems: "flex-end",
              justifyContent: "flex-end",
              padding: "2rem",
            }
      }
    >
      {/* ── FULLSCREEN CORNER BADGE ── */}
      {isFullscreen && (
        <div style={{
          position: "absolute",
          top: "2rem",
          left: "2.2rem",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          pointerEvents: "none",
          animation: "itemFadeUp 0.5s ease 0.1s both",
        }}>
          <AudioWave />
          <span style={{
            fontFamily: "monospace",
            fontSize: "9.5px",
            fontWeight: 700,
            letterSpacing: "0.28em",
            color: "rgba(251,191,36,0.6)",
            textTransform: "uppercase",
          }}>
            {activeBlock !== null ? "AI Auto-Presenter Active" : "Presenter Note"}
          </span>
        </div>
      )}

      {/* ── MAIN CONTENT CONTAINER ── */}
      <div
        onClick={(e) => {
          e.stopPropagation();
          // In copilot mode, clicking the card doesn't dismiss it unless they click the X
        }}
        style={
          isFullscreen 
            ? {
                position: "relative",
                zIndex: 10,
                maxWidth: "780px",
                width: "100%",
                padding: "0 2.5rem",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                cursor: "default",
              }
            : {
                // COPILOT CARD STYLING
                position: "relative",
                zIndex: 10,
                width: "440px",
                background: "rgba(14, 18, 28, 0.88)",
                backdropFilter: "blur(24px) saturate(1.2)",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                boxShadow: "0 20px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03) inset",
                borderRadius: "20px",
                padding: "1.75rem",
                display: "flex",
                flexDirection: "column",
                cursor: "default",
                pointerEvents: "auto", // Makes the card itself clickable
                animation: "slideInRight 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards",
              }
        }
      >
        
        {/* COPILOT HEADER (Only in Copilot Mode) */}
        {!isFullscreen && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <AudioWave />
              <span style={{ fontFamily: "monospace", fontSize: "10px", fontWeight: 700, letterSpacing: "0.2em", color: "#fbbf24", textTransform: "uppercase" }}>
                AI Presenter
              </span>
            </div>
            <button 
              onClick={() => setActiveDemoId(null)}
              style={{ background: 'transparent', border: 'none', color: '#90999E', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
              onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
              onMouseOut={(e) => e.currentTarget.style.color = '#90999E'}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        )}

        {/* Title */}
        <h2 style={{
          fontFamily: "var(--font-montserrat, sans-serif)",
          fontWeight: 900,
          fontSize: isFullscreen ? "clamp(2.4rem, 5vw, 3.8rem)" : "1.4rem",
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
          color: isTitleActive ? "#FFFFFF" : "rgba(255,255,255,0.7)",
          textShadow: isTitleActive ? "0 0 40px rgba(255,255,255,0.2)" : "none",
          margin: isFullscreen ? "0 0 1.4rem 0" : "0 0 1rem 0",
          textAlign: isFullscreen ? "center" : "left",
          animation: isFullscreen ? "itemFadeUp 0.65s cubic-bezier(0.16,1,0.3,1) 0.1s both" : "none",
          transition: "color 0.4s ease, text-shadow 0.4s ease",
        }}>
          {tBefore}
          {tHigh && <span style={{ color: '#fbbf24', textShadow: '0 0 16px rgba(251,191,36,0.9)', transition: 'color 0.1s' }}>{tHigh}</span>}
          {tAfter}
        </h2>

        {/* Amber divider */}
        <div style={{
          width: isFullscreen ? "44px" : "100%",
          height: "1.5px",
          borderRadius: "2px",
          background: isFullscreen 
            ? "linear-gradient(90deg, transparent, rgba(245,158,11,0.8), transparent)"
            : "linear-gradient(90deg, rgba(245,158,11,0.6), transparent)",
          marginBottom: isFullscreen ? "2.2rem" : "1.25rem",
          animation: isFullscreen ? "dividerIn 0.5s ease 0.5s both" : "none",
        }} />

        {/* Paragraphs */}
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          gap: isFullscreen ? "1.5rem" : "1rem", 
          width: "100%",
          textAlign: isFullscreen ? "center" : "left" 
        }}>
          {paragraphs.map((para, i) => {
            const isActive = activeBlock === i;
            const pBefore = isActive ? para.slice(0, wordIndex) : para;
            const pHigh = isActive ? para.slice(wordIndex, wordIndex + wordLen) : '';
            const pAfter = isActive ? para.slice(wordIndex + wordLen) : '';
            const isDimmed = activeBlock !== null && activeBlock !== i && activeBlock !== -1;

            return (
              <p
                key={i}
                style={{
                  fontFamily: "var(--font-nunito, sans-serif)",
                  fontWeight: i === 0 ? 700 : 500,
                  fontSize: isFullscreen ? "clamp(1.05rem, 1.9vw, 1.35rem)" : "0.95rem",
                  lineHeight: isFullscreen ? 1.85 : 1.6,
                  letterSpacing: "0.01em",
                  margin: 0,
                  color: isDimmed ? "rgba(120, 125, 140, 0.4)" : (i === 0 ? "rgba(255, 255, 255, 0.97)" : "rgba(210, 215, 230, 0.87)"),
                  textShadow: isDimmed ? "none" : (isFullscreen ? "0 1px 12px rgba(0,0,0,0.9)" : "none"),
                  transition: "all 0.4s ease",
                  animation: isFullscreen ? `itemFadeUp 0.7s cubic-bezier(0.16,1,0.3,1) ${0.65 + i * 0.22}s both` : "none",
                }}
              >
                {pBefore}
                {pHigh && (
                  <span style={{ 
                    color: '#fbbf24', 
                    fontWeight: 800,
                    textShadow: '0 0 12px rgba(251,191,36,0.8)',
                    transition: 'all 0.1s ease'
                  }}>
                    {pHigh}
                  </span>
                )}
                {pAfter}
              </p>
            );
          })}
        </div>

        {/* Dismiss hint (Only in Fullscreen) */}
        {isFullscreen && (
          <p
            onClick={() => setActiveDemoId(null)}
            style={{
              marginTop: "3rem",
              fontFamily: "monospace",
              fontSize: "9px",
              fontWeight: 700,
              letterSpacing: "0.25em",
              color: "rgba(100,100,110,0.45)",
              textTransform: "uppercase",
              cursor: "pointer",
              pointerEvents: "auto",
              animation: `itemFadeUp 0.6s ease ${0.65 + paragraphs.length * 0.22 + 0.2}s both`,
            }}
          >
            {activeBlock !== null ? "Tap anywhere to stop AI & dismiss" : "Tap anywhere to dismiss"}
          </p>
        )}
      </div>

      <style>{`
        @keyframes overlayIn {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
        @keyframes itemFadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(40px) scale(0.98); }
          to { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes dividerIn {
          from { opacity: 0; transform: scaleX(0); }
          to   { opacity: 1; transform: scaleX(1); }
        }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.4); opacity: 0.6; }
          50% { transform: scaleY(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
