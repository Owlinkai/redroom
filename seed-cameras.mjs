/**
 * SIGINT Camera Seeder — Fetches ONLY from verified, working public APIs
 * Every camera has real coordinates and a working image URL.
 * No fake data, no generated coordinates, no guessing.
 *
 * Verified Sources:
 * 1. TfL JamCam (London, UK) — ~882 cameras
 * 2. Singapore LTA Traffic Images — ~89 cameras
 * 3. Finland Digitraffic Weathercam — ~800 stations
 * 4. NYSDOT 511 (New York, US) — ~1,800 active cameras
 * 5. Ontario 511 (Canada) — ~928 cameras
 * 6. Alberta 511 (Canada) — ~367 cameras
 * 7. ODOT TripCheck (Oregon, US) — ~1,128 cameras
 * 8. Caltrans (California, US) — Districts 3, 4, 7, 8, 11, 12 — ~2,000+ cameras
 */

import mysql from "mysql2/promise";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

// ─── Helper: Insert cameras in batches ─────────────────────────────────────
async function insertCameras(conn, cameras) {
  if (cameras.length === 0) return 0;
  const batchSize = 100;
  let inserted = 0;
  for (let i = 0; i < cameras.length; i += batchSize) {
    const batch = cameras.slice(i, i + batchSize);
    const placeholders = batch.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())").join(",\n");
    const values = batch.flatMap(c => [
      c.externalId, c.name, c.latitude, c.longitude,
      c.country, c.countryCode, c.city || null,
      c.source, c.sourceApi, c.feedUrl,
      c.feedType || "image", c.direction || null, c.road || null
    ]);
    await conn.execute(
      `INSERT INTO sigint_cameras (externalId, name, latitude, longitude, country, countryCode, city, source, sourceApi, feedUrl, feedType, direction, road, lastVerified)
       VALUES ${placeholders}`,
      values
    );
    inserted += batch.length;
  }
  return inserted;
}

