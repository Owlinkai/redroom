/**
 * Global Camera Seeder v2 — OSINT Intelligence Platform
 * Adds cameras from:
 * 1. 511 Georgia (3,938 cameras)
 * 2. 511 Louisiana (336 cameras)  
 * 3. Insecam.org (50+ countries, real coordinates from detail pages)
 */

import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error('DATABASE_URL not set'); process.exit(1); }
const pool = mysql.createPool(DB_URL + '&connectionLimit=5');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// ─── INSERT HELPER ───────────────────────────────────────────────────────────
async function insertCamera(cam) {
  try {
    await pool.query(
      `INSERT IGNORE INTO sigint_cameras 
       (externalId, name, latitude, longitude, country, countryCode, city, source, sourceApi, feedUrl, feedType, isActive) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [cam.externalId, cam.name, cam.lat, cam.lng, cam.country, cam.countryCode, 
       cam.city, cam.source, cam.sourceApi, cam.feedUrl, cam.feedType, 1]
    );
    return true;
  } catch (e) {
    return false;
  }
}

// ─── 511 SYSTEMS ─────────────────────────────────────────────────────────────
async function fetch511(baseUrl, stateName, sourceKey) {
  const pageSize = 500;
  let start = 0;
  let inserted = 0;
  let total = 0;

  while (true) {
    try {
      const res = await fetch(`${baseUrl}/List/GetData/Cameras?start=${start}&length=${pageSize}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `draw=1&start=${start}&length=${pageSize}`,
        signal: AbortSignal.timeout(15000)
      });
      const data = await res.json();
      if (!data.data || data.data.length === 0) break;
      total = data.recordsTotal || 0;

      for (const cam of data.data) {
        const match = cam.latLng?.geography?.wellKnownText?.match(/POINT\s*\(([0-9.-]+)\s+([0-9.-]+)\)/);
        if (!match) continue;
        const lng = parseFloat(match[1]);
        const lat = parseFloat(match[2]);
        const imageId = cam.images?.[0]?.id;
        if (!imageId || isNaN(lat) || isNaN(lng)) continue;

        const ok = await insertCamera({
          externalId: `${sourceKey}_${cam.id}`,
          name: cam.location || cam.roadway || `Camera ${cam.id}`,
          lat, lng,
          country: 'United States',
          countryCode: 'US',
          city: cam.city || stateName,
          source: sourceKey,
          sourceApi: `${baseUrl}/List/GetData/Cameras`,
          feedUrl: `${baseUrl}/map/Cctv/${imageId}`,
          feedType: 'image'
        });
        if (ok) inserted++;
      }

      start += pageSize;
      if (start >= total) break;
      await sleep(500);
    } catch (e) {
      console.error(`  Error at offset ${start}: ${e.message}`);
      break;
    }
  }
  return { inserted, total };
}

// ─── INSECAM SCRAPER ─────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: 'JP', name: 'Japan', pages: 12 },
  { code: 'KR', name: 'South Korea', pages: 6 },
  { code: 'DE', name: 'Germany', pages: 8 },
  { code: 'FR', name: 'France', pages: 6 },
  { code: 'IT', name: 'Italy', pages: 5 },
  { code: 'ES', name: 'Spain', pages: 4 },
  { code: 'NL', name: 'Netherlands', pages: 3 },
  { code: 'BR', name: 'Brazil', pages: 5 },
  { code: 'MX', name: 'Mexico', pages: 3 },
  { code: 'AR', name: 'Argentina', pages: 3 },
  { code: 'CO', name: 'Colombia', pages: 2 },
  { code: 'IN', name: 'India', pages: 4 },
  { code: 'RU', name: 'Russia', pages: 10 },
  { code: 'UA', name: 'Ukraine', pages: 3 },
  { code: 'TR', name: 'Turkey', pages: 3 },
  { code: 'AU', name: 'Australia', pages: 3 },
  { code: 'ZA', name: 'South Africa', pages: 2 },
  { code: 'TH', name: 'Thailand', pages: 3 },
  { code: 'VN', name: 'Vietnam', pages: 2 },
  { code: 'ID', name: 'Indonesia', pages: 2 },
  { code: 'PH', name: 'Philippines', pages: 2 },
  { code: 'MY', name: 'Malaysia', pages: 2 },
  { code: 'TW', name: 'Taiwan', pages: 4 },
  { code: 'IL', name: 'Israel', pages: 2 },
  { code: 'AE', name: 'United Arab Emirates', pages: 2 },
  { code: 'SA', name: 'Saudi Arabia', pages: 1 },
  { code: 'EG', name: 'Egypt', pages: 1 },
  { code: 'NG', name: 'Nigeria', pages: 1 },
  { code: 'KE', name: 'Kenya', pages: 1 },
  { code: 'PL', name: 'Poland', pages: 3 },
  { code: 'CZ', name: 'Czech Republic', pages: 2 },
  { code: 'AT', name: 'Austria', pages: 2 },
  { code: 'CH', name: 'Switzerland', pages: 2 },
  { code: 'SE', name: 'Sweden', pages: 2 },
  { code: 'NO', name: 'Norway', pages: 2 },
  { code: 'DK', name: 'Denmark', pages: 2 },
  { code: 'BE', name: 'Belgium', pages: 2 },
  { code: 'PT', name: 'Portugal', pages: 2 },
  { code: 'GR', name: 'Greece', pages: 2 },
  { code: 'RO', name: 'Romania', pages: 2 },
  { code: 'HU', name: 'Hungary', pages: 2 },
  { code: 'CL', name: 'Chile', pages: 2 },
  { code: 'PE', name: 'Peru', pages: 1 },
  { code: 'PK', name: 'Pakistan', pages: 1 },
  { code: 'NZ', name: 'New Zealand', pages: 2 },
  { code: 'IE', name: 'Ireland', pages: 2 },
  { code: 'CN', name: 'China', pages: 2 },
  { code: 'HK', name: 'Hong Kong', pages: 2 },
  { code: 'BG', name: 'Bulgaria', pages: 1 },
  { code: 'HR', name: 'Croatia', pages: 1 },
];

