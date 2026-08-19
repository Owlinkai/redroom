import { z } from "zod";
import { router, publicProcedure } from "../_core/trpc";
// @ts-ignore
import * as satellite from "satellite.js";
import {
  getAllSatellites,
  getSatellitesByCategory,
  getSatelliteByNoradId,
  searchSatellitesInDb,
  getSatelliteCategories,
} from "../db";
import type { Satellite } from "../../drizzle/schema";

// ─── Category metadata (display config only — not satellite data) ──────────────
const CATEGORY_META: Record<string, {
  label: string; color: string; orbitType: "LEO" | "MEO" | "GEO" | "HEO" | "MIXED";
  description: string;
}> = {
  "stations":  { label: "Space Stations", color: "#00ff88", orbitType: "LEO",   description: "Crewed and uncrewed orbital laboratories" },
  "gps":       { label: "GPS / BeiDou",   color: "#f59e0b", orbitType: "MEO",   description: "US GPS and Chinese BeiDou navigation constellations" },
  "glonass":   { label: "GLONASS",        color: "#a78bfa", orbitType: "MEO",   description: "Russian Global Navigation Satellite System" },
  "weather":   { label: "Weather",        color: "#22d3ee", orbitType: "MIXED", description: "Meteorological and environmental monitoring satellites" },
  "science":   { label: "Earth Science",  color: "#84cc16", orbitType: "MIXED", description: "Scientific research and Earth observation missions" },
  "starlink":  { label: "Starlink",       color: "#60a5fa", orbitType: "LEO",   description: "SpaceX broadband internet constellation" },
  "oneweb":    { label: "OneWeb",         color: "#e879f9", orbitType: "LEO",   description: "OneWeb broadband satellite constellation" },
  "iridium":   { label: "Iridium NEXT",   color: "#fbbf24", orbitType: "LEO",   description: "Iridium NEXT global communications constellation" },
  "military":  { label: "Military",       color: "#ef4444", orbitType: "MIXED", description: "Defense and intelligence satellites (DMSP, WGS, AEHF)" },
  "beidou":    { label: "BeiDou",          color: "#f97316", orbitType: "MEO",   description: "Chinese BeiDou-3 navigation satellite system (MEO/GEO/IGSO)" },
  "galileo":   { label: "Galileo",         color: "#06b6d4", orbitType: "MEO",   description: "European Galileo global navigation satellite system" },
  "eo":        { label: "Earth Obs.",      color: "#10b981", orbitType: "LEO",   description: "Commercial and civil Earth observation satellites (Sentinel, WorldView, ICEYE)" },
  "reconnaissance": { label: "Reconnaissance", color: "#dc2626", orbitType: "LEO", description: "Acknowledged reconnaissance and intelligence satellites" },
};

// ─── Mission imagery (supplemental — not stored in DB to keep it lean) ────────
const MISSION_IMAGES: Record<string, string> = {
  "ISS (ZARYA)": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/International_Space_Station_after_undocking_of_STS-132.jpg/1280px-International_Space_Station_after_undocking_of_STS-132.jpg",
  "ISS (NAUKA)": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/04/International_Space_Station_after_undocking_of_STS-132.jpg/1280px-International_Space_Station_after_undocking_of_STS-132.jpg",
  "CSS (TIANHE-1)": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4d/China_Space_Station_render.jpg/1280px-China_Space_Station_render.jpg",
  "NOAA 19": "https://upload.wikimedia.org/wikipedia/commons/thumb/1/1e/NOAA-N_Prime_satellite.jpg/1280px-NOAA-N_Prime_satellite.jpg",
  "GOES 16": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/GOES-16_Full_Disk_View_of_Earth.jpg/1280px-GOES-16_Full_Disk_View_of_Earth.jpg",
  "AQUA": "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6e/Aqua_spacecraft_model.png/1280px-Aqua_spacecraft_model.png",
  "HUBBLE 6": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/HST-SM4.jpeg/1280px-HST-SM4.jpeg",
  "HUBBLE 7": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/HST-SM4.jpeg/1280px-HST-SM4.jpeg",
  "LANDSAT 8": "https://upload.wikimedia.org/wikipedia/commons/thumb/0/0e/Landsat_8_scene.jpg/1280px-Landsat_8_scene.jpg",
  "TERRA SAR X": "https://upload.wikimedia.org/wikipedia/commons/thumb/e/e2/TerraSAR-X_satellite.jpg/1280px-TerraSAR-X_satellite.jpg",
};

