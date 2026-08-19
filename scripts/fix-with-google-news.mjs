/**
 * fix-with-google-news.mjs
 * 
 * Updates all countries with 0 articles to use Google News RSS feeds.
 * Google News RSS is always reachable from any datacenter worldwide.
 * Format: https://news.google.com/rss/search?q=COUNTRY+news&hl=en-US&gl=US&ceid=US:en
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

// ISO 3166-1 alpha-2 country codes for geo-based feeds
// For countries without a geo feed, we use the search-based feed
const COUNTRY_GOOGLE_NEWS = {
  // Europe
  'Estonia': 'https://news.google.com/rss/search?q=Estonia+news&hl=en-US&gl=US&ceid=US:en',
  'Latvia': 'https://news.google.com/rss/search?q=Latvia+news&hl=en-US&gl=US&ceid=US:en',
  'Lithuania': 'https://news.google.com/rss/search?q=Lithuania+news&hl=en-US&gl=US&ceid=US:en',
  'Moldova': 'https://news.google.com/rss/search?q=Moldova+news&hl=en-US&gl=US&ceid=US:en',
  'Belgium': 'https://news.google.com/rss/search?q=Belgium+news&hl=en-US&gl=US&ceid=US:en',
  'Austria': 'https://news.google.com/rss/search?q=Austria+news&hl=en-US&gl=US&ceid=US:en',
  'Slovakia': 'https://news.google.com/rss/search?q=Slovakia+news&hl=en-US&gl=US&ceid=US:en',
  'Croatia': 'https://news.google.com/rss/search?q=Croatia+news&hl=en-US&gl=US&ceid=US:en',
  'Slovenia': 'https://news.google.com/rss/search?q=Slovenia+news&hl=en-US&gl=US&ceid=US:en',
  'Serbia': 'https://news.google.com/rss/search?q=Serbia+news&hl=en-US&gl=US&ceid=US:en',
  'Bosnia': 'https://news.google.com/rss/search?q=Bosnia+news&hl=en-US&gl=US&ceid=US:en',
  'Bosnia and Herzegovina': 'https://news.google.com/rss/search?q=Bosnia+Herzegovina+news&hl=en-US&gl=US&ceid=US:en',
  'Montenegro': 'https://news.google.com/rss/search?q=Montenegro+news&hl=en-US&gl=US&ceid=US:en',
  'Albania': 'https://news.google.com/rss/search?q=Albania+news&hl=en-US&gl=US&ceid=US:en',
  'Kosovo': 'https://news.google.com/rss/search?q=Kosovo+news&hl=en-US&gl=US&ceid=US:en',
  'North Macedonia': 'https://news.google.com/rss/search?q=North+Macedonia+news&hl=en-US&gl=US&ceid=US:en',
  'Luxembourg': 'https://news.google.com/rss/search?q=Luxembourg+news&hl=en-US&gl=US&ceid=US:en',
  'Portugal': 'https://news.google.com/rss/search?q=Portugal+news&hl=en-US&gl=US&ceid=US:en',
  'Denmark': 'https://news.google.com/rss/search?q=Denmark+news&hl=en-US&gl=US&ceid=US:en',
  'Finland': 'https://news.google.com/rss/search?q=Finland+news&hl=en-US&gl=US&ceid=US:en',
  'Norway': 'https://news.google.com/rss/search?q=Norway+news&hl=en-US&gl=US&ceid=US:en',
  'Sweden': 'https://news.google.com/rss/search?q=Sweden+news&hl=en-US&gl=US&ceid=US:en',
  'Switzerland': 'https://news.google.com/rss/search?q=Switzerland+news&hl=en-US&gl=US&ceid=US:en',
  'Italy': 'https://news.google.com/rss/search?q=Italy+news&hl=en-US&gl=US&ceid=US:en',
  'Ireland': 'https://news.google.com/rss/search?q=Ireland+news&hl=en-US&gl=US&ceid=US:en',
  'Malta': 'https://news.google.com/rss/search?q=Malta+news&hl=en-US&gl=US&ceid=US:en',
  'Cyprus': 'https://news.google.com/rss/search?q=Cyprus+news&hl=en-US&gl=US&ceid=US:en',
  'Iceland': 'https://news.google.com/rss/search?q=Iceland+news&hl=en-US&gl=US&ceid=US:en',
  'Ukraine': 'https://news.google.com/rss/search?q=Ukraine+news&hl=en-US&gl=US&ceid=US:en',

  // Africa
  'Tanzania': 'https://news.google.com/rss/search?q=Tanzania+news&hl=en-US&gl=US&ceid=US:en',
  'Djibouti': 'https://news.google.com/rss/search?q=Djibouti+news&hl=en-US&gl=US&ceid=US:en',
  "Côte d'Ivoire": 'https://news.google.com/rss/search?q=Ivory+Coast+news&hl=en-US&gl=US&ceid=US:en',
  'Democratic Republic of the Congo': 'https://news.google.com/rss/search?q=DRC+Congo+news&hl=en-US&gl=US&ceid=US:en',
  'Central African Republic': 'https://news.google.com/rss/search?q=Central+African+Republic+news&hl=en-US&gl=US&ceid=US:en',
  'Guinea': 'https://news.google.com/rss/search?q=Guinea+news+Africa&hl=en-US&gl=US&ceid=US:en',
  'Madagascar': 'https://news.google.com/rss/search?q=Madagascar+news&hl=en-US&gl=US&ceid=US:en',
  'Cameroon': 'https://news.google.com/rss/search?q=Cameroon+news&hl=en-US&gl=US&ceid=US:en',
  'Cape Verde': 'https://news.google.com/rss/search?q=Cape+Verde+news&hl=en-US&gl=US&ceid=US:en',
  'Senegal': 'https://news.google.com/rss/search?q=Senegal+news&hl=en-US&gl=US&ceid=US:en',
  'Ghana': 'https://news.google.com/rss/search?q=Ghana+news&hl=en-US&gl=US&ceid=US:en',
  'Zambia': 'https://news.google.com/rss/search?q=Zambia+news&hl=en-US&gl=US&ceid=US:en',
  'Liberia': 'https://news.google.com/rss/search?q=Liberia+news&hl=en-US&gl=US&ceid=US:en',
  'Gabon': 'https://news.google.com/rss/search?q=Gabon+news&hl=en-US&gl=US&ceid=US:en',
  'Tunisia': 'https://news.google.com/rss/search?q=Tunisia+news&hl=en-US&gl=US&ceid=US:en',
  'Rwanda': 'https://news.google.com/rss/search?q=Rwanda+news&hl=en-US&gl=US&ceid=US:en',
  'Namibia': 'https://news.google.com/rss/search?q=Namibia+news&hl=en-US&gl=US&ceid=US:en',
  'Malawi': 'https://news.google.com/rss/search?q=Malawi+news&hl=en-US&gl=US&ceid=US:en',
  'Eswatini': 'https://news.google.com/rss/search?q=Eswatini+Swaziland+news&hl=en-US&gl=US&ceid=US:en',
  'Comoros': 'https://news.google.com/rss/search?q=Comoros+news&hl=en-US&gl=US&ceid=US:en',
  'Eritrea': 'https://news.google.com/rss/search?q=Eritrea+news&hl=en-US&gl=US&ceid=US:en',
  'Niger': 'https://news.google.com/rss/search?q=Niger+news+Africa&hl=en-US&gl=US&ceid=US:en',
  'Mali': 'https://news.google.com/rss/search?q=Mali+news&hl=en-US&gl=US&ceid=US:en',
  'Zimbabwe': 'https://news.google.com/rss/search?q=Zimbabwe+news&hl=en-US&gl=US&ceid=US:en',
  'Uganda': 'https://news.google.com/rss/search?q=Uganda+news&hl=en-US&gl=US&ceid=US:en',
  'Mauritania': 'https://news.google.com/rss/search?q=Mauritania+news&hl=en-US&gl=US&ceid=US:en',
  'Mauritius': 'https://news.google.com/rss/search?q=Mauritius+news&hl=en-US&gl=US&ceid=US:en',
  'Botswana': 'https://news.google.com/rss/search?q=Botswana+news&hl=en-US&gl=US&ceid=US:en',
  'Togo': 'https://news.google.com/rss/search?q=Togo+news+Africa&hl=en-US&gl=US&ceid=US:en',
  'Mozambique': 'https://news.google.com/rss/search?q=Mozambique+news&hl=en-US&gl=US&ceid=US:en',
  'Burkina Faso': 'https://news.google.com/rss/search?q=Burkina+Faso+news&hl=en-US&gl=US&ceid=US:en',
  'Equatorial Guinea': 'https://news.google.com/rss/search?q=Equatorial+Guinea+news&hl=en-US&gl=US&ceid=US:en',
  'Benin': 'https://news.google.com/rss/search?q=Benin+news+Africa&hl=en-US&gl=US&ceid=US:en',
  'Guinea-Bissau': 'https://news.google.com/rss/search?q=Guinea-Bissau+news&hl=en-US&gl=US&ceid=US:en',
  'Republic of the Congo': 'https://news.google.com/rss/search?q=Republic+Congo+Brazzaville+news&hl=en-US&gl=US&ceid=US:en',
  'Chad': 'https://news.google.com/rss/search?q=Chad+news+Africa&hl=en-US&gl=US&ceid=US:en',
  'Lesotho': 'https://news.google.com/rss/search?q=Lesotho+news&hl=en-US&gl=US&ceid=US:en',
  'Sierra Leone': 'https://news.google.com/rss/search?q=Sierra+Leone+news&hl=en-US&gl=US&ceid=US:en',
  'Somalia': 'https://news.google.com/rss/search?q=Somalia+news&hl=en-US&gl=US&ceid=US:en',
  'Algeria': 'https://news.google.com/rss/search?q=Algeria+news&hl=en-US&gl=US&ceid=US:en',
  'São Tomé and Príncipe': 'https://news.google.com/rss/search?q=Sao+Tome+Principe+news&hl=en-US&gl=US&ceid=US:en',
  'Seychelles': 'https://news.google.com/rss/search?q=Seychelles+news&hl=en-US&gl=US&ceid=US:en',
  'Bangladesh': 'https://news.google.com/rss/search?q=Bangladesh+news&hl=en-US&gl=US&ceid=US:en',

  // Middle East
  'Kuwait': 'https://news.google.com/rss/search?q=Kuwait+news&hl=en-US&gl=US&ceid=US:en',
  'Yemen': 'https://news.google.com/rss/search?q=Yemen+news&hl=en-US&gl=US&ceid=US:en',
  'Oman': 'https://news.google.com/rss/search?q=Oman+news&hl=en-US&gl=US&ceid=US:en',
  'Bahrain': 'https://news.google.com/rss/search?q=Bahrain+news&hl=en-US&gl=US&ceid=US:en',

  // Asia-Pacific
  'Sri Lanka': 'https://news.google.com/rss/search?q=Sri+Lanka+news&hl=en-US&gl=US&ceid=US:en',
  'Laos': 'https://news.google.com/rss/search?q=Laos+news&hl=en-US&gl=US&ceid=US:en',
  'Brunei': 'https://news.google.com/rss/search?q=Brunei+news&hl=en-US&gl=US&ceid=US:en',
  'Taiwan': 'https://news.google.com/rss/search?q=Taiwan+news&hl=en-US&gl=US&ceid=US:en',
  'Azerbaijan': 'https://news.google.com/rss/search?q=Azerbaijan+news&hl=en-US&gl=US&ceid=US:en',
  'Kyrgyzstan': 'https://news.google.com/rss/search?q=Kyrgyzstan+news&hl=en-US&gl=US&ceid=US:en',
  'Tajikistan': 'https://news.google.com/rss/search?q=Tajikistan+news&hl=en-US&gl=US&ceid=US:en',
  'Turkmenistan': 'https://news.google.com/rss/search?q=Turkmenistan+news&hl=en-US&gl=US&ceid=US:en',
  'Mongolia': 'https://news.google.com/rss/search?q=Mongolia+news&hl=en-US&gl=US&ceid=US:en',
  'Cambodia': 'https://news.google.com/rss/search?q=Cambodia+news&hl=en-US&gl=US&ceid=US:en',
  'Myanmar': 'https://news.google.com/rss/search?q=Myanmar+Burma+news&hl=en-US&gl=US&ceid=US:en',
  'Vietnam': 'https://news.google.com/rss/search?q=Vietnam+news&hl=en-US&gl=US&ceid=US:en',
  'Indonesia': 'https://news.google.com/rss/search?q=Indonesia+news&hl=en-US&gl=US&ceid=US:en',
  'Armenia': 'https://news.google.com/rss/search?q=Armenia+news&hl=en-US&gl=US&ceid=US:en',
  'Bhutan': 'https://news.google.com/rss/search?q=Bhutan+news&hl=en-US&gl=US&ceid=US:en',
  'Maldives': 'https://news.google.com/rss/search?q=Maldives+news&hl=en-US&gl=US&ceid=US:en',
  'Timor-Leste': 'https://news.google.com/rss/search?q=Timor-Leste+East+Timor+news&hl=en-US&gl=US&ceid=US:en',
  'Papua New Guinea': 'https://news.google.com/rss/search?q=Papua+New+Guinea+news&hl=en-US&gl=US&ceid=US:en',
  'Fiji': 'https://news.google.com/rss/search?q=Fiji+news&hl=en-US&gl=US&ceid=US:en',
  'Vanuatu': 'https://news.google.com/rss/search?q=Vanuatu+news&hl=en-US&gl=US&ceid=US:en',
  'Tonga': 'https://news.google.com/rss/search?q=Tonga+news&hl=en-US&gl=US&ceid=US:en',
  'Solomon Islands': 'https://news.google.com/rss/search?q=Solomon+Islands+news&hl=en-US&gl=US&ceid=US:en',
  'Kiribati': 'https://news.google.com/rss/search?q=Kiribati+news&hl=en-US&gl=US&ceid=US:en',
  'Samoa': 'https://news.google.com/rss/search?q=Samoa+news&hl=en-US&gl=US&ceid=US:en',

  // Americas
  'Guatemala': 'https://news.google.com/rss/search?q=Guatemala+news&hl=en-US&gl=US&ceid=US:en',
  'Chile': 'https://news.google.com/rss/search?q=Chile+news&hl=en-US&gl=US&ceid=US:en',
  'Dominican Republic': 'https://news.google.com/rss/search?q=Dominican+Republic+news&hl=en-US&gl=US&ceid=US:en',
  'El Salvador': 'https://news.google.com/rss/search?q=El+Salvador+news&hl=en-US&gl=US&ceid=US:en',
  'Suriname': 'https://news.google.com/rss/search?q=Suriname+news&hl=en-US&gl=US&ceid=US:en',
  'Barbados': 'https://news.google.com/rss/search?q=Barbados+news&hl=en-US&gl=US&ceid=US:en',
  'Trinidad and Tobago': 'https://news.google.com/rss/search?q=Trinidad+Tobago+news&hl=en-US&gl=US&ceid=US:en',
  'Jamaica': 'https://news.google.com/rss/search?q=Jamaica+news&hl=en-US&gl=US&ceid=US:en',
  'Haiti': 'https://news.google.com/rss/search?q=Haiti+news&hl=en-US&gl=US&ceid=US:en',
  'Nicaragua': 'https://news.google.com/rss/search?q=Nicaragua+news&hl=en-US&gl=US&ceid=US:en',
  'Honduras': 'https://news.google.com/rss/search?q=Honduras+news&hl=en-US&gl=US&ceid=US:en',
  'Costa Rica': 'https://news.google.com/rss/search?q=Costa+Rica+news&hl=en-US&gl=US&ceid=US:en',
  'Panama': 'https://news.google.com/rss/search?q=Panama+news&hl=en-US&gl=US&ceid=US:en',
  'Bolivia': 'https://news.google.com/rss/search?q=Bolivia+news&hl=en-US&gl=US&ceid=US:en',
  'Paraguay': 'https://news.google.com/rss/search?q=Paraguay+news&hl=en-US&gl=US&ceid=US:en',
  'Uruguay': 'https://news.google.com/rss/search?q=Uruguay+news&hl=en-US&gl=US&ceid=US:en',
  'Ecuador': 'https://news.google.com/rss/search?q=Ecuador+news&hl=en-US&gl=US&ceid=US:en',
  'Cuba': 'https://news.google.com/rss/search?q=Cuba+news&hl=en-US&gl=US&ceid=US:en',
  'Belize': 'https://news.google.com/rss/search?q=Belize+news&hl=en-US&gl=US&ceid=US:en',
  'Guyana': 'https://news.google.com/rss/search?q=Guyana+news&hl=en-US&gl=US&ceid=US:en',
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
  let inserted = 0;

  for (const [country, feedUrl] of Object.entries(COUNTRY_GOOGLE_NEWS)) {
    const feedsJson = JSON.stringify([feedUrl]);

    const [rows] = await conn.execute(
      'SELECT id FROM news_agencies WHERE country = ? LIMIT 1',
      [country]
    );

    if (rows.length === 0) {
      await conn.execute(
        `INSERT INTO news_agencies (name, country, website, rssFeeds, language, type, isActive, createdAt, updatedAt)
         VALUES (?, ?, 'https://news.google.com', ?, 'en', 'wire', 1, NOW(), NOW())`,
        [`Google News — ${country}`, country, feedsJson]
      );
      console.log(`✅ Inserted: ${country}`);
      inserted++;
    } else {
      await conn.execute(
        'UPDATE news_agencies SET rssFeeds = ?, isActive = 1, updatedAt = NOW() WHERE country = ?',
        [feedsJson, country]
      );
      console.log(`🔄 Updated: ${country}`);
      updated++;
    }
  }

  console.log(`\n✅ Done: ${updated} updated, ${inserted} inserted`);
  await conn.end();
}

main().catch(console.error);
