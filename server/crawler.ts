import RSSParser from "rss-parser";
/**
 * crawler.ts — Redroom RSS Crawl Engine
 *
 * Responsible for fetching, parsing, deduplicating, and classifying
 * open-source news articles from registered news agencies.
 *
 * Workflow:
 *   1. Accept a news agency record (from the `news_agencies` table).
 *   2. Fetch the agency's RSS feed URL using Node's native http/https.
 *   3. Parse the XML feed with rss-parser.
 *   4. Deduplicate articles against the database using URL hash matching.
 *   5. Score each article for sentiment and classify by topic / region / threat level.
 *   6. Insert new articles into the `articles` table.
 *   7. Emit a `newArticle` event on the crawlEventBus for live feed subscribers.
 *
 * This module is called by missionScheduler.ts (scheduled runs) and by
 * the `cms.triggerCrawl` tRPC procedure (manual runs from the CMS).
 *
 * @module crawler
 */
import { getDb } from "./db";
import { newsAgencies, articles, crawlJobs, facilities, articleFacilityLinks } from "../drizzle/schema";
import { eq, and, lt, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { crawlEventBus } from "./crawlEventBus";
import * as https from "https";
import * as http from "http";
const rssParser = new RSSParser({
  timeout: 15000,
  headers: { 'User-Agent': 'RedroomBot/1.0; +https://redroom.live' },
});

/** Fetch a URL using Node's native http/https module (bypasses rss-parser TLS issues) */
function fetchUrl(url: string, timeoutMs = 15000): Promise<string> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GeopoliticalIntelligence/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: timeoutMs,
      rejectUnauthorized: false, // Some hosts (e.g. news.google.com) fail TLS cert check in this env
    }, (res) => {
      // Follow redirects
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        req.destroy();
        return fetchUrl(res.headers.location, timeoutMs).then(resolve).catch(reject);
      }
      if (res.statusCode && res.statusCode >= 400) {
        req.destroy();
        return reject(new Error(`Status code ${res.statusCode}`));
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Request timed out')); });
  });
}

// ─── Active job registry (jobId → AbortController) ───────────────────────────
const activeJobs = new Map<number, AbortController>();

export function getActiveJobIds(): number[] {
  return Array.from(activeJobs.keys());
}

export function cancelJob(jobId: number): boolean {
  const ctrl = activeJobs.get(jobId);
  if (!ctrl) return false;
  ctrl.abort();
  activeJobs.delete(jobId);
  return true;
}

// ─── On startup: mark any jobs stuck in "running" as failed ──────────────────
export async function cleanupStuckJobs(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  // Mark all running jobs as failed — they were interrupted by a server restart
  const result = await db.update(crawlJobs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Server restarted — job interrupted',
    })
    .where(eq(crawlJobs.status, 'running'));
  const count = (result as any)[0]?.affectedRows ?? 0;
  if (count > 0) {
    console.log(`[Crawler] Cleaned up ${count} stuck running jobs on startup`);
  }
  return count;
}

// ─── Periodic cleanup: mark jobs running for >5 minutes as timed out ─────────
export async function cleanupTimedOutJobs(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
  const result = await db.update(crawlJobs)
    .set({
      status: 'failed',
      completedAt: new Date(),
      errorMessage: 'Timed out — exceeded 5 minute limit',
    })
    .where(and(
      eq(crawlJobs.status, 'running'),
      lt(crawlJobs.startedAt, fiveMinutesAgo),
    ));
  const count = (result as any)[0]?.affectedRows ?? 0;
  if (count > 0) {
    console.log(`[Crawler] Timed out ${count} stuck running jobs`);
    crawlEventBus.publish({
      jobId: 0, agencyId: 0, agencyName: 'system',
      stage: 'job_fail', error: `${count} jobs timed out`,
    });
  }
}

