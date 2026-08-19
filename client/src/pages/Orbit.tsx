import { useRef, useState, useEffect, useCallback, useMemo } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import { loadPrefs, type HeaderItem } from "@/lib/headerPrefs";
import { Sun, Moon, RotateCcw, Maximize2, Minimize2 } from "lucide-react";
import DisclaimerModal from "@/components/DisclaimerModal";
import SessionIndicator from "@/components/SessionIndicator";
import { UpgradeButton } from "@/components/UpgradeButton";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { trpc } from "@/lib/trpc";
import { useLiveStream } from "@/hooks/useLiveStream";
// @ts-ignore
import * as satellite from "satellite.js";

// ─── Constants ────────────────────────────────────────────────────────────────
const EARTH_RADIUS_KM = 6371;
const GLOBE_R = 1.0;
const EARTH_DAY_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_texture_39ccd4c2.jpg";
const EARTH_NIGHT_URL = "https://d2xsxph8kpxj0f.cloudfront.net/310419663026724153/VRmg57SSnuBtigQkBoMMSk/earth_night_3440cbe4.jpg";

const ORBIT_RINGS = [
  { label: "LEO 400km",   altKm: 400,   color: "#22d3ee", opacity: 0.18 },
  { label: "MEO 20200km", altKm: 20200, color: "#f59e0b", opacity: 0.13 },
  { label: "GEO 35786km", altKm: 35786, color: "#a78bfa", opacity: 0.10 },
];

const GROUPS = [
  { key: "stations",       label: "Space Stations",  color: "#00ff88" },
  { key: "gps",            label: "GPS",             color: "#f59e0b" },
  { key: "glonass",        label: "GLONASS",         color: "#a78bfa" },
  { key: "beidou",         label: "BeiDou",          color: "#f97316" },
  { key: "galileo",        label: "Galileo",         color: "#06b6d4" },
  { key: "weather",        label: "Weather",         color: "#22d3ee" },
  { key: "science",        label: "Earth Science",   color: "#84cc16" },
  { key: "eo",             label: "Earth Obs.",      color: "#10b981" },
  { key: "military",       label: "Military",        color: "#ef4444" },
  { key: "reconnaissance", label: "Reconnaissance",  color: "#dc2626" },
  { key: "starlink",       label: "Starlink",        color: "#60a5fa" },
  { key: "oneweb",         label: "OneWeb",          color: "#e879f9" },
  { key: "iridium",        label: "Iridium NEXT",    color: "#fbbf24" },
];

// ─── NASA Images API CDN URLs ─────────────────────────────────────────────────
const SAT_IMAGES: Record<string, string> = {
  "ISS":       "https://images-assets.nasa.gov/image/200623_ISS_1/200623_ISS_1~medium.jpg",
  "CSS":       "https://images-assets.nasa.gov/image/s134e006979/s134e006979~medium.jpg",
  "OUTPOST":   "https://images-assets.nasa.gov/image/200623_ISS_1/200623_ISS_1~medium.jpg",
  "NOAA":      "https://images-assets.nasa.gov/image/KSC-2009-1410/KSC-2009-1410~medium.jpg",
  "GOES":      "https://images-assets.nasa.gov/image/KSC-2009-2213/KSC-2009-2213~medium.jpg",
  "METEOSAT":  "https://images-assets.nasa.gov/image/KSC-20161119-PH_KLS01_0098/KSC-20161119-PH_KLS01_0098~medium.jpg",
  "TERRA":     "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001444/GSFC_20171208_Archive_e001444~medium.jpg",
  "AQUA":      "https://images-assets.nasa.gov/image/GSFC_20171208_Archive_e001778/GSFC_20171208_Archive_e001778~thumb.jpg",
  "LANDSAT":   "https://images-assets.nasa.gov/image/PIA18156/PIA18156~small.jpg",
  "HUBBLE":    "https://images-assets.nasa.gov/image/PIA05982/PIA05982~medium.jpg",
  "STARLINK":  "https://images-assets.nasa.gov/image/KSC00pp0543/KSC00pp0543~medium.jpg",
  "IRIDIUM":   "https://images-assets.nasa.gov/image/PIA22452/PIA22452~medium.jpg",
  "BEIDOU":    "https://images-assets.nasa.gov/image/s127e012776/s127e012776~medium.jpg",
  "NAVSTAR":   "https://images-assets.nasa.gov/image/0202264/0202264~medium.jpg",
  "COSMOS":    "https://images-assets.nasa.gov/image/iss040e099399/iss040e099399~medium.jpg",
  "GLONASS":   "https://images-assets.nasa.gov/image/PIA24905/PIA24905~medium.jpg",
  "DMSP":      "https://images-assets.nasa.gov/image/KSC-2009-1367/KSC-2009-1367~medium.jpg",
  "WGS":       "https://images-assets.nasa.gov/image/9022340/9022340~medium.jpg",
  "AEHF":      "https://images-assets.nasa.gov/image/GRC-1998-C-00466/GRC-1998-C-00466~medium.jpg",
  "ONEWEB":    "https://images-assets.nasa.gov/image/iss059e102911/iss059e102911~medium.jpg",
  "DEFAULT":   "https://images-assets.nasa.gov/image/PIA18156/PIA18156~small.jpg",
};

function getSatImage(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const upper = name.toUpperCase();
  for (const [prefix, url] of Object.entries(SAT_IMAGES)) {
    if (prefix !== "DEFAULT" && upper.startsWith(prefix)) return url;
  }
  return SAT_IMAGES.DEFAULT;
}

// ─── TLE Age calculation ──────────────────────────────────────────────────────
function parseTleEpoch(tle1: string): Date | null {
  try {
    const epochStr = tle1.substring(18, 32).trim();
    const year2 = parseInt(epochStr.substring(0, 2), 10);
    const dayFrac = parseFloat(epochStr.substring(2));
    const year = year2 >= 57 ? 1900 + year2 : 2000 + year2;
    const jan1 = new Date(Date.UTC(year, 0, 1));
    const epochMs = jan1.getTime() + (dayFrac - 1) * 86400000;
    return new Date(epochMs);
  } catch { return null; }
}

function getTleAgeDays(tle1: string): number | null {
  const epoch = parseTleEpoch(tle1);
  if (!epoch) return null;
  return (Date.now() - epoch.getTime()) / 86400000;
}

function TleAgeBadge({ tle1, compact = false }: { tle1: string; compact?: boolean }) {
  const ageDays = useMemo(() => getTleAgeDays(tle1), [tle1]);
  if (ageDays === null) return null;
  const age = ageDays;
  const color = age < 3 ? "#22c55e" : age < 7 ? "#f59e0b" : "#ef4444";
  const label = age < 1 ? `${Math.round(age * 24)}h` : `${age.toFixed(1)}d`;
  const warning = age >= 7;
  if (compact) {
    return (
      <span className="inline-flex items-center gap-0.5 font-mono text-[9px] px-1 py-0.5 rounded"
        style={{ background: color + "22", color, border: `1px solid ${color}44` }}
        title={`TLE epoch: ${parseTleEpoch(tle1)?.toUTCString() ?? "unknown"} · ${age.toFixed(1)} days old${warning ? " — ACCURACY DEGRADED" : ""}`}>
        {warning && <span>⚠</span>}TLE {label}
      </span>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded"
      style={{ background: color + "12", border: `1px solid ${color}30` }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color }} />
      <span className="font-mono text-[10px]" style={{ color }}>
        TLE AGE: <strong>{label}</strong>
        {warning && <span className="ml-1 text-red-400">⚠ ACCURACY DEGRADED (&gt;7 days)</span>}
      </span>
      <span className="font-mono text-[9px] text-muted-foreground/60 ml-auto">
        {parseTleEpoch(tle1)?.toUTCString().substring(0, 16) ?? ""}
      </span>
    </div>
  );
}

// ─── Launch Facilities (32 real spaceports) ───────────────────────────────────
const LAUNCH_FACILITIES = [
  { name: "Kennedy Space Center / Cape Canaveral", lat: 28.573, lon: -80.649, country: "USA", operator: "NASA / SpaceX / ULA", status: "ACTIVE", type: "ORBITAL", launches2023: 72, notes: "LC-39A (SpaceX), SLC-41 (ULA)" },
  { name: "Vandenberg SFB", lat: 34.742, lon: -120.574, country: "USA", operator: "SpaceX / ULA / USSF", status: "ACTIVE", type: "ORBITAL", launches2023: 28, notes: "Polar orbit; SLC-4E (Falcon 9)" },
  { name: "SpaceX Starbase (Boca Chica)", lat: 25.997, lon: -97.157, country: "USA", operator: "SpaceX", status: "ACTIVE", type: "ORBITAL", launches2023: 3, notes: "Starship/Super Heavy" },
  { name: "Wallops Flight Facility", lat: 37.940, lon: -75.466, country: "USA", operator: "NASA / Rocket Lab", status: "ACTIVE", type: "ORBITAL", launches2023: 4, notes: "Antares, Minotaur, Electron" },
  { name: "Baikonur Cosmodrome", lat: 45.965, lon: 63.305, country: "Kazakhstan", operator: "Roscosmos", status: "ACTIVE", type: "ORBITAL", launches2023: 18, notes: "Historic Soviet/Russian primary site" },
  { name: "Plesetsk Cosmodrome", lat: 62.927, lon: 40.577, country: "Russia", operator: "Russian MoD", status: "ACTIVE", type: "ORBITAL", launches2023: 12, notes: "Military launches; Soyuz-2, Angara" },
  { name: "Vostochny Cosmodrome", lat: 51.884, lon: 128.334, country: "Russia", operator: "Roscosmos", status: "ACTIVE", type: "ORBITAL", launches2023: 5, notes: "New Russian civilian site" },
  { name: "Jiuquan Satellite Launch Center", lat: 40.958, lon: 100.291, country: "China", operator: "CASC / CNSA", status: "ACTIVE", type: "ORBITAL", launches2023: 22, notes: "Crewed missions (Shenzhou)" },
  { name: "Xichang Satellite Launch Center", lat: 28.246, lon: 102.027, country: "China", operator: "CASC / CNSA", status: "ACTIVE", type: "ORBITAL", launches2023: 19, notes: "GEO launches; BeiDou constellation" },
  { name: "Taiyuan Satellite Launch Center", lat: 38.849, lon: 111.608, country: "China", operator: "CASC / CNSA", status: "ACTIVE", type: "ORBITAL", launches2023: 16, notes: "Sun-synchronous orbit" },
  { name: "Wenchang Space Launch Site", lat: 19.614, lon: 110.951, country: "China", operator: "CASC / CNSA", status: "ACTIVE", type: "ORBITAL", launches2023: 8, notes: "Heavy lift; Long March 5, CSS modules" },
  { name: "Guiana Space Centre (Kourou)", lat: 5.239, lon: -52.769, country: "French Guiana", operator: "ESA / Arianespace", status: "ACTIVE", type: "ORBITAL", launches2023: 7, notes: "Ariane 6, Vega-C; equatorial advantage" },
  { name: "Satish Dhawan Space Centre", lat: 13.733, lon: 80.235, country: "India", operator: "ISRO", status: "ACTIVE", type: "ORBITAL", launches2023: 7, notes: "PSLV, GSLV, LVM3; Chandrayaan" },
  { name: "Tanegashima Space Center", lat: 30.400, lon: 130.975, country: "Japan", operator: "JAXA", status: "ACTIVE", type: "ORBITAL", launches2023: 4, notes: "H-IIA, H3, Epsilon" },
  { name: "Rocket Lab LC-1 (Māhia)", lat: -39.262, lon: 177.864, country: "New Zealand", operator: "Rocket Lab", status: "ACTIVE", type: "ORBITAL", launches2023: 9, notes: "Electron small sat launcher" },
  { name: "Sohae Satellite Launching Station", lat: 39.660, lon: 124.705, country: "North Korea", operator: "NADA / KCNA", status: "ACTIVE", type: "ORBITAL", launches2023: 2, notes: "Kwangmyongsong, Malligyong recon sats" },
  { name: "Tonghae Satellite Launching Ground", lat: 40.854, lon: 129.664, country: "North Korea", operator: "NADA", status: "ACTIVE", type: "ORBITAL", launches2023: 1, notes: "Secondary NK launch site" },
  { name: "Imam Khomeini Space Center", lat: 35.234, lon: 53.921, country: "Iran", operator: "ISA / IRGC", status: "ACTIVE", type: "ORBITAL", launches2023: 3, notes: "Safir, Simorgh, Qaem rockets" },
  { name: "Palmachim Airbase", lat: 31.893, lon: 34.690, country: "Israel", operator: "IAI / MoD", status: "ACTIVE", type: "ORBITAL", launches2023: 2, notes: "Retrograde polar orbit; Ofeq spy sats" },
  { name: "Naro Space Center", lat: 34.432, lon: 127.535, country: "South Korea", operator: "KARI", status: "ACTIVE", type: "ORBITAL", launches2023: 2, notes: "KSLV-II (Nuri)" },
  { name: "Alcântara Launch Center", lat: -2.373, lon: -44.396, country: "Brazil", operator: "AEB", status: "ACTIVE", type: "ORBITAL", launches2023: 1, notes: "Near-equatorial; VLS, Cyclone-4M" },
  { name: "Esrange Space Center", lat: 67.893, lon: 21.063, country: "Sweden", operator: "SSC", status: "ACTIVE", type: "SUBORBITAL", launches2023: 3, notes: "High-latitude research rockets" },
  { name: "Andøya Spaceport", lat: 69.297, lon: 16.020, country: "Norway", operator: "Andøya Space", status: "ACTIVE", type: "SUBORBITAL", launches2023: 2, notes: "Polar orbit research" },
  { name: "Sutherland Spaceport", lat: 58.530, lon: -4.430, country: "UK", operator: "Orbex / HIE", status: "DEVELOPMENT", type: "ORBITAL", launches2023: 0, notes: "UK's first vertical launch site" },
  { name: "SaxaVord Spaceport", lat: 60.833, lon: -0.900, country: "UK (Shetland)", operator: "SaxaVord / Rocket Lab", status: "DEVELOPMENT", type: "ORBITAL", launches2023: 0, notes: "Northernmost European spaceport" },
  { name: "Kapustin Yar", lat: 48.580, lon: 45.793, country: "Russia", operator: "Russian MoD", status: "ACTIVE", type: "SUBORBITAL", launches2023: 3, notes: "Military test range; ballistic missiles" },
  { name: "Dombarovsky / Yasny", lat: 51.059, lon: 59.851, country: "Russia", operator: "ISC Kosmotras", status: "ACTIVE", type: "ORBITAL", launches2023: 1, notes: "Dnepr/Rokot commercial launches" },
  { name: "Uchinoura Space Center", lat: 31.251, lon: 131.082, country: "Japan", operator: "JAXA", status: "ACTIVE", type: "ORBITAL", launches2023: 2, notes: "Epsilon, SS-520; scientific missions" },
  { name: "Pacific Spaceport Complex – Alaska", lat: 57.435, lon: -152.338, country: "USA", operator: "AK Aerospace", status: "ACTIVE", type: "SUBORBITAL", launches2023: 2, notes: "High-latitude launches" },
  { name: "Rocket Lab LC-2 (Wallops)", lat: 37.840, lon: -75.488, country: "USA", operator: "Rocket Lab", status: "ACTIVE", type: "ORBITAL", launches2023: 2, notes: "Electron from US soil; NROL missions" },
  { name: "Jiamusi Deep Space Station", lat: 46.887, lon: 130.421, country: "China", operator: "CNSA", status: "ACTIVE", type: "DEEP_SPACE", launches2023: 0, notes: "China's 66m deep space antenna" },
  { name: "Haiyang Commercial Launch Site", lat: 36.780, lon: 119.740, country: "China", operator: "Galactic Energy / iSpace", status: "ACTIVE", type: "ORBITAL", launches2023: 6, notes: "Sea launch platform; commercial" },
];

// ─── Ground Stations (35 real stations) ──────────────────────────────────────
const GROUND_STATIONS = [
  // NASA DSN
  { name: "DSN Goldstone", lat: 35.426, lon: -116.890, country: "USA", operator: "NASA/JPL", type: "DEEP_SPACE", status: "ACTIVE", notes: "70m dish; Mars, Voyager comms" },
  { name: "DSN Madrid (Robledo)", lat: 40.431, lon: -4.249, country: "Spain", operator: "NASA/JPL", type: "DEEP_SPACE", status: "ACTIVE", notes: "70m dish; European DSN complex" },
  { name: "DSN Canberra (Tidbinbilla)", lat: -35.401, lon: 148.982, country: "Australia", operator: "NASA/JPL", type: "DEEP_SPACE", status: "ACTIVE", notes: "70m dish; southern hemisphere DSN" },
  // ESA ESTRACK
  { name: "ESOC Darmstadt", lat: 49.871, lon: 8.623, country: "Germany", operator: "ESA", type: "MISSION_CONTROL", status: "ACTIVE", notes: "ESA mission control; Sentinel, Gaia" },
  { name: "Kiruna Ground Station", lat: 67.858, lon: 20.966, country: "Sweden", operator: "ESA / SSC", type: "LEO_POLAR", status: "ACTIVE", notes: "Polar orbit passes; Sentinel, ERS" },
  { name: "Maspalomas Ground Station", lat: 27.763, lon: -15.634, country: "Spain (Canary Is.)", operator: "ESA", type: "LEO", status: "ACTIVE", notes: "ESA ESTRACK; Envisat, ERS-2" },
  { name: "Svalbard Satellite Station (SvalSat)", lat: 78.229, lon: 15.408, country: "Norway (Svalbard)", operator: "KSAT", type: "LEO_POLAR", status: "ACTIVE", notes: "World's northernmost commercial station" },
  { name: "Troll Satellite Station", lat: -72.012, lon: 2.535, country: "Antarctica", operator: "KSAT", type: "LEO_POLAR", status: "ACTIVE", notes: "Antarctic polar orbit coverage" },
  // Military / Intelligence (SIGINT)
  { name: "Pine Gap", lat: -23.799, lon: 133.737, country: "Australia", operator: "CIA / NSA / ASD", type: "SIGINT", status: "ACTIVE", notes: "Joint US-Australia SIGINT; 38 radomes; missile early warning" },
  { name: "Menwith Hill Station", lat: 54.005, lon: -1.685, country: "UK", operator: "NSA / GCHQ", type: "SIGINT", status: "ACTIVE", notes: "Largest SIGINT station globally; 33 radomes; ECHELON node" },
  { name: "Bad Aibling Station", lat: 47.871, lon: 11.998, country: "Germany", operator: "BND / NSA", type: "SIGINT", status: "ACTIVE", notes: "German-US SIGINT cooperation" },
  { name: "Misawa Air Base", lat: 40.703, lon: 141.368, country: "Japan", operator: "NSA / JASDF", type: "SIGINT", status: "ACTIVE", notes: "SIGINT collection; North Korea monitoring" },
  { name: "Morwenstow (GCHQ Bude)", lat: 50.888, lon: -4.551, country: "UK", operator: "GCHQ", type: "SIGINT", status: "ACTIVE", notes: "Undersea cable tapping; 21 radomes; ECHELON" },
  { name: "Waihopai Station", lat: -41.717, lon: 173.783, country: "New Zealand", operator: "GCSB / NSA", type: "SIGINT", status: "ACTIVE", notes: "Five Eyes SIGINT; Pacific coverage" },
  { name: "Schriever SFB (GPS MCS)", lat: 38.803, lon: -104.527, country: "USA", operator: "USSF / 50th SW", type: "GPS_CONTROL", status: "ACTIVE", notes: "GPS Master Control Station; constellation management" },
  { name: "Buckley SFB", lat: 39.717, lon: -104.752, country: "USA", operator: "USSF / NRO", type: "SIGINT", status: "ACTIVE", notes: "NRO satellite downlink; SIGINT collection" },
  // Russian / Chinese
  { name: "TsUP Mission Control Moscow", lat: 55.752, lon: 37.622, country: "Russia", operator: "Roscosmos", type: "MISSION_CONTROL", status: "ACTIVE", notes: "Russian mission control; ISS, crewed missions" },
  { name: "Beijing Aerospace Control Center", lat: 39.907, lon: 116.391, country: "China", operator: "CNSA / PLA", type: "MISSION_CONTROL", status: "ACTIVE", notes: "Chinese mission control; CSS, Chang'e" },
  { name: "Kashgar Deep Space Station", lat: 39.492, lon: 75.988, country: "China", operator: "CNSA", type: "DEEP_SPACE", status: "ACTIVE", notes: "35m dish; lunar and deep space" },
  { name: "Neuquén Deep Space Station", lat: -36.232, lon: -70.153, country: "Argentina", operator: "CNSA (China)", type: "DEEP_SPACE", status: "ACTIVE", notes: "Chinese deep space in South America" },
  // Commercial / Starlink Gateways
  { name: "Starlink Gateway – Hawthorne CA", lat: 33.921, lon: -118.328, country: "USA", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "Primary Starlink PoP; California" },
  { name: "Starlink Gateway – Brewster WA", lat: 48.131, lon: -119.783, country: "USA", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "Starlink PoP; Pacific Northwest" },
  { name: "Starlink Gateway – Lanarkshire UK", lat: 55.700, lon: -3.800, country: "UK", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "European Starlink PoP" },
  { name: "Starlink Gateway – Bochum DE", lat: 51.482, lon: 7.219, country: "Germany", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "Central Europe Starlink PoP" },
  { name: "Starlink Gateway – Punta Arenas CL", lat: -53.163, lon: -70.916, country: "Chile", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "Southern hemisphere Starlink PoP" },
  { name: "Starlink Gateway – Awarua NZ", lat: -46.529, lon: 168.378, country: "New Zealand", operator: "SpaceX", type: "STARLINK", status: "ACTIVE", notes: "NZ Starlink PoP" },
  // Other
  { name: "ISRO Telemetry Bangalore", lat: 12.971, lon: 77.594, country: "India", operator: "ISRO", type: "MISSION_CONTROL", status: "ACTIVE", notes: "ISRO mission control; Chandrayaan, Mangalyaan" },
  { name: "JAXA Tsukuba Space Center", lat: 36.056, lon: 140.125, country: "Japan", operator: "JAXA", type: "MISSION_CONTROL", status: "ACTIVE", notes: "JAXA mission control; ISS KIBO module" },
  { name: "Dongara Ground Station", lat: -29.047, lon: 115.349, country: "Australia", operator: "KSAT / Intelsat", type: "COMMERCIAL", status: "ACTIVE", notes: "Indian Ocean coverage" },
  { name: "Redu Ground Station", lat: 50.002, lon: 5.146, country: "Belgium", operator: "ESA", type: "GEO", status: "ACTIVE", notes: "ARTEMIS, ASTRA, telecom satellites" },
  { name: "Dongfang Space Port", lat: 19.614, lon: 110.951, country: "China", operator: "CASC", type: "MISSION_CONTROL", status: "ACTIVE", notes: "Wenchang tracking station" },
  { name: "Yakima Research Station", lat: 46.572, lon: -120.462, country: "USA", operator: "NSA", type: "SIGINT", status: "ACTIVE", notes: "NSA SIGINT collection" },
  { name: "Leitrim Station", lat: 45.328, lon: -75.812, country: "Canada", operator: "CSE", type: "SIGINT", status: "ACTIVE", notes: "Canadian SIGINT; Five Eyes" },
  { name: "Medvezhyi Ozera", lat: 55.921, lon: 38.180, country: "Russia", operator: "Roscosmos / MoD", type: "MILITARY_CONTROL", status: "ACTIVE", notes: "Russian satellite control" },
  { name: "Kourou Ground Station", lat: 5.251, lon: -52.805, country: "French Guiana", operator: "ESA", type: "GEO_LEO", status: "ACTIVE", notes: "Co-located with Ariane launch site" },
];

// ─── OSINT Satellite Imagery Sources ─────────────────────────────────────────
const OSINT_SOURCES = [
  {
    name: "NASA Worldview",
    url: "https://worldview.earthdata.nasa.gov/",
    description: "Real-time satellite imagery from MODIS, VIIRS, Landsat. Updated daily. Free and open.",
    coverage: "Global",
    resolution: "250m–30m",
    latency: "3–24 hours",
    satellites: ["Terra/MODIS", "Aqua/MODIS", "Suomi NPP/VIIRS", "Landsat 8/9"],
    category: "EARTH_OBS",
    color: "#22d3ee",
  },
  {
    name: "Sentinel Hub (ESA EO Browser)",
    url: "https://apps.sentinel-hub.com/eo-browser/",
    description: "Copernicus Sentinel-1 SAR and Sentinel-2 optical imagery. 10m resolution. Free for research.",
    coverage: "Global",
    resolution: "10m–60m",
    latency: "1–5 days",
    satellites: ["Sentinel-1A/B (SAR)", "Sentinel-2A/B", "Sentinel-3", "Sentinel-5P"],
    category: "EARTH_OBS",
    color: "#22d3ee",
  },
  {
    name: "USGS Earth Explorer",
    url: "https://earthexplorer.usgs.gov/",
    description: "Landsat archive back to 1972. Free historical and current imagery. ASTER, EO-1.",
    coverage: "Global",
    resolution: "30m–15m",
    latency: "16-day revisit",
    satellites: ["Landsat 1–9", "EO-1", "ASTER"],
    category: "EARTH_OBS",
    color: "#22d3ee",
  },
  {
    name: "NOAA GOES Viewer",
    url: "https://www.star.nesdis.noaa.gov/GOES/",
    description: "Real-time GOES-East and GOES-West full disk imagery. Updated every 10 minutes.",
    coverage: "Americas + Pacific",
    resolution: "500m–2km",
    latency: "10 minutes",
    satellites: ["GOES-16 (East)", "GOES-18 (West)"],
    category: "WEATHER",
    color: "#60a5fa",
  },
  {
    name: "Himawari Real-Time (JMA)",
    url: "https://himawari8.nict.go.jp/",
    description: "JMA Himawari-8/9 geostationary imagery. Asia-Pacific coverage. 10-minute updates.",
    coverage: "Asia-Pacific",
    resolution: "500m–2km",
    latency: "10 minutes",
    satellites: ["Himawari-8", "Himawari-9"],
    category: "WEATHER",
    color: "#60a5fa",
  },
  {
    name: "Windy Satellite Layer",
    url: "https://www.windy.com/?satellite,0,0,3",
    description: "Live satellite cloud imagery overlaid on weather data. Multiple satellite sources combined.",
    coverage: "Global",
    resolution: "1km",
    latency: "15 minutes",
    satellites: ["GOES", "Meteosat", "Himawari", "FY-4"],
    category: "WEATHER",
    color: "#60a5fa",
  },
  {
    name: "Copernicus Emergency Management",
    url: "https://emergency.copernicus.eu/mapping/",
    description: "Crisis mapping using Sentinel and commercial imagery. Conflict zone and disaster monitoring.",
    coverage: "Global (crisis areas)",
    resolution: "10m",
    latency: "Hours (emergency activation)",
    satellites: ["Sentinel-1/2", "Pléiades", "SPOT"],
    category: "CRISIS",
    color: "#ef4444",
  },
  {
    name: "NASA FIRMS (Fire Detection)",
    url: "https://firms.modaps.eosdis.nasa.gov/map/",
    description: "Near real-time fire detection from MODIS and VIIRS. Updated every 3 hours. Global coverage.",
    coverage: "Global",
    resolution: "375m–1km",
    latency: "3 hours",
    satellites: ["Terra/MODIS", "Aqua/MODIS", "Suomi NPP/VIIRS", "NOAA-20/VIIRS"],
    category: "MONITORING",
    color: "#f59e0b",
  },
  {
    name: "Planet Labs Open Data",
    url: "https://www.planet.com/open-data/",
    description: "High-resolution commercial imagery. Open data for disaster response and humanitarian use.",
    coverage: "Global (crisis areas)",
    resolution: "3m–0.5m",
    latency: "1–3 days",
    satellites: ["PlanetScope", "SkySat", "RapidEye"],
    category: "COMMERCIAL",
    color: "#84cc16",
  },
  {
    name: "Maxar Open Data Program",
    url: "https://www.maxar.com/open-data",
    description: "Very high resolution commercial imagery for crisis events. Sub-meter resolution.",
    coverage: "Crisis areas",
    resolution: "0.3m–0.5m",
    latency: "1–3 days",
    satellites: ["WorldView-1/2/3/4", "GeoEye-1", "QuickBird"],
    category: "COMMERCIAL",
    color: "#84cc16",
  },
  {
    name: "Zoom.Earth (Live Satellite)",
    url: "https://zoom.earth/",
    description: "Live satellite imagery and weather data. Easy-to-use interface with multiple layers.",
    coverage: "Global",
    resolution: "1km",
    latency: "15 minutes",
    satellites: ["GOES", "Meteosat", "Himawari"],
    category: "WEATHER",
    color: "#60a5fa",
  },
  {
    name: "OpenAerialMap",
    url: "https://map.openaerialmap.org/",
    description: "Open repository of aerial and satellite imagery. Community-contributed, disaster response focus.",
    coverage: "Selective global",
    resolution: "Sub-meter",
    latency: "Variable",
    satellites: ["Various commercial + UAV"],
    category: "EARTH_OBS",
    color: "#22d3ee",
  },
];

