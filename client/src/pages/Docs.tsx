import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Book, Code, Database, Shield, Server, Layers, Satellite,
  Globe, Search, ChevronRight, ChevronDown, ExternalLink,
  FileText, GitBranch, CheckCircle2, Copy,
  AlertTriangle, Info, Cpu, Network, Radio, Eye, Target,
  BarChart3, Boxes, Plug, Fingerprint,
  Rocket, Users, Heart, Menu, X,
  Lock, Key, Activity, Wifi,
  AlertCircle, Settings, List,
  ArrowUpRight, Sparkles, Sun, Moon, Zap,
  MessageSquare, Send, Bot, Crown
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────────────────
interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  category: string;
  badge?: string;
}

// ─── Reading Progress Bar ───────────────────────────────────────────
function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const onScroll = () => {
      const el = document.getElementById("docs-main-content");
      if (!el) return;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      setProgress(scrollHeight > 0 ? (scrollTop / scrollHeight) * 100 : 0);
    };
    const el = document.getElementById("docs-main-content");
    el?.addEventListener("scroll", onScroll);
    return () => el?.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div className="fixed top-0 left-0 right-0 h-0.5 z-50 bg-gray-900">
      <div
        className="h-full bg-gradient-to-r from-red-500 via-red-400 to-cyan-400 transition-all duration-150"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ─── Code Block ─────────────────────────────────────────────────────