// ─── Topic / sentiment / country helpers ─────────────────────────────────────
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'WAR/CONFLICT': ['war', 'conflict', 'attack', 'strike', 'military', 'troops', 'battle', 'bomb', 'missile', 'airstrike', 'invasion', 'ceasefire', 'hostilities', 'armed', 'weapon', 'drone', 'explosion', 'casualties', 'killed', 'wounded'],
  'ECONOMY': ['economy', 'economic', 'gdp', 'inflation', 'trade', 'oil', 'gas', 'market', 'investment', 'sanctions', 'currency', 'budget', 'debt', 'finance', 'bank', 'stock', 'price', 'export', 'import'],
  'POLITICS': ['government', 'president', 'minister', 'election', 'parliament', 'policy', 'diplomatic', 'treaty', 'summit', 'vote', 'party', 'opposition', 'coup', 'protest', 'demonstration', 'political'],
  'TECHNOLOGY': ['technology', 'cyber', 'digital', 'ai', 'artificial intelligence', 'hack', 'data', 'internet', 'satellite', 'drone', 'surveillance', 'software', 'tech', 'innovation'],
  'ENERGY': ['oil', 'gas', 'energy', 'pipeline', 'refinery', 'opec', 'petroleum', 'nuclear', 'power plant', 'electricity', 'renewable', 'solar', 'wind'],
  'DIPLOMACY': ['diplomacy', 'diplomatic', 'ambassador', 'embassy', 'treaty', 'agreement', 'negotiation', 'talks', 'meeting', 'summit', 'bilateral', 'multilateral', 'un', 'united nations'],
  'SECURITY': ['security', 'terrorism', 'terrorist', 'isis', 'al-qaeda', 'extremist', 'intelligence', 'spy', 'surveillance', 'threat', 'danger', 'risk', 'border', 'checkpoint'],
  'HUMANITARIAN': ['humanitarian', 'refugee', 'displaced', 'aid', 'relief', 'crisis', 'famine', 'drought', 'flood', 'disaster', 'civilian', 'hospital', 'medical', 'food', 'water'],
};
const MENA_COUNTRIES: Record<string, string> = {
  'saudi': 'Saudi Arabia', 'riyadh': 'Saudi Arabia', 'jeddah': 'Saudi Arabia',
  'iran': 'Iran', 'tehran': 'Iran', 'isfahan': 'Iran',
  'iraq': 'Iraq', 'baghdad': 'Iraq', 'basra': 'Iraq', 'mosul': 'Iraq',
  'israel': 'Israel', 'tel aviv': 'Israel', 'jerusalem': 'Israel',
  'palestine': 'Palestine', 'gaza': 'Palestine', 'west bank': 'Palestine', 'ramallah': 'Palestine',
  'egypt': 'Egypt', 'cairo': 'Egypt', 'alexandria': 'Egypt',
  'jordan': 'Jordan', 'amman': 'Jordan',
  'lebanon': 'Lebanon', 'beirut': 'Lebanon',
  'syria': 'Syria', 'damascus': 'Syria', 'aleppo': 'Syria',
  'turkey': 'Turkey', 'ankara': 'Turkey', 'istanbul': 'Turkey',
  'uae': 'UAE', 'dubai': 'UAE', 'abu dhabi': 'UAE',
  'qatar': 'Qatar', 'doha': 'Qatar',
  'kuwait': 'Kuwait', 'bahrain': 'Bahrain', 'oman': 'Oman', 'muscat': 'Oman',
  'yemen': 'Yemen', 'sanaa': 'Yemen', 'aden': 'Yemen',
  'libya': 'Libya', 'tripoli': 'Libya', 'benghazi': 'Libya',
  'tunisia': 'Tunisia', 'tunis': 'Tunisia',
  'algeria': 'Algeria', 'algiers': 'Algeria',
  'morocco': 'Morocco', 'rabat': 'Morocco', 'casablanca': 'Morocco',
  'sudan': 'Sudan', 'khartoum': 'Sudan',
};

function detectTopics(text: string): string[] {
  const lower = text.toLowerCase();
  return Object.entries(TOPIC_KEYWORDS)
    .filter(([, keywords]) => keywords.some(kw => lower.includes(kw)))
    .map(([topic]) => topic);
}

function detectCountry(text: string): string {
  const lower = text.toLowerCase();
  for (const [keyword, country] of Object.entries(MENA_COUNTRIES)) {
    if (lower.includes(keyword)) return country;
  }
  return '';
}

