/**
 * ForceDirectedTree — Production-quality amCharts 5 force-directed tree
 *
 * Key design decisions:
 * 1. Stable DOM ID (not a React ref) so amCharts' injected <style> elements
 *    never conflict with React's reconciler — prevents removeChild crash.
 * 2. `dataKey` prop: caller passes a stable string that changes only when
 *    data meaningfully changes, preventing unnecessary amCharts rebuilds.
 * 3. Empty-state guard: renders a friendly placeholder when data has no children.
 * 4. Proper container sizing: flex-1 min-h-0 ensures the chart fills its parent.
 */
import { useEffect, useId, useMemo } from "react";
import * as am5 from "@amcharts/amcharts5";
import * as am5hierarchy from "@amcharts/amcharts5/hierarchy";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";
import { GitBranch } from "lucide-react";

export interface TreeNode {
  name: string;
  value?: number;
  color?: string;
  nodeType?: string; // 'root' | 'group' | 'person' | 'organization' | 'country' | 'author' | 'agency' | 'keyword' | 'article'
  children?: TreeNode[];
}

interface Props {
  data: TreeNode;
  /** Stable string that changes only when data meaningfully changes. Used as useEffect dep. */
  dataKey?: string;
  title?: string;
  onNodeClick?: (name: string) => void;
}

// Node type → color mapping (matches vis-network NODE_STYLES)
const TYPE_COLORS: Record<string, string> = {
  root:         "#7c3aed",
  group:        "#334155",
  person:       "#f472b6",
  organization: "#fb923c",
  country:      "#10b981",
  author:       "#a78bfa",
  agency:       "#f59e0b",
  keyword:      "#6b7280",
  article:      "#22d3ee",
  facility:     "#ef4444",
};

const LEGEND_TYPES = ['person', 'organization', 'country', 'author', 'agency', 'keyword', 'article', 'facility'] as const;

