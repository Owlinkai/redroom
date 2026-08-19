/**
 * seed-10x-agencies.mjs
 * Adds 10x verified news agencies per region with real RSS feeds.
 * Uses correct column names: rssFeeds (JSON), type (enum), bias (enum)
 * Run: node scripts/seed-10x-agencies.mjs
 */
import mysql2 from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const conn = await mysql2.createConnection(process.env.DATABASE_URL);

const ins = async (rows) => {
  let inserted = 0, skipped = 0;
  for (const row of rows) {
    try {
      const [res] = await conn.execute(
        `INSERT INTO \`news_agencies\`
          (\`name\`, \`country\`, \`region\`, \`website\`, \`rssFeeds\`, \`language\`, \`type\`, \`bias\`, \`reliability\`, \`description\`, \`isActive\`, \`categories\`, \`crawlFrequency\`)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE \`name\`=\`name\``,
        [
          row.name,
          row.country,
          row.region,
          row.website,
          JSON.stringify([{ url: row.rssUrl, type: 'rss', label: 'Main Feed' }]),
          row.language,
          row.type,
          row.bias,
          row.reliability,
          row.description,
          row.isActive ? 1 : 0,
          JSON.stringify(row.categories || [row.category]),
          row.crawlFrequency || 60,
        ]
      );
      if (res.affectedRows > 0 && res.insertId > 0) inserted++;
      else skipped++;
    } catch(e) {
      console.error(`  ✗ Failed: ${row.name} — ${e.message}`);
    }
  }
  return { inserted, skipped };
};

// Helper to build agency rows
const a = (name, region, country, website, rssUrl, language, type, bias, reliability, description, isActive = true, category = 'News') => ({
  name, region, country, website, rssUrl, language, type, bias, reliability, description, isActive, category
});

// ─── GLOBAL (Top 30 global agencies) ────────────────────────────────────────
const globalAgencies = [
  a('Reuters','Global','United Kingdom','https://www.reuters.com','https://feeds.reuters.com/reuters/worldNews','English','wire','center',98,'World\'s largest international multimedia news provider'),
  a('Associated Press (AP)','Global','United States','https://apnews.com','https://feeds.apnews.com/rss/apf-topnews','English','wire','center',97,'American not-for-profit news agency, one of the largest in the world'),
  a('AFP (Agence France-Presse)','Global','France','https://www.afp.com','https://www.afp.com/en/rss-feeds','English','wire','center',96,'French international news agency, third largest in the world'),
  a('BBC World News','Global','United Kingdom','https://www.bbc.com/news/world','https://feeds.bbci.co.uk/news/world/rss.xml','English','broadcast','center',95,'BBC global news service covering international affairs'),
  a('Al Jazeera English','Global','Qatar','https://www.aljazeera.com','https://www.aljazeera.com/xml/rss/all.xml','English','broadcast','center-left',88,'Qatar-based international news network with global coverage'),
  a('France 24','Global','France','https://www.france24.com/en','https://www.france24.com/en/rss','English','broadcast','center',90,'French international news channel broadcasting in multiple languages'),
  a('DW (Deutsche Welle)','Global','Germany','https://www.dw.com/en','https://rss.dw.com/rdf/rss-en-all','English','broadcast','center',92,'Germany\'s international broadcaster covering global news'),
  a('Euronews','Global','France','https://www.euronews.com','https://www.euronews.com/rss?level=theme&name=news','English','broadcast','center',87,'European news channel covering international affairs'),
  a('Sky News','Global','United Kingdom','https://news.sky.com','https://feeds.skynews.com/feeds/rss/world.xml','English','broadcast','center-right',88,'British 24-hour news channel with global coverage'),
  a('CNN International','Global','United States','https://edition.cnn.com','https://rss.cnn.com/rss/edition_world.rss','English','broadcast','center-left',85,'CNN international news service'),
  a('The Guardian World','Global','United Kingdom','https://www.theguardian.com/world','https://www.theguardian.com/world/rss','English','independent','left',88,'British newspaper with extensive global coverage'),
  a('New York Times World','Global','United States','https://www.nytimes.com/section/world','https://rss.nytimes.com/services/xml/rss/nyt/World.xml','English','independent','center-left',90,'American newspaper of record with global reporting'),
  a('Washington Post World','Global','United States','https://www.washingtonpost.com/world','https://feeds.washingtonpost.com/rss/world','English','independent','center-left',89,'American newspaper with strong international coverage'),
  a('The Economist','Global','United Kingdom','https://www.economist.com','https://www.economist.com/international/rss.xml','English','independent','center',93,'British weekly magazine covering global politics and economics'),
  a('Foreign Policy','Global','United States','https://foreignpolicy.com','https://foreignpolicy.com/feed/','English','independent','center',91,'American news publication focused on global affairs and foreign policy'),
  a('RFI (Radio France Internationale)','Global','France','https://www.rfi.fr/en','https://www.rfi.fr/en/international/rss','English','broadcast','center',88,'French public radio broadcasting internationally in 22 languages'),
  a('Voice of America (VOA)','Global','United States','https://www.voanews.com','https://www.voanews.com/api/z-oe-qiipqe','English','state','center',82,'US government-funded international broadcaster'),
  a('NHK World','Global','Japan','https://www3.nhk.or.jp/nhkworld','https://www3.nhk.or.jp/nhkworld/en/news/feeds/rss.xml','English','broadcast','center',90,'Japan\'s public broadcaster international service'),
  a('CGTN (China Global Television Network)','Global','China','https://www.cgtn.com','https://www.cgtn.com/subscribe/feeds/rss2.0.xml','English','state','state',65,'Chinese state international broadcaster',true),
  a('UN News','Global','International','https://news.un.org/en','https://news.un.org/feed/subscribe/en/news/all/rss.xml','English','international','center',94,'United Nations official news service'),
  a('Axios World','Global','United States','https://www.axios.com/world','https://api.axios.com/feed/top-stories','English','digital','center',88,'American digital news company covering global affairs'),
  a('Politico Europe','Global','Belgium','https://www.politico.eu','https://www.politico.eu/feed/','English','digital','center',88,'European political news and policy coverage'),
  a('The Intercept','Global','United States','https://theintercept.com','https://theintercept.com/feed/?lang=en','English','digital','left',82,'Investigative journalism covering national security and civil liberties'),
  a('Bellingcat','Global','Netherlands','https://www.bellingcat.com','https://www.bellingcat.com/feed/','English','digital','center',90,'Investigative journalism and OSINT collective'),
  a('ACLED','Global','United States','https://acleddata.com','https://acleddata.com/feed/','English','international','center',95,'Real-time data and analysis on political violence and protest worldwide'),
  a('Crisis Group','Global','Belgium','https://www.crisisgroup.org','https://www.crisisgroup.org/rss.xml','English','international','center',94,'Independent organisation working to prevent wars and shape policies'),
  a('RAND Corporation','Global','United States','https://www.rand.org','https://www.rand.org/pubs/rss/rss_all.xml','English','international','center',93,'American nonprofit global policy think tank'),
  a('Stratfor (RANE)','Global','United States','https://worldview.stratfor.com','https://worldview.stratfor.com/rss.xml','English','international','center',88,'Geopolitical intelligence and forecasting platform'),
  a('Jane\'s Intelligence Review','Global','United Kingdom','https://www.janes.com','https://www.janes.com/feeds/news','English','international','center',92,'World\'s leading open-source defence intelligence provider'),
  a('Financial Times World','Global','United Kingdom','https://www.ft.com/world','https://www.ft.com/world?format=rss','English','independent','center',93,'Financial Times global business and politics coverage'),
];