function CodeBlock({ code, language = "typescript", title, isLight = false }: { code: string; language?: string; title?: string; isLight?: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  const langColor: Record<string, string> = {
    bash: "text-green-600", typescript: "text-blue-500", yaml: "text-amber-500",
    text: "text-gray-500", json: "text-cyan-600", sql: "text-purple-500",
  };
  const langColorDark: Record<string, string> = {
    bash: "text-green-400", typescript: "text-blue-400", yaml: "text-amber-400",
    text: "text-gray-400", json: "text-cyan-400", sql: "text-purple-400",
  };
  const lc = isLight ? (langColor[language] || "text-gray-500") : (langColorDark[language] || "text-gray-600");
  const headerBg = isLight ? "bg-gray-100 border-gray-200" : "bg-[#0c0e14] border-gray-800/40";
  const headerText = isLight ? "text-gray-500" : "text-gray-400";
  const bodyBg = isLight ? "bg-gray-50" : "bg-[#080a0f]";
  const bodyBorder = isLight ? "border-gray-200" : "border-gray-800/60";
  const preText = isLight ? "text-gray-800" : "text-gray-300";
  const copyBtn = isLight ? "bg-gray-200 hover:bg-gray-300" : "bg-gray-800/50 hover:bg-gray-700/60";
  const copyIcon = isLight ? "text-gray-500" : "text-gray-400";
  return (
    <div className={`rounded-lg border ${bodyBorder} overflow-hidden my-4 group`}>
      {title && (
        <div className={`${headerBg} px-4 py-2 border-b flex items-center justify-between`}>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/60"/>
              <div className="w-2.5 h-2.5 rounded-full bg-amber-500/60"/>
              <div className="w-2.5 h-2.5 rounded-full bg-green-500/60"/>
            </div>
            <span className={`text-[10px] font-mono ${headerText}`}>{title}</span>
          </div>
          <span className={`text-[10px] font-mono ${lc}`}>{language}</span>
        </div>
      )}
      <div className={`relative ${bodyBg} p-4 overflow-x-auto`}>
        <button
          onClick={handleCopy}
          className={`absolute top-3 right-3 p-1.5 rounded ${copyBtn} transition-colors opacity-0 group-hover:opacity-100`}
        >
          {copied ? <CheckCircle2 size={12} className="text-green-500" /> : <Copy size={12} className={copyIcon} />}
        </button>
        <pre className={`text-xs font-mono ${preText} leading-relaxed whitespace-pre-wrap pr-8`}>{code}</pre>
      </div>
    </div>
  );
}

// ─── Info Box ────────────────────────────────────────────────────────
function InfoBox({ type = "info", title, children, isLight = false }: { type?: "info" | "warning" | "success" | "danger"; title?: string; children: React.ReactNode; isLight?: boolean }) {
  const stylesDark = {
    info:    { border: "border-cyan-500/30",  bg: "bg-cyan-500/5",  icon: Info,          color: "text-cyan-400"  },
    warning: { border: "border-amber-500/30", bg: "bg-amber-500/5", icon: AlertTriangle,  color: "text-amber-400" },
    success: { border: "border-green-500/30", bg: "bg-green-500/5", icon: CheckCircle2,   color: "text-green-400" },
    danger:  { border: "border-red-500/30",   bg: "bg-red-500/5",   icon: AlertCircle,    color: "text-red-400"   },
  };
  const stylesLight = {
    info:    { border: "border-cyan-400/50",  bg: "bg-cyan-50",   icon: Info,          color: "text-cyan-700"  },
    warning: { border: "border-amber-400/50", bg: "bg-amber-50",  icon: AlertTriangle,  color: "text-amber-700" },
    success: { border: "border-green-400/50", bg: "bg-green-50",  icon: CheckCircle2,   color: "text-green-700" },
    danger:  { border: "border-red-400/50",   bg: "bg-red-50",    icon: AlertCircle,    color: "text-red-700"   },
  };
  const s = isLight ? stylesLight[type] : stylesDark[type];
  const Icon = s.icon;
  const bodyText = isLight ? "text-gray-700" : "text-gray-300";
  return (
    <div className={`rounded-lg border ${s.border} ${s.bg} p-4 my-4`}>
      <div className="flex items-start gap-3">
        <Icon size={16} className={`${s.color} shrink-0 mt-0.5`} />
        <div>
          {title && <div className={`text-sm font-semibold ${s.color} mb-1`}>{title}</div>}
          <div className={`text-sm ${bodyText} leading-relaxed`}>{children}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Method Badge ────────────────────────────────────────────────────
function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET:    "bg-green-500/10 text-green-400 border-green-500/30",
    POST:   "bg-blue-500/10 text-blue-400 border-blue-500/30",
    PUT:    "bg-amber-500/10 text-amber-400 border-amber-500/30",
    DELETE: "bg-red-500/10 text-red-400 border-red-500/30",
    PATCH:  "bg-purple-500/10 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${colors[method] || colors.GET}`}>
      {method}
    </span>
  );
}

// ─── Expandable API Endpoint ─────────────────────────────────────────
function APIEndpointCard({ method, path, description, params, response, auth, isLight = false }: {
  method: string; path: string; description: string;
  params?: { name: string; type: string; required: boolean; desc: string }[];
  response?: string; auth?: boolean; isLight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const outerBorder = isLight
    ? (open ? "border-gray-400/60" : "border-gray-200 hover:border-gray-300")
    : (open ? "border-gray-600/60" : "border-gray-800/40 hover:border-gray-700/60");
  const hdrBg = isLight ? "bg-gray-100 hover:bg-gray-200" : "bg-[#0c0e14] hover:bg-[#0e1018]";
  const pathText = isLight ? "text-gray-800" : "text-white";
  const bodyBg = isLight ? "bg-white border-gray-200" : "bg-[#080a0f] border-gray-800/30";
  const bodyText = isLight ? "text-gray-700" : "text-gray-300";
  const labelText = isLight ? "text-gray-400" : "text-gray-500";
  const tblBorder = isLight ? "border-gray-200" : "border-gray-800/40";
  const tblHdr = isLight ? "bg-gray-50" : "bg-[#0a0c12]";
  const tblHdrText = isLight ? "text-gray-500" : "text-gray-600";
  const tblRow = isLight ? "border-gray-100" : "border-gray-800/20";
  const respBg = isLight ? "bg-gray-50 border-gray-200" : "bg-[#0a0c12] border-gray-800/30";
  const respCode = isLight ? "text-green-700" : "text-green-400";
  const paramName = isLight ? "text-cyan-700" : "text-cyan-400";
  const paramType = isLight ? "text-amber-700" : "text-amber-400";
  const paramDesc = isLight ? "text-gray-600" : "text-gray-400";
  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${outerBorder}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full ${hdrBg} px-4 py-3 flex items-center gap-3 text-left transition-colors`}
      >
        <MethodBadge method={method} />
        <code className={`text-xs font-mono ${pathText} flex-1`}>{path}</code>
        {auth && <Lock size={11} className="text-amber-500" aria-label="Requires authentication" />}
        <ChevronDown size={14} className={`${isLight ? "text-gray-400" : "text-gray-500"} transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={`p-4 ${bodyBg} border-t space-y-4`}>
          <p className={`text-sm ${bodyText}`}>{description}</p>
          {params && params.length > 0 && (
            <div>
              <div className={`text-[10px] font-mono ${labelText} uppercase tracking-wider mb-2`}>Parameters</div>
              <div className={`rounded-lg border ${tblBorder} overflow-hidden`}>
                <table className="w-full text-xs">
                  <thead><tr className={tblHdr}>
                    <th className={`text-left py-2 px-3 ${tblHdrText} font-normal`}>Name</th>
                    <th className={`text-left py-2 px-3 ${tblHdrText} font-normal`}>Type</th>
                    <th className={`text-left py-2 px-3 ${tblHdrText} font-normal`}>Req</th>
                    <th className={`text-left py-2 px-3 ${tblHdrText} font-normal`}>Description</th>
                  </tr></thead>
                  <tbody>
                    {params.map((p, i) => (
                      <tr key={i} className={`border-t ${tblRow}`}>
                        <td className={`py-2 px-3 ${paramName} font-mono`}>{p.name}</td>
                        <td className={`py-2 px-3 ${paramType} font-mono`}>{p.type}</td>
                        <td className="py-2 px-3">{p.required ? <span className="text-red-500 text-[9px] font-bold">YES</span> : <span className={`${isLight ? "text-gray-400" : "text-gray-600"} text-[9px]`}>no</span>}</td>
                        <td className={`py-2 px-3 ${paramDesc}`}>{p.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          {response && (
            <div>
              <div className={`text-[10px] font-mono ${labelText} uppercase tracking-wider mb-2`}>Response Schema</div>
              <div className={`${respBg} rounded-lg border p-3`}>
                <code className={`text-xs font-mono ${respCode} whitespace-pre-wrap`}>{response}</code>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Interactive Data Model Card ─────────────────────────────────────
function DataModelCard({ name, description, fields, isLight = false }: {
  name: string; description: string;
  fields: { name: string; type: string; desc: string; required?: boolean }[];
  isLight?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const outerBorder = isLight
    ? (open ? "border-purple-400/40" : "border-gray-200 hover:border-gray-300")
    : (open ? "border-purple-500/30" : "border-gray-800/40 hover:border-gray-700/60");
  const hdrBg = isLight ? "bg-gray-100 hover:bg-gray-200" : "bg-[#0c0e14] hover:bg-[#0e1018]";
  const nameText = isLight ? "text-gray-900" : "text-white";
  const countText = isLight ? "text-gray-400" : "text-gray-500";
  const descText = isLight ? "text-gray-400" : "text-gray-600";
  const tblBorder = isLight ? "border-gray-200" : "border-gray-800/30";
  const tblHdr = isLight ? "bg-gray-50" : "bg-[#080a0f]";
  const tblHdrText = isLight ? "text-gray-500" : "text-gray-600";
  const tblRow = isLight ? "border-gray-100" : "border-gray-800/20";
  const hoverRow = isLight ? "bg-purple-50" : "bg-purple-500/5";
  const fieldName = isLight ? "text-cyan-700" : "text-cyan-400";
  const fieldType = isLight ? "text-amber-700" : "text-amber-400";
  const fieldDesc = isLight ? "text-gray-600" : "text-gray-400";
  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${outerBorder}`}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-full ${hdrBg} px-5 py-3 flex items-center gap-3 text-left transition-colors`}
      >
        <Database size={14} className="text-purple-500" />
        <span className={`text-sm font-bold font-mono ${nameText} flex-1`}>{name}</span>
        <span className={`text-xs ${countText} mr-2`}>{fields.length} fields</span>
        <span className={`text-[10px] ${descText} mr-2 hidden md:block`}>{description}</span>
        <ChevronDown size={14} className={`${isLight ? "text-gray-400" : "text-gray-500"} transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className={`border-t ${tblBorder} overflow-x-auto`}>
          <table className="w-full text-xs">
            <thead><tr className={tblHdr}>
              <th className={`text-left py-2 px-4 ${tblHdrText} font-normal`}>Field</th>
              <th className={`text-left py-2 px-4 ${tblHdrText} font-normal`}>Type</th>
              <th className={`text-left py-2 px-4 ${tblHdrText} font-normal`}>Req</th>
              <th className={`text-left py-2 px-4 ${tblHdrText} font-normal`}>Description</th>
            </tr></thead>
            <tbody>
              {fields.map((f, i) => (
                <tr
                  key={i}
                  className={`border-t ${tblRow} transition-colors cursor-default ${hoveredField === f.name ? hoverRow : ""}`}
                  onMouseEnter={() => setHoveredField(f.name)}
                  onMouseLeave={() => setHoveredField(null)}
                >
                  <td className={`py-2 px-4 ${fieldName} font-mono`}>{f.name}</td>
                  <td className={`py-2 px-4 ${fieldType} font-mono`}>{f.type}</td>
                  <td className="py-2 px-4">{f.required ? <span className="text-red-500 text-[9px] font-bold">YES</span> : <span className={`${isLight ? "text-gray-400" : "text-gray-700"} text-[9px]`}>—</span>}</td>
                  <td className={`py-2 px-4 ${fieldDesc}`}>{f.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Feature Tabs ────────────────────────────────────────────────────
function FeatureTabs({ tabs, isLight = false }: { tabs: { label: string; icon?: React.ElementType; content: React.ReactNode }[]; isLight?: boolean }) {
  const [active, setActive] = useState(0);
  const tabBorder = isLight ? "border-gray-200" : "border-gray-800/40";
  const tabBar = isLight ? "bg-gray-100" : "bg-[#0c0e14]";
  const tabBody = isLight ? "bg-white" : "bg-[#080a0f]";
  const activeTab = isLight ? "border-red-500 text-red-700 bg-red-50" : "border-red-500 text-white bg-red-500/5";
  const inactiveTab = isLight ? "border-transparent text-gray-500 hover:text-gray-700" : "border-transparent text-gray-500 hover:text-gray-300";
  return (
    <div className={`rounded-xl border ${tabBorder} overflow-hidden my-6`}>
      <div className={`flex ${tabBar} border-b ${tabBorder} overflow-x-auto`}>
        {tabs.map((tab, i) => {
          const Icon = tab.icon;
          return (
            <button
              key={i}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 px-4 py-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 ${
                active === i ? activeTab : inactiveTab
              }`}
            >
              {Icon && <Icon size={13} />}
              {tab.label}
            </button>
          );
        })}
      </div>
      <div className={`p-5 ${tabBody}`}>{tabs[active].content}</div>
    </div>
  );
}

// ─── Stat Card ───────────────────────────────────────────────────────
function StatCard({ value, label, color = "red", isLight = false }: { value: string; label: string; color?: string; isLight?: boolean }) {
  const colorsDark: Record<string, string> = {
    red: "text-red-400", cyan: "text-cyan-400", green: "text-green-400",
    amber: "text-amber-400", purple: "text-purple-400",
  };
  const colorsLight: Record<string, string> = {
    red: "text-red-600", cyan: "text-cyan-600", green: "text-green-600",
    amber: "text-amber-600", purple: "text-purple-600",
  };
  const c = isLight ? (colorsLight[color] || colorsLight.red) : (colorsDark[color] || colorsDark.red);
  const bg = isLight ? "bg-gray-50 border-gray-200" : "bg-[#0a0c12] border-gray-800/40";
  const lbl = "text-gray-500";
  return (
    <div className={`p-4 rounded-lg border ${bg} text-center`}>
      <div className={`text-2xl font-black ${c}`}>{value}</div>
      <div className={`text-[10px] font-mono ${lbl} uppercase tracking-wider mt-1`}>{label}</div>
    </div>
  );
}

// ─── Section Navigation Data ─────────────────────────────────────────
const sections: DocSection[] = [
  { id: "getting-started", title: "Getting Started",       icon: Rocket,    category: "Overview"   },
  { id: "architecture",    title: "Architecture",          icon: Network,   category: "Overview"   },
  { id: "values",          title: "Values & Mission",      icon: Heart,     category: "Overview"   },
  { id: "platforms",       title: "Platform Modules",      icon: Layers,    category: "Platforms"  },
  { id: "main-intel",      title: "Main Intelligence",     icon: Globe,     category: "Platforms"  },
  { id: "orbit",           title: "ORBIT Module",          icon: Satellite, category: "Platforms", badge: "Space" },
  { id: "sigint",          title: "SIGINT Module",         icon: Radio,     category: "Platforms", badge: "OSINT" },
  { id: "surveillance",    title: "Surveillance Mode",     icon: Eye,       category: "Platforms"  },
  { id: "narratives",      title: "Narratives & FIMI",     icon: Network,   category: "Platforms"  },
  { id: "data-models",     title: "Data Models",           icon: Database,  category: "Technical"  },
  { id: "api-reference",   title: "API Reference",         icon: Code,      category: "Technical"  },
  { id: "authentication",  title: "Auth & Security",       icon: Shield,    category: "Technical"  },
  { id: "enrichment",      title: "AI Enrichment",         icon: Sparkles,  category: "Technical"  },
  { id: "configuration",   title: "Configuration",         icon: Boxes,     category: "Guides"     },
  { id: "deployment",      title: "Deployment",            icon: Server,    category: "Guides"     },
  { id: "contributing",    title: "Contributing",          icon: Users,     category: "Guides"     },
  { id: "changelog",       title: "Changelog",             icon: GitBranch, category: "Reference"  },
  { id: "roadmap",         title: "Roadmap",               icon: BarChart3, category: "Reference"  },
  { id: "threat-intel",   title: "Threat Intelligence",   icon: Target,    category: "Technical", badge: "New" },
  { id: "webhooks",       title: "Webhooks & Integrations", icon: Plug,    category: "Technical", badge: "New" },
  { id: "rate-limits",    title: "Rate Limits & Quotas",  icon: Activity,  category: "Technical"  },
  { id: "error-codes",    title: "Error Codes",           icon: AlertCircle, category: "Technical" },
  { id: "sdk",            title: "SDK & Libraries",       icon: Code,      category: "Guides", badge: "New" },
  { id: "performance",    title: "Performance & Scaling", icon: BarChart3, category: "Guides"     },
  { id: "compliance",     title: "Compliance & Certs",    icon: Shield,    category: "Guides", badge: "New" },
  { id: "glossary",       title: "Glossary",              icon: List,      category: "Reference"  },
];

const categories = ["Overview", "Platforms", "Technical", "Guides", "Reference"];

// ─── API Endpoints ───────────────────────────────────────────────────
const apiEndpoints = [
  {
    method: "GET", path: "/api/trpc/news.feed", auth: false,
    description: "Fetch the main intelligence feed with region, category, and sentiment filters. Returns paginated articles enriched with entity data, credibility scores, and impact ratings.",
    params: [
      { name: "region",    type: "string",  required: false, desc: "ISO country code or region identifier (e.g. 'MENA', 'EU', 'US')" },
      { name: "category",  type: "string",  required: false, desc: "Topic: politics | security | economy | tech | energy | society | military | cyber" },
      { name: "sentiment", type: "string",  required: false, desc: "Sentiment filter: positive | negative | neutral" },
      { name: "limit",     type: "number",  required: false, desc: "Items per page (default: 50, max: 200)" },
      { name: "cursor",    type: "string",  required: false, desc: "Pagination cursor from previous response" },
      { name: "since",     type: "number",  required: false, desc: "Unix timestamp (ms) — only return articles after this time" },
    ],
    response: `{\n  items: Article[],\n  nextCursor: string | null,\n  total: number,\n  meta: { region: string, category: string, generatedAt: number }\n}`,
  },
  {
    method: "GET", path: "/api/trpc/news.article", auth: false,
    description: "Get a single article with full enrichment data, entity graph, credibility breakdown, and related articles.",
    params: [
      { name: "id",          type: "string",  required: true,  desc: "Article unique identifier (UUID)" },
      { name: "withRelated", type: "boolean", required: false, desc: "Include related articles (default: false)" },
    ],
    response: `{\n  article: Article,\n  enrichment: Enrichment,\n  entities: Entity[],\n  connections: Connection[],\n  related: Article[]\n}`,
  },
  {
    method: "GET", path: "/api/trpc/news.search", auth: false,
    description: "Full-text search across all articles with entity and keyword matching.",
    params: [
      { name: "query",  type: "string",   required: true,  desc: "Search query string" },
      { name: "fields", type: "string[]", required: false, desc: "Fields to search: title | content | entities | keywords" },
      { name: "limit",  type: "number",   required: false, desc: "Max results (default: 20)" },
    ],
    response: `{ results: Article[], highlights: Record<string, string[]>, total: number }`,
  },
  {
    method: "GET", path: "/api/trpc/orbit.satellites", auth: false,
    description: "List tracked satellites with current TLE-propagated positions, velocity, and orbital parameters.",
    params: [
      { name: "type",     type: "string", required: false, desc: "Type: military | communication | weather | navigation | reconnaissance | debris" },
      { name: "country",  type: "string", required: false, desc: "Operating country (ISO code)" },
      { name: "altitude", type: "object", required: false, desc: "Altitude range: { min: number, max: number } in km" },
    ],
    response: `{ satellites: Satellite[], totalCount: number, timestamp: number }`,
  },
  {
    method: "GET", path: "/api/trpc/orbit.passes", auth: false,
    description: "Predict satellite passes over a ground location with AOS/LOS times, max elevation, and visibility.",
    params: [
      { name: "satId",        type: "string", required: true,  desc: "NORAD catalog number" },
      { name: "lat",          type: "number", required: true,  desc: "Observer latitude (-90 to 90)" },
      { name: "lng",          type: "number", required: true,  desc: "Observer longitude (-180 to 180)" },
      { name: "days",         type: "number", required: false, desc: "Prediction window in days (default: 7, max: 30)" },
      { name: "minElevation", type: "number", required: false, desc: "Minimum elevation in degrees (default: 10)" },
    ],
    response: `{ passes: Pass[], observer: { lat, lng, alt } }`,
  },
  {
    method: "GET", path: "/api/trpc/sigint.cameras", auth: false,
    description: "List available CCTV/OSINT camera feeds with location, type, and live stream status.",
    params: [
      { name: "country", type: "string", required: false, desc: "Country filter (ISO code)" },
      { name: "type",    type: "string", required: false, desc: "Source: tfl | asfinag | youtube | windy | custom" },
      { name: "bounds",  type: "object", required: false, desc: "Geographic bounding box { north, south, east, west }" },
    ],
    response: `{ cameras: Camera[], count: number }`,
  },
  {
    method: "GET", path: "/api/trpc/sigint.flights", auth: false,
    description: "Real-time ADS-B flight data with position, altitude, speed, heading, and aircraft type.",
    params: [
      { name: "bounds",      type: "object",  required: false, desc: "Geographic bounding box" },
      { name: "military",    type: "boolean", required: false, desc: "Military aircraft only" },
      { name: "minAltitude", type: "number",  required: false, desc: "Minimum altitude in feet" },
    ],
    response: `{ flights: Flight[], timestamp: number, count: number }`,
  },
  {
    method: "GET", path: "/api/trpc/sigint.vessels", auth: false,
    description: "AIS maritime vessel data with position, course, speed, vessel type, and flag state.",
    params: [
      { name: "bounds", type: "object", required: false, desc: "Geographic bounding box" },
      { name: "type",   type: "string", required: false, desc: "Vessel type: cargo | tanker | military | fishing | passenger" },
      { name: "flag",   type: "string", required: false, desc: "Flag state (ISO country code)" },
    ],
    response: `{ vessels: Vessel[], timestamp: number }`,
  },
  {
    method: "GET", path: "/api/trpc/narratives.list", auth: true,
    description: "List tracked narratives and information operations with metadata, spread metrics, and actor analysis.",
    params: [
      { name: "type",   type: "string", required: false, desc: "Type: fimi | propaganda | organic | breaking | disinformation | coordinated" },
      { name: "status", type: "string", required: false, desc: "Status: active | resolved | monitoring | escalated" },
      { name: "region", type: "string", required: false, desc: "Target region filter" },
    ],
    response: `{ narratives: Narrative[], total: number }`,
  },
  {
    method: "POST", path: "/api/trpc/facilities.create", auth: true,
    description: "Add a custom facility to the tracking database with full metadata.",
    params: [
      { name: "name",     type: "string", required: true,  desc: "Facility name" },
      { name: "lat",      type: "number", required: true,  desc: "Latitude" },
      { name: "lng",      type: "number", required: true,  desc: "Longitude" },
      { name: "type",     type: "string", required: true,  desc: "Type: nuclear | military | satellite | port | airbase | embassy | data_center" },
      { name: "country",  type: "string", required: true,  desc: "Country code" },
      { name: "metadata", type: "object", required: false, desc: "Type-specific metadata" },
    ],
    response: `{ facility: Facility, id: string }`,
  },
  {
    method: "POST", path: "/api/trpc/alerts.create", auth: true,
    description: "Create a custom alert trigger with conditions and actions.",
    params: [
      { name: "name",       type: "string", required: true,  desc: "Alert name" },
      { name: "conditions", type: "object", required: true,  desc: "Trigger conditions: { region?, keywords?, entities?, sentiment?, impactMin? }" },
      { name: "actions",    type: "array",  required: true,  desc: "Actions: notify | webhook | escalate | log" },
      { name: "cooldown",   type: "number", required: false, desc: "Min seconds between triggers (default: 300)" },
    ],
    response: `{ alert: Alert, id: string }`,
  },
  {
    method: "GET", path: "/api/trpc/analytics.overview", auth: true,
    description: "Platform analytics: article volumes, source health, entity trends, and system metrics.",
    params: [
      { name: "period", type: "string", required: false, desc: "Time period: 24h | 7d | 30d | 90d" },
      { name: "region", type: "string", required: false, desc: "Region filter" },
    ],
    response: `{ metrics: Metrics, trends: Trend[], topEntities: Entity[], sourceHealth: SourceHealth[] }`,
  },
  {
    method: "POST", path: "/api/trpc/webhooks.register", auth: true,
    description: "Register a webhook endpoint for real-time event delivery.",
    params: [
      { name: "url",     type: "string",   required: true,  desc: "HTTPS endpoint URL" },
      { name: "events",  type: "string[]", required: true,  desc: "Events: article.breaking | alert.triggered | narrative.detected | facility.updated" },
      { name: "secret",  type: "string",   required: false, desc: "HMAC-SHA256 signing secret for payload verification" },
      { name: "filters", type: "object",   required: false, desc: "Event-level filters: { region?, category?, minImpact? }" },
    ],
    response: `{ webhook: Webhook, id: string, testUrl: string }`,
  },
  {
    method: "GET", path: "/api/trpc/intel.threatMatrix", auth: true,
    description: "Get the current geopolitical threat matrix with per-country THREATCON levels.",
    params: [
      { name: "region", type: "string", required: false, desc: "Region filter" },
      { name: "period", type: "string", required: false, desc: "Analysis window: 6h | 24h | 48h | 7d" },
    ],
    response: `{ countries: ThreatEntry[], globalLevel: string, updatedAt: number }`,
  },
  {
    method: "POST", path: "/api/trpc/intel.generateReport", auth: true,
    description: "Generate an AI-powered intelligence brief for a region or topic.",
    params: [
      { name: "region", type: "string", required: true,  desc: "Target region or country" },
      { name: "topic",  type: "string", required: false, desc: "Focus topic (optional)" },
      { name: "period", type: "string", required: false, desc: "Analysis period: 24h | 7d | 30d" },
      { name: "format", type: "string", required: false, desc: "Output format: brief | detailed | executive" },
    ],
    response: `{ report: string, sources: Article[], generatedAt: number, wordCount: number }`,
  },
];

// ─── Data Models ─────────────────────────────────────────────────────
const dataModels = [
  { name: "Article", description: "Core intelligence item", fields: [
    { name: "id",               type: "string",    required: true,  desc: "Unique identifier (UUID v4)" },
    { name: "title",            type: "string",    required: true,  desc: "Article headline" },
    { name: "content",          type: "text",      required: true,  desc: "Full article body (HTML or plain text)" },
    { name: "summary",          type: "string",    required: false, desc: "AI-generated 2-sentence summary" },
    { name: "source",           type: "Source",    required: true,  desc: "Origin source reference" },
    { name: "url",              type: "string",    required: true,  desc: "Original article URL" },
    { name: "region",           type: "string",    required: false, desc: "Primary region (ISO code or region name)" },
    { name: "country",          type: "string",    required: false, desc: "Country of origin (ISO 3166-1 alpha-2)" },
    { name: "category",         type: "enum",      required: false, desc: "politics | security | economy | tech | energy | society | military | cyber" },
    { name: "topicsJson",       type: "string[]",  required: false, desc: "Extracted topic tags (JSON array)" },
    { name: "keywordsJson",     type: "string[]",  required: false, desc: "Key terms and phrases (JSON array)" },
    { name: "entitiesJson",     type: "object",    required: false, desc: "Named entities: { people, organizations, locations, events }" },
    { name: "publishedAt",      type: "timestamp", required: true,  desc: "Original publication time (UTC ms)" },
    { name: "ingestedAt",       type: "timestamp", required: true,  desc: "Platform ingestion time (UTC ms)" },
    { name: "credibilityScore", type: "number",    required: false, desc: "AI credibility score (0–100)" },
    { name: "impactScore",      type: "number",    required: false, desc: "Geopolitical impact rating (0–100)" },
    { name: "sentiment",        type: "enum",      required: false, desc: "positive | negative | neutral" },
    { name: "isBreaking",       type: "boolean",   required: false, desc: "Breaking news flag" },
    { name: "threatTier",       type: "enum",      required: false, desc: "FLASH | CRITIC | PRIORITY | ROUTINE" },
  ]},
  { name: "Source", description: "Intelligence source", fields: [
    { name: "id",              type: "string",    required: true,  desc: "Unique identifier" },
    { name: "name",            type: "string",    required: true,  desc: "Source display name" },
    { name: "url",             type: "string",    required: true,  desc: "Source base URL" },
    { name: "rssUrl",          type: "string",    required: false, desc: "RSS feed URL" },
    { name: "type",            type: "enum",      required: true,  desc: "rss | api | scraper | manual | social" },
    { name: "reliability",     type: "number",    required: false, desc: "Reliability score (0–100)" },
    { name: "bias",            type: "string",    required: false, desc: "Editorial bias rating" },
    { name: "country",         type: "string",    required: false, desc: "Country of origin" },
    { name: "language",        type: "string",    required: false, desc: "Primary language (ISO 639-1)" },
    { name: "categories",      type: "string[]",  required: false, desc: "Covered topic categories" },
    { name: "refreshInterval", type: "number",    required: false, desc: "Polling interval in seconds" },
    { name: "lastCrawledAt",   type: "timestamp", required: false, desc: "Last successful crawl time" },
    { name: "isActive",        type: "boolean",   required: false, desc: "Whether source is actively crawled" },
  ]},
  { name: "Entity", description: "Named entity extracted from content", fields: [
    { name: "id",          type: "string",      required: true,  desc: "Unique identifier" },
    { name: "name",        type: "string",      required: true,  desc: "Entity canonical name" },
    { name: "aliases",     type: "string[]",    required: false, desc: "Alternative names and spellings" },
    { name: "type",        type: "enum",        required: true,  desc: "person | organization | location | event | weapon | facility | country" },
    { name: "confidence",  type: "number",      required: false, desc: "Extraction confidence (0–1)" },
    { name: "mentions",    type: "number",      required: false, desc: "Total mention count across all articles" },
    { name: "sentiment",   type: "string",      required: false, desc: "Aggregate sentiment toward this entity" },
    { name: "connections", type: "Connection[]",required: false, desc: "Relationships to other entities" },
    { name: "firstSeen",   type: "timestamp",   required: false, desc: "First appearance in the platform" },
    { name: "lastSeen",    type: "timestamp",   required: false, desc: "Most recent mention" },
  ]},
  { name: "Satellite", description: "Tracked orbital object", fields: [
    { name: "noradId",     type: "string",  required: true,  desc: "NORAD catalog number" },
    { name: "name",        type: "string",  required: true,  desc: "Satellite name/designation" },
    { name: "intlDesig",   type: "string",  required: false, desc: "International designator (YYYY-NNNPPP)" },
    { name: "type",        type: "enum",    required: false, desc: "military | communication | weather | navigation | reconnaissance | debris | experimental" },
    { name: "country",     type: "string",  required: false, desc: "Operating country (ISO code)" },
    { name: "tle1",        type: "string",  required: true,  desc: "TLE line 1" },
    { name: "tle2",        type: "string",  required: true,  desc: "TLE line 2" },
    { name: "altitude",    type: "number",  required: false, desc: "Current altitude in km (computed)" },
    { name: "velocity",    type: "number",  required: false, desc: "Orbital velocity in km/s (computed)" },
    { name: "period",      type: "number",  required: false, desc: "Orbital period in minutes" },
    { name: "inclination", type: "number",  required: false, desc: "Orbital inclination in degrees" },
    { name: "launchDate",  type: "string",  required: false, desc: "Launch date (YYYY-MM-DD)" },
    { name: "decayDate",   type: "string",  required: false, desc: "Predicted decay date (if applicable)" },
  ]},
  { name: "Facility", description: "Tracked ground facility", fields: [
    { name: "id",          type: "string",    required: true,  desc: "Unique identifier" },
    { name: "name",        type: "string",    required: true,  desc: "Facility name" },
    { name: "type",        type: "enum",      required: true,  desc: "nuclear | military | satellite | port | airbase | embassy | data_center | oil_gas | company" },
    { name: "lat",         type: "number",    required: true,  desc: "Latitude coordinate" },
    { name: "lng",         type: "number",    required: true,  desc: "Longitude coordinate" },
    { name: "country",     type: "string",    required: true,  desc: "Country code" },
    { name: "region",      type: "string",    required: false, desc: "Region classification" },
    { name: "status",      type: "enum",      required: false, desc: "active | inactive | under_construction | decommissioned | unknown" },
    { name: "threatLevel", type: "enum",      required: false, desc: "critical | high | medium | low | unknown" },
    { name: "metadata",    type: "object",    required: false, desc: "Type-specific metadata (capacity, weapons, personnel)" },
    { name: "sourceUrl",   type: "string",    required: false, desc: "Source reference URL" },
    { name: "verifiedAt",  type: "timestamp", required: false, desc: "Last verification timestamp" },
  ]},
  { name: "Narrative", description: "Tracked information operation", fields: [
    { name: "id",           type: "string",    required: true,  desc: "Unique identifier" },
    { name: "title",        type: "string",    required: true,  desc: "Narrative title" },
    { name: "type",         type: "enum",      required: true,  desc: "fimi | propaganda | organic | breaking | disinformation | coordinated" },
    { name: "status",       type: "enum",      required: true,  desc: "active | resolved | monitoring | escalated" },
    { name: "description",  type: "text",      required: false, desc: "Narrative description and analysis" },
    { name: "actors",       type: "Entity[]",  required: false, desc: "Identified actors and amplifiers" },
    { name: "targets",      type: "Entity[]",  required: false, desc: "Target audiences and regions" },
    { name: "spreadScore",  type: "number",    required: false, desc: "Virality score (0–100)" },
    { name: "reachScore",   type: "number",    required: false, desc: "Estimated reach (0–100)" },
    { name: "firstSeen",    type: "timestamp", required: false, desc: "First detection time" },
    { name: "lastActivity", type: "timestamp", required: false, desc: "Most recent activity" },
  ]},
  { name: "Alert", description: "Custom alert trigger", fields: [
    { name: "id",            type: "string",   required: true,  desc: "Unique identifier" },
    { name: "name",          type: "string",   required: true,  desc: "Alert name" },
    { name: "conditions",    type: "object",   required: true,  desc: "Trigger conditions: { region?, keywords?, entities?, sentiment?, impactMin? }" },
    { name: "actions",       type: "Action[]", required: true,  desc: "Actions: notify | webhook | escalate | log" },
    { name: "cooldown",      type: "number",   required: false, desc: "Min seconds between triggers" },
    { name: "enabled",       type: "boolean",  required: true,  desc: "Whether alert is active" },
    { name: "lastTriggered", type: "timestamp",required: false, desc: "Last trigger time" },
    { name: "triggerCount",  type: "number",   required: false, desc: "Total times triggered" },
    { name: "createdBy",     type: "string",   required: false, desc: "User ID who created the alert" },
  ]},
];

// ─── Changelog ───────────────────────────────────────────────────────
const changelog = [
  { version: "2.4.0", date: "2026-06-01", type: "major" as const, title: "Redroom V2.4 — Enterprise Release", changes: [
    "Full ORBIT module with 10,000+ satellite tracking via SGP4 propagation",
    "SIGINT layer: ADS-B, AIS, CCTV, RF monitoring, seismic, weather overlays",
    "Narrative tracking with FIMI detection and spread analysis",
    "3D network investigation graphs with d3-force layout",
    "Surveillance Mode (SVM) with multi-feed tracking (up to 10 objects)",
    "Custom facility management with LLM-powered discovery",
    "Agentic workflow automation engine",
    "Enterprise API with webhook support and HMAC signing",
    "Documentation portal at /docs",
    "Owlink.ai product landing page at /owlink",
    "THREATCON banner with 5-level color-coded threat assessment",
    "Intelligence brief generation via LLM",
  ]},
  { version: "2.3.0", date: "2026-04-15", type: "major" as const, title: "Intelligence Enrichment Engine", changes: [
    "AI-powered article enrichment pipeline (entity extraction, credibility scoring)",
    "Entity deep-dive panel with co-occurrence analysis",
    "Automated credibility scoring with source reliability weighting",
    "Multi-language support (12 languages with auto-detection)",
    "Custom decision model builder",
    "Save Investigation feature with graph snapshots",
  ]},
  { version: "2.2.0", date: "2026-03-01", type: "major" as const, title: "Global Coverage Expansion", changes: [
    "180+ country coverage with regional intelligence hubs",
    "500+ verified sources with bias and reliability ratings",
    "Country-specific dashboards with threat scoring",
    "Geopolitical risk matrix",
    "Arc diagram and alluvial flow visualizations for news flow analysis",
  ]},
  { version: "2.1.0", date: "2026-01-20", type: "minor" as const, title: "Real-time Processing", changes: [
    "Sub-30-second signal-to-insight pipeline",
    "WebSocket real-time feeds",
    "Push notification system",
    "Alert trigger framework with webhook delivery",
  ]},
  { version: "2.0.0", date: "2025-12-01", type: "major" as const, title: "Platform Rewrite", changes: [
    "Complete architecture rewrite: React 19 + tRPC 11 + Drizzle ORM",
    "Three.js 3D globe and satellite orbit visualizations",
    "Dark intelligence UI theme with Orbitron typography",
    "TiDB distributed SQL database for scale",
  ]},
  { version: "1.5.0", date: "2025-09-15", type: "minor" as const, title: "Source Intelligence", changes: [
    "RSS feed aggregation engine with 200+ sources",
    "Source reliability scoring and bias detection",
    "Duplicate detection and deduplication",
    "Category auto-classification",
  ]},
  { version: "1.0.0", date: "2025-06-01", type: "major" as const, title: "Initial Release", changes: [
    "Core news intelligence platform",
    "Region-based filtering (MENA focus)",
    "Basic article display and search",
    "User authentication and role management",
  ]},
];

// ─── Main Component ──────────────────────────────────────────────────
export default function DocsPage() {
  const [activeSection, setActiveSection] = useState("getting-started");
  const [searchQuery, setSearchQuery] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>(
    Object.fromEntries(categories.map(c => [c, true]))
  );
  const [askAiOpen, setAskAiOpen] = useState(false);
  const [askAiInput, setAskAiInput] = useState("");
  const [isLight, setIsLight] = useState(() => {
    try {
      const stored = localStorage.getItem("docs-theme");
      // Default to light if no preference has been saved yet
      return stored === null ? true : stored === "light";
    } catch { return true; }
  });
  const toggleDocTheme = () => {
    setIsLight(v => {
      const next = !v;
      try { localStorage.setItem("docs-theme", next ? "light" : "dark"); } catch {}
      return next;
    });
  };

  // Theme-aware CSS helpers
  const t = {
    bg: isLight ? "bg-white" : "bg-[#060810]",
    sidebar: isLight ? "bg-gray-50 border-gray-200" : "bg-[#080a10] border-gray-800/40",
    text: isLight ? "text-gray-900" : "text-white",
    muted: isLight ? "text-gray-500" : "text-gray-500",
    border: isLight ? "border-gray-200" : "border-gray-800/40",
    input: isLight ? "bg-gray-100 border-gray-300 text-gray-900 placeholder:text-gray-400 focus:border-red-400" : "bg-[#0c0e14] border-gray-800/40 text-white placeholder:text-gray-600 focus:border-red-500/40",
    navItem: isLight ? "text-gray-600 hover:text-gray-900 hover:bg-gray-100" : "text-gray-500 hover:text-white hover:bg-white/5",
    navActive: isLight ? "bg-red-50 text-red-700 border border-red-200" : "bg-red-500/10 text-red-300 border border-red-500/20",
    navIcon: isLight ? "text-gray-400" : "text-gray-700",
    navIconActive: isLight ? "text-red-500" : "text-red-400",
    catLabel: isLight ? "text-gray-400 hover:text-gray-600" : "text-gray-600 hover:text-gray-400",
    footer: isLight ? "border-gray-200" : "border-gray-800/40",
    footerLink: isLight ? "text-gray-500 hover:text-gray-900" : "text-gray-500 hover:text-white",
    footerMuted: isLight ? "text-gray-400" : "text-gray-700",
    mobileBtn: isLight ? "bg-white border-gray-300 text-gray-700" : "bg-[#0c0e14] border-gray-800/40 text-white",
    upgradeBanner: isLight ? "bg-gradient-to-r from-red-50 to-amber-50 border-b border-red-200" : "bg-gradient-to-r from-red-950/40 to-amber-950/20 border-b border-red-900/30",
    upgradeText: isLight ? "text-red-700" : "text-red-300",
    upgradeSub: isLight ? "text-gray-500" : "text-gray-500",
    upgradeBtn: isLight ? "bg-red-600 hover:bg-red-700 text-white" : "bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300",
    themeBtn: isLight ? "bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300" : "bg-gray-800/50 hover:bg-gray-700/60 text-gray-400 border border-gray-700/40",
    badgeCyan: isLight ? "bg-cyan-50 text-cyan-600 border-cyan-200" : "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  };

  const filteredSections = useMemo(() => {
    if (!searchQuery) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(s => s.title.toLowerCase().includes(q) || s.category.toLowerCase().includes(q));
  }, [searchQuery]);

  const scrollToSection = useCallback((id: string) => {
    setActiveSection(id);
    setSidebarOpen(false);
    setTimeout(() => {
      const el = document.getElementById(`doc-${id}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  }, []);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => ({ ...prev, [cat]: !prev[cat] }));
  };

  return (
    <div className={`min-h-screen ${t.bg} ${t.text} flex flex-col`}>
      <ReadingProgress />

      {/* ─── Fixed Top Header ──────────────────────────────────────── */}
      <div className={`fixed top-0 left-0 right-0 z-50 shrink-0 ${isLight ? "bg-white/98 border-gray-200" : "bg-[#060810]/98 border-gray-800/40"} border-b backdrop-blur-md`}>
        {/* Main header row: logo + title + right controls */}
        <div className="px-4 py-2.5 flex items-center gap-3">
          {/* Platform logo (same as IntelPlatform) */}
          <a href="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="relative w-7 h-7">
              <svg viewBox="0 0 28 28" fill="none" className="w-full h-full">
                <circle cx="14" cy="14" r="13" stroke="#00e5ff" strokeWidth="1" opacity="0.5" />
                <circle cx="14" cy="14" r="9" stroke="#00e5ff" strokeWidth="1" />
                <circle cx="14" cy="14" r="2.5" fill="#cc1111" style={{ filter: 'drop-shadow(0 0 4px #cc1111)' }} />
                <line x1="14" y1="1" x2="14" y2="5" stroke="#00e5ff" strokeWidth="1" />
                <line x1="14" y1="23" x2="14" y2="27" stroke="#00e5ff" strokeWidth="1" />
                <line x1="1" y1="14" x2="5" y2="14" stroke="#00e5ff" strokeWidth="1" />
                <line x1="23" y1="14" x2="27" y2="14" stroke="#00e5ff" strokeWidth="1" />
                <path d="M14 5 L19 14 L14 23 L9 14 Z" stroke="#00e5ff" strokeWidth="0.8" fill="none" opacity="0.6" />
              </svg>
            </div>
            <div>
              <div className="text-xs font-black tracking-widest leading-none" style={{ fontFamily: "'Orbitron', monospace" }}>
                <span style={{ color: '#cc1111' }}>RED</span><span style={{ color: '#00e5ff' }}>ROOM</span>
              </div>
              <div className={`text-[9px] font-mono tracking-wider leading-none mt-0.5 ${isLight ? "text-gray-400" : "text-gray-600"}`}>DOCS · V2.4</div>
            </div>
          </a>
          {/* Divider */}
          <div className={`h-5 w-px mx-1 ${isLight ? "bg-gray-200" : "bg-gray-800"}`} />
          {/* Breadcrumb / section indicator */}
          <div className={`hidden sm:flex items-center gap-1.5 text-[10px] font-mono ${isLight ? "text-gray-400" : "text-gray-600"}`}>
            <span>Enterprise Platform</span>
            <ChevronRight size={10} />
            <span className={isLight ? "text-gray-700" : "text-gray-300"}>Documentation</span>
          </div>
          {/* Right controls */}
          <div className="ml-auto flex items-center gap-2 shrink-0">
            {/* Ask AI button */}
            <button
              onClick={() => setAskAiOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[10px] border transition-all ${isLight ? "border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100" : "border-purple-800/50 bg-purple-950/30 text-purple-300 hover:bg-purple-900/40"}`}
              title="Ask AI — Premium feature"
            >
              <Bot size={11} className="text-purple-400" />
              <span className="hidden sm:inline">Ask AI</span>
              <Lock size={9} className="text-amber-400" />
            </button>
            {/* Upgrade CTA — merged into header, no separate banner */}
            <a href="https://owlink.ai" target="_blank" rel="noopener noreferrer" className={`hidden md:flex items-center gap-1.5 px-3 py-1 rounded-lg border text-[10px] font-mono transition-all no-underline ${isLight ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border-amber-800/50 bg-amber-950/30 text-amber-400 hover:bg-amber-950/50"}`}>
              <Zap size={10} className="text-amber-400" />
              <span>Unlock Sovereign Deployment</span>
              <span className="font-bold ml-0.5">Upgrade →</span>
            </a>
            {/* Theme toggle */}
            <button
              onClick={toggleDocTheme}
              className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] border transition-all ${isLight ? "border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200" : "border-gray-700/50 bg-gray-800/40 text-gray-400 hover:bg-gray-700/50"}`}
              title={isLight ? "Switch to dark mode" : "Switch to light mode"}
            >
              {isLight ? <Moon size={11} /> : <Sun size={11} />}
              <span className="hidden sm:inline">{isLight ? "DARK" : "LIGHT"}</span>
            </button>
            {/* Back to platform */}
            <a
              href="/"
              className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono text-[10px] border transition-all ${isLight ? "border-red-200 bg-red-50 text-red-600 hover:bg-red-100" : "border-red-900/40 bg-red-950/20 text-red-400 hover:bg-red-950/40"}`}
            >
              ← INTEL
            </a>
          </div>
        </div>
      </div>

      {/* Spacer to push content below fixed header */}
      <div className="h-[44px] shrink-0" />
      {/* Flex row: sidebar + main */}
      <div className="flex flex-1 min-h-0">

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Mobile menu button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`fixed top-12 left-4 z-50 md:hidden p-2 rounded-lg border ${t.mobileBtn}`}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* ─── Sidebar ──────────────────────────────────────────── */}
      <aside className={`fixed md:sticky top-[44px] left-0 h-[calc(100vh-44px)] w-72 border-r flex flex-col z-40 transition-transform duration-300 ${t.sidebar} ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
        {/* Search */}
        <div className={`p-4 border-b ${t.border}`}>
          {/* Search */}
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              type="text"
              placeholder="Search docs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`w-full pl-9 pr-3 py-2 border rounded-lg text-xs focus:outline-none transition-colors ${t.input}`}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X size={11} className="text-gray-500 hover:text-white" />
              </button>
            )}
          </div>
          {searchQuery && (
            <div className="text-[10px] text-gray-600 mt-1.5 font-mono">{filteredSections.length} result{filteredSections.length !== 1 ? "s" : ""}</div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {categories.map(cat => {
            const catSections = filteredSections.filter(s => s.category === cat);
            if (catSections.length === 0) return null;
            return (
              <div key={cat} className="mb-1">
                <button
                  onClick={() => toggleCategory(cat)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 text-[10px] font-mono uppercase tracking-widest transition-colors ${t.catLabel}`}
                >
                  {expandedCategories[cat] ? <ChevronDown size={9} /> : <ChevronRight size={9} />}
                  {cat}
                </button>
                {expandedCategories[cat] && (
                  <div className="ml-1 space-y-0.5">
                    {catSections.map(section => {
                      const Icon = section.icon;
                      const isActive = activeSection === section.id;
                      return (
                        <button
                          key={section.id}
                          onClick={() => scrollToSection(section.id)}
                          className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-xs transition-all ${isActive ? t.navActive : t.navItem}`}
                        >
                          <Icon size={13} className={isActive ? t.navIconActive : t.navIcon} />
                          <span className="flex-1 text-left">{section.title}</span>
                          {section.badge && (
                            <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${t.badgeCyan}`}>{section.badge}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t ${t.border} space-y-2`}>
          <a href="https://github.com/Owlinkai/redroom" target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 text-[11px] transition-colors ${t.footerLink}`}>
            <GitBranch size={12} /> GitHub Repository <ExternalLink size={10} className="ml-auto" />
          </a>
          <a href="https://redroom.live" target="_blank" rel="noopener noreferrer"
            className={`flex items-center gap-2 text-[11px] transition-colors ${t.footerLink}`}>
            <Globe size={12} /> Live Demo <ExternalLink size={10} className="ml-auto" />
          </a>
          <div className={`text-[9px] font-mono text-center pt-1 ${t.footerMuted}`}>REDROOM V2.4 · OWLINK.AI</div>
        </div>
      </aside>

      {/* ─── Main Content ─────────────────────────────────────── */}
      <main id="docs-main-content" className="flex-1 min-w-0 overflow-y-auto h-screen">
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12 md:py-16">

          {/* ═══ GETTING STARTED ═══════════════════════════════════ */}
          <section id="doc-getting-started" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Rocket size={20} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Getting Started</h1>
                <p className="text-xs text-gray-500 font-mono">Quick start guide · Redroom V2.4</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-red-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Redroom is the world's most complete dynamic OSINT intelligence platform. It combines real-time news aggregation,
              satellite tracking, signal intelligence, narrative analysis, and automated decision-making into a single unified interface.
              Built for governments, intelligence agencies, newsrooms, and researchers.
            </p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              <StatCard isLight={isLight} value="500+" label="Sources" color="red" />
              <StatCard isLight={isLight} value="180+" label="Countries" color="cyan" />
              <StatCard isLight={isLight} value="10K+" label="Satellites" color="amber" />
              <StatCard isLight={isLight} value="&lt;30s" label="Latency" color="green" />
            </div>

            <InfoBox isLight={isLight} type="info" title="Prerequisites">
              Node.js 20+, pnpm 10+, and a modern browser (Chrome 120+, Firefox 120+, Edge 120+). For self-hosted deployments, you'll also need a TiDB or MySQL 8.0-compatible database and an S3-compatible object store.
            </InfoBox>

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Quick Start", icon: Rocket, content: (
                <CodeBlock isLight={isLight} title="Clone & Install" language="bash" code={`# Clone the repository
git clone https://github.com/Owlinkai/redroom.git
cd redroom

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your database URL and API keys

# Push database schema
pnpm db:push

# Start development server
pnpm dev
# → App available at http://localhost:3000`} />
              )},
              { label: "Docker", icon: Server, content: (
                <CodeBlock isLight={isLight} title="Docker Compose" language="bash" code={`# Pull and start with Docker Compose
curl -O https://raw.githubusercontent.com/Owlinkai/redroom/main/docker-compose.yml
docker-compose up -d

# Check status
docker-compose ps
docker-compose logs -f redroom

# Access at http://localhost:3000`} />
              )},
              { label: "Environment", icon: Settings, content: (
                <CodeBlock isLight={isLight} title=".env Configuration" language="bash" code={`# Database (required)
DATABASE_URL=mysql://user:password@host:4000/redroom

# Authentication (required)
JWT_SECRET=your-256-bit-secret-key

# Storage (required for file uploads)
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# External APIs (optional — enhances data quality)
OPENSKY_USERNAME=your-opensky-username
OPENSKY_PASSWORD=your-opensky-password
AISSTREAM_API_KEY=your-aisstream-key

# LLM for enrichment (optional)
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-openai-key`} />
              )},
            ]} />

            <h3 className="text-lg font-bold mt-8 mb-4">Project Structure</h3>
            <CodeBlock isLight={isLight} title="Directory Layout" language="text" code={`redroom/
├── client/                    # React 19 frontend (Vite)
│   ├── src/
│   │   ├── pages/             # Page components
│   │   │   ├── IntelPlatform.tsx   # Main intelligence hub
│   │   │   ├── Orbit.tsx           # Satellite tracking
│   │   │   ├── Sigint.tsx          # Signal intelligence
│   │   │   ├── Surveillance.tsx    # SVM multi-tracking
│   │   │   └── (Owlink.tsx moved to owlink.ai project)
│   │   ├── components/        # Shared UI components
│   │   │   ├── GlobeRegionSelector.tsx  # 3D globe
│   │   │   ├── NarrativeConnectionGraph.tsx  # d3-force graph
│   │   │   └── DashboardLayout.tsx  # Layout wrapper
│   │   ├── contexts/          # React contexts
│   │   └── hooks/             # Custom hooks
│   └── index.html
├── server/                    # Express 4 + tRPC 11 backend
│   ├── routers/               # Feature routers
│   │   ├── news.ts            # News & articles
│   │   ├── orbit.ts           # Satellite tracking
│   │   ├── sigint.ts          # Signal intelligence
│   │   ├── narratives.ts      # Narrative tracking
│   │   ├── facilities.ts      # Facility management
│   │   └── intel.ts           # Threat matrix & reports
│   ├── db.ts                  # Database query helpers
│   └── routers.ts             # Router aggregation
├── drizzle/                   # Schema & migrations
│   └── schema.ts              # Drizzle ORM table definitions
├── shared/                    # Shared types & constants
└── storage/                   # S3 file storage helpers`} />

            <h3 className="text-lg font-bold mt-8 mb-4">Platform Access</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[
                { title: "Live Demo", desc: "Explore the full platform", url: "https://redroom.live", icon: Globe, badge: "Live" },
                { title: "GitHub Repository", desc: "Source code, issues & PRs", url: "https://github.com/Owlinkai/redroom", icon: GitBranch, badge: "Open Source" },
              ].map((item, i) => (
                <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                  className={`flex items-center gap-3 p-4 rounded-lg border transition-all group ${isLight ? "border-gray-200 bg-gray-50 hover:border-red-400" : "border-gray-800/40 bg-[#0a0c12] hover:border-red-500/30"}`}>
                  <item.icon size={18} className={`transition-colors group-hover:text-red-500 ${isLight ? "text-gray-500" : "text-gray-500"}`} />
                  <div className="flex-1">
                    <div className={`text-sm font-semibold ${isLight ? "text-gray-900" : "text-white"}`}>{item.title}</div>
                    <div className="text-xs text-gray-500">{item.desc}</div>
                  </div>
                  <span className={`text-[9px] font-mono px-2 py-0.5 rounded ${isLight ? "bg-gray-100 text-gray-500 border border-gray-200" : "bg-gray-800 text-gray-500"}`}>{item.badge}</span>
                  <ExternalLink size={12} className={`group-hover:text-red-500 ${isLight ? "text-gray-400" : "text-gray-600"}`} />
                </a>
              ))}
            </div>
          </section>

          {/* ═══ ARCHITECTURE ══════════════════════════════════════ */}
          <section id="doc-architecture" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Network size={20} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Architecture</h1>
                <p className="text-xs text-gray-500 font-mono">System design & data flow</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-cyan-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Redroom follows a modular monolith architecture with clear separation between intelligence layers.
              Each module (News, ORBIT, SIGINT, Narratives) operates independently but shares a common data bus
              for cross-layer correlation. The stack is React 19 + tRPC 11 + Drizzle ORM + TiDB, with Three.js
              for 3D visualizations and d3-force for graph analysis.
            </p>

            <div className={`rounded-xl border p-5 my-8 overflow-x-auto ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#080a0f]"}`}>
              <div className="text-[10px] font-mono text-gray-600 mb-4 flex items-center gap-2">
                <Cpu size={10} /> SYSTEM ARCHITECTURE — REDROOM V2.4
              </div>
              <pre className="text-[11px] font-mono text-gray-400 leading-loose whitespace-pre">{`
┌─────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER (React 19)                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ │
│  │   Main   │ │  ORBIT   │ │  SIGINT  │ │Narratives│ │   SVM    │ │
│  │ Platform │ │  Module  │ │  Module  │ │  Module  │ │  Module  │ │
│  │ (Globe)  │ │(Three.js)│ │(Leaflet) │ │(d3-force)│ │(Multi)   │ │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ │
│       └─────────────┴────────────┴─────────────┴─────────────┘      │
│                              │ tRPC (type-safe RPC)                  │
└──────────────────────────────┼───────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                    SERVER LAYER (Express 4 + tRPC 11)                 │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │              tRPC Router (publicProcedure / protectedProcedure) │  │
│  └────────────────────────────────────────────────────────────────┘  │
│  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  ┌────┐  │
│  │news│  │orbt│  │sigt│  │narr│  │faci│  │alrt│  │anlx│  │intl│  │
│  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  └──┬─┘  │
│     └───────┴────────┴───────┴────────┴───────┴────────┴───────┘    │
│                    Data Access Layer (Drizzle ORM)                    │
│  ┌───────────────────┐              ┌──────────────────────────────┐ │
│  │   TiDB / MySQL    │              │   S3-compatible Object Store  │ │
│  │  (Primary Store)  │              │   (Files, Media, Exports)    │ │
│  └───────────────────┘              └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                               │
┌──────────────────────────────┼───────────────────────────────────────┐
│                      EXTERNAL DATA SOURCES                            │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐      │
│  │500+ RSS │ │ ADS-B   │ │  AIS    │ │  TLE    │ │  CCTV   │      │
│  │ Feeds   │ │OpenSky  │ │AISStream│ │CelesTrak│ │ Streams │      │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘      │
└──────────────────────────────────────────────────────────────────────┘`}</pre>
            </div>

            <h3 className="text-lg font-bold mt-8 mb-4">Technology Stack</h3>
            <div className={`overflow-x-auto rounded-lg border ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <table className="w-full text-xs">
                <thead><tr className={isLight ? "bg-gray-100" : "bg-[#0c0e14]"}>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Layer</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Technology</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Version</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Purpose</th>
                </tr></thead>
                <tbody>
                  {[
                    ["Frontend",  "React",              "19",    "UI framework"],
                    ["Styling",   "Tailwind CSS",        "4",     "Utility-first styling"],
                    ["State",     "tRPC + React Query",  "11/5",  "Type-safe data fetching"],
                    ["3D",        "Three.js",            "0.183", "Globe, orbits, 3D visuals"],
                    ["Graphs",    "d3-force",            "7",     "Network & force graphs"],
                    ["Maps",      "Leaflet",             "1.9",   "2D geospatial maps"],
                    ["Backend",   "Express",             "4",     "HTTP server"],
                    ["API",       "tRPC",                "11",    "Type-safe RPC layer"],
                    ["Database",  "TiDB / MySQL",        "8.0+",  "Distributed SQL"],
                    ["ORM",       "Drizzle",             "0.36",  "Type-safe schema & queries"],
                    ["Storage",   "S3-compatible",       "—",     "File & media storage"],
                    ["Auth",      "JWT + OAuth2",        "—",     "Session management"],
                    ["AI/ML",     "OpenAI-compatible LLM","—",    "Enrichment & reports"],
                    ["Build",     "Vite + esbuild",      "6/0.24","Frontend & server bundles"],
                  ].map(([layer, tech, ver, purpose], i) => (
                    <tr key={i} className={`border-t transition-colors ${isLight ? "border-gray-100 hover:bg-gray-50" : "border-gray-800/30 hover:bg-white/2"}`}>
                      <td className={`py-2.5 px-4 font-medium ${isLight ? "text-gray-800" : "text-gray-300"}`}>{layer}</td>
                      <td className={`py-2.5 px-4 font-mono ${isLight ? "text-cyan-700" : "text-cyan-400"}`}>{tech}</td>
                      <td className={`py-2.5 px-4 font-mono ${isLight ? "text-gray-400" : "text-gray-600"}`}>{ver}</td>
                      <td className={`py-2.5 px-4 ${isLight ? "text-gray-500" : "text-gray-500"}`}>{purpose}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* ═══ VALUES & MISSION ══════════════════════════════════ */}
          <section id="doc-values" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Heart size={20} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Values & Mission</h1>
                <p className="text-xs text-gray-500 font-mono">Owlink.ai · What drives Redroom</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-red-500/30 to-transparent mb-8" />

            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 mb-8">
              <p className="text-base text-white font-medium leading-relaxed italic">
                "Stealth Intelligence for Governments and People — democratizing access to the same
                intelligence capabilities that were once exclusive to nation-state agencies."
              </p>
              <p className="text-sm text-gray-400 mt-3">— Owlink.ai Mission Statement</p>
            </div>

            <div className="space-y-3">
              {[
                { title: "Radical Transparency", desc: "Every insight, score, and classification is fully auditable. No black boxes. Users see exactly how every conclusion is reached — from source to signal to decision.", icon: Eye, color: "red" },
                { title: "Open Source First", desc: "The core platform is MIT-licensed. We believe intelligence tools should be accessible to researchers, journalists, and civil society — not locked behind million-dollar contracts.", icon: GitBranch, color: "cyan" },
                { title: "Data Sovereignty", desc: "Your data stays yours. Self-host anywhere. No vendor lock-in. No data leaves your infrastructure unless you explicitly configure it to.", icon: Shield, color: "green" },
                { title: "Accuracy Over Speed", desc: "We prioritize verified, contextualized intelligence over raw speed. Every article is enriched, scored, and cross-referenced before surfacing.", icon: Target, color: "amber" },
                { title: "Modularity", desc: "Take what you need. Each intelligence layer is independent. Deploy the full stack or cherry-pick modules for your specific mission.", icon: Boxes, color: "purple" },
              ].map((item, i) => (
                <div key={i} className={`flex items-start gap-4 p-4 rounded-lg border transition-colors ${isLight ? "border-gray-200 bg-gray-50 hover:border-gray-300" : "border-gray-800/40 bg-[#0a0c12] hover:border-gray-700/60"}`}>
                  <div className={`w-9 h-9 rounded-lg border flex items-center justify-center shrink-0 ${isLight ? "bg-gray-100 border-gray-200" : "bg-gray-800/60 border-gray-700/40"}`}>
                    <item.icon size={16} className={isLight ? "text-gray-500" : "text-gray-300"} />
                  </div>
                  <div>
                    <div className={`text-sm font-bold mb-1 ${isLight ? "text-gray-900" : "text-white"}`}>{item.title}</div>
                    <div className={`text-xs leading-relaxed ${isLight ? "text-gray-600" : "text-gray-400"}`}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ PLATFORM MODULES ═════════════════════════════════ */}
          <section id="doc-platforms" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Layers size={20} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Platform Modules</h1>
                <p className="text-xs text-gray-500 font-mono">Integrated intelligence layers</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-purple-500/30 to-transparent mb-8" />

            <div className="space-y-4">
              {[
                { name: "Main Intelligence Platform", icon: Globe, desc: "The core news intelligence hub. Real-time aggregation from 500+ sources, AI enrichment, entity extraction, impact scoring, and interactive 3D globe visualization with region-based filtering.", features: ["Multi-region filtering (180+ countries)", "AI category classification", "Credibility & impact scoring", "Entity relationship mapping", "THREATCON threat matrix", "Intelligence brief generation", "Custom decision models", "Breaking news flash overlay", "Live event ticker"] },
                { name: "ORBIT — Space Surveillance", icon: Satellite, desc: "Monitor 10,000+ orbital objects with real-time TLE propagation via SGP4 algorithm. Track military reconnaissance satellites, predict passes, and map ground station infrastructure.", features: ["10,000+ tracked objects", "SGP4/SDP4 propagation", "Pass prediction (AOS/LOS)", "Ground station mapping", "Launch facility tracking", "Orbital decay alerts", "Conjunction analysis", "Space weather integration"] },
                { name: "SIGINT — Signal Intelligence", icon: Radio, desc: "Fuse ADS-B aviation, AIS maritime, CCTV feeds, seismic sensors, and weather overlays into a unified geospatial operational picture.", features: ["ADS-B real-time flights", "AIS maritime vessels", "CCTV/OSINT cameras (TfL, ASFINAG, YouTube)", "Seismic monitoring (USGS/EMSC)", "Weather overlays", "Fire detection (NASA FIRMS)", "RF spectrum indicators", "Space weather (NOAA SWPC)"] },
                { name: "Surveillance Mode (SVM)", icon: Eye, desc: "Dedicated multi-target tracking interface. Monitor up to 10 objects simultaneously across all layers with live feeds and automated alerting.", features: ["Up to 10 simultaneous targets", "Live camera feeds", "Aircraft route visualization", "Vessel path history", "Satellite pass countdown", "Alert triggers", "Timeline recording", "Cross-layer correlation"] },
                { name: "Narratives & FIMI", icon: Network, desc: "Track information operations, propaganda campaigns, and Foreign Information Manipulation and Interference (FIMI) with spread analysis and actor attribution.", features: ["FIMI detection", "Propaganda tracking", "Spread & reach metrics", "Actor attribution", "d3-force connection graph", "Zoom/pan/drag interaction", "Per-type filtering", "Fullscreen investigation mode"] },
              ].map((mod, i) => (
                <div key={i} className={`rounded-xl border overflow-hidden transition-colors ${isLight ? "border-gray-200 bg-gray-50 hover:border-gray-300" : "border-gray-800/40 bg-[#0a0c12] hover:border-gray-700/60"}`}>
                  <div className={`p-5 border-b ${isLight ? "border-gray-200" : "border-gray-800/30"}`}>
                    <div className="flex items-center gap-3 mb-2">
                      <mod.icon size={18} className={isLight ? "text-gray-500" : "text-gray-400"} />
                      <h3 className={`text-sm font-bold ${isLight ? "text-gray-900" : ""}`}>{mod.name}</h3>
                    </div>
                    <p className={`text-xs leading-relaxed ${isLight ? "text-gray-600" : "text-gray-400"}`}>{mod.desc}</p>
                  </div>
                  <div className={`p-4 ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                      {mod.features.map((f, j) => (
                        <div key={j} className={`flex items-center gap-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                          <CheckCircle2 size={10} className="text-green-500 shrink-0" />
                          {f}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ MAIN INTELLIGENCE ════════════════════════════════ */}
          <section id="doc-main-intel" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Globe size={20} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Main Intelligence Platform</h1>
                <p className="text-xs text-gray-500 font-mono">The core intelligence hub</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-red-500/30 to-transparent mb-8" />

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Live Map", icon: Activity, content: (
                <div className={`space-y-3 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                  <p>The Live Map is the primary operational view. A full-screen Leaflet map with floating HUD panels provides a real-time picture of global intelligence.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {["THREATCON banner (5-level: Normal/Alpha/Bravo/Charlie/Delta)", "Floating Intel Panel with Feed/Threats/Facilities sub-tabs", "Layer Control Panel (data layers, facility types, topic filters)", "Facility Deep-Dive Panel with threat scores", "Country threat rings sized by threat level", "Animated attack vectors from article data", "Live Event Ticker (bottom scrolling strip)", "Breaking News Flash Overlay", "4 base maps: Dark/OSM/Satellite/Topo", "Keyboard shortcuts: F/A/H/I/L/ESC"].map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle2 size={10} className="text-red-400 shrink-0 mt-0.5" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              )},
              { label: "Intel Feed", icon: FileText, content: (
                <div className={`space-y-3 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                  <p>The Intelligence Feed presents articles in a classified-document layout with SIGINT/HUMINT/OSINT source badges and threat-tier classification.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {["Threat-tier filter bar (FLASH/CRITIC/PRIORITY/ROUTINE)", "Intel card grid with entity tags and threat scores", "Left sidebar: INTEL FILTERS (tier, sentiment, topic, geo)", "Right SIGINT panel: entity radar, geo distribution", "Article detail drawer with full classified-style brief", "Source matrix with reliability indicators", "Explore button → jumps to network investigation", "Google News fallback for all articles"].map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle2 size={10} className="text-red-400 shrink-0 mt-0.5" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              )},
              { label: "Network Explorer", icon: Network, content: (
                <div className={`space-y-3 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                  <p>The Network Explorer provides IBM Watson-style investigation with 4 panels: article list, force-directed network graph, entity deep-dive, and timeline.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {["Force-directed vis-network graph (Barnes-Hut physics)", "Entity types: person, org, country, author, agency, keyword", "Entity Deep-Dive Panel with co-occurrence analysis", "Save Investigation with graph snapshots", "Tree view toggle (Network ↔ Tree)", "Timeline bar showing article publication density", "Cross-tab navigation from Feed and Live map", "Node type filter chips"].map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle2 size={10} className="text-red-400 shrink-0 mt-0.5" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              )},
              { label: "Analytics", icon: BarChart3, content: (
                <div className={`space-y-3 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                  <p>Analytics and comparison tools for intelligence analysis, source comparison, and geopolitical risk assessment.</p>
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    {["Sentiment trends over time (Recharts)", "Topic distribution charts", "Agency radar charts", "Timeline heatmap (article density)", "Country comparison with threat scoring", "Source-to-topic alluvial flow diagram", "Country co-mention arc diagram", "AI-generated intelligence briefs"].map((f, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle2 size={10} className="text-red-400 shrink-0 mt-0.5" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              )},
            ]} />
          </section>

          {/* ═══ ORBIT MODULE ═════════════════════════════════════ */}
          <section id="doc-orbit" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Satellite size={20} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">ORBIT Module</h1>
                <p className="text-xs text-gray-500 font-mono">Space surveillance & satellite tracking</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-cyan-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              ORBIT provides comprehensive space situational awareness by tracking 10,000+ cataloged objects
              using Two-Line Element (TLE) propagation via the SGP4/SDP4 algorithm. Data is sourced from
              CelesTrak and Space-Track.org, updated every 6 hours.
            </p>

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Satellite Tracking", icon: Satellite, content: (
                <div className="space-y-4">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>Real-time 3D globe with satellite positions propagated from TLE data. Filter by type, country, altitude band, and operational status.</p>
                  <CodeBlock isLight={isLight} title="Satellite Query" language="typescript" code={`// Fetch military satellites with current positions
const { data } = trpc.orbit.satellites.useQuery({
  type: "military",
  country: "RU",
  altitude: { min: 200, max: 2000 }, // LEO band
});

// Each satellite includes computed position
// { lat, lng, alt, velocity, azimuth, elevation }`} />
                </div>
              )},
              { label: "Pass Prediction", icon: Target, content: (
                <div className="space-y-4">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>Calculate when any satellite will be visible from a ground location, including AOS (Acquisition of Signal), LOS (Loss of Signal), and maximum elevation.</p>
                  <CodeBlock isLight={isLight} title="Pass Prediction" language="typescript" code={`// Predict passes over a location
const { data } = trpc.orbit.passes.useQuery({
  satId: "25544",   // ISS NORAD ID
  lat: 48.8566,     // Paris
  lng: 2.3522,
  days: 7,
  minElevation: 10, // degrees above horizon
});

// Returns: AOS time, LOS time, max elevation,
// duration, direction (N/S/E/W), visibility`} />
                </div>
              )},
              { label: "Ground Stations", icon: Wifi, content: (
                <div className="space-y-4">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>Map of global ground stations including SIGINT collection sites, Starlink gateways, military uplink facilities, and data reception centers.</p>
                  <div className="grid grid-cols-2 gap-2">
                    {["SIGINT collection sites", "Starlink gateway stations", "Military uplink facilities", "Data reception centers", "Deep Space Network (DSN)", "ESA ground stations"].map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                        <Wifi size={10} className="text-cyan-400" />{f}
                      </div>
                    ))}
                  </div>
                </div>
              )},
            ]} />

            <InfoBox isLight={isLight} type="warning" title="Data Freshness">
              TLE data is updated every 6 hours from CelesTrak. For highly accurate pass predictions, ensure TLE age is under 24 hours. Older TLEs may produce position errors of several kilometers.
            </InfoBox>
          </section>

          {/* ═══ SIGINT MODULE ════════════════════════════════════ */}
          <section id="doc-sigint" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Radio size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">SIGINT Module</h1>
                <p className="text-xs text-gray-500 font-mono">Signal intelligence & geospatial monitoring</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-amber-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              The SIGINT module fuses multiple open-source signal layers into a unified geospatial picture.
              All data sources are publicly accessible open-source resources for OSINT research purposes.
            </p>

            <InfoBox isLight={isLight} type="danger" title="OSINT Disclaimer">
              All CCTV feeds and data streams are from publicly accessible open-source resources (TfL JamCam API, ASFINAG, YouTube Live, Windy Webcams). Redroom and Owlink.ai bear no responsibility for misuse. For authorized OSINT research only.
            </InfoBox>

            <div className={`overflow-x-auto rounded-lg border my-6 ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <table className="w-full text-xs">
                <thead><tr className={isLight ? "bg-gray-100" : "bg-[#0c0e14]"}>
                  <th className={`text-left py-3 px-4 font-normal ${isLight ? "text-gray-500" : "text-gray-500"}`}>Layer</th>
                  <th className={`text-left py-3 px-4 font-normal ${isLight ? "text-gray-500" : "text-gray-500"}`}>Source</th>
                  <th className={`text-left py-3 px-4 font-normal ${isLight ? "text-gray-500" : "text-gray-500"}`}>Update Rate</th>
                  <th className={`text-left py-3 px-4 font-normal ${isLight ? "text-gray-500" : "text-gray-500"}`}>Coverage</th>
                  <th className={`text-left py-3 px-4 font-normal ${isLight ? "text-gray-500" : "text-gray-500"}`}>Auth</th>
                </tr></thead>
                <tbody>
                  {[
                    ["ADS-B Flights",    "OpenSky Network",      "5 seconds",    "Global",          "Optional"],
                    ["AIS Vessels",      "AISStream.io",         "Real-time",    "Global maritime", "API Key"],
                    ["CCTV / OSINT",     "TfL, ASFINAG, YouTube","Live stream",  "Multi-country",   "None"],
                    ["Seismic",          "USGS / EMSC",          "Real-time",    "Global",          "None"],
                    ["Weather",          "OpenWeatherMap",       "15 minutes",   "Global",          "API Key"],
                    ["Fires",            "NASA FIRMS",           "3 hours",      "Global",          "None"],
                    ["Space Weather",    "NOAA SWPC",            "1 hour",       "Solar system",    "None"],
                  ].map(([layer, source, rate, coverage, auth], i) => (
                    <tr key={i} className={`border-t transition-colors ${isLight ? "border-gray-100 hover:bg-gray-50" : "border-gray-800/30 hover:bg-white/2"}`}>
                      <td className={`py-2.5 px-4 font-medium ${isLight ? "text-gray-900" : "text-white"}`}>{layer}</td>
                      <td className={`py-2.5 px-4 font-mono ${isLight ? "text-cyan-700" : "text-cyan-400"}`}>{source}</td>
                      <td className={`py-2.5 px-4 ${isLight ? "text-gray-600" : "text-gray-400"}`}>{rate}</td>
                      <td className={`py-2.5 px-4 ${isLight ? "text-gray-500" : "text-gray-500"}`}>{coverage}</td>
                      <td className="py-2.5 px-4">
                        <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded border ${auth === "None" ? (isLight ? "text-green-700 border-green-300 bg-green-50" : "text-green-400 border-green-500/30 bg-green-500/5") : (isLight ? "text-amber-700 border-amber-300 bg-amber-50" : "text-amber-400 border-amber-500/30 bg-amber-500/5")}`}>{auth}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <CodeBlock isLight={isLight} title="SIGINT Query Examples" language="typescript" code={`// Get military flights in a bounding box
const { data: flights } = trpc.sigint.flights.useQuery({
  bounds: { north: 55, south: 45, east: 40, west: 20 },
  military: true,
});

// List CCTV cameras in London
const { data: cameras } = trpc.sigint.cameras.useQuery({
  country: "GB",
  type: "tfl",
  bounds: { north: 51.7, south: 51.3, east: 0.1, west: -0.5 },
});

// Get vessels in the Strait of Hormuz
const { data: vessels } = trpc.sigint.vessels.useQuery({
  bounds: { north: 27, south: 24, east: 58, west: 55 },
  type: "tanker",
});`} />
          </section>

          {/* ═══ SURVEILLANCE MODE ════════════════════════════════ */}
          <section id="doc-surveillance" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Eye size={20} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Surveillance Mode (SVM)</h1>
                <p className="text-xs text-gray-500 font-mono">Multi-target real-time tracking</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-green-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Surveillance Mode (SVM) is a dedicated tracking interface that allows operators to monitor
              up to 10 objects simultaneously across all intelligence layers. Each tracked object gets
              a dedicated panel with live data, alerts, and history.
            </p>

            <InfoBox isLight={isLight} type="warning" title="Operational Security">
              SVM is designed for authorized intelligence operations only. All tracking activities are logged and auditable. Ensure compliance with applicable laws and regulations in your jurisdiction.
            </InfoBox>

            <h3 className="text-lg font-bold mt-8 mb-4">Trackable Object Types</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
              {[
                { label: "Aircraft (ADS-B)", desc: "Route visualization, origin-destination arcs" },
                { label: "Vessels (AIS)", desc: "Path history, port predictions" },
                { label: "Satellites (TLE)", desc: "Live position, pass countdown" },
                { label: "CCTV Cameras", desc: "Multi-feed live view" },
                { label: "Facilities", desc: "News feed, threat score" },
                { label: "Custom Markers", desc: "User-defined tracking points" },
              ].map((item, i) => (
                <div key={i} className={`p-3 rounded-lg border ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={10} className="text-green-500" />
                    <span className={`text-xs font-semibold ${isLight ? "text-gray-900" : "text-white"}`}>{item.label}</span>
                  </div>
                  <div className={`text-[11px] pl-4 ${isLight ? "text-gray-500" : "text-gray-500"}`}>{item.desc}</div>
                </div>
              ))}
            </div>

            <CodeBlock isLight={isLight} title="SVM Panel Structure" language="text" code={`┌─────────────────────────────────────────────────────┐
│  SVM HEADER — Active targets: 3/10 · Alert: 1 active │
├──────────────┬──────────────┬──────────────┬─────────┤
│  Target 1    │  Target 2    │  Target 3    │  + Add  │
│  [Aircraft]  │  [Camera]    │  [Vessel]    │  Target │
│  FL-UAE123   │  TfL-A4-001  │  MMSI:12345  │         │
│  Alt: 35,000 │  [Live Feed] │  12.4 knots  │         │
│  Speed: 480  │              │  Heading: NE │         │
├──────────────┴──────────────┴──────────────┴─────────┤
│  SHARED MAP — All tracked objects overlaid            │
│  [ Aircraft route ] [ Vessel track ] [ Camera pin ]   │
└─────────────────────────────────────────────────────┘`} />
          </section>

          {/* ═══ NARRATIVES & FIMI ════════════════════════════════ */}
          <section id="doc-narratives" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Network size={20} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Narratives & FIMI</h1>
                <p className="text-xs text-gray-500 font-mono">Information operations tracking</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-purple-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              The Narratives module tracks information operations, propaganda campaigns, and Foreign Information
              Manipulation and Interference (FIMI) with spread analysis, actor attribution, and interactive
              connection graphs.
            </p>

            <div className={`overflow-x-auto rounded-lg border mb-6 ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <table className="w-full text-xs">
                <thead><tr className={isLight ? "bg-gray-100" : "bg-[#0c0e14]"}>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Type</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Description</th>
                  <th className="text-left py-3 px-4 text-gray-500 font-normal">Detection Method</th>
                </tr></thead>
                <tbody>
                  {[
                    ["FIMI",         "Foreign Information Manipulation & Interference", "Cross-source amplification pattern analysis"],
                    ["Propaganda",   "State-sponsored messaging campaigns",             "Source attribution + narrative consistency scoring"],
                    ["Disinformation","Deliberately false information spread",          "Fact-check cross-reference + credibility scoring"],
                    ["Coordinated",  "Coordinated inauthentic behavior",               "Timing correlation + actor network analysis"],
                    ["Organic",      "Naturally spreading narratives",                 "Baseline comparison + source diversity check"],
                    ["Breaking",     "Rapidly developing news events",                 "Volume spike detection + real-time monitoring"],
                  ].map(([type, desc, method], i) => (
                    <tr key={i} className={`border-t transition-colors ${isLight ? "border-gray-100 hover:bg-gray-50" : "border-gray-800/30 hover:bg-white/2"}`}>
                      <td className={`py-2.5 px-4 font-mono font-bold ${isLight ? "text-purple-700" : "text-purple-400"}`}>{type}</td>
                      <td className={`py-2.5 px-4 ${isLight ? "text-gray-700" : "text-gray-300"}`}>{desc}</td>
                      <td className={`py-2.5 px-4 ${isLight ? "text-gray-500" : "text-gray-500"}`}>{method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3 className="text-lg font-bold mt-8 mb-4">Connection Graph Features</h3>
            <div className="grid grid-cols-2 gap-2">
              {["Force-directed layout with collision avoidance", "Scroll/pinch zoom + pan", "Drag nodes to reposition", "Click to select with detail panel", "Hover highlights connected subgraph", "Per-type filter toggles", "Fullscreen investigation mode", "Color-coded directional arrowheads"].map((f, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 size={10} className="text-purple-400" />{f}
                </div>
              ))}
            </div>
          </section>

          {/* ═══ DATA MODELS ══════════════════════════════════════ */}
          <section id="doc-data-models" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Database size={20} className="text-purple-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Data Models</h1>
                <p className="text-xs text-gray-500 font-mono">Entity schemas & relationships — click to expand</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-purple-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Redroom uses a relational data model with Drizzle ORM on TiDB/MySQL. All timestamps are stored
              as UTC milliseconds since epoch. Click any model below to expand its field definitions.
            </p>

            <div className="space-y-2">
              {dataModels.map((model, i) => (
                <DataModelCard key={i} isLight={isLight} name={model.name} description={model.description} fields={model.fields} />
              ))}
            </div>

            <h3 className="text-lg font-bold mt-8 mb-4">Entity Relationships</h3>
            <CodeBlock isLight={isLight} title="Core Relationships" language="text" code={`Article ──────────────── Source (many-to-one)
Article ──────────────── Entity (many-to-many via article_entities)
Article ──────────────── Facility (many-to-many via article_facility_links)
Article ──────────────── Narrative (many-to-many via narrative_articles)
Entity ───────────────── Entity (many-to-many via entity_connections)
Narrative ────────────── Entity (actors, targets — many-to-many)
Facility ─────────────── Country (many-to-one)
Alert ────────────────── User (many-to-one)
Investigation ────────── User (many-to-one)`} />
          </section>

          {/* ═══ API REFERENCE ════════════════════════════════════ */}
          <section id="doc-api-reference" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Code size={20} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">API Reference</h1>
                <p className="text-xs text-gray-500 font-mono">Endpoints, parameters & responses — click to expand</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-blue-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-4 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Redroom exposes a tRPC-based API under <code className="text-cyan-400 bg-cyan-500/10 px-1.5 py-0.5 rounded text-xs">/api/trpc</code>.
              All endpoints accept JSON input and return typed JSON responses. Click any endpoint to expand its details.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className={`p-3 rounded-lg border text-center ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                <div className={`text-lg font-black ${isLight ? "text-gray-900" : "text-white"}`}>{apiEndpoints.length}</div>
                <div className="text-[10px] font-mono text-gray-500">Endpoints</div>
              </div>
              <div className={`p-3 rounded-lg border text-center ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                <div className={`text-lg font-black ${isLight ? "text-green-600" : "text-green-400"}`}>{apiEndpoints.filter(e => !e.auth).length}</div>
                <div className="text-[10px] font-mono text-gray-500">Public</div>
              </div>
              <div className={`p-3 rounded-lg border text-center ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                <div className={`text-lg font-black ${isLight ? "text-amber-600" : "text-amber-400"}`}>{apiEndpoints.filter(e => e.auth).length}</div>
                <div className="text-[10px] font-mono text-gray-500">Protected</div>
              </div>
            </div>

            <InfoBox isLight={isLight} type="info" title="Authentication">
              Protected endpoints require a valid session cookie set via OAuth login, or a Bearer token in the Authorization header: <code className="text-cyan-400 text-xs">Authorization: Bearer &lt;token&gt;</code>
            </InfoBox>

            <CodeBlock isLight={isLight} title="Base URLs" language="text" code={`Production:   https://redroom.live/api/trpc
Self-hosted:  https://your-domain.com/api/trpc
Development:  http://localhost:3000/api/trpc`} />

            <div className="space-y-2 mt-6">
              {apiEndpoints.map((ep, i) => (
                <APIEndpointCard key={i} isLight={isLight} {...ep} />
              ))}
            </div>
          </section>

          {/* ═══ AUTHENTICATION & SECURITY ════════════════════════ */}
          <section id="doc-authentication" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Shield size={20} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Authentication & Security</h1>
                <p className="text-xs text-gray-500 font-mono">Access control & data protection</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-green-500/30 to-transparent mb-8" />

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Auth Flow", icon: Key, content: (
                <div className="space-y-4">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>Redroom uses OAuth2 for authentication with JWT session cookies. The flow is fully stateless on the server side.</p>
                  <CodeBlock isLight={isLight} title="OAuth2 Flow" language="text" code={`1. User clicks Login
   → Frontend redirects to OAuth2 provider with state param
   → State encodes: origin + returnPath (base64)

2. OAuth2 provider authenticates user
   → Redirects to /api/oauth/callback?code=...&state=...

3. Server validates code with provider
   → Exchanges for access token
   → Fetches user profile
   → Creates/updates user record in DB
   → Signs JWT with user ID + role + expiry
   → Sets httpOnly session cookie

4. Subsequent requests
   → Cookie sent automatically by browser
   → Server extracts user from JWT → ctx.user
   → protectedProcedure gates access by role

5. Logout
   → POST /api/trpc/auth.logout
   → Server clears session cookie`} />
                </div>
              )},
              { label: "RBAC", icon: Lock, content: (
                <div className="space-y-4">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>Role-Based Access Control with four tiers. Roles are stored in the user database record and checked server-side on every protected procedure.</p>
                  <div className={`overflow-x-auto rounded-lg border ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
                    <table className="w-full text-xs">
                      <thead><tr className={isLight ? "bg-gray-100" : "bg-[#0c0e14]"}>
                        <th className="text-left py-3 px-4 text-gray-500 font-normal">Role</th>
                        <th className="text-left py-3 px-4 text-gray-500 font-normal">Capabilities</th>
                      </tr></thead>
                      <tbody>
                        {[
                          ["admin",  "All features + CMS + user management + system config + audit logs"],
                          ["user",   "All intelligence features + personal settings + alerts + saved investigations"],
                          ["viewer", "Read-only access to intelligence feeds and public dashboards"],
                          ["api",    "Programmatic access with rate limits + webhook registration"],
                        ].map(([role, caps], i) => (
                          <tr key={i} className={`border-t ${isLight ? "border-gray-100" : "border-gray-800/30"}`}>
                            <td className={`py-2.5 px-4 font-mono ${isLight ? "text-cyan-700" : "text-cyan-400"}`}>{role}</td>
                            <td className={`py-2.5 px-4 ${isLight ? "text-gray-600" : "text-gray-400"}`}>{caps}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <CodeBlock isLight={isLight} title="Server-side Role Guard" language="typescript" code={`// In server/routers.ts
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

// Usage
adminOnlyAction: adminProcedure
  .input(z.object({ ... }))
  .mutation(async ({ ctx, input }) => {
    // Only admins reach here
  }),`} />
                </div>
              )},
              { label: "Security", icon: Shield, content: (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {[
                    { title: "AES-256 Encryption", desc: "All sensitive data encrypted at rest and in transit (TLS 1.3)" },
                    { title: "JWT Sessions", desc: "Stateless authentication, configurable expiry (default: 7 days)" },
                    { title: "Rate Limiting", desc: "Per-user and per-IP limits: 100 req/min public, 1000 req/min authenticated" },
                    { title: "Audit Logging", desc: "Complete audit trail of all admin actions with user, timestamp, and diff" },
                    { title: "Input Validation", desc: "Zod schema validation on all tRPC inputs — no raw SQL or unvalidated data" },
                    { title: "CORS Policy", desc: "Strict origin-based access control, no wildcard origins in production" },
                    { title: "HMAC Webhooks", desc: "All webhook payloads signed with HMAC-SHA256 for delivery verification" },
                    { title: "Secret Routes", desc: "Admin CMS path is configurable via env vars — never hardcoded in source" },
                  ].map((item, i) => (
                    <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                      <Fingerprint size={14} className="text-green-500 shrink-0 mt-0.5" />
                      <div>
                        <div className={`text-xs font-semibold ${isLight ? "text-gray-900" : "text-white"}`}>{item.title}</div>
                        <div className={`text-[11px] ${isLight ? "text-gray-500" : "text-gray-500"}`}>{item.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )},
            ]} />
          </section>

          {/* ═══ AI ENRICHMENT ════════════════════════════════════ */}
          <section id="doc-enrichment" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-pink-500/10 border border-pink-500/30 flex items-center justify-center">
                <Sparkles size={20} className="text-pink-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">AI Enrichment Pipeline</h1>
                <p className="text-xs text-gray-500 font-mono">Automated intelligence enrichment</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-pink-500/30 to-transparent mb-8" />

            <p className={`leading-relaxed mb-6 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
              Every article ingested by Redroom passes through a multi-stage AI enrichment pipeline that
              extracts entities, scores credibility, classifies topics, and generates summaries — all
              within seconds of ingestion.
            </p>

            <CodeBlock isLight={isLight} title="Enrichment Pipeline" language="text" code={`Article Ingested
    │
    ▼
[Stage 1] Language Detection
    → Detect language, normalize encoding
    │
    ▼
[Stage 2] Entity Extraction (LLM)
    → People, Organizations, Locations, Events
    → Confidence scores per entity
    │
    ▼
[Stage 3] Topic Classification
    → politics | security | economy | tech | energy | society | military | cyber
    → Multi-label classification
    │
    ▼
[Stage 4] Sentiment Analysis
    → positive | negative | neutral
    → Sentiment score (-1.0 to +1.0)
    │
    ▼
[Stage 5] Credibility Scoring
    → Source reliability (0-100)
    → Cross-reference with other sources
    → Final credibility score (0-100)
    │
    ▼
[Stage 6] Impact Scoring
    → Geopolitical significance (0-100)
    → Region relevance weighting
    │
    ▼
[Stage 7] Summary Generation (LLM)
    → 2-sentence executive summary
    │
    ▼
[Stage 8] Threat Tier Assignment
    → FLASH | CRITIC | PRIORITY | ROUTINE
    │
    ▼
Article Stored + Indexed`} />

            <CodeBlock isLight={isLight} title="Enrichment Schema" language="typescript" code={`interface EnrichmentResult {
  entities: {
    people: string[];
    organizations: string[];
    locations: string[];
    events: string[];
  };
  topics: string[];
  sentiment: "positive" | "negative" | "neutral";
  sentimentScore: number;    // -1.0 to +1.0
  summary: string;
  keywords: string[];
  threatIndicators: string[];
  credibilityFactors: {
    hasSourceCitation: boolean;
    hasMultipleSources: boolean;
    hasDateContext: boolean;
    hasNamedSources: boolean;
  };
}`} />
          </section>

          {/* ═══ CONFIGURATION ════════════════════════════════════ */}
          <section id="doc-configuration" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Boxes size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Configuration</h1>
                <p className="text-xs text-gray-500 font-mono">Customization & environment setup</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-amber-500/30 to-transparent mb-8" />

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Environment", icon: Settings, content: (
                <CodeBlock isLight={isLight} title=".env — Full Reference" language="bash" code={`# ── Database (required) ──────────────────────────────
DATABASE_URL=mysql://user:password@host:4000/redroom

# ── Authentication (required) ────────────────────────
JWT_SECRET=your-256-bit-secret-key-here
OAUTH_SERVER_URL=https://your-oauth-provider.com
VITE_OAUTH_PORTAL_URL=https://your-oauth-provider.com/login
VITE_APP_ID=your-oauth-app-id

# ── Storage (required for file uploads) ──────────────
S3_ENDPOINT=https://s3.amazonaws.com
S3_BUCKET=your-bucket-name
S3_REGION=us-east-1
S3_ACCESS_KEY=AKIAIOSFODNN7EXAMPLE
S3_SECRET_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY

# ── External APIs (optional) ─────────────────────────
OPENSKY_USERNAME=your-opensky-username
OPENSKY_PASSWORD=your-opensky-password
AISSTREAM_API_KEY=your-aisstream-key

# ── AI/LLM (optional — enables enrichment) ───────────
LLM_API_URL=https://api.openai.com/v1
LLM_API_KEY=sk-your-openai-key
LLM_MODEL=gpt-4o-mini

# ── Admin (required) ─────────────────────────────────
ADMIN_SECRET_KEY=your-admin-secret`} />
              )},
              { label: "Modules", icon: Layers, content: (
                <CodeBlock isLight={isLight} title="Module Configuration" language="typescript" code={`// shared/config.ts
export const modules = {
  news:          true,  // Core intelligence feed (required)
  orbit:         true,  // Satellite tracking
  sigint:        true,  // Signal intelligence
  narratives:    true,  // Narrative/FIMI tracking
  surveillance:  true,  // SVM multi-tracking mode
  facilities:    true,  // Facility management
  alerts:        true,  // Alert trigger system
  analytics:     true,  // Analytics dashboards
  adminCMS:      true,  // Admin content management
};`} />
              )},
              { label: "Sources", icon: Plug, content: (
                <CodeBlock isLight={isLight} title="Add Custom Source" language="typescript" code={`// Add a new RSS source via tRPC
await trpc.sources.create.mutate({
  name: "Reuters World News",
  url: "https://www.reuters.com",
  rssUrl: "https://feeds.reuters.com/reuters/worldNews",
  type: "rss",
  refreshInterval: 300, // 5 minutes
  categories: ["politics", "security"],
  reliability: 95,
  language: "en",
  country: "GB",
});`} />
              )},
            ]} />
          </section>

          {/* ═══ DEPLOYMENT ═══════════════════════════════════════ */}
          <section id="doc-deployment" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Server size={20} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Deployment</h1>
                <p className="text-xs text-gray-500 font-mono">Self-hosted, cloud & sovereign options</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-blue-500/30 to-transparent mb-8" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
              {[
                { title: "Cloud (Managed)", desc: "Deploy to any cloud provider. Supports Railway, Render, Fly.io, AWS, GCP, Azure.", icon: Globe, badge: "Recommended" },
                { title: "Self-Hosted", desc: "Run on your own infrastructure with Docker Compose or Kubernetes.", icon: Server, badge: "Full Control" },
                { title: "Sovereign / Air-Gapped", desc: "Fully offline deployment for classified environments with no external dependencies.", icon: Shield, badge: "Max Security" },
              ].map((opt, i) => (
                <div key={i} className={`p-4 rounded-lg border ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0a0c12]"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <opt.icon size={18} className={isLight ? "text-blue-600" : "text-blue-400"} />
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${isLight ? "bg-blue-50 text-blue-600 border-blue-200" : "bg-blue-500/10 text-blue-400 border-blue-500/20"}`}>{opt.badge}</span>
                  </div>
                  <div className={`text-sm font-bold mb-1 ${isLight ? "text-gray-900" : "text-white"}`}>{opt.title}</div>
                  <div className={`text-xs ${isLight ? "text-gray-500" : "text-gray-500"}`}>{opt.desc}</div>
                </div>
              ))}
            </div>

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Docker", icon: Server, content: (
                <CodeBlock isLight={isLight} title="docker-compose.yml" language="yaml" code={`version: '3.8'
services:
  redroom:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://root:password@db:3306/redroom
      - JWT_SECRET=\${JWT_SECRET}
      - NODE_ENV=production
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: redroom
    volumes:
      - db_data:/var/lib/mysql
    ports:
      - "3306:3306"

volumes:
  db_data:`} />
              )},
              { label: "Production Build", icon: Rocket, content: (
                <CodeBlock isLight={isLight} title="Build & Deploy" language="bash" code={`# Build for production
pnpm build

# Run production server
NODE_ENV=production node dist/server/index.js

# Or with PM2 for process management
pm2 start dist/server/index.js --name redroom
pm2 save
pm2 startup`} />
              )},
              { label: "Health Checks", icon: Activity, content: (
                <CodeBlock isLight={isLight} title="Health Endpoints" language="bash" code={`# Server health
GET /api/health
→ { status: "ok", version: "2.4.0", uptime: 3600 }

# Database connectivity
GET /api/health/db
→ { status: "ok", latency: 12 }

# External sources status
GET /api/health/sources
→ { active: 487, failing: 3, total: 500 }`} />
              )},
            ]} />
          </section>

          {/* ═══ CONTRIBUTING ═════════════════════════════════════ */}
          <section id="doc-contributing" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Users size={20} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Contributing</h1>
                <p className="text-xs text-gray-500 font-mono">How to contribute to Redroom</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-green-500/30 to-transparent mb-8" />

            <InfoBox isLight={isLight} type="success" title="Open Source">
              Redroom is MIT-licensed and welcomes contributions. Whether you're fixing a bug, adding a data source, or building a new intelligence module — all contributions are valued.
            </InfoBox>

            <FeatureTabs isLight={isLight} tabs={[
              { label: "Getting Started", icon: Rocket, content: (
                <CodeBlock isLight={isLight} title="Fork & Develop" language="bash" code={`# Fork on GitHub, then:
git clone https://github.com/Owlinkai/redroom.git
cd redroom

# Create a feature branch
git checkout -b feature/my-new-feature

# Install dependencies
pnpm install

# Start development
pnpm dev

# Run tests
pnpm test

# Submit a pull request to main branch`} />
              )},
              { label: "Code Standards", icon: List, content: (
                <div className={`space-y-3 text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      "TypeScript strict mode — no any types without justification",
                      "tRPC for all client-server communication — no raw fetch/axios",
                      "Zod schemas for all inputs — validate at the boundary",
                      "Drizzle ORM for all database access — no raw SQL",
                      "Vitest for unit tests — cover new server procedures",
                      "Tailwind CSS for styling — no inline styles",
                      "Lucide React for icons — consistent icon library",
                      "Conventional commits: feat/fix/docs/chore/refactor",
                    ].map((rule, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-gray-400">
                        <CheckCircle2 size={10} className="text-green-400 shrink-0 mt-0.5" />{rule}
                      </div>
                    ))}
                  </div>
                </div>
              )},
              { label: "Adding Sources", icon: Plug, content: (
                <div className="space-y-3">
                  <p className={`text-sm ${isLight ? "text-gray-700" : "text-gray-300"}`}>The easiest way to contribute is adding new intelligence sources. Sources are defined in the Admin CMS or via the sources API.</p>
                  <CodeBlock isLight={isLight} title="Source Contribution" language="typescript" code={`// 1. Add source definition to server/data/sources.ts
export const newSource: SourceDefinition = {
  name: "Example Intelligence",
  url: "https://example-intel.com",
  rssUrl: "https://example-intel.com/feed.rss",
  type: "rss",
  reliability: 80,
  categories: ["security", "military"],
  language: "en",
  country: "US",
};

// 2. Test the source crawl
pnpm test:source --url https://example-intel.com/feed.rss

// 3. Submit PR with source definition + test results`} />
                </div>
              )},
            ]} />
          </section>

          {/* ═══ CHANGELOG ════════════════════════════════════════ */}
          <section id="doc-changelog" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gray-500/10 border border-gray-500/30 flex items-center justify-center">
                <GitBranch size={20} className="text-gray-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Changelog</h1>
                <p className="text-xs text-gray-500 font-mono">Release history</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-gray-500/30 to-transparent mb-8" />

            <div className="space-y-4">
              {changelog.map((release, i) => (
                <div key={i} className={`rounded-xl border overflow-hidden ${release.type === "major" ? "border-red-500/20" : (isLight ? "border-gray-200" : "border-gray-800/40")}`}>
                  <div className={`px-5 py-3 flex items-center gap-3 ${release.type === "major" ? "bg-red-500/5" : (isLight ? "bg-gray-100" : "bg-[#0c0e14]")}`}>
                    <span className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${release.type === "major" ? "text-red-500 border-red-400/30 bg-red-50" : (isLight ? "text-gray-600 border-gray-300 bg-gray-50" : "text-gray-500 border-gray-700/40 bg-gray-800/30")}`}>
                      v{release.version}
                    </span>
                    <span className={`text-sm font-bold flex-1 ${isLight ? "text-gray-900" : "text-white"}`}>{release.title}</span>
                    <span className={`text-[10px] font-mono ${isLight ? "text-gray-400" : "text-gray-600"}`}>{release.date}</span>
                  </div>
                  <div className={`p-4 ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                      {release.changes.map((change, j) => (
                        <div key={j} className={`flex items-start gap-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                          <ArrowUpRight size={10} className={`shrink-0 mt-0.5 ${release.type === "major" ? "text-red-500" : (isLight ? "text-gray-400" : "text-gray-600")}`} />
                          {change}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ═══ ROADMAP ══════════════════════════════════════════ */}
          <section id="doc-roadmap" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <BarChart3 size={20} className="text-amber-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Roadmap</h1>
                <p className="text-xs text-gray-500 font-mono">Planned features & development priorities</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-amber-500/30 to-transparent mb-8" />

            <div className="space-y-6">
              {[
                { quarter: "Q3 2026", status: "In Progress", items: [
                  "Redroom Mobile (iOS/Android native apps)",
                  "Collaborative investigations (multi-user shared graphs)",
                  "Automated threat assessment reports (scheduled delivery)",
                  "Source credibility crowdsourcing (community ratings)",
                  "SIGINT RF spectrum monitoring (SDR integration)",
                ]},
                { quarter: "Q4 2026", status: "Planned", items: [
                  "Redroom API v2 (REST + GraphQL alongside tRPC)",
                  "AI agent workflows (autonomous monitoring & alerting)",
                  "Dark web OSINT integration (Tor-accessible sources)",
                  "Satellite imagery analysis (change detection)",
                  "Multi-tenant enterprise deployment (org isolation)",
                ]},
                { quarter: "Q1 2027", status: "Research", items: [
                  "Predictive threat modeling (ML-based forecasting)",
                  "Biometric entity tracking (face/voice recognition OSINT)",
                  "Quantum-resistant encryption upgrade",
                  "Federated intelligence sharing (inter-org P2P sync)",
                ]},
              ].map((quarter, i) => (
                <div key={i} className={`rounded-xl border overflow-hidden ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
                  <div className={`px-5 py-3 flex items-center gap-3 ${isLight ? "bg-gray-100" : "bg-[#0c0e14]"}`}>
                    <span className={`text-sm font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{quarter.quarter}</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                      quarter.status === "In Progress" ? (isLight ? "text-green-700 border-green-300 bg-green-50" : "text-green-400 border-green-500/30 bg-green-500/10") :
                      quarter.status === "Planned" ? (isLight ? "text-amber-700 border-amber-300 bg-amber-50" : "text-amber-400 border-amber-500/30 bg-amber-500/10") :
                      (isLight ? "text-gray-500 border-gray-300 bg-gray-50" : "text-gray-500 border-gray-700/40 bg-gray-800/30")
                    }`}>{quarter.status}</span>
                  </div>
                  <div className={`p-4 ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <div className="space-y-1.5">
                      {quarter.items.map((item, j) => (
                        <div key={j} className={`flex items-center gap-2 text-xs ${isLight ? "text-gray-600" : "text-gray-400"}`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${quarter.status === "In Progress" ? "bg-green-500" : quarter.status === "Planned" ? "bg-amber-500" : (isLight ? "bg-gray-400" : "bg-gray-600")}`} />
                          {item}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Threat Intelligence ─────────────────────────────── */}
          <section id="doc-threat-intel" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <Target size={20} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Threat Intelligence</h1>
                <p className="text-xs text-gray-500 font-mono">Scoring, IOC types, MITRE ATT&CK mapping</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-red-500/30 to-transparent mb-8" />
            <p className={`text-sm leading-relaxed mb-6 ${isLight ? "text-gray-600" : "text-gray-400"}`}>
              Redroom's Threat Intelligence layer enriches every article and signal with a composite threat score, entity extraction, and MITRE ATT&CK tactic mapping. Scores above 75 trigger automatic SIGINT alerts and can be routed to webhooks or SIEM integrations.
            </p>
            <div className={`rounded-xl border overflow-hidden mb-6 ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`px-5 py-3 text-xs font-bold font-mono ${isLight ? "bg-gray-100 text-gray-700" : "bg-[#0c0e14] text-gray-300"}`}>COMPOSITE THREAT SCORE — WEIGHT BREAKDOWN</div>
              <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-800/30"}`}>
                {[
                  { factor: "Source Credibility", weight: "30%", desc: "Credibility rating of the originating source (0–100 scale, updated weekly)" },
                  { factor: "Sentiment Intensity", weight: "25%", desc: "NLP-derived hostility/urgency score from article text and headline" },
                  { factor: "Entity Prominence", weight: "20%", desc: "Importance of named entities (heads of state, military assets, critical infrastructure)" },
                  { factor: "Geographic Proximity", weight: "15%", desc: "Distance from user-defined AOI or watched regions" },
                  { factor: "Temporal Recency", weight: "10%", desc: "Exponential decay applied to events older than 6 hours" },
                ].map((row, i) => (
                  <div key={i} className={`px-5 py-3 flex items-start gap-4 text-xs ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <span className={`font-mono font-bold text-red-400 w-8 shrink-0`}>{row.weight}</span>
                    <span className={`font-semibold w-36 shrink-0 ${isLight ? "text-gray-800" : "text-gray-200"}`}>{row.factor}</span>
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>{row.desc}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={`rounded-xl border overflow-hidden mb-6 ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`px-5 py-3 text-xs font-bold font-mono ${isLight ? "bg-gray-100 text-gray-700" : "bg-[#0c0e14] text-gray-300"}`}>IOC TYPES SUPPORTED</div>
              <div className={`p-5 grid grid-cols-2 md:grid-cols-3 gap-3 ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                {[
                  { type: "IP Address", icon: "⬡", color: "text-cyan-400" },
                  { type: "Domain / URL", icon: "⬡", color: "text-blue-400" },
                  { type: "File Hash (MD5/SHA256)", icon: "⬡", color: "text-purple-400" },
                  { type: "Email Address", icon: "⬡", color: "text-green-400" },
                  { type: "CVE Identifier", icon: "⬡", color: "text-red-400" },
                  { type: "YARA Rule Match", icon: "⬡", color: "text-amber-400" },
                  { type: "Bitcoin Address", icon: "⬡", color: "text-orange-400" },
                  { type: "Phone Number", icon: "⬡", color: "text-pink-400" },
                  { type: "Geolocation Coordinate", icon: "⬡", color: "text-teal-400" },
                ].map((ioc, i) => (
                  <div key={i} className={`flex items-center gap-2 text-xs px-3 py-2 rounded-lg border ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0c0e14]"}`}>
                    <span className={ioc.color}>{ioc.icon}</span>
                    <span className={isLight ? "text-gray-700" : "text-gray-300"}>{ioc.type}</span>
                  </div>
                ))}
              </div>
            </div>
            <InfoBox type="info" isLight={isLight}>MITRE ATT&CK mapping is performed automatically for articles mentioning known TTPs. Each article card shows up to 3 tactic tags (e.g., T1566 Phishing, T1078 Valid Accounts). Full ATT&CK Navigator export is available in Enterprise tier.</InfoBox>
          </section>

          {/* ─── Webhooks & Integrations ─────────────────────────────── */}
          <section id="doc-webhooks" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <Plug size={20} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Webhooks & Integrations</h1>
                <p className="text-xs text-gray-500 font-mono">Slack, Teams, PagerDuty, SIEM connectors</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-green-500/30 to-transparent mb-8" />
            <p className={`text-sm leading-relaxed mb-6 ${isLight ? "text-gray-600" : "text-gray-400"}`}>
              Redroom supports outbound webhooks for all major event types. Configure target URLs in Settings → Integrations → Webhooks. All payloads are signed with HMAC-SHA256 and delivered within 500ms of event detection.
            </p>
            <CodeBlock title="WEBHOOK PAYLOAD — new_article" isLight={isLight} code={`POST https://your-endpoint.com/redroom-hook\nContent-Type: application/json\nX-Redroom-Signature: sha256=<hmac>\n\n{\n  "event": "new_article",\n  "timestamp": 1720000000000,\n  "data": {\n    "id": "art_abc123",\n    "title": "...",\n    "threatScore": 82,\n    "region": "Middle East",\n    "entities": ["Iran", "IRGC"],\n    "url": "https://redroom.live/intel/art_abc123"\n  }\n}`} />
            <div className={`rounded-xl border overflow-hidden mt-6 ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`px-5 py-3 text-xs font-bold font-mono ${isLight ? "bg-gray-100 text-gray-700" : "bg-[#0c0e14] text-gray-300"}`}>SUPPORTED INTEGRATIONS</div>
              <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-800/30"}`}>
                {[
                  { name: "Slack", type: "Webhook", events: "All events", tier: "Free" },
                  { name: "Microsoft Teams", type: "Webhook", events: "All events", tier: "Free" },
                  { name: "PagerDuty", type: "API", events: "threat_alert, sigint_intercept", tier: "Pro" },
                  { name: "Splunk SIEM", type: "HTTP Event Collector", events: "All events", tier: "Enterprise" },
                  { name: "Elastic SIEM", type: "Logstash HTTP Input", events: "All events", tier: "Enterprise" },
                  { name: "IBM QRadar", type: "Syslog / CEF", events: "threat_alert", tier: "Enterprise" },
                  { name: "Custom Webhook", type: "HTTP POST", events: "Configurable", tier: "Free" },
                ].map((row, i) => (
                  <div key={i} className={`px-5 py-3 grid grid-cols-4 gap-4 text-xs ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <span className={`font-semibold ${isLight ? "text-gray-800" : "text-gray-200"}`}>{row.name}</span>
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>{row.type}</span>
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>{row.events}</span>
                    <span className={`font-mono text-[10px] px-2 py-0.5 rounded border w-fit ${
                      row.tier === "Free" ? (isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-500/30 bg-green-500/10 text-green-400") :
                      row.tier === "Pro" ? (isLight ? "border-blue-300 bg-blue-50 text-blue-700" : "border-blue-500/30 bg-blue-500/10 text-blue-400") :
                      (isLight ? "border-amber-300 bg-amber-50 text-amber-700" : "border-amber-500/30 bg-amber-500/10 text-amber-400")
                    }`}>{row.tier}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── Rate Limits & Quotas ─────────────────────────────────── */}
          <section id="doc-rate-limits" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Activity size={20} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Rate Limits & Quotas</h1>
                <p className="text-xs text-gray-500 font-mono">API usage limits by tier</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-blue-500/30 to-transparent mb-8" />
            <div className={`rounded-xl border overflow-hidden ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`px-5 py-3 grid grid-cols-5 gap-4 text-[10px] font-bold font-mono ${isLight ? "bg-gray-100 text-gray-600" : "bg-[#0c0e14] text-gray-500"}`}>
                <span>TIER</span><span>REQUESTS / MIN</span><span>REQUESTS / DAY</span><span>CONCURRENT</span><span>WEBSOCKET</span>
              </div>
              <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-800/30"}`}>
                {[
                  { tier: "Free", rpm: "10", rpd: "1,000", conc: "1", ws: "No" },
                  { tier: "Pro", rpm: "60", rpd: "50,000", conc: "5", ws: "Yes" },
                  { tier: "Enterprise", rpm: "600", rpd: "Unlimited", conc: "50", ws: "Yes" },
                  { tier: "Sovereign", rpm: "Unlimited", rpd: "Unlimited", conc: "Unlimited", ws: "Yes" },
                ].map((row, i) => (
                  <div key={i} className={`px-5 py-3 grid grid-cols-5 gap-4 text-xs ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <span className={`font-semibold ${
                      row.tier === "Sovereign" ? "text-amber-400" :
                      row.tier === "Enterprise" ? (isLight ? "text-purple-700" : "text-purple-400") :
                      row.tier === "Pro" ? (isLight ? "text-blue-700" : "text-blue-400") :
                      (isLight ? "text-gray-700" : "text-gray-300")
                    }`}>{row.tier}</span>
                    <span className={isLight ? "text-gray-600" : "text-gray-400"}>{row.rpm}</span>
                    <span className={isLight ? "text-gray-600" : "text-gray-400"}>{row.rpd}</span>
                    <span className={isLight ? "text-gray-600" : "text-gray-400"}>{row.conc}</span>
                    <span className={isLight ? "text-gray-600" : "text-gray-400"}>{row.ws}</span>
                  </div>
                ))}
              </div>
            </div>
            <InfoBox type="warning" isLight={isLight}>Rate limit headers are included in every API response: <code className="font-mono text-xs">X-RateLimit-Limit</code>, <code className="font-mono text-xs">X-RateLimit-Remaining</code>, <code className="font-mono text-xs">X-RateLimit-Reset</code>. Exceeding limits returns HTTP 429 with a Retry-After header.</InfoBox>
          </section>

          {/* ─── Error Codes ─────────────────────────────────────────── */}
          <section id="doc-error-codes" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                <AlertCircle size={20} className="text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Error Codes</h1>
                <p className="text-xs text-gray-500 font-mono">Full error reference with resolution steps</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-red-500/30 to-transparent mb-8" />
            <div className={`rounded-xl border overflow-hidden ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`px-5 py-3 grid grid-cols-4 gap-4 text-[10px] font-bold font-mono ${isLight ? "bg-gray-100 text-gray-600" : "bg-[#0c0e14] text-gray-500"}`}>
                <span>CODE</span><span>HTTP</span><span>MESSAGE</span><span>RESOLUTION</span>
              </div>
              <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-800/30"}`}>
                {[
                  { code: "AUTH_001", http: "401", msg: "Invalid or expired JWT", fix: "Re-authenticate and refresh token" },
                  { code: "AUTH_002", http: "403", msg: "Insufficient permissions", fix: "Check user role and scope" },
                  { code: "RATE_001", http: "429", msg: "Rate limit exceeded", fix: "Wait for Retry-After duration" },
                  { code: "RATE_002", http: "429", msg: "Daily quota exhausted", fix: "Upgrade tier or wait for reset at 00:00 UTC" },
                  { code: "DATA_001", http: "404", msg: "Article not found", fix: "Verify article ID exists" },
                  { code: "DATA_002", http: "422", msg: "Invalid filter parameters", fix: "Check region/category enum values" },
                  { code: "DATA_003", http: "400", msg: "Malformed request body", fix: "Validate JSON schema against API spec" },
                  { code: "ORBIT_001", http: "503", msg: "TLE data source unavailable", fix: "Retry after 30s; fallback to cached data" },
                  { code: "SIGINT_001", http: "400", msg: "Invalid frequency range", fix: "Use MHz values between 1–30000" },
                  { code: "WH_001", http: "400", msg: "Webhook URL unreachable", fix: "Verify endpoint returns 2xx within 5s" },
                  { code: "WH_002", http: "400", msg: "Invalid HMAC secret", fix: "Regenerate signing secret in Settings" },
                  { code: "SRV_001", http: "500", msg: "Internal server error", fix: "Retry with exponential backoff; contact support" },
                  { code: "SRV_002", http: "502", msg: "Upstream data provider error", fix: "Check status.redroom.live for outages" },
                ].map((row, i) => (
                  <div key={i} className={`px-5 py-3 grid grid-cols-4 gap-4 text-xs ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <span className="font-mono font-bold text-red-400">{row.code}</span>
                    <span className={`font-mono ${isLight ? "text-gray-500" : "text-gray-500"}`}>{row.http}</span>
                    <span className={isLight ? "text-gray-700" : "text-gray-300"}>{row.msg}</span>
                    <span className={isLight ? "text-gray-500" : "text-gray-500"}>{row.fix}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ─── SDK & Libraries ─────────────────────────────────────── */}
          <section id="doc-sdk" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
                <Code size={20} className="text-cyan-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">SDK & Client Libraries</h1>
                <p className="text-xs text-gray-500 font-mono">Official & community SDKs</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-cyan-500/30 to-transparent mb-8" />
            <p className={`text-sm leading-relaxed mb-6 ${isLight ? "text-gray-600" : "text-gray-400"}`}>
              Official SDKs are available for JavaScript/TypeScript and Python. Community SDKs for Go, Rust, and Java are maintained by the open-source community.
            </p>
            <CodeBlock title="JAVASCRIPT / TYPESCRIPT" isLight={isLight} code={`npm install @redroom/sdk

import { RedroomClient } from '@redroom/sdk';

const client = new RedroomClient({
  apiKey: process.env.REDROOM_API_KEY,
  region: 'eu-west-1',
});

const feed = await client.intel.getFeed({
  region: 'Middle East',
  threatScoreMin: 60,
  limit: 20,
});

client.alerts.subscribe({ threatScoreMin: 75 }, (alert) => {
  console.log('High-threat event:', alert.title);
});`} />
            <CodeBlock title="PYTHON" isLight={isLight} code={`pip install redroom-sdk

from redroom import RedroomClient
import os

client = RedroomClient(api_key=os.environ['REDROOM_API_KEY'])

feed = client.intel.get_feed(
    region='Middle East',
    threat_score_min=60,
    limit=20
)

entities = client.entities.batch_lookup(['Iran', 'IRGC', 'Hezbollah'])
for entity in entities:
    print(entity.name, entity.threat_score)`} />
          </section>

          {/* ─── Performance & Scaling ───────────────────────────────── */}
          <section id="doc-performance" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-green-500/10 border border-green-500/30 flex items-center justify-center">
                <BarChart3 size={20} className="text-green-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Performance & Scaling</h1>
                <p className="text-xs text-gray-500 font-mono">Benchmarks, caching, and horizontal scaling</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-green-500/30 to-transparent mb-8" />
            <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 mb-6`}>
              {[
                { label: "API P50 Latency", value: "18ms", color: "text-green-400" },
                { label: "API P99 Latency", value: "120ms", color: "text-cyan-400" },
                { label: "Feed Refresh Rate", value: "30s", color: "text-blue-400" },
                { label: "Uptime SLA", value: "99.9%", color: "text-amber-400" },
              ].map((stat, i) => (
                <div key={i} className={`rounded-xl border p-4 text-center ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0c0e14]"}`}>
                  <div className={`text-2xl font-black ${stat.color}`}>{stat.value}</div>
                  <div className={`text-[10px] font-mono mt-1 ${isLight ? "text-gray-500" : "text-gray-500"}`}>{stat.label}</div>
                </div>
              ))}
            </div>
            <InfoBox type="info" isLight={isLight}>Enterprise and Sovereign deployments support horizontal scaling via Kubernetes. The intelligence processing pipeline is stateless and can scale to 100+ concurrent ingestion workers. Redis is used for feed caching (TTL: 30s) and session management.</InfoBox>
          </section>

          {/* ─── Compliance & Certifications ─────────────────────────── */}
          <section id="doc-compliance" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center">
                <Shield size={20} className="text-blue-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Compliance & Certifications</h1>
                <p className="text-xs text-gray-500 font-mono">SOC 2, ISO 27001, GDPR, and more</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-blue-500/30 to-transparent mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[
                { name: "SOC 2 Type II", status: "Certified", desc: "Annual audit covering security, availability, and confidentiality trust service criteria.", color: "green" },
                { name: "ISO 27001", status: "Certified", desc: "International standard for information security management systems (ISMS).", color: "green" },
                { name: "GDPR", status: "Compliant", desc: "EU data protection regulation. DPA available on request. Data residency options in EU-West.", color: "blue" },
                { name: "CCPA", status: "Compliant", desc: "California Consumer Privacy Act. Data deletion and export requests honored within 30 days.", color: "blue" },
                { name: "FedRAMP", status: "In Progress", desc: "US federal cloud security authorization. Expected Q2 2027 for Sovereign tier.", color: "amber" },
                { name: "NATO STANAG", status: "Roadmap", desc: "NATO standardization agreement for intelligence data exchange. Planned for Q4 2027.", color: "gray" },
              ].map((cert, i) => (
                <div key={i} className={`rounded-xl border p-4 ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0c0e14]"}`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-sm font-bold ${isLight ? "text-gray-900" : "text-white"}`}>{cert.name}</span>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border ${
                      cert.color === "green" ? (isLight ? "border-green-300 bg-green-50 text-green-700" : "border-green-500/30 bg-green-500/10 text-green-400") :
                      cert.color === "blue" ? (isLight ? "border-blue-300 bg-blue-50 text-blue-700" : "border-blue-500/30 bg-blue-500/10 text-blue-400") :
                      cert.color === "amber" ? (isLight ? "border-amber-300 bg-amber-50 text-amber-700" : "border-amber-500/30 bg-amber-500/10 text-amber-400") :
                      (isLight ? "border-gray-300 bg-gray-100 text-gray-500" : "border-gray-700/40 bg-gray-800/30 text-gray-500")
                    }`}>{cert.status}</span>
                  </div>
                  <p className={`text-xs leading-relaxed ${isLight ? "text-gray-500" : "text-gray-500"}`}>{cert.desc}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ─── Glossary ────────────────────────────────────────────── */}
          <section id="doc-glossary" className="mb-24">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-gray-500/10 border border-gray-500/30 flex items-center justify-center">
                <List size={20} className="text-gray-400" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black">Glossary</h1>
                <p className="text-xs text-gray-500 font-mono">Key terms and definitions</p>
              </div>
            </div>
            <div className="h-px bg-gradient-to-r from-gray-500/30 to-transparent mb-8" />
            <div className={`rounded-xl border overflow-hidden ${isLight ? "border-gray-200" : "border-gray-800/40"}`}>
              <div className={`divide-y ${isLight ? "divide-gray-100" : "divide-gray-800/30"}`}>
                {[
                  { term: "TLE", def: "Two-Line Element set — a data format encoding orbital parameters for a satellite, used by the SGP4 model to compute position." },
                  { term: "SGP4", def: "Simplified General Perturbations 4 — a mathematical model for computing satellite positions from TLE data, accounting for atmospheric drag and Earth's oblateness." },
                  { term: "OSINT", def: "Open-Source Intelligence — intelligence gathered from publicly available sources including news, social media, academic papers, and government records." },
                  { term: "SIGINT", def: "Signals Intelligence — intelligence derived from intercepted electronic signals, including communications and electronic emissions." },
                  { term: "FIMI", def: "Foreign Information Manipulation and Interference — coordinated efforts by foreign actors to manipulate public discourse through disinformation." },
                  { term: "IOC", def: "Indicator of Compromise — observable artifacts (IPs, hashes, domains) that indicate a security breach or malicious activity." },
                  { term: "AOI", def: "Area of Interest — a geographic region defined by the user for filtering satellite passes, news events, or threat alerts." },
                  { term: "LEO", def: "Low Earth Orbit — orbital altitude below 2,000 km. Includes ISS, Starlink, reconnaissance satellites." },
                  { term: "MEO", def: "Medium Earth Orbit — orbital altitude between 2,000–35,000 km. Includes GPS, Galileo, and GLONASS constellations." },
                  { term: "GEO", def: "Geostationary Orbit — orbital altitude ~35,786 km. Satellites appear stationary relative to Earth's surface. Used for communications and weather." },
                  { term: "HMAC", def: "Hash-based Message Authentication Code — a cryptographic mechanism for verifying webhook payload integrity using a shared secret." },
                  { term: "tRPC", def: "TypeScript Remote Procedure Call — the API framework used by Redroom for end-to-end type-safe client-server communication." },
                  { term: "Threat Score", def: "A composite 0–100 score assigned to each intelligence article based on source credibility, sentiment, entity prominence, geographic proximity, and recency." },
                  { term: "Narrative Cluster", def: "A group of articles sharing a common disinformation theme, identified by NLP clustering algorithms and confirmed by analyst review." },
                  { term: "Sovereign Deployment", def: "An air-gapped, on-premises installation of Redroom within a customer's own infrastructure, with no external data egress." },
                ].map((entry, i) => (
                  <div key={i} className={`px-5 py-4 flex gap-4 text-xs ${isLight ? "bg-white" : "bg-[#080a0f]"}`}>
                    <span className={`font-mono font-bold text-cyan-400 w-28 shrink-0`}>{entry.term}</span>
                    <span className={isLight ? "text-gray-600" : "text-gray-400"}>{entry.def}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className={`border-t ${t.footer} pt-8 pb-16 text-center`}>
            <div className="text-sm font-black mb-2">
              <span style={{ color: "#cc1111" }}>RED</span>
              <span style={{ color: "#00e5ff" }}>ROOM</span>
              <span className={`font-normal ml-1 ${t.muted}`}> · Powered by </span>
              <a href="https://owlink.ai" target="_blank" rel="noopener noreferrer" className={`transition-colors ${t.footerLink}`}>Owlink.ai</a>
            </div>
            <p className={`text-xs ${t.footerMuted}`}>MIT License · Open Source Intelligence Platform</p>
          </div>

        </div>
      </main>

      </div>{/* end flex row */}

      {/* ─── Ask AI Drawer ─────────────────────────────────────────── */}
      {askAiOpen && (
        <div className="fixed inset-0 z-[60] flex justify-end">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setAskAiOpen(false)} />
          {/* Drawer */}
          <div className={`relative w-full max-w-md h-full flex flex-col shadow-2xl border-l ${isLight ? "bg-white border-gray-200" : "bg-[#080a10] border-gray-800/60"}`}>
            {/* Drawer header */}
            <div className={`px-5 py-4 border-b flex items-center gap-3 ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0c0e14]"}`}>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
                <Bot size={16} className="text-purple-400" />
              </div>
              <div className="flex-1">
                <div className={`text-sm font-bold ${isLight ? "text-gray-900" : "text-white"}`}>Ask AI</div>
                <div className="text-[10px] font-mono text-gray-500">Intelligent documentation assistant</div>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-1 rounded border text-[9px] font-mono font-bold ${isLight ? "border-amber-300 bg-amber-50 text-amber-700" : "border-amber-700/50 bg-amber-950/30 text-amber-400"}`}>
                <Crown size={9} />
                PREMIUM
              </div>
              <button onClick={() => setAskAiOpen(false)} className={`p-1.5 rounded transition-colors ${isLight ? "hover:bg-gray-200 text-gray-500" : "hover:bg-gray-800 text-gray-500"}`}>
                <X size={16} />
              </button>
            </div>

            {/* Premium lock overlay */}
            <div className="flex-1 flex flex-col relative overflow-hidden">
              {/* Blurred chat preview */}
              <div className="flex-1 p-5 space-y-4 overflow-y-auto" style={{ filter: "blur(3px)", pointerEvents: "none", userSelect: "none" }}>
                {[
                  { role: "user", text: "How does the ORBIT module track satellites?" },
                  { role: "ai",   text: "ORBIT uses real-time TLE (Two-Line Element) data from Space-Track.org and CelesTrak to compute orbital positions using the SGP4 propagation model. Satellites are rendered on a WebGL globe with Three.js, updating every 10 seconds. You can filter by orbital regime (LEO/MEO/GEO), constellation, or country of origin..." },
                  { role: "user", text: "What threat scoring model does Redroom use?" },
                  { role: "ai",   text: "Redroom employs a composite threat score (0–100) combining: source credibility (30%), sentiment intensity (25%), entity prominence (20%), geographic proximity (15%), and temporal recency (10%). Scores above 75 trigger automatic SIGINT alerts..." },
                  { role: "user", text: "How do I set up webhook notifications?" },
                  { role: "ai",   text: "Navigate to Settings → Integrations → Webhooks. Define a target URL, select event types (new_article, threat_alert, sigint_intercept), and optionally add HMAC-SHA256 signing. Redroom sends POST requests with a JSON payload within 500ms of event detection..." },
                ].map((msg, i) => (
                  <div key={i} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>
                    {msg.role === "ai" && (
                      <div className="w-6 h-6 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center shrink-0 mt-0.5">
                        <Bot size={12} className="text-purple-400" />
                      </div>
                    )}
                    <div className={`max-w-[80%] rounded-xl px-4 py-2.5 text-xs leading-relaxed ${
                      msg.role === "user"
                        ? (isLight ? "bg-purple-600 text-white" : "bg-purple-600/80 text-white")
                        : (isLight ? "bg-gray-100 text-gray-800" : "bg-[#0e1018] text-gray-300 border border-gray-800/40")
                    }`}>{msg.text}</div>
                  </div>
                ))}
              </div>

              {/* Lock overlay */}
              <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ background: isLight ? "rgba(255,255,255,0.85)" : "rgba(6,8,16,0.85)" }}>
                <div className={`rounded-2xl border p-8 text-center max-w-xs mx-4 shadow-2xl ${isLight ? "bg-white border-gray-200" : "bg-[#0c0e14] border-gray-800/60"}`}>
                  <div className="w-14 h-14 rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mx-auto mb-4">
                    <Lock size={24} className="text-amber-400" />
                  </div>
                  <div className={`text-base font-bold mb-1 ${isLight ? "text-gray-900" : "text-white"}`}>Premium Feature</div>
                  <div className={`text-xs mb-5 leading-relaxed ${isLight ? "text-gray-500" : "text-gray-400"}`}>
                    Ask AI gives you instant answers about the platform, API usage, configuration, and intelligence workflows — powered by a fine-tuned model trained on Redroom documentation.
                  </div>
                  <div className="space-y-2 mb-5">
                    {["How do I configure SIGINT filters?", "Explain the threat scoring model", "Set up Slack webhook alerts", "What is the ORBIT SGP4 model?", "How to export intelligence reports?"].map((q, i) => (
                      <div key={i} className={`text-[10px] font-mono px-3 py-1.5 rounded-lg border text-left cursor-not-allowed ${isLight ? "border-gray-200 bg-gray-50 text-gray-500" : "border-gray-800/40 bg-[#080a0f] text-gray-600"}`}>
                        {q}
                      </div>
                    ))}
                  </div>
                  <a
                    href="https://owlink.ai"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-amber-500 text-white text-xs font-bold transition-all hover:opacity-90"
                  >
                    <Crown size={13} />
                    Upgrade to Enterprise
                    <ArrowUpRight size={13} />
                  </a>
                  <p className={`text-[9px] mt-3 ${isLight ? "text-gray-400" : "text-gray-600"}`}>Includes Ask AI · Sovereign Deployment · Priority Support</p>
                </div>
              </div>

              {/* Disabled input */}
              <div className={`p-4 border-t ${isLight ? "border-gray-200 bg-gray-50" : "border-gray-800/40 bg-[#0c0e14]"}`}>
                <div className="relative">
                  <input
                    type="text"
                    disabled
                    placeholder="Ask anything about Redroom..."
                    value={askAiInput}
                    onChange={e => setAskAiInput(e.target.value)}
                    className={`w-full pl-4 pr-12 py-2.5 rounded-xl border text-xs cursor-not-allowed ${isLight ? "bg-gray-100 border-gray-200 text-gray-400 placeholder:text-gray-400" : "bg-[#080a0f] border-gray-800/40 text-gray-600 placeholder:text-gray-700"}`}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    <Lock size={10} className="text-amber-400" />
                    <Send size={12} className="text-gray-600" />
                  </div>
                </div>
                <p className={`text-[9px] text-center mt-2 font-mono ${isLight ? "text-gray-400" : "text-gray-600"}`}>Upgrade to Enterprise to unlock Ask AI</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
