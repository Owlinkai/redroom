import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { trpc } from "../lib/trpc";
import { useLocation } from "wouter";
import {
  Plane, Ship, Camera, Activity, X, Eye,
  Maximize2, Minimize2, MapPin, Navigation,
  Target, Crosshair, Radio, ArrowLeft,
  RefreshCw, Trash2, Plus, Grid, List,
  Radar, AlertTriangle, Anchor, Clock,
  Play, Pause, FastForward, Rewind,
  Map as MapIcon, Bell, Shield, Hexagon,
  SkipForward, SkipBack, Volume2, LayoutGrid,
  Circle, Square, Image, ChevronLeft, ChevronRight,
  Sun, Moon,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// ─── Types ───────────────────────────────────────────────────────────────────
interface TrackedItem {
  id: string;
  type: "aircraft" | "vessel" | "camera" | "quake";
  label: string;
  data: any;
  addedAt: number;
  color: string;
}

interface GeoAlert {
  id: string;
  name: string;
  type: "enter" | "exit" | "deviate";
  polygon: [number, number][];
  targetIds: string[];
  active: boolean;
  createdAt: number;
}

interface AlertEvent {
  id: string;
  alertId: string;
  alertName: string;
  targetId: string;
  targetLabel: string;
  type: "enter" | "exit" | "deviate";
  timestamp: number;
  lat: number;
  lon: number;
}

const MAX_TRACKED = 10;
const LAYER_COLORS: Record<string, string> = {
  aircraft: "#06b6d4",
  vessel: "#3b82f6",
  camera: "#a855f7",
  quake: "#ef4444",
};

const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

// ─── Haversine Distance ──────────────────────────────────────────────────────
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Point in Polygon ────────────────────────────────────────────────────────
function pointInPolygon(lat: number, lon: number, polygon: [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1];
    const xj = polygon[j][0], yj = polygon[j][1];
    const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// ─── Speed-Based Trail Color ────────────────────────────────────────────────
function getSpeedColor(speedKnots: number): string {
  if (speedKnots < 3) return "#ef4444"; // Red — stopped/anchored
  if (speedKnots < 8) return "#eab308"; // Yellow — maneuvering
  return "#22c55e"; // Green — cruising
}

function getSpeedLabel(speedKnots: number): string {
  if (speedKnots < 3) return "STOPPED";
  if (speedKnots < 8) return "MANEUVERING";
  return "CRUISING";
}

// ─── Recording Types ────────────────────────────────────────────────────────
interface CameraSnapshot {
  id: string;
  cameraId: string;
  cameraLabel: string;
  timestamp: number;
  dataUrl: string; // base64 image data
}

const RECORDING_INTERVALS: { label: string; ms: number }[] = [
  { label: "30s", ms: 30000 },
  { label: "1m", ms: 60000 },
  { label: "5m", ms: 300000 },
];

// ─── Predictive Routing ─────────────────────────────────────────────────────
interface PredictedPosition {
  lat: number;
  lon: number;
  timeOffset: number; // minutes from now
  label: string;
}

function calculatePredictedPositions(
  lat: number, lon: number, headingDeg: number, speedKnots: number
): PredictedPosition[] {
  if (!lat || !lon || !headingDeg || !speedKnots || speedKnots < 1) return [];
  const speedKmH = speedKnots * 1.852; // knots to km/h
  const headingRad = headingDeg * Math.PI / 180;
  const R = 6371; // Earth radius km
  const intervals = [
    { minutes: 15, label: "+15m" },
    { minutes: 30, label: "+30m" },
    { minutes: 60, label: "+1h" },
    { minutes: 120, label: "+2h" },
  ];
  return intervals.map(({ minutes, label }) => {
    const distKm = speedKmH * (minutes / 60);
    const angularDist = distKm / R;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(headingRad)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(headingRad) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );
    return {
      lat: lat2 * 180 / Math.PI,
      lon: lon2 * 180 / Math.PI,
      timeOffset: minutes,
      label,
    };
  });
}

function calculateETA(
  lat: number, lon: number, destLat: number, destLon: number, speedKnots: number
): { etaMinutes: number; etaString: string } | null {
  if (!lat || !lon || !destLat || !destLon || !speedKnots || speedKnots < 1) return null;
  const distKm = haversineKm(lat, lon, destLat, destLon);
  const speedKmH = speedKnots * 1.852;
  const etaHours = distKm / speedKmH;
  const etaMinutes = Math.round(etaHours * 60);
  if (etaMinutes < 60) return { etaMinutes, etaString: `${etaMinutes}m` };
  const h = Math.floor(etaMinutes / 60);
  const m = etaMinutes % 60;
  if (h >= 24) {
    const d = Math.floor(h / 24);
    const rh = h % 24;
    return { etaMinutes, etaString: `${d}d ${rh}h` };
  }
  return { etaMinutes, etaString: `${h}h ${m}m` };
}

function getDistanceRemaining(lat: number, lon: number, destLat: number, destLon: number): string | null {
  if (!lat || !lon || !destLat || !destLon) return null;
  const dist = haversineKm(lat, lon, destLat, destLon);
  if (dist < 1) return `${Math.round(dist * 1000)}m`;
  return `${Math.round(dist)}km`;
}

// ─── Main Component ──────────────────────────────────────────────────────────
export default function SurveillancePage() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";
  const [, navigate] = useLocation();

  // Tracked items (persisted in localStorage)
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>(() => {
    try {
      const saved = localStorage.getItem("svm_tracked_items");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  // Layout & view state
  const [layoutMode, setLayoutMode] = useState<"grid" | "list">("grid");
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const [fullscreenItem, setFullscreenItem] = useState<string | null>(null);
  const [showMap, setShowMap] = useState(true);
  const [showAlerts, setShowAlerts] = useState(false);
  const [activePanel, setActivePanel] = useState<"items" | "playback" | "alerts" | "cameragrid">("items");
  const [showCameraGrid, setShowCameraGrid] = useState(false);

  // Historical playback state
  const [playbackActive, setPlaybackActive] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [playbackTime, setPlaybackTime] = useState(Date.now());
  const [playbackStart] = useState(() => Date.now() - 24 * 60 * 60 * 1000); // 24h ago
  const [playbackEnd] = useState(() => Date.now());
  const playbackRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const positionHistoryRef = useRef<Map<string, { lat: number; lon: number; time: number }[]>>(new Map());

  // Geofence alerts
  const [geoAlerts, setGeoAlerts] = useState<GeoAlert[]>(() => {
    try {
      const saved = localStorage.getItem("svm_geo_alerts");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [alertEvents, setAlertEvents] = useState<AlertEvent[]>([]);
  const [drawingGeofence, setDrawingGeofence] = useState(false);
  const [newAlertName, setNewAlertName] = useState("");
  const [newAlertType, setNewAlertType] = useState<"enter" | "exit" | "deviate">("enter");
  const drawnPolygonRef = useRef<[number, number][]>([]);

  // Browser notification permission
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(() => {
    if (typeof Notification !== 'undefined') return Notification.permission;
    return 'denied';
  });
  const requestNotifPermission = useCallback(async () => {
    if (typeof Notification === 'undefined') return;
    const result = await Notification.requestPermission();
    setNotifPermission(result);
  }, []);
  const sendNotification = useCallback((title: string, body: string, icon?: string) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    try {
      const n = new Notification(title, { body, icon: icon || '/favicon.ico', silent: false });
      setTimeout(() => n.close(), 8000);
    } catch {}
  }, []);

  // Track previous item count to detect new additions
  const prevItemCountRef = useRef(0);
  useEffect(() => {
    const prev = prevItemCountRef.current;
    const curr = trackedItems.length;
    if (curr > prev && prev > 0) {
      const newItem = trackedItems[trackedItems.length - 1];
      sendNotification(
        `⚠️ SVM: New Target Acquired`,
        `${newItem.label} (${newItem.type.toUpperCase()}) added to surveillance`,
      );
    }
    prevItemCountRef.current = curr;
  }, [trackedItems, sendNotification]);

  // Persist state
  useEffect(() => {
    localStorage.setItem("svm_tracked_items", JSON.stringify(trackedItems));
  }, [trackedItems]);
  useEffect(() => {
    localStorage.setItem("svm_geo_alerts", JSON.stringify(geoAlerts));
  }, [geoAlerts]);

  // Data queries for live updates
  const aviationQuery = trpc.sigint.getAviationData.useQuery(undefined, {
    enabled: trackedItems.some(i => i.type === "aircraft"),
    refetchInterval: 10000,
  });
  const maritimeQuery = trpc.sigint.getMaritimeData.useQuery(undefined, {
    enabled: trackedItems.some(i => i.type === "vessel"),
    refetchInterval: 20000,
  });
  const cctvQuery = trpc.sigint.getCCTVCameras.useQuery(undefined, {
    enabled: trackedItems.some(i => i.type === "camera"),
    staleTime: 600000,
  });

  // Update tracked items with latest data
  const updatedItems = useMemo(() => {
    return trackedItems.map(item => {
      if (item.type === "aircraft" && aviationQuery.data?.aircraft) {
        const found = aviationQuery.data.aircraft.find((a: any) => a.icao24 === item.data.icao24);
        if (found) return { ...item, data: found };
      }
      if (item.type === "vessel" && maritimeQuery.data?.vessels) {
        const found = maritimeQuery.data.vessels.find((v: any) => v.mmsi === item.data.mmsi);
        if (found) return { ...item, data: found };
      }
      return item;
    });
  }, [trackedItems, aviationQuery.data, maritimeQuery.data]);

  // Track position history for playback
  useEffect(() => {
    updatedItems.forEach(item => {
      const lat = item.data?.lat;
      const lon = item.data?.lon;
      if (lat && lon) {
        const history = positionHistoryRef.current.get(item.id) || [];
        const lastEntry = history[history.length - 1];
        if (!lastEntry || lastEntry.lat !== lat || lastEntry.lon !== lon) {
          history.push({ lat, lon, time: Date.now() });
          if (history.length > 500) history.shift();
          positionHistoryRef.current.set(item.id, history);
        }
      }
    });
  }, [updatedItems]);

  // Geofence alert checking
  useEffect(() => {
    if (geoAlerts.length === 0) return;
    const activeAlerts = geoAlerts.filter(a => a.active);
    if (activeAlerts.length === 0) return;

    updatedItems.forEach(item => {
      const lat = item.data?.lat;
      const lon = item.data?.lon;
      if (!lat || !lon) return;

      activeAlerts.forEach(alert => {
        if (alert.targetIds.length > 0 && !alert.targetIds.includes(item.id)) return;
        const isInside = pointInPolygon(lat, lon, alert.polygon);

        if (alert.type === "enter" && isInside) {
          const recent = alertEvents.find(e => e.alertId === alert.id && e.targetId === item.id && Date.now() - e.timestamp < 60000);
          if (!recent) {
            setAlertEvents(prev => [...prev, {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              alertId: alert.id,
              alertName: alert.name,
              targetId: item.id,
              targetLabel: item.label,
              type: "enter" as const,
              timestamp: Date.now(),
              lat, lon,
            }].slice(-100));
            sendNotification(
              `🚨 GEOFENCE BREACH: ${alert.name}`,
              `${item.label} entered zone at ${lat.toFixed(4)}, ${lon.toFixed(4)}`
            );
          }
        } else if (alert.type === "exit" && !isInside) {
          const recent = alertEvents.find(e => e.alertId === alert.id && e.targetId === item.id && Date.now() - e.timestamp < 60000);
          if (!recent) {
            setAlertEvents(prev => [...prev, {
              id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
              alertId: alert.id,
              alertName: alert.name,
              targetId: item.id,
              targetLabel: item.label,
              type: "exit" as const,
              timestamp: Date.now(),
              lat, lon,
            }].slice(-100));
            sendNotification(
              `🚨 GEOFENCE EXIT: ${alert.name}`,
              `${item.label} exited zone at ${lat.toFixed(4)}, ${lon.toFixed(4)}`
            );
          }
        }
      });
    });
  }, [updatedItems, geoAlerts, alertEvents, sendNotification]);

  // Playback controls
  const startPlayback = useCallback(() => {
    setPlaybackActive(true);
    setPlaybackTime(playbackStart);
  }, [playbackStart]);

  const stopPlayback = useCallback(() => {
    setPlaybackActive(false);
    if (playbackRef.current) { clearInterval(playbackRef.current); playbackRef.current = null; }
  }, []);

  useEffect(() => {
    if (!playbackActive) return;
    playbackRef.current = setInterval(() => {
      setPlaybackTime(prev => {
        const next = prev + (60000 * playbackSpeed); // advance 1 min per tick * speed
        if (next >= playbackEnd) { stopPlayback(); return playbackEnd; }
        return next;
      });
    }, 100);
    return () => { if (playbackRef.current) clearInterval(playbackRef.current); };
  }, [playbackActive, playbackSpeed, playbackEnd, stopPlayback]);

  // Remove item
  const removeItem = useCallback((id: string) => {
    setTrackedItems(prev => prev.filter(i => i.id !== id));
    if (selectedItem === id) setSelectedItem(null);
    if (fullscreenItem === id) setFullscreenItem(null);
  }, [selectedItem, fullscreenItem]);

  const clearAll = useCallback(() => {
    setTrackedItems([]);
    setSelectedItem(null);
    setFullscreenItem(null);
  }, []);

  // Delete geofence alert
  const deleteAlert = useCallback((id: string) => {
    setGeoAlerts(prev => prev.filter(a => a.id !== id));
  }, []);

  // Toggle alert active
  const toggleAlert = useCallback((id: string) => {
    setGeoAlerts(prev => prev.map(a => a.id === id ? { ...a, active: !a.active } : a));
  }, []);

  // Camera items for grid view
  const cameraItems = useMemo(() => updatedItems.filter(i => i.type === "camera"), [updatedItems]);

  // Grid columns based on item count
  const gridCols = useMemo(() => {
    const count = updatedItems.length;
    if (count <= 1) return "grid-cols-1";
    if (count <= 2) return "grid-cols-2";
    if (count <= 4) return "grid-cols-2";
    if (count <= 6) return "grid-cols-3";
    return "grid-cols-4";
  }, [updatedItems.length]);

  // Playback progress percentage
  const playbackProgress = useMemo(() => {
    return ((playbackTime - playbackStart) / (playbackEnd - playbackStart)) * 100;
  }, [playbackTime, playbackStart, playbackEnd]);

  return (
    <div className="h-screen w-screen flex flex-col bg-background text-foreground overflow-hidden">
      {/* ─── Top Bar ──────────────────────────────────────────────────────── */}
      <header className="h-11 flex items-center px-4 border-b border-border/50 bg-card/90 backdrop-blur-sm z-[9999] shrink-0">
        <button onClick={() => navigate("/sigint")} className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mr-4">
          <ArrowLeft size={14} />
          <span className="text-[10px] font-mono uppercase tracking-wider">SIGINT</span>
        </button>
        <div className="flex items-center gap-2">
          <Target size={14} className="text-red-400" />
          <span className="text-[12px] font-mono font-bold uppercase tracking-wider text-red-400">SURVEILLANCE MODE</span>
          <span className="text-[9px] font-mono text-muted-foreground ml-2">(SVM · Redroom V2.4)</span>
        </div>
        <div className="flex items-center gap-2 ml-4">
          <span className="text-[9px] font-mono text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full border border-border/30">
            {updatedItems.length}/{MAX_TRACKED} TRACKED
          </span>
          {updatedItems.some(i => i.type === "aircraft") && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border" style={{ color: LAYER_COLORS.aircraft, borderColor: LAYER_COLORS.aircraft + "40" }}>
              <Plane size={9} className="inline mr-1" />{updatedItems.filter(i => i.type === "aircraft").length}
            </span>
          )}
          {updatedItems.some(i => i.type === "vessel") && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border" style={{ color: LAYER_COLORS.vessel, borderColor: LAYER_COLORS.vessel + "40" }}>
              <Ship size={9} className="inline mr-1" />{updatedItems.filter(i => i.type === "vessel").length}
            </span>
          )}
          {updatedItems.some(i => i.type === "camera") && (
            <span className="text-[9px] font-mono px-2 py-0.5 rounded-full border" style={{ color: LAYER_COLORS.camera, borderColor: LAYER_COLORS.camera + "40" }}>
              <Camera size={9} className="inline mr-1" />{updatedItems.filter(i => i.type === "camera").length}
            </span>
          )}
        </div>

        {/* Theme toggle */}
        <button onClick={toggleTheme}
          className="ml-2 flex items-center gap-1.5 px-1.5 py-0.5 rounded font-mono text-[9px] border transition-all"
          style={{ background: isLight ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)', borderColor: isLight ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)', color: isLight ? '#f59e0b' : '#818cf8' }}
        >
          {isLight ? <Moon size={10} /> : <Sun size={10} />}
          <span className="hidden sm:inline">{isLight ? 'DARK' : 'LIGHT'}</span>
        </button>
        {/* Docs link */}
        <a
          href="/docs"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] border transition-all"
          style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.3)', color: 'rgba(34,197,94,0.85)', textDecoration: 'none' }}
        >
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          DOCS
        </a>
        {/* Back to SIGINT */}
        <a
          href="/sigint"
          className="flex items-center gap-1 px-1.5 py-0.5 rounded font-mono text-[9px] border transition-all"
          style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.8)', textDecoration: 'none' }}
        >← SIGINT</a>
        {/* Right controls */}
        <div className="ml-auto flex items-center gap-1.5">
          {/* Camera Grid button — only show when 2+ cameras tracked */}
          {cameraItems.length >= 2 && (
            <button
              onClick={() => { setShowCameraGrid(!showCameraGrid); setActivePanel(showCameraGrid ? "items" : "cameragrid"); }}
              className={`p-1.5 rounded text-[9px] font-mono transition-colors ${activePanel === "cameragrid" ? "bg-purple-500/20 text-purple-400 border border-purple-500/40" : "hover:bg-muted/50 text-muted-foreground"}`}
              title="Camera Grid View (SOC)"
            >
              <LayoutGrid size={13} />
            </button>
          )}
          <button onClick={() => setShowMap(!showMap)} className={`p-1.5 rounded text-[9px] font-mono transition-colors ${showMap ? "bg-green-500/20 text-green-400 border border-green-500/40" : "hover:bg-muted/50 text-muted-foreground"}`} title="Toggle Map Overlay">
            <MapIcon size={13} />
          </button>
          <button onClick={() => setActivePanel(activePanel === "playback" ? "items" : "playback")} className={`p-1.5 rounded text-[9px] font-mono transition-colors ${activePanel === "playback" ? "bg-amber-500/20 text-amber-400 border border-amber-500/40" : "hover:bg-muted/50 text-muted-foreground"}`} title="Historical Playback">
            <Clock size={13} />
          </button>
          <button onClick={() => { setShowAlerts(!showAlerts); setActivePanel(showAlerts ? "items" : "alerts"); }} className={`p-1.5 rounded text-[9px] font-mono transition-colors relative ${showAlerts ? "bg-red-500/20 text-red-400 border border-red-500/40" : "hover:bg-muted/50 text-muted-foreground"}`} title="Geofence Alerts">
            <Bell size={13} />
            {alertEvents.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full text-[7px] text-white flex items-center justify-center font-bold">{alertEvents.length > 9 ? "9+" : alertEvents.length}</span>
            )}
          </button>
          {/* Browser notification permission */}
          <button
            onClick={requestNotifPermission}
            title={notifPermission === 'granted' ? 'Browser notifications: ON' : notifPermission === 'denied' ? 'Notifications blocked by browser' : 'Enable browser notifications'}
            className={`p-1.5 rounded text-[9px] font-mono transition-colors relative ${
              notifPermission === 'granted' ? 'bg-green-500/20 text-green-400 border border-green-500/40' :
              notifPermission === 'denied' ? 'opacity-40 text-muted-foreground cursor-not-allowed' :
              'hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 animate-pulse'
            }`}
            disabled={notifPermission === 'denied'}
          >
            <Bell size={13} />
            {notifPermission === 'granted' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-green-400 rounded-full" />
            )}
            {notifPermission === 'default' && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-amber-400 rounded-full animate-ping" />
            )}
          </button>
          <div className="w-px h-5 bg-border/50 mx-1" />
          <button onClick={() => setLayoutMode(layoutMode === "grid" ? "list" : "grid")} className="p-1.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title={layoutMode === "grid" ? "Switch to list" : "Switch to grid"}>
            {layoutMode === "grid" ? <List size={13} /> : <Grid size={13} />}
          </button>
          <button onClick={clearAll} className="p-1.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors" title="Clear all tracked items">
            <Trash2 size={13} />
          </button>
        </div>
      </header>

      {/* ─── Main Content ─────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* Map Overlay Panel */}
        {showMap && updatedItems.length > 0 && activePanel !== "cameragrid" && (
          <div className="w-[320px] shrink-0 border-r border-border/50 flex flex-col">
            <div className="h-7 flex items-center px-2 border-b border-border/30 bg-card/50">
              <MapIcon size={10} className="text-green-400 mr-1.5" />
              <span className="text-[9px] font-mono font-bold text-green-400 uppercase tracking-wider">TACTICAL MAP</span>
              <span className="text-[8px] font-mono text-muted-foreground ml-auto">{updatedItems.filter(i => i.data?.lat).length} PLOTTED</span>
            </div>
            <SvmMapOverlay items={updatedItems} isLight={isLight} selectedItem={selectedItem} onSelectItem={setSelectedItem} geoAlerts={geoAlerts} drawingGeofence={drawingGeofence} onGeofenceDrawn={(polygon) => { drawnPolygonRef.current = polygon; setDrawingGeofence(false); }} />
          </div>
        )}

        {/* Items / Playback / Alerts / Camera Grid Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Playback Timeline Bar */}
          {activePanel === "playback" && (
            <PlaybackPanel
              playbackActive={playbackActive}
              playbackTime={playbackTime}
              playbackStart={playbackStart}
              playbackEnd={playbackEnd}
              playbackSpeed={playbackSpeed}
              playbackProgress={playbackProgress}
              onStart={startPlayback}
              onStop={stopPlayback}
              onSetSpeed={setPlaybackSpeed}
              onSeek={(pct) => setPlaybackTime(playbackStart + (playbackEnd - playbackStart) * pct)}
            />
          )}

          {/* Alerts Panel */}
          {activePanel === "alerts" && (
            <AlertsPanel
              geoAlerts={geoAlerts}
              alertEvents={alertEvents}
              trackedItems={updatedItems}
              onDeleteAlert={deleteAlert}
              onToggleAlert={toggleAlert}
              onStartDrawing={() => { setDrawingGeofence(true); setShowMap(true); }}
              onCreateAlert={(name, type, targetIds) => {
                if (drawnPolygonRef.current.length < 3) return;
                setGeoAlerts(prev => [...prev, {
                  id: `alert-${Date.now()}`,
                  name: name || `Alert ${prev.length + 1}`,
                  type,
                  polygon: drawnPolygonRef.current,
                  targetIds,
                  active: true,
                  createdAt: Date.now(),
                }]);
                drawnPolygonRef.current = [];
              }}
              newAlertName={newAlertName}
              setNewAlertName={setNewAlertName}
              newAlertType={newAlertType}
              setNewAlertType={setNewAlertType}
              onClearEvents={() => setAlertEvents([])}
            />
          )}

          {/* Camera Grid View (SOC) */}
          {activePanel === "cameragrid" && (
            <CameraGridView
              cameras={cameraItems}
              onRemove={removeItem}
              isLight={isLight}
            />
          )}

          {/* Items Grid */}
          {activePanel === "items" && (
            updatedItems.length === 0 ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center max-w-md">
                  <Target size={48} className="text-red-400/30 mx-auto mb-4" />
                  <h2 className="text-lg font-mono font-bold text-foreground/80 mb-2">NO TARGETS TRACKED</h2>
                  <p className="text-[11px] font-mono text-muted-foreground mb-6 leading-relaxed">
                    Add items from the SIGINT page to track them here. You can monitor up to {MAX_TRACKED} items simultaneously — cameras, aircraft, vessels, and seismic events.
                  </p>
                  <button onClick={() => navigate("/sigint")} className="px-4 py-2 bg-red-500/20 border border-red-500/40 rounded text-red-400 text-[11px] font-mono hover:bg-red-500/30 transition-colors">
                    <Crosshair size={12} className="inline mr-2" />GO TO SIGINT TO ADD TARGETS
                  </button>
                </div>
              </div>
            ) : fullscreenItem ? (
              <FullscreenView
                item={updatedItems.find(i => i.id === fullscreenItem)!}
                onClose={() => setFullscreenItem(null)}
                isLight={isLight}
                allItems={updatedItems}
              />
            ) : (
              <div className={`flex-1 overflow-auto p-3 ${layoutMode === "grid" ? `grid ${gridCols} gap-3` : "flex flex-col gap-3"}`}>
                {updatedItems.map(item => (
                  <TrackedItemCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItem === item.id}
                    onSelect={() => setSelectedItem(item.id === selectedItem ? null : item.id)}
                    onRemove={() => removeItem(item.id)}
                    onFullscreen={() => setFullscreenItem(item.id)}
                    isLight={isLight}
                    layoutMode={layoutMode}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </div>

      {/* ─── Status Bar ───────────────────────────────────────────────────── */}
      <footer className="h-7 flex items-center px-3 border-t border-border/50 bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" style={{ boxShadow: "0 0 6px #f87171" }} />
          <span className="text-[9px] font-mono font-bold text-red-400/80 uppercase tracking-widest">SVM ACTIVE</span>
        </div>
        <div className="flex items-center gap-3 ml-4 text-[9px] font-mono text-muted-foreground">
          <span>{updatedItems.length} TARGETS</span>
          <span className="text-border">│</span>
          <span>{geoAlerts.filter(a => a.active).length} GEOFENCES</span>
          <span className="text-border">│</span>
          <span>{alertEvents.length} ALERTS</span>
          <span className="text-border">│</span>
          <span>REFRESH: 10s/20s/4s</span>
          {activePanel === "cameragrid" && (
            <>
              <span className="text-border">│</span>
              <span className="text-purple-400">CAM GRID: {cameraItems.length} FEEDS</span>
            </>
          )}
        </div>
        {playbackActive && (
          <div className="flex items-center gap-2 ml-4">
            <span className="text-[9px] font-mono text-amber-400">▶ PLAYBACK {playbackSpeed}x</span>
            <span className="text-[9px] font-mono text-amber-400/60">{new Date(playbackTime).toLocaleTimeString()}</span>
          </div>
        )}
        <div className="ml-auto text-[9px] font-mono text-muted-foreground">
          {new Date().toISOString().replace("T", " ").slice(0, 19)} UTC
        </div>
      </footer>
    </div>
  );
}

// ─── Camera Grid View (SOC Style) with Recording ───────────────────────────
function CameraGridView({ cameras, onRemove, isLight }: {
  cameras: TrackedItem[];
  onRemove: (id: string) => void;
  isLight: boolean;
}) {
  const [fullscreenCam, setFullscreenCam] = useState<string | null>(null);
  const [recordingCams, setRecordingCams] = useState<Set<string>>(new Set());
  const [globalRecording, setGlobalRecording] = useState(false);
  const [recordingInterval, setRecordingInterval] = useState(RECORDING_INTERVALS[1].ms);
  const [snapshots, setSnapshots] = useState<CameraSnapshot[]>(() => {
    try { const saved = localStorage.getItem("svm_camera_snapshots"); return saved ? JSON.parse(saved) : []; } catch { return []; }
  });
  const [showGallery, setShowGallery] = useState<string | null>(null);
  const [galleryPage, setGalleryPage] = useState(0);
  const recordingTimersRef = useRef<Map<string, ReturnType<typeof setInterval>>>(new Map());

  // Persist snapshots (max 100)
  useEffect(() => {
    try { localStorage.setItem("svm_camera_snapshots", JSON.stringify(snapshots.slice(-100))); } catch {}
  }, [snapshots]);

  const captureSnapshot = useCallback((cam: TrackedItem) => {
    const feedElements = document.querySelectorAll(`img[alt="${cam.data.name}"]`);
    const img = feedElements[feedElements.length - 1] as HTMLImageElement | undefined;
    if (img && img.complete && img.naturalWidth > 0) {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = Math.min(img.naturalWidth, 640);
        canvas.height = Math.min(img.naturalHeight, 480);
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
          setSnapshots(prev => [...prev, { id: `snap-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, cameraId: cam.id, cameraLabel: cam.label, timestamp: Date.now(), dataUrl }].slice(-100));
          return;
        }
      } catch {}
    }
    // Fallback placeholder
    const canvas = document.createElement("canvas"); canvas.width = 320; canvas.height = 180;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#0a0a0a"; ctx.fillRect(0, 0, 320, 180);
      ctx.fillStyle = "#22c55e"; ctx.font = "bold 10px monospace";
      ctx.fillText(`SNAPSHOT: ${cam.label}`, 10, 20);
      ctx.fillText(`TIME: ${new Date().toLocaleTimeString()}`, 10, 40);
      ctx.strokeStyle = "#22c55e40"; ctx.strokeRect(2, 2, 316, 176);
      setSnapshots(prev => [...prev, { id: `snap-${Date.now()}-${Math.random().toString(36).slice(2,6)}`, cameraId: cam.id, cameraLabel: cam.label, timestamp: Date.now(), dataUrl: canvas.toDataURL("image/jpeg", 0.8) }].slice(-100));
    }
  }, []);

  const startRecording = useCallback((camId: string) => {
    const cam = cameras.find(c => c.id === camId);
    if (!cam) return;
    setRecordingCams(prev => new Set(Array.from(prev).concat(camId)));
    captureSnapshot(cam);
    const timer = setInterval(() => { const c = cameras.find(x => x.id === camId); if (c) captureSnapshot(c); }, recordingInterval);
    recordingTimersRef.current.set(camId, timer);
  }, [cameras, captureSnapshot, recordingInterval]);

  const stopRecording = useCallback((camId: string) => {
    setRecordingCams(prev => { const n = new Set(prev); n.delete(camId); return n; });
    const timer = recordingTimersRef.current.get(camId);
    if (timer) { clearInterval(timer); recordingTimersRef.current.delete(camId); }
  }, []);

  const toggleGlobalRecording = useCallback(() => {
    if (globalRecording) { cameras.forEach(cam => stopRecording(cam.id)); setGlobalRecording(false); }
    else { cameras.forEach(cam => startRecording(cam.id)); setGlobalRecording(true); }
  }, [globalRecording, cameras, startRecording, stopRecording]);

  useEffect(() => { return () => { recordingTimersRef.current.forEach(t => clearInterval(t)); recordingTimersRef.current.clear(); }; }, []);

  // Determine grid layout
  const gridClass = useMemo(() => {
    const count = cameras.length;
    if (count <= 2) return "grid-cols-2 grid-rows-1";
    if (count <= 4) return "grid-cols-2 grid-rows-2";
    if (count <= 6) return "grid-cols-3 grid-rows-2";
    return "grid-cols-3 grid-rows-3";
  }, [cameras.length]);

  // Gallery view
  if (showGallery) {
    const gallerySnaps = showGallery === "all" ? snapshots : snapshots.filter(s => s.cameraId === showGallery);
    const ITEMS_PER_PAGE = 12;
    const totalPages = Math.max(1, Math.ceil(gallerySnaps.length / ITEMS_PER_PAGE));
    const pageSnaps = gallerySnaps.slice(galleryPage * ITEMS_PER_PAGE, (galleryPage + 1) * ITEMS_PER_PAGE);

    return (
      <div className="flex-1 flex flex-col overflow-hidden bg-black/95">
        <div className="h-8 flex items-center px-3 border-b border-green-500/30 bg-black/80 shrink-0">
          <button onClick={() => { setShowGallery(null); setGalleryPage(0); }} className="mr-2 p-1 rounded hover:bg-green-500/20 text-green-400 transition-colors"><ChevronLeft size={12} /></button>
          <Image size={11} className="text-green-400 mr-2" />
          <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-wider">SNAPSHOT GALLERY</span>
          <span className="text-[8px] font-mono text-green-400/50 ml-3">{showGallery === "all" ? "ALL CAMERAS" : gallerySnaps[0]?.cameraLabel || ""}</span>
          <span className="text-[8px] font-mono text-green-400/40 ml-auto">{gallerySnaps.length} SNAPSHOTS</span>
        </div>
        {gallerySnaps.length === 0 ? (
          <div className="flex-1 flex items-center justify-center"><div className="text-center"><Image size={32} className="text-green-400/20 mx-auto mb-2" /><span className="text-[10px] font-mono text-green-400/50">NO SNAPSHOTS YET</span></div></div>
        ) : (
          <div className="flex-1 overflow-auto p-2">
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {pageSnaps.map(snap => (
                <div key={snap.id} className="relative border border-green-500/30 rounded overflow-hidden group">
                  <img src={snap.dataUrl} alt={snap.cameraLabel} className="w-full aspect-video object-cover" />
                  <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1.5 py-0.5">
                    <div className="text-[7px] font-mono text-green-400 truncate">{snap.cameraLabel}</div>
                    <div className="text-[6px] font-mono text-green-400/50">{new Date(snap.timestamp).toLocaleString()}</div>
                  </div>
                  <button onClick={() => setSnapshots(prev => prev.filter(s => s.id !== snap.id))} className="absolute top-1 right-1 bg-black/80 p-0.5 rounded border border-red-500/40 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"><X size={8} className="text-red-400" /></button>
                </div>
              ))}
            </div>
          </div>
        )}
        {totalPages > 1 && (
          <div className="h-7 flex items-center justify-center gap-2 border-t border-green-500/30 bg-black/80 shrink-0">
            <button onClick={() => setGalleryPage(p => Math.max(0, p - 1))} disabled={galleryPage === 0} className="p-1 rounded hover:bg-green-500/20 text-green-400 disabled:opacity-30"><ChevronLeft size={12} /></button>
            <span className="text-[8px] font-mono text-green-400">{galleryPage + 1} / {totalPages}</span>
            <button onClick={() => setGalleryPage(p => Math.min(totalPages - 1, p + 1))} disabled={galleryPage >= totalPages - 1} className="p-1 rounded hover:bg-green-500/20 text-green-400 disabled:opacity-30"><ChevronRight size={12} /></button>
          </div>
        )}
      </div>
    );
  }

  if (fullscreenCam) {
    const cam = cameras.find(c => c.id === fullscreenCam);
    if (cam) {
      return (
        <div className="flex-1 relative bg-black">
          <div className="absolute inset-0"><CameraFeedWidget camera={cam.data} /></div>
          <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
            <div className="bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded border border-green-500/40">
              <span className="text-[10px] font-mono font-bold text-green-400">{cam.label}</span>
              <span className="text-[8px] font-mono text-green-400/60 ml-2">{cam.data.city || ""}, {cam.data.countryName || ""}</span>
            </div>
            <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-green-500/30">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse inline-block mr-1.5" />
              <span className="text-[8px] font-mono text-red-400">LIVE</span>
            </div>
            {recordingCams.has(cam.id) && (
              <div className="bg-red-900/80 backdrop-blur-sm px-2 py-1 rounded border border-red-500/40 animate-pulse">
                <Circle size={8} className="inline text-red-400 fill-red-400 mr-1" />
                <span className="text-[8px] font-mono text-red-400">RECORDING</span>
              </div>
            )}
          </div>
          <button onClick={() => setFullscreenCam(null)} className="absolute top-3 right-3 z-10 bg-black/80 backdrop-blur-sm p-2 rounded border border-green-500/40 hover:bg-black/90 transition-colors">
            <Minimize2 size={14} className="text-green-400" />
          </button>
          <div className="absolute bottom-3 left-3 right-3 z-10 flex items-center justify-between">
            <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-green-500/30">
              <span className="text-[8px] font-mono text-green-400/80">{new Date().toLocaleTimeString()}</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => recordingCams.has(cam.id) ? stopRecording(cam.id) : startRecording(cam.id)} className={`bg-black/80 backdrop-blur-sm px-2 py-1 rounded border transition-colors ${recordingCams.has(cam.id) ? "border-red-500/60 hover:bg-red-500/20" : "border-green-500/30 hover:bg-green-500/20"}`}>
                {recordingCams.has(cam.id) ? (<><Square size={8} className="inline text-red-400 mr-1" /><span className="text-[8px] font-mono text-red-400">STOP</span></>) : (<><Circle size={8} className="inline text-green-400 mr-1" /><span className="text-[8px] font-mono text-green-400">REC</span></>)}
              </button>
              <button onClick={() => { setShowGallery(cam.id); setGalleryPage(0); }} className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-green-500/30 hover:bg-green-500/20 transition-colors">
                <Image size={8} className="inline text-green-400 mr-1" /><span className="text-[8px] font-mono text-green-400">{snapshots.filter(s => s.cameraId === cam.id).length}</span>
              </button>
            </div>
            <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded border border-green-500/30">
              <span className="text-[8px] font-mono text-green-400/60">CAM ID: {cam.data.id || cam.id}</span>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-black/95">
      {/* SOC Header with Recording Controls */}
      <div className="h-9 flex items-center px-3 border-b border-green-500/30 bg-black/80 shrink-0">
        <LayoutGrid size={11} className="text-green-400 mr-2" />
        <span className="text-[10px] font-mono font-bold text-green-400 uppercase tracking-wider">SECURITY OPERATIONS CENTER</span>
        <div className="flex items-center gap-2 ml-auto">
          {/* Interval selector */}
          <div className="flex items-center gap-0.5">
            {RECORDING_INTERVALS.map(intv => (
              <button key={intv.ms} onClick={() => setRecordingInterval(intv.ms)} className={`px-1.5 py-0.5 rounded text-[7px] font-mono transition-colors ${recordingInterval === intv.ms ? "bg-green-500/30 text-green-400 border border-green-500/50" : "text-green-400/40 hover:text-green-400/70"}`}>{intv.label}</button>
            ))}
          </div>
          <button onClick={toggleGlobalRecording} className={`flex items-center gap-1 px-2 py-0.5 rounded border transition-colors ${globalRecording ? "border-red-500/60 bg-red-500/20" : "border-green-500/40 hover:bg-green-500/20"}`}>
            {globalRecording ? (<><Square size={8} className="text-red-400" /><span className="text-[8px] font-mono text-red-400">STOP ALL</span></>) : (<><Circle size={8} className="text-green-400 fill-green-400" /><span className="text-[8px] font-mono text-green-400">REC ALL</span></>)}
          </button>
          <button onClick={() => { setShowGallery("all"); setGalleryPage(0); }} className="flex items-center gap-1 px-2 py-0.5 rounded border border-green-500/40 hover:bg-green-500/20 transition-colors">
            <Image size={8} className="text-green-400" /><span className="text-[8px] font-mono text-green-400">{snapshots.length}</span>
          </button>
          <span className="text-[8px] font-mono text-green-400/40">{cameras.length} FEEDS</span>
        </div>
      </div>

      {/* Camera Grid */}
      <div className={`flex-1 grid ${gridClass} gap-[2px] p-[2px]`}>
        {cameras.map((cam, idx) => {
          const isRecording = recordingCams.has(cam.id);
          const camSnapshotCount = snapshots.filter(s => s.cameraId === cam.id).length;
          return (
            <div key={cam.id} className={`relative group border bg-black overflow-hidden ${isRecording ? "border-red-500/50" : "border-green-500/30"}`}>
              <div className="absolute inset-0"><CameraFeedWidget camera={cam.data} /></div>

              {/* Top-left: Camera ID + Recording Status */}
              <div className="absolute top-1 left-1 z-10 flex items-center gap-1">
                <div className="bg-black/80 px-1.5 py-0.5 rounded border border-green-500/40">
                  <span className="text-[8px] font-mono font-bold text-green-400">CAM {String(idx + 1).padStart(2, "0")}</span>
                </div>
                {isRecording ? (
                  <div className="bg-red-900/80 px-1 py-0.5 rounded border border-red-500/40 animate-pulse">
                    <Circle size={6} className="inline text-red-400 fill-red-400 mr-0.5" /><span className="text-[7px] font-mono text-red-400">REC</span>
                  </div>
                ) : (
                  <div className="bg-black/80 px-1 py-0.5 rounded">
                    <span className="w-1 h-1 rounded-full bg-green-500 inline-block mr-1" /><span className="text-[7px] font-mono text-green-400">LIVE</span>
                  </div>
                )}
              </div>

              {/* Top-right: Controls (visible on hover) */}
              <div className="absolute top-1 right-1 z-10 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => isRecording ? stopRecording(cam.id) : startRecording(cam.id)} className={`bg-black/80 p-1 rounded border transition-colors ${isRecording ? "border-red-500/40 hover:bg-red-500/20" : "border-green-500/40 hover:bg-green-500/20"}`} title={isRecording ? "Stop recording" : "Start recording"}>
                  {isRecording ? <Square size={10} className="text-red-400" /> : <Circle size={10} className="text-green-400" />}
                </button>
                <button onClick={() => { setShowGallery(cam.id); setGalleryPage(0); }} className="bg-black/80 p-1 rounded border border-green-500/40 hover:bg-green-500/20 transition-colors" title={`Snapshots (${camSnapshotCount})`}>
                  <Image size={10} className="text-green-400" />
                </button>
                <button onClick={() => setFullscreenCam(cam.id)} className="bg-black/80 p-1 rounded border border-green-500/40 hover:bg-green-500/20 transition-colors" title="Fullscreen">
                  <Maximize2 size={10} className="text-green-400" />
                </button>
                <button onClick={() => { stopRecording(cam.id); onRemove(cam.id); }} className="bg-black/80 p-1 rounded border border-red-500/40 hover:bg-red-500/20 transition-colors" title="Remove">
                  <X size={10} className="text-red-400" />
                </button>
              </div>

              {/* Bottom: Camera name + location + snapshot count */}
              <div className="absolute bottom-0 left-0 right-0 z-10 bg-gradient-to-t from-black/90 to-transparent pt-4 pb-1 px-1.5">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="text-[8px] font-mono text-green-400 font-bold truncate">{cam.label}</div>
                    <div className="text-[7px] font-mono text-green-400/50 truncate">{cam.data.city || ""}{cam.data.city && cam.data.countryName ? ", " : ""}{cam.data.countryName || ""}</div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-1">
                    {camSnapshotCount > 0 && <span className="text-[7px] font-mono text-green-400/60 bg-green-500/10 px-1 rounded">{camSnapshotCount} snaps</span>}
                    <div className="text-[7px] font-mono text-green-400/40">{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</div>
                  </div>
                </div>
              </div>

              {/* Scanline effect */}
              <div className="absolute inset-0 pointer-events-none opacity-10 z-5" style={{ background: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,255,0,0.03) 2px, rgba(0,255,0,0.03) 4px)" }} />
              {/* Corner brackets */}
              <div className="absolute top-0 left-0 w-3 h-3 border-t border-l border-green-500/60 pointer-events-none" />
              <div className="absolute top-0 right-0 w-3 h-3 border-t border-r border-green-500/60 pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-3 h-3 border-b border-l border-green-500/60 pointer-events-none" />
              <div className="absolute bottom-0 right-0 w-3 h-3 border-b border-r border-green-500/60 pointer-events-none" />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── SVM Map Overlay ────────────────────────────────────────────────────────
function SvmMapOverlay({ items, isLight, selectedItem, onSelectItem, geoAlerts, drawingGeofence, onGeofenceDrawn }: {
  items: TrackedItem[];
  isLight: boolean;
  selectedItem: string | null;
  onSelectItem: (id: string) => void;
  geoAlerts: GeoAlert[];
  drawingGeofence: boolean;
  onGeofenceDrawn: (polygon: [number, number][]) => void;
}) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Map<string, L.CircleMarker>>(new Map());
  const linesRef = useRef<Map<string, L.Polyline>>(new Map());
  const geofenceLayerRef = useRef<L.LayerGroup | null>(null);
  const drawPointsRef = useRef<[number, number][]>([]);
  const drawPolylineRef = useRef<L.Polyline | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    const map = L.map(mapContainerRef.current, {
      center: [30, 0],
      zoom: 2,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer(isLight ? LIGHT_TILE : DARK_TILE, { maxZoom: 18 }).addTo(map);
    geofenceLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Handle geofence drawing
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (drawingGeofence) {
      drawPointsRef.current = [];
      map.getContainer().style.cursor = "crosshair";

      const onClick = (e: L.LeafletMouseEvent) => {
        drawPointsRef.current.push([e.latlng.lat, e.latlng.lng]);
        if (drawPolylineRef.current) {
          drawPolylineRef.current.setLatLngs(drawPointsRef.current);
        } else {
          drawPolylineRef.current = L.polyline(drawPointsRef.current, { color: "#ef4444", weight: 2, dashArray: "6 3" }).addTo(map);
        }
      };

      const onDblClick = () => {
        if (drawPointsRef.current.length >= 3) {
          onGeofenceDrawn([...drawPointsRef.current]);
        }
        if (drawPolylineRef.current) { map.removeLayer(drawPolylineRef.current); drawPolylineRef.current = null; }
        map.getContainer().style.cursor = "";
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
      };

      map.on("click", onClick);
      map.on("dblclick", onDblClick);

      return () => {
        map.off("click", onClick);
        map.off("dblclick", onDblClick);
        map.getContainer().style.cursor = "";
        if (drawPolylineRef.current) { map.removeLayer(drawPolylineRef.current); drawPolylineRef.current = null; }
      };
    }
  }, [drawingGeofence, onGeofenceDrawn]);

  // Update markers and route lines
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const currentIds = new Set(items.map(i => i.id));

    // Remove old markers
    markersRef.current.forEach((marker, id) => {
      if (!currentIds.has(id)) { map.removeLayer(marker); markersRef.current.delete(id); }
    });
    linesRef.current.forEach((line, id) => {
      if (!currentIds.has(id)) { map.removeLayer(line); linesRef.current.delete(id); }
    });

    // Update/add markers
    items.forEach(item => {
      const lat = item.data?.lat;
      const lon = item.data?.lon;
      if (!lat || !lon) return;

      const color = LAYER_COLORS[item.type] || "#64748b";
      const isSelected = selectedItem === item.id;

      if (markersRef.current.has(item.id)) {
        const marker = markersRef.current.get(item.id)!;
        marker.setLatLng([lat, lon]);
        marker.setStyle({ radius: isSelected ? 8 : 5, weight: isSelected ? 3 : 2, fillOpacity: isSelected ? 1 : 0.8 });
      } else {
        const marker = L.circleMarker([lat, lon], {
          radius: isSelected ? 8 : 5,
          color: color,
          fillColor: color,
          fillOpacity: isSelected ? 1 : 0.8,
          weight: isSelected ? 3 : 2,
        }).addTo(map);
        marker.on("click", () => onSelectItem(item.id));
        marker.bindTooltip(item.label, { permanent: false, direction: "top", className: "svm-tooltip" });
        markersRef.current.set(item.id, marker);
      }

      // Draw route lines for aircraft
      if (item.type === "aircraft" && item.data.origin_lat && item.data.dest_lat) {
        const routeCoords: [number, number][] = [
          [item.data.origin_lat, item.data.origin_lon],
          [lat, lon],
          [item.data.dest_lat, item.data.dest_lon],
        ];
        if (linesRef.current.has(item.id)) {
          linesRef.current.get(item.id)!.setLatLngs(routeCoords);
        } else {
          const line = L.polyline(routeCoords, { color, weight: 1.5, opacity: 0.5, dashArray: "8 4" }).addTo(map);
          linesRef.current.set(item.id, line);
        }
      }

      // Predictive routing - ghost markers for aircraft and vessels
      if ((item.type === "aircraft" || item.type === "vessel") && item.data.heading && (item.data.velocity || item.data.speed)) {
        const speed = item.data.velocity || item.data.speed || 0;
        const heading = item.data.heading || item.data.course || 0;
        const predictions = calculatePredictedPositions(lat, lon, heading, speed);
        const predKey = `${item.id}-pred`;

        // Remove old prediction markers
        Array.from(markersRef.current.entries()).forEach(([key, marker]) => {
          if (key.startsWith(predKey)) { map.removeLayer(marker); markersRef.current.delete(key); }
        });
        // Remove old prediction line
        if (linesRef.current.has(predKey)) {
          map.removeLayer(linesRef.current.get(predKey)!); linesRef.current.delete(predKey);
        }

        if (predictions.length > 0) {
          // Draw predicted path line
          const predCoords: [number, number][] = [[lat, lon], ...predictions.map(p => [p.lat, p.lon] as [number, number])];
          const predLine = L.polyline(predCoords, { color, weight: 1, opacity: 0.3, dashArray: "3 6" }).addTo(map);
          linesRef.current.set(predKey, predLine);

          // Draw ghost markers at predicted positions
          predictions.forEach((pred, idx) => {
            const ghostMarker = L.circleMarker([pred.lat, pred.lon], {
              radius: 3,
              color: color,
              fillColor: color,
              fillOpacity: 0.2 + (idx * 0.05),
              weight: 1,
              opacity: 0.4,
            }).addTo(map);
            ghostMarker.bindTooltip(`${item.label} ${pred.label}`, { permanent: false, direction: "top" });
            markersRef.current.set(`${predKey}-${idx}`, ghostMarker);
          });
        }
      }
    });

    // Fit bounds to show all items
    const validItems = items.filter(i => i.data?.lat && i.data?.lon);
    if (validItems.length > 0) {
      const bounds = L.latLngBounds(validItems.map(i => [i.data.lat, i.data.lon]));
      map.fitBounds(bounds.pad(0.3), { animate: true, maxZoom: 10 });
    }
  }, [items, selectedItem]);

  // Draw geofence polygons
  useEffect(() => {
    const layer = geofenceLayerRef.current;
    if (!layer) return;
    layer.clearLayers();

    geoAlerts.forEach(alert => {
      if (alert.polygon.length < 3) return;
      const polygon = L.polygon(alert.polygon as any, {
        color: alert.active ? "#ef4444" : "#64748b",
        fillColor: alert.active ? "#ef444420" : "#64748b10",
        weight: 2,
        dashArray: alert.active ? "" : "6 3",
      });
      polygon.bindTooltip(alert.name, { permanent: true, direction: "center", className: "svm-geofence-label" });
      layer.addLayer(polygon);
    });
  }, [geoAlerts]);

  return (
    <div className="flex-1 relative">
      <div ref={mapContainerRef} className="w-full h-full" />
      {drawingGeofence && (
        <div className="absolute top-2 left-2 right-2 z-[1000] bg-red-500/90 text-white text-[9px] font-mono text-center py-1.5 rounded">
          CLICK TO DRAW GEOFENCE POLYGON • DOUBLE-CLICK TO FINISH (MIN 3 POINTS)
        </div>
      )}
    </div>
  );
}

// ─── Playback Panel ─────────────────────────────────────────────────────────
function PlaybackPanel({ playbackActive, playbackTime, playbackStart, playbackEnd, playbackSpeed, playbackProgress, onStart, onStop, onSetSpeed, onSeek }: {
  playbackActive: boolean;
  playbackTime: number;
  playbackStart: number;
  playbackEnd: number;
  playbackSpeed: number;
  playbackProgress: number;
  onStart: () => void;
  onStop: () => void;
  onSetSpeed: (speed: number) => void;
  onSeek: (pct: number) => void;
}) {
  const scrubberRef = useRef<HTMLDivElement>(null);

  const handleScrubberClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    onSeek(pct);
  };

  return (
    <div className="border-b border-border/50 bg-card/50 px-4 py-2">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <Clock size={12} className="text-amber-400" />
          <span className="text-[10px] font-mono font-bold text-amber-400 uppercase">HISTORICAL PLAYBACK</span>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1 ml-4">
          <button onClick={() => onSeek(0)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Reset">
            <SkipBack size={12} />
          </button>
          {playbackActive ? (
            <button onClick={onStop} className="p-1.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors" title="Pause">
              <Pause size={12} />
            </button>
          ) : (
            <button onClick={onStart} className="p-1.5 rounded bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors" title="Play">
              <Play size={12} />
            </button>
          )}
          <button onClick={() => onSeek(1)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="End">
            <SkipForward size={12} />
          </button>
        </div>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5 ml-2">
          {[1, 2, 5, 10].map(speed => (
            <button key={speed} onClick={() => onSetSpeed(speed)} className={`px-1.5 py-0.5 rounded text-[8px] font-mono transition-colors ${playbackSpeed === speed ? "bg-amber-500/30 text-amber-400 border border-amber-500/50" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"}`}>
              {speed}x
            </button>
          ))}
        </div>

        {/* Time display */}
        <div className="ml-4 text-[9px] font-mono text-amber-400/80">
          {new Date(playbackTime).toLocaleString()}
        </div>
      </div>

      {/* Scrubber */}
      <div ref={scrubberRef} className="mt-2 h-4 relative cursor-pointer group" onClick={handleScrubberClick}>
        <div className="absolute top-1.5 left-0 right-0 h-1.5 bg-muted/30 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400 rounded-full transition-all" style={{ width: `${playbackProgress}%` }} />
        </div>
        {/* Thumb */}
        <div className="absolute top-0.5 w-3 h-3 bg-amber-400 rounded-full border-2 border-background shadow-lg transition-all" style={{ left: `calc(${playbackProgress}% - 6px)` }} />
        {/* Time labels */}
        <div className="absolute -bottom-3 left-0 text-[7px] font-mono text-muted-foreground">{new Date(playbackStart).toLocaleTimeString()}</div>
        <div className="absolute -bottom-3 right-0 text-[7px] font-mono text-muted-foreground">{new Date(playbackEnd).toLocaleTimeString()}</div>
      </div>
    </div>
  );
}

// ─── Alerts Panel ───────────────────────────────────────────────────────────
function AlertsPanel({ geoAlerts, alertEvents, trackedItems, onDeleteAlert, onToggleAlert, onStartDrawing, onCreateAlert, newAlertName, setNewAlertName, newAlertType, setNewAlertType, onClearEvents }: {
  geoAlerts: GeoAlert[];
  alertEvents: AlertEvent[];
  trackedItems: TrackedItem[];
  onDeleteAlert: (id: string) => void;
  onToggleAlert: (id: string) => void;
  onStartDrawing: () => void;
  onCreateAlert: (name: string, type: "enter" | "exit" | "deviate", targetIds: string[]) => void;
  newAlertName: string;
  setNewAlertName: (v: string) => void;
  newAlertType: "enter" | "exit" | "deviate";
  setNewAlertType: (v: "enter" | "exit" | "deviate") => void;
  onClearEvents: () => void;
}) {
  const [selectedTargets, setSelectedTargets] = useState<string[]>([]);

  return (
    <div className="flex-1 overflow-auto p-3 space-y-3">
      {/* Create Alert Section */}
      <div className="border border-red-500/30 rounded-lg p-3 bg-red-500/5">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={12} className="text-red-400" />
          <span className="text-[10px] font-mono font-bold text-red-400 uppercase">CREATE GEOFENCE ALERT</span>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-2">
          <input
            type="text"
            value={newAlertName}
            onChange={(e) => setNewAlertName(e.target.value)}
            placeholder="Alert name..."
            className="bg-muted/30 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-red-500/50"
          />
          <select
            value={newAlertType}
            onChange={(e) => setNewAlertType(e.target.value as any)}
            className="bg-muted/30 border border-border/50 rounded px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:border-red-500/50"
          >
            <option value="enter">ENTER ZONE</option>
            <option value="exit">EXIT ZONE</option>
            <option value="deviate">ROUTE DEVIATION</option>
          </select>
        </div>

        {/* Target selection */}
        <div className="mb-2">
          <span className="text-[8px] font-mono text-muted-foreground block mb-1">TARGETS (empty = all tracked items):</span>
          <div className="flex flex-wrap gap-1">
            {trackedItems.map(item => (
              <button
                key={item.id}
                onClick={() => setSelectedTargets(prev => prev.includes(item.id) ? prev.filter(id => id !== item.id) : [...prev, item.id])}
                className={`px-1.5 py-0.5 rounded text-[8px] font-mono border transition-colors ${selectedTargets.includes(item.id) ? "border-red-500/60 bg-red-500/20 text-red-400" : "border-border/30 text-muted-foreground hover:border-red-500/30"}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={onStartDrawing} className="flex-1 px-3 py-1.5 bg-red-500/20 border border-red-500/40 rounded text-red-400 text-[9px] font-mono hover:bg-red-500/30 transition-colors">
            <Hexagon size={10} className="inline mr-1.5" />DRAW GEOFENCE ON MAP
          </button>
          <button
            onClick={() => { onCreateAlert(newAlertName, newAlertType, selectedTargets); setNewAlertName(""); setSelectedTargets([]); }}
            className="px-3 py-1.5 bg-green-500/20 border border-green-500/40 rounded text-green-400 text-[9px] font-mono hover:bg-green-500/30 transition-colors"
          >
            CREATE
          </button>
        </div>
      </div>

      {/* Active Geofences */}
      {geoAlerts.length > 0 && (
        <div className="border border-border/30 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono font-bold text-foreground/80 uppercase">ACTIVE GEOFENCES ({geoAlerts.length})</span>
          </div>
          <div className="space-y-1.5">
            {geoAlerts.map(alert => (
              <div key={alert.id} className="flex items-center gap-2 p-1.5 rounded bg-muted/20 border border-border/20">
                <button onClick={() => onToggleAlert(alert.id)} className={`w-2 h-2 rounded-full ${alert.active ? "bg-green-400" : "bg-muted-foreground/30"}`} title={alert.active ? "Active" : "Inactive"} />
                <span className="text-[9px] font-mono text-foreground/80 flex-1">{alert.name}</span>
                <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded ${alert.type === "enter" ? "bg-amber-500/20 text-amber-400" : alert.type === "exit" ? "bg-blue-500/20 text-blue-400" : "bg-purple-500/20 text-purple-400"}`}>
                  {alert.type.toUpperCase()}
                </span>
                <button onClick={() => onDeleteAlert(alert.id)} className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors">
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alert Events Log */}
      <div className="border border-border/30 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={10} className="text-amber-400" />
            <span className="text-[9px] font-mono font-bold text-foreground/80 uppercase">ALERT LOG ({alertEvents.length})</span>
          </div>
          {alertEvents.length > 0 && (
            <button onClick={onClearEvents} className="text-[8px] font-mono text-muted-foreground hover:text-red-400 transition-colors">CLEAR</button>
          )}
        </div>
        {alertEvents.length === 0 ? (
          <div className="text-center py-4">
            <Bell size={16} className="text-muted-foreground/30 mx-auto mb-1" />
            <span className="text-[9px] font-mono text-muted-foreground/50">No alerts triggered yet</span>
          </div>
        ) : (
          <div className="space-y-1 max-h-48 overflow-auto">
            {alertEvents.slice().reverse().map(event => (
              <div key={event.id} className="flex items-center gap-2 p-1.5 rounded bg-red-500/10 border border-red-500/20">
                <AlertTriangle size={9} className="text-red-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="text-[8px] font-mono text-red-400 block truncate">{event.targetLabel} → {event.alertName}</span>
                  <span className="text-[7px] font-mono text-muted-foreground">{new Date(event.timestamp).toLocaleTimeString()} • {event.type.toUpperCase()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Tracked Item Card ───────────────────────────────────────────────────────
function TrackedItemCard({ item, isSelected, onSelect, onRemove, onFullscreen, isLight, layoutMode }: {
  item: TrackedItem;
  isSelected: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onFullscreen: () => void;
  isLight: boolean;
  layoutMode: "grid" | "list";
}) {
  const color = LAYER_COLORS[item.type] || "#64748b";

  return (
    <div
      className={`relative rounded-lg border overflow-hidden transition-all cursor-pointer ${isSelected ? "ring-2" : "hover:border-foreground/20"} ${layoutMode === "list" ? "flex items-stretch h-40" : "flex flex-col"}`}
      style={{
        borderColor: isSelected ? color : "oklch(from var(--border) l c h / 0.4)",
        "--tw-ring-color": color,
      } as React.CSSProperties}
      onClick={onSelect}
    >
      {/* Content area */}
      <div className={`${layoutMode === "list" ? "w-64 shrink-0" : "aspect-video"} relative bg-black/50`}>
        {item.type === "camera" && <CameraFeedWidget camera={item.data} />}
        {item.type === "aircraft" && <AircraftWidget aircraft={item.data} isLight={isLight} />}
        {item.type === "vessel" && <VesselWidget vessel={item.data} isLight={isLight} />}
        {item.type === "quake" && <QuakeWidget quake={item.data} />}
      </div>

      {/* Info bar */}
      <div className="flex items-center justify-between px-2 py-1.5 bg-card/90 border-t border-border/30 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          {item.type === "aircraft" && <Plane size={10} style={{ color }} />}
          {item.type === "vessel" && <Ship size={10} style={{ color }} />}
          {item.type === "camera" && <Camera size={10} style={{ color }} />}
          {item.type === "quake" && <Activity size={10} style={{ color }} />}
          <span className="text-[10px] font-mono font-bold truncate" style={{ color }}>{item.label}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={(e) => { e.stopPropagation(); onFullscreen(); }} className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Fullscreen">
            <Maximize2 size={10} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onRemove(); }} className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors" title="Remove">
            <X size={10} />
          </button>
        </div>
      </div>

      {/* Live indicator */}
      <div className="absolute top-1.5 left-1.5 flex items-center gap-1 bg-black/70 px-1.5 py-0.5 rounded">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
        <span className="text-[8px] font-mono text-white/80 uppercase">LIVE</span>
      </div>
    </div>
  );
}

// ─── Camera Feed Widget ──────────────────────────────────────────────────────
function CameraFeedWidget({ camera }: { camera: any }) {
  const [activeBuffer, setActiveBuffer] = useState(0);
  const [bufferUrls, setBufferUrls] = useState(['', '']);
  const [frameCount, setFrameCount] = useState(0);
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const frameRef = useRef(0);
  const fpsCountRef = useRef(0);
  const fpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isIframeStream = !!(camera.streamUrl && camera.streamType === 'iframe');
  const isMjpeg = !isIframeStream && (camera.feedUrl?.includes("mjpg") || camera.feedUrl?.includes("mjpeg") || camera.type === "stream" || camera.streamType === 'mjpeg' || camera.feedMode === 'live');

  // FPS counter
  useEffect(() => {
    fpsTimerRef.current = setInterval(() => {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
    }, 1000);
    return () => { if (fpsTimerRef.current) clearInterval(fpsTimerRef.current); };
  }, []);

  // Double-buffer frame loading
  useEffect(() => {
    if (isIframeStream || !camera.feedUrl) return;
    const loadFrame = () => {
      const start = Date.now();
      const url = isMjpeg
        ? `/api/mjpeg-frame?url=${encodeURIComponent(camera.streamUrl || camera.feedUrl)}&t=${Date.now()}`
        : `/api/trpc/sigint.proxyCCTVImage?input=${encodeURIComponent(JSON.stringify({ url: camera.feedUrl + (camera.feedUrl.includes('?') ? '&' : '?') + 'nocache=' + Date.now() }))}`;
      const img = document.createElement('img');
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setLatency(Date.now() - start);
        fpsCountRef.current++;
        setFrameCount(prev => prev + 1);
        const nextBuffer = frameRef.current % 2 === 0 ? 1 : 0;
        setBufferUrls(prev => { const next = [...prev]; next[nextBuffer] = img.src; return next; });
        setTimeout(() => setActiveBuffer(nextBuffer), 50);
        frameRef.current++;
      };
      img.src = url;
    };
    loadFrame();
    const interval = setInterval(loadFrame, isMjpeg ? 2000 : 5000);
    return () => clearInterval(interval);
  }, [camera.feedUrl, camera.streamUrl, isMjpeg, isIframeStream]);

  // IFRAME STREAM (YouTube / Windy embed) — truly live video
  if (isIframeStream) {
    return (
      <div className="w-full h-full relative bg-black">
        <iframe
          src={camera.streamUrl}
          className="w-full h-full border-0"
          allow="autoplay; encrypted-media; picture-in-picture"
          allowFullScreen
          title={camera.name}
        />
        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between z-10">
          <div className="bg-black/70 px-1 py-0.5 rounded flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="text-[7px] font-mono text-red-400">LIVE VIDEO</span>
          </div>
        </div>
      </div>
    );
  }

  // Double-buffer display for MJPEG and periodic feeds
  if (bufferUrls[0] || bufferUrls[1]) {
    return (
      <div className="w-full h-full relative bg-black">
        {bufferUrls[0] && <img src={bufferUrls[0]} alt={camera.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeBuffer === 0 ? 'opacity-100' : 'opacity-0'}`} />}
        {bufferUrls[1] && <img src={bufferUrls[1]} alt={camera.name} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeBuffer === 1 ? 'opacity-100' : 'opacity-0'}`} />}
        {/* Quality indicators overlay */}
        <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between z-10">
          <div className="flex items-center gap-1">
            <div className="bg-black/80 px-1 py-0.5 rounded flex items-center gap-0.5">
              <span className="text-[6px] font-mono text-cyan-400">FPS</span>
              <span className="text-[7px] font-mono text-white font-bold">{fps}</span>
            </div>
            <div className="bg-black/80 px-1 py-0.5 rounded flex items-center gap-0.5">
              <span className="text-[6px] font-mono text-amber-400">LAT</span>
              <span className="text-[7px] font-mono text-white font-bold">{latency}ms</span>
            </div>
          </div>
          <div className="bg-black/80 px-1 py-0.5 rounded flex items-center gap-0.5">
            <span className="text-[6px] font-mono text-emerald-400">F</span>
            <span className="text-[7px] font-mono text-white font-bold">{frameCount}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex items-center justify-center bg-black/80">
      <div className="text-center">
        <Camera size={20} className="text-purple-400/50 mx-auto mb-1" />
        <span className="text-[8px] font-mono text-muted-foreground">CONNECTING...</span>
        <div className="mt-1 w-3 h-3 border border-purple-400 border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    </div>
  );
}

// ─── Aircraft Widget ─────────────────────────────────────────────────────────
function AircraftWidget({ aircraft, isLight }: { aircraft: any; isLight: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const routeRef = useRef<L.Polyline | null>(null);
  const predLineRef = useRef<L.Polyline | null>(null);
  const predMarkersRef = useRef<L.CircleMarker[]>([]);

  const eta = useMemo(() => {
    if (!aircraft.lat || !aircraft.dest_lat || !aircraft.velocity) return null;
    return calculateETA(aircraft.lat, aircraft.lon, aircraft.dest_lat, aircraft.dest_lon, aircraft.velocity);
  }, [aircraft.lat, aircraft.lon, aircraft.dest_lat, aircraft.dest_lon, aircraft.velocity]);

  const distRemaining = useMemo(() => {
    if (!aircraft.lat || !aircraft.dest_lat) return null;
    return getDistanceRemaining(aircraft.lat, aircraft.lon, aircraft.dest_lat, aircraft.dest_lon);
  }, [aircraft.lat, aircraft.lon, aircraft.dest_lat, aircraft.dest_lon]);

  const predictions = useMemo(() => {
    if (!aircraft.lat || !aircraft.heading || !aircraft.velocity) return [];
    return calculatePredictedPositions(aircraft.lat, aircraft.lon, aircraft.heading, aircraft.velocity);
  }, [aircraft.lat, aircraft.lon, aircraft.heading, aircraft.velocity]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [aircraft.lat || 0, aircraft.lon || 0],
      zoom: 6,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer(isLight ? LIGHT_TILE : DARK_TILE, { maxZoom: 18 }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !aircraft.lat || !aircraft.lon) return;
    const pos: L.LatLngExpression = [aircraft.lat, aircraft.lon];

    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:#06b6d4;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #06b6d4;"></div>`,
        className: "", iconSize: [12, 12], iconAnchor: [6, 6],
      });
      markerRef.current = L.marker(pos, { icon }).addTo(map);
    }

    // Route line (origin -> current -> destination)
    if (aircraft.origin_lat && aircraft.dest_lat && !routeRef.current) {
      routeRef.current = L.polyline(
        [[aircraft.origin_lat, aircraft.origin_lon], pos, [aircraft.dest_lat, aircraft.dest_lon]],
        { color: "#06b6d4", weight: 2, opacity: 0.6, dashArray: "8 4" }
      ).addTo(map);
    } else if (routeRef.current && aircraft.origin_lat) {
      routeRef.current.setLatLngs([[aircraft.origin_lat, aircraft.origin_lon], pos, [aircraft.dest_lat || aircraft.lat, aircraft.dest_lon || aircraft.lon]]);
    }

    // Predictive path + ghost markers
    predMarkersRef.current.forEach(m => map.removeLayer(m));
    predMarkersRef.current = [];
    if (predLineRef.current) { map.removeLayer(predLineRef.current); predLineRef.current = null; }

    if (predictions.length > 0) {
      const predCoords: [number, number][] = [[aircraft.lat, aircraft.lon], ...predictions.map(p => [p.lat, p.lon] as [number, number])];
      predLineRef.current = L.polyline(predCoords, { color: "#fbbf24", weight: 1.5, opacity: 0.4, dashArray: "4 8" }).addTo(map);
      predictions.forEach((pred, idx) => {
        const ghost = L.circleMarker([pred.lat, pred.lon], {
          radius: 4, color: "#fbbf24", fillColor: "#fbbf24",
          fillOpacity: 0.2 + idx * 0.1, weight: 1, opacity: 0.5,
        }).addTo(map);
        ghost.bindTooltip(pred.label, { permanent: true, direction: "right", className: "pred-tooltip" });
        predMarkersRef.current.push(ghost);
      });
    }

    map.panTo(pos, { animate: true, duration: 1 });
  }, [aircraft.lat, aircraft.lon, predictions]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      {/* Bottom info bar */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
        <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-cyan-400">
          {aircraft.callsign || aircraft.icao24} • FL{Math.round((aircraft.altitude || 0) / 30.48)} • {Math.round(aircraft.velocity || 0)}kts
        </div>
        {eta && (
          <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-green-400 animate-pulse">
            ETA {eta.etaString} • {distRemaining}
          </div>
        )}
      </div>
      {/* Top info */}
      <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
        {aircraft.heading ? (
          <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-cyan-400">
            HDG {Math.round(aircraft.heading)}°
          </div>
        ) : <span />}
        {predictions.length > 0 && (
          <div className="bg-yellow-900/80 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-yellow-400">
            PRED • {predictions.length} PTS
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Vessel Widget (with AIS History Trail) ─────────────────────────────────
function VesselWidget({ vessel, isLight }: { vessel: any; isLight: boolean }) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const trailRef = useRef<L.Polyline | null>(null);
  const historyTrailRef = useRef<L.Polyline | null>(null);
  const historyMarkersRef = useRef<L.CircleMarker[]>([]);
  const predLineRef = useRef<L.Polyline | null>(null);
  const predMarkersRef = useRef<L.CircleMarker[]>([]);
  const posHistoryRef = useRef<[number, number][]>([]);

  // Fetch AIS history trail (24h)
  const historyQuery = trpc.sigint.getVesselHistory.useQuery(
    { mmsi: vessel.mmsi || "" },
    { enabled: !!vessel.mmsi, staleTime: 5 * 60 * 1000, refetchInterval: 5 * 60 * 1000 }
  );

  const predictions = useMemo(() => {
    const heading = vessel.heading || vessel.course;
    const speed = vessel.speed;
    if (!vessel.lat || !heading || !speed) return [];
    return calculatePredictedPositions(vessel.lat, vessel.lon, heading, speed);
  }, [vessel.lat, vessel.lon, vessel.heading, vessel.course, vessel.speed]);

  const eta = useMemo(() => {
    if (!vessel.lat || !vessel.dest_lat || !vessel.speed) return null;
    return calculateETA(vessel.lat, vessel.lon, vessel.dest_lat, vessel.dest_lon, vessel.speed);
  }, [vessel.lat, vessel.lon, vessel.dest_lat, vessel.dest_lon, vessel.speed]);

  const distRemaining = useMemo(() => {
    if (!vessel.lat || !vessel.dest_lat) return null;
    return getDistanceRemaining(vessel.lat, vessel.lon, vessel.dest_lat, vessel.dest_lon);
  }, [vessel.lat, vessel.lon, vessel.dest_lat, vessel.dest_lon]);

  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const map = L.map(mapRef.current, {
      center: [vessel.lat || 0, vessel.lon || 0],
      zoom: 8,
      zoomControl: false,
      attributionControl: false,
    });
    L.tileLayer(isLight ? LIGHT_TILE : DARK_TILE, { maxZoom: 18 }).addTo(map);
    mapInstanceRef.current = map;
    return () => { map.remove(); mapInstanceRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !vessel.lat || !vessel.lon) return;
    const pos: L.LatLngExpression = [vessel.lat, vessel.lon];

    const lastPos = posHistoryRef.current[posHistoryRef.current.length - 1];
    if (!lastPos || lastPos[0] !== vessel.lat || lastPos[1] !== vessel.lon) {
      posHistoryRef.current.push([vessel.lat, vessel.lon]);
      if (posHistoryRef.current.length > 50) posHistoryRef.current.shift();
    }

    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      const icon = L.divIcon({
        html: `<div style="width:12px;height:12px;background:#3b82f6;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px #3b82f6;"></div>`,
        className: "", iconSize: [12, 12], iconAnchor: [6, 6],
      });
      markerRef.current = L.marker(pos, { icon }).addTo(map);
    }

    // Position trail (real-time)
    if (posHistoryRef.current.length > 1) {
      if (trailRef.current) {
        trailRef.current.setLatLngs(posHistoryRef.current);
      } else {
        trailRef.current = L.polyline(posHistoryRef.current, {
          color: "#3b82f6", weight: 2, opacity: 0.5, dashArray: "4 4"
        }).addTo(map);
      }
    }

    // Predictive path + ghost markers
    predMarkersRef.current.forEach(m => map.removeLayer(m));
    predMarkersRef.current = [];
    if (predLineRef.current) { map.removeLayer(predLineRef.current); predLineRef.current = null; }

    if (predictions.length > 0) {
      const predCoords: [number, number][] = [[vessel.lat, vessel.lon], ...predictions.map(p => [p.lat, p.lon] as [number, number])];
      predLineRef.current = L.polyline(predCoords, { color: "#fbbf24", weight: 1.5, opacity: 0.4, dashArray: "4 8" }).addTo(map);
      predictions.forEach((pred, idx) => {
        const ghost = L.circleMarker([pred.lat, pred.lon], {
          radius: 4, color: "#fbbf24", fillColor: "#fbbf24",
          fillOpacity: 0.2 + idx * 0.1, weight: 1, opacity: 0.5,
        }).addTo(map);
        ghost.bindTooltip(pred.label, { permanent: true, direction: "right", className: "pred-tooltip" });
        predMarkersRef.current.push(ghost);
      });
    }

    map.panTo(pos, { animate: true, duration: 1 });
  }, [vessel.lat, vessel.lon, predictions]);

  // Render AIS history trail with speed-based color coding
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !historyQuery.data?.positions?.length) return;

    // Clear old history trail
    if (historyTrailRef.current) { map.removeLayer(historyTrailRef.current); historyTrailRef.current = null; }
    historyMarkersRef.current.forEach(m => map.removeLayer(m));
    historyMarkersRef.current = [];

    const positions = historyQuery.data.positions;
    if (positions.length < 2) return;

    // Draw speed-colored segments — each segment colored by the speed at that point
    // Group consecutive positions by speed category for smoother rendering
    let segStart = 0;
    for (let i = 1; i <= positions.length; i++) {
      const prevColor = getSpeedColor(positions[i - 1]?.sog || 0);
      const currColor = i < positions.length ? getSpeedColor(positions[i]?.sog || 0) : null;

      // When color changes or we reach the end, draw the segment
      if (currColor !== prevColor || i === positions.length) {
        const segPositions = positions.slice(segStart, i + (i < positions.length ? 1 : 0));
        const segCoords: [number, number][] = segPositions.map((p: any) => [p.lat, p.lon] as [number, number]);
        if (segCoords.length >= 2) {
          const progress = segStart / positions.length;
          const opacity = 0.4 + progress * 0.5;
          const segLine = L.polyline(segCoords, {
            color: prevColor,
            weight: 3,
            opacity,
            lineCap: "round",
            lineJoin: "round",
          }).addTo(map);
          historyMarkersRef.current.push(segLine as any);
        }
        segStart = i;
      }
    }

    // Add breadcrumb dots at intervals with speed-based colors
    const step = Math.max(1, Math.floor(positions.length / 24));
    for (let i = 0; i < positions.length; i += step) {
      const p = positions[i];
      const progress = i / positions.length;
      const opacity = 0.3 + progress * 0.6;
      const radius = 2 + progress * 2;
      const dotColor = getSpeedColor(p.sog || 0);

      const dot = L.circleMarker([p.lat, p.lon], {
        radius,
        color: dotColor,
        fillColor: dotColor,
        fillOpacity: opacity,
        weight: 1,
        opacity: opacity,
      }).addTo(map);

      const time = new Date(p.timestamp);
      const timeStr = time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      const dateStr = time.toLocaleDateString([], { month: "short", day: "numeric" });
      const speedLabel = getSpeedLabel(p.sog || 0);
      dot.bindTooltip(
        `${dateStr} ${timeStr}<br/>SOG: ${p.sog?.toFixed(1) || "?"}kts • ${speedLabel}<br/>COG: ${Math.round(p.cog || 0)}°`,
        { permanent: false, direction: "top", className: "ais-history-tooltip" }
      );

      historyMarkersRef.current.push(dot);
    }
  }, [historyQuery.data]);

  return (
    <div className="w-full h-full relative">
      <div ref={mapRef} className="w-full h-full" />
      {/* Bottom info bar */}
      <div className="absolute bottom-1 left-1 right-1 flex items-center justify-between">
        <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-blue-400">
          {vessel.name || vessel.mmsi} • {vessel.speed?.toFixed(1) || "0.0"}kts • {vessel.shipType || "Unknown"}
        </div>
        {eta && (
          <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-green-400 animate-pulse">
            ETA {eta.etaString} • {distRemaining}
          </div>
        )}
      </div>
      {/* Top info */}
      <div className="absolute top-1 left-1 right-1 flex items-center justify-between">
        {(vessel.heading || vessel.course) ? (
          <div className="bg-black/80 px-1.5 py-0.5 rounded text-[8px] font-mono text-blue-400">
            COG {Math.round(vessel.heading || vessel.course || 0)}°
          </div>
        ) : <span />}
        <div className="flex items-center gap-1">
          {historyQuery.data && historyQuery.data.positions?.length > 0 && (
            <div className="bg-blue-900/80 border border-blue-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-blue-300">
              AIS 24h • {historyQuery.data.positions.length} pts
            </div>
          )}
          {predictions.length > 0 && (
            <div className="bg-yellow-900/80 border border-yellow-500/30 px-1.5 py-0.5 rounded text-[8px] font-mono text-yellow-400">
              PRED • {predictions.length} PTS
            </div>
          )}
        </div>
      </div>
      {/* Speed Legend */}
      {historyQuery.data && historyQuery.data.positions?.length > 0 && (
        <div className="absolute bottom-8 right-1 z-10 bg-black/85 backdrop-blur-sm rounded px-1.5 py-1 border border-border/30">
          <div className="text-[7px] font-mono text-muted-foreground mb-0.5 uppercase">SPEED</div>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <span className="w-3 h-[3px] rounded-full bg-[#22c55e]" />
              <span className="text-[7px] font-mono text-green-400">&gt;8kts</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-[3px] rounded-full bg-[#eab308]" />
              <span className="text-[7px] font-mono text-yellow-400">3-8kts</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-3 h-[3px] rounded-full bg-[#ef4444]" />
              <span className="text-[7px] font-mono text-red-400">&lt;3kts</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Quake Widget ────────────────────────────────────────────────────────────
function QuakeWidget({ quake }: { quake: any }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-red-950/50 to-black">
      <div className="text-center">
        <div className="text-3xl font-mono font-black text-red-400 mb-1">M{quake.magnitude?.toFixed(1)}</div>
        <div className="text-[9px] font-mono text-muted-foreground">{quake.place || "Unknown Location"}</div>
        <div className="text-[8px] font-mono text-red-400/60 mt-1">
          DEPTH: {quake.depth?.toFixed(1) || "?"}km
        </div>
      </div>
    </div>
  );
}

// ─── Fullscreen View ─────────────────────────────────────────────────────────
function FullscreenView({ item, onClose, isLight, allItems }: {
  item: TrackedItem;
  onClose: () => void;
  isLight: boolean;
  allItems: TrackedItem[];
}) {
  return (
    <div className="flex-1 flex flex-col relative">
      <div className="absolute top-2 left-2 right-2 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/80 px-3 py-1.5 rounded-lg backdrop-blur-sm">
          {item.type === "aircraft" && <Plane size={12} style={{ color: LAYER_COLORS.aircraft }} />}
          {item.type === "vessel" && <Ship size={12} style={{ color: LAYER_COLORS.vessel }} />}
          {item.type === "camera" && <Camera size={12} style={{ color: LAYER_COLORS.camera }} />}
          {item.type === "quake" && <Activity size={12} style={{ color: LAYER_COLORS.quake }} />}
          <span className="text-[11px] font-mono font-bold text-white">{item.label}</span>
          <span className="text-[9px] font-mono text-white/50 uppercase">{item.type}</span>
        </div>
        <button onClick={onClose} className="bg-black/80 p-2 rounded-lg backdrop-blur-sm hover:bg-black/90 transition-colors">
          <Minimize2 size={14} className="text-white" />
        </button>
      </div>

      <div className="flex-1">
        {item.type === "camera" && <CameraFeedWidget camera={item.data} />}
        {item.type === "aircraft" && <AircraftWidget aircraft={item.data} isLight={isLight} />}
        {item.type === "vessel" && <VesselWidget vessel={item.data} isLight={isLight} />}
        {item.type === "quake" && <QuakeWidget quake={item.data} />}
      </div>

      <div className="absolute bottom-2 left-2 right-2 z-50">
        <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-border/30">
          {item.type === "aircraft" && (
            <div className="grid grid-cols-5 gap-4 text-[9px] font-mono text-white/80">
              <div><span className="text-cyan-400/60 block">CALLSIGN</span>{item.data.callsign || "—"}</div>
              <div><span className="text-cyan-400/60 block">ICAO24</span>{item.data.icao24 || "—"}</div>
              <div><span className="text-cyan-400/60 block">ALTITUDE</span>{item.data.altitude ? `${Math.round(item.data.altitude)}m` : "—"}</div>
              <div><span className="text-cyan-400/60 block">SPEED</span>{item.data.velocity ? `${Math.round(item.data.velocity)}kts` : "—"}</div>
              <div><span className="text-cyan-400/60 block">HEADING</span>{item.data.heading ? `${Math.round(item.data.heading)}°` : "—"}</div>
            </div>
          )}
          {item.type === "vessel" && (
            <div className="grid grid-cols-5 gap-4 text-[9px] font-mono text-white/80">
              <div><span className="text-blue-400/60 block">NAME</span>{item.data.name || "—"}</div>
              <div><span className="text-blue-400/60 block">MMSI</span>{item.data.mmsi || "—"}</div>
              <div><span className="text-blue-400/60 block">TYPE</span>{item.data.shipType || "—"}</div>
              <div><span className="text-blue-400/60 block">SPEED</span>{item.data.speed ? `${item.data.speed.toFixed(1)}kts` : "—"}</div>
              <div><span className="text-blue-400/60 block">COURSE</span>{item.data.heading || item.data.course ? `${Math.round(item.data.heading || item.data.course)}°` : "—"}</div>
            </div>
          )}
          {item.type === "camera" && (
            <div className="grid grid-cols-4 gap-4 text-[9px] font-mono text-white/80">
              <div><span className="text-purple-400/60 block">NAME</span>{item.data.name || "—"}</div>
              <div><span className="text-purple-400/60 block">CITY</span>{item.data.city || "—"}</div>
              <div><span className="text-purple-400/60 block">COUNTRY</span>{item.data.countryName || "—"}</div>
              <div><span className="text-purple-400/60 block">TYPE</span>{item.data.type === "stream" ? "MJPEG LIVE" : "IMAGE (4s)"}</div>
            </div>
          )}
          {item.type === "quake" && (
            <div className="grid grid-cols-4 gap-4 text-[9px] font-mono text-white/80">
              <div><span className="text-red-400/60 block">MAGNITUDE</span>M{item.data.magnitude?.toFixed(1)}</div>
              <div><span className="text-red-400/60 block">DEPTH</span>{item.data.depth?.toFixed(1)}km</div>
              <div><span className="text-red-400/60 block">LOCATION</span>{item.data.place || "—"}</div>
              <div><span className="text-red-400/60 block">TIME</span>{item.data.time ? new Date(item.data.time).toLocaleString() : "—"}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