// ─── MENA (additional agencies) ──────────────────────────────────────────────
const menaAgencies = [
  a('Al-Monitor','MENA','United States','https://www.al-monitor.com','https://www.al-monitor.com/rss.xml','English','digital','center',85,'Independent news site covering the Middle East'),
  a('Middle East Eye','MENA','United Kingdom','https://www.middleeasteye.net','https://www.middleeasteye.net/rss','English','digital','center-left',80,'Independent news organisation covering the Middle East'),
  a('The New Arab','MENA','United Kingdom','https://www.newarab.com','https://www.newarab.com/rss.xml','English','digital','center-left',78,'Independent news platform covering Arab world'),
  a('Arab News','MENA','Saudi Arabia','https://www.arabnews.com','https://www.arabnews.com/rss.xml','English','state','center-right',72,'Saudi English-language daily newspaper'),
  a('Al Arabiya English','MENA','UAE','https://english.alarabiya.net','https://english.alarabiya.net/tools/rss','English','broadcast','center-right',75,'Saudi-owned Arabic news channel English service'),
  a('Jerusalem Post','MENA','Israel','https://www.jpost.com','https://www.jpost.com/rss/rssfeedsfrontpage.aspx','English','independent','center-right',78,'Israeli English-language newspaper'),
  a('Haaretz English','MENA','Israel','https://www.haaretz.com','https://www.haaretz.com/cmlink/1.628765','English','independent','left',82,'Israeli liberal daily newspaper English edition'),
  a('Daily Sabah','MENA','Turkey','https://www.dailysabah.com','https://www.dailysabah.com/rssFeed/push_all','English','state','state',65,'Turkish pro-government English-language daily'),
  a('Kurdistan 24','MENA','Iraq','https://www.kurdistan24.net/en','https://www.kurdistan24.net/en/rss.xml','English','broadcast','center',75,'Kurdish satellite news channel'),
  a('MEMO (Middle East Monitor)','MENA','United Kingdom','https://www.middleeastmonitor.com','https://www.middleeastmonitor.com/feed/','English','digital','center-left',72,'UK-based news website covering the Middle East'),
  a('Libya Observer','MENA','Libya','https://www.libyaobserver.ly','https://www.libyaobserver.ly/feed','English','digital','center',68,'Libyan English-language news outlet'),
  a('Rudaw','MENA','Iraq','https://www.rudaw.net/english','https://www.rudaw.net/rss/english','English','broadcast','center',76,'Kurdish media network covering Iraq, Syria, Turkey, Iran'),
  a('Syria Direct','MENA','Jordan','https://syriadirect.org','https://syriadirect.org/feed/','English','digital','center',82,'Non-profit news organisation covering Syria'),
  a('Asharq Al-Awsat English','MENA','United Kingdom','https://english.aawsat.com','https://english.aawsat.com/rss.xml','English','independent','center-right',74,'Pan-Arab international newspaper English edition'),
  a('Iran International','MENA','United Kingdom','https://www.iranintl.com/en','https://www.iranintl.com/en/rss.xml','English','broadcast','center',78,'Independent Persian-language broadcaster'),
];

