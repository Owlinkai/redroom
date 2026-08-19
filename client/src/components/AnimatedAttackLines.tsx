/**
 * AnimatedAttackLines
 * An amCharts 5 map overlay showing animated arc lines for reported attacks
 * (missile strikes, airstrikes, cyber attacks). Rendered as a standalone
 * full-screen div that sits on top of the Leaflet map.
 *
 * Uses stable DOM ID (not React ref) to prevent removeChild crashes on unmount.
 */
import { useEffect, useId, useMemo } from "react";
import { usePageVisible } from "@/hooks/usePageVisible";
import * as am5 from "@amcharts/amcharts5";
import * as am5map from "@amcharts/amcharts5/map";
import am5geodata_worldLow from "@amcharts/amcharts5-geodata/worldLow";
import am5themes_Animated from "@amcharts/amcharts5/themes/Animated";

export interface AttackRoute {
  id: string;
  fromLat: number;
  fromLon: number;
  toLat: number;
  toLon: number;
  type: "missile" | "airstrike" | "cyber" | "naval";
  severity: "critical" | "high" | "medium";
  label?: string;
}

interface Props {
  routes: AttackRoute[];
  visible: boolean;
}

const ATTACK_COLORS: Record<AttackRoute["type"], string> = {
  missile:   "#ef4444",
  airstrike: "#f97316",
  cyber:     "#06b6d4",
  naval:     "#3b82f6",
};

const SEVERITY_WIDTH: Record<AttackRoute["severity"], number> = {
  critical: 3,
  high:     2,
  medium:   1.5,
};

export default function AnimatedAttackLines({ routes, visible }: Props) {
  const uid = useId().replace(/:/g, "");
  const divId = `am5-attacks-${uid}`;
  const pageVisible = usePageVisible();

  // Pause/resume amCharts animations when the browser tab is hidden
  // amCharts5 Root exposes _ticker which can be paused via fps(0)
  useEffect(() => {
    const el = document.getElementById(divId);
    const root = el && (el as any).__am5root as (am5.Root & { _ticker?: { fps: (n: number) => void } }) | undefined;
    if (!root) return;
    try {
      if (!pageVisible) {
        root.fps = 0;
      } else {
        root.fps = 60;
      }
    } catch (_) { /* amCharts version may not support fps setter */ }
  }, [pageVisible, divId]);

  // Stable routes reference
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const stableRoutes = useMemo(() => routes, [JSON.stringify(routes)]);

  useEffect(() => {
    if (!visible) return;

    const frame = requestAnimationFrame(() => {
      const el = document.getElementById(divId);
      if (!el) return;

      // Dispose any existing root on this element
      am5.array.each(am5.registry.rootElements, (root) => {
        if (root.dom === el) root.dispose();
      });

      const root = am5.Root.new(el);
      root.setThemes([am5themes_Animated.new(root)]);

      const chart = root.container.children.push(
        am5map.MapChart.new(root, {
          panX: "none",
          panY: "none",
          wheelY: "none",
          projection: am5map.geoMercator(),
          rotationX: -30,
          rotationY: 0,
        })
      );

      // Invisible country polygons (needed for projection reference)
      const polygonSeries = chart.series.push(
        am5map.MapPolygonSeries.new(root, { geoJSON: am5geodata_worldLow })
      );
      polygonSeries.mapPolygons.template.setAll({
        fill: am5.color("#ffffff"),
        fillOpacity: 0,
        strokeOpacity: 0,
      });

      // Line series for attack routes
      const lineSeries = chart.series.push(am5map.MapLineSeries.new(root, {}));

      lineSeries.mapLines.template.setAll({
        strokeWidth: 2,
        strokeOpacity: 0.8,
        stroke: am5.color("#ef4444"),
        strokeDasharray: [8, 4],
        strokeDashoffset: 0,
      });

      // Apply per-line colors
      lineSeries.mapLines.template.adapters.add("stroke", (stroke, target) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const color = (target.dataItem?.dataContext as any)?.strokeColor as string | undefined;
        if (color) return am5.color(color);
        return stroke;
      });
      lineSeries.mapLines.template.adapters.add("strokeWidth", (w, target) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const width = (target.dataItem?.dataContext as any)?.strokeWidth as number | undefined;
        return width ?? w;
      });

      // Animated bullet dots at destination
      const bulletSeries = chart.series.push(am5map.MapPointSeries.new(root, {}));
      bulletSeries.bullets.push((_root, _series, dataItem) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const color = (dataItem.dataContext as any)?.bulletColor as string ?? "#ef4444";
        const circle = am5.Circle.new(root, {
          radius: 5,
          fill: am5.color(color),
          fillOpacity: 0.9,
          strokeOpacity: 0,
          tooltipText: "{label}",
        });
        circle.animate({ key: "radius", from: 5, to: 12, duration: 1000, loops: Infinity, easing: am5.ease.inOut(am5.ease.sine) });
        circle.animate({ key: "fillOpacity", from: 0.9, to: 0.1, duration: 1000, loops: Infinity, easing: am5.ease.inOut(am5.ease.sine) });
        return am5.Bullet.new(root, { sprite: circle });
      });

      // Build data
      const lineData: object[] = [];
      const bulletData: object[] = [];
      stableRoutes.forEach((route) => {
        const color = ATTACK_COLORS[route.type];
        const width = SEVERITY_WIDTH[route.severity];
        lineData.push({
          geometry: { type: "LineString", coordinates: [[route.fromLon, route.fromLat], [route.toLon, route.toLat]] },
          strokeColor: color,
          strokeWidth: width,
          label: route.label ?? `${route.type} attack`,
        });
        bulletData.push({
          geometry: { type: "Point", coordinates: [route.toLon, route.toLat] },
          label: route.label ?? `${route.type} attack`,
          bulletColor: color,
        });
      });

      lineSeries.data.setAll(lineData);
      bulletSeries.data.setAll(bulletData);

      // Animate dash offset after data loads
      lineSeries.events.on("datavalidated", () => {
        lineSeries.mapLines.each((line) => {
          line.animate({ key: "strokeDashoffset", from: 100, to: 0, duration: 2000, loops: Infinity, easing: am5.ease.linear });
        });
      });

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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [divId, stableRoutes, visible]);

  if (!visible) return null;

  return (
    <div
      id={divId}
      className="absolute inset-0 pointer-events-none z-[500]"
      style={{ background: "transparent" }}
    />
  );
}
