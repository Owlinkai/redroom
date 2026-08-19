import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  AreaChart, Area, LineChart, Line, Cell
} from "recharts";
import { Plus, X, Globe, Newspaper, Tag, TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Activity, AlertTriangle, FileText, Download, Loader2 } from "lucide-react";

interface CompareTabProps { region: string; onDrillDownCountry?: (country: string) => void; }
type CompareMode = "countries" | "sources" | "regions" | "topics";

// Fallbacks used until DB data loads
const FALLBACK_COUNTRIES = ["Egypt","Saudi Arabia","Iran","Iraq","Syria","Yemen","Libya","Sudan","Lebanon","Palestine","Jordan","Turkey","UAE","Qatar","Kuwait","Israel","Morocco","Algeria","Tunisia","Oman","Bahrain","United Kingdom","Germany","France","China","Japan","India","United States","Brazil","Nigeria","Australia"];
const FALLBACK_REGIONS = ["MENA","Global","Europe","East Asia","Asia-Pacific","South Asia","Central Asia","Sub-Saharan Africa","North Africa","Americas","Latin America"];
const FALLBACK_TOPICS = ["WAR/CONFLICT","ECONOMY","POLITICS","TECHNOLOGY","ENERGY","DIPLOMACY","SECURITY","HUMANITARIAN"];
const COLORS = ["#22d3ee","#f59e0b","#8b5cf6","#22c55e","#ef4444","#ec4899","#f97316","#84cc16"];
const MONO = "'Share Tech Mono', monospace";

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--card)", border: "1px solid var(--border)", padding: "8px 10px", fontFamily: MONO, fontSize: 9 }}>
      <div style={{ color: "#22d3ee", marginBottom: 6, letterSpacing: "0.1em" }}>{label}</div>
      {payload.map((p: any, i: number) => (
        <div key={i} style={{ color: p.color, display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: p.color }} />
          <span style={{ color: "#9ca3af" }}>{p.name}:</span>
          <span style={{ fontWeight: 700 }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const AxisTick = ({ x, y, payload }: any) => (
  <text x={x} y={y + 10} textAnchor="middle" fill="currentColor" fontSize={8} fontFamily={MONO}>
    {String(payload.value).substring(0, 9)}
  </text>
);
const YTick = ({ x, y, payload }: any) => (
  <text x={x - 4} y={y + 4} textAnchor="end" fill="currentColor" fontSize={8} fontFamily={MONO}>
    {payload.value}
  </text>
);

function SentimentBadge({ value }: { value: string }) {
  const cfg: Record<string, { color: string; icon: any }> = {
    negative: { color: "#ef4444", icon: TrendingDown },
    positive: { color: "#22c55e", icon: TrendingUp },
    neutral: { color: "#9ca3af", icon: Minus },
    mixed: { color: "#f59e0b", icon: Minus },
  };
  const c = cfg[value] || cfg.neutral;
  const Icon = c.icon;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 9, color: c.color, fontFamily: MONO }}>
      <Icon size={9} /> {value?.toUpperCase()}
    </span>
  );
}

function ThreatBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, overflow: "hidden", background: "var(--muted)" }}>
        <div style={{ width: `${pct}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 6px ${color}66`, transition: "width 0.7s ease" }} />
      </div>
      <span style={{ fontSize: 9, width: 24, textAlign: "right", color, fontFamily: MONO }}>{value}</span>
    </div>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
      <div style={{ width: 3, height: 12, background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }} />
      <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "#22d3ee", fontFamily: MONO }}>{label}</span>
      <div style={{ flex: 1, height: 1, background: "linear-gradient(90deg, #22d3ee30, transparent)" }} />
    </div>
  );
}

