import { eq, desc, and, or, like, gte, lte, inArray, sql } from "drizzle-orm";
/**
 * db.ts — Redroom Database Query Helpers
 *
 * Provides a lazy-initialised Drizzle ORM connection and a collection of
 * typed query helper functions used across tRPC router procedures.
 *
 * Design principles:
 *   - `getDb()` returns the shared Drizzle instance, creating it on first call.
 *   - All query helpers accept typed parameters and return raw Drizzle row objects.
 *   - Procedures in the routers call these helpers rather than constructing
 *     queries inline, keeping router files focused on input validation and
 *     response shaping.
 *   - No business logic lives here — only data access.
 *
 * @module db
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2";
import { InsertUser, users, newsAgencies, facilities, articles, crawlJobs, notifications, watchlists, articleFacilityLinks, facilitySources, facilityCandidates, facilityEnrichmentJobs } from "../drizzle/schema";
import type { InsertNewsAgency, InsertFacility, InsertArticle, InsertFacilitySource, InsertFacilityCandidate, InsertFacilityEnrichmentJob } from "../drizzle/schema";
import { ENV } from './_core/env';
import { cache, CacheKeys, TTL_STATS, TTL_REFERENCE } from "./cache";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      // Use connection pool optimized for high concurrency (200K+ users)
      _pool = mysql.createPool({
        uri: process.env.DATABASE_URL,
        connectionLimit: 20,        // Max connections in pool
        maxIdle: 10,                // Max idle connections
        idleTimeout: 60000,         // Close idle connections after 60s
        waitForConnections: true,   // Queue requests when pool is full
        queueLimit: 200,            // Max queued requests before rejecting
        enableKeepAlive: true,      // Keep TCP connections alive
        keepAliveInitialDelay: 10000, // Keep-alive after 10s idle
        connectTimeout: 10000,      // 10s connection timeout
      });
      _db = drizzle(_pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

/** Get the raw mysql2 pool for health checks */
export function getPool() { return _pool; }

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }
  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod", "passwordHash"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── News Agencies ────────────────────────────────────────────────────────────
export async function getNewsAgencies(region?: string, limit = 100) {
  const cacheKey = `ref:agencies:${region || 'all'}:${limit}`;
  return cache.getOrFetch(cacheKey, async () => {
    const db = await getDb();
    if (!db) return [];
    const regionFilter = region && region !== 'Global' ? eq(newsAgencies.region, region) : undefined;
    return db.select().from(newsAgencies).where(
      and(
        eq(newsAgencies.isActive, true),
        regionFilter
      )
    ).orderBy(desc(newsAgencies.reliability)).limit(limit);
  }, TTL_REFERENCE);
}

export async function getNewsAgencyById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(newsAgencies).where(eq(newsAgencies.id, id)).limit(1);
  return result[0] ?? null;
}

export async function upsertNewsAgency(agency: InsertNewsAgency) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(newsAgencies).values(agency).onDuplicateKeyUpdate({ set: { updatedAt: new Date() } });
  return agency;
}

export async function bulkInsertNewsAgencies(agencies: InsertNewsAgency[]) {
  const db = await getDb();
  if (!db) return 0;
  let count = 0;
  for (const agency of agencies) {
    try {
      await db.insert(newsAgencies).values(agency).onDuplicateKeyUpdate({ set: { name: agency.name, updatedAt: new Date() } });
      count++;
    } catch (e) { /* skip duplicates */ }
  }
  return count;
}

// ─── Facilities ───────────────────────────────────────────────────────────────
export async function getFacilities(opts?: { region?: string; types?: string[]; limit?: number }) {
  const cacheKey = `ref:facilities:${opts?.region || 'all'}:${(opts?.types || []).join(',')}:${opts?.limit || 500}`;
  return cache.getOrFetch(cacheKey, async () => {
    const db = await getDb();
    if (!db) return [];
    const conditions = [];
    if (opts?.region && opts.region !== 'Global') conditions.push(eq(facilities.region, opts.region));
    if (opts?.types?.length) conditions.push(inArray(facilities.type, opts.types as any[]));
    return db.select().from(facilities)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(facilities.importance))
      .limit(opts?.limit ?? 500);
  }, TTL_REFERENCE);
}