function detectSentiment(text: string): { sentiment: string; score: number } {
  const lower = text.toLowerCase();
  const negWords = ['war', 'attack', 'killed', 'bomb', 'crisis', 'conflict', 'death', 'explosion', 'threat', 'danger', 'terror', 'violence', 'casualties', 'wounded', 'destroyed', 'collapse', 'sanctions', 'protest', 'coup', 'invasion'];
  const posWords = ['peace', 'agreement', 'deal', 'cooperation', 'growth', 'success', 'progress', 'development', 'aid', 'relief', 'ceasefire', 'reconciliation', 'summit', 'partnership'];
  let score = 0;
  negWords.forEach(w => { if (lower.includes(w)) score -= 0.15; });
  posWords.forEach(w => { if (lower.includes(w)) score += 0.1; });
  score = Math.max(-1, Math.min(1, score));
  return { sentiment: score < -0.1 ? 'negative' : score > 0.1 ? 'positive' : 'neutral', score: Math.round(score * 10) / 10 };
}

function detectImportance(title: string, topics: string[]): number {
  let score = 5;
  const lower = title.toLowerCase();
  if (lower.includes('breaking') || lower.includes('urgent') || lower.includes('alert')) score += 3;
  if (topics.includes('WAR/CONFLICT')) score += 2;
  if (topics.includes('SECURITY')) score += 1;
  if (topics.includes('DIPLOMACY')) score += 1;
  return Math.min(10, score);
}

function isBreakingNews(title: string, topics: string[]): boolean {
  const breakingKeywords = ['breaking', 'urgent', 'alert', 'just in', 'developing', 'flash'];
  const lowerTitle = title.toLowerCase();
  return breakingKeywords.some(kw => lowerTitle.includes(kw)) || topics.includes('WAR/CONFLICT');
}

/** Fire-and-forget: enrich an already-saved article with LLM entity extraction */
async function enrichArticleAsync(
  articleId: number,
  jobId: number,
  agencyId: number,
  agencyName: string,
  feedUrl: string,
  region: string,
  title: string,
  content: string,
): Promise<void> {
  const base = { jobId, agencyId, agencyName, feedUrl, region };
  try {
    const response = await invokeLLM({
      messages: [
        { role: 'system', content: 'You are a geopolitical news entity extractor. Extract named entities from news articles. Return JSON only.' },
        { role: 'user', content: `Extract entities from this news article. Return JSON with keys: persons, organizations, locations, facilities, events (each is an array of strings).\nTitle: ${title}\nContent: ${content.substring(0, 500)}` },
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'entities',
          strict: true,
          schema: {
            type: 'object',
            properties: {
              persons:       { type: 'array', items: { type: 'string' } },
              organizations: { type: 'array', items: { type: 'string' } },
              locations:     { type: 'array', items: { type: 'string' } },
              facilities:    { type: 'array', items: { type: 'string' } },
              events:        { type: 'array', items: { type: 'string' } },
            },
            required: ['persons','organizations','locations','facilities','events'],
            additionalProperties: false,
          },
        },
      },
    });
    const raw = response.choices?.[0]?.message?.content;
    if (raw && typeof raw === 'string') {
      const entities = JSON.parse(raw);
      const db = await getDb();
      if (db) {
        await db.update(articles).set({ entitiesJson: JSON.stringify(entities) }).where(eq(articles.id, articleId));
        await matchFacilitiesInArticle(articleId, entities);
      }
      crawlEventBus.publish({ ...base, stage: 'enrich_done', articleTitle: title });
    }
  } catch {
    // silently ignore — article already saved without entities
  }
}

