/**
 * Seed script for MENA News Agencies and Global Facilities databases
 * Run with: npx tsx server/seed.ts
 */

import { drizzle } from "drizzle-orm/mysql2";
import { newsAgencies, facilities } from "../drizzle/schema";
import { sql } from "drizzle-orm";

async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

// ─── MENA News Agencies (100+) ─────────────────────────────────────────────
const MENA_AGENCIES = [
  // Qatar
  { name: "Al Jazeera", nameAr: "الجزيرة", country: "Qatar", region: "MENA", type: "broadcast", website: "https://www.aljazeera.com", rssFeeds: JSON.stringify(["https://www.aljazeera.com/xml/rss/all.xml"]), language: "en,ar", bias: "center-left", reliability: 8, isActive: true },
  { name: "Al Jazeera Arabic", nameAr: "الجزيرة العربية", country: "Qatar", region: "MENA", type: "broadcast", website: "https://www.aljazeera.net", rssFeeds: JSON.stringify(["https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779/a7c186be-1baa-4bd4-9d80-a84db769f779"]), language: "ar", bias: "center-left", reliability: 8, isActive: true },
  // Saudi Arabia
  { name: "Al Arabiya", nameAr: "العربية", country: "Saudi Arabia", region: "MENA", type: "broadcast", website: "https://www.alarabiya.net", rssFeeds: JSON.stringify(["https://www.alarabiya.net/tools/rss"]), language: "ar,en", bias: "center-right", reliability: 7, isActive: true },
  { name: "Saudi Press Agency", nameAr: "وكالة الأنباء السعودية", country: "Saudi Arabia", region: "MENA", type: "wire", website: "https://www.spa.gov.sa", rssFeeds: JSON.stringify(["https://www.spa.gov.sa/rss/en.xml"]), language: "ar,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Arab News", nameAr: "عرب نيوز", country: "Saudi Arabia", region: "MENA", type: "newspaper", website: "https://www.arabnews.com", rssFeeds: JSON.stringify(["https://www.arabnews.com/rss.xml"]), language: "en", bias: "center-right", reliability: 7, isActive: true },
  { name: "Saudi Gazette", nameAr: "الجريدة السعودية", country: "Saudi Arabia", region: "MENA", type: "newspaper", website: "https://saudigazette.com.sa", rssFeeds: JSON.stringify(["https://saudigazette.com.sa/rss"]), language: "en", bias: "pro-government", reliability: 6, isActive: true },
  // UAE
  { name: "The National", nameAr: "ذا ناشيونال", country: "UAE", region: "MENA", type: "newspaper", website: "https://www.thenationalnews.com", rssFeeds: JSON.stringify(["https://www.thenationalnews.com/rss.xml"]), language: "en", bias: "center", reliability: 8, isActive: true },
  { name: "Gulf News", nameAr: "جلف نيوز", country: "UAE", region: "MENA", type: "newspaper", website: "https://gulfnews.com", rssFeeds: JSON.stringify(["https://gulfnews.com/rss"]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "Khaleej Times", nameAr: "خليج تايمز", country: "UAE", region: "MENA", type: "newspaper", website: "https://www.khaleejtimes.com", rssFeeds: JSON.stringify(["https://www.khaleejtimes.com/rss"]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "WAM - Emirates News Agency", nameAr: "وام", country: "UAE", region: "MENA", type: "wire", website: "https://wam.ae", rssFeeds: JSON.stringify(["https://wam.ae/en/rss"]), language: "ar,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Sky News Arabia", nameAr: "سكاي نيوز عربية", country: "UAE", region: "MENA", type: "broadcast", website: "https://www.skynewsarabia.com", rssFeeds: JSON.stringify(["https://www.skynewsarabia.com/rss"]), language: "ar", bias: "center-right", reliability: 7, isActive: true },
  // Egypt
  { name: "Al-Ahram", nameAr: "الأهرام", country: "Egypt", region: "MENA", type: "newspaper", website: "https://english.ahram.org.eg", rssFeeds: JSON.stringify(["https://english.ahram.org.eg/rss.aspx"]), language: "en,ar", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Egypt Independent", nameAr: "مصر المستقلة", country: "Egypt", region: "MENA", type: "newspaper", website: "https://egyptindependent.com", rssFeeds: JSON.stringify(["https://egyptindependent.com/feed/"]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "Middle East News Agency (MENA)", nameAr: "وكالة أنباء الشرق الأوسط", country: "Egypt", region: "MENA", type: "wire", website: "https://www.mena.org.eg", rssFeeds: JSON.stringify([]), language: "ar", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Al-Masry Al-Youm", nameAr: "المصري اليوم", country: "Egypt", region: "MENA", type: "newspaper", website: "https://www.almasryalyoum.com", rssFeeds: JSON.stringify(["https://www.almasryalyoum.com/rss"]), language: "ar", bias: "center", reliability: 7, isActive: true },
  // Lebanon
  { name: "The Daily Star Lebanon", nameAr: "ذا ديلي ستار لبنان", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://www.dailystar.com.lb", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "L'Orient Today", nameAr: "لوريان توداي", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://today.lorientlejour.com", rssFeeds: JSON.stringify(["https://today.lorientlejour.com/rss"]), language: "en,fr", bias: "center", reliability: 8, isActive: true },
  { name: "Naharnet", nameAr: "نهارنت", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://www.naharnet.com", rssFeeds: JSON.stringify(["https://www.naharnet.com/stories/en/rss"]), language: "en,ar", bias: "center", reliability: 7, isActive: true },
  { name: "Al-Manar", nameAr: "المنار", country: "Lebanon", region: "MENA", type: "broadcast", website: "https://www.almanar.com.lb", rssFeeds: JSON.stringify([]), language: "ar", bias: "left", reliability: 5, isActive: true },
  // Jordan
  { name: "Jordan Times", nameAr: "جوردان تايمز", country: "Jordan", region: "MENA", type: "newspaper", website: "https://jordantimes.com", rssFeeds: JSON.stringify(["https://jordantimes.com/rss.xml"]), language: "en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Petra News Agency", nameAr: "وكالة بترا", country: "Jordan", region: "MENA", type: "wire", website: "https://petra.gov.jo", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 6, isActive: true },
  // Iraq
  { name: "Iraqi News Agency (INA)", nameAr: "وكالة الأنباء العراقية", country: "Iraq", region: "MENA", type: "wire", website: "https://www.ina.iq", rssFeeds: JSON.stringify([]), language: "ar", bias: "pro-government", reliability: 5, isActive: true },
  { name: "Rudaw", nameAr: "روداو", country: "Iraq", region: "MENA", type: "broadcast", website: "https://www.rudaw.net", rssFeeds: JSON.stringify(["https://www.rudaw.net/english/rss"]), language: "en,ku,ar", bias: "center", reliability: 7, isActive: true },
  { name: "Kurdistan 24", nameAr: "كردستان 24", country: "Iraq", region: "MENA", type: "broadcast", website: "https://www.kurdistan24.net", rssFeeds: JSON.stringify(["https://www.kurdistan24.net/en/rss"]), language: "en,ku", bias: "center", reliability: 7, isActive: true },
  // Israel/Palestine
  { name: "Haaretz", nameAr: "هآرتس", country: "Israel", region: "MENA", type: "newspaper", website: "https://www.haaretz.com", rssFeeds: JSON.stringify(["https://www.haaretz.com/cmlink/1.628765"]), language: "en,he", bias: "left", reliability: 8, isActive: true },
  { name: "The Jerusalem Post", nameAr: "جيروزاليم بوست", country: "Israel", region: "MENA", type: "newspaper", website: "https://www.jpost.com", rssFeeds: JSON.stringify(["https://www.jpost.com/rss/rssfeedsheadlines.aspx"]), language: "en", bias: "center-right", reliability: 7, isActive: true },
  { name: "Times of Israel", nameAr: "تايمز أوف إسرائيل", country: "Israel", region: "MENA", type: "newspaper", website: "https://www.timesofisrael.com", rssFeeds: JSON.stringify(["https://www.timesofisrael.com/feed/"]), language: "en", bias: "center", reliability: 8, isActive: true },
  { name: "Ynet News", nameAr: "واي نت نيوز", country: "Israel", region: "MENA", type: "newspaper", website: "https://www.ynetnews.com", rssFeeds: JSON.stringify(["https://www.ynetnews.com/category/3082"]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "Palestine Chronicle", nameAr: "كرونيكل فلسطين", country: "Palestine", region: "MENA", type: "newspaper", website: "https://www.palestinechronicle.com", rssFeeds: JSON.stringify(["https://www.palestinechronicle.com/feed/"]), language: "en", bias: "left", reliability: 6, isActive: true },
  { name: "WAFA - Palestinian News Agency", nameAr: "وفا", country: "Palestine", region: "MENA", type: "wire", website: "https://english.wafa.ps", rssFeeds: JSON.stringify(["https://english.wafa.ps/rss"]), language: "en,ar", bias: "pro-government", reliability: 6, isActive: true },
  // Iran
  { name: "Press TV", nameAr: "برس تي في", country: "Iran", region: "MENA", type: "broadcast", website: "https://www.presstv.ir", rssFeeds: JSON.stringify(["https://www.presstv.ir/rss"]), language: "en", bias: "pro-government", reliability: 4, isActive: true },
  { name: "IRNA - Islamic Republic News Agency", nameAr: "إيرنا", country: "Iran", region: "MENA", type: "wire", website: "https://en.irna.ir", rssFeeds: JSON.stringify(["https://en.irna.ir/rss"]), language: "en,fa", bias: "pro-government", reliability: 5, isActive: true },
  { name: "Tasnim News Agency", nameAr: "تسنيم", country: "Iran", region: "MENA", type: "wire", website: "https://www.tasnimnews.com", rssFeeds: JSON.stringify(["https://www.tasnimnews.com/en/rss"]), language: "en,fa", bias: "pro-government", reliability: 5, isActive: true },
  { name: "Mehr News Agency", nameAr: "مهر", country: "Iran", region: "MENA", type: "wire", website: "https://en.mehrnews.com", rssFeeds: JSON.stringify(["https://en.mehrnews.com/rss"]), language: "en,fa", bias: "pro-government", reliability: 5, isActive: true },
  // Turkey
  { name: "Anadolu Agency", nameAr: "وكالة الأناضول", country: "Turkey", region: "MENA", type: "wire", website: "https://www.aa.com.tr/en", rssFeeds: JSON.stringify(["https://www.aa.com.tr/en/rss"]), language: "en,tr,ar", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Daily Sabah", nameAr: "صباح", country: "Turkey", region: "MENA", type: "newspaper", website: "https://www.dailysabah.com", rssFeeds: JSON.stringify(["https://www.dailysabah.com/rssFeed/push_all"]), language: "en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "TRT World", nameAr: "تي آر تي وورلد", country: "Turkey", region: "MENA", type: "broadcast", website: "https://www.trtworld.com", rssFeeds: JSON.stringify(["https://www.trtworld.com/rss"]), language: "en", bias: "pro-government", reliability: 6, isActive: true },
  // Kuwait
  { name: "Kuwait News Agency (KUNA)", nameAr: "وكالة الأنباء الكويتية", country: "Kuwait", region: "MENA", type: "wire", website: "https://www.kuna.net.kw", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Arab Times Kuwait", nameAr: "عرب تايمز الكويت", country: "Kuwait", region: "MENA", type: "newspaper", website: "https://www.arabtimesonline.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  // Bahrain
  { name: "Bahrain News Agency", nameAr: "وكالة أنباء البحرين", country: "Bahrain", region: "MENA", type: "wire", website: "https://www.bna.bh", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 5, isActive: true },
  // Oman
  { name: "Oman News Agency", nameAr: "وكالة الأنباء العمانية", country: "Oman", region: "MENA", type: "wire", website: "https://www.omannews.gov.om", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Muscat Daily", nameAr: "مسقط ديلي", country: "Oman", region: "MENA", type: "newspaper", website: "https://muscatdaily.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  // Yemen
  { name: "Saba News Agency", nameAr: "وكالة سبأ", country: "Yemen", region: "MENA", type: "wire", website: "https://www.sabanews.net", rssFeeds: JSON.stringify([]), language: "ar", bias: "pro-government", reliability: 4, isActive: true },
  { name: "Yemen Observer", nameAr: "يمن أوبزرفر", country: "Yemen", region: "MENA", type: "newspaper", website: "https://www.yemenobserver.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 5, isActive: true },
  // Syria
  { name: "SANA - Syrian Arab News Agency", nameAr: "سانا", country: "Syria", region: "MENA", type: "wire", website: "https://www.sana.sy", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 3, isActive: true },
  { name: "Syria Direct", nameAr: "سوريا دايركت", country: "Syria", region: "MENA", type: "newspaper", website: "https://syriadirect.org", rssFeeds: JSON.stringify(["https://syriadirect.org/feed/"]), language: "en,ar", bias: "center", reliability: 8, isActive: true },
  // Libya
  { name: "Libya Observer", nameAr: "ليبيا أوبزرفر", country: "Libya", region: "MENA", type: "newspaper", website: "https://www.libyaobserver.ly", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  { name: "Libyan News Agency", nameAr: "وكالة الأنباء الليبية", country: "Libya", region: "MENA", type: "wire", website: "https://www.lana.gov.ly", rssFeeds: JSON.stringify([]), language: "ar", bias: "pro-government", reliability: 4, isActive: true },
  // Tunisia
  { name: "TAP - Tunis Afrique Presse", nameAr: "وكالة تونس أفريقيا للأنباء", country: "Tunisia", region: "MENA", type: "wire", website: "https://www.tap.info.tn", rssFeeds: JSON.stringify([]), language: "ar,fr,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Tunis Times", nameAr: "تونس تايمز", country: "Tunisia", region: "MENA", type: "newspaper", website: "https://www.thetunistimes.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  // Algeria
  { name: "APS - Algérie Presse Service", nameAr: "وكالة الأنباء الجزائرية", country: "Algeria", region: "MENA", type: "wire", website: "https://www.aps.dz", rssFeeds: JSON.stringify([]), language: "ar,fr,en", bias: "pro-government", reliability: 5, isActive: true },
  { name: "El Watan", nameAr: "الوطن", country: "Algeria", region: "MENA", type: "newspaper", website: "https://www.elwatan.com", rssFeeds: JSON.stringify([]), language: "fr", bias: "center-left", reliability: 7, isActive: true },
  // Morocco
  { name: "MAP - Maghreb Arab Press", nameAr: "وكالة المغرب العربي للأنباء", country: "Morocco", region: "MENA", type: "wire", website: "https://www.mapnews.ma", rssFeeds: JSON.stringify([]), language: "ar,fr,en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Morocco World News", nameAr: "مغرب وورلد نيوز", country: "Morocco", region: "MENA", type: "newspaper", website: "https://www.moroccoworldnews.com", rssFeeds: JSON.stringify(["https://www.moroccoworldnews.com/feed/"]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "Le360", nameAr: "لو360", country: "Morocco", region: "MENA", type: "newspaper", website: "https://fr.le360.ma", rssFeeds: JSON.stringify([]), language: "fr,ar", bias: "center", reliability: 6, isActive: true },
  // Sudan
  { name: "Sudan Tribune", nameAr: "السودان تريبيون", country: "Sudan", region: "MENA", type: "newspaper", website: "https://sudantribune.com", rssFeeds: JSON.stringify(["https://sudantribune.com/rss"]), language: "en,fr", bias: "center", reliability: 7, isActive: true },
  { name: "SUNA - Sudan News Agency", nameAr: "سونا", country: "Sudan", region: "MENA", type: "wire", website: "https://www.suna-sd.net", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "pro-government", reliability: 4, isActive: true },
  // International covering MENA
  { name: "Reuters Middle East", nameAr: "رويترز الشرق الأوسط", country: "UK", region: "MENA", type: "wire", website: "https://www.reuters.com/world/middle-east", rssFeeds: JSON.stringify(["https://feeds.reuters.com/reuters/MENANews"]), language: "en", bias: "center", reliability: 9, isActive: true },
  { name: "AP Middle East", nameAr: "أسوشيتد برس الشرق الأوسط", country: "USA", region: "MENA", type: "wire", website: "https://apnews.com/hub/middle-east", rssFeeds: JSON.stringify(["https://rsshub.app/apnews/topics/middle-east"]), language: "en", bias: "center", reliability: 9, isActive: true },
  { name: "AFP Middle East", nameAr: "أ ف ب الشرق الأوسط", country: "France", region: "MENA", type: "wire", website: "https://www.afp.com", rssFeeds: JSON.stringify([]), language: "en,fr,ar", bias: "center", reliability: 9, isActive: true },
  { name: "BBC Arabic", nameAr: "بي بي سي عربي", country: "UK", region: "MENA", type: "broadcast", website: "https://www.bbc.com/arabic", rssFeeds: JSON.stringify(["https://feeds.bbci.co.uk/arabic/rss.xml"]), language: "ar", bias: "center", reliability: 9, isActive: true },
  { name: "France 24 Arabic", nameAr: "فرانس 24 عربي", country: "France", region: "MENA", type: "broadcast", website: "https://www.france24.com/ar", rssFeeds: JSON.stringify(["https://www.france24.com/ar/rss"]), language: "ar", bias: "center", reliability: 8, isActive: true },
  { name: "Deutsche Welle Arabic", nameAr: "دويتشه فيله عربي", country: "Germany", region: "MENA", type: "broadcast", website: "https://www.dw.com/ar", rssFeeds: JSON.stringify(["https://rss.dw.com/rdf/rss-ar-all"]), language: "ar", bias: "center", reliability: 8, isActive: true },
  { name: "Middle East Eye", nameAr: "ميدل إيست آي", country: "UK", region: "MENA", type: "newspaper", website: "https://www.middleeasteye.net", rssFeeds: JSON.stringify(["https://www.middleeasteye.net/rss"]), language: "en", bias: "center-left", reliability: 7, isActive: true },
  { name: "Al-Monitor", nameAr: "المونيتور", country: "USA", region: "MENA", type: "newspaper", website: "https://www.al-monitor.com", rssFeeds: JSON.stringify(["https://www.al-monitor.com/rss"]), language: "en,ar", bias: "center", reliability: 8, isActive: true },
  { name: "Asharq Al-Awsat", nameAr: "الشرق الأوسط", country: "UK", region: "MENA", type: "newspaper", website: "https://english.aawsat.com", rssFeeds: JSON.stringify(["https://english.aawsat.com/rss"]), language: "en,ar", bias: "center-right", reliability: 7, isActive: true },
  { name: "Al Bawaba", nameAr: "البوابة", country: "Jordan", region: "MENA", type: "newspaper", website: "https://www.albawaba.com", rssFeeds: JSON.stringify(["https://www.albawaba.com/rss.xml"]), language: "en,ar", bias: "center", reliability: 6, isActive: true },
  { name: "Mada Masr", nameAr: "مدى مصر", country: "Egypt", region: "MENA", type: "newspaper", website: "https://www.madamasr.com", rssFeeds: JSON.stringify(["https://www.madamasr.com/en/feed/"]), language: "en,ar", bias: "center-left", reliability: 8, isActive: true },
  { name: "7iber", nameAr: "حبر", country: "Jordan", region: "MENA", type: "newspaper", website: "https://www.7iber.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 7, isActive: true },
  { name: "Daraj Media", nameAr: "درج ميديا", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://daraj.media", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 7, isActive: true },
  { name: "Inkyfada", nameAr: "إنكيفادا", country: "Tunisia", region: "MENA", type: "newspaper", website: "https://inkyfada.com", rssFeeds: JSON.stringify([]), language: "ar,fr", bias: "center-left", reliability: 8, isActive: true },
  { name: "Arabi21", nameAr: "عربي21", country: "UK", region: "MENA", type: "newspaper", website: "https://arabi21.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 6, isActive: true },
  { name: "Raseef22", nameAr: "رصيف22", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://raseef22.net", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 7, isActive: true },
  { name: "Orient News", nameAr: "أورينت نيوز", country: "UAE", region: "MENA", type: "broadcast", website: "https://orient-news.net", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 6, isActive: true },
  { name: "Al Quds Al Arabi", nameAr: "القدس العربي", country: "UK", region: "MENA", type: "newspaper", website: "https://www.alquds.co.uk", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 7, isActive: true },
  { name: "Annahar Lebanon", nameAr: "النهار لبنان", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://www.annahar.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 7, isActive: true },
  { name: "Al Akhbar Lebanon", nameAr: "الأخبار لبنان", country: "Lebanon", region: "MENA", type: "newspaper", website: "https://al-akhbar.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "left", reliability: 6, isActive: true },
  { name: "Zaman Al Wasl", nameAr: "زمان الوصل", country: "UAE", region: "MENA", type: "newspaper", website: "https://zamanalwsl.net", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 6, isActive: true },
  { name: "Enab Baladi", nameAr: "عنب بلدي", country: "Syria", region: "MENA", type: "newspaper", website: "https://english.enabbaladi.net", rssFeeds: JSON.stringify(["https://english.enabbaladi.net/feed/"]), language: "en,ar", bias: "center", reliability: 7, isActive: true },
  { name: "The Libya Update", nameAr: "تحديث ليبيا", country: "Libya", region: "MENA", type: "newspaper", website: "https://thelibyaupdate.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  { name: "Yemen Monitor", nameAr: "يمن مونيتور", country: "Yemen", region: "MENA", type: "newspaper", website: "https://yemenmonitor.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 6, isActive: true },
  { name: "Bahrain Mirror", nameAr: "مرآة البحرين", country: "Bahrain", region: "MENA", type: "newspaper", website: "https://bahrainmirror.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center-left", reliability: 6, isActive: true },
  { name: "Qatar Tribune", nameAr: "قطر تريبيون", country: "Qatar", region: "MENA", type: "newspaper", website: "https://www.qatar-tribune.com", rssFeeds: JSON.stringify([]), language: "en", bias: "pro-government", reliability: 6, isActive: true },
  { name: "Gulf International Forum", nameAr: "منتدى الخليج الدولي", country: "USA", region: "MENA", type: "think_tank", website: "https://gulfif.org", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 8, isActive: true },
  { name: "Carnegie Middle East Center", nameAr: "مركز كارنيغي للشرق الأوسط", country: "Lebanon", region: "MENA", type: "think_tank", website: "https://carnegie-mec.org", rssFeeds: JSON.stringify([]), language: "en,ar", bias: "center", reliability: 9, isActive: true },
  { name: "MEMRI", nameAr: "ميمري", country: "USA", region: "MENA", type: "think_tank", website: "https://www.memri.org", rssFeeds: JSON.stringify([]), language: "en", bias: "center-right", reliability: 6, isActive: true },
  { name: "Arab Weekly", nameAr: "الأسبوع العربي", country: "UK", region: "MENA", type: "newspaper", website: "https://thearabweekly.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center", reliability: 7, isActive: true },
  { name: "New Arab", nameAr: "العربي الجديد", country: "UK", region: "MENA", type: "newspaper", website: "https://www.newarab.com", rssFeeds: JSON.stringify(["https://www.newarab.com/rss"]), language: "en,ar", bias: "center-left", reliability: 7, isActive: true },
  { name: "Maghreb Voices", nameAr: "أصوات المغرب", country: "Morocco", region: "MENA", type: "newspaper", website: "https://maghrebvoices.com", rssFeeds: JSON.stringify([]), language: "en,fr", bias: "center", reliability: 6, isActive: true },
  { name: "Ahval News", nameAr: "أحوال نيوز", country: "UK", region: "MENA", type: "newspaper", website: "https://ahvalnews.com", rssFeeds: JSON.stringify([]), language: "en", bias: "center-left", reliability: 7, isActive: true },
  { name: "Al-Ain News", nameAr: "العين الإخبارية", country: "UAE", region: "MENA", type: "newspaper", website: "https://al-ain.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 6, isActive: true },
  { name: "Al Ghad", nameAr: "الغد", country: "Jordan", region: "MENA", type: "newspaper", website: "https://alghad.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 7, isActive: true },
  { name: "Ammon News", nameAr: "عمون نيوز", country: "Jordan", region: "MENA", type: "newspaper", website: "https://en.ammonnews.net", rssFeeds: JSON.stringify([]), language: "en,ar", bias: "center", reliability: 6, isActive: true },
  { name: "Asharq Business", nameAr: "الشرق للأعمال", country: "Saudi Arabia", region: "MENA", type: "newspaper", website: "https://asharqbusiness.com", rssFeeds: JSON.stringify([]), language: "ar,en", bias: "center", reliability: 7, isActive: true },
  { name: "Al-Eqtisadiah", nameAr: "الاقتصادية", country: "Saudi Arabia", region: "MENA", type: "newspaper", website: "https://www.aleqt.com", rssFeeds: JSON.stringify([]), language: "ar", bias: "center", reliability: 7, isActive: true },
  { name: "Meedan", nameAr: "ميدان", country: "USA", region: "MENA", type: "think_tank", website: "https://meedan.com", rssFeeds: JSON.stringify([]), language: "en,ar", bias: "center", reliability: 7, isActive: true },
];

// ─── Global Facilities Database ────────────────────────────────────────────
const GLOBAL_FACILITIES = [
  // ── Military Facilities ──
  { name: "Al Udeid Air Base", type: "military", country: "Qatar", city: "Doha", latitude: 25.1173, longitude: 51.3149, operator: "US Air Force / Qatar Air Force", description: "Largest US military base in Middle East, hosts CENTCOM forward HQ", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Incirlik Air Base", type: "military", country: "Turkey", city: "Adana", latitude: 37.0021, longitude: 35.4258, operator: "US Air Force / Turkish Air Force", description: "NATO air base, hosts US nuclear weapons", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Camp Arifjan", type: "military", country: "Kuwait", city: "Kuwait City", latitude: 29.1972, longitude: 47.9531, operator: "US Army", description: "Major US Army logistics hub in Kuwait", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Ali Al Salem Air Base", type: "military", country: "Kuwait", city: "Kuwait City", latitude: 29.3467, longitude: 47.5208, operator: "Kuwait Air Force / US Air Force", description: "Joint US-Kuwait air base", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Naval Support Activity Bahrain", type: "military", country: "Bahrain", city: "Manama", latitude: 26.2285, longitude: 50.6058, operator: "US Navy - 5th Fleet", description: "US Navy 5th Fleet headquarters", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Muwaffaq Salti Air Base", type: "military", country: "Jordan", city: "Azraq", latitude: 31.8258, longitude: 36.7891, operator: "Jordan Air Force / US Air Force", description: "Joint Jordanian-US air base", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Ain Assad Air Base", type: "military", country: "Iraq", city: "Al Anbar", latitude: 33.3856, longitude: 42.4414, operator: "Iraqi Air Force / US Forces", description: "Major air base in western Iraq, attacked by Iran in 2020", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Balad Air Base", type: "military", country: "Iraq", city: "Balad", latitude: 33.9402, longitude: 44.3614, operator: "Iraqi Air Force", description: "Former US base, now Iraqi Air Force", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Nevatim Air Base", type: "military", country: "Israel", city: "Negev", latitude: 31.2083, longitude: 35.0122, operator: "Israeli Air Force", description: "Primary Israeli F-35 base", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Ramon Air Base", type: "military", country: "Israel", city: "Negev", latitude: 30.7761, longitude: 34.6667, operator: "Israeli Air Force", description: "Major Israeli Air Force base", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Hmeimim Air Base", type: "military", country: "Syria", city: "Latakia", latitude: 35.4011, longitude: 35.9489, operator: "Russian Aerospace Forces", description: "Russian military base in Syria", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Tartus Naval Base", type: "military", country: "Syria", city: "Tartus", latitude: 34.8886, longitude: 35.8697, operator: "Russian Navy", description: "Russia's only Mediterranean naval base", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Imam Ali Military Base", type: "military", country: "Iraq", city: "Al-Qa'im", latitude: 34.4478, longitude: 40.9181, operator: "Iran-backed PMF", description: "Iran-linked militia base near Syrian border", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "King Khalid Military City", type: "military", country: "Saudi Arabia", city: "Hafar Al-Batin", latitude: 27.9000, longitude: 45.5167, operator: "Saudi Armed Forces", description: "Major Saudi military installation", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Prince Sultan Air Base", type: "military", country: "Saudi Arabia", city: "Al Kharj", latitude: 24.0625, longitude: 47.5806, operator: "Royal Saudi Air Force / US Air Force", description: "Major Saudi-US air base", threatLevel: "high", region: "MENA", status: "active" },
  // ── Nuclear Facilities ──
  { name: "Natanz Nuclear Facility", type: "nuclear", country: "Iran", city: "Natanz", latitude: 33.7225, longitude: 51.7272, operator: "AEOI", description: "Iran's main uranium enrichment facility, subject to IAEA inspections", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Fordow Fuel Enrichment Plant", type: "nuclear", country: "Iran", city: "Qom", latitude: 34.8847, longitude: 50.9942, operator: "AEOI", description: "Underground uranium enrichment facility near Qom", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Bushehr Nuclear Power Plant", type: "nuclear", country: "Iran", city: "Bushehr", latitude: 28.8297, longitude: 50.8878, operator: "AEOI / Rosatom", description: "Iran's first nuclear power plant, built with Russian assistance", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Arak Heavy Water Reactor", type: "nuclear", country: "Iran", city: "Arak", latitude: 34.1408, longitude: 49.2342, operator: "AEOI", description: "Heavy water research reactor, modified under JCPOA", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Dimona Nuclear Research Center", type: "nuclear", country: "Israel", city: "Dimona", latitude: 31.0019, longitude: 35.1417, operator: "Israeli Atomic Energy Commission", description: "Israel's undeclared nuclear weapons facility", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Barakah Nuclear Power Plant", type: "nuclear", country: "UAE", city: "Abu Dhabi", latitude: 23.9617, longitude: 52.2025, operator: "ENEC / KEPCO", description: "First nuclear power plant in Arab world, built by South Korea", threatLevel: "medium", region: "MENA", status: "active" },
  // ── Oil & Gas Facilities ──
  { name: "Abqaiq Oil Processing Facility", type: "oil_gas", country: "Saudi Arabia", city: "Abqaiq", latitude: 25.9333, longitude: 49.6667, operator: "Saudi Aramco", description: "World's largest oil processing facility, attacked by drones in 2019", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Ghawar Oil Field", type: "oil_gas", country: "Saudi Arabia", city: "Al-Ahsa", latitude: 25.1333, longitude: 49.2500, operator: "Saudi Aramco", description: "World's largest conventional oil field", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Ras Tanura Refinery", type: "oil_gas", country: "Saudi Arabia", city: "Ras Tanura", latitude: 26.6667, longitude: 50.1667, operator: "Saudi Aramco", description: "World's largest oil refinery and export terminal", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Kharg Island Oil Terminal", type: "oil_gas", country: "Iran", city: "Kharg Island", latitude: 29.2500, longitude: 50.3167, operator: "NIOC", description: "Iran's main oil export terminal, handles 90% of exports", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "North Dome/South Pars Gas Field", type: "oil_gas", country: "Qatar", city: "Offshore", latitude: 26.5000, longitude: 52.0000, operator: "QatarEnergy / NIOC", description: "World's largest natural gas field, shared by Qatar and Iran", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Rumaila Oil Field", type: "oil_gas", country: "Iraq", city: "Basra", latitude: 30.0000, longitude: 47.4167, operator: "BP / SOMO", description: "Iraq's largest oil field", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Kirkuk Oil Field", type: "oil_gas", country: "Iraq", city: "Kirkuk", latitude: 35.4681, longitude: 44.3922, operator: "North Oil Company", description: "Major Iraqi oil field, disputed between Baghdad and Erbil", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Zohr Gas Field", type: "oil_gas", country: "Egypt", city: "Mediterranean Sea", latitude: 31.5000, longitude: 28.5000, operator: "ENI / BP", description: "Mediterranean's largest gas discovery", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Leviathan Gas Field", type: "oil_gas", country: "Israel", city: "Mediterranean Sea", latitude: 31.8333, longitude: 33.5000, operator: "Chevron / NewMed", description: "Israel's largest offshore gas field", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Tamar Gas Field", type: "oil_gas", country: "Israel", city: "Mediterranean Sea", latitude: 31.6667, longitude: 33.3333, operator: "Chevron / NewMed", description: "Major Israeli offshore gas field", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Suez Canal", type: "oil_gas", country: "Egypt", city: "Suez", latitude: 30.4500, longitude: 32.3500, operator: "Suez Canal Authority", description: "Critical global shipping chokepoint, 12% of world trade", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Strait of Hormuz", type: "oil_gas", country: "Iran/Oman", city: "Hormuz", latitude: 26.5667, longitude: 56.2500, operator: "International Waters", description: "World's most critical oil chokepoint, 20% of global oil", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Bab-el-Mandeb Strait", type: "oil_gas", country: "Yemen/Djibouti", city: "Bab-el-Mandeb", latitude: 12.5833, longitude: 43.3333, operator: "International Waters", description: "Critical shipping lane between Red Sea and Gulf of Aden", threatLevel: "critical", region: "MENA", status: "active" },
  // ── Airports ──
  { name: "Dubai International Airport", type: "airport", country: "UAE", city: "Dubai", latitude: 25.2532, longitude: 55.3657, operator: "Dubai Airports", description: "World's busiest international airport by passenger traffic", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "King Fahd International Airport", type: "airport", country: "Saudi Arabia", city: "Dammam", latitude: 26.4712, longitude: 49.7979, operator: "GACA", description: "World's largest airport by land area", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "King Abdulaziz International Airport", type: "airport", country: "Saudi Arabia", city: "Jeddah", latitude: 21.6796, longitude: 39.1565, operator: "GACA", description: "Major Saudi hub airport", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Hamad International Airport", type: "airport", country: "Qatar", city: "Doha", latitude: 25.2731, longitude: 51.6081, operator: "Qatar Airways", description: "Qatar's main international hub", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Ben Gurion International Airport", type: "airport", country: "Israel", city: "Tel Aviv", latitude: 32.0114, longitude: 34.8867, operator: "Israel Airports Authority", description: "Israel's main international airport", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Cairo International Airport", type: "airport", country: "Egypt", city: "Cairo", latitude: 30.1219, longitude: 31.4056, operator: "EHCAAN", description: "Egypt's main international hub", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Atatürk Airport / Istanbul", type: "airport", country: "Turkey", city: "Istanbul", latitude: 41.2753, longitude: 28.7519, operator: "iGA", description: "Istanbul New Airport - major European/Asian hub", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Beirut Rafic Hariri International Airport", type: "airport", country: "Lebanon", city: "Beirut", latitude: 33.8208, longitude: 35.4883, operator: "MCIA", description: "Lebanon's only international airport", threatLevel: "high", region: "MENA", status: "active" },
  // ── Data Centers ──
  { name: "Microsoft Azure UAE North", type: "data_center", country: "UAE", city: "Dubai", latitude: 25.2048, longitude: 55.2708, operator: "Microsoft", description: "Microsoft's UAE cloud data center region", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "AWS Middle East (Bahrain)", type: "data_center", country: "Bahrain", city: "Manama", latitude: 26.0667, longitude: 50.5577, operator: "Amazon Web Services", description: "AWS first Middle East cloud region", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Google Cloud Middle East", type: "data_center", country: "Israel", city: "Tel Aviv", latitude: 32.0853, longitude: 34.7818, operator: "Google", description: "Google Cloud Israel region", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Khazna Data Centers", type: "data_center", country: "UAE", city: "Abu Dhabi", latitude: 24.4539, longitude: 54.3773, operator: "Khazna", description: "UAE sovereign data center", threatLevel: "low", region: "MENA", status: "active" },
  { name: "Saudi Aramco Data Center", type: "data_center", country: "Saudi Arabia", city: "Dhahran", latitude: 26.2361, longitude: 50.0394, operator: "Saudi Aramco", description: "Aramco's main IT infrastructure", threatLevel: "high", region: "MENA", status: "active" },
  // ── Embassies ──
  { name: "US Embassy Cairo", type: "embassy", country: "Egypt", city: "Cairo", latitude: 30.0626, longitude: 31.2497, operator: "US State Department", description: "US Embassy in Egypt", threatLevel: "high", region: "MENA", status: "active" },
  { name: "US Embassy Baghdad", type: "embassy", country: "Iraq", city: "Baghdad", latitude: 33.3128, longitude: 44.3615, operator: "US State Department", description: "World's largest US Embassy", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "US Embassy Riyadh", type: "embassy", country: "Saudi Arabia", city: "Riyadh", latitude: 24.6877, longitude: 46.6979, operator: "US State Department", description: "US Embassy in Saudi Arabia", threatLevel: "high", region: "MENA", status: "active" },
  { name: "US Embassy Tel Aviv / Jerusalem", type: "embassy", country: "Israel", city: "Jerusalem", latitude: 31.7683, longitude: 35.2137, operator: "US State Department", description: "US Embassy moved to Jerusalem in 2018", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "Russian Embassy Damascus", type: "embassy", country: "Syria", city: "Damascus", latitude: 33.5138, longitude: 36.2765, operator: "Russian MFA", description: "Russian Embassy in Syria", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Chinese Embassy Riyadh", type: "embassy", country: "Saudi Arabia", city: "Riyadh", latitude: 24.6908, longitude: 46.6853, operator: "Chinese MFA", description: "Chinese Embassy in Saudi Arabia", threatLevel: "medium", region: "MENA", status: "active" },
  // ── Satellite Facilities ──
  { name: "Mohammed Bin Rashid Space Centre", type: "satellite", country: "UAE", city: "Dubai", latitude: 25.0657, longitude: 55.1713, operator: "UAE Space Agency", description: "UAE's space program HQ, launched Hope Mars Mission", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "King Abdulaziz City for Science and Technology", type: "satellite", country: "Saudi Arabia", city: "Riyadh", latitude: 24.7136, longitude: 46.6753, operator: "KACST", description: "Saudi Arabia's main space and technology research center", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Israel Space Agency HQ", type: "satellite", country: "Israel", city: "Tel Aviv", latitude: 32.0853, longitude: 34.7818, operator: "ISA / IAI", description: "Israel's satellite and space program", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Palmachim Air Base (Satellite Launch)", type: "satellite", country: "Israel", city: "Palmachim", latitude: 31.8981, longitude: 34.6900, operator: "Israeli Air Force / ISA", description: "Israel's satellite launch facility", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Iran Space Agency Semnan", type: "satellite", country: "Iran", city: "Semnan", latitude: 35.2342, longitude: 53.9214, operator: "ISA Iran", description: "Iran's satellite launch complex", threatLevel: "high", region: "MENA", status: "active" },
  // ── Major Companies ──
  { name: "Saudi Aramco HQ", type: "company", country: "Saudi Arabia", city: "Dhahran", latitude: 26.2361, longitude: 50.0394, operator: "Saudi Aramco", description: "World's most valuable company, Saudi state oil company", threatLevel: "critical", region: "MENA", status: "active" },
  { name: "QatarEnergy HQ", type: "company", country: "Qatar", city: "Doha", latitude: 25.2854, longitude: 51.5310, operator: "QatarEnergy", description: "Qatar's state energy company, world's largest LNG exporter", threatLevel: "high", region: "MENA", status: "active" },
  { name: "ADNOC HQ", type: "company", country: "UAE", city: "Abu Dhabi", latitude: 24.4539, longitude: 54.3773, operator: "ADNOC", description: "Abu Dhabi National Oil Company", threatLevel: "high", region: "MENA", status: "active" },
  { name: "Emirates Airlines HQ", type: "company", country: "UAE", city: "Dubai", latitude: 25.2532, longitude: 55.3657, operator: "Emirates Group", description: "World's largest international airline", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Emaar Properties HQ", type: "company", country: "UAE", city: "Dubai", latitude: 25.1972, longitude: 55.2744, operator: "Emaar", description: "Developer of Burj Khalifa, major real estate company", threatLevel: "low", region: "MENA", status: "active" },
  { name: "STC (Saudi Telecom) HQ", type: "company", country: "Saudi Arabia", city: "Riyadh", latitude: 24.6877, longitude: 46.6979, operator: "STC", description: "Saudi Arabia's largest telecom company", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "SABIC HQ", type: "company", country: "Saudi Arabia", city: "Riyadh", latitude: 24.6877, longitude: 46.6979, operator: "Saudi Aramco / SABIC", description: "World's 4th largest petrochemical company", threatLevel: "medium", region: "MENA", status: "active" },
  { name: "Mubadala Investment Company", type: "company", country: "UAE", city: "Abu Dhabi", latitude: 24.4539, longitude: 54.3773, operator: "Abu Dhabi Government", description: "Abu Dhabi sovereign wealth fund", threatLevel: "medium", region: "MENA", status: "active" },
];

async function seed() {
  console.log("🌱 Starting database seed...");
  const db = await getDb();

  // Seed News Agencies
  console.log(`📰 Seeding ${MENA_AGENCIES.length} news agencies...`);
  let agencyCount = 0;
  for (const agency of MENA_AGENCIES) {
    try {
      await db.insert(newsAgencies).values({
        name: agency.name,
        nameAr: agency.nameAr,
        country: agency.country,
        region: agency.region,
        type: agency.type as any,
        website: agency.website,
        rssFeeds: JSON.parse(agency.rssFeeds),
        language: agency.language,
        bias: agency.bias as any,
        reliability: agency.reliability,
        isActive: agency.isActive,
      }).onDuplicateKeyUpdate({ set: { name: agency.name } });
      agencyCount++;
    } catch (e: any) {
      // Skip duplicates
    }
  }
  console.log(`✅ Seeded ${agencyCount} news agencies`);

  // Seed Facilities
  console.log(`🏭 Seeding ${GLOBAL_FACILITIES.length} facilities...`);
  let facilityCount = 0;
  for (const facility of GLOBAL_FACILITIES) {
    try {
      await db.insert(facilities).values({
        name: facility.name,
        type: facility.type as any,
        country: facility.country,
        city: facility.city,
        latitude: facility.latitude,
        longitude: facility.longitude,
        operator: facility.operator,
        description: facility.description,
        threatLevel: facility.threatLevel as any,
        region: facility.region,
        status: facility.status as any,
      }).onDuplicateKeyUpdate({ set: { name: facility.name } });
      facilityCount++;
    } catch (e: any) {
      // Skip duplicates
    }
  }
  console.log(`✅ Seeded ${facilityCount} facilities`);

  console.log("🎉 Seed complete!");
  process.exit(0);
}

seed().catch(e => {
  console.error("Seed failed:", e);
  process.exit(1);
});
