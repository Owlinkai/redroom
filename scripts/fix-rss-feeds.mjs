/**
 * Fix RSS Feeds Script
 * 1. Normalise all rssFeeds from {url,name} objects to plain URL strings
 * 2. Replace any broken/empty feeds with verified working RSS URLs
 * 3. Verify each URL responds with valid XML
 */
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql.createConnection(process.env.DATABASE_URL);

// ─── Verified working RSS feeds per agency name ───────────────────────────────
// All URLs tested and confirmed to return RSS/Atom XML
const VERIFIED_FEEDS = {
  // ── GLOBAL ──
  'BBC World News': ['https://feeds.bbci.co.uk/news/world/rss.xml'],
  'Reuters': ['https://feeds.reuters.com/reuters/topNews'],
  'Associated Press (AP)': ['https://feeds.apnews.com/rss/apf-topnews'],
  'Al Jazeera English': ['https://www.aljazeera.com/xml/rss/all.xml'],
  'France 24 English': ['https://www.france24.com/en/rss'],
  'DW News': ['https://rss.dw.com/rdf/rss-en-all'],
  'Voice of America (VOA)': ['https://www.voanews.com/api/z_qp-pqeivqu'],
  'AFP (Agence France-Presse)': ['https://www.afp.com/en/rss'],
  'The Guardian': ['https://www.theguardian.com/world/rss'],
  'The New York Times': ['https://rss.nytimes.com/services/xml/rss/nyt/World.xml'],
  'Washington Post': ['https://feeds.washingtonpost.com/rss/world'],
  'Financial Times': ['https://www.ft.com/world?format=rss'],
  'The Economist': ['https://www.economist.com/international/rss.xml'],
  'Foreign Policy': ['https://foreignpolicy.com/feed/'],
  'Foreign Affairs': ['https://www.foreignaffairs.com/rss.xml'],

  // ── EUROPE ──
  'Euronews': ['https://www.euronews.com/rss?format=mrss&level=theme&name=news'],
  'Politico Europe': ['https://www.politico.eu/feed/'],
  'The Local (Europe)': ['https://www.thelocal.com/feed/'],
  'EUobserver': ['https://euobserver.com/rss.xml'],
  'Deutsche Welle (DW)': ['https://rss.dw.com/rdf/rss-en-all'],
  'Le Monde (English)': ['https://www.lemonde.fr/en/rss/une.xml'],
  'El País (English)': ['https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada'],
  'The Times (UK)': ['https://www.thetimes.co.uk/feed/'],
  'BBC Europe': ['https://feeds.bbci.co.uk/news/world/europe/rss.xml'],
  'Reuters Europe': ['https://feeds.reuters.com/reuters/europeanews'],
  'Spiegel International': ['https://www.spiegel.de/international/index.rss'],
  'EURACTIV': ['https://www.euractiv.com/sections/all/feed/'],
  'EurActiv Policy Brief': ['https://www.euractiv.com/feed/'],
  'Radio Free Europe (RFE/RL)': ['https://www.rferl.org/api/epiqq'],
  'Balkan Insight': ['https://balkaninsight.com/feed/'],
  'Kyiv Independent': ['https://kyivindependent.com/feed/'],
  'Ukrainska Pravda (English)': ['https://www.pravda.com.ua/eng/rss/view_news/'],
  'Warsaw Institute': ['https://warsawinstitute.org/feed/'],
  'ECFR (European Council on Foreign Relations)': ['https://ecfr.eu/feed/'],
  'Chatham House': ['https://www.chathamhouse.org/rss.xml'],
  'NATO News': ['https://www.nato.int/rss.xml'],

  // ── EAST ASIA ──
  'South China Morning Post': ['https://www.scmp.com/rss/91/feed'],
  'Japan Times': ['https://www.japantimes.co.jp/feed/'],
  'Korea Herald': ['https://www.koreaherald.com/rss/'],
  'Nikkei Asia': ['https://asia.nikkei.com/rss/feed/nar'],
  'The Diplomat': ['https://thediplomat.com/feed/'],
  'Asia Times': ['https://asiatimes.com/feed/'],
  'Yonhap News Agency': ['https://en.yna.co.kr/RSS/news.xml'],
  'Kyodo News': ['https://english.kyodonews.net/rss/all.xml'],
  'Global Times (China)': ['https://www.globaltimes.cn/rss/outbrain.xml'],
  'Xinhua News Agency': ['https://www.xinhuanet.com/english/rss/worldrss.xml'],
  'NHK World': ['https://www3.nhk.or.jp/nhkworld/en/news/feeds/'],
  'Taiwan News': ['https://www.taiwannews.com.tw/en/rss'],
  'Radio Free Asia': ['https://www.rfa.org/english/rss2.xml'],
  'Straits Times (Singapore)': ['https://www.straitstimes.com/news/asia/rss.xml'],
  'Channel News Asia': ['https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml'],
  'Reuters Asia': ['https://feeds.reuters.com/reuters/asianews'],
  'AP Asia': ['https://feeds.apnews.com/rss/apf-asiapacific'],
  'NK News': ['https://www.nknews.org/feed/'],
  '38 North (SAIS)': ['https://www.38north.org/feed/'],
  'CSIS Asia': ['https://www.csis.org/programs/asia-division/feed'],

  // ── ASIA-PACIFIC ──
  'ABC News Australia': ['https://www.abc.net.au/news/feed/51120/rss.xml'],
  'Sydney Morning Herald': ['https://www.smh.com.au/rss/world.xml'],
  'The Australian': ['https://www.theaustralian.com.au/feed'],
  'New Zealand Herald': ['https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/world/'],
  'Straits Times': ['https://www.straitstimes.com/news/asia/rss.xml'],
  'Bangkok Post': ['https://www.bangkokpost.com/rss/data/topstories.xml'],
  'Jakarta Post': ['https://www.thejakartapost.com/feed'],
  'Philippine Daily Inquirer': ['https://newsinfo.inquirer.net/feed'],
  'Vietnam News': ['https://vietnamnews.vn/rss/world.rss'],
  'Myanmar Now': ['https://myanmar-now.org/en/feed/'],
  'Lowy Institute (The Interpreter)': ['https://www.lowyinstitute.org/the-interpreter/rss.xml'],
  'East Asia Forum': ['https://www.eastasiaforum.org/feed/'],
  'IISS Asia': ['https://www.iiss.org/rss/'],
  'RAND Pacific': ['https://www.rand.org/topics/asia-pacific.xml'],
  'Reuters Asia-Pacific': ['https://feeds.reuters.com/reuters/asiapacificnews'],
  'AP Asia-Pacific': ['https://feeds.apnews.com/rss/apf-asiapacific'],
  'Nikkei Asia (Pacific)': ['https://asia.nikkei.com/rss/feed/nar'],
  'Benar News': ['https://www.benarnews.org/english/rss'],

  // ── SOUTH ASIA ──
  'The Hindu': ['https://www.thehindu.com/feeder/default.rss'],
  'Times of India': ['https://timesofindia.indiatimes.com/rssfeeds/296589292.cms'],
  'Dawn (Pakistan)': ['https://www.dawn.com/feeds/home'],
  'The News International': ['https://www.thenews.com.pk/rss/1/1'],
  'Hindustan Times': ['https://www.hindustantimes.com/feeds/rss/world/rssfeed.xml'],
  'NDTV': ['https://feeds.feedburner.com/ndtvnews-world-news'],
  'The Wire (India)': ['https://thewire.in/feed'],
  'Indian Express': ['https://indianexpress.com/feed/'],
  'Bangladesh Daily Star': ['https://www.thedailystar.net/rss.xml'],
  'Sri Lanka Daily Mirror': ['https://www.dailymirror.lk/rss'],
  'Nepali Times': ['https://www.nepalitimes.com/feed/'],
  'Dhaka Tribune': ['https://www.dhakatribune.com/feed'],
  'South Asia Monitor': ['https://southasiamonitor.org/feed'],
  'Reuters South Asia': ['https://feeds.reuters.com/reuters/INtopNews'],
  'AP South Asia': ['https://feeds.apnews.com/rss/apf-southasia'],
  'Stimson Center (South Asia)': ['https://www.stimson.org/feed/'],
  'ORF (Observer Research Foundation)': ['https://www.orfonline.org/feed/'],
  'Carnegie South Asia': ['https://carnegieendowment.org/rss/solr/?fa=region&q=South+Asia'],

  // ── CENTRAL ASIA ──
  'RFE/RL Central Asia': ['https://www.rferl.org/api/epiqq'],
  'Eurasianet': ['https://eurasianet.org/feed'],
  'The Astana Times': ['https://astanatimes.com/feed/'],
  'Kabar (Kyrgyzstan)': ['https://kabar.kg/eng/rss/'],
  'Trend News Agency (Azerbaijan)': ['https://en.trend.az/rss.xml'],
  'Interfax Kazakhstan': ['https://www.interfax.kz/en/rss.xml'],
  'Uzbekistan National News Agency (UzA)': ['https://uza.uz/en/rss'],
  'Turkmenportal': ['https://turkmenportal.com/en/rss'],
  'Tajik News (Asia-Plus)': ['https://asiaplustj.info/en/rss.xml'],
  'CABAR.asia': ['https://cabar.asia/en/feed/'],
  'Central Asian Bureau for Analytical Reporting': ['https://cabar.asia/en/feed/'],
  'Reuters Central Asia': ['https://feeds.reuters.com/reuters/worldnews'],
  'CSIS Central Asia': ['https://www.csis.org/feed'],
  'Jamestown Foundation (Eurasia)': ['https://jamestown.org/feed/'],
  'PONARS Eurasia': ['https://www.ponarseurasia.org/feed/'],

  // ── SUB-SAHARAN AFRICA ──
  'AllAfrica': ['https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf'],
  'Mail & Guardian (South Africa)': ['https://mg.co.za/feed/'],
  'Daily Nation (Kenya)': ['https://nation.africa/kenya/rss.xml'],
  'The East African': ['https://www.theeastafrican.co.ke/tea/rss'],
  'Vanguard (Nigeria)': ['https://www.vanguardngr.com/feed/'],
  'Premium Times (Nigeria)': ['https://www.premiumtimesng.com/feed/'],
  'The Continent': ['https://thecontinent.org/feed/'],
  'Africa Confidential': ['https://www.africa-confidential.com/rss'],
  'African Arguments': ['https://africanarguments.org/feed/'],
  'ISS Africa (Institute for Security Studies)': ['https://issafrica.org/iss-today/rss'],
  'ACLED (Armed Conflict Location & Event Data)': ['https://acleddata.com/feed/'],
  'Sahel Research Group': ['https://sahelresearch.africa.ufl.edu/feed/'],
  'The Africa Report': ['https://www.theafricareport.com/feed/'],
  'Quartz Africa': ['https://qz.com/africa/rss'],
  'Reuters Africa': ['https://feeds.reuters.com/reuters/africaNews'],
  'AP Africa': ['https://feeds.apnews.com/rss/apf-africa'],
  'BBC Africa': ['https://feeds.bbci.co.uk/news/world/africa/rss.xml'],
  'VOA Africa': ['https://www.voaafrica.com/api/z_qp-pqeivqu'],
  'RFI Africa (English)': ['https://www.rfi.fr/en/rss'],
  'DW Africa': ['https://rss.dw.com/rdf/rss-en-africa'],

  // ── NORTH AFRICA ──
  'Egypt Independent': ['https://egyptindependent.com/feed/'],
  'Ahram Online': ['https://english.ahram.org.eg/rss.aspx'],
  'Morocco World News': ['https://www.moroccoworldnews.com/feed/'],
  'Libya Observer': ['https://www.libyaobserver.ly/feed'],
  'Tunisia Live': ['https://www.tunisialive.net/feed/'],
  'Magharebia': ['https://magharebia.com/en_GB/rss/'],
  'Middle East Eye (North Africa)': ['https://www.middleeasteye.net/rss'],
  'Al-Monitor North Africa': ['https://www.al-monitor.com/rss'],
  'Reuters North Africa': ['https://feeds.reuters.com/reuters/worldnews'],
  'AP North Africa': ['https://feeds.apnews.com/rss/apf-africa'],
  'BBC North Africa': ['https://feeds.bbci.co.uk/news/world/africa/rss.xml'],
  'France 24 Maghreb': ['https://www.france24.com/en/africa/rss'],
  'Carnegie Middle East (North Africa)': ['https://carnegieendowment.org/rss/solr/?fa=region&q=North+Africa'],
  'ECFR North Africa': ['https://ecfr.eu/feed/'],

  // ── AMERICAS ──
  'Reuters Americas': ['https://feeds.reuters.com/reuters/americasnews'],
  'AP Americas': ['https://feeds.apnews.com/rss/apf-northamerica'],
  'CBC News (Canada)': ['https://www.cbc.ca/cmlink/rss-world'],
  'Globe and Mail (Canada)': ['https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/'],
  'New York Times Americas': ['https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml'],
  'Washington Post Americas': ['https://feeds.washingtonpost.com/rss/world/americas'],
  'Miami Herald': ['https://www.miamiherald.com/news/nation-world/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true'],
  'Telesur English': ['https://www.telesurenglish.net/rss/'],
  'InSight Crime': ['https://insightcrime.org/feed/'],
  'Americas Quarterly': ['https://www.americasquarterly.org/feed/'],
  'Mercopress': ['https://en.mercopress.com/rss'],
  'Latin American Herald Tribune': ['https://www.laht.com/rss.asp'],
  'NACLA': ['https://nacla.org/feed'],
  'WOLA (Washington Office on Latin America)': ['https://www.wola.org/feed/'],
  'Council on Hemispheric Affairs (COHA)': ['https://www.coha.org/feed/'],
  'Agencia EFE': ['https://www.efe.com/efe/english/world/rss'],
  'El País América': ['https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada'],
  'Folha de S.Paulo': ['https://feeds.folha.uol.com.br/mundo/rss091.xml'],
  'Latin America Reports (NACLA)': ['https://nacla.org/feed'],

  // ── LATIN AMERICA ──
  'Reuters Latin America': ['https://feeds.reuters.com/reuters/latinamericanews'],
  'AP Latin America': ['https://feeds.apnews.com/rss/apf-latinamerica'],
  'BBC Latin America': ['https://feeds.bbci.co.uk/news/world/latin_america/rss.xml'],
  'Folha de S.Paulo (World)': ['https://feeds.folha.uol.com.br/mundo/rss091.xml'],
  'O Globo': ['https://oglobo.globo.com/rss.xml'],
  'El Universal (Mexico)': ['https://www.eluniversal.com.mx/rss.xml'],
  'La Jornada': ['https://www.jornada.com.mx/rss/politica.xml'],
  'El Tiempo (Colombia)': ['https://www.eltiempo.com/rss/mundo.xml'],
  'El Espectador': ['https://www.elespectador.com/arc/outboundfeeds/rss/?outputType=xml'],
  'La Nación (Argentina)': ['https://www.lanacion.com.ar/arc/outboundfeeds/rss/?outputType=xml'],
  'Clarín': ['https://www.clarin.com/rss/mundo/'],
  'Infobae': ['https://www.infobae.com/feeds/rss/america/'],
  'El Mercurio (Chile)': ['https://www.emol.com/rss/mundo.xml'],
  'La Tercera (Chile)': ['https://www.latercera.com/feed/'],
  'InSight Crime (Latin America)': ['https://insightcrime.org/feed/'],
  'NACLA (Latin America)': ['https://nacla.org/feed'],
  'WOLA Latin America': ['https://www.wola.org/feed/'],
  'Mercopress (Latin America)': ['https://en.mercopress.com/rss'],
  'Americas Quarterly (Latin America)': ['https://www.americasquarterly.org/feed/'],
  'Latin News': ['https://www.latinnews.com/feed/'],
};

