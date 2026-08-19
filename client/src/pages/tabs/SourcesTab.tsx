import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, RefreshCw, Play, Globe, Radio,
  CheckCircle2, XCircle, ChevronDown, ChevronUp, ExternalLink,
  Search, Loader2, Rss, AlertCircle, Map, Settings2, Clock,
  Zap, Activity, Power, PowerOff, RotateCcw, Timer, Newspaper,
  Shield, ShieldAlert, ShieldCheck, Signal, TrendingUp, TrendingDown,
  BarChart3, Filter, Eye, EyeOff, ChevronRight, Wifi, WifiOff,
  Database, Target, Crosshair, Lock, Unlock, AlertTriangle,
  ArrowUpDown, SortAsc, SortDesc, ToggleLeft, ToggleRight, Info,
  Layers, Network, FileText, Star, StarOff, Minus,
  Download, Upload, Bell, BellOff, X, CalendarRange, ChevronLeft,
  CalendarClock, ListChecks, Gauge, Siren, Satellite
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { MapContainer, TileLayer, CircleMarker, Popup, ZoomControl, useMap } from "react-leaflet";
import L from "leaflet";
import 'leaflet.heat';
import "leaflet/dist/leaflet.css";
import { FetchingMonitor } from "./FetchingMonitor";

interface SourcesTabProps { region: string; initialSubTab?: string; }

// ─── Country → Coordinates lookup ─────────────────────────────────────────────
const COUNTRY_COORDS: Record<string, [number, number]> = {
  "United States": [37.09, -95.71], "USA": [37.09, -95.71], "US": [37.09, -95.71],
  "United Kingdom": [55.38, -3.44], "UK": [55.38, -3.44], "GB": [55.38, -3.44],
  "Germany": [51.17, 10.45], "France": [46.23, 2.21], "Italy": [41.87, 12.57],
  "Spain": [40.46, -3.75], "Russia": [61.52, 105.32], "China": [35.86, 104.19],
  "Japan": [36.20, 138.25], "India": [20.59, 78.96], "Brazil": [-14.24, -51.93],
  "Canada": [56.13, -106.35], "Australia": [-25.27, 133.78], "South Korea": [35.91, 127.77],
  "Saudi Arabia": [23.89, 45.08], "UAE": [23.42, 53.85], "Qatar": [25.35, 51.18],
  "Turkey": [38.96, 35.24], "Iran": [32.43, 53.69], "Iraq": [33.22, 43.68],
  "Egypt": [26.82, 30.80], "Israel": [31.05, 34.85], "Jordan": [30.59, 36.24],
  "Lebanon": [33.85, 35.86], "Syria": [34.80, 38.99], "Yemen": [15.55, 48.52],
  "Kuwait": [29.31, 47.48], "Bahrain": [26.07, 50.55], "Oman": [21.51, 55.92],
  "Libya": [26.34, 17.23], "Tunisia": [33.89, 9.54], "Algeria": [28.03, 1.66],
  "Morocco": [31.79, -7.09], "Sudan": [12.86, 30.22], "Ethiopia": [9.15, 40.49],
  "Nigeria": [9.08, 8.68], "South Africa": [-30.56, 22.94], "Kenya": [-0.02, 37.91],
  "Pakistan": [30.38, 69.35], "Afghanistan": [33.94, 67.71], "Bangladesh": [23.68, 90.36],
  "Indonesia": [-0.79, 113.92], "Malaysia": [4.21, 101.98], "Thailand": [15.87, 100.99],
  "Vietnam": [14.06, 108.28], "Philippines": [12.88, 121.77], "Singapore": [1.35, 103.82],
  "Mexico": [23.63, -102.55], "Argentina": [-38.42, -63.62], "Colombia": [4.57, -74.30],
  "Chile": [-35.68, -71.54], "Venezuela": [6.42, -66.59], "Peru": [-9.19, -75.02],
  "Poland": [51.92, 19.15], "Ukraine": [48.38, 31.17], "Netherlands": [52.13, 5.29],
  "Belgium": [50.50, 4.47], "Switzerland": [46.82, 8.23], "Sweden": [60.13, 18.64],
  "Norway": [60.47, 8.47], "Denmark": [56.26, 9.50], "Finland": [61.92, 25.75],
  "Greece": [39.07, 21.82], "Portugal": [39.40, -8.22], "Czech Republic": [49.82, 15.47],
  "Hungary": [47.16, 19.50], "Romania": [45.94, 24.97], "International": [20.0, 0.0],
  "Global": [20.0, 0.0], "MENA": [25.0, 45.0],
};

const BIAS_COLORS: Record<string, string> = {
  left: '#3b82f6', 'center-left': '#6366f1', center: '#22d3ee',
  'center-right': '#f59e0b', right: '#ef4444', state: '#a855f7'
};
const BIAS_LABELS: Record<string, string> = {
  left: 'LEFT', 'center-left': 'CTR-L', center: 'CENTER',
  'center-right': 'CTR-R', right: 'RIGHT', state: 'STATE'
};

const TYPE_COLORS: Record<string, string> = {
  state: '#a855f7', independent: '#22d3ee', international: '#f59e0b',
  digital: '#10b981', broadcast: '#ef4444', wire: '#f97316',
  tv: '#f59e0b', radio: '#8b5cf6', newspaper: '#22d3ee', online: '#10b981',
  agency: '#f97316', blog: '#6366f1', government: '#a855f7'
};
const TYPE_LABELS: Record<string, string> = {
  state: 'STATE', independent: 'INDEP', international: 'INTL',
  digital: 'DIGITAL', broadcast: 'BCAST', wire: 'WIRE',
  tv: 'TV', radio: 'RADIO', newspaper: 'PRESS', online: 'ONLINE',
  agency: 'AGENCY', blog: 'BLOG', government: 'GOV'
};

const EMPTY_FORM = {
  name: '', country: '', type: 'independent', website: '', rssFeeds: '',
  language: 'en', bias: 'center' as const, logoUrl: '', description: '', region: 'MENA',
};

type SubTab = 'sources' | 'map' | 'fetching' | 'monitor';
type SortField = 'name' | 'country' | 'reliability' | 'articleCount' | 'lastCrawled';
type SortDir = 'asc' | 'desc';
type SignalHealth = 'hot' | 'warm' | 'cold' | 'dead' | 'unknown';

// ─── Helpers ───────────────────────────────────────────────────────────────────
function getSignalHealth(lastCrawled: string | Date | null | undefined, lastArticleAt?: string | null): SignalHealth {
  const ref = lastCrawled || lastArticleAt;
  if (!ref) return 'unknown';
  const diff = Date.now() - new Date(ref).getTime();
  const hours = diff / 3600000;
  if (hours < 2) return 'hot';
  if (hours < 24) return 'warm';
  if (hours < 72) return 'cold';
  return 'dead';
}
const HEALTH_CONFIG: Record<SignalHealth, { color: string; bg: string; label: string; icon: React.ReactNode }> = {
  hot:     { color: '#22c55e', bg: '#22c55e22', label: 'LIVE',    icon: <Signal size={10}/> },
  warm:    { color: 'var(--intel-yellow)', bg: '#f59e0b22', label: 'WARM',    icon: <Wifi size={10}/> },
  cold:    { color: '#6366f1', bg: '#6366f122', label: 'COLD',    icon: <WifiOff size={10}/> },
  dead:    { color: 'var(--intel-red)', bg: '#ef444422', label: 'STALE',   icon: <AlertTriangle size={10}/> },
  unknown: { color: '#6b7280', bg: '#6b728022', label: 'NO DATA', icon: <Minus size={10}/> },
};

function getTier(reliability: number | null | undefined): { label: string; color: string; bg: string } {
  const r = reliability ?? 50;
  if (r >= 85) return { label: 'TIER-1', color: '#22c55e', bg: '#22c55e22' };
  if (r >= 65) return { label: 'TIER-2', color: 'var(--intel-yellow)', bg: '#f59e0b22' };
  return { label: 'TIER-3', color: 'var(--intel-red)', bg: '#ef444422' };
}

