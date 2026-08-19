import { useState, useEffect, useRef, useMemo } from "react";
import { createPortal } from "react-dom";
import { trpc } from "@/lib/trpc";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  Search, X, ExternalLink, Clock, TrendingUp, AlertTriangle,
  Globe, RefreshCw, Network, MapPin, Users, Activity,
  Filter, CheckCircle2, Radio, Zap, Shield, Eye,
  ChevronRight, Terminal, Crosshair, Signal, Lock,
  FileText, BarChart2, Wifi, Layers, Database,
  ChevronDown, ChevronUp
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────

const TOPICS = [
  { id: "WAR/CONFLICT",  label: "War & Conflict",  color: "#b45454", sigint: "WAROPS" },
  { id: "ECONOMY",       label: "Economy",          color: "#a07a3a", sigint: "ECONINT" },
  { id: "POLITICS",      label: "Politics",         color: "#7060a8", sigint: "POLINT" },
  { id: "TECHNOLOGY",    label: "Technology",       color: "#2e8fa8", sigint: "TECHINT" },
  { id: "ENERGY",        label: "Energy",           color: "#a06030", sigint: "ENERGINT" },
  { id: "DIPLOMACY",     label: "Diplomacy",        color: "#2e8060", sigint: "DIPINT" },
  { id: "SECURITY",      label: "Security",         color: "#904070", sigint: "SECINT" },
  { id: "HUMANITARIAN",  label: "Humanitarian",     color: "#5a7830", sigint: "HUMINT" },
];

// Threat tiers mapped from article importance + sentiment + isBreaking
const THREAT_TIERS = [
  { id: "all",      label: "ALL TRAFFIC",  color: "#6b7280", bg: "bg-gray-500/10",  border: "border-gray-500/20" },
  { id: "flash",    label: "FLASH",        color: "#c04040", bg: "bg-red-900/20",   border: "border-red-800/30" },
  { id: "critic",   label: "CRITIC",       color: "#b06030", bg: "bg-orange-900/20",border: "border-orange-800/30" },
  { id: "priority", label: "PRIORITY",     color: "#907030", bg: "bg-yellow-900/20",border: "border-yellow-800/30" },
  { id: "routine",  label: "ROUTINE",      color: "#2e7055", bg: "bg-green-900/20", border: "border-green-800/30" },
];

const SOURCE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  state:         { label: "STATE",    color: "#8a5050" },
  international: { label: "INTL",     color: "#3a7a8a" },
  independent:   { label: "INDEP",    color: "#3a7060" },
  wire:          { label: "WIRE",     color: "#8a7040" },
  digital:       { label: "DIGITAL",  color: "#605090" },
  broadcast:     { label: "BCAST",    color: "#7a4060" },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getThreatTier(article: any): string {
  if (article.isBreaking) return "flash";
  const imp = article.importance ?? 5;
  const sent = article.sentiment;
  if (imp >= 9 || (imp >= 7 && sent === "negative")) return "critic";
  if (imp >= 6 || sent === "negative") return "priority";
  return "routine";
}

function parseEntities(raw: any): string[] {
  if (!raw) return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed.slice(0, 6).map((e: any) => typeof e === "string" ? e : e.name ?? e.text ?? "").filter(Boolean);
    if (parsed.persons || parsed.organizations || parsed.locations) {
      return [
        ...(parsed.persons ?? []).slice(0, 2),
        ...(parsed.organizations ?? []).slice(0, 2),
        ...(parsed.locations ?? []).slice(0, 2),
      ].map((e: any) => typeof e === "string" ? e : e.name ?? "").filter(Boolean).slice(0, 6);
    }
  } catch { /* ignore */ }
  return [];
}

function parseTopics(raw: any): string[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") { try { return JSON.parse(raw); } catch { return []; } }
  return [];
}

function getTopicMeta(topics: string[]) {
  const t = topics?.[0];
  return TOPICS.find(x => x.id === t) ?? { color: "#22d3ee", sigint: "GEOINT", label: "General" };
}

function getArticleUrl(article: any): string {
  if (article.url && !article.url.includes("example.com") && !article.url.includes("/article-") && article.url.startsWith("http")) {
    return article.url;
  }
  return `https://news.google.com/search?q=${encodeURIComponent(article.title ?? "")}&hl=en-US&gl=US&ceid=US:en`;
}

