import { useState } from "react";
import { X, Save, BookmarkPlus, Network, Globe, Tag, Users } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SaveInvestigationModalProps {
  query: string;
  region: string;
  nodeCount: number;
  edgeCount: number;
  graphFilter: string[];
  topEntities: { name: string; type: string; count: number }[];
  topTopics: { topic: string; count: number }[];
  topCountries: { country: string; count: number }[];
  onClose: () => void;
  onSaved: (id: number) => void;
}

export function SaveInvestigationModal({
  query,
  region,
  nodeCount,
  edgeCount,
  graphFilter,
  topEntities,
  topTopics,
  topCountries,
  onClose,
  onSaved,
}: SaveInvestigationModalProps) {
  const [title, setTitle] = useState(
    query ? `Investigation: ${query.substring(0, 60)}` : `Investigation — ${new Date().toLocaleDateString()}`
  );
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  const saveMutation = trpc.investigations.save.useMutation({
    onSuccess: (data) => {
      setSaved(true);
      if (data?.id) onSaved(data.id);
      setTimeout(onClose, 1200);
    },
  });

  const handleSave = () => {
    if (!title.trim()) return;
    saveMutation.mutate({
      title: title.trim(),
      note: note.trim() || undefined,
      query: query || undefined,
      region,
      graphFilter,
      nodeCount,
      edgeCount,
      topEntities: topEntities.slice(0, 10),
      topTopics: topTopics.slice(0, 10),
      topCountries: topCountries.slice(0, 10),
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-md mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        style={{ boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/60">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <BookmarkPlus size={14} className="text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground tracking-tight">Save Investigation</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Snapshot summary */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { icon: <Network size={11} />, label: "Nodes", value: nodeCount, color: "text-cyan-400" },
              { icon: <Network size={11} />, label: "Edges", value: edgeCount, color: "text-blue-400" },
              { icon: <Globe size={11} />, label: "Region", value: region, color: "text-emerald-400" },
            ].map(({ icon, label, value, color }) => (
              <div key={label} className="rounded-xl bg-muted/30 border border-border/40 px-3 py-2 text-center">
                <div className={`flex items-center justify-center gap-1 ${color} mb-0.5`}>{icon}</div>
                <div className="text-[13px] font-bold text-foreground font-mono">{value}</div>
                <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          {/* Top entities preview */}
          {topEntities.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users size={10} className="text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Top Entities</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {topEntities.slice(0, 6).map((e) => (
                  <span
                    key={e.name}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-primary/10 border border-primary/20 text-primary"
                  >
                    {e.name}
                    <span className="opacity-60">{e.count}</span>
                  </span>
                ))}
                {topEntities.length > 6 && (
                  <span className="text-[9px] text-muted-foreground px-1 py-0.5">+{topEntities.length - 6} more</span>
                )}
              </div>
            </div>
          )}

          {/* Top topics preview */}
          {topTopics.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 mb-1.5">
                <Tag size={10} className="text-muted-foreground" />
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Topics</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {topTopics.slice(0, 5).map((t) => (
                  <span
                    key={t.topic}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium bg-muted/50 border border-border/40 text-muted-foreground"
                  >
                    {t.topic}
                    <span className="opacity-60">{t.count}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Title input */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Investigation Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={500}
              placeholder="Name this investigation..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all"
            />
          </div>

          {/* Note textarea */}
          <div>
            <label className="block text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Add context, findings, or next steps..."
              className="w-full px-3 py-2.5 rounded-xl border border-border bg-background/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-all resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-background/30">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!title.trim() || saveMutation.isPending || saved}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saved ? (
              <>
                <span className="text-green-300">✓</span> Saved!
              </>
            ) : saveMutation.isPending ? (
              <>
                <span className="animate-spin">⟳</span> Saving...
              </>
            ) : (
              <>
                <Save size={12} /> Save Investigation
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