export async function getFacilityById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(facilities).where(eq(facilities.id, id)).limit(1);
  return result[0] ?? null;
}

export async function bulkInsertFacilities(facs: InsertFacility[]) {
  const db = await getDb();
  if (!db) return 0;
  let count = 0;
  for (const fac of facs) {
    try {
      await db.insert(facilities).values(fac).onDuplicateKeyUpdate({ set: { name: fac.name, updatedAt: new Date() } });
      count++;
    } catch (e) { /* skip */ }
  }
  return count;
}

// ─── Article Serialization ───────────────────────────────────────────────────
// Superjson hits [Max Depth] on nested JSON columns (topics, keywords, entitiesJson, categories).
// Serialize them as plain strings so tRPC can transmit them without depth issues.
export function serializeArticle(row: Record<string, unknown>) {
  return {
    id: row.id as number,
    title: (row.title as string) ?? '',
    titleAr: (row.titleAr as string | null) ?? null,
    content: (row.content as string | null) ?? null,
    summary: (row.summary as string | null) ?? null,
    url: (row.url as string) ?? '',
    imageUrl: (row.imageUrl as string | null) ?? null,
    agencyId: (row.agencyId as number | null) ?? null,
    author: (row.author as string | null) ?? null,
    publishedAt: (row.publishedAt as Date | null)?.toISOString() ?? null,
    crawledAt: (row.crawledAt as Date | null)?.toISOString() ?? null,
    language: (row.language as string | null) ?? 'en',
    country: (row.country as string | null) ?? null,
    region: (row.region as string | null) ?? null,
    categoriesJson: JSON.stringify(row.categories ?? []),
    topicsJson: JSON.stringify(row.topics ?? []),
    keywordsJson: JSON.stringify(row.keywords ?? []),
    entitiesJson: typeof row.entitiesJson === 'string' ? row.entitiesJson : JSON.stringify(row.entitiesJson ?? {}),
    sentiment: (row.sentiment as string | null) ?? 'neutral',
    sentimentScore: (row.sentimentScore as number | null) ?? 0,
    importance: (row.importance as number | null) ?? 5,
    isBreaking: (row.isBreaking as boolean | null) ?? false,
    isTrending: (row.isTrending as boolean | null) ?? false,
    viewCount: (row.viewCount as number | null) ?? 0,
    shareCount: (row.shareCount as number | null) ?? 0,
    replicatedFrom: (row.replicatedFrom as number | null) ?? null,
    replicationCount: (row.replicationCount as number | null) ?? 0,
    storageKey: (row.storageKey as string | null) ?? null,
    createdAt: (row.createdAt as Date | null)?.toISOString() ?? null,
  };
}

// ─── Articles ─────────────────────────────────────────────────────────────────
export async function getArticles(opts?: {
  region?: string;
  topics?: string[];
  agencyIds?: number[];
  isBreaking?: boolean;
  limit?: number;
  offset?: number;
  search?: string;
  since?: Date;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (opts?.region && opts.region !== 'Global') conditions.push(eq(articles.region, opts.region));
  if (opts?.isBreaking) conditions.push(eq(articles.isBreaking, true));
  if (opts?.agencyIds?.length) conditions.push(inArray(articles.agencyId, opts.agencyIds));
  if (opts?.since) conditions.push(gte(articles.publishedAt, opts.since));
  if (opts?.search) conditions.push(like(articles.title, `%${opts.search}%`));
  // Topic filter: use JSON_CONTAINS to match any article that has at least one of the requested topics
  if (opts?.topics?.length) {
    const topicConditions = opts.topics.map(topic =>
      sql`JSON_CONTAINS(topics, ${JSON.stringify(topic)}, '$')`
    );
    conditions.push(topicConditions.length === 1 ? topicConditions[0] : or(...topicConditions));
  }
  return db.select().from(articles)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(desc(articles.publishedAt))
    .limit(opts?.limit ?? 500)
    .offset(opts?.offset ?? 0);
}

export async function getArticleById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  return result[0] ?? null;
}