async function matchFacilitiesInArticle(articleId: number, entities: { facilities: string[]; locations: string[] }) {
  const db = await getDb();
  if (!db) return;
  const allFacilities = await db.select({
    id: facilities.id, name: facilities.name,
    nameAlias: facilities.nameAlias, nameAr: facilities.nameAr,
    country: facilities.country, city: facilities.city,
  }).from(facilities).limit(2000);
  const mentionedNames = [...entities.facilities, ...entities.locations];
  if (!mentionedNames.length) return;

  // Build a lookup of all names/aliases per facility
  for (const fac of allFacilities) {
    const namesToCheck: string[] = [fac.name];
    if (fac.nameAlias) {
      namesToCheck.push(...fac.nameAlias.split(',').map((s: string) => s.trim()).filter(Boolean));
    }
    if (fac.nameAr) namesToCheck.push(fac.nameAr);

    let bestMatch: { mention: string; confidence: number } | null = null;

    for (const facName of namesToCheck) {
      // Skip very short names (< 4 chars) to avoid false positives like "Dam", "Air"
      if (facName.length < 4) continue;
      const facNameLower = facName.toLowerCase();

      for (const mention of mentionedNames) {
        const mentionLower = mention.toLowerCase();
        // Skip very short mentions
        if (mentionLower.length < 4) continue;

        // Exact match (highest confidence)
        if (mentionLower === facNameLower) {
          bestMatch = { mention, confidence: 0.95 };
          break;
        }

        // Facility name is a significant substring of the mention (e.g. "Negev Nuclear Research Center" in "the Negev Nuclear Research Center facility")
        // Require the facility name to be at least 60% of the mention length to avoid partial noise
        if (mentionLower.includes(facNameLower) && facNameLower.length >= mentionLower.length * 0.5) {
          const conf = Math.min(0.9, 0.7 + (facNameLower.length / mentionLower.length) * 0.2);
          if (!bestMatch || conf > bestMatch.confidence) {
            bestMatch = { mention, confidence: conf };
          }
        }

        // Mention is a significant substring of facility name (e.g. "Negev Nuclear" in "Negev Nuclear Research Center")
        // Require the mention to be at least 60% of the facility name length
        if (facNameLower.includes(mentionLower) && mentionLower.length >= facNameLower.length * 0.6) {
          const conf = Math.min(0.85, 0.65 + (mentionLower.length / facNameLower.length) * 0.2);
          if (!bestMatch || conf > bestMatch.confidence) {
            bestMatch = { mention, confidence: conf };
          }
        }
      }
      if (bestMatch && bestMatch.confidence >= 0.9) break; // exact or near-exact, stop checking aliases
    }

    // Only link if confidence is high enough
    if (bestMatch && bestMatch.confidence >= 0.7) {
      try {
        await db.insert(articleFacilityLinks).values({
          articleId, facilityId: fac.id, mentionType: 'general',
          confidence: bestMatch.confidence, excerpt: bestMatch.mention,
        });
      } catch { /* duplicate */ }
    }
  }
}