async function scrapeInsecamCountry(country) {
  let inserted = 0;
  
  for (let page = 1; page <= country.pages; page++) {
    try {
      // Get listing page for camera IDs and stream URLs
      const listRes = await fetch(`http://www.insecam.org/en/bycountry/${country.code}/?page=${page}`, {
        headers: { 'User-Agent': UA },
        signal: AbortSignal.timeout(10000)
      });
      if (!listRes.ok) break;
      const listHtml = await listRes.text();
      
      const ids = [...listHtml.matchAll(/href="\/en\/view\/(\d+)\/"/g)].map(m => m[1]);
      const streams = [...listHtml.matchAll(/img-responsive.*?src="([^"]+)"/g)].map(m => m[1]);
      
      if (ids.length === 0) break;
      
      // Get coordinates from each detail page
      for (let i = 0; i < ids.length; i++) {
        const camId = ids[i];
        const streamUrl = streams[i];
        if (!streamUrl) continue;
        
        try {
          const detailRes = await fetch(`http://www.insecam.org/en/view/${camId}/`, {
            headers: { 'User-Agent': UA },
            signal: AbortSignal.timeout(10000)
          });
          if (!detailRes.ok) continue;
          const detailHtml = await detailRes.text();
          
          const coordMatch = detailHtml.match(/setView\(\[([0-9.-]+),\s*([0-9.-]+)\]/);
          if (!coordMatch) continue;
          
          const lat = parseFloat(coordMatch[1]);
          const lng = parseFloat(coordMatch[2]);
          if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) continue;
          
          // Extract city from title
          const titleMatch = detailHtml.match(/<h1[^>]*>Live camera ([^,<]+)/);
          const city = titleMatch ? titleMatch[1].trim() : '';
          
          const ok = await insertCamera({
            externalId: `insecam_${camId}`,
            name: city ? `${city} Camera` : `Insecam #${camId}`,
            lat, lng,
            country: country.name,
            countryCode: country.code,
            city: city || country.name,
            source: 'insecam',
            sourceApi: `http://www.insecam.org/en/view/${camId}/`,
            feedUrl: streamUrl,
            feedType: 'stream'
          });
          if (ok) inserted++;
          
          await sleep(600); // Rate limit between detail pages
        } catch (e) {
          continue;
        }
      }
      
      await sleep(1000); // Rate limit between listing pages
    } catch (e) {
      break;
    }
  }
  
  return inserted;
}

// ─── MAIN ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  SIGINT GLOBAL CAMERA SEEDER v2 — Real OSINT Data Only      ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  
  let grandTotal = 0;
  
  // Phase 1: 511 Georgia
  console.log('━━━ Phase 1: 511 Georgia ━━━');
  const ga = await fetch511('https://511ga.org', 'Georgia', '511_georgia');
  console.log(`  API reports ${ga.total} cameras, inserted ${ga.inserted}`);
  grandTotal += ga.inserted;
  
  // Phase 2: 511 Louisiana
  console.log('━━━ Phase 2: 511 Louisiana ━━━');
  const la = await fetch511('https://511la.org', 'Louisiana', '511_louisiana');
  console.log(`  API reports ${la.total} cameras, inserted ${la.inserted}`);
  grandTotal += la.inserted;
  
  // Phase 3: Insecam Global
  console.log('━━━ Phase 3: Insecam Global (50 countries) ━━━');
  for (const country of COUNTRIES) {
    process.stdout.write(`  ${country.name} (${country.code})...`);
    const ins = await scrapeInsecamCountry(country);
    console.log(` ${ins} cameras`);
    grandTotal += ins;
    await sleep(2000); // Rate limit between countries
  }
  
  // Final stats
  const [rows] = await pool.query('SELECT COUNT(*) as total, COUNT(DISTINCT countryCode) as countries FROM sigint_cameras');
  const [byCountry] = await pool.query('SELECT countryCode, COUNT(*) as cnt FROM sigint_cameras GROUP BY countryCode ORDER BY cnt DESC LIMIT 20');
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  TOTAL CAMERAS IN DB: ${rows[0].total}`);
  console.log(`  COUNTRIES COVERED: ${rows[0].countries}`);
  console.log(`  NEW CAMERAS ADDED: ${grandTotal}`);
  console.log('  TOP COUNTRIES:');
  for (const row of byCountry) {
    console.log(`    ${row.countryCode}: ${row.cnt}`);
  }
  console.log('═══════════════════════════════════════════════════');
  
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
