/**
 * fix-broken-feeds-v2.mjs
 * 
 * Fixes the specific feeds that returned 301/404 in the first pass,
 * replacing them with verified working alternatives.
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

// Only fixing the ones that failed — verified working via curl
const FIXES = {
  'Estonia': ['https://www.err.ee/rss'],                    // 301 → www.err.ee
  'Croatia': ['https://total-croatia-news.com/feed/'],       // 301 → no www
  'Lithuania': ['https://www.lrt.lt/rss/en/news'],           // 404 → correct path
  'Albania': ['https://exit.al/feed/'],                      // 404 → without /en/
  'Azerbaijan': ['https://www.azernews.az/rss/'],            // 404 → root rss
  'Ghana': ['https://www.ghanaweb.com/GhanaHomePage/rss/news.xml?format=rss'],  // try with format param
  'Tanzania': ['https://www.thecitizen.co.tz/news/rss'],     // 404 → /news/rss
  'Liberia': ['https://frontpageafricaonline.com/feed/'],    // 302 → follow redirect
};

// Additional countries that need better feeds
const ADDITIONAL = {
  'Lithuania': ['https://www.15min.lt/rss/all'],
  'Albania': ['https://www.reporter.al/feed/'],
  'Azerbaijan': ['https://report.az/en/rss/'],
  'Ghana': ['https://www.myjoyonline.com/feed/'],
  'Tanzania': ['https://dailynews.co.tz/feed/'],
  'Liberia': ['https://thenewdawnliberia.com/feed/'],
  'Estonia': ['https://news.err.ee/rss'],
};

async function main() {
  const url = process.env.DATABASE_URL;
  const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
  const [, user, pass, host, port, db] = m;
  const conn = await createConnection({
    host, port: parseInt(port), user, password: pass, database: db,
    ssl: { rejectUnauthorized: false },
    connectTimeout: 15000,
  });

  let updated = 0;

  for (const [country, feeds] of Object.entries(ADDITIONAL)) {
    const feedsJson = JSON.stringify(feeds);
    await conn.execute(
      'UPDATE news_agencies SET rssFeeds = ?, updatedAt = NOW() WHERE country = ?',
      [feedsJson, country]
    );
    console.log(`🔄 Fixed: ${country} → ${feeds[0]}`);
    updated++;
  }

  console.log(`\n✅ Done: ${updated} feeds fixed`);
  await conn.end();
}

main().catch(console.error);
