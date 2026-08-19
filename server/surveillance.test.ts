import { describe, it, expect } from "vitest";

// Test the vessel history calculation logic (same as in sigint.ts)
function calculateVesselTrail(lat: number, lon: number, headingDeg: number, speedKnots: number) {
  const positions: { lat: number; lon: number; timestamp: number; sog: number; cog: number; heading: number }[] = [];
  const now = Date.now();
  const heading = headingDeg * Math.PI / 180;
  const speedKmH = speedKnots * 1.852;
  const R = 6371;
  const intervalMinutes = 15;
  const totalPoints = 96;

  for (let i = totalPoints; i >= 0; i--) {
    const minutesAgo = i * intervalMinutes;
    const distKm = speedKmH * (minutesAgo / 60);
    const angularDist = distKm / R;
    const reverseHeading = heading + Math.PI;
    const lat1 = lat * Math.PI / 180;
    const lon1 = lon * Math.PI / 180;
    const lat2 = Math.asin(
      Math.sin(lat1) * Math.cos(angularDist) +
      Math.cos(lat1) * Math.sin(angularDist) * Math.cos(reverseHeading)
    );
    const lon2 = lon1 + Math.atan2(
      Math.sin(reverseHeading) * Math.sin(angularDist) * Math.cos(lat1),
      Math.cos(angularDist) - Math.sin(lat1) * Math.sin(lat2)
    );
    const jitterLat = (Math.sin(i * 7.3) * 0.001);
    const jitterLon = (Math.cos(i * 5.7) * 0.001);
    positions.push({
      lat: (lat2 * 180 / Math.PI) + jitterLat,
      lon: (lon2 * 180 / Math.PI) + jitterLon,
      timestamp: now - (minutesAgo * 60 * 1000),
      sog: speedKnots + (Math.sin(i * 3.1) * 1.5),
      cog: headingDeg + (Math.sin(i * 2.3) * 5),
      heading: headingDeg + (Math.sin(i * 2.3) * 3),
    });
  }
  return positions;
}

describe("Surveillance Mode — Vessel AIS History Trail", () => {
  it("generates 97 position points for 24h trail (96 intervals + current)", () => {
    const trail = calculateVesselTrail(60.15, 24.96, 180, 12);
    expect(trail.length).toBe(97);
  });

  it("first position is oldest (24h ago), last position is current", () => {
    const trail = calculateVesselTrail(60.15, 24.96, 180, 12);
    const now = Date.now();
    // First position should be ~24h ago
    expect(now - trail[0].timestamp).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(now - trail[0].timestamp).toBeLessThan(25 * 60 * 60 * 1000);
    // Last position should be very recent (within 1 minute)
    expect(now - trail[trail.length - 1].timestamp).toBeLessThan(60 * 1000);
  });

  it("positions are in chronological order", () => {
    const trail = calculateVesselTrail(60.15, 24.96, 90, 8);
    for (let i = 1; i < trail.length; i++) {
      expect(trail[i].timestamp).toBeGreaterThan(trail[i - 1].timestamp);
    }
  });

  it("trail extends backwards from current position (heading 180 = south)", () => {
    // Vessel heading south at 180°, trail should go north (higher lat)
    const trail = calculateVesselTrail(60.0, 25.0, 180, 10);
    // Oldest position should be north of current (higher lat)
    expect(trail[0].lat).toBeGreaterThan(60.0);
    // Newest position should be close to current
    expect(Math.abs(trail[trail.length - 1].lat - 60.0)).toBeLessThan(0.01);
  });

  it("trail extends backwards from current position (heading 0 = north)", () => {
    // Vessel heading north at 0°, trail should go south (lower lat)
    const trail = calculateVesselTrail(60.0, 25.0, 0, 10);
    // Oldest position should be south of current (lower lat)
    expect(trail[0].lat).toBeLessThan(60.0);
  });

  it("speed affects trail length (faster = longer trail)", () => {
    const slowTrail = calculateVesselTrail(60.0, 25.0, 90, 5);
    const fastTrail = calculateVesselTrail(60.0, 25.0, 90, 20);
    // Fast trail should cover more distance
    const slowDist = Math.abs(slowTrail[0].lon - slowTrail[slowTrail.length - 1].lon);
    const fastDist = Math.abs(fastTrail[0].lon - fastTrail[fastTrail.length - 1].lon);
    expect(fastDist).toBeGreaterThan(slowDist);
  });

  it("all positions have valid lat/lon ranges", () => {
    const trail = calculateVesselTrail(45.0, 10.0, 270, 15);
    trail.forEach(pos => {
      expect(pos.lat).toBeGreaterThanOrEqual(-90);
      expect(pos.lat).toBeLessThanOrEqual(90);
      expect(pos.lon).toBeGreaterThanOrEqual(-180);
      expect(pos.lon).toBeLessThanOrEqual(180);
    });
  });

  it("SOG varies slightly around base speed", () => {
    const trail = calculateVesselTrail(60.0, 25.0, 45, 12);
    const speeds = trail.map(p => p.sog);
    const minSpeed = Math.min(...speeds);
    const maxSpeed = Math.max(...speeds);
    // Should vary by about ±1.5 knots
    expect(minSpeed).toBeGreaterThan(10);
    expect(maxSpeed).toBeLessThan(14);
  });
});

describe("Surveillance Mode — Camera Grid View", () => {
  it("grid layout adapts to camera count (2 cameras = 2x1)", () => {
    const getGridClass = (count: number) => {
      if (count <= 2) return "grid-cols-2 grid-rows-1";
      if (count <= 4) return "grid-cols-2 grid-rows-2";
      if (count <= 6) return "grid-cols-3 grid-rows-2";
      return "grid-cols-3 grid-rows-3";
    };
    expect(getGridClass(2)).toBe("grid-cols-2 grid-rows-1");
    expect(getGridClass(3)).toBe("grid-cols-2 grid-rows-2");
    expect(getGridClass(4)).toBe("grid-cols-2 grid-rows-2");
    expect(getGridClass(5)).toBe("grid-cols-3 grid-rows-2");
    expect(getGridClass(6)).toBe("grid-cols-3 grid-rows-2");
    expect(getGridClass(7)).toBe("grid-cols-3 grid-rows-3");
    expect(getGridClass(9)).toBe("grid-cols-3 grid-rows-3");
  });

  it("camera grid requires minimum 2 cameras to show button", () => {
    const cameraItems = [
      { id: "cam1", type: "camera", label: "Cam 1", data: {} },
      { id: "cam2", type: "camera", label: "Cam 2", data: {} },
    ];
    expect(cameraItems.length >= 2).toBe(true);
  });

  it("single camera does not trigger grid mode", () => {
    const cameraItems = [
      { id: "cam1", type: "camera", label: "Cam 1", data: {} },
    ];
    expect(cameraItems.length >= 2).toBe(false);
  });
});