function relativeTime(date: string | Date | null | undefined): string {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Sources Intelligence Dashboard ───────────────────────────────────────────
function SourcesList({ region, onCrawlStart }: { region: string; onCrawlStart?: () => void }) {
  const [search, setSearch] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterType, setFilterType] = useState('all');
  const [filterBias, setFilterBias] = useState('all');
  const [filterHealth, setFilterHealth] = useState<'all' | SignalHealth>('all');
  const [filterTier, setFilterTier] = useState<'all' | 'TIER-1' | 'TIER-2' | 'TIER-3'>('all');
  const [sortField, setSortField] = useState<SortField>('reliability');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM, region });
  const [crawlingId, setCrawlingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [showIntelPanel, setShowIntelPanel] = useState(true);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: agencies, isLoading, refetch } = trpc.agencies.withStats.useQuery(
    { region: region === 'Global' ? undefined : region, limit: 300 }, { staleTime: 30000 }
  );
  const utils = trpc.useUtils();

  const createMutation = trpc.agencies.create.useMutation({
    onSuccess: () => { toast.success('Source registered'); refetch(); setShowForm(false); setForm({ ...EMPTY_FORM, region }); },
    onError: (e) => toast.error('Registration failed', { description: e.message }),
  });
  const updateMutation = trpc.agencies.update.useMutation({
    onSuccess: () => { toast.success('Source updated'); refetch(); setShowForm(false); setEditingId(null); },
    onError: (e) => toast.error('Update failed', { description: e.message }),
  });
  const deleteMutation = trpc.agencies.delete.useMutation({
    onSuccess: () => { toast.success('Source decommissioned'); refetch(); },
    onError: (e) => toast.error('Decommission failed', { description: e.message }),
  });
  const crawlOneMutation = trpc.agencies.crawlOne.useMutation({
    onSuccess: (data) => {
      if (data.jobId) toast.success('Signal acquisition started', {
        description: `Job #${data.jobId} queued`,
        action: { label: 'Open Live Monitor →', onClick: () => onCrawlStart?.() },
      });
      else toast.info('No RSS feeds configured');
      utils.articles.list.invalidate();
      setCrawlingId(null);
    },
    onError: (e) => { toast.error('Acquisition failed', { description: e.message }); setCrawlingId(null); },
  });
  const toggleActiveMutation = trpc.agencies.update.useMutation({
    onSuccess: () => { refetch(); },
    onError: (e) => toast.error('Toggle failed', { description: e.message }),
  });

  const handleSave = useCallback(() => {
    const rssArray = form.rssFeeds.split('\n').map(s => s.trim()).filter(Boolean);
    if (!form.name.trim() || !form.country.trim()) { toast.error('Name and country are required'); return; }
    const payload = {
      name: form.name.trim(), country: form.country.trim(), type: form.type,
      website: form.website.trim() || undefined, rssFeeds: rssArray,
      language: form.language || 'en', bias: form.bias as any,
      logoUrl: form.logoUrl.trim() || undefined, description: form.description.trim() || undefined,
      region: form.region || region,
    };
    if (editingId !== null) updateMutation.mutate({ id: editingId, ...payload });
    else createMutation.mutate(payload);
  }, [form, editingId, createMutation, updateMutation, region]);

  const handleEdit = useCallback((agency: any) => {
    setEditingId(agency.id);
    setForm({
      name: agency.name || '', country: agency.country || '', type: agency.type || 'independent',
      website: agency.website || '', rssFeeds: (agency.rssFeeds as string[] || []).join('\n'),
      language: agency.language || 'en', bias: agency.bias || 'center',
      logoUrl: agency.logoUrl || '', description: agency.description || '', region: agency.region || region,
    });
    setShowForm(true);
  }, [region]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const filtered = useMemo(() => {
    if (!agencies) return [];
    return agencies
      .filter(a => {
        if (filterActive === 'active' && !a.isActive) return false;
        if (filterActive === 'inactive' && a.isActive) return false;
        if (filterType !== 'all' && a.type !== filterType) return false;
        if (filterBias !== 'all' && a.bias !== filterBias) return false;
        if (filterTier !== 'all' && getTier(a.reliability).label !== filterTier) return false;
        if (filterHealth !== 'all') {
          const h = getSignalHealth(a.lastCrawled, (a as any).lastArticleAt);
          if (h !== filterHealth) return false;
        }
        if (search) {
          const q = search.toLowerCase();
          return a.name.toLowerCase().includes(q) || a.country.toLowerCase().includes(q) ||
            (a.website ?? '').toLowerCase().includes(q);
        }
        return true;
      })
      .sort((a, b) => {
        let av: any, bv: any;
        if (sortField === 'name') { av = a.name; bv = b.name; }
        else if (sortField === 'country') { av = a.country; bv = b.country; }
        else if (sortField === 'reliability') { av = a.reliability ?? 0; bv = b.reliability ?? 0; }
        else if (sortField === 'articleCount') { av = (a as any).articleCount ?? 0; bv = (b as any).articleCount ?? 0; }
        else if (sortField === 'lastCrawled') { av = a.lastCrawled ? new Date(a.lastCrawled).getTime() : 0; bv = b.lastCrawled ? new Date(b.lastCrawled).getTime() : 0; }
        if (typeof av === 'string') return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
        return sortDir === 'asc' ? av - bv : bv - av;
      });
  }, [agencies, filterActive, filterType, filterBias, filterTier, filterHealth, search, sortField, sortDir]);

  // ─── Intel summary stats ───────────────────────────────────────────────────
  const stats = useMemo(() => {
    if (!agencies) return null;
    const all = agencies;
    const active = all.filter(a => a.isActive);
    const withRss = all.filter(a => (a.rssFeeds as string[] || []).length > 0);
    const totalArticles = all.reduce((s, a) => s + ((a as any).articleCount ?? 0), 0);
    const byBias = Object.keys(BIAS_COLORS).reduce((acc, b) => {
      acc[b] = all.filter(a => a.bias === b).length; return acc;
    }, {} as Record<string, number>);
    const byHealth: Record<SignalHealth, number> = { hot: 0, warm: 0, cold: 0, dead: 0, unknown: 0 };
    for (const a of active) {
      const h = getSignalHealth(a.lastCrawled, (a as any).lastArticleAt);
      byHealth[h]++;
    }
    const byCountry: Record<string, number> = {};
    for (const a of all) byCountry[a.country] = (byCountry[a.country] || 0) + 1;
    const topCountries = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).slice(0, 8);
    const avgReliability = all.length ? Math.round(all.reduce((s, a) => s + (a.reliability ?? 50), 0) / all.length) : 0;
    // Bias balance score: weighted position on -100 (far-left) to +100 (far-right) scale
    const BIAS_WEIGHTS: Record<string, number> = { left: -80, 'center-left': -35, center: 0, 'center-right': 35, right: 80, state: 0 };
    const biasTotal = all.filter(a => a.bias && BIAS_WEIGHTS[a.bias] !== undefined).length;
    const biasScore = biasTotal > 0
      ? Math.round(all.reduce((s, a) => s + (BIAS_WEIGHTS[a.bias ?? 'center'] ?? 0), 0) / biasTotal)
      : 0;
    // TIER-1 stale alerts
    const staleTier1 = all.filter(a => {
      if (getTier(a.reliability).label !== 'TIER-1') return false;
      const h = getSignalHealth(a.lastCrawled, (a as any).lastArticleAt);
      return h === 'dead' || h === 'unknown';
    });
    return { total: all.length, active: active.length, withRss: withRss.length, totalArticles, byBias, byHealth, topCountries, avgReliability, biasScore, staleTier1 };
  }, [agencies]);

  const selectedAgency = useMemo(() => agencies?.find(a => a.id === selectedId), [agencies, selectedId]);

  // ─── CSV Export ────────────────────────────────────────────────────────────
  const handleExportCSV = useCallback(() => {
    if (!agencies?.length) return;
    const headers = ['id','name','country','type','bias','website','language','reliability','isActive','rssFeeds','description','founded','monthlyVisitors','lastCrawled','articleCount','negativeCount','positiveCount','neutralCount'];
    const rows = agencies.map(a => [
      a.id, `"${(a.name ?? '').replace(/"/g, '""')}"`, `"${(a.country ?? '').replace(/"/g, '""')}"`,
      a.type ?? '', a.bias ?? '', `"${(a.website ?? '').replace(/"/g, '""')}"`,
      a.language ?? '', a.reliability ?? '', a.isActive ? '1' : '0',
      `"${((a.rssFeeds as string[]) ?? []).join('|').replace(/"/g, '""')}"`,
      `"${(a.description ?? '').replace(/"/g, '""')}"`,
      a.founded ?? '', a.monthlyVisitors ?? '',
      a.lastCrawled ? new Date(a.lastCrawled).toISOString() : '',
      (a as any).articleCount ?? 0, (a as any).negativeCount ?? 0,
      (a as any).positiveCount ?? 0, (a as any).neutralCount ?? 0,
    ].join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `source-registry-${new Date().toISOString().slice(0,10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }, [agencies]);

  // ─── CSV Import ────────────────────────────────────────────────────────────
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [importPreview, setImportPreview] = useState<any[]>([]);
  const [alertDismissed, setAlertDismissed] = useState(false);

  const parseImportCSV = useCallback((text: string) => {
    const lines = text.trim().split('\n').filter(Boolean);
    if (lines.length < 2) { setImportErrors(['CSV must have a header row and at least one data row']); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const errors: string[] = [];
    const parsed: any[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = lines[i].match(/(?:"[^"]*"|[^,])+/g)?.map(v => v.replace(/^"|"$/g, '').replace(/""/g, '"').trim()) ?? [];
      const row: any = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      if (!row.name) { errors.push(`Row ${i}: missing name`); continue; }
      parsed.push({
        name: row.name, country: row.country || 'Unknown', type: row.type || 'independent',
        bias: row.bias || 'center', website: row.website || '', language: row.language || 'en',
        reliability: Number(row.reliability) || 70, isActive: row.isactive !== '0',
        rssFeeds: row.rssfeeds ? row.rssfeeds.split('|').filter(Boolean) : [],
        description: row.description || '', region,
      });
    }
    setImportErrors(errors);
    setImportPreview(parsed);
  }, [region]);

  const createManyMutation = trpc.agencies.create.useMutation();
  const handleImportConfirm = useCallback(async () => {
    for (const row of importPreview) {
      await createManyMutation.mutateAsync(row);
    }
    await refetch();
    setShowImport(false); setImportText(''); setImportPreview([]); setImportErrors([]);
  }, [importPreview, createManyMutation, refetch]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">

      {/* ── COMMAND HEADER ─────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 border-b border-primary/20 bg-background px-5 py-3">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
              <span className="text-[10px] font-mono text-cyan-400/70 tracking-[0.2em] uppercase">Source Intelligence Registry</span>
            </div>
            <div className="h-3 w-px bg-foreground/10"/>
            <span className="text-[10px] font-mono text-muted-foreground/60 tracking-wider">
              {stats?.total ?? '—'} SOURCES · {stats?.active ?? '—'} ACTIVE · {stats?.withRss ?? '—'} RSS-ENABLED
            </span>
            {/* TIER-1 stale alert badge */}
            {stats?.staleTier1 && stats.staleTier1.length > 0 && !alertDismissed && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-red-500/15 border border-red-500/40 animate-pulse">
                <ShieldAlert size={10} className="text-red-400"/>
                <span className="text-[9px] font-mono text-red-400 tracking-wider">
                  {stats.staleTier1.length} TIER-1 STALE
                </span>
                <button onClick={() => setAlertDismissed(true)} className="text-red-400/50 hover:text-red-400 ml-1">
                  <X size={8}/>
                </button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* CSV Export */}
            <button onClick={handleExportCSV} title="Export registry as CSV"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/70 text-[10px] font-mono text-muted-foreground/80 hover:text-emerald-400 hover:border-emerald-500/40 transition-colors">
              <Download size={10}/> EXPORT
            </button>
            {/* CSV Import */}
            <button onClick={() => setShowImport(true)} title="Bulk import sources from CSV"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/70 text-[10px] font-mono text-muted-foreground/80 hover:text-amber-400 hover:border-amber-500/40 transition-colors">
              <Upload size={10}/> IMPORT
            </button>
            {/* View toggle */}
            <div className="flex items-center gap-0.5 bg-foreground/5 rounded-md p-0.5 border border-border/70">
              <button onClick={() => setViewMode('cards')}
                className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${viewMode === 'cards' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground/60 hover:text-foreground/60'}`}>
                CARDS
              </button>
              <button onClick={() => setViewMode('table')}
                className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors ${viewMode === 'table' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground/60 hover:text-foreground/60'}`}>
                TABLE
              </button>
            </div>
            <button onClick={() => setShowIntelPanel(v => !v)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded border border-border/70 text-[10px] font-mono text-muted-foreground/80 hover:text-foreground/70 hover:border-border transition-colors">
              {showIntelPanel ? <EyeOff size={10}/> : <Eye size={10}/>}
              {showIntelPanel ? 'HIDE INTEL' : 'SHOW INTEL'}
            </button>
            <Button size="sm"
              className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-400 text-[10px] font-mono h-7 gap-1.5 tracking-wider"
              onClick={() => { setEditingId(null); setForm({ ...EMPTY_FORM, region }); setShowForm(true); }}>
              <Plus size={11}/> REGISTER SOURCE
            </Button>
          </div>
        </div>

        {/* ── INTEL PANEL ─────────────────────────────────────────────── */}
        {showIntelPanel && stats && (
          <div className="grid grid-cols-4 gap-3 mb-3">

            {/* 1. SOURCE TIERS — click to filter */}
            <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-3">
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-[0.15em] mb-2 flex items-center gap-1.5">
                <Shield size={9}/> SOURCE TIERS
                <span className="ml-auto text-[8px] text-muted-foreground/40">CLICK TO FILTER</span>
              </div>
              <div className="space-y-1.5">
                {(['TIER-1', 'TIER-2', 'TIER-3'] as const).map(tier => {
                  const cfg = tier === 'TIER-1' ? { color: '#22c55e' } : tier === 'TIER-2' ? { color: 'var(--intel-yellow)' } : { color: 'var(--intel-red)' };
                  const count = (agencies ?? []).filter(a => getTier(a.reliability).label === tier).length;
                  const pct = stats.total ? Math.round(count / stats.total * 100) : 0;
                  const isActive = filterTier === tier;
                  return (
                    <div key={tier}
                      onClick={() => setFilterTier(isActive ? 'all' : tier)}
                      className={`flex items-center gap-2 px-1.5 py-1 rounded cursor-pointer transition-all ${
                        isActive ? 'bg-foreground/8' : 'hover:bg-foreground/5'
                      }`}
                      title={`${pct}% of sources — click to filter`}>
                      <span className="text-[9px] font-mono w-12" style={{ color: cfg.color }}>{tier}</span>
                      <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: cfg.color + '99' }}/>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/80 w-14 text-right">{count} ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-[8px] font-mono text-muted-foreground/40">AVG RELIABILITY</span>
                <span className="text-[9px] font-mono text-cyan-400">{stats.avgReliability}%</span>
              </div>
            </div>

            {/* 2. BIAS BALANCE GAUGE — click segments to filter */}
            <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-3">
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-[0.15em] mb-2 flex items-center gap-1.5">
                <BarChart3 size={9}/> BIAS BALANCE
                <span className="ml-auto text-[8px] text-muted-foreground/40">CLICK TO FILTER</span>
              </div>
              <div className="relative mb-1">
                <div className="flex h-4 rounded overflow-hidden gap-px">
                  {Object.entries(BIAS_COLORS).map(([bias, color]) => {
                    const count = stats.byBias[bias] || 0;
                    const pct = stats.total ? count / stats.total * 100 : 0;
                    if (pct < 1) return null;
                    const isActive = filterBias === bias;
                    return (
                      <div key={bias}
                        onClick={() => setFilterBias(isActive ? 'all' : bias)}
                        className={`h-full transition-all cursor-pointer relative group ${
                          isActive ? 'brightness-125' : 'hover:brightness-110'
                        }`}
                        style={{ width: `${pct}%`, backgroundColor: color + 'cc' }}
                        title={`${BIAS_LABELS[bias]}: ${count} (${Math.round(pct)}%)`}>
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-1.5 py-0.5 rounded bg-black/90 border border-border/70 text-[8px] font-mono text-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20">
                          {BIAS_LABELS[bias]}: {count}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="relative h-2 mt-0.5">
                  <div className="absolute top-0 w-0.5 h-2 bg-foreground/60 rounded-full"
                    style={{ left: `${Math.max(1, Math.min(99, (stats.biasScore + 100) / 2))}%`, transform: 'translateX(-50%)' }}/>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[8px] font-mono text-muted-foreground/60">NETWORK BIAS INDEX</span>
                <span className={`text-[10px] font-mono font-bold ${
                  stats.biasScore < -20 ? 'text-blue-400' : stats.biasScore > 20 ? 'text-red-400' : 'text-cyan-400'
                }`}>
                  {stats.biasScore > 0 ? '+' : ''}{stats.biasScore}
                  <span className="text-[8px] font-normal text-muted-foreground/60 ml-1">
                    {stats.biasScore < -30 ? 'LEFT-LEAN' : stats.biasScore > 30 ? 'RIGHT-LEAN' : 'BALANCED'}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap gap-x-2 gap-y-0.5">
                {Object.entries(BIAS_COLORS).map(([bias, color]) => {
                  const count = stats.byBias[bias] || 0;
                  if (!count) return null;
                  return (
                    <button key={bias} onClick={() => setFilterBias(filterBias === bias ? 'all' : bias)}
                      className={`text-[8px] font-mono transition-opacity ${
                        filterBias !== 'all' && filterBias !== bias ? 'opacity-30' : 'opacity-100'
                      }`} style={{ color }}>
                      {BIAS_LABELS[bias]} {count}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. SIGNAL HEALTH — click to filter */}
            <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-3">
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-[0.15em] mb-2 flex items-center gap-1.5">
                <Activity size={9}/> SIGNAL HEALTH
                <span className="ml-auto text-[8px] text-muted-foreground/40">CLICK TO FILTER</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                {(Object.entries(HEALTH_CONFIG) as [SignalHealth, typeof HEALTH_CONFIG[SignalHealth]][]).map(([key, cfg]) => {
                  const count = stats.byHealth[key] || 0;
                  const total = Object.values(stats.byHealth).reduce((s, v) => s + v, 0);
                  const pct = total ? Math.round(count / total * 100) : 0;
                  const isActive = filterHealth === key;
                  return (
                    <div key={key}
                      onClick={() => setFilterHealth(isActive ? 'all' : key)}
                      className={`flex items-center gap-1.5 px-1.5 py-1 rounded cursor-pointer transition-all ${
                        isActive ? 'brightness-125' : 'hover:brightness-110'
                      }`}
                      style={{ backgroundColor: cfg.bg }}
                      title={`${pct}% — click to filter`}>
                      <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      <span className="text-[9px] font-mono" style={{ color: cfg.color }}>{cfg.label}</span>
                      <span className="text-[9px] font-mono text-muted-foreground ml-auto">{count}</span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 flex h-1 rounded overflow-hidden gap-px">
                {(Object.entries(HEALTH_CONFIG) as [SignalHealth, typeof HEALTH_CONFIG[SignalHealth]][]).map(([key, cfg]) => {
                  const count = stats.byHealth[key] || 0;
                  const total = Object.values(stats.byHealth).reduce((s, v) => s + v, 0);
                  const pct = total ? count / total * 100 : 0;
                  if (pct < 1) return null;
                  return <div key={key} className="h-full" style={{ width: `${pct}%`, backgroundColor: cfg.color + '99' }}/>;
                })}
              </div>
            </div>

            {/* 4. GEO DISTRIBUTION — hover for % */}
            <div className="rounded-lg border border-border/60 bg-foreground/[0.02] p-3">
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-[0.15em] mb-2 flex items-center gap-1.5">
                <Globe size={9}/> GEO DISTRIBUTION
                <span className="ml-auto text-[8px] text-muted-foreground/40">HOVER FOR %</span>
              </div>
              <div className="space-y-1">
                {stats.topCountries.slice(0, 5).map(([country, count]) => {
                  const pct = stats.total ? Math.round(count / stats.total * 100) : 0;
                  const maxCount = stats.topCountries[0]?.[1] ?? 1;
                  const relPct = Math.round(count / maxCount * 100);
                  return (
                    <div key={country}
                      className="group flex items-center gap-2 px-1 py-0.5 rounded hover:bg-foreground/5 transition-colors"
                      title={`${country}: ${count} sources (${pct}% of total)`}>
                      <span className="text-[9px] font-mono text-muted-foreground truncate w-20">{country}</span>
                      <div className="flex-1 h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-cyan-500/50 group-hover:bg-cyan-400/70 transition-all" style={{ width: `${relPct}%` }}/>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground/80 w-14 text-right">
                        {count} <span className="text-muted-foreground/40 group-hover:text-muted-foreground transition-colors">({pct}%)</span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 pt-2 border-t border-border/40 flex items-center justify-between">
                <span className="text-[8px] font-mono text-muted-foreground/40">{stats.topCountries.length} COUNTRIES</span>
                <span className="text-[8px] font-mono text-muted-foreground/40">{stats.totalArticles?.toLocaleString() ?? 0} ARTICLES</span>
              </div>
            </div>
          </div>
        )}

        {/* ── FILTER BAR ──────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-40 max-w-52">
            <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50"/>
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sources..."
              className="pl-8 h-7 text-[11px] font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40 focus:border-cyan-500/40"/>
          </div>
          {[
            { value: filterActive, setter: setFilterActive, options: [['all','ALL STATUS'],['active','ACTIVE'],['inactive','INACTIVE']] as [string,string][] },
            { value: filterType, setter: setFilterType, options: [['all','ALL TYPES'], ...Object.entries(TYPE_LABELS)] as [string,string][] },
            { value: filterBias, setter: setFilterBias, options: [['all','ALL BIAS'], ...Object.entries(BIAS_LABELS)] as [string,string][] },
            { value: filterHealth, setter: setFilterHealth, options: [['all','ALL HEALTH'],['hot','LIVE'],['warm','WARM'],['cold','COLD'],['dead','STALE'],['unknown','NO DATA']] as [string,string][] },
            { value: filterTier, setter: setFilterTier, options: [['all','ALL TIERS'],['TIER-1','TIER-1'],['TIER-2','TIER-2'],['TIER-3','TIER-3']] as [string,string][] },
          ].map(({ value, setter, options }, i) => (
            <Select key={i} value={value} onValueChange={setter as any}>
              <SelectTrigger className="h-7 w-28 text-[10px] font-mono bg-foreground/5 border-border/70 text-foreground/60">
                <SelectValue/>
              </SelectTrigger>
              <SelectContent className="bg-card border-border/70 text-foreground font-mono text-[10px]">
                {options.map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          ))}
          <div className="text-[10px] font-mono text-muted-foreground/50 ml-auto">
            {filtered.length} / {agencies?.length ?? 0} SOURCES
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ──────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Source list / table */}
        <div className={`flex-1 overflow-y-auto ${selectedId ? 'border-r border-border/60' : ''}`}>
          {isLoading ? (
            <div className="flex items-center justify-center h-40 text-muted-foreground/60 font-mono text-xs gap-2">
              <Loader2 size={16} className="animate-spin"/> LOADING SOURCE REGISTRY...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-muted-foreground/50 gap-2">
              <Database size={24}/><p className="text-xs font-mono">NO SOURCES MATCH FILTERS</p>
            </div>
          ) : viewMode === 'table' ? (
            <SourceTable agencies={filtered} onEdit={handleEdit}
              onDelete={(id: number, name: string) => { if (confirm(`Decommission "${name}"?`)) deleteMutation.mutate({ id }); }}
              onToggle={(id: number, active: boolean) => toggleActiveMutation.mutate({ id, isActive: !active })}
              onCrawl={(id: number) => { onCrawlStart?.(); setCrawlingId(id); crawlOneMutation.mutate({ id, region }); }}
              crawlingId={crawlingId} onSelect={setSelectedId} selectedId={selectedId}
              sortField={sortField} sortDir={sortDir} onSort={handleSort}/>
          ) : (
            <div className="p-4 grid grid-cols-1 gap-2">
              {filtered.map(agency => (
                <SourceCard key={agency.id} agency={agency} region={region}
                  onEdit={handleEdit} onCrawlStart={onCrawlStart}
                  crawlingId={crawlingId} setCrawlingId={setCrawlingId}
                  crawlOneMutation={crawlOneMutation} deleteMutation={deleteMutation}
                  toggleActiveMutation={toggleActiveMutation}
                  isSelected={selectedId === agency.id}
                  onSelect={() => setSelectedId(selectedId === agency.id ? null : agency.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Source detail panel */}
        {selectedId && selectedAgency && (
          <SourceDetailPanel agency={selectedAgency} onClose={() => setSelectedId(null)}
            onEdit={handleEdit} onCrawl={() => { onCrawlStart?.(); setCrawlingId(selectedAgency.id); crawlOneMutation.mutate({ id: selectedAgency.id, region }); }}
            crawling={crawlingId === selectedAgency.id}
            onToggle={() => toggleActiveMutation.mutate({ id: selectedAgency.id, isActive: !selectedAgency.isActive })}
            onDelete={() => { if (confirm(`Decommission "${selectedAgency.name}"?`)) { deleteMutation.mutate({ id: selectedAgency.id }); setSelectedId(null); } }}
          />
        )}
      </div>

      {/* ── ADD/EDIT DIALOG ────────────────────────────────────────────────── */}
      <Dialog open={showForm} onOpenChange={open => { if (!open) { setShowForm(false); setEditingId(null); } }}>
        <DialogContent className="bg-card border-primary/20 text-foreground max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground font-mono text-sm tracking-wider flex items-center gap-2">
              <Lock size={14} className="text-cyan-400"/>
              {editingId ? 'MODIFY SOURCE RECORD' : 'REGISTER NEW SOURCE'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {[
              { label: 'SOURCE NAME *', key: 'name', placeholder: 'e.g. Al Jazeera English' },
              { label: 'COUNTRY *', key: 'country', placeholder: 'e.g. Qatar' },
              { label: 'WEBSITE', key: 'website', placeholder: 'https://...' },
              { label: 'LOGO URL', key: 'logoUrl', placeholder: 'https://...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">{label}</label>
                <Input value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder} className="h-8 text-xs font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40 focus:border-cyan-500/40"/>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">SOURCE TYPE</label>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-8 text-xs font-mono bg-foreground/5 border-border/70 text-foreground/70"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-card border-border/70 text-foreground font-mono text-xs">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">POLITICAL BIAS</label>
                <Select value={form.bias} onValueChange={(v: any) => setForm(f => ({ ...f, bias: v }))}>
                  <SelectTrigger className="h-8 text-xs font-mono bg-foreground/5 border-border/70 text-foreground/70"><SelectValue/></SelectTrigger>
                  <SelectContent className="bg-card border-border/70 text-foreground font-mono text-xs">
                    {Object.entries(BIAS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">LANGUAGE</label>
                <Input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                  placeholder="en" className="h-8 text-xs font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
              </div>
              <div>
                <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">REGION</label>
                <Input value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))}
                  placeholder="MENA" className="h-8 text-xs font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
              </div>
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">RSS FEED ENDPOINTS (one per line)</label>
              <textarea value={form.rssFeeds} onChange={e => setForm(f => ({ ...f, rssFeeds: e.target.value }))}
                placeholder="https://feeds.example.com/rss&#10;https://feeds.example.com/breaking"
                rows={4} className="w-full text-xs font-mono bg-foreground/5 border border-border/70 text-foreground placeholder:text-muted-foreground/40 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-cyan-500/40"/>
            </div>
            <div>
              <label className="text-[10px] font-mono text-muted-foreground/80 mb-1 block tracking-wider">SOURCE DESCRIPTION</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Brief intelligence profile of this source..." rows={2}
                className="w-full text-xs font-mono bg-foreground/5 border border-border/70 text-foreground placeholder:text-muted-foreground/40 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-cyan-500/40"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="text-muted-foreground/80 hover:text-foreground font-mono text-xs" onClick={() => { setShowForm(false); setEditingId(null); }}>ABORT</Button>
            <Button className="bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-400 font-mono text-xs"
              onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? <Loader2 size={12} className="animate-spin mr-2"/> : <Lock size={12} className="mr-2"/>}
              {editingId ? 'COMMIT CHANGES' : 'REGISTER SOURCE'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── CSV IMPORT MODAL ──────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-2xl mx-4 rounded-xl border border-amber-500/30 bg-background shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border/60">
              <div className="flex items-center gap-2">
                <Upload size={14} className="text-amber-400"/>
                <span className="text-xs font-mono font-semibold text-amber-400 tracking-[0.15em]">BULK SOURCE IMPORT</span>
              </div>
              <button onClick={() => { setShowImport(false); setImportText(''); setImportPreview([]); setImportErrors([]); }}
                className="text-muted-foreground/60 hover:text-foreground/70 transition-colors">
                <X size={16}/>
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* Template download */}
              <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-foreground/[0.03] border border-border/60">
                <span className="text-[10px] font-mono text-muted-foreground/80">CSV FORMAT: name, country, type, bias, website, language, reliability, isActive, rssFeeds (pipe-separated), description</span>
                <button
                  onClick={() => {
                    const template = 'name,country,type,bias,website,language,reliability,isActive,rssFeeds,description\nAl Jazeera,Qatar,state,center-left,https://aljazeera.com,en,85,1,https://aljazeera.com/xml/rss/all.xml,Leading MENA broadcaster';
                    const blob = new Blob([template], { type: 'text/csv' });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a'); a.href = url; a.download = 'source-import-template.csv'; a.click(); URL.revokeObjectURL(url);
                  }}
                  className="flex items-center gap-1.5 text-[10px] font-mono text-amber-400/70 hover:text-amber-400 transition-colors whitespace-nowrap ml-3">
                  <Download size={10}/> TEMPLATE
                </button>
              </div>

              {/* Textarea */}
              <div>
                <label className="text-[10px] font-mono text-muted-foreground/60 tracking-wider block mb-1.5">PASTE CSV DATA (with header row)</label>
                <textarea
                  value={importText}
                  onChange={e => { setImportText(e.target.value); parseImportCSV(e.target.value); }}
                  placeholder={`name,country,type,bias,website,language,reliability,isActive,rssFeeds,description\nAl Jazeera,Qatar,state,center-left,https://aljazeera.com,en,85,1,https://aljazeera.com/xml/rss/all.xml,Leading MENA broadcaster`}
                  rows={6}
                  className="w-full text-[11px] font-mono bg-foreground/5 border border-border/70 text-foreground placeholder:text-muted-foreground/40 rounded-md px-3 py-2 resize-none focus:outline-none focus:border-amber-500/40"
                />
              </div>

              {/* Errors */}
              {importErrors.length > 0 && (
                <div className="space-y-1">
                  {importErrors.map((e, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px] font-mono text-red-400 bg-red-500/10 px-3 py-1.5 rounded">
                      <AlertTriangle size={10}/> {e}
                    </div>
                  ))}
                </div>
              )}

              {/* Preview */}
              {importPreview.length > 0 && (
                <div>
                  <div className="text-[10px] font-mono text-muted-foreground/60 tracking-wider mb-2">
                    PREVIEW — {importPreview.length} SOURCE{importPreview.length !== 1 ? 'S' : ''} READY TO IMPORT
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {importPreview.map((row, i) => (
                      <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded bg-foreground/[0.03] border border-border/40">
                        <span className="text-[10px] font-mono text-foreground/70 font-semibold truncate flex-1">{row.name}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/60">{row.country}</span>
                        <span className="text-[9px] font-mono text-muted-foreground/60">{row.type}</span>
                        <span className="text-[9px] font-mono" style={{ color: BIAS_COLORS[row.bias] ?? '#888' }}>{BIAS_LABELS[row.bias] ?? row.bias}</span>
                        <span className="text-[9px] font-mono text-cyan-400">{row.reliability}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-5 py-4 border-t border-border/60 bg-foreground/[0.01]">
              <span className="text-[10px] font-mono text-muted-foreground/50">
                {importPreview.length > 0 ? `${importPreview.length} sources ready` : 'Paste CSV data above to preview'}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setShowImport(false); setImportText(''); setImportPreview([]); setImportErrors([]); }}
                  className="px-4 py-1.5 rounded border border-border/70 text-[10px] font-mono text-muted-foreground/80 hover:text-foreground/70 transition-colors">
                  CANCEL
                </button>
                <button
                  onClick={handleImportConfirm}
                  disabled={importPreview.length === 0 || createManyMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 rounded border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-mono hover:bg-amber-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                  {createManyMutation.isPending ? <Loader2 size={10} className="animate-spin"/> : <Upload size={10}/>}
                  {createManyMutation.isPending ? 'IMPORTING...' : `IMPORT ${importPreview.length} SOURCE${importPreview.length !== 1 ? 'S' : ''}`}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Source Card Component ─────────────────────────────────────────────────────
function SourceCard({ agency, region, onEdit, onCrawlStart, crawlingId, setCrawlingId, crawlOneMutation, deleteMutation, toggleActiveMutation, isSelected, onSelect }: any) {
  const feeds = (agency.rssFeeds as string[] || []);
  const health = getSignalHealth(agency.lastCrawled, agency.lastArticleAt);
  const healthCfg = HEALTH_CONFIG[health];
  const tier = getTier(agency.reliability);
  const biasColor = BIAS_COLORS[agency.bias || 'center'] || '#6b7280';
  const typeColor = TYPE_COLORS[agency.type || 'independent'] || '#6b7280';
  const articleCount = agency.articleCount ?? 0;
  const negPct = articleCount > 0 ? Math.round(agency.negativeCount / articleCount * 100) : 0;
  const posPct = articleCount > 0 ? Math.round(agency.positiveCount / articleCount * 100) : 0;

  return (
    <div
      onClick={onSelect}
      className={`rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-cyan-500/50 bg-cyan-500/5 shadow-[0_0_12px_rgba(34,211,238,0.08)]'
          : agency.isActive
          ? 'border-border/60 bg-foreground/[0.02] hover:border-border hover:bg-foreground/[0.035]'
          : 'border-border/40 bg-foreground/[0.01] opacity-50 hover:opacity-70'
      }`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Status dot */}
        <div className="flex-shrink-0 flex flex-col items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: healthCfg.color, boxShadow: health === 'hot' ? `0 0 6px ${healthCfg.color}` : 'none' }}/>
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-foreground truncate">{agency.name}</span>
            {/* Tier badge */}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: tier.color, backgroundColor: tier.bg }}>
              {tier.label}
            </span>
            {/* Type badge */}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: typeColor, backgroundColor: typeColor + '22' }}>
              {TYPE_LABELS[agency.type || ''] || agency.type}
            </span>
            {/* Bias badge */}
            {agency.bias && (
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: biasColor, backgroundColor: biasColor + '22' }}>
                {BIAS_LABELS[agency.bias] || agency.bias}
              </span>
            )}
            {/* Signal health */}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1" style={{ color: healthCfg.color, backgroundColor: healthCfg.bg }}>
              {healthCfg.icon} {healthCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground/70">
            <span>{agency.country}</span>
            {agency.language && <span>{agency.language.toUpperCase()}</span>}
            <span>{feeds.length} RSS</span>
            <span className="text-muted-foreground">{articleCount.toLocaleString()} articles</span>
            {agency.lastCrawled && <span>crawled {relativeTime(agency.lastCrawled)}</span>}
          </div>
        </div>

        {/* Reliability bar */}
        <div className="flex-shrink-0 w-20 hidden sm:block">
          <div className="text-[9px] font-mono text-muted-foreground/50 mb-1 text-center">RELIABILITY</div>
          <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${agency.reliability ?? 50}%`,
              backgroundColor: (agency.reliability ?? 50) >= 85 ? '#22c55e' : (agency.reliability ?? 50) >= 65 ? '#f59e0b' : '#ef4444'
            }}/>
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/80 text-center mt-0.5">{agency.reliability ?? 50}%</div>
        </div>

        {/* Sentiment mini bar */}
        {articleCount > 0 && (
          <div className="flex-shrink-0 w-16 hidden md:block">
            <div className="text-[9px] font-mono text-muted-foreground/50 mb-1 text-center">SENTIMENT</div>
            <div className="flex h-1.5 rounded-full overflow-hidden gap-px">
              <div className="bg-red-500/70" style={{ width: `${negPct}%` }}/>
              <div className="bg-foreground/20" style={{ width: `${100 - negPct - posPct}%` }}/>
              <div className="bg-green-500/70" style={{ width: `${posPct}%` }}/>
            </div>
            <div className="text-[9px] font-mono text-red-400/70 text-center mt-0.5">{negPct}% neg</div>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground/60 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            onClick={() => { onCrawlStart?.(); setCrawlingId(agency.id); crawlOneMutation.mutate({ id: agency.id, region }); }}
            disabled={crawlingId === agency.id} title="Acquire signal">
            {crawlingId === agency.id ? <Loader2 size={12} className="animate-spin text-cyan-400"/> : <Play size={12}/>}
          </button>
          <button
            className={`h-7 w-7 flex items-center justify-center rounded transition-colors ${agency.isActive ? 'text-muted-foreground/60 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-muted-foreground/40 hover:text-green-400 hover:bg-green-500/10'}`}
            onClick={() => toggleActiveMutation.mutate({ id: agency.id, isActive: !agency.isActive })}
            title={agency.isActive ? 'Deactivate' : 'Activate'}>
            {agency.isActive ? <PowerOff size={12}/> : <Power size={12}/>}
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground hover:bg-foreground/10 transition-colors"
            onClick={() => onEdit(agency)} title="Edit source">
            <Pencil size={12}/>
          </button>
          <button
            className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            onClick={() => { if (confirm(`Decommission "${agency.name}"?`)) deleteMutation.mutate({ id: agency.id }); }}
            title="Decommission">
            <Trash2 size={12}/>
          </button>
          {agency.website && (
            <a href={agency.website} target="_blank" rel="noopener noreferrer"
              className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground/40 hover:text-foreground/60 hover:bg-foreground/10 transition-colors" title="Open website">
              <ExternalLink size={11}/>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Source Table Component ────────────────────────────────────────────────────
function SourceTable({ agencies, onEdit, onCrawl, onDelete, onToggle, crawlingId, onSelect, selectedId, sortField, sortDir, onSort }: any) {
  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown size={9} className="text-muted-foreground/40"/>;
    return sortDir === 'asc' ? <SortAsc size={9} className="text-cyan-400"/> : <SortDesc size={9} className="text-cyan-400"/>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[11px] font-mono">
        <thead>
          <tr className="border-b border-border/60 bg-foreground/[0.02]">
            {[
              { label: 'SOURCE', field: 'name' },
              { label: 'COUNTRY', field: 'country' },
              { label: 'TYPE/BIAS', field: null },
              { label: 'TIER', field: 'reliability' },
              { label: 'HEALTH', field: 'lastCrawled' },
              { label: 'ARTICLES', field: 'articleCount' },
              { label: 'SENTIMENT', field: null },
              { label: 'RSS', field: null },
              { label: 'ACTIONS', field: null },
            ].map(({ label, field }) => (
              <th key={label}
                className={`px-3 py-2 text-left text-[9px] tracking-[0.15em] text-muted-foreground/60 ${field ? 'cursor-pointer hover:text-foreground/60' : ''}`}
                onClick={() => field && onSort(field)}>
                <span className="flex items-center gap-1">{label} {field && <SortIcon field={field}/>}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {agencies.map((agency: any) => {
            const health = getSignalHealth(agency.lastCrawled, agency.lastArticleAt);
            const healthCfg = HEALTH_CONFIG[health];
            const tier = getTier(agency.reliability);
            const biasColor = BIAS_COLORS[agency.bias || 'center'] || '#6b7280';
            const typeColor = TYPE_COLORS[agency.type || 'independent'] || '#6b7280';
            const articleCount = agency.articleCount ?? 0;
            const negPct = articleCount > 0 ? Math.round(agency.negativeCount / articleCount * 100) : 0;
            const posPct = articleCount > 0 ? Math.round(agency.positiveCount / articleCount * 100) : 0;
            const feeds = (agency.rssFeeds as string[] || []);
            return (
              <tr key={agency.id}
                onClick={() => onSelect(selectedId === agency.id ? null : agency.id)}
                className={`border-b border-border/40 cursor-pointer transition-colors ${
                  selectedId === agency.id ? 'bg-cyan-500/5' : agency.isActive ? 'hover:bg-foreground/[0.025]' : 'opacity-40 hover:opacity-60'
                }`}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: healthCfg.color }}/>
                    <span className="text-foreground/80 truncate max-w-32">{agency.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{agency.country}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-1">
                    <span className="px-1 py-0.5 rounded text-[9px]" style={{ color: typeColor, backgroundColor: typeColor + '22' }}>
                      {TYPE_LABELS[agency.type || ''] || agency.type}
                    </span>
                    {agency.bias && (
                      <span className="px-1 py-0.5 rounded text-[9px]" style={{ color: biasColor, backgroundColor: biasColor + '22' }}>
                        {BIAS_LABELS[agency.bias]}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2">
                  <span className="px-1.5 py-0.5 rounded text-[9px]" style={{ color: tier.color, backgroundColor: tier.bg }}>{tier.label}</span>
                </td>
                <td className="px-3 py-2">
                  <span className="flex items-center gap-1 text-[9px]" style={{ color: healthCfg.color }}>
                    {healthCfg.icon} {healthCfg.label}
                  </span>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{articleCount.toLocaleString()}</td>
                <td className="px-3 py-2">
                  {articleCount > 0 ? (
                    <div className="flex h-1.5 w-16 rounded-full overflow-hidden gap-px">
                      <div className="bg-red-500/70" style={{ width: `${negPct}%` }}/>
                      <div className="bg-foreground/20" style={{ width: `${100 - negPct - posPct}%` }}/>
                      <div className="bg-green-500/70" style={{ width: `${posPct}%` }}/>
                    </div>
                  ) : <span className="text-muted-foreground/40">—</span>}
                </td>
                <td className="px-3 py-2 text-muted-foreground/80">{feeds.length}</td>
                <td className="px-3 py-2" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center gap-0.5">
                    <button className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/60 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
                      onClick={() => onCrawl(agency.id)} disabled={crawlingId === agency.id}>
                      {crawlingId === agency.id ? <Loader2 size={10} className="animate-spin text-cyan-400"/> : <Play size={10}/>}
                    </button>
                    <button className={`h-6 w-6 flex items-center justify-center rounded transition-colors ${agency.isActive ? 'text-muted-foreground/50 hover:text-yellow-400 hover:bg-yellow-500/10' : 'text-muted-foreground/30 hover:text-green-400 hover:bg-green-500/10'}`}
                      onClick={() => onToggle(agency.id, agency.isActive)}>
                      {agency.isActive ? <PowerOff size={10}/> : <Power size={10}/>}
                    </button>
                    <button className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/50 hover:text-foreground hover:bg-foreground/10 transition-colors"
                      onClick={() => onEdit(agency)}>
                      <Pencil size={10}/>
                    </button>
                    <button className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      onClick={() => onDelete(agency.id, agency.name)}>
                      <Trash2 size={10}/>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Source Detail Panel ───────────────────────────────────────────────────────
function SourceDetailPanel({ agency, onClose, onEdit, onCrawl, crawling, onToggle, onDelete }: any) {
  const feeds = (agency.rssFeeds as string[] || []);
  const health = getSignalHealth(agency.lastCrawled, agency.lastArticleAt);
  const healthCfg = HEALTH_CONFIG[health];
  const tier = getTier(agency.reliability);
  const biasColor = BIAS_COLORS[agency.bias || 'center'] || '#6b7280';
  const typeColor = TYPE_COLORS[agency.type || 'independent'] || '#6b7280';
  const articleCount = agency.articleCount ?? 0;
  const negPct = articleCount > 0 ? Math.round(agency.negativeCount / articleCount * 100) : 0;
  const posPct = articleCount > 0 ? Math.round(agency.positiveCount / articleCount * 100) : 0;
  const neuPct = 100 - negPct - posPct;

  return (
    <div className="w-72 flex-shrink-0 flex flex-col overflow-y-auto bg-card border-l border-border/60">
      {/* Panel header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/60">
        <div className="flex items-center gap-2">
          <Crosshair size={12} className="text-cyan-400"/>
          <span className="text-[10px] font-mono text-cyan-400/80 tracking-wider">SOURCE PROFILE</span>
        </div>
        <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground/70 transition-colors">
          <XCircle size={14}/>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Name + status */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold text-foreground leading-tight">{agency.name}</h3>
            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1" style={{ backgroundColor: healthCfg.color, boxShadow: health === 'hot' ? `0 0 6px ${healthCfg.color}` : 'none' }}/>
          </div>
          {agency.nameAr && <div className="text-xs text-muted-foreground/80 font-arabic mb-2">{agency.nameAr}</div>}
          <div className="flex flex-wrap gap-1.5">
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: tier.color, backgroundColor: tier.bg }}>{tier.label}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: typeColor, backgroundColor: typeColor + '22' }}>{TYPE_LABELS[agency.type || ''] || agency.type}</span>
            {agency.bias && <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: biasColor, backgroundColor: biasColor + '22' }}>{BIAS_LABELS[agency.bias]}</span>}
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex items-center gap-1" style={{ color: healthCfg.color, backgroundColor: healthCfg.bg }}>{healthCfg.icon} {healthCfg.label}</span>
          </div>
        </div>

        {/* Metadata grid */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'COUNTRY', value: agency.country },
            { label: 'LANGUAGE', value: (agency.language || 'en').toUpperCase() },
            { label: 'REGION', value: agency.region },
            { label: 'FOUNDED', value: agency.founded ? String(agency.founded) : '—' },
            { label: 'RELIABILITY', value: `${agency.reliability ?? 50}%` },
            { label: 'RSS FEEDS', value: String(feeds.length) },
          ].map(({ label, value }) => (
            <div key={label} className="bg-foreground/[0.02] rounded p-2 border border-border/40">
              <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider mb-0.5">{label}</div>
              <div className="text-[11px] font-mono text-foreground/70">{value}</div>
            </div>
          ))}
        </div>

        {/* Reliability bar */}
        <div>
          <div className="flex justify-between text-[9px] font-mono text-muted-foreground/60 mb-1">
            <span>RELIABILITY SCORE</span><span>{agency.reliability ?? 50}/100</span>
          </div>
          <div className="h-2 bg-foreground/5 rounded-full overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{
              width: `${agency.reliability ?? 50}%`,
              backgroundColor: (agency.reliability ?? 50) >= 85 ? '#22c55e' : (agency.reliability ?? 50) >= 65 ? '#f59e0b' : '#ef4444'
            }}/>
          </div>
        </div>

        {/* Article stats */}
        <div className="bg-foreground/[0.02] rounded-lg border border-border/40 p-3">
          <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2 flex items-center gap-1.5">
            <FileText size={9}/> SIGNAL INTELLIGENCE
          </div>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className="text-center">
              <div className="text-sm font-bold text-foreground">{articleCount.toLocaleString()}</div>
              <div className="text-[8px] font-mono text-muted-foreground/60">TOTAL</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-red-400">{agency.negativeCount ?? 0}</div>
              <div className="text-[8px] font-mono text-muted-foreground/60">HOSTILE</div>
            </div>
            <div className="text-center">
              <div className="text-sm font-bold text-green-400">{agency.positiveCount ?? 0}</div>
              <div className="text-[8px] font-mono text-muted-foreground/60">POSITIVE</div>
            </div>
          </div>
          {articleCount > 0 && (
            <>
              <div className="flex h-2 rounded-full overflow-hidden gap-px mb-1">
                <div className="bg-red-500/70 transition-all" style={{ width: `${negPct}%` }}/>
                <div className="bg-foreground/20 transition-all" style={{ width: `${neuPct}%` }}/>
                <div className="bg-green-500/70 transition-all" style={{ width: `${posPct}%` }}/>
              </div>
              <div className="flex justify-between text-[8px] font-mono">
                <span className="text-red-400/70">{negPct}% NEG</span>
                <span className="text-muted-foreground/60">{neuPct}% NEU</span>
                <span className="text-green-400/70">{posPct}% POS</span>
              </div>
            </>
          )}
        </div>

        {/* Crawl timing */}
        <div className="bg-foreground/[0.02] rounded-lg border border-border/40 p-3">
          <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2 flex items-center gap-1.5">
            <Clock size={9}/> ACQUISITION TIMING
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-foreground/70">Last crawled</span>
              <span className="text-foreground/60">{relativeTime(agency.lastCrawled)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-foreground/70">Last article</span>
              <span className="text-foreground/60">{relativeTime(agency.lastArticleAt)}</span>
            </div>
            <div className="flex justify-between text-[10px] font-mono">
              <span className="text-muted-foreground/70">Crawl freq</span>
              <span className="text-foreground/60">{agency.crawlFrequency ?? 30}min</span>
            </div>
          </div>
        </div>

        {/* RSS feeds */}
        {feeds.length > 0 && (
          <div>
            <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-2 flex items-center gap-1.5">
              <Rss size={9}/> RSS ENDPOINTS ({feeds.length})
            </div>
            <div className="space-y-1">
              {feeds.map((feed: string, i: number) => (
                <a key={i} href={feed} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-[10px] font-mono text-muted-foreground/80 hover:text-cyan-400 transition-colors truncate">
                  <Rss size={9} className="flex-shrink-0 text-cyan-500/50"/>
                  <span className="truncate">{feed}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Description */}
        {agency.description && (
          <div className="bg-foreground/[0.02] rounded-lg border border-border/40 p-3">
            <div className="text-[9px] font-mono text-muted-foreground/50 tracking-wider mb-1.5 flex items-center gap-1.5">
              <Info size={9}/> INTEL PROFILE
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{agency.description}</p>
          </div>
        )}

        {/* Actions */}
        <div className="space-y-2 pt-1">
          <button onClick={onCrawl} disabled={crawling}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 text-cyan-400 text-[11px] font-mono hover:bg-cyan-500/20 transition-colors disabled:opacity-50">
            {crawling ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
            {crawling ? 'ACQUIRING SIGNAL...' : 'ACQUIRE SIGNAL NOW'}
          </button>
          <div className="grid grid-cols-3 gap-1.5">
            <button onClick={onToggle}
              className={`flex items-center justify-center gap-1 py-1.5 rounded border text-[10px] font-mono transition-colors ${agency.isActive ? 'border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/10' : 'border-green-500/30 text-green-400 hover:bg-green-500/10'}`}>
              {agency.isActive ? <><PowerOff size={10}/> PAUSE</> : <><Power size={10}/> ACTIVATE</>}
            </button>
            <button onClick={() => onEdit(agency)}
              className="flex items-center justify-center gap-1 py-1.5 rounded border border-border text-muted-foreground text-[10px] font-mono hover:bg-foreground/10 transition-colors">
              <Pencil size={10}/> EDIT
            </button>
            <button onClick={onDelete}
              className="flex items-center justify-center gap-1 py-1.5 rounded border border-red-500/25 text-red-400/70 text-[10px] font-mono hover:bg-red-500/10 transition-colors">
              <Trash2 size={10}/> DECOM
            </button>
          </div>
          {agency.website && (
            <a href={agency.website} target="_blank" rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-2 py-1.5 rounded border border-border/70 text-muted-foreground/80 text-[10px] font-mono hover:bg-foreground/5 transition-colors">
              <ExternalLink size={10}/> OPEN SOURCE WEBSITE
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Sources Map Component ─────────────────────────────────────────────────────
// ─── Article frequency color helper ──────────────────────────────────────────
function articleFreqColor(articles: number, maxArticles: number): string {
  if (maxArticles === 0 || articles === 0) return '#374151'; // grey — no articles
  const ratio = Math.min(articles / maxArticles, 1);
  if (ratio < 0.2) return '#1e40af';   // dim blue
  if (ratio < 0.4) return '#0ea5e9';   // cyan
  if (ratio < 0.6) return '#10b981';   // green
  if (ratio < 0.8) return '#f59e0b';   // amber
  return '#ef4444';                     // red — highest volume
}

// ─── MapResizer: calls invalidateSize when the container transitions from display:none ─
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    // Use a ResizeObserver on the map container so that when the parent
    // switches from display:none to display:flex the map gets a proper size.
    const container = map.getContainer();
    const ro = new ResizeObserver(() => {
      if (container.offsetWidth > 0 && container.offsetHeight > 0) {
        map.invalidateSize({ animate: false });
      }
    });
    ro.observe(container);
    // Also fire once immediately in case we are already visible
    setTimeout(() => map.invalidateSize({ animate: false }), 50);
    return () => ro.disconnect();
  }, [map]);
  return null;
}

// ─── Heatmap layer component ──────────────────────────────────────────────────
function ArticleHeatmapLayer({ groups, visible }: { groups: { coords: [number,number]; totalArticles: number }[]; visible: boolean }) {
  const map = useMap();
  const heatRef = useRef<any>(null);
  useEffect(() => {
    if (!visible) {
      if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; }
      return;
    }
    const maxA = Math.max(...groups.map(g => g.totalArticles), 1);
    const data = groups.map(g => [g.coords[0], g.coords[1], g.totalArticles / maxA] as [number, number, number]);
    if (heatRef.current) {
      heatRef.current.setLatLngs(data);
    } else {
      heatRef.current = (L as any).heatLayer(data, {
        radius: 55, blur: 40, maxZoom: 8, max: 1.0, minOpacity: 0.25,
        gradient: { 0.0: '#1e40af', 0.25: '#0ea5e9', 0.5: '#10b981', 0.75: '#f59e0b', 1.0: '#ef4444' },
      }).addTo(map);
    }
    return () => { if (heatRef.current) { map.removeLayer(heatRef.current); heatRef.current = null; } };
  }, [groups, visible, map]);
  return null;
}

// Date window presets (days back from now; 0 = all time)
const DATE_PRESETS = [
  { label: '7D', days: 7 },
  { label: '30D', days: 30 },
  { label: '90D', days: 90 },
  { label: '1Y', days: 365 },
  { label: 'ALL', days: 0 },
];

function SourcesMap({ region, onSwitchToMonitor }: { region: string; onSwitchToMonitor: () => void }) {
  // Date-window state: daysBack=0 means no filter (all time)
  const [daysBack, setDaysBack] = useState(0);
  const dateFrom = useMemo(() => {
    if (daysBack === 0) return undefined;
    const d = new Date();
    d.setDate(d.getDate() - daysBack);
    return d.toISOString();
  }, [daysBack]);
  const { data: agencies, isLoading, refetch: refetchStats } = trpc.agencies.withStats.useQuery(
    { region: region === 'Global' ? undefined : region, dateFrom },
    { staleTime: 30000 }
  );
  const utils = trpc.useUtils();
  const [crawlingCountry, setCrawlingCountry] = useState<string | null>(null);
  const crawlByCountryMutation = trpc.agencies.crawlByCountry.useMutation({
    onSuccess: (data, vars) => {
      const n = data.agenciesCrawled;
      if (n > 0) toast.success(`Crawl started for ${vars.country}`, {
        description: `${n} source${n !== 1 ? 's' : ''} queued`,
        action: { label: 'Open Live Monitor →', onClick: onSwitchToMonitor },
      });
      else toast.info(`No active sources with RSS feeds in ${vars.country}`);
      setCrawlingCountry(null);
      // Refresh stats after a short delay to pick up new articles
      setTimeout(() => { utils.agencies.withStats.invalidate(); }, 3000);
    },
    onError: (e, vars) => { toast.error(`Crawl failed for ${vars.country}`, { description: e.message }); setCrawlingCountry(null); },
  });
  const [selectedType, setSelectedType] = useState('all');
  const [selectedBias, setSelectedBias] = useState('all');
  const [selectedTier, setSelectedTier] = useState('all');
  const [showInactive, setShowInactive] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [baseMap, setBaseMap] = useState<'dark' | 'osm'>('dark');
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [showThreatOverlay, setShowThreatOverlay] = useState(false);
  const [colorMode, setColorMode] = useState<'status' | 'frequency'>('frequency');
  // ── Right-click context menu ────────────────────────────────────────────────
  const [ctxMenu, setCtxMenu] = useState<{ x: number; y: number; country: string; activeCount: number; lastCrawled?: string } | null>(null);
  const mapWrapperRef = useRef<HTMLDivElement>(null);
  // Close on outside click or Escape
  useEffect(() => {
    if (!ctxMenu) return;
    const handleClick = () => setCtxMenu(null);
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCtxMenu(null); };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKey);
    return () => { document.removeEventListener('click', handleClick); document.removeEventListener('keydown', handleKey); };
  }, [ctxMenu]);
  const { data: countryErrorRates } = trpc.agencies.getCountryErrorRates.useQuery(
    { windowHours: 24 },
    { enabled: showThreatOverlay, refetchInterval: 60000, staleTime: 30000 }
  );
  const threatByCountry = useMemo(() => {
    if (!countryErrorRates) return {} as Record<string, number>;
    return Object.fromEntries(
      (countryErrorRates as Array<{ country: string; errorRate: number }>).map(r => [r.country, r.errorRate])
    );
  }, [countryErrorRates]);

  const agencyGroups = useMemo(() => {
    if (!agencies) return [];
    const groups: Record<string, { coords: [number, number]; agencies: typeof agencies }> = {};
    for (const agency of agencies) {
      if (!showInactive && !agency.isActive) continue;
      if (selectedType !== 'all' && agency.type !== selectedType) continue;
      if (selectedBias !== 'all' && agency.bias !== selectedBias) continue;
      if (selectedTier !== 'all' && getTier(agency.reliability).label !== selectedTier) continue;
      if (searchText && !agency.name.toLowerCase().includes(searchText.toLowerCase()) && !agency.country.toLowerCase().includes(searchText.toLowerCase())) continue;
      const coords = COUNTRY_COORDS[agency.country] ?? COUNTRY_COORDS['International'];
      const key = agency.country;
      if (!groups[key]) groups[key] = { coords, agencies: [] };
      groups[key].agencies.push(agency);
    }
    return Object.entries(groups).map(([country, { coords, agencies }]) => ({
      country, coords, agencies,
      totalArticles: agencies.reduce((s, a) => s + ((a as any).articleCount ?? 0), 0),
    }));
  }, [agencies, showInactive, selectedType, selectedBias, selectedTier, searchText]);

  const maxCount = Math.max(...agencyGroups.map(g => g.agencies.length), 1);
  const maxArticles = Math.max(...agencyGroups.map(g => g.totalArticles), 1);
  const totalShown = agencyGroups.reduce((s, g) => s + g.agencies.length, 0);
  const totalAll = agencies?.length ?? 0;
  const totalArticles = agencyGroups.reduce((s, g) => s + g.totalArticles, 0);

  if (isLoading) return (
    <div className="flex items-center justify-center h-full text-muted-foreground/60 font-mono text-xs gap-2">
      <Loader2 size={16} className="animate-spin"/> LOADING GEO-INTELLIGENCE MAP...
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      {/* ── CONTROL BAR ──────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex flex-wrap items-center gap-2 px-4 py-2 border-b border-border/70 bg-background">
        {/* Live count */}
        <div className="flex items-center gap-1.5 mr-1">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"/>
          <span className="text-[10px] font-mono text-muted-foreground/80">
            <span className="text-foreground/70 font-semibold">{totalShown}</span>
            <span className="text-muted-foreground/50">/{totalAll}</span> sources &nbsp;·&nbsp;
            <span className="text-foreground/70 font-semibold">{agencyGroups.length}</span> countries
          </span>
        </div>

        <div className="h-4 w-px bg-foreground/10"/>

        {/* Search */}
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/60"/>
          <input
            value={searchText} onChange={e => setSearchText(e.target.value)}
            placeholder="Search source or country…"
            className="h-7 pl-6 pr-3 w-44 text-[10px] font-mono bg-foreground/5 border border-border/70 text-foreground placeholder:text-muted-foreground/40 rounded focus:outline-none focus:border-cyan-500/40"
          />
        </div>

        {/* Type filter */}
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="h-7 w-28 text-[10px] font-mono bg-foreground/5 border-border/70 text-foreground/60">
            <SelectValue placeholder="TYPE"/>
          </SelectTrigger>
          <SelectContent className="bg-card border-border/70 text-foreground font-mono text-xs">
            <SelectItem value="all">ALL TYPES</SelectItem>
            {Object.entries(TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Bias filter */}
        <Select value={selectedBias} onValueChange={setSelectedBias}>
          <SelectTrigger className="h-7 w-28 text-[10px] font-mono bg-foreground/5 border-border/70 text-foreground/60">
            <SelectValue placeholder="BIAS"/>
          </SelectTrigger>
          <SelectContent className="bg-card border-border/70 text-foreground font-mono text-xs">
            <SelectItem value="all">ALL BIAS</SelectItem>
            {Object.entries(BIAS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Tier filter */}
        <Select value={selectedTier} onValueChange={setSelectedTier}>
          <SelectTrigger className="h-7 w-24 text-[10px] font-mono bg-foreground/5 border-border/70 text-foreground/60">
            <SelectValue placeholder="TIER"/>
          </SelectTrigger>
          <SelectContent className="bg-card border-border/70 text-foreground font-mono text-xs">
            <SelectItem value="all">ALL TIERS</SelectItem>
            <SelectItem value="TIER-1">TIER-1</SelectItem>
            <SelectItem value="TIER-2">TIER-2</SelectItem>
            <SelectItem value="TIER-3">TIER-3</SelectItem>
          </SelectContent>
        </Select>

        {/* Show Inactive toggle */}
        <button
          onClick={() => setShowInactive(v => !v)}
          className={`flex items-center gap-1.5 h-7 px-3 rounded border text-[10px] font-mono transition-colors ${
            showInactive
              ? 'border-amber-500/40 bg-amber-500/10 text-amber-400'
              : 'border-border/70 bg-foreground/5 text-muted-foreground/80 hover:text-foreground/60'
          }`}>
          {showInactive ? <Eye size={10}/> : <EyeOff size={10}/>}
          {showInactive ? 'INCL. INACTIVE' : 'ACTIVE ONLY'}
        </button>

        {/* Article total */}
        <div className="flex items-center gap-1 text-[10px] font-mono text-muted-foreground/80">
          <BarChart3 size={10} className="text-amber-400/60"/>
          <span className="text-amber-400 font-semibold">{totalArticles.toLocaleString()}</span> articles
        </div>

        <div className="h-4 w-px bg-foreground/10"/>

        {/* Date-range window selector */}
        <div className="flex items-center gap-1.5">
          <CalendarRange size={10} className="text-violet-400/60 flex-shrink-0"/>
          <span className="text-[9px] font-mono text-muted-foreground/60">WINDOW:</span>
          <div className="flex items-center gap-0.5 bg-foreground/5 rounded border border-border/70 p-0.5">
            {DATE_PRESETS.map(p => (
              <button key={p.label}
                onClick={() => setDaysBack(p.days)}
                className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
                  daysBack === p.days ? 'bg-violet-500/25 text-violet-300' : 'text-muted-foreground/60 hover:text-foreground/60'
                }`}>{p.label}</button>
            ))}
          </div>
          {daysBack > 0 && (
            <span className="text-[9px] font-mono text-violet-400/60">last {daysBack}d</span>
          )}
        </div>

        <div className="h-4 w-px bg-foreground/10"/>

        {/* Color mode toggle */}
        <div className="flex items-center gap-0.5 bg-foreground/5 rounded border border-border/70 p-0.5">
          <button onClick={() => setColorMode('status')}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
              colorMode === 'status' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground/60 hover:text-foreground/60'
            }`}>STATUS</button>
          <button onClick={() => setColorMode('frequency')}
            className={`px-2 py-1 rounded text-[9px] font-mono transition-colors ${
              colorMode === 'frequency' ? 'bg-amber-500/20 text-amber-400' : 'text-muted-foreground/60 hover:text-foreground/60'
            }`}>FREQ</button>
        </div>

        {/* Heatmap toggle */}
        <button
          onClick={() => setShowHeatmap(v => !v)}
          className={`flex items-center gap-1.5 h-7 px-3 rounded border text-[10px] font-mono transition-colors ${
            showHeatmap
              ? 'border-red-500/40 bg-red-500/10 text-red-400'
              : 'border-border/70 bg-foreground/5 text-muted-foreground/80 hover:text-foreground/60'
          }`}>
          <Layers size={10}/>
          HEATMAP
        </button>
        {/* Threat overlay toggle */}
        <button
          onClick={() => setShowThreatOverlay(v => !v)}
          className={`flex items-center gap-1.5 h-7 px-3 rounded border text-[10px] font-mono transition-colors ${
            showThreatOverlay
              ? 'border-orange-500/40 bg-orange-500/10 text-orange-400'
              : 'border-border/70 bg-foreground/5 text-muted-foreground/80 hover:text-foreground/60'
          }`}>
          <AlertTriangle size={10}/>
          THREAT
        </button>

        {/* Base map toggle */}
        <div className="ml-auto flex items-center gap-0.5 bg-foreground/5 rounded border border-border/70 p-0.5">
          <button onClick={() => setBaseMap('dark')}
            className={`px-2.5 py-1 rounded text-[9px] font-mono transition-colors ${
              baseMap === 'dark' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground/60 hover:text-foreground/60'
            }`}>DARK</button>
          <button onClick={() => setBaseMap('osm')}
            className={`px-2.5 py-1 rounded text-[9px] font-mono transition-colors ${
              baseMap === 'osm' ? 'bg-cyan-500/20 text-cyan-400' : 'text-muted-foreground/60 hover:text-foreground/60'
            }`}>OSM</button>
        </div>

        {/* Reset filters */}
        {(selectedType !== 'all' || selectedBias !== 'all' || selectedTier !== 'all' || searchText || showInactive) && (
          <button
            onClick={() => { setSelectedType('all'); setSelectedBias('all'); setSelectedTier('all'); setSearchText(''); setShowInactive(false); }}
            className="flex items-center gap-1 h-7 px-2.5 rounded border border-red-500/20 text-red-400/60 text-[9px] font-mono hover:border-red-500/40 hover:text-red-400 transition-colors">
            <X size={9}/> RESET
          </button>
        )}
      </div>

      {/* ── MAP ──────────────────────────────────────────────────────────────── */}
      <div className="flex-1 relative" ref={mapWrapperRef}>
        <MapContainer center={[25, 45]} zoom={3} style={{ height: '100%', width: '100%', background: 'var(--background)' }} zoomControl={false}>
          {baseMap === 'dark'
            ? <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" attribution="&copy; CartoDB"/>
            : <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap"/>
          }
          <MapResizer/>
          <ZoomControl position="bottomright"/>
          <ArticleHeatmapLayer groups={agencyGroups} visible={showHeatmap}/>
          {/* Threat overlay: red pulsing circles for countries with high error rates */}
          {showThreatOverlay && Object.entries(threatByCountry).map(([country, errorRate]) => {
            if (errorRate < 0.1) return null; // only show if >10% error rate
            const coords = COUNTRY_COORDS[country] ?? COUNTRY_COORDS['International'];
            const intensity = Math.min(errorRate, 1);
            const color = `rgba(239,68,68,${0.15 + intensity * 0.55})`;
            const borderColor = `rgba(239,68,68,${0.4 + intensity * 0.5})`;
            return (
              <CircleMarker key={`threat-${country}`} center={coords}
                radius={14 + intensity * 20}
                pathOptions={{ fillColor: color, fillOpacity: 1, color: borderColor, weight: 1.5 }}>
                <Popup>
                  <div className="font-mono text-xs">
                    <div className="text-red-400 font-bold mb-1">⚠ THREAT SIGNAL — {country}</div>
                    <div className="text-foreground/70">Error Rate: <span className="text-red-400">{Math.round(errorRate * 100)}%</span></div>
                    <div className="text-muted-foreground text-[10px] mt-1">Last 24h crawl window</div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
          {agencyGroups.map(({ country, coords, agencies, totalArticles: groupArticles }) => {
            const radius = 7 + (agencies.length / maxCount) * 18;
            const activeCount = agencies.filter(a => a.isActive).length;
            const inactiveCount = agencies.length - activeCount;
            const avgReliability = Math.round(agencies.reduce((s, a) => s + (a.reliability ?? 70), 0) / agencies.length);
            const statusColor = activeCount === agencies.length ? '#22d3ee' : activeCount === 0 ? '#6b7280' : '#f59e0b';
            const freqColor = articleFreqColor(groupArticles, maxArticles);
            const color = colorMode === 'frequency' ? freqColor : statusColor;
            const dominantBias = (() => {
              const counts: Record<string, number> = {};
              agencies.forEach(a => { counts[a.bias ?? 'center'] = (counts[a.bias ?? 'center'] ?? 0) + 1; });
              return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'center';
            })();
            return (
              <CircleMarker key={country} center={coords} radius={radius}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.35, weight: 1.5 }}
                eventHandlers={{
                  contextmenu: (e) => {
                    e.originalEvent.preventDefault();
                    const wrapperRect = mapWrapperRef.current?.getBoundingClientRect();
                    const x = e.originalEvent.clientX - (wrapperRect?.left ?? 0);
                    const y = e.originalEvent.clientY - (wrapperRect?.top ?? 0);
                    const lastCrawled = agencies.reduce<string | undefined>((best, a) => {
                      const t = (a as any).lastCrawledAt as string | undefined;
                      if (!t) return best;
                      return !best || t > best ? t : best;
                    }, undefined);
                    setCtxMenu({ x, y, country, activeCount, lastCrawled });
                  },
                }}>
                <Popup className="dark-popup" minWidth={220}>
                  <div className="bg-card text-foreground p-3 rounded-lg font-mono" style={{ minWidth: 220 }}>
                    {/* Header */}
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-cyan-400">{country}</span>
                      <span className="text-[9px] text-muted-foreground/60 tracking-wider">{agencies.length} SOURCE{agencies.length !== 1 ? 'S' : ''}</span>
                    </div>
                    {/* Stats row — now 4 cols including articles */}
                    <div className="grid grid-cols-4 gap-1 mb-2">
                      <div className="bg-foreground/5 rounded p-1.5 text-center">
                        <div className="text-green-400 text-sm font-bold">{activeCount}</div>
                        <div className="text-[8px] text-muted-foreground/60">ACTIVE</div>
                      </div>
                      <div className="bg-foreground/5 rounded p-1.5 text-center">
                        <div className="text-muted-foreground/80 text-sm font-bold">{inactiveCount}</div>
                        <div className="text-[8px] text-muted-foreground/60">INACT.</div>
                      </div>
                      <div className="bg-foreground/5 rounded p-1.5 text-center">
                        <div className="text-amber-400 text-sm font-bold">{avgReliability}%</div>
                        <div className="text-[8px] text-muted-foreground/60">REL.</div>
                      </div>
                      <div className="bg-foreground/5 rounded p-1.5 text-center">
                        <div className="text-red-400 text-sm font-bold">{groupArticles > 999 ? (groupArticles/1000).toFixed(1)+'k' : groupArticles}</div>
                        <div className="text-[8px] text-muted-foreground/60">ARTS.</div>
                      </div>
                    </div>
                    {/* Article frequency bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-[8px] text-muted-foreground/60 mb-0.5">
                        <span>ARTICLE FREQUENCY</span>
                        <span style={{ color }}>{Math.round(groupArticles / maxArticles * 100)}% of peak</span>
                      </div>
                      <div className="h-1.5 bg-foreground/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${Math.round(groupArticles / maxArticles * 100)}%`, background: color }}/>
                      </div>
                    </div>
                    {/* Dominant bias */}
                    <div className="flex items-center gap-1.5 mb-2 px-1.5 py-1 rounded bg-foreground/[0.03] border border-border/40">
                      <span className="text-[9px] text-muted-foreground/60">DOMINANT BIAS</span>
                      <span className="text-[9px] font-semibold ml-auto" style={{ color: BIAS_COLORS[dominantBias] ?? '#888' }}>
                        {BIAS_LABELS[dominantBias] ?? dominantBias}
                      </span>
                    </div>
                    {/* Source list with article counts */}
                    <div className="space-y-0.5 mb-2">
                      {agencies.slice(0, 6).map(a => (
                        <div key={a.id} className="flex items-center gap-1.5 text-[10px]">
                          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${a.isActive ? 'bg-green-400' : 'bg-foreground/20'}`}/>
                          <span className={a.isActive ? 'text-foreground/70' : 'text-muted-foreground/60'}>{a.name}</span>
                          <span className="ml-auto text-[9px] text-amber-400/70">{((a as any).articleCount ?? 0).toLocaleString()}</span>
                        </div>
                      ))}
                      {agencies.length > 6 && (
                        <div className="text-[9px] text-muted-foreground/50 pl-3">+{agencies.length - 6} more sources</div>
                      )}
                    </div>
                    {/* Crawl Now button */}
                    <button
                      onClick={() => {
                        setCrawlingCountry(country);
                        crawlByCountryMutation.mutate({ country, region });
                      }}
                      disabled={crawlingCountry === country}
                      className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded border text-[10px] font-mono transition-colors ${
                        crawlingCountry === country
                          ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-400 cursor-not-allowed'
                          : 'border-border/70 bg-foreground/5 text-muted-foreground hover:border-cyan-500/40 hover:bg-cyan-500/10 hover:text-cyan-400'
                      }`}>
                      {crawlingCountry === country
                        ? <><Loader2 size={10} className="animate-spin"/> CRAWLING {activeCount} SOURCE{activeCount !== 1 ? 'S' : ''}…</>
                        : <><Play size={10}/> CRAWL NOW · {activeCount} ACTIVE SOURCE{activeCount !== 1 ? 'S' : ''}</>
                      }
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
         </MapContainer>

        {/* ── Right-click context menu overlay ─────────────────────────────── */}
        {ctxMenu && (
          <div
            className="absolute z-[2000] min-w-[200px] rounded-lg border border-primary/20 bg-card/95 backdrop-blur-sm shadow-2xl font-mono text-xs overflow-hidden"
            style={{ left: ctxMenu.x, top: ctxMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-border/70 bg-cyan-500/5">
              <div className="flex items-center gap-1.5">
                <Target size={10} className="text-cyan-400"/>
                <span className="text-cyan-400 font-semibold tracking-wider">{ctxMenu.country.toUpperCase()}</span>
              </div>
              <div className="text-[9px] text-muted-foreground/60 mt-0.5">
                {ctxMenu.activeCount} active source{ctxMenu.activeCount !== 1 ? 's' : ''}
                {ctxMenu.lastCrawled && (
                  <> &nbsp;·&nbsp; last crawled {new Date(ctxMenu.lastCrawled).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</>
                )}
              </div>
            </div>
            {/* Actions */}
            <div className="py-1">
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-foreground/70 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                disabled={crawlingCountry === ctxMenu.country || ctxMenu.activeCount === 0}
                onClick={() => {
                  const c = ctxMenu.country;
                  setCtxMenu(null);
                  setCrawlingCountry(c);
                  crawlByCountryMutation.mutate({ country: c, region });
                }}
              >
                {crawlingCountry === ctxMenu.country
                  ? <><Loader2 size={11} className="animate-spin text-cyan-400"/> <span>Crawling…</span></>
                  : <><Play size={11} className="text-cyan-400"/> <span>Crawl all sources in {ctxMenu.country}</span></>
                }
              </button>
              <div className="mx-3 my-0.5 h-px bg-foreground/5"/>
              <button
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-muted-foreground/80 hover:bg-foreground/5 hover:text-foreground/60 transition-colors"
                onClick={() => setCtxMenu(null)}
              >
                <X size={11}/> <span>Dismiss</span>
              </button>
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="absolute bottom-10 left-3 z-[1000] bg-background/90 border border-border/70 rounded-lg px-3 py-2 backdrop-blur-sm">
          {colorMode === 'status' ? (
            <>
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1.5">SIGNAL STATUS</div>
              <div className="space-y-1">
                {[
                  { color: '#22d3ee', label: 'All Active' },
                  { color: 'var(--intel-yellow)', label: 'Mixed' },
                  { color: '#6b7280', label: 'All Inactive' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border" style={{ background: color + '55', borderColor: color }}/>
                    <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1.5">ARTICLE FREQUENCY</div>
              <div className="space-y-1">
                {[
                  { color: 'var(--intel-red)', label: 'Very High' },
                  { color: 'var(--intel-yellow)', label: 'High' },
                  { color: '#10b981', label: 'Medium' },
                  { color: '#0ea5e9', label: 'Low' },
                  { color: '#374151', label: 'None' },
                ].map(({ color, label }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border" style={{ background: color + '55', borderColor: color }}/>
                    <span className="text-[9px] font-mono text-muted-foreground">{label}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="text-[8px] font-mono text-muted-foreground/40 mt-1.5">Marker size = source count</div>
        </div>
      </div>
    </div>
  );
}

// ─── Acquisition Operations Center ────────────────────────────────────────────
// Advanced mission management: create, schedule, and monitor crawl missions
// with per-source targeting, cron scheduling, and live execution logs.

type MissionView = 'dashboard' | 'create' | 'edit' | 'detail';
type MissionPriority = 'low' | 'normal' | 'high' | 'critical';
type MissionClassification = 'UNCLASSIFIED' | 'CONFIDENTIAL' | 'SECRET' | 'TOP SECRET';

const PRIORITY_CONFIG: Record<MissionPriority, { color: string; bg: string; border: string; label: string }> = {
  low:      { color: '#6b7280', bg: '#6b728015', border: '#6b728030', label: 'LOW' },
  normal:   { color: '#22d3ee', bg: '#22d3ee15', border: '#22d3ee30', label: 'NORMAL' },
  high:     { color: 'var(--intel-yellow)', bg: '#f59e0b15', border: '#f59e0b30', label: 'HIGH' },
  critical: { color: 'var(--intel-red)', bg: '#ef444415', border: '#ef444430', label: 'CRITICAL' },
};
const CLASS_CONFIG: Record<MissionClassification, { color: string; bg: string }> = {
  'UNCLASSIFIED': { color: '#22c55e', bg: '#22c55e20' },
  'CONFIDENTIAL': { color: '#3b82f6', bg: '#3b82f620' },
  'SECRET':       { color: 'var(--intel-yellow)', bg: '#f59e0b20' },
  'TOP SECRET':   { color: 'var(--intel-red)', bg: '#ef444420' },
};

const PRESET_SCHEDULES = [
  { label: 'Every 15 min', cron: '*/15 * * * *', minutes: 15 },
  { label: 'Every 30 min', cron: '*/30 * * * *', minutes: 30 },
  { label: 'Every hour',   cron: '0 * * * *',    minutes: 60 },
  { label: 'Every 2h',     cron: '0 */2 * * *',  minutes: 120 },
  { label: 'Every 4h',     cron: '0 */4 * * *',  minutes: 240 },
  { label: 'Every 6h',     cron: '0 */6 * * *',  minutes: 360 },
  { label: 'Every 12h',    cron: '0 */12 * * *', minutes: 720 },
  { label: 'Daily 06:00',  cron: '0 6 * * *',    minutes: 1440 },
  { label: 'Daily 12:00',  cron: '0 12 * * *',   minutes: 1440 },
  { label: 'Custom',       cron: '',              minutes: 0 },
];

const SOURCE_TYPES = ['state','independent','international','digital','broadcast','wire'];
const TOPIC_OPTIONS = ['BREAKING','SECURITY','POLITICS','MILITARY','ECONOMY','DIPLOMACY','ENERGY','CYBER','INTELLIGENCE'];

function formatCronHuman(expr: string): string {
  const preset = PRESET_SCHEDULES.find(p => p.cron === expr);
  if (preset && preset.label !== 'Custom') return preset.label;
  return expr;
}

function formatCountdownMs(ms: number): string {
  if (ms <= 0) return 'DUE NOW';
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const mins = Math.floor((totalSecs % 3600) / 60);
  const secs = totalSecs % 60;
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
}

function MissionCard({ mission, onSelect, onTrigger, onToggle, onDelete, onEdit, isTriggering, bulkMode, isSelected }: {
  mission: any; onSelect: () => void; onTrigger: () => void;
  onToggle: () => void; onDelete: () => void; onEdit: () => void; isTriggering: boolean;
  bulkMode?: boolean; isSelected?: boolean;
}) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Poll live job progress only when mission is running
  const { data: progress } = trpc.missions.getProgress.useQuery(
    { missionId: mission.id },
    { enabled: !!mission.isRunning, refetchInterval: 2500, staleTime: 0 }
  );
  const p = PRIORITY_CONFIG[mission.priority as MissionPriority] ?? PRIORITY_CONFIG.normal;
  const c = CLASS_CONFIG[mission.classification as MissionClassification] ?? CLASS_CONFIG.UNCLASSIFIED;
  const nextMs = mission.nextRunAt ? new Date(mission.nextRunAt).getTime() - now : null;
  const targetCount = [
    ...(mission.targetAgencyIds ?? []),
    ...(mission.targetCountries ?? []),
    ...(mission.targetRegions ?? []),
    ...(mission.targetTypes ?? []),
  ].length;

  return (
    <div className="rounded-xl border bg-background transition-all hover:bg-muted cursor-pointer group relative"
      style={{ borderColor: bulkMode && isSelected ? '#22d3ee' : mission.isActive ? p.border : 'oklch(from var(--foreground) l c h / 0.1)',
               boxShadow: bulkMode && isSelected ? '0 0 0 1px #22d3ee40' : undefined }}
      onClick={onSelect}>
      {/* Bulk-mode checkbox */}
      {bulkMode && (
        <div className="absolute top-2 left-2 z-10 w-4 h-4 rounded border-2 flex items-center justify-center"
          style={{ borderColor: isSelected ? '#22d3ee' : 'oklch(from var(--foreground) l c h / 0.25)', background: isSelected ? '#22d3ee' : 'transparent' }}>
          {isSelected && <svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l3 3 5-6" stroke="#000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </div>
      )}
      <div className="flex items-center justify-between px-4 py-2.5 border-b"
        style={{ borderColor: mission.isActive ? p.border : '#ffffff10', background: mission.isActive ? p.bg : 'transparent' }}>
        <div className="flex items-center gap-2 min-w-0">
          {mission.isRunning && progress?.isActive ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <div className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"/>
              <span className="text-[8px] font-mono text-yellow-300 tracking-wider whitespace-nowrap">
                CRAWLING · {progress.pending + progress.running}/{progress.total}
              </span>
            </div>
          ) : (
            <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${mission.isRunning ? 'animate-pulse bg-yellow-400' : mission.isActive ? 'bg-green-400' : 'bg-foreground/20'}`}/>
          )}
          <span className="text-[10px] font-mono font-bold tracking-[0.15em] truncate" style={{ color: p.color }}>
            {mission.codename || mission.name}
          </span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded flex-shrink-0" style={{ color: c.color, background: c.bg }}>
            {mission.classification === 'TOP SECRET' ? 'TS' : mission.classification?.slice(0,4)}
          </span>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onClick={e => { e.stopPropagation(); onTrigger(); }}
            disabled={isTriggering || !!mission.isRunning}
            className="p-1 rounded hover:bg-foreground/10 text-green-400 disabled:opacity-40" title="Execute Now">
            {isTriggering ? <Loader2 size={11} className="animate-spin"/> : <Play size={11}/>}
          </button>
          <button
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded hover:bg-cyan-500/20 text-cyan-400/60 hover:text-cyan-400" title="Edit Mission">
            <Pencil size={11}/>
          </button>
          <button
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onClick={e => { e.stopPropagation(); onToggle(); }}
            className={`p-1 rounded hover:bg-foreground/10 ${mission.isActive ? 'text-yellow-400' : 'text-green-400'}`} title={mission.isActive ? 'Pause' : 'Activate'}>
            {mission.isActive ? <PowerOff size={11}/> : <Power size={11}/>}
          </button>
          <button
            onMouseDown={e => { e.stopPropagation(); e.preventDefault(); }}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1 rounded hover:bg-red-500/20 text-red-400/60 hover:text-red-400" title="Delete">
            <Trash2 size={11}/>
          </button>
        </div>
      </div>

      <div className="px-4 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono text-foreground/60 truncate">{mission.name}</span>
          <span className="text-[9px] font-mono px-1.5 py-0.5 rounded border flex-shrink-0 ml-2" style={{ color: p.color, borderColor: p.border }}>
            {p.label}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Clock size={9} className="text-cyan-400/60 flex-shrink-0"/>
          <span className="text-[9px] font-mono text-cyan-400/80">{formatCronHuman(mission.cronExpression)}</span>
          {mission.isRecurring && <RotateCcw size={8} className="text-cyan-400/40"/>}
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center bg-foreground/[0.03] rounded p-1.5">
            <div className="text-sm font-bold font-mono text-foreground/80">{mission.totalRuns ?? 0}</div>
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider">RUNS</div>
          </div>
          <div className="text-center bg-foreground/[0.03] rounded p-1.5">
            <div className="text-sm font-bold font-mono text-green-400">{mission.totalArticlesCollected ?? 0}</div>
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider">ARTICLES</div>
          </div>
          <div className="text-center bg-foreground/[0.03] rounded p-1.5">
            <div className="text-sm font-bold font-mono text-blue-400">{targetCount || 'ALL'}</div>
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider">TARGETS</div>
          </div>
        </div>

         {/* Sparkline — last 10 run yields */}
        <MissionSparkline missionId={mission.id} />
        <div className="flex items-center justify-between text-[9px] font-mono">
          <span className="text-muted-foreground/50">NEXT RUN</span>
          <span className={nextMs !== null && nextMs > 0 ? 'text-cyan-400' : 'text-yellow-400'}>
            {mission.isActive && nextMs !== null ? formatCountdownMs(nextMs) : mission.isActive ? 'SCHEDULING...' : 'PAUSED'}
          </span>
        </div>
      </div>
    </div>
  );
}

function MissionSparkline({ missionId }: { missionId: number }) {
  const { data: points = [] } = trpc.missions.getSparkline.useQuery(
    { missionId, limit: 10 },
    { refetchInterval: 30000 }
  );
  if (points.length === 0) {
    return (
      <div className="h-8 flex items-center justify-center">
        <span className="text-[8px] font-mono text-muted-foreground/30 tracking-wider">NO RUN DATA</span>
      </div>
    );
  }
  const maxVal = Math.max(...points.map(p => p.articles), 1);
  const W = 200, H = 32, PAD = 2;
  const xs = points.map((_, i) => PAD + (i / Math.max(points.length - 1, 1)) * (W - PAD * 2));
  const ys = points.map(p => H - PAD - ((p.articles / maxVal) * (H - PAD * 2)));
  const pathD = points.length === 1
    ? `M ${xs[0]} ${ys[0]}`
    : xs.map((x, i) => (i === 0 ? `M ${x} ${ys[i]}` : `L ${x} ${ys[i]}`)).join(' ');
  const fillD = `${pathD} L ${xs[xs.length - 1]} ${H} L ${xs[0]} ${H} Z`;
  return (
    <div className="relative" title={`Last ${points.length} runs — peak ${maxVal} articles`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-8" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`sg-${missionId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.3"/>
            <stop offset="100%" stopColor="#22d3ee" stopOpacity="0"/>
          </linearGradient>
        </defs>
        <path d={fillD} fill={`url(#sg-${missionId})`}/>
        <path d={pathD} stroke="#22d3ee" strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round"/>
        {points.map((p, i) => (
          <circle key={i} cx={xs[i]} cy={ys[i]} r="2"
            fill={p.status === 'failed' ? '#f87171' : p.articles === 0 ? '#fbbf24' : '#22d3ee'}
          />
        ))}
      </svg>
      <div className="flex justify-between mt-0.5">
        <span className="text-[7px] font-mono text-muted-foreground/30">YIELD / RUN</span>
        <span className="text-[7px] font-mono text-cyan-400/50">↑{maxVal}</span>
      </div>
    </div>
  );
}

function MissionBuilder({ region, agencies, onCreated, onCancel, existingMission }: {
  region: string; agencies: any[]; onCreated: () => void; onCancel: () => void;
  existingMission?: any;
}) {
  const isEditing = !!existingMission;
  // Derive initial values from existingMission (edit) or defaults (create)
  const initPreset = (cron: string) => {
    const idx = PRESET_SCHEDULES.findIndex(p => p.cron === cron && p.label !== 'Custom');
    return idx >= 0 ? idx : PRESET_SCHEDULES.length - 1;
  };
  const initTargetMode = (m: any): 'all' | 'region' | 'type' | 'manual' => {
    if ((m?.targetAgencyIds?.length ?? 0) > 0) return 'manual';
    if ((m?.targetRegions?.length ?? 0) > 0) return 'region';
    if ((m?.targetTypes?.length ?? 0) > 0) return 'type';
    return 'all';
  };
  const [name, setName] = useState(existingMission?.name ?? '');
  const [codename, setCodename] = useState(existingMission?.codename ?? '');
  const [description, setDescription] = useState(existingMission?.description ?? '');
  const [priority, setPriority] = useState<MissionPriority>(existingMission?.priority ?? 'normal');
  const [classification, setClassification] = useState<MissionClassification>(existingMission?.classification ?? 'UNCLASSIFIED');
  const [isRecurring, setIsRecurring] = useState(existingMission?.isRecurring ?? true);
  const [selectedPreset, setSelectedPreset] = useState(() => existingMission ? initPreset(existingMission.cronExpression) : 2);
  const [customCron, setCustomCron] = useState(() => existingMission && initPreset(existingMission.cronExpression) === PRESET_SCHEDULES.length - 1 ? existingMission.cronExpression : '');
  const [targetMode, setTargetMode] = useState<'all' | 'region' | 'type' | 'manual'>(() => existingMission ? initTargetMode(existingMission) : 'all');
  const [selectedAgencyIds, setSelectedAgencyIds] = useState<number[]>(existingMission?.targetAgencyIds ?? []);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(existingMission?.targetRegions?.length ? existingMission.targetRegions : [region]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(existingMission?.targetTypes ?? []);
  const [selectedTopics, setSelectedTopics] = useState<string[]>(existingMission?.targetTopics ?? []);
  const [minArticlesPerRun, setMinArticlesPerRun] = useState<number>(existingMission?.minArticlesPerRun ?? 0);
  const [agencySearch, setAgencySearch] = useState('');

  const createMission = trpc.missions.create.useMutation({
    onSuccess: () => { toast.success('Mission created', { description: `"${name}" is now scheduled`}); onCreated(); },
    onError: (e) => toast.error('Mission creation failed', { description: e.message }),
  });
  const updateMission = trpc.missions.update.useMutation({
    onSuccess: () => { toast.success('Mission updated', { description: `"${name}" has been updated`}); onCreated(); },
    onError: (e) => toast.error('Mission update failed', { description: e.message }),
  });

  // RSS feed health check
  const [feedHealthResults, setFeedHealthResults] = useState<Array<{ url: string; agencyId?: number; agencyName?: string; ok: boolean; status: number; error: string | null }> | null>(null);
  const checkFeedsMutation = trpc.missions.checkFeeds.useMutation({
    onSuccess: (results) => {
      setFeedHealthResults(results);
      const broken = results.filter(r => !r.ok).length;
      if (broken === 0) toast.success('All feeds healthy', { description: `${results.length} feeds checked` });
      else toast.warning(`${broken} broken feed${broken > 1 ? 's' : ''} detected`, { description: 'Review feed status below before saving' });
    },
    onError: (e) => toast.error('Health check failed', { description: e.message }),
  });

  const handleCheckFeeds = () => {
    const agencyIds = targetMode === 'manual' ? selectedAgencyIds : agencies.map((a: any) => a.id);
    if (!agencyIds.length) { toast.info('No agencies selected to check'); return; }
    setFeedHealthResults(null);
    checkFeedsMutation.mutate({ agencyIds });
  };

  const cronExpr = selectedPreset < PRESET_SCHEDULES.length - 1
    ? PRESET_SCHEDULES[selectedPreset].cron
    : customCron;

  const filteredAgencies = useMemo(() =>
    agencies.filter(a => !agencySearch || a.name.toLowerCase().includes(agencySearch.toLowerCase()) || (a.country ?? '').toLowerCase().includes(agencySearch.toLowerCase())),
    [agencies, agencySearch]
  );

  const allRegions = useMemo(() => Array.from(new Set(agencies.map((a: any) => a.region).filter(Boolean))), [agencies]);

  const toggleAgency = (id: number) => setSelectedAgencyIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  const toggleTopic = (t: string) => setSelectedTopics(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleType = (t: string) => setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleRegion = (r: string) => setSelectedRegions(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]);

  const handleSave = () => {
    if (!name.trim()) { toast.error('Mission name is required'); return; }
    if (!cronExpr.trim()) { toast.error('Schedule is required'); return; }
    const payload = {
      name: name.trim(),
      codename: codename.trim() || undefined,
      description: description.trim() || undefined,
      priority, classification, isRecurring,
      cronExpression: cronExpr,
      targetAgencyIds: targetMode === 'manual' ? selectedAgencyIds : [],
      targetRegions: targetMode === 'region' ? selectedRegions : [],
      targetTypes: targetMode === 'type' ? selectedTypes : [],
      targetTopics: selectedTopics,
      minArticlesPerRun,
    };
    if (isEditing) {
      updateMission.mutate({ id: existingMission.id, ...payload });
    } else {
      createMission.mutate(payload);
    }
  };

  const p = PRIORITY_CONFIG[priority];

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-5 bg-background">
      <div className="flex items-center gap-3">
        <button onClick={onCancel} className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground/80 hover:text-foreground/80">
          <ChevronLeft size={14}/>
        </button>
        <div className="flex items-center gap-2">
          <Target size={14} className="text-cyan-400"/>
          <h2 className="text-xs font-mono font-bold text-foreground tracking-[0.15em]">{isEditing ? 'EDIT ACQUISITION MISSION' : 'NEW ACQUISITION MISSION'}</h2>
        </div>
      </div>

      <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <FileText size={12} className="text-cyan-400"/>
          <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">MISSION IDENTITY</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">MISSION NAME *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. MENA Daily Sweep"
              className="h-8 text-[11px] font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
          </div>
          <div>
            <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">CODENAME (OPTIONAL)</label>
            <Input value={codename} onChange={e => setCodename(e.target.value.toUpperCase())} placeholder="e.g. OPERATION NIGHTWATCH"
              className="h-8 text-[11px] font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
          </div>
        </div>
        <div>
          <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">DESCRIPTION</label>
          <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Mission objective and scope..."
            className="h-8 text-[11px] font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">PRIORITY LEVEL</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(PRIORITY_CONFIG) as MissionPriority[]).map(lvl => (
                <button key={lvl} onClick={() => setPriority(lvl)}
                  className="px-2.5 py-1 rounded text-[9px] font-mono border transition-all"
                  style={{
                    color: priority === lvl ? PRIORITY_CONFIG[lvl].color : 'oklch(from var(--foreground) l c h / 0.25)',
                    borderColor: priority === lvl ? PRIORITY_CONFIG[lvl].border : 'oklch(from var(--foreground) l c h / 0.1)',
                    background: priority === lvl ? PRIORITY_CONFIG[lvl].bg : 'transparent',
                  }}>
                  {PRIORITY_CONFIG[lvl].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">CLASSIFICATION</label>
            <div className="flex gap-1.5 flex-wrap">
              {(Object.keys(CLASS_CONFIG) as MissionClassification[]).map(cls => (
                <button key={cls} onClick={() => setClassification(cls)}
                  className="px-2 py-1 rounded text-[9px] font-mono border transition-all"
                  style={{
                    color: classification === cls ? CLASS_CONFIG[cls].color : 'oklch(from var(--foreground) l c h / 0.25)',
                    borderColor: classification === cls ? CLASS_CONFIG[cls].color + '40' : 'oklch(from var(--foreground) l c h / 0.1)',
                    background: classification === cls ? CLASS_CONFIG[cls].bg : 'transparent',
                  }}>
                  {cls === 'TOP SECRET' ? 'TS' : cls.slice(0,4)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-primary/15 bg-cyan-500/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CalendarRange size={12} className="text-cyan-400"/>
            <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">ACQUISITION SCHEDULE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-mono text-muted-foreground/60">RECURRING</span>
            <button onClick={() => setIsRecurring(!isRecurring)}
              className={`w-8 h-4 rounded-full border transition-all relative ${isRecurring ? 'bg-cyan-500/30 border-cyan-500/50' : 'bg-foreground/5 border-border'}`}>
              <div className={`absolute top-0.5 w-3 h-3 rounded-full transition-all ${isRecurring ? 'left-4 bg-cyan-400' : 'left-0.5 bg-foreground/30'}`}/>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {PRESET_SCHEDULES.map((preset, i) => (
            <button key={i} onClick={() => setSelectedPreset(i)}
              className={`px-2 py-2 rounded text-[9px] font-mono border transition-all text-left ${
                selectedPreset === i
                  ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-400'
                  : 'border-border/60 bg-foreground/[0.02] text-muted-foreground/80 hover:text-foreground/70 hover:border-border'
              }`}>
              {preset.label}
            </button>
          ))}
        </div>

        {selectedPreset === PRESET_SCHEDULES.length - 1 && (
          <div>
            <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1 block">CRON EXPRESSION (5-field)</label>
            <Input value={customCron} onChange={e => setCustomCron(e.target.value)} placeholder="*/30 * * * *"
              className="h-8 text-[11px] font-mono bg-foreground/5 border-border/70 text-cyan-400 placeholder:text-muted-foreground/40"/>
            <p className="text-[9px] font-mono text-muted-foreground/50 mt-1">Format: min hour day month weekday</p>
          </div>
        )}

        {cronExpr && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/5 border border-primary/15">
            <Clock size={10} className="text-cyan-400"/>
            <span className="text-[10px] font-mono text-cyan-400">{cronExpr}</span>
            <span className="text-[9px] font-mono text-muted-foreground/60 ml-auto">{formatCronHuman(cronExpr)}</span>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Crosshair size={12} className="text-orange-400"/>
          <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">TARGET SELECTION</span>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {[
            { mode: 'all', label: 'ALL ACTIVE', icon: <Globe size={9}/> },
            { mode: 'region', label: 'BY REGION', icon: <Layers size={9}/> },
            { mode: 'type', label: 'BY TYPE', icon: <Network size={9}/> },
            { mode: 'manual', label: 'MANUAL', icon: <Crosshair size={9}/> },
          ].map(({ mode, label, icon }) => (
            <button key={mode} onClick={() => setTargetMode(mode as any)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-[9px] font-mono border transition-all ${
                targetMode === mode
                  ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
                  : 'border-border/60 text-muted-foreground/70 hover:text-foreground/60 hover:border-border'
              }`}>
              {icon} {label}
            </button>
          ))}
        </div>

        {targetMode === 'all' && (
          <div className="px-3 py-2 rounded-lg bg-green-500/5 border border-primary/15 text-[10px] font-mono text-green-400">
            All {agencies.filter((a: any) => a.isActive).length} active sources will be crawled
          </div>
        )}

        {targetMode === 'region' && (
          <div className="flex flex-wrap gap-1.5">
            {(allRegions as string[]).map((r: string) => (
              <button key={r} onClick={() => toggleRegion(r)}
                className={`px-2.5 py-1 rounded text-[9px] font-mono border transition-all ${
                  selectedRegions.includes(r)
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
                    : 'border-border/60 text-muted-foreground/70 hover:text-foreground/60'
                }`}>{r}</button>
            ))}
          </div>
        )}

        {targetMode === 'type' && (
          <div className="flex flex-wrap gap-1.5">
            {SOURCE_TYPES.map(t => (
              <button key={t} onClick={() => toggleType(t)}
                className={`px-2.5 py-1 rounded text-[9px] font-mono border transition-all uppercase ${
                  selectedTypes.includes(t)
                    ? 'border-orange-500/50 bg-orange-500/15 text-orange-400'
                    : 'border-border/60 text-muted-foreground/70 hover:text-foreground/60'
                }`}>{t}</button>
            ))}
          </div>
        )}

        {targetMode === 'manual' && (
          <div className="space-y-2">
            <Input value={agencySearch} onChange={e => setAgencySearch(e.target.value)} placeholder="Search sources..."
              className="h-7 text-[10px] font-mono bg-foreground/5 border-border/70 text-foreground placeholder:text-muted-foreground/40"/>
            <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
              {filteredAgencies.slice(0, 50).map((a: any) => (
                <button key={a.id} onClick={() => toggleAgency(a.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded text-[9px] font-mono border transition-all text-left ${
                    selectedAgencyIds.includes(a.id)
                      ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                      : 'border-border/40 text-muted-foreground/80 hover:text-foreground/70 hover:border-border'
                  }`}>
                  {selectedAgencyIds.includes(a.id) ? <CheckCircle2 size={9}/> : <XCircle size={9} className="opacity-30"/>}
                  <span className="truncate">{a.name}</span>
                  <span className="ml-auto text-muted-foreground/50 flex-shrink-0">{a.country}</span>
                </button>
              ))}
            </div>
            {selectedAgencyIds.length > 0 && (
              <div className="text-[9px] font-mono text-orange-400">{selectedAgencyIds.length} source{selectedAgencyIds.length !== 1 ? 's' : ''} selected</div>
            )}
          </div>
        )}

        <div>
          <label className="text-[9px] font-mono text-muted-foreground/60 tracking-wider mb-1.5 block">INTELLIGENCE TOPICS (OPTIONAL)</label>
          <div className="flex flex-wrap gap-1.5">
            {TOPIC_OPTIONS.map(t => (
              <button key={t} onClick={() => toggleTopic(t)}
                className={`px-2 py-0.5 rounded text-[9px] font-mono border transition-all ${
                  selectedTopics.includes(t)
                    ? 'border-violet-500/50 bg-violet-500/15 text-violet-400'
                    : 'border-border/60 text-muted-foreground/60 hover:text-foreground/60'
                }`}>{t}</button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-orange-500/20 bg-orange-500/5 p-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={11} className="text-orange-400"/>
            <label className="text-[9px] font-mono text-orange-400/80 tracking-wider">YIELD THRESHOLD ALERT</label>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[9px] font-mono text-muted-foreground/60 mb-2">Fire owner alert if a run yields fewer than this many new articles. Set to 0 to disable.</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number" min={0} max={10000}
                  value={minArticlesPerRun}
                  onChange={e => setMinArticlesPerRun(Math.max(0, parseInt(e.target.value) || 0))}
                  className="h-7 text-[10px] font-mono bg-black/30 border-border/70 text-orange-300 w-28"
                />
                <span className="text-[9px] font-mono text-muted-foreground/50">min articles / run</span>
                {minArticlesPerRun > 0 && (
                  <span className="text-[9px] font-mono text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded border border-orange-500/20">
                    ALERT ACTIVE
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Feed Health Check Results */}
      {feedHealthResults && feedHealthResults.length > 0 && (
        <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Rss size={12} className="text-cyan-400"/>
            <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">FEED HEALTH CHECK</span>
            <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">
              {feedHealthResults.filter(r => r.ok).length}/{feedHealthResults.length} OK
            </span>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
            {feedHealthResults.map((r, i) => (
              <div key={i} className={`flex items-center gap-2 px-2.5 py-1.5 rounded text-[9px] font-mono border ${
                r.ok ? 'bg-green-500/5 border-primary/15' : 'bg-red-500/5 border-red-500/20'
              }`}>
                <span className={r.ok ? 'text-green-400' : 'text-red-400'} style={{ flexShrink: 0 }}>
                  {r.ok ? '✓' : '✗'}
                </span>
                {r.agencyName && (
                  <span className="text-muted-foreground flex-shrink-0">{r.agencyName}</span>
                )}
                <span className={`truncate flex-1 ${r.ok ? 'text-muted-foreground/80' : 'text-foreground/60'}`}>{r.url}</span>
                <span className={`flex-shrink-0 ${r.ok ? 'text-green-400/60' : 'text-red-400'}`}>
                  {r.status > 0 ? `HTTP ${r.status}` : r.error?.slice(0, 30) ?? 'TIMEOUT'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3 pb-4">
        <Button variant="outline" onClick={onCancel} className="flex-1 h-9 text-[10px] font-mono border-border text-muted-foreground hover:text-foreground/80">
          CANCEL
        </Button>
        <Button variant="outline" onClick={handleCheckFeeds} disabled={checkFeedsMutation.isPending}
          className="h-9 text-[10px] font-mono gap-1.5 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
          {checkFeedsMutation.isPending ? <Loader2 size={10} className="animate-spin"/> : <Rss size={10}/>}
          {checkFeedsMutation.isPending ? 'CHECKING...' : 'CHECK FEEDS'}
        </Button>
        <Button onClick={handleSave} disabled={(isEditing ? updateMission.isPending : createMission.isPending) || !name.trim() || !cronExpr.trim()}
          className="flex-1 h-9 text-[10px] font-mono gap-1.5"
          style={{ background: p.bg, borderColor: p.border, color: p.color, border: '1px solid' }}>
          {(isEditing ? updateMission.isPending : createMission.isPending) ? <Loader2 size={11} className="animate-spin"/> : <Target size={11}/>}
          {isEditing
            ? (updateMission.isPending ? 'UPDATING...' : 'UPDATE MISSION')
            : (createMission.isPending ? 'DEPLOYING...' : 'DEPLOY MISSION')}
        </Button>
      </div>
    </div>
  );
}

function MissionDetail({ missionId, onBack, onCrawlStart }: { missionId: number; onBack: () => void; onCrawlStart?: () => void }) {
  const { data: runs, refetch } = trpc.missions.getRuns.useQuery({ missionId, limit: 30 }, { refetchInterval: 5000 });
  const utils = trpc.useUtils();
  const markInterrupted = trpc.missions.markRunInterrupted.useMutation({
    onSuccess: () => { refetch(); utils.missions.list.invalidate(); },
  });
  const { data: missions } = trpc.missions.list.useQuery(undefined, { refetchInterval: 5000 });
  const mission = missions?.find(m => m.id === missionId);

  // Completion toast: track the latest run ID before trigger, then poll until a newer completed run appears
  const [waitingForRunId, setWaitingForRunId] = useState<number | null>(null);
  const [triggerTs, setTriggerTs] = useState<number | null>(null);
  const { data: latestRunSummary } = trpc.missions.getLatestRunSummary.useQuery(
    { missionId },
    { refetchInterval: waitingForRunId !== null ? 3000 : false, enabled: waitingForRunId !== null }
  );
  useEffect(() => {
    if (waitingForRunId === null || !latestRunSummary || !triggerTs) return;
    // A new completed run appeared after our trigger timestamp
    const runCompletedAt = latestRunSummary.completedAt ? new Date(latestRunSummary.completedAt).getTime() : 0;
    if (latestRunSummary.id !== waitingForRunId && runCompletedAt > triggerTs) {
      const { status, agenciesCrawled, articlesFound, articlesNew, errorMessage } = latestRunSummary;
      const isOk = status === 'completed' || status === 'partial';
      const icon = isOk ? '✓' : '✗';
      const headline = isOk ? 'Mission complete' : `Mission ${status}`;
      const body = [
        agenciesCrawled ? `${agenciesCrawled} sources` : null,
        articlesFound ? `${articlesFound} found` : null,
        articlesNew ? `${articlesNew} new` : null,
        !isOk && errorMessage ? errorMessage.slice(0, 80) : null,
      ].filter(Boolean).join(' · ');
      if (isOk) toast.success(`${icon} ${headline}`, { description: body, duration: 8000 });
      else toast.error(`${icon} ${headline}`, { description: body, duration: 8000 });
      setWaitingForRunId(null);
      setTriggerTs(null);
      refetch();
    }
  }, [latestRunSummary, waitingForRunId, triggerTs]);

  const triggerMutation = trpc.missions.triggerNow.useMutation({
    onSuccess: () => {
      toast.success('Mission executing', { description: 'Check Live Monitor for progress' });
      // Capture the current latest run ID so we can detect when a newer one completes
      const currentLatestId = runs && runs.length > 0 ? Math.max(...runs.map(r => r.id)) : -1;
      setWaitingForRunId(currentLatestId);
      setTriggerTs(Date.now());
      refetch();
      onCrawlStart?.();
    },
    onError: (e) => toast.error('Trigger failed', { description: e.message }),
  });
  const toggleActiveMutation = trpc.missions.update.useMutation({
    onMutate: async ({ id, isActive }) => {
      await utils.missions.list.cancel();
      const prev = utils.missions.list.getData();
      utils.missions.list.setData(undefined, (old) =>
        old?.map(m => m.id === id ? { ...m, isActive: isActive ?? m.isActive } : m)
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => { utils.missions.list.setData(undefined, ctx?.prev); toast.error('Toggle failed'); },
    onSettled: () => utils.missions.list.invalidate(),
  });

  if (!mission) return null;
  const p = PRIORITY_CONFIG[mission.priority as MissionPriority] ?? PRIORITY_CONFIG.normal;

  return (
    <div className="flex flex-col h-full overflow-y-auto px-6 py-5 space-y-5 bg-background">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-1.5 rounded hover:bg-foreground/10 text-muted-foreground/80 hover:text-foreground/80">
          <ChevronLeft size={14}/>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-foreground truncate">{mission.codename || mission.name}</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded" style={{ color: p.color, background: p.bg }}>
              {p.label}
            </span>
          </div>
          <div className="text-[9px] font-mono text-muted-foreground/60">{mission.name} · {formatCronHuman(mission.cronExpression)}</div>
        </div>
        {/* Active toggle */}
        <button
          onClick={() => toggleActiveMutation.mutate({ id: missionId, isActive: !mission.isActive })}
          disabled={toggleActiveMutation.isPending}
          title={mission.isActive ? 'Click to pause scheduled runs' : 'Click to enable scheduled runs'}
          className={`flex items-center gap-1.5 h-7 px-2.5 rounded border font-mono text-[9px] transition-colors ${
            mission.isActive
              ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20'
              : 'bg-foreground/5 border-border/70 text-muted-foreground/60 hover:bg-foreground/10 hover:text-muted-foreground'
          }`}>
          {toggleActiveMutation.isPending
            ? <Loader2 size={9} className="animate-spin"/>
            : mission.isActive ? <Power size={9}/> : <PowerOff size={9}/>}
          {mission.isActive ? 'ACTIVE' : 'PAUSED'}
        </button>
        <Button onClick={() => triggerMutation.mutate({ id: missionId })} disabled={triggerMutation.isPending}
          className="h-7 text-[9px] font-mono gap-1 bg-green-500/15 hover:bg-green-500/25 border border-green-500/30 text-green-400">
          {triggerMutation.isPending ? <Loader2 size={9} className="animate-spin"/> : <Play size={9}/>}
          EXECUTE NOW
        </Button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'TOTAL RUNS', value: mission.totalRuns ?? 0, color: 'text-cyan-400' },
          { label: 'ARTICLES', value: mission.totalArticlesCollected ?? 0, color: 'text-green-400' },
          { label: 'STATUS', value: mission.isRunning ? 'RUNNING' : mission.isActive ? 'ACTIVE' : 'PAUSED', color: mission.isRunning ? 'text-yellow-400' : mission.isActive ? 'text-green-400' : 'text-muted-foreground/60' },
          { label: 'SCHEDULE', value: formatCronHuman(mission.cronExpression), color: 'text-violet-400' },
        ].map(({ label, value, color }) => (
          <div key={label} className="text-center bg-foreground/[0.02] rounded-lg p-3 border border-border/40">
            <div className={`text-sm font-bold font-mono ${color} truncate`}>{value}</div>
            <div className="text-[8px] font-mono text-muted-foreground/50 tracking-wider mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
        <div className="flex items-center gap-2 mb-3">
          <Activity size={12} className="text-green-400"/>
          <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">EXECUTION LOG</span>
          <span className="text-[9px] font-mono text-muted-foreground/50 ml-auto">{runs?.length ?? 0} runs</span>
        </div>
        {!runs || runs.length === 0 ? (
          <div className="text-center py-8 text-[10px] font-mono text-muted-foreground/40">NO EXECUTION HISTORY</div>
        ) : (
          <div className="space-y-1.5 max-h-80 overflow-y-auto pr-1">
            {[...runs].reverse().map(run => (
              <div key={run.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-foreground/[0.02] border border-border/40">
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                  run.status === 'completed' ? 'bg-green-400' :
                  run.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                  run.status === 'partial' ? 'bg-orange-400' :
                  run.status === 'interrupted' ? 'bg-orange-500' : 'bg-red-400'
                }`}/>
                <span className="text-[9px] font-mono text-muted-foreground flex-shrink-0">
                  {new Date(run.startedAt).toLocaleString()}
                </span>
                <span className={`text-[9px] font-mono flex-shrink-0 ${
                  run.status === 'completed' ? 'text-green-400' :
                  run.status === 'running' ? 'text-yellow-400' :
                  run.status === 'partial' ? 'text-orange-400' :
                  run.status === 'interrupted' ? 'text-orange-400' : 'text-red-400'
                }`}>{run.status?.toUpperCase()}</span>
                <span className="text-[9px] font-mono text-muted-foreground/60">
                  {run.agenciesCrawled ?? 0} src · {run.articlesNew ?? 0} new
                </span>
                {run.status === 'running' && (
                  <button
                    className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded text-[8px] font-mono font-bold text-red-400 border border-red-500/40 hover:bg-red-500/10 transition-colors"
                    onClick={() => { if (confirm('Force-stop this run and mark it as INTERRUPTED?')) markInterrupted.mutate({ runId: run.id }); }}
                    title="Force stop this run">
                    ⏹ FORCE STOP
                  </button>
                )}
                {run.status !== 'running' && (
                  <span className="ml-auto text-[9px] font-mono text-muted-foreground/40">
                    {run.status === 'interrupted' ? '⚡ interrupted' : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function AcquisitionCenter({ region, onCrawlStart }: { region: string; onCrawlStart?: () => void }) {
  const [view, setView] = useState<MissionView>('dashboard');
  const [selectedMissionId, setSelectedMissionId] = useState<number | null>(null);
  const [editingMission, setEditingMission] = useState<any | null>(null);
  const [triggeringId, setTriggeringId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkMode, setBulkMode] = useState(false);

  const { data: missions, refetch } = trpc.missions.list.useQuery(undefined, { refetchInterval: 8000 });
  const { data: agencies } = trpc.agencies.withStats.useQuery({ region: region === 'Global' ? undefined : region, limit: 300 }, { staleTime: 60000 });
  const { data: schedulerStatus } = trpc.scheduler.getStatus.useQuery(undefined, { refetchInterval: 10000 });
  const utils = trpc.useUtils();

  const triggerMission = trpc.missions.triggerNow.useMutation({
    onSuccess: () => {
      toast.success('Mission executing', { description: 'Check Live Monitor for progress' });
      setTriggeringId(null);
      refetch();
      onCrawlStart?.();
    },
    onError: (e) => { toast.error('Trigger failed', { description: e.message }); setTriggeringId(null); },
  });

  const toggleMission = trpc.missions.update.useMutation({
    onSuccess: () => refetch(),
    onError: (e) => toast.error('Update failed', { description: e.message }),
  });

  const deleteMission = trpc.missions.delete.useMutation({
    onSuccess: () => { toast.success('Mission deleted'); refetch(); },
    onError: (e) => toast.error('Delete failed', { description: e.message }),
  });

  const quickCrawlMutation = trpc.crawler.quickCrawl.useMutation({
    onSuccess: (data) => {
      const jobs = data.jobIds?.length ?? 0;
      toast.success('Full sweep initiated', { description: `${jobs} jobs started` });
      utils.articles.list.invalidate();
      onCrawlStart?.();
    },
    onError: (e) => toast.error('Sweep failed', { description: e.message }),
  });
  const triggerBreakingMutation = trpc.scheduler.triggerBreaking.useMutation({
    onSuccess: (data) => {
      const jobs = (data as any).jobsStarted ?? 0;
      toast.success('Breaking sweep initiated', { description: `${jobs} jobs started` });
      utils.articles.list.invalidate();
      onCrawlStart?.();
    },
    onError: (e) => toast.error('Breaking sweep failed', { description: e.message }),
  });

  const activeMissions = missions?.filter(m => m.isActive) ?? [];
  const runningMissions = missions?.filter(m => m.isRunning) ?? [];
  const totalArticles = missions?.reduce((s, m) => s + (m.totalArticlesCollected ?? 0), 0) ?? 0;

  if (view === 'create') {
    return <MissionBuilder region={region} agencies={agencies ?? []}
      onCreated={() => { refetch(); setView('dashboard'); }}
      onCancel={() => setView('dashboard')}/>;
  }
  if (view === 'edit' && editingMission) {
    return <MissionBuilder region={region} agencies={agencies ?? []} existingMission={editingMission}
      onCreated={() => { refetch(); setEditingMission(null); setView('dashboard'); }}
      onCancel={() => { setEditingMission(null); setView('dashboard'); }}/>;
  }

  if (view === 'detail' && selectedMissionId !== null) {
    return <MissionDetail missionId={selectedMissionId} onBack={() => setView('dashboard')} onCrawlStart={onCrawlStart}/>;
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex-shrink-0 px-6 py-4 border-b border-border/60 bg-card">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Signal size={16} className="text-cyan-400"/>
              {runningMissions.length > 0 && (
                <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-yellow-400 animate-pulse"/>
              )}
            </div>
            <div>
              <h2 className="text-xs font-mono font-bold text-foreground tracking-[0.2em]">SIGNAL ACQUISITION CENTER</h2>
              <p className="text-[9px] font-mono text-muted-foreground/50 tracking-wider">MISSION CONTROL · AUTOMATED INTELLIGENCE COLLECTION</p>
            </div>
          </div>
          <Button onClick={() => setView('create')}
            className="h-8 text-[10px] font-mono gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400">
            <Plus size={11}/> NEW MISSION
          </Button>
        </div>

        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'ACTIVE MISSIONS', value: activeMissions.length, color: 'text-green-400', icon: <CheckCircle2 size={9}/> },
            { label: 'RUNNING NOW', value: runningMissions.length, color: runningMissions.length > 0 ? 'text-yellow-400' : 'text-muted-foreground/50', icon: <Activity size={9}/> },
            { label: 'TOTAL MISSIONS', value: missions?.length ?? 0, color: 'text-cyan-400', icon: <Target size={9}/> },
            { label: 'ARTICLES COLLECTED', value: totalArticles.toLocaleString(), color: 'text-blue-400', icon: <Newspaper size={9}/> },
            { label: 'LEGACY SCHEDULE', value: schedulerStatus?.config.generalEnabled ? 'ACTIVE' : 'PAUSED', color: schedulerStatus?.config.generalEnabled ? 'text-green-400' : 'text-muted-foreground/50', icon: <Clock size={9}/> },
          ].map(({ label, value, color, icon }) => (
            <div key={label} className="flex items-center gap-2 bg-foreground/[0.02] rounded-lg px-3 py-2 border border-border/40">
              <span className={color}>{icon}</span>
              <div className="min-w-0">
                <div className={`text-sm font-bold font-mono ${color} truncate`}>{value}</div>
                <div className="text-[8px] font-mono text-muted-foreground/40 tracking-wider truncate">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
        <div className="rounded-xl border border-border/60 bg-foreground/[0.02] p-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={12} className="text-yellow-400"/>
            <span className="text-[10px] font-mono font-semibold text-foreground/80 tracking-wider">IMMEDIATE ACQUISITION</span>
            <span className="text-[9px] font-mono text-muted-foreground/40 ml-1">One-shot sweeps outside mission schedule</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => { quickCrawlMutation.mutate({ region, topics: [] }); onCrawlStart?.(); }}
              disabled={quickCrawlMutation.isPending}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-blue-500/25 bg-blue-500/[0.05] hover:bg-blue-500/10 transition-all group disabled:opacity-50">
              {quickCrawlMutation.isPending ? <Loader2 size={12} className="animate-spin text-blue-400"/> : <RefreshCw size={12} className="text-blue-400"/>}
              <div className="text-left">
                <div className="text-[10px] font-mono font-semibold text-blue-400">FULL SWEEP</div>
                <div className="text-[9px] font-mono text-muted-foreground/50">All active sources</div>
              </div>
            </button>
            <button onClick={() => { triggerBreakingMutation.mutate(); onCrawlStart?.(); }}
              disabled={triggerBreakingMutation.isPending}
              className="flex items-center gap-2 px-4 py-3 rounded-lg border border-red-500/25 bg-red-500/[0.05] hover:bg-red-500/10 transition-all group disabled:opacity-50">
              {triggerBreakingMutation.isPending ? <Loader2 size={12} className="animate-spin text-red-400"/> : <AlertTriangle size={12} className="text-red-400"/>}
              <div className="text-left">
                <div className="text-[10px] font-mono font-semibold text-red-400">BREAKING SWEEP</div>
                <div className="text-[9px] font-mono text-muted-foreground/50">Priority sources only</div>
              </div>
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Database size={12} className="text-muted-foreground"/>
              <span className="text-[10px] font-mono font-semibold text-foreground/60 tracking-wider">SCHEDULED MISSIONS</span>
              <span className="text-[9px] font-mono text-muted-foreground/40">({missions?.length ?? 0})</span>
            </div>
            {missions && missions.length > 0 && (
              <button
                onClick={() => { setBulkMode(b => !b); setSelectedIds(new Set()); }}
                className={`text-[9px] font-mono px-2 py-1 rounded border transition-colors ${
                  bulkMode
                    ? 'border-cyan-500/50 bg-cyan-500/15 text-cyan-400'
                    : 'border-border/70 text-muted-foreground/60 hover:text-foreground/60'
                }`}>
                {bulkMode ? 'EXIT BULK' : 'BULK SELECT'}
              </button>
            )}
          </div>
          {/* Bulk action bar */}
          {bulkMode && selectedIds.size > 0 && (
            <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg border border-primary/20 bg-cyan-500/5">
              <span className="text-[9px] font-mono text-cyan-400 flex-1">{selectedIds.size} SELECTED</span>
              <button
                onClick={() => {
                  Array.from(selectedIds).forEach(id => triggerMission.mutate({ id }));
                  toast.success(`Executing ${selectedIds.size} missions`);
                  setSelectedIds(new Set());
                }}
                className="text-[9px] font-mono px-2 py-1 rounded bg-green-500/15 border border-green-500/30 text-green-400 hover:bg-green-500/25 flex items-center gap-1">
                <Play size={9}/> EXECUTE ALL
              </button>
              <button
                onClick={() => {
                  Array.from(selectedIds).forEach(id => {
                    const m = missions?.find(x => x.id === id);
                    if (m) toggleMission.mutate({ id, isActive: !m.isActive });
                  });
                  setSelectedIds(new Set());
                }}
                className="text-[9px] font-mono px-2 py-1 rounded bg-yellow-500/15 border border-yellow-500/30 text-yellow-400 hover:bg-yellow-500/25 flex items-center gap-1">
                <PowerOff size={9}/> TOGGLE
              </button>
              <button
                onClick={() => {
                  if (!confirm(`Delete ${selectedIds.size} missions?`)) return;
                  Array.from(selectedIds).forEach(id => deleteMission.mutate({ id }));
                  setSelectedIds(new Set());
                }}
                className="text-[9px] font-mono px-2 py-1 rounded bg-red-500/15 border border-red-500/30 text-red-400 hover:bg-red-500/25 flex items-center gap-1">
                <Trash2 size={9}/> DELETE
              </button>
              <button
                onClick={() => {
                  if (selectedIds.size === missions?.length) setSelectedIds(new Set());
                  else setSelectedIds(new Set(missions?.map(m => m.id) ?? []));
                }}
                className="text-[9px] font-mono px-2 py-1 rounded border border-border text-muted-foreground/80 hover:text-foreground/70">
                {selectedIds.size === missions?.length ? 'DESELECT ALL' : 'SELECT ALL'}
              </button>
            </div>
          )}

          {!missions || missions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border/70 rounded-xl">
              <Signal size={32} className="text-muted-foreground/20 mb-4"/>
              <div className="text-[11px] font-mono text-muted-foreground/60 mb-1">NO MISSIONS DEPLOYED</div>
              <div className="text-[9px] font-mono text-muted-foreground/30 mb-4">Create your first acquisition mission to begin automated intelligence collection</div>
              <Button onClick={() => setView('create')}
                className="h-8 text-[10px] font-mono gap-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-400">
                <Plus size={11}/> DEPLOY FIRST MISSION
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">
              {missions.map(mission => (
                <MissionCard key={mission.id} mission={mission}
                  onSelect={() => {
                    if (bulkMode) {
                      setSelectedIds(prev => {
                        const next = new Set(prev);
                        if (next.has(mission.id)) next.delete(mission.id); else next.add(mission.id);
                        return next;
                      });
                    } else {
                      setSelectedMissionId(mission.id); setView('detail');
                    }
                  }}
                  onTrigger={() => { setTriggeringId(mission.id); triggerMission.mutate({ id: mission.id }); }}
                  onToggle={() => toggleMission.mutate({ id: mission.id, isActive: !mission.isActive })}
                  onDelete={() => { if (confirm(`Delete mission "${mission.name}"?`)) deleteMission.mutate({ id: mission.id }); }}
                  onEdit={() => { setEditingMission(mission); setView('edit'); }}
                  isTriggering={triggeringId === mission.id}
                  bulkMode={bulkMode}
                  isSelected={selectedIds.has(mission.id)}
                />
              ))}
            </div>
          )}
        </div>

        {schedulerStatus && (
          <div className="rounded-xl border border-border/40 bg-foreground/[0.01] p-4">
            <div className="flex items-center gap-2 mb-3">
              <Timer size={12} className="text-muted-foreground/60"/>
              <span className="text-[10px] font-mono font-semibold text-muted-foreground/60 tracking-wider">LEGACY SCHEDULER STATUS</span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'GENERAL CRAWL', enabled: schedulerStatus.config.generalEnabled, interval: `${schedulerStatus.config.generalIntervalMinutes}m`, lastRun: schedulerStatus.generalLastRun, nextRun: schedulerStatus.generalNextRun },
                { label: 'BREAKING CRAWL', enabled: schedulerStatus.config.breakingEnabled, interval: `${schedulerStatus.config.breakingIntervalMinutes}m`, lastRun: schedulerStatus.breakingLastRun, nextRun: schedulerStatus.breakingNextRun },
              ].map(({ label, enabled, interval, lastRun, nextRun }) => (
                <div key={label} className={`rounded-lg border p-3 ${enabled ? 'border-border/70 bg-foreground/[0.02]' : 'border-border/40'}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-mono text-muted-foreground/80">{label}</span>
                    <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded ${enabled ? 'text-green-400 bg-green-500/15' : 'text-muted-foreground/40 bg-foreground/5'}`}>
                      {enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-1 text-center">
                    <div>
                      <div className="text-[9px] font-mono text-muted-foreground">{interval}</div>
                      <div className="text-[7px] font-mono text-muted-foreground/40">INTERVAL</div>
                    </div>
                    <div>
                      <div className="text-[9px] font-mono text-muted-foreground">{lastRun ? new Date(lastRun).toLocaleTimeString() : 'NEVER'}</div>
                      <div className="text-[7px] font-mono text-muted-foreground/40">LAST RUN</div>
                    </div>
                    <div>
                      <div className={`text-[9px] font-mono ${enabled ? 'text-cyan-400' : 'text-muted-foreground/50'}`}>
                        {enabled && nextRun ? formatCountdownMs(new Date(nextRun).getTime() - Date.now()) : '—'}
                      </div>
                      <div className="text-[7px] font-mono text-muted-foreground/40">NEXT RUN</div>
                    </div>
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

// ─── Main SourcesTab ───────────────────────────────────────────────────────────
export default function SourcesTab({ region, initialSubTab }: SourcesTabProps) {
  const [subTab, setSubTab] = useState<SubTab>((initialSubTab as SubTab) || 'sources');
  const [monitorRefreshKey, setMonitorRefreshKey] = useState(0);
  const handleCrawlStart = () => { setSubTab('monitor'); setMonitorRefreshKey(k => k + 1); };

  const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'sources', label: 'SOURCE REGISTRY', icon: <Database size={12}/> },
    { id: 'map', label: 'GEO MAP', icon: <Globe size={12}/> },
    { id: 'fetching', label: 'ACQUISITION', icon: <Zap size={12}/> },
    { id: 'monitor', label: 'LIVE MONITOR', icon: <Activity size={12}/> },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Sub-tab navigation */}
      <div className="flex-shrink-0 flex items-center gap-0 border-b border-border/60 bg-card px-4">
        {SUB_TABS.map(tab => (
          <button key={tab.id} onClick={() => setSubTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-[10px] font-mono tracking-[0.15em] border-b-2 transition-colors ${
              subTab === tab.id
                ? 'border-cyan-500 text-cyan-400 bg-cyan-500/5'
                : 'border-transparent text-muted-foreground/60 hover:text-foreground/60 hover:bg-foreground/[0.02]'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Content — FetchingMonitor is always mounted so its SSE connection and event buffer survive tab switches */}
      <div className="flex-1 overflow-hidden relative">
        <div style={{ display: subTab === 'sources' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SourcesList region={region} onCrawlStart={handleCrawlStart}/>
        </div>
        <div style={{ display: subTab === 'map' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <SourcesMap region={region} onSwitchToMonitor={handleCrawlStart}/>
        </div>
        <div style={{ display: subTab === 'fetching' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <AcquisitionCenter region={region} onCrawlStart={handleCrawlStart}/>
        </div>
        <div style={{ display: subTab === 'monitor' ? 'flex' : 'none', flexDirection: 'column', height: '100%' }}>
          <FetchingMonitor refreshKey={monitorRefreshKey}/>
        </div>
      </div>
    </div>
  );
}
