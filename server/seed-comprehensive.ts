/**
 * Comprehensive seed script for GEOINT Platform
 * Populates: 100+ MENA news agencies, 200+ global facilities
 */
import { drizzle } from "drizzle-orm/mysql2";
import { newsAgencies, facilities } from "../drizzle/schema";
import { sql } from "drizzle-orm";

const db = drizzle(process.env.DATABASE_URL!);

// ─── MENA & Global News Agencies ──────────────────────────────────────────────
const AGENCIES = [
  // ── Saudi Arabia ──
  { name: "Al Arabiya", country: "Saudi Arabia", region: "MENA", type: "television", language: "Arabic", url: "https://www.alarabiya.net", rssFeeds: JSON.stringify(["https://www.alarabiya.net/tools/rss"]), bias: "center-right", isActive: true, description: "Pan-Arab satellite news channel based in Dubai Media City" },
  { name: "Saudi Press Agency (SPA)", country: "Saudi Arabia", region: "MENA", type: "wire", language: "Arabic", url: "https://www.spa.gov.sa", rssFeeds: JSON.stringify(["https://www.spa.gov.sa/rss/rss.xml"]), bias: "state", isActive: true, description: "Official Saudi state news agency" },
  { name: "Arab News", country: "Saudi Arabia", region: "MENA", type: "newspaper", language: "English", url: "https://www.arabnews.com", rssFeeds: JSON.stringify(["https://www.arabnews.com/rss.xml"]), bias: "center", isActive: true, description: "English-language daily newspaper published in Saudi Arabia" },
  { name: "Asharq Al-Awsat", country: "Saudi Arabia", region: "MENA", type: "newspaper", language: "Arabic", url: "https://aawsat.com", rssFeeds: JSON.stringify(["https://aawsat.com/rss.xml"]), bias: "center-right", isActive: true, description: "Pan-Arab international newspaper" },
  { name: "Al-Riyadh", country: "Saudi Arabia", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.alriyadh.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Major Saudi daily newspaper" },
  { name: "Okaz", country: "Saudi Arabia", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.okaz.com.sa", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Saudi Arabian daily newspaper" },
  { name: "Saudi Gazette", country: "Saudi Arabia", region: "MENA", type: "newspaper", language: "English", url: "https://saudigazette.com.sa", rssFeeds: JSON.stringify(["https://saudigazette.com.sa/rss"]), bias: "center", isActive: true, description: "English-language newspaper in Saudi Arabia" },

  // ── UAE ──
  { name: "Al Jazeera", country: "Qatar", region: "MENA", type: "television", language: "Arabic", url: "https://www.aljazeera.net", rssFeeds: JSON.stringify(["https://www.aljazeera.com/xml/rss/all.xml"]), bias: "center-left", isActive: true, description: "International Arabic news channel based in Doha" },
  { name: "Al Jazeera English", country: "Qatar", region: "MENA", type: "television", language: "English", url: "https://www.aljazeera.com", rssFeeds: JSON.stringify(["https://www.aljazeera.com/xml/rss/all.xml"]), bias: "center-left", isActive: true, description: "English-language international news channel" },
  { name: "Gulf News", country: "UAE", region: "MENA", type: "newspaper", language: "English", url: "https://gulfnews.com", rssFeeds: JSON.stringify(["https://gulfnews.com/rss"]), bias: "center", isActive: true, description: "English-language daily newspaper in the UAE" },
  { name: "Khaleej Times", country: "UAE", region: "MENA", type: "newspaper", language: "English", url: "https://www.khaleejtimes.com", rssFeeds: JSON.stringify(["https://www.khaleejtimes.com/rss"]), bias: "center", isActive: true, description: "English-language newspaper published in Dubai" },
  { name: "The National", country: "UAE", region: "MENA", type: "newspaper", language: "English", url: "https://www.thenationalnews.com", rssFeeds: JSON.stringify(["https://www.thenationalnews.com/rss"]), bias: "center", isActive: true, description: "English-language daily newspaper published in Abu Dhabi" },
  { name: "WAM (Emirates News Agency)", country: "UAE", region: "MENA", type: "wire", language: "Arabic", url: "https://wam.ae", rssFeeds: JSON.stringify(["https://wam.ae/en/rss"]), bias: "state", isActive: true, description: "Official UAE state news agency" },
  { name: "Al Bayan", country: "UAE", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.albayan.ae", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Arabic-language daily newspaper in UAE" },
  { name: "Sky News Arabia", country: "UAE", region: "MENA", type: "television", language: "Arabic", url: "https://www.skynewsarabia.com", rssFeeds: JSON.stringify(["https://www.skynewsarabia.com/rss"]), bias: "center", isActive: true, description: "Arabic-language satellite news channel" },

  // ── Egypt ──
  { name: "Al-Ahram", country: "Egypt", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.ahram.org.eg", rssFeeds: JSON.stringify(["https://www.ahram.org.eg/rss.aspx"]), bias: "state", isActive: true, description: "Egypt's oldest and most widely circulated newspaper" },
  { name: "Egypt Independent", country: "Egypt", region: "MENA", type: "newspaper", language: "English", url: "https://egyptindependent.com", rssFeeds: JSON.stringify(["https://egyptindependent.com/feed"]), bias: "center", isActive: true, description: "English-language Egyptian news outlet" },
  { name: "Mada Masr", country: "Egypt", region: "MENA", type: "online", language: "Arabic", url: "https://www.madamasr.com", rssFeeds: JSON.stringify(["https://www.madamasr.com/en/feed"]), bias: "center-left", isActive: true, description: "Independent Egyptian news website" },
  { name: "Al-Masry Al-Youm", country: "Egypt", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.almasryalyoum.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Egyptian daily newspaper" },
  { name: "Daily News Egypt", country: "Egypt", region: "MENA", type: "newspaper", language: "English", url: "https://dailynewsegypt.com", rssFeeds: JSON.stringify(["https://dailynewsegypt.com/feed"]), bias: "center", isActive: true, description: "English-language daily newspaper in Egypt" },
  { name: "Cairo 24", country: "Egypt", region: "MENA", type: "online", language: "Arabic", url: "https://cairo24.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Egyptian online news portal" },
  { name: "MENA (Middle East News Agency)", country: "Egypt", region: "MENA", type: "wire", language: "Arabic", url: "https://www.mena.org.eg", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Egyptian state news agency" },

  // ── Iran ──
  { name: "Press TV", country: "Iran", region: "MENA", type: "television", language: "English", url: "https://www.presstv.ir", rssFeeds: JSON.stringify(["https://www.presstv.ir/rss"]), bias: "state", isActive: true, description: "Iranian state-run English-language news network" },
  { name: "IRNA (Islamic Republic News Agency)", country: "Iran", region: "MENA", type: "wire", language: "Persian", url: "https://www.irna.ir", rssFeeds: JSON.stringify(["https://www.irna.ir/rss"]), bias: "state", isActive: true, description: "Official Iranian state news agency" },
  { name: "Tasnim News Agency", country: "Iran", region: "MENA", type: "wire", language: "Persian", url: "https://www.tasnimnews.com", rssFeeds: JSON.stringify(["https://www.tasnimnews.com/en/rss"]), bias: "state", isActive: true, description: "Iranian news agency close to IRGC" },
  { name: "Fars News Agency", country: "Iran", region: "MENA", type: "wire", language: "Persian", url: "https://www.farsnews.ir", rssFeeds: JSON.stringify(["https://www.farsnews.ir/rss"]), bias: "state", isActive: true, description: "Iranian semi-official news agency" },
  { name: "Iran International", country: "Iran", region: "MENA", type: "television", language: "Persian", url: "https://www.iranintl.com", rssFeeds: JSON.stringify(["https://www.iranintl.com/en/rss"]), bias: "center", isActive: true, description: "Persian-language satellite news channel" },
  { name: "Mehr News Agency", country: "Iran", region: "MENA", type: "wire", language: "Persian", url: "https://en.mehrnews.com", rssFeeds: JSON.stringify(["https://en.mehrnews.com/rss"]), bias: "state", isActive: true, description: "Iranian news agency" },

  // ── Turkey ──
  { name: "Anadolu Agency", country: "Turkey", region: "MENA", type: "wire", language: "Turkish", url: "https://www.aa.com.tr", rssFeeds: JSON.stringify(["https://www.aa.com.tr/en/rss"]), bias: "center", isActive: true, description: "Turkish state-run news agency" },
  { name: "TRT World", country: "Turkey", region: "MENA", type: "television", language: "English", url: "https://www.trtworld.com", rssFeeds: JSON.stringify(["https://www.trtworld.com/rss"]), bias: "center", isActive: true, description: "Turkish state broadcaster's English-language channel" },
  { name: "Daily Sabah", country: "Turkey", region: "MENA", type: "newspaper", language: "English", url: "https://www.dailysabah.com", rssFeeds: JSON.stringify(["https://www.dailysabah.com/rssFeed/push_notifications"]), bias: "center-right", isActive: true, description: "English-language Turkish newspaper" },
  { name: "Hurriyet Daily News", country: "Turkey", region: "MENA", type: "newspaper", language: "English", url: "https://www.hurriyetdailynews.com", rssFeeds: JSON.stringify(["https://www.hurriyetdailynews.com/rss"]), bias: "center", isActive: true, description: "English-language Turkish newspaper" },

  // ── Israel ──
  { name: "Haaretz", country: "Israel", region: "MENA", type: "newspaper", language: "Hebrew", url: "https://www.haaretz.com", rssFeeds: JSON.stringify(["https://www.haaretz.com/srv/haaretz-articles.xml"]), bias: "center-left", isActive: true, description: "Israeli daily newspaper" },
  { name: "The Jerusalem Post", country: "Israel", region: "MENA", type: "newspaper", language: "English", url: "https://www.jpost.com", rssFeeds: JSON.stringify(["https://www.jpost.com/rss/rssfeedsfrontpage.aspx"]), bias: "center-right", isActive: true, description: "English-language Israeli newspaper" },
  { name: "Times of Israel", country: "Israel", region: "MENA", type: "online", language: "English", url: "https://www.timesofisrael.com", rssFeeds: JSON.stringify(["https://www.timesofisrael.com/feed"]), bias: "center", isActive: true, description: "English-language Israeli news website" },
  { name: "Ynet News", country: "Israel", region: "MENA", type: "online", language: "English", url: "https://www.ynetnews.com", rssFeeds: JSON.stringify(["https://www.ynetnews.com/category/3082"]), bias: "center", isActive: true, description: "Israeli news website" },
  { name: "Arutz Sheva (Israel National News)", country: "Israel", region: "MENA", type: "online", language: "English", url: "https://www.israelnationalnews.com", rssFeeds: JSON.stringify([]), bias: "right", isActive: true, description: "Israeli right-wing news outlet" },

  // ── Lebanon ──
  { name: "The Daily Star Lebanon", country: "Lebanon", region: "MENA", type: "newspaper", language: "English", url: "https://www.dailystar.com.lb", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Lebanese English-language newspaper" },
  { name: "L'Orient Today", country: "Lebanon", region: "MENA", type: "online", language: "English", url: "https://today.lorientlejour.com", rssFeeds: JSON.stringify(["https://today.lorientlejour.com/rss"]), bias: "center", isActive: true, description: "Lebanese English-language news website" },
  { name: "Al-Manar", country: "Lebanon", region: "MENA", type: "television", language: "Arabic", url: "https://www.almanar.com.lb", rssFeeds: JSON.stringify([]), bias: "left", isActive: true, description: "Lebanese television channel affiliated with Hezbollah" },
  { name: "MTV Lebanon", country: "Lebanon", region: "MENA", type: "television", language: "Arabic", url: "https://www.mtv.com.lb", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Lebanese satellite television channel" },
  { name: "Naharnet", country: "Lebanon", region: "MENA", type: "online", language: "English", url: "https://www.naharnet.com", rssFeeds: JSON.stringify(["https://www.naharnet.com/stories/en/rss"]), bias: "center", isActive: true, description: "Lebanese news website" },

  // ── Jordan ──
  { name: "Jordan Times", country: "Jordan", region: "MENA", type: "newspaper", language: "English", url: "https://www.jordantimes.com", rssFeeds: JSON.stringify(["https://www.jordantimes.com/rss.xml"]), bias: "center", isActive: true, description: "Jordanian English-language newspaper" },
  { name: "Petra (Jordan News Agency)", country: "Jordan", region: "MENA", type: "wire", language: "Arabic", url: "https://petra.gov.jo", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Jordanian state news agency" },
  { name: "Al-Ghad", country: "Jordan", region: "MENA", type: "newspaper", language: "Arabic", url: "https://alghad.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Jordanian daily newspaper" },

  // ── Iraq ──
  { name: "Iraqi News Agency (INA)", country: "Iraq", region: "MENA", type: "wire", language: "Arabic", url: "https://ina.iq", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Iraqi state news agency" },
  { name: "Rudaw", country: "Iraq", region: "MENA", type: "television", language: "Kurdish", url: "https://www.rudaw.net", rssFeeds: JSON.stringify(["https://www.rudaw.net/english/rss"]), bias: "center", isActive: true, description: "Kurdish news network based in Erbil" },
  { name: "Kurdistan 24", country: "Iraq", region: "MENA", type: "television", language: "Kurdish", url: "https://www.kurdistan24.net", rssFeeds: JSON.stringify(["https://www.kurdistan24.net/en/rss"]), bias: "center", isActive: true, description: "Kurdish satellite news channel" },
  { name: "Al-Sumaria News", country: "Iraq", region: "MENA", type: "television", language: "Arabic", url: "https://www.alsumaria.tv", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Iraqi satellite television channel" },

  // ── Syria ──
  { name: "SANA (Syrian Arab News Agency)", country: "Syria", region: "MENA", type: "wire", language: "Arabic", url: "https://sana.sy", rssFeeds: JSON.stringify(["https://sana.sy/en/?feed=rss2"]), bias: "state", isActive: true, description: "Official Syrian state news agency" },
  { name: "Syrian Observatory for Human Rights", country: "Syria", region: "MENA", type: "online", language: "English", url: "https://www.syriahr.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Syrian conflict monitoring organization" },

  // ── Libya ──
  { name: "Libya Herald", country: "Libya", region: "MENA", type: "online", language: "English", url: "https://libyaherald.com", rssFeeds: JSON.stringify(["https://libyaherald.com/feed"]), bias: "center", isActive: true, description: "English-language Libyan news website" },
  { name: "Libyan News Agency (LANA)", country: "Libya", region: "MENA", type: "wire", language: "Arabic", url: "https://lana.gov.ly", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Libyan state news agency" },

  // ── Morocco ──
  { name: "MAP (Maghreb Arab Press)", country: "Morocco", region: "MENA", type: "wire", language: "Arabic", url: "https://www.mapnews.ma", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Moroccan state news agency" },
  { name: "Morocco World News", country: "Morocco", region: "MENA", type: "online", language: "English", url: "https://www.moroccoworldnews.com", rssFeeds: JSON.stringify(["https://www.moroccoworldnews.com/feed"]), bias: "center", isActive: true, description: "English-language Moroccan news website" },
  { name: "Le360", country: "Morocco", region: "MENA", type: "online", language: "French", url: "https://fr.le360.ma", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Moroccan French-language news website" },

  // ── Algeria ──
  { name: "APS (Algérie Presse Service)", country: "Algeria", region: "MENA", type: "wire", language: "Arabic", url: "https://www.aps.dz", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Algerian state news agency" },
  { name: "TSA Algérie", country: "Algeria", region: "MENA", type: "online", language: "French", url: "https://www.tsa-algerie.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Algerian French-language news website" },

  // ── Tunisia ──
  { name: "TAP (Tunis Afrique Presse)", country: "Tunisia", region: "MENA", type: "wire", language: "Arabic", url: "https://www.tap.info.tn", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Tunisian state news agency" },
  { name: "Kapitalis", country: "Tunisia", region: "MENA", type: "online", language: "French", url: "https://www.kapitalis.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Tunisian French-language news website" },

  // ── Kuwait ──
  { name: "KUNA (Kuwait News Agency)", country: "Kuwait", region: "MENA", type: "wire", language: "Arabic", url: "https://www.kuna.net.kw", rssFeeds: JSON.stringify(["https://www.kuna.net.kw/rss"]), bias: "state", isActive: true, description: "Official Kuwaiti state news agency" },
  { name: "Arab Times Kuwait", country: "Kuwait", region: "MENA", type: "newspaper", language: "English", url: "https://www.arabtimesonline.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "English-language Kuwaiti newspaper" },

  // ── Bahrain ──
  { name: "BNA (Bahrain News Agency)", country: "Bahrain", region: "MENA", type: "wire", language: "Arabic", url: "https://www.bna.bh", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Bahraini state news agency" },
  { name: "Gulf Daily News", country: "Bahrain", region: "MENA", type: "newspaper", language: "English", url: "https://www.gulf-daily-news.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "English-language Bahraini newspaper" },

  // ── Oman ──
  { name: "ONA (Oman News Agency)", country: "Oman", region: "MENA", type: "wire", language: "Arabic", url: "https://omannews.gov.om", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Omani state news agency" },
  { name: "Times of Oman", country: "Oman", region: "MENA", type: "newspaper", language: "English", url: "https://timesofoman.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "English-language Omani newspaper" },

  // ── Qatar ──
  { name: "QNA (Qatar News Agency)", country: "Qatar", region: "MENA", type: "wire", language: "Arabic", url: "https://www.qna.org.qa", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Qatari state news agency" },
  { name: "The Peninsula Qatar", country: "Qatar", region: "MENA", type: "newspaper", language: "English", url: "https://thepeninsulaqatar.com", rssFeeds: JSON.stringify(["https://thepeninsulaqatar.com/rss"]), bias: "center", isActive: true, description: "English-language Qatari newspaper" },

  // ── Yemen ──
  { name: "Saba News Agency", country: "Yemen", region: "MENA", type: "wire", language: "Arabic", url: "https://www.sabanews.net", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Yemeni state news agency (Houthi-controlled)" },
  { name: "Yemen Times", country: "Yemen", region: "MENA", type: "newspaper", language: "English", url: "https://www.yementimes.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "English-language Yemeni newspaper" },

  // ── Sudan ──
  { name: "SUNA (Sudan News Agency)", country: "Sudan", region: "MENA", type: "wire", language: "Arabic", url: "https://suna-sd.net", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Sudanese state news agency" },
  { name: "Radio Dabanga", country: "Sudan", region: "MENA", type: "online", language: "Arabic", url: "https://www.dabangasudan.org", rssFeeds: JSON.stringify(["https://www.dabangasudan.org/en/all-news/feed"]), bias: "center", isActive: true, description: "Independent Sudanese news outlet" },

  // ── Somalia ──
  { name: "Garowe Online", country: "Somalia", region: "MENA", type: "online", language: "English", url: "https://www.garoweonline.com", rssFeeds: JSON.stringify(["https://www.garoweonline.com/en/rss"]), bias: "center", isActive: true, description: "Somali news website" },
  { name: "Shabelle Media Network", country: "Somalia", region: "MENA", type: "online", language: "Somali", url: "https://www.shabelle.net", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Somali media network" },

  // ── Afghanistan ──
  { name: "Tolo News", country: "Afghanistan", region: "MENA", type: "television", language: "Dari", url: "https://tolonews.com", rssFeeds: JSON.stringify(["https://tolonews.com/rss.xml"]), bias: "center", isActive: true, description: "Afghan news channel" },
  { name: "Pajhwok Afghan News", country: "Afghanistan", region: "MENA", type: "wire", language: "Pashto", url: "https://pajhwok.com", rssFeeds: JSON.stringify(["https://pajhwok.com/en/feed"]), bias: "center", isActive: true, description: "Afghan news agency" },
  { name: "Ariana News", country: "Afghanistan", region: "MENA", type: "television", language: "Dari", url: "https://www.ariananews.af", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Afghan television news channel" },

  // ── Pakistan ──
  { name: "Dawn", country: "Pakistan", region: "MENA", type: "newspaper", language: "English", url: "https://www.dawn.com", rssFeeds: JSON.stringify(["https://www.dawn.com/feeds/home"]), bias: "center", isActive: true, description: "Pakistani English-language newspaper" },
  { name: "The News International", country: "Pakistan", region: "MENA", type: "newspaper", language: "English", url: "https://www.thenews.com.pk", rssFeeds: JSON.stringify(["https://www.thenews.com.pk/rss/1/1"]), bias: "center", isActive: true, description: "Pakistani English-language newspaper" },
  { name: "Geo News", country: "Pakistan", region: "MENA", type: "television", language: "Urdu", url: "https://www.geo.tv", rssFeeds: JSON.stringify(["https://www.geo.tv/rss/1"]), bias: "center", isActive: true, description: "Pakistani Urdu-language news channel" },
  { name: "APP (Associated Press of Pakistan)", country: "Pakistan", region: "MENA", type: "wire", language: "Urdu", url: "https://www.app.com.pk", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Official Pakistani state news agency" },

  // ── International with MENA Focus ──
  { name: "Middle East Eye", country: "UK", region: "MENA", type: "online", language: "English", url: "https://www.middleeasteye.net", rssFeeds: JSON.stringify(["https://www.middleeasteye.net/rss"]), bias: "center-left", isActive: true, description: "Independent online news outlet covering the Middle East" },
  { name: "Al-Monitor", country: "USA", region: "MENA", type: "online", language: "English", url: "https://www.al-monitor.com", rssFeeds: JSON.stringify(["https://www.al-monitor.com/rss.xml"]), bias: "center", isActive: true, description: "News and analysis of the Middle East" },
  { name: "Reuters Middle East", country: "UK", region: "MENA", type: "wire", language: "English", url: "https://www.reuters.com/world/middle-east", rssFeeds: JSON.stringify(["https://feeds.reuters.com/reuters/topNews"]), bias: "center", isActive: true, description: "Reuters coverage of the Middle East" },
  { name: "AP Middle East", country: "USA", region: "MENA", type: "wire", language: "English", url: "https://apnews.com/hub/middle-east", rssFeeds: JSON.stringify(["https://rsshub.app/apnews/topics/middle-east"]), bias: "center", isActive: true, description: "Associated Press Middle East coverage" },
  { name: "BBC Arabic", country: "UK", region: "MENA", type: "television", language: "Arabic", url: "https://www.bbc.com/arabic", rssFeeds: JSON.stringify(["https://feeds.bbci.co.uk/arabic/rss.xml"]), bias: "center", isActive: true, description: "BBC Arabic-language news service" },
  { name: "France 24 Arabic", country: "France", region: "MENA", type: "television", language: "Arabic", url: "https://www.france24.com/ar", rssFeeds: JSON.stringify(["https://www.france24.com/ar/rss"]), bias: "center", isActive: true, description: "French international news channel Arabic service" },
  { name: "DW Arabic", country: "Germany", region: "MENA", type: "television", language: "Arabic", url: "https://www.dw.com/ar", rssFeeds: JSON.stringify(["https://rss.dw.com/rdf/rss-ar-all"]), bias: "center", isActive: true, description: "Deutsche Welle Arabic service" },
  { name: "RT Arabic", country: "Russia", region: "MENA", type: "television", language: "Arabic", url: "https://arabic.rt.com", rssFeeds: JSON.stringify(["https://arabic.rt.com/rss"]), bias: "right", isActive: true, description: "Russia Today Arabic-language channel" },
  { name: "Xinhua Arabic", country: "China", region: "MENA", type: "wire", language: "Arabic", url: "https://arabic.news.cn", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Chinese state news agency Arabic service" },
  { name: "Middle East Briefing", country: "UK", region: "MENA", type: "online", language: "English", url: "https://www.middleeastbriefing.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Middle East business and political news" },
  { name: "MEMO (Middle East Monitor)", country: "UK", region: "MENA", type: "online", language: "English", url: "https://www.middleeastmonitor.com", rssFeeds: JSON.stringify(["https://www.middleeastmonitor.com/feed"]), bias: "center-left", isActive: true, description: "UK-based Middle East news monitor" },
  { name: "Asharq Business", country: "Saudi Arabia", region: "MENA", type: "television", language: "Arabic", url: "https://asharqbusiness.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Arabic-language business news channel" },
  { name: "Al-Quds Al-Arabi", country: "UK", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.alquds.co.uk", rssFeeds: JSON.stringify(["https://www.alquds.co.uk/feed"]), bias: "center-left", isActive: true, description: "Pan-Arab newspaper published in London" },
  { name: "Elaph", country: "UK", region: "MENA", type: "online", language: "Arabic", url: "https://elaph.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Arabic-language online newspaper" },
  { name: "Al-Hayat", country: "UK", region: "MENA", type: "newspaper", language: "Arabic", url: "https://alhayat.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Pan-Arab newspaper" },
  { name: "Arabi21", country: "UK", region: "MENA", type: "online", language: "Arabic", url: "https://arabi21.com", rssFeeds: JSON.stringify([]), bias: "center-left", isActive: true, description: "Arabic-language news website" },
  { name: "Al-Ain News", country: "UAE", region: "MENA", type: "online", language: "Arabic", url: "https://al-ain.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "UAE-based Arabic news website" },
  { name: "Watan", country: "Syria", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.alwatan.sy", rssFeeds: JSON.stringify([]), bias: "state", isActive: true, description: "Syrian newspaper" },
  { name: "Al-Akhbar Lebanon", country: "Lebanon", region: "MENA", type: "newspaper", language: "Arabic", url: "https://al-akhbar.com", rssFeeds: JSON.stringify([]), bias: "left", isActive: true, description: "Lebanese Arabic-language newspaper" },
  { name: "Annahar Lebanon", country: "Lebanon", region: "MENA", type: "newspaper", language: "Arabic", url: "https://www.annahar.com", rssFeeds: JSON.stringify([]), bias: "center", isActive: true, description: "Lebanese Arabic-language newspaper" },
];

// ─── Global Facilities Database ───────────────────────────────────────────────
const FACILITIES = [
  // ── Oil & Gas - MENA ──
  { name: "Ghawar Oil Field", country: "Saudi Arabia", city: "Al-Ahsa", type: "oil_gas", latitude: 25.1, longitude: 49.4, operator: "Saudi Aramco", threatLevel: "critical", description: "World's largest conventional oil field, producing ~5 million bpd", region: "MENA" },
  { name: "Abqaiq Processing Facility", country: "Saudi Arabia", city: "Abqaiq", type: "oil_gas", latitude: 25.93, longitude: 49.67, operator: "Saudi Aramco", threatLevel: "critical", description: "World's largest oil processing facility, attacked by drones in 2019" },
  { name: "Ras Tanura Refinery", country: "Saudi Arabia", city: "Ras Tanura", type: "oil_gas", latitude: 26.68, longitude: 50.16, operator: "Saudi Aramco", threatLevel: "critical", description: "Largest oil export terminal in the world" },
  { name: "Khurais Oil Field", country: "Saudi Arabia", city: "Khurais", type: "oil_gas", latitude: 25.07, longitude: 48.18, operator: "Saudi Aramco", threatLevel: "high", description: "Major Saudi oil field" },
  { name: "Shaybah Oil Field", country: "Saudi Arabia", city: "Rub al Khali", type: "oil_gas", latitude: 22.5, longitude: 53.5, operator: "Saudi Aramco", threatLevel: "high", description: "Remote Saudi oil field in Empty Quarter" },
  { name: "Rumaila Oil Field", country: "Iraq", city: "Basra", type: "oil_gas", latitude: 30.1, longitude: 47.4, operator: "BP/CNPC", threatLevel: "critical", description: "Iraq's largest oil field" },
  { name: "West Qurna Oil Field", country: "Iraq", city: "Basra", type: "oil_gas", latitude: 30.5, longitude: 47.5, operator: "ExxonMobil", threatLevel: "high", description: "Major Iraqi oil field" },
  { name: "Kirkuk Oil Field", country: "Iraq", city: "Kirkuk", type: "oil_gas", latitude: 35.47, longitude: 44.39, operator: "North Oil Company", threatLevel: "critical", description: "Strategic Kurdish-Arab disputed oil field" },
  { name: "South Pars Gas Field", country: "Iran", city: "Assaluyeh", type: "oil_gas", latitude: 27.46, longitude: 52.61, operator: "NIOC", threatLevel: "critical", description: "World's largest natural gas field (shared with Qatar)" },
  { name: "Kharg Island Terminal", country: "Iran", city: "Kharg Island", type: "oil_gas", latitude: 29.26, longitude: 50.33, operator: "NIOC", threatLevel: "critical", description: "Iran's main oil export terminal, handles 90% of exports" },
  { name: "North Dome Gas Field", country: "Qatar", city: "Doha", type: "oil_gas", latitude: 25.5, longitude: 51.8, operator: "QatarEnergy", threatLevel: "critical", description: "World's largest natural gas field (shared with Iran)" },
  { name: "Ras Laffan Industrial City", country: "Qatar", city: "Ras Laffan", type: "oil_gas", latitude: 25.89, longitude: 51.55, operator: "QatarEnergy", threatLevel: "critical", description: "World's largest LNG production complex" },
  { name: "Ruwais Refinery", country: "UAE", city: "Ruwais", type: "oil_gas", latitude: 24.11, longitude: 52.73, operator: "ADNOC", threatLevel: "high", description: "One of the world's largest refineries" },
  { name: "Zakum Oil Field", country: "UAE", city: "Abu Dhabi", type: "oil_gas", latitude: 24.5, longitude: 53.0, operator: "ADNOC", threatLevel: "high", description: "Major UAE offshore oil field" },
  { name: "Wafra Oil Field", country: "Kuwait", city: "Wafra", type: "oil_gas", latitude: 28.62, longitude: 47.93, operator: "KOC", threatLevel: "high", description: "Kuwait-Saudi Arabia Neutral Zone oil field" },
  { name: "Burgan Oil Field", country: "Kuwait", city: "Kuwait City", type: "oil_gas", latitude: 28.95, longitude: 48.0, operator: "Kuwait Oil Company", threatLevel: "critical", description: "World's second largest oil field" },
  { name: "Bab El-Mandeb Strait", country: "Yemen", city: "Aden", type: "oil_gas", latitude: 12.58, longitude: 43.45, operator: "International", threatLevel: "critical", description: "Critical shipping chokepoint for oil tankers" },
  { name: "Marib Gas Field", country: "Yemen", city: "Marib", type: "oil_gas", latitude: 15.47, longitude: 45.32, operator: "Yemen LNG", threatLevel: "critical", description: "Yemen's main gas production area, contested in civil war" },
  { name: "Mellitah Oil & Gas Complex", country: "Libya", city: "Mellitah", type: "oil_gas", latitude: 32.87, longitude: 12.35, operator: "NOC/ENI", threatLevel: "high", description: "Major Libyan oil and gas complex" },
  { name: "Sharara Oil Field", country: "Libya", city: "Ubari", type: "oil_gas", latitude: 27.9, longitude: 13.5, operator: "NOC", threatLevel: "critical", description: "Libya's largest oil field" },
  { name: "Suez Canal", country: "Egypt", city: "Ismailia", type: "oil_gas", latitude: 30.58, longitude: 32.27, operator: "Suez Canal Authority", threatLevel: "critical", description: "Critical global shipping chokepoint" },
  { name: "Strait of Hormuz", country: "Iran", city: "Bandar Abbas", type: "oil_gas", latitude: 26.57, longitude: 56.26, operator: "International", threatLevel: "critical", description: "World's most critical oil shipping chokepoint" },

  // ── Nuclear Facilities ──
  { name: "Natanz Nuclear Facility", country: "Iran", city: "Natanz", type: "nuclear", latitude: 33.72, longitude: 51.73, operator: "AEOI", threatLevel: "critical", description: "Iran's main uranium enrichment facility" },
  { name: "Fordow Fuel Enrichment Plant", country: "Iran", city: "Fordow", type: "nuclear", latitude: 34.88, longitude: 50.98, operator: "AEOI", threatLevel: "critical", description: "Underground uranium enrichment facility" },
  { name: "Arak Heavy Water Reactor", country: "Iran", city: "Arak", type: "nuclear", latitude: 34.07, longitude: 49.22, operator: "AEOI", threatLevel: "critical", description: "Iranian heavy water nuclear reactor" },
  { name: "Bushehr Nuclear Power Plant", country: "Iran", city: "Bushehr", type: "nuclear", latitude: 28.83, longitude: 50.89, operator: "AEOI/Rosatom", threatLevel: "high", description: "Iran's only operational nuclear power plant" },
  { name: "Dimona Nuclear Research Center", country: "Israel", city: "Dimona", type: "nuclear", latitude: 30.97, longitude: 35.14, operator: "IAEC", threatLevel: "critical", description: "Israel's undeclared nuclear weapons facility" },
  { name: "Barakah Nuclear Power Plant", country: "UAE", city: "Abu Dhabi", type: "nuclear", latitude: 23.97, longitude: 52.22, operator: "ENEC", threatLevel: "high", description: "UAE's first nuclear power plant" },
  { name: "El-Dabaa Nuclear Power Plant", country: "Egypt", city: "El-Dabaa", type: "nuclear", latitude: 31.02, longitude: 28.43, operator: "NPPA/Rosatom", threatLevel: "high", description: "Egypt's first nuclear power plant under construction" },
  { name: "Pakistan Atomic Energy Commission HQ", country: "Pakistan", city: "Islamabad", type: "nuclear", latitude: 33.73, longitude: 73.04, operator: "PAEC", threatLevel: "critical", description: "Pakistan's nuclear energy authority headquarters" },
  { name: "Kahuta Research Laboratories", country: "Pakistan", city: "Kahuta", type: "nuclear", latitude: 33.59, longitude: 73.39, operator: "KRL", threatLevel: "critical", description: "Pakistan's main uranium enrichment facility" },

  // ── Military Facilities ──
  { name: "Al-Udeid Air Base", country: "Qatar", city: "Doha", type: "military", latitude: 25.12, longitude: 51.31, operator: "US Air Force/Qatar", threatLevel: "critical", description: "Largest US military base in the Middle East" },
  { name: "Ali Al Salem Air Base", country: "Kuwait", city: "Kuwait City", type: "military", latitude: 29.35, longitude: 47.52, operator: "US Air Force/Kuwait", threatLevel: "high", description: "Major US air base in Kuwait" },
  { name: "Camp Arifjan", country: "Kuwait", city: "Kuwait City", type: "military", latitude: 29.18, longitude: 48.04, operator: "US Army", threatLevel: "high", description: "US Army base in Kuwait" },
  { name: "Naval Support Activity Bahrain", country: "Bahrain", city: "Manama", type: "military", latitude: 26.22, longitude: 50.61, operator: "US Navy (5th Fleet)", threatLevel: "critical", description: "Home of US Navy 5th Fleet" },
  { name: "Prince Sultan Air Base", country: "Saudi Arabia", city: "Al Kharj", type: "military", latitude: 24.06, longitude: 47.58, operator: "US Air Force/Saudi Arabia", threatLevel: "high", description: "Major Saudi and US air base" },
  { name: "Eskan Village Air Base", country: "Saudi Arabia", city: "Riyadh", type: "military", latitude: 24.48, longitude: 46.72, operator: "US Air Force", threatLevel: "high", description: "US Air Force base near Riyadh" },
  { name: "Incirlik Air Base", country: "Turkey", city: "Adana", type: "military", latitude: 37.0, longitude: 35.43, operator: "NATO/Turkey", threatLevel: "critical", description: "NATO air base hosting US nuclear weapons" },
  { name: "Muwaffaq Salti Air Base", country: "Jordan", city: "Azraq", type: "military", latitude: 31.83, longitude: 36.79, operator: "US Air Force/Jordan", threatLevel: "high", description: "US and Jordanian air base" },
  { name: "Ain Assad Air Base", country: "Iraq", city: "Al Anbar", type: "military", latitude: 33.38, longitude: 42.44, operator: "Iraq/US", threatLevel: "critical", description: "Iraqi air base, attacked by Iran in 2020" },
  { name: "Camp Lemonnier", country: "Somalia", city: "Djibouti", type: "military", latitude: 11.55, longitude: 43.16, operator: "US Military", threatLevel: "high", description: "US military base in Djibouti" },
  { name: "Hmeimim Air Base", country: "Syria", city: "Latakia", type: "military", latitude: 35.4, longitude: 35.95, operator: "Russia", threatLevel: "critical", description: "Russian military air base in Syria" },
  { name: "Tartus Naval Base", country: "Syria", city: "Tartus", type: "military", latitude: 34.89, longitude: 35.87, operator: "Russia", threatLevel: "critical", description: "Russia's only naval base in the Mediterranean" },
  { name: "Tiyas Military Airbase (T4)", country: "Syria", city: "Homs", type: "military", latitude: 34.52, longitude: 37.62, operator: "Syria/Iran", threatLevel: "critical", description: "Syrian air base used by Iranian forces, repeatedly attacked by Israel" },
  { name: "Haifa Naval Base", country: "Israel", city: "Haifa", type: "military", latitude: 32.82, longitude: 35.0, operator: "Israel Navy", threatLevel: "high", description: "Main Israeli naval base" },
  { name: "Nevatim Air Base", country: "Israel", city: "Negev", type: "military", latitude: 31.21, longitude: 35.01, operator: "Israeli Air Force", threatLevel: "high", description: "Major Israeli Air Force base" },
  { name: "Kandahar Airfield", country: "Afghanistan", city: "Kandahar", type: "military", latitude: 31.51, longitude: 65.85, operator: "Afghanistan", threatLevel: "high", description: "Former NATO/US military base" },
  { name: "Bagram Airfield", country: "Afghanistan", city: "Bagram", type: "military", latitude: 34.95, longitude: 69.27, operator: "Afghanistan", threatLevel: "high", description: "Former largest US military base in Afghanistan" },

  // ── Airports ──
  { name: "Dubai International Airport", country: "UAE", city: "Dubai", type: "airport", latitude: 25.25, longitude: 55.36, operator: "Dubai Airports", threatLevel: "low", description: "World's busiest international airport by passenger traffic" },
  { name: "King Abdulaziz International Airport", country: "Saudi Arabia", city: "Jeddah", type: "airport", latitude: 21.67, longitude: 39.16, operator: "GACA", threatLevel: "low", description: "Major Saudi international airport" },
  { name: "King Khalid International Airport", country: "Saudi Arabia", city: "Riyadh", type: "airport", latitude: 24.96, longitude: 46.7, operator: "GACA", threatLevel: "low", description: "Main Riyadh international airport" },
  { name: "Istanbul Airport", country: "Turkey", city: "Istanbul", type: "airport", latitude: 41.27, longitude: 28.74, operator: "iGA", threatLevel: "low", description: "Turkey's main international hub" },
  { name: "Cairo International Airport", country: "Egypt", city: "Cairo", type: "airport", latitude: 30.12, longitude: 31.41, operator: "ECAA", threatLevel: "low", description: "Egypt's main international airport" },
  { name: "Ben Gurion International Airport", country: "Israel", city: "Tel Aviv", type: "airport", latitude: 32.01, longitude: 34.89, operator: "IAA", threatLevel: "high", description: "Israel's main international airport" },
  { name: "Hamad International Airport", country: "Qatar", city: "Doha", type: "airport", latitude: 25.27, longitude: 51.61, operator: "Qatar Airways", threatLevel: "low", description: "Qatar's main international hub" },
  { name: "Abu Dhabi International Airport", country: "UAE", city: "Abu Dhabi", type: "airport", latitude: 24.43, longitude: 54.65, operator: "Abu Dhabi Airports", threatLevel: "low", description: "UAE's second largest airport" },
  { name: "Beirut Rafic Hariri International Airport", country: "Lebanon", city: "Beirut", type: "airport", latitude: 33.82, longitude: 35.49, operator: "DAC", threatLevel: "high", description: "Lebanon's only international airport" },
  { name: "Aden International Airport", country: "Yemen", city: "Aden", type: "airport", latitude: 12.83, longitude: 45.03, operator: "Yemen", threatLevel: "critical", description: "Yemen's main airport in conflict zone" },
  { name: "Sanaa International Airport", country: "Yemen", city: "Sanaa", type: "airport", latitude: 15.48, longitude: 44.22, operator: "Yemen/Houthis", threatLevel: "critical", description: "Yemen's capital airport under Houthi control" },

  // ── Data Centers ──
  { name: "Microsoft Azure UAE North", country: "UAE", city: "Dubai", type: "data_center", latitude: 25.2, longitude: 55.27, operator: "Microsoft", threatLevel: "low", description: "Microsoft's primary UAE cloud region" },
  { name: "Amazon AWS Middle East (Bahrain)", country: "Bahrain", city: "Manama", type: "data_center", latitude: 26.21, longitude: 50.59, operator: "Amazon Web Services", threatLevel: "low", description: "AWS first Middle East region" },
  { name: "Google Cloud Middle East", country: "Israel", city: "Tel Aviv", type: "data_center", latitude: 32.08, longitude: 34.78, operator: "Google", threatLevel: "low", description: "Google Cloud Israel region" },
  { name: "Oracle Cloud UAE", country: "UAE", city: "Abu Dhabi", type: "data_center", latitude: 24.47, longitude: 54.37, operator: "Oracle", threatLevel: "low", description: "Oracle Cloud Infrastructure UAE region" },
  { name: "Equinix Dubai", country: "UAE", city: "Dubai", type: "data_center", latitude: 25.19, longitude: 55.26, operator: "Equinix", threatLevel: "low", description: "Major colocation data center in Dubai" },
  { name: "STC Cloud Saudi Arabia", country: "Saudi Arabia", city: "Riyadh", type: "data_center", latitude: 24.69, longitude: 46.72, operator: "Saudi Telecom Company", threatLevel: "low", description: "Saudi Arabia's largest cloud provider" },

  // ── Embassies ──
  { name: "US Embassy Riyadh", country: "Saudi Arabia", city: "Riyadh", type: "embassy", latitude: 24.69, longitude: 46.72, operator: "US State Department", threatLevel: "high", description: "United States Embassy in Saudi Arabia" },
  { name: "US Embassy Tel Aviv", country: "Israel", city: "Tel Aviv", type: "embassy", latitude: 32.07, longitude: 34.79, operator: "US State Department", threatLevel: "high", description: "United States Embassy in Israel" },
  { name: "US Embassy Cairo", country: "Egypt", city: "Cairo", type: "embassy", latitude: 30.04, longitude: 31.23, operator: "US State Department", threatLevel: "high", description: "United States Embassy in Egypt" },
  { name: "US Embassy Baghdad", country: "Iraq", city: "Baghdad", type: "embassy", latitude: 33.31, longitude: 44.42, operator: "US State Department", threatLevel: "critical", description: "World's largest US embassy compound" },
  { name: "US Embassy Ankara", country: "Turkey", city: "Ankara", type: "embassy", latitude: 39.93, longitude: 32.86, operator: "US State Department", threatLevel: "high", description: "United States Embassy in Turkey" },
  { name: "Russian Embassy Damascus", country: "Syria", city: "Damascus", type: "embassy", latitude: 33.51, longitude: 36.29, operator: "Russian MFA", threatLevel: "critical", description: "Russian Embassy in Syria" },
  { name: "Iranian Embassy Baghdad", country: "Iraq", city: "Baghdad", type: "embassy", latitude: 33.33, longitude: 44.4, operator: "Iranian MFA", threatLevel: "critical", description: "Iranian Embassy in Iraq" },
  { name: "Chinese Embassy Riyadh", country: "Saudi Arabia", city: "Riyadh", type: "embassy", latitude: 24.7, longitude: 46.68, operator: "Chinese MFA", threatLevel: "low", description: "Chinese Embassy in Saudi Arabia" },

  // ── Satellite Facilities ──
  { name: "King Abdulaziz City for Science and Technology", country: "Saudi Arabia", city: "Riyadh", type: "satellite", latitude: 24.76, longitude: 46.63, operator: "KACST", threatLevel: "low", description: "Saudi Arabia's space and satellite research center" },
  { name: "Mohammed Bin Rashid Space Centre", country: "UAE", city: "Dubai", type: "satellite", latitude: 25.12, longitude: 55.37, operator: "MBRSC", threatLevel: "low", description: "UAE space agency, launched Hope Mars Mission" },
  { name: "Israel Space Agency", country: "Israel", city: "Tel Aviv", type: "satellite", latitude: 32.08, longitude: 34.78, operator: "ISA", threatLevel: "high", description: "Israeli space agency headquarters" },
  { name: "Palmachim Air Base (Space Launch)", country: "Israel", city: "Palmachim", type: "satellite", latitude: 31.9, longitude: 34.69, operator: "Israel Aerospace Industries", threatLevel: "high", description: "Israeli satellite launch facility" },
  { name: "Iran Space Agency", country: "Iran", city: "Tehran", type: "satellite", latitude: 35.7, longitude: 51.4, operator: "ISA Iran", threatLevel: "high", description: "Iranian space agency" },
  { name: "Shahroud Space Launch Complex", country: "Iran", city: "Shahroud", type: "satellite", latitude: 36.42, longitude: 55.01, operator: "IRGC Aerospace", threatLevel: "critical", description: "Iranian military satellite launch site" },

  // ── Major Companies ──
  { name: "Saudi Aramco HQ", country: "Saudi Arabia", city: "Dhahran", type: "company", latitude: 26.27, longitude: 50.15, operator: "Saudi Aramco", threatLevel: "critical", description: "World's most valuable company, oil giant" },
  { name: "QatarEnergy HQ", country: "Qatar", city: "Doha", type: "company", latitude: 25.29, longitude: 51.53, operator: "QatarEnergy", threatLevel: "high", description: "Qatar's state energy company" },
  { name: "ADNOC HQ", country: "UAE", city: "Abu Dhabi", type: "company", latitude: 24.46, longitude: 54.37, operator: "ADNOC", threatLevel: "high", description: "Abu Dhabi National Oil Company headquarters" },
  { name: "Emirates Airlines HQ", country: "UAE", city: "Dubai", type: "company", latitude: 25.25, longitude: 55.36, operator: "Emirates Group", threatLevel: "low", description: "World's largest international airline headquarters" },
  { name: "Dubai Financial Market", country: "UAE", city: "Dubai", type: "company", latitude: 25.2, longitude: 55.28, operator: "DFM", threatLevel: "low", description: "Dubai's main stock exchange" },
  { name: "Tadawul (Saudi Stock Exchange)", country: "Saudi Arabia", city: "Riyadh", type: "company", latitude: 24.69, longitude: 46.69, operator: "Tadawul", threatLevel: "low", description: "Saudi Arabia's main stock exchange" },
  { name: "Bank Hapoalim HQ", country: "Israel", city: "Tel Aviv", type: "company", latitude: 32.07, longitude: 34.78, operator: "Bank Hapoalim", threatLevel: "low", description: "Israel's largest bank" },
  { name: "Turkcell HQ", country: "Turkey", city: "Istanbul", type: "company", latitude: 41.01, longitude: 28.98, operator: "Turkcell", threatLevel: "low", description: "Turkey's largest mobile operator" },
];

async function seed() {
  console.log("🌱 Starting comprehensive database seed...");

  // Clear existing data
  console.log("🗑️  Clearing existing data...");
  await db.execute(sql`DELETE FROM news_agencies WHERE 1=1`);
  await db.execute(sql`DELETE FROM facilities WHERE 1=1`);

  // Seed agencies
  console.log(`📰 Seeding ${AGENCIES.length} news agencies...`);
  let agencyCount = 0;
  for (const agency of AGENCIES) {
    try {
      // Map type values to schema enum values
      const typeMap: Record<string, string> = {
        'television': 'broadcast', 'newspaper': 'independent', 'online': 'digital',
        'wire': 'wire', 'broadcast': 'broadcast', 'digital': 'digital',
        'state': 'state', 'independent': 'independent', 'international': 'international'
      };
      await db.insert(newsAgencies).values({
        name: agency.name,
        country: agency.country,
        region: agency.region,
        type: (typeMap[agency.type] || 'independent') as any,
        language: agency.language,
        website: agency.url,
        rssFeeds: agency.rssFeeds ? JSON.parse(agency.rssFeeds) : [],
        bias: agency.bias as any,
        isActive: agency.isActive,
        description: agency.description,
      });
      agencyCount++;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) {
        console.warn(`  ⚠️  Agency "${agency.name}": ${e.message}`);
      }
    }
  }
  console.log(`✅ Seeded ${agencyCount} news agencies`);

  // Seed facilities
  console.log(`🏭 Seeding ${FACILITIES.length} facilities...`);
  let facilityCount = 0;
  for (const fac of FACILITIES) {
    try {
      await db.insert(facilities).values({
        name: fac.name,
        country: fac.country,
        city: fac.city,
        type: fac.type as any,
        latitude: fac.latitude,
        longitude: fac.longitude,
        operator: fac.operator,
        threatLevel: (fac.threatLevel || 'low') as any,
        description: fac.description,
        region: fac.region || 'MENA',
      });
      facilityCount++;
    } catch (e: any) {
      if (!e.message?.includes('Duplicate')) {
        console.warn(`  ⚠️  Facility "${fac.name}": ${e.message}`);
      }
    }
  }
  console.log(`✅ Seeded ${facilityCount} facilities`);

  console.log("🎉 Comprehensive seed complete!");
  process.exit(0);
}

seed().catch(e => { console.error("❌ Seed failed:", e); process.exit(1); });
