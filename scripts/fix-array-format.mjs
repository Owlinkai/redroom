import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';

config({ path: '/home/ubuntu/geopolitical-news-intelligence/.env' });

const DB_URL = process.env.DATABASE_URL;
const m = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
const [, user, pass, host, port, db] = m;

const conn = await createConnection({
  host, port: parseInt(port), user, password: pass, database: db,
  ssl: { rejectUnauthorized: false }
});

const [agencies] = await conn.execute('SELECT id, name, country, rssFeeds FROM news_agencies ORDER BY id');
console.log(`Checking ${agencies.length} agencies...`);

let fixed = 0, alreadyOk = 0, empty = 0;

for (const agency of agencies) {
  const raw = agency.rssFeeds;
  if (!raw || raw === null) { empty++; continue; }

  let parsed;
  try { parsed = typeof raw === 'string' ? JSON.parse(raw) : raw; }
  catch { parsed = raw; }

  if (Array.isArray(parsed)) { alreadyOk++; continue; }

  if (typeof parsed === 'string' && parsed.startsWith('http')) {
    const arrayJson = JSON.stringify([parsed]);
    try {
      await conn.execute('UPDATE news_agencies SET rssFeeds = ? WHERE id = ?', [arrayJson, agency.id]);
      fixed++;
      console.log('Fixed ID=' + agency.id + ' ' + agency.country + ' -- ' + agency.name);
    } catch (e) {
      console.error('Failed ID=' + agency.id + ': ' + e.message);
    }
  } else {
    empty++;
  }
}

console.log('\nDONE: Total=' + agencies.length + ' Fixed=' + fixed + ' AlreadyOK=' + alreadyOk + ' Empty=' + empty);
await conn.end();
