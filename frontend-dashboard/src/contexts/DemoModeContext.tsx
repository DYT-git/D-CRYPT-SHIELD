"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

interface DemoModeContextType {
  isDemoMode: boolean;
  setIsDemoMode: (val: boolean) => void;
  activeDemoId: string | null;
  setActiveDemoId: (id: string | null) => void;
  demoVoice: 'male' | 'female';
  setDemoVoice: (val: 'male' | 'female') => void;
}

const DemoModeContext = createContext<DemoModeContextType>({
  isDemoMode: false,
  setIsDemoMode: () => {},
  activeDemoId: null,
  setActiveDemoId: () => {},
  demoVoice: 'male',
  setDemoVoice: () => {},
});

export const useDemoMode = () => useContext(DemoModeContext);

export const DemoModeProvider = ({ children }: { children: React.ReactNode }) => {
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [activeDemoId, setActiveDemoId] = useState<string | null>(null);
  const [demoVoice, setDemoVoice] = useState<'male' | 'female'>('male');

  // Load state from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem("dcrypt_demo_mode");
    if (savedMode === "true") setIsDemoMode(true);
    
    const savedVoice = localStorage.getItem("dcrypt_demo_voice");
    if (savedVoice === "female") setDemoVoice('female');
  }, []);

  // Save state on change
  const handleSetDemoMode = (val: boolean) => {
    setIsDemoMode(val);
    localStorage.setItem("dcrypt_demo_mode", val ? "true" : "false");
  };

  const handleSetDemoVoice = (val: 'male' | 'female') => {
    setDemoVoice(val);
    localStorage.setItem("dcrypt_demo_voice", val);
  };

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        setIsDemoMode: handleSetDemoMode,
        activeDemoId,
        setActiveDemoId,
        demoVoice,
        setDemoVoice: handleSetDemoVoice,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
};
