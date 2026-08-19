import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle, BookOpen, Building2, Users, Radio, Globe,
  Search, ChevronRight, ChevronDown, Shield, Lock, MessageSquare,
  Tag, Calendar, TrendingUp, Info, Filter, X, Loader2, Eye,
  Target, Zap, Activity, RefreshCw, Microscope, Link2, ExternalLink,
  Clock, CheckCircle2, XCircle, FlaskConical, Network, MapPin,
  Crosshair, Cpu, BarChart2, ChevronLeft, Maximize2, Minimize2,
  GitBranch, AlertCircle, Beaker
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useAuthContext } from "@/contexts/AuthContext";
import NarrativeConnectionGraph from "@/components/NarrativeConnectionGraph";

interface NarrativesTabProps {
  region: string;
}

// ─── Metadata ────────────────────────────────────────────────────────────────
const CATEGORY_META: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  PROPAGANDA:          { label: "Propaganda",          color: "#ef4444", icon: AlertTriangle },
  DISINFORMATION:      { label: "Disinformation",      color: "#f97316", icon: AlertTriangle },
  STRATEGIC_MESSAGING: { label: "Strategic Messaging", color: "#8b5cf6", icon: Target },
  INFLUENCE_OP:        { label: "Influence Operation", color: "#ec4899", icon: Zap },
};

const THREAT_META: Record<string, { color: string; bg: string }> = {
  critical: { color: "#ef4444", bg: "rgba(239,68,68,0.12)" },
  high:     { color: "#f97316", bg: "rgba(249,115,22,0.12)" },
  medium:   { color: "#f59e0b", bg: "rgba(245,158,11,0.12)" },
  low:      { color: "#22c55e", bg: "rgba(34,197,94,0.12)" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:   { label: "ACTIVE",   color: "#ef4444" },
  dormant:  { label: "DORMANT",  color: "#94a3b8" },
  debunked: { label: "DEBUNKED", color: "#22c55e" },
};

const SUPPORT_META: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  supports:       { icon: CheckCircle2, color: "#ef4444", label: "Supports" },
  contradicts:    { icon: XCircle,      color: "#22c55e", label: "Contradicts" },
  contextualises: { icon: Info,         color: "#60a5fa", label: "Contextualises" },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function safeArr(val: unknown): string[] {
  if (Array.isArray(val)) return val as string[];
  if (typeof val === "string") { try { return JSON.parse(val); } catch { return []; } }
  return [];
}

function ConfidenceBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(value * 100);
  const color = pct >= 85 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 50 ? "#f59e0b" : "#94a3b8";
  return (
    <div className="flex items-center gap-2">
      {label && <span className="text-[9px] text-muted-foreground/50 w-16 flex-shrink-0">{label}</span>}
      <div className="flex-1 h-1 rounded-full bg-foreground/10 overflow-hidden">
        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="text-[9px] font-mono w-8 text-right flex-shrink-0" style={{ color }}>{pct}%</span>
    </div>
  );
}

