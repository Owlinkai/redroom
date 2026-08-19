import { useEffect, useRef, useState } from "react";
import {
  X, Shield, AlertTriangle, Newspaper, Users, Tag, ExternalLink,
  Loader2, ChevronRight, Globe, Sword, DollarSign, Atom, Link2, BookOpen,
  RefreshCw, Maximize2, Minimize2, GraduationCap, Target, Lightbulb,
  TrendingUp, BarChart2, Activity, AlertCircle, Info
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid
} from "recharts";

interface CountryIntelPanelProps {
  country: string;
  onClose: () => void;
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function ThreatBar({ score, level }: { score?: number; level?: string }) {
  const levelMap: Record<string, { pct: number; color: string }> = {
    LOW:      { pct: 20,  color: '#22c55e' },
    MODERATE: { pct: 45,  color: '#eab308' },
    HIGH:     { pct: 70,  color: '#f97316' },
    CRITICAL: { pct: 88,  color: 'var(--intel-red)' },
    ELEVATED: { pct: 60,  color: '#f97316' },
    EXTREME:  { pct: 100, color: '#dc2626' },
  };
  const fromLevel = level ? levelMap[level.toUpperCase()] : null;
  const pct = fromLevel ? fromLevel.pct : Math.min(100, score ?? 0);
  const color = fromLevel ? fromLevel.color : (pct >= 70 ? '#ef4444' : pct >= 40 ? '#f97316' : pct >= 20 ? '#eab308' : '#22c55e');
  const label = fromLevel ? level! : (pct >= 70 ? 'CRITICAL' : pct >= 40 ? 'HIGH' : pct >= 20 ? 'MODERATE' : 'LOW');
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden border border-border">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
      </div>
      <span className="text-xs font-mono font-bold" style={{ color }}>{label}</span>
      {!fromLevel && <span className="text-xs font-mono text-muted-foreground">{score}/100</span>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex items-start gap-2 py-0.5">
      <span className="text-[10px] font-mono text-[#555] w-28 shrink-0 uppercase tracking-wide">{label}</span>
      <span className="text-[10px] font-mono text-[#bbb] flex-1">{value}</span>
    </div>
  );
}

function NuclearBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    none:      { label: 'NON-NUCLEAR', color: '#22c55e', bg: 'rgba(34,197,94,0.1)' },
    civilian:  { label: 'CIVILIAN NUCLEAR', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    treaty:    { label: 'NPT SIGNATORY', color: '#6366f1', bg: 'rgba(99,102,241,0.1)' },
    suspected: { label: 'SUSPECTED PROGRAM', color: '#f97316', bg: 'rgba(249,115,22,0.1)' },
    confirmed: { label: 'CONFIRMED NUCLEAR', color: 'var(--intel-red)', bg: 'rgba(239,68,68,0.1)' },
  };
  const { label, color, bg } = map[status] ?? { label: status.toUpperCase(), color: '#6b7280', bg: 'rgba(107,114,128,0.1)' };
  return (
    <span className="text-[9px] font-bold px-2 py-0.5 rounded uppercase tracking-wider"
      style={{ color, background: bg, border: `1px solid ${color}30` }}>{label}</span>
  );
}

