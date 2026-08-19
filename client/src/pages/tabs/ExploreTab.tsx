import { useState, useEffect, useRef, useMemo, useCallback, useId } from "react";
import React, { Component } from "react";
import { trpc } from "@/lib/trpc";
import EntityDeepDivePanel from "@/components/EntityDeepDivePanel";
import { SaveInvestigationModal } from "@/components/SaveInvestigationModal";
import { SavedInvestigationsList } from "@/components/SavedInvestigationsList";
import ForceDirectedTree, { type TreeNode } from "@/components/ForceDirectedTree";
import ForceGraph3DView from "@/components/ForceGraph3D";
import {
  Search, X, ExternalLink, Clock, Users, Building2, Globe, MapPin,
  Network, Tag, Newspaper, ChevronDown, ChevronUp,
  Activity, BarChart2, RefreshCw, Filter,
  Eye, TrendingUp, BookOpen, Layers, ArrowRight, Zap,
  BookmarkPlus, FolderOpen, TreePine, AlertTriangle,
  Terminal, Radio, Crosshair, Shield, Database, Cpu, Scan,
  Orbit, GitMerge, Shuffle, ChevronsUpDown, ChevronsDownUp, Download, Box
} from "lucide-react";

// ─── Graph Error Boundary ─────────────────────────────────────────────────────
class GraphErrorBoundary extends Component<
  { children: React.ReactNode; onReset?: () => void },
  { hasError: boolean; errorMsg: string }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, errorMsg: '' };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, errorMsg: error?.message ?? 'Unknown error' };
  }
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[GraphErrorBoundary]', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center space-y-3 max-w-xs">
            <AlertTriangle size={36} className="mx-auto text-destructive opacity-60"/>
            <div className="text-sm font-semibold text-foreground">Graph rendering error</div>
            <div className="text-xs text-muted-foreground font-mono bg-muted/30 rounded p-2 text-left">{this.state.errorMsg}</div>
            <button
              onClick={() => { this.setState({ hasError: false, errorMsg: '' }); this.props.onReset?.(); }}
              className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary border border-primary/30 text-xs font-semibold hover:bg-primary/20 transition-all">
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Node Styling ─────────────────────────────────────────────────────────────
const NODE_STYLES: Record<string, { color: string; shape: string; size: number }> = {
  article:      { color: "#22d3ee", shape: "dot",      size: 14 },
  agency:       { color: "#f59e0b", shape: "square",   size: 16 },
  author:       { color: "#a78bfa", shape: "diamond",  size: 12 },
  country:      { color: "#10b981", shape: "triangle", size: 18 },
  person:       { color: "#f472b6", shape: "dot",      size: 12 },
  organization: { color: "#fb923c", shape: "square",   size: 14 },
  facility:     { color: "#ef4444", shape: "star",     size: 16 },
  keyword:      { color: "#6b7280", shape: "dot",      size: 8  },
};

const TOPIC_COLORS: Record<string, string> = {
  "WAR/CONFLICT":"#ef4444","ECONOMY":"#f59e0b","POLITICS":"#8b5cf6",
  "TECHNOLOGY":"#06b6d4","ENERGY":"#f97316","DIPLOMACY":"#10b981",
  "SECURITY":"#ec4899","HUMANITARIAN":"#84cc16",
};