export default function ForceDirectedTree({ data, dataKey, title, onNodeClick }: Props) {
  const uid = useId().replace(/:/g, "");
  const divId = `am5-fdt-${uid}`;

  // Determine if there's meaningful data to render
  const hasData = useMemo(() => {
    return !!(data?.children && data.children.length > 0);
  }, [data]);

  // Stable effect key: use dataKey if provided, otherwise serialize top-level structure
  const effectKey = dataKey ?? JSON.stringify({
    root: data?.name,
    childCount: data?.children?.length ?? 0,
    firstChild: data?.children?.[0]?.name,
  });

  useEffect(() => {
    if (!hasData) return;

    let frameId: number;
    let root: am5.Root | null = null;

    frameId = requestAnimationFrame(() => {
      const el = document.getElementById(divId);
      if (!el) return;

      // Dispose any previous root attached to this element
      if ((el as any).__am5root) {
        try { (el as any).__am5root.dispose(); } catch (_) {}
        delete (el as any).__am5root;
      }

      root = am5.Root.new(el);
      root.setThemes([am5themes_Animated.new(root)]);

      // Suppress amCharts logo
      root._logo?.dispose();

      const series = root.container.children.push(
        am5hierarchy.ForceDirected.new(root, {
          singleBranchOnly: false,
          downDepth: 2,
          initialDepth: 2,
          topDepth: 0,
          valueField: "value",
          categoryField: "name",
          childDataField: "children",
          idField: "name",
          manyBodyStrength: -35,
          centerStrength: 0.8,
          velocityDecay: 0.4,
          minRadius: am5.percent(2),
          maxRadius: am5.percent(8),
          nodePadding: 6,
        })
      );

      // ── Node circles ────────────────────────────────────────────────────────
      series.circles.template.setAll({
        fillOpacity: 0.9,
        strokeWidth: 2,
        strokeOpacity: 0.7,
        cursorOverStyle: "pointer",
        interactive: true,
      });

      series.circles.template.states.create("hover", {
        fillOpacity: 1,
        scale: 1.2,
        strokeWidth: 3,
        strokeOpacity: 1,
      });

      series.circles.template.states.create("active", {
        fillOpacity: 1,
        scale: 1.25,
        strokeWidth: 4,
        strokeOpacity: 1,
      });

      // Color by nodeType field
      series.circles.template.adapters.add("fill", (_fill, target) => {
        const ctx = target.dataItem?.dataContext as any;
        if (ctx?.color) return am5.color(ctx.color);
        if (ctx?.nodeType && TYPE_COLORS[ctx.nodeType]) return am5.color(TYPE_COLORS[ctx.nodeType]);
        return am5.color("#475569");
      });

      series.circles.template.adapters.add("stroke", (_stroke, target) => {
        const ctx = target.dataItem?.dataContext as any;
        if (ctx?.color) return am5.color(ctx.color);
        if (ctx?.nodeType && TYPE_COLORS[ctx.nodeType]) return am5.color(TYPE_COLORS[ctx.nodeType]);
        return am5.color("#64748b");
      });

      // ── Outer rings ─────────────────────────────────────────────────────────
      series.outerCircles.template.setAll({
        fillOpacity: 0,
        strokeOpacity: 0.15,
        strokeWidth: 1.5,
      });

      series.outerCircles.template.states.create("hover", {
        strokeOpacity: 0.45,
        strokeWidth: 2,
      });

      series.outerCircles.template.adapters.add("stroke", (_stroke, target) => {
        const ctx = target.dataItem?.dataContext as any;
        if (ctx?.color) return am5.color(ctx.color);
        if (ctx?.nodeType && TYPE_COLORS[ctx.nodeType]) return am5.color(TYPE_COLORS[ctx.nodeType]);
        return am5.color("#475569");
      });

      // ── Labels ──────────────────────────────────────────────────────────────
      series.labels.template.setAll({
        fontSize: 9,
        fill: am5.color("#e2e8f0"),
        fontFamily: "'Space Grotesk', 'Inter', sans-serif",
        fontWeight: "600",
        oversizedBehavior: "hide",
        centerX: am5.percent(50),
        centerY: am5.percent(50),
        paddingTop: 0,
        paddingBottom: 0,
        maxWidth: 80,
      });

      // ── Links ────────────────────────────────────────────────────────────────
      series.links.template.setAll({
        strokeOpacity: 0.12,
        strokeWidth: 1.5,
        stroke: am5.color("#94a3b8"),
      });

      series.links.template.states.create("hover", {
        strokeOpacity: 0.45,
        strokeWidth: 2.5,
      });

      // ── Tooltip ──────────────────────────────────────────────────────────────
      const tooltip = am5.Tooltip.new(root, {
        getFillFromSprite: false,
        getStrokeFromSprite: true,
        autoTextColor: false,
        labelText: "[bold fontSize:11px]{name}[/]\n[fontSize:9px opacity:0.6]{nodeType}[/]",
      });
      const tooltipBg = tooltip.get("background") as am5.RoundedRectangle | undefined;
      tooltipBg?.setAll({
        fill: am5.color("#1e293b"),
        fillOpacity: 0.96,
        strokeWidth: 1,
        cornerRadiusTL: 6,
        cornerRadiusTR: 6,
        cornerRadiusBL: 6,
        cornerRadiusBR: 6,
      });
      tooltip.label.setAll({ fill: am5.color("#e2e8f0"), fontSize: 11 });
      series.circles.template.set("tooltip", tooltip);

      // ── Click handler ────────────────────────────────────────────────────────
      if (onNodeClick) {
        series.circles.template.events.on("click", (ev) => {
          const ctx = ev.target.dataItem?.dataContext as any;
          const name = ctx?.name as string | undefined;
          if (name) onNodeClick(name);
        });
      }

      // ── Data ─────────────────────────────────────────────────────────────────
      series.data.setAll([data]);
      series.set("selectedDataItem", series.dataItems[0]);
      series.appear(1000, 100);

      (el as any).__am5root = root;
    });

    return () => {
      cancelAnimationFrame(frameId);
      const el = document.getElementById(divId);
      if (el && (el as any).__am5root) {
        try { (el as any).__am5root.dispose(); } catch (_) {}
        delete (el as any).__am5root;
      }
      root = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divId, effectKey, hasData]);

  return (
    <div className="flex flex-col h-full w-full">
      {/* Header */}
      {title && (
        <div className="flex items-center gap-2 mb-2 flex-shrink-0 px-1">
          <div className="w-1 h-4 rounded-full bg-violet-500" />
          <span className="text-xs font-bold text-foreground/70 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-muted-foreground/60 ml-auto">
            Click entity · Drag to explore · Click group to expand
          </span>
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2 px-1 flex-shrink-0">
        {LEGEND_TYPES.map(type => (
          <span key={type} className="flex items-center gap-1 text-[9px] text-muted-foreground/80">
            <span className="w-2 h-2 rounded-full inline-block flex-shrink-0" style={{ background: TYPE_COLORS[type] }} />
            {type}
          </span>
        ))}
      </div>

      {/* Chart area or empty state */}
      {hasData ? (
        /* amCharts owns this div completely — React never tracks its children */
        <div
          id={divId}
          className="flex-1 min-h-0 w-full"
          style={{ borderRadius: '8px', overflow: 'hidden', minHeight: '200px' }}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-3">
            <GitBranch size={40} className="mx-auto text-violet-500/20" />
            <div className="text-sm font-semibold text-muted-foreground">No tree data yet</div>
            <div className="text-xs text-muted-foreground/50">
              Run a search in the Network view first, then switch to Tree view
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