export async function insertArticle(article: InsertArticle) {
  const db = await getDb();
  if (!db) return null;
  try {
    await db.insert(articles).values(article);
    return article;
  } catch (e: any) {
    if (e.code === 'ER_DUP_ENTRY') return null; // duplicate URL
    throw e;
  }
}

export async function getArticleStats(region?: string) {
  const cacheKey = CacheKeys.articleStats(region || "global");
  return cache.getOrFetch(cacheKey, async () => {
    const db = await getDb();
    if (!db) return { total: 0, breaking: 0, today: 0, sources: 0 };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const regionFilter = region && region !== 'Global' ? eq(articles.region, region) : undefined;
    const [total] = await db.select({ count: sql<number>`COUNT(*)` }).from(articles)
      .where(regionFilter);
    const [breaking] = await db.select({ count: sql<number>`COUNT(*)` }).from(articles)
      .where(and(eq(articles.isBreaking, true), regionFilter));
    const [todayCount] = await db.select({ count: sql<number>`COUNT(*)` }).from(articles)
      .where(and(gte(articles.publishedAt, today), regionFilter));
    const [sourcesCount] = await db.select({ count: sql<number>`COUNT(DISTINCT agencyId)` }).from(articles)
      .where(regionFilter);
    return { total: total?.count ?? 0, breaking: breaking?.count ?? 0, today: todayCount?.count ?? 0, sources: sourcesCount?.count ?? 0 };
  }, TTL_STATS);
}

export async function getTrendingTopics(region?: string, limit = 10) {
  const db = await getDb();
  if (!db) return [];
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return db.select().from(articles)
    .where(and(gte(articles.publishedAt, since), region && region !== 'Global' ? eq(articles.region, region) : undefined))
    .orderBy(desc(articles.importance), desc(articles.viewCount))
    .limit(limit);
}

// ─── Article-Facility Links ───────────────────────────────────────────────────
export async function getArticleFacilityLinks(articleId?: number, facilityId?: number, minConfidence = 0.7) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (articleId) conditions.push(eq(articleFacilityLinks.articleId, articleId));
  if (facilityId) conditions.push(eq(articleFacilityLinks.facilityId, facilityId));
  conditions.push(gte(articleFacilityLinks.confidence, minConfidence));
  return db.select().from(articleFacilityLinks)
    .where(and(...conditions))
    .limit(200);
}

export async function insertArticleFacilityLink(link: { articleId: number; facilityId: number; mentionType?: string; confidence?: number; excerpt?: string }) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(articleFacilityLinks).values(link as any);
  return link;
}

// ─── Crawl Jobs ───────────────────────────────────────────────────────────────
export async function createCrawlJob(agencyId: number, region: string, topics: string[]) {
  const db = await getDb();
  if (!db) return null;
  await db.insert(crawlJobs).values({ agencyId, region, topics: topics as any, status: 'pending' });
}

export async function updateCrawlJob(id: number, updates: Partial<{ status: string; startedAt: Date; completedAt: Date; articlesFound: number; articlesNew: number; errorMessage: string }>) {
  const db = await getDb();
  if (!db) return;
  await db.update(crawlJobs).set(updates as any).where(eq(crawlJobs.id, id));
}

export async function getRecentCrawlJobs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crawlJobs).orderBy(desc(crawlJobs.createdAt)).limit(limit);
}