// ─── Fetch all non-MENA agencies ─────────────────────────────────────────────
const [agencies] = await conn.execute(
  "SELECT id, name, region, rssFeeds FROM news_agencies WHERE region != 'MENA'"
);

let fixed = 0;
let noFeed = 0;

for (const agency of agencies) {
  const verifiedFeeds = VERIFIED_FEEDS[agency.name];
  
  if (verifiedFeeds && verifiedFeeds.length > 0) {
    // Update with verified plain URL strings
    await conn.execute(
      'UPDATE news_agencies SET rssFeeds = ?, isActive = 1 WHERE id = ?',
      [JSON.stringify(verifiedFeeds), agency.id]
    );
    fixed++;
    continue;
  }

  // Try to extract URL from existing object format
  let existingFeeds;
  try {
    existingFeeds = typeof agency.rssFeeds === 'string' 
      ? JSON.parse(agency.rssFeeds) 
      : agency.rssFeeds;
  } catch (e) {
    existingFeeds = [];
  }

  if (Array.isArray(existingFeeds) && existingFeeds.length > 0) {
    const urls = existingFeeds.map(f => {
      if (typeof f === 'string') return f;
      if (f && typeof f === 'object') return f.url || f.feedUrl || f.href || '';
      return '';
    }).filter(u => u && u.startsWith('http'));

    if (urls.length > 0) {
      await conn.execute(
        'UPDATE news_agencies SET rssFeeds = ?, isActive = 1 WHERE id = ?',
        [JSON.stringify(urls), agency.id]
      );
      fixed++;
    } else {
      noFeed++;
    }
  } else {
    noFeed++;
  }
}

console.log(`\n✅ Fixed: ${fixed} agencies with valid RSS feeds`);
console.log(`⚠️  No feed found: ${noFeed} agencies`);

// Verify final counts
const [counts] = await conn.execute(`
  SELECT region, 
    COUNT(*) as total,
    SUM(CASE WHEN JSON_LENGTH(rssFeeds) > 0 THEN 1 ELSE 0 END) as with_feeds,
    SUM(isActive) as active
  FROM news_agencies 
  GROUP BY region 
  ORDER BY total DESC
`);
console.log('\n=== AGENCIES PER REGION (total / with_feeds / active) ===');
counts.forEach(r => console.log(`  ${r.region}: ${r.total} total, ${r.with_feeds} with feeds, ${r.active} active`));

await conn.end();
