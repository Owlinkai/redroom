import { useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import LiveTab from "./tabs/LiveTab";
import CompareTab from "./tabs/CompareTab";
import DataTab from "./tabs/DataTab";
import FeedTab from "./tabs/FeedTab";
import ExploreTab from "./tabs/ExploreTab";
import LiveTicker from "@/components/LiveTicker";
import NotificationPanel from "@/components/NotificationPanel";
import GlobeRegionSelector from "@/components/GlobeRegionSelector";
import { ThemeSelector } from "@/components/ThemeSelector";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Globe, BarChart3, Database, Rss, Network,
  Bell, Sun, Moon, Zap, Shield, ChevronDown,
  RefreshCw, AlertTriangle, Radio, CheckCircle2,
  Maximize2, Minimize2, Activity, Clock
} from "lucide-react";
import SourcesTab from "./tabs/SourcesTab";
import VerifyTab from "./tabs/VerifyTab";
import { UpgradeButton } from "@/components/UpgradeButton";
import FacilitiesTab from "./tabs/FacilitiesTab";
import { usePageVisible } from "@/hooks/usePageVisible";
import { useLocation } from "wouter";
import DisclaimerModal from "@/components/DisclaimerModal";
import SessionIndicator from "@/components/SessionIndicator";
import {
  loadPrefs, savePrefs, type HeaderItem, type BuiltinItem, type CustomToggle,
  HEADER_PREFS_KEY,
} from "@/lib/headerPrefs";

type Tab = "live" | "compare" | "data" | "feed" | "explore" | "sources" | "verify" | "facilities";

const TABS: { id: Tab; label: string; icon: React.ReactNode; description: string }[] = [
  { id: "live", label: "LIVE", icon: <Globe size={12} />, description: "Real-time Map Intelligence" },
  { id: "compare", label: "COMPARE", icon: <BarChart3 size={12} />, description: "Regional Analysis" },
  { id: "data", label: "DATA", icon: <Database size={12} />, description: "Data Explorer" },
  { id: "feed", label: "FEED", icon: <Rss size={12} />, description: "News Feed" },
  { id: "explore", label: "EXPLORE", icon: <Network size={12} />, description: "Network Graph" },
  { id: "sources", label: "SOURCES", icon: <Radio size={12} />, description: "Source Management" },
  { id: "verify", label: "VERIFY", icon: <CheckCircle2 size={12} />, description: "Data Provenance" },
  { id: "facilities", label: "FACILITIES", icon: <Shield size={12} />, description: "Facility Intelligence Registry" },
];

// REGIONS are loaded from the database — fallback used until DB responds
const FALLBACK_REGIONS = ["MENA","Global","Europe","East Asia","Asia-Pacific","South Asia","Central Asia","Sub-Saharan Africa","North Africa","Americas","Latin America"];

const ONBOARDING_KEY = "geoint_region_selected";

// ── Legacy re-exports (AdminCMS imports these names) ──────────────────────────
export type HeaderItemId = string;
export type HeaderItemConfig = BuiltinItem;
export const HEADER_ITEMS_DEFAULT: BuiltinItem[] = [];
export { HEADER_PREFS_KEY };
export function loadHeaderPrefs(): HeaderItem[] { return loadPrefs("intel"); }
export function saveHeaderPrefs(items: HeaderItem[]): void { savePrefs("intel", items); }

