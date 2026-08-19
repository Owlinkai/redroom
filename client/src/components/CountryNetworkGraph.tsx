/**
 * CountryNetworkGraph — Pure-SVG force-directed network graph
 * Shows country co-mention flows as an interactive node-link diagram.
 * No external charting library — runs a simple spring-force simulation
 * using requestAnimationFrame, stabilises after ~120 ticks, then stops.
 */
import { useEffect, useRef, useState, useMemo, useCallback } from "react";

interface FlowItem {
  from: string;
  to: string;
  value: number;
  topics?: string[];
}

interface Props {
  data: FlowItem[];
  filterCountry?: string | null;
  onNodeClick?: (country: string) => void;
  width?: number;
  height?: number;
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
  Russia:         "#f87171",
  Ukraine:        "#fde68a",
  China:          "#fb7185",
  USA:            "#818cf8",
};

function getColor(name: string): string {
  if (COUNTRY_COLORS[name]) return COUNTRY_COLORS[name];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360},65%,55%)`;
}

interface NodeState {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  volume: number;
  color: string;
}

function runSimulation(
  nodes: NodeState[],
  edges: FlowItem[],
  W: number,
  H: number,
  ticks = 160
): NodeState[] {
  const maxVol = Math.max(...nodes.map(n => n.volume), 1);
  const ns = nodes.map(n => ({ ...n }));

  for (let t = 0; t < ticks; t++) {
    const alpha = 1 - t / ticks;

    // Repulsion between all pairs
    for (let i = 0; i < ns.length; i++) {
      for (let j = i + 1; j < ns.length; j++) {
        const dx = ns[j].x - ns[i].x;
        const dy = ns[j].y - ns[i].y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = (3200 / (dist * dist)) * alpha;
        ns[i].vx -= (dx / dist) * force;
        ns[i].vy -= (dy / dist) * force;
        ns[j].vx += (dx / dist) * force;
        ns[j].vy += (dy / dist) * force;
      }
    }

    // Attraction along edges
    edges.forEach(e => {
      const src = ns.find(n => n.id === e.from);
      const tgt = ns.find(n => n.id === e.to);
      if (!src || !tgt) return;
      const dx = tgt.x - src.x;
      const dy = tgt.y - src.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const idealDist = 100 + (1 - e.value / 60) * 80;
      const force = ((dist - idealDist) / dist) * 0.06 * alpha;
      src.vx += dx * force;
      src.vy += dy * force;
      tgt.vx -= dx * force;
      tgt.vy -= dy * force;
    });

    // Gravity toward center
    ns.forEach(n => {
      n.vx += (W / 2 - n.x) * 0.008 * alpha;
      n.vy += (H / 2 - n.y) * 0.008 * alpha;
    });

    // Integrate + dampen + clamp
    const pad = 40;
    ns.forEach(n => {
      n.vx *= 0.82;
      n.vy *= 0.82;
      n.x = Math.max(pad, Math.min(W - pad, n.x + n.vx));
      n.y = Math.max(pad, Math.min(H - pad, n.y + n.vy));
    });
  }

  return ns;
}

export default function CountryNetworkGraph({
  data,
  filterCountry,
  onNodeClick,
  width = 500,
  height = 340,
}: Props) {
  const [nodes, setNodes] = useState<NodeState[]>([]);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<FlowItem | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; label: string } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dataKey = useMemo(() => JSON.stringify(data), [data]);

  // Build + simulate whenever data changes
  useEffect(() => {
    if (!data.length) return;

    const volMap: Record<string, number> = {};
    data.forEach(e => {
      volMap[e.from] = (volMap[e.from] ?? 0) + e.value;
      volMap[e.to] = (volMap[e.to] ?? 0) + e.value;
    });
    const countryList = Object.keys(volMap);
    const cx = width / 2, cy = height / 2;
    const r = Math.min(width, height) * 0.35;

    // Initial positions on a circle
    const initNodes: NodeState[] = countryList.map((id, i) => {
      const angle = (i / countryList.length) * Math.PI * 2;
      return {
        id,
        x: cx + r * Math.cos(angle),
        y: cy + r * Math.sin(angle),
        vx: 0,
        vy: 0,
        volume: volMap[id],
        color: getColor(id),
      };
    });

    const simulated = runSimulation(initNodes, data, width, height);
    setNodes(simulated);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey, width, height]);

  const maxVol = useMemo(() => Math.max(...nodes.map(n => n.volume), 1), [nodes]);
  const maxEdge = useMemo(() => Math.max(...data.map(e => e.value), 1), [data]);

  const visibleEdges = useMemo(() => {
    if (!filterCountry) return data;
    return data.filter(e => e.from === filterCountry || e.to === filterCountry);
  }, [data, filterCountry]);

  const getNode = useCallback((id: string) => nodes.find(n => n.id === id), [nodes]);

  const handleNodeClick = useCallback((id: string) => {
    onNodeClick?.(id);
  }, [onNodeClick]);

  if (!nodes.length) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground text-xs">
        Building network…
      </div>
    );
  }

  return (
    <div className="relative w-full h-full">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full"
        style={{ display: "block" }}
      >
        {/* Edges */}
        {visibleEdges.map((e, i) => {
          const src = getNode(e.from);
          const tgt = getNode(e.to);
          if (!src || !tgt) return null;
          const isHovered = hoveredEdge === e || hoveredNode === e.from || hoveredNode === e.to;
          const isFiltered = filterCountry && (e.from === filterCountry || e.to === filterCountry);
          const strokeW = 1 + (e.value / maxEdge) * 5;
          const opacity = filterCountry
            ? (isFiltered ? 0.85 : 0.08)
            : (isHovered ? 0.9 : 0.35);
          const color = getColor(e.from);
          return (
            <line
              key={i}
              x1={src.x} y1={src.y}
              x2={tgt.x} y2={tgt.y}
              stroke={color}
              strokeWidth={strokeW}
              strokeOpacity={opacity}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={(ev) => {
                setHoveredEdge(e);
                const rect = svgRef.current?.getBoundingClientRect();
                if (rect) {
                  const mx = (src.x + tgt.x) / 2;
                  const my = (src.y + tgt.y) / 2;
                  setTooltip({ x: mx, y: my, label: `${e.from} ↔ ${e.to}: ${e.value} co-mentions` });
                }
              }}
              onMouseLeave={() => { setHoveredEdge(null); setTooltip(null); }}
            />
          );
        })}

        {/* Nodes */}
        {nodes.map(n => {
          const r = 6 + (n.volume / maxVol) * 14;
          const isActive = hoveredNode === n.id || filterCountry === n.id;
          const isDimmed = (filterCountry && filterCountry !== n.id) ||
            (hoveredNode && hoveredNode !== n.id && !visibleEdges.some(e => e.from === n.id || e.to === n.id));
          return (
            <g
              key={n.id}
              className="cursor-pointer"
              onClick={() => handleNodeClick(n.id)}
              onMouseEnter={() => {
                setHoveredNode(n.id);
                setTooltip({ x: n.x, y: n.y - r - 8, label: `${n.id} · ${n.volume} mentions` });
              }}
              onMouseLeave={() => { setHoveredNode(null); setTooltip(null); }}
            >
              {/* Glow ring on hover */}
              {isActive && (
                <circle cx={n.x} cy={n.y} r={r + 5} fill={n.color} opacity={0.18} />
              )}
              <circle
                cx={n.x} cy={n.y} r={r}
                fill={n.color}
                opacity={isDimmed ? 0.25 : isActive ? 1 : 0.82}
                stroke={isActive ? "#fff" : "transparent"}
                strokeWidth={1.5}
              />
              {/* Label */}
              <text
                x={n.x} y={n.y + r + 10}
                textAnchor="middle"
                fontSize={isActive ? 9 : 8}
                fontWeight={isActive ? "bold" : "normal"}
                fontFamily="monospace"
                fill={isActive ? n.color : "#94a3b8"}
                opacity={isDimmed ? 0.3 : 1}
              >
                {n.id.split(" ")[0]}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 4, width - 180)}
              y={tooltip.y - 16}
              width={Math.min(tooltip.label.length * 5.5 + 8, 200)}
              height={18}
              rx={3}
              fill="#0f172a"
              stroke="#334155"
              strokeWidth={0.5}
              opacity={0.95}
            />
            <text
              x={Math.min(tooltip.x, width - 176)}
              y={tooltip.y - 3}
              fontSize={8}
              fontFamily="monospace"
              fill="#e2e8f0"
            >
              {tooltip.label}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