// ─── Notifications ────────────────────────────────────────────────────────────
export async function getNotifications(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(notifications).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function createNotification(data: { type: string; title: string; message?: string; severity?: string; region?: string; articleId?: number; facilityId?: number }) {
  const db = await getDb();
  if (!db) return;
  await db.insert(notifications).values(data as any);
}

export async function markNotificationRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(notifications).set({ isRead: true }).where(eq(notifications.id, id));
}

// ─── Facility Management ──────────────────────────────────────────────────────

export async function createFacility(fac: InsertFacility) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(facilities).values(fac as any);
  const id = (result as any)[0]?.insertId ?? null;
  return id ? getFacilityById(id) : null;
}

export async function updateFacility(id: number, updates: Partial<InsertFacility> & { auditEntry?: { action: string; by: string; at: string; detail: string } }) {
  const db = await getDb();
  if (!db) return null;
  const { auditEntry, ...rest } = updates;
  // Append to auditLog JSON array
  if (auditEntry) {
    const existing = await getFacilityById(id);
    const log: { action: string; by: string; at: string; detail: string }[] = [];
    try { const parsed = JSON.parse(existing?.auditLog ?? '[]'); if (Array.isArray(parsed)) log.push(...parsed); } catch {}
    log.push(auditEntry);
    (rest as any).auditLog = JSON.stringify(log);
  }
  await db.update(facilities).set({ ...rest as any, updatedAt: new Date() }).where(eq(facilities.id, id));
  return getFacilityById(id);
}

export async function deleteFacility(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilities).where(eq(facilities.id, id));
}

export async function searchFacilities(opts: {
  search?: string;
  type?: string;
  country?: string;
  region?: string;
  status?: string;
  threatLevel?: string;
  verificationStatus?: string;
  approvalStatus?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const conditions: any[] = [];
  if (opts.type) conditions.push(eq(facilities.type, opts.type as any));
  if (opts.country) conditions.push(eq(facilities.country, opts.country));
  if (opts.region && opts.region !== 'Global') conditions.push(eq(facilities.region, opts.region));
  if (opts.status) conditions.push(eq(facilities.status, opts.status as any));
  if (opts.threatLevel) conditions.push(eq(facilities.threatLevel, opts.threatLevel as any));
  if (opts.verificationStatus) conditions.push(eq(facilities.verificationStatus, opts.verificationStatus as any));
  if (opts.approvalStatus) conditions.push(eq(facilities.approvalStatus, opts.approvalStatus as any));
  if (opts.search) {
    const s = `%${opts.search}%`;
    conditions.push(or(
      like(facilities.name, s),
      like(facilities.country, s),
      like(facilities.city, s),
      like(facilities.operator, s),
      like(facilities.description, s),
    ));
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [countRow] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(facilities).where(where);
  const rows = await db.select().from(facilities).where(where)
    .orderBy(desc(facilities.importance), desc(facilities.createdAt))
    .limit(opts.limit ?? 50).offset(opts.offset ?? 0);
  return { rows, total: Number(countRow?.cnt ?? 0) };
}

// ─── Facility Sources ─────────────────────────────────────────────────────────

export async function getFacilitySources(facilityId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilitySources)
    .where(eq(facilitySources.facilityId, facilityId))
    .orderBy(desc(facilitySources.reliability));
}

export async function addFacilitySource(src: InsertFacilitySource) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(facilitySources).values(src as any);
  const id = (result as any)[0]?.insertId ?? null;
  return id;
}

export async function deleteFacilitySource(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilitySources).where(eq(facilitySources.id, id));
}

// ─── Facility Candidates ──────────────────────────────────────────────────────

