import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createPortal } from "react-dom";
import { loadPrefs, type HeaderItem } from "../lib/headerPrefs";
import DisclaimerModal from "@/components/DisclaimerModal";
import SessionIndicator from "@/components/SessionIndicator";
import { useTheme } from "../contexts/ThemeContext";
import { UpgradeButton } from "@/components/UpgradeButton";
import { trpc } from "../lib/trpc";
import { useLiveStream } from "../hooks/useLiveStream";
import {
  Plane, Ship, Camera, Activity, Flame, Cloud, Zap,
  Eye, EyeOff, Sun, Moon, X, ExternalLink,
  Radio, Radar, Layers, Map as MapIcon, Globe2,
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp,
  AlertTriangle, Anchor, Navigation,
  RefreshCw, Info, MapPin, RotateCcw,   Maximize2, Minimize2,
  Search, Filter, Pentagon, Crosshair, Bell, Bot,
  ScanLine, Workflow, Shield, Database, Satellite,
  Target, Cpu, Network, Lock, Unlock,
} from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
// Canvas rendering replaces MarkerCluster for performance
import "leaflet-draw";
import "leaflet-draw/dist/leaflet.draw.css";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import * as topojson from "topojson-client";

// ─── Country Code Mapping ─────────────────────────────────────────────────────
const ISO_TO_COUNTRY: Record<string, string> = {
  AF:"Afghanistan",AL:"Albania",DZ:"Algeria",AD:"Andorra",AO:"Angola",AG:"Antigua and Barbuda",
  AR:"Argentina",AM:"Armenia",AU:"Australia",AT:"Austria",AZ:"Azerbaijan",BS:"Bahamas",
  BH:"Bahrain",BD:"Bangladesh",BB:"Barbados",BY:"Belarus",BE:"Belgium",BZ:"Belize",
  BJ:"Benin",BT:"Bhutan",BO:"Bolivia",BA:"Bosnia and Herzegovina",BW:"Botswana",BR:"Brazil",
  BN:"Brunei",BG:"Bulgaria",BF:"Burkina Faso",BI:"Burundi",KH:"Cambodia",CM:"Cameroon",
  CA:"Canada",CV:"Cape Verde",CF:"Central African Republic",TD:"Chad",CL:"Chile",CN:"China",
  CO:"Colombia",KM:"Comoros",CG:"Congo",CD:"DR Congo",CR:"Costa Rica",CI:"Ivory Coast",
  HR:"Croatia",CU:"Cuba",CY:"Cyprus",CZ:"Czech Republic",DK:"Denmark",DJ:"Djibouti",
  DM:"Dominica",DO:"Dominican Republic",EC:"Ecuador",EG:"Egypt",SV:"El Salvador",
  GQ:"Equatorial Guinea",ER:"Eritrea",EE:"Estonia",SZ:"Eswatini",ET:"Ethiopia",FJ:"Fiji",
  FI:"Finland",FR:"France",GA:"Gabon",GM:"Gambia",GE:"Georgia",DE:"Germany",GH:"Ghana",
  GR:"Greece",GD:"Grenada",GT:"Guatemala",GN:"Guinea",GW:"Guinea-Bissau",GY:"Guyana",
  HT:"Haiti",HN:"Honduras",HU:"Hungary",IS:"Iceland",IN:"India",ID:"Indonesia",IR:"Iran",
  IQ:"Iraq",IE:"Ireland",IL:"Israel",IT:"Italy",JM:"Jamaica",JP:"Japan",JO:"Jordan",
  KZ:"Kazakhstan",KE:"Kenya",KI:"Kiribati",KP:"North Korea",KR:"South Korea",KW:"Kuwait",
  KG:"Kyrgyzstan",LA:"Laos",LV:"Latvia",LB:"Lebanon",LS:"Lesotho",LR:"Liberia",LY:"Libya",
  LI:"Liechtenstein",LT:"Lithuania",LU:"Luxembourg",MG:"Madagascar",MW:"Malawi",MY:"Malaysia",
  MV:"Maldives",ML:"Mali",MT:"Malta",MH:"Marshall Islands",MR:"Mauritania",MU:"Mauritius",
  MX:"Mexico",FM:"Micronesia",MD:"Moldova",MC:"Monaco",MN:"Mongolia",ME:"Montenegro",
  MA:"Morocco",MZ:"Mozambique",MM:"Myanmar",NA:"Namibia",NR:"Nauru",NP:"Nepal",NL:"Netherlands",
  NZ:"New Zealand",NI:"Nicaragua",NE:"Niger",NG:"Nigeria",NO:"Norway",OM:"Oman",PK:"Pakistan",
  PW:"Palau",PS:"Palestine",PA:"Panama",PG:"Papua New Guinea",PY:"Paraguay",PE:"Peru",
  PH:"Philippines",PL:"Poland",PT:"Portugal",QA:"Qatar",RO:"Romania",RU:"Russia",RW:"Rwanda",
  KN:"Saint Kitts and Nevis",LC:"Saint Lucia",VC:"Saint Vincent",WS:"Samoa",SM:"San Marino",
  ST:"Sao Tome and Principe",SA:"Saudi Arabia",SN:"Senegal",RS:"Serbia",SC:"Seychelles",
  SL:"Sierra Leone",SG:"Singapore",SK:"Slovakia",SI:"Slovenia",SB:"Solomon Islands",
  SO:"Somalia",ZA:"South Africa",SS:"South Sudan",ES:"Spain",LK:"Sri Lanka",SD:"Sudan",
  SR:"Suriname",SE:"Sweden",CH:"Switzerland",SY:"Syria",TW:"Taiwan",TJ:"Tajikistan",
  TZ:"Tanzania",TH:"Thailand",TL:"Timor-Leste",TG:"Togo",TO:"Tonga",TT:"Trinidad and Tobago",
  TN:"Tunisia",TR:"Turkey",TM:"Turkmenistan",TV:"Tuvalu",UG:"Uganda",UA:"Ukraine",
  AE:"United Arab Emirates",GB:"United Kingdom",US:"United States",UY:"Uruguay",UZ:"Uzbekistan",
  VU:"Vanuatu",VA:"Vatican City",VE:"Venezuela",VN:"Vietnam",YE:"Yemen",ZM:"Zambia",ZW:"Zimbabwe",
  HK:"Hong Kong",MO:"Macau",PR:"Puerto Rico",VI:"US Virgin Islands",GU:"Guam",
};
const COUNTRY_TO_ISO: Record<string, string> = Object.fromEntries(Object.entries(ISO_TO_COUNTRY).map(([k,v]) => [v.toLowerCase(), k]));
function normalizeCountry(val: string): string {
  if (!val) return "";
  const upper = val.toUpperCase();
  if (ISO_TO_COUNTRY[upper]) return ISO_TO_COUNTRY[upper];
  // Check if it's already a full name
  const lower = val.toLowerCase();
  if (COUNTRY_TO_ISO[lower]) return val; // already a valid name
  // Partial matches for OpenSky names like "Brunei Darussalam"
  for (const [code, name] of Object.entries(ISO_TO_COUNTRY)) {
    if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) return name;
  }
  return val; // return as-is if no match
}

// ─── Types ────────────────────────────────────────────────────────────────────
type ViewMode = "map" | "globe";
type LayerId = "aviation" | "maritime" | "cctv" | "seismic" | "fires" | "weather" | "space";
type DetailType = "aircraft" | "vessel" | "camera" | "quake" | "fire" | "weather" | null;

interface LayerConfig {
  id: LayerId;
  label: string;
  icon: any;
  color: string;
  refreshInterval: number;
  description: string;
  shortcut: string;
  subcategories?: { id: string; label: string; active: boolean }[];
}

const LAYERS: LayerConfig[] = [
  { id: "aviation", label: "AVIATION", icon: Plane, color: "#06b6d4", refreshInterval: 10000, description: "Live ADS-B aircraft tracking", shortcut: "1", subcategories: [
    { id: "commercial", label: "Commercial", active: true },
    { id: "military", label: "Military", active: true },
    { id: "private", label: "Private/GA", active: true },
    { id: "cargo", label: "Cargo", active: true },
    { id: "grounded", label: "On Ground", active: false },
  ]},
  { id: "maritime", label: "MARITIME", icon: Ship, color: "#3b82f6", refreshInterval: 20000, description: "Real-time AIS vessel positions", shortcut: "2", subcategories: [
    { id: "cargo", label: "Cargo", active: true },
    { id: "tanker", label: "Tanker", active: true },
    { id: "passenger", label: "Passenger", active: true },
    { id: "military", label: "Military/Govt", active: true },
    { id: "fishing", label: "Fishing", active: true },
    { id: "tug", label: "Tug/Pilot", active: true },
    { id: "pleasure", label: "Pleasure/Sail", active: true },
    { id: "other", label: "Other", active: true },
  ]},
  { id: "cctv", label: "CCTV / OSINT", icon: Camera, color: "#a855f7", refreshInterval: 0, description: "Open traffic & surveillance cameras", shortcut: "3", subcategories: [
    { id: "traffic", label: "Traffic Cams", active: true },
    { id: "city", label: "City Cams", active: true },
    { id: "port", label: "Port/Maritime", active: true },
    { id: "border", label: "Border Cams", active: true },
  ]},
  { id: "seismic", label: "SEISMIC", icon: Activity, color: "#ef4444", refreshInterval: 60000, description: "USGS earthquake monitoring", shortcut: "4", subcategories: [
    { id: "major", label: "M6.0+ Major", active: true },
    { id: "moderate", label: "M4.0-5.9", active: true },
    { id: "minor", label: "M2.0-3.9", active: true },
    { id: "micro", label: "M0-1.9 Micro", active: false },
  ]},
  { id: "fires", label: "FIRES", icon: Flame, color: "#f97316", refreshInterval: 300000, description: "NASA FIRMS active fire detection", shortcut: "5" },
  { id: "weather", label: "WEATHER", icon: Cloud, color: "#10b981", refreshInterval: 300000, description: "NASA EONET natural events", shortcut: "6" },
  { id: "space", label: "SPACE WX", icon: Zap, color: "#eab308", refreshInterval: 60000, description: "NOAA SWPC geomagnetic activity", shortcut: "7" },
];

const DARK_TILE = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const LIGHT_TILE = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

