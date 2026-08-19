/**
 * NarrativeConnectionGraph — Enhanced CIA/NSA-grade force-directed connection graph
 * Features: zoom/pan, click-to-select, node filtering, fullscreen, force layout, tooltips
 * V2.5: article-evidence nodes, edge thickness by relevance, mini stats bar, richer tooltips
 * Redroom V2.5 · Owlink.ai
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import * as d3 from "d3";
import { trpc } from "@/lib/trpc";
import {
  Network, Maximize2, Minimize2, RotateCcw,
  ZoomIn, ZoomOut, X, ChevronRight, Eye, EyeOff,
  CheckCircle2, XCircle, Info, ExternalLink
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
export interface GNode {
  id: string;
  label: string;
  fullLabel: string;
  type: "narrative" | "author" | "publisher" | "target" | "tag" | "facility" | "evidence";
  color: string;
  // Evidence-specific metadata
  supportType?: "supports" | "contradicts" | "contextualises";
  relevanceScore?: number;
  llmReasoning?: string;
  articleUrl?: string;
  agencyName?: string;
  // d3 simulation fields
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GEdge {
  source: string | GNode;
  target: string | GNode;
  label: string;
  weight?: number; // 0–100 for thickness
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NODE_META: Record<GNode["type"], { color: string; radius: number; shape: string; label: string }> = {
  narrative:     { color: "#8b5cf6", radius: 32, shape: "⬡", label: "Narrative"    },
  author:        { color: "#f59e0b", radius: 20, shape: "●", label: "Author"       },
  publisher:     { color: "#60a5fa", radius: 20, shape: "■", label: "Publisher"    },
  target:        { color: "#ef4444", radius: 20, shape: "▲", label: "Target"       },
  facility:      { color: "#10b981", radius: 18, shape: "◆", label: "Facility"     },
  tag:           { color: "#94a3b8", radius: 15, shape: "○", label: "Tag"          },
  evidence:      { color: "#22c55e", radius: 16, shape: "◉", label: "Evidence"     },
};

// Evidence node colors by support type
const EVIDENCE_COLORS: Record<string, string> = {
  supports:       "#ef4444", // red — supports the narrative (amplifies it)
  contradicts:    "#22c55e", // green — contradicts / debunks
  contextualises: "#60a5fa", // blue — contextualises
};

const EDGE_STYLE: Record<string, { dash?: string; color: string }> = {
  "authored by":   { color: "#f59e0b" },
  "published by":  { color: "#60a5fa" },
  "targets":       { color: "#ef4444" },
  "tagged":        { color: "#94a3b8", dash: "4 4" },
  "linked to":     { color: "#8b5cf6" },
  "supports":      { color: "#ef4444", dash: "3 3" },
  "contradicts":   { color: "#22c55e", dash: "3 3" },
  "contextualises":{ color: "#60a5fa", dash: "3 3" },
};

function safeArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  narrative: Record<string, unknown>;
  narrativeId?: number;
}

export default function NarrativeConnectionGraph({ narrative, narrativeId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<d3.Simulation<GNode, GEdge> | null>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  const [selectedNode, setSelectedNode] = useState<GNode | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hiddenTypes, setHiddenTypes] = useState<Set<GNode["type"]>>(new Set());
  const graphContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [dimensions, setDimensions] = useState({ w: 700, h: 380 });

  // Fetch article evidence links — autoBackfillLinks triggers backfill if < 3 links exist
  const narId = narrativeId ?? (narrative.id as number | undefined);
  const { data: articleLinks = [] } = trpc.narratives.autoBackfillLinks.useQuery(
    { narrativeId: narId! },
    { enabled: !!narId, refetchOnWindowFocus: false, staleTime: 60_000 }
  );

  // ─── Browser fullscreen API ─────────────────────────────────────────────────
  const toggleFullscreen = useCallback(() => {
    if (!graphContainerRef.current) return;
    if (!document.fullscreenElement) {
      graphContainerRef.current.requestFullscreen().catch(() => {
        setIsFullscreen(f => !f);
      });
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);
  const [layoutReady, setLayoutReady] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // ─── Build graph data ───────────────────────────────────────────────────────
  const { allNodes, allEdges } = useMemo(() => {
    const allNodes: GNode[] = [];
    const allEdges: GEdge[] = [];

    const authors    = safeArr(narrative.knownAuthors);
    const publishers = safeArr(narrative.knownPublishers);
    const targets    = safeArr(narrative.targetCountries);
    const tags       = safeArr(narrative.tags);
    const title      = String(narrative.title ?? "Narrative");

    // Central node
    allNodes.push({
      id: "nar",
      label: title.length > 24 ? title.slice(0, 24) + "…" : title,
      fullLabel: title,
      type: "narrative",
      color: NODE_META.narrative.color,
    });

    authors.slice(0, 8).forEach((a, i) => {
      const id = `auth_${i}`;
      allNodes.push({ id, label: a.length > 18 ? a.slice(0, 18) + "…" : a, fullLabel: a, type: "author", color: NODE_META.author.color });
      allEdges.push({ source: id, target: "nar", label: "authored by", weight: 50 });
    });

    publishers.slice(0, 6).forEach((p, i) => {
      const id = `pub_${i}`;
      allNodes.push({ id, label: p.length > 18 ? p.slice(0, 18) + "…" : p, fullLabel: p, type: "publisher", color: NODE_META.publisher.color });
      allEdges.push({ source: id, target: "nar", label: "published by", weight: 50 });
    });

    targets.slice(0, 8).forEach((t, i) => {
      const id = `tgt_${i}`;
      allNodes.push({ id, label: t, fullLabel: t, type: "target", color: NODE_META.target.color });
      allEdges.push({ source: "nar", target: id, label: "targets", weight: 60 });
    });

    tags.slice(0, 6).forEach((t, i) => {
      const id = `tag_${i}`;
      allNodes.push({ id, label: `#${t}`, fullLabel: `#${t}`, type: "tag", color: NODE_META.tag.color });
      allEdges.push({ source: "nar", target: id, label: "tagged", weight: 30 });
    });

    // Article evidence nodes (from articleLinks query)
    const links = articleLinks as Array<{
      id: number;
      articleId: number;
      relevanceScore: number;
      supportType: string;
      llmReasoning: string | null;
      articleTitle: string;
      articleUrl: string;
      agencyName: string | null;
    }>;

    links.slice(0, 10).forEach((link, i) => {
      const id = `ev_${i}`;
      const st = (link.supportType ?? "contextualises") as "supports" | "contradicts" | "contextualises";
      const color = EVIDENCE_COLORS[st] ?? EVIDENCE_COLORS.contextualises;
      const shortTitle = link.articleTitle?.length > 22
        ? link.articleTitle.slice(0, 22) + "…"
        : (link.articleTitle ?? "Article");
      allNodes.push({
        id,
        label: shortTitle,
        fullLabel: link.articleTitle ?? "Article",
        type: "evidence",
        color,
        supportType: st,
        relevanceScore: link.relevanceScore,
        llmReasoning: link.llmReasoning ?? undefined,
        articleUrl: link.articleUrl,
        agencyName: link.agencyName ?? undefined,
      });
      allEdges.push({
        source: id,
        target: "nar",
        label: st,
        weight: link.relevanceScore ?? 50,
      });
    });

    return { allNodes, allEdges };
  }, [narrative, articleLinks]);

  // ─── Filtered graph ─────────────────────────────────────────────────────────
  const { nodes, edges } = useMemo(() => {
    const visibleIds = new Set(allNodes.filter(n => !hiddenTypes.has(n.type)).map(n => n.id));
    const nodes = allNodes.filter(n => visibleIds.has(n.id));
    const edges = allEdges.filter(e => {
      const src = typeof e.source === "string" ? e.source : (e.source as GNode).id;
      const tgt = typeof e.target === "string" ? e.target : (e.target as GNode).id;
      return visibleIds.has(src) && visibleIds.has(tgt);
    });
    return { nodes, edges };
  }, [allNodes, allEdges, hiddenTypes]);

  // ─── Mini stats ─────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const evidenceNodes = allNodes.filter(n => n.type === "evidence");
    const supports = evidenceNodes.filter(n => n.supportType === "supports").length;
    const contradicts = evidenceNodes.filter(n => n.supportType === "contradicts").length;
    const contextualises = evidenceNodes.filter(n => n.supportType === "contextualises").length;
    return { total: allNodes.length, edges: allEdges.length, evidence: evidenceNodes.length, supports, contradicts, contextualises };
  }, [allNodes, allEdges]);

  // ─── Resize observer ────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0 && height > 0) setDimensions({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isFullscreen]);

  // ─── D3 simulation ───────────────────────────────────────────────────────────
  useEffect(() => {
    if (!svgRef.current || nodes.length === 0) return;
    const { w, h } = dimensions;
    setLayoutReady(false);

    if (simRef.current) simRef.current.stop();

    const simNodes: GNode[] = nodes.map(n => ({ ...n }));
    const nodeById = new Map(simNodes.map(n => [n.id, n]));

    const simEdges: GEdge[] = edges.map(e => ({
      source: nodeById.get(typeof e.source === "string" ? e.source : (e.source as GNode).id)!,
      target: nodeById.get(typeof e.target === "string" ? e.target : (e.target as GNode).id)!,
      label: e.label,
      weight: e.weight,
    })).filter(e => e.source && e.target);

    const center = simNodes.find(n => n.id === "nar");
    if (center) { center.fx = w / 2; center.fy = h / 2; }

    const sim = d3.forceSimulation<GNode>(simNodes)
      .force("link", d3.forceLink<GNode, GEdge>(simEdges).id(d => d.id).distance(d => {
        const tgt = d.target as GNode;
        if (tgt.type === "tag") return 80;
        if (tgt.type === "evidence") return 110;
        return 130;
      }).strength(0.6))
      .force("charge", d3.forceManyBody().strength(-280))
      .force("collision", d3.forceCollide<GNode>(d => NODE_META[d.type].radius + 12))
      .force("x", d3.forceX(w / 2).strength(0.04))
      .force("y", d3.forceY(h / 2).strength(0.04));

    simRef.current = sim;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // Defs: arrowheads
    const defs = svg.append("defs");
    Object.entries(EDGE_STYLE).forEach(([key, style]) => {
      const safeId = key.replace(/\s+/g, "-");
      defs.append("marker")
        .attr("id", `arrow-${safeId}`)
        .attr("markerWidth", 7).attr("markerHeight", 7)
        .attr("refX", 6).attr("refY", 3)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,0 L0,6 L7,3 z")
        .attr("fill", style.color + "80");
    });

    // Glow filter
    const filter = defs.append("filter").attr("id", "glow");
    filter.append("feGaussianBlur").attr("stdDeviation", "3").attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Zoom layer
    const g = svg.append("g").attr("class", "zoom-layer");

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", event => {
        g.attr("transform", event.transform);
        setZoomLevel(Math.round(event.transform.k * 100) / 100);
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    svg.on("dblclick.zoom", null);
    svg.on("dblclick", () => {
      svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
    });

    // ── Edges ──────────────────────────────────────────────────────────────────
    const edgeGroup = g.append("g").attr("class", "edges");
    const edgeSel = edgeGroup.selectAll("g.edge")
      .data(simEdges)
      .join("g")
      .attr("class", "edge");

    edgeSel.append("line")
      .attr("class", "edge-line")
      .attr("stroke-width", d => {
        // Thickness proportional to weight (relevance score 0–100)
        const w = d.weight ?? 50;
        return Math.max(0.5, Math.min(3.5, (w / 100) * 3.5));
      })
      .attr("stroke", d => (EDGE_STYLE[d.label]?.color ?? "#ffffff") + "30")
      .attr("stroke-dasharray", d => EDGE_STYLE[d.label]?.dash ?? null)
      .attr("marker-end", d => `url(#arrow-${d.label.replace(/\s+/g, "-")})`);

    edgeSel.append("text")
      .attr("class", "edge-label")
      .attr("text-anchor", "middle")
      .attr("font-size", 7)
      .attr("fill", "#ffffff20")
      .attr("pointer-events", "none")
      .text(d => d.label);

    // ── Nodes ──────────────────────────────────────────────────────────────────
    const nodeGroup = g.append("g").attr("class", "nodes");
    const nodeSel = nodeGroup.selectAll<SVGGElement, GNode>("g.node")
      .data(simNodes, d => d.id)
      .join("g")
      .attr("class", "node")
      .attr("cursor", "pointer")
      .call(
        d3.drag<SVGGElement, GNode>()
          .on("start", (event, d) => {
            if (!event.active) sim.alphaTarget(0.3).restart();
            d.fx = d.x; d.fy = d.y;
          })
          .on("drag", (event, d) => {
            d.fx = event.x; d.fy = event.y;
          })
          .on("end", (event, d) => {
            if (!event.active) sim.alphaTarget(0);
            if (d.id !== "nar") { d.fx = null; d.fy = null; }
          })
      );

    // Outer glow ring (narrative only)
    nodeSel.filter(d => d.type === "narrative")
      .append("circle")
      .attr("r", d => NODE_META[d.type].radius + 8)
      .attr("fill", "none")
      .attr("stroke", d => d.color + "25")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "5 5");

    // Evidence nodes get a pulsing outer ring
    nodeSel.filter(d => d.type === "evidence")
      .append("circle")
      .attr("r", d => NODE_META[d.type].radius + 5)
      .attr("fill", "none")
      .attr("stroke", d => d.color + "20")
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3 3");

    // Main circle
    nodeSel.append("circle")
      .attr("r", d => NODE_META[d.type].radius)
      .attr("fill", d => d.color + "18")
      .attr("stroke", d => d.color + "55")
      .attr("stroke-width", 1.2)
      .attr("class", "node-circle");

    // Shape symbol
    nodeSel.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("dy", "-4")
      .attr("font-size", d => d.type === "narrative" ? 13 : 10)
      .attr("fill", d => d.color + "cc")
      .attr("pointer-events", "none")
      .text(d => NODE_META[d.type].shape);

    // Relevance % label inside evidence nodes
    nodeSel.filter(d => d.type === "evidence" && d.relevanceScore != null)
      .append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("dy", "6")
      .attr("font-size", 6)
      .attr("fill", d => d.color + "99")
      .attr("pointer-events", "none")
      .text(d => `${Math.round(d.relevanceScore!)}%`);

    // Label
    nodeSel.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", d => NODE_META[d.type].radius + 13)
      .attr("font-size", d => d.type === "narrative" ? 8 : 7)
      .attr("fill", "#ffffffaa")
      .attr("pointer-events", "none")
      .attr("class", "node-label")
      .text(d => d.label);

    // ── Interactions ───────────────────────────────────────────────────────────
    nodeSel
      .on("mouseenter", (_, d) => {
        setHoveredNode(d.id);
        edgeSel.selectAll<SVGLineElement, GEdge>("line.edge-line")
          .attr("stroke", e => {
            const src = (e.source as GNode).id;
            const tgt = (e.target as GNode).id;
            return (src === d.id || tgt === d.id)
              ? (EDGE_STYLE[e.label]?.color ?? "#ffffff") + "cc"
              : (EDGE_STYLE[e.label]?.color ?? "#ffffff") + "15";
          })
          .attr("stroke-width", e => {
            const src = (e.source as GNode).id;
            const tgt = (e.target as GNode).id;
            const baseW = Math.max(0.5, Math.min(3.5, ((e.weight ?? 50) / 100) * 3.5));
            return (src === d.id || tgt === d.id) ? baseW * 2 : baseW * 0.5;
          });
        edgeSel.selectAll<SVGTextElement, GEdge>("text.edge-label")
          .attr("fill", e => {
            const src = (e.source as GNode).id;
            const tgt = (e.target as GNode).id;
            return (src === d.id || tgt === d.id) ? "#ffffff60" : "#ffffff10";
          });
        nodeSel.selectAll<SVGCircleElement, GNode>("circle.node-circle")
          .attr("opacity", n => {
            if (n.id === d.id) return 1;
            const connected = simEdges.some(e => {
              const s = (e.source as GNode).id;
              const t = (e.target as GNode).id;
              return (s === d.id && t === n.id) || (t === d.id && s === n.id);
            });
            return connected ? 1 : 0.25;
          });
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
        edgeSel.selectAll<SVGLineElement, GEdge>("line.edge-line")
          .attr("stroke", d => (EDGE_STYLE[d.label]?.color ?? "#ffffff") + "30")
          .attr("stroke-width", d => Math.max(0.5, Math.min(3.5, ((d.weight ?? 50) / 100) * 3.5)));
        edgeSel.selectAll<SVGTextElement, GEdge>("text.edge-label")
          .attr("fill", "#ffffff20");
        nodeSel.selectAll<SVGCircleElement, GNode>("circle.node-circle")
          .attr("opacity", 1);
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        setSelectedNode(prev => prev?.id === d.id ? null : d);
        d3.select(event.currentTarget as SVGGElement)
          .select("circle.node-circle")
          .transition().duration(120).attr("r", NODE_META[d.type].radius + 5)
          .transition().duration(200).attr("r", NODE_META[d.type].radius);
      });

    svg.on("click", () => setSelectedNode(null));

    // ── Tick ───────────────────────────────────────────────────────────────────
    sim.on("tick", () => {
      edgeSel.selectAll<SVGLineElement, GEdge>("line.edge-line")
        .attr("x1", d => (d.source as GNode).x ?? 0)
        .attr("y1", d => (d.source as GNode).y ?? 0)
        .attr("x2", d => {
          const src = d.source as GNode;
          const tgt = d.target as GNode;
          const dx = (tgt.x ?? 0) - (src.x ?? 0);
          const dy = (tgt.y ?? 0) - (src.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const r = NODE_META[tgt.type].radius + 4;
          return (tgt.x ?? 0) - (dx / dist) * r;
        })
        .attr("y2", d => {
          const src = d.source as GNode;
          const tgt = d.target as GNode;
          const dx = (tgt.x ?? 0) - (src.x ?? 0);
          const dy = (tgt.y ?? 0) - (src.y ?? 0);
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const r = NODE_META[tgt.type].radius + 4;
          return (tgt.y ?? 0) - (dy / dist) * r;
        });

      edgeSel.selectAll<SVGTextElement, GEdge>("text.edge-label")
        .attr("x", d => (((d.source as GNode).x ?? 0) + ((d.target as GNode).x ?? 0)) / 2)
        .attr("y", d => (((d.source as GNode).y ?? 0) + ((d.target as GNode).y ?? 0)) / 2 - 5);

      nodeSel.attr("transform", d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    sim.on("end", () => setLayoutReady(true));

    for (let i = 0; i < 120; i++) sim.tick();
    setLayoutReady(true);
    sim.alpha(0.3).restart();

    return () => { sim.stop(); };
  }, [nodes, edges, dimensions]);

  // ─── Zoom controls ──────────────────────────────────────────────────────────
  const handleZoom = useCallback((factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(250)
      .call(zoomRef.current.scaleBy, factor);
  }, []);

  const handleReset = useCallback(() => {
    if (!svgRef.current || !zoomRef.current) return;
    d3.select(svgRef.current).transition().duration(400)
      .call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  // ─── Type filter toggle ─────────────────────────────────────────────────────
  const toggleType = useCallback((type: GNode["type"]) => {
    if (type === "narrative") return;
    setHiddenTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
    setSelectedNode(null);
  }, []);

  // ─── Node detail panel ──────────────────────────────────────────────────────
  const connectedEdges = useMemo(() => {
    if (!selectedNode) return [];
    return edges.filter(e => {
      const src = typeof e.source === "string" ? e.source : (e.source as GNode).id;
      const tgt = typeof e.target === "string" ? e.target : (e.target as GNode).id;
      return src === selectedNode.id || tgt === selectedNode.id;
    });
  }, [selectedNode, edges]);

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<GNode["type"], number>> = {};
    allNodes.forEach(n => { counts[n.type] = (counts[n.type] ?? 0) + 1; });
    return counts;
  }, [allNodes]);

  // ─── Render ─────────────────────────────────────────────────────────────────
  const graphHeight = isFullscreen ? "calc(100vh - 140px)" : "360px";

  return (
    <div
      ref={graphContainerRef}
      className={`rounded-lg border border-border/50 overflow-hidden flex flex-col ${isFullscreen ? "fixed inset-0 z-[9999] rounded-none shadow-2xl" : ""}`}
      style={{ background: isFullscreen ? "oklch(0.06 0.01 270)" : "oklch(from var(--background) l c h / 0.6)" }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/40 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Network size={10} className="text-muted-foreground/60" />
          <span className="text-[9px] text-muted-foreground/60 font-bold uppercase tracking-wider">
            Connection Graph
          </span>
          <span className="text-[8px] text-muted-foreground/30 font-mono">
            {nodes.length}N · {edges.length}E
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => handleZoom(1.3)}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
            title="Zoom in"
          >
            <ZoomIn size={9} />
          </button>
          <button
            onClick={() => handleZoom(0.77)}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
            title="Zoom out"
          >
            <ZoomOut size={9} />
          </button>
          <button
            onClick={handleReset}
            className="w-5 h-5 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
            title="Reset view"
          >
            <RotateCcw size={9} />
          </button>
          <span className="text-[8px] font-mono text-muted-foreground/30 w-8 text-center">
            {Math.round(zoomLevel * 100)}%
          </span>
          <button
            onClick={toggleFullscreen}
            className="flex items-center gap-1 px-2 py-0.5 rounded border border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border/70 hover:bg-foreground/10 transition-all text-[8px] font-mono"
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Expand graph to fullscreen"}
          >
            {isFullscreen ? <><Minimize2 size={9} /><span>EXIT</span></> : <><Maximize2 size={9} /><span>EXPAND</span></>}
          </button>
        </div>
      </div>

      {/* ── Mini stats bar ── */}
      {stats.evidence > 0 && (
        <div className="flex items-center gap-3 px-3 py-1 border-b border-border/20 flex-shrink-0 bg-foreground/[0.02]">
          <span className="text-[8px] text-muted-foreground/40 font-mono uppercase tracking-wider">Evidence:</span>
          <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: EVIDENCE_COLORS.supports }}>
            <CheckCircle2 size={8} />{stats.supports} supports
          </span>
          <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: EVIDENCE_COLORS.contradicts }}>
            <XCircle size={8} />{stats.contradicts} contradicts
          </span>
          <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: EVIDENCE_COLORS.contextualises }}>
            <Info size={8} />{stats.contextualises} contextualises
          </span>
          <span className="ml-auto text-[7px] text-muted-foreground/25 font-mono">
            edge thickness = relevance
          </span>
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/30 flex-shrink-0 flex-wrap">
        {(Object.entries(NODE_META) as [GNode["type"], typeof NODE_META[GNode["type"]]][]).map(([type, meta]) => {
          const count = typeCounts[type] ?? 0;
          if (count === 0) return null;
          const hidden = hiddenTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => toggleType(type)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono border transition-all ${
                hidden
                  ? "border-border/20 text-muted-foreground/30 bg-transparent"
                  : "border-border/40 text-foreground/70 bg-foreground/5"
              }`}
              title={hidden ? `Show ${meta.label}` : `Hide ${meta.label}`}
            >
              <span style={{ color: hidden ? "#ffffff20" : meta.color }}>{meta.shape}</span>
              <span>{meta.label}</span>
              <span className="text-muted-foreground/40">({count})</span>
              {hidden ? <EyeOff size={7} className="ml-0.5" /> : <Eye size={7} className="ml-0.5" />}
            </button>
          );
        })}
        <span className="ml-auto text-[7px] text-muted-foreground/25 italic">
          drag · scroll zoom · dbl-click reset
        </span>
      </div>

      {/* ── Graph + Detail panel ── */}
      <div className="flex flex-1 min-h-0 relative">
        {/* SVG canvas */}
        <div
          ref={containerRef}
          className="flex-1 relative"
          style={{ height: graphHeight }}
        >
          {!layoutReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground/30 font-mono animate-pulse">
                COMPUTING LAYOUT…
              </span>
            </div>
          )}
          <svg
            ref={svgRef}
            width="100%"
            height="100%"
            style={{ opacity: layoutReady ? 1 : 0, transition: "opacity 0.4s" }}
          />
          {nodes.length <= 1 && layoutReady && (
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] text-muted-foreground/30">
                No connection data available
              </span>
            </div>
          )}
        </div>

        {/* Node detail panel */}
        {selectedNode && (
          <div
            className="w-56 border-l border-border/40 flex-shrink-0 flex flex-col overflow-y-auto"
            style={{ background: "oklch(from var(--background) l c h / 0.95)" }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
              <div className="flex items-center gap-1.5">
                <span style={{ color: selectedNode.color }} className="text-sm">
                  {NODE_META[selectedNode.type].shape}
                </span>
                <span className="text-[9px] font-bold text-foreground/80 uppercase tracking-wider">
                  {NODE_META[selectedNode.type].label}
                </span>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-muted-foreground/40 hover:text-foreground transition-colors"
              >
                <X size={10} />
              </button>
            </div>

            <div className="p-3 space-y-3">
              {/* Full name */}
              <div>
                <div className="text-[7px] text-muted-foreground/40 uppercase tracking-wider mb-1">Entity</div>
                <div className="text-[10px] text-foreground/90 leading-snug font-medium">
                  {selectedNode.fullLabel}
                </div>
              </div>

              {/* Evidence-specific details */}
              {selectedNode.type === "evidence" && (
                <>
                  {selectedNode.supportType && (
                    <div className="flex items-center gap-1.5">
                      {selectedNode.supportType === "supports" && <CheckCircle2 size={10} style={{ color: EVIDENCE_COLORS.supports }} />}
                      {selectedNode.supportType === "contradicts" && <XCircle size={10} style={{ color: EVIDENCE_COLORS.contradicts }} />}
                      {selectedNode.supportType === "contextualises" && <Info size={10} style={{ color: EVIDENCE_COLORS.contextualises }} />}
                      <span className="text-[9px] font-bold capitalize" style={{ color: EVIDENCE_COLORS[selectedNode.supportType] }}>
                        {selectedNode.supportType}
                      </span>
                    </div>
                  )}
                  {selectedNode.relevanceScore != null && (
                    <div>
                      <div className="text-[7px] text-muted-foreground/40 uppercase tracking-wider mb-1">Relevance</div>
                      <div className="flex items-center gap-1.5">
                        <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${selectedNode.relevanceScore}%`, background: selectedNode.color }}
                          />
                        </div>
                        <span className="text-[9px] font-mono" style={{ color: selectedNode.color }}>
                          {Math.round(selectedNode.relevanceScore)}%
                        </span>
                      </div>
                    </div>
                  )}
                  {selectedNode.agencyName && (
                    <div>
                      <div className="text-[7px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">Source Agency</div>
                      <div className="text-[9px] text-foreground/60">{selectedNode.agencyName}</div>
                    </div>
                  )}
                  {selectedNode.llmReasoning && (
                    <div>
                      <div className="text-[7px] text-muted-foreground/40 uppercase tracking-wider mb-1">Analyst Reasoning</div>
                      <p className="text-[9px] text-foreground/60 italic leading-relaxed border-l-2 border-border/40 pl-2">
                        {selectedNode.llmReasoning.slice(0, 200)}{selectedNode.llmReasoning.length > 200 ? "…" : ""}
                      </p>
                    </div>
                  )}
                  {selectedNode.articleUrl && (
                    <a
                      href={selectedNode.articleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-[9px] text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      <ExternalLink size={8} /> View Article
                    </a>
                  )}
                </>
              )}

              {/* Connections */}
              {connectedEdges.length > 0 && (
                <div>
                  <div className="text-[7px] text-muted-foreground/40 uppercase tracking-wider mb-1.5">
                    Connections ({connectedEdges.length})
                  </div>
                  <div className="space-y-1.5">
                    {connectedEdges.map((e, i) => {
                      const src = typeof e.source === "string" ? e.source : (e.source as GNode).id;
                      const tgt = typeof e.target === "string" ? e.target : (e.target as GNode).id;
                      const other = src === selectedNode.id ? tgt : src;
                      const otherNode = allNodes.find(n => n.id === other);
                      const isOutgoing = src === selectedNode.id;
                      return (
                        <div key={i} className="flex items-start gap-1.5 text-[8px]">
                          <ChevronRight
                            size={8}
                            className="mt-0.5 flex-shrink-0"
                            style={{ color: EDGE_STYLE[e.label]?.color ?? "#ffffff" }}
                          />
                          <div className="min-w-0">
                            <span className="text-muted-foreground/50">{isOutgoing ? "→" : "←"} {e.label}</span>
                            {e.weight != null && (
                              <span className="ml-1 text-[7px] text-muted-foreground/30 font-mono">{Math.round(e.weight)}%</span>
                            )}
                            <div className="text-foreground/70 truncate" style={{ color: otherNode?.color ?? "#ffffff" }}>
                              {otherNode?.fullLabel ?? other}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Node type badge */}
              <div className="pt-1 border-t border-border/20">
                <span
                  className="inline-block px-2 py-0.5 rounded text-[7px] font-mono uppercase tracking-wider"
                  style={{ background: selectedNode.color + "20", color: selectedNode.color, border: `1px solid ${selectedNode.color}40` }}
                >
                  {NODE_META[selectedNode.type].label}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Legend ── */}
      <div className="flex items-center gap-3 px-3 py-1.5 border-t border-border/30 flex-shrink-0 flex-wrap">
        {(Object.entries(NODE_META) as [GNode["type"], typeof NODE_META[GNode["type"]]][]).map(([type, meta]) => (
          <span key={type} className="flex items-center gap-1 text-[7px] text-muted-foreground/40">
            <span style={{ color: meta.color }}>{meta.shape}</span>
            {meta.label}
          </span>
        ))}
        <span className="ml-auto text-[7px] text-muted-foreground/25 font-mono">
          REDROOM V2.5 · OWLINK.AI
        </span>
      </div>
    </div>
  );
}