// ─── Evidence Panel ───────────────────────────────────────────────────────────
function EvidencePanel({ narrativeId }: { narrativeId: number }) {
  const utils = trpc.useUtils();
  const { isAnalyst } = useAuthContext();
  // autoBackfillLinks auto-triggers backfill if < 3 links exist, then returns all links
  const { data: links = [], isLoading, refetch } = trpc.narratives.autoBackfillLinks.useQuery(
    { narrativeId },
    { refetchOnWindowFocus: false, staleTime: 60_000 }
  );
  const backfillMutation = trpc.narratives.backfillLinks.useMutation({
    onSuccess: (data) => {
      toast.success("Evidence scan complete", { description: data.message });
      utils.narratives.autoBackfillLinks.invalidate({ narrativeId });
      refetch();
    },
    onError: (err) => toast.error("Scan failed", { description: err.message }),
  });

  const supportCounts = { supports: 0, contradicts: 0, contextualises: 0 };
  for (const l of links as any[]) {
    const t = (l.supportType ?? "contextualises") as keyof typeof supportCounts;
    if (t in supportCounts) supportCounts[t]++;
  }

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center py-8 gap-3">
      <Loader2 size={20} className="animate-spin text-purple-400/60" />
      <p className="text-[10px] text-muted-foreground/50">Scanning corpus for evidence… this may take a moment.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {/* Stats bar + scan button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/8 text-red-400 font-bold">▲ {supportCounts.supports}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-green-500/30 bg-green-500/8 text-green-400 font-bold">▼ {supportCounts.contradicts}</span>
          <span className="text-[8px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/8 text-blue-400 font-bold">● {supportCounts.contextualises}</span>
          <span className="text-[8px] text-muted-foreground/30 ml-1">{links.length} total</span>
        </div>
        {isAnalyst ? (
          <Button
            size="sm"
            variant="outline"
            className="h-6 text-[8px] px-2 border-purple-500/30 text-purple-400 hover:bg-purple-500/10"
            disabled={backfillMutation.isPending}
            onClick={() => backfillMutation.mutate({ narrativeId })}
          >
            {backfillMutation.isPending ? <Loader2 size={8} className="animate-spin mr-1" /> : <RefreshCw size={8} className="mr-1" />}
            {backfillMutation.isPending ? "Scanning corpus…" : "Find Evidence"}
          </Button>
        ) : (
          <span className="text-[8px] text-muted-foreground/30 italic">Sign in to scan for evidence</span>
        )}
      </div>

      {!links.length && (
        <div className="rounded-md p-4 border border-dashed border-border/40 text-center" style={{ background: "oklch(from var(--foreground) l c h / 0.02)" }}>
          <Link2 size={16} className="text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-[10px] text-muted-foreground/50 mb-1">No article evidence links yet.</p>
          <p className="text-[9px] text-muted-foreground/30 leading-relaxed max-w-xs mx-auto">
            Evidence links are created when articles are verified through the Narrative Checker, or by clicking <strong className="text-purple-400/70">Find Evidence</strong> above to scan the corpus.
          </p>
        </div>
      )}

      {(links as any[]).map((link: any) => {
        const meta = SUPPORT_META[link.supportType] ?? SUPPORT_META.contextualises;
        const SIcon = meta.icon;
        const kws = safeArr(link.matchedKeywords);
        const ents = safeArr(link.matchedEntities);
        const pubDate = link.publishedAt ? new Date(link.publishedAt).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : null;
        return (
          <div key={link.id} className="rounded-md border border-border/50 overflow-hidden" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
            {/* Coloured header strip */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 border-b border-border/30" style={{ background: meta.color + "12" }}>
              <SIcon size={9} style={{ color: meta.color }} className="flex-shrink-0" />
              <span className="text-[8px] font-bold uppercase tracking-wider" style={{ color: meta.color }}>{meta.label}</span>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[8px] text-muted-foreground/40 font-mono">{Math.round(link.relevanceScore)}% relevance</span>
              </div>
            </div>
            {/* Content */}
            <div className="p-2.5 space-y-1.5">
              <a href={link.articleUrl} target="_blank" rel="noopener noreferrer"
                className="text-[10px] text-foreground/80 hover:text-foreground flex items-start gap-1 leading-snug group">
                <span className="flex-1">{link.articleTitle}</span>
                <ExternalLink size={8} className="flex-shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </a>
              <div className="flex items-center gap-2 text-[8px] text-muted-foreground/40">
                {link.agencyName && <span className="flex items-center gap-0.5"><Radio size={7}/>{link.agencyName}</span>}
                {link.articleCountry && <span className="flex items-center gap-0.5"><Globe size={7}/>{link.articleCountry}</span>}
                {pubDate && <span className="flex items-center gap-0.5"><Calendar size={7}/>{pubDate}</span>}
              </div>
              {link.llmReasoning && (
                <p className="text-[9px] text-muted-foreground/60 italic leading-relaxed border-l-2 border-border/50 pl-2">{link.llmReasoning}</p>
              )}
              {(kws.length > 0 || ents.length > 0) && (
                <div className="flex flex-wrap gap-1 pt-0.5">
                  {kws.slice(0,5).map((k: string) => <span key={k} className="text-[8px] px-1 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20">{k}</span>)}
                  {ents.slice(0,3).map((e: string) => <span key={e} className="text-[8px] px-1 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">{e}</span>)}
                </div>
              )}
              <ConfidenceBar value={link.relevanceScore / 100} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Investigate Hypothesis Tool ──────────────────────────────────────────────
function InvestigatePanel({ narrative, region }: { narrative: any; region: string }) {
  const { isAnalyst, user, showAuthModal } = useAuthContext();
  const [hypothesis, setHypothesis] = useState("");
  const [result, setResult] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const utils = trpc.useUtils();

  const saveMutation = trpc.narratives.saveInvestigation.useMutation({
    onSuccess: () => {
      toast.success("Investigation saved", { description: "Result stored to your analyst log." });
      utils.narratives.listInvestigations.invalidate({ narrativeId: narrative.id });
    },
    onError: () => { /* silent — save failure shouldn't block display */ },
  });

  const investigateMutation = trpc.narratives.investigateHypothesis.useMutation({
    onSuccess: (data) => {
      setResult(data);
      // Auto-save to DB
      saveMutation.mutate({
        narrativeId: narrative.id,
        hypothesis,
        verdict: data.verdict,
        confidence: data.confidence,
        reasoning: data.reasoning,
        supportingEvidence: data.supportingEvidence,
        counterEvidence: data.counterEvidence,
        attributes: data.attributes,
      });
    },
    onError: (err) => toast.error("Investigation failed", { description: err.message }),
  });

  const { data: history = [] } = trpc.narratives.listInvestigations.useQuery(
    { narrativeId: narrative.id },
    { enabled: isAnalyst && showHistory, refetchOnWindowFocus: false }
  );

  const EXAMPLE_HYPOTHESES = [
    `Is the narrative "${narrative.title.slice(0, 50)}" state-sponsored?`,
    `Does this narrative originate from ${narrative.originCountry || "a foreign state"}?`,
    `Is there coordinated amplification of this narrative across multiple platforms?`,
    `Does this narrative aim to undermine trust in ${safeArr(narrative.targetCountries)[0] || "target institutions"}?`,
  ];

  // ── Auth gate ──────────────────────────────────────────────────────────────
  if (!isAnalyst) {
    return (
      <div className="flex flex-col items-center justify-center py-10 space-y-4">
        <div className="w-12 h-12 rounded-full bg-purple-500/10 border border-purple-500/30 flex items-center justify-center">
          <Lock size={20} className="text-purple-400" />
        </div>
        <div className="text-center">
          <p className="text-[11px] font-bold text-foreground/70 mb-1">Analyst Access Required</p>
          <p className="text-[10px] text-muted-foreground/50 leading-relaxed max-w-xs">
            The Hypothesis Investigation tool is restricted to authenticated analysts. Sign in to access AI-powered narrative investigation.
          </p>
        </div>
        <Button
          size="sm"
          onClick={showAuthModal}
          className="h-7 text-[10px] bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300"
        >
          <Shield size={10} className="mr-1.5" /> Sign In to Investigate
        </Button>
        <div className="rounded-md p-3 border border-dashed border-border/40 w-full max-w-xs" style={{ background: "oklch(from var(--foreground) l c h / 0.02)" }}>
          <p className="text-[9px] text-muted-foreground/40 text-center leading-relaxed">
            Free analyst accounts available. Apply for access via the REDROOM platform.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Simulation notice */}
      <div className="flex items-start gap-2 rounded-md p-3 border border-amber-500/20 bg-amber-500/5">
        <Beaker size={12} className="text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-[10px] font-bold text-amber-400 mb-0.5">Simulation Mode — Under Investigation & Development</p>
          <p className="text-[9px] text-muted-foreground/60 leading-relaxed">
            Scientific hypothesis investigation tool. Results are LLM-generated using available corpus data — treat as analytical hypotheses, not confirmed intelligence. Results are auto-saved to your analyst log.
          </p>
        </div>
      </div>

      {/* Hypothesis input */}
      <div>
        <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-2 flex items-center gap-1">
          <FlaskConical size={9}/> State Your Hypothesis
        </div>
        <textarea
          value={hypothesis}
          onChange={e => setHypothesis(e.target.value)}
          placeholder="Enter a scientific hypothesis about this narrative (e.g. 'Is this narrative coordinated by state actors?')"
          className="w-full rounded-md border border-border/60 bg-foreground/5 text-[10px] text-foreground/80 p-2.5 resize-none focus:outline-none focus:border-purple-500/50"
          rows={3}
        />
        <div className="flex flex-wrap gap-1 mt-1.5">
          {EXAMPLE_HYPOTHESES.map((h, i) => (
            <button key={i} onClick={() => setHypothesis(h)}
              className="text-[8px] px-1.5 py-0.5 rounded border border-border/50 text-muted-foreground/50 hover:text-foreground hover:border-border transition-colors">
              {h.slice(0, 45)}…
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => {
            if (!hypothesis.trim()) { toast.error("Enter a hypothesis first"); return; }
            setResult(null);
            investigateMutation.mutate({ narrativeId: narrative.id, hypothesis, region });
          }}
          disabled={investigateMutation.isPending || !hypothesis.trim()}
          className="flex-1 h-7 text-[10px] bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300"
        >
          {investigateMutation.isPending ? (
            <><Loader2 size={10} className="mr-1.5 animate-spin"/>Investigating…</>
          ) : (
            <><FlaskConical size={10} className="mr-1.5"/>Investigate Hypothesis</>
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowHistory(h => !h)}
          className="h-7 text-[10px] border-border/50 text-muted-foreground/60 hover:text-foreground"
          title="Toggle investigation history"
        >
          <Clock size={10} className="mr-1" />{showHistory ? "Hide" : "History"}
        </Button>
      </div>

      {/* Investigation history */}
      {showHistory && (
        <div className="rounded-lg border border-border/40 overflow-hidden">
          <div className="px-3 py-2 bg-foreground/[0.03] border-b border-border/30 flex items-center justify-between">
            <span className="text-[9px] font-bold text-muted-foreground/60 flex items-center gap-1.5">
              <Clock size={9}/> Investigation History
            </span>
            <span className="text-[8px] text-muted-foreground/30 font-mono">{history.length} saved</span>
          </div>
          {history.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-[10px] text-muted-foreground/40">No investigations saved yet.</p>
              <p className="text-[9px] text-muted-foreground/30 mt-0.5">Results are auto-saved after each investigation.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/30 max-h-64 overflow-y-auto">
              {(history as any[]).map((inv: any) => (
                <div key={inv.id} className="p-3 hover:bg-foreground/[0.02] transition-colors">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <p className="text-[9px] text-foreground/70 leading-snug flex-1">{inv.hypothesis}</p>
                    <span className="text-[8px] font-bold flex-shrink-0" style={{
                      color: inv.verdict === "SUPPORTED" ? "#ef4444" : inv.verdict === "REFUTED" ? "#22c55e" : "#f59e0b"
                    }}>{inv.verdict}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[8px] text-muted-foreground/40">
                    <span className="font-mono">{Math.round(inv.confidence * 100)}% conf.</span>
                    <span>·</span>
                    <span>{inv.analystName ?? "Analyst"}</span>
                    <span>·</span>
                    <span>{inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : ""}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Results */}
      {result && (
        <div className="rounded-lg border border-purple-500/30 overflow-hidden">
          <div className="px-3 py-2 bg-purple-500/8 border-b border-purple-500/20 flex items-center justify-between">
            <span className="text-[10px] font-bold text-purple-300 flex items-center gap-1.5">
              <Microscope size={10}/> Investigation Results
            </span>
            <div className="flex items-center gap-1.5">
              {saveMutation.isPending && <Loader2 size={8} className="animate-spin text-muted-foreground/40" />}
              {saveMutation.isSuccess && <CheckCircle2 size={8} className="text-green-400" />}
              <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">SIMULATION</span>
            </div>
          </div>
          <div className="p-3 space-y-3">
            {/* Verdict */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Hypothesis Verdict</div>
                <div className="text-sm font-bold" style={{
                  color: result.verdict === "SUPPORTED" ? "#ef4444" : result.verdict === "REFUTED" ? "#22c55e" : "#f59e0b"
                }}>{result.verdict}</div>
              </div>
              <div className="text-right">
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-0.5">Confidence</div>
                <div className="text-xl font-mono font-bold" style={{
                  color: result.confidence >= 0.8 ? "#ef4444" : result.confidence >= 0.6 ? "#f97316" : "#f59e0b"
                }}>{Math.round(result.confidence * 100)}%</div>
              </div>
            </div>

            <ConfidenceBar value={result.confidence} />

            {/* Reasoning */}
            {result.reasoning && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <BookOpen size={8}/> Scientific Reasoning
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed border-l-2 border-purple-500/30 pl-2">{result.reasoning}</p>
              </div>
            )}

            {/* Evidence */}
            {result.supportingEvidence && result.supportingEvidence.length > 0 && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <CheckCircle2 size={8} className="text-green-400"/> Supporting Evidence
                </div>
                <div className="space-y-1">
                  {result.supportingEvidence.map((e: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/60">
                      <span className="text-green-400 flex-shrink-0 mt-0.5">+</span>{e}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {result.counterEvidence && result.counterEvidence.length > 0 && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <XCircle size={8} className="text-red-400"/> Counter Evidence
                </div>
                <div className="space-y-1">
                  {result.counterEvidence.map((e: string, i: number) => (
                    <div key={i} className="flex items-start gap-1.5 text-[10px] text-foreground/60">
                      <span className="text-red-400 flex-shrink-0 mt-0.5">−</span>{e}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Attributes */}
            {result.attributes && (
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(result.attributes).map(([k, v]) => (
                  <div key={k} className="rounded-md p-2 border border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                    <div className="text-[8px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">{k.replace(/_/g, " ")}</div>
                    <div className="text-[10px] text-foreground/70 font-medium">{String(v)}</div>
                  </div>
                ))}
              </div>
            )}

            <p className="text-[8px] text-muted-foreground/30 italic pt-1 border-t border-border/30">
              ⚠ Simulation. Probabilistic LLM-generated estimates — not confirmed intelligence. Under active development.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Right Detail Panel ───────────────────────────────────────────────────────
type DetailSection = "overview" | "connections" | "evidence" | "investigate";

function NarrativeDetailPanel({
  narrative,
  region,
  onClose,
}: {
  narrative: any;
  region: string;
  onClose: () => void;
}) {
  const [section, setSection] = useState<DetailSection>("overview");
  const catMeta = CATEGORY_META[narrative.category] ?? { label: narrative.category, color: "#94a3b8", icon: Tag };
  const threatMeta = THREAT_META[narrative.threatLevel] ?? THREAT_META.medium;
  const statusMeta = STATUS_META[narrative.status] ?? STATUS_META.active;
  const CatIcon = catMeta.icon;

  const targetCountries = safeArr(narrative.targetCountries);
  const knownAuthors = safeArr(narrative.knownAuthors);
  const knownPublishers = safeArr(narrative.knownPublishers);
  const tags = safeArr(narrative.tags);

  const SECTIONS: { id: DetailSection; label: string; icon: typeof BookOpen }[] = [
    { id: "overview",     label: "Overview",     icon: BookOpen },
    { id: "connections",  label: "Connections",  icon: Network },
    { id: "evidence",     label: "Evidence",     icon: Link2 },
    { id: "investigate",  label: "Investigate",  icon: FlaskConical },
  ];

  return (
    <div className="flex flex-col h-full border-l border-border/60 bg-card" style={{ minWidth: 0 }}>
      {/* Panel header */}
      <div className="flex-shrink-0 border-b border-border/60 px-4 py-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ background: catMeta.color + "20", color: catMeta.color }}>
              <CatIcon size={8} className="inline mr-0.5"/>{catMeta.label}
            </span>
            <span className="text-[9px] font-bold" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
            <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded" style={{ background: threatMeta.bg, color: threatMeta.color }}>
              {narrative.threatLevel?.toUpperCase()} THREAT
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground/40 hover:text-foreground transition-colors flex-shrink-0">
            <X size={13}/>
          </button>
        </div>
        <div className="text-sm font-bold text-foreground leading-tight mb-1">{narrative.title}</div>
        <div className="flex items-center gap-3 text-[9px] text-muted-foreground/60 flex-wrap">
          {narrative.originCountry && <span className="flex items-center gap-1"><Globe size={8}/>{narrative.originCountry}</span>}
          <span className="flex items-center gap-1"><Activity size={8}/>{narrative.articleCount?.toLocaleString()} articles</span>
          <span className="flex items-center gap-1"><Calendar size={8}/>Since {new Date(narrative.firstDetected).getFullYear()}</span>
        </div>
        <div className="mt-2">
          <ConfidenceBar value={narrative.confidence ?? 0.5} label="Confidence" />
        </div>
      </div>

      {/* Section tabs */}
      <div className="flex-shrink-0 flex border-b border-border/50">
        {SECTIONS.map(s => {
          const SIcon = s.icon;
          return (
            <button
              key={s.id}
              onClick={() => setSection(s.id)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2 text-[8px] font-bold uppercase tracking-wider transition-colors"
              style={{
                color: section === s.id ? catMeta.color : "oklch(from var(--foreground) l c h / 0.35)",
                borderBottom: section === s.id ? `2px solid ${catMeta.color}` : "2px solid transparent",
                background: section === s.id ? catMeta.color + "08" : "transparent",
              }}
            >
              <SIcon size={10}/>
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Section content */}
      <div className="flex-1 overflow-y-auto p-4">
        {section === "overview" && (
          <>
            {/* Detection provenance badge */}
            {narrative.llmGenerated ? (
              <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 border border-purple-500/30 bg-purple-500/5 mb-1">
                <Cpu size={9} className="text-purple-400 flex-shrink-0" />
                <span className="text-[9px] text-purple-300 font-bold">AI-GENERATED NARRATIVE</span>
                <span className="text-[8px] text-muted-foreground/40 ml-auto">Corpus analysis · LLM synthesis</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md px-2.5 py-1.5 border border-amber-500/30 bg-amber-500/5 mb-1">
                <Eye size={9} className="text-amber-400 flex-shrink-0" />
                <span className="text-[9px] text-amber-300 font-bold">ANALYST-CURATED NARRATIVE</span>
                <span className="text-[8px] text-muted-foreground/40 ml-auto">Human intelligence</span>
              </div>
            )}

            <div>
              <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                <BookOpen size={8}/> Intelligence Assessment
              </div>
              <p className="text-[10px] text-foreground/80 leading-relaxed">{narrative.description}</p>
            </div>

            {/* Scientific method — how this narrative was detected */}
            {narrative.scientificMethod && (
              <div className="rounded-md p-3 border border-purple-500/20 bg-purple-500/5">
                <div className="text-[9px] text-purple-400/80 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Microscope size={8}/> Detection Methodology
                </div>
                <p className="text-[10px] text-foreground/70 leading-relaxed border-l-2 border-purple-500/30 pl-2">{narrative.scientificMethod}</p>
              </div>
            )}

            {/* Evidence keywords — what triggered detection */}
            {(() => {
              const kws = safeArr(narrative.evidenceKeywords);
              return kws.length > 0 ? (
                <div>
                  <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                    <Search size={8}/> Evidence Keywords
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {kws.map((k: string) => (
                      <span key={k} className="text-[8px] px-1.5 py-0.5 rounded border border-green-500/25 bg-green-500/8 text-green-400">{k}</span>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {narrative.analystNotes && (
              <div className="rounded-md p-3 border border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Eye size={8}/> Analyst Notes
                </div>
                <p className="text-[10px] text-foreground/60 italic leading-relaxed">{narrative.analystNotes}</p>
              </div>
            )}

            {tags.length > 0 && (
              <div>
                <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                  <Tag size={8}/> Tags
                </div>
                <div className="flex flex-wrap gap-1">
                  {tags.map((t: string) => (
                    <span key={t} className="text-[9px] px-1.5 py-0.5 rounded-full bg-foreground/5 text-muted-foreground/60 border border-border/40">#{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Discuss — coming soon */}
            <div className="rounded-md p-3 border border-dashed border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.02)" }}>
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare size={11} className="text-muted-foreground/40"/>
                <span className="text-[10px] font-bold text-muted-foreground/50">Discuss This Narrative</span>
                <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">COMING SOON</span>
              </div>
              <p className="text-[9px] text-muted-foreground/35 leading-relaxed">
                Collaborative narrative analysis — add questions, challenge assumptions, link to evidence, and discuss with other analysts. Under active development.
              </p>
            </div>
          </>
        )}

        {section === "connections" && (
          <>
            <NarrativeConnectionGraph narrative={narrative as Record<string, unknown>} narrativeId={narrative.id as number} />

            {/* Detailed connection lists */}
            <div className="grid grid-cols-1 gap-2">
              {knownAuthors.length > 0 && (
                <div className="rounded-md p-3 border border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                  <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Users size={8}/> Known Authors / Actors
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {knownAuthors.map((a: string) => (
                      <span key={a} className="text-[9px] px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/8 text-amber-300">{a}</span>
                    ))}
                  </div>
                </div>
              )}

              {knownPublishers.length > 0 && (
                <div className="rounded-md p-3 border border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                  <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Radio size={8}/> Publishers & Sources
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {knownPublishers.map((p: string) => (
                      <span key={p} className="text-[9px] px-1.5 py-0.5 rounded border border-blue-500/30 bg-blue-500/8 text-blue-300">{p}</span>
                    ))}
                  </div>
                </div>
              )}

              {targetCountries.length > 0 && (
                <div className="rounded-md p-3 border border-border/40" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                  <div className="text-[9px] text-muted-foreground/50 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Target size={8}/> Target Countries
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {targetCountries.map((c: string) => (
                      <span key={c} className="text-[9px] px-1.5 py-0.5 rounded border border-red-500/30 bg-red-500/8 text-red-300">{c}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {section === "evidence" && (
          <EvidencePanel narrativeId={narrative.id} />
        )}

        {section === "investigate" && (
          <InvestigatePanel narrative={narrative} region={region} />
        )}
      </div>
    </div>
  );
}

// ─── Narrative List Item ──────────────────────────────────────────────────────
function NarrativeListItem({
  narrative,
  selected,
  onSelect,
}: {
  narrative: any;
  selected: boolean;
  onSelect: () => void;
}) {
  const catMeta = CATEGORY_META[narrative.category] ?? { label: narrative.category, color: "#94a3b8", icon: Tag };
  const threatMeta = THREAT_META[narrative.threatLevel] ?? THREAT_META.medium;
  const statusMeta = STATUS_META[narrative.status] ?? STATUS_META.active;
  const pct = Math.round((narrative.confidence ?? 0.5) * 100);
  const barColor = pct >= 85 ? "#ef4444" : pct >= 70 ? "#f97316" : pct >= 50 ? "#f59e0b" : "#94a3b8";

  return (
    <button
      onClick={onSelect}
      className="w-full text-left p-3 rounded-lg border transition-all duration-150 hover:border-border group"
      style={{
        background: selected ? catMeta.color + "10" : "var(--card)",
        borderColor: selected ? catMeta.color + "50" : "var(--border)",
      }}
    >
      {/* Threat stripe + content */}
      <div className="flex items-start gap-2">
        <div className="w-0.5 self-stretch rounded-full flex-shrink-0" style={{ background: threatMeta.color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span className="text-[8px] font-bold px-1 py-0.5 rounded" style={{ background: catMeta.color + "20", color: catMeta.color }}>
              {catMeta.label}
            </span>
            <span className="text-[8px] font-bold" style={{ color: statusMeta.color }}>{statusMeta.label}</span>
          </div>
          <div className="text-[11px] font-semibold text-foreground/80 leading-tight mb-1 line-clamp-2 group-hover:text-foreground">
            {narrative.title}
          </div>
          <div className="flex items-center gap-2 text-[9px] text-muted-foreground/50">
            {narrative.originCountry && <span className="flex items-center gap-0.5"><Globe size={7}/>{narrative.originCountry}</span>}
            <span className="flex items-center gap-0.5"><Activity size={7}/>{narrative.articleCount}</span>
          </div>
          {/* Mini confidence bar */}
          <div className="mt-1.5 flex items-center gap-1.5">
            <div className="flex-1 h-0.5 rounded-full bg-foreground/10 overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${pct}%`, background: barColor }} />
            </div>
            <span className="text-[8px] font-mono" style={{ color: barColor }}>{pct}%</span>
          </div>
        </div>
        <ChevronRight size={10} className="text-muted-foreground/30 flex-shrink-0 mt-1 group-hover:text-muted-foreground transition-colors" />
      </div>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function NarrativesTab({ region }: NarrativesTabProps) {
  const { isAnalyst } = useAuthContext();
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [filterThreat, setFilterThreat] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hasAutoGenerated, setHasAutoGenerated] = useState(false);
  const [narrativeMode, setNarrativeMode] = useState(false);
  const narrativeModeRef = useRef<HTMLDivElement>(null);

  // Enter Narrative Mode (browser fullscreen)
  const toggleNarrativeMode = useCallback(() => {
    if (!narrativeModeRef.current) return;
    if (!document.fullscreenElement) {
      narrativeModeRef.current.requestFullscreen().catch(() => setNarrativeMode(f => !f));
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const onFsChange = () => setNarrativeMode(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFsChange);
    return () => document.removeEventListener("fullscreenchange", onFsChange);
  }, []);

  const generateMutation = trpc.narratives.generateForRegion.useMutation({
    onSuccess: (result) => {
      toast.success("Narrative Analysis Complete", { description: result.message });
      refetch();
    },
    onError: (err) => toast.error("Generation Failed", { description: err.message }),
  });

  const { data: narrativesList, isLoading, refetch } = trpc.narratives.list.useQuery({
    region: region === "Global" ? undefined : region,
    category: filterCategory ?? undefined,
    status: filterStatus ?? undefined,
    search: search.length >= 2 ? search : undefined,
  });

  const filtered = useMemo(() => {
    if (!narrativesList) return [];
    if (!filterThreat) return narrativesList;
    return narrativesList.filter((n: any) => n.threatLevel === filterThreat);
  }, [narrativesList, filterThreat]);

  const selectedNarrative = useMemo(
    () => filtered.find((n: any) => n.id === selectedId) ?? null,
    [filtered, selectedId]
  );

  const hasFilters = filterCategory || filterThreat || filterStatus || search.length >= 2;
  const isGenerating = generateMutation.isPending;

  // Auto-generate on first load if no narratives
  useEffect(() => {
    if (!isLoading && !hasAutoGenerated && !isGenerating && (narrativesList?.length ?? 0) === 0) {
      setHasAutoGenerated(true);
      generateMutation.mutate({ region });
    }
  }, [isLoading, narrativesList?.length, region]);

  // Reset on region change
  useEffect(() => {
    setHasAutoGenerated(false);
    setSelectedId(null);
  }, [region]);

  return (
    <div
      ref={narrativeModeRef}
      className={`flex flex-col h-full overflow-hidden ${narrativeMode ? "bg-[oklch(0.06_0.01_270)]" : ""}`}
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      {/* Page header */}
      <div className="flex-shrink-0 border-b border-border/70 bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-amber-400" />
            <span className="text-xs font-bold text-foreground tracking-wide">Narrative Intelligence</span>
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/20 font-bold">BETA</span>
            <span className="text-[9px] text-muted-foreground/50">— {region}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              onClick={toggleNarrativeMode}
              className="flex items-center gap-1 h-6 px-2 text-[9px] font-mono rounded border border-purple-500/40 text-purple-300 hover:bg-purple-900/20 hover:border-purple-500/70 transition-all"
              title={narrativeMode ? "Exit Narrative Mode" : "Enter Narrative Mode — immersive fullscreen"}
            >
              {narrativeMode
                ? <><Minimize2 size={9} className="mr-0.5" />Exit Mode</>
                : <><Maximize2 size={9} className="mr-0.5" />Narrative Mode</>
              }
            </button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => { setHasAutoGenerated(true); generateMutation.mutate({ region }); }}
              disabled={isGenerating}
              className="h-6 text-[9px] font-mono border-cyan-700/50 text-cyan-300 hover:bg-cyan-900/20 bg-transparent"
            >
              <RefreshCw className={`w-2.5 h-2.5 mr-1 ${isGenerating ? "animate-spin" : ""}`} />
              {isGenerating ? "Analysing…" : "Re-fetch"}
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <div className="relative">
            <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-6 h-6 text-[9px] bg-foreground/5 border-border/60 w-36"
            />
            {search && <button onClick={() => setSearch("")} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground"><X size={8}/></button>}
          </div>

          {Object.entries(CATEGORY_META).map(([key, meta]) => (
            <button key={key} onClick={() => setFilterCategory(filterCategory === key ? null : key)}
              className="text-[8px] px-1.5 py-0.5 rounded border transition-all"
              style={{
                background: filterCategory === key ? meta.color + "20" : "transparent",
                borderColor: filterCategory === key ? meta.color + "60" : "var(--border)",
                color: filterCategory === key ? meta.color : "oklch(from var(--foreground) l c h / 0.35)",
              }}
            >{meta.label}</button>
          ))}

          {Object.entries(THREAT_META).map(([key, meta]) => (
            <button key={key} onClick={() => setFilterThreat(filterThreat === key ? null : key)}
              className="text-[8px] px-1.5 py-0.5 rounded border transition-all capitalize"
              style={{
                background: filterThreat === key ? meta.bg : "transparent",
                borderColor: filterThreat === key ? meta.color + "60" : "var(--border)",
                color: filterThreat === key ? meta.color : "oklch(from var(--foreground) l c h / 0.35)",
              }}
            >{key}</button>
          ))}

          {hasFilters && (
            <button onClick={() => { setFilterCategory(null); setFilterThreat(null); setFilterStatus(null); setSearch(""); }}
              className="text-[8px] text-muted-foreground/40 hover:text-foreground flex items-center gap-0.5 transition-colors">
              <X size={8}/> Clear
            </button>
          )}
        </div>
      </div>

      {/* Split panel body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: narrative list */}
        <div className={`flex flex-col overflow-hidden transition-all duration-300 ${selectedNarrative ? "w-72 flex-shrink-0" : "flex-1"}`}>
          <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
            {(isLoading || isGenerating) && (
              <div className="flex flex-col items-center justify-center py-16 gap-3">
                <div className="relative w-10 h-10">
                  <div className="absolute inset-0 rounded-full border-2 border-cyan-500/20 animate-ping" />
                  <div className="absolute inset-1 rounded-full border-2 border-cyan-500/30 animate-spin" />
                  <Microscope size={14} className="absolute inset-0 m-auto text-cyan-400" />
                </div>
                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground/60">{isGenerating ? "Analysing intelligence corpus…" : "Loading narratives…"}</p>
                  {isGenerating && <p className="text-[9px] text-muted-foreground/40 mt-0.5">Collecting articles → Entity extraction → LLM synthesis</p>}
                </div>
              </div>
            )}

            {!isLoading && !isGenerating && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Shield size={24} className="text-muted-foreground/20 mb-2" />
                <div className="text-[10px] text-muted-foreground/50">No narratives found</div>
                <div className="text-[9px] text-muted-foreground/30 mt-1">
                  {hasFilters ? "Try adjusting your filters" : `No narratives tracked for ${region} yet`}
                </div>
              </div>
            )}

            {filtered.map((n: any) => (
              <NarrativeListItem
                key={n.id}
                narrative={n}
                selected={selectedId === n.id}
                onSelect={() => setSelectedId(selectedId === n.id ? null : n.id)}
              />
            ))}

            {/* Under development notice */}
            {filtered.length > 0 && (
              <div className="mt-4 rounded-lg border border-dashed border-border/30 p-3 text-center" style={{ background: "oklch(from var(--foreground) l c h / 0.02)" }}>
                <Info size={11} className="text-muted-foreground/25 mx-auto mb-1.5" />
                <div className="text-[9px] text-muted-foreground/35 leading-relaxed">
                  <strong className="text-muted-foreground/50">Module under development.</strong> Automated clustering and cross-region correlation planned for Q3 2026.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        {selectedNarrative && (
          <div className="flex-1 overflow-hidden">
            <NarrativeDetailPanel
              narrative={selectedNarrative}
              region={region}
              onClose={() => setSelectedId(null)}
            />
          </div>
        )}

        {/* Empty state when no narrative selected */}
        {!selectedNarrative && filtered.length > 0 && !isLoading && !isGenerating && (
          <div className="hidden md:flex flex-1 items-center justify-center border-l border-border/40" style={{ background: "oklch(from var(--background) l c h / 0.3)" }}>
            <div className="text-center">
              <Network size={32} className="text-muted-foreground/15 mx-auto mb-3" />
              <div className="text-[11px] text-muted-foreground/40">Select a narrative to view</div>
              <div className="text-[9px] text-muted-foreground/25 mt-1">connections, evidence, and investigation tools</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
