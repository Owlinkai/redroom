/**
 * Super Admin CMS — Restricted Access
 * Shows a convincing fake 404 to non-admin users.
 * For admins: user management, activity logs, traffic stats, settings (key rotation + expiry),
 * and pending admin registration approval queue.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  loadPrefs,
  savePrefs,
  resetPrefs,
  loadHeaderPrefs,
  saveHeaderPrefs,
  HEADER_ITEMS_DEFAULT,
  ORBIT_DEFAULTS,
  SIGINT_DEFAULTS,
  type HeaderItemConfig,
  type HeaderItem,
  type BuiltinItem,
  type PageKey,
} from "../lib/headerPrefs";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Shield, Users, Activity, Settings, BarChart3, Search,
  Trash2, ChevronUp, ChevronDown, RefreshCw, Copy, Eye, EyeOff,
  AlertCircle, CheckCircle, Loader2, Home, LogOut, Key, Clock,
  UserPlus, X, Bell, Timer, Shuffle, AlertTriangle, Zap,
  Link2, ExternalLink, History, Globe, FileText, Save, ToggleLeft, ToggleRight, Plus, Minus, ArrowLeft,
  Radio, Play, Pause, StopCircle, ChevronRight, User, Calendar, Target, TrendingUp, Database, Cpu,
  Building2, MessageSquare, Layers, Palette
} from "lucide-react";

// ─── Crawler Missions Tab ────────────────────────────────────────────────────
function fmtDuration(startedAt: Date | string | null, completedAt: Date | string | null = null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

function fmtRelativeTime(d: Date | string | null): string {
  if (!d) return "—";
  const ms = Date.now() - new Date(d).getTime();
  if (ms < 60000) return `${Math.floor(ms / 1000)}s ago`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ago`;
  if (ms < 86400000) return `${Math.floor(ms / 3600000)}h ago`;
  return new Date(d).toLocaleDateString();
}

function RunStatusBadge({ status }: { status: string | null }) {
  const map: Record<string, { color: string; bg: string; border: string; label: string }> = {
    running:   { color: "#38bdf8", bg: "rgba(56,189,248,0.10)",  border: "rgba(56,189,248,0.3)",  label: "● RUNNING"    },
    completed: { color: "#34d399", bg: "rgba(52,211,153,0.10)",  border: "rgba(52,211,153,0.3)",  label: "✓ COMPLETED"  },
    failed:    { color: "#f87171", bg: "rgba(248,113,113,0.10)", border: "rgba(248,113,113,0.3)", label: "✗ FAILED"     },
    partial:   { color: "#fbbf24", bg: "rgba(251,191,36,0.10)",  border: "rgba(251,191,36,0.3)",  label: "⚠ PARTIAL"    },
    interrupted:{ color: "#a78bfa", bg: "rgba(167,139,250,0.10)",border: "rgba(167,139,250,0.3)", label: "⏹ INTERRUPTED" },
  };
  const s = map[status ?? ""] ?? { color: "#64748b", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.3)", label: status ?? "—" };
  return (
    <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ color: s.color, background: s.bg, border: `1px solid ${s.border}` }}>
      {s.label}
    </span>
  );
}

// ─── Edit Mission Modal ──────────────────────────────────────────────────────
const MISSION_REGIONS = ["MENA","Global","Europe","East Asia","Asia-Pacific","South Asia","Central Asia","Sub-Saharan Africa","North Africa","Americas","Latin America"];
const MISSION_TOPICS  = ["WAR/CONFLICT","ECONOMY","POLITICS","TECHNOLOGY","ENERGY","DIPLOMACY","SECURITY","HUMANITARIAN"];
const MISSION_TYPES   = ["state","independent","international","digital","broadcast","wire"];

const CRON_PRESETS = [
  { label: "Every 15 min",  value: "*/15 * * * *" },
  { label: "Every 30 min",  value: "*/30 * * * *" },
  { label: "Every hour",    value: "0 * * * *" },
  { label: "Every 2 hours", value: "0 */2 * * *" },
  { label: "Every 4 hours", value: "0 */4 * * *" },
  { label: "Every 6 hours", value: "0 */6 * * *" },
  { label: "Every 12 hours",value: "0 */12 * * *" },
  { label: "Daily at midnight", value: "0 0 * * *" },
  { label: "Daily at 6am",  value: "0 6 * * *" },
  { label: "Custom",        value: "custom" },
];

type MissionData = {
  id: number;
  name: string;
  codename: string | null;
  description: string | null;
  cronExpression: string;
  isRecurring: boolean | null;
  priority: "low" | "normal" | "high" | "critical" | null;
  classification: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET" | null;
  minArticlesPerRun: number | null;
  targetCountries: string[] | null;
  targetRegions: string[] | null;
  targetTypes: string[] | null;
  targetTopics: string[] | null;
  targetAgencyIds: number[] | null;
  createdBy: string | null;
};

