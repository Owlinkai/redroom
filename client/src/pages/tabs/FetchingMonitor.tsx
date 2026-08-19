/**
 * FetchingMonitor — SIGINT ACQUISITION OPERATIONS CENTER
 *
 * Advanced real-time signal acquisition monitoring console.
 * All original functionality preserved and enhanced:
 *  • SSE stream (/api/crawl-stream) for real-time per-article pipeline events
 *  • Resizable panels via drag dividers (left / center / right)
 *  • Stop/interrupt button per active job (calls crawler.cancelJob)
 *  • Hover tooltip on article feed items (title, URL, agency, stage, timestamp)
 *  • Parallel job counter in header (N jobs in pipeline)
 *  • Auto-cleanup of stuck jobs on mount
 *  • Paginated, filterable job log table with CSV + JSON export
 *  • Live duration counter for running jobs
 *  • KPI tiles: total, active, new/60s, errors/60s
 *  • Enhanced: animated pipeline flow, threat-grade styling, classified header
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Rss, Wifi, Cpu, Database, CheckCircle2, Zap,
  Loader2, Download, Trash2, RefreshCw, ChevronLeft,
  ChevronRight, Activity, Clock, Newspaper, AlertTriangle,
  Globe, Radio, Signal, StopCircle, Layers,
  TrendingUp, Eye, BarChart3, ExternalLink, ShieldCheck,
  ChevronDown, ChevronUp, GripHorizontal, Lock, Satellite,
  Shield, Crosshair, Radar, Siren, Terminal, Zap as ZapIcon,
  AlertOctagon, Network, Server, Cpu as CpuIcon,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────
type PipelineStage =
  | "job_start" | "job_done" | "job_fail"
  | "fetch_start" | "fetch_ok" | "fetch_fail"
  | "parse_item"
  | "enrich_start" | "enrich_done"
  | "db_insert" | "db_dup";

interface PipelineEvent {
  id: string;
  ts: number;
  stage: PipelineStage;
  jobId: number;
  agencyId: number;
  agencyName: string;
  articleTitle?: string;
  articleUrl?: string;
  feedUrl?: string;
  itemsFound?: number;
  articlesNew?: number;
  error?: string;
  region?: string;
}

interface CrawlJobRow {
  id: number;
  agencyId: number;
  agencyName: string | null;
  agencyCountry: string | null;
  agencyType: string | null;
  status: string | null;
  startedAt: string | null;
  completedAt: string | null;
  articlesFound: number | null;
  articlesNew: number | null;
  errorMessage: string | null;
  region: string | null;
  createdAt: string | null;
}

// ─── Pipeline stage definitions ───────────────────────────────────────────────
const STAGES = [
  { id: "source", label: "SIGNAL ACQUISITION", sublabel: "RSS feed targeting",  icon: Satellite,  color: "#818cf8", glow: "rgba(99,102,241,0.4)",  bg: "rgba(99,102,241,0.08)",  border: "rgba(99,102,241,0.4)",  events: ["job_start"] as PipelineStage[] },
  { id: "fetch",  label: "NETWORK INTERCEPT",  sublabel: "HTTP data retrieval",  icon: Radar,      color: "#38bdf8", glow: "rgba(14,165,233,0.4)",  bg: "rgba(14,165,233,0.08)",  border: "rgba(14,165,233,0.4)",  events: ["fetch_start", "fetch_ok", "fetch_fail"] as PipelineStage[] },
  { id: "parse",  label: "SIGNAL PARSING",     sublabel: "Item extraction",      icon: CpuIcon,    color: "#a78bfa", glow: "rgba(139,92,246,0.4)", border: "rgba(139,92,246,0.4)", bg: "rgba(139,92,246,0.08)", events: ["parse_item"] as PipelineStage[] },
  { id: "db",     label: "INTEL PERSISTENCE",  sublabel: "Dedup + secure store", icon: Server,     color: "#34d399", glow: "rgba(16,185,129,0.4)", border: "rgba(16,185,129,0.4)", bg: "rgba(16,185,129,0.08)", events: ["db_insert", "db_dup"] as PipelineStage[] },
  { id: "enrich", label: "AI ENRICHMENT",      sublabel: "Entity extraction",    icon: Network,    color: "#fbbf24", glow: "rgba(245,158,11,0.4)", border: "rgba(245,158,11,0.4)", bg: "rgba(245,158,11,0.08)", events: ["enrich_start", "enrich_done"] as PipelineStage[] },
] as const;

function stageIndexForEvent(stage: PipelineStage): number {
  for (let i = 0; i < STAGES.length; i++) {
    if ((STAGES[i].events as readonly string[]).includes(stage)) return i;
  }
  return -1;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtDuration(startIso: string | null, endIso: string | null = null): string {
  if (!startIso) return "—";
  const ms = (endIso ? new Date(endIso).getTime() : Date.now()) - new Date(startIso).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtRelative(iso: string | null): string {
  if (!iso) return "—";
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  return `${Math.floor(ms / 3600000)}h ago`;
}

function fmtTime(ts: number): string {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function getStageBadgeStyle(stage: PipelineStage): { color: string; bg: string } {
  if (["db_insert", "job_done", "fetch_ok", "enrich_done"].includes(stage))
    return { color: "#34d399", bg: "rgba(52,211,153,0.12)" };
  if (["fetch_fail", "job_fail"].includes(stage))
    return { color: "#f87171", bg: "rgba(248,113,113,0.12)" };
  if (stage === "db_dup")
    return { color: "var(--muted-foreground)", bg: "rgba(71,85,105,0.12)" };
  if (["enrich_start", "enrich_done"].includes(stage))
    return { color: "#fbbf24", bg: "rgba(251,191,36,0.12)" };
  if (stage === "parse_item")
    return { color: "#a78bfa", bg: "rgba(167,139,250,0.12)" };
  if (stage === "fetch_start")
    return { color: "#38bdf8", bg: "rgba(56,189,248,0.12)" };
  return { color: "#818cf8", bg: "rgba(129,140,248,0.12)" };
}

function getStageName(stage: PipelineStage): string {
  const map: Record<PipelineStage, string> = {
    job_start: "ACQUIRED", job_done: "COMPLETE", job_fail: "FAILED",
    fetch_start: "INTERCEPTING", fetch_ok: "INTERCEPTED", fetch_fail: "BLOCKED",
    parse_item: "PARSED",
    enrich_start: "ANALYZING", enrich_done: "ANALYZED",
    db_insert: "STORED", db_dup: "DUPLICATE",
  };
  return map[stage] ?? stage.toUpperCase();
}

function getStatusStyle(status: string | null): { color: string; bg: string; label: string; border: string } {
  switch (status) {
    case "running":   return { color: "#38bdf8", bg: "rgba(56,189,248,0.08)",   border: "rgba(56,189,248,0.3)",  label: "● ACTIVE"    };
    case "completed": return { color: "#34d399", bg: "rgba(52,211,153,0.08)",   border: "rgba(52,211,153,0.3)",  label: "✓ COMPLETE"  };
    case "failed":    return { color: "#f87171", bg: "rgba(248,113,113,0.08)",  border: "rgba(248,113,113,0.3)", label: "✗ FAILED"    };
    case "pending":   return { color: "#fbbf24", bg: "rgba(251,191,36,0.08)",   border: "rgba(251,191,36,0.3)",  label: "◌ QUEUED"    };
    default:          return { color: "#64748b", bg: "rgba(100,116,139,0.08)",  border: "rgba(100,116,139,0.3)", label: status ?? "—" };
  }
}

// ─── Live duration counter ────────────────────────────────────────────────────
function LiveDuration({ startedAt }: { startedAt: string | null }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick(n => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{fmtDuration(startedAt)}</>;
}

// ─── SSE hook ─────────────────────────────────────────────────────────────────
function useCrawlStream() {
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let retries = 0;

    function connect() {
      const es = new EventSource("/api/crawl-stream");
      esRef.current = es;

      es.addEventListener("pipeline", (e: MessageEvent) => {
        try {
          const evt = JSON.parse(e.data) as PipelineEvent;
          setEvents(prev => {
            const next = [...prev, evt];
            return next.length > 1000 ? next.slice(-1000) : next;
          });
        } catch { /* ignore */ }
      });

      es.addEventListener("heartbeat", () => { retries = 0; });
      es.onopen = () => { setConnected(true); retries = 0; };
      es.onerror = () => {
        setConnected(false);
        es.close();
        retries++;
        const delay = Math.min(1000 * Math.pow(2, retries), 30000);
        reconnectTimer = setTimeout(connect, delay);
      };
    }

    connect();
    return () => {
      clearTimeout(reconnectTimer);
      esRef.current?.close();
    };
  }, []);

  const clearEvents = useCallback(() => setEvents([]), []);
  return { events, connected, clearEvents };
}

// ─── Drag divider hooks ───────────────────────────────────────────────────────
function useDragDivider(initialPx: number, minPx: number, maxPx: number, side: "left" | "right") {
  const [width, setWidth] = useState(initialPx);
  const dragging = useRef(false);
  const startX   = useRef(0);
  const startW   = useRef(0);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current   = e.clientX;
    startW.current   = width;
    document.body.style.cursor     = "col-resize";
    document.body.style.userSelect = "none";
  }, [width]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = side === "left" ? e.clientX - startX.current : startX.current - e.clientX;
      setWidth(Math.max(minPx, Math.min(maxPx, startW.current + delta)));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor     = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [side, minPx, maxPx]);
  return { width, onMouseDown };
}

function useVerticalResize(initialPx: number, minPx: number, maxPx: number, invertDelta = false) {
  const [height, setHeight] = useState(initialPx);
  const dragging = useRef(false);
  const startY   = useRef(0);
  const startH   = useRef(0);
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startY.current   = e.clientY;
    startH.current   = height;
    document.body.style.cursor    = "row-resize";
    document.body.style.userSelect = "none";
  }, [height]);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      const delta = (e.clientY - startY.current) * (invertDelta ? -1 : 1);
      setHeight(Math.max(minPx, Math.min(maxPx, startH.current + delta)));
    };
    const onUp = () => {
      if (dragging.current) {
        dragging.current = false;
        document.body.style.cursor    = "";
        document.body.style.userSelect = "";
      }
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup",   onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [minPx, maxPx]);
  return { height, onMouseDown };
}

