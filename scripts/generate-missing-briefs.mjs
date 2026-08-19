/**
 * Generates intel briefs for all countries missing from country_intel_data
 * Uses the built-in LLM API (BUILT_IN_FORGE_API_URL + BUILT_IN_FORGE_API_KEY)
 */
import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';

config({ path: '/home/ubuntu/geopolitical-news-intelligence/.env' });

const DB_URL = process.env.DATABASE_URL;
const m = DB_URL.match(/mysql:\/\/([^:]+):([^@]+)@([^:/]+):(\d+)\/([^?]+)/);
const [, user, pass, host, port, db] = m;

const FORGE_URL = process.env.BUILT_IN_FORGE_API_URL;
const FORGE_KEY = process.env.BUILT_IN_FORGE_API_KEY;

const conn = await createConnection({
  host, port: parseInt(port), user, password: pass, database: db,
  ssl: { rejectUnauthorized: false }
});

// All countries to generate (missing from DB)
const MISSING_COUNTRIES = [
  // Europe
  "Estonia","Latvia","Lithuania","Moldova","Croatia","Slovenia",
  "Bosnia and Herzegovina","Kosovo","Albania","Montenegro","North Macedonia",
  "Belgium","Austria","Luxembourg","Malta","Cyprus","Iceland","Ireland",
  "Denmark","Portugal","Bulgaria",
  // Southeast Asia / Pacific
  "Brunei","Cambodia","Laos","Timor-Leste","Fiji","Kiribati","Samoa",
  "Solomon Islands","Tonga","Vanuatu",
  // South Asia
  "Bhutan","Maldives",
  // Sub-Saharan Africa
  "Burkina Faso","Benin","Togo","Ghana","Cameroon","Gabon",
  "Republic of the Congo","Central African Republic","Chad","Niger",
  "Guinea","Guinea-Bissau","Sierra Leone","Liberia","Ivory Coast",
  "Rwanda","Burundi","Uganda","Zambia","Zimbabwe","Malawi","Botswana",
  "Namibia","Eswatini","Lesotho","Comoros","Madagascar","Mauritius",
  "Seychelles","Cape Verde","São Tomé and Príncipe","Equatorial Guinea",
  "Djibouti","Eritrea","Senegal","Mauritania","Gambia",
  // Caribbean / Central America
  "Jamaica","Trinidad and Tobago","Barbados","Belize","Panama",
  "Costa Rica","Dominican Republic",
  // South America
  "Paraguay","Uruguay","Guyana","Suriname",
  // Already in DB but check
];