// ─── Timeline Bar (SIGINT Waveform) ──────────────────────────────────────────
function TimelineBar({ region, onDateSelect, selectedDate, onSummary }: {
  region: string;
  onDateSelect?: (date: string | null) => void;
  selectedDate?: string | null;
  onSummary?: (s: { total: number; hostile: number; positive: number; peak: string | null; peakCount: number }) => void;
}) {
  const [days, setDays] = React.useState<14 | 30>(14);
  const { data: timeline, isLoading } = trpc.articles.timeline.useQuery({ region, days });

  const totalSignals = timeline?.reduce((s, d) => s + d.count, 0) ?? 0;
  const totalHostile = timeline?.reduce((s, d) => s + d.negative, 0) ?? 0;
  const totalPositive = timeline?.reduce((s, d) => s + d.positive, 0) ?? 0;
  const peakDay = timeline?.reduce((best: typeof timeline[0] | null, d) => d.count > (best?.count ?? 0) ? d : best, null);

  // Bubble summary stats up to parent header
  React.useEffect(() => {
    if (timeline && onSummary) {
      onSummary({ total: totalSignals, hostile: totalHostile, positive: totalPositive, peak: peakDay?.date ?? null, peakCount: peakDay?.count ?? 0 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalSignals, totalHostile, totalPositive, peakDay?.date]);

  if (isLoading) return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-3">
        {[60, 40, 50].map((w, i) => <div key={i} className="h-2 bg-foreground/5 rounded animate-pulse" style={{ width: `${w}px` }}/>)}
      </div>
      <div className="flex items-end gap-0.5 h-14 px-1">
        {Array.from({ length: days }).map((_, i) => (
          <div key={i} className="flex-1 bg-foreground/5 rounded-sm animate-pulse" style={{ height: `${20 + (i % 4) * 15}%` }}/>
        ))}
      </div>
    </div>
  );
  if (!timeline?.length) return (
    <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground font-mono">[ NO SIGNAL ]</div>
  );

  const maxCount = Math.max(...timeline.map(d => d.count), 1);

  return (
    <div className="space-y-1.5">
      {/* Stats row */}
      <div className="flex items-center gap-3">
        <span className="text-[9px] font-mono text-muted-foreground">{totalSignals} <span className="text-muted-foreground/50">signals</span></span>
        {totalHostile > 0 && <span className="text-[9px] font-mono text-red-400/60">{totalHostile} <span className="text-red-400/35">hostile</span></span>}
        {totalPositive > 0 && <span className="text-[9px] font-mono text-green-400/60">{totalPositive} <span className="text-green-400/35">positive</span></span>}
        {peakDay && <span className="text-[9px] font-mono text-muted-foreground/50 hidden xl:inline">peak: <span className="text-muted-foreground">{peakDay.date} ({peakDay.count})</span></span>}
        <div className="ml-auto flex items-center gap-0.5 bg-foreground/[0.08] border border-foreground/8 rounded p-0.5">
          {([14, 30] as const).map(d => (
            <button key={d} onClick={() => setDays(d)}
              className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-all ${
                days === d ? 'bg-foreground/10 text-foreground/70' : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}>{d}D</button>
          ))}
        </div>
      </div>
      {/* Waveform bars */}
      <div className="flex items-end gap-0.5 h-14 px-1">
        {timeline.map((day, i) => {
          const height = Math.max((day.count / maxCount) * 100, 4);
          const negPct = day.count > 0 ? (day.negative / day.count) * 100 : 0;
          const posPct = day.count > 0 ? (day.positive / day.count) * 100 : 0;
          const date = new Date(day.date);
          const isToday = i === timeline.length - 1;
          const isPeak = day.count === maxCount && maxCount > 1;
          const isSelected = selectedDate === day.date;
          return (
            <div key={i}
              className="flex-1 flex flex-col items-center gap-0.5 group cursor-pointer relative"
              onClick={() => onDateSelect?.(isSelected ? null : day.date)}
              title={isSelected ? 'Click to clear date filter' : `Filter to ${day.date}`}>
              <div className="relative w-full flex flex-col justify-end" style={{ height: '46px' }}>
                {isPeak && !isToday && (
                  <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-yellow-400/60"/>
                )}
                {isSelected && (
                  <div className="absolute inset-0 border border-emerald-400/60 rounded-sm pointer-events-none" style={{ boxShadow: '0 0 6px rgba(52,211,153,0.4)' }}/>
                )}
                <div className="w-full rounded-sm overflow-hidden transition-all group-hover:brightness-125"
                  style={{ height: `${height}%`, minHeight: '3px',
                    background: isSelected
                      ? `linear-gradient(to top, rgba(239,68,68,0.9) ${negPct}%, rgba(34,197,94,0.9) ${negPct + posPct}%, rgba(52,211,153,0.7) 100%)`
                      : isToday
                        ? `linear-gradient(to top, rgba(239,68,68,0.75) ${negPct}%, rgba(34,197,94,0.75) ${negPct + posPct}%, oklch(from var(--foreground) l c h / 0.3) 100%)`
                        : `linear-gradient(to top, rgba(239,68,68,0.4) ${negPct}%, rgba(34,197,94,0.4) ${negPct + posPct}%, oklch(from var(--foreground) l c h / 0.1) 100%)`,
                    boxShadow: isSelected ? '0 0 8px rgba(52,211,153,0.5)' : isToday ? '0 0 8px oklch(from var(--foreground) l c h / 0.2)' : isPeak ? '0 0 4px rgba(234,179,8,0.3)' : undefined }}>
                </div>
                {isToday && !isSelected && <div className="absolute top-0 left-0 right-0 h-px bg-foreground/50"/>}
                {isSelected && <div className="absolute top-0 left-0 right-0 h-px bg-emerald-400/80"/>}
              </div>
              {(days === 14 ? i % 2 === 0 : i % 5 === 0) && (
                <div className="text-[6.5px] font-mono" style={{ color: isSelected ? 'rgba(52,211,153,0.9)' : isToday ? 'oklch(from var(--foreground) l c h / 0.65)' : 'oklch(from var(--foreground) l c h / 0.22)' }}>{date.getDate()}/{date.getMonth()+1}</div>
              )}
              <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-card border border-foreground/10 rounded px-2 py-1.5 text-[9px] whitespace-nowrap z-10 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg">
                <div className="font-mono text-muted-foreground text-[8px] mb-1">{day.date}{isToday ? ' — TODAY' : ''}{isSelected ? ' — FILTERED' : ''}</div>
                <div className="text-foreground font-semibold">{day.count} signals</div>
                {day.negative > 0 && <div className="text-red-400/80 text-[8px]">{day.negative} hostile</div>}
                {day.positive > 0 && <div className="text-green-400/80 text-[8px]">{day.positive} positive</div>}
                {isPeak && <div className="text-yellow-400/70 text-[8px] mt-0.5">▲ PEAK DAY</div>}
                <div className="text-emerald-400/60 text-[8px] mt-0.5">{isSelected ? '✕ Click to clear filter' : '▸ Click to filter graph'}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Edge type styling ────────────────────────────────────────────────────────
const EDGE_STYLES: Record<string, { color: string; dashes: boolean; width: number }> = {
  'published':     { color: 'var(--intel-yellow)', dashes: false, width: 1.5 },
  'authored':      { color: '#a78bfa', dashes: false, width: 1.5 },
  'covers':        { color: '#10b981', dashes: false, width: 1.0 },
  'mentions':      { color: '#22d3ee', dashes: true,  width: 1.0 },
  'mentioned in':  { color: '#f472b6', dashes: false, width: 1.0 },
  'referenced in': { color: '#fb923c', dashes: false, width: 1.0 },
  'tagged':        { color: '#6b7280', dashes: true,  width: 0.8 },
};

// ─── vis-network Graph ────────────────────────────────────────────────────────
function VisNetworkGraph({ nodes, edges, onNodeClick, onNodeDoubleClick, selectedNodeId, graphFilter, showConnectionsOnly, networkRef: externalNetworkRef, primaryNodeId, activeLinkType, bipartiteColMeta, bipartiteData }: {
  nodes: any[]; edges: any[]; onNodeClick: (n: any) => void;
  onNodeDoubleClick?: (n: any) => void;
  selectedNodeId: string | null; graphFilter: string[];
  showConnectionsOnly?: boolean;
  networkRef?: React.MutableRefObject<any>;
  primaryNodeId?: string | null;
  activeLinkType?: string | null;
  bipartiteColMeta?: Array<{ type: string; x: number; count: number }>;
  bipartiteData?: { leftNodes: any[]; rightNodes: any[]; edges: any[] } | null;
}) {
  // Use a ref to the container div so React never needs to look up by ID.
  // The container div uses suppressHydrationWarning + ref so React leaves its
  // children alone after mount — vis-network injects canvas/style/tooltip nodes
  // directly into the container, which would otherwise cause removeChild crashes.
  const containerRef = useRef<HTMLDivElement>(null);
  const networkRef = useRef<any>(null);
  const visNodesRef = useRef<any>(null);
  const visEdgesRef = useRef<any>(null);
  // Refs for values used in the beforeDrawing closure — always up-to-date without remounting
  const bipartiteColMetaRef = useRef<Array<{ type: string; x: number; count: number }>>([]);
  const activeLinkTypeRef = useRef<string | null>(null);
  // Keep refs in sync with props
  bipartiteColMetaRef.current = bipartiteColMeta ?? [];
  activeLinkTypeRef.current = activeLinkType ?? null;

  // When bipartite mode is active, use pre-computed bipartiteData (virtual duplicate nodes)
  const filteredNodes = useMemo(() => {
    if (bipartiteData) {
      // Merge left and right nodes (both sides), each with __LEFT/__RIGHT suffix IDs
      return [...bipartiteData.leftNodes, ...bipartiteData.rightNodes];
    }
    return graphFilter.length === 0 ? nodes : nodes.filter(n => graphFilter.includes(n.type));
  }, [nodes, graphFilter, bipartiteData]);
  const filteredNodeIds = useMemo(() => new Set(filteredNodes.map(n => n.id)), [filteredNodes]);
  const filteredEdges = useMemo(() => {
    if (bipartiteData) {
      return bipartiteData.edges;
    }
    const baseEdges = edges.filter(e => filteredNodeIds.has(e.from) && filteredNodeIds.has(e.to));
    // When showConnectionsOnly is active with 2+ filters, only show edges between filtered node types
    if (showConnectionsOnly && graphFilter.length >= 2) {
      const filteredTypeIds = new Set(nodes.filter(n => graphFilter.includes(n.type)).map(n => n.id));
      return baseEdges.filter(e => filteredTypeIds.has(e.from) && filteredTypeIds.has(e.to));
    }
    return baseEdges;
  }, [edges, filteredNodeIds, showConnectionsOnly, graphFilter, nodes, bipartiteData]);

  // Stable key: count + first 5 ids (avoids huge string join)
  // Structural key: first 5 node IDs — changes when the query/filter changes (full remount needed)
  // Does NOT change when a cluster is expanded (only adds more nodes to the same graph)
  const structuralKey = filteredNodes.slice(0, 5).map(n => n.id).join(',');
  const edgeKey = filteredEdges.length;
  // mountId forces a full DOM remount of the container when data changes,
  // preventing the removeChild crash caused by vis-network's canvas injection
  const [mountId, setMountId] = useState(0);
  const prevStructuralKey = useRef('');
  const prevNodeIds = useRef(new Set<string>());
  const prevEdgeIds = useRef(new Set<string>());
  useEffect(() => {
    // Full remount only when the structural key changes (new query, new filter, new region)
    if (structuralKey !== prevStructuralKey.current) {
      prevStructuralKey.current = structuralKey;
      prevNodeIds.current = new Set(filteredNodes.map(n => String(n.id)));
      prevEdgeIds.current = new Set(filteredEdges.map(e => String(e.id)));
      setMountId(m => m + 1);
      return;
    }
    // Incremental update: cluster expansion added new nodes/edges — add them directly to DataSet
    if (visNodesRef.current && visEdgesRef.current) {
      const newNodes = filteredNodes.filter(n => !prevNodeIds.current.has(String(n.id)));
      const removedNodeIds = Array.from(prevNodeIds.current).filter(id => !filteredNodes.find(n => String(n.id) === id));
      const newEdges = filteredEdges.filter(e => !prevEdgeIds.current.has(String(e.id)));
      const removedEdgeIds = Array.from(prevEdgeIds.current).filter(id => !filteredEdges.find(e => String(e.id) === id));

      if (removedNodeIds.length > 0) visNodesRef.current.remove(removedNodeIds);
      if (removedEdgeIds.length > 0) visEdgesRef.current.remove(removedEdgeIds);
      if (newNodes.length > 0) {
        // Position new article nodes radially around their parent cluster hub
        const articleNodes = newNodes.filter(n => n.type === 'article');
        const nonArticleNodes = newNodes.filter(n => n.type !== 'article');
        // Group article nodes by their agency (parent cluster)
        const byAgency = new Map<string, typeof articleNodes>();
        for (const n of articleNodes) {
          const agencyId = String(n._agencyId ?? n._parentId ?? 'unknown');
          if (!byAgency.has(agencyId)) byAgency.set(agencyId, []);
          byAgency.get(agencyId)!.push(n);
        }
        const positionedArticleNodes: any[] = [];
        for (const [agencyId, articles] of Array.from(byAgency.entries())) {
          // Get the current position of the parent cluster node
          let hubX = 0, hubY = 0;
          try {
            const pos = networkRef.current?.getPosition(agencyId);
            if (pos) { hubX = pos.x; hubY = pos.y; }
          } catch (_) {}
          const radius = 120 + articles.length * 8;
          articles.forEach((n, i) => {
            const angle = (2 * Math.PI * i) / articles.length;
            positionedArticleNodes.push({
              ...buildVisNode(n, false),
              x: hubX + radius * Math.cos(angle),
              y: hubY + radius * Math.sin(angle),
            });
          });
        }
        visNodesRef.current.add([
          ...nonArticleNodes.map(n => buildVisNode(n, false)),
          ...positionedArticleNodes,
        ]);
      }
      if (newEdges.length > 0) {
        visEdgesRef.current.add(newEdges.map((e: any) => ({
          id: e.id, from: e.from, to: e.to,
          ...(EDGE_STYLES[e.type as keyof typeof EDGE_STYLES] ?? EDGE_STYLES.default),
          title: e.label,
        })));
      }

      prevNodeIds.current = new Set(filteredNodes.map(n => String(n.id)));
      prevEdgeIds.current = new Set(filteredEdges.map(e => String(e.id)));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [structuralKey, filteredNodes.length, edgeKey]);

  // Build vis node object
  const buildVisNode = (n: any, isSelected: boolean) => {
    const style = NODE_STYLES[n.type] ?? NODE_STYLES.keyword;
    const isArticle = n.type === 'article';
    const topicColor = isArticle && Array.isArray(n.topics) && n.topics[0]
      ? TOPIC_COLORS[n.topics[0]] : null;
    const nodeColor = topicColor ?? style.color;
    const isPrimary = primaryNodeId != null && n.id === primaryNodeId;
    // Article nodes get shorter labels (they are dense in cluster expansions)
    const maxLabelLen = isArticle ? 18 : 26;
    const label = String(n.label ?? '').length > maxLabelLen
      ? String(n.label ?? '').substring(0, maxLabelLen - 2) + '…'
      : String(n.label ?? '');

    // Rich tooltip as DOM element (vis-network renders HTML strings as plain text; must use DOM element)
    // All styles are inline to override vis-tooltip CSS class
    const tooltipEl = document.createElement('div');
    tooltipEl.style.cssText = [
      'font-family:"JetBrains Mono","Courier New",monospace',
      'font-size:9px',
      'width:220px',
      'max-width:220px',
      'min-width:0',
      'padding:7px 9px',
      `background:#060b12`,
      `border:1px solid ${nodeColor}50`,
      `border-left:2px solid ${nodeColor}`,
      'border-radius:4px',
      'color:#94a3b8',
      'pointer-events:none',
      'box-shadow:0 6px 24px oklch(from var(--foreground) l c h / 0.3),0 0 12px oklch(from var(--foreground) l c h / 0.15)',
      'line-height:1.45',
      'letter-spacing:0.02em',
      'z-index:9999',
      'overflow:hidden',
      'word-break:break-word',
      'overflow-wrap:break-word',
      'white-space:normal',
      'box-sizing:border-box',
    ].join(';');

    // Type badge row
    const headerRow = document.createElement('div');
    headerRow.style.cssText = 'display:flex;align-items:center;gap:5px;margin-bottom:5px';
    const typeBadge = document.createElement('span');
    typeBadge.style.cssText = `font-size:8px;font-weight:700;color:${nodeColor};text-transform:uppercase;letter-spacing:0.1em;background:${nodeColor}18;padding:1px 5px;border-radius:2px;border:1px solid ${nodeColor}30`;
    typeBadge.textContent = n.type ?? '';
    headerRow.appendChild(typeBadge);
    tooltipEl.appendChild(headerRow);

    // Label
    const labelEl = document.createElement('div');
    labelEl.style.cssText = 'font-weight:700;color:#e2e8f0;font-size:10px;line-height:1.3;margin-bottom:4px;font-family:"Inter",sans-serif;letter-spacing:-0.01em;word-break:break-word;overflow-wrap:break-word;white-space:normal';
    labelEl.textContent = String(n.label ?? '').substring(0, 72);
    tooltipEl.appendChild(labelEl);

    if (n.type === 'article' && n.summary) {
      const sumEl = document.createElement('div');
      sumEl.style.cssText = 'color:#64748b;font-size:9px;line-height:1.4;margin-bottom:4px;border-top:1px solid rgba(255,255,255,.06);padding-top:4px;font-family:"Inter",sans-serif;word-break:break-word;overflow-wrap:break-word;white-space:normal';
      sumEl.textContent = String(n.summary ?? '').substring(0, 100) + '…';
      tooltipEl.appendChild(sumEl);
    }

    // Meta row: sentiment + country
    if ((n.type === 'article' && n.sentiment) || n.country) {
      const metaRow = document.createElement('div');
      metaRow.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap';
      if (n.type === 'article' && n.sentiment) {
        const sentColor = n.sentiment === 'negative' ? '#f87171' : n.sentiment === 'positive' ? '#4ade80' : '#fbbf24';
        const sentEl = document.createElement('span');
        sentEl.style.cssText = `font-size:8px;color:${sentColor};font-weight:700;text-transform:uppercase;letter-spacing:0.08em`;
        sentEl.textContent = '▸ ' + n.sentiment;
        metaRow.appendChild(sentEl);
      }
      if (n.country) {
        const cntEl = document.createElement('span');
        cntEl.style.cssText = 'font-size:8px;color:#475569;letter-spacing:0.04em';
        cntEl.textContent = '◎ ' + n.country;
        metaRow.appendChild(cntEl);
      }
      tooltipEl.appendChild(metaRow);
    }

    if (n.type === 'agency' && n.bias) {
      const biasEl = document.createElement('div');
      biasEl.style.cssText = 'font-size:8px;color:#475569;margin-top:3px;letter-spacing:0.04em';
      biasEl.textContent = 'BIAS: ' + String(n.bias).toUpperCase();
      tooltipEl.appendChild(biasEl);
    }

    // Primary node: the search query entity — larger, brighter, distinct star-shaped glow
    const effectiveSize = isPrimary ? style.size * 2.2 : isSelected ? style.size * 1.5 : style.size;
    const primaryBg = isPrimary ? `${nodeColor}66` : (isSelected ? `${nodeColor}44` : `${nodeColor}18`);
    const primaryBorder = isPrimary ? '#ffffff' : (isSelected ? '#ffffff' : nodeColor);
    const primaryShadowSize = isPrimary ? 28 : (isSelected ? 14 : 6);
    const primaryShadowColor = isPrimary ? `${nodeColor}cc` : `${nodeColor}55`;

    // Bipartite mode: enhanced label visibility — larger font, heavier stroke, dual-node indicator
    const isBipartiteNode = n._x !== undefined;
    const isDualNode = isBipartiteNode && n._isDual;
    // Truncate label slightly shorter in bipartite mode to avoid overlap
    const bipartiteLabel = isBipartiteNode
      ? (isDualNode ? '⇄ ' : '') + (String(n.label ?? '').length > 22 ? String(n.label ?? '').substring(0, 20) + '…' : String(n.label ?? ''))
      : label;

    return {
      id: n.id,
      label: isBipartiteNode ? bipartiteLabel : (isPrimary ? label : label),
      title: tooltipEl, // DOM element passed directly to vis-network
      shape: isPrimary ? 'star' : style.shape,
      size: effectiveSize,
      color: {
        background: isBipartiteNode ? `${nodeColor}30` : primaryBg,
        border: isBipartiteNode ? (isDualNode ? '#ffffff' : nodeColor) : primaryBorder,
        highlight: { background: `${nodeColor}77`, border: '#ffffff' },
        hover: { background: `${nodeColor}44`, border: nodeColor },
      },
      font: {
        color: isBipartiteNode ? '#ffffff' : (isPrimary ? '#ffffff' : (isSelected ? '#ffffff' : '#e2e8f0')),
        size: isBipartiteNode ? 13 : (isPrimary ? 13 : (isArticle ? 11 : 10)),
        face: 'Inter, sans-serif',
        // Heavier stroke in bipartite mode so labels pop against the colored zone panels
        strokeWidth: isBipartiteNode ? 5 : (isPrimary ? 4 : 3),
        strokeColor: '#060b12',
        bold: (isBipartiteNode || isPrimary || isSelected) ? '700 13px Inter' : undefined,
        vadjust: isBipartiteNode ? 0 : undefined,
      },
      borderWidth: isBipartiteNode ? (isDualNode ? 3 : 2) : (isPrimary ? 4 : (isSelected ? 3 : 1.5)),
      borderWidthSelected: 4,
      shadow: { enabled: true, color: isBipartiteNode ? `${nodeColor}88` : primaryShadowColor, size: isBipartiteNode ? 12 : primaryShadowSize, x: 0, y: 2 },
      _data: n,
      // Store isPrimary flag for use in event handlers
      _isPrimary: isPrimary,
      // Bipartite: embed x/y so vis-network respects positions when physics is disabled
      ...(n._x !== undefined ? { x: n._x, y: n._y } : {}),
    };
  };

  // Build vis edge object
  // In bipartite mode, edges are pre-bundled with curvedCW/curvedCCW smooth types
  // to create a fan effect for high-degree source nodes.
  const buildVisEdge = (e: any, i: number, totalEdgesFromSameSource?: number, edgeIndexFromSource?: number) => {
    const es = EDGE_STYLES[e.label] ?? { color: 'oklch(from var(--foreground) l c h / 0.12)', dashes: false, width: 1 };
    const isBipartiteEdge = e.id?.toString().startsWith('bip_');

    // Fan bundling: spread edges from the same source using alternating CW/CCW curves
    // with roundness proportional to the edge index within the source's fan
    let smoothConfig: any = { enabled: true, type: 'dynamic', roundness: 0.25 };
    if (isBipartiteEdge && totalEdgesFromSameSource != null && totalEdgesFromSameSource > 1) {
      const idx = edgeIndexFromSource ?? 0;
      const total = totalEdgesFromSameSource;
      // Spread roundness from -0.5 to +0.5 across all edges from this source
      const spread = total <= 2 ? 0.35 : Math.min(0.55, 0.15 + (total * 0.06));
      const step = total > 1 ? (spread * 2) / (total - 1) : 0;
      const roundness = -spread + idx * step;
      // Alternate between CW and CCW for visual clarity
      const curveType = roundness >= 0 ? 'curvedCW' : 'curvedCCW';
      smoothConfig = { enabled: true, type: curveType, roundness: Math.abs(roundness) + 0.05 };
    } else if (isBipartiteEdge) {
      // Single edge from source: gentle horizontal curve
      smoothConfig = { enabled: true, type: 'curvedCW', roundness: 0.1 };
    }

    return {
      id: `e-${i}`,
      from: e.from,
      to: e.to,
      label: isBipartiteEdge ? '' : (e.label || ''), // Hide labels in bipartite to reduce clutter
      color: {
        color: isBipartiteEdge ? es.color + '70' : es.color + '55',
        highlight: es.color + 'cc',
        hover: es.color + 'bb',
        opacity: isBipartiteEdge ? 0.85 : 0.7,
      },
      width: isBipartiteEdge ? Math.max(es.width, 1.2) : es.width,
      dashes: es.dashes,
      arrows: { to: { enabled: true, scaleFactor: isBipartiteEdge ? 0.45 : 0.35, type: 'arrow' } },
      font: { color: es.color + 'aa', size: 7, face: 'JetBrains Mono, monospace', strokeWidth: 0, align: 'middle' },
      smooth: smoothConfig,
      selectionWidth: 3,
    };
  };

  // Initial graph build — triggered by mountId which changes when nodeKey/edgeKey change.
  // Using mountId (not nodeKey/edgeKey directly) ensures the container div is fully
  // remounted (via key prop) before vis-network initializes, preventing removeChild crashes.
  useEffect(() => {
    if (!filteredNodes.length || !containerRef.current) return;
    let cancelled = false;
    let timerId: ReturnType<typeof setTimeout>;

    // Destroy any existing network synchronously first
    if (networkRef.current) {
      try { networkRef.current.destroy(); } catch (_) {}
      networkRef.current = null;
      if (externalNetworkRef) externalNetworkRef.current = null;
    }
    visNodesRef.current = null;
    visEdgesRef.current = null;

    // Use setTimeout(0) to let the DOM fully settle after the key-based remount
    timerId = setTimeout(() => {
      import('vis-network/standalone').then(({ Network, DataSet }) => {
        const el = containerRef.current;
        if (cancelled || !el) return;

        const isBipartiteMode = bipartiteData != null;

        const visNodes = new DataSet(
          filteredNodes.map(n => buildVisNode(n, selectedNodeId === n.id))
        );

        // Pre-compute per-source edge counts for fan bundling in bipartite mode
        const sourceEdgeCounts = new Map<string, number>();
        const sourceEdgeIndex = new Map<string, number>();
        if (isBipartiteMode) {
          filteredEdges.forEach(e => {
            const key = String(e.from);
            sourceEdgeCounts.set(key, (sourceEdgeCounts.get(key) ?? 0) + 1);
          });
        }
        const visEdges = new DataSet(
          filteredEdges.map((e, i) => {
            if (isBipartiteMode) {
              const key = String(e.from);
              const total = sourceEdgeCounts.get(key) ?? 1;
              const idx = sourceEdgeIndex.get(key) ?? 0;
              sourceEdgeIndex.set(key, idx + 1);
              return buildVisEdge(e, i, total, idx);
            }
            return buildVisEdge(e, i);
          })
        );

        visNodesRef.current = visNodes;
        visEdgesRef.current = visEdges;

        const network = new Network(
          el,
          { nodes: visNodes, edges: visEdges },
          {
            nodes: { borderWidth: 1.5, borderWidthSelected: 3 },
            edges: { selectionWidth: 2.5 },
            physics: isBipartiteMode ? { enabled: false } : {
              enabled: true,
              barnesHut: {
                gravitationalConstant: -8000,
                centralGravity: 0.25,
                springLength: 140,
                springConstant: 0.035,
                damping: 0.1,
                avoidOverlap: 0.3,
              },
              stabilization: { iterations: 250, updateInterval: 20, fit: true },
            },
            interaction: {
              hover: true,
              tooltipDelay: 150,
              zoomView: true,
              dragView: true,
              navigationButtons: false,
              keyboard: { enabled: true, speed: { x: 10, y: 10, zoom: 0.02 } },
              multiselect: false,
              selectConnectedEdges: true,
            },
            layout: { improvedLayout: filteredNodes.length < 200 },
          }
        );
        networkRef.current = network;
        if (externalNetworkRef) externalNetworkRef.current = network;

        // Click: select node or deselect
        network.on('click', (params: any) => {
          if (params.nodes.length > 0) {
            const nodeData = (visNodes.get(params.nodes[0]) as any)?._data;
            if (nodeData) onNodeClick(nodeData);
          } else {
            onNodeClick(null);
          }
        });

        // Double-click: expand cluster or zoom to node
        network.on('doubleClick', (params: any) => {
          if (params.nodes.length > 0) {
            const nodeData = (visNodes.get(params.nodes[0]) as any)?._data;
            if (nodeData && onNodeDoubleClick) {
              onNodeDoubleClick(nodeData);
            }
            // Always zoom to the node on double-click
            network.focus(params.nodes[0], { scale: 1.5, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
          }
        });

        // Highlight connected nodes on hover
        network.on('hoverNode', (params: any) => {
          const connectedNodes = network.getConnectedNodes(params.node) as string[];
          const allNodeIds = visNodes.getIds() as string[];
          allNodeIds.forEach((id: string) => {
            const n = (visNodes.get(id) as any)?._data;
            if (!n) return;
            const isConnected = id === params.node || connectedNodes.includes(id);
            const style = NODE_STYLES[n.type] ?? NODE_STYLES.keyword;
            const isArticle = n.type === 'article';
            const topicColor = isArticle && Array.isArray(n.topics) && n.topics[0] ? TOPIC_COLORS[n.topics[0]] : null;
            const nodeColor = topicColor ?? style.color;
            visNodes.update({
              id,
              color: {
                background: isConnected ? `${nodeColor}44` : `${nodeColor}08`,
                border: isConnected ? nodeColor : `${nodeColor}33`,
                highlight: { background: `${nodeColor}55`, border: '#ffffff' },
                hover: { background: `${nodeColor}33`, border: nodeColor },
              },
              font: { color: isConnected ? '#ffffff' : '#94a3b8' },
            });
          });
        });

        network.on('blurNode', () => {
          const allNodeIds = visNodes.getIds() as string[];
          allNodeIds.forEach((id: string) => {
            const n = (visNodes.get(id) as any)?._data;
            if (!n) return;
            const isSelected = selectedNodeId === id;
            visNodes.update(buildVisNode(n, isSelected));
          });
        });

        // In bipartite mode: physics is already disabled, nodes have x/y — just fit immediately
        if (isBipartiteMode) {
          setTimeout(() => {
            try { network.fit({ animation: { duration: 700, easingFunction: 'easeInOutQuad' } }); } catch (_) {}
          }, 80);
        }
        network.on('stabilizationIterationsDone', () => {
          network.setOptions({ physics: { enabled: false } });
          // If there's a primary node, center on it first then fit
          if (primaryNodeId) {
            network.focus(primaryNodeId, { scale: 0.85, animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
            setTimeout(() => {
              network.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
            }, 600);
          } else {
            network.fit({ animation: { duration: 700, easingFunction: 'easeInOutQuad' } });
          }
        });

        // Draw column zone bands behind nodes when bipartite mode is active
        // Uses refs so the closure always reads the latest values without remounting
        network.on('beforeDrawing', (ctx: CanvasRenderingContext2D) => {
          const colMeta = bipartiteColMetaRef.current;
          const linkType = activeLinkTypeRef.current;
          if (!colMeta || colMeta.length === 0) return;

          // TRUE BIPARTITE: two solid panels — SOURCE (left) and TARGET (right)
          // The zone half-width is fixed at 600 units (matches leftX=-700, rightX=700 layout)
          const zoneHalfWidth = 600;
          const edgeColor = EDGE_STYLES[linkType ?? '']?.color ?? '#f472b6';

          colMeta.forEach((col) => {
            const isSource = col.type === 'SOURCE';
            const baseColor = isSource ? edgeColor : '#22d3ee';

            // Solid background panel
            ctx.save();
            ctx.globalAlpha = 0.10;
            ctx.fillStyle = baseColor;
            ctx.fillRect(col.x - zoneHalfWidth, -9000, zoneHalfWidth * 2, 18000);
            ctx.restore();

            // Strong solid border lines on the inner edge (center divider side)
            ctx.save();
            ctx.globalAlpha = 0.55;
            ctx.strokeStyle = baseColor;
            ctx.lineWidth = 2;
            ctx.setLineDash([]);
            // Inner border (facing center)
            const innerX = isSource ? col.x + zoneHalfWidth : col.x - zoneHalfWidth;
            ctx.beginPath();
            ctx.moveTo(innerX, -9000);
            ctx.lineTo(innerX, 9000);
            ctx.stroke();
            ctx.restore();

            // Center divider line (between the two panels)
            if (isSource) {
              ctx.save();
              ctx.globalAlpha = 0.20;
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 1;
              ctx.setLineDash([6, 8]);
              ctx.beginPath();
              ctx.moveTo(0, -9000);
              ctx.lineTo(0, 9000);
              ctx.stroke();
              ctx.setLineDash([]);
              ctx.restore();
            }

            // Column header label — large and bold
            ctx.save();
            ctx.globalAlpha = 0.90;
            ctx.fillStyle = baseColor;
            ctx.font = 'bold 16px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            const headerText = isSource ? '◀ SOURCE' : 'TARGET ▶';
            ctx.fillText(headerText, col.x, -420);
            // Sub-label: link type + count
            ctx.font = '10px "JetBrains Mono", monospace';
            ctx.globalAlpha = 0.55;
            ctx.fillText(`${col.count} node${col.count !== 1 ? 's' : ''}`, col.x, -395);
            if (isSource && linkType) {
              ctx.globalAlpha = 0.40;
              ctx.font = '9px "JetBrains Mono", monospace';
              ctx.fillText(`— ${linkType} —`, 0, -395);
            }
            ctx.restore();
          });
        });
      }); // end import().then()
    }, 0); // end setTimeout

    return () => {
      cancelled = true;
      clearTimeout(timerId);
      if (networkRef.current) { try { networkRef.current.destroy(); } catch (_) {} networkRef.current = null; }
      if (externalNetworkRef) externalNetworkRef.current = null;
      visNodesRef.current = null;
      visEdgesRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountId]);

  // Redraw canvas when bipartite column metadata changes (zone bands need to update)
  useEffect(() => {
    if (networkRef.current) {
      try { networkRef.current.redraw(); } catch (_) {}
    }
  }, [bipartiteColMeta, activeLinkType]);

  // Update selected node highlight without rebuilding the whole graph
  useEffect(() => {
    if (!visNodesRef.current || !filteredNodes.length) return;
    filteredNodes.forEach(n => {
      try {
        visNodesRef.current.update(buildVisNode(n, selectedNodeId === n.id));
      } catch (_) {}
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNodeId]);

  if (!filteredNodes.length) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-4">
          <Network size={44} className="mx-auto text-primary opacity-20" />
          <div className="text-sm font-semibold text-muted-foreground">Search to build the entity network</div>
          <div className="text-xs text-muted-foreground/50">Enter a topic, entity, country, or keyword above</div>
          <div className="flex flex-wrap justify-center gap-2 mt-2">
            {['Iran nuclear', 'Gaza conflict', 'Saudi Arabia', 'Ukraine war'].map(q => (
              <button key={q} onClick={() => onNodeClick({ _quickSearch: q })}
                className="text-[10px] px-2.5 py-1 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-all">
                {q}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  // The wrapper div is React-managed for sizing only.
  // The inner div (containerId) is NOT a React child — it is mounted by vis-network directly.
  // This prevents React's reconciler from crashing when vis-network injects canvas/style nodes.
  return (
    <div className="w-full h-full" style={{ background: 'transparent' }}>
      {/* key={mountId} forces a full DOM remount when data changes, preventing
          vis-network's removeChild crash from React reconciler conflicts */}
      <div
        key={mountId}
        ref={containerRef}
        suppressHydrationWarning
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      />
    </div>
  );
}

// ─── Entity Section ───────────────────────────────────────────────────────────
function EntitySection({ title, icon, color, children, defaultExpanded = true }: {
  title: string; icon: React.ReactNode; color: string; children: React.ReactNode; defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div>
      <button className="flex items-center gap-1.5 mb-1.5 w-full group" onClick={() => setExpanded(!expanded)}>
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>{title}</span>
        <span className="ml-auto text-muted-foreground group-hover:text-foreground transition-colors">
          {expanded ? <ChevronUp size={10}/> : <ChevronDown size={10}/>}
        </span>
      </button>
      {expanded && <div className="space-y-0.5">{children}</div>}
    </div>
  );
}

function EntityRow({ label, count, type, onClick, onFocus }: {
  label: string; count: number; type: string; onClick: () => void; onFocus?: () => void;
}) {
  const style = NODE_STYLES[type] ?? NODE_STYLES.keyword;
  return (
    <div className="flex items-center gap-2 px-1.5 py-1 rounded hover:bg-muted/30 group transition-all cursor-pointer" onClick={onClick}>
      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: style.color }}/>
      <span className="text-[11px] text-foreground flex-1 truncate group-hover:text-primary transition-colors">{label}</span>
      <span className="text-[9px] font-bold font-mono flex-shrink-0" style={{ color: style.color }}>{count}</span>
      {onFocus && (
        <button onClick={e => { e.stopPropagation(); onFocus(); }}
          className="text-[9px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
          title="Focus in graph">
          <Eye size={9}/>
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface ExploreTabProps {
  region: string;
  initialQuery?: string;
  onQueryUsed?: () => void;
}

export default function ExploreTab({ region, initialQuery, onQueryUsed }: ExploreTabProps) {
  const [searchInput, setSearchInput] = useState(initialQuery ?? "");
  const [activeSearch, setActiveSearch] = useState(initialQuery ?? "");
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [deepDiveNode, setDeepDiveNode] = useState<{ name: string; type: string } | null>(null);
  const [rightPanel, setRightPanel] = useState<'entities'|'geo'|'topics'>('entities');
  const [graphFilter, setGraphFilter] = useState<string[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showSavedList, setShowSavedList] = useState(false);
  const [graphView, setGraphView] = useState<'network' | 'tree' | '3d'>('network');
  const [timelineCollapsed, setTimelineCollapsed] = useState(true);
  const [timelineSummary, setTimelineSummary] = useState<{ total: number; hostile: number; positive: number; peak: string | null; peakCount: number } | null>(null);
  const [showConnectionsOnly, setShowConnectionsOnly] = useState(false);
  const [isOrganized, setIsOrganized] = useState(false);
  const [loadKey, setLoadKey] = useState(0);
  const [timelineDate, setTimelineDate] = useState<string | null>(null);
  const [activeLinkType, setActiveLinkType] = useState<string | null>(null);
  const [isBipartite, setIsBipartite] = useState(false);
  const [bipartiteColMeta, setBipartiteColMeta] = useState<Array<{ type: string; x: number; count: number }>>([]);
  const [bipartiteData, setBipartiteData] = useState<{ leftNodes: any[]; rightNodes: any[]; edges: any[] } | null>(null);
  const [linkTypesExpanded, setLinkTypesExpanded] = useState(false);
  const [nodeFilterCollapsed, setNodeFilterCollapsed] = useState(false);
  const [timeWindowCollapsed, setTimeWindowCollapsed] = useState(false);
  const [rightPanelVisible, setRightPanelVisible] = useState(true);
  const [rightPanelWidth, setRightPanelWidth] = useState(288); // 288px = w-72 default
  const rightPanelDragRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const externalNetworkRef = useRef<any>(null);
  // Ref to the 3D graph API (highlightNodeByLabel) — populated once the 3D scene is ready
  const graph3dApiRef = useRef<{ highlightNodeByLabel: (label: string) => void } | null>(null);

  // ── Graph time window & Load More state ──────────────────────────────────────
  // '3d' = default (last 3 days), '7d', '14d', '30d', 'all' = no time filter
  const GRAPH_TIME_WINDOWS = [
    { label: '3D', value: '3d', hours: 72, desc: 'Last 3 days' },
    { label: '7D', value: '7d', hours: 168, desc: 'Last 7 days' },
    { label: '14D', value: '14d', hours: 336, desc: 'Last 14 days' },
    { label: '30D', value: '30d', hours: 720, desc: 'Last 30 days' },
    { label: 'ALL', value: 'all', hours: null, desc: 'All data — may crash browser' },
  ] as const;
  const [graphTimeWindow, setGraphTimeWindow] = useState<'3d'|'7d'|'14d'|'30d'|'all'>('3d');
  const [showAllDataWarning, setShowAllDataWarning] = useState(false);
  const [pendingTimeWindow, setPendingTimeWindow] = useState<'3d'|'7d'|'14d'|'30d'|'all'|null>(null);
  const [graphOffset, setGraphOffset] = useState(0);
  const GRAPH_PAGE_SIZE = 500;
  // Accumulated graph data across Load More pages
  const [accumulatedGraphData, setAccumulatedGraphData] = useState<{ nodes: any[]; edges: any[]; totalArticles: number } | null>(null);

  // ── Cluster mode state ────────────────────────────────────────────────────────
  // clusterMode: 'cluster' = default (agency clusters), 'signal' = full article nodes
  const [clusterMode, setClusterMode] = useState<'cluster' | 'signal'>('cluster');
  // Set of agency node IDs that are currently expanded (showing their article children)
  const [expandedAgencies, setExpandedAgencies] = useState<Set<string>>(new Set());

  // Compute the `since` date for the graph query from the current time window
  const graphSince = useMemo(() => {
    const tw = GRAPH_TIME_WINDOWS.find(t => t.value === graphTimeWindow);
    if (!tw || tw.hours === null) return undefined; // 'all' = no filter
    return new Date(Date.now() - tw.hours * 60 * 60 * 1000);
  }, [graphTimeWindow]);

  // Radial "organize around entity" layout
  // Centers the selected/focused entity, places its direct neighbors in an inner ring,
  // and all other nodes in an outer ring.
  const handleOrganize = () => {
    const net = externalNetworkRef.current;
    if (!net) return;
    const allIds: string[] = net.body.nodeIndices;
    if (!allIds.length) return;

    // Pick center node: selected node, or the first article/entity node
    const centerId = selectedNode?.id ?? allIds[0];

    // Get direct neighbors of the center node
    const directNeighbors = new Set<string>(net.getConnectedNodes(centerId) as string[]);

    // Separate into rings
    const innerRing = allIds.filter((id: string) => directNeighbors.has(id));
    const outerRing = allIds.filter((id: string) => id !== centerId && !directNeighbors.has(id));

    const innerRadius = Math.max(160, innerRing.length * 22);
    const outerRadius = Math.max(innerRadius + 160, outerRing.length * 16 + innerRadius);

    // Center node at origin
    net.moveNode(centerId, 0, 0);

    // Inner ring: direct connections
    innerRing.forEach((id: string, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(innerRing.length, 1);
      net.moveNode(id, Math.cos(angle) * innerRadius, Math.sin(angle) * innerRadius);
    });

    // Outer ring: all other nodes
    outerRing.forEach((id: string, i: number) => {
      const angle = (2 * Math.PI * i) / Math.max(outerRing.length, 1);
      net.moveNode(id, Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
    });

    net.setOptions({ physics: { enabled: false } });
    // Focus on center node first, then fit the whole graph
    net.focus(centerId, { scale: 0.9, animation: { duration: 400, easingFunction: 'easeInOutQuad' } });
    setTimeout(() => {
      net.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    }, 450);
    setIsOrganized(true);
  };

  // De-organize: restore physics simulation
  const handleDeorganize = () => {
    const net = externalNetworkRef.current;
    if (!net) return;
    net.setOptions({ physics: { enabled: true } });
    net.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
    setIsOrganized(false);
  };

  // Semantic multi-lane layout: source nodes in center, target nodes grouped by node type
  // in separate right-side columns. Each node appears exactly once.
  // Columns are sorted by connection degree (most-connected at top).
  // TRUE BIPARTITE LAYOUT: two clean sides (LEFT = sources, RIGHT = targets)
  // If a node is BOTH source and target, it appears on BOTH sides as a virtual duplicate.
  // Virtual nodes use IDs: originalId + '__LEFT' or originalId + '__RIGHT'
  // Edges connect sourceId__LEFT -> targetId__RIGHT
  const handleBipartiteLayout = (linkType: string) => {
    const allEdges: any[] = renderGraphData?.edges ?? [];
    const allNodes: any[] = renderGraphData?.nodes ?? [];
    const matchingEdges = allEdges.filter(e => e.label === linkType);
    if (!matchingEdges.length) return;

    // Build unique source and target ID sets
    const sourceIds = new Set<string>(matchingEdges.map(e => String(e.from)));
    const targetIds = new Set<string>(matchingEdges.map(e => String(e.to)));
    const nodeById = new Map<string, any>(allNodes.map(n => [String(n.id), n]));

    // Sort source nodes by out-degree (most connections first)
    const sourceList = Array.from(sourceIds).sort((a, b) => {
      const da = matchingEdges.filter(e => String(e.from) === a).length;
      const db = matchingEdges.filter(e => String(e.from) === b).length;
      return db - da;
    });
    // Sort target nodes by in-degree
    const targetList = Array.from(targetIds).sort((a, b) => {
      const da = matchingEdges.filter(e => String(e.to) === a).length;
      const db = matchingEdges.filter(e => String(e.to) === b).length;
      return db - da;
    });

    // Adaptive vertical spacing based on the larger column
    const maxLen = Math.max(sourceList.length, targetList.length);
    const spacing = Math.max(38, Math.min(85, 2400 / Math.max(maxLen, 1)));
    const leftX = -700;
    const rightX = 700;

    // Build virtual LEFT nodes (sources)
    const leftNodes: any[] = sourceList.map((id, i) => {
      const orig = nodeById.get(id) ?? { id, label: id, type: 'unknown' };
      const isDual = targetIds.has(id); // also appears on right
      return {
        ...orig,
        id: id + '__LEFT',
        _originalId: id,
        _side: 'left',
        _isDual: isDual,
        _x: leftX,
        _y: -(sourceList.length - 1) * spacing / 2 + i * spacing,
      };
    });

    // Build virtual RIGHT nodes (targets)
    const rightNodes: any[] = targetList.map((id, i) => {
      const orig = nodeById.get(id) ?? { id, label: id, type: 'unknown' };
      const isDual = sourceIds.has(id); // also appears on left
      return {
        ...orig,
        id: id + '__RIGHT',
        _originalId: id,
        _side: 'right',
        _isDual: isDual,
        _x: rightX,
        _y: -(targetList.length - 1) * spacing / 2 + i * spacing,
      };
    });

    // Build edges connecting LEFT -> RIGHT using virtual IDs
    const virtualEdges: any[] = matchingEdges.map((e, i) => ({
      ...e,
      id: `bip_${i}`,
      from: String(e.from) + '__LEFT',
      to: String(e.to) + '__RIGHT',
    }));

    // Set bipartiteData - VisNetworkGraph will use this instead of normal filtering
    setBipartiteData({ leftNodes, rightNodes, edges: virtualEdges });
    // Column metadata for zone bands (simple two-column: SOURCE left, TARGET right)
    setBipartiteColMeta([
      { type: 'SOURCE', x: leftX, count: sourceList.length },
      { type: 'TARGET', x: rightX, count: targetList.length },
    ]);
    setActiveLinkType(linkType);
    setIsBipartite(true);
    setIsOrganized(false);
    // Positions are embedded in node DataSet (_x, _y) and physics is disabled at init
    // No need for moveNode — VisNetworkGraph handles fit after mount in bipartite mode
  };

  const handleExitBipartite = () => {
    const net = externalNetworkRef.current;
    if (net) {
      net.setOptions({ physics: { enabled: true } });
      net.fit({ animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
    }
    setActiveLinkType(null);
    setIsBipartite(false);
    setBipartiteColMeta([]);
    setBipartiteData(null);
  };

  // Auto-trigger from external Explore button
  useEffect(() => {
    if (initialQuery && initialQuery !== activeSearch) {
      setSearchInput(initialQuery);
      setActiveSearch(initialQuery);
      onQueryUsed?.();
    }
  }, [initialQuery]);

  // Save investigation mutation (used by storyboard panel)
  const saveInvestigationMutation = trpc.investigations.save.useMutation();

  // Fetch network graph — loadKey is bumped to force refetch when same query is re-run
  const { data: rawGraphData, isLoading: graphLoading, refetch: refetchGraph } = trpc.articles.networkGraph.useQuery(
    {
      region,
      search: activeSearch || undefined,
      limit: GRAPH_PAGE_SIZE,
      offset: graphOffset,
      dateFilter: timelineDate || undefined,
      since: graphSince,
    },
    { refetchOnWindowFocus: false }
  );

  // Accumulate graph pages: first page replaces, subsequent pages merge
  useEffect(() => {
    if (!rawGraphData) return;
    if (graphOffset === 0) {
      // First page — replace
      setAccumulatedGraphData(rawGraphData as any);
    } else {
      // Subsequent pages — merge nodes/edges deduplicating by id/key
      setAccumulatedGraphData(prev => {
        if (!prev) return rawGraphData as any;
        const existingNodeIds = new Set(prev.nodes.map((n: any) => n.id));
        const newNodes = (rawGraphData.nodes as any[]).filter(n => !existingNodeIds.has(n.id));
        const existingEdgeKeys = new Set(prev.edges.map((e: any) => `${e.from}|${e.to}|${e.label}`));
        const newEdges = (rawGraphData.edges as any[]).filter(e => !existingEdgeKeys.has(`${e.from}|${e.to}|${e.label}`));
        return {
          nodes: [...prev.nodes, ...newNodes],
          edges: [...prev.edges, ...newEdges],
          totalArticles: rawGraphData.totalArticles,
        };
      });
    }
  }, [rawGraphData]);

  // Reset offset and accumulated data when search/region/time window changes
  useEffect(() => {
    setGraphOffset(0);
    setAccumulatedGraphData(null);
  }, [activeSearch, region, graphTimeWindow, timelineDate]);

  // The graphData used by the rest of the component is the accumulated version
  const graphData = accumulatedGraphData ?? rawGraphData;

  // ── Cluster graph transformation ──────────────────────────────────────────────────
  // Transforms raw graphData into a cluster-based representation:
  //   - In CLUSTER mode: agency nodes become large cluster nodes with article count badges.
  //     Article nodes are hidden unless their agency is in expandedAgencies.
  //     Edges from hidden article nodes are re-routed to the agency cluster node.
  //   - In SIGNAL mode: raw data is passed through unchanged.
  const clusteredGraphData = useMemo(() => {
    if (!graphData) return graphData;
    if (clusterMode === 'signal') return graphData;

    const rawNodes: any[] = graphData.nodes;
    const rawEdges: any[] = graphData.edges;

    // Build lookup maps
    const nodeById = new Map<string, any>(rawNodes.map(n => [String(n.id), n]));

    // For each agency node, collect its article children
    const agencyArticles = new Map<string, string[]>(); // agencyId -> [articleId, ...]
    rawEdges.forEach(e => {
      const from = nodeById.get(String(e.from));
      const to = nodeById.get(String(e.to));
      if (!from || !to) return;
      if (from.type === 'article' && to.type === 'agency') {
        const list = agencyArticles.get(String(e.to)) ?? [];
        if (!list.includes(String(e.from))) list.push(String(e.from));
        agencyArticles.set(String(e.to), list);
      } else if (from.type === 'agency' && to.type === 'article') {
        const list = agencyArticles.get(String(e.from)) ?? [];
        if (!list.includes(String(e.to))) list.push(String(e.to));
        agencyArticles.set(String(e.from), list);
      }
    });

    // Determine which article nodes are visible
    const visibleArticleIds = new Set<string>();
    expandedAgencies.forEach(agencyId => {
      (agencyArticles.get(agencyId) ?? []).forEach(aid => visibleArticleIds.add(aid));
    });

    // Build output nodes
    const outputNodes: any[] = [];
    rawNodes.forEach(n => {
      const id = String(n.id);
      if (n.type === 'article') {
        if (visibleArticleIds.has(id)) {
          // Show the article node with _agencyId so radial positioning can find the parent cluster hub
          const parentAgencyId = Array.from(agencyArticles.entries()).find(([, aids]) => aids.includes(id))?.[0];
          outputNodes.push({ ...n, _agencyId: parentAgencyId ?? null });
        }
        // else: hidden (collapsed into cluster)
      } else if (n.type === 'agency') {
        const articleCount = agencyArticles.get(id)?.length ?? 0;
        const isExpanded = expandedAgencies.has(id);
        // Render agency as a large cluster node with count badge
        outputNodes.push({
          ...n,
          // Larger size for cluster node
          size: isExpanded ? 20 : Math.max(20, Math.min(50, 20 + Math.sqrt(articleCount) * 3)),
          // Label shows article count
          label: articleCount > 0 ? `${n.label}\n[${articleCount} articles${isExpanded ? ' ▼' : ' ▶'}]` : n.label,
          // Visual distinction: thicker border, glow
          borderWidth: isExpanded ? 3 : 2,
          borderWidthSelected: 4,
          color: {
            background: isExpanded ? '#f59e0b22' : '#f59e0b18',
            border: isExpanded ? '#f59e0bcc' : '#f59e0b80',
            highlight: { background: '#f59e0b30', border: '#f59e0b' },
            hover: { background: '#f59e0b25', border: '#f59e0baa' },
          },
          font: { color: 'var(--intel-yellow)', size: isExpanded ? 11 : 10, bold: true, multi: true },
          // Store metadata for click handler
          _isCluster: true,
          _articleCount: articleCount,
          _isExpanded: isExpanded,
          _agencyId: id,
        });
      } else {
        outputNodes.push(n);
      }
    });

    // Build output edges — re-route edges from hidden article nodes to their agency cluster
    const outputEdges: any[] = [];
    const edgeKeySet = new Set<string>();
    rawEdges.forEach(e => {
      const fromId = String(e.from);
      const toId = String(e.to);
      const fromNode = nodeById.get(fromId);
      const toNode = nodeById.get(toId);
      if (!fromNode || !toNode) return;

      const fromIsHiddenArticle = fromNode.type === 'article' && !visibleArticleIds.has(fromId);
      const toIsHiddenArticle = toNode.type === 'article' && !visibleArticleIds.has(toId);

      // Skip edges between two hidden articles
      if (fromIsHiddenArticle && toIsHiddenArticle) return;

      // If one end is a hidden article, find its agency and re-route
      let resolvedFrom = fromId;
      let resolvedTo = toId;

      if (fromIsHiddenArticle) {
        // Find agency of this article
        const agencyId = Array.from(agencyArticles.entries()).find(([, aids]) => aids.includes(fromId))?.[0];
        if (!agencyId) return; // orphan article — skip
        resolvedFrom = agencyId;
      }
      if (toIsHiddenArticle) {
        const agencyId = Array.from(agencyArticles.entries()).find(([, aids]) => aids.includes(toId))?.[0];
        if (!agencyId) return;
        resolvedTo = agencyId;
      }

      // Skip self-loops (agency→agency after re-routing)
      if (resolvedFrom === resolvedTo) return;

      // Deduplicate re-routed edges by key; accumulate weight
      const key = `${resolvedFrom}|${resolvedTo}|${e.label ?? ''}`;
      if (!edgeKeySet.has(key)) {
        edgeKeySet.add(key);
        // Calculate weight: count how many raw edges map to this re-routed edge
        const weight = rawEdges.filter(re => {
          const rf = String(re.from);
          const rt = String(re.to);
          const rfNode = nodeById.get(rf);
          const rtNode = nodeById.get(rt);
          if (!rfNode || !rtNode) return false;
          const rFrom = (rfNode.type === 'article' && !visibleArticleIds.has(rf))
            ? (Array.from(agencyArticles.entries()).find(([, aids]) => aids.includes(rf))?.[0] ?? rf)
            : rf;
          const rTo = (rtNode.type === 'article' && !visibleArticleIds.has(rt))
            ? (Array.from(agencyArticles.entries()).find(([, aids]) => aids.includes(rt))?.[0] ?? rt)
            : rt;
          return rFrom === resolvedFrom && rTo === resolvedTo && (re.label ?? '') === (e.label ?? '');
        }).length;
        outputEdges.push({
          ...e,
          from: resolvedFrom,
          to: resolvedTo,
          // Thicker edges for higher weight
          width: Math.max(1, Math.min(6, Math.sqrt(weight) * 1.2)),
          title: weight > 1 ? `${e.label ?? 'linked'} (${weight} articles)` : e.title,
        });
      }
    });

    return { nodes: outputNodes, edges: outputEdges, totalArticles: (graphData as any).totalArticles };
  }, [graphData, clusterMode, expandedAgencies]);

  // Toggle agency cluster expand/collapse
  const handleClusterToggle = (agencyId: string) => {
    setExpandedAgencies(prev => {
      const next = new Set(prev);
      if (next.has(agencyId)) {
        next.delete(agencyId);
      } else {
        next.add(agencyId);
      }
      return next;
    });
  };

  // Reset expanded agencies when data changes
  useEffect(() => {
    setExpandedAgencies(new Set());
  }, [activeSearch, region, graphTimeWindow, timelineDate]);

  // When loadKey bumps (same query re-run), trigger a manual refetch
  const prevLoadKey = useRef(loadKey);
  useEffect(() => {
    if (loadKey !== prevLoadKey.current) {
      prevLoadKey.current = loadKey;
      setGraphOffset(0);
      setAccumulatedGraphData(null);
      refetchGraph();
    }
  }, [loadKey]);

  // Fetch articles for entity panel — use since/until derived from timelineDate for date filtering
  const articlesSince = useMemo(() => {
    if (!timelineDate) return undefined;
    return new Date(timelineDate + 'T00:00:00Z');
  }, [timelineDate]);

  const { data: articles } = trpc.articles.list.useQuery(
    { region, search: activeSearch || undefined, limit: 500, since: articlesSince }
  );

  // ── Entity extraction ──────────────────────────────────────────────────────
  const entityData = useMemo(() => {
    const people = new Map<string, number>();
    const orgs = new Map<string, number>();
    const locations = new Map<string, number>();
    const keywords = new Map<string, number>();
    const authors = new Map<string, number>();
    const publishers = new Map<string, number>();

    // From graph nodes (most reliable)
    graphData?.nodes.forEach(n => {
      if (n.type === 'person') people.set(n.label, (people.get(n.label) ?? 0) + 1);
      else if (n.type === 'organization') orgs.set(n.label, (orgs.get(n.label) ?? 0) + 1);
      else if (n.type === 'country') locations.set(n.label, (locations.get(n.label) ?? 0) + 1);
      else if (n.type === 'keyword') keywords.set(n.label, (keywords.get(n.label) ?? 0) + 1);
      else if (n.type === 'author') authors.set(n.label, (authors.get(n.label) ?? 0) + 1);
      else if (n.type === 'agency') publishers.set(n.label, (publishers.get(n.label) ?? 0) + 1);
    });

    // From articles (supplement)
    articles?.forEach(article => {
      if (article.author?.trim()) {
        const a = article.author.trim();
        authors.set(a, (authors.get(a) ?? 0) + 1);
      }
      const kws: string[] = (() => { try { return JSON.parse((article.keywordsJson as any) ?? '[]'); } catch { return []; } })();
      kws.forEach(kw => { if (kw?.length > 2) keywords.set(kw, (keywords.get(kw) ?? 0) + 1); });
    });

    const sortMap = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
    return {
      people: sortMap(people),
      orgs: sortMap(orgs),
      locations: sortMap(locations),
      keywords: sortMap(keywords),
      authors: sortMap(authors),
      publishers: sortMap(publishers),
    };
  }, [articles, graphData]);

  // ── Topic distribution ────────────────────────────────────────────────────
  const topicData = useMemo(() => {
    const tc: Record<string, number> = {};
    articles?.forEach(a => {
      const topics: string[] = (() => { try { return JSON.parse((a.topicsJson as any) ?? '[]'); } catch { return []; } })();
      topics.forEach(t => { tc[t] = (tc[t] ?? 0) + 1; });
    });
    return Object.entries(tc).sort((a, b) => b[1] - a[1]);
  }, [articles]);

  // ── Country distribution ──────────────────────────────────────────────────
  const countryData = useMemo(() => {
    const cc: Record<string, number> = {};
    articles?.forEach(a => { if (a.country) cc[a.country] = (cc[a.country] ?? 0) + 1; });
    return Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [articles]);

  const handleSearch = () => {
    const q = searchInput.trim();
    setSelectedNode(null);
    setIsOrganized(false);
    if (q === activeSearch) {
      // Force refetch even if same query
      setLoadKey(k => k + 1);
    } else {
      setActiveSearch(q);
    }
  };

  const handleEntityClick = (label: string) => {
    setSearchInput(label);
    setActiveSearch(label);
    setSelectedNode(null);
    setDeepDiveNode(null);
  };

  const handleNodeClick = (node: any) => {
    // Quick-search suggestion button
    if (node?._quickSearch) {
      setSearchInput(node._quickSearch);
      setActiveSearch(node._quickSearch);
      return;
    }
    // Cluster node single-click: highlight its network only, do NOT expand
    // (expansion happens on double-click via handleNodeDoubleClick)
    if (node?._isCluster && clusterMode === 'cluster') {
      setSelectedNode(node);
      // Focus the cluster node in vis-network so it is visually selected
      if (externalNetworkRef.current) {
        externalNetworkRef.current.selectNodes([node.id]);
      }
      return;
    }
    setSelectedNode(node);
    // For non-article nodes (people, orgs, countries, authors, agencies), open deep-dive panel
    if (node && node.type !== 'article' && node.type !== 'keyword' && node.type !== 'facility') {
      setDeepDiveNode({ name: node.label, type: node.type });
    } else {
      setDeepDiveNode(null);
    }
  };

  // Double-click handler: expand/collapse cluster nodes; zoom to others
  const handleNodeDoubleClick = (node: any) => {
    if (!node) return;
    if (node._isCluster && clusterMode === 'cluster') {
      handleClusterToggle(String(node._agencyId ?? node.id));
    }
    // For non-cluster nodes, double-click just zooms (handled in VisNetworkGraph)
  };

  // Highlight a node in the current graph view without triggering a new search.
  // For 2D network: selects + focuses the node via vis-network.
  // For 3D view: calls scene.userData.highlightNodeByLabel.
  // Falls back to handleEntityClick if the node isn't found in the current graph.
  const handleHighlightNode = (name: string) => {
    if (graphView === '3d') {
      graph3dApiRef.current?.highlightNodeByLabel(name);
      return;
    }
    // 2D network view: find the node by label in the current graph data
    const allNodes = renderGraphData?.nodes ?? [];
    const q = name.trim().toLowerCase();
    const match = allNodes.find(n => String(n.label ?? '').toLowerCase() === q)
      ?? allNodes.find(n => String(n.label ?? '').toLowerCase().includes(q));
    if (match && externalNetworkRef.current) {
      const net = externalNetworkRef.current;
      // Select the node and fly to it
      net.selectNodes([match.id]);
      net.focus(match.id, { scale: 1.2, animation: { duration: 600, easingFunction: 'easeInOutQuad' } });
      // Also update React selectedNode state so the dossier panel updates
      handleNodeClick(match);
    } else {
      // Node not in current graph — fall back to explore
      setDeepDiveNode(null);
      setGraphView('network');
      handleEntityClick(name);
    }
  };

  const NODE_TYPES = ['article','agency','author','country','person','organization','facility','keyword'];
  // Use clusteredGraphData for rendering; use raw graphData for analytics (entity panel, etc.)
  const renderGraphData = clusteredGraphData ?? graphData;
  const nodeCount = renderGraphData?.nodes.filter(n => graphFilter.length === 0 || graphFilter.includes(n.type)).length ?? 0;
  const edgeCount = renderGraphData?.edges.length ?? 0;
  const totalArticles = (graphData as any)?.totalArticles ?? 0;
  const loadedArticleNodes = (graphData?.nodes ?? []).filter(n => n.type === 'article').length;
  const hasMoreSignals = totalArticles > graphOffset + GRAPH_PAGE_SIZE;
  const clusterNodeCount = clusterMode === 'cluster' ? (renderGraphData?.nodes.filter(n => n.type === 'agency').length ?? 0) : 0;

  // Determine the primary node: the node whose label best matches the active search query.
  // This node is highlighted and centered in the graph to serve as the visual anchor.
  const primaryNodeId = useMemo(() => {
    if (!activeSearch || !renderGraphData?.nodes.length) return null;
    const q = activeSearch.trim().toLowerCase();
    // Exact match first
    const exact = renderGraphData.nodes.find(n => String(n.label ?? '').toLowerCase() === q);
    if (exact) return exact.id;
    // Partial match (label starts with query)
    const partial = renderGraphData.nodes.find(n => String(n.label ?? '').toLowerCase().startsWith(q));
    if (partial) return partial.id;
    // Partial match (label contains query)
    const contains = renderGraphData.nodes.find(n => String(n.label ?? '').toLowerCase().includes(q));
    if (contains) return contains.id;
    return null;
  }, [activeSearch, renderGraphData]);

  // Count of nodes per type (for filter badges)
  const nodeTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (renderGraphData?.nodes ?? []).forEach(n => { counts[n.type] = (counts[n.type] ?? 0) + 1; });
    return counts;
  }, [renderGraphData]);

  // Count edges per link type
  const linkTypeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (renderGraphData?.edges ?? []).forEach(e => {
      const lbl = e.label ?? 'unknown';
      counts[lbl] = (counts[lbl] ?? 0) + 1;
    });
    return counts;
  }, [renderGraphData]);

  // For each link type, compute breakdown of target node types (unique targets only)
  const linkTypeTargetBreakdown = useMemo(() => {
    const nodeById = new Map<string, any>((renderGraphData?.nodes ?? []).map(n => [n.id, n]));
    const result: Record<string, Record<string, number>> = {};
    Object.keys(EDGE_STYLES).forEach(label => {
      const edges = (renderGraphData?.edges ?? []).filter(e => e.label === label);
      if (!edges.length) return;
      // Unique target IDs
      const uniqueTargets = new Set<string>(edges.map(e => e.to));
      const breakdown: Record<string, number> = {};
      uniqueTargets.forEach(id => {
        const node = nodeById.get(id);
        const type = node?.type ?? 'unknown';
        breakdown[type] = (breakdown[type] ?? 0) + 1;
      });
      result[label] = breakdown;
    });
    return result;
  }, [renderGraphData]);

  // Count connections between filtered node types
  const filteredConnectionCount = useMemo(() => {
    if (!showConnectionsOnly || graphFilter.length === 0) return 0;
    const filteredIds = new Set((renderGraphData?.nodes ?? []).filter(n => graphFilter.includes(n.type)).map(n => n.id));
    return (renderGraphData?.edges ?? []).filter(e => filteredIds.has(e.from) && filteredIds.has(e.to)).length;
  }, [renderGraphData, graphFilter, showConnectionsOnly]);

  // Effective graph filter: when showConnectionsOnly, only show edges between filtered types
  const effectiveGraphFilter = showConnectionsOnly && graphFilter.length > 0 ? graphFilter : graphFilter;

  // Build tree data for ForceDirectedTree from graphData (raw, not clustered — tree shows all entities)
  // Lookup map: truncated label → { fullLabel, type } for tree node click resolution
  const treeNodeMap = useMemo(() => {
    const map = new Map<string, { fullLabel: string; type: string }>();
    (graphData?.nodes ?? []).forEach(n => {
      const nodeType = n.type ?? 'unknown';
      const nodeLabel = n.label ?? 'Unnamed';
      const truncated = nodeLabel.substring(0, 30);
      map.set(truncated, { fullLabel: nodeLabel, type: nodeType });
    });
    return map;
  }, [graphData]);

  const treeData = useMemo((): TreeNode => {
    const TOPIC_COLORS_TREE: Record<string, string> = {
      article: '#22d3ee', agency: '#f59e0b', author: '#a78bfa',
      country: '#10b981', person: '#f472b6', organization: '#fb923c',
      facility: '#ef4444', keyword: '#6b7280',
    };
    const nodes = graphData?.nodes ?? [];
    const root: TreeNode = {
      name: activeSearch || region,
      value: nodes.length,
      color: '#8b5cf6',
      children: [],
    };
    // Group by type
    const byType = new Map<string, TreeNode[]>();
    nodes.forEach(n => {
      const nodeType = n.type ?? 'unknown';
      const nodeLabel = n.label ?? 'Unnamed';
      if (!byType.has(nodeType)) byType.set(nodeType, []);
      byType.get(nodeType)!.push({ name: nodeLabel.substring(0, 30), value: 1, color: TOPIC_COLORS_TREE[nodeType] ?? '#6b7280' });
    });
    // Proper irregular plurals for node type group headers
    const pluralLabel: Record<string, string> = {
      article: 'Articles', agency: 'Agencies', author: 'Authors',
      country: 'Countries', person: 'Persons', organization: 'Organizations',
      facility: 'Facilities', keyword: 'Keywords', unknown: 'Unknown',
    };
    byType.forEach((children, type) => {
      const safeType = type ?? 'unknown';
      root.children!.push({
        name: pluralLabel[safeType] ?? (safeType.charAt(0).toUpperCase() + safeType.slice(1) + 's'),
        value: children.length,
        color: TOPIC_COLORS_TREE[safeType] ?? '#6b7280',
        children: children.slice(0, 20),
      });
    });
    return root;
  }, [graphData, activeSearch, region]);

  return (
    <div className="flex h-full overflow-hidden">

      {/* ─── Left Panel ───────────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 border-r border-border bg-card/95 flex flex-col overflow-hidden">

        {/* Header — Command Bar */}
        <div className="px-3 py-3 border-b border-foreground/8 bg-card">
          {/* Title row */}
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
            <Terminal size={11} className="text-emerald-400/70"/>
            <span className="text-[10px] font-black tracking-[0.25em] text-emerald-400/80 font-mono">INTEL EXPLORER</span>

          </div>
          {/* Command input */}
          <div className="flex gap-1.5 items-center">
            <div className="flex-1 min-w-0 flex items-center gap-2 bg-foreground/[0.08] border border-foreground/10 rounded px-2.5 py-1.5 focus-within:border-emerald-400/40 transition-colors overflow-hidden">
              <span className="text-[10px] font-mono text-emerald-400/60 flex-shrink-0">❯</span>
              <input type="text" value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                placeholder="query entity, topic, country..." className="flex-1 min-w-0 bg-transparent text-[11px] text-foreground/80 placeholder:text-muted-foreground/40 outline-none truncate font-mono"/>
              {searchInput && <button onClick={() => { setSearchInput(""); setActiveSearch(""); }} className="flex-shrink-0 text-muted-foreground/60 hover:text-foreground/60"><X size={10}/></button>}
            </div>
            <button onClick={handleSearch}
              className="flex-shrink-0 px-2.5 py-1.5 bg-emerald-400/10 border border-emerald-400/30 text-emerald-400/80 rounded text-[10px] font-black font-mono hover:bg-emerald-400/20 transition-colors whitespace-nowrap tracking-widest">
              RUN
            </button>
          </div>
          {activeSearch && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[9px] font-mono">
              <Scan size={8} className="text-emerald-400/50"/>
              <span className="text-muted-foreground/60">SCANNING:</span>
              <span className="text-emerald-400/70 truncate">{activeSearch}</span>
            </div>
          )}
        </div>

        {/* Stats — Signal Metrics */}
        <div className="grid grid-cols-3 gap-0 border-b border-foreground/8 bg-foreground/[0.05]">
          <div className="flex flex-col items-center py-2 border-r border-foreground/8">
            <span className="text-sm font-black text-foreground/70 font-mono">{nodeCount}</span>
            <span className="text-[8px] text-muted-foreground/50 font-mono tracking-widest">NODES</span>
          </div>
          <div className="flex flex-col items-center py-2 border-r border-foreground/8">
            <span className="text-sm font-black text-muted-foreground font-mono">{edgeCount}</span>
            <span className="text-[8px] text-muted-foreground/50 font-mono tracking-widest">EDGES</span>
          </div>
          <div className="flex flex-col items-center py-2">
            <span className="text-sm font-black text-foreground/70 font-mono">{loadedArticleNodes}</span>
            <span className="text-[8px] text-muted-foreground/50 font-mono tracking-widest">ARTICLES</span>
          </div>
        </div>

        {/* TIME WINDOW selector */}
        <div className="border-b border-foreground/8 bg-foreground/[0.03]">
          <button
            onClick={() => setTimeWindowCollapsed(c => !c)}
            className="w-full px-3 py-2.5 flex items-center gap-1.5 hover:bg-foreground/3 transition-colors">
            <Clock size={8} className="text-muted-foreground/60"/>
            <span className="text-[9px] text-muted-foreground/60 font-mono tracking-widest">TIME WINDOW</span>
            {graphTimeWindow !== '3d' && !timeWindowCollapsed && (
              <span className="ml-1 text-[7px] font-mono text-emerald-400/60 border border-emerald-400/25 px-1 rounded tracking-wider">
                {GRAPH_TIME_WINDOWS.find(t => t.value === graphTimeWindow)?.label ?? graphTimeWindow.toUpperCase()}
              </span>
            )}
            {graphTimeWindow === 'all' && (
              <span className="text-[7px] font-mono text-red-400/70 border border-red-400/30 px-1 rounded tracking-wider">ALL DATA</span>
            )}
            <ChevronDown size={8} className={`ml-auto text-muted-foreground/40 transition-transform ${timeWindowCollapsed ? '' : 'rotate-180'}`}/>
          </button>
          {!timeWindowCollapsed && (
          <div className="px-3 pb-2.5">
          <div className="flex gap-1">
            {GRAPH_TIME_WINDOWS.map(tw => {
              const isActive = graphTimeWindow === tw.value;
              const isAll = tw.value === 'all';
              return (
                <button
                  key={tw.value}
                  title={tw.desc}
                  onClick={() => {
                    if (isAll) {
                      setPendingTimeWindow('all');
                      setShowAllDataWarning(true);
                    } else {
                      setGraphTimeWindow(tw.value as any);
                    }
                  }}
                  className="flex-1 py-1 rounded text-[9px] font-black font-mono transition-all border"
                  style={{
                    background: isActive ? (isAll ? 'rgba(239,68,68,0.15)' : 'rgba(52,211,153,0.12)') : 'oklch(from var(--foreground) l c h / 0.03)',
                    borderColor: isActive ? (isAll ? 'rgba(239,68,68,0.45)' : 'rgba(52,211,153,0.40)') : 'oklch(from var(--foreground) l c h / 0.07)',
                    color: isActive ? (isAll ? '#f87171' : '#34d399') : 'oklch(from var(--foreground) l c h / 0.30)',
                  }}>
                  {tw.label}
                </button>
              );
            })}
          </div>
          {/* Load More Signals */}
          {hasMoreSignals && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-yellow-400/20 bg-yellow-400/5">
                <AlertTriangle size={8} className="text-yellow-400/70 flex-shrink-0"/>
                <span className="text-[8px] font-mono text-yellow-400/60 leading-tight">
                  {loadedArticleNodes}/{totalArticles} articles loaded. More articles = more memory.
                </span>
              </div>
              <button
                disabled={graphLoading}
                onClick={() => setGraphOffset(o => o + GRAPH_PAGE_SIZE)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-emerald-400/25 bg-emerald-400/8 text-emerald-400/70 text-[9px] font-black font-mono hover:bg-emerald-400/15 hover:text-emerald-400 transition-all disabled:opacity-40 disabled:cursor-not-allowed tracking-wider">
                {graphLoading ? (
                  <><span className="animate-spin">&#x25CC;</span> LOADING...</>
                ) : (
                  <>+ LOAD MORE ARTICLES (+{Math.min(GRAPH_PAGE_SIZE, totalArticles - graphOffset - GRAPH_PAGE_SIZE + GRAPH_PAGE_SIZE)})</>
                )}
              </button>
            </div>
          )}
          </div>
          )}
        </div> {/* end TIME WINDOW outer */}

        {/* Graph Controls — NET/TREE/3D/ORGANIZE (placed above NODE FILTER) */}
        <div className="px-3 py-2 border-b border-foreground/8 space-y-1.5">
          {/* Row 1: View toggle + Refresh + Save/Load */}
          <div className="flex items-center gap-1.5">
            {/* View Toggle */}
            <div className="flex items-center gap-0 bg-foreground/[0.08] border border-foreground/8 rounded p-0.5">
              {/* NET button */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('network')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold font-mono transition-all ${
                    graphView === 'network' ? 'bg-foreground/10 text-foreground/80' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}>
                  <Network size={8}/> NET
                </button>
              </div>
              {/* TREE button */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('tree')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold font-mono transition-all ${
                    graphView === 'tree' ? 'bg-foreground/10 text-foreground/80' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}>
                  <TreePine size={8}/> TREE
                </button>
              </div>
              {/* 3D button */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('3d')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black font-mono tracking-wide transition-all ${
                    graphView === '3d'
                      ? 'text-violet-200 border border-violet-400/40'
                      : 'text-violet-400/50 hover:text-violet-300/80 border border-transparent hover:border-violet-400/20'
                  }`}
                  style={graphView === '3d' ? {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(251,191,36,0.10) 100%)',
                    boxShadow: '0 0 14px rgba(139,92,246,0.25), inset 0 1px 0 oklch(from var(--foreground) l c h / 0.06)',
                  } : {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(251,191,36,0.03) 100%)',
                  }}>
                  <Box size={8}/> 3D
                </button>
              </div>
            </div>
            <button onClick={() => refetchGraph()}
              className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-foreground/60 transition-colors font-mono border border-foreground/8 rounded px-1.5 py-1">
              <RefreshCw size={8}/>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              {graphLoading && <span className="text-[9px] text-emerald-400/60 font-mono animate-pulse">SCAN...</span>}
              <button
                onClick={() => setShowSavedList(true)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-yellow-400/70 transition-colors font-mono"
                title="View saved investigations">
                <FolderOpen size={9}/> Load
              </button>
              <button
                onClick={() => nodeCount > 0 && setShowSaveModal(true)}
                disabled={nodeCount === 0}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-emerald-400/70 transition-colors font-mono disabled:opacity-20 disabled:cursor-not-allowed"
                title={nodeCount === 0 ? 'Search first to build a graph' : 'Save this investigation'}>
                <BookmarkPlus size={9}/> Save
              </button>
            </div>
          </div>
          {/* Row 2: Organize / De-organize */}
          {graphView === 'network' && nodeCount > 0 && (
            <div className="flex items-center gap-1">
              {!isOrganized ? (
                <button
                  onClick={handleOrganize}
                  title={selectedNode ? `Radial layout around ${selectedNode.label}` : 'Arrange nodes in radial layout'}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-muted-foreground/70 hover:text-emerald-400/80 border border-foreground/8 hover:border-emerald-400/25 transition-all font-mono">
                  <Orbit size={8}/> ORGANIZE
                  {selectedNode && <span className="text-[8px] text-muted-foreground/40 truncate max-w-[60px]">&#x2192; {selectedNode.label.substring(0,10)}</span>}
                </button>
              ) : (
                <button
                  onClick={handleDeorganize}
                  title="Reset to physics simulation layout"
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-emerald-400/70 hover:text-foreground/60 border border-emerald-400/25 hover:border-white/15 bg-emerald-400/5 hover:bg-transparent transition-all font-mono">
                  <Shuffle size={8}/> DE-ORGANIZE
                </button>
              )}
            </div>
          )}
        </div>

        {/* GRAPH MODE — Cluster vs Article (placed above NODE FILTER) */}
        <div className="border-b border-foreground/8 bg-foreground/[0.03]">
          <div className="px-3 py-2 flex items-center gap-1.5">
            <Network size={8} className="text-muted-foreground/60"/>
            <span className="text-[9px] text-muted-foreground/60 font-mono tracking-widest">GRAPH MODE</span>
            {clusterMode === 'cluster' && clusterNodeCount > 0 && (
              <span className="ml-auto text-[7px] font-mono text-amber-400/60 border border-amber-400/20 px-1 rounded tracking-wider">
                {clusterNodeCount} CLUSTERS
              </span>
            )}
          </div>
          <div className="px-3 pb-2.5">
            <div className="flex gap-1">
              <button
                onClick={() => setClusterMode('cluster')}
                title="Agency Cluster Mode: articles grouped by agency. Double-click a cluster to expand its articles."
                className="flex-1 py-1.5 rounded text-[9px] font-black font-mono transition-all border"
                style={{
                  background: clusterMode === 'cluster' ? 'rgba(245,158,11,0.12)' : 'oklch(from var(--foreground) l c h / 0.03)',
                  borderColor: clusterMode === 'cluster' ? 'rgba(245,158,11,0.40)' : 'oklch(from var(--foreground) l c h / 0.07)',
                  color: clusterMode === 'cluster' ? '#f59e0b' : 'oklch(from var(--foreground) l c h / 0.30)',
                }}>
                CLUSTER
              </button>
              <button
                onClick={() => setClusterMode('signal')}
                title="Article Mode: all individual article nodes visible. May be slow with many articles."
                className="flex-1 py-1.5 rounded text-[9px] font-black font-mono transition-all border"
                style={{
                  background: clusterMode === 'signal' ? 'rgba(52,211,153,0.12)' : 'oklch(from var(--foreground) l c h / 0.03)',
                  borderColor: clusterMode === 'signal' ? 'rgba(52,211,153,0.40)' : 'oklch(from var(--foreground) l c h / 0.07)',
                  color: clusterMode === 'signal' ? '#34d399' : 'oklch(from var(--foreground) l c h / 0.30)',
                }}>
                ARTICLES
              </button>
            </div>
            {clusterMode === 'cluster' && (
              <p className="mt-1.5 text-[8px] font-mono text-muted-foreground/40 leading-tight">
                Single-click to highlight network. Double-click cluster to expand articles.
              </p>
            )}
            {clusterMode === 'signal' && loadedArticleNodes > 300 && (
              <div className="mt-1.5 flex items-center gap-1 px-1.5 py-1 rounded border border-yellow-400/20 bg-yellow-400/5">
                <AlertTriangle size={7} className="text-yellow-400/70 flex-shrink-0"/>
                <span className="text-[7px] font-mono text-yellow-400/60 leading-tight">
                  {loadedArticleNodes} article nodes — browser may slow down.
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Node Type Filter — collapsible */}
        <div className="border-b border-foreground/8 bg-foreground/[0.03]">
          {/* Collapsible header */}
          <button
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-foreground/3 transition-colors"
            onClick={() => setNodeFilterCollapsed(v => !v)}
          >
            <div className="flex items-center gap-1.5">
              <Filter size={8} className="text-muted-foreground/60"/>
              <span className="text-[9px] text-muted-foreground/60 font-mono tracking-widest">NODE FILTER</span>
              {graphFilter.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black font-mono bg-emerald-400/15 text-emerald-400/80 border border-emerald-400/20">
                  {graphFilter.length} active
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              {graphFilter.length > 0 && !nodeFilterCollapsed && (
                <button
                  onClick={e => { e.stopPropagation(); setGraphFilter([]); setShowConnectionsOnly(false); }}
                  className="text-[8px] font-mono text-muted-foreground/50 hover:text-red-400/70 transition-colors tracking-wider">
                  CLEAR
                </button>
              )}
              {nodeFilterCollapsed
                ? <ChevronDown size={8} className="text-muted-foreground/50"/>
                : <ChevronUp size={8} className="text-muted-foreground/50"/>}
            </div>
          </button>
          {/* Collapsible body */}
          {!nodeFilterCollapsed && (
            <div className="px-3 pb-2.5">
              <div className="grid grid-cols-2 gap-1">
                {NODE_TYPES.map(type => {
                  const style = NODE_STYLES[type];
                  const isActive = graphFilter.includes(type);
                  const count = nodeTypeCounts[type] ?? 0;
                  return (
                    <button key={type} onClick={() => setGraphFilter(prev =>
                      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
                    )}
                      className="flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all text-left group"
                      style={{
                        borderColor: isActive ? style.color + '60' : 'oklch(from var(--foreground) l c h / 0.06)',
                        background: isActive ? `${style.color}12` : 'oklch(from var(--foreground) l c h / 0.02)',
                      }}>
                      <div className="w-1.5 h-1.5 rounded-sm flex-shrink-0 transition-all"
                        style={{ background: isActive ? style.color : style.color + '40' }}/>
                      <span className="text-[9px] font-mono capitalize flex-1 transition-colors"
                        style={{ color: isActive ? style.color : 'oklch(from var(--foreground) l c h / 0.35)' }}>
                        {type}
                      </span>
                      {count > 0 && (
                        <span className="text-[8px] font-black font-mono flex-shrink-0"
                          style={{ color: isActive ? style.color + 'cc' : 'oklch(from var(--foreground) l c h / 0.18)' }}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              {/* Show Connections Only toggle */}
              {graphFilter.length >= 2 && (
                <button
                  onClick={() => setShowConnectionsOnly(v => !v)}
                  className={`mt-2 w-full flex items-center gap-1.5 px-2 py-1.5 rounded border transition-all text-[9px] font-mono ${
                    showConnectionsOnly
                      ? 'bg-cyan-400/10 border-cyan-400/30 text-cyan-400/80'
                      : 'bg-transparent border-foreground/8 text-muted-foreground/60 hover:text-muted-foreground hover:border-white/15'
                  }`}>
                  <GitMerge size={9}/>
                  <span>Show Connections Only</span>
                  {showConnectionsOnly && filteredConnectionCount > 0 && (
                    <span className="ml-auto text-[8px] font-black text-cyan-400/60">{filteredConnectionCount} links</span>
                  )}
                </button>
              )}
            </div>
          )}
        </div>

        {/* Link Type Filter — Bipartite Layout Trigger (collapsible) */}
        {edgeCount > 0 && (
          <div className="border-b border-foreground/8 bg-foreground/[0.03]">
            {/* Header row with collapse toggle */}
            <button
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-foreground/3 transition-colors"
              onClick={() => setLinkTypesExpanded(e => !e)}
            >
              <div className="flex items-center gap-1.5">
                <GitMerge size={8} className="text-muted-foreground/60"/>
                <span className="text-[9px] text-muted-foreground/60 font-mono tracking-widest">LINK TYPES</span>
                {isBipartite && (
                  <span className="px-1.5 py-0.5 rounded-full text-[8px] font-black font-mono bg-pink-400/15 text-pink-400/80 border border-pink-400/20">
                    active
                  </span>
                )}
                {!isBipartite && edgeCount > 0 && (
                  <span className="text-[8px] font-mono text-muted-foreground/40">{Object.values(linkTypeCounts).filter(Boolean).length} types</span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {isBipartite && (
                  <span onClick={e => { e.stopPropagation(); handleExitBipartite(); }}
                    className="text-[8px] font-mono text-muted-foreground/50 hover:text-red-400/70 transition-colors tracking-wider cursor-pointer">
                    EXIT
                  </span>
                )}
                {linkTypesExpanded ? <ChevronUp size={8} className="text-muted-foreground/50"/> : <ChevronDown size={8} className="text-muted-foreground/50"/>}
              </div>
            </button>
            {linkTypesExpanded && (
            <div className="px-3 pb-2.5">
            <div className="space-y-1">
              {Object.entries(EDGE_STYLES).map(([label, es]) => {
                const count = linkTypeCounts[label] ?? 0;
                if (count === 0) return null;
                const isActive = activeLinkType === label;
                const breakdown = linkTypeTargetBreakdown[label] ?? {};
                const breakdownEntries = Object.entries(breakdown).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={label}>
                    <button
                      onClick={() => {
                        if (isActive) { handleExitBipartite(); }
                        else {
                          // In 3D mode: just filter edges by link type without bipartite layout
                          if (graphView === '3d') {
                            setActiveLinkType(label);
                            setIsBipartite(true);
                          } else {
                            handleBipartiteLayout(label);
                          }
                        }
                      }}
                      disabled={graphView !== '3d' && !externalNetworkRef.current}
                      className="w-full flex flex-col gap-1 px-2 py-1.5 rounded border transition-all text-left group disabled:opacity-30"
                      style={{
                        borderColor: isActive ? es.color + '60' : 'oklch(from var(--foreground) l c h / 0.06)',
                        background: isActive ? `${es.color}10` : 'oklch(from var(--foreground) l c h / 0.02)',
                      }}
                      title={`Click to visualize "${label}" relationships`}>
                      {/* Top row: edge indicator + label + edge count */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <div className="h-px w-4" style={{
                            background: isActive ? es.color : es.color + '50',
                            borderTop: es.dashes ? `1px dashed ${es.color}${isActive ? 'cc' : '50'}` : undefined,
                          }}/>
                          <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: isActive ? es.color : es.color + '50' }}/>
                        </div>
                        <span className="text-[9px] font-mono capitalize font-bold flex-1 transition-colors"
                          style={{ color: isActive ? es.color : 'oklch(from var(--foreground) l c h / 0.40)' }}>
                          {label}
                        </span>
                        <span className="text-[8px] font-black font-mono flex-shrink-0"
                          style={{ color: isActive ? es.color + 'cc' : 'oklch(from var(--foreground) l c h / 0.18)' }}>
                          {count} edges
                        </span>
                        {isActive && <span className="text-[7px] font-mono text-muted-foreground/50">✕</span>}
                      </div>
                      {/* Target type breakdown row */}
                      {breakdownEntries.length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-6">
                          {breakdownEntries.map(([type, cnt]) => (
                            <span key={type} className="flex items-center gap-0.5 text-[7.5px] font-mono rounded px-1 py-0.5"
                              style={{
                                background: isActive ? (NODE_STYLES[type]?.color ?? '#6b7280') + '20' : 'oklch(from var(--foreground) l c h / 0.04)',
                                color: isActive ? (NODE_STYLES[type]?.color ?? '#6b7280') : 'oklch(from var(--foreground) l c h / 0.25)',
                                border: `1px solid ${isActive ? (NODE_STYLES[type]?.color ?? '#6b7280') + '40' : 'oklch(from var(--foreground) l c h / 0.06)'}`,
                              }}>
                              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: NODE_STYLES[type]?.color ?? '#6b7280' }}/>
                              {cnt} {type}{cnt > 1 ? 's' : ''}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
            {/* Active link type layout legend */}
            {isBipartite && activeLinkType && bipartiteColMeta.length > 0 && (
              <div className="mt-2 px-2 py-2 rounded bg-black/30 border border-foreground/6 space-y-1">
                <div className="text-[8px] font-mono text-muted-foreground/50 mb-1.5 tracking-wider">LAYOUT COLUMNS</div>
                {bipartiteColMeta.map((col, i) => (
                  <div key={col.type} className="flex items-center gap-2 text-[8px] font-mono">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                      background: col.type === 'SOURCE'
                        ? (EDGE_STYLES[activeLinkType]?.color ?? '#fff')
                        : (NODE_STYLES[col.type]?.color ?? '#6b7280')
                    }}/>
                    <span className="capitalize font-bold" style={{
                      color: col.type === 'SOURCE'
                        ? (EDGE_STYLES[activeLinkType]?.color ?? '#fff')
                        : (NODE_STYLES[col.type]?.color ?? '#6b7280')
                    }}>{col.type === 'SOURCE' ? 'Source' : col.type + 's'}</span>
                    <span className="text-muted-foreground/40">({col.count} nodes)</span>
                    {i === 0 && <span className="ml-auto text-muted-foreground/30 text-[7px]">center</span>}
                    {i > 0 && <span className="ml-auto text-muted-foreground/30 text-[7px]">col {i}</span>}
                  </div>
                ))}
              </div>
            )}
            </div>
            )}
          </div>
        )}

        {/* Graph Controls — (duplicate removed, moved above NODE FILTER) */}
        <div className="hidden">
          {/* Row 1: View toggle + Refresh + Save/Load */}
          <div className="flex items-center gap-1.5">
            {/* View Toggle — each button has a bouncing info dot + hover tooltip */}
            <div className="flex items-center gap-0 bg-foreground/[0.08] border border-foreground/8 rounded p-0.5">

              {/* NET button */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('network')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold font-mono transition-all ${
                    graphView === 'network' ? 'bg-foreground/10 text-foreground/80' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}>
                  <Network size={8}/> NET
                </button>
                {/* Tooltip — anchored left-0 so it opens rightward, never clips */}
                <div className="absolute top-full left-0 mt-2 w-56 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 pointer-events-none">
                  <div className="w-2 h-2 bg-background border-l border-t border-sky-400/25 rotate-45 ml-3 -mb-1"/>
                  <div className="bg-background border border-sky-400/25 rounded-lg p-3 shadow-xl" style={{ boxShadow: '0 0 20px rgba(56,189,248,0.12)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Network size={9} className="text-sky-400"/>
                      <span className="text-[9px] font-black font-mono tracking-widest text-sky-400">NETWORK VIEW</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      <div className="flex items-center gap-2"><span className="text-sky-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Force-directed entity graph</span></div>
                      <div className="flex items-center gap-2"><span className="text-sky-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Filter by link type &amp; relationship</span></div>
                      <div className="flex items-center gap-2"><span className="text-sky-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Bipartite &amp; radial layouts</span></div>
                    </div>
                    <div className="border-t border-sky-400/15 pt-2">
                      <span className="text-[8px] font-black font-mono text-sky-400/60 tracking-wider">BEST FOR</span>
                      <p className="text-[9px] text-sky-300/70 font-mono mt-1">Understanding who connects to whom and how information flows between entities</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* TREE button */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('tree')}
                  className={`flex items-center gap-1 px-2 py-1 rounded text-[9px] font-semibold font-mono transition-all ${
                    graphView === 'tree' ? 'bg-foreground/10 text-foreground/80' : 'text-muted-foreground/50 hover:text-muted-foreground'
                  }`}>
                  <TreePine size={8}/> TREE
                </button>
                {/* Tooltip — anchored left-0 so it opens rightward, never clips */}
                <div className="absolute top-full left-0 mt-2 w-56 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 pointer-events-none">
                  <div className="w-2 h-2 bg-background border-l border-t border-emerald-400/25 rotate-45 ml-3 -mb-1"/>
                  <div className="bg-background border border-emerald-400/25 rounded-lg p-3 shadow-xl" style={{ boxShadow: '0 0 20px rgba(52,211,153,0.12)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <TreePine size={9} className="text-emerald-400"/>
                      <span className="text-[9px] font-black font-mono tracking-widest text-emerald-400">TREE VIEW</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      <div className="flex items-center gap-2"><span className="text-emerald-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Entities grouped by type</span></div>
                      <div className="flex items-center gap-2"><span className="text-emerald-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Persons, Orgs, Countries, Agencies…</span></div>
                      <div className="flex items-center gap-2"><span className="text-emerald-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Radial bubble hierarchy</span></div>
                    </div>
                    <div className="border-t border-emerald-400/15 pt-2">
                      <span className="text-[8px] font-black font-mono text-emerald-400/60 tracking-wider">BEST FOR</span>
                      <p className="text-[9px] text-emerald-300/70 font-mono mt-1">Taxonomy &amp; classification — quickly see which entity types dominate a topic</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3D button — special violet/amber gradient treatment */}
              <div className="relative group">
                <button
                  onClick={() => setGraphView('3d')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-[9px] font-black font-mono tracking-wide transition-all ${
                    graphView === '3d'
                      ? 'text-violet-200 border border-violet-400/40'
                      : 'text-violet-400/50 hover:text-violet-300/80 border border-transparent hover:border-violet-400/20'
                  }`}
                  style={graphView === '3d' ? {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.22) 0%, rgba(251,191,36,0.10) 100%)',
                    boxShadow: '0 0 14px rgba(139,92,246,0.25), inset 0 1px 0 oklch(from var(--foreground) l c h / 0.06)',
                  } : {
                    background: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(251,191,36,0.03) 100%)',
                  }}>
                  <Box size={8}/> 3D
                </button>
                {/* Tooltip — centered below 3D button (it's rightmost so centering is safe) */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-60 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-all duration-200 z-50 pointer-events-none">
                  <div className="w-2 h-2 bg-background border-l border-t border-violet-400/30 rotate-45 mx-auto -mb-1"/>
                  <div className="bg-background border border-violet-400/30 rounded-lg p-3 shadow-xl" style={{ boxShadow: '0 0 24px rgba(139,92,246,0.18)' }}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Box size={9} className="text-violet-400"/>
                      <span className="text-[9px] font-black font-mono tracking-widest text-violet-300">3D INTEL VIEW</span>
                      <span className="ml-auto text-[7px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(251,191,36,0.12)', color: 'rgba(251,191,36,0.8)', border: '1px solid rgba(251,191,36,0.2)' }}>ADVANCED</span>
                    </div>
                    <div className="space-y-1.5 mb-2">
                      <div className="flex items-center gap-2"><span className="text-violet-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Full 3D force-directed scene</span></div>
                      <div className="flex items-center gap-2"><span className="text-violet-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Select nodes → isolate 1°/2° connections</span></div>
                      <div className="flex items-center gap-2"><span className="text-amber-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Build INTEL STORYBOARD paths</span></div>
                      <div className="flex items-center gap-2"><span className="text-violet-400/70 text-[10px] leading-none flex-shrink-0">›</span><span className="text-[9px] text-muted-foreground font-mono">Export scene as PNG</span></div>
                    </div>
                    <div className="border-t border-violet-400/15 pt-2">
                      <span className="text-[8px] font-black font-mono text-violet-400/60 tracking-wider">BEST FOR</span>
                      <p className="text-[9px] text-violet-300/70 font-mono mt-1">Deep investigation — uncover hidden chains and build intelligence narratives</p>
                    </div>
                  </div>
                </div>
              </div>

            </div>
            <button onClick={() => refetchGraph()}
              className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-foreground/60 transition-colors font-mono border border-foreground/8 rounded px-1.5 py-1">
              <RefreshCw size={8}/>
            </button>
            <div className="ml-auto flex items-center gap-1.5">
              {graphLoading && <span className="text-[9px] text-emerald-400/60 font-mono animate-pulse">SCAN...</span>}
              <button
                onClick={() => setShowSavedList(true)}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-yellow-400/70 transition-colors font-mono"
                title="View saved investigations">
                <FolderOpen size={9}/> Load
              </button>
              <button
                onClick={() => nodeCount > 0 && setShowSaveModal(true)}
                disabled={nodeCount === 0}
                className="flex items-center gap-1 text-[9px] text-muted-foreground/60 hover:text-emerald-400/70 transition-colors font-mono disabled:opacity-20 disabled:cursor-not-allowed"
                title={nodeCount === 0 ? 'Search first to build a graph' : 'Save this investigation'}>
                <BookmarkPlus size={9}/> Save
              </button>
            </div>
          </div>
          {/* Row 2: Organize / De-organize (only in network view with nodes) */}
          {graphView === 'network' && nodeCount > 0 && (
            <div className="flex items-center gap-1">
              {!isOrganized ? (
                <button
                  onClick={handleOrganize}
                  title={selectedNode ? `Radial layout around ${selectedNode.label}` : 'Arrange nodes in radial layout'}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-muted-foreground/70 hover:text-emerald-400/80 border border-foreground/8 hover:border-emerald-400/25 transition-all font-mono">
                  <Orbit size={8}/> ORGANIZE
                  {selectedNode && <span className="text-[8px] text-muted-foreground/40 truncate max-w-[60px]">&#x2192; {selectedNode.label.substring(0,10)}</span>}
                </button>
              ) : (
                <button
                  onClick={handleDeorganize}
                  title="Reset to physics simulation layout"
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] text-emerald-400/70 hover:text-foreground/60 border border-emerald-400/25 hover:border-white/15 bg-emerald-400/5 hover:bg-transparent transition-all font-mono">
                  <Shuffle size={8}/> DE-ORGANIZE
                </button>
              )}
            </div>
          )}
        </div>

        {/* Selected Node Detail / Legend */}
        {selectedNode ? (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Classified dossier header */}
            <div className="border border-foreground/10 rounded bg-black/30 p-2.5 mb-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <Shield size={9} className="text-muted-foreground/60"/>
                  <span className="text-[8px] font-mono text-muted-foreground/60 tracking-[0.2em]">DOSSIER</span>
                </div>
                <button onClick={() => setSelectedNode(null)} className="text-muted-foreground/60 hover:text-foreground/60 transition-colors"><X size={11}/></button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest font-mono"
                  style={{ background: `${NODE_STYLES[selectedNode.type]?.color ?? '#22d3ee'}15`, color: NODE_STYLES[selectedNode.type]?.color ?? '#22d3ee', border: `1px solid ${NODE_STYLES[selectedNode.type]?.color ?? '#22d3ee'}30` }}>
                  {selectedNode.type}
                </span>
              </div>
              <div className="text-[12px] font-semibold text-foreground leading-snug">{selectedNode.label}</div>
            </div>

            {selectedNode.type === 'article' && (
              <div className="space-y-2">
                {selectedNode.summary && <div className="text-[11px] text-muted-foreground leading-relaxed bg-background/50 rounded p-2">{selectedNode.summary}</div>}
                {selectedNode.country && <div className="flex items-center gap-1.5 text-xs"><MapPin size={10} className="text-green-400"/><span className="text-muted-foreground">Country:</span><span className="text-foreground font-medium">{selectedNode.country}</span></div>}
                {selectedNode.sentiment && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <Activity size={10} className={selectedNode.sentiment === 'negative' ? 'text-red-400' : selectedNode.sentiment === 'positive' ? 'text-green-400' : 'text-yellow-400'}/>
                    <span className="text-muted-foreground">Sentiment:</span>
                    <span className={`font-medium capitalize ${selectedNode.sentiment === 'negative' ? 'text-red-400' : selectedNode.sentiment === 'positive' ? 'text-green-400' : 'text-yellow-400'}`}>{selectedNode.sentiment}</span>
                  </div>
                )}
                {selectedNode.publishedAt && <div className="flex items-center gap-1.5 text-xs"><Clock size={10} className="text-muted-foreground"/><span className="text-muted-foreground">{new Date(selectedNode.publishedAt).toLocaleString()}</span></div>}
                {Array.isArray(selectedNode.topics) && selectedNode.topics.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedNode.topics.map((t: string) => (
                      <span key={t} className="text-[9px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: `${TOPIC_COLORS[t] ?? '#22d3ee'}18`, color: TOPIC_COLORS[t] ?? '#22d3ee' }}>{t}</span>
                    ))}
                  </div>
                )}
                <a href={selectedNode.url && !selectedNode.url.includes('example.com') && selectedNode.url.startsWith('http')
                    ? selectedNode.url
                    : `https://news.google.com/search?q=${encodeURIComponent(selectedNode.label ?? '')}&hl=en-US&gl=US&ceid=US:en`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium mt-2">
                  <ExternalLink size={10}/> Read Full Article
                </a>
              </div>
            )}

            {['person','author','organization','country','agency'].includes(selectedNode.type) && (
              <div className="space-y-2">
                <div className="text-[11px] text-muted-foreground">
                  {selectedNode.type === 'person' && 'Person mentioned in articles'}
                  {selectedNode.type === 'author' && 'Article author'}
                  {selectedNode.type === 'organization' && 'Organization referenced in articles'}
                  {selectedNode.type === 'country' && 'Country covered in articles'}
                  {selectedNode.type === 'agency' && `News agency${selectedNode.country ? ` · ${selectedNode.country}` : ''}`}
                </div>
                {selectedNode.website && (
                  <a href={selectedNode.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-primary hover:underline font-medium">
                    <ExternalLink size={10}/> Visit Website
                  </a>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <button onClick={() => handleEntityClick(selectedNode.label)}
                    className="flex items-center gap-1 text-[11px] text-primary font-medium border border-primary/30 rounded px-2 py-1 hover:bg-primary/5 transition-all">
                    <Search size={9}/> Explore "{selectedNode.label.substring(0, 20)}"
                  </button>
                  <a href={`https://news.google.com/search?q=${encodeURIComponent(selectedNode.label)}&hl=en-US&gl=US&ceid=US:en`}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium border border-border rounded px-2 py-1 hover:bg-muted/50 transition-all">
                    <ExternalLink size={9}/> Google News
                  </a>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-3">
            {/* Node type legend */}
            <div className="text-[8px] text-muted-foreground/50 font-mono mb-2 tracking-[0.2em]">NODE REGISTRY</div>
            <div className="space-y-1 mb-4">
              {NODE_TYPES.filter(t => t !== 'keyword').map(type => {
                const style = NODE_STYLES[type];
                return (
                  <div key={type} className="flex items-center gap-2.5 py-0.5">
                    <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: `${style.color}15`, border: `1px solid ${style.color}50` }}/>
                    <span className="text-[10px] text-muted-foreground capitalize font-mono">{type}</span>
                  </div>
                );
              })}
            </div>
            {/* Edge legend */}
            <div className="text-[8px] text-muted-foreground/50 font-mono mb-2 tracking-[0.2em]">LINK TYPES</div>
            <div className="space-y-1 mb-4">
              {Object.entries(EDGE_STYLES).map(([label, es]) => (
                <div key={label} className="flex items-center gap-2">
                  <div className="flex items-center gap-0.5">
                    <div className="h-px w-5" style={{ background: es.color + '80', borderTop: es.dashes ? `1px dashed ${es.color}60` : undefined }}/>
                    <div className="w-1 h-1 rounded-full" style={{ background: es.color + '80' }}/>
                  </div>
                  <span className="text-[9px] text-muted-foreground/70 capitalize font-mono">{label}</span>
                </div>
              ))}
            </div>
            {/* Usage guide */}
            <div className="p-2 bg-black/30 rounded border border-foreground/8 space-y-2">
              <div className="text-[8px] text-muted-foreground/50 font-mono tracking-[0.15em]">OPERATOR GUIDE</div>
              <div className="space-y-1">
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/70"><span className="text-emerald-400/50 font-mono">›</span><span>Enter query → RUN to build network</span></div>
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/70"><span className="text-emerald-400/50 font-mono">›</span><span>Click node for dossier · hover for intel</span></div>
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/70"><span className="text-emerald-400/50 font-mono">›</span><span>Double-click to zoom · scroll to navigate</span></div>
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/70"><span className="text-emerald-400/50 font-mono">›</span><span>ORGANIZE to radially arrange around entity</span></div>
                <div className="flex items-start gap-1.5 text-[9px] text-muted-foreground/70"><span className="text-emerald-400/50 font-mono">›</span><span>Switch NETWORK ↔ TREE for different views</span></div>
              </div>
              <div className="border-t border-white/5 pt-2">
                <div className="text-[8px] text-muted-foreground/40 font-mono tracking-[0.15em] mb-1">KEYBOARD</div>
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50"><kbd className="px-1 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[8px] font-mono">Enter</kbd><span>Run search</span></div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50"><kbd className="px-1 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[8px] font-mono">Esc</kbd><span>Clear selection</span></div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50"><kbd className="px-1 py-0.5 bg-foreground/5 border border-foreground/10 rounded text-[8px] font-mono">Scroll</kbd><span>Zoom network</span></div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ─── Center: Network Graph + Timeline ────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Timeline — SIGINT Waveform */}
        <div className="border-b border-foreground/8 bg-background flex-shrink-0">
          {/* Timeline header — always visible, click to expand/collapse */}
          <button
            onClick={() => setTimelineCollapsed(c => !c)}
            className="w-full flex items-center gap-3 px-4 py-2 hover:bg-foreground/3 transition-colors group">
            {/* Left: label */}
            <Radio size={9} className="text-muted-foreground/60 flex-shrink-0"/>
            <span className="text-[8px] font-mono text-muted-foreground/60 tracking-[0.25em] flex-shrink-0">SIGNAL WAVEFORM</span>
            {/* Middle: compact stats shown when collapsed */}
            {timelineCollapsed && timelineSummary && (
              <div className="flex items-center gap-3 flex-1 overflow-hidden">
                <span className="text-[8px] font-mono text-muted-foreground">{timelineSummary.total} <span className="text-muted-foreground/50">signals</span></span>
                {timelineSummary.hostile > 0 && (
                  <span className="text-[8px] font-mono text-red-400/60">{timelineSummary.hostile} <span className="text-red-400/35">hostile</span></span>
                )}
                {timelineSummary.positive > 0 && (
                  <span className="text-[8px] font-mono text-green-400/60">{timelineSummary.positive} <span className="text-green-400/35">positive</span></span>
                )}
                {timelineSummary.peak && (
                  <span className="text-[8px] font-mono text-muted-foreground/50 hidden lg:inline">peak <span className="text-yellow-400/55">{timelineSummary.peak}</span> <span className="text-muted-foreground/40">({timelineSummary.peakCount})</span></span>
                )}
              </div>
            )}
            {timelineCollapsed && !timelineSummary && <div className="flex-1"/>}
            {!timelineCollapsed && <div className="flex-1"/>}
            {/* Right: expand/collapse cue */}
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {timelineCollapsed ? (
                <span className="text-[7px] font-mono text-muted-foreground/40 group-hover:text-emerald-400/50 transition-colors tracking-wider">EXPAND</span>
              ) : (
                <span className="text-[7px] font-mono text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors tracking-wider">COLLAPSE</span>
              )}
              <span className="text-muted-foreground/40 group-hover:text-muted-foreground/80 transition-colors">
                {timelineCollapsed ? <ChevronsUpDown size={10}/> : <ChevronsDownUp size={10}/>}
              </span>
            </div>
          </button>
          {/* Always render TimelineBar so it fetches data and bubbles stats even when collapsed */}
          <div className={timelineCollapsed ? 'hidden' : 'px-4 pb-2'}>
            <TimelineBar
              region={region}
              selectedDate={timelineDate}
              onDateSelect={(date) => {
                setTimelineDate(date);
                setSelectedNode(null);
                setIsOrganized(false);
              }}
              onSummary={setTimelineSummary}
            />
          </div>
        </div>

        {/* Graph */}
          <div className="flex-1 relative overflow-hidden">
          <GraphErrorBoundary onReset={() => refetchGraph()}>
          {graphLoading && (
            <div className="absolute inset-0 flex items-center justify-center z-10 bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="relative">
                  <div className="w-10 h-10 border border-emerald-400/30 border-t-emerald-400/80 rounded-full animate-spin"/>
                  <Crosshair size={14} className="absolute inset-0 m-auto text-emerald-400/60"/>
                </div>
                <span className="text-[10px] text-muted-foreground/80 font-mono tracking-[0.2em]">{graphView === 'tree' ? 'BUILDING TREE...' : graphView === '3d' ? 'INITIALIZING 3D...' : 'MAPPING NETWORK...'}</span>
              </div>
            </div>
          )}
          {graphView === 'network' ? (
            <VisNetworkGraph
              nodes={renderGraphData?.nodes ?? []}
              edges={renderGraphData?.edges ?? []}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              selectedNodeId={selectedNode?.id ?? null}
              graphFilter={graphFilter}
              showConnectionsOnly={showConnectionsOnly}
              networkRef={externalNetworkRef}
              primaryNodeId={primaryNodeId}
              activeLinkType={activeLinkType}
              bipartiteColMeta={bipartiteColMeta}
              bipartiteData={bipartiteData}
            />
          ) : graphView === '3d' ? (
            <div className="absolute inset-0">
              <GraphErrorBoundary onReset={() => setGraphView('network')}>
                <ForceGraph3DView
                  nodes={renderGraphData?.nodes ?? []}
                  edges={renderGraphData?.edges ?? []}
                  onNodeClick={(node) => {
                    handleNodeClick(node);
                  }}
                  selectedNodeId={selectedNode?.id ?? null}
                  primaryNodeId={primaryNodeId}
                  activeLinkType={isBipartite ? activeLinkType : null}
                  graphApiRef={graph3dApiRef}
                  onSaveStoryboard={(narrative, title) => {
                    saveInvestigationMutation.mutate({
                      title,
                      note: narrative,
                      query: activeSearch || undefined,
                      region,
                      nodeCount: renderGraphData?.nodes?.length ?? 0,
                      edgeCount: renderGraphData?.edges?.length ?? 0,
                    });
                  }}
                />
              </GraphErrorBoundary>
            </div>
          ) : (
            <div className="absolute inset-0 p-4">
              <ForceDirectedTree
                data={treeData}
                dataKey={`${activeSearch || region}-${renderGraphData?.nodes?.length ?? 0}`}
                title={`Entity Tree — ${activeSearch || region}`}
                onNodeClick={(name) => {
                  // Look up the node's type from the map (leaf nodes only — skip group headers like 'Persons')
                  const resolved = treeNodeMap.get(name);
                  if (resolved) {
                    // Leaf node: open deep-dive panel for non-article/keyword/facility nodes
                    if (resolved.type !== 'article' && resolved.type !== 'keyword' && resolved.type !== 'facility' && resolved.type !== 'unknown') {
                      setDeepDiveNode({ name: resolved.fullLabel, type: resolved.type });
                    } else {
                      // For article/keyword nodes, trigger a search instead
                      handleEntityClick(resolved.fullLabel);
                    }
                  }
                  // Group header nodes (e.g. 'Persons', 'Organizations') — no action, amCharts handles collapse/expand
                }}
              />
            </div>
          )}
          {/* Entity Deep-Dive Panel — slides in from right over the graph */}
          {deepDiveNode && (
            <EntityDeepDivePanel
              entityName={deepDiveNode.name}
              entityType={deepDiveNode.type}
              region={region}
              onClose={() => setDeepDiveNode(null)}
              onHighlightNode={(name) => {
                // Highlight the node in the current graph without a new search
                handleHighlightNode(name);
              }}
              onExploreEntity={(name) => {
                setDeepDiveNode(null);
                // Switch to Network view so the graph is visible when exploring
                setGraphView('network');
                handleEntityClick(name);
              }}
            />
          )}
          {nodeCount > 0 && (
            <div className="absolute top-2 right-2 flex items-center gap-2">
              {/* Bipartite mode badge */}
              {isBipartite && activeLinkType && (
                <div className="flex items-center gap-1.5 px-2 py-1 bg-card/90 border rounded text-[9px] font-mono"
                  style={{ borderColor: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + '40' }}>
                  <div className="w-1 h-1 rounded-full" style={{ background: EDGE_STYLES[activeLinkType]?.color ?? '#f472b6' }}/>
                  <span style={{ color: EDGE_STYLES[activeLinkType]?.color ?? '#f472b6' }} className="font-bold uppercase tracking-wider">{activeLinkType}</span>
                  <span className="text-muted-foreground/50 mx-1">·</span>
                  <span className="text-pink-400/60">LEFT</span>
                  <span className="text-muted-foreground/40 mx-0.5">→</span>
                  <span className="text-cyan-400/60">RIGHT</span>
                  <button onClick={handleExitBipartite} className="ml-1.5 text-muted-foreground/50 hover:text-red-400/70 transition-colors">
                    <X size={9}/>
                  </button>
                </div>
              )}
              {/* PNG export button — only shown in bipartite mode */}
              {isBipartite && activeLinkType && (
                <button
                  onClick={() => {
                    const net = externalNetworkRef.current;
                    if (!net) return;
                    try {
                      // vis-network exposes canvas via body.container
                      const canvas: HTMLCanvasElement | null = net.body?.container?.querySelector('canvas');
                      if (!canvas) return;
                      // Composite: draw dark background + graph canvas onto a new canvas
                      const exportCanvas = document.createElement('canvas');
                      exportCanvas.width = canvas.width;
                      exportCanvas.height = canvas.height;
                      const ctx = exportCanvas.getContext('2d')!;
                      ctx.fillStyle = '#060b12';
                      ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
                      ctx.drawImage(canvas, 0, 0);
                      // Watermark
                      ctx.font = 'bold 11px "JetBrains Mono", monospace';
                      ctx.fillStyle = 'oklch(from var(--foreground) l c h / 0.18)';
                      ctx.textAlign = 'right';
                      ctx.fillText(`LINK TYPE: ${activeLinkType.toUpperCase()} · INTEL EXPLORER`, exportCanvas.width - 12, exportCanvas.height - 12);
                      const link = document.createElement('a');
                      link.download = `intel-graph-${activeLinkType}-${new Date().toISOString().slice(0,10)}.png`;
                      link.href = exportCanvas.toDataURL('image/png');
                      link.click();
                    } catch (err) {
                      console.error('[Export] Failed to export graph:', err);
                    }
                  }}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-semibold font-mono border transition-all"
                  style={{
                    background: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + '12',
                    borderColor: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + '30',
                    color: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + 'cc',
                  }}
                  title="Export bipartite graph as PNG"
                >
                  <Download size={9}/> PNG
                </button>
              )}
              <div className="flex items-center gap-1.5 px-2 py-1 bg-card/90 border border-foreground/8 rounded text-[9px] font-mono text-muted-foreground/80">
                <span>{nodeCount} <span className="text-muted-foreground/40">nodes</span></span>
                <span className="text-muted-foreground/30">·</span>
                <span>{isBipartite && activeLinkType ? (linkTypeCounts[activeLinkType] ?? 0) : showConnectionsOnly && graphFilter.length >= 2 ? filteredConnectionCount : edgeCount} <span className="text-muted-foreground/40">edges</span></span>
                {(isBipartite || (showConnectionsOnly && graphFilter.length >= 2)) && (
                  <span className="text-[8px] border rounded px-1 ml-0.5"
                    style={{ color: isBipartite ? (EDGE_STYLES[activeLinkType ?? '']?.color ?? '#f472b6') + 'cc' : '#22d3ee99', borderColor: isBipartite ? (EDGE_STYLES[activeLinkType ?? '']?.color ?? '#f472b6') + '30' : '#22d3ee30' }}>
                    {isBipartite ? 'bipartite' : 'filtered'}
                  </span>
                )}
              </div>
              <button
                onClick={() => setShowSaveModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-semibold font-mono bg-emerald-400/10 border border-emerald-400/25 text-emerald-400/70 hover:bg-emerald-400/20 transition-all"
              >
                <BookmarkPlus size={9}/> SAVE
              </button>
            </div>
          )}
          {/* Floating LINK TYPES panel — bottom-left of graph area */}
          {edgeCount > 0 && !isBipartite && (
            <div className="absolute bottom-3 left-3 z-10">
              <div className="bg-background/95 border border-foreground/8 rounded-lg overflow-hidden shadow-2xl" style={{ minWidth: 140 }}>
                <div className="px-2.5 py-1.5 border-b border-foreground/6 flex items-center gap-1.5">
                  <GitMerge size={8} className="text-muted-foreground/50"/>
                  <span className="text-[8px] font-mono text-muted-foreground/50 tracking-widest">LINK TYPES</span>
                </div>
                <div className="px-2 py-1.5 space-y-1">
                  {Object.entries(EDGE_STYLES).map(([label, es]) => {
                    const count = linkTypeCounts[label] ?? 0;
                    if (count === 0) return null;
                    const breakdown = linkTypeTargetBreakdown[label] ?? {};
                    const topTypes = Object.entries(breakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);
                    return (
                      <button key={label}
                        onClick={() => handleBipartiteLayout(label)}
                        disabled={!externalNetworkRef.current}
                        className="w-full flex items-center gap-2 px-1.5 py-1 rounded hover:bg-foreground/5 transition-all text-left group disabled:opacity-30"
                        title={`Visualize "${label}" relationships`}>
                        <div className="flex items-center gap-0.5 flex-shrink-0">
                          <div className="h-px w-3" style={{ background: es.color + '80', borderTop: es.dashes ? `1px dashed ${es.color}80` : undefined }}/>
                          <div className="w-1 h-1 rounded-full" style={{ background: es.color + '80' }}/>
                        </div>
                        <span className="text-[8.5px] font-mono capitalize flex-1 text-muted-foreground/80 group-hover:text-foreground/70 transition-colors">{label}</span>
                        <div className="flex items-center gap-0.5">
                          {topTypes.map(([type]) => (
                            <div key={type} className="w-1.5 h-1.5 rounded-full" style={{ background: NODE_STYLES[type]?.color ?? '#6b7280' }} title={type}/>
                          ))}
                        </div>
                        <span className="text-[7.5px] font-mono text-muted-foreground/35 flex-shrink-0">{count}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
          {/* Bipartite mode: multi-column type labels */}
          {isBipartite && activeLinkType && nodeCount > 0 && bipartiteColMeta.length > 0 && (
            <div className="absolute bottom-3 left-3 z-10">
              <div className="bg-background/95 border rounded-lg overflow-hidden shadow-2xl"
                style={{ minWidth: 160, borderColor: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + '30' }}>
                <div className="px-2.5 py-1.5 border-b flex items-center gap-1.5"
                  style={{ borderColor: (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6') + '20' }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: EDGE_STYLES[activeLinkType]?.color ?? '#f472b6' }}/>
                  <span className="text-[8px] font-mono font-bold tracking-widest uppercase"
                    style={{ color: EDGE_STYLES[activeLinkType]?.color ?? '#f472b6' }}>{activeLinkType}</span>
                  <span className="text-[7px] font-mono text-muted-foreground/40 ml-auto">LAYOUT</span>
                </div>
                <div className="px-2 py-1.5 space-y-1">
                  {bipartiteColMeta.map((col, i) => {
                    const isSource = col.type === 'SOURCE';
                    const colColor = isSource
                      ? (EDGE_STYLES[activeLinkType]?.color ?? '#f472b6')
                      : (NODE_STYLES[col.type]?.color ?? '#6b7280');
                    return (
                      <div key={col.type} className="flex items-center gap-2 text-[8px] font-mono">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: colColor }}/>
                        <span className="capitalize font-bold flex-1" style={{ color: colColor }}>
                          {isSource ? 'Source' : col.type + 's'}
                        </span>
                        <span className="text-muted-foreground/40">{col.count}</span>
                        <span className="text-[7px] text-muted-foreground/30">{i === 0 ? 'center' : `col ${i}`}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="px-2 py-1.5 border-t border-foreground/6">
                  <button onClick={handleExitBipartite}
                    className="w-full text-[8px] font-mono text-muted-foreground/50 hover:text-red-400/60 transition-colors text-center tracking-wider">
                    EXIT LAYOUT
                  </button>
                </div>
              </div>
            </div>
          )}
          </GraphErrorBoundary>
        </div>
      </div>

      {/* ─── ALL DATA Warning Modal ────────────────────────────────────── */}
      {showAllDataWarning && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-foreground/60 backdrop-blur-sm">
          <div className="relative max-w-sm w-full mx-4 rounded-lg overflow-hidden"
            style={{ border: '1px solid rgba(239,68,68,0.45)', boxShadow: '0 0 40px rgba(239,68,68,0.20), 0 0 80px oklch(from var(--foreground) l c h / 0.3)' }}>
            {/* Red classified header */}
            <div className="px-4 py-3 flex items-center gap-2.5" style={{ background: 'rgba(239,68,68,0.18)', borderBottom: '1px solid rgba(239,68,68,0.30)' }}>
              <AlertTriangle size={14} className="text-red-400 flex-shrink-0"/>
              <span className="text-[11px] font-black font-mono tracking-[0.2em] text-red-400">CRITICAL WARNING</span>
              <div className="ml-auto flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"/>
                <span className="text-[8px] font-mono text-red-400/60 tracking-widest">SYSTEM ALERT</span>
              </div>
            </div>
            {/* Body */}
            <div className="px-4 py-4 space-y-3" style={{ background: 'var(--card)' }}>
              <div className="text-[11px] font-bold text-foreground leading-snug">
                Rendering ALL data may crash your browser
              </div>
              <div className="space-y-2 text-[10px] text-muted-foreground font-mono leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-red-400/70 flex-shrink-0 mt-0.5">›</span>
                  <span>Loading thousands of nodes and edges simultaneously consumes significant browser memory and GPU resources.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-red-400/70 flex-shrink-0 mt-0.5">›</span>
                  <span>The browser tab may become unresponsive or crash entirely. Unsaved work will be lost.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-yellow-400/70 flex-shrink-0 mt-0.5">›</span>
                  <span>It is strongly recommended to select a specific time window (3D / 7D / 14D / 30D) instead.</span>
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t border-foreground/8">
                <button
                  onClick={() => {
                    setShowAllDataWarning(false);
                    setPendingTimeWindow(null);
                  }}
                  className="flex-1 py-2 rounded text-[10px] font-black font-mono border border-white/15 text-muted-foreground hover:text-foreground/80 hover:border-foreground/30 transition-all tracking-wider"
                  style={{ background: 'oklch(from var(--foreground) l c h / 0.04)' }}>
                  CANCEL
                </button>
                <button
                  onClick={() => {
                    if (pendingTimeWindow) setGraphTimeWindow(pendingTimeWindow as any);
                    setShowAllDataWarning(false);
                    setPendingTimeWindow(null);
                  }}
                  className="flex-1 py-2 rounded text-[10px] font-black font-mono transition-all tracking-wider"
                  style={{ background: 'rgba(239,68,68,0.20)', border: '1px solid rgba(239,68,68,0.45)', color: '#f87171' }}>
                  LOAD ALL DATA
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Save Investigation Modal ────────────────────────────────── */}
      {showSaveModal && (
        <SaveInvestigationModal
          query={activeSearch}
          region={region}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          graphFilter={graphFilter}
          topEntities={entityData.people.slice(0,5).map(([name,count])=>({name,type:'person',count}))
            .concat(entityData.orgs.slice(0,3).map(([name,count])=>({name,type:'organization',count})))
            .concat(entityData.publishers.slice(0,2).map(([name,count])=>({name,type:'agency',count})))}
          topTopics={topicData.slice(0,8).map(([topic,count])=>({topic,count}))}
          topCountries={countryData.slice(0,5).map(([country,count])=>({country,count}))}
          onClose={() => setShowSaveModal(false)}
          onSaved={() => setShowSaveModal(false)}
        />
      )}

      {/* ─── Saved Investigations List ────────────────────────────────── */}
      {showSavedList && (
        <SavedInvestigationsList
          region={region}
          onLoad={(q) => {
            setShowSavedList(false);
            setSelectedNode(null);
            setDeepDiveNode(null);
            setGraphView('network');
            setIsOrganized(false);
            setSearchInput(q);
            if (q === activeSearch) {
              // Same query — force a refetch via loadKey bump
              setLoadKey(k => k + 1);
            } else {
              setActiveSearch(q);
            }
          }}
          onClose={() => setShowSavedList(false)}
        />
      )}

      {/* Show-panel tab — only visible when right panel is hidden */}
      {!rightPanelVisible && (
        <div className="flex-shrink-0 border-l border-foreground/8 bg-card flex flex-col">
          <button
            onClick={() => setRightPanelVisible(true)}
            title="Show panel"
            className="flex flex-col items-center justify-center gap-1.5 px-2 py-3 text-muted-foreground/60 hover:text-emerald-400/70 hover:bg-emerald-400/5 transition-all h-full"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M4 2l4 3-4 3V2z"/><rect x="1.5" y="2" width="1.5" height="6" rx="0.5"/></svg>
            <span className="text-[7px] font-mono font-bold tracking-widest" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>PANEL</span>
          </button>
        </div>
      )}

      {/* ─── Right Panel: Entities / Geo / Topics ─ resizable + collapsible ── */}
      <div
        className="flex-shrink-0 border-l border-foreground/8 bg-card flex flex-col overflow-hidden relative transition-all duration-200"
        style={{ width: rightPanelVisible ? rightPanelWidth : 0, minWidth: rightPanelVisible ? 180 : 0, maxWidth: 520 }}
      >
        {/* Drag-resize handle on left edge */}
        {rightPanelVisible && (
          <div
            className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-30 group hover:bg-emerald-400/20 transition-colors"
            onMouseDown={e => {
              e.preventDefault();
              rightPanelDragRef.current = { startX: e.clientX, startWidth: rightPanelWidth };
              const onMove = (ev: MouseEvent) => {
                if (!rightPanelDragRef.current) return;
                const delta = rightPanelDragRef.current.startX - ev.clientX;
                const newW = Math.max(180, Math.min(520, rightPanelDragRef.current.startWidth + delta));
                setRightPanelWidth(newW);
              };
              const onUp = () => {
                rightPanelDragRef.current = null;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-foreground/10 group-hover:bg-emerald-400/50 transition-colors"/>
          </div>
        )}

        {/* Panel Tabs */}
        <div className="flex border-b border-foreground/8 bg-black/30 flex-shrink-0">
          <button
            onClick={() => setRightPanelVisible(v => !v)}
            title="Hide panel"
            className="flex items-center justify-center px-2 py-2.5 text-muted-foreground/60 hover:text-emerald-400/70 hover:bg-emerald-400/5 transition-all border-r border-foreground/8 flex-shrink-0"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M6 2l-4 3 4 3V2z"/><rect x="7" y="2" width="1.5" height="6" rx="0.5"/></svg>
          </button>
          {([
            { key:'entities', label:'ENTITIES', icon:<Database size={9}/> },
            { key:'geo',      label:'GEO',      icon:<Globe size={9}/> },
            { key:'topics',   label:'TOPICS',   icon:<Tag size={9}/> },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setRightPanel(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[9px] font-black font-mono tracking-widest transition-all ${
                rightPanel === tab.key ? 'text-emerald-400/80 border-b border-emerald-400/40 bg-emerald-400/5' : 'text-muted-foreground/50 hover:text-muted-foreground'
              }`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Entities Panel ── */}
          {rightPanel === 'entities' && (
            <div className="p-3 space-y-3">
              {entityData.people.length > 0 && (
                <EntitySection title="People" icon={<Users size={11} className="text-pink-400"/>} color="#f472b6">
                  {entityData.people.slice(0, 12).map(([name, count]) => (
                    <EntityRow key={name} label={name} count={count} type="person" onClick={() => handleEntityClick(name)} />
                  ))}
                </EntitySection>
              )}
              {entityData.orgs.length > 0 && (
                <EntitySection title="Organizations" icon={<Building2 size={11} className="text-orange-400"/>} color="#fb923c">
                  {entityData.orgs.slice(0, 12).map(([name, count]) => (
                    <EntityRow key={name} label={name} count={count} type="organization" onClick={() => handleEntityClick(name)} />
                  ))}
                </EntitySection>
              )}
              {entityData.publishers.length > 0 && (
                <EntitySection title="Publishers" icon={<Newspaper size={11} className="text-yellow-400"/>} color="#f59e0b">
                  {entityData.publishers.slice(0, 8).map(([name, count]) => (
                    <EntityRow key={name} label={name} count={count} type="agency" onClick={() => handleEntityClick(name)} />
                  ))}
                </EntitySection>
              )}
              {entityData.authors.length > 0 && (
                <EntitySection title="Authors" icon={<BookOpen size={11} className="text-purple-400"/>} color="#a78bfa" defaultExpanded={false}>
                  {entityData.authors.slice(0, 8).map(([name, count]) => (
                    <EntityRow key={name} label={name} count={count} type="author" onClick={() => handleEntityClick(name)} />
                  ))}
                </EntitySection>
              )}
              {entityData.keywords.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Tag size={11} className="text-muted-foreground"/>
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Keywords</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entityData.keywords.slice(0, 20).map(([kw, count]) => (
                      <button key={kw} onClick={() => handleEntityClick(kw)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/40 transition-all">
                        {kw}<span className="text-[8px] opacity-60">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {entityData.people.length === 0 && entityData.orgs.length === 0 && entityData.publishers.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-[10px] font-mono text-muted-foreground/40 mb-2">[ NO ENTITIES ]</div>
                  <div className="text-[9px] text-muted-foreground/30 font-mono">Run a query to extract entities</div>
                </div>
              )}
            </div>
          )}

          {/* ── Geo Panel ── */}
          {rightPanel === 'geo' && (
            <div className="p-3 space-y-3">
              <div className="text-[8px] text-muted-foreground/50 font-mono flex items-center gap-1.5 mb-2 tracking-[0.2em]">
                <Globe size={8}/> GEO COVERAGE — {countryData.length} COUNTRIES
              </div>
              {countryData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-[10px] font-mono text-muted-foreground/40">[ NO GEO DATA ]</div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {countryData.map(([country, count], i) => {
                    const maxCount = countryData[0][1];
                    const pct = (count / maxCount) * 100;
                    const gnUrl = `https://news.google.com/search?q=${encodeURIComponent(country + ' ' + (activeSearch || region))}&hl=en-US&gl=US&ceid=US:en`;
                    return (
                      <div key={country} className="group">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[9px] text-muted-foreground font-mono w-4">{i+1}</span>
                          <span className="text-xs font-medium text-foreground flex-1">{country}</span>
                          <span className="text-[10px] font-bold text-primary font-mono">{count}</span>
                          <a href={gnUrl} target="_blank" rel="noopener noreferrer"
                            className="text-[9px] text-muted-foreground hover:text-primary transition-colors opacity-0 group-hover:opacity-100">
                            <ExternalLink size={9}/>
                          </a>
                        </div>
                        <div className="ml-6 h-1 bg-border/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: 'linear-gradient(to right, var(--primary), #22d3ee)' }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {entityData.locations.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 mb-2">
                    <MapPin size={10}/> Locations Mentioned
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {entityData.locations.slice(0, 15).map(([loc, count]) => (
                      <button key={loc} onClick={() => handleEntityClick(loc)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all hover:opacity-80"
                        style={{ background: '#10b98118', border: '1px solid #10b98140', color: '#10b981' }}>
                        {loc}<span className="text-[8px] opacity-60">{count}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Topics Panel ── */}
          {rightPanel === 'topics' && (
            <div className="p-3 space-y-3">
              <div className="text-[8px] text-muted-foreground/50 font-mono flex items-center gap-1.5 mb-2 tracking-[0.2em]">
                <Tag size={8}/> TOPIC CLASSIFICATION
              </div>
              {topicData.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-[10px] font-mono text-muted-foreground/40">[ NO TOPIC DATA ]</div>
                </div>
              ) : (
                <div className="space-y-2">
                  {topicData.map(([topic, count]) => {
                    const maxCount = topicData[0][1];
                    const pct = (count / maxCount) * 100;
                    const color = TOPIC_COLORS[topic] ?? '#22d3ee';
                    return (
                      <div key={topic}>
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground flex-1">{topic}</span>
                          <span className="text-[10px] font-bold font-mono" style={{ color }}>{count}</span>
                          <button onClick={() => handleEntityClick(topic)} className="text-[9px] text-muted-foreground hover:text-primary transition-colors">
                            <Search size={9}/>
                          </button>
                        </div>
                        <div className="h-1.5 bg-border/30 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }}/>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {articles && articles.length > 0 && (
                <div className="mt-4 pt-3 border-t border-border/40">
                  <div className="text-[10px] text-muted-foreground font-semibold flex items-center gap-1.5 mb-2">
                    <Newspaper size={10}/> Matched Articles ({articles.length})
                  </div>
                  <div className="space-y-2">
                    {articles.slice(0, 8).map(article => {
                      const topics: string[] = (() => { try { return JSON.parse((article.topicsJson as any) ?? '[]'); } catch { return []; } })();
                      const topicColor = TOPIC_COLORS[topics[0]] ?? '#22d3ee';
                      const articleUrl = article.url && !article.url.includes('example.com') && article.url.startsWith('http')
                        ? article.url
                        : `https://news.google.com/search?q=${encodeURIComponent(article.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
                      return (
                        <div key={article.id} className="border-b border-border/20 pb-2 last:border-0">
                          <div className="flex items-start gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1" style={{ background: topicColor }}/>
                            <div className="flex-1 min-w-0">
                              <div className="text-[11px] font-medium text-foreground leading-snug line-clamp-2">{article.title}</div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[9px] text-muted-foreground">{article.country}</span>
                                <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[9px] text-primary hover:underline flex items-center gap-0.5">
                                  <ExternalLink size={8}/> Read
                                </a>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