// ─── EUROPE ──────────────────────────────────────────────────────────────────
const europeAgencies = [
  a('BBC News Europe','Europe','United Kingdom','https://www.bbc.com/news/world/europe','https://feeds.bbci.co.uk/news/world/europe/rss.xml','English','broadcast','center',95,'BBC coverage of European news and affairs'),
  a('Reuters Europe','Europe','United Kingdom','https://www.reuters.com/world/europe','https://feeds.reuters.com/reuters/europeanews','English','wire','center',97,'Reuters European news wire service'),
  a('DW Europe','Europe','Germany','https://www.dw.com/en/europe','https://rss.dw.com/rdf/rss-en-eu','English','broadcast','center',92,'Deutsche Welle European affairs coverage'),
  a('Euronews Europe','Europe','France','https://www.euronews.com/news/europe','https://www.euronews.com/rss?level=theme&name=europe','English','broadcast','center',87,'Euronews European affairs coverage'),
  a('The Local (Europe)','Europe','Sweden','https://www.thelocal.com','https://feeds.thelocal.com/rss/en','English','digital','center',82,'English-language news from across Europe'),
  a('EUobserver','Europe','Belgium','https://euobserver.com','https://euobserver.com/rss.xml','English','digital','center',85,'Independent EU news and current affairs'),
  a('Le Monde (English)','Europe','France','https://www.lemonde.fr/en','https://www.lemonde.fr/en/rss/une.xml','English','independent','center-left',90,'French newspaper of record English edition'),
  a('Der Spiegel International','Europe','Germany','https://www.spiegel.de/international','https://www.spiegel.de/international/index.rss','English','independent','center-left',88,'German news magazine international edition'),
  a('The Guardian Europe','Europe','United Kingdom','https://www.theguardian.com/world/europe-news','https://www.theguardian.com/world/europe-news/rss','English','independent','left',88,'Guardian coverage of European affairs'),
  a('Financial Times Europe','Europe','United Kingdom','https://www.ft.com/world/europe','https://www.ft.com/world/europe?format=rss','English','independent','center',93,'Financial Times European business and politics'),
  a('Balkan Insight (BIRN)','Europe','Serbia','https://balkaninsight.com','https://balkaninsight.com/feed/','English','digital','center',88,'Balkan Investigative Reporting Network'),
  a('Kyiv Independent','Europe','Ukraine','https://kyivindependent.com','https://kyivindependent.com/feed/','English','digital','center',84,'Ukrainian English-language news outlet'),
  a('Meduza','Europe','Latvia','https://meduza.io/en','https://meduza.io/rss/en/all','English','digital','center',82,'Independent Russian-language media outlet based in Latvia'),
  a('OBC Transeuropa','Europe','Italy','https://www.balcanicaucaso.org/eng','https://www.balcanicaucaso.org/eng/rss','English','digital','center',80,'Observatory on the Balkans and Caucasus'),
  a('ECFR (European Council on Foreign Relations)','Europe','United Kingdom','https://ecfr.eu','https://ecfr.eu/feed/','English','international','center',90,'Pan-European think tank on foreign policy'),
  a('Chatham House','Europe','United Kingdom','https://www.chathamhouse.org','https://www.chathamhouse.org/rss.xml','English','international','center',92,'Royal Institute of International Affairs'),
  a('IISS (International Institute for Strategic Studies)','Europe','United Kingdom','https://www.iiss.org','https://www.iiss.org/rss','English','international','center',93,'Leading authority on global security and military conflict'),
  a('OSCE','Europe','Austria','https://www.osce.org','https://www.osce.org/feeds/news','English','international','center',90,'World\'s largest security-oriented intergovernmental organization'),
  a('Politico Europe','Europe','Belgium','https://www.politico.eu','https://www.politico.eu/feed/','English','digital','center',88,'European political news and policy coverage'),
  a('EuroActiv','Europe','Belgium','https://www.euractiv.com','https://www.euractiv.com/feed/','English','digital','center',84,'European affairs news and policy platform'),
];