function SentimentPill({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = label === 'negative' ? '#ef4444' : label === 'positive' ? '#22c55e' : label === 'mixed' ? '#f97316' : '#6b7280';
  return (
    <div className="flex items-center gap-1.5">
      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
      <span className="text-xs font-mono text-[#888] capitalize">{label}</span>
      <span className="text-xs font-mono text-[#aaa]">{count}</span>
      <span className="text-xs font-mono text-[#555]">({pct}%)</span>
    </div>
  );
}

function SuggestionItem({ type, text }: { type: 'action' | 'warning' | 'info'; text: string }) {
  const cfg = {
    action:  { icon: <Target className="w-3 h-3 shrink-0" />, color: '#22d3ee', bg: 'rgba(34,211,238,0.07)' },
    warning: { icon: <AlertCircle className="w-3 h-3 shrink-0" />, color: '#f97316', bg: 'rgba(249,115,22,0.07)' },
    info:    { icon: <Info className="w-3 h-3 shrink-0" />, color: '#a78bfa', bg: 'rgba(167,139,250,0.07)' },
  }[type];
  return (
    <div className="flex items-start gap-2 px-3 py-2 rounded-lg mb-1.5"
      style={{ background: cfg.bg, border: `1px solid ${cfg.color}20` }}>
      <span style={{ color: cfg.color, marginTop: 1 }}>{cfg.icon}</span>
      <span className="text-[10px] font-mono text-muted-foreground leading-relaxed">{text}</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CountryIntelPanel({ country, onClose }: CountryIntelPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const since = useRef(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = trpc.intel.countryIntel.useQuery(
    { country, since: since.current },
    { staleTime: 60000 }
  );

  const stored = data?.storedIntel ?? null;
  const keyLeaders: Array<{ role: string; name: string; since?: string }> =
    stored?.keyLeaders ? (typeof stored.keyLeaders === 'string' ? JSON.parse(stored.keyLeaders) : stored.keyLeaders as any) : [];
  const alliances: string[] =
    stored?.alliances ? (typeof stored.alliances === 'string' ? JSON.parse(stored.alliances) : stored.alliances as any) : [];
  const activeConflicts: Array<{ name: string; since: string; type: string; status: string }> =
    stored?.activeConflicts ? (typeof stored.activeConflicts === 'string' ? JSON.parse(stored.activeConflicts) : stored.activeConflicts as any) : [];
  const sources: Array<{ name: string; url: string; date?: string }> =
    stored?.sources ? (typeof stored.sources === 'string' ? JSON.parse(stored.sources) : stored.sources as any) : [];

  // Count extra data fields available in expanded view (headsup badge)
  const expandedDataCount = [
    stored?.pressFreedomIndex, stored?.corruptionIndex, stored?.humanRightsIndex,
    stored?.internetFreedom, stored?.gdpUsd, stored?.militaryBudgetUsd,
    activeConflicts.length > 0, alliances.length > 0, sources.length > 0,
  ].filter(Boolean).length;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (expanded) setExpanded(false);
        else onClose();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, expanded]);

  const totalSentiment = data ? Object.values(data.sentimentBreakdown).reduce((s, v) => s + v, 0) : 0;
  const threatLevel = stored?.threatLevel ?? undefined;

  // Radar chart data
  const radarData = stored ? [
    { subject: 'Press\nFreedom', value: stored.pressFreedomIndex ? Math.max(0, 100 - stored.pressFreedomIndex / 1.8) : 0, fullMark: 100 },
    { subject: 'Anti-\nCorrupt', value: stored.corruptionIndex ?? 0, fullMark: 100 },
    { subject: 'Human\nRights', value: stored.humanRightsIndex ?? 0, fullMark: 100 },
    { subject: 'Internet\nFreedom', value: stored.internetFreedom === 'free' ? 85 : stored.internetFreedom === 'partly_free' ? 50 : 20, fullMark: 100 },
    { subject: 'Mil.\nPower', value: stored.militaryBudgetUsd ? Math.min(100, (stored.militaryBudgetUsd / 1e10) * 40) : 10, fullMark: 100 },
    { subject: 'Econ.\nStrength', value: stored.gdpUsd ? Math.min(100, (stored.gdpUsd / 1e12) * 50) : 10, fullMark: 100 },
  ] : [];

  // Bar chart data
  const barData = stored ? [
    { name: 'GDP ($B)', value: stored.gdpUsd ? Math.round(stored.gdpUsd / 1e9) : 0, color: '#22c55e' },
    { name: 'Mil. ($B)', value: stored.militaryBudgetUsd ? Math.round(stored.militaryBudgetUsd / 1e9) : 0, color: '#f97316' },
    { name: 'Pop. (M)', value: stored.population ? Math.round(stored.population / 1e6) : 0, color: '#38bdf8' },
    { name: 'Armed (K)', value: stored.armedForcesSize ? Math.round(stored.armedForcesSize / 1000) : 0, color: '#a78bfa' },
  ].filter(d => d.value > 0) : [];

  // Policy suggestions
  const suggestions: Array<{ type: 'action' | 'warning' | 'info'; text: string }> = [];
  if (stored) {
    if (stored.threatLevel === 'CRITICAL' || stored.threatLevel === 'HIGH') {
      suggestions.push({ type: 'warning', text: `Threat level is ${stored.threatLevel}. Monitor all diplomatic channels and consider travel advisories.` });
    }
    if (stored.nuclearStatus === 'confirmed' || stored.nuclearStatus === 'suspected') {
      suggestions.push({ type: 'warning', text: `Nuclear program status: ${stored.nuclearStatus}. Engage IAEA verification mechanisms and multilateral diplomacy.` });
    }
    if (stored.sanctionsStatus && stored.sanctionsStatus !== 'none' && stored.sanctionsStatus !== 'None') {
      suggestions.push({ type: 'action', text: `Active sanctions regime in place. Review compliance requirements before any financial or trade engagement.` });
    }
    if (activeConflicts.some(c => c.status === 'active')) {
      suggestions.push({ type: 'action', text: `${activeConflicts.filter(c => c.status === 'active').length} active conflict(s). Coordinate with OCHA and ICRC for humanitarian access.` });
    }
    if (stored.pressFreedomIndex && stored.pressFreedomIndex > 100) {
      suggestions.push({ type: 'info', text: `Press freedom rank #${stored.pressFreedomIndex} (RSF). Verify all media outputs for state influence before use as intelligence source.` });
    }
    if (stored.corruptionIndex && stored.corruptionIndex < 35) {
      suggestions.push({ type: 'info', text: `Low anti-corruption score (${stored.corruptionIndex}/100). Institutional reliability may be limited; cross-reference multiple sources.` });
    }
    if (alliances.length > 0) {
      suggestions.push({ type: 'info', text: `Member of: ${alliances.slice(0, 3).join(', ')}${alliances.length > 3 ? ` +${alliances.length - 3} more` : ''}. Consider alliance obligations in any geopolitical assessment.` });
    }
    if (stored.gdpPerCapita && stored.gdpPerCapita < 5000) {
      suggestions.push({ type: 'info', text: `GDP per capita $${stored.gdpPerCapita.toLocaleString()} — economic vulnerability may increase instability risk. Monitor World Bank indicators.` });
    }
  }

  return (
    <div
      ref={panelRef}
      className="h-full flex flex-col transition-all duration-300"
      style={{
        width: expanded ? 'min(92vw, 960px)' : '420px',
        maxWidth: '95vw',
        background: 'var(--card)',
        borderLeft: '1px solid var(--border)',
        boxShadow: '-8px 0 32px oklch(from var(--foreground) l c h / 0.1)',
        fontFamily: "'JetBrains Mono', 'Courier New', monospace",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#ff3333]" />
          <span className="text-xs font-bold text-[#ff3333] tracking-widest uppercase">Country Intel</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
          <span className="text-sm font-bold text-foreground tracking-wide uppercase">{country}</span>
          {!expanded && expandedDataCount > 0 && (
            <span
              className="ml-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full animate-pulse cursor-pointer"
              style={{ background: 'rgba(34,211,238,0.15)', color: '#22d3ee', border: '1px solid #22d3ee40' }}
              onClick={() => setExpanded(true)}
              title={`${expandedDataCount} additional data sections in expanded view`}
            >
              +{expandedDataCount} DATA
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setExpanded(v => !v)}
            className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
            title={expanded ? 'Collapse (ESC)' : 'Expand — charts, education, suggestions'}
          >
            {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded border border-border text-muted-foreground hover:text-destructive hover:border-destructive transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden" style={{ scrollbarWidth: 'thin', scrollbarColor: '#2a2a4a transparent' }}>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center h-48 gap-3">
            <Loader2 className="w-6 h-6 text-[#ff3333] animate-spin" />
            <span className="text-xs font-mono text-[#555] tracking-widest">RETRIEVING INTEL...</span>
          </div>
        ) : !data ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2">
            <AlertTriangle className="w-6 h-6 text-[#f97316]" />
            <span className="text-xs font-mono text-[#555]">NO DATA AVAILABLE</span>
          </div>
        ) : expanded ? (
          /* ─── EXPANDED VIEW ─────────────────────────────────────────────── */
          <div className="flex flex-col gap-0">
            {/* Charts row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border">
              <div className="px-4 py-3 border-r border-border">
                <div className="flex items-center gap-2 mb-1">
                  <Activity className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Governance Radar</span>
                </div>
                {radarData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData} margin={{ top: 8, right: 16, bottom: 8, left: 16 }}>
                      <PolarGrid stroke="#2a2a4a" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: '#888', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#555', fontSize: 7 }} />
                      <Radar name="Score" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.18} dot={{ fill: '#22d3ee', r: 2 }} />
                    </RadarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-[10px] text-muted-foreground text-center py-8">NO INDEX DATA</div>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <BarChart2 className="w-3.5 h-3.5 text-[#f97316]" />
                  <span className="text-[10px] font-bold text-[#f97316] tracking-widest uppercase">Key Metrics</span>
                </div>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={barData} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 52 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1a1a2e" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#555', fontSize: 8, fontFamily: 'JetBrains Mono' }} />
                      <YAxis dataKey="name" type="category" tick={{ fill: '#888', fontSize: 8, fontFamily: 'JetBrains Mono' }} width={48} />
                      <Tooltip contentStyle={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 10, fontFamily: 'JetBrains Mono' }} labelStyle={{ color: 'var(--foreground)' }} itemStyle={{ color: 'var(--primary)' }} />
                      <Bar dataKey="value" radius={[0, 3, 3, 0]}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-[10px] text-muted-foreground text-center py-8">NO METRIC DATA</div>
                )}
              </div>
            </div>

            {/* Threat + Brief row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border">
              <div className="px-4 py-3 border-r border-border">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#f97316]" />
                  <span className="text-[10px] font-bold text-[#f97316] tracking-widest uppercase">Threat Assessment</span>
                </div>
                {threatLevel ? <ThreatBar level={threatLevel} /> : <ThreatBar score={data.threatScore} />}
                <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                  {Object.entries(data.sentimentBreakdown).map(([label, count]) => (
                    <SentimentPill key={label} label={label} count={count} total={totalSentiment} />
                  ))}
                </div>
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="text-[10px] font-bold text-[#a78bfa] tracking-widest uppercase">Intel Brief</span>
                </div>
                {data.intelBrief ? (
                  <p className="text-[11px] text-muted-foreground leading-relaxed">{data.intelBrief}</p>
                ) : (
                  <p className="text-[10px] text-muted-foreground">No brief available.</p>
                )}
              </div>
            </div>

            {/* Gov + Military row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border">
              <div className="px-4 py-3 border-r border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="text-[10px] font-bold text-[#38bdf8] tracking-widest uppercase">Government</span>
                </div>
                {stored && (
                  <>
                    <InfoRow label="Capital" value={stored.capital} />
                    <InfoRow label="Gov. Type" value={stored.governmentType} />
                    <InfoRow label="Head of State" value={stored.headOfState} />
                    <InfoRow label="Population" value={stored.population ? `${(stored.population / 1_000_000).toFixed(1)}M` : null} />
                    {keyLeaders.slice(0, 4).map((l, i) => (
                      <div key={i} className="flex items-start gap-2 py-0.5">
                        <span className="text-[9px] font-mono text-[#555] w-24 shrink-0 uppercase">{l.role}</span>
                        <span className="text-[10px] font-mono text-[#bbb]">{l.name}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <Sword className="w-3.5 h-3.5 text-[#f97316]" />
                  <span className="text-[10px] font-bold text-[#f97316] tracking-widest uppercase">Military</span>
                </div>
                {stored && (
                  <>
                    <InfoRow label="Mil. Budget" value={stored.militaryBudgetUsd ? `$${(stored.militaryBudgetUsd / 1_000_000_000).toFixed(1)}B` : null} />
                    <InfoRow label="Armed Forces" value={stored.armedForcesSize ? `${(stored.armedForcesSize / 1000).toFixed(0)}K` : null} />
                    <InfoRow label="Sanctions" value={stored.sanctionsStatus} />
                    {stored.nuclearStatus && <div className="mt-2"><NuclearBadge status={stored.nuclearStatus} /></div>}
                    {alliances.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {alliances.map((a, i) => (
                          <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-[#6b7280] border border-border">{a}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Conflicts Timeline */}
            {activeConflicts.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Sword className="w-3.5 h-3.5 text-[#ef4444]" />
                  <span className="text-[10px] font-bold text-[#ef4444] tracking-widest uppercase">Active Conflicts Timeline</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">{activeConflicts.length} CONFLICTS</span>
                </div>
                <div className="relative pl-4">
                  <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
                  {activeConflicts.map((c, i) => (
                    <div key={i} className="relative mb-3 last:mb-0">
                      <div className="absolute -left-3 top-1.5 w-2 h-2 rounded-full border border-border"
                        style={{ background: c.status === 'active' ? '#ef4444' : c.status === 'frozen' ? '#eab308' : '#6b7280' }} />
                      <div className="pl-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-foreground">{c.name}</span>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase"
                            style={{ color: c.status === 'active' ? '#ef4444' : c.status === 'frozen' ? '#eab308' : '#6b7280', background: c.status === 'active' ? 'rgba(239,68,68,0.1)' : c.status === 'frozen' ? 'rgba(234,179,8,0.1)' : 'rgba(107,114,128,0.1)' }}>
                            {c.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] text-[#555]">Since {c.since}</span>
                          <span className="text-[9px] text-muted-foreground">·</span>
                          <span className="text-[9px] text-[#888]">{c.type}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Education & Development */}
            <section className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <GraduationCap className="w-3.5 h-3.5 text-[#34d399]" />
                <span className="text-[10px] font-bold text-[#34d399] tracking-widest uppercase">Education & Development</span>
              </div>
              {stored ? (
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                  <InfoRow label="GDP per Capita" value={stored.gdpPerCapita ? `$${stored.gdpPerCapita.toLocaleString()}` : null} />
                  <InfoRow label="Human Rights" value={stored.humanRightsIndex ? `${stored.humanRightsIndex}/100` : null} />
                  <InfoRow label="Internet Freedom" value={stored.internetFreedom ? stored.internetFreedom.replace('_', ' ').toUpperCase() : null} />
                  <InfoRow label="Press Freedom" value={stored.pressFreedomIndex ? `Rank #${stored.pressFreedomIndex}` : null} />
                </div>
              ) : (
                <p className="text-[10px] text-muted-foreground">No development data available.</p>
              )}
              <div className="mt-2 p-2 rounded-lg bg-card border border-border">
                <p className="text-[10px] text-[#6b9e6b] leading-relaxed">
                  <span className="font-bold text-[#34d399]">Note:</span> Literacy rate, school enrollment, and HDI data can be added via World Bank API integration. Current indices reflect governance and freedom metrics from RSF, Freedom House, and TI CPI 2024.
                </p>
              </div>
            </section>

            {/* Global Indices with progress bars */}
            {stored && (stored.pressFreedomIndex || stored.corruptionIndex || stored.humanRightsIndex) && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="text-[10px] font-bold text-[#a78bfa] tracking-widest uppercase">Global Indices</span>
                </div>
                <div className="space-y-2">
                  {stored.pressFreedomIndex && (
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground uppercase">Press Freedom (RSF 2024)</span>
                        <span className="text-[9px] font-mono text-[#888]">Rank #{stored.pressFreedomIndex}</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-[#a78bfa]"
                          style={{ width: `${Math.max(5, 100 - (stored.pressFreedomIndex / 1.8))}%` }} />
                      </div>
                    </div>
                  )}
                  {stored.corruptionIndex && (
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground uppercase">Anti-Corruption (TI CPI 2024)</span>
                        <span className="text-[9px] font-mono text-[#888]">{stored.corruptionIndex}/100</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${stored.corruptionIndex}%`, background: stored.corruptionIndex >= 50 ? '#22c55e' : stored.corruptionIndex >= 30 ? '#eab308' : '#ef4444' }} />
                      </div>
                    </div>
                  )}
                  {stored.humanRightsIndex && (
                    <div>
                      <div className="flex justify-between mb-0.5">
                        <span className="text-[9px] text-muted-foreground uppercase">Human Rights Index</span>
                        <span className="text-[9px] font-mono text-[#888]">{stored.humanRightsIndex}/100</span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full"
                          style={{ width: `${stored.humanRightsIndex}%`, background: stored.humanRightsIndex >= 60 ? '#22c55e' : stored.humanRightsIndex >= 35 ? '#eab308' : '#ef4444' }} />
                      </div>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Policy Suggestions */}
            {suggestions.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span className="text-[10px] font-bold text-[#fbbf24] tracking-widest uppercase">Intel Recommendations</span>
                  <span className="text-[9px] text-muted-foreground ml-auto">AI-ASSISTED</span>
                </div>
                {suggestions.map((s, i) => <SuggestionItem key={i} type={s.type} text={s.text} />)}
              </section>
            )}

            {/* Key Intel Notes */}
            {stored?.keyIntelNotes && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span className="text-[10px] font-bold text-[#fbbf24] tracking-widest uppercase">Key Intel Notes</span>
                </div>
                <p className="text-[11px] text-[#9090b0] leading-relaxed">{stored.keyIntelNotes}</p>
              </section>
            )}

            {/* Topics + Entities row */}
            <div className="grid grid-cols-2 gap-0 border-b border-border">
              {data.topTopics.length > 0 && (
                <div className="px-4 py-3 border-r border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-[#a855f7]" />
                    <span className="text-[10px] font-bold text-[#a855f7] tracking-widest uppercase">Active Topics</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topTopics.map(({ topic, count }) => (
                      <span key={topic} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-[#c084fc]"
                        style={{ background: 'rgba(168,85,247,0.08)' }}>
                        {topic} <span className="text-[#7c3aed]">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {data.topEntities.length > 0 && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Key Entities</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {data.topEntities.slice(0, 10).map(({ name, count }) => (
                      <span key={name} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-[#7dd3fc]"
                        style={{ background: 'rgba(34,211,238,0.06)' }}>
                        {name} <span className="text-primary">×{count}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Credible Sources grid */}
            {sources.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-[#6366f1]" />
                  <span className="text-[10px] font-bold text-[#6366f1] tracking-widest uppercase">Credible Sources</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{sources.length} REFS</span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted transition-colors group">
                      <ExternalLink className="w-3 h-3 text-[#6366f1] shrink-0 mt-0.5 group-hover:text-[#818cf8]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-[#9090c0] group-hover:text-[#c0c0e0] truncate">{s.name}</div>
                        {s.date && <div className="text-[9px] text-muted-foreground">{s.date}</div>}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Articles grid */}
            <section className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">Recent Intel Feed</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{data.articleCount} ARTICLES</span>
              </div>
              {data.recentArticles.length === 0 ? (
                <div className="text-[10px] text-muted-foreground text-center py-4">NO RECENT ARTICLES</div>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {data.recentArticles.slice(0, 20).map((a) => {
                    const sentColor = a.sentiment === 'negative' ? '#ef4444' : a.sentiment === 'positive' ? '#22c55e' : '#6b7280';
                    const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : '';
                    return (
                      <div key={a.id} className="flex flex-col gap-0.5 py-1.5 px-2 rounded bg-card border border-border">
                        {a.isBreaking && <span className="text-[8px] font-bold px-1 py-0.5 rounded bg-[#ff3333] text-foreground w-fit">BREAKING</span>}
                        <a href={a.url} target="_blank" rel="noopener noreferrer"
                          className="text-[10px] text-[#c0c0e0] hover:text-foreground leading-snug line-clamp-2">
                          {a.title}
                        </a>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[8px] font-mono text-muted-foreground">{date}</span>
                          <span className="text-[8px] font-mono ml-auto" style={{ color: sentColor }}>{(a.sentiment ?? 'neutral').toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        ) : (
          /* ─── COMPACT VIEW ──────────────────────────────────────────────── */
          <div className="flex flex-col gap-0">
            {/* Threat Score */}
            <section className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-3.5 h-3.5 text-[#f97316]" />
                <span className="text-[10px] font-bold text-[#f97316] tracking-widest uppercase">Threat Assessment</span>
                {stored?.lastUpdated && (
                  <span className="text-[9px] text-[#333] ml-auto flex items-center gap-1">
                    <RefreshCw className="w-2.5 h-2.5" />
                    {new Date(stored.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
              {threatLevel ? <ThreatBar level={threatLevel} /> : <ThreatBar score={data.threatScore} />}
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                {Object.entries(data.sentimentBreakdown).map(([label, count]) => (
                  <SentimentPill key={label} label={label} count={count} total={totalSentiment} />
                ))}
              </div>
              <div className="mt-2 text-[10px] font-mono text-[#555]">
                {data.articleCount} articles analyzed · {data.facilities.length} facilities tracked
              </div>
            </section>

            {/* Intel Brief */}
            {data.intelBrief && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="text-[10px] font-bold text-[#a78bfa] tracking-widest uppercase">Intel Brief</span>
                  <span className="text-[10px] text-[#333] ml-auto">AI-GENERATED</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{data.intelBrief}</p>
              </section>
            )}

            {/* Government & Leadership */}
            {stored && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Globe className="w-3.5 h-3.5 text-[#38bdf8]" />
                  <span className="text-[10px] font-bold text-[#38bdf8] tracking-widest uppercase">Government & Leadership</span>
                </div>
                <InfoRow label="Capital" value={stored.capital} />
                <InfoRow label="Gov. Type" value={stored.governmentType} />
                <InfoRow label="Head of State" value={stored.headOfState} />
                <InfoRow label="Population" value={stored.population ? `${(stored.population / 1_000_000).toFixed(1)}M` : null} />
                {keyLeaders.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Key Leaders</div>
                    {keyLeaders.map((l, i) => (
                      <div key={i} className="flex items-start gap-2 py-0.5">
                        <span className="text-[9px] font-mono text-[#555] w-28 shrink-0 uppercase">{l.role}</span>
                        <span className="text-[10px] font-mono text-[#bbb]">{l.name}{l.since ? ` (${l.since})` : ''}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Military & Security */}
            {stored && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Sword className="w-3.5 h-3.5 text-[#f97316]" />
                  <span className="text-[10px] font-bold text-[#f97316] tracking-widest uppercase">Military & Security</span>
                </div>
                <InfoRow label="Mil. Budget" value={stored.militaryBudgetUsd ? `$${(stored.militaryBudgetUsd / 1_000_000_000).toFixed(1)}B` : null} />
                <InfoRow label="Armed Forces" value={stored.armedForcesSize ? `${(stored.armedForcesSize / 1000).toFixed(0)}K personnel` : null} />
                <InfoRow label="Sanctions" value={stored.sanctionsStatus} />
                {stored.nuclearStatus && (
                  <div className="flex items-center gap-2 mt-2">
                    <Atom className="w-3 h-3 text-[#f97316]" />
                    <NuclearBadge status={stored.nuclearStatus} />
                  </div>
                )}
                {alliances.length > 0 && (
                  <div className="mt-2">
                    <div className="text-[9px] text-muted-foreground uppercase tracking-widest mb-1">Alliances</div>
                    <div className="flex flex-wrap gap-1">
                      {alliances.map((a, i) => (
                        <span key={i} className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-muted text-[#6b7280] border border-border">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Active Conflicts */}
            {activeConflicts.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Sword className="w-3.5 h-3.5 text-[#ef4444]" />
                  <span className="text-[10px] font-bold text-[#ef4444] tracking-widest uppercase">Active Conflicts</span>
                </div>
                {activeConflicts.map((c, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border last:border-0">
                    <div className="flex-1">
                      <div className="text-[11px] text-foreground font-bold">{c.name}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[9px] text-[#555]">Since {c.since}</span>
                        <span className="text-[9px] text-muted-foreground">·</span>
                        <span className="text-[9px] text-[#888]">{c.type}</span>
                        <span className="text-[9px] font-bold px-1 py-0.5 rounded ml-auto uppercase"
                          style={{ color: c.status === 'active' ? '#ef4444' : c.status === 'frozen' ? '#eab308' : '#6b7280', background: c.status === 'active' ? 'rgba(239,68,68,0.1)' : c.status === 'frozen' ? 'rgba(234,179,8,0.1)' : 'rgba(107,114,128,0.1)' }}>
                          {c.status}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </section>
            )}

            {/* Economy */}
            {stored && (stored.gdpUsd || stored.gdpPerCapita) && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <DollarSign className="w-3.5 h-3.5 text-[#22c55e]" />
                  <span className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">Economy</span>
                </div>
                <InfoRow label="GDP" value={stored.gdpUsd ? `$${(stored.gdpUsd / 1_000_000_000).toFixed(0)}B` : null} />
                <InfoRow label="GDP per Capita" value={stored.gdpPerCapita ? `$${stored.gdpPerCapita.toLocaleString()}` : null} />
              </section>
            )}

            {/* Global Indices */}
            {stored && (stored.pressFreedomIndex || stored.corruptionIndex || stored.humanRightsIndex) && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-3.5 h-3.5 text-[#a78bfa]" />
                  <span className="text-[10px] font-bold text-[#a78bfa] tracking-widest uppercase">Global Indices</span>
                </div>
                <InfoRow label="Press Freedom" value={stored.pressFreedomIndex ? `Rank #${stored.pressFreedomIndex} (RSF 2024)` : null} />
                <InfoRow label="Corruption" value={stored.corruptionIndex ? `Score ${stored.corruptionIndex}/100 (TI CPI 2024)` : null} />
                <InfoRow label="Human Rights" value={stored.humanRightsIndex ? `Score ${stored.humanRightsIndex}/100` : null} />
                <InfoRow label="Internet Freedom" value={stored.internetFreedom ? stored.internetFreedom.replace('_', ' ').toUpperCase() : null} />
              </section>
            )}

            {/* Key Intel Notes */}
            {stored?.keyIntelNotes && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="w-3.5 h-3.5 text-[#fbbf24]" />
                  <span className="text-[10px] font-bold text-[#fbbf24] tracking-widest uppercase">Key Intel Notes</span>
                </div>
                <p className="text-[11px] text-[#9090b0] leading-relaxed">{stored.keyIntelNotes}</p>
              </section>
            )}

            {/* Top Topics */}
            {data.topTopics.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Tag className="w-3.5 h-3.5 text-[#a855f7]" />
                  <span className="text-[10px] font-bold text-[#a855f7] tracking-widest uppercase">Active Topics</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.topTopics.map(({ topic, count }) => (
                    <span key={topic} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-[#c084fc]"
                      style={{ background: 'rgba(168,85,247,0.08)' }}>
                      {topic} <span className="text-[#7c3aed]">×{count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Key Entities */}
            {data.topEntities.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-bold text-primary tracking-widest uppercase">Key Entities</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {data.topEntities.slice(0, 12).map(({ name, count }) => (
                    <span key={name} className="text-[10px] font-mono px-2 py-0.5 rounded border border-border text-[#7dd3fc]"
                      style={{ background: 'rgba(34,211,238,0.06)' }}>
                      {name} <span className="text-primary">×{count}</span>
                    </span>
                  ))}
                </div>
              </section>
            )}

            {/* Credible Sources */}
            {sources.length > 0 && (
              <section className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2 mb-2">
                  <Link2 className="w-3.5 h-3.5 text-[#6366f1]" />
                  <span className="text-[10px] font-bold text-[#6366f1] tracking-widest uppercase">Credible Sources</span>
                  <span className="text-[10px] text-muted-foreground ml-auto">{sources.length} REFS</span>
                </div>
                <div className="flex flex-col gap-1">
                  {sources.map((s, i) => (
                    <a key={i} href={s.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-start gap-2 py-1 px-2 rounded hover:bg-muted transition-colors group">
                      <ExternalLink className="w-3 h-3 text-[#6366f1] shrink-0 mt-0.5 group-hover:text-[#818cf8]" />
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] font-mono text-[#9090c0] group-hover:text-[#c0c0e0] truncate">{s.name}</div>
                        {s.date && <div className="text-[9px] text-muted-foreground">{s.date}</div>}
                      </div>
                    </a>
                  ))}
                </div>
              </section>
            )}

            {/* Recent Articles */}
            <section className="px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Newspaper className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="text-[10px] font-bold text-[#22c55e] tracking-widest uppercase">Recent Intel Feed</span>
                <span className="text-[10px] text-muted-foreground ml-auto">{data.articleCount} ARTICLES</span>
              </div>
              {data.recentArticles.length === 0 ? (
                <div className="text-[10px] text-muted-foreground text-center py-4">NO RECENT ARTICLES</div>
              ) : (
                <div className="flex flex-col gap-2">
                  {data.recentArticles.slice(0, 15).map((a) => {
                    const sentColor = a.sentiment === 'negative' ? '#ef4444' : a.sentiment === 'positive' ? '#22c55e' : '#6b7280';
                    const date = a.publishedAt ? new Date(a.publishedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
                    return (
                      <div key={a.id} className="flex flex-col gap-0.5 py-1.5 border-b border-border">
                        <div className="flex items-start gap-2">
                          {a.isBreaking && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#ff3333] text-foreground shrink-0 mt-0.5">BREAKING</span>}
                          <a href={a.url} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-[#c0c0e0] hover:text-[#ffffff] leading-snug flex-1 line-clamp-2 group">
                            {a.title}
                            <ExternalLink className="w-2.5 h-2.5 inline ml-1 opacity-0 group-hover:opacity-60 transition-opacity" />
                          </a>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[9px] font-mono text-[#555]">{a.agencyName}</span>
                          <span className="text-[9px] font-mono text-[#333]">·</span>
                          <span className="text-[9px] font-mono text-muted-foreground">{date}</span>
                          <span className="text-[9px] font-mono ml-auto" style={{ color: sentColor }}>{(a.sentiment ?? 'neutral').toUpperCase()}</span>
                        </div>
                      </div>
                    );
                  })}
                  {data.recentArticles.length > 15 && (
                    <div className="text-[10px] text-muted-foreground text-center pt-1">+{data.recentArticles.length - 15} more articles</div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-border shrink-0 flex items-center justify-between">
        <span className="text-[9px] font-mono text-[#333] tracking-widest">CLASSIFICATION: UNCLASSIFIED</span>
        <div className="flex items-center gap-3">
          {!expanded && expandedDataCount > 0 && (
            <button onClick={() => setExpanded(true)}
              className="text-[9px] font-mono text-primary hover:text-[#67e8f9] flex items-center gap-1 transition-colors">
              <Maximize2 className="w-2.5 h-2.5" /> EXPAND VIEW
            </button>
          )}
          <span className="text-[9px] font-mono text-[#333]">
            {stored?.lastUpdated ? `UPDATED ${new Date(stored.lastUpdated).toLocaleDateString()}` : '7-DAY WINDOW'}
          </span>
        </div>
      </div>
    </div>
  );
}
