import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import {
  Search, Globe, Radio, Cpu, Database, BarChart2, Layers,
  CheckCircle2, ChevronRight, ExternalLink, AlertCircle, Loader2,
  Shield, Zap, Activity, Tag, MapPin, Clock, User, Building2,
  FileText, Link2, Hash, TrendingUp, Server, RefreshCw, X,
  ArrowDown, Sparkles, Eye, AlertTriangle, Trash2, Flag, History,
  ListChecks, XCircle, Info, Lock, Microscope, ChevronDown
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NarrativesTab from "./NarrativesTab";
import FIMITab from "./FIMITab";
import { WaitingListModal } from "@/components/WaitingListModal";

interface VerifyTabProps { region: string; initialArticleId?: number | null; }

type VerifySubPage = "verify" | "narratives" | "fimi";

// ─── localStorage history types ──────────────────────────────────────────────
interface HistoryEntry {
  articleId: number;
  title: string;
  url: string;
  status: "verified" | "failed" | "flagged";
  failLayer?: string;
  failReason?: string;
  notes?: string;
  timestamp: string; // ISO
}

const HISTORY_KEY = "geoint_verify_history";

function loadHistory(): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveHistory(entries: HistoryEntry[]) {
  try {
    // Keep last 200 entries
    const trimmed = entries.slice(-200);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch { /* ignore quota */ }
}

function addHistoryEntry(entry: HistoryEntry) {
  const existing = loadHistory().filter(e => e.articleId !== entry.articleId);
  saveHistory([...existing, entry]);
}

// ─── Layer definitions ────────────────────────────────────────────────────────
const LAYERS = [
  {
    id: "L1",
    label: "SOURCE",
    sublabel: "Data Origin",
    color: "#06b6d4",
    icon: Globe,
    description: "The originating news agency — who published this article, where, and with what editorial stance.",
    fields: ["Agency name", "Country of origin", "Media type", "Bias rating", "Website", "RSS feed URL"],
    critical: false,
  },
  {
    id: "L2",
    label: "COLLECTION",
    sublabel: "Ingestion Layer",
    color: "#8b5cf6",
    icon: Radio,
    description: "How the article entered the platform — RSS parsing, crawl timestamp, deduplication check.",
    fields: ["Crawl method", "RSS feed URL", "Crawl timestamp", "Dedup status", "Raw URL stored"],
    critical: false,
  },
  {
    id: "L3",
    label: "PROCESSING",
    sublabel: "NLP Engine",
    color: "#f59e0b",
    icon: Cpu,
    description: "Automated analysis applied to the raw text — topic classification, sentiment scoring, country detection, breaking flag.",
    fields: ["Topics detected", "Sentiment", "Sentiment score", "Country detected", "Breaking flag", "Importance score"],
    critical: false,
  },
  {
    id: "L4",
    label: "ENRICHMENT",
    sublabel: "LLM Extraction",
    color: "#ec4899",
    icon: Sparkles,
    description: "LLM-powered entity extraction — people, organizations, locations, facilities, and events mentioned in the article.",
    fields: ["Persons", "Organizations", "Locations", "Facilities", "Events"],
    critical: false,
  },
  {
    id: "L5",
    label: "STORAGE",
    sublabel: "Intelligence Store",
    color: "#10b981",
    icon: Database,
    description: "How the article is persisted — database record ID, facility link records, storage key, creation timestamp.",
    fields: ["Article ID", "DB table", "Facility links", "Storage key", "Created at"],
    critical: false,
  },
  {
    id: "L6",
    label: "DELIVERY",
    sublabel: "Presentation Layer",
    color: "#ef4444",
    icon: Layers,
    description: "Where this article surfaces in the platform — which tabs display it, external link verification, and view/share metrics.",
    fields: ["LIVE map", "FEED reader", "EXPLORE graph", "COMPARE view", "External link", "View count"],
    critical: true, // URL check happens here
  },
];

// ─── Sentiment badge ──────────────────────────────────────────────────────────
function SentimentBadge({ sentiment, score }: { sentiment: string; score: number }) {
  const colors: Record<string, string> = {
    negative: "#ef4444", positive: "#22c55e", neutral: "#94a3b8", mixed: "#f59e0b",
  };
  const c = colors[sentiment] || "#94a3b8";
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border"
      style={{ color: c, borderColor: `${c}40`, background: `${c}15` }}>
      {sentiment.toUpperCase()} {score !== 0 && `(${score > 0 ? "+" : ""}${score.toFixed(2)})`}
    </span>
  );
}

// ─── Generic row ──────────────────────────────────────────────────────────────
function Row({ icon, label, value, highlight }: { icon: React.ReactNode; label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground/60 mt-0.5 flex-shrink-0">{icon}</span>
      <span className="text-[9px] text-muted-foreground/80 uppercase tracking-wider w-28 flex-shrink-0 mt-0.5">{label}</span>
      <span className={`text-[10px] flex-1 ${highlight ? "text-foreground font-semibold" : "text-foreground/70"}`}>{value}</span>
    </div>
  );
}

// ─── Layer detail panels ──────────────────────────────────────────────────────
function L1Panel({ article }: { article: any }) {
  const a = article.agency;
  const BIAS_COLORS: Record<string, string> = {
    left: "#3b82f6", "center-left": "#6366f1", center: "#22d3ee",
    "center-right": "#f59e0b", right: "#ef4444", state: "#a855f7",
  };
  const biasColor = BIAS_COLORS[a?.bias ?? "center"] ?? "#22d3ee";
  return (
    <div className="space-y-2">
      <Row icon={<Building2 size={11}/>} label="Agency" value={a?.name ?? "Unknown"} highlight />
      <Row icon={<MapPin size={11}/>} label="Country" value={a?.country ?? "—"} />
      <Row icon={<Radio size={11}/>} label="Media Type" value={a?.type ?? "online"} />
      <Row icon={<Activity size={11}/>} label="Bias Rating"
        value={<span style={{ color: biasColor }} className="font-bold">{(a?.bias ?? "center").toUpperCase()}</span>} />
      {a?.website && (
        <Row icon={<ExternalLink size={11}/>} label="Website"
          value={<a href={a.website} target="_blank" rel="noopener noreferrer"
            className="text-cyan-400 hover:underline truncate max-w-[200px] inline-block">{a.website}</a>} />
      )}
      <Row icon={<Link2 size={11}/>} label="Article URL"
        value={<a href={article.url} target="_blank" rel="noopener noreferrer"
          className="text-cyan-400 hover:underline truncate max-w-[200px] inline-block">{article.url}</a>} />
    </div>
  );
}

function L2Panel({ article }: { article: any }) {
  const crawledAt = article.crawledAt ? new Date(article.crawledAt) : null;
  const publishedAt = article.publishedAt ? new Date(article.publishedAt) : null;
  const lagMs = crawledAt && publishedAt ? crawledAt.getTime() - publishedAt.getTime() : null;
  const lagStr = lagMs !== null
    ? lagMs < 0 ? "Crawled before publish (clock skew)"
      : lagMs < 60000 ? `${Math.round(lagMs / 1000)}s after publish`
      : lagMs < 3600000 ? `${Math.round(lagMs / 60000)}m after publish`
      : `${Math.round(lagMs / 3600000)}h after publish`
    : "—";
  return (
    <div className="space-y-2">
      <Row icon={<Radio size={11}/>} label="Crawl Method" value="RSS Parser (rss-parser)" highlight />
      <Row icon={<Link2 size={11}/>} label="Source URL"
        value={<a href={article.url} target="_blank" rel="noopener noreferrer"
          className="text-cyan-400 hover:underline truncate max-w-[200px] inline-block">{article.url}</a>} />
      <Row icon={<Clock size={11}/>} label="Published At"
        value={publishedAt ? publishedAt.toLocaleString() : "—"} />
      <Row icon={<Clock size={11}/>} label="Crawled At"
        value={crawledAt ? crawledAt.toLocaleString() : "—"} />
      <Row icon={<Activity size={11}/>} label="Crawl Lag" value={lagStr} />
      <Row icon={<CheckCircle2 size={11}/>} label="Dedup Check"
        value={<span className="text-green-400 font-bold">PASSED — unique URL</span>} />
      <Row icon={<Globe size={11}/>} label="Language" value={(article.language ?? "en").toUpperCase()} />
    </div>
  );
}

function L3Panel({ article }: { article: any }) {
  const topics: string[] = (() => {
    try { return JSON.parse(article.topicsJson ?? "[]"); } catch { return []; }
  })();
  const keywords: string[] = (() => {
    try { return JSON.parse(article.keywordsJson ?? "[]"); } catch { return []; }
  })();
  const TOPIC_COLORS: Record<string, string> = {
    "WAR/CONFLICT": "#ef4444", ECONOMY: "#f59e0b", POLITICS: "#8b5cf6",
    TECHNOLOGY: "#06b6d4", ENERGY: "#f97316", DIPLOMACY: "#22d3ee",
    SECURITY: "#ec4899", HUMANITARIAN: "#22c55e", GENERAL: "#94a3b8",
  };
  return (
    <div className="space-y-2">
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Tag size={9}/> Topics Classified
        </div>
        <div className="flex flex-wrap gap-1">
          {topics.length > 0 ? topics.map(t => (
            <span key={t} className="px-2 py-0.5 rounded text-[10px] font-bold border"
              style={{ color: TOPIC_COLORS[t] ?? "#94a3b8", borderColor: `${TOPIC_COLORS[t] ?? "#94a3b8"}40`, background: `${TOPIC_COLORS[t] ?? "#94a3b8"}15` }}>
              {t}
            </span>
          )) : <span className="text-muted-foreground/60 text-[10px]">None detected</span>}
        </div>
      </div>
      <Row icon={<Activity size={11}/>} label="Sentiment"
        value={<SentimentBadge sentiment={article.sentiment ?? "neutral"} score={article.sentimentScore ?? 0} />} />
      <Row icon={<MapPin size={11}/>} label="Country Detected" value={article.country ?? "Not detected"} />
      <Row icon={<AlertCircle size={11}/>} label="Breaking Flag"
        value={article.isBreaking
          ? <span className="text-red-400 font-bold">⚡ BREAKING</span>
          : <span className="text-muted-foreground/80">No</span>} />
      <Row icon={<TrendingUp size={11}/>} label="Trending Flag"
        value={article.isTrending
          ? <span className="text-yellow-400 font-bold">🔥 TRENDING</span>
          : <span className="text-muted-foreground/80">No</span>} />
      <Row icon={<Zap size={11}/>} label="Importance Score"
        value={<span className="font-bold text-foreground">{article.importance ?? 5} / 10</span>} />
      {keywords.length > 0 && (
        <div>
          <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Hash size={9}/> Keywords
          </div>
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 10).map(k => (
              <span key={k} className="px-1.5 py-0.5 rounded text-[9px] bg-foreground/5 text-muted-foreground border border-border/70">{k}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function L4Panel({ article }: { article: any }) {
  const entities = article.entities ?? {};
  const people: string[] = entities.people ?? [];
  const orgs: string[] = entities.organizations ?? [];
  const locs: string[] = entities.locations ?? [];
  const events: string[] = entities.events ?? [];
  const facilities: any[] = article.relatedFacilities ?? [];
  const EntityList = ({ items, color }: { items: string[]; color: string }) => (
    items.length > 0
      ? <div className="flex flex-wrap gap-1">
          {items.map(i => (
            <span key={i} className="px-1.5 py-0.5 rounded text-[9px] border"
              style={{ color, borderColor: `${color}40`, background: `${color}10` }}>{i}</span>
          ))}
        </div>
      : <span className="text-muted-foreground/60 text-[10px]">None extracted</span>
  );
  return (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <User size={9}/> Persons ({people.length})
        </div>
        <EntityList items={people} color="#06b6d4" />
      </div>
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Building2 size={9}/> Organizations ({orgs.length})
        </div>
        <EntityList items={orgs} color="#8b5cf6" />
      </div>
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <MapPin size={9}/> Locations ({locs.length})
        </div>
        <EntityList items={locs} color="#f59e0b" />
      </div>
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
          <Activity size={9}/> Events ({events.length})
        </div>
        <EntityList items={events} color="#ec4899" />
      </div>
      {facilities.length > 0 && (
        <div>
          <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
            <Shield size={9}/> Linked Facilities ({facilities.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {facilities.map((f: any) => (
              <span key={f.id} className="px-1.5 py-0.5 rounded text-[9px] border text-green-400 border-green-400/30 bg-green-400/10">{f.name}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function L5Panel({ article }: { article: any }) {
  const createdAt = article.createdAt ? new Date(article.createdAt) : null;
  const facilityLinks = article.relatedFacilities ?? [];
  return (
    <div className="space-y-2">
      <Row icon={<Hash size={11}/>} label="Article ID" value={<span className="font-mono text-green-400 font-bold">#{article.id}</span>} highlight />
      <Row icon={<Database size={11}/>} label="DB Table" value={<span className="font-mono text-foreground/70">articles</span>} />
      <Row icon={<Server size={11}/>} label="Database" value="MySQL / TiDB (cloud)" />
      <Row icon={<Link2 size={11}/>} label="Facility Links"
        value={facilityLinks.length > 0
          ? <span className="text-green-400 font-bold">{facilityLinks.length} linked</span>
          : <span className="text-muted-foreground/80">None</span>} />
      <Row icon={<Clock size={11}/>} label="Record Created"
        value={createdAt ? createdAt.toLocaleString() : "—"} />
      {article.storageKey && (
        <Row icon={<Server size={11}/>} label="Storage Key"
          value={<span className="font-mono text-[9px] text-muted-foreground truncate max-w-[200px] inline-block">{article.storageKey}</span>} />
      )}
      <Row icon={<Eye size={11}/>} label="View Count" value={String(article.viewCount ?? 0)} />
      <Row icon={<RefreshCw size={11}/>} label="Share Count" value={String(article.shareCount ?? 0)} />
    </div>
  );
}

function L6Panel({ article, urlCheckResult }: { article: any; urlCheckResult?: { ok: boolean; status: number; statusText: string; contentPresent: boolean; redirected: boolean; finalUrl: string; failReason: string | null } | null }) {
  const topics: string[] = (() => {
    try { return JSON.parse(article.topicsJson ?? "[]"); } catch { return []; }
  })();
  const deliveryPoints = [
    { tab: "LIVE Map", icon: <MapPin size={10}/>, active: true, reason: "Article marker shown on map" },
    { tab: "FEED Reader", icon: <FileText size={10}/>, active: true, reason: "Appears in news feed" },
    { tab: "EXPLORE Graph", icon: <Activity size={10}/>, active: (article.entities?.people?.length > 0 || article.entities?.organizations?.length > 0), reason: "Entity nodes in network graph" },
    { tab: "COMPARE View", icon: <BarChart2 size={10}/>, active: true, reason: "Counted in agency/country stats" },
    { tab: "VERIFY Trail", icon: <CheckCircle2 size={10}/>, active: true, reason: "This provenance view" },
  ];

  return (
    <div className="space-y-3">
      <div>
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Layers size={9}/> Platform Surfaces
        </div>
        <div className="space-y-1.5">
          {deliveryPoints.map(d => (
            <div key={d.tab} className="flex items-center gap-2">
              <span className={d.active ? "text-green-400" : "text-muted-foreground/40"}>{d.active ? <CheckCircle2 size={10}/> : <X size={10}/>}</span>
              <span className="flex items-center gap-1 text-[10px]" style={{ color: d.active ? "oklch(from var(--foreground) l c h / 0.8)" : "oklch(from var(--foreground) l c h / 0.25)" }}>
                {d.icon} {d.tab}
              </span>
              <span className="text-[9px] text-muted-foreground/60 ml-auto">{d.active ? d.reason : "Not applicable"}</span>
            </div>
          ))}
        </div>
      </div>

      {/* URL check result */}
      <div className="border-t border-border/60 pt-2">
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-2 flex items-center gap-1">
          <Link2 size={9}/> External Link Verification
        </div>
        {urlCheckResult === undefined && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
            <Loader2 size={10} className="animate-spin"/> Probing URL…
          </div>
        )}
        {urlCheckResult === null && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground/80">
            <Info size={10}/> URL check not yet run
          </div>
        )}
        {urlCheckResult && urlCheckResult.ok && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={12} className="text-green-400 flex-shrink-0"/>
              <span className="text-[10px] font-bold text-green-400">
                URL REACHABLE — HTTP {urlCheckResult.status}
              </span>
            </div>
            {urlCheckResult.redirected && (
              <div className="text-[9px] text-yellow-400/70 flex items-center gap-1">
                <AlertTriangle size={9}/> Redirected to: {urlCheckResult.finalUrl}
              </div>
            )}
            <a href={article.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-[9px] text-cyan-400 hover:underline truncate">
              <ExternalLink size={9}/> {article.url}
            </a>
          </div>
        )}
        {urlCheckResult && !urlCheckResult.ok && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <XCircle size={12} className="text-red-400 flex-shrink-0"/>
              <span className="text-[10px] font-bold text-red-400">
                URL FAILED — {urlCheckResult.status > 0 ? `HTTP ${urlCheckResult.status}` : urlCheckResult.statusText}
              </span>
            </div>
            {urlCheckResult.failReason && (
              <div className="text-[9px] text-red-400/70 leading-relaxed">{urlCheckResult.failReason}</div>
            )}
            <div className="text-[9px] text-muted-foreground/80 truncate">{article.url}</div>
          </div>
        )}
      </div>

      <div className="border-t border-border/60 pt-2">
        <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-1.5">Topic Coverage</div>
        <div className="text-[10px] text-foreground/60">
          This article contributes to <span className="text-foreground font-bold">{topics.length}</span> topic{topics.length !== 1 ? "s" : ""}: {topics.join(", ") || "GENERAL"}
        </div>
      </div>
    </div>
  );
}

// ─── History panel ────────────────────────────────────────────────────────────
function HistoryPanel({ onSelect }: { onSelect: (id: number) => void }) {
  const [view, setView] = useState<"all" | "verified" | "failed">("all");
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(loadHistory().reverse()); // newest first
  }, []);

  const filtered = useMemo(() => {
    if (view === "verified") return history.filter(e => e.status === "verified");
    if (view === "failed") return history.filter(e => e.status === "failed" || e.status === "flagged");
    return history;
  }, [history, view]);

  const clearHistory = () => {
    localStorage.removeItem(HISTORY_KEY);
    setHistory([]);
  };

  const statusIcon = (s: HistoryEntry["status"]) => {
    if (s === "verified") return <CheckCircle2 size={10} className="text-green-400"/>;
    if (s === "failed") return <XCircle size={10} className="text-red-400"/>;
    return <Flag size={10} className="text-yellow-400"/>;
  };

  const statusColor = (s: HistoryEntry["status"]) =>
    s === "verified" ? "text-green-400" : s === "failed" ? "text-red-400" : "text-yellow-400";

  return (
    <div className="flex flex-col h-full">
      {/* Sub-nav */}
      <div className="flex-shrink-0 flex items-center gap-1 p-3 border-b border-border/60">
        {(["all", "verified", "failed"] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className="px-3 py-1 rounded text-[10px] font-bold transition-all"
            style={{
              background: view === v ? "oklch(from var(--foreground) l c h / 0.08)" : "transparent",
              color: view === v ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
              border: `1px solid ${view === v ? "oklch(from var(--foreground) l c h / 0.15)" : "transparent"}`,
            }}>
            {v === "all" ? `All (${history.length})` : v === "verified" ? `✓ Verified (${history.filter(e => e.status === "verified").length})` : `✗ Failed/Flagged (${history.filter(e => e.status !== "verified").length})`}
          </button>
        ))}
        {history.length > 0 && (
          <button onClick={clearHistory}
            className="ml-auto text-[9px] text-muted-foreground/50 hover:text-red-400 transition-colors flex items-center gap-1">
            <Trash2 size={9}/> Clear
          </button>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-12">
            <History size={24} className="text-muted-foreground/20 mb-3"/>
            <div className="text-xs text-muted-foreground/50">No {view === "all" ? "" : view} verification history yet</div>
            <div className="text-[10px] text-muted-foreground/30 mt-1">Run the wizard on an article to build history</div>
          </div>
        )}
        {filtered.map(entry => (
          <button key={`${entry.articleId}-${entry.timestamp}`}
            onClick={() => onSelect(entry.articleId)}
            className="w-full text-left p-2.5 rounded-lg mb-1 hover:bg-foreground/5 border border-transparent hover:border-border/70 transition-all group">
            <div className="flex items-start gap-2">
              <span className="mt-0.5 flex-shrink-0">{statusIcon(entry.status)}</span>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground line-clamp-2 mb-1">{entry.title}</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] font-bold uppercase ${statusColor(entry.status)}`}>{entry.status}</span>
                  {entry.failLayer && (
                    <span className="text-[9px] text-red-400/60">at {entry.failLayer}</span>
                  )}
                  {entry.notes && (
                    <span className="text-[9px] text-muted-foreground/60 truncate max-w-[120px]">"{entry.notes}"</span>
                  )}
                  <span className="text-[9px] text-muted-foreground/50 ml-auto">
                    {new Date(entry.timestamp).toLocaleDateString()}
                  </span>
                </div>
                {entry.failReason && (
                  <div className="text-[9px] text-red-400/50 mt-0.5 line-clamp-1">{entry.failReason}</div>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function VerifyTab({ region, initialArticleId }: VerifyTabProps) {
  const { isAnalyst } = useAuthContext();
  const [subPage, setSubPage] = useState<VerifySubPage>("verify");
  const [panelView, setPanelView] = useState<"wizard" | "history">("wizard");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(initialArticleId ?? null);
  const [activeLayer, setActiveLayer] = useState<number | null>(null);
  const [animating, setAnimating] = useState(false);
  const [revealedLayers, setRevealedLayers] = useState<Set<number>>(new Set());
  const animRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [verifyNotes, setVerifyNotes] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  // URL check state
  const [urlCheckResult, setUrlCheckResult] = useState<{
    ok: boolean; status: number; statusText: string; contentPresent: boolean;
    redirected: boolean; finalUrl: string; failReason: string | null;
  } | null | undefined>(null); // null = not run yet, undefined = loading

  // Overall verification result
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [failureInfo, setFailureInfo] = useState<{ layer: string; reason: string } | null>(null);

  // Sync initialArticleId changes (deep-link from other tabs)
  useEffect(() => {
    if (initialArticleId != null) {
      setSelectedId(initialArticleId);
      setRevealedLayers(new Set());
      setActiveLayer(null);
      setSaveSuccess(false);
      setUrlCheckResult(null);
      setVerificationFailed(false);
      setFailureInfo(null);
      setPanelView("wizard");
    }
  }, [initialArticleId]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const { data: searchResults, isLoading: searching } = trpc.articles.list.useQuery(
    { region, limit: 20, search: debouncedSearch || undefined },
    { enabled: debouncedSearch.length >= 2, staleTime: 30000 }
  );

  const { data: article, isLoading: loadingDetail } = trpc.articles.detail.useQuery(
    { id: selectedId! },
    { enabled: selectedId !== null, staleTime: 60000 }
  );

  const checkUrlMutation = trpc.verify.checkUrl.useMutation();

  // When article loads, animate layers — and run URL check at L6
  useEffect(() => {
    if (!article) return;
    setRevealedLayers(new Set());
    setActiveLayer(null);
    setAnimating(true);
    setUrlCheckResult(null);
    setVerificationFailed(false);
    setFailureInfo(null);
    let idx = 0;
    const reveal = () => {
      if (idx >= LAYERS.length) {
        setAnimating(false);
        return;
      }
      setActiveLayer(idx);
      setRevealedLayers(prev => new Set(Array.from(prev).concat(idx)));
      const currentIdx = idx;
      idx++;
      // At L6 (idx 5), trigger URL check
      if (currentIdx === 5) {
        setUrlCheckResult(undefined); // loading
        checkUrlMutation.mutateAsync({ url: article.url })
          .then((result: { ok: boolean; status: number; statusText: string; contentPresent: boolean; redirected: boolean; finalUrl: string; failReason: string | null }) => {
            setUrlCheckResult(result);
            if (!result.ok) {
              setVerificationFailed(true);
              setFailureInfo({ layer: "L6 DELIVERY", reason: result.failReason ?? `HTTP ${result.status}` });
            }
          })
          .catch(() => {
            const errResult = { ok: false, status: 0, statusText: "Network error", contentPresent: false, redirected: false, finalUrl: article.url, failReason: "Could not reach the article URL — network error during verification" };
            setUrlCheckResult(errResult);
            setVerificationFailed(true);
            setFailureInfo({ layer: "L6 DELIVERY", reason: errResult.failReason! });
          });
        animRef.current = setTimeout(reveal, 600);
      } else {
        animRef.current = setTimeout(reveal, 600);
      }
    };
    animRef.current = setTimeout(reveal, 300);
    return () => { if (animRef.current) clearTimeout(animRef.current); };
  }, [article]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    setSearch("");
    setDebouncedSearch("");
    setRevealedLayers(new Set());
    setActiveLayer(null);
    setUrlCheckResult(null);
    setVerificationFailed(false);
    setFailureInfo(null);
    setSaveSuccess(false);
    setVerifyNotes("");
    setPanelView("wizard");
  }, []);

  const handleReset = useCallback(() => {
    setSelectedId(null);
    setRevealedLayers(new Set());
    setActiveLayer(null);
    setAnimating(false);
    setSaveSuccess(false);
    setVerifyNotes("");
    setUrlCheckResult(null);
    setVerificationFailed(false);
    setFailureInfo(null);
  }, []);

  // Verify save/check
  const { data: verifyStatus, refetch: refetchVerifyStatus } = trpc.verify.isVerified.useQuery(
    { articleId: selectedId! },
    { enabled: selectedId !== null, staleTime: 10000 }
  );

  const saveMutation = trpc.verify.save.useMutation({
    onSuccess: () => {
      setSaveSuccess(true);
      refetchVerifyStatus();
      if (article) {
        addHistoryEntry({
          articleId: article.id,
          title: article.title,
          url: article.url,
          status: "verified",
          notes: verifyNotes || undefined,
          timestamp: new Date().toISOString(),
        });
      }
    },
  });

  const removeMutation = trpc.verify.remove.useMutation({
    onSuccess: () => {
      setSaveSuccess(false);
      refetchVerifyStatus();
    },
  });

  const handleSaveVerified = useCallback(() => {
    if (!selectedId || !article) return;
    const layersSnapshot = JSON.stringify({ articleId: selectedId, title: article.title, url: article.url, verifiedAt: new Date().toISOString() });
    saveMutation.mutate({ articleId: selectedId, notes: verifyNotes || undefined, layersData: layersSnapshot });
  }, [selectedId, article, verifyNotes, saveMutation]);

  const handleFlagFailed = useCallback(() => {
    if (!article || !failureInfo) return;
    addHistoryEntry({
      articleId: article.id,
      title: article.title,
      url: article.url,
      status: "failed",
      failLayer: failureInfo.layer,
      failReason: failureInfo.reason,
      timestamp: new Date().toISOString(),
    });
    setSaveSuccess(false);
    // Also add to flagged state in localStorage
    const flagged = JSON.parse(localStorage.getItem("geoint_flagged_articles") ?? "[]") as number[];
    if (!flagged.includes(article.id)) {
      localStorage.setItem("geoint_flagged_articles", JSON.stringify([...flagged, article.id]));
    }
  }, [article, failureInfo]);

  const isAlreadyVerified = verifyStatus?.verified === true;
  const allLayersRevealed = revealedLayers.size === LAYERS.length && !animating;
  // URL check still loading
  const urlCheckPending = urlCheckResult === undefined;

  // Narrative Checker state
  const [showNarrativeChecker, setShowNarrativeChecker] = useState(false);
  const [waitingListOpen, setWaitingListOpen] = useState(false);
  const [narrativeMatches, setNarrativeMatches] = useState<any[] | null>(null);
  const checkNarrativeMutation = trpc.narratives.checkArticle.useMutation({
    onSuccess: (matches) => { setNarrativeMatches(matches); },
  });

  const getLayerPanel = (idx: number) => {
    if (!article) return null;
    switch (idx) {
      case 0: return <L1Panel article={article} />;
      case 1: return <L2Panel article={article} />;
      case 2: return <L3Panel article={article} />;
      case 3: return <L4Panel article={article} />;
      case 4: return <L5Panel article={article} />;
      case 5: return <L6Panel article={article} urlCheckResult={urlCheckResult} />;
      default: return null;
    }
  };

  // Layer status: for L6, show warning if URL check failed
  const getLayerStatus = (idx: number, revealed: boolean): "pending" | "processing" | "verified" | "warning" | "failed" => {
    if (!revealed) return "pending";
    if (idx === 5 && revealed) {
      if (urlCheckResult === undefined) return "processing";
      if (urlCheckResult && !urlCheckResult.ok) return "failed";
    }
    return "verified";
  };

  // Render sub-pages
  if (subPage === "narratives") {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
        {/* Sub-page header nav */}
        <div className="flex-shrink-0 border-b border-border/70 bg-card px-6 py-2 flex items-center gap-1">
          {(["verify", "narratives", "fimi"] as VerifySubPage[]).map(p => (
            <button
              key={p}
              onClick={() => setSubPage(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: subPage === p ? "oklch(from var(--foreground) l c h / 0.1)" : "transparent",
                color: subPage === p ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
                borderBottom: subPage === p ? "2px solid oklch(from var(--primary) l c h / 0.8)" : "2px solid transparent",
              }}
            >
              {p === "verify" && <CheckCircle2 size={9}/>}
              {p === "narratives" && <AlertTriangle size={9}/>}
              {p === "fimi" && <Lock size={9}/>}
              {p === "fimi" ? <>{p.toUpperCase()} <Lock size={8} className="text-red-400/70"/></> : p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <NarrativesTab region={region} />
        </div>
      </div>
    );
  }

  if (subPage === "fimi") {
    return (
      <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
        {/* Sub-page header nav */}
        <div className="flex-shrink-0 border-b border-border/70 bg-card px-6 py-2 flex items-center gap-1">
          {(["verify", "narratives", "fimi"] as VerifySubPage[]).map(p => (
            <button
              key={p}
              onClick={() => setSubPage(p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
              style={{
                background: subPage === p ? "oklch(from var(--foreground) l c h / 0.1)" : "transparent",
                color: subPage === p ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
                borderBottom: subPage === p ? "2px solid oklch(from var(--primary) l c h / 0.8)" : "2px solid transparent",
              }}
            >
              {p === "verify" && <CheckCircle2 size={9}/>}
              {p === "narratives" && <AlertTriangle size={9}/>}
              {p === "fimi" && <Lock size={9}/>}
              {p === "fimi" ? <>{p.toUpperCase()} <Lock size={8} className="text-red-400/70"/></> : p.toUpperCase()}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-hidden">
          <FIMITab />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border/70 bg-card px-6 py-3">
        <div className="flex items-center gap-3">
          {/* Sub-page tabs */}
          <div className="flex items-center gap-1 mr-2">
            {(["verify", "narratives", "fimi"] as VerifySubPage[]).map(p => (
              <button
                key={p}
                onClick={() => setSubPage(p)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-bold uppercase tracking-wider transition-all"
                style={{
                  background: subPage === p ? "oklch(from var(--foreground) l c h / 0.1)" : "transparent",
                  color: subPage === p ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
                  borderBottom: subPage === p ? "2px solid oklch(from var(--primary) l c h / 0.8)" : "2px solid transparent",
                }}
              >
                {p === "verify" && <CheckCircle2 size={9}/>}
                {p === "narratives" && <AlertTriangle size={9}/>}
                {p === "fimi" && <Lock size={9}/>}
                {p === "fimi" ? <>{p.toUpperCase()} <Lock size={8} className="text-red-400/70"/></> : p.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-primary"/>
            <div>
              <div className="text-sm font-bold text-foreground tracking-wide">Data Provenance Verifier</div>
              <div className="text-[10px] text-muted-foreground/80">Trace any article through all 6 layers of the intelligence pipeline</div>
            </div>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {/* Panel toggle */}
            <div className="flex items-center gap-1 bg-foreground/5 rounded-lg p-1 border border-border/60">
              <button onClick={() => setPanelView("wizard")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-all"
                style={{
                  background: panelView === "wizard" ? "oklch(from var(--foreground) l c h / 0.1)" : "transparent",
                  color: panelView === "wizard" ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
                }}>
                <ListChecks size={10}/> Wizard
              </button>
              <button onClick={() => setPanelView("history")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold transition-all"
                style={{
                  background: panelView === "history" ? "oklch(from var(--foreground) l c h / 0.1)" : "transparent",
                  color: panelView === "history" ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.35)",
                }}>
                <History size={10}/> History
              </button>
            </div>
            {selectedId && article && panelView === "wizard" && (
              <>
                <div className="text-[10px] text-muted-foreground max-w-xs truncate hidden lg:block">
                  Verifying: <span className="text-foreground/80 font-medium">{article.title}</span>
                </div>
                <Button size="sm" variant="ghost"
                  className="h-7 px-2 text-muted-foreground/80 hover:text-foreground text-xs"
                  onClick={handleReset}>
                  <X size={12} className="mr-1"/> Clear
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* History view */}
      {panelView === "history" && (
        <div className="flex-1 overflow-hidden">
          <HistoryPanel onSelect={(id) => { handleSelect(id); setPanelView("wizard"); }} />
        </div>
      )}

      {/* Wizard view */}
      {panelView === "wizard" && (
        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: search + article selector */}
          <div className="w-80 flex-shrink-0 border-r border-border/60 flex flex-col overflow-hidden bg-card">
            {/* Search */}
            <div className="flex-shrink-0 p-4 border-b border-border/60">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
                <Search size={9}/> Step 1 — Select an Article
              </div>
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/60"/>
                <Input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search by title or keyword…"
                  className="pl-8 h-8 text-xs bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/50 focus:border-primary/50"
                />
                {searching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 animate-spin"/>}
              </div>
            </div>

            {/* Results */}
            <div className="flex-1 overflow-y-auto">
              {!selectedId && debouncedSearch.length >= 2 && (
                <div className="p-2">
                  {searchResults && searchResults.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground/60 text-xs">No articles found</div>
                  )}
                  {searchResults?.map(a => {
                    const topics: string[] = (() => { try { return JSON.parse(a.topicsJson ?? "[]"); } catch { return []; } })();
                    const TOPIC_COLORS: Record<string, string> = {
                      "WAR/CONFLICT": "#ef4444", ECONOMY: "#f59e0b", POLITICS: "#8b5cf6",
                      TECHNOLOGY: "#06b6d4", ENERGY: "#f97316", DIPLOMACY: "#22d3ee",
                      SECURITY: "#ec4899", HUMANITARIAN: "#22c55e", GENERAL: "#94a3b8",
                    };
                    return (
                      <button key={a.id}
                        onClick={() => handleSelect(a.id)}
                        className="w-full text-left p-2.5 rounded-lg mb-1 hover:bg-foreground/5 border border-transparent hover:border-border/70 transition-all group">
                        <div className="text-[11px] font-medium text-foreground/80 group-hover:text-foreground line-clamp-2 mb-1.5">{a.title}</div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {topics.slice(0, 2).map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.5 rounded border"
                              style={{ color: TOPIC_COLORS[t] ?? "#94a3b8", borderColor: `${TOPIC_COLORS[t] ?? "#94a3b8"}40`, background: `${TOPIC_COLORS[t] ?? "#94a3b8"}15` }}>
                              {t}
                            </span>
                          ))}
                          {a.publishedAt && (
                            <span className="text-[9px] text-muted-foreground/60 ml-auto">
                              {new Date(a.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Prompt when nothing searched */}
              {!selectedId && debouncedSearch.length < 2 && (
                <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                  <Search size={28} className="text-muted-foreground/20 mb-3"/>
                  <div className="text-xs text-muted-foreground/60 leading-relaxed">
                    Type at least 2 characters to search articles by title or keyword
                  </div>
                  <div className="mt-4 text-[10px] text-muted-foreground/40">
                    Then select an article to trace its full data journey through all 6 pipeline layers
                  </div>
                </div>
              )}

              {/* Selected article summary */}
              {selectedId && article && (
                <div className="p-4">
                  <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <FileText size={9}/> Selected Article
                  </div>
                  <div className="bg-foreground/3 border border-border/60 rounded-lg p-3 mb-4">
                    <div className="text-[11px] font-semibold text-foreground mb-2 leading-snug">{article.title}</div>
                    {article.summary && (
                      <div className="text-[10px] text-muted-foreground leading-relaxed line-clamp-3">{article.summary}</div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      {article.agency && (
                        <span className="text-[9px] text-muted-foreground/80">{article.agency.name}</span>
                      )}
                      {article.publishedAt && (
                        <span className="text-[9px] text-muted-foreground/60 ml-auto">
                          {new Date(article.publishedAt).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Layer nav */}
                  <div className="text-[9px] text-muted-foreground/80 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Layers size={9}/> Jump to Layer
                  </div>
                  <div className="space-y-1">
                    {LAYERS.map((layer, idx) => {
                      const revealed = revealedLayers.has(idx);
                      const isActive = activeLayer === idx;
                      const Icon = layer.icon;
                      const status = getLayerStatus(idx, revealed);
                      return (
                        <button key={layer.id}
                          onClick={() => revealed && setActiveLayer(idx)}
                          disabled={!revealed}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded transition-all text-left"
                          style={{
                            background: isActive ? `${layer.color}15` : "transparent",
                            border: `1px solid ${isActive ? layer.color + "40" : "transparent"}`,
                            opacity: revealed ? 1 : 0.3,
                            cursor: revealed ? "pointer" : "not-allowed",
                          }}>
                          <span style={{ color: revealed ? layer.color : "oklch(from var(--foreground) l c h / 0.2)" }}>
                            <Icon size={11}/>
                          </span>
                          <span className="text-[10px] font-bold" style={{ color: revealed ? layer.color : "oklch(from var(--foreground) l c h / 0.2)" }}>
                            {layer.id}
                          </span>
                          <span className="text-[10px]" style={{ color: revealed ? "oklch(from var(--foreground) l c h / 0.7)" : "oklch(from var(--foreground) l c h / 0.2)" }}>
                            {layer.label}
                          </span>
                          <span className="ml-auto">
                            {status === "verified" && <CheckCircle2 size={9} style={{ color: layer.color }}/>}
                            {status === "failed" && <XCircle size={9} className="text-red-400"/>}
                            {status === "processing" && <Loader2 size={9} className="animate-spin text-muted-foreground/60"/>}
                            {status === "pending" && !animating && <span/>}
                            {!revealed && animating && idx === Array.from(revealedLayers).length && (
                              <Loader2 size={9} className="animate-spin text-muted-foreground/60"/>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedId && loadingDetail && (
                <div className="flex items-center justify-center h-full">
                  <Loader2 size={20} className="animate-spin text-primary"/>
                </div>
              )}
            </div>
          </div>

          {/* Right panel: 6-layer architecture map */}
          <div className="flex-1 overflow-y-auto p-6">
            {!selectedId && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <div className="mb-8">
                  <div className="text-lg font-bold text-muted-foreground/40 mb-2">Intelligence Pipeline Architecture</div>
                  <div className="text-sm text-muted-foreground/30">Select an article to trace its provenance through all 6 layers</div>
                </div>
                {/* Static preview of all 6 layers */}
                <div className="w-full max-w-2xl space-y-2">
                  {LAYERS.map((layer, idx) => {
                    const Icon = layer.icon;
                    return (
                      <div key={layer.id} className="flex items-center gap-4 opacity-20">
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center border"
                          style={{ borderColor: `${layer.color}40`, background: `${layer.color}10` }}>
                          <Icon size={18} style={{ color: layer.color }}/>
                        </div>
                        <div className="flex-1 text-left">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-[10px] font-bold" style={{ color: layer.color }}>{layer.id}</span>
                            <span className="text-xs font-bold text-foreground">{layer.label}</span>
                            <span className="text-[10px] text-muted-foreground/80">— {layer.sublabel}</span>
                          </div>
                          <div className="text-[10px] text-muted-foreground/60">{layer.description}</div>
                        </div>
                        {idx < LAYERS.length - 1 && (
                          <ArrowDown size={14} style={{ color: layer.color, opacity: 0.3 }}/>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedId && article && (
              <div className="max-w-3xl mx-auto">
                {/* Article header card */}
                <div className="bg-foreground/3 border border-border/70 rounded-xl p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/20 border border-primary/30 flex items-center justify-center flex-shrink-0">
                      <FileText size={14} className="text-primary"/>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-foreground mb-1 leading-snug">{article.title}</div>
                      {article.summary && (
                        <div className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">{article.summary}</div>
                      )}
                      <div className="mt-2 flex items-center gap-3 flex-wrap">
                        {article.agency && (
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                            <Building2 size={9}/> {article.agency.name}
                          </span>
                        )}
                        {article.country && (
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                            <MapPin size={9}/> {article.country}
                          </span>
                        )}
                        {article.publishedAt && (
                          <span className="text-[10px] text-muted-foreground/80 flex items-center gap-1">
                            <Clock size={9}/> {new Date(article.publishedAt).toLocaleString()}
                          </span>
                        )}
                        <a href={article.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1 ml-auto">
                          <ExternalLink size={9}/> View Source
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 6-layer pipeline */}
                <div className="space-y-3">
                  {LAYERS.map((layer, idx) => {
                    const revealed = revealedLayers.has(idx);
                    const isActive = activeLayer === idx;
                    const Icon = layer.icon;
                    const isAnimatingThis = animating && idx === Array.from(revealedLayers).length;
                    const status = getLayerStatus(idx, revealed);
                    const isFailed = status === "failed";
                    const isProcessingUrl = status === "processing";
                    const borderColor = isFailed ? "#ef4444" : (revealed ? (isActive ? layer.color : `${layer.color}40`) : "oklch(from var(--foreground) l c h / 0.06)");
                    const bgColor = isFailed ? "rgba(239,68,68,0.06)" : (revealed ? (isActive ? `${layer.color}08` : `${layer.color}04`) : "oklch(from var(--foreground) l c h / 0.02)");
                    const shadowColor = isFailed ? "0 0 24px rgba(239,68,68,0.25)" : (isActive ? `0 0 24px ${layer.color}20` : "none");

                    return (
                      <div key={layer.id}>
                        {/* Layer card */}
                        <div
                          className="rounded-xl border transition-all duration-500 overflow-hidden cursor-pointer"
                          style={{
                            borderColor,
                            background: bgColor,
                            boxShadow: shadowColor,
                            opacity: revealed ? 1 : 0.4,
                          }}
                          onClick={() => revealed && setActiveLayer(isActive ? null : idx)}
                        >
                          {/* Layer header */}
                          <div className="flex items-center gap-4 p-4">
                            {/* Icon */}
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center border flex-shrink-0 transition-all duration-500"
                              style={{
                                borderColor: isFailed ? "rgba(239,68,68,0.5)" : (revealed ? `${layer.color}50` : "oklch(from var(--foreground) l c h / 0.08)"),
                                background: isFailed ? "rgba(239,68,68,0.15)" : (revealed ? `${layer.color}20` : "oklch(from var(--foreground) l c h / 0.04)"),
                              }}>
                              {isAnimatingThis || isProcessingUrl
                                ? <Loader2 size={16} className="animate-spin" style={{ color: isFailed ? "#ef4444" : layer.color }}/>
                                : isFailed
                                  ? <XCircle size={16} className="text-red-400"/>
                                  : <Icon size={16} style={{ color: revealed ? layer.color : "oklch(from var(--foreground) l c h / 0.2)" }}/>
                              }
                            </div>

                            {/* Labels */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-0.5">
                                <span className="text-[10px] font-bold tracking-wider"
                                  style={{ color: isFailed ? "#ef4444" : (revealed ? layer.color : "oklch(from var(--foreground) l c h / 0.2)") }}>
                                  {layer.id}
                                </span>
                                <span className="text-sm font-bold"
                                  style={{ color: revealed ? "oklch(from var(--foreground) l c h / 0.9)" : "oklch(from var(--foreground) l c h / 0.2)" }}>
                                  {layer.label}
                                </span>
                                <span className="text-[10px]"
                                  style={{ color: revealed ? "oklch(from var(--foreground) l c h / 0.4)" : "oklch(from var(--foreground) l c h / 0.15)" }}>
                                  — {layer.sublabel}
                                </span>
                              </div>
                              <div className="text-[10px]"
                                style={{ color: revealed ? "oklch(from var(--foreground) l c h / 0.45)" : "oklch(from var(--foreground) l c h / 0.15)" }}>
                                {layer.description}
                              </div>
                            </div>

                            {/* Status badge */}
                            <div className="flex-shrink-0">
                              {isFailed
                                ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-red-500/40 bg-red-500/15 text-[9px] font-bold text-red-400">
                                    <XCircle size={9}/> FAILED
                                  </div>
                                : isProcessingUrl
                                  ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/70 text-[9px] text-muted-foreground/60">
                                      <Loader2 size={9} className="animate-spin"/> CHECKING URL
                                    </div>
                                  : revealed
                                    ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[9px] font-bold"
                                        style={{ color: layer.color, borderColor: `${layer.color}40`, background: `${layer.color}15` }}>
                                        <CheckCircle2 size={9}/> VERIFIED
                                      </div>
                                    : isAnimatingThis
                                      ? <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-border/70 text-[9px] text-muted-foreground/60">
                                          <Loader2 size={9} className="animate-spin"/> PROCESSING
                                        </div>
                                      : <div className="px-2.5 py-1 rounded-full border border-border/60 text-[9px] text-muted-foreground/40">
                                          PENDING
                                        </div>
                              }
                            </div>

                            {/* Expand chevron */}
                            {revealed && (
                              <ChevronRight size={14} className="flex-shrink-0 transition-transform duration-200"
                                style={{
                                  color: isFailed ? "#ef4444" : layer.color,
                                  transform: isActive ? "rotate(90deg)" : "rotate(0deg)",
                                }}/>
                            )}
                          </div>

                          {/* Expanded detail panel */}
                          {revealed && isActive && (
                            <div className="px-4 pb-4 border-t"
                              style={{ borderColor: isFailed ? "rgba(239,68,68,0.2)" : `${layer.color}20` }}>
                              <div className="pt-3">
                                {getLayerPanel(idx)}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Connector arrow */}
                        {idx < LAYERS.length - 1 && (
                          <div className="flex justify-center my-1">
                            <ArrowDown size={14} className="transition-all duration-500"
                              style={{ color: revealed ? layer.color : "oklch(from var(--foreground) l c h / 0.08)", opacity: revealed ? 0.6 : 0.3 }}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Completion / Failure banner */}
                {allLayersRevealed && !urlCheckPending && (
                  <div className="mt-6 space-y-3">
                    {verificationFailed ? (
                      /* ─── FAILURE STATE ─── */
                      <>
                        <div className="bg-red-500/10 border border-red-500/40 rounded-xl p-4">
                          <div className="flex items-start gap-3">
                            <XCircle size={20} className="text-red-400 flex-shrink-0 mt-0.5"/>
                            <div className="flex-1">
                              <div className="text-sm font-bold text-red-400 mb-1">Verification Failed</div>
                              {failureInfo && (
                                <>
                                  <div className="text-[11px] text-red-400/70 mb-1">
                                    Failed at <span className="font-bold text-red-400">{failureInfo.layer}</span>
                                  </div>
                                  <div className="text-[11px] text-foreground/60 leading-relaxed">{failureInfo.reason}</div>
                                </>
                              )}
                              <div className="mt-2 text-[10px] text-muted-foreground/80">
                                This article cannot be saved as verified because its source URL is unreachable or returns no content. The article may have been deleted, moved, or the source may be blocking access.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleFlagFailed}
                            className="flex-1 h-8 text-xs border-yellow-500/40 text-yellow-400 hover:bg-yellow-500/10 bg-transparent"
                          >
                            <Flag size={11} className="mr-1.5"/> Flag as Unverified
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (!article) return;
                              // Navigate to sources tab or show info
                              addHistoryEntry({
                                articleId: article.id,
                                title: article.title,
                                url: article.url,
                                status: "failed",
                                failLayer: failureInfo?.layer,
                                failReason: failureInfo?.reason,
                                timestamp: new Date().toISOString(),
                              });
                            }}
                            className="flex-1 h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-500/10 bg-transparent"
                          >
                            <Trash2 size={11} className="mr-1.5"/> Remove from DB
                          </Button>
                        </div>

                        <div className="bg-foreground/3 border border-border/60 rounded-xl p-3">
                          <div className="text-[10px] text-muted-foreground/80 flex items-center gap-1 mb-1">
                            <Info size={9}/> What you can do
                          </div>
                          <ul className="text-[10px] text-muted-foreground space-y-0.5 list-disc list-inside">
                            <li><strong className="text-foreground/70">Flag as Unverified</strong> — marks this article in your local history as failed, without removing it from the DB</li>
                            <li><strong className="text-foreground/70">Remove from DB</strong> — flags it for removal (logs to history; actual deletion requires admin action)</li>
                            <li>You can still <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-cyan-400 hover:underline">open the URL</a> manually to check if it loads in your browser</li>
                          </ul>
                        </div>
                      </>
                    ) : (
                      /* ─── SUCCESS STATE ─── */
                      <>
                        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center gap-3">
                          <CheckCircle2 size={20} className="text-green-400 flex-shrink-0"/>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-green-400">Provenance Verified</span>
                              {isAlreadyVerified && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/20 border border-green-500/40 text-[9px] font-bold text-green-300">
                                  <Shield size={8}/> SAVED AS VERIFIED
                                </span>
                              )}
                              {verifyStatus?.record?.verifiedAt && (
                                <span className="text-[9px] text-muted-foreground/80">
                                  by {verifyStatus.record.verifiedBy} · {new Date(verifyStatus.record.verifiedAt).toLocaleDateString()}
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-green-400/70 mt-0.5">
                              All 6 pipeline layers traced and URL confirmed reachable. {isAlreadyVerified ? "This article is saved in the verified registry." : "Save it to the verified registry to mark it as analyst-approved."}
                            </div>
                          </div>
                          <a href={article.url} target="_blank" rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/20 border border-green-500/30 text-green-400 text-[11px] font-medium hover:bg-green-500/30 transition-colors">
                            <ExternalLink size={11}/> View Original
                          </a>
                        </div>

                        {!isAlreadyVerified && !saveSuccess && (
                          <div className="bg-foreground/3 border border-border/60 rounded-xl p-4 space-y-3">
                            <div className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                              <Shield size={9}/> Save to Verified Registry
                            </div>
                            <textarea
                              value={verifyNotes}
                              onChange={e => setVerifyNotes(e.target.value)}
                              placeholder="Optional analyst notes (e.g. cross-checked with Reuters, confirmed by 2 sources)…"
                              className="w-full h-16 text-xs bg-foreground/5 border border-border/70 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-primary/50"
                            />
                            <Button
                              size="sm"
                              onClick={handleSaveVerified}
                              disabled={saveMutation.isPending}
                              className="w-full h-8 text-xs bg-green-600 hover:bg-green-500 text-foreground border-0"
                            >
                              {saveMutation.isPending
                                ? <><Loader2 size={11} className="mr-1.5 animate-spin"/> Saving…</>
                                : <><Shield size={11} className="mr-1.5"/> Save as Verified</>
                              }
                            </Button>
                          </div>
                        )}

                        {(saveSuccess || isAlreadyVerified) && (
                          <div className="flex items-center justify-between bg-green-500/8 border border-green-500/20 rounded-xl px-4 py-3">
                            <div className="flex items-center gap-2 text-[11px] text-green-400">
                              <Shield size={12}/>
                              <span>Article saved in verified registry</span>
                              {verifyNotes && <span className="text-muted-foreground/80">· "{verifyNotes.slice(0, 40)}{verifyNotes.length > 40 ? '…' : ''}"</span>}
                            </div>
                            <Button size="sm" variant="ghost"
                              className="h-6 px-2 text-[10px] text-red-400/60 hover:text-red-400"
                              onClick={() => removeMutation.mutate({ articleId: selectedId! })}
                              disabled={removeMutation.isPending}
                            >
                              {removeMutation.isPending ? <Loader2 size={9} className="animate-spin"/> : "Remove"}
                            </Button>
                          </div>
                        )}
                                            </>                    )}                  </div>                )}                {/* ─── NARRATIVE CHECKER ─── always visible after layers revealed, locked for unauthenticated */}                {allLayersRevealed && !urlCheckPending && article && (                  <div className="mt-4 rounded-xl border border-purple-500/30 overflow-hidden">                    <button                      className="w-full flex items-center justify-between px-4 py-3 bg-purple-500/8 hover:bg-purple-500/12 transition-colors"                      onClick={() => {                        if (!isAnalyst) { setWaitingListOpen(true); return; }                        setShowNarrativeChecker(v => !v);                        if (!showNarrativeChecker && !narrativeMatches && !checkNarrativeMutation.isPending) {                          checkNarrativeMutation.mutate({ articleId: article.id, region });                        }                      }}                    >                      <div className="flex items-center gap-2">                        <Microscope size={13} className={isAnalyst ? "text-purple-400" : "text-muted-foreground/40"} />                        <span className={`text-xs font-bold ${isAnalyst ? "text-purple-300" : "text-muted-foreground/50"}`}>Narrative Checker</span>                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-purple-500/20 border border-purple-500/30 text-purple-300 font-bold">INTELLIGENCE</span>                        {!isAnalyst && <Lock size={8} className="text-muted-foreground/30" />}                        {isAnalyst && narrativeMatches && (                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-foreground/10 text-muted-foreground/70">{narrativeMatches.length} match{narrativeMatches.length !== 1 ? "es" : ""}</span>                        )}                      </div>                      <div className="flex items-center gap-2">                        <span className="text-[10px] text-muted-foreground/50">{isAnalyst ? (showNarrativeChecker ? "Hide" : "Check which narratives this article supports or contradicts") : "Authenticated analysts can map this article to active narratives"}</span>                        {isAnalyst ? (showNarrativeChecker ? <ChevronDown size={11} className="text-muted-foreground/50" /> : <ChevronRight size={11} className="text-muted-foreground/50" />) : <Lock size={10} className="text-muted-foreground/30" />}                      </div>                    </button>                    {!isAnalyst && (                      <div className="px-4 py-3 border-t border-purple-500/15 bg-foreground/2">                        <div className="flex items-start gap-3">                          <div className="w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">                            <Lock size={12} className="text-purple-400/60" />                          </div>                          <div>                            <p className="text-xs font-semibold text-foreground/60 mb-1">Narrative Intelligence — Analyst Access Required</p>                            <p className="text-[10px] text-muted-foreground/50 leading-relaxed mb-2">The Narrative Checker uses a scientific multi-step pipeline (entity extraction → keyword frequency analysis → semantic similarity scoring → LLM evidence reasoning) to map this article to active intelligence narratives tracked in the {region} region. Each match is scored 0–100 and classified as <em>supports</em>, <em>contradicts</em>, or <em>contextualises</em>.</p>                            <Button size="sm" variant="outline" className="h-6 px-3 text-[10px] border-purple-500/30 text-purple-300 hover:bg-purple-500/10" onClick={() => setWaitingListOpen(true)}>
                              <Lock size={9} className="mr-1.5" /> Only authorised users can use this feature.                            </Button>                          </div>                        </div>                      </div>                    )}                    {isAnalyst && showNarrativeChecker && (                      <div className="p-4 border-t border-purple-500/20 space-y-3">                        <p className="text-[10px] text-muted-foreground/60 leading-relaxed">                          This analysis uses a <strong className="text-muted-foreground/80">scientific multi-step method</strong>: entity extraction → keyword frequency analysis → semantic similarity scoring → LLM-based evidence reasoning. Each match is scored 0–100 and classified as <em>supports</em>, <em>contradicts</em>, or <em>contextualises</em>.                        </p>                        {checkNarrativeMutation.isPending && (                          <div className="flex flex-col items-center justify-center py-8 gap-3">                            <div className="relative w-10 h-10">                              <div className="absolute inset-0 rounded-full border-2 border-purple-500/20 animate-ping" />                              <div className="absolute inset-1 rounded-full border-2 border-purple-500/30 animate-spin" />                              <Microscope size={14} className="absolute inset-0 m-auto text-purple-400" />                            </div>                            <div className="text-center">                              <p className="text-xs text-muted-foreground/60">Analysing against active narratives…</p>                              <p className="text-[10px] text-muted-foreground/40 mt-0.5">Entity extraction → Keyword matching → LLM reasoning</p>                            </div>                          </div>                        )}                        {narrativeMatches && narrativeMatches.length === 0 && (                          <div className="flex flex-col items-center justify-center py-6 text-center">                            <Shield size={20} className="text-muted-foreground/20 mb-2" />                            <p className="text-xs text-muted-foreground/50">No strong narrative matches found</p>                            <p className="text-[10px] text-muted-foreground/30 mt-1">This article does not appear to support or contradict any tracked narratives in the {region} region.</p>                          </div>                        )}                        {narrativeMatches && narrativeMatches.length > 0 && (                          <div className="space-y-2">                            {narrativeMatches.map((m: any) => {                              const supportColor = m.supportType === "supports" ? "#ef4444" : m.supportType === "contradicts" ? "#22c55e" : "#60a5fa";                              const supportLabel = m.supportType === "supports" ? "Supports" : m.supportType === "contradicts" ? "Contradicts" : "Contextualises";                              const pct = Math.round(m.relevanceScore);                              const barColor = pct >= 80 ? "#ef4444" : pct >= 60 ? "#f97316" : pct >= 40 ? "#f59e0b" : "#94a3b8";                              return (                                <div key={m.narrativeId} className="rounded-lg border border-border/50 p-3" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>                                  <div className="flex items-start justify-between gap-2 mb-2">                                    <div className="flex-1 min-w-0">                                      <div className="text-[10px] font-bold text-foreground/80 leading-snug">{m.narrativeTitle}</div>                                      <div className="text-[9px] text-muted-foreground/50 mt-0.5">{m.narrativeRegion} · {m.narrativeCategory}</div>                                    </div>                                    <div className="flex flex-col items-end gap-1 flex-shrink-0">                                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: supportColor + "20", color: supportColor }}>{supportLabel}</span>                                      <span className="text-[9px] font-mono" style={{ color: barColor }}>{pct}% match</span>                                    </div>                                  </div>                                  <div className="h-1 rounded-full bg-foreground/10 overflow-hidden mb-2">                                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: barColor }} />                                  </div>                                  {m.llmReasoning && (                                    <p className="text-[10px] text-muted-foreground/60 italic leading-relaxed border-l-2 border-border/50 pl-2 mb-1">{m.llmReasoning}</p>                                  )}                                  {m.matchedKeywords && m.matchedKeywords.length > 0 && (                                    <div className="flex flex-wrap gap-1">                                      {m.matchedKeywords.slice(0, 5).map((k: string) => (                                        <span key={k} className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">{k}</span>                                      ))}                                      {m.matchedEntities && m.matchedEntities.slice(0, 4).map((e: string) => (                                        <span key={e} className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{e}</span>                                      ))}                                    </div>                                  )}                                </div>                              );                            })}                          </div>                        )}                        <div className="flex items-center justify-between pt-1">                          <p className="text-[9px] text-muted-foreground/40">Results are saved to the narrative evidence registry for future reference.</p>                          <Button size="sm" variant="ghost"                            className="h-6 px-2 text-[9px] text-purple-400/60 hover:text-purple-400"                            onClick={() => { setNarrativeMatches(null); checkNarrativeMutation.mutate({ articleId: article.id, region }); }}                            disabled={checkNarrativeMutation.isPending}                          >                            <RefreshCw size={9} className="mr-1" /> Re-check                          </Button>                        </div>                      </div>                    )}                  </div>                )}                {/* URL check still pending after all layers revealed */}
                {allLayersRevealed && urlCheckPending && (
                  <div className="mt-6 bg-foreground/3 border border-border/60 rounded-xl p-4 flex items-center gap-3">
                    <Loader2 size={16} className="animate-spin text-primary flex-shrink-0"/>
                    <div>
                      <div className="text-sm font-medium text-foreground/70">Verifying source URL…</div>
                      <div className="text-[10px] text-muted-foreground/80">Probing the article link to confirm it is reachable and contains content</div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedId && loadingDetail && (
              <div className="flex flex-col items-center justify-center h-full gap-3">
                <Loader2 size={24} className="animate-spin text-primary"/>
                <div className="text-sm text-muted-foreground/80">Loading article data…</div>
              </div>
            )}
          </div>
        </div>
      )}
      <WaitingListModal open={waitingListOpen} onClose={() => setWaitingListOpen(false)} />
    </div>
  );
}
