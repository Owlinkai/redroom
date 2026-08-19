/**
 * Master Reference Data Seed
 * Populates: regions, countries, topics, google_news_topics,
 *             region_hotspots, threat_levels, population_data, un_sources
 *
 * Run: node scripts/seed-master-reference-data.mjs
 */
import mysql2 from 'mysql2/promise';

const conn = await mysql2.createConnection(process.env.DATABASE_URL);
const ins = async (table, row) => {
  const keys = Object.keys(row);
  const vals = Object.values(row).map(v => (typeof v === 'object' && v !== null) ? JSON.stringify(v) : v);
  const placeholders = keys.map(() => '?').join(', ');
  const updates = keys.map(k => `\`${k}\`=VALUES(\`${k}\`)`).join(', ');
  await conn.execute(
    `INSERT INTO \`${table}\` (\`${keys.join('`,`')}\`) VALUES (${placeholders}) ON DUPLICATE KEY UPDATE ${updates}`,
    vals
  );
};

// ─── 1. THREAT LEVELS ────────────────────────────────────────────────────────
console.log('Seeding threat_levels...');
const threatLevels = [
  { name:'CRITICAL', label:'Critical', description:'Active armed conflict, mass casualties, or imminent state-level threat.', color:'#ef4444', hexInt:'0xef4444', bgClass:'bg-red-500/20', textClass:'text-red-400', borderClass:'border-red-500', sortOrder:1 },
  { name:'HIGH',     label:'High',     description:'Significant military activity, terrorist attacks, or major political crisis.', color:'#f97316', hexInt:'0xf97316', bgClass:'bg-orange-500/20', textClass:'text-orange-400', borderClass:'border-orange-500', sortOrder:2 },
  { name:'ELEVATED', label:'Elevated', description:'Heightened tensions, protests, sanctions, or proxy conflict activity.', color:'#f59e0b', hexInt:'0xf59e0b', bgClass:'bg-yellow-500/20', textClass:'text-yellow-400', borderClass:'border-yellow-500', sortOrder:3 },
  { name:'MODERATE', label:'Moderate', description:'Stable but with underlying tensions, political disputes, or economic stress.', color:'#22c55e', hexInt:'0x22c55e', bgClass:'bg-green-500/20', textClass:'text-green-400', borderClass:'border-green-500', sortOrder:4 },
  { name:'LOW',      label:'Low',      description:'Stable, peaceful, with no significant security concerns.', color:'#3b82f6', hexInt:'0x3b82f6', bgClass:'bg-blue-500/20', textClass:'text-blue-400', borderClass:'border-blue-500', sortOrder:5 },
];
for (const t of threatLevels) await ins('threat_levels', t);
console.log(`  ✓ ${threatLevels.length} threat levels`);

// ─── 2. REGIONS ──────────────────────────────────────────────────────────────
console.log('Seeding regions...');
const regionsData = [
  { name:'Global',           label:'Global',              shortLabel:'GLOBAL',   description:'All regions combined — worldwide geopolitical intelligence.',                                  centerLat:20,    centerLon:0,      defaultZoom:2, glCode:'US', hlCode:'en', ceid:'US:en',     threatLevel:'HIGH',     color:'#a78bfa', sortOrder:1 },
  { name:'MENA',             label:'Middle East & N. Africa', shortLabel:'MENA', description:'Middle East and North Africa — the most geopolitically active region.',                       centerLat:26,    centerLon:42,     defaultZoom:4, glCode:'EG', hlCode:'ar', ceid:'EG:ar',     threatLevel:'CRITICAL', color:'#ef4444', sortOrder:2 },
  { name:'Europe',           label:'Europe',              shortLabel:'EUR',      description:'European continent including Russia and Turkey.',                                              centerLat:54,    centerLon:15,     defaultZoom:4, glCode:'DE', hlCode:'en', ceid:'DE:de',     threatLevel:'HIGH',     color:'#3b82f6', sortOrder:3 },
  { name:'East Asia',        label:'East Asia',           shortLabel:'E.ASIA',   description:'China, Japan, Korea, Taiwan, and the Pacific Rim.',                                           centerLat:35,    centerLon:115,    defaultZoom:4, glCode:'CN', hlCode:'en', ceid:'CN:zh-Hans',threatLevel:'HIGH',     color:'#f97316', sortOrder:4 },
  { name:'Asia-Pacific',     label:'Asia-Pacific',        shortLabel:'APAC',     description:'Southeast Asia, Australia, New Zealand, and Pacific Islands.',                               centerLat:5,     centerLon:120,    defaultZoom:4, glCode:'AU', hlCode:'en', ceid:'AU:en',     threatLevel:'ELEVATED', color:'#22c55e', sortOrder:5 },
  { name:'South Asia',       label:'South Asia',          shortLabel:'S.ASIA',   description:'India, Pakistan, Bangladesh, Sri Lanka, Nepal, Afghanistan.',                                centerLat:25,    centerLon:78,     defaultZoom:4, glCode:'IN', hlCode:'en', ceid:'IN:en',     threatLevel:'HIGH',     color:'#f59e0b', sortOrder:6 },
  { name:'Central Asia',     label:'Central Asia',        shortLabel:'C.ASIA',   description:'Kazakhstan, Uzbekistan, Turkmenistan, Kyrgyzstan, Tajikistan.',                              centerLat:44,    centerLon:63,     defaultZoom:4, glCode:'KZ', hlCode:'en', ceid:'KZ:ru',     threatLevel:'ELEVATED', color:'#8b5cf6', sortOrder:7 },
  { name:'Sub-Saharan Africa',label:'Sub-Saharan Africa', shortLabel:'SSA',      description:'Africa south of the Sahara — Sahel, East, West, Central, and Southern Africa.',             centerLat:5,     centerLon:20,     defaultZoom:3, glCode:'ZA', hlCode:'en', ceid:'ZA:en',     threatLevel:'HIGH',     color:'#10b981', sortOrder:8 },
  { name:'North Africa',     label:'North Africa',        shortLabel:'N.AFR',    description:'Libya, Tunisia, Algeria, Morocco, Mauritania.',                                              centerLat:28,    centerLon:10,     defaultZoom:4, glCode:'EG', hlCode:'ar', ceid:'EG:ar',     threatLevel:'HIGH',     color:'#f59e0b', sortOrder:9 },
  { name:'Americas',         label:'Americas',            shortLabel:'AMER',     description:'North America — United States, Canada, Mexico, and Caribbean.',                             centerLat:40,    centerLon:-100,   defaultZoom:3, glCode:'US', hlCode:'en', ceid:'US:en',     threatLevel:'ELEVATED', color:'#60a5fa', sortOrder:10 },
  { name:'Latin America',    label:'Latin America',       shortLabel:'LATAM',    description:'Central and South America — from Guatemala to Tierra del Fuego.',                           centerLat:-15,   centerLon:-60,    defaultZoom:3, glCode:'BR', hlCode:'pt', ceid:'BR:pt-419', threatLevel:'HIGH',     color:'#34d399', sortOrder:11 },
];
for (const r of regionsData) await ins('regions', r);
console.log(`  ✓ ${regionsData.length} regions`);

// ─── 3. TOPICS ───────────────────────────────────────────────────────────────
console.log('Seeding topics...');
const topicsData = [
  { name:'WAR/CONFLICT',   label:'War & Conflict',      description:'Armed conflict, military operations, battles, and warfare.',          color:'#ef4444', icon:'Swords',      sortOrder:1 },
  { name:'POLITICS',       label:'Politics',            description:'Government, elections, political parties, and state affairs.',         color:'#3b82f6', icon:'Landmark',    sortOrder:2 },
  { name:'DIPLOMACY',      label:'Diplomacy',           description:'International relations, treaties, summits, and negotiations.',        color:'#8b5cf6', icon:'Handshake',   sortOrder:3 },
  { name:'ECONOMY',        label:'Economy',             description:'Trade, sanctions, markets, finance, and economic policy.',             color:'#f59e0b', icon:'TrendingUp',  sortOrder:4 },
  { name:'SECURITY',       label:'Security',            description:'Terrorism, intelligence, cybersecurity, and law enforcement.',         color:'#f97316', icon:'Shield',      sortOrder:5 },
  { name:'ENERGY',         label:'Energy',              description:'Oil, gas, nuclear, renewables, and energy infrastructure.',            color:'#22c55e', icon:'Zap',         sortOrder:6 },
  { name:'TECHNOLOGY',     label:'Technology',          description:'Cyber, AI, space, weapons technology, and digital warfare.',           color:'#06b6d4', icon:'Cpu',         sortOrder:7 },
  { name:'HUMANITARIAN',   label:'Humanitarian',        description:'Refugees, displacement, aid, human rights, and civilian impact.',      color:'#ec4899', icon:'Heart',       sortOrder:8 },
  { name:'MILITARY',       label:'Military',            description:'Armed forces, defense, weapons systems, and military strategy.',       color:'#dc2626', icon:'Target',      sortOrder:9 },
  { name:'INTELLIGENCE',   label:'Intelligence',        description:'Espionage, SIGINT, HUMINT, covert operations, and surveillance.',      color:'#7c3aed', icon:'Eye',         sortOrder:10 },
  { name:'NUCLEAR',        label:'Nuclear',             description:'Nuclear weapons, proliferation, reactors, and arms control.',          color:'#b45309', icon:'Atom',        sortOrder:11 },
  { name:'MARITIME',       label:'Maritime',            description:'Naval operations, shipping lanes, piracy, and maritime disputes.',     color:'#0369a1', icon:'Anchor',      sortOrder:12 },
  { name:'SPACE',          label:'Space',               description:'Satellite, space militarization, launches, and space policy.',         color:'#4f46e5', icon:'Satellite',   sortOrder:13 },
  { name:'ENVIRONMENT',    label:'Environment',         description:'Climate, resources, water, and environmental security.',               color:'#16a34a', icon:'Leaf',        sortOrder:14 },
  { name:'HEALTH',         label:'Health',              description:'Pandemics, biological threats, and global health security.',           color:'#db2777', icon:'Activity',    sortOrder:15 },
];
for (const t of topicsData) await ins('topics', t);
console.log(`  ✓ ${topicsData.length} topics`);

