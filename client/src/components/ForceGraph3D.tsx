/**
 * ForceGraph3D — Advanced 3D network visualization
 *
 * Two modes:
 *  LAYERED — each entity type on a distinct horizontal plane at a unique Y elevation
 *  FREE    — classic force-directed 3D (spring simulation, no planes)
 *
 * Shared: OrbitControls, node isolation (lerped opacity), tooltips, click fly-to,
 *         node coloring by type, directional edge arrows, star-field background.
 *
 * v2 fixes:
 *  - Force simulation runs ASYNC (chunked via setTimeout) — no more main-thread freeze
 *  - Mode switch morphs node positions over 600ms instead of instant rebuild
 *  - Edge label sprites appear at midpoints of highlighted edges during isolation
 */

import { useEffect, useRef, useState, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";

// ─── Public types ─────────────────────────────────────────────────────────────
export interface Graph3DNode {
  id: string;
  label: string;
  type: string;
  summary?: string;
  sentiment?: string;
  country?: string;
  topics?: string[];
  bias?: string;
  _x?: number;
  _y?: number;
  _side?: string;
  _isDual?: boolean;
  _originalId?: string;
}

export interface Graph3DEdge {
  from: string;
  to: string;
  label?: string;
}

interface ForceGraph3DProps {
  nodes: Graph3DNode[];
  edges: Graph3DEdge[];
  onNodeClick?: (node: Graph3DNode) => void;
  selectedNodeId?: string | null;
  primaryNodeId?: string | null;
  activeLinkType?: string | null;
  onSaveStoryboard?: (narrative: string, title: string) => void;
  /** External ref that will be populated with { highlightNodeByLabel } once the scene is ready */
  graphApiRef?: React.MutableRefObject<{ highlightNodeByLabel: (label: string) => void } | null>;
}

// ─── Layer configuration ──────────────────────────────────────────────────────
const LAYER_CONFIG: Record<string, { y: number; color: string; label: string; order: number }> = {
  article:      { y:  300, color: "#22d3ee", label: "ARTICLES",      order: 0 },
  agency:       { y:  150, color: "#f59e0b", label: "AGENCIES",      order: 1 },
  country:      { y:    0, color: "#10b981", label: "COUNTRIES",     order: 2 },
  person:       { y: -150, color: "#f472b6", label: "PERSONS",       order: 3 },
  organization: { y: -300, color: "#fb923c", label: "ORGANIZATIONS", order: 4 },
  author:       { y: -450, color: "#a78bfa", label: "AUTHORS",       order: 5 },
  facility:     { y: -600, color: "#ef4444", label: "FACILITIES",    order: 6 },
  keyword:      { y: -750, color: "#6b7280", label: "KEYWORDS",      order: 7 },
};

const NODE_SIZE: Record<string, number> = {
  article: 7, agency: 9, country: 10, person: 7,
  organization: 8, facility: 9, author: 6, keyword: 5,
};

const EDGE_COLORS: Record<string, string> = {
  published:       "#f59e0b",
  authored:        "#a78bfa",
  covers:          "#10b981",
  mentions:        "#22d3ee",
  "mentioned in":  "#f472b6",
  "referenced in": "#fb923c",
  tagged:          "#6b7280",
};

const DEFAULT_LAYER = { y: 0, color: "#6b7280", label: "OTHER", order: 99 };

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function NodeTooltip({ node, pos }: { node: Graph3DNode; pos: { x: number; y: number } }) {
  const layer = LAYER_CONFIG[node.type] ?? DEFAULT_LAYER;
  const color = layer.color;
  return (
    <div className="absolute pointer-events-none z-30" style={{ left: pos.x + 14, top: pos.y - 40 }}>
      <div style={{
        background: "var(--card)",
        borderTop: `1px solid ${color}50`,
        borderRight: `1px solid ${color}50`,
        borderBottom: `1px solid ${color}50`,
        borderLeft: `2px solid ${color}`,
        borderRadius: "4px",
        padding: "8px 12px",
        minWidth: "200px",
        maxWidth: "280px",
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: "9px",
        color: "var(--muted-foreground)",
        boxShadow: `0 8px 32px oklch(from var(--foreground) l c h / 0.15), 0 0 20px ${color}18`,
      }}>
        <div style={{ marginBottom: "5px" }}>
          <span style={{
            fontSize: "7px", fontWeight: 800, color,
            textTransform: "uppercase", letterSpacing: "0.15em",
            background: color + "15", padding: "1px 6px",
            borderRadius: "2px", border: `1px solid ${color}30`,
          }}>{layer.label}</span>
        </div>
        <div style={{ fontWeight: 700, color: "var(--foreground)", fontSize: "11px", lineHeight: 1.3, marginBottom: "4px", fontFamily: "Inter, sans-serif" }}>
          {String(node.label ?? "").substring(0, 60)}
        </div>
        {node.type === "article" && node.summary && (
          <div style={{ color: "var(--muted-foreground)", fontSize: "9px", lineHeight: 1.5, borderTop: "1px solid rgba(255,255,255,.06)", paddingTop: "5px", fontFamily: "Inter, sans-serif" }}>
            {String(node.summary).substring(0, 100)}…
          </div>
        )}
        {(node.sentiment || node.country) && (
          <div style={{ display: "flex", gap: "8px", marginTop: "4px", flexWrap: "wrap" }}>
            {node.sentiment && (
              <span style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", color: node.sentiment === "negative" ? "#f87171" : node.sentiment === "positive" ? "#4ade80" : "#fbbf24" }}>▸ {node.sentiment}</span>
            )}
            {node.country && <span style={{ fontSize: "8px", color: "var(--muted-foreground)" }}>◎ {node.country}</span>}
          </div>
        )}
        <div style={{ fontSize: "7px", color: "var(--muted-foreground)", marginTop: "5px", letterSpacing: "0.08em" }}>CLICK TO SELECT · DRAG TO ORBIT · SCROLL TO ZOOM</div>
      </div>
    </div>
  );
}


// ─── Main component ───────────────────────────────────────────────────────────
export default function ForceGraph3D({
  nodes,
  edges,
  onNodeClick,
  selectedNodeId,
  primaryNodeId,
  activeLinkType,
  onSaveStoryboard,
  graphApiRef,
}: ForceGraph3DProps) {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<any>(null);
  const sceneRef = useRef<any>(null);
  const cameraRef = useRef<any>(null);
  const controlsRef = useRef<any>(null);
  const rafRef = useRef<number>(0);
  const nodeObjectsRef = useRef<Map<string, any>>(new Map());
  const nodeMeshesRef = useRef<Map<string, any>>(new Map());
  const edgeObjectsRef = useRef<Array<{ line: any; cone: any; dot?: any; from: string; to: string; label?: string }>>([]);
  const edgeLabelSpritesRef = useRef<any[]>([]);
  const isolatedNodeRef = useRef<string | null>(null);
  // Store current 3D positions so morph animation knows where to start from
  const currentPositionsRef = useRef<Map<string, { x: number; y: number; z: number }>>(new Map());
  // d3-force-3d simulation ref for FREE mode
  const d3SimRef = useRef<any>(null);
  // Ref mirror of isolationDepth so the Three.js closure can read the latest value
  const isolationDepthRef = useRef<1 | 2>(1);
  // Ref mirror of selectedNodeIds so the Three.js closure always reads the current set
  // (the closure-local `selectedNodeIdsLocal` goes stale after Clear Selection)
  const selectedNodeIdsRef = useRef<Set<string>>(new Set());

  const [mode, setMode] = useState<'layered' | 'free'>('layered');
  const [hoveredNode, setHoveredNode] = useState<Graph3DNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isComputing, setIsComputing] = useState(false);
  const [computeProgress, setComputeProgress] = useState(0);
  const [hiddenLayers, setHiddenLayers] = useState<Set<string>>(new Set());
  // Multi-node selection: accumulate selected nodes for path/storyboard building
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  // Isolation depth: 1 = direct neighbours only, 2 = neighbours of neighbours
  const [isolationDepth, setIsolationDepth] = useState<1 | 2>(1);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  // Storyboard panel open/collapsed state — defaults open when panel first appears
  const [storyboardOpen, setStoryboardOpen] = useState(true);

  // Keep refs in sync with state so Three.js closures read the latest values
  useEffect(() => { isolationDepthRef.current = isolationDepth; }, [isolationDepth]);
  useEffect(() => { selectedNodeIdsRef.current = selectedNodeIds; }, [selectedNodeIds]);

  // Track whether the user explicitly collapsed the storyboard — prevents auto-expand from re-opening it
  const storyboardUserCollapsedRef = useRef(false);

  // Re-apply isolation immediately when depth toggle changes (if nodes are selected)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    const ids = selectedNodeIdsRef.current;
    if (ids.size === 0) return;
    scene.userData.applyMultiIsolation?.(ids);
  }, [isolationDepth]);

  const presentTypes = useMemo(() => {
    const types = new Set(nodes.map(n => n.type));
    return Object.keys(LAYER_CONFIG).filter(t => types.has(t));
  }, [nodes]);

  const nodeCountByType = useMemo(() => {
    const counts = new Map<string, number>();
    nodes.forEach(n => counts.set(n.type, (counts.get(n.type) ?? 0) + 1));
    return counts;
  }, [nodes]);

  const filteredEdges = useMemo(() => {
    if (!activeLinkType) return edges;
    return edges.filter(e => e.label === activeLinkType);
  }, [edges, activeLinkType]);

  // ── BFS shortest-path between selected nodes ───────────────────────────────
  const storyboardPaths = useMemo(() => {
    if (selectedNodeIds.size < 2) return [];

    // Build adjacency list from ALL edges (undirected for path finding)
    const adj = new Map<string, Array<{ to: string; label: string; directed: string }>>();
    const addEdge = (from: string, to: string, label: string, directed: string) => {
      if (!adj.has(from)) adj.set(from, []);
      adj.get(from)!.push({ to, label, directed });
    };
    edges.forEach(e => {
      addEdge(e.from, e.to, e.label ?? '', '→');
      addEdge(e.to, e.from, e.label ?? '', '←');
    });

    // BFS from source to target, returns path as array of {nodeId, edgeLabel, direction}
    const bfs = (src: string, dst: string): Array<{ nodeId: string; edgeLabel: string; direction: string }> | null => {
      if (src === dst) return [{ nodeId: src, edgeLabel: '', direction: '' }];
      const visited = new Set<string>([src]);
      const queue: Array<{ id: string; path: Array<{ nodeId: string; edgeLabel: string; direction: string }> }> = [
        { id: src, path: [{ nodeId: src, edgeLabel: '', direction: '' }] }
      ];
      while (queue.length > 0) {
        const { id, path } = queue.shift()!;
        const neighbors = adj.get(id) ?? [];
        for (const { to, label, directed } of neighbors) {
          if (visited.has(to)) continue;
          visited.add(to);
          const newPath = [...path, { nodeId: to, edgeLabel: label, direction: directed }];
          if (to === dst) return newPath;
          queue.push({ id: to, path: newPath });
        }
      }
      return null;
    };

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const selArr = Array.from(selectedNodeIds);
    const paths: Array<{
      from: Graph3DNode;
      to: Graph3DNode;
      steps: Array<{ node: Graph3DNode; edgeLabel: string; direction: string }>;
    }> = [];

    // Build paths between consecutive selected nodes (in selection order)
    for (let i = 0; i < selArr.length - 1; i++) {
      const src = selArr[i];
      const dst = selArr[i + 1];
      const srcNode = nodeMap.get(src);
      const dstNode = nodeMap.get(dst);
      if (!srcNode || !dstNode) continue;
      const rawPath = bfs(src, dst);
      if (!rawPath) {
        // No path found — show direct connection attempt
        paths.push({
          from: srcNode,
          to: dstNode,
          steps: [
            { node: srcNode, edgeLabel: '', direction: '' },
            { node: dstNode, edgeLabel: '? (no path)', direction: '→' },
          ],
        });
      } else {
        paths.push({
          from: srcNode,
          to: dstNode,
          steps: rawPath.map(s => ({
            node: nodeMap.get(s.nodeId) ?? { id: s.nodeId, label: s.nodeId, type: 'unknown' } as Graph3DNode,
            edgeLabel: s.edgeLabel,
            direction: s.direction,
          })),
        });
      }
    }
    return paths;
  }, [selectedNodeIds, edges, nodes]);

  // ── Build the scene ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mountRef.current || nodes.length === 0) return;
    let cancelled = false;

    Promise.all([
      import("three"),
      import("three/examples/jsm/controls/OrbitControls.js"),
    ]).then(async ([THREE, { OrbitControls }]) => {
      if (cancelled || !mountRef.current) return;

      const el = mountRef.current;
      const W = el.clientWidth || 900;
      const H = el.clientHeight || 600;

      // ── Renderer ─────────────────────────────────────────────────────────────
      let renderer = rendererRef.current;
      let scene = sceneRef.current;
      let camera = cameraRef.current;
      let controls = controlsRef.current;

      const isFirstBuild = !renderer;

      if (isFirstBuild) {
        renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true });
        renderer.setSize(W, H);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setClearColor(isLight ? 0xf0f4f8 : 0x04080e, 1);
        el.appendChild(renderer.domElement);
        rendererRef.current = renderer;

        scene = new THREE.Scene();
        scene.fog = new THREE.FogExp2(isLight ? 0xf0f4f8 : 0x04080e, 0.00035);
        sceneRef.current = scene;

        camera = new THREE.PerspectiveCamera(55, W / H, 1, 20000);
        camera.position.set(0, mode === 'layered' ? 600 : 0, mode === 'layered' ? 1400 : 1200);
        camera.lookAt(0, 0, 0);
        cameraRef.current = camera;

        controls = new OrbitControls(camera, renderer.domElement);
        controls.enableDamping = true;
        controls.dampingFactor = 0.045;
        controls.rotateSpeed = 0.55;
        controls.zoomSpeed = 0.8;
        controls.panSpeed = 0.7;
        controls.minDistance = 80;
        controls.maxDistance = 8000;
        controls.target.set(0, mode === 'layered' ? -150 : 0, 0);
        controls.update();
        controlsRef.current = controls;

        // Lights
        scene.add(new THREE.AmbientLight(isLight ? 0xffffff : 0x0a1628, isLight ? 3 : 6));
        const sun = new THREE.DirectionalLight(isLight ? 0x6699cc : 0x4488ff, isLight ? 1.5 : 2.5);
        sun.position.set(200, 800, 400);
        scene.add(sun);
        const fill = new THREE.DirectionalLight(isLight ? 0xcc8844 : 0xff6622, 0.8);
        fill.position.set(-300, -200, -300);
        scene.add(fill);

        // Star field
        const starGeo = new THREE.BufferGeometry();
        const starCount = 2000;
        const starPos = new Float32Array(starCount * 3);
        for (let i = 0; i < starCount * 3; i++) starPos[i] = (Math.random() - 0.5) * 16000;
        starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
        const starMat = new THREE.PointsMaterial({ color: isLight ? 0x8899aa : 0xffffff, size: 1.2, sizeAttenuation: true, transparent: true, opacity: isLight ? 0.15 : 0.35 });
        scene.add(new THREE.Points(starGeo, starMat));
      } else {
        // Mode switch: clear only nodes, edges, layer planes — keep renderer/camera/controls/stars/lights
        cancelAnimationFrame(rafRef.current);
        const toRemove: any[] = [];
        scene.traverse((obj: any) => {
          if (
            obj.userData?.layerType ||
            obj.userData?.isEdgeGroup ||
            obj.userData?.isNodeGroup ||
            obj.userData?.isSelectionRing ||
            obj.userData?.isEdgeLabelGroup
          ) {
            toRemove.push(obj);
          }
        });
        toRemove.forEach(obj => {
          obj.parent?.remove(obj);
          obj.geometry?.dispose();
          if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose());
          else obj.material?.dispose();
        });
        nodeObjectsRef.current.clear();
        nodeMeshesRef.current.clear();
        edgeObjectsRef.current = [];
        edgeLabelSpritesRef.current = [];
        isolatedNodeRef.current = null;
      }

      // ── Compute initial node positions ────────────────────────────────────────
      const byType = new Map<string, Graph3DNode[]>();
      nodes.forEach(n => {
        if (!byType.has(n.type)) byType.set(n.type, []);
        byType.get(n.type)!.push(n);
      });

      const nodePositions = new Map<string, { x: number; y: number; z: number }>();

      if (mode === 'layered') {
        byType.forEach((typeNodes, type) => {
          const layer = LAYER_CONFIG[type] ?? DEFAULT_LAYER;
          const count = typeNodes.length;
          const radius = Math.max(80, Math.min(500, count * 28));
          typeNodes.forEach((node, i) => {
            const angle = (i / count) * Math.PI * 2;
            const r = radius + (Math.random() - 0.5) * 30;
            nodePositions.set(node.id, { x: Math.cos(angle) * r, y: layer.y, z: Math.sin(angle) * r });
          });
        });
      } else {
        // Random sphere distribution — async simulation will settle them
        nodes.forEach(node => {
          const theta = Math.random() * Math.PI * 2;
          const phi = Math.acos(2 * Math.random() - 1);
          const r = 200 + Math.random() * 400;
          nodePositions.set(node.id, {
            x: r * Math.sin(phi) * Math.cos(theta),
            y: r * Math.sin(phi) * Math.sin(theta),
            z: r * Math.cos(phi),
          });
        });
      }

      // ── Layer planes (layered mode only) ──────────────────────────────────────
      const layerGroups = new Map<string, any>();

      if (mode === 'layered') {
        presentTypes.forEach(type => {
          const layer = LAYER_CONFIG[type] ?? DEFAULT_LAYER;
          const typeNodes = byType.get(type) ?? [];
          if (typeNodes.length === 0) return;

          const group = new THREE.Group();
          group.userData.layerType = type;
          group.userData.isNodeGroup = false; // layer group, not node group
          scene.add(group);
          layerGroups.set(type, group);

          const gridSize = Math.max(300, Math.min(1200, typeNodes.length * 60));

          const gridHelper = new THREE.GridHelper(gridSize, 10,
            new THREE.Color(layer.color).multiplyScalar(0.18),
            new THREE.Color(layer.color).multiplyScalar(0.08)
          );
          gridHelper.position.y = layer.y - 2;
          gridHelper.userData.isGrid = true;
          (gridHelper.material as any).transparent = true;
          (gridHelper.material as any).opacity = 0.55;
          group.add(gridHelper);

          const planeGeo = new THREE.PlaneGeometry(gridSize, gridSize);
          const planeMat = new THREE.MeshBasicMaterial({
            color: new THREE.Color(layer.color),
            transparent: true,
            opacity: 0.022,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const plane = new THREE.Mesh(planeGeo, planeMat);
          plane.rotation.x = -Math.PI / 2;
          plane.position.y = layer.y - 1;
          group.add(plane);

          // Layer label sprite
          const canvas = document.createElement("canvas");
          canvas.width = 512; canvas.height = 64;
          const ctx = canvas.getContext("2d")!;
          ctx.clearRect(0, 0, 512, 64);
          ctx.font = "bold 24px 'JetBrains Mono', monospace";
          ctx.fillStyle = layer.color + "88";
          ctx.textAlign = "left";
          ctx.fillText(`◈ ${layer.label}`, 8, 44);
          const tex = new THREE.CanvasTexture(canvas);
          const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.38, depthTest: false });
          const sprite = new THREE.Sprite(spriteMat);
          sprite.scale.set(200, 25, 1);
          sprite.position.set(-gridSize / 2 + 20, layer.y + 18, 0);
          group.add(sprite);
        });
      } else {
        // Free mode: one global group
        const globalGroup = new THREE.Group();
        globalGroup.userData.layerType = '__free__';
        globalGroup.userData.isNodeGroup = true;
        scene.add(globalGroup);
        nodes.forEach(n => layerGroups.set(n.type, globalGroup));
      }

      // ── Node meshes ───────────────────────────────────────────────────────────
      const allNodeMeshes: any[] = [];

      const buildNodeMesh = (node: Graph3DNode, pos: { x: number; y: number; z: number }) => {
        const layer = LAYER_CONFIG[node.type] ?? DEFAULT_LAYER;
        const color = new THREE.Color(layer.color);
        const isPrimary = node.id === primaryNodeId;
        const isSelected = node.id === selectedNodeId;
        const group = layerGroups.get(node.type);
        if (!group) return;

        const nodeSize = isPrimary ? 14 : isSelected ? 10 : (NODE_SIZE[node.type] ?? 7);
        const geo = new THREE.SphereGeometry(nodeSize, 20, 20);
        const mat = new THREE.MeshPhongMaterial({
          color: isPrimary ? new THREE.Color(1, 1, 1) : color,
          emissive: isPrimary ? new THREE.Color(0.3, 0.3, 0.3) : color.clone().multiplyScalar(0.35),
          shininess: 120,
          transparent: true,
          opacity: isPrimary ? 1.0 : 0.92,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.userData.nodeData = node;
        group.add(mesh);
        allNodeMeshes.push(mesh);
        nodeMeshesRef.current.set(node.id, mesh);

        // Glow halo
        const haloCanvas = document.createElement("canvas");
        haloCanvas.width = 64; haloCanvas.height = 64;
        const hCtx = haloCanvas.getContext("2d")!;
        const gradient = hCtx.createRadialGradient(32, 32, 0, 32, 32, 32);
        gradient.addColorStop(0, layer.color + "cc");
        gradient.addColorStop(0.4, layer.color + "44");
        gradient.addColorStop(1, "transparent");
        hCtx.fillStyle = gradient;
        hCtx.fillRect(0, 0, 64, 64);
        const haloTex = new THREE.CanvasTexture(haloCanvas);
        const haloMat = new THREE.SpriteMaterial({ map: haloTex, transparent: true, opacity: isPrimary ? 0.9 : 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
        const halo = new THREE.Sprite(haloMat);
        halo.scale.set(nodeSize * 5, nodeSize * 5, 1);
        halo.position.set(pos.x, pos.y, pos.z);
        group.add(halo);

        // Primary torus ring
        if (isPrimary) {
          const ringGeo = new THREE.TorusGeometry(nodeSize * 2.2, 1.2, 8, 48);
          const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
          const ring = new THREE.Mesh(ringGeo, ringMat);
          ring.position.set(pos.x, pos.y, pos.z);
          group.add(ring);
        }

        // Floating label sprite
        const labelCanvas = document.createElement("canvas");
        labelCanvas.width = 512; labelCanvas.height = 48;
        const lCtx = labelCanvas.getContext("2d")!;
        lCtx.clearRect(0, 0, 512, 48);
        lCtx.fillStyle = "rgba(4,8,18,0.82)";
        lCtx.beginPath();
        lCtx.roundRect(0, 4, 512, 40, 6);
        lCtx.fill();
        lCtx.fillStyle = layer.color;
        lCtx.fillRect(0, 4, 4, 40);
        const labelText = String(node.label ?? "").substring(0, 28);
        lCtx.font = `${isPrimary ? "bold 22px" : "600 18px"} Inter, sans-serif`;
        lCtx.fillStyle = isPrimary ? "#ffffff" : "#cbd5e1";
        lCtx.textAlign = "left";
        lCtx.fillText(labelText, 12, 30);
        const labelTex = new THREE.CanvasTexture(labelCanvas);
        const labelMat = new THREE.SpriteMaterial({ map: labelTex, transparent: true, opacity: 0.92, depthTest: false });
        const labelSprite = new THREE.Sprite(labelMat);
        labelSprite.scale.set(80, 7.5, 1);
        labelSprite.position.set(pos.x + nodeSize + 2, pos.y + nodeSize + 4, pos.z);
        group.add(labelSprite);

        // Store baseColor so applyMultiIsolation can restore it after amber 2° highlight
        (mesh.material as any)._baseColor = color.clone();
        (mesh.material as any)._targetColor = color.clone();
        nodeObjectsRef.current.set(node.id, { mesh, halo, labelSprite, baseColor: color.clone() });
      };

      nodes.forEach(node => {
        const pos = nodePositions.get(node.id);
        if (!pos) return;
        buildNodeMesh(node, pos);
      });

      // ── Edge lines ────────────────────────────────────────────────────────────
      const edgeGroup = new THREE.Group();
      edgeGroup.userData.isEdgeGroup = true;
      scene.add(edgeGroup);

      const buildEdge = (edge: Graph3DEdge, fromPos: { x: number; y: number; z: number }, toPos: { x: number; y: number; z: number }) => {
        const edgeColor = new THREE.Color(EDGE_COLORS[edge.label ?? ""] ?? "#334155");
        const isActiveType = activeLinkType && edge.label === activeLinkType;

        const fp = new THREE.Vector3(fromPos.x, fromPos.y, fromPos.z);
        const tp = new THREE.Vector3(toPos.x, toPos.y, toPos.z);

        const lineGeo = new THREE.BufferGeometry().setFromPoints([fp, tp]);
        const lineMat = new THREE.LineBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: isActiveType ? 0.85 : 0.22,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        });
        const line = new THREE.Line(lineGeo, lineMat);
        edgeGroup.add(line);

        const dir = tp.clone().sub(fp);
        const arrowPos = fp.clone().add(dir.clone().multiplyScalar(0.82));
        const coneHeight = isActiveType ? 12 : 8;
        const coneRadius = isActiveType ? 4 : 2.5;
        const coneGeo = new THREE.ConeGeometry(coneRadius, coneHeight, 8);
        const coneMat = new THREE.MeshBasicMaterial({
          color: edgeColor,
          transparent: true,
          opacity: isActiveType ? 0.9 : 0.35,
        });
        const cone = new THREE.Mesh(coneGeo, coneMat);
        cone.position.copy(arrowPos);
        const normDir = dir.clone().normalize();
        const up = new THREE.Vector3(0, 1, 0);
        cone.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, normDir));
        edgeGroup.add(cone);

        let dot: any = null;
        if (isActiveType) {
          const midPos = fp.clone().lerp(tp, 0.5);
          const dotGeo = new THREE.SphereGeometry(3, 8, 8);
          const dotMat = new THREE.MeshBasicMaterial({ color: edgeColor, transparent: true, opacity: 0.7 });
          dot = new THREE.Mesh(dotGeo, dotMat);
          dot.position.copy(midPos);
          edgeGroup.add(dot);
        }

        edgeObjectsRef.current.push({ line, cone, dot, from: edge.from, to: edge.to, label: edge.label });
      };

      filteredEdges.forEach(edge => {
        const fromPos = nodePositions.get(edge.from);
        const toPos = nodePositions.get(edge.to);
        if (!fromPos || !toPos) return;
        buildEdge(edge, fromPos, toPos);
      });

      // ── Edge label group (populated during isolation) ─────────────────────────
      const edgeLabelGroup = new THREE.Group();
      edgeLabelGroup.userData.isEdgeLabelGroup = true;
      scene.add(edgeLabelGroup);

      const buildEdgeLabelSprite = (edgeLabel: string, midPos: any, color: any) => {
        const c = document.createElement("canvas");
        c.width = 256; c.height = 40;
        const ctx = c.getContext("2d")!;
        ctx.clearRect(0, 0, 256, 40);
        ctx.fillStyle = "rgba(4,8,18,0.88)";
        ctx.beginPath();
        ctx.roundRect(0, 4, 256, 32, 4);
        ctx.fill();
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.fillRect(0, 4, 3, 32);
        ctx.font = "bold 14px 'JetBrains Mono', monospace";
        ctx.fillStyle = `#${color.getHexString()}`;
        ctx.textAlign = "center";
        ctx.fillText(edgeLabel.toUpperCase(), 128, 25);
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(50, 8, 1);
        sprite.position.copy(midPos);
        edgeLabelGroup.add(sprite);
        edgeLabelSpritesRef.current.push(sprite);
        return sprite;
      };

      // ── Raycasting ────────────────────────────────────────────────────────────
      const raycaster = new THREE.Raycaster();
      raycaster.params.Points = { threshold: 5 };
      const mouse = new THREE.Vector2();
      let lastHoverId: string | null = null;

      const onMouseMove = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(allNodeMeshes, false);
        if (intersects.length > 0) {
          const nd = intersects[0].object.userData.nodeData as Graph3DNode;
          if (nd && nd.id !== lastHoverId) {
            lastHoverId = nd.id;
            setHoveredNode(nd);
            setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
            renderer.domElement.style.cursor = "pointer";
          }
        } else {
          if (lastHoverId !== null) {
            lastHoverId = null;
            setHoveredNode(null);
            setTooltipPos(null);
            renderer.domElement.style.cursor = "default";
          }
        }
      };

      // ── Isolation system ──────────────────────────────────────────────────────
      const setTargetOpacity = (mat: any, target: number) => {
        if (!mat) return;
        mat._targetOpacity = target;
        mat.transparent = true;
        mat.needsUpdate = true;
      };

      let connectedNodeIds = new Set<string>();
      let isolatedCenterId: string | null = null;
      let selectionRing: any = null;

      const removeSelectionRing = () => {
        if (selectionRing) {
          selectionRing.parent?.remove(selectionRing);
          selectionRing.geometry?.dispose();
          selectionRing.material?.dispose();
          selectionRing = null;
        }
      };

      const clearEdgeLabelSprites = () => {
        edgeLabelSpritesRef.current.forEach(s => {
          s.parent?.remove(s);
          s.material?.map?.dispose();
          s.material?.dispose();
        });
        edgeLabelSpritesRef.current = [];
      };

      const addSelectionRing = (nodeId: string) => {
        removeSelectionRing();
        const objs = nodeObjectsRef.current.get(nodeId);
        const pos = nodePositions.get(nodeId);
        if (!objs || !pos) return;
        const nd = objs.mesh?.userData?.nodeData as Graph3DNode;
        const layer = LAYER_CONFIG[nd?.type ?? ''] ?? DEFAULT_LAYER;
        const nodeSize = objs.mesh?.geometry?.parameters?.radius ?? 8;
        const ringGeo = new THREE.RingGeometry(nodeSize * 2.2, nodeSize * 2.8, 48);
        const ringMat = new THREE.MeshBasicMaterial({
          color: new THREE.Color(layer.color),
          transparent: true, opacity: 0.9,
          side: THREE.DoubleSide, depthWrite: false,
          blending: THREE.AdditiveBlending,
        });
        selectionRing = new THREE.Mesh(ringGeo, ringMat);
        selectionRing.position.set(pos.x, pos.y, pos.z);
        selectionRing.userData.isSelectionRing = true;
        scene.add(selectionRing);
      };

      const applyIsolation = (nodeId: string | null) => {
        isolatedNodeRef.current = nodeId;
        isolatedCenterId = nodeId;
        clearEdgeLabelSprites();

        if (!nodeId) {
          connectedNodeIds = new Set();
          removeSelectionRing();
          nodeObjectsRef.current.forEach(({ mesh, halo, labelSprite }) => {
            setTargetOpacity(mesh?.material, 0.92);
            setTargetOpacity(halo?.material, 0.5);
            setTargetOpacity(labelSprite?.material, 0.92);
          });
          edgeObjectsRef.current.forEach(({ line, cone, dot }) => {
            setTargetOpacity(line?.material, 0.22);
            setTargetOpacity(cone?.material, 0.35);
            if (dot) setTargetOpacity(dot.material, 0.7);
          });
          return;
        }

        connectedNodeIds = new Set<string>([nodeId]);
        edgeObjectsRef.current.forEach(({ from, to }) => {
          if (from === nodeId) connectedNodeIds.add(to);
          if (to === nodeId) connectedNodeIds.add(from);
        });

        addSelectionRing(nodeId);

        nodeObjectsRef.current.forEach((objs, id) => {
          const isCenter = id === nodeId;
          const isConn = connectedNodeIds.has(id);
          setTargetOpacity(objs.mesh?.material, isCenter ? 1.0 : isConn ? 0.9 : 0.05);
          setTargetOpacity(objs.halo?.material, isCenter ? 1.0 : isConn ? 0.65 : 0.03);
          setTargetOpacity(objs.labelSprite?.material, isCenter ? 1.0 : isConn ? 0.9 : 0.03);
        });

        edgeObjectsRef.current.forEach(({ line, cone, dot, from, to, label }) => {
          const isConn = (from === nodeId || to === nodeId);
          setTargetOpacity(line?.material, isConn ? 0.95 : 0.025);
          setTargetOpacity(cone?.material, isConn ? 0.98 : 0.025);
          if (dot) setTargetOpacity(dot.material, isConn ? 0.85 : 0.025);

          // Build edge label sprite for connected edges
          if (isConn && label) {
            const fp = nodePositions.get(from);
            const tp = nodePositions.get(to);
            if (fp && tp) {
              const mid = new THREE.Vector3(
                (fp.x + tp.x) / 2,
                (fp.y + tp.y) / 2,
                (fp.z + tp.z) / 2
              );
              const edgeColor = new THREE.Color(EDGE_COLORS[label] ?? "#22d3ee");
              const sprite = buildEdgeLabelSprite(label, mid, edgeColor);
              setTargetOpacity(sprite.material, 0.92);
            }
          }
        });
      };

      // Multi-select: accumulate selected nodes, background click does NOT clear
      // selectedNodeIdsLocal mirrors the React state but is mutable inside the closure
      let selectedNodeIdsLocal = new Set<string>();

      const applyMultiIsolation = (ids: Set<string>) => {
        // Clear old edge labels
        clearEdgeLabelSprites();
        removeSelectionRing();

        if (ids.size === 0) {
          connectedNodeIds = new Set();
          isolatedNodeRef.current = null;
          nodeObjectsRef.current.forEach(({ mesh, halo, labelSprite }) => {
            setTargetOpacity(mesh?.material, 0.92);
            setTargetOpacity(halo?.material, 0.5);
            setTargetOpacity(labelSprite?.material, 0.92);
          });
          edgeObjectsRef.current.forEach(({ line, cone, dot }) => {
            setTargetOpacity(line?.material, 0.22);
            setTargetOpacity(cone?.material, 0.35);
            if (dot) setTargetOpacity(dot.material, 0.7);
          });
          return;
        }

        // Build 1° neighbours of selected nodes
        const firstDegree = new Set<string>();
        edgeObjectsRef.current.forEach(({ from, to }) => {
          if (ids.has(from)) firstDegree.add(to);
          if (ids.has(to)) firstDegree.add(from);
        });
        // Remove selected nodes themselves from firstDegree (they are 0°)
        ids.forEach(id => firstDegree.delete(id));

        // 2° expansion: neighbours of 1° neighbours (excluding already-known nodes)
        const secondDegree = new Set<string>();
        if (isolationDepthRef.current === 2) {
          edgeObjectsRef.current.forEach(({ from, to }) => {
            if (firstDegree.has(from) && !ids.has(to) && !firstDegree.has(to)) secondDegree.add(to);
            if (firstDegree.has(to) && !ids.has(from) && !firstDegree.has(from)) secondDegree.add(from);
          });
        }

        const connected = new Set<string>([...Array.from(ids), ...Array.from(firstDegree), ...Array.from(secondDegree)]);
        connectedNodeIds = connected;

        // Add selection ring on the most recently selected node
        const lastSelected = Array.from(ids).at(-1);
        if (lastSelected) {
          isolatedNodeRef.current = lastSelected;
          addSelectionRing(lastSelected);
        }

        const AMBER = new THREE.Color(0xfbbf24); // amber-400
        nodeObjectsRef.current.forEach((objs, id) => {
          const isSelected = ids.has(id);
          const is1st = firstDegree.has(id);
          const is2nd = secondDegree.has(id);
          const isConn = connected.has(id);
          setTargetOpacity(objs.mesh?.material, isSelected ? 1.0 : isConn ? 0.88 : 0.05);
          setTargetOpacity(objs.halo?.material, isSelected ? 1.0 : isConn ? 0.6 : 0.03);
          setTargetOpacity(objs.labelSprite?.material, isSelected ? 1.0 : isConn ? 0.88 : 0.03);
          // Amber glow for 2° nodes; restore base color for 1° and selected
          if (objs.mesh?.material) {
            const mat = objs.mesh.material as any;
            if (is2nd && !isSelected && !is1st) {
              mat._targetColor = AMBER.clone();
            } else {
              mat._targetColor = (mat._baseColor ?? new THREE.Color(0x22d3ee)).clone();
            }
          }
        });

        edgeObjectsRef.current.forEach(({ line, cone, dot, from, to, label }) => {
          // Highlight edges between selected nodes or from selected to connected
          const isPath = ids.has(from) && ids.has(to);
          const isConn = ids.has(from) || ids.has(to);
          setTargetOpacity(line?.material, isPath ? 1.0 : isConn ? 0.88 : 0.025);
          setTargetOpacity(cone?.material, isPath ? 1.0 : isConn ? 0.92 : 0.025);
          if (dot) setTargetOpacity(dot.material, isConn ? 0.85 : 0.025);

          if (isConn && label) {
            const fp = nodePositions.get(from);
            const tp = nodePositions.get(to);
            if (fp && tp) {
              const mid = new THREE.Vector3(
                (fp.x + tp.x) / 2,
                (fp.y + tp.y) / 2,
                (fp.z + tp.z) / 2
              );
              const edgeColor = new THREE.Color(EDGE_COLORS[label] ?? "#22d3ee");
              const sprite = buildEdgeLabelSprite(label, mid, edgeColor);
              setTargetOpacity(sprite.material, 0.92);
            }
          }
        });
       };
      // Expose applyMultiIsolation via scene.userData so JSX buttons can call it
      // (they can't access the closure-scoped function directly)
      scene.userData.applyMultiIsolation = applyMultiIsolation;
      // Expose a reset function so JSX buttons can fully clear the closure-local variable
      scene.userData.resetSelection = () => {
        selectedNodeIdsLocal = new Set();
        applyMultiIsolation(new Set());
      };
      // Expose highlightNodeByLabel: finds a node by label (case-insensitive), flies to it,
      // and adds it to the selection without triggering a new search/query.
      scene.userData.highlightNodeByLabel = (label: string) => {
        const q = label.trim().toLowerCase();
        let targetId: string | null = null;
        nodeObjectsRef.current.forEach((_, id) => {
          if (targetId) return;
          const nd = nodeObjectsRef.current.get(id)?.mesh?.userData?.nodeData as Graph3DNode | undefined;
          if (nd && String(nd.label ?? '').toLowerCase() === q) targetId = id;
        });
        if (!targetId) {
          // Partial match fallback
          nodeObjectsRef.current.forEach((_, id) => {
            if (targetId) return;
            const nd = nodeObjectsRef.current.get(id)?.mesh?.userData?.nodeData as Graph3DNode | undefined;
            if (nd && String(nd.label ?? '').toLowerCase().includes(q)) targetId = id;
          });
        }
        if (!targetId) return;
        // Add to selection and apply isolation
        selectedNodeIdsLocal = new Set(selectedNodeIdsRef.current);
        selectedNodeIdsLocal.add(targetId);
        setSelectedNodeIds(new Set(selectedNodeIdsLocal));
        applyMultiIsolation(selectedNodeIdsLocal);
        // Flash: briefly scale up the node mesh for visual feedback
        const objs = nodeObjectsRef.current.get(targetId);
        if (objs?.mesh) {
          objs.mesh.scale.setScalar(2.5);
          setTimeout(() => { if (objs.mesh) objs.mesh.scale.setScalar(1); }, 400);
        }
        // Fly camera to the highlighted node
        const pos = nodePositions.get(targetId);
        if (pos && cameraRef.current && controlsRef.current) {
          flyToPosition(new THREE.Vector3(pos.x, pos.y, pos.z), cameraRef.current, controlsRef.current);
        }
      };
      // Populate the external graphApiRef so ExploreTab can call highlightNodeByLabel
      if (graphApiRef) {
        graphApiRef.current = { highlightNodeByLabel: scene.userData.highlightNodeByLabel };
      }
      const onClick = (e: MouseEvent) => {
        const rect = el.getBoundingClientRect();
        mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(mouse, camera);
        const intersects = raycaster.intersectObjects(allNodeMeshes, false);
        if (intersects.length > 0) {
          const nd = intersects[0].object.userData.nodeData as Graph3DNode;
          if (nd) {
            onNodeClick?.(nd);
            // Always read from the ref so we get the latest React state
            // (handles the case where Clear Selection reset the state but the
            // closure-local var was stale)
            selectedNodeIdsLocal = new Set(selectedNodeIdsRef.current);
            // Toggle node in/out of selection set
            if (selectedNodeIdsLocal.has(nd.id)) {
              selectedNodeIdsLocal.delete(nd.id);
            } else {
              selectedNodeIdsLocal.add(nd.id);
            }
            setSelectedNodeIds(new Set(selectedNodeIdsLocal));
            applyMultiIsolation(selectedNodeIdsLocal);
            // Auto-open storyboard panel when selection reaches 2+ nodes,
            // but only if the user hasn't manually collapsed it
            if (selectedNodeIdsLocal.size >= 2 && !storyboardUserCollapsedRef.current) {
              setStoryboardOpen(true);
            }
            // Fly to the clicked node
            const pos = nodePositions.get(nd.id);
            if (pos && cameraRef.current && controlsRef.current) {
              flyToPosition(new THREE.Vector3(pos.x, pos.y, pos.z), camera, controls);
            }
          }
        }
        // Background click does NOT clear selection — use Clear Selection or Reset View button
      };

      renderer.domElement.addEventListener("mousemove", onMouseMove);
      renderer.domElement.addEventListener("click", onClick);

      // ── Resize handler ────────────────────────────────────────────────────────
      const ro = new ResizeObserver(() => {
        if (!mountRef.current || !rendererRef.current) return;
        const w = mountRef.current.clientWidth;
        const h = mountRef.current.clientHeight;
        renderer.setSize(w, h);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      });
      ro.observe(el);

      // ── Render loop ───────────────────────────────────────────────────────────
      let frame = 0;
      const LERP_SPEED = 0.09;
      const animate = () => {
        if (cancelled) return;
        rafRef.current = requestAnimationFrame(animate);
        controls.update();
        frame++;

        // Lerp material opacities and colors
        scene.traverse((obj: any) => {
          if (obj.isMesh || obj.isSprite || obj.isLine) {
            const mat = obj.material;
            if (mat && mat._targetOpacity !== undefined) {
              const diff = mat._targetOpacity - mat.opacity;
              if (Math.abs(diff) > 0.001) { mat.opacity += diff * LERP_SPEED; mat.needsUpdate = true; }
            }
            // Lerp node sphere color toward _targetColor (for amber 2° highlight)
            if (mat && mat._targetColor && mat.color) {
              if (mat.color.r !== mat._targetColor.r || mat.color.g !== mat._targetColor.g || mat.color.b !== mat._targetColor.b) {
                mat.color.lerp(mat._targetColor, LERP_SPEED);
                mat.needsUpdate = true;
              }
            }
          }
        });

        // Torus ring rotation (primary node)
        scene.traverse((obj: any) => {
          if (obj.isMesh && obj.geometry?.type === "TorusGeometry" && !obj.userData.isSelectionRing) {
            obj.rotation.y += 0.008;
            obj.rotation.x = Math.sin(frame * 0.01) * 0.3;
          }
        });

        // Selection ring pulse
        if (selectionRing?.material) {
          selectionRing.material.opacity = 0.55 + Math.sin(frame * 0.08) * 0.35;
          selectionRing.rotation.z += 0.012;
          selectionRing.material.needsUpdate = true;
        }

        // Connected node pulse scale
        if (isolatedCenterId) {
          const pulseScale = 1 + Math.sin(frame * 0.07) * 0.06;
          connectedNodeIds.forEach(id => {
            if (id === isolatedCenterId) return;
            const objs = nodeObjectsRef.current.get(id);
            if (objs?.mesh) objs.mesh.scale.setScalar(pulseScale);
          });
        } else {
          nodeObjectsRef.current.forEach(({ mesh }) => {
            if (mesh && mesh.scale.x !== 1) mesh.scale.setScalar(1 + (1 - mesh.scale.x) * 0.15);
          });
        }

        // FREE mode: tick d3 force simulation each frame
        scene.userData.d3Tick?.();

        renderer.render(scene, camera);
      };
      animate();
      setIsReady(true);

      // ── Free mode: d3-force-3d live simulation (ticks in render loop) ───────────
      if (mode === 'free') {
        import('d3-force-3d').then((d3f3d: any) => {
          if (cancelled) return;

          // Build mutable d3 node/link objects — d3 writes x/y/z directly onto them
          const d3Nodes = nodes.map(n => {
            const p = nodePositions.get(n.id) ?? { x: 0, y: 0, z: 0 };
            return { id: n.id, x: p.x, y: p.y, z: p.z };
          });
          const idSet = new Set(nodes.map(n => n.id));
          const d3Links = filteredEdges
            .filter((e: any) => idSet.has(e.from) && idSet.has(e.to))
            .map((e: any) => ({ source: e.from, target: e.to }));

          const sim = d3f3d.forceSimulation(d3Nodes, 3)
            .force('charge', d3f3d.forceManyBody().strength(-400).distanceMax(800))
            .force('link', d3f3d.forceLink(d3Links).id((d: any) => d.id).distance(180).strength(0.6))
            .force('center', d3f3d.forceCenter(0, 0, 0))
            .alphaDecay(0.015)
            .velocityDecay(0.3)
            .stop();

          d3SimRef.current = sim;

          // Build a lookup from node id → d3 node object for fast access in render loop
          const d3NodeById = new Map<string, any>(d3Nodes.map((n: any) => [n.id, n]));

          // Store tick function on scene userData so the animate() closure can call it
          scene.userData.d3Tick = () => {
            if (sim.alpha() > sim.alphaMin()) {
              sim.tick();
              d3NodeById.forEach((dn: any, id: string) => {
                const nx = dn.x ?? 0;
                const ny = dn.y ?? 0;
                const nz = dn.z ?? 0;
                nodePositions.set(id, { x: nx, y: ny, z: nz });
                const objs = nodeObjectsRef.current.get(id);
                if (objs?.mesh) {
                  const ns = objs.mesh.geometry?.parameters?.radius ?? 7;
                  objs.mesh.position.set(nx, ny, nz);
                  objs.halo?.position.set(nx, ny, nz);
                  objs.labelSprite?.position.set(nx + ns + 2, ny + ns + 4, nz);
                }
              });
              edgeObjectsRef.current.forEach(({ line, cone, dot, from, to }) => {
                const fp = nodePositions.get(from);
                const tp = nodePositions.get(to);
                if (!fp || !tp) return;
                const fv = new THREE.Vector3(fp.x, fp.y, fp.z);
                const tv = new THREE.Vector3(tp.x, tp.y, tp.z);
                line.geometry.setFromPoints([fv, tv]);
                line.geometry.computeBoundingSphere();
                const dir2 = tv.clone().sub(fv);
                const ap = fv.clone().add(dir2.clone().multiplyScalar(0.82));
                cone.position.copy(ap);
                const nd2 = dir2.clone().normalize();
                const up2 = new THREE.Vector3(0, 1, 0);
                if (nd2.length() > 0.001) {
                  cone.setRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up2, nd2));
                }
                if (dot) dot.position.copy(fv.clone().lerp(tv, 0.5));
              });
            }
          };
        });
      } else {
        // Layered: store positions immediately, clear any old d3 sim
        scene.userData.d3Tick = null;
        d3SimRef.current?.stop();
        d3SimRef.current = null;
        nodePositions.forEach((p, id) => currentPositionsRef.current.set(id, p));
      }

      return () => {
        cancelled = true;
        ro.disconnect();
        renderer.domElement.removeEventListener("mousemove", onMouseMove);
        renderer.domElement.removeEventListener("click", onClick);
        cancelAnimationFrame(rafRef.current);
        // Only fully dispose on unmount, not on mode switch
        // (renderer/camera/controls are reused across mode switches)
      };
    });

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length, edges.length, activeLinkType, primaryNodeId, mode, isLight]);

  // On full unmount: dispose renderer
  useEffect(() => {
    return () => {
      cancelAnimationFrame(rafRef.current);
      const renderer = rendererRef.current;
      const el = mountRef.current;
      if (renderer) {
        renderer.dispose();
        if (el && el.contains(renderer.domElement)) el.removeChild(renderer.domElement);
        rendererRef.current = null;
      }
      nodeObjectsRef.current.clear();
      nodeMeshesRef.current.clear();
      edgeObjectsRef.current = [];
      edgeLabelSpritesRef.current = [];
    };
  }, []);

  // ── Layer visibility toggle (layered mode only) ───────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    scene.traverse((obj: any) => {
      if (obj.userData?.layerType && obj.userData.layerType !== '__free__') {
        obj.visible = !hiddenLayers.has(obj.userData.layerType);
      }
    });
  }, [hiddenLayers]);

  return (
    <div className="relative w-full h-full" style={{ background: "var(--background)" }}>
      {/* Three.js canvas mount — used for BOTH layered and free modes */}
      <div ref={mountRef} className="w-full h-full" />

      {/* Loading overlay (initial build) */}
      {!isReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-background">
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-14 h-14">
              <div className="absolute inset-0 border border-cyan-400/20 border-t-cyan-400/70 rounded-full animate-spin" />
              <div className="absolute inset-2 border border-pink-400/15 border-b-pink-400/50 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
              <div className="absolute inset-4 border border-emerald-400/10 border-t-emerald-400/40 rounded-full animate-spin" style={{ animationDuration: "2s" }} />
            </div>
            <div className="text-[9px] font-mono text-muted-foreground/60 tracking-[0.3em] animate-pulse">RENDERING 3D INTELLIGENCE SPACE...</div>
          </div>
        </div>
      )}

      {/* Computing overlay (async free-mode simulation) */}
      {isComputing && isReady && (
        <div className="absolute inset-0 flex items-center justify-center z-40 pointer-events-none">
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl border border-cyan-400/20 bg-background/90 backdrop-blur-sm shadow-2xl">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[10px] font-mono text-cyan-400/80 tracking-[0.2em] font-bold">COMPUTING FREE LAYOUT</span>
            </div>
            {/* Progress bar */}
            <div className="w-48 h-1 bg-foreground/5 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-100"
                style={{ width: `${computeProgress}%`, background: "linear-gradient(90deg, #22d3ee, #a78bfa)" }}
              />
            </div>
            <span className="text-[8px] font-mono text-muted-foreground/40">{computeProgress}% · SPRING SIMULATION</span>
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {hoveredNode && tooltipPos && <NodeTooltip node={hoveredNode} pos={tooltipPos} />}

      {/* ── Top-center HUD with mode toggle ── */}
      {isReady && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2">
          {/* Stats pill */}
          <div className="flex items-center gap-3 px-4 py-1.5 rounded-full border border-foreground/8 bg-background/80 backdrop-blur-sm pointer-events-none">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60" />
              <span className="text-[9px] font-mono text-muted-foreground/80"><span className="text-foreground/70 font-bold">{nodes.length}</span> nodes</span>
            </div>
            <div className="w-px h-3 bg-foreground/10" />
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400/60" />
              <span className="text-[9px] font-mono text-muted-foreground/80"><span className="text-foreground/70 font-bold">{filteredEdges.length}</span> links</span>
            </div>
            {mode === 'layered' && (
              <>
                <div className="w-px h-3 bg-foreground/10" />
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-pink-400/60" />
                  <span className="text-[9px] font-mono text-muted-foreground/80"><span className="text-foreground/70 font-bold">{presentTypes.length}</span> layers</span>
                </div>
              </>
            )}
          </div>

          {/* Mode toggle */}
          <div className="flex items-center gap-0.5 p-0.5 rounded-md bg-background/90 border border-foreground/10 shadow-xl">
            {(['layered', 'free'] as const).map(m => (
              <button
                key={m}
                onClick={() => {
                  setMode(m);
                  setSelectedNodeIds(new Set());
                  isolatedNodeRef.current = null;
                  setIsComputing(false);
                  setComputeProgress(0);
                  setIsReady(false);
                }}
                className="px-3 py-1 rounded text-[8px] font-mono font-bold uppercase tracking-widest transition-all"
                style={{
                  background: mode === m ? "rgba(34,211,238,0.15)" : "transparent",
                  color: mode === m ? "#22d3ee" : "oklch(from var(--foreground) l c h / 0.25)",
                  border: mode === m ? "1px solid rgba(34,211,238,0.35)" : "1px solid transparent",
                  boxShadow: mode === m ? "0 0 12px rgba(34,211,238,0.15)" : "none",
                }}
              >
                {m === 'layered' ? '⊞ LAYERED' : '⬡ FREE'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layer visibility controls (layered mode only) */}
      {isReady && mode === 'layered' && presentTypes.length > 0 && (
        <div className="absolute top-3 left-3 z-20">
          <div className="bg-background/90 border border-foreground/8 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-3 py-2 border-b border-foreground/8 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-pulse" />
              <span className="text-[8px] font-mono text-muted-foreground/70 tracking-[0.2em]">LAYERS</span>
            </div>
            <div className="p-2 space-y-0.5">
              {presentTypes.map(type => {
                const layer = LAYER_CONFIG[type] ?? DEFAULT_LAYER;
                const isHidden = hiddenLayers.has(type);
                return (
                  <button
                    key={type}
                    onClick={() => setHiddenLayers(prev => {
                      const next = new Set(prev);
                      if (next.has(type)) next.delete(type); else next.add(type);
                      return next;
                    })}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded transition-all hover:bg-foreground/5"
                    style={{ opacity: isHidden ? 0.35 : 1 }}
                  >
                    <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: isHidden ? "transparent" : layer.color, border: `1px solid ${layer.color}` }} />
                    <span className="text-[8px] font-mono text-muted-foreground flex-1 text-left">{layer.label}</span>
                    <span className="text-[8px] font-mono ml-1" style={{ color: isHidden ? 'oklch(from var(--foreground) l c h / 0.15)' : layer.color + 'aa' }}>
                      {nodeCountByType.get(type) ?? 0}
                    </span>
                    {isHidden && <span className="text-[7px] font-mono text-muted-foreground/40 ml-1">HIDDEN</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Free mode: node type legend */}
      {isReady && mode === 'free' && presentTypes.length > 0 && (
        <div className="absolute top-3 left-3 z-20">
          <div className="bg-background/90 border border-foreground/8 rounded-lg overflow-hidden shadow-2xl">
            <div className="px-3 py-2 border-b border-foreground/8 flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/60 animate-pulse" />
              <span className="text-[8px] font-mono text-muted-foreground/70 tracking-[0.2em]">NODE TYPES</span>
            </div>
            <div className="p-2 space-y-0.5">
              {presentTypes.map(type => {
                const layer = LAYER_CONFIG[type] ?? DEFAULT_LAYER;
                return (
                  <div key={type} className="flex items-center gap-2 px-2 py-1">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: layer.color, boxShadow: `0 0 6px ${layer.color}88` }} />
                    <span className="text-[8px] font-mono text-muted-foreground flex-1">{layer.label}</span>
                    <span className="text-[8px] font-mono" style={{ color: layer.color + 'aa' }}>{nodeCountByType.get(type) ?? 0}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Controls hint */}
      {isReady && (
        <div className="absolute bottom-3 right-3 pointer-events-none z-10">
          <div className="bg-background/80 border border-foreground/6 rounded-lg px-3 py-2 space-y-0.5">
            <div className="text-[7px] font-mono text-muted-foreground/40 tracking-[0.2em] mb-1.5">3D CONTROLS</div>
            {[
              ["Left drag", "Orbit"],
              ["Right drag", "Pan"],
              ["Scroll", "Zoom"],
              ["Click node", "Isolate + Fly-to"],
              ["Click again", "Clear isolation"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center gap-3">
                <span className="text-[8px] font-mono text-muted-foreground/60 w-20">{k}</span>
                <span className="text-[8px] font-mono text-muted-foreground/35">{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Selection indicator + depth toggle + Clear Selection + Reset View */}
      {selectedNodeIds.size > 0 && isReady && (
        <div className="absolute bottom-3 left-3 z-20 flex flex-col gap-1.5">
          {/* Selection count + depth toggle */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-cyan-400/30 bg-background/90"
            style={{ boxShadow: '0 0 16px rgba(34,211,238,0.12)' }}>
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[9px] font-mono text-cyan-400/80 font-bold uppercase tracking-wider">
              {selectedNodeIds.size} NODE{selectedNodeIds.size > 1 ? 'S' : ''} SELECTED
            </span>
            {/* Depth toggle */}
            <div className="flex items-center gap-1 ml-2 rounded border border-foreground/10 overflow-hidden">
              {([1, 2] as const).map(d => (
                <button
                  key={d}
                  onClick={() => setIsolationDepth(d)}
                  className="px-2 py-0.5 text-[8px] font-mono font-bold uppercase transition-all"
                  style={{
                    background: isolationDepth === d ? 'rgba(34,211,238,0.18)' : 'transparent',
                    color: isolationDepth === d ? '#22d3ee' : 'oklch(from var(--foreground) l c h / 0.3)',
                    borderRight: d === 1 ? '1px solid oklch(from var(--foreground) l c h / 0.08)' : 'none',
                  }}
                >{d}°</button>
              ))}
            </div>
          </div>
          {/* Action buttons row */}
          <div className="flex gap-1.5">
            {/* Clear Selection — removes selected nodes but keeps camera position */}
            <button
              onClick={() => {
                setSelectedNodeIds(new Set());
                setStoryboardOpen(false);
                storyboardUserCollapsedRef.current = false;
                // resetSelection clears the closure-local var + ring + opacities
                sceneRef.current?.userData.resetSelection?.();
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-400/40 bg-background/90 hover:bg-amber-400/10 transition-all"
              style={{ boxShadow: '0 0 10px rgba(251,191,36,0.06)' }}
            >
              <span className="text-[9px] font-mono text-amber-400/80 font-bold uppercase tracking-wider">◎ CLEAR SELECTION</span>
            </button>
            {/* Reset View — clears selection AND resets camera */}
            <button
              onClick={() => {
                setSelectedNodeIds(new Set());
                setStoryboardOpen(false);
                storyboardUserCollapsedRef.current = false;
                // resetSelection clears the closure-local var + ring + opacities
                sceneRef.current?.userData.resetSelection?.();
                // Also reset camera to default position
                if (cameraRef.current && controlsRef.current) {
                  cameraRef.current.position.set(0, 200, 900);
                  controlsRef.current.target.set(0, 0, 0);
                  controlsRef.current.update();
                }
              }}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-400/40 bg-background/90 hover:bg-red-400/10 transition-all"
              style={{ boxShadow: '0 0 10px rgba(248,113,113,0.08)' }}
            >
              <span className="text-[9px] font-mono text-red-400/80 font-bold uppercase tracking-wider">✕ RESET VIEW</span>
            </button>
            {/* Export PNG — icon-only button, always in the row */}
            <button
              onClick={() => {
                const renderer = rendererRef.current;
                if (!renderer) return;
                const canvas = renderer.domElement;
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                const mode3d = mode === 'layered' ? 'layered' : 'free';
                const dateStr = new Date().toISOString().slice(0, 10);
                link.download = `intel-3d-${mode3d}-${dateStr}.png`;
                link.href = dataUrl;
                link.click();
              }}
              title="Export 3D view as PNG"
              className="flex items-center justify-center px-2.5 py-1.5 rounded-lg border border-foreground/15 bg-background/90 hover:bg-foreground/8 transition-all"
              style={{ boxShadow: '0 0 8px rgba(34,211,238,0.04)' }}
            >
              <span className="text-[10px]">&#x1F4F7;</span>
            </button>
          </div>
        </div>
      )}

      {/* Export PNG — always-visible bottom-right button when no nodes are selected */}
      {isReady && selectedNodeIds.size === 0 && (
        <div className="absolute bottom-3 right-3 z-20">
          <button
            onClick={() => {
              const renderer = rendererRef.current;
              if (!renderer) return;
              const canvas = renderer.domElement;
              const dataUrl = canvas.toDataURL('image/png');
              const link = document.createElement('a');
              const mode3d = mode === 'layered' ? 'layered' : 'free';
              const dateStr = new Date().toISOString().slice(0, 10);
              link.download = `intel-3d-${mode3d}-${dateStr}.png`;
              link.href = dataUrl;
              link.click();
            }}
            title="Export 3D view as PNG"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-foreground/12 bg-background/90 hover:bg-foreground/8 transition-all"
            style={{ boxShadow: '0 0 8px rgba(34,211,238,0.06)' }}
          >
            <span className="text-[10px]">&#x1F4F7;</span>
            <span className="text-[8px] font-mono text-muted-foreground/70 font-bold uppercase tracking-widest">PNG</span>
          </button>
        </div>
      )}

      {/* ── STORYBOARD PANEL ── slides in from right when 2+ nodes selected */}
      {storyboardPaths.length > 0 && isReady && (
        <div
          className="absolute top-0 bottom-0 z-25 flex flex-row"
          style={{
            right: 0,
            transition: 'transform 0.3s cubic-bezier(0.4,0,0.2,1)',
            transform: storyboardOpen ? 'translateX(0)' : 'translateX(320px)',
            animation: 'slideInRight 0.3s ease-out',
          }}
        >
          {/* ── Toggle tab — always visible on left edge of panel */}
          <button
            onClick={() => {
              setStoryboardOpen(o => {
                // If user is collapsing, mark it as user-collapsed so auto-expand won't re-open it
                if (o) storyboardUserCollapsedRef.current = true;
                else storyboardUserCollapsedRef.current = false;
                return !o;
              });
            }}
            className="absolute flex flex-col items-center justify-center gap-1 z-30"
            style={{
              left: '-28px',
              top: '50%',
              transform: 'translateY(-50%)',
              width: '28px',
              height: '80px',
              background: 'rgba(4,8,18,0.95)',
              borderTop: '1px solid rgba(34,211,238,0.18)',
              borderBottom: '1px solid rgba(34,211,238,0.18)',
              borderLeft: '1px solid rgba(34,211,238,0.18)',
              borderRight: 'none',
              borderRadius: '6px 0 0 6px',
              cursor: 'pointer',
              boxShadow: '-4px 0 16px oklch(from var(--foreground) l c h / 0.1)',
            }}
            title={storyboardOpen ? 'Hide Intel Storyboard' : 'Show Intel Storyboard'}
          >
            <span style={{ fontSize: '8px', color: '#22d3ee', fontWeight: 800, writingMode: 'vertical-rl', textOrientation: 'mixed', letterSpacing: '0.15em', textTransform: 'uppercase', transform: 'rotate(180deg)' }}>INTEL</span>
            <span style={{ fontSize: '10px', color: '#22d3ee80', marginTop: '2px' }}>{storyboardOpen ? '▶' : '◀'}</span>
          </button>
          {/* ── Panel body */}
          <div
            className="flex flex-col"
            style={{
              width: '320px',
              height: '100%',
              background: 'linear-gradient(180deg, rgba(4,8,18,0.97) 0%, rgba(4,12,24,0.97) 100%)',
              borderLeft: '1px solid rgba(34,211,238,0.12)',
              boxShadow: '-8px 0 40px oklch(from var(--foreground) l c h / 0.12)',
              fontFamily: '"JetBrains Mono", monospace',
            }}
          >
          {/* Header */}
          <div style={{
            padding: '14px 16px 10px',
            borderBottom: '1px solid rgba(34,211,238,0.10)',
            background: 'rgba(34,211,238,0.04)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22d3ee', boxShadow: '0 0 8px #22d3ee', animation: 'pulse 2s infinite' }} />
              <span style={{ fontSize: '8px', fontWeight: 800, color: '#22d3ee', letterSpacing: '0.2em', textTransform: 'uppercase' }}>INTEL STORYBOARD</span>
            </div>
            <div style={{ fontSize: '7px', color: 'oklch(from var(--foreground) l c h / 0.25)', letterSpacing: '0.12em' }}>
              {selectedNodeIds.size} NODES · {storyboardPaths.length} PATH{storyboardPaths.length > 1 ? 'S' : ''} · BFS SHORTEST ROUTE
            </div>
          </div>

          {/* Scrollable path list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 0' }}>
            {storyboardPaths.map((path, pi) => {
              const hopCount = path.steps.length - 1;
              return (
                <div key={pi} style={{ marginBottom: '16px', borderBottom: pi < storyboardPaths.length - 1 ? '1px solid oklch(from var(--foreground) l c h / 0.05)' : 'none', paddingBottom: '16px' }}>
                  {/* Path header */}
                  <div style={{ padding: '0 16px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '7px', color: 'oklch(from var(--foreground) l c h / 0.25)', letterSpacing: '0.15em', textTransform: 'uppercase' }}>
                      PATH {pi + 1} · {hopCount} HOP{hopCount !== 1 ? 'S' : ''}
                    </span>
                    <span style={{
                      fontSize: '7px', fontWeight: 700, padding: '1px 6px', borderRadius: '2px',
                      background: hopCount === 1 ? 'rgba(16,185,129,0.15)' : hopCount <= 3 ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.12)',
                      color: hopCount === 1 ? '#10b981' : hopCount <= 3 ? '#f59e0b' : '#ef4444',
                      border: `1px solid ${hopCount === 1 ? '#10b98130' : hopCount <= 3 ? '#f59e0b30' : '#ef444430'}`,
                      textTransform: 'uppercase', letterSpacing: '0.1em',
                    }}>
                      {hopCount === 1 ? 'DIRECT' : hopCount <= 3 ? 'CLOSE' : 'DISTANT'}
                    </span>
                  </div>

                  {/* Step chain */}
                  <div style={{ padding: '0 12px' }}>
                    {path.steps.map((step, si) => {
                      const layer = LAYER_CONFIG[step.node.type] ?? DEFAULT_LAYER;
                      const isFirst = si === 0;
                      const isLast = si === path.steps.length - 1;
                      const isSelected = selectedNodeIds.has(step.node.id);
                      return (
                        <div key={si}>
                          {/* Node card */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '8px',
                            padding: '8px 10px',
                            borderRadius: '6px',
                            background: isSelected ? `${layer.color}10` : 'oklch(from var(--foreground) l c h / 0.02)',
                            border: isSelected ? `1px solid ${layer.color}30` : '1px solid oklch(from var(--foreground) l c h / 0.04)',
                            marginBottom: '2px',
                            boxShadow: isSelected ? `0 0 12px ${layer.color}12` : 'none',
                          }}>
                            {/* Type dot */}
                            <div style={{
                              width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0, marginTop: '3px',
                              background: layer.color,
                              boxShadow: `0 0 6px ${layer.color}88`,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              {/* Type badge */}
                              <div style={{ marginBottom: '3px' }}>
                                <span style={{
                                  fontSize: '6px', fontWeight: 800, textTransform: 'uppercase',
                                  letterSpacing: '0.15em', color: layer.color,
                                  background: `${layer.color}15`, padding: '1px 5px',
                                  borderRadius: '2px', border: `1px solid ${layer.color}25`,
                                }}>{layer.label}</span>
                                {(isFirst || isLast) && (
                                  <span style={{
                                    fontSize: '6px', fontWeight: 700, marginLeft: '4px',
                                    color: isFirst ? '#22d3ee' : '#f59e0b',
                                    textTransform: 'uppercase', letterSpacing: '0.1em',
                                  }}>{isFirst ? '◈ ORIGIN' : '◎ TARGET'}</span>
                                )}
                              </div>
                              {/* Label */}
                              <div style={{
                                fontSize: '10px', fontWeight: 600, color: isSelected ? 'var(--foreground)' : 'var(--muted-foreground)',
                                lineHeight: 1.3, fontFamily: 'Inter, sans-serif',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                              }}>
                                {step.node.label}
                              </div>
                              {/* Extra info */}
                              {step.node.country && (
                                <div style={{ fontSize: '8px', color: 'oklch(from var(--foreground) l c h / 0.2)', marginTop: '2px' }}>◎ {step.node.country}</div>
                              )}
                              {step.node.sentiment && (
                                <div style={{
                                  fontSize: '7px', marginTop: '2px', fontWeight: 700, textTransform: 'uppercase',
                                  color: step.node.sentiment === 'negative' ? '#f87171' : step.node.sentiment === 'positive' ? '#4ade80' : '#fbbf24',
                                }}>▸ {step.node.sentiment}</div>
                              )}
                            </div>
                          </div>

                          {/* Edge connector (between nodes) */}
                          {si < path.steps.length - 1 && (() => {
                            const nextStep = path.steps[si + 1];
                            const edgeColor = EDGE_COLORS[nextStep.edgeLabel] ?? '#475569';
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '3px 10px 3px 22px' }}>
                                <div style={{ width: '1px', height: '16px', background: `linear-gradient(180deg, ${edgeColor}60, ${edgeColor}20)` }} />
                                <div style={{
                                  flex: 1, display: 'flex', alignItems: 'center', gap: '4px',
                                  padding: '2px 6px', borderRadius: '3px',
                                  background: `${edgeColor}08`,
                                  border: `1px solid ${edgeColor}20`,
                                }}>
                                  <span style={{ fontSize: '8px', color: edgeColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                    {nextStep.direction}
                                  </span>
                                  {nextStep.edgeLabel && (
                                    <span style={{ fontSize: '8px', color: edgeColor, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                                      {nextStep.edgeLabel}
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer: copy + save buttons */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid oklch(from var(--foreground) l c h / 0.06)', background: 'oklch(from var(--foreground) l c h / 0.05)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {/* Copy narrative */}
            <button
              onClick={() => {
                const narrative = storyboardPaths.map((path, pi) => {
                  const chain = path.steps.map((s, si) => {
                    const prefix = si === 0 ? '' : ` ${s.direction} [${s.edgeLabel || 'link'}] → `;
                    return `${prefix}${s.node.label} (${s.node.type})`;
                  }).join('');
                  return `PATH ${pi + 1}: ${chain}`;
                }).join('\n\n');
                navigator.clipboard.writeText(narrative).catch(() => {});
              }}
              style={{
                width: '100%', padding: '7px', borderRadius: '4px', cursor: 'pointer',
                background: 'rgba(34,211,238,0.08)', border: '1px solid rgba(34,211,238,0.25)',
                color: '#22d3ee', fontSize: '8px', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                textTransform: 'uppercase', letterSpacing: '0.15em', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.15)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.08)')}
            >
              ⧉ COPY INTEL NARRATIVE
            </button>
            {/* Export PNG — captures the 3D renderer canvas */}
            <button
              onClick={() => {
                const renderer = rendererRef.current;
                if (!renderer) return;
                const canvas = renderer.domElement;
                const dataUrl = canvas.toDataURL('image/png');
                const link = document.createElement('a');
                const mode3d = mode === 'layered' ? 'layered' : 'free';
                const dateStr = new Date().toISOString().slice(0, 10);
                link.download = `intel-3d-${mode3d}-${dateStr}.png`;
                link.href = dataUrl;
                link.click();
              }}
              title="Export current 3D view as PNG"
              style={{
                width: '100%', padding: '7px', borderRadius: '4px', cursor: 'pointer',
                background: 'rgba(34,211,238,0.06)',
                border: '1px solid rgba(34,211,238,0.20)',
                color: 'rgba(34,211,238,0.7)',
                fontSize: '8px', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                textTransform: 'uppercase', letterSpacing: '0.15em', transition: 'all 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.12)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,211,238,0.06)')}
            >
              📷 EXPORT PNG
            </button>
            {/* Save to Investigation */}
            {onSaveStoryboard && (
              <button
                onClick={() => {
                  if (saveStatus === 'saving') return;
                  const narrative = storyboardPaths.map((path, pi) => {
                    const chain = path.steps.map((s, si) => {
                      const prefix = si === 0 ? '' : ` ${s.direction} [${s.edgeLabel || 'link'}] → `;
                      return `${prefix}${s.node.label} (${s.node.type})`;
                    }).join('');
                    return `PATH ${pi + 1}: ${chain}`;
                  }).join('\n\n');
                  const firstNode = storyboardPaths[0]?.steps[0]?.node.label ?? 'Node';
                  const lastPath = storyboardPaths[storyboardPaths.length - 1];
                  const lastNode = lastPath?.steps[lastPath.steps.length - 1]?.node.label ?? 'Node';
                  const title = `3D Path: ${firstNode} → ${lastNode}`;
                  setSaveStatus('saving');
                  try {
                    onSaveStoryboard(narrative, title);
                    setSaveStatus('saved');
                    setTimeout(() => setSaveStatus('idle'), 3000);
                  } catch {
                    setSaveStatus('error');
                    setTimeout(() => setSaveStatus('idle'), 3000);
                  }
                }}
                style={{
                  width: '100%', padding: '7px', borderRadius: '4px', cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
                  background: saveStatus === 'saved' ? 'rgba(16,185,129,0.12)' : saveStatus === 'error' ? 'rgba(239,68,68,0.10)' : 'rgba(16,185,129,0.07)',
                  border: `1px solid ${saveStatus === 'saved' ? 'rgba(16,185,129,0.4)' : saveStatus === 'error' ? 'rgba(239,68,68,0.35)' : 'rgba(16,185,129,0.22)'}`,
                  color: saveStatus === 'saved' ? '#10b981' : saveStatus === 'error' ? '#ef4444' : '#10b981',
                  fontSize: '8px', fontWeight: 700, fontFamily: '"JetBrains Mono", monospace',
                  textTransform: 'uppercase', letterSpacing: '0.15em', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (saveStatus === 'idle') e.currentTarget.style.background = 'rgba(16,185,129,0.14)'; }}
                onMouseLeave={e => { if (saveStatus === 'idle') e.currentTarget.style.background = 'rgba(16,185,129,0.07)'; }}
              >
                {saveStatus === 'saving' ? '⏳ SAVING…' : saveStatus === 'saved' ? '✓ SAVED TO INVESTIGATION' : saveStatus === 'error' ? '✕ SAVE FAILED' : '▶ SAVE TO INVESTIGATION'}
              </button>
            )}
          </div>
          {/* End panel body */}
          </div>
        </div>
      )}

      {/* PNG Export button removed from top-right — now lives in storyboard panel footer */}

      {/* Active link type badge */}
      {activeLinkType && isReady && (
        <div className="absolute top-14 right-3 z-20">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[9px] font-mono"
            style={{
              background: (EDGE_COLORS[activeLinkType] ?? "#22d3ee") + "12",
              borderColor: (EDGE_COLORS[activeLinkType] ?? "#22d3ee") + "40",
              color: EDGE_COLORS[activeLinkType] ?? "#22d3ee",
            }}>
            <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: EDGE_COLORS[activeLinkType] ?? "#22d3ee" }} />
            <span className="font-bold uppercase tracking-wider">{activeLinkType}</span>
            <span className="text-muted-foreground/50 text-[8px]">FILTER ACTIVE</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Camera fly-to animation ────────────────────────────────────────────────────
function flyToPosition(targetPos: any, camera: any, controls: any) {
  const startCam = camera.position.clone();
  const startTarget = controls.target.clone();
  const endCam = targetPos.clone().add(new (camera.position.constructor)(0, 60, 180));
  const endTarget = targetPos.clone();
  const duration = 900;
  const start = performance.now();

  function tick() {
    const t = Math.min((performance.now() - start) / duration, 1);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startCam, endCam, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);
    controls.update();
    if (t < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
