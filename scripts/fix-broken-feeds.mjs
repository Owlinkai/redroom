/**
 * fix-broken-feeds.mjs
 * 
 * Updates news agencies with broken/missing RSS feeds to verified working alternatives.
 * rssFeeds column is a JSON array of URL strings.
 */

import { createConnection } from 'mysql2/promise';
import { config } from 'dotenv';
config();

// Verified working RSS feeds for countries with 0 articles
const WORKING_FEEDS = {
  // European countries
  'Estonia': { name: 'ERR News', feeds: ['https://err.ee/rss'], website: 'https://err.ee' },
  'Latvia': { name: 'LSM.lv English', feeds: ['https://eng.lsm.lv/rss/'], website: 'https://eng.lsm.lv' },
  'Lithuania': { name: 'LRT English', feeds: ['https://www.lrt.lt/rss/en'], website: 'https://www.lrt.lt/en' },
  'Moldova': { name: 'Moldova.org', feeds: ['https://www.moldova.org/en/feed/'], website: 'https://www.moldova.org/en' },
  'Belgium': { name: 'The Brussels Times', feeds: ['https://www.brusselstimes.com/feed'], website: 'https://www.brusselstimes.com' },
  'Austria': { name: 'Austria Today', feeds: ['https://www.austriatoday.at/feed/'], website: 'https://www.austriatoday.at' },
  'Slovakia': { name: 'Slovak Spectator', feeds: ['https://spectator.sme.sk/rss/rssfeed.php'], website: 'https://spectator.sme.sk' },
  'Croatia': { name: 'Total Croatia News', feeds: ['https://www.total-croatia-news.com/feed'], website: 'https://www.total-croatia-news.com' },
  'Slovenia': { name: 'Slovenia Times', feeds: ['https://sloveniatimes.com/feed'], website: 'https://sloveniatimes.com' },
  'Serbia': { name: 'N1 Serbia English', feeds: ['https://n1info.rs/feed/'], website: 'https://n1info.rs' },
  'Bosnia': { name: 'Sarajevo Times', feeds: ['https://sarajevotimes.com/feed/'], website: 'https://sarajevotimes.com' },
  'Montenegro': { name: 'Vijesti English', feeds: ['https://en.vijesti.me/rss'], website: 'https://en.vijesti.me' },
  'Albania': { name: 'Exit News Albania', feeds: ['https://exit.al/en/feed/'], website: 'https://exit.al/en' },
  'Kosovo': { name: 'Kosovo Online', feeds: ['https://www.kosovoonline.com/rss'], website: 'https://www.kosovoonline.com' },
  'North Macedonia': { name: 'MIA News Agency', feeds: ['https://mia.mk/en/rss'], website: 'https://mia.mk/en' },
  'Luxembourg': { name: 'Luxembourg Times', feeds: ['https://www.luxtimes.lu/rss.xml'], website: 'https://www.luxtimes.lu' },
  'Portugal': { name: 'Portugal News', feeds: ['https://www.theportugalnews.com/rss'], website: 'https://www.theportugalnews.com' },
  'Denmark': { name: 'The Local Denmark', feeds: ['https://www.thelocal.dk/feed'], website: 'https://www.thelocal.dk' },
  'Finland': { name: 'YLE News', feeds: ['https://feeds.yle.fi/uutiset/v1/recent.rss?publisherIds=YLE_NEWS'], website: 'https://yle.fi/uutiset' },
  'Norway': { name: 'The Local Norway', feeds: ['https://www.thelocal.no/feed'], website: 'https://www.thelocal.no' },
  'Sweden': { name: 'The Local Sweden', feeds: ['https://www.thelocal.se/feed'], website: 'https://www.thelocal.se' },

  // Africa
  'Tunisia': { name: 'Tunis Afrique Presse', feeds: ['https://www.tap.info.tn/en/rss'], website: 'https://www.tap.info.tn/en' },
  'Djibouti': { name: 'Agence Djiboutienne d\'Information', feeds: ['https://www.adi.dj/feed/'], website: 'https://www.adi.dj' },
  'Tanzania': { name: 'The Citizen Tanzania', feeds: ['https://www.thecitizen.co.tz/feed'], website: 'https://www.thecitizen.co.tz' },
  "Côte d'Ivoire": { name: 'AIP Côte d\'Ivoire', feeds: ['https://www.aip.ci/feed/'], website: 'https://www.aip.ci' },
  'Democratic Republic of the Congo': { name: 'Radio Okapi', feeds: ['https://www.radiookapi.net/feed'], website: 'https://www.radiookapi.net' },
  'Central African Republic': { name: 'RJDH CAR', feeds: ['https://www.rjdh.org/feed/'], website: 'https://www.rjdh.org' },
  'Guinea': { name: 'Guinée News', feeds: ['https://guineenews.org/feed/'], website: 'https://guineenews.org' },
  'Madagascar': { name: 'Madagascar Tribune', feeds: ['https://www.madagascar-tribune.com/feed'], website: 'https://www.madagascar-tribune.com' },
  'Cameroon': { name: 'Cameroon Tribune', feeds: ['https://www.cameroon-tribune.cm/rss.xml'], website: 'https://www.cameroon-tribune.cm' },
  'Cape Verde': { name: 'Inforpress', feeds: ['https://www.inforpress.cv/feed/'], website: 'https://www.inforpress.cv' },
  'Senegal': { name: 'APS Sénégal', feeds: ['https://www.aps.sn/rss'], website: 'https://www.aps.sn' },
  'Ghana': { name: 'Ghana Web', feeds: ['https://www.ghanaweb.com/GhanaHomePage/rss/news.xml'], website: 'https://www.ghanaweb.com' },
  'Zambia': { name: 'Lusaka Times', feeds: ['https://www.lusakatimes.com/feed/'], website: 'https://www.lusakatimes.com' },
  'Liberia': { name: 'Front Page Africa', feeds: ['https://frontpageafricaonline.com/feed/'], website: 'https://frontpageafricaonline.com' },
  'Gabon': { name: 'Gabon Review', feeds: ['https://www.gabonreview.com/feed/'], website: 'https://www.gabonreview.com' },

  // Asia-Pacific
  'Sri Lanka': { name: 'Daily Mirror Sri Lanka', feeds: ['https://www.dailymirror.lk/rss'], website: 'https://www.dailymirror.lk' },
  'Laos': { name: 'Vientiane Times', feeds: ['https://www.vientianetimes.org.la/rss.xml'], website: 'https://www.vientianetimes.org.la' },
  'Brunei': { name: 'Borneo Bulletin', feeds: ['https://borneobulletin.com.bn/feed/'], website: 'https://borneobulletin.com.bn' },
  'Taiwan': { name: 'Taiwan News', feeds: ['https://www.taiwannews.com.tw/rss'], website: 'https://www.taiwannews.com.tw' },
  'Azerbaijan': { name: 'AzerNews', feeds: ['https://www.azernews.az/rss/all.rss'], website: 'https://www.azernews.az' },
  'Kyrgyzstan': { name: 'Kabar News Agency', feeds: ['https://kabar.kg/rss/'], website: 'https://kabar.kg' },
  'Tajikistan': { name: 'Asia-Plus', feeds: ['https://asiaplustj.info/en/rss'], website: 'https://asiaplustj.info/en' },
  'Turkmenistan': { name: 'Turkmenistan.ru', feeds: ['https://www.turkmenistan.ru/rss.xml'], website: 'https://www.turkmenistan.ru' },
  'Mongolia': { name: 'Montsame', feeds: ['https://montsame.mn/en/rss'], website: 'https://montsame.mn/en' },
  'Cambodia': { name: 'Khmer Times', feeds: ['https://www.khmertimeskh.com/feed/'], website: 'https://www.khmertimeskh.com' },
  'Myanmar': { name: 'Myanmar Now', feeds: ['https://myanmar-now.org/en/feed/'], website: 'https://myanmar-now.org/en' },

  // Americas
  'Guatemala': { name: 'Prensa Libre', feeds: ['https://www.prensalibre.com/feed/'], website: 'https://www.prensalibre.com' },
  'Chile': { name: 'El Mostrador', feeds: ['https://www.elmostrador.cl/feed/'], website: 'https://www.elmostrador.cl' },
  'Dominican Republic': { name: 'Listín Diario', feeds: ['https://listindiario.com/rss'], website: 'https://listindiario.com' },
  'El Salvador': { name: 'El Faro', feeds: ['https://elfaro.net/rss'], website: 'https://elfaro.net' },
  'Suriname': { name: 'Starnieuws', feeds: ['https://www.starnieuws.com/rss.xml'], website: 'https://www.starnieuws.com' },
  'Barbados': { name: 'Barbados Today', feeds: ['https://barbadostoday.bb/feed/'], website: 'https://barbadostoday.bb' },
  'Trinidad and Tobago': { name: 'Trinidad Express', feeds: ['https://trinidadexpress.com/feed/'], website: 'https://trinidadexpress.com' },
  'Jamaica': { name: 'Jamaica Gleaner', feeds: ['https://jamaica-gleaner.com/feed/'], website: 'https://jamaica-gleaner.com' },
  'Haiti': { name: 'Le Nouvelliste', feeds: ['https://lenouvelliste.com/rss.xml'], website: 'https://lenouvelliste.com' },
  'Nicaragua': { name: 'Confidencial Nicaragua', feeds: ['https://confidencial.digital/feed/'], website: 'https://confidencial.digital' },
  'Honduras': { name: 'El Heraldo Honduras', feeds: ['https://www.elheraldo.hn/feed/'], website: 'https://www.elheraldo.hn' },
  'Costa Rica': { name: 'Tico Times', feeds: ['https://ticotimes.net/feed'], website: 'https://ticotimes.net' },
  'Panama': { name: 'La Estrella de Panamá', feeds: ['https://www.laestrella.com.pa/rss'], website: 'https://www.laestrella.com.pa' },
  'Bolivia': { name: 'Los Tiempos', feeds: ['https://www.lostiempos.com/rss.xml'], website: 'https://www.lostiempos.com' },
  'Paraguay': { name: 'ABC Color', feeds: ['https://www.abc.com.py/rss.xml'], website: 'https://www.abc.com.py' },
  'Uruguay': { name: 'El País Uruguay', feeds: ['https://www.elpais.com.uy/rss.xml'], website: 'https://www.elpais.com.uy' },
  'Ecuador': { name: 'El Universo', feeds: ['https://www.eluniverso.com/rss.xml'], website: 'https://www.eluniverso.com' },
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

  for (const [country, feed] of Object.entries(WORKING_FEEDS)) {
    const feedsJson = JSON.stringify(feed.feeds);

    // Find existing agency for this country
    const [rows] = await conn.execute(
      'SELECT id, name, rssFeeds FROM news_agencies WHERE country = ? LIMIT 1',
      [country]
    );

    if (rows.length === 0) {
      // Insert new agency
      await conn.execute(
        `INSERT INTO news_agencies (name, country, website, rssFeeds, language, type, isActive, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, 'en', 'independent', 1, NOW(), NOW())`,
        [feed.name, country, feed.website, feedsJson]
      );
      console.log(`✅ Inserted: ${country} → ${feed.name}`);
      inserted++;
    } else {
      // Update existing agency's RSS feeds
      await conn.execute(
        'UPDATE news_agencies SET rssFeeds = ?, name = ?, website = ?, isActive = 1, updatedAt = NOW() WHERE country = ?',
        [feedsJson, feed.name, feed.website, country]
      );
      console.log(`🔄 Updated: ${country} → ${feed.feeds[0]}`);
      updated++;
    }
  }

  console.log(`\n✅ Done: ${updated} updated, ${inserted} inserted`);
  await conn.end();
}

main().catch(console.error);
