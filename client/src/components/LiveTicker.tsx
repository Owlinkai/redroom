import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Radio, ChevronDown, AlertTriangle, Settings2, Check, ExternalLink } from "lucide-react";

const NEWS_SOURCES_BY_REGION: Record<string, string[]> = {
  MENA: [
    "Al Jazeera English", "Al Arabiya English", "Middle East Eye", "Reuters MENA",
    "AFP MENA", "BBC Arabic", "France 24 Arabic", "Sky News Arabia",
    "The National (UAE)", "Arab News", "Daily Sabah", "Al-Monitor",
    "Asharq Al-Awsat", "Egypt Independent", "Jerusalem Post", "Haaretz",
    "Times of Israel", "Iran International", "Kurdistan 24", "Rudaw",
  ],
  Global: ["Reuters", "AP News", "AFP", "BBC World", "CNN International", "Bloomberg", "Al Jazeera English"],
  Europe: ["Euronews", "Reuters Europe", "BBC Europe", "Deutsche Welle", "Le Monde", "El País"],
  Asia: ["Reuters Asia", "South China Morning Post", "NHK World", "Nikkei Asia", "The Hindu"],
  Africa: ["AllAfrica", "Reuters Africa", "Al Jazeera Africa", "BBC Africa", "Daily Nation"],
  Americas: ["Reuters Americas", "AP Americas", "CNN", "NPR", "The Guardian US"],
};

const TICKER_SPEEDS = [
  { label: "Slow", value: "speed-slow" },
  { label: "Normal", value: "speed-medium" },
  { label: "Fast", value: "speed-fast" },
];

interface TickerItem {
  id?: number;
  text: string;
  type: "breaking" | "warning" | "normal";
  url?: string;
  country?: string;
  publishedAt?: string;
}

interface LiveTickerProps { region: string; }

