'use client';
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, Legend, ReferenceLine,
} from 'recharts';

interface TraceHop {
  hop_number: number;
  from_address: string;
  to_address: string;
  tx_hash: string;
  amount: number;
  token_symbol: string;
  timestamp?: string;
  entity_name?: string;
  is_vasp?: boolean;
}

interface FlowChartProps {
  path: TraceHop[];
  suspectAddress: string;
  tokenSymbol?: string;
}

// ─── Custom Tooltip ───────────────────────────────────────────
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null;
  const hop = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-xl p-3 shadow-2xl text-xs max-w-[280px]">
      <p className="font-bold text-white mb-2">{label}</p>
      {hop?.from && (
        <p className="text-slate-400 mb-0.5">
          <span className="text-slate-500">From: </span>
          <span className="font-mono text-slate-300">{hop.from}</span>
        </p>
      )}
      {hop?.to && (
        <p className="text-slate-400 mb-0.5">
          <span className="text-slate-500">To: </span>
          <span className="font-mono text-slate-300">{hop.to}</span>
        </p>
      )}
      <p className="text-emerald-400 font-bold mt-1.5">
        {hop?.amount?.toFixed(6)} {hop?.symbol}
      </p>
      {hop?.entity && (
        <p className="mt-1 text-sky-400 font-semibold">
          🏦 {hop.entity}
        </p>
      )}
      {hop?.txHash && (
        <p className="mt-1 text-slate-500 font-mono text-[10px] truncate">
          Tx: {hop.txHash.slice(0, 14)}…
        </p>
      )}
      {hop?.timestamp && (
        <p className="text-slate-500 text-[10px] mt-0.5">{hop.timestamp}</p>
      )}
    </div>
  );
};

// ─── Value continuity line ────────────────────────────────────
const ContinuityBar = ({ path }: { path: TraceHop[] }) => {
  if (path.length < 2) return null;
  const first = path[0]?.amount || 1;
  return (
    <div className="mt-4 px-2">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
        Value Continuity — funds retained hop-by-hop
      </p>
      <div className="flex items-center gap-0">
        {path.map((hop, i) => {
          const pct = Math.min(100, (hop.amount / first) * 100);
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div
                className="w-full rounded-sm transition-all duration-500"
                style={{
                  height: `${Math.max(4, pct * 0.4)}px`,
                  background: hop.is_vasp
                    ? '#0ea5e9'
                    : `rgba(34, 197, 94, ${0.3 + pct / 150})`,
                  border: hop.is_vasp ? '1px solid #38bdf8' : 'none',
                }}
              />
              <span className="text-[9px] text-slate-600 mt-0.5">{Math.round(pct)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────
export default function FlowChart({ path, suspectAddress, tokenSymbol = 'ETH' }: FlowChartProps) {
  const chartData = useMemo(() => {
    return path.map((hop, i) => {
      const shortFrom = hop.from_address
        ? `${hop.from_address.slice(0, 5)}…${hop.from_address.slice(-3)}`
        : '?';
      const shortTo = hop.to_address
        ? `${hop.to_address.slice(0, 5)}…${hop.to_address.slice(-3)}`
        : '?';

      return {
        name: `Hop ${hop.hop_number ?? i + 1}`,
        amount: parseFloat(hop.amount?.toFixed(6) || '0'),
        from: shortFrom,
        to: shortTo,
        symbol: hop.token_symbol || tokenSymbol,
        entity: hop.entity_name || null,
        isVasp: hop.is_vasp || false,
        txHash: hop.tx_hash,
        timestamp: hop.timestamp
          ? new Date(hop.timestamp).toLocaleDateString('en-IN', {
              day: '2-digit', month: 'short', year: 'numeric',
            })
          : null,
      };
    });
  }, [path, tokenSymbol]);

  // Max amount for Y-axis reference
  const maxAmount = Math.max(...chartData.map(d => d.amount), 0.0001);

  if (path.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center gap-3 p-6">
        <div className="w-12 h-12 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">No trace path data available</p>
        <p className="text-xs text-slate-400">Run a trace first to see fund flow chart</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full p-4 gap-4">
      {/* Legend */}
      <div className="flex items-center gap-5 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span className="text-slate-500 font-medium">Fund transferred</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm bg-sky-500" />
          <span className="text-slate-500 font-medium">VASP / Exchange identified</span>
        </div>
        <div className="ml-auto text-slate-400 font-mono text-[10px]">
          Origin: {suspectAddress.slice(0, 8)}…{suspectAddress.slice(-6)}
        </div>
      </div>

      {/* Bar Chart */}
      <div className="flex-1" style={{ minHeight: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 8, right: 16, left: 0, bottom: 8 }}
            barCategoryGap="30%"
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#1e293b"
              vertical={false}
            />
            <XAxis
              dataKey="name"
              tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748b', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => v.toFixed(3)}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
            <ReferenceLine
              y={maxAmount}
              stroke="#334155"
              strokeDasharray="4 4"
              label={{ value: 'Origin amount', fill: '#475569', fontSize: 10, position: 'insideTopRight' }}
            />
            <Bar dataKey="amount" radius={[4, 4, 0, 0]} maxBarSize={56}>
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.isVasp ? '#0ea5e9' : '#22c55e'}
                  fillOpacity={entry.isVasp ? 1 : 0.8}
                  stroke={entry.isVasp ? '#38bdf8' : '#16a34a'}
                  strokeWidth={entry.isVasp ? 2 : 0}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Value continuity tracker */}
      <ContinuityBar path={path} />

      {/* Hop Summary Row */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
        {chartData.map((hop, i) => (
          <div
            key={i}
            className={`shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-xl border text-center text-[10px] min-w-[80px]
              ${hop.isVasp
                ? 'bg-sky-50 border-sky-200'
                : 'bg-slate-50 border-slate-200'
              }`}
          >
            <span className={`font-bold text-[11px] ${hop.isVasp ? 'text-sky-700' : 'text-slate-700'}`}>
              {hop.name}
            </span>
            <span className={`font-mono font-bold ${hop.isVasp ? 'text-sky-600' : 'text-emerald-600'}`}>
              {hop.amount.toFixed(4)}
            </span>
            <span className="text-slate-400">{hop.symbol}</span>
            {hop.entity && (
              <span className="text-sky-600 font-bold text-[9px] mt-0.5 truncate max-w-full">
                🏦 {hop.entity}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