// ─── Core RSS crawl function ──────────────────────────────────────────────────
export async function crawlAgencyRSS(
  agencyId: number,
  rssUrl: string,
  region: string,
  topics: string[],
  jobId: number = 0,
  agencyName: string = `Agency #${agencyId}`,
  signal?: AbortSignal,
): Promise<{ found: number; inserted: number }> {
  const db = await getDb();
  if (!db) return { found: 0, inserted: 0 };
  let found = 0;
  let inserted = 0;
  const base = { jobId, agencyId, agencyName, feedUrl: rssUrl, region };

  // Check if cancelled before starting
  if (signal?.aborted) return { found: 0, inserted: 0 };

  // ── Stage 1: HTTP Fetch ───────────────────────────────────────────────────
  crawlEventBus.publish({ ...base, stage: 'fetch_start' });
  let feed: Awaited<ReturnType<typeof rssParser.parseURL>>;
  try {
    // Try rss-parser first; fall back to native https fetch + parseString on ECONNRESET/TLS errors
    const tryParse = async (): Promise<Awaited<ReturnType<typeof rssParser.parseURL>>> => {
      try {
        return await rssParser.parseURL(rssUrl);
      } catch (primaryErr: any) {
        const msg = primaryErr?.message ?? '';
        const isTlsErr = msg.includes('ECONNRESET') || msg.includes('TLS') || msg.includes('socket disconnected') || msg.includes('network socket');
        if (!isTlsErr) throw primaryErr;
        // Fallback: fetch with native https then parse the XML string
        const xml = await fetchUrl(rssUrl);
        return rssParser.parseString(xml);
      }
    };
    const fetchPromise = tryParse();
    if (signal) {
      feed = await Promise.race([
        fetchPromise,
        new Promise<never>((_, reject) => {
          signal.addEventListener('abort', () => reject(new Error('Job cancelled')), { once: true });
        }),
      ]);
    } else {
      feed = await fetchPromise;
    }
    found = feed.items.length;
    crawlEventBus.publish({ ...base, stage: 'fetch_ok', itemsFound: found });
  } catch (e: any) {
    const isCancelled = e.message === 'Job cancelled' || signal?.aborted;
    crawlEventBus.publish({ ...base, stage: 'fetch_fail', error: isCancelled ? 'Cancelled' : e.message });
    if (!isCancelled) {
      console.error(`[Crawler] RSS error for agency ${agencyId}:`, e.message);
    }
    return { found: 0, inserted: 0 };
  }

  // ── Stage 2–5: Parse → Enrich → DB for each item ─────────────────────────
  for (const item of feed.items.slice(0, 20)) {
    // Check abort between articles
    if (signal?.aborted) break;

    if (!item.title || !item.link) continue;
    // Stage 2: Parse
    crawlEventBus.publish({ ...base, stage: 'parse_item', articleTitle: item.title, articleUrl: item.link });
    const detectedTopics = detectTopics((item.title || '') + ' ' + (item.contentSnippet || ''));
    if (topics.length > 0 && !topics.some(t => detectedTopics.includes(t))) continue;
    const country = detectCountry((item.title || '') + ' ' + (item.contentSnippet || ''));
    const sentimentResult = detectSentiment((item.title || '') + ' ' + (item.contentSnippet || ''));
    const importance = detectImportance(item.title || '', detectedTopics);
    const breaking = isBreakingNews(item.title || '', detectedTopics);

    // Stage 3: DB Insert
    let newArticleId: number | null = null;
    try {
      const result = await db.insert(articles).values({
        title: item.title,
        content: item.content || item.contentSnippet || '',
        summary: item.contentSnippet || item.title,
        url: item.link,
        imageUrl: (item as any)['media:content']?.$.url || (item as any).enclosure?.url || '',
        agencyId,
        author: item.creator || item.author || '',
        publishedAt: item.pubDate ? new Date(item.pubDate) : new Date(),
        language: 'en',
        country,
        region,
        categories: detectedTopics as any,
        topics: detectedTopics as any,
        sentiment: sentimentResult.sentiment as 'positive' | 'negative' | 'neutral' | 'mixed',
        sentimentScore: sentimentResult.score,
        importance,
        isBreaking: breaking,
        isTrending: false,
        keywords: [] as any,
        entitiesJson: JSON.stringify({ persons: [], organizations: [], locations: [], facilities: [], events: [] }),
      });
      newArticleId = (result as any)[0]?.insertId as number || null;
    } catch (e: any) {
      const isDup =
        e.code === 'ER_DUP_ENTRY' ||
        (e.message && e.message.includes('Duplicate')) ||
        (e.cause?.code === 'ER_DUP_ENTRY') ||
        (e.cause?.errno === 1062) ||
        (e.message && e.message.includes('1062'));
      if (!isDup) {
        console.error(`[Crawler] Article insert error (skipping): ${e.cause?.message || e.message}`.substring(0, 200));
      }
      newArticleId = null;
    }

    if (newArticleId) {
      inserted++;
      crawlEventBus.publish({ ...base, stage: 'db_insert', articleTitle: item.title, articleUrl: item.link });
      // Stage 4: Enrich asynchronously — fire-and-forget
      crawlEventBus.publish({ ...base, stage: 'enrich_start', articleTitle: item.title, articleUrl: item.link });
      enrichArticleAsync(newArticleId, jobId, agencyId, agencyName, rssUrl, region, item.title, item.contentSnippet || '');
    } else {
      crawlEventBus.publish({ ...base, stage: 'db_dup', articleTitle: item.title, articleUrl: item.link });
    }
  }

  // Update agency lastCrawled
  await db.update(newsAgencies).set({ lastCrawled: new Date() }).where(eq(newsAgencies.id, agencyId));
  return { found, inserted };
}