// ─── EAST ASIA ───────────────────────────────────────────────────────────────
const eastAsiaAgencies = [
  a('NHK World Japan','East Asia','Japan','https://www3.nhk.or.jp/nhkworld','https://www3.nhk.or.jp/nhkworld/en/news/feeds/rss.xml','English','broadcast','center',92,'Japan\'s public broadcaster international service'),
  a('Japan Times','East Asia','Japan','https://www.japantimes.co.jp','https://www.japantimes.co.jp/feed/','English','independent','center',88,'Japan\'s largest and oldest English-language newspaper'),
  a('Kyodo News','East Asia','Japan','https://english.kyodonews.net','https://english.kyodonews.net/rss/all.xml','English','wire','center',88,'Japan\'s largest news agency'),
  a('Yonhap News Agency','East Asia','South Korea','https://en.yna.co.kr','https://en.yna.co.kr/RSS/news.xml','English','wire','center',85,'South Korea\'s national news agency'),
  a('Korea Herald','East Asia','South Korea','https://www.koreaherald.com','https://www.koreaherald.com/rss/herald_all.xml','English','independent','center',82,'South Korea\'s largest English-language newspaper'),
  a('South China Morning Post','East Asia','Hong Kong','https://www.scmp.com','https://www.scmp.com/rss/91/feed','English','independent','center',82,'Hong Kong\'s leading English-language newspaper'),
  a('Xinhua News Agency (English)','East Asia','China','https://www.xinhuanet.com/english','https://www.xinhuanet.com/english/rss/worldrss.xml','English','state','state',55,'China\'s official state news agency'),
  a('Focus Taiwan (CNA)','East Asia','Taiwan','https://focustaiwan.tw','https://focustaiwan.tw/rss','English','wire','center',82,'Central News Agency of Taiwan English service'),
  a('Taiwan News','East Asia','Taiwan','https://www.taiwannews.com.tw','https://www.taiwannews.com.tw/en/rss','English','digital','center',78,'Taiwan\'s English-language news outlet'),
  a('Nikkei Asia','East Asia','Japan','https://asia.nikkei.com','https://asia.nikkei.com/rss/feed/nar','English','independent','center',90,'Nikkei\'s English-language Asian business news'),
  a('The Diplomat','East Asia','Japan','https://thediplomat.com','https://thediplomat.com/feed/','English','digital','center',87,'Current affairs magazine for the Asia-Pacific region'),
  a('Asia Times','East Asia','Hong Kong','https://asiatimes.com','https://asiatimes.com/feed/','English','digital','center',78,'Online news publication covering Asia'),
  a('38 North (STIMSON)','East Asia','United States','https://www.38north.org','https://www.38north.org/feed/','English','international','center',90,'Informed analysis of North Korea'),
  a('Korea JoongAng Daily','East Asia','South Korea','https://koreajoongangdaily.joins.com','https://koreajoongangdaily.joins.com/rss/rss.aspx','English','independent','center',83,'South Korean English-language newspaper'),
  a('Global Times (China)','East Asia','China','https://www.globaltimes.cn','https://www.globaltimes.cn/rss/outbrain.xml','English','state','state',45,'Chinese state-affiliated English-language tabloid',true),
];

// ─── ASIA-PACIFIC ────────────────────────────────────────────────────────────
const asiaPacificAgencies = [
  a('ABC Australia','Asia-Pacific','Australia','https://www.abc.net.au/news','https://www.abc.net.au/news/feed/51120/rss.xml','English','broadcast','center',90,'Australian Broadcasting Corporation news'),
  a('Sydney Morning Herald','Asia-Pacific','Australia','https://www.smh.com.au','https://www.smh.com.au/rss/world.xml','English','independent','center',85,'Australian newspaper covering world news'),
  a('The Australian','Asia-Pacific','Australia','https://www.theaustralian.com.au','https://www.theaustralian.com.au/feed','English','independent','center-right',82,'Australian national broadsheet newspaper'),
  a('New Zealand Herald','Asia-Pacific','New Zealand','https://www.nzherald.co.nz','https://www.nzherald.co.nz/arc/outboundfeeds/rss/section/world/','English','independent','center',83,'New Zealand\'s largest newspaper'),
  a('RNZ (Radio New Zealand)','Asia-Pacific','New Zealand','https://www.rnz.co.nz','https://www.rnz.co.nz/rss/world.xml','English','broadcast','center',88,'New Zealand\'s public broadcaster'),
  a('Straits Times','Asia-Pacific','Singapore','https://www.straitstimes.com','https://www.straitstimes.com/news/asia/rss.xml','English','independent','center',85,'Singapore\'s leading English-language newspaper'),
  a('Channel News Asia (CNA)','Asia-Pacific','Singapore','https://www.channelnewsasia.com','https://www.channelnewsasia.com/api/v1/rss-outbound-feed?_format=xml','English','broadcast','center',85,'Singapore-based pan-Asian news channel'),
  a('Jakarta Post','Asia-Pacific','Indonesia','https://www.thejakartapost.com','https://www.thejakartapost.com/feed','English','independent','center',80,'Indonesia\'s leading English-language newspaper'),
  a('Philippine Daily Inquirer','Asia-Pacific','Philippines','https://newsinfo.inquirer.net','https://newsinfo.inquirer.net/feed','English','independent','center',78,'Philippines\' most widely read broadsheet'),
  a('Bangkok Post','Asia-Pacific','Thailand','https://www.bangkokpost.com','https://www.bangkokpost.com/rss/data/topstories.xml','English','independent','center',80,'Thailand\'s leading English-language newspaper'),
  a('Irrawaddy','Asia-Pacific','Thailand','https://www.irrawaddy.com','https://www.irrawaddy.com/feed','English','digital','center',85,'Independent news magazine covering Myanmar and Southeast Asia'),
  a('Myanmar Now','Asia-Pacific','Myanmar','https://myanmar-now.org/en','https://myanmar-now.org/en/feed','English','digital','center',82,'Independent Myanmar news outlet'),
  a('Vietnam News','Asia-Pacific','Vietnam','https://vietnamnews.vn','https://vietnamnews.vn/rss/world.rss','English','state','center',70,'Vietnam\'s state-run English-language newspaper'),
  a('Lowy Institute','Asia-Pacific','Australia','https://www.lowyinstitute.org','https://www.lowyinstitute.org/rss.xml','English','international','center',90,'Australian international policy think tank'),
  a('East Asia Forum','Asia-Pacific','Australia','https://www.eastasiaforum.org','https://www.eastasiaforum.org/feed/','English','international','center',87,'Policy forum on economics, politics and public policy in East Asia'),
];