// ─── Country → coordinates lookup ────────────────────────────────────────────
const COUNTRY_COORDS: Array<{ name: string; lat: number; lon: number }> = [
  { name: "Afghanistan", lat: 33.93, lon: 67.71 },
  { name: "Albania", lat: 41.15, lon: 20.17 },
  { name: "Algeria", lat: 28.03, lon: 1.66 },
  { name: "Angola", lat: -11.20, lon: 17.87 },
  { name: "Argentina", lat: -38.42, lon: -63.62 },
  { name: "Australia", lat: -25.27, lon: 133.78 },
  { name: "Austria", lat: 47.52, lon: 14.55 },
  { name: "Azerbaijan", lat: 40.14, lon: 47.58 },
  { name: "Bahrain", lat: 26.00, lon: 50.55 },
  { name: "Bangladesh", lat: 23.68, lon: 90.36 },
  { name: "Belarus", lat: 53.71, lon: 27.95 },
  { name: "Belgium", lat: 50.50, lon: 4.47 },
  { name: "Bolivia", lat: -16.29, lon: -63.59 },
  { name: "Brazil", lat: -14.24, lon: -51.93 },
  { name: "Bulgaria", lat: 42.73, lon: 25.49 },
  { name: "Canada", lat: 56.13, lon: -106.35 },
  { name: "Chile", lat: -35.68, lon: -71.54 },
  { name: "China", lat: 35.86, lon: 104.20 },
  { name: "Colombia", lat: 4.57, lon: -74.30 },
  { name: "Cuba", lat: 21.52, lon: -77.78 },
  { name: "Czech Republic", lat: 49.82, lon: 15.47 },
  { name: "Denmark", lat: 56.26, lon: 9.50 },
  { name: "Ecuador", lat: -1.83, lon: -78.18 },
  { name: "Egypt", lat: 26.82, lon: 30.80 },
  { name: "Ethiopia", lat: 9.15, lon: 40.49 },
  { name: "Finland", lat: 61.92, lon: 25.75 },
  { name: "France", lat: 46.23, lon: 2.21 },
  { name: "Germany", lat: 51.17, lon: 10.45 },
  { name: "Ghana", lat: 7.95, lon: -1.02 },
  { name: "Greece", lat: 39.07, lon: 21.82 },
  { name: "Hungary", lat: 47.16, lon: 19.50 },
  { name: "India", lat: 20.59, lon: 78.96 },
  { name: "Indonesia", lat: -0.79, lon: 113.92 },
  { name: "Iran", lat: 32.43, lon: 53.69 },
  { name: "Iraq", lat: 33.22, lon: 43.68 },
  { name: "Ireland", lat: 53.41, lon: -8.24 },
  { name: "Israel", lat: 31.05, lon: 34.85 },
  { name: "Italy", lat: 41.87, lon: 12.57 },
  { name: "Japan", lat: 36.20, lon: 138.25 },
  { name: "Jordan", lat: 30.59, lon: 36.24 },
  { name: "Kazakhstan", lat: 48.02, lon: 66.92 },
  { name: "Kenya", lat: -0.02, lon: 37.91 },
  { name: "Kuwait", lat: 29.31, lon: 47.48 },
  { name: "Lebanon", lat: 33.85, lon: 35.86 },
  { name: "Libya", lat: 26.34, lon: 17.23 },
  { name: "Malaysia", lat: 4.21, lon: 108.96 },
  { name: "Mexico", lat: 23.63, lon: -102.55 },
  { name: "Morocco", lat: 31.79, lon: -7.09 },
  { name: "Netherlands", lat: 52.13, lon: 5.29 },
  { name: "New Zealand", lat: -40.90, lon: 174.89 },
  { name: "Nigeria", lat: 9.08, lon: 8.68 },
  { name: "North Korea", lat: 40.34, lon: 127.51 },
  { name: "Norway", lat: 60.47, lon: 8.47 },
  { name: "Oman", lat: 21.51, lon: 55.92 },
  { name: "Pakistan", lat: 30.38, lon: 69.35 },
  { name: "Peru", lat: -9.19, lon: -75.02 },
  { name: "Philippines", lat: 12.88, lon: 121.77 },
  { name: "Poland", lat: 51.92, lon: 19.15 },
  { name: "Portugal", lat: 39.40, lon: -8.22 },
  { name: "Qatar", lat: 25.35, lon: 51.18 },
  { name: "Romania", lat: 45.94, lon: 24.97 },
  { name: "Russia", lat: 61.52, lon: 105.32 },
  { name: "Saudi Arabia", lat: 23.89, lon: 45.08 },
  { name: "Serbia", lat: 44.02, lon: 21.01 },
  { name: "Singapore", lat: 1.35, lon: 103.82 },
  { name: "Somalia", lat: 5.15, lon: 46.20 },
  { name: "South Africa", lat: -30.56, lon: 22.94 },
  { name: "South Korea", lat: 35.91, lon: 127.77 },
  { name: "Spain", lat: 40.46, lon: -3.75 },
  { name: "Sudan", lat: 12.86, lon: 30.22 },
  { name: "Sweden", lat: 60.13, lon: 18.64 },
  { name: "Switzerland", lat: 46.82, lon: 8.23 },
  { name: "Syria", lat: 34.80, lon: 38.99 },
  { name: "Taiwan", lat: 23.70, lon: 120.96 },
  { name: "Thailand", lat: 15.87, lon: 100.99 },
  { name: "Tunisia", lat: 33.89, lon: 9.54 },
  { name: "Turkey", lat: 38.96, lon: 35.24 },
  { name: "Ukraine", lat: 48.38, lon: 31.17 },
  { name: "United Arab Emirates", lat: 23.42, lon: 53.85 },
  { name: "United Kingdom", lat: 55.38, lon: -3.44 },
  { name: "United States", lat: 37.09, lon: -95.71 },
  { name: "Venezuela", lat: 6.42, lon: -66.59 },
  { name: "Vietnam", lat: 14.06, lon: 108.28 },
  { name: "Yemen", lat: 15.55, lon: 48.52 },
];

// ─── Location database for Pass Predictor search ──────────────────────────────
const LOCATION_DB: Array<{ name: string; lat: number; lon: number; type: string }> = [
  ...COUNTRY_COORDS.map(c => ({ ...c, type: "country" })),
  // Major cities
  { name: "New York, USA", lat: 40.71, lon: -74.01, type: "city" },
  { name: "Los Angeles, USA", lat: 34.05, lon: -118.24, type: "city" },
  { name: "Chicago, USA", lat: 41.88, lon: -87.63, type: "city" },
  { name: "Washington DC, USA", lat: 38.91, lon: -77.04, type: "city" },
  { name: "San Francisco, USA", lat: 37.77, lon: -122.42, type: "city" },
  { name: "Miami, USA", lat: 25.76, lon: -80.19, type: "city" },
  { name: "London, UK", lat: 51.51, lon: -0.13, type: "city" },
  { name: "Paris, France", lat: 48.86, lon: 2.35, type: "city" },
  { name: "Berlin, Germany", lat: 52.52, lon: 13.41, type: "city" },
  { name: "Madrid, Spain", lat: 40.42, lon: -3.70, type: "city" },
  { name: "Rome, Italy", lat: 41.90, lon: 12.50, type: "city" },
  { name: "Amsterdam, Netherlands", lat: 52.37, lon: 4.90, type: "city" },
  { name: "Stockholm, Sweden", lat: 59.33, lon: 18.07, type: "city" },
  { name: "Oslo, Norway", lat: 59.91, lon: 10.75, type: "city" },
  { name: "Helsinki, Finland", lat: 60.17, lon: 24.94, type: "city" },
  { name: "Copenhagen, Denmark", lat: 55.68, lon: 12.57, type: "city" },
  { name: "Moscow, Russia", lat: 55.76, lon: 37.62, type: "city" },
  { name: "St. Petersburg, Russia", lat: 59.93, lon: 30.32, type: "city" },
  { name: "Kyiv, Ukraine", lat: 50.45, lon: 30.52, type: "city" },
  { name: "Warsaw, Poland", lat: 52.23, lon: 21.01, type: "city" },
  { name: "Beijing, China", lat: 39.90, lon: 116.40, type: "city" },
  { name: "Shanghai, China", lat: 31.23, lon: 121.47, type: "city" },
  { name: "Tokyo, Japan", lat: 35.68, lon: 139.69, type: "city" },
  { name: "Seoul, South Korea", lat: 37.57, lon: 126.98, type: "city" },
  { name: "Mumbai, India", lat: 19.08, lon: 72.88, type: "city" },
  { name: "New Delhi, India", lat: 28.61, lon: 77.21, type: "city" },
  { name: "Dubai, UAE", lat: 25.20, lon: 55.27, type: "city" },
  { name: "Riyadh, Saudi Arabia", lat: 24.69, lon: 46.72, type: "city" },
  { name: "Tehran, Iran", lat: 35.69, lon: 51.39, type: "city" },
  { name: "Baghdad, Iraq", lat: 33.34, lon: 44.40, type: "city" },
  { name: "Cairo, Egypt", lat: 30.06, lon: 31.25, type: "city" },
  { name: "Nairobi, Kenya", lat: -1.29, lon: 36.82, type: "city" },
  { name: "Lagos, Nigeria", lat: 6.45, lon: 3.39, type: "city" },
  { name: "Johannesburg, South Africa", lat: -26.20, lon: 28.04, type: "city" },
  { name: "Sydney, Australia", lat: -33.87, lon: 151.21, type: "city" },
  { name: "Singapore", lat: 1.35, lon: 103.82, type: "city" },
  { name: "Pyongyang, North Korea", lat: 39.02, lon: 125.75, type: "city" },
  { name: "Taipei, Taiwan", lat: 25.05, lon: 121.53, type: "city" },
  { name: "Kyiv, Ukraine", lat: 50.45, lon: 30.52, type: "city" },
  { name: "Ankara, Turkey", lat: 39.93, lon: 32.86, type: "city" },
  { name: "Kabul, Afghanistan", lat: 34.53, lon: 69.17, type: "city" },
  { name: "Islamabad, Pakistan", lat: 33.72, lon: 73.04, type: "city" },
  { name: "Caracas, Venezuela", lat: 10.48, lon: -66.88, type: "city" },
  { name: "Havana, Cuba", lat: 23.13, lon: -82.38, type: "city" },
  { name: "Minsk, Belarus", lat: 53.90, lon: 27.57, type: "city" },
  // Military / Launch Sites
  { name: "Pentagon, USA", lat: 38.87, lon: -77.06, type: "military" },
  { name: "Cape Canaveral SFS, USA", lat: 28.49, lon: -80.58, type: "launch" },
  { name: "Vandenberg SFB, USA", lat: 34.74, lon: -120.57, type: "launch" },
  { name: "Baikonur Cosmodrome, Kazakhstan", lat: 45.97, lon: 63.31, type: "launch" },
  { name: "Sohae Launch Station, North Korea", lat: 39.66, lon: 124.71, type: "launch" },
  { name: "Jiuquan Launch Center, China", lat: 40.96, lon: 100.29, type: "launch" },
  { name: "Satish Dhawan Space Centre, India", lat: 13.73, lon: 80.24, type: "launch" },
  { name: "Pine Gap, Australia", lat: -23.80, lon: 133.74, type: "military" },
  { name: "Menwith Hill, UK", lat: 54.01, lon: -1.69, type: "military" },
  { name: "Guiana Space Centre, French Guiana", lat: 5.24, lon: -52.77, type: "launch" },
  // Strategic chokepoints
  { name: "Strait of Hormuz", lat: 26.56, lon: 56.25, type: "strategic" },
  { name: "Strait of Malacca", lat: 2.50, lon: 101.50, type: "strategic" },
  { name: "Taiwan Strait", lat: 24.50, lon: 119.50, type: "strategic" },
  { name: "Suez Canal", lat: 30.58, lon: 32.27, type: "strategic" },
  { name: "Panama Canal", lat: 9.08, lon: -79.68, type: "strategic" },
  { name: "Strait of Gibraltar", lat: 35.97, lon: -5.60, type: "strategic" },
  { name: "Bosphorus Strait", lat: 41.12, lon: 29.08, type: "strategic" },
  { name: "South China Sea", lat: 12.00, lon: 113.00, type: "strategic" },
  { name: "Black Sea", lat: 43.00, lon: 34.00, type: "strategic" },
  { name: "Persian Gulf", lat: 26.00, lon: 51.00, type: "strategic" },
];

// ─── Types ────────────────────────────────────────────────────────────────────
interface SatPosition {
  noradId: number;
  name: string;
  lat: number;
  lon: number;
  altKm: number;
  speedKms: number;
  inclination: number;
  category: string;
  tle1: string;
  tle2: string;
  country?: string | null;
  operator?: string | null;
  launchDate?: string | null;
  launchSite?: string | null;
  cost?: string | null;
  missionType?: string | null;
  missionDescription?: string | null;
  eccentricity?: number | null;
  imageUrl?: string | null;
  period?: number;
}

declare global {
  interface Window { satellite: any; }
}

interface AoiResult {
  sat: SatPosition;
  elevationDeg: number;
  azimuthDeg: number;
  rangeKm: number;
  isVisible: boolean;
}

// ─── Coordinate helpers ────────────────────────────────────────────────────────
function latLonAltToVec3(lat: number, lon: number, altKm: number): THREE.Vector3 {
  const r = GLOBE_R * (1 + altKm / EARTH_RADIUS_KM);
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  );
}

function buildCoverageZone(lat: number, lon: number, altKm: number, N = 180, minElevDeg = 0): THREE.Vector3[] {
  const eps = minElevDeg * (Math.PI / 180);
  const rho = Math.acos(EARTH_RADIUS_KM * Math.cos(eps) / (EARTH_RADIUS_KM + altKm)) - eps;
  const latR = lat * (Math.PI / 180);
  const lonR = lon * (Math.PI / 180);
  const sinLat = Math.sin(latR);
  const cosLat = Math.cos(latR);
  const cosRho = Math.cos(rho);
  const sinRho = Math.sin(rho);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= N; i++) {
    const az = (i / N) * 2 * Math.PI;
    const latPt = Math.asin(sinLat * cosRho + cosLat * sinRho * Math.cos(az));
    const lonPt = lonR + Math.atan2(Math.sin(az) * sinRho * cosLat, cosRho - sinLat * Math.sin(latPt));
    pts.push(latLonAltToVec3(latPt * (180 / Math.PI), lonPt * (180 / Math.PI), 2));
  }
  return pts;
}

function computeAoiVisibility(obsLat: number, obsLon: number, sat: SatPosition): AoiResult {
  const obsLatR = obsLat * Math.PI / 180;
  const obsLonR = obsLon * Math.PI / 180;
  const satLatR = sat.lat * Math.PI / 180;
  const satLonR = sat.lon * Math.PI / 180;
  const ox = Math.cos(obsLatR) * Math.cos(obsLonR);
  const oy = Math.sin(obsLatR);
  const oz = Math.cos(obsLatR) * Math.sin(obsLonR);
  const sr = 1 + sat.altKm / EARTH_RADIUS_KM;
  const sx = sr * Math.cos(satLatR) * Math.cos(satLonR);
  const sy = sr * Math.sin(satLatR);
  const sz = sr * Math.cos(satLatR) * Math.sin(satLonR);
  const dx = sx - ox, dy = sy - oy, dz = sz - oz;
  const rangeEr = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const rangeKm = rangeEr * EARTH_RADIUS_KM;
  const dotObs = ox * dx + oy * dy + oz * dz;
  const sinElev = Math.max(-1, Math.min(1, dotObs / rangeEr));
  const elevationDeg = Math.asin(sinElev) * 180 / Math.PI;
  const northX = -Math.sin(obsLatR) * Math.cos(obsLonR);
  const northY = Math.cos(obsLatR);
  const northZ = -Math.sin(obsLatR) * Math.sin(obsLonR);
  const eastX = -Math.sin(obsLonR);
  const eastZ = Math.cos(obsLonR);
  const northComp = northX * dx + northY * dy + northZ * dz;
  const eastComp = eastX * dx + eastZ * dz;
  let azimuthDeg = Math.atan2(eastComp, northComp) * 180 / Math.PI;
  if (azimuthDeg < 0) azimuthDeg += 360;
  return { sat, elevationDeg, azimuthDeg, rangeKm, isVisible: elevationDeg > 0 };
}

function propagateTLE(tle1: string, tle2: string, date: Date) {
  try {
    const satrec = satellite.twoline2satrec(tle1, tle2);
    const posVel = satellite.propagate(satrec, date) as any;
    if (!posVel?.position || typeof posVel.position === "boolean") return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    const altKm = geo.height;
    if (isNaN(lat) || isNaN(lon) || isNaN(altKm)) return null;
    const vel = posVel.velocity as { x: number; y: number; z: number };
    return { lat, lon, altKm, speedKms: Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2) };
  } catch { return null; }
}

