import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

const url = process.env.DATABASE_URL;
const m = url.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
const [, user, pass, host, port, db] = m;
const conn = await createConnection({
  host, port: parseInt(port), user, password: pass, database: db,
  ssl: { rejectUnauthorized: false },
  connectTimeout: 15000,
});

const [total] = await conn.execute('SELECT COUNT(*) as cnt FROM articles');
console.log('Total articles:', total[0].cnt);

const [bycountry] = await conn.execute(`
  SELECT na.country, COUNT(a.id) as cnt 
  FROM news_agencies na 
  LEFT JOIN articles a ON a.agencyId = na.id 
  GROUP BY na.country 
  ORDER BY cnt DESC
`);

const withArticles = bycountry.filter(r => r.cnt > 0);
const withoutArticles = bycountry.filter(r => r.cnt === 0);

console.log(`\nCountries WITH articles (${withArticles.length}):`);
withArticles.forEach(r => console.log(`  ${r.country}: ${r.cnt}`));

console.log(`\nCountries WITHOUT articles (${withoutArticles.length}):`);
withoutArticles.forEach(r => console.log(`  ${r.country}`));

await conn.end();