// ─── Propagation helper ────────────────────────────────────────────────────────
interface SatPosition {
  noradId: number; name: string;
  lat: number; lon: number; altKm: number;
  speedKms: number; inclination: number;
  tle1: string; tle2: string;
  country: string | null; operator: string | null;
  launchDate: string | null; launchSite: string | null;
  missionDescription: string | null; cost: string | null;
  type: string | null; imageUrl: string | null;
  category: string;
  period: number | null; eccentricity: number | null;
}

function propagateSatellite(sat: Satellite, date: Date): SatPosition | null {
  try {
    const satrec = satellite.twoline2satrec(sat.tle1, sat.tle2);
    const posVel = satellite.propagate(satrec, date) as any;
    if (!posVel || !posVel.position || typeof posVel.position === "boolean") return null;
    const gmst = satellite.gstime(date);
    const geo = satellite.eciToGeodetic(posVel.position, gmst);
    const lat = satellite.degreesLat(geo.latitude);
    const lon = satellite.degreesLong(geo.longitude);
    const altKm = geo.height;
    if (isNaN(lat) || isNaN(lon) || isNaN(altKm)) return null;
    const vel = posVel.velocity as { x: number; y: number; z: number };
    const speedKms = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);
    return {
      noradId: sat.noradId,
      name: sat.name,
      lat, lon, altKm, speedKms,
      inclination: sat.inclination ?? (parseFloat(sat.tle2.substring(8, 16).trim()) || 0),
      tle1: sat.tle1, tle2: sat.tle2,
      country: sat.country ?? null,
      operator: sat.operator ?? null,
      launchDate: sat.launchDate ?? null,
      launchSite: sat.launchSite ?? null,
      missionDescription: sat.missionDescription ?? null,
      cost: null,
      type: sat.objectType ?? null,
      imageUrl: MISSION_IMAGES[sat.name] ?? null,
      category: sat.category ?? "unknown",
      period: sat.period ?? null,
      eccentricity: sat.eccentricity ?? null,
    };
  } catch { return null; }
}