// ─── 4. COUNTRIES ────────────────────────────────────────────────────────────
console.log('Seeding countries...');
const countriesData = [
  // MENA
  { name:'Egypt', iso2:'EG', iso3:'EGY', region:'MENA', capital:'Cairo', lat:26.82, lon:30.80, flagEmoji:'🇪🇬' },
  { name:'Saudi Arabia', iso2:'SA', iso3:'SAU', region:'MENA', capital:'Riyadh', lat:23.89, lon:45.08, flagEmoji:'🇸🇦' },
  { name:'Iran', iso2:'IR', iso3:'IRN', region:'MENA', capital:'Tehran', lat:32.43, lon:53.69, flagEmoji:'🇮🇷' },
  { name:'Iraq', iso2:'IQ', iso3:'IRQ', region:'MENA', capital:'Baghdad', lat:33.22, lon:43.68, flagEmoji:'🇮🇶' },
  { name:'Syria', iso2:'SY', iso3:'SYR', region:'MENA', capital:'Damascus', lat:34.80, lon:38.99, flagEmoji:'🇸🇾' },
  { name:'Yemen', iso2:'YE', iso3:'YEM', region:'MENA', capital:"Sana'a", lat:15.55, lon:48.52, flagEmoji:'🇾🇪' },
  { name:'Israel', iso2:'IL', iso3:'ISR', region:'MENA', capital:'Jerusalem', lat:31.05, lon:34.85, flagEmoji:'🇮🇱' },
  { name:'Palestine', iso2:'PS', iso3:'PSE', region:'MENA', capital:'Ramallah', lat:31.95, lon:35.23, flagEmoji:'🇵🇸' },
  { name:'Jordan', iso2:'JO', iso3:'JOR', region:'MENA', capital:'Amman', lat:30.59, lon:36.24, flagEmoji:'🇯🇴' },
  { name:'Lebanon', iso2:'LB', iso3:'LBN', region:'MENA', capital:'Beirut', lat:33.85, lon:35.86, flagEmoji:'🇱🇧' },
  { name:'Turkey', iso2:'TR', iso3:'TUR', region:'MENA', capital:'Ankara', lat:38.96, lon:35.24, flagEmoji:'🇹🇷' },
  { name:'United Arab Emirates', iso2:'AE', iso3:'ARE', region:'MENA', capital:'Abu Dhabi', lat:23.42, lon:53.85, flagEmoji:'🇦🇪' },
  { name:'Kuwait', iso2:'KW', iso3:'KWT', region:'MENA', capital:'Kuwait City', lat:29.31, lon:47.48, flagEmoji:'🇰🇼' },
  { name:'Qatar', iso2:'QA', iso3:'QAT', region:'MENA', capital:'Doha', lat:25.35, lon:51.18, flagEmoji:'🇶🇦' },
  { name:'Bahrain', iso2:'BH', iso3:'BHR', region:'MENA', capital:'Manama', lat:26.07, lon:50.55, flagEmoji:'🇧🇭' },
  { name:'Oman', iso2:'OM', iso3:'OMN', region:'MENA', capital:'Muscat', lat:21.51, lon:55.92, flagEmoji:'🇴🇲' },
  { name:'Libya', iso2:'LY', iso3:'LBY', region:'MENA', capital:'Tripoli', lat:26.34, lon:17.23, flagEmoji:'🇱🇾' },
  // Europe
  { name:'Germany', iso2:'DE', iso3:'DEU', region:'Europe', capital:'Berlin', lat:51.17, lon:10.45, flagEmoji:'🇩🇪' },
  { name:'France', iso2:'FR', iso3:'FRA', region:'Europe', capital:'Paris', lat:46.23, lon:2.21, flagEmoji:'🇫🇷' },
  { name:'United Kingdom', iso2:'GB', iso3:'GBR', region:'Europe', capital:'London', lat:55.38, lon:-3.44, flagEmoji:'🇬🇧' },
  { name:'Russia', iso2:'RU', iso3:'RUS', region:'Europe', capital:'Moscow', lat:61.52, lon:105.32, flagEmoji:'🇷🇺' },
  { name:'Ukraine', iso2:'UA', iso3:'UKR', region:'Europe', capital:'Kyiv', lat:48.38, lon:31.17, flagEmoji:'🇺🇦' },
  { name:'Poland', iso2:'PL', iso3:'POL', region:'Europe', capital:'Warsaw', lat:51.92, lon:19.15, flagEmoji:'🇵🇱' },
  { name:'Italy', iso2:'IT', iso3:'ITA', region:'Europe', capital:'Rome', lat:41.87, lon:12.57, flagEmoji:'🇮🇹' },
  { name:'Spain', iso2:'ES', iso3:'ESP', region:'Europe', capital:'Madrid', lat:40.46, lon:-3.75, flagEmoji:'🇪🇸' },
  { name:'Romania', iso2:'RO', iso3:'ROU', region:'Europe', capital:'Bucharest', lat:45.94, lon:24.97, flagEmoji:'🇷🇴' },
  { name:'Sweden', iso2:'SE', iso3:'SWE', region:'Europe', capital:'Stockholm', lat:60.13, lon:18.64, flagEmoji:'🇸🇪' },
  { name:'Finland', iso2:'FI', iso3:'FIN', region:'Europe', capital:'Helsinki', lat:61.92, lon:25.75, flagEmoji:'🇫🇮' },
  { name:'Norway', iso2:'NO', iso3:'NOR', region:'Europe', capital:'Oslo', lat:60.47, lon:8.47, flagEmoji:'🇳🇴' },
  { name:'Netherlands', iso2:'NL', iso3:'NLD', region:'Europe', capital:'Amsterdam', lat:52.13, lon:5.29, flagEmoji:'🇳🇱' },
  { name:'Belgium', iso2:'BE', iso3:'BEL', region:'Europe', capital:'Brussels', lat:50.50, lon:4.47, flagEmoji:'🇧🇪' },
  { name:'Greece', iso2:'GR', iso3:'GRC', region:'Europe', capital:'Athens', lat:39.07, lon:21.82, flagEmoji:'🇬🇷' },
  { name:'Serbia', iso2:'RS', iso3:'SRB', region:'Europe', capital:'Belgrade', lat:44.02, lon:21.01, flagEmoji:'🇷🇸' },
  { name:'Belarus', iso2:'BY', iso3:'BLR', region:'Europe', capital:'Minsk', lat:53.71, lon:27.95, flagEmoji:'🇧🇾' },
  { name:'Hungary', iso2:'HU', iso3:'HUN', region:'Europe', capital:'Budapest', lat:47.16, lon:19.50, flagEmoji:'🇭🇺' },
  { name:'Switzerland', iso2:'CH', iso3:'CHE', region:'Europe', capital:'Bern', lat:46.82, lon:8.23, flagEmoji:'🇨🇭' },
  // East Asia
  { name:'China', iso2:'CN', iso3:'CHN', region:'East Asia', capital:'Beijing', lat:35.86, lon:104.20, flagEmoji:'🇨🇳' },
  { name:'Japan', iso2:'JP', iso3:'JPN', region:'East Asia', capital:'Tokyo', lat:36.20, lon:138.25, flagEmoji:'🇯🇵' },
  { name:'South Korea', iso2:'KR', iso3:'KOR', region:'East Asia', capital:'Seoul', lat:35.91, lon:127.77, flagEmoji:'🇰🇷' },
  { name:'North Korea', iso2:'KP', iso3:'PRK', region:'East Asia', capital:'Pyongyang', lat:40.34, lon:127.51, flagEmoji:'🇰🇵' },
  { name:'Taiwan', iso2:'TW', iso3:'TWN', region:'East Asia', capital:'Taipei', lat:23.70, lon:121.00, flagEmoji:'🇹🇼' },
  { name:'Mongolia', iso2:'MN', iso3:'MNG', region:'East Asia', capital:'Ulaanbaatar', lat:46.86, lon:103.85, flagEmoji:'🇲🇳' },
  // Asia-Pacific
  { name:'Australia', iso2:'AU', iso3:'AUS', region:'Asia-Pacific', capital:'Canberra', lat:-25.27, lon:133.78, flagEmoji:'🇦🇺' },
  { name:'Indonesia', iso2:'ID', iso3:'IDN', region:'Asia-Pacific', capital:'Jakarta', lat:-0.79, lon:113.92, flagEmoji:'🇮🇩' },
  { name:'Philippines', iso2:'PH', iso3:'PHL', region:'Asia-Pacific', capital:'Manila', lat:12.88, lon:121.77, flagEmoji:'🇵🇭' },
  { name:'Vietnam', iso2:'VN', iso3:'VNM', region:'Asia-Pacific', capital:'Hanoi', lat:14.06, lon:108.28, flagEmoji:'🇻🇳' },
  { name:'Thailand', iso2:'TH', iso3:'THA', region:'Asia-Pacific', capital:'Bangkok', lat:15.87, lon:100.99, flagEmoji:'🇹🇭' },
  { name:'Malaysia', iso2:'MY', iso3:'MYS', region:'Asia-Pacific', capital:'Kuala Lumpur', lat:4.21, lon:101.98, flagEmoji:'🇲🇾' },
  { name:'Singapore', iso2:'SG', iso3:'SGP', region:'Asia-Pacific', capital:'Singapore', lat:1.35, lon:103.82, flagEmoji:'🇸🇬' },
  { name:'Myanmar', iso2:'MM', iso3:'MMR', region:'Asia-Pacific', capital:'Naypyidaw', lat:21.92, lon:95.96, flagEmoji:'🇲🇲' },
  { name:'New Zealand', iso2:'NZ', iso3:'NZL', region:'Asia-Pacific', capital:'Wellington', lat:-40.90, lon:174.89, flagEmoji:'🇳🇿' },
  { name:'Papua New Guinea', iso2:'PG', iso3:'PNG', region:'Asia-Pacific', capital:'Port Moresby', lat:-6.31, lon:143.96, flagEmoji:'🇵🇬' },
  // South Asia
  { name:'India', iso2:'IN', iso3:'IND', region:'South Asia', capital:'New Delhi', lat:20.59, lon:78.96, flagEmoji:'🇮🇳' },
  { name:'Pakistan', iso2:'PK', iso3:'PAK', region:'South Asia', capital:'Islamabad', lat:30.38, lon:69.35, flagEmoji:'🇵🇰' },
  { name:'Bangladesh', iso2:'BD', iso3:'BGD', region:'South Asia', capital:'Dhaka', lat:23.68, lon:90.36, flagEmoji:'🇧🇩' },
  { name:'Afghanistan', iso2:'AF', iso3:'AFG', region:'South Asia', capital:'Kabul', lat:33.94, lon:67.71, flagEmoji:'🇦🇫' },
  { name:'Sri Lanka', iso2:'LK', iso3:'LKA', region:'South Asia', capital:'Colombo', lat:7.87, lon:80.77, flagEmoji:'🇱🇰' },
  { name:'Nepal', iso2:'NP', iso3:'NPL', region:'South Asia', capital:'Kathmandu', lat:28.39, lon:84.12, flagEmoji:'🇳🇵' },
  // Central Asia
  { name:'Kazakhstan', iso2:'KZ', iso3:'KAZ', region:'Central Asia', capital:'Astana', lat:48.02, lon:66.92, flagEmoji:'🇰🇿' },
  { name:'Uzbekistan', iso2:'UZ', iso3:'UZB', region:'Central Asia', capital:'Tashkent', lat:41.38, lon:64.59, flagEmoji:'🇺🇿' },
  { name:'Turkmenistan', iso2:'TM', iso3:'TKM', region:'Central Asia', capital:'Ashgabat', lat:38.97, lon:59.56, flagEmoji:'🇹🇲' },
  { name:'Kyrgyzstan', iso2:'KG', iso3:'KGZ', region:'Central Asia', capital:'Bishkek', lat:41.20, lon:74.77, flagEmoji:'🇰🇬' },
  { name:'Tajikistan', iso2:'TJ', iso3:'TJK', region:'Central Asia', capital:'Dushanbe', lat:38.86, lon:71.28, flagEmoji:'🇹🇯' },
  // Sub-Saharan Africa
  { name:'Nigeria', iso2:'NG', iso3:'NGA', region:'Sub-Saharan Africa', capital:'Abuja', lat:9.08, lon:8.68, flagEmoji:'🇳🇬' },
  { name:'Ethiopia', iso2:'ET', iso3:'ETH', region:'Sub-Saharan Africa', capital:'Addis Ababa', lat:9.15, lon:40.49, flagEmoji:'🇪🇹' },
  { name:'Democratic Republic of Congo', iso2:'CD', iso3:'COD', region:'Sub-Saharan Africa', capital:'Kinshasa', lat:-4.04, lon:21.76, flagEmoji:'🇨🇩' },
  { name:'South Africa', iso2:'ZA', iso3:'ZAF', region:'Sub-Saharan Africa', capital:'Pretoria', lat:-30.56, lon:22.94, flagEmoji:'🇿🇦' },
  { name:'Kenya', iso2:'KE', iso3:'KEN', region:'Sub-Saharan Africa', capital:'Nairobi', lat:-0.02, lon:37.91, flagEmoji:'🇰🇪' },
  { name:'Somalia', iso2:'SO', iso3:'SOM', region:'Sub-Saharan Africa', capital:'Mogadishu', lat:5.15, lon:46.20, flagEmoji:'🇸🇴' },
  { name:'Sudan', iso2:'SD', iso3:'SDN', region:'Sub-Saharan Africa', capital:'Khartoum', lat:12.86, lon:30.22, flagEmoji:'🇸🇩' },
  { name:'Mali', iso2:'ML', iso3:'MLI', region:'Sub-Saharan Africa', capital:'Bamako', lat:17.57, lon:-3.99, flagEmoji:'🇲🇱' },
  { name:'Niger', iso2:'NE', iso3:'NER', region:'Sub-Saharan Africa', capital:'Niamey', lat:17.61, lon:8.08, flagEmoji:'🇳🇪' },
  { name:'Burkina Faso', iso2:'BF', iso3:'BFA', region:'Sub-Saharan Africa', capital:'Ouagadougou', lat:12.36, lon:-1.53, flagEmoji:'🇧🇫' },
  { name:'Mozambique', iso2:'MZ', iso3:'MOZ', region:'Sub-Saharan Africa', capital:'Maputo', lat:-18.67, lon:35.53, flagEmoji:'🇲🇿' },
  { name:'Tanzania', iso2:'TZ', iso3:'TZA', region:'Sub-Saharan Africa', capital:'Dodoma', lat:-6.37, lon:34.89, flagEmoji:'🇹🇿' },
  { name:'Uganda', iso2:'UG', iso3:'UGA', region:'Sub-Saharan Africa', capital:'Kampala', lat:1.37, lon:32.29, flagEmoji:'🇺🇬' },
  { name:'Ghana', iso2:'GH', iso3:'GHA', region:'Sub-Saharan Africa', capital:'Accra', lat:7.95, lon:-1.02, flagEmoji:'🇬🇭' },
  { name:'Cameroon', iso2:'CM', iso3:'CMR', region:'Sub-Saharan Africa', capital:'Yaoundé', lat:3.85, lon:11.50, flagEmoji:'🇨🇲' },
  { name:'Djibouti', iso2:'DJ', iso3:'DJI', region:'Sub-Saharan Africa', capital:'Djibouti', lat:11.83, lon:42.59, flagEmoji:'🇩🇯' },
  // North Africa
  { name:'Algeria', iso2:'DZ', iso3:'DZA', region:'North Africa', capital:'Algiers', lat:28.03, lon:1.66, flagEmoji:'🇩🇿' },
  { name:'Morocco', iso2:'MA', iso3:'MAR', region:'North Africa', capital:'Rabat', lat:31.79, lon:-7.09, flagEmoji:'🇲🇦' },
  { name:'Tunisia', iso2:'TN', iso3:'TUN', region:'North Africa', capital:'Tunis', lat:33.89, lon:9.54, flagEmoji:'🇹🇳' },
  { name:'Mauritania', iso2:'MR', iso3:'MRT', region:'North Africa', capital:'Nouakchott', lat:21.01, lon:-10.94, flagEmoji:'🇲🇷' },
  // Americas
  { name:'United States', iso2:'US', iso3:'USA', region:'Americas', capital:'Washington D.C.', lat:37.09, lon:-95.71, flagEmoji:'🇺🇸' },
  { name:'Canada', iso2:'CA', iso3:'CAN', region:'Americas', capital:'Ottawa', lat:56.13, lon:-106.35, flagEmoji:'🇨🇦' },
  { name:'Mexico', iso2:'MX', iso3:'MEX', region:'Americas', capital:'Mexico City', lat:23.63, lon:-102.55, flagEmoji:'🇲🇽' },
  { name:'Cuba', iso2:'CU', iso3:'CUB', region:'Americas', capital:'Havana', lat:21.52, lon:-77.78, flagEmoji:'🇨🇺' },
  // Latin America
  { name:'Brazil', iso2:'BR', iso3:'BRA', region:'Latin America', capital:'Brasília', lat:-14.24, lon:-51.93, flagEmoji:'🇧🇷' },
  { name:'Argentina', iso2:'AR', iso3:'ARG', region:'Latin America', capital:'Buenos Aires', lat:-38.42, lon:-63.62, flagEmoji:'🇦🇷' },
  { name:'Colombia', iso2:'CO', iso3:'COL', region:'Latin America', capital:'Bogotá', lat:4.57, lon:-74.30, flagEmoji:'🇨🇴' },
  { name:'Venezuela', iso2:'VE', iso3:'VEN', region:'Latin America', capital:'Caracas', lat:6.42, lon:-66.59, flagEmoji:'🇻🇪' },
  { name:'Chile', iso2:'CL', iso3:'CHL', region:'Latin America', capital:'Santiago', lat:-35.68, lon:-71.54, flagEmoji:'🇨🇱' },
  { name:'Peru', iso2:'PE', iso3:'PER', region:'Latin America', capital:'Lima', lat:-9.19, lon:-75.02, flagEmoji:'🇵🇪' },
  { name:'Bolivia', iso2:'BO', iso3:'BOL', region:'Latin America', capital:'Sucre', lat:-16.29, lon:-63.59, flagEmoji:'🇧🇴' },
  { name:'Ecuador', iso2:'EC', iso3:'ECU', region:'Latin America', capital:'Quito', lat:-1.83, lon:-78.18, flagEmoji:'🇪🇨' },
  { name:'Paraguay', iso2:'PY', iso3:'PRY', region:'Latin America', capital:'Asunción', lat:-23.44, lon:-58.44, flagEmoji:'🇵🇾' },
  { name:'Uruguay', iso2:'UY', iso3:'URY', region:'Latin America', capital:'Montevideo', lat:-32.52, lon:-55.77, flagEmoji:'🇺🇾' },
  { name:'Panama', iso2:'PA', iso3:'PAN', region:'Latin America', capital:'Panama City', lat:8.54, lon:-80.78, flagEmoji:'🇵🇦' },
  { name:'Honduras', iso2:'HN', iso3:'HND', region:'Latin America', capital:'Tegucigalpa', lat:15.20, lon:-86.24, flagEmoji:'🇭🇳' },
  { name:'Guatemala', iso2:'GT', iso3:'GTM', region:'Latin America', capital:'Guatemala City', lat:15.78, lon:-90.23, flagEmoji:'🇬🇹' },
  { name:'El Salvador', iso2:'SV', iso3:'SLV', region:'Latin America', capital:'San Salvador', lat:13.79, lon:-88.90, flagEmoji:'🇸🇻' },
  { name:'Nicaragua', iso2:'NI', iso3:'NIC', region:'Latin America', capital:'Managua', lat:12.87, lon:-85.21, flagEmoji:'🇳🇮' },
  { name:'Guyana', iso2:'GY', iso3:'GUY', region:'Latin America', capital:'Georgetown', lat:4.86, lon:-58.93, flagEmoji:'🇬🇾' },
];
for (const c of countriesData) await ins('countries', c);
console.log(`  ✓ ${countriesData.length} countries`);

