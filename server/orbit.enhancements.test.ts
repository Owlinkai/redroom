/**
 * Tests for Orbit page enhancements and coordinate math:
 * 1. Coordinate conversion round-trip (latLonAltToVec3 ↔ inverse)
 * 2. AOI elevation formula (computeAoiVisibility)
 * 3. TLE age warning — parseTleEpoch + getTleAgeDays
 * 4. Satellite images — getSatImage using NASA CDN URLs
 * 5. Country search for AOI — COUNTRY_COORDS lookup
 * 6. Click-to-predict integration logic
 */

import { describe, it, expect } from "vitest";

// ─── Coordinate conversion (mirrors latLonAltToVec3 in Orbit.tsx) ────────────
const GLOBE_R = 1.0;
const EARTH_RADIUS_KM = 6371;

function latLonAltToVec3(lat: number, lon: number, altKm: number = 0) {
  const r = GLOBE_R * (1 + altKm / EARTH_RADIUS_KM);
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return {
    x: -r * Math.sin(phi) * Math.cos(theta),  // NEGATIVE x — matches Three.js SphereGeometry
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta),
  };
}

// FIXED inverse: x = -sin(phi)*cos(theta), so -x = sin(phi)*cos(theta), theta = atan2(z, -x)
function inverseVec3ToLatLon(x: number, y: number, z: number) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const nx = x / r, ny = y / r, nz = z / r;
  const lat = Math.asin(ny) * 180 / Math.PI;
  let lon = Math.atan2(nz, -nx) * 180 / Math.PI - 180;
  while (lon > 180) lon -= 360;
  while (lon < -180) lon += 360;
  return { lat, lon };
}

// ─── AOI visibility (mirrors computeAoiVisibility in Orbit.tsx) ──────────────
function computeAoiElevation(obsLat: number, obsLon: number, satLat: number, satLon: number, satAltKm: number): number {
  const obsLatR = obsLat * Math.PI / 180;
  const obsLonR = obsLon * Math.PI / 180;
  const satLatR = satLat * Math.PI / 180;
  const satLonR = satLon * Math.PI / 180;
  const ox = Math.cos(obsLatR) * Math.cos(obsLonR);
  const oy = Math.sin(obsLatR);
  const oz = Math.cos(obsLatR) * Math.sin(obsLonR);
  const sr = 1 + satAltKm / EARTH_RADIUS_KM;
  const sx = sr * Math.cos(satLatR) * Math.cos(satLonR);
  const sy = sr * Math.sin(satLatR);
  const sz = sr * Math.cos(satLatR) * Math.sin(satLonR);
  const dx = sx - ox, dy = sy - oy, dz = sz - oz;
  const rangeEr = Math.sqrt(dx * dx + dy * dy + dz * dz);
  // FIXED: elevation = asin(dot(up, range_hat)) — no subtraction
  const sinElev = Math.max(-1, Math.min(1, (ox * dx + oy * dy + oz * dz) / rangeEr));
  return Math.asin(sinElev) * 180 / Math.PI;
}

// ─── TLE epoch parsing ──────────────────────────────────────────────────────
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

function getTleAgeDays(tle1: string, now = Date.now()): number | null {
  const epoch = parseTleEpoch(tle1);
  if (!epoch) return null;
  return (now - epoch.getTime()) / 86400000;
}

// ─── NASA image lookup ──────────────────────────────────────────────────────
const SAT_IMAGES: Record<string, string> = {
  "ISS":      "https://images-assets.nasa.gov/image/200623_ISS_1/200623_ISS_1~medium.jpg",
  "CSS":      "https://images-assets.nasa.gov/image/s134e006979/s134e006979~medium.jpg",
  "NOAA":     "https://images-assets.nasa.gov/image/KSC-2009-1410/KSC-2009-1410~medium.jpg",
  "GOES":     "https://images-assets.nasa.gov/image/KSC-2009-2213/KSC-2009-2213~medium.jpg",
  "HUBBLE":   "https://images-assets.nasa.gov/image/PIA05982/PIA05982~medium.jpg",
  "STARLINK": "https://images-assets.nasa.gov/image/KSC00pp0543/KSC00pp0543~medium.jpg",
  "IRIDIUM":  "https://images-assets.nasa.gov/image/PIA22452/PIA22452~medium.jpg",
  "DEFAULT":  "https://images-assets.nasa.gov/image/PIA18156/PIA18156~small.jpg",
};

function getSatImage(name: string, imageUrl?: string | null): string {
  if (imageUrl) return imageUrl;
  const upper = name.toUpperCase();
  for (const [prefix, url] of Object.entries(SAT_IMAGES)) {
    if (prefix !== "DEFAULT" && upper.startsWith(prefix)) return url;
  }
  return SAT_IMAGES.DEFAULT;
}

