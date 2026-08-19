import React, { useEffect, useRef, useId, useMemo } from "react";

interface RadarDataItem {
  subject?: string;
  [key: string]: string | number | undefined;
}

interface Series {
  field: string;
  name: string;
  color: string;
}

interface AmChartsRadarProps {
  data: RadarDataItem[];
  series: Series[];
  height?: number;
  theme?: "dark" | "light";
  showLegend?: boolean;
}

export default function AmChartsRadar({
  data,
  series,
  height = 220,
  theme = "dark",
  showLegend = true,
}: AmChartsRadarProps) {
  const chartDivRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<any>(null);
  const seriesRefs = useRef<any[]>([]);
  const initializedRef = useRef(false);
  const uid = useId().replace(/:/g, "");

  const dataKey = useMemo(() => JSON.stringify(data), [data]);

  useEffect(() => {
    if (!chartDivRef.current || initializedRef.current) return;
    let cancelled = false;

    Promise.all([
      import("@amcharts/amcharts5"),
      import("@amcharts/amcharts5/radar"),
      import("@amcharts/amcharts5/xy"),
      import("@amcharts/amcharts5/themes/Animated"),
    ]).then(([am5, am5radar, am5xy, am5themes_Animated]) => {
      if (cancelled || !chartDivRef.current || rootRef.current) return;
      initializedRef.current = true;

      const root = am5.Root.new(chartDivRef.current!);
      rootRef.current = root;
      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5radar.RadarChart.new(root, {
          panX: false,
          panY: false,
          wheelX: "none",
          wheelY: "none",
          innerRadius: am5.percent(10),
          paddingTop: 10,
          paddingBottom: 10,
        })
      );

      chart.set("background", am5.Rectangle.new(root, { fill: am5.color(0x000000), fillOpacity: 0 }));

      // Cursor
      const cursor = chart.set("cursor", am5radar.RadarCursor.new(root, {
        behavior: "zoomX",
      }));
      cursor.lineY.set("visible", false);
      cursor.lineX.setAll({
        stroke: am5.color(theme === "dark" ? 0x22d3ee : 0x0891b2),
        strokeWidth: 1,
        strokeDasharray: [3, 3],
        strokeOpacity: 0.5,
      });

      const xRenderer = am5radar.AxisRendererCircular.new(root, {});
      xRenderer.labels.template.setAll({
        radius: 10,
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 9,
        fontFamily: "Inter, sans-serif",
        textType: "radial",
        centerX: am5.p50,
      });
      xRenderer.grid.template.setAll({
        stroke: am5.color(theme === "dark" ? 0x334155 : 0xe2e8f0),
        strokeOpacity: 0.3,
      });

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          maxDeviation: 0,
          categoryField: "subject",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      const yRenderer = am5radar.AxisRendererRadial.new(root, { minGridDistance: 20 });
      yRenderer.labels.template.setAll({
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 8,
        fontFamily: "Inter, sans-serif",
        centerX: am5.p100,
      });
      yRenderer.grid.template.setAll({
        stroke: am5.color(theme === "dark" ? 0x334155 : 0xe2e8f0),
        strokeOpacity: 0.2,
      });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: yRenderer,
          min: 0,
        })
      );

      seriesRefs.current = [];

      series.forEach((s, idx) => {
        const radarSeries = chart.series.push(
          am5radar.RadarLineSeries.new(root, {
            name: s.name,
            xAxis,
            yAxis,
            valueYField: s.field,
            categoryXField: "subject",
            tooltip: am5.Tooltip.new(root, {
              labelText: `[bold]{name}[/]\n{categoryX}: [bold]{valueY}[/]`,
              getFillFromSprite: false,
              background: am5.Rectangle.new(root, {
                fill: am5.color(theme === "dark" ? 0x1e293b : 0xffffff),
                stroke: am5.color(s.color),
                strokeWidth: 1,
              }),
            }),
          })
        );

        radarSeries.strokes.template.setAll({
          stroke: am5.color(s.color),
          strokeWidth: 2,
        });

        radarSeries.fills.template.setAll({
          fill: am5.color(s.color),
          fillOpacity: 0.12,
          visible: true,
        });

        radarSeries.bullets.push(() =>
          am5.Bullet.new(root, {
            sprite: am5.Circle.new(root, {
              radius: 4,
              stroke: am5.color(s.color),
              strokeWidth: 2,
              fill: am5.color(theme === "dark" ? 0x0f172a : 0xffffff),
              interactive: true,
            }),
          })
        );

        radarSeries.data.setAll(data);
        seriesRefs.current[idx] = radarSeries;
        radarSeries.appear(1000, idx * 150);
      });

      xAxis.data.setAll(data);

      // Legend
      if (showLegend && series.length > 1) {
        const legend = chart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 4,
          })
        );
        legend.labels.template.setAll({
          fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
          fontSize: 9,
          fontFamily: "Inter, sans-serif",
        });
        legend.markerRectangles.template.setAll({ cornerRadiusTL: 2, cornerRadiusTR: 2, cornerRadiusBL: 2, cornerRadiusBR: 2 });
        legend.data.setAll(chart.series.values);
      }

      chart.appear(1000, 100);
      (rootRef.current as any)._xAxis = xAxis;
    });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!rootRef.current || !initializedRef.current) return;
    const xAxis = (rootRef.current as any)._xAxis;
    if (!xAxis) return;
    xAxis.data.setAll(data);
    seriesRefs.current.forEach((s) => { if (s) s.data.setAll(data); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  useEffect(() => {
    return () => {
      if (rootRef.current) {
        try { rootRef.current.dispose(); } catch (_) {}
        rootRef.current = null;
        initializedRef.current = false;
        seriesRefs.current = [];
      }
    };
  }, []);

  return (
    <div ref={chartDivRef} id={`amchart-radar-${uid}`} style={{ width: "100%", height: `${height}px` }} />
  );
}
