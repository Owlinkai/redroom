/**
 * ChordDiagram — Production-quality amCharts 5 ChordDirected
 * Shows country-to-country news flow with interactive highlighting.
 *
 * Fix: useEffect depends on a JSON.stringify key (not the array reference)
 * so amCharts only re-initialises when the actual data values change, not
 * on every parent render.  onNodeClick is stored in a stable ref so it
 * never triggers a re-init.
 */
import { useEffect, useId, useRef, useMemo } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5flow from "@amcharts/amcharts5/flow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

interface FlowItem {
  from: string;
  to: string;
  value: number;
}

interface Props {
  data: FlowItem[];
  title?: string;
  onNodeClick?: (country: string) => void;
}

const COUNTRY_COLORS: Record<string, string> = {
  Iran:           "#ef4444",
  Israel:         "#3b82f6",
  Palestine:      "#10b981",
  "Saudi Arabia": "#f59e0b",
  Syria:          "#8b5cf6",
  Yemen:          "#f97316",
  Lebanon:        "#06b6d4",
  Iraq:           "#ec4899",
  Egypt:          "#84cc16",
  Turkey:         "#a78bfa",
  Jordan:         "#fb923c",
  UAE:            "#22d3ee",
  Libya:          "#fbbf24",
  Sudan:          "#f472b6",
  Qatar:          "#4ade80",
  Kuwait:         "#60a5fa",
  Morocco:        "#c084fc",
  Algeria:        "#34d399",
  Russia:         "#f87171",
  Ukraine:        "#fde68a",
  China:          "#fb7185",
  USA:            "#818cf8",
  "United States":"#818cf8",
  Germany:        "#6ee7b7",
  France:         "#fca5a5",
  UK:             "#93c5fd",
  MENA:           "#94a3b8",
  Global:         "#64748b",
};

function getCountryColor(name: string): string {
  if (COUNTRY_COLORS[name]) return COUNTRY_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue},65%,55%)`;
}

export default function ChordDiagram({ data, title, onNodeClick }: Props) {
  const uid = useId().replace(/:/g, "");
  const divId = `am5-chord-${uid}`;

  // Stable ref for the callback — updating it never triggers a re-init
  const onNodeClickRef = useRef(onNodeClick);
  useEffect(() => { onNodeClickRef.current = onNodeClick; }, [onNodeClick]);

  // Only re-init when the actual data values change, not the array reference
  const dataKey = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    if (!data.length) return;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(divId);
      if (!el) return;

      // Dispose any existing root on this element
      am5.array.each(am5.registry.rootElements, (root) => {
        if (root.dom === el) root.dispose();
      });

      const root = am5.Root.new(el);
      root.setThemes([am5themes_Animated.new(root)]);

      const series = root.container.children.push(
        am5flow.ChordDirected.new(root, {
          startAngle: 80,
          padAngle: 3,
          linkHeadRadius: 12,
          radius: am5.percent(85),
          sourceIdField: "from",
          targetIdField: "to",
          valueField: "value",
        })
      );

      // ── Node arcs ─────────────────────────────────────────────────────────────
      series.nodes.rectangles.template.setAll({
        fillOpacity: 1,
        strokeOpacity: 0,
        tooltipText: "[bold]{id}[/]\n[fontSize:9px]Click to explore[/]",
        cursorOverStyle: "pointer",
        interactive: true,
      });

      series.nodes.rectangles.template.states.create("hover", {
        fillOpacity: 0.75,
      });

      series.nodes.rectangles.template.states.create("active", {
        fillOpacity: 1,
      });

      // Node click — uses stable ref, never causes re-init
      series.nodes.rectangles.template.events.on("click", (ev) => {
        const id = (ev.target.dataItem?.dataContext as any)?.id as string | undefined;
        if (id && onNodeClickRef.current) onNodeClickRef.current(id);
      });

      // ── Node labels ───────────────────────────────────────────────────────────
      series.nodes.labels.template.setAll({
        fontSize: 11,
        fill: am5.color("#f1f5f9"),
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        fontWeight: "700",
        textType: "radial",
        radius: 10,
        oversizedBehavior: "truncate",
        maxWidth: 95,
      });

      // ── Chord links ───────────────────────────────────────────────────────────
      series.links.template.setAll({
        fillOpacity: 0.28,
        strokeOpacity: 0,
        tooltipText: "[bold]{sourceId}[/] → [bold]{targetId}[/]\n[fontSize:9px]{value} co-mentions[/]",
        interactive: true,
        cursorOverStyle: "pointer",
      });

      series.links.template.states.create("hover", {
        fillOpacity: 0.72,
      });

      // ── Color adapters ────────────────────────────────────────────────────────
      series.nodes.rectangles.template.adapters.add("fill", (fill, target) => {
        const id = (target.dataItem?.dataContext as any)?.id as string | undefined;
        if (id) return am5.color(getCountryColor(id));
        return fill;
      });

      series.nodes.rectangles.template.adapters.add("stroke", (stroke, target) => {
        const id = (target.dataItem?.dataContext as any)?.id as string | undefined;
        if (id) return am5.color(getCountryColor(id));
        return stroke;
      });

      series.links.template.adapters.add("fill", (fill, target) => {
        const sourceId = (target.dataItem?.dataContext as any)?.from as string | undefined;
        if (sourceId) return am5.color(getCountryColor(sourceId));
        return fill;
      });

      // ── Data ──────────────────────────────────────────────────────────────────
      series.data.setAll(data);
      series.appear(1000, 100);

      (el as any).__am5root = root;
    });

    return () => {
      cancelAnimationFrame(frame);
      const el = document.getElementById(divId);
      if (el && (el as any).__am5root) {
        try { (el as any).__am5root.dispose(); } catch (_) {}
        delete (el as any).__am5root;
      }
    };
  // dataKey is the stable serialized version of data — only re-runs when values actually change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divId, dataKey]);

  // Build top connections legend
  const topConnections = [...data]
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className="flex flex-col h-full">
      {title && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0">
          <div className="w-1 h-4 rounded-full bg-primary" />
          <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto">Hover chords · Click arcs to explore</span>
        </div>
      )}
      {!data.length ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <div className="text-2xl opacity-20">⟳</div>
            <div className="text-xs text-muted-foreground">No cross-country news flow data</div>
            <div className="text-[10px] text-muted-foreground/60">Crawl more articles to populate this chart</div>
          </div>
        </div>
      ) : (
        <>
          <div id={divId} className="flex-1 min-h-0" style={{ borderRadius: '8px', overflow: 'hidden' }} />
          {/* Top connections legend */}
          {topConnections.length > 0 && (
            <div className="flex-shrink-0 mt-2 pt-2 border-t border-foreground/10">
              <div className="text-[9px] text-muted-foreground/60 uppercase tracking-wider mb-1.5 font-bold">Top Connections</div>
              <div className="grid grid-cols-2 gap-1">
                {topConnections.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-[9px]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getCountryColor(item.from) }} />
                    <span className="text-foreground/60 truncate">{item.from} → {item.to}</span>
                    <span className="ml-auto font-mono text-muted-foreground/80 flex-shrink-0">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