async function invokeLLM(prompt) {
  const res = await fetch(`${FORGE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${FORGE_KEY}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.1,
    }),
  });
  const data = await res.json();
  return data.choices?.[0]?.message?.content;
}

// Check which are actually missing
const [existing] = await conn.execute('SELECT country FROM country_intel_data');
const existingSet = new Set(existing.map(r => r.country.toLowerCase()));

const toGenerate = MISSING_COUNTRIES.filter(c => !existingSet.has(c.toLowerCase()));
console.log(`Generating briefs for ${toGenerate.length} missing countries...`);

let inserted = 0;
let failed = 0;

for (const country of toGenerate) {
  process.stdout.write(`  Generating: ${country}... `);
  try {
    const prompt = `Generate a structured intelligence brief for ${country} for a geopolitical intelligence platform. Return ONLY a valid JSON object with these exact fields:
{
  "country": "${country}",
  "isoA3": "ISO 3166-1 alpha-3 code",
  "region": "One of: Europe, MENA, Sub-Saharan Africa, North Africa, East Asia, South Asia, Southeast Asia, Central Asia, Caucasus, Latin America, Pacific, Americas",
  "capital": "Capital city",
  "governmentType": "Government type (max 100 chars)",
  "headOfState": "Current head of state name and title",
  "population": integer,
  "gdpUsd": gdp_in_usd_billions_integer,
  "gdpPerCapita": integer,
  "militaryBudgetUsd": military_budget_usd_millions_integer,
  "armedForcesSize": integer,
  "threatLevel": "LOW or MODERATE or HIGH or CRITICAL or EXTREME",
  "nuclearStatus": "none or civilian or suspected or confirmed or treaty",
  "sanctionsStatus": "Brief summary or None",
  "unMemberStatus": "Member or Observer or Non-member",
  "keyLeaders": [{"role": "title", "name": "full name", "since": "YYYY"}],
  "alliances": ["list of major alliances/blocs"],
  "activeConflicts": [],
  "humanRightsIndex": 0.0_to_10.0,
  "pressFreedomIndex": rsf_rank_integer,
  "corruptionIndex": cpi_0_to_100_integer,
  "internetFreedom": "free or partly_free or not_free",
  "keyIntelNotes": "2-3 sentence intelligence-focused analyst summary of current geopolitical significance, key risks, and strategic importance.",
  "sources": [{"name": "CIA World Factbook", "url": "https://www.cia.gov/the-world-factbook/"}]
}`;

    const raw = await invokeLLM(prompt);
    if (!raw) throw new Error('Empty LLM response');
    
    const d = JSON.parse(raw);
    
    await conn.execute(
      `INSERT INTO country_intel_data 
       (country, isoA3, region, capital, governmentType, headOfState, population, gdpUsd, gdpPerCapita,
        militaryBudgetUsd, armedForcesSize, threatLevel, nuclearStatus, sanctionsStatus, unMemberStatus,
        keyLeaders, alliances, activeConflicts, humanRightsIndex, pressFreedomIndex, corruptionIndex,
        internetFreedom, keyIntelNotes, sources)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         isoA3=VALUES(isoA3), region=VALUES(region), capital=VALUES(capital),
         governmentType=VALUES(governmentType), headOfState=VALUES(headOfState),
         population=VALUES(population), gdpUsd=VALUES(gdpUsd), gdpPerCapita=VALUES(gdpPerCapita),
         militaryBudgetUsd=VALUES(militaryBudgetUsd), armedForcesSize=VALUES(armedForcesSize),
         threatLevel=VALUES(threatLevel), nuclearStatus=VALUES(nuclearStatus),
         sanctionsStatus=VALUES(sanctionsStatus), keyLeaders=VALUES(keyLeaders),
         alliances=VALUES(alliances), activeConflicts=VALUES(activeConflicts),
         humanRightsIndex=VALUES(humanRightsIndex), pressFreedomIndex=VALUES(pressFreedomIndex),
         corruptionIndex=VALUES(corruptionIndex), internetFreedom=VALUES(internetFreedom),
         keyIntelNotes=VALUES(keyIntelNotes), sources=VALUES(sources)`,
      [
        d.country || country,
        d.isoA3 || null,
        d.region || null,
        d.capital || null,
        d.governmentType || null,
        d.headOfState || null,
        d.population || null,
        d.gdpUsd || null,
        d.gdpPerCapita || null,
        d.militaryBudgetUsd || null,
        d.armedForcesSize || null,
        d.threatLevel || 'MODERATE',
        d.nuclearStatus || 'none',
        d.sanctionsStatus || null,
        d.unMemberStatus || 'Member',
        JSON.stringify(d.keyLeaders || []),
        JSON.stringify(d.alliances || []),
        JSON.stringify(d.activeConflicts || []),
        d.humanRightsIndex || null,
        d.pressFreedomIndex || null,
        d.corruptionIndex || null,
        d.internetFreedom || null,
        d.keyIntelNotes || null,
        JSON.stringify(d.sources || []),
      ]
    );
    inserted++;
    console.log('✅');
  } catch (e) {
    failed++;
    console.log('❌ ' + e.message.slice(0, 80));
  }
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 200));
}

const [[final]] = await conn.execute('SELECT COUNT(*) as c FROM country_intel_data');
console.log(`\n=== DONE ===`);
console.log(`Inserted/updated: ${inserted}`);
console.log(`Failed: ${failed}`);
console.log(`Total briefs in DB: ${final.c}`);
await conn.end();