export default function CompareTab({ region, onDrillDownCountry }: CompareTabProps) {
  const [mode, setMode] = useState<CompareMode>("countries");
  const [selectedItems, setSelectedItems] = useState<string[]>(["Egypt","Saudi Arabia","Iran"]);
  const [selectedSources, setSelectedSources] = useState<number[]>([]);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [chartType, setChartType] = useState<"bar" | "area" | "radar">("bar");
  const [reportText, setReportText] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);

  const { data: articles } = trpc.articles.list.useQuery({ region, limit: 500 });
  const { data: agencies } = trpc.agencies.list.useQuery({ region });
  const { data: dbCountries } = trpc.ref.countriesByRegion.useQuery({ region });
  const { data: dbRegions } = trpc.ref.regions.useQuery();
  const { data: dbTopics } = trpc.ref.topics.useQuery();
  const ALL_COUNTRIES = dbCountries?.map(c => c.name) ?? FALLBACK_COUNTRIES;
  const ALL_REGIONS = dbRegions?.map(r => r.name) ?? FALLBACK_REGIONS;
  const ALL_TOPICS = dbTopics?.map(t => t.name) ?? FALLBACK_TOPICS;

  const generateReportMutation = trpc.compare.generateReport.useMutation({
    onSuccess: (data) => {
      const reportContent = typeof data.report === 'string' ? data.report : String(data.report);
      setReportText(reportContent);
      setShowReport(true);
    },
  });

  const addItem = (item: string) => { if (selectedItems.length < 6 && !selectedItems.includes(item)) setSelectedItems(p => [...p, item]); setShowAddPanel(false); };
  const removeItem = (item: string) => setSelectedItems(p => p.filter(i => i !== item));
  const addSource = (id: number) => { if (selectedSources.length < 6 && !selectedSources.includes(id)) setSelectedSources(p => [...p, id]); setShowAddPanel(false); };
  const removeSource = (id: number) => setSelectedSources(p => p.filter(i => i !== id));

  const countryArticles = useMemo(() => {
    const map: Record<string, any[]> = {};
    selectedItems.forEach(c => { map[c] = (articles ?? []).filter(a => a.country === c); });
    return map;
  }, [articles, selectedItems]);

  const barData = useMemo(() => selectedItems.map((c, i) => ({
    name: c.substring(0, 10),
    articles: countryArticles[c]?.length ?? 0,
    breaking: countryArticles[c]?.filter(a => a.isBreaking).length ?? 0,
    color: COLORS[i % COLORS.length],
  })), [selectedItems, countryArticles]);

  const radarData = useMemo(() => {
    const dims = ["CONFLICT","ECONOMY","POLITICS","ENERGY","SECURITY","DIPLOMACY"];
    return dims.map(dim => {
      const entry: Record<string, any> = { subject: dim };
      selectedItems.forEach(c => {
        entry[c] = (countryArticles[c] ?? []).filter(a => {
          try { return JSON.parse((a.topicsJson as any) ?? "[]").some((t: string) => t.includes(dim)); } catch { return false; }
        }).length;
      });
      return entry;
    });
  }, [selectedItems, countryArticles]);

  const sentimentData = useMemo(() => ["NEGATIVE","NEUTRAL","POSITIVE","MIXED"].map(s => {
    const entry: Record<string, any> = { sentiment: s };
    selectedItems.forEach(c => { entry[c] = (countryArticles[c] ?? []).filter(a => (a.sentiment || "neutral").toUpperCase() === s).length; });
    return entry;
  }), [selectedItems, countryArticles]);

  const timelineData = useMemo(() => {
    const days: Record<string, Record<string, number>> = {};
    const now = Date.now();
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now - i * 86400000);
      const key = `${d.getMonth() + 1}/${d.getDate()}`;
      days[key] = {};
      selectedItems.forEach(c => { days[key][c] = 0; });
    }
    selectedItems.forEach(c => {
      (countryArticles[c] ?? []).forEach(a => {
        const d = new Date(a.publishedAt ?? a.createdAt ?? now);
        const key = `${d.getMonth() + 1}/${d.getDate()}`;
        if (days[key]) days[key][c] = (days[key][c] || 0) + 1;
      });
    });
    return Object.entries(days).map(([date, vals]) => ({ date, ...vals }));
  }, [selectedItems, countryArticles]);

  const threatScores = useMemo(() => selectedItems.map((c, i) => {
    const arts = countryArticles[c] ?? [];
    const breaking = arts.filter(a => a.isBreaking).length;
    const negative = arts.filter(a => a.sentiment === "negative").length;
    const score = Math.min(100, Math.round((breaking * 3 + negative * 0.5) / Math.max(arts.length, 1) * 100));
    return { country: c, score, breaking, negative, total: arts.length, color: COLORS[i % COLORS.length] };
  }).sort((a, b) => b.score - a.score), [selectedItems, countryArticles]);

  const modeConfig: Record<CompareMode, { icon: any; label: string }> = {
    countries: { icon: Globe, label: "COUNTRIES" },
    sources: { icon: Newspaper, label: "SOURCES" },
    regions: { icon: Globe, label: "REGIONS" },
    topics: { icon: Tag, label: "TOPICS" },
  };

  const availableItems = mode === "countries" ? ALL_COUNTRIES.filter(c => !selectedItems.includes(c))
    : mode === "topics" ? ALL_TOPICS.filter(t => !selectedItems.includes(t))
    : ALL_REGIONS.filter(r => !selectedItems.includes(r));

  const chartStyle = { backgroundColor: "transparent", fontSize: 9, fontFamily: MONO };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--background)" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, padding: "10px 16px", borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <Activity size={10} style={{ color: "#22d3ee" }} />
              <span style={{ fontFamily: "Orbitron, monospace", fontSize: 10, fontWeight: 700, color: "#22d3ee", letterSpacing: "0.15em" }}>
                INTELLIGENCE COMPARISON MATRIX
              </span>
            </div>
            <div style={{ display: "flex", border: "1px solid var(--border)", overflow: "hidden" }}>
              {(Object.entries(modeConfig) as [CompareMode, any][]).map(([m, cfg]) => {
                const Icon = cfg.icon;
                return (
                  <button key={m} onClick={() => setMode(m)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "4px 10px",
                      fontFamily: MONO, fontSize: 9, cursor: "pointer",
                      background: mode === m ? "rgba(34,211,238,0.12)" : "transparent",
                      color: mode === m ? "#22d3ee" : "var(--muted-foreground)", borderRight: "1px solid oklch(from var(--foreground) l c h / 0.1)"
                    }}>
                    <Icon size={9} /> {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ display: "flex", border: "1px solid var(--border)", overflow: "hidden" }}>
              {(["bar","area","radar"] as const).map(ct => (
                <button key={ct} onClick={() => setChartType(ct)}
                  style={{
                    padding: "4px 10px", fontFamily: MONO, fontSize: 9, cursor: "pointer",
                    background: chartType === ct ? "rgba(34,211,238,0.18)" : "transparent",
                    color: chartType === ct ? "#22d3ee" : "var(--muted-foreground)",
                    borderTop: "none", borderBottom: "none", borderLeft: "none",
                    borderRight: "1px solid oklch(from var(--foreground) l c h / 0.1)"
                  }}>
                  {ct.toUpperCase()}
                </button>
              ))}
            </div>
            <button onClick={() => setShowAddPanel(!showAddPanel)}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 12px",
                border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee", fontFamily: MONO, fontSize: 9,
                background: "transparent", cursor: "pointer"
              }}>
              <Plus size={9} /> ADD {mode === "sources" ? "SOURCE" : modeConfig[mode].label.slice(0, -1)}
              {showAddPanel ? <ChevronUp size={9} /> : <ChevronDown size={9} />}
            </button>
            <button
              onClick={() => {
                const articleData = mode === "countries" ? threatScores.map(t => ({
                  target: t.country,
                  articleCount: t.total,
                  breaking: t.breaking,
                  threatScore: t.score,
                  sentiment: t.negative > t.total * 0.5 ? "negative" : "neutral",
                })) : selectedItems.map((item, i) => ({
                  target: item,
                  articleCount: barData[i]?.articles ?? 0,
                  breaking: barData[i]?.breaking ?? 0,
                  threatScore: 0,
                  sentiment: "neutral",
                }));
                generateReportMutation.mutate({
                  mode,
                  targets: mode === "sources" ? selectedSources.map(id => agencies?.find(a => a.id === id)?.name ?? String(id)) : selectedItems,
                  region,
                  articleData,
                });
              }}
              disabled={generateReportMutation.isPending}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "4px 12px",
                border: "1px solid rgba(239,68,68,0.5)", color: "#ef4444", fontFamily: MONO, fontSize: 9,
                background: "rgba(239,68,68,0.08)", cursor: generateReportMutation.isPending ? "not-allowed" : "pointer",
                opacity: generateReportMutation.isPending ? 0.7 : 1,
              }}>
              {generateReportMutation.isPending
                ? <><Loader2 size={9} style={{ animation: "spin 1s linear infinite" }} /> GENERATING...</>
                : <><FileText size={9} /> GENERATE REPORT</>
              }
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: MONO, fontSize: 8, color: "var(--muted-foreground)", letterSpacing: "0.15em" }}>TARGETS:</span>
          {mode !== "sources" ? selectedItems.map((item, i) => (
            <div key={item} style={{
              display: "flex", alignItems: "center", gap: 4, padding: "2px 8px",
              border: `1px solid ${COLORS[i % COLORS.length]}50`, color: COLORS[i % COLORS.length],
              background: `${COLORS[i % COLORS.length]}0d`, fontFamily: MONO, fontSize: 9
            }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[i % COLORS.length], boxShadow: `0 0 4px ${COLORS[i % COLORS.length]}` }} />
              {item}
              <button onClick={() => removeItem(item)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, padding: 0, marginLeft: 2 }}><X size={8} /></button>
            </div>
          )) : selectedSources.map((id, i) => {
            const ag = agencies?.find(a => a.id === id);
            return (
              <div key={id} style={{
                display: "flex", alignItems: "center", gap: 4, padding: "2px 8px",
                border: `1px solid ${COLORS[i % COLORS.length]}50`, color: COLORS[i % COLORS.length],
                background: `${COLORS[i % COLORS.length]}0d`, fontFamily: MONO, fontSize: 9
              }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: COLORS[i % COLORS.length] }} />
                {ag?.name ?? `Source ${id}`}
                <button onClick={() => removeSource(id)} style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", opacity: 0.6, padding: 0, marginLeft: 2 }}><X size={8} /></button>
              </div>
            );
          })}
        </div>

        {showAddPanel && (
          <div style={{ marginTop: 8, padding: 8, border: "1px solid var(--border)", background: "var(--card)", maxHeight: 100, overflowY: "auto" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {mode === "sources" ? agencies?.map(ag => (
                <button key={ag.id} onClick={() => addSource(ag.id)}
                  style={{ padding: "2px 8px", fontFamily: MONO, fontSize: 9, border: "1px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }}>
                  {ag.name}
                </button>
              )) : availableItems.map(item => (
                <button key={item} onClick={() => addItem(item)}
                  style={{ padding: "2px 8px", fontFamily: MONO, fontSize: 9, border: "1px solid var(--border)", color: "var(--muted-foreground)", background: "transparent", cursor: "pointer" }}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>

        {mode === "countries" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16 }}>
              {/* Threat Score Matrix */}
              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// THREAT SCORE MATRIX" />
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {threatScores.map(({ country, score, breaking, negative, total, color }) => (
                    <div key={country}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: color, boxShadow: `0 0 4px ${color}` }} />
                          <button
                            onClick={() => onDrillDownCountry?.(country)}
                            title={`Drill down to ${country} in Live Map`}
                            style={{ fontSize: 9, fontFamily: MONO, color: "#e5e7eb", background: "none", border: "none", cursor: onDrillDownCountry ? "pointer" : "default", padding: 0, textDecoration: onDrillDownCountry ? "underline dotted" : "none", textUnderlineOffset: 2 }}
                          >{country}</button>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {breaking > 0 && <span style={{ display: "flex", alignItems: "center", gap: 2, fontSize: 8, fontFamily: MONO, color: "#f87171" }}><AlertTriangle size={7} /> {breaking}</span>}
                          <span style={{ fontSize: 9, fontFamily: MONO, fontWeight: 700, color }}>{score}</span>
                        </div>
                      </div>
                      <ThreatBar value={score} max={100} color={color} />
                      <div style={{ display: "flex", gap: 12, marginTop: 2 }}>
                        <span style={{ fontSize: 8, fontFamily: MONO, color: "var(--muted-foreground)" }}>TOT:{total}</span>
                        <span style={{ fontSize: 8, fontFamily: MONO, color: "rgba(248,113,113,0.7)" }}>BRK:{breaking}</span>
                        <span style={{ fontSize: 8, fontFamily: MONO, color: "rgba(251,146,60,0.7)" }}>NEG:{negative}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Main Chart */}
              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// ARTICLE VOLUME COMPARISON" />
                <ResponsiveContainer width="100%" height={200}>
                  {chartType === "radar" ? (
                    <RadarChart data={radarData} style={chartStyle}>
                      <PolarGrid stroke="oklch(from var(--foreground) l c h / 0.1)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: "currentColor", fontSize: 8, fontFamily: MONO }} />
                      <PolarRadiusAxis tick={{ fill: "currentColor", fontSize: 7 }} />
                      {selectedItems.map((c, i) => (
                        <Radar key={c} name={c} dataKey={c} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.12} strokeWidth={1.5} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 8, fontFamily: MONO }} />
                      <Tooltip content={<CustomTooltip />} />
                    </RadarChart>
                  ) : chartType === "area" ? (
                    <AreaChart data={timelineData} style={chartStyle}>
                      <defs>
                        {selectedItems.map((c, i) => (
                          <linearGradient key={c} id={`grad-${i}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={COLORS[i % COLORS.length]} stopOpacity={0} />
                          </linearGradient>
                        ))}
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" />
                      <XAxis dataKey="date" tick={<AxisTick />} axisLine={{ stroke: "oklch(from var(--foreground) l c h / 0.1)" }} tickLine={false} />
                      <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      {selectedItems.map((c, i) => (
                        <Area key={c} type="monotone" dataKey={c} name={c} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} fill={`url(#grad-${i})`} dot={false} />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 8, fontFamily: MONO }} />
                    </AreaChart>
                  ) : (
                    <BarChart data={barData} style={chartStyle} barGap={2} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" vertical={false} />
                      <XAxis dataKey="name" tick={<AxisTick />} axisLine={{ stroke: "oklch(from var(--foreground) l c h / 0.1)" }} tickLine={false} />
                      <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={28} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="articles" name="Total" radius={[2,2,0,0]}>
                        {barData.map((entry, i) => <Cell key={i} fill={entry.color} fillOpacity={0.85} />)}
                      </Bar>
                      <Bar dataKey="breaking" name="Breaking" radius={[2,2,0,0]} fill="#ef4444" fillOpacity={0.9} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// SENTIMENT DISTRIBUTION" />
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart data={sentimentData} style={chartStyle} barGap={1} barCategoryGap="25%">
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" vertical={false} />
                    <XAxis dataKey="sentiment" tick={<AxisTick />} axisLine={{ stroke: "oklch(from var(--foreground) l c h / 0.1)" }} tickLine={false} />
                    <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    {selectedItems.map((c, i) => (
                      <Bar key={c} dataKey={c} name={c} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} radius={[2,2,0,0]} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 8, fontFamily: MONO }} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// 14-DAY ACTIVITY TIMELINE" />
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={timelineData} style={chartStyle}>
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" />
                    <XAxis dataKey="date" tick={<AxisTick />} axisLine={{ stroke: "oklch(from var(--foreground) l c h / 0.1)" }} tickLine={false} interval={2} />
                    <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={24} />
                    <Tooltip content={<CustomTooltip />} />
                    {selectedItems.map((c, i) => (
                      <Line key={c} type="monotone" dataKey={c} name={c} stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} dot={false} activeDot={{ r: 3, fill: COLORS[i % COLORS.length] }} />
                    ))}
                    <Legend wrapperStyle={{ fontSize: 8, fontFamily: MONO }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(selectedItems.length, 3)}, 1fr)`, gap: 12 }}>
              {selectedItems.map((c, i) => {
                const arts = countryArticles[c] ?? [];
                const topSentiment = Object.entries(
                  arts.reduce((acc: Record<string, number>, a) => { acc[a.sentiment || "neutral"] = (acc[a.sentiment || "neutral"] || 0) + 1; return acc; }, {})
                ).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
                const topTopics = Object.entries(
                  arts.reduce((acc: Record<string, number>, a) => {
                    try { JSON.parse((a.topicsJson as any) ?? "[]").forEach((t: string) => { acc[t] = (acc[t] || 0) + 1; }); } catch {}
                    return acc;
                  }, {})
                ).sort((a, b) => b[1] - a[1]).slice(0, 3);
                const color = COLORS[i % COLORS.length];
                const avgImp = arts.length > 0 ? (arts.reduce((s, a) => s + (a.importanceScore ?? 0), 0) / arts.length).toFixed(1) : "0.0";
                return (
                  <div key={c} style={{ padding: 12, background: "var(--card)", border: `1px solid ${color}25`, position: "relative" }}>
                    <button onClick={() => removeItem(c)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: 0.6 }}><X size={10} /></button>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                      <div style={{ width: 3, height: 32, background: `linear-gradient(to bottom, ${color}, ${color}44)`, boxShadow: `0 0 8px ${color}66` }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{c}</div>
                        <div style={{ fontSize: 8, color: "var(--muted-foreground)", fontFamily: MONO, letterSpacing: "0.1em" }}>INTELLIGENCE PROFILE</div>
                      </div>
                      {onDrillDownCountry && (
                        <button
                          onClick={() => onDrillDownCountry(c)}
                          title="View on Live Map"
                          style={{ display: "flex", alignItems: "center", gap: 3, padding: "3px 8px", border: `1px solid ${color}44`, color, fontFamily: MONO, fontSize: 8, background: `${color}0d`, cursor: "pointer" }}
                        >
                          <Globe size={8} /> LIVE MAP
                        </button>
                      )}
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                      {[["ARTICLES", arts.length, color],["BREAKING", arts.filter(a => a.isBreaking).length, "#f87171"],["AVG IMP.", avgImp, "#fbbf24"]].map(([lbl, val, clr]) => (
                        <div key={String(lbl)} style={{ textAlign: "center", padding: "6px 4px", background: "var(--card)", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: String(clr) }}>{val}</div>
                          <div style={{ fontSize: 7, color: "var(--muted-foreground)", fontFamily: MONO }}>{lbl}</div>
                        </div>
                      ))}
                    </div>
                    <SentimentBadge value={topSentiment} />
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 6 }}>
                      {topTopics.map(([t, cnt]) => (
                        <span key={t} style={{ padding: "2px 6px", fontSize: 7, border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: MONO }}>
                          {t.substring(0, 8)} <span style={{ color }}>{cnt}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {mode === "sources" && (
          <>
            {selectedSources.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(selectedSources.length, 3)}, 1fr)`, gap: 12 }}>
                {selectedSources.map((id, i) => {
                  const ag = agencies?.find(a => a.id === id);
                  if (!ag) return null;
                  const arts = (articles ?? []).filter(a => a.agencyId === id);
                  const topSentiment = Object.entries(
                    arts.reduce((acc: Record<string, number>, a) => { acc[a.sentiment || "neutral"] = (acc[a.sentiment || "neutral"] || 0) + 1; return acc; }, {})
                  ).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
                  const color = COLORS[i % COLORS.length];
                  return (
                    <div key={id} style={{ padding: 12, background: "var(--card)", border: `1px solid ${color}25`, position: "relative" }}>
                      <button onClick={() => removeSource(id)} style={{ position: "absolute", top: 8, right: 8, background: "none", border: "none", cursor: "pointer", color: "var(--muted-foreground)", opacity: 0.6 }}><X size={10} /></button>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                        <div style={{ width: 3, height: 32, background: `linear-gradient(to bottom, ${color}, ${color}44)`, boxShadow: `0 0 8px ${color}66` }} />
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: "#e5e7eb" }}>{ag.name}</div>
                          <div style={{ fontSize: 8, color: "var(--muted-foreground)", fontFamily: MONO }}>{ag.country} · {ag.language?.toUpperCase()}</div>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
                        {[["ARTICLES", arts.length, color],["BREAKING", arts.filter(a => a.isBreaking).length, "#f87171"],["RELIABILITY", ag.reliability ?? "N/A", "#fbbf24"]].map(([lbl, val, clr]) => (
                          <div key={String(lbl)} style={{ textAlign: "center", padding: "6px 4px", background: "var(--card)", border: "1px solid var(--border)" }}>
                            <div style={{ fontSize: 18, fontWeight: 700, color: String(clr) }}>{val}</div>
                            <div style={{ fontSize: 7, color: "var(--muted-foreground)", fontFamily: MONO }}>{lbl}</div>
                          </div>
                        ))}
                      </div>
                      <SentimentBadge value={topSentiment} />
                    </div>
                  );
                })}
              </div>
            )}
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 12, background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#22d3ee", letterSpacing: "0.15em" }}>// INTELLIGENCE SOURCES DATABASE</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 10, fontFamily: MONO, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
                      {["SOURCE","COUNTRY","LANG","TYPE","RELIABILITY","BIAS","ARTICLES","ACTION"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--muted-foreground)", fontWeight: "normal", letterSpacing: "0.15em", fontSize: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agencies?.map(ag => {
                      const artCount = (articles ?? []).filter(a => a.agencyId === ag.id).length;
                      const isSel = selectedSources.includes(ag.id);
                      return (
                        <tr key={ag.id} style={{ borderBottom: "1px solid oklch(from var(--foreground) l c h / 0.1)", background: isSel ? "rgba(34,211,238,0.04)" : "transparent" }}>
                          <td style={{ padding: "6px 12px", fontWeight: 600, color: "#e5e7eb" }}>{ag.name}</td>
                          <td style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>{ag.country}</td>
                          <td style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>{ag.language?.toUpperCase()}</td>
                          <td style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>{ag.type?.toUpperCase()}</td>
                          <td style={{ padding: "6px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 56, height: 4, borderRadius: 2, overflow: "hidden", background: "oklch(from var(--foreground) l c h / 0.1)" }}>
                                <div style={{ width: `${(ag.reliability ?? 0) * 10}%`, height: "100%", borderRadius: 2, background: "#22d3ee", boxShadow: "0 0 4px #22d3ee" }} />
                              </div>
                              <span style={{ color: "#22d3ee" }}>{ag.reliability ?? 0}</span>
                            </div>
                          </td>
                          <td style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>{ag.bias ?? "CENTER"}</td>
                          <td style={{ padding: "6px 12px", color: "#fbbf24" }}>{artCount}</td>
                          <td style={{ padding: "6px 12px" }}>
                            <button onClick={() => isSel ? removeSource(ag.id) : addSource(ag.id)}
                              style={{
                                padding: "2px 8px", fontSize: 8, fontFamily: MONO, cursor: "pointer",
                                border: isSel ? "1px solid rgba(248,113,113,0.4)" : "1px solid rgba(34,211,238,0.4)",
                                color: isSel ? "#f87171" : "#22d3ee", background: "transparent"
                              }}>
                              {isSel ? "REMOVE" : "COMPARE"}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {mode === "topics" && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// TOPIC VOLUME ANALYSIS" />
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={ALL_TOPICS.map((t, i) => ({
                    name: t.substring(0, 8),
                    articles: (articles ?? []).filter(a => { try { return JSON.parse((a.topicsJson as any) ?? "[]").includes(t); } catch { return false; } }).length,
                    color: COLORS[i % COLORS.length],
                  }))} style={chartStyle} layout="vertical">
                    <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" horizontal={false} />
                    <XAxis type="number" tick={<YTick />} axisLine={false} tickLine={false} />
                    <YAxis type="category" dataKey="name" tick={{ fill: "currentColor", fontSize: 8, fontFamily: MONO }} axisLine={false} tickLine={false} width={64} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="articles" name="Articles" radius={[0,2,2,0]}>
                      {ALL_TOPICS.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
                <SectionHeader label="// TOPIC COVERAGE RADAR" />
                <ResponsiveContainer width="100%" height={220}>
                  <RadarChart data={ALL_TOPICS.map(t => ({
                    subject: t.substring(0, 7),
                    value: (articles ?? []).filter(a => { try { return JSON.parse((a.topicsJson as any) ?? "[]").includes(t); } catch { return false; } }).length,
                  }))} style={chartStyle}>
                    <PolarGrid stroke="oklch(from var(--foreground) l c h / 0.1)" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: "currentColor", fontSize: 8, fontFamily: MONO }} />
                    <PolarRadiusAxis tick={{ fill: "currentColor", fontSize: 7 }} />
                    <Radar name="Coverage" dataKey="value" stroke="#22d3ee" fill="#22d3ee" fillOpacity={0.15} strokeWidth={1.5} />
                    <Tooltip content={<CustomTooltip />} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div style={{ background: "var(--card)", border: "1px solid var(--border)", overflow: "hidden" }}>
              <div style={{ padding: "8px 12px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 12, background: "#22d3ee", boxShadow: "0 0 6px #22d3ee" }} />
                <span style={{ fontFamily: MONO, fontSize: 9, color: "#22d3ee", letterSpacing: "0.15em" }}>// TOPIC COVERAGE ACROSS {region.toUpperCase()}</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 10, fontFamily: MONO, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}>
                      {["TOPIC","TOTAL","BREAKING","TOP COUNTRY","COVERAGE"].map(h => (
                        <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "var(--muted-foreground)", fontWeight: "normal", letterSpacing: "0.15em", fontSize: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {ALL_TOPICS.map((t, i) => {
                      const topicArts = (articles ?? []).filter(a => { try { return JSON.parse((a.topicsJson as any) ?? "[]").includes(t); } catch { return false; } });
                      const countryMap = topicArts.reduce((acc: Record<string, number>, a) => { if (a.country) acc[a.country] = (acc[a.country] || 0) + 1; return acc; }, {});
                      const topCountry = Object.entries(countryMap).sort((a, b) => b[1] - a[1])[0];
                      const maxCount = Math.max(...ALL_TOPICS.map((tt: string) => (articles ?? []).filter(a => { try { return JSON.parse((a.topicsJson as any) ?? "[]").includes(tt); } catch { return false; } }).length), 1);
                      const color = COLORS[i % COLORS.length];
                      return (
                        <tr key={t} style={{ borderBottom: "1px solid oklch(from var(--foreground) l c h / 0.1)" }}>
                          <td style={{ padding: "6px 12px", fontWeight: 600, color }}>{t}</td>
                          <td style={{ padding: "6px 12px", color: "#e5e7eb" }}>{topicArts.length}</td>
                          <td style={{ padding: "6px 12px", color: "#f87171" }}>{topicArts.filter(a => a.isBreaking).length}</td>
                          <td style={{ padding: "6px 12px", color: "var(--muted-foreground)" }}>{topCountry ? `${topCountry[0]} (${topCountry[1]})` : "—"}</td>
                          <td style={{ padding: "6px 12px", width: 160 }}>
                            <div style={{ width: "100%", height: 5, borderRadius: 3, overflow: "hidden", background: "oklch(from var(--foreground) l c h / 0.1)" }}>
                              <div style={{ width: `${(topicArts.length / maxCount) * 100}%`, height: "100%", borderRadius: 3, background: `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: `0 0 4px ${color}66` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {mode === "regions" && (
          <div style={{ padding: 12, background: "var(--card)", border: "1px solid var(--border)" }}>
            <SectionHeader label="// REGIONAL INTELLIGENCE OVERVIEW" />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={ALL_REGIONS.map((r, i) => ({
                  name: r.substring(0, 10),
                  articles: (articles ?? []).filter(a => a.region === r || a.country === r).length,
                  color: COLORS[i % COLORS.length],
                }))} style={chartStyle} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="2 4" stroke="oklch(from var(--foreground) l c h / 0.1)" vertical={false} />
                  <XAxis dataKey="name" tick={<AxisTick />} axisLine={{ stroke: "oklch(from var(--foreground) l c h / 0.1)" }} tickLine={false} />
                  <YAxis tick={<YTick />} axisLine={false} tickLine={false} width={28} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="articles" name="Articles" radius={[2,2,0,0]}>
                    {ALL_REGIONS.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {ALL_REGIONS.map((r, i) => {
                  const count = (articles ?? []).filter(a => a.region === r || a.country === r).length;
                  const maxCount = Math.max(...ALL_REGIONS.map((rr: string) => (articles ?? []).filter(a => a.region === rr || a.country === rr).length), 1);
                  return (
                    <div key={r}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                        <span style={{ fontSize: 9, fontFamily: MONO, color: "#e5e7eb" }}>{r}</span>
                        <span style={{ fontSize: 9, fontFamily: MONO, color: COLORS[i % COLORS.length] }}>{count}</span>
                      </div>
                      <ThreatBar value={count} max={maxCount} color={COLORS[i % COLORS.length]} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Intelligence Report Modal ── */}
      {showReport && reportText && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 9999,
          background: "rgba(0,0,0,0.85)", backdropFilter: "blur(4px)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }} onClick={() => setShowReport(false)}>
          <div style={{
            width: "min(780px, 95vw)", maxHeight: "85vh",
            background: "var(--background)", border: "1px solid #22d3ee40",
            boxShadow: "0 0 40px rgba(34,211,238,0.15)",
            display: "flex", flexDirection: "column",
          }} onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--card)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 3, height: 14, background: "#ef4444", boxShadow: "0 0 8px #ef4444" }} />
                <span style={{ fontFamily: "Orbitron, monospace", fontSize: 10, fontWeight: 700, color: "#ef4444", letterSpacing: "0.15em" }}>INTELLIGENCE BRIEF</span>
                <span style={{ fontFamily: MONO, fontSize: 8, color: "var(--muted-foreground)", marginLeft: 8 }}>CLASSIFICATION: UNCLASSIFIED // OSINT</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={() => {
                    const blob = new Blob([reportText], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `intel-brief-${mode}-${Date.now()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                  }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 10px", border: "1px solid rgba(34,211,238,0.4)", color: "#22d3ee", fontFamily: MONO, fontSize: 9, background: "transparent", cursor: "pointer" }}>
                  <Download size={9} /> DOWNLOAD
                </button>
                <button onClick={() => setShowReport(false)}
                  style={{ display: "flex", alignItems: "center", padding: "3px 8px", border: "1px solid var(--border)", color: "var(--muted-foreground)", fontFamily: MONO, fontSize: 9, background: "transparent", cursor: "pointer" }}>
                  <X size={9} /> CLOSE
                </button>
              </div>
            </div>
            {/* Report content */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ fontFamily: "'Courier New', monospace", fontSize: 11, lineHeight: 1.8, color: "#d1d5db", whiteSpace: "pre-wrap" }}>
                {reportText.split('\n').map((line, i) => {
                  const isHeader = /^[A-Z][A-Z ]+:/.test(line.trim());
                  return (
                    <div key={i} style={{
                      color: isHeader ? "#22d3ee" : "#d1d5db",
                      fontWeight: isHeader ? 700 : 400,
                      marginTop: isHeader ? 16 : 0,
                      letterSpacing: isHeader ? "0.08em" : 0,
                    }}>{line || "\u00a0"}</div>
                  );
                })}
              </div>
            </div>
            {/* Footer */}
            <div style={{ padding: "8px 16px", borderTop: "1px solid oklch(from var(--foreground) l c h / 0.1)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: MONO, fontSize: 8, color: "#4b5563" }}>GENERATED BY OSINT INTELLIGENCE ENGINE // {new Date().toUTCString()}</span>
              <span style={{ fontFamily: MONO, fontSize: 8, color: "#4b5563" }}>TARGETS: {mode === "sources" ? selectedSources.length : selectedItems.length}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