// ─── SOUTH ASIA ──────────────────────────────────────────────────────────────
const southAsiaAgencies = [
  a('The Hindu','South Asia','India','https://www.thehindu.com','https://www.thehindu.com/news/international/?service=rss','English','independent','center',88,'Indian national newspaper with strong international coverage'),
  a('Times of India','South Asia','India','https://timesofindia.indiatimes.com','https://timesofindia.indiatimes.com/rssfeeds/296589292.cms','English','independent','center',80,'India\'s most widely circulated English-language newspaper'),
  a('Hindustan Times','South Asia','India','https://www.hindustantimes.com','https://www.hindustantimes.com/feeds/rss/world/rssfeed.xml','English','independent','center',80,'Indian English-language daily newspaper'),
  a('NDTV','South Asia','India','https://www.ndtv.com','https://feeds.feedburner.com/ndtvnews-world-news','English','broadcast','center',78,'Indian television news network'),
  a('The Wire (India)','South Asia','India','https://thewire.in','https://thewire.in/feed','English','digital','center-left',82,'Indian independent news and opinion website'),
  a('Dawn (Pakistan)','South Asia','Pakistan','https://www.dawn.com','https://www.dawn.com/feeds/home','English','independent','center',82,'Pakistan\'s oldest and most widely read English-language newspaper'),
  a('The News International (Pakistan)','South Asia','Pakistan','https://www.thenews.com.pk','https://www.thenews.com.pk/rss/1/1','English','independent','center',75,'Pakistani English-language newspaper'),
  a('Daily Star (Bangladesh)','South Asia','Bangladesh','https://www.thedailystar.net','https://www.thedailystar.net/frontpage/rss.xml','English','independent','center',78,'Bangladesh\'s leading English-language newspaper'),
  a('Colombo Gazette','South Asia','Sri Lanka','https://colombogazette.com','https://colombogazette.com/feed/','English','digital','center',72,'Sri Lanka\'s English-language news outlet'),
  a('Kathmandu Post','South Asia','Nepal','https://kathmandupost.com','https://kathmandupost.com/rss','English','independent','center',75,'Nepal\'s leading English-language newspaper'),
  a('TOLOnews','South Asia','Afghanistan','https://tolonews.com','https://tolonews.com/rss.xml','English','broadcast','center',68,'Afghan 24-hour news channel'),
  a('South Asian Monitor','South Asia','India','https://southasianmonitor.com','https://southasianmonitor.com/feed/','English','digital','center',72,'News and analysis on South Asian affairs'),
  a('ORF (Observer Research Foundation)','South Asia','India','https://www.orfonline.org','https://www.orfonline.org/feed/','English','international','center',88,'India\'s premier think tank on international affairs'),
  a('IPCS (Institute of Peace and Conflict Studies)','South Asia','India','https://www.ipcs.org','https://www.ipcs.org/feed/','English','international','center',85,'New Delhi-based think tank on peace and security in Asia'),
  a('The Print (India)','South Asia','India','https://theprint.in','https://theprint.in/feed/','English','digital','center',80,'Indian digital news platform covering politics and security'),
];

// ─── CENTRAL ASIA ────────────────────────────────────────────────────────────
const centralAsiaAgencies = [
  a('RFE/RL Central Asia','Central Asia','Czech Republic','https://www.rferl.org/z/632','https://www.rferl.org/api/ztiqmouuuq','English','broadcast','center',85,'Radio Free Europe/Radio Liberty Central Asia coverage'),
  a('Eurasianet','Central Asia','United States','https://eurasianet.org','https://eurasianet.org/rss.xml','English','digital','center',88,'Independent news and analysis on Central Asia and Caucasus'),
  a('Fergana News','Central Asia','Russia','https://fergana.news/en','https://fergana.news/en/feed/','English','digital','center',75,'Independent news agency covering Central Asia'),
  a('The Astana Times','Central Asia','Kazakhstan','https://astanatimes.com','https://astanatimes.com/feed/','English','state','center',65,'Kazakhstan\'s English-language newspaper'),
  a('Kabar (Kyrgyzstan)','Central Asia','Kyrgyzstan','https://kabar.kg/eng','https://kabar.kg/eng/rss/','English','state','center',62,'Kyrgyzstan\'s national news agency'),
  a('Trend News Agency (Azerbaijan)','Central Asia','Azerbaijan','https://en.trend.az','https://en.trend.az/rss','English','wire','center',68,'Azerbaijani news agency covering the Caucasus and Central Asia'),
  a('Caucasus Watch','Central Asia','Germany','https://caucasuswatch.de','https://caucasuswatch.de/feed/','English','digital','center',80,'News and analysis on the South Caucasus'),
  a('OC Media (Caucasus)','Central Asia','Georgia','https://oc-media.org','https://oc-media.org/feed/','English','digital','center',82,'Independent media outlet covering the South Caucasus'),
  a('CACI Analyst','Central Asia','United States','https://www.cacianalyst.org','https://www.cacianalyst.org/feed/','English','international','center',85,'Central Asia-Caucasus Institute analyst'),
  a('Asia-Plus (Tajikistan)','Central Asia','Tajikistan','https://asiaplustj.info/en','https://asiaplustj.info/en/rss.xml','English','independent','center',65,'Tajikistan\'s independent news agency'),
  a('Uzbekistan National News Agency (UzA)','Central Asia','Uzbekistan','https://uza.uz/en','https://uza.uz/en/rss','English','state','state',60,'Uzbekistan\'s official national news agency'),
  a('Afghanistan Analysts Network','Central Asia','Germany','https://www.afghanistan-analysts.org','https://www.afghanistan-analysts.org/en/feed/','English','international','center',90,'Independent research organisation on Afghanistan'),
  a('Silk Road Reporters','Central Asia','United States','https://www.silkroadreporters.com','https://www.silkroadreporters.com/feed/','English','digital','center',72,'News and analysis on the Silk Road region'),
  a('Caravanserai','Central Asia','United States','https://central.asia-news.com','https://central.asia-news.com/rss.xml','English','digital','center',78,'News and analysis on Central Asia'),
  a('Turkmenportal','Central Asia','Turkmenistan','https://turkmenportal.com/en','https://turkmenportal.com/en/feed','English','state','state',55,'Turkmenistan news portal'),
];

