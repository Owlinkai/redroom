/**
 * Fast Global Camera Seeder — Gets immediate global coverage
 * Strategy: 511 systems (first 200 each) + Insecam (1 page per country, 50 countries)
 * Total time: ~10 minutes for 50+ countries
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
const pool = mysql.createPool(DB_URL + '&connectionLimit=3');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function insertCam(cam) {
  try {
    await pool.query(
      `INSERT IGNORE INTO sigint_cameras (externalId, name, latitude, longitude, country, countryCode, city, source, sourceApi, feedUrl, feedType, isActive) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cam.externalId, cam.name, cam.lat, cam.lng, cam.country, cam.countryCode, cam.city, cam.source, cam.sourceApi, cam.feedUrl, cam.feedType, 1]
    );
    return true;
  } catch { return false; }
}

// ─── 511 Systems ─────────────────────────────────────────────────────────────
async function fetch511(baseUrl, state, key) {
  let inserted = 0;
  try {
    const res = await fetch(`${baseUrl}/List/GetData/Cameras?start=0&length=200`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'draw=1&start=0&length=200',
      signal: AbortSignal.timeout(15000)
    });
    const data = await res.json();
    for (const cam of (data.data || [])) {
      const m = cam.latLng?.geography?.wellKnownText?.match(/POINT\s*\(([0-9.-]+)\s+([0-9.-]+)\)/);
      if (!m) continue;
      const imgId = cam.images?.[0]?.id;
      if (!imgId) continue;
      const ok = await insertCam({
        externalId: `${key}_${cam.id}`,
        name: cam.location || `${state} Camera`,
        lat: parseFloat(m[2]), lng: parseFloat(m[1]),
        country: 'United States', countryCode: 'US',
        city: cam.city || state,
        source: key, sourceApi: `${baseUrl}/List/GetData/Cameras`,
        feedUrl: `${baseUrl}/map/Cctv/${imgId}`, feedType: 'image'
      });
      if (ok) inserted++;
    }
  } catch (e) { console.error(`  ${state} error: ${e.message}`); }
  return inserted;
}

// ─── Insecam (1 page per country = 6 cameras with coordinates) ───────────────
const COUNTRIES = [
  { code: 'JP', name: 'Japan' }, { code: 'KR', name: 'South Korea' },
  { code: 'DE', name: 'Germany' }, { code: 'FR', name: 'France' },
  { code: 'IT', name: 'Italy' }, { code: 'ES', name: 'Spain' },
  { code: 'NL', name: 'Netherlands' }, { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' }, { code: 'AR', name: 'Argentina' },
  { code: 'CO', name: 'Colombia' }, { code: 'IN', name: 'India' },
  { code: 'RU', name: 'Russia' }, { code: 'UA', name: 'Ukraine' },
  { code: 'TR', name: 'Turkey' }, { code: 'AU', name: 'Australia' },
  { code: 'ZA', name: 'South Africa' }, { code: 'TH', name: 'Thailand' },
  { code: 'VN', name: 'Vietnam' }, { code: 'ID', name: 'Indonesia' },
  { code: 'PH', name: 'Philippines' }, { code: 'MY', name: 'Malaysia' },
  { code: 'TW', name: 'Taiwan' }, { code: 'IL', name: 'Israel' },
  { code: 'AE', name: 'United Arab Emirates' }, { code: 'SA', name: 'Saudi Arabia' },
  { code: 'EG', name: 'Egypt' }, { code: 'NG', name: 'Nigeria' },
  { code: 'KE', name: 'Kenya' }, { code: 'PL', name: 'Poland' },
  { code: 'CZ', name: 'Czech Republic' }, { code: 'AT', name: 'Austria' },
  { code: 'CH', name: 'Switzerland' }, { code: 'SE', name: 'Sweden' },
  { code: 'NO', name: 'Norway' }, { code: 'DK', name: 'Denmark' },
  { code: 'BE', name: 'Belgium' }, { code: 'PT', name: 'Portugal' },
  { code: 'GR', name: 'Greece' }, { code: 'RO', name: 'Romania' },
  { code: 'HU', name: 'Hungary' }, { code: 'CL', name: 'Chile' },
  { code: 'PE', name: 'Peru' }, { code: 'PK', name: 'Pakistan' },
  { code: 'NZ', name: 'New Zealand' }, { code: 'IE', name: 'Ireland' },
  { code: 'CN', name: 'China' }, { code: 'HK', name: 'Hong Kong' },
  { code: 'BG', name: 'Bulgaria' }, { code: 'HR', name: 'Croatia' },
  { code: 'RS', name: 'Serbia' }, { code: 'EC', name: 'Ecuador' },
];

async function scrapeInsecamPage(country) {
  let inserted = 0;
  try {
    const listRes = await fetch(`http://www.insecam.org/en/bycountry/${country.code}/?page=1`, {
      headers: { 'User-Agent': UA },
      signal: AbortSignal.timeout(10000)
    });
    if (!listRes.ok) return 0;
    const html = await listRes.text();
    
    const ids = [...html.matchAll(/href="\/en\/view\/(\d+)\/"/g)].map(m => m[1]);
    const streams = [...html.matchAll(/img-responsive.*?src="([^"]+)"/g)].map(m => m[1]);
    
    for (let i = 0; i < ids.length; i++) {
      if (!streams[i]) continue;
      try {
        const dRes = await fetch(`http://www.insecam.org/en/view/${ids[i]}/`, {
          headers: { 'User-Agent': UA },
          signal: AbortSignal.timeout(8000)
        });
        if (!dRes.ok) continue;
        const dHtml = await dRes.text();
        
        const coord = dHtml.match(/setView\(\[([0-9.-]+),\s*([0-9.-]+)\]/);
        if (!coord) continue;
        const lat = parseFloat(coord[1]);
        const lng = parseFloat(coord[2]);
        if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;
        
        const titleM = dHtml.match(/<h1[^>]*>Live camera ([^,<]+)/);
        const city = titleM ? titleM[1].trim() : '';
        
        const ok = await insertCam({
          externalId: `insecam_${ids[i]}`,
          name: city ? `${city} Camera` : `${country.name} Camera #${ids[i]}`,
          lat, lng,
          country: country.name, countryCode: country.code,
          city: city || country.name,
          source: 'insecam', sourceApi: `http://www.insecam.org/en/view/${ids[i]}/`,
          feedUrl: streams[i], feedType: 'stream'
        });
        if (ok) inserted++;
        await sleep(500);
      } catch { continue; }
    }
  } catch { /* skip country */ }
  return inserted;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  FAST GLOBAL CAMERA SEEDER — Immediate Coverage             ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  let total = 0;
  
  // 511 Systems
  console.log('━━━ 511 Georgia ━━━');
  const ga = await fetch511('https://511ga.org', 'Georgia', '511_georgia');
  console.log(`  Inserted: ${ga}`);
  total += ga;
  
  console.log('━━━ 511 Louisiana ━━━');
  const la = await fetch511('https://511la.org', 'Louisiana', '511_louisiana');
  console.log(`  Inserted: ${la}`);
  total += la;
  
  // Insecam Global
  console.log('━━━ Insecam Global (50 countries, 1 page each) ━━━');
  for (const c of COUNTRIES) {
    const ins = await scrapeInsecamPage(c);
    if (ins > 0) process.stdout.write(`  ✓ ${c.name}: ${ins} | `);
    total += ins;
    await sleep(1500);
  }
  
  // Final stats
  console.log('\n');
  const [rows] = await pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT countryCode) as countries FROM sigint_cameras');
  const [byCountry] = await pool.query('SELECT countryCode, COUNT(*) as cnt FROM sigint_cameras GROUP BY countryCode ORDER BY cnt DESC');
  
  console.log('═══════════════════════════════════════════════════');
  console.log(`  TOTAL: ${rows[0].total} cameras | ${rows[0].countries} countries`);
  console.log(`  NEW: ${total}`);
  console.log('  BY COUNTRY:');
  for (const r of byCountry) console.log(`    ${r.countryCode}: ${r.cnt}`);
  console.log('═══════════════════════════════════════════════════');
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
