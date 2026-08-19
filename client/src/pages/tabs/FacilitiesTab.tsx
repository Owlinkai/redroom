import React, { useState, useCallback, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  Building2, Search, Plus, CheckCircle2, Clock, XCircle, AlertTriangle,
  ChevronDown, ChevronUp, ExternalLink, Edit3, Trash2, Shield, Globe,
  MapPin, Zap, RefreshCw, Eye, FileText, Database, Filter, Download,
  ChevronRight, Info, Star, Activity, Link2, BookOpen, Cpu, Layers,
  Check, X, AlertCircle, TrendingUp, BarChart2, Lock, Unlock,
  Wifi, WifiOff, Signal, Radio, Terminal, Crosshair, Server, Network
} from "lucide-react";

// ─── Constants ────────────────────────────────────────────────────────────────
const FACILITY_TYPES = [
  { value: "nuclear", label: "Nuclear", color: "#f59e0b" },
  { value: "military", label: "Military", color: "#ef4444" },
  { value: "oil_gas", label: "Oil & Gas", color: "#f97316" },
  { value: "power_plant", label: "Power Plant", color: "#eab308" },
  { value: "data_center", label: "Data Center", color: "#3b82f6" },
  { value: "airport", label: "Airport", color: "#06b6d4" },
  { value: "port", label: "Port", color: "#0ea5e9" },
  { value: "government", label: "Government", color: "#8b5cf6" },
  { value: "embassy", label: "Embassy", color: "#a855f7" },
  { value: "satellite", label: "Satellite", color: "#6366f1" },
  { value: "telecom", label: "Telecom", color: "#22c55e" },
  { value: "financial", label: "Financial", color: "#10b981" },
  { value: "research", label: "Research", color: "#14b8a6" },
  { value: "refinery", label: "Refinery", color: "#d97706" },
  { value: "pipeline", label: "Pipeline", color: "#b45309" },
  { value: "dam", label: "Dam", color: "#0284c7" },
  { value: "hospital", label: "Hospital", color: "#ec4899" },
  { value: "company", label: "Company", color: "#64748b" },
  { value: "other", label: "Other", color: "#6b7280" },
];

const SOURCE_TYPES = [
  { value: "government_filing", label: "Government Filing" },
  { value: "iaea_report", label: "IAEA Report" },
  { value: "un_document", label: "UN Document" },
  { value: "satellite_imagery", label: "Satellite Imagery" },
  { value: "official_website", label: "Official Website" },
  { value: "regulatory_body", label: "Regulatory Body" },
  { value: "academic_paper", label: "Academic Paper" },
  { value: "news_report", label: "News Report" },
  { value: "ngo_report", label: "NGO Report" },
  { value: "court_document", label: "Court Document" },
  { value: "manual_entry", label: "Manual Entry" },
  { value: "other", label: "Other" },
];

const THREAT_COLORS: Record<string, string> = {
  low: "#22c55e", medium: "#f59e0b", high: "#f97316", critical: "#ef4444",
};
const VERIFICATION_COLORS: Record<string, string> = {
  unverified: "#6b7280", pending_review: "#f59e0b", verified: "#22c55e",
  disputed: "#ef4444", classified: "#8b5cf6",
};
const APPROVAL_COLORS: Record<string, string> = {
  draft: "#6b7280", pending_approval: "#f59e0b", approved: "#22c55e", rejected: "#ef4444",
};

const EMPTY_FORM = {
  name: "", nameAr: "", nameAlias: "", type: "military",
  country: "", region: "MENA", city: "", address: "",
  latitude: "", longitude: "",
  description: "", operator: "", owner: "", capacity: "",
  area: "", personnel: "", operationalSince: "", estimatedValue: "",
  status: "active", threatLevel: "low", importance: 5,
  tags: "", externalIds: "",
  primarySourceUrl: "", primarySourceName: "", primarySourceType: "manual_entry",
  verificationStatus: "unverified", verificationNotes: "", notes: "",
};

type SubTab = "registry" | "add" | "discover" | "pending";

// ─── Type badge ───────────────────────────────────────────────────────────────
function TypeBadge({ type }: { type: string }) {
  const t = FACILITY_TYPES.find(x => x.value === type);
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border"
      style={{ borderColor: t?.color + "60", color: t?.color, background: t?.color + "15" }}>
      {t?.label ?? type}
    </span>
  );
}

function ThreatBadge({ level }: { level: string }) {
  const color = THREAT_COLORS[level] ?? "#6b7280";
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border uppercase"
      style={{ borderColor: color + "60", color, background: color + "15" }}>
      <Shield size={8} />{level}
    </span>
  );
}

function VerificationBadge({ status }: { status: string }) {
  const color = VERIFICATION_COLORS[status] ?? "#6b7280";
  const icons: Record<string, React.ReactNode> = {
    verified: <Check size={8} />, unverified: <AlertCircle size={8} />,
    pending_review: <Clock size={8} />, disputed: <X size={8} />, classified: <Lock size={8} />,
  };
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono rounded border"
      style={{ borderColor: color + "60", color, background: color + "15" }}>
      {icons[status] ?? <AlertCircle size={8} />}
      {status?.replace(/_/g, " ")}
    </span>
  );
}

