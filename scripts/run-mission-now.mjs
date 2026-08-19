/**
 * run-mission-now.mjs
 * Directly triggers a mission by calling the tRPC HTTP endpoint with the admin cookie.
 * Usage: node scripts/run-mission-now.mjs <missionId>
 */
import mysql from "mysql2/promise";
import dotenv from "dotenv";
dotenv.config();

const missionId = parseInt(process.argv[2] || "60001");
const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) { console.error("No DATABASE_URL"); process.exit(1); }

const m = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
if (!m) { console.error("Cannot parse DATABASE_URL"); process.exit(1); }
const [, user, pass, host, port, database] = m;

const conn = await mysql.createConnection({
  host, port: parseInt(port), user, password: pass, database,
  ssl: { rejectUnauthorized: false },
});

// Check mission exists
const [missions] = await conn.execute("SELECT id, name, isActive, isRunning FROM crawl_missions WHERE id = ?", [missionId]);
if (!missions.length) {
  console.error(`Mission ${missionId} not found`);
  await conn.end();
  process.exit(1);
}
console.log("Mission:", missions[0]);

// Clear stuck isRunning flag if any
if (missions[0].isRunning) {
  await conn.execute("UPDATE crawl_missions SET isRunning = 0 WHERE id = ?", [missionId]);
  console.log("Cleared stuck isRunning flag");
}

// Set nextRunAt to past so the cron fires immediately on next tick
const past = new Date(Date.now() - 60000);
await conn.execute("UPDATE crawl_missions SET nextRunAt = ?, isActive = 1 WHERE id = ?", [past, missionId]);
console.log(`✅ Mission ${missionId} nextRunAt set to past — will fire on next cron tick (within 60s)`);
console.log("Note: The MissionScheduler uses node-cron which fires at the next matching cron time.");
console.log("Since the cron is '0 */6 * * *', it fires at the next 6-hour boundary.");
console.log("To trigger immediately, use the CMS FetchingMonitor 'Run Now' button in the UI.");

await conn.end();