function TagInput({ label, values, options, onChange, placeholder }: {
  label: string;
  values: string[];
  options: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [inputVal, setInputVal] = useState("");
  const filtered = options.filter(o => !values.includes(o) && o.toLowerCase().includes(inputVal.toLowerCase()));

  const add = (v: string) => { if (v && !values.includes(v)) { onChange([...values, v]); setInputVal(""); } };
  const remove = (v: string) => onChange(values.filter(x => x !== v));

  return (
    <div>
      <div className="text-[8px] font-mono tracking-widest mb-1.5" style={{ color: "rgba(56,189,248,0.5)" }}>{label}</div>
      {/* Selected tags */}
      <div className="flex flex-wrap gap-1 mb-1.5">
        {values.map(v => (
          <span key={v} className="flex items-center gap-1 text-[8px] font-mono px-1.5 py-0.5 rounded"
            style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", color: "#38bdf8" }}
          >
            {v}
            <button type="button" onClick={() => remove(v)} style={{ color: "#64748b", lineHeight: 1 }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
            >
              <X size={8} />
            </button>
          </span>
        ))}
        {values.length === 0 && (
          <span className="text-[8px] font-mono italic" style={{ color: "#334155" }}>All (no filter)</span>
        )}
      </div>
      {/* Input + dropdown */}
      <div className="relative">
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (filtered[0]) add(filtered[0]); else if (inputVal.trim()) add(inputVal.trim().toUpperCase()); } }}
          placeholder={placeholder ?? `Add ${label.toLowerCase()}…`}
          className="w-full text-[9px] font-mono px-2 py-1.5 rounded outline-none"
          style={{ background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.15)", color: "#94a3b8" }}
        />
        {inputVal && filtered.length > 0 && (
          <div className="absolute z-10 left-0 right-0 top-full mt-0.5 rounded overflow-hidden"
            style={{ background: "#0d1117", border: "1px solid rgba(56,189,248,0.2)", maxHeight: 120, overflowY: "auto" }}
          >
            {filtered.slice(0, 8).map(opt => (
              <button key={opt} type="button"
                className="w-full text-left px-2 py-1 text-[9px] font-mono transition-all"
                style={{ color: "#94a3b8" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.08)"; (e.currentTarget as HTMLButtonElement).style.color = "#38bdf8"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
                onClick={() => add(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EditMissionModal({ mission, onClose, onSaved }: { mission: MissionData; onClose: () => void; onSaved: () => void }) {
  const updateMut = trpc.cms.updateMission.useMutation({
    onSuccess: () => { toast.success("Mission updated successfully"); onSaved(); onClose(); },
    onError: (e) => toast.error(`Save failed: ${e.message}`),
  });

  // Form state — initialised from mission
  const [name, setName]               = useState(mission.name);
  const [codename, setCodename]       = useState(mission.codename ?? "");
  const [description, setDescription] = useState(mission.description ?? "");
  const [cronPreset, setCronPreset]   = useState(() => {
    const match = CRON_PRESETS.find(p => p.value === mission.cronExpression && p.value !== "custom");
    return match ? match.value : "custom";
  });
  const [cronCustom, setCronCustom]   = useState(mission.cronExpression);
  const [isRecurring, setIsRecurring] = useState(mission.isRecurring ?? true);
  const [priority, setPriority]       = useState<"low"|"normal"|"high"|"critical">(mission.priority ?? "normal");
  const [classification, setClassification] = useState<"UNCLASSIFIED"|"CONFIDENTIAL"|"SECRET"|"TOP SECRET">(mission.classification ?? "UNCLASSIFIED");
  const [minArticles, setMinArticles] = useState(String(mission.minArticlesPerRun ?? 0));
  const [countries, setCountries]     = useState<string[]>(mission.targetCountries ?? []);
  const [regions, setRegions]         = useState<string[]>(mission.targetRegions ?? []);
  const [types, setTypes]             = useState<string[]>(mission.targetTypes ?? []);
  const [topics, setTopics]           = useState<string[]>(mission.targetTopics ?? []);

  const effectiveCron = cronPreset === "custom" ? cronCustom : cronPreset;

  // Validate cron expression
  const [cronValid, setCronValid] = useState(true);
  useEffect(() => {
    try {
      const parts = effectiveCron.trim().split(/\s+/);
      setCronValid(parts.length === 5);
    } catch { setCronValid(false); }
  }, [effectiveCron]);

  const handleSave = () => {
    if (!name.trim()) { toast.error("Mission name is required"); return; }
    if (!cronValid)   { toast.error("Invalid cron expression"); return; }
    updateMut.mutate({
      id: mission.id,
      name: name.trim(),
      codename: codename.trim() || undefined,
      description: description.trim() || undefined,
      cronExpression: effectiveCron.trim(),
      isRecurring,
      priority,
      classification,
      minArticlesPerRun: parseInt(minArticles, 10) || 0,
      targetCountries: countries,
      targetRegions: regions,
      targetTypes: types,
      targetTopics: topics,
    });
  };

  const inputCls = "w-full text-[10px] font-mono px-2.5 py-1.5 rounded outline-none transition-all";
  const inputStyle = { background: "rgba(56,189,248,0.04)", border: "1px solid rgba(56,189,248,0.15)", color: "#e2e8f0" };
  const inputFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,189,248,0.4)";
    (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.07)";
  };
  const inputBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    (e.currentTarget as HTMLElement).style.borderColor = "rgba(56,189,248,0.15)";
    (e.currentTarget as HTMLElement).style.background = "rgba(56,189,248,0.04)";
  };
  const labelCls = "text-[8px] font-mono tracking-widest mb-1 block";
  const labelStyle = { color: "rgba(56,189,248,0.5)" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(56,189,248,0.25)", boxShadow: "0 32px 100px rgba(0,0,0,0.9)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center gap-3 px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid rgba(56,189,248,0.12)", background: "rgba(56,189,248,0.04)" }}>
          <div className="w-7 h-7 rounded flex items-center justify-center" style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.2)" }}>
            <Settings size={13} style={{ color: "#38bdf8" }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono font-black tracking-widest" style={{ color: "#38bdf8" }}>EDIT MISSION</div>
            <div className="text-[9px] font-mono truncate" style={{ color: "#475569" }}>#{mission.id} · {mission.name}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded transition-all" style={{ color: "#475569", border: "1px solid rgba(100,116,139,0.15)" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.3)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#475569"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(100,116,139,0.15)"; }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>

          {/* ── Section 1: Identity ── */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.2em] mb-3 flex items-center gap-2" style={{ color: "rgba(56,189,248,0.35)" }}>
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
              IDENTITY
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>MISSION NAME *</label>
                <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="Operation name…" />
              </div>
              <div>
                <label className={labelCls} style={labelStyle}>CODENAME</label>
                <input value={codename} onChange={e => setCodename(e.target.value)} className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur} placeholder="e.g. OPERATION NIGHTWATCH" />
              </div>
            </div>
            <div className="mt-3">
              <label className={labelCls} style={labelStyle}>DESCRIPTION</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                rows={2}
                className="w-full text-[10px] font-mono px-2.5 py-1.5 rounded outline-none resize-none transition-all"
                style={{ ...inputStyle, lineHeight: 1.5 }}
                onFocus={inputFocus as any} onBlur={inputBlur as any}
                placeholder="Brief mission description…"
              />
            </div>
          </div>

          {/* ── Section 2: Schedule ── */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.2em] mb-3 flex items-center gap-2" style={{ color: "rgba(56,189,248,0.35)" }}>
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
              SCHEDULE
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>CRON PRESET</label>
                <select value={cronPreset} onChange={e => setCronPreset(e.target.value)}
                  className={inputCls}
                  style={{ ...inputStyle, cursor: "pointer" }}
                  onFocus={inputFocus as any} onBlur={inputBlur as any}
                >
                  {CRON_PRESETS.map(p => (
                    <option key={p.value} value={p.value} style={{ background: "#0d1117" }}>{p.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls} style={{ color: cronValid ? "rgba(56,189,248,0.5)" : "#f87171" }}>
                  CRON EXPRESSION {!cronValid && "— INVALID"}
                </label>
                <input
                  value={cronPreset === "custom" ? cronCustom : cronPreset}
                  onChange={e => { setCronPreset("custom"); setCronCustom(e.target.value); }}
                  className={inputCls}
                  style={{ ...inputStyle, borderColor: cronValid ? "rgba(56,189,248,0.15)" : "rgba(248,113,113,0.4)", fontFamily: "monospace" }}
                  onFocus={inputFocus} onBlur={inputBlur}
                  placeholder="* * * * *"
                />
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsRecurring(!isRecurring)}
                className="flex items-center gap-2 text-[9px] font-mono transition-all"
                style={{ color: isRecurring ? "#34d399" : "#64748b" }}
              >
                <div className="w-7 h-3.5 rounded-full relative transition-all" style={{ background: isRecurring ? "rgba(52,211,153,0.3)" : "rgba(100,116,139,0.2)", border: `1px solid ${isRecurring ? "rgba(52,211,153,0.5)" : "rgba(100,116,139,0.3)"}` }}>
                  <div className="absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all" style={{ background: isRecurring ? "#34d399" : "#64748b", left: isRecurring ? "calc(100% - 11px)" : "1px" }} />
                </div>
                RECURRING SCHEDULE
              </button>
            </div>
          </div>

          {/* ── Section 3: Classification ── */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.2em] mb-3 flex items-center gap-2" style={{ color: "rgba(56,189,248,0.35)" }}>
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
              CLASSIFICATION & PRIORITY
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls} style={labelStyle}>PRIORITY</label>
                <div className="flex gap-1 flex-wrap">
                  {(["low","normal","high","critical"] as const).map(p => {
                    const c = { low: "#64748b", normal: "#38bdf8", high: "#fbbf24", critical: "#f87171" }[p];
                    return (
                      <button key={p} type="button"
                        onClick={() => setPriority(p)}
                        className="px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all"
                        style={{
                          background: priority === p ? `${c}20` : "transparent",
                          border: `1px solid ${priority === p ? c : "rgba(100,116,139,0.2)"}`,
                          color: priority === p ? c : "#475569",
                        }}
                      >{p.toUpperCase()}</button>
                    );
                  })}
                </div>
              </div>
              <div className="col-span-2">
                <label className={labelCls} style={labelStyle}>CLASSIFICATION</label>
                <div className="flex gap-1 flex-wrap">
                  {(["UNCLASSIFIED","CONFIDENTIAL","SECRET","TOP SECRET"] as const).map(c => {
                    const col = { "UNCLASSIFIED": "#34d399", "CONFIDENTIAL": "#a78bfa", "SECRET": "#fbbf24", "TOP SECRET": "#f87171" }[c];
                    return (
                      <button key={c} type="button"
                        onClick={() => setClassification(c)}
                        className="px-2 py-0.5 rounded text-[8px] font-mono font-bold transition-all"
                        style={{
                          background: classification === c ? `${col}20` : "transparent",
                          border: `1px solid ${classification === c ? col : "rgba(100,116,139,0.2)"}`,
                          color: classification === c ? col : "#475569",
                        }}
                      >{c}</button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div className="mt-3 w-32">
              <label className={labelCls} style={labelStyle}>MIN ARTICLES / RUN</label>
              <input type="number" min="0" value={minArticles} onChange={e => setMinArticles(e.target.value)}
                className={inputCls} style={inputStyle} onFocus={inputFocus} onBlur={inputBlur}
              />
            </div>
          </div>

          {/* ── Section 4: Targets ── */}
          <div>
            <div className="text-[8px] font-mono tracking-[0.2em] mb-3 flex items-center gap-2" style={{ color: "rgba(56,189,248,0.35)" }}>
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
              ACQUISITION TARGETS
              <div className="h-px flex-1" style={{ background: "rgba(56,189,248,0.1)" }} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <TagInput label="TARGET REGIONS" values={regions} options={MISSION_REGIONS} onChange={setRegions} />
              <TagInput label="TARGET COUNTRIES" values={countries} options={[]} onChange={setCountries} placeholder="Type country name + Enter" />
              <TagInput label="TARGET TOPICS" values={topics} options={MISSION_TOPICS} onChange={setTopics} />
              <TagInput label="SOURCE TYPES" values={types} options={MISSION_TYPES} onChange={setTypes} />
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 shrink-0" style={{ borderTop: "1px solid rgba(56,189,248,0.1)", background: "rgba(56,189,248,0.02)" }}>
          <div className="text-[8px] font-mono" style={{ color: "#334155" }}>Mission #{mission.id} · Created by {mission.createdBy ?? "unknown"}</div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded text-[9px] font-mono transition-all"
              style={{ background: "rgba(100,116,139,0.08)", border: "1px solid rgba(100,116,139,0.2)", color: "#64748b" }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#94a3b8"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
            >
              CANCEL
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={updateMut.isPending || !cronValid}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded text-[9px] font-mono font-bold transition-all"
              style={{
                background: updateMut.isPending ? "rgba(56,189,248,0.05)" : "rgba(56,189,248,0.12)",
                border: "1px solid rgba(56,189,248,0.35)",
                color: updateMut.isPending ? "#475569" : "#38bdf8",
              }}
              onMouseEnter={e => { if (!updateMut.isPending) (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.2)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = updateMut.isPending ? "rgba(56,189,248,0.05)" : "rgba(56,189,248,0.12)"; }}
            >
              {updateMut.isPending ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              {updateMut.isPending ? "SAVING…" : "SAVE CHANGES"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionRunsPanel({ missionId, missionName, onClose }: { missionId: number; missionName: string; onClose: () => void }) {
  const runsQ = trpc.cms.getMissionRuns.useQuery({ missionId, limit: 30 }, { refetchInterval: 10000 });
  const runs = runsQ.data ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-3xl max-h-[80vh] flex flex-col rounded-xl overflow-hidden"
        style={{ background: "#0d1117", border: "1px solid rgba(56,189,248,0.2)", boxShadow: "0 24px 80px rgba(0,0,0,0.8)" }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 shrink-0" style={{ borderBottom: "1px solid rgba(56,189,248,0.12)", background: "rgba(56,189,248,0.04)" }}>
          <History size={14} style={{ color: "#38bdf8" }} />
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-mono font-black tracking-widest" style={{ color: "#38bdf8" }}>RUN HISTORY</div>
            <div className="text-[10px] font-mono truncate" style={{ color: "#64748b" }}>{missionName}</div>
          </div>
          <span className="text-[9px] font-mono px-2 py-0.5 rounded" style={{ background: "rgba(56,189,248,0.1)", color: "#38bdf8", border: "1px solid rgba(56,189,248,0.2)" }}>
            {runs.length} RUNS
          </span>
          <button onClick={onClose} className="p-1 rounded transition-all" style={{ color: "#64748b" }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#64748b"; }}
          >
            <X size={14} />
          </button>
        </div>

        {/* Run list */}
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(56,189,248,0.1) transparent" }}>
          {runsQ.isLoading ? (
            <div className="flex items-center justify-center h-32 gap-2">
              <Loader2 size={16} className="animate-spin" style={{ color: "#38bdf8" }} />
              <span className="text-[10px] font-mono" style={{ color: "#64748b" }}>LOADING RUN HISTORY...</span>
            </div>
          ) : runs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 gap-2">
              <Database size={20} style={{ color: "rgba(56,189,248,0.1)" }} />
              <span className="text-[10px] font-mono" style={{ color: "#64748b" }}>NO RUNS RECORDED YET</span>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(56,189,248,0.08)", background: "rgba(56,189,248,0.03)" }}>
                  {["RUN #", "STARTED", "DURATION", "STATUS", "ARTICLES", "NEW", "TRIGGERED BY", "ERROR"].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[8px] font-mono tracking-widest" style={{ color: "rgba(56,189,248,0.4)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {runs.map((run, idx) => (
                  <tr
                    key={run.id}
                    style={{ borderBottom: "1px solid rgba(56,189,248,0.04)", background: idx % 2 === 0 ? "transparent" : "rgba(56,189,248,0.01)" }}
                  >
                    <td className="px-3 py-2 text-[9px] font-mono" style={{ color: "#64748b" }}>#{run.id}</td>
                    <td className="px-3 py-2 text-[9px] font-mono" style={{ color: "#94a3b8" }}>
                      <div>{run.startedAt ? new Date(run.startedAt).toLocaleDateString() : "—"}</div>
                      <div style={{ color: "#475569" }}>{run.startedAt ? new Date(run.startedAt).toLocaleTimeString() : ""}</div>
                    </td>
                    <td className="px-3 py-2 text-[9px] font-mono" style={{ color: "#64748b" }}>
                      {fmtDuration(run.startedAt, run.completedAt)}
                    </td>
                    <td className="px-3 py-2"><RunStatusBadge status={run.status} /></td>
                    <td className="px-3 py-2 text-[9px] font-mono text-right" style={{ color: "#94a3b8" }}>{run.articlesFound ?? 0}</td>
                    <td className="px-3 py-2 text-[9px] font-mono font-bold text-right" style={{ color: (run.articlesNew ?? 0) > 0 ? "#34d399" : "#475569" }}>+{run.articlesNew ?? 0}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded w-fit"
                          style={{
                            background: run.triggeredBy === "manual" ? "rgba(251,191,36,0.1)" : "rgba(100,116,139,0.1)",
                            color: run.triggeredBy === "manual" ? "#fbbf24" : "#64748b",
                            border: `1px solid ${run.triggeredBy === "manual" ? "rgba(251,191,36,0.2)" : "rgba(100,116,139,0.2)"}`
                          }}
                        >
                          {run.triggeredBy === "manual" ? "⚡ MANUAL" : "⏰ SCHEDULED"}
                        </span>
                        {run.triggeredByUser && (
                          <span className="text-[8px] font-mono" style={{ color: "#fbbf24" }}>by {run.triggeredByUser}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-[8px] font-mono max-w-[140px]" style={{ color: "#f87171" }}>
                      {run.errorMessage ? (
                        <span title={run.errorMessage} className="truncate block">{run.errorMessage}</span>
                      ) : <span style={{ color: "#1e3a2f" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function CrawlerMissionsTab() {
  const utils = trpc.useUtils();
  const missionsQ = trpc.cms.listMissions.useQuery(undefined, { refetchInterval: 15000 });
  const triggerMut = trpc.cms.triggerMission.useMutation({
    onSuccess: () => { utils.cms.listMissions.invalidate(); toast.success("Mission triggered — run started"); },
    onError: (e) => toast.error(`Trigger failed: ${e.message}`),
  });
  const deleteMut = trpc.cms.deleteMission.useMutation({
    onSuccess: () => { utils.cms.listMissions.invalidate(); toast.success("Mission deleted"); },
    onError: (e) => toast.error(`Delete failed: ${e.message}`),
  });
  const updateMut = trpc.cms.updateMission.useMutation({
    onSuccess: () => { utils.cms.listMissions.invalidate(); },
    onError: (e) => toast.error(`Update failed: ${e.message}`),
  });

  const [selectedRunMission, setSelectedRunMission] = useState<{ id: number; name: string } | null>(null);
  const [editMission, setEditMission] = useState<MissionData | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const missions = missionsQ.data ?? [];

  const priorityColor: Record<string, string> = {
    critical: "#f87171", high: "#fbbf24", normal: "#38bdf8", low: "#64748b",
  };
  const classColor: Record<string, string> = {
    "TOP SECRET": "#f87171", "SECRET": "#fbbf24", "CONFIDENTIAL": "#a78bfa", "UNCLASSIFIED": "#34d399",
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-mono font-black tracking-widest" style={{ color: "#38bdf8" }}>CRAWLER MISSIONS</h2>
          <p className="text-xs font-mono mt-0.5" style={{ color: "#475569" }}>Scheduled acquisition operations — {missions.length} missions registered</p>
        </div>
        <button
          onClick={() => missionsQ.refetch()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-[10px] font-mono font-bold transition-all"
          style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8" }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.12)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.06)"; }}
        >
          <RefreshCw size={11} className={missionsQ.isFetching ? "animate-spin" : ""} />
          REFRESH
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "TOTAL MISSIONS", value: missions.length, icon: Radio, color: "#38bdf8" },
          { label: "ACTIVE", value: missions.filter(m => m.isActive).length, icon: Activity, color: "#34d399" },
          { label: "CURRENTLY RUNNING", value: missions.filter(m => m.isRunning).length, icon: Cpu, color: "#fbbf24" },
          { label: "TOTAL ARTICLES", value: missions.reduce((s, m) => s + (m.totalArticlesCollected ?? 0), 0).toLocaleString(), icon: Database, color: "#a78bfa" },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="rounded-lg p-3" style={{ background: "#111118", border: "1px solid #1e2030" }}>
            <div className="flex items-center gap-2 mb-1">
              <Icon size={12} style={{ color }} />
              <span className="text-[8px] font-mono tracking-widest" style={{ color: "#475569" }}>{label}</span>
            </div>
            <div className="text-xl font-mono font-black" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Mission list */}
      {missionsQ.isLoading ? (
        <div className="flex items-center justify-center h-40 gap-2">
          <Loader2 size={18} className="animate-spin" style={{ color: "#38bdf8" }} />
          <span className="text-[11px] font-mono" style={{ color: "#475569" }}>LOADING MISSIONS...</span>
        </div>
      ) : missions.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 gap-3 rounded-xl" style={{ background: "#111118", border: "1px solid #1e2030" }}>
          <Radio size={24} style={{ color: "rgba(56,189,248,0.15)" }} />
          <span className="text-[11px] font-mono" style={{ color: "#475569" }}>NO MISSIONS CONFIGURED</span>
        </div>
      ) : (
        <div className="space-y-2">
          {missions.map(mission => {
            const isExpanded = expandedId === mission.id;
            const pColor = priorityColor[mission.priority ?? "normal"] ?? "#38bdf8";
            const cColor = classColor[mission.classification ?? "UNCLASSIFIED"] ?? "#34d399";

            return (
              <div
                key={mission.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  background: "#111118",
                  border: `1px solid ${mission.isRunning ? "rgba(56,189,248,0.3)" : "#1e2030"}`,
                  boxShadow: mission.isRunning ? "0 0 20px rgba(56,189,248,0.06)" : "none",
                }}
              >
                {/* Mission row */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : mission.id)}
                >
                  {/* Status dot */}
                  <div className="relative shrink-0">
                    <div
                      className={`w-2.5 h-2.5 rounded-full ${mission.isRunning ? "animate-pulse" : ""}`}
                      style={{ background: mission.isRunning ? "#38bdf8" : mission.isActive ? "#34d399" : "#374151", boxShadow: mission.isRunning ? "0 0 8px rgba(56,189,248,0.8)" : "none" }}
                    />
                  </div>

                  {/* Name + codename */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[12px] font-mono font-bold truncate" style={{ color: mission.isRunning ? "#93c5fd" : "#e2e8f0" }}>
                        {mission.name}
                      </span>
                      {mission.codename && (
                        <span className="text-[8px] font-mono px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.08)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.15)" }}>
                          {mission.codename}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      <span className="text-[8px] font-mono" style={{ color: pColor }}>▲ {(mission.priority ?? "normal").toUpperCase()}</span>
                      <span className="text-[8px] font-mono" style={{ color: cColor }}>🔒 {mission.classification ?? "UNCLASSIFIED"}</span>
                      <span className="text-[8px] font-mono" style={{ color: "#475569" }}>⏱ {mission.cronExpression}</span>
                      <span className="text-[8px] font-mono" style={{ color: "#475569" }}>RUNS: {mission.totalRuns ?? 0}</span>
                      {mission.createdBy && (
                        <span className="flex items-center gap-1 text-[8px] font-mono" style={{ color: "#fbbf24" }}>
                          <User size={7} />
                          {mission.createdBy}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right">
                      <div className="text-[10px] font-mono font-bold" style={{ color: "#a78bfa" }}>{(mission.totalArticlesCollected ?? 0).toLocaleString()}</div>
                      <div className="text-[7px] font-mono" style={{ color: "#475569" }}>ARTICLES</div>
                    </div>
                    {mission.lastRunAt && (
                      <div className="text-right">
                        <div className="text-[9px] font-mono" style={{ color: "#64748b" }}>{fmtRelativeTime(mission.lastRunAt)}</div>
                        <div className="text-[7px] font-mono" style={{ color: "#475569" }}>LAST RUN</div>
                      </div>
                    )}
                    {mission.nextRunAt && !mission.isRunning && (
                      <div className="text-right">
                        <div className="text-[9px] font-mono" style={{ color: "#38bdf8" }}>{fmtRelativeTime(mission.nextRunAt)}</div>
                        <div className="text-[7px] font-mono" style={{ color: "#475569" }}>NEXT RUN</div>
                      </div>
                    )}
                  </div>

                  {/* Controls */}
                  <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
                    {/* Trigger */}
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold transition-all"
                      style={{ background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)", color: mission.isRunning ? "#1e3a2f" : "#34d399" }}
                      onMouseEnter={e => { if (!mission.isRunning) (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(52,211,153,0.06)"; }}
                      onClick={() => triggerMut.mutate({ id: mission.id })}
                      disabled={triggerMut.isPending || !!mission.isRunning}
                      title="Trigger now"
                    >
                      {mission.isRunning ? <Loader2 size={9} className="animate-spin" /> : <Play size={9} />}
                      {mission.isRunning ? "RUNNING" : "RUN"}
                    </button>

                    {/* Pause/Resume */}
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold transition-all"
                      style={{
                        background: mission.isActive ? "rgba(251,191,36,0.06)" : "rgba(52,211,153,0.06)",
                        border: `1px solid ${mission.isActive ? "rgba(251,191,36,0.2)" : "rgba(52,211,153,0.2)"}`,
                        color: mission.isActive ? "#fbbf24" : "#34d399",
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.7"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
                      onClick={() => updateMut.mutate({ id: mission.id, isActive: !mission.isActive })}
                      disabled={updateMut.isPending}
                      title={mission.isActive ? "Pause scheduling" : "Resume scheduling"}
                    >
                      {mission.isActive ? <Pause size={9} /> : <Play size={9} />}
                      {mission.isActive ? "PAUSE" : "RESUME"}
                    </button>

                    {/* Edit */}
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold transition-all"
                      style={{ background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.2)", color: "#a78bfa" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(167,139,250,0.06)"; }}
                      onClick={() => setEditMission(mission as unknown as MissionData)}
                      title="Edit mission parameters"
                    >
                      <Settings size={9} />
                      EDIT
                    </button>

                    {/* History */}
                    <button
                      className="flex items-center gap-1 px-2 py-1 rounded text-[8px] font-mono font-bold transition-all"
                      style={{ background: "rgba(56,189,248,0.06)", border: "1px solid rgba(56,189,248,0.2)", color: "#38bdf8" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.12)"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "rgba(56,189,248,0.06)"; }}
                      onClick={() => setSelectedRunMission({ id: mission.id, name: mission.name })}
                      title="View run history"
                    >
                      <History size={9} />
                      HISTORY
                    </button>

                    {/* Delete */}
                    {confirmDelete === mission.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          className="px-2 py-1 rounded text-[8px] font-mono font-bold"
                          style={{ background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171" }}
                          onClick={() => { deleteMut.mutate({ id: mission.id }); setConfirmDelete(null); }}
                          disabled={deleteMut.isPending}
                        >CONFIRM</button>
                        <button
                          className="px-2 py-1 rounded text-[8px] font-mono"
                          style={{ background: "rgba(100,116,139,0.1)", border: "1px solid rgba(100,116,139,0.2)", color: "#64748b" }}
                          onClick={() => setConfirmDelete(null)}
                        >CANCEL</button>
                      </div>
                    ) : (
                      <button
                        className="p-1.5 rounded transition-all"
                        style={{ color: "#374151", border: "1px solid rgba(248,113,113,0.1)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#f87171"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.3)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "#374151"; (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(248,113,113,0.1)"; }}
                        onClick={() => setConfirmDelete(mission.id)}
                        title="Delete mission"
                      >
                        <Trash2 size={9} />
                      </button>
                    )}

                    {/* Expand toggle */}
                    <button
                      className="p-1 rounded transition-all"
                      style={{ color: "#475569" }}
                    >
                      {isExpanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-4 pb-4" style={{ borderTop: "1px solid rgba(56,189,248,0.06)", background: "rgba(56,189,248,0.01)" }}>
                    <div className="grid grid-cols-3 gap-4 pt-3">
                      {/* Left: Mission info */}
                      <div className="space-y-2">
                        <div className="text-[8px] font-mono tracking-widest mb-2" style={{ color: "rgba(56,189,248,0.4)" }}>MISSION DETAILS</div>
                        {[
                          ["ID", `#${mission.id}`],
                          ["CREATED BY", mission.createdBy ?? "—"],
                          ["CREATED", mission.createdAt ? new Date(mission.createdAt).toLocaleDateString() : "—"],
                          ["SCHEDULE", mission.cronExpression],
                          ["RECURRING", mission.isRecurring ? "YES" : "NO"],
                          ["MIN ARTICLES/RUN", String(mission.minArticlesPerRun ?? 0)],
                        ].map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-[8px] font-mono w-28 shrink-0" style={{ color: "rgba(56,189,248,0.3)" }}>{k}:</span>
                            <span className="text-[8px] font-mono" style={{ color: k === "CREATED BY" ? "#fbbf24" : "#94a3b8" }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Center: Targets */}
                      <div className="space-y-2">
                        <div className="text-[8px] font-mono tracking-widest mb-2" style={{ color: "rgba(56,189,248,0.4)" }}>ACQUISITION TARGETS</div>
                        {[
                          ["COUNTRIES", (mission.targetCountries as string[] ?? []).join(", ") || "ALL"],
                          ["REGIONS", (mission.targetRegions as string[] ?? []).join(", ") || "ALL"],
                          ["TYPES", (mission.targetTypes as string[] ?? []).join(", ") || "ALL"],
                          ["TOPICS", (mission.targetTopics as string[] ?? []).join(", ") || "ALL"],
                          ["AGENCIES", String((mission.targetAgencyIds as number[] ?? []).length || "ALL")],
                        ].map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-[8px] font-mono w-20 shrink-0" style={{ color: "rgba(56,189,248,0.3)" }}>{k}:</span>
                            <span className="text-[8px] font-mono truncate" title={v} style={{ color: "#94a3b8" }}>{v}</span>
                          </div>
                        ))}
                      </div>

                      {/* Right: Run stats */}
                      <div className="space-y-2">
                        <div className="text-[8px] font-mono tracking-widest mb-2" style={{ color: "rgba(56,189,248,0.4)" }}>PERFORMANCE</div>
                        {[
                          ["TOTAL RUNS", String(mission.totalRuns ?? 0)],
                          ["TOTAL ARTICLES", (mission.totalArticlesCollected ?? 0).toLocaleString()],
                          ["AVG/RUN", mission.totalRuns ? Math.round((mission.totalArticlesCollected ?? 0) / mission.totalRuns).toLocaleString() : "—"],
                          ["LAST RUN", fmtRelativeTime(mission.lastRunAt)],
                          ["NEXT RUN", mission.nextRunAt ? fmtRelativeTime(mission.nextRunAt) : "—"],
                        ].map(([k, v]) => (
                          <div key={k} className="flex gap-2">
                            <span className="text-[8px] font-mono w-24 shrink-0" style={{ color: "rgba(56,189,248,0.3)" }}>{k}:</span>
                            <span className="text-[8px] font-mono" style={{ color: "#94a3b8" }}>{v}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Description */}
                    {mission.description && (
                      <div className="mt-3 p-2 rounded" style={{ background: "rgba(56,189,248,0.03)", border: "1px solid rgba(56,189,248,0.06)" }}>
                        <span className="text-[8px] font-mono" style={{ color: "rgba(56,189,248,0.3)" }}>DESCRIPTION: </span>
                        <span className="text-[9px] font-mono" style={{ color: "#64748b" }}>{mission.description}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Run history modal */}
      {selectedRunMission && (
        <MissionRunsPanel
          missionId={selectedRunMission.id}
          missionName={selectedRunMission.name}
          onClose={() => setSelectedRunMission(null)}
        />
      )}

      {/* Edit mission modal */}
      {editMission && (
        <EditMissionModal
          mission={editMission}
          onClose={() => setEditMission(null)}
          onSaved={() => { utils.cms.listMissions.invalidate(); }}
        />
      )}
    </div>
  );
}

// ─── Fake 404 (identical to the real NotFound page) ─────────────────────────
function Fake404() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-lg mx-4 shadow-lg border-0 bg-white/80 backdrop-blur-sm rounded-xl p-8 text-center">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-100 rounded-full animate-pulse" />
            <AlertCircle className="relative h-16 w-16 text-red-500" />
          </div>
        </div>
        <h1 className="text-4xl font-bold text-slate-900 mb-2">404</h1>
        <h2 className="text-xl font-semibold text-slate-700 mb-4">Page Not Found</h2>
        <p className="text-slate-500 mb-8 leading-relaxed">
          Sorry, the page you are looking for doesn't exist.<br />
          It may have been moved or deleted.
        </p>
        <button
          onClick={() => setLocation("/")}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
        >
          <Home className="w-4 h-4" />
          Go Home
        </button>
      </div>
    </div>
  );
}

// ─── Owner Auth Form (Layer 0: establishes CMS session) ─────────────────────
function OwnerAuthForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/owner-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        onSuccess(data.token);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Authentication failed");
      }
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/20 border border-red-700/40 mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-lg font-mono font-bold text-white tracking-wider">SUPER ADMIN ACCESS</h1>
          <p className="text-xs font-mono text-gray-500 mt-2">RESTRICTED AREA • CREDENTIALS REQUIRED</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111118] border border-gray-800 rounded-xl p-6 space-y-5">
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
              placeholder="Enter username"
              autoComplete="off"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
                placeholder="Enter password"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username || !password}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono text-sm font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>

          <div className="text-center pt-2">
            <p className="text-[10px] font-mono text-gray-600">SESSION EXPIRES IN 4 HOURS · IP LOGGED · 3 ATTEMPTS MAX</p>
          </div>
        </form>

        <p className="text-center text-xs font-mono text-gray-600 mt-4">
          This page does not exist for unauthorized users.
        </p>
      </div>
    </div>
  );
}

// ─── Dashboard Tab ──────────────────────────────────────────────────────────
function UpgradeStatsWidget() {
  const { data: upgradeStats, isLoading } = trpc.upgrade.stats.useQuery();
  if (isLoading) return null;
  if (!upgradeStats) return null;
  const portals: Array<{ key: string; label: string; color: string }> = [
    { key: 'intel', label: 'INTEL PLATFORM', color: 'text-red-400' },
    { key: 'orbit', label: 'ORBIT', color: 'text-green-400' },
    { key: 'sigint', label: 'SIGINT', color: 'text-cyan-400' },
    { key: 'contribute', label: 'CONTRIBUTE', color: 'text-yellow-400' },
  ];
  return (
    <div className="bg-[#111118] border border-red-900/40 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-mono text-red-400 uppercase tracking-wider flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(248,113,113,0.9)" stroke="none"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
          Upgrade Interest
        </h3>
        <span className="text-2xl font-mono text-red-400 font-bold">{upgradeStats.total.toLocaleString()} <span className="text-sm text-gray-500">total clicks</span></span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {portals.map(p => (
          <div key={p.key} className="bg-[#0a0a0f] rounded-lg p-3 text-center">
            <div className={`text-xl font-mono font-bold ${p.color}`}>
              {(upgradeStats.byPortal[p.key] ?? 0).toLocaleString()}
            </div>
            <div className="text-[10px] font-mono text-gray-500 mt-1 tracking-wider">{p.label}</div>
          </div>
        ))}
      </div>
      {upgradeStats.recentClicks.length > 0 && (
        <div>
          <div className="text-xs font-mono text-gray-500 uppercase tracking-wider mb-2">Recent Clicks (last 50)</div>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {upgradeStats.recentClicks.map((c: { id: number; portal: string; clickedAt: Date | null; referrer: string | null }) => (
              <div key={c.id} className="flex items-center justify-between px-3 py-1.5 bg-[#0a0a0f] rounded text-xs font-mono">
                <span className="text-red-400 uppercase">{c.portal}</span>
                <span className="text-gray-500">{c.referrer || '—'}</span>
                <span className="text-gray-600">{c.clickedAt ? new Date(c.clickedAt).toLocaleString() : '—'}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardTab() {
  const { data: stats, isLoading } = trpc.cms.getTrafficStats.useQuery();

  if (isLoading) return <LoadingState />;
  if (!stats) return <div className="text-gray-500 font-mono text-sm">No data available</div>;

  return (
    <div className="space-y-6">
      {/* Upgrade Interest Stats */}
      <UpgradeStatsWidget />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard label="TOTAL USERS" value={stats.totalUsers} icon={<Users className="w-5 h-5" />} />
        <StatCard label="ADMINS" value={stats.roleCounts?.admin || 0} icon={<Shield className="w-5 h-5" />} color="red" />
        <StatCard label="ACTIVE (7D)" value={stats.activeUsersLast7d} icon={<Activity className="w-5 h-5" />} color="green" />
        <StatCard label="NEW (7D)" value={stats.recentRegistrations} icon={<BarChart3 className="w-5 h-5" />} color="cyan" />
        <StatCard label="PENDING" value={stats.pendingRegistrations || 0} icon={<UserPlus className="w-5 h-5" />} color="yellow" />
      </div>

      {/* Recent Activity Breakdown */}
      <div className="bg-[#111118] border border-gray-800 rounded-lg p-5">
        <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider mb-4">Activity (Last 24h)</h3>
        {stats.recentActivity && stats.recentActivity.length > 0 ? (
          <div className="space-y-2">
            {stats.recentActivity.map((a: { action: string; count: number }, i: number) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 bg-[#0a0a0f] rounded">
                <span className="text-sm font-mono text-gray-300">{a.action}</span>
                <span className="text-sm font-mono text-red-400 font-bold">{a.count}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-600 font-mono text-sm">No activity in the last 24 hours.</p>
        )}
      </div>

      {/* Total Activity */}
      <div className="bg-[#111118] border border-gray-800 rounded-lg p-5">
        <div className="flex items-center justify-between">
          <span className="text-sm font-mono text-gray-400 uppercase tracking-wider">Total Activity Logs</span>
          <span className="text-2xl font-mono text-white font-bold">{stats.totalActivityLogs.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color = "white" }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  const colorMap: Record<string, string> = {
    white: "text-white border-gray-700",
    red: "text-red-400 border-red-900/50",
    green: "text-green-400 border-green-900/50",
    cyan: "text-cyan-400 border-cyan-900/50",
    yellow: "text-yellow-400 border-yellow-900/50",
  };
  return (
    <div className={`bg-[#111118] border ${colorMap[color]?.split(" ")[1] || "border-gray-700"} rounded-lg p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={colorMap[color]?.split(" ")[0] || "text-white"}>{icon}</span>
        <span className="text-xs font-mono text-gray-500 uppercase tracking-wider">{label}</span>
      </div>
      <p className={`text-3xl font-mono font-bold ${colorMap[color]?.split(" ")[0] || "text-white"}`}>{value.toLocaleString()}</p>
    </div>
  );
}

// ─── Users Tab ──────────────────────────────────────────────────────────────
function UsersTab() {
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"admin" | "user" | "">("");
  const [page, setPage] = useState(1);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  const queryInput = useMemo(() => ({
    page,
    limit: 50,
    search: search || undefined,
    role: (roleFilter || undefined) as "admin" | "user" | undefined,
  }), [page, search, roleFilter]);

  const { data, isLoading, refetch } = trpc.cms.listUsers.useQuery(queryInput);
  const updateRole = trpc.cms.updateUserRole.useMutation({ onSuccess: () => refetch() });
  const deleteUser = trpc.cms.deleteUser.useMutation({ onSuccess: () => { refetch(); setDeleteConfirm(null); } });

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by email or name..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => { setRoleFilter(e.target.value as "admin" | "user" | ""); setPage(1); }}
          className="px-4 py-2.5 bg-[#111118] border border-gray-800 rounded text-white font-mono text-sm focus:outline-none focus:border-red-700/60"
        >
          <option value="">All Roles</option>
          <option value="admin">Admin</option>
          <option value="user">User</option>
        </select>
        <button onClick={() => refetch()} className="px-4 py-2.5 bg-[#111118] border border-gray-800 rounded text-gray-400 hover:text-white hover:border-red-700/60 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Users Table */}
      {isLoading ? <LoadingState /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Email</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Role</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Method</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Reg Key</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Last Login</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data?.users.map((u) => (
                <tr key={u.id} className="border-b border-gray-800/50 hover:bg-[#111118]/50 transition-colors">
                  <td className="px-4 py-3 text-sm font-mono text-gray-400">#{u.id}</td>
                  <td className="px-4 py-3 text-sm font-mono text-white">{u.name || "—"}</td>
                  <td className="px-4 py-3 text-sm font-mono text-gray-300">{u.email || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold uppercase ${u.role === "admin" ? "bg-red-900/30 text-red-400 border border-red-800/40" : "bg-gray-800 text-gray-400 border border-gray-700"}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{u.loginMethod || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-cyan-400/70">
                    <UserRegKey email={u.email} />
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">
                    {u.lastSignedIn ? new Date(u.lastSignedIn).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {u.role === "user" ? (
                        <button
                          onClick={() => updateRole.mutate({ userId: u.id, role: "admin" })}
                          disabled={updateRole.isPending}
                          className="p-1.5 rounded bg-red-900/20 border border-red-800/30 text-red-400 hover:bg-red-900/40 transition-colors"
                          title="Promote to Admin"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                      ) : (
                        <button
                          onClick={() => updateRole.mutate({ userId: u.id, role: "user" })}
                          disabled={updateRole.isPending}
                          className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:bg-gray-700 transition-colors"
                          title="Demote to User"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {deleteConfirm === u.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => deleteUser.mutate({ userId: u.id })}
                            disabled={deleteUser.isPending}
                            className="px-2 py-1 rounded bg-red-700 text-white text-xs font-mono hover:bg-red-600"
                          >
                            CONFIRM
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(null)}
                            className="px-2 py-1 rounded bg-gray-800 text-gray-400 text-xs font-mono hover:bg-gray-700"
                          >
                            CANCEL
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirm(u.id)}
                          className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800/40 transition-colors"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <div className="flex items-center justify-between mt-4 px-4">
              <span className="text-xs font-mono text-gray-500">
                Showing {data.users.length} of {data.total} users
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  PREV
                </button>
                <span className="px-3 py-1.5 text-xs font-mono text-gray-500">Page {page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data || data.users.length < data.limit}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Pending Registrations Tab ──────────────────────────────────────────────
function PendingTab() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [page, setPage] = useState(1);
  const [rejectNotes, setRejectNotes] = useState<Record<number, string>>({});
  const [confirmReject, setConfirmReject] = useState<number | null>(null);

  const queryInput = useMemo(() => ({
    status: statusFilter,
    page,
    limit: 50,
  }), [statusFilter, page]);

  const { data, isLoading, refetch } = trpc.cms.listPendingRegistrations.useQuery(queryInput);
  const approve = trpc.cms.approveRegistration.useMutation({ onSuccess: () => refetch() });
  const reject = trpc.cms.rejectRegistration.useMutation({ onSuccess: () => { refetch(); setConfirmReject(null); } });

  return (
    <div className="space-y-4">
      {/* Status Filter */}
      <div className="flex gap-3 items-center">
        <div className="flex gap-1">
          {(["pending", "approved", "rejected", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); }}
              className={`px-3 py-1.5 rounded text-xs font-mono uppercase tracking-wider transition-colors ${
                statusFilter === s
                  ? "bg-red-900/30 text-red-400 border border-red-800/40"
                  : "bg-[#111118] text-gray-500 border border-gray-800 hover:text-gray-300"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button onClick={() => refetch()} className="px-3 py-1.5 bg-[#111118] border border-gray-800 rounded text-gray-400 hover:text-white hover:border-red-700/60 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Requests */}
      {isLoading ? <LoadingState /> : (
        <div className="space-y-3">
          {data?.requests.length === 0 && (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">
              No {statusFilter === "all" ? "" : statusFilter} registration requests.
            </div>
          )}
          {data?.requests.map((req) => (
            <div key={req.id} className="bg-[#111118] border border-gray-800 rounded-lg p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <UserPlus className="w-4 h-4 text-yellow-400 shrink-0" />
                    <span className="text-sm font-mono text-white font-bold truncate">{req.email}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono uppercase ${
                      req.status === "pending" ? "bg-yellow-900/30 text-yellow-400 border border-yellow-800/40" :
                      req.status === "approved" ? "bg-green-900/30 text-green-400 border border-green-800/40" :
                      "bg-red-900/30 text-red-400 border border-red-800/40"
                    }`}>
                      {req.status}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-4 text-xs font-mono text-gray-500">
                    {req.name && <span>Name: {req.name}</span>}
                    {req.ipAddress && <span>IP: {req.ipAddress}</span>}
                    {(req as any).usedKey && <span className="text-cyan-400">Key: {(req as any).usedKey.substring(0, 8)}...</span>}
                    <span>Requested: {req.requestedAt ? new Date(req.requestedAt).toLocaleString() : "—"}</span>
                    {req.reviewedAt && <span>Reviewed: {new Date(req.reviewedAt).toLocaleString()}</span>}
                  </div>
                  {req.notes && (
                    <div className="mt-2 text-xs font-mono text-gray-500 italic">Notes: {req.notes}</div>
                  )}
                </div>

                {/* Actions */}
                {req.status === "pending" && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => approve.mutate({ requestId: req.id })}
                      disabled={approve.isPending}
                      className="px-3 py-1.5 rounded bg-green-900/30 border border-green-800/40 text-green-400 text-xs font-mono uppercase hover:bg-green-900/50 disabled:opacity-30 transition-colors"
                    >
                      {approve.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "APPROVE"}
                    </button>
                    {confirmReject === req.id ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rejectNotes[req.id] || ""}
                          onChange={(e) => setRejectNotes(prev => ({ ...prev, [req.id]: e.target.value }))}
                          placeholder="Reason (optional)..."
                          className="px-2 py-1 bg-[#0a0a0f] border border-gray-700 rounded text-white font-mono text-xs w-32 focus:outline-none focus:border-red-700/60"
                        />
                        <button
                          onClick={() => reject.mutate({ requestId: req.id, notes: rejectNotes[req.id] || undefined })}
                          disabled={reject.isPending}
                          className="px-2 py-1 rounded bg-red-700 text-white text-xs font-mono"
                        >
                          CONFIRM
                        </button>
                        <button
                          onClick={() => setConfirmReject(null)}
                          className="p-1 text-gray-500 hover:text-white"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmReject(req.id)}
                        className="px-3 py-1.5 rounded bg-red-900/30 border border-red-800/40 text-red-400 text-xs font-mono uppercase hover:bg-red-900/50 transition-colors"
                      >
                        REJECT
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {data && data.total > data.limit && (
            <div className="flex items-center justify-between mt-4 px-4">
              <span className="text-xs font-mono text-gray-500">
                Showing {data.requests.length} of {data.total}
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  PREV
                </button>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={data.requests.length < data.limit}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Activity Log Tab ───────────────────────────────────────────────────────
function ActivityLogTab() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("");
  const { data, isLoading, refetch } = trpc.cms.getActivityLogs.useQuery({
    page,
    limit: 50,
    action: actionFilter || undefined,
  });

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Activity className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={actionFilter}
            onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
            placeholder="Filter by action (e.g. auth.login, cms.updateRole)..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
          />
        </div>
        <button onClick={() => refetch()} className="px-4 py-2.5 bg-[#111118] border border-gray-800 rounded text-gray-400 hover:text-white hover:border-red-700/60 transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {isLoading ? <LoadingState /> : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Time</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Action</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">User</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Target</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">IP</th>
                <th className="px-4 py-3 text-xs font-mono text-gray-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody>
              {data?.logs.map((log) => (
                <tr key={log.id} className="border-b border-gray-800/50 hover:bg-[#111118]/50 transition-colors">
                  <td className="px-4 py-3 text-xs font-mono text-gray-500 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3 h-3" />
                      {log.createdAt ? new Date(log.createdAt).toLocaleString() : "—"}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-bold bg-red-900/20 text-red-400 border border-red-800/30">
                      {log.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-300">{log.userEmail || `#${log.userId}` || "system"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-500">{log.target || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600">{log.ipAddress || "—"}</td>
                  <td className="px-4 py-3 text-xs font-mono text-gray-600 max-w-[200px] truncate" title={log.details || ""}>
                    {log.details || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data && (
            <div className="flex items-center justify-between mt-4 px-4">
              <span className="text-xs font-mono text-gray-500">
                Showing {data.logs.length} of {data.total} logs
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  PREV
                </button>
                <span className="px-3 py-1.5 text-xs font-mono text-gray-500">Page {page}</span>
                <button
                  onClick={() => setPage(p => p + 1)}
                  disabled={!data || data.logs.length < 50}
                  className="px-3 py-1.5 rounded bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono disabled:opacity-30 hover:border-red-700/60"
                >
                  NEXT
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Quotas Tab (LLM Quota Management) ─────────────────────────────────────
function QuotasTab() {
  const { data: quotas, isLoading } = trpc.cms.listQuotas.useQuery();
  const { data: allUsers } = trpc.cms.listUsers.useQuery({ search: "", page: 1, limit: 100 });
  const utils = trpc.useUtils();
  const setQuota = trpc.cms.setQuota.useMutation({ onSuccess: () => utils.cms.listQuotas.invalidate() });
  const resetQuota = trpc.cms.resetQuota.useMutation({ onSuccess: () => utils.cms.listQuotas.invalidate() });
  const bulkSetQuota = trpc.cms.bulkSetQuota.useMutation({ onSuccess: () => utils.cms.listQuotas.invalidate() });

  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [monthlyLimit, setMonthlyLimit] = useState(1000);
  const [bulkDaily, setBulkDaily] = useState(50);
  const [bulkMonthly, setBulkMonthly] = useState(1000);
  const [addUserId, setAddUserId] = useState<string>("");

  // Users without quotas (for adding)
  const usersWithoutQuota = useMemo(() => {
    if (!allUsers?.users || !quotas) return [];
    const quotaUserIds = new Set(quotas.map((q: { userId: number }) => q.userId));
    return allUsers.users.filter(u => !quotaUserIds.has(u.id));
  }, [allUsers, quotas]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-red-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Bulk Set */}
      <div className="p-4 bg-[#111118] border border-gray-800 rounded-lg">
        <h3 className="text-sm font-mono font-bold text-white mb-3 flex items-center gap-2">
          <Zap className="w-4 h-4 text-yellow-400" />
          BULK QUOTA SETTINGS
        </h3>
        <p className="text-xs text-gray-500 font-mono mb-3">Set default limits for all users at once.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-gray-400 uppercase">Daily:</label>
            <input
              type="number"
              value={bulkDaily}
              onChange={(e) => setBulkDaily(Number(e.target.value))}
              className="w-20 px-2 py-1.5 bg-[#0a0a0f] border border-gray-800 rounded text-white font-mono text-xs focus:outline-none focus:border-red-700/60"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-mono text-gray-400 uppercase">Monthly:</label>
            <input
              type="number"
              value={bulkMonthly}
              onChange={(e) => setBulkMonthly(Number(e.target.value))}
              className="w-24 px-2 py-1.5 bg-[#0a0a0f] border border-gray-800 rounded text-white font-mono text-xs focus:outline-none focus:border-red-700/60"
            />
          </div>
          <button
            onClick={() => bulkSetQuota.mutate({ dailyLimit: bulkDaily, monthlyLimit: bulkMonthly })}
            disabled={bulkSetQuota.isPending}
            className="px-3 py-1.5 bg-yellow-900/40 border border-yellow-700/40 rounded text-yellow-300 text-xs font-mono hover:bg-yellow-800/50 transition-colors disabled:opacity-50"
          >
            {bulkSetQuota.isPending ? "Applying..." : "APPLY TO ALL"}
          </button>
        </div>
      </div>

      {/* Add User Quota */}
      {usersWithoutQuota.length > 0 && (
        <div className="p-4 bg-[#111118] border border-gray-800 rounded-lg">
          <h3 className="text-sm font-mono font-bold text-white mb-3">ADD USER QUOTA</h3>
          <div className="flex items-center gap-3">
            <select
              value={addUserId}
              onChange={(e) => setAddUserId(e.target.value)}
              className="flex-1 px-3 py-2 bg-[#0a0a0f] border border-gray-800 rounded text-white font-mono text-xs focus:outline-none focus:border-red-700/60"
            >
              <option value="">Select user...</option>
              {usersWithoutQuota.map(u => (
                <option key={u.id} value={u.id}>{u.email || u.name || `User #${u.id}`}</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!addUserId) return;
                setQuota.mutate({ userId: Number(addUserId), dailyLimit: 50, monthlyLimit: 1000 });
                setAddUserId("");
              }}
              disabled={!addUserId || setQuota.isPending}
              className="px-3 py-2 bg-green-900/40 border border-green-700/40 rounded text-green-300 text-xs font-mono hover:bg-green-800/50 transition-colors disabled:opacity-50"
            >
              ADD
            </button>
          </div>
        </div>
      )}

      {/* Quotas Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-gray-800 text-gray-500">
              <th className="text-left py-2 px-3">USER</th>
              <th className="text-center py-2 px-3">DAILY (USED/LIMIT)</th>
              <th className="text-center py-2 px-3">MONTHLY (USED/LIMIT)</th>
              <th className="text-center py-2 px-3">% USED</th>
              <th className="text-right py-2 px-3">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {(!quotas || quotas.length === 0) ? (
              <tr>
                <td colSpan={5} className="text-center py-8 text-gray-600">
                  No quotas configured. Add users above to set limits.
                </td>
              </tr>
            ) : quotas.map((q: { id: number; userId: number; dailyLimit: number; monthlyLimit: number; usedToday: number; usedThisMonth: number; userName: string | null; userEmail: string | null; userRole: string | null }) => {
              const dailyPct = q.dailyLimit > 0 ? Math.round((q.usedToday / q.dailyLimit) * 100) : 0;
              const monthlyPct = q.monthlyLimit > 0 ? Math.round((q.usedThisMonth / q.monthlyLimit) * 100) : 0;
              const maxPct = Math.max(dailyPct, monthlyPct);
              const isEditing = editingUser === q.userId;

              return (
                <tr key={q.id} className="border-b border-gray-800/50 hover:bg-[#111118]/50">
                  <td className="py-2.5 px-3">
                    <div className="text-white">{q.userEmail || q.userName || `User #${q.userId}`}</div>
                    <div className="text-gray-600 text-[10px]">{q.userRole}</div>
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={dailyLimit}
                        onChange={(e) => setDailyLimit(Number(e.target.value))}
                        className="w-16 px-1 py-0.5 bg-[#0a0a0f] border border-red-700/50 rounded text-white text-center"
                      />
                    ) : (
                      <span className={dailyPct >= 90 ? "text-red-400" : dailyPct >= 70 ? "text-yellow-400" : "text-green-400"}>
                        {q.usedToday}/{q.dailyLimit}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    {isEditing ? (
                      <input
                        type="number"
                        value={monthlyLimit}
                        onChange={(e) => setMonthlyLimit(Number(e.target.value))}
                        className="w-20 px-1 py-0.5 bg-[#0a0a0f] border border-red-700/50 rounded text-white text-center"
                      />
                    ) : (
                      <span className={monthlyPct >= 90 ? "text-red-400" : monthlyPct >= 70 ? "text-yellow-400" : "text-green-400"}>
                        {q.usedThisMonth}/{q.monthlyLimit}
                      </span>
                    )}
                  </td>
                  <td className="text-center py-2.5 px-3">
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full transition-all ${
                          maxPct >= 90 ? "bg-red-500" : maxPct >= 70 ? "bg-yellow-500" : "bg-green-500"
                        }`}
                        style={{ width: `${Math.min(maxPct, 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-gray-500">{maxPct}%</span>
                  </td>
                  <td className="text-right py-2.5 px-3">
                    <div className="flex items-center justify-end gap-1">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              setQuota.mutate({ userId: q.userId, dailyLimit, monthlyLimit });
                              setEditingUser(null);
                            }}
                            className="px-2 py-1 bg-green-900/40 border border-green-700/40 rounded text-green-300 text-[10px] hover:bg-green-800/50"
                          >
                            SAVE
                          </button>
                          <button
                            onClick={() => setEditingUser(null)}
                            className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-gray-400 text-[10px] hover:bg-gray-700"
                          >
                            CANCEL
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingUser(q.userId);
                              setDailyLimit(q.dailyLimit);
                              setMonthlyLimit(q.monthlyLimit);
                            }}
                            className="px-2 py-1 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 text-[10px] hover:text-white"
                          >
                            EDIT
                          </button>
                          <button
                            onClick={() => resetQuota.mutate({ userId: q.userId, resetType: "daily" })}
                            className="px-2 py-1 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 text-[10px] hover:text-cyan-400"
                            title="Reset daily usage"
                          >
                            D↺
                          </button>
                          <button
                            onClick={() => resetQuota.mutate({ userId: q.userId, resetType: "both" })}
                            className="px-2 py-1 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 text-[10px] hover:text-yellow-400"
                            title="Reset all usage"
                          >
                            ALL↺
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Info */}
      <div className="p-3 bg-[#0d0d14] border border-gray-800/50 rounded-lg">
        <p className="text-[10px] text-gray-500 font-mono">
          <span className="text-gray-400">Note:</span> Quotas are automatically reset daily at midnight UTC and monthly on the 1st.
          LLM calls that exceed the quota will be rejected with a rate limit error.
        </p>
      </div>
    </div>
  );
}

// ─── Sessions Tab (Admin session management) ───────────────────────────────────
function SessionsTab() {
  const { data: sessions, isLoading, refetch } = trpc.cms.getActiveSessions.useQuery();
  const setDuration = trpc.cms.setUserSessionDuration.useMutation({
    onSuccess: () => refetch(),
  });
  const terminateSession = trpc.cms.terminateUserSession.useMutation({
    onSuccess: () => refetch(),
  });
  const [editingDuration, setEditingDuration] = useState<{ userId: number; current: number } | null>(null);
  const [newDuration, setNewDuration] = useState("");

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-mono text-white">Active Sessions</h2>
          <p className="text-xs font-mono text-gray-500">Manage authenticated user sessions. Default duration: 3 hours.</p>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded bg-[#111118] border border-gray-800 text-gray-400 hover:text-white transition-colors">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {(!sessions || sessions.length === 0) ? (
        <div className="text-center py-12">
          <Timer className="w-10 h-10 text-gray-700 mx-auto mb-3" />
          <p className="text-sm font-mono text-gray-500">No active sessions</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any) => {
            const expired = s.expiresAt ? Date.now() > new Date(s.expiresAt).getTime() : false;
            const expiresIn = s.expiresAt ? new Date(s.expiresAt).getTime() - Date.now() : 0;
            const minutesLeft = Math.max(0, Math.floor(expiresIn / 60000));
            const hoursLeft = Math.floor(minutesLeft / 60);
            const minsLeft = minutesLeft % 60;
            const timeStr = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;

            return (
              <div key={s.id} className="bg-[#111118] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-900/50 to-gray-900 border border-red-800/30 flex items-center justify-center">
                      <span className="text-[10px] font-mono font-bold text-red-400">
                        {(s.userName || s.userEmail || "U").charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-mono text-white">{s.userName || s.userEmail || `User #${s.userId}`}</div>
                      <div className="text-[10px] font-mono text-gray-500">
                        {s.userEmail} · <span className="uppercase">{s.userRole}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {/* Time remaining */}
                    <div className="text-right">
                      <div className={`text-sm font-mono font-bold ${expired ? "text-red-400" : minutesLeft < 30 ? "text-yellow-400" : "text-green-400"}`}>
                        {expired ? "EXPIRED" : timeStr}
                      </div>
                      <div className="text-[10px] font-mono text-gray-600">
                        Duration: {s.sessionDurationMinutes}min
                      </div>
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingDuration({ userId: s.userId, current: s.sessionDurationMinutes });
                          setNewDuration(String(s.sessionDurationMinutes));
                        }}
                        className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-400 hover:text-cyan-400 hover:border-cyan-800/40 transition-colors"
                        title="Set session duration"
                      >
                        <Clock className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Terminate session for ${s.userName || s.userEmail}?`)) {
                            terminateSession.mutate({ sessionId: s.id });
                          }
                        }}
                        disabled={terminateSession.isPending}
                        className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-500 hover:text-red-400 hover:border-red-800/40 transition-colors"
                        title="Terminate session"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
                {/* Additional info */}
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] font-mono text-gray-600">
                  {s.ipAddress && <span>IP: {s.ipAddress}</span>}
                  <span>Last activity: {s.lastActivity ? new Date(s.lastActivity).toLocaleString() : "—"}</span>
                  <span>Started: {s.createdAt ? new Date(s.createdAt).toLocaleString() : "—"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Duration Edit Modal */}
      {editingDuration && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-[#111118] border border-gray-800 rounded-lg p-6 w-80">
            <h3 className="text-sm font-mono font-bold text-white mb-4">Set Session Duration</h3>
            <p className="text-xs font-mono text-gray-500 mb-3">User #{editingDuration.userId} · Current: {editingDuration.current} min</p>
            <div className="flex gap-2 mb-4">
              {[60, 120, 180, 360, 720, 1440].map(d => (
                <button
                  key={d}
                  onClick={() => setNewDuration(String(d))}
                  className={`px-2 py-1 rounded text-[10px] font-mono border transition-colors ${
                    newDuration === String(d)
                      ? "border-cyan-600 bg-cyan-900/20 text-cyan-400"
                      : "border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600"
                  }`}
                >
                  {d < 60 ? `${d}m` : `${d / 60}h`}
                </button>
              ))}
            </div>
            <input
              type="number"
              value={newDuration}
              onChange={(e) => setNewDuration(e.target.value)}
              className="w-full px-3 py-2 bg-[#0a0a0f] border border-gray-700 rounded text-sm font-mono text-white mb-4"
              placeholder="Minutes (15-1440)"
              min={15}
              max={1440}
            />
            <div className="flex gap-2">
              <button
                onClick={() => setEditingDuration(null)}
                className="flex-1 px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-400 text-xs font-mono hover:bg-gray-700 transition-colors"
              >
                CANCEL
              </button>
              <button
                onClick={() => {
                  const mins = parseInt(newDuration);
                  if (mins >= 15 && mins <= 1440) {
                    setDuration.mutate({ userId: editingDuration.userId, durationMinutes: mins });
                    setEditingDuration(null);
                  }
                }}
                disabled={setDuration.isPending}
                className="flex-1 px-3 py-2 rounded bg-cyan-900/30 border border-cyan-700/50 text-cyan-400 text-xs font-mono hover:bg-cyan-900/50 transition-colors"
              >
                {setDuration.isPending ? "SAVING..." : "SAVE"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab (with Key Expiry) ─────────────────────────────────────────
function SettingsTab() {
  const [showKey, setShowKey] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [rotateSuccess, setRotateSuccess] = useState(false);
  const [expiryDays, setExpiryDays] = useState<number>(0); // 0 = never
  const [expandedKeyHistory, setExpandedKeyHistory] = useState<number | null>(null);

  const { data: keyData, refetch: refetchKey } = trpc.cms.getAdminSecretKey.useQuery();
  const { data: settings, refetch: refetchSettings } = trpc.cms.getSettings.useQuery();
  const { data: keyHistoryData, refetch: refetchKeyHistory } = trpc.cms.getKeyHistory.useQuery();
  const { data: randomKeyData, refetch: generateNewKey } = trpc.cms.generateRandomKey.useQuery(undefined, { enabled: false });
  const rotateKey = trpc.cms.rotateAdminSecretKey.useMutation({
    onSuccess: () => {
      setNewKey("");
      setRotateSuccess(true);
      refetchKey();
      refetchKeyHistory();
      setTimeout(() => setRotateSuccess(false), 3000);
    },
  });
  const updateSetting = trpc.cms.updateSetting.useMutation({ onSuccess: () => refetchSettings() });

  // Parse expiry info
  const expiresAt = keyData?.expiresAt && keyData.expiresAt !== "never" ? new Date(keyData.expiresAt) : null;
  const isExpired = expiresAt ? Date.now() > expiresAt.getTime() : false;
  const timeRemaining = expiresAt ? expiresAt.getTime() - Date.now() : null;
  const hoursRemaining = timeRemaining ? Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60))) : null;
  const daysRemaining = timeRemaining ? Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60 * 24))) : null;

  // Set expiry days from stored data
  useEffect(() => {
    if (keyData?.expiryDays) {
      setExpiryDays(parseInt(keyData.expiryDays) || 0);
    }
  }, [keyData?.expiryDays]);

  // Build full URLs — paths are read from env so they are never hardcoded in source
  const REGISTER_PATH = import.meta.env.VITE_REGISTER_PATH || "/registerme-please";
  const LOGIN_PATH    = import.meta.env.VITE_LOGIN_PATH    || "/access-granted-login";
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
  const registrationUrl = keyData?.key ? `${baseUrl}${REGISTER_PATH}?key=${keyData.key}` : "";
  const loginUrl = keyData?.key ? `${baseUrl}${LOGIN_PATH}?key=${keyData.key}` : "";

  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const handleRotate = useCallback(() => {
    if (newKey.length >= 8) {
      rotateKey.mutate({ newKey, expiryDays: expiryDays || undefined });
    }
  }, [newKey, expiryDays, rotateKey]);

  const handleGenerateRandom = useCallback(async () => {
    const result = await generateNewKey();
    if (result.data?.key) {
      setNewKey(result.data.key);
    }
  }, [generateNewKey]);

  return (
    <div className="space-y-6">
      {/* Quick Share URLs */}
      <div className="bg-[#111118] border border-cyan-900/40 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Link2 className="w-5 h-5 text-cyan-400" />
          <h3 className="text-sm font-mono text-cyan-400 uppercase tracking-wider font-bold">Quick Share URLs</h3>
        </div>
        <p className="text-xs font-mono text-gray-500 mb-4">
          Copy these full URLs to share with trusted users. They include the current secret key.
        </p>

        {/* Registration URL */}
        <div className="space-y-3">
          <div>
            <label className="text-xs font-mono text-gray-500 uppercase mb-1 block">Registration URL (Admin Request)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded font-mono text-xs text-gray-300 truncate">
                {registrationUrl || "Loading..."}
              </div>
              <button
                onClick={() => handleCopy(registrationUrl, "reg")}
                className="px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 text-xs font-mono"
              >
                {copied === "reg" ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "reg" ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>

          {/* Login URL */}
          <div>
            <label className="text-xs font-mono text-gray-500 uppercase mb-1 block">Login URL (Authenticated Access)</label>
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded font-mono text-xs text-gray-300 truncate">
                {loginUrl || "Loading..."}
              </div>
              <button
                onClick={() => handleCopy(loginUrl, "login")}
                className="px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 hover:text-cyan-400 transition-colors flex items-center gap-1.5 text-xs font-mono"
              >
                {copied === "login" ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "login" ? "COPIED" : "COPY"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Admin Secret Key Section */}
      <div className="bg-[#111118] border border-red-900/40 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Key className="w-5 h-5 text-red-400" />
          <h3 className="text-sm font-mono text-red-400 uppercase tracking-wider font-bold">Admin Registration Key</h3>
          <div className="ml-auto flex items-center gap-1.5 text-xs font-mono text-gray-500">
            <Bell className="w-3.5 h-3.5" />
            Owner notified on rotation
          </div>
        </div>
        <p className="text-xs font-mono text-gray-500 mb-4">
          Share this key with trusted users to grant them admin access via the Registration URL above.
          Registrations require your approval before access is granted.
        </p>

        {/* Expiry Status */}
        {expiresAt && (
          <div className={`flex items-center gap-2 mb-4 px-3 py-2 rounded border ${
            isExpired
              ? "bg-red-900/20 border-red-800/40 text-red-400"
              : hoursRemaining !== null && hoursRemaining < 24
                ? "bg-yellow-900/20 border-yellow-800/40 text-yellow-400"
                : "bg-green-900/20 border-green-800/40 text-green-400"
          }`}>
            {isExpired ? (
              <>
                <AlertTriangle className="w-4 h-4" />
                <span className="text-xs font-mono font-bold">KEY EXPIRED — registration links are dead. Rotate to reactivate.</span>
              </>
            ) : (
              <>
                <Timer className="w-4 h-4" />
                <span className="text-xs font-mono">
                  Expires in {daysRemaining !== null && daysRemaining > 0 ? `${daysRemaining}d ${hoursRemaining! % 24}h` : `${hoursRemaining}h`}
                  {" "}({expiresAt.toLocaleDateString()} {expiresAt.toLocaleTimeString()})
                </span>
              </>
            )}
          </div>
        )}

        {/* Current Key */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex-1 px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded font-mono text-sm text-white">
            {showKey ? keyData?.key || "Loading..." : "••••••••••••••••••••••••"}
          </div>
          <button
            onClick={() => setShowKey(!showKey)}
            className="p-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleCopy(keyData?.key || "", "key")}
            className="p-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 hover:text-white transition-colors"
          >
            {copied === "key" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>

        {/* Rotate Key with Expiry */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newKey}
              onChange={(e) => setNewKey(e.target.value)}
              placeholder="New key (min 8 chars)..."
              className="flex-1 px-3 py-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
            />
            <button
              onClick={handleGenerateRandom}
              className="p-2.5 bg-[#0a0a0f] border border-gray-800 rounded text-gray-400 hover:text-cyan-400 transition-colors"
              title="Generate random key"
            >
              <Shuffle className="w-4 h-4" />
            </button>
          </div>

          {/* Expiry Selector */}
          <div className="flex items-center gap-3">
            <Timer className="w-4 h-4 text-gray-500" />
            <span className="text-xs font-mono text-gray-500">Expires after:</span>
            <div className="flex gap-1">
              {[
                { label: "Never", value: 0 },
                { label: "7d", value: 7 },
                { label: "14d", value: 14 },
                { label: "30d", value: 30 },
                { label: "90d", value: 90 },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setExpiryDays(opt.value)}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors ${
                    expiryDays === opt.value
                      ? "bg-red-900/30 text-red-400 border border-red-800/40"
                      : "bg-[#0a0a0f] text-gray-500 border border-gray-800 hover:text-gray-300"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleRotate}
            disabled={newKey.length < 8 || rotateKey.isPending}
            className="w-full px-4 py-2.5 bg-red-900/30 border border-red-800/40 rounded text-red-400 font-mono text-xs uppercase tracking-wider hover:bg-red-900/50 disabled:opacity-30 transition-colors"
          >
            {rotateKey.isPending ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "ROTATE KEY & SET EXPIRY"}
          </button>
        </div>

        {rotateSuccess && (
          <div className="mt-3 flex items-center gap-2 text-green-400 text-xs font-mono">
            <CheckCircle className="w-4 h-4" />
            Key rotated successfully. Old links will no longer work. Owner notified.
          </div>
        )}
      </div>

      {/* Key History */}
      <div className="bg-[#111118] border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider font-bold">Key History</h3>
          <button onClick={() => refetchKeyHistory()} className="ml-auto p-1.5 rounded bg-[#0a0a0f] border border-gray-800 text-gray-500 hover:text-white transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
        {keyHistoryData && keyHistoryData.length > 0 ? (
          <div className="space-y-2">
            {keyHistoryData.map((kh: any) => {
              const khExpired = kh.expiresAt ? Date.now() > new Date(kh.expiresAt).getTime() : false;
              const isExpanding = expandedKeyHistory === kh.id;
              return (
                <div key={kh.id} className={`border rounded-lg overflow-hidden ${
                  kh.isActive ? "border-green-800/40 bg-green-900/5" : khExpired ? "border-red-800/30 bg-red-900/5" : "border-gray-800 bg-[#0a0a0f]"
                }`}>
                  <div className="flex items-center gap-3 px-3 py-2.5 cursor-pointer" onClick={() => setExpandedKeyHistory(isExpanding ? null : kh.id)}>
                    <span className={`w-2 h-2 rounded-full ${
                      kh.isActive ? "bg-green-400" : khExpired ? "bg-red-400" : "bg-gray-600"
                    }`} />
                    <span className="text-xs font-mono text-gray-400 flex-1">
                      {kh.keyValue.substring(0, 8)}...{kh.keyValue.substring(kh.keyValue.length - 4)}
                    </span>
                    <span className="text-xs font-mono text-gray-600">
                      {new Date(kh.createdAt).toLocaleDateString()}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                      kh.isActive ? "bg-green-900/30 text-green-400" : khExpired ? "bg-red-900/30 text-red-400" : "bg-gray-800 text-gray-500"
                    }`}>
                      {kh.isActive ? "ACTIVE" : khExpired ? "EXPIRED" : "ROTATED"}
                    </span>
                    <span className="text-xs font-mono text-cyan-400">
                      {kh.registrationCount} reg{kh.registrationCount !== 1 ? "s" : ""}
                    </span>
                    {isExpanding ? <ChevronUp className="w-3.5 h-3.5 text-gray-500" /> : <ChevronDown className="w-3.5 h-3.5 text-gray-500" />}
                  </div>
                  {isExpanding && (
                    <KeyHistoryDetail keyValue={kh.keyValue} expiresAt={kh.expiresAt} createdBy={kh.createdBy} label={kh.label} />
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-gray-600 font-mono text-sm">No key history yet. Keys will be tracked after the next rotation.</p>
        )}
      </div>

      {/* Platform Settings */}
      <div className="bg-[#111118] border border-gray-800 rounded-lg p-5">
        <div className="flex items-center gap-2 mb-4">
          <Settings className="w-5 h-5 text-gray-400" />
          <h3 className="text-sm font-mono text-gray-400 uppercase tracking-wider font-bold">Platform Settings</h3>
        </div>
        {settings && settings.length > 0 ? (
          <div className="space-y-3">
            {settings.filter(s => !["admin_secret_key", "admin_key_expires_at", "admin_key_expiry_days"].includes(s.key)).map((setting) => (
              <SettingRow
                key={setting.id}
                settingKey={setting.key}
                value={setting.value}
                description={setting.description}
                onSave={(val) => updateSetting.mutate({ key: setting.key, value: val })}
              />))}
          </div>
        ) : (
          <p className="text-gray-600 font-mono text-sm">No additional settings configured.</p>
        )}

        {/* Add New Setting */}
        <NewSettingForm onSave={(key, value) => updateSetting.mutate({ key, value })} />
      </div>
      {/* Header Layout moved to HEADERS tab */}
    </div>
  );
}

function HeaderLayoutPanel() {
  const [items, setItems] = useState<HeaderItem[]>(() => loadHeaderPrefs());
  const [saved, setSaved] = useState(false);
  const dragIdx = useRef<number | null>(null);

  const toggleVisible = (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
    setSaved(false);
  };

  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next.map((p, i) => ({ ...p, order: i }));
    });
    setSaved(false);
  };
  const handleDragEnd = () => { dragIdx.current = null; };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((p, i) => ({ ...p, order: i }));
    });
    setSaved(false);
  };

  const handleSave = () => {
    saveHeaderPrefs(items);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleReset = () => {
    setItems(HEADER_ITEMS_DEFAULT);
    saveHeaderPrefs(HEADER_ITEMS_DEFAULT);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="bg-[#111118] border border-purple-900/40 rounded-lg p-5">
      <div className="flex items-center gap-2 mb-1">
        <Settings className="w-5 h-5 text-purple-400" />
        <h3 className="text-sm font-mono text-purple-400 uppercase tracking-wider font-bold">Header Layout</h3>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleReset}
            className="px-3 py-1.5 text-xs font-mono text-gray-500 border border-gray-700 rounded hover:border-gray-500 hover:text-gray-300 transition-colors"
          >RESET</button>
          <button
            onClick={handleSave}
            className={`px-3 py-1.5 text-xs font-mono rounded border transition-colors ${
              saved
                ? "bg-green-900/30 border-green-700 text-green-400"
                : "bg-purple-900/20 border-purple-700/60 text-purple-300 hover:bg-purple-900/40"
            }`}
          >
            {saved ? "✓ SAVED" : "SAVE"}
          </button>
        </div>
      </div>
      <p className="text-xs font-mono text-gray-600 mb-4">
        Drag rows or use ↑↓ to reorder. Toggle the eye icon to show/hide each item. Changes apply instantly after Save.
      </p>
      <div className="space-y-1">
        {items.map((item, idx) => (
          <div
            key={item.id}
            draggable
            onDragStart={() => handleDragStart(idx)}
            onDragOver={e => handleDragOver(e, idx)}
            onDragEnd={handleDragEnd}
            className={`flex items-center gap-3 px-3 py-2 rounded border cursor-grab active:cursor-grabbing transition-colors ${
              item.visible
                ? "bg-[#0d0d14] border-gray-800 hover:border-purple-800/60"
                : "bg-[#0a0a0f] border-gray-900 opacity-50"
            }`}
          >
            <span className="text-gray-600 text-[10px] select-none">⠿</span>
            <span className={`flex-1 text-xs font-mono ${ item.visible ? "text-gray-300" : "text-gray-600" }`}>
              {item.label}
            </span>
            <button
              onClick={() => moveItem(idx, -1)}
              disabled={idx === 0}
              className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
              title="Move up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              onClick={() => moveItem(idx, 1)}
              disabled={idx === items.length - 1}
              className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors"
              title="Move down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
            <button
              onClick={() => toggleVisible(item.id)}
              className={`w-6 h-6 flex items-center justify-center rounded transition-colors ${
                item.visible
                  ? "text-purple-400 hover:text-purple-300"
                  : "text-gray-700 hover:text-gray-500"
              }`}
              title={item.visible ? "Hide" : "Show"}
            >
              {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Headers Tab ────────────────────────────────────────────────────────────
function HeadersTab() {
  const [activePage, setActivePage] = useState<PageKey>("intel");
  const PAGE_LABELS: Record<PageKey, { label: string; color: string; desc: string }> = {
    intel:  { label: "INTEL PLATFORM",  color: "#a78bfa", desc: "Main dashboard header — date/time, article stats, region filter, crawl, upgrade, docs, theme" },
    sigint: { label: "SIGINT",          color: "#f59e0b", desc: "SIGINT page header — signal stats, map/globe toggle, live, upgrade, docs, fullscreen, theme, back" },
    orbit:  { label: "ORBIT",           color: "#38bdf8", desc: "ORBIT satellite tracker header — upgrade, docs, fullscreen, theme, back" },
  };
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Layers className="w-5 h-5 text-purple-400" />
        <h2 className="text-sm font-mono text-purple-400 uppercase tracking-wider font-bold">Header Layout Manager</h2>
      </div>
      <p className="text-xs font-mono text-gray-500 -mt-4">
        Show/hide and reorder header items for each page. Add custom link buttons with full styling control.
      </p>
      {/* Page selector */}
      <div className="flex gap-2">
        {(Object.keys(PAGE_LABELS) as PageKey[]).map(page => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className="px-4 py-2 text-xs font-mono rounded border transition-all"
            style={{
              background: activePage === page ? `${PAGE_LABELS[page].color}18` : "transparent",
              borderColor: activePage === page ? `${PAGE_LABELS[page].color}60` : "rgba(100,116,139,0.2)",
              color: activePage === page ? PAGE_LABELS[page].color : "#64748b",
            }}
          >
            {PAGE_LABELS[page].label}
          </button>
        ))}
      </div>
      <p className="text-[10px] font-mono text-gray-600 -mt-2">{PAGE_LABELS[activePage].desc}</p>
      <PageHeaderPanel page={activePage} accentColor={PAGE_LABELS[activePage].color} />
    </div>
  );
}

function PageHeaderPanel({ page, accentColor }: { page: PageKey; accentColor: string }) {
  const utils = trpc.useUtils();
  // Load from DB via tRPC (public endpoint)
  const { data: dbPrefs, isLoading: prefsLoading } = trpc.headerPrefs.getPrefs.useQuery({ page });
  const saveMutation = trpc.headerPrefs.savePrefs.useMutation({
    onSuccess: () => {
      utils.headerPrefs.getPrefs.invalidate({ page });
    },
  });
  const resetMutation = trpc.headerPrefs.resetPrefs.useMutation({
    onSuccess: () => {
      utils.headerPrefs.getPrefs.invalidate({ page });
    },
  });

  const [items, setItems] = useState<HeaderItem[]>(() => loadPrefs(page));
  const [saved, setSaved] = useState(false);
  const dragIdx = useRef<number | null>(null);

  // New custom toggle form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newLabel, setNewLabel]       = useState("");
  const [newLink, setNewLink]         = useState("");
  const [newExternal, setNewExternal] = useState(false);
  const [newHasBorder, setNewHasBorder] = useState(true);
  const [newBorderColor, setNewBorderColor] = useState("#6366f1");
  const [newBorderRadius, setNewBorderRadius] = useState(true);
  const [newBgColor, setNewBgColor]   = useState("");
  const [newTextColor, setNewTextColor] = useState("#e2e8f0");

  // Sync from DB when query data arrives or page changes
  useEffect(() => {
    if (dbPrefs && Array.isArray(dbPrefs) && dbPrefs.length > 0) {
      setItems(dbPrefs as HeaderItem[]);
    } else if (!prefsLoading) {
      setItems(loadPrefs(page));
    }
    setSaved(false);
  }, [dbPrefs, page, prefsLoading]);

  const toggleVisible = (id: string) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, visible: !p.visible } : p));
    setSaved(false);
  };
  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    setItems(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIdx.current!, 1);
      next.splice(idx, 0, moved);
      dragIdx.current = idx;
      return next.map((p, i) => ({ ...p, order: i }));
    });
    setSaved(false);
  };
  const handleDragEnd = () => { dragIdx.current = null; };
  const moveItem = (idx: number, dir: -1 | 1) => {
    const next = idx + dir;
    if (next < 0 || next >= items.length) return;
    setItems(prev => {
      const arr = [...prev];
      [arr[idx], arr[next]] = [arr[next], arr[idx]];
      return arr.map((p, i) => ({ ...p, order: i }));
    });
    setSaved(false);
  };
  const removeCustom = (id: string) => {
    setItems(prev => prev.filter(p => p.id !== id));
    setSaved(false);
  };
  const handleSave = () => {
    // Save to DB via tRPC mutation
    saveMutation.mutate({ page, prefs: items }, {
      onSuccess: () => {
        // Also update localStorage as a cache for instant reads
        savePrefs(page, items);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: (err) => {
        toast.error(`Failed to save: ${err.message}`);
      },
    });
  };
  const handleReset = () => {
    resetMutation.mutate({ page }, {
      onSuccess: (data) => {
        const defaults = (data.defaults ?? resetPrefs(page)) as HeaderItem[];
        setItems(defaults);
        // Also reset localStorage cache
        savePrefs(page, defaults);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      },
      onError: (err) => {
        toast.error(`Failed to reset: ${err.message}`);
      },
    });
  };
  const handleAddCustom = () => {
    if (!newLabel.trim() || !newLink.trim()) {
      toast.error("Label and link are required");
      return;
    }
    const id = `custom_${Date.now()}`;
    const newItem: HeaderItem = {
      id,
      label: newLabel.trim(),
      visible: true,
      order: items.length,
      isCustom: true,
      link: newLink.trim(),
      isExternal: newExternal,
      hasBorder: newHasBorder,
      borderColor: newHasBorder ? newBorderColor : undefined,
      borderRadius: newBorderRadius,
      bgColor: newBgColor || undefined,
      textColor: newTextColor || undefined,
    } as any;
    setItems(prev => [...prev, newItem]);
    setSaved(false);
    setShowAddForm(false);
    setNewLabel(""); setNewLink(""); setNewExternal(false);
    setNewHasBorder(true); setNewBorderColor("#6366f1"); setNewBorderRadius(true);
        setNewBgColor(""); setNewTextColor("#e2e8f0");
  };
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const updateBuiltin = (id: string, patch: Partial<BuiltinItem>) => {
    setItems(prev => prev.map(p => p.id === id ? { ...p, ...patch } : p));
    setSaved(false);
  };
  const inputCls = "w-full text-[10px] font-mono px-2.5 py-1.5 rounded outline-none transition-all";
  const inputStyle = { background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)", color: "#e2e8f0" };
  return (
    <div className="bg-[#111118] border border-gray-800 rounded-lg p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-mono uppercase tracking-wider font-bold" style={{ color: accentColor }}>Built-in Items</h3>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={handleReset} className="px-3 py-1.5 text-xs font-mono text-gray-500 border border-gray-700 rounded hover:border-gray-500 hover:text-gray-300 transition-colors">RESET</button>
          <button
            onClick={handleSave}
            className="px-3 py-1.5 text-xs font-mono rounded border transition-colors"
            style={{
              background: saved ? "rgba(52,211,153,0.15)" : `${accentColor}18`,
              borderColor: saved ? "rgba(52,211,153,0.5)" : `${accentColor}50`,
              color: saved ? "#34d399" : accentColor,
            }}
          >
            {saved ? "✓ SAVED" : "SAVE"}
          </button>
        </div>
      </div>
      <p className="text-[10px] font-mono text-gray-600">Drag rows or use ↑↓ to reorder. Click ✎ to edit style. Toggle eye to show/hide. Changes apply instantly after Save.</p>
      {/* Built-in items list */}
      <div className="space-y-1">
        {items.filter((i): boolean => !(i as any).isCustom).map((item, idx) => {
          const bi = item as BuiltinItem;
          const allItems = items.filter((i): boolean => !(i as any).isCustom);
          const realIdx = items.findIndex(i => i.id === item.id);
          const isExpanded = expandedId === item.id;
          return (
            <div key={item.id} className="rounded border overflow-hidden" style={{ borderColor: isExpanded ? `${accentColor}40` : "#1f2937" }}>
              {/* Row */}
              <div
                draggable
                onDragStart={() => handleDragStart(realIdx)}
                onDragOver={e => handleDragOver(e, realIdx)}
                onDragEnd={handleDragEnd}
                className={`flex items-center gap-3 px-3 py-2 cursor-grab active:cursor-grabbing transition-colors ${
                  item.visible ? "bg-[#0d0d14] hover:bg-[#0f0f1a]" : "bg-[#0a0a0f] opacity-50"
                }`}
              >
                <span className="text-gray-600 text-[10px] select-none">⣿</span>
                {/* Live mini preview */}
                <span
                  className="text-[9px] font-mono px-1.5 py-0.5 transition-all"
                  style={{
                    background: bi.bgColor || "transparent",
                    border: bi.hasBorder ? `1px solid ${bi.borderColor || accentColor}` : "none",
                    borderRadius: bi.borderRadius ? "3px" : "0",
                    color: bi.textColor || (item.visible ? "#9ca3af" : "#4b5563"),
                  }}
                >
                  {bi.labelOverride || item.label}
                </span>
                <span className="flex-1" />
                <button onClick={() => moveItem(realIdx, -1)} disabled={idx === 0} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors">
                  <ChevronUp className="w-3 h-3" />
                </button>
                <button onClick={() => moveItem(realIdx, 1)} disabled={idx === allItems.length - 1} className="w-5 h-5 flex items-center justify-center text-gray-600 hover:text-gray-300 disabled:opacity-20 transition-colors">
                  <ChevronDown className="w-3 h-3" />
                </button>
                {/* Edit toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                  className="w-6 h-6 flex items-center justify-center rounded transition-colors text-[11px] font-mono"
                  style={{ color: isExpanded ? accentColor : "#4b5563" }}
                  title="Edit style"
                >✎</button>
                <button
                  onClick={() => toggleVisible(item.id)}
                  className="w-6 h-6 flex items-center justify-center rounded transition-colors"
                  style={{ color: item.visible ? accentColor : "#374151" }}
                  title={item.visible ? "Hide" : "Show"}
                >
                  {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                </button>
              </div>
              {/* Inline edit panel */}
              {isExpanded && (
                <div className="px-4 py-3 space-y-3" style={{ background: "rgba(0,0,0,0.3)", borderTop: `1px solid ${accentColor}20` }}>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[8px] font-mono tracking-widest mb-1" style={{ color: `${accentColor}80` }}>LABEL OVERRIDE</div>
                      <input
                        type="text"
                        value={bi.labelOverride || ""}
                        onChange={e => updateBuiltin(item.id, { labelOverride: e.target.value || undefined })}
                        placeholder={item.label}
                        className={inputCls}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-widest mb-1" style={{ color: `${accentColor}80` }}>TEXT COLOR</div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={bi.textColor || "#e2e8f0"} onChange={e => updateBuiltin(item.id, { textColor: e.target.value })} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                        <input value={bi.textColor || ""} onChange={e => updateBuiltin(item.id, { textColor: e.target.value || undefined })} placeholder="default" className={inputCls + " flex-1"} style={inputStyle} />
                      </div>
                    </div>
                    <div>
                      <div className="text-[8px] font-mono tracking-widest mb-1" style={{ color: `${accentColor}80` }}>BACKGROUND</div>
                      <div className="flex items-center gap-2">
                        <input type="color" value={bi.bgColor || "#000000"} onChange={e => updateBuiltin(item.id, { bgColor: e.target.value })} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                        <input value={bi.bgColor || ""} onChange={e => updateBuiltin(item.id, { bgColor: e.target.value || undefined })} placeholder="transparent" className={inputCls + " flex-1"} style={inputStyle} />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      <div className="text-[8px] font-mono tracking-widest mb-0.5" style={{ color: `${accentColor}80` }}>BORDER</div>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!bi.hasBorder} onChange={e => updateBuiltin(item.id, { hasBorder: e.target.checked })} className="w-3 h-3" />
                        <span className="text-[10px] font-mono text-gray-400">Show border</span>
                      </label>
                      {bi.hasBorder && (
                        <div className="flex items-center gap-2">
                          <input type="color" value={bi.borderColor || "#6366f1"} onChange={e => updateBuiltin(item.id, { borderColor: e.target.value })} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                          <input value={bi.borderColor || ""} onChange={e => updateBuiltin(item.id, { borderColor: e.target.value || undefined })} placeholder="#6366f1" className="w-24 text-[10px] font-mono px-2 py-1.5 rounded outline-none" style={inputStyle} />
                        </div>
                      )}
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={!!bi.borderRadius} onChange={e => updateBuiltin(item.id, { borderRadius: e.target.checked })} className="w-3 h-3" />
                        <span className="text-[10px] font-mono text-gray-400">Rounded corners</span>
                      </label>
                    </div>
                  </div>
                  {/* Live preview */}
                  <div className="flex items-center gap-3 pt-1">
                    <span className="text-[9px] font-mono text-gray-600">PREVIEW:</span>
                    <span
                      className="text-[10px] font-mono px-2 py-0.5"
                      style={{
                        background: bi.bgColor || "transparent",
                        border: bi.hasBorder ? `1px solid ${bi.borderColor || accentColor}` : "none",
                        borderRadius: bi.borderRadius ? "4px" : "0",
                        color: bi.textColor || "#e2e8f0",
                      }}
                    >
                      {bi.labelOverride || item.label}
                    </span>
                    <button
                      onClick={() => updateBuiltin(item.id, { labelOverride: undefined, textColor: undefined, bgColor: undefined, hasBorder: undefined, borderColor: undefined, borderRadius: undefined })}
                      className="text-[9px] font-mono text-gray-600 hover:text-red-400 transition-colors"
                    >CLEAR OVERRIDES</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Custom toggles section */}
      <div className="border-t border-gray-800 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <Palette className="w-4 h-4 text-gray-500" />
          <h4 className="text-xs font-mono text-gray-400 uppercase tracking-wider">Custom Link Buttons</h4>
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="ml-auto flex items-center gap-1 px-2.5 py-1 text-xs font-mono rounded border transition-all"
            style={{ background: showAddForm ? "rgba(99,102,241,0.15)" : "transparent", borderColor: "rgba(99,102,241,0.3)", color: "#818cf8" }}
          >
            <Plus className="w-3 h-3" /> ADD
          </button>
        </div>

        {/* Existing custom toggles */}
        {items.filter((i): boolean => !!(i as any).isCustom).length === 0 && !showAddForm && (
          <p className="text-[10px] font-mono text-gray-700 italic">No custom buttons yet. Click ADD to create one.</p>
        )}
        {items.filter((i): boolean => !!(i as any).isCustom).map((item) => {
          const ct = item as any;
          return (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2 rounded border mb-1 bg-[#0d0d14] border-gray-800">
              {/* Preview */}
              <a
                href={ct.link || "#"}
                onClick={e => e.preventDefault()}
                className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px] shrink-0"
                style={{
                  background: ct.bgColor || "transparent",
                  border: ct.hasBorder ? `1px solid ${ct.borderColor || "#6366f1"}` : "none",
                  borderRadius: ct.borderRadius ? "4px" : "0",
                  color: ct.textColor || "#e2e8f0",
                }}
              >
                {item.label}
              </a>
              <span className="flex-1 text-[9px] font-mono text-gray-600 truncate">{ct.link} {ct.isExternal ? "↗" : "→"}</span>
              <button onClick={() => toggleVisible(item.id)} className="w-6 h-6 flex items-center justify-center rounded transition-colors" style={{ color: item.visible ? accentColor : "#374151" }}>
                {item.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              <button onClick={() => removeCustom(item.id)} className="w-6 h-6 flex items-center justify-center rounded text-gray-700 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}

        {/* Add custom toggle form */}
        {showAddForm && (
          <div className="bg-[#0a0a0f] border border-gray-800 rounded-lg p-4 space-y-3 mt-2">
            <h5 className="text-[10px] font-mono text-gray-400 uppercase tracking-wider">New Custom Button</h5>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-mono text-gray-600 block mb-1">LABEL *</label>
                <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder="e.g. PORTAL" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-[8px] font-mono text-gray-600 block mb-1">LINK *</label>
                <input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="/path or https://..." className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[8px] font-mono text-gray-600 block mb-1">TEXT COLOR</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <input value={newTextColor} onChange={e => setNewTextColor(e.target.value)} className={inputCls + " flex-1"} style={inputStyle} />
                </div>
              </div>
              <div>
                <label className="text-[8px] font-mono text-gray-600 block mb-1">BG COLOR (optional)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={newBgColor || "#000000"} onChange={e => setNewBgColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <input value={newBgColor} onChange={e => setNewBgColor(e.target.value)} placeholder="transparent" className={inputCls + " flex-1"} style={inputStyle} />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newHasBorder} onChange={e => setNewHasBorder(e.target.checked)} className="w-3 h-3" />
                <span className="text-[10px] font-mono text-gray-400">Border</span>
              </label>
              {newHasBorder && (
                <div className="flex items-center gap-2">
                  <input type="color" value={newBorderColor} onChange={e => setNewBorderColor(e.target.value)} className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent" />
                  <input value={newBorderColor} onChange={e => setNewBorderColor(e.target.value)} className="w-24 text-[10px] font-mono px-2 py-1.5 rounded outline-none" style={inputStyle} />
                </div>
              )}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newBorderRadius} onChange={e => setNewBorderRadius(e.target.checked)} className="w-3 h-3" />
                <span className="text-[10px] font-mono text-gray-400">Rounded</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={newExternal} onChange={e => setNewExternal(e.target.checked)} className="w-3 h-3" />
                <span className="text-[10px] font-mono text-gray-400">External link ↗</span>
              </label>
            </div>
            {/* Live preview */}
            <div className="flex items-center gap-3 pt-1">
              <span className="text-[9px] font-mono text-gray-600">PREVIEW:</span>
              <a
                href="#"
                onClick={e => e.preventDefault()}
                className="flex items-center gap-1 px-2 py-0.5 font-mono text-[10px]"
                style={{
                  background: newBgColor || "transparent",
                  border: newHasBorder ? `1px solid ${newBorderColor}` : "none",
                  borderRadius: newBorderRadius ? "4px" : "0",
                  color: newTextColor || "#e2e8f0",
                }}
              >
                {newLabel || "BUTTON"}
              </a>
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={handleAddCustom} className="px-4 py-1.5 text-xs font-mono rounded border transition-all" style={{ background: "rgba(99,102,241,0.15)", borderColor: "rgba(99,102,241,0.4)", color: "#818cf8" }}>ADD BUTTON</button>
              <button onClick={() => setShowAddForm(false)} className="px-4 py-1.5 text-xs font-mono rounded border transition-all" style={{ borderColor: "rgba(100,116,139,0.2)", color: "#64748b" }}>CANCEL</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// User Reg Key lookup component (shows truncated key used to register)
function UserRegKey({ email }: { email: string | null }) {
  const { data } = trpc.cms.getUserRegistrationKey.useQuery(
    { email: email || "" },
    { enabled: !!email }
  );
  if (!data?.usedKey) return <span className="text-gray-600">—</span>;
  return <span title={data.usedKey}>{data.usedKey.substring(0, 8)}...</span>;
}

// Key History Detail sub-component
function KeyHistoryDetail({ keyValue, expiresAt, createdBy, label }: { keyValue: string; expiresAt: string | null; createdBy: string | null; label: string | null }) {
  const { data: affectedUsers } = trpc.cms.getKeyAffectedUsers.useQuery({ keyValue });
  const khExpired = expiresAt ? Date.now() > new Date(expiresAt).getTime() : false;

  return (
    <div className="px-4 py-3 border-t border-gray-800/50 bg-[#0a0a0f]/50">
      <div className="grid grid-cols-2 gap-3 text-xs font-mono mb-3">
        <div><span className="text-gray-600">Created by:</span> <span className="text-gray-300">{createdBy || "system"}</span></div>
        {label && <div><span className="text-gray-600">Label:</span> <span className="text-gray-300">{label}</span></div>}
        <div><span className="text-gray-600">Expires:</span> <span className={khExpired ? "text-red-400" : "text-gray-300"}>{expiresAt ? new Date(expiresAt).toLocaleString() : "Never"}</span></div>
        <div><span className="text-gray-600">Full key:</span> <span className="text-gray-300 break-all">{keyValue}</span></div>
      </div>
      {affectedUsers && affectedUsers.length > 0 ? (
        <div>
          <span className="text-xs font-mono text-gray-500 uppercase">Users registered with this key:</span>
          <div className="mt-2 space-y-1">
            {affectedUsers.map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-2 py-1.5 bg-[#111118] rounded text-xs font-mono">
                <span className="text-gray-300">{u.email}</span>
                <span className="text-gray-600">{u.name}</span>
                <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] uppercase ${
                  u.status === "approved" ? "bg-green-900/30 text-green-400" :
                  u.status === "pending" ? "bg-yellow-900/30 text-yellow-400" :
                  "bg-red-900/30 text-red-400"
                }`}>{u.status}</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs font-mono text-gray-600">No registrations used this key.</p>
      )}
    </div>
  );
}

function SettingRow({ settingKey, value, description, onSave }: { settingKey: string; value: string; description?: string | null; onSave: (val: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);

  return (
    <div className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0f] rounded border border-gray-800/50">
      <div className="flex-1 min-w-0">
        <div className="text-xs font-mono text-gray-500 uppercase">{settingKey}</div>
        {description && <div className="text-xs text-gray-600 mt-0.5">{description}</div>}
      </div>
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="px-2 py-1 bg-[#111118] border border-gray-700 rounded text-white font-mono text-xs w-48 focus:outline-none focus:border-red-700/60"
          />
          <button onClick={() => { onSave(editValue); setEditing(false); }} className="text-green-400 text-xs font-mono">SAVE</button>
          <button onClick={() => { setEditValue(value); setEditing(false); }} className="text-gray-500 text-xs font-mono">CANCEL</button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-sm font-mono text-white max-w-[200px] truncate">{value}</span>
          <button onClick={() => setEditing(true)} className="text-gray-500 hover:text-white text-xs font-mono">EDIT</button>
        </div>
      )}
    </div>
  );
}

function NewSettingForm({ onSave }: { onSave: (key: string, value: string) => void }) {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="mt-4 px-4 py-2 bg-[#0a0a0f] border border-dashed border-gray-700 rounded text-gray-500 font-mono text-xs hover:border-red-700/60 hover:text-gray-300 transition-colors w-full"
      >
        + ADD SETTING
      </button>
    );
  }

  return (
    <div className="mt-4 p-3 bg-[#0a0a0f] border border-gray-800 rounded space-y-2">
      <input
        type="text"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        placeholder="Setting key..."
        className="w-full px-3 py-2 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
      />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Setting value..."
        className="w-full px-3 py-2 bg-[#111118] border border-gray-800 rounded text-white placeholder-gray-600 font-mono text-sm focus:outline-none focus:border-red-700/60"
      />
      <div className="flex gap-2">
        <button
          onClick={() => { if (key && value) { onSave(key, value); setKey(""); setValue(""); setShow(false); } }}
          className="px-4 py-2 bg-red-900/30 border border-red-800/40 rounded text-red-400 font-mono text-xs hover:bg-red-900/50"
        >
          SAVE
        </button>
        <button onClick={() => setShow(false)} className="px-4 py-2 bg-gray-800 border border-gray-700 rounded text-gray-400 font-mono text-xs hover:bg-gray-700">
          CANCEL
        </button>
      </div>
    </div>
  );
}

// ─── Content Tab (Disclaimer / Contribute / Enroll CMS) ────────────────────

// Default content definitions — used as fallback when DB has no override
type FieldDef = { label: string; description: string; type: "text" | "url" | "boolean" | "json" | "textarea"; defaultValue: string };
const DEFAULT_CONTENT: Record<string, FieldDef> = {
  // ── Floating Button ──
  "disclaimer.visible": { label: "Floating Shield Button Visible", description: "Show/hide the floating disclaimer shield button", type: "boolean", defaultValue: "true" },
  "disclaimer.button.tooltip": { label: "Button Tooltip", description: "Tooltip shown on hover over the floating button", type: "text", defaultValue: "Responsible Use Agreement" },
  // ── Modal Header ──
  "disclaimer.header.title": { label: "Modal Header Title", description: "Main title in the disclaimer modal header", type: "text", defaultValue: "REDROOM" },
  "disclaimer.header.subtitle": { label: "Modal Header Subtitle", description: "Subtitle below the header title", type: "text", defaultValue: "OPEN SOURCE INTELLIGENCE PLATFORM — RESPONSIBLE USE AGREEMENT" },
  "disclaimer.footer.version": { label: "Footer Version Text", description: "Version string in the modal footer", type: "text", defaultValue: "REDROOM V2.4 · OWLINK.AI · OPEN SOURCE · MIT LICENSE · © ALEXSAI" },
  // ── Tab Labels & Visibility ──
  "disclaimer.tab.howto.visible": { label: "Show 'How To Use' Tab", description: "Toggle the HOW TO USE tab", type: "boolean", defaultValue: "true" },
  "disclaimer.tab.howto.label": { label: "'How To Use' Tab Label", description: "Label shown on the tab button", type: "text", defaultValue: "📖 HOW TO USE" },
  "disclaimer.tab.disclaimer.visible": { label: "Show 'Disclaimer & Terms' Tab", description: "Toggle the DISCLAIMER & TERMS tab", type: "boolean", defaultValue: "true" },
  "disclaimer.tab.disclaimer.label": { label: "'Disclaimer & Terms' Tab Label", description: "Label shown on the tab button", type: "text", defaultValue: "⚠ DISCLAIMER & TERMS" },
  "disclaimer.tab.contribute.visible": { label: "Show 'Contribute' Tab", description: "Toggle the CONTRIBUTE tab", type: "boolean", defaultValue: "true" },
  "disclaimer.tab.contribute.label": { label: "'Contribute' Tab Label", description: "Label shown on the tab button", type: "text", defaultValue: "🤝 CONTRIBUTE" },
  "disclaimer.tab.enroll.visible": { label: "Show 'Enroll' Tab", description: "Toggle the ENROLL tab", type: "boolean", defaultValue: "true" },
  "disclaimer.tab.enroll.label": { label: "'Enroll' Tab Label", description: "Label shown on the tab button", type: "text", defaultValue: "🎓 ENROLL" },
  // ── HOW TO USE tab ──
  "howto.intro": { label: "How To Intro Paragraph", description: "Opening paragraph on the How To Use tab", type: "textarea", defaultValue: "Redroom is designed as a professional OSINT research workstation — a single platform that aggregates publicly available global intelligence signals for analysts, journalists, and researchers." },
  "howto.sigint.icon": { label: "SIGINT Section Icon", description: "Emoji icon for the SIGINT Map section", type: "text", defaultValue: "🌍" },
  "howto.sigint.title": { label: "SIGINT Section Title", description: "Title of the SIGINT Map section", type: "text", defaultValue: "SIGINT Map Portal" },
  "howto.sigint.signals": { label: "SIGINT Signal Counts (JSON)", description: 'JSON array of {label, count} objects shown as signal stat cards', type: "json", defaultValue: JSON.stringify([{label:"✈ Live Aircraft",count:"10,000+"},{label:"🚢 AIS Vessels",count:"15,000+"},{label:"📷 CCTV Cameras",count:"12,000+"},{label:"🌋 Seismic Events",count:"USGS M2.5+"},{label:"🔥 Active Fires",count:"NASA FIRMS"},{label:"⛈ Weather Events",count:"NASA EONET"}]) },
  "howto.sigint.tips": { label: "SIGINT Tips (JSON)", description: 'JSON array of tip strings shown as bullet points', type: "json", defaultValue: JSON.stringify(["Enable layers selectively to avoid information overload","Use the country filter (F) to focus on a specific region","Draw a polygon to isolate a geographic area of interest","Click any marker to access detailed intelligence including route data, vessel metadata, and camera feeds","Use Surveillance Mode (SVM) to monitor up to 10 specific items simultaneously"]) },
  "howto.orbit.icon": { label: "Orbit Section Icon", description: "Emoji icon for the Orbit section", type: "text", defaultValue: "📡" },
  "howto.orbit.title": { label: "Orbit Section Title", description: "Title of the Orbit section", type: "text", defaultValue: "Orbit Portal (Space Intelligence)" },
  "howto.orbit.body": { label: "Orbit Section Body", description: "Description paragraph for the Orbit section", type: "textarea", defaultValue: "The Orbit portal provides real-time satellite tracking, orbital mechanics visualization, and space weather monitoring. Track active satellites, predict passes over specific locations, and monitor solar weather events that may affect communications infrastructure." },
  "howto.orbit.tips": { label: "Orbit Tips (JSON)", description: 'JSON array of tip strings', type: "json", defaultValue: JSON.stringify(["Use for monitoring satellite constellations relevant to your research area","Track ISS and other research platforms for academic purposes","Click any launch site or ground station to see all linked satellites","Monitor solar weather for communications infrastructure research","Correlate satellite passes with ground events for investigative research"]) },
  "howto.intel.icon": { label: "Intel Portal Section Icon", description: "Emoji icon for the Intel Portal section", type: "text", defaultValue: "🗞️" },
  "howto.intel.title": { label: "Intel Portal Section Title", description: "Title of the Intel Portal section", type: "text", defaultValue: "Main Intelligence Portal" },
  "howto.intel.body": { label: "Intel Portal Section Body", description: "Description paragraph for the Intel Portal section", type: "textarea", defaultValue: "The main portal aggregates geopolitical news from 100+ global sources, performs entity extraction, sentiment analysis, and relationship mapping. Use it to track narratives, identify information patterns, and build evidence-based research reports." },
  "howto.intel.tips": { label: "Intel Portal Tips (JSON)", description: 'JSON array of tip strings', type: "json", defaultValue: JSON.stringify(["Use the Compare tab to analyze how different sources cover the same event","Use the Explore tab to map relationships between entities, organizations, and events","Save investigations for longitudinal research and pattern tracking","Cross-reference news events with SIGINT map data for multi-domain analysis"]) },
  "howto.usecases.icon": { label: "Use Cases Section Icon", description: "Emoji icon for the Use Cases section", type: "text", defaultValue: "🔬" },
  "howto.usecases.title": { label: "Use Cases Section Title", description: "Title of the Use Cases section", type: "text", defaultValue: "Recommended Use Cases" },
  "howto.usecases.items": { label: "Use Cases (JSON)", description: 'JSON array of {role, use} objects', type: "json", defaultValue: JSON.stringify([{role:"Investigative Journalist",use:"Track vessel movements near conflict zones, correlate flight patterns with news events, verify claims using open data"},{role:"Academic Researcher",use:"Study geopolitical patterns, analyze media bias across sources, research conflict dynamics using real-time data"},{role:"OSINT Analyst",use:"Multi-domain correlation, entity relationship mapping, pattern-of-life analysis using only public sources"},{role:"Policy Researcher",use:"Monitor global events, track humanitarian crises, analyze regional stability indicators"},{role:"Security Researcher",use:"Study publicly visible infrastructure, analyze open-source threat intelligence, defensive research only"},{role:"Educator",use:"Demonstrate real-world data aggregation, teach open-source research methodology, illustrate geopolitical concepts"}]) },
  "howto.ethics.icon": { label: "Ethical OSINT Section Icon", description: "Emoji icon for the Ethical OSINT section", type: "text", defaultValue: "⚠️" },
  "howto.ethics.title": { label: "Ethical OSINT Section Title", description: "Title of the Ethical OSINT section", type: "text", defaultValue: "Ethical OSINT Principles" },
  "howto.ethics.items": { label: "Ethical Principles (JSON)", description: 'JSON array of principle strings', type: "json", defaultValue: JSON.stringify(["Minimize harm: only collect and analyze data necessary for your stated research purpose","Verify before publishing: independently confirm all findings before sharing publicly","Protect privacy: avoid identifying or exposing private individuals even if data is technically public","Transparent methodology: document your data sources and analytical methods","Respect legal boundaries: understand the laws of your jurisdiction regarding data collection and use","Secure your research: protect sensitive findings and sources from unauthorized access"]) },
  // ── DISCLAIMER & TERMS tab ──
  "disclaimer.intro": { label: "Disclaimer Intro Paragraph", description: "Opening paragraph on the Disclaimer & Terms tab", type: "textarea", defaultValue: "REDROOM is a fully open-source intelligence (OSINT) research platform developed for lawful, ethical, and academic purposes only. By accessing this platform, you acknowledge and agree to the following terms in their entirety." },
  "disclaimer.s1.title": { label: "§1 Section Title", description: "Title for the Open Source Declaration section", type: "text", defaultValue: "§1 — OPEN SOURCE DECLARATION" },
  "disclaimer.s1.body": { label: "§1 Section Body", description: "Body text for the Open Source Declaration section", type: "textarea", defaultValue: "This platform and all its components, source code, data pipelines, and visualizations are fully open source and publicly available for review. The project is developed with complete transparency and has no affiliation with any government, intelligence agency, military organization, or commercial surveillance entity. The platform aggregates only publicly available data from open sources." },
  "disclaimer.s2.title": { label: "§2 Section Title", description: "Title for the Permitted Uses section", type: "text", defaultValue: "§2 — PERMITTED USES" },
  "disclaimer.s2.items": { label: "§2 Permitted Uses (JSON)", description: 'JSON array of permitted use strings', type: "json", defaultValue: JSON.stringify(["Academic and scientific research in geopolitics, international relations, and conflict studies","Investigative journalism and fact-checking using publicly available data","OSINT (Open Source Intelligence) training and methodology development","Non-profit humanitarian monitoring and crisis awareness","Educational demonstrations of publicly available data aggregation techniques","Security research and vulnerability awareness (defensive purposes only)","Policy analysis and think-tank research"]) },
  "disclaimer.s3.title": { label: "§3 Section Title", description: "Title for the Prohibited Uses section", type: "text", defaultValue: "§3 — STRICTLY PROHIBITED USES" },
  "disclaimer.s3.items": { label: "§3 Prohibited Uses (JSON)", description: 'JSON array of prohibited use strings', type: "json", defaultValue: JSON.stringify(["Any activity that causes physical, psychological, financial, or reputational harm to individuals, groups, or organizations","Unauthorized surveillance, stalking, tracking, or monitoring of private individuals without their consent","Hacking, unauthorized system access, cyberattacks, or any form of digital intrusion","Facilitating, planning, or executing acts of terrorism, extremism, or political violence","Targeted harassment, doxxing, or coordinated abuse campaigns against any person or group","Disinformation campaigns, propaganda creation, or manipulation of public opinion","Violation of any applicable local, national, or international law or regulation","Commercial surveillance, profiling, or data brokerage activities","Any use that violates the privacy rights of individuals under GDPR, CCPA, or equivalent legislation","Military targeting, weapons development, or offensive intelligence operations","Discrimination based on race, religion, gender, nationality, sexual orientation, or any protected characteristic"]) },
  "disclaimer.s4.title": { label: "§4 Section Title", description: "Title for the Data Sources section", type: "text", defaultValue: "§4 — DATA SOURCES & ACCURACY" },
  "disclaimer.s4.body": { label: "§4 Section Body", description: "Body text for the Data Sources section", type: "textarea", defaultValue: "All data displayed on this platform is sourced from publicly available APIs and open datasets (adsb.lol, aisstream.io, USGS, NASA FIRMS, NASA EONET, and others). The platform makes no guarantee of data accuracy, completeness, or timeliness. Data must not be used as the sole basis for any decision that could affect human safety or welfare. Users are responsible for independently verifying all information before acting upon it." },
  "disclaimer.s5.title": { label: "§5 Section Title", description: "Title for the No Liability section", type: "text", defaultValue: "§5 — NO LIABILITY" },
  "disclaimer.s5.body": { label: "§5 Section Body", description: "Body text for the No Liability section", type: "textarea", defaultValue: 'The developers and contributors of Redroom platform accept no liability for any misuse, damage, harm, or legal consequences arising from the use of this platform or its data. Users assume full responsibility for their actions and compliance with all applicable laws. The platform is provided "as is" without warranty of any kind.' },
  "disclaimer.s6.title": { label: "§6 Section Title", description: "Title for the Responsible Disclosure section", type: "text", defaultValue: "§6 — RESPONSIBLE DISCLOSURE" },
  "disclaimer.s6.body": { label: "§6 Section Body", description: "Body text for the Responsible Disclosure section", type: "textarea", defaultValue: "If you identify any data that appears to compromise individual privacy, national security, or public safety, you are obligated to report it immediately to the platform maintainers and refrain from sharing or acting upon such data." },
  "disclaimer.s6.email": { label: "§6 Contact Email", description: "Contact email shown in the Responsible Disclosure section", type: "text", defaultValue: "responsible@redroom.live" },
  "disclaimer.s7.title": { label: "§7 Section Title", description: "Title for the MIT License section", type: "text", defaultValue: "§7 — MIT LICENSE & ATTRIBUTION" },
  "disclaimer.s7.body": { label: "§7 License Text", description: "Full MIT license text", type: "textarea", defaultValue: "MIT License\nCopyright © 2024–2026 Alexsai · Owlink.ai\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the \"Software\"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:\n\nThe above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.\n\nTHE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND." },
  "disclaimer.s8.title": { label: "§8 Section Title", description: "Title for the Agreement section", type: "text", defaultValue: "§8 — AGREEMENT" },
  "disclaimer.s8.body": { label: "§8 Section Body", description: "Body text for the Agreement section", type: "textarea", defaultValue: "By accepting these terms, you confirm that you are at least 18 years of age, that you have read and understood all clauses above, and that you will use this platform solely for lawful, ethical, and constructive purposes. This agreement is binding and your continued use of the platform constitutes ongoing acceptance of these terms." },
  // Checkboxes
  "disclaimer.checkbox.noHarm": { label: "Checkbox 1 — No Harm", description: "First acceptance checkbox text", type: "textarea", defaultValue: "I confirm I will not use this platform to harm, harass, stalk, or surveil any individual or group" },
  "disclaimer.checkbox.noHack": { label: "Checkbox 2 — No Hacking", description: "Second acceptance checkbox text", type: "textarea", defaultValue: "I confirm I will not use this platform for unauthorized access, hacking, cyberattacks, or any illegal activity" },
  "disclaimer.checkbox.researchOnly": { label: "Checkbox 3 — Research Only", description: "Third acceptance checkbox text", type: "textarea", defaultValue: "I confirm my use is strictly for research, journalism, education, or other lawful and ethical purposes" },
  "disclaimer.checkbox.noAbuse": { label: "Checkbox 4 — No Abuse", description: "Fourth acceptance checkbox text", type: "textarea", defaultValue: "I understand that misuse of this platform may result in legal consequences and I accept full personal responsibility" },
  // Accept / navigation buttons
  "disclaimer.btn.accept": { label: "Accept Button Text", description: "Text on the accept button when all checkboxes are checked", type: "text", defaultValue: "I ACCEPT — ENTER REDROOM" },
  "disclaimer.btn.notReady": { label: "Not Ready Button Text", description: "Text on the accept button when checkboxes are not all checked", type: "text", defaultValue: "CHECK ALL BOXES TO CONTINUE" },
  "disclaimer.btn.readDisclaimer": { label: "'Read Disclaimer' Button Text", description: "Footer button text on the How To tab", type: "text", defaultValue: "→ READ DISCLAIMER" },
  "disclaimer.btn.backToHowTo": { label: "'Back to How To' Button Text", description: "Footer button text on Contribute/Enroll tabs", type: "text", defaultValue: "← BACK TO HOW TO USE" },
  // ── Reminder Modal ──
  "reminder.title": { label: "Reminder Modal Title", description: "Title shown in the responsible use reminder popup", type: "text", defaultValue: "RESPONSIBLE USE REMINDER" },
  "reminder.body": { label: "Reminder Modal Body", description: "Body text in the responsible use reminder popup", type: "textarea", defaultValue: "You have been using Redroom. Please take a moment to confirm that your current activities remain within the bounds of ethical, lawful, and responsible OSINT research." },
  "reminder.questions": { label: "Reminder Questions (JSON)", description: 'JSON array of question strings shown in the reminder popup', type: "json", defaultValue: JSON.stringify(["Am I using this data only for lawful research purposes?","Am I avoiding harm to any individual or group?","Am I respecting the privacy of private individuals?","Would I be comfortable explaining my current activity publicly?"]) },
  "reminder.btn.confirm": { label: "Reminder Confirm Button", description: "Text on the 'I am being responsible' button", type: "text", defaultValue: "YES, I AM BEING RESPONSIBLE" },
  "reminder.btn.review": { label: "Reminder Review Button", description: "Text on the 'Review Terms' button", type: "text", defaultValue: "REVIEW TERMS" },
  // ── CONTRIBUTE tab ──
  "contribute.intro": { label: "Contribute Intro Text", description: "Opening paragraph on the Contribute tab", type: "textarea", defaultValue: "Redroom is a community-driven open source project built by and for OSINT researchers, journalists, and analysts." },
  "contribute.star.icon": { label: "Star Section Icon", description: "Emoji icon for the Star section", type: "text", defaultValue: "⭐" },
  "contribute.star.title": { label: "Star Section Title", description: "Title of the Star & Share section", type: "text", defaultValue: "Star & Share the Repository" },
  "contribute.star.body": { label: "Star Section Body", description: "Body text for the Star & Share section", type: "textarea", defaultValue: "The single most impactful thing you can do is star the GitHub repository and share it with your network. Stars help the project gain visibility in the OSINT and security research community, attract contributors, and signal that the tool is valuable and actively used." },
  "contribute.github.url": { label: "GitHub Repository URL", description: "Link to the GitHub repo", type: "url", defaultValue: "https://github.com/Owlinkai/redroom" },
  "contribute.github.label": { label: "GitHub Link Label", description: "Text shown for the GitHub link", type: "text", defaultValue: "github.com/Owlinkai/redroom" },
  "contribute.github.sublabel": { label: "GitHub Sub-label", description: "Sub-text shown below the GitHub link label", type: "text", defaultValue: "Star · Fork · Contribute" },
  "contribute.code.icon": { label: "Code Section Icon", description: "Emoji icon for the Contribute Code section", type: "text", defaultValue: "🛠" },
  "contribute.code.title": { label: "Code Section Title", description: "Title of the Contribute Code section", type: "text", defaultValue: "How to Contribute Code" },
  "contribute.code.steps": { label: "Code Steps (JSON)", description: 'JSON array of step strings', type: "json", defaultValue: JSON.stringify(["Fork the repository and create a feature branch","Add new data layers, improve existing visualizations, or fix bugs","Submit a Pull Request with a clear description of your changes","Follow the existing code style (TypeScript, tRPC, React 19, Tailwind 4)","All contributions must align with the ethical use principles in the Disclaimer"]) },
  "contribute.ideas.icon": { label: "Ideas Section Icon", description: "Emoji icon for the Ideas section", type: "text", defaultValue: "💡" },
  "contribute.ideas.title": { label: "Ideas Section Title", description: "Title of the Ideas section", type: "text", defaultValue: "Ideas & Feature Requests" },
  "contribute.ideas.body": { label: "Ideas Section Body", description: "Body text for the Ideas section", type: "textarea", defaultValue: "Have an idea for a new data layer, visualization, or analysis feature? Open a GitHub Issue with the label feature-request. The most upvoted ideas are prioritized in the development roadmap. Current high-priority requests include: additional satellite feeds, dark web monitoring integration, and enhanced entity relationship graphs." },
  "contribute.spread.icon": { label: "Spread Section Icon", description: "Emoji icon for the Spread the Word section", type: "text", defaultValue: "📣" },
  "contribute.spread.title": { label: "Spread Section Title", description: "Title of the Spread the Word section", type: "text", defaultValue: "Spread the Word" },
  "contribute.spread.items": { label: "Spread Items (JSON)", description: 'JSON array of {action, detail} objects', type: "json", defaultValue: JSON.stringify([{action:"Share on Twitter/X",detail:"Tag #RedRoomOSINT — helps researchers discover the tool"},{action:"Write a blog post",detail:"Document how you use Redroom in your research workflow"},{action:"Mention in academic work",detail:"Cite the platform in papers, reports, or presentations"},{action:"Recommend to colleagues",detail:"Share with journalists, analysts, and researchers in your network"}]) },
  "contribute.follow.icon": { label: "Follow Section Icon", description: "Emoji icon for the Follow Alexsai section", type: "text", defaultValue: "🔗" },
  "contribute.follow.title": { label: "Follow Section Title", description: "Title of the Follow Alexsai section", type: "text", defaultValue: "Follow Alexsai" },
  "contribute.linkedin.url": { label: "LinkedIn URL", description: "LinkedIn company/profile link", type: "url", defaultValue: "https://www.linkedin.com/company/alexsai" },
  "contribute.linkedin.label": { label: "LinkedIn Label", description: "Text shown for LinkedIn link", type: "text", defaultValue: "LinkedIn · Alexsai" },
  "contribute.twitter.url": { label: "Twitter/X URL", description: "Twitter/X profile link", type: "url", defaultValue: "https://twitter.com/alexsai_com" },
  "contribute.twitter.label": { label: "Twitter/X Label", description: "Text shown for Twitter/X link", type: "text", defaultValue: "Twitter/X · @alexsai_com" },
  "contribute.website.url": { label: "Website URL", description: "Main website link", type: "url", defaultValue: "https://alexsai.com" },
  "contribute.website.label": { label: "Website Label", description: "Text shown for website link", type: "text", defaultValue: "Alexsai.com" },
  "contribute.website.sublabel": { label: "Website Sub-label", description: "Sub-text below the website label", type: "text", defaultValue: "AI Research & Intelligence Tools" },
  "contribute.upgrade.url": { label: "Upgrade URL", description: "Link for the Upgrade to Enterprise button in the Contribute tab", type: "url", defaultValue: "https://owlink.ai/redroom" },
  "contribute.upgrade.body": { label: "Upgrade Body Text", description: "Description shown in the Upgrade to Enterprise section", type: "textarea", defaultValue: "Go beyond the open-source tier — get managed cloud deployment, priority source expansion, custom alert rules, full API access, dedicated support, and C4ISR integration. Enterprise and Sovereign tiers available for governments, newsrooms, and security teams." },
  "contribute.copyright": { label: "Copyright Text", description: "Copyright notice at the bottom of Contribute tab", type: "text", defaultValue: "© 2024–2026 Alexsai · Owlink.ai — Stealth Intelligence for Gov and People" },
  "contribute.license": { label: "License Line", description: "License text below the copyright", type: "text", defaultValue: "Redroom V2.4 · Released under the MIT License · Open Source · Built with ❤ for the OSINT community" },
  // ── ENROLL tab ──
  "enroll.hero.badge": { label: "Enroll Hero Badge", description: "Small badge text above the title", type: "text", defaultValue: "UPCOMING FREE TRAINING" },
  "enroll.hero.title": { label: "Enroll Hero Title", description: "Main heading in the Enroll hero section", type: "text", defaultValue: "Discovering Redroom Intelligence" },
  "enroll.hero.subtitle": { label: "Enroll Hero Subtitle", description: "Subtitle/description in the hero section", type: "textarea", defaultValue: "A free, hands-on training by Alexsai on the best use of Redroom — from first principles to advanced OSINT tradecraft." },
  "enroll.cta.url": { label: "Enroll CTA Button URL", description: "Link for the main 'Register Interest' button", type: "url", defaultValue: "https://forms.alexsai.com/12356" },
  "enroll.cta.label": { label: "Enroll CTA Button Label", description: "Text on the main CTA button", type: "text", defaultValue: "🎓 REGISTER YOUR INTEREST" },
  "enroll.cta.note": { label: "Enroll CTA Note", description: "Small note below the CTA button", type: "text", defaultValue: "forms.alexsai.com/12356 · Free · No commitment" },
  "enroll.modules.icon": { label: "Modules Section Icon", description: "Emoji icon for the Training Modules section", type: "text", defaultValue: "📚" },
  "enroll.modules.title": { label: "Modules Section Title", description: "Title of the Training Modules section", type: "text", defaultValue: "Training Modules" },
  "enroll.modules": { label: "Training Modules (JSON)", description: 'JSON array of {num, title, desc} objects — each is a training module card', type: "json", defaultValue: JSON.stringify([{num:"01",title:"How It Started",desc:"The origin story of Redroom — why it was built, what problem it solves, and the vision behind a fully open-source global intelligence platform."},{num:"02",title:"Why Now?",desc:"The geopolitical and technological context that makes OSINT more important than ever. The rise of open data, AI, and the democratization of intelligence."},{num:"03",title:"The Technology Stack",desc:"Deep dive into the architecture: real-time data pipelines, ADS-B, AIS, USGS, NASA APIs, tRPC, React 19, Leaflet, Three.js, and the LLM integration layer."},{num:"04",title:"Data & Sources",desc:"Understanding the 10,000+ live aircraft, 15,000+ vessels, 12,000+ CCTV cameras, seismic feeds, fire data, and news aggregation from 100+ global sources."},{num:"05",title:"Investigation Workflows",desc:"Hands-on walkthroughs: tracking a vessel of interest, correlating flight patterns with news events, building entity relationship maps, and saving investigations."},{num:"06",title:"Best Use Cases",desc:"Real-world scenarios from investigative journalism, academic research, humanitarian monitoring, policy analysis, and security research."},{num:"07",title:"Hidden Features & Secrets",desc:"Reveal the advanced features most users never discover: SVM surveillance mode, polygon drawing, cross-layer alerts, time-lapse heatmaps, and keyboard shortcuts."},{num:"08",title:"New Features Reveal",desc:"Exclusive preview of upcoming features and the development roadmap. What's next for Redroom and how the community shapes it."},{num:"09",title:"Secrets of LLMs for Builders",desc:"How to use LLMs to build something similar — prompt engineering for intelligence extraction, structured JSON outputs, entity recognition, and sentiment analysis at scale."},{num:"10",title:"Numbers & Figures",desc:"The data behind the data: signal volumes, refresh rates, API limits, data freshness, accuracy benchmarks, and how to interpret what you see on the map."}]) },
  "enroll.bestfor.icon": { label: "Best For Section Icon", description: "Emoji icon for the Best For section", type: "text", defaultValue: "🎯" },
  "enroll.bestfor.title": { label: "Best For Section Title", description: "Title of the Best For section", type: "text", defaultValue: "Best For" },
  "enroll.bestfor.roles": { label: "Best For Roles (JSON)", description: 'JSON array of role strings shown as tag chips', type: "json", defaultValue: JSON.stringify(["Tech Geeks","LLM Engineers","News Agencies","Researchers","Engineers","Governments","NGOs","OSINT Advocates","Responsible AI Advocates","Investigative Journalists","Policy Analysts","Security Researchers","Educators & Academics","Individuals Curious About AI & Tech","Startup Founders"]) },
  "enroll.connected.title": { label: "Stay Connected Section Title", description: "Title of the Stay Connected section", type: "text", defaultValue: "STAY CONNECTED" },
  "enroll.linkedin.url": { label: "Enroll LinkedIn URL", description: "LinkedIn link in the Stay Connected section", type: "url", defaultValue: "https://www.linkedin.com/company/alexsai" },
  "enroll.twitter.url": { label: "Enroll Twitter/X URL", description: "Twitter/X link in the Stay Connected section", type: "url", defaultValue: "https://twitter.com/alexsai_com" },
  "enroll.website.url": { label: "Enroll Website URL", description: "Website link in the Stay Connected section", type: "url", defaultValue: "https://alexsai.com" },
};

// Section groups for the ContentTab navigation
type ContentSectionKey = "floating" | "header" | "tabs" | "howto" | "disclaimerterms" | "checkboxes" | "buttons" | "reminder" | "contribute" | "enroll";
const CONTENT_SECTIONS: { key: ContentSectionKey; label: string; icon: string; description: string; prefix: string[] }[] = [
  { key: "floating",       label: "Floating Button",     icon: "🛡",  description: "Floating shield button visibility & tooltip",                  prefix: ["disclaimer.visible", "disclaimer.button.tooltip"] },
  { key: "header",         label: "Modal Header",        icon: "🔴",  description: "Title, subtitle, and footer version text",                    prefix: ["disclaimer.header.", "disclaimer.footer."] },
  { key: "tabs",           label: "Tab Labels",          icon: "📑",  description: "Show/hide and rename each tab",                              prefix: ["disclaimer.tab."] },
  { key: "howto",          label: "How To Use Tab",      icon: "📖",  description: "All sections inside the How To Use tab",                    prefix: ["howto."] },
  { key: "disclaimerterms",label: "Disclaimer & Terms",  icon: "⚠️",  description: "All §1–§8 sections and intro paragraph",                     prefix: ["disclaimer.intro", "disclaimer.s"] },
  { key: "checkboxes",     label: "Checkboxes",          icon: "☑️",  description: "The four acceptance checkboxes",                            prefix: ["disclaimer.checkbox."] },
  { key: "buttons",        label: "Button Labels",       icon: "🔘",  description: "Accept, Not Ready, Read Disclaimer, Back buttons",          prefix: ["disclaimer.btn."] },
  { key: "reminder",       label: "Reminder Modal",      icon: "⏱",  description: "Responsible use reminder popup content",                    prefix: ["reminder."] },
  { key: "contribute",     label: "Contribute Tab",      icon: "🤝",  description: "All sections inside the Contribute tab",                   prefix: ["contribute."] },
  { key: "enroll",         label: "Enroll Tab",          icon: "🎓",  description: "All sections inside the Enroll tab",                       prefix: ["enroll."] },
];

function ContentTab() {
  const [activeSection, setActiveSection] = useState<ContentSectionKey>("floating");
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [saved, setSaved] = useState<Record<string, boolean>>({});
  const [jsonErrors, setJsonErrors] = useState<Record<string, string>>({});

  const { data: allContent, refetch } = trpc.cms.getAllSiteContent.useQuery();
  const setSiteContent = trpc.cms.setSiteContent.useMutation({
    onSuccess: (_, vars) => {
      setSaving(s => ({ ...s, [vars.key]: false }));
      setSaved(s => ({ ...s, [vars.key]: true }));
      setTimeout(() => setSaved(s => ({ ...s, [vars.key]: false })), 2000);
      refetch();
    },
    onError: (_, vars) => {
      setSaving(s => ({ ...s, [vars.key]: false }));
    },
  });

  const contentMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (allContent) for (const row of allContent) map[row.key] = row.value;
    return map;
  }, [allContent]);

  const getValue = (key: string) => {
    if (editValues[key] !== undefined) return editValues[key];
    if (contentMap[key] !== undefined) return contentMap[key];
    return DEFAULT_CONTENT[key]?.defaultValue || "";
  };

  const handleSave = (key: string) => {
    const def = DEFAULT_CONTENT[key];
    if (!def) return;
    // Validate JSON before saving
    if (def.type === "json") {
      try { JSON.parse(getValue(key)); }
      catch { setJsonErrors(e => ({ ...e, [key]: "Invalid JSON — fix before saving" })); return; }
      setJsonErrors(e => { const n = { ...e }; delete n[key]; return n; });
    }
    setSaving(s => ({ ...s, [key]: true }));
    setSiteContent.mutate({
      key,
      value: getValue(key),
      type: (def.type === "textarea" ? "text" : def.type) as "text" | "url" | "boolean" | "json",
      section: key.split(".")[0],
      label: def.label,
      description: def.description,
    });
  };

  const handleReset = (key: string) => {
    const def = DEFAULT_CONTENT[key];
    if (!def) return;
    setEditValues(v => ({ ...v, [key]: def.defaultValue }));
    setJsonErrors(e => { const n = { ...e }; delete n[key]; return n; });
  };

  // Resolve which keys belong to the active section
  const activeSec = CONTENT_SECTIONS.find(s => s.key === activeSection)!;
  const sectionKeys = Object.keys(DEFAULT_CONTENT).filter(k =>
    activeSec.prefix.some(p => k === p || k.startsWith(p))
  );

  // ── JSON list editor helpers ──────────────────────────────────────────────
  function parseJsonSafe(val: string): unknown[] {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  }

  // Render a JSON string-array inline editor
  function StringArrayEditor({ fieldKey }: { fieldKey: string }) {
    const raw = getValue(fieldKey);
    const items = parseJsonSafe(raw) as string[];
    const update = (newItems: string[]) =>
      setEditValues(v => ({ ...v, [fieldKey]: JSON.stringify(newItems) }));
    return (
      <div className="space-y-2">
        {items.map((item, i) => (
          <div key={i} className="flex gap-2 items-start">
            <span className="text-[10px] font-mono text-gray-600 mt-2.5 w-5 flex-shrink-0">{i + 1}.</span>
            <textarea
              value={item}
              rows={item.length > 80 ? 2 : 1}
              onChange={e => { const n = [...items]; n[i] = e.target.value; update(n); }}
              className="flex-1 px-2.5 py-1.5 bg-[#111118] border border-gray-800 rounded text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-700/60 resize-none"
            />
            <button onClick={() => { const n = items.filter((_, j) => j !== i); update(n); }}
              className="mt-1 p-1 rounded bg-gray-800 border border-gray-700 text-gray-500 hover:text-red-400 transition-colors flex-shrink-0">
              <Minus className="w-3 h-3" />
            </button>
          </div>
        ))}
        <button onClick={() => update([...items, ""])}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-gray-700 text-xs font-mono text-gray-500 hover:text-cyan-400 hover:border-cyan-800/40 transition-colors">
          <Plus className="w-3 h-3" /> Add Item
        </button>
      </div>
    );
  }

  // Render a JSON object-array inline editor (keys derived from first item)
  function ObjectArrayEditor({ fieldKey }: { fieldKey: string }) {
    const raw = getValue(fieldKey);
    const items = parseJsonSafe(raw) as Record<string, string>[];
    const keys = items.length > 0 ? Object.keys(items[0]) : [];
    const update = (newItems: Record<string, string>[]) =>
      setEditValues(v => ({ ...v, [fieldKey]: JSON.stringify(newItems) }));
    return (
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="p-3 rounded border border-gray-800/60 bg-[#0d0d14] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono text-gray-600">Item {i + 1}</span>
              <button onClick={() => update(items.filter((_, j) => j !== i))}
                className="p-1 rounded bg-gray-800 border border-gray-700 text-gray-500 hover:text-red-400 transition-colors">
                <Minus className="w-3 h-3" />
              </button>
            </div>
            {keys.map(k => (
              <div key={k} className="flex gap-2 items-start">
                <span className="text-[10px] font-mono text-gray-500 mt-2 w-12 flex-shrink-0">{k}:</span>
                <textarea
                  value={item[k] || ""}
                  rows={(item[k] || "").length > 80 ? 2 : 1}
                  onChange={e => { const n = [...items]; n[i] = { ...n[i], [k]: e.target.value }; update(n); }}
                  className="flex-1 px-2.5 py-1.5 bg-[#111118] border border-gray-800 rounded text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-700/60 resize-none"
                />
              </div>
            ))}
          </div>
        ))}
        <button
          onClick={() => {
            const template = keys.length > 0 ? Object.fromEntries(keys.map(k => [k, ""])) : { value: "" };
            update([...items, template]);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-dashed border-gray-700 text-xs font-mono text-gray-500 hover:text-cyan-400 hover:border-cyan-800/40 transition-colors">
          <Plus className="w-3 h-3" /> Add Item
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Section Nav — 2-column grid */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {CONTENT_SECTIONS.map(sec => (
          <button
            key={sec.key}
            onClick={() => setActiveSection(sec.key)}
            className={`p-3 rounded-lg border text-left transition-all ${
              activeSection === sec.key
                ? "border-red-600/50 bg-red-900/10"
                : "border-gray-800 bg-[#111118] hover:border-gray-700"
            }`}
          >
            <div className="text-base mb-0.5">{sec.icon}</div>
            <div className={`text-xs font-mono font-bold leading-tight ${
              activeSection === sec.key ? "text-red-400" : "text-gray-300"
            }`}>{sec.label}</div>
          </button>
        ))}
      </div>

      {/* Section description */}
      <div className="flex items-center gap-2 px-1">
        <span className="text-lg">{activeSec.icon}</span>
        <div>
          <div className="text-sm font-mono font-bold text-gray-200">{activeSec.label}</div>
          <div className="text-xs font-mono text-gray-500">{activeSec.description} · {sectionKeys.length} fields</div>
        </div>
      </div>

      {/* Fields */}
      <div className="space-y-4">
        {sectionKeys.map(key => {
          const def = DEFAULT_CONTENT[key];
          if (!def) return null;
          const val = getValue(key);
          const isModified = contentMap[key] !== undefined;
          const isJson = def.type === "json";
          const isBool = def.type === "boolean";
          const isUrl = def.type === "url";
          const isTextarea = def.type === "textarea";

          // Detect if JSON value is object-array or string-array
          let jsonIsObjectArray = false;
          if (isJson) {
            try {
              const p = JSON.parse(val);
              if (Array.isArray(p) && p.length > 0 && typeof p[0] === "object") jsonIsObjectArray = true;
            } catch { /* ignore */ }
          }

          return (
            <div key={key} className="border border-gray-800/60 rounded-lg p-4 bg-[#0a0a0f]">
              {/* Field header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono font-bold text-gray-200">{def.label}</span>
                    {isModified && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-900/30 text-cyan-400 border border-cyan-800/30">MODIFIED</span>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                      isBool ? "bg-purple-900/20 text-purple-400 border-purple-800/30" :
                      isUrl  ? "bg-blue-900/20 text-blue-400 border-blue-800/30" :
                      isJson ? "bg-orange-900/20 text-orange-400 border-orange-800/30" :
                      isTextarea ? "bg-gray-800 text-gray-500 border-gray-700" :
                      "bg-gray-800 text-gray-500 border-gray-700"
                    }`}>{def.type.toUpperCase()}</span>
                  </div>
                  <div className="text-[10px] font-mono text-gray-600 mt-0.5">{def.description}</div>
                  <div className="text-[10px] font-mono text-gray-700 mt-0.5">key: {key}</div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button onClick={() => handleReset(key)}
                    className="p-1.5 rounded bg-gray-800 border border-gray-700 text-gray-500 hover:text-yellow-400 hover:border-yellow-800/40 transition-colors"
                    title="Reset to default">
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button onClick={() => handleSave(key)} disabled={saving[key]}
                    className={`px-3 py-1.5 rounded text-xs font-mono border transition-colors flex items-center gap-1 ${
                      saved[key] ? "bg-green-900/30 border-green-700/50 text-green-400"
                      : "bg-red-900/20 border-red-800/40 text-red-400 hover:bg-red-900/40"
                    }`}>
                    {saving[key] ? <Loader2 className="w-3 h-3 animate-spin" /> : saved[key] ? <CheckCircle className="w-3 h-3" /> : <Save className="w-3 h-3" />}
                    {saved[key] ? "SAVED" : "SAVE"}
                  </button>
                </div>
              </div>

              {/* Input area */}
              {isBool ? (
                <button
                  onClick={() => setEditValues(v => ({ ...v, [key]: val === "true" ? "false" : "true" }))}
                  className={`flex items-center gap-2 px-3 py-2 rounded border transition-colors ${
                    val === "true" ? "bg-green-900/20 border-green-800/40 text-green-400" : "bg-gray-800 border-gray-700 text-gray-500"
                  }`}>
                  {val === "true" ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  <span className="text-xs font-mono">{val === "true" ? "VISIBLE / ENABLED" : "HIDDEN / DISABLED"}</span>
                </button>
              ) : isUrl ? (
                <div className="flex items-center gap-2">
                  <Link2 className="w-3.5 h-3.5 text-gray-600 flex-shrink-0" />
                  <input type="url" value={val}
                    onChange={e => setEditValues(v => ({ ...v, [key]: e.target.value }))}
                    className="flex-1 px-3 py-2 bg-[#111118] border border-gray-800 rounded text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-700/20"
                    placeholder="https://..."
                  />
                </div>
              ) : isJson ? (
                <div className="space-y-2">
                  {/* Inline list editor */}
                  {jsonIsObjectArray
                    ? <ObjectArrayEditor fieldKey={key} />
                    : <StringArrayEditor fieldKey={key} />
                  }
                  {/* Raw JSON toggle */}
                  <details className="mt-2">
                    <summary className="text-[10px] font-mono text-gray-600 cursor-pointer hover:text-gray-400">▶ Edit raw JSON</summary>
                    <textarea
                      value={val}
                      onChange={e => {
                        setEditValues(v => ({ ...v, [key]: e.target.value }));
                        try { JSON.parse(e.target.value); setJsonErrors(er => { const n = { ...er }; delete n[key]; return n; }); }
                        catch { setJsonErrors(er => ({ ...er, [key]: "Invalid JSON" })); }
                      }}
                      rows={6}
                      className="w-full mt-2 px-3 py-2 bg-[#111118] border border-gray-800 rounded text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-orange-700/60 resize-y"
                    />
                    {jsonErrors[key] && (
                      <div className="text-[10px] font-mono text-red-400 mt-1">{jsonErrors[key]}</div>
                    )}
                  </details>
                </div>
              ) : (
                <textarea
                  value={val}
                  onChange={e => setEditValues(v => ({ ...v, [key]: e.target.value }))}
                  rows={isTextarea ? Math.max(3, Math.ceil(val.length / 80)) : (val.length > 100 ? 2 : 1)}
                  className="w-full px-3 py-2 bg-[#111118] border border-gray-800 rounded text-sm font-mono text-white placeholder-gray-600 focus:outline-none focus:border-red-700/60 focus:ring-1 focus:ring-red-700/20 resize-none"
                  placeholder="Enter value..."
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Loading State ──────────────────────────────────────────────────────────
function LoadingState() {
  return (
    <div className="flex items-center justify-center py-12">
      <Loader2 className="w-6 h-6 text-red-400 animate-spin" />
      <span className="ml-3 text-sm font-mono text-gray-500">Loading...</span>
    </div>
  );
}

// ─── Main CMS Page ──────────────────────────────────────────────────────────
// ─── Super Admin Login Form (Layer 2) ──────────────────────────────────────
function SuperAdminLoginForm({ onSuccess }: { onSuccess: (token: string) => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const loginMutation = trpc.cms.superAdminLogin.useMutation({
    onSuccess: (data) => {
      if (data.success && data.token) {
        // Store the super-admin token in sessionStorage (cleared on browser close)
        sessionStorage.setItem("__sa_token", data.token);
        onSuccess(data.token);
      }
    },
    onError: () => {
      setError("Invalid credentials");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    loginMutation.mutate({ username, password });
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-[#0a0a0f]">
      <div className="w-full max-w-md mx-4">
        {/* Security indicator */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-900/20 border border-red-700/40 mb-4">
            <Shield className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-lg font-mono font-bold text-white tracking-wider">RESTRICTED ACCESS</h1>
          <p className="text-xs font-mono text-gray-500 mt-2">AUTHORIZED PERSONNEL ONLY</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-[#111118] border border-gray-800 rounded-xl p-6 space-y-5">
          {/* Username */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-4 py-3 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
              placeholder="Enter username"
              autoComplete="off"
              autoFocus
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs font-mono text-gray-400 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-[#0a0a0f] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white font-mono text-sm focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/20 transition-all"
                placeholder="Enter password"
                autoComplete="off"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-red-400 text-xs font-mono bg-red-900/10 border border-red-900/30 rounded-lg px-3 py-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loginMutation.isPending || !username || !password}
            className="w-full bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-mono text-sm font-bold py-3 rounded-lg transition-all flex items-center justify-center gap-2"
          >
            {loginMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> AUTHENTICATING...</>
            ) : (
              <><Key className="w-4 h-4" /> AUTHENTICATE</>
            )}
          </button>

          {/* Security notice */}
          <div className="text-center pt-2">
            <p className="text-[10px] font-mono text-gray-600">SESSION EXPIRES IN 4 HOURS · IP LOGGED · 3 ATTEMPTS MAX</p>
          </div>
        </form>

        {/* Return to Platform */}
        <div className="text-center mt-5">
          <a
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-gray-500 hover:text-gray-300 transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            Return to Platform
          </a>
        </div>
      </div>
    </div>
  );
}

// ─── Waiting List CMS Tab ───────────────────────────────────────────────────
function WaitingListTab() {
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "analyst" | "admin">("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [editNotes, setEditNotes] = useState<Record<number, string>>({});
  const utils = trpc.useUtils();

  const { data: stats } = trpc.waitingList.stats.useQuery();
  const { data, isLoading, refetch } = trpc.waitingList.list.useQuery(
    { page, limit: 20, status: statusFilter, role: roleFilter, search: search || undefined },
    { refetchOnWindowFocus: false }
  );

  const updateStatus = trpc.waitingList.updateStatus.useMutation({
    onSuccess: () => { refetch(); utils.waitingList.stats.invalidate(); },
  });
  const deleteEntry = trpc.waitingList.delete.useMutation({
    onSuccess: () => { refetch(); utils.waitingList.stats.invalidate(); },
  });

  const roleColor = (role: string) => role === "admin" ? "#ef4444" : "#06b6d4";
  const statusColor = (s: string) => s === "approved" ? "#22c55e" : s === "rejected" ? "#ef4444" : "#f59e0b";
  const statusBg = (s: string) => s === "approved" ? "rgba(34,197,94,0.12)" : s === "rejected" ? "rgba(239,68,68,0.12)" : "rgba(245,158,11,0.12)";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white font-mono tracking-wider">ACCESS REQUESTS</h2>
          <p className="text-sm text-gray-400 mt-0.5">Waiting list entries from users requesting analyst or admin access</p>
        </div>
        <button onClick={() => refetch()} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-all">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[{label: "PENDING", value: stats.pending, color: "#f59e0b"}, {label: "APPROVED", value: stats.approved, color: "#22c55e"}, {label: "REJECTED", value: stats.rejected, color: "#ef4444"}].map(s => (
            <div key={s.label} className="p-4 rounded-xl border" style={{ background: "rgba(255,255,255,0.03)", borderColor: s.color + "33" }}>
              <div className="text-2xl font-bold font-mono" style={{ color: s.color }}>{s.value}</div>
              <div className="text-xs text-gray-500 font-mono mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 min-w-48">
          <Search className="w-4 h-4 text-gray-500 flex-shrink-0" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") { setSearch(searchInput); setPage(1); } }}
            placeholder="Search name, email, company…"
            className="flex-1 bg-transparent border-b border-gray-700 text-sm text-white placeholder-gray-600 outline-none pb-1 focus:border-cyan-500 transition-colors"
          />
          {searchInput && <button onClick={() => { setSearchInput(""); setSearch(""); setPage(1); }} className="text-gray-500 hover:text-white"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }} className="bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-1.5 outline-none">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value as any); setPage(1); }} className="bg-gray-900 border border-gray-700 text-sm text-white rounded-lg px-3 py-1.5 outline-none">
          <option value="all">All Roles</option>
          <option value="analyst">Analyst</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-cyan-400" /></div>
      ) : !data?.items.length ? (
        <div className="text-center py-16 text-gray-600">
          <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-mono">No entries found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.items.map((entry: any) => (
            <div key={entry.id} className="rounded-xl border border-gray-800 overflow-hidden" style={{ background: "rgba(255,255,255,0.02)" }}>
              {/* Row */}
              <div className="flex items-center gap-4 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-white">{entry.name}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: roleColor(entry.role) + "20", color: roleColor(entry.role) }}>{entry.role.toUpperCase()}</span>
                    <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: statusBg(entry.status), color: statusColor(entry.status) }}>{entry.status.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{entry.email}</span>
                    {entry.company && <span className="text-xs text-gray-500">· {entry.company}</span>}
                    <span className="text-xs text-gray-600">{new Date(entry.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Action: take to registration */}
                  <a
                    href={`mailto:${entry.email}?subject=Redroom Access Request&body=Dear ${entry.name},%0A%0AYour access request has been reviewed.`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border border-cyan-800/50 text-cyan-400 hover:bg-cyan-900/20 transition-colors"
                    title="Send email to applicant"
                  >
                    <ExternalLink className="w-3 h-3" /> Contact
                  </a>
                  <button onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border border-gray-700 text-gray-400 hover:text-white hover:border-gray-500 transition-colors">
                    {expandedId === entry.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />} Details
                  </button>
                </div>
              </div>
              {/* Expanded details */}
              {expandedId === entry.id && (
                <div className="border-t border-gray-800 px-4 py-4 space-y-3" style={{ background: "rgba(0,0,0,0.2)" }}>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div><span className="text-gray-500 font-mono">EMAIL</span><div className="text-white mt-0.5">{entry.email}</div></div>
                    <div><span className="text-gray-500 font-mono">PHONE</span><div className="text-white mt-0.5">{entry.phone || "—"}</div></div>
                    <div><span className="text-gray-500 font-mono">COMPANY</span><div className="text-white mt-0.5">{entry.company || "—"}</div></div>
                    <div><span className="text-gray-500 font-mono">REQUESTED ROLE</span><div className="mt-0.5" style={{ color: roleColor(entry.role) }}>{entry.role}</div></div>
                  </div>
                  {entry.contribution && (
                    <div>
                      <span className="text-gray-500 font-mono text-xs">CONTRIBUTION / HOW THEY CAN HELP</span>
                      <p className="text-sm text-gray-300 mt-1 leading-relaxed">{entry.contribution}</p>
                    </div>
                  )}
                  {/* Notes */}
                  <div>
                    <span className="text-gray-500 font-mono text-xs">ADMIN NOTES</span>
                    <textarea
                      value={editNotes[entry.id] ?? entry.notes ?? ""}
                      onChange={e => setEditNotes(n => ({ ...n, [entry.id]: e.target.value }))}
                      placeholder="Add internal notes…"
                      rows={2}
                      className="w-full mt-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-cyan-500 resize-none"
                    />
                  </div>
                  {/* Status actions */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-gray-500 font-mono mr-1">SET STATUS:</span>
                    {(["pending", "approved", "rejected"] as const).map(s => (
                      <button
                        key={s}
                        disabled={updateStatus.isPending || entry.status === s}
                        onClick={() => updateStatus.mutate({ id: entry.id, status: s, notes: editNotes[entry.id] ?? entry.notes ?? undefined })}
                        className="px-3 py-1 rounded-lg text-xs font-mono border transition-all disabled:opacity-40"
                        style={entry.status === s ? { background: statusBg(s), color: statusColor(s), borderColor: statusColor(s) + "50" } : { borderColor: "#374151", color: "#9ca3af" }}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                    <div className="flex-1" />
                    <button
                      onClick={() => { if (confirm(`Delete entry for ${entry.email}?`)) deleteEntry.mutate({ id: entry.id }); }}
                      disabled={deleteEntry.isPending}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-mono border border-red-900/50 text-red-400 hover:bg-red-900/20 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {data && data.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
            ← Prev
          </button>
          <span className="text-xs text-gray-500 font-mono">Page {page} of {data.totalPages} · {data.total} total</span>
          <button disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 rounded-lg text-xs font-mono border border-gray-700 text-gray-400 hover:text-white disabled:opacity-30 transition-all">
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Country Intel CMS Tab ────────────────────────────────────────────────────
const ALL_REGIONS_INTEL = ['MENA','Europe','East Asia','Asia-Pacific','South Asia','Central Asia','Sub-Saharan Africa','North Africa','Americas','Latin America','Global'];

function CountryIntelTab() {
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [runningRegion, setRunningRegion] = useState<string | null>(null);
  const [runningCountries, setRunningCountries] = useState<Set<string>>(new Set());

  const { data: allCountries = [], isLoading, refetch } = trpc.intel.listCountryIntelData.useQuery(
    { region: selectedRegion || undefined },
    { refetchOnWindowFocus: false }
  );

  const bulkRun = trpc.intel.bulkRunCountryIntel.useMutation({
    onSuccess: () => {
      refetch();
      setRunningRegion(null);
      setRunningCountries(new Set());
      setSelected(new Set());
    },
    onError: () => {
      setRunningRegion(null);
      setRunningCountries(new Set());
    }
  });

  const filtered = allCountries.filter(c =>
    !search || c.country.toLowerCase().includes(search.toLowerCase())
  );

  const byRegion = filtered.reduce((acc: Record<string, typeof filtered>, c) => {
    const r = c.region || 'Unknown';
    if (!acc[r]) acc[r] = [];
    acc[r].push(c);
    return acc;
  }, {});

  const toggleSelect = (country: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(country)) next.delete(country); else next.add(country);
      return next;
    });
  };

  const threatColor: Record<string, string> = {
    LOW: 'text-green-400', MODERATE: 'text-yellow-400', HIGH: 'text-orange-400',
    CRITICAL: 'text-red-400', EXTREME: 'text-red-600',
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-lg font-bold font-mono text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-cyan-400" /> COUNTRY INTEL DATABASE
          </h2>
          <p className="text-xs text-gray-500 font-mono mt-1">
            {allCountries.length} countries · Re-run LLM intel for any country, region, or all at once
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {selected.size > 0 && (
            <button
              onClick={() => { setRunningCountries(new Set(Array.from(selected))); bulkRun.mutate({ countries: Array.from(selected) }); }}
              disabled={bulkRun.isPending}
              className="flex items-center gap-2 px-3 py-2 bg-cyan-900/40 border border-cyan-700/50 text-cyan-300 text-xs font-mono rounded hover:bg-cyan-800/40 transition-colors disabled:opacity-50"
            >
              {bulkRun.isPending && runningCountries.size > 0 ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              RUN SELECTED ({selected.size})
            </button>
          )}
          <button
            onClick={() => bulkRun.mutate({})}
            disabled={bulkRun.isPending}
            className="flex items-center gap-2 px-3 py-2 bg-red-900/40 border border-red-700/50 text-red-300 text-xs font-mono rounded hover:bg-red-800/40 transition-colors disabled:opacity-50"
          >
            {bulkRun.isPending && runningCountries.size === 0 && !runningRegion ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            RE-RUN ALL COUNTRIES
          </button>
        </div>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search countries..."
            className="w-full pl-9 pr-4 py-2 bg-[#111118] border border-gray-800 rounded text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-cyan-700"
          />
        </div>
        <select
          value={selectedRegion}
          onChange={e => setSelectedRegion(e.target.value)}
          className="px-3 py-2 bg-[#111118] border border-gray-800 rounded text-xs font-mono text-white focus:outline-none focus:border-cyan-700"
        >
          <option value="">ALL REGIONS</option>
          {ALL_REGIONS_INTEL.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <div className="flex gap-2">
          <button onClick={() => setSelected(new Set(filtered.map(c => c.country)))} className="px-3 py-2 bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono rounded hover:text-white transition-colors">SELECT ALL</button>
          <button onClick={() => setSelected(new Set())} className="px-3 py-2 bg-[#111118] border border-gray-800 text-gray-400 text-xs font-mono rounded hover:text-white transition-colors">CLEAR</button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex items-center gap-3 text-gray-500 font-mono text-sm py-8">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading country intel...
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byRegion).sort(([a], [b]) => a.localeCompare(b)).map(([region, countries]) => (
            <div key={region} className="bg-[#0d0d14] border border-gray-800 rounded-lg overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 bg-[#111118]">
                <div className="flex items-center gap-2">
                  <Globe className="w-4 h-4 text-cyan-500" />
                  <span className="text-sm font-bold font-mono text-white">{region}</span>
                  <span className="text-xs font-mono text-gray-500">({countries.length} countries)</span>
                </div>
                <button
                  onClick={() => { setRunningRegion(region); bulkRun.mutate({ region }); }}
                  disabled={bulkRun.isPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-900/30 border border-cyan-800/50 text-cyan-400 text-xs font-mono rounded hover:bg-cyan-800/30 transition-colors disabled:opacity-50"
                >
                  {runningRegion === region && bulkRun.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                  RE-RUN REGION
                </button>
              </div>
              <div className="divide-y divide-gray-800/50">
                {countries.map(c => (
                  <div key={c.country} className={`flex items-center gap-3 px-4 py-3 hover:bg-[#111118] transition-colors ${selected.has(c.country) ? 'bg-cyan-900/10' : ''}`}>
                    <input type="checkbox" checked={selected.has(c.country)} onChange={() => toggleSelect(c.country)} className="w-3.5 h-3.5 accent-cyan-500 cursor-pointer" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-white">{c.country}</span>
                        {c.isoA3 && <span className="text-xs font-mono text-gray-600">{c.isoA3}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        {c.governmentType && <span className="text-xs text-gray-500 truncate max-w-[200px]">{c.governmentType}</span>}
                        {c.capital && <span className="text-xs text-gray-600">· {c.capital}</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      {c.threatLevel && <span className={`font-bold ${threatColor[c.threatLevel] || 'text-gray-400'}`}>{c.threatLevel}</span>}
                      {c.lastUpdated && <span className="text-gray-600">{new Date(c.lastUpdated).toLocaleDateString()}</span>}
                      <button
                        onClick={() => { setRunningCountries(new Set([c.country])); bulkRun.mutate({ countries: [c.country] }); }}
                        disabled={bulkRun.isPending}
                        className="p-1.5 rounded bg-[#111118] border border-gray-800 text-gray-500 hover:text-cyan-400 hover:border-cyan-800 transition-colors disabled:opacity-40"
                        title="Re-run intel for this country"
                      >
                        {runningCountries.has(c.country) && bulkRun.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {Object.keys(byRegion).length === 0 && (
            <div className="text-center py-12 text-gray-600 font-mono text-sm">No countries found.</div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminCMS() {
  const { user } = useAuthContext();
  const [activeTab, setActiveTab] = useState<"dashboard" | "users" | "pending" | "activity" | "quotas" | "sessions" | "settings" | "content" | "country-intel" | "waiting-list" | "crawler-missions" | "headers">("dashboard");
  const [, setLocation] = useLocation();
  const [superAdminToken, setSuperAdminToken] = useState<string | null>(() => {
    return sessionStorage.getItem("__sa_token");
  });
  const [layer2Verified, setLayer2Verified] = useState(false);
  const [layer2Checking, setLayer2Checking] = useState(true);

  // Check if existing super-admin token is still valid
  const { data: sessionCheck } = trpc.cms.checkSuperAdminSession.useQuery(
    { token: superAdminToken || "" },
    {
      enabled: !!superAdminToken,
      retry: false,
    }
  );

  // Process session check result
  useEffect(() => {
    if (!superAdminToken) {
      setLayer2Verified(false);
      setLayer2Checking(false);
      return;
    }
    if (sessionCheck) {
      if (sessionCheck.valid) {
        setLayer2Verified(true);
      } else {
        // Token expired or invalid — clear it
        sessionStorage.removeItem("__sa_token");
        setSuperAdminToken(null);
        setLayer2Verified(false);
      }
      setLayer2Checking(false);
    }
  }, [sessionCheck, superAdminToken]);

  // Get pending count for badge (only if verified)
  const { data: pendingData } = trpc.cms.pendingCount.useQuery(undefined, {
    enabled: layer2Verified,
  });

  // Get waiting list stats for ACCESS REQUESTS badge
  const { data: wlStats } = trpc.waitingList.stats.useQuery(undefined, {
    enabled: layer2Verified,
  });

  // Show loading only while initial token check is in progress
  if (layer2Checking) {
    return <LoadingState />;
  }

  // Show the super admin login form if not yet verified.
  // Credentials are validated server-side against the super_admin_credentials table.
  if (!layer2Verified) {
    return (
      <SuperAdminLoginForm
        onSuccess={(token) => {
          setSuperAdminToken(token);
          setLayer2Verified(true);
        }}
      />
    );
  }

  const tabs = [
    { id: "dashboard" as const, label: "DASHBOARD", icon: <BarChart3 className="w-4 h-4" />, badge: 0 },
    { id: "users" as const, label: "USERS", icon: <Users className="w-4 h-4" />, badge: 0 },
    { id: "pending" as const, label: "PENDING", icon: <UserPlus className="w-4 h-4" />, badge: pendingData?.count || 0 },
    { id: "activity" as const, label: "ACTIVITY", icon: <Activity className="w-4 h-4" />, badge: 0 },
    { id: "quotas" as const, label: "QUOTAS", icon: <Zap className="w-4 h-4" />, badge: 0 },
    { id: "sessions" as const, label: "SESSIONS", icon: <Timer className="w-4 h-4" />, badge: 0 },
    { id: "settings" as const, label: "SETTINGS", icon: <Settings className="w-4 h-4" />, badge: 0 },
    { id: "content" as const, label: "CONTENT", icon: <FileText className="w-4 h-4" />, badge: 0 },
    { id: "country-intel" as const, label: "COUNTRY INTEL", icon: <Globe className="w-4 h-4" />, badge: 0 },
    { id: "waiting-list" as const, label: "ACCESS REQUESTS", icon: <UserPlus className="w-4 h-4" />, badge: wlStats?.pending || 0 },
    { id: "crawler-missions" as const, label: "CRAWLER MISSIONS", icon: <Radio className="w-4 h-4" />, badge: 0 },
    { id: "headers" as const, label: "HEADERS", icon: <Layers className="w-4 h-4" />, badge: 0 },
  ];

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-red-900/30 bg-[#0a0a0f]/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-red-900/30 border border-red-700/50 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white tracking-wide font-mono">SUPER ADMIN CMS</h1>
              <p className="text-xs text-gray-500 font-mono">REDROOM V2.4 · CONTROL PANEL · OWLINK.AI</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-gray-500">{user?.email}</span>
            <button
              onClick={() => setLocation("/")}
              className="p-2 rounded bg-[#111118] border border-gray-800 text-gray-400 hover:text-white transition-colors"
              title="Back to Platform"
            >
              <Home className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                sessionStorage.removeItem("__sa_token");
                setSuperAdminToken(null);
                setLayer2Verified(false);
              }}
              className="p-2 rounded bg-[#111118] border border-gray-800 text-gray-400 hover:text-red-400 transition-colors"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="border-b border-gray-800 bg-[#0a0a0f]/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-xs font-mono uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap relative ${
                  activeTab === tab.id
                    ? "border-red-500 text-red-400"
                    : "border-transparent text-gray-500 hover:text-gray-300"
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.badge > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-yellow-500 text-black text-[10px] font-bold rounded-full flex items-center justify-center">
                    {tab.badge > 9 ? "9+" : tab.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "users" && <UsersTab />}
        {activeTab === "pending" && <PendingTab />}
        {activeTab === "activity" && <ActivityLogTab />}
        {activeTab === "quotas" && <QuotasTab />}
        {activeTab === "sessions" && <SessionsTab />}
        {activeTab === "settings" && <SettingsTab />}
        {activeTab === "content" && <ContentTab />}
        {activeTab === "country-intel" && <CountryIntelTab />}
        {activeTab === "waiting-list" && <WaitingListTab />}
        {activeTab === "crawler-missions" && <CrawlerMissionsTab />}
        {activeTab === "headers" && <HeadersTab />}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-4 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center justify-between">
          <span className="text-xs font-mono text-gray-600">© Alexsai · Owlink.ai — Stealth Intelligence for Gov and People</span>
          <span className="text-xs font-mono text-gray-700">Redroom V2.4 · CMS</span>
        </div>
      </footer>
    </div>
  );
}