// ─── Drag divider visual components ──────────────────────────────────────────
function DragDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="w-1 shrink-0 cursor-col-resize relative flex items-center justify-center select-none transition-all duration-150"
      style={{ background: hover ? "rgba(56,189,248,0.5)" : "rgba(56,189,248,0.08)" }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="absolute inset-y-0 -left-2 -right-2" />
      {hover && (
        <div className="relative z-10 flex flex-col gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-0.5 h-0.5 rounded-full bg-sky-400" />
          ))}
        </div>
      )}
    </div>
  );
}

function HorizontalDragDivider({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      className="h-1 shrink-0 cursor-row-resize relative flex items-center justify-center select-none transition-all duration-150"
      style={{ background: hover ? "rgba(56,189,248,0.5)" : "rgba(56,189,248,0.08)" }}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <div className="absolute inset-x-0 -top-2 -bottom-2" />
      {hover && (
        <div className="relative z-10 flex gap-0.5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-0.5 h-0.5 rounded-full bg-sky-400" />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Panel section header ─────────────────────────────────────────────────────
function SectionHeader({
  icon: Icon, label, count, badge, collapsed, onToggle, children, accent = "#38bdf8",
}: {
  icon: React.ElementType;
  label: string;
  count?: number | string;
  badge?: React.ReactNode;
  collapsed: boolean;
  onToggle: () => void;
  children?: React.ReactNode;
  accent?: string;
}) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0 cursor-pointer select-none transition-all duration-150 group"
      style={{ borderBottom: "1px solid rgba(56,189,248,0.08)", background: "oklch(from var(--foreground) l c h / 0.05)" }}
      onClick={onToggle}
    >
      <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ background: `${accent}15` }}>
        <Icon size={10} style={{ color: accent }} />
      </div>
      <span className="text-[10px] font-mono font-bold tracking-widest uppercase" style={{ color: accent }}>
        {label}
      </span>
      {count !== undefined && (
        <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ background: `${accent}12`, color: accent }}>
          {count}
        </span>
      )}
      {badge}
      <div className="ml-auto flex items-center gap-2">
        {children}
        <div style={{ color: `${accent}60` }}>
          {collapsed ? <ChevronDown size={10} /> : <ChevronUp size={10} />}
        </div>
      </div>
    </div>
  );
}

// ─── KPI tile ─────────────────────────────────────────────────────────────────
function KpiTile({ label, value, icon: Icon, color, sub, pulse }: {
  label: string; value: number; icon: React.ElementType; color: string; sub: string; pulse?: boolean;
}) {
  return (
    <div
      className="rounded-lg p-3 relative overflow-hidden"
      style={{ background: "oklch(from var(--foreground) l c h / 0.06)", border: `1px solid ${color}20` }}
    >
      {/* Corner accent */}
      <div className="absolute top-0 right-0 w-8 h-8" style={{ background: `linear-gradient(135deg, transparent 50%, ${color}08 50%)` }} />
      <div className="absolute top-1 right-1">
        <Icon size={9} style={{ color: `${color}40` }} />
      </div>
      <div className="flex items-end gap-1 mb-1">
        <span className={`text-2xl font-mono font-black leading-none ${pulse ? "animate-pulse" : ""}`} style={{ color }}>
          {value}
        </span>
      </div>
      <div className="text-[9px] font-mono font-bold tracking-widest uppercase" style={{ color: `${color}90` }}>{label}</div>
      <div className="text-[8px] font-mono mt-0.5" style={{ color: "rgba(100,116,139,0.7)" }}>{sub}</div>
    </div>
  );
}

// ─── Status badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string | null }) {
  const s = getStatusStyle(status);
  return (
    <span
      className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded"
      style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}
    >
      {s.label}
    </span>
  );
}

// ─── Feed item ────────────────────────────────────────────────────────────────
function FeedItem({ evt }: { evt: PipelineEvent }) {
  const [hovered, setHovered] = useState(false);
  const s = getStageBadgeStyle(evt.stage);
  const isNew = evt.stage === "db_insert";
  const isErr = evt.stage === "fetch_fail" || evt.stage === "job_fail";

  return (
    <div
      className="flex items-center gap-2 px-2 py-1.5 transition-all duration-100 cursor-default"
      style={{
        borderBottom: "1px solid rgba(56,189,248,0.04)",
        background: hovered
          ? isErr ? "rgba(248,113,113,0.05)" : isNew ? "rgba(52,211,153,0.05)" : "oklch(from var(--foreground) l c h / 0.02)"
          : "transparent",
        borderLeft: isNew ? "2px solid rgba(52,211,153,0.4)" : isErr ? "2px solid rgba(248,113,113,0.4)" : "2px solid transparent",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Stage badge — matches StatusBadge style */}
      <span
        className="text-[8px] font-mono font-bold shrink-0 px-1.5 py-0.5 rounded"
        style={{ color: s.color, background: s.bg, border: `1px solid ${s.color}30`, minWidth: 76, textAlign: "center", letterSpacing: "0.04em" }}
      >
        {getStageName(evt.stage)}
      </span>

      {/* Title / agency */}
      <div className="flex-1 min-w-0">
        <div className="font-mono text-[10px] font-bold truncate" style={{ color: isErr ? "#f87171" : isNew ? "#34d399" : "var(--muted-foreground)" }}>
          {evt.articleTitle || evt.agencyName || `JOB #${evt.jobId}`}
        </div>
        {hovered && evt.agencyName && evt.articleTitle && (
          <div className="text-[8px] font-mono mt-0.5" style={{ color: "var(--foreground)" }}>{evt.agencyName}</div>
        )}
      </div>

      {/* External link */}
      {evt.articleUrl && hovered && (
        <a href={evt.articleUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" onClick={e => e.stopPropagation()}>
          <ExternalLink size={9} className="text-muted-foreground hover:text-sky-400 transition-colors" />
        </a>
      )}

      {/* Timestamp */}
      <span className="text-[8px] font-mono shrink-0" style={{ color: "var(--muted-foreground)" }}>{fmtTime(evt.ts)}</span>
    </div>
  );
}

// ─── Mini sparkline SVG ───────────────────────────────────────────────────────
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const W = 56, H = 18, pad = 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2);
    const y = H - pad - ((v / max) * (H - pad * 2));
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={W} height={H} style={{ display: "block" }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" opacity={0.7} />
      {data.map((v, i) => {
        if (v === 0) return null;
        const x = pad + (i / (data.length - 1)) * (W - pad * 2);
        const y = H - pad - ((v / max) * (H - pad * 2));
        return <circle key={i} cx={x} cy={y} r={1.5} fill={color} opacity={0.9} />;
      })}
    </svg>
  );
}

// ─── Animated pipeline flow ───────────────────────────────────────────────────
type StageActivity = {
  active: boolean; error: boolean; throughput: number; per5min: number;
  totalCount: number; errorCount: number;
  lastTitle?: string; lastAgency?: string; lastUrl?: string; lastErrorMsg?: string;
  sparkline: number[];
};