export default function LiveTicker({ region }: LiveTickerProps) {
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [tickerSpeed, setTickerSpeed] = useState("speed-slow");
  const [tickerItems, setTickerItems] = useState<TickerItem[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  const sources = NEWS_SOURCES_BY_REGION[region] ?? NEWS_SOURCES_BY_REGION.MENA;

  const { data: articles } = trpc.articles.list.useQuery(
    { region, limit: 40, isBreaking: undefined },
    { refetchInterval: 30000 }
  );

  const { data: breaking } = trpc.articles.breaking.useQuery(
    { region, limit: 15 },
    { refetchInterval: 15000 }
  );

  const toggleSource = (source: string) => {
    setSelectedSources(prev =>
      prev.includes(source) ? prev.filter(s => s !== source) : [...prev, source]
    );
  };

  const selectAll = () => setSelectedSources([...sources]);
  const clearAll = () => setSelectedSources([]);

  const buildUrl = (a: { url?: string; title?: string }) => {
    if (a.url?.startsWith('http') && !a.url.includes('example.com')) return a.url;
    return `https://news.google.com/search?q=${encodeURIComponent(a.title ?? '')}&hl=en-US&gl=US&ceid=US:en`;
  };

  useEffect(() => {
    const items: TickerItem[] = [];

    // Breaking news first — always shown
    breaking?.forEach(a => {
      items.push({
        id: a.id,
        text: `${a.title}${a.country ? ` — ${a.country}` : ''}`,
        type: "breaking",
        url: buildUrl(a),
        country: a.country ?? undefined,
        publishedAt: a.publishedAt ?? undefined,
      });
    });

    // Regular articles
    const filteredArticles = articles?.filter(a => !a.isBreaking) ?? [];

    filteredArticles.slice(0, 30).forEach(a => {
      items.push({
        id: a.id,
        text: `${a.title}${a.country ? ` — ${a.country}` : ''}`,
        type: "normal",
        url: buildUrl(a),
        country: a.country ?? undefined,
        publishedAt: a.publishedAt ?? undefined,
      });
    });

    if (items.length === 0) {
      items.push(
        { text: `GEOINT Platform initialized — monitoring ${region} region`, type: "normal" },
        { text: `Intelligence crawlers active — scanning ${sources.length} sources`, type: "normal" },
        { text: `Facilities database loaded — tracking critical infrastructure`, type: "normal" },
        { text: `Network graph ready — analyzing entity relationships`, type: "normal" },
      );
    }

    setTickerItems(items);
  }, [articles, breaking, region, selectedSources]);

  const displayItems = [...tickerItems, ...tickerItems];
  const activeSourceCount = selectedSources.length;

  return (
    <div className="flex-shrink-0 h-9 ticker-bar flex items-center z-50 relative border-t border-border">
      {/* Label */}
      <div className="flex items-center gap-2 px-3 border-r border-border flex-shrink-0 h-full bg-card/90">
        <Radio size={10} className="text-primary blink" />
        <span className="text-orbitron text-[9px] font-bold text-primary tracking-widest">LIVE</span>
      </div>

      {/* Breaking indicator */}
      {(breaking?.length ?? 0) > 0 && (
        <div className="flex items-center gap-1.5 px-2.5 border-r border-border flex-shrink-0 h-full bg-destructive/10">
          <AlertTriangle size={9} className="text-destructive blink" />
          <span className="text-mono text-[9px] text-destructive font-bold">{breaking?.length} BREAKING</span>
        </div>
      )}

      {/* Scrolling Ticker — pauses on hover */}
      <div
        className="flex-1 overflow-hidden h-full flex items-center relative cursor-pointer"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        title="Hover to pause · Click item to open article"
      >
        <div
          ref={tickerRef}
          className={`ticker-content ${tickerSpeed}`}
          style={{ animationPlayState: isPaused ? 'paused' : 'running' }}
        >
          {displayItems.map((item, i) => {
            const isClickable = !!item.url;
            const content = (
              <>
                <span className={`text-[8px] mr-1 ${
                  item.type === "breaking" ? "text-destructive" :
                  item.type === "warning" ? "text-yellow-400" : "text-primary/60"
                }`}>
                  {item.type === "breaking" ? "◉" : item.type === "warning" ? "▲" : "◆"}
                </span>
                {item.type === "breaking" && (
                  <span className="text-destructive text-[8px] font-black tracking-widest mr-1">BREAKING</span>
                )}
                <span className={`${
                  item.type === "breaking"
                    ? "text-destructive font-semibold"
                    : item.type === "warning"
                    ? "text-yellow-400"
                    : "text-foreground/85"
                }`}>
                  {item.text}
                </span>
                {isClickable && (
                  <ExternalLink size={8} className="ml-1 opacity-0 group-hover:opacity-60 transition-opacity flex-shrink-0" />
                )}
              </>
            );

            if (isClickable) {
              return (
                <a
                  key={`${item.id ?? i}-${i}`}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] px-5 flex items-center gap-1 flex-shrink-0 font-medium group hover:bg-primary/5 transition-colors rounded"
                  onClick={e => e.stopPropagation()}
                >
                  {content}
                </a>
              );
            }

            return (
              <span
                key={i}
                className="text-[11px] px-5 flex items-center gap-1 flex-shrink-0 font-medium"
              >
                {content}
              </span>
            );
          })}
        </div>
        {/* Pause indicator */}
        {isPaused && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-primary/40 font-mono tracking-widest pointer-events-none">
            ⏸ PAUSED
          </div>
        )}
      </div>

      {/* Speed Control */}
      <div className="flex items-center border-l border-border h-full flex-shrink-0">
        <button
          onClick={() => { setShowSettings(!showSettings); setShowDropdown(false); }}
          className={`flex items-center gap-1.5 px-2.5 h-full text-[9px] font-medium transition-all ${showSettings ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
          title="Ticker settings"
        >
          <Settings2 size={10} />
        </button>
        {showSettings && (
          <div className="absolute bottom-full right-32 mb-1 bg-card border border-border z-50 p-3 min-w-[140px]">
            <div className="text-mono text-[9px] text-muted-foreground mb-2 tracking-widest">TICKER SPEED</div>
            {TICKER_SPEEDS.map(s => (
              <button
                key={s.value}
                onClick={() => { setTickerSpeed(s.value); setShowSettings(false); }}
                className={`w-full text-left px-2 py-1.5 text-[11px] font-medium flex items-center gap-2 rounded hover:bg-primary/10 transition-all ${tickerSpeed === s.value ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {tickerSpeed === s.value && <Check size={9} />}
                {tickerSpeed !== s.value && <span className="w-[9px]" />}
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Attribution */}
      <div className="hidden md:flex items-center px-3 border-l border-border h-full flex-shrink-0">
        <a
          href="https://owlink.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[9px] tracking-widest transition-colors duration-200 select-none whitespace-nowrap font-semibold"
          style={{ color: "rgba(220,38,38,0.75)", letterSpacing: "0.12em" }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = "rgba(248,113,113,1)"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = "rgba(220,38,38,0.75)"; }}
        >
          © ALEXSAI · OWLINK.AI
        </a>
      </div>

      {/* Source Selector */}
      <div className="relative flex-shrink-0 border-l border-border h-full">
        <button
          onClick={() => { setShowDropdown(!showDropdown); setShowSettings(false); }}
          className={`flex items-center gap-1.5 px-3 h-full text-[10px] font-medium transition-all ${showDropdown ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-primary'}`}
        >
          <span>{activeSourceCount > 0 ? `${activeSourceCount} Sources` : "All Sources"}</span>
          <ChevronDown size={9} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {showDropdown && (
          <div className="absolute bottom-full right-0 mb-1 bg-card border border-border z-50 min-w-[220px] max-h-72 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border sticky top-0 bg-card">
              <span className="text-mono text-[9px] text-muted-foreground tracking-widest">NEWS SOURCES</span>
              <div className="flex items-center gap-2">
                <button onClick={selectAll} className="text-[9px] text-primary hover:underline font-medium">All</button>
                <span className="text-border">|</span>
                <button onClick={clearAll} className="text-[9px] text-muted-foreground hover:text-primary font-medium">Clear</button>
              </div>
            </div>
            {sources.map(source => (
              <button
                key={source}
                onClick={() => toggleSource(source)}
                className={`w-full text-left px-3 py-2 text-[11px] font-medium flex items-center gap-2 hover:bg-primary/10 transition-all ${selectedSources.includes(source) ? 'text-primary' : 'text-muted-foreground'}`}
              >
                <span className={`w-3 h-3 border flex-shrink-0 flex items-center justify-center rounded-sm ${selectedSources.includes(source) ? 'border-primary bg-primary/20' : 'border-border'}`}>
                  {selectedSources.includes(source) && <Check size={8} className="text-primary" />}
                </span>
                {source}
              </button>
            ))}
          </div>
        )}
      </div>

      {(showDropdown || showSettings) && (
        <div className="fixed inset-0 z-40" onClick={() => { setShowDropdown(false); setShowSettings(false); }} />
      )}
    </div>
  );
}
