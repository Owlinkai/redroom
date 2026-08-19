/**
 * trigger-global-crawl.mjs
 * Creates a one-time crawl mission that covers ALL regions including the newly added ones.
 * Run: node scripts/trigger-global-crawl.mjs
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const m = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
if (!m) { console.error("Cannot parse DATABASE_URL"); process.exit(1); }
const [, user, pass, host, port, database] = m;

const conn = await mysql.createConnection({
  host, port: parseInt(port), user, password: pass, database,
  ssl: { rejectUnauthorized: false },
});

// Get IDs of all newly inserted agencies (those with no articles yet)
const [newAgencies] = await conn.execute(`
  SELECT na.id, na.name, na.country, na.region
  FROM news_agencies na
  LEFT JOIN articles a ON a.agencyId = na.id
  WHERE na.isActive = 1
  GROUP BY na.id, na.name, na.country, na.region
  HAVING COUNT(a.id) = 0
  ORDER BY na.region, na.country
`);

console.log(`\n🌍 Found ${newAgencies.length} agencies with zero articles. Creating crawl mission...\n`);
newAgencies.forEach(a => console.log(`  - ${a.name} (${a.country} / ${a.region})`));

if (newAgencies.length === 0) {
  console.log("All agencies already have articles. Nothing to do.");
  await conn.end();
  process.exit(0);
}

const agencyIds = newAgencies.map(a => a.id);
const regions = [...new Set(newAgencies.map(a => a.region))];

// Create a one-time crawl mission targeting all zero-article agencies
const nextRun = new Date(Date.now() + 10000); // 10 seconds from now
const [result] = await conn.execute(
  `INSERT INTO crawl_missions (
    name, codename, description,
    targetAgencyIds, targetCountries, targetRegions, targetTypes, targetTopics,
    cronExpression, intervalMinutes, isRecurring, priority, classification,
    isActive, isRunning, nextRunAt, createdAt, updatedAt
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [
    "Global Coverage Expansion — All New Countries",
    "GLOBAL-EXPANSION-001",
    `One-time crawl mission for ${newAgencies.length} newly added agencies across ${regions.length} regions`,
    JSON.stringify(agencyIds),
    JSON.stringify([]),
    JSON.stringify(regions),
    JSON.stringify([]),
    JSON.stringify(["geopolitics", "security", "politics", "economy", "conflict"]),
    "0 */6 * * *",  // every 6 hours going forward
    360,
    true,           // isRecurring — keep it running every 6 hours
    "high",
    "UNCLASSIFIED",
    true,           // isActive
    false,          // isRunning
    nextRun,
  ]
);

const missionId = result.insertId;
console.log(`\n✅ Created crawl mission ID ${missionId} — will auto-start in ~10 seconds via MissionScheduler`);
console.log(`   Targeting ${agencyIds.length} agencies across regions: ${regions.join(", ")}`);
console.log(`   Schedule: every 6 hours (recurring)\n`);

await conn.end();