export async function getFacilityCandidates(opts?: {
  reviewStatus?: string;
  country?: string;
  region?: string;
  type?: string;
  limit?: number;
  offset?: number;
}) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  const conditions: any[] = [];
  if (opts?.reviewStatus) conditions.push(eq(facilityCandidates.reviewStatus, opts.reviewStatus as any));
  if (opts?.country) conditions.push(eq(facilityCandidates.country, opts.country));
  if (opts?.region && opts.region !== 'Global') conditions.push(eq(facilityCandidates.region, opts.region));
  if (opts?.type) conditions.push(eq(facilityCandidates.type, opts.type as any));
  const where = conditions.length ? and(...conditions) : undefined;
  const [countRow] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(facilityCandidates).where(where);
  const rows = await db.select().from(facilityCandidates).where(where)
    .orderBy(desc(facilityCandidates.createdAt))
    .limit(opts?.limit ?? 500).offset(opts?.offset ?? 0);
  return { rows, total: Number(countRow?.cnt ?? 0) };
}

export async function getFacilityCandidateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(facilityCandidates).where(eq(facilityCandidates.id, id)).limit(1);
  return result[0] ?? null;
}

export async function createFacilityCandidate(candidate: InsertFacilityCandidate) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(facilityCandidates).values(candidate as any);
  const id = (result as any)[0]?.insertId ?? null;
  return id ? getFacilityCandidateById(id) : null;
}

export async function updateFacilityCandidate(id: number, updates: Partial<InsertFacilityCandidate>) {
  const db = await getDb();
  if (!db) return null;
  await db.update(facilityCandidates).set({ ...updates as any, updatedAt: new Date() }).where(eq(facilityCandidates.id, id));
  return getFacilityCandidateById(id);
}

export async function deleteFacilityCandidate(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(facilityCandidates).where(eq(facilityCandidates.id, id));
}

// ─── Facility Enrichment Jobs ─────────────────────────────────────────────────

export async function createFacilityEnrichmentJob(data: InsertFacilityEnrichmentJob) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(facilityEnrichmentJobs).values(data as any);
  const id = (result as any)[0]?.insertId ?? null;
  return id;
}

export async function updateFacilityEnrichmentJob(id: number, updates: Partial<InsertFacilityEnrichmentJob>) {
  const db = await getDb();
  if (!db) return;
  await db.update(facilityEnrichmentJobs).set(updates as any).where(eq(facilityEnrichmentJobs.id, id));
}

export async function getFacilityEnrichmentJobs(facilityId?: number, limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(facilityEnrichmentJobs)
    .where(facilityId ? eq(facilityEnrichmentJobs.facilityId, facilityId) : undefined)
    .orderBy(desc(facilityEnrichmentJobs.createdAt)).limit(limit);
}