// ─── Registry Sub-Tab ─────────────────────────────────────────────────────────
function RegistryTab({ onEdit, region }: { onEdit: (id: number) => void; region: string }) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterThreat, setFilterThreat] = useState("");
  const [filterVerification, setFilterVerification] = useState("");
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<"info" | "articles" | "sources" | "audit">("info");
  const PAGE_SIZE = 20;
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utils = trpc.useUtils();

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(search); setPage(0); }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  const { data, isLoading, refetch } = trpc.facilities.search.useQuery({
    search: debouncedSearch || undefined,
    type: filterType || undefined,
    region: region !== "Global" ? region : undefined,
    threatLevel: filterThreat || undefined,
    verificationStatus: filterVerification || undefined,
    approvalStatus: "approved",
    limit: PAGE_SIZE,
    offset: page * PAGE_SIZE,
  }, { staleTime: 30000 });

  const { data: detailedStats } = trpc.facilities.detailedStats.useQuery(
    { region: region !== "Global" ? region : undefined },
    { staleTime: 60000 }
  );

  const { data: selectedFac } = trpc.facilities.byId.useQuery(
    { id: selectedId! }, { enabled: !!selectedId, staleTime: 10000 }
  );
  const { data: facSources } = trpc.facilities.getSources.useQuery(
    { facilityId: selectedId! }, { enabled: !!selectedId }
  );
  const { data: enrichJobs } = trpc.facilities.enrichmentJobs.useQuery(
    { facilityId: selectedId!, limit: 5 }, { enabled: !!selectedId }
  );
  const { data: newsData } = trpc.facilities.newsForFacility.useQuery(
    { facilityId: selectedId!, limit: 10 }, { enabled: !!selectedId && detailTab === "articles" }
  );

  const deleteMutation = trpc.facilities.delete.useMutation({
    onSuccess: () => {
      toast.success("Facility deleted from registry");
      refetch();
      utils.facilities.detailedStats.invalidate();
      setSelectedId(null);
    },
    onError: (e) => toast.error("Delete failed", { description: e.message }),
  });

  const reenrichMutation = trpc.facilities.triggerReenrichment.useMutation({
    onSuccess: (d) => {
      toast.success("Article re-match started", { description: `Scanning all articles for "${d.facilityName}"` });
      utils.facilities.enrichmentJobs.invalidate();
    },
    onError: (e) => toast.error("Re-match failed", { description: e.message }),
  });

  const bulkRematchMutation = trpc.facilities.bulkRematch.useMutation({
    onSuccess: (d) => toast.success(`Bulk re-match launched`, { description: `${d.started} facilities queued for article scanning` }),
    onError: (e) => toast.error("Bulk re-match failed", { description: e.message }),
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const THREAT_COLORS: Record<string, string> = {
    critical: "bg-red-500",
    high: "bg-orange-500",
    medium: "bg-yellow-500",
    low: "bg-green-500",
    minimal: "bg-blue-400",
  };
  const THREAT_TEXT: Record<string, string> = {
    critical: "text-red-400",
    high: "text-orange-400",
    medium: "text-yellow-400",
    low: "text-green-400",
    minimal: "text-blue-400",
  };
  const VERIFY_COLORS: Record<string, string> = {
    verified: "text-green-400",
    pending_review: "text-yellow-400",
    unverified: "text-muted-foreground",
    disputed: "text-red-400",
  };

  return (
    <div className="flex flex-col h-full">
      {/* ── STAT HEADER ─────────────────────────────────────────────────────── */}
      <div className="flex items-stretch gap-0 border-b border-border bg-card/40 flex-shrink-0">
        {/* Total */}
        <div className="flex flex-col justify-center px-4 py-2 border-r border-border min-w-[90px]">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">TOTAL</div>
          <div className="text-xl font-mono font-bold text-primary">{detailedStats?.total ?? total}</div>
        </div>
        {/* Threat heatmap */}
        <div className="flex flex-col justify-center px-4 py-2 border-r border-border flex-1 min-w-0">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">THREAT DISTRIBUTION</div>
          <div className="flex items-center gap-2 flex-wrap">
            {["critical","high","medium","low","minimal"].map(level => {
              const count = detailedStats?.byThreat?.[level] ?? 0;
              const pct = detailedStats?.total ? Math.round((count / detailedStats.total) * 100) : 0;
              return (
                <button key={level} onClick={() => setFilterThreat(filterThreat === level ? "" : level)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 border transition-all text-[9px] font-mono ${filterThreat === level ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border"}`}>
                  <span className={`w-2 h-2 rounded-full ${THREAT_COLORS[level]}`} />
                  <span className={THREAT_TEXT[level]}>{level.toUpperCase()}</span>
                  <span className="text-muted-foreground">{count}</span>
                  {pct > 0 && <span className="text-muted-foreground/60">({pct}%)</span>}
                </button>
              );
            })}
          </div>
        </div>
        {/* Verification */}
        <div className="flex flex-col justify-center px-4 py-2 border-r border-border">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-1.5">VERIFICATION</div>
          <div className="flex items-center gap-2">
            {["verified","pending_review","unverified"].map(v => {
              const count = detailedStats?.byVerification?.[v] ?? 0;
              return (
                <button key={v} onClick={() => setFilterVerification(filterVerification === v ? "" : v)}
                  className={`flex items-center gap-1.5 px-2 py-0.5 border transition-all text-[9px] font-mono ${filterVerification === v ? "border-primary bg-primary/10 text-primary" : "border-border/50 hover:border-border"}`}>
                  <span className={VERIFY_COLORS[v]}>{v === "pending_review" ? "PENDING" : v.toUpperCase()}</span>
                  <span className="text-muted-foreground">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
        {/* Links + pending */}
        <div className="flex flex-col justify-center px-4 py-2 border-r border-border">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">ARTICLE LINKS</div>
          <div className="text-lg font-mono font-bold text-cyan-400">{detailedStats?.totalLinks ?? 0}</div>
        </div>
        <div className="flex flex-col justify-center px-4 py-2">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">PENDING APPROVAL</div>
          <div className="text-lg font-mono font-bold text-amber-400">{detailedStats?.pendingCandidates ?? 0}</div>
        </div>
        {/* Actions */}
        <div className="flex items-center gap-2 px-4 ml-auto">
          <button
            onClick={() => bulkRematchMutation.mutate({ triggeredBy: "analyst", region: region !== "Global" ? region : undefined })}
            disabled={bulkRematchMutation.isPending}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-cyan-500/40 text-[10px] font-mono text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50 transition-all"
          >
            <Zap size={10} className={bulkRematchMutation.isPending ? "animate-pulse" : ""} />
            {bulkRematchMutation.isPending ? "MATCHING..." : "REMATCH ALL"}
          </button>
          <button onClick={() => onEdit(0)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-mono hover:opacity-90 transition-all">
            <Plus size={10} />ADD FACILITY
          </button>
        </div>
      </div>

      {/* ── MAIN BODY ────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left: List */}
        <div className={`flex flex-col min-h-0 border-r border-border transition-all ${selectedId ? "w-[55%]" : "flex-1"}`}>
          {/* Toolbar */}
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/30 flex-shrink-0">
            <div className="relative flex-1 min-w-0">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name, country, operator, tags..."
                className="w-full pl-7 pr-3 py-1.5 bg-input border border-border text-[11px] font-mono focus:outline-none focus:border-primary"
              />
            </div>
            {/* Type filter */}
            <select value={filterType} onChange={e => { setFilterType(e.target.value); setPage(0); }}
              className="bg-input border border-border text-[10px] font-mono px-2 py-1.5 focus:outline-none focus:border-primary text-muted-foreground">
              <option value="">ALL TYPES</option>
              {["military","nuclear","energy","port","airport","government","research","industrial","satellite","cyber","financial","other"].map(t => (
                <option key={t} value={t}>{t.toUpperCase()}</option>
              ))}
            </select>
            <button onClick={() => refetch()} className="p-1.5 border border-border text-muted-foreground hover:text-primary hover:border-primary transition-all">
              <RefreshCw size={10} />
            </button>
            <span className="text-[10px] font-mono text-muted-foreground whitespace-nowrap">{total} records</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-24 text-muted-foreground text-[11px] font-mono gap-2">
                <RefreshCw size={12} className="animate-spin" />LOADING REGISTRY...
              </div>
            ) : rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
                <Database size={24} className="opacity-20" />
                <span className="text-[11px] font-mono">NO FACILITIES FOUND</span>
              </div>
            ) : (
              <table className="w-full text-[11px] font-mono">
                <thead className="sticky top-0 bg-card/95 backdrop-blur-sm z-10 border-b border-border">
                  <tr>
                    <th className="text-left px-3 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">FACILITY</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">TYPE</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">COUNTRY</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">THREAT</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">VERIFY</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">IMP</th>
                    <th className="text-left px-2 py-2 text-[9px] text-muted-foreground font-normal tracking-widest">NEWS</th>
                    <th className="px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(fac => {
                    const threatColor = THREAT_COLORS[fac.threatLevel ?? "low"] ?? "bg-muted";
                    const isSelected = selectedId === fac.id;
                    return (
                      <tr key={fac.id}
                        onClick={() => { setSelectedId(isSelected ? null : fac.id); setDetailTab("info"); }}
                        className={`border-b border-border/20 cursor-pointer transition-all group ${isSelected ? "bg-primary/10 border-l-2 border-l-primary" : "hover:bg-foreground/[0.02]"}`}>
                        {/* Left threat bar */}
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-0.5 h-7 rounded-full flex-shrink-0 ${threatColor} opacity-70`} />
                            <div>
                              <div className={`font-medium truncate max-w-[180px] ${isSelected ? "text-primary" : "text-foreground"}`}>{fac.name}</div>
                              {fac.city && <div className="text-muted-foreground text-[9px]">{fac.city}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-2 py-2"><TypeBadge type={fac.type} /></td>
                        <td className="px-2 py-2 text-muted-foreground text-[10px]">{fac.country}</td>
                        <td className="px-2 py-2">
                          <span className={`text-[9px] font-mono font-bold ${THREAT_TEXT[fac.threatLevel ?? "low"]}`}>
                            {(fac.threatLevel ?? "low").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <span className={`text-[9px] font-mono ${VERIFY_COLORS[fac.verificationStatus ?? "unverified"]}`}>
                            {fac.verificationStatus === "pending_review" ? "PENDING" : (fac.verificationStatus ?? "UNVERIFIED").toUpperCase()}
                          </span>
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1">
                            <div className="w-10 h-1 bg-muted/40 rounded-full overflow-hidden">
                              <div className="h-full bg-primary/70 rounded-full" style={{ width: `${((fac.importance ?? 5) / 10) * 100}%` }} />
                            </div>
                            <span className="text-muted-foreground text-[9px]">{fac.importance}</span>
                          </div>
                        </td>
                        <td className="px-2 py-2">
                          {(fac.newsCount ?? 0) > 0 ? (
                            <span className="text-cyan-400 font-mono text-[10px]">{fac.newsCount}</span>
                          ) : (
                            <span className="text-muted-foreground/40 text-[10px]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={e => { e.stopPropagation(); onEdit(fac.id); }}
                              className="p-1 hover:text-primary transition-colors" title="Edit">
                              <Edit3 size={10} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); if (confirm(`Delete "${fac.name}"?`)) deleteMutation.mutate({ id: fac.id }); }}
                              className="p-1 hover:text-destructive transition-colors" title="Delete">
                              <Trash2 size={10} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-border flex-shrink-0 bg-card/20">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="px-2 py-1 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                ← PREV
              </button>
              <span className="text-[10px] font-mono text-muted-foreground">{page + 1} / {totalPages} · {total} total</span>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="px-2 py-1 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary disabled:opacity-30 transition-all">
                NEXT →
              </button>
            </div>
          )}
        </div>

        {/* Right: Detail Flyout */}
        {selectedId && selectedFac && (
          <div className="w-[45%] flex flex-col min-h-0 bg-card">
            {/* Flyout header */}
            <div className="flex items-start justify-between px-4 py-3 border-b border-border flex-shrink-0">
              <div className="flex-1 min-w-0 pr-2">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${THREAT_COLORS[selectedFac.threatLevel ?? "low"]}`} />
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">
                    {selectedFac.type} · {selectedFac.country}
                  </span>
                </div>
                <div className="text-sm font-mono font-bold text-foreground truncate">{selectedFac.name}</div>
                {selectedFac.nameAlias && (
                  <div className="text-[9px] text-muted-foreground font-mono mt-0.5">aka: {selectedFac.nameAlias}</div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => onEdit(selectedFac.id)}
                  className="flex items-center gap-1 px-2 py-1 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary transition-all">
                  <Edit3 size={9} />EDIT
                </button>
                <button onClick={() => setSelectedId(null)} className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <X size={12} />
                </button>
              </div>
            </div>

            {/* Detail tabs */}
            <div className="flex border-b border-border flex-shrink-0">
              {(["info","articles","sources","audit"] as const).map(tab => (
                <button key={tab} onClick={() => setDetailTab(tab)}
                  className={`px-4 py-2 text-[10px] font-mono border-b-2 transition-all ${detailTab === tab ? "border-b-primary text-primary" : "border-b-transparent text-muted-foreground hover:text-foreground"}`}>
                  {tab === "articles" ? `ARTICLES${newsData?.articles?.length ? ` (${newsData.articles.length})` : ""}` : tab.toUpperCase()}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 text-[11px] font-mono">
              {/* INFO TAB */}
              {detailTab === "info" && (
                <>
                  {/* Core metrics */}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "THREAT LEVEL", value: selectedFac.threatLevel?.toUpperCase() ?? "LOW", cls: THREAT_TEXT[selectedFac.threatLevel ?? "low"] },
                      { label: "IMPORTANCE", value: `${selectedFac.importance ?? 5}/10`, cls: "text-primary" },
                      { label: "STATUS", value: selectedFac.status?.toUpperCase() ?? "ACTIVE", cls: "text-green-400" },
                      { label: "VERIFICATION", value: selectedFac.verificationStatus === "pending_review" ? "PENDING" : (selectedFac.verificationStatus ?? "UNVERIFIED").toUpperCase(), cls: VERIFY_COLORS[selectedFac.verificationStatus ?? "unverified"] },
                    ].map(m => (
                      <div key={m.label} className="bg-card/30 border border-border/50 p-2">
                        <div className="text-[9px] text-muted-foreground tracking-widest mb-0.5">{m.label}</div>
                        <div className={`font-bold text-[11px] ${m.cls}`}>{m.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Importance bar */}
                  <div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mb-1">
                      <span>STRATEGIC IMPORTANCE</span><span>{selectedFac.importance ?? 5}/10</span>
                    </div>
                    <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden">
                      <div className="h-full bg-gradient-to-r from-primary/60 to-primary rounded-full transition-all"
                        style={{ width: `${((selectedFac.importance ?? 5) / 10) * 100}%` }} />
                    </div>
                  </div>

                  {/* Location */}
                  {(selectedFac.city || selectedFac.address || selectedFac.latitude) && (
                    <div className="space-y-1 border-t border-border/30 pt-3">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                        <MapPin size={8} />LOCATION
                      </div>
                      {selectedFac.city && <div className="text-foreground">{selectedFac.city}{selectedFac.address ? `, ${selectedFac.address}` : ""}</div>}
                      {selectedFac.latitude && selectedFac.longitude && (
                        <div className="text-muted-foreground text-[10px]">
                          {selectedFac.latitude.toFixed(4)}°, {selectedFac.longitude.toFixed(4)}°
                        </div>
                      )}
                    </div>
                  )}

                  {/* Description */}
                  {selectedFac.description && (
                    <div className="space-y-1 border-t border-border/30 pt-3">
                      <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">DESCRIPTION</div>
                      <p className="text-muted-foreground text-[10px] leading-relaxed">{selectedFac.description}</p>
                    </div>
                  )}

                  {/* Operational details */}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/30 pt-3">
                    {[
                      ["OPERATOR", selectedFac.operator],
                      ["OWNER", selectedFac.owner],
                      ["CAPACITY", selectedFac.capacity],
                      ["AREA", selectedFac.area],
                      ["PERSONNEL", selectedFac.personnel],
                      ["SINCE", selectedFac.operationalSince],
                      ["EST. VALUE", selectedFac.estimatedValue],
                    ].filter(([, v]) => v).map(([label, value]) => (
                      <div key={label as string}>
                        <div className="text-[9px] text-muted-foreground">{label as string}</div>
                        <div className="text-foreground text-[10px] truncate">{value as string}</div>
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  {selectedFac.tags && (selectedFac.tags as string[]).length > 0 && (
                    <div className="flex flex-wrap gap-1 border-t border-border/30 pt-3">
                      {(selectedFac.tags as string[]).map(tag => (
                        <span key={tag} className="px-1.5 py-0.5 bg-primary/10 border border-primary/20 text-[9px] text-primary/80">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Re-enrichment */}
                  <div className="border-t border-border/30 pt-3">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest flex items-center gap-1 mb-2">
                      <Zap size={8} />ARTICLE RE-MATCH
                    </div>
                    <button
                      onClick={() => reenrichMutation.mutate({ facilityId: selectedId, triggeredBy: "analyst" })}
                      disabled={reenrichMutation.isPending}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-cyan-500/40 text-[10px] font-mono text-cyan-400 hover:bg-cyan-500/10 disabled:opacity-50 transition-all"
                    >
                      <RefreshCw size={9} className={reenrichMutation.isPending ? "animate-spin" : ""} />
                      {reenrichMutation.isPending ? "SCANNING ARTICLES..." : "SCAN & MATCH ARTICLES"}
                    </button>
                    {enrichJobs && enrichJobs.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {enrichJobs.slice(0, 3).map(job => (
                          <div key={job.id} className="flex items-center gap-2 text-[9px] text-muted-foreground">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${job.status === "completed" ? "bg-green-500" : job.status === "running" ? "bg-yellow-500 animate-pulse" : "bg-red-500"}`} />
                            <span className="capitalize">{job.status}</span>
                            <span>· {job.articlesScanned} scanned</span>
                            <span className="text-cyan-400">· {job.linksCreated} links</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* ARTICLES TAB */}
              {detailTab === "articles" && (
                <div className="space-y-2">
                  {!newsData ? (
                    <div className="flex items-center gap-2 text-muted-foreground py-4 justify-center">
                      <RefreshCw size={12} className="animate-spin" />LOADING ARTICLES...
                    </div>
                  ) : newsData.articles.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                      <FileText size={20} className="opacity-20" />
                      <span className="text-[10px]">No articles linked yet</span>
                      <button onClick={() => reenrichMutation.mutate({ facilityId: selectedId, triggeredBy: "analyst" })}
                        className="mt-1 flex items-center gap-1 px-3 py-1.5 border border-cyan-500/40 text-[10px] text-cyan-400 hover:bg-cyan-500/10 transition-all">
                        <Zap size={9} />RUN ARTICLE MATCH
                      </button>
                    </div>
                  ) : newsData.articles.map((art: any) => (
                    <div key={art.id} className="p-2.5 bg-card/30 border border-border/40 hover:border-border transition-all">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <a href={art.url} target="_blank" rel="noopener noreferrer"
                          className="text-foreground hover:text-primary text-[10px] font-medium leading-snug flex-1 line-clamp-2">
                          {art.title}
                        </a>
                        {art.isBreaking && (
                          <span className="flex-shrink-0 px-1 py-0.5 bg-red-500/20 text-red-400 text-[8px] font-bold">BREAKING</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                        <span>{art.agencyName ?? "Unknown"}</span>
                        <span>·</span>
                        <span>{art.publishedAt ? new Date(art.publishedAt).toLocaleDateString() : "—"}</span>
                        {art.sentiment && (
                          <>
                            <span>·</span>
                            <span className={art.sentiment === "negative" ? "text-red-400" : art.sentiment === "positive" ? "text-green-400" : "text-muted-foreground"}>
                              {art.sentiment.toUpperCase()}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* SOURCES TAB */}
              {detailTab === "sources" && (
                <div className="space-y-2">
                  {/* Primary source */}
                  {selectedFac.primarySourceUrl ? (
                    <div className="p-3 bg-primary/5 border border-primary/20">
                      <div className="text-[9px] text-primary uppercase tracking-widest mb-1">PRIMARY SOURCE</div>
                      <a href={selectedFac.primarySourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline text-[10px] flex items-center gap-1 truncate">
                        <ExternalLink size={9} />{selectedFac.primarySourceName ?? selectedFac.primarySourceUrl}
                      </a>
                      {selectedFac.primarySourceType && (
                        <div className="text-muted-foreground text-[9px] mt-0.5">{selectedFac.primarySourceType.replace(/_/g, " ")}</div>
                      )}
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-[10px] italic">No primary source cited</div>
                  )}
                  {/* Additional sources */}
                  {facSources && facSources.length > 0 && facSources.map(src => (
                    <div key={src.id} className="p-2.5 bg-card/30 border border-border/40">
                      <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="text-primary hover:underline text-[10px] flex items-center gap-1 truncate mb-0.5">
                        <ExternalLink size={8} />{src.sourceName}
                      </a>
                      <div className="text-muted-foreground text-[9px]">
                        {src.sourceType?.replace(/_/g, " ")} · {src.reliability}% reliability
                      </div>
                      {src.confirmsFields && <div className="text-muted-foreground text-[9px]">Confirms: {src.confirmsFields}</div>}
                    </div>
                  ))}
                  {(!facSources || facSources.length === 0) && !selectedFac.primarySourceUrl && (
                    <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                      <Link2 size={18} className="opacity-20" />
                      <span className="text-[10px]">No sources attached</span>
                    </div>
                  )}
                </div>
              )}

              {/* AUDIT TAB */}
              {detailTab === "audit" && (
                <div className="space-y-1.5">
                  {(() => {
                    try {
                      const log = JSON.parse(selectedFac.auditLog ?? "[]");
                      if (!Array.isArray(log) || log.length === 0) throw new Error("empty");
                      return log.slice().reverse().map((entry: any, i: number) => (
                        <div key={i} className="flex items-start gap-3 p-2 bg-card/20 border border-border/30">
                          <div className="w-1 h-full min-h-[20px] bg-primary/30 rounded-full flex-shrink-0 mt-1" />
                          <div>
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-primary/70 text-[9px]">{new Date(entry.at).toLocaleDateString()}</span>
                              <span className="text-foreground text-[10px] capitalize font-medium">{entry.action?.replace(/_/g, " ")}</span>
                              <span className="text-muted-foreground text-[9px]">by {entry.by}</span>
                            </div>
                            {entry.detail && <div className="text-muted-foreground text-[9px]">{entry.detail}</div>}
                          </div>
                        </div>
                      ));
                    } catch {
                      return (
                        <div className="flex flex-col items-center gap-2 py-6 text-muted-foreground">
                          <Activity size={18} className="opacity-20" />
                          <span className="text-[10px]">No audit log entries</span>
                        </div>
                      );
                    }
                  })()}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add/Edit Sub-Tab ─────────────────────────────────────────────────────────
function AddEditTab({ editId, onDone, region }: { editId?: number | null; onDone?: () => void; region?: string }) {
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [sources, setSources] = useState<{ url: string; name: string; type: string; confirms: string; reliability: number; notes: string }[]>([]);
  const [newSource, setNewSource] = useState({ url: "", name: "", type: "official_website", confirms: "", reliability: 80, notes: "" });
  const [showSourceForm, setShowSourceForm] = useState(false);
  const [activeSection, setActiveSection] = useState<string>("basic");
  const utils = trpc.useUtils();

  const { data: existingFac } = trpc.facilities.byId.useQuery({ id: editId! }, { enabled: !!editId });
  const { data: existingSources } = trpc.facilities.getSources.useQuery({ facilityId: editId! }, { enabled: !!editId });

  useEffect(() => {
    if (existingFac) {
      setForm({
        name: existingFac.name ?? "",
        nameAr: existingFac.nameAr ?? "",
        nameAlias: existingFac.nameAlias ?? "",
        type: existingFac.type ?? "military",
        country: existingFac.country ?? "",
        region: existingFac.region ?? "MENA",
        city: existingFac.city ?? "",
        address: existingFac.address ?? "",
        latitude: String(existingFac.latitude ?? ""),
        longitude: String(existingFac.longitude ?? ""),
        description: existingFac.description ?? "",
        operator: existingFac.operator ?? "",
        owner: existingFac.owner ?? "",
        capacity: existingFac.capacity ?? "",
        area: existingFac.area ?? "",
        personnel: existingFac.personnel ?? "",
        operationalSince: existingFac.operationalSince ?? "",
        estimatedValue: existingFac.estimatedValue ?? "",
        status: existingFac.status ?? "active",
        threatLevel: existingFac.threatLevel ?? "low",
        importance: existingFac.importance ?? 5,
        tags: Array.isArray(existingFac.tags) ? existingFac.tags.join(", ") : "",
        externalIds: existingFac.externalIds ? JSON.stringify(existingFac.externalIds) : "",
        primarySourceUrl: existingFac.primarySourceUrl ?? "",
        primarySourceName: existingFac.primarySourceName ?? "",
        primarySourceType: existingFac.primarySourceType ?? "manual_entry",
        verificationStatus: existingFac.verificationStatus ?? "unverified",
        verificationNotes: existingFac.verificationNotes ?? "",
        notes: existingFac.notes ?? "",
      });
    }
  }, [existingFac]);

  const autoMatchMutation = trpc.facilities.triggerReenrichment.useMutation({
    onSuccess: (d) => toast.success("Article match started", {
      description: `Scanning all articles for "${d.facilityName}"`,
      action: { label: "View Registry", onClick: () => onDone?.() },
    }),
  });

  const createMutation = trpc.facilities.create.useMutation({
    onSuccess: (fac) => {
      toast.success("Facility created", { description: `${fac?.name} added to registry` });
      utils.facilities.search.invalidate();
      utils.facilities.detailedStats.invalidate();
      if (fac?.id) autoMatchMutation.mutate({ facilityId: fac.id, triggeredBy: "auto-save" });
      setForm({ ...EMPTY_FORM });
      setSources([]);
      onDone?.();
    },
    onError: (e) => toast.error("Failed to create facility", { description: e.message }),
  });

  const updateMutation = trpc.facilities.update.useMutation({
    onSuccess: (fac) => {
      toast.success("Facility updated", { description: `${fac?.name} saved` });
      utils.facilities.search.invalidate();
      utils.facilities.byId.invalidate({ id: editId! });
      utils.facilities.detailedStats.invalidate();
      if (fac?.id) autoMatchMutation.mutate({ facilityId: fac.id, triggeredBy: "auto-save" });
      onDone?.();
    },
    onError: (e) => toast.error("Failed to update facility", { description: e.message }),
  });

  const addSourceMutation = trpc.facilities.addSource.useMutation({
    onSuccess: () => {
      toast.success("Source added");
      utils.facilities.getSources.invalidate({ facilityId: editId! });
      setNewSource({ url: "", name: "", type: "official_website", confirms: "", reliability: 80, notes: "" });
      setShowSourceForm(false);
    },
    onError: (e) => toast.error("Failed to add source", { description: e.message }),
  });

  const removeSourceMutation = trpc.facilities.removeSource.useMutation({
    onSuccess: () => {
      toast.success("Source removed");
      utils.facilities.getSources.invalidate({ facilityId: editId! });
    },
  });

  const handleSubmit = useCallback(() => {
    if (!form.name.trim() || !form.country.trim()) {
      toast.error("Name and country are required");
      return;
    }
    const lat = parseFloat(form.latitude);
    const lng = parseFloat(form.longitude);
    if (isNaN(lat) || isNaN(lng)) {
      toast.error("Valid latitude and longitude are required");
      return;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      toast.error("Coordinates out of range", { description: "Lat: -90 to 90, Lng: -180 to 180" });
      return;
    }
    const payload: any = {
      name: form.name.trim(),
      nameAr: form.nameAr || undefined,
      nameAlias: form.nameAlias || undefined,
      type: form.type,
      country: form.country.trim(),
      region: form.region || "MENA",
      city: form.city || undefined,
      address: form.address || undefined,
      latitude: lat,
      longitude: lng,
      description: form.description || undefined,
      operator: form.operator || undefined,
      owner: form.owner || undefined,
      capacity: form.capacity || undefined,
      area: form.area || undefined,
      personnel: form.personnel || undefined,
      operationalSince: form.operationalSince || undefined,
      estimatedValue: form.estimatedValue || undefined,
      status: form.status,
      threatLevel: form.threatLevel,
      importance: form.importance,
      tags: form.tags ? form.tags.split(",").map(s => s.trim()).filter(Boolean) : [],
      primarySourceUrl: form.primarySourceUrl || undefined,
      primarySourceName: form.primarySourceName || undefined,
      primarySourceType: form.primarySourceType || undefined,
      verificationStatus: form.verificationStatus,
      verificationNotes: form.verificationNotes || undefined,
      notes: form.notes || undefined,
      submittedBy: "analyst",
    };
    if (editId) {
      updateMutation.mutate({ id: editId, ...payload, updatedBy: "analyst" });
    } else {
      createMutation.mutate(payload);
    }
  }, [form, editId, createMutation, updateMutation]);

  const f = (key: keyof typeof form, value: any) => setForm(p => ({ ...p, [key]: value }));

  const SECTIONS = [
    { id: "basic", label: "Basic Info", icon: <Building2 size={10} /> },
    { id: "location", label: "Location", icon: <MapPin size={10} /> },
    { id: "operational", label: "Operational", icon: <Activity size={10} /> },
    { id: "sourcing", label: "Sourcing & Verification", icon: <Shield size={10} /> },
    { id: "notes", label: "Notes & Tags", icon: <FileText size={10} /> },
  ];

  return (
    <div className="flex h-full">
      {/* Section nav */}
      <div className="w-40 flex-shrink-0 border-r border-border bg-card/30 flex flex-col pt-3">
        {SECTIONS.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`flex items-center gap-2 px-3 py-2.5 text-[10px] font-mono text-left transition-all border-l-2 ${activeSection === s.id ? 'border-l-primary text-primary bg-primary/10' : 'border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'}`}>
            {s.icon}{s.label}
          </button>
        ))}
        {editId && (
          <button onClick={() => setActiveSection("sources")}
            className={`flex items-center gap-2 px-3 py-2.5 text-[10px] font-mono text-left transition-all border-l-2 ${activeSection === "sources" ? 'border-l-primary text-primary bg-primary/10' : 'border-l-transparent text-muted-foreground hover:text-foreground hover:bg-muted/20'}`}>
            <Link2 size={10} />Sources
          </button>
        )}
      </div>

      {/* Form */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-card/50 flex-shrink-0">
          <div>
            <div className="text-[10px] font-mono text-primary uppercase tracking-widest">
              {editId ? "EDIT FACILITY" : "ADD NEW FACILITY"}
            </div>
            <div className="text-[9px] text-muted-foreground mt-0.5">
              All fields must be sourced from authoritative, non-Wikipedia sources
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onDone && (
              <button onClick={onDone} className="px-3 py-1.5 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary transition-all">
                CANCEL
              </button>
            )}
            <button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-[10px] font-mono hover:opacity-90 disabled:opacity-50 transition-all"
            >
              <Check size={10} />
              {createMutation.isPending || updateMutation.isPending ? "SAVING..." : editId ? "SAVE CHANGES" : "CREATE FACILITY"}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {/* Basic Info */}
          {activeSection === "basic" && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-3 border border-amber-500/30 bg-amber-500/5 text-[10px] font-mono text-amber-400 flex items-start gap-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold mb-0.5">DATA ACCURACY REQUIREMENT</div>
                  All facility data must be sourced from authoritative references: government filings, IAEA/UN reports,
                  official websites, or verified satellite imagery. Wikipedia is not an acceptable source.
                  Inaccurate coordinates or fabricated details will compromise intelligence analysis.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">OFFICIAL NAME *</label>
                  <input value={form.name} onChange={e => f("name", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary font-medium" placeholder="e.g. Bushehr Nuclear Power Plant" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">ARABIC NAME</label>
                  <input value={form.nameAr} onChange={e => f("nameAr", e.target.value)} dir="rtl"
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="الاسم بالعربية" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">ALIASES / ALTERNATE NAMES</label>
                  <input value={form.nameAlias} onChange={e => f("nameAlias", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="Comma-separated aliases" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">FACILITY TYPE *</label>
                  <select value={form.type} onChange={e => f("type", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">OPERATIONAL STATUS</label>
                  <select value={form.status} onChange={e => f("status", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {["active", "inactive", "under_construction", "decommissioned", "unknown"].map(v => (
                      <option key={v} value={v}>{v.replace(/_/g, " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">THREAT LEVEL</label>
                  <select value={form.threatLevel} onChange={e => f("threatLevel", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {["low", "medium", "high", "critical"].map(v => (
                      <option key={v} value={v}>{v.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">STRATEGIC IMPORTANCE (1-10)</label>
                  <div className="flex items-center gap-3">
                    <input type="range" min={1} max={10} value={form.importance} onChange={e => f("importance", parseInt(e.target.value))}
                      className="flex-1 accent-primary" />
                    <span className="text-sm font-mono font-bold text-primary w-4">{form.importance}</span>
                  </div>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">DESCRIPTION</label>
                  <textarea value={form.description} onChange={e => f("description", e.target.value)} rows={3}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary resize-none"
                    placeholder="Factual description from authoritative sources..." />
                </div>
              </div>
            </div>
          )}

          {/* Location */}
          {activeSection === "location" && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-3 border border-blue-500/30 bg-blue-500/5 text-[10px] font-mono text-blue-400 flex items-start gap-2">
                <Info size={12} className="flex-shrink-0 mt-0.5" />
                Coordinates must be accurate to at least 4 decimal places. Verify against satellite imagery or official sources.
                Do not use approximate or estimated coordinates.
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">COUNTRY *</label>
                  <input value={form.country} onChange={e => f("country", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. Iran" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">REGION</label>
                  <select value={form.region} onChange={e => f("region", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {["MENA","Global","Europe","East Asia","Asia-Pacific","South Asia","Central Asia","Sub-Saharan Africa","North Africa","Americas","Latin America"].map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">CITY / NEAREST TOWN</label>
                  <input value={form.city} onChange={e => f("city", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. Bushehr" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">ADDRESS / DESCRIPTION</label>
                  <input value={form.address} onChange={e => f("address", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="Street address or location description" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">LATITUDE * (decimal degrees)</label>
                  <input value={form.latitude} onChange={e => f("latitude", e.target.value)} type="number" step="0.0001"
                    className="w-full px-3 py-2 bg-input border border-border text-sm font-mono focus:outline-none focus:border-primary" placeholder="e.g. 28.9234" />
                  <div className="text-[9px] text-muted-foreground mt-0.5">Range: -90 to 90</div>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">LONGITUDE * (decimal degrees)</label>
                  <input value={form.longitude} onChange={e => f("longitude", e.target.value)} type="number" step="0.0001"
                    className="w-full px-3 py-2 bg-input border border-border text-sm font-mono focus:outline-none focus:border-primary" placeholder="e.g. 50.8918" />
                  <div className="text-[9px] text-muted-foreground mt-0.5">Range: -180 to 180</div>
                </div>
              </div>
              {form.latitude && form.longitude && !isNaN(parseFloat(form.latitude)) && !isNaN(parseFloat(form.longitude)) && (
                <div className="space-y-2">
                  <div className="p-2 border border-green-500/30 bg-green-500/5 text-[10px] font-mono text-green-400 flex items-center gap-2">
                    <Check size={10} />
                    Coordinates confirmed: {parseFloat(form.latitude).toFixed(4)}°N, {parseFloat(form.longitude).toFixed(4)}°E
                    <a href={`https://www.google.com/maps?q=${form.latitude},${form.longitude}`} target="_blank" rel="noopener noreferrer"
                      className="ml-auto flex items-center gap-1 hover:underline text-cyan-400">
                      <ExternalLink size={9} />Verify on Maps
                    </a>
                  </div>
                  {/* Live mini-map preview */}
                  <div className="relative border border-border/50 overflow-hidden" style={{ height: '220px' }}>
                    <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-2 py-1 bg-card/80 backdrop-blur-sm border-b border-border/30">
                      <span className="text-[9px] font-mono text-cyan-400/70 tracking-widest">COORDINATE PREVIEW</span>
                      <span className="text-[9px] font-mono text-muted-foreground/50">{parseFloat(form.latitude).toFixed(4)}°, {parseFloat(form.longitude).toFixed(4)}°</span>
                    </div>
                    <iframe
                      key={`${parseFloat(form.latitude).toFixed(3)},${parseFloat(form.longitude).toFixed(3)}`}
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${parseFloat(form.longitude)-0.05},${parseFloat(form.latitude)-0.05},${parseFloat(form.longitude)+0.05},${parseFloat(form.latitude)+0.05}&layer=mapnik&marker=${form.latitude},${form.longitude}`}
                      className="w-full h-full"
                      style={{ marginTop: '26px', height: 'calc(100% - 26px)', filter: 'invert(0.85) hue-rotate(180deg) brightness(0.8) contrast(1.1)' }}
                      title="Coordinate preview"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Operational */}
          {activeSection === "operational" && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">OPERATOR</label>
                  <input value={form.operator} onChange={e => f("operator", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="Operating organization" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">OWNER / CONTROLLING ENTITY</label>
                  <input value={form.owner} onChange={e => f("owner", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="Government, corporation, etc." />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">CAPACITY</label>
                  <input value={form.capacity} onChange={e => f("capacity", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. 1,000 MW, 50,000 bbl/day" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">AREA / SIZE</label>
                  <input value={form.area} onChange={e => f("area", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. 450 km², 12 hectares" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">PERSONNEL (approx.)</label>
                  <input value={form.personnel} onChange={e => f("personnel", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. ~5,000 staff, classified" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">OPERATIONAL SINCE</label>
                  <input value={form.operationalSince} onChange={e => f("operationalSince", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. 1975, March 2003" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">ESTIMATED VALUE</label>
                  <input value={form.estimatedValue} onChange={e => f("estimatedValue", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. $4.2B, classified" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">EXTERNAL IDs (JSON)</label>
                  <input value={form.externalIds} onChange={e => f("externalIds", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm font-mono focus:outline-none focus:border-primary" placeholder='{"iaea": "IRI-001", "osm": "12345678"}' />
                </div>
              </div>
            </div>
          )}

          {/* Sourcing */}
          {activeSection === "sourcing" && (
            <div className="space-y-4 max-w-2xl">
              <div className="p-3 border border-red-500/30 bg-red-500/5 text-[10px] font-mono text-red-400 flex items-start gap-2">
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-semibold mb-0.5">CRITICAL: SOURCE ACCURACY</div>
                  Every facility must cite at least one authoritative source. Acceptable sources: IAEA reports, UN documents,
                  government filings, official regulatory body publications, verified satellite imagery analysis, or official
                  facility websites. News reports are acceptable only for recent events. Wikipedia is NOT acceptable.
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">PRIMARY SOURCE URL</label>
                  <input value={form.primarySourceUrl} onChange={e => f("primarySourceUrl", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm font-mono focus:outline-none focus:border-primary" placeholder="https://www.iaea.org/..." />
                  {form.primarySourceUrl && (
                    <a href={form.primarySourceUrl} target="_blank" rel="noopener noreferrer"
                      className="text-[9px] text-primary hover:underline flex items-center gap-1 mt-1">
                      <ExternalLink size={8} />Verify this URL
                    </a>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">SOURCE ORGANIZATION</label>
                  <input value={form.primarySourceName} onChange={e => f("primarySourceName", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary" placeholder="e.g. IAEA, UN OCHA, US DoE" />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">SOURCE TYPE</label>
                  <select value={form.primarySourceType} onChange={e => f("primarySourceType", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">VERIFICATION STATUS</label>
                  <select value={form.verificationStatus} onChange={e => f("verificationStatus", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary">
                    {["unverified", "pending_review", "verified", "disputed", "classified"].map(v => (
                      <option key={v} value={v}>{v.replace(/_/g, " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">VERIFICATION NOTES</label>
                  <textarea value={form.verificationNotes} onChange={e => f("verificationNotes", e.target.value)} rows={2}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary resize-none"
                    placeholder="Cross-reference notes, discrepancies found, verification method used..." />
                </div>
              </div>
            </div>
          )}

          {/* Notes & Tags */}
          {activeSection === "notes" && (
            <div className="space-y-4 max-w-2xl">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">ANALYST NOTES (internal)</label>
                  <textarea value={form.notes} onChange={e => f("notes", e.target.value)} rows={4}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary resize-none"
                    placeholder="Internal notes, context, related facilities, strategic significance..." />
                </div>
                <div>
                  <label className="block text-[10px] font-mono text-muted-foreground mb-1">TAGS (comma-separated)</label>
                  <input value={form.tags} onChange={e => f("tags", e.target.value)}
                    className="w-full px-3 py-2 bg-input border border-border text-sm focus:outline-none focus:border-primary"
                    placeholder="e.g. nuclear, iran, enrichment, JCPOA, sanctions" />
                  {form.tags && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {form.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-primary/10 border border-primary/30 text-[10px] font-mono text-primary rounded">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sources (edit mode only) */}
          {activeSection === "sources" && editId && (
            <div className="space-y-4 max-w-2xl">
              <div className="flex items-center justify-between">
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">Source References</div>
                <button onClick={() => setShowSourceForm(!showSourceForm)}
                  className="flex items-center gap-1 px-2 py-1 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary transition-all">
                  <Plus size={9} />ADD SOURCE
                </button>
              </div>

              {showSourceForm && (
                <div className="p-3 border border-border bg-card/50 space-y-3">
                  <div className="text-[10px] font-mono text-primary">NEW SOURCE REFERENCE</div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="col-span-2">
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">SOURCE URL *</label>
                      <input value={newSource.url} onChange={e => setNewSource(p => ({ ...p, url: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs font-mono focus:outline-none focus:border-primary" placeholder="https://..." />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">ORGANIZATION *</label>
                      <input value={newSource.name} onChange={e => setNewSource(p => ({ ...p, name: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs focus:outline-none focus:border-primary" placeholder="e.g. IAEA" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">TYPE</label>
                      <select value={newSource.type} onChange={e => setNewSource(p => ({ ...p, type: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs focus:outline-none focus:border-primary">
                        {SOURCE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">CONFIRMS FIELDS</label>
                      <input value={newSource.confirms} onChange={e => setNewSource(p => ({ ...p, confirms: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs focus:outline-none focus:border-primary" placeholder="name, location, capacity" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">RELIABILITY (0-100)</label>
                      <input type="number" min={0} max={100} value={newSource.reliability} onChange={e => setNewSource(p => ({ ...p, reliability: parseInt(e.target.value) }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs font-mono focus:outline-none focus:border-primary" />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[9px] font-mono text-muted-foreground mb-1">NOTES</label>
                      <input value={newSource.notes} onChange={e => setNewSource(p => ({ ...p, notes: e.target.value }))}
                        className="w-full px-2 py-1.5 bg-input border border-border text-xs focus:outline-none focus:border-primary" placeholder="Additional context..." />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        if (!newSource.url || !newSource.name) { toast.error("URL and organization are required"); return; }
                        addSourceMutation.mutate({
                          facilityId: editId,
                          sourceUrl: newSource.url,
                          sourceName: newSource.name,
                          sourceType: newSource.type,
                          confirmsFields: newSource.confirms || undefined,
                          reliability: newSource.reliability,
                          notes: newSource.notes || undefined,
                          addedBy: "analyst",
                        });
                      }}
                      disabled={addSourceMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-mono hover:opacity-90 disabled:opacity-50">
                      <Check size={9} />{addSourceMutation.isPending ? "ADDING..." : "ADD SOURCE"}
                    </button>
                    <button onClick={() => setShowSourceForm(false)} className="px-3 py-1.5 border border-border text-[10px] font-mono text-muted-foreground hover:border-primary hover:text-primary">
                      CANCEL
                    </button>
                  </div>
                </div>
              )}

              {existingSources && existingSources.length > 0 ? (
                <div className="space-y-2">
                  {existingSources.map(src => (
                    <div key={src.id} className="p-3 border border-border bg-card/30 flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <a href={src.sourceUrl} target="_blank" rel="noopener noreferrer"
                          className="text-primary hover:underline text-xs flex items-center gap-1 font-medium">
                          <ExternalLink size={10} />{src.sourceName}
                        </a>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                          {src.sourceType?.replace(/_/g, " ")} · {src.reliability}% reliability
                          {src.confirmsFields && ` · Confirms: ${src.confirmsFields}`}
                        </div>
                        {src.notes && <div className="text-[9px] text-muted-foreground mt-1">{src.notes}</div>}
                      </div>
                      <button onClick={() => removeSourceMutation.mutate({ sourceId: src.id })}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                        <Trash2 size={11} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground text-xs font-mono">
                  No source references added yet
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search & Discover Sub-Tab ────────────────────────────────────────────────
type SearchHistoryEntry = { query: string; country: string; region: string; facilityType: string; ts: number; resultCount: number; results?: any[] };
type SearchFlowEvent = { step: string; status: 'ok' | 'warn' | 'info'; detail: string; ts: number };
type GroundingStatus = 'validated' | 'likely_accurate' | 'unverified' | 'disputed';

const GROUNDING_COLORS: Record<GroundingStatus | string, string> = {
  validated: '#22c55e',
  likely_accurate: '#86efac',
  unverified: '#f59e0b',
  disputed: '#ef4444',
};
const GROUNDING_LABELS: Record<GroundingStatus | string, string> = {
  validated: 'VALIDATED',
  likely_accurate: 'LIKELY ACCURATE',
  unverified: 'UNVERIFIED',
  disputed: 'DISPUTED',
};

const SEARCH_HISTORY_KEY = 'facility_search_history_v2';

function loadSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveSearchHistory(entries: SearchHistoryEntry[]) {
  try { localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(entries.slice(0, 20))); } catch {}
}

function GroundingBadge({ status }: { status: string }) {
  const color = GROUNDING_COLORS[status] ?? '#6b7280';
  const label = GROUNDING_LABELS[status] ?? status?.toUpperCase();
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-mono rounded border"
      style={{ borderColor: color + '60', color, background: color + '15' }}>
      {status === 'validated' ? <Check size={7} /> : status === 'disputed' ? <X size={7} /> : <AlertCircle size={7} />}
      {label}
    </span>
  );
}

function SearchFlowPanel({ events, isSearching, panelWidth, onResize }: {
  events: SearchFlowEvent[];
  isSearching: boolean;
  panelWidth: number;
  onResize: (w: number) => void;
}) {
  const resizeRef = useRef<HTMLDivElement>(null);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startW = useRef(0);
  const logRef = useRef<HTMLDivElement>(null);

  // Live DB ping query — refetches every 30s
  const { data: pingData, refetch: refetchPing, isFetching: pinging } = trpc.facilities.pingDatabases.useQuery(
    undefined,
    { staleTime: 30000, refetchInterval: 60000 }
  );

  const onMouseDown = (e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startW.current = panelWidth;
    e.preventDefault();
  };
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = startX.current - e.clientX;
      const newW = Math.max(260, Math.min(640, startW.current + delta));
      onResize(newW);
    };
    const onMouseUp = () => { isResizing.current = false; };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => { document.removeEventListener('mousemove', onMouseMove); document.removeEventListener('mouseup', onMouseUp); };
  }, [onResize]);

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [events]);

  const DB_STEPS = [
    { key: 'intelligence', name: 'Intelligence Model', icon: <Cpu size={9} />, color: '#6366f1' },
    { key: 'iaea',         name: 'IAEA Database',      icon: <Database size={9} />, color: 'var(--intel-yellow)' },
    { key: 'un',           name: 'UN Document Store',  icon: <Globe size={9} />, color: '#3b82f6' },
    { key: 'gov',          name: 'Gov. Filings',        icon: <FileText size={9} />, color: '#22c55e' },
    { key: 'satellite',    name: 'Satellite Registry', icon: <Layers size={9} />, color: '#a855f7' },
    { key: 'grounding',    name: 'Google Grounding',   icon: <Search size={9} />, color: 'var(--intel-red)' },
  ];

  const dbs = pingData?.databases ?? [];
  const onlineCount = dbs.filter(d => d.status === 'online').length;
  const totalCount = dbs.length;

  return (
    <div className="flex h-full" style={{ width: panelWidth }}>
      {/* Resize handle */}
      <div
        ref={resizeRef}
        onMouseDown={onMouseDown}
        className="w-1 cursor-col-resize bg-border hover:bg-primary/50 transition-colors flex-shrink-0 select-none"
        style={{ cursor: 'col-resize' }}
      />
      <div className="flex-1 flex flex-col overflow-hidden bg-card border-l border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/60 bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Network size={11} className="text-cyan-400" />
              {isSearching && <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />}
            </div>
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">INTEL SEARCH FLOW</span>
          </div>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <span className="text-[9px] font-mono" style={{ color: onlineCount === totalCount ? '#22c55e' : onlineCount > 0 ? '#f59e0b' : '#ef4444' }}>
                {onlineCount}/{totalCount} ONLINE
              </span>
            )}
            <button onClick={() => refetchPing()} disabled={pinging}
              className="text-muted-foreground hover:text-primary transition-colors" title="Refresh DB status">
              <RefreshCw size={9} className={pinging ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Live DB connection grid */}
        <div className="px-3 pt-3 pb-2 border-b border-border/40 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest">LIVE DATABASE CONNECTIONS</span>
            {pinging && <RefreshCw size={8} className="animate-spin text-muted-foreground" />}
          </div>
          <div className="space-y-1">
            {dbs.length === 0 ? (
              <div className="space-y-1">
                {DB_STEPS.map((db) => (
                  <div key={db.key} className="flex items-center gap-2 py-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-muted/30 flex-shrink-0" />
                    <span className="text-[9px] font-mono text-muted-foreground/50 flex-1">{db.name}</span>
                    <span className="text-[8px] font-mono text-muted-foreground/30">—</span>
                  </div>
                ))}
              </div>
            ) : (
              dbs.map((db) => {
                const isOnline = db.status === 'online';
                const isDegraded = db.status === 'degraded';
                const dotColor = isOnline ? '#22c55e' : isDegraded ? '#f59e0b' : '#ef4444';
                const textColor = isOnline ? '#86efac' : isDegraded ? '#fcd34d' : '#fca5a5';
                return (
                  <div key={db.id} className="flex items-center gap-2 py-0.5 group">
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isOnline ? 'animate-pulse' : ''}`}
                      style={{ background: dotColor, boxShadow: isOnline ? `0 0 4px ${dotColor}` : 'none' }} />
                    <span className="text-[9px] font-mono flex-1 truncate" style={{ color: textColor }}>{db.label}</span>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      {db.latency > 0 && (
                        <span className="text-[8px] font-mono" style={{ color: db.latency < 500 ? '#6b7280' : '#f59e0b' }}>
                          {db.latency}ms
                        </span>
                      )}
                      <span className="text-[8px] font-mono uppercase" style={{ color: dotColor }}>
                        {db.status}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {pingData?.ts && (
            <div className="text-[8px] font-mono text-muted-foreground/40 mt-2">
              Last checked {new Date(pingData.ts).toLocaleTimeString()}
            </div>
          )}
        </div>

        {/* Search pipeline nodes */}
        <div className="px-3 pt-2 pb-2 border-b border-border/40 flex-shrink-0">
          <div className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest mb-2">SEARCH PIPELINE</div>
          <div className="space-y-1">
            {DB_STEPS.map((db, i) => {
              const stepEvent = events.find(e => e.step.toLowerCase().includes(db.key));
              const isActive = isSearching && events.length >= i;
              const isDone = !!stepEvent;
              const isCurrentlyProcessing = isSearching && events.length === i;
              return (
                <div key={db.key} className="flex items-center gap-2">
                  {/* Connector line */}
                  <div className="flex flex-col items-center flex-shrink-0" style={{ width: 14 }}>
                    <div className={`w-2 h-2 rounded-full border transition-all duration-300 ${
                      isDone ? 'border-transparent' : isCurrentlyProcessing ? 'border-current animate-pulse' : 'border-muted/30'
                    }`} style={{ background: isDone ? db.color : isCurrentlyProcessing ? db.color + '40' : 'transparent',
                      boxShadow: isDone ? `0 0 6px ${db.color}60` : 'none', color: db.color }} />
                  </div>
                  <span className="text-[9px] font-mono flex-1 transition-colors duration-300"
                    style={{ color: isDone ? db.color : isCurrentlyProcessing ? db.color + 'cc' : '#374151' }}>
                    {db.name}
                  </span>
                  <div className="flex-shrink-0">
                    {isDone && <Check size={8} style={{ color: db.color }} />}
                    {isCurrentlyProcessing && <RefreshCw size={8} className="animate-spin" style={{ color: db.color }} />}
                    {!isDone && !isCurrentlyProcessing && isActive && (
                      <div className="w-1 h-1 rounded-full bg-muted/30" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Event log */}
        <div ref={logRef} className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono">
          {events.length === 0 && !isSearching ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 opacity-30">
              <Terminal size={18} className="text-muted-foreground" />
              <div className="text-[9px] text-muted-foreground text-center">
                AWAITING SEARCH QUERY<br />
                <span className="opacity-60">flow log will appear here</span>
              </div>
            </div>
          ) : (
            <>
              {isSearching && events.length === 0 && (
                <div className="flex items-center gap-2 text-[9px] text-cyan-400/70">
                  <span className="animate-pulse">▋</span>
                  Initializing intelligence query...
                </div>
              )}
              {events.map((ev, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`text-[9px] flex-shrink-0 mt-0.5 ${
                    ev.status === 'ok' ? 'text-green-400' : ev.status === 'warn' ? 'text-amber-400' : 'text-blue-400'
                  }`}>{'>'}</span>
                  <div className="flex-1 min-w-0">
                    <span className={`text-[9px] font-mono ${
                      ev.status === 'ok' ? 'text-green-300' : ev.status === 'warn' ? 'text-amber-300' : 'text-blue-300'
                    }`}>[{ev.step}]</span>
                    <div className="text-[9px] text-muted-foreground/70 leading-relaxed mt-0.5 break-words">{ev.detail}</div>
                  </div>
                </div>
              ))}
              {isSearching && events.length > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] text-cyan-400/60">
                  <RefreshCw size={8} className="animate-spin" />
                  <span className="animate-pulse">processing...</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer summary */}
        {!isSearching && events.length > 0 && (
          <div className="px-3 py-2 border-t border-border/40 flex-shrink-0 bg-card">
            <div className="flex items-center justify-between">
              <span className="text-[8px] font-mono text-muted-foreground">
                {events.length} STEPS · {events.filter(e => e.status === 'ok').length} OK · {events.filter(e => e.status === 'warn').length} WARN
              </span>
              <span className="text-[8px] font-mono text-green-400/70">COMPLETE</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function DiscoverTab({ region, onSwitchToPending }: { region: string; onSwitchToPending?: () => void }) {
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("");
  const [facilityType, setFacilityType] = useState("");
  const [maxResults, setMaxResults] = useState(5);
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [searchFlow, setSearchFlow] = useState<SearchFlowEvent[]>([]);
  const [searchHistory, setSearchHistory] = useState<SearchHistoryEntry[]>(() => loadSearchHistory());
  const [showHistory, setShowHistory] = useState(false);
  const [showNote, setShowNote] = useState(true);
  const [panelWidth, setPanelWidth] = useState(320);
  const [approvedIds, setApprovedIds] = useState<Set<string>>(new Set());
  const [rejectedIds, setRejectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const utils = trpc.useUtils();

  const searchMutation = trpc.facilities.searchOnline.useMutation({
    onSuccess: (data) => {
      const candidates = data.candidates ?? [];
      setResults(candidates);
      setSearchFlow((data as any).searchFlow ?? []);
      setSearching(false);
      setApprovedIds(new Set());
      setRejectedIds(new Set());
      if (data.count > 0) {
        toast.success(`${data.count} candidate facilities discovered`, { description: "Review and approve to add to registry" });
        const entry: SearchHistoryEntry = { query, country, region, facilityType, ts: Date.now(), resultCount: data.count, results: candidates };
        const updated = [entry, ...searchHistory.filter(h => h.query !== query)].slice(0, 20);
        setSearchHistory(updated);
        saveSearchHistory(updated);
      } else {
        toast.info("No facilities found", { description: "Try a different query or facility type" });
      }
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
    },
    onError: (e) => { toast.error("Search failed", { description: e.message }); setSearching(false); },
  });

  const approveMutation = trpc.facilities.approveCandidate.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Facility approved and added to registry", {
        description: `Re-enrichment job #${data.reenrichmentJobId} started — scanning all articles`,
        action: { label: "View Pending →", onClick: () => onSwitchToPending?.() },
      });
      setApprovedIds(prev => { const s = new Set(prev); s.add(String(variables.candidateId)); return s; });
      utils.facilities.search.invalidate();
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
      utils.facilities.detailedStats.invalidate();
    },
    onError: (e) => toast.error("Approval failed", { description: e.message }),
  });

  const rejectMutation = trpc.facilities.rejectCandidate.useMutation({
    onSuccess: (_, variables) => {
      toast.info("Candidate rejected");
      setRejectedIds(prev => { const s = new Set(prev); s.add(String(variables.candidateId)); return s; });
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
    },
  });

  const handleBulkApprove = async () => {
    const pending = results.filter(c => !approvedIds.has(String(c.id)) && !rejectedIds.has(String(c.id)));
    if (pending.length === 0) return;
    setBulkApproving(true);
    let approved = 0;
    for (const cand of pending) {
      try {
        await approveMutation.mutateAsync({ candidateId: cand.id, reviewedBy: 'analyst', reviewNotes: 'Bulk approved from discovery', regionOverride: region !== 'Global' ? region : undefined });
        approved++;
      } catch { /* individual errors shown by mutation */ }
    }
    setBulkApproving(false);
    toast.success(`${approved}/${pending.length} facilities approved`, {
      description: "All approved facilities added to registry",
      action: { label: "View Registry →", onClick: () => {} },
    });
  };

  const handleSearch = () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setSearching(true);
    setResults([]);
    setSearchFlow([]);
    setApprovedIds(new Set());
    setRejectedIds(new Set());
    searchMutation.mutate({
      query: query.trim(),
      country: country || undefined,
      region: region !== 'Global' ? region : undefined,
      facilityType: facilityType || undefined,
      maxResults,
      enableGrounding: true,
    });
  };

  const loadFromHistory = (entry: SearchHistoryEntry) => {
    setQuery(entry.query);
    setCountry(entry.country);
    setFacilityType(entry.facilityType);
    // Restore full results if saved
    if (entry.results && entry.results.length > 0) {
      setResults(entry.results);
      setSearchFlow([]);
      setApprovedIds(new Set());
      setRejectedIds(new Set());
    }
    setShowHistory(false);
  };

  const clearHistory = () => {
    setSearchHistory([]);
    saveSearchHistory([]);
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Search Panel — Terminal-style */}
        <div className="flex-shrink-0 border-b border-border bg-card">
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card">
            <div className="flex items-center gap-2">
              <Crosshair size={11} className="text-cyan-400" />
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">FACILITY DISCOVERY ENGINE</span>
              {region !== 'Global' && (
                <span className="px-1.5 py-0.5 border border-cyan-500/30 bg-cyan-500/10 text-[8px] font-mono text-cyan-400">
                  REGION: {region}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-[8px] font-mono text-green-400">
                <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                GROUNDING ACTIVE
              </div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className={`flex items-center gap-1 px-2 py-1 border text-[9px] font-mono transition-all ${
                  showHistory ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10' : 'border-border/50 text-muted-foreground hover:border-cyan-500/30 hover:text-cyan-400'
                }`}
              >
                <Clock size={8} />HISTORY {searchHistory.length > 0 && `(${searchHistory.length})`}
              </button>
            </div>
          </div>

          {/* History dropdown */}
          {showHistory && (
            <div className="border-b border-border/40 bg-card">
              <div className="flex items-center justify-between px-4 py-1.5 border-b border-border/30">
                <span className="text-[9px] font-mono text-muted-foreground">RECENT QUERIES</span>
                <button onClick={clearHistory} className="text-[8px] font-mono text-red-400/70 hover:text-red-400">CLEAR</button>
              </div>
              {searchHistory.length === 0 ? (
                <div className="px-4 py-3 text-[9px] font-mono text-muted-foreground/50">No query history</div>
              ) : (
                <div className="max-h-36 overflow-y-auto">
                  {searchHistory.map((entry, i) => (
                    <button key={i} onClick={() => loadFromHistory(entry)}
                      className="w-full flex items-center gap-3 px-4 py-1.5 hover:bg-cyan-500/5 transition-all border-b border-border/20 text-left">
                      <span className="text-[9px] font-mono text-cyan-400/50">&gt;</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-mono text-foreground/80 truncate block">{entry.query}</span>
                        <span className="text-[8px] font-mono text-muted-foreground/50">
                          {[entry.country, entry.facilityType, entry.region].filter(Boolean).join(' · ')}
                          {' · '}{entry.resultCount} results
                        </span>
                      </div>
                      <span className="text-[8px] font-mono text-muted-foreground/40">{new Date(entry.ts).toLocaleDateString()}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Terminal query input */}
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[9px] font-mono text-cyan-400/60">QUERY://</span>
              <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">natural language · wikipedia excluded · iaea/un/gov sources only</span>
            </div>
            <div className="flex items-stretch gap-0 border border-border/60 focus-within:border-cyan-500/50 transition-colors bg-background">
              <div className="flex items-center px-3 border-r border-border/40 flex-shrink-0">
                <span className="text-[11px] font-mono text-cyan-400">$</span>
              </div>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSearch()}
                className="flex-1 px-3 py-2.5 bg-transparent text-[12px] font-mono text-foreground focus:outline-none placeholder:text-muted-foreground/30"
                placeholder="nuclear facilities in Iran · oil refineries Saudi Arabia · military bases Syria..."
              />
              <button
                onClick={handleSearch}
                disabled={searching || !query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border-l border-cyan-500/30 text-cyan-400 text-[10px] font-mono hover:bg-cyan-600/30 disabled:opacity-40 transition-all whitespace-nowrap"
              >
                {searching ? <RefreshCw size={10} className="animate-spin" /> : <Search size={10} />}
                {searching ? 'SCANNING...' : 'EXECUTE'}
              </button>
            </div>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 px-4 pb-3">
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-muted-foreground/50 uppercase">Country:</span>
              <input
                value={country}
                onChange={e => setCountry(e.target.value)}
                className="w-28 px-2 py-1 bg-background border border-border/40 text-[10px] font-mono text-foreground focus:outline-none focus:border-cyan-500/40 placeholder:text-muted-foreground/30"
                placeholder="any"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-muted-foreground/50 uppercase">Type:</span>
              <select
                value={facilityType}
                onChange={e => setFacilityType(e.target.value)}
                className="px-2 py-1 bg-background border border-border/40 text-[10px] font-mono text-foreground focus:outline-none focus:border-cyan-500/40"
              >
                <option value="">any</option>
                {FACILITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[8px] font-mono text-muted-foreground/50 uppercase">Limit:</span>
              <div className="flex">
                {[3, 5, 8, 10].map(n => (
                  <button key={n} onClick={() => setMaxResults(n)}
                    className={`w-6 h-6 text-[9px] font-mono border-t border-b border-r first:border-l transition-all ${
                      maxResults === n
                        ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/15'
                        : 'border-border/40 text-muted-foreground/50 hover:border-cyan-500/30 hover:text-cyan-400'
                    }`}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div className="ml-auto">
              <button
                onClick={() => setShowNote(!showNote)}
                className="text-[8px] font-mono text-muted-foreground/40 hover:text-muted-foreground transition-colors"
              >
                {showNote ? '[ hide note ]' : '[ show note ]'}
              </button>
            </div>
          </div>

          {/* Collapsible note */}
          {showNote && (
            <div className="mx-4 mb-3 px-3 py-2 border border-amber-500/20 bg-amber-500/5 text-[9px] font-mono text-amber-400/70 flex items-start gap-2">
              <AlertTriangle size={9} className="flex-shrink-0 mt-0.5" />
              <span>
                AI-powered search with Google Grounding validation. Cross-referenced against IAEA, UN, government, and official databases.
                All candidates require approval before registry entry. Wikipedia excluded. Region lock: <strong className="text-amber-400">{region}</strong>.
              </span>
            </div>
          )}
        </div>

        {/* Results area */}
        <div className="flex-1 overflow-y-auto p-4">
          {searching && (
            <div className="flex flex-col items-center justify-center h-64 gap-4 font-mono">
              {/* Radar animation */}
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border border-primary/20" />
                <div className="absolute inset-2 rounded-full border border-cyan-500/30" />
                <div className="absolute inset-4 rounded-full border border-cyan-500/40" />
                <div className="absolute inset-6 rounded-full border border-cyan-500/50" />
                {/* Sweep */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div className="absolute inset-0 origin-center animate-spin" style={{ animationDuration: '2s' }}>
                    <div className="absolute top-0 left-1/2 w-px h-1/2 origin-bottom"
                      style={{ background: 'linear-gradient(to top, #06b6d480, transparent)' }} />
                  </div>
                </div>
                {/* Center dot */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                </div>
              </div>
              <div className="text-[11px] text-cyan-400 tracking-widest animate-pulse">SCANNING INTELLIGENCE SOURCES</div>
              <div className="flex gap-2">
                {[
                  { id: 'IAEA', color: 'var(--intel-yellow)' },
                  { id: 'UN', color: '#3b82f6' },
                  { id: 'GOV', color: '#22c55e' },
                  { id: 'SAT', color: '#a855f7' },
                  { id: 'GRD', color: 'var(--intel-red)' },
                ].map((db, i) => (
                  <div key={db.id} className="flex flex-col items-center gap-1">
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: db.color, animationDelay: `${i * 0.3}s` }} />
                    <span className="text-[8px] font-mono" style={{ color: db.color + '99' }}>{db.id}</span>
                  </div>
                ))}
              </div>
              <div className="text-[9px] text-muted-foreground/50">Wikipedia excluded · Authoritative sources only</div>
            </div>
          )}

          {!searching && results.length === 0 && !searchMutation.isSuccess && (
            <div className="flex flex-col items-center justify-center h-full gap-4 font-mono">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border border-cyan-500/10 flex items-center justify-center">
                  <div className="w-10 h-10 rounded-full border border-primary/20 flex items-center justify-center">
                    <Crosshair size={18} className="text-cyan-500/30" />
                  </div>
                </div>
              </div>
              <div className="text-center">
                <div className="text-[11px] text-muted-foreground/50 tracking-widest uppercase mb-1">Facility Discovery Engine</div>
                <div className="text-[9px] text-muted-foreground/30 max-w-xs text-center">
                  Enter a natural language query to scan IAEA, UN, government, and official databases.
                  Wikipedia excluded. All results validated via Google Grounding.
                </div>
              </div>
              <div className="flex gap-3 mt-2">
                {['nuclear facilities Iran', 'oil refineries Gulf', 'military bases Syria'].map(q => (
                  <button key={q} onClick={() => { setQuery(q); }}
                    className="px-2 py-1 border border-border/30 text-[8px] font-mono text-muted-foreground/40 hover:border-cyan-500/30 hover:text-cyan-400/60 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {!searching && results.length === 0 && searchMutation.isSuccess && (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <AlertCircle size={32} className="opacity-30" />
              <div className="text-xs font-mono">NO FACILITIES FOUND</div>
              <div className="text-[10px] font-mono opacity-60">Try a different query, country, or facility type</div>
            </div>
          )}

          {!searching && results.length > 0 && (
            <div className="space-y-2">
              {/* Results header bar */}
              <div className="flex items-center gap-3 px-1 mb-2 font-mono flex-wrap">
                <span className="text-[9px] text-cyan-400/70">●</span>
                <span className="text-[10px] text-muted-foreground">
                  {results.length} CANDIDATES DETECTED
                </span>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-[9px] text-green-400">
                    {results.filter(r => r.groundingStatus === 'validated' || r.groundingStatus === 'likely_accurate').length} ✓ VALIDATED
                  </span>
                  <span className="text-[9px] text-amber-400">
                    {results.filter(r => r.groundingStatus === 'unverified').length} ⚠ UNVERIFIED
                  </span>
                  {results.filter(r => r.groundingStatus === 'disputed').length > 0 && (
                    <span className="text-[9px] text-red-400">
                      {results.filter(r => r.groundingStatus === 'disputed').length} ✕ DISPUTED
                    </span>
                  )}
                  {approvedIds.size > 0 && (
                    <span className="text-[9px] text-green-400 border border-green-500/30 px-1.5 py-0.5 bg-green-500/10">
                      {approvedIds.size} ✓ APPROVED
                    </span>
                  )}
                </div>
                <div className="ml-auto flex items-center gap-2">
                  {results.filter(c => !approvedIds.has(String(c.id)) && !rejectedIds.has(String(c.id))).length > 0 && (
                    <button
                      onClick={handleBulkApprove}
                      disabled={bulkApproving}
                      className="flex items-center gap-1.5 px-3 py-1 bg-green-600/20 border border-green-500/40 text-green-400 text-[9px] font-mono hover:bg-green-600/30 disabled:opacity-50 transition-all"
                    >
                      {bulkApproving ? (
                        <><RefreshCw size={9} className="animate-spin" />APPROVING ALL...</>
                      ) : (
                        <><Check size={9} />APPROVE ALL ({results.filter(c => !approvedIds.has(String(c.id)) && !rejectedIds.has(String(c.id))).length})</>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {results.map((cand, i) => {
                const gColor = GROUNDING_COLORS[cand.groundingStatus ?? 'unverified'];
                const conf = cand.confidenceScore ?? 0;
                const confPct = Math.round(conf * 100);
                const isApproved = approvedIds.has(String(cand.id));
                const isRejected = rejectedIds.has(String(cand.id));
                return (
                  <div key={cand.id ?? i} className={`border bg-card transition-all group relative ${
                    isApproved ? 'border-green-500/60 opacity-75' : isRejected ? 'border-red-500/40 opacity-50' : 'border-border/50 hover:border-cyan-500/30'
                  }`}>
                    {/* Approved overlay */}
                    {isApproved && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/20 border border-green-500/50 backdrop-blur-sm">
                          <CheckCircle2 size={14} className="text-green-400" />
                          <span className="text-[10px] font-mono text-green-400 font-bold">APPROVED — ADDED TO REGISTRY</span>
                        </div>
                      </div>
                    )}
                    {/* Rejected overlay */}
                    {isRejected && (
                      <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/15 border border-red-500/40 backdrop-blur-sm">
                          <XCircle size={14} className="text-red-400" />
                          <span className="text-[10px] font-mono text-red-400">REJECTED</span>
                        </div>
                      </div>
                    )}
                    {/* Top accent bar: grounding color */}
                    <div className="h-px w-full" style={{ background: `linear-gradient(to right, ${isApproved ? '#22c55e' : isRejected ? '#ef4444' : gColor}80, transparent)` }} />

                    {/* Card header */}
                    <div className="flex items-start gap-3 px-4 pt-3 pb-2 border-b border-border/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-[8px] font-mono text-muted-foreground/40">[{String(i + 1).padStart(2, '0')}]</span>
                          <span className="font-semibold text-[13px] text-foreground tracking-tight">{cand.name}</span>
                          {cand.nameAr && <span className="text-muted-foreground/60 text-[10px]" dir="rtl">{cand.nameAr}</span>}
                          <TypeBadge type={cand.type} />
                          <GroundingBadge status={cand.groundingStatus ?? 'unverified'} />
                        </div>
                        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground/60">
                          <span className="flex items-center gap-1">
                            <MapPin size={8} />{cand.country}{cand.city ? `, ${cand.city}` : ''}
                          </span>
                          {cand.latitude && cand.longitude && (
                            <a href={`https://www.google.com/maps?q=${cand.latitude},${cand.longitude}`} target="_blank" rel="noopener noreferrer"
                              className="text-cyan-400/60 hover:text-cyan-400 flex items-center gap-0.5 transition-colors">
                              <ExternalLink size={7} />{Number(cand.latitude).toFixed(4)}°N, {Number(cand.longitude).toFixed(4)}°E
                            </a>
                          )}
                          {cand.region && <span className="px-1 border border-border/30 text-[8px]">{cand.region}</span>}
                          {cand.operationalSince && <span>est. {cand.operationalSince}</span>}
                        </div>
                      </div>

                      {/* Right: threat + confidence meters */}
                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[8px] font-mono text-muted-foreground/40 uppercase">threat</span>
                          <ThreatBadge level={cand.threatLevel ?? 'low'} />
                        </div>
                        {cand.confidenceScore != null && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[8px] font-mono text-muted-foreground/40">conf</span>
                            <div className="w-16 h-1 bg-muted/20 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all" style={{
                                width: `${confPct}%`,
                                background: confPct >= 80 ? '#22c55e' : confPct >= 60 ? '#f59e0b' : '#ef4444'
                              }} />
                            </div>
                            <span className="text-[8px] font-mono" style={{ color: confPct >= 80 ? '#86efac' : confPct >= 60 ? '#fcd34d' : '#fca5a5' }}>
                              {confPct}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Card body */}
                    <div className="px-4 py-2.5">
                      {cand.description && (
                        <p className="text-[11px] text-muted-foreground/70 leading-relaxed mb-2">{cand.description}</p>
                      )}
                      {cand.groundingNotes && (
                        <div className="flex items-start gap-1.5 px-2 py-1.5 border-l-2 border-cyan-500/30 bg-cyan-500/5 mb-2">
                          <Shield size={8} className="text-cyan-400/50 flex-shrink-0 mt-0.5" />
                          <span className="text-[9px] text-cyan-300/60 italic">{cand.groundingNotes}</span>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-[9px] font-mono mb-2">
                        {cand.operator && <span className="text-muted-foreground/40">OPERATOR <span className="text-foreground/70">{cand.operator}</span></span>}
                        {cand.owner && <span className="text-muted-foreground/40">OWNER <span className="text-foreground/70">{cand.owner}</span></span>}
                        {cand.capacity && <span className="text-muted-foreground/40">CAPACITY <span className="text-foreground/70">{cand.capacity}</span></span>}
                        {cand.estimatedValue && <span className="text-muted-foreground/40">VALUE <span className="text-foreground/70">{cand.estimatedValue}</span></span>}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        {cand.sourceUrl && (
                          <a href={cand.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-[9px] font-mono text-cyan-400/50 hover:text-cyan-400 transition-colors">
                            <BookOpen size={8} />{cand.sourceName ?? 'Source'}<ExternalLink size={7} />
                            {cand.sourceType && <span className="text-muted-foreground/30">({cand.sourceType.replace(/_/g, ' ')})</span>}
                          </a>
                        )}
                        {Array.isArray(cand.tags) && cand.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} className="px-1 py-0.5 border border-border/30 text-[8px] font-mono text-muted-foreground/40">{tag}</span>
                        ))}
                      </div>
                    </div>

                    {/* Card footer: actions */}
                    <div className="flex items-center gap-2 px-4 py-2 border-t border-border/20 bg-background/50">
                      <button
                        onClick={() => approveMutation.mutate({ candidateId: cand.id, reviewedBy: 'analyst', reviewNotes: 'Approved from discovery search', regionOverride: region !== 'Global' ? region : undefined })}
                        disabled={approveMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1 bg-green-600/15 border border-green-500/30 text-green-400 text-[9px] font-mono hover:bg-green-600/25 disabled:opacity-40 transition-all"
                      >
                        <Check size={9} />APPROVE &amp; ADD TO REGISTRY
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ candidateId: cand.id, reviewedBy: 'analyst' })}
                        disabled={rejectMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-1 bg-red-600/10 border border-red-500/20 text-red-400/70 text-[9px] font-mono hover:bg-red-600/15 disabled:opacity-40 transition-all"
                      >
                        <X size={9} />REJECT
                      </button>
                      <a
                        href={`https://www.google.com/maps?q=${cand.latitude},${cand.longitude}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-1 border border-border/30 text-muted-foreground/50 text-[9px] font-mono hover:border-cyan-500/30 hover:text-cyan-400/70 transition-all ml-auto"
                      >
                        <MapPin size={9} />VERIFY ON MAP
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Right: Search Flow Panel */}
      <SearchFlowPanel
        events={searchFlow}
        isSearching={searching}
        panelWidth={panelWidth}
        onResize={setPanelWidth}
      />
    </div>
  );
}

// ─── Pending Approval Sub-Tab ─────────────────────────────────────────────────
const THREAT_ROW_COLORS: Record<string, string> = {
  critical: 'border-l-red-500 bg-red-500/5',
  high: 'border-l-orange-500 bg-orange-500/5',
  medium: 'border-l-yellow-500 bg-yellow-500/5',
  low: 'border-l-border bg-transparent',
};

const THREAT_LEFT_BORDER: Record<string, string> = {
  critical: 'border-l-4 border-l-red-500',
  high: 'border-l-4 border-l-orange-500',
  medium: 'border-l-4 border-l-yellow-500',
  low: 'border-l-4 border-l-border',
};

const THREAT_GLOW: Record<string, string> = {
  critical: 'shadow-[0_0_12px_rgba(239,68,68,0.15)]',
  high: 'shadow-[0_0_12px_rgba(249,115,22,0.12)]',
  medium: 'shadow-[0_0_12px_rgba(234,179,8,0.10)]',
  low: '',
};

function PendingTab({ region }: { region: string }) {
  const [filterStatus, setFilterStatus] = useState("pending");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [regionOverride, setRegionOverride] = useState("");
  const [threatOverride, setThreatOverride] = useState("");
  const [importanceOverride, setImportanceOverride] = useState<number | "">("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [approvedInSession, setApprovedInSession] = useState<Set<number>>(new Set());
  const [rejectedInSession, setRejectedInSession] = useState<Set<number>>(new Set());
  const [articleSearch, setArticleSearch] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  const { data: statusCounts, refetch: refetchCounts } = trpc.facilities.candidateStatusCounts.useQuery(
    { region: region !== 'Global' ? region : undefined },
    { staleTime: 10000 }
  );
  const { data, isLoading, refetch } = trpc.facilities.listCandidates.useQuery({
    reviewStatus: filterStatus || undefined,
    region: region !== 'Global' ? region : undefined,
    limit: 100,
  }, { staleTime: 10000 });
  const { data: candidateArticlesData, isLoading: articlesLoading } = trpc.facilities.candidateMatchingArticles.useQuery(
    { candidateId: selectedId!, limit: 20 },
    { enabled: !!selectedId, staleTime: 60000 }
  );

  const approveMutation = trpc.facilities.approveCandidate.useMutation({
    onSuccess: (data, variables) => {
      toast.success("Facility approved — added to registry", {
        description: `Re-enrichment job #${data.reenrichmentJobId} started.`,
        action: { label: "View Registry →", onClick: () => {} },
      });
      setApprovedInSession(prev => { const s = new Set(prev); s.add(variables.candidateId); return s; });
      utils.facilities.search.invalidate();
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
      utils.facilities.detailedStats.invalidate();
      setReviewNotes(""); setRegionOverride(""); setThreatOverride(""); setImportanceOverride("");
    },
    onError: (e) => toast.error("Approval failed", { description: e.message }),
  });
  const rejectMutation = trpc.facilities.rejectCandidate.useMutation({
    onSuccess: (_, variables) => {
      toast.info("Candidate rejected");
      setRejectedInSession(prev => { const s = new Set(prev); s.add(variables.candidateId); return s; });
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
      setReviewNotes("");
    },
  });
  const markUnderReviewMutation = trpc.facilities.markUnderReview.useMutation({
    onSuccess: () => {
      toast.info("Marked as under review");
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
    },
  });
  const updateCandidateMutation = trpc.facilities.updateCandidate.useMutation({
    onSuccess: () => {
      toast.success("Candidate updated");
      utils.facilities.listCandidates.invalidate();
      setEditingField(null); setEditValues({});
    },
    onError: (e) => toast.error("Update failed", { description: e.message }),
  });
  const deleteMutation = trpc.facilities.deleteCandidate.useMutation({
    onSuccess: () => {
      toast.success("Candidate deleted");
      utils.facilities.listCandidates.invalidate();
      utils.facilities.candidateStatusCounts.invalidate();
      setSelectedId(null);
    },
  });

  const rows = data?.rows ?? [];
  const selectedRow = rows.find(r => r.id === selectedId);

  const handleBulkApprove = () => {
    Array.from(selectedIds).forEach(id =>
      approveMutation.mutate({ candidateId: id, reviewedBy: 'analyst', reviewNotes: 'Bulk approved', regionOverride: region !== 'Global' ? region : undefined })
    );
    setSelectedIds(new Set());
  };
  const handleBulkReject = () => {
    Array.from(selectedIds).forEach(id =>
      rejectMutation.mutate({ candidateId: id, reviewedBy: 'analyst', reviewNotes: 'Bulk rejected' })
    );
    setSelectedIds(new Set());
  };
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === rows.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(rows.map(r => r.id)));
  };
  const startEdit = (field: string, value: string) => { setEditingField(field); setEditValues({ [field]: value }); };
  const saveEdit = (candidateId: number) => {
    if (!editingField) return;
    updateCandidateMutation.mutate({ id: candidateId, ...editValues as any });
  };

  const STATUS_TABS = [
    { value: "", label: "ALL", count: statusCounts?.total ?? 0, color: "text-muted-foreground" },
    { value: "pending", label: "PENDING", count: statusCounts?.pending ?? 0, color: "text-amber-400" },
    { value: "under_review", label: "IN REVIEW", count: statusCounts?.under_review ?? 0, color: "text-blue-400" },
    { value: "approved", label: "APPROVED", count: statusCounts?.approved ?? 0, color: "text-green-400" },
    { value: "rejected", label: "REJECTED", count: statusCounts?.rejected ?? 0, color: "text-red-400" },
  ];

  const filteredArticles = (candidateArticlesData?.articles ?? []).filter(a =>
    !articleSearch || a.title?.toLowerCase().includes(articleSearch.toLowerCase()) ||
    a.agencyName?.toLowerCase().includes(articleSearch.toLowerCase())
  );

  // ── Inline editable field ──────────────────────────────────────────────────
  const EditableField = ({ field, label, value, multiline = false }: { field: string; label: string; value: string; multiline?: boolean }) => {
    if (!selectedRow) return null;
    const isEditing = editingField === field;
    return (
      <div className="group">
        <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-0.5">{label}</div>
        {isEditing ? (
          <div className="flex items-start gap-1">
            {multiline ? (
              <textarea
                value={editValues[field] ?? ""}
                onChange={e => setEditValues({ [field]: e.target.value })}
                rows={3}
                className="flex-1 px-2 py-1 bg-input border border-primary text-[11px] font-mono text-foreground focus:outline-none resize-none"
                autoFocus
              />
            ) : (
              <input
                value={editValues[field] ?? ""}
                onChange={e => setEditValues({ [field]: e.target.value })}
                className="flex-1 px-2 py-1 bg-input border border-primary text-[11px] font-mono text-foreground focus:outline-none"
                autoFocus
              />
            )}
            <button onClick={() => saveEdit(selectedRow.id)}
              className="p-1 text-green-400 hover:text-green-300 transition-colors">
              <Check size={10} />
            </button>
            <button onClick={() => { setEditingField(null); setEditValues({}); }}
              className="p-1 text-muted-foreground hover:text-foreground transition-colors">
              <X size={10} />
            </button>
          </div>
        ) : (
          <div className="flex items-start gap-1 min-h-[20px]">
            <span className="flex-1 text-[11px] font-mono text-foreground/90 leading-relaxed">
              {value || <span className="text-muted-foreground/40 italic">—</span>}
            </span>
            <button onClick={() => startEdit(field, value)}
              className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground/50 hover:text-primary transition-all">
              <Edit3 size={9} />
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">

      {/* ── Column 1: Queue ─────────────────────────────────────────────── */}
      <div className="w-[300px] flex-shrink-0 flex flex-col border-r border-border/60 bg-card">

        {/* Header */}
        <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-border/60">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span className="text-[11px] font-mono text-amber-400 uppercase tracking-widest">TRIAGE QUEUE</span>
            </div>
            <div className="flex items-center gap-1">
              {region !== 'Global' && (
                <span className="px-1.5 py-0.5 bg-primary/10 border border-primary/30 text-[8px] font-mono text-primary">{region}</span>
              )}
              <button onClick={() => { refetch(); refetchCounts(); }} className="p-1 text-muted-foreground hover:text-foreground">
                <RefreshCw size={10} />
              </button>
            </div>
          </div>
          {/* Status tabs */}
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value}
                onClick={() => { setFilterStatus(tab.value); setSelectedId(null); setSelectedIds(new Set()); }}
                className={`flex items-center gap-1 px-2 py-0.5 text-[9px] font-mono border transition-all ${
                  filterStatus === tab.value
                    ? 'border-primary/60 bg-primary/10 text-primary'
                    : 'border-border/40 text-muted-foreground hover:border-border hover:text-foreground'
                }`}>
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[8px] font-bold ${filterStatus === tab.value ? 'text-primary' : tab.color}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk toolbar */}
        {rows.length > 0 && (
          <div className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 border-b border-border/40 bg-background">
            <input type="checkbox" checked={selectedIds.size === rows.length && rows.length > 0}
              onChange={toggleSelectAll} className="w-3 h-3 accent-primary" />
            <span className="text-[9px] font-mono text-muted-foreground flex-1">
              {selectedIds.size > 0 ? `${selectedIds.size} sel.` : `${rows.length} items`}
            </span>
            {selectedIds.size > 0 ? (
              <>
                <button onClick={handleBulkApprove}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-green-600/20 border border-green-500/40 text-green-400 text-[8px] font-mono hover:bg-green-600/30 transition-all">
                  <Check size={7} />APPROVE
                </button>
                <button onClick={handleBulkReject}
                  className="flex items-center gap-0.5 px-1.5 py-0.5 bg-red-600/10 border border-red-500/30 text-red-400 text-[8px] font-mono hover:bg-red-600/20 transition-all">
                  <X size={7} />REJECT
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="px-1.5 py-0.5 border border-border text-[8px] font-mono text-muted-foreground hover:text-foreground transition-all">
                  CLR
                </button>
              </>
            ) : (
              (statusCounts?.pending ?? 0) > 0 && (
                <button onClick={() => setSelectedIds(new Set(rows.filter(r => r.reviewStatus === 'pending').map(r => r.id)))}
                  className="text-[8px] font-mono text-amber-400/70 hover:text-amber-400 transition-colors">
                  SEL PENDING
                </button>
              )
            )}
          </div>
        )}

        {/* Session progress */}
        {(approvedInSession.size > 0 || rejectedInSession.size > 0) && (
          <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1 bg-background border-b border-border/30 text-[8px] font-mono">
            {approvedInSession.size > 0 && (
              <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={7} />{approvedInSession.size} approved</span>
            )}
            {rejectedInSession.size > 0 && (
              <span className="flex items-center gap-1 text-red-400"><XCircle size={7} />{rejectedInSession.size} rejected</span>
            )}
          </div>
        )}

        {/* List */}
        <div ref={listRef} className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-xs font-mono">
              <RefreshCw size={12} className="animate-spin mr-2" />LOADING...
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-muted-foreground">
              <Shield size={24} className="opacity-20" />
              <div className="text-[10px] font-mono text-center">NO CANDIDATES<br /><span className="opacity-50">in {filterStatus || 'queue'}</span></div>
            </div>
          ) : (
            rows.map(cand => {
              const isSelected = selectedId === cand.id;
              const isChecked = selectedIds.has(cand.id);
              const tl = cand.threatLevel ?? 'low';
              const threatBorderColor = { critical: '#ef4444', high: '#f97316', medium: '#eab308', low: '#374151' }[tl] ?? '#374151';
              const isApproved = approvedInSession.has(cand.id);
              const isRejected = rejectedInSession.has(cand.id);
              return (
                <div
                  key={cand.id}
                  onClick={() => setSelectedId(isSelected ? null : cand.id)}
                  className={`relative flex items-start gap-2 px-3 py-2.5 border-b border-border/30 cursor-pointer transition-all border-l-[3px] ${
                    isSelected
                      ? 'bg-primary/8 border-l-primary'
                      : isApproved ? 'bg-green-500/5 border-l-green-500/60 opacity-60'
                      : isRejected ? 'bg-red-500/5 border-l-red-500/60 opacity-60'
                      : 'hover:bg-foreground/3'
                  }`}
                  style={!isSelected && !isApproved && !isRejected ? { borderLeftColor: threatBorderColor + '80' } : undefined}
                >
                  {/* Checkbox */}
                  <div className="flex-shrink-0 pt-0.5" onClick={e => { e.stopPropagation(); toggleSelect(cand.id); }}>
                    <input type="checkbox" checked={isChecked} onChange={() => {}} className="w-3 h-3 accent-primary" />
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-1">
                      <span className="text-[11px] font-mono text-foreground/90 leading-tight truncate flex-1">
                        {cand.name}
                      </span>
                      {isApproved && <CheckCircle2 size={10} className="text-green-400 flex-shrink-0 mt-0.5" />}
                      {isRejected && <XCircle size={10} className="text-red-400 flex-shrink-0 mt-0.5" />}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[8px] font-mono text-muted-foreground/70">{cand.country}</span>
                      <span className="text-[8px] font-mono text-muted-foreground/40">·</span>
                      <span className="text-[8px] font-mono" style={{ color: THREAT_COLORS[tl] ?? '#6b7280' }}>{tl.toUpperCase()}</span>
                      <span className="text-[8px] font-mono text-muted-foreground/40">·</span>
                      <span className="text-[8px] font-mono text-muted-foreground/60">{cand.type}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      {cand.reviewStatus === 'pending' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono border border-amber-500/40 text-amber-400 bg-amber-500/8">PENDING</span>
                      )}
                      {cand.reviewStatus === 'under_review' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono border border-blue-500/40 text-blue-400 bg-blue-500/8">IN REVIEW</span>
                      )}
                      {cand.reviewStatus === 'approved' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono border border-green-500/40 text-green-400 bg-green-500/8">APPROVED</span>
                      )}
                      {cand.reviewStatus === 'rejected' && (
                        <span className="px-1 py-0.5 text-[7px] font-mono border border-red-500/40 text-red-400 bg-red-500/8">REJECTED</span>
                      )}
                      {cand.sourceType && (
                        <span className="px-1 py-0.5 text-[7px] font-mono border border-border/40 text-muted-foreground/60">{cand.sourceType}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Column 2: Detail Panel ──────────────────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col border-r border-border/60 overflow-hidden">
        {selectedRow ? (
          <>
            {/* Classified header */}
            <div className="flex-shrink-0 bg-background border-b border-border/60">
              <div className="h-px w-full bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
              <div className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">CANDIDATE REVIEW</span>
                  </div>
                  <span className="px-2 py-0.5 text-[8px] font-mono border border-cyan-500/30 text-cyan-400/60">
                    ID-{selectedRow.id}
                  </span>
                  <ThreatBadge level={selectedRow.threatLevel ?? 'low'} />
                  <TypeBadge type={selectedRow.type} />
                </div>
                <div className="flex items-center gap-1.5">
                  {selectedRow.reviewStatus === 'pending' && (
                    <button
                      onClick={() => markUnderReviewMutation.mutate({ candidateId: selectedRow.id, reviewedBy: 'analyst' })}
                      disabled={markUnderReviewMutation.isPending}
                      className="flex items-center gap-1 px-2 py-1 border border-blue-500/40 text-blue-400 text-[9px] font-mono hover:bg-blue-500/10 disabled:opacity-50 transition-all">
                      <Eye size={9} />MARK IN REVIEW
                    </button>
                  )}
                  <button onClick={() => setSelectedId(null)} className="p-1 text-muted-foreground hover:text-foreground">
                    <X size={12} />
                  </button>
                </div>
              </div>
              {/* Facility name bar */}
              <div className="px-4 pb-3">
                <h2 className="text-lg font-mono text-foreground leading-tight">{selectedRow.name}</h2>
                {selectedRow.nameAr && <div className="text-[11px] font-mono text-muted-foreground/70 mt-0.5 text-right" dir="rtl">{selectedRow.nameAr}</div>}
                {selectedRow.nameAlias && <div className="text-[10px] font-mono text-muted-foreground/50 mt-0.5">aka: {selectedRow.nameAlias}</div>}
              </div>
            </div>

            {/* Scrollable detail body */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">

              {/* Location grid */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <MapPin size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Location</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-4">
                  <EditableField field="country" label="Country" value={selectedRow.country ?? ''} />
                  <EditableField field="region" label="Region" value={selectedRow.region ?? ''} />
                  <EditableField field="city" label="City" value={selectedRow.city ?? ''} />
                  <EditableField field="address" label="Address" value={selectedRow.address ?? ''} />
                  <EditableField field="latitude" label="Latitude" value={selectedRow.latitude?.toString() ?? ''} />
                  <EditableField field="longitude" label="Longitude" value={selectedRow.longitude?.toString() ?? ''} />
                </div>
                {selectedRow.latitude && selectedRow.longitude && (
                  <div className="mt-2 pl-4">
                    <iframe
                      src={`https://www.openstreetmap.org/export/embed.html?bbox=${Number(selectedRow.longitude)-0.05},${Number(selectedRow.latitude)-0.05},${Number(selectedRow.longitude)+0.05},${Number(selectedRow.latitude)+0.05}&layer=mapnik&marker=${selectedRow.latitude},${selectedRow.longitude}`}
                      className="w-full h-28 border border-border/40 rounded"
                      title="Location preview"
                    />
                  </div>
                )}
              </div>

              {/* Operational grid */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Activity size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Operational</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-4">
                  <EditableField field="operator" label="Operator" value={selectedRow.operator ?? ''} />
                  <EditableField field="owner" label="Owner" value={selectedRow.owner ?? ''} />
                  <EditableField field="capacity" label="Capacity" value={selectedRow.capacity ?? ''} />
                  <EditableField field="personnel" label="Personnel" value={selectedRow.personnel ?? ''} />
                  <EditableField field="status" label="Status" value={selectedRow.status ?? ''} />
                  <EditableField field="operationalSince" label="Operational Since" value={selectedRow.operationalSince ?? ''} />
                </div>
              </div>

              {/* Intelligence */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Shield size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Intelligence</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-4">
                  <div>
                    <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-0.5">Threat Level</div>
                    <select
                      value={threatOverride || selectedRow.threatLevel || 'low'}
                      onChange={e => setThreatOverride(e.target.value)}
                      className="w-full px-2 py-1 bg-input border border-border text-[11px] font-mono focus:outline-none focus:border-primary"
                    >
                      {['low','medium','high','critical'].map(l => <option key={l} value={l}>{l.toUpperCase()}</option>)}
                    </select>
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-0.5">Importance (1-10)</div>
                    <input
                      type="number" min={1} max={10}
                      value={importanceOverride !== "" ? importanceOverride : (selectedRow.importance ?? 5)}
                      onChange={e => setImportanceOverride(e.target.value === "" ? "" : Number(e.target.value))}
                      className="w-full px-2 py-1 bg-input border border-border text-[11px] font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-0.5">Region Override</div>
                    <input
                      value={regionOverride}
                      onChange={e => setRegionOverride(e.target.value)}
                      placeholder={selectedRow.region ?? 'MENA'}
                      className="w-full px-2 py-1 bg-input border border-border text-[11px] font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
                  <EditableField field="groundingStatus" label="Grounding" value={selectedRow.groundingStatus ?? 'unverified'} />
                </div>
                <div className="mt-2 pl-4">
                  <EditableField field="description" label="Description" value={selectedRow.description ?? ''} multiline />
                </div>
              </div>

              {/* Source */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Database size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Source</span>
                </div>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2 pl-4">
                  <EditableField field="sourceName" label="Source Name" value={selectedRow.sourceName ?? ''} />
                  <EditableField field="sourceType" label="Source Type" value={selectedRow.sourceType ?? ''} />
                  {selectedRow.sourceUrl && (
                    <div className="col-span-2">
                      <div className="text-[9px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-0.5">Source URL</div>
                      <a href={selectedRow.sourceUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-[10px] font-mono text-primary hover:underline truncate">
                        <ExternalLink size={8} />{selectedRow.sourceUrl}
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Review notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileText size={10} className="text-cyan-400" />
                  <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-widest">Analyst Notes</span>
                </div>
                <div className="pl-4">
                  <textarea
                    value={reviewNotes}
                    onChange={e => setReviewNotes(e.target.value)}
                    placeholder="Add review notes, justification, or concerns..."
                    rows={3}
                    className="w-full px-3 py-2 bg-input border border-border text-[11px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary resize-none"
                  />
                </div>
              </div>

              {/* Submission info */}
              <div className="pl-4 space-y-1 text-[9px] font-mono text-muted-foreground/50">
                {selectedRow.submittedBy && <div>Submitted by: <span className="text-muted-foreground/80">{selectedRow.submittedBy}</span></div>}
                {selectedRow.createdAt && <div>Submitted: <span className="text-muted-foreground/80">{new Date(selectedRow.createdAt).toLocaleString()}</span></div>}
                {selectedRow.reviewedBy && <div>Reviewed by: <span className="text-muted-foreground/80">{selectedRow.reviewedBy}</span></div>}
                {selectedRow.reviewNotes && <div className="mt-1 text-muted-foreground/70 italic">"{selectedRow.reviewNotes}"</div>}
              </div>
            </div>

            {/* Action footer */}
            <div className="flex-shrink-0 border-t border-border/60 bg-background p-3 space-y-2">
              {selectedRow.reviewStatus !== 'approved' && selectedRow.reviewStatus !== 'rejected' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => approveMutation.mutate({
                      candidateId: selectedRow.id,
                      reviewedBy: 'analyst',
                      reviewNotes: reviewNotes || undefined,
                      regionOverride: regionOverride || (region !== 'Global' ? region : undefined),
                      threatLevelOverride: threatOverride || undefined,
                      importanceOverride: importanceOverride !== "" ? Number(importanceOverride) : undefined,
                    })}
                    disabled={approveMutation.isPending}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 bg-green-600/15 border border-green-500/40 text-green-400 text-[10px] font-mono hover:bg-green-600/25 disabled:opacity-50 transition-all"
                  >
                    <CheckCircle2 size={11} />
                    {approveMutation.isPending ? "APPROVING..." : "APPROVE & ADD TO REGISTRY"}
                  </button>
                  <button
                    onClick={() => rejectMutation.mutate({ candidateId: selectedRow.id, reviewedBy: 'analyst', reviewNotes: reviewNotes || undefined })}
                    disabled={rejectMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-2.5 bg-red-600/10 border border-red-500/30 text-red-400 text-[10px] font-mono hover:bg-red-600/20 disabled:opacity-50 transition-all"
                  >
                    <XCircle size={11} />
                    {rejectMutation.isPending ? "..." : "REJECT"}
                  </button>
                </div>
              )}
              {selectedRow.reviewStatus === 'approved' && (
                <div className="flex items-center gap-2 p-2.5 border border-green-500/30 bg-green-500/8 text-green-400 text-[10px] font-mono">
                  <CheckCircle2 size={11} />APPROVED — Added to facility registry
                </div>
              )}
              {selectedRow.reviewStatus === 'rejected' && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 p-2.5 border border-red-500/30 bg-red-500/8 text-red-400 text-[10px] font-mono">
                    <XCircle size={11} />REJECTED
                  </div>
                  <button
                    onClick={() => approveMutation.mutate({ candidateId: selectedRow.id, reviewedBy: 'analyst', reviewNotes: 'Re-approved after rejection' })}
                    disabled={approveMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 border border-green-500/30 text-green-400 text-[9px] font-mono hover:bg-green-500/10 transition-all"
                  >
                    <RefreshCw size={9} />RE-APPROVE
                  </button>
                </div>
              )}
              <button
                onClick={() => deleteMutation.mutate({ candidateId: selectedRow.id })}
                disabled={deleteMutation.isPending}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 border border-destructive/30 text-destructive text-[9px] font-mono hover:bg-destructive/10 disabled:opacity-50 transition-all"
              >
                <Trash2 size={9} />DELETE CANDIDATE
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground">
            <div className="relative">
              <Shield size={40} className="opacity-10" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-8 h-8 border border-primary/20 rounded-full animate-ping" />
              </div>
            </div>
            <div className="text-center space-y-1">
              <div className="text-xs font-mono text-muted-foreground/60">SELECT A CANDIDATE</div>
              <div className="text-[10px] font-mono text-muted-foreground/30">Click any item in the queue to open review</div>
            </div>
            {(statusCounts?.pending ?? 0) > 0 && (
              <div className="px-3 py-1.5 border border-amber-500/30 bg-amber-500/5 text-amber-400 text-[10px] font-mono">
                {statusCounts?.pending} candidates awaiting triage
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Column 3: Article Evidence ──────────────────────────────────── */}
      <div className="w-[320px] flex-shrink-0 flex flex-col bg-card border-l border-border/60">

        {/* Header */}
        <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-border/60 bg-background">
          <div className="flex items-center gap-2 mb-2">
            <FileText size={10} className="text-cyan-400" />
            <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Article Evidence</span>
            {candidateArticlesData?.articles && candidateArticlesData.articles.length > 0 && (
              <span className="ml-auto px-1.5 py-0.5 text-[8px] font-mono bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                {candidateArticlesData.articles.length} matches
              </span>
            )}
          </div>
          {selectedId && (
            <div className="relative">
              <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/40" />
              <input
                value={articleSearch}
                onChange={e => setArticleSearch(e.target.value)}
                placeholder="Filter articles..."
                className="w-full pl-6 pr-2 py-1 bg-input border border-border/40 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary"
              />
            </div>
          )}
        </div>

        {/* Article list */}
        <div className="flex-1 overflow-y-auto">
          {!selectedId ? (
            <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground/30 px-4">
              <FileText size={24} className="opacity-20" />
              <div className="text-[9px] font-mono text-center">Select a candidate to see matching articles</div>
            </div>
          ) : articlesLoading ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-xs font-mono">
              <RefreshCw size={12} className="animate-spin mr-2" />SCANNING...
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-2 text-muted-foreground/30 px-4">
              <AlertCircle size={20} className="opacity-30" />
              <div className="text-[9px] font-mono text-center">
                {articleSearch ? 'No articles match filter' : 'No matching articles found in database'}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {filteredArticles.map((article, i) => (
                <div key={article.id ?? i} className="px-3 py-2.5 hover:bg-foreground/2 transition-colors group">
                  {/* Source + date */}
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[8px] font-mono text-primary/70 uppercase tracking-wide truncate flex-1">
                      {article.agencyName ?? 'Unknown Source'}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/40 flex-shrink-0 ml-2">
                      {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString() : '—'}
                    </span>
                  </div>
                  {/* Headline */}
                  <div className="text-[10px] font-mono text-foreground/80 leading-snug line-clamp-2 mb-1.5">
                    {article.title}
                  </div>
                  {/* Relevance bar + sentiment */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-0.5 bg-border/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/60 rounded-full"
                        style={{ width: `${Math.min(100, (article.relevanceScore ?? 0.5) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[7px] font-mono text-muted-foreground/40">
                      {Math.round((article.relevanceScore ?? 0.5) * 100)}% rel.
                    </span>
                    {article.url && (
                      <a href={article.url} target="_blank" rel="noopener noreferrer"
                        className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-primary transition-all">
                        <ExternalLink size={8} />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence summary footer */}
        {selectedRow && candidateArticlesData?.articles && candidateArticlesData.articles.length > 0 && (
          <div className="flex-shrink-0 border-t border-border/40 px-3 py-2 bg-background">
            <div className="text-[8px] font-mono text-muted-foreground/50 mb-1">EVIDENCE SUMMARY</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <div className="text-[11px] font-mono text-cyan-400">{candidateArticlesData.articles.length}</div>
                <div className="text-[7px] font-mono text-muted-foreground/40">ARTICLES</div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-cyan-400">
                  {new Set(candidateArticlesData.articles.map(a => a.agencyName)).size}
                </div>
                <div className="text-[7px] font-mono text-muted-foreground/40">SOURCES</div>
              </div>
              <div>
                <div className="text-[11px] font-mono text-cyan-400">
                  {Math.round((candidateArticlesData.articles.reduce((s, a) => s + (a.relevanceScore ?? 0.5), 0) / candidateArticlesData.articles.length) * 100)}%
                </div>
                <div className="text-[7px] font-mono text-muted-foreground/40">AVG REL.</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main FacilitiesTab ───────────────────────────────────────────────────────
export default function FacilitiesTab({ region }: { region: string }) {
  const [subTab, setSubTab] = useState<SubTab>("registry");
  const [editId, setEditId] = useState<number | null>(null);
  const { data: pendingCount } = trpc.facilities.listCandidates.useQuery({ reviewStatus: "pending", limit: 1 }, { staleTime: 30000 });

  const handleEdit = useCallback((id: number) => {
    setEditId(id);
    setSubTab("add");
  }, []);

  const handleDone = useCallback(() => {
    setEditId(null);
    setSubTab("registry");
  }, []);

  const SUB_TABS: { id: SubTab; label: string; icon: React.ReactNode; desc: string }[] = [
    { id: "registry", label: "REGISTRY", icon: <Database size={10} />, desc: "Approved facility database" },
    { id: "add", label: editId ? "EDIT" : "ADD / EDIT", icon: <Plus size={10} />, desc: editId ? "Edit facility" : "Add new facility" },
    { id: "discover", label: "SEARCH & DISCOVER", icon: <Search size={10} />, desc: "Find new facilities online" },
    { id: "pending", label: "PENDING APPROVAL", icon: <Clock size={10} />, desc: "Review candidate queue" },
  ];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Sub-tab header */}
      <div className="flex items-center border-b border-border bg-card/50 flex-shrink-0">
        <div className="flex items-center gap-0 px-2">
          {SUB_TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setSubTab(tab.id); if (tab.id !== "add") setEditId(null); }}
              className={`flex items-center gap-1.5 px-3 py-2.5 text-[10px] font-mono border-b-2 transition-all relative ${subTab === tab.id ? 'border-b-primary text-primary' : 'border-b-transparent text-muted-foreground hover:text-foreground'}`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "pending" && (pendingCount?.total ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-500 text-[8px] flex items-center justify-center text-black font-bold">
                  {(pendingCount?.total ?? 0) > 9 ? "9+" : pendingCount?.total}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 px-4">
          <Shield size={10} className="text-muted-foreground" />
          <span className="text-[9px] font-mono text-muted-foreground">FACILITY INTELLIGENCE REGISTRY</span>
        </div>
      </div>

      {/* Sub-tab content — all tabs stay mounted to preserve state; visibility toggled via CSS */}
      <div className="flex-1 overflow-hidden relative">
        <div className={`absolute inset-0 overflow-hidden ${subTab === 'registry' ? '' : 'hidden'}`}>
          <RegistryTab onEdit={handleEdit} region={region} />
        </div>
        <div className={`absolute inset-0 overflow-hidden ${subTab === 'add' ? '' : 'hidden'}`}>
          <AddEditTab editId={editId} onDone={handleDone} region={region} />
        </div>
        <div className={`absolute inset-0 overflow-hidden ${subTab === 'discover' ? '' : 'hidden'}`}>
          <DiscoverTab region={region} onSwitchToPending={() => setSubTab('pending')} />
        </div>
        <div className={`absolute inset-0 overflow-hidden ${subTab === 'pending' ? '' : 'hidden'}`}>
          <PendingTab region={region} />
        </div>
      </div>
    </div>
  );
}
