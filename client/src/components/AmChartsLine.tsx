import React, { useEffect, useRef, useId, useMemo } from "react";

interface DataItem {
  date: number; // timestamp ms
  [key: string]: number;
}

interface Series {
  field: string;
  name: string;
  color: string;
}

interface AmChartsLineProps {
  data: DataItem[];
  series: Series[];
  height?: number;
  theme?: "dark" | "light";
  showLegend?: boolean;
  showScrollbar?: boolean;
  filled?: boolean;
}

export default function AmChartsLine({
  data,
  series,
  height = 220,
  theme = "dark",
  showLegend = true,
  showScrollbar = true,
  filled = true,
}: AmChartsLineProps) {
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
      import("@amcharts/amcharts5/xy"),
      import("@amcharts/amcharts5/themes/Animated"),
    ]).then(([am5, am5xy, am5themes_Animated]) => {
      if (cancelled || !chartDivRef.current || rootRef.current) return;
      initializedRef.current = true;

      const root = am5.Root.new(chartDivRef.current!);
      rootRef.current = root;
      root.setThemes([am5themes_Animated.default.new(root)]);

      const chart = root.container.children.push(
        am5xy.XYChart.new(root, {
          panX: true,
          panY: false,
          wheelX: "panX",
          wheelY: "zoomX",
          pinchZoomX: true,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 8,
          paddingBottom: 0,
          layout: root.verticalLayout,
        })
      );

      chart.set("background", am5.Rectangle.new(root, { fill: am5.color(0x000000), fillOpacity: 0 }));

      // Cursor
      const cursor = chart.set("cursor", am5xy.XYCursor.new(root, { behavior: "none" }));
      cursor.lineY.set("visible", false);
      cursor.lineX.setAll({
        stroke: am5.color(theme === "dark" ? 0x22d3ee : 0x0891b2),
        strokeWidth: 1,
        strokeDasharray: [3, 3],
        strokeOpacity: 0.6,
      });

      const xAxis = chart.xAxes.push(
        am5xy.DateAxis.new(root, {
          maxDeviation: 0.2,
          baseInterval: { timeUnit: "day", count: 1 },
          renderer: am5xy.AxisRendererX.new(root, {
            minGridDistance: 50,
            strokeOpacity: 0,
          }),
          tooltip: am5.Tooltip.new(root, {}),
        })
      );
      xAxis.get("renderer").labels.template.setAll({
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 9,
        fontFamily: "Inter, sans-serif",
      });
      xAxis.get("renderer").grid.template.setAll({
        stroke: am5.color(theme === "dark" ? 0x334155 : 0xe2e8f0),
        strokeOpacity: 0.3,
        strokeDasharray: [3, 3],
      });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, {
          renderer: am5xy.AxisRendererY.new(root, { strokeOpacity: 0 }),
        })
      );
      yAxis.get("renderer").labels.template.setAll({
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 9,
        fontFamily: "Inter, sans-serif",
      });
      yAxis.get("renderer").grid.template.setAll({
        stroke: am5.color(theme === "dark" ? 0x334155 : 0xe2e8f0),
        strokeOpacity: 0.3,
        strokeDasharray: [3, 3],
      });

      seriesRefs.current = [];

      series.forEach((s, idx) => {
        const lineSeries = chart.series.push(
          am5xy.SmoothedXLineSeries.new(root, {
            name: s.name,
            xAxis,
            yAxis,
            valueYField: s.field,
            valueXField: "date",
            tooltip: am5.Tooltip.new(root, {
              labelText: `[bold]{name}[/]\n{valueX.formatDate('MMM dd')}: [bold]{valueY}[/]`,
              getFillFromSprite: false,
              background: am5.Rectangle.new(root, {
                fill: am5.color(theme === "dark" ? 0x1e293b : 0xffffff),
                stroke: am5.color(s.color),
                strokeWidth: 1,
              }),
            }),
          })
        );

        lineSeries.strokes.template.setAll({
          stroke: am5.color(s.color),
          strokeWidth: 2.5,
        });

        if (filled) {
          lineSeries.fills.template.setAll({
            fill: am5.color(s.color),
            fillOpacity: 0.08,
            visible: true,
          });
        }

        // Bullets on hover
        lineSeries.bullets.push(() =>
          am5.Bullet.new(root, {
            sprite: am5.Circle.new(root, {
              radius: 4,
              stroke: am5.color(s.color),
              strokeWidth: 2,
              fill: am5.color(theme === "dark" ? 0x0f172a : 0xffffff),
            }),
          })
        );

        lineSeries.data.setAll(data);
        seriesRefs.current[idx] = lineSeries;
        lineSeries.appear(1000, idx * 100);
      });

      // Scrollbar
      if (showScrollbar && data.length > 10) {
        const scrollbar = chart.set("scrollbarX", am5xy.XYChartScrollbar.new(root, {
          orientation: "horizontal",
          height: 30,
        }));
        const sbxAxis = scrollbar.chart.xAxes.push(
          am5xy.DateAxis.new(root, {
            baseInterval: { timeUnit: "day", count: 1 },
            renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 60, strokeOpacity: 0 }),
          })
        );
        const sbyAxis = scrollbar.chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, { strokeOpacity: 0 }),
          })
        );
        const sbSeries = scrollbar.chart.series.push(
          am5xy.SmoothedXLineSeries.new(root, {
            xAxis: sbxAxis,
            yAxis: sbyAxis,
            valueYField: series[0].field,
            valueXField: "date",
          })
        );
        sbSeries.strokes.template.setAll({
          stroke: am5.color(series[0].color),
          strokeWidth: 1.5,
          strokeOpacity: 0.6,
        });
        sbSeries.fills.template.setAll({
          fill: am5.color(series[0].color),
          fillOpacity: 0.05,
          visible: true,
        });
        sbSeries.data.setAll(data);
      }

      // Legend
      if (showLegend && series.length > 1) {
        const legend = chart.children.push(
          am5.Legend.new(root, {
            centerX: am5.p50,
            x: am5.p50,
            marginTop: 8,
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
    <div ref={chartDivRef} id={`amchart-line-${uid}`} style={{ width: "100%", height: `${height}px` }} />
  );
}
