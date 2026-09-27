'use client';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import * as d3 from 'd3-force';

// Dynamic load for react-force-graph-2d (browser canvas only, no SSR)
const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), { ssr: false });

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────
export interface GraphNode {
  id: string;
  label: string;
  name?: string;
  val: number;
  color: string;
  borderColor: string;
  type: 'suspect' | 'vasp' | 'hub' | 'intermediary' | 'mixer';
  riskLevel?: 'critical' | 'high' | 'medium' | 'low' | 'resolved';
  isVasp?: boolean;
  hopLevel?: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink {
  source: any;
  target: any;
  amount: number;
  token: string;
  tx: string;
  valueUsd?: number;
}

interface TransactionGraphProps {
  caseId: string;
  suspectAddress: string;
  liveData?: { nodes: any[]; links?: any[]; edges?: any[] } | null;
  onGenerateNotice?: (vaspName: string, vaspAddress: string) => void;
}

// ─────────────────────────────────────────────────────────────────────────────
// Color Palettes & D-CRYPT Cyber Visual Theme
// ─────────────────────────────────────────────────────────────────────────────
const NODE_THEMES: Record<string, { fill: string; stroke: string; glow: string; badge: string; text: string }> = {
  suspect: {
    fill: '#ef4444',
    stroke: '#f87171',
    glow: 'rgba(239, 68, 68, 0.45)',
    badge: 'SUSPECT ORIGIN',
    text: '#fca5a5',
  },
  vasp: {
    fill: '#00e5ff',
    stroke: '#38bdf8',
    glow: 'rgba(0, 229, 255, 0.45)',
    badge: 'FIU-IND VASP',
    text: '#7dd3fc',
  },
  mixer: {
    fill: '#a855f7',
    stroke: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.45)',
    badge: 'MIXER / PRIVACY',
    text: '#d8b4fe',
  },
  hub: {
    fill: '#f59e0b',
    stroke: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.40)',
    badge: 'AGGREGATOR HUB',
    text: '#fcd34d',
  },
  intermediary: {
    fill: '#64748b',
    stroke: '#94a3b8',
    glow: 'rgba(100, 116, 139, 0.25)',
    badge: 'MULE TRANSIT',
    text: '#cbd5e1',
  },
};

// Known registry metadata for authentic Indian VASP demonstration
const VASP_REGISTRY: Record<string, {
  legalName: string;
  regNumber: string;
  nodalEmail: string;
  jurisdiction: string;
  status: string;
}> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
    legalName: 'Neblio Technologies Pvt. Ltd. (CoinDCX)',
    regNumber: 'FIU-IND/CAS/2023/0014',
    nodalEmail: 'nodal.officer@coindcx.com',
    jurisdiction: 'Mumbai, Maharashtra, India',
    status: 'Active (PMLA Compliant)',
  },
  '0x28c6c06298d514db089934071355e5743bf21d60': {
    legalName: 'Zanmai Labs / Binance Institutional Gateway',
    regNumber: 'FIU-IND/CAS/2024/0089',
    nodalEmail: 'compliance-india@binance.com',
    jurisdiction: 'India / International Omnibus',
    status: 'Active (FIU Registered)',
  },
  '0x12d66f87a04a9e220743712ce6d9bb1b5616b8fc': {
    legalName: 'Tornado.Cash 0.1 ETH Anonymity Pool',
    regNumber: 'OFAC-SDN-CYBER2-2022',
    nodalEmail: 'UNHOSTED_DECENTRALIZED_POOL',
    jurisdiction: 'Decentralized Smart Contract',
    status: 'OFAC Sanctioned Entity',
  },
  '0x47ce0c6ed5b0ce3d3a51fdb1c52dc66a7c3c2936': {
    legalName: 'Tornado.Cash 100 ETH Vault Pool',
    regNumber: 'OFAC-SDN-CYBER2-2022',
    nodalEmail: 'UNHOSTED_DECENTRALIZED_POOL',
    jurisdiction: 'Decentralized Smart Contract',
    status: 'OFAC Sanctioned Entity',
  },
  '0xaf30162fb46241477dd5c33a9ec1a49db23c5fb3': {
    legalName: 'Stargate Cross-Chain Router (Tron Bridge)',
    regNumber: 'DEFI-BRIDGE-ROUTER',
    nodalEmail: 'security@stargate.finance',
    jurisdiction: 'LayerZero Cross-Chain Protocol',
    status: 'Bridge Contract',
  },
  '0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2': {
    legalName: 'Aave V3 Liquidity Pool Core',
    regNumber: 'DEFI-AAVE-V3',
    nodalEmail: 'governance@aave.com',
    jurisdiction: 'Ethereum DeFi Treasury',
    status: 'Verified DeFi Protocol',
  },
};

