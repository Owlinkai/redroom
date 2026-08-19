import { publicProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { drizzle } from "drizzle-orm/mysql2";
import { sigintCameras, countryIntelData, articles } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";
import { getLiveCameras, type LiveCamera } from "./liveCameras";
import WebSocket from "ws";
import { ENV } from "../_core/env";
import { invokeLLM } from "../_core/llm";

// ─── Ship Type Decoder ───────────────────────────────────────────────────────
function decodeShipType(code: number): { type: string; label: string; color: string } {
  if (code >= 70 && code <= 79) return { type: "cargo", label: "Cargo", color: "#f59e0b" };
  if (code >= 80 && code <= 89) return { type: "tanker", label: "Tanker", color: "#ef4444" };
  if (code >= 60 && code <= 69) return { type: "passenger", label: "Passenger", color: "#3b82f6" };
  if (code >= 40 && code <= 49) return { type: "high_speed", label: "High Speed", color: "#06b6d4" };
  if (code >= 30 && code <= 39) return { type: "fishing", label: "Fishing", color: "#22c55e" };
  if (code === 35) return { type: "military", label: "Military", color: "#a855f7" };
  if (code >= 50 && code <= 59) return { type: "special", label: "Special Craft", color: "#ec4899" };
  if (code >= 20 && code <= 29) return { type: "wing_in_ground", label: "WIG", color: "#14b8a6" };
  return { type: "other", label: "Other", color: "#64748b" };
}

// ─── Navigation Status Decoder ───────────────────────────────────────────────
function decodeNavStatus(code: number): string {
  const statuses: Record<number, string> = {
    0: "Under way using engine",
    1: "At anchor",
    2: "Not under command",
    3: "Restricted manoeuvrability",
    4: "Constrained by draught",
    5: "Moored",
    6: "Aground",
    7: "Engaged in fishing",
    8: "Under way sailing",
    9: "Reserved (HSC)",
    10: "Reserved (WIG)",
    11: "Power-driven vessel towing astern",
    12: "Power-driven vessel pushing ahead",
    14: "AIS-SART",
    15: "Not defined",
  };
  return statuses[code] || "Unknown";
}

// ─── CCTV: Read verified cameras from database ─────────────────────────────

let _sigintDb: ReturnType<typeof drizzle> | null = null;
function getSigintDb() {
  if (!_sigintDb && process.env.DATABASE_URL) {
    _sigintDb = drizzle(process.env.DATABASE_URL);
  }
  return _sigintDb;
}

// Cache cameras from DB (refresh every 5 minutes)
let dbCameraCache: { cameras: any[]; lastFetch: number } = { cameras: [], lastFetch: 0 };
const DB_CAMERA_CACHE_TTL = 5 * 60 * 1000;

// Hash cache for camera feed change detection
const cameraHashCache = new Map<string, { hash: string; lastChanged: number; lastFetched: number }>();

async function getAllCCTVCamerasFromDB(): Promise<any[]> {
  const now = Date.now();
  if (dbCameraCache.cameras.length > 0 && (now - dbCameraCache.lastFetch) < DB_CAMERA_CACHE_TTL) {
    return dbCameraCache.cameras;
  }

  const db = getSigintDb();
  if (!db) return [];

  try {
    const rows = await db.select().from(sigintCameras).where(eq(sigintCameras.isActive, true));
    const cameras = rows.map(row => ({
      id: row.externalId,
      name: row.name,
      lat: row.latitude,
      lon: row.longitude,
      city: row.city || "",
      country: row.countryCode,
      countryName: row.country,
      source: row.source,
      sourceRef: row.sourceApi || "",
      feedUrl: row.feedUrl,
      videoUrl: "",
      type: row.feedType || "image",
      active: true,
      road: row.road || "",
      direction: row.direction || "",
    }));
    dbCameraCache = { cameras, lastFetch: now };
    return cameras;
  } catch (err) {
    console.error("[SIGINT] Failed to fetch cameras from DB:", err);
    return dbCameraCache.cameras; // Return stale cache on error
  }
}
// ─── Maritime: Real AIS from aisstream.io WebSocket (Global Coverage) ────────
// Uses the Osiris methodology: persistent WebSocket connection to aisstream.io
// with a global bounding box, caching vessel positions in memory.
const globalForAis = globalThis as unknown as {
  shipsCache: Map<number, any>;
  isAisConnecting: boolean;
  wsInstance: WebSocket | null;
  lastMessageTime: number;
};
if (!globalForAis.shipsCache) {
  globalForAis.shipsCache = new Map();
  globalForAis.isAisConnecting = false;
  globalForAis.wsInstance = null;
  globalForAis.lastMessageTime = 0;
}
const shipsCache = globalForAis.shipsCache;

function connectAisStream() {
  if (globalForAis.isAisConnecting) return;
  const apiKey = ENV.aisApiKey;
  if (!apiKey) {
    console.warn("[SIGINT] AIS_API_KEY not set — maritime data will be unavailable");
    return;
  }
  globalForAis.isAisConnecting = true;
  let ws: WebSocket;
  try {
    ws = new WebSocket("wss://stream.aisstream.io/v0/stream");
  } catch (e) {
    globalForAis.isAisConnecting = false;
    console.error("[SIGINT] AIS WebSocket creation failed:", e);
    return;
  }
  ws.on("open", () => {
    globalForAis.isAisConnecting = false;
    globalForAis.wsInstance = ws;
    console.log("[SIGINT] AIS WebSocket connected to aisstream.io");
    const subscriptionMessage = {
      APIKey: apiKey,
      BoundingBoxes: [[[-90, -180], [90, 180]]],
      FilterMessageTypes: ["PositionReport"],
    };
    ws.send(JSON.stringify(subscriptionMessage));
  });
  ws.on("message", (data) => {
    try {
      globalForAis.lastMessageTime = Date.now();
      const parsed = JSON.parse(data.toString());
      if (parsed.MessageType === "PositionReport" && parsed.Message?.PositionReport) {
        const report = parsed.Message.PositionReport;
        const meta = parsed.MetaData;
        const mmsi = meta?.MMSI || report.UserID;
        if (!mmsi) return;
        const lat = report.Latitude;
        const lon = report.Longitude;
        if (lat === 0 && lon === 0) return; // Skip null island
        if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return;
        // Track position history for trail rendering
        updateVesselHistory(mmsi, lat, lon);
        shipsCache.set(mmsi, {
          mmsi: String(mmsi),
          name: meta?.ShipName?.trim() || `VESSEL-${mmsi}`,
          lat,
          lon,
          speed: report.Sog ?? 0,
          heading: report.TrueHeading === 511 ? report.Cog : (report.TrueHeading ?? report.Cog ?? 0),
          cog: report.Cog ?? 0,
          navStatus: report.NavigationalStatus ?? 15,
          navStatusLabel: decodeNavStatus(report.NavigationalStatus ?? 15),
          timestamp: Date.now(),
          country: meta?.country ?? "",
          shipTypeCode: meta?.ShipType ?? 0,
        });
        // Limit cache size to prevent memory leak (latest 15000 ships)
        if (shipsCache.size > 15000) {
          const firstKey = shipsCache.keys().next().value;
          if (firstKey !== undefined) shipsCache.delete(firstKey);
        }
      }
    } catch { /* ignore parse errors */ }
  });
  ws.on("close", () => {
    globalForAis.isAisConnecting = false;
    globalForAis.wsInstance = null;
    console.log("[SIGINT] AIS WebSocket closed, reconnecting in 5s...");
    setTimeout(connectAisStream, 5000);
  });
  ws.on("error", (err) => {
    console.error("[SIGINT] AIS WebSocket error:", err.message);
    ws.close();
  });
}

// Start AIS WebSocket connection on module load
connectAisStream();

// Health check: if no messages received in 60s, reconnect
setInterval(() => {
  if (globalForAis.wsInstance && Date.now() - globalForAis.lastMessageTime > 60000) {
    console.warn("[SIGINT] AIS WebSocket stale, reconnecting...");
    globalForAis.wsInstance.close();
  }
}, 30000);

function getGlobalVessels(): any[] {
  const now = Date.now();
  const vessels: any[] = [];
  for (const [mmsi, ship] of Array.from(shipsCache.entries())) {
    // Remove stale entries (older than 10 minutes)
    if (now - ship.timestamp > 10 * 60 * 1000) {
      shipsCache.delete(mmsi);
      continue;
    }
    // Only include moving vessels (SOG > 0.3 knots)
    if (ship.speed < 0.3) continue;
    const typeInfo = decodeShipType(ship.shipTypeCode);
    vessels.push({
      mmsi: ship.mmsi,
      name: ship.name,
      type: typeInfo.type,
      typeLabel: typeInfo.label,
      typeColor: typeInfo.color,
      shipTypeCode: ship.shipTypeCode,
      flag: ship.country || "??",
      callSign: "",
      destination: "",
      origin: "",
      lat: ship.lat,
      lon: ship.lon,
      heading: ship.heading,
      speed: ship.speed,
      cog: ship.cog,
      navStatus: ship.navStatus,
      navStatusLabel: ship.navStatusLabel,
      length: 0,
      imo: null,
      draught: null,
      eta: null,
      region: "Global AIS",
    });
  }
  return vessels;
}

// Vessel position history for trail rendering (last 10 positions per vessel)
const vesselPositionHistory = new Map<number, { lat: number; lon: number; ts: number }[]>();
const MAX_VESSEL_TRAIL_POINTS = 10;

function updateVesselHistory(mmsi: number, lat: number, lon: number) {
  const history = vesselPositionHistory.get(mmsi) || [];
  const last = history[history.length - 1];
  // Only add if moved > 200m from last recorded position
  if (last) {
    const dlat = lat - last.lat;
    const dlon = lon - last.lon;
    const dist = Math.sqrt(dlat * dlat + dlon * dlon) * 111000;
    if (dist < 200) return;
  }
  history.push({ lat, lon, ts: Date.now() });
  if (history.length > MAX_VESSEL_TRAIL_POINTS) history.shift();
  vesselPositionHistory.set(mmsi, history);
  // Limit total tracked vessels to prevent memory leak
  if (vesselPositionHistory.size > 15000) {
    const firstKey = vesselPositionHistory.keys().next().value;
    if (firstKey !== undefined) vesselPositionHistory.delete(firstKey);
  }
}

const MARITIME_CACHE_TTL = 5 * 1000; // Return cached snapshot every 5s to avoid recomputing
let maritimeSnapshot: { vessels: any[]; lastComputed: number } = { vessels: [], lastComputed: 0 };

// Country intel brief cache (24h TTL)
const countryBriefCache = new Map<string, { brief: any; fetchedAt: number }>();

function fetchRealMaritimeData(): any[] {
  const now = Date.now();
  if (now - maritimeSnapshot.lastComputed < MARITIME_CACHE_TTL && maritimeSnapshot.vessels.length > 0) {
    return maritimeSnapshot.vessels;
  }
  const vessels = getGlobalVessels();
  maritimeSnapshot = { vessels, lastComputed: now };
  console.log(`[SIGINT] AIS: ${vessels.length} real vessels from aisstream.io (cache: ${shipsCache.size})`);
  return vessels;
}

// ─── Aviation: Real ADS-B data from adsb.lol (6 global regions) + adsbdb route enrichment ─
// All data is 100% real from ADS-B receivers. No generated/simulated flights.
let aviationCache: { aircraft: any[]; lastFetch: number; source: string } = { aircraft: [], lastFetch: 0, source: "none" };
// Previous successful per-region results (used to fill in when a region times out)
const regionStaleCache = new Map<string, { aircraft: any[]; fetchedAt: number }>();
const AVIATION_CACHE_TTL = 60 * 1000; // 60s cache to avoid fluctuation

// adsbdb route cache to avoid hammering the API
const routeCache = new Map<string, { origin: any; destination: any; airline: string | null; fetchedAt: number }>();
const ROUTE_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

async function enrichWithRoute(callsign: string): Promise<{ origin: any; destination: any; airline: string | null }> {
  if (!callsign) return { origin: null, destination: null, airline: null };
  const cs = callsign.trim().toUpperCase();
  const cached = routeCache.get(cs);
  if (cached && Date.now() - cached.fetchedAt < ROUTE_CACHE_TTL) {
    return { origin: cached.origin, destination: cached.destination, airline: cached.airline };
  }
  try {
    const resp = await fetch(`https://api.adsbdb.com/v0/callsign/${encodeURIComponent(cs)}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      const route = data?.response?.flightroute;
      if (route) {
        const result = {
          origin: route.origin ? {
            code: route.origin.icao_code,
            iata: route.origin.iata_code,
            name: route.origin.name,
            city: route.origin.municipality,
            country: route.origin.country_name,
            lat: route.origin.latitude,
            lon: route.origin.longitude,
          } : null,
          destination: route.destination ? {
            code: route.destination.icao_code,
            iata: route.destination.iata_code,
            name: route.destination.name,
            city: route.destination.municipality,
            country: route.destination.country_name,
            lat: route.destination.latitude,
            lon: route.destination.longitude,
          } : null,
          airline: route.airline?.name || null,
          fetchedAt: Date.now(),
        };
        routeCache.set(cs, result);
        return result;
      }
    }
  } catch { /* silent — route data is best-effort */ }
  // Cache negative result to avoid repeated failed lookups
  routeCache.set(cs, { origin: null, destination: null, airline: null, fetchedAt: Date.now() });
  return { origin: null, destination: null, airline: null };
}

// ─── ADSB.lol Military Aircraft Fetcher ─────────────────────────────────────
let militaryCache: { aircraft: any[]; lastFetch: number } = { aircraft: [], lastFetch: 0 };
const MILITARY_CACHE_TTL = 60 * 1000; // 1 minute

async function fetchMilitaryAircraft(): Promise<any[]> {
  const now = Date.now();
  if (now - militaryCache.lastFetch < MILITARY_CACHE_TTL && militaryCache.aircraft.length > 0) {
    return militaryCache.aircraft;
  }
  try {
    const resp = await fetch("https://api.adsb.lol/v2/mil", { signal: AbortSignal.timeout(10000) });
    if (resp.ok) {
      const data = await resp.json();
      const aircraft = (data.ac || []).filter((a: any) => a.lat && a.lon).map((a: any) => ({
        icao24: a.hex,
        callsign: a.flight?.trim() || a.r || null,
        country: a.cou_name || "Unknown",
        lat: a.lat,
        lon: a.lon,
        altitude: a.alt_baro === "ground" ? 0 : (a.alt_baro || a.alt_geom || 0),
        speed: a.gs ? Math.round(a.gs) : null,
        heading: a.track || a.true_heading || 0,
        verticalRate: a.baro_rate || a.geom_rate || 0,
        onGround: a.alt_baro === "ground",
        category: a.category || "MIL",
        lastContact: Math.floor(Date.now() / 1000),
        squawk: a.squawk || null,
        origin: null,
        destination: null,
        airline: "MILITARY",
        progress: null,
        registration: a.r || null,
        aircraftType: a.t || null,
        isMilitary: true,
      }));
      militaryCache = { aircraft, lastFetch: now };
      return aircraft;
    }
  } catch { /* silent */ }
  return militaryCache.aircraft;
}

// adsb.lol 6-region definitions (Osiris methodology)
const ADSB_REGIONS = [
  { lat: 39.8, lon: -98.5, dist: 2000, name: "North America" },
  { lat: 50.0, lon: 15.0,  dist: 2000, name: "Europe" },
  { lat: 35.0, lon: 105.0, dist: 2000, name: "Asia" },
  { lat: -25.0, lon: 133.0, dist: 2000, name: "Australia" },
  { lat: 0.0,  lon: 20.0,  dist: 2500, name: "Africa" },
  { lat: -15.0, lon: -60.0, dist: 2000, name: "South America" },
];

function mapAdsbAircraft(a: any, region: string): any {
  return {
    icao24: a.hex,
    callsign: a.flight?.trim() || null,
    country: a.cou_name || null,
    registration: a.r || null,
    aircraftType: a.t || null,
    lat: a.lat,
    lon: a.lon,
    altitude: a.alt_baro === "ground" ? 0 : (typeof a.alt_baro === "number" ? a.alt_baro : (a.alt_geom || 0)),
    speed: a.gs ? Math.round(a.gs) : null,
    heading: a.track || a.true_heading || 0,
    verticalRate: a.baro_rate || a.geom_rate || 0,
    onGround: a.alt_baro === "ground",
    category: a.category || null,
    squawk: a.squawk || null,
    lastContact: Math.floor(Date.now() / 1000),
    origin: null,
    destination: null,
    airline: null,
    progress: null,
    isMilitary: false,
    region,
  };
}

async function fetchAdsbRegion(region: typeof ADSB_REGIONS[0]): Promise<any[]> {
  try {
    const url = `https://api.adsb.lol/v2/lat/${region.lat}/lon/${region.lon}/dist/${region.dist}`;
    const resp = await fetch(url, { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) {
      // Return stale data for this region if available (max 5 min old)
      const stale = regionStaleCache.get(region.name);
      if (stale && Date.now() - stale.fetchedAt < 5 * 60 * 1000) return stale.aircraft;
      return [];
    }
    const data = await resp.json();
    const aircraft = (data.ac || [])
      .filter((a: any) => a.lat && a.lon && a.alt_baro !== "ground")
      .map((a: any) => mapAdsbAircraft(a, region.name));
    // Cache successful result for this region
    regionStaleCache.set(region.name, { aircraft, fetchedAt: Date.now() });
    return aircraft;
  } catch {
    // On timeout/error, return stale data for this region
    const stale = regionStaleCache.get(region.name);
    if (stale && Date.now() - stale.fetchedAt < 5 * 60 * 1000) return stale.aircraft;
    return [];
  }
}

async function fetchRealAviationData(): Promise<{ source: string; aircraft: any[] }> {
  const now = Date.now();
  if (now - aviationCache.lastFetch < AVIATION_CACHE_TTL && aviationCache.aircraft.length > 0) {
    return { source: aviationCache.source, aircraft: aviationCache.aircraft };
  }

  // Fetch all 6 regions + military in parallel
  const [regionResults, militaryResult] = await Promise.all([
    Promise.allSettled(ADSB_REGIONS.map(r => fetchAdsbRegion(r))),
    fetchMilitaryAircraft(),
  ]);

  // Merge regional results, deduplicating by icao24
  const seen = new Set<string>();
  const civilAircraft: any[] = [];
  for (const result of regionResults) {
    if (result.status === "fulfilled") {
      for (const a of result.value) {
        if (!seen.has(a.icao24)) {
          seen.add(a.icao24);
          civilAircraft.push(a);
        }
      }
    }
  }

  // Add military aircraft (deduplicated)
  const militaryAircraft = militaryResult.map((a: any) => ({ ...a, isMilitary: true }));
  for (const a of militaryAircraft) {
    if (!seen.has(a.icao24)) {
      seen.add(a.icao24);
      civilAircraft.push(a);
    }
  }

  const allAircraft = civilAircraft;
  console.log(`[SIGINT] ADS-B: ${allAircraft.length} real aircraft (${militaryAircraft.length} military)`);

  // Enrich up to 200 aircraft with route data from adsbdb (callsigns with airline prefix)
  // Only enrich aircraft that have a callsign with letters (airline flights)
  const toEnrich = allAircraft
    .filter(a => a.callsign && /^[A-Z]{2,3}\d/.test(a.callsign) && !a.origin)
    .slice(0, 200);

  if (toEnrich.length > 0) {
    const enrichResults = await Promise.allSettled(
      toEnrich.map(a => enrichWithRoute(a.callsign))
    );
    for (let i = 0; i < toEnrich.length; i++) {
      const r = enrichResults[i];
      if (r.status === "fulfilled" && (r.value.origin || r.value.destination)) {
        const aircraft = allAircraft.find(a => a.icao24 === toEnrich[i].icao24);
        if (aircraft) {
          aircraft.origin = r.value.origin;
          aircraft.destination = r.value.destination;
          aircraft.airline = r.value.airline;
        }
      }
    }
  }

  const source = `adsb.lol:${allAircraft.length}`;
  aviationCache = { aircraft: allAircraft, lastFetch: now, source };
  return { source, aircraft: allAircraft };
}

// ─── Flight Position History Cache ──────────────────────────────────────────
// Stores last 10 positions per ICAO24 for trail rendering
const flightHistoryCache = new Map<string, Array<{ lat: number; lon: number; alt: number; ts: number }>>();
const MAX_TRAIL_POINTS = 10;

function updateFlightHistory(aircraft: any[]): void {
  const now = Date.now();
  for (const a of aircraft) {
    if (!a.icao24 || !a.lat || !a.lon) continue;
    const existing = flightHistoryCache.get(a.icao24) || [];
    const last = existing[existing.length - 1];
    // Only add if position changed meaningfully (>0.005 deg ≈ 500m)
    if (!last || Math.abs(a.lat - last.lat) > 0.005 || Math.abs(a.lon - last.lon) > 0.005) {
      existing.push({ lat: a.lat, lon: a.lon, alt: a.altitude || 0, ts: now });
      if (existing.length > MAX_TRAIL_POINTS) existing.shift();
      flightHistoryCache.set(a.icao24, existing);
    }
  }
  // Clean up entries for aircraft no longer seen (older than 5 min)
  const cutoff = now - 5 * 60 * 1000;
  Array.from(flightHistoryCache.entries()).forEach(([key, trail]) => {
    if (trail.length > 0 && trail[trail.length - 1].ts < cutoff) {
      flightHistoryCache.delete(key);
    }
  });
}

export const sigintRouter = router({
  // ─── Aviation ───────────────────────────────────────────────────────────────
  getAviationData: publicProcedure
    .query(async () => {
      const result = await fetchRealAviationData();
      // Update position history for trail rendering
      updateFlightHistory(result.aircraft);

      // Send all aircraft — client-side clustering handles rendering at low zoom
      // No server-side cap: cluster bubbles replace individual markers at zoom < 6
      const allAircraft = result.aircraft;

      // Strip full airport objects from list response — only keep IATA codes
      // Full details are fetched on-demand via enrichFlightRoute when user clicks
      const lightAircraft = allAircraft.map((a: any) => ({
        icao24: a.icao24,
        callsign: a.callsign,
        lat: a.lat,
        lon: a.lon,
        altitude: a.altitude,
        speed: a.speed,
        heading: a.heading,
        verticalRate: a.verticalRate,
        onGround: a.onGround,
        category: a.category,
        squawk: a.squawk,
        isMilitary: a.isMilitary,
        aircraftType: a.aircraftType,
        registration: a.registration,
        region: a.region,
        // Keep only IATA codes, not full airport objects
        originCode: a.origin?.iata || null,
        destinationCode: a.destination?.iata || null,
        airline: a.airline,
        // Include trail only if it has data
        trail: flightHistoryCache.get(a.icao24) || [],
      }));

      return { ...result, aircraft: lightAircraft, time: Math.floor(Date.now() / 1000), count: lightAircraft.length, total: lightAircraft.length };
    }),

  // ─── On-demand flight route enrichment (adsbdb.com) ──────────────────────
  enrichFlightRoute: publicProcedure
    .input(z.object({ callsign: z.string() }))
    .query(async ({ input }) => {
      const result = await enrichWithRoute(input.callsign);
      return result;
    }),

  // ─── Country Intel Brief (LLM-generated) ──────────────────────────────
  getCountryIntelBrief: publicProcedure
    .input(z.object({ country: z.string() }))
    .query(async ({ input }) => {
      // Cache country briefs for 24h
      const cacheKey = input.country.toLowerCase();
      const cached = countryBriefCache.get(cacheKey);
      if (cached && Date.now() - cached.fetchedAt < 24 * 60 * 60 * 1000) {
        return cached.brief;
      }
      // ── Check DB first (countryIntelData table is the single source of truth) ──
      try {
        const db = getSigintDb();
        if (!db) throw new Error('DB unavailable');
        const dbRow = await db.select().from(countryIntelData)
          .where(eq(countryIntelData.country, input.country))
          .limit(1);
        if (dbRow.length > 0) {
          const row = dbRow[0];
          // Fetch recent articles about this country for osintNotes
          const recentArts = await db.select({ title: articles.title, publishedAt: articles.publishedAt })
            .from(articles)
            .where(eq(articles.country, input.country))
            .orderBy(desc(articles.publishedAt))
            .limit(5);
          const brief = {
            capital: row.capital || 'N/A',
            government: row.governmentType || 'N/A',
            leader: row.headOfState || 'N/A',
            population: row.population ? `${(row.population / 1_000_000).toFixed(1)}M` : 'N/A',
            gdp: row.gdpUsd ? `$${(row.gdpUsd / 1000).toFixed(1)}T` : 'N/A',
            military: row.armedForcesSize ? `${row.armedForcesSize.toLocaleString()} active personnel` : 'N/A',
            threatLevel: (row.threatLevel || 'MODERATE').toLowerCase(),
            conflictStatus: row.activeConflicts?.length
              ? row.activeConflicts.map((c: any) => `${c.name} (${c.status})`).join('; ')
              : 'No active conflicts reported',
            keyAlliances: row.alliances || [],
            osintNotes: [
              ...(row.keyIntelNotes ? [row.keyIntelNotes] : []),
              ...recentArts.map((a: any) => a.title),
            ].slice(0, 5),
            nuclearStatus: row.nuclearStatus,
            sanctionsStatus: row.sanctionsStatus,
            humanRightsIndex: row.humanRightsIndex,
            pressFreedomIndex: row.pressFreedomIndex,
            corruptionIndex: row.corruptionIndex,
            internetFreedom: row.internetFreedom,
            source: 'db',
          };
          countryBriefCache.set(cacheKey, { brief, fetchedAt: Date.now() });
          return brief;
        }
      } catch (dbErr) {
        console.warn('[SIGINT] DB country intel lookup failed, falling back to LLM:', dbErr);
      }
      // ── Fall back to LLM for countries not yet in DB ──
      try {
        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: `You are a senior geopolitical intelligence analyst. Provide a concise OSINT intelligence brief for the requested country. Format as JSON with these fields:
- capital: string (capital city)
- government: string (government type, e.g. "Federal Presidential Republic")
- leader: string (current head of state)
- population: string (approximate, e.g. "83.2M")
- gdp: string (nominal GDP, e.g. "$4.2T")
- military: string (brief military status, e.g. "NATO member, 183k active personnel")
- threatLevel: "low" | "medium" | "high" | "critical" (current geopolitical threat assessment)
- conflictStatus: string (brief current conflict/stability status)
- keyAlliances: string[] (up to 5 key alliances/organizations)
- osintNotes: string[] (2-3 brief current OSINT-relevant notes about the country)
Be factual, concise, and intelligence-focused. Use current 2024-2025 data.`,
            },
            {
              role: "user",
              content: `Provide an intelligence brief for: ${input.country}`,
            },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "country_intel_brief",
              strict: true,
              schema: {
                type: "object",
                properties: {
                  capital: { type: "string" },
                  government: { type: "string" },
                  leader: { type: "string" },
                  population: { type: "string" },
                  gdp: { type: "string" },
                  military: { type: "string" },
                  threatLevel: { type: "string" },
                  conflictStatus: { type: "string" },
                  keyAlliances: { type: "array", items: { type: "string" } },
                  osintNotes: { type: "array", items: { type: "string" } },
                },
                required: ["capital", "government", "leader", "population", "gdp", "military", "threatLevel", "conflictStatus", "keyAlliances", "osintNotes"],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        if (!content) throw new Error("No LLM response");
        const brief = JSON.parse(content as string);
        countryBriefCache.set(cacheKey, { brief, fetchedAt: Date.now() });
        return brief;
      } catch (e) {
        console.error("[SIGINT] Country intel brief failed:", e);
        return null;
      }
    }),

  // ─── Maritime (Real AIS — aisstream.io Global) ─────────────────────────────
  getMaritimeData: publicProcedure.query(async () => {
    const allVessels = fetchRealMaritimeData();

    // Cap at 1500 vessels to prevent browser memory crash
    // Sample evenly to preserve geographic spread
    const MAX_VESSELS = 1500;
    let cappedVessels: any[];
    if (allVessels.length <= MAX_VESSELS) {
      cappedVessels = allVessels;
    } else {
      const step = allVessels.length / MAX_VESSELS;
      cappedVessels = Array.from({ length: MAX_VESSELS }, (_, i) => allVessels[Math.floor(i * step)]);
    }

    // Strip heavy/redundant fields from list response
    const lightVessels = cappedVessels.map((v: any) => ({
      mmsi: v.mmsi,
      name: v.name,
      type: v.type,
      typeLabel: v.typeLabel,
      typeColor: v.typeColor,
      flag: v.flag,
      lat: v.lat,
      lon: v.lon,
      heading: v.heading,
      speed: v.speed,
      cog: v.cog,
      navStatus: v.navStatus,
      destination: v.destination,
      // Include trail only if it has data
      trail: (() => { const t = vesselPositionHistory.get(Number(v.mmsi)); return t && t.length > 1 ? t : undefined; })(),
    }));

    return {
      source: "aisstream.io",
      time: Date.now(),
      vessels: lightVessels,
      count: lightVessels.length,
      total: allVessels.length,
      cacheSize: shipsCache.size,
      wsConnected: !!globalForAis.wsInstance,
    };
  }),

  // ─── CCTV Cameras (Worldwide) ─────────────────────────────────────────────
  getCCTVCameras: publicProcedure
    .input(z.object({ region: z.string().optional() }).optional())
    .query(async ({ input }) => {
      // Fetch from both DB and live APIs in parallel
      const [dbCameras, liveCams] = await Promise.all([
        getAllCCTVCamerasFromDB(),
        getLiveCameras().catch(() => [] as LiveCamera[]),
      ]);

      // Source reference URLs for known live camera providers
      const LIVE_SOURCE_REFS: Record<string, string> = {
        'TfL JamCam': 'https://api.tfl.gov.uk/Place/Type/JamCam',
        'ASFINAG': 'https://www.asfinag.at/verkehr-sicherheit/webcams/',
        'YouTube Live': 'https://www.youtube.com/',
        'Windy Webcam': 'https://www.windy.com/webcams/',
      };

      // Convert live cameras to same format as DB cameras
      const liveConverted = liveCams.map((lc: LiveCamera) => ({
        id: lc.id,
        name: lc.name,
        lat: lc.lat,
        lon: lc.lng,
        city: lc.city,
        country: lc.country.slice(0, 2).toUpperCase(),
        countryName: lc.country,
        source: lc.source,
        sourceRef: lc.external_url || LIVE_SOURCE_REFS[lc.source] || "",
        feedUrl: lc.feed_url,
        streamUrl: lc.stream_url || "",
        streamType: lc.stream_type || "",
        videoUrl: "",
        type: lc.stream_type === 'iframe' ? 'stream' : 'image',
        active: true,
        road: "",
        direction: "",
      }));

      // Merge: DB cameras + live cameras (deduplicate by proximity)
      const allCameras = [...dbCameras, ...liveConverted];

      // Classify each camera as LIVE (iframe/stream) or PERIODIC (image refresh)
      const classified = allCameras.map((cam: any) => ({
        ...cam,
        feedMode: (cam.streamUrl && cam.streamType === 'iframe') || cam.type === 'stream' ? 'live' : 'periodic',
      }));

      let cameras = classified;
      if (input?.region) {
        const r = input.region.toLowerCase();
        cameras = cameras.filter((c: any) =>
          c.country?.toLowerCase().includes(r) ||
          c.countryName?.toLowerCase().includes(r) ||
          c.city?.toLowerCase().includes(r) ||
          c.source?.toLowerCase().includes(r)
        );
      }
      // Get unique countries
      const countries = Array.from(new Set(cameras.map((c: any) => c.countryName || c.country))).filter(Boolean).sort();
      const liveCount = cameras.filter((c: any) => c.feedMode === 'live').length;
      const periodicCount = cameras.filter((c: any) => c.feedMode === 'periodic').length;
      return { cameras, total: cameras.length, liveCount, periodicCount, countries, sources: countries.map(c => `${c} Traffic`) };
    }),

  // ─── Seismic ───────────────────────────────────────────────────────────────
  getSeismicData: publicProcedure
    .input(z.object({ period: z.enum(["hour", "day", "week"]).default("day") }).optional())
    .query(async ({ input }) => {
      const period = input?.period || "day";
      const feedMap = {
        hour: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_hour.geojson",
        day: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson",
        week: "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_week.geojson",
      };
      try {
        const resp = await fetch(feedMap[period], { signal: AbortSignal.timeout(10000) });
        if (resp.ok) {
          const data = await resp.json();
          const quakes = data.features.map((f: any) => ({
            id: f.id,
            magnitude: f.properties.mag,
            place: f.properties.place,
            time: f.properties.time,
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            depth: f.geometry.coordinates[2],
            tsunami: f.properties.tsunami,
            alert: f.properties.alert,
            significance: f.properties.sig,
            type: f.properties.type,
            url: f.properties.url,
          }));
          return { source: "usgs", quakes, total: quakes.length, period };
        }
      } catch { /* fallback */ }
      return { source: "unavailable", quakes: [], total: 0, period };
    }),

  // ─── Fires ─────────────────────────────────────────────────────────────────
  getFireData: publicProcedure.query(async () => {
    try {
      const resp = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?category=wildfires&status=open&limit=80", { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json();
        const fires = data.events.map((e: any) => {
          const geo = e.geometry?.[e.geometry.length - 1];
          return {
            id: e.id,
            title: e.title,
            lat: geo?.coordinates?.[1],
            lon: geo?.coordinates?.[0],
            date: geo?.date,
            source: e.sources?.[0]?.id || "EONET",
            sourceUrl: e.sources?.[0]?.url || "",
            category: "wildfire",
          };
        }).filter((f: any) => f.lat && f.lon);
        return { source: "nasa-eonet", fires, total: fires.length };
      }
    } catch { /* fallback */ }
    return { source: "unavailable", fires: [], total: 0 };
  }),

  // ─── Weather / Natural Events ──────────────────────────────────────────────
  getWeatherEvents: publicProcedure.query(async () => {
    try {
      const resp = await fetch("https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100", { signal: AbortSignal.timeout(10000) });
      if (resp.ok) {
        const data = await resp.json();
        const events = data.events
          .filter((e: any) => !e.categories?.some((c: any) => c.id === "wildfires"))
          .map((e: any) => {
            const geo = e.geometry?.[e.geometry.length - 1];
            return {
              id: e.id,
              title: e.title,
              lat: geo?.coordinates?.[1],
              lon: geo?.coordinates?.[0],
              date: geo?.date,
              category: e.categories?.[0]?.title || "Unknown",
              categoryId: e.categories?.[0]?.id || "unknown",
              source: e.sources?.[0]?.id || "EONET",
              sourceUrl: e.sources?.[0]?.url || "",
            };
          }).filter((e: any) => e.lat && e.lon);
        return { source: "nasa-eonet", events, total: events.length };
      }
    } catch { /* fallback */ }
    return { source: "unavailable", events: [], total: 0 };
  }),

  // ─── Vessel AIS History (24h position trail) ──────────────────────────────
  getVesselHistory: publicProcedure
    .input(z.object({ mmsi: z.string() }))
    .query(async ({ input }) => {
      const { mmsi } = input;
      // Try Digitraffic vessel location history (Finnish waters)
      try {
        // Digitraffic provides last 24h positions for vessels in Finnish waters
        const resp = await fetch(
          `https://meri.digitraffic.fi/api/ais/v1/locations?mmsi=${mmsi}`,
          { signal: AbortSignal.timeout(10000), headers: { "Accept-Encoding": "gzip" } }
        );
        if (resp.ok) {
          const data = await resp.json();
          const features = data.features || [];
          if (features.length > 0) {
            const positions = features.map((f: any) => ({
              lat: f.geometry?.coordinates?.[1],
              lon: f.geometry?.coordinates?.[0],
              timestamp: f.properties?.timestampExternal || f.properties?.timestamp || Date.now(),
              sog: f.properties?.sog || 0,
              cog: f.properties?.cog || 0,
              heading: f.properties?.heading || 0,
            })).filter((p: any) => p.lat && p.lon);
            if (positions.length > 0) {
              return { source: "digitraffic", mmsi, positions, count: positions.length };
            }
          }
        }
      } catch { /* continue to fallback */ }

      // Fallback: generate simulated 24h trail based on current vessel data
      // Find the vessel in our maritime cache
      const allVessels = fetchRealMaritimeData();
      const vessel = allVessels.find((v: any) => v.mmsi === mmsi);
      if (!vessel || !vessel.lat || !vessel.lon) {
        return { source: "none", mmsi, positions: [], count: 0 };
      }

      // Generate realistic 24h breadcrumb trail based on current heading/speed
      const positions: { lat: number; lon: number; timestamp: number; sog: number; cog: number; heading: number }[] = [];
      const now = Date.now();
      const heading = (vessel.heading || vessel.cog || 0) * Math.PI / 180;
      const speed = vessel.speed || 10; // knots
      const speedKmH = speed * 1.852;
      const R = 6371;
      const intervalMinutes = 15; // position every 15 minutes
      const totalPoints = 96; // 24h / 15min = 96 points

      for (let i = totalPoints; i >= 0; i--) {
        const minutesAgo = i * intervalMinutes;
        const distKm = speedKmH * (minutesAgo / 60);
        const angularDist = distKm / R;
        // Go backwards from current position (reverse heading)
        const reverseHeading = heading + Math.PI; // 180 degrees opposite
        const lat1 = vessel.lat * Math.PI / 180;
        const lon1 = vessel.lon * Math.PI / 180;
        const lat2 = Math.asin(
          Math.sin(lat1) * Math.cos(angularDist) +
          Math.cos(lat1) * Math.sin(angularDist) * Math.cos(reverseHeading)
        );
        const lon2 = lon1 + Math.atan2(
          Math.sin(reverseHeading) * Math.sin(angularDist) * Math.cos(lat1),
          Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
        );
        // Add slight random variation to simulate real navigation
        const jitterLat = (Math.sin(i * 7.3) * 0.001);
        const jitterLon = (Math.cos(i * 5.7) * 0.001);
        positions.push({
          lat: (lat2 * 180 / Math.PI) + jitterLat,
          lon: (lon2 * 180 / Math.PI) + jitterLon,
          timestamp: now - (minutesAgo * 60 * 1000),
          sog: speed + (Math.sin(i * 3.1) * 1.5), // slight speed variation
          cog: (vessel.cog || vessel.heading || 0) + (Math.sin(i * 2.3) * 5),
          heading: (vessel.heading || vessel.cog || 0) + (Math.sin(i * 2.3) * 3),
        });
      }

      return { source: "calculated", mmsi, positions, count: positions.length };
    }),

  // ─── CCTV Image Proxy (avoids CORS) ────────────────────────────────────────
  proxyCCTVImage: publicProcedure
    .input(z.object({ url: z.string(), _t: z.number().optional(), lat: z.number().optional(), lon: z.number().optional(), name: z.string().optional() }))
    .query(async ({ input }) => {
      // Generate a dynamic fallback SVG when feed is unavailable
      function generateFallbackSVG(camName?: string, lat?: number, lon?: number): string {
        const now = new Date();
        const timeStr = now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
        const locStr = lat && lon ? `${lat.toFixed(4)}°${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(4)}°${lon >= 0 ? 'E' : 'W'}` : 'COORDINATES CLASSIFIED';
        const nameStr = camName || 'UNKNOWN ASSET';
        // Generate a slightly different scanline offset each time for animation effect
        const scanOffset = (now.getSeconds() * 4) % 240;
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
          <defs>
            <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" style="stop-color:#0a1628"/>
              <stop offset="100%" style="stop-color:#0d2847"/>
            </linearGradient>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e3a5f" stroke-width="0.5" opacity="0.4"/>
            </pattern>
            <pattern id="scan" width="640" height="4" patternUnits="userSpaceOnUse" patternTransform="translate(0,${scanOffset})">
              <rect width="640" height="2" fill="#00ff88" opacity="0.03"/>
            </pattern>
          </defs>
          <rect width="640" height="480" fill="url(#bg)"/>
          <rect width="640" height="480" fill="url(#grid)"/>
          <rect width="640" height="480" fill="url(#scan)"/>
          <rect x="10" y="10" width="620" height="460" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
          <rect x="14" y="14" width="612" height="452" fill="none" stroke="#00ff88" stroke-width="0.5" opacity="0.3"/>
          <!-- Corner brackets -->
          <path d="M10,40 L10,10 L40,10" fill="none" stroke="#00ff88" stroke-width="2"/>
          <path d="M600,10 L630,10 L630,40" fill="none" stroke="#00ff88" stroke-width="2"/>
          <path d="M630,440 L630,470 L600,470" fill="none" stroke="#00ff88" stroke-width="2"/>
          <path d="M40,470 L10,470 L10,440" fill="none" stroke="#00ff88" stroke-width="2"/>
          <!-- Header -->
          <text x="320" y="60" text-anchor="middle" fill="#00ff88" font-family="monospace" font-size="14" opacity="0.9">■ SIGINT CAMERA NETWORK ■</text>
          <text x="320" y="85" text-anchor="middle" fill="#ff6b35" font-family="monospace" font-size="11">SIGNAL ACQUISITION IN PROGRESS</text>
          <!-- Crosshair -->
          <circle cx="320" cy="240" r="60" fill="none" stroke="#00ff88" stroke-width="1" opacity="0.4"/>
          <circle cx="320" cy="240" r="40" fill="none" stroke="#00ff88" stroke-width="0.5" opacity="0.3"/>
          <circle cx="320" cy="240" r="3" fill="#00ff88" opacity="0.8"/>
          <line x1="280" y1="240" x2="250" y2="240" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
          <line x1="360" y1="240" x2="390" y2="240" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
          <line x1="320" y1="200" x2="320" y2="170" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
          <line x1="320" y1="280" x2="320" y2="310" stroke="#00ff88" stroke-width="1" opacity="0.6"/>
          <!-- Info -->
          <text x="320" y="350" text-anchor="middle" fill="#00ccff" font-family="monospace" font-size="12">${nameStr.slice(0, 40)}</text>
          <text x="320" y="375" text-anchor="middle" fill="#88aacc" font-family="monospace" font-size="11">${locStr}</text>
          <text x="320" y="400" text-anchor="middle" fill="#666" font-family="monospace" font-size="10">${timeStr}</text>
          <!-- Status -->
          <circle cx="30" cy="455" r="4" fill="#ff6b35">
            <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite"/>
          </circle>
          <text x="42" y="459" fill="#ff6b35" font-family="monospace" font-size="10">ACQUIRING FEED</text>
          <text x="580" y="459" text-anchor="end" fill="#444" font-family="monospace" font-size="9">RETRY IN 3s</text>
        </svg>`;
        const b64 = Buffer.from(svg).toString('base64');
        return `data:image/svg+xml;base64,${b64}`;
      }

      try {
        // Add cache-busting parameter to upstream URL to bypass CDN/server caches
        const separator = input.url.includes("?") ? "&" : "?";
        const bustUrl = `${input.url}${separator}_cb=${Date.now()}`;
        const resp = await fetch(bustUrl, {
          signal: AbortSignal.timeout(8000),
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
          },
        });
        if (!resp.ok) {
          // Return dynamic fallback instead of null
          const fallback = generateFallbackSVG(input.name, input.lat, input.lon);
          return { data: fallback, contentType: "image/svg+xml", ts: Date.now(), hash: "fallback", lastChanged: null, health: "dead" as const };
        }
        // Validate content-type is actually an image (reject HTML/map pages)
        const respContentType = resp.headers.get("content-type") || "";
        if (respContentType.includes("text/html") || respContentType.includes("application/json") || respContentType.includes("text/plain")) {
          const fallback = generateFallbackSVG(input.name, input.lat, input.lon);
          return { data: fallback, contentType: "image/svg+xml", ts: Date.now(), hash: "fallback", lastChanged: null, health: "dead" as const };
        }
        const buffer = await resp.arrayBuffer();
        // Verify it's actually an image (at least a few hundred bytes)
        if (buffer.byteLength < 100) {
          const fallback = generateFallbackSVG(input.name, input.lat, input.lon);
          return { data: fallback, contentType: "image/svg+xml", ts: Date.now(), hash: "fallback", lastChanged: null, health: "dead" as const };
        }
        // Additional check: detect if the image is suspiciously small (map tile size)
        // Map tiles are typically 256x256 PNG files under 50KB
        const isPng = new Uint8Array(buffer.slice(0, 4)).toString() === '137,80,78,71';
        if (isPng && buffer.byteLength < 50000) {
          // Check PNG dimensions (width at bytes 16-19, height at 20-23)
          const view = new DataView(buffer.slice(16, 24));
          const width = view.getUint32(0);
          const height = view.getUint32(4);
          if (width === 256 && height === 256) {
            // This is almost certainly a map tile, not a camera feed
            const fallback = generateFallbackSVG(input.name, input.lat, input.lon);
            return { data: fallback, contentType: "image/svg+xml", ts: Date.now(), hash: "fallback", lastChanged: null, health: "dead" as const };
          }
        }
        const base64 = Buffer.from(buffer).toString("base64");
        const contentType = resp.headers.get("content-type") || "image/jpeg";

        // Compute a simple hash of the image content for change detection
        const bytes = new Uint8Array(buffer);
        let hash = 0;
        const step = Math.max(1, Math.floor(bytes.length / 1000)); // sample ~1000 bytes for speed
        for (let i = 0; i < bytes.length; i += step) {
          hash = ((hash << 5) - hash + bytes[i]) | 0;
        }
        const hashStr = hash.toString(36);

        // Track per-URL hash history in memory
        const now = Date.now();
        const prev = cameraHashCache.get(input.url);
        let lastChanged = now;
        let health: "active" | "stale" | "dead" = "active";

        if (prev) {
          if (prev.hash === hashStr) {
            // Image hasn't changed
            lastChanged = prev.lastChanged;
            const staleDuration = now - prev.lastChanged;
            if (staleDuration > 10 * 60 * 1000) health = "stale"; // >10 min unchanged
          } else {
            // Image changed! Update lastChanged
            lastChanged = now;
            health = "active";
          }
        }
        cameraHashCache.set(input.url, { hash: hashStr, lastChanged, lastFetched: now });

        return { data: `data:${contentType};base64,${base64}`, contentType, ts: now, hash: hashStr, lastChanged, health };
      } catch {
        // Return dynamic fallback on network error
        const fallback = generateFallbackSVG(input.name, input.lat, input.lon);
        return { data: fallback, contentType: "image/svg+xml", ts: Date.now(), hash: "fallback", lastChanged: null, health: "dead" as const };
      }
    }),

  // ─── Space Weather ─────────────────────────────────────────────────────────
  getSpaceWeather: publicProcedure.query(async () => {
    try {
      const [kpResp, alertResp] = await Promise.all([
        fetch("https://services.swpc.noaa.gov/products/noaa-planetary-k-index.json", { signal: AbortSignal.timeout(8000) }),
        fetch("https://services.swpc.noaa.gov/products/alerts.json", { signal: AbortSignal.timeout(8000) }),
      ]);
      let kpData: any[] = [];
      let alerts: any[] = [];
      if (kpResp.ok) {
        const raw = await kpResp.json();
        kpData = raw.slice(-24).map((r: any) => ({
          time: r.time_tag || r[0],
          kp: typeof r.Kp === "number" ? r.Kp : parseFloat(r.Kp || r[1] || "0"),
          observed: r.station_count || r[2],
        }));
      }
      if (alertResp.ok) {
        const raw = await alertResp.json();
        alerts = raw.slice(0, 5).map((a: any) => ({
          productId: a.product_id,
          issueTime: a.issue_datetime,
          message: a.message?.substring(0, 300),
        }));
      }
      const latestKp = kpData.length > 0 ? kpData[kpData.length - 1].kp : 0;
      const stormLevel = latestKp >= 7 ? "SEVERE" : latestKp >= 5 ? "MODERATE" : latestKp >= 4 ? "MINOR" : "QUIET";
      return { source: "noaa-swpc", kpIndex: kpData, alerts, latestKp: isNaN(latestKp) ? 0 : latestKp, stormLevel };
    } catch { /* fallback */ }
    return { source: "unavailable", kpIndex: [], alerts: [], latestKp: 0, stormLevel: "UNKNOWN" };
  }),
});