export default function IntelPlatform() {
  const [activeTab, setActiveTab] = useState<Tab>("live");
  const [selectedRegion, setSelectedRegion] = useState("MENA");
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRegionDropdown, setShowRegionDropdown] = useState(false);
  const [crawling, setCrawling] = useState(false);
  const [sourcesInitialSubTab, setSourcesInitialSubTab] = useState<string | undefined>(undefined);
  const [systemTime, setSystemTime] = useState(new Date());
  const [exploreQuery, setExploreQuery] = useState("");
  const [verifyArticleId, setVerifyArticleId] = useState<number | null>(null);
  const [liveCountryFilter, setLiveCountryFilter] = useState<string | undefined>(undefined);
  const [statusBarCollapsed, setStatusBarCollapsed] = useState(true);
  const [compactPreference, setCompactPreference] = useState(false);
  const [compactRequired, setCompactRequired] = useState(false);
  const compactUI = compactRequired || compactPreference;

  useEffect(() => {
    const media = window.matchMedia("(max-width: 1023px)");
    const syncCompactRequirement = () => setCompactRequired(media.matches);
    syncCompactRequirement();
    media.addEventListener("change", syncCompactRequirement);
    try {
      const savedPreference = localStorage.getItem("redroom_compact_ui");
      if (savedPreference !== null) setCompactPreference(savedPreference === "true");
    } catch {}
    return () => media.removeEventListener("change", syncCompactRequirement);
  }, []);

  const toggleCompactUI = useCallback(() => {
    if (compactRequired) return;
    setCompactPreference(current => {
      const next = !current;
      try { localStorage.setItem("redroom_compact_ui", String(next)); } catch {}
      return next;
    });
  }, [compactRequired]);

  // ── Header prefs (DB-backed via tRPC, localStorage as fallback cache) ──────
  const { data: dbHeaderPrefs, isLoading: prefsLoading } = trpc.headerPrefs.getPrefs.useQuery(
    { page: "intel" as const },
    { refetchOnWindowFocus: true, staleTime: 5000 }
  );
  const headerPrefs: HeaderItem[] = useMemo(() => {
    if (dbHeaderPrefs && Array.isArray(dbHeaderPrefs) && dbHeaderPrefs.length > 0) {
      return dbHeaderPrefs as HeaderItem[];
    }
    // Only fall back to localStorage/defaults AFTER the query has resolved (not while loading)
    if (prefsLoading) return [];
    return loadPrefs("intel");
  }, [dbHeaderPrefs, prefsLoading]);

  const isItemVisible = useCallback(
    (id: string) => {
      const item = headerPrefs.find(p => p.id === id);
      return item ? item.visible : true;
    },
    [headerPrefs]
  );

  /** Get style overrides for a built-in item */
  const getOverrides = useCallback(
    (id: string): Partial<BuiltinItem> => {
      const item = headerPrefs.find(p => p.id === id);
      if (!item || item.isCustom) return {};
      return {
        labelOverride: item.labelOverride,
        textColor: item.textColor,
        bgColor: item.bgColor,
        hasBorder: item.hasBorder,
        borderColor: item.borderColor,
        borderRadius: item.borderRadius,
      };
    },
    [headerPrefs]
  );

  const orderedControlIds = useMemo(
    () => [...headerPrefs].sort((a, b) => a.order - b.order).map(p => p.id),
    [headerPrefs]
  );

  const customButtons = useMemo(
    () => headerPrefs.filter((p): p is CustomToggle => !!p.isCustom && p.visible)
      .sort((a, b) => a.order - b.order),
    [headerPrefs]
  );

  const handleRegionSelect = useCallback((region: string) => {
    setSelectedRegion(region);
    setShowOnboarding(false);
    try { localStorage.setItem(ONBOARDING_KEY, region); } catch {}
  }, []);

  const handleExploreArticle = useCallback((title: string) => {
    setExploreQuery(title);
    setActiveTab("explore");
  }, []);

  const handleVerifyArticle = useCallback((articleId: number) => {
    setVerifyArticleId(articleId);
    setActiveTab("verify");
  }, []);

  const handleDrillDownCountry = useCallback((country: string) => {
    setLiveCountryFilter(country);
    setActiveTab("live");
  }, []);

  const { theme, toggleTheme } = useTheme();

  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  }, []);
  useEffect(() => {
    const onFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, []);

  const { data: dbRegions } = trpc.ref.regions.useQuery();
  const REGIONS = dbRegions?.map(r => r.name) ?? FALLBACK_REGIONS;

  const { data: notifications } = trpc.notifications.list.useQuery(undefined, { refetchInterval: 30000 });
  const { data: stats } = trpc.articles.stats.useQuery({ region: selectedRegion }, { refetchInterval: 60000 });
  const { data: threatSummary } = trpc.intel.regionThreatSummary.useQuery({ region: selectedRegion }, { refetchInterval: 30000 });
  const threatPulseSpeed = threatSummary ? [5.0, 4.0, 3.2, 2.4, 1.8][threatSummary.threatcon - 1] : 3.2;
  const quickCrawl = trpc.crawler.quickCrawl.useMutation();
  const crawlAll = trpc.agencies.crawlAll.useMutation();
  const utils = trpc.useUtils();
  const { data: activeMissionsData } = trpc.missions.list.useQuery(undefined, { refetchInterval: 30000 });
  const activeMissionCount = activeMissionsData?.filter((m: { isActive: boolean | null }) => m.isActive === true).length ?? 0;

  const unreadCount = notifications?.filter(n => !n.isRead).length ?? 0;
  const criticalCount = notifications?.filter(n => !n.isRead && n.severity === 'critical').length ?? 0;

  const pageVisible = usePageVisible();

  useEffect(() => {
    if (!pageVisible) return;
    const timer = setInterval(() => setSystemTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [pageVisible]);

  const handleCrawl = useCallback(async () => {
    if (crawling) return;
    setCrawling(true);
    setSourcesInitialSubTab("monitor");
    setActiveTab("sources");
    try {
      if (selectedRegion === 'Global') {
        const result = await crawlAll.mutateAsync({ region: 'Global' }) as { agenciesCrawled: number; jobIds: number[] };
        toast.success(`Global Intelligence Sweep`, {
          description: `${result.agenciesCrawled} agencies across all regions — watch the Fetching Monitor`,
          duration: 5000,
        });
      } else {
        await quickCrawl.mutateAsync({ region: selectedRegion, topics: [] });
        toast.success(`Intelligence Update`, {
          description: `Crawl jobs started for ${selectedRegion} — watch the Fetching Monitor`,
          duration: 4000,
        });
      }
      utils.articles.list.invalidate();
      utils.articles.stats.invalidate();
    } catch {
      toast.error("Crawl failed", { description: "Check network connectivity" });
    } finally {
      setCrawling(false);
    }
  }, [crawling, selectedRegion, quickCrawl, crawlAll, utils]);

  // ── Render a single header control item by id ────────────────────────────
  // Applies per-item style overrides (textColor, bgColor, hasBorder, borderColor, borderRadius, labelOverride)
  const renderControlItem = useCallback((id: string) => {
    const ov = getOverrides(id);

    // Helper to build inline style from overrides
    const ovStyle = (defaults: React.CSSProperties): React.CSSProperties => ({
      ...defaults,
      ...(ov.textColor ? { color: ov.textColor } : {}),
      ...(ov.bgColor ? { background: ov.bgColor } : {}),
      ...(ov.hasBorder === false ? { border: 'none' } : {}),
      ...(ov.hasBorder && ov.borderColor ? { borderColor: ov.borderColor } : {}),
      ...(ov.borderRadius !== undefined ? { borderRadius: ov.borderRadius ? '4px' : '0' } : {}),
    });

    switch (id) {
      case "datetime":
        return (
          <div key="datetime" className="hidden md:flex items-center gap-1.5 group/time relative">
            <Clock size={10} className="text-muted-foreground/50" />
            <span className="text-mono text-[9px] text-muted-foreground/50">
              {systemTime.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false, timeZone: 'UTC' })}
            </span>
            <span className="text-mono text-[8px] text-muted-foreground/30">UTC</span>
          </div>
        );
      case "threatcon":
        return threatSummary ? (
          <div key="threatcon" className="flex items-center gap-1.5 opacity-70">
            <span className="text-mono text-[9px] text-muted-foreground/60">{selectedRegion.toUpperCase()}</span>
            <span
              className="text-mono text-[9px] font-medium px-1 py-0"
              style={{ color: threatSummary.color, opacity: 0.8 }}
            >
              TC-{threatSummary.threatcon}
            </span>
          </div>
        ) : null;
      case "articles":
        return (
          <div key="articles" className="hidden md:flex items-center relative group/stats">
            <div className="flex items-center gap-1 cursor-default overflow-hidden relative">
              <Activity size={11} className="text-muted-foreground/50 animate-signal-pulse" />
              <span className="text-mono text-[9px] text-muted-foreground/50">{stats?.total ?? '—'}</span>
              {/* White flash sweep left-to-right */}
              <span className="absolute inset-0 pointer-events-none animate-signal-sweep" />
            </div>
            {/* Expand on hover */}
            <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 opacity-0 group-hover/stats:opacity-100 pointer-events-none group-hover/stats:pointer-events-auto transition-opacity duration-200 z-50">
              <div className="flex items-center gap-3 px-3 py-1.5 bg-card border border-border/80 shadow-lg text-mono text-[10px] whitespace-nowrap">
                <span className="text-muted-foreground">ART: <span className="text-primary">{stats?.total ?? '—'}</span></span>
                <span className="text-muted-foreground">BREAK: <span className="text-danger">{stats?.breaking ?? '—'}</span></span>
                <span className="text-muted-foreground">TODAY: <span className="text-neon">{stats?.today ?? '—'}</span></span>
              </div>
            </div>
          </div>
        );
      case "region":
        return (
          <div key="region" className="relative">
            <button
              onClick={() => setShowRegionDropdown(v => !v)}
              className="portal-header-action header-control flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 text-mono text-[10px]"
              title={`Select intelligence region: ${ov.labelOverride ?? selectedRegion}`}
              aria-label={`Select intelligence region: ${ov.labelOverride ?? selectedRegion}`}
              style={ov.textColor || ov.bgColor ? ovStyle({}) : undefined}
            >
              <Globe size={10} />
              <span className="header-control-label">{ov.labelOverride ?? selectedRegion}</span>
              <ChevronDown size={10} />
            </button>
            {showRegionDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-card border border-border z-50 min-w-[120px]">
                {REGIONS.map(r => (
                  <button
                    key={r}
                    onClick={() => { setSelectedRegion(r); setShowRegionDropdown(false); }}
                    className={`w-full text-left px-3 py-1.5 text-mono text-[10px] hover:bg-primary/10 hover:text-primary transition-all ${selectedRegion === r ? 'text-primary bg-primary/5' : 'text-muted-foreground'}`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            )}
          </div>
        );

      case "globe":
        return (
          <button
            key="globe"
            onClick={() => setShowOnboarding(true)}
            title={ov.labelOverride ?? "Open Region Intelligence Selector"}
            className="relative flex items-center justify-center w-7 h-7 rounded-full border border-primary/40 hover:border-primary transition-all group"
            style={ov.textColor || ov.bgColor ? ovStyle({}) : undefined}
          >
            <Globe
              size={14}
              className="text-primary/70 group-hover:text-primary transition-colors"
              style={{ animation: 'spin 8s linear infinite' }}
            />
          </button>
        );

      case "crawl":
        return (
          <button
            key="crawl"
            onClick={handleCrawl}
            disabled={crawling}
            className="portal-header-action header-control relative hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-mono text-[10px] disabled:opacity-50"
            title={`Trigger intelligence crawl${activeMissionCount > 0 ? ` · ${activeMissionCount} active mission${activeMissionCount !== 1 ? 's' : ''}` : ''}`}
            style={ov.textColor || ov.bgColor ? ovStyle({}) : undefined}
          >
            <RefreshCw size={10} className={crawling ? 'animate-spin' : ''} />
            <span className="header-control-label">{ov.labelOverride ?? (crawling ? 'CRAWLING' : 'CRAWL')}</span>
            {activeMissionCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[14px] h-3.5 px-0.5 rounded-full bg-cyan-500 text-[8px] font-bold text-black flex items-center justify-center leading-none">
                {activeMissionCount > 99 ? '99+' : activeMissionCount}
              </span>
            )}
          </button>
        );

      case "notifs":
        return (
          <button
            key="notifs"
            onClick={() => setShowNotifications(v => !v)}
            className="portal-header-action header-icon-control relative flex items-center gap-1 px-2 py-1"
            title={ov.labelOverride ?? (unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications")}
            aria-label={ov.labelOverride ?? (unreadCount > 0 ? `${unreadCount} unread notifications` : "Notifications")}
            style={ov.textColor || ov.bgColor ? ovStyle({}) : undefined}
          >
            {criticalCount > 0 ? (
              <AlertTriangle size={12} className="text-danger blink" />
            ) : (
              <Bell size={12} />
            )}
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-destructive text-[8px] flex items-center justify-center text-foreground font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        );

      case "fullscreen":
        return (
          <button
            key="fullscreen"
            onClick={toggleFullscreen}
            className="portal-header-action hidden sm:inline-flex"
            title={ov.labelOverride ?? (isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen')}
            style={ov.textColor || ov.bgColor ? ovStyle({}) : undefined}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
        );

      case "upgrade":
        return <UpgradeButton key="upgrade" portal="intel" variant={compactUI ? "icon-only" : "compact"} className="portal-upgrade" />;

      case "docs":
        return (
          <a
            key="docs"
            href="/docs"
            className="portal-header-action portal-header-action--docs"
            style={ovStyle({ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.35)', color: 'rgba(34,197,94,0.9)', textDecoration: 'none' })}
            title="Documentation"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="header-control-label hidden sm:inline">{ov.labelOverride ?? 'DOCS'}</span>
          </a>
        );

      case "theme":
        return (
          <ThemeSelector key={id} compact={compactUI} />
        );

      default:
        // Custom toggle buttons
        return null;
    }
  }, [
    getOverrides, systemTime, threatSummary, threatPulseSpeed, stats,
    selectedRegion, showRegionDropdown, REGIONS,
    crawling, activeMissionCount, handleCrawl,
    criticalCount, unreadCount,
    isFullscreen, toggleFullscreen,
    theme, toggleTheme, compactUI,
  ]);

  return (
    <div className={`dashboard-shell ${compactUI ? "compact-ui" : "normal-ui"} flex flex-col h-[100dvh] overflow-hidden bg-background text-foreground relative`}>
      <DisclaimerModal />
      <SessionIndicator />
      {showOnboarding && <GlobeRegionSelector onSelect={handleRegionSelect} />}
      <div className="grid-overlay" />
      <div className="scanline" />

      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <header className="dashboard-header portal-header relative z-50 flex-shrink-0 border-b border-border bg-card/95 backdrop-blur-sm">
        {/* Top bar — 3-column: logo | center stats | controls */}
        <div className="grid grid-cols-[auto_1fr_auto] items-center px-2 md:px-4 py-1.5 border-b border-border/50">
          {/* Logo (left) */}
          <div className="flex items-center gap-3">
            <div className="relative w-7 h-7">
              <svg viewBox="0 0 28 28" fill="none" className="w-full h-full">
                <circle cx="14" cy="14" r="13" stroke="var(--neon)" strokeWidth="1" opacity="0.5" />
                <circle cx="14" cy="14" r="9" stroke="var(--neon)" strokeWidth="1" />
                <circle cx="14" cy="14" r="2.5" fill="#cc1111" style={{ filter: 'drop-shadow(0 0 4px #cc1111)', animation: `redDotPulse ${threatPulseSpeed}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite` }} />
                <line x1="14" y1="1" x2="14" y2="5" stroke="var(--neon)" strokeWidth="1" />
                <line x1="14" y1="23" x2="14" y2="27" stroke="var(--neon)" strokeWidth="1" />
                <line x1="1" y1="14" x2="5" y2="14" stroke="var(--neon)" strokeWidth="1" />
                <line x1="23" y1="14" x2="27" y2="14" stroke="var(--neon)" strokeWidth="1" />
                <path d="M14 5 L19 14 L14 23 L9 14 Z" stroke="var(--neon)" strokeWidth="0.8" fill="none" opacity="0.6" />
              </svg>
              <div className="absolute inset-0 rounded-full pulse-neon opacity-30" />
            </div>
            <div>
              <div className="text-orbitron text-xs font-bold tracking-widest leading-none" style={{ color: 'var(--primary)' }}>
                <span style={{ color: '#cc1111', animation: `redWordGlow ${threatPulseSpeed}s cubic-bezier(0.45, 0.05, 0.55, 0.95) infinite` }}>RED</span><span style={{ color: 'var(--neon)' }}>ROOM</span>
              </div>
              <div className="text-mono text-[9px] text-muted-foreground tracking-wider leading-none mt-0.5">NEWS & GEO INTELLIGENCE</div>
            </div>
          </div>

          {/* Center: items ordered by CMS prefs (articles, threatcon, datetime) */}
          <div className="flex items-center justify-center gap-3">
            {orderedControlIds
              .filter(id => ["articles", "threatcon", "datetime"].includes(id))
              .map(id => isItemVisible(id) ? renderControlItem(id) : null)}
          </div>

          {/* Controls (right) — order and visibility driven by headerPrefs (editable in AdminCMS › HEADERS) */}
          <div className="portal-header-actions justify-end">
            {orderedControlIds.map(id => {
              // Skip center items — they are rendered in the center section
              if (id === "articles" || id === "threatcon" || id === "datetime") return null;
              if (!isItemVisible(id)) return null;
              // Custom toggle buttons
              const custom = headerPrefs.find(p => p.id === id);
              if (custom?.isCustom) {
                const ct = custom as CustomToggle;
                return (
                  <a
                    key={ct.id}
                    href={ct.link}
                    target={ct.isExternal ? '_blank' : '_self'}
                    rel={ct.isExternal ? 'noopener noreferrer' : undefined}
                    className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] transition-all"
                    style={{
                      background: ct.bgColor || 'transparent',
                      border: ct.hasBorder ? `1px solid ${ct.borderColor || '#6366f1'}` : 'none',
                      borderRadius: ct.borderRadius ? '4px' : '0',
                      color: ct.textColor || '#e2e8f0',
                      textDecoration: 'none',
                    }}
                  >
                    {ct.label}{ct.isExternal ? ' ↗' : ''}
                  </a>
                );
              }
              return renderControlItem(id);
            })}
            {!compactRequired && (
              <button
                onClick={toggleCompactUI}
                className={`compact-ui-toggle flex items-center gap-1 rounded border px-2 py-1 font-mono text-[9px] transition-all ${compactUI ? "border-primary/60 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"}`}
                title={compactUI ? "Switch to normal dashboard UI" : "Switch to compact dashboard UI"}
                aria-pressed={compactUI}
              >
                <Activity size={10} />
                <span>{compactUI ? "NORMAL" : "COMPACT"}</span>
              </button>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center px-2 md:px-4 gap-0 overflow-x-auto scrollbar-none" style={{ WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.description}
              className={`nav-tab flex items-center gap-1.5 ${activeTab === tab.id ? 'active' : ''}`}
            >
              {tab.icon}
              <span className="nav-tab-label">{tab.label}</span>
              {tab.id === 'live' && <span className="ml-1 status-live text-[8px]" />}
            </button>
          ))}
          <a
            href="/orbit"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-tab flex items-center gap-1.5 border-l border-border/30 ml-1 pl-2"
            style={{ color: 'var(--intel-blue)' }}
            title="ORBIT — Space Surveillance"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2a10 10 0 0 1 0 20" />
              <path d="M12 2a10 10 0 0 0 0 20" />
              <path d="M2 12h20" />
            </svg>
            <span className="nav-tab-label">ORBIT</span>
          </a>
          <a
            href="/sigint"
            target="_blank"
            rel="noopener noreferrer"
            className="nav-tab flex items-center gap-1.5 pl-2"
            style={{ color: 'var(--intel-amber)' }}
            title="SIGINT — Signal Intelligence"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 12h2m16 0h2M12 2v2m0 16v2" />
              <circle cx="12" cy="12" r="4" />
              <circle cx="12" cy="12" r="8" strokeDasharray="4 4" />
            </svg>
            <span className="nav-tab-label">SIGINT</span>
          </a>

          <div className="ml-auto flex items-center gap-2 pr-2">
            {statusBarCollapsed && (
              <button
                onClick={() => setStatusBarCollapsed(false)}
                className="group flex items-center gap-1 px-2 py-1 rounded border border-transparent hover:border-white/10 hover:bg-white/5 transition-all duration-200 cursor-pointer"
                title="Expand intelligence status bar"
                style={{ fontFamily: "'JetBrains Mono', monospace" }}
              >
                {[
                  { label: 'SIG', color: '#22d3ee' },
                  { label: 'HUM', color: '#4ade80' },
                  { label: 'GEO', color: '#a78bfa' },
                  { label: 'OSI', color: '#fbbf24' },
                ].map(n => (
                  <span key={n.label} className="flex items-center gap-0.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block transition-all duration-200 group-hover:w-2 group-hover:h-2"
                      style={{ background: n.color, boxShadow: `0 0 3px ${n.color}` }}
                    />
                    <span
                      className="text-[8px] font-bold overflow-hidden transition-all duration-200 max-w-0 opacity-0 group-hover:max-w-[20px] group-hover:opacity-100"
                      style={{ color: n.color }}
                    >{n.label}</span>
                  </span>
                ))}
                <span className="text-[8px] text-muted-foreground/50 ml-0.5 transition-all duration-200 group-hover:text-muted-foreground group-hover:translate-y-[-1px] inline-block">▲</span>
              </button>
            )}
            <Shield size={10} className="text-muted-foreground" />
            <span className="text-mono text-[9px] text-muted-foreground">OPEN INTELLIGENCE</span>
          </div>
        </div>
      </header>

      {/* ─── Intelligence Status Bar ────────────────────────────────────── */}
      {!statusBarCollapsed && (
        <div className="flex-shrink-0 flex items-center gap-0 px-4 overflow-hidden"
          style={{ background: 'var(--card)', borderBottom: '1px solid var(--border)', height: 22, fontFamily: "'JetBrains Mono', monospace", fontSize: '9px' }}>
          {[
            { label: 'SIGINT', color: '#22d3ee' },
            { label: 'HUMINT', color: '#4ade80' },
            { label: 'GEOINT', color: '#a78bfa' },
            { label: 'OSINT', color: '#fbbf24' },
            { label: 'SATINT', color: '#60a5fa' },
            { label: 'MASINT', color: '#f97316' },
          ].map(node => (
            <div key={node.label} className="flex items-center gap-1 px-2.5 border-r" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.05)', height: '100%' }}>
              <div className="w-1 h-1 rounded-full" style={{ background: node.color, boxShadow: `0 0 3px ${node.color}` }} />
              <span style={{ color: node.color }}>{node.label}</span>
              <span style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>ACTIVE</span>
            </div>
          ))}
          <div className="flex items-center gap-1 px-2.5 border-r" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.05)', height: '100%' }}>
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.3)' }}>SRC:</span>
            <span style={{ color: 'var(--primary)' }}>{stats?.sources ?? '—'}</span>
          </div>
          <div className="flex items-center gap-1 px-2.5 border-r" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.05)', height: '100%' }}>
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.3)' }}>ART:</span>
            <span style={{ color: 'var(--intel-green)' }}>{stats?.total ?? '—'}</span>
          </div>
          <div className="ml-auto flex items-center gap-4 pl-3">
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>ENC: <span style={{ color: 'var(--intel-green)' }}>AES-256-GCM</span></span>
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>TLS: <span style={{ color: 'var(--intel-green)' }}>1.3</span></span>
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.15)' }}>CLASSIFICATION: <span style={{ color: 'var(--intel-red)', fontWeight: 'bold' }}>UNCLASSIFIED // FOUO</span></span>
            <span style={{ color: 'oklch(from var(--foreground) l c h / 0.12)' }}>{systemTime.toISOString().replace('T', ' ').substring(0, 19)} UTC</span>
            <button
              onClick={() => setStatusBarCollapsed(true)}
              className="ml-2 flex items-center justify-center w-4 h-4 rounded hover:bg-white/10 transition-colors cursor-pointer flex-shrink-0"
              title="Collapse status bar"
              style={{ color: 'oklch(from var(--foreground) l c h / 0.25)' }}
            >
              <span style={{ fontSize: '7px', lineHeight: 1 }}>▼</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <main className="flex-1 overflow-hidden relative z-10">
        {activeTab === "live" && <LiveTab region={selectedRegion} onExplore={handleExploreArticle} onVerify={handleVerifyArticle} initialCountryFilter={liveCountryFilter} onCountryFilterUsed={() => setLiveCountryFilter(undefined)} compactUI={compactUI} />}
        {activeTab === "compare" && <CompareTab region={selectedRegion} onDrillDownCountry={handleDrillDownCountry} />}
        {activeTab === "data" && <DataTab region={selectedRegion} />}
        {activeTab === "feed" && <FeedTab region={selectedRegion} onExplore={handleExploreArticle} onVerify={handleVerifyArticle} />}
        {activeTab === "explore" && <ExploreTab region={selectedRegion} initialQuery={exploreQuery} onQueryUsed={() => setExploreQuery("")} />}
        {activeTab === "sources" && <SourcesTab region={selectedRegion} initialSubTab={sourcesInitialSubTab} />}
        {activeTab === "verify" && <VerifyTab region={selectedRegion} initialArticleId={verifyArticleId} />}
        {activeTab === "facilities" && <FacilitiesTab region={selectedRegion} />}
      </main>

      {/* ─── Live Ticker ─────────────────────────────────────────────────── */}
      <LiveTicker region={selectedRegion} compact={compactUI} />

      {/* ─── Notification Panel ──────────────────────────────────────────── */}
      {showNotifications && (
        <NotificationPanel
          notifications={notifications ?? []}
          onClose={() => setShowNotifications(false)}
        />
      )}

      {showRegionDropdown && (
        <div className="fixed inset-0 z-40" onClick={() => setShowRegionDropdown(false)} />
      )}
    </div>
  );
}