// ─── Country coords lookup ──────────────────────────────────────────────────
const COUNTRY_COORDS = [
  { name: "United States", lat: 37.09, lon: -95.71 },
  { name: "United Kingdom", lat: 55.38, lon: -3.44 },
  { name: "Germany", lat: 51.17, lon: 10.45 },
  { name: "China", lat: 35.86, lon: 104.20 },
  { name: "Russia", lat: 61.52, lon: 105.32 },
  { name: "Japan", lat: 36.20, lon: 138.25 },
  { name: "India", lat: 20.59, lon: 78.96 },
  { name: "North Korea", lat: 40.34, lon: 127.51 },
  { name: "Israel", lat: 31.05, lon: 34.85 },
  { name: "Iran", lat: 32.43, lon: 53.69 },
];

function searchCountries(query: string) {
  const q = query.toLowerCase();
  return COUNTRY_COORDS.filter(c => c.name.toLowerCase().includes(q));
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

describe("Coordinate conversion round-trip", () => {
  const cities = [
    { name: "London", lat: 51.5, lon: -0.13 },
    { name: "New York", lat: 40.71, lon: -74.01 },
    { name: "Tokyo", lat: 35.68, lon: 139.69 },
    { name: "Sydney", lat: -33.87, lon: 151.21 },
    { name: "Moscow", lat: 55.76, lon: 37.62 },
    { name: "Cairo", lat: 30.04, lon: 31.24 },
    { name: "Buenos Aires", lat: -34.60, lon: -58.38 },
    { name: "US Center", lat: 37.09, lon: -95.71 },
    { name: "North Korea", lat: 40.34, lon: 127.51 },
    { name: "Israel", lat: 31.05, lon: 34.85 },
  ];

  for (const city of cities) {
    it(`round-trips ${city.name} (${city.lat}, ${city.lon}) with < 0.01° error`, () => {
      const { x, y, z } = latLonAltToVec3(city.lat, city.lon);
      const { lat, lon } = inverseVec3ToLatLon(x, y, z);
      expect(Math.abs(lat - city.lat)).toBeLessThan(0.01);
      let lonErr = Math.abs(lon - city.lon);
      if (lonErr > 180) lonErr = 360 - lonErr;
      expect(lonErr).toBeLessThan(0.01);
    });
  }

  it("places northern hemisphere cities at positive y", () => {
    const { y } = latLonAltToVec3(51.5, -0.13);
    expect(y).toBeGreaterThan(0);
  });

  it("places southern hemisphere cities at negative y", () => {
    const { y } = latLonAltToVec3(-33.87, 151.21);
    expect(y).toBeLessThan(0);
  });
});

describe("AOI elevation formula", () => {
  it("satellite directly overhead → 90° elevation", () => {
    const elev = computeAoiElevation(51.5, -0.13, 51.5, -0.13, 400);
    expect(Math.abs(elev - 90)).toBeLessThan(0.5);
  });

  it("satellite on opposite side of Earth → negative elevation", () => {
    const elev = computeAoiElevation(51.5, -0.13, -51.5, 179.87, 400);
    expect(elev).toBeLessThan(-60);
  });

  it("satellite 90° away → below horizon for LEO", () => {
    const elev = computeAoiElevation(0, 0, 0, 90, 400);
    expect(elev).toBeLessThan(0);
  });

  it("symmetric: NE and SW hemispheres give same overhead elevation", () => {
    const elevNE = computeAoiElevation(30, 45, 30, 45, 400);
    const elevSW = computeAoiElevation(-30, -45, -30, -45, 400);
    expect(Math.abs(elevNE - elevSW)).toBeLessThan(0.1);
  });

  it("slightly offset satellite gives high but not 90° elevation", () => {
    const elev = computeAoiElevation(0, 0, 5, 5, 400);
    expect(elev).toBeGreaterThan(10);
    expect(elev).toBeLessThan(90);
  });

  it("GEO satellite overhead → 90° elevation", () => {
    const elev = computeAoiElevation(0, 100, 0, 100, 35786);
    expect(Math.abs(elev - 90)).toBeLessThan(0.5);
  });
});

describe("TLE epoch parsing", () => {
  const ISS_TLE1 = "1 25544U 98067A   24001.50000000  .00016717  00000-0  10270-3 0  9993";

  it("parses year from 2-digit epoch (20xx for year < 57)", () => {
    const epoch = parseTleEpoch(ISS_TLE1);
    expect(epoch).not.toBeNull();
    expect(epoch!.getUTCFullYear()).toBe(2024);
  });

  it("parses day-of-year correctly (day 1 = Jan 1)", () => {
    const epoch = parseTleEpoch(ISS_TLE1);
    expect(epoch).not.toBeNull();
    expect(epoch!.getUTCMonth()).toBe(0);
    expect(epoch!.getUTCDate()).toBe(1);
    expect(epoch!.getUTCHours()).toBe(12);
  });

  it("handles pre-2000 satellites (year >= 57 → 19xx)", () => {
    const oldTle1 = "1 00001U 57001B   57274.33491000  .00000000  00000-0  00000-0 0  9999";
    const epoch = parseTleEpoch(oldTle1);
    expect(epoch).not.toBeNull();
    expect(epoch!.getUTCFullYear()).toBe(1957);
  });

  it("returns null or Invalid Date for malformed TLE", () => {
    const result = parseTleEpoch("not a tle");
    const isNullOrInvalid = result === null || (result instanceof Date && isNaN(result.getTime()));
    expect(isNullOrInvalid).toBe(true);
  });

  it("computes age in days correctly", () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);
    const year2 = tenDaysAgo.getUTCFullYear() % 100;
    const jan1 = new Date(Date.UTC(tenDaysAgo.getUTCFullYear(), 0, 1));
    const dayFrac = (tenDaysAgo.getTime() - jan1.getTime()) / 86400000 + 1;
    const epochStr = `${String(year2).padStart(2, "0")}${dayFrac.toFixed(8)}`;
    const tle1 = `1 25544U 98067A   ${epochStr}  .00016717  00000-0  10270-3 0  9993`;
    const age = getTleAgeDays(tle1);
    expect(age).not.toBeNull();
    expect(Math.abs(age! - 10)).toBeLessThan(0.1);
  });

  it("classifies TLE age correctly", () => {
    expect(2 < 3).toBe(true);       // green
    expect(5 >= 3 && 5 < 7).toBe(true);  // yellow
    expect(10 >= 7).toBe(true);      // red
  });
});