// ─── Orbit router ─────────────────────────────────────────────────────────────
export const orbitRouter = router({

  // List all categories with live counts from DB
  getCategories: publicProcedure.query(async () => {
    const dbCounts = await getSatelliteCategories();
    const countMap = Object.fromEntries(dbCounts.map(r => [r.category, r.count]));
    return Object.entries(CATEGORY_META).map(([key, val]) => ({
      key, label: val.label, color: val.color,
      orbitType: val.orbitType, description: val.description,
      count: countMap[key] ?? 0,
    }));
  }),

  // Get real-time satellite positions for a category (reads from DB, propagates with satellite.js)
  getLivePositions: publicProcedure
    .input(z.object({ group: z.string(), timestamp: z.number().optional() }))
    .query(async ({ input }) => {
      const meta = CATEGORY_META[input.group];
      if (!meta) throw new Error(`Unknown group: ${input.group}`);
      const sats = await getSatellitesByCategory(input.group);
      const date = input.timestamp ? new Date(input.timestamp) : new Date();
      const positions: SatPosition[] = [];
      for (const sat of sats) {
        const pos = propagateSatellite(sat, date);
        if (pos) positions.push(pos);
      }
      return {
        group: input.group, label: meta.label, color: meta.color,
        satellites: positions, timestamp: date.getTime(),
      };
    }),

  // Get all categories' positions in one call (reads all from DB)
  getAllPositions: publicProcedure
    .input(z.object({ groups: z.array(z.string()), timestamp: z.number().optional() }))
    .query(async ({ input }) => {
      const date = input.timestamp ? new Date(input.timestamp) : new Date();
      const allSats = await getAllSatellites();
      const filtered = input.groups.length > 0
        ? allSats.filter(s => s.category && input.groups.includes(s.category))
        : allSats;
      const positions: SatPosition[] = [];
      for (const sat of filtered) {
        const pos = propagateSatellite(sat, date);
        if (pos) positions.push(pos);
      }
      return { satellites: positions, timestamp: date.getTime() };
    }),

  // Get orbital ground track for a single satellite (past + future)
  getGroundTrack: publicProcedure
    .input(z.object({
      tle1: z.string(), tle2: z.string(),
      minutesBefore: z.number().default(45),
      minutesAfter: z.number().default(45),
      stepMinutes: z.number().default(1),
    }))
    .query(({ input }) => {
      const satrec = satellite.twoline2satrec(input.tle1, input.tle2);
      const now = Date.now();
      const points: Array<{ lat: number; lon: number; altKm: number; t: number; isPast: boolean }> = [];
      for (let m = -input.minutesBefore; m <= input.minutesAfter; m += input.stepMinutes) {
        const date = new Date(now + m * 60000);
        try {
          const posVel = satellite.propagate(satrec, date) as any;
          if (!posVel || !posVel.position || typeof posVel.position === "boolean") continue;
          const gmst = satellite.gstime(date);
          const geo = satellite.eciToGeodetic(posVel.position, gmst);
          const lat = satellite.degreesLat(geo.latitude);
          const lon = satellite.degreesLong(geo.longitude);
          if (!isNaN(lat) && !isNaN(lon)) {
            points.push({ lat, lon, altKm: geo.height, t: date.getTime(), isPast: m < 0 });
          }
        } catch { /* skip */ }
      }
      return { points, totalMinutes: input.minutesBefore + input.minutesAfter };
    }),

  // Get TLE data for frontend-side propagation (reads from DB)
  getLiveTLEs: publicProcedure
    .input(z.object({ group: z.string() }))
    .query(async ({ input }) => {
      const meta = CATEGORY_META[input.group];
      if (!meta) throw new Error(`Unknown group: ${input.group}`);
      const sats = await getSatellitesByCategory(input.group);
      return {
        group: input.group, label: meta.label, color: meta.color,
        satellites: sats.map(sat => ({
          noradId: sat.noradId,
          name: sat.name,
          tle1: sat.tle1,
          tle2: sat.tle2,
          country: sat.country ?? null,
          operator: sat.operator ?? null,
          launchDate: sat.launchDate ?? null,
          launchSite: sat.launchSite ?? null,
          missionDescription: sat.missionDescription ?? null,
          type: sat.objectType ?? null,
          imageUrl: MISSION_IMAGES[sat.name] ?? null,
          inclination: sat.inclination ?? null,
          altitude: sat.altitude ?? null,
          period: sat.period ?? null,
          eccentricity: sat.eccentricity ?? null,
        })),
      };
    }),

  // Search satellites by name or NORAD ID (reads from DB)
  searchSatellites: publicProcedure
    .input(z.object({ query: z.string().min(1), limit: z.number().default(20) }))
    .query(async ({ input }) => {
      const sats = await searchSatellitesInDb(input.query, input.limit);
      const date = new Date();
      return sats.map(sat => {
        const pos = propagateSatellite(sat, date);
        return {
          noradId: sat.noradId,
          name: sat.name,
          category: sat.category ?? "unknown",
          country: sat.country ?? null,
          operator: sat.operator ?? null,
          launchDate: sat.launchDate ?? null,
          launchSite: sat.launchSite ?? null,
          missionDescription: sat.missionDescription ?? null,
          type: sat.objectType ?? null,
          imageUrl: MISSION_IMAGES[sat.name] ?? null,
          inclination: sat.inclination ?? null,
          altitude: pos?.altKm ?? sat.altitude ?? null,
          period: sat.period ?? null,
          eccentricity: sat.eccentricity ?? null,
          tle1: sat.tle1, tle2: sat.tle2,
          lat: pos?.lat ?? null,
          lon: pos?.lon ?? null,
          speedKms: pos?.speedKms ?? null,
        };
      });
    }),

  // Predict satellite passes over a ground location for the next 24 hours
  getPasses: publicProcedure
    .input(z.object({
      tle1: z.string(),
      tle2: z.string(),
      obsLat: z.number(),
      obsLon: z.number(),
      obsAltKm: z.number().default(0),
      hoursAhead: z.number().default(24),
      minElevDeg: z.number().default(5),
    }))
    .query(({ input }) => {
      const satrec = satellite.twoline2satrec(input.tle1, input.tle2);
      const obsLatR = input.obsLat * Math.PI / 180;
      const obsLonR = input.obsLon * Math.PI / 180;
      const EARTH_R = 6371;
      const now = Date.now();
      const stepMs = 30000; // 30-second steps
      const totalSteps = Math.round((input.hoursAhead * 3600000) / stepMs);

      interface PassEvent { riseTime: number; riseAz: number; maxTime: number; maxEl: number; maxAz: number; setTime: number; setAz: number; duration: number; }
      const passes: PassEvent[] = [];
      let inPass = false;
      let riseTime = 0, riseAz = 0, maxEl = 0, maxAz = 0, maxTime = 0;

      function getElAz(date: Date): { el: number; az: number } | null {
        try {
          const posVel = satellite.propagate(satrec, date) as any;
          if (!posVel?.position || typeof posVel.position === "boolean") return null;
          const gmst = satellite.gstime(date);
          const geo = satellite.eciToGeodetic(posVel.position, gmst);
          const satLat = satellite.degreesLat(geo.latitude);
          const satLon = satellite.degreesLong(geo.longitude);
          const satAlt = geo.height;
          if (isNaN(satLat) || isNaN(satLon)) return null;
          // Compute elevation and azimuth from observer to satellite
          const satLatR = satLat * Math.PI / 180;
          const satLonR = satLon * Math.PI / 180;
          // ECEF vectors
          const Re = EARTH_R;
          const obsR = Re + input.obsAltKm;
          const satR = Re + satAlt;
          const ox = obsR * Math.cos(obsLatR) * Math.cos(obsLonR);
          const oy = obsR * Math.cos(obsLatR) * Math.sin(obsLonR);
          const oz = obsR * Math.sin(obsLatR);
          const sx = satR * Math.cos(satLatR) * Math.cos(satLonR);
          const sy = satR * Math.cos(satLatR) * Math.sin(satLonR);
          const sz = satR * Math.sin(satLatR);
          const dx = sx - ox, dy = sy - oy, dz = sz - oz;
          const range = Math.sqrt(dx*dx + dy*dy + dz*dz);
          // Up vector at observer
          const ux = Math.cos(obsLatR) * Math.cos(obsLonR);
          const uy = Math.cos(obsLatR) * Math.sin(obsLonR);
          const uz = Math.sin(obsLatR);
          const el = Math.asin((dx*ux + dy*uy + dz*uz) / range) * 180 / Math.PI;
          // North vector at observer
          const nx = -Math.sin(obsLatR) * Math.cos(obsLonR);
          const ny = -Math.sin(obsLatR) * Math.sin(obsLonR);
          const nz = Math.cos(obsLatR);
          // East vector at observer
          const ex = -Math.sin(obsLonR);
          const ey = Math.cos(obsLonR);
          // ez = 0
          const north = dx*nx + dy*ny + dz*nz;
          const east = dx*ex + dy*ey;
          const az = ((Math.atan2(east, north) * 180 / Math.PI) + 360) % 360;
          return { el, az };
        } catch { return null; }
      }

      for (let i = 0; i <= totalSteps; i++) {
        const t = new Date(now + i * stepMs);
        const ea = getElAz(t);
        if (!ea) continue;
        const { el, az } = ea;
        if (!inPass && el >= input.minElevDeg) {
          inPass = true;
          riseTime = t.getTime();
          riseAz = az;
          maxEl = el; maxAz = az; maxTime = t.getTime();
        } else if (inPass) {
          if (el > maxEl) { maxEl = el; maxAz = az; maxTime = t.getTime(); }
          if (el < input.minElevDeg) {
            inPass = false;
            passes.push({
              riseTime, riseAz,
              maxTime, maxEl: Math.round(maxEl * 10) / 10, maxAz: Math.round(maxAz),
              setTime: t.getTime(), setAz: Math.round(az),
              duration: Math.round((t.getTime() - riseTime) / 1000),
            });
            if (passes.length >= 10) break;
          }
        }
      }
      return { passes, obsLat: input.obsLat, obsLon: input.obsLon };
    }),

  // Get NASA FIRMS fire hotspots (last 24h, worldwide)
  getFireHotspots: publicProcedure.query(async () => {
    try {
      const url = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_Global_24h.csv";
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw new Error(`FIRMS HTTP ${res.status}`);
      const text = await res.text();
      const lines = text.trim().split('\n');
      if (lines.length < 2) throw new Error('No data');
      const headers = lines[0].split(',');
      const latIdx = headers.indexOf('latitude');
      const lonIdx = headers.indexOf('longitude');
      const brightIdx = headers.indexOf('bright_ti4');
      const frpIdx = headers.indexOf('frp');
      const hotspots: Array<{ lat: number; lon: number; brightness: number; frp: number }> = [];
      for (let i = 1; i < lines.length; i += 3) {
        const cols = lines[i].split(',');
        if (cols.length < 4) continue;
        const lat = parseFloat(cols[latIdx]);
        const lon = parseFloat(cols[lonIdx]);
        const brightness = parseFloat(cols[brightIdx]) || 300;
        const frp = parseFloat(cols[frpIdx]) || 1;
        if (!isNaN(lat) && !isNaN(lon)) hotspots.push({ lat, lon, brightness, frp });
      }
      return { hotspots: hotspots.slice(0, 3000), source: 'NASA FIRMS VIIRS 375m', timestamp: Date.now() };
    } catch {
      const syntheticFires = [
        ...Array.from({ length: 80 }, () => ({ lat: -5 + Math.random() * 10, lon: -65 + Math.random() * 20, brightness: 320 + Math.random() * 60, frp: 5 + Math.random() * 30 })),
        ...Array.from({ length: 100 }, () => ({ lat: -5 + Math.random() * 15, lon: 15 + Math.random() * 25, brightness: 315 + Math.random() * 50, frp: 3 + Math.random() * 20 })),
        ...Array.from({ length: 60 }, () => ({ lat: 0 + Math.random() * 20, lon: 95 + Math.random() * 30, brightness: 310 + Math.random() * 40, frp: 2 + Math.random() * 15 })),
        ...Array.from({ length: 40 }, () => ({ lat: -30 + Math.random() * 20, lon: 115 + Math.random() * 30, brightness: 325 + Math.random() * 55, frp: 4 + Math.random() * 25 })),
        ...Array.from({ length: 30 }, () => ({ lat: 35 + Math.random() * 15, lon: -120 + Math.random() * 15, brightness: 330 + Math.random() * 60, frp: 6 + Math.random() * 35 })),
      ];
      return { hotspots: syntheticFires, source: 'SYNTHETIC (FIRMS unavailable)', timestamp: Date.now() };
    }
  }),

  // Get wind data from Open-Meteo (sampled grid)
  getWindData: publicProcedure.query(async () => {
    try {
      const gridPoints = [
        { lat: 60, lon: -30 }, { lat: 60, lon: 0 }, { lat: 60, lon: 30 }, { lat: 60, lon: 60 }, { lat: 60, lon: 90 }, { lat: 60, lon: 120 }, { lat: 60, lon: 150 }, { lat: 60, lon: 180 },
        { lat: 40, lon: -60 }, { lat: 40, lon: -30 }, { lat: 40, lon: 0 }, { lat: 40, lon: 30 }, { lat: 40, lon: 60 }, { lat: 40, lon: 90 }, { lat: 40, lon: 120 }, { lat: 40, lon: 150 },
        { lat: 20, lon: -90 }, { lat: 20, lon: -60 }, { lat: 20, lon: -30 }, { lat: 20, lon: 0 }, { lat: 20, lon: 30 }, { lat: 20, lon: 60 }, { lat: 20, lon: 90 }, { lat: 20, lon: 120 },
        { lat: 0, lon: -90 }, { lat: 0, lon: -60 }, { lat: 0, lon: -30 }, { lat: 0, lon: 0 }, { lat: 0, lon: 30 }, { lat: 0, lon: 60 }, { lat: 0, lon: 90 }, { lat: 0, lon: 120 },
        { lat: -20, lon: -90 }, { lat: -20, lon: -60 }, { lat: -20, lon: -30 }, { lat: -20, lon: 0 }, { lat: -20, lon: 30 }, { lat: -20, lon: 60 }, { lat: -20, lon: 90 }, { lat: -20, lon: 120 },
        { lat: -40, lon: -60 }, { lat: -40, lon: -30 }, { lat: -40, lon: 0 }, { lat: -40, lon: 30 }, { lat: -40, lon: 60 }, { lat: -40, lon: 90 }, { lat: -40, lon: 120 }, { lat: -40, lon: 150 },
      ];
      const lats = gridPoints.map(p => p.lat).join(',');
      const lons = gridPoints.map(p => p.lon).join(',');
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lats}&longitude=${lons}&current=wind_speed_10m,wind_direction_10m&wind_speed_unit=ms&forecast_days=1`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
      const data = await res.json();
      const results = Array.isArray(data) ? data : [data];
      const windPoints = results.map((d: any, i: number) => ({
        lat: gridPoints[i]?.lat ?? 0,
        lon: gridPoints[i]?.lon ?? 0,
        speed: d.current?.wind_speed_10m ?? 5,
        direction: d.current?.wind_direction_10m ?? 270,
      }));
      return { windPoints, source: 'Open-Meteo', timestamp: Date.now() };
    } catch {
      const syntheticWind = [
        ...Array.from({ length: 20 }, (_, i) => ({ lat: 10 + Math.random() * 10, lon: -180 + i * 18, speed: 6 + Math.random() * 4, direction: 90 + Math.random() * 30 })),
        ...Array.from({ length: 20 }, (_, i) => ({ lat: 45 + Math.random() * 10, lon: -180 + i * 18, speed: 8 + Math.random() * 8, direction: 260 + Math.random() * 40 })),
        ...Array.from({ length: 20 }, (_, i) => ({ lat: -40 + Math.random() * 10, lon: -180 + i * 18, speed: 10 + Math.random() * 10, direction: 270 + Math.random() * 30 })),
      ];
      return { windPoints: syntheticWind, source: 'SYNTHETIC (Open-Meteo unavailable)', timestamp: Date.now() };
    }
  }),

  // Get a single satellite's full details by NORAD ID (reads from DB)
  getSatelliteDetail: publicProcedure
    .input(z.object({ noradId: z.number() }))
    .query(async ({ input }) => {
      const sat = await getSatelliteByNoradId(input.noradId);
      if (!sat) throw new Error(`Satellite ${input.noradId} not found`);
      const date = new Date();
      const pos = propagateSatellite(sat, date);
      return {
        noradId: sat.noradId,
        name: sat.name,
        category: sat.category ?? "unknown",
        country: sat.country ?? null,
        operator: sat.operator ?? null,
        launchDate: sat.launchDate ?? null,
        launchSite: sat.launchSite ?? null,
        missionDescription: sat.missionDescription ?? null,
        type: sat.objectType ?? null,
        imageUrl: MISSION_IMAGES[sat.name] ?? null,
        inclination: sat.inclination ?? null,
        altitude: pos?.altKm ?? sat.altitude ?? null,
        period: sat.period ?? null,
        eccentricity: sat.eccentricity ?? null,
        tle1: sat.tle1, tle2: sat.tle2,
        lat: pos?.lat ?? null,
        lon: pos?.lon ?? null,
        speedKms: pos?.speedKms ?? null,
        lastUpdated: sat.lastUpdated,
        createdAt: sat.createdAt,
      };
    }),
});

// NOTE: getFireHotspots and getWindData are added as separate exports below