// ─── 5. GOOGLE NEWS TOPICS ────────────────────────────────────────────────────
console.log('Seeding google_news_topics...');
const gntData = [
  // Global
  { region:'Global', label:'World Conflicts', query:'world conflict war 2024', category:'Security', sortOrder:1 },
  { region:'Global', label:'Nuclear Threats', query:'nuclear weapons proliferation threat', category:'Nuclear', sortOrder:2 },
  { region:'Global', label:'Great Power Competition', query:'US China Russia geopolitics competition', category:'Diplomacy', sortOrder:3 },
  { region:'Global', label:'Global Economy', query:'global economy sanctions trade war', category:'Economy', sortOrder:4 },
  { region:'Global', label:'Cyber Warfare', query:'cyberattack cyber warfare nation state', category:'Technology', sortOrder:5 },
  { region:'Global', label:'Terrorism', query:'terrorism ISIS Al-Qaeda attack 2024', category:'Security', sortOrder:6 },
  { region:'Global', label:'Humanitarian Crisis', query:'humanitarian crisis refugees displacement', category:'Humanitarian', sortOrder:7 },
  { region:'Global', label:'Space & Satellites', query:'military satellite space warfare GPS', category:'Space', sortOrder:8 },
  // MENA
  { region:'MENA', label:'Gaza Conflict', query:'Gaza Israel Hamas war 2024', category:'War/Conflict', sortOrder:1 },
  { region:'MENA', label:'Iran Nuclear', query:'Iran nuclear deal IAEA enrichment', category:'Nuclear', sortOrder:2 },
  { region:'MENA', label:'Yemen War', query:'Yemen Houthi war ceasefire', category:'War/Conflict', sortOrder:3 },
  { region:'MENA', label:'Syria Crisis', query:'Syria conflict Assad reconstruction', category:'Humanitarian', sortOrder:4 },
  { region:'MENA', label:'Saudi Arabia', query:'Saudi Arabia Vision 2030 MBS policy', category:'Politics', sortOrder:5 },
  { region:'MENA', label:'Turkey Geopolitics', query:'Turkey Erdogan NATO Middle East', category:'Diplomacy', sortOrder:6 },
  { region:'MENA', label:'Red Sea Shipping', query:'Red Sea Houthi shipping attacks', category:'Maritime', sortOrder:7 },
  { region:'MENA', label:'Lebanon Crisis', query:'Lebanon Hezbollah crisis economy', category:'Security', sortOrder:8 },
  // Europe
  { region:'Europe', label:'Ukraine War', query:'Ukraine Russia war frontline 2024', category:'War/Conflict', sortOrder:1 },
  { region:'Europe', label:'NATO Expansion', query:'NATO expansion eastern flank defense', category:'Military', sortOrder:2 },
  { region:'Europe', label:'Energy Security', query:'Europe energy gas pipeline Russia', category:'Energy', sortOrder:3 },
  { region:'Europe', label:'EU Politics', query:'European Union politics elections far-right', category:'Politics', sortOrder:4 },
  { region:'Europe', label:'Russia Sanctions', query:'Russia sanctions economy war', category:'Economy', sortOrder:5 },
  { region:'Europe', label:'Balkans Tensions', query:'Balkans Serbia Kosovo tensions', category:'Diplomacy', sortOrder:6 },
  { region:'Europe', label:'Baltic Security', query:'Baltic states Estonia Latvia Lithuania security', category:'Security', sortOrder:7 },
  { region:'Europe', label:'Nuclear Europe', query:'nuclear weapons Europe Kaliningrad', category:'Nuclear', sortOrder:8 },
  // East Asia
  { region:'East Asia', label:'Taiwan Strait', query:'Taiwan China military strait conflict', category:'War/Conflict', sortOrder:1 },
  { region:'East Asia', label:'North Korea Missiles', query:'North Korea missile nuclear test ICBM', category:'Nuclear', sortOrder:2 },
  { region:'East Asia', label:'South China Sea', query:'South China Sea dispute islands military', category:'Maritime', sortOrder:3 },
  { region:'East Asia', label:'US-China Competition', query:'US China trade war technology competition', category:'Economy', sortOrder:4 },
  { region:'East Asia', label:'AUKUS Alliance', query:'AUKUS submarine alliance Pacific', category:'Military', sortOrder:5 },
  { region:'East Asia', label:'Semiconductor War', query:'semiconductor chip Taiwan TSMC export controls', category:'Technology', sortOrder:6 },
  { region:'East Asia', label:'Japan Rearmament', query:'Japan defense military rearmament', category:'Military', sortOrder:7 },
  { region:'East Asia', label:'China Economy', query:'China economy debt property crisis', category:'Economy', sortOrder:8 },
  // Asia-Pacific
  { region:'Asia-Pacific', label:'Myanmar Civil War', query:'Myanmar military junta civil war', category:'War/Conflict', sortOrder:1 },
  { region:'Asia-Pacific', label:'Pacific Islands Competition', query:'Pacific Islands China US competition', category:'Diplomacy', sortOrder:2 },
  { region:'Asia-Pacific', label:'Strait of Malacca', query:'Strait of Malacca shipping security', category:'Maritime', sortOrder:3 },
  { region:'Asia-Pacific', label:'Philippines South China Sea', query:'Philippines South China Sea China confrontation', category:'Maritime', sortOrder:4 },
  { region:'Asia-Pacific', label:'Indonesia Politics', query:'Indonesia politics Prabowo military', category:'Politics', sortOrder:5 },
  { region:'Asia-Pacific', label:'Australia Defense', query:'Australia defense AUKUS China threat', category:'Military', sortOrder:6 },
  { region:'Asia-Pacific', label:'Papua Conflict', query:'Papua New Guinea Indonesia separatism', category:'Security', sortOrder:7 },
  // South Asia
  { region:'South Asia', label:'India-Pakistan Tensions', query:'India Pakistan Kashmir military tensions', category:'War/Conflict', sortOrder:1 },
  { region:'South Asia', label:'Afghanistan Taliban', query:'Afghanistan Taliban ISIS-K terrorism', category:'Security', sortOrder:2 },
  { region:'South Asia', label:'India-China Border', query:'India China LAC border Galwan', category:'Military', sortOrder:3 },
  { region:'South Asia', label:'Pakistan Crisis', query:'Pakistan economic political crisis IMF', category:'Economy', sortOrder:4 },
  { region:'South Asia', label:'India Rise', query:'India global power Modi foreign policy', category:'Diplomacy', sortOrder:5 },
  { region:'South Asia', label:'Bangladesh Politics', query:'Bangladesh Hasina politics military', category:'Politics', sortOrder:6 },
  { region:'South Asia', label:'Sri Lanka Recovery', query:'Sri Lanka economic recovery debt', category:'Economy', sortOrder:7 },
  // Central Asia
  { region:'Central Asia', label:'Russia Influence', query:'Central Asia Russia influence CSTO', category:'Diplomacy', sortOrder:1 },
  { region:'Central Asia', label:'China BRI', query:'Central Asia China Belt Road Initiative', category:'Economy', sortOrder:2 },
  { region:'Central Asia', label:'Kazakhstan Energy', query:'Kazakhstan oil energy Tengiz Caspian', category:'Energy', sortOrder:3 },
  { region:'Central Asia', label:'Tajikistan Kyrgyzstan Conflict', query:'Tajikistan Kyrgyzstan border conflict', category:'War/Conflict', sortOrder:4 },
  { region:'Central Asia', label:'Uzbekistan Reform', query:'Uzbekistan Mirziyoyev reform economy', category:'Politics', sortOrder:5 },
  { region:'Central Asia', label:'Turkmenistan Gas', query:'Turkmenistan natural gas Galkynysh', category:'Energy', sortOrder:6 },
  // Sub-Saharan Africa
  { region:'Sub-Saharan Africa', label:'Sahel Coups', query:'Sahel coup Mali Niger Burkina Faso', category:'Politics', sortOrder:1 },
  { region:'Sub-Saharan Africa', label:'Sudan Civil War', query:'Sudan SAF RSF civil war Darfur', category:'War/Conflict', sortOrder:2 },
  { region:'Sub-Saharan Africa', label:'DRC Conflict', query:'DRC Congo M23 FDLR conflict', category:'War/Conflict', sortOrder:3 },
  { region:'Sub-Saharan Africa', label:'Somalia Al-Shabaab', query:'Somalia Al-Shabaab terrorism AMISOM', category:'Security', sortOrder:4 },
  { region:'Sub-Saharan Africa', label:'Wagner Russia Africa', query:'Wagner Russia Africa Sahel military', category:'Military', sortOrder:5 },
  { region:'Sub-Saharan Africa', label:'Ethiopia Tigray', query:'Ethiopia Tigray conflict humanitarian', category:'Humanitarian', sortOrder:6 },
  { region:'Sub-Saharan Africa', label:'Nigeria Insecurity', query:'Nigeria Boko Haram ISWAP Fulani', category:'Security', sortOrder:7 },
  { region:'Sub-Saharan Africa', label:'China Africa', query:'China Africa investment BRI debt', category:'Economy', sortOrder:8 },
  // North Africa
  { region:'North Africa', label:'Libya Civil War', query:'Libya civil war LNA GNA Haftar', category:'War/Conflict', sortOrder:1 },
  { region:'North Africa', label:'Algeria Energy', query:'Algeria gas energy Sonatrach Europe', category:'Energy', sortOrder:2 },
  { region:'North Africa', label:'Morocco Western Sahara', query:'Morocco Western Sahara Polisario', category:'Diplomacy', sortOrder:3 },
  { region:'North Africa', label:'Tunisia Crisis', query:'Tunisia Saied political crisis', category:'Politics', sortOrder:4 },
  { region:'North Africa', label:'Migration Crisis', query:'North Africa migration Mediterranean Europe', category:'Humanitarian', sortOrder:5 },
  // Americas
  { region:'Americas', label:'US Elections & Policy', query:'US foreign policy defense military 2024', category:'Politics', sortOrder:1 },
  { region:'Americas', label:'US-China Rivalry', query:'US China competition technology military', category:'Diplomacy', sortOrder:2 },
  { region:'Americas', label:'Mexico Cartels', query:'Mexico cartel drug trafficking security', category:'Security', sortOrder:3 },
  { region:'Americas', label:'Arctic Competition', query:'Arctic Russia China US competition', category:'Military', sortOrder:4 },
  { region:'Americas', label:'NATO Americas', query:'NATO US Canada defense Arctic', category:'Military', sortOrder:5 },
  // Latin America
  { region:'Latin America', label:'Venezuela Crisis', query:'Venezuela Maduro opposition crisis', category:'Politics', sortOrder:1 },
  { region:'Latin America', label:'Colombia Peace', query:'Colombia FARC ELN peace negotiations', category:'Diplomacy', sortOrder:2 },
  { region:'Latin America', label:'Brazil Politics', query:'Brazil Lula politics Amazon deforestation', category:'Politics', sortOrder:3 },
  { region:'Latin America', label:'Lithium Race', query:'lithium Bolivia Chile Argentina critical minerals', category:'Energy', sortOrder:4 },
  { region:'Latin America', label:'China Influence', query:'China Latin America investment ports BRI', category:'Economy', sortOrder:5 },
  { region:'Latin America', label:'Drug Trafficking', query:'Latin America drug trafficking cartel', category:'Security', sortOrder:6 },
];
for (const g of gntData) await ins('google_news_topics', g);
console.log(`  ✓ ${gntData.length} Google News topics`);