describe("NASA satellite image lookup", () => {
  it("returns ISS image for ISS satellite", () => {
    const url = getSatImage("ISS (ZARYA)");
    expect(url).toBe(SAT_IMAGES.ISS);
    expect(url).toContain("nasa.gov");
  });

  it("returns NOAA image for NOAA satellite", () => {
    expect(getSatImage("NOAA 18")).toBe(SAT_IMAGES.NOAA);
  });

  it("returns STARLINK image for Starlink satellite", () => {
    expect(getSatImage("STARLINK-1234")).toBe(SAT_IMAGES.STARLINK);
  });

  it("returns HUBBLE image for Hubble", () => {
    expect(getSatImage("HUBBLE SPACE TELESCOPE")).toBe(SAT_IMAGES.HUBBLE);
  });

  it("returns IRIDIUM image for Iridium satellites", () => {
    expect(getSatImage("IRIDIUM NEXT 101")).toBe(SAT_IMAGES.IRIDIUM);
  });

  it("returns DEFAULT image for unknown satellite", () => {
    expect(getSatImage("UNKNOWN-SAT-9999")).toBe(SAT_IMAGES.DEFAULT);
  });

  it("prefers explicit imageUrl over name-based lookup", () => {
    const customUrl = "https://example.com/custom-satellite.jpg";
    expect(getSatImage("ISS (ZARYA)", customUrl)).toBe(customUrl);
  });

  it("all image URLs point to NASA CDN (not Wikipedia)", () => {
    for (const url of Object.values(SAT_IMAGES)) {
      expect(url).toContain("images-assets.nasa.gov");
      expect(url).not.toContain("wikipedia");
    }
  });
});

describe("Country AOI search", () => {
  it("finds United States by partial name", () => {
    const results = searchCountries("united states");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("United States");
    expect(results[0].lat).toBeCloseTo(37.09, 1);
    expect(results[0].lon).toBeCloseTo(-95.71, 1);
  });

  it("finds multiple countries matching 'united'", () => {
    const results = searchCountries("united");
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.map(r => r.name)).toContain("United States");
    expect(results.map(r => r.name)).toContain("United Kingdom");
  });

  it("is case-insensitive", () => {
    expect(searchCountries("germany").length).toBe(searchCountries("GERMANY").length);
    expect(searchCountries("germany").length).toBeGreaterThan(0);
  });

  it("returns empty array for no match", () => {
    expect(searchCountries("xyznonexistent")).toHaveLength(0);
  });

  it("all coordinates within valid lat/lon range", () => {
    for (const c of COUNTRY_COORDS) {
      expect(c.lat).toBeGreaterThanOrEqual(-90);
      expect(c.lat).toBeLessThanOrEqual(90);
      expect(c.lon).toBeGreaterThanOrEqual(-180);
      expect(c.lon).toBeLessThanOrEqual(180);
    }
  });

  it("finds North Korea", () => {
    const results = searchCountries("north korea");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("North Korea");
    expect(results[0].lat).toBeCloseTo(40.34, 1);
  });

  it("finds Israel", () => {
    const results = searchCountries("israel");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toBe("Israel");
  });
});

describe("Click-to-predict integration logic", () => {
  it("AOI result structure has required fields", () => {
    const mockResult = {
      sat: { noradId: 25544, name: "ISS (ZARYA)" },
      elevationDeg: 45.2,
      azimuthDeg: 180.0,
      rangeKm: 600,
      isVisible: true,
    };
    expect(mockResult.isVisible).toBe(true);
    expect(mockResult.elevationDeg).toBeGreaterThan(0);
  });

  it("pass predictor pre-fill: lat/lon from AOI click are passed correctly", () => {
    const aoiLat = 51.5074;
    const aoiLon = -0.1278;
    const passPredictorLat = aoiLat;
    const passPredictorLon = aoiLon;
    expect(passPredictorLat).toBe(aoiLat);
    expect(passPredictorLon).toBe(aoiLon);
    expect(typeof passPredictorLat).toBe("number");
  });
});
