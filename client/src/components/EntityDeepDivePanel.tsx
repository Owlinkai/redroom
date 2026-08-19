import { useState } from "react";
import {
  X, ExternalLink, Search, Users, Building2, MapPin, Tag,
  Newspaper, TrendingUp, Activity, Clock, ChevronRight,
  AlertTriangle, Globe, BookOpen, Loader2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TOPIC_COLORS: Record<string, string> = {
  'WAR/CONFLICT': '#ef4444', 'CONFLICT': '#ef4444', 'POLITICS': '#3b82f6',
  'ECONOMY': '#f59e0b', 'DIPLOMACY': '#8b5cf6', 'SECURITY': '#ec4899',
  'HUMANITARIAN': '#f97316', 'ENERGY': '#06b6d4', 'TECHNOLOGY': '#10b981',
  'MILITARY': '#dc2626', 'TERRORISM': '#b91c1c', 'ELECTIONS': '#6366f1',
};

const NODE_COLORS: Record<string, string> = {
  person: '#f472b6', organization: '#fb923c', country: '#10b981',
  author: '#a78bfa', agency: '#f59e0b', keyword: '#22d3ee',
  article: '#60a5fa', facility: '#34d399',
};

function SentimentBar({ breakdown, total }: { breakdown: Record<string, number>; total: number }) {
  if (total === 0) return null;
  const neg = breakdown.negative ?? 0;
  const pos = breakdown.positive ?? 0;
  const neu = breakdown.neutral ?? 0;
  const negPct = Math.round((neg / total) * 100);
  const posPct = Math.round((pos / total) * 100);
  const neuPct = 100 - negPct - posPct;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
        <span className="font-semibold">Sentiment Distribution</span>
        <span className="font-mono">{total} articles</span>
      </div>
      <div className="flex h-2 rounded-full overflow-hidden gap-px">
        {negPct > 0 && <div className="h-full transition-all" style={{ width: `${negPct}%`, background: '#ef4444' }} title={`Negative: ${neg}`}/>}
        {neuPct > 0 && <div className="h-full transition-all" style={{ width: `${neuPct}%`, background: '#6b7280' }} title={`Neutral: ${neu}`}/>}
        {posPct > 0 && <div className="h-full transition-all" style={{ width: `${posPct}%`, background: '#22c55e' }} title={`Positive: ${pos}`}/>}
      </div>
      <div className="flex items-center gap-3 text-[9px] text-muted-foreground">
        <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm inline-block bg-red-500"/>{negPct}% neg</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm inline-block bg-gray-500"/>{neuPct}% neu</span>
        <span className="flex items-center gap-1"><span className="w-2 h-1.5 rounded-sm inline-block bg-green-500"/>{posPct}% pos</span>
      </div>
    </div>
  );
}