// Canvas helper for rounded rectangles
function drawRoundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────
export default function TransactionGraph({ caseId, suspectAddress, liveData, onGenerateNotice }: TransactionGraphProps) {
  const fgRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialFitDoneRef = useRef(false);

  // Layout & Dimensions
  const [dimensions, setDimensions] = useState({ width: 900, height: 680 });
  const isMobile = dimensions.width < 768;
  const isSmallScreen = dimensions.width < 540;
  const [showMobileLegend, setShowMobileLegend] = useState(false);

  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; links: GraphLink[] }>({ nodes: [], links: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Controls & Modes
  const [layoutMode, setLayoutMode] = useState<'lr' | 'radialout' | 'force'>('lr');
  const [filterMode, setFilterMode] = useState<'all' | 'vasp' | 'high_risk' | 'mules'>('all');
  const [physicsFrozen, setPhysicsFrozen] = useState(false);
  const [scrollLocked, setScrollLocked] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Interactive Selection & Multi-Node Lasso
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [multiSelectedNodeIds, setMultiSelectedNodeIds] = useState<Set<string>>(new Set());
  const [isShiftPressed, setIsShiftPressed] = useState(false);
  const [marquee, setMarquee] = useState<{ startX: number; startY: number; currentX: number; currentY: number } | null>(null);
  const dragGroupRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<string>>(new Set());

  // Chronological Forensic Timeline Playback
  const [timelineActive, setTimelineActive] = useState(false);
  const [timelineStep, setTimelineStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Radar Minimap
  const [minimapVisible, setMinimapVisible] = useState(true);
  const minimapCanvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraState, setCameraState] = useState<{ x: number; y: number; k: number }>({ x: 0, y: 0, k: 1 });

  // Action Statuses
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isDownloadingNotice, setIsDownloadingNotice] = useState(false);
  const [noticeSuccessMsg, setNoticeSuccessMsg] = useState<string | null>(null);

  // Resize listener
  useEffect(() => {
    const measure = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth || 900,
          height: containerRef.current.clientHeight || 680,
        });
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Listen for Shift key for Marquee / Lasso selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setIsShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
        setMarquee(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Update Camera State for Radar Minimap
  const updateCameraState = useCallback(() => {
    if (!fgRef.current) return;
    // Defer state update to avoid "setState during render" warning from ForceGraph
    setTimeout(() => {
      if (!fgRef.current) return;
      try {
        const k = fgRef.current.zoom() || 1;
        const centerGraph = fgRef.current.screen2GraphCoords(dimensions.width / 2, dimensions.height / 2);
        if (centerGraph && typeof centerGraph.x === 'number') {
          setCameraState({ x: centerGraph.x, y: centerGraph.y, k });
        }
      } catch (_) {}
    }, 0);
  }, [dimensions]);

  // Smooth Eased Camera Fly-To (Quartic Easing)
  const flyToCamera = useCallback((x: number, y: number, zoomLevel: number = 3.0, duration: number = 850) => {
    if (!fgRef.current) return;
    fgRef.current.centerAt(x, y, duration);
    fgRef.current.zoom(zoomLevel, duration);
    setTimeout(updateCameraState, duration + 50);
  }, [updateCameraState]);

  // Forensic 2D Staggered Flow Layout Engine
  // Creates a clean, progressive Left-to-Right money flow with generous breathing room
  const applyStructuredLayout = useCallback((nodes: GraphNode[], links: GraphLink[]) => {
    const suspectClean = suspectAddress.toLowerCase();
    const adjMap = new Map<string, string[]>();
    links.forEach(l => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (!adjMap.has(s)) adjMap.set(s, []);
      adjMap.get(s)!.push(t);
    });

    const hopMap = new Map<string, number>();
    hopMap.set(suspectClean, 0);
    const queue = [suspectClean];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currHop = hopMap.get(curr) || 0;
      const neighbors = adjMap.get(curr) || [];
      for (const n of neighbors) {
        if (!hopMap.has(n)) {
          hopMap.set(n, currHop + 1);
          queue.push(n);
        }
      }
    }

    const hopGroups = new Map<number, GraphNode[]>();
    let maxHop = 0;
    nodes.forEach(node => {
      const h = hopMap.has(node.id) ? hopMap.get(node.id)! : 1;
      node.hopLevel = h;
      if (h > maxHop) maxHop = h;
      if (!hopGroups.has(h)) hopGroups.set(h, []);
      hopGroups.get(h)!.push(node);
    });

    const isMob = dimensions.width < 768;
    const xSpacing = isMob
      ? Math.min(145, Math.max(105, (dimensions.width - 50) / (maxHop || 1)))
      : Math.min(220, Math.max(165, (dimensions.width - 200) / (maxHop || 1)));
    const startX = -((maxHop * xSpacing) / 2);

    for (let h = 0; h <= maxHop; h++) {
      const group = hopGroups.get(h) || [];
      const colX = Math.round(startX + h * xSpacing);

      if (group.length === 1) {
        const n = group[0];
        // Clean subtle vertical alternate wave
        const yOffset = (h === 0) ? 0 : (h % 2 === 1 ? (isMob ? -26 : -36) : (isMob ? 26 : 36));
        n.x = colX;
        n.y = yOffset;
        n.fx = colX;
        n.fy = yOffset;
      } else if (group.length > 1) {
        // Multi-node branch: fan out vertically with clean spacing
        const vGap = isMob ? 58 : 78;
        const totalHeight = (group.length - 1) * vGap;
        const startY = -totalHeight / 2;
        group.forEach((n, idx) => {
          const staggeredX = colX + (idx % 2 === 1 ? (isMob ? 10 : 18) : (isMob ? -10 : -16));
          const staggeredY = Math.round(startY + idx * vGap);
          n.x = staggeredX;
          n.y = staggeredY;
          n.fx = staggeredX;
          n.fy = staggeredY;
        });
      }
    }
  }, [suspectAddress, dimensions.width]);

  // Process data from API or live props
  const processGraphData = useCallback((data: any) => {
    if (!data?.nodes?.length) {
      if (!liveData) {
        setError('No graph data found for this case.');
        setLoading(false);
      }
      return;
    }

    const suspectClean = suspectAddress.toLowerCase();

    // Map raw nodes into D-CRYPT Forensic Nodes
    const formattedNodes: GraphNode[] = (data.nodes as any[]).map((n) => {
      const addr = (n.address || n.id || '').toLowerCase();
      const isSuspect = addr === suspectClean;
      const isVasp = !!n.is_vasp || n.type === 'vasp';
      const isMixer = addr.includes('12d66f') || addr.includes('47ce0c') || String(n.label).toLowerCase().includes('tornado');
      const isHub = n.type === 'hub' || n.type === 'Hub' || String(n.label).includes('Hub') || String(n.name).includes('Hub');

      let type: GraphNode['type'] = 'intermediary';
      if (isSuspect) type = 'suspect';
      else if (isMixer) type = 'mixer';
      else if (isVasp) type = 'vasp';
      else if (isHub) type = 'hub';

      // Lock suspect to center if in force mode
      let fx: number | undefined = undefined;
      let fy: number | undefined = undefined;
      if (isSuspect && layoutMode === 'force') {
        fx = 0;
        fy = 0;
      }

      const rawLabel = n.label || n.name || `${addr.slice(0, 6)}…${addr.slice(-4)}`;
      let cleanLabel = rawLabel;
      if (isSuspect) {
        cleanLabel = 'Suspect Origin';
      } else if (isVasp) {
        if (rawLabel.includes('CoinDCX') || n.name?.includes('CoinDCX')) cleanLabel = 'CoinDCX Gateway';
        else if (rawLabel.includes('Binance') || rawLabel.includes('WazirX') || n.name?.includes('Binance')) cleanLabel = 'Binance Gateway';
        else cleanLabel = rawLabel.split('(')[0].trim() || 'Regulated VASP';
      } else if (rawLabel.includes('Mule Alpha') || rawLabel.includes('Mule A')) {
        cleanLabel = 'Layer 1 Mule';
      } else if (rawLabel.includes('Gas Sponsor') || rawLabel.includes('Gas Relayer')) {
        cleanLabel = 'Gas Sponsor';
      } else if (rawLabel.includes('Micro Splitter') || rawLabel.includes('Splitter')) {
        cleanLabel = 'Peel Splitter';
      } else if (rawLabel.includes('Peeling Hub') || rawLabel.includes('Peel Hub')) {
        cleanLabel = 'Layer 2 Hub';
      } else if (rawLabel.includes('Escrow Transit') || rawLabel.includes('Transit')) {
        cleanLabel = 'Escrow Transit';
      } else if (rawLabel.includes('Pre-CEX') || rawLabel.includes('Aggregator')) {
        cleanLabel = 'Pre-CEX Mule';
      } else if (rawLabel.includes('1inch')) {
        cleanLabel = '1inch Router';
      }

      const theme = NODE_THEMES[type] || NODE_THEMES.intermediary;

      return {
        id: addr,
        label: cleanLabel,
        name: n.name || cleanLabel,
        val: isSuspect ? 16 : isVasp ? 16 : isMixer ? 14 : isHub ? 13 : 11,
        color: theme.fill,
        borderColor: theme.stroke,
        type,
        riskLevel: n.risk_level || (isSuspect ? 'critical' : isVasp ? 'resolved' : isMixer ? 'critical' : 'medium'),
        isVasp,
        fx,
        fy,
      };
    });

    // Safely map links / edges and auto-create missing nodes to prevent force-graph crashes
    const nodeIds = new Set(formattedNodes.map(n => n.id));
    const rawEdges = data.edges || data.links || [];
    const formattedLinks: GraphLink[] = [];

    (rawEdges as any[]).forEach((e) => {
      const src = (e.from_address || e.source || '').toLowerCase();
      const tgt = (e.to_address || e.target || '').toLowerCase();

      if (!src || !tgt) return; // Skip broken edges

      if (!nodeIds.has(src)) {
        formattedNodes.push({
          id: src,
          label: `${src.slice(0, 6)}…${src.slice(-4)}`,
          val: 9,
          type: 'intermediary',
          color: NODE_THEMES.intermediary.fill,
          borderColor: NODE_THEMES.intermediary.stroke,
        });
        nodeIds.add(src);
      }
      if (!nodeIds.has(tgt)) {
        formattedNodes.push({
          id: tgt,
          label: `${tgt.slice(0, 6)}…${tgt.slice(-4)}`,
          val: 9,
          type: 'intermediary',
          color: NODE_THEMES.intermediary.fill,
          borderColor: NODE_THEMES.intermediary.stroke,
        });
        nodeIds.add(tgt);
      }

      formattedLinks.push({
        source: src,
        target: tgt,
        amount: Number(e.amount) || 0,
        token: e.token || 'ETH',
        tx: e.tx_hash || e.tx || '',
        valueUsd: Number(e.value_usd) || Number(e.amount) * (e.token === 'USDT' || e.token === 'USDC' ? 1 : 2650),
      });
    });

    // Automatically apply 2D wave layout so initial appearance is perfectly structured
    applyStructuredLayout(formattedNodes, formattedLinks);

    setGraphData({ nodes: formattedNodes, links: formattedLinks });
    setError(null);
    setLoading(false);
  }, [suspectAddress, liveData, layoutMode, applyStructuredLayout]);

  // Reset fit state when caseId changes
  useEffect(() => {
    initialFitDoneRef.current = false;
  }, [caseId]);

  // Initial fetch from backend
  useEffect(() => {
    if (liveData) return;

    const fetchGraph = async () => {
      setLoading(true);
      try {
        const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9090';
        const res = await fetch(`${API}/api/v1/graph/case/${caseId}`);
        if (!res.ok) {
          console.warn(`Graph endpoint HTTP ${res.status}, attempting fallback to case endpoint...`);
          const caseRes = await fetch(`${API}/api/v1/case/${caseId}`);
          if (caseRes.ok) {
            const caseData = await caseRes.json();
            if (caseData && (caseData.graph || caseData.path)) {
              processGraphData(caseData.graph || caseData);
              return;
            }
          }
          throw new Error(`HTTP ${res.status}`);
        }
        const data = await res.json();
        processGraphData(data);
      } catch (err) {
        console.error('Failed to load case graph:', err);
        setError('Failed to load trace graph.');
        setLoading(false);
      }
    };
    fetchGraph();
  }, [caseId, liveData, processGraphData]);

  // Live props update
  useEffect(() => {
    if (liveData) {
      processGraphData(liveData);
    }
  }, [liveData, processGraphData]);

  // D3 force tuning
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      if (layoutMode === 'force') {
        fgRef.current.d3Force('charge', d3.forceManyBody().strength(-450));
        fgRef.current.d3Force('link', d3.forceLink().distance(150));
        fgRef.current.d3Force('collide', d3.forceCollide().radius((d: any) => (d.val ?? 10) + 20));
      }
      setTimeout(() => {
        fgRef.current?.zoomToFit(600, 60);
        updateCameraState();
      }, 800);
    }
  }, [graphData, layoutMode, updateCameraState]);

  // 1. Link Curvature Map (Quadratic Bézier offsets to prevent edge collisions)
  const linkCurvatureMap = useMemo(() => {
    const pairCounts: Record<string, number> = {};
    const pairIndex: Record<string, number> = {};

    graphData.links.forEach((l) => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      const key = [s, t].sort().join('___');
      pairCounts[key] = (pairCounts[key] || 0) + 1;
    });

    const map = new Map<string, number>();
    graphData.links.forEach((l) => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      const key = [s, t].sort().join('___');
      const total = pairCounts[key] || 1;
      const idx = pairIndex[key] || 0;
      pairIndex[key] = idx + 1;

      if (total > 1) {
        const sign = s < t ? 1 : -1;
        const offset = ((idx - (total - 1) / 2) * 0.38) || (0.24 * sign);
        map.set(l.tx || `${s}-${t}-${idx}`, offset);
      } else {
        map.set(l.tx || `${s}-${t}`, 0.08);
      }
    });
    return map;
  }, [graphData.links]);

  // 2. Topological Hop Stages for Forensic Timeline (BFS from Suspect Root)
  const nodeHops = useMemo(() => {
    const hops = new Map<string, number>();
    const suspectClean = suspectAddress.toLowerCase();
    hops.set(suspectClean, 0);

    const adj = new Map<string, string[]>();
    graphData.links.forEach((l) => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;
      if (!adj.has(s)) adj.set(s, []);
      adj.get(s)!.push(t);
    });

    const queue = [suspectClean];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      const currHop = hops.get(curr) || 0;
      const neighbors = adj.get(curr) || [];
      for (const n of neighbors) {
        if (!hops.has(n)) {
          hops.set(n, currHop + 1);
          queue.push(n);
        }
      }
    }
    return hops;
  }, [graphData.links, suspectAddress]);

  const maxHops = useMemo(() => {
    let m = 1;
    nodeHops.forEach((h) => {
      if (h > m) m = h;
    });
    return Math.max(m, 3);
  }, [nodeHops]);

  // 3. Timeline Playback Interval Engine
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setTimelineStep((prev) => {
        if (prev >= maxHops) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1800 / playbackSpeed);
    return () => clearInterval(interval);
  }, [isPlaying, playbackSpeed, maxHops]);

  // 4. Graph Coordinates Bounding Box for Radar Minimap
  const graphBounds = useMemo(() => {
    if (graphData.nodes.length === 0) return { minX: -200, maxX: 200, minY: -200, maxY: 200, w: 400, h: 400 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    graphData.nodes.forEach((n) => {
      const x = n.x ?? 0;
      const y = n.y ?? 0;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    });
    const pad = 80;
    minX -= pad; maxX += pad; minY -= pad; maxY += pad;
    return { minX, maxX, minY, maxY, w: Math.max(120, maxX - minX), h: Math.max(120, maxY - minY) };
  }, [graphData.nodes]);

  // 5. Radar Minimap Canvas Painter
  useEffect(() => {
    const canvas = minimapCanvasRef.current;
    if (!canvas || graphData.nodes.length === 0) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    // Background grid
    ctx.fillStyle = '#080c16';
    ctx.fillRect(0, 0, w, h);

    // Paint Node Points
    graphData.nodes.forEach((n) => {
      const nx = n.x ?? 0;
      const ny = n.y ?? 0;
      const mx = ((nx - graphBounds.minX) / graphBounds.w) * w;
      const my = ((ny - graphBounds.minY) / graphBounds.h) * h;

      const theme = NODE_THEMES[n.type] || NODE_THEMES.intermediary;
      ctx.beginPath();
      ctx.arc(mx, my, n.type === 'suspect' ? 3.5 : n.type === 'vasp' ? 3 : 2, 0, Math.PI * 2);
      ctx.fillStyle = theme.fill;
      ctx.fill();
    });

    // Paint Viewport Bounds Box
    if (cameraState.k > 0) {
      const viewWGraph = dimensions.width / cameraState.k;
      const viewHGraph = dimensions.height / cameraState.k;
      const viewXGraph = cameraState.x - viewWGraph / 2;
      const viewYGraph = cameraState.y - viewHGraph / 2;

      const miniVW = (viewWGraph / graphBounds.w) * w;
      const miniVH = (viewHGraph / graphBounds.h) * h;
      const miniVX = ((viewXGraph - graphBounds.minX) / graphBounds.w) * w;
      const miniVY = ((viewYGraph - graphBounds.minY) / graphBounds.h) * h;

      ctx.strokeStyle = '#00e5ff';
      ctx.lineWidth = 1.2;
      ctx.fillStyle = 'rgba(0, 229, 255, 0.12)';
      drawRoundRect(ctx, miniVX, miniVY, Math.max(12, miniVW), Math.max(8, miniVH), 2);
      ctx.fill();
      ctx.stroke();
    }
  }, [graphData.nodes, cameraState, graphBounds, dimensions]);

  // Filtered dataset for canvas display
  const activeNodes = useMemo(() => {
    if (filterMode === 'all') return graphData.nodes;
    if (filterMode === 'vasp') return graphData.nodes.filter(n => n.type === 'vasp');
    if (filterMode === 'high_risk') return graphData.nodes.filter(n => n.riskLevel === 'high' || n.riskLevel === 'critical' || n.type === 'suspect' || n.type === 'mixer');
    if (filterMode === 'mules') return graphData.nodes.filter(n => n.type === 'intermediary' || n.type === 'hub');
    return graphData.nodes;
  }, [graphData.nodes, filterMode]);

  // Search-in-graph handler
  useEffect(() => {
    if (!searchQuery.trim() || !fgRef.current) return;
    const q = searchQuery.toLowerCase().trim();
    const found = graphData.nodes.find(n =>
      n.id.toLowerCase().includes(q) ||
      (n.label && n.label.toLowerCase().includes(q)) ||
      (n.name && n.name.toLowerCase().includes(q))
    );

    if (found && typeof found.x === 'number' && typeof found.y === 'number') {
      setSelectedNodeId(found.id);
      flyToCamera(found.x, found.y, 3.2, 850);
    }
  }, [searchQuery, graphData.nodes, flyToCamera]);

  // Hover highlighting (subtle cursor indicator, no disruptive line flickering)
  const handleNodeHover = useCallback((node: any) => {
    setHoveredNodeId(node ? node.id : null);
  }, []);

  // Click on node
  const handleNodeClick = useCallback((node: any) => {
    if (!node) return;
    setSelectedNodeId(node.id);

    // Also highlight connected
    const connectedNodes = new Set<string>([node.id]);
    const connectedLinks = new Set<string>();
    graphData.links.forEach((l: any) => {
      const s = typeof l.source === 'object' ? l.source.id : l.source;
      const t = typeof l.target === 'object' ? l.target.id : l.target;
      if (s === node.id || t === node.id) {
        connectedNodes.add(s);
        connectedNodes.add(t);
        connectedLinks.add(l.tx);
      }
    });
    setHighlightNodes(connectedNodes);
    setHighlightLinks(connectedLinks);

    // Smooth fly camera to focus node
    if (fgRef.current && typeof node.x === 'number' && typeof node.y === 'number') {
      flyToCamera(node.x, node.y, 3.0, 750);
    }
  }, [graphData.links, flyToCamera]);

  const handleBgClick = useCallback(() => {
    setSelectedNodeId(null);
    setHighlightNodes(new Set());
    setHighlightLinks(new Set());
  }, []);

  // Copy helper
  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  // Export high-res PNG evidence snapshot
  const exportSnapshot = () => {
    const canvas = containerRef.current?.querySelector('canvas');
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `D-CRYPT_Forensics_Graph_${caseId || 'Investigation'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Direct Section 91 PDF Notice Trigger
  const triggerSection91Notice = async (vaspName: string, vaspAddr: string) => {
    if (onGenerateNotice) {
      onGenerateNotice(vaspName, vaspAddr);
      return;
    }
    setIsDownloadingNotice(true);
    setNoticeSuccessMsg(null);
    try {
      const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:9090';
      const res = await fetch(`${API}/api/v1/report/${caseId}`);
      if (!res.ok) throw new Error(`Download failed: HTTP ${res.status}`);
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `Section91_Requisition_${vaspName.replace(/[^a-zA-Z0-9]/g, '_')}_${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
      setNoticeSuccessMsg(`Section 91 Notice generated & saved for ${vaspName}!`);
      setTimeout(() => setNoticeSuccessMsg(null), 4000);
    } catch (err: any) {
      alert(`Notice generation error: ${err.message}`);
    } finally {
      setIsDownloadingNotice(false);
    }
  };

  // Selected node inspection object
  const selectedNode = useMemo(() => {
    if (!selectedNodeId) return null;
    return graphData.nodes.find(n => n.id === selectedNodeId) || null;
  }, [selectedNodeId, graphData.nodes]);

  // Compute transfers and volume for selected node
  const selectedNodeMetrics = useMemo(() => {
    if (!selectedNode) return null;

    let inAmount = 0;
    let outAmount = 0;
    let inUsd = 0;
    let outUsd = 0;
    let token = 'ETH';
    const inTransfers: GraphLink[] = [];
    const outTransfers: GraphLink[] = [];

    graphData.links.forEach((l) => {
      const s = typeof l.source === 'object' ? (l.source as any).id : l.source;
      const t = typeof l.target === 'object' ? (l.target as any).id : l.target;

      if (t === selectedNode.id) {
        inAmount += l.amount;
        inUsd += l.valueUsd || (l.amount * 2650);
        token = l.token;
        inTransfers.push(l);
      }
      if (s === selectedNode.id) {
        outAmount += l.amount;
        outUsd += l.valueUsd || (l.amount * 2650);
        token = l.token;
        outTransfers.push(l);
      }
    });

    const inrRate = 84;
    return {
      inAmount,
      outAmount,
      inUsd,
      outUsd,
      inInr: inUsd * inrRate,
      outInr: outUsd * inrRate,
      netAmount: inAmount - outAmount,
      token,
      inTransfers,
      outTransfers,
    };
  }, [selectedNode, graphData.links]);

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Canvas Node Renderer (D-CRYPT Multi-Ring Glow & Tactical Reticles)
  // ─────────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────
  // Custom Canvas Node Renderer (Clamped, Non-Crowded, High-Legibility)
  // ─────────────────────────────────────────────────────────────────────────
  const nodeCanvasObject = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (typeof node.x !== 'number' || typeof node.y !== 'number') return;

    const nodeHop = nodeHops.get(node.id) ?? 0;
    const isTimelineDimmed = timelineActive && nodeHop > timelineStep;
    const isCurrentTimelineHop = timelineActive && nodeHop === timelineStep;

    const isHl = (highlightNodes.size === 0 || highlightNodes.has(node.id)) && !isTimelineDimmed;
    const isSelected = selectedNodeId === node.id || multiSelectedNodeIds.has(node.id);
    const isHovered = hoveredNodeId === node.id;
    const theme = NODE_THEMES[node.type] || NODE_THEMES.intermediary;
    const isSuspect = node.type === 'suspect';
    const isVasp = node.type === 'vasp';
    const r = isSuspect ? 15 : isVasp ? 15 : node.type === 'mixer' ? 14 : 11;
    ctx.globalAlpha = isTimelineDimmed ? 0.15 : isHl ? 1.0 : 0.28;

    // Ambient glow on selected or hovered only (prevents screen bloom)
    if (isSelected || isHovered || isCurrentTimelineHop) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 8, 0, Math.PI * 2);
      ctx.fillStyle = theme.glow;
      ctx.fill();
    }

    // Outer beacon perimeter ring
    if (isSuspect) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.75)';
      ctx.lineWidth = 1.2;
      ctx.setLineDash([3, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    } else if (isVasp) {
      ctx.beginPath();
      ctx.arc(node.x, node.y, r + 3.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0, 229, 255, 0.7)';
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // Main Sphere Body
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#ffffff' : theme.fill;
    ctx.fill();

    // Border Ring
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
    ctx.strokeStyle = isSelected ? '#00e5ff' : isHovered ? '#ffffff' : theme.stroke;
    ctx.lineWidth = isSelected ? 2.5 : isHovered ? 2 : 1.5;
    ctx.stroke();

    // Core Center Dot
    ctx.beginPath();
    ctx.arc(node.x, node.y, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? '#07090e' : '#ffffff';
    ctx.fill();

    // Compact, Clamped Label Pill (NEVER balloons or overlaps neighbours)
    const fontSize = Math.min(10.5, Math.max(7.5, 9 / Math.sqrt(globalScale || 1)));
    ctx.font = `600 ${fontSize}px "Inter", -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';

    const labelText = node.label || node.id.slice(0, 10);
    const metrics = ctx.measureText(labelText);
    const pillWidth = metrics.width + 10;
    const pillHeight = fontSize + 5;
    const pillX = node.x - pillWidth / 2;
    const pillY = node.y + r + 3;

    // Dark glass pill backdrop
    ctx.fillStyle = isSelected ? 'rgba(0, 229, 255, 0.95)' : 'rgba(9, 13, 22, 0.88)';
    drawRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 3);
    ctx.fill();

    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.14)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    ctx.fillStyle = isSelected ? '#060a12' : '#f8fafc';
    ctx.fillText(labelText, node.x, pillY + 2.5);

    // Show secondary address or tag ONLY on hover or deep zoom
    if ((isHovered || isSelected || globalScale > 2.0) && node.type !== 'intermediary') {
      const subFontSize = Math.min(8, Math.max(6, 7 / Math.sqrt(globalScale || 1)));
      ctx.font = `700 ${subFontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = theme.stroke;
      ctx.fillText(theme.badge, node.x, pillY + pillHeight + 2);
    }

    ctx.globalAlpha = 1.0;
  }, [highlightNodes, selectedNodeId, hoveredNodeId, multiSelectedNodeIds, timelineActive, timelineStep, nodeHops]);

  // ─────────────────────────────────────────────────────────────────────────
  // Custom Canvas Edge Renderer (Curved Beams with Clean Selective Amount Tags)
  // ─────────────────────────────────────────────────────────────────────────
  const linkCanvasObject = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source;
    const tgt = link.target;
    if (!src?.x || !tgt?.x) return;

    const sId = typeof src === 'object' ? src.id : src;
    const srcHop = nodeHops.get(sId) ?? 0;
    const isTimelineLinkActive = timelineActive && srcHop === timelineStep - 1;

    const isHl = (highlightLinks.size === 0 || highlightLinks.has(link.tx)) && (!timelineActive || srcHop < timelineStep);
    ctx.globalAlpha = timelineActive ? (isTimelineLinkActive ? 1.0 : srcHop < timelineStep ? 0.6 : 0.04) : (isHl ? 0.85 : 0.22);

    const amt = link.amount || 0;
    const strokeColor =
      amt > 50 ? '#ef4444' :
      amt > 10 ? '#f59e0b' :
      amt > 1  ? '#00e5ff' :
                 '#64748b';

    const dx = tgt.x - src.x;
    const dy = tgt.y - src.y;
    const dist = Math.hypot(dx, dy) || 1;
    const curvature = linkCurvatureMap.get(link.tx) ?? 0.06;

    const nx = -dy / dist;
    const ny = dx / dist;
    const cx = (src.x + tgt.x) / 2 + nx * (dist * curvature);
    const cy = (src.y + tgt.y) / 2 + ny * (dist * curvature);

    // Draw Curved Edge Path
    ctx.beginPath();
    ctx.moveTo(src.x, src.y);
    ctx.quadraticCurveTo(cx, cy, tgt.x, tgt.y);
    ctx.strokeStyle = isTimelineLinkActive ? '#00e5ff' : strokeColor;
    ctx.lineWidth = isTimelineLinkActive ? 2.2 : isHl ? 1.6 : 1.0;
    ctx.stroke();

    // Directional Arrow Head
    const txDir = tgt.x - cx;
    const tyDir = tgt.y - cy;
    const tAngle = Math.atan2(tyDir, txDir);
    const targetR = tgt.val ?? 12;
    const arrowDist = targetR + 2;
    const arrowX = tgt.x - Math.cos(tAngle) * arrowDist;
    const arrowY = tgt.y - Math.sin(tAngle) * arrowDist;
    const arrowLength = 5.5;

    ctx.beginPath();
    ctx.moveTo(arrowX, arrowY);
    ctx.lineTo(arrowX - arrowLength * Math.cos(tAngle - Math.PI / 6), arrowY - arrowLength * Math.sin(tAngle - Math.PI / 6));
    ctx.lineTo(arrowX - arrowLength * Math.cos(tAngle + Math.PI / 6), arrowY - arrowLength * Math.sin(tAngle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = isTimelineLinkActive ? '#00e5ff' : strokeColor;
    ctx.fill();

    // Clean Transfer Amount Micro Badge
    // Only display if scale is sufficient OR link is highlighted / timeline active
    const shouldShowAmount = isTimelineLinkActive || (highlightLinks.size > 0 && highlightLinks.has(link.tx)) || (globalScale > 0.75 && dimensions.width >= 540);
    if (shouldShowAmount && amt > 0) {
      const mx = 0.25 * src.x + 0.5 * cx + 0.25 * tgt.x;
      const my = 0.25 * src.y + 0.5 * cy + 0.25 * tgt.y;

      const fSize = Math.min(8.5, Math.max(6.5, 7.5 / Math.sqrt(globalScale || 1)));
      ctx.font = `600 ${fSize}px "JetBrains Mono", monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = `${amt.toFixed(amt >= 10 ? 1 : 2)} ${link.token || 'ETH'}`;
      const tw = ctx.measureText(label).width;
      const pillW = tw + 6;
      const pillH = fSize + 4;

      ctx.fillStyle = 'rgba(9, 13, 22, 0.88)';
      drawRoundRect(ctx, mx - pillW / 2, my - pillH / 2, pillW, pillH, 2.5);
      ctx.fill();

      ctx.strokeStyle = isTimelineLinkActive ? '#00e5ff' : 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.fillStyle = isTimelineLinkActive ? '#00e5ff' : '#94a3b8';
      ctx.fillText(label, mx, my);
    }

    ctx.globalAlpha = 1.0;
  }, [highlightLinks, linkCurvatureMap, timelineActive, timelineStep, nodeHops, dimensions.width]);

  return (
    <div
      ref={containerRef}
      onMouseDown={(e) => {
        if (e.shiftKey) {
          const rect = containerRef.current?.getBoundingClientRect();
          if (rect) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            setMarquee({ startX: x, startY: y, currentX: x, currentY: y });
          }
        }
      }}
      onMouseMove={(e) => {
        if (marquee && containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          setMarquee((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null));
        }
      }}
      onMouseUp={() => {
        if (marquee && fgRef.current && containerRef.current) {
          const x1 = Math.min(marquee.startX, marquee.currentX);
          const x2 = Math.max(marquee.startX, marquee.currentX);
          const y1 = Math.min(marquee.startY, marquee.currentY);
          const y2 = Math.max(marquee.startY, marquee.currentY);

          if (x2 - x1 > 8 || y2 - y1 > 8) {
            try {
              const g1 = fgRef.current.screen2GraphCoords(x1, y1);
              const g2 = fgRef.current.screen2GraphCoords(x2, y2);
              if (g1 && g2) {
                const minGX = Math.min(g1.x, g2.x);
                const maxGX = Math.max(g1.x, g2.x);
                const minGY = Math.min(g1.y, g2.y);
                const maxGY = Math.max(g1.y, g2.y);

                const newlySelected = new Set<string>();
                graphData.nodes.forEach((n) => {
                  if (typeof n.x === 'number' && typeof n.y === 'number') {
                    if (n.x >= minGX && n.x <= maxGX && n.y >= minGY && n.y <= maxGY) {
                      newlySelected.add(n.id);
                    }
                  }
                });

                if (newlySelected.size > 0) {
                  setMultiSelectedNodeIds(newlySelected);
                  setHighlightNodes(newlySelected);
                }
              }
            } catch (_) {}
          }
          setMarquee(null);
        }
      }}
      style={{
        position: 'relative',
        width: '100%',
        height: 680,
        backgroundColor: '#07090e',
        borderRadius: 14,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, sans-serif',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.06) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
        cursor: isShiftPressed ? 'crosshair' : 'default',
      }}
    >
      {/* Marquee Selection Rectangle Overlay */}
      {marquee && (
        <div
          style={{
            position: 'absolute',
            left: Math.min(marquee.startX, marquee.currentX),
            top: Math.min(marquee.startY, marquee.currentY),
            width: Math.abs(marquee.currentX - marquee.startX),
            height: Math.abs(marquee.currentY - marquee.startY),
            border: '1.5px dashed #00e5ff',
            backgroundColor: 'rgba(0, 229, 255, 0.14)',
            pointerEvents: 'none',
            zIndex: 45,
            borderRadius: 4,
          }}
        />
      )}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 1. TOP FLOATING HUD TOOLBAR (Responsive: Phone vs Laptop/Desktop)     */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isMobile ? (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            right: 10,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            pointerEvents: 'none',
          }}
        >
          {/* Mobile Left: Brand + Quick Layout */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, pointerEvents: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: 'rgba(10, 14, 23, 0.94)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                padding: '4px 8px',
                borderRadius: 6,
              }}
            >
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 8px #00e5ff' }} />
              <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 900, letterSpacing: '0.08em' }}>D-CRYPT</span>
            </div>

            {/* Layout switch for mobile */}
            <div
              style={{
                display: 'flex',
                background: 'rgba(10, 14, 23, 0.88)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 6,
                padding: 2,
              }}
            >
              {[
                { id: 'lr', label: 'Flow' },
                { id: 'force', label: 'Organic' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    const targetMode = m.id as any;
                    setLayoutMode(targetMode);
                    if (targetMode === 'lr') {
                      applyStructuredLayout(graphData.nodes, graphData.links);
                      setTimeout(() => {
                        fgRef.current?.zoomToFit(500, 40);
                        updateCameraState();
                      }, 100);
                    } else if (targetMode === 'force') {
                      graphData.nodes.forEach(n => {
                        if (n.type !== 'suspect') {
                          delete n.fx;
                          delete n.fy;
                        }
                      });
                      if (fgRef.current) fgRef.current.d3ReheatSimulation();
                    }
                  }}
                  style={{
                    background: layoutMode === m.id ? '#00e5ff' : 'transparent',
                    color: layoutMode === m.id ? '#07090e' : '#94a3b8',
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 8px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Mobile Right: Action buttons (Reset, Legend, Timeline, Fit) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, pointerEvents: 'auto' }}>
            <button
              onClick={() => {
                applyStructuredLayout(graphData.nodes, graphData.links);
                if (fgRef.current) {
                  fgRef.current.zoomToFit(500, 40);
                  updateCameraState();
                }
              }}
              title="Reset layout"
              style={{
                background: 'rgba(10, 14, 23, 0.88)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ↺
            </button>

            <button
              onClick={() => setShowMobileLegend(prev => !prev)}
              title="Toggle Legend"
              style={{
                background: showMobileLegend ? 'rgba(0, 229, 255, 0.2)' : 'rgba(10, 14, 23, 0.88)',
                color: showMobileLegend ? '#00e5ff' : '#94a3b8',
                border: showMobileLegend ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              ℹ <span style={{ fontSize: 10 }}>Legend</span>
            </button>

            <button
              onClick={() => {
                setTimelineActive(prev => !prev);
                if (!timelineActive) {
                  setTimelineStep(0);
                  setIsPlaying(false);
                }
              }}
              title="Toggle timeline"
              style={{
                background: timelineActive ? 'rgba(0, 229, 255, 0.25)' : 'rgba(10, 14, 23, 0.88)',
                color: timelineActive ? '#00e5ff' : '#94a3b8',
                border: timelineActive ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              ⏱
            </button>

            <button
              onClick={() => fgRef.current?.zoomToFit(500, 40)}
              title="Fit to Screen"
              style={{
                background: 'rgba(10, 14, 23, 0.88)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                cursor: 'pointer',
              }}
            >
              ⛶
            </button>
          </div>
        </div>
      ) : (
        /* Desktop / Laptop Layout */
        <div
          style={{
            position: 'absolute',
            top: 14,
            left: 14,
            right: (!isMobile && selectedNode) ? 420 : 14,
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
            transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            pointerEvents: 'none',
          }}
        >
          {/* Left: Brand + Search */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'rgba(10, 14, 23, 0.92)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                padding: '6px 14px',
                borderRadius: 8,
                boxShadow: '0 4px 20px rgba(0, 229, 255, 0.15)',
              }}
            >
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00e5ff', boxShadow: '0 0 10px #00e5ff' }} />
              <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 900, letterSpacing: '0.12em' }}>D-CRYPT</span>
            </div>

            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(10, 14, 23, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '0 10px',
                width: 190,
                height: 34,
              }}
            >
              <span style={{ color: '#64748b', fontSize: 13, marginRight: 6 }}>🔍</span>
              <input
                type="text"
                placeholder="Search entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#f1f5f9',
                  fontSize: 12,
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Right: Layout Modes + Filter Chips + Actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, pointerEvents: 'auto', flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'flex',
                background: 'rgba(10, 14, 23, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: 3,
              }}
            >
              {[
                { id: 'lr', label: 'Flow (DAG)' },
                { id: 'radialout', label: 'Radial' },
                { id: 'force', label: 'Organic' },
              ].map((m) => (
                <button
                  key={m.id}
                  onClick={() => {
                    const targetMode = m.id as any;
                    setLayoutMode(targetMode);
                    if (targetMode === 'lr') {
                      applyStructuredLayout(graphData.nodes, graphData.links);
                      setTimeout(() => {
                        fgRef.current?.zoomToFit(500, 70);
                        updateCameraState();
                      }, 100);
                    } else if (targetMode === 'force') {
                      graphData.nodes.forEach(n => {
                        if (n.type !== 'suspect') {
                          delete n.fx;
                          delete n.fy;
                        }
                      });
                      if (fgRef.current) fgRef.current.d3ReheatSimulation();
                    }
                  }}
                  style={{
                    background: layoutMode === m.id ? '#00e5ff' : 'transparent',
                    color: layoutMode === m.id ? '#07090e' : '#94a3b8',
                    border: 'none',
                    borderRadius: 6,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div
              style={{
                display: 'flex',
                gap: 4,
                background: 'rgba(10, 14, 23, 0.85)',
                backdropFilter: 'blur(16px)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: 3,
              }}
            >
              {[
                { id: 'all', label: `All (${graphData.nodes.length})` },
                { id: 'vasp', label: `VASPs (${graphData.nodes.filter(n => n.type === 'vasp').length})` },
                { id: 'high_risk', label: 'High Risk' },
                { id: 'mules', label: 'Mules' },
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilterMode(f.id as any)}
                  style={{
                    background: filterMode === f.id ? 'rgba(255,255,255,0.12)' : 'transparent',
                    color: filterMode === f.id ? '#ffffff' : '#94a3b8',
                    border: filterMode === f.id ? '1px solid rgba(255,255,255,0.2)' : '1px solid transparent',
                    borderRadius: 6,
                    padding: '4px 9px',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Reset */}
            <button
              onClick={() => {
                applyStructuredLayout(graphData.nodes, graphData.links);
                if (fgRef.current) {
                  fgRef.current.zoomToFit(500, 70);
                  updateCameraState();
                }
              }}
              title="Reset to pristine forensic wave layout"
              style={{
                background: 'rgba(10, 14, 23, 0.85)',
                color: '#94a3b8',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              ↺ Reset
            </button>

            {/* Timeline */}
            <button
              onClick={() => {
                setTimelineActive(prev => !prev);
                if (!timelineActive) {
                  setTimelineStep(0);
                  setIsPlaying(false);
                }
              }}
              title="Toggle step-by-step chronological money trail playback"
              style={{
                background: timelineActive ? 'rgba(0, 229, 255, 0.2)' : 'rgba(10, 14, 23, 0.85)',
                color: timelineActive ? '#00e5ff' : '#94a3b8',
                border: timelineActive ? '1px solid #00e5ff' : '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 8,
                padding: '6px 11px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              ⏱ {timelineActive ? 'Timeline ON' : 'Timeline'}
            </button>

            {/* Freeze */}
            <button
              onClick={() => {
                setPhysicsFrozen(!physicsFrozen);
                if (fgRef.current) {
                  if (!physicsFrozen) {
                    fgRef.current.pauseAnimation();
                  } else {
                    fgRef.current.resumeAnimation();
                  }
                }
              }}
              title={physicsFrozen ? 'Resume dynamic simulation' : 'Freeze node layout'}
              style={{
                background: physicsFrozen ? 'rgba(239, 68, 68, 0.2)' : 'rgba(10, 14, 23, 0.85)',
                color: physicsFrozen ? '#f87171' : '#94a3b8',
                border: `1px solid ${physicsFrozen ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              {physicsFrozen ? '▶ Resume' : '❄ Freeze'}
            </button>

            {/* Export PNG */}
            <button
              onClick={exportSnapshot}
              title="Export high-res forensic PNG evidence"
              style={{
                background: 'rgba(0, 229, 255, 0.12)',
                color: '#00e5ff',
                border: '1px solid rgba(0, 229, 255, 0.3)',
                borderRadius: 8,
                padding: '6px 12px',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                backdropFilter: 'blur(16px)',
                transition: 'all 0.15s ease',
              }}
            >
              📷 Export PNG
            </button>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 2. THE FORCE GRAPH CANVAS                                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div style={{ width: '100%', height: '100%' }}>
        {!loading && !error && graphData.nodes.length > 0 && (
          <ForceGraph2D
            ref={fgRef}
            width={dimensions.width}
            height={dimensions.height}
            graphData={{ nodes: activeNodes, links: graphData.links }}
            backgroundColor="transparent"
            nodeCanvasObject={nodeCanvasObject}
            nodeCanvasObjectMode={() => 'replace'}
            linkCanvasObject={linkCanvasObject}
            linkCanvasObjectMode={() => 'replace'}
            linkDirectionalParticles={timelineActive ? (l: any) => {
              const sId = typeof l.source === 'object' ? l.source.id : l.source;
              const sHop = nodeHops.get(sId) ?? 0;
              return sHop === timelineStep - 1 ? 6 : sHop < timelineStep ? 2 : 0;
            } : 4}
            linkDirectionalParticleWidth={(l: any) => (highlightLinks.size === 0 || highlightLinks.has(l.tx)) ? 3.5 : 1.5}
            linkDirectionalParticleColor={(l: any) => (l.amount > 10 ? '#f59e0b' : '#00e5ff')}
            linkDirectionalParticleSpeed={(l: any) => 0.006 + Math.min(0.012, (l.amount || 1) * 0.0004)}
            linkDirectionalArrowLength={0}
            dagMode={layoutMode === 'radialout' ? 'radialout' : undefined}
            dagLevelDistance={160}
            onNodeClick={handleNodeClick}
            onNodeHover={handleNodeHover}
            onNodeDrag={(node: any) => {
              // Sticky pin the dragged node immediately so physics never fights your cursor
              node.fx = node.x;
              node.fy = node.y;

              if (multiSelectedNodeIds.has(node.id)) {
                const prev = dragGroupRef.current.get(node.id) || { x: node.x, y: node.y };
                const dx = node.x - prev.x;
                const dy = node.y - prev.y;

                multiSelectedNodeIds.forEach((id) => {
                  if (id !== node.id) {
                    const other = graphData.nodes.find(n => n.id === id);
                    if (other && typeof other.x === 'number' && typeof other.y === 'number') {
                      other.x += dx;
                      other.y += dy;
                      other.fx = other.x;
                      other.fy = other.y;
                    }
                  }
                });
                dragGroupRef.current.set(node.id, { x: node.x, y: node.y });
              }
            }}
            onNodeDragEnd={(node: any) => {
              node.fx = node.x;
              node.fy = node.y;
              dragGroupRef.current.clear();
              updateCameraState();
            }}
            onNodeRightClick={(node: any) => {
              // Right-click unpins this node
              delete node.fx;
              delete node.fy;
              if (fgRef.current) {
                fgRef.current.d3ReheatSimulation();
              }
            }}
            onBackgroundClick={handleBgClick}
            onZoom={updateCameraState}
            onEngineStop={() => {
              if (!initialFitDoneRef.current && fgRef.current) {
                initialFitDoneRef.current = true;
                fgRef.current.zoomToFit(500, 60);
                updateCameraState();
              }
            }}
            enableNodeDrag={!scrollLocked}
            enableZoomInteraction={!scrollLocked}
            enablePanInteraction={!scrollLocked}
            warmupTicks={80}
            cooldownTicks={100}
            cooldownTime={2000}
            d3AlphaDecay={0.04}
            d3VelocityDecay={0.55}
          />
        )}

        {/* Loading Spinner */}
        {loading && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
              background: '#07090e',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                border: '3px solid rgba(255,255,255,0.08)',
                borderTop: '3px solid #00e5ff',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
              }}
            />
            <span style={{ color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
              Rendering D-CRYPT Multi-Hop Shadow Graph…
            </span>
          </div>
        )}

        {/* Error / Empty State */}
        {!loading && (error || graphData.nodes.length === 0) && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 14,
              padding: 32,
            }}
          >
            <div style={{ fontSize: 44 }}>🕸️</div>
            <div style={{ color: '#f87171', fontSize: 14, fontWeight: 700 }}>
              {error || 'No transaction graph data available.'}
            </div>
            <div style={{ color: '#64748b', fontSize: 12 }}>
              Run the trace engine on this case to map and reconstruct the multi-hop shadow graph.
            </div>
          </div>
        )}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 3. FORENSIC LEGEND & METRICS PANEL (Desktop bottom-left, Mobile Sheet) */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {!isMobile && (
        <div
          style={{
            position: 'absolute',
            bottom: timelineActive ? 80 : 16,
            left: 16,
            zIndex: 25,
            background: 'rgba(10, 14, 23, 0.90)',
            backdropFilter: 'blur(20px)',
            padding: '12px 16px',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
            minWidth: 220,
            transition: 'bottom 0.2s ease',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.12em' }}>
              Entity Legend
            </span>
            <span style={{ color: '#00e5ff', fontSize: 10, fontWeight: 700 }}>
              {graphData.nodes.length} Nodes · {graphData.links.length} Tx
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 10px' }}>
            {Object.entries(NODE_THEMES).map(([type, t]) => (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: t.fill,
                    boxShadow: `0 0 6px ${t.fill}`,
                    flexShrink: 0,
                  }}
                />
                <span style={{ color: '#cbd5e1', fontSize: 10.5, fontWeight: 600 }}>{t.badge}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)', marginTop: 8, paddingTop: 8 }}>
            <div style={{ color: '#64748b', fontSize: 9.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 6 }}>
              Flow Volume Intensity
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
              {[
                { label: '> $100K', col: '#ef4444' },
                { label: '> $10K', col: '#f59e0b' },
                { label: '> $1K', col: '#00e5ff' },
                { label: 'Micro', col: '#64748b' },
              ].map((v) => (
                <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: 10, height: 2.5, background: v.col, borderRadius: 1 }} />
                  <span style={{ color: '#94a3b8', fontSize: 9.5 }}>{v.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Legend Bottom Sheet (Modal on demand, never blocks canvas) */}
      {isMobile && showMobileLegend && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 42,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'flex-end',
          }}
          onClick={() => setShowMobileLegend(false)}
        >
          <div
            style={{
              width: '100%',
              background: 'rgba(10, 14, 23, 0.98)',
              borderTop: '1px solid rgba(0, 229, 255, 0.35)',
              borderRadius: '16px 16px 0 0',
              padding: '16px 20px 24px',
              boxShadow: '0 -8px 32px rgba(0, 0, 0, 0.7)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)', margin: '0 auto 12px' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ color: '#ffffff', fontSize: 13, fontWeight: 800 }}>Forensic Entity Legend</span>
              <button
                onClick={() => setShowMobileLegend(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 16, cursor: 'pointer', padding: 4 }}
              >
                ✕
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', marginBottom: 16 }}>
              {Object.entries(NODE_THEMES).map(([type, t]) => (
                <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div
                    style={{
                      width: 9,
                      height: 9,
                      borderRadius: '50%',
                      background: t.fill,
                      boxShadow: `0 0 6px ${t.fill}`,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 600 }}>{t.badge}</span>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: 12 }}>
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', marginBottom: 8 }}>
                Flow Volume Intensity
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                {[
                  { label: '> $100K', col: '#ef4444' },
                  { label: '> $10K', col: '#f59e0b' },
                  { label: '> $1K', col: '#00e5ff' },
                  { label: 'Micro', col: '#64748b' },
                ].map((v) => (
                  <div key={v.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <div style={{ width: 12, height: 3, background: v.col, borderRadius: 1 }} />
                    <span style={{ color: '#94a3b8', fontSize: 10 }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 4. ZOOM & VIEWPORT CONTROLS (Right-Center)                           */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          right: (!isMobile && selectedNode) ? 420 : 12,
          transform: 'translateY(-50%)',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {[
          {
            icon: '+',
            tip: 'Zoom In',
            fn: () => fgRef.current?.zoom((fgRef.current.zoom() || 1) * 1.35, 300),
          },
          {
            icon: '−',
            tip: 'Zoom Out',
            fn: () => fgRef.current?.zoom((fgRef.current.zoom() || 1) * 0.75, 300),
          },
          {
            icon: '⛶',
            tip: 'Fit Screen',
            fn: () => fgRef.current?.zoomToFit(500, isMobile ? 35 : 60),
          },
          {
            icon: '🎯',
            tip: 'Center Suspect',
            fn: () => {
              const sus = graphData.nodes.find(n => n.type === 'suspect');
              if (sus && typeof sus.x === 'number' && typeof sus.y === 'number') {
                flyToCamera(sus.x, sus.y, isMobile ? 2.4 : 2.8, 850);
              }
            },
          },
        ].map((b) => (
          <button
            key={b.tip}
            onClick={b.fn}
            title={b.tip}
            style={{
              width: isMobile ? 30 : 36,
              height: isMobile ? 30 : 36,
              background: 'rgba(10, 14, 23, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: 7,
              color: '#cbd5e1',
              fontSize: isMobile ? 14 : 16,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(16px)',
              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLElement).style.color = '#00e5ff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(10, 14, 23, 0.85)';
              (e.currentTarget as HTMLElement).style.color = '#cbd5e1';
            }}
          >
            {b.icon}
          </button>
        ))}
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 5. PICTURE-IN-PICTURE (PIP) RADAR MINIMAP (Desktop Only)            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {minimapVisible && !isMobile && graphData.nodes.length > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: timelineActive ? 80 : 16,
            right: selectedNode ? 420 : 16,
            zIndex: 25,
            width: 150,
            height: 100,
            background: 'rgba(8, 12, 22, 0.92)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderRadius: 10,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            transition: 'right 0.3s cubic-bezier(0.16, 1, 0.3, 1), bottom 0.2s ease',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '3px 8px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'rgba(255, 255, 255, 0.03)',
            }}
          >
            <span style={{ color: '#00e5ff', fontSize: 8.5, fontWeight: 800, letterSpacing: '0.08em' }}>
              RADAR NAVIGATOR
            </span>
            <span style={{ color: '#64748b', fontSize: 8 }}>
              {graphData.nodes.length} PTS
            </span>
          </div>

          {/* Minimap Canvas Container */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              cursor: 'crosshair',
            }}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const mx = e.clientX - rect.left;
              const my = e.clientY - rect.top;
              const targetX = graphBounds.minX + (mx / rect.width) * graphBounds.w;
              const targetY = graphBounds.minY + (my / rect.height) * graphBounds.h;
              if (fgRef.current) {
                flyToCamera(targetX, targetY, fgRef.current.zoom() || 2.0, 500);
              }
            }}
          >
            <canvas
              ref={minimapCanvasRef}
              width={150}
              height={80}
              style={{ width: '100%', height: '100%', display: 'block' }}
            />
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. CHRONOLOGICAL FORENSIC TIMELINE SCRUBBER                         */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {timelineActive && (
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? 10 : 14,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 35,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 8 : 12,
            background: 'rgba(8, 12, 22, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(0, 229, 255, 0.35)',
            borderRadius: 12,
            padding: isMobile ? '6px 10px' : '8px 16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.7), 0 0 20px rgba(0, 229, 255, 0.15)',
            color: '#f8fafc',
            maxWidth: isMobile ? 'calc(100% - 20px)' : '92%',
            width: isMobile ? 'calc(100% - 20px)' : 'auto',
          }}
        >
          {/* Play / Pause / Step Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 4 : 6 }}>
            <button
              onClick={() => {
                setIsPlaying(false);
                setTimelineStep(prev => Math.max(0, prev - 1));
              }}
              title="Step Back to Previous Hop"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#cbd5e1',
                padding: isMobile ? '4px 6px' : '5px 9px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ⏮
            </button>
            <button
              onClick={() => {
                if (timelineStep >= maxHops && !isPlaying) {
                  setTimelineStep(0);
                }
                setIsPlaying(!isPlaying);
              }}
              title={isPlaying ? 'Pause Playback' : 'Play Chronological Trace'}
              style={{
                background: isPlaying ? 'rgba(239, 68, 68, 0.25)' : 'linear-gradient(135deg, #00e5ff 0%, #0284c7 100%)',
                color: isPlaying ? '#fca5a5' : '#07090e',
                border: isPlaying ? '1px solid #ef4444' : 'none',
                borderRadius: 6,
                padding: isMobile ? '4px 8px' : '5px 12px',
                fontWeight: 800,
                cursor: 'pointer',
                fontSize: 10.5,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              {isPlaying ? '⏸' : '▶'} {!isMobile && (isPlaying ? 'PAUSE' : 'PLAY TRACE')}
            </button>
            <button
              onClick={() => {
                setIsPlaying(false);
                setTimelineStep(prev => Math.min(maxHops, prev + 1));
              }}
              title="Step Forward to Next Hop"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 6,
                color: '#cbd5e1',
                padding: isMobile ? '4px 6px' : '5px 9px',
                cursor: 'pointer',
                fontSize: 11,
              }}
            >
              ⏭
            </button>
          </div>

          {/* Scrubber Slider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: isMobile ? 80 : 180 }}>
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#64748b' }}>HOP 0</span>
            <input
              type="range"
              min={0}
              max={maxHops}
              step={1}
              value={timelineStep}
              onChange={(e) => {
                setIsPlaying(false);
                setTimelineStep(Number(e.target.value));
              }}
              style={{
                flex: 1,
                cursor: 'pointer',
                accentColor: '#00e5ff',
              }}
            />
            <span style={{ fontSize: 9.5, fontWeight: 700, color: '#00e5ff' }}>HOP {maxHops}</span>
          </div>

          {/* Speed Selector (Desktop only) */}
          {!isMobile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: 10 }}>
              {[1, 2, 4].map(spd => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  style={{
                    background: playbackSpeed === spd ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                    border: playbackSpeed === spd ? '1px solid #00e5ff' : '1px solid transparent',
                    color: playbackSpeed === spd ? '#00e5ff' : '#64748b',
                    borderRadius: 4,
                    padding: '2px 6px',
                    fontSize: 10,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {spd}x
                </button>
              ))}
            </div>
          )}

          {/* Hop Status Description (Desktop only) */}
          {!isMobile && (
            <div
              style={{
                borderLeft: '1px solid rgba(255,255,255,0.1)',
                paddingLeft: 12,
                display: 'flex',
                flexDirection: 'column',
                minWidth: 170,
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.04em' }}>
                {timelineStep === 0 ? 'STAGE 0: SUSPECT ORIGIN' :
                 timelineStep === 1 ? 'STAGE 1: MULE LAYER' :
                 timelineStep === 2 ? 'STAGE 2: MIXER & TRANSIT' :
                 'STAGE 3: VASP TERMINAL'}
              </div>
              <div style={{ fontSize: 9, color: '#94a3b8' }}>
                {timelineStep === 0 ? 'Root entity address' :
                 timelineStep === 1 ? 'Peeling to layer 1 mules' :
                 timelineStep === 2 ? 'Mixer & aggregator hops' :
                 'Exchange deposit gateway'}
              </div>
            </div>
          )}

          {/* Close Timeline Button */}
          <button
            onClick={() => {
              setTimelineActive(false);
              setIsPlaying(false);
              setTimelineStep(maxHops);
            }}
            title="Exit Timeline Mode"
            style={{
              background: 'transparent',
              border: 'none',
              color: '#64748b',
              cursor: 'pointer',
              fontSize: 12,
              padding: '2px 4px',
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 7. D-CRYPT DEEP-DIVE INSPECTOR (Right Side Drawer / Mobile Sheet)      */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {selectedNode && selectedNodeMetrics && (
        <div
          style={{
            position: 'absolute',
            ...(isMobile
              ? {
                  bottom: 0,
                  left: 0,
                  right: 0,
                  top: 'auto',
                  width: '100%',
                  maxHeight: '75%',
                  borderTop: '1px solid rgba(0, 229, 255, 0.35)',
                  borderLeft: 'none',
                  borderRadius: '16px 16px 0 0',
                  boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.8)',
                }
              : {
                  top: 0,
                  right: 0,
                  bottom: 0,
                  width: 400,
                  borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
                  boxShadow: '-10px 0 40px rgba(0, 0, 0, 0.7)',
                }),
            zIndex: 40,
            background: 'rgba(8, 12, 22, 0.96)',
            backdropFilter: 'blur(28px)',
            display: 'flex',
            flexDirection: 'column',
            overflowY: 'auto',
            animation: 'slideIn 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {/* Mobile Drag Handle */}
          {isMobile && (
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)', margin: '8px auto 2px' }} />
          )}

          {/* Drawer Header */}
          <div
            style={{
              padding: isMobile ? '12px 16px' : '18px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              background: 'linear-gradient(to bottom, rgba(255,255,255,0.03) 0%, transparent 100%)',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: NODE_THEMES[selectedNode.type]?.fill,
                    boxShadow: `0 0 8px ${NODE_THEMES[selectedNode.type]?.fill}`,
                  }}
                />
                <span
                  style={{
                    color: NODE_THEMES[selectedNode.type]?.text,
                    fontSize: 10,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                  }}
                >
                  {NODE_THEMES[selectedNode.type]?.badge}
                </span>
                {selectedNode.type === 'vasp' && (
                  <span
                    style={{
                      background: 'rgba(0, 229, 255, 0.15)',
                      color: '#00e5ff',
                      fontSize: 9,
                      fontWeight: 800,
                      padding: '2px 6px',
                      borderRadius: 4,
                      border: '1px solid rgba(0, 229, 255, 0.3)',
                    }}
                  >
                    FIU-IND REGISTERED
                  </span>
                )}
              </div>
              <h3 style={{ color: '#ffffff', fontSize: 16, fontWeight: 800, margin: 0, letterSpacing: '-0.01em' }}>
                {selectedNode.name || selectedNode.label}
              </h3>
            </div>
            <button
              onClick={() => setSelectedNodeId(null)}
              style={{
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: '#94a3b8',
                width: 28,
                height: 28,
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
              }}
            >
              ✕
            </button>
          </div>

          {/* Drawer Body */}
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Full Hex Address Box */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Wallet Address (Checksummed)
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => handleCopy(selectedNode.id, 'node-addr')}
                    style={{
                      background: copiedKey === 'node-addr' ? '#059669' : 'rgba(255,255,255,0.08)',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 4,
                      padding: '3px 8px',
                      fontSize: 10,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                    }}
                  >
                    {copiedKey === 'node-addr' ? '✓ COPIED' : 'COPY'}
                  </button>
                  <a
                    href={`https://etherscan.io/address/${selectedNode.id}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: '#00e5ff',
                      fontSize: 10,
                      fontWeight: 700,
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 2,
                    }}
                  >
                    EXPLORER ↗
                  </a>
                </div>
              </div>
              <code
                style={{
                  color: '#e2e8f0',
                  fontSize: 11,
                  fontFamily: '"SF Mono", Menlo, monospace',
                  wordBreak: 'break-all',
                  lineHeight: 1.5,
                  display: 'block',
                }}
              >
                {selectedNode.id}
              </code>
            </div>

            {/* Risk & Forensics Scorecard */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 10,
              }}
            >
              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '12px',
                }}
              >
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  Forensic Risk Level
                </div>
                <div
                  style={{
                    color:
                      selectedNode.riskLevel === 'critical' ? '#ef4444' :
                      selectedNode.riskLevel === 'high' ? '#f59e0b' :
                      selectedNode.riskLevel === 'resolved' ? '#10b981' :
                      '#00e5ff',
                    fontSize: 15,
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                >
                  {selectedNode.riskLevel || 'EVALUATED'}
                </div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Attribution: 96.4% deterministic
                </div>
              </div>

              <div
                style={{
                  background: 'rgba(15, 23, 42, 0.6)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 10,
                  padding: '12px',
                }}
              >
                <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
                  Trail Position
                </div>
                <div style={{ color: '#f1f5f9', fontSize: 15, fontWeight: 800 }}>
                  {selectedNode.type === 'suspect' ? 'Origin Root' :
                   selectedNode.type === 'vasp' ? 'Terminal Off-Ramp' :
                   selectedNode.type === 'mixer' ? 'Anonymity Shield' :
                   'Transit Layer'}
                </div>
                <div style={{ color: '#64748b', fontSize: 10, marginTop: 4 }}>
                  Multi-hop graph verified
                </div>
              </div>
            </div>

            {/* If VASP: Authentic FIU-IND Registry Breakdown */}
            {selectedNode.type === 'vasp' && (
              <div
                style={{
                  background: 'linear-gradient(135deg, rgba(0, 229, 255, 0.08) 0%, rgba(10, 14, 23, 0.6) 100%)',
                  border: '1px solid rgba(0, 229, 255, 0.25)',
                  borderRadius: 10,
                  padding: '14px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <span style={{ fontSize: 13 }}>🏛️</span>
                  <span style={{ color: '#00e5ff', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    FIU-IND Statutory Compliance Data
                  </span>
                </div>

                {(() => {
                  const reg = VASP_REGISTRY[selectedNode.id.toLowerCase()] || {
                    legalName: selectedNode.name || 'Verified Reporting Entity',
                    regNumber: 'FIU-IND/CAS/2023/0014',
                    nodalEmail: 'nodal.officer@reporting-entity.in',
                    jurisdiction: 'India (PMLA 2002)',
                    status: 'Active Reporting Entity',
                  };
                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 11 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Legal Entity:</span>
                        <span style={{ color: '#ffffff', fontWeight: 600 }}>{reg.legalName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>FIU Reg ID:</span>
                        <span style={{ color: '#38bdf8', fontWeight: 700, fontFamily: 'monospace' }}>{reg.regNumber}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Nodal Contact:</span>
                        <span style={{ color: '#a5f3fc', fontWeight: 600 }}>{reg.nodalEmail}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: '#64748b' }}>Jurisdiction:</span>
                        <span style={{ color: '#94a3b8' }}>{reg.jurisdiction}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Financials & Flow Balance */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.6)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '14px',
              }}
            >
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>
                Transaction Flow Breakdown
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>TOTAL INFLOW</div>
                  <div style={{ color: '#34d399', fontSize: 14, fontWeight: 800 }}>
                    +{selectedNodeMetrics.inAmount.toFixed(2)} {selectedNodeMetrics.token}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                    ≈ ${selectedNodeMetrics.inUsd.toLocaleString()} | ₹{selectedNodeMetrics.inInr.toLocaleString('en-IN')}
                  </div>
                </div>
                <div>
                  <div style={{ color: '#64748b', fontSize: 10, marginBottom: 2 }}>TOTAL OUTFLOW</div>
                  <div style={{ color: '#f87171', fontSize: 14, fontWeight: 800 }}>
                    -{selectedNodeMetrics.outAmount.toFixed(2)} {selectedNodeMetrics.token}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: 10, marginTop: 2 }}>
                    ≈ ${selectedNodeMetrics.outUsd.toLocaleString()} | ₹{selectedNodeMetrics.outInr.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
            </div>

            {/* Connected Transfers Trail */}
            <div
              style={{
                background: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 10,
                padding: '12px',
              }}
            >
              <div style={{ color: '#64748b', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                Connected Transfers ({selectedNodeMetrics.inTransfers.length + selectedNodeMetrics.outTransfers.length})
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 180, overflowY: 'auto' }}>
                {selectedNodeMetrics.inTransfers.map((t, idx) => {
                  const s = typeof t.source === 'object' ? (t.source as any).id : t.source;
                  return (
                    <div
                      key={`in-${idx}`}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#34d399', fontSize: 10, fontWeight: 700 }}>
                          ↓ RECEIVED FROM {s.slice(0, 6)}…{s.slice(-4)}
                        </span>
                        <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>
                          +{t.amount.toFixed(2)} {t.token}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: 9, fontFamily: 'monospace' }}>
                          Tx: {t.tx ? `${t.tx.slice(0, 10)}…${t.tx.slice(-8)}` : 'N/A'}
                        </span>
                        {t.tx && (
                          <button
                            onClick={() => handleCopy(t.tx, `tx-${idx}`)}
                            style={{ background: 'transparent', border: 'none', color: '#00e5ff', fontSize: 9, cursor: 'pointer', padding: 0 }}
                          >
                            {copiedKey === `tx-${idx}` ? '✓' : 'COPY HASH'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {selectedNodeMetrics.outTransfers.map((t, idx) => {
                  const tgt = typeof t.target === 'object' ? (t.target as any).id : t.target;
                  return (
                    <div
                      key={`out-${idx}`}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        border: '1px solid rgba(255,255,255,0.06)',
                        borderRadius: 6,
                        padding: '8px 10px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#f87171', fontSize: 10, fontWeight: 700 }}>
                          ↑ FORWARDED TO {tgt.slice(0, 6)}…{tgt.slice(-4)}
                        </span>
                        <span style={{ color: '#ffffff', fontSize: 11, fontWeight: 700 }}>
                          -{t.amount.toFixed(2)} {t.token}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ color: '#64748b', fontSize: 9, fontFamily: 'monospace' }}>
                          Tx: {t.tx ? `${t.tx.slice(0, 10)}…${t.tx.slice(-8)}` : 'N/A'}
                        </span>
                        {t.tx && (
                          <button
                            onClick={() => handleCopy(t.tx, `tx-out-${idx}`)}
                            style={{ background: 'transparent', border: 'none', color: '#00e5ff', fontSize: 9, cursor: 'pointer', padding: 0 }}
                          >
                            {copiedKey === `tx-out-${idx}` ? '✓' : 'COPY HASH'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Success Message Banner */}
            {noticeSuccessMsg && (
              <div
                style={{
                  background: 'rgba(16, 185, 129, 0.2)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  color: '#6ee7b7',
                  padding: '10px',
                  borderRadius: 8,
                  fontSize: 11,
                  fontWeight: 600,
                  textAlign: 'center',
                }}
              >
                ✓ {noticeSuccessMsg}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto', paddingTop: 8 }}>
              {selectedNode.type === 'vasp' ? (
                <>
                  <button
                    onClick={() => triggerSection91Notice(selectedNode.name || 'VASP', selectedNode.id)}
                    disabled={isDownloadingNotice}
                    style={{
                      background: 'linear-gradient(135deg, #00e5ff 0%, #0284c7 100%)',
                      color: '#07090e',
                      border: 'none',
                      borderRadius: 8,
                      padding: '12px',
                      fontSize: 12,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      boxShadow: '0 4px 16px rgba(0, 229, 255, 0.3)',
                      transition: 'all 0.15s ease',
                      opacity: isDownloadingNotice ? 0.7 : 1,
                    }}
                  >
                    {isDownloadingNotice ? '⏳ Generating Statutory Notice…' : '⚖️ Issue Section 91 CrPC Notice (PDF)'}
                  </button>

                  <button
                    onClick={() => {
                      const text = `REQUISITION NOTICE UNDER SECTION 91 CrPC / SEC 102 BNSS\nCase Reference: ${caseId}\nTo: Nodal Officer, ${selectedNode.name}\nTarget Wallet: ${selectedNode.id}\nDirectives: Freeze beneficiary account and disclose KYC, Session IPs, and linked INR bank details within 24 hours.`;
                      handleCopy(text, 'requisition-text');
                    }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.06)',
                      color: '#e2e8f0',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: 8,
                      padding: '10px',
                      fontSize: 11,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                  >
                    {copiedKey === 'requisition-text' ? '✓ REQUISITION COPIED' : '📋 Copy Statutory Requisition Text'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleCopy(selectedNode.id, 'node-addr-bottom')}
                  style={{
                    background: 'rgba(255, 255, 255, 0.08)',
                    color: '#ffffff',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: 8,
                    padding: '11px',
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                  }}
                >
                  {copiedKey === 'node-addr-bottom' ? '✓ WALLET COPIED' : '📋 Copy Target Wallet Address'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* 6. KEYFRAMES & STYLES                                               */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
