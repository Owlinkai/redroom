import { useState } from "react";
import { BookOpen, Trash2, Search, Network, Globe, Users, Tag, ChevronRight, Clock, X, Edit3, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";

interface SavedInvestigationsListProps {
  region: string;
  onLoad: (query: string) => void;
  onClose: () => void;
}

const TYPE_COLOR: Record<string, string> = {
  person: "#f472b6",
  organization: "#fb923c",
  location: "#10b981",
  country: "#10b981",
  author: "#a78bfa",
  agency: "#f59e0b",
  keyword: "#22d3ee",
};

export function SavedInvestigationsList({ region, onLoad, onClose }: SavedInvestigationsListProps) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editNote, setEditNote] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const utils = trpc.useUtils();
  const { data: investigations, isLoading } = trpc.investigations.list.useQuery({ region });

  const deleteMutation = trpc.investigations.delete.useMutation({
    onSuccess: () => {
      utils.investigations.list.invalidate();
      setConfirmDeleteId(null);
    },
  });

  const updateMutation = trpc.investigations.update.useMutation({
    onSuccess: () => {
      utils.investigations.list.invalidate();
      setEditingId(null);
    },
  });

  const handleStartEdit = (inv: { id: number; title: string; note?: string | null }) => {
    setEditingId(inv.id);
    setEditTitle(inv.title);
    setEditNote(inv.note ?? "");
  };

  const handleSaveEdit = () => {
    if (!editingId || !editTitle.trim()) return;
    updateMutation.mutate({ id: editingId, title: editTitle.trim(), note: editNote.trim() || undefined });
  };

  const formatDate = (d: Date | string) => {
    const date = new Date(d);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="relative w-full max-w-2xl mx-4 rounded-2xl border border-border bg-card shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: "80vh", boxShadow: "0 0 0 1px rgba(255,255,255,0.06), 0 24px 64px rgba(0,0,0,0.6)" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-background/60 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
              <BookOpen size={14} className="text-primary" />
            </div>
            <div>
              <span className="text-sm font-semibold text-foreground tracking-tight">Saved Investigations</span>
              {investigations && (
                <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                  {investigations.length} saved
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && (!investigations || investigations.length === 0) && (
            <div className="text-center py-12">
              <BookOpen size={32} className="text-border mx-auto mb-3" />
              <div className="text-sm font-medium text-muted-foreground">No saved investigations yet</div>
              <div className="text-xs text-muted-foreground mt-1">
                Click "Save Investigation" in the Explore tab to bookmark a network graph state.
              </div>
            </div>
          )}

          {investigations?.map((inv) => {
            // Parse JSON string fields (server serializes them to avoid superjson depth limit)
            let topEntities: { name: string; type: string; count: number }[] = [];
            let topTopics: { topic: string; count: number }[] = [];
            let topCountries: { country: string; count: number }[] = [];
            try { topEntities = JSON.parse((inv as any).topEntitiesJson ?? '[]') ?? []; } catch { topEntities = []; }
            try { topTopics = JSON.parse((inv as any).topTopicsJson ?? '[]') ?? []; } catch { topTopics = []; }
            try { topCountries = JSON.parse((inv as any).topCountriesJson ?? '[]') ?? []; } catch { topCountries = []; }
            const isEditing = editingId === inv.id;
            const isConfirmDelete = confirmDeleteId === inv.id;

            return (
              <div
                key={inv.id}
                className="group rounded-xl border border-border/60 bg-background/40 hover:bg-background/70 hover:border-border transition-all overflow-hidden"
              >
                {/* Card header */}
                <div className="flex items-start gap-3 p-3.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Network size={14} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:border-primary/50 transition-all"
                          autoFocus
                        />
                        <textarea
                          value={editNote}
                          onChange={(e) => setEditNote(e.target.value)}
                          rows={2}
                          placeholder="Add notes..."
                          className="w-full px-2.5 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-all resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveEdit}
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-all"
                          >
                            <Check size={10} /> Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{inv.title}</div>
                          <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => handleStartEdit(inv)}
                              className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all"
                            >
                              <Edit3 size={11} />
                            </button>
                            {isConfirmDelete ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => deleteMutation.mutate({ id: inv.id })}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="px-2 py-0.5 rounded-md text-[10px] font-medium text-muted-foreground hover:bg-muted/50 transition-all"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteId(inv.id)}
                                className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-all"
                              >
                                <Trash2 size={11} />
                              </button>
                            )}
                          </div>
                        </div>
                        {inv.note && (
                          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{inv.note}</div>
                        )}
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Clock size={8} /> {formatDate(inv.createdAt)}
                          </span>
                          {inv.query && (
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <Search size={8} /> {inv.query.substring(0, 30)}{inv.query.length > 30 ? "…" : ""}
                            </span>
                          )}
                          <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                            <Network size={8} /> {inv.nodeCount ?? 0}n · {inv.edgeCount ?? 0}e
                          </span>
                          {inv.region && (
                            <span className="flex items-center gap-1 text-[9px] text-muted-foreground">
                              <Globe size={8} /> {inv.region}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Entity/topic chips */}
                {!isEditing && (topEntities.length > 0 || topTopics.length > 0 || topCountries.length > 0) && (
                  <div className="px-3.5 pb-3 flex flex-wrap gap-1">
                    {topEntities.slice(0, 4).map((e) => (
                      <span
                        key={e.name}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium border"
                        style={{
                          background: `${TYPE_COLOR[e.type] ?? "#22d3ee"}15`,
                          borderColor: `${TYPE_COLOR[e.type] ?? "#22d3ee"}30`,
                          color: TYPE_COLOR[e.type] ?? "#22d3ee",
                        }}
                      >
                        <Users size={7} /> {e.name}
                      </span>
                    ))}
                    {topTopics.slice(0, 3).map((t) => (
                      <span
                        key={t.topic}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-muted/40 border border-border/40 text-muted-foreground"
                      >
                        <Tag size={7} /> {t.topic}
                      </span>
                    ))}
                    {topCountries.slice(0, 2).map((c) => (
                      <span
                        key={c.country}
                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                      >
                        <Globe size={7} /> {c.country}
                      </span>
                    ))}
                  </div>
                )}

                {/* Load button */}
                {!isEditing && inv.query && (
                  <div className="px-3.5 pb-3">
                    <button
                      onClick={() => { onLoad(inv.query!); onClose(); }}
                      className="flex items-center gap-1.5 text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors"
                    >
                      <ChevronRight size={10} /> Load Investigation
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