function formatTime(date: string | Date) {
  const d = new Date(date);
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "JUST NOW";
  if (diff < 3600) return `${Math.floor(diff / 60)}M AGO`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}H AGO`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function formatTimestamp(date: string | Date) {
  const d = new Date(date);
  return d.toISOString().replace("T", " ").slice(0, 19) + "Z";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThreatBadge({ tier }: { tier: string }) {
  const t = THREAT_TIERS.find(x => x.id === tier) ?? THREAT_TIERS[0];
  return (
    <span className={`text-[8px] font-black tracking-widest px-1.5 py-0.5 border font-mono ${t.bg} ${t.border}`}
      style={{ color: t.color }}>
      {t.label}
    </span>
  );
}

function SigintBadge({ type }: { type: string }) {
  const meta = SOURCE_TYPE_LABELS[type] ?? { label: "OSINT", color: "#6b7280" };
  return (
    <span className="text-[8px] font-black tracking-widest px-1.5 py-0.5 border border-current/30 font-mono"
      style={{ color: meta.color, background: `${meta.color}12` }}>
      {meta.label}
    </span>
  );
}

function ImportanceBar({ value, color }: { value: number; color: string }) {
  const pct = Math.round(((value ?? 5) / 10) * 100);
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[8px] font-mono text-muted-foreground/60 tracking-wider">IMPACT</span>
      <div className="w-16 h-1 bg-border/30 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[8px] font-mono" style={{ color }}>{value ?? 5}/10</span>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = useState(() => new Date());
  const pageVisible = usePageVisible();
  useEffect(() => {
    if (!pageVisible) return;
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, [pageVisible]);
  return (
    <span className="font-mono text-[10px] text-green-400/70 tracking-wider">
      {time.toISOString().replace("T", " ").slice(0, 19)}Z
    </span>
  );
}

// ─── Article Detail Drawer ────────────────────────────────────────────────────

function ArticleDrawer({ article, agencyMap, onClose, onExplore, onVerify }: {
  article: any;
  agencyMap: Record<number, any>;
  onClose: () => void;
  onExplore?: (title: string) => void;
  onVerify?: (id: number) => void;
}) {
  const topics = parseTopics(article.topicsJson ?? article.topics);
  const topicMeta = getTopicMeta(topics);
  const entities = parseEntities(article.entitiesJson);
  const tier = getThreatTier(article);
  const tierMeta = THREAT_TIERS.find(x => x.id === tier)!;
  const agency = agencyMap[article.agencyId];
  const articleUrl = getArticleUrl(article);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-stretch justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-2xl bg-card border-l border-green-500/20 flex flex-col shadow-2xl"
        style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '100%', maxWidth: '42rem' }}
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-green-500/20 bg-green-500/5 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Lock size={12} className="text-green-400" />
            <span className="text-[10px] font-black tracking-widest text-green-400 font-mono">INTELLIGENCE BRIEF</span>
            <ThreatBadge tier={tier} />
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Classification stripe */}
          <div className="border border-current/20 px-3 py-2 text-center"
            style={{ color: tierMeta.color, background: `${tierMeta.color}08`, borderColor: `${tierMeta.color}30` }}>
            <span className="text-[9px] font-black tracking-[0.4em] font-mono">
              {tier === "flash" ? "⚠ FLASH TRAFFIC — IMMEDIATE DISSEMINATION REQUIRED" :
               tier === "critic" ? "◆ CRITIC — HIGHEST PRIORITY INTELLIGENCE" :
               tier === "priority" ? "▲ PRIORITY INTELLIGENCE REPORT" :
               "● ROUTINE INTELLIGENCE SUMMARY"}
            </span>
          </div>

          {/* Title */}
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-1">SUBJECT LINE</div>
            <h2 className="text-lg font-bold text-foreground leading-snug">{article.title}</h2>
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "SOURCE", value: agency?.name ?? `Agency #${article.agencyId}` },
              { label: "COUNTRY", value: article.country ?? "UNKNOWN" },
              { label: "TIMESTAMP", value: article.publishedAt ? formatTimestamp(article.publishedAt) : "UNKNOWN" },
              { label: "CLASSIFICATION", value: tier.toUpperCase() },
              { label: "SENTIMENT", value: (article.sentiment ?? "neutral").toUpperCase() },
              { label: "IMPACT SCORE", value: `${article.importance ?? 5}/10` },
            ].map(({ label, value }) => (
              <div key={label} className="border border-border/30 bg-card/20 px-3 py-2">
                <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider mb-0.5">{label}</div>
                <div className="text-xs font-mono text-foreground/90">{value}</div>
              </div>
            ))}
          </div>

          {/* Topics */}
          {topics.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2">TOPIC CLASSIFICATION</div>
              <div className="flex flex-wrap gap-1.5">
                {topics.map(t => {
                  const meta = TOPICS.find(x => x.id === t);
                  if (!meta) return null;
                  return (
                    <span key={t} className="text-[9px] font-mono px-2.5 py-1 rounded-full border"
                      style={{ color: meta.color, background: `${meta.color}12`, borderColor: `${meta.color}30` }}>
                      {meta.label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* Entities */}
          {entities.length > 0 && (
            <div>
              <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2">NAMED ENTITIES DETECTED</div>
              <div className="flex flex-wrap gap-1.5">
                {entities.map((e, i) => (
                  <span key={i} className="text-[9px] font-mono px-2 py-1 border border-primary/20 bg-cyan-500/5 text-cyan-400">
                    ◈ {e}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Summary */}
          {article.summary && (
            <div>
              <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2">EXECUTIVE SUMMARY</div>
              <div className="border-l-2 border-green-500/30 pl-3">
                <p className="text-sm text-foreground/80 leading-relaxed">{article.summary}</p>
              </div>
            </div>
          )}

          {/* Keywords */}
          {article.keywordsJson && (() => {
            try {
              const kw: string[] = typeof article.keywordsJson === "string" ? JSON.parse(article.keywordsJson) : article.keywordsJson;
              if (kw?.length) return (
                <div>
                  <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2">KEYWORDS</div>
                  <div className="flex flex-wrap gap-1">
                    {kw.slice(0, 12).map((k, i) => (
                      <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 bg-border/20 text-muted-foreground border border-border/30">{k}</span>
                    ))}
                  </div>
                </div>
              );
            } catch { return null; }
            return null;
          })()}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 py-3 border-t border-green-500/20 bg-green-500/5 flex-shrink-0">
          <a href={articleUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/30 text-green-400 text-[11px] font-mono hover:bg-green-500/10 transition-all">
            <ExternalLink size={11} /> READ SOURCE
          </a>
          {onExplore && (
            <button onClick={() => { onExplore(article.title ?? ""); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-amber-500/30 text-amber-400 text-[11px] font-mono hover:bg-amber-500/10 transition-all">
              <Network size={11} /> EXPLORE GRAPH
            </button>
          )}
          {onVerify && article.id && (
            <button onClick={() => { onVerify(article.id!); onClose(); }}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-cyan-500/30 text-cyan-400 text-[11px] font-mono hover:bg-cyan-500/10 transition-all">
              <CheckCircle2 size={11} /> VERIFY INTEL
            </button>
          )}
          <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 tracking-wider">
            REF: ART-{String(article.id).padStart(6, "0")}
          </span>
        </div>
      </div>
    </div>,
    document.body
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface FeedTabProps {
  region: string;
  onExplore?: (title: string) => void;
  onVerify?: (articleId: number) => void;
}

const FEED_TIME_WINDOWS = [
  { label: '6H',  hours: 6 },
  { label: '24H', hours: 24 },
  { label: '48H', hours: 48 },
  { label: '7D',  hours: 168 },
  { label: '14D', hours: 336 },
  { label: '1M',  hours: 720 },
];

export default function FeedTab({ region, onExplore, onVerify }: FeedTabProps) {
  const [search, setSearch] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState("all");
  const [tierFilter, setTierFilter] = useState("all");
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [selectedArticle, setSelectedArticle] = useState<any | null>(null);
  const [scanLine, setScanLine] = useState(0);
  const [flashCollapsed, setFlashCollapsed] = useState(false);
  const [timeWindowHours, setTimeWindowHours] = useState(24);
  const PAGE_SIZE = 25;
  const pageVisible = usePageVisible();
  const articlesSince = useMemo(() => new Date(Date.now() - timeWindowHours * 60 * 60 * 1000), [timeWindowHours]);

  // Scan-line animation for the feed header
  useEffect(() => {
    if (!pageVisible) return;
    const t = setInterval(() => setScanLine(n => (n + 1) % 100), 80);
    return () => clearInterval(t);
  }, [pageVisible]);

  const { data: articles, isLoading, refetch, isFetching } = trpc.articles.list.useQuery(
    { region, topics: selectedTopics.length > 0 ? selectedTopics : undefined, search: search || undefined, limit: 2000, since: articlesSince },
    { refetchInterval: 60000 }
  );
  const { data: breaking } = trpc.articles.breaking.useQuery({ region, limit: 8 }, { refetchInterval: 15000 });
  const { data: topicDist } = trpc.articles.topicDistribution.useQuery({ region });
  const { data: agenciesData } = trpc.agencies.list.useQuery({ region, limit: 200 });

  const agencyMap = useMemo(() => {
    const m: Record<number, any> = {};
    agenciesData?.forEach(a => { if (a.id != null) m[a.id] = a; });
    return m;
  }, [agenciesData]);

  const topicCounts: Record<string, number> = {};
  topicDist?.forEach(t => { topicCounts[t.topic] = t.count; });

  const toggleTopic = (id: string) => {
    setSelectedTopics(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);
    setPage(1);
  };

  const clearFilters = () => {
    setSelectedTopics([]); setSentiment("all"); setTierFilter("all");
    setSelectedCountry(null); setSearch(""); setPage(1); setTimeWindowHours(24);
  };

  const activeFilterCount = selectedTopics.length + (sentiment !== "all" ? 1 : 0) +
    (tierFilter !== "all" ? 1 : 0) + (selectedCountry ? 1 : 0) + (search ? 1 : 0) +
    (timeWindowHours !== 24 ? 1 : 0);

  const filtered = useMemo(() => {
    let list = articles ?? [];
    if (sentiment !== "all") list = list.filter(a => a.sentiment === sentiment);
    if (selectedCountry) list = list.filter(a => a.country === selectedCountry);
    if (tierFilter !== "all") list = list.filter(a => getThreatTier(a) === tierFilter);
    // Sort: flash first, then by importance desc, then by date
    list = [...list].sort((a, b) => {
      const tierOrder: Record<string, number> = { flash: 0, critic: 1, priority: 2, routine: 3 };
      const ta = tierOrder[getThreatTier(a)] ?? 3;
      const tb = tierOrder[getThreatTier(b)] ?? 3;
      if (ta !== tb) return ta - tb;
      return (b.importance ?? 5) - (a.importance ?? 5);
    });
    return list;
  }, [articles, sentiment, selectedCountry, tierFilter]);

  const paged = filtered.slice(0, page * PAGE_SIZE);
  const hasMore = filtered.length > paged.length;

  const countries = useMemo(() => {
    const cnt: Record<string, number> = {};
    articles?.forEach(a => { if (a.country) cnt[a.country] = (cnt[a.country] ?? 0) + 1; });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([c]) => c);
  }, [articles]);

  // Top entities from all articles
  const topEntities = useMemo(() => {
    const cnt: Record<string, number> = {};
    (articles ?? []).slice(0, 100).forEach(a => {
      parseEntities(a.entitiesJson).forEach(e => { cnt[e] = (cnt[e] ?? 0) + 1; });
    });
    return Object.entries(cnt).sort((a, b) => b[1] - a[1]).slice(0, 12);
  }, [articles]);

  // Tier counts
  const tierCounts = useMemo(() => {
    const c: Record<string, number> = { flash: 0, critic: 0, priority: 0, routine: 0 };
    (articles ?? []).forEach(a => { const t = getThreatTier(a); c[t] = (c[t] ?? 0) + 1; });
    return c;
  }, [articles]);

  return (
    <div className="flex h-full overflow-hidden bg-background relative">

      {/* Subtle scan-line overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden opacity-[0.015]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,100,0.5) 2px, rgba(0,255,100,0.5) 3px)", backgroundSize: "100% 3px" }} />

      {/* ─── Left Command Panel — hidden on mobile, visible on md+ ──────── */}
          <aside className="hidden md:flex w-56 flex-shrink-0 border-r border-border/60 flex-col overflow-hidden bg-card z-10">

        {/* Panel header */}
        <div className="px-3 py-2.5 border-b border-border/60 flex items-center justify-between bg-foreground/2">
          <div className="flex items-center gap-2">
            <Filter size={11} className="text-foreground/50" />
            <span className="text-[10px] font-black text-foreground/60 tracking-widest font-mono">INTEL FILTERS</span>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters}
              className="text-[9px] text-red-400/70 hover:text-red-400 flex items-center gap-1 font-mono transition-colors">
              <X size={8} /> CLR ({activeFilterCount})
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">

          {/* Time window filter */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Clock size={9} /> TIME WINDOW
            </div>
            <div className="grid grid-cols-3 gap-0.5">
              {FEED_TIME_WINDOWS.map(tw => (
                <button key={tw.hours} onClick={() => { setTimeWindowHours(tw.hours); setPage(1); }}
                  className={`px-1.5 py-1 text-[9px] font-mono font-bold border transition-all ${
                    timeWindowHours === tw.hours
                      ? 'border-cyan-500/40 bg-cyan-500/10 text-cyan-400'
                      : 'border-border/20 text-muted-foreground/50 hover:border-border/40 hover:text-muted-foreground'
                  }`}>
                  {tw.label}
                </button>
              ))}
            </div>
          </div>

          {/* Threat tier filter */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Shield size={9} /> THREAT TIER
            </div>
            <div className="space-y-0.5">
              {THREAT_TIERS.map(tier => (
                <button key={tier.id} onClick={() => { setTierFilter(tier.id); setPage(1); }}
                  className={`w-full flex items-center justify-between px-2 py-1.5 border text-[10px] font-mono font-bold transition-all ${
                    tierFilter === tier.id
                      ? `${tier.bg} ${tier.border}`
                      : "border-transparent hover:border-border/30 hover:bg-card/20"
                  }`}
                  style={{ color: tierFilter === tier.id ? tier.color : undefined }}>
                  <span className={tierFilter !== tier.id ? "text-muted-foreground" : ""}>{tier.label}</span>
                  <span className="font-mono text-[9px]" style={{ color: tier.color }}>
                    {tier.id === "all" ? (articles?.length ?? 0) : (tierCounts[tier.id] ?? 0)}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Activity size={9} /> SENTIMENT ANALYSIS
            </div>
            <div className="grid grid-cols-2 gap-1">
              {[
                { id: "all",      label: "ALL",      color: "#6b7280" },
                { id: "negative", label: "NEG",      color: "#ef4444" },
                { id: "neutral",  label: "NEU",      color: "#f59e0b" },
                { id: "positive", label: "POS",      color: "#10b981" },
              ].map(s => (
                <button key={s.id} onClick={() => { setSentiment(s.id); setPage(1); }}
                  className={`px-2 py-1.5 border text-[9px] font-mono font-bold transition-all ${
                    sentiment === s.id
                      ? "border-current"
                      : "border-border/20 text-muted-foreground/50 hover:border-border/40 hover:text-muted-foreground"
                  }`}
                  style={sentiment === s.id ? { color: s.color, background: `${s.color}12`, borderColor: `${s.color}40` } : {}}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Topics */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Layers size={9} /> TOPIC CLASSIFICATION
            </div>
            <div className="space-y-0.5">
              {TOPICS.map(topic => {
                const count = topicCounts[topic.id] ?? 0;
                const isActive = selectedTopics.includes(topic.id);
                return (
                  <button key={topic.id} onClick={() => toggleTopic(topic.id)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 border text-[9px] font-mono transition-all ${
                      isActive ? "border-current/30" : "border-transparent hover:border-border/20 hover:bg-card/20"
                    }`}
                    style={isActive ? { color: topic.color, background: `${topic.color}08` } : {}}>
                    <span className={`font-bold ${!isActive ? "text-muted-foreground/60" : ""}`}>{topic.label}</span>
                    {count > 0 && (
                      <span className="font-mono text-[8px]" style={{ color: isActive ? topic.color : "#6b7280" }}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Country */}
          {countries.length > 0 && (
            <div>
              <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
                <MapPin size={9} /> GEO FILTER
              </div>
              <select value={selectedCountry ?? ""}
                onChange={e => { setSelectedCountry(e.target.value || null); setPage(1); }}
                className="w-full bg-card border border-primary/15 px-2 py-1.5 text-[10px] font-mono text-foreground/80 outline-none focus:border-green-500/40 appearance-none">
                <option value="">ALL REGIONS</option>
                {countries.map(c => <option key={c} value={c}>{c.toUpperCase()}</option>)}
              </select>
            </div>
          )}

          {/* Source distribution mini-chart */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Database size={9} /> SOURCE MATRIX
            </div>
            <div className="space-y-1.5">
              {TOPICS.map(topic => {
                const count = topicCounts[topic.id] ?? 0;
                const total = Object.values(topicCounts).reduce((a, b) => a + b, 0) || 1;
                const pct = Math.round((count / total) * 100);
                if (count === 0) return null;
                return (
                  <div key={topic.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-mono text-muted-foreground/50">{topic.sigint}</span>
                      <span className="text-[8px] font-mono" style={{ color: topic.color }}>{pct}%</span>
                    </div>
                    <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: topic.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </aside>

      {/* ─── Main Intelligence Feed ──────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden z-10">

        {/* Feed header */}
        <div className="flex-shrink-0 border-b border-border/60 bg-card">
          {/* Top bar */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-border/40">
            <div className="flex items-center gap-2">
              <Terminal size={12} className="text-foreground/50" />
              <span className="text-[10px] font-black text-foreground/60 tracking-widest font-mono">INTELLIGENCE FEED</span>
            </div>
            <div className="flex items-center gap-1.5 ml-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500/60 animate-pulse" />
              <span className="text-[9px] font-mono text-foreground/40 tracking-wider">LIVE</span>
            </div>
            <div className="ml-auto flex items-center gap-4">
              <LiveClock />
              <span className="text-[9px] font-mono text-muted-foreground/40 tracking-wider">
                {filtered.length} INTERCEPTS
              </span>
              <button onClick={() => refetch()} disabled={isFetching}
                className="flex items-center gap-1.5 px-2.5 py-1 border border-border/60 text-[9px] font-mono text-foreground/40 hover:text-foreground/70 hover:border-border transition-all">
                <RefreshCw size={9} className={isFetching ? "animate-spin" : ""} />
                REFRESH
              </button>

            </div>
          </div>

          {/* Threat tier quick-filter ribbon */}
          <div className="flex items-center gap-0 px-4 py-1 overflow-x-auto border-t border-foreground/4">
            {THREAT_TIERS.map(tier => (
              <button key={tier.id} onClick={() => { setTierFilter(tier.id); setPage(1); }}
                className={`flex items-center gap-2 px-3 py-1 border-r border-green-500/10 text-[9px] font-mono font-black tracking-widest transition-all whitespace-nowrap ${
                  tierFilter === tier.id ? tier.bg : "hover:bg-card/30"
                }`}
                style={{ color: tierFilter === tier.id ? tier.color : "#4b5563" }}>
                {tier.label}
                <span className="text-[8px] opacity-70">
                  {tier.id === "all" ? (articles?.length ?? 0) : (tierCounts[tier.id] ?? 0)}
                </span>
              </button>
            ))}
            <div className="flex-1" />
            {/* Search */}
            <div className="flex items-center gap-2 bg-card border border-primary/15 px-2.5 py-1 ml-2">
              <Search size={10} className="text-green-400/40" />
              <input type="text" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="SEARCH INTERCEPTS..."
                className="bg-transparent text-[10px] font-mono text-foreground/80 placeholder:text-muted-foreground/30 outline-none w-28 md:w-44" />
              {search && <button onClick={() => setSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground"><X size={9} /></button>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* FLASH TRAFFIC — Breaking News */}
          {(breaking?.length ?? 0) > 0 && (
            <div className="mx-4 mt-4 mb-3 border border-red-900/30 bg-red-950/20 overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-4 py-2 border-b border-red-900/20 bg-red-950/30 hover:bg-red-950/40 transition-colors"
                onClick={() => setFlashCollapsed(c => !c)}>
                <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[9px] font-black tracking-[0.3em] text-red-400/80 font-mono">⚡ FLASH TRAFFIC — IMMEDIATE DISSEMINATION</span>
                <span className="ml-auto text-[9px] font-mono text-red-400/40 mr-2">{breaking?.length} INTERCEPTS</span>
                {flashCollapsed
                  ? <ChevronDown size={12} className="text-red-400/40 flex-shrink-0" />
                  : <ChevronUp size={12} className="text-red-400/40 flex-shrink-0" />}
              </button>
              {!flashCollapsed && <div className="divide-y divide-red-500/10">
                {breaking?.map(article => {
                  const topics = parseTopics(article.topicsJson);
                  const topicMeta = getTopicMeta(topics);
                  return (
                    <div key={article.id}
                      className="flex items-start gap-3 px-4 py-2.5 hover:bg-red-500/5 transition-colors group cursor-pointer"
                      onClick={() => setSelectedArticle(article)}>
                      <div className="flex-shrink-0 mt-0.5">
                        <div className="w-1 h-full min-h-[2rem] rounded-full" style={{ background: topicMeta.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[8px] font-mono text-red-400/40 tracking-wider">
                            {article.publishedAt ? formatTime(article.publishedAt) : "UNKNOWN"}
                          </span>
                          {article.country && (
                            <span className="text-[8px] font-mono text-muted-foreground/50 flex items-center gap-0.5">
                              <MapPin size={7} />{article.country.toUpperCase()}
                            </span>
                          )}
                          <ThreatBadge tier="flash" />
                        </div>
                        <div className="text-sm font-semibold text-foreground leading-snug line-clamp-1 group-hover:text-red-300 transition-colors font-mono">
                          {article.title}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        <a href={getArticleUrl(article)} target="_blank" rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="text-[9px] font-mono text-green-400 hover:underline flex items-center gap-1">
                          <ExternalLink size={9} /> SOURCE
                        </a>
                        {onExplore && (
                          <button onClick={e => { e.stopPropagation(); onExplore(article.title ?? ""); }}
                            className="text-[9px] font-mono text-amber-400 hover:text-amber-300 flex items-center gap-1">
                            <Network size={9} /> GRAPH
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>}
            </div>
          )}

          {/* Article grid */}
          <div className="px-4 pb-4 space-y-2 mt-2">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="border border-green-500/10 bg-card p-4 animate-pulse">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="h-3 w-12 bg-green-500/10 rounded" />
                      <div className="h-3 w-16 bg-border/20 rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-border/20 rounded mb-2" />
                    <div className="h-3 w-full bg-border/10 rounded mb-1" />
                    <div className="h-3 w-2/3 bg-border/10 rounded" />
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="border border-green-500/20 p-8 bg-green-500/5">
                  <Terminal size={32} className="text-green-400/30 mb-3 mx-auto" />
                  <div className="text-[11px] font-mono font-bold text-green-400/50 tracking-widest mb-1">NO INTERCEPTS FOUND</div>
                  <div className="text-[10px] font-mono text-muted-foreground/40 mb-4">ADJUST FILTER PARAMETERS OR CLEAR ACTIVE FILTERS</div>
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters}
                      className="px-4 py-1.5 border border-green-500/30 text-[10px] font-mono text-green-400 hover:bg-green-500/10 transition-all">
                      CLEAR ALL FILTERS
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <>
                {paged.map(article => {
                  const topics = parseTopics(article.topicsJson);
                  const topicMeta = getTopicMeta(topics);
                  const entities = parseEntities(article.entitiesJson);
                  const tier = getThreatTier(article);
                  const tierMeta = THREAT_TIERS.find(x => x.id === tier)!;
                  const agency = article.agencyId != null ? agencyMap[article.agencyId] : undefined;
                  const articleUrl = getArticleUrl(article);

                  return (
                    <article key={article.id}
                      className="group border border-border/40 bg-card hover:border-border/70 hover:bg-muted transition-all duration-200 overflow-hidden cursor-pointer"
                      onClick={() => setSelectedArticle(article)}>

                      {/* Top classification stripe */}
                      <div className="h-px w-full" style={{ background: `linear-gradient(90deg, ${tierMeta.color}60, transparent)` }} />

                      <div className="flex gap-0">
                        {/* Left accent bar */}
                        <div className="w-0.5 flex-shrink-0" style={{ background: topicMeta.color }} />

                        <div className="flex-1 min-w-0 p-3.5">
                          {/* Header row */}
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <ThreatBadge tier={tier} />
                            {agency && (
                              <SigintBadge type={agency.type ?? "independent"} />
                            )}
                            {topics.slice(0, 2).map(t => {
                              const meta = TOPICS.find(x => x.id === t);
                              if (!meta) return null;
                              return (
                                <span key={t} className="text-[8px] font-mono px-2 py-0.5 rounded-full border"
                                  style={{ color: meta.color, background: `${meta.color}18`, borderColor: `${meta.color}35` }}>
                                  {meta.label}
                                </span>
                              );
                            })}
                            {article.isTrending && (
                              <span className="text-[8px] font-mono font-bold text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-1.5 py-0.5 flex items-center gap-1">
                                <TrendingUp size={7} /> TRENDING
                              </span>
                            )}
                            <span className="ml-auto text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
                              <Clock size={8} />
                              {article.publishedAt ? formatTime(article.publishedAt) : "UNKNOWN"}
                            </span>
                          </div>

                          {/* Title */}
                          <h3 className="text-sm font-bold text-foreground/90 leading-snug mb-2 group-hover:text-green-300/90 transition-colors font-mono line-clamp-2">
                            {article.title}
                          </h3>

                          {/* Summary */}
                          {article.summary && (
                            <p className="text-[11px] text-muted-foreground/60 leading-relaxed line-clamp-2 mb-2.5">
                              {article.summary}
                            </p>
                          )}

                          {/* Entity tags */}
                          {entities.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2.5">
                              {entities.slice(0, 4).map((e, i) => (
                                <span key={i} className="text-[8px] font-mono px-1.5 py-0.5 border border-border/60 bg-foreground/3 text-foreground/40">
                                  ◈ {e}
                                </span>
                              ))}
                            </div>
                          )}

                          {/* Footer */}
                          <div className="flex items-center gap-3 flex-wrap">
                            {article.country && (
                              <span className="text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
                                <MapPin size={8} />{article.country.toUpperCase()}
                              </span>
                            )}
                            {agency && (
                              <span className="text-[9px] font-mono text-muted-foreground/40 flex items-center gap-1">
                                <Signal size={8} />{agency.name}
                              </span>
                            )}
                            <ImportanceBar value={article.importance ?? 5} color={topicMeta.color} />

                            {/* Sentiment indicator */}
                            <span className={`text-[9px] font-mono font-bold flex items-center gap-1 ${
                              article.sentiment === "negative" ? "text-red-400/50" :
                              article.sentiment === "positive" ? "text-green-400/50" : "text-muted-foreground/40"
                            }`}>
                              <Activity size={8} />
                              {(article.sentiment ?? "neutral").toUpperCase()}
                            </span>

                            {/* Actions */}
                            <div className="ml-auto flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[9px] font-mono text-green-400/70 hover:text-green-400 flex items-center gap-1 border border-green-500/20 px-2 py-0.5 hover:border-green-500/40 transition-all">
                                <ExternalLink size={8} /> SOURCE
                              </a>
                              {onExplore && (
                                <button onClick={e => { e.stopPropagation(); onExplore(article.title ?? ""); }}
                                  className="text-[9px] font-mono text-amber-400/70 hover:text-amber-400 flex items-center gap-1 border border-amber-500/20 px-2 py-0.5 hover:border-amber-500/40 transition-all">
                                  <Network size={8} /> GRAPH
                                </button>
                              )}
                              {onVerify && article.id && (
                                <button onClick={e => { e.stopPropagation(); onVerify(article.id!); }}
                                  className="text-[9px] font-mono text-cyan-400/70 hover:text-cyan-400 flex items-center gap-1 border border-primary/20 px-2 py-0.5 hover:border-cyan-500/40 transition-all">
                                  <CheckCircle2 size={8} /> VERIFY
                                </button>
                              )}
                              <button onClick={e => { e.stopPropagation(); setSelectedArticle(article); }}
                                className="text-[9px] font-mono text-purple-400/70 hover:text-purple-400 flex items-center gap-1 border border-purple-500/20 px-2 py-0.5 hover:border-purple-500/40 transition-all">
                                <Eye size={8} /> BRIEF
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Bottom classification stripe */}
                      <div className="h-px w-full opacity-30" style={{ background: `linear-gradient(90deg, transparent, ${tierMeta.color}40)` }} />
                    </article>
                  );
                })}

                {hasMore && (
                  <div className="flex justify-center pt-2 pb-4">
                    <button onClick={() => setPage(p => p + 1)}
                      className="px-6 py-2 border border-green-500/20 text-[10px] font-mono text-green-400/60 hover:text-green-400 hover:border-green-500/40 transition-all tracking-widest">
                      LOAD MORE INTERCEPTS ({filtered.length - paged.length} REMAINING)
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* ─── Right SIGINT Panel ──────────────────────────────────────── */}
      <aside className="w-56 flex-shrink-0 border-l border-border/60 bg-card overflow-y-auto hidden xl:flex flex-col z-10">

        {/* Panel header */}
        <div className="px-3 py-2.5 border-b border-border/60 flex items-center gap-2 bg-foreground/2 flex-shrink-0">
          <Radio size={11} className="text-foreground/50" />
          <span className="text-[10px] font-black text-foreground/60 tracking-widest font-mono">SIGINT PANEL</span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-4">

          {/* Entity Radar */}
          {topEntities.length > 0 && (
            <div>
              <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
                <Crosshair size={9} /> ENTITY RADAR
              </div>
              <div className="space-y-1">
                {topEntities.slice(0, 8).map(([entity, count], i) => {
                  const maxCount = topEntities[0]?.[1] ?? 1;
                  const pct = Math.round((count / maxCount) * 100);
                  return (
                    <div key={entity}>
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-mono text-foreground/50 truncate max-w-[120px]">{entity}</span>
                        <span className="text-[8px] font-mono text-muted-foreground/40">{count}</span>
                      </div>
                      <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-foreground/20 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top Countries */}
          {countries.length > 0 && (
            <div>
              <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
                <Globe size={9} /> GEO DISTRIBUTION
              </div>
              <div className="space-y-0.5">
                {countries.slice(0, 8).map(c => {
                  const count = (articles ?? []).filter(a => a.country === c).length;
                  return (
                    <button key={c} onClick={() => setSelectedCountry(selectedCountry === c ? null : c)}
                      className={`w-full flex items-center justify-between px-2 py-1 border text-[9px] font-mono transition-all ${
                        selectedCountry === c
                          ? "border-green-500/30 bg-green-500/10 text-green-400"
                          : "border-transparent text-muted-foreground/50 hover:text-muted-foreground hover:border-border/20"
                      }`}>
                      <span className="flex items-center gap-1"><MapPin size={7} />{c.toUpperCase()}</span>
                      <span className="font-bold">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Threat tier breakdown */}
          <div>
            <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
              <Shield size={9} /> THREAT MATRIX
            </div>
            <div className="space-y-1.5">
              {THREAT_TIERS.filter(t => t.id !== "all").map(tier => {
                const count = tierCounts[tier.id] ?? 0;
                const total = (articles?.length ?? 0) || 1;
                const pct = Math.round((count / total) * 100);
                return (
                  <div key={tier.id}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[8px] font-mono font-bold" style={{ color: tier.color }}>{tier.label}</span>
                      <span className="text-[8px] font-mono text-muted-foreground/40">{count} ({pct}%)</span>
                    </div>
                    <div className="h-0.5 bg-border/20 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: tier.color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Signal intercepts — recent breaking */}
          {(breaking?.length ?? 0) > 0 && (
            <div>
              <div className="text-[9px] font-mono font-bold text-muted-foreground/50 tracking-widest mb-2 flex items-center gap-1.5">
                <Wifi size={9} /> SIGNAL INTERCEPTS
              </div>
              <div className="space-y-1.5">
                {breaking?.slice(0, 5).map(article => (
                  <div key={article.id}
                    className="border border-red-900/15 bg-red-950/10 p-2 cursor-pointer hover:border-red-900/30 transition-all"
                    onClick={() => setSelectedArticle(article)}>
                    <div className="flex items-center gap-1 mb-1">
                      <div className="w-1 h-1 rounded-full bg-red-600/70 animate-pulse flex-shrink-0" />
                      <span className="text-[8px] font-mono text-red-400/40 tracking-wider">
                        {article.publishedAt ? formatTime(article.publishedAt) : ""}
                      </span>
                    </div>
                    <p className="text-[9px] font-mono text-foreground/70 line-clamp-2 leading-relaxed">{article.title}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* System status */}
          <div className="border border-green-500/10 bg-green-500/5 p-2.5">
            <div className="text-[8px] font-mono font-bold text-green-400/50 tracking-widest mb-2">SYSTEM STATUS</div>
            {[
              { label: "FEED STATUS", value: "ACTIVE", color: "#10b981" },
              { label: "TOTAL INTERCEPTS", value: String(articles?.length ?? 0), color: "#06b6d4" },
              { label: "FLASH TRAFFIC", value: String(tierCounts.flash ?? 0), color: "#ef4444" },
              { label: "SOURCES ONLINE", value: String(Object.keys(agencyMap).length), color: "#f59e0b" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center justify-between py-0.5">
                <span className="text-[8px] font-mono text-muted-foreground/40">{label}</span>
                <span className="text-[8px] font-mono font-bold" style={{ color }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* ─── Article Detail Drawer ───────────────────────────────────── */}
      {selectedArticle && (
        <ArticleDrawer
          article={selectedArticle}
          agencyMap={agencyMap}
          onClose={() => setSelectedArticle(null)}
          onExplore={onExplore}
          onVerify={onVerify}
        />
      )}
    </div>
  );
}
