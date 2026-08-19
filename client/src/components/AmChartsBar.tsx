import React, { useEffect, useRef, useId, useMemo } from "react";

interface DataItem {
  category: string;
  [key: string]: string | number;
}

interface Series {
  field: string;
  name: string;
  color: string;
}

interface AmChartsBarProps {
  data: DataItem[];
  series: Series[];
  height?: number;
  theme?: "dark" | "light";
  rotateLabels?: boolean;
  showLegend?: boolean;
  showScrollbar?: boolean;
  showCursor?: boolean;
}

export default function AmChartsBar({
  data,
  series,
  height = 220,
  theme = "dark",
  rotateLabels = false,
  showLegend = true,
  showScrollbar = true,
  showCursor = true,
}: AmChartsBarProps) {
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
          panX: data.length > 6,
          panY: false,
          wheelX: data.length > 6 ? "panX" : "none",
          wheelY: "none",
          pinchZoomX: data.length > 6,
          paddingLeft: 0,
          paddingRight: 0,
          paddingTop: 8,
          paddingBottom: 0,
          layout: root.verticalLayout,
        })
      );

      chart.set("background", am5.Rectangle.new(root, { fill: am5.color(0x000000), fillOpacity: 0 }));

      // Cursor
      if (showCursor) {
        const cursor = chart.set("cursor", am5xy.XYCursor.new(root, {
          behavior: data.length > 6 ? "zoomX" : "none",
        }));
        cursor.lineY.set("visible", false);
        cursor.lineX.setAll({
          stroke: am5.color(theme === "dark" ? 0x22d3ee : 0x0891b2),
          strokeWidth: 1,
          strokeDasharray: [3, 3],
          strokeOpacity: 0.5,
        });
      }

      const xRenderer = am5xy.AxisRendererX.new(root, {
        minGridDistance: 30,
        strokeOpacity: 0,
      });
      xRenderer.labels.template.setAll({
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 9,
        fontFamily: "Inter, sans-serif",
        rotation: rotateLabels ? -35 : 0,
        centerY: rotateLabels ? am5.p50 : am5.p0,
        centerX: rotateLabels ? am5.p100 : am5.p50,
        paddingRight: rotateLabels ? 10 : 0,
      });
      xRenderer.grid.template.setAll({ strokeOpacity: 0 });

      const xAxis = chart.xAxes.push(
        am5xy.CategoryAxis.new(root, {
          maxDeviation: 0.3,
          categoryField: "category",
          renderer: xRenderer,
          tooltip: am5.Tooltip.new(root, {}),
        })
      );

      const yRenderer = am5xy.AxisRendererY.new(root, { strokeOpacity: 0 });
      yRenderer.labels.template.setAll({
        fill: am5.color(theme === "dark" ? 0x94a3b8 : 0x64748b),
        fontSize: 9,
        fontFamily: "Inter, sans-serif",
      });
      yRenderer.grid.template.setAll({
        stroke: am5.color(theme === "dark" ? 0x334155 : 0xe2e8f0),
        strokeOpacity: 0.3,
        strokeDasharray: [3, 3],
      });

      const yAxis = chart.yAxes.push(
        am5xy.ValueAxis.new(root, { renderer: yRenderer })
      );

      seriesRefs.current = [];

      series.forEach((s, idx) => {
        const columnSeries = chart.series.push(
          am5xy.ColumnSeries.new(root, {
            name: s.name,
            xAxis,
            yAxis,
            valueYField: s.field,
            categoryXField: "category",
            clustered: series.length > 1,
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

        columnSeries.columns.template.setAll({
          fill: am5.color(s.color),
          stroke: am5.color(s.color),
          cornerRadiusTL: 3,
          cornerRadiusTR: 3,
          fillOpacity: 0.8,
          strokeOpacity: 0,
          width: am5.percent(series.length > 1 ? 70 : 65),
        });

        columnSeries.columns.template.states.create("hover", {
          fillOpacity: 1,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
        });

        // Bullet labels on bars
        columnSeries.bullets.push(() =>
          am5.Bullet.new(root, {
            locationY: 1,
            sprite: am5.Label.new(root, {
              text: "{valueY}",
              fill: am5.color(s.color),
              centerX: am5.p50,
              centerY: am5.p100,
              fontSize: 8,
              fontFamily: "Inter, sans-serif",
              paddingBottom: 4,
              populateText: true,
            }),
          })
        );

        columnSeries.data.setAll(data);
        seriesRefs.current[idx] = columnSeries;
        columnSeries.appear(1000, idx * 100);
      });

      xAxis.data.setAll(data);

      // Scrollbar
      if (showScrollbar && data.length > 6) {
        const scrollbar = chart.set("scrollbarX", am5xy.XYChartScrollbar.new(root, {
          orientation: "horizontal",
          height: 30,
        }));
        const sbxAxis = scrollbar.chart.xAxes.push(
          am5xy.CategoryAxis.new(root, {
            categoryField: "category",
            renderer: am5xy.AxisRendererX.new(root, { minGridDistance: 60, strokeOpacity: 0 }),
          })
        );
        const sbyAxis = scrollbar.chart.yAxes.push(
          am5xy.ValueAxis.new(root, {
            renderer: am5xy.AxisRendererY.new(root, { strokeOpacity: 0 }),
          })
        );
        const sbSeries = scrollbar.chart.series.push(
          am5xy.ColumnSeries.new(root, {
            xAxis: sbxAxis,
            yAxis: sbyAxis,
            valueYField: series[0].field,
            categoryXField: "category",
          })
        );
        sbSeries.columns.template.setAll({
          fill: am5.color(series[0].color),
          stroke: am5.color(series[0].color),
          fillOpacity: 0.4,
          strokeOpacity: 0,
        });
        sbSeries.data.setAll(data);
        sbxAxis.data.setAll(data);
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
      (rootRef.current as any)._chart = chart;
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
    <div ref={chartDivRef} id={`amchart-bar-${uid}`} style={{ width: "100%", height: `${height}px` }} />
  );
}
