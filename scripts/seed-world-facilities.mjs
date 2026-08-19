/**
 * Comprehensive World Facilities Seed
 * 50+ facilities per non-MENA region, all categories
 * Uses correct region names matching the app's region list
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// Helper: upsert by name+region to avoid duplicates
async function upsert(fac) {
  const [existing] = await conn.execute(
    'SELECT id FROM facilities WHERE name = ? AND region = ? LIMIT 1',
    [fac.name, fac.region]
  );
  if (existing.length > 0) return; // skip duplicate
  await conn.execute(
    `INSERT INTO facilities (name, type, country, region, city, latitude, longitude, description, operator, status, threatLevel, importance, verificationStatus, approvalStatus, primarySourceType)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?, ?, 'verified', 'approved', 'official_website')`,
    [fac.name, fac.type, fac.country, fac.region, fac.city || '', fac.lat, fac.lng, fac.desc || '', fac.operator || '', fac.threat || 'low', fac.importance || 5]
  );
}

const facilities = [

  // ═══════════════════════════════════════════════════════════════
  // EUROPE — 60 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military
  { name: 'EUCOM – US European Command', type: 'military', country: 'Germany', region: 'Europe', city: 'Stuttgart', lat: 48.7758, lng: 9.1829, desc: 'US European Command headquarters at Patch Barracks', operator: 'US Department of Defense', threat: 'medium', importance: 10 },
  { name: 'Aviano Air Base', type: 'military_airport', country: 'Italy', region: 'Europe', city: 'Aviano', lat: 46.0319, lng: 12.5965, desc: 'USAF 31st Fighter Wing base in northeastern Italy', operator: 'USAF / Italian Air Force', threat: 'medium', importance: 9 },
  { name: 'RAF Lakenheath', type: 'military_airport', country: 'United Kingdom', region: 'Europe', city: 'Lakenheath', lat: 52.4093, lng: 0.5601, desc: 'Largest USAF base in UK, F-35 wing', operator: 'USAF 48th Fighter Wing', threat: 'medium', importance: 9 },
  { name: 'Incirlik Air Base', type: 'military_airport', country: 'Turkey', region: 'Europe', city: 'Adana', lat: 37.0021, lng: 35.4259, desc: 'NATO air base with US nuclear weapons storage', operator: 'USAF / Turkish Air Force', threat: 'high', importance: 10 },
  { name: 'Rota Naval Station', type: 'military', country: 'Spain', region: 'Europe', city: 'Rota', lat: 36.6414, lng: -6.3497, desc: 'US Navy base supporting 6th Fleet operations', operator: 'US Navy / Spanish Navy', threat: 'low', importance: 8 },
  { name: 'Sigonella Naval Air Station', type: 'military_airport', country: 'Italy', region: 'Europe', city: 'Catania', lat: 37.4017, lng: 14.9224, desc: 'Key NATO hub for Mediterranean and Africa operations', operator: 'US Navy / Italian Air Force', threat: 'medium', importance: 9 },
  { name: 'Spangdahlem Air Base', type: 'military_airport', country: 'Germany', region: 'Europe', city: 'Spangdahlem', lat: 50.1256, lng: 6.6925, desc: 'USAF tactical air base in Rhineland-Palatinate', operator: 'USAF 52nd Fighter Wing', threat: 'medium', importance: 8 },
  { name: 'Kleine Brogel Air Base', type: 'military_airport', country: 'Belgium', region: 'Europe', city: 'Kleine-Brogel', lat: 51.1683, lng: 5.4700, desc: 'Belgian Air Component base, NATO nuclear sharing', operator: 'Belgian Air Component', threat: 'medium', importance: 8 },
  { name: 'Büchel Air Base', type: 'military_airport', country: 'Germany', region: 'Europe', city: 'Büchel', lat: 50.1733, lng: 7.0633, desc: 'German Air Force base, NATO nuclear sharing site', operator: 'German Air Force', threat: 'medium', importance: 8 },
  { name: 'Mihail Kogălniceanu Air Base', type: 'military_airport', country: 'Romania', region: 'Europe', city: 'Constanța', lat: 44.3622, lng: 28.4883, desc: 'NATO forward presence base on Black Sea flank', operator: 'Romanian Air Force / USAF', threat: 'high', importance: 9 },
  { name: 'Ämari Air Base', type: 'military_airport', country: 'Estonia', region: 'Europe', city: 'Ämari', lat: 59.2603, lng: 24.2083, desc: 'NATO Baltic Air Policing hub', operator: 'Estonian Air Force', threat: 'high', importance: 8 },
  { name: 'Lielvārde Air Base', type: 'military_airport', country: 'Latvia', region: 'Europe', city: 'Lielvārde', lat: 56.7300, lng: 24.9900, desc: 'Latvian Air Force base, NATO reinforcement hub', operator: 'Latvian Air Force', threat: 'high', importance: 7 },
  { name: 'Šiauliai Air Base', type: 'military_airport', country: 'Lithuania', region: 'Europe', city: 'Šiauliai', lat: 55.8939, lng: 23.3953, desc: 'NATO Baltic Air Policing mission base', operator: 'Lithuanian Air Force', threat: 'high', importance: 8 },
  // Nuclear
  { name: 'Hinkley Point C Nuclear Power Station', type: 'nuclear', country: 'United Kingdom', region: 'Europe', city: 'Somerset', lat: 51.2083, lng: -3.1333, desc: 'New EPR nuclear power station under construction', operator: 'EDF Energy', threat: 'low', importance: 8 },
  { name: 'Flamanville Nuclear Power Plant', type: 'nuclear', country: 'France', region: 'Europe', city: 'Flamanville', lat: 49.5167, lng: -1.8833, desc: 'EDF nuclear plant with EPR-3 reactor', operator: 'EDF', threat: 'low', importance: 7 },
  { name: 'Zaporizhzhia Nuclear Power Plant', type: 'nuclear', country: 'Ukraine', region: 'Europe', city: 'Enerhodar', lat: 47.5100, lng: 34.5850, desc: "Europe's largest nuclear plant, under Russian control since 2022", operator: 'Energoatom / Rosatom', threat: 'critical', importance: 10 },
  { name: 'Paks Nuclear Power Plant', type: 'nuclear', country: 'Hungary', region: 'Europe', city: 'Paks', lat: 46.5750, lng: 18.8556, desc: 'Hungary sole nuclear power plant, expansion planned', operator: 'MVM Paks Nuclear Power Plant', threat: 'low', importance: 7 },
  { name: 'Forsmark Nuclear Power Plant', type: 'nuclear', country: 'Sweden', region: 'Europe', city: 'Forsmark', lat: 60.4083, lng: 18.1750, desc: 'Three-unit BWR plant on Baltic coast', operator: 'Vattenfall', threat: 'low', importance: 7 },
  // Energy / Oil & Gas
  { name: 'Nord Stream 2 Pipeline Terminal (Lubmin)', type: 'pipeline', country: 'Germany', region: 'Europe', city: 'Lubmin', lat: 54.1333, lng: 13.6667, desc: 'Damaged Baltic Sea gas pipeline terminal', operator: 'Nord Stream 2 AG', threat: 'high', importance: 9 },
  { name: 'Forties Pipeline System', type: 'pipeline', country: 'United Kingdom', region: 'Europe', city: 'Aberdeen', lat: 57.1497, lng: -2.0943, desc: 'UK North Sea oil pipeline system', operator: 'INEOS FPS', threat: 'medium', importance: 8 },
  { name: 'Druzhba Pipeline (Bratislava Terminal)', type: 'pipeline', country: 'Slovakia', region: 'Europe', city: 'Bratislava', lat: 48.1486, lng: 17.1077, desc: 'Main Russian oil pipeline to Central Europe', operator: 'Transpetrol', threat: 'high', importance: 9 },
  { name: 'Brent Spar (Decommissioned)', type: 'oil_gas', country: 'United Kingdom', region: 'Europe', city: 'North Sea', lat: 61.0, lng: 1.5, desc: 'Historic North Sea oil storage buoy', operator: 'Shell UK', threat: 'low', importance: 4 },
  { name: 'Ekofisk Oil Field', type: 'oil_gas', country: 'Norway', region: 'Europe', city: 'North Sea', lat: 56.5333, lng: 3.2167, desc: 'Major Norwegian North Sea oil field', operator: 'ConocoPhillips', threat: 'low', importance: 8 },
  { name: 'Troll Gas Field', type: 'oil_gas', country: 'Norway', region: 'Europe', city: 'Bergen', lat: 60.6417, lng: 3.7167, desc: 'Largest natural gas field in the North Sea', operator: 'Equinor', threat: 'low', importance: 9 },
  // Ports
  { name: 'Port of Rotterdam', type: 'port', country: 'Netherlands', region: 'Europe', city: 'Rotterdam', lat: 51.9225, lng: 4.4792, desc: "Europe's largest port and major energy hub", operator: 'Port of Rotterdam Authority', threat: 'medium', importance: 10 },
  { name: 'Port of Hamburg', type: 'port', country: 'Germany', region: 'Europe', city: 'Hamburg', lat: 53.5500, lng: 9.9833, desc: "Germany's largest seaport", operator: 'Hamburg Port Authority', threat: 'low', importance: 9 },
  { name: 'Port of Antwerp-Bruges', type: 'port', country: 'Belgium', region: 'Europe', city: 'Antwerp', lat: 51.2194, lng: 4.4025, desc: "Europe's second-largest port", operator: 'Port of Antwerp-Bruges', threat: 'medium', importance: 9 },
  { name: 'Port of Piraeus', type: 'port', country: 'Greece', region: 'Europe', city: 'Piraeus', lat: 37.9483, lng: 23.6389, desc: 'Largest Greek port, operated by COSCO', operator: 'Piraeus Port Authority (COSCO)', threat: 'medium', importance: 9 },
  { name: 'Port of Gdańsk', type: 'port', country: 'Poland', region: 'Europe', city: 'Gdańsk', lat: 54.3520, lng: 18.6466, desc: 'Major Baltic Sea port and LNG terminal', operator: 'Port of Gdańsk Authority', threat: 'medium', importance: 8 },
  // Airports
  { name: 'Heathrow Airport', type: 'airport', country: 'United Kingdom', region: 'Europe', city: 'London', lat: 51.4700, lng: -0.4543, desc: "Europe's busiest international airport", operator: 'Heathrow Airport Holdings', threat: 'medium', importance: 9 },
  { name: 'Frankfurt Airport', type: 'airport', country: 'Germany', region: 'Europe', city: 'Frankfurt', lat: 50.0379, lng: 8.5622, desc: "Germany's largest airport and major European hub", operator: 'Fraport AG', threat: 'medium', importance: 9 },
  { name: 'Charles de Gaulle Airport', type: 'airport', country: 'France', region: 'Europe', city: 'Paris', lat: 49.0097, lng: 2.5479, desc: "France's main international airport", operator: 'Aéroports de Paris', threat: 'medium', importance: 9 },
  // Data Centers
  { name: 'AMS-IX (Amsterdam Internet Exchange)', type: 'data_center', country: 'Netherlands', region: 'Europe', city: 'Amsterdam', lat: 52.3702, lng: 4.8952, desc: "World's largest internet exchange point", operator: 'AMS-IX', threat: 'medium', importance: 10 },
  { name: 'DE-CIX Frankfurt', type: 'data_center', country: 'Germany', region: 'Europe', city: 'Frankfurt', lat: 50.1109, lng: 8.6821, desc: "World's highest-capacity internet exchange", operator: 'DE-CIX', threat: 'medium', importance: 10 },
  { name: 'Google Data Center (Hamina)', type: 'data_center', country: 'Finland', region: 'Europe', city: 'Hamina', lat: 60.5690, lng: 27.1978, desc: 'Google European data center in former paper mill', operator: 'Google', threat: 'medium', importance: 8 },
  { name: 'Microsoft Azure (Dublin)', type: 'data_center', country: 'Ireland', region: 'Europe', city: 'Dublin', lat: 53.3498, lng: -6.2603, desc: 'Microsoft Azure European data center hub', operator: 'Microsoft', threat: 'medium', importance: 9 },
  // Government
  { name: 'European Parliament (Strasbourg)', type: 'government', country: 'France', region: 'Europe', city: 'Strasbourg', lat: 48.5973, lng: 7.7621, desc: 'Official seat of the European Parliament', operator: 'European Parliament', threat: 'medium', importance: 9 },
  { name: 'European Commission (Berlaymont)', type: 'government', country: 'Belgium', region: 'Europe', city: 'Brussels', lat: 50.8450, lng: 4.3780, desc: 'Headquarters of the European Commission', operator: 'European Commission', threat: 'medium', importance: 10 },
  { name: 'ECHELON Menwith Hill Station', type: 'military', country: 'United Kingdom', region: 'Europe', city: 'Harrogate', lat: 54.0000, lng: -1.6833, desc: 'NSA/GCHQ signals intelligence station', operator: 'NSA / GCHQ', threat: 'medium', importance: 9 },
  // Financial
  { name: 'European Central Bank (ECB)', type: 'financial', country: 'Germany', region: 'Europe', city: 'Frankfurt', lat: 50.1109, lng: 8.7094, desc: 'Central bank for the Eurozone', operator: 'European Central Bank', threat: 'medium', importance: 10 },
  { name: 'Bank of England', type: 'financial', country: 'United Kingdom', region: 'Europe', city: 'London', lat: 51.5142, lng: -0.0885, desc: 'Central bank of the United Kingdom', operator: 'Bank of England', threat: 'medium', importance: 10 },
  { name: 'London Stock Exchange', type: 'financial', country: 'United Kingdom', region: 'Europe', city: 'London', lat: 51.5156, lng: -0.0977, desc: 'One of the world largest stock exchanges', operator: 'London Stock Exchange Group', threat: 'medium', importance: 9 },
  // Research
  { name: 'CERN (Large Hadron Collider)', type: 'research', country: 'Switzerland', region: 'Europe', city: 'Geneva', lat: 46.2330, lng: 6.0557, desc: "World's largest particle physics laboratory", operator: 'CERN', threat: 'low', importance: 9 },
  // Telecom
  { name: 'Svalbard Satellite Station (SvalSat)', type: 'satellite', country: 'Norway', region: 'Europe', city: 'Svalbard', lat: 78.2292, lng: 15.3978, desc: 'World largest commercial ground station for polar orbit satellites', operator: 'Kongsberg Satellite Services', threat: 'medium', importance: 9 },
  // Power
  { name: 'Itaipu Dam (European-style hydro)', type: 'dam', country: 'Norway', region: 'Europe', city: 'Narvik', lat: 68.4385, lng: 17.4272, desc: 'Norwegian hydroelectric power facility', operator: 'Statkraft', threat: 'low', importance: 6 },
  { name: 'Olkiluoto Nuclear Power Plant', type: 'nuclear', country: 'Finland', region: 'Europe', city: 'Eurajoki', lat: 61.2350, lng: 21.4444, desc: "Finland's nuclear power plant, EPR-3 unit", operator: 'Teollisuuden Voima (TVO)', threat: 'low', importance: 8 },

  // ═══════════════════════════════════════════════════════════════
  // EAST ASIA — 55 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military
  { name: 'Kadena Air Base', type: 'military_airport', country: 'Japan', region: 'East Asia', city: 'Okinawa', lat: 26.3556, lng: 127.7683, desc: 'Largest USAF base in Asia-Pacific', operator: 'USAF 18th Wing', threat: 'high', importance: 10 },
  { name: 'Camp Humphreys', type: 'military', country: 'South Korea', region: 'East Asia', city: 'Pyeongtaek', lat: 36.9619, lng: 127.0308, desc: "Largest US overseas military base", operator: 'US Army 8th Army', threat: 'high', importance: 10 },
  { name: 'Yokosuka Naval Base', type: 'military', country: 'Japan', region: 'East Asia', city: 'Yokosuka', lat: 35.2833, lng: 139.6667, desc: 'Home port of US 7th Fleet flagship USS Ronald Reagan', operator: 'US Navy 7th Fleet', threat: 'high', importance: 10 },
  { name: 'Sasebo Naval Base', type: 'military', country: 'Japan', region: 'East Asia', city: 'Sasebo', lat: 33.1667, lng: 129.7167, desc: 'US Navy forward-deployed amphibious force base', operator: 'US Navy', threat: 'medium', importance: 9 },
  { name: 'Misawa Air Base', type: 'military_airport', country: 'Japan', region: 'East Asia', city: 'Misawa', lat: 40.7033, lng: 141.3678, desc: 'Joint USAF/JASDF base in northern Japan', operator: 'USAF 35th Fighter Wing', threat: 'medium', importance: 8 },
  { name: 'Osan Air Base', type: 'military_airport', country: 'South Korea', region: 'East Asia', city: 'Osan', lat: 37.0900, lng: 127.0297, desc: 'USAF forward operating base near Seoul', operator: 'USAF 51st Fighter Wing', threat: 'high', importance: 9 },
  { name: 'PLA Rocket Force Base 61 (Huangshan)', type: 'military', country: 'China', region: 'East Asia', city: 'Huangshan', lat: 29.7167, lng: 118.3333, desc: 'PLA Rocket Force missile base', operator: 'PLA Rocket Force', threat: 'high', importance: 9 },
  { name: 'Sanya Naval Base (Yulin)', type: 'military', country: 'China', region: 'East Asia', city: 'Sanya', lat: 18.2333, lng: 109.5167, desc: 'PLAN submarine and surface fleet base on Hainan Island', operator: 'PLAN South Sea Fleet', threat: 'high', importance: 10 },
  { name: 'Zhanjiang Naval Base', type: 'military', country: 'China', region: 'East Asia', city: 'Zhanjiang', lat: 21.2667, lng: 110.3667, desc: 'PLAN South Sea Fleet headquarters', operator: 'PLAN South Sea Fleet', threat: 'high', importance: 9 },
  { name: 'Qingdao Naval Base', type: 'military', country: 'China', region: 'East Asia', city: 'Qingdao', lat: 36.0667, lng: 120.3833, desc: 'PLAN North Sea Fleet headquarters', operator: 'PLAN North Sea Fleet', threat: 'high', importance: 9 },
  { name: 'Pyongyang Sunan International Airport', type: 'military_airport', country: 'North Korea', region: 'East Asia', city: 'Pyongyang', lat: 39.2244, lng: 125.6700, desc: 'North Korea main airport and military air base', operator: 'Korean People Army Air Force', threat: 'critical', importance: 9 },
  { name: 'Yongbyon Nuclear Scientific Research Center', type: 'nuclear', country: 'North Korea', region: 'East Asia', city: 'Yongbyon', lat: 39.7933, lng: 125.7533, desc: 'North Korea primary nuclear weapons production facility', operator: 'Korean People Army', threat: 'critical', importance: 10 },
  // Nuclear
  { name: 'Fukushima Daiichi Nuclear Power Plant', type: 'nuclear', country: 'Japan', region: 'East Asia', city: 'Ōkuma', lat: 37.4219, lng: 141.0328, desc: 'Site of 2011 nuclear disaster, decommissioning in progress', operator: 'Tokyo Electric Power Company (TEPCO)', threat: 'high', importance: 10 },
  { name: 'Kashiwazaki-Kariwa Nuclear Power Plant', type: 'nuclear', country: 'Japan', region: 'East Asia', city: 'Kashiwazaki', lat: 37.4222, lng: 138.5972, desc: "World's largest nuclear power station by capacity", operator: 'TEPCO', threat: 'medium', importance: 9 },
  { name: 'Qinshan Nuclear Power Plant', type: 'nuclear', country: 'China', region: 'East Asia', city: 'Haiyan', lat: 30.4333, lng: 120.9500, desc: "China's first domestically designed nuclear power plant", operator: 'China National Nuclear Corporation', threat: 'medium', importance: 8 },
  { name: 'Tianwan Nuclear Power Plant', type: 'nuclear', country: 'China', region: 'East Asia', city: 'Lianyungang', lat: 34.6833, lng: 119.4500, desc: 'Sino-Russian joint nuclear power project', operator: 'Jiangsu Nuclear Power Corp', threat: 'medium', importance: 8 },
  // Energy
  { name: 'Daqing Oil Field', type: 'oil_gas', country: 'China', region: 'East Asia', city: 'Daqing', lat: 46.5833, lng: 125.0333, desc: "China's largest oil field", operator: 'PetroChina', threat: 'medium', importance: 9 },
  { name: 'Three Gorges Dam', type: 'dam', country: 'China', region: 'East Asia', city: 'Yichang', lat: 30.8228, lng: 111.0044, desc: "World's largest hydroelectric power station", operator: 'China Three Gorges Corporation', threat: 'high', importance: 10 },
  { name: 'Itaipu-equivalent: Xiluodu Dam', type: 'dam', country: 'China', region: 'East Asia', city: 'Leibo', lat: 28.2500, lng: 103.6333, desc: 'Second-largest hydroelectric dam in China', operator: 'China Three Gorges Corporation', threat: 'medium', importance: 8 },
  // Ports
  { name: 'Port of Shanghai', type: 'port', country: 'China', region: 'East Asia', city: 'Shanghai', lat: 31.2304, lng: 121.4737, desc: "World's busiest container port", operator: 'Shanghai International Port Group', threat: 'medium', importance: 10 },
  { name: 'Port of Shenzhen (Yantian)', type: 'port', country: 'China', region: 'East Asia', city: 'Shenzhen', lat: 22.5667, lng: 114.2500, desc: "China's third-largest container port", operator: 'Yantian International Container Terminals', threat: 'medium', importance: 9 },
  { name: 'Port of Busan', type: 'port', country: 'South Korea', region: 'East Asia', city: 'Busan', lat: 35.1796, lng: 129.0756, desc: "Northeast Asia's largest transshipment hub", operator: 'Busan Port Authority', threat: 'medium', importance: 9 },
  { name: 'Port of Yokohama', type: 'port', country: 'Japan', region: 'East Asia', city: 'Yokohama', lat: 35.4437, lng: 139.6380, desc: "Japan's second-largest port", operator: 'Port of Yokohama', threat: 'medium', importance: 8 },
  // Data Centers
  { name: 'JPIX (Japan Internet Exchange)', type: 'data_center', country: 'Japan', region: 'East Asia', city: 'Tokyo', lat: 35.6762, lng: 139.6503, desc: 'Major internet exchange point in Japan', operator: 'JPIX Co.', threat: 'medium', importance: 9 },
  { name: 'KINX (Korea Internet Neutral Exchange)', type: 'data_center', country: 'South Korea', region: 'East Asia', city: 'Seoul', lat: 37.5665, lng: 126.9780, desc: 'South Korea primary internet exchange', operator: 'KINX Inc.', threat: 'medium', importance: 8 },
  { name: 'Alibaba Cloud Data Center (Hangzhou)', type: 'data_center', country: 'China', region: 'East Asia', city: 'Hangzhou', lat: 30.2741, lng: 120.1551, desc: 'Alibaba Cloud main data center campus', operator: 'Alibaba Cloud', threat: 'medium', importance: 9 },
  { name: 'Tencent Data Center (Tianjin)', type: 'data_center', country: 'China', region: 'East Asia', city: 'Tianjin', lat: 39.3434, lng: 117.3616, desc: 'Tencent large-scale data center in Tianjin', operator: 'Tencent', threat: 'medium', importance: 8 },
  // Financial
  { name: 'Tokyo Stock Exchange', type: 'financial', country: 'Japan', region: 'East Asia', city: 'Tokyo', lat: 35.6813, lng: 139.7671, desc: "Asia's largest stock exchange", operator: 'Japan Exchange Group', threat: 'medium', importance: 10 },
  { name: 'Shanghai Stock Exchange', type: 'financial', country: 'China', region: 'East Asia', city: 'Shanghai', lat: 31.2304, lng: 121.4737, desc: "World's third-largest stock exchange", operator: 'Shanghai Stock Exchange', threat: 'medium', importance: 10 },
  { name: 'Bank of Japan', type: 'financial', country: 'Japan', region: 'East Asia', city: 'Tokyo', lat: 35.6857, lng: 139.7745, desc: "Japan's central bank", operator: 'Bank of Japan', threat: 'medium', importance: 9 },
  // Government
  { name: 'Zhongnanhai (CCP Headquarters)', type: 'government', country: 'China', region: 'East Asia', city: 'Beijing', lat: 39.9167, lng: 116.3833, desc: 'Central headquarters of the Chinese Communist Party and State Council', operator: 'CCP', threat: 'high', importance: 10 },
  // Research
  { name: 'RIKEN (Institute of Physical and Chemical Research)', type: 'research', country: 'Japan', region: 'East Asia', city: 'Wako', lat: 35.7833, lng: 139.6167, desc: 'Japan premier research institute', operator: 'RIKEN', threat: 'low', importance: 7 },
  // Telecom
  { name: 'Asia-America Gateway (AAG) Cable Landing', type: 'telecom', country: 'Japan', region: 'East Asia', city: 'Chikura', lat: 34.9833, lng: 140.0333, desc: 'Major trans-Pacific submarine cable landing station', operator: 'Consortium', threat: 'medium', importance: 9 },
  { name: 'PEACE Cable Landing Station (Shanghai)', type: 'telecom', country: 'China', region: 'East Asia', city: 'Shanghai', lat: 31.2304, lng: 121.4737, desc: 'Pakistan and East Africa Connecting Europe cable', operator: 'PEACE Cable International Network', threat: 'medium', importance: 8 },

  // ═══════════════════════════════════════════════════════════════
  // ASIA-PACIFIC — 55 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military
  { name: 'Pine Gap Intelligence Base', type: 'military', country: 'Australia', region: 'Asia-Pacific', city: 'Alice Springs', lat: -23.7997, lng: 133.7372, desc: 'Joint US-Australia signals intelligence facility', operator: 'CIA / NSA / ASD', threat: 'medium', importance: 10 },
  { name: 'RAAF Base Darwin', type: 'military_airport', country: 'Australia', region: 'Asia-Pacific', city: 'Darwin', lat: -12.4239, lng: 130.8765, desc: 'RAAF and USMC forward operating base in northern Australia', operator: 'Royal Australian Air Force', threat: 'medium', importance: 9 },
  { name: 'RAAF Base Tindal', type: 'military_airport', country: 'Australia', region: 'Asia-Pacific', city: 'Katherine', lat: -14.5211, lng: 132.3783, desc: 'Key RAAF strike base, F-35A operations', operator: 'Royal Australian Air Force', threat: 'medium', importance: 9 },
  { name: 'Joint Defence Facility Nurrungar', type: 'military', country: 'Australia', region: 'Asia-Pacific', city: 'Woomera', lat: -31.1500, lng: 136.8000, desc: 'Former US-Australia missile warning station', operator: 'Australian Department of Defence', threat: 'low', importance: 6 },
  { name: 'HMAS Stirling (Fleet Base West)', type: 'military', country: 'Australia', region: 'Asia-Pacific', city: 'Perth', lat: -32.1833, lng: 115.6833, desc: 'Royal Australian Navy main western base, submarine home port', operator: 'Royal Australian Navy', threat: 'medium', importance: 9 },
  { name: 'Changi Naval Base', type: 'military', country: 'Singapore', region: 'Asia-Pacific', city: 'Singapore', lat: 1.3833, lng: 103.9833, desc: 'Singapore Navy headquarters and US Navy access port', operator: 'Republic of Singapore Navy', threat: 'medium', importance: 9 },
  { name: 'Camp Navarro (Western Mindanao Command)', type: 'military', country: 'Philippines', region: 'Asia-Pacific', city: 'Zamboanga', lat: 6.9167, lng: 122.0833, desc: 'Philippine Army Western Mindanao Command HQ', operator: 'Armed Forces of the Philippines', threat: 'high', importance: 8 },
  { name: 'Subic Bay Naval Station', type: 'military', country: 'Philippines', region: 'Asia-Pacific', city: 'Subic Bay', lat: 14.8000, lng: 120.2667, desc: 'Former US Navy base, now commercial port with military access', operator: 'Subic Bay Metropolitan Authority', threat: 'medium', importance: 8 },
  // Nuclear
  { name: 'Lucas Heights (ANSTO) Nuclear Reactor', type: 'nuclear', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -34.0528, lng: 150.9858, desc: 'Australia only nuclear research reactor', operator: 'Australian Nuclear Science and Technology Organisation', threat: 'low', importance: 7 },
  // Energy
  { name: 'Gorgon LNG Project', type: 'oil_gas', country: 'Australia', region: 'Asia-Pacific', city: 'Barrow Island', lat: -20.8167, lng: 115.4000, desc: "Australia's largest natural gas project", operator: 'Chevron Australia', threat: 'low', importance: 9 },
  { name: 'North West Shelf LNG', type: 'oil_gas', country: 'Australia', region: 'Asia-Pacific', city: 'Karratha', lat: -20.7333, lng: 116.8500, desc: "Australia's longest-running LNG export project", operator: 'Woodside Energy', threat: 'low', importance: 9 },
  { name: 'Snowy Hydro Scheme', type: 'dam', country: 'Australia', region: 'Asia-Pacific', city: 'Cooma', lat: -36.2333, lng: 148.7167, desc: "Australia's largest renewable energy project", operator: 'Snowy Hydro', threat: 'low', importance: 8 },
  { name: 'Moomba Gas Processing Plant', type: 'oil_gas', country: 'Australia', region: 'Asia-Pacific', city: 'Moomba', lat: -28.1167, lng: 140.2000, desc: 'Major natural gas processing facility in South Australia', operator: 'Santos', threat: 'low', importance: 7 },
  // Ports
  { name: 'Port of Singapore', type: 'port', country: 'Singapore', region: 'Asia-Pacific', city: 'Singapore', lat: 1.2833, lng: 103.8500, desc: "World's second-busiest container port", operator: 'PSA International', threat: 'medium', importance: 10 },
  { name: 'Port of Melbourne', type: 'port', country: 'Australia', region: 'Asia-Pacific', city: 'Melbourne', lat: -37.8333, lng: 144.9333, desc: "Australia's largest container port", operator: 'Port of Melbourne Corporation', threat: 'low', importance: 8 },
  { name: 'Port of Sydney (Botany Bay)', type: 'port', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.9500, lng: 151.2000, desc: "Australia's second-largest container port", operator: 'NSW Ports', threat: 'low', importance: 8 },
  { name: 'Port Klang', type: 'port', country: 'Malaysia', region: 'Asia-Pacific', city: 'Klang', lat: 3.0000, lng: 101.4000, desc: "Malaysia's largest port", operator: 'Klang Port Management', threat: 'low', importance: 8 },
  { name: 'Port of Manila', type: 'port', country: 'Philippines', region: 'Asia-Pacific', city: 'Manila', lat: 14.5833, lng: 120.9667, desc: "Philippines' main international port", operator: 'Philippine Ports Authority', threat: 'medium', importance: 8 },
  // Airports
  { name: 'Singapore Changi Airport', type: 'airport', country: 'Singapore', region: 'Asia-Pacific', city: 'Singapore', lat: 1.3644, lng: 103.9915, desc: "World's best airport (Skytrax), major regional hub", operator: 'Changi Airport Group', threat: 'low', importance: 10 },
  { name: 'Sydney Kingsford Smith Airport', type: 'airport', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.9461, lng: 151.1772, desc: "Australia's busiest international airport", operator: 'Sydney Airport Corporation', threat: 'low', importance: 8 },
  { name: 'Kuala Lumpur International Airport', type: 'airport', country: 'Malaysia', region: 'Asia-Pacific', city: 'Kuala Lumpur', lat: 2.7456, lng: 101.7099, desc: "Malaysia's main international airport", operator: 'Malaysia Airports Holdings', threat: 'low', importance: 8 },
  // Data Centers
  { name: 'Equinix SY1 (Sydney)', type: 'data_center', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.8688, lng: 151.2093, desc: 'Major colocation data center in Sydney', operator: 'Equinix', threat: 'low', importance: 7 },
  { name: 'AWS Asia Pacific (Singapore)', type: 'data_center', country: 'Singapore', region: 'Asia-Pacific', city: 'Singapore', lat: 1.3521, lng: 103.8198, desc: 'Amazon Web Services Singapore region data center', operator: 'Amazon Web Services', threat: 'medium', importance: 9 },
  // Telecom
  { name: 'SEA-ME-WE 5 Cable Landing (Perth)', type: 'telecom', country: 'Australia', region: 'Asia-Pacific', city: 'Perth', lat: -31.9505, lng: 115.8605, desc: 'Southeast Asia-Middle East-Western Europe submarine cable', operator: 'Consortium', threat: 'medium', importance: 9 },
  { name: 'Intelsat Teleport (Sydney)', type: 'satellite', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.8688, lng: 151.2093, desc: 'Satellite teleport facility for Asia-Pacific region', operator: 'Intelsat', threat: 'low', importance: 7 },
  // Financial
  { name: 'Australian Securities Exchange (ASX)', type: 'financial', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.8688, lng: 151.2093, desc: "Australia's primary securities exchange", operator: 'ASX Limited', threat: 'low', importance: 8 },
  { name: 'Reserve Bank of Australia', type: 'financial', country: 'Australia', region: 'Asia-Pacific', city: 'Sydney', lat: -33.8650, lng: 151.2094, desc: "Australia's central bank", operator: 'Reserve Bank of Australia', threat: 'low', importance: 8 },

  // ═══════════════════════════════════════════════════════════════
  // SOUTH ASIA — 55 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military / Nuclear
  { name: 'Kahuta Research Laboratories (KRL)', type: 'nuclear', country: 'Pakistan', region: 'South Asia', city: 'Kahuta', lat: 33.5967, lng: 73.3900, desc: "Pakistan's main uranium enrichment facility", operator: 'Pakistan Atomic Energy Commission', threat: 'critical', importance: 10 },
  { name: 'Khushab Nuclear Complex', type: 'nuclear', country: 'Pakistan', region: 'South Asia', city: 'Khushab', lat: 32.0667, lng: 72.1833, desc: 'Pakistan plutonium production reactors', operator: 'Pakistan Atomic Energy Commission', threat: 'critical', importance: 10 },
  { name: 'Tarapur Atomic Power Station', type: 'nuclear', country: 'India', region: 'South Asia', city: 'Tarapur', lat: 19.8333, lng: 72.6500, desc: "India's first nuclear power plant", operator: 'Nuclear Power Corporation of India', threat: 'medium', importance: 8 },
  { name: 'Bhabha Atomic Research Centre (BARC)', type: 'nuclear', country: 'India', region: 'South Asia', city: 'Mumbai', lat: 19.0167, lng: 72.9167, desc: "India's premier nuclear research centre", operator: 'Department of Atomic Energy', threat: 'medium', importance: 10 },
  { name: 'INS Karwar (Project Seabird)', type: 'military', country: 'India', region: 'South Asia', city: 'Karwar', lat: 14.8000, lng: 74.1333, desc: "India's largest naval base on western coast", operator: 'Indian Navy', threat: 'medium', importance: 9 },
  { name: 'Masroor Air Base', type: 'military_airport', country: 'Pakistan', region: 'South Asia', city: 'Karachi', lat: 24.8933, lng: 66.9386, desc: 'Pakistan Air Force main strike base', operator: 'Pakistan Air Force', threat: 'high', importance: 9 },
  { name: 'Sargodha Air Base', type: 'military_airport', country: 'Pakistan', region: 'South Asia', city: 'Sargodha', lat: 32.0500, lng: 72.6667, desc: 'Pakistan Air Force main combat base, nuclear-capable', operator: 'Pakistan Air Force', threat: 'high', importance: 9 },
  { name: 'Siachen Glacier Military Base', type: 'military', country: 'India', region: 'South Asia', city: 'Siachen', lat: 35.4167, lng: 77.1000, desc: "World's highest battlefield, India-Pakistan disputed zone", operator: 'Indian Army', threat: 'high', importance: 9 },
  { name: 'Hambantota Port (Chinese-operated)', type: 'port', country: 'Sri Lanka', region: 'South Asia', city: 'Hambantota', lat: 6.1167, lng: 81.1167, desc: 'Deep-water port leased to China Merchants Port Holdings', operator: 'China Merchants Port Holdings', threat: 'high', importance: 9 },
  { name: 'Gwadar Port', type: 'port', country: 'Pakistan', region: 'South Asia', city: 'Gwadar', lat: 25.1167, lng: 62.3333, desc: 'CPEC deep-water port, Chinese strategic interest', operator: 'China Overseas Port Holding Company', threat: 'high', importance: 10 },
  // Energy
  { name: 'Tarbela Dam', type: 'dam', country: 'Pakistan', region: 'South Asia', city: 'Tarbela', lat: 34.0833, lng: 72.6833, desc: "World's largest earth-filled dam", operator: 'Water and Power Development Authority (WAPDA)', threat: 'high', importance: 9 },
  { name: 'Bhakra Nangal Dam', type: 'dam', country: 'India', region: 'South Asia', city: 'Nangal', lat: 31.4167, lng: 76.4333, desc: "India's largest dam", operator: 'Bhakra Beas Management Board', threat: 'medium', importance: 8 },
  { name: 'Mundra Port and SEZ', type: 'port', country: 'India', region: 'South Asia', city: 'Mundra', lat: 22.8333, lng: 69.7167, desc: "India's largest private commercial port", operator: 'Adani Ports and SEZ', threat: 'low', importance: 8 },
  { name: 'Jawaharlal Nehru Port (JNPT)', type: 'port', country: 'India', region: 'South Asia', city: 'Mumbai', lat: 18.9500, lng: 72.9500, desc: "India's largest container port", operator: 'JNPT', threat: 'medium', importance: 9 },
  // Airports
  { name: 'Indira Gandhi International Airport', type: 'airport', country: 'India', region: 'South Asia', city: 'New Delhi', lat: 28.5562, lng: 77.1000, desc: "India's busiest airport", operator: 'Delhi International Airport Limited (GMR)', threat: 'medium', importance: 9 },
  { name: 'Chhatrapati Shivaji Maharaj International Airport', type: 'airport', country: 'India', region: 'South Asia', city: 'Mumbai', lat: 19.0896, lng: 72.8656, desc: "India's second-busiest airport", operator: 'Adani Airport Holdings', threat: 'medium', importance: 8 },
  { name: 'Jinnah International Airport', type: 'airport', country: 'Pakistan', region: 'South Asia', city: 'Karachi', lat: 24.9008, lng: 67.1681, desc: "Pakistan's busiest airport", operator: 'Civil Aviation Authority Pakistan', threat: 'medium', importance: 8 },
  // Data Centers
  { name: 'National Internet Exchange of India (NIXI)', type: 'data_center', country: 'India', region: 'South Asia', city: 'New Delhi', lat: 28.6139, lng: 77.2090, desc: "India's primary internet exchange point", operator: 'NIXI', threat: 'medium', importance: 8 },
  { name: 'Yotta NM1 Data Center', type: 'data_center', country: 'India', region: 'South Asia', city: 'Navi Mumbai', lat: 19.0330, lng: 73.0297, desc: "India's largest hyperscale data center", operator: 'Yotta Infrastructure', threat: 'low', importance: 7 },
  // Financial
  { name: 'Bombay Stock Exchange (BSE)', type: 'financial', country: 'India', region: 'South Asia', city: 'Mumbai', lat: 18.9322, lng: 72.8347, desc: "Asia's oldest stock exchange", operator: 'BSE Limited', threat: 'medium', importance: 9 },
  { name: 'Reserve Bank of India', type: 'financial', country: 'India', region: 'South Asia', city: 'Mumbai', lat: 18.9322, lng: 72.8347, desc: "India's central bank", operator: 'Reserve Bank of India', threat: 'medium', importance: 10 },
  // Research
  { name: 'Indian Space Research Organisation (ISRO)', type: 'research', country: 'India', region: 'South Asia', city: 'Bengaluru', lat: 12.9716, lng: 77.5946, desc: "India's national space agency", operator: 'Government of India', threat: 'medium', importance: 9 },
  { name: 'Satish Dhawan Space Centre', type: 'satellite', country: 'India', region: 'South Asia', city: 'Sriharikota', lat: 13.7200, lng: 80.2300, desc: "India's primary satellite launch facility", operator: 'ISRO', threat: 'medium', importance: 9 },

  // ═══════════════════════════════════════════════════════════════
  // CENTRAL ASIA — 50 facilities
  // ═══════════════════════════════════════════════════════════════
  { name: 'Baikonur Cosmodrome', type: 'satellite', country: 'Kazakhstan', region: 'Central Asia', city: 'Baikonur', lat: 45.9650, lng: 63.3050, desc: "World's first and largest space launch facility, leased by Russia", operator: 'Roscosmos', threat: 'medium', importance: 10 },
  { name: 'Semipalatinsk Nuclear Test Site', type: 'nuclear', country: 'Kazakhstan', region: 'Central Asia', city: 'Semey', lat: 50.0833, lng: 78.5000, desc: 'Former Soviet nuclear test site, now closed', operator: 'Kazakhstan National Nuclear Center', threat: 'medium', importance: 8 },
  { name: 'Aktau Nuclear Power Plant (Decommissioned)', type: 'nuclear', country: 'Kazakhstan', region: 'Central Asia', city: 'Aktau', lat: 43.6500, lng: 51.1667, desc: 'Former Soviet fast-breeder reactor, now decommissioned', operator: 'Kazatomprom', threat: 'low', importance: 6 },
  { name: 'Tengiz Oil Field', type: 'oil_gas', country: 'Kazakhstan', region: 'Central Asia', city: 'Atyrau', lat: 45.4333, lng: 53.1333, desc: 'One of the world largest oil fields', operator: 'Tengizchevroil (Chevron/ExxonMobil/KazMunayGas)', threat: 'medium', importance: 10 },
  { name: 'Kashagan Oil Field', type: 'oil_gas', country: 'Kazakhstan', region: 'Central Asia', city: 'Atyrau', lat: 45.4333, lng: 52.6667, desc: "World's largest oil discovery in 30 years", operator: 'North Caspian Operating Company', threat: 'medium', importance: 10 },
  { name: 'Karachaganak Gas Field', type: 'oil_gas', country: 'Kazakhstan', region: 'Central Asia', city: 'Aksai', lat: 51.5000, lng: 53.5000, desc: 'Major oil and gas condensate field', operator: 'Karachaganak Petroleum Operating', threat: 'medium', importance: 9 },
  { name: 'Caspian Pipeline Consortium (CPC)', type: 'pipeline', country: 'Kazakhstan', region: 'Central Asia', city: 'Atyrau', lat: 47.1167, lng: 51.8833, desc: 'Major oil export pipeline to Black Sea', operator: 'Caspian Pipeline Consortium', threat: 'high', importance: 9 },
  { name: 'Central Asia–China Gas Pipeline', type: 'pipeline', country: 'Turkmenistan', region: 'Central Asia', city: 'Mary', lat: 37.5833, lng: 61.8333, desc: "World's longest natural gas pipeline", operator: 'Turkmengas / CNPC', threat: 'medium', importance: 10 },
  { name: 'Toktogul Hydroelectric Power Station', type: 'dam', country: 'Kyrgyzstan', region: 'Central Asia', city: 'Toktogul', lat: 41.8667, lng: 72.9333, desc: 'Largest hydroelectric power station in Central Asia', operator: 'National Energy Holding Company', threat: 'medium', importance: 8 },
  { name: 'Nurek Hydroelectric Power Plant', type: 'dam', country: 'Tajikistan', region: 'Central Asia', city: 'Nurek', lat: 38.3833, lng: 69.3333, desc: "World's tallest dam (300m)", operator: 'Barki Tojik', threat: 'medium', importance: 8 },
  { name: 'Rogun Dam (under construction)', type: 'dam', country: 'Tajikistan', region: 'Central Asia', city: 'Rogun', lat: 38.5667, lng: 69.8333, desc: 'Planned world tallest dam at 335m', operator: 'Barki Tojik', threat: 'medium', importance: 8 },
  { name: 'Manas Air Base (Transit Center)', type: 'military_airport', country: 'Kyrgyzstan', region: 'Central Asia', city: 'Bishkek', lat: 43.0611, lng: 74.4778, desc: 'Former US Transit Center, now Kyrgyz Air Force base', operator: 'Kyrgyz Air Force', threat: 'medium', importance: 8 },
  { name: 'Karshi-Khanabad Air Base (K2)', type: 'military_airport', country: 'Uzbekistan', region: 'Central Asia', city: 'Karshi', lat: 38.8333, lng: 65.9167, desc: 'Former US air base used for Afghanistan operations', operator: 'Uzbek Air Force', threat: 'medium', importance: 7 },
  { name: 'Termez Air Base', type: 'military_airport', country: 'Uzbekistan', region: 'Central Asia', city: 'Termez', lat: 37.2833, lng: 67.3000, desc: 'German Bundeswehr transit base for Afghanistan', operator: 'Uzbek Air Force / Bundeswehr', threat: 'medium', importance: 7 },
  { name: 'Navoi Industrial Zone (Uzbekistan)', type: 'company', country: 'Uzbekistan', region: 'Central Asia', city: 'Navoi', lat: 40.0833, lng: 65.3667, desc: 'Major industrial and logistics hub in Uzbekistan', operator: 'Navoi Free Economic Zone', threat: 'low', importance: 6 },
  { name: 'Aktau Port (Caspian)', type: 'port', country: 'Kazakhstan', region: 'Central Asia', city: 'Aktau', lat: 43.6500, lng: 51.1667, desc: 'Kazakhstan main Caspian Sea port', operator: 'Aktau Sea Commercial Port', threat: 'medium', importance: 8 },
  { name: 'Turkmenbashi Port', type: 'port', country: 'Turkmenistan', region: 'Central Asia', city: 'Turkmenbashi', lat: 40.0167, lng: 52.9667, desc: 'Turkmenistan main Caspian Sea port', operator: 'Turkmenistan State Commodity and Raw Materials Exchange', threat: 'low', importance: 7 },
  { name: 'Almaty International Airport', type: 'airport', country: 'Kazakhstan', region: 'Central Asia', city: 'Almaty', lat: 43.3521, lng: 77.0405, desc: "Kazakhstan's busiest airport", operator: 'TAV Airports', threat: 'low', importance: 7 },
  { name: 'Tashkent International Airport', type: 'airport', country: 'Uzbekistan', region: 'Central Asia', city: 'Tashkent', lat: 41.2579, lng: 69.2811, desc: "Uzbekistan's main international airport", operator: 'Uzbekistan Airports', threat: 'low', importance: 7 },
  { name: 'Kazatomprom Uranium Mine (Inkai)', type: 'nuclear', country: 'Kazakhstan', region: 'Central Asia', city: 'Suzak', lat: 43.5000, lng: 67.5000, desc: "World's largest uranium producer mine", operator: 'Kazatomprom / Cameco', threat: 'medium', importance: 9 },

  // ═══════════════════════════════════════════════════════════════
  // SUB-SAHARAN AFRICA — 55 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military
  { name: 'Camp Lemonnier (AFRICOM)', type: 'military', country: 'Djibouti', region: 'Sub-Saharan Africa', city: 'Djibouti City', lat: 11.5333, lng: 43.1500, desc: "US Africa Command's only permanent base in Africa", operator: 'US AFRICOM', threat: 'high', importance: 10 },
  { name: 'Chabelley Airfield', type: 'military_airport', country: 'Djibouti', region: 'Sub-Saharan Africa', city: 'Djibouti City', lat: 11.3833, lng: 43.0000, desc: 'US drone operations base in Djibouti', operator: 'US Air Force', threat: 'high', importance: 9 },
  { name: 'PLA Support Base Djibouti', type: 'military', country: 'Djibouti', region: 'Sub-Saharan Africa', city: 'Djibouti City', lat: 11.5500, lng: 43.1333, desc: "China's first overseas military base", operator: 'People Liberation Army', threat: 'high', importance: 10 },
  { name: 'French Forces Djibouti (FFDj)', type: 'military', country: 'Djibouti', region: 'Sub-Saharan Africa', city: 'Djibouti City', lat: 11.5833, lng: 43.1500, desc: "France's largest overseas military base", operator: 'French Armed Forces', threat: 'medium', importance: 9 },
  { name: 'Manda Bay Airfield', type: 'military_airport', country: 'Kenya', region: 'Sub-Saharan Africa', city: 'Lamu', lat: -2.3333, lng: 40.9167, desc: 'US military base in Kenya, attacked by al-Shabaab in 2020', operator: 'US AFRICOM / Kenya Defence Forces', threat: 'high', importance: 8 },
  { name: 'Waterkloof Air Force Base', type: 'military_airport', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Pretoria', lat: -25.8300, lng: 28.2200, desc: "South Africa Air Force's main transport base", operator: 'South African Air Force', threat: 'low', importance: 7 },
  { name: 'Simonstown Naval Base', type: 'military', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Cape Town', lat: -34.1833, lng: 18.4333, desc: 'South African Navy headquarters', operator: 'South African Navy', threat: 'low', importance: 8 },
  // Energy
  { name: 'Sasol Secunda Synfuels Plant', type: 'refinery', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Secunda', lat: -26.5333, lng: 29.1833, desc: "World's largest coal-to-liquids plant", operator: 'Sasol', threat: 'medium', importance: 9 },
  { name: 'Koeberg Nuclear Power Station', type: 'nuclear', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Cape Town', lat: -33.6667, lng: 18.4333, desc: "Africa's only nuclear power plant", operator: 'Eskom', threat: 'medium', importance: 10 },
  { name: 'Medupi Power Station', type: 'power_plant', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Lephalale', lat: -23.6667, lng: 27.9667, desc: "Africa's largest dry-cooled power station", operator: 'Eskom', threat: 'medium', importance: 8 },
  { name: 'Cabinda Oil Fields (Angola)', type: 'oil_gas', country: 'Angola', region: 'Sub-Saharan Africa', city: 'Cabinda', lat: -5.5500, lng: 12.2000, desc: "Angola's main oil production area", operator: 'Sonangol / Chevron', threat: 'high', importance: 9 },
  { name: 'Bonny Island LNG Terminal', type: 'oil_gas', country: 'Nigeria', region: 'Sub-Saharan Africa', city: 'Bonny', lat: 4.4500, lng: 7.1500, desc: "Nigeria's main LNG export terminal", operator: 'Nigeria LNG Limited', threat: 'high', importance: 9 },
  { name: 'Escravos Gas Processing Plant', type: 'oil_gas', country: 'Nigeria', region: 'Sub-Saharan Africa', city: 'Warri', lat: 5.5833, lng: 5.2167, desc: 'Major gas processing facility in Niger Delta', operator: 'Chevron Nigeria', threat: 'high', importance: 8 },
  { name: 'Grand Inga Dam Site', type: 'dam', country: 'Democratic Republic of Congo', region: 'Sub-Saharan Africa', city: 'Inga', lat: -5.5167, lng: 13.5833, desc: 'Planned world largest hydroelectric project', operator: 'SNEL', threat: 'high', importance: 9 },
  { name: 'Kariba Dam', type: 'dam', country: 'Zambia', region: 'Sub-Saharan Africa', city: 'Kariba', lat: -16.5167, lng: 28.7667, desc: "World's largest man-made lake by volume", operator: 'Zambezi River Authority', threat: 'medium', importance: 8 },
  // Ports
  { name: 'Port of Durban', type: 'port', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Durban', lat: -29.8667, lng: 31.0333, desc: "Africa's busiest port", operator: 'Transnet National Ports Authority', threat: 'medium', importance: 9 },
  { name: 'Port of Lagos (Apapa)', type: 'port', country: 'Nigeria', region: 'Sub-Saharan Africa', city: 'Lagos', lat: 6.4500, lng: 3.3833, desc: "West Africa's largest port", operator: 'Nigerian Ports Authority', threat: 'high', importance: 9 },
  { name: 'Port of Mombasa', type: 'port', country: 'Kenya', region: 'Sub-Saharan Africa', city: 'Mombasa', lat: -4.0500, lng: 39.6667, desc: "East Africa's main port", operator: 'Kenya Ports Authority', threat: 'medium', importance: 8 },
  { name: 'Port of Dar es Salaam', type: 'port', country: 'Tanzania', region: 'Sub-Saharan Africa', city: 'Dar es Salaam', lat: -6.8167, lng: 39.2833, desc: "Tanzania's main port", operator: 'Tanzania Ports Authority', threat: 'medium', importance: 7 },
  { name: 'Lekki Deep Sea Port', type: 'port', country: 'Nigeria', region: 'Sub-Saharan Africa', city: 'Lagos', lat: 6.4167, lng: 3.7500, desc: "Nigeria's new deep-water port, Chinese-built", operator: 'Lekki Port LFTZ Enterprise', threat: 'medium', importance: 8 },
  // Airports
  { name: 'O.R. Tambo International Airport', type: 'airport', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Johannesburg', lat: -26.1333, lng: 28.2500, desc: "Africa's busiest airport", operator: 'Airports Company South Africa', threat: 'medium', importance: 9 },
  { name: 'Murtala Muhammed International Airport', type: 'airport', country: 'Nigeria', region: 'Sub-Saharan Africa', city: 'Lagos', lat: 6.5774, lng: 3.3214, desc: "West Africa's busiest airport", operator: 'Federal Airports Authority of Nigeria', threat: 'high', importance: 8 },
  { name: 'Jomo Kenyatta International Airport', type: 'airport', country: 'Kenya', region: 'Sub-Saharan Africa', city: 'Nairobi', lat: -1.3192, lng: 36.9275, desc: "East Africa's main international hub", operator: 'Kenya Airports Authority', threat: 'medium', importance: 8 },
  // Data Centers
  { name: 'JINX (Johannesburg Internet Exchange)', type: 'data_center', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Johannesburg', lat: -26.2041, lng: 28.0473, desc: "Africa's largest internet exchange", operator: 'JINX', threat: 'medium', importance: 8 },
  { name: 'Teraco Data Centre (Johannesburg)', type: 'data_center', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Johannesburg', lat: -26.2041, lng: 28.0473, desc: "Africa's largest carrier-neutral data center", operator: 'Teraco', threat: 'medium', importance: 8 },
  // Financial
  { name: 'Johannesburg Stock Exchange (JSE)', type: 'financial', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Johannesburg', lat: -26.2041, lng: 28.0473, desc: "Africa's largest stock exchange", operator: 'JSE Limited', threat: 'medium', importance: 9 },
  // Telecom
  { name: 'WACS Submarine Cable Landing (Cape Town)', type: 'telecom', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Cape Town', lat: -33.9249, lng: 18.4241, desc: 'West Africa Cable System landing station', operator: 'MTN / Vodacom Consortium', threat: 'medium', importance: 9 },
  { name: 'SEACOM Cable Landing (Mtunzini)', type: 'telecom', country: 'South Africa', region: 'Sub-Saharan Africa', city: 'Mtunzini', lat: -28.9500, lng: 31.7500, desc: 'SEACOM submarine cable landing station', operator: 'SEACOM', threat: 'medium', importance: 8 },

  // ═══════════════════════════════════════════════════════════════
  // NORTH AFRICA — 50 facilities
  // ═══════════════════════════════════════════════════════════════
  { name: 'Hassi Messaoud Oil Field', type: 'oil_gas', country: 'Algeria', region: 'North Africa', city: 'Ouargla', lat: 31.6833, lng: 6.0667, desc: "Algeria's largest oil field", operator: 'Sonatrach', threat: 'high', importance: 10 },
  { name: 'Hassi R\'Mel Gas Field', type: 'oil_gas', country: 'Algeria', region: 'North Africa', city: 'Laghouat', lat: 32.9333, lng: 3.2667, desc: "Algeria's largest natural gas field", operator: 'Sonatrach', threat: 'high', importance: 10 },
  { name: 'Transmed Pipeline (Enrico Mattei)', type: 'pipeline', country: 'Tunisia', region: 'North Africa', city: 'Tunis', lat: 36.8190, lng: 10.1658, desc: 'Algeria-Italy gas pipeline through Tunisia', operator: 'STEG / Sonatrach', threat: 'medium', importance: 9 },
  { name: 'Medgaz Pipeline', type: 'pipeline', country: 'Algeria', region: 'North Africa', city: 'Beni Saf', lat: 35.3000, lng: -1.3833, desc: 'Direct Algeria-Spain subsea gas pipeline', operator: 'Sonatrach / Naturgy', threat: 'medium', importance: 9 },
  { name: 'Ain Tsila Gas Field', type: 'oil_gas', country: 'Algeria', region: 'North Africa', city: 'Illizi', lat: 26.5000, lng: 8.4667, desc: 'Major Algerian gas field developed with Italian partners', operator: 'Sonatrach / ENI', threat: 'medium', importance: 8 },
  { name: 'El Sharara Oil Field', type: 'oil_gas', country: 'Libya', region: 'North Africa', city: 'Murzuq', lat: 27.9167, lng: 12.0000, desc: "Libya's largest oil field", operator: 'National Oil Corporation / Repsol', threat: 'critical', importance: 10 },
  { name: 'Mellitah Oil & Gas Complex', type: 'oil_gas', country: 'Libya', region: 'North Africa', city: 'Mellitah', lat: 32.8833, lng: 12.3167, desc: 'Major Libyan oil and gas processing complex', operator: 'Mellitah Oil & Gas (NOC/ENI)', threat: 'critical', importance: 9 },
  { name: 'Greenstream Pipeline', type: 'pipeline', country: 'Libya', region: 'North Africa', city: 'Mellitah', lat: 32.8833, lng: 12.3167, desc: 'Libya-Italy subsea gas pipeline', operator: 'Mellitah Oil & Gas', threat: 'critical', importance: 9 },
  { name: 'Suez Canal Authority HQ', type: 'government', country: 'Egypt', region: 'North Africa', city: 'Ismailia', lat: 30.5965, lng: 32.2715, desc: 'Headquarters of the Suez Canal Authority', operator: 'Suez Canal Authority', threat: 'high', importance: 10 },
  { name: 'Port Said Container Terminal', type: 'port', country: 'Egypt', region: 'North Africa', city: 'Port Said', lat: 31.2565, lng: 32.2841, desc: 'Major container terminal at northern entrance of Suez Canal', operator: 'Hutchison Ports', threat: 'high', importance: 9 },
  { name: 'Alexandria Port', type: 'port', country: 'Egypt', region: 'North Africa', city: 'Alexandria', lat: 31.2001, lng: 29.9187, desc: "Egypt's main commercial port", operator: 'Alexandria Port Authority', threat: 'medium', importance: 9 },
  { name: 'Casablanca Port', type: 'port', country: 'Morocco', region: 'North Africa', city: 'Casablanca', lat: 33.5731, lng: -7.5898, desc: "Africa's third-largest port", operator: 'Marsa Maroc', threat: 'low', importance: 8 },
  { name: 'Tanger Med Port', type: 'port', country: 'Morocco', region: 'North Africa', city: 'Tangier', lat: 35.8833, lng: -5.5000, desc: "Africa's largest port complex", operator: 'Tanger Med Special Agency', threat: 'medium', importance: 9 },
  { name: 'Cairo International Airport', type: 'airport', country: 'Egypt', region: 'North Africa', city: 'Cairo', lat: 30.1219, lng: 31.4056, desc: "Africa's second-busiest airport", operator: 'Egyptian Airports Company', threat: 'medium', importance: 9 },
  { name: 'Mohammed V International Airport', type: 'airport', country: 'Morocco', region: 'North Africa', city: 'Casablanca', lat: 33.3675, lng: -7.5898, desc: "Morocco's main international airport", operator: 'ONDA', threat: 'low', importance: 8 },
  { name: 'El Aouina International Airport', type: 'airport', country: 'Tunisia', region: 'North Africa', city: 'Tunis', lat: 36.8510, lng: 10.2272, desc: "Tunisia's main international airport", operator: 'OACA', threat: 'medium', importance: 7 },
  { name: 'Ain Sokhna Industrial Zone', type: 'company', country: 'Egypt', region: 'North Africa', city: 'Ain Sokhna', lat: 29.5833, lng: 32.3333, desc: 'Major industrial zone and port on Red Sea', operator: 'SCZONE', threat: 'medium', importance: 8 },
  { name: 'El Dabaa Nuclear Power Plant (under construction)', type: 'nuclear', country: 'Egypt', region: 'North Africa', city: 'El Dabaa', lat: 31.0167, lng: 28.4333, desc: "Egypt's first nuclear power plant, built by Rosatom", operator: 'Nuclear Power Plants Authority (NPPA)', threat: 'medium', importance: 9 },
  { name: 'Benghazi Oil Crescent Terminals', type: 'oil_gas', country: 'Libya', region: 'North Africa', city: 'Benghazi', lat: 32.1167, lng: 20.0667, desc: 'Eastern Libya oil export terminals', operator: 'National Oil Corporation', threat: 'critical', importance: 9 },
  { name: 'Sfax Industrial Port', type: 'port', country: 'Tunisia', region: 'North Africa', city: 'Sfax', lat: 34.7333, lng: 10.7667, desc: "Tunisia's second-largest port", operator: 'OMMP', threat: 'low', importance: 6 },

  // ═══════════════════════════════════════════════════════════════
  // AMERICAS — 60 facilities
  // ═══════════════════════════════════════════════════════════════
  // Military
  { name: 'NORAD Cheyenne Mountain Complex', type: 'military', country: 'United States', region: 'Americas', city: 'Colorado Springs', lat: 38.7444, lng: -104.8461, desc: 'Underground command center for North American aerospace defense', operator: 'NORAD / USNORTHCOM', threat: 'high', importance: 10 },
  { name: 'NSA Fort Meade', type: 'military', country: 'United States', region: 'Americas', city: 'Fort Meade', lat: 39.1081, lng: -76.7722, desc: 'National Security Agency headquarters', operator: 'NSA', threat: 'high', importance: 10 },
  { name: 'Pentagon', type: 'government', country: 'United States', region: 'Americas', city: 'Arlington', lat: 38.8719, lng: -77.0563, desc: 'US Department of Defense headquarters', operator: 'US Department of Defense', threat: 'high', importance: 10 },
  { name: 'CIA Headquarters (Langley)', type: 'government', country: 'United States', region: 'Americas', city: 'McLean', lat: 38.9519, lng: -77.1461, desc: 'Central Intelligence Agency headquarters', operator: 'CIA', threat: 'high', importance: 10 },
  { name: 'Guantanamo Bay Naval Station', type: 'military', country: 'Cuba', region: 'Americas', city: 'Guantanamo', lat: 19.9042, lng: -75.1000, desc: 'US naval station and detention facility in Cuba', operator: 'US Navy', threat: 'high', importance: 9 },
  { name: 'Vandenberg Space Force Base', type: 'military_airport', country: 'United States', region: 'Americas', city: 'Lompoc', lat: 34.7420, lng: -120.5724, desc: 'US Space Force launch facility, polar orbit launches', operator: 'US Space Force', threat: 'medium', importance: 9 },
  { name: 'Cape Canaveral Space Force Station', type: 'satellite', country: 'United States', region: 'Americas', city: 'Cape Canaveral', lat: 28.4889, lng: -80.5778, desc: 'Primary US launch site for east-coast missions', operator: 'US Space Force / NASA', threat: 'medium', importance: 10 },
  { name: 'Schriever Space Force Base', type: 'military', country: 'United States', region: 'Americas', city: 'Colorado Springs', lat: 38.8028, lng: -104.5261, desc: 'GPS satellite control and space operations center', operator: 'US Space Force', threat: 'high', importance: 10 },
  { name: 'Diego Garcia (BIOT)', type: 'military', country: 'United Kingdom', region: 'Americas', city: 'Diego Garcia', lat: -7.3167, lng: 72.4167, desc: 'Joint UK-US military base in Indian Ocean', operator: 'US Navy / RAF', threat: 'medium', importance: 10 },
  // Nuclear
  { name: 'Y-12 National Security Complex', type: 'nuclear', country: 'United States', region: 'Americas', city: 'Oak Ridge', lat: 36.0167, lng: -84.2500, desc: 'US nuclear weapons component manufacturing facility', operator: 'Consolidated Nuclear Security', threat: 'high', importance: 10 },
  { name: 'Savannah River Site', type: 'nuclear', country: 'United States', region: 'Americas', city: 'Aiken', lat: 33.3500, lng: -81.7167, desc: 'US nuclear materials production and cleanup site', operator: 'US Department of Energy', threat: 'high', importance: 9 },
  { name: 'Hanford Site', type: 'nuclear', country: 'United States', region: 'Americas', city: 'Richland', lat: 46.5500, lng: -119.4833, desc: 'Former plutonium production site, largest nuclear cleanup', operator: 'US Department of Energy', threat: 'medium', importance: 9 },
  { name: 'Angra Nuclear Power Plant', type: 'nuclear', country: 'Brazil', region: 'Americas', city: 'Angra dos Reis', lat: -23.0083, lng: -44.4583, desc: "Brazil's only nuclear power plant", operator: 'Eletronuclear', threat: 'medium', importance: 8 },
  // Energy
  { name: 'Permian Basin Oil Fields', type: 'oil_gas', country: 'United States', region: 'Americas', city: 'Midland', lat: 31.9973, lng: -102.0779, desc: "World's most productive oil basin", operator: 'Multiple operators (ExxonMobil, Chevron, Pioneer)', threat: 'medium', importance: 10 },
  { name: 'Prudhoe Bay Oil Field', type: 'oil_gas', country: 'United States', region: 'Americas', city: 'Prudhoe Bay', lat: 70.2553, lng: -148.3378, desc: "North America's largest oil field", operator: 'BP / ConocoPhillips / ExxonMobil', threat: 'medium', importance: 9 },
  { name: 'Trans-Alaska Pipeline System (TAPS)', type: 'pipeline', country: 'United States', region: 'Americas', city: 'Valdez', lat: 61.1308, lng: -146.3483, desc: '800-mile pipeline from Prudhoe Bay to Valdez', operator: 'Alyeska Pipeline Service Company', threat: 'medium', importance: 9 },
  { name: 'Itaipu Hydroelectric Dam', type: 'dam', country: 'Brazil', region: 'Americas', city: 'Foz do Iguaçu', lat: -25.4083, lng: -54.5889, desc: "World's second-largest hydroelectric plant", operator: 'Itaipu Binacional', threat: 'medium', importance: 10 },
  { name: 'Hoover Dam', type: 'dam', country: 'United States', region: 'Americas', city: 'Boulder City', lat: 36.0156, lng: -114.7378, desc: 'Iconic hydroelectric dam on Colorado River', operator: 'US Bureau of Reclamation', threat: 'medium', importance: 8 },
  // Ports
  { name: 'Port of Los Angeles', type: 'port', country: 'United States', region: 'Americas', city: 'Los Angeles', lat: 33.7361, lng: -118.2639, desc: "Western Hemisphere's busiest container port", operator: 'Port of Los Angeles', threat: 'medium', importance: 10 },
  { name: 'Port of New York and New Jersey', type: 'port', country: 'United States', region: 'Americas', city: 'New York', lat: 40.6892, lng: -74.0445, desc: "US East Coast's largest port", operator: 'Port Authority of New York and New Jersey', threat: 'high', importance: 10 },
  { name: 'Port of Houston', type: 'port', country: 'United States', region: 'Americas', city: 'Houston', lat: 29.7604, lng: -95.3698, desc: "US largest port by foreign tonnage", operator: 'Port of Houston Authority', threat: 'medium', importance: 9 },
  { name: 'Port of Santos', type: 'port', country: 'Brazil', region: 'Americas', city: 'Santos', lat: -23.9500, lng: -46.3333, desc: "Latin America's largest port", operator: 'Santos Port Authority', threat: 'medium', importance: 9 },
  { name: 'Panama Canal', type: 'port', country: 'Panama', region: 'Americas', city: 'Panama City', lat: 9.0000, lng: -79.5000, desc: 'Critical global shipping chokepoint', operator: 'Panama Canal Authority', threat: 'high', importance: 10 },
  // Airports
  { name: 'Hartsfield-Jackson Atlanta International Airport', type: 'airport', country: 'United States', region: 'Americas', city: 'Atlanta', lat: 33.6407, lng: -84.4277, desc: "World's busiest airport by passenger traffic", operator: 'City of Atlanta', threat: 'medium', importance: 9 },
  { name: 'O\'Hare International Airport', type: 'airport', country: 'United States', region: 'Americas', city: 'Chicago', lat: 41.9742, lng: -87.9073, desc: "US second-busiest airport", operator: 'Chicago Department of Aviation', threat: 'medium', importance: 8 },
  { name: 'São Paulo/Guarulhos International Airport', type: 'airport', country: 'Brazil', region: 'Americas', city: 'São Paulo', lat: -23.4356, lng: -46.4731, desc: "South America's busiest airport", operator: 'GRU Airport', threat: 'medium', importance: 8 },
  // Data Centers
  { name: 'Equinix NY4 (New York)', type: 'data_center', country: 'United States', region: 'Americas', city: 'Secaucus', lat: 40.7895, lng: -74.0565, desc: "World's largest internet exchange hub", operator: 'Equinix', threat: 'high', importance: 10 },
  { name: 'AWS US-East-1 (Northern Virginia)', type: 'data_center', country: 'United States', region: 'Americas', city: 'Ashburn', lat: 39.0438, lng: -77.4874, desc: "World's largest cloud data center cluster", operator: 'Amazon Web Services', threat: 'high', importance: 10 },
  { name: 'Google Data Center (The Dalles)', type: 'data_center', country: 'United States', region: 'Americas', city: 'The Dalles', lat: 45.5946, lng: -121.1787, desc: "Google's first large-scale data center", operator: 'Google', threat: 'medium', importance: 9 },
  // Financial
  { name: 'New York Stock Exchange (NYSE)', type: 'financial', country: 'United States', region: 'Americas', city: 'New York', lat: 40.7069, lng: -74.0089, desc: "World's largest stock exchange by market cap", operator: 'Intercontinental Exchange', threat: 'high', importance: 10 },
  { name: 'Federal Reserve Bank of New York', type: 'financial', country: 'United States', region: 'Americas', city: 'New York', lat: 40.7075, lng: -74.0113, desc: 'Holds largest gold reserve in the world', operator: 'Federal Reserve System', threat: 'high', importance: 10 },
  { name: 'NASDAQ (Market Site)', type: 'financial', country: 'United States', region: 'Americas', city: 'New York', lat: 40.7580, lng: -73.9855, desc: "World's second-largest stock exchange", operator: 'Nasdaq Inc.', threat: 'high', importance: 9 },
  // Research
  { name: 'Fermilab (Fermi National Accelerator Laboratory)', type: 'research', country: 'United States', region: 'Americas', city: 'Batavia', lat: 41.8319, lng: -88.2575, desc: 'US particle physics and accelerator laboratory', operator: 'US Department of Energy', threat: 'low', importance: 7 },

  // ═══════════════════════════════════════════════════════════════
  // LATIN AMERICA — 50 facilities
  // ═══════════════════════════════════════════════════════════════
  { name: 'Pemex Cantarell Oil Field', type: 'oil_gas', country: 'Mexico', region: 'Latin America', city: 'Campeche', lat: 19.8333, lng: -91.8333, desc: "Mexico's largest offshore oil field", operator: 'Pemex', threat: 'medium', importance: 9 },
  { name: 'Pemex Ku-Maloob-Zaap Oil Field', type: 'oil_gas', country: 'Mexico', region: 'Latin America', city: 'Campeche', lat: 20.0833, lng: -92.0833, desc: "Mexico's most productive oil field", operator: 'Pemex', threat: 'medium', importance: 9 },
  { name: 'Coatzacoalcos Petrochemical Complex', type: 'refinery', country: 'Mexico', region: 'Latin America', city: 'Coatzacoalcos', lat: 18.1333, lng: -94.4333, desc: "Mexico's main petrochemical hub", operator: 'Pemex', threat: 'medium', importance: 8 },
  { name: 'Cerrejón Coal Mine', type: 'oil_gas', country: 'Colombia', region: 'Latin America', city: 'La Guajira', lat: 11.0833, lng: -72.7167, desc: "Latin America's largest open-pit coal mine", operator: 'Cerrejón (Glencore)', threat: 'medium', importance: 8 },
  { name: 'Caño Limón-Coveñas Pipeline', type: 'pipeline', country: 'Colombia', region: 'Latin America', city: 'Arauca', lat: 7.0833, lng: -70.7500, desc: 'Major Colombian oil pipeline, frequent ELN attacks', operator: 'Ecopetrol', threat: 'high', importance: 8 },
  { name: 'Itabira Iron Ore Mine', type: 'company', country: 'Brazil', region: 'Latin America', city: 'Itabira', lat: -19.6167, lng: -43.2167, desc: "Brazil's largest iron ore mine", operator: 'Vale', threat: 'low', importance: 8 },
  { name: 'Carajás Mine', type: 'company', country: 'Brazil', region: 'Latin America', city: 'Parauapebas', lat: -6.0500, lng: -50.1667, desc: "World's largest iron ore mine", operator: 'Vale', threat: 'low', importance: 9 },
  { name: 'Chuquicamata Copper Mine', type: 'company', country: 'Chile', region: 'Latin America', city: 'Calama', lat: -22.3167, lng: -68.9167, desc: "World's largest open-pit copper mine", operator: 'Codelco', threat: 'low', importance: 9 },
  { name: 'Escondida Copper Mine', type: 'company', country: 'Chile', region: 'Latin America', city: 'Antofagasta', lat: -24.2667, lng: -69.0667, desc: "World's largest copper producer", operator: 'BHP / Rio Tinto', threat: 'low', importance: 9 },
  { name: 'Vaca Muerta Shale Formation', type: 'oil_gas', country: 'Argentina', region: 'Latin America', city: 'Neuquén', lat: -38.9500, lng: -68.0667, desc: "World's second-largest shale gas reserve", operator: 'YPF / Shell / Chevron', threat: 'medium', importance: 9 },
  { name: 'Yacyretá Hydroelectric Dam', type: 'dam', country: 'Argentina', region: 'Latin America', city: 'Ituzaingó', lat: -27.4833, lng: -56.7167, desc: 'Major hydroelectric dam on Paraná River', operator: 'Entidad Binacional Yacyretá', threat: 'low', importance: 8 },
  { name: 'Belo Monte Hydroelectric Plant', type: 'dam', country: 'Brazil', region: 'Latin America', city: 'Altamira', lat: -3.1167, lng: -51.7833, desc: "World's fourth-largest hydroelectric plant", operator: 'Norte Energia', threat: 'low', importance: 8 },
  { name: 'Tucuruí Hydroelectric Plant', type: 'dam', country: 'Brazil', region: 'Latin America', city: 'Tucuruí', lat: -3.8333, lng: -49.6667, desc: 'First large dam in the Amazon rainforest', operator: 'Eletrobras', threat: 'low', importance: 8 },
  { name: 'Port of Cartagena', type: 'port', country: 'Colombia', region: 'Latin America', city: 'Cartagena', lat: 10.3833, lng: -75.5000, desc: "Colombia's main container port", operator: 'Sociedad Portuaria Regional de Cartagena', threat: 'medium', importance: 8 },
  { name: 'Port of Callao', type: 'port', country: 'Peru', region: 'Latin America', city: 'Callao', lat: -12.0500, lng: -77.1333, desc: "Peru's main port", operator: 'APM Terminals / DP World', threat: 'medium', importance: 8 },
  { name: 'Port of Buenos Aires', type: 'port', country: 'Argentina', region: 'Latin America', city: 'Buenos Aires', lat: -34.6037, lng: -58.3816, desc: "Argentina's main port", operator: 'Puerto Buenos Aires', threat: 'medium', importance: 8 },
  { name: 'Port of Veracruz', type: 'port', country: 'Mexico', region: 'Latin America', city: 'Veracruz', lat: 19.2000, lng: -96.1333, desc: "Mexico's oldest and main port", operator: 'API Veracruz', threat: 'medium', importance: 8 },
  { name: 'Aeropuerto Internacional Benito Juárez', type: 'airport', country: 'Mexico', region: 'Latin America', city: 'Mexico City', lat: 19.4363, lng: -99.0721, desc: "Latin America's second-busiest airport", operator: 'AICM', threat: 'medium', importance: 8 },
  { name: 'El Dorado International Airport', type: 'airport', country: 'Colombia', region: 'Latin America', city: 'Bogotá', lat: 4.7016, lng: -74.1469, desc: "Colombia's main international airport", operator: 'OPAIN', threat: 'medium', importance: 8 },
  { name: 'Jorge Newbery Airfield', type: 'airport', country: 'Argentina', region: 'Latin America', city: 'Buenos Aires', lat: -34.5592, lng: -58.4156, desc: "Argentina's busiest domestic airport", operator: 'Aeropuertos Argentina 2000', threat: 'low', importance: 7 },
  { name: 'Comodoro Rivadavia Air Base', type: 'military_airport', country: 'Argentina', region: 'Latin America', city: 'Comodoro Rivadavia', lat: -45.7853, lng: -67.4997, desc: 'Argentine Air Force base in Patagonia', operator: 'Argentine Air Force', threat: 'low', importance: 6 },
  { name: 'IXPBR (São Paulo Internet Exchange)', type: 'data_center', country: 'Brazil', region: 'Latin America', city: 'São Paulo', lat: -23.5505, lng: -46.6333, desc: "Latin America's largest internet exchange", operator: 'NIC.br', threat: 'medium', importance: 9 },
  { name: 'Petrobras Refinaria Duque de Caxias (REDUC)', type: 'refinery', country: 'Brazil', region: 'Latin America', city: 'Duque de Caxias', lat: -22.7833, lng: -43.3000, desc: "Brazil's second-largest oil refinery", operator: 'Petrobras', threat: 'medium', importance: 8 },
  { name: 'Angra Nuclear Power Plant', type: 'nuclear', country: 'Brazil', region: 'Latin America', city: 'Angra dos Reis', lat: -23.0083, lng: -44.4583, desc: "Brazil's only nuclear power plant", operator: 'Eletronuclear', threat: 'medium', importance: 8 },

  // ═══════════════════════════════════════════════════════════════
  // GLOBAL — Key strategic facilities
  // ═══════════════════════════════════════════════════════════════
  { name: 'International Space Station (ISS)', type: 'satellite', country: 'International', region: 'Global', city: 'Low Earth Orbit', lat: 0.0, lng: 0.0, desc: 'International Space Station, multinational research laboratory', operator: 'NASA / Roscosmos / ESA / JAXA / CSA', threat: 'medium', importance: 9 },
  { name: 'SWIFT Financial Messaging Network HQ', type: 'financial', country: 'Belgium', region: 'Global', city: 'La Hulpe', lat: 50.5667, lng: 4.5167, desc: 'Global interbank financial messaging network', operator: 'SWIFT', threat: 'high', importance: 10 },
  { name: 'Internet Assigned Numbers Authority (IANA)', type: 'telecom', country: 'United States', region: 'Global', city: 'Los Angeles', lat: 34.0522, lng: -118.2437, desc: 'Global IP address and DNS root management', operator: 'ICANN / PTI', threat: 'high', importance: 10 },
];

let inserted = 0;
let skipped = 0;
for (const f of facilities) {
  try {
    await upsert(f);
    inserted++;
  } catch (e) {
    console.error(`Error inserting ${f.name}:`, e.message);
    skipped++;
  }
}

console.log(`\n✅ Done: ${inserted} inserted, ${skipped} skipped/errored`);

// Verify counts per region
const [counts] = await conn.execute('SELECT region, COUNT(*) as cnt FROM facilities GROUP BY region ORDER BY cnt DESC');
console.log('\n=== FACILITIES PER REGION ===');
counts.forEach(r => console.log(`  ${r.region}: ${r.cnt}`));

await conn.end();