// ─── SUB-SAHARAN AFRICA ──────────────────────────────────────────────────────
const subSaharanAgencies = [
  a('AllAfrica','Sub-Saharan Africa','South Africa','https://allafrica.com','https://allafrica.com/tools/headlines/rdf/latest/headlines.rdf','English','wire','center',78,'Pan-African news aggregator and wire service'),
  a('Africa Report','Sub-Saharan Africa','France','https://www.theafricareport.com','https://www.theafricareport.com/feed/','English','independent','center',82,'Leading pan-African business and political magazine'),
  a('Mail & Guardian (South Africa)','Sub-Saharan Africa','South Africa','https://mg.co.za','https://mg.co.za/feed/','English','independent','center-left',85,'South African investigative newspaper'),
  a('Daily Maverick','Sub-Saharan Africa','South Africa','https://www.dailymaverick.co.za','https://www.dailymaverick.co.za/feed/','English','digital','center',88,'South African investigative news outlet'),
  a('News24 (South Africa)','Sub-Saharan Africa','South Africa','https://www.news24.com','https://feeds.news24.com/articles/news24/TopStories/rss','English','digital','center',80,'South Africa\'s leading online news platform'),
  a('The East African','Sub-Saharan Africa','Kenya','https://www.theeastafrican.co.ke','https://www.theeastafrican.co.ke/feed','English','independent','center',80,'Regional newspaper covering East Africa'),
  a('Nation Africa','Sub-Saharan Africa','Kenya','https://nation.africa','https://nation.africa/kenya/rss.xml','English','independent','center',78,'Kenya\'s leading media house'),
  a('The Monitor (Uganda)','Sub-Saharan Africa','Uganda','https://www.monitor.co.ug','https://www.monitor.co.ug/feed','English','independent','center',75,'Uganda\'s leading independent newspaper'),
  a('Premium Times (Nigeria)','Sub-Saharan Africa','Nigeria','https://www.premiumtimesng.com','https://www.premiumtimesng.com/feed','English','digital','center',80,'Nigerian investigative news outlet'),
  a('Punch Nigeria','Sub-Saharan Africa','Nigeria','https://punchng.com','https://punchng.com/feed/','English','independent','center',75,'Nigeria\'s most widely read newspaper'),
  a('Ghana Web','Sub-Saharan Africa','Ghana','https://www.ghanaweb.com','https://www.ghanaweb.com/GhanaHomePage/NewsArchive/rss.xml','English','digital','center',70,'Ghana\'s leading online news portal'),
  a('Africa Confidential','Sub-Saharan Africa','United Kingdom','https://www.africa-confidential.com','https://www.africa-confidential.com/rss','English','independent','center',88,'Authoritative newsletter on African politics and business'),
  a('ISS Africa (Institute for Security Studies)','Sub-Saharan Africa','South Africa','https://issafrica.org','https://issafrica.org/feed','English','international','center',90,'African human security research organisation'),
  a('African Arguments','Sub-Saharan Africa','United Kingdom','https://africanarguments.org','https://africanarguments.org/feed/','English','digital','center',82,'Pan-African platform for analysis and debate'),
  a('The Citizen (Tanzania)','Sub-Saharan Africa','Tanzania','https://www.thecitizen.co.tz','https://www.thecitizen.co.tz/feed','English','independent','center',72,'Tanzania\'s English-language newspaper'),
  a('ACLED Africa','Sub-Saharan Africa','United States','https://acleddata.com/africa/','https://acleddata.com/feed/','English','international','center',95,'Armed Conflict Location & Event Data Africa coverage'),
  a('Sahel Research Group','Sub-Saharan Africa','United States','https://sahelresearch.africa.ufl.edu','https://sahelresearch.africa.ufl.edu/feed/','English','international','center',85,'Research on the Sahel region security and development'),
];

