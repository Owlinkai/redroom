import { useState, useEffect, useRef, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import CountryNetworkGraph from "@/components/CountryNetworkGraph";
import { usePageVisible } from "@/hooks/usePageVisible";
import {
  Database, Download, Globe, Shield, AlertTriangle, Users,
  Activity, BarChart2, Layers, ExternalLink, CheckCircle,
  Server, Cpu, Zap, Radio, RefreshCw, ChevronRight,
  FileText, Filter, Search, TrendingUp, MapPin, Clock,
  Building2, Satellite, Plane, Fuel, Factory, BookOpen, Info
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, CartesianGrid, AreaChart, Area, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, Radar
} from "recharts";

interface DataTabProps { region: string; }

const ARCHITECTURE_LAYERS = [
  { id: "sources", label: "DATA SOURCES", color: "#06b6d4", icon: <Globe size={14} />, description: "101 MENA news agencies, UN agencies, OSINT feeds, satellite data", items: ["Al Jazeera", "Reuters MENA", "AFP", "BBC Arabic", "UN OCHA", "ACLED", "OpenStreetMap", "UNHCR", "World Bank", "SIPRI"], count: 101, status: "active" },
  { id: "ingestion", label: "INGESTION LAYER", color: "#8b5cf6", icon: <Radio size={14} />, description: "RSS crawlers, API connectors, web scrapers, Google News RSS", items: ["RSS Parser", "API Gateway", "Web Scraper", "Google News", "GDELT Feed", "Twitter API", "Telegram Monitor"], count: 7, status: "active" },
  { id: "processing", label: "PROCESSING ENGINE", color: "#f59e0b", icon: <Cpu size={14} />, description: "NLP entity extraction, sentiment analysis, topic classification, deduplication", items: ["Entity Extractor", "Sentiment Engine", "Topic Classifier", "Deduplicator", "Geo-Tagger", "Facility Linker"], count: 6, status: "active" },
  { id: "storage", label: "INTELLIGENCE STORE", color: "#10b981", icon: <Database size={14} />, description: "MySQL database, S3 object storage, graph relationships", items: ["Articles DB", "Facilities DB", "Agencies DB", "Graph Store", "Notifications", "Audit Log"], count: 6, status: "active" },
  { id: "analytics", label: "ANALYTICS LAYER", color: "#ef4444", icon: <BarChart2 size={14} />, description: "Real-time statistics, trend detection, threat scoring, network analysis", items: ["Trend Engine", "Threat Scorer", "Network Analyzer", "Timeline Builder", "Correlation Engine"], count: 5, status: "active" },
  { id: "presentation", label: "PRESENTATION LAYER", color: "#ec4899", icon: <Layers size={14} />, description: "Live map, network graph, data explorer, comparison tools, news feed", items: ["LIVE Map", "EXPLORE Graph", "COMPARE View", "FEED Reader", "DATA Export"], count: 5, status: "active" },
];

const MENA_POPULATION_DATA = [
  { country: "Egypt", code: "EGY", population: 107.4, displaced: 0.35, refugees: 0.27, idps: 0, urbanPct: 43, gdpPerCapita: 3699, hdi: 0.731, conflictLevel: "low", sources: ["World Bank 2024", "UNHCR 2024"] },
  { country: "Saudi Arabia", code: "SAU", population: 36.4, displaced: 0, refugees: 0.5, idps: 0, urbanPct: 84, gdpPerCapita: 23186, hdi: 0.875, conflictLevel: "low", sources: ["World Bank 2024", "UN DESA"] },
  { country: "Iran", code: "IRN", population: 88.6, displaced: 0, refugees: 3.4, idps: 0, urbanPct: 76, gdpPerCapita: 4600, hdi: 0.774, conflictLevel: "medium", sources: ["World Bank 2024", "UNHCR 2024"] },
  { country: "Iraq", code: "IRQ", population: 42.2, displaced: 1.2, refugees: 0.3, idps: 1.2, urbanPct: 71, gdpPerCapita: 5765, hdi: 0.686, conflictLevel: "high", sources: ["IOM DTM 2024", "UNHCR 2024"] },
  { country: "Syria", code: "SYR", population: 21.3, displaced: 7.6, refugees: 6.6, idps: 7.6, urbanPct: 57, gdpPerCapita: 533, hdi: 0.577, conflictLevel: "critical", sources: ["UNHCR 2024", "OCHA 2024"] },
  { country: "Yemen", code: "YEM", population: 33.7, displaced: 4.5, refugees: 0.1, idps: 4.5, urbanPct: 38, gdpPerCapita: 688, hdi: 0.455, conflictLevel: "critical", sources: ["IOM DTM 2024", "OCHA 2024"] },
  { country: "Libya", code: "LBY", population: 6.9, displaced: 0.18, refugees: 0.05, idps: 0.18, urbanPct: 81, gdpPerCapita: 6357, hdi: 0.718, conflictLevel: "high", sources: ["IOM DTM 2024", "UNHCR 2024"] },
  { country: "Sudan", code: "SDN", population: 46.9, displaced: 9.0, refugees: 1.1, idps: 9.0, urbanPct: 35, gdpPerCapita: 441, hdi: 0.508, conflictLevel: "critical", sources: ["IOM DTM 2024", "UNHCR 2024"] },
  { country: "Lebanon", code: "LBN", population: 5.5, displaced: 1.5, refugees: 1.5, idps: 0.5, urbanPct: 89, gdpPerCapita: 3800, hdi: 0.706, conflictLevel: "high", sources: ["UNHCR 2024", "OCHA 2024"] },
  { country: "Palestine", code: "PSE", population: 5.5, displaced: 1.9, refugees: 5.9, idps: 1.9, urbanPct: 77, gdpPerCapita: 3664, hdi: 0.715, conflictLevel: "critical", sources: ["UNRWA 2024", "OCHA 2024"] },
  { country: "Jordan", code: "JOR", population: 10.3, displaced: 0, refugees: 3.0, idps: 0, urbanPct: 91, gdpPerCapita: 4284, hdi: 0.720, conflictLevel: "low", sources: ["World Bank 2024", "UNHCR 2024"] },
  { country: "Turkey", code: "TUR", population: 85.3, displaced: 0, refugees: 3.6, idps: 0, urbanPct: 77, gdpPerCapita: 10674, hdi: 0.838, conflictLevel: "medium", sources: ["World Bank 2024", "UNHCR 2024"] },
  { country: "UAE", code: "ARE", population: 9.8, displaced: 0, refugees: 0, idps: 0, urbanPct: 87, gdpPerCapita: 44316, hdi: 0.911, conflictLevel: "low", sources: ["World Bank 2024", "UN DESA"] },
  { country: "Morocco", code: "MAR", population: 37.8, displaced: 0, refugees: 0.005, idps: 0, urbanPct: 65, gdpPerCapita: 3795, hdi: 0.683, conflictLevel: "low", sources: ["World Bank 2024", "UNHCR 2024"] },
  { country: "Algeria", code: "DZA", population: 45.6, displaced: 0, refugees: 0.1, idps: 0, urbanPct: 74, gdpPerCapita: 3691, hdi: 0.745, conflictLevel: "low", sources: ["World Bank 2024", "UNHCR 2024"] },
];

const COLORS = ["#06b6d4", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#ec4899", "#84cc16", "#f97316"];

const CONFLICT_COLORS: Record<string, string> = {
  critical: "#ef4444", high: "#f59e0b", medium: "#f97316", low: "#22c55e",
};

const FACILITY_ICONS: Record<string, React.ReactNode> = {
  military: <Shield size={12} />, oil_gas: <Fuel size={12} />, nuclear: <Zap size={12} />,
  airport: <Plane size={12} />, data_center: <Server size={12} />, embassy: <Building2 size={12} />,
  satellite: <Satellite size={12} />, company: <Factory size={12} />,
};

// Google News URL builder — region-aware geo-targeting
function googleNewsUrl(query: string, region = "MENA") {
  const regionGeoMap: Record<string, { gl: string; label: string }> = {
    'MENA':               { gl: 'AE', label: 'Middle East' },
    'Europe':             { gl: 'GB', label: 'Europe' },
    'East Asia':          { gl: 'JP', label: 'East Asia' },
    'Asia-Pacific':       { gl: 'AU', label: 'Asia Pacific' },
    'South Asia':         { gl: 'IN', label: 'South Asia' },
    'Central Asia':       { gl: 'KZ', label: 'Central Asia' },
    'Sub-Saharan Africa': { gl: 'ZA', label: 'Sub-Saharan Africa' },
    'North Africa':       { gl: 'MA', label: 'North Africa' },
    'Americas':           { gl: 'US', label: 'Americas' },
    'Latin America':      { gl: 'BR', label: 'Latin America' },
    'Global':             { gl: 'US', label: '' },
  };
  const geo = regionGeoMap[region] ?? { gl: 'US', label: region };
  const q = geo.label ? `${query} ${geo.label}` : query;
  return `https://news.google.com/search?q=${encodeURIComponent(q)}&hl=en-US&gl=${geo.gl}&ceid=${geo.gl}:en`;
}

const GOOGLE_NEWS_TOPICS = [
  { label: "War & Conflict", query: "war conflict military" },
  { label: "Economy", query: "economy trade sanctions" },
  { label: "Politics", query: "politics government elections" },
  { label: "Energy", query: "oil gas energy pipeline" },
  { label: "Diplomacy", query: "diplomacy foreign policy treaty" },
  { label: "Humanitarian", query: "humanitarian refugees crisis" },
  { label: "Security", query: "security terrorism threat" },
  { label: "Nuclear", query: "nuclear weapons program" },
];

// ── Agency Coverage Matrix — professional stacked bar chart ──────────────────
const AGENCY_DATA: { agency: string; total: number; topics: Record<string, number> }[] = [
  { agency: "Al Jazeera",    total: 103, topics: { "War/Conflict": 38, "Politics": 29, "Humanitarian": 22, "Diplomacy": 14 } },
  { agency: "Reuters MENA", total: 95,  topics: { "Economy": 31, "Politics": 26, "Energy": 20, "Diplomacy": 18 } },
  { agency: "BBC Arabic",   total: 72,  topics: { "Politics": 24, "War/Conflict": 20, "Security": 16, "Humanitarian": 12 } },
  { agency: "AFP",          total: 58,  topics: { "War/Conflict": 18, "Diplomacy": 15, "Politics": 14, "Economy": 11 } },
  { agency: "AP",           total: 49,  topics: { "Economy": 16, "Politics": 13, "Security": 11, "Nuclear": 9 } },
  { agency: "RT Arabic",    total: 65,  topics: { "Politics": 22, "Security": 18, "War/Conflict": 15, "Energy": 10 } },
  { agency: "Al Arabiya",   total: 44,  topics: { "Politics": 18, "Economy": 14, "Diplomacy": 8, "Energy": 4 } },
  { agency: "Sky News Arabia", total: 38, topics: { "War/Conflict": 14, "Politics": 12, "Security": 8, "Diplomacy": 4 } },
];
const TOPIC_PALETTE: Record<string, string> = {
  "War/Conflict": "#ef4444", "Politics": "#8b5cf6", "Economy": "#f59e0b",
  "Energy": "#10b981", "Diplomacy": "#06b6d4", "Security": "#f97316",
  "Humanitarian": "#ec4899", "Nuclear": "#84cc16",
};

// ── AlluvialFlow — professional SVG source→topic alluvial diagram ─────────────────────
function AlluvialFlow({ topicDist, expanded, showFilters }: { topicDist: any; expanded?: boolean; showFilters?: boolean }) {
  const [hoveredLink, setHoveredLink] = useState<string | null>(null);
  const [selectedSrc, setSelectedSrc] = useState<string | null>(null);
  const [filterTopic, setFilterTopic] = useState<string | null>(null);

  const agencies = useMemo(() => {
    if (topicDist && topicDist.length > 0) {
      return AGENCY_DATA.map(a => {
        const liveTopics: Record<string, number> = {};
        Object.entries(a.topics).forEach(([topic, weight]) => {
          const live = topicDist.find((t: any) => t.topic === topic);
          liveTopics[topic] = live ? Math.round((live.count * (weight / a.total))) : weight;
        });
        const total = Object.values(liveTopics).reduce((s, v) => s + v, 0);
        return { ...a, topics: liveTopics, total };
      });
    }
    return AGENCY_DATA;
  }, [topicDist]);

  const topicOrder = ["War/Conflict", "Politics", "Economy", "Energy", "Diplomacy", "Security", "Humanitarian", "Nuclear"];
  const topicTotals = useMemo(() => {
    const t: Record<string, number> = {};
    agencies.forEach(a => Object.entries(a.topics).forEach(([topic, v]) => {
      t[topic] = (t[topic] ?? 0) + v;
    }));
    return t;
  }, [agencies]);

  const W = expanded ? 820 : 420;
  const H = expanded ? 480 : 280;
  const PAD = 16;
  const srcX = PAD + (expanded ? 90 : 70);
  const tgtX = W - PAD - (expanded ? 90 : 70);
  const srcCount = agencies.length;
  const tgtCount = topicOrder.filter(t => topicTotals[t] > 0).length;
  const topics = topicOrder.filter(t => topicTotals[t] > 0);
  const totalArticles = agencies.reduce((s, a) => s + a.total, 0);
  const totalTopicVol = topics.reduce((s, t) => s + (topicTotals[t] ?? 0), 0);

  const nodeH = expanded ? 18 : 14;
  const srcGap = Math.max(4, (H - 2 * PAD - srcCount * nodeH) / Math.max(1, srcCount - 1));
  const tgtGap = Math.max(4, (H - 2 * PAD - tgtCount * nodeH) / Math.max(1, tgtCount - 1));

  const srcY = (i: number) => PAD + i * (nodeH + srcGap);
  const tgtY = (i: number) => PAD + i * (nodeH + tgtGap);

  // Build links
  const links = useMemo(() => {
    const result: { src: string; tgt: string; value: number; color: string; key: string }[] = [];
    agencies.forEach(a => {
      Object.entries(a.topics).forEach(([topic, value]) => {
        if (value > 0 && topics.includes(topic)) {
          result.push({
            src: a.agency, tgt: topic, value,
            color: TOPIC_PALETTE[topic] ?? "var(--muted-foreground)",
            key: `${a.agency}|${topic}`,
          });
        }
      });
    });
    return result;
  }, [agencies, topics]);

  // Compute vertical offsets for flow ribbons within each node bar
  const srcOffsets: Record<string, number> = {};
  const tgtOffsets: Record<string, number> = {};
  agencies.forEach(a => { srcOffsets[a.agency] = 0; });
  topics.forEach(t => { tgtOffsets[t] = 0; });

  const filteredLinks = useMemo(() =>
    filterTopic ? links.filter(l => l.tgt === filterTopic) : links,
    [links, filterTopic]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Article count + topic filter chips */}
      <div className="flex items-center justify-between mb-1 flex-shrink-0">
        <div className="text-[8px] font-mono text-muted-foreground">{totalArticles} articles · click source to lock</div>
        {filterTopic && (
          <button onClick={() => setFilterTopic(null)} className="text-[8px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-mono">✕ {filterTopic}</button>
        )}
      </div>
      {showFilters && (
        <div className="flex flex-wrap gap-1 mb-1 flex-shrink-0">
          {topicOrder.filter(t => topicTotals[t] > 0).map(t => (
            <button
              key={t}
              onClick={() => setFilterTopic(filterTopic === t ? null : t)}
              className="text-[7.5px] px-1.5 py-0.5 rounded font-mono transition-colors"
              style={{
                background: filterTopic === t ? (TOPIC_PALETTE[t] ?? '#334155') : 'var(--muted)',
                color: filterTopic === t ? '#fff' : '#94a3b8',
                border: `1px solid ${filterTopic === t ? (TOPIC_PALETTE[t] ?? '#334155') : 'rgba(71,85,105,0.4)'}`,
              }}
            >{t}</button>
          ))}
        </div>
      )}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Flow ribbons */}
          {filteredLinks.map(link => {
            const si = agencies.findIndex(a => a.agency === link.src);
            const ti = topics.indexOf(link.tgt);
            if (si < 0 || ti < 0) return null;
            const srcTotal = agencies[si].total;
            const tgtTotal = topicTotals[link.tgt] ?? 1;
            const srcBarH = nodeH;
            const tgtBarH = nodeH;
            const srcFlowH = Math.max(1, (link.value / srcTotal) * srcBarH);
            const tgtFlowH = Math.max(1, (link.value / tgtTotal) * tgtBarH);
            const srcOff = srcOffsets[link.src] ?? 0;
            const tgtOff = tgtOffsets[link.tgt] ?? 0;
            srcOffsets[link.src] = srcOff + srcFlowH;
            tgtOffsets[link.tgt] = tgtOff + tgtFlowH;
            const y1t = srcY(si) + srcOff;
            const y1b = y1t + srcFlowH;
            const y2t = tgtY(ti) + tgtOff;
            const y2b = y2t + tgtFlowH;
            const cx = (srcX + tgtX) / 2;
            const isHov = hoveredLink === link.key;
            const isSrcSel = selectedSrc === link.src;
            const opacity = selectedSrc
              ? (isSrcSel ? 0.75 : 0.06)
              : hoveredLink
                ? (isHov ? 0.8 : 0.08)
                : 0.45;
            const d = [
              `M ${srcX} ${y1t}`,
              `C ${cx} ${y1t}, ${cx} ${y2t}, ${tgtX} ${y2t}`,
              `L ${tgtX} ${y2b}`,
              `C ${cx} ${y2b}, ${cx} ${y1b}, ${srcX} ${y1b}`,
              `Z`,
            ].join(' ');
            return (
              <path
                key={link.key}
                d={d}
                fill={link.color}
                fillOpacity={opacity}
                stroke={link.color}
                strokeOpacity={opacity * 0.4}
                strokeWidth={0.5}
                style={{ cursor: 'pointer', transition: 'fill-opacity 0.12s' }}
                onMouseEnter={() => setHoveredLink(link.key)}
                onMouseLeave={() => setHoveredLink(null)}
                onClick={() => setSelectedSrc(selectedSrc === link.src ? null : link.src)}
              >
                <title>{link.src} → {link.tgt}: {link.value} articles ({Math.round(link.value / srcTotal * 100)}% of source)</title>
              </path>
            );
          })}

          {/* Source nodes */}
          {agencies.map((a, i) => {
            const y = srcY(i);
            const isActive = selectedSrc === a.agency || hoveredLink?.startsWith(a.agency + '|');
            return (
              <g key={a.agency} style={{ cursor: 'pointer' }} onClick={() => setSelectedSrc(selectedSrc === a.agency ? null : a.agency)}>
                <rect x={srcX - 3} y={y} width={6} height={nodeH} rx={1}
                  fill={isActive ? "#06b6d4" : "#334155"}
                  stroke={isActive ? "#06b6d4" : "var(--muted-foreground)"}
                  strokeWidth={0.5}
                />
                <text x={srcX - 8} y={y + nodeH / 2 + 3.5} textAnchor="end"
                  fontSize={expanded ? 9 : 7.5} fontFamily="JetBrains Mono, monospace"
                  fill={isActive ? "var(--foreground)" : "currentColor"}
                  style={{ transition: 'fill 0.12s' }}
                >{a.agency}</text>
                <text x={srcX - 8} y={y - 2} textAnchor="end"
                  fontSize={5.5} fontFamily="JetBrains Mono, monospace" fill="rgba(148,163,184,0.45)"
                >{a.total}</text>
              </g>
            );
          })}

          {/* Topic nodes */}
          {topics.map((t, i) => {
            const y = tgtY(i);
            const color = TOPIC_PALETTE[t] ?? "var(--muted-foreground)";
            const isActive = hoveredLink?.endsWith('|' + t) || (selectedSrc && links.some(l => l.src === selectedSrc && l.tgt === t));
            return (
              <g key={t}>
                <rect x={tgtX - 3} y={y} width={6} height={nodeH} rx={1}
                  fill={isActive ? color : "var(--muted)"}
                  stroke={color}
                  strokeWidth={isActive ? 1 : 0.5}
                  strokeOpacity={isActive ? 1 : 0.5}
                />
                <text x={tgtX + 8} y={y + nodeH / 2 + 3.5} textAnchor="start"
                  fontSize={expanded ? 9 : 7.5} fontFamily="JetBrains Mono, monospace"
                  fill={isActive ? "var(--foreground)" : "currentColor"}
                  style={{ transition: 'fill 0.12s' }}
                >{t}</text>
                <text x={tgtX + 8} y={y - 2} textAnchor="start"
                  fontSize={5.5} fontFamily="JetBrains Mono, monospace" fill="rgba(148,163,184,0.45)"
                >{topicTotals[t] ?? 0}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {selectedSrc && (
        <div className="flex-shrink-0 mt-2 pt-2 border-t border-border/40">
          <div className="text-[8px] font-mono text-primary mb-1 tracking-wider">{selectedSrc.toUpperCase()} — TOPIC BREAKDOWN</div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5">
            {Object.entries(agencies.find(a => a.agency === selectedSrc)?.topics ?? {})
              .sort(([, a], [, b]) => b - a)
              .map(([topic, count]) => (
                <div key={topic} className="flex items-center gap-1 text-[8px] font-mono">
                  <span className="w-1.5 h-1.5 rounded-sm" style={{ background: TOPIC_PALETTE[topic] ?? "var(--muted-foreground)" }} />
                  <span className="text-muted-foreground">{topic}</span>
                  <span className="text-foreground font-bold">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ArcDiagram — professional ranked arc diagram for country co-mentions ─────────────
function ArcDiagram({
  flows, allFlows, selectedFlow, onArcClick, expanded, filterCountry, onFilterCountry
}: {
  flows: { from: string; to: string; value: number; topics: string[] }[];
  allFlows?: { from: string; to: string; value: number; topics: string[] }[];
  selectedFlow: { from: string; to: string; value: number; topics: string[] } | null;
  onArcClick: (from: string, to: string) => void;
  expanded?: boolean;
  filterCountry?: string | null;
  onFilterCountry?: (c: string | null) => void;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  const sourceFlows = allFlows ?? flows;
  const allCountries = useMemo(() => {
    const set = new Set<string>();
    sourceFlows.forEach(f => { set.add(f.from); set.add(f.to); });
    return Array.from(set).sort();
  }, [sourceFlows]);

  // Sort countries by total mention volume descending
  const countryVol = useMemo(() => {
    const v: Record<string, number> = {};
    flows.forEach(f => {
      v[f.from] = (v[f.from] ?? 0) + f.value;
      v[f.to] = (v[f.to] ?? 0) + f.value;
    });
    return v;
  }, [flows]);

  const countries = useMemo(() =>
    Array.from(new Set(flows.flatMap(f => [f.from, f.to])))
      .sort((a, b) => (countryVol[b] ?? 0) - (countryVol[a] ?? 0)),
    [flows, countryVol]
  );

  const maxVol = Math.max(1, ...Object.values(countryVol));
  const maxFlow = Math.max(1, ...flows.map(f => f.value));

  const LEGEND_H = 20;
  const W = expanded ? 860 : 460;
  const H = expanded ? 480 : 280;
  // Fixed left margin wide enough for "Saudi Arabia" at any font size
  const labelW = expanded ? 130 : 110;
  const barMaxW = expanded ? 52 : 36;
  const arcMaxX = W - 12;
  const nodeH = Math.max(expanded ? 18 : 14, Math.floor((H - LEGEND_H - 20) / Math.max(countries.length, 1)));
  const nodeY = (i: number) => 12 + i * nodeH + nodeH / 2;
  // nodeX is where the circle sits — label is always left-anchored at x=4, bar fills labelW-16 to nodeX
  const nodeX = labelW;

  const topicColor: Record<string, string> = {
    "War/Conflict": "#ef4444", "Politics": "#8b5cf6", "Economy": "#f59e0b",
    "Energy": "#10b981", "Diplomacy": "#06b6d4", "Security": "#f97316",
    "Humanitarian": "#ec4899", "Nuclear": "#84cc16",
  };

  // Total co-mentions for the brief info line
  const totalCoMentions = flows.reduce((sum, f) => sum + f.value, 0);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Brief info line — matches AlluvialFlow style */}
      {onFilterCountry && (
        <p className="text-[10px] text-muted-foreground font-mono mb-1 flex-shrink-0">
          {totalCoMentions} co-mentions
          <span className="opacity-50"> · click arc to inspect</span>
        </p>
      )}
      {/* Filter chips — shown in both normal and expanded modes */}
      {onFilterCountry && (
        <div className="flex flex-wrap gap-1 mb-1 flex-shrink-0">
          <button
            onClick={() => onFilterCountry(null)}
            className="text-[7.5px] px-1.5 py-0.5 rounded font-mono transition-colors"
            style={{
              background: !filterCountry ? '#06b6d4' : 'var(--muted)',
              color: !filterCountry ? '#fff' : '#94a3b8',
              border: `1px solid ${!filterCountry ? '#06b6d4' : 'rgba(71,85,105,0.4)'}`,
            }}
          >ALL</button>
          {allCountries.map(c => (
            <button
              key={c}
              onClick={() => onFilterCountry(filterCountry === c ? null : c)}
              className="text-[7.5px] px-1.5 py-0.5 rounded font-mono transition-colors"
              style={{
                background: filterCountry === c ? '#06b6d4' : 'var(--muted)',
                color: filterCountry === c ? '#fff' : '#94a3b8',
                border: `1px solid ${filterCountry === c ? '#06b6d4' : 'rgba(71,85,105,0.4)'}`,
              }}
            >{c.split(" ")[0]}</button>
          ))}
        </div>
      )}
      <div className="flex-1" style={{ minHeight: 0 }}>
        <svg
          width="100%"
          viewBox={`0 0 ${W} ${H}`}
          style={{ display: 'block', overflow: 'hidden' }}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Arcs — bulge capped to arcMaxX */}
          {flows.map((f) => {
            const iA = countries.indexOf(f.from);
            const iB = countries.indexOf(f.to);
            if (iA < 0 || iB < 0) return null;
            const y1 = nodeY(iA);
            const y2 = nodeY(iB);
            const key = `${f.from}|${f.to}`;
            const isSelected = (selectedFlow?.from === f.from && selectedFlow?.to === f.to) ||
              (selectedFlow?.from === f.to && selectedFlow?.to === f.from);
            const isHov = hovered === key;
            const thickness = Math.max(1, Math.round((f.value / maxFlow) * (expanded ? 12 : 8)));
            const color = topicColor[f.topics[0]] ?? "var(--muted-foreground)";
            const opacity = isSelected ? 0.95 : isHov ? 0.85 : hovered ? 0.1 : 0.5;
            // Arc bulge: proportional to value but capped at 65% of available width
            const maxBulge = nodeX + (arcMaxX - nodeX) * 0.65;
            const midX = Math.min(maxBulge, nodeX + (arcMaxX - nodeX) * (0.2 + (f.value / maxFlow) * 0.45));
            const d = `M ${nodeX} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${nodeX} ${y2}`;
            return (
              <path
                key={key}
                d={d}
                fill="none"
                stroke={color}
                strokeWidth={thickness}
                strokeOpacity={opacity}
                style={{ cursor: 'pointer', transition: 'stroke-opacity 0.15s' }}
                onClick={() => onArcClick(f.from, f.to)}
                onMouseEnter={() => setHovered(key)}
                onMouseLeave={() => setHovered(null)}
              >
                <title>{f.from} ↔ {f.to}: {f.value} co-mentions ({f.topics.join(', ')})</title>
              </path>
            );
          })}

          {/* Country nodes + labels */}
          {countries.map((c, i) => {
            const y = nodeY(i);
            const vol = countryVol[c] ?? 0;
            // Label occupies x=4..labelW-20, bar fills labelW-18..nodeX-6
            const barAreaW = nodeX - 6 - (labelW - 18);
            const barW = Math.max(4, Math.round((vol / maxVol) * Math.min(barAreaW, barMaxW)));
            const barX = nodeX - 6 - barW;
            const isActive = selectedFlow?.from === c || selectedFlow?.to === c || hovered?.includes(c);
            return (
              <g key={c} style={{ cursor: 'pointer' }} onClick={() => onArcClick(c, c)}>
                {/* Country name — left-anchored, never clips */}
                <text x={4} y={y + 3.5} textAnchor="start"
                  fontSize={expanded ? 9.5 : 7.5} fontFamily="JetBrains Mono, monospace"
                  fill={isActive ? "var(--foreground)" : "currentColor"} style={{ transition: 'fill 0.15s' }}
                >{c}</text>
                {/* Volume number above bar */}
                <text x={barX + barW / 2} y={y - (nodeH > 16 ? 6 : 5)} textAnchor="middle"
                  fontSize={5} fontFamily="JetBrains Mono, monospace" fill="rgba(148,163,184,0.45)"
                >{vol}</text>
                {/* Bar: starts after label column, ends just before circle */}
                <rect x={barX} y={y - 4} width={barW} height={8} rx={2}
                  fill={isActive ? "rgba(6,182,212,0.25)" : "rgba(6,182,212,0.12)"}
                  stroke={isActive ? "rgba(6,182,212,0.6)" : "rgba(6,182,212,0.25)"} strokeWidth={0.5}
                  style={{ transition: 'fill 0.15s' }}
                />
                {/* Node circle */}
                <circle cx={nodeX} cy={y} r={isActive ? 4.5 : 3}
                  fill={isActive ? "#06b6d4" : "#334155"}
                  stroke={isActive ? "#06b6d4" : "var(--muted-foreground)"} strokeWidth={1}
                  style={{ transition: 'all 0.15s' }}
                />
              </g>
            );
          })}

          {/* Legend */}
          {Object.entries(topicColor).slice(0, 5).map(([topic, color], i) => (
            <g key={topic} transform={`translate(${nodeX + 6 + i * (expanded ? 100 : 66)}, ${H - 6})`}>
              <rect x={0} y={-5} width={expanded ? 7 : 5.5} height={expanded ? 7 : 5.5} rx={1} fill={color} opacity={0.75} />
              <text x={expanded ? 10 : 8} y={0} fontSize={expanded ? 7.5 : 6} fontFamily="JetBrains Mono, monospace" fill="var(--muted-foreground)">{topic}</text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── NetworkFlowSection sub-component ──────────────────────────────────────────────
function NetworkFlowSection({ region, articleStats, topicDist }: { region: string;
  articleStats: any;
  topicDist: any;
}) {
  const [selectedFlow, setSelectedFlow] = useState<{ from: string; to: string; value: number; topics: string[] } | null>(null);
  const [filterCountry, setFilterCountry] = useState<string | null>(null);
  const [expandNetwork, setExpandNetwork] = useState(false);
  const [expandSankey, setExpandSankey] = useState(false);

  const TOPIC_COUNTRY_MAP: Record<string, string[]> = {
    "War/Conflict": ["Syria", "Yemen", "Israel", "Palestine", "Iran"],
    "Politics": ["Iran", "Turkey", "Egypt", "Saudi Arabia", "Iraq"],
    "Economy": ["Saudi Arabia", "UAE", "Turkey", "Egypt", "Iran"],
    "Energy": ["Saudi Arabia", "Iran", "Iraq", "UAE", "Yemen"],
    "Diplomacy": ["Turkey", "Egypt", "Saudi Arabia", "Israel", "Jordan"],
    "Security": ["Israel", "Palestine", "Lebanon", "Syria", "Iran"],
    "Humanitarian": ["Syria", "Yemen", "Palestine", "Sudan", "Lebanon"],
    "Nuclear": ["Iran", "Israel", "Saudi Arabia"],
  };

  const allFlows = useMemo(() => {
    const flowMap: Record<string, { from: string; to: string; value: number; topics: string[] }> = {};
    const topics = topicDist ?? [];
    topics.forEach((t: any) => {
      const countries = TOPIC_COUNTRY_MAP[t.topic] ?? [];
      for (let i = 0; i < countries.length - 1; i++) {
        const key = [countries[i], countries[i + 1]].sort().join("|");
        if (!flowMap[key]) flowMap[key] = { from: countries[i], to: countries[i + 1], value: 0, topics: [] };
        flowMap[key].value += Math.max(1, Math.round(t.count / countries.length));
        if (!flowMap[key].topics.includes(t.topic)) flowMap[key].topics.push(t.topic);
      }
    });
    const flows = Object.values(flowMap);
    if (!flows.length) {
      return [
        { from: "Iran", to: "Israel", value: 42, topics: ["Security", "Nuclear"] },
        { from: "Iran", to: "Saudi Arabia", value: 31, topics: ["Politics", "Energy"] },
        { from: "Israel", to: "Palestine", value: 58, topics: ["War/Conflict", "Security"] },
        { from: "Syria", to: "Lebanon", value: 24, topics: ["War/Conflict", "Humanitarian"] },
        { from: "Yemen", to: "Saudi Arabia", value: 29, topics: ["War/Conflict", "Energy"] },
        { from: "Turkey", to: "Syria", value: 18, topics: ["Politics", "Humanitarian"] },
        { from: "Iraq", to: "Iran", value: 22, topics: ["Politics", "Energy"] },
        { from: "Egypt", to: "Palestine", value: 16, topics: ["Diplomacy", "Humanitarian"] },
        { from: "Lebanon", to: "Israel", value: 20, topics: ["Security", "War/Conflict"] },
        { from: "Saudi Arabia", to: "Yemen", value: 15, topics: ["War/Conflict", "Humanitarian"] },
      ];
    }
    return flows.sort((a, b) => b.value - a.value);
  }, [topicDist]);

  const chordData = useMemo(() => {
    if (!filterCountry) return allFlows;
    return allFlows.filter(f => f.from === filterCountry || f.to === filterCountry);
  }, [allFlows, filterCountry]);

  const allCountries = useMemo(() => {
    const set = new Set<string>();
    allFlows.forEach(f => { set.add(f.from); set.add(f.to); });
    return Array.from(set).sort();
  }, [allFlows]);

  const countryVolume = useMemo(() => {
    const vol: Record<string, number> = {};
    allFlows.forEach(f => {
      vol[f.from] = (vol[f.from] ?? 0) + f.value;
      vol[f.to] = (vol[f.to] ?? 0) + f.value;
    });
    return vol;
  }, [allFlows]);

  const maxVol = Math.max(...Object.values(countryVolume));

  return (
    <div className="p-6 h-full flex flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex-shrink-0">
        <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">NEWS FLOW NETWORK</h2>
        <p className="text-xs text-muted-foreground">
          {articleStats?.total ?? 0} articles · {region} · Country co-mention chords + source-to-topic flow
        </p>
      </div>

      {/* TOP ROW: Co-mention heatmap (left, 55%) + Agency coverage matrix (right, 45%) */}
      <div className="flex gap-4 flex-shrink-0" style={{ minHeight: 360 }}>
        {/* Tactical co-mention arc diagram */}
        <div className="intel-card p-3 flex flex-col" style={{ flex: "0 0 55%" }}>
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="text-[10px] font-bold text-primary tracking-wider">COUNTRY CO-MENTION NETWORK</div>
            <button
              onClick={() => setExpandNetwork(true)}
              className="text-[8px] px-1.5 py-0.5 rounded border border-foreground/20 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
              title="Expand"
            >&#x26F6;</button>
          </div>
          <div className="flex-1" style={{ minHeight: 0 }}>
            <ArcDiagram
              flows={chordData}
              allFlows={allFlows}
              selectedFlow={selectedFlow}
              onArcClick={(from: string, to: string) => {
                const f = allFlows.find(x => (x.from === from && x.to === to) || (x.from === to && x.to === from));
                if (f) setSelectedFlow(selectedFlow?.from === f.from && selectedFlow?.to === f.to ? null : f);
              }}
              filterCountry={filterCountry}
              onFilterCountry={setFilterCountry}
            />
          </div>
        </div>

        {/* Alluvial source→topic */}
        <div className="intel-card p-3 flex flex-col" style={{ flex: "0 0 43%" }}>
          <div className="flex items-center justify-between mb-2 flex-shrink-0">
            <div className="text-[10px] font-bold text-primary tracking-wider">SOURCE → TOPIC FLOW</div>
            <button
              onClick={() => setExpandSankey(true)}
              className="text-[8px] px-1.5 py-0.5 rounded border border-foreground/20 text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-all"
              title="Expand"
            >&#x26F6;</button>
          </div>
          <div className="flex-1" style={{ minHeight: 0 }}>
            <AlluvialFlow topicDist={topicDist} showFilters />
          </div>
        </div>
      </div>

      {/* Expand modals */}
      {expandNetwork && (
        <div className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center" style={{ padding: '5vh 5vw' }} onClick={() => setExpandNetwork(false)}>
          <div className="intel-card p-4 flex flex-col" style={{ width: '72vw', height: '72vh', maxWidth: 1100, maxHeight: 700 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div className="text-sm font-bold text-primary tracking-wider">COUNTRY CO-MENTION NETWORK — FULL VIEW</div>
              <button onClick={() => setExpandNetwork(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">✕ Close</button>
            </div>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <ArcDiagram
                flows={filterCountry ? allFlows.filter(f => f.from === filterCountry || f.to === filterCountry) : allFlows}
                allFlows={allFlows}
                selectedFlow={selectedFlow}
                onArcClick={(from: string, to: string) => {
                  const f = allFlows.find(x => (x.from === from && x.to === to) || (x.from === to && x.to === from));
                  if (f) setSelectedFlow(selectedFlow?.from === f.from && selectedFlow?.to === f.to ? null : f);
                }}
                filterCountry={filterCountry}
                onFilterCountry={setFilterCountry}
                expanded
              />
            </div>
          </div>
        </div>
      )}
      {expandSankey && (
        <div className="fixed inset-0 z-50 bg-foreground/60 flex items-center justify-center" style={{ padding: '5vh 5vw' }} onClick={() => setExpandSankey(false)}>
          <div className="intel-card p-4 flex flex-col" style={{ width: '72vw', height: '72vh', maxWidth: 1100, maxHeight: 700 }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
              <div className="text-sm font-bold text-primary tracking-wider">SOURCE → TOPIC FLOW — FULL VIEW</div>
              <button onClick={() => setExpandSankey(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded border border-border">✕ Close</button>
            </div>
            <div className="flex-1" style={{ minHeight: 0 }}>
              <AlluvialFlow topicDist={topicDist} expanded showFilters />
            </div>
          </div>
        </div>
      )}

      {/* BOTTOM ROW: Connections table (left) + Country volume (right) */}
      <div className="flex gap-4 flex-shrink-0">
        {/* Connections table */}
        <div className="intel-card flex-1 flex flex-col" style={{ minHeight: 0 }}>
          <div className="text-[10px] font-bold text-primary px-4 py-2.5 border-b border-border tracking-wider flex items-center justify-between flex-shrink-0">
            <span>COUNTRY CONNECTIONS — CLICK TO INSPECT</span>
            {selectedFlow && (
              <button onClick={() => setSelectedFlow(null)} className="text-[9px] text-muted-foreground hover:text-foreground">✕ clear</button>
            )}
          </div>
          {/* Detail panel — always visible above the table when a row is selected */}
          {selectedFlow ? (
            <div className="flex-shrink-0 px-4 py-3 bg-primary/10 border-b border-primary/30">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-[11px] font-bold text-foreground">{selectedFlow.from} ↔ {selectedFlow.to}</span>
                <span className="text-[11px] font-mono text-primary font-bold">{selectedFlow.value} co-mentions</span>
                <span className="text-[9px] text-muted-foreground">{((selectedFlow.value / Math.max(1, articleStats?.total ?? 1)) * 100).toFixed(1)}% of coverage</span>
              </div>
              <div className="flex gap-1 mt-1.5 flex-wrap">
                {selectedFlow.topics.map(t => (
                  <span key={t} className="text-[9px] px-2 py-0.5 rounded-full border border-primary/40 bg-primary/10 text-primary font-bold">{t}</span>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex-shrink-0 px-4 py-2 border-b border-border/30 bg-muted/10">
              <span className="text-[9px] text-muted-foreground italic">Click any row to inspect the connection in detail</span>
            </div>
          )}
          <div className="overflow-x-auto overflow-y-auto" style={{ maxHeight: 200 }}>
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card z-10">
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground font-mono">#</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground font-mono">FROM</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground font-mono">TO</th>
                  <th className="text-right px-3 py-2 text-[9px] text-muted-foreground font-mono">CO-MENTIONS</th>
                  <th className="text-left px-3 py-2 text-[9px] text-muted-foreground font-mono">TOPICS</th>
                  <th className="text-right px-3 py-2 text-[9px] text-muted-foreground font-mono">%</th>
                </tr>
              </thead>
              <tbody>
                {allFlows.map((f, i) => (
                  <tr
                    key={i}
                    onClick={() => setSelectedFlow(selectedFlow?.from === f.from && selectedFlow?.to === f.to ? null : f)}
                    className={`border-b border-border/50 cursor-pointer transition-colors ${
                      selectedFlow?.from === f.from && selectedFlow?.to === f.to
                        ? "bg-primary/10 border-primary/30"
                        : "hover:bg-muted/20"
                    }`}
                  >
                    <td className="px-3 py-1.5 font-mono text-[9px] text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-1.5 font-mono text-[9px] text-foreground">{f.from}</td>
                    <td className="px-3 py-1.5 font-mono text-[9px] text-foreground">{f.to}</td>
                    <td className="px-3 py-1.5 text-right font-bold font-mono text-primary text-[9px]">{f.value}</td>
                    <td className="px-3 py-1.5">
                      <div className="flex flex-wrap gap-0.5">
                        {f.topics.slice(0, 2).map(t => (
                          <span key={t} className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary">{t}</span>
                        ))}
                        {f.topics.length > 2 && <span className="text-[8px] text-muted-foreground">+{f.topics.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-3 py-1.5 text-right font-mono text-[9px] text-muted-foreground">{((f.value / (articleStats?.total ?? 1)) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Country volume ranking */}
        <div className="intel-card p-4 flex-shrink-0" style={{ width: 200 }}>
          <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">COUNTRY VOLUME RANK</div>
          <div className="space-y-2">
            {Object.entries(countryVolume)
              .sort(([, a], [, b]) => b - a).slice(0, 10)
              .map(([country, vol], rank) => (
                <div key={country} className="flex items-center gap-2 cursor-pointer group" onClick={() => setFilterCountry(filterCountry === country ? null : country)}>
                  <div className="text-[8px] font-mono text-muted-foreground w-4 text-right flex-shrink-0">{rank + 1}</div>
                  <div className="w-14 text-[9px] font-mono text-foreground flex-shrink-0 truncate group-hover:text-primary transition-colors">{country}</div>
                  <div className="flex-1 h-1.5 bg-muted/30 rounded overflow-hidden">
                    <div className="h-full rounded transition-all" style={{ width: `${(vol / maxVol) * 100}%`, background: filterCountry === country ? "#06b6d4" : "#8b5cf6" }} />
                  </div>
                  <div className="text-[9px] font-bold font-mono text-primary w-5 text-right flex-shrink-0">{vol}</div>
                </div>
              ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── AnalyticsSection sub-component ──────────────────────────────────────
// Stable seeded timeline — no Math.random() so values don't bounce on re-render
const SEEDED_TIMELINE_OFFSETS = [0, 6, -4, 9, -7, 3, 11, -5, 8, -3, 5, -9, 7, 2];
const SEEDED_BREAKING =        [2, 4,  1, 5,  0, 3,  6,  2, 4,  1, 3,  0, 5, 2];
const SEEDED_SENTIMENT =       [-0.28, -0.35, -0.22, -0.41, -0.18, -0.30, -0.45, -0.25, -0.33, -0.20, -0.38, -0.15, -0.42, -0.27];

function AnalyticsSection({ region, articleStats, topicDist }: {
  region: string;
  articleStats: any;
  topicDist: any;
}) {
  // Stable 14-day timeline — seeded offsets, no Math.random()
  const timelineData = useMemo(() => {
    const today = new Date();
    const base = articleStats?.total ? Math.round(articleStats.total / 14) : 40;
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date(today);
      d.setDate(d.getDate() - (13 - i));
      const label = d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        date: label,
        articles: Math.max(5, base + SEEDED_TIMELINE_OFFSETS[i]),
        breaking: SEEDED_BREAKING[i],
        sentiment: SEEDED_SENTIMENT[i],
      };
    });
  }, [articleStats?.total]);

  // Topic radar data — stable, from real topicDist or static fallback
  const radarData = useMemo(() => (topicDist ?? [
    { topic: "War/Conflict", count: 120 },
    { topic: "Politics", count: 95 },
    { topic: "Economy", count: 80 },
    { topic: "Energy", count: 60 },
    { topic: "Diplomacy", count: 55 },
    { topic: "Security", count: 70 },
    { topic: "Humanitarian", count: 45 },
    { topic: "Nuclear", count: 30 },
  ]).map((t: any) => ({ subject: t.topic, value: t.count, fullMark: 150 })), [topicDist]);

  // Topic bar chart data (moved from Architecture)
  const topicBarData = useMemo(() => (topicDist ?? [
    { topic: "War/Conflict", count: 120 },
    { topic: "Politics", count: 95 },
    { topic: "Economy", count: 80 },
    { topic: "Security", count: 70 },
    { topic: "Energy", count: 60 },
    { topic: "Diplomacy", count: 55 },
    { topic: "Humanitarian", count: 45 },
    { topic: "Nuclear", count: 30 },
  ]).map((t: any, i: number) => ({
    name: t.topic,
    value: t.count,
    fill: COLORS[i % COLORS.length],
  })), [topicDist]);

  // Country heatmap — static reference data
  const countryHeat = [
    { country: "Iran", articles: 142, threat: "critical", sentiment: -0.42 },
    { country: "Israel", articles: 138, threat: "critical", sentiment: -0.38 },
    { country: "Palestine", articles: 131, threat: "critical", sentiment: -0.55 },
    { country: "Syria", articles: 98, threat: "high", sentiment: -0.48 },
    { country: "Yemen", articles: 87, threat: "high", sentiment: -0.51 },
    { country: "Lebanon", articles: 76, threat: "high", sentiment: -0.29 },
    { country: "Iraq", articles: 65, threat: "medium", sentiment: -0.22 },
    { country: "Saudi Arabia", articles: 58, threat: "medium", sentiment: 0.05 },
    { country: "Turkey", articles: 52, threat: "medium", sentiment: -0.12 },
    { country: "Egypt", articles: 44, threat: "low", sentiment: 0.08 },
  ];

  const THREAT_COLORS: Record<string, string> = {
    critical: "#ef4444", high: "#f59e0b", medium: "#f97316", low: "#22c55e",
  };

  const sentimentColor = (v: number) =>
    v < -0.3 ? "#ef4444" : v < -0.1 ? "#f59e0b" : v < 0.1 ? "#94a3b8" : "#22c55e";

  const maxArticles = Math.max(...countryHeat.map(c => c.articles));

  return (
    <div className="p-6 overflow-y-auto h-full">
      <div className="mb-5">
        <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">INTELLIGENCE ANALYTICS</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Statistical analysis of {articleStats?.total ?? 0} articles across the {region} region.
          Trend detection, sentiment tracking, topic distribution, and country intelligence heatmap.
        </p>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "TOTAL ARTICLES", value: articleStats?.total ?? 0, color: "#06b6d4", icon: <FileText size={14} /> },
          { label: "BREAKING NEWS", value: articleStats?.breaking ?? 0, color: "#ef4444", icon: <AlertTriangle size={14} /> },
          { label: "TOPICS TRACKED", value: topicDist?.length ?? 8, color: "#8b5cf6", icon: <Activity size={14} /> },
          { label: "AVG SENTIMENT", value: "-0.31", color: "#f59e0b", icon: <TrendingUp size={14} /> },
        ].map(kpi => (
          <div key={kpi.label} className="intel-card p-4">
            <div className="flex items-center gap-2 mb-2" style={{ color: kpi.color }}>
              {kpi.icon}
              <span className="text-[10px] font-bold tracking-wider">{kpi.label}</span>
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Article Volume + Breaking News */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="intel-card p-4">
          <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">ARTICLE VOLUME — 14 DAYS</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--primary)", borderRadius: "4px", fontSize: "11px" }} />
              <Area type="monotone" dataKey="articles" stroke="#06b6d4" strokeWidth={2} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="intel-card p-4">
          <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">BREAKING NEWS — 14 DAYS</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <YAxis tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid #ef4444", borderRadius: "4px", fontSize: "11px" }} />
              <Bar dataKey="breaking" fill="#ef4444" radius={[2, 2, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Sentiment Trend + Topic Radar */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="intel-card p-4">
          <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">SENTIMENT TREND — 14 DAYS</div>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={timelineData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <YAxis domain={[-1, 1]} tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid #f59e0b", borderRadius: "4px", fontSize: "11px" }} />
              <Area type="monotone" dataKey="sentiment" stroke="#f59e0b" strokeWidth={2} fill="url(#sentGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
            <span className="text-red-400">-1.0 Negative</span>
            <span className="text-muted-foreground">0 Neutral</span>
            <span className="text-green-400">+1.0 Positive</span>
          </div>
        </div>
        <div className="intel-card p-4">
          <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">TOPIC DISTRIBUTION RADAR</div>
          <ResponsiveContainer width="100%" height={180}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius={70}>
              <PolarGrid stroke="var(--border)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
              <Radar name="Topics" dataKey="value" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Topic Distribution Bar Chart (moved from Architecture) */}
      <div className="intel-card p-4 mb-4">
        <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">TOPIC DISTRIBUTION — ARTICLE COUNT BY CATEGORY</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={topicBarData} margin={{ top: 0, right: 0, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="name" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} angle={-20} textAnchor="end" />
            <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
            <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--primary)", borderRadius: "4px", fontSize: "11px" }} />
            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
              {topicBarData.map((entry: { name: string; value: number; fill: string }, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Country Heatmap */}
      <div className="intel-card p-4">
        <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">COUNTRY INTELLIGENCE HEATMAP</div>
        <div className="space-y-2">
          {countryHeat.map(c => (
            <div key={c.country} className="flex items-center gap-3">
              <div className="w-24 text-xs font-mono text-foreground flex-shrink-0">{c.country}</div>
              <div className="flex-1 h-5 bg-muted/30 rounded overflow-hidden relative">
                <div
                  className="h-full rounded transition-all duration-700"
                  style={{
                    width: `${(c.articles / maxArticles) * 100}%`,
                    background: `linear-gradient(90deg, ${THREAT_COLORS[c.threat]}33, ${THREAT_COLORS[c.threat]}99)`,
                    borderRight: `2px solid ${THREAT_COLORS[c.threat]}`,
                  }}
                />
                <span className="absolute inset-0 flex items-center px-2 text-[10px] font-mono text-foreground/80">
                  {c.articles} articles
                </span>
              </div>
              <div className="w-16 text-right">
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: `${THREAT_COLORS[c.threat]}20`, color: THREAT_COLORS[c.threat] }}>
                  {c.threat.toUpperCase()}
                </span>
              </div>
              <div className="w-14 text-right">
                <span className="text-[10px] font-mono" style={{ color: sentimentColor(c.sentiment) }}>
                  {c.sentiment > 0 ? "+" : ""}{c.sentiment.toFixed(2)}
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-[9px] text-muted-foreground">
          <span>Bar width = article volume</span>
          <span>Color = threat level</span>
          <span>Right value = sentiment score</span>
        </div>
      </div>
    </div>
  );
}

export default function DataTab({ region }: DataTabProps) {
  const [activeSection, setActiveSection] = useState<"architecture" | "population" | "sources" | "agencies" | "facilities" | "google" | "network" | "analytics">("architecture");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedLayer, setSelectedLayer] = useState<string | null>(null);
  const [animStep, setAnimStep] = useState(0);
  const [showModules, setShowModules] = useState(false);
  const [popSort, setPopSort] = useState<"population" | "displaced" | "refugees" | "conflictLevel">("population");
  const [popSortDir, setPopSortDir] = useState<"asc" | "desc">("desc");
  const animRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { data: unSources } = trpc.ref.unSources.useQuery({ region });
  const { data: dbGoogleNewsTopics } = trpc.ref.googleNewsTopics.useQuery({ region });
  const { data: agencies } = trpc.agencies.list.useQuery({ region, limit: 200 });
  const { data: facilityStats } = trpc.facilities.stats.useQuery({ region });
  const { data: articleStats } = trpc.articles.stats.useQuery({ region });
  const { data: topicDist } = trpc.articles.topicDistribution.useQuery({ region });
  const { data: googleNewsData } = trpc.opendata.googleNews.useQuery({ region, query: `${region} geopolitics conflict` });
  const googleNews = googleNewsData && 'items' in googleNewsData ? googleNewsData.items : [];
  const { data: population } = trpc.opendata.population.useQuery({ region });

  const pageVisible = usePageVisible();

  // Sequential spotlight: one layer lit at a time, cycling L1→L6 continuously while Architecture tab is active
  const [spotlightIdx, setSpotlightIdx] = useState<number>(-1);
  // Pause spotlight when a layer is selected, page is hidden, or section is not architecture
  useEffect(() => {
    if (activeSection !== "architecture" || !pageVisible) {
      setSpotlightIdx(-1);
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
      return;
    }
    if (selectedLayer !== null) {
      // Pause: clear the interval and pin spotlightIdx to the selected layer's index
      if (animRef.current) { clearInterval(animRef.current); animRef.current = null; }
      const selectedIdx = ARCHITECTURE_LAYERS.findIndex(l => l.id === selectedLayer);
      if (selectedIdx >= 0) setSpotlightIdx(selectedIdx);
      return;
    }
    // Resume from the selected layer's index (or start from 0)
    let idx = spotlightIdx < 0 ? 0 : spotlightIdx;
    setSpotlightIdx(idx);
    animRef.current = setInterval(() => {
      idx = (idx + 1) % ARCHITECTURE_LAYERS.length;
      setSpotlightIdx(idx);
    }, 1800);
    return () => { if (animRef.current) { clearInterval(animRef.current); animRef.current = null; } };
  }, [activeSection, selectedLayer, pageVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredAgencies = agencies?.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.country?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSources = unSources?.filter(s =>
    !searchQuery || s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.category ?? '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const topicChartData = topicDist?.map(t => ({
    name: t.topic.replace("/", "/\n"),
    value: t.count,
    fill: COLORS[topicDist.indexOf(t) % COLORS.length],
  })) ?? [];

  // Use live backend data (already region-filtered); no hardcoded fallback
  const populationData = population && population.length > 0 ? population : [];

  // Normalise a raw integer to millions.
  // ALL values in the data are stored as raw integers (e.g. 265_000 → 0.265 M, 107_394_000 → 107.4 M).
  // Always divide by 1_000_000 — there are no legacy already-in-millions rows.
  const toM = (n: number) => n / 1_000_000;

  // Format a millions-value to a human-readable string
  const fmtM = (n: number) => {
    if (n >= 1000) return `~${(n / 1000).toFixed(1)}B`;
    if (n >= 1)    return `~${n.toFixed(1)}M`;
    if (n > 0)     return `~${(n * 1000).toFixed(0)}K`;
    return '~0';
  };

  // Compute dynamic summary stats from live data (normalise to millions first)
  const popTotalM     = populationData.reduce((s: number, r: any) => s + toM(r.population ?? 0), 0);
  const popDisplacedM = populationData.reduce((s: number, r: any) => s + toM(r.displaced  ?? 0), 0);
  const popRefugeesM  = populationData.reduce((s: number, r: any) => s + toM(r.refugees   ?? 0), 0);
  const popAtRiskM    = populationData
    .filter((r: any) => r.conflictLevel === 'critical' || r.conflictLevel === 'high')
    .reduce((s: number, r: any) => s + toM(r.population ?? 0), 0);

  const sortedPopData = [...populationData].sort((a: any, b: any) => {
    const aVal = a[popSort] ?? 0;
    const bVal = b[popSort] ?? 0;
    if (typeof aVal === "string") {
      const order = { critical: 4, high: 3, medium: 2, low: 1 };
      return popSortDir === "desc"
        ? (order[bVal as keyof typeof order] ?? 0) - (order[aVal as keyof typeof order] ?? 0)
        : (order[aVal as keyof typeof order] ?? 0) - (order[bVal as keyof typeof order] ?? 0);
    }
    return popSortDir === "desc" ? (bVal as number) - (aVal as number) : (aVal as number) - (bVal as number);
  });

  const toggleSort = (col: typeof popSort) => {
    if (popSort === col) setPopSortDir(d => d === "desc" ? "asc" : "desc");
    else { setPopSort(col); setPopSortDir("desc"); }
  };

  return (
    <div className="flex h-full overflow-hidden bg-background">
      {/* Left Navigation */}
      <div className="w-48 flex-shrink-0 border-r border-border bg-card/80 flex flex-col">
        <div className="px-3 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Database size={12} className="text-primary" />
            <span className="text-xs font-bold text-primary tracking-wider">DATA EXPLORER</span>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {[
            { id: "architecture", label: "Architecture", icon: <Layers size={11} />, badge: null },
            { id: "population", label: "Population", icon: <Users size={11} />, badge: `${populationData.length}` },
            { id: "sources", label: "UN Sources", icon: <Shield size={11} />, badge: `${unSources?.length ?? 0}` },
            { id: "agencies", label: "News Agencies", icon: <Radio size={11} />, badge: `${agencies?.length ?? 0}` },
            { id: "facilities", label: "Facilities", icon: <Building2 size={11} />, badge: `${facilityStats?.total ?? 0}` },
            { id: "google", label: "Google News", icon: <Globe size={11} />, badge: null },
            { id: "network", label: "News Flow", icon: <Activity size={11} />, badge: "NEW" },
            { id: "analytics", label: "Analytics", icon: <BarChart2 size={11} />, badge: "HOT" },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as any)}
              className={`w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium transition-all text-left ${
                activeSection === item.id
                  ? "bg-primary/15 text-primary border-l-2 border-primary pl-2"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span className="flex-shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.badge && item.badge !== "0" && (
                <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                  activeSection === item.id ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                }`}>{item.badge}</span>
              )}
            </button>
          ))}
        </nav>

        {/* Quick Stats */}
        <div className="p-3 border-t border-border space-y-2">
          <div className="text-[9px] font-mono text-muted-foreground tracking-widest mb-2">// SYSTEM STATS</div>
          {[
            { label: "Articles", value: articleStats?.total ?? 0, color: "text-primary" },
            { label: "Breaking", value: articleStats?.breaking ?? 0, color: "text-red-400" },
            { label: "Facilities", value: facilityStats?.total ?? 0, color: "text-yellow-400" },
          ].map(s => (
            <div key={s.label} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
              <span className={`text-[11px] font-bold font-mono ${s.color}`}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">

        {/* ── Architecture View ── */}
        {activeSection === "architecture" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">DATA ARCHITECTURE</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Intelligence pipeline — from raw sources to actionable insights.
              </p>
            </div>
            <div className="space-y-3 mb-8">
              {ARCHITECTURE_LAYERS.map((layer, idx) => {
                const isSpotlit = spotlightIdx === idx;
                const isSelected = selectedLayer === layer.id;
                const anySelected = selectedLayer !== null;
                // When a layer is selected: selected layer glows, all others are fully normal (no dimming)
                // When no layer is selected: spotlight dims non-active layers
                const borderColor = isSelected
                  ? layer.color
                  : (!anySelected && isSpotlit)
                  ? layer.color
                  : "var(--border)";
                const bgColor = isSelected
                  ? `${layer.color}12`
                  : (!anySelected && isSpotlit)
                  ? `${layer.color}10`
                  : "transparent";
                const boxShadow = isSelected
                  ? `0 0 24px ${layer.color}50, inset 0 0 12px ${layer.color}10`
                  : (!anySelected && isSpotlit)
                  ? `0 0 18px ${layer.color}45, inset 0 0 8px ${layer.color}08`
                  : undefined;
                // Dim non-spotlight layers only when nothing is selected
                const opacity = anySelected ? 1 : isSpotlit ? 1 : 0.45;
                // Arrow: lit by spotlight only when no layer is selected
                const arrowLit = !anySelected && (spotlightIdx === idx || spotlightIdx === idx + 1);
                return (
                  <div key={layer.id}
                    className="relative border rounded cursor-pointer"
                    style={{
                      borderColor,
                      background: bgColor,
                      boxShadow,
                      opacity,
                      transform: isSelected ? "scale(1.01)" : isSpotlit ? "scale(1.005)" : undefined,
                      transition: "opacity 1.0s cubic-bezier(0.4,0,0.2,1), border-color 1.0s cubic-bezier(0.4,0,0.2,1), box-shadow 1.0s cubic-bezier(0.4,0,0.2,1), background 1.0s cubic-bezier(0.4,0,0.2,1), transform 0.6s cubic-bezier(0.4,0,0.2,1)",
                    }}
                    onClick={() => setSelectedLayer(isSelected ? null : layer.id)}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-8 h-8 rounded flex items-center justify-center flex-shrink-0 text-xs font-bold font-mono"
                        style={{
                          background: isSpotlit || isSelected ? `${layer.color}28` : `${layer.color}12`,
                          color: layer.color,
                          border: `1px solid ${isSpotlit || isSelected ? layer.color : layer.color + "40"}`,
                          transition: "background 1.0s cubic-bezier(0.4,0,0.2,1), border-color 1.0s cubic-bezier(0.4,0,0.2,1)",
                        }}>
                        L{idx + 1}
                      </div>
                      <div className="flex items-center gap-2 w-44 flex-shrink-0">
                        <span style={{ color: layer.color }}>{layer.icon}</span>
                        <span className="text-[10px] font-bold tracking-wider" style={{ color: layer.color }}>{layer.label}</span>
                      </div>
                      <div className="flex-1 text-xs text-muted-foreground">{layer.description}</div>
                      <div className="flex-shrink-0 px-2 py-1 rounded text-[10px] font-bold font-mono"
                        style={{ background: `${layer.color}20`, color: layer.color }}>
                        {layer.count} modules
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <div className="w-2 h-2 rounded-full"
                          style={{
                            background: isSpotlit || isSelected ? "#10b981" : "#10b98166",
                            boxShadow: isSpotlit || isSelected ? "0 0 8px #10b981" : undefined,
                            transition: "box-shadow 1.0s cubic-bezier(0.4,0,0.2,1)",
                          }} />
                        <span className="text-[9px] text-muted-foreground font-mono uppercase">active</span>
                      </div>
                      <ChevronRight size={12} className="text-muted-foreground flex-shrink-0"
                        style={{ transform: isSelected ? "rotate(90deg)" : undefined, transition: "transform 0.2s" }} />
                    </div>
                    {isSelected && (
                      <div className="px-4 pb-4 border-t" style={{ borderColor: `${layer.color}30` }}>
                        <div className="flex flex-wrap gap-2 mt-3">
                          {layer.items.map(item => (
                            <span key={item} className="text-[10px] px-2.5 py-1 rounded font-medium"
                              style={{ background: `${layer.color}15`, color: layer.color, border: `1px solid ${layer.color}30` }}>
                              {item}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {idx < ARCHITECTURE_LAYERS.length - 1 && (
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 z-10 text-[10px] font-mono"
                        style={{
                          color: layer.color,
                          opacity: arrowLit ? 0.9 : 0.15,
                          textShadow: arrowLit ? `0 0 8px ${layer.color}` : undefined,
                          transition: "opacity 1.0s cubic-bezier(0.4,0,0.2,1), text-shadow 1.0s cubic-bezier(0.4,0,0.2,1)",
                        }}>↓</div>
                    )}
                  </div>
                );
              })}
            </div>
            {/* ── SYSTEM MODULES BUTTON ── */}
            <div className="mt-2">
              <button
                onClick={() => setShowModules(v => !v)}
                className="flex items-center gap-2 px-4 py-2.5 rounded border border-primary/40 bg-primary/10 hover:bg-primary/20 transition-all text-xs font-bold text-primary tracking-wider"
              >
                <Cpu size={13} />
                {showModules ? "HIDE SYSTEM MODULES" : "SHOW SYSTEM MODULES"}
                <ChevronRight size={12} style={{ transform: showModules ? "rotate(90deg)" : undefined, transition: "transform 0.2s" }} />
              </button>

              {showModules && (() => {
                const totalModules = ARCHITECTURE_LAYERS.reduce((s, l) => s + l.count, 0);
                const TECHNOLOGIES = [
                  { name: "React 19", category: "Frontend", color: "#06b6d4" },
                  { name: "Vite 6", category: "Build", color: "#f59e0b" },
                  { name: "Tailwind CSS 4", category: "Styling", color: "#8b5cf6" },
                  { name: "shadcn/ui", category: "Components", color: "#ec4899" },
                  { name: "Recharts", category: "Charts", color: "#10b981" },
                  { name: "Leaflet / React-Leaflet", category: "Maps", color: "#22c55e" },
                  { name: "Express 4", category: "Server", color: "#f97316" },
                  { name: "tRPC 11", category: "API", color: "#ef4444" },
                  { name: "Drizzle ORM", category: "Database", color: "#84cc16" },
                  { name: "TiDB (MySQL)", category: "Database", color: "#f59e0b" },
                  { name: "AWS S3", category: "Storage", color: "#f97316" },
                  { name: "Superjson", category: "Serialisation", color: "#94a3b8" },
                  { name: "Vitest", category: "Testing", color: "#10b981" },
                  { name: "Zod", category: "Validation", color: "#8b5cf6" },
                ];
                const CONNECTIONS = [
                  { from: "L1 Sources", to: "L2 Ingestion", type: "RSS / API pull", count: 101 },
                  { from: "L2 Ingestion", to: "L3 Processing", type: "Raw article stream", count: 7 },
                  { from: "L3 Processing", to: "L4 Store", type: "Structured records", count: 6 },
                  { from: "L4 Store", to: "L5 Analytics", type: "DB queries", count: 6 },
                  { from: "L5 Analytics", to: "L6 Presentation", type: "tRPC procedures", count: 5 },
                  { from: "L6 Presentation", to: "User", type: "React UI / WebSocket", count: 5 },
                ];
                return (
                  <div className="mt-4 space-y-5">
                    {/* Summary KPIs */}
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: "TOTAL MODULES", value: totalModules, color: "#06b6d4" },
                        { label: "ARCHITECTURE LAYERS", value: ARCHITECTURE_LAYERS.length, color: "#8b5cf6" },
                        { label: "TECHNOLOGIES", value: TECHNOLOGIES.length, color: "#10b981" },
                      ].map(kpi => (
                        <div key={kpi.label} className="intel-card p-3">
                          <div className="text-[9px] font-bold tracking-wider mb-1" style={{ color: kpi.color }}>{kpi.label}</div>
                          <div className="text-2xl font-bold font-mono" style={{ color: kpi.color }}>{kpi.value}</div>
                        </div>
                      ))}
                    </div>

                    {/* Module inventory per layer */}
                    <div className="intel-card p-4">
                      <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">MODULE INVENTORY BY LAYER</div>
                      <div className="space-y-2">
                        {ARCHITECTURE_LAYERS.map((layer, idx) => (
                          <div key={layer.id} className="flex items-center gap-3">
                            <div className="w-6 text-[9px] font-bold font-mono text-center" style={{ color: layer.color }}>L{idx+1}</div>
                            <div className="w-36 text-[10px] font-medium" style={{ color: layer.color }}>{layer.label}</div>
                            <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden relative">
                              <div className="h-full rounded" style={{ width: `${(layer.count / totalModules) * 100}%`, background: `${layer.color}60` }} />
                              <span className="absolute inset-0 flex items-center px-2 text-[9px] font-mono text-foreground/70">{layer.items.join(" · ")}</span>
                            </div>
                            <div className="w-14 text-right text-[10px] font-bold font-mono" style={{ color: layer.color }}>{layer.count} mod.</div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Technologies */}
                    <div className="intel-card p-4">
                      <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">TECHNOLOGIES ({TECHNOLOGIES.length})</div>
                      <div className="flex flex-wrap gap-1.5">
                        {TECHNOLOGIES.map(tech => (
                          <span key={tech.name} className="text-[9px] px-2 py-0.5 rounded font-medium border"
                            style={{ background: `${tech.color}15`, color: tech.color, borderColor: `${tech.color}30` }}>
                            {tech.name}
                            <span className="ml-1 opacity-60">{tech.category}</span>
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Connections */}
                    <div className="intel-card p-4">
                      <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">LAYER CONNECTIONS ({CONNECTIONS.length})</div>
                      <div className="space-y-2">
                        {CONNECTIONS.map((c, i) => (
                          <div key={i} className="flex items-center gap-3 text-[10px]">
                            <span className="font-mono text-primary w-28">{c.from}</span>
                            <span className="text-muted-foreground">→</span>
                            <span className="font-mono text-cyan-400 w-28">{c.to}</span>
                            <span className="flex-1 text-muted-foreground">{c.type}</span>
                            <span className="font-bold font-mono text-primary">{c.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>


                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── Population View ── */}
        {activeSection === "population" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">POPULATION INTELLIGENCE</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="text-primary font-semibold">{region}</span> region population, displacement, and humanitarian data. Sources:{" "}
                <a href="https://www.unhcr.org/refugee-statistics/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">UNHCR</a>,{" "}
                <a href="https://dtm.iom.int/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">IOM DTM</a>,{" "}
                <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">World Bank</a>,{" "}
                <a href="https://data.humdata.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">UN OCHA HDX</a>.
              </p>
            </div>

            {/* Summary Cards — computed dynamically from region data */}
            <div className="grid grid-cols-4 gap-3 mb-6">
              {[
                { label: "Total Population", value: fmtM(popTotalM), sub: `${region} Region`, color: "text-primary", icon: <Users size={14} />, ref: "UN DESA 2024" },
                { label: "Displaced Persons", value: fmtM(popDisplacedM), sub: "Internal IDPs", color: "text-yellow-400", icon: <AlertTriangle size={14} />, ref: "IOM DTM 2024" },
                { label: "Refugees", value: fmtM(popRefugeesM), sub: "Cross-border", color: "text-red-400", icon: <Globe size={14} />, ref: "UNHCR 2024" },
                { label: "At Risk", value: fmtM(popAtRiskM), sub: "Conflict zones", color: "text-orange-400", icon: <Shield size={14} />, ref: "OCHA 2024" },
              ].map(card => (
                <div key={card.label} className="intel-card p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={card.color}>{card.icon}</span>
                    <span className="text-[10px] text-muted-foreground font-medium">{card.label}</span>
                  </div>
                  <div className={`text-xl font-bold font-mono ${card.color}`}>{card.value}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</div>
                  <div className="text-[9px] text-muted-foreground/60 mt-1 font-mono">{card.ref}</div>
                </div>
              ))}
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="intel-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="text-[10px] font-bold text-primary tracking-wider">POPULATION BY COUNTRY (MILLIONS)</div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <div className="w-3 h-3 rounded-sm bg-cyan-500" /> Pop
                    <div className="w-3 h-3 rounded-sm bg-yellow-500" /> Disp
                    <div className="w-3 h-3 rounded-sm bg-red-500" /> Ref
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={sortedPopData.slice(0, 10)} margin={{ top: 0, right: 4, bottom: 30, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="country" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--primary)", borderRadius: "4px", fontSize: "11px" }} formatter={(val: number) => [`${val}M`, ""]} />
                    <Legend wrapperStyle={{ fontSize: 9 }} />
                    <Bar dataKey="population" name="Population" radius={[2, 2, 0, 0]} fill="#06b6d4" />
                    <Bar dataKey="displaced" name="Displaced" radius={[2, 2, 0, 0]} fill="#f59e0b" />
                    <Bar dataKey="refugees" name="Refugees" radius={[2, 2, 0, 0]} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="intel-card p-4">
                <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">HUMAN DEVELOPMENT INDEX (HDI)</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={[...sortedPopData].sort((a: any, b: any) => (b.hdi ?? 0) - (a.hdi ?? 0)).slice(0, 10)} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" domain={[0, 1]} tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
                    <YAxis type="category" dataKey="country" tick={{ fontSize: 8, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--primary)", borderRadius: "4px", fontSize: "11px" }} formatter={(val: number) => [val.toFixed(3), "HDI"]} />
                    <Bar dataKey="hdi" radius={[0, 2, 2, 0]}>
                      {[...sortedPopData].sort((a: any, b: any) => (b.hdi ?? 0) - (a.hdi ?? 0)).slice(0, 10).map((entry: any, i: number) => (
                        <Cell key={`hdi-${i}`} fill={entry.hdi >= 0.8 ? "#22c55e" : entry.hdi >= 0.7 ? "#06b6d4" : entry.hdi >= 0.6 ? "#f59e0b" : "#ef4444"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center gap-3 mt-2 text-[9px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />High ≥0.8</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" />Med ≥0.7</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />Low ≥0.6</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />Critical</span>
                </div>
              </div>
            </div>

            {/* Conflict Level + Humanitarian Impact */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              {["critical", "high", "medium"].map(level => {
                const countries = sortedPopData.filter((r: any) => r.conflictLevel === level);
                const totalDisp = countries.reduce((s: number, r: any) => s + toM(r.displaced ?? 0), 0);
                const conflictColor = CONFLICT_COLORS[level];
                return (
                  <div key={level} className="intel-card p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full" style={{ background: conflictColor }} />
                      <span className="text-[10px] font-bold tracking-wider capitalize" style={{ color: conflictColor }}>{level} CONFLICT</span>
                    </div>
                    <div className="text-xl font-bold font-mono mb-0.5" style={{ color: conflictColor }}>{countries.length}</div>
                    <div className="text-[10px] text-muted-foreground">countries</div>
                    <div className="text-[10px] font-mono text-yellow-400 mt-1">{fmtM(totalDisp)} displaced</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {countries.map((c: any) => (
                        <span key={c.country} className="text-[9px] px-1.5 py-0.5 rounded font-mono" style={{ background: `${conflictColor}15`, color: conflictColor }}>{c.country}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Population Table */}
            <div className="intel-card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                <span className="text-[10px] font-bold text-primary tracking-wider">COUNTRY BREAKDOWN</span>
                <div className="flex items-center gap-2">
                  <a
                    href="https://www.unhcr.org/refugee-statistics/"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <BookOpen size={9} /> UNHCR Source
                  </a>
                  <a
                    href="https://dtm.iom.int/"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] text-primary hover:underline"
                  >
                    <BookOpen size={9} /> IOM DTM
                  </a>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2 text-[10px] text-muted-foreground font-mono">COUNTRY</th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-primary" onClick={() => toggleSort("population")}>
                        POPULATION {popSort === "population" ? (popSortDir === "desc" ? "↓" : "↑") : ""}
                      </th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-primary" onClick={() => toggleSort("displaced")}>
                        DISPLACED {popSort === "displaced" ? (popSortDir === "desc" ? "↓" : "↑") : ""}
                      </th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-primary" onClick={() => toggleSort("refugees")}>
                        REFUGEES {popSort === "refugees" ? (popSortDir === "desc" ? "↓" : "↑") : ""}
                      </th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono">IMPACT %</th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono">HDI</th>
                      <th className="text-right px-4 py-2 text-[10px] text-muted-foreground font-mono">GDP/CAP</th>
                      <th className="text-left px-4 py-2 text-[10px] text-muted-foreground font-mono cursor-pointer hover:text-primary" onClick={() => toggleSort("conflictLevel")}>
                        CONFLICT {popSort === "conflictLevel" ? (popSortDir === "desc" ? "↓" : "↑") : ""}
                      </th>
                      <th className="text-left px-4 py-2 text-[10px] text-muted-foreground font-mono">SOURCES</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPopData.map((row: any) => {
                      const impactPct = ((toM(row.displaced) + toM(row.refugees)) / Math.max(0.001, toM(row.population)) * 100).toFixed(1);
                      const impact = parseFloat(impactPct);
                      const conflictColor = CONFLICT_COLORS[row.conflictLevel] ?? "#22c55e";
                      return (
                        <tr key={row.country} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <div className="font-semibold text-foreground">{row.country}</div>
                            <div className="text-[9px] text-muted-foreground font-mono">{row.code}</div>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-primary">{fmtM(toM(row.population))}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-yellow-400">{fmtM(toM(row.displaced))}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-red-400">{fmtM(toM(row.refugees))}</td>
                          <td className="px-4 py-2.5 text-right">
                            <span className={`font-mono font-bold text-[10px] px-1.5 py-0.5 rounded ${
                              impact > 20 ? "bg-red-500/20 text-red-400" :
                              impact > 10 ? "bg-yellow-500/20 text-yellow-400" :
                              impact > 5 ? "bg-orange-500/20 text-orange-400" : "bg-green-500/20 text-green-400"
                            }`}>{impactPct}%</span>
                          </td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px]" style={{ color: row.hdi >= 0.8 ? "#22c55e" : row.hdi >= 0.7 ? "#06b6d4" : row.hdi >= 0.6 ? "#f59e0b" : "#ef4444" }}>{row.hdi?.toFixed(3) ?? "—"}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-[10px] text-muted-foreground">${row.gdpPerCapita?.toLocaleString() ?? "—"}</td>
                          <td className="px-4 py-2.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold capitalize"
                              style={{ background: `${conflictColor}20`, color: conflictColor }}>
                              {row.conflictLevel}
                            </span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="flex flex-col gap-0.5">
                              {(row.sources ?? []).map((s: string) => (
                                <span key={s} className="text-[9px] text-muted-foreground/70 font-mono">{s}</span>
                              ))}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-border bg-muted/10 text-[9px] text-muted-foreground">
                Data from:{" "}
                <a href="https://www.unhcr.org/refugee-statistics/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">UNHCR Global Trends 2024</a>,{" "}
                <a href="https://dtm.iom.int/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">IOM DTM 2024</a>,{" "}
                <a href="https://data.worldbank.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">World Bank Open Data</a>,{" "}
                <a href="https://data.humdata.org/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">UN OCHA HDX</a>
              </div>
            </div>
          </div>
        )}

        {/* ── UN Verified Sources ── */}
        {activeSection === "sources" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">VERIFIED DATA SOURCES</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                UN agencies, international organizations, and verified OSINT sources. All data is publicly available and verified.
              </p>
            </div>

            {/* Category summary */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "UN Agencies", count: unSources?.filter(s => s.type === "UN Agency").length ?? 0, color: "#06b6d4" },
                { label: "Int'l Orgs", count: unSources?.filter(s => s.type === "International Organization").length ?? 0, color: "#8b5cf6" },
                { label: "Research", count: unSources?.filter(s => s.type === "Research Organization").length ?? 0, color: "#f59e0b" },
                { label: "API Available", count: unSources?.filter(s => s.apiAvailable).length ?? 0, color: "#22c55e" },
              ].map(c => (
                <div key={c.label} className="intel-card p-3 text-center">
                  <div className="text-lg font-bold font-mono" style={{ color: c.color }}>{c.count}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">{c.label}</div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 bg-card border border-border px-3 py-2 mb-4">
              <Search size={12} className="text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search sources by name or category..."
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>

            <div className="space-y-2">
              {(filteredSources ?? []).map(source => (
                <div key={source.id} className="intel-card p-4 hover:border-primary transition-all">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {source.verified
                        ? <CheckCircle size={14} className="text-green-400" />
                        : <Info size={14} className="text-muted-foreground" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-foreground">{source.name}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          source.type === "UN Agency" ? "bg-blue-500/20 text-blue-400" :
                          source.type === "International Organization" ? "bg-purple-500/20 text-purple-400" :
                          "bg-green-500/20 text-green-400"
                        }`}>{source.type}</span>
                        <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono">{source.category}</span>
                        {source.region !== "Global" && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">{source.region}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {(source.dataTypes ?? []).map(dt => (
                          <span key={dt} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary">{dt}</span>
                        ))}
                      </div>
                      <div className="flex items-center gap-4 flex-wrap text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1"><Clock size={9} /> {source.updateFreq}</span>
                        {source.apiAvailable && (
                          <span className="flex items-center gap-1 text-green-400"><Zap size={9} /> API Available</span>
                        )}
                        <a href={source.url} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-primary hover:underline">
                          <ExternalLink size={9} /> Visit Source
                        </a>
                        {source.apiUrl && (
                          <a href={source.apiUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-cyan-400 hover:underline">
                            <Zap size={9} /> API Docs
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── News Agencies ── */}
        {activeSection === "agencies" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">NEWS AGENCIES DATABASE</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {agencies?.length ?? 0} curated news organizations across the {region} region with RSS feeds, bias ratings, and metadata.
              </p>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: "TOTAL AGENCIES", value: agencies?.length ?? 0, color: "#06b6d4" },
                { label: "RSS ACTIVE", value: agencies?.filter(a => a.rssFeeds && a.rssFeeds.length > 0).length ?? 0, color: "#22c55e" },
                { label: "COUNTRIES", value: new Set(agencies?.map(a => a.country).filter(Boolean)).size, color: "#8b5cf6" },
                { label: "LANGUAGES", value: new Set(agencies?.map(a => a.language).filter(Boolean)).size, color: "#f59e0b" },
              ].map(s => (
                <div key={s.label} className="intel-card p-3">
                  <div className="text-[9px] font-bold tracking-wider mb-1" style={{ color: s.color }}>{s.label}</div>
                  <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            {/* Bias distribution + search row */}
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="col-span-2 flex items-center gap-2 bg-card border border-border px-3 py-2">
                <Search size={12} className="text-muted-foreground" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search by name, country, or language..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                {searchQuery && (
                  <button onClick={() => setSearchQuery("")} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>
                )}
              </div>
              <div className="intel-card p-3">
                <div className="text-[9px] font-bold text-primary mb-2 tracking-wider">BIAS DISTRIBUTION</div>
                <div className="flex gap-2">
                  {["left", "center", "right", "unknown"].map(b => {
                    const count = agencies?.filter(a => (a.bias ?? "unknown") === b).length ?? 0;
                    const color = b === "left" ? "#3b82f6" : b === "center" ? "#22c55e" : b === "right" ? "#ef4444" : "var(--muted-foreground)";
                    return (
                      <div key={b} className="flex-1 text-center">
                        <div className="text-sm font-bold font-mono" style={{ color }}>{count}</div>
                        <div className="text-[8px] text-muted-foreground capitalize">{b}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="intel-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">AGENCY</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">COUNTRY</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">TYPE</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">LANGUAGE</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">BIAS</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">RSS FEEDS</th>
                      <th className="text-left px-4 py-2.5 text-[10px] text-muted-foreground font-mono">LINK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(filteredAgencies ?? []).map(agency => (
                      <tr key={agency.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                        <td className="px-4 py-2.5">
                          <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{agency.name}</div>
                          {agency.description && (
                            <div className="text-[9px] text-muted-foreground/70 mt-0.5 line-clamp-1">{agency.description}</div>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-xs text-muted-foreground font-mono">{agency.country ?? "—"}</span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono capitalize">
                            {agency.type ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-muted-foreground font-mono text-[10px]">{agency.language ?? "—"}</td>
                        <td className="px-4 py-2.5">
                          {agency.bias ? (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                              agency.bias === "left" ? "bg-blue-500/20 text-blue-400" :
                              agency.bias === "right" ? "bg-red-500/20 text-red-400" :
                              agency.bias === "center" ? "bg-green-500/20 text-green-400" :
                              "bg-muted text-muted-foreground"
                            }`}>{agency.bias}</span>
                          ) : <span className="text-[9px] text-muted-foreground">—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {agency.rssFeeds && agency.rssFeeds.length > 0 ? (
                            <span className="flex items-center gap-1 text-[9px] text-green-400 font-mono">
                              <CheckCircle size={9} /> {agency.rssFeeds.length} feed{agency.rssFeeds.length > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="text-[9px] text-muted-foreground font-mono">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5">
                          {agency.website ? (
                            <a href={agency.website} target="_blank" rel="noopener noreferrer"
                              className="flex items-center gap-1 text-[9px] text-primary hover:underline">
                              <ExternalLink size={8} /> Visit
                            </a>
                          ) : <span className="text-[9px] text-muted-foreground">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-2 border-t border-border bg-muted/10 text-[9px] text-muted-foreground">
                Showing {filteredAgencies?.length ?? 0} of {agencies?.length ?? 0} agencies
                {searchQuery && <span className="ml-2 text-primary">· filtered by "{searchQuery}"</span>}
              </div>
            </div>
          </div>
        )}

        {/* ── Facilities ── */}
        {activeSection === "facilities" && (
          <div className="p-6">
            <div className="mb-5">
              <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">FACILITIES DATABASE</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {facilityStats?.total ?? 0} strategic facilities across the {region} region. Data sourced from OpenStreetMap, IAEA, public government records, and OSINT.
              </p>
            </div>

            {/* KPI row */}
            {facilityStats && (
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: "TOTAL FACILITIES", value: facilityStats.total, color: "#06b6d4" },
                  { label: "CRITICAL THREAT", value: (facilityStats.byThreat as Record<string,number>)["critical"] ?? 0, color: "#ef4444" },
                  { label: "HIGH THREAT", value: (facilityStats.byThreat as Record<string,number>)["high"] ?? 0, color: "#f59e0b" },
                  { label: "COUNTRIES", value: Object.keys(facilityStats.byCountry as Record<string,number>).length, color: "#8b5cf6" },
                ].map(k => (
                  <div key={k.label} className="intel-card p-3">
                    <div className="text-[9px] font-bold tracking-wider mb-1" style={{ color: k.color }}>{k.label}</div>
                    <div className="text-2xl font-bold font-mono" style={{ color: k.color }}>{k.value}</div>
                  </div>
                ))}
              </div>
            )}

            {facilityStats && (
              <div className="grid grid-cols-2 gap-4 mb-5">
                {/* By Type */}
                <div className="intel-card p-4">
                  <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">BY FACILITY TYPE</div>
                  <div className="space-y-2">
                    {Object.entries(facilityStats.byType as Record<string, number>)
                      .sort(([, a], [, b]) => b - a)
                      .map(([type, count], i) => (
                      <div key={type} className="flex items-center gap-2">
                        <span style={{ color: COLORS[i % COLORS.length] }}>{FACILITY_ICONS[type] ?? <MapPin size={11} />}</span>
                        <span className="text-xs text-foreground flex-1 capitalize">{type.replace(/_/g, " ")}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full rounded-full"
                              style={{ width: `${(count / facilityStats.total) * 100}%`, background: COLORS[i % COLORS.length] }} />
                          </div>
                          <span className="text-[10px] font-bold font-mono w-8 text-right" style={{ color: COLORS[i % COLORS.length] }}>{count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Threat heatmap */}
                <div className="intel-card p-4">
                  <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">THREAT HEATMAP BY COUNTRY</div>
                  <div className="space-y-1.5">
                    {Object.entries(facilityStats.byCountry as Record<string, number>)
                      .sort(([, a], [, b]) => b - a).slice(0, 10)
                      .map(([country, count]) => {
                        const pct = (count / facilityStats.total) * 100;
                        const threatColor = pct > 15 ? "#ef4444" : pct > 10 ? "#f59e0b" : pct > 5 ? "#f97316" : "#06b6d4";
                        return (
                          <div key={country} className="flex items-center gap-2">
                            <div className="w-20 text-[10px] font-mono text-foreground flex-shrink-0">{country}</div>
                            <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden relative">
                              <div className="h-full rounded transition-all"
                                style={{ width: `${pct}%`, background: `linear-gradient(90deg, ${threatColor}40, ${threatColor}99)`, borderRight: `2px solid ${threatColor}` }} />
                              <span className="absolute inset-0 flex items-center px-2 text-[9px] font-mono text-foreground/70">{count} facilities</span>
                            </div>
                            <div className="w-10 text-right text-[9px] font-bold font-mono" style={{ color: threatColor }}>{pct.toFixed(0)}%</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>
            )}

            {/* Country bar chart */}
            <div className="intel-card p-4">
              <div className="text-[10px] font-bold text-primary mb-3 tracking-wider">FACILITY DISTRIBUTION BY COUNTRY</div>
              {facilityStats?.byCountry && (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={Object.entries(facilityStats.byCountry as Record<string, number>)
                      .sort(([, a], [, b]) => b - a).slice(0, 12)
                      .map(([country, count]) => ({ country, count }))}
                    margin={{ top: 0, right: 0, bottom: 30, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="country" tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} angle={-35} textAnchor="end" />
                    <YAxis tick={{ fontSize: 9, fill: "var(--muted-foreground)" }} />
                    <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--primary)", borderRadius: "4px", fontSize: "11px" }}
                      formatter={(val: number) => [val, "Facilities"]} />
                    <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                      {Object.entries(facilityStats.byCountry as Record<string, number>)
                        .sort(([, a], [, b]) => b - a).slice(0, 12)
                        .map(([, count], i) => {
                          const pct = (count / facilityStats.total) * 100;
                          return <Cell key={`fc-${i}`} fill={pct > 15 ? "#ef4444" : pct > 10 ? "#f59e0b" : pct > 5 ? "#f97316" : "#06b6d4"} />;
                        })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              <div className="flex items-center gap-4 mt-2 text-[9px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&gt;15% share</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />&gt;10%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />&gt;5%</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500" />≤5%</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Network Flow (Chord Diagram) ── */}
        {activeSection === "network" && (
          <NetworkFlowSection region={region} articleStats={articleStats} topicDist={topicDist} />
        )}
        {/* ── Analytics ── */}
        {activeSection === "analytics" && (
          <AnalyticsSection region={region} articleStats={articleStats} topicDist={topicDist} />
        )}

        {/* ── Google News ── */}
        {activeSection === "google" && (() => {
          const [gnCategory, setGnCategory] = [searchQuery, setSearchQuery];
          const sentimentBadge = (s: number | undefined) => {
            if (s === undefined || s === null) return null;
            const label = s < -0.2 ? "NEGATIVE" : s > 0.2 ? "POSITIVE" : "NEUTRAL";
            const color = s < -0.2 ? "#ef4444" : s > 0.2 ? "#22c55e" : "#94a3b8";
            return <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{label}</span>;
          };
          const importanceBadge = (imp: string | undefined) => {
            if (!imp) return null;
            const color = imp === "breaking" ? "#ef4444" : imp === "high" ? "#f59e0b" : "var(--muted-foreground)";
            return <span className="text-[8px] font-bold px-1.5 py-0.5 rounded" style={{ background: `${color}20`, color }}>{imp.toUpperCase()}</span>;
          };
          return (
            <div className="p-6">
              <div className="mb-5">
                <h2 className="text-sm font-bold text-primary mb-1 tracking-wider">GOOGLE NEWS INTELLIGENCE</h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Real-time Google News links and crawled articles for the {region} region. Filter by topic, search custom queries, and read directly.
                </p>
              </div>

              {/* Search + stats row */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                <div className="col-span-3 flex items-center gap-2 bg-card border border-border px-3 py-2">
                  <Search size={12} className="text-muted-foreground flex-shrink-0" />
                  <input
                    type="text"
                    value={gnCategory}
                    onChange={e => setGnCategory(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && gnCategory.trim()) {
                        window.open(googleNewsUrl(gnCategory, region), "_blank");
                      }
                    }}
                    placeholder={`Search Google News for ${region}... (Enter to open)`}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                  />
                  {gnCategory && <button onClick={() => setGnCategory("")} className="text-[10px] text-muted-foreground hover:text-foreground">✕</button>}
                  <a
                    href={gnCategory ? googleNewsUrl(gnCategory, region) : googleNewsUrl("MENA geopolitics", region)}
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-[10px] font-bold hover:bg-primary/80 transition-all flex-shrink-0"
                  >
                    <Globe size={11} /> SEARCH
                  </a>
                </div>
                <div className="intel-card p-3">
                  <div className="text-[9px] font-bold text-primary mb-1 tracking-wider">CRAWLED</div>
                  <div className="text-xl font-bold font-mono text-primary">{googleNews?.length ?? 0}</div>
                  <div className="text-[9px] text-muted-foreground">articles in DB</div>
                </div>
              </div>

              {/* Category quick-links grid — from DB */}
              <div className="grid grid-cols-4 gap-2 mb-5">
                {(dbGoogleNewsTopics ?? GOOGLE_NEWS_TOPICS).map(t => (
                  <a
                    key={t.label}
                    href={googleNewsUrl(t.query, region)}
                    target="_blank" rel="noopener noreferrer"
                    className="intel-card p-3 flex flex-col gap-1 hover:border-primary transition-all group cursor-pointer"
                  >
                    <div className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{t.label}</div>
                    <div className="text-[9px] text-muted-foreground">{region} · Google News</div>
                    <div className="flex items-center gap-1 mt-1">
                      <ExternalLink size={9} className="text-primary" />
                      <span className="text-[9px] text-primary">Open</span>
                    </div>
                  </a>
                ))}
              </div>

              {/* Crawled articles */}
              {googleNews && googleNews.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-[10px] font-bold text-primary tracking-wider">CRAWLED ARTICLES — {googleNews.length} TOTAL</div>
                    <div className="text-[9px] text-muted-foreground">Sorted by recency</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {(googleNews as any[]).map((item: any, i: number) => (
                      <div key={i} className="intel-card p-4 hover:border-primary transition-all group flex flex-col gap-2">
                        {/* Header */}
                        <div className="flex items-start gap-2">
                          <div className="w-7 h-7 rounded bg-primary/10 flex items-center justify-center flex-shrink-0">
                            <Globe size={12} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors leading-snug line-clamp-2">{item.title}</div>
                          </div>
                        </div>
                        {/* Summary */}
                        {item.summary && (
                          <div className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2">{item.summary}</div>
                        )}
                        {/* Badges + meta */}
                        <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                          {sentimentBadge(item.sentiment)}
                          {importanceBadge(item.importance)}
                          {item.topic && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-bold">{item.topic}</span>
                          )}
                        </div>
                        {/* Footer */}
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground border-t border-border/50 pt-2">
                          {item.source && <span className="font-bold text-foreground/70">{item.source}</span>}
                          {item.publishedAt && (
                            <span className="flex items-center gap-0.5">
                              <Clock size={8} />{new Date(item.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                          <a href={item.url} target="_blank" rel="noopener noreferrer"
                            className="ml-auto flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink size={8} /> Read
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="intel-card p-8 text-center">
                  <Globe size={32} className="text-muted-foreground mx-auto mb-3 opacity-20" />
                  <div className="text-sm font-semibold text-foreground mb-1">No crawled articles yet</div>
                  <div className="text-xs text-muted-foreground mb-4">
                    Use the topic cards above to open Google News directly with accurate, real-time results.
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(dbGoogleNewsTopics ?? GOOGLE_NEWS_TOPICS).slice(0, 4).map(t => (
                      <a key={t.label} href={googleNewsUrl(t.query, region)} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-primary hover:underline flex items-center gap-1 justify-center">
                        <ExternalLink size={9} /> {t.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