// ─── Run a single crawl job (by job DB row id) ────────────────────────────────
export async function runCrawlJob(jobId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Register abort controller
  const abortCtrl = new AbortController();
  activeJobs.set(jobId, abortCtrl);

  // Set a 5-minute hard timeout
  const timeoutId = setTimeout(() => {
    if (activeJobs.has(jobId)) {
      console.warn(`[Crawler] Job ${jobId} exceeded 5-minute timeout — aborting`);
      abortCtrl.abort();
    }
  }, 5 * 60 * 1000);

  await db.update(crawlJobs).set({ status: 'running', startedAt: new Date() }).where(eq(crawlJobs.id, jobId));
  try {
    const [job] = await db.select().from(crawlJobs).where(eq(crawlJobs.id, jobId)).limit(1);
    if (!job) {
      activeJobs.delete(jobId);
      clearTimeout(timeoutId);
      return;
    }
    const [agency] = await db.select().from(newsAgencies).where(eq(newsAgencies.id, job.agencyId)).limit(1);
    if (!agency || !agency.rssFeeds) {
      await db.update(crawlJobs).set({ status: 'failed', completedAt: new Date(), errorMessage: 'Agency not found or no RSS feeds' }).where(eq(crawlJobs.id, jobId));
      activeJobs.delete(jobId);
      clearTimeout(timeoutId);
      return;
    }
    const agencyName = agency.name ?? `Agency #${agency.id}`;
    crawlEventBus.publish({ jobId, agencyId: agency.id, agencyName, stage: 'job_start', region: job.region ?? 'MENA' });
    let totalFound = 0;
    let totalInserted = 0;
    const rawFeeds = agency.rssFeeds as Array<string | { url?: string; label?: string; type?: string }>;
    // Normalize: support both plain URL strings and {label, type, url} objects
    const feeds: string[] = rawFeeds
      .map(f => typeof f === 'string' ? f : (f?.url ?? ''))
      .filter(Boolean);
    const jobTopics = (job.topics as string[]) || [];
    for (const feedUrl of feeds) {
      if (abortCtrl.signal.aborted) break;
      const { found, inserted } = await crawlAgencyRSS(
        agency.id, feedUrl, job.region || 'MENA', jobTopics, jobId, agencyName, abortCtrl.signal,
      );
      totalFound += found;
      totalInserted += inserted;
    }

    clearTimeout(timeoutId);
    activeJobs.delete(jobId);

    if (abortCtrl.signal.aborted) {
      await db.update(crawlJobs).set({
        status: 'failed', completedAt: new Date(),
        articlesFound: totalFound, articlesNew: totalInserted,
        errorMessage: 'Cancelled by user',
      }).where(eq(crawlJobs.id, jobId));
      crawlEventBus.publish({ jobId, agencyId: agency.id, agencyName, stage: 'job_fail', error: 'Cancelled by user', region: job.region ?? 'MENA' });
    } else {
      await db.update(crawlJobs).set({
        status: 'completed', completedAt: new Date(),
        articlesFound: totalFound, articlesNew: totalInserted,
      }).where(eq(crawlJobs.id, jobId));
      crawlEventBus.publish({ jobId, agencyId: agency.id, agencyName, stage: 'job_done', articlesNew: totalInserted, region: job.region ?? 'MENA' });
    }
  } catch (e: any) {
    clearTimeout(timeoutId);
    activeJobs.delete(jobId);
    await db.update(crawlJobs).set({ status: 'failed', completedAt: new Date(), errorMessage: e.message }).where(eq(crawlJobs.id, jobId));
    crawlEventBus.publish({ jobId, agencyId: 0, agencyName: 'unknown', stage: 'job_fail', error: e.message });
  }
}

// ─── Create a job row and run it immediately (fire-and-forget) ────────────────
export async function createJobAndRun(
  agencyId: number,
  region: string,
  topics: string[],
): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.insert(crawlJobs).values({
    agencyId, region, topics: topics as any, status: 'pending',
  });
  const jobId = (result as any)[0]?.insertId as number;
  if (!jobId) { console.error('[Crawler] createJobAndRun: failed to get insertId'); return 0; }
  runCrawlJob(jobId).catch(e => console.error('[Crawler] runCrawlJob error:', e));
  return jobId;
}

// ─── Schedule multiple jobs for all active agencies ───────────────────────────
export async function scheduleCrawl(region: string, topics: string[]): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const agencies = await db.select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
    .from(newsAgencies)
    .where(eq(newsAgencies.isActive, true))
    .limit(50);
  let jobCount = 0;
  for (const agency of agencies) {
    if (!agency.rssFeeds || (agency.rssFeeds as string[]).length === 0) continue;
    const res = await db.insert(crawlJobs).values({ agencyId: agency.id, region, topics: topics as any, status: 'pending' });
    const jid = (res as any)[0]?.insertId as number;
    if (jid) {
      runCrawlJob(jid).catch(e => console.error('[Crawler] scheduleCrawl job error:', e));
      jobCount++;
    }
  }
  return jobCount;
}