// ─── NORTH AFRICA ────────────────────────────────────────────────────────────
const northAfricaAgencies = [
  a('Ahram Online (Egypt)','North Africa','Egypt','https://english.ahram.org.eg','https://english.ahram.org.eg/RSSFeedService/News/0.aspx','English','state','center',72,'Egypt\'s state-owned newspaper English edition'),
  a('Egypt Independent','North Africa','Egypt','https://egyptindependent.com','https://egyptindependent.com/feed/','English','digital','center',75,'Egyptian independent English-language news outlet'),
  a('Mada Masr','North Africa','Egypt','https://www.madamasr.com/en','https://www.madamasr.com/en/feed/','English','digital','center-left',85,'Egyptian independent investigative news outlet'),
  a('Morocco World News','North Africa','Morocco','https://www.moroccoworldnews.com','https://www.moroccoworldnews.com/feed/','English','digital','center',72,'Moroccan English-language news outlet'),
  a('Sudan Tribune','North Africa','France','https://sudantribune.com','https://sudantribune.com/feed/','English','digital','center',72,'Independent news outlet covering Sudan'),
  a('Radio Dabanga (Sudan)','North Africa','Netherlands','https://www.dabangasudan.org/en','https://www.dabangasudan.org/en/all-news/rss','English','broadcast','center',80,'Independent radio and news for Sudan'),
  a('North Africa Post','North Africa','Morocco','https://northafricapost.com','https://northafricapost.com/feed/','English','digital','center',68,'News and analysis on North Africa'),
  a('Jeune Afrique (English)','North Africa','France','https://www.jeuneafrique.com/en','https://www.jeuneafrique.com/en/feed/','English','independent','center',80,'Pan-African magazine covering North and Sub-Saharan Africa'),
  a('Al Jazeera Africa','North Africa','Qatar','https://www.aljazeera.com/africa','https://www.aljazeera.com/xml/rss/all.xml','English','broadcast','center-left',85,'Al Jazeera Africa coverage'),
  a('Tunisia Live','North Africa','Tunisia','https://www.tunisia-live.net','https://www.tunisia-live.net/feed/','English','digital','center',70,'Tunisian English-language news outlet'),
  a('Libya Herald','North Africa','Libya','https://www.libyaherald.com','https://www.libyaherald.com/feed/','English','digital','center',68,'Libya\'s English-language newspaper'),
  a('The Libya Observer','North Africa','Libya','https://www.libyaobserver.ly','https://www.libyaobserver.ly/feed','English','digital','center',68,'Libyan English-language news outlet'),
];

// ─── AMERICAS ────────────────────────────────────────────────────────────────
const americasAgencies = [
  a('Reuters Americas','Americas','United States','https://www.reuters.com/world/americas','https://feeds.reuters.com/reuters/americasnews','English','wire','center',97,'Reuters Americas news wire service'),
  a('AP Americas','Americas','United States','https://apnews.com/hub/americas','https://feeds.apnews.com/rss/apf-latam','English','wire','center',96,'Associated Press Americas coverage'),
  a('New York Times Americas','Americas','United States','https://www.nytimes.com/section/world/americas','https://rss.nytimes.com/services/xml/rss/nyt/Americas.xml','English','independent','center-left',90,'NYT Americas coverage'),
  a('Washington Post Americas','Americas','United States','https://www.washingtonpost.com/world/the-americas','https://feeds.washingtonpost.com/rss/world/americas','English','independent','center-left',89,'Washington Post Americas coverage'),
  a('Miami Herald','Americas','United States','https://www.miamiherald.com','https://www.miamiherald.com/latest-news/?widgetName=rssfeed&widgetContentId=712015&getXmlFeed=true','English','independent','center',82,'Florida newspaper with strong Latin America coverage'),
  a('Globe and Mail (Canada)','Americas','Canada','https://www.theglobeandmail.com','https://www.theglobeandmail.com/arc/outboundfeeds/rss/category/world/','English','independent','center',85,'Canada\'s national newspaper'),
  a('CBC News (Canada)','Americas','Canada','https://www.cbc.ca/news/world','https://www.cbc.ca/cmlink/rss-world','English','broadcast','center',88,'Canadian Broadcasting Corporation world news'),
  a('Americas Quarterly','Americas','United States','https://www.americasquarterly.org','https://www.americasquarterly.org/feed/','English','digital','center',85,'Policy, politics, and business in the Americas'),
  a('InSight Crime','Americas','Colombia','https://insightcrime.org','https://insightcrime.org/feed/','English','digital','center',88,'Investigation and analysis of organized crime in the Americas'),
  a('WOLA (Washington Office on Latin America)','Americas','United States','https://www.wola.org','https://www.wola.org/feed/','English','international','center-left',85,'Human rights advocacy and research on Latin America'),
  a('NACLA','Americas','United States','https://nacla.org','https://nacla.org/feed','English','international','center-left',80,'Independent research on Latin America and the Caribbean'),
  a('Council on Hemispheric Affairs (COHA)','Americas','United States','https://www.coha.org','https://www.coha.org/feed/','English','international','center',78,'Research and information on Western Hemisphere affairs'),
  a('Mercopress','Americas','Uruguay','https://en.mercopress.com','https://en.mercopress.com/rss','English','wire','center',78,'South Atlantic news agency covering Mercosur countries'),
  a('Latin American Herald Tribune','Americas','Venezuela','https://www.laht.com','https://www.laht.com/rss-feed.asp','English','digital','center',72,'English-language news from Latin America'),
  a('Telesur English','Americas','Venezuela','https://www.telesurenglish.net','https://www.telesurenglish.net/rss/news.xml','English','state','state',45,'Venezuelan state-funded pan-Latin American broadcaster',true),
];