function CoEntityChip({ label, count, color, onClick }: { label: string; count: number; color: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      title={`Highlight "${label}" in the current graph`}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-medium transition-all hover:opacity-80 hover:scale-105 active:scale-95"
      style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}>
      {label}
      <span className="opacity-60 font-mono">{count}</span>
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface EntityDeepDivePanelProps {
  entityName: string;
  entityType: string;
  region: string;
  onClose: () => void;
  onExploreEntity: (name: string) => void;
  /** Called when a co-entity chip is clicked — highlights the node in the current graph without a new search */
  onHighlightNode?: (name: string) => void;
}

export default function EntityDeepDivePanel({
  entityName, entityType, region, onClose, onExploreEntity, onHighlightNode,
}: EntityDeepDivePanelProps) {
  const [activeTab, setActiveTab] = useState<'articles' | 'connections'>('articles');

  const { data, isLoading } = trpc.articles.entityDeepDive.useQuery(
    { entityName, entityType, region, limit: 30 },
    { refetchOnWindowFocus: false, enabled: !!entityName }
  );

  const nodeColor = NODE_COLORS[entityType] ?? '#22d3ee';
  const gnUrl = `https://news.google.com/search?q=${encodeURIComponent(entityName)}&hl=en-US&gl=US&ceid=US:en`;

  return (
    <div className="absolute inset-y-0 right-0 w-80 bg-card border-l border-border shadow-2xl flex flex-col z-20 animate-in slide-in-from-right duration-200">

      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: nodeColor }}/>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider flex-shrink-0"
              style={{ background: `${nodeColor}18`, color: nodeColor, border: `1px solid ${nodeColor}40` }}>
              {entityType}
            </span>
          </div>
          <button onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors flex-shrink-0 p-0.5 rounded hover:bg-muted/50">
            <X size={14}/>
          </button>
        </div>
        <div className="text-sm font-semibold text-foreground leading-snug mb-3 line-clamp-2">{entityName}</div>

        {/* Action buttons */}
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => onExploreEntity(entityName)}
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/30 hover:bg-primary/20 transition-all">
            <Search size={9}/> Explore Network
          </button>
          <a href={gnUrl} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] font-medium px-2.5 py-1 rounded-lg bg-muted/50 text-muted-foreground border border-border hover:text-foreground hover:bg-muted transition-all">
            <ExternalLink size={9}/> Google News
          </a>
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={24} className="text-primary animate-spin"/>
            <span className="text-xs text-muted-foreground font-mono">LOADING ENTITY DATA...</span>
          </div>
        </div>
      )}

      {/* Content */}
      {!isLoading && data && (
        <>
          {/* Sentiment bar */}
          <div className="px-4 py-3 border-b border-border flex-shrink-0">
            <SentimentBar breakdown={data.sentimentBreakdown} total={data.totalCount} />
          </div>

          {/* Tabs */}
          <div className="flex border-b border-border flex-shrink-0">
            {([
              { key: 'articles' as const, label: `Articles (${data.totalCount})`, icon: <Newspaper size={10}/> },
              { key: 'connections' as const, label: 'Connections', icon: <Users size={10}/> },
            ]).map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-[10px] font-semibold transition-all ${
                  activeTab === tab.key ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-muted-foreground hover:text-foreground'
                }`}>
                {tab.icon}{tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto">

            {/* Articles tab */}
            {activeTab === 'articles' && (
              <div className="p-3 space-y-2">
                {data.articles.length === 0 ? (
                  <div className="text-center py-8">
                    <Newspaper size={28} className="text-border mx-auto mb-2"/>
                    <div className="text-xs text-muted-foreground">No articles found for this entity</div>
                    <a href={gnUrl} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
                      <ExternalLink size={10}/> Search Google News
                    </a>
                  </div>
                ) : (
                  data.articles.map(article => {
                    const topics: string[] = (() => { try { return JSON.parse((article.topicsJson as any) ?? '[]'); } catch { return []; } })();
                    const topicColor = TOPIC_COLORS[topics[0]] ?? '#22d3ee';
                    const articleUrl = article.url && !article.url.includes('example.com') && article.url.startsWith('http')
                      ? article.url
                      : `https://news.google.com/search?q=${encodeURIComponent(article.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
                    const sentimentColor = article.sentiment === 'negative' ? '#ef4444' : article.sentiment === 'positive' ? '#22c55e' : '#6b7280';

                    return (
                      <div key={article.id}
                        className="p-2.5 rounded-lg border border-border/40 bg-background/50 hover:border-border hover:bg-background transition-all group">
                        {/* Topic + sentiment badges */}
                        <div className="flex items-center gap-1.5 mb-1.5">
                          {topics[0] && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wide"
                              style={{ background: `${topicColor}18`, color: topicColor }}>
                              {topics[0]}
                            </span>
                          )}
                          <span className="text-[8px] px-1.5 py-0.5 rounded font-bold capitalize"
                            style={{ background: `${sentimentColor}18`, color: sentimentColor }}>
                            {article.sentiment ?? 'neutral'}
                          </span>
                          {article.isBreaking && (
                            <span className="text-[8px] px-1.5 py-0.5 rounded font-bold bg-red-500/20 text-red-400 border border-red-500/30">
                              BREAKING
                            </span>
                          )}
                        </div>

                        {/* Title */}
                        <div className="text-[11px] font-medium text-foreground leading-snug line-clamp-2 mb-1.5">
                          {article.title}
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-2 text-[9px] text-muted-foreground mb-1.5">
                          {article.agencyName && (
                            <span className="flex items-center gap-0.5">
                              <Newspaper size={8}/>{article.agencyName}
                            </span>
                          )}
                          {article.country && (
                            <span className="flex items-center gap-0.5">
                              <MapPin size={8}/>{article.country}
                            </span>
                          )}
                          {article.publishedAt && (
                            <span className="flex items-center gap-0.5 ml-auto">
                              <Clock size={8}/>
                              {new Date(article.publishedAt).toLocaleDateString()}
                            </span>
                          )}
                        </div>

                        {/* Summary */}
                        {article.summary && (
                          <div className="text-[10px] text-muted-foreground leading-relaxed line-clamp-2 mb-1.5 bg-muted/20 rounded px-2 py-1">
                            {article.summary}
                          </div>
                        )}

                        {/* Read link */}
                        <a href={articleUrl} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[10px] text-primary hover:underline font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                          <ExternalLink size={9}/> Read Full Article
                        </a>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* Connections tab */}
            {activeTab === 'connections' && (
              <div className="p-3 space-y-4">

                {/* Co-occurring People */}
                {data.coEntities.people.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Users size={10} className="text-pink-400"/>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Co-occurring People</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.coEntities.people.map(([name, count]) => (
                        <CoEntityChip key={name} label={name} count={count} color="#f472b6"
                          onClick={() => onHighlightNode ? onHighlightNode(name) : onExploreEntity(name)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Co-occurring Organizations */}
                {data.coEntities.orgs.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Building2 size={10} className="text-orange-400"/>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Co-occurring Organizations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.coEntities.orgs.map(([name, count]) => (
                        <CoEntityChip key={name} label={name} count={count} color="#fb923c"
                          onClick={() => onHighlightNode ? onHighlightNode(name) : onExploreEntity(name)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Co-occurring Locations */}
                {data.coEntities.locations.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <MapPin size={10} className="text-green-400"/>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Co-occurring Locations</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.coEntities.locations.map(([name, count]) => (
                        <CoEntityChip key={name} label={name} count={count} color="#10b981"
                          onClick={() => onHighlightNode ? onHighlightNode(name) : onExploreEntity(name)} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Co-occurring Keywords */}
                {data.coEntities.keywords.length > 0 && (
                  <div>
                    <div className="flex items-center gap-1.5 mb-2">
                      <Tag size={10} className="text-cyan-400"/>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Co-occurring Keywords</span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {data.coEntities.keywords.map(([kw, count]) => (
                        <CoEntityChip key={kw} label={kw} count={count} color="#22d3ee"
                          onClick={() => onHighlightNode ? onHighlightNode(kw) : onExploreEntity(kw)} />
                      ))}
                    </div>
                  </div>
                )}

                {data.coEntities.people.length === 0 && data.coEntities.orgs.length === 0 &&
                  data.coEntities.locations.length === 0 && data.coEntities.keywords.length === 0 && (
                  <div className="text-center py-8">
                    <Globe size={28} className="text-border mx-auto mb-2"/>
                    <div className="text-xs text-muted-foreground">No co-occurring entities found</div>
                    <div className="text-[10px] text-muted-foreground mt-1">Crawl more articles to build connections</div>
                  </div>
                )}

                {/* Google News link */}
                <div className="pt-2 border-t border-border/40">
                  <a href={gnUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2.5 rounded-lg bg-background/50 border border-border/40 hover:border-primary/30 hover:bg-primary/5 transition-all group">
                    <Globe size={14} className="text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0"/>
                    <div className="flex-1 min-w-0">
                      <div className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">Search Google News</div>
                      <div className="text-[9px] text-muted-foreground truncate">"{entityName}"</div>
                    </div>
                    <ExternalLink size={10} className="text-muted-foreground flex-shrink-0"/>
                  </a>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Empty state when no data */}
      {!isLoading && !data && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <AlertTriangle size={24} className="text-yellow-400 mx-auto mb-2"/>
            <div className="text-xs text-muted-foreground">Could not load entity data</div>
            <a href={gnUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-xs text-primary hover:underline">
              <ExternalLink size={10}/> Search Google News instead
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