// ─── 6. REGION HOTSPOTS ───────────────────────────────────────────────────────
console.log('Seeding region_hotspots...');
const hotspotsData = [
  // MENA
  { region:'MENA', name:'Gaza Strip', lat:31.35, lon:34.31, intensity:1.0, threatLevel:'CRITICAL', description:'Active armed conflict — Israel-Hamas war' },
  { region:'MENA', name:'Kyiv Front', lat:33.31, lon:44.44, intensity:0.9, threatLevel:'CRITICAL', description:'Iraq-Syria ISIS remnants' },
  { region:'MENA', name:'Hodeidah Yemen', lat:14.80, lon:42.95, intensity:0.95, threatLevel:'CRITICAL', description:'Houthi-controlled port; Red Sea attacks' },
  { region:'MENA', name:'Aleppo Syria', lat:36.20, lon:37.16, intensity:0.85, threatLevel:'HIGH', description:'Post-conflict reconstruction zone' },
  { region:'MENA', name:'Beirut Lebanon', lat:33.89, lon:35.50, intensity:0.80, threatLevel:'HIGH', description:'Hezbollah-Israel ceasefire zone' },
  { region:'MENA', name:'Strait of Hormuz', lat:26.57, lon:56.25, intensity:0.90, threatLevel:'CRITICAL', description:'Iran-US naval confrontation chokepoint' },
  { region:'MENA', name:'Tehran Iran', lat:35.69, lon:51.39, intensity:0.85, threatLevel:'HIGH', description:'Nuclear program; US-Iran tensions' },
  { region:'MENA', name:'Mosul Iraq', lat:36.34, lon:43.13, intensity:0.70, threatLevel:'HIGH', description:'ISIS remnants; ongoing operations' },
  // Europe
  { region:'Europe', name:'Zaporizhzhia Ukraine', lat:47.51, lon:34.59, intensity:1.0, threatLevel:'CRITICAL', description:'Active frontline; nuclear plant under fire' },
  { region:'Europe', name:'Bakhmut Ukraine', lat:48.60, lon:37.99, intensity:0.95, threatLevel:'CRITICAL', description:'Eastern Ukraine frontline' },
  { region:'Europe', name:'Kaliningrad Russia', lat:54.71, lon:20.45, intensity:0.85, threatLevel:'HIGH', description:'Russian exclave; Iskander missiles' },
  { region:'Europe', name:'Bosphorus Turkey', lat:41.10, lon:29.05, intensity:0.75, threatLevel:'ELEVATED', description:'Strategic chokepoint; Black Sea access' },
  { region:'Europe', name:'Kosovo Serbia', lat:42.60, lon:21.00, intensity:0.70, threatLevel:'ELEVATED', description:'Ongoing ethnic tensions' },
  { region:'Europe', name:'Tallinn Estonia', lat:59.44, lon:24.75, intensity:0.65, threatLevel:'ELEVATED', description:'NATO eastern flank; Russian hybrid threats' },
  // East Asia
  { region:'East Asia', name:'Taiwan Strait', lat:24.50, lon:119.50, intensity:1.0, threatLevel:'CRITICAL', description:'PLA military exercises; invasion risk' },
  { region:'East Asia', name:'Senkaku Islands', lat:25.75, lon:123.47, intensity:0.85, threatLevel:'HIGH', description:'Japan-China territorial dispute' },
  { region:'East Asia', name:'North Korea DMZ', lat:38.31, lon:127.14, intensity:0.90, threatLevel:'CRITICAL', description:'DPRK missile launches; nuclear threat' },
  { region:'East Asia', name:'South China Sea', lat:12.00, lon:114.00, intensity:0.85, threatLevel:'HIGH', description:'Chinese artificial islands; US FONOPs' },
  { region:'East Asia', name:'Yongbyon DPRK', lat:39.78, lon:125.75, intensity:0.90, threatLevel:'CRITICAL', description:'North Korea nuclear weapons facility' },
  // Asia-Pacific
  { region:'Asia-Pacific', name:'Myanmar Conflict', lat:21.92, lon:95.96, intensity:0.90, threatLevel:'CRITICAL', description:'Civil war; junta vs resistance forces' },
  { region:'Asia-Pacific', name:'Strait of Malacca', lat:2.50, lon:101.50, intensity:0.75, threatLevel:'ELEVATED', description:'World\'s busiest shipping lane' },
  { region:'Asia-Pacific', name:'West Papua', lat:-4.05, lon:137.12, intensity:0.70, threatLevel:'HIGH', description:'Indonesian separatist conflict' },
  { region:'Asia-Pacific', name:'Mindanao Philippines', lat:7.87, lon:125.00, intensity:0.65, threatLevel:'ELEVATED', description:'Abu Sayyaf and BIFF activity' },
  // South Asia
  { region:'South Asia', name:'Kashmir LoC', lat:34.00, lon:74.50, intensity:0.90, threatLevel:'CRITICAL', description:'India-Pakistan nuclear-armed standoff' },
  { region:'South Asia', name:'Kabul Afghanistan', lat:34.53, lon:69.17, intensity:0.85, threatLevel:'HIGH', description:'Taliban rule; ISIS-K attacks' },
  { region:'South Asia', name:'Galwan Valley', lat:34.70, lon:78.20, intensity:0.80, threatLevel:'HIGH', description:'India-China border standoff' },
  { region:'South Asia', name:'Balochistan Pakistan', lat:29.00, lon:65.00, intensity:0.75, threatLevel:'HIGH', description:'BLA insurgency; CPEC attacks' },
  // Central Asia
  { region:'Central Asia', name:'Fergana Valley', lat:40.50, lon:71.50, intensity:0.70, threatLevel:'ELEVATED', description:'Tajikistan-Kyrgyzstan border conflict zone' },
  { region:'Central Asia', name:'Afghan-Tajik Border', lat:37.00, lon:73.50, intensity:0.75, threatLevel:'HIGH', description:'Taliban spillover; drug trafficking' },
  { region:'Central Asia', name:'Caspian Sea', lat:42.00, lon:51.00, intensity:0.60, threatLevel:'ELEVATED', description:'Energy competition; Russian-Iranian presence' },
  // Sub-Saharan Africa
  { region:'Sub-Saharan Africa', name:'Sahel Tri-Border', lat:15.00, lon:1.50, intensity:0.95, threatLevel:'CRITICAL', description:'JNIM and ISGS jihadist operations' },
  { region:'Sub-Saharan Africa', name:'Khartoum Sudan', lat:15.50, lon:32.55, intensity:0.95, threatLevel:'CRITICAL', description:'SAF-RSF civil war; mass atrocities' },
  { region:'Sub-Saharan Africa', name:'Eastern DRC', lat:-1.50, lon:29.00, intensity:0.90, threatLevel:'CRITICAL', description:'M23 advance; FDLR; ADF attacks' },
  { region:'Sub-Saharan Africa', name:'Mogadishu Somalia', lat:2.01, lon:45.34, intensity:0.85, threatLevel:'HIGH', description:'Al-Shabaab attacks; AMISOM operations' },
  { region:'Sub-Saharan Africa', name:'Lake Chad Basin', lat:13.50, lon:14.00, intensity:0.85, threatLevel:'HIGH', description:'Boko Haram and ISWAP operations' },
  { region:'Sub-Saharan Africa', name:'Tigray Ethiopia', lat:14.00, lon:38.50, intensity:0.80, threatLevel:'HIGH', description:'Post-war reconstruction; Amhara conflict' },
  // North Africa
  { region:'North Africa', name:'Tripoli Libya', lat:32.90, lon:13.18, intensity:0.85, threatLevel:'HIGH', description:'GNA-LNA political standoff' },
  { region:'North Africa', name:'Sirte Libya', lat:31.21, lon:16.59, intensity:0.80, threatLevel:'HIGH', description:'LNA-GNA frontline; oil crescent' },
  { region:'North Africa', name:'Algerian Sahara', lat:24.00, lon:3.00, intensity:0.65, threatLevel:'ELEVATED', description:'AQIM remnants; smuggling routes' },
  // Americas
  { region:'Americas', name:'US-Mexico Border', lat:31.00, lon:-110.00, intensity:0.75, threatLevel:'ELEVATED', description:'Cartel activity; migration crisis' },
  { region:'Americas', name:'Havana Cuba', lat:23.13, lon:-82.38, intensity:0.60, threatLevel:'ELEVATED', description:'US-Cuba tensions; Russian presence' },
  // Latin America
  { region:'Latin America', name:'Catatumbo Colombia', lat:8.50, lon:-73.00, intensity:0.85, threatLevel:'HIGH', description:'FARC-ELN conflict; coca production' },
  { region:'Latin America', name:'Caracas Venezuela', lat:10.48, lon:-66.88, intensity:0.80, threatLevel:'HIGH', description:'Maduro regime; political repression' },
  { region:'Latin America', name:'Tri-Border TBA', lat:-25.50, lon:-54.58, intensity:0.70, threatLevel:'ELEVATED', description:'Hezbollah fundraising; organized crime' },
  { region:'Latin America', name:'Sinaloa Mexico', lat:25.00, lon:-107.50, intensity:0.85, threatLevel:'HIGH', description:'Cartel wars; fentanyl trafficking' },
];
for (const h of hotspotsData) await ins('region_hotspots', h);
console.log(`  ✓ ${hotspotsData.length} hotspots`);