// ─── LATIN AMERICA ───────────────────────────────────────────────────────────
const latinAmericaAgencies = [
  a('Reuters Latin America','Latin America','United States','https://www.reuters.com/world/americas','https://feeds.reuters.com/reuters/americasnews','English','wire','center',97,'Reuters Latin America news wire'),
  a('AP Latin America','Latin America','United States','https://apnews.com/hub/latin-america','https://feeds.apnews.com/rss/apf-latam','English','wire','center',96,'AP Latin America coverage'),
  a('El País (English)','Latin America','Spain','https://english.elpais.com','https://feeds.elpais.com/mrss-s/pages/ep/site/english.elpais.com/portada','English','independent','center-left',88,'Spanish newspaper with strong Latin America coverage'),
  a('Folha de S.Paulo','Latin America','Brazil','https://www1.folha.uol.com.br/internacional/en','https://feeds.folha.uol.com.br/emcimadahora/rss091.xml','Portuguese','independent','center',82,'Brazil\'s largest newspaper'),
  a('La Nación (Argentina)','Latin America','Argentina','https://www.lanacion.com.ar','https://www.lanacion.com.ar/arc/outboundfeeds/rss/','Spanish','independent','center-right',80,'Argentina\'s leading newspaper'),
  a('El Comercio (Peru)','Latin America','Peru','https://elcomercio.pe','https://elcomercio.pe/arcio/rss/','Spanish','independent','center',78,'Peru\'s oldest and most widely read newspaper'),
  a('El Tiempo (Colombia)','Latin America','Colombia','https://www.eltiempo.com','https://www.eltiempo.com/rss/mundo.xml','Spanish','independent','center',78,'Colombia\'s leading newspaper'),
  a('InSight Crime Latin America','Latin America','Colombia','https://insightcrime.org','https://insightcrime.org/feed/','English','digital','center',88,'Investigation and analysis of organized crime in Latin America'),
  a('CEPAL (UN ECLAC)','Latin America','Chile','https://www.cepal.org/en','https://www.cepal.org/en/rss.xml','English','international','center',90,'UN body for economic and social development in Latin America'),
  a('Dialogo Americas','Latin America','United States','https://dialogo-americas.com','https://dialogo-americas.com/feed/','English','digital','center',75,'News on Latin America security affairs'),
  a('Venezuela Analysis','Latin America','Venezuela','https://venezuelanalysis.com','https://venezuelanalysis.com/feed','English','digital','center-left',68,'News and analysis on Venezuela'),
  a('Agencia EFE (English)','Latin America','Spain','https://www.efe.com/efe/english','https://www.efe.com/efe/english/rss','English','wire','center',85,'Spanish international news agency with strong Latin America coverage'),
  a('Prensa Latina','Latin America','Cuba','https://www.plenglish.com','https://www.plenglish.com/rss.xml','English','state','state',45,'Cuban state news agency',true),
  a('Mercopress Latin America','Latin America','Uruguay','https://en.mercopress.com','https://en.mercopress.com/rss','English','wire','center',78,'South Atlantic news agency covering Mercosur countries'),
  a('Americas Quarterly Latin America','Latin America','United States','https://www.americasquarterly.org','https://www.americasquarterly.org/feed/','English','digital','center',85,'Policy, politics, and business in Latin America'),
];

console.log('Starting 10x agency seed...');

const allBatches = [
  { label: 'Global (30)', data: globalAgencies },
  { label: 'MENA (15)', data: menaAgencies },
  { label: 'Europe (20)', data: europeAgencies },
  { label: 'East Asia (15)', data: eastAsiaAgencies },
  { label: 'Asia-Pacific (15)', data: asiaPacificAgencies },
  { label: 'South Asia (15)', data: southAsiaAgencies },
  { label: 'Central Asia (15)', data: centralAsiaAgencies },
  { label: 'Sub-Saharan Africa (17)', data: subSaharanAgencies },
  { label: 'North Africa (12)', data: northAfricaAgencies },
  { label: 'Americas (15)', data: americasAgencies },
  { label: 'Latin America (15)', data: latinAmericaAgencies },
];

let totalInserted = 0, totalSkipped = 0;
for (const batch of allBatches) {
  const { inserted, skipped } = await ins(batch.data);
  totalInserted += inserted;
  totalSkipped += skipped;
  console.log(`  ✓ ${batch.label}: +${inserted} new, ${skipped} already exist`);
}

console.log(`\nDone! Total: +${totalInserted} new agencies, ${totalSkipped} already existed`);

const [rows] = await conn.execute('SELECT region, COUNT(*) as cnt FROM news_agencies GROUP BY region ORDER BY cnt DESC');
console.log('\nFinal agency counts per region:');
for (const row of rows) {
  console.log(`  ${row.region}: ${row.cnt}`);
}

await conn.end();