function PipelineFlow({ stageActivity, sseEvents }: { stageActivity: StageActivity[]; sseEvents: PipelineEvent[] }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [statsExpanded, setStatsExpanded] = useState(false);
  const toggle = (id: string) => setExpanded(p => ({ ...p, [id]: !p[id] }));

  // Cumulative stats for the bottom bar
  const totalCrawled  = sseEvents.filter(e => e.stage === "job_start").length;
  const totalFetched  = sseEvents.filter(e => e.stage === "fetch_ok").length;
  const totalParsed   = sseEvents.filter(e => e.stage === "parse_item").length;
  const totalInserted = sseEvents.filter(e => e.stage === "db_insert").length;
  const totalDups     = sseEvents.filter(e => e.stage === "db_dup").length;
  const totalEnriched = sseEvents.filter(e => e.stage === "enrich_done").length;
  const totalFails    = sseEvents.filter(e => e.stage === "fetch_fail" || e.stage === "job_fail").length;
  const successRate   = totalFetched + totalFails > 0
    ? Math.round((totalFetched / (totalFetched + totalFails)) * 100)
    : null;

  return (
    <div className="flex flex-col h-full">
      {/* Stage list */}
      <div className="flex-1 px-3 py-3 space-y-2 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>
        {STAGES.map((stage, i) => {
          const act = stageActivity[i];
          const Icon = stage.icon;
          const isLast = i === STAGES.length - 1;
          const isExpanded = !!expanded[stage.id];

          return (
            <div key={stage.id} className="relative">
              {/* Stage card */}
              <div
                className="relative rounded-lg overflow-hidden transition-all duration-500"
                style={{
                  border: `1px solid ${act.error ? "rgba(248,113,113,0.5)" : act.active ? stage.border : "rgba(56,189,248,0.08)"}`,
                  background: act.error ? "rgba(248,113,113,0.05)" : act.active ? stage.bg : "oklch(from var(--foreground) l c h / 0.05)",
                  boxShadow: act.active && !act.error ? `0 0 20px ${stage.glow}, inset 0 0 20px ${stage.glow}` : "none",
                }}
              >
                {/* Scanning line animation when active */}
                {act.active && !act.error && (
                  <div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: `linear-gradient(90deg, transparent 0%, ${stage.color}15 50%, transparent 100%)`,
                      animation: "scanline 2s linear infinite",
                    }}
                  />
                )}

                {/* Header row — clickable to expand */}
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 relative z-10 text-left"
                  onClick={() => toggle(stage.id)}
                  style={{ background: "transparent", border: "none", cursor: "pointer" }}
                >
                  {/* Stage number */}
                  <div
                    className="w-5 h-5 rounded text-[8px] font-mono font-black flex items-center justify-center shrink-0"
                    style={{ background: act.active ? `${stage.color}20` : "oklch(from var(--foreground) l c h / 0.08)", color: act.active ? stage.color : "var(--muted-foreground)", border: `1px solid ${act.active ? stage.border : "rgba(56,189,248,0.05)"}` }}
                  >
                    {String(i + 1).padStart(2, "0")}
                  </div>

                  {/* Icon */}
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: act.active ? `${stage.color}15` : "oklch(from var(--foreground) l c h / 0.06)" }}
                  >
                    <Icon
                      size={13}
                      style={{ color: act.error ? "#f87171" : act.active ? stage.color : "var(--foreground)" }}
                      className={act.active && !act.error ? "animate-pulse" : ""}
                    />
                  </div>

                  {/* Labels */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] font-mono font-bold tracking-wider" style={{ color: act.active ? "var(--foreground)" : "var(--muted-foreground)" }}>
                        {stage.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {act.throughput > 0 && (
                          <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded"
                            style={{ color: stage.color, background: `${stage.color}15`, border: `1px solid ${stage.color}30` }}>
                            {act.throughput}/min
                          </span>
                        )}
                        {act.totalCount > 0 && (
                          <span className="text-[8px] font-mono px-1 py-0.5 rounded"
                            style={{ color: "var(--muted-foreground)", background: "oklch(from var(--foreground) l c h / 0.06)", border: "1px solid rgba(56,189,248,0.08)" }}>
                            {act.totalCount}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-[8px] font-mono tracking-wider mt-0.5" style={{ color: "var(--muted-foreground)" }}>
                      {stage.sublabel}
                    </div>
                    {act.lastTitle && act.active && (
                      <div className="text-[8px] font-mono mt-1 truncate" style={{ color: `${stage.color}70` }}>
                        ▸ {act.lastTitle}
                      </div>
                    )}
                  </div>

                  {/* Status indicator + expand chevron */}
                  <div className="shrink-0 flex flex-col items-center gap-1">
                    {act.error ? (
                      <div className="w-2 h-2 rounded-full bg-red-500" style={{ boxShadow: "0 0 6px rgba(248,113,113,0.8)" }} />
                    ) : act.active ? (
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full" style={{ background: stage.color, boxShadow: `0 0 8px ${stage.glow}` }} />
                        <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping" style={{ background: stage.color, opacity: 0.4 }} />
                      </div>
                    ) : (
                      <div className="w-2 h-2 rounded-full" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.15)" }} />
                    )}
                    <ChevronDown
                      size={8}
                      style={{
                        color: "rgba(56,189,248,0.3)",
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 0.2s",
                      }}
                    />
                  </div>
                </button>

                {/* ── Expanded detail panel ─────────────────────────────── */}
                {isExpanded && (
                  <div
                    className="px-3 pb-3 pt-0 relative z-10"
                    style={{ borderTop: `1px solid ${stage.color}18` }}
                  >
                    {/* Metric grid */}
                    <div className="grid grid-cols-3 gap-1.5 mb-2 mt-2">
                      {[
                        { label: "TOTAL",   value: act.totalCount,  color: stage.color },
                        { label: "/MIN",    value: act.throughput,  color: act.throughput > 0 ? stage.color : "var(--muted-foreground)" },
                        { label: "/5MIN",   value: act.per5min,     color: act.per5min  > 0 ? stage.color : "var(--muted-foreground)" },
                        { label: "ERRORS",  value: act.errorCount,  color: act.errorCount > 0 ? "#f87171" : "var(--muted-foreground)" },
                        { label: "ERR%",    value: act.totalCount > 0 ? `${Math.round((act.errorCount / act.totalCount) * 100)}%` : "—", color: act.errorCount > 0 ? "#f87171" : "var(--muted-foreground)" },
                        { label: "STATUS",  value: act.active ? "LIVE" : act.totalCount > 0 ? "IDLE" : "WAIT", color: act.active ? "#34d399" : act.totalCount > 0 ? "#fbbf24" : "var(--muted-foreground)" },
                      ].map(m => (
                        <div key={m.label} className="rounded px-2 py-1.5 text-center" style={{ background: "oklch(from var(--foreground) l c h / 0.06)", border: "1px solid rgba(56,189,248,0.06)" }}>
                          <div className="text-[9px] font-mono font-black" style={{ color: m.color }}>{m.value}</div>
                          <div className="text-[7px] font-mono tracking-widest mt-0.5" style={{ color: "var(--muted-foreground)" }}>{m.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Sparkline */}
                    {act.totalCount > 0 && (
                      <div className="mb-2">
                        <div className="text-[7px] font-mono tracking-widest mb-1" style={{ color: "var(--muted-foreground)" }}>THROUGHPUT — LAST 10 MIN</div>
                        <div className="flex items-end gap-0.5" style={{ height: 20 }}>
                          {act.sparkline.map((v, k) => {
                            const maxV = Math.max(...act.sparkline, 1);
                            const h = Math.max(2, Math.round((v / maxV) * 18));
                            return (
                              <div
                                key={k}
                                title={`${v} events`}
                                style={{
                                  flex: 1,
                                  height: h,
                                  background: v > 0 ? `${stage.color}${v === maxV ? "cc" : "60"}` : "rgba(56,189,248,0.06)",
                                  borderRadius: 1,
                                  transition: "height 0.3s",
                                }}
                              />
                            );
                          })}
                        </div>
                        <div className="flex justify-between mt-0.5">
                          <span className="text-[6px] font-mono" style={{ color: "#0f172a" }}>-10m</span>
                          <span className="text-[6px] font-mono" style={{ color: "#0f172a" }}>now</span>
                        </div>
                      </div>
                    )}

                    {/* Last signal */}
                    {act.lastTitle && (
                      <div className="mb-1.5">
                        <div className="text-[7px] font-mono tracking-widest mb-0.5" style={{ color: "var(--muted-foreground)" }}>LAST SIGNAL</div>
                        <div className="flex items-start gap-1">
                          <div className="text-[8px] font-mono truncate flex-1" style={{ color: `${stage.color}90` }}>▸ {act.lastTitle}</div>
                          {act.lastUrl && (
                            <a href={act.lastUrl} target="_blank" rel="noopener noreferrer" className="shrink-0" onClick={e => e.stopPropagation()}>
                              <ExternalLink size={8} style={{ color: "var(--muted-foreground)" }} />
                            </a>
                          )}
                        </div>
                        {act.lastAgency && (
                          <div className="text-[7px] font-mono mt-0.5" style={{ color: "var(--muted-foreground)" }}>SOURCE: {act.lastAgency}</div>
                        )}
                      </div>
                    )}

                    {/* Last error */}
                    {act.lastErrorMsg && (
                      <div className="rounded px-2 py-1.5" style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)" }}>
                        <div className="text-[7px] font-mono tracking-widest mb-0.5" style={{ color: "rgba(248,113,113,0.5)" }}>LAST ERROR</div>
                        <div className="text-[8px] font-mono truncate" style={{ color: "#f87171" }}>⚠ {act.lastErrorMsg}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Flow connector arrow */}
              {!isLast && (
                <div className="flex justify-center my-1">
                  <div className="flex flex-col items-center gap-0.5">
                    {[0, 1, 2].map(j => (
                      <div
                        key={j}
                        className="w-px h-1 transition-all duration-300"
                        style={{
                          background: act.active
                            ? `linear-gradient(to bottom, ${stage.color}80, ${STAGES[i + 1].color}40)`
                            : "rgba(56,189,248,0.1)",
                        }}
                      />
                    ))}
                    <div
                      className="w-0 h-0 transition-all duration-300"
                      style={{
                        borderLeft: "3px solid transparent",
                        borderRight: "3px solid transparent",
                        borderTop: `4px solid ${act.active ? stage.color : "rgba(56,189,248,0.15)"}`,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Bottom stats bar ─────────────────────────────────────────────── */}
      <div className="shrink-0" style={{ borderTop: "1px solid rgba(56,189,248,0.1)", background: "oklch(from var(--foreground) l c h / 0.08)" }}>
        {/* Collapsed single-row summary — always visible */}
        <button
          className="w-full flex items-center gap-2 px-3 py-1.5 transition-all"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          onClick={() => setStatsExpanded(s => !s)}
        >
          <span className="text-[7px] font-mono tracking-widest" style={{ color: "rgba(56,189,248,0.25)" }}>SESSION TOTALS</span>
          <div className="flex-1 flex items-center gap-2 overflow-hidden">
            {[
              { label: "CRAWLED", value: totalCrawled,  color: "#818cf8" },
              { label: "STORED",  value: totalInserted, color: "#34d399" },
              { label: "ERR",     value: totalFails,    color: totalFails > 0 ? "#f87171" : "var(--muted-foreground)" },
              { label: "OK%",     value: successRate !== null ? `${successRate}%` : "—", color: successRate !== null ? (successRate >= 80 ? "#34d399" : successRate >= 50 ? "#fbbf24" : "#f87171") : "var(--muted-foreground)" },
            ].map(s => (
              <span key={s.label} className="text-[8px] font-mono font-black shrink-0" style={{ color: s.color }}>
                {s.value} <span style={{ color: "var(--muted-foreground)", fontWeight: 400 }}>{s.label}</span>
              </span>
            ))}
          </div>
          <span className="text-[8px] font-mono shrink-0 transition-transform" style={{ color: "rgba(56,189,248,0.3)", transform: statsExpanded ? "rotate(180deg)" : "rotate(0deg)" }}>▲</span>
        </button>
        {/* Expanded 2-col grid */}
        {statsExpanded && (
          <div className="px-3 pb-2.5">
            <div className="grid grid-cols-2 gap-1.5">
              {[
                { label: "CRAWLED",   value: totalCrawled,  color: "#818cf8", icon: "⬡" },
                { label: "FETCHED",   value: totalFetched,  color: "#38bdf8", icon: "↓" },
                { label: "PARSED",    value: totalParsed,   color: "#a78bfa", icon: "◈" },
                { label: "STORED",    value: totalInserted, color: "#34d399", icon: "▣" },
                { label: "ENRICHED",  value: totalEnriched, color: "#fbbf24", icon: "✦" },
                { label: "DUPES",     value: totalDups,     color: "#64748b", icon: "≡" },
                { label: "ERRORS",    value: totalFails,    color: totalFails > 0 ? "#f87171" : "var(--muted-foreground)", icon: "⚠" },
                { label: "SUCCESS%",  value: successRate !== null ? `${successRate}%` : "—", color: successRate !== null ? (successRate >= 80 ? "#34d399" : successRate >= 50 ? "#fbbf24" : "#f87171") : "var(--muted-foreground)", icon: "✓" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 px-2 py-1.5 rounded" style={{ background: "oklch(from var(--foreground) l c h / 0.06)", border: "1px solid rgba(56,189,248,0.06)" }}>
                  <span className="text-[9px] shrink-0" style={{ color: s.color }}>{s.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[9px] font-mono font-black" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[6px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Scanline CSS ─────────────────────────────────────────────────────────────
const scanlineCSS = `
@keyframes scanline {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}
@keyframes blink-dot {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.2; }
}
`;

// ─── Main component ───────────────────────────────────────────────────────────
interface FetchingMonitorProps { region?: string; refreshKey?: number; }

export function FetchingMonitor({ refreshKey }: FetchingMonitorProps) {
  const { events: sseEvents, connected: sseConnected, clearEvents } = useCrawlStream();

  // Resizable panels
  const leftPanel  = useDragDivider(280, 200, 440, "left");
  const rightPanel = useDragDivider(440, 300, 600, "right");
  const activeCrawlersResize = useVerticalResize(220, 80, 500);
  const pipelineStagesResize = useVerticalResize(420, 120, 700);
  const intelStreamResize    = useVerticalResize(220, 80, 500, true);

  // Collapse state (persisted)
  const [pipelineCollapsed,       setPipelineCollapsed]       = useState(() => localStorage.getItem("fm_pipeline_collapsed")       === "1");
  const [metricsCollapsed,        setMetricsCollapsed]        = useState(() => localStorage.getItem("fm_metrics_collapsed")        === "1");
  const [activeCrawlersCollapsed, setActiveCrawlersCollapsed] = useState(() => localStorage.getItem("fm_activeCrawlers_collapsed") === "1");
  const [recentlyCompCollapsed,   setRecentlyCompCollapsed]   = useState(() => localStorage.getItem("fm_recentlyComp_collapsed")   === "1");
  const [jobLogCollapsed,         setJobLogCollapsed]         = useState(() => localStorage.getItem("fm_jobLog_collapsed")         === "1");
  const [intelStreamCollapsed,    setIntelStreamCollapsed]    = useState(() => localStorage.getItem("fm_intelStream_collapsed")    === "1");

  const togglePipeline       = useCallback(() => setPipelineCollapsed(v => { const n = !v; localStorage.setItem("fm_pipeline_collapsed",       n ? "1" : "0"); return n; }), []);
  const toggleMetrics        = useCallback(() => setMetricsCollapsed(v => { const n = !v; localStorage.setItem("fm_metrics_collapsed",        n ? "1" : "0"); return n; }), []);
  const toggleActiveCrawlers = useCallback(() => setActiveCrawlersCollapsed(v => { const n = !v; localStorage.setItem("fm_activeCrawlers_collapsed", n ? "1" : "0"); return n; }), []);
  const toggleRecentlyComp   = useCallback(() => setRecentlyCompCollapsed(v => { const n = !v; localStorage.setItem("fm_recentlyComp_collapsed",   n ? "1" : "0"); return n; }), []);
  const toggleJobLog         = useCallback(() => setJobLogCollapsed(v => { const n = !v; localStorage.setItem("fm_jobLog_collapsed",         n ? "1" : "0"); return n; }), []);

  // Feed state
  const feedRef   = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [feedFilter, setFeedFilter] = useState<string>("all");
  const [jobFilter, setJobFilter]   = useState<string>("all");

  // Webhooks panel
  const [webhooksOpen, setWebhooksOpen] = useState(false);

  // Job log state
  const [statusFilter, setStatusFilter] = useState<"all"|"pending"|"running"|"completed"|"failed">("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 50;

  // tRPC queries
  const liveQ    = trpc.crawler.liveStatus.useQuery(undefined, { refetchInterval: 2000 });
  const jobLogQ  = trpc.crawler.jobLog.useQuery(
    { limit: PAGE_SIZE, offset: page * PAGE_SIZE, status: statusFilter },
    { refetchInterval: 2000 },
  );
  const activeIdsQ = trpc.crawler.activeJobIds.useQuery(undefined, { refetchInterval: 2000 });

  const cancelMut = trpc.crawler.cancelJob.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Job #${vars.jobId} terminated`);
      liveQ.refetch(); jobLogQ.refetch();
    },
    onError: e => toast.error(`Termination failed: ${e.message}`),
  });
  const cleanupMut = trpc.crawler.cleanupStuck.useMutation({
    onSuccess: () => { toast.success("Stuck operations cleared"); liveQ.refetch(); jobLogQ.refetch(); },
  });
  const clearMut = trpc.crawler.clearOldJobs.useMutation({
    onSuccess: d => { toast.success(`Purged ${d.deleted} old operations`); jobLogQ.refetch(); },
    onError: e => toast.error("Purge failed", { description: e.message }),
  });
  const replayMut = trpc.agencies.crawlOne.useMutation({
    onSuccess: (_, vars) => {
      toast.success(`Replay dispatched for source #${vars.id}`);
      liveQ.refetch(); jobLogQ.refetch();
    },
    onError: e => toast.error(`Replay failed: ${e.message}`),
  });

  // Refresh on crawl start — staggered refetches to catch fast-completing jobs
  // Also auto-expand Ops Log and Active Crawlers so the user sees the new jobs
  useEffect(() => {
    if (!refreshKey || refreshKey <= 0) return;
    // Expand key sections so new jobs are immediately visible
    setJobLogCollapsed(false); localStorage.setItem('fm_jobLog_collapsed', '0');
    setActiveCrawlersCollapsed(false); localStorage.setItem('fm_activeCrawlers_collapsed', '0');
    setIntelStreamCollapsed(false); localStorage.setItem('fm_intelStream_collapsed', '0');
    liveQ.refetch(); jobLogQ.refetch();
    const t1 = setTimeout(() => { liveQ.refetch(); jobLogQ.refetch(); }, 1500);
    const t2 = setTimeout(() => { liveQ.refetch(); jobLogQ.refetch(); }, 4000);
    const t3 = setTimeout(() => { liveQ.refetch(); jobLogQ.refetch(); }, 8000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [refreshKey]);

  // Auto-scroll feed
  useEffect(() => {
    if (autoScroll && feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [sseEvents.length, autoScroll]);

  // Refresh job log when a job completes
  useEffect(() => {
    const last = sseEvents[sseEvents.length - 1];
    if (last && (last.stage === "job_done" || last.stage === "job_fail")) {
      jobLogQ.refetch(); liveQ.refetch();
    }
  }, [sseEvents.length]);

  // ── Derived state ──────────────────────────────────────────────────────────
  const ACTIVE_WINDOW = 8000;
  const [tick, setTickVal] = useState(0);
  const stageActivity = useMemo(() => {
    const now = Date.now();
    return STAGES.map((stage, i) => {
      const allForStage  = sseEvents.filter(e => stageIndexForEvent(e.stage) === i);
      const ERROR_WINDOW = 30000; // errors only highlight for 30s
      const recent       = allForStage.filter(e => now - e.ts < ACTIVE_WINDOW);
      const allErrors    = allForStage.filter(e => e.stage === "fetch_fail" || e.stage === "job_fail");
      const recentErrors = allErrors.filter(e => now - e.ts < ERROR_WINDOW);
      const lastWithTitle = [...allForStage].reverse().find(e => e.articleTitle);
      const lastError    = [...allErrors].reverse()[0];
      const perMin       = allForStage.filter(e => e.ts > now - 60000).length;
      const per5min      = allForStage.filter(e => e.ts > now - 300000).length;
      const totalCount   = allForStage.length;
      const errorCount   = allErrors.length;
      // 10-bucket mini-sparkline (last 10 min, 1 min each)
      const sparkline    = Array.from({ length: 10 }, (_, k) => {
        const from = now - (10 - k) * 60000;
        const to   = now - (9  - k) * 60000;
        return allForStage.filter(e => e.ts >= from && e.ts < to).length;
      });
      const lastAgency   = [...allForStage].reverse().find(e => e.agencyName)?.agencyName;
      const lastUrl      = [...allForStage].reverse().find(e => e.articleUrl)?.articleUrl;
      return {
        active: recent.length > 0,
        error: recentErrors.length > 0,
        throughput: perMin,
        per5min,
        totalCount,
        errorCount,
        lastTitle: lastWithTitle?.articleTitle,
        lastAgency,
        lastUrl,
        lastErrorMsg: lastError?.error ?? lastError?.articleTitle,
        sparkline,
      };
    });
  }, [sseEvents, tick]);
  const runningJobs   = liveQ.data?.runningJobs ?? [];
  const activeIds     = activeIdsQ.data?.ids ?? [];
  const parallelCount = Math.max(runningJobs.length, 0);
  const jobs          = jobLogQ.data?.jobs ?? [];
  const total         = jobLogQ.data?.total ?? 0;
  const totalPages    = Math.ceil(total / PAGE_SIZE);
  const nowTs = Date.now();
  const oneMinAgo  = nowTs - 60000;
  const newLast60  = sseEvents.filter(e => e.stage === "db_insert" && e.ts > oneMinAgo).length;
  const errLast60  = sseEvents.filter(e => (e.stage === "fetch_fail" || e.stage === "job_fail") && e.ts > oneMinAgo).length;

  const sseJobIds = useMemo(() => {
    const ids = new Set(sseEvents.map(e => e.jobId).filter(id => id > 0));
    return Array.from(ids).sort((a, b) => b - a).slice(0, 30);
  }, [sseEvents]);

  const displayEvents = useMemo(() => {
    return sseEvents
      .filter(e => !["job_start", "job_done"].includes(e.stage) || feedFilter === "all")
      .filter(e => feedFilter === "all" || e.stage === feedFilter)
      .filter(e => jobFilter === "all" || e.jobId === Number(jobFilter))
      .slice(-300);
  }, [sseEvents, feedFilter, jobFilter]);

   const isAnyCrawlActive = parallelCount > 0 || sseEvents.some(e => nowTs - e.ts < ACTIVE_WINDOW && ["fetch_start","parse_item","db_insert"].includes(e.stage));
  // System time + tick (drives 'now' updates so stage active state expires correctly)
  const [sysTime, setSysTime] = useState(() => new Date().toLocaleTimeString());
  useEffect(() => {
    const t = setInterval(() => {
      setSysTime(new Date().toLocaleTimeString());
      setTickVal(n => n + 1);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // CSV export
  const exportCSV = useCallback(() => {
    const header = "id,agency,country,status,started,completed,found,new,error,region\n";
    const rows = jobs.map(j =>
      [j.id, j.agencyName, j.agencyCountry, j.status, j.startedAt, j.completedAt, j.articlesFound, j.articlesNew, (j.errorMessage ?? "").replace(/,/g, ";"), j.region].join(",")
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sigint-ops-${Date.now()}.csv`; a.click();
  }, [jobs]);

  const exportJSON = useCallback(() => {
    const blob = new Blob([JSON.stringify(jobs, null, 2)], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `sigint-ops-${Date.now()}.json`; a.click();
  }, [jobs]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-full flex flex-col overflow-hidden"
      style={{
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
        background: "var(--background)",
        color: "var(--foreground)",
      }}
    >
      <style>{scanlineCSS}</style>

      {/* ── CLASSIFIED HEADER BAR ──────────────────────────────────────────── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-2 flex-wrap gap-y-1.5"
        style={{
          background: "linear-gradient(90deg, oklch(from var(--foreground) l c h / 0.15) 0%, oklch(from var(--foreground) l c h / 0.18) 50%, oklch(from var(--foreground) l c h / 0.15) 100%)",
          borderBottom: "1px solid rgba(56,189,248,0.15)",
          boxShadow: "0 1px 20px rgba(56,189,248,0.05)",
        }}
      >
        {/* System status */}
        <div className="flex items-center gap-1.5">
          <div className={`w-1.5 h-1.5 rounded-full ${sseConnected ? "bg-emerald-400" : "bg-red-500"}`}
            style={{ boxShadow: sseConnected ? "0 0 6px rgba(52,211,153,0.8)" : "0 0 6px rgba(248,113,113,0.8)", animation: "blink-dot 2s ease-in-out infinite" }}
          />
          <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: sseConnected ? "#34d399" : "#f87171" }}>
            {sseConnected ? "STREAM LIVE" : "RECONNECTING"}
          </span>
        </div>

        <div className="w-px h-3" style={{ background: "rgba(56,189,248,0.15)" }} />

        {/* Active jobs */}
        <div className="flex items-center gap-1.5">
          <Signal size={9} style={{ color: parallelCount > 0 ? "#38bdf8" : "var(--muted-foreground)" }} className={parallelCount > 0 ? "animate-pulse" : ""} />
          <span className="text-[9px] font-mono font-bold tracking-widest" style={{ color: parallelCount > 0 ? "#38bdf8" : "var(--muted-foreground)" }}>
            {parallelCount} ACTIVE OP{parallelCount !== 1 ? "S" : ""}
          </span>
          {parallelCount > 1 && (
            <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded animate-pulse"
              style={{ background: "rgba(56,189,248,0.12)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.25)" }}>
              PARALLEL
            </span>
          )}
        </div>

        <div className="w-px h-3" style={{ background: "rgba(56,189,248,0.15)" }} />

        {/* Throughput */}
        <div className="flex items-center gap-1.5">
          <TrendingUp size={9} style={{ color: "#6366f1" }} />
          <span className="text-[9px] font-mono" style={{ color: "var(--muted-foreground)" }}>
            <span style={{ color: newLast60 > 0 ? "#34d399" : "var(--muted-foreground)" }}>{newLast60} INTEL</span>
            {" · "}
            <span style={{ color: errLast60 > 0 ? "#f87171" : "var(--muted-foreground)" }}>{errLast60} ERR</span>
            <span style={{ color: "var(--foreground)" }}> /60s</span>
          </span>
        </div>

        <div className="w-px h-3" style={{ background: "rgba(56,189,248,0.15)" }} />

        {/* Classification */}
        <div className="flex items-center gap-1.5">
          <Lock size={9} style={{ color: "#dc2626" }} />
          <span className="text-[9px] font-mono font-black tracking-widest" style={{ color: "#dc2626" }}>
            TS//SCI//NOFORN
          </span>
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-3">
          {/* System time */}
          <span className="text-[9px] font-mono" style={{ color: "var(--muted-foreground)" }}>
            {sysTime} UTC
          </span>

          {isAnyCrawlActive && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded"
              style={{ background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)" }}>
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" style={{ boxShadow: "0 0 6px rgba(52,211,153,0.8)" }} />
              <span className="text-[9px] font-mono font-black tracking-widest" style={{ color: "#34d399" }}>ACQUIRING</span>
            </div>
          )}

          <button
            onClick={() => cleanupMut.mutate()}
            disabled={cleanupMut.isPending}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-150"
            style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: "#92400e" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fbbf24"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.4)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#92400e"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(251,191,36,0.15)"; }}
          >
            {cleanupMut.isPending ? <Loader2 size={9} className="animate-spin" /> : <RefreshCw size={9} />}
            <span className="text-[9px] font-mono font-bold tracking-widest">PURGE STUCK</span>
          </button>

          <button
            onClick={clearEvents}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-150"
            style={{ background: "rgba(100,116,139,0.06)", border: "1px solid rgba(100,116,139,0.15)", color: "var(--muted-foreground)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
          >
            <span className="text-[9px] font-mono font-bold tracking-widest">CLEAR FEED</span>
          </button>

          <button
            onClick={() => setWebhooksOpen(v => !v)}
            className="flex items-center gap-1.5 px-2 py-1 rounded transition-all duration-150"
            style={{
              background: webhooksOpen ? "rgba(251,191,36,0.12)" : "rgba(251,191,36,0.06)",
              border: webhooksOpen ? "1px solid rgba(251,191,36,0.4)" : "1px solid rgba(251,191,36,0.15)",
              color: webhooksOpen ? "#fbbf24" : "#92400e",
            }}
          >
            <Zap size={9} />
            <span className="text-[9px] font-mono font-bold tracking-widest">WEBHOOKS</span>
          </button>
        </div>
      </div>

      {/* ── WEBHOOKS SETTINGS PANEL (slides in from top) ─────────────────── */}
      {webhooksOpen && <WebhooksPanel onClose={() => setWebhooksOpen(false)} />}

      {/* ── MAIN LAYOUT: collapsible left pipeline + center + right ─────── */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">

        {/* ── PIPELINE SLIDE PANEL (left, collapsible) ────────────────────── */}
        <div
          className="flex flex-col overflow-hidden shrink-0 transition-all duration-300"
          style={{
            width: pipelineCollapsed ? 0 : leftPanel.width,
            minWidth: pipelineCollapsed ? 0 : undefined,
            borderRight: pipelineCollapsed ? "none" : "1px solid rgba(56,189,248,0.12)",
            overflow: "hidden",
          }}
        >
          {/* Panel header */}
          <div
            className="shrink-0 flex items-center gap-2 px-3 py-2"
            style={{ borderBottom: "1px solid rgba(56,189,248,0.08)", background: "rgba(129,140,248,0.04)" }}
          >
            <Layers size={10} style={{ color: "#818cf8" }} />
            <span className="text-[9px] font-mono font-black tracking-widest" style={{ color: "#818cf8" }}>SIGNAL PIPELINE</span>
            <div className="ml-auto flex items-center gap-1.5">
              {stageActivity.some(s => s.active) && (
                <span className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded animate-pulse"
                  style={{ background: "rgba(129,140,248,0.12)", color: "#818cf8", border: "1px solid rgba(129,140,248,0.25)" }}
                >
                  ACTIVE
                </span>
              )}
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <PipelineFlow stageActivity={stageActivity} sseEvents={sseEvents} />
          </div>
        </div>

        {/* ── PIPELINE TOGGLE TAB ─────────────────────────────────────────── */}
        <button
          onClick={togglePipeline}
          className="absolute top-1/2 z-20 flex flex-col items-center justify-center gap-1 transition-all duration-300"
          style={{
            left: pipelineCollapsed ? 0 : leftPanel.width,
            transform: "translateY(-50%)",
            width: 18,
            height: 72,
            background: "rgba(129,140,248,0.08)",
            borderTop: "1px solid rgba(129,140,248,0.2)",
            borderRight: "1px solid rgba(129,140,248,0.2)",
            borderBottom: "1px solid rgba(129,140,248,0.2)",
            borderLeft: pipelineCollapsed ? "1px solid rgba(129,140,248,0.2)" : "none",
            borderRadius: pipelineCollapsed ? "0 6px 6px 0" : "0 6px 6px 0",
            color: "#818cf8",
            cursor: "pointer",
          }}
          title={pipelineCollapsed ? "Show Signal Pipeline" : "Hide Signal Pipeline"}
        >
          {pipelineCollapsed
            ? <ChevronRight size={10} />
            : <ChevronLeft size={10} />
          }
          <span
            className="text-[7px] font-mono font-black tracking-widest"
            style={{ writingMode: "vertical-rl", textOrientation: "mixed", color: "#818cf8", letterSpacing: "0.15em" }}
          >
            PIPELINE
          </span>
        </button>

        {/* ── CENTER: Metrics + Active Ops + Recently Completed ───────────── */}
        <div
          className="flex-1 min-w-0 flex flex-col overflow-hidden"
          style={{
            marginLeft: pipelineCollapsed ? 18 : 18,
            borderRight: "1px solid rgba(56,189,248,0.08)",
          }}
        >
          {/* KPI tiles */}
          <div className="shrink-0">
            <SectionHeader icon={BarChart3} label="Signal Metrics" collapsed={metricsCollapsed} onToggle={toggleMetrics} accent="#38bdf8" />
            {!metricsCollapsed && (
              <div className="p-3">
                <div className="grid grid-cols-4 gap-2">
                  <KpiTile label="Total Ops"      value={total}         icon={Activity}      color="#818cf8" sub="all time" />
                  <KpiTile label="Active Now"     value={parallelCount} icon={Signal}        color="#34d399" sub="running crawlers" pulse={parallelCount > 0} />
                  <KpiTile label="Intel Acquired" value={newLast60}     icon={Newspaper}     color="#38bdf8" sub="last 60 seconds" />
                  <KpiTile label="Intercept Fail" value={errLast60}     icon={AlertOctagon}  color={errLast60 > 0 ? "#f87171" : "var(--muted-foreground)"} sub="last 60 seconds" />
                </div>
              </div>
            )}
          </div>

          {/* Active crawlers */}
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={{ height: activeCrawlersCollapsed ? "auto" : activeCrawlersResize.height }}
          >
            <SectionHeader
              icon={Crosshair}
              label="Active Operations"
              collapsed={activeCrawlersCollapsed}
              onToggle={toggleActiveCrawlers}
              accent="#f87171"
              badge={
                parallelCount > 0 ? (
                  <span
                    className="text-[8px] font-mono font-black px-1.5 py-0.5 rounded animate-pulse"
                    style={{ background: "rgba(52,211,153,0.12)", color: "#34d399", border: "1px solid rgba(52,211,153,0.25)" }}
                  >
                    {parallelCount} LIVE
                  </span>
                ) : undefined
              }
            />
            {!activeCrawlersCollapsed && (
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-2" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>
                {runningJobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 gap-2">
                    <ShieldCheck size={16} style={{ color: "rgba(56,189,248,0.1)" }} />
                    <span className="text-[9px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>NO ACTIVE OPERATIONS</span>
                  </div>
                ) : (
                  runningJobs.map(job => {
                    const isInMemory = activeIds.includes(job.id);
                    return (
                      <div
                        key={job.id}
                        className="rounded-lg px-3 py-2.5 transition-all"
                        style={{
                          background: "rgba(56,189,248,0.04)",
                          border: "1px solid rgba(56,189,248,0.15)",
                          boxShadow: "0 0 12px rgba(56,189,248,0.04)",
                        }}
                      >
                        <div className="flex items-start gap-2.5">
                          <div className="relative shrink-0 mt-1.5">
                            <div className="w-2 h-2 rounded-full bg-sky-400" style={{ boxShadow: "0 0 6px rgba(56,189,248,0.8)" }} />
                            <div className="absolute inset-0 w-2 h-2 rounded-full bg-sky-400 animate-ping opacity-30" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[11px] font-mono font-bold truncate" style={{ color: "#93c5fd" }}>
                                {job.agencyName ?? `OP #${job.id}`}
                              </span>
                              <span className="text-[8px] font-mono shrink-0" style={{ color: "var(--muted-foreground)" }}>#{job.id}</span>
                              {!isInMemory && (
                                <span title="Not in active registry — may be stuck"><AlertTriangle size={9} className="text-yellow-500 shrink-0" /></span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[9px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                              <span className="flex items-center gap-1">
                                <Clock size={8} />
                                <LiveDuration startedAt={job.startedAt} />
                              </span>
                              {job.region && (
                                <span className="flex items-center gap-1">
                                  <Globe size={8} />
                                  {job.region}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold transition-all shrink-0"
                            style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.2)", color: "#7f1d1d" }}
                            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.5)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.12)"; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#7f1d1d"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.2)"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(248,113,113,0.06)"; }}
                            onClick={() => cancelMut.mutate({ jobId: job.id })}
                            disabled={cancelMut.isPending}
                          >
                            <StopCircle size={9} />
                            ABORT
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Drag divider */}
          {!activeCrawlersCollapsed && !recentlyCompCollapsed && (
            <HorizontalDragDivider onMouseDown={activeCrawlersResize.onMouseDown} />
          )}

          {/* Recently completed */}
          <div className="flex flex-col overflow-hidden flex-1 min-h-0">
            <SectionHeader
              icon={CheckCircle2}
              label="Completed Operations"
              count={jobs.filter(j => j.status === "completed").length}
              collapsed={recentlyCompCollapsed}
              onToggle={toggleRecentlyComp}
              accent="#34d399"
            />
            {!recentlyCompCollapsed && (
              <div className="flex-1 min-h-0 overflow-y-auto p-2 space-y-1" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>
                {jobs.filter(j => j.status === "completed").length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-20 gap-2">
                    <CheckCircle2 size={16} style={{ color: "rgba(56,189,248,0.1)" }} />
                    <span className="text-[9px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>NO COMPLETED OPERATIONS</span>
                  </div>
                ) : (
                  jobs.filter(j => j.status === "completed").map(job => (
                    <div
                      key={job.id}
                      className="flex items-center gap-2 px-2 py-1.5 rounded transition-all"
                      style={{ borderLeft: "2px solid rgba(52,211,153,0.2)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.background = "rgba(52,211,153,0.04)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                    >
                      <CheckCircle2 size={8} style={{ color: "rgba(52,211,153,0.5)" }} className="shrink-0" />
                      <span className="text-[9px] font-mono truncate flex-1" style={{ color: "var(--muted-foreground)" }}>
                        {job.agencyName ?? `OP #${job.id}`}
                      </span>
                      <span
                        className="text-[9px] font-mono font-bold shrink-0"
                        style={{ color: (job.articlesNew ?? 0) > 0 ? "#34d399" : "var(--muted-foreground)" }}
                      >
                        +{job.articlesNew ?? 0}
                      </span>
                      <span className="text-[8px] font-mono shrink-0" style={{ color: "var(--foreground)" }}>
                        {fmtRelative(job.completedAt)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── DRAG DIVIDER (right) ─────────────────────────────────────────── */}
        <DragDivider onMouseDown={rightPanel.onMouseDown} />

        {/* ── RIGHT: Operation Log + Intel Stream ──────────────────────── */}
        <div className="flex flex-col overflow-hidden shrink-0" style={{ width: rightPanel.width }}>
          <SectionHeader
            icon={Terminal}
            label="Ops Log"
            count={total}
            collapsed={jobLogCollapsed}
            onToggle={toggleJobLog}
            accent="#fbbf24"
          >
            {!jobLogCollapsed && (
              <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                <Select value={statusFilter} onValueChange={v => { setStatusFilter(v as any); setPage(0); }}>
                  <SelectTrigger
                    className="h-6 w-28 text-[9px] font-mono"
                    style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--muted-foreground)" }}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent style={{ background: "var(--background)", border: "1px solid rgba(56,189,248,0.15)" }}>
                    {["all","running","completed","failed","pending"].map(s => (
                      <SelectItem key={s} value={s} className="text-[10px] font-mono uppercase py-0.5" style={{ color: "#64748b" }}>
                        {s.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <button
                  className="h-6 w-6 flex items-center justify-center rounded transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                  onClick={() => jobLogQ.refetch()}
                >
                  <RefreshCw size={9} className={jobLogQ.isFetching ? "animate-spin" : ""} />
                </button>
                <button
                  className="h-6 px-1.5 flex items-center gap-1 rounded text-[8px] font-mono transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                  onClick={exportCSV}
                >
                  <Download size={8} /> CSV
                </button>
                <button
                  className="h-6 px-1.5 flex items-center gap-1 rounded text-[8px] font-mono transition-colors"
                  style={{ color: "var(--muted-foreground)" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                  onClick={exportJSON}
                >
                  <Download size={8} /> JSON
                </button>
                <button
                  className="h-6 px-1.5 flex items-center gap-1 rounded text-[8px] font-mono transition-colors"
                  style={{ color: "#4c1d1d" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4c1d1d"; }}
                  onClick={() => clearMut.mutate({ olderThanDays: 7 })}
                  disabled={clearMut.isPending}
                >
                  <Trash2 size={8} /> 7D+
                </button>
              </div>
            )}
          </SectionHeader>

          {!jobLogCollapsed && (
            <>
              <div className="flex-1 min-h-0 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>
                {jobLogQ.isLoading ? (
                  <div className="flex items-center justify-center h-32 gap-2" style={{ color: "var(--muted-foreground)" }}>
                    <Loader2 size={12} className="animate-spin" />
                    <span className="text-[9px] font-mono tracking-widest">LOADING OPERATIONS…</span>
                  </div>
                ) : jobs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 gap-2">
                    <Globe size={16} style={{ color: "rgba(56,189,248,0.1)" }} />
                    <span className="text-[9px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>NO OPERATIONS FOUND</span>
                  </div>
                ) : (
                  <table className="w-full text-[10px]">
                    <thead className="sticky top-0 z-10" style={{ background: "rgba(2,8,16,0.98)", borderBottom: "1px solid rgba(56,189,248,0.1)" }}>
                      <tr>
                        {["OP#", "SOURCE", "STATUS", "INTEL", "DURATION", "TIME"].map((h, i) => (
                          <th
                            key={h}
                            className={`px-2 py-2 text-[8px] font-mono font-black tracking-widest ${i >= 3 ? "text-right" : "text-left"}`}
                            style={{ color: "rgba(56,189,248,0.4)" }}
                          >
                            {h}
                          </th>
                        ))}
                        <th className="px-2 py-2 text-[8px] font-mono font-black tracking-widest text-center" style={{ color: "rgba(56,189,248,0.4)" }}>CMD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map(job => (
                        <JobTableRow
                          key={job.id}
                          job={job}
                          isActive={activeIds.includes(job.id)}
                          onCancel={id => cancelMut.mutate({ jobId: id })}
                          cancelPending={cancelMut.isPending}
                          onReplay={agencyId => replayMut.mutate({ id: agencyId })}
                          replayPending={replayMut.isPending}
                        />
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {totalPages > 1 && (
                <div
                  className="flex items-center justify-between px-3 py-2 shrink-0"
                  style={{ borderTop: "1px solid rgba(56,189,248,0.08)", background: "oklch(from var(--foreground) l c h / 0.06)" }}
                >
                  <span className="text-[8px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>
                    PAGE {page + 1} / {totalPages}
                  </span>
                  <div className="flex gap-1">
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded transition-colors"
                      style={{ color: "var(--muted-foreground)", border: "1px solid rgba(56,189,248,0.1)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                      disabled={page === 0}
                    >
                      <ChevronLeft size={10} />
                    </button>
                    <button
                      className="h-6 w-6 flex items-center justify-center rounded transition-colors"
                      style={{ color: "var(--muted-foreground)", border: "1px solid rgba(56,189,248,0.1)" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                      disabled={page >= totalPages - 1}
                    >
                      <ChevronRight size={10} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── HORIZONTAL DIVIDER between Op Log and Intel Stream ───────── */}
          <HorizontalDragDivider onMouseDown={intelStreamResize.onMouseDown} />

          {/* ── INTEL STREAM (bottom of right column) ─────────────────── */}
          <div
            className="flex flex-col overflow-hidden shrink-0"
            style={{ height: intelStreamCollapsed ? "auto" : intelStreamResize.height }}
          >
            <SectionHeader
              icon={Eye}
              label="Intel Stream"
              count={sseEvents.length}
              collapsed={intelStreamCollapsed}
              onToggle={() => setIntelStreamCollapsed(c => !c)}
              accent="#34d399"
            >
              {!intelStreamCollapsed && (
                <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                  <Select value={feedFilter} onValueChange={setFeedFilter}>
                    <SelectTrigger
                      className="h-6 w-24 text-[9px] font-mono"
                      style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--muted-foreground)" }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "var(--background)", border: "1px solid rgba(56,189,248,0.15)" }}>
                      {(["all","db_insert","db_dup","fetch_fail","parse_item"] as const).map((v, idx) => (
                        <SelectItem key={v} value={v} className="text-[10px] font-mono uppercase py-0.5" style={{ color: "#64748b" }}>
                          {["ALL","STORED","DUPS","ERRORS","PARSED"][idx]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={jobFilter} onValueChange={setJobFilter}>
                    <SelectTrigger
                      className="h-6 w-24 text-[9px] font-mono"
                      style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--muted-foreground)" }}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent style={{ background: "var(--background)", border: "1px solid rgba(56,189,248,0.15)" }}>
                      <SelectItem value="all" className="text-[10px] font-mono uppercase py-0.5" style={{ color: "#64748b" }}>ALL OPS</SelectItem>
                      {sseJobIds.map(id => (
                        <SelectItem key={id} value={String(id)} className="text-[10px] font-mono py-0.5" style={{ color: "#64748b" }}>OP #{id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </SectionHeader>

            {!intelStreamCollapsed && (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                <div
                  ref={feedRef}
                  onScroll={() => {
                    if (!feedRef.current) return;
                    const { scrollTop, scrollHeight, clientHeight } = feedRef.current;
                    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
                  }}
                  className="flex-1 min-h-0 overflow-y-auto py-1"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}
                >
                  {displayEvents.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-4 text-center py-8">
                      <Radio size={20} style={{ color: "rgba(56,189,248,0.1)" }} />
                      <span className="text-[10px] font-mono tracking-widest" style={{ color: "var(--muted-foreground)" }}>AWAITING SIGNAL ACQUISITION</span>
                    </div>
                  ) : (
                    displayEvents.map(evt => <FeedItem key={evt.id} evt={evt} />)
                  )}
                </div>

                {!autoScroll && (
                  <button
                    className="w-full text-center py-1.5 text-[9px] font-mono font-bold tracking-widest transition-all"
                    style={{ background: "rgba(56,189,248,0.06)", borderTop: "1px solid rgba(56,189,248,0.15)", color: "#38bdf8" }}
                    onClick={() => { setAutoScroll(true); if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight; }}
                  >
                    ↓ NEW INTEL — CLICK TO FOLLOW
                  </button>
                )}

                <div
                  className="flex items-center justify-between px-3 py-1.5 shrink-0"
                  style={{ borderTop: "1px solid rgba(56,189,248,0.06)", background: "oklch(from var(--foreground) l c h / 0.05)" }}
                >
                  <button
                    className="text-[8px] font-mono font-bold tracking-widest flex items-center gap-1 transition-colors"
                    style={{ color: autoScroll ? "#34d399" : "var(--muted-foreground)" }}
                    onClick={() => setAutoScroll(f => !f)}
                  >
                    <Activity size={8} />
                    {autoScroll ? "LIVE FOLLOW" : "PAUSED"}
                  </button>
                  <button
                    className="text-[8px] font-mono tracking-widest transition-colors"
                    style={{ color: "var(--foreground)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                    onClick={clearEvents}
                  >
                    CLEAR
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Job table row ────────────────────────────────────────────────────────────
function JobTableRow({ job, isActive, onCancel, cancelPending, onReplay, replayPending }: {
  job: CrawlJobRow;
  isActive: boolean;
  onCancel: (id: number) => void;
  cancelPending: boolean;
  onReplay?: (agencyId: number) => void;
  replayPending?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const isRunning = job.status === "running";
  const s = getStatusStyle(job.status);

  return (
    <>
      <tr
        className="cursor-pointer transition-all duration-100"
        style={{
          borderBottom: "1px solid rgba(56,189,248,0.05)",
          background: isRunning ? "rgba(56,189,248,0.03)" : "transparent",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLTableRowElement).style.background = isRunning ? "rgba(56,189,248,0.06)" : "oklch(from var(--foreground) l c h / 0.02)"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLTableRowElement).style.background = isRunning ? "rgba(56,189,248,0.03)" : "transparent"; }}
        onClick={() => setExpanded(e => !e)}
      >
        <td className="px-2 py-2 font-mono text-[9px]" style={{ color: "var(--muted-foreground)" }}>{job.id}</td>
        <td className="px-2 py-2">
          <div
            className="font-mono text-[10px] font-bold truncate max-w-[110px]"
            style={{ color: isRunning ? "#93c5fd" : "var(--muted-foreground)" }}
            title={job.agencyName ?? undefined}
          >
            {job.agencyName ?? `SRC #${job.agencyId}`}
          </div>
          <div className="text-[8px] font-mono mt-0.5 truncate" style={{ color: "var(--foreground)" }}>
            {[job.region, job.agencyType].filter(Boolean).join(" · ")}
          </div>
        </td>
        <td className="px-2 py-2">
          <StatusBadge status={job.status} />
          {job.errorMessage && (
            <div className="text-[8px] font-mono mt-0.5 truncate max-w-[100px]" style={{ color: "#7f1d1d" }} title={job.errorMessage}>
              {job.errorMessage}
            </div>
          )}
        </td>
        <td className="px-2 py-2 text-right font-mono">
          {isRunning
            ? <span className="text-[9px] animate-pulse" style={{ color: "#38bdf8" }}>…</span>
            : <span className="text-[9px]" style={{ color: (job.articlesNew ?? 0) > 0 ? "#34d399" : "var(--muted-foreground)" }}>
                +{job.articlesNew ?? 0}
              </span>
          }
        </td>
        <td className="px-2 py-2 text-right font-mono text-[9px]" style={{ color: "var(--muted-foreground)" }}>
          {isRunning ? <LiveDuration startedAt={job.startedAt} /> : fmtDuration(job.startedAt, job.completedAt)}
        </td>
        <td className="px-2 py-2 text-right font-mono text-[8px]" style={{ color: "var(--foreground)" }}>
          {fmtRelative(job.createdAt)}
        </td>
        <td className="px-2 py-2 text-center">
          {isRunning ? (
            <button
              className="p-1 rounded transition-all"
              style={{ color: "#4c1d1d", border: "1px solid rgba(248,113,113,0.15)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.4)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4c1d1d"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.15)"; }}
              onClick={e => { e.stopPropagation(); onCancel(job.id); }}
              disabled={cancelPending}
              title="Abort operation"
            >
              <StopCircle size={10} />
            </button>
          ) : (job.status === 'completed' || job.status === 'failed' || job.status === 'interrupted') && onReplay ? (
            <button
              className="p-1 rounded transition-all"
              style={{ color: "var(--muted-foreground)", border: "1px solid rgba(56,189,248,0.12)" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.4)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(56,189,248,0.12)"; }}
              onClick={e => { e.stopPropagation(); if (job.agencyId) onReplay(job.agencyId); }}
              disabled={replayPending}
              title="Replay operation against same source"
            >
              <RefreshCw size={10} />
            </button>
          ) : null}
        </td>
      </tr>
      {expanded && (
        <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.05)" }}>
          <td colSpan={7} className="px-3 py-2" style={{ background: "rgba(56,189,248,0.02)" }}>
            <div className="grid grid-cols-3 gap-x-4 gap-y-1 text-[8px] font-mono">
              {[
                ["OP ID", `#${job.id}`], ["SOURCE ID", `#${job.agencyId}`],
                ["STATUS", job.status ?? "—"], ["REGION", job.region ?? "—"],
                ["COUNTRY", job.agencyCountry ?? "—"], ["TYPE", job.agencyType ?? "—"],
                ["INITIATED", job.startedAt ? new Date(job.startedAt).toLocaleTimeString() : "—"],
                ["COMPLETED", job.completedAt ? new Date(job.completedAt).toLocaleTimeString() : "—"],
                ["SIGNALS", String(job.articlesFound ?? 0)], ["NEW INTEL", String(job.articlesNew ?? 0)],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-1.5">
                  <span style={{ color: "rgba(56,189,248,0.3)" }}>{k}:</span>
                  <span style={{ color: "var(--muted-foreground)" }}>{v}</span>
                </div>
              ))}
              {job.errorMessage && (
                <div className="col-span-3 mt-1 p-1.5 rounded text-[8px] font-mono" style={{ background: "rgba(248,113,113,0.06)", color: "#f87171", border: "1px solid rgba(248,113,113,0.15)" }}>
                  ⚠ {job.errorMessage}
                </div>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export default FetchingMonitor;

// ─── Webhooks Settings Panel ──────────────────────────────────────────────────
const STAGE_OPTIONS = [
  { value: "any",    label: "ANY STAGE" },
  { value: "source", label: "SIGNAL ACQUISITION" },
  { value: "fetch",  label: "NETWORK INTERCEPT" },
  { value: "parse",  label: "SIGNAL PARSING" },
  { value: "db",     label: "INTEL PERSISTENCE" },
  { value: "enrich", label: "AI ENRICHMENT" },
];

function WebhooksPanel({ onClose }: { onClose: () => void }) {
  const utils = trpc.useUtils();
  const listQ = trpc.webhooks.list.useQuery();
  const createMut = trpc.webhooks.create.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); setShowForm(false); resetForm(); toast.success("Webhook created"); },
    onError: e => toast.error(`Create failed: ${e.message}`),
  });
  const updateMut = trpc.webhooks.update.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); setEditId(null); toast.success("Webhook updated"); },
    onError: e => toast.error(`Update failed: ${e.message}`),
  });
  const deleteMut = trpc.webhooks.delete.useMutation({
    onSuccess: () => { utils.webhooks.list.invalidate(); toast.success("Webhook deleted"); },
    onError: e => toast.error(`Delete failed: ${e.message}`),
  });
  const testMut = trpc.webhooks.test.useMutation({
    onSuccess: r => r.ok ? toast.success(`Test fired — HTTP ${r.status}`) : toast.error(`Test failed: ${r.error ?? `HTTP ${r.status}`}`),
    onError: e => toast.error(`Test error: ${e.message}`),
  });

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", stage: "any", url: "", secret: "", threshold: 1, windowSeconds: 60, payloadTemplate: "", isEnabled: true });

  function resetForm() { setForm({ name: "", stage: "any", url: "", secret: "", threshold: 1, windowSeconds: 60, payloadTemplate: "", isEnabled: true }); }

  function startEdit(wh: typeof listQ.data extends (infer T)[] | undefined ? T : never) {
    if (!wh) return;
    setForm({ name: wh.name, stage: wh.stage, url: wh.url, secret: wh.secret ?? "", threshold: wh.threshold, windowSeconds: wh.windowSeconds, payloadTemplate: wh.payloadTemplate ?? "", isEnabled: wh.isEnabled });
    setEditId(wh.id);
    setShowForm(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.url.trim()) { toast.error("Name and URL are required"); return; }
    const payload = {
      name: form.name.trim(),
      stage: form.stage,
      url: form.url.trim(),
      secret: form.secret.trim() || undefined,
      threshold: form.threshold,
      windowSeconds: form.windowSeconds,
      payloadTemplate: form.payloadTemplate.trim() || undefined,
      isEnabled: form.isEnabled,
    };
    if (editId !== null) {
      updateMut.mutate({ id: editId, ...payload });
    } else {
      createMut.mutate(payload);
    }
  }

  const hooks = listQ.data ?? [];

  return (
    <div
      className="shrink-0 overflow-y-auto"
      style={{
        maxHeight: 420,
        background: "rgba(2,8,16,0.97)",
        borderBottom: "1px solid rgba(251,191,36,0.2)",
        boxShadow: "0 8px 32px rgba(251,191,36,0.08)",
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5" style={{ borderBottom: "1px solid rgba(251,191,36,0.1)", background: "rgba(251,191,36,0.04)" }}>
        <Zap size={11} style={{ color: "#fbbf24" }} />
        <span className="text-[10px] font-mono font-black tracking-widest" style={{ color: "#fbbf24" }}>PIPELINE STAGE WEBHOOKS</span>
        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded ml-1" style={{ background: "rgba(251,191,36,0.1)", color: "#92400e", border: "1px solid rgba(251,191,36,0.2)" }}>
          {hooks.length} CONFIGURED
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => { setShowForm(v => !v); setEditId(null); resetForm(); }}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-[9px] font-mono font-bold tracking-widest transition-all"
            style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.25)", color: "#fbbf24" }}
          >
            + NEW WEBHOOK
          </button>
          <button onClick={onClose} className="p-1 rounded transition-all" style={{ color: "var(--muted-foreground)", border: "1px solid rgba(56,189,248,0.1)" }}>
            <ChevronUp size={12} />
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <div className="px-4 py-3" style={{ borderBottom: "1px solid rgba(251,191,36,0.08)", background: "rgba(251,191,36,0.02)" }}>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>WEBHOOK NAME *</label>
              <input
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                placeholder="e.g. Slack Alerts"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>TRIGGER STAGE</label>
              <select
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                value={form.stage}
                onChange={e => setForm(f => ({ ...f, stage: e.target.value }))}
              >
                {STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>ENDPOINT URL *</label>
              <input
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                placeholder="https://hooks.slack.com/services/..."
                value={form.url}
                onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>BEARER SECRET (optional)</label>
              <input
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                placeholder="sk-..."
                type="password"
                value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>THRESHOLD</label>
                <input
                  className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                  style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                  type="number" min={1} max={9999}
                  value={form.threshold}
                  onChange={e => setForm(f => ({ ...f, threshold: Math.max(1, parseInt(e.target.value) || 1) }))}
                />
              </div>
              <div className="flex-1">
                <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>WINDOW (sec)</label>
                <input
                  className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none"
                  style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)" }}
                  type="number" min={5} max={3600}
                  value={form.windowSeconds}
                  onChange={e => setForm(f => ({ ...f, windowSeconds: Math.max(5, parseInt(e.target.value) || 60) }))}
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-[8px] font-mono tracking-widest mb-1" style={{ color: "rgba(251,191,36,0.5)" }}>
                PAYLOAD TEMPLATE (optional — use {"{{stage}}"}, {"{{count}}"}, {"{{ts}}"})
              </label>
              <textarea
                className="w-full px-2 py-1.5 rounded text-[9px] font-mono outline-none resize-none"
                style={{ background: "oklch(from var(--foreground) l c h / 0.10)", border: "1px solid rgba(251,191,36,0.2)", color: "var(--foreground)", height: 48 }}
                placeholder={'{"text":"Stage {{stage}} fired {{count}} events at {{ts}}"}'}
                value={form.payloadTemplate}
                onChange={e => setForm(f => ({ ...f, payloadTemplate: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={form.isEnabled} onChange={e => setForm(f => ({ ...f, isEnabled: e.target.checked }))} />
              <span className="text-[8px] font-mono tracking-widest" style={{ color: "#64748b" }}>ENABLED</span>
            </label>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => { setShowForm(false); setEditId(null); resetForm(); }}
                className="px-3 py-1 rounded text-[9px] font-mono font-bold tracking-widest"
                style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)", color: "var(--muted-foreground)" }}
              >CANCEL</button>
              <button
                onClick={handleSubmit}
                disabled={createMut.isPending || updateMut.isPending}
                className="px-3 py-1 rounded text-[9px] font-mono font-bold tracking-widest transition-all"
                style={{ background: "rgba(251,191,36,0.12)", border: "1px solid rgba(251,191,36,0.35)", color: "#fbbf24" }}
              >
                {(createMut.isPending || updateMut.isPending) ? "SAVING..." : editId !== null ? "UPDATE" : "CREATE"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Webhook list */}
      <div className="px-4 py-2">
        {listQ.isLoading ? (
          <div className="text-[9px] font-mono py-4 text-center" style={{ color: "var(--muted-foreground)" }}>LOADING WEBHOOKS...</div>
        ) : hooks.length === 0 ? (
          <div className="text-[9px] font-mono py-4 text-center" style={{ color: "var(--muted-foreground)" }}>
            NO WEBHOOKS CONFIGURED — Click + NEW WEBHOOK to add one
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {hooks.map(wh => (
              <div
                key={wh.id}
                className="flex items-center gap-3 px-3 py-2 rounded"
                style={{
                  background: wh.isEnabled ? "rgba(251,191,36,0.04)" : "rgba(100,116,139,0.04)",
                  border: `1px solid ${wh.isEnabled ? "rgba(251,191,36,0.12)" : "rgba(100,116,139,0.1)"}`,
                }}
              >
                {/* Enable toggle */}
                <button
                  onClick={() => updateMut.mutate({ id: wh.id, isEnabled: !wh.isEnabled })}
                  className="shrink-0 w-3 h-3 rounded-full transition-all"
                  style={{
                    background: wh.isEnabled ? "#fbbf24" : "rgba(100,116,139,0.2)",
                    boxShadow: wh.isEnabled ? "0 0 6px rgba(251,191,36,0.6)" : "none",
                    border: "1px solid rgba(251,191,36,0.3)",
                  }}
                  title={wh.isEnabled ? "Disable" : "Enable"}
                />

                {/* Stage badge */}
                <span className="shrink-0 text-[7px] font-mono font-black px-1.5 py-0.5 rounded tracking-widest"
                  style={{ background: "rgba(251,191,36,0.1)", color: "#92400e", border: "1px solid rgba(251,191,36,0.2)" }}>
                  {STAGE_OPTIONS.find(s => s.value === wh.stage)?.label ?? wh.stage.toUpperCase()}
                </span>

                {/* Name + URL */}
                <div className="flex-1 min-w-0">
                  <div className="text-[9px] font-mono font-bold truncate" style={{ color: wh.isEnabled ? "var(--foreground)" : "var(--muted-foreground)" }}>{wh.name}</div>
                  <div className="text-[8px] font-mono truncate" style={{ color: "var(--muted-foreground)" }}>{wh.url}</div>
                </div>

                {/* Threshold */}
                <span className="shrink-0 text-[8px] font-mono" style={{ color: "var(--muted-foreground)" }}>
                  ≥{wh.threshold}/{wh.windowSeconds}s
                </span>

                {/* Fired count */}
                <span className="shrink-0 text-[8px] font-mono" style={{ color: wh.totalFired > 0 ? "#34d399" : "var(--muted-foreground)" }}>
                  {wh.totalFired} fired
                </span>

                {/* Last error */}
                {wh.lastError && (
                  <span className="shrink-0 text-[7px] font-mono px-1 py-0.5 rounded" style={{ background: "rgba(248,113,113,0.08)", color: "#f87171", border: "1px solid rgba(248,113,113,0.2)", maxWidth: 100, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {wh.lastError}
                  </span>
                )}

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                  <button
                    onClick={() => testMut.mutate({ id: wh.id })}
                    disabled={testMut.isPending}
                    className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold tracking-widest transition-all"
                    style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.15)", color: "var(--muted-foreground)" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = ""; }}
                    title="Send test payload"
                  >TEST</button>
                  <button
                    onClick={() => startEdit(wh)}
                    className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold tracking-widest transition-all"
                    style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)", color: "#92400e" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#fbbf24"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#92400e"; }}
                  >EDIT</button>
                  <button
                    onClick={() => { if (confirm(`Delete webhook "${wh.name}"?`)) deleteMut.mutate({ id: wh.id }); }}
                    className="px-1.5 py-0.5 rounded text-[7px] font-mono font-bold tracking-widest transition-all"
                    style={{ background: "rgba(248,113,113,0.06)", border: "1px solid rgba(248,113,113,0.15)", color: "#4c1d1d" }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#4c1d1d"; }}
                  >DEL</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