// Top bar menu items (simulated pages)
const TOP_MENU_ITEMS = [
  { id: "sigint", label: "SIGINT", icon: Radar, active: true, tooltip: "" },
  { id: "automate", label: "Automate", icon: Workflow, active: false, tooltip: "Build automated intelligence collection pipelines — schedule recurring scans, set up data fusion workflows, and automate OSINT collection across all layers" },
  { id: "intel", label: "Intel (CV)", icon: ScanLine, active: false, tooltip: "Computer Vision powered surveillance — scan all CCTV feeds for specific objects, vehicles, or persons of interest using open-source CV models (YOLO, CLIP)" },
  { id: "alert", label: "Alert", icon: Bell, active: false, tooltip: "Build alerting pipelines — get real-time notifications when specific geo-conditions are met (vessel enters zone, aircraft squawks 7700, earthquake >M5.0)" },
  { id: "fusion", label: "Fusion", icon: Network, active: false, tooltip: "Multi-source intelligence fusion — correlate signals across layers to identify patterns, anomalies, and threats using graph analysis" },
  { id: "classify", label: "Classify", icon: Shield, active: false, tooltip: "Automated threat classification — ML-powered categorization of entities by risk level, behavior patterns, and historical intelligence" },
  { id: "surveillance", label: "SVM", icon: Target, active: false, tooltip: "Surveillance Mode — track up to 10 items simultaneously across all layers with live feeds, animated routes, and real-time position updates" },
];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SigintPage() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === "light";

  // ─── Header prefs (DB-backed via tRPC, localStorage as fallback) ────────────
  const { data: dbSigintPrefs, isLoading: sigintPrefsLoading } = trpc.headerPrefs.getPrefs.useQuery(
    { page: "sigint" as const },
    { refetchOnWindowFocus: true, staleTime: 5000 }
  );
  const sigintPrefs: HeaderItem[] = useMemo(() => {
    if (dbSigintPrefs && Array.isArray(dbSigintPrefs) && dbSigintPrefs.length > 0) {
      return dbSigintPrefs as HeaderItem[];
    }
    if (sigintPrefsLoading) return [];
    return loadPrefs("sigint");
  }, [dbSigintPrefs, sigintPrefsLoading]);
  const sigintVisible = useCallback(
    (id: string) => sigintPrefs.find(p => p.id === id)?.visible ?? true,
    [sigintPrefs]
  );
  const sigintCustomToggles = useMemo(
    () => sigintPrefs.filter((p): p is HeaderItem & { isCustom: true } => !!(p as any).isCustom && p.visible),
    [sigintPrefs]
  );

  // ─── Persisted state helpers (survive SVM navigation) ───────────────────────
  const SIGINT_STATE_KEY = "sigint_page_state";
  const loadPersistedState = () => {
    try {
      const raw = sessionStorage.getItem(SIGINT_STATE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch { return null; }
  };
  const persistedState = loadPersistedState();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(persistedState?.viewMode || "map");
  const [activeLayers, setActiveLayers] = useState<Set<LayerId>>(() => {
    if (persistedState?.activeLayers) return new Set<LayerId>(persistedState.activeLayers);
    return new Set<LayerId>(["aviation", "maritime", "seismic"]);
  });
  const [sidebarOpen, setSidebarOpen] = useState(persistedState?.sidebarOpen ?? true);
  const [isLive, setIsLive] = useState(persistedState?.isLive ?? true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };
  const [expandedLayers, setExpandedLayers] = useState<Set<string>>(() =>
    persistedState?.expandedLayers ? new Set<string>(persistedState.expandedLayers) : new Set()
  );

  // Subcategory filters: layerId -> Set of active subcategory IDs
  const [subcategoryFilters, setSubcategoryFilters] = useState<Record<string, Set<string>>>(() => {
    if (persistedState?.subcategoryFilters) {
      const restored: Record<string, Set<string>> = {};
      for (const [k, v] of Object.entries(persistedState.subcategoryFilters)) {
        restored[k] = new Set(v as string[]);
      }
      return restored;
    }
    const initial: Record<string, Set<string>> = {};
    LAYERS.forEach(layer => {
      if (layer.subcategories) {
        initial[layer.id] = new Set(layer.subcategories.filter(s => s.active).map(s => s.id));
      }
    });
    return initial;
  });

  // Camera search filter
  const [cameraSearch, setCameraSearch] = useState(persistedState?.cameraSearch || "");
  const [cameraSearchFocused, setCameraSearchFocused] = useState(false);

  // Toggle a subcategory filter
  const toggleSubcategory = useCallback((layerId: string, subId: string) => {
    setSubcategoryFilters(prev => {
      const next = { ...prev };
      const set = new Set(next[layerId] || []);
      if (set.has(subId)) set.delete(subId);
      else set.add(subId);
      next[layerId] = set;
      return next;
    });
  }, []);

  // Expand view (decluster)
  const [expandView, setExpandView] = useState(persistedState?.expandView || false);

  // Auto-refresh with countdown
  const [refreshInterval, setRefreshInterval] = useState(persistedState?.refreshInterval || 60); // seconds
  const [countdown, setCountdown] = useState(persistedState?.refreshInterval || 60);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Country filter
  const [countryFilter, setCountryFilter] = useState<string | null>(persistedState?.countryFilter || null);
  const [countrySearch, setCountrySearch] = useState(persistedState?.countrySearch || "");
  const [showCountrySearch, setShowCountrySearch] = useState(false);
  const [polygonFilter, setPolygonFilter] = useState<L.LatLng[] | null>(() => {
    if (persistedState?.polygonFilter && Array.isArray(persistedState.polygonFilter)) {
      // Restore polygon as L.LatLng array from serialized {lat, lng} objects
      return persistedState.polygonFilter.map((p: { lat: number; lng: number }) => L.latLng(p.lat, p.lng));
    }
    return null;
  });
  const [drawMode, setDrawMode] = useState(false);

  // Persist state to sessionStorage whenever key state changes
  useEffect(() => {
    const subcatSerial: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(subcategoryFilters)) {
      subcatSerial[k] = Array.from(v);
    }
    const state = {
      viewMode,
      activeLayers: Array.from(activeLayers),
      sidebarOpen,
      isLive,
      expandedLayers: Array.from(expandedLayers),
      subcategoryFilters: subcatSerial,
      cameraSearch,
      expandView,
      refreshInterval,
      countryFilter,
      countrySearch,
      // Serialize polygon as plain {lat, lng} objects
      polygonFilter: polygonFilter ? polygonFilter.map(p => ({ lat: p.lat, lng: p.lng })) : null,
    };
    sessionStorage.setItem(SIGINT_STATE_KEY, JSON.stringify(state));
  }, [viewMode, activeLayers, sidebarOpen, isLive, expandedLayers, subcategoryFilters, cameraSearch, expandView, refreshInterval, countryFilter, countrySearch, polygonFilter]);

  // Detail panel state
  const [detailType, setDetailType] = useState<DetailType>(null);
  const [detailData, setDetailData] = useState<any>(null);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [isResizingPanel, setIsResizingPanel] = useState(false);
  const [expandedCamera, setExpandedCamera] = useState(false);
  const [showCctvDisclaimer, setShowCctvDisclaimer] = useState(false);

  // SVM tracked items count (reads from localStorage, updates reactively)
  const [svmCount, setSvmCount] = useState<number>(() => {
    try { const s = localStorage.getItem('svm_tracked_items'); return s ? JSON.parse(s).length : 0; } catch { return 0; }
  });
  // Refresh svmCount whenever localStorage changes (e.g. after adding an item)
  useEffect(() => {
    const syncSvmCount = () => {
      try { const s = localStorage.getItem('svm_tracked_items'); setSvmCount(s ? JSON.parse(s).length : 0); } catch { setSvmCount(0); }
    };
    window.addEventListener('storage', syncSvmCount);
    return () => window.removeEventListener('storage', syncSvmCount);
  }, []);

  // Pinned cameras for floating mini-player
  const [pinnedCameras, setPinnedCameras] = useState<any[]>([]);
  const pinCamera = useCallback((camera: any) => {
    setPinnedCameras(prev => {
      if (prev.find(c => c.id === camera.id || c.feedUrl === camera.feedUrl)) return prev;
      if (prev.length >= 4) return prev; // max 4 pinned
      return [...prev, camera];
    });
  }, []);
  const unpinCamera = useCallback((cameraId: string) => {
    setPinnedCameras(prev => prev.filter(c => (c.id || c.feedUrl) !== cameraId));
  }, []);

  // Camera density heatmap
  const [showHeatmap, setShowHeatmap] = useState(false);
  const heatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const heatmapContainerRef = useRef<HTMLDivElement | null>(null);

  // Aviation density heatmap
  const [showAvHeatmap, setShowAvHeatmap] = useState(false);
  const avHeatmapCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const avHeatmapContainerRef = useRef<HTMLDivElement | null>(null);

  // Aviation time-lapse snapshots: ring buffer of up to 30 frames
  type AvSnapshot = { ts: number; aircraft: any[] };
  const avSnapshotsRef = useRef<AvSnapshot[]>([]);
  const [timelapsePlaying, setTimelapsePlaying] = useState(false);
  const [timelapseFrame, setTimelapseFrame] = useState<number>(-1); // -1 = live
  const timelapseTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [showTimelapse, setShowTimelapse] = useState(false);

  // Top bar menu tooltip
  const [hoveredMenu, setHoveredMenu] = useState<string | null>(null);

  // Map refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.LayerGroup | any }>({});
  const routeLayerRef = useRef<L.LayerGroup | null>(null);
  const highlightLayerRef = useRef<L.LayerGroup | null>(null);
  const countryLayerRef = useRef<L.GeoJSON | null>(null);
  const drawLayerRef = useRef<L.FeatureGroup | null>(null);
  const drawControlRef = useRef<any>(null);

  // Globe refs
  const globeContainerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const globeMarkersRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number>(0);

  // Toggle layer
  const toggleLayer = useCallback((id: LayerId) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Toggle expanded layer
  const toggleExpanded = useCallback((id: string) => {
    setExpandedLayers(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Select item for detail panel
  const selectItem = useCallback((type: DetailType, data: any) => {
    setDetailType(type);
    setDetailData(data);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailType(null);
    setDetailData(null);
    if (routeLayerRef.current) routeLayerRef.current.clearLayers();
    if (highlightLayerRef.current) highlightLayerRef.current.clearLayers();
  }, []);

  // Resize handler for right panel
  useEffect(() => {
    if (!isResizingPanel) return;
    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(700, window.innerWidth - e.clientX));
      setRightPanelWidth(newWidth);
    };
    const handleMouseUp = () => setIsResizingPanel(false);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingPanel]);

  // Clear country filter
  const clearCountryFilter = useCallback(() => {
    setCountryFilter(null);
    setCountrySearch("");
    if (countryLayerRef.current) {
      countryLayerRef.current.resetStyle();
    }
  }, []);

  // Clear polygon filter
  const clearPolygonFilter = useCallback(() => {
    setPolygonFilter(null);
    if (drawLayerRef.current) drawLayerRef.current.clearLayers();
  }, []);

  // ─── Keyboard Shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const layerIndex = parseInt(e.key) - 1;
      if (layerIndex >= 0 && layerIndex < LAYERS.length) {
        toggleLayer(LAYERS[layerIndex].id);
        return;
      }
      if (e.key === "Escape") { closeDetail(); clearCountryFilter(); clearPolygonFilter(); }
      if (e.key === "m" || e.key === "M") setViewMode("map");
      if (e.key === "g" || e.key === "G") setViewMode("globe");
      if (e.key === "l" || e.key === "L") setIsLive((prev: boolean) => !prev);
      if (e.key === "s" || e.key === "S") setSidebarOpen((prev: boolean) => !prev);
      if (e.key === "f" || e.key === "F") setShowCountrySearch((prev: boolean) => !prev);
      if (e.key === "d" || e.key === "D") setDrawMode((prev: boolean) => !prev);
      if (e.key === "e" || e.key === "E") setExpandView((prev: boolean) => !prev);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [toggleLayer, closeDetail, clearCountryFilter, clearPolygonFilter]);

  // ─── Auto-Refresh Countdown Timer ───────────────────────────────────────────
  const trpcUtils = trpc.useUtils();
  useEffect(() => {
    if (!isLive) return;
    const timer = setInterval(() => {
      setCountdown((prev: number) => {
        if (prev <= 1) {
          // Trigger refresh of all active layers
          if (activeLayers.has("aviation")) trpcUtils.sigint.getAviationData.invalidate();
          if (activeLayers.has("maritime")) trpcUtils.sigint.getMaritimeData.invalidate();
          if (activeLayers.has("seismic")) trpcUtils.sigint.getSeismicData.invalidate();
          if (activeLayers.has("fires")) trpcUtils.sigint.getFireData.invalidate();
          if (activeLayers.has("weather")) trpcUtils.sigint.getWeatherEvents.invalidate();
          if (activeLayers.has("space")) trpcUtils.sigint.getSpaceWeather.invalidate();
          setLastRefreshTime(new Date());
          return refreshInterval;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isLive, refreshInterval, activeLayers, trpcUtils]);

  useEffect(() => {
    setCountdown(refreshInterval);
  }, [refreshInterval]);

  // ─── Data Queries ─────────────────────────────────────────────────────────
  // ─── SSE Live Streams (replaces polling for aviation/maritime) ────────────
  const aviationSSE = useLiveStream<any>("sigint:aviation", {
    enabled: activeLayers.has("aviation") && isLive,
    fallbackFetch: async () => {
      const result = await trpcUtils.sigint.getAviationData.fetch();
      return result;
    },
    fallbackInterval: refreshInterval * 1000,
  });
  const maritimeSSE = useLiveStream<any>("sigint:maritime", {
    enabled: activeLayers.has("maritime") && isLive,
    fallbackFetch: async () => {
      const result = await trpcUtils.sigint.getMaritimeData.fetch();
      return result;
    },
    fallbackInterval: refreshInterval * 1000,
  });
  // Wrap SSE data in query-like objects for backward compatibility
  const aviationQuery = {
    data: aviationSSE.data || trpc.sigint.getAviationData.useQuery(undefined, {
      enabled: activeLayers.has("aviation") && isLive && !aviationSSE.connected,
      staleTime: refreshInterval * 1000,
    }).data,
  };
  const maritimeQuery = {
    data: maritimeSSE.data || trpc.sigint.getMaritimeData.useQuery(undefined, {
      enabled: activeLayers.has("maritime") && isLive && !maritimeSSE.connected,
      staleTime: refreshInterval * 1000,
    }).data,
  };
  const cctvQuery = trpc.sigint.getCCTVCameras.useQuery(undefined, {
    enabled: activeLayers.has("cctv"),
    staleTime: 600000,
  });
  const seismicQuery = trpc.sigint.getSeismicData.useQuery({ period: "day" }, {
    enabled: activeLayers.has("seismic") && isLive,
    staleTime: refreshInterval * 1000,
  });
  const fireQuery = trpc.sigint.getFireData.useQuery(undefined, {
    enabled: activeLayers.has("fires") && isLive,
    staleTime: refreshInterval * 2000,
  });
  const weatherQuery = trpc.sigint.getWeatherEvents.useQuery(undefined, {
    enabled: activeLayers.has("weather") && isLive,
    staleTime: refreshInterval * 2000,
  });
  const spaceQuery = trpc.sigint.getSpaceWeather.useQuery(undefined, {
    enabled: activeLayers.has("space") && isLive,
    staleTime: refreshInterval * 1000,
  });

  // ─── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => ({
    aircraft: aviationQuery.data?.aircraft?.length || 0,
    aircraftTotal: aviationQuery.data?.total || aviationQuery.data?.aircraft?.length || 0,
    vessels: maritimeQuery.data?.vessels?.length || 0,
    vesselsTotal: maritimeQuery.data?.total || maritimeQuery.data?.vessels?.length || 0,
    cameras: cctvQuery.data?.total || 0,
    camerasLive: cctvQuery.data?.liveCount || 0,
    camerasPeriodic: cctvQuery.data?.periodicCount || 0,
    quakes: seismicQuery.data?.total || 0,
    fires: fireQuery.data?.total || 0,
    events: weatherQuery.data?.total || 0,
    kp: spaceQuery.data?.latestKp || 0,
  }), [aviationQuery.data, maritimeQuery.data, cctvQuery.data, seismicQuery.data, fireQuery.data, weatherQuery.data, spaceQuery.data]);

  // ─── Subcategory Counts (real-time from data) ─────────────────────────────
  const subcategoryCounts = useMemo(() => {
    const counts: Record<string, Record<string, number>> = { aviation: {}, maritime: {}, cctv: {}, seismic: {} };
    // Aviation counts
    const aircraft = aviationQuery.data?.aircraft || [];
    let milCount = 0, comCount = 0, cargoCount = 0, privCount = 0, groundCount = 0;
    for (const ac of aircraft) {
      const isMil = ac.category === 'MIL' || ac.category === 7 || ac.callsign?.match(/^(RCH|DUKE|EVAC|REACH|FORTE|JAKE)/);
      const isGround = ac.onGround;
      if (isMil) { milCount++; continue; }
      if (isGround) { groundCount++; continue; }
      const cs = ac.callsign || '';
      const isCargo = /^(FDX|UPS|GTI|CLX|ABW|MPH|BOX|CKS)/i.test(cs);
      const isPriv = cs.length <= 4 && !/^[A-Z]{3}/.test(cs);
      if (isCargo) cargoCount++;
      else if (isPriv) privCount++;
      else comCount++;
    }
    counts.aviation = { military: milCount, commercial: comCount, cargo: cargoCount, private: privCount, grounded: groundCount };
    // Maritime counts
    const vessels = maritimeQuery.data?.vessels || [];
    let cargoV = 0, tankerV = 0, passV = 0, milV = 0, fishV = 0, tugV = 0, pleasureV = 0, otherV = 0;
    for (const v of vessels) {
      const tl = (v.typeLabel || '').toLowerCase();
      if (tl.includes('cargo')) cargoV++;
      else if (tl.includes('tanker')) tankerV++;
      else if (tl.includes('passenger')) passV++;
      else if (tl.includes('special') || tl.includes('military') || tl.includes('govt') || tl.includes('law') || tl.includes('search')) milV++;
      else if (tl.includes('fishing')) fishV++;
      else if (tl.includes('tug') || tl.includes('pilot') || tl.includes('dredg')) tugV++;
      else if (tl.includes('pleasure') || tl.includes('sail') || tl.includes('yacht')) pleasureV++;
      else otherV++;
    }
    counts.maritime = { cargo: cargoV, tanker: tankerV, passenger: passV, military: milV, fishing: fishV, tug: tugV, pleasure: pleasureV, other: otherV };
    // CCTV counts
    const cameras = cctvQuery.data?.cameras || [];
    let trafficC = 0, cityC = 0, portC = 0, borderC = 0;
    for (const cam of cameras) {
      const src = (cam.source || '').toLowerCase();
      if (src.includes('511') || src.includes('dot') || src.includes('trip') || src.includes('traffic') || src.includes('digitraffic')) trafficC++;
      else if (src.includes('port') || src.includes('marine') || src.includes('harbor')) portC++;
      else if (src.includes('border') || src.includes('customs')) borderC++;
      else cityC++;
    }
    counts.cctv = { traffic: trafficC, city: cityC, port: portC, border: borderC };
    // Seismic counts
    const quakes = seismicQuery.data?.quakes || [];
    let majorQ = 0, modQ = 0, minorQ = 0, microQ = 0;
    for (const q of quakes) {
      const mag = q.magnitude || 0;
      if (mag >= 6) majorQ++;
      else if (mag >= 4) modQ++;
      else if (mag >= 2) minorQ++;
      else microQ++;
    }
    counts.seismic = { major: majorQ, moderate: modQ, minor: minorQ, micro: microQ };
    return counts;
  }, [aviationQuery.data, maritimeQuery.data, cctvQuery.data, seismicQuery.data]);

  // ─── Select All / Deselect All for a layer ────────────────────────────────
  const selectAllSubcategories = useCallback((layerId: string) => {
    const layer = LAYERS.find(l => l.id === layerId);
    if (!layer?.subcategories) return;
    setSubcategoryFilters(prev => ({
      ...prev,
      [layerId]: new Set(layer.subcategories!.map(s => s.id))
    }));
  }, []);

  const deselectAllSubcategories = useCallback((layerId: string) => {
    setSubcategoryFilters(prev => ({
      ...prev,
      [layerId]: new Set()
    }));
  }, []);

  // ─── Country list from data (normalized to full names) ─────────────────────
  const countryList = useMemo(() => {
    // Comprehensive world country list (all UN member states + territories)
    const ALL_COUNTRIES = [
      "Afghanistan","Albania","Algeria","Andorra","Angola","Antigua and Barbuda","Argentina","Armenia","Australia","Austria",
      "Azerbaijan","Bahamas","Bahrain","Bangladesh","Barbados","Belarus","Belgium","Belize","Benin","Bhutan",
      "Bolivia","Bosnia and Herzegovina","Botswana","Brazil","Brunei","Bulgaria","Burkina Faso","Burundi","Cambodia","Cameroon",
      "Canada","Cape Verde","Central African Republic","Chad","Chile","China","Colombia","Comoros","Congo","Costa Rica",
      "Croatia","Cuba","Cyprus","Czech Republic","Denmark","Djibouti","Dominica","Dominican Republic","DR Congo","East Timor",
      "Ecuador","Egypt","El Salvador","Equatorial Guinea","Eritrea","Estonia","Eswatini","Ethiopia","Fiji","Finland",
      "France","Gabon","Gambia","Georgia","Germany","Ghana","Greece","Grenada","Guatemala","Guinea",
      "Guinea-Bissau","Guyana","Haiti","Honduras","Hong Kong","Hungary","Iceland","India","Indonesia","Iran",
      "Iraq","Ireland","Israel","Italy","Ivory Coast","Jamaica","Japan","Jordan","Kazakhstan","Kenya",
      "Kiribati","Kosovo","Kuwait","Kyrgyzstan","Laos","Latvia","Lebanon","Lesotho","Liberia","Libya",
      "Liechtenstein","Lithuania","Luxembourg","Madagascar","Malawi","Malaysia","Maldives","Mali","Malta","Marshall Islands",
      "Mauritania","Mauritius","Mexico","Micronesia","Moldova","Monaco","Mongolia","Montenegro","Morocco","Mozambique",
      "Myanmar","Namibia","Nauru","Nepal","Netherlands","New Zealand","Nicaragua","Niger","Nigeria","North Korea",
      "North Macedonia","Norway","Oman","Pakistan","Palau","Palestine","Panama","Papua New Guinea","Paraguay","Peru",
      "Philippines","Poland","Portugal","Qatar","Romania","Russia","Rwanda","Saint Kitts and Nevis","Saint Lucia","Samoa",
      "San Marino","Saudi Arabia","Senegal","Serbia","Seychelles","Sierra Leone","Singapore","Slovakia","Slovenia","Solomon Islands",
      "Somalia","South Africa","South Korea","South Sudan","Spain","Sri Lanka","Sudan","Suriname","Sweden","Switzerland",
      "Syria","Taiwan","Tajikistan","Tanzania","Thailand","Togo","Tonga","Trinidad and Tobago","Tunisia","Turkey",
      "Turkmenistan","Tuvalu","Uganda","Ukraine","United Arab Emirates","United Kingdom","United States","Uruguay","Uzbekistan","Vanuatu",
      "Vatican City","Venezuela","Vietnam","Yemen","Zambia","Zimbabwe",
    ];
    const countries = new Set<string>(ALL_COUNTRIES);
    // Also add data-derived countries for completeness
    if (aviationQuery.data?.aircraft) {
      aviationQuery.data.aircraft.forEach((ac: any) => {
        const n = normalizeCountry(ac.country || "");
        if (n && n.length > 2) countries.add(n);
      });
    }
    if (maritimeQuery.data?.vessels) {
      maritimeQuery.data.vessels.forEach((v: any) => {
        const n = normalizeCountry(v.flag || "");
        if (n && n.length > 2) countries.add(n);
      });
    }
    if (cctvQuery.data?.cameras) {
      cctvQuery.data.cameras.forEach((c: any) => {
        const n = normalizeCountry(c.country || c.countryName || "");
        if (n && n.length > 2) countries.add(n);
      });
    }
    return Array.from(countries).sort();
  }, [aviationQuery.data, maritimeQuery.data, cctvQuery.data]);

  // Filter data by country or polygon
  const isInBounds = useCallback((lat: number, lon: number): boolean => {
    if (polygonFilter && polygonFilter.length >= 3) {
      // Point-in-polygon test
      let inside = false;
      for (let i = 0, j = polygonFilter.length - 1; i < polygonFilter.length; j = i++) {
        const xi = polygonFilter[i].lat, yi = polygonFilter[i].lng;
        const xj = polygonFilter[j].lat, yj = polygonFilter[j].lng;
        const intersect = ((yi > lon) !== (yj > lon)) && (lat < (xj - xi) * (lon - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }
    return true;
  }, [polygonFilter]);

  const matchesCountry = useCallback((item: any): boolean => {
    if (!countryFilter) return true;
    const cf = countryFilter.toLowerCase();
    // Normalize all country fields and compare
    const fields = [
      item.country, item.countryName, item.flag,
      item.origin?.country, item.destination?.country
    ].filter(Boolean);
    return fields.some(f => {
      const normalized = normalizeCountry(f).toLowerCase();
      return normalized.includes(cf) || cf.includes(normalized) ||
        f.toLowerCase().includes(cf) || cf.includes(f.toLowerCase());
    });
  }, [countryFilter]);

  // ─── 2D Map Setup (Canvas Renderer — FlightRadar24/MarineTraffic style) ────
  const canvasRendererRef = useRef<L.Canvas | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;
    // Create a shared Canvas renderer for ALL circle markers — zero DOM overhead
    // tolerance: 15px hit area around each marker for reliable click detection at all zoom levels
    const canvasRenderer = L.canvas({ padding: 0.5, tolerance: 15 });
    canvasRendererRef.current = canvasRenderer;

    const map = L.map(mapContainerRef.current, {
      center: [25, 45],
      zoom: 3,
      zoomControl: false,
      attributionControl: false,
      preferCanvas: true, // Force canvas rendering globally
    });
    const tile = L.tileLayer(isLight ? LIGHT_TILE : DARK_TILE, { maxZoom: 18 }).addTo(map);
    tileLayerRef.current = tile;
    mapRef.current = map;

    // Draw layer for polygon selection
    const drawLayer = new L.FeatureGroup();
    map.addLayer(drawLayer);
    drawLayerRef.current = drawLayer;

    // Create custom panes with proper z-index ordering so all markers are clickable
    // Leaflet default: tilePane=200, overlayPane=400, shadowPane=500, markerPane=600, tooltipPane=650, popupPane=700
    // countryPane MUST be below overlayPane so it never blocks canvas/SVG marker clicks
    map.createPane('countryPane');
    map.getPane('countryPane')!.style.zIndex = '300'; // Below overlayPane (400)
    map.getPane('countryPane')!.style.pointerEvents = 'none'; // Never block clicks by default
    map.createPane('aviationPane');
    map.getPane('aviationPane')!.style.zIndex = '620';
    map.createPane('maritimePane');
    map.getPane('maritimePane')!.style.zIndex = '610';
    map.createPane('cctvPane');
    map.getPane('cctvPane')!.style.zIndex = '630'; // Above aviation/maritime panes
    map.createPane('dataPane');
    map.getPane('dataPane')!.style.zIndex = '450'; // Above overlay (400) but below markers
    map.createPane('alertPane');
    map.getPane('alertPane')!.style.zIndex = '650'; // Above all marker panes

    // Canvas-based layer groups for each data type (no DOM markers, no clusters)
    ["aviation", "maritime", "cctv", "seismic", "fires", "weather", "crossAlert"].forEach(id => {
      markersRef.current[id] = L.layerGroup().addTo(map);
    });

    // Route/highlight overlay layers
    const routeLayer = L.layerGroup().addTo(map);
    routeLayerRef.current = routeLayer;
    const highlightLayer = L.layerGroup().addTo(map);
    highlightLayerRef.current = highlightLayer;

    // Load country boundaries for click filtering
    // Rendered in countryPane (z-index 300) — BELOW all marker panes so it NEVER blocks clicks
    fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json")
      .then(r => r.json())
      .then(world => {
        const countries = topojson.feature(world, world.objects.countries) as any;
        const geoLayer = L.geoJSON(countries, {
          pane: 'countryPane',
          style: () => ({
            fillColor: "transparent",
            fillOpacity: 0,
            color: "transparent",
            weight: 0,
            interactive: false,
          }),
          onEachFeature: (feature, layer) => {
            (layer as any).options.interactive = false;
            (layer as any).options.pane = 'countryPane';
            layer.on("click", () => {
              const name = feature.properties?.name || "";
              if (countryFilter === name) {
                clearCountryFilter();
              } else {
                setCountryFilter(name);
                geoLayer.resetStyle();
                // Glowing cyan highlight for selected country
                (layer as any).setStyle({
                  fillColor: "#06b6d4",
                  fillOpacity: 0.18,
                  color: "#06b6d4",
                  weight: 2.5,
                  dashArray: undefined,
                });
                // Fly map to country bounds
                try {
                  const bounds = (layer as any).getBounds();
                  if (bounds && bounds.isValid()) {
                    map.flyToBounds(bounds, { padding: [60, 60], maxZoom: 8, duration: 1.2 });
                  }
                } catch (_) {}
              }
            });
          },
        }).addTo(map);
        countryLayerRef.current = geoLayer;
        // Ensure the entire countryPane SVG container has pointer-events:none
        // so it NEVER intercepts clicks destined for markers in higher panes
        const countryPaneEl = map.getPane('countryPane');
        if (countryPaneEl) {
          countryPaneEl.style.pointerEvents = 'none';
          // Also set on all child SVG elements
          const svgEls = countryPaneEl.querySelectorAll('svg, path');
          svgEls.forEach((el: any) => { el.style.pointerEvents = 'none'; });
        }
        geoLayer.eachLayer((l: any) => {
          if (l._path) l._path.style.pointerEvents = 'none';
        });
      })
      .catch(() => {});

    // Draw events for polygon selection
    map.on(L.Draw.Event.CREATED, (e: any) => {
      const layer = e.layer;
      // Make the drawn polygon non-interactive so it doesn't block clicks on markers below it
      if (layer.setStyle) {
        layer.setStyle({ interactive: false, pointerEvents: 'none' } as any);
      }
      if (layer._path) {
        layer._path.style.pointerEvents = 'none';
      }
      drawLayer.addLayer(layer);
      if (layer instanceof L.Polygon) {
        const latlngs = layer.getLatLngs()[0] as L.LatLng[];
        setPolygonFilter(latlngs);
      }
      setDrawMode(false);
      // Restore map cursor after drawing
      if (mapContainerRef.current) {
        mapContainerRef.current.style.cursor = '';
      }
    });

    // Set initial bounds immediately after map creation
    setMapBounds(map.getBounds());
    setMapZoom(map.getZoom());

    // Track bounds changes for viewport culling
    const updateBounds = () => {
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      boundsTimerRef.current = setTimeout(() => {
        setMapBounds(map.getBounds());
        setMapZoom(map.getZoom());
      }, 150);
    };
    map.on("moveend", updateBounds);
    map.on("zoomend", updateBounds);

    setTimeout(() => map.invalidateSize(), 100);
    return () => {
      map.off("moveend", updateBounds);
      map.off("zoomend", updateBounds);
      if (boundsTimerRef.current) clearTimeout(boundsTimerRef.current);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      canvasRendererRef.current = null;
      markersRef.current = {};
      routeLayerRef.current = null;
      highlightLayerRef.current = null;
      countryLayerRef.current = null;
      drawLayerRef.current = null;
    };
  }, []);

  // Restore country highlight when countryFilter is loaded from sessionStorage on remount
  const countryHighlightRestoredRef = useRef(false);
  useEffect(() => {
    if (countryHighlightRestoredRef.current) return;
    if (!countryLayerRef.current || !countryFilter || !mapRef.current) return;
    countryHighlightRestoredRef.current = true;
    // Re-apply highlight and fly to bounds for the persisted country filter
    countryLayerRef.current.eachLayer((l: any) => {
      const name = l.feature?.properties?.name || "";
      if (name === countryFilter) {
        l.setStyle({ fillColor: "#06b6d4", fillOpacity: 0.18, color: "#06b6d4", weight: 2.5 });
        try {
          const bounds = l.getBounds();
          if (bounds && bounds.isValid()) {
            mapRef.current!.flyToBounds(bounds, { padding: [60, 60], maxZoom: 8, duration: 1.2 });
          }
        } catch (_) {}
      }
    });
  }, [countryLayerRef.current, countryFilter]);

  // Toggle country layer pointer-events: enable when in country-filter mode, disable otherwise
  // The countryPane pane element itself also needs pointer-events toggled
  useEffect(() => {
    if (!countryLayerRef.current || !mapRef.current) return;
    const enable = showCountrySearch || !!countryFilter;
    // Toggle the pane container
    const countryPaneEl = mapRef.current.getPane('countryPane');
    if (countryPaneEl) {
      countryPaneEl.style.pointerEvents = enable ? 'auto' : 'none';
    }
    // Toggle individual paths
    countryLayerRef.current.eachLayer((l: any) => {
      if (l._path) l._path.style.pointerEvents = enable ? 'auto' : 'none';
      if (l.options) l.options.interactive = enable;
    });
  }, [showCountrySearch, countryFilter]);

  // Restore drawn polygon visual on map when polygonFilter is loaded from sessionStorage
  const polygonRestoredRef = useRef(false);
  useEffect(() => {
    if (polygonRestoredRef.current) return;
    if (!drawLayerRef.current || !polygonFilter || polygonFilter.length < 3) return;
    polygonRestoredRef.current = true;
    const restoredPoly = L.polygon(polygonFilter, {
      color: "#06b6d4",
      fillColor: "#06b6d4",
      fillOpacity: 0.1,
      weight: 2,
      dashArray: "5, 5",
      interactive: false,
    } as any);
    if ((restoredPoly as any)._path) (restoredPoly as any)._path.style.pointerEvents = 'none';
    drawLayerRef.current.addLayer(restoredPoly);
    // Apply pointer-events:none after a brief delay (DOM may not be ready)
    setTimeout(() => {
      if ((restoredPoly as any)._path) (restoredPoly as any)._path.style.pointerEvents = 'none';
    }, 200);
  }, [drawLayerRef.current, polygonFilter]);

  // Handle draw mode toggle
  useEffect(() => {
    if (!mapRef.current || viewMode !== "map") return;
    const map = mapRef.current;
    const container = mapContainerRef.current;
    if (drawMode) {
      const drawHandler = new (L.Draw as any).Polygon(map, {
        shapeOptions: {
          color: "#06b6d4",
          fillColor: "#06b6d4",
          fillOpacity: 0.1,
          weight: 2,
          dashArray: "5, 5",
        },
        icon: new L.DivIcon({
          iconSize: new L.Point(8, 8),
          className: 'leaflet-div-icon leaflet-editing-icon',
        }),
      });
      drawHandler.enable();
      drawControlRef.current = drawHandler;
      // Force crosshair cursor on map container (override any global pointer rule)
      if (container) {
        container.style.cursor = 'crosshair';
        // Also force on the leaflet-container child
        const lc = container.querySelector('.leaflet-container') as HTMLElement;
        if (lc) lc.style.cursor = 'crosshair';
      }
    } else {
      if (drawControlRef.current) {
        drawControlRef.current.disable();
        drawControlRef.current = null;
      }
      // Restore default cursor
      if (container) {
        container.style.cursor = '';
        const lc = container.querySelector('.leaflet-container') as HTMLElement;
        if (lc) lc.style.cursor = '';
      }
    }
  }, [drawMode, viewMode]);

  // Update tile layer on theme change
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(isLight ? LIGHT_TILE : DARK_TILE);
    }
  }, [isLight]);

  // ─── Draw Route/Highlight for selected item ──────────────────────────────
  useEffect(() => {
    if (!routeLayerRef.current || !highlightLayerRef.current) return;
    routeLayerRef.current.clearLayers();
    highlightLayerRef.current.clearLayers();
    if (!detailData || !detailType) return;

    // Highlight the selected item
    if (detailData.lat && detailData.lon) {
      const highlightColor = detailType === "aircraft" ? "#06b6d4" : detailType === "vessel" ? "#3b82f6" : "#a855f7";
      const pulse = L.circleMarker([detailData.lat, detailData.lon], {
        radius: 18, fillColor: highlightColor, fillOpacity: 0.15,
        color: highlightColor, weight: 2, opacity: 0.8, className: "pulse-ring",
      });
      highlightLayerRef.current.addLayer(pulse);
      const inner = L.circleMarker([detailData.lat, detailData.lon], {
        radius: 5, fillColor: highlightColor, fillOpacity: 0.9, color: "#fff", weight: 1,
      });
      highlightLayerRef.current.addLayer(inner);
    }

    // Aircraft route: ORIGIN → CURRENT → DESTINATION
    if (detailType === "aircraft" && detailData.lat && detailData.lon) {
      const origin = detailData.origin;
      const destination = detailData.destination;
      const greatCircleArc = (lat1d: number, lon1d: number, lat2d: number, lon2d: number, steps = 40): L.LatLng[] => {
        const lat1 = lat1d * Math.PI / 180, lon1 = lon1d * Math.PI / 180;
        const lat2 = lat2d * Math.PI / 180, lon2 = lon2d * Math.PI / 180;
        const d = 2 * Math.asin(Math.sqrt(Math.pow(Math.sin((lat2 - lat1) / 2), 2) + Math.cos(lat1) * Math.cos(lat2) * Math.pow(Math.sin((lon2 - lon1) / 2), 2)));
        if (d < 0.0001) return [L.latLng(lat1d, lon1d), L.latLng(lat2d, lon2d)];
        const points: L.LatLng[] = [];
        for (let i = 0; i <= steps; i++) {
          const f = i / steps;
          const A = Math.sin((1 - f) * d) / Math.sin(d);
          const B = Math.sin(f * d) / Math.sin(d);
          const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
          const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
          const z = A * Math.sin(lat1) + B * Math.sin(lat2);
          points.push(L.latLng(Math.atan2(z, Math.sqrt(x * x + y * y)) * 180 / Math.PI, Math.atan2(y, x) * 180 / Math.PI));
        }
        return points;
      };

      if (origin?.lat && origin?.lon) {
        const arc = greatCircleArc(origin.lat, origin.lon, detailData.lat, detailData.lon, 30);
        routeLayerRef.current.addLayer(L.polyline(arc, { color: "#06b6d4", weight: 2.5, opacity: 0.6 }));
        const oIcon = L.divIcon({ className: "sigint-marker", html: `<div style="width:10px;height:10px;border-radius:50%;border:2px solid #06b6d4;background:rgba(6,182,212,0.2);"></div>`, iconSize: [10, 10], iconAnchor: [5, 5] });
        const oMarker = L.marker([origin.lat, origin.lon], { icon: oIcon });
        oMarker.bindTooltip(`<span style="font-family:monospace;font-size:10px;color:#06b6d4;">${origin.code || 'ORIGIN'}</span>`, { permanent: false, direction: 'top', className: 'sigint-tooltip' });
        routeLayerRef.current.addLayer(oMarker);
      }
      if (destination?.lat && destination?.lon) {
        const arc = greatCircleArc(detailData.lat, detailData.lon, destination.lat, destination.lon, 30);
        routeLayerRef.current.addLayer(L.polyline(arc, { color: "#06b6d4", weight: 2, opacity: 0.5, dashArray: "8, 5" }));
        const dIcon = L.divIcon({ className: "sigint-marker", html: `<div style="width:12px;height:12px;border-radius:50%;border:2px solid #06b6d4;background:rgba(6,182,212,0.3);display:flex;align-items:center;justify-content:center;"><div style="width:4px;height:4px;border-radius:50%;background:#06b6d4;"></div></div>`, iconSize: [12, 12], iconAnchor: [6, 6] });
        const dMarker = L.marker([destination.lat, destination.lon], { icon: dIcon });
        dMarker.bindTooltip(`<span style="font-family:monospace;font-size:10px;color:#06b6d4;">${destination.code || 'DEST'}</span>`, { permanent: false, direction: 'top', className: 'sigint-tooltip' });
        routeLayerRef.current.addLayer(dMarker);
      }
      if (origin?.lat && destination?.lat) {
        mapRef.current?.flyToBounds(L.latLngBounds([[origin.lat, origin.lon], [detailData.lat, detailData.lon], [destination.lat, destination.lon]]), { padding: [60, 60], maxZoom: 6, duration: 1 });
      }

      // Heading projection fallback: when no origin/destination, draw a dashed heading line
      if (!origin?.lat && !destination?.lat && detailData.heading !== null && detailData.heading !== undefined) {
        const heading = detailData.heading;
        const speed = detailData.speed || 400; // knots
        const distKm = speed * 1.852 * 1.5; // ~1.5 hours ahead
        const R = 6371;
        const lat1 = detailData.lat * Math.PI / 180, lon1 = detailData.lon * Math.PI / 180;
        const brng = heading * Math.PI / 180, d = distKm / R;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
        const projLat = lat2 * 180 / Math.PI, projLon = lon2 * 180 / Math.PI;
        routeLayerRef.current.addLayer(L.polyline(
          [[detailData.lat, detailData.lon], [projLat, projLon]],
          { color: "#06b6d4", weight: 2, opacity: 0.5, dashArray: "8, 6" }
        ));
        routeLayerRef.current.addLayer(L.circleMarker([projLat, projLon], {
          radius: 5, fillColor: "#06b6d4", fillOpacity: 0.5, color: "#fff", weight: 1
        }));
      }
    }

    // Vessel route: heading-based projection (dashed)
    if (detailType === "vessel" && detailData.lat && detailData.lon) {
      const heading = detailData.cog || detailData.heading || 0;
      const speed = detailData.speed || 5;
      if (speed > 0.5) {
        const distKm = speed * 6 * 1.852;
        const R = 6371;
        const lat1 = detailData.lat * Math.PI / 180, lon1 = detailData.lon * Math.PI / 180;
        const brng = heading * Math.PI / 180, d = distKm / R;
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng));
        const lon2 = lon1 + Math.atan2(Math.sin(brng) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
        const destLat = lat2 * 180 / Math.PI, destLon = lon2 * 180 / Math.PI;
        routeLayerRef.current.addLayer(L.polyline([[detailData.lat, detailData.lon], [destLat, destLon]], { color: "#3b82f6", weight: 2.5, opacity: 0.7, dashArray: "6, 4" }));
        routeLayerRef.current.addLayer(L.circleMarker([destLat, destLon], { radius: 5, fillColor: "#3b82f6", fillOpacity: 0.8, color: "#fff", weight: 1 }));
      }
    }
  }, [detailType, detailData]);

  // ─── Viewport-based decimation helper (FlightRadar24 style) ────────────────
  const getDecimationFactor = useCallback((zoom: number, totalItems: number): number => {
    if (totalItems < 500) return 1;
    if (zoom >= 8) return 1;
    if (zoom >= 6) return Math.max(1, Math.floor(totalItems / 2000));
    if (zoom >= 4) return Math.max(1, Math.floor(totalItems / 1000));
    if (zoom >= 3) return Math.max(1, Math.floor(totalItems / 500));
    return Math.max(1, Math.floor(totalItems / 300));
  }, []);

  // Track map bounds for viewport culling (debounced) — initialized in map setup effect
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [mapZoom, setMapZoom] = useState(3);
  const boundsTimerRef = useRef<any>(null);

  // ─── Aviation Markers — Cluster bubbles at low zoom, individual aircraft at high zoom ──
  useEffect(() => {
    if (!markersRef.current.aviation || !mapRef.current) return;
    const group = markersRef.current.aviation as L.LayerGroup;
    group.clearLayers();
    if (!activeLayers.has("aviation") || !aviationQuery.data?.aircraft) return;

    const aircraft = aviationQuery.data.aircraft;
    const avFilters = subcategoryFilters.aviation || new Set();
    const map = mapRef.current;

    // Apply subcategory + country + polygon filters (NO viewport culling at this stage)
    const filteredAircraft: any[] = [];
    for (const ac of aircraft) {
      if (!ac.lat || !ac.lon) continue;
      if (!matchesCountry(ac)) continue;
      if (!isInBounds(ac.lat, ac.lon)) continue;
      const isMilitary = ac.isMilitary || ac.category === 'MIL' || ac.category === 7 || ac.callsign?.match(/^(RCH|DUKE|EVAC|REACH|FORTE|JAKE)/);
      const isOnGround = ac.onGround;
      if (isMilitary && !avFilters.has('military')) continue;
      if (isOnGround && !isMilitary && !avFilters.has('grounded')) continue;
      if (!isMilitary && !isOnGround) {
        const cs = ac.callsign || '';
        const isCargo = /^(FDX|UPS|GTI|CLX|ABW|MPH|BOX|CKS)/i.test(cs);
        const isPrivate = cs.length <= 4 && !/^[A-Z]{3}/.test(cs);
        if (isCargo && !avFilters.has('cargo')) continue;
        if (isPrivate && !avFilters.has('private')) continue;
        if (!isCargo && !isPrivate && !avFilters.has('commercial')) continue;
      }
      filteredAircraft.push(ac);
    }

    // ── CLUSTER MODE: zoom < 6 — geographic count-bubble clusters ────────────────
    if (mapZoom < 6 && !expandView) {
      const cellDeg = mapZoom <= 2 ? 20 : mapZoom <= 3 ? 15 : mapZoom <= 4 ? 10 : 6;
      type AviaCellType = { lat: number; lon: number; count: number; milCount: number; acs: any[] };
      const cells = new Map<string, AviaCellType>();

      for (const ac of filteredAircraft) {
        const gx = Math.floor(ac.lat / cellDeg);
        const gy = Math.floor(ac.lon / cellDeg);
        const key = `${gx},${gy}`;
        if (!cells.has(key)) cells.set(key, { lat: 0, lon: 0, count: 0, milCount: 0, acs: [] });
        const cell = cells.get(key)!;
        cell.lat += ac.lat;
        cell.lon += ac.lon;
        cell.count++;
        const isMil = ac.isMilitary || ac.category === 'MIL' || ac.category === 7;
        if (isMil) cell.milCount++;
        cell.acs.push(ac);
      }
      // Compute real centroid for each cell
      for (const cell of Array.from(cells.values())) {
        cell.lat = cell.lat / cell.count;
        cell.lon = cell.lon / cell.count;
      }

      for (const cell of Array.from(cells.values())) {
        const milRatio = cell.milCount / cell.count;
        // Color: red if has military, cyan for civil
        const clusterColor = milRatio > 0.1 ? '#ef4444' : '#06b6d4';
        const size = cell.count >= 500 ? 44 : cell.count >= 200 ? 38 : cell.count >= 100 ? 32 : cell.count >= 50 ? 27 : cell.count >= 20 ? 23 : 19;
        const fontSize = size >= 38 ? 12 : size >= 32 ? 11 : size >= 27 ? 10 : 9;
        const label = cell.count >= 1000 ? `${(cell.count / 1000).toFixed(1)}k` : String(cell.count);
        const hasMil = cell.milCount > 0;
        const pulseClass = hasMil ? 'mil-cluster-pulse' : '';
        const icon = L.divIcon({
          className: pulseClass,
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:radial-gradient(circle, ${clusterColor}30 0%, ${clusterColor}15 60%, transparent 100%);
            border:1.5px solid ${clusterColor}80;
            display:flex;align-items:center;justify-content:center;
            position:relative;
          ">
            <span style="font-family:monospace;font-size:${fontSize}px;font-weight:700;color:${clusterColor};letter-spacing:-0.5px;">${label}</span>
            ${hasMil ? `<div style="position:absolute;top:1px;right:1px;width:5px;height:5px;border-radius:50%;background:#ef4444;box-shadow:0 0 4px #ef4444;"></div>` : ''}
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });

        // Build top-5 airline/callsign prefix breakdown
        const prefixCounts = new Map<string, number>();
        for (const ac of cell.acs) {
          const cs = (ac.callsign || '').trim();
          const prefix = cs.length >= 3 ? cs.slice(0, 3).toUpperCase() : (cs || '???');
          prefixCounts.set(prefix, (prefixCounts.get(prefix) || 0) + 1);
        }
        const top5 = Array.from(prefixCounts.entries())
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        const milStr = cell.milCount > 0 ? ` · ${cell.milCount} MIL` : '';
        const breakdownLines = top5.map(([pfx, cnt]) => `${pfx}: ${cnt}`).join(' | ');
        const tooltipHtml = `<div style="font-family:monospace;font-size:10px;">
          <div style="font-weight:700;color:${clusterColor}; ">✈ ${cell.count} AIRCRAFT${milStr}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:9px;margin-top:2px;">TOP PREFIXES: ${breakdownLines}</div>
          <div style="color:rgba(255,255,255,0.4);font-size:8px;margin-top:2px;">Click to zoom in</div>
        </div>`;

        const m = L.marker([cell.lat, cell.lon], { icon, pane: 'aviationPane' });
        m.bindTooltip(tooltipHtml, {
          direction: 'top', offset: [0, -(size / 2 + 4)], className: 'sigint-tooltip', permanent: false, opacity: 0.97,
        });
        m.on('click', () => {
          const lats = cell.acs.map((a: any) => a.lat as number);
          const lons = cell.acs.map((a: any) => a.lon as number);
          const sw = L.latLng(Math.min(...lats) - 1, Math.min(...lons) - 1);
          const ne = L.latLng(Math.max(...lats) + 1, Math.max(...lons) + 1);
          map.flyToBounds(L.latLngBounds(sw, ne), { duration: 0.8, maxZoom: 8 });
        });
        group.addLayer(m);
      }
      return;
    }

    // ── INDIVIDUAL MODE: zoom >= 6 — viewport-culled individual aircraft ──────────
    const useDetailIcon = mapZoom >= 7;
    const showTrails = mapZoom >= 9;
    // DOM cap scales with zoom: more markers at higher zoom (user has panned to a region)
    const MAX_AVIATION_DOM = mapZoom >= 9 ? 800 : mapZoom >= 7 ? 600 : 400;

    const visibleAircraft: any[] = [];
    for (const ac of filteredAircraft) {
      if (mapBounds && !mapBounds.pad(0.3).contains([ac.lat, ac.lon])) continue;
      visibleAircraft.push(ac);
      if (visibleAircraft.length >= MAX_AVIATION_DOM) break;
    }

    for (const ac of visibleAircraft) {
      const isMilitary = ac.isMilitary || ac.category === 'MIL' || ac.category === 7 || ac.callsign?.match(/^(RCH|DUKE|EVAC|REACH|FORTE|JAKE)/);
      const isOnGround = ac.onGround;
      const color = isMilitary ? "#ef4444" : isOnGround ? "#6b7280" : "#06b6d4";
      if (showTrails && ac.trail && ac.trail.length > 1) {
        const trailPoints = ac.trail as Array<{ lat: number; lon: number; alt: number; ts: number }>;
        for (let t = 1; t < trailPoints.length; t++) {
          const opacity = (t / trailPoints.length) * 0.5;
          L.polyline(
            [[trailPoints[t-1].lat, trailPoints[t-1].lon], [trailPoints[t].lat, trailPoints[t].lon]],
            { color, weight: 1.5, opacity, interactive: false, pane: 'aviationPane' }
          ).addTo(group);
        }
      }
      const heading = ac.heading || 0;
      const icon = useDetailIcon
        ? L.divIcon({
            className: "",
            html: `<svg width="16" height="16" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);opacity:0.85;filter:drop-shadow(0 0 2px ${color});"><path d="M12 2L8 10h3v8l-3 2h8l-3-2v-8h3L12 2z" fill="${color}" stroke="none"/></svg>`,
            iconSize: [16, 16],
            iconAnchor: [8, 8],
          })
        : L.divIcon({
            className: "",
            html: `<svg width="10" height="10" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="${color}" fill-opacity="0.75" stroke="${color}" stroke-width="0.5"/></svg>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          });
      const m = L.marker([ac.lat, ac.lon], { icon, pane: 'aviationPane' });
      m.bindTooltip(`${ac.callsign || ac.icao24 || 'Unknown'}${ac.altitude ? ' · FL' + Math.round(ac.altitude / 100) : ''}`, {
        direction: 'top', offset: [0, -8], className: 'sigint-tooltip', permanent: false, opacity: 0.95,
      });
      m.on("click", () => selectItem("aircraft", ac));
      group.addLayer(m);
    }
  }, [activeLayers, aviationQuery.data, countryFilter, polygonFilter, matchesCountry, isInBounds, mapBounds, mapZoom, expandView, subcategoryFilters]);

  // ─── Maritime Markers (Canvas CircleMarkers) ────────────────────────────────
  useEffect(() => {
    if (!markersRef.current.maritime || !mapRef.current) return;
    const group = markersRef.current.maritime as L.LayerGroup;
    group.clearLayers();
    if (!activeLayers.has("maritime") || !maritimeQuery.data?.vessels) return;
    const map = mapRef.current;
    const vessels = maritimeQuery.data.vessels;
    const marFilters = subcategoryFilters.maritime || new Set();

    // Pre-filter by country + subcategory (not viewport — needed for clusters)
    const getVesselCat = (v: any): string => {
      const tl = (v.typeLabel || '').toLowerCase();
      if (tl.includes('cargo')) return 'cargo';
      if (tl.includes('tanker')) return 'tanker';
      if (tl.includes('passenger')) return 'passenger';
      if (tl.includes('special') || tl.includes('military') || tl.includes('govt') || tl.includes('law') || tl.includes('search')) return 'military';
      if (tl.includes('fishing')) return 'fishing';
      if (tl.includes('tug') || tl.includes('pilot') || tl.includes('dredg')) return 'tug';
      if (tl.includes('pleasure') || tl.includes('sail') || tl.includes('yacht')) return 'pleasure';
      return 'other';
    };
    const filteredVessels = vessels.filter((v: any) => {
      if (!v.lat || !v.lon) return false;
      if (!matchesCountry(v)) return false;
      if (polygonFilter && !isInBounds(v.lat, v.lon)) return false;
      return marFilters.has(getVesselCat(v));
    });

    // ── CLUSTER MODE: zoom < 6 — geographic count-bubble clusters ────────────────
    if (mapZoom < 6 && !expandView) {
      const cellDeg = mapZoom < 3 ? 15 : mapZoom < 4 ? 10 : mapZoom < 5 ? 6 : 3;
      const cells = new Map<string, { lat: number; lon: number; count: number; milCount: number; vessels: any[] }>();
      for (const v of filteredVessels) {
        const gx = Math.floor(v.lon / cellDeg);
        const gy = Math.floor(v.lat / cellDeg);
        const key = `${gx}:${gy}`;
        if (!cells.has(key)) cells.set(key, { lat: 0, lon: 0, count: 0, milCount: 0, vessels: [] });
        const cell = cells.get(key)!;
        cell.lat += v.lat;
        cell.lon += v.lon;
        cell.count++;
        cell.vessels.push(v);
        if (getVesselCat(v) === 'military') cell.milCount++;
      }
      // Compute real centroid
      for (const cell of Array.from(cells.values())) {
        cell.lat = cell.lat / cell.count;
        cell.lon = cell.lon / cell.count;
      }
      for (const [, cell] of Array.from(cells.entries())) {
        if (cell.count === 0) continue;
        const hasMil = cell.milCount > 0;
        const clusterColor = hasMil ? '#ef4444' : '#3b82f6';
        const size = cell.count >= 500 ? 44 : cell.count >= 200 ? 38 : cell.count >= 100 ? 32 : cell.count >= 50 ? 27 : cell.count >= 20 ? 23 : 19;
        const fontSize = size >= 38 ? 12 : size >= 32 ? 11 : size >= 27 ? 10 : 9;
        const label = cell.count >= 1000 ? `${(cell.count / 1000).toFixed(1)}k` : String(cell.count);
        // Build top-5 vessel type breakdown
        const typeCounts = new Map<string, number>();
        for (const v of cell.vessels) {
          const cat = getVesselCat(v);
          typeCounts.set(cat, (typeCounts.get(cat) || 0) + 1);
        }
        const top5 = Array.from(typeCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const breakdownLines = top5.map(([cat, cnt]) => `${cat.toUpperCase()}: ${cnt}`).join(' | ');
        const milStr = cell.milCount > 0 ? ` · ${cell.milCount} MIL` : '';
        const tooltipHtml = `<div style="font-family:monospace;font-size:10px;">
          <div style="font-weight:700;color:${clusterColor};">\u26f4 ${cell.count} VESSELS${milStr}</div>
          <div style="color:rgba(255,255,255,0.6);font-size:9px;margin-top:2px;">TYPES: ${breakdownLines}</div>
          <div style="color:rgba(255,255,255,0.4);font-size:8px;margin-top:2px;">Click to zoom in</div>
        </div>`;
        const icon = L.divIcon({
          className: hasMil ? 'mil-cluster-pulse' : '',
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:radial-gradient(circle, ${clusterColor}30 0%, ${clusterColor}15 60%, transparent 100%);
            border:1.5px solid ${clusterColor}80;
            display:flex;align-items:center;justify-content:center;
            position:relative;
          ">
            <span style="font-family:monospace;font-size:${fontSize}px;font-weight:700;color:${clusterColor};letter-spacing:-0.5px;">${label}</span>
            ${hasMil ? `<div style="position:absolute;top:1px;right:1px;width:5px;height:5px;border-radius:50%;background:#ef4444;box-shadow:0 0 4px #ef4444;"></div>` : ''}
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const m = L.marker([cell.lat, cell.lon], { icon, pane: 'maritimePane' });
        m.bindTooltip(tooltipHtml, { direction: 'top', offset: [0, -(size / 2 + 4)], className: 'sigint-tooltip', permanent: false, opacity: 0.97 });
        m.on('click', () => {
          const lats = cell.vessels.map((v: any) => v.lat as number);
          const lons = cell.vessels.map((v: any) => v.lon as number);
          const sw = L.latLng(Math.min(...lats) - 1, Math.min(...lons) - 1);
          const ne = L.latLng(Math.max(...lats) + 1, Math.max(...lons) + 1);
          map.flyToBounds(L.latLngBounds(sw, ne), { duration: 0.8, maxZoom: 8 });
        });
        group.addLayer(m);
      }
      return;
    }

    // ── INDIVIDUAL MODE: zoom >= 6 — viewport-culled individual vessels ──────────
    const useDetailIcon = mapZoom >= 7;
    const showVesselTrails = mapZoom >= 9;
    const MAX_MARITIME_DOM = mapZoom >= 9 ? 600 : mapZoom >= 7 ? 500 : 400;
    const visibleVessels: any[] = [];
    for (const v of filteredVessels) {
      if (!isInBounds(v.lat, v.lon)) continue;
      if (mapBounds && !mapBounds.pad(0.2).contains([v.lat, v.lon])) continue;
      visibleVessels.push(v);
      if (visibleVessels.length >= MAX_MARITIME_DOM) break;
    }

    for (const v of visibleVessels) {
      const color = v.typeColor || "#3b82f6";
      const heading = v.heading || v.cog || 0;
      const icon = useDetailIcon
        ? L.divIcon({
            className: "",
            html: `<svg width="14" height="14" viewBox="0 0 24 24" style="transform:rotate(${heading}deg);opacity:0.8;filter:drop-shadow(0 0 2px ${color});"><path d="M12 2l-4 8h2v8H6l6 4 6-4h-4v-8h2L12 2z" fill="${color}" stroke="none"/></svg>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
        : L.divIcon({
            className: "",
            html: `<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="3" fill="${color}" fill-opacity="0.7" stroke="${color}" stroke-width="0.5"/></svg>`,
            iconSize: [8, 8],
            iconAnchor: [4, 4],
          });
      const m = L.marker([v.lat, v.lon], { icon, pane: 'maritimePane' });
      m.bindTooltip(`${v.name || 'MMSI:' + v.mmsi}${v.typeLabel ? ' · ' + v.typeLabel : ''}${v.speed > 0.5 ? ' · ' + v.speed.toFixed(1) + 'kn' : ''}`, {
        direction: 'top', offset: [0, -8], className: 'sigint-tooltip', permanent: false, opacity: 0.95,
      });
      m.on("click", () => selectItem("vessel", v));
      group.addLayer(m);
      if (showVesselTrails && v.trail && v.trail.length > 1) {
        const trailCoords = (v.trail as any[]).map((p: any) => [p.lat, p.lon] as [number, number]);
        trailCoords.push([v.lat, v.lon] as [number, number]);
        for (let t = 0; t < trailCoords.length - 1; t++) {
          const opacity = 0.15 + (t / trailCoords.length) * 0.5;
          L.polyline([trailCoords[t], trailCoords[t + 1]], {
            color, weight: 1.5, opacity, dashArray: '3,4', pane: 'maritimePane', interactive: false,
          }).addTo(group);
        }
      }
    }
  }, [activeLayers, maritimeQuery.data, countryFilter, polygonFilter, matchesCountry, isInBounds, mapBounds, mapZoom, expandView, subcategoryFilters]);

  // ─── Cross-Layer Alert: amber badges where aviation + maritime clusters overlap ──
  useEffect(() => {
    if (!markersRef.current.crossAlert || !mapRef.current) return;
    const group = markersRef.current.crossAlert as L.LayerGroup;
    group.clearLayers();
    // Only active when BOTH layers are on and we're in cluster mode (zoom < 6)
    if (mapZoom >= 6) return;
    if (!activeLayers.has("aviation") || !activeLayers.has("maritime")) return;
    if (!aviationQuery.data?.aircraft?.length || !maritimeQuery.data?.vessels?.length) return;

    const cellDeg = mapZoom <= 2 ? 20 : mapZoom <= 3 ? 15 : mapZoom <= 4 ? 10 : 6;

    // Build aviation grid (real centroid)
    const avCells = new Map<string, { lat: number; lon: number; count: number; milCount: number }>();
    for (const ac of aviationQuery.data.aircraft) {
      if (!ac.lat || !ac.lon) continue;
      const gx = Math.floor(ac.lat / cellDeg);
      const gy = Math.floor(ac.lon / cellDeg);
      const key = `${gx},${gy}`;
      if (!avCells.has(key)) avCells.set(key, { lat: 0, lon: 0, count: 0, milCount: 0 });
      const cell = avCells.get(key)!;
      cell.lat += ac.lat;
      cell.lon += ac.lon;
      cell.count++;
      if (ac.isMilitary || ac.category === 'MIL' || ac.category === 7) cell.milCount++;
    }
    for (const cell of Array.from(avCells.values())) { cell.lat /= cell.count; cell.lon /= cell.count; }

    // Build maritime grid (real centroid)
    const marCells = new Map<string, { lat: number; lon: number; count: number; milCount: number }>();
    for (const v of maritimeQuery.data.vessels) {
      if (!v.lat || !v.lon) continue;
      const gx = Math.floor(v.lat / cellDeg);
      const gy = Math.floor(v.lon / cellDeg);
      const key = `${gx},${gy}`;
      if (!marCells.has(key)) marCells.set(key, { lat: 0, lon: 0, count: 0, milCount: 0 });
      const cell = marCells.get(key)!;
      cell.lat += v.lat;
      cell.lon += v.lon;
      cell.count++;
      const tl = (v.typeLabel || '').toLowerCase();
      if (tl.includes('military') || tl.includes('govt') || tl.includes('law')) cell.milCount++;
    }
    for (const cell of Array.from(marCells.values())) { cell.lat /= cell.count; cell.lon /= cell.count; }

    // Find overlapping cells
    for (const [key, avCell] of Array.from(avCells.entries())) {
      const marCell = marCells.get(key);
      if (!marCell) continue;
      // Overlap found — place amber alert badge slightly offset from cluster center
      const hasMilOverlap = avCell.milCount > 0 && marCell.milCount > 0;
      const badgeColor = hasMilOverlap ? '#ef4444' : '#f59e0b';
      const badgeBorder = hasMilOverlap ? '#dc2626' : '#d97706';
      const icon = L.divIcon({
        className: '',
        html: `<div style="
          background:${badgeColor}22;
          border:2px solid ${badgeBorder};
          border-radius:6px;
          padding:3px 6px;
          display:flex;flex-direction:column;align-items:center;gap:1px;
          box-shadow:0 0 8px ${badgeColor}55;
          animation:milClusterPulse 2s ease-in-out infinite;
        ">
          <div style="font-family:monospace;font-size:9px;font-weight:700;color:${badgeColor};letter-spacing:0.5px;">⚠ OVERLAP</div>
          <div style="font-family:monospace;font-size:8px;color:rgba(255,255,255,0.7);">✈ ${avCell.count} · \u26f4 ${marCell.count}</div>
          ${hasMilOverlap ? `<div style="font-family:monospace;font-size:7px;color:#ef4444;">MIL PRESENCE</div>` : ''}
        </div>`,
        iconSize: [72, hasMilOverlap ? 44 : 36],
        iconAnchor: [36, hasMilOverlap ? 22 : 18],
      });
      // Place badge at midpoint between the two layer centroids for accurate positioning
      const alertLat = (avCell.lat + marCell.lat) / 2;
      const alertLon = (avCell.lon + marCell.lon) / 2;
      const m = L.marker([alertLat, alertLon], { icon, pane: 'alertPane' });
      m.bindTooltip(
        `<div style="font-family:monospace;font-size:10px;">
          <div style="font-weight:700;color:${badgeColor};">⚠ CROSS-LAYER ALERT</div>
          <div style="color:rgba(255,255,255,0.7);font-size:9px;margin-top:2px;">\u2708 ${avCell.count} aircraft + \u26f4 ${marCell.count} vessels</div>
          ${hasMilOverlap ? `<div style="color:#ef4444;font-size:9px;">Military presence in both layers</div>` : ''}
          <div style="color:rgba(255,255,255,0.4);font-size:8px;margin-top:2px;">Zoom in to investigate</div>
        </div>`,
        { direction: 'top', offset: [0, -4], className: 'sigint-tooltip', permanent: false, opacity: 0.97 }
      );
      m.on('click', () => {
        mapRef.current?.flyTo([avCell.lat, avCell.lon], Math.min(mapZoom + 3, 8), { duration: 0.8 });
      });
      group.addLayer(m);
    }
  }, [activeLayers, aviationQuery.data, maritimeQuery.data, mapZoom]);

  // ─── CCTV Markers — Cluster bubbles at low zoom, individual markers at high zoom ──
  useEffect(() => {
    if (!markersRef.current.cctv || !mapRef.current) return;
    const group = markersRef.current.cctv as L.LayerGroup;
    group.clearLayers();
    if (!activeLayers.has("cctv") || !cctvQuery.data?.cameras) return;

    const cameras = cctvQuery.data.cameras;
    const cctvFilters = subcategoryFilters.cctv || new Set();
    const searchLower = cameraSearch.toLowerCase().trim();
    const map = mapRef.current;

    // Apply subcategory + search + country + polygon filters (NO viewport culling here)
    const filteredCams: any[] = [];
    for (const cam of cameras) {
      if (!cam.lat || !cam.lon) continue;
      if (!matchesCountry(cam)) continue;
      if (!isInBounds(cam.lat, cam.lon)) continue;
      const src = (cam.source || '').toLowerCase();
      const isTraffic = src.includes('511') || src.includes('dot') || src.includes('trip') || src.includes('traffic') || src.includes('digitraffic');
      const isPort = src.includes('port') || src.includes('marine') || src.includes('harbor');
      const isBorder = src.includes('border') || src.includes('customs');
      const isCity = !isTraffic && !isPort && !isBorder;
      if (isTraffic && !cctvFilters.has('traffic')) continue;
      if (isPort && !cctvFilters.has('port')) continue;
      if (isBorder && !cctvFilters.has('border')) continue;
      if (isCity && !cctvFilters.has('city')) continue;
      if (searchLower && !(
        (cam.name || '').toLowerCase().includes(searchLower) ||
        (cam.source || '').toLowerCase().includes(searchLower) ||
        (cam.city || '').toLowerCase().includes(searchLower) ||
        (cam.country || cam.countryName || '').toLowerCase().includes(searchLower)
      )) continue;
      filteredCams.push(cam);
    }

    // ── CLUSTER MODE: zoom < 7 — show geographic count-bubble clusters ──────────
    if (mapZoom < 7 && !expandView) {
      // Grid cell size in degrees (coarser at lower zoom)
      const cellDeg = mapZoom <= 3 ? 15 : mapZoom <= 4 ? 10 : mapZoom <= 5 ? 6 : 3;
      const cells = new Map<string, { lat: number; lon: number; count: number; liveCount: number; cams: any[] }>();

      for (const cam of filteredCams) {
        const gx = Math.floor(cam.lat / cellDeg);
        const gy = Math.floor(cam.lon / cellDeg);
        const key = `${gx},${gy}`;
        if (!cells.has(key)) cells.set(key, { lat: 0, lon: 0, count: 0, liveCount: 0, cams: [] });
        const cell = cells.get(key)!;
        cell.lat += cam.lat;
        cell.lon += cam.lon;
        cell.count++;
        if (cam.feedMode === 'live') cell.liveCount++;
        cell.cams.push(cam);
      }
      // Compute real centroid
      for (const cell of Array.from(cells.values())) {
        cell.lat = cell.lat / cell.count;
        cell.lon = cell.lon / cell.count;
      }

      for (const cell of Array.from(cells.values())) {
        const hasLive = cell.liveCount > 0;
        const liveRatio = cell.liveCount / cell.count;
        // Color: green if mostly live, purple if mostly periodic, mixed cyan
        const clusterColor = liveRatio > 0.6 ? '#22c55e' : liveRatio > 0.3 ? '#06b6d4' : '#a855f7';
        const size = cell.count >= 100 ? 40 : cell.count >= 50 ? 34 : cell.count >= 20 ? 28 : cell.count >= 10 ? 24 : 20;
        const fontSize = size >= 34 ? 11 : size >= 28 ? 10 : 9;
        const label = cell.count >= 1000 ? `${Math.round(cell.count / 1000)}k` : String(cell.count);
        const pulseAnim = hasLive ? `animation:cctvPulse 2s ease-in-out infinite;` : '';
        const icon = L.divIcon({
          className: '',
          html: `<div style="
            width:${size}px;height:${size}px;border-radius:50%;
            background:radial-gradient(circle, ${clusterColor}33 0%, ${clusterColor}18 60%, transparent 100%);
            border:1.5px solid ${clusterColor}88;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 ${size/2}px ${clusterColor}44,0 0 ${size}px ${clusterColor}22;
            ${pulseAnim}
            position:relative;
          ">
            <span style="font-family:monospace;font-size:${fontSize}px;font-weight:700;color:${clusterColor};letter-spacing:-0.5px;">${label}</span>
            ${hasLive ? `<div style="position:absolute;top:1px;right:1px;width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 4px #22c55e;"></div>` : ''}
          </div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
        });
        const m = L.marker([cell.lat, cell.lon], { icon, pane: 'cctvPane' });
        const liveStr = cell.liveCount > 0 ? ` · ${cell.liveCount} LIVE` : '';
        m.bindTooltip(`📷 ${cell.count} cameras${liveStr} — click to zoom in`, {
          direction: 'top', offset: [0, -(size / 2 + 4)], className: 'sigint-tooltip', permanent: false, opacity: 0.95,
        });
        m.on('click', () => {
          // Fly to cluster bounds
          const lats = cell.cams.map((c: any) => c.lat as number);
          const lons = cell.cams.map((c: any) => c.lon as number);
          const sw = L.latLng(Math.min(...lats) - 1, Math.min(...lons) - 1);
          const ne = L.latLng(Math.max(...lats) + 1, Math.max(...lons) + 1);
          map.flyToBounds(L.latLngBounds(sw, ne), { duration: 0.8, maxZoom: 9 });
        });
        group.addLayer(m);
      }
      return;
    }

    // ── INDIVIDUAL MODE: zoom >= 7 — show individual camera markers (viewport-culled) ──
    const useDetailIcon = mapZoom >= 9;
    const MAX_CCTV_DOM = 400;
    const viewportCams: any[] = [];
    for (const cam of filteredCams) {
      if (mapBounds && !mapBounds.pad(0.3).contains([cam.lat, cam.lon])) continue;
      viewportCams.push(cam);
      if (viewportCams.length >= MAX_CCTV_DOM) break;
    }

    for (const cam of viewportCams) {
      const isLive = cam.feedMode === 'live';
      const camColor = isLive ? '#22c55e' : '#a855f7';
      const icon = useDetailIcon
        ? L.divIcon({
            className: "",
            html: `<div style="position:relative;width:14px;height:14px;">
              <svg width="14" height="14" viewBox="0 0 24 24" style="opacity:0.95;filter:drop-shadow(0 0 3px ${camColor});">
                <rect x="2" y="5" width="15" height="13" rx="2" fill="${camColor}" fill-opacity="0.85"/>
                <polygon points="17,8 23,5 23,19 17,16" fill="${camColor}" fill-opacity="0.85"/>
                ${isLive ? '<circle cx="7" cy="11" r="2.5" fill="#fff" fill-opacity="0.95"/>' : ''}
              </svg>
              ${isLive ? '<div style="position:absolute;top:-2px;right:-2px;width:5px;height:5px;border-radius:50%;background:#22c55e;box-shadow:0 0 4px #22c55e;"></div>' : ''}
            </div>`,
            iconSize: [14, 14],
            iconAnchor: [7, 7],
          })
        : L.divIcon({
            className: "",
            html: `<svg width="9" height="9" viewBox="0 0 9 9"><circle cx="4.5" cy="4.5" r="3.5" fill="${camColor}" fill-opacity="${isLive ? 0.95 : 0.75}" stroke="${camColor}" stroke-width="0.8"/>${isLive ? '<circle cx="4.5" cy="4.5" r="1.5" fill="#fff" fill-opacity="0.8"/>' : ''}</svg>`,
            iconSize: [9, 9],
            iconAnchor: [4.5, 4.5],
          });
      const m = L.marker([cam.lat, cam.lon], { icon, pane: 'cctvPane' });
      m.bindTooltip(`${cam.name || cam.id}${cam.city ? ' · ' + cam.city : ''}${cam.country ? ', ' + cam.country : ''}${isLive ? ' 🟢 LIVE' : ''}`, {
        direction: 'top', offset: [0, -8], className: 'sigint-tooltip', permanent: false, opacity: 0.95,
      });
      m.on("click", () => selectItem("camera", cam));
      group.addLayer(m);
    }
  }, [activeLayers, cctvQuery.data, countryFilter, polygonFilter, matchesCountry, isInBounds, mapBounds, mapZoom, expandView, subcategoryFilters, cameraSearch]);

  // ─── Camera Density Heatmap ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!showHeatmap || !mapRef.current || !cctvQuery.data?.cameras || !heatmapCanvasRef.current || !heatmapContainerRef.current) return;
    const map = mapRef.current;
    const canvas = heatmapCanvasRef.current;
    const container = heatmapContainerRef.current;
    const cameras = cctvQuery.data.cameras;

    const renderHeatmap = () => {
      const mapSize = map.getSize();
      canvas.width = mapSize.x;
      canvas.height = mapSize.y;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Build grid of density cells (50x50 pixel cells)
      const cellSize = 40;
      const cols = Math.ceil(canvas.width / cellSize);
      const rows = Math.ceil(canvas.height / cellSize);
      const grid = new Float32Array(cols * rows);
      let maxDensity = 0;

      cameras.forEach((cam: any) => {
        if (!cam.lat || !cam.lon) return;
        try {
          const point = map.latLngToContainerPoint([cam.lat, cam.lon]);
          const gx = Math.floor(point.x / cellSize);
          const gy = Math.floor(point.y / cellSize);
          // Gaussian spread over 3x3 neighborhood
          for (let dy = -2; dy <= 2; dy++) {
            for (let dx = -2; dx <= 2; dx++) {
              const nx = gx + dx;
              const ny = gy + dy;
              if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
              const dist = Math.sqrt(dx * dx + dy * dy);
              const weight = Math.exp(-dist * 0.8);
              grid[ny * cols + nx] += weight;
              if (grid[ny * cols + nx] > maxDensity) maxDensity = grid[ny * cols + nx];
            }
          }
        } catch {}
      });

      if (maxDensity === 0) return;

      // Render heatmap cells with color gradient
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const density = grid[gy * cols + gx];
          if (density < 0.05) continue;
          const normalized = Math.min(1, density / (maxDensity * 0.6));
          const px = gx * cellSize;
          const py = gy * cellSize;
          // Color: low=blue, mid=cyan/green, high=yellow, peak=red
          let r, g, b;
          if (normalized < 0.25) {
            const t = normalized / 0.25;
            r = Math.round(0 + t * 0); g = Math.round(0 + t * 100); b = Math.round(180 + t * 75);
          } else if (normalized < 0.5) {
            const t = (normalized - 0.25) / 0.25;
            r = Math.round(0 + t * 0); g = Math.round(100 + t * 155); b = Math.round(255 - t * 155);
          } else if (normalized < 0.75) {
            const t = (normalized - 0.5) / 0.25;
            r = Math.round(0 + t * 255); g = Math.round(255); b = Math.round(100 - t * 100);
          } else {
            const t = (normalized - 0.75) / 0.25;
            r = 255; g = Math.round(255 - t * 200); b = 0;
          }
          const alpha = 0.15 + normalized * 0.55;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }

      // Add blur for smooth appearance
      ctx.filter = 'blur(12px)';
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      ctx.putImageData(imageData, 0, 0);
    };

    renderHeatmap();
    map.on('moveend', renderHeatmap);
    map.on('zoomend', renderHeatmap);
    return () => {
      map.off('moveend', renderHeatmap);
      map.off('zoomend', renderHeatmap);
    };
  }, [showHeatmap, cctvQuery.data, mapBounds, mapZoom]);

  // ─── Aviation Snapshot Capture (store up to 30 frames, 1 per data refresh) ────────────
  useEffect(() => {
    if (!aviationQuery.data?.aircraft?.length) return;
    const snaps = avSnapshotsRef.current;
    const now = Date.now();
    // Only store if at least 30s have passed since last snapshot
    if (snaps.length === 0 || now - snaps[snaps.length - 1].ts > 30000) {
      snaps.push({ ts: now, aircraft: aviationQuery.data.aircraft });
      if (snaps.length > 30) snaps.shift();
    }
  }, [aviationQuery.data]);

  // ─── Time-lapse play/pause controller ──────────────────────────────────────────
  useEffect(() => {
    if (timelapsePlaying) {
      timelapseTimerRef.current = setInterval(() => {
        setTimelapseFrame(prev => {
          const snaps = avSnapshotsRef.current;
          if (snaps.length === 0) return -1;
          const next = prev === -1 ? 0 : prev + 1;
          if (next >= snaps.length) { setTimelapsePlaying(false); return snaps.length - 1; }
          return next;
        });
      }, 800);
    } else {
      if (timelapseTimerRef.current) { clearInterval(timelapseTimerRef.current); timelapseTimerRef.current = null; }
    }
    return () => { if (timelapseTimerRef.current) clearInterval(timelapseTimerRef.current); };
  }, [timelapsePlaying]);

  // ─── Aviation Density Heatmap ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showAvHeatmap || !mapRef.current || !avHeatmapCanvasRef.current || !avHeatmapContainerRef.current) return;
    // Use time-lapse frame data if active, otherwise use live data
    const snaps = avSnapshotsRef.current;
    const frameData = timelapseFrame >= 0 && timelapseFrame < snaps.length ? snaps[timelapseFrame].aircraft : aviationQuery.data?.aircraft;
    if (!frameData?.length) return;
    const map = mapRef.current;
    const canvas = avHeatmapCanvasRef.current;
    const aircraft = frameData;

    const renderAvHeatmap = () => {
      const mapSize = map.getSize();
      canvas.width = mapSize.x;
      canvas.height = mapSize.y;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Toned-down heatmap: larger cells, softer spread, lower alpha, heavier blur
      const cellSize = 55;
      const cols = Math.ceil(canvas.width / cellSize);
      const rows = Math.ceil(canvas.height / cellSize);
      const grid = new Float32Array(cols * rows);
      const milGrid = new Float32Array(cols * rows);
      let maxDensity = 0;

      aircraft.forEach((ac: any) => {
        if (!ac.lat || !ac.lon) return;
        try {
          const point = map.latLngToContainerPoint([ac.lat, ac.lon]);
          const gx = Math.floor(point.x / cellSize);
          const gy = Math.floor(point.y / cellSize);
          const isMil = ac.isMilitary || ac.category === 'MIL' || ac.category === 7;
          // Smaller spread radius (1 instead of 2) for less bleed
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              const nx = gx + dx; const ny = gy + dy;
              if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
              const w = Math.exp(-Math.sqrt(dx*dx+dy*dy) * 1.2);
              grid[ny * cols + nx] += w;
              if (isMil) milGrid[ny * cols + nx] += w;
              if (grid[ny * cols + nx] > maxDensity) maxDensity = grid[ny * cols + nx];
            }
          }
        } catch {}
      });

      if (maxDensity === 0) return;

      for (let gy2 = 0; gy2 < rows; gy2++) {
        for (let gx2 = 0; gx2 < cols; gx2++) {
          const density = grid[gy2 * cols + gx2];
          if (density < 0.1) continue;
          const normalized = Math.min(1, density / (maxDensity * 0.7));
          const milFrac = milGrid[gy2 * cols + gx2] / density;
          const px = gx2 * cellSize; const py = gy2 * cellSize;
          let r, g, b;
          if (milFrac > 0.2) {
            // Military-heavy: muted red
            r = 200; g = Math.round(normalized * 60); b = 30;
          } else if (normalized < 0.33) {
            // Low density: deep teal (very subtle)
            const t = normalized / 0.33;
            r = 0; g = Math.round(t * 60); b = Math.round(120 + t * 80);
          } else if (normalized < 0.66) {
            // Medium density: teal-green
            const t = (normalized - 0.33) / 0.33;
            r = 0; g = Math.round(60 + t * 120); b = Math.round(200 - t * 100);
          } else {
            // High density: green-yellow (no full red/orange)
            const t = (normalized - 0.66) / 0.34;
            r = Math.round(t * 180); g = 200; b = Math.round(100 - t * 100);
          }
          // Significantly lower max alpha (was 0.62, now 0.28)
          const alpha = 0.04 + normalized * 0.24;
          ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
          ctx.fillRect(px, py, cellSize, cellSize);
        }
      }

      // Heavier blur to blend cells smoothly (was 14px, now 22px)
      ctx.filter = 'blur(22px)';
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = 'none';
      ctx.putImageData(imgData, 0, 0);
    };

    renderAvHeatmap();
    map.on('moveend', renderAvHeatmap);
    map.on('zoomend', renderAvHeatmap);
    return () => {
      map.off('moveend', renderAvHeatmap);
      map.off('zoomend', renderAvHeatmap);
    };
  }, [showAvHeatmap, aviationQuery.data, mapBounds, mapZoom, timelapseFrame]);

  // ─── Seismic Markers (already canvas-based CircleMarkers) ──────────────────
  useEffect(() => {
    if (!markersRef.current.seismic || !mapRef.current) return;
    const group = markersRef.current.seismic;
    group.clearLayers();
    if (!activeLayers.has("seismic") || !seismicQuery.data?.quakes) return;
    const seisFilters = subcategoryFilters.seismic || new Set();
    seismicQuery.data.quakes.forEach((q: any) => {
      if (!isInBounds(q.lat, q.lon)) return;
      if (mapBounds && !mapBounds.pad(0.3).contains([q.lat, q.lon])) return;
      const mag = q.magnitude || 0;
      if (mag >= 6 && !seisFilters.has('major')) return;
      if (mag >= 4 && mag < 6 && !seisFilters.has('moderate')) return;
      if (mag >= 2 && mag < 4 && !seisFilters.has('minor')) return;
      if (mag < 2 && !seisFilters.has('micro')) return;
      const size = Math.max(8, Math.min(24, mag * 4));
      const color = mag >= 6 ? "#ef4444" : mag >= 4 ? "#f97316" : mag >= 2 ? "#eab308" : "#6b7280";
      const icon = L.divIcon({
        className: "",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${color}" fill-opacity="0.35" stroke="${color}" stroke-width="1.5"/><circle cx="12" cy="12" r="4" fill="${color}" fill-opacity="0.7"/></svg>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });
      const m = L.marker([q.lat, q.lon], { icon });
      m.on("click", () => selectItem("quake", q));
      group.addLayer(m);
    });
  }, [activeLayers, seismicQuery.data, polygonFilter, isInBounds, mapBounds, mapZoom, subcategoryFilters]);

  // ─── Fire Markers (Canvas CircleMarkers) ──────────────────────────────────
  useEffect(() => {
    if (!markersRef.current.fires || !mapRef.current) return;
    const group = markersRef.current.fires;
    group.clearLayers();
    if (!activeLayers.has("fires") || !fireQuery.data?.fires) return;
    fireQuery.data.fires.forEach((f: any) => {
      if (!isInBounds(f.lat, f.lon)) return;
      if (mapBounds && !mapBounds.pad(0.3).contains([f.lat, f.lon])) return;
      const size = mapZoom >= 6 ? 10 : 8;
      const icon = L.divIcon({
        className: "",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" fill="#f97316" fill-opacity="0.7" stroke="#f97316" stroke-width="0.5"/></svg>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });
      const m = L.marker([f.lat, f.lon], { icon });
      m.on("click", () => selectItem("fire", f));
      group.addLayer(m);
    });
  }, [activeLayers, fireQuery.data, polygonFilter, isInBounds, mapBounds, mapZoom]);

  // ─── Weather Markers (Canvas CircleMarkers) ────────────────────────────────
  useEffect(() => {
    if (!markersRef.current.weather || !mapRef.current) return;
    const group = markersRef.current.weather;
    group.clearLayers();
    if (!activeLayers.has("weather") || !weatherQuery.data?.events) return;
    weatherQuery.data.events.forEach((e: any) => {
      if (!isInBounds(e.lat, e.lon)) return;
      if (mapBounds && !mapBounds.pad(0.3).contains([e.lat, e.lon])) return;
      const size = mapZoom >= 6 ? 12 : 10;
      const icon = L.divIcon({
        className: "",
        html: `<svg width="${size}" height="${size}" viewBox="0 0 12 12"><circle cx="6" cy="6" r="5" fill="#10b981" fill-opacity="0.6" stroke="#10b981" stroke-width="0.5"/></svg>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });
      const m = L.marker([e.lat, e.lon], { icon });
      m.on("click", () => selectItem("weather", e));
      group.addLayer(m);
    });
  }, [activeLayers, weatherQuery.data, polygonFilter, isInBounds, mapBounds, mapZoom]);

  // ─── 3D Globe Setup (Orbit-style with Earth texture) ────────────────────────
  const EARTH_DAY_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_texture_39ccd4c2.jpg";
  const EARTH_NIGHT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_night_3440cbe4.jpg";

  // Raycaster ref for globe click interaction
  const raycasterRef = useRef(new THREE.Raycaster());
  const mouseRef = useRef(new THREE.Vector2());
  // Store marker data for raycasting
  const globeMarkerDataRef = useRef<Map<THREE.Mesh, { type: string; data: any }>>(new Map());

  useEffect(() => {
    if (!globeContainerRef.current) return;
    // Only initialize globe when in GLOBE view mode to conserve WebGL contexts
    if (viewMode !== "globe") return;
    const container = globeContainerRef.current;
    const w = container.clientWidth || 800, h = container.clientHeight || 600;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch (e) {
      console.warn("WebGL context creation failed:", e);
      return;
    }
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(isLight ? 0xe8eef4 : 0x000005);
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Stars background
    const starGeo = new THREE.BufferGeometry();
    const starPos = new Float32Array(6000);
    for (let i = 0; i < 6000; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 80 + Math.random() * 20;
      starPos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      starPos[i * 3 + 1] = r * Math.cos(phi);
      starPos[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: isLight ? 0x8899aa : 0xffffff, size: 0.08, transparent: true, opacity: isLight ? 0.2 : 0.7 })));

    // Earth with real texture — auto-switch based on theme (Feature 1: Night mode)
    const loader = new THREE.TextureLoader();
    const earthGeo = new THREE.SphereGeometry(1, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: loader.load(isLight ? EARTH_DAY_URL : EARTH_NIGHT_URL),
      specular: new THREE.Color(0x111111),
      shininess: 8,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.name = "earth";
    scene.add(earth);

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(1.015, 32, 32);
    const atmMat = new THREE.MeshPhongMaterial({
      color: isLight ? 0x4488cc : 0x0044aa, transparent: true, opacity: isLight ? 0.15 : 0.08, side: THREE.FrontSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // Lighting
    scene.add(new THREE.AmbientLight(0xffffff, isLight ? 0.8 : 0.4));
    const sun = new THREE.DirectionalLight(0xffffff, isLight ? 1.8 : 1.2);
    sun.position.set(5, 3, 5);
    scene.add(sun);

    // Camera
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.01, 200);
    camera.position.set(0, 0, 3.2);
    cameraRef.current = camera;

    // Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.minDistance = 1.1;
    controls.maxDistance = 8;
    controlsRef.current = controls;

    // Markers group
    const markersGroup = new THREE.Group();
    scene.add(markersGroup);
    globeMarkersRef.current = markersGroup;

    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      earth.rotation.y += 0.0003;
      markersGroup.rotation.y += 0.0003;
      renderer.render(scene, camera);
    };
    animate();

    // Feature 2: Globe click interaction — raycasting
    const handleGlobeClick = (event: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      if (!globeMarkersRef.current) return;
      const intersects = raycasterRef.current.intersectObjects(globeMarkersRef.current.children, false);
      if (intersects.length > 0) {
        const hitMesh = intersects[0].object as THREE.Mesh;
        const markerInfo = globeMarkerDataRef.current.get(hitMesh);
        if (markerInfo) {
          selectItem(markerInfo.type as any, markerInfo.data);
        }
      }
    };
    container.addEventListener("click", handleGlobeClick);

    // Handle WebGL context lost/restored
    const canvas = renderer.domElement;
    let contextLost = false;
    const handleContextLost = (e: Event) => { e.preventDefault(); contextLost = true; cancelAnimationFrame(animFrameRef.current); };
    const handleContextRestored = () => { contextLost = false; animate(); };
    canvas.addEventListener("webglcontextlost", handleContextLost);
    canvas.addEventListener("webglcontextrestored", handleContextRestored);

    const handleResize = () => {
      if (contextLost) return;
      const w2 = container.clientWidth, h2 = container.clientHeight;
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
      renderer.setSize(w2, h2);
    };
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      container.removeEventListener("click", handleGlobeClick);
      canvas.removeEventListener("webglcontextlost", handleContextLost);
      canvas.removeEventListener("webglcontextrestored", handleContextRestored);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, [isLight, viewMode]);

  // ─── Globe Markers (with userData for raycasting) ──────────────────────────
  useEffect(() => {
    if (!globeMarkersRef.current) return;
    const group = globeMarkersRef.current;
    while (group.children.length > 0) group.remove(group.children[0]);
    globeMarkerDataRef.current.clear();

    const latLonToVec3 = (lat: number, lon: number, r = 1.02) => {
      const phi = (90 - lat) * Math.PI / 180, theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
    };

    if (activeLayers.has("aviation") && aviationQuery.data?.aircraft) {
      aviationQuery.data.aircraft.forEach((ac: any) => {
        if (!ac.lat || !ac.lon) return;
        if (!matchesCountry(ac)) return;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.008, 6, 6), new THREE.MeshBasicMaterial({ color: 0x06b6d4 }));
        mesh.position.copy(latLonToVec3(ac.lat, ac.lon, 1.03));
        globeMarkerDataRef.current.set(mesh, { type: "aviation", data: ac });
        group.add(mesh);
      });
    }
    if (activeLayers.has("maritime") && maritimeQuery.data?.vessels) {
      maritimeQuery.data.vessels.forEach((v: any) => {
        if (!matchesCountry(v)) return;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.007, 6, 6), new THREE.MeshBasicMaterial({ color: 0x3b82f6 }));
        mesh.position.copy(latLonToVec3(v.lat, v.lon, 1.015));
        globeMarkerDataRef.current.set(mesh, { type: "maritime", data: v });
        group.add(mesh);
      });
    }
    if (activeLayers.has("seismic") && seismicQuery.data?.quakes) {
      seismicQuery.data.quakes.forEach((q: any) => {
        const color = q.magnitude >= 6 ? 0xef4444 : q.magnitude >= 4 ? 0xf97316 : 0xeab308;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(Math.max(0.005, q.magnitude * 0.003), 8, 8), new THREE.MeshBasicMaterial({ color }));
        mesh.position.copy(latLonToVec3(q.lat, q.lon));
        globeMarkerDataRef.current.set(mesh, { type: "seismic", data: q });
        group.add(mesh);
      });
    }
    if (activeLayers.has("cctv") && cctvQuery.data?.cameras) {
      cctvQuery.data.cameras.forEach((c: any) => {
        if (!matchesCountry(c)) return;
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), new THREE.MeshBasicMaterial({ color: 0xa855f7 }));
        mesh.position.copy(latLonToVec3(c.lat, c.lon));
        globeMarkerDataRef.current.set(mesh, { type: "cctv", data: c });
        group.add(mesh);
      });
    }
  }, [activeLayers, aviationQuery.data, maritimeQuery.data, seismicQuery.data, cctvQuery.data, countryFilter, matchesCountry]);

  // ─── Filtered country search results ──────────────────────────────────────
  const filteredCountries = useMemo(() => {
    if (!countrySearch) return countryList.slice(0, 40);
    return countryList.filter(c => c.toLowerCase().includes(countrySearch.toLowerCase())).slice(0, 30);
  }, [countryList, countrySearch]);

  // ─── Per-layer item counts inside active country/polygon filter ────────────────────
  const filterCounts = useMemo(() => {
    if (!countryFilter && !polygonFilter) return null;
    const ac = (aviationQuery.data?.aircraft || []).filter((a: any) => matchesCountry(a)).length;
    const vs = (maritimeQuery.data?.vessels || []).filter((v: any) => matchesCountry(v)).length;
    const cc = (cctvQuery.data?.cameras || []).filter((c: any) => matchesCountry(c)).length;
    const sq = (seismicQuery.data?.quakes || []).filter((q: any) => matchesCountry(q)).length;
    return { aircraft: ac, vessels: vs, cameras: cc, quakes: sq, total: ac + vs + cc + sq };
  }, [countryFilter, polygonFilter, aviationQuery.data, maritimeQuery.data, cctvQuery.data, seismicQuery.data, matchesCountry]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const hasDetail = detailType !== null;

  return (<>
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background text-foreground">
      <DisclaimerModal />
      <SessionIndicator />
      {/* ─── Top Command Bar ──────────────────────────────────────────────── */}
      <header className="h-11 flex items-center px-3 border-b border-border/50 bg-card/80 backdrop-blur-sm shrink-0 z-[9999] relative">
        {/* Logo / Title */}
        <div className="flex items-center gap-2 mr-4">
          <Radar size={16} style={{ color: "var(--intel-amber, #f59e0b)" }} />
          <span className="text-[13px] font-bold tracking-widest" style={{ fontFamily: "var(--font-orbitron, monospace)", color: "var(--intel-amber, #f59e0b)" }}>SIGINT</span>
        </div>

        {/* Menu Items */}
        <nav className="flex items-center gap-0.5 relative z-[9999]">
          {TOP_MENU_ITEMS.map(item => {
            const Icon = item.icon;
            const isSvm = item.id === 'surveillance';
            const svmUnlocked = isSvm && svmCount > 0;
            return (
              <div key={item.id} className="relative" onMouseEnter={() => setHoveredMenu(item.id)} onMouseLeave={() => setHoveredMenu(null)}>
                <button
                  className={`px-3 py-1.5 text-[11px] font-mono flex items-center gap-1.5 rounded transition-all relative ${
                    svmUnlocked
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 hover:bg-emerald-500/25'
                      : item.active
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                  onClick={() => { if (item.id === "surveillance") { window.location.href = "/sigint/svm"; } else if (!item.active) { /* toast coming soon */ } }}
                >
                  <Icon size={12} />
                  {item.label}
                  {svmUnlocked ? (
                    <span className="ml-0.5 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-[8px] font-bold text-black flex items-center justify-center">{svmCount}</span>
                  ) : !item.active ? (
                    <Lock size={8} className="opacity-50" />
                  ) : null}
                </button>
                {/* Tooltip */}
                {hoveredMenu === item.id && item.tooltip && (
                  <div className="absolute top-full left-0 mt-1 w-72 p-3 bg-popover border border-border rounded-lg shadow-xl z-[9999] text-[10px] font-mono text-muted-foreground leading-relaxed">
                    {item.tooltip}
                    {!item.active && <div className="mt-2 text-[9px] text-amber-400 font-bold">COMING SOON — Under Development</div>}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Right side: stats + controls */}
        <div className="ml-auto flex items-center gap-3">
          {/* Stats */}
          {sigintVisible("stats") && (
          <div className="hidden lg:flex items-center gap-2">
            {[
              { label: "AIRCRAFT", value: stats.aircraft, color: "#06b6d4", active: activeLayers.has("aviation") },
              { label: "VESSELS", value: stats.vessels, color: "#3b82f6", active: activeLayers.has("maritime") },
              { label: "CAMERAS", value: stats.cameras, color: "#a855f7", active: activeLayers.has("cctv") },
            ].map(s => s.active && s.value > 0 ? (
              <div key={s.label} className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                <span className="text-[9px] font-mono font-bold" style={{ color: s.color }}>{s.value.toLocaleString()}</span>
                <span className="text-[8px] font-mono text-muted-foreground/50">{s.label}</span>
              </div>
            ) : null)}
          </div>
          )}

          {/* View mode toggle */}
          {sigintVisible("viewmode") && (
          <div className="flex items-center bg-muted/50 rounded overflow-hidden border border-border/30">
            <button onClick={() => setViewMode("map")} className={`px-2 py-1 text-[10px] font-mono flex items-center gap-1 transition-colors ${viewMode === "map" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <MapIcon size={11} /> MAP
            </button>
            <button onClick={() => setViewMode("globe")} className={`px-2 py-1 text-[10px] font-mono flex items-center gap-1 transition-colors ${viewMode === "globe" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}>
              <Globe2 size={11} /> GLOBE
            </button>
          </div>
          )}

                    {/* Live toggle */}
          {sigintVisible("live") && (
          <button onClick={() => setIsLive(!isLive)} className={`px-2 py-1 text-[10px] font-mono rounded border transition-colors flex items-center gap-1 ${isLive ? "border-emerald-500/50 text-emerald-400 bg-emerald-500/10" : "border-border/50 text-muted-foreground"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} />
            {isLive ? "LIVE" : "PAUSED"}
          </button>
          )}
          {/* Upgrade button */}
          {sigintVisible("upgrade") && <UpgradeButton portal="sigint" variant="compact" />}
          {/* Docs */}
          {sigintVisible("docs") && (
          <a href="/docs"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] border transition-all"
            style={{ background: 'rgba(34,197,94,0.08)', borderColor: 'rgba(34,197,94,0.35)', color: 'rgba(34,197,94,0.9)', textDecoration: 'none' }}
            title="Documentation"
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            <span className="hidden sm:inline">DOCS</span>
          </a>
          )}
          {/* Fullscreen */}
          {sigintVisible("fullscreen") && (
          <button onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] border transition-all"
            style={{ background: 'transparent', borderColor: 'var(--border)', color: 'var(--muted-foreground)' }}
          >
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          )}
          {/* Theme */}
          {sigintVisible("theme") && (
          <button onClick={toggleTheme}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] border transition-all"
            style={{ background: isLight ? 'rgba(245,158,11,0.12)' : 'rgba(99,102,241,0.12)', borderColor: isLight ? 'rgba(245,158,11,0.4)' : 'rgba(99,102,241,0.4)', color: isLight ? '#f59e0b' : '#818cf8' }}
          >
            {isLight ? <Moon size={11} /> : <Sun size={11} />}
            <span className="hidden sm:inline">{isLight ? 'DARK' : 'LIGHT'}</span>
          </button>
          )}
          {/* Custom toggles from AdminCMS */}
          {sigintCustomToggles.map(ct => (
            ct.isExternal
              ? <a key={ct.id} href={ct.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] transition-all shrink-0"
                  style={{ background: ct.bgColor || 'transparent', border: ct.hasBorder ? `1px solid ${ct.borderColor}` : 'none', borderRadius: ct.borderRadius ? '4px' : '0', color: ct.textColor || 'inherit', textDecoration: 'none' }}>
                  {ct.label}
                </a>
              : <a key={ct.id} href={ct.link}
                  className="flex items-center gap-1 px-2 py-0.5 rounded font-mono text-[10px] transition-all shrink-0"
                  style={{ background: ct.bgColor || 'transparent', border: ct.hasBorder ? `1px solid ${ct.borderColor}` : 'none', borderRadius: ct.borderRadius ? '4px' : '0', color: ct.textColor || 'inherit', textDecoration: 'none' }}>
                  {ct.label}
                </a>
          ))}
          {/* Back */}
          {sigintVisible("back") && (
          <a href="/"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded font-mono text-[10px] border transition-all"
            style={{ background: 'rgba(239,68,68,0.08)', borderColor: 'rgba(239,68,68,0.3)', color: 'rgba(239,68,68,0.8)', textDecoration: 'none' }}
          >← INTEL</a>
          )}
        </div>
      </header>

      {/* ─── Main Content ────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Enhanced Layer Controls */}
        <aside className={`${sidebarOpen ? "w-72" : "w-0"} transition-all duration-200 overflow-hidden border-r border-border/20 bg-gradient-to-b from-card/95 to-card/80 backdrop-blur-md z-40 shrink-0 flex flex-col`}>
          <div className="flex-1 overflow-y-auto scrollbar-thin">
            {/* NSA-Grade Header */}
            <div className="px-3 pt-3 pb-2 border-b border-border/20 bg-card/50">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-5 h-5 rounded bg-primary/10 flex items-center justify-center">
                  <Shield size={11} className="text-primary" />
                </div>
                <span className="text-[10px] font-mono text-primary uppercase tracking-[0.15em] font-bold">COLLECTION LAYERS</span>
              </div>
              <div className="flex items-center gap-2 text-[8px] font-mono text-muted-foreground/60">
                <span>ACTIVE: {activeLayers.size}/{LAYERS.length}</span>
                <span>•</span>
                <span>TOTAL ASSETS: {(stats.aircraft + stats.vessels + stats.cameras + stats.quakes + stats.fires + stats.events).toLocaleString()}</span>
              </div>
            </div>

            {/* Global cluster hint — always visible when any clustered layer is active */}
            {(activeLayers.has('aviation') || activeLayers.has('maritime') || activeLayers.has('cctv')) && mapZoom < 6 && (
              <div className="mx-2 mb-1 px-2 py-1.5 rounded bg-cyan-500/5 border border-cyan-500/15 flex items-center gap-1.5">
                <svg width="9" height="9" viewBox="0 0 10 10" className="shrink-0"><circle cx="5" cy="5" r="4" fill="none" stroke="#06b6d4" strokeWidth="1.2"/><line x1="5" y1="2" x2="5" y2="8" stroke="#06b6d4" strokeWidth="1.2"/><line x1="2" y1="5" x2="8" y2="5" stroke="#06b6d4" strokeWidth="1.2"/></svg>
                <span className="text-[7.5px] font-mono text-cyan-400/70 leading-tight">CLUSTERS SHOWN AT LOW ZOOM · ZOOM IN FOR INDIVIDUAL SIGNALS</span>
              </div>
            )}

            {/* Intelligence Layers */}
            <div className="px-2 py-2 space-y-0.5">
            {LAYERS.map(layer => {
              const Icon = layer.icon;
              const active = activeLayers.has(layer.id);
              const expanded = expandedLayers.has(layer.id);
              const count = layer.id === "aviation" ? stats.aircraft :
                layer.id === "maritime" ? stats.vessels :
                layer.id === "cctv" ? stats.cameras :
                layer.id === "seismic" ? stats.quakes :
                layer.id === "fires" ? stats.fires :
                layer.id === "weather" ? stats.events : null;
              const totalCount = layer.id === "aviation" ? stats.aircraftTotal :
                layer.id === "maritime" ? stats.vesselsTotal : null;
              return (
                <div key={layer.id} className="group">
                  <div className={`flex items-center gap-2 px-2 py-1.5 rounded-md transition-all cursor-pointer ${active ? "bg-foreground/[0.04] border border-foreground/[0.08]" : "opacity-50 hover:opacity-75 border border-transparent hover:border-foreground/[0.05]"}`}>
                    <button onClick={() => toggleLayer(layer.id)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                      {/* Toggle Switch */}
                      <div className={`relative w-7 h-3.5 rounded-full transition-colors ${active ? '' : 'bg-muted-foreground/20'}`} style={{ backgroundColor: active ? layer.color + '40' : undefined }}>
                        <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full transition-all shadow-sm ${active ? 'left-[14px]' : 'left-0.5 bg-muted-foreground/50'}`} style={{ backgroundColor: active ? layer.color : undefined }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <Icon size={11} style={{ color: active ? layer.color : undefined }} className={active ? '' : 'text-muted-foreground'} />
                          <span className="text-[10px] font-mono font-bold tracking-wide" style={{ color: active ? layer.color : undefined }}>{layer.label}</span>
                        </div>
                      </div>
                    </button>
                    <div className="flex items-center gap-1 shrink-0">
                      {active && count !== null && count > 0 && (
                        totalCount && totalCount > count ? (
                          <span className="text-[8px] font-mono font-bold px-1.5 py-0.5 rounded-sm flex items-center gap-0.5" style={{ color: layer.color, backgroundColor: layer.color + '15' }}>
                            <span style={{ color: layer.color }}>{count.toLocaleString()}</span>
                            <span style={{ color: layer.color + '80', fontSize: '7px' }}>/{totalCount >= 10000 ? `${Math.round(totalCount/1000)}k` : totalCount.toLocaleString()}</span>
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm" style={{ color: layer.color, backgroundColor: layer.color + '15' }}>{count.toLocaleString()}</span>
                        )
                      )}
                      <span className="text-[7px] text-muted-foreground/40 font-mono w-3 text-center">{layer.shortcut}</span>
                      {/* CCTV-specific disclaimer info icon */}
                      {layer.id === 'cctv' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); e.preventDefault(); setShowCctvDisclaimer(v => !v); }}
                          className="p-0.5 rounded hover:bg-amber-500/20 transition-colors group/info"
                          title="Data source & privacy notice"
                        >
                          <AlertTriangle size={9} className="text-amber-400/70 group-hover/info:text-amber-400 transition-colors" />
                        </button>
                      )}
                      {layer.subcategories && (
                        <button onClick={() => toggleExpanded(layer.id)} className="p-0.5 rounded hover:bg-muted/50 transition-colors">
                          {expanded ? <ChevronUp size={9} className="text-muted-foreground" /> : <ChevronDown size={9} className="text-muted-foreground" />}
                        </button>
                      )}
                    </div>
                  </div>
                  {/* Subcategories with functional toggles */}
                  {layer.subcategories && expanded && active && (
                    <div className="ml-3 mt-0.5 mb-1 pl-3 border-l border-border/20 space-y-0.5">
                      {/* Select All / Deselect All */}
                      <div className="flex items-center justify-between px-2 py-0.5 mb-0.5">
                        <span className="text-[8px] font-mono text-muted-foreground/50 uppercase tracking-wider">Sub-filters</span>
                        <div className="flex items-center gap-1.5">
                          <button onClick={() => selectAllSubcategories(layer.id)} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-muted/20 hover:bg-muted/40 text-muted-foreground/70 hover:text-foreground transition-all">ALL</button>
                          <button onClick={() => deselectAllSubcategories(layer.id)} className="text-[7px] font-mono px-1.5 py-0.5 rounded bg-muted/20 hover:bg-muted/40 text-muted-foreground/70 hover:text-foreground transition-all">NONE</button>
                        </div>
                      </div>
                      {layer.subcategories.map(sub => {
                        const isActive = (subcategoryFilters[layer.id] || new Set()).has(sub.id);
                        const count = subcategoryCounts[layer.id]?.[sub.id] || 0;
                        return (
                          <button key={sub.id} onClick={() => toggleSubcategory(layer.id, sub.id)} className={`w-full flex items-center gap-2 px-2 py-1 rounded text-[9px] font-mono transition-all ${isActive ? 'text-foreground hover:bg-muted/30' : 'text-muted-foreground/40 hover:text-muted-foreground/60 hover:bg-muted/10'}`}>
                            {/* Mini toggle */}
                            <div className={`relative w-5 h-2.5 rounded-full transition-colors ${isActive ? '' : 'bg-muted-foreground/15'}`} style={{ backgroundColor: isActive ? layer.color + '30' : undefined }}>
                              <div className={`absolute top-[1px] w-2 h-2 rounded-full transition-all ${isActive ? 'left-[11px]' : 'left-[1px] bg-muted-foreground/40'}`} style={{ backgroundColor: isActive ? layer.color : undefined }} />
                            </div>
                            <span className={`flex-1 text-left ${isActive ? '' : 'line-through opacity-50'}`}>{sub.label}</span>
                            {/* Real-time count badge */}
                            <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded min-w-[28px] text-center ${isActive ? 'bg-muted/30 text-foreground/70' : 'bg-muted/10 text-muted-foreground/30'}`} style={{ color: isActive && count > 0 ? layer.color : undefined }}>
                              {count > 999 ? `${(count/1000).toFixed(1)}k` : count}
                            </span>
                          </button>
                        );
                      })}
                      {/* Camera search bar when CCTV is expanded */}
                      {layer.id === 'cctv' && (
                        <div className="mt-1.5 pt-1.5 border-t border-border/10">
                          <div className="relative">
                            <Search size={9} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                            <input
                              type="text"
                              value={cameraSearch}
                              onChange={(e) => setCameraSearch(e.target.value)}
                              onFocus={() => setCameraSearchFocused(true)}
                              onBlur={() => setCameraSearchFocused(false)}
                              placeholder="Search cameras..."
                              className="w-full pl-6 pr-2 py-1.5 bg-background/50 border border-border/20 rounded text-[9px] font-mono text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-purple-500/40 focus:ring-1 focus:ring-purple-500/20 transition-all"
                            />
                            {cameraSearch && (
                              <button onClick={() => setCameraSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-foreground">
                                <X size={8} />
                              </button>
                            )}
                          </div>
                          {cameraSearch && (
                            <div className="mt-1 text-[8px] font-mono text-purple-400/70">
                              Filtering by: "{cameraSearch}"
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Aviation special: hint moved to global banner above layers */}
                  {/* CCTV special: show LIVE vs PERIODIC breakdown */}
                  {layer.id === 'cctv' && active && !expanded && stats.cameras > 0 && (
                    <div className="ml-11 flex items-center gap-2 text-[8px] font-mono text-muted-foreground/60 mt-0.5 mb-1">
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{stats.camerasLive} LIVE</span>
                      <span className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-purple-400" />{stats.camerasPeriodic} PERIODIC</span>
                    </div>
                  )}
                </div>
              );
            })}
            </div>

            {/* Separator */}
            <div className="mx-3 border-t border-border/15" />

            {/* OPERATIONS Section */}
            <div className="px-3 py-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-4 h-4 rounded bg-amber-500/10 flex items-center justify-center">
                  <Crosshair size={9} className="text-amber-400" />
                </div>
                <span className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-[0.12em] font-bold">OPERATIONS</span>
              </div>

              {/* Country Filter */}
              <button onClick={() => setShowCountrySearch(!showCountrySearch)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 ${countryFilter ? "bg-cyan-500/10 border border-cyan-500/25" : "hover:bg-muted/20 border border-transparent"}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center ${countryFilter ? 'bg-cyan-500/20' : 'bg-muted/30'}`}>
                  <Filter size={10} className={countryFilter ? "text-cyan-400" : "text-muted-foreground/60"} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-medium" style={{ color: countryFilter ? "#06b6d4" : undefined }}>
                    {countryFilter || "Country Filter"}
                  </span>
                  {countryFilter && <div className="text-[8px] font-mono text-cyan-400/60">Active geofence</div>}
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 bg-muted/30 px-1 py-0.5 rounded">F</span>
              </button>

              {/* Polygon Selection */}
              <button onClick={() => { setDrawMode(!drawMode); if (polygonFilter) clearPolygonFilter(); }} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 ${drawMode || polygonFilter ? "bg-amber-500/10 border border-amber-500/25" : "hover:bg-muted/20 border border-transparent"}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center ${drawMode || polygonFilter ? 'bg-amber-500/20' : 'bg-muted/30'}`}>
                  <Pentagon size={10} className={drawMode || polygonFilter ? "text-amber-400" : "text-muted-foreground/60"} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-medium" style={{ color: drawMode || polygonFilter ? "#f59e0b" : undefined }}>
                    {drawMode ? "Drawing..." : polygonFilter ? "Area Selected" : "Area Select"}
                  </span>
                  {polygonFilter && <div className="text-[8px] font-mono text-amber-400/60">{polygonFilter.length} vertices</div>}
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 bg-muted/30 px-1 py-0.5 rounded">D</span>
              </button>

              {/* Expand View (Decluster) */}
              <button onClick={() => setExpandView(!expandView)} className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 ${expandView ? "bg-emerald-500/10 border border-emerald-500/25" : "hover:bg-muted/20 border border-transparent"}`}>
                <div className={`w-5 h-5 rounded flex items-center justify-center ${expandView ? 'bg-emerald-500/20' : 'bg-muted/30'}`}>
                  {expandView ? <Minimize2 size={10} className="text-emerald-400" /> : <Maximize2 size={10} className="text-muted-foreground/60" />}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-medium" style={{ color: expandView ? "#10b981" : undefined }}>
                    {expandView ? "Clustered View" : "Expand All"}
                  </span>
                  <div className="text-[8px] font-mono text-muted-foreground/50">{expandView ? 'Showing all markers' : 'Viewport decimation'}</div>
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 bg-muted/30 px-1 py-0.5 rounded">E</span>
              </button>

              {/* Aviation Density Heatmap */}
              <button
                onClick={() => {
                  if (!activeLayers.has('aviation')) {
                    setActiveLayers(prev => { const n = new Set(prev); n.add('aviation'); return n; });
                  }
                  setShowAvHeatmap(!showAvHeatmap);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 ${showAvHeatmap ? "bg-cyan-500/10 border border-cyan-500/25" : "hover:bg-muted/20 border border-transparent"}`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${showAvHeatmap ? 'bg-cyan-500/20' : 'bg-muted/30'}`}>
                  <Plane size={10} className={showAvHeatmap ? "text-cyan-400" : "text-muted-foreground/60"} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-medium" style={{ color: showAvHeatmap ? "#06b6d4" : undefined }}>
                    {showAvHeatmap ? "Flight Heatmap ON" : "Flight Heatmap"}
                  </span>
                  <div className="text-[8px] font-mono text-muted-foreground/50">{showAvHeatmap ? 'Aviation density overlay' : 'Show flight density overlay'}</div>
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 bg-muted/30 px-1 py-0.5 rounded">J</span>
              </button>

              {/* Camera Density Heatmap */}
              <button
                onClick={() => {
                  if (!activeLayers.has('cctv')) {
                    setActiveLayers(prev => { const n = new Set(prev); n.add('cctv'); return n; });
                  }
                  setShowHeatmap(!showHeatmap);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-left transition-all mb-0.5 ${showHeatmap ? "bg-orange-500/10 border border-orange-500/25" : "hover:bg-muted/20 border border-transparent"}`}
              >
                <div className={`w-5 h-5 rounded flex items-center justify-center ${showHeatmap ? 'bg-orange-500/20' : 'bg-muted/30'}`}>
                  <Flame size={10} className={showHeatmap ? "text-orange-400" : "text-muted-foreground/60"} />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-[10px] font-mono font-medium" style={{ color: showHeatmap ? "#f97316" : undefined }}>
                    {showHeatmap ? "Heatmap ON" : "Cam Heatmap"}
                  </span>
                  <div className="text-[8px] font-mono text-muted-foreground/50">{showHeatmap ? 'Camera density overlay' : 'Show density overlay'}</div>
                </div>
                <span className="text-[7px] font-mono text-muted-foreground/40 bg-muted/30 px-1 py-0.5 rounded">H</span>
              </button>
            </div>

            {/* Active Filters Status */}
            {(countryFilter || polygonFilter) && (
              <div className="mx-3 mb-2 p-2 bg-gradient-to-r from-cyan-500/5 to-amber-500/5 rounded-md border border-cyan-500/20">
                <div className="text-[8px] font-mono text-muted-foreground/70 mb-1.5 font-bold tracking-wider">ACTIVE CONSTRAINTS</div>
                {countryFilter && (
                  <div className="mb-1.5">
                    <div className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-cyan-400 font-bold">{countryFilter}</span>
                      </div>
                      <button onClick={clearCountryFilter} className="text-muted-foreground/50 hover:text-foreground transition-colors"><X size={9} /></button>
                    </div>
                    {filterCounts && (
                      <div className="grid grid-cols-2 gap-0.5 mt-1">
                        {filterCounts.aircraft > 0 && (
                          <div className="flex items-center gap-1 bg-cyan-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-cyan-400/70">✈</span>
                            <span className="text-[8px] font-mono text-cyan-400 font-bold">{filterCounts.aircraft.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">AV</span>
                          </div>
                        )}
                        {filterCounts.vessels > 0 && (
                          <div className="flex items-center gap-1 bg-blue-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-blue-400/70">⚓</span>
                            <span className="text-[8px] font-mono text-blue-400 font-bold">{filterCounts.vessels.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">VS</span>
                          </div>
                        )}
                        {filterCounts.cameras > 0 && (
                          <div className="flex items-center gap-1 bg-purple-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-purple-400/70">📷</span>
                            <span className="text-[8px] font-mono text-purple-400 font-bold">{filterCounts.cameras.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">CC</span>
                          </div>
                        )}
                        {filterCounts.quakes > 0 && (
                          <div className="flex items-center gap-1 bg-orange-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-orange-400/70">🌍</span>
                            <span className="text-[8px] font-mono text-orange-400 font-bold">{filterCounts.quakes.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">SQ</span>
                          </div>
                        )}
                      </div>
                    )}
                    {filterCounts && (
                      <div className="mt-1 text-[7px] font-mono text-muted-foreground/50 text-right">
                        TOTAL IN REGION: <span className="text-cyan-400/80 font-bold">{filterCounts.total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
                {polygonFilter && (
                  <div>
                    <div className="flex items-center justify-between py-0.5">
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[9px] font-mono text-amber-400 font-bold">Polygon ({polygonFilter.length} pts)</span>
                      </div>
                      <button onClick={clearPolygonFilter} className="text-muted-foreground/50 hover:text-foreground transition-colors"><X size={9} /></button>
                    </div>
                    {filterCounts && !countryFilter && (
                      <div className="grid grid-cols-2 gap-0.5 mt-1">
                        {filterCounts.aircraft > 0 && (
                          <div className="flex items-center gap-1 bg-cyan-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-cyan-400/70">✈</span>
                            <span className="text-[8px] font-mono text-cyan-400 font-bold">{filterCounts.aircraft.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">AV</span>
                          </div>
                        )}
                        {filterCounts.vessels > 0 && (
                          <div className="flex items-center gap-1 bg-blue-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-blue-400/70">⚓</span>
                            <span className="text-[8px] font-mono text-blue-400 font-bold">{filterCounts.vessels.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">VS</span>
                          </div>
                        )}
                        {filterCounts.cameras > 0 && (
                          <div className="flex items-center gap-1 bg-purple-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-purple-400/70">📷</span>
                            <span className="text-[8px] font-mono text-purple-400 font-bold">{filterCounts.cameras.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">CC</span>
                          </div>
                        )}
                        {filterCounts.quakes > 0 && (
                          <div className="flex items-center gap-1 bg-orange-500/10 rounded px-1 py-0.5">
                            <span className="text-[7px] font-mono text-orange-400/70">🌍</span>
                            <span className="text-[8px] font-mono text-orange-400 font-bold">{filterCounts.quakes.toLocaleString()}</span>
                            <span className="text-[6px] font-mono text-muted-foreground/50">SQ</span>
                          </div>
                        )}
                      </div>
                    )}
                    {filterCounts && !countryFilter && (
                      <div className="mt-1 text-[7px] font-mono text-muted-foreground/50 text-right">
                        TOTAL IN AREA: <span className="text-amber-400/80 font-bold">{filterCounts.total.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Country Intel Brief */}
            {countryFilter && (
              <CountryIntelBrief country={countryFilter} />
            )}

            {/* Separator */}
            <div className="mx-3 border-t border-border/15" />

            {/* Space Weather Panel (enhanced) */}
            {activeLayers.has("space") && spaceQuery.data && (
              <div className="mx-3 my-2 p-2.5 bg-gradient-to-br from-yellow-500/5 to-red-500/5 rounded-md border border-yellow-500/15">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-yellow-500/15 flex items-center justify-center">
                    <Zap size={9} className="text-yellow-400" />
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-wider font-bold">SPACE WEATHER</span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[14px] font-mono font-bold" style={{ color: spaceQuery.data.stormLevel === "SEVERE" ? "#ef4444" : spaceQuery.data.stormLevel === "MODERATE" ? "#f97316" : "#eab308" }}>
                    Kp {(spaceQuery.data.latestKp || 0).toFixed(1)}
                  </span>
                  <span className={`text-[8px] font-mono px-1.5 py-0.5 rounded-sm font-bold ${spaceQuery.data.stormLevel === "SEVERE" ? "bg-red-500/15 text-red-400" : spaceQuery.data.stormLevel === "MODERATE" ? "bg-orange-500/15 text-orange-400" : "bg-yellow-500/15 text-yellow-400"}`}>
                    {spaceQuery.data.stormLevel}
                  </span>
                </div>
                <div className="flex items-end gap-px h-7 bg-black/20 rounded p-0.5">
                  {spaceQuery.data.kpIndex.slice(-12).map((kp: any, i: number) => (
                    <div key={i} className="flex-1 rounded-t transition-all" style={{ height: `${Math.max(10, ((kp.kp || 0) / 9) * 100)}%`, backgroundColor: kp.kp >= 7 ? "#ef4444" : kp.kp >= 5 ? "#f97316" : kp.kp >= 4 ? "#eab308" : "#22c55e", opacity: 0.8 }} />
                  ))}
                </div>
              </div>
            )}

            {/* System Status Footer */}
            <div className="px-3 py-2 border-t border-border/10 mt-auto">
              <div className="flex items-center justify-between text-[8px] font-mono text-muted-foreground/40">
                <span>SYS: NOMINAL</span>
                <span>{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} UTC</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Sidebar toggle */}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="absolute top-2 z-50 bg-card/80 backdrop-blur-sm border border-border/30 rounded p-1.5 hover:bg-muted/50 transition-colors" style={{ left: sidebarOpen ? "292px" : "4px" }}>
          {sidebarOpen ? <ChevronLeft size={13} /> : <ChevronRight size={13} />}
        </button>

        {/* Map / Globe Container — Feature 3: Smooth transition with crossfade */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={mapContainerRef}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: viewMode === "map" ? 1 : 0, pointerEvents: viewMode === "map" ? "auto" : "none", zIndex: viewMode === "map" ? 2 : 1 }}
          />
          {/* Aviation Heatmap canvas overlay */}
          {showAvHeatmap && viewMode === "map" && (
            <div ref={avHeatmapContainerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 498 }}>
              <canvas ref={avHeatmapCanvasRef} className="absolute inset-0 w-full h-full" />
              {/* Aviation Heatmap legend + time-lapse controls */}
              <div className="absolute bottom-28 right-3 bg-black/80 backdrop-blur-sm border border-cyan-500/30 rounded-lg px-3 py-2 pointer-events-auto w-52">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-mono text-cyan-400 font-bold uppercase tracking-wider">FLIGHT DENSITY</span>
                  <button onClick={() => { setShowAvHeatmap(false); setTimelapsePlaying(false); setTimelapseFrame(-1); }} className="text-[7px] font-mono text-cyan-400/50 hover:text-cyan-400 transition-colors">[HIDE]</button>
                </div>
                <div className="flex items-center gap-1 mb-1">
                  <div className="flex-1 h-2.5 rounded-sm" style={{ background: 'linear-gradient(to right, rgba(0,80,200,0.6), rgba(0,220,100,0.7), rgba(255,255,0,0.8), rgba(255,55,0,0.9))' }} />
                </div>
                <div className="flex justify-between mb-1.5">
                  <span className="text-[7px] font-mono text-muted-foreground">Low</span>
                  <span className="text-[7px] font-mono text-muted-foreground">High</span>
                </div>
                <div className="flex items-center gap-1 mb-2">
                  <div className="w-2.5 h-2.5 rounded-sm" style={{ background: 'rgba(255,40,0,0.8)' }} />
                  <span className="text-[7px] font-mono text-red-400">Military zone</span>
                </div>
                {/* Time-lapse controls */}
                <div className="border-t border-cyan-500/20 pt-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[8px] font-mono text-cyan-400/80 font-bold uppercase tracking-wider">TIME-LAPSE</span>
                    <span className="text-[7px] font-mono text-muted-foreground/60">
                      {avSnapshotsRef.current.length > 0
                        ? timelapseFrame === -1
                          ? `LIVE · ${avSnapshotsRef.current.length} frames`
                          : `T-${avSnapshotsRef.current.length - 1 - timelapseFrame}min · ${timelapseFrame + 1}/${avSnapshotsRef.current.length}`
                        : 'Collecting...'}
                    </span>
                  </div>
                  {avSnapshotsRef.current.length > 1 && (
                    <>
                      <input
                        type="range"
                        min={0}
                        max={avSnapshotsRef.current.length - 1}
                        value={timelapseFrame === -1 ? avSnapshotsRef.current.length - 1 : timelapseFrame}
                        onChange={e => { setTimelapsePlaying(false); setTimelapseFrame(Number(e.target.value)); }}
                        className="w-full h-1 accent-cyan-400 cursor-pointer mb-2"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => { setTimelapseFrame(0); setTimelapsePlaying(false); }}
                          className="text-[8px] font-mono text-muted-foreground/60 hover:text-cyan-400 transition-colors px-1 py-0.5 rounded bg-muted/20 hover:bg-cyan-500/10"
                          title="Go to start"
                        >⏮</button>
                        <button
                          onClick={() => {
                            if (timelapseFrame === -1) setTimelapseFrame(0);
                            setTimelapsePlaying(p => !p);
                          }}
                          className={`flex-1 text-[8px] font-mono transition-colors px-1 py-0.5 rounded ${
                            timelapsePlaying ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-muted/20 text-muted-foreground/70 hover:text-cyan-400 hover:bg-cyan-500/10'
                          }`}
                        >{timelapsePlaying ? '⏸ PAUSE' : '▶ PLAY'}</button>
                        <button
                          onClick={() => { setTimelapsePlaying(false); setTimelapseFrame(-1); }}
                          className="text-[8px] font-mono text-muted-foreground/60 hover:text-cyan-400 transition-colors px-1 py-0.5 rounded bg-muted/20 hover:bg-cyan-500/10"
                          title="Return to live"
                        >LIVE</button>
                      </div>
                    </>
                  )}
                  {avSnapshotsRef.current.length <= 1 && (
                    <div className="text-[7px] font-mono text-muted-foreground/40 text-center py-1">Snapshots accumulate over time</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* CCTV Heatmap canvas overlay */}
          {showHeatmap && viewMode === "map" && (
            <div ref={heatmapContainerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 500 }}>
              <canvas ref={heatmapCanvasRef} className="absolute inset-0 w-full h-full" />
              {/* Heatmap legend */}
              <div className="absolute bottom-14 right-3 bg-black/70 backdrop-blur-sm border border-orange-500/30 rounded-lg px-3 py-2 pointer-events-auto">
                <div className="text-[8px] font-mono text-orange-400 font-bold uppercase tracking-wider mb-1.5">CAM DENSITY</div>
                <div className="flex items-center gap-1">
                  <div className="w-20 h-2.5 rounded-sm" style={{ background: 'linear-gradient(to right, rgba(0,0,180,0.6), rgba(0,255,100,0.7), rgba(255,255,0,0.8), rgba(255,55,0,0.9))' }} />
                </div>
                <div className="flex justify-between mt-0.5">
                  <span className="text-[7px] font-mono text-muted-foreground">Low</span>
                  <span className="text-[7px] font-mono text-muted-foreground">High</span>
                </div>
                <button
                  onClick={() => setShowHeatmap(false)}
                  className="mt-1.5 w-full text-[7px] font-mono text-orange-400/70 hover:text-orange-400 transition-colors text-center"
                >
                  [HIDE]
                </button>
              </div>
            </div>
          )}
          <div
            ref={globeContainerRef}
            className="absolute inset-0 transition-opacity duration-700 ease-in-out"
            style={{ opacity: viewMode === "globe" ? 1 : 0, pointerEvents: viewMode === "globe" ? "auto" : "none", zIndex: viewMode === "globe" ? 2 : 1 }}
          />

          {/* Country Search Overlay */}
          {showCountrySearch && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] w-80">
              <div className="bg-card/95 backdrop-blur-md border border-border/60 rounded-xl shadow-2xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
                  <Search size={14} className="text-muted-foreground" />
                  <input
                    type="text"
                    value={countrySearch}
                    onChange={e => setCountrySearch(e.target.value)}
                    placeholder="Search country..."
                    className="flex-1 bg-transparent text-[12px] font-mono outline-none placeholder:text-muted-foreground/50"
                    autoFocus
                  />
                  <button onClick={() => { setShowCountrySearch(false); setCountrySearch(""); }} className="text-muted-foreground hover:text-foreground">
                    <X size={14} />
                  </button>
                </div>
                <div className="max-h-60 overflow-y-auto p-1">
                  {filteredCountries.map(c => (
                    <button key={c} onClick={() => {
                      setCountryFilter(c);
                      setShowCountrySearch(false);
                      setCountrySearch("");
                      // Highlight the selected country on the map and fly to its bounds
                      if (countryLayerRef.current && mapRef.current) {
                        countryLayerRef.current.resetStyle();
                        countryLayerRef.current.eachLayer((l: any) => {
                          const name = l.feature?.properties?.name || "";
                          if (name === c) {
                            l.setStyle({ fillColor: "#06b6d4", fillOpacity: 0.18, color: "#06b6d4", weight: 2.5 });
                            try {
                              const bounds = l.getBounds();
                              if (bounds && bounds.isValid()) {
                                mapRef.current!.flyToBounds(bounds, { padding: [60, 60], maxZoom: 8, duration: 1.2 });
                              }
                            } catch (_) {}
                          }
                        });
                      }
                    }} className={`w-full text-left px-3 py-1.5 text-[11px] font-mono rounded-lg transition-colors ${countryFilter === c ? "bg-primary/15 text-primary" : "text-foreground hover:bg-muted/50"}`}>
                      {c}
                    </button>
                  ))}
                  {filteredCountries.length === 0 && (
                    <div className="px-3 py-4 text-center text-[10px] font-mono text-muted-foreground">No countries found</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Draw mode indicator */}
          {drawMode && (
            <div className="absolute top-3 right-3 z-[1000] bg-amber-500/20 border border-amber-500/50 rounded-lg px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Pentagon size={14} className="text-amber-400" />
                <span className="text-[10px] font-mono text-amber-400 font-bold">DRAW POLYGON</span>
              </div>
              <div className="text-[9px] font-mono text-amber-400/70 mt-0.5">Click points on map, close shape to filter</div>
            </div>
          )}

          {/* Zoom hint note */}
          {mapZoom < 5 && viewMode === "map" && (
            <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-[999] bg-background/70 border border-border/40 rounded-full px-4 py-1.5 backdrop-blur-sm pointer-events-none animate-pulse">
              <div className="flex items-center gap-2">
                <Info size={11} className="text-muted-foreground" />
                <span className="text-[9px] font-mono text-muted-foreground">Zoom in to reveal more items — density increases with zoom level</span>
              </div>
            </div>
          )}

          {/* Filtered Area Counts HUD — shows counts for visible/filtered area */}
          {(countryFilter || polygonFilter) && viewMode === "map" && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[999] bg-black/75 border border-border/50 rounded-xl px-4 py-2.5 backdrop-blur-md">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Target size={10} className="text-amber-400" />
                <span className="text-[9px] font-mono font-bold text-amber-400 uppercase tracking-wider">
                  {countryFilter ? `FILTERED: ${countryFilter}` : "POLYGON SELECTION"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {activeLayers.has("aviation") && (
                  <div className="flex items-center gap-1">
                    <Plane size={10} style={{ color: "#06b6d4" }} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#06b6d4" }}>
                      {(aviationQuery.data?.aircraft || []).filter((ac: any) => {
                        if (!matchesCountry(ac)) return false;
                        if (polygonFilter && !isInBounds(ac.lat, ac.lon)) return false;
                        return true;
                      }).length.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">AC</span>
                  </div>
                )}
                {activeLayers.has("maritime") && (
                  <div className="flex items-center gap-1">
                    <Ship size={10} style={{ color: "#3b82f6" }} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#3b82f6" }}>
                      {(maritimeQuery.data?.vessels || []).filter((v: any) => {
                        if (!matchesCountry(v)) return false;
                        if (polygonFilter && !isInBounds(v.lat, v.lon)) return false;
                        return true;
                      }).length.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">VES</span>
                  </div>
                )}
                {activeLayers.has("cctv") && (
                  <div className="flex items-center gap-1">
                    <Camera size={10} style={{ color: "#a855f7" }} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#a855f7" }}>
                      {(cctvQuery.data?.cameras || []).filter((cam: any) => {
                        if (!matchesCountry(cam)) return false;
                        if (polygonFilter && !isInBounds(cam.lat, cam.lon)) return false;
                        return true;
                      }).length.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">CAM</span>
                  </div>
                )}
                {activeLayers.has("seismic") && (
                  <div className="flex items-center gap-1">
                    <Activity size={10} style={{ color: "#ef4444" }} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#ef4444" }}>
                      {(seismicQuery.data?.quakes || []).filter((q: any) => {
                        if (polygonFilter && !isInBounds(q.lat, q.lon)) return false;
                        return true;
                      }).length.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">EQ</span>
                  </div>
                )}
                {activeLayers.has("fires") && (
                  <div className="flex items-center gap-1">
                    <Flame size={10} style={{ color: "#f97316" }} />
                    <span className="text-[10px] font-mono font-bold" style={{ color: "#f97316" }}>
                      {(fireQuery.data?.fires || []).filter((f: any) => {
                        if (polygonFilter && !isInBounds(f.lat, f.lon)) return false;
                        return true;
                      }).length.toLocaleString()}
                    </span>
                    <span className="text-[8px] font-mono text-muted-foreground/60">FIRE</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Keyboard Shortcuts (bottom-center) */}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[1000] flex items-center gap-4 bg-background/80 border border-border/60 rounded-full px-6 py-1.5 backdrop-blur-md whitespace-nowrap">
            {([
              { key: '1-7', label: 'Layers', active: activeLayers.size > 0, color: '#06b6d4' },
              { key: 'M', label: 'Map', active: viewMode === 'map', color: '#06b6d4' },
              { key: 'G', label: 'Globe', active: viewMode === 'globe', color: '#a855f7' },
              { key: 'F', label: 'Filter', active: showCountrySearch || !!countryFilter, color: '#f59e0b' },
              { key: 'D', label: 'Draw', active: drawMode, color: '#f59e0b' },
              { key: 'E', label: 'Expand', active: expandView, color: '#10b981' },
              { key: 'L', label: 'Live', active: isLive, color: '#22c55e' },
              { key: 'S', label: 'Sidebar', active: sidebarOpen, color: '#f59e0b' },
              { key: 'ESC', label: 'Clear', active: false, color: '' },
            ] as const).map(({ key, label, active, color }) => (
              <div key={key} className="flex items-center gap-1">
                <kbd className="text-[9px] font-mono bg-foreground/10 border rounded px-1 py-0.5 transition-colors" style={active && color ? { color, borderColor: color + '80', boxShadow: `0 0 6px ${color}40` } : { color: 'oklch(from var(--foreground) l c h / 0.5)', borderColor: 'oklch(from var(--foreground) l c h / 0.2)' }}>{key}</kbd>
                <span className="text-[8px]" style={active && color ? { color: color + 'cc' } : { color: 'oklch(from var(--foreground) l c h / 0.25)' }}>{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Right Detail Panel ──────────────────────────────────────────── */}
        {hasDetail && (
          <aside
            className="border-l border-border/30 bg-card/90 backdrop-blur-sm z-40 shrink-0 flex flex-col overflow-y-auto relative"
            style={{
              width: expandedCamera ? '50vw' : `${rightPanelWidth}px`,
              animation: 'slideInFromRight 0.22s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            {/* Resize drag handle */}
            <div
              onMouseDown={() => setIsResizingPanel(true)}
              className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 transition-colors z-50 ${isResizingPanel ? 'bg-primary/70' : 'bg-transparent'}`}
            />
            <div className="flex items-center justify-between p-3 border-b border-border/30 sticky top-0 bg-card/95 backdrop-blur-sm z-10">
              <div className="flex items-center gap-2">
                {detailType === "aircraft" && <Plane size={14} style={{ color: "#06b6d4" }} />}
                {detailType === "vessel" && <Ship size={14} style={{ color: "#3b82f6" }} />}
                {detailType === "camera" && <Camera size={14} style={{ color: "#a855f7" }} />}
                {detailType === "quake" && <Activity size={14} style={{ color: "#ef4444" }} />}
                {detailType === "fire" && <Flame size={14} style={{ color: "#f97316" }} />}
                {detailType === "weather" && <Cloud size={14} style={{ color: "#10b981" }} />}
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider">
                  {detailType === "aircraft" ? "Aircraft Intel" : detailType === "vessel" ? "Vessel Intel" : detailType === "camera" ? "CCTV Feed" : detailType === "quake" ? "Seismic Event" : detailType === "fire" ? "Fire Event" : "Weather Event"}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {/* Expand/Collapse button for camera */}
                {detailType === "camera" && (
                  <button
                    onClick={() => setExpandedCamera(!expandedCamera)}
                    className="p-1 rounded hover:bg-purple-500/20 text-muted-foreground hover:text-purple-400 transition-colors"
                    title={expandedCamera ? "Collapse panel" : "Expand camera view"}
                  >
                    {expandedCamera ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!detailData || !detailType) return;
                    const MAX_TRACKED = 10;
                    try {
                      const saved = localStorage.getItem("svm_tracked_items");
                      const items = saved ? JSON.parse(saved) : [];
                      if (items.length >= MAX_TRACKED) { alert("Maximum 10 tracked items reached. Remove items in Surveillance Mode."); return; }
                      const id = detailType === "aircraft" ? detailData.icao24 : detailType === "vessel" ? detailData.mmsi : detailType === "camera" ? (detailData.id || detailData.feedUrl) : detailData.id;
                      if (items.find((i: any) => i.id === id)) { alert("Already tracked in Surveillance Mode."); return; }
                      const label = detailType === "aircraft" ? (detailData.callsign || detailData.icao24) : detailType === "vessel" ? (detailData.name || detailData.mmsi) : detailType === "camera" ? detailData.name : (detailData.place || "Event");
                      const colors: Record<string, string> = { aircraft: "#06b6d4", vessel: "#3b82f6", camera: "#a855f7", quake: "#ef4444" };
                      items.push({ id, type: detailType, label, data: detailData, addedAt: Date.now(), color: colors[detailType] || "#64748b" });
                      localStorage.setItem("svm_tracked_items", JSON.stringify(items));
                      setSvmCount(items.length);
                      alert(`Added to Surveillance Mode (${items.length}/${MAX_TRACKED})`);
                    } catch (e) { console.error(e); }
                  }}
                  className="p-1 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors"
                  title="Track in Surveillance Mode"
                >
                  <Target size={14} />
                </button>
                <button onClick={closeDetail} className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"><X size={14} /></button>
              </div>
            </div>

            <div className="p-3 flex-1">
              {/* Aircraft Detail */}
              {detailType === "aircraft" && detailData && <AircraftDetail data={detailData} onRouteEnriched={(route) => setDetailData((prev: any) => prev ? { ...prev, ...route } : prev)} />}
              {/* Vessel Detail */}
              {detailType === "vessel" && detailData && <VesselDetail data={detailData} />}
              {/* Camera Detail */}
              {detailType === "camera" && detailData && <CameraFeedPanel camera={detailData} allCameras={cctvQuery.data?.cameras || []} onSelectCamera={(cam: any) => selectItem("camera", cam)} highlightLayer={highlightLayerRef.current} map={mapRef.current} onPinCamera={pinCamera} />}
              {/* Quake Detail */}
              {detailType === "quake" && detailData && <QuakeDetail data={detailData} />}
              {/* Fire Detail */}
              {detailType === "fire" && detailData && <FireDetail data={detailData} />}
              {/* Weather Detail */}
              {detailType === "weather" && detailData && <WeatherDetail data={detailData} />}
            </div>
          </aside>
        )}
      </div>

      {/* ─── Pinned Cameras Floating Mini-Player ──────────────────────────── */}
      {pinnedCameras.map((cam, idx) => (
        <PinnedCameraMiniPlayer
          key={cam.id || cam.feedUrl || idx}
          camera={cam}
          initialPos={{ x: 16 + idx * 240, y: window.innerHeight - 260 }}
          onUnpin={() => unpinCamera(cam.id || cam.feedUrl)}
          onExpand={() => { selectItem('camera', cam); }}
        />
      ))}

      {/* ─── Status Bar ────────────────────────────────────────────────────── */}
      <footer className="h-8 flex items-center px-3 border-t border-border/50 bg-card/80 backdrop-blur-sm shrink-0 z-50">
        <div className="flex items-center gap-1.5 border-r border-border/50 pr-3 mr-3 h-full">
          <span className={`w-1.5 h-1.5 rounded-full ${isLive ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground"}`} style={isLive ? { boxShadow: "0 0 6px #34d399" } : {}} />
          <span className="text-[10px] font-black text-foreground/60 uppercase tracking-widest">SIGINT</span>
        </div>
        {/* Refresh Interval Selector */}
        <div className="flex items-center gap-1.5 border-r border-border/50 pr-3 mr-3 h-full">
          <RefreshCw size={10} className={`text-cyan-400 ${countdown <= 3 ? 'animate-spin' : ''}`} />
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            className="text-[9px] font-mono bg-transparent border-none text-cyan-400 cursor-pointer focus:outline-none appearance-none"
          >
            <option value={30} className="bg-card text-foreground">30s</option>
            <option value={60} className="bg-card text-foreground">60s</option>
            <option value={120} className="bg-card text-foreground">2m</option>
            <option value={300} className="bg-card text-foreground">5m</option>
          </select>
          <div className="w-8 h-1.5 bg-muted/50 rounded-full overflow-hidden">
            <div className="h-full bg-cyan-400/80 rounded-full transition-all duration-1000" style={{ width: `${(countdown / refreshInterval) * 100}%` }} />
          </div>
          <span className="text-[9px] font-mono text-cyan-400/80 w-5 text-right">{countdown}s</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-muted-foreground overflow-x-auto">
          <span>{activeLayers.size} LAYERS</span>
          <span className="text-border">│</span>
          <span>{(stats.aircraft + stats.vessels + stats.cameras + stats.quakes + stats.fires + stats.events).toLocaleString()} OBJECTS</span>
          {countryFilter && <><span className="text-border">│</span><span className="text-cyan-400">FILTER: {countryFilter}</span></>}
          {polygonFilter && <><span className="text-border">│</span><span className="text-amber-400">POLYGON ACTIVE</span></>}
          {expandView && <><span className="text-border">│</span><span className="text-emerald-400">EXPANDED (NO CLUSTERS)</span></>}
          <span className="text-border">│</span>
          <span>ADS-B: {aviationQuery.data?.source || "—"}</span>
          <span className="text-border">│</span>
          <span>AIS: {maritimeQuery.data?.source || "—"}</span>
          {stats.cameras > 0 && <><span className="text-border">│</span><span>CCTV: {stats.cameras.toLocaleString()}</span></>}
          <span className="text-border">│</span>
          <span>Kp: {stats.kp.toFixed(1)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3 text-[9px] font-mono text-muted-foreground shrink-0">
          <span className="text-emerald-400/60">LAST: {lastRefreshTime.toLocaleTimeString()}</span>
          <span className="text-border">│</span>
          <span>{new Date().toISOString().replace("T", " ").slice(0, 19)} UTC</span>
          <span className="text-border">│</span>
          {/* Redroom Logo + Copyright */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-4 h-4 rounded-full" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(239,68,68,0.4)" stroke="#ef4444" strokeWidth="2"/>
              </svg>
            </div>
            <span style={{ color: "rgba(239,68,68,0.7)" }}>REDROOM V2.4</span>
          </div>
          <span className="text-border">│</span>
          <span style={{ color: "rgba(239,68,68,0.45)" }}>© ALEXSAI · OWLINK.AI</span>
        </div>
      </footer>
    </div>

    {/* CCTV Disclaimer Portal — rendered at body level to bypass overflow:hidden parents */}
    {showCctvDisclaimer && createPortal(
      <div className="fixed inset-0 z-[99999] flex items-center justify-center" onClick={() => setShowCctvDisclaimer(false)}>
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
        <div
          className="relative w-[360px] max-w-[90vw] bg-[#0a0a0a] border border-amber-500/40 rounded-xl shadow-2xl shadow-black/80 p-5 text-left"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-start gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center shrink-0">
              <AlertTriangle size={16} className="text-amber-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-[12px] font-mono font-bold text-amber-400 uppercase tracking-wide">Data Source & Privacy Notice</h3>
              <p className="text-[9px] font-mono text-muted-foreground/60 mt-0.5">CCTV / OSINT Layer Disclaimer</p>
            </div>
            <button onClick={() => setShowCctvDisclaimer(false)} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
              <X size={14} className="text-muted-foreground" />
            </button>
          </div>
          <div className="space-y-3 text-[11px] font-mono text-muted-foreground/90 leading-relaxed">
            <p>
              All camera feeds displayed in this platform are sourced exclusively from{" "}
              <span className="text-white font-bold">publicly accessible, open-source resources</span>{" "}
              — including government traffic APIs, public webcam directories, and official broadcast streams.
            </p>
            <div className="bg-amber-500/5 border border-amber-500/25 rounded-lg p-3">
              <p className="text-amber-300/90">
                <span className="text-amber-400 font-bold">⚠ Important:</span> Some feeds may originate from cameras installed on or near{" "}
                <span className="text-amber-200 font-bold">private property or non-public locations</span>.
                Redroom and Owlink.ai are not responsible for the content, placement, or legal status of any individual camera feed.
                Access to these feeds is provided solely for open-source intelligence (OSINT) research purposes.
              </p>
            </div>
            <p className="text-white/60">
              By using the CCTV layer you acknowledge that you are accessing publicly available streams
              and agree to use them in compliance with applicable laws.
            </p>
            <div className="pt-3 border-t border-border/30 flex items-center justify-between">
              <span className="text-[9px] text-muted-foreground/50">Sources: TfL JamCam · ASFINAG · YouTube Live · Windy Webcams · others</span>
              <button onClick={() => setShowCctvDisclaimer(false)} className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-[10px] font-mono text-amber-400 hover:bg-amber-500/20 transition-colors">
                Understood
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
  </>);
}

// ─── Country Intel Brief Component ──────────────────────────────────────────
function CountryIntelBrief({ country }: { country: string }) {
  const { data: brief, isLoading } = trpc.sigint.getCountryIntelBrief.useQuery(
    { country },
    { staleTime: 24 * 60 * 60 * 1000, refetchOnWindowFocus: false }
  );
  const [expanded, setExpanded] = useState(true);

  if (isLoading) {
    return (
      <div className="mx-3 my-2 p-2.5 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 rounded-md border border-cyan-500/20">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-cyan-500/15 flex items-center justify-center">
            <Shield size={9} className="text-cyan-400 animate-pulse" />
          </div>
          <span className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-wider">INTEL BRIEF LOADING...</span>
        </div>
        <div className="mt-2 space-y-1">
          {[1,2,3].map(i => <div key={i} className="h-3 bg-muted/20 rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />)}
        </div>
      </div>
    );
  }

  if (!brief) return null;

  const threatColors: Record<string, string> = {
    low: "text-emerald-400 bg-emerald-500/15",
    medium: "text-amber-400 bg-amber-500/15",
    high: "text-orange-400 bg-orange-500/15",
    critical: "text-red-400 bg-red-500/15",
  };
  const tc = threatColors[brief.threatLevel] || threatColors.medium;

  return (
    <div className="mx-3 my-2 p-2.5 bg-gradient-to-br from-cyan-500/5 to-indigo-500/5 rounded-md border border-cyan-500/20">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center gap-2 mb-1">
        <div className="w-4 h-4 rounded bg-cyan-500/15 flex items-center justify-center">
          <Shield size={9} className="text-cyan-400" />
        </div>
        <span className="text-[9px] font-mono text-muted-foreground/80 uppercase tracking-wider font-bold flex-1 text-left">INTEL BRIEF</span>
        <span className={`text-[7px] font-mono px-1.5 py-0.5 rounded-sm font-bold ${tc}`}>
          {brief.threatLevel?.toUpperCase()}
        </span>
        <ChevronDown size={10} className={`text-muted-foreground/50 transition-transform ${expanded ? '' : '-rotate-90'}`} />
      </button>
      {expanded && (
        <div className="space-y-1.5 mt-1.5">
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            <div><span className="text-[7px] font-mono text-muted-foreground/50">CAPITAL</span><div className="text-[9px] font-mono text-foreground/80">{brief.capital}</div></div>
            <div><span className="text-[7px] font-mono text-muted-foreground/50">LEADER</span><div className="text-[9px] font-mono text-foreground/80">{brief.leader}</div></div>
            <div><span className="text-[7px] font-mono text-muted-foreground/50">GOVERNMENT</span><div className="text-[9px] font-mono text-foreground/80">{brief.government}</div></div>
            <div><span className="text-[7px] font-mono text-muted-foreground/50">POPULATION</span><div className="text-[9px] font-mono text-foreground/80">{brief.population}</div></div>
            <div><span className="text-[7px] font-mono text-muted-foreground/50">GDP</span><div className="text-[9px] font-mono text-foreground/80">{brief.gdp}</div></div>
            <div><span className="text-[7px] font-mono text-muted-foreground/50">MILITARY</span><div className="text-[9px] font-mono text-foreground/80">{brief.military}</div></div>
          </div>
          <div className="border-t border-border/10 pt-1">
            <span className="text-[7px] font-mono text-muted-foreground/50">CONFLICT STATUS</span>
            <div className="text-[9px] font-mono text-foreground/80">{brief.conflictStatus}</div>
          </div>
          <div className="border-t border-border/10 pt-1">
            <span className="text-[7px] font-mono text-muted-foreground/50">ALLIANCES</span>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {brief.keyAlliances?.map((a: string, i: number) => (
                <span key={i} className="text-[7px] font-mono bg-cyan-500/10 text-cyan-400/80 px-1.5 py-0.5 rounded">{a}</span>
              ))}
            </div>
          </div>
          <div className="border-t border-border/10 pt-1">
            <span className="text-[7px] font-mono text-muted-foreground/50">OSINT NOTES</span>
            <div className="space-y-0.5 mt-0.5">
              {brief.osintNotes?.map((n: string, i: number) => (
                <div key={i} className="text-[8px] font-mono text-foreground/70 flex gap-1">
                  <span className="text-cyan-400/60 shrink-0">▸</span>
                  <span>{n}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Pinned Camera Mini-Player Component ──────────────────────────────────────
function PinnedCameraMiniPlayer({ camera, initialPos, onUnpin, onExpand }: { camera: any; initialPos: { x: number; y: number }; onUnpin: () => void; onExpand: () => void }) {
  const REFRESH_MS = 5000;
  const [activeBuffer, setActiveBuffer] = useState(0);
  const [bufferUrls, setBufferUrls] = useState(['', '']);
  const frameRef = useRef(0);
  const isMjpeg = camera.streamType === 'mjpeg' || camera.feedMode === 'live';
  const isIframe = camera.streamType === 'iframe';

  // Drag-to-reposition state
  const [pos, setPos] = useState(initialPos);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ mouseX: 0, mouseY: 0, posX: 0, posY: 0 });

  const onDragMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    e.preventDefault();
    isDraggingRef.current = true;
    dragStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, posX: pos.x, posY: pos.y };
    const onMove = (ev: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const dx = ev.clientX - dragStartRef.current.mouseX;
      const dy = ev.clientY - dragStartRef.current.mouseY;
      setPos({
        x: Math.max(0, Math.min(window.innerWidth - 200, dragStartRef.current.posX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 100, dragStartRef.current.posY + dy)),
      });
    };
    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [pos]);

  // Resizable state
  const [width, setWidth] = useState(224); // 14rem = 224px default
  const isResizingRef = useRef(false);
  const resizeStartXRef = useRef(0);
  const resizeStartWRef = useRef(224);
  const containerRef = useRef<HTMLDivElement>(null);

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizingRef.current = true;
    resizeStartXRef.current = e.clientX;
    resizeStartWRef.current = width;
    const onMove = (ev: MouseEvent) => {
      if (!isResizingRef.current) return;
      const delta = ev.clientX - resizeStartXRef.current;
      setWidth(Math.max(160, Math.min(480, resizeStartWRef.current + delta)));
    };
    const onUp = () => {
      isResizingRef.current = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, [width]);

  // Quality metrics
  const [fps, setFps] = useState(0);
  const [latency, setLatency] = useState(0);
  const fpsCountRef = useRef(0);
  const fpsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fpsTimerRef.current = setInterval(() => {
      setFps(fpsCountRef.current);
      fpsCountRef.current = 0;
    }, 1000);
    return () => { if (fpsTimerRef.current) clearInterval(fpsTimerRef.current); };
  }, []);

  useEffect(() => {
    if (isIframe) return;
    const loadFrame = () => {
      const start = Date.now();
      const url = isMjpeg
        ? `/api/mjpeg-frame?url=${encodeURIComponent(camera.streamUrl || camera.feedUrl)}&t=${Date.now()}`
        : `/api/trpc/sigint.proxyCCTVImage?input=${encodeURIComponent(JSON.stringify({ url: camera.feedUrl + (camera.feedUrl.includes('?') ? '&' : '?') + 'nocache=' + Date.now() }))}`;
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setLatency(Date.now() - start);
        fpsCountRef.current++;
        const nextBuffer = frameRef.current % 2 === 0 ? 1 : 0;
        setBufferUrls(prev => { const next = [...prev]; next[nextBuffer] = img.src; return next; });
        setTimeout(() => setActiveBuffer(nextBuffer), 50);
        frameRef.current++;
      };
      img.src = url;
    };
    loadFrame();
    const interval = setInterval(loadFrame, isMjpeg ? 2000 : REFRESH_MS);
    return () => clearInterval(interval);
  }, [camera.feedUrl, camera.streamUrl, isMjpeg, isIframe]);

  return (
    <div
      ref={containerRef}
      className="bg-card/95 backdrop-blur-md border border-border/50 rounded-lg shadow-2xl overflow-hidden group relative"
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: `${width}px`,
        zIndex: 9000,
        boxShadow: '0 0 20px rgba(0,0,0,0.5)',
      }}
    >
      {/* Mini header — drag handle */}
      <div
        className="flex items-center justify-between px-2 py-1 bg-black/40 border-b border-border/30 cursor-grab active:cursor-grabbing select-none"
        onMouseDown={onDragMouseDown}
        title="Drag to move"
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" />
          <span className="text-[8px] font-mono font-bold text-foreground/80 truncate">{camera.name}</span>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <span className="text-[7px] font-mono text-muted-foreground/50 mr-1">{width}px</span>
          <button onClick={onExpand} className="p-0.5 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors" title="Expand">
            <Maximize2 size={10} />
          </button>
          <button onClick={onUnpin} className="p-0.5 rounded hover:bg-red-500/20 text-muted-foreground hover:text-red-400 transition-colors" title="Unpin">
            <X size={10} />
          </button>
        </div>
      </div>
      {/* Feed */}
      <div className="relative bg-black" style={{ aspectRatio: '16/9' }}>
        {isIframe ? (
          <iframe src={camera.streamUrl || camera.feedUrl} className="absolute inset-0 w-full h-full" allow="autoplay" />
        ) : (
          <>
            {bufferUrls[0] && <img src={bufferUrls[0]} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeBuffer === 0 ? 'opacity-100' : 'opacity-0'}`} alt="" />}
            {bufferUrls[1] && <img src={bufferUrls[1]} className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ${activeBuffer === 1 ? 'opacity-100' : 'opacity-0'}`} alt="" />}
          </>
        )}
        {/* Quality overlay */}
        <div className="absolute bottom-0 left-0 right-0 px-1.5 py-0.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-[7px] font-mono text-emerald-400">{fps} FPS</span>
          <span className="text-[7px] font-mono text-cyan-400">{latency}ms</span>
        </div>
      </div>
      {/* Resize handle on right edge */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
        title="Drag to resize"
      >
        <div className="w-0.5 h-8 bg-cyan-400/40 rounded-full" />
      </div>
    </div>
  );
}

// ─── Detail Panel Components ────────────────────────────────────────────────

function AircraftDetail({ data, onRouteEnriched }: { data: any; onRouteEnriched?: (route: any) => void }) {
  const hasRoute = !!(data.origin?.lat || data.destination?.lat);
  const hasCallsign = !!(data.callsign && /^[A-Z]{2,3}\d/.test(data.callsign));

  // On-demand route enrichment: fetch route from adsbdb when no route data
  const routeQuery = trpc.sigint.enrichFlightRoute.useQuery(
    { callsign: data.callsign || "" },
    {
      enabled: !hasRoute && hasCallsign && !!data.callsign,
      staleTime: 24 * 60 * 60 * 1000,
      retry: false,
    }
  );

  // Notify parent when route is enriched (tRPC v11 doesn't support onSuccess in useQuery)
  useEffect(() => {
    if (routeQuery.data && (routeQuery.data.origin || routeQuery.data.destination) && onRouteEnriched) {
      onRouteEnriched(routeQuery.data);
    }
  }, [routeQuery.data]);

  // Merge enriched route into display data
  const displayData = useMemo(() => {
    if (!hasRoute && routeQuery.data?.origin) {
      return { ...data, ...routeQuery.data };
    }
    return data;
  }, [data, routeQuery.data, hasRoute]);

  // Calculate distance and ETA if origin/destination available
  const tripInfo = useMemo(() => {
    if (!displayData.origin?.lat || !displayData.destination?.lat || !displayData.lat) return null;
    const toRad = (d: number) => d * Math.PI / 180;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    const totalDist = haversine(displayData.origin.lat, displayData.origin.lon, displayData.destination.lat, displayData.destination.lon);
    const distFlown = haversine(displayData.origin.lat, displayData.origin.lon, displayData.lat, displayData.lon);
    const distRemaining = haversine(displayData.lat, displayData.lon, displayData.destination.lat, displayData.destination.lon);
    const speedKmh = (displayData.speed || 0) * 1.852;
    const etaHours = speedKmh > 0 ? distRemaining / speedKmh : null;
    const etaMinutes = etaHours ? Math.round(etaHours * 60) : null;
    return { totalDist: Math.round(totalDist), distFlown: Math.round(distFlown), distRemaining: Math.round(distRemaining), etaMinutes, speedKmh: Math.round(speedKmh) };
  }, [displayData]);

  const flightPhase = useMemo(() => {
    if (data.onGround) return "ON GROUND";
    if (!data.verticalRate) return "CRUISE";
    if (data.verticalRate > 3) return "CLIMBING";
    if (data.verticalRate < -3) return "DESCENDING";
    return "CRUISE";
  }, [data.onGround, data.verticalRate]);

  const phaseColor = flightPhase === "CLIMBING" ? "#22c55e" : flightPhase === "DESCENDING" ? "#f59e0b" : flightPhase === "ON GROUND" ? "#6b7280" : "#06b6d4";

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[14px] font-mono font-bold mb-0.5" style={{ color: "#06b6d4" }}>{data.callsign || "UNKNOWN"}</div>
            <div className="text-[10px] text-muted-foreground font-mono">{data.airline ? `${data.airline} • ` : ""}{data.country}</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: phaseColor + "20", color: phaseColor, border: `1px solid ${phaseColor}50` }}>
              {flightPhase}
            </div>
            {data.isMilitary && <div className="text-[8px] font-mono text-red-400 mt-1 font-bold">⚠ MILITARY</div>}
          </div>
        </div>
      </div>

      {/* Route visualization */}
      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-lg p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[8px] font-mono text-muted-foreground font-bold uppercase">FLIGHT ROUTE</div>
          {!hasRoute && hasCallsign && routeQuery.isFetching && (
            <div className="text-[8px] font-mono text-cyan-400 animate-pulse">QUERYING ADSBDB...</div>
          )}
          {!hasRoute && hasCallsign && !routeQuery.isFetching && !routeQuery.data?.origin && routeQuery.isFetched && (
            <div className="text-[8px] font-mono text-muted-foreground/60">NO ROUTE DATA</div>
          )}
        </div>
        {(displayData.origin || displayData.destination) ? (
          <>
            <div className="flex items-center justify-between">
              <div className="text-center">
                <div className="text-[13px] font-mono font-bold" style={{ color: "#06b6d4" }}>{displayData.origin?.code || displayData.origin?.iata || "???"}</div>
                <div className="text-[8px] text-muted-foreground">{displayData.origin?.city || "Origin"}</div>
                <div className="text-[7px] text-muted-foreground/60">{displayData.origin?.country || ""}</div>
              </div>
              <div className="flex-1 mx-3 relative">
                <div className="h-px bg-cyan-500/30 w-full" />
                <div className="absolute top-1/2 -translate-y-1/2" style={{ left: `50%` }}>
                  <div className="w-3 h-3 rounded-full bg-cyan-400 -ml-1.5 -mt-1.5" style={{ boxShadow: "0 0 8px #06b6d4" }} />
                </div>
              </div>
              <div className="text-center">
                <div className="text-[13px] font-mono font-bold" style={{ color: "#06b6d4" }}>{displayData.destination?.code || displayData.destination?.iata || "???"}</div>
                <div className="text-[8px] text-muted-foreground">{displayData.destination?.city || "Dest"}</div>
                <div className="text-[7px] text-muted-foreground/60">{displayData.destination?.country || ""}</div>
              </div>
            </div>
            {tripInfo && (
              <div className="mt-3 grid grid-cols-3 gap-2 pt-2 border-t border-cyan-500/20">
                <div className="text-center">
                  <div className="text-[10px] font-mono font-bold text-foreground">{tripInfo.distFlown} km</div>
                  <div className="text-[7px] text-muted-foreground">FLOWN</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono font-bold text-foreground">{tripInfo.distRemaining} km</div>
                  <div className="text-[7px] text-muted-foreground">REMAINING</div>
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-mono font-bold" style={{ color: "#22c55e" }}>
                    {tripInfo.etaMinutes ? (tripInfo.etaMinutes > 60 ? `${Math.floor(tripInfo.etaMinutes/60)}h ${tripInfo.etaMinutes%60}m` : `${tripInfo.etaMinutes}m`) : "N/A"}
                  </div>
                  <div className="text-[7px] text-muted-foreground">ETA</div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Heading projection fallback */
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-full h-px border-t border-dashed border-cyan-500/30" />
              <div className="text-[8px] font-mono text-cyan-400 whitespace-nowrap">
                {data.heading !== null && data.heading !== undefined ? `HDG ${Math.round(data.heading)}° ${getCompassDir(data.heading)}` : "NO HEADING"}
              </div>
              <div className="w-full h-px border-t border-dashed border-cyan-500/30" />
            </div>
            <div className="text-[8px] font-mono text-muted-foreground/60 text-center">
              {!hasCallsign ? "No callsign — route unavailable" : routeQuery.isFetching ? "Looking up route..." : "Route not in ADSBDB database"}
            </div>
            {data.heading !== null && data.heading !== undefined && (
              <div className="text-[8px] font-mono text-muted-foreground/50 text-center">Dashed heading projection shown on map</div>
            )}
          </div>
        )}
      </div>

      {/* Flight Parameters */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">FLIGHT PARAMETERS</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <DetailRow label="ALTITUDE" value={data.altitude ? `${Math.round(data.altitude)} m (FL${Math.round(data.altitude * 3.281 / 100)})` : "N/A"} />
          <DetailRow label="SPEED" value={data.speed ? `${Math.round(data.speed)} kts (${Math.round(data.speed * 1.852)} km/h)` : "N/A"} />
          <DetailRow label="HEADING" value={data.heading !== null ? `${Math.round(data.heading)}° ${getCompassDir(data.heading)}` : "N/A"} />
          <DetailRow label="V/RATE" value={data.verticalRate ? `${data.verticalRate > 0 ? "+" : ""}${data.verticalRate.toFixed(1)} m/s (${data.verticalRate > 0 ? "+" : ""}${Math.round(data.verticalRate * 196.85)} fpm)` : "Level"} />
        </div>
      </div>

      {/* Identification */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">IDENTIFICATION</div>
        <div className="space-y-1">
          <DetailRow label="ICAO24" value={data.icao24} />
          <DetailRow label="CALLSIGN" value={data.callsign || "N/A"} />
          {data.airline && <DetailRow label="AIRLINE" value={data.airline} />}
          {data.registration && <DetailRow label="REGISTRATION" value={data.registration} />}
          {data.aircraftType && <DetailRow label="AIRCRAFT TYPE" value={data.aircraftType} />}
          <DetailRow label="COUNTRY" value={data.country} />
          <DetailRow label="SQUAWK" value={data.squawk || "N/A"} />
          <DetailRow label="ON GROUND" value={data.onGround ? "YES" : "NO"} />
        </div>
      </div>

      {/* Origin & Destination Full Details */}
      {(data.origin || data.destination) && (
        <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
          <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">AIRPORTS</div>
          <div className="space-y-1">
            {data.origin && <DetailRow label="ORIGIN" value={`${data.origin.code} — ${data.origin.name}, ${data.origin.city} (${data.origin.country})`} />}
            {data.destination && <DetailRow label="DESTINATION" value={`${data.destination.code} — ${data.destination.name}, ${data.destination.city} (${data.destination.country})`} />}
            {tripInfo && <DetailRow label="TOTAL DISTANCE" value={`${tripInfo.totalDist} km (${Math.round(tripInfo.totalDist * 0.54)} NM)`} />}
            {tripInfo && <DetailRow label="GROUND SPEED" value={`${tripInfo.speedKmh} km/h`} />}
          </div>
        </div>
      )}

      {/* Position */}
      <div className="space-y-1">
        <DetailRow label="LATITUDE" value={data.lat?.toFixed(5)} />
        <DetailRow label="LONGITUDE" value={data.lon?.toFixed(5)} />
        <DetailRow label="LAST CONTACT" value={data.lastContact ? new Date(data.lastContact * 1000).toLocaleTimeString() : "N/A"} />
      </div>
    </div>
  );
}

function getCompassDir(deg: number): string {
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(((deg % 360) / 22.5)) % 16];
}

function VesselDetail({ data }: { data: any }) {
  // Decode digitraffic ETA integer: MMDDHHII format
  const decodeETA = (eta: number | null | undefined): string | null => {
    if (!eta || eta === 0) return null;
    const month = Math.floor(eta / 1000000) % 100;
    const day = Math.floor(eta / 10000) % 100;
    const hour = Math.floor(eta / 100) % 100;
    const minute = eta % 100;
    if (month === 0 && day === 0) return null;
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const mStr = month >= 1 && month <= 12 ? months[month-1] : '?';
    return `${day} ${mStr} ${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UTC`;
  };

  // Calculate voyage info
  const voyageInfo = useMemo(() => {
    const speedKmh = (data.speed || 0) * 1.852;
    const speedMph = (data.speed || 0) * 1.151;
    const navDesc = navStatusText(data.navStatus);
    const isMoving = data.speed > 0.5;
    const etaStr = decodeETA(data.eta);
    return { speedKmh: Math.round(speedKmh), speedMph: Math.round(speedMph), navDesc, isMoving, etaStr };
  }, [data]);

  const statusColor = data.navStatus === 0 ? "#22c55e" : data.navStatus === 1 || data.navStatus === 5 ? "#f59e0b" : data.navStatus === 6 ? "#ef4444" : "#3b82f6";

  return (
    <div className="space-y-3">
      {/* Vessel Image */}
      {data.imageUrl && (
        <div className="relative rounded-lg overflow-hidden border border-border/30 bg-black/20">
          <div className="aspect-[16/9] relative">
            <img src={data.imageUrl} alt={data.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-2 left-2">
              <div className="text-[12px] font-mono font-bold text-white">{data.name}</div>
              <div className="text-[9px] font-mono text-white/70">{data.typeLabel} • {data.flag}</div>
            </div>
            <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold" style={{ background: data.typeColor + "30", color: data.typeColor, border: `1px solid ${data.typeColor}50` }}>
              {data.typeLabel?.toUpperCase()}
            </div>
          </div>
        </div>
      )}
      {!data.imageUrl && (
        <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-[14px] font-mono font-bold mb-0.5" style={{ color: "#3b82f6" }}>{data.name}</div>
              <div className="text-[10px] text-muted-foreground font-mono uppercase">{data.typeLabel || data.type} • {data.flag}</div>
            </div>
            <div className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded" style={{ background: statusColor + "20", color: statusColor, border: `1px solid ${statusColor}50` }}>
              {voyageInfo.isMoving ? "UNDERWAY" : "STATIONARY"}
            </div>
          </div>
        </div>
      )}

      {/* Voyage Route */}
      <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg p-3">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">VOYAGE ROUTE</div>
        {(data.destination && data.destination !== "") ? (
          <>
            <div className="flex items-center justify-between mb-2">
              <div className="text-center">
                <div className="text-[11px] font-mono font-bold" style={{ color: "#3b82f6" }}>{typeof data.origin === 'string' && data.origin ? data.origin : "—"}</div>
                <div className="text-[7px] text-muted-foreground">LAST PORT</div>
              </div>
              <div className="flex-1 mx-3 relative">
                <div className="h-px bg-blue-500/30 w-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400" style={{ boxShadow: "0 0 6px #3b82f6" }} />
                </div>
              </div>
              <div className="text-center">
                <div className="text-[11px] font-mono font-bold" style={{ color: "#3b82f6" }}>{typeof data.destination === 'string' ? data.destination : data.destination?.code || "—"}</div>
                <div className="text-[7px] text-muted-foreground">DESTINATION</div>
              </div>
            </div>
            {voyageInfo.etaStr && (
              <div className="flex items-center justify-between pt-2 border-t border-blue-500/20">
                <div className="text-[8px] font-mono text-muted-foreground">ETA</div>
                <div className="text-[10px] font-mono font-bold" style={{ color: "#22c55e" }}>{voyageInfo.etaStr}</div>
              </div>
            )}
          </>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-full h-px border-t border-dashed border-blue-500/30" />
              <div className="text-[8px] font-mono text-blue-400 whitespace-nowrap">
                {data.cog ? `COG ${data.cog.toFixed(0)}° ${getCompassDir(data.cog)}` : "NO COURSE"}
              </div>
              <div className="w-full h-px border-t border-dashed border-blue-500/30" />
            </div>
            <div className="text-[8px] font-mono text-muted-foreground/60 text-center">No destination in AIS broadcast</div>
            {data.speed > 0.5 && <div className="text-[8px] font-mono text-muted-foreground/50 text-center">Heading projection shown on map</div>}
          </div>
        )}
      </div>

      {/* Navigation Status */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">NAVIGATION</div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <DetailRow label="SPEED" value={`${data.speed?.toFixed(1) || 0} kts (${voyageInfo.speedKmh} km/h)`} />
          <DetailRow label="COURSE" value={data.cog ? `${data.cog.toFixed(1)}° ${getCompassDir(data.cog)}` : "N/A"} />
          <DetailRow label="HEADING" value={data.heading ? `${data.heading}° ${getCompassDir(data.heading)}` : "N/A"} />
          <DetailRow label="NAV STATUS" value={voyageInfo.navDesc} />
        </div>
      </div>

      {/* Vessel Identification */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">IDENTIFICATION</div>
        <div className="space-y-1">
          <DetailRow label="MMSI" value={data.mmsi} />
          <DetailRow label="IMO" value={data.imo ? String(data.imo) : "N/A"} />
          <DetailRow label="CALL SIGN" value={data.callSign || "N/A"} />
          <DetailRow label="TYPE" value={data.typeLabel?.toUpperCase() || data.type?.toUpperCase()} />
          <DetailRow label="FLAG" value={data.flag} />
          <DetailRow label="REGION" value={data.region || "N/A"} />
        </div>
      </div>

      {/* Physical Characteristics */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">VESSEL SPECS</div>
        <div className="space-y-1">
          {data.length && <DetailRow label="LENGTH" value={`${data.length} m`} />}
          {data.draught && <DetailRow label="DRAUGHT" value={`${typeof data.draught === 'number' ? data.draught.toFixed(1) : data.draught} m`} />}
          <DetailRow label="SHIP TYPE CODE" value={data.shipTypeCode ? String(data.shipTypeCode) : "N/A"} />
        </div>
      </div>

      {/* Destination & Position */}
      <div className="bg-muted/20 rounded-lg p-2.5 border border-border/20">
        <div className="text-[8px] font-mono text-muted-foreground mb-2 font-bold uppercase">POSITION</div>
        <div className="space-y-1">
          <DetailRow label="LATITUDE" value={data.lat?.toFixed(5)} />
          <DetailRow label="LONGITUDE" value={data.lon?.toFixed(5)} />
          <DetailRow label="DESTINATION" value={(typeof data.destination === 'string' ? data.destination : data.destination?.name) || "N/A"} />
          <DetailRow label="ORIGIN" value={(typeof data.origin === 'string' ? data.origin : data.origin?.name) || "N/A"} />
        </div>
      </div>
    </div>
  );
}

function QuakeDetail({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
        <div className="text-[18px] font-mono font-bold mb-1" style={{ color: data.magnitude >= 6 ? "#ef4444" : data.magnitude >= 4 ? "#f97316" : "#eab308" }}>M {data.magnitude?.toFixed(1)}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{data.place}</div>
      </div>
      <div className="space-y-2">
        <DetailRow label="MAGNITUDE" value={data.magnitude?.toFixed(1)} />
        <DetailRow label="LOCATION" value={data.place} />
        <DetailRow label="TIME" value={new Date(data.time).toLocaleString()} />
        <DetailRow label="DEPTH" value={`${data.depth?.toFixed(1)} km`} />
        <DetailRow label="SIGNIFICANCE" value={String(data.significance)} />
        {data.tsunami > 0 && (
          <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/10 rounded px-2 py-1.5 border border-amber-500/30">
            <AlertTriangle size={12} /><span className="text-[10px] font-mono font-bold">TSUNAMI WARNING</span>
          </div>
        )}
        <DetailRow label="LATITUDE" value={data.lat?.toFixed(5)} />
        <DetailRow label="LONGITUDE" value={data.lon?.toFixed(5)} />
      </div>
      {data.url && <a href={data.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-mono text-primary hover:text-primary/80"><ExternalLink size={10} /> View on USGS</a>}
    </div>
  );
}

function FireDetail({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
        <div className="text-[13px] font-mono font-bold mb-1" style={{ color: "#f97316" }}>{data.title}</div>
        <div className="text-[10px] text-muted-foreground font-mono">Active Wildfire</div>
      </div>
      <div className="space-y-2">
        <DetailRow label="EVENT" value={data.title} />
        <DetailRow label="DATE" value={data.date ? new Date(data.date).toLocaleString() : "N/A"} />
        <DetailRow label="SOURCE" value={data.source} />
        <DetailRow label="LATITUDE" value={data.lat?.toFixed(5)} />
        <DetailRow label="LONGITUDE" value={data.lon?.toFixed(5)} />
      </div>
    </div>
  );
}

function WeatherDetail({ data }: { data: any }) {
  return (
    <div className="space-y-3">
      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
        <div className="text-[13px] font-mono font-bold mb-1" style={{ color: "#10b981" }}>{data.title}</div>
        <div className="text-[10px] text-muted-foreground font-mono">{data.category}</div>
      </div>
      <div className="space-y-2">
        <DetailRow label="EVENT" value={data.title} />
        <DetailRow label="CATEGORY" value={data.category} />
        <DetailRow label="DATE" value={data.date ? new Date(data.date).toLocaleString() : "N/A"} />
        <DetailRow label="SOURCE" value={data.source} />
        <DetailRow label="LATITUDE" value={data.lat?.toFixed(5)} />
        <DetailRow label="LONGITUDE" value={data.lon?.toFixed(5)} />
      </div>
    </div>
  );
}

// ─── Camera Feed Panel (Live Feed + Nearest Cameras) — DOUBLE-BUFFER ────────
function CameraFeedPanel({ camera, allCameras, onSelectCamera, highlightLayer, map, onPinCamera }: { camera: any; allCameras: any[]; onSelectCamera: (cam: any) => void; highlightLayer: L.LayerGroup | null; map: L.Map | null; onPinCamera?: (cam: any) => void }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [frameCount, setFrameCount] = useState(0);
  const [lastRefreshTime, setLastRefreshTime] = useState<Date>(new Date());

  // Double-buffer state: two image slots, crossfade between them
  const [bufferA, setBufferA] = useState<string | null>(null);
  const [bufferB, setBufferB] = useState<string | null>(null);
  const [activeBuffer, setActiveBuffer] = useState<'A' | 'B'>('A');
  const bufferReadyRef = useRef({ A: false, B: false });

  // Determine feed type: iframe stream, MJPEG, or refreshing image
  const isIframeStream = !!(camera.streamUrl && camera.streamType === 'iframe');
  const isMjpeg = !isIframeStream && (camera.type === "stream" || /mjpg|mjpeg|video\.mjpg/i.test(camera.feedUrl || ""));
  const isLiveFeed = isIframeStream || isMjpeg;
  const feedMode = camera.feedMode || (isLiveFeed ? 'live' : 'periodic');

  // Refresh interval: MJPEG live = 2s, periodic images = 5s
  const MJPEG_REFRESH = 2000;
  const PERIODIC_REFRESH = 5000;
  const REFRESH_INTERVAL = isMjpeg ? MJPEG_REFRESH : PERIODIC_REFRESH;
  const [fetchTick, setFetchTick] = useState(0);
  useEffect(() => {
    // iframe streams don't need refresh; MJPEG and periodic both use polling
    if (isIframeStream || !camera.feedUrl) return;
    const interval = setInterval(() => setFetchTick(t => t + 1), REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [camera.feedUrl, isIframeStream, REFRESH_INTERVAL]);

  // Proxy query for image-type cameras (periodic)
  const proxyQuery = trpc.sigint.proxyCCTVImage.useQuery(
    { url: camera.feedUrl, _t: fetchTick, lat: camera.latitude || camera.lat, lon: camera.longitude || camera.lon, name: camera.name },
    { enabled: !!camera.feedUrl && !isIframeStream && !isMjpeg, staleTime: 0, gcTime: 0 }
  );

  // MJPEG proxy: use the /api/mjpeg-frame endpoint to get individual frames
  const [mjpegFrameUrl, setMjpegFrameUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!isMjpeg || !camera.feedUrl || isIframeStream) return;
    // Build the proxy URL with cache-busting
    const proxyUrl = `/api/mjpeg-frame?url=${encodeURIComponent(camera.feedUrl)}&_t=${fetchTick}`;
    setMjpegFrameUrl(proxyUrl);
  }, [isMjpeg, camera.feedUrl, isIframeStream, fetchTick]);

  const feedHealth = proxyQuery.data?.health || null;
  const currentHash = proxyQuery.data?.hash || null;

  // Track actual content changes (hash-based)
  const [lastHashRef, setLastHashRef] = useState<string | null>(null);
  const [contentChangeCount, setContentChangeCount] = useState(0);
  const [lastContentChange, setLastContentChange] = useState<Date | null>(null);

  // DOUBLE-BUFFER: When new data arrives, load it into the inactive buffer
  useEffect(() => {
    if (isIframeStream) { setLoading(false); setError(false); return; }
    // For MJPEG cameras, use the mjpegFrameUrl
    if (isMjpeg && mjpegFrameUrl) {
      const newSrc = mjpegFrameUrl;
      if (activeBuffer === 'A') {
        setBufferB(newSrc);
        bufferReadyRef.current.B = false;
      } else {
        setBufferA(newSrc);
        bufferReadyRef.current.A = false;
      }
      setLoading(false);
      setError(false);
      setFrameCount(prev => prev + 1);
      setLastRefreshTime(new Date());
      return;
    }
    if (proxyQuery.data?.data) {
      const newSrc = proxyQuery.data.data;
      setLoading(false);
      setError(false);
      setFrameCount(prev => prev + 1);
      setLastRefreshTime(new Date());

      // Detect actual content change via hash
      if (currentHash && currentHash !== lastHashRef) {
        setLastHashRef(currentHash);
        setContentChangeCount(prev => prev + 1);
        setLastContentChange(new Date());
      }

      // Load into inactive buffer, then swap
      if (activeBuffer === 'A') {
        // Load into B, then swap to B
        setBufferB(newSrc);
        bufferReadyRef.current.B = false;
      } else {
        // Load into A, then swap to A
        setBufferA(newSrc);
        bufferReadyRef.current.A = false;
      }
    } else if (proxyQuery.isError || (proxyQuery.data && !proxyQuery.data.data)) {
      setLoading(false);
      setError(true);
    }
  }, [proxyQuery.data, proxyQuery.isError, proxyQuery.dataUpdatedAt, isIframeStream, isMjpeg, mjpegFrameUrl, currentHash, lastHashRef, activeBuffer]);

  // When inactive buffer image loads, swap it to front
  const handleBufferLoad = useCallback((buffer: 'A' | 'B') => {
    bufferReadyRef.current[buffer] = true;
    setActiveBuffer(buffer);
  }, []);

  // Calculate 5 nearest cameras using Haversine distance
  const nearestCameras = useMemo(() => {
    if (!camera.lat || !camera.lon || !allCameras.length) return [];
    const toRad = (d: number) => d * Math.PI / 180;
    const haversine = (lat1: number, lon1: number, lat2: number, lon2: number) => {
      const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon/2)**2;
      return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    };
    return allCameras
      .filter(c => c.id !== camera.id && c.lat && c.lon)
      .map(c => ({ ...c, distance: haversine(camera.lat, camera.lon, c.lat, c.lon) }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 5);
  }, [camera, allCameras]);

  // Highlight nearest cameras on the map
  useEffect(() => {
    if (!highlightLayer || !map) return;
    highlightLayer.clearLayers();
    nearestCameras.forEach(cam => {
      const marker = L.circleMarker([cam.lat, cam.lon], {
        radius: 8, fillColor: "#fbbf24", fillOpacity: 0.9, color: "#ffffff", weight: 2, opacity: 1,
      });
      marker.bindTooltip(cam.name, { permanent: false, direction: "top", className: "text-[9px] font-mono" });
      highlightLayer.addLayer(marker);
    });
    // Also highlight the selected camera
    const selected = L.circleMarker([camera.lat, camera.lon], {
      radius: 10, fillColor: "#a855f7", fillOpacity: 1, color: "#ffffff", weight: 3, opacity: 1,
    });
    highlightLayer.addLayer(selected);
    return () => { highlightLayer.clearLayers(); };
  }, [nearestCameras, camera, highlightLayer, map]);

  return (
    <div className="space-y-3">
      {/* Camera Header with Feed Mode Badge */}
      <div className="bg-muted/30 rounded-lg p-3 border border-border/30">
        <div className="flex items-center justify-between mb-1">
          <div className="text-[13px] font-mono font-bold" style={{ color: feedMode === 'live' ? '#22c55e' : '#a855f7' }}>{camera.name}</div>
          <div className="flex items-center gap-1.5">
            {onPinCamera && (
              <button
                onClick={() => onPinCamera(camera)}
                className="px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 transition-colors"
                title="Pin to floating mini-player"
              >
                📌 PIN
              </button>
            )}
            <div className={`px-2 py-0.5 rounded text-[8px] font-mono font-bold uppercase tracking-wider ${
              feedMode === 'live' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-purple-500/20 text-purple-400 border border-purple-500/40'
            }`}>
              {feedMode === 'live' ? '● LIVE STREAM' : '◎ PERIODIC'}
            </div>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground font-mono">{camera.city}, {camera.countryName || camera.country}</div>
        <div className="text-[9px] text-muted-foreground/70 font-mono mt-0.5">
          {isIframeStream ? "EMBEDDED VIDEO — REAL-TIME" : isMjpeg ? "MJPEG STREAM — REAL-TIME" : `IMAGE FEED — REFRESHES EVERY ${REFRESH_INTERVAL / 1000}s (SEAMLESS)`}
        </div>
      </div>

      {/* Live Feed Viewer — DOUBLE BUFFER (no flicker) */}
      <div className="relative rounded-lg overflow-hidden border border-border/30 bg-black">
        <div className="aspect-video relative">
          {loading && !isIframeStream && (
            <div className="absolute inset-0 flex items-center justify-center bg-black z-20">
              <div className="text-center">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <div className="text-[10px] font-mono text-muted-foreground">Acquiring feed...</div>
              </div>
            </div>
          )}
          {/* IFRAME STREAM (YouTube / Windy embed) */}
          {isIframeStream && (
            <iframe
              src={camera.streamUrl}
              className="w-full h-full border-0"
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
              title={camera.name}
              onLoad={() => { setLoading(false); setError(false); }}
            />
          )}
          {/* DOUBLE-BUFFER IMAGE FEED — Works for both MJPEG (proxied) and periodic cameras */}
          {!isIframeStream && !error && (
            <>
              {bufferA && (
                <img
                  src={bufferA}
                  alt={camera.name}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
                  style={{ opacity: activeBuffer === 'A' ? 1 : 0, zIndex: activeBuffer === 'A' ? 2 : 1 }}
                  onLoad={() => handleBufferLoad('A')}
                  onError={() => { setError(true); }}
                />
              )}
              {bufferB && (
                <img
                  src={bufferB}
                  alt={camera.name}
                  className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ease-in-out"
                  style={{ opacity: activeBuffer === 'B' ? 1 : 0, zIndex: activeBuffer === 'B' ? 2 : 1 }}
                  onLoad={() => handleBufferLoad('B')}
                  onError={() => { setError(true); }}
                />
              )}
            </>
          )}
          {/* ERROR / FALLBACK */}
          {!isIframeStream && error && !bufferA && !bufferB && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
              <div className="text-center">
                <Camera size={24} className="text-muted-foreground mx-auto mb-1" />
                <div className="text-[10px] font-mono text-muted-foreground">Initializing feed...</div>
                <a href={camera.feedUrl || camera.streamUrl} target="_blank" rel="noopener noreferrer" className="text-[9px] font-mono text-primary hover:underline flex items-center gap-1 justify-center mt-1">Open directly <ExternalLink size={8} /></a>
              </div>
            </div>
          )}
          {/* Overlay HUD */}
          <div className="absolute top-1.5 left-1.5 flex items-center gap-1.5 z-30">
            <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${feedMode === 'live' ? 'bg-emerald-600/90' : 'bg-purple-600/90'}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${feedMode === 'live' ? 'bg-white animate-pulse' : 'bg-purple-200'}`} />
              <span className="text-[8px] font-bold font-mono text-white">{feedMode === 'live' ? 'LIVE' : 'PERIODIC'}</span>
            </div>
            {feedHealth && feedHealth !== 'dead' && (
              <div className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${
                feedHealth === 'active' ? 'bg-green-600/80' : 'bg-yellow-600/80'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  feedHealth === 'active' ? 'bg-green-300' : 'bg-yellow-300 animate-pulse'
                }`} />
                <span className="text-[7px] font-bold font-mono text-white uppercase">{feedHealth}</span>
              </div>
            )}
          </div>
          {/* Bottom HUD — Quality Indicators */}
          <div className="absolute bottom-1.5 left-1.5 right-12 flex items-center gap-1 flex-wrap z-30">
            <div className="bg-black/80 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="text-[7px] font-mono text-cyan-400">FPS</span>
              <span className="text-[8px] font-mono text-white font-bold">{isMjpeg ? Math.round(1000 / 2000) : Math.round(1000 / PERIODIC_REFRESH)}</span>
            </div>
            <div className="bg-black/80 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="text-[7px] font-mono text-amber-400">LAT</span>
              <span className="text-[8px] font-mono text-white font-bold">{proxyQuery.data ? `${Math.round((proxyQuery.dataUpdatedAt || 0) - (proxyQuery.data?.ts || Date.now()) + 200)}ms` : '—'}</span>
            </div>
            <div className="bg-black/80 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="text-[7px] font-mono text-emerald-400">F</span>
              <span className="text-[8px] font-mono text-white font-bold">{frameCount}</span>
            </div>
            <div className="bg-black/80 px-1.5 py-0.5 rounded flex items-center gap-1">
              <span className="text-[7px] font-mono text-purple-400">Δ</span>
              <span className={`text-[8px] font-mono font-bold ${contentChangeCount > 0 ? 'text-emerald-300' : 'text-yellow-300'}`}>{contentChangeCount}</span>
            </div>
            <div className="bg-black/80 px-1.5 py-0.5 rounded">
              <span className="text-[7px] font-mono text-white/60">{lastRefreshTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
            </div>
          </div>
          <button onClick={() => { if (isMjpeg) { setFetchTick(t => t + 1); } else { proxyQuery.refetch(); } }} className="absolute top-1.5 right-1.5 bg-black/70 hover:bg-black/90 text-white p-1 rounded transition-colors z-30" title="Force refresh">
            <RotateCcw size={10} className={proxyQuery.isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Camera Details */}
      <div className="space-y-2">
        {/* Enhanced SOURCE row with reference link */}
        <div className="flex justify-between items-start gap-2 py-1 border-b border-border/20">
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">SOURCE</span>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[10px] font-mono text-right">{camera.source || "—"}</span>
            {camera.sourceRef ? (
              <a
                href={camera.sourceRef}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-0.5 text-[8px] font-mono text-purple-400/80 hover:text-purple-300 transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                <ExternalLink size={7} />
                <span className="max-w-[160px] truncate">{camera.sourceRef.replace(/^https?:\/\//, '').replace(/\/$/, '')}</span>
              </a>
            ) : (
              <span className="text-[8px] font-mono text-muted-foreground/40">Open-source / Public API</span>
            )}
          </div>
        </div>
        <DetailRow label="FEED MODE" value={isIframeStream ? '● LIVE — Real-time video stream' : isMjpeg ? `● LIVE — MJPEG proxied (${MJPEG_REFRESH/1000}s frames)` : `◎ PERIODIC — Refreshes every ${PERIODIC_REFRESH / 1000}s`} />
        <DetailRow label="HEALTH" value={isMjpeg ? (error ? '○ DEAD — Cannot reach' : '● ACTIVE — MJPEG streaming') : feedHealth === 'active' ? '● ACTIVE — Feed updating' : feedHealth === 'stale' ? '◐ STALE — No change >10min' : feedHealth === 'dead' ? '○ DEAD — Cannot reach' : 'Analyzing...'} />
        <DetailRow label="CONTENT Δ" value={`${contentChangeCount} unique frames detected`} />
        {lastContentChange && <DetailRow label="LAST CHANGE" value={lastContentChange.toLocaleTimeString()} />}
        <DetailRow label="CITY" value={camera.city} />
        <DetailRow label="COUNTRY" value={camera.countryName || camera.country} />
        {camera.road && <DetailRow label="ROAD" value={camera.road} />}
        {camera.direction && <DetailRow label="DIRECTION" value={camera.direction} />}
        <DetailRow label="LATITUDE" value={camera.lat?.toFixed(5)} />
        <DetailRow label="LONGITUDE" value={camera.lon?.toFixed(5)} />
      </div>

      {/* Stale Camera Warning + Auto-suggest */}
      {feedHealth === 'stale' && nearestCameras.length > 0 && (
        <div className="border border-yellow-500/40 bg-yellow-500/10 rounded-lg p-2.5">
          <div className="text-[10px] font-mono font-bold text-yellow-400 mb-1.5 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            FEED STALE — SWITCH RECOMMENDED
          </div>
          <div className="text-[9px] font-mono text-yellow-300/80 mb-2">This camera hasn't updated in over 10 minutes. Try a nearby active camera:</div>
          <div className="space-y-1">
            {nearestCameras.slice(0, 3).map((cam, i) => (
              <button
                key={cam.id || i}
                onClick={() => onSelectCamera(cam)}
                className="w-full text-left p-1.5 rounded bg-yellow-500/10 hover:bg-yellow-500/20 border border-yellow-500/30 hover:border-yellow-400 transition-all"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-mono text-yellow-200 truncate max-w-[160px]">{cam.name}</span>
                  <span className="text-[8px] font-mono text-yellow-400 shrink-0">{cam.distance < 1 ? `${Math.round(cam.distance * 1000)}m` : `${cam.distance.toFixed(1)}km`}</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Nearest Cameras Section with Search */}
      {nearestCameras.length > 0 && (
        <div className="border-t border-border/30 pt-3">
          <div className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-400" />
            NEAREST CAMERAS ({nearestCameras.length})
          </div>
          <div className="space-y-1.5">
            {nearestCameras.map((cam, i) => (
              <button
                key={cam.id || i}
                onClick={() => onSelectCamera(cam)}
                className="w-full text-left p-2 rounded bg-muted/20 hover:bg-muted/40 border border-border/20 hover:border-purple-500/50 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cam.feedMode === 'live' ? 'bg-emerald-400' : 'bg-purple-400'}`} />
                    <span className="text-[10px] font-mono text-foreground/90 truncate group-hover:text-purple-400 transition-colors">{cam.name}</span>
                  </div>
                  <span className="text-[9px] font-mono text-muted-foreground shrink-0 ml-2">{cam.distance < 1 ? `${Math.round(cam.distance * 1000)}m` : `${cam.distance.toFixed(1)}km`}</span>
                </div>
                <div className="text-[8px] font-mono text-muted-foreground/60 mt-0.5 ml-3">{cam.city || cam.source} • {cam.feedMode === 'live' ? 'LIVE' : 'PERIODIC'}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      <a href={camera.streamUrl || camera.feedUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] font-mono text-primary hover:text-primary/80"><ExternalLink size={10} /> Open feed source</a>
    </div>
  );
}

// ─── Helper Components ──────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: string | undefined }) {
  return (
    <div className="flex justify-between items-start gap-2 py-1 border-b border-border/20">
      <span className="text-[9px] font-mono text-muted-foreground shrink-0">{label}</span>
      <span className="text-[10px] font-mono text-right break-all">{value || "—"}</span>
    </div>
  );
}

function navStatusText(code: number | undefined): string {
  if (code === undefined || code === null) return "N/A";
  const statuses: Record<number, string> = { 0: "Under way using engine", 1: "At anchor", 2: "Not under command", 3: "Restricted manoeuvrability", 4: "Constrained by draught", 5: "Moored", 6: "Aground", 7: "Engaged in fishing", 8: "Under way sailing", 14: "AIS-SART", 15: "Not defined" };
  return statuses[code] || `Status ${code}`;
}
