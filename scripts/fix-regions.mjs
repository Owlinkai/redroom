/**
 * fix-regions.mjs
 * Sets the correct region for all agencies that have Google News feeds
 * so they match the mission targetRegions filter.
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

// Map countries to the region values used in the missions
const COUNTRY_REGION = {
  // Europe
  'Estonia': 'Eastern Europe',
  'Latvia': 'Eastern Europe',
  'Lithuania': 'Eastern Europe',
  'Moldova': 'Eastern Europe',
  'Ukraine': 'Eastern Europe',
  'Belgium': 'Western Europe',
  'Austria': 'Western Europe',
  'Slovakia': 'Eastern Europe',
  'Croatia': 'Eastern Europe',
  'Slovenia': 'Eastern Europe',
  'Serbia': 'Eastern Europe',
  'Bosnia': 'Eastern Europe',
  'Bosnia and Herzegovina': 'Eastern Europe',
  'Montenegro': 'Eastern Europe',
  'Albania': 'Eastern Europe',
  'Kosovo': 'Eastern Europe',
  'North Macedonia': 'Eastern Europe',
  'Luxembourg': 'Western Europe',
  'Portugal': 'Western Europe',
  'Denmark': 'Western Europe',
  'Finland': 'Western Europe',
  'Norway': 'Western Europe',
  'Sweden': 'Western Europe',
  'Switzerland': 'Western Europe',
  'Italy': 'Western Europe',
  'Ireland': 'Western Europe',
  'Malta': 'Western Europe',
  'Cyprus': 'Western Europe',
  'Iceland': 'Western Europe',

  // Africa
  'Tanzania': 'Africa',
  'Djibouti': 'Africa',
  "Côte d'Ivoire": 'Africa',
  'Democratic Republic of the Congo': 'Africa',
  'Central African Republic': 'Africa',
  'Guinea': 'Africa',
  'Madagascar': 'Africa',
  'Cameroon': 'Africa',
  'Cape Verde': 'Africa',
  'Senegal': 'Africa',
  'Ghana': 'Africa',
  'Zambia': 'Africa',
  'Liberia': 'Africa',
  'Gabon': 'Africa',
  'Tunisia': 'Africa',
  'Rwanda': 'Africa',
  'Namibia': 'Africa',
  'Malawi': 'Africa',
  'Eswatini': 'Africa',
  'Comoros': 'Africa',
  'Eritrea': 'Africa',
  'Niger': 'Africa',
  'Mali': 'Africa',
  'Zimbabwe': 'Africa',
  'Uganda': 'Africa',
  'Mauritania': 'Africa',
  'Mauritius': 'Africa',
  'Botswana': 'Africa',
  'Togo': 'Africa',
  'Mozambique': 'Africa',
  'Burkina Faso': 'Africa',
  'Equatorial Guinea': 'Africa',
  'Benin': 'Africa',
  'Guinea-Bissau': 'Africa',
  'Republic of the Congo': 'Africa',
  'Chad': 'Africa',
  'Lesotho': 'Africa',
  'Sierra Leone': 'Africa',
  'Somalia': 'Africa',
  'Algeria': 'Africa',
  'São Tomé and Príncipe': 'Africa',
  'Seychelles': 'Africa',
  'Bangladesh': 'South Asia',

  // Middle East
  'Kuwait': 'Middle East',
  'Yemen': 'Middle East',
  'Oman': 'Middle East',
  'Bahrain': 'Middle East',

  // Asia-Pacific
  'Sri Lanka': 'South Asia',
  'Laos': 'Southeast Asia',
  'Brunei': 'Southeast Asia',
  'Taiwan': 'East Asia',
  'Azerbaijan': 'Caucasus',
  'Kyrgyzstan': 'Central Asia',
  'Tajikistan': 'Central Asia',
  'Turkmenistan': 'Central Asia',
  'Mongolia': 'East Asia',
  'Cambodia': 'Southeast Asia',
  'Myanmar': 'Southeast Asia',
  'Vietnam': 'Southeast Asia',
  'Indonesia': 'Southeast Asia',
  'Armenia': 'Caucasus',
  'Bhutan': 'South Asia',
  'Maldives': 'South Asia',
  'Timor-Leste': 'Southeast Asia',
  'Papua New Guinea': 'Asia-Pacific',
  'Fiji': 'Asia-Pacific',
  'Vanuatu': 'Asia-Pacific',
  'Tonga': 'Asia-Pacific',
  'Solomon Islands': 'Asia-Pacific',
  'Kiribati': 'Asia-Pacific',
  'Samoa': 'Asia-Pacific',

  // Americas
  'Guatemala': 'Americas',
  'Chile': 'Americas',
  'Dominican Republic': 'Americas',
  'El Salvador': 'Americas',
  'Suriname': 'Americas',
  'Barbados': 'Americas',
  'Trinidad and Tobago': 'Americas',
  'Jamaica': 'Americas',
  'Haiti': 'Americas',
  'Nicaragua': 'Americas',
  'Honduras': 'Americas',
  'Costa Rica': 'Americas',
  'Panama': 'Americas',
  'Bolivia': 'Americas',
  'Paraguay': 'Americas',
  'Uruguay': 'Americas',
  'Ecuador': 'Americas',
  'Cuba': 'Americas',
  'Belize': 'Americas',
  'Guyana': 'Americas',
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

  // First check what regions the missions use
  const [missions] = await conn.execute('SELECT id, name, targetRegions FROM crawl_missions WHERE id IN (60001, 60002)');
  console.log('Mission regions:', missions.map(m => `${m.id}: ${m.targetRegions}`).join('\n'));

  let updated = 0;
  for (const [country, region] of Object.entries(COUNTRY_REGION)) {
    const [result] = await conn.execute(
      'UPDATE news_agencies SET region = ?, updatedAt = NOW() WHERE country = ? AND (region IS NULL OR region = "")',
      [region, country]
    );
    if (result.affectedRows > 0) {
      console.log(`✅ ${country} → ${region}`);
      updated++;
    }
  }

  console.log(`\n✅ Done: ${updated} agencies updated with region`);

  // Verify
  const [check] = await conn.execute(
    'SELECT country, region FROM news_agencies WHERE rssFeeds LIKE "%news.google.com%" LIMIT 5'
  );
  console.log('Sample Google News agencies with region:', JSON.stringify(check));

  await conn.end();
}

main().catch(console.error);