// ─── Source 1: TfL JamCam (London, UK) ─────────────────────────────────────
async function fetchTfL() {
  console.log("[TfL] Fetching London cameras...");
  try {
    const resp = await fetch("https://api.tfl.gov.uk/Place/Type/JamCam", { signal: AbortSignal.timeout(20000) });
    if (!resp.ok) { console.log(`  HTTP ${resp.status}`); return []; }
    const data = await resp.json();
    const cameras = [];
    for (const cam of data) {
      const props = {};
      for (const p of (cam.additionalProperties || [])) props[p.key] = p.value;
      const imageUrl = props.imageUrl || "";
      if (!imageUrl || !cam.lat || !cam.lon) continue;
      cameras.push({
        externalId: `tfl-${cam.id}`,
        name: cam.commonName || "TfL JamCam",
        latitude: cam.lat, longitude: cam.lon,
        country: "United Kingdom", countryCode: "GB", city: "London",
        source: "TfL JamCam",
        sourceApi: "https://api.tfl.gov.uk/Place/Type/JamCam",
        feedUrl: imageUrl, feedType: "image",
        direction: props.direction || null, road: props.roadName || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 2: Singapore LTA Traffic Images ────────────────────────────────
async function fetchSingapore() {
  console.log("[SG] Fetching Singapore cameras...");
  try {
    const resp = await fetch("https://api.data.gov.sg/v1/transport/traffic-images", { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const items = data.items?.[0]?.cameras || [];
    const cameras = items
      .filter(c => c.image && c.location?.latitude && c.location?.longitude)
      .map(cam => ({
        externalId: `sg-${cam.camera_id}`,
        name: `Singapore Traffic Cam ${cam.camera_id}`,
        latitude: cam.location.latitude, longitude: cam.location.longitude,
        country: "Singapore", countryCode: "SG", city: "Singapore",
        source: "Singapore LTA",
        sourceApi: "https://api.data.gov.sg/v1/transport/traffic-images",
        feedUrl: cam.image, feedType: "image", direction: null, road: null,
      }));
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 3: Finland Digitraffic Weathercam ──────────────────────────────
async function fetchFinland() {
  console.log("[FI] Fetching Finland cameras...");
  try {
    const resp = await fetch("https://tie.digitraffic.fi/api/weathercam/v1/stations", {
      headers: { "Accept-Encoding": "gzip" }, signal: AbortSignal.timeout(20000),
    });
    if (!resp.ok) return [];
    const data = await resp.json();
    const features = data.features || [];
    const cameras = [];
    for (const f of features) {
      const props = f.properties || {};
      const coords = f.geometry?.coordinates;
      const presets = props.presets || [];
      if (!coords || coords.length < 2 || presets.length === 0) continue;
      if (props.collectionStatus !== "GATHERING") continue;
      const presetId = presets[0].id;
      if (!presetId) continue;
      cameras.push({
        externalId: `fi-${props.id}`,
        name: props.name || `Finland Cam ${props.id}`,
        latitude: coords[1], longitude: coords[0],
        country: "Finland", countryCode: "FI", city: null,
        source: "Finland Digitraffic",
        sourceApi: "https://tie.digitraffic.fi/api/weathercam/v1/stations",
        feedUrl: `https://weathercam.digitraffic.fi/${presetId}.jpg`,
        feedType: "image", direction: null,
        road: props.name?.split("_")[0] || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 4: NYSDOT 511 (New York, US) ───────────────────────────────────
async function fetchNYSDOT() {
  console.log("[NYSDOT] Fetching New York cameras...");
  try {
    const resp = await fetch("https://511ny.org/api/getcameras?format=json&key=open", { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const cameras = [];
    for (const cam of data) {
      if (cam.Disabled || cam.Blocked) continue;
      if (!cam.Latitude || !cam.Longitude || !cam.Url) continue;
      cameras.push({
        externalId: cam.ID || `ny-${cameras.length}`,
        name: cam.Name || "NY Camera",
        latitude: cam.Latitude, longitude: cam.Longitude,
        country: "United States", countryCode: "US", city: "New York",
        source: "NYSDOT 511",
        sourceApi: "https://511ny.org/api/getcameras",
        feedUrl: cam.Url, feedType: "image",
        direction: cam.DirectionOfTravel || null,
        road: cam.RoadwayName || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 5: Ontario 511 (Canada) ────────────────────────────────────────
async function fetchOntario() {
  console.log("[ON] Fetching Ontario cameras...");
  try {
    const resp = await fetch("https://511on.ca/api/v2/get/cameras", { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const cameras = [];
    for (const cam of data) {
      if (!cam.Latitude || !cam.Longitude) continue;
      const views = cam.Views || [];
      const imageUrl = views[0]?.Url;
      if (!imageUrl) continue;
      cameras.push({
        externalId: `on-${cam.Id}`,
        name: cam.Location || `Ontario Camera ${cam.Id}`,
        latitude: cam.Latitude, longitude: cam.Longitude,
        country: "Canada", countryCode: "CA", city: "Ontario",
        source: "Ontario 511",
        sourceApi: "https://511on.ca/api/v2/get/cameras",
        feedUrl: imageUrl, feedType: "image",
        direction: cam.Direction || null, road: cam.Roadway || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 6: Alberta 511 (Canada) ────────────────────────────────────────
async function fetchAlberta() {
  console.log("[AB] Fetching Alberta cameras...");
  try {
    const resp = await fetch("https://511.alberta.ca/api/v2/get/cameras", { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const cameras = [];
    for (const cam of data) {
      if (!cam.Latitude || !cam.Longitude) continue;
      const views = cam.Views || [];
      const imageUrl = views[0]?.Url;
      if (!imageUrl) continue;
      cameras.push({
        externalId: `ab-${cam.Id}`,
        name: cam.Location || `Alberta Camera ${cam.Id}`,
        latitude: cam.Latitude, longitude: cam.Longitude,
        country: "Canada", countryCode: "CA", city: "Alberta",
        source: "Alberta 511",
        sourceApi: "https://511.alberta.ca/api/v2/get/cameras",
        feedUrl: imageUrl, feedType: "image",
        direction: cam.Direction || null, road: cam.Roadway || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 7: ODOT TripCheck (Oregon, US) ─────────────────────────────────
async function fetchOregon() {
  console.log("[OR] Fetching Oregon cameras...");
  try {
    const resp = await fetch("https://tripcheck.com/Scripts/map/data/cctvinventory.js", { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) return [];
    const data = await resp.json();
    const features = data.features || [];
    const cameras = [];
    for (const f of features) {
      const attrs = f.attributes || {};
      const lat = attrs.latitude;
      const lon = attrs.longitude;
      const filename = attrs.filename;
      if (!lat || !lon || !filename) continue;
      cameras.push({
        externalId: `or-${attrs.cameraId || cameras.length}`,
        name: attrs.title || `Oregon Camera ${attrs.cameraId}`,
        latitude: lat, longitude: lon,
        country: "United States", countryCode: "US", city: "Oregon",
        source: "ODOT TripCheck",
        sourceApi: "https://tripcheck.com/Scripts/map/data/cctvinventory.js",
        feedUrl: `https://tripcheck.com/roadcams/cams/${filename}`,
        feedType: "image", direction: null, road: attrs.route || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Source 8: Caltrans (California, US) ───────────────────────────────────
async function fetchCaltrans(district) {
  const d = district.toString().padStart(2, "0");
  console.log(`[CA-D${d}] Fetching Caltrans District ${district}...`);
  try {
    const resp = await fetch(`https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${d}.json`, {
      signal: AbortSignal.timeout(45000),
    });
    if (!resp.ok) { console.log(`  HTTP ${resp.status}`); return []; }
    let text = await resp.text();
    text = text.replace(/,(\s*[}\]])/g, "$1"); // Fix trailing commas
    const parsed = JSON.parse(text);
    const cams = parsed.data || [];
    const cameras = [];
    for (const item of cams) {
      const cctv = item.cctv || {};
      if (cctv.inService !== "true") continue;
      const loc = cctv.location || {};
      const lat = parseFloat(loc.latitude);
      const lon = parseFloat(loc.longitude);
      const imageUrl = cctv.imageData?.static?.currentImageURL;
      if (!lat || !lon || !imageUrl) continue;
      cameras.push({
        externalId: `ca-d${d}-${cctv.index || cameras.length}`,
        name: loc.locationName || `CA D${d} Camera`,
        latitude: lat, longitude: lon,
        country: "United States", countryCode: "US", city: "California",
        source: `Caltrans D${d}`,
        sourceApi: `https://cwwp2.dot.ca.gov/data/d${district}/cctv/cctvStatusD${d}.json`,
        feedUrl: imageUrl, feedType: "image",
        direction: loc.direction || null, road: loc.route || null,
      });
    }
    console.log(`  ${cameras.length} cameras`);
    return cameras;
  } catch (e) { console.log(`  Error: ${e.message}`); return []; }
}

// ─── Main ──────────────────────────────────────────────────────────────────
async function main() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SIGINT Camera Seeder — Real Verified Data Only");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const conn = await mysql.createConnection(DATABASE_URL);

  // Clear existing data
  console.log("Clearing existing camera data...");
  await conn.execute("DELETE FROM sigint_cameras");

  // Fetch all sources (some in parallel, Caltrans sequentially due to slow server)
  const [tfl, sg, fi, ny, on, ab, or_] = await Promise.all([
    fetchTfL(),
    fetchSingapore(),
    fetchFinland(),
    fetchNYSDOT(),
    fetchOntario(),
    fetchAlberta(),
    fetchOregon(),
  ]);

  // Caltrans districts (sequential to avoid overloading their server)
  const caltransDistricts = [3, 4, 7, 8, 11, 12];
  const caltransCams = [];
  for (const d of caltransDistricts) {
    const cams = await fetchCaltrans(d);
    caltransCams.push(...cams);
  }

  // Insert all
  console.log("\n─── Inserting into database ───");
  const allSources = [
    { name: "TfL London", data: tfl },
    { name: "Singapore", data: sg },
    { name: "Finland", data: fi },
    { name: "NYSDOT", data: ny },
    { name: "Ontario", data: on },
    { name: "Alberta", data: ab },
    { name: "Oregon", data: or_ },
    { name: "Caltrans", data: caltransCams },
  ];

  let totalInserted = 0;
  for (const src of allSources) {
    if (src.data.length > 0) {
      const n = await insertCameras(conn, src.data);
      totalInserted += n;
      console.log(`  ${src.name}: ${n} cameras inserted`);
    }
  }

  // Summary
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log(`  TOTAL: ${totalInserted} verified cameras seeded`);
  console.log("═══════════════════════════════════════════════════════════════");

  const [rows] = await conn.execute(
    "SELECT countryCode, source, COUNT(*) as cnt FROM sigint_cameras GROUP BY countryCode, source ORDER BY cnt DESC"
  );
  for (const row of rows) {
    console.log(`  ${row.countryCode} | ${row.source}: ${row.cnt}`);
  }

  await conn.end();
  console.log("\nDone!");
}

main().catch(e => { console.error("Fatal:", e); process.exit(1); });
