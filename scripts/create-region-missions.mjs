/**
 * create-region-missions.mjs
 * 
 * Creates 12-hour crawl missions for every region that doesn't already have one.
 * MENA already has a 4-hour mission (ID 1) — we leave that untouched.
 * We also activate mission 60001 (the global 6h mission) which is currently inactive.
 */

import { createConnection } from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

const m = process.env.DATABASE_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
const conn = await createConnection({
  host: m[3], port: +m[4], user: m[1], password: m[2], database: m[5],
  ssl: { rejectUnauthorized: false }
});

// Get all distinct regions from news_agencies
const [regionRows] = await conn.execute(`
  SELECT DISTINCT region FROM news_agencies WHERE region IS NOT NULL AND region != '' ORDER BY region
`);
const allRegions = regionRows.map(r => r.region);
console.log('All regions in DB:', allRegions.join(', '));

// Get existing missions to avoid duplicates
const [existingMissions] = await conn.execute('SELECT id, name, targetRegions, isActive FROM crawl_missions');
console.log('\nExisting missions:');
existingMissions.forEach(m => {
  const regions = typeof m.targetRegions === 'string' ? JSON.parse(m.targetRegions) : m.targetRegions;
  console.log(`  [${m.id}] ${m.name} → regions: ${JSON.stringify(regions)} | active: ${m.isActive}`);
});

// Activate mission 60001 (global 6h mission) if it exists and is inactive
const globalMission = existingMissions.find(m => m.id === 60001);
if (globalMission && !globalMission.isActive) {
  await conn.execute('UPDATE crawl_missions SET isActive = 1 WHERE id = 60001');
  console.log('\n✅ Activated global mission 60001 (was inactive)');
}

// Determine which regions already have a dedicated mission
const coveredRegions = new Set();
for (const mission of existingMissions) {
  const regions = typeof mission.targetRegions === 'string' ? JSON.parse(mission.targetRegions) : (mission.targetRegions || []);
  // Only count as "covered" if it's a single-region mission (dedicated)
  if (regions.length === 1) {
    coveredRegions.add(regions[0]);
  }
}
console.log('\nRegions with dedicated missions:', [...coveredRegions].join(', ') || 'none');

// Region definitions: name → cron (every 12h at different offsets to spread load)
const regionMissions = [
  { region: 'Europe',           cron: '0 0,12 * * *',   offset: 0  },
  { region: 'Sub-Saharan Africa', cron: '0 1,13 * * *', offset: 1  },
  { region: 'North Africa',     cron: '0 2,14 * * *',   offset: 2  },
  { region: 'South Asia',       cron: '0 3,15 * * *',   offset: 3  },
  { region: 'East Asia',        cron: '0 4,16 * * *',   offset: 4  },
  { region: 'Southeast Asia',   cron: '0 5,17 * * *',   offset: 5  },
  { region: 'Americas',         cron: '0 6,18 * * *',   offset: 6  },
  { region: 'Latin America',    cron: '0 6,18 * * *',   offset: 6  },
  { region: 'Caucasus',         cron: '0 7,19 * * *',   offset: 7  },
  { region: 'Central Asia',     cron: '0 7,19 * * *',   offset: 7  },
  { region: 'Pacific',          cron: '0 8,20 * * *',   offset: 8  },
  { region: 'Asia-Pacific',     cron: '0 8,20 * * *',   offset: 8  },
  { region: 'Global',           cron: '0 9,21 * * *',   offset: 9  },
  { region: 'North America',    cron: '0 10,22 * * *',  offset: 10 },
  { region: 'Africa',           cron: '0 11,23 * * *',  offset: 11 },
];

let created = 0;
let skipped = 0;

for (const { region, cron } of regionMissions) {
  // Skip if this region isn't in the DB
  if (!allRegions.includes(region)) {
    console.log(`⏭️  Region "${region}" not found in DB — skipping`);
    skipped++;
    continue;
  }

  // Skip MENA — already has a 4h mission
  if (region === 'MENA') {
    console.log(`⏭️  MENA already has a dedicated 4h mission — skipping`);
    skipped++;
    continue;
  }

  // Check if a dedicated mission already exists for this region
  const alreadyExists = existingMissions.some(m => {
    const regions = typeof m.targetRegions === 'string' ? JSON.parse(m.targetRegions) : (m.targetRegions || []);
    return regions.length === 1 && regions[0] === region;
  });

  if (alreadyExists) {
    console.log(`⏭️  Mission for "${region}" already exists — skipping`);
    skipped++;
    continue;
  }

  // Get agency IDs for this region
  const [agencyRows] = await conn.execute(
    'SELECT id FROM news_agencies WHERE region = ?',
    [region]
  );
  const agencyIds = agencyRows.map(r => r.id);

  if (agencyIds.length === 0) {
    console.log(`⚠️  No agencies for region "${region}" — skipping`);
    skipped++;
    continue;
  }

  const now = new Date();
  const missionName = `${region} 12H Crawler`;
  const codename = region.replace(/[^A-Z0-9]/gi, '').toUpperCase().substring(0, 8) + '_12H';

  await conn.execute(`
    INSERT INTO crawl_missions (
      name, codename, description, targetAgencyIds, targetCountries, targetRegions,
      targetTypes, targetTopics, cronExpression, intervalMinutes, isRecurring,
      priority, classification, isActive, isRunning, lastRunAt, nextRunAt,
      lastRunJobIds, totalRuns, totalArticlesCollected, createdAt, updatedAt, minArticlesPerRun
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    missionName,
    codename,
    `Automated 12-hour intelligence acquisition for ${region}`,
    JSON.stringify(agencyIds),
    JSON.stringify([]),
    JSON.stringify([region]),
    JSON.stringify([]),
    JSON.stringify(['geopolitics', 'security', 'politics', 'economy', 'conflict']),
    cron,
    720, // 12 hours in minutes
    1,   // isRecurring
    'high',
    'UNCLASSIFIED',
    1,   // isActive
    0,   // isRunning
    null, // lastRunAt
    new Date(now.getTime() + 60000), // nextRunAt: 1 minute from now for first run
    JSON.stringify([]),
    0,
    0,
    now,
    now,
    0
  ]);

  console.log(`✅ Created mission: "${missionName}" (${agencyIds.length} agencies) | cron: ${cron}`);
  created++;
}

console.log(`\n=== SUMMARY ===`);
console.log(`Created: ${created} new missions`);
console.log(`Skipped: ${skipped}`);

// Final: list all active missions
const [finalMissions] = await conn.execute(
  'SELECT id, name, targetRegions, isActive, cronExpression FROM crawl_missions ORDER BY id'
);
console.log('\n=== ALL MISSIONS ===');
finalMissions.forEach(m => {
  const regions = typeof m.targetRegions === 'string' ? JSON.parse(m.targetRegions) : m.targetRegions;
  console.log(`  [${m.id}] ${m.name} | active:${m.isActive} | cron:${m.cronExpression} | regions:${JSON.stringify(regions)}`);
});

await conn.end();