// ─── 7. POPULATION DATA ───────────────────────────────────────────────────────
console.log('Seeding population_data...');
const src_wb = ['World Bank WDI 2024'];
const src_un = ['UN DESA 2024', 'UNHCR 2024'];
const src_all = ['World Bank WDI 2024', 'UN DESA 2024', 'UNHCR 2024', 'UNDP HDR 2023/24'];
const popData = [
  // MENA (original data preserved exactly)
  { country:'Egypt',        iso3:'EGY', region:'MENA', population:107394000, displaced:350000,  refugees:265000,  idps:0,       urbanPct:43, gdpPerCapita:3699,  hdi:0.731, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Saudi Arabia', iso3:'SAU', region:'MENA', population:36408000,  displaced:0,       refugees:500000,  idps:0,       urbanPct:84, gdpPerCapita:23186, hdi:0.875, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Iran',         iso3:'IRN', region:'MENA', population:88550000,  displaced:0,       refugees:3400000, idps:0,       urbanPct:76, gdpPerCapita:4600,  hdi:0.774, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Iraq',         iso3:'IRQ', region:'MENA', population:42164000,  displaced:1200000, refugees:300000,  idps:1200000, urbanPct:71, gdpPerCapita:5765,  hdi:0.686, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Syria',        iso3:'SYR', region:'MENA', population:21324000,  displaced:7600000, refugees:6600000, idps:7600000, urbanPct:57, gdpPerCapita:533,   hdi:0.577, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Yemen',        iso3:'YEM', region:'MENA', population:33697000,  displaced:4500000, refugees:100000,  idps:4500000, urbanPct:38, gdpPerCapita:688,   hdi:0.455, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Israel',       iso3:'ISR', region:'MENA', population:9756000,   displaced:200000,  refugees:0,       idps:200000,  urbanPct:93, gdpPerCapita:54930, hdi:0.919, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Palestine',    iso3:'PSE', region:'MENA', population:5483000,   displaced:1900000, refugees:5900000, idps:1900000, urbanPct:77, gdpPerCapita:3789,  hdi:0.715, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Jordan',       iso3:'JOR', region:'MENA', population:10269000,  displaced:0,       refugees:3000000, idps:0,       urbanPct:91, gdpPerCapita:4300,  hdi:0.729, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Lebanon',      iso3:'LBN', region:'MENA', population:5592000,   displaced:1200000, refugees:1500000, idps:1200000, urbanPct:89, gdpPerCapita:4136,  hdi:0.706, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Turkey',       iso3:'TUR', region:'MENA', population:85326000,  displaced:0,       refugees:3600000, idps:0,       urbanPct:77, gdpPerCapita:10616, hdi:0.838, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'UAE',          iso3:'ARE', region:'MENA', population:9770000,   displaced:0,       refugees:0,       idps:0,       urbanPct:87, gdpPerCapita:44315, hdi:0.911, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Kuwait',       iso3:'KWT', region:'MENA', population:4310000,   displaced:0,       refugees:0,       idps:0,       urbanPct:100,gdpPerCapita:27038, hdi:0.847, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Qatar',        iso3:'QAT', region:'MENA', population:2695000,   displaced:0,       refugees:0,       idps:0,       urbanPct:99, gdpPerCapita:83891, hdi:0.855, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Libya',        iso3:'LBY', region:'MENA', population:7054000,   displaced:135000,  refugees:0,       idps:135000,  urbanPct:81, gdpPerCapita:6357,  hdi:0.718, conflictLevel:'high',     dataYear:2024, sources:src_all },
  // Europe
  { country:'Russia',         iso3:'RUS', region:'Europe', population:144444000, displaced:0,       refugees:1200000, idps:0,       urbanPct:75, gdpPerCapita:12195, hdi:0.821, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Ukraine',        iso3:'UKR', region:'Europe', population:37000000,  displaced:6500000, refugees:6500000, idps:5000000, urbanPct:70, gdpPerCapita:4534,  hdi:0.773, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Germany',        iso3:'DEU', region:'Europe', population:84607000,  displaced:0,       refugees:2200000, idps:0,       urbanPct:77, gdpPerCapita:48717, hdi:0.942, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'France',         iso3:'FRA', region:'Europe', population:68170000,  displaced:0,       refugees:450000,  idps:0,       urbanPct:81, gdpPerCapita:43659, hdi:0.910, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'United Kingdom', iso3:'GBR', region:'Europe', population:67736000,  displaced:0,       refugees:250000,  idps:0,       urbanPct:84, gdpPerCapita:45850, hdi:0.929, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Poland',         iso3:'POL', region:'Europe', population:37654000,  displaced:0,       refugees:1000000, idps:0,       urbanPct:60, gdpPerCapita:18000, hdi:0.876, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Serbia',         iso3:'SRB', region:'Europe', population:6834000,   displaced:0,       refugees:25000,   idps:0,       urbanPct:57, gdpPerCapita:9500,  hdi:0.805, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Belarus',        iso3:'BLR', region:'Europe', population:9408000,   displaced:0,       refugees:10000,   idps:0,       urbanPct:80, gdpPerCapita:7300,  hdi:0.808, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  // East Asia
  { country:'China',       iso3:'CHN', region:'East Asia', population:1409670000, displaced:0,       refugees:300000,  idps:0,       urbanPct:65, gdpPerCapita:12720, hdi:0.788, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Japan',       iso3:'JPN', region:'East Asia', population:123295000,  displaced:0,       refugees:5000,    idps:0,       urbanPct:92, gdpPerCapita:33815, hdi:0.920, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'South Korea', iso3:'KOR', region:'East Asia', population:51712000,   displaced:0,       refugees:1500,    idps:0,       urbanPct:82, gdpPerCapita:32422, hdi:0.929, conflictLevel:'elevated', dataYear:2024, sources:src_all },
  { country:'North Korea', iso3:'PRK', region:'East Asia', population:25971000,   displaced:0,       refugees:0,       idps:0,       urbanPct:63, gdpPerCapita:1800,  hdi:0.733, conflictLevel:'critical', dataYear:2024, sources:src_wb },
  { country:'Taiwan',      iso3:'TWN', region:'East Asia', population:23570000,   displaced:0,       refugees:0,       idps:0,       urbanPct:79, gdpPerCapita:32811, hdi:0.916, conflictLevel:'high',     dataYear:2024, sources:src_wb },
  // Asia-Pacific
  { country:'Australia',      iso3:'AUS', region:'Asia-Pacific', population:26439000,  displaced:0,       refugees:60000,   idps:0,       urbanPct:86, gdpPerCapita:65099, hdi:0.946, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Indonesia',      iso3:'IDN', region:'Asia-Pacific', population:277534000,  displaced:0,       refugees:13000,   idps:0,       urbanPct:58, gdpPerCapita:4788,  hdi:0.713, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Philippines',    iso3:'PHL', region:'Asia-Pacific', population:115560000,  displaced:0,       refugees:2000,    idps:100000,  urbanPct:48, gdpPerCapita:3623,  hdi:0.710, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Vietnam',        iso3:'VNM', region:'Asia-Pacific', population:98187000,   displaced:0,       refugees:1000,    idps:0,       urbanPct:38, gdpPerCapita:4163,  hdi:0.726, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Myanmar',        iso3:'MMR', region:'Asia-Pacific', population:54410000,   displaced:1500000, refugees:1200000, idps:2000000, urbanPct:32, gdpPerCapita:1210,  hdi:0.585, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Thailand',       iso3:'THA', region:'Asia-Pacific', population:71697000,   displaced:0,       refugees:90000,   idps:0,       urbanPct:52, gdpPerCapita:7066,  hdi:0.800, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Malaysia',       iso3:'MYS', region:'Asia-Pacific', population:33574000,   displaced:0,       refugees:180000,  idps:0,       urbanPct:78, gdpPerCapita:12364, hdi:0.803, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Singapore',      iso3:'SGP', region:'Asia-Pacific', population:5917000,    displaced:0,       refugees:0,       idps:0,       urbanPct:100,gdpPerCapita:65233, hdi:0.939, conflictLevel:'low',      dataYear:2024, sources:src_all },
  // South Asia
  { country:'India',       iso3:'IND', region:'South Asia', population:1428628000, displaced:0,       refugees:200000,  idps:0,       urbanPct:36, gdpPerCapita:2389,  hdi:0.644, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Pakistan',    iso3:'PAK', region:'South Asia', population:231402000,  displaced:0,       refugees:1300000, idps:0,       urbanPct:37, gdpPerCapita:1568,  hdi:0.540, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Bangladesh',  iso3:'BGD', region:'South Asia', population:172954000,  displaced:0,       refugees:950000,  idps:0,       urbanPct:40, gdpPerCapita:2688,  hdi:0.661, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Afghanistan', iso3:'AFG', region:'South Asia', population:42240000,   displaced:5000000, refugees:2800000, idps:3500000, urbanPct:26, gdpPerCapita:363,   hdi:0.478, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Sri Lanka',   iso3:'LKA', region:'South Asia', population:22156000,   displaced:0,       refugees:0,       idps:0,       urbanPct:19, gdpPerCapita:3473,  hdi:0.780, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Nepal',       iso3:'NPL', region:'South Asia', population:30034000,   displaced:0,       refugees:20000,   idps:0,       urbanPct:22, gdpPerCapita:1337,  hdi:0.601, conflictLevel:'low',      dataYear:2024, sources:src_all },
  // Central Asia
  { country:'Kazakhstan',   iso3:'KAZ', region:'Central Asia', population:19398000, displaced:0, refugees:5000,  idps:0, urbanPct:58, gdpPerCapita:10041, hdi:0.802, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Uzbekistan',   iso3:'UZB', region:'Central Asia', population:35300000, displaced:0, refugees:3000,  idps:0, urbanPct:51, gdpPerCapita:2255,  hdi:0.727, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Turkmenistan', iso3:'TKM', region:'Central Asia', population:6118000,  displaced:0, refugees:0,     idps:0, urbanPct:53, gdpPerCapita:7612,  hdi:0.745, conflictLevel:'low',      dataYear:2024, sources:src_wb },
  { country:'Kyrgyzstan',   iso3:'KGZ', region:'Central Asia', population:6735000,  displaced:0, refugees:2000,  idps:0, urbanPct:38, gdpPerCapita:1275,  hdi:0.692, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Tajikistan',   iso3:'TJK', region:'Central Asia', population:10143000, displaced:0, refugees:5000,  idps:0, urbanPct:28, gdpPerCapita:1059,  hdi:0.685, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  // Sub-Saharan Africa
  { country:'Nigeria',    iso3:'NGA', region:'Sub-Saharan Africa', population:223804000, displaced:2000000, refugees:90000,   idps:2000000, urbanPct:54, gdpPerCapita:2184,  hdi:0.535, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Ethiopia',   iso3:'ETH', region:'Sub-Saharan Africa', population:126527000, displaced:3500000, refugees:900000,  idps:3500000, urbanPct:23, gdpPerCapita:1020,  hdi:0.492, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'DRC',        iso3:'COD', region:'Sub-Saharan Africa', population:102262000, displaced:7200000, refugees:530000,  idps:7200000, urbanPct:47, gdpPerCapita:576,   hdi:0.479, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'South Africa',iso3:'ZAF',region:'Sub-Saharan Africa', population:60414000,  displaced:0,       refugees:270000,  idps:0,       urbanPct:68, gdpPerCapita:6001,  hdi:0.713, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Kenya',      iso3:'KEN', region:'Sub-Saharan Africa', population:55100000,  displaced:0,       refugees:580000,  idps:0,       urbanPct:29, gdpPerCapita:2082,  hdi:0.601, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Somalia',    iso3:'SOM', region:'Sub-Saharan Africa', population:18143000,  displaced:3500000, refugees:900000,  idps:3500000, urbanPct:47, gdpPerCapita:447,   hdi:0.285, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Sudan',      iso3:'SDN', region:'Sub-Saharan Africa', population:47958000,  displaced:8200000, refugees:1100000, idps:8200000, urbanPct:35, gdpPerCapita:851,   hdi:0.508, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Mali',       iso3:'MLI', region:'Sub-Saharan Africa', population:22414000,  displaced:375000,  refugees:30000,   idps:375000,  urbanPct:45, gdpPerCapita:870,   hdi:0.428, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Niger',      iso3:'NER', region:'Sub-Saharan Africa', population:26207000,  displaced:350000,  refugees:250000,  idps:350000,  urbanPct:17, gdpPerCapita:553,   hdi:0.394, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Burkina Faso',iso3:'BFA',region:'Sub-Saharan Africa', population:22674000,  displaced:2000000, refugees:30000,   idps:2000000, urbanPct:32, gdpPerCapita:815,   hdi:0.449, conflictLevel:'critical', dataYear:2024, sources:src_all },
  { country:'Mozambique', iso3:'MOZ', region:'Sub-Saharan Africa', population:32790000,  displaced:800000,  refugees:0,       idps:800000,  urbanPct:38, gdpPerCapita:507,   hdi:0.456, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Tanzania',   iso3:'TZA', region:'Sub-Saharan Africa', population:65497000,  displaced:0,       refugees:230000,  idps:0,       urbanPct:37, gdpPerCapita:1136,  hdi:0.532, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Djibouti',   iso3:'DJI', region:'Sub-Saharan Africa', population:1136000,   displaced:0,       refugees:28000,   idps:0,       urbanPct:78, gdpPerCapita:3374,  hdi:0.524, conflictLevel:'low',      dataYear:2024, sources:src_all },
  // North Africa
  { country:'Algeria',   iso3:'DZA', region:'North Africa', population:45606000, displaced:0,      refugees:100000, idps:0,      urbanPct:74, gdpPerCapita:4064,  hdi:0.745, conflictLevel:'medium', dataYear:2024, sources:src_all },
  { country:'Morocco',   iso3:'MAR', region:'North Africa', population:37840000, displaced:0,      refugees:5000,   idps:0,      urbanPct:65, gdpPerCapita:3795,  hdi:0.683, conflictLevel:'low',    dataYear:2024, sources:src_all },
  { country:'Tunisia',   iso3:'TUN', region:'North Africa', population:12048000, displaced:0,      refugees:10000,  idps:0,      urbanPct:71, gdpPerCapita:3776,  hdi:0.731, conflictLevel:'medium', dataYear:2024, sources:src_all },
  { country:'Mauritania',iso3:'MRT', region:'North Africa', population:4615000,  displaced:0,      refugees:90000,  idps:0,      urbanPct:57, gdpPerCapita:1946,  hdi:0.540, conflictLevel:'medium', dataYear:2024, sources:src_all },
  // Americas
  { country:'United States', iso3:'USA', region:'Americas', population:335893000, displaced:0,       refugees:1200000, idps:0,       urbanPct:83, gdpPerCapita:76329, hdi:0.927, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Canada',        iso3:'CAN', region:'Americas', population:38781000,  displaced:0,       refugees:200000,  idps:0,       urbanPct:82, gdpPerCapita:52051, hdi:0.935, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Mexico',        iso3:'MEX', region:'Americas', population:128455000, displaced:0,       refugees:30000,   idps:0,       urbanPct:81, gdpPerCapita:10046, hdi:0.770, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Cuba',          iso3:'CUB', region:'Americas', population:11089000,  displaced:0,       refugees:0,       idps:0,       urbanPct:77, gdpPerCapita:9500,  hdi:0.764, conflictLevel:'medium',   dataYear:2024, sources:src_wb },
  // Latin America
  { country:'Brazil',    iso3:'BRA', region:'Latin America', population:215313000, displaced:0,       refugees:570000,  idps:0,       urbanPct:88, gdpPerCapita:8917,  hdi:0.760, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Colombia',  iso3:'COL', region:'Latin America', population:52215000,  displaced:0,       refugees:2500000, idps:4900000, urbanPct:81, gdpPerCapita:6104,  hdi:0.752, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Venezuela', iso3:'VEN', region:'Latin America', population:28302000,  displaced:0,       refugees:7700000, idps:0,       urbanPct:88, gdpPerCapita:3500,  hdi:0.691, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Argentina', iso3:'ARG', region:'Latin America', population:45773000,  displaced:0,       refugees:200000,  idps:0,       urbanPct:93, gdpPerCapita:10461, hdi:0.849, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Chile',     iso3:'CHL', region:'Latin America', population:19629000,  displaced:0,       refugees:500000,  idps:0,       urbanPct:88, gdpPerCapita:15358, hdi:0.860, conflictLevel:'low',      dataYear:2024, sources:src_all },
  { country:'Peru',      iso3:'PER', region:'Latin America', population:33715000,  displaced:0,       refugees:1500000, idps:0,       urbanPct:79, gdpPerCapita:6794,  hdi:0.762, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Bolivia',   iso3:'BOL', region:'Latin America', population:12388000,  displaced:0,       refugees:10000,   idps:0,       urbanPct:71, gdpPerCapita:3548,  hdi:0.698, conflictLevel:'medium',   dataYear:2024, sources:src_all },
  { country:'Ecuador',   iso3:'ECU', region:'Latin America', population:18001000,  displaced:0,       refugees:500000,  idps:0,       urbanPct:65, gdpPerCapita:6003,  hdi:0.765, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Guatemala', iso3:'GTM', region:'Latin America', population:17843000,  displaced:0,       refugees:30000,   idps:0,       urbanPct:53, gdpPerCapita:5020,  hdi:0.627, conflictLevel:'high',     dataYear:2024, sources:src_all },
  { country:'Honduras',  iso3:'HND', region:'Latin America', population:10278000,  displaced:0,       refugees:10000,   idps:0,       urbanPct:59, gdpPerCapita:2756,  hdi:0.621, conflictLevel:'high',     dataYear:2024, sources:src_all },
];
for (const p of popData) await ins('population_data', p);
console.log(`  ✓ ${popData.length} population records`);

// ─── 8. UN SOURCES ────────────────────────────────────────────────────────────
console.log('Seeding un_sources...');
const unSourcesData = [
  // Global
  { name:'ACLED', url:'https://acleddata.com/', category:'Conflict', type:'Research Organization', region:'Global', dataTypes:['Conflict Events','Fatalities','Actors'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://api.acleddata.com/', description:'Armed Conflict Location & Event Data Project — most comprehensive conflict database.', sortOrder:1 },
  { name:'UN OCHA ReliefWeb', url:'https://reliefweb.int/', category:'Humanitarian', type:'UN Agency', region:'Global', dataTypes:['Situation Reports','Maps','Assessments'], updateFreq:'Daily', verified:true, apiAvailable:true, apiUrl:'https://api.reliefweb.int/', description:'UN humanitarian information platform.', sortOrder:2 },
  { name:'UNHCR Global Trends', url:'https://www.unhcr.org/global-trends', category:'Refugees', type:'UN Agency', region:'Global', dataTypes:['Refugees','IDPs','Stateless'], updateFreq:'Annual', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR annual global displacement statistics.', sortOrder:3 },
  { name:'World Bank Open Data', url:'https://data.worldbank.org/', category:'Economy', type:'International Organization', region:'Global', dataTypes:['GDP','Poverty','Development Indicators'], updateFreq:'Annual', verified:true, apiAvailable:true, apiUrl:'https://api.worldbank.org/v2/', description:'World Bank development data for 217 economies.', sortOrder:4 },
  { name:'SIPRI Military Expenditure', url:'https://www.sipri.org/databases/milex', category:'Military', type:'Research Organization', region:'Global', dataTypes:['Military Spending','Defense Budgets'], updateFreq:'Annual', verified:true, apiAvailable:false, description:'Stockholm International Peace Research Institute military expenditure database.', sortOrder:5 },
  { name:'IAEA PRIS', url:'https://pris.iaea.org/', category:'Nuclear', type:'UN Agency', region:'Global', dataTypes:['Nuclear Reactors','Power Generation','Safety'], updateFreq:'Monthly', verified:true, apiAvailable:false, description:'IAEA Power Reactor Information System — all nuclear plants worldwide.', sortOrder:6 },
  { name:'GDELT Project', url:'https://www.gdeltproject.org/', category:'News Analytics', type:'Research Organization', region:'Global', dataTypes:['News Events','Tone','Themes','Locations'], updateFreq:'Continuous', verified:true, apiAvailable:true, apiUrl:'https://api.gdeltproject.org/', description:'Global Database of Events, Language, and Tone — 100+ languages.', sortOrder:7 },
  { name:'UN Comtrade', url:'https://comtradeplus.un.org/', category:'Economy', type:'UN Agency', region:'Global', dataTypes:['Trade Flows','Commodity Data','Partners'], updateFreq:'Monthly', verified:true, apiAvailable:true, apiUrl:'https://comtradeapi.un.org/', description:'UN international trade statistics database.', sortOrder:8 },
  { name:'NASA Earthdata', url:'https://earthdata.nasa.gov/', category:'Environment', type:'Government', region:'Global', dataTypes:['Satellite Imagery','Climate','Fires','Floods'], updateFreq:'Daily', verified:true, apiAvailable:true, apiUrl:'https://cmr.earthdata.nasa.gov/', description:'NASA Earth observation data including conflict-related environmental monitoring.', sortOrder:9 },
  { name:'UNOSAT Satellite Analysis', url:'https://unosat.org/', category:'Infrastructure', type:'UN Agency', region:'Global', dataTypes:['Damage Assessment','Displacement','Infrastructure'], updateFreq:'As needed', verified:true, apiAvailable:false, description:'UN satellite analysis for humanitarian response.', sortOrder:10 },
  { name:'OCHA Financial Tracking', url:'https://fts.unocha.org/', category:'Humanitarian', type:'UN Agency', region:'Global', dataTypes:['Humanitarian Funding','Appeals','Donors'], updateFreq:'Daily', verified:true, apiAvailable:true, apiUrl:'https://api.fts.unocha.org/', description:'UN OCHA financial tracking service for humanitarian aid.', sortOrder:11 },
  { name:'Global Forest Watch', url:'https://www.globalforestwatch.org/', category:'Environment', type:'NGO', region:'Global', dataTypes:['Deforestation','Fires','Land Use'], updateFreq:'Daily', verified:true, apiAvailable:true, apiUrl:'https://api.resourcewatch.org/', description:'Real-time forest monitoring using satellite data.', sortOrder:12 },
  { name:'SIPRI Arms Transfers', url:'https://www.sipri.org/databases/armstransfers', category:'Military', type:'Research Organization', region:'Global', dataTypes:['Arms Transfers','Military Expenditure'], updateFreq:'Annual', verified:true, apiAvailable:false, description:'SIPRI arms transfers database tracking global weapons sales.', sortOrder:13 },
  { name:'Wikidata SPARQL', url:'https://query.wikidata.org/', category:'Reference', type:'Open Source', region:'Global', dataTypes:['Entities','Relationships','Facts'], updateFreq:'Continuous', verified:false, apiAvailable:true, apiUrl:'https://query.wikidata.org/sparql', description:'Structured knowledge base with geopolitical entity data.', sortOrder:14 },
  { name:'UNDP Human Development Reports', url:'https://hdr.undp.org/', category:'Development', type:'UN Agency', region:'Global', dataTypes:['HDI','Inequality','Gender','Poverty'], updateFreq:'Annual', verified:true, apiAvailable:true, apiUrl:'https://api.hdr.undp.org/', description:'UNDP Human Development Index and related indicators.', sortOrder:15 },
  // MENA-specific
  { name:'UNHCR Syria Situation', url:'https://data.unhcr.org/en/situations/syria', category:'Humanitarian', type:'UN Agency', region:'MENA', dataTypes:['Refugees','IDPs','Returns'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR Syria refugee situation tracking.', sortOrder:16 },
  { name:'OCHA Yemen', url:'https://www.unocha.org/yemen', category:'Humanitarian', type:'UN Agency', region:'MENA', dataTypes:['Situation Reports','Funding','Displacement'], updateFreq:'Weekly', verified:true, apiAvailable:false, description:'UN OCHA Yemen humanitarian response coordination.', sortOrder:17 },
  { name:'IAEA Iran Nuclear Monitoring', url:'https://www.iaea.org/topics/iran', category:'Nuclear', type:'UN Agency', region:'MENA', dataTypes:['Enrichment','Safeguards','Inspections'], updateFreq:'As needed', verified:true, apiAvailable:false, description:'IAEA monitoring of Iran nuclear program.', sortOrder:18 },
  // Europe-specific
  { name:'UNHCR Ukraine Situation', url:'https://data.unhcr.org/en/situations/ukraine', category:'Humanitarian', type:'UN Agency', region:'Europe', dataTypes:['Refugees','Displacement','Returns'], updateFreq:'Daily', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR Ukraine refugee situation — 6M+ displaced.', sortOrder:19 },
  { name:'OSCE Conflict Monitor', url:'https://www.osce.org/ukraine-smm', category:'Conflict', type:'International Organization', region:'Europe', dataTypes:['Ceasefire Violations','Incidents','Monitoring'], updateFreq:'Daily', verified:true, apiAvailable:false, description:'OSCE Special Monitoring Mission to Ukraine.', sortOrder:20 },
  { name:'NATO Statistics', url:'https://www.nato.int/cps/en/natohq/topics_49198.htm', category:'Military', type:'International Organization', region:'Europe', dataTypes:['Defense Spending','Force Contributions','Capabilities'], updateFreq:'Annual', verified:true, apiAvailable:false, description:'NATO member defense expenditure and capability data.', sortOrder:21 },
  // Asia-Pacific
  { name:'UNHCR Myanmar Situation', url:'https://data.unhcr.org/en/situations/myanmar', category:'Humanitarian', type:'UN Agency', region:'Asia-Pacific', dataTypes:['Rohingya','Displacement','Returns'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR Myanmar displacement and Rohingya crisis tracking.', sortOrder:22 },
  { name:'ASEAN Stats', url:'https://www.aseanstats.org/', category:'Economy', type:'International Organization', region:'Asia-Pacific', dataTypes:['Trade','Investment','Demographics'], updateFreq:'Annual', verified:true, apiAvailable:false, description:'ASEAN statistical data for Southeast Asian economies.', sortOrder:23 },
  // South Asia
  { name:'UNHCR Afghanistan Situation', url:'https://data.unhcr.org/en/situations/afghanistan', category:'Humanitarian', type:'UN Agency', region:'South Asia', dataTypes:['Refugees','IDPs','Returns'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR Afghanistan displacement — 5M+ displaced.', sortOrder:24 },
  { name:'OCHA Afghanistan', url:'https://www.unocha.org/afghanistan', category:'Humanitarian', type:'UN Agency', region:'South Asia', dataTypes:['Situation Reports','Funding','Displacement'], updateFreq:'Weekly', verified:true, apiAvailable:false, description:'UN OCHA Afghanistan humanitarian coordination.', sortOrder:25 },
  // Sub-Saharan Africa
  { name:'UNHCR DRC Situation', url:'https://data.unhcr.org/en/situations/drc', category:'Humanitarian', type:'UN Agency', region:'Sub-Saharan Africa', dataTypes:['Refugees','IDPs','Returns'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR DRC displacement — 7M+ IDPs.', sortOrder:26 },
  { name:'OCHA Sudan', url:'https://www.unocha.org/sudan', category:'Humanitarian', type:'UN Agency', region:'Sub-Saharan Africa', dataTypes:['Situation Reports','Funding','Displacement'], updateFreq:'Daily', verified:true, apiAvailable:false, description:'UN OCHA Sudan humanitarian response — largest displacement crisis 2024.', sortOrder:27 },
  { name:'ACLED Africa', url:'https://acleddata.com/africa/', category:'Conflict', type:'Research Organization', region:'Sub-Saharan Africa', dataTypes:['Conflict Events','Fatalities','Actors'], updateFreq:'Weekly', verified:true, apiAvailable:true, apiUrl:'https://api.acleddata.com/', description:'ACLED Africa conflict data — Sahel, Horn of Africa, Great Lakes.', sortOrder:28 },
  // Latin America
  { name:'UNHCR Venezuela Situation', url:'https://data.unhcr.org/en/situations/vensit', category:'Humanitarian', type:'UN Agency', region:'Latin America', dataTypes:['Refugees','Displacement','Returns'], updateFreq:'Monthly', verified:true, apiAvailable:true, apiUrl:'https://data.unhcr.org/api/', description:'UNHCR Venezuela displacement — 7.7M+ refugees.', sortOrder:29 },
  { name:'UNODC Drug Report', url:'https://www.unodc.org/unodc/en/data-and-analysis/world-drug-report.html', category:'Security', type:'UN Agency', region:'Latin America', dataTypes:['Drug Trafficking','Production','Seizures'], updateFreq:'Annual', verified:true, apiAvailable:false, description:'UN Office on Drugs and Crime World Drug Report.', sortOrder:30 },
];
for (const s of unSourcesData) await ins('un_sources', s);
console.log(`  ✓ ${unSourcesData.length} UN sources`);

console.log('\n✅ All reference data seeded successfully!');
await conn.end();
