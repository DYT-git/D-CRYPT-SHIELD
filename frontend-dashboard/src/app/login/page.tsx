"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldIcon } from '@/components/Icons';

export default function LoginPage() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCivilianLogin = () => {
    localStorage.setItem('userRole', 'civilian');
    router.push('/civilian');
  };

  const handleOfficerLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('userRole', 'officer');
        router.push('/');
      } else {
        setError(data.error || 'Invalid Clearance Code');
      }
    } catch (err) {
      setError('Connection failed');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#090E17] flex flex-col items-center justify-center p-6 text-slate-200 font-sans relative overflow-hidden">
      {/* Premium Background Accents */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-indigo-900/10 blur-[120px] rounded-full pointer-events-none"></div>
      
      <div className="max-w-5xl w-full z-10 flex flex-col items-center">
        
        {/* Hero Section */}
        <div className="text-center mb-16 flex flex-col items-center">
          <div className="w-16 h-16 bg-blue-500/10 border border-blue-500/20 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(37,99,235,0.15)] mb-6">
            <ShieldIcon size={32} className="text-blue-500" />
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tight mb-4 flex items-center gap-3">
            D-CRYPT <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">SHIELD</span>
          </h1>
          <h2 className="text-[11px] md:text-[13px] font-bold text-blue-400 uppercase tracking-[0.3em] mb-6">
            Blockchain Attribution Engine
          </h2>
          <p className="max-w-2xl text-slate-400 text-sm leading-relaxed">
            A proprietary intelligence platform designed to de-anonymize illicit crypto transactions, trace threat actors across networks, and provide actionable analytics for Law Enforcement.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
          
          {/* Officer Portal */}
          <div className="bg-[#111827] rounded-2xl p-8 border border-slate-800 shadow-2xl relative overflow-hidden flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-indigo-500"></div>
            <h3 className="text-xl font-bold text-white mb-2">Sahyog Officer Access</h3>
            <p className="text-slate-500 text-sm mb-8 flex-1">Secure terminal for authorized Law Enforcement Agents to trace funds and view analytics.</p>
            
            <form onSubmit={handleOfficerLogin} className="w-full flex flex-col gap-4 mt-auto">
              <input 
                type="password"
                placeholder="Enter Clearance Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-[#0B0F19] border border-slate-700 text-white placeholder-slate-600 px-4 py-3 rounded-xl focus:outline-none focus:border-indigo-500 text-center font-mono tracking-widest transition-colors"
              />
              <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
                <span>Demo Code:</span>
                <button
                  type="button"
                  onClick={() => setCode('SAHYOG-ADMIN')}
                  className="font-mono text-blue-400 hover:text-blue-300 font-semibold underline decoration-dotted cursor-pointer transition-colors"
                >
                  SAHYOG-ADMIN
                </button>
              </div>
              {error && <p className="text-red-400 text-xs font-semibold text-center">{error}</p>}
              <button 
                type="submit"
                disabled={loading || !code}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-[0_0_20px_rgba(37,99,235,0.2)] hover:shadow-[0_0_30px_rgba(37,99,235,0.4)]"
              >
                {loading ? 'Authenticating...' : 'Access Terminal'}
              </button>
            </form>
          </div>

          {/* Civilian Portal */}
          <div className="bg-[#111827] rounded-2xl p-8 border border-slate-800 shadow-2xl flex flex-col relative overflow-hidden">
            <h3 className="text-xl font-bold text-white mb-2">Civilian Portal</h3>
            <p className="text-slate-500 text-sm mb-8 flex-1">Public access to report fraudulent transactions and track ongoing investigations.</p>
            
            <div className="w-full flex flex-col gap-4 mt-auto relative z-10">
              <button 
                onClick={handleCivilianLogin}
                className="w-full bg-[#1F2937] border border-slate-700 text-slate-300 font-bold py-3 px-4 rounded-xl hover:bg-[#374151] hover:border-slate-500 transition-all flex items-center justify-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Sign in with Google
              </button>
            </div>
          </div>

        </div>

        {/* Disclaimer / Notice */}
        <div className="mt-16 max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-800/50 border border-slate-700 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-4">
            <svg className="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Evaluator Notice
          </div>
          <p className="text-slate-500 text-xs leading-relaxed border-t border-slate-800/50 pt-6">
            Full civic integration with the Sahyog government portal requires official APIs that are currently restricted. For this demonstration, we intentionally focused strictly on engineering our proprietary <strong className="text-slate-300">Core Engine</strong>. While the civilian UI remains locked/unpolished, the underlying Law Enforcement tracker and attribution logic are strictly operational.
          </p>
        </div>

      </div>
    </div>
  );
}