// ─── Re-enrichment Engine ─────────────────────────────────────────────────────
// Scans all articles for mentions of a newly approved facility and creates links.
// Runs asynchronously (fire-and-forget) to avoid blocking the approval response.
export async function runFacilityReenrichment(facilityId: number, facilityName: string, triggeredBy: string) {
  const db = await getDb();
  if (!db) return null;
  // Create enrichment job record
  const jobId = await createFacilityEnrichmentJob({
    facilityId,
    facilityName,
    status: 'running',
    startedAt: new Date(),
    triggeredBy,
  });
  if (!jobId) return null;
  // Fire-and-forget: run in background
  (async () => {
    try {
      console.log(`[Enrichment] Starting re-enrichment for facility ${facilityId} (${facilityName})`);
      let scanned = 0;
      let created = 0;
      const batchSize = 100;
      let offset = 0;
      // Build alias list from facility record — only use names with 4+ chars
      const fac = await getFacilityById(facilityId);
      const aliases = [facilityName];
      if (fac?.nameAlias) {
        aliases.push(...fac.nameAlias.split(',').map((s: string) => s.trim()).filter(Boolean));
      }
      if (fac?.nameAr) aliases.push(fac.nameAr);
      // Filter out short aliases that cause false positives
      const validAliases = aliases.filter(a => a.length >= 4);
      if (!validAliases.length) {
        await updateFacilityEnrichmentJob(jobId, { status: 'completed', articlesScanned: 0, linksCreated: 0, completedAt: new Date() });
        return;
      }
      // Build word-boundary regex patterns for each alias
      const aliasPatterns = validAliases.map(alias => {
        const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return new RegExp(`\\b${escaped}\\b`, 'i');
      });
      while (true) {
        const batch = await db.select({ id: articles.id, title: articles.title, summary: articles.summary, content: articles.content })
          .from(articles).limit(batchSize).offset(offset);
        if (!batch.length) break;
        for (const art of batch) {
          scanned++;
          const text = `${art.title ?? ''} ${art.summary ?? ''} ${art.content ?? ''}`;
          // Use word-boundary regex matching for accuracy
          const matchedAlias = aliasPatterns.findIndex(pattern => pattern.test(text));
          if (matchedAlias >= 0) {
            // Check if link already exists
            const existing = await db.select({ id: articleFacilityLinks.id })
              .from(articleFacilityLinks)
              .where(and(eq(articleFacilityLinks.articleId, art.id), eq(articleFacilityLinks.facilityId, facilityId)))
              .limit(1);
            if (!existing.length) {
              await db.insert(articleFacilityLinks).values({
                articleId: art.id,
                facilityId,
                mentionType: 'general',
                confidence: 0.8,
                excerpt: validAliases[matchedAlias],
              } as any);
              created++;
            }
          }
        }
        offset += batchSize;
        if (batch.length < batchSize) break;
      }
      await updateFacilityEnrichmentJob(jobId, {
        status: 'completed',
        articlesScanned: scanned,
        linksCreated: created,
        completedAt: new Date(),
      });
      // Update facility newsCount
      await db.update(facilities).set({ newsCount: created, updatedAt: new Date() }).where(eq(facilities.id, facilityId));
      console.log(`[Enrichment] Completed: scanned=${scanned}, links=${created}`);
    } catch (err: any) {
      console.error('[Enrichment] Failed:', err.message);
      await updateFacilityEnrichmentJob(jobId, { status: 'failed', errorMessage: err.message, completedAt: new Date() });
    }
  })();
  return jobId;
}

// ─── Satellites ───────────────────────────────────────────────────────────────
import { satellites, type Satellite, type InsertSatellite } from "../drizzle/schema";

export async function getSatellitesByCategory(category: string): Promise<Satellite[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(satellites).where(
    and(eq(satellites.category, category), eq(satellites.decayed, false))
  );
}

export async function getAllSatellites(): Promise<Satellite[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(satellites).where(eq(satellites.decayed, false));
}

export async function getSatelliteByNoradId(noradId: number): Promise<Satellite | undefined> {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(satellites).where(eq(satellites.noradId, noradId)).limit(1);
  return rows[0];
}

export async function searchSatellitesInDb(query: string, limit = 20): Promise<Satellite[]> {
  const db = await getDb();
  if (!db) return [];
  const noradId = parseInt(query, 10);
  if (!isNaN(noradId)) {
    return db.select().from(satellites).where(eq(satellites.noradId, noradId)).limit(limit);
  }
  return db.select().from(satellites).where(
    like(satellites.name, `%${query}%`)
  ).limit(limit);
}

export async function upsertSatellite(sat: InsertSatellite): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(satellites).values(sat).onDuplicateKeyUpdate({
    set: {
      name: sat.name,
      tle1: sat.tle1,
      tle2: sat.tle2,
      category: sat.category,
      country: sat.country,
      launchDate: sat.launchDate,
      launchSite: sat.launchSite,
      missionDescription: sat.missionDescription,
      operator: sat.operator,
      altitude: sat.altitude,
      inclination: sat.inclination,
      period: sat.period,
      eccentricity: sat.eccentricity,
      lastUpdated: new Date(),
    }
  });
}

export async function getSatelliteCategories(): Promise<{ category: string; count: number }[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select({
    category: satellites.category,
    count: sql<number>`COUNT(*)`,
  }).from(satellites).where(eq(satellites.decayed, false)).groupBy(satellites.category);
  return rows.map(r => ({ category: r.category ?? "unknown", count: Number(r.count) }));
}