// ─── Satellite Detail Panel ───────────────────────────────────────────────────
// ─── Satellite-to-infrastructure connection data ─────────────────────────────
const SAT_CONNECTIONS: Record<string, { launchSites: string[]; groundStations: string[]; relayLinks?: string[] }> = {
  // Space Stations
  "ISS":         { launchSites: ["Baikonur Cosmodrome, Kazakhstan", "Kennedy Space Center, USA"], groundStations: ["White Sands, USA", "Svalbard, Norway", "Weilheim, Germany"] },
  "CSS":         { launchSites: ["Wenchang Space Launch Center, China"], groundStations: ["Jiuquan, China", "Weinan, China", "Kashi, China"] },
  // Navigation
  "GPS":         { launchSites: ["Cape Canaveral SFS, USA"], groundStations: ["Schriever SFB, USA", "Ascension Island", "Diego Garcia", "Kwajalein Atoll", "Cape Canaveral SFS, USA"] },
  "GLONASS":     { launchSites: ["Baikonur Cosmodrome, Kazakhstan", "Plesetsk Cosmodrome, Russia"], groundStations: ["Korolev, Russia", "Ussuriysk, Russia", "Yeniseysk, Russia"] },
  "BEIDOU":      { launchSites: ["Xichang Satellite Launch Center, China", "Wenchang Space Launch Center, China"], groundStations: ["Beijing, China", "Ürümqi, China", "Sanya, China"] },
  "GALILEO":     { launchSites: ["Guiana Space Centre, French Guiana"], groundStations: ["Fucino, Italy", "Oberpfaffenhofen, Germany", "Redu, Belgium", "Kiruna, Sweden"] },
  // Weather
  "NOAA":        { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Fairbanks, Alaska", "Wallops Island, USA", "Svalbard, Norway"] },
  "GOES":        { launchSites: ["Cape Canaveral SFS, USA"], groundStations: ["Wallops Island, USA", "Fairbanks, Alaska"] },
  // EO / Science
  "SENTINEL":    { launchSites: ["Guiana Space Centre, French Guiana", "Baikonur Cosmodrome, Kazakhstan"], groundStations: ["Svalbard, Norway", "Matera, Italy", "Kiruna, Sweden"] },
  "LANDSAT":     { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Fairbanks, Alaska", "Svalbard, Norway", "Sioux Falls, USA"] },
  "WORLDVIEW":   { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Longmont, USA", "Fairbanks, Alaska"] },
  "TERRASAR":    { launchSites: ["Baikonur Cosmodrome, Kazakhstan"], groundStations: ["Neustrelitz, Germany", "Kiruna, Sweden"] },
  // Military
  "DMSP":        { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Fairchild AFB, USA", "Loring AFB, USA", "Thule AB, Greenland"] },
  "WGS":         { launchSites: ["Cape Canaveral SFS, USA"], groundStations: ["Schriever SFB, USA", "Diego Garcia", "Ramstein AB, Germany"] },
  "AEHF":        { launchSites: ["Cape Canaveral SFS, USA"], groundStations: ["Schriever SFB, USA", "Vandenberg SFB, USA", "Kapaun AS, Germany"] },
  "NROL":        { launchSites: ["Vandenberg SFB, USA", "Cape Canaveral SFS, USA"], groundStations: ["Pine Gap, Australia", "Menwith Hill, UK", "Buckley SFB, USA"] },
  "USA":         { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Pine Gap, Australia", "Menwith Hill, UK", "Buckley SFB, USA"] },
  // Commercial
  "STARLINK":    { launchSites: ["Kennedy Space Center, USA", "Vandenberg SFB, USA"], groundStations: ["Hawthorne, USA", "Brewster, USA", "Lanarkshire, UK", "Bochum, Germany"] },
  "ONEWEB":      { launchSites: ["Baikonur Cosmodrome, Kazakhstan", "Guiana Space Centre, French Guiana"], groundStations: ["Harwell, UK", "Leuk, Switzerland", "Clarksburg, USA"] },
  "IRIDIUM":     { launchSites: ["Vandenberg SFB, USA"], groundStations: ["Tempe, USA", "Chandler, USA", "Fairbanks, Alaska"] },
  // Reconnaissance
  "YAOGAN":      { launchSites: ["Jiuquan Satellite Launch Center, China", "Taiyuan Satellite Launch Center, China"], groundStations: ["Beijing, China", "Ürümqi, China"] },
  "COSMOS":      { launchSites: ["Plesetsk Cosmodrome, Russia", "Baikonur Cosmodrome, Kazakhstan"], groundStations: ["Korolev, Russia", "Noginsk-9, Russia"] },
};

function getSatConnections(satName: string) {
  const upper = satName.toUpperCase();
  for (const [key, val] of Object.entries(SAT_CONNECTIONS)) {
    if (upper.includes(key)) return val;
  }
  return { launchSites: [], groundStations: [] };
}

// ─── Threat assessment data ───────────────────────────────────────────────────
const THREAT_PROFILES: Record<string, { level: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "MINIMAL"; capabilities: string[]; notes: string; counterparts?: string[] }> = {
  "reconnaissance": { level: "CRITICAL", capabilities: ["High-res optical imaging", "SAR all-weather imaging", "SIGINT collection", "ELINT intercept", "Ground target tracking"], notes: "Classified reconnaissance asset. Capable of sub-meter resolution imaging. Likely tasked against strategic targets.", counterparts: ["YAOGAN (China)", "COSMOS (Russia)", "Ofek (Israel)"] },
  "military":       { level: "HIGH",     capabilities: ["Secure comms relay", "EW support", "Nuclear C2", "Weather for ops", "Missile warning"], notes: "Military communications and support satellite. Part of national defense infrastructure.", counterparts: ["Meridian (Russia)", "Zhongxing (China)"] },
  "gps":            { level: "MEDIUM",   capabilities: ["Precision navigation", "Timing services", "Dual-use (civil/military)", "M-code encrypted signal"], notes: "Navigation satellite. Military M-code provides anti-jam, anti-spoof capabilities for US forces.", counterparts: ["GLONASS (Russia)", "BeiDou (China)", "Galileo (EU)"] },
  "glonass":        { level: "MEDIUM",   capabilities: ["Precision navigation", "Timing services", "Military CDMA signals"], notes: "Russian navigation constellation. Provides positioning for Russian military forces and guided munitions.", counterparts: ["GPS (USA)", "BeiDou (China)"] },
  "beidou":         { level: "MEDIUM",   capabilities: ["Precision navigation", "Short message service", "RDSS positioning", "Military encrypted signals"], notes: "Chinese navigation constellation. Includes short message capability unique among GNSS systems. Used by PLA.", counterparts: ["GPS (USA)", "GLONASS (Russia)"] },
  "eo":             { level: "MEDIUM",   capabilities: ["Multispectral imaging", "SAR imaging", "Change detection", "Disaster monitoring"], notes: "Earth observation satellite. Imagery available commercially; used for OSINT and dual-use intelligence.", counterparts: [] },
  "starlink":       { level: "LOW",      capabilities: ["Broadband internet", "Low-latency comms", "Potential dual-use relay"], notes: "Commercial broadband constellation. Used by Ukrainian forces for battlefield comms. Potential military utility.", counterparts: ["OneWeb (UK)", "Kuiper (USA)"] },
  "weather":        { level: "MINIMAL",  capabilities: ["Meteorological imaging", "Atmospheric sounding", "Ocean monitoring"], notes: "Civilian meteorological satellite. Data openly shared. Critical for military weather forecasting.", counterparts: [] },
  "science":        { level: "MINIMAL",  capabilities: ["Earth science", "Climate monitoring", "Ocean observation"], notes: "Scientific research satellite. Civilian mission with open data policy.", counterparts: [] },
  "stations":       { level: "LOW",      capabilities: ["Microgravity research", "Technology demonstration", "Crew operations"], notes: "Crewed space station. Civilian research mission with international cooperation.", counterparts: [] },
  "galileo":        { level: "LOW",      capabilities: ["Precision navigation", "Search and rescue", "PRS encrypted service"], notes: "European navigation constellation. PRS (Public Regulated Service) provides encrypted signals for EU government use.", counterparts: ["GPS (USA)", "GLONASS (Russia)"] },
  "iridium":        { level: "LOW",      capabilities: ["Global voice/data", "L-band comms", "AIS ship tracking"], notes: "Commercial satellite phone constellation. Used by military, NGOs, and maritime operators globally.", counterparts: [] },
  "oneweb":         { level: "MINIMAL",  capabilities: ["Broadband internet", "LEO connectivity"], notes: "Commercial broadband constellation targeting enterprise and government customers.", counterparts: [] },
};

const THREAT_COLORS = { CRITICAL: "#ef4444", HIGH: "#f97316", MEDIUM: "#f59e0b", LOW: "#22c55e", MINIMAL: "#6b7280" };

// ─── Ground track history simulation ─────────────────────────────────────────
function computeHistoricalTrack(sat: SatPosition, minutesBack: number, steps: number): { lat: number; lon: number }[] {
  if (!sat.tle1 || !sat.tle2) return [];
  try {
    const { twoline2satrec, propagate, gstime } = window.satellite;
    if (!twoline2satrec) return [];
    const satrec = twoline2satrec(sat.tle1, sat.tle2);
    const now = Date.now();
    const track: { lat: number; lon: number }[] = [];
    for (let i = steps; i >= 0; i--) {
      const t = new Date(now - (minutesBack * 60000 * i / steps));
      const pv = propagate(satrec, t);
      if (!pv?.position) continue;
      const gst = gstime(t);
      const { longitude, latitude } = window.satellite.eciToGeodetic(pv.position, gst);
      track.push({ lat: latitude * 180 / Math.PI, lon: longitude * 180 / Math.PI });
    }
    return track;
  } catch { return []; }
}

// ─── Facility Linked Satellites Panel ───────────────────────────────────────
function FacilityLinkedSatsPanel({
  facility, allSats, onClose, onSelectSat,
}: {
  facility: { name: string; lat: number; lon: number; country?: string; operator?: string; type?: string; status?: string; notes?: string };
  allSats: SatPosition[];
  onClose: () => void;
  onSelectSat: (s: SatPosition) => void;
}) {
  const isLaunch = !!(facility as any).operator;
  const facNameUpper = facility.name.toUpperCase();

  // Find satellites linked to this facility via SAT_CONNECTIONS
  const linkedSats = allSats.filter(sat => {
    const conn = getSatConnections(sat.name);
    const sites = isLaunch ? conn.launchSites : conn.groundStations;
    return sites.some(s => {
      const sUp = s.toUpperCase();
      const fUp = facNameUpper;
      return sUp.includes(fUp.split(',')[0]) || fUp.includes(sUp.split(',')[0]);
    });
  });

  // Stats
  const categories = Array.from(new Set(linkedSats.map(s => s.category)));
  const avgAlt = linkedSats.length ? (linkedSats.reduce((a, s) => a + (s.altKm || 0), 0) / linkedSats.length).toFixed(0) : 'N/A';
  const milCount = linkedSats.filter(s => ['military', 'reconnaissance'].includes(s.category)).length;

  return (
    <div className="absolute top-14 right-3 bottom-10 z-20 flex flex-col overflow-hidden rounded-lg border shadow-2xl"
      style={{ width: 380, background: "var(--card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs font-bold tracking-widest" style={{ color: isLaunch ? '#ff6b35' : 'var(--primary)' }}>
              {isLaunch ? '🚀 LAUNCH FACILITY' : '📡 GROUND STATION'}
            </div>
            <div className="font-mono text-[11px] font-bold text-foreground mt-0.5">{facility.name}</div>
            <div className="font-mono text-[9px] text-muted-foreground">{facility.country} · {(facility as any).operator ?? (facility as any).type ?? ''}</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono text-sm">✕</button>
        </div>
        {/* Stats bar */}
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-border/40">
          <div className="text-center">
            <div className="font-mono text-[14px] font-bold" style={{ color: isLaunch ? '#ff6b35' : 'var(--primary)' }}>{linkedSats.length}</div>
            <div className="font-mono text-[8px] text-muted-foreground">LINKED SATS</div>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <div className="font-mono text-[14px] font-bold text-red-400">{milCount}</div>
            <div className="font-mono text-[8px] text-muted-foreground">MILITARY</div>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <div className="font-mono text-[14px] font-bold text-cyan-400">{avgAlt}</div>
            <div className="font-mono text-[8px] text-muted-foreground">AVG ALT (KM)</div>
          </div>
          <div className="w-px h-8 bg-border/50" />
          <div className="text-center">
            <div className="font-mono text-[14px] font-bold text-amber-400">{categories.length}</div>
            <div className="font-mono text-[8px] text-muted-foreground">CATEGORIES</div>
          </div>
        </div>
      </div>

      {/* Notes */}
      {facility.notes && (
        <div className="flex-shrink-0 px-4 py-2 border-b border-border/30 bg-amber-500/5">
          <div className="font-mono text-[9px] text-amber-400/80">{facility.notes}</div>
        </div>
      )}

      {/* Linked satellites list */}
      <div className="flex-1 overflow-y-auto">
        {linkedSats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <div className="font-mono text-[10px]">No linked satellites found in database</div>
            <div className="font-mono text-[9px] mt-1 text-muted-foreground/50">Connection data may be incomplete</div>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {linkedSats.map(sat => (
              <button key={sat.noradId} onClick={() => onSelectSat(sat)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/20 transition-colors text-left">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: sat.category === 'military' || sat.category === 'reconnaissance' ? '#ef4444' : sat.category === 'starlink' ? '#60a5fa' : 'var(--primary)' }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] font-bold text-foreground truncate">{sat.name}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{sat.category} · {sat.altKm?.toFixed(0)} km · NORAD {sat.noradId}</div>
                </div>
                <div className="font-mono text-[8px] text-primary/60">→</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-2 border-t border-border/30 bg-muted/20">
        <div className="font-mono text-[9px] text-muted-foreground">
          {facility.lat.toFixed(3)}°, {facility.lon.toFixed(3)}° · Click any satellite to open its Intel Panel
        </div>
      </div>
    </div>
  );
}

function SatIntelPanel({
  sat, allSats, categories, onClose, onSelectSat, onTrack, isTracking, onShowPasses, showPassPredictor,
}: {
  sat: SatPosition;
  allSats: SatPosition[];
  categories: { key: string; label: string; color: string }[];
  onClose: () => void;
  onSelectSat: (s: SatPosition) => void;
  onTrack: () => void;
  isTracking: boolean;
  onShowPasses: () => void;
  showPassPredictor: boolean;
}) {
  const [activeTab, setActiveTab] = useState<"dossier" | "coverage" | "connections" | "history" | "threat">("dossier");
  const [historyMinutes, setHistoryMinutes] = useState(90);
  const [historyTrack, setHistoryTrack] = useState<{ lat: number; lon: number }[]>([]);

  const catColor = categories.find(c => c.key === sat.category)?.color ?? "#60a5fa";
  const catLabel = categories.find(c => c.key === sat.category)?.label ?? sat.category;
  const orbitType = sat.altKm < 2000 ? "LEO" : sat.altKm < 35000 ? "MEO" : "GEO";
  const orbitLabel = sat.altKm < 2000 ? "Low Earth Orbit (LEO)" : sat.altKm < 35000 ? "Medium Earth Orbit (MEO)" : "Geostationary Orbit (GEO)";
  const halfAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + sat.altKm));
  const footprintKm = Math.round(halfAngle * EARTH_RADIUS_KM);
  const coverageAreaMkm2 = (2 * Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM * (1 - Math.cos(halfAngle)) / 1e6).toFixed(1);
  const signalDelayMs = ((sat.altKm / 299792) * 1000).toFixed(1);
  const periodMin = sat.period ?? Math.round(2 * Math.PI * Math.sqrt(Math.pow(EARTH_RADIUS_KM + sat.altKm, 3) / 398600.4418) / 60);
  const coveragePct = ((2 * Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM * (1 - Math.cos(halfAngle))) / (4 * Math.PI * EARTH_RADIUS_KM * EARTH_RADIUS_KM) * 100).toFixed(1);
  const revsPerDay = (1440 / periodMin).toFixed(2);
  const statusColor = sat.altKm < 200 ? "#ef4444" : sat.altKm < 300 ? "#f59e0b" : "#22c55e";
  const statusLabel = sat.altKm < 200 ? "DECAYING" : sat.altKm < 300 ? "LOW ORBIT" : "NOMINAL";

  const connections = getSatConnections(sat.name);
  const threatProfile = THREAT_PROFILES[sat.category] ?? { level: "MINIMAL" as const, capabilities: [], notes: "No threat assessment available.", counterparts: [] };
  const threatColor = THREAT_COLORS[threatProfile.level];

  const nearby = allSats
    .filter(s => s.noradId !== sat.noradId && s.category === sat.category)
    .map(s => {
      const dlat = s.lat - sat.lat, dlon = s.lon - sat.lon;
      return { ...s, dist: Math.sqrt(dlat * dlat + dlon * dlon) };
    })
    .sort((a, b) => a.dist - b.dist)
    .slice(0, 5);

  // Compute historical track when tab is opened
  useEffect(() => {
    if (activeTab === "history") {
      const track = computeHistoricalTrack(sat, historyMinutes, 120);
      setHistoryTrack(track);
    }
  }, [activeTab, sat.noradId, historyMinutes]);

  const TABS = [
    { id: "dossier",     label: "DOSSIER" },
    { id: "coverage",    label: "COVERAGE" },
    { id: "connections", label: "LINKS" },
    { id: "history",     label: "HISTORY" },
    { id: "threat",      label: "THREAT" },
  ] as const;

  return (
    <div className="absolute top-14 right-3 bottom-10 z-20 flex flex-col overflow-hidden rounded-lg border shadow-2xl"
      style={{ width: 390, background: "var(--card)", borderColor: "var(--border)" }}>

      {/* ── Header ── */}
      <div className="flex-shrink-0 px-4 py-3 border-b"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3 mb-2">
          <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 animate-pulse" style={{ background: catColor, boxShadow: `0 0 10px ${catColor}` }} />
          <div className="flex-1 min-w-0">
            <div className="font-mono text-sm font-bold text-foreground truncate tracking-wide">{sat.name}</div>
            <div className="font-mono text-[10px] tracking-widest" style={{ color: catColor }}>NORAD #{sat.noradId} · {catLabel.toUpperCase()} · {orbitType}</div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border"
              style={{ color: statusColor, borderColor: statusColor + "44", background: statusColor + "11" }}>
              {statusLabel}
            </span>
            <span className="font-mono text-[9px] px-1.5 py-0.5 rounded border"
              style={{ color: threatColor, borderColor: threatColor + "44", background: threatColor + "11" }}>
              THREAT: {threatProfile.level}
            </span>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono text-sm ml-1 flex-shrink-0">✕</button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button onClick={onTrack}
            className={`flex-1 py-1 rounded font-mono text-[10px] border transition-all ${isTracking ? "bg-green-500/20 border-green-500/60 text-green-400" : "bg-foreground/5 border-border text-muted-foreground hover:border-cyan-500/40 hover:text-cyan-400"}`}>
            {isTracking ? "⊙ TRACKING" : "⊙ TRACK"}
          </button>
          <button onClick={onShowPasses}
            className={`flex-1 py-1 rounded font-mono text-[10px] border transition-all ${showPassPredictor ? "bg-amber-500/20 border-amber-500/60 text-amber-400" : "bg-foreground/5 border-border text-muted-foreground hover:border-amber-500/40 hover:text-amber-400"}`}>
            ◎ PASSES
          </button>
          <button
            className="flex-1 py-1 rounded font-mono text-[10px] border border-border text-muted-foreground hover:border-purple-500/40 hover:text-purple-400 transition-all bg-foreground/5"
            onClick={() => setActiveTab("history")}>
            ⟳ HISTORY
          </button>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex-shrink-0 flex border-b" style={{ borderColor: "var(--border)" }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 font-mono text-[9px] tracking-widest transition-all border-b-2 ${
              activeTab === tab.id
                ? "text-cyan-400 border-cyan-400 bg-cyan-500/5"
                : "text-muted-foreground/60 border-transparent hover:text-foreground/60"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--primary) transparent" }}>

        {/* ═══ DOSSIER TAB ═══ */}
        {activeTab === "dossier" && (
          <div>
            {/* Satellite image */}
            <div className="relative h-40 overflow-hidden flex-shrink-0">
              <img src={getSatImage(sat.name, sat.imageUrl)} alt={sat.name}
                className="w-full h-full object-cover opacity-75"
                onError={e => { (e.target as HTMLImageElement).src = SAT_IMAGES.DEFAULT; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/30 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-end justify-between">
                <div>
                  <div className="font-mono text-xs text-foreground/60">{orbitLabel}</div>
                  <div className="font-mono text-xl font-bold text-foreground">{sat.altKm.toFixed(0)} km</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-xs text-foreground/60">VELOCITY</div>
                  <div className="font-mono text-sm font-bold" style={{ color: catColor }}>{sat.speedKms.toFixed(2)} km/s</div>
                </div>
              </div>
            </div>

            {/* TLE Age */}
            <div className="px-3 pt-2 pb-1">
              <TleAgeBadge tle1={sat.tle1} />
            </div>

            {/* Mission brief */}
            {sat.missionDescription && (
              <div className="px-3 pb-2">
                <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">MISSION BRIEF</div>
                <div className="font-mono text-[10px] text-foreground/60 leading-relaxed border-l-2 pl-2" style={{ borderColor: catColor + "60" }}>
                  {sat.missionDescription}
                </div>
              </div>
            )}

            {/* Orbital parameters */}
            <div className="px-3 pb-2">
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">ORBITAL PARAMETERS</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ["Altitude", `${sat.altKm.toFixed(0)} km`],
                  ["Velocity", `${sat.speedKms.toFixed(2)} km/s`],
                  ["Inclination", `${sat.inclination.toFixed(2)}°`],
                  ["Period", `${periodMin} min`],
                  ["Revs/Day", revsPerDay],
                  ["Eccentricity", sat.eccentricity ? sat.eccentricity.toFixed(6) : "N/A"],
                  ["Latitude", `${sat.lat.toFixed(4)}°`],
                  ["Longitude", `${sat.lon.toFixed(4)}°`],
                  ["Footprint", `${footprintKm.toLocaleString()} km`],
                  ["Coverage", `${coveragePct}% Earth`],
                  ["Area", `${coverageAreaMkm2}M km²`],
                  ["Signal Delay", `${signalDelayMs} ms`],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between py-0.5 border-b border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground/70">{k}</span>
                    <span className="font-mono text-[10px] text-foreground/80">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Metadata */}
            <div className="px-3 pb-2">
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">ASSET METADATA</div>
              <div className="space-y-0.5">
                {[
                  ["Country", sat.country, "#f59e0b"],
                  ["Operator", sat.operator, "oklch(from var(--foreground) l c h / 0.7)"],
                  ["Launch Date", sat.launchDate, "oklch(from var(--foreground) l c h / 0.7)"],
                  ["Launch Site", sat.launchSite, "oklch(from var(--foreground) l c h / 0.7)"],
                  ["Cost", sat.cost, "#22c55e"],
                  ["Mission Type", sat.missionType ?? sat.missionDescription?.split(".")[0], "oklch(from var(--foreground) l c h / 0.7)"],
                  ["NORAD ID", String(sat.noradId), "#60a5fa"],
                  ["Category", catLabel, "oklch(from var(--foreground) l c h / 0.7)"],
                ].filter(([, v]) => v).map(([k, v, c]) => (
                  <div key={k as string} className="flex justify-between gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground/70 flex-shrink-0">{k}</span>
                    <span className="font-mono text-[10px] text-right truncate" style={{ color: c as string }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Nearby constellation */}
            {nearby.length > 0 && (
              <div className="px-3 pb-3">
                <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">CONSTELLATION NEIGHBORS</div>
                <div className="space-y-0.5">
                  {nearby.map(n => (
                    <button key={n.noradId} onClick={() => onSelectSat(n)}
                      className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-foreground/5 transition-all text-left">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: catColor }} />
                        <span className="font-mono text-[10px] text-foreground/60 truncate">{n.name}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="font-mono text-[9px] text-muted-foreground/60">{n.altKm.toFixed(0)}km</span>
                        <span className="font-mono text-[9px] text-muted-foreground">→</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ COVERAGE MAP TAB ═══ */}
        {activeTab === "coverage" && (
          <div className="p-3 space-y-3">
            {/* Coverage footprint visualization */}
            <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">COVERAGE FOOTPRINT</div>
            <div className="rounded border overflow-hidden" style={{ borderColor: "var(--border)", background: "var(--card)" }}>
              <svg viewBox="-180 -90 360 180" className="w-full" style={{ height: 180 }}>
                {/* Ocean background */}
                <rect x="-180" y="-90" width="360" height="180" fill="rgba(0,20,50,0.8)" />
                {/* Grid */}
                {[-60,-30,0,30,60].map(lat => (
                  <line key={lat} x1="-180" y1={-lat} x2="180" y2={-lat} stroke="oklch(from var(--foreground) l c h / 0.04)" strokeWidth="0.5" />
                ))}
                {[-120,-60,0,60,120].map(lon => (
                  <line key={lon} x1={lon} y1="-90" x2={lon} y2="90" stroke="oklch(from var(--foreground) l c h / 0.04)" strokeWidth="0.5" />
                ))}
                {/* Equator */}
                <line x1="-180" y1="0" x2="180" y2="0" stroke="oklch(from var(--foreground) l c h / 0.15)" strokeWidth="0.8" />
                {/* Tropics */}
                <line x1="-180" y1="-23.5" x2="180" y2="-23.5" stroke="rgba(255,200,0,0.08)" strokeWidth="0.5" />
                <line x1="-180" y1="23.5" x2="180" y2="23.5" stroke="rgba(255,200,0,0.08)" strokeWidth="0.5" />
                {/* Coverage circle */}
                {(() => {
                  const halfAngle = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + sat.altKm));
                  const radiusDeg = halfAngle * 180 / Math.PI;
                  const cx = sat.lon;
                  const cy = -sat.lat;
                  // Draw approximate coverage ellipse (simplified for flat projection)
                  const rx = Math.min(radiusDeg, 180);
                  const ry = Math.min(radiusDeg * 0.8, 90);
                  return (
                    <>
                      <ellipse cx={cx} cy={cy} rx={rx} ry={ry}
                        fill={catColor + "18"} stroke={catColor} strokeWidth="0.8" strokeDasharray="3,2" />
                      <ellipse cx={cx} cy={cy} rx={rx * 0.5} ry={ry * 0.5}
                        fill={catColor + "10"} stroke={catColor} strokeWidth="0.5" strokeOpacity="0.4" />
                    </>
                  );
                })()}
                {/* Satellite position */}
                <circle cx={sat.lon} cy={-sat.lat} r="3" fill={catColor} />
                <circle cx={sat.lon} cy={-sat.lat} r="6" fill="none" stroke={catColor} strokeWidth="1" strokeOpacity="0.6" />
                <circle cx={sat.lon} cy={-sat.lat} r="9" fill="none" stroke={catColor} strokeWidth="0.5" strokeOpacity="0.3" />
              </svg>
            </div>

            {/* Coverage stats */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "FOOTPRINT RADIUS", value: `${Math.round(Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + sat.altKm)) * EARTH_RADIUS_KM).toLocaleString()} km`, color: catColor },
                { label: "EARTH COVERAGE", value: `${coveragePct}%`, color: catColor },
                { label: "COVERAGE AREA", value: `${coverageAreaMkm2}M km²`, color: "#22c55e" },
                { label: "SIGNAL DELAY", value: `${signalDelayMs} ms`, color: "#f59e0b" },
              ].map(stat => (
                <div key={stat.label} className="rounded border p-2" style={{ borderColor: `${stat.color}30`, background: `${stat.color}08` }}>
                  <div className="font-mono text-[8px] tracking-widest mb-1" style={{ color: `${stat.color}80` }}>{stat.label}</div>
                  <div className="font-mono text-sm font-bold" style={{ color: stat.color }}>{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Ground track */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">CURRENT POSITION</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                {[
                  ["Latitude", `${sat.lat.toFixed(4)}°`],
                  ["Longitude", `${sat.lon.toFixed(4)}°`],
                  ["Altitude", `${sat.altKm.toFixed(0)} km`],
                  ["Inclination", `${sat.inclination.toFixed(2)}°`],
                  ["Ground Speed", `${(sat.speedKms * Math.cos(sat.inclination * Math.PI / 180)).toFixed(2)} km/s`],
                  ["Orbit Type", orbitType],
                ].map(([k, v]) => (
                  <div key={k as string} className="flex justify-between py-0.5 border-b border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground/70">{k}</span>
                    <span className="font-mono text-[10px] text-foreground/80">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Min elevation slider */}
            <div>
              <div className="flex justify-between mb-1">
                <span className="font-mono text-[9px] text-cyan-500/50">MIN ELEVATION ANGLE</span>
                <span className="font-mono text-[9px] font-bold text-cyan-400">10°</span>
              </div>
              <div className="font-mono text-[9px] text-muted-foreground/60">Coverage shown at 0° elevation (horizon-to-horizon)</div>
            </div>
          </div>
        )}

        {/* ═══ CONNECTIONS TAB ═══ */}
        {activeTab === "connections" && (
          <div className="p-3 space-y-3">
            {/* Launch Sites */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">🚀 LAUNCH FACILITIES</div>
              {connections.launchSites.length === 0 ? (
                <div className="font-mono text-[10px] text-muted-foreground/50 italic">No launch site data available</div>
              ) : connections.launchSites.map((site, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/40">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: "#f97316", boxShadow: "0 0 4px #f97316" }} />
                  <div>
                    <div className="font-mono text-[10px] text-foreground/80">{site}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/60">LAUNCH ORIGIN</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Ground Stations */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">📡 GROUND STATIONS</div>
              {connections.groundStations.length === 0 ? (
                <div className="font-mono text-[10px] text-muted-foreground/50 italic">No ground station data available</div>
              ) : connections.groundStations.map((gs, i) => (
                <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/40">
                  <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: "var(--primary)", boxShadow: "0 0 4px var(--primary)" }} />
                  <div>
                    <div className="font-mono text-[10px] text-foreground/80">{gs}</div>
                    <div className="font-mono text-[9px] text-muted-foreground/60">TELEMETRY / COMMAND</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Relay Links */}
            {connections.relayLinks && connections.relayLinks.length > 0 && (
              <div>
                <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">⇄ RELAY LINKS</div>
                {connections.relayLinks.map((rl, i) => (
                  <div key={i} className="flex items-start gap-2 py-1.5 border-b border-border/40">
                    <div className="w-1.5 h-1.5 rounded-full mt-1 flex-shrink-0" style={{ background: "#a78bfa" }} />
                    <div className="font-mono text-[10px] text-foreground/80">{rl}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Signal path visualization */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">⟳ SIGNAL PATH</div>
              <div className="rounded border p-2 font-mono text-[9px]" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                <div className="flex items-center gap-1 text-muted-foreground/80">
                  <span className="text-orange-400">🚀 LAUNCH</span>
                  <span>→</span>
                  <span style={{ color: catColor }}>◉ {sat.name.split(" ")[0]}</span>
                  <span>→</span>
                  <span className="text-cyan-400">📡 GND</span>
                  <span>→</span>
                  <span className="text-green-400">🖥 OPS</span>
                </div>
                <div className="mt-1 text-muted-foreground/50">Uplink: S-band / X-band · Downlink: X-band / Ka-band</div>
                <div className="text-muted-foreground/50">Encryption: AES-256 (estimated) · Protocol: CCSDS</div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ HISTORY TAB ═══ */}
        {activeTab === "history" && (
          <div className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50">GROUND TRACK HISTORY</div>
              <select value={historyMinutes} onChange={e => setHistoryMinutes(Number(e.target.value))}
                className="font-mono text-[9px] bg-background/80 border border-border rounded px-1 py-0.5 text-foreground/60">
                <option value={45}>45 min</option>
                <option value={90}>90 min (1 orbit)</option>
                <option value={180}>180 min (2 orbits)</option>
                <option value={360}>360 min (4 orbits)</option>
              </select>
            </div>

            {/* Ground track SVG map */}
            <div className="rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <svg viewBox="-180 -90 360 180" className="w-full" style={{ height: 140, background: "var(--muted)" }}>
                {/* Grid lines */}
                {[-60, -30, 0, 30, 60].map(lat => (
                  <line key={lat} x1="-180" y1={-lat} x2="180" y2={-lat} stroke="oklch(from var(--foreground) l c h / 0.05)" strokeWidth="0.5" />
                ))}
                {[-120, -60, 0, 60, 120].map(lon => (
                  <line key={lon} x1={lon} y1="-90" x2={lon} y2="90" stroke="oklch(from var(--foreground) l c h / 0.05)" strokeWidth="0.5" />
                ))}
                {/* Equator */}
                <line x1="-180" y1="0" x2="180" y2="0" stroke="oklch(from var(--foreground) l c h / 0.12)" strokeWidth="0.8" />
                {/* Ground track */}
                {historyTrack.length > 1 && (
                  <polyline
                    points={historyTrack.map(p => `${p.lon},${-p.lat}`).join(" ")}
                    fill="none" stroke={catColor} strokeWidth="1.2" strokeOpacity="0.7"
                    strokeDasharray="2,1"
                  />
                )}
                {/* Current position */}
                <circle cx={sat.lon} cy={-sat.lat} r="2.5" fill={catColor} opacity="0.9" />
                <circle cx={sat.lon} cy={-sat.lat} r="5" fill="none" stroke={catColor} strokeWidth="0.8" opacity="0.4" />
              </svg>
            </div>

            {historyTrack.length === 0 && (
              <div className="font-mono text-[10px] text-muted-foreground/60 text-center py-2">TLE data required for track computation</div>
            )}

            {/* Position timeline */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">POSITION TIMELINE</div>
              <div className="space-y-0.5">
                {historyTrack.filter((_, i) => i % Math.max(1, Math.floor(historyTrack.length / 8)) === 0).slice(0, 8).map((p, i) => {
                  const minsAgo = Math.round(historyMinutes * (historyTrack.length - 1 - i * Math.floor(historyTrack.length / 8)) / (historyTrack.length - 1));
                  return (
                    <div key={i} className="flex items-center justify-between py-0.5 border-b border-border/40">
                      <span className="font-mono text-[9px] text-muted-foreground/60">{minsAgo === 0 ? "NOW" : `-${minsAgo}m`}</span>
                      <span className="font-mono text-[10px] text-foreground/60">{p.lat.toFixed(2)}°N, {p.lon.toFixed(2)}°E</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Orbital mechanics summary */}
            <div className="rounded border p-2" style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
              <div className="font-mono text-[9px] text-muted-foreground/80 space-y-0.5">
                <div>Orbital period: <span className="text-foreground/70">{periodMin} min ({revsPerDay} rev/day)</span></div>
                <div>Ground track repeat: <span className="text-foreground/70">{orbitType === "GEO" ? "Stationary" : `~${Math.round(periodMin * 360 / 1440)}° westward/orbit`}</span></div>
                <div>Coverage swath: <span className="text-foreground/70">{footprintKm.toLocaleString()} km radius</span></div>
              </div>
            </div>
          </div>
        )}

        {/* ═══ THREAT TAB ═══ */}
        {activeTab === "threat" && (
          <div className="p-3 space-y-3">
            {/* Threat level banner */}
            <div className="rounded border p-3 text-center" style={{ borderColor: threatColor + "40", background: threatColor + "08" }}>
              <div className="font-mono text-[9px] text-muted-foreground/80 mb-1">THREAT ASSESSMENT LEVEL</div>
              <div className="font-mono text-2xl font-bold" style={{ color: threatColor }}>{threatProfile.level}</div>
              <div className="font-mono text-[9px] text-muted-foreground/60 mt-1">{sat.category.toUpperCase()} CATEGORY ASSET</div>
            </div>

            {/* Capabilities */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-2">ASSESSED CAPABILITIES</div>
              <div className="space-y-1">
                {threatProfile.capabilities.map((cap, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: threatColor }} />
                    <span className="font-mono text-[10px] text-foreground/70">{cap}</span>
                  </div>
                ))}
                {threatProfile.capabilities.length === 0 && (
                  <div className="font-mono text-[10px] text-muted-foreground/50 italic">No capability data available</div>
                )}
              </div>
            </div>

            {/* Intelligence notes */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">INTELLIGENCE NOTES</div>
              <div className="font-mono text-[10px] text-foreground/60 leading-relaxed border-l-2 pl-2" style={{ borderColor: threatColor + "60" }}>
                {threatProfile.notes}
              </div>
            </div>

            {/* Counterpart systems */}
            {threatProfile.counterparts && threatProfile.counterparts.length > 0 && (
              <div>
                <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">COUNTERPART SYSTEMS</div>
                <div className="space-y-0.5">
                  {threatProfile.counterparts.map((cp, i) => (
                    <div key={i} className="flex items-center gap-2 py-0.5">
                      <span className="font-mono text-[9px] text-muted-foreground/60">⇄</span>
                      <span className="font-mono text-[10px] text-foreground/60">{cp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Orbital vulnerability */}
            <div>
              <div className="font-mono text-[9px] tracking-widest text-cyan-500/50 mb-1.5">ORBITAL VULNERABILITY</div>
              <div className="space-y-1">
                {[
                  ["Altitude", sat.altKm < 600 ? "HIGH — within ASAT range" : sat.altKm < 2000 ? "MEDIUM — accessible LEO" : sat.altKm < 36000 ? "LOW — MEO, limited access" : "MINIMAL — GEO, hard to reach", sat.altKm < 600 ? "#ef4444" : sat.altKm < 2000 ? "#f59e0b" : "#22c55e"],
                  ["Inclination", sat.inclination > 80 ? "Polar — global coverage" : sat.inclination > 50 ? "High-inc — wide coverage" : "Low-inc — equatorial focus", "oklch(from var(--foreground) l c h / 0.6)"],
                  ["Maneuverability", sat.category === "reconnaissance" || sat.category === "military" ? "LIKELY — classified propulsion" : "LIMITED — station-keeping only", "oklch(from var(--foreground) l c h / 0.6)"],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="flex justify-between gap-2 py-0.5 border-b border-border/40">
                    <span className="font-mono text-[10px] text-muted-foreground/70 flex-shrink-0">{k}</span>
                    <span className="font-mono text-[10px] text-right" style={{ color: c as string }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded border p-2" style={{ borderColor: "oklch(from var(--foreground) l c h / 0.06)", background: "oklch(from var(--foreground) l c h / 0.02)" }}>
              <div className="font-mono text-[8px] text-muted-foreground/40 leading-relaxed">
                DISCLAIMER: Threat assessments are based on publicly available OSINT and open-source intelligence. 
                Classified capabilities are estimated from open sources. This data is for educational and research purposes only.
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ─── Pass Predictor Panel ─────────────────────────────────────────────────────
function PassPredictorPanel({
  sat, onClose, initialLat, initialLon,
}: {
  sat: SatPosition;
  onClose: () => void;
  initialLat?: number;
  initialLon?: number;
}) {
  const [lat, setLat] = useState(initialLat !== undefined ? String(initialLat.toFixed(4)) : "");
  const [lon, setLon] = useState(initialLon !== undefined ? String(initialLon.toFixed(4)) : "");
  const [locationSearch, setLocationSearch] = useState("");
  const [locationResults, setLocationResults] = useState<typeof LOCATION_DB>([]);
  const [showLocationSearch, setShowLocationSearch] = useState(false);
  const [hours, setHours] = useState("24");
  const [minElev, setMinElev] = useState("10");
  const [passes, setPasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [ran, setRan] = useState(false);
  const [queryInput, setQueryInput] = useState<{ tle1: string; tle2: string; obsLat: number; obsLon: number; hoursAhead: number; minElevDeg: number } | null>(null);

  // Location search filter
  useEffect(() => {
    if (!locationSearch.trim()) { setLocationResults([]); return; }
    const q = locationSearch.toLowerCase();
    setLocationResults(LOCATION_DB.filter(l => l.name.toLowerCase().includes(q)).slice(0, 8));
  }, [locationSearch]);

  // Auto-run if initialLat/Lon provided
  useEffect(() => {
    if (initialLat !== undefined && initialLon !== undefined) {
      setLat(String(initialLat.toFixed(4)));
      setLon(String(initialLon.toFixed(4)));
    }
  }, [initialLat, initialLon]);

  const passQuery = trpc.orbit.getPasses.useQuery(
    queryInput ?? { tle1: sat.tle1, tle2: sat.tle2, obsLat: 0, obsLon: 0, hoursAhead: 24, minElevDeg: 10 },
    { enabled: queryInput !== null }
  );

  useEffect(() => {
    if (passQuery.data) {
      setPasses((passQuery.data as any).passes ?? []);
      setRan(true);
      setLoading(false);
    }
  }, [passQuery.data]);

  const runPredict = useCallback(() => {
    const obsLat = parseFloat(lat), obsLon = parseFloat(lon);
    if (isNaN(obsLat) || isNaN(obsLon)) return;
    setLoading(true);
    setQueryInput({
      tle1: sat.tle1, tle2: sat.tle2,
      obsLat, obsLon,
      hoursAhead: parseInt(hours) || 24,
      minElevDeg: parseInt(minElev) || 10,
    });
  }, [lat, lon, hours, minElev, sat]);

  // Auto-run when pre-filled
  useEffect(() => {
    if (initialLat !== undefined && initialLon !== undefined && !ran) {
      const timer = setTimeout(runPredict, 300);
      return () => clearTimeout(timer);
    }
  }, [initialLat, initialLon, ran, runPredict]);

  const typeIcon = (t: string) => t === "country" ? "🌍" : t === "city" ? "🏙" : t === "military" ? "⚔" : t === "launch" ? "🚀" : t === "strategic" ? "⚓" : "📍";

  return (
    <div className="absolute bottom-10 right-3 z-30 rounded-lg border shadow-2xl overflow-hidden"
      style={{ width: 420, maxHeight: "70vh", background: "var(--card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        <div>
          <div className="font-mono text-xs font-bold text-amber-400 tracking-widest">◎ PASS PREDICTOR</div>
          <div className="font-mono text-[10px] text-amber-700 truncate max-w-[280px]">{sat.name} · #{sat.noradId}</div>
        </div>
        <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono">✕</button>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight: "calc(70vh - 60px)", scrollbarWidth: "thin", scrollbarColor: "var(--primary) transparent" }}>
        {/* Location search */}
        <div className="px-4 pt-3 pb-2">
          <div className="font-mono text-[9px] tracking-widest text-amber-500/50 mb-2">OBSERVER LOCATION</div>
          <div className="relative mb-2">
            <input
              value={locationSearch}
              onChange={e => { setLocationSearch(e.target.value); setShowLocationSearch(true); }}
              onFocus={() => setShowLocationSearch(true)}
              onBlur={() => setTimeout(() => setShowLocationSearch(false), 200)}
              placeholder="Search city, country, military base..."
              className="w-full px-3 py-2 rounded border text-xs font-mono bg-transparent text-amber-300 outline-none placeholder:text-amber-900/60"
              style={{ borderColor: "var(--border)" }}
            />
            {showLocationSearch && locationResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 z-50 rounded border mt-0.5 overflow-hidden shadow-2xl"
                style={{ background: "var(--card)", borderColor: "var(--border)" }}>
                {locationResults.map(loc => (
                  <button key={`${loc.name}-${loc.lat}`}
                    onMouseDown={() => {
                      setLat(String(loc.lat.toFixed(4)));
                      setLon(String(loc.lon.toFixed(4)));
                      setLocationSearch(loc.name);
                      setShowLocationSearch(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-900/20 transition-all text-left border-b border-amber-900/10 last:border-0">
                    <span className="text-sm">{typeIcon(loc.type)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-amber-300 truncate">{loc.name}</div>
                      <div className="font-mono text-[9px] text-amber-700">{loc.lat.toFixed(2)}°, {loc.lon.toFixed(2)}°</div>
                    </div>
                    <span className="font-mono text-[9px] text-amber-800 capitalize">{loc.type}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Manual lat/lon */}
          <div className="grid grid-cols-2 gap-2 mb-2">
            <div>
              <div className="font-mono text-[9px] text-amber-500/50 mb-1">LATITUDE</div>
              <input value={lat} onChange={e => setLat(e.target.value)}
                placeholder="e.g. 40.7128"
                className="w-full px-2 py-1.5 rounded border text-xs font-mono bg-transparent text-amber-300 outline-none placeholder:text-amber-900/40"
                style={{ borderColor: "var(--border)" }} />
            </div>
            <div>
              <div className="font-mono text-[9px] text-amber-500/50 mb-1">LONGITUDE</div>
              <input value={lon} onChange={e => setLon(e.target.value)}
                placeholder="e.g. -74.0060"
                className="w-full px-2 py-1.5 rounded border text-xs font-mono bg-transparent text-amber-300 outline-none placeholder:text-amber-900/40"
                style={{ borderColor: "var(--border)" }} />
            </div>
          </div>

          {/* Parameters */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            <div>
              <div className="font-mono text-[9px] text-amber-500/50 mb-1">HOURS AHEAD</div>
              <select value={hours} onChange={e => setHours(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-xs font-mono bg-muted text-amber-300 outline-none"
                style={{ borderColor: "var(--border)" }}>
                {["6","12","24","48","72"].map(h => <option key={h} value={h}>{h}h</option>)}
              </select>
            </div>
            <div>
              <div className="font-mono text-[9px] text-amber-500/50 mb-1">MIN ELEVATION</div>
              <select value={minElev} onChange={e => setMinElev(e.target.value)}
                className="w-full px-2 py-1.5 rounded border text-xs font-mono bg-muted text-amber-300 outline-none"
                style={{ borderColor: "var(--border)" }}>
                {["0","5","10","15","20","30"].map(e => <option key={e} value={e}>{e}°</option>)}
              </select>
            </div>
          </div>

          <button onClick={runPredict} disabled={loading || !lat || !lon}
            className="w-full py-2 rounded font-mono text-xs font-bold tracking-widest transition-all disabled:opacity-40"
            style={{ background: "oklch(from var(--intel-yellow) l c h / 0.15)", border: "1px solid oklch(from var(--intel-yellow) l c h / 0.4)", color: "var(--intel-yellow)" }}>
            {loading ? "COMPUTING..." : "▶ PREDICT PASSES"}
          </button>
        </div>

        {/* Results */}
        {ran && passes.length === 0 && !loading && (
          <div className="px-4 pb-4 text-center">
            <div className="font-mono text-xs text-amber-700 py-4">No passes above {minElev}° in next {hours}h</div>
          </div>
        )}

        {passes.length > 0 && (
          <div className="px-4 pb-4">
            <div className="font-mono text-[9px] tracking-widest text-amber-500/50 mb-2">{passes.length} PASSES FOUND</div>

            {/* Elevation timeline chart */}
            <div className="mb-3 rounded border overflow-hidden" style={{ borderColor: "var(--border)" }}>
              <div className="font-mono text-[9px] text-amber-500/40 px-2 pt-2 pb-1">MAX ELEVATION CHART</div>
              <div className="px-2 pb-2">
                <svg width="100%" height="60" viewBox={`0 0 ${passes.length * 32} 60`} preserveAspectRatio="none">
                  {passes.map((p, i) => {
                    const maxElVal = Math.min(p.maxEl ?? p.maxElevation ?? 0, 90);
                    const barH = Math.round((maxElVal / 90) * 50);
                    const barColor = maxElVal >= 60 ? "#22c55e" : maxElVal >= 30 ? "#f59e0b" : "#60a5fa";
                    return (
                      <g key={i}>
                        <rect x={i * 32 + 4} y={58 - barH} width={24} height={barH}
                          fill={barColor} fillOpacity={0.7} rx={2} />
                        <text x={i * 32 + 16} y={57} textAnchor="middle"
                          fontSize="7" fill={barColor} fontFamily="monospace">
                          {Math.round(maxElVal)}°
                        </text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Pass list */}
            <div className="space-y-1.5">
              {passes.map((p, i) => {
                const riseTime = new Date(p.riseTime);
                const setTime = new Date(p.setTime);
                const durMin = p.duration ? Math.round(p.duration / 60) : Math.round((setTime.getTime() - riseTime.getTime()) / 60000);
                const maxElev = p.maxEl ?? p.maxElevation ?? 0;
                const qualColor = maxElev >= 60 ? "#22c55e" : maxElev >= 30 ? "#f59e0b" : "#60a5fa";
                const qualLabel = maxElev >= 60 ? "EXCELLENT" : maxElev >= 30 ? "GOOD" : "MARGINAL";
                return (
                  <div key={i} className="rounded border p-2.5" style={{ borderColor: qualColor + "33", background: qualColor + "08" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-mono text-[10px] font-bold" style={{ color: qualColor }}>PASS #{i + 1} · {qualLabel}</span>
                      <span className="font-mono text-[9px] text-muted-foreground/60">{durMin} min</span>
                    </div>
                    <div className="grid grid-cols-3 gap-1 text-[9px] font-mono">
                      <div><div className="text-muted-foreground/60">RISE</div><div className="text-foreground/70">{riseTime.toUTCString().substring(17, 22)} UTC</div><div style={{ color: qualColor }}>{(p.riseAz ?? p.riseAzimuth)?.toFixed(0) ?? "—"}° az</div></div>
                      <div className="text-center"><div className="text-muted-foreground/60">MAX ELEV</div><div className="text-xl font-bold" style={{ color: qualColor }}>{maxElev.toFixed(1)}°</div></div>
                      <div className="text-right"><div className="text-muted-foreground/60">SET</div><div className="text-foreground/70">{setTime.toUTCString().substring(17, 22)} UTC</div><div style={{ color: qualColor }}>{(p.setAz ?? p.setAzimuth)?.toFixed(0) ?? "—"}° az</div></div>
                    </div>
                    <div className="mt-1 text-[9px] font-mono text-muted-foreground/60">
                      {riseTime.toUTCString().substring(0, 16)} UTC
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── AOI Panel ────────────────────────────────────────────────────────────────
function AoiPanel({
  lat, lon, results, onClose, onSelectSat, onPredictPasses,
}: {
  lat: number;
  lon: number;
  results: AoiResult[];
  onClose: () => void;
  onSelectSat: (s: SatPosition) => void;
  onPredictPasses: (sat: SatPosition, lat: number, lon: number) => void;
}) {
  const [minElev, setMinElev] = useState(0);
  const [sortBy, setSortBy] = useState<"elevation" | "range" | "name">("elevation");

  const visible = results
    .filter(r => r.elevationDeg >= minElev)
    .sort((a, b) => sortBy === "elevation" ? b.elevationDeg - a.elevationDeg : sortBy === "range" ? a.rangeKm - b.rangeKm : a.sat.name.localeCompare(b.sat.name));

  return (
    <div className="absolute top-14 right-3 bottom-10 z-20 flex flex-col overflow-hidden rounded-lg border shadow-2xl"
      style={{ width: 380, background: "var(--card)", borderColor: "var(--border)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b" style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        <div className="flex items-center justify-between">
          <div>
            <div className="font-mono text-xs font-bold text-amber-400 tracking-widest">◎ AOI ANALYSIS</div>
            <div className="font-mono text-[10px] text-amber-700">{lat.toFixed(3)}°, {lon.toFixed(3)}°</div>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono">✕</button>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <span className="font-mono text-[9px] text-amber-500/50">MIN ELEV:</span>
          <input type="range" min={0} max={45} step={5} value={minElev}
            onChange={e => setMinElev(Number(e.target.value))}
            className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
            style={{ background: `linear-gradient(to right, #f59e0b ${(minElev/45)*100}%, oklch(from var(--foreground) l c h / 0.1) ${(minElev/45)*100}%)` }} />
          <span className="font-mono text-[10px] text-amber-400 w-8">{minElev}°</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
            className="bg-transparent border border-amber-900/40 text-amber-500 font-mono text-[9px] rounded px-1 py-0.5 outline-none">
            <option value="elevation">↑ ELEV</option>
            <option value="range">↓ RANGE</option>
            <option value="name">A-Z</option>
          </select>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 py-1.5 border-b flex items-center gap-3" style={{ borderColor: "var(--border)" }}>
        <span className="font-mono text-[10px] text-amber-400 font-bold">{visible.length}</span>
        <span className="font-mono text-[10px] text-amber-700">satellites visible above {minElev}°</span>
        <span className="font-mono text-[10px] text-amber-900">of {results.length} tracked</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--primary) transparent" }}>
        {visible.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <span className="font-mono text-xs text-amber-900">No satellites above {minElev}°</span>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "rgba(245,158,11,0.06)" }}>
            {visible.map(r => {
              const elevColor = r.elevationDeg >= 60 ? "#22c55e" : r.elevationDeg >= 30 ? "#f59e0b" : r.elevationDeg >= 10 ? "#60a5fa" : "#ffffff44";
              return (
                <div key={r.sat.noradId} className="px-3 py-2 hover:bg-amber-900/10 transition-all">
                  <div className="flex items-center gap-2">
                    <div className="text-center w-10 flex-shrink-0">
                      <div className="font-mono text-sm font-bold" style={{ color: elevColor }}>{r.elevationDeg.toFixed(0)}°</div>
                      <div className="font-mono text-[8px] text-muted-foreground/60">ELEV</div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-mono text-xs text-foreground truncate">{r.sat.name}</div>
                      <div className="font-mono text-[9px] text-muted-foreground/80">
                        #{r.sat.noradId} · {r.rangeKm.toFixed(0)}km · {r.azimuthDeg.toFixed(0)}° az
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => onSelectSat(r.sat)}
                        className="px-1.5 py-0.5 rounded font-mono text-[9px] border transition-all hover:bg-foreground/10"
                        style={{ borderColor: "oklch(from var(--foreground) l c h / 0.15)", color: "oklch(from var(--foreground) l c h / 0.5)" }}>
                        INFO
                      </button>
                      <button onClick={() => onPredictPasses(r.sat, lat, lon)}
                        className="px-1.5 py-0.5 rounded font-mono text-[9px] border transition-all"
                        style={{ borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b", background: "rgba(245,158,11,0.08)" }}>
                        PASS
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mission Control Tab ─────────────────────────────────────────────────────
type MissionStatus = "planning" | "active" | "paused" | "completed" | "archived";
type MissionPriority = "low" | "medium" | "high" | "critical";
type MissionClassification = "unclassified" | "confidential" | "secret" | "top_secret";

interface Mission {
  id: number;
  name: string;
  codename?: string | null;
  description?: string | null;
  status: MissionStatus;
  priority: MissionPriority;
  classification: MissionClassification;
  aoiLat?: number | null;
  aoiLon?: number | null;
  aoiRadiusKm?: number | null;
  aoiName?: string | null;
  assignedSatellites?: number[] | null;
  objectives?: string | null;
  notes?: string | null;
  tags?: string[] | null;
  passCount?: number | null;
  lastPassAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function MissionControlTab({ onClose, allSats }: { onClose: () => void; allSats: SatPosition[] }) {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingMission, setEditingMission] = useState<Mission | null>(null);
  const [filterStatus, setFilterStatus] = useState<MissionStatus | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Form state
  const [form, setForm] = useState({
    name: "", codename: "", description: "", status: "planning" as MissionStatus,
    priority: "medium" as MissionPriority, classification: "unclassified" as MissionClassification,
    aoiLat: "", aoiLon: "", aoiRadiusKm: "500", aoiName: "",
    objectives: "", notes: "", tags: "",
    assignedSatellites: [] as number[],
  });

  const utils = trpc.useUtils();
  const { data: missions = [], isLoading } = trpc.surveillanceMissions.list.useQuery({ limit: 100 });
  const createMission = trpc.surveillanceMissions.create.useMutation({ onSuccess: () => { utils.surveillanceMissions.list.invalidate(); setShowCreate(false); resetForm(); } });
  const updateMission = trpc.surveillanceMissions.update.useMutation({ onSuccess: () => { utils.surveillanceMissions.list.invalidate(); setEditingMission(null); resetForm(); } });
  const deleteMission = trpc.surveillanceMissions.delete.useMutation({ onSuccess: () => { utils.surveillanceMissions.list.invalidate(); setSelectedMission(null); } });
  const setStatus = trpc.surveillanceMissions.setStatus.useMutation({ onSuccess: () => utils.surveillanceMissions.list.invalidate() });

  function resetForm() {
    setForm({ name: "", codename: "", description: "", status: "planning", priority: "medium",
      classification: "unclassified", aoiLat: "", aoiLon: "", aoiRadiusKm: "500", aoiName: "",
      objectives: "", notes: "", tags: "", assignedSatellites: [] });
  }

  function openEdit(m: Mission) {
    setEditingMission(m);
    setForm({
      name: m.name, codename: m.codename ?? "", description: m.description ?? "",
      status: m.status, priority: m.priority, classification: m.classification,
      aoiLat: m.aoiLat != null ? String(m.aoiLat) : "",
      aoiLon: m.aoiLon != null ? String(m.aoiLon) : "",
      aoiRadiusKm: m.aoiRadiusKm != null ? String(m.aoiRadiusKm) : "500",
      aoiName: m.aoiName ?? "", objectives: m.objectives ?? "", notes: m.notes ?? "",
      tags: (m.tags ?? []).join(", "),
      assignedSatellites: m.assignedSatellites ?? [],
    });
    setShowCreate(true);
  }

  function handleSubmit() {
    const payload = {
      name: form.name, codename: form.codename || undefined,
      description: form.description || undefined,
      status: form.status, priority: form.priority, classification: form.classification,
      aoiLat: form.aoiLat ? parseFloat(form.aoiLat) : undefined,
      aoiLon: form.aoiLon ? parseFloat(form.aoiLon) : undefined,
      aoiRadiusKm: form.aoiRadiusKm ? parseFloat(form.aoiRadiusKm) : undefined,
      aoiName: form.aoiName || undefined,
      objectives: form.objectives || undefined,
      notes: form.notes || undefined,
      tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [],
      assignedSatellites: form.assignedSatellites,
    };
    if (editingMission) {
      updateMission.mutate({ id: editingMission.id, ...payload });
    } else {
      createMission.mutate(payload);
    }
  }

  function toggleSatellite(noradId: number) {
    setForm(f => ({
      ...f,
      assignedSatellites: f.assignedSatellites.includes(noradId)
        ? f.assignedSatellites.filter(id => id !== noradId)
        : [...f.assignedSatellites, noradId],
    }));
  }

  const STATUS_COLORS: Record<MissionStatus, string> = {
    planning: "#60a5fa", active: "#22c55e", paused: "#f59e0b",
    completed: "#a855f7", archived: "oklch(from var(--foreground) l c h / 0.3)",
  };
  const PRIORITY_COLORS: Record<MissionPriority, string> = {
    low: "#6b7280", medium: "#60a5fa", high: "#f59e0b", critical: "#ef4444",
  };
  const CLASS_COLORS: Record<MissionClassification, string> = {
    unclassified: "#22c55e", confidential: "#60a5fa", secret: "#f59e0b", top_secret: "#ef4444",
  };

  const filtered = (missions as Mission[]).filter(m =>
    (filterStatus === "ALL" || m.status === filterStatus) &&
    (!searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (m.codename ?? "").toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const inputCls = "w-full px-3 py-1.5 rounded border text-xs font-mono bg-transparent text-cyan-200 outline-none placeholder:text-border";
  const inputStyle = { borderColor: "var(--border)" };
  const labelCls = "font-mono text-[9px] tracking-widest text-cyan-500/60 mb-1";

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "oklch(from var(--background) l c h / 0.97)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b flex items-center gap-4"
        style={{ background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
        <div>
          <div className="font-mono text-sm font-bold text-green-400 tracking-widest">MISSION CONTROL</div>
          <div className="font-mono text-[10px] text-green-700">
            Surveillance Missions · {(missions as Mission[]).filter(m => m.status === "active").length} Active · {(missions as Mission[]).length} Total
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button onClick={() => { setEditingMission(null); resetForm(); setShowCreate(true); }}
            className="px-3 py-1.5 rounded font-mono text-xs border transition-all"
            style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
            + NEW MISSION
          </button>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono text-sm">✕ CLOSE</button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex-shrink-0 px-6 py-2 border-b flex items-center gap-3"
        style={{ borderColor: "rgba(34,197,94,0.08)" }}>
        <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search missions..."
          className="px-3 py-1.5 rounded border text-xs font-mono bg-transparent text-green-300 outline-none placeholder:text-green-900"
          style={{ borderColor: "rgba(34,197,94,0.2)", width: 200 }} />
        {(["ALL", "planning", "active", "paused", "completed", "archived"] as const).map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className="px-2 py-1 rounded font-mono text-[10px] border transition-all"
            style={{
              borderColor: filterStatus === s ? (s === "ALL" ? "oklch(from var(--foreground) l c h / 0.3)" : STATUS_COLORS[s as MissionStatus] + "66") : "oklch(from var(--foreground) l c h / 0.1)",
              background: filterStatus === s ? (s === "ALL" ? "oklch(from var(--foreground) l c h / 0.05)" : STATUS_COLORS[s as MissionStatus] + "15") : "transparent",
              color: filterStatus === s ? (s === "ALL" ? "#fff" : STATUS_COLORS[s as MissionStatus]) : "oklch(from var(--foreground) l c h / 0.3)",
            }}>
            {s.toUpperCase()}
          </button>
        ))}
        <span className="font-mono text-[10px] text-muted-foreground/40 ml-auto">{filtered.length} missions</span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden flex">
        {/* Mission list */}
        <div className="w-80 flex-shrink-0 border-r overflow-y-auto" style={{ borderColor: "rgba(34,197,94,0.1)", scrollbarWidth: "thin", scrollbarColor: "rgba(34,197,94,0.15) transparent" }}>
          {isLoading && <div className="p-6 text-center font-mono text-xs text-green-700">LOADING MISSIONS...</div>}
          {!isLoading && filtered.length === 0 && (
            <div className="p-6 text-center">
              <div className="font-mono text-xs text-muted-foreground/40 mb-2">NO MISSIONS</div>
              <div className="font-mono text-[10px] text-muted-foreground/20">Click + NEW MISSION to create one</div>
            </div>
          )}
          {filtered.map(m => (
            <div key={m.id}
              className="px-4 py-3 border-b cursor-pointer transition-all"
              style={{
                borderColor: "rgba(34,197,94,0.06)",
                background: selectedMission?.id === m.id ? "rgba(34,197,94,0.08)" : "transparent",
              }}
              onClick={() => setSelectedMission(m)}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: STATUS_COLORS[m.status] }} />
                <span className="font-mono text-xs text-foreground truncate flex-1">{m.name}</span>
                <span className="font-mono text-[9px] px-1 py-0.5 rounded flex-shrink-0"
                  style={{ background: PRIORITY_COLORS[m.priority] + "15", color: PRIORITY_COLORS[m.priority], border: `1px solid ${PRIORITY_COLORS[m.priority]}30` }}>
                  {m.priority.toUpperCase()}
                </span>
              </div>
              {m.codename && <div className="font-mono text-[9px] text-green-600 mb-1">CODENAME: {m.codename}</div>}
              <div className="flex items-center gap-2">
                <span className="font-mono text-[9px] px-1 py-0.5 rounded"
                  style={{ background: STATUS_COLORS[m.status] + "15", color: STATUS_COLORS[m.status], border: `1px solid ${STATUS_COLORS[m.status]}30` }}>
                  {m.status.toUpperCase()}
                </span>
                <span className="font-mono text-[9px] px-1 py-0.5 rounded"
                  style={{ background: CLASS_COLORS[m.classification] + "15", color: CLASS_COLORS[m.classification], border: `1px solid ${CLASS_COLORS[m.classification]}30` }}>
                  {m.classification.replace("_", " ").toUpperCase()}
                </span>
                {m.assignedSatellites && m.assignedSatellites.length > 0 && (
                  <span className="font-mono text-[9px] text-cyan-600">{m.assignedSatellites.length} SAT</span>
                )}
              </div>
              {m.aoiName && <div className="font-mono text-[9px] text-muted-foreground/60 mt-1">AOI: {m.aoiName}</div>}
            </div>
          ))}
        </div>

        {/* Mission detail */}
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(34,197,94,0.15) transparent" }}>
          {!selectedMission && !showCreate && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="font-mono text-4xl text-green-900 mb-4">⊕</div>
                <div className="font-mono text-sm text-muted-foreground/40">SELECT A MISSION</div>
                <div className="font-mono text-[10px] text-muted-foreground/20 mt-1">or create a new surveillance mission</div>
              </div>
            </div>
          )}

          {/* Create/Edit form */}
          {showCreate && (
            <div className="p-6 max-w-2xl">
              <div className="font-mono text-sm font-bold text-green-400 tracking-widest mb-4">
                {editingMission ? "EDIT MISSION" : "NEW MISSION"}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className={labelCls}>MISSION NAME *</div>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="Operation name..." className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <div className={labelCls}>CODENAME</div>
                  <input value={form.codename} onChange={e => setForm(f => ({ ...f, codename: e.target.value }))}
                    placeholder="e.g. IRON EAGLE" className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div className="mb-4">
                <div className={labelCls}>DESCRIPTION</div>
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Mission description..." rows={2}
                  className={inputCls + " resize-none"} style={inputStyle} />
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className={labelCls}>STATUS</div>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as MissionStatus }))}
                    className={inputCls} style={{ ...inputStyle, background: "var(--card)" }}>
                    {(["planning", "active", "paused", "completed", "archived"] as const).map(s => (
                      <option key={s} value={s}>{s.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={labelCls}>PRIORITY</div>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as MissionPriority }))}
                    className={inputCls} style={{ ...inputStyle, background: "var(--card)" }}>
                    {(["low", "medium", "high", "critical"] as const).map(p => (
                      <option key={p} value={p}>{p.toUpperCase()}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className={labelCls}>CLASSIFICATION</div>
                  <select value={form.classification} onChange={e => setForm(f => ({ ...f, classification: e.target.value as MissionClassification }))}
                    className={inputCls} style={{ ...inputStyle, background: "var(--card)" }}>
                    {(["unclassified", "confidential", "secret", "top_secret"] as const).map(c => (
                      <option key={c} value={c}>{c.replace("_", " ").toUpperCase()}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="font-mono text-[9px] tracking-widest text-green-500/60 mb-2">AREA OF INTEREST (AOI)</div>
              <div className="grid grid-cols-4 gap-3 mb-4 p-3 rounded border" style={{ borderColor: "rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.03)" }}>
                <div>
                  <div className={labelCls}>LATITUDE</div>
                  <input value={form.aoiLat} onChange={e => setForm(f => ({ ...f, aoiLat: e.target.value }))}
                    placeholder="e.g. 35.69" type="number" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <div className={labelCls}>LONGITUDE</div>
                  <input value={form.aoiLon} onChange={e => setForm(f => ({ ...f, aoiLon: e.target.value }))}
                    placeholder="e.g. 139.69" type="number" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <div className={labelCls}>RADIUS (km)</div>
                  <input value={form.aoiRadiusKm} onChange={e => setForm(f => ({ ...f, aoiRadiusKm: e.target.value }))}
                    placeholder="500" type="number" className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <div className={labelCls}>LOCATION NAME</div>
                  <input value={form.aoiName} onChange={e => setForm(f => ({ ...f, aoiName: e.target.value }))}
                    placeholder="e.g. Tehran" className={inputCls} style={inputStyle} />
                </div>
              </div>

              <div className="mb-4">
                <div className={labelCls}>OBJECTIVES</div>
                <textarea value={form.objectives} onChange={e => setForm(f => ({ ...f, objectives: e.target.value }))}
                  placeholder="Mission objectives..." rows={2}
                  className={inputCls + " resize-none"} style={inputStyle} />
              </div>

              <div className="mb-4">
                <div className={labelCls}>ANALYST NOTES</div>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Internal notes..." rows={2}
                  className={inputCls + " resize-none"} style={inputStyle} />
              </div>

              <div className="mb-4">
                <div className={labelCls}>TAGS (comma-separated)</div>
                <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
                  placeholder="e.g. iran, nuclear, priority" className={inputCls} style={inputStyle} />
              </div>

              {/* Satellite assignment */}
              <div className="mb-4">
                <div className={labelCls}>ASSIGN SATELLITES ({form.assignedSatellites.length} selected)</div>
                <div className="border rounded p-2 max-h-40 overflow-y-auto" style={{ borderColor: "var(--border)", scrollbarWidth: "thin" }}>
                  {allSats.slice(0, 60).map(s => (
                    <label key={s.noradId} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer hover:bg-cyan-900/10 rounded">
                      <input type="checkbox"
                        checked={form.assignedSatellites.includes(s.noradId)}
                        onChange={() => toggleSatellite(s.noradId)}
                        className="rounded" />
                      <span className="font-mono text-[10px] text-foreground/70">{s.name}</span>
                      <span className="font-mono text-[9px] text-muted-foreground ml-auto">{s.noradId}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex gap-3">
                <button onClick={handleSubmit}
                  disabled={!form.name || createMission.isPending || updateMission.isPending}
                  className="px-4 py-2 rounded font-mono text-xs border transition-all disabled:opacity-40"
                  style={{ borderColor: "rgba(34,197,94,0.4)", background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                  {createMission.isPending || updateMission.isPending ? "SAVING..." : editingMission ? "UPDATE MISSION" : "CREATE MISSION"}
                </button>
                <button onClick={() => { setShowCreate(false); setEditingMission(null); resetForm(); }}
                  className="px-4 py-2 rounded font-mono text-xs border transition-all"
                  style={{ borderColor: "oklch(from var(--foreground) l c h / 0.1)", color: "oklch(from var(--foreground) l c h / 0.4)" }}>
                  CANCEL
                </button>
              </div>
            </div>
          )}

          {/* Mission detail view */}
          {selectedMission && !showCreate && (
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ background: STATUS_COLORS[selectedMission.status] }} />
                    <div className="font-mono text-lg font-bold text-foreground">{selectedMission.name}</div>
                  </div>
                  {selectedMission.codename && (
                    <div className="font-mono text-xs text-green-500 tracking-widest">CODENAME: {selectedMission.codename}</div>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    {[selectedMission.status, selectedMission.priority, selectedMission.classification].map((val, i) => {
                      const colors = [STATUS_COLORS, PRIORITY_COLORS, CLASS_COLORS];
                      const c = (colors[i] as Record<string, string>)[val];
                      return (
                        <span key={i} className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: c + "15", color: c, border: `1px solid ${c}30` }}>
                          {val.replace("_", " ").toUpperCase()}
                        </span>
                      );
                    })}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selectedMission)}
                    className="px-3 py-1.5 rounded font-mono text-xs border transition-all"
                    style={{ borderColor: "rgba(96,165,250,0.3)", color: "#60a5fa" }}>EDIT</button>
                  <button onClick={() => { if (confirm("Delete this mission?")) deleteMission.mutate({ id: selectedMission.id }); }}
                    className="px-3 py-1.5 rounded font-mono text-xs border transition-all"
                    style={{ borderColor: "rgba(239,68,68,0.3)", color: "#ef4444" }}>DELETE</button>
                </div>
              </div>

              {/* Status controls */}
              <div className="mb-6 p-3 rounded border" style={{ borderColor: "rgba(34,197,94,0.15)", background: "rgba(34,197,94,0.03)" }}>
                <div className="font-mono text-[9px] tracking-widest text-green-500/60 mb-2">MISSION STATUS CONTROL</div>
                <div className="flex gap-2 flex-wrap">
                  {(["planning", "active", "paused", "completed", "archived"] as const).map(s => (
                    <button key={s}
                      onClick={() => setStatus.mutate({ id: selectedMission.id, status: s })}
                      className="px-2 py-1 rounded font-mono text-[10px] border transition-all"
                      style={{
                        borderColor: selectedMission.status === s ? STATUS_COLORS[s] + "66" : "oklch(from var(--foreground) l c h / 0.1)",
                        background: selectedMission.status === s ? STATUS_COLORS[s] + "15" : "transparent",
                        color: selectedMission.status === s ? STATUS_COLORS[s] : "oklch(from var(--foreground) l c h / 0.3)",
                      }}>
                      {s.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                {[
                  ["PASS COUNT", selectedMission.passCount ?? 0, "#22d3ee"],
                  ["SATELLITES", (selectedMission.assignedSatellites ?? []).length, "#a855f7"],
                  ["AOI RADIUS", selectedMission.aoiRadiusKm ? `${selectedMission.aoiRadiusKm} km` : "N/A", "#f59e0b"],
                ].map(([k, v, c]) => (
                  <div key={k as string} className="p-3 rounded border" style={{ borderColor: (c as string) + "20", background: (c as string) + "08" }}>
                    <div className="font-mono text-[9px] tracking-widest mb-1" style={{ color: (c as string) + "99" }}>{k as string}</div>
                    <div className="font-mono text-xl font-bold" style={{ color: c as string }}>{v as string | number}</div>
                  </div>
                ))}
              </div>

              {/* AOI */}
              {(selectedMission.aoiLat != null || selectedMission.aoiName) && (
                <div className="mb-4 p-3 rounded border" style={{ borderColor: "var(--border)", background: "rgba(245,158,11,0.03)" }}>
                  <div className="font-mono text-[9px] tracking-widest text-amber-500/60 mb-2">AREA OF INTEREST</div>
                  <div className="font-mono text-xs text-foreground/80">{selectedMission.aoiName ?? "Unnamed AOI"}</div>
                  {selectedMission.aoiLat != null && (
                    <div className="font-mono text-[10px] text-amber-600 mt-1">
                      {selectedMission.aoiLat.toFixed(4)}°N, {selectedMission.aoiLon?.toFixed(4)}°E
                    </div>
                  )}
                </div>
              )}

              {/* Objectives */}
              {selectedMission.objectives && (
                <div className="mb-4">
                  <div className="font-mono text-[9px] tracking-widest text-green-500/60 mb-1">OBJECTIVES</div>
                  <div className="font-mono text-[10px] text-foreground/60 leading-relaxed border-l-2 border-green-900 pl-3">
                    {selectedMission.objectives}
                  </div>
                </div>
              )}

              {/* Assigned satellites */}
              {selectedMission.assignedSatellites && selectedMission.assignedSatellites.length > 0 && (
                <div className="mb-4">
                  <div className="font-mono text-[9px] tracking-widest text-cyan-500/60 mb-2">ASSIGNED SATELLITES ({selectedMission.assignedSatellites.length})</div>
                  <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                    {selectedMission.assignedSatellites.map(noradId => {
                      const sat = allSats.find(s => s.noradId === noradId);
                      return (
                        <div key={noradId} className="flex items-center gap-2 px-2 py-1.5 rounded border"
                          style={{ borderColor: "var(--border)", background: "var(--muted)" }}>
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                          <span className="font-mono text-[10px] text-foreground/70 truncate flex-1">{sat?.name ?? `NORAD ${noradId}`}</span>
                          <span className="font-mono text-[9px] text-muted-foreground">{noradId}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Tags */}
              {selectedMission.tags && selectedMission.tags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {selectedMission.tags.map(tag => (
                    <span key={tag} className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                      style={{ background: "oklch(from var(--foreground) l c h / 0.05)", color: "oklch(from var(--foreground) l c h / 0.4)", border: "1px solid oklch(from var(--foreground) l c h / 0.1)" }}>
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Surveillance Tab ─────────────────────────────────────────────────────────
function SurveillanceTab({ onClose }: { onClose: () => void }) {
  const [filter, setFilter] = useState<string>("ALL");
  const [search, setSearch] = useState("");

  const categories = [
    { key: "ALL", label: "All Sources", color: "#ffffff" },
    { key: "EARTH_OBS", label: "Earth Obs", color: "#22d3ee" },
    { key: "WEATHER", label: "Weather", color: "#60a5fa" },
    { key: "CRISIS", label: "Crisis", color: "#ef4444" },
    { key: "MONITORING", label: "Monitoring", color: "#f59e0b" },
    { key: "COMMERCIAL", label: "Commercial", color: "#84cc16" },
  ];

  const filtered = OSINT_SOURCES.filter(s =>
    (filter === "ALL" || s.category === filter) &&
    (!search || s.name.toLowerCase().includes(search.toLowerCase()) || s.description.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "oklch(from var(--background) l c h / 0.97)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b flex items-center gap-4"
        style={{ background: "rgba(239,68,68,0.04)", borderColor: "rgba(239,68,68,0.15)" }}>
        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
        <div>
          <div className="font-mono text-sm font-bold text-red-400 tracking-widest">SURVEILLANCE MODE</div>
          <div className="font-mono text-[10px] text-red-700">OSINT Open Satellite Imagery · {OSINT_SOURCES.length} Sources</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search sources..."
            className="px-3 py-1.5 rounded border text-xs font-mono bg-transparent text-foreground/70 outline-none placeholder:text-muted-foreground/40"
            style={{ borderColor: "oklch(from var(--foreground) l c h / 0.1)", width: 200 }} />
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono text-sm">✕ CLOSE</button>
        </div>
      </div>

      {/* Category filters */}
      <div className="flex-shrink-0 px-6 py-2 border-b flex items-center gap-2 overflow-x-auto"
        style={{ borderColor: "oklch(from var(--foreground) l c h / 0.06)" }}>
        {categories.map(c => (
          <button key={c.key} onClick={() => setFilter(c.key)}
            className="flex-shrink-0 px-3 py-1 rounded font-mono text-[10px] border transition-all"
            style={{
              borderColor: filter === c.key ? c.color + "66" : "oklch(from var(--foreground) l c h / 0.1)",
              background: filter === c.key ? c.color + "15" : "transparent",
              color: filter === c.key ? c.color : "oklch(from var(--foreground) l c h / 0.4)",
            }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Source grid */}
      <div className="flex-1 overflow-y-auto px-6 py-4" style={{ scrollbarWidth: "thin", scrollbarColor: "oklch(from var(--foreground) l c h / 0.1) transparent" }}>
        <div className="grid grid-cols-1 gap-3 max-w-5xl mx-auto" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))" }}>
          {filtered.map(src => (
            <div key={src.name} className="rounded-lg border overflow-hidden transition-all hover:border-opacity-60"
              style={{ background: "oklch(from var(--background) l c h / 0.85)", borderColor: src.color + "30" }}>
              {/* Source header */}
              <div className="px-4 py-3 border-b flex items-center justify-between"
                style={{ background: src.color + "08", borderColor: src.color + "20" }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: src.color }} />
                  <span className="font-mono text-xs font-bold" style={{ color: src.color }}>{src.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                    style={{ background: src.color + "15", color: src.color, border: `1px solid ${src.color}30` }}>
                    {src.category.replace("_", " ")}
                  </span>
                  <a href={src.url} target="_blank" rel="noopener noreferrer"
                    className="px-2 py-0.5 rounded font-mono text-[9px] font-bold transition-all hover:opacity-80"
                    style={{ background: src.color + "20", color: src.color, border: `1px solid ${src.color}40` }}>
                    OPEN ↗
                  </a>
                </div>
              </div>

              {/* Source body */}
              <div className="px-4 py-3">
                <p className="font-mono text-[10px] text-foreground/60 mb-3 leading-relaxed">{src.description}</p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {[
                    ["COVERAGE", src.coverage],
                    ["RESOLUTION", src.resolution],
                    ["LATENCY", src.latency],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded p-1.5 text-center" style={{ background: "oklch(from var(--foreground) l c h / 0.03)" }}>
                      <div className="font-mono text-[8px] text-muted-foreground/60 mb-0.5">{k}</div>
                      <div className="font-mono text-[9px] text-foreground/70">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1">
                  {src.satellites.map(s => (
                    <span key={s} className="font-mono text-[8px] px-1.5 py-0.5 rounded"
                      style={{ background: "oklch(from var(--foreground) l c h / 0.05)", color: "oklch(from var(--foreground) l c h / 0.4)", border: "1px solid oklch(from var(--foreground) l c h / 0.08)" }}>
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Intel Feed Tab ───────────────────────────────────────────────────────────
function IntelFeedTab({ allSats, categories, onClose, onSelectSat }: {
  allSats: SatPosition[];
  categories: { key: string; label: string; color: string }[];
  onClose: () => void;
  onSelectSat: (s: SatPosition) => void;
}) {
  const [sortBy, setSortBy] = useState<"age" | "alt" | "name" | "speed">("age");
  const [filterCat, setFilterCat] = useState("ALL");
  const [search, setSearch] = useState("");
  const [showDecayOnly, setShowDecayOnly] = useState(false);
  const [activePanel, setActivePanel] = useState<"catalog" | "conjunctions" | "decay" | "stream">("catalog");
  const [liveLog, setLiveLog] = useState<string[]>([]);

  // Live data stream simulation
  useEffect(() => {
    const events = [
      () => `[TLE UPDATE] ${allSats[Math.floor(Math.random()*allSats.length)]?.name ?? 'UNKNOWN'} — epoch refreshed`,
      () => `[ORBIT TRACK] ${allSats[Math.floor(Math.random()*allSats.length)]?.name ?? 'UNKNOWN'} — position propagated`,
      () => `[COVERAGE] AOI scan complete — ${Math.floor(Math.random()*8)+1} satellites in view`,
      () => `[PASS PRED] Next overhead pass computed for observer`,
      () => `[CONJUNCTION] Proximity check: ${allSats.length} objects evaluated`,
      () => `[SIGINT] RF emission pattern logged — ${['L-band','S-band','X-band','Ka-band'][Math.floor(Math.random()*4)]}`,
      () => `[MANEUVER] Orbital adjustment detected — delta-v estimated`,
      () => `[DECAY] Atmospheric drag update — ${allSats.filter(s=>s.altKm<300).length} objects below 300km`,
    ];
    const tick = () => {
      const msg = `${new Date().toISOString().slice(11,19)}Z  ${events[Math.floor(Math.random()*events.length)]()}`;
      setLiveLog(prev => [msg, ...prev].slice(0, 50));
    };
    tick();
    const id = setInterval(tick, 2000);
    return () => clearInterval(id);
  }, [allSats]);

  const satsWithAge = useMemo(() => allSats.map(s => ({
    ...s,
    tleAge: getTleAgeDays(s.tle1) ?? 999,
    isDecaying: s.altKm < 300,
  })), [allSats]);

  // Conjunction alerts: find pairs within 200km (simplified 2D distance)
  const conjunctions = useMemo(() => {
    const leoSats = satsWithAge.filter(s => s.altKm < 2000);
    const alerts: { satA: string; satB: string; dist: number; altA: number; altB: number }[] = [];
    for (let i = 0; i < Math.min(leoSats.length, 60); i++) {
      for (let j = i + 1; j < Math.min(leoSats.length, 60); j++) {
        const a = leoSats[i], b = leoSats[j];
        const dlat = (a.lat - b.lat) * 111.32;
        const dlon = (a.lon - b.lon) * 111.32 * Math.cos(a.lat * Math.PI / 180);
        const dalt = a.altKm - b.altKm;
        const dist = Math.sqrt(dlat*dlat + dlon*dlon + dalt*dalt);
        if (dist < 500) alerts.push({ satA: a.name, satB: b.name, dist: Math.round(dist), altA: Math.round(a.altKm), altB: Math.round(b.altKm) });
      }
    }
    return alerts.sort((a, b) => a.dist - b.dist).slice(0, 20);
  }, [satsWithAge]);

  // Decay predictions: estimate days to reentry for low-orbit sats
  const decayPredictions = useMemo(() => satsWithAge
    .filter(s => s.altKm < 400)
    .map(s => {
      // Simplified: drag scale height ~50km, density doubles every 50km lower
      const daysToReentry = s.altKm < 200 ? Math.round(s.altKm / 5) :
        s.altKm < 300 ? Math.round(s.altKm * 0.8) :
        Math.round(s.altKm * 2.5);
      return { ...s, daysToReentry };
    })
    .sort((a, b) => a.daysToReentry - b.daysToReentry)
    .slice(0, 30), [satsWithAge]);

  const filtered = useMemo(() => satsWithAge
    .filter(s =>
      (filterCat === "ALL" || s.category === filterCat) &&
      (!search || s.name.toLowerCase().includes(search.toLowerCase()) || String(s.noradId).includes(search)) &&
      (!showDecayOnly || s.isDecaying)
    )
    .sort((a, b) => {
      if (sortBy === "age") return b.tleAge - a.tleAge;
      if (sortBy === "alt") return a.altKm - b.altKm;
      if (sortBy === "speed") return b.speedKms - a.speedKms;
      return a.name.localeCompare(b.name);
    }), [satsWithAge, filterCat, search, showDecayOnly, sortBy]);

  const staleCount = satsWithAge.filter(s => s.tleAge > 7).length;
  const decayCount = satsWithAge.filter(s => s.isDecaying).length;

  return (
    <div className="absolute inset-0 z-40 flex flex-col" style={{ background: "oklch(from var(--background) l c h / 0.97)" }}>
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b flex items-center gap-4"
        style={{ background: "var(--muted)", borderColor: "var(--border)" }}>
        <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
        <div>
          <div className="font-mono text-sm font-bold text-cyan-400 tracking-widest">INTEL FEED</div>
          <div className="font-mono text-[10px] text-muted-foreground">Live TLE Data · {allSats.length} Objects · {staleCount} Stale · {decayCount} Decaying</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="flex items-center gap-3 text-[10px] font-mono">
            <span className="text-red-400">⚠ {staleCount} stale TLE (&gt;7d)</span>
            <span className="text-amber-400">↓ {decayCount} decaying (&lt;300km)</span>
          </div>
          <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono text-sm ml-3">✕ CLOSE</button>
        </div>
      </div>

      {/* Sub-panel tabs */}
      <div className="flex-shrink-0 px-6 py-0 border-b flex items-center gap-0"
        style={{ borderColor: "var(--border)" }}>
        {(["catalog", "conjunctions", "decay", "stream"] as const).map(p => (
          <button key={p} onClick={() => setActivePanel(p)}
            className="px-4 py-2.5 font-mono text-[10px] tracking-widest transition-all border-b-2"
            style={{
              color: activePanel === p ? "#22d3ee" : "rgba(0,200,255,0.3)",
              borderBottomColor: activePanel === p ? "#22d3ee" : "transparent",
              background: "transparent",
            }}>
            {p === "catalog" ? `▤ CATALOG (${allSats.length})` :
             p === "conjunctions" ? `⚠ CONJUNCTIONS (${conjunctions.length})` :
             p === "decay" ? `↓ DECAY WATCH (${decayPredictions.length})` :
             `▶ LIVE STREAM`}
          </button>
        ))}
      </div>

      {/* CATALOG panel */}
      {activePanel === "catalog" && (
        <>
          <div className="flex-shrink-0 px-6 py-2 border-b flex items-center gap-3 flex-wrap"
            style={{ borderColor: "var(--border)" }}>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search name / NORAD ID..."
              className="px-3 py-1.5 rounded border text-xs font-mono bg-transparent text-cyan-300 outline-none placeholder:text-border"
              style={{ borderColor: "var(--border)", width: 200 }} />
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className="px-2 py-1.5 rounded border text-xs font-mono bg-muted text-cyan-300 outline-none"
              style={{ borderColor: "var(--border)" }}>
              <option value="ALL">All Categories</option>
              {categories.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            </select>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as any)}
              className="px-2 py-1.5 rounded border text-xs font-mono bg-muted text-cyan-300 outline-none"
              style={{ borderColor: "var(--border)" }}>
              <option value="age">Sort: TLE Age (oldest first)</option>
              <option value="alt">Sort: Altitude (lowest first)</option>
              <option value="speed">Sort: Speed (fastest first)</option>
              <option value="name">Sort: Name A-Z</option>
            </select>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input type="checkbox" checked={showDecayOnly} onChange={e => setShowDecayOnly(e.target.checked)} className="rounded" />
              <span className="font-mono text-[10px] text-amber-400">Decaying only (&lt;300km)</span>
            </label>
            <span className="font-mono text-[10px] text-muted-foreground/60 ml-auto">{filtered.length} results</span>
          </div>
          <div className="flex-1 overflow-auto" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--muted-foreground) transparent" }}>
            <table className="w-full text-left" style={{ minWidth: 800 }}>
              <thead className="sticky top-0 z-10" style={{ background: "oklch(from var(--background) l c h / 0.98)", borderBottom: "1px solid var(--border)" }}>
                <tr>
                  {["NORAD", "NAME", "CATEGORY", "ALT (km)", "SPEED (km/s)", "INC", "TLE AGE", "STATUS"].map(h => (
                    <th key={h} className="px-4 py-2 font-mono text-[9px] tracking-widest text-cyan-500/50 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((s, i) => {
                  const catColor = categories.find(c => c.key === s.category)?.color ?? "#fff";
                  const ageColor = s.tleAge < 3 ? "#22c55e" : s.tleAge < 7 ? "#f59e0b" : "#ef4444";
                  const statusColor = s.altKm < 200 ? "#ef4444" : s.altKm < 300 ? "#f59e0b" : "#22c55e";
                  const statusLabel = s.altKm < 200 ? "DECAYING" : s.altKm < 300 ? "LOW ORBIT" : "NOMINAL";
                  return (
                    <tr key={s.noradId}
                      className="border-b cursor-pointer transition-all hover:bg-cyan-900/10"
                      style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "oklch(from var(--primary) l c h / 0.02)" : "transparent" }}
                      onClick={() => onSelectSat(s)}>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{s.noradId}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground max-w-[180px] truncate">{s.name}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: catColor + "15", color: catColor, border: `1px solid ${catColor}30` }}>
                          {categories.find(c => c.key === s.category)?.label ?? s.category}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground/70">{s.altKm.toFixed(0)}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground/70">{s.speedKms.toFixed(2)}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{s.inclination.toFixed(1)}°</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[9px]" style={{ color: ageColor }}>
                          {s.tleAge < 1 ? `${Math.round(s.tleAge * 24)}h` : `${s.tleAge.toFixed(1)}d`}
                          {s.tleAge >= 7 && " ⚠"}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: statusColor + "15", color: statusColor, border: `1px solid ${statusColor}30` }}>
                          {statusLabel}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* CONJUNCTIONS panel */}
      {activePanel === "conjunctions" && (
        <div className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--muted-foreground) transparent" }}>
          <div className="mb-4 p-3 rounded border" style={{ background: "rgba(239,68,68,0.05)", borderColor: "rgba(239,68,68,0.2)" }}>
            <div className="font-mono text-[10px] text-red-400/70">CONJUNCTION ANALYSIS — Simplified proximity check on first 60 LEO objects. Real conjunction screening requires full covariance propagation (CARA/JSpOC).</div>
          </div>
          {conjunctions.length === 0 ? (
            <div className="text-center py-12 font-mono text-[11px] text-muted-foreground">No close approaches detected in current catalog</div>
          ) : (
            <table className="w-full text-left">
              <thead style={{ borderBottom: "1px solid var(--border)" }}>
                <tr>
                  {["OBJECT A", "OBJECT B", "DISTANCE (km)", "ALT A (km)", "ALT B (km)", "RISK"].map(h => (
                    <th key={h} className="px-4 py-2 font-mono text-[9px] tracking-widest text-cyan-500/50 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {conjunctions.map((c, i) => {
                  const risk = c.dist < 50 ? "CRITICAL" : c.dist < 150 ? "HIGH" : c.dist < 300 ? "MEDIUM" : "LOW";
                  const riskColor = c.dist < 50 ? "#ef4444" : c.dist < 150 ? "#f59e0b" : c.dist < 300 ? "#eab308" : "#22c55e";
                  return (
                    <tr key={i} className="border-b" style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "oklch(from var(--primary) l c h / 0.02)" : "transparent" }}>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground truncate max-w-[160px]">{c.satA}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground truncate max-w-[160px]">{c.satB}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-cyan-300">{c.dist.toLocaleString()}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{c.altA}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{c.altB}</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: riskColor + "15", color: riskColor, border: `1px solid ${riskColor}30` }}>{risk}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* DECAY WATCH panel */}
      {activePanel === "decay" && (
        <div className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--muted-foreground) transparent" }}>
          <div className="mb-4 p-3 rounded border" style={{ background: "var(--muted)", borderColor: "rgba(245,158,11,0.2)" }}>
            <div className="font-mono text-[10px] text-amber-400/70">ORBITAL DECAY PREDICTIONS — Simplified atmospheric drag model. Actual reentry depends on solar activity, satellite mass/area, and attitude. For reference only.</div>
          </div>
          {decayPredictions.length === 0 ? (
            <div className="text-center py-12 font-mono text-[11px] text-muted-foreground">No satellites below 400km in current catalog</div>
          ) : (
            <table className="w-full text-left">
              <thead style={{ borderBottom: "1px solid var(--border)" }}>
                <tr>
                  {["NORAD", "NAME", "ALT (km)", "SPEED (km/s)", "EST. REENTRY", "URGENCY"].map(h => (
                    <th key={h} className="px-4 py-2 font-mono text-[9px] tracking-widest text-cyan-500/50 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {decayPredictions.map((s, i) => {
                  const urgency = s.daysToReentry < 30 ? "IMMINENT" : s.daysToReentry < 90 ? "NEAR-TERM" : s.daysToReentry < 365 ? "MEDIUM" : "LONG-TERM";
                  const urgencyColor = s.daysToReentry < 30 ? "#ef4444" : s.daysToReentry < 90 ? "#f59e0b" : s.daysToReentry < 365 ? "#eab308" : "#22c55e";
                  const reentryDate = new Date(Date.now() + s.daysToReentry * 86400000).toLocaleDateString();
                  return (
                    <tr key={s.noradId} className="border-b cursor-pointer hover:bg-cyan-900/10"
                      style={{ borderColor: "var(--border)", background: i % 2 === 0 ? "oklch(from var(--primary) l c h / 0.02)" : "transparent" }}
                      onClick={() => onSelectSat(s)}>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{s.noradId}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground max-w-[180px] truncate">{s.name}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-amber-400">{s.altKm.toFixed(0)}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-muted-foreground">{s.speedKms.toFixed(2)}</td>
                      <td className="px-4 py-2 font-mono text-[10px] text-foreground/70">{reentryDate} (~{s.daysToReentry}d)</td>
                      <td className="px-4 py-2">
                        <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                          style={{ background: urgencyColor + "15", color: urgencyColor, border: `1px solid ${urgencyColor}30` }}>{urgency}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* LIVE STREAM panel */}
      {activePanel === "stream" && (
        <div className="flex-1 overflow-auto p-6" style={{ scrollbarWidth: "thin", scrollbarColor: "var(--muted-foreground) transparent" }}>
          <div className="mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="font-mono text-[10px] text-green-400 tracking-widest">LIVE — ORBIT INTELLIGENCE STREAM</span>
          </div>
          <div className="space-y-1">
            {liveLog.map((line, i) => {
              const isUpdate = line.includes('[TLE UPDATE]');
              const isConjunction = line.includes('[CONJUNCTION]');
              const isDecay = line.includes('[DECAY]');
              const isSigint = line.includes('[SIGINT]');
              const isManeuver = line.includes('[MANEUVER]');
              const color = isUpdate ? '#22d3ee' : isConjunction ? '#f59e0b' : isDecay ? '#ef4444' : isSigint ? '#a78bfa' : isManeuver ? '#fb923c' : '#6b7280';
              return (
                <div key={i} className="font-mono text-[10px] py-0.5 px-3 rounded" style={{ color, background: i === 0 ? 'rgba(34,211,238,0.05)' : 'transparent', borderLeft: i === 0 ? '2px solid rgba(34,211,238,0.3)' : '2px solid transparent' }}>
                  {line}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Compare Panel ────────────────────────────────────────────────────────────
function ComparePanel({
  satA, satB, categories, onClose,
}: {
  satA: SatPosition;
  satB: SatPosition;
  categories: { key: string; label: string; color: string }[];
  onClose: () => void;
}) {
  const colorA = categories.find(c => c.key === satA.category)?.color ?? "#60a5fa";
  const colorB = categories.find(c => c.key === satB.category)?.color ?? "#f59e0b";
  const halfA = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + satA.altKm));
  const halfB = Math.acos(EARTH_RADIUS_KM / (EARTH_RADIUS_KM + satB.altKm));
  const dlat = satA.lat - satB.lat, dlon = satA.lon - satB.lon;
  const dist3d = Math.round(Math.sqrt(
    Math.pow((satA.altKm - satB.altKm), 2) +
    Math.pow(dlat * 111.32, 2) +
    Math.pow(dlon * 111.32 * Math.cos(satA.lat * Math.PI / 180), 2)
  ));

  const rows: [string, string, string][] = [
    ["Altitude",    `${satA.altKm.toFixed(0)} km`,   `${satB.altKm.toFixed(0)} km`],
    ["Speed",       `${satA.speedKms.toFixed(2)} km/s`, `${satB.speedKms.toFixed(2)} km/s`],
    ["Inclination", `${satA.inclination.toFixed(1)}°`, `${satB.inclination.toFixed(1)}°`],
    ["Footprint",   `${Math.round(halfA * EARTH_RADIUS_KM).toLocaleString()} km`, `${Math.round(halfB * EARTH_RADIUS_KM).toLocaleString()} km`],
    ["Orbit Type",  satA.altKm < 2000 ? "LEO" : satA.altKm < 35000 ? "MEO" : "GEO", satB.altKm < 2000 ? "LEO" : satB.altKm < 35000 ? "MEO" : "GEO"],
    ["Country",     satA.country ?? "—", satB.country ?? "—"],
    ["Operator",    satA.operator ?? "—", satB.operator ?? "—"],
    ["Launch Date", satA.launchDate ?? "—", satB.launchDate ?? "—"],
    ["3D Distance", `${dist3d.toLocaleString()} km`, "↔"],
  ];

  return (
    <div className="absolute top-14 left-1/2 -translate-x-1/2 z-[3000] w-[560px] bg-background/98 border border-border rounded-lg shadow-2xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border/70 flex items-center justify-between" style={{ background: "oklch(from var(--primary) l c h / 0.05)" }}>
        <span className="font-mono text-xs tracking-widest text-cyan-400">SATELLITE COMPARISON</span>
        <button onClick={onClose} className="text-muted-foreground/60 hover:text-foreground font-mono">✕</button>
      </div>
      <div className="p-4">
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div />
          <div className="text-center">
            <div className="font-mono text-xs font-bold truncate" style={{ color: colorA }}>{satA.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground/60">#{satA.noradId}</div>
          </div>
          <div className="text-center">
            <div className="font-mono text-xs font-bold truncate" style={{ color: colorB }}>{satB.name}</div>
            <div className="font-mono text-[10px] text-muted-foreground/60">#{satB.noradId}</div>
          </div>
        </div>
        <div className="space-y-1">
          {rows.map(([label, a, b]) => (
            <div key={label} className="grid grid-cols-3 gap-2 py-1.5 border-b border-border/40">
              <span className="font-mono text-[10px] text-muted-foreground/80">{label}</span>
              <span className="font-mono text-[10px] text-center" style={{ color: colorA }}>{a}</span>
              <span className="font-mono text-[10px] text-center" style={{ color: b === "↔" ? "#fff" : colorB }}>{b}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Main Orbit Component ─────────────────────────────────────────────────────
export default function Orbit() {
  const { theme, toggleTheme } = useTheme();
  const isLight = theme === 'light';

  // ─── Header prefs (DB-backed via tRPC, localStorage as fallback) ────────────
  const { data: dbOrbitPrefs, isLoading: orbitPrefsLoading } = trpc.headerPrefs.getPrefs.useQuery(
    { page: "orbit" as const },
    { refetchOnWindowFocus: true, staleTime: 5000 }
  );
  const orbitPrefs: HeaderItem[] = useMemo(() => {
    if (dbOrbitPrefs && Array.isArray(dbOrbitPrefs) && dbOrbitPrefs.length > 0) {
      return dbOrbitPrefs as HeaderItem[];
    }
    if (orbitPrefsLoading) return [];
    return loadPrefs("orbit");
  }, [dbOrbitPrefs, orbitPrefsLoading]);
  const orbitVisible = useCallback(
    (id: string) => orbitPrefs.find(p => p.id === id)?.visible ?? true,
    [orbitPrefs]
  );
  const orbitCustomToggles = useMemo(
    () => orbitPrefs.filter((p): p is HeaderItem & { isCustom: true } => !!(p as any).isCustom && p.visible),
    [orbitPrefs]
  );
  const canvasRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const satMeshesRef = useRef<Map<number, THREE.Mesh>>(new Map());
  const trackLineRef = useRef<THREE.Line | null>(null);
  const coverageRef = useRef<THREE.Line | null>(null);
  const aoiMarkerRef = useRef<THREE.Mesh | null>(null);
  const launchMeshesRef = useRef<THREE.Mesh[]>([]);
  const groundMeshesRef = useRef<THREE.Mesh[]>([]);
  const animFrameRef = useRef<number>(0);
  const clockRef = useRef(new THREE.Clock());
  const arcLinesRef = useRef<THREE.Line[]>([]);

  // ── State ──────────────────────────────────────────────────────────────────
  const [sceneReady, setSceneReady] = useState(false);
  const [activeTab, setActiveTab] = useState<"globe" | "surveillance" | "intel" | "missions" | "passes" | "compare">("globe");
  const [selectedSat, setSelectedSat] = useState<SatPosition | null>(null);
  const [hoveredSat, setHoveredSat] = useState<SatPosition | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activePanel, setActivePanel] = useState<"intel" | "aoi" | "facility" | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<typeof LAUNCH_FACILITIES[0] | typeof GROUND_STATIONS[0] | null>(null);
  const [isTracking, setIsTracking] = useState(false);
  const [showPassPredictor, setShowPassPredictor] = useState(false);
  const [passPredictorLat, setPassPredictorLat] = useState<number | undefined>();
  const [passPredictorLon, setPassPredictorLon] = useState<number | undefined>();
  const [aoiMode, setAoiMode] = useState(false);
  const [aoiPoint, setAoiPoint] = useState<{ lat: number; lon: number } | null>(null);
  const [aoiResults, setAoiResults] = useState<AoiResult[]>([]);
  const [aoiPolygonMode, setAoiPolygonMode] = useState(false);
  const [aoiPolygonPoints, setAoiPolygonPoints] = useState<{ lat: number; lon: number }[]>([]);
  const [aoiPolygonClosed, setAoiPolygonClosed] = useState(false);
  const aoiPolygonLinesRef = useRef<THREE.Line[]>([]);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSatA, setCompareSatA] = useState<SatPosition | null>(null);
  const [compareSatB, setCompareSatB] = useState<SatPosition | null>(null);
  const [showComparePanel, setShowComparePanel] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [countrySearch, setCountrySearch] = useState("");
  const [showCountrySearch, setShowCountrySearch] = useState(false);
  const [isLive, setIsLive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);
  const [showRings, setShowRings] = useState(true);
  const [showCoverage, setShowCoverage] = useState(true);
  const [showTrack, setShowTrack] = useState(true);
  const [minElevDeg, setMinElevDeg] = useState(0);
  const [nightMode, setNightMode] = useState(false);
  const [enabledGroups, setEnabledGroups] = useState<Set<string>>(new Set(GROUPS.map(g => g.key)));
  // Layer toggles
  const [showLaunchSites, setShowLaunchSites] = useState(false);
  const [showGroundStations, setShowGroundStations] = useState(false);
  const [showStarlinkGateways, setShowStarlinkGateways] = useState(false);
  const [hoveredFacility, setHoveredFacility] = useState<typeof LAUNCH_FACILITIES[0] | typeof GROUND_STATIONS[0] | null>(null);
  // Environmental layer toggles
  const [showWindLayer, setShowWindLayer] = useState(false);
  const [showHeatLayer, setShowHeatLayer] = useState(false);
  const [showFireLayer, setShowFireLayer] = useState(false);
  const [showOceanLayer, setShowOceanLayer] = useState(false);
  // Left panel UI state
  const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
  const [leftSections, setLeftSections] = useState({ satellites: true, infrastructure: false, environment: false, missions: false });
  // Cursor coordinates on globe
  const [cursorCoords, setCursorCoords] = useState<{ lat: number; lon: number } | null>(null);
  // Wind particles ref
  const windParticlesRef = useRef<THREE.Points | null>(null);
  // Fire dots ref
  const fireDotsRef = useRef<THREE.Points | null>(null);
  // Mission AOI zones ref
  const missionAoiRef = useRef<THREE.Group | null>(null);

  // ── Real environmental data queries ────────────────────────────────────────
  const fireQuery = trpc.orbit.getFireHotspots.useQuery(undefined, {
    enabled: showFireLayer,
    staleTime: 5 * 60 * 1000,
    refetchInterval: showFireLayer ? 10 * 60 * 1000 : false,
  });
  const windQuery = trpc.orbit.getWindData.useQuery(undefined, {
    enabled: showWindLayer,
    staleTime: 10 * 60 * 1000,
    refetchInterval: showWindLayer ? 15 * 60 * 1000 : false,
  });

  // ── TLE data ───────────────────────────────────────────────────────────────
  const [groupsInput] = useState(() => GROUPS.map(g => g.key));
  // SSE live stream for satellite positions (replaces 30s polling)
  const orbitSSE = useLiveStream<any>("orbit:positions", {
    enabled: isLive,
    fallbackFetch: async () => {
      const result = await trpc.useUtils().orbit.getAllPositions.fetch({ groups: groupsInput });
      return result;
    },
    fallbackInterval: 30000,
  });
  // Fallback to tRPC query when SSE is not connected
  const posQueryFallback = trpc.orbit.getAllPositions.useQuery(
    { groups: groupsInput },
    { refetchInterval: isLive && !orbitSSE.connected ? 30000 : false, staleTime: 10000 }
  );
  const posQuery = { data: orbitSSE.data || posQueryFallback.data };
  const allSats: SatPosition[] = useMemo(() => {
    if (!posQuery.data) return [];
    return ((posQuery.data as any).satellites ?? []) as SatPosition[];
  }, [posQuery.data]);

  const categories = GROUPS;
  const totalSats = allSats.length;

  // ── Filtered / search ──────────────────────────────────────────────────────
  const visibleSats = useMemo(() =>
    allSats.filter(s => enabledGroups.has(s.category)),
    [allSats, enabledGroups]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allSats.filter(s =>
      s.name.toLowerCase().includes(q) || String(s.noradId).includes(q)
    ).slice(0, 8);
  }, [allSats, searchQuery]);

  const countryResults = useMemo(() => {
    if (!countrySearch.trim()) return [];
    const q = countrySearch.toLowerCase();
    return COUNTRY_COORDS.filter(c => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [countrySearch]);

  // ── Three.js init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!canvasRef.current) return;
    const w = canvasRef.current.clientWidth || window.innerWidth;
    const h = canvasRef.current.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(isLight ? 0xe8eef4 : 0x000005);
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    // Stars
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

    // Earth
    const loader = new THREE.TextureLoader();
    const earthGeo = new THREE.SphereGeometry(GLOBE_R, 64, 64);
    const earthMat = new THREE.MeshPhongMaterial({
      map: loader.load(EARTH_DAY_URL),
      specular: new THREE.Color(0x111111),
      shininess: 8,
    });
    const earth = new THREE.Mesh(earthGeo, earthMat);
    earth.name = "earth";
    scene.add(earth);

    // Atmosphere glow
    const atmGeo = new THREE.SphereGeometry(GLOBE_R * 1.015, 32, 32);
    const atmMat = new THREE.MeshPhongMaterial({
      color: isLight ? 0x4488cc : 0x0044aa, transparent: true, opacity: isLight ? 0.15 : 0.08, side: THREE.FrontSide,
    });
    scene.add(new THREE.Mesh(atmGeo, atmMat));

    // Orbit rings
    ORBIT_RINGS.forEach(ring => {
      const r = GLOBE_R * (1 + ring.altKm / EARTH_RADIUS_KM);
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 256; i++) {
        const a = (i / 256) * Math.PI * 2;
        pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(ring.color), transparent: true, opacity: ring.opacity });
      scene.add(new THREE.Line(geo, mat));
    });

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

    // Render loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Resize
    const onResize = () => {
      if (!canvasRef.current) return;
      const w2 = canvasRef.current.clientWidth, h2 = canvasRef.current.clientHeight;
      renderer.setSize(w2, h2);
      camera.aspect = w2 / h2;
      camera.updateProjectionMatrix();
    };
    window.addEventListener("resize", onResize);

    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animFrameRef.current);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      canvasRef.current?.removeChild(renderer.domElement);
    };
  }, []);

  // ── Theme-reactive scene colors ──────────────────────────────────────────
  useEffect(() => {
    if (!rendererRef.current || !sceneRef.current) return;
    rendererRef.current.setClearColor(isLight ? 0xe8eef4 : 0x000005);
  }, [isLight]);

  // ── Night mode texture swap ────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    const earth = sceneRef.current.getObjectByName("earth") as THREE.Mesh | undefined;
    if (!earth) return;
    const loader = new THREE.TextureLoader();
    (earth.material as THREE.MeshPhongMaterial).map = loader.load(nightMode ? EARTH_NIGHT_URL : EARTH_DAY_URL);
    (earth.material as THREE.MeshPhongMaterial).needsUpdate = true;
  }, [nightMode]);

  // ── Satellite mesh updates ─────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove old meshes
    satMeshesRef.current.forEach(m => scene.remove(m));
    satMeshesRef.current.clear();

    // Add new meshes
    visibleSats.forEach(sat => {
      const catColor = categories.find(c => c.key === sat.category)?.color ?? "#ffffff";
      const geo = new THREE.SphereGeometry(0.004, 4, 4);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(catColor) });
      const mesh = new THREE.Mesh(geo, mat);
      const pos = latLonAltToVec3(sat.lat, sat.lon, sat.altKm);
      mesh.position.copy(pos);
      mesh.userData = { sat };
      scene.add(mesh);
      satMeshesRef.current.set(sat.noradId, mesh);
    });
  }, [visibleSats, categories]);

  // ── Launch facility meshes ─────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    launchMeshesRef.current.forEach(m => scene.remove(m));
    launchMeshesRef.current = [];
    if (!showLaunchSites) return;
    LAUNCH_FACILITIES.forEach(fac => {
      const geo = new THREE.SphereGeometry(0.008, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color("#ff6b35") });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(latLonAltToVec3(fac.lat, fac.lon, 0));
      mesh.userData = { facility: fac, type: "launch" };
      scene.add(mesh);
      launchMeshesRef.current.push(mesh);
    });
  }, [showLaunchSites]);

  // ── Ground station meshes ──────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    groundMeshesRef.current.forEach(m => scene.remove(m));
    groundMeshesRef.current = [];
    if (!showGroundStations && !showStarlinkGateways) return;
    const stations = GROUND_STATIONS.filter(s =>
      (showGroundStations && s.type !== "STARLINK") ||
      (showStarlinkGateways && s.type === "STARLINK")
    );
    stations.forEach(gs => {
      const color = gs.type === "SIGINT" ? "#ef4444" : gs.type === "STARLINK" ? "#60a5fa" : gs.type === "DEEP_SPACE" ? "#a78bfa" : "#22d3ee";
      const geo = new THREE.SphereGeometry(0.007, 6, 6);
      const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(latLonAltToVec3(gs.lat, gs.lon, 0));
      mesh.userData = { facility: gs, type: "ground" };
      scene.add(mesh);
      groundMeshesRef.current.push(mesh);
    });
  }, [showGroundStations, showStarlinkGateways]);

  // ── Ground track ───────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (trackLineRef.current) { scene.remove(trackLineRef.current); trackLineRef.current = null; }
    if (!showTrack || !selectedSat) return;
    const pts: THREE.Vector3[] = [];
    const now = Date.now();
    for (let i = -30; i <= 30; i++) {
      const t = new Date(now + i * 60000);
      const pos = propagateTLE(selectedSat.tle1, selectedSat.tle2, t);
      if (pos) pts.push(latLonAltToVec3(pos.lat, pos.lon, 2));
    }
    if (pts.length < 2) return;
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 });
    trackLineRef.current = new THREE.Line(geo, mat);
    scene.add(trackLineRef.current);
  }, [selectedSat, showTrack]);

  // ── Coverage zone ──────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (coverageRef.current) { scene.remove(coverageRef.current); coverageRef.current = null; }
    if (!showCoverage || !selectedSat) return;
    const pts = buildCoverageZone(selectedSat.lat, selectedSat.lon, selectedSat.altKm, 180, minElevDeg);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const catColor = categories.find(c => c.key === selectedSat.category)?.color ?? "#00ffff";
    const mat = new THREE.LineBasicMaterial({ color: new THREE.Color(catColor), transparent: true, opacity: 0.5 });
    coverageRef.current = new THREE.Line(geo, mat);
    scene.add(coverageRef.current);
  }, [selectedSat, showCoverage, minElevDeg, categories]);

  // ── AOI marker ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (aoiMarkerRef.current) { scene.remove(aoiMarkerRef.current); aoiMarkerRef.current = null; }
    if (!aoiPoint) return;
    const geo = new THREE.SphereGeometry(0.012, 8, 8);
    const mat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(latLonAltToVec3(aoiPoint.lat, aoiPoint.lon, 0));
    aoiMarkerRef.current = mesh;
    scene.add(mesh);
  }, [aoiPoint]);

  // ── AOI Polygon rendering on globe ────────────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    aoiPolygonLinesRef.current.forEach(l => scene.remove(l));
    aoiPolygonLinesRef.current = [];
    if (aoiPolygonPoints.length < 2) return;
    const r = GLOBE_R * 1.005;
    const toVec = (lat: number, lon: number) => {
      const phi = (90 - lat) * Math.PI / 180;
      const theta = (lon + 180) * Math.PI / 180;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
    };
    const pointsToRender = aoiPolygonClosed ? [...aoiPolygonPoints, aoiPolygonPoints[0]] : aoiPolygonPoints;
    for (let i = 0; i < pointsToRender.length - 1; i++) {
      const p1 = pointsToRender[i];
      const p2 = pointsToRender[i + 1];
      const pts: THREE.Vector3[] = [];
      for (let s = 0; s <= 20; s++) {
        const t = s / 20;
        const lat = p1.lat + (p2.lat - p1.lat) * t;
        const lon = p1.lon + (p2.lon - p1.lon) * t;
        pts.push(toVec(lat, lon));
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true, opacity: 0.8, depthTest: false });
      const line = new THREE.Line(geo, mat);
      scene.add(line);
      aoiPolygonLinesRef.current.push(line);
    }
    aoiPolygonPoints.forEach(p => {
      const dotGeo = new THREE.SphereGeometry(0.008, 6, 6);
      const dotMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, depthTest: false });
      const dot = new THREE.Mesh(dotGeo, dotMat);
      dot.position.copy(toVec(p.lat, p.lon));
      scene.add(dot);
      aoiPolygonLinesRef.current.push(dot as any);
    });
  }, [aoiPolygonPoints, aoiPolygonClosed]);

  // ── Polygon AOI satellite filtering ────────────────────────────────────────
  const polygonAoiResults = useMemo(() => {
    if (!aoiPolygonClosed || aoiPolygonPoints.length < 3) return [];
    // Point-in-polygon test for satellite ground positions
    const polyPts = aoiPolygonPoints;
    const inPoly = (lat: number, lon: number) => {
      let inside = false;
      for (let i = 0, j = polyPts.length - 1; i < polyPts.length; j = i++) {
        const yi = polyPts[i].lat, xi = polyPts[i].lon;
        const yj = polyPts[j].lat, xj = polyPts[j].lon;
        if (((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)) {
          inside = !inside;
        }
      }
      return inside;
    };
    // Find satellites currently in the polygon OR whose ground track passes through it
    return allSats.filter(s => {
      // Check current position
      if (inPoly(s.lat, s.lon)) return true;
      // Check if coverage footprint overlaps the polygon center
      const centerLat = polyPts.reduce((a, p) => a + p.lat, 0) / polyPts.length;
      const centerLon = polyPts.reduce((a, p) => a + p.lon, 0) / polyPts.length;
      const dist = Math.sqrt(Math.pow(s.lat - centerLat, 2) + Math.pow(s.lon - centerLon, 2));
      const coverageRadius = Math.atan(Math.sqrt(2 * 6371 * (s.altKm || 400) + (s.altKm || 400) ** 2) / 6371) * (180 / Math.PI);
      return dist < coverageRadius;
    });
  }, [aoiPolygonClosed, aoiPolygonPoints, allSats]);

  // ── Connection arcs (satellite → launch sites + ground stations) ────────────────────────────────
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    // Remove old arcs
    arcLinesRef.current.forEach(l => scene.remove(l));
    arcLinesRef.current = [];
    if (!selectedSat) return;

    const connections = getSatConnections(selectedSat.name);
    const satPos = latLonAltToVec3(selectedSat.lat, selectedSat.lon, selectedSat.altKm);

    function buildArc(fromVec: THREE.Vector3, toVec: THREE.Vector3, color: number, opacity: number) {
      const pts: THREE.Vector3[] = [];
      const segments = 40;
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        // Spherical interpolation with arc height
        const mid = new THREE.Vector3().lerpVectors(fromVec, toVec, t);
        const arcHeight = 1 + 0.3 * Math.sin(Math.PI * t);
        mid.normalize().multiplyScalar(mid.length() * arcHeight);
        pts.push(mid);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: 1 });
      return new THREE.Line(geo, mat);
    }

    // Draw arcs to launch sites
    connections.launchSites.forEach(siteName => {
      const site = LAUNCH_FACILITIES.find(f => f.name.includes(siteName.split(",")[0]) || siteName.includes(f.name.split(" ").slice(0, 2).join(" ")));
      if (!site) return;
      const sitePos = latLonAltToVec3(site.lat, site.lon, 0);
      const arc = buildArc(satPos, sitePos, 0xf59e0b, 0.6);
      scene.add(arc);
      arcLinesRef.current.push(arc);
    });

    // Draw arcs to ground stations
    connections.groundStations.forEach(gsName => {
      const gs = GROUND_STATIONS.find(g => g.name.includes(gsName.split(",")[0]) || gsName.includes(g.name.split(" ").slice(0, 2).join(" ")));
      if (!gs) return;
      const gsPos = latLonAltToVec3(gs.lat, gs.lon, 0);
      const arc = buildArc(satPos, gsPos, 0x22d3ee, 0.5);
      scene.add(arc);
      arcLinesRef.current.push(arc);
    });
  }, [selectedSat]);

  // ── Tracking camera ───────────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isTracking || !selectedSat) return;
    const interval = setInterval(() => {
      const pos = propagateTLE(selectedSat.tle1, selectedSat.tle2, new Date());
      if (!pos || !cameraRef.current || !controlsRef.current) return;
      const satVec = latLonAltToVec3(pos.lat, pos.lon, pos.altKm);
      // Move camera to follow satellite direction but keep target at Earth center
      const dir = satVec.clone().normalize();
      const currentDist = cameraRef.current.position.length();
      const newPos = dir.multiplyScalar(currentDist);
      cameraRef.current.position.lerp(newPos, 0.05);
      controlsRef.current.target.set(0, 0, 0);
    }, 500);
    return () => clearInterval(interval);
  }, [isTracking, selectedSat]);

  // ── Raycasting: hover + click ──────────────────────────────────────────────
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);
    raycaster.params.Points = { threshold: 0.02 };

    // Check satellites
    const satMeshes = Array.from(satMeshesRef.current.values());
    const hits = raycaster.intersectObjects(satMeshes);
    if (hits.length > 0) {
      const sat = hits[0].object.userData.sat as SatPosition;
      setHoveredSat(sat);
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      canvasRef.current.style.cursor = "pointer";
      // Enlarge hovered satellite node
      satMeshesRef.current.forEach((mesh, noradId) => {
        if (noradId === sat.noradId) {
          mesh.scale.setScalar(3.5);
          (mesh.material as THREE.MeshBasicMaterial).color.set('#ffffff');
        } else {
          mesh.scale.setScalar(1.0);
          const catColor = categories.find(c => c.key === (mesh.userData.sat as SatPosition).category)?.color ?? '#ffffff';
          (mesh.material as THREE.MeshBasicMaterial).color.set(catColor);
        }
      });
      return;
    }
    // Reset all satellite scales when not hovering
    satMeshesRef.current.forEach((mesh) => {
      mesh.scale.setScalar(1.0);
      const catColor = categories.find(c => c.key === (mesh.userData.sat as SatPosition).category)?.color ?? '#ffffff';
      (mesh.material as THREE.MeshBasicMaterial).color.set(catColor);
    });

    // Check facility meshes
    const facilityMeshes = [...launchMeshesRef.current, ...groundMeshesRef.current];
    const fhits = raycaster.intersectObjects(facilityMeshes);
    if (fhits.length > 0) {
      setHoveredFacility(fhits[0].object.userData.facility);
      setTooltipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
      canvasRef.current.style.cursor = "pointer";
      setHoveredSat(null);
      return;
    }

    setHoveredSat(null);
    setHoveredFacility(null);
    canvasRef.current.style.cursor = (aoiMode || aoiPolygonMode) ? "crosshair" : "default";
    // Track cursor coordinates on globe surface
    const earthObjs = sceneRef.current.children.filter(c => c.name === "earth");
    const earthHits2 = raycaster.intersectObjects(earthObjs);
    if (earthHits2.length > 0) {
      const p = earthHits2[0].point;
      const lat = Math.asin(p.y / GLOBE_R) * (180 / Math.PI);
      const lon = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180;
      const normLon = ((lon % 360) + 540) % 360 - 180;
      setCursorCoords({ lat: Math.round(lat * 100) / 100, lon: Math.round(normLon * 100) / 100 });
    } else {
      setCursorCoords(null);
    }
  }, [aoiMode, aoiPolygonMode]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current || !cameraRef.current || !sceneRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, cameraRef.current);

    // Satellite click
    const satMeshes = Array.from(satMeshesRef.current.values());
    const hits = raycaster.intersectObjects(satMeshes);
    if (hits.length > 0) {
      const sat = hits[0].object.userData.sat as SatPosition;
      if (compareMode) {
        if (!compareSatA) { setCompareSatA(sat); return; }
        if (!compareSatB && sat.noradId !== compareSatA.noradId) {
          setCompareSatB(sat); setShowComparePanel(true); return;
        }
      }
      setSelectedSat(sat);
      setActivePanel("intel");
      setShowPassPredictor(false);
      return;
    }

    // Facility click — show linked satellites panel
    const facilityMeshesClick = [...launchMeshesRef.current, ...groundMeshesRef.current];
    const fhitsClick = raycaster.intersectObjects(facilityMeshesClick);
    if (fhitsClick.length > 0) {
      const fac = fhitsClick[0].object.userData.facility;
      setSelectedFacility(fac);
      setActivePanel('facility');
      return;
    }

    // AOI Polygon click on Earth
    if (aoiPolygonMode && !aoiPolygonClosed) {
      const earthHits = raycaster.intersectObjects(sceneRef.current.children.filter(c => c.name === "earth"));
      if (earthHits.length > 0) {
        const p = earthHits[0].point;
        const lat = Math.asin(p.y / GLOBE_R) * (180 / Math.PI);
        const lon = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180;
        const normLon = ((lon % 360) + 540) % 360 - 180;
        setAoiPolygonPoints(prev => [...prev, { lat, lon: normLon }]);
      }
      return;
    }

    // AOI click on Earth (single point)
    if (aoiMode) {
      const earthHits = raycaster.intersectObjects(sceneRef.current.children.filter(c => c.name === "earth"));
      if (earthHits.length > 0) {
        const p = earthHits[0].point;
        const lat = Math.asin(p.y / GLOBE_R) * (180 / Math.PI);
        const lon = Math.atan2(p.z, -p.x) * (180 / Math.PI) - 180;
        const normLon = ((lon % 360) + 540) % 360 - 180;
        const results = allSats.map(s => computeAoiVisibility(lat, normLon, s));
        setAoiPoint({ lat, lon: normLon });
        setAoiResults(results);
        setActivePanel("aoi");
      }
    }
  }, [aoiMode, aoiPolygonMode, aoiPolygonClosed, compareMode, compareSatA, compareSatB, allSats]);

  // -- Wind particle layer (REAL Open-Meteo data)
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    if (windParticlesRef.current) { scene.remove(windParticlesRef.current); windParticlesRef.current = null; }
    if (!showWindLayer) return;
    const windPoints = (windQuery.data as any)?.windPoints ?? [];
    if (windPoints.length === 0) {
      // Placeholder while loading
      const N = 300;
      const positions = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        const lat = (Math.random() * 160 - 80) * (Math.PI / 180);
        const lon = (Math.random() * 360 - 180) * (Math.PI / 180);
        const r = GLOBE_R * 1.015;
        const phi = Math.PI / 2 - lat;
        const theta = lon + Math.PI;
        positions[i * 3]     = -r * Math.sin(phi) * Math.cos(theta);
        positions[i * 3 + 1] =  r * Math.cos(phi);
        positions[i * 3 + 2] =  r * Math.sin(phi) * Math.sin(theta);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const mat = new THREE.PointsMaterial({ size: 0.008, color: 0x67e8f9, transparent: true, opacity: 0.4, depthTest: false });
      const pts = new THREE.Points(geo, mat);
      pts.name = 'windLayer';
      scene.add(pts);
      windParticlesRef.current = pts;
      return () => { scene.remove(pts); windParticlesRef.current = null; };
    }
    // Real wind data: each point has lat, lon, speed (m/s), direction (degrees)
    const allPositions: number[] = [];
    const allColors: number[] = [];
    windPoints.forEach((wp: { lat: number; lon: number; speed: number; direction: number }) => {
      const maxSpeed = 25;
      const speedNorm = Math.min(wp.speed / maxSpeed, 1);
      const streamLen = 6;
      const dirRad = wp.direction * Math.PI / 180;
      for (let j = 0; j < streamLen; j++) {
        const t = j / streamLen;
        const dlat = wp.lat + Math.cos(dirRad) * t * 2.5;
        const dlon = wp.lon + Math.sin(dirRad) * t * 2.5;
        const latR = dlat * Math.PI / 180;
        const lonR = dlon * Math.PI / 180;
        const r = GLOBE_R * 1.015;
        const phi = Math.PI / 2 - latR;
        const theta = lonR + Math.PI;
        allPositions.push(
          -r * Math.sin(phi) * Math.cos(theta),
           r * Math.cos(phi),
           r * Math.sin(phi) * Math.sin(theta)
        );
        const fade = (1 - t) * 0.9;
        allColors.push(
          speedNorm * 0.6 * fade,
          (0.7 + speedNorm * 0.3) * fade,
          1.0 * fade,
        );
      }
    });
    const positions = new Float32Array(allPositions);
    const colors = new Float32Array(allColors);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.008, vertexColors: true, transparent: true, opacity: 0.85, depthTest: false });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'windLayer';
    scene.add(pts);
    windParticlesRef.current = pts;
    return () => { scene.remove(pts); windParticlesRef.current = null; };
  }, [showWindLayer, windQuery.data, sceneRef.current]);

  // -- Fire/thermal dots layer (REAL NASA FIRMS VIIRS data)
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    if (fireDotsRef.current) { scene.remove(fireDotsRef.current); fireDotsRef.current = null; }
    if (!showFireLayer) return;
    const hotspots = (fireQuery.data as any)?.hotspots ?? [];
    if (hotspots.length === 0) return;
    const positions = new Float32Array(hotspots.length * 3);
    const colors = new Float32Array(hotspots.length * 3);
    hotspots.forEach((h: { lat: number; lon: number; brightness: number; frp: number }, i: number) => {
      const lat = h.lat * Math.PI / 180;
      const lon = h.lon * Math.PI / 180;
      const r = GLOBE_R * 1.015;
      const phi = Math.PI / 2 - lat;
      const theta = lon + Math.PI;
      positions[i * 3]     = -r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] =  r * Math.cos(phi);
      positions[i * 3 + 2] =  r * Math.sin(phi) * Math.sin(theta);
      const brightNorm = Math.min((h.brightness - 300) / 100, 1);
      colors[i * 3]     = 1.0;
      colors[i * 3 + 1] = 0.4 - brightNorm * 0.4;
      colors[i * 3 + 2] = 0.0;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.012, vertexColors: true, transparent: true, opacity: 0.9, depthTest: false });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'fireLayer';
    scene.add(pts);
    fireDotsRef.current = pts;
    return () => { scene.remove(pts); fireDotsRef.current = null; };
  }, [showFireLayer, fireQuery.data, sceneRef.current]);

  // ── Ocean current layer ────────────────────────────────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const existing = scene.getObjectByName('oceanLayer');
    if (existing) scene.remove(existing);
    if (!showOceanLayer) return;
    // Major ocean current paths
    const currents = [
      // Gulf Stream
      [{ lat: 25, lon: -80 }, { lat: 35, lon: -75 }, { lat: 45, lon: -60 }, { lat: 55, lon: -30 }, { lat: 60, lon: -10 }],
      // North Atlantic Drift
      [{ lat: 55, lon: -20 }, { lat: 58, lon: -5 }, { lat: 60, lon: 5 }],
      // Kuroshio Current
      [{ lat: 25, lon: 125 }, { lat: 35, lon: 135 }, { lat: 45, lon: 150 }, { lat: 50, lon: 165 }],
      // California Current
      [{ lat: 50, lon: -130 }, { lat: 40, lon: -125 }, { lat: 30, lon: -120 }, { lat: 20, lon: -115 }],
      // South Equatorial Current
      [{ lat: -5, lon: -35 }, { lat: -5, lon: -20 }, { lat: -5, lon: 0 }, { lat: -5, lon: 20 }],
      // Humboldt Current
      [{ lat: -40, lon: -75 }, { lat: -30, lon: -72 }, { lat: -20, lon: -70 }, { lat: -10, lon: -78 }],
    ];
    const group = new THREE.Group();
    group.name = 'oceanLayer';
    currents.forEach(current => {
      const pts: THREE.Vector3[] = current.map(({ lat, lon }) => {
        const latR = lat * Math.PI / 180;
        const lonR = lon * Math.PI / 180;
        const r = GLOBE_R * 1.02;
        const phi = Math.PI / 2 - latR;
        const theta = lonR + Math.PI;
        return new THREE.Vector3(
          -r * Math.sin(phi) * Math.cos(theta),
           r * Math.cos(phi),
           r * Math.sin(phi) * Math.sin(theta)
        );
      });
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: 0x0088ff, transparent: true, opacity: 0.7, linewidth: 2, depthTest: false });
      group.add(new THREE.Line(geo, mat));
    });
    scene.add(group);
    return () => { scene.remove(group); };
  }, [showOceanLayer, sceneRef.current]);

  // ── Heat map layer (surface temperature gradient) ──────────────────────────
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    const existing = scene.getObjectByName('heatLayer');
    if (existing) scene.remove(existing);
    if (!showHeatLayer) return;
    // Approximate surface temperature zones based on latitude
    // Equatorial: hot (red/orange), mid-lat: warm (yellow), polar: cold (blue)
    const heatPoints: number[] = [];
    const heatColors: number[] = [];
    const STEP = 4; // degrees
    for (let lat = -80; lat <= 80; lat += STEP) {
      for (let lon = -180; lon <= 180; lon += STEP) {
        // Temperature model: hot at equator, cold at poles, with seasonal variation
        const latNorm = Math.abs(lat) / 90; // 0=equator, 1=pole
        const baseTemp = 30 * (1 - latNorm * latNorm) - 20 * latNorm; // -20°C to +30°C
        // Add land/ocean variation (simplified)
        const tempNorm = (baseTemp + 20) / 50; // 0-1 range
        // Color: cold=blue, cool=cyan, warm=yellow, hot=red
        let r, g, b;
        if (tempNorm < 0.25) { // Very cold: dark blue to blue
          r = 0; g = tempNorm * 4 * 0.5; b = 0.5 + tempNorm * 4 * 0.5;
        } else if (tempNorm < 0.5) { // Cool: blue to cyan
          const t = (tempNorm - 0.25) * 4;
          r = 0; g = 0.5 + t * 0.5; b = 1;
        } else if (tempNorm < 0.75) { // Warm: cyan to yellow
          const t = (tempNorm - 0.5) * 4;
          r = t; g = 1; b = 1 - t;
        } else { // Hot: yellow to red
          const t = (tempNorm - 0.75) * 4;
          r = 1; g = 1 - t * 0.8; b = 0;
        }
        const latR = lat * Math.PI / 180;
        const lonR = lon * Math.PI / 180;
        const rr = GLOBE_R * 1.012;
        const phi = Math.PI / 2 - latR;
        const theta = lonR + Math.PI;
        heatPoints.push(
          -rr * Math.sin(phi) * Math.cos(theta),
           rr * Math.cos(phi),
           rr * Math.sin(phi) * Math.sin(theta)
        );
        heatColors.push(r * 0.9, g * 0.9, b * 0.9);
      }
    }
    const positions = new Float32Array(heatPoints);
    const colors = new Float32Array(heatColors);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const mat = new THREE.PointsMaterial({ size: 0.022, vertexColors: true, transparent: true, opacity: 0.6, depthTest: false });
    const pts = new THREE.Points(geo, mat);
    pts.name = 'heatLayer';
    scene.add(pts);
    return () => { scene.remove(pts); };
  }, [showHeatLayer, sceneRef.current]);

  // ── Mission AOI zones on globe ─────────────────────────────────────────────
  const missionsQuery = trpc.surveillanceMissions.list.useQuery({}, { refetchInterval: 30000 });
  useEffect(() => {
    if (!sceneRef.current) return;
    const scene = sceneRef.current;
    if (missionAoiRef.current) { scene.remove(missionAoiRef.current); missionAoiRef.current = null; }
    const missions = (missionsQuery.data as any[]) ?? [];
    const activeMissions = missions.filter((m: any) => m.status === 'ACTIVE' && m.aoiLat != null && m.aoiLon != null);
    if (activeMissions.length === 0) return;
    const group = new THREE.Group();
    group.name = 'missionAoi';
    activeMissions.forEach((m: any) => {
      const lat = m.aoiLat * Math.PI / 180;
      const lon = m.aoiLon * Math.PI / 180;
      const r = GLOBE_R * 1.004;
      const phi = Math.PI / 2 - lat;
      const theta = lon + Math.PI;
      const center = new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
         r * Math.cos(phi),
         r * Math.sin(phi) * Math.sin(theta)
      );
      // Draw a circle around the AOI point
      const circleR = 0.06;
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 64; i++) {
        const a = (i / 64) * Math.PI * 2;
        // Tangent plane circle
        const up = center.clone().normalize();
        const east = new THREE.Vector3(-Math.sin(lon), 0, Math.cos(lon)).normalize();
        const north = up.clone().cross(east).normalize();
        const pt = center.clone()
          .addScaledVector(east, Math.cos(a) * circleR)
          .addScaledVector(north, Math.sin(a) * circleR);
        pts.push(pt);
      }
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const color = m.classification === 'TOP_SECRET' ? 0xff0000 : m.classification === 'SECRET' ? 0xff6600 : 0x00ff88;
      const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8 });
      group.add(new THREE.Line(geo, mat));
      // Center dot
      const dotGeo = new THREE.BufferGeometry();
      dotGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([center.x, center.y, center.z]), 3));
      const dotMat = new THREE.PointsMaterial({ size: 0.015, color, transparent: true, opacity: 0.9 });
      group.add(new THREE.Points(dotGeo, dotMat));
    });
    scene.add(group);
    missionAoiRef.current = group;
    return () => { scene.remove(group); missionAoiRef.current = null; };
  }, [missionsQuery.data, sceneRef.current]);

  // ── Fly to satellite ───────────────────────────────────────────────────────
  const flyToSat = useCallback((sat: SatPosition) => {
    if (!cameraRef.current || !controlsRef.current) return;
    const pos = latLonAltToVec3(sat.lat, sat.lon, sat.altKm);
    const dir = pos.clone().normalize();
    // Position camera looking toward the satellite but keep orbit target at Earth center
    // so user can still freely rotate the globe
    const dist = GLOBE_R * 2.5;
    cameraRef.current.position.copy(dir.multiplyScalar(dist));
    controlsRef.current.target.set(0, 0, 0);
  }, []);

  // ── Select country AOI ─────────────────────────────────────────────────────
  const selectCountryAoi = useCallback((c: { name: string; lat: number; lon: number }) => {
    const results = allSats.map(s => computeAoiVisibility(c.lat, c.lon, s));
    setAoiPoint({ lat: c.lat, lon: c.lon });
    setAoiResults(results);
    setActivePanel("aoi");
    setCountrySearch(c.name);
    setShowCountrySearch(false);
    if (cameraRef.current && controlsRef.current) {
      const pos = latLonAltToVec3(c.lat, c.lon, 0);
      const dir = pos.clone().normalize();
      cameraRef.current.position.copy(dir.multiplyScalar(2.8));
      controlsRef.current.target.set(0, 0, 0);
    }
  }, [allSats]);

  // ── Handle predict passes from AOI ────────────────────────────────────────
  const handlePredictPassesFromAoi = useCallback((sat: SatPosition, lat: number, lon: number) => {
    setSelectedSat(sat);
    setPassPredictorLat(lat);
    setPassPredictorLon(lon);
    setShowPassPredictor(true);
    setActivePanel("intel");
  }, []);

  const hasRightPanel = activePanel !== null;

  // ── Keyboard Shortcuts State ────────────────────────────────────────────────
  const [showShortcuts, setShowShortcuts] = useState(false);

  // ── Live clock state ────────────────────────────────────────────────────────
  const [orbitClock, setOrbitClock] = useState(() => new Date().toISOString().replace("T", " ").slice(0, 19));
  useEffect(() => {
    const t = setInterval(() => setOrbitClock(new Date().toISOString().replace("T", " ").slice(0, 19)), 1000);
    return () => clearInterval(t);
  }, []);

  // ── Keyboard Shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Tab switching: 1-4
      if (e.key === "1") { setActiveTab("globe"); return; }
      if (e.key === "2") { setActiveTab("surveillance"); return; }
      if (e.key === "3") { setActiveTab("intel"); return; }
      if (e.key === "4") { setActiveTab("missions"); return; }
      // Layer toggles
      if (e.key === "w" || e.key === "W") { setShowWindLayer(v => !v); return; }
      if (e.key === "f" || e.key === "F") { setShowFireLayer(v => !v); return; }
      if (e.key === "o" || e.key === "O") { setShowOceanLayer(v => !v); return; }
      if (e.key === "h" || e.key === "H") { setShowHeatLayer(v => !v); return; }
      // Infrastructure
      if (e.key === "l" || e.key === "L") { setShowLaunchSites(v => !v); return; }
      if (e.key === "g" || e.key === "G") { setShowGroundStations(v => !v); return; }
      if (e.key === "k" || e.key === "K") { setShowStarlinkGateways(v => !v); return; }
      // View controls
      if (e.key === "n" || e.key === "N") { setNightMode(v => !v); return; }
      if (e.key === "p" || e.key === "P") { setIsLive(v => !v); return; }
      if (e.key === "r" || e.key === "R") { setShowRings(v => !v); return; }
      if (e.key === "t" || e.key === "T") { setShowTrack(v => !v); return; }
      if (e.key === "c" || e.key === "C") { setShowCoverage(v => !v); return; }
      // Modes
      if (e.key === "a" || e.key === "A") { setAoiMode(v => !v); if (compareMode) setCompareMode(false); if (aoiPolygonMode) setAoiPolygonMode(false); return; }
      if (e.key === "d" || e.key === "D") { setAoiPolygonMode(v => { if (!v) { setAoiPolygonPoints([]); setAoiPolygonClosed(false); } return !v; }); if (aoiMode) setAoiMode(false); if (compareMode) setCompareMode(false); return; }
      if (e.key === "x" || e.key === "X") { setCompareMode(v => !v); if (aoiMode) setAoiMode(false); if (aoiPolygonMode) setAoiPolygonMode(false); return; }
      if (e.key === "Enter" && aoiPolygonMode && aoiPolygonPoints.length >= 3 && !aoiPolygonClosed) { setAoiPolygonClosed(true); return; }
      // Panels
      if (e.key === "s" || e.key === "S") { setLeftPanelCollapsed(v => !v); return; }
      if (e.key === "/") { e.preventDefault(); setSearchQuery(""); const el = document.querySelector('[data-orbit-search]') as HTMLInputElement; if (el) el.focus(); return; }
      // Escape
      if (e.key === "Escape") { setSelectedSat(null); setActivePanel(null); setShowPassPredictor(false); setShowShortcuts(false); setShowCountrySearch(false); return; }
      // Help
      if (e.key === "?") { setShowShortcuts(v => !v); return; }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [compareMode, aoiMode, aoiPolygonMode, aoiPolygonPoints, aoiPolygonClosed]);

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="relative w-full overflow-hidden select-none" style={{ background: "var(--background)", fontFamily: "monospace", height: "100vh", width: "100vw" }}>
      <DisclaimerModal />
      <SessionIndicator />

      {/* ── Surveillance Tab overlay ── */}
      {activeTab === "surveillance" && (
        <SurveillanceTab onClose={() => setActiveTab("globe")} />
      )}

      {/* ── Intel Feed Tab overlay ── */}
      {activeTab === "intel" && (
        <IntelFeedTab
          allSats={allSats}
          categories={categories}
          onClose={() => setActiveTab("globe")}
          onSelectSat={sat => { setSelectedSat(sat); setActivePanel("intel"); setActiveTab("globe"); flyToSat(sat); }}
        />
      )}

      {/* ── Mission Control Tab overlay ── */}
      {activeTab === "missions" && (
        <MissionControlTab
          allSats={allSats}
          onClose={() => setActiveTab("globe")}
        />
      )}

      {/* ── Three.js canvas ── */}
      <div ref={canvasRef} className="absolute inset-0"
        style={{ width: '100%', height: '100%', minHeight: 0, minWidth: 0 }}
        onMouseMove={handleMouseMove}
        onClick={handleClick}
      />

      {/* ── Top navigation bar ── */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center px-3 py-1.5 gap-1.5"
        style={{ background: "oklch(from var(--background) l c h / 0.95)", borderBottom: "1px solid var(--border)", backdropFilter: 'blur(8px)', minHeight: 48 }}>
        {/* Logo */}
        <div className="flex items-center gap-1.5 shrink-0 mr-1">
          <div className="relative">
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <div className="absolute inset-0 w-2 h-2 rounded-full bg-cyan-500 animate-ping opacity-40" />
          </div>
          <span className="font-mono text-[12px] font-bold text-cyan-400 tracking-widest">ORBIT</span>
          <span className="font-mono text-[9px] text-muted-foreground border border-cyan-900/50 px-1.5 rounded hidden xl:inline">V2.4</span>
        </div>
        {/* Compact satellite count badges */}
        <div className="flex items-center gap-0.5 border-l border-border/70 pl-2 shrink-0">
          <span title="Total tracked satellites" className="font-mono text-[10px] text-cyan-400 px-1.5 py-0.5 rounded cursor-default" style={{ background: 'oklch(from var(--primary) l c h / 0.08)', border: '1px solid oklch(from var(--primary) l c h / 0.2)' }}>{allSats.length}</span>
          <span title="LEO — Low Earth Orbit satellites (below 2,000 km)" className="font-mono text-[10px] text-green-400 px-1.5 py-0.5 rounded cursor-default" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>L{allSats.filter(s => s.altKm < 2000).length}</span>
          <span title="MEO — Medium Earth Orbit satellites (2,000–35,000 km)" className="font-mono text-[10px] text-amber-400 px-1.5 py-0.5 rounded hidden md:inline cursor-default" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)' }}>M{allSats.filter(s => s.altKm >= 2000 && s.altKm < 35000).length}</span>
          <span title="GEO — Geostationary/High Earth Orbit satellites (above 35,000 km)" className="font-mono text-[10px] text-purple-400 px-1.5 py-0.5 rounded hidden md:inline cursor-default" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>G{allSats.filter(s => s.altKm >= 35000).length}</span>
          {allSats.filter(s => s.altKm < 300).length > 0 && (
            <span className="font-mono text-[8px] text-red-400 px-1 py-0.5 rounded animate-pulse" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)' }}>↓{allSats.filter(s => s.altKm < 300).length}</span>
          )}
        </div>
        {/* Separator */}
        <div className="h-4 w-px bg-border/50 mx-0.5 shrink-0" />
        {/* Tabs — compact */}
        {[
          { key: "globe",        label: "◉ GLOBE", tooltip: "3D Globe — real-time satellite orbital paths on interactive globe" },
          { key: "surveillance", label: "👁 SURV",  tooltip: "Surveillance Mode — track up to 10 satellites with live telemetry" },
          { key: "intel",        label: "⬡ INTEL",  tooltip: "Intelligence Feed — AI-enriched orbital event stream & threat alerts" },
          { key: "missions",     label: "⊕ MISS",   tooltip: "Mission Control — create, manage & monitor custom satellite missions" },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            title={tab.tooltip}
            className="px-3 py-1 rounded font-mono text-[11px] transition-all shrink-0 whitespace-nowrap"
            style={{
              background: activeTab === tab.key ? "rgba(0,200,255,0.15)" : "transparent",
              color: activeTab === tab.key ? "#22d3ee" : "oklch(from var(--foreground) l c h / 0.4)",
              border: `1px solid ${activeTab === tab.key ? "rgba(0,200,255,0.4)" : "transparent"}`,
            }}>
            {tab.label}
          </button>
        ))}
        {/* Right controls — all compact, single line */}
        <div className="ml-auto flex items-center gap-1 shrink-0">
          {/* Custom toggles from AdminCMS */}
          {orbitCustomToggles.map(ct => (
            ct.isExternal
              ? <a key={ct.id} href={ct.link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[11px] transition-all shrink-0"
                  style={{ background: ct.bgColor || 'transparent', border: ct.hasBorder ? `1px solid ${ct.borderColor}` : 'none', borderRadius: ct.borderRadius ? '4px' : '0', color: ct.textColor || 'inherit', textDecoration: 'none' }}>
                  {ct.label}
                </a>
              : <a key={ct.id} href={ct.link}
                  className="flex items-center gap-1 px-2.5 py-1 rounded font-mono text-[11px] transition-all shrink-0"
                  style={{ background: ct.bgColor || 'transparent', border: ct.hasBorder ? `1px solid ${ct.borderColor}` : 'none', borderRadius: ct.borderRadius ? '4px' : '0', color: ct.textColor || 'inherit', textDecoration: 'none' }}>
                  {ct.label}
                </a>
          ))}
          <button onClick={() => { setAoiMode(v => !v); if (compareMode) setCompareMode(false); if (aoiPolygonMode) setAoiPolygonMode(false); }}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            title="AOI — Area of Interest: click the globe to define a circular region and filter satellites passing over it"
            style={{ background: aoiMode ? "rgba(245,158,11,0.15)" : "transparent", borderColor: aoiMode ? "rgba(245,158,11,0.5)" : "oklch(from var(--foreground) l c h / 0.1)", color: aoiMode ? "#f59e0b" : "oklch(from var(--foreground) l c h / 0.4)" }}>
            ◎ AOI
          </button>
          <button onClick={() => { setAoiPolygonMode(v => !v); if (aoiMode) setAoiMode(false); if (compareMode) setCompareMode(false); if (!aoiPolygonMode) { setAoiPolygonPoints([]); setAoiPolygonClosed(false); } }}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            title="POLY — Polygon AOI: draw a custom polygon on the globe to filter satellites within that area"
            style={{ background: aoiPolygonMode ? "rgba(245,158,11,0.15)" : "transparent", borderColor: aoiPolygonMode ? "rgba(245,158,11,0.5)" : "oklch(from var(--foreground) l c h / 0.1)", color: aoiPolygonMode ? "#f59e0b" : "oklch(from var(--foreground) l c h / 0.4)" }}>
            △ POLY
          </button>
          <button onClick={() => { setCompareMode(v => !v); if (aoiMode) setAoiMode(false); if (!compareMode) { setCompareSatA(null); setCompareSatB(null); setShowComparePanel(false); } }}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            title="CMP — Compare Mode: select two satellites side-by-side to compare orbits, TLE data, and coverage"
            style={{ background: compareMode ? "rgba(168,85,247,0.15)" : "transparent", borderColor: compareMode ? "rgba(168,85,247,0.5)" : "oklch(from var(--foreground) l c h / 0.1)", color: compareMode ? "#a855f7" : "oklch(from var(--foreground) l c h / 0.4)" }}>
            ⊞ CMP
          </button>
          <button onClick={() => setNightMode(v => !v)}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            title={nightMode ? "Day Mode — switch to standard globe lighting" : "Night Mode — enable city lights & terminator line on the globe"}
            style={{ background: nightMode ? "rgba(99,102,241,0.15)" : "transparent", borderColor: nightMode ? "rgba(99,102,241,0.5)" : "oklch(from var(--foreground) l c h / 0.1)", color: nightMode ? "#818cf8" : "oklch(from var(--foreground) l c h / 0.4)" }}>
            {nightMode ? "☀" : "☾"}
          </button>
          <button onClick={() => setIsLive(v => !v)}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            title={isLive ? "LIVE — satellite positions updating in real-time. Click to pause." : "PAUSED — real-time updates stopped. Click to resume live tracking."}
            style={{ background: isLive ? "rgba(34,197,94,0.12)" : "transparent", borderColor: isLive ? "rgba(34,197,94,0.5)" : "oklch(from var(--foreground) l c h / 0.1)", color: isLive ? "#22c55e" : "oklch(from var(--foreground) l c h / 0.4)" }}>
            {isLive ? "⊙ LIVE" : "⊙ PSED"}
          </button>
          {/* Upgrade button */}
          {orbitVisible("upgrade") && <UpgradeButton portal="orbit" variant="compact" />}
          {/* Docs */}
          {orbitVisible("docs") && (
          <a href="/docs"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] border transition-all hover:opacity-100 shrink-0"
            style={{ background: "rgba(34,197,94,0.08)", borderColor: "rgba(34,197,94,0.3)", color: "rgba(34,197,94,0.8)", textDecoration: "none" }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            DOCS
          </a>
          )}
          {/* Fullscreen */}
          {orbitVisible("fullscreen") && (
          <button onClick={toggleFullscreen}
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            style={{ background: "transparent", borderColor: "oklch(from var(--foreground) l c h / 0.15)", color: "oklch(from var(--foreground) l c h / 0.5)" }}>
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          )}
          {/* Theme */}
          {orbitVisible("theme") && (
          <button onClick={toggleTheme}
            title={isLight ? "Switch to Dark Mode" : "Switch to Light Mode"}
            className="px-2.5 py-1 rounded font-mono text-[11px] border transition-all shrink-0"
            style={{ background: isLight ? "rgba(245,158,11,0.15)" : "rgba(99,102,241,0.15)", borderColor: isLight ? "rgba(245,158,11,0.5)" : "rgba(99,102,241,0.5)", color: isLight ? "#f59e0b" : "#818cf8" }}>
            {isLight ? <Moon size={12} /> : <Sun size={12} />}
          </button>
          )}
          {/* Back */}
          {orbitVisible("back") && (
          <a href="/"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-[11px] border transition-all hover:opacity-100 shrink-0"
            style={{ background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.3)", color: "rgba(239,68,68,0.8)", textDecoration: "none" }}>
            ← INTEL
          </a>
          )}
        </div>
      </div>
            {/* ── Left sidebar: NSA-grade collapsible layer control ── */}
      <div className="absolute top-14 left-0 z-20 flex flex-col" style={{ width: leftPanelCollapsed ? 36 : 220, transition: 'width 0.2s ease' }}>
        {/* NSA-grade collapsible panel */}
        {/* Collapse toggle */}
        <button onClick={() => setLeftPanelCollapsed(v => !v)}
          className="absolute -right-3 top-2 z-30 w-6 h-6 rounded-full flex items-center justify-center font-mono text-[10px] transition-all"
          style={{ background: 'oklch(from var(--primary) l c h / 0.12)', border: '1px solid oklch(from var(--primary) l c h / 0.3)', color: 'var(--primary)' }}>
          {leftPanelCollapsed ? '▶' : '◀'}
        </button>
        {!leftPanelCollapsed && (
        <div className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 100px)', paddingBottom: 8 }}>
        {/* Panel header */}
        <div className="px-3 py-2 flex items-center gap-2" style={{ background: 'oklch(from var(--background) l c h / 0.95)', borderBottom: '1px solid var(--border)' }}>
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
          <span className="font-mono text-[9px] tracking-widest text-cyan-400 font-bold">LAYER CONTROL</span>
          <span className="ml-auto font-mono text-[9px] text-muted-foreground">{totalSats} OBJ</span>
        </div>
        {/* SATELLITES section */}
        <div className="overflow-hidden" style={{ background: 'oklch(from var(--card) l c h / 0.95)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setLeftSections(s => ({ ...s, satellites: !s.satellites }))}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-all">
            <span className="font-mono text-[9px] tracking-widest text-cyan-500/80">▸ SATELLITES</span>
            <span className="ml-auto font-mono text-[9px] text-muted-foreground">{visibleSats.length}</span>
          </button>
          {leftSections.satellites && (
            <div>
              {GROUPS.map(g => {
                const cnt = allSats.filter(s => s.category === g.key).length;
                const on = enabledGroups.has(g.key);
                return (
                  <button key={g.key} onClick={() => setEnabledGroups(prev => { const n = new Set(prev); if (n.has(g.key)) n.delete(g.key); else n.add(g.key); return n; })}
                    className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-foreground/5 transition-all border-t"
                    style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.04)' }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                      style={{ background: on ? g.color : 'oklch(from var(--foreground) l c h / 0.12)', boxShadow: on ? `0 0 5px ${g.color}80` : 'none' }} />
                    <span className="font-mono text-[10px] flex-1 text-left truncate" style={{ color: on ? 'oklch(from var(--foreground) l c h / 0.75)' : 'oklch(from var(--foreground) l c h / 0.2)' }}>{g.label}</span>
                    <span className="font-mono text-[9px]" style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>{cnt}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {/* INFRASTRUCTURE section */}
        <div className="overflow-hidden" style={{ background: 'oklch(from var(--card) l c h / 0.95)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setLeftSections(s => ({ ...s, infrastructure: !s.infrastructure }))}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-all">
            <span className="font-mono text-[9px] tracking-widest text-orange-500/80">▸ INFRASTRUCTURE</span>
          </button>
          {leftSections.infrastructure && (
            <div>
              {[
                { key: 'launch', label: 'Launch Sites', color: '#ff6b35', count: LAUNCH_FACILITIES.length, state: showLaunchSites, set: setShowLaunchSites },
                { key: 'ground', label: 'Ground Stations', color: 'var(--primary)', count: GROUND_STATIONS.filter(s => s.type !== 'STARLINK').length, state: showGroundStations, set: setShowGroundStations },
                { key: 'starlink', label: 'Starlink Gateways', color: '#60a5fa', count: GROUND_STATIONS.filter(s => s.type === 'STARLINK').length, state: showStarlinkGateways, set: setShowStarlinkGateways },
              ].map(layer => (
                <button key={layer.key} onClick={() => layer.set(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-foreground/5 transition-all border-t"
                  style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.04)' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                    style={{ background: layer.state ? layer.color : 'oklch(from var(--foreground) l c h / 0.12)', boxShadow: layer.state ? `0 0 5px ${layer.color}80` : 'none' }} />
                  <span className="font-mono text-[10px] flex-1 text-left" style={{ color: layer.state ? 'oklch(from var(--foreground) l c h / 0.75)' : 'oklch(from var(--foreground) l c h / 0.2)' }}>{layer.label}</span>
                  <span className="font-mono text-[9px]" style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>{layer.count}</span>
                </button>
              ))}
              {/* Visualization sub-options */}
              <div className="px-3 py-2 border-t" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.04)' }}>
                <div className="font-mono text-[9px] text-cyan-500/40 mb-1.5 tracking-widest">OVERLAYS</div>
                {[
                  { label: 'Orbit Rings', state: showRings, set: setShowRings },
                  { label: 'Coverage Zone', state: showCoverage, set: setShowCoverage },
                  { label: 'Ground Track', state: showTrack, set: setShowTrack },
                ].map(opt => (
                  <button key={opt.label} onClick={() => opt.set(v => !v)}
                    className="w-full flex items-center justify-between py-1 hover:bg-foreground/5 transition-all">
                    <span className="font-mono text-[10px]" style={{ color: opt.state ? 'oklch(from var(--foreground) l c h / 0.65)' : 'oklch(from var(--foreground) l c h / 0.2)' }}>{opt.label}</span>
                    <span className="font-mono text-[9px] px-1 rounded" style={{ background: opt.state ? 'rgba(0,200,255,0.15)' : 'oklch(from var(--foreground) l c h / 0.05)', color: opt.state ? 'var(--primary)' : 'oklch(from var(--foreground) l c h / 0.2)' }}>{opt.state ? 'ON' : 'OFF'}</span>
                  </button>
                ))}
                {showCoverage && (
                  <div className="mt-1.5">
                    <div className="flex justify-between mb-1">
                      <span className="font-mono text-[9px] text-cyan-500/40">MIN ELEV</span>
                      <span className="font-mono text-[9px] font-bold" style={{ color: minElevDeg === 0 ? '#22d3ee' : '#f59e0b' }}>{minElevDeg}°</span>
                    </div>
                    <input type="range" min={0} max={30} step={1} value={minElevDeg}
                      onChange={e => setMinElevDeg(Number(e.target.value))}
                      className="w-full h-0.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #22d3ee ${(minElevDeg/30)*100}%, oklch(from var(--foreground) l c h / 0.1) ${(minElevDeg/30)*100}%)` }} />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        {/* ENVIRONMENT section */}
        <div className="overflow-hidden" style={{ background: 'oklch(from var(--card) l c h / 0.95)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setLeftSections(s => ({ ...s, environment: !s.environment }))}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-all">
            <span className="font-mono text-[9px] tracking-widest text-green-500/80">▸ ENVIRONMENT</span>
            {(showWindLayer || showFireLayer || showOceanLayer || showHeatLayer) && (
              <span className="ml-auto font-mono text-[9px] px-1 rounded" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>ACTIVE</span>
            )}
          </button>
          {leftSections.environment && (
            <div>
              {[
                { key: 'wind', label: '🌬 Wind Streams', color: '#67e8f9', state: showWindLayer, set: setShowWindLayer, desc: 'Atmospheric wind patterns' },
                { key: 'fire', label: '🔥 Fire/Thermal', color: '#ff4400', state: showFireLayer, set: setShowFireLayer, desc: 'FIRMS active fire hotspots' },
                { key: 'ocean', label: '🌊 Ocean Currents', color: '#0088ff', state: showOceanLayer, set: setShowOceanLayer, desc: 'Major surface currents' },
                { key: 'heat', label: '🌡 Heat Map', color: '#f97316', state: showHeatLayer, set: setShowHeatLayer, desc: 'Surface temperature gradient' },
              ].map(layer => (
                <button key={layer.key} onClick={() => layer.set(v => !v)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-foreground/5 transition-all border-t"
                  style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.04)' }}>
                  <div className="w-1.5 h-1.5 rounded-full flex-shrink-0 transition-all"
                    style={{ background: layer.state ? layer.color : 'oklch(from var(--foreground) l c h / 0.12)', boxShadow: layer.state ? `0 0 5px ${layer.color}80` : 'none' }} />
                  <div className="flex-1 text-left">
                    <div className="font-mono text-[10px]" style={{ color: layer.state ? 'oklch(from var(--foreground) l c h / 0.75)' : 'oklch(from var(--foreground) l c h / 0.2)' }}>{layer.label}</div>
                    <div className="font-mono text-[9px]" style={{ color: 'oklch(from var(--foreground) l c h / 0.2)' }}>{layer.desc}</div>
                  </div>
                  <span className="font-mono text-[9px] px-1 rounded" style={{ background: layer.state ? `${layer.color}22` : 'oklch(from var(--foreground) l c h / 0.05)', color: layer.state ? layer.color : 'oklch(from var(--foreground) l c h / 0.2)' }}>{layer.state ? 'ON' : 'OFF'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* MISSIONS quick-view section */}
        <div className="overflow-hidden" style={{ background: 'oklch(from var(--card) l c h / 0.95)', borderBottom: '1px solid var(--border)' }}>
          <button onClick={() => setLeftSections(s => ({ ...s, missions: !s.missions }))}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-all">
            <span className="font-mono text-[9px] tracking-widest text-purple-400/80">▸ MISSIONS</span>
            {missionsQuery.data && (missionsQuery.data as any[]).filter((m: any) => m.status === 'ACTIVE').length > 0 && (
              <span className="ml-auto font-mono text-[9px] px-1 rounded" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7' }}>
                {(missionsQuery.data as any[]).filter((m: any) => m.status === 'ACTIVE').length} ACTIVE
              </span>
            )}
          </button>
          {leftSections.missions && (
            <div className="px-3 py-2">
              {!missionsQuery.data || (missionsQuery.data as any[]).length === 0 ? (
                <div className="font-mono text-[9px] text-muted-foreground/40 text-center py-2">No missions · Go to ⊕ MISSIONS tab</div>
              ) : (
                (missionsQuery.data as any[]).slice(0, 4).map((m: any) => (
                  <div key={m.id} className="flex items-center gap-2 py-1 border-b last:border-0" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.06)' }}>
                    <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: m.status === 'ACTIVE' ? '#22c55e' : m.status === 'PLANNING' ? '#f59e0b' : '#6b7280' }} />
                    <span className="font-mono text-[10px] flex-1 truncate" style={{ color: m.status === 'ACTIVE' ? 'oklch(from var(--foreground) l c h / 0.7)' : 'oklch(from var(--foreground) l c h / 0.3)' }}>{m.name}</span>
                    <span className="font-mono text-[9px]" style={{ color: m.status === 'ACTIVE' ? '#22c55e' : '#6b7280' }}>{m.status}</span>
                  </div>
                ))
              )}
              <button onClick={() => setActiveTab('missions')}
                className="w-full mt-2 py-1 font-mono text-[9px] rounded transition-all"
                style={{ background: 'rgba(168,85,247,0.1)', color: '#a855f7', border: '1px solid rgba(168,85,247,0.2)' }}>
                ⊕ MANAGE MISSIONS
              </button>
            </div>
          )}
        </div>
        {/* Statistics */}
        <div className="px-3 py-2" style={{ background: 'oklch(from var(--card) l c h / 0.95)' }}>
          <div className="font-mono text-[9px] tracking-widest text-cyan-500/40 mb-2">ORBITAL STATS</div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1">
            {[
              ['LEO', allSats.filter(s => s.altKm < 2000).length, '#22d3ee'],
              ['MEO', allSats.filter(s => s.altKm >= 2000 && s.altKm < 35000).length, '#f59e0b'],
              ['GEO', allSats.filter(s => s.altKm >= 35000).length, '#a78bfa'],
              ['DECAY', allSats.filter(s => s.altKm < 300).length, '#ef4444'],
            ].map(([label, count, color]) => (
              <div key={label as string} className="flex justify-between">
                <span className="font-mono text-[9px]" style={{ color: (color as string) + '80' }}>{label as string}</span>
                <span className="font-mono text-[9px] font-bold" style={{ color: color as string }}>{count as number}</span>
              </div>
            ))}
          </div>
          <div className="mt-1.5 pt-1.5 border-t flex justify-between" style={{ borderColor: 'oklch(from var(--foreground) l c h / 0.08)' }}>
            <span className="font-mono text-[9px] text-muted-foreground/60">TOTAL TRACKED</span>
            <span className="font-mono text-[9px] font-bold text-green-400">{totalSats}</span>
          </div>
        </div>
        </div>
        )}
        {leftPanelCollapsed && (
          <div className="flex flex-col items-center gap-3 py-3" style={{ background: 'oklch(from var(--background) l c h / 0.92)', borderRight: '1px solid var(--border)', height: '100%', minHeight: 200 }}>
            <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
            <div className="font-mono text-[8px] text-muted-foreground" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed', transform: 'rotate(180deg)' }}>LAYER CTRL</div>
          </div>
        )}
      </div>
      {/* ── Search + Country AOI search ── */}
      <div className="absolute top-14 z-20" style={{ right: hasRightPanel ? 392 : 12, width: 260 }}>
        <div className="rounded border backdrop-blur-sm px-3 py-2" style={{ background: "oklch(from var(--card) l c h / 0.92)", borderColor: "var(--border)" }}>
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search satellite / NORAD ID..."
            className="w-full bg-transparent text-cyan-300 font-mono text-xs outline-none placeholder:text-cyan-800" />
        </div>
        {searchResults.length > 0 && (
          <div className="mt-1 rounded border overflow-hidden shadow-2xl" style={{ background: "oklch(from var(--card) l c h / 0.97)", borderColor: "var(--border)" }}>
            {searchResults.map(sat => {
              const catColor = categories.find(c => c.key === sat.category)?.color ?? "#fff";
              return (
                <button key={sat.noradId} onClick={() => { setSelectedSat(sat); setActivePanel("intel"); flyToSat(sat); setSearchQuery(""); }}
                  className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cyan-900/20 transition-all text-left border-b border-cyan-900/20 last:border-0">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: catColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-xs text-foreground truncate">{sat.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">#{sat.noradId} · {sat.altKm.toFixed(0)}km</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Country AOI search */}
        {aoiMode && (
          <div className="mt-2">
            <div className="rounded border backdrop-blur-sm px-3 py-2" style={{ background: "rgba(20,10,0,0.92)", borderColor: "var(--border)" }}>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-amber-500/70 flex-shrink-0">◎ COUNTRY</span>
                <input value={countrySearch}
                  onChange={e => { setCountrySearch(e.target.value); setShowCountrySearch(true); }}
                  onFocus={() => setShowCountrySearch(true)}
                  placeholder="Search country name..."
                  className="flex-1 bg-transparent text-amber-300 font-mono text-xs outline-none placeholder:text-amber-900" />
              </div>
            </div>
            {showCountrySearch && countryResults.length > 0 && (
              <div className="mt-1 rounded border overflow-hidden shadow-2xl" style={{ background: "rgba(20,10,0,0.97)", borderColor: "var(--border)" }}>
                {countryResults.map(c => (
                  <button key={c.name} onClick={() => selectCountryAoi(c)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-amber-900/20 transition-all text-left border-b border-amber-900/20 last:border-0">
                    <span className="font-mono text-xs text-amber-300 flex-1">{c.name}</span>
                    <span className="font-mono text-[10px] text-amber-700">{c.lat.toFixed(1)}°, {c.lon.toFixed(1)}°</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Orbit ring legend ── */}
      {showRings && (
        <div className="absolute bottom-10 left-3 z-20 rounded border px-3 py-2 backdrop-blur-sm"
          style={{ background: "oklch(from var(--card) l c h / 0.90)", borderColor: "var(--border)" }}>
          <div className="font-mono text-[9px] tracking-widest text-cyan-500/60 mb-1.5">ORBIT ALTITUDES</div>
          {ORBIT_RINGS.map(r => (
            <div key={r.label} className="flex items-center gap-2 mb-0.5">
              <div className="w-5 h-px" style={{ background: r.color }} />
              <span className="font-mono text-[10px] text-muted-foreground">{r.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Hover tooltip: satellite ── */}
      {hoveredSat && !selectedSat && (
        <div className="absolute z-30 pointer-events-none" style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}>
          <div className="rounded border shadow-2xl overflow-hidden" style={{ background: "oklch(from var(--card) l c h / 0.97)", borderColor: "oklch(from var(--primary) l c h / 0.4)", width: 260 }}>
            <div className="relative h-28 overflow-hidden">
              <img src={getSatImage(hoveredSat.name, hoveredSat.imageUrl)} alt={hoveredSat.name}
                className="w-full h-full object-cover opacity-75"
                onError={e => { (e.target as HTMLImageElement).src = SAT_IMAGES.DEFAULT; }} />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <div className="absolute bottom-1.5 left-2.5">
                <div className="font-mono text-xs font-bold text-foreground">{hoveredSat.name}</div>
                <div className="font-mono text-[10px] text-cyan-400">#{hoveredSat.noradId} · {(categories.find(c => c.key === hoveredSat.category)?.label ?? hoveredSat.category).toUpperCase()}</div>
              </div>
            </div>
            <div className="px-3 py-2 grid grid-cols-2 gap-x-3 gap-y-1">
              {[
                ["ALT", `${hoveredSat.altKm.toFixed(0)} km`],
                ["SPEED", `${hoveredSat.speedKms.toFixed(2)} km/s`],
                ["INC", `${hoveredSat.inclination.toFixed(1)}°`],
                ["LAT", `${hoveredSat.lat.toFixed(2)}°`],
                ["LON", `${hoveredSat.lon.toFixed(2)}°`],
                ["TYPE", hoveredSat.altKm < 2000 ? "LEO" : hoveredSat.altKm < 35000 ? "MEO" : "GEO"],
              ].map(([k, v]) => (
                <div key={k} className="flex gap-1">
                  <span className="font-mono text-[10px] text-muted-foreground">{k}:</span>
                  <span className="font-mono text-[10px] text-foreground">{v}</span>
                </div>
              ))}
            </div>
            {hoveredSat.country && <div className="px-3 pb-2 font-mono text-[10px] text-amber-400">{hoveredSat.country} · {hoveredSat.operator ?? ""}</div>}
            <div className="px-3 pb-2 flex items-center gap-2">
              <TleAgeBadge tle1={hoveredSat.tle1} compact />
              <span className="font-mono text-[10px] text-muted-foreground italic">Click for full intel →</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Hover tooltip: facility ── */}
      {hoveredFacility && (
        <div className="absolute z-30 pointer-events-none" style={{ left: tooltipPos.x + 16, top: tooltipPos.y - 10 }}>
          <div className="rounded border shadow-2xl p-3" style={{ background: "oklch(from var(--card) l c h / 0.97)", borderColor: "oklch(from var(--intel-red) l c h / 0.4)", width: 280 }}>
            <div className="font-mono text-xs font-bold text-orange-400 mb-1">{hoveredFacility.name}</div>
            <div className="font-mono text-[10px] text-foreground/60 mb-2">{(hoveredFacility as any).country} · {(hoveredFacility as any).operator}</div>
            {(hoveredFacility as any).notes && (
              <div className="font-mono text-[9px] text-muted-foreground/80 border-t border-border/70 pt-1.5">{(hoveredFacility as any).notes}</div>
            )}
            <div className="flex items-center gap-2 mt-1.5">
              <span className="font-mono text-[9px] px-1.5 py-0.5 rounded"
                style={{ background: "rgba(255,107,53,0.15)", color: "#ff6b35", border: "1px solid rgba(255,107,53,0.3)" }}>
                {(hoveredFacility as any).type ?? (hoveredFacility as any).status}
              </span>
              <span className="font-mono text-[9px] text-muted-foreground/60">{hoveredFacility.lat.toFixed(2)}°, {hoveredFacility.lon.toFixed(2)}°</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Right panels ── */}
      {activePanel === "intel" && selectedSat && (
        <SatIntelPanel
          sat={selectedSat}
          allSats={allSats}
          categories={categories}
          onClose={() => { setSelectedSat(null); setActivePanel(null); setIsTracking(false); setShowPassPredictor(false); }}
          onSelectSat={sat => { setSelectedSat(sat); flyToSat(sat); }}
          onTrack={() => setIsTracking(v => !v)}
          isTracking={isTracking}
          onShowPasses={() => setShowPassPredictor(v => !v)}
          showPassPredictor={showPassPredictor}
        />
      )}
      {activePanel === "aoi" && aoiPoint && (
        <AoiPanel
          lat={aoiPoint.lat}
          lon={aoiPoint.lon}
          results={aoiResults}
          onClose={() => { setAoiPoint(null); setActivePanel(null); setAoiMode(false); }}
          onSelectSat={sat => { setSelectedSat(sat); setActivePanel("intel"); flyToSat(sat); }}
          onPredictPasses={handlePredictPassesFromAoi}
        />
      )}

      {/* ── Facility / Infrastructure Panel ── */}
      {activePanel === 'facility' && selectedFacility && (
        <FacilityLinkedSatsPanel
          facility={selectedFacility as any}
          allSats={allSats}
          onClose={() => { setSelectedFacility(null); setActivePanel(null); }}
          onSelectSat={sat => { setSelectedSat(sat); setActivePanel('intel'); flyToSat(sat); }}
        />
      )}

      {/* ── Pass Predictor ── */}
      {showPassPredictor && selectedSat && (
        <PassPredictorPanel
          sat={selectedSat}
          onClose={() => { setShowPassPredictor(false); setPassPredictorLat(undefined); setPassPredictorLon(undefined); }}
          initialLat={passPredictorLat}
          initialLon={passPredictorLon}
        />
      )}

      {/* ── Compare panel ── */}
      {showComparePanel && compareSatA && compareSatB && (
        <ComparePanel
          satA={compareSatA}
          satB={compareSatB}
          categories={categories}
          onClose={() => { setShowComparePanel(false); setCompareSatA(null); setCompareSatB(null); setCompareMode(false); }}
        />
      )}

      {/* ── Compare mode hint ── */}
      {compareMode && !showComparePanel && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded border font-mono text-xs"
          style={{ background: "rgba(168,85,247,0.15)", borderColor: "rgba(168,85,247,0.4)", color: "#a855f7" }}>
          {!compareSatA ? "Click first satellite to compare" : `${compareSatA.name} selected — click second satellite`}
        </div>
      )}

      {/* ── AOI mode hint ── */}
      {aoiMode && !aoiPoint && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded border font-mono text-xs"
          style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}>
          ◎ Click anywhere on the globe or search a country above
        </div>
      )}

      {/* ── Polygon mode hint & controls ── */}
      {aoiPolygonMode && (
        <div className="absolute bottom-14 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded border font-mono text-xs flex items-center gap-3"
          style={{ background: "rgba(245,158,11,0.12)", borderColor: "rgba(245,158,11,0.4)", color: "#f59e0b" }}>
          {!aoiPolygonClosed ? (
            <>
              △ Click to add points ({aoiPolygonPoints.length} placed){aoiPolygonPoints.length >= 3 && " — "}
              {aoiPolygonPoints.length >= 3 && (
                <button onClick={() => setAoiPolygonClosed(true)} className="px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 hover:bg-amber-500/30 transition-all">
                  Close Polygon
                </button>
              )}
              {aoiPolygonPoints.length > 0 && (
                <button onClick={() => { setAoiPolygonPoints([]); setAoiPolygonClosed(false); }} className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-400 transition-all">
                  Reset
                </button>
              )}
            </>
          ) : (
            <>
              △ Polygon closed — {polygonAoiResults.length} satellites in area
              <button onClick={() => { setAoiPolygonPoints([]); setAoiPolygonClosed(false); }} className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 text-red-400 transition-all">
                Clear
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Polygon AOI Results Panel ── */}
      {aoiPolygonClosed && polygonAoiResults.length > 0 && (
        <div className="absolute top-16 right-4 z-30 w-80 max-h-[60vh] overflow-y-auto rounded-lg border backdrop-blur-md"
          style={{ background: "oklch(from var(--card) l c h / 0.95)", borderColor: "rgba(245,158,11,0.3)" }}>
          <div className="sticky top-0 z-10 p-3 border-b backdrop-blur-sm flex items-center justify-between" style={{ borderColor: "rgba(245,158,11,0.2)", background: "oklch(from var(--card) l c h / 0.98)" }}>
            <div className="flex items-center gap-2">
              <span className="text-amber-500">△</span>
              <span className="font-mono text-xs font-bold text-amber-400">POLYGON AOI — {polygonAoiResults.length} SATELLITES</span>
            </div>
            <button onClick={() => { setAoiPolygonPoints([]); setAoiPolygonClosed(false); setAoiPolygonMode(false); }} className="text-muted-foreground hover:text-foreground">×</button>
          </div>
          <div className="divide-y divide-border/20">
            {polygonAoiResults.slice(0, 50).map(sat => (
              <button key={sat.noradId} onClick={() => { setSelectedSat(sat); setActivePanel("intel"); flyToSat(sat); }}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-foreground/5 transition-all text-left">
                <div className="w-2 h-2 rounded-full" style={{ background: categories.find(c => c.key === sat.category)?.color ?? "#06b6d4" }} />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[10px] text-foreground/90 truncate">{sat.name}</div>
                  <div className="font-mono text-[9px] text-muted-foreground">{sat.altKm?.toFixed(0)}km • {sat.lat?.toFixed(1)}°, {sat.lon?.toFixed(1)}°</div>
                </div>
                <span className="font-mono text-[9px] px-1.5 py-0.5 rounded" style={{ background: "rgba(245,158,11,0.1)", color: "#f59e0b" }}>
                  {sat.category}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Reset view button ── */}
      {(selectedSat || activePanel || aoiPoint || aoiPolygonClosed || isTracking || showPassPredictor || showComparePanel) && (
        <button
          onClick={() => {
            setSelectedSat(null);
            setActivePanel(null);
            setIsTracking(false);
            setShowPassPredictor(false);
            setPassPredictorLat(undefined);
            setPassPredictorLon(undefined);
            setAoiPoint(null);
            setAoiMode(false);
            setAoiPolygonMode(false);
            setAoiPolygonPoints([]);
            setAoiPolygonClosed(false);
            setShowComparePanel(false);
            setCompareSatA(null);
            setCompareSatB(null);
            setCompareMode(false);
            setHoveredSat(null);
            setHoveredFacility(null);
            // Reset camera to default position
            if (cameraRef.current && controlsRef.current) {
              cameraRef.current.position.set(0, 0, 2.8);
              controlsRef.current.target.set(0, 0, 0);
            }
          }}
          className="absolute bottom-10 right-3 z-30 flex items-center gap-2 px-3 py-2 rounded-lg border font-mono text-xs backdrop-blur-sm shadow-lg transition-all hover:scale-105 active:scale-95"
          style={{ background: "oklch(from var(--card) l c h / 0.92)", borderColor: "var(--border)", color: "var(--foreground)" }}
          title="Reset view & clear selection"
        >
          <RotateCcw className="w-3.5 h-3.5 text-cyan-500" />
          <span className="text-[10px] tracking-wider text-muted-foreground">RESET VIEW</span>
        </button>
      )}

      {/* ── Cursor coordinates overlay ── */}
      {cursorCoords && (
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 font-mono text-[11px] text-cyan-400 bg-background/90 border border-cyan-500/30 px-3 py-1 rounded-full backdrop-blur-sm shadow-lg"
          style={{ pointerEvents: 'none' }}>
          LAT {cursorCoords.lat >= 0 ? '+' : ''}{cursorCoords.lat.toFixed(3)}° · LON {cursorCoords.lon >= 0 ? '+' : ''}{cursorCoords.lon.toFixed(3)}°
        </div>
      )}

      {/* ── Bottom status bar ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-1 overflow-x-auto"
        style={{ background: "oklch(from var(--background) l c h / 0.90)", borderTop: "1px solid var(--border)" }}>
        <span className="font-mono text-[10px] text-green-600 flex-shrink-0">● SYS:ONLINE</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">TLE: CELESTRAK/SATNOGS/NORAD</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">PROP: SGP4/SDP4</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">REFRESH: {isLive ? "30s AUTO" : "PAUSED"}</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">LAUNCH SITES: {LAUNCH_FACILITIES.length}</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">GROUND STATIONS: {GROUND_STATIONS.length}</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-muted-foreground flex-shrink-0">OSINT SOURCES: {OSINT_SOURCES.length}</span>
        <span className="font-mono text-[10px] text-border">│</span>
        <span className="font-mono text-[10px] text-green-600 flex-shrink-0">ENC:AES-256</span>
        <div className="ml-auto flex items-center gap-3 flex-shrink-0">
          {/* Redroom Logo + Copyright */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-4 h-4 rounded-full flex-shrink-0" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)" }}>
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z" fill="rgba(239,68,68,0.4)" stroke="#ef4444" strokeWidth="2"/>
              </svg>
            </div>
            <span className="font-mono text-[10px]" style={{ color: "rgba(239,68,68,0.7)" }}>REDROOM V2.4</span>
          </div>
          <span className="font-mono text-[10px] text-border">│</span>
          <span className="font-mono text-[10px] text-cyan-800">ORBIT INTELLIGENCE SYSTEM · PALANTIR/MAVEN GRADE</span>
          <span className="font-mono text-[10px] text-border">│</span>
          <span className="font-mono text-[10px]" style={{ color: "rgba(239,68,68,0.45)" }}>© ALEXSAI · OWLINK.AI</span>
          <span className="font-mono text-[10px] text-border">│</span>
          <span className="font-mono text-[10px] text-cyan-400/70">{orbitClock} UTC</span>
        </div>
      </div>

      {/* ── Keyboard Shortcuts Help Panel ── */}
      {showShortcuts && (
        <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setShowShortcuts(false)}>
          <div className="bg-card border border-border rounded-lg p-6 max-w-lg w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-mono text-sm font-bold text-cyan-400 tracking-widest">KEYBOARD SHORTCUTS</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-muted-foreground hover:text-foreground">ESC</button>
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1">
              {[
                ["TABS", ""],
                ["1", "Globe view"],
                ["2", "Surveillance"],
                ["3", "Intel Feed"],
                ["4", "Missions"],
                ["LAYERS", ""],
                ["W", "Toggle Wind"],
                ["F", "Toggle Fire/Thermal"],
                ["O", "Toggle Ocean Currents"],
                ["H", "Toggle Heat Map"],
                ["INFRASTRUCTURE", ""],
                ["L", "Toggle Launch Sites"],
                ["G", "Toggle Ground Stations"],
                ["K", "Toggle Starlink Gateways"],
                ["VIEW", ""],
                ["N", "Night/Day mode"],
                ["P", "Pause/Resume live"],
                ["R", "Toggle orbit rings"],
                ["T", "Toggle track line"],
                ["C", "Toggle coverage cone"],
                ["MODES", ""],
                ["A", "AOI point mode"],
                ["D", "Draw polygon AOI"],
                ["Enter", "Close polygon"],
                ["X", "Compare mode"],
                ["S", "Toggle sidebar"],
                ["/", "Focus search"],
                ["Esc", "Close panels"],
                ["?", "This help"],
              ].map(([key, desc], i) => (
                desc === "" ? (
                  <div key={i} className="col-span-2 font-mono text-[9px] text-cyan-400/60 tracking-widest mt-2 mb-0.5 border-b border-border/30 pb-0.5">{key}</div>
                ) : (
                  <div key={i} className="flex items-center gap-2 py-0.5">
                    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded bg-muted border border-border font-mono text-[10px] text-foreground">{key}</kbd>
                    <span className="font-mono text-[10px] text-muted-foreground">{desc}</span>
                  </div>
                )
              ))}
            </div>
            <div className="mt-4 pt-3 border-t border-border/30 text-center">
              <span className="font-mono text-[9px] text-muted-foreground/60">Press ? to toggle this panel</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Loading overlay ── */}
      {!sceneReady && (
        <div className="absolute inset-0 flex items-center justify-center z-50" style={{ background: "var(--background)" }}>
          <div className="text-center">
            <div className="w-16 h-16 border-2 border-primary/20 border-t-cyan-500 rounded-full animate-spin mx-auto mb-4" />
            <div className="font-mono text-sm text-cyan-400 tracking-widest">INITIALIZING ORBIT INTELLIGENCE</div>
            <div className="font-mono text-xs text-muted-foreground mt-1">Loading 3D globe · Acquiring TLE data · Indexing infrastructure...</div>
          </div>
        </div>
      )}
    </div>
  );
}
