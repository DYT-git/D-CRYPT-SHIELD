'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3-force';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

interface GraphNode {
  id: string;
  label: string;
  val: number;
  color: string;
  borderColor: string;
  type: 'suspect' | 'vasp' | 'hub' | 'intermediary';
  x?: number;
  y?: number;
}

interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
  amount: number;
  token: string;
  tx: string;
}

interface TransactionGraphProps {
  caseId: string;
  suspectAddress: string;
  liveData?: { nodes: any[]; links: any[] } | null;
}

const NODE_COLORS: Record<string, { fill: string; stroke: string; glow: string }> = {
  suspect:      { fill: '#ff3333', stroke: '#ff6666', glow: 'rgba(255,51,51,0.35)' },
  vasp:         { fill: '#00e5ff', stroke: '#80f4ff', glow: 'rgba(0,229,255,0.35)' },
  hub:          { fill: '#ff9900', stroke: '#ffcc44', glow: 'rgba(255,153,0,0.35)' },
  intermediary: { fill: '#8b949e', stroke: '#aab0b8', glow: 'rgba(139,148,158,0.2)' },
};

const TYPE_LABELS: Record<string, string> = {
  suspect:      'Suspect Origin',
  vasp:         'Exchange / VASP',
  hub:          'High-Volume Hub',
  intermediary: 'Intermediary Hop',
};

export default function TransactionGraph({ caseId, suspectAddress, liveData }: TransactionGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 620 });
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ nodes: 0, edges: 0, vasps: 0, hubs: 0 });
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState(new Set<string>());
  const [highlightLinks, setHighlightLinks] = useState(new Set<string>());
  const [tooltip, setTooltip] = useState<{ x: number; y: number; node: GraphNode } | null>(null);

  // Measure container
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 800,
          height: containerRef.current.clientHeight || 620,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Process and load graph data
  const processGraphData = useCallback((data: any) => {
    if (!data?.nodes?.length) {
      if (!liveData) {
        setError('No graph data yet — run the trace first to populate the Shadow Graph.');
        setLoading(false);
      }
      return;
    }

    const formattedNodes: GraphNode[] = (data.nodes as any[]).map((n) => {
      const addr = (n.address || '').toLowerCase();
      const isSuspect = addr === suspectAddress.toLowerCase();
      const isVasp = !!n.is_vasp;
      const isHub = n.type === 'Hub' || String(n.label).includes('UNKNOWN_HUB');
      const type: GraphNode['type'] = isSuspect
        ? 'suspect'
        : isVasp ? 'vasp'
        : isHub ? 'hub'
        : 'intermediary';

      // Anchor suspect node perfectly in the center to create radial explosion
      let fx = undefined;
      let fy = undefined;
      if (isSuspect) {
        fx = 0;
        fy = 0;
      }

      const shortLabel = isSuspect
        ? 'SUSPECT'
        : isVasp && n.name && n.name !== 'unknown'
        ? n.name
        : `${addr.slice(0, 6)}…${addr.slice(-4)}`;

      return {
        id: addr,
        label: shortLabel,
        val: isSuspect ? 18 : isVasp ? 14 : isHub ? 12 : 8,
        color: NODE_COLORS[type].fill,
        borderColor: NODE_COLORS[type].stroke,
        type,
        fx, fy // Force lock
      };
    });

    const formattedLinks: GraphLink[] = (data.edges as any[]).map((e) => ({
      source: (e.from_address || '').toLowerCase(),
      target: (e.to_address || '').toLowerCase(),
      amount: e.amount || 0,
      token: e.token || 'ETH',
      tx: e.tx_hash || '',
    }));

    setGraphData({ nodes: formattedNodes, links: formattedLinks });
    
    setStats({
      nodes: formattedNodes.length,
      edges: formattedLinks.length,
      vasps: formattedNodes.filter(n => n.type === 'vasp').length,
      hubs: formattedNodes.filter(n => n.type === 'hub').length,
    });
    
    setError(null);
    setLoading(false);

    // Give layout time to settle then zoom to fit radial tree
    setTimeout(() => {
      if (fgRef.current) fgRef.current.zoomToFit(600, 40);
    }, 1500);
  }, [suspectAddress]);

  // Fetch initial graph (if no liveData)
  useEffect(() => {
    if (liveData) return;
    
    const fetchGraph = async () => {
      setLoading(true);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9090';
        const res = await fetch(`${API}/api/v1/graph/case/${caseId}`);
        if (!res.ok) throw new Error(`API ${res.status}`);
        const data = await res.json();
        processGraphData(data);
      } catch (err: any) {
        console.error(err);
        setError('Failed to load trace graph.');
        setLoading(false);
      }
    };
    fetchGraph();
  }, [caseId, liveData, processGraphData]);

  // Update on liveData changes
  useEffect(() => {
    if (liveData) {
      processGraphData(liveData);
    }
  }, [liveData, processGraphData]);

  // Apply forces after load
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      // Increase repulsion and link distance to spread out graph cleanly
      fgRef.current.d3Force('charge').strength(-400);
      fgRef.current.d3Force('link').distance(140);
      fgRef.current.d3Force('collide', d3.forceCollide().radius((d: any) => (d.val ?? 8) + 14)); // Soft collision bounds
      setTimeout(() => fgRef.current?.zoomToFit(800, 60), 1000);
    }
  }, [graphData]);

  // Hover — highlight connected subgraph
  const handleNodeHover = useCallback((node: any) => {
    if (!node) {
      setHoveredNode(null);
      setHighlightNodes(new Set());
      setHighlightLinks(new Set());
      return;
    }
    setHoveredNode(node as GraphNode);
    const connected = new Set<string>([node.id]);
    const connLinks = new Set<string>();
    graphData.links.forEach((l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === node.id || t === node.id) {
        connected.add(s);
        connected.add(t);
        connLinks.add(l.tx);
      }
    });
    setHighlightNodes(connected);
    setHighlightLinks(connLinks);
  }, [graphData.links]);

  const handleNodeClick = useCallback((node: any, evt: MouseEvent) => {
    setSelectedNode((prev) => (prev === node.id ? null : node.id));
    setTooltip({ x: evt.clientX, y: evt.clientY, node: node as GraphNode });
    fgRef.current?.centerAt(node.x, node.y, 800);
    fgRef.current?.zoom(3.5, 800);
  }, []);

  const handleBgClick = useCallback(() => {
    setSelectedNode(null);
    setTooltip(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Custom node renderer
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
    
    const r = (node.val ?? 9) / 2;
    const isHl = highlightNodes.size === 0 || highlightNodes.has(node.id);
    const isSel = selectedNode === node.id;
    const c = NODE_COLORS[node.type as string] || NODE_COLORS.intermediary;

    ctx.globalAlpha = isHl ? 1 : 0.15;

    // Outer glow for primary nodes
    if (isHl && node.type !== 'intermediary') {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(node.x, node.y, r, node.x, node.y, r + 8);
      grd.addColorStop(0, c.glow);
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Fill circle
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = c.fill + '25';
    ctx.fill();

    // Border
    ctx.strokeStyle = isSel ? '#ffffff' : c.stroke;
    ctx.lineWidth = (isSel ? 3 : 1.5) / globalScale;
    ctx.stroke();

    // Inner solid core
    ctx.beginPath();
    ctx.arc(node.x, node.y, r * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = c.fill;
    ctx.fill();

    // Label
    const fs = Math.max(9, 11 / globalScale);
    ctx.font = `${node.type === 'suspect' ? 'bold ' : ''}${fs}px Inter, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isHl ? '#ffffff' : '#6e7681';
    
    // Background pill for label to make it readable
    if (isHl && globalScale > 1.2) {
      const textWidth = ctx.measureText(node.label).width;
      ctx.fillStyle = 'rgba(5,9,15,0.7)';
      ctx.fillRect(node.x - textWidth / 2 - 4, node.y + r + 2 / globalScale, textWidth + 8, fs + 4);
      ctx.fillStyle = '#ffffff';
    }
    
    ctx.fillText(node.label, node.x, node.y + r + 4 / globalScale);

    ctx.globalAlpha = 1;
  }, [highlightNodes, selectedNode]);

  // Custom link renderer
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source;
    const tgt = link.target;
    if (!src?.x || !tgt?.x) return;

    const isHl = highlightLinks.size === 0 || highlightLinks.has(link.tx);
    ctx.globalAlpha = isHl ? 0.75 : 0.1;

    const amount = link.amount || 0;
    const strokeColor =
      amount > 100000 ? '#ff4444' :
      amount > 10000  ? '#ff9900' :
      amount > 1000   ? '#e3b341' :
                        '#444c56';

    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.lineTo(tgt.x, tgt.y);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = (isHl ? 1.8 : 0.8) / globalScale;
    ctx.stroke();

    // Draw amount label on edge if highlighted or sufficiently zoomed in
    if (isHl || globalScale > 1.8) {
      const mx = src.x + (tgt.x - src.x) / 2;
      const my = src.y + (tgt.y - src.y) / 2;
      
      const fSize = Math.max(5, 10 / globalScale);
      ctx.font = `${fSize}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      const label = `${amount.toFixed(2)} ${link.token || ''}`;
      const tw = ctx.measureText(label).width;
      const th = fSize;
      
      ctx.fillStyle = '#010409'; // background pill
      ctx.fillRect(mx - tw/2 - 2, my - th/2 - 2, tw + 4, th + 4);
      
      ctx.fillStyle = strokeColor;
      ctx.fillText(label, mx, my);
    }

    ctx.globalAlpha = 1;
  }, [highlightLinks]);

  const zoomIn  = () => fgRef.current?.zoom((fgRef.current.zoom() || 1) * 1.4, 300);
  const zoomOut = () => fgRef.current?.zoom((fgRef.current.zoom() || 1) * 0.7, 300);
  const fitView = () => fgRef.current?.zoomToFit(500, 60);

  return (
    <div style={{ position: 'relative', width: '100%', height: 620, background: '#010409', borderRadius: 12, overflow: 'hidden', border: '1px solid #21262d', fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Top Header Bar ── */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 18px', background: 'linear-gradient(to bottom, rgba(1,4,9,0.98) 0%, transparent 100%)', pointerEvents: 'none' }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
          <span style={{ color: '#e6edf3', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em' }}>D-CRYPT</span>
          <span style={{ color: '#30363d', fontSize: 11, margin: '0 2px' }}>|</span>
          <span style={{ color: '#484f58', fontSize: 11 }}>Shadow Graph Intelligence</span>
        </div>
        {/* Stats chips */}
        <div style={{ display: 'flex', gap: 14 }}>
          {[{ l: 'Nodes', v: stats.nodes, col: '#8b949e' }, { l: 'Edges', v: stats.edges, col: '#8b949e' }, { l: 'VASPs', v: stats.vasps, col: '#00e5ff' }, { l: 'Hubs', v: stats.hubs, col: '#ff9900' }].map(s => (
            <div key={s.l} style={{ textAlign: 'center' }}>
              <div style={{ color: s.col, fontSize: 15, fontWeight: 700, lineHeight: 1 }}>{s.v}</div>
              <div style={{ color: '#484f58', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Graph Canvas ── */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }}>
        {!loading && !error && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={graphData}
            backgroundColor="#010409"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            linkDirectionalParticles={4}
            linkDirectionalParticleWidth={(l: any) => (highlightLinks.size === 0 || highlightLinks.has(l.tx)) ? 4 : 1.5}
            linkDirectionalParticleColor={() => '#00e5ff'}
            linkDirectionalParticleSpeed={0.008}
            linkDirectionalArrowLength={8}
            linkDirectionalArrowRelPos={1}
            dagMode="radialout"
            dagLevelDistance={180}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x;
              node.fy = node.y;
            }}
            onBackgroundClick={handleBgClick}
            enableNodeDrag={true}
            enableZoomInteraction={true}
            enablePanInteraction={true}
            cooldownTicks={150}
            d3AlphaDecay={0.03}
            d3VelocityDecay={0.2}
          />
        )}

        {/* Loading */}
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: '#010409' }}>
            <div style={{ width: 40, height: 40, border: '2px solid #21262d', borderTop: '2px solid #00e5ff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <span style={{ color: '#484f58', fontSize: 12 }}>Loading Shadow Graph…</span>
          </div>
        )}

        {/* Empty / Error */}
        {!loading && (error || graphData.nodes.length === 0) && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, background: '#010409', padding: 32 }}>
            <div style={{ fontSize: 40 }}>🕸️</div>
            <div style={{ color: '#8b949e', fontSize: 13, textAlign: 'center', maxWidth: 320, lineHeight: 1.7 }}>
              {error || 'No graph data found for this case.'}
            </div>
            <div style={{ color: '#30363d', fontSize: 11 }}>The Shadow Graph auto-populates once a trace completes.</div>
          </div>
        )}
      </div>

      {/* ── Legend — Bottom Left (Clean Floating Panel) ── */}
      <div style={{ position: 'absolute', bottom: 20, left: 20, zIndex: 20, background: 'rgba(5,9,15,0.75)', padding: '16px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)', minWidth: 220, boxShadow: '0 10px 30px rgba(0,0,0,0.4)' }}>
        <div style={{ color: '#6e7681', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Node Types</div>
        {Object.entries(NODE_COLORS).map(([type, c]) => (
          <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: c.fill, boxShadow: `0 0 8px ${c.fill}`, flexShrink: 0 }} />
            <span style={{ color: '#c9d1d9', fontSize: 12, fontWeight: 500 }}>{TYPE_LABELS[type]}</span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 14, paddingTop: 12 }}>
          <div style={{ color: '#6e7681', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 10 }}>Edge Volume Traffic</div>
          {[{ col: '#ff4444', l: 'High Volume (> $100K)' }, { col: '#ff9900', l: 'Medium (> $10K)' }, { col: '#e3b341', l: 'Low (> $1K)' }, { col: '#444c56', l: 'Micro-transactions' }].map(t => (
            <div key={t.l} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{ width: 20, height: 2, background: t.col, borderRadius: 1, flexShrink: 0 }} />
              <span style={{ color: '#8b949e', fontSize: 11 }}>{t.l}</span>
            </div>
          ))}
        </div>
        <div style={{ color: '#484f58', fontSize: 10, marginTop: 12, fontStyle: 'italic' }}>* Directional particles trace flow</div>
      </div>

      {/* ── Zoom Controls — Right Middle (Not overlapping bottom left) ── */}
      <div style={{ position: 'absolute', top: '50%', right: 20, transform: 'translateY(-50%)', zIndex: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[{ icon: '+', fn: zoomIn, tip: 'Zoom In' }, { icon: '−', fn: zoomOut, tip: 'Zoom Out' }, { icon: '⛶', fn: fitView, tip: 'Fit All' }].map(b => (
          <button key={b.icon} onClick={b.fn} title={b.tip}
            style={{ width: 40, height: 40, background: 'rgba(5,9,15,0.8)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#c9d1d9', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)', transition: 'all 0.2s ease', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}
            onMouseEnter={e => { (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
            onMouseLeave={e => { (e.target as HTMLElement).style.background = 'rgba(5,9,15,0.8)'; (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >{b.icon}</button>
        ))}
      </div>

      {/* 🔹 Node Tooltip (Professional Floating Card) 🔹 */}
      {tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 20, top: tooltip.y - 20, zIndex: 9999, background: 'rgba(13,17,23,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '16px', minWidth: 280, pointerEvents: 'none', boxShadow: '0 12px 40px rgba(0,0,0,0.6)', backdropFilter: 'blur(20px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: NODE_COLORS[tooltip.node.type]?.fill, boxShadow: `0 0 8px ${NODE_COLORS[tooltip.node.type]?.fill}`, flexShrink: 0 }} />
            <span style={{ color: '#8b949e', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.12em' }}>{TYPE_LABELS[tooltip.node.type]}</span>
          </div>
          
          <div style={{ color: '#ffffff', fontSize: 15, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.01em' }}>{tooltip.node.label}</div>
          
          <div style={{ color: '#8b949e', fontSize: 11, fontFamily: 'monospace', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', padding: '8px 10px', borderRadius: 8, wordBreak: 'break-all', lineHeight: 1.5, marginBottom: 16 }}>
            {tooltip.node.id}
          </div>
          
          {(() => {
            let inVol = 0, outVol = 0, inUsd = 0, outUsd = 0, token = '';
            graphData.links.forEach((l: any) => {
              const s = typeof l.source === 'object' ? l.source.id : l.source;
              const t = typeof l.target === 'object' ? l.target.id : l.target;
              if (t === tooltip.node.id) {
                inVol += l.amount || 0;
                inUsd += l.value_usd || l.amount || 0;
                if (!token) token = l.token;
              }
              if (s === tooltip.node.id) {
                outVol += l.amount || 0;
                outUsd += l.value_usd || l.amount || 0;
                if (!token) token = l.token;
              }
            });
            const inrRate = 84;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, padding: '12px 0 4px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div>
                  <div style={{ fontSize: 9, color: '#6e7681', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Received</div>
                  <div style={{ color: '#3fb950', fontSize: 13, fontWeight: 700 }}>{inVol > 0 ? `+${inVol.toFixed(3)} ${token}` : '-'}</div>
                  {inUsd > 0 && <div style={{ color: '#8b949e', fontSize: 10, marginTop: 2 }}>${inUsd.toFixed(2)} | ₹{(inUsd * inrRate).toFixed(2)}</div>}
                </div>
                <div>
                  <div style={{ fontSize: 9, color: '#6e7681', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Total Sent</div>
                  <div style={{ color: '#f85149', fontSize: 13, fontWeight: 700 }}>{outVol > 0 ? `-${outVol.toFixed(3)} ${token}` : '-'}</div>
                  {outUsd > 0 && <div style={{ color: '#8b949e', fontSize: 10, marginTop: 2 }}>${outUsd.toFixed(2)} | ₹{(outUsd * inrRate).toFixed(2)}</div>}
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Tip — Top Right */}
      {!loading && !error && graphData.nodes.length > 0 && (
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, background: 'rgba(5,9,15,0.5)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.05)', color: '#8b949e', fontSize: 11, pointerEvents: 'none', backdropFilter: 'blur(4px)' }}>
          Drag nodes to pin · Scroll to zoom · Hover to trace
        </div>
      )}

      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}


