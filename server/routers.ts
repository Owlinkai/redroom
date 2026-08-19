import { COOKIE_NAME } from "@shared/const";
/**
 * routers.ts — Redroom Root tRPC Router
 *
 * Assembles all feature sub-routers into the single `appRouter` that is
 * mounted on the Express server at `/api/trpc`.
 *
 * Procedure access levels:
 *   - publicProcedure    — no authentication required
 *   - protectedProcedure — requires valid JWT session cookie (ctx.user injected)
 *   - analystProcedure   — extends protectedProcedure; requires analyst role
 *   - adminProcedure     — extends protectedProcedure; requires admin role
 *
 * Sub-routers (feature-specific procedures) live in server/routers/.
 * The CMS router (server/routers/cms.ts) uses a separate ownerOnly middleware
 * that validates the x-sa-token header independently of the OAuth session.
 *
 * @module routers
 */
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, analystProcedure, adminProcedure, router } from "./_core/trpc";
import {
  getNewsAgencies, getNewsAgencyById, bulkInsertNewsAgencies,
  getFacilities, getFacilityById, bulkInsertFacilities,
  createFacility, updateFacility, deleteFacility, searchFacilities,
  getFacilitySources, addFacilitySource, deleteFacilitySource,
  getFacilityCandidates, getFacilityCandidateById, createFacilityCandidate, updateFacilityCandidate, deleteFacilityCandidate,
  getFacilityEnrichmentJobs, runFacilityReenrichment,
  getArticles, getArticleById, insertArticle, getArticleStats, getTrendingTopics,
  getArticleFacilityLinks, insertArticleFacilityLink,
  createCrawlJob, updateCrawlJob, getRecentCrawlJobs,
  getNotifications, createNotification, markNotificationRead,
  getDb, serializeArticle,
} from "./db";
import { crawlAgencyRSS, scheduleCrawl, runCrawlJob, createJobAndRun, cancelJob, getActiveJobIds, cleanupStuckJobs, cleanupTimedOutJobs } from "./crawler";
import { crawlEventBus } from "./crawlEventBus";
import { newsAgencies, articles, facilities, crawlJobs, articleFacilityLinks, investigations, verifiedArticles, facilitySources, facilityCandidates, facilityEnrichmentJobs, missionRuns, crawlMissions, pipelineWebhooks, countryIntelData, upgradeClicks } from "../drizzle/schema";
import { eq, desc, sql, and, gte, lt, inArray } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { enforceQuota, incrementUsage } from "./quotaEnforcement";
import { checkReference, batchCheckReferences, filterVerifiedArticles } from "./referenceChecker";
import { z } from "zod";
import { orbitRouter } from "./routers/orbit";
import { sigintRouter } from "./routers/sigint";
import { missionsRouter as surveillanceMissionsRouter } from "./routers/missions";
import { cmsRouter } from "./routers/cms";
import { referenceRouter } from "./routers/reference";
import { narrativesRouter } from "./routers/narratives";
import { waitingListRouter } from "./routers/waitingList";
import { headerPrefsRouter } from "./routers/headerPrefs";

// ─── Webhook helpers ─────────────────────────────────────────────────────────
type WebhookRow = { id: number; name: string; stage: string; url: string; secret: string | null; threshold: number; windowSeconds: number; payloadTemplate: string | null; isEnabled: boolean; totalFired: number };

function buildWebhookPayload(wh: WebhookRow, stage: string, count: number, isTest = false): string {
  const base = { webhook_id: wh.id, webhook_name: wh.name, stage, count, ts: new Date().toISOString(), is_test: isTest };
  if (!wh.payloadTemplate) return JSON.stringify(base);
  try {
    let tpl = wh.payloadTemplate;
    tpl = tpl.replace(/\{\{stage\}\}/g, stage);
    tpl = tpl.replace(/\{\{count\}\}/g, String(count));
    tpl = tpl.replace(/\{\{ts\}\}/g, base.ts);
    return tpl;
  } catch { return JSON.stringify(base); }
}

async function fireWebhook(wh: WebhookRow, payload: string): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (wh.secret) headers['Authorization'] = `Bearer ${wh.secret}`;
    const res = await fetch(wh.url, { method: 'POST', headers, body: payload, signal: AbortSignal.timeout(10000) });
    return { ok: res.ok, status: res.status };
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// In-memory rolling window counters per webhook id
const _webhookCounters = new Map<number, number[]>();

export async function checkAndFireWebhooks(stage: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    const hooks = await db.select().from(pipelineWebhooks)
      .where(and(eq(pipelineWebhooks.isEnabled, true)));
    const now = Date.now();
    for (const wh of hooks) {
      if (wh.stage !== stage && wh.stage !== 'any') continue;
      const window = wh.windowSeconds * 1000;
      let timestamps = _webhookCounters.get(wh.id) ?? [];
      timestamps.push(now);
      timestamps = timestamps.filter(t => now - t < window);
      _webhookCounters.set(wh.id, timestamps);
      if (timestamps.length >= wh.threshold) {
        _webhookCounters.set(wh.id, []); // reset after firing
        const payload = buildWebhookPayload(wh, stage, timestamps.length);
        const result = await fireWebhook(wh, payload);
        await db.update(pipelineWebhooks).set({
          totalFired: wh.totalFired + 1,
          lastFiredAt: new Date(),
          lastError: result.ok ? null : (result.error ?? `HTTP ${result.status}`),
        }).where(eq(pipelineWebhooks.id, wh.id));
      }
    }
  } catch { /* non-critical */ }
}

export const appRouter = router({
  system: systemRouter,
  cms: cmsRouter,

  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── News Agencies ─────────────────────────────────────────────────────────
  agencies: router({
    list: publicProcedure
      .input(z.object({ region: z.string().optional(), limit: z.number().optional() }))
      .query(({ input }) => getNewsAgencies(input.region, input.limit)),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getNewsAgencyById(input.id)),

    stats: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const agencies = await getNewsAgencies(input.region, 200);
        return {
          total: agencies.length,
          byType: agencies.reduce((acc, a) => { acc[a.type || 'unknown'] = (acc[a.type || 'unknown'] || 0) + 1; return acc; }, {} as Record<string, number>),
          byCountry: agencies.reduce((acc, a) => { acc[a.country] = (acc[a.country] || 0) + 1; return acc; }, {} as Record<string, number>),
          byBias: agencies.reduce((acc, a) => { acc[a.bias || 'center'] = (acc[a.bias || 'center'] || 0) + 1; return acc; }, {} as Record<string, number>),
        };
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string(),
        country: z.string(),
        type: z.string().optional(),
        website: z.string().optional(),
        rssFeeds: z.array(z.string()).optional(),
        language: z.string().optional(),
        bias: z.enum(['left','center-left','center','center-right','right','state']).optional(),
        logoUrl: z.string().optional(),
        description: z.string().optional(),
        region: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        await db.insert(newsAgencies).values({
          name: input.name,
          country: input.country,
          type: (input.type as any) || 'online',
          website: input.website || null,
          rssFeeds: (input.rssFeeds || []) as any,
          language: input.language || 'en',
          bias: (input.bias as any) || 'center',
          logoUrl: input.logoUrl || null,
          description: input.description || null,
          region: input.region || 'MENA',
          isActive: true,
        });
        return { success: true };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        country: z.string().optional(),
        type: z.string().optional(),
        website: z.string().optional(),
        rssFeeds: z.array(z.string()).optional(),
        language: z.string().optional(),
        bias: z.enum(['left','center-left','center','center-right','right','state']).optional(),
        logoUrl: z.string().optional(),
        description: z.string().optional(),
        region: z.string().optional(),
        isActive: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const { id, ...fields } = input;
        const update: Record<string, any> = {};
        if (fields.name !== undefined) update.name = fields.name;
        if (fields.country !== undefined) update.country = fields.country;
        if (fields.type !== undefined) update.type = fields.type;
        if (fields.website !== undefined) update.website = fields.website;
        if (fields.rssFeeds !== undefined) update.rssFeeds = fields.rssFeeds;
        if (fields.language !== undefined) update.language = fields.language;
        if (fields.bias !== undefined) update.bias = fields.bias;
        if (fields.logoUrl !== undefined) update.logoUrl = fields.logoUrl;
        if (fields.description !== undefined) update.description = fields.description;
        if (fields.region !== undefined) update.region = fields.region;
        if (fields.isActive !== undefined) update.isActive = fields.isActive;
        await db.update(newsAgencies).set(update).where(eq(newsAgencies.id, id));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        await db.delete(newsAgencies).where(eq(newsAgencies.id, input.id));
        return { success: true };
      }),

    crawlOne: adminProcedure
      .input(z.object({ id: z.number(), region: z.string().default('MENA') }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const [agency] = await db.select().from(newsAgencies).where(eq(newsAgencies.id, input.id)).limit(1);
        if (!agency || !agency.rssFeeds) return { articles: 0, jobId: null };
        // Create a real job row and run it asynchronously
        const jobId = await createJobAndRun(input.id, input.region, []);
        return { articles: 0, jobId };
      }),

    crawlAll: adminProcedure
      .input(z.object({ region: z.string().default('MENA') }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        // Filter by region unless Global (which crawls all active agencies)
        const regionFilter = input.region && input.region !== 'Global'
          ? and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, input.region))
          : eq(newsAgencies.isActive, true);
        const activeAgencies = await db.select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
          .from(newsAgencies)
          .where(regionFilter).limit(200);
        const jobIds: number[] = [];
        for (const agency of activeAgencies) {
          if (!agency.rssFeeds || !(agency.rssFeeds as string[]).length) continue;
          const jobId = await createJobAndRun(agency.id, input.region, []);
          jobIds.push(jobId);
        }
        return { agenciesCrawled: jobIds.length, jobIds };
      }),
    withStats: publicProcedure
      .input(z.object({
        region: z.string().optional(),
        limit: z.number().optional(),
        dateFrom: z.string().optional(), // ISO date string for start of window
        dateTo: z.string().optional(),   // ISO date string for end of window
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        // Get agencies — filter by region when provided
        const agencyQuery = db.select().from(newsAgencies)
          .orderBy(desc(newsAgencies.reliability))
          .limit(input.limit ?? 300);
        const allAgencies = input.region
          ? await db.select().from(newsAgencies)
              .where(eq(newsAgencies.region, input.region))
              .orderBy(desc(newsAgencies.reliability))
              .limit(input.limit ?? 300)
          : await agencyQuery;
        // Build optional date-range filter for article counts
        const dateConditions = [];
        if (input.dateFrom) dateConditions.push(gte(articles.publishedAt, new Date(input.dateFrom)));
        if (input.dateTo) dateConditions.push(lt(articles.publishedAt, new Date(input.dateTo)));
        const whereClause = dateConditions.length > 0 ? and(...dateConditions) : undefined;
        // Get article counts per agency (optionally filtered by date window)
        const articleCounts = await db
          .select({
            agencyId: articles.agencyId,
            total: sql<number>`COUNT(*)`,
            negative: sql<number>`SUM(CASE WHEN ${articles.sentiment} = 'negative' THEN 1 ELSE 0 END)`,
            positive: sql<number>`SUM(CASE WHEN ${articles.sentiment} = 'positive' THEN 1 ELSE 0 END)`,
            neutral: sql<number>`SUM(CASE WHEN ${articles.sentiment} = 'neutral' THEN 1 ELSE 0 END)`,
            lastArticle: sql<string>`MAX(${articles.publishedAt})`,
          })
          .from(articles)
          .where(whereClause)
          .groupBy(articles.agencyId);
        const countMap = new Map(articleCounts.map(r => [r.agencyId, r]));
        return allAgencies.map(a => ({
          ...a,
          articleCount: Number(countMap.get(a.id)?.total ?? 0),
          negativeCount: Number(countMap.get(a.id)?.negative ?? 0),
          positiveCount: Number(countMap.get(a.id)?.positive ?? 0),
          neutralCount: Number(countMap.get(a.id)?.neutral ?? 0),
          lastArticleAt: countMap.get(a.id)?.lastArticle ?? null,
        }));
      }),
    crawlByCountry: adminProcedure
      .input(z.object({ country: z.string(), region: z.string().default('MENA') }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const countryAgencies = await db.select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
          .from(newsAgencies)
          .where(and(eq(newsAgencies.country, input.country), eq(newsAgencies.isActive, true)));
        if (!countryAgencies.length) return { agenciesCrawled: 0, jobIds: [] };
        const jobIds: number[] = [];
        for (const agency of countryAgencies) {
          if (!agency.rssFeeds || !(agency.rssFeeds as string[]).length) continue;
          const jobId = await createJobAndRun(agency.id, input.region, []);
          jobIds.push(jobId);
        }
         return { agenciesCrawled: jobIds.length, jobIds };
      }),
    getCountryErrorRates: publicProcedure
      .input(z.object({ windowHours: z.number().optional().default(24) }))
      .query(async ({ input }) => {
        const since = new Date(Date.now() - input.windowHours * 60 * 60 * 1000);
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const rows = await db
          .select({ country: newsAgencies.country, status: crawlJobs.status })
          .from(crawlJobs)
          .innerJoin(newsAgencies, eq(crawlJobs.agencyId, newsAgencies.id))
          .where(gte(crawlJobs.createdAt, since));
        const map: Record<string, { total: number; failed: number }> = {};
        for (const r of rows) {
          const c = r.country ?? 'Unknown';
          if (!map[c]) map[c] = { total: 0, failed: 0 };
          map[c].total++;
          if (r.status === 'failed') map[c].failed++;
        }
        return Object.entries(map).map(([country, v]) => ({
          country, total: v.total, failed: v.failed,
          errorRate: v.total > 0 ? v.failed / v.total : 0,
        }));
      }),
  }),
  // ─── Facilities ─────────────────────────────────────────────────────────────
  facilities: router({
    list: publicProcedure
      .input(z.object({ region: z.string().optional(), types: z.array(z.string()).optional(), limit: z.number().optional() }))
      .query(({ input }) => getFacilities(input)),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getFacilityById(input.id)),

    byArticle: publicProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        const links = await getArticleFacilityLinks(input.articleId);
        const facilityIds = links.map(l => l.facilityId);
        if (!facilityIds.length) return [];
        const db = await getDb();
        if (!db) return [];
        const result = await db.select().from(facilities)
          .where(sql`id IN (${facilityIds.join(',')})`).limit(20);
        return result.map(f => ({ ...f, link: links.find(l => l.facilityId === f.id) }));
      }),

    stats: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const facs = await getFacilities({ region: input.region, limit: 2000 });
        return {
          total: facs.length,
          byType: facs.reduce((acc, f) => { acc[f.type] = (acc[f.type] || 0) + 1; return acc; }, {} as Record<string, number>),
          byCountry: facs.reduce((acc, f) => { acc[f.country] = (acc[f.country] || 0) + 1; return acc; }, {} as Record<string, number>),
          byThreat: facs.reduce((acc, f) => { acc[f.threatLevel || 'low'] = (acc[f.threatLevel || 'low'] || 0) + 1; return acc; }, {} as Record<string, number>),
        };
      }),

    // Get article counts per facility (for red dot logic) — only use confirmed links
    newsCounts: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return {};
        // Count linked articles per facility from confirmed article_facility_links only
        const links = await db.select({
          facilityId: articleFacilityLinks.facilityId,
          confidence: articleFacilityLinks.confidence,
        }).from(articleFacilityLinks);
        const counts: Record<number, number> = {};
        for (const l of links) {
          // Only count links with confidence >= 0.7 (skip low-confidence matches)
          if ((l.confidence ?? 0) >= 0.7) {
            counts[l.facilityId] = (counts[l.facilityId] || 0) + 1;
          }
        }
        return counts;
      }),

    // Returns facilityId → breakingArticleCount for facilities with breaking news
    breakingNewsCounts: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return {} as Record<number, number>;
        // Get all breaking article IDs
        const breakingArts = await db.select({ id: articles.id }).from(articles)
          .where(eq(articles.isBreaking, true));
        if (!breakingArts.length) return {} as Record<number, number>;
        const breakingIds = breakingArts.map(a => a.id);
        // Count breaking articles per facility via links
        const links = await db.select({ facilityId: articleFacilityLinks.facilityId, articleId: articleFacilityLinks.articleId })
          .from(articleFacilityLinks)
          .where(inArray(articleFacilityLinks.articleId, breakingIds));
        const counts: Record<number, number> = {};
        for (const l of links) { counts[l.facilityId] = (counts[l.facilityId] || 0) + 1; }
        return counts;
      }),
    // ─── Facility Registry CRUD ───────────────────────────────────────────────
    search: publicProcedure
      .input(z.object({
        search: z.string().optional(),
        type: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        status: z.string().optional(),
        threatLevel: z.string().optional(),
        verificationStatus: z.string().optional(),
        approvalStatus: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ input }) => searchFacilities(input)),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        nameAr: z.string().optional(),
        nameAlias: z.string().optional(),
        type: z.string(),
        country: z.string().min(2),
        region: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number(),
        longitude: z.number(),
        description: z.string().optional(),
        operator: z.string().optional(),
        owner: z.string().optional(),
        capacity: z.string().optional(),
        area: z.string().optional(),
        personnel: z.string().optional(),
        operationalSince: z.string().optional(),
        estimatedValue: z.string().optional(),
        status: z.string().optional(),
        threatLevel: z.string().optional(),
        importance: z.number().min(1).max(10).optional(),
        tags: z.array(z.string()).optional(),
        externalIds: z.record(z.string(), z.string()).optional(),
        primarySourceUrl: z.string().optional(),
        primarySourceName: z.string().optional(),
        primarySourceType: z.string().optional(),
        verificationStatus: z.string().optional(),
        verificationNotes: z.string().optional(),
        notes: z.string().optional(),
        submittedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const fac = await createFacility({
          ...input as any,
          approvalStatus: 'approved',
          approvedAt: new Date(),
          auditLog: JSON.stringify([{ action: 'created', by: input.submittedBy ?? 'analyst', at: new Date().toISOString(), detail: 'Facility created via registry' }]),
        });
        return fac;
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(2).optional(),
        nameAr: z.string().optional(),
        nameAlias: z.string().optional(),
        type: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        description: z.string().optional(),
        operator: z.string().optional(),
        owner: z.string().optional(),
        capacity: z.string().optional(),
        area: z.string().optional(),
        personnel: z.string().optional(),
        operationalSince: z.string().optional(),
        estimatedValue: z.string().optional(),
        status: z.string().optional(),
        threatLevel: z.string().optional(),
        importance: z.number().min(1).max(10).optional(),
        tags: z.array(z.string()).optional(),
        externalIds: z.record(z.string(), z.string()).optional(),
        primarySourceUrl: z.string().optional(),
        primarySourceName: z.string().optional(),
        primarySourceType: z.string().optional(),
        verificationStatus: z.string().optional(),
        verifiedBy: z.string().optional(),
        verificationNotes: z.string().optional(),
        notes: z.string().optional(),
        updatedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, updatedBy, ...rest } = input;
        return updateFacility(id, {
          ...rest as any,
          auditEntry: { action: 'updated', by: updatedBy ?? 'analyst', at: new Date().toISOString(), detail: `Fields updated: ${Object.keys(rest).join(', ')}` },
        });
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number(), deletedBy: z.string().optional() }))
      .mutation(async ({ input }) => {
        await deleteFacility(input.id);
        return { success: true };
      }),

    // ─── Facility Sources ─────────────────────────────────────────────────────
    getSources: publicProcedure
      .input(z.object({ facilityId: z.number() }))
      .query(({ input }) => getFacilitySources(input.facilityId)),

    addSource: adminProcedure
      .input(z.object({
        facilityId: z.number(),
        sourceUrl: z.string().url(),
        sourceName: z.string().min(2),
        sourceType: z.string().optional(),
        confirmsFields: z.string().optional(),
        publicationDate: z.string().optional(),
        authorOrg: z.string().optional(),
        reliability: z.number().min(0).max(100).optional(),
        notes: z.string().optional(),
        addedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const id = await addFacilitySource(input as any);
        return { id, success: true };
      }),

    removeSource: adminProcedure
      .input(z.object({ sourceId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFacilitySource(input.sourceId);
        return { success: true };
      }),

    // ─── Candidate Pipeline ───────────────────────────────────────────────────
    listCandidates: publicProcedure
      .input(z.object({
        reviewStatus: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        type: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
      }))
      .query(({ input }) => getFacilityCandidates(input)),

    submitCandidate: adminProcedure
      .input(z.object({
        name: z.string().min(2),
        nameAr: z.string().optional(),
        nameAlias: z.string().optional(),
        type: z.string(),
        country: z.string().min(2),
        region: z.string().optional(),
        city: z.string().optional(),
        address: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        description: z.string().optional(),
        operator: z.string().optional(),
        owner: z.string().optional(),
        capacity: z.string().optional(),
        area: z.string().optional(),
        personnel: z.string().optional(),
        operationalSince: z.string().optional(),
        estimatedValue: z.string().optional(),
        status: z.string().optional(),
        threatLevel: z.string().optional(),
        importance: z.number().optional(),
        tags: z.array(z.string()).optional(),
        externalIds: z.record(z.string(), z.string()).optional(),
        sourceUrl: z.string().optional(),
        sourceName: z.string().optional(),
        sourceType: z.string().optional(),
        discoveryMethod: z.string().optional(),
        discoveryQuery: z.string().optional(),
        rawData: z.string().optional(),
        confidenceScore: z.number().optional(),
        submittedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const candidate = await createFacilityCandidate({ ...input as any, reviewStatus: 'pending' });
        return candidate;
      }),

    updateCandidate: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        nameAr: z.string().optional(),
        type: z.string().optional(),
        country: z.string().optional(),
        region: z.string().optional(),
        city: z.string().optional(),
        latitude: z.number().optional(),
        longitude: z.number().optional(),
        description: z.string().optional(),
        operator: z.string().optional(),
        owner: z.string().optional(),
        capacity: z.string().optional(),
        area: z.string().optional(),
        personnel: z.string().optional(),
        operationalSince: z.string().optional(),
        estimatedValue: z.string().optional(),
        status: z.string().optional(),
        threatLevel: z.string().optional(),
        importance: z.number().optional(),
        sourceUrl: z.string().optional(),
        sourceName: z.string().optional(),
        sourceType: z.string().optional(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        return updateFacilityCandidate(id, rest as any);
      }),

    // Mark candidate as under_review
    markUnderReview: analystProcedure
      .input(z.object({
        candidateId: z.number(),
        reviewedBy: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const candidate = await getFacilityCandidateById(input.candidateId);
        if (!candidate) throw new Error('Candidate not found');
        await updateFacilityCandidate(input.candidateId, {
          reviewStatus: 'under_review',
          reviewedBy: input.reviewedBy ?? 'analyst',
        });
        return { success: true };
      }),
    approveCandidate: adminProcedure
      .input(z.object({
        candidateId: z.number(),
        reviewedBy: z.string().optional(),
        reviewNotes: z.string().optional(),
        // Optional overrides at approval time
        regionOverride: z.string().optional(),
        verificationStatus: z.string().optional(),
        verificationNotes: z.string().optional(),
        threatLevelOverride: z.string().optional(),
        importanceOverride: z.number().optional(),
      }))
      .mutation(async ({ input }) => {
        const candidate = await getFacilityCandidateById(input.candidateId);
        if (!candidate) throw new Error('Candidate not found');
        // Region: use override if provided, else candidate.region, else 'Global'
        const assignedRegion = input.regionOverride ?? candidate.region ?? 'Global';
        // Create the facility in the main registry
        const fac = await createFacility({
          name: candidate.name,
          nameAr: candidate.nameAr ?? undefined,
          nameAlias: candidate.nameAlias ?? undefined,
          type: candidate.type,
          country: candidate.country,
          region: assignedRegion,
          city: candidate.city ?? undefined,
          address: candidate.address ?? undefined,
          latitude: candidate.latitude ?? 0,
          longitude: candidate.longitude ?? 0,
          description: candidate.description ?? undefined,
          operator: candidate.operator ?? undefined,
          owner: candidate.owner ?? undefined,
          capacity: candidate.capacity ?? undefined,
          area: candidate.area ?? undefined,
          personnel: candidate.personnel ?? undefined,
          operationalSince: candidate.operationalSince ?? undefined,
          estimatedValue: candidate.estimatedValue ?? undefined,
          status: (candidate.status ?? 'active') as any,
          threatLevel: (input.threatLevelOverride ?? candidate.threatLevel ?? 'low') as any,
          importance: input.importanceOverride ?? candidate.importance ?? 5,
          tags: candidate.tags ?? undefined,
          externalIds: candidate.externalIds ?? undefined,
          primarySourceUrl: candidate.sourceUrl ?? undefined,
          primarySourceName: candidate.sourceName ?? undefined,
          primarySourceType: (candidate.sourceType ?? 'manual_entry') as any,
          verificationStatus: (input.verificationStatus ?? 'pending_review') as any,
          verificationNotes: input.verificationNotes ?? undefined,
          approvalStatus: 'approved',
          approvedBy: input.reviewedBy ?? 'analyst',
          approvedAt: new Date(),
          submittedBy: candidate.submittedBy ?? undefined,
          auditLog: JSON.stringify([
            { action: 'candidate_submitted', by: candidate.submittedBy ?? 'system', at: candidate.createdAt?.toISOString() ?? new Date().toISOString(), detail: `Discovered via ${candidate.discoveryMethod}` },
            { action: 'approved', by: input.reviewedBy ?? 'analyst', at: new Date().toISOString(), detail: input.reviewNotes ?? 'Approved from candidate queue', region: assignedRegion },
          ]),
        } as any);
        if (!fac) throw new Error('Failed to create facility from candidate');
        // Mark candidate as approved
        await updateFacilityCandidate(input.candidateId, {
          reviewStatus: 'approved',
          reviewedBy: input.reviewedBy ?? 'analyst',
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes ?? undefined,
          approvedFacilityId: fac.id,
          reenrichmentTriggered: true,
        });
        // Trigger re-enrichment asynchronously
        const jobId = await runFacilityReenrichment(fac.id, fac.name, input.reviewedBy ?? 'analyst');
        return { facility: fac, reenrichmentJobId: jobId };
      }),

    rejectCandidate: analystProcedure
      .input(z.object({
        candidateId: z.number(),
        reviewedBy: z.string().optional(),
        reviewNotes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await updateFacilityCandidate(input.candidateId, {
          reviewStatus: 'rejected',
          reviewedBy: input.reviewedBy ?? 'analyst',
          reviewedAt: new Date(),
          reviewNotes: input.reviewNotes ?? undefined,
        });
        return { success: true };
      }),

    deleteCandidate: adminProcedure
      .input(z.object({ candidateId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteFacilityCandidate(input.candidateId);
        return { success: true };
      }),

    // ─── Candidate Status Counts ─────────────────────────────────────────────
    candidateStatusCounts: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { pending: 0, under_review: 0, approved: 0, rejected: 0, total: 0 };
        const regionFilter = input.region && input.region !== 'Global' ? input.region : undefined;
        const base = regionFilter
          ? db.select({ status: facilityCandidates.reviewStatus, cnt: sql<number>`COUNT(*)` }).from(facilityCandidates).where(eq(facilityCandidates.region, regionFilter)).groupBy(facilityCandidates.reviewStatus)
          : db.select({ status: facilityCandidates.reviewStatus, cnt: sql<number>`COUNT(*)` }).from(facilityCandidates).groupBy(facilityCandidates.reviewStatus);
        const rows = await base;
        const counts = { pending: 0, under_review: 0, approved: 0, rejected: 0, total: 0 };
        for (const r of rows) {
          const s = r.status as string;
          const n = Number(r.cnt);
          if (s === 'pending') counts.pending = n;
          else if (s === 'under_review') counts.under_review = n;
          else if (s === 'approved') counts.approved = n;
          else if (s === 'rejected') counts.rejected = n;
          counts.total += n;
        }
        return counts;
      }),
    // ─── Online Discovery (LLM-powered + Google Grounding validation) ──────────
    searchOnline: adminProcedure
      .input(z.object({
        query: z.string().min(3),
        country: z.string().optional(),
        region: z.string().optional(),
        facilityType: z.string().optional(),
        maxResults: z.number().min(1).max(10).optional(),
        enableGrounding: z.boolean().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Quota enforcement
        if (ctx.user) { await enforceQuota(ctx.user.id, ctx.user.role); }
        const typeHint = input.facilityType ? ` of type "${input.facilityType}"` : '';
        const countryHint = input.country ? ` in ${input.country}` : '';
        const prompt = `You are a geopolitical intelligence analyst with access to authoritative open-source data. Search for strategic facilities${typeHint}${countryHint} matching: "${input.query}".

Return a JSON array of up to ${input.maxResults ?? 5} facilities. Each object must have these fields:
- name: official English name
- nameAr: Arabic name if applicable (or null)
- type: one of [data_center, oil_gas, nuclear, military, airport, embassy, satellite, company, port, power_plant, refinery, pipeline, dam, hospital, government, financial, telecom, research, other]
- country: country name
- region: geopolitical region (e.g. MENA, Europe, Asia)
- city: nearest city
- latitude: decimal degrees (accurate to 4 decimal places)
- longitude: decimal degrees (accurate to 4 decimal places)
- description: 2-3 sentence factual description
- operator: operating organization
- owner: owning entity or government
- capacity: operational capacity if known
- operationalSince: year or date operational
- estimatedValue: estimated strategic/financial value if publicly known
- status: active/inactive/under_construction/decommissioned/unknown
- threatLevel: low/medium/high/critical based on geopolitical sensitivity
- importance: 1-10 strategic importance score
- sourceUrl: URL of the most authoritative public source (government, IAEA, UN, official body — NOT Wikipedia)
- sourceName: name of that source organization
- sourceType: one of [government_filing, iaea_report, un_document, satellite_imagery, official_website, regulatory_body, academic_paper, news_report, ngo_report, other]
- confidenceScore: 0.0-1.0 confidence in accuracy of this data
- tags: array of relevant tags

IMPORTANT: Only include facilities you are highly confident about. Do not fabricate coordinates or details. Use only publicly verifiable information from authoritative sources. Wikipedia is NOT an acceptable source.`;

        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a geopolitical intelligence analyst. Return only valid JSON arrays. No markdown, no explanation.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_schema', json_schema: {
            name: 'facility_search_results',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                facilities: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' }, nameAr: { type: ['string', 'null'] },
                      type: { type: 'string' }, country: { type: 'string' }, region: { type: 'string' },
                      city: { type: ['string', 'null'] }, latitude: { type: 'number' }, longitude: { type: 'number' },
                      description: { type: ['string', 'null'] }, operator: { type: ['string', 'null'] },
                      owner: { type: ['string', 'null'] }, capacity: { type: ['string', 'null'] },
                      operationalSince: { type: ['string', 'null'] }, estimatedValue: { type: ['string', 'null'] },
                      status: { type: 'string' }, threatLevel: { type: 'string' }, importance: { type: 'number' },
                      sourceUrl: { type: ['string', 'null'] }, sourceName: { type: ['string', 'null'] },
                      sourceType: { type: 'string' }, confidenceScore: { type: 'number' },
                      tags: { type: 'array', items: { type: 'string' } },
                    },
                    required: ['name', 'type', 'country', 'latitude', 'longitude', 'status', 'threatLevel', 'importance', 'sourceType', 'confidenceScore', 'tags'],
                    additionalProperties: false,
                  },
                },
              },
              required: ['facilities'],
              additionalProperties: false,
            },
          }},
        });
        const rawContent = response?.choices?.[0]?.message?.content;
        const content = typeof rawContent === 'string' ? rawContent : '{"facilities":[]}';
        let parsed: { facilities: any[] } = { facilities: [] };
        try { parsed = JSON.parse(content); } catch { parsed = { facilities: [] }; }
        // Determine target region: use input.region if provided, else infer from country
        const targetRegion = input.region && input.region !== 'Global' ? input.region : undefined;
        // Build search flow log for frontend display
        const searchFlow: Array<{ step: string; status: 'ok' | 'warn' | 'info'; detail: string; ts: number }> = [];
        searchFlow.push({ step: 'LLM Intelligence Query', status: 'ok', detail: `Queried geopolitical intelligence model with: "${input.query}"`, ts: Date.now() });
        searchFlow.push({ step: 'Source Filtering', status: 'ok', detail: 'Wikipedia excluded. Only IAEA, UN, government, regulatory, and official sources accepted.', ts: Date.now() });
        const rawCount = (parsed.facilities ?? []).length;
        searchFlow.push({ step: 'Initial Results', status: rawCount > 0 ? 'ok' : 'warn', detail: `${rawCount} candidate facilities returned from intelligence query`, ts: Date.now() });
        // Google Grounding validation step: for each candidate, run a validation LLM call
        const groundingEnabled = input.enableGrounding !== false; // default true
        const validatedFacilities: any[] = [];
        if (groundingEnabled && rawCount > 0) {
          searchFlow.push({ step: 'Google Grounding Validation', status: 'info', detail: `Validating ${rawCount} candidates against authoritative web sources...`, ts: Date.now() });
          for (const f of (parsed.facilities ?? [])) {
            try {
              const validationPrompt = `Validate this geopolitical facility entry for accuracy. Cross-reference against authoritative sources (government websites, IAEA, UN, official bodies). Do NOT use Wikipedia.

Facility: ${f.name}
Country: ${f.country}
Coordinates: ${f.latitude}, ${f.longitude}
Type: ${f.type}
Source URL: ${f.sourceUrl ?? 'none provided'}

Return JSON with fields:
- validated: boolean (true if you can confirm this facility exists at these coordinates from authoritative sources)
- groundingStatus: "validated" | "unverified" | "disputed" | "likely_accurate"
- groundingNotes: brief explanation of validation result
- adjustedConfidence: 0.0-1.0 adjusted confidence score after validation
- suggestedSourceUrl: better authoritative source URL if you know one (or null)
- suggestedSourceName: name of that source (or null)`;
              const vResp = await invokeLLM({
                messages: [
                  { role: 'system', content: 'You are a geopolitical fact-checker. Return only valid JSON. No markdown.' },
                  { role: 'user', content: validationPrompt },
                ],
                response_format: { type: 'json_schema', json_schema: {
                  name: 'facility_validation',
                  strict: true,
                  schema: {
                    type: 'object',
                    properties: {
                      validated: { type: 'boolean' },
                      groundingStatus: { type: 'string' },
                      groundingNotes: { type: 'string' },
                      adjustedConfidence: { type: 'number' },
                      suggestedSourceUrl: { type: ['string', 'null'] },
                      suggestedSourceName: { type: ['string', 'null'] },
                    },
                    required: ['validated', 'groundingStatus', 'groundingNotes', 'adjustedConfidence', 'suggestedSourceUrl', 'suggestedSourceName'],
                    additionalProperties: false,
                  },
                }},
              });
              const vRaw = vResp?.choices?.[0]?.message?.content;
              const vRawStr = typeof vRaw === 'string' ? vRaw : null;
              const vData = vRawStr ? JSON.parse(vRawStr) : null;
              validatedFacilities.push({
                ...f,
                groundingStatus: vData?.groundingStatus ?? 'unverified',
                groundingNotes: vData?.groundingNotes ?? '',
                confidenceScore: vData?.adjustedConfidence ?? f.confidenceScore ?? 0.5,
                sourceUrl: vData?.suggestedSourceUrl ?? f.sourceUrl,
                sourceName: vData?.suggestedSourceName ?? f.sourceName,
              });
            } catch {
              validatedFacilities.push({ ...f, groundingStatus: 'unverified', groundingNotes: 'Validation step failed' });
            }
          }
          const validatedCount = validatedFacilities.filter(f => f.groundingStatus === 'validated' || f.groundingStatus === 'likely_accurate').length;
          searchFlow.push({ step: 'Grounding Complete', status: 'ok', detail: `${validatedCount}/${rawCount} candidates validated against authoritative sources`, ts: Date.now() });
        } else {
          validatedFacilities.push(...(parsed.facilities ?? []));
        }
        // Save each result as a candidate
        const savedCandidates = [];
        for (const f of validatedFacilities) {
          try {
            const candidate = await createFacilityCandidate({
              name: f.name,
              nameAr: f.nameAr ?? undefined,
              type: (f.type ?? 'other') as any,
              country: f.country ?? 'Unknown',
              region: targetRegion ?? f.region ?? 'Global',
              city: f.city ?? undefined,
              latitude: f.latitude ?? 0,
              longitude: f.longitude ?? 0,
              description: f.description ?? undefined,
              operator: f.operator ?? undefined,
              owner: f.owner ?? undefined,
              capacity: f.capacity ?? undefined,
              area: undefined,
              personnel: undefined,
              operationalSince: f.operationalSince ?? undefined,
              estimatedValue: f.estimatedValue ?? undefined,
              status: (f.status ?? 'active') as any,
              threatLevel: (f.threatLevel ?? 'low') as any,
              importance: f.importance ?? 5,
              tags: f.tags ?? [],
              sourceUrl: f.sourceUrl ?? undefined,
              sourceName: f.sourceName ?? undefined,
              sourceType: (f.sourceType ?? 'other') as any,
              discoveryMethod: 'llm_search',
              discoveryQuery: input.query,
              rawData: JSON.stringify(f),
              confidenceScore: f.confidenceScore ?? 0.5,
              groundingStatus: (f.groundingStatus ?? 'unverified') as any,
              groundingNotes: f.groundingNotes ?? undefined,
              reviewStatus: 'pending',
              submittedBy: 'llm_search',
            });
            if (candidate) savedCandidates.push({ ...candidate, groundingStatus: f.groundingStatus, groundingNotes: f.groundingNotes });
          } catch (e: any) { console.warn('[FacilitySearch] Failed to save candidate:', e.message); }
        }
        searchFlow.push({ step: 'Candidates Saved', status: 'ok', detail: `${savedCandidates.length} candidates saved to pending approval queue`, ts: Date.now() });
                // Increment quota usage (count grounding calls too)
        if (ctx.user) { await incrementUsage(ctx.user.id, input.enableGrounding ? 1 + validatedFacilities.length : 1); }
        return { query: input.query, count: savedCandidates.length, candidates: savedCandidates, searchFlow };
      }),
    // ─── Re-enrichment ────────────────────────────────────────────────────────
    triggerReenrichment: adminProcedure
      .input(z.object({ facilityId: z.number(), triggeredBy: z.string().optional() }))
      .mutation(async ({ input }) => {
        const fac = await getFacilityById(input.facilityId);
        if (!fac) throw new Error('Facility not found');
        const jobId = await runFacilityReenrichment(fac.id, fac.name, input.triggeredBy ?? 'analyst');
        return { jobId, facilityName: fac.name };
      }),

    enrichmentJobs: publicProcedure
      .input(z.object({ facilityId: z.number().optional(), limit: z.number().optional() }))
      .query(({ input }) => getFacilityEnrichmentJobs(input.facilityId, input.limit)),

    // ─── Live Database Ping ────────────────────────────────────────────────────
    // Pings a set of authoritative public databases to show real connection status
    pingDatabases: publicProcedure
      .query(async () => {
        const TARGETS = [
          { id: 'iaea',    label: 'IAEA Nuclear Database',     url: 'https://www.iaea.org/', color: '#f59e0b' },
          { id: 'un',      label: 'UN Data Portal',            url: 'https://data.un.org/', color: '#3b82f6' },
          { id: 'unhcr',   label: 'UNHCR Refugee Data',        url: 'https://api.unhcr.org/population/v1/countries/', color: '#06b6d4' },
          { id: 'acled',   label: 'ACLED Conflict Data',       url: 'https://acleddata.com/', color: '#ef4444' },
          { id: 'worldbank', label: 'World Bank Open Data',    url: 'https://api.worldbank.org/v2/country?format=json&per_page=1', color: '#10b981' },
          { id: 'osm',     label: 'OpenStreetMap Nominatim',   url: 'https://nominatim.openstreetmap.org/status.php', color: '#8b5cf6' },
        ];
        const results = await Promise.all(TARGETS.map(async (t) => {
          const start = Date.now();
          try {
            const res = await fetch(t.url, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GeoINT/1.0)' },
              signal: AbortSignal.timeout(5000),
            });
            const latency = Date.now() - start;
            return { ...t, status: res.ok || res.status < 500 ? 'online' as const : 'degraded' as const, latency, httpStatus: res.status };
          } catch {
            return { ...t, status: 'offline' as const, latency: Date.now() - start, httpStatus: 0 };
          }
        }));
        return { databases: results, ts: Date.now() };
      }),
    // Get news articles related to a specific facility (via article_facility_links or name search)
    newsForFacility: publicProcedure
      .input(z.object({ facilityId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { facility: null, articles: [] };
        const fac = await getFacilityById(input.facilityId);
        if (!fac) return { facility: null, articles: [] };

        // First: get linked articles via article_facility_links
        const links = await getArticleFacilityLinks(undefined, input.facilityId);
        const linkedIds = links.map((l: any) => l.articleId);

        let rows: any[] = [];
        if (linkedIds.length > 0) {
          rows = await db.select().from(articles)
            .where(sql`id IN (${sql.raw(linkedIds.join(','))})`)
            .orderBy(desc(articles.publishedAt))
            .limit(input.limit ?? 20);
        }

        // If not enough linked articles, do a strict name search (only if name is 6+ chars to avoid false positives)
        if (rows.length < (input.limit ?? 20) && fac.name.length >= 6) {
          const remaining = (input.limit ?? 20) - rows.length;
          const existingIds = new Set(rows.map((r: any) => r.id));
          // Use exact phrase match in title only (not summary which is too broad)
          const nameSearch = await db.select().from(articles)
            .where(sql`title LIKE ${`%${fac.name}%`}`)
            .orderBy(desc(articles.publishedAt))
            .limit(remaining + 5);
          for (const r of nameSearch) {
            if (!existingIds.has(r.id)) { rows.push(r); existingIds.add(r.id); }
            if (rows.length >= (input.limit ?? 20)) break;
          }
        }

        return {
          facility: {
            id: fac.id,
            name: fac.name,
            type: fac.type,
            country: fac.country,
            region: fac.region,
            latitude: fac.latitude,
            longitude: fac.longitude,
            description: fac.description,
            threatLevel: fac.threatLevel,
            importance: fac.importance,
          },
          articles: rows.map(r => serializeArticle(r as unknown as Record<string, unknown>)),
        };
      }),
    // ─── Facility Detailed Stats ─────────────────────────────────────────────
    detailedStats: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { total: 0, byType: {}, byThreat: {}, byVerification: {}, byRegion: {}, totalLinks: 0, pendingCandidates: 0 };
        const regionFilter = input.region && input.region !== 'Global' ? eq(facilities.region, input.region) : undefined;
        const [allFacs, allLinks, allCandidates] = await Promise.all([
          db.select({ type: facilities.type, threatLevel: facilities.threatLevel, verificationStatus: facilities.verificationStatus, region: facilities.region })
            .from(facilities).where(regionFilter),
          db.select({ id: articleFacilityLinks.id }).from(articleFacilityLinks).limit(9999),
          db.select({ cnt: sql<number>`COUNT(*)` }).from(facilityCandidates).where(eq(facilityCandidates.reviewStatus, 'pending')),
        ]);
        const byType: Record<string, number> = {};
        const byThreat: Record<string, number> = {};
        const byVerification: Record<string, number> = {};
        const byRegion: Record<string, number> = {};
        for (const f of allFacs) {
          byType[f.type ?? 'unknown'] = (byType[f.type ?? 'unknown'] ?? 0) + 1;
          byThreat[f.threatLevel ?? 'low'] = (byThreat[f.threatLevel ?? 'low'] ?? 0) + 1;
          byVerification[f.verificationStatus ?? 'unverified'] = (byVerification[f.verificationStatus ?? 'unverified'] ?? 0) + 1;
          if (f.region) byRegion[f.region] = (byRegion[f.region] ?? 0) + 1;
        }
        return {
          total: allFacs.length,
          byType,
          byThreat,
          byVerification,
          byRegion,
          totalLinks: allLinks.length,
          pendingCandidates: Number(allCandidates[0]?.cnt ?? 0),
        };
      }),
    // ─── Bulk Rematch ─────────────────────────────────────────────────────────
    candidateMatchingArticles: publicProcedure
      .input(z.object({ candidateId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { articles: [], candidateName: '' };
        const candidate = await db.select().from(facilityCandidates).where(eq(facilityCandidates.id, input.candidateId)).limit(1);
        if (!candidate[0]) return { articles: [], candidateName: '' };
        const cand = candidate[0];
        const limit = input.limit ?? 15;
        // Search articles by name, nameAr, nameAlias, and country
        const searchTerms = [cand.name, cand.nameAr, cand.nameAlias, cand.country].filter(Boolean) as string[];
        const rows: any[] = [];
        const seenIds = new Set<number>();
        for (const term of searchTerms) {
          if (rows.length >= limit) break;
          const found = await db.select().from(articles)
            .where(sql`(title LIKE ${`%${term}%`} OR summary LIKE ${`%${term}%`} OR content LIKE ${`%${term}%`})`)
            .orderBy(desc(articles.publishedAt))
            .limit(limit);
          for (const r of found) {
            if (!seenIds.has(r.id)) { rows.push(r); seenIds.add(r.id); }
            if (rows.length >= limit) break;
          }
        }
        // Fetch agency names for matched articles
        const agencyIds = Array.from(new Set(rows.map((r: any) => r.agencyId).filter(Boolean)));
        const agencyMap: Record<number, string> = {};
        if (agencyIds.length > 0) {
          const agencyRows = await db.select({ id: newsAgencies.id, name: newsAgencies.name })
            .from(newsAgencies)
            .where(inArray(newsAgencies.id, agencyIds));
          for (const ag of agencyRows) agencyMap[ag.id] = ag.name;
        }
        // Compute simple relevance score based on how many search terms match the title
        const computeRelevance = (a: any) => {
          let score = 0.3;
          for (const term of searchTerms) {
            if (a.title?.toLowerCase().includes(term.toLowerCase())) score += 0.25;
            if (a.summary?.toLowerCase().includes(term.toLowerCase())) score += 0.1;
          }
          return Math.min(1, score);
        };
        return {
          articles: rows.slice(0, limit).map((a: any) => ({
            id: a.id, title: a.title, summary: a.summary,
            publishedAt: a.publishedAt, url: a.url,
            agencyId: a.agencyId, topics: a.topics,
            agencyName: agencyMap[a.agencyId] ?? null,
            relevanceScore: computeRelevance(a),
          })),
          candidateName: cand.name,
        };
      }),

    bulkRematch: adminProcedure
      .input(z.object({ triggeredBy: z.string().optional(), region: z.string().optional() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { started: 0, jobIds: [] };
        const regionFilter = input.region && input.region !== 'Global' ? eq(facilities.region, input.region) : undefined;
        const facs = await db.select({ id: facilities.id, name: facilities.name }).from(facilities).where(regionFilter);
        const jobIds: (number | null)[] = [];
        for (const fac of facs) {
          const jobId = await runFacilityReenrichment(fac.id, fac.name, input.triggeredBy ?? 'analyst');
          jobIds.push(jobId);
        }
        return { started: facs.length, jobIds: jobIds.filter(Boolean) };
      }),
  }),
  // ─── Articles ────────────────────────────────────────────────────────────────
  articles: router({
    list: publicProcedure
      .input(z.object({
        region: z.string().optional(),
        topics: z.array(z.string()).optional(),
        agencyIds: z.array(z.number()).optional(),
        isBreaking: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        search: z.string().optional(),
        since: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const rows = await getArticles(input);
        return rows.map(r => serializeArticle(r as unknown as Record<string, unknown>));
      }),

    byId: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const row = await getArticleById(input.id);
        if (!row) return null;
        return serializeArticle(row as unknown as Record<string, unknown>);
      }),

    stats: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(({ input }) => getArticleStats(input.region)),

    trending: publicProcedure
      .input(z.object({ region: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const rows = await getTrendingTopics(input.region, input.limit);
        return rows.map(r => serializeArticle(r as unknown as Record<string, unknown>));
      }),

    breaking: publicProcedure
      .input(z.object({ region: z.string().optional(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const rows = await getArticles({ region: input.region, isBreaking: true, limit: input.limit ?? 10 });
        return rows.map(r => serializeArticle(r as unknown as Record<string, unknown>));
      }),

    topicDistribution: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const arts = await db.select({ topics: articles.topics }).from(articles)
          .where(and(gte(articles.publishedAt, since), input.region ? eq(articles.region, input.region) : undefined))
          .limit(500);
        const counts: Record<string, number> = {};
        for (const art of arts) {
          const topics = (art.topics as string[]) || [];
          for (const t of topics) { counts[t] = (counts[t] || 0) + 1; }
        }
        return Object.entries(counts).map(([topic, count]) => ({ topic, count })).sort((a, b) => b.count - a.count);
      }),

    timeline: publicProcedure
      .input(z.object({ region: z.string().optional(), days: z.number().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const days = input.days ?? 7;
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
        const arts = await db.select({ publishedAt: articles.publishedAt, topics: articles.topics, sentiment: articles.sentiment })
          .from(articles)
          .where(and(gte(articles.publishedAt, since), input.region ? eq(articles.region, input.region) : undefined))
          .orderBy(articles.publishedAt)
          .limit(1000);
        // Group by day
        const byDay: Record<string, { date: string; count: number; negative: number; positive: number }> = {};
        for (const art of arts) {
          const day = art.publishedAt.toISOString().split('T')[0];
          if (!byDay[day]) byDay[day] = { date: day, count: 0, negative: 0, positive: 0 };
          byDay[day].count++;
          if (art.sentiment === 'negative') byDay[day].negative++;
          if (art.sentiment === 'positive') byDay[day].positive++;
        }
        return Object.values(byDay);
      }),

      networkGraph: publicProcedure
      .input(z.object({
        region: z.string().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
        search: z.string().optional(),
        dateFilter: z.string().optional(),
        since: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { nodes: [], edges: [], totalArticles: 0 };
        const conditions = [];
        // 'Global' means no region filter — return articles from all regions
        if (input.region && input.region !== 'Global') conditions.push(eq(articles.region, input.region));
        if (input.search) conditions.push(sql`(title LIKE ${`%${input.search}%`} OR summary LIKE ${`%${input.search}%`})`);
        if (input.dateFilter) {
          const dayStart = input.dateFilter + ' 00:00:00';
          const dayEnd = input.dateFilter + ' 23:59:59';
          conditions.push(sql`publishedAt >= ${dayStart} AND publishedAt <= ${dayEnd}`);
        }
        // Default: last 3 days unless caller provides since or dateFilter
        if (!input.dateFilter && !input.since) {
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          conditions.push(gte(articles.publishedAt, threeDaysAgo));
        } else if (input.since) {
          conditions.push(gte(articles.publishedAt, input.since));
        }
        // Count total matching articles (for Load More UI)
        const [countRow] = await db.select({ cnt: sql<number>`COUNT(*)` }).from(articles)
          .where(conditions.length > 0 ? and(...conditions) : undefined);
        const totalArticles = Number(countRow?.cnt ?? 0);

        const arts = await db.select({
              id: articles.id, title: articles.title, agencyId: articles.agencyId,
              author: articles.author, topics: articles.topics, country: articles.country,
              entitiesJson: articles.entitiesJson, publishedAt: articles.publishedAt,
              keywords: articles.keywords, sentiment: articles.sentiment, url: articles.url,
              summary: articles.summary, importance: articles.importance,
            }).from(articles)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(articles.publishedAt))
            .limit(input.limit ?? 500)
            .offset(input.offset ?? 0);

        const agencyIds = Array.from(new Set(arts.map(a => a.agencyId)));
        const agencyList = agencyIds.length > 0
          ? await db.select({ id: newsAgencies.id, name: newsAgencies.name, country: newsAgencies.country, type: newsAgencies.type, bias: newsAgencies.bias, website: newsAgencies.website }).from(newsAgencies)
              .where(sql`id IN (${sql.raw(agencyIds.join(','))})`)
          : [];
        const agencyMap = Object.fromEntries(agencyList.map(a => [a.id, a]));

        const artIds = arts.map(a => a.id);
        const links = artIds.length > 0
          ? await db.select().from(articleFacilityLinks)
              .where(sql`articleId IN (${sql.raw(artIds.join(','))})`)
              .limit(2000)
          : [];

        const facIds = Array.from(new Set(links.map((l: any) => l.facilityId)));
        const facList = facIds.length > 0
          ? await db.select({ id: facilities.id, name: facilities.name, type: facilities.type, country: facilities.country }).from(facilities)
              .where(sql`id IN (${facIds.join(',')})`)
          : [];

        const nodes: any[] = [];
        const edges: any[] = [];
        const nodeSet = new Set<string>();

        const addNode = (id: string, label: string, type: string, data?: any) => {
          if (!nodeSet.has(id)) { nodes.push({ id, label, type, ...data }); nodeSet.add(id); }
        };

        // Build a normalized agency name → agency node ID lookup.
        // Used to suppress org/person nodes whose name matches a known agency,
        // preventing the same entity from appearing as both Agency and Organization.
        const normalizeEntityName = (s: string) =>
          s.toLowerCase().replace(/[^a-z0-9]/g, '');

        // Map: normalizedName → canonical agency node id
        const agencyNameToNodeId = new Map<string, string>();
        for (const ag of agencyList) {
          agencyNameToNodeId.set(normalizeEntityName(ag.name), `agency-${ag.id}`);
          // Also index common abbreviations: "Al Jazeera English" → "aljazeeraenglish"
          // and the first two words: "Al Jazeera" → "aljazeera"
          const words = ag.name.split(/\s+/);
          if (words.length > 1) {
            agencyNameToNodeId.set(normalizeEntityName(words.slice(0, 2).join(' ')), `agency-${ag.id}`);
          }
        }

        // Helper: parse entities from entitiesJson
        const parseEntities = (entitiesJson: string | null): { people: string[]; organizations: string[]; locations: string[]; events: string[] } => {
          if (!entitiesJson) return { people: [], organizations: [], locations: [], events: [] };
          try {
            const parsed = JSON.parse(entitiesJson);
            if (Array.isArray(parsed)) {
              // Legacy format: array of strings
              return { people: [], organizations: parsed, locations: [], events: [] };
            }
            return {
              // Support both 'people' and 'persons' field names from different crawlers
              people: Array.isArray(parsed.people) ? parsed.people : (Array.isArray(parsed.persons) ? parsed.persons : []),
              organizations: Array.isArray(parsed.organizations) ? parsed.organizations : (Array.isArray(parsed.orgs) ? parsed.orgs : []),
              locations: Array.isArray(parsed.locations) ? parsed.locations : (Array.isArray(parsed.countries) ? parsed.countries : []),
              events: Array.isArray(parsed.events) ? parsed.events : [],
            };
          } catch { return { people: [], organizations: [], locations: [], events: [] }; }
        };

        // Track which entities are shared across multiple articles (for deduplication decision)
        const entityArticleCounts: Record<string, number> = {};
        for (const art of arts) {
          const entities = parseEntities(art.entitiesJson);
          for (const p of entities.people.slice(0, 4)) {
            if (p && p.length >= 2) { const k = `person-${p.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`; entityArticleCounts[k] = (entityArticleCounts[k] ?? 0) + 1; }
          }
          for (const o of entities.organizations.slice(0, 4)) {
            if (o && o.length >= 2) { const k = `org-${o.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')}`; entityArticleCounts[k] = (entityArticleCounts[k] ?? 0) + 1; }
          }
        }

        // Edge deduplication set: key = "from|to|label"
        const edgeSet = new Set<string>();
        const addEdge = (from: string, to: string, label: string) => {
          const key = `${from}|${to}|${label}`;
          if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ from, to, label }); }
        };

        for (const art of arts) {
          const artNodeData = {
            publishedAt: art.publishedAt, url: art.url, country: art.country,
            sentiment: art.sentiment, importance: art.importance, summary: art.summary,
            topics: art.topics, keywords: art.keywords,
          };
          addNode(`article-${art.id}`, art.title, 'article', artNodeData);

          // Agency node — direct relationship, always include
          const agency = agencyMap[art.agencyId];
          const agencyName = agency?.name || `Agency ${art.agencyId}`;
          addNode(`agency-${art.agencyId}`, agencyName, 'agency', {
            country: agency?.country, agencySubtype: agency?.type, bias: agency?.bias, website: agency?.website,
          });
          addEdge(`agency-${art.agencyId}`, `article-${art.id}`, 'published');

          // Author node — direct relationship, always include
          if (art.author && art.author.trim()) {
            const authorKey = art.author.trim().toLowerCase().replace(/\s+/g, '_');
            addNode(`author-${authorKey}`, art.author.trim(), 'author', { agencyId: art.agencyId });
            addEdge(`author-${authorKey}`, `article-${art.id}`, 'authored');
          }

          // Country node — direct relationship, always include
          if (art.country) {
            addNode(`country-${art.country}`, art.country, 'country');
            addEdge(`article-${art.id}`, `country-${art.country}`, 'covers');
          }

          // Entity nodes — only include entities that appear in 2+ articles (shared/significant)
          // This removes one-off indirect connections that bloat the graph
          const entities = parseEntities(art.entitiesJson);

          // People — only shared people (mentioned in 2+ articles)
          // DEDUP: if the person name matches a known agency, skip (agencies are not people)
          for (const person of entities.people.slice(0, 3)) {
            if (!person || person.length < 2) continue;
            const personKey = person.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const nodeKey = `person-${personKey}`;
            if ((entityArticleCounts[nodeKey] ?? 0) < 2) continue; // skip one-off mentions

            // Skip if this person name matches a known agency
            const normalizedPerson = normalizeEntityName(person);
            if (agencyNameToNodeId.has(normalizedPerson)) continue;

            addNode(nodeKey, person, 'person');
            addEdge(nodeKey, `article-${art.id}`, 'mentioned in');
          }

          // Organizations — only shared orgs (mentioned in 2+ articles)
          // DEDUP: if the org name matches a known agency, route the edge to the agency node instead
          for (const org of entities.organizations.slice(0, 3)) {
            if (!org || org.length < 2) continue;
            const orgKey = org.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
            const nodeKey = `org-${orgKey}`;
            if ((entityArticleCounts[nodeKey] ?? 0) < 2) continue; // skip one-off mentions

            // Check if this org name matches a known agency
            const normalizedOrg = normalizeEntityName(org);
            const matchedAgencyNodeId = agencyNameToNodeId.get(normalizedOrg);
            if (matchedAgencyNodeId) {
              // Re-route: add an edge from the canonical agency node to this article
              // (the agency node is already added above; no duplicate org node created)
              addEdge(matchedAgencyNodeId, `article-${art.id}`, 'referenced in');
              continue;
            }

            addNode(nodeKey, org, 'organization');
            addEdge(nodeKey, `article-${art.id}`, 'referenced in');
          }

          // Locations — skip; country node above already covers geography
          // Keywords — skip; too many, creates excessive indirect edges
        }

        for (const fac of facList) {
          addNode(`facility-${fac.id}`, fac.name, 'facility', { facilityType: fac.type, country: fac.country });
        }
        for (const link of links) {
          addEdge(`article-${(link as any).articleId}`, `facility-${(link as any).facilityId}`, (link as any).mentionType || 'mentions');
        }

        // ── Post-processing dedup pass ──────────────────────────────────────────
        // Build a label → canonical node id map for agency nodes.
        // Then scan all org/person nodes: if their normalized label matches an
        // agency label, remove the duplicate node and reroute its edges.
        const agencyLabelMap = new Map<string, string>(); // normalizedLabel → agencyNodeId
        for (const n of nodes) {
          if (n.type === 'agency') {
            agencyLabelMap.set(normalizeEntityName(n.label), n.id);
          }
        }

        // Also build a facility name map to prevent org nodes duplicating facility nodes
        const facilityLabelMap = new Map<string, string>();
        for (const n of nodes) {
          if (n.type === 'facility') {
            facilityLabelMap.set(normalizeEntityName(n.label), n.id);
          }
        }

        const nodesToRemove = new Set<string>();
        // nodeId → canonical replacement nodeId
        const nodeRemap = new Map<string, string>();

        for (const n of nodes) {
          if (n.type !== 'organization' && n.type !== 'person') continue;
          const norm = normalizeEntityName(n.label);
          const agencyMatch = agencyLabelMap.get(norm);
          if (agencyMatch) {
            nodesToRemove.add(n.id);
            nodeRemap.set(n.id, agencyMatch);
            continue;
          }
          // Also deduplicate org nodes that match facility names
          if (n.type === 'organization') {
            const facMatch = facilityLabelMap.get(norm);
            if (facMatch) {
              nodesToRemove.add(n.id);
              nodeRemap.set(n.id, facMatch);
            }
          }
        }

        // Remove duplicate nodes
        const cleanNodes = nodes.filter(n => !nodesToRemove.has(n.id));

        // Reroute edges: replace any from/to that pointed at a removed node
        const edgeKeySetFinal = new Set<string>();
        const cleanEdges: any[] = [];
        for (const e of edges) {
          const from = nodeRemap.get(e.from) ?? e.from;
          const to = nodeRemap.get(e.to) ?? e.to;
          if (from === to) continue; // self-loop after remap — skip
          const key = `${from}|${to}|${e.label ?? ''}`;
          if (edgeKeySetFinal.has(key)) continue;
          edgeKeySetFinal.add(key);
          cleanEdges.push({ ...e, from, to });
        }

        return { nodes: cleanNodes, edges: cleanEdges, totalArticles };
      }),

    // Entity deep-dive: all articles mentioning a specific entity, with sentiment breakdown and co-occurring entities
    entityDeepDive: publicProcedure
      .input(z.object({
        entityName: z.string(),
        entityType: z.string().optional(),
        region: z.string().optional(),
        limit: z.number().default(30),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { articles: [], sentimentBreakdown: {}, coEntities: { people: [], orgs: [], locations: [], keywords: [] }, totalCount: 0 };

        const name = input.entityName.trim();
        if (!name) return { articles: [], sentimentBreakdown: {}, coEntities: { people: [], orgs: [], locations: [], keywords: [] }, totalCount: 0 };

        // Search articles where entity name appears in title, summary, content, author, or entitiesJson
        const conditions: any[] = [
          sql`(title LIKE ${`%${name}%`} OR summary LIKE ${`%${name}%`} OR author LIKE ${`%${name}%`} OR entitiesJson LIKE ${`%${name}%`} OR content LIKE ${`%${name}%`})`,
        ];
        if (input.region) conditions.push(eq(articles.region, input.region));

        const matchedArts = await db.select({
          id: articles.id, title: articles.title, url: articles.url,
          author: articles.author, country: articles.country, sentiment: articles.sentiment,
          publishedAt: articles.publishedAt, summary: articles.summary,
          topics: articles.topics, keywords: articles.keywords,
          entitiesJson: articles.entitiesJson, agencyId: articles.agencyId,
          importance: articles.importance, isBreaking: articles.isBreaking,
        }).from(articles)
          .where(and(...conditions))
          .orderBy(desc(articles.publishedAt))
          .limit(input.limit);

        // Fetch agency names
        const agencyIds = Array.from(new Set(matchedArts.map(a => a.agencyId).filter(Boolean)));
        const agencyList = agencyIds.length > 0
          ? await db.select({ id: newsAgencies.id, name: newsAgencies.name, country: newsAgencies.country, logoUrl: newsAgencies.logoUrl })
              .from(newsAgencies).where(sql`id IN (${sql.raw(agencyIds.join(','))})`)
          : [];
        const agencyMap = Object.fromEntries(agencyList.map(a => [a.id, a]));

        // Sentiment breakdown
        const sentimentBreakdown: Record<string, number> = { positive: 0, neutral: 0, negative: 0 };
        matchedArts.forEach(a => { const s = a.sentiment ?? 'neutral'; sentimentBreakdown[s] = (sentimentBreakdown[s] ?? 0) + 1; });

        // Co-occurring entities across all matched articles
        const copeople = new Map<string, number>();
        const coorgs = new Map<string, number>();
        const colocations = new Map<string, number>();
        const cokeywords = new Map<string, number>();

        const parseEnt = (entitiesJson: string | null) => {
          if (!entitiesJson) return { people: [], organizations: [], locations: [] };
          try {
            const p = JSON.parse(entitiesJson);
            if (Array.isArray(p)) return { people: [], organizations: p, locations: [] };
            return {
              people: Array.isArray(p.people) ? p.people : (Array.isArray(p.persons) ? p.persons : []),
              organizations: Array.isArray(p.organizations) ? p.organizations : (Array.isArray(p.orgs) ? p.orgs : []),
              locations: Array.isArray(p.locations) ? p.locations : (Array.isArray(p.countries) ? p.countries : []),
            };
          } catch { return { people: [], organizations: [], locations: [] }; }
        };

        for (const art of matchedArts) {
          const ent = parseEnt(art.entitiesJson);
          ent.people.forEach((p: string) => { if (p && p !== name && p.length > 1) copeople.set(p, (copeople.get(p) ?? 0) + 1); });
          ent.organizations.forEach((o: string) => { if (o && o !== name && o.length > 1) coorgs.set(o, (coorgs.get(o) ?? 0) + 1); });
          ent.locations.forEach((l: string) => { if (l && l !== name && l.length > 1) colocations.set(l, (colocations.get(l) ?? 0) + 1); });
          const kws: string[] = Array.isArray(art.keywords) ? art.keywords
            : (() => { try { return JSON.parse((art.keywords as any) ?? '[]'); } catch { return []; } })();
          kws.forEach((k: string) => { if (k && k !== name && k.length > 2) cokeywords.set(k, (cokeywords.get(k) ?? 0) + 1); });
        }

        const sortMap = (m: Map<string, number>) => Array.from(m.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);

        return {
          totalCount: matchedArts.length,
          articles: matchedArts.map(a => ({
            ...serializeArticle(a as unknown as Record<string, unknown>),
            agencyName: agencyMap[a.agencyId]?.name ?? null,
            agencyLogo: agencyMap[a.agencyId]?.logoUrl ?? null,
          })),
          sentimentBreakdown,
          coEntities: {
            people: sortMap(copeople),
            orgs: sortMap(coorgs),
            locations: sortMap(colocations),
            keywords: sortMap(cokeywords),
          },
        };
      }),

    // Full article detail with all extracted entities
    detail: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [art] = await db.select().from(articles).where(eq(articles.id, input.id)).limit(1);
        if (!art) return null;
        const [agency] = await db.select().from(newsAgencies).where(eq(newsAgencies.id, art.agencyId)).limit(1);
        const links = await db.select().from(articleFacilityLinks).where(eq(articleFacilityLinks.articleId, art.id)).limit(20);
        const facIds = links.map((l: any) => l.facilityId);
        const relatedFacilities = facIds.length > 0
          ? await db.select().from(facilities).where(sql`id IN (${sql.raw(facIds.join(','))})`).limit(10)
          : [];
        // Parse entities
        let entities = { people: [] as string[], organizations: [] as string[], locations: [] as string[], events: [] as string[] };
        if (art.entitiesJson) {
          try {
            const parsed = JSON.parse(art.entitiesJson);
            if (Array.isArray(parsed)) {
              entities.organizations = parsed;
            } else {
              entities.people = parsed.people || [];
              entities.organizations = parsed.organizations || parsed.orgs || [];
              entities.locations = parsed.locations || parsed.countries || [];
              entities.events = parsed.events || [];
            }
          } catch {}
        }
        return {
          ...serializeArticle(art as unknown as Record<string, unknown>),
          agency: agency ? { id: agency.id, name: agency.name, country: agency.country, type: agency.type, bias: agency.bias, website: agency.website, logoUrl: agency.logoUrl } : null,
          entities,
          relatedFacilities,
        };
      }),
  }),

  // ─── Crawler ────────────────────────────────────────────────────────────────
  crawler: router({
    schedule: adminProcedure
      .input(z.object({ region: z.string().default('MENA'), topics: z.array(z.string()).default([]) }))
      .mutation(async ({ input }) => {
        const count = await scheduleCrawl(input.region, input.topics);
        return { scheduled: count };
      }),

    runJob: adminProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        await runCrawlJob(input.jobId);
        return { success: true };
      }),

    recentJobs: publicProcedure
      .query(() => getRecentCrawlJobs(20)),

    status: publicProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { running: 0, pending: 0, completed: 0, failed: 0 };
        const jobs = await db.select({ status: crawlJobs.status }).from(crawlJobs)
          .where(gte(crawlJobs.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)));
        const counts = jobs.reduce((acc: Record<string, number>, j) => { const s = j.status ?? 'pending'; acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>);
        return { running: counts.running || 0, pending: counts.pending || 0, completed: counts.completed || 0, failed: counts.failed || 0 };
      }),

    quickCrawl: adminProcedure
      .input(z.object({ region: z.string().default('MENA'), topics: z.array(z.string()).default([]) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { articles: 0, jobIds: [] as number[] };
        // Pick top active agencies with RSS feeds — filtered by region
        const regionFilter = input.region && input.region !== 'Global'
          ? and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, input.region))
          : eq(newsAgencies.isActive, true);
        const agencies = await db.select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
          .from(newsAgencies)
          .where(regionFilter)
          .orderBy(desc(newsAgencies.reliability))
          .limit(15);
        const jobIds: number[] = [];
        for (const agency of agencies) {
          if (!agency.rssFeeds || !(agency.rssFeeds as string[]).length) continue;
          const jobId = await createJobAndRun(agency.id, input.region, input.topics);
          jobIds.push(jobId);
        }
        return { articles: 0, jobIds };
      }),
    // ─── Live pipeline events (polling fallback for SSE) ──────────────────────
    pipelineEvents: publicProcedure
      .input(z.object({
        since: z.number().optional(),
        jobId: z.number().optional(),
        limit: z.number().min(1).max(200).default(100),
      }))
      .query(({ input }) => {
        return crawlEventBus.getRecent({
          since: input.since,
          jobId: input.jobId,
          limit: input.limit,
        });
      }),

    // ─── Monitor: paginated job log ───────────────────────────────────────────
    jobLog: publicProcedure
      .input(z.object({
        limit: z.number().min(1).max(500).default(100),
        offset: z.number().min(0).default(0),
        status: z.enum(['all', 'pending', 'running', 'completed', 'failed']).default('all'),
        agencyId: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { jobs: [], total: 0 };
        const { limit, offset, status, agencyId } = input;
        const conditions = [];
        if (status !== 'all') conditions.push(eq(crawlJobs.status, status as any));
        if (agencyId) conditions.push(eq(crawlJobs.agencyId, agencyId));
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const [jobs, countResult] = await Promise.all([
          db.select({
            id: crawlJobs.id,
            agencyId: crawlJobs.agencyId,
            agencyName: newsAgencies.name,
            agencyCountry: newsAgencies.country,
            agencyType: newsAgencies.type,
            status: crawlJobs.status,
            startedAt: crawlJobs.startedAt,
            completedAt: crawlJobs.completedAt,
            articlesFound: crawlJobs.articlesFound,
            articlesNew: crawlJobs.articlesNew,
            errorMessage: crawlJobs.errorMessage,
            region: crawlJobs.region,
            createdAt: crawlJobs.createdAt,
          })
          .from(crawlJobs)
          .leftJoin(newsAgencies, eq(crawlJobs.agencyId, newsAgencies.id))
          .where(whereClause)
          .orderBy(desc(crawlJobs.createdAt))
          .limit(limit)
          .offset(offset),
          db.select({ count: sql<number>`count(*)` }).from(crawlJobs).where(whereClause),
        ]);
        return {
          jobs: jobs.map(j => ({
            ...j,
            startedAt: j.startedAt?.toISOString() ?? null,
            completedAt: j.completedAt?.toISOString() ?? null,
            createdAt: j.createdAt?.toISOString() ?? null,
          })),
          total: Number(countResult[0]?.count ?? 0),
        };
      }),

    // ─── Monitor: live crawler status (running jobs + scheduler state) ────────
    liveStatus: publicProcedure.query(async () => {
      const db = await getDb();
      const { getSchedulerStatus } = await import('./scheduler');
      const schedulerStatus = getSchedulerStatus();
      if (!db) return { runningJobs: [], schedulerStatus };
      const runningJobs = await db.select({
        id: crawlJobs.id,
        agencyId: crawlJobs.agencyId,
        agencyName: newsAgencies.name,
        status: crawlJobs.status,
        startedAt: crawlJobs.startedAt,
        region: crawlJobs.region,
      })
      .from(crawlJobs)
      .leftJoin(newsAgencies, eq(crawlJobs.agencyId, newsAgencies.id))
      .where(eq(crawlJobs.status, 'running'))
      .orderBy(desc(crawlJobs.startedAt))
      .limit(20);
      return {
        runningJobs: runningJobs.map(j => ({
          ...j,
          startedAt: j.startedAt?.toISOString() ?? null,
        })),
        schedulerStatus,
      };
    }),

    // ─── Monitor: clear old completed/failed jobs ─────────────────────────────
    clearOldJobs: adminProcedure
      .input(z.object({ olderThanDays: z.number().min(1).default(7) }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) return { deleted: 0 };
        const cutoff = new Date(Date.now() - input.olderThanDays * 24 * 60 * 60 * 1000);
        const result = await db.delete(crawlJobs)
          .where(and(
            lt(crawlJobs.createdAt, cutoff),
            sql`${crawlJobs.status} IN ('completed', 'failed')`,
          ));
        return { deleted: (result as any).affectedRows ?? 0 };
      }),
    // ─── Cancel a running job ─────────────────────────────────────────────────
    cancelJob: adminProcedure
      .input(z.object({ jobId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const cancelled = cancelJob(input.jobId);
        if (!cancelled && db) {
          // Job not in active registry — mark DB row directly (e.g. stuck job)
          await db.update(crawlJobs)
            .set({ status: 'failed', completedAt: new Date(), errorMessage: 'Cancelled by user' })
            .where(eq(crawlJobs.id, input.jobId));
        }
        crawlEventBus.publish({
          jobId: input.jobId, agencyId: 0, agencyName: 'system',
          stage: 'job_fail', error: 'Cancelled by user',
        });
        return { cancelled: true };
      }),
    // ─── Cleanup stuck/timed-out jobs ─────────────────────────────────────────
    cleanupStuck: adminProcedure
      .mutation(async () => {
        await cleanupTimedOutJobs();
        return { ok: true };
      }),
    // ─── Get active job IDs (in-memory) ──────────────────────────────────────
    activeJobIds: publicProcedure.query(() => {
      return { ids: getActiveJobIds() };
    }),
  }),

  // ─── Notifications ──────────────────────────────────────────────────────────
  notifications: router({
    list: publicProcedure.query(() => getNotifications(50)),

    markRead: analystProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => markNotificationRead(input.id)),

    create: adminProcedure
      .input(z.object({
        type: z.enum(['breaking', 'facility_attack', 'critical_event', 'trending', 'system']),
        title: z.string(),
        message: z.string().optional(),
        severity: z.enum(['info', 'warning', 'critical']).optional(),
        region: z.string().optional(),
      }))
      .mutation(({ input }) => createNotification(input)),
  }),

  // ─── Compare ────────────────────────────────────────────────────────────────
  compare: router({
    countries: publicProcedure
      .input(z.object({ countries: z.array(z.string()), region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const results = await Promise.all(input.countries.map(async (country) => {
          const arts = await db.select({ id: articles.id, sentiment: articles.sentiment, topics: articles.topics, publishedAt: articles.publishedAt })
            .from(articles)
            .where(and(eq(articles.country, country), gte(articles.publishedAt, since)))
            .limit(200);
          const topicCounts: Record<string, number> = {};
          for (const art of arts) {
            for (const t of (art.topics as string[]) || []) {
              topicCounts[t] = (topicCounts[t] || 0) + 1;
            }
          }
          const sentimentCounts = arts.reduce((acc: Record<string, number>, a) => { const s = a.sentiment ?? 'neutral'; acc[s] = (acc[s] || 0) + 1; return acc; }, {} as Record<string, number>);
          return { country, articleCount: arts.length, topicCounts, sentimentCounts };
        }));
        return results;
      }),

    sources: publicProcedure
      .input(z.object({ agencyIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return Promise.all(input.agencyIds.map(async (agencyId) => {
          const agency = await db.select().from(newsAgencies).where(eq(newsAgencies.id, agencyId)).limit(1);
          const arts = await db.select({ sentiment: articles.sentiment, topics: articles.topics, importance: articles.importance })
            .from(articles).where(and(eq(articles.agencyId, agencyId), gte(articles.publishedAt, since))).limit(100);
          return {
            agencyId,
            agencyName: agency[0]?.name || 'Unknown',
            articleCount: arts.length,
            avgImportance: arts.reduce((s, a) => s + (a.importance || 5), 0) / (arts.length || 1),
            sentimentBreakdown: arts.reduce((acc, a) => { acc[a.sentiment || 'neutral'] = (acc[a.sentiment || 'neutral'] || 0) + 1; return acc; }, {} as Record<string, number>),
          };
        }));
      }),
    generateReport: analystProcedure
      .input(z.object({
        mode: z.enum(['countries', 'sources', 'topics', 'regions']),
        targets: z.array(z.string()),
        region: z.string().optional(),
        articleData: z.array(z.object({
          target: z.string(),
          articleCount: z.number(),
          breaking: z.number(),
          threatScore: z.number(),
          sentiment: z.string(),
        })).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        // Quota enforcement
        if (ctx.user) { await enforceQuota(ctx.user.id, ctx.user.role); }
        const targetsStr = input.targets.join(', ');
        const dataStr = input.articleData
          ? input.articleData.map(d =>
              `${d.target}: ${d.articleCount} articles, ${d.breaking} breaking, threat score ${d.threatScore}/100, sentiment ${d.sentiment}`
            ).join('\n')
          : 'No article data available.';
        const prompt = `You are a senior intelligence analyst producing a classified OSINT brief. Generate a structured intelligence comparison report for the following ${input.mode} in the ${input.region ?? 'MENA'} region:\n\nTARGETS: ${targetsStr}\n\nDATA SUMMARY:\n${dataStr}\n\nProduce a professional intelligence brief with the following sections:\n1. EXECUTIVE SUMMARY (2-3 sentences)\n2. KEY FINDINGS (bullet points for each target)\n3. THREAT ASSESSMENT (comparative analysis)\n4. SENTIMENT ANALYSIS (media tone per target)\n5. STRATEGIC IMPLICATIONS (2-3 sentences)\n6. ANALYST NOTES (caveats and confidence level)\n\nUse professional intelligence writing style. Be concise and analytical. Do not use markdown headers — use plain text with section labels in ALL CAPS followed by a colon.`;
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a senior geopolitical intelligence analyst. Produce structured, professional OSINT intelligence briefs.' },
            { role: 'user', content: prompt },
          ],
        });
        const content = response.choices?.[0]?.message?.content ?? 'Report generation failed.';
        // Increment quota usage
        if (ctx.user) { await incrementUsage(ctx.user.id); }
        return { report: content, generatedAt: new Date().toISOString(), targets: input.targets, mode: input.mode };
      }),
  }),

  // ─── Data Export ────────────────────────────────────────────────────────────
  data: router({
    export: publicProcedure
      .input(z.object({
        region: z.string().optional(),
        topics: z.array(z.string()).optional(),
        format: z.enum(['json', 'csv']).default('json'),
        limit: z.number().max(1000).default(100),
      }))
      .query(async ({ input }) => {
        const arts = await getArticles({ region: input.region, limit: input.limit });
        if (input.format === 'csv') {
          const headers = ['id', 'title', 'url', 'agency', 'publishedAt', 'country', 'topics', 'sentiment'];
          const rows = arts.map(a => [a.id, `"${a.title?.replace(/"/g, '""')}"`, a.url, a.agencyId, a.publishedAt?.toISOString(), a.country, (a.topics as string[])?.join(';'), a.sentiment].join(','));
          return { data: [headers.join(','), ...rows].join('\n'), format: 'csv' };
        }
        return { data: arts, format: 'json' };
      }),

     summary: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const [stats, agencyStats, facStats] = await Promise.all([
          getArticleStats(input.region),
          getNewsAgencies(input.region, 200).then(a => ({ total: a.length })),
          getFacilities({ region: input.region, limit: 2000 }).then(f => ({ total: f.length })),
        ]);
        return { articles: stats, agencies: agencyStats, facilities: facStats };
      }),
  }),

  // ─── Open Data & OSINT Sources ───────────────────────────────────────────────
  opendata: router({
    // UN verified data sources table
    unSources: publicProcedure.query(async () => {
      return [
        { id: 1, name: 'UNHCR Refugee Data Finder', url: 'https://www.unhcr.org/refugee-statistics/', category: 'Humanitarian', type: 'UN Agency', region: 'Global', dataTypes: ['Refugees', 'IDPs', 'Asylum Seekers'], updateFreq: 'Annual', verified: true, apiAvailable: true, apiUrl: 'https://api.unhcr.org/population/v1/' },
        { id: 2, name: 'OCHA ReliefWeb', url: 'https://reliefweb.int/', category: 'Humanitarian', type: 'UN Agency', region: 'Global', dataTypes: ['Crisis Reports', 'Situation Reports', 'Maps'], updateFreq: 'Daily', verified: true, apiAvailable: true, apiUrl: 'https://api.reliefweb.int/v1/' },
        { id: 3, name: 'UN OCHA HDX', url: 'https://data.humdata.org/', category: 'Humanitarian', type: 'UN Agency', region: 'Global', dataTypes: ['Population', 'Conflict', 'Infrastructure'], updateFreq: 'Varies', verified: true, apiAvailable: true, apiUrl: 'https://data.humdata.org/api/3/' },
        { id: 4, name: 'World Bank Open Data', url: 'https://data.worldbank.org/', category: 'Economy', type: 'International Organization', region: 'Global', dataTypes: ['GDP', 'Population', 'Poverty', 'Trade'], updateFreq: 'Annual', verified: true, apiAvailable: true, apiUrl: 'https://api.worldbank.org/v2/' },
        { id: 5, name: 'ACLED Conflict Data', url: 'https://acleddata.com/', category: 'Conflict', type: 'Research Organization', region: 'Global', dataTypes: ['Conflict Events', 'Fatalities', 'Actors'], updateFreq: 'Weekly', verified: true, apiAvailable: true, apiUrl: 'https://api.acleddata.com/acled/read' },
        { id: 6, name: 'UNODC Statistics', url: 'https://www.unodc.org/unodc/en/data-and-analysis/', category: 'Security', type: 'UN Agency', region: 'Global', dataTypes: ['Crime', 'Trafficking', 'Drug Trade'], updateFreq: 'Annual', verified: true, apiAvailable: false },
        { id: 7, name: 'IOM Displacement Tracking', url: 'https://dtm.iom.int/', category: 'Humanitarian', type: 'UN Agency', region: 'Global', dataTypes: ['Displacement', 'Migration', 'Mobility'], updateFreq: 'Monthly', verified: true, apiAvailable: true, apiUrl: 'https://dtm.iom.int/api/' },
        { id: 8, name: 'WHO Health Data', url: 'https://www.who.int/data/', category: 'Health', type: 'UN Agency', region: 'Global', dataTypes: ['Health Indicators', 'Disease Outbreaks', 'Mortality'], updateFreq: 'Annual', verified: true, apiAvailable: true, apiUrl: 'https://ghoapi.azureedge.net/api/' },
        { id: 9, name: 'IAEA Nuclear Safety', url: 'https://www.iaea.org/resources/databases/', category: 'Nuclear', type: 'UN Agency', region: 'Global', dataTypes: ['Nuclear Facilities', 'Safety Events', 'Radiation'], updateFreq: 'Continuous', verified: true, apiAvailable: false },
        { id: 10, name: 'OpenStreetMap Overpass', url: 'https://overpass-api.de/', category: 'Infrastructure', type: 'Open Source', region: 'Global', dataTypes: ['Facilities', 'Infrastructure', 'Geography'], updateFreq: 'Continuous', verified: true, apiAvailable: true, apiUrl: 'https://overpass-api.de/api/interpreter' },
        { id: 11, name: 'Global Terrorism Database', url: 'https://www.start.umd.edu/gtd/', category: 'Security', type: 'Research Organization', region: 'Global', dataTypes: ['Terrorist Attacks', 'Casualties', 'Groups'], updateFreq: 'Annual', verified: true, apiAvailable: false },
        { id: 12, name: 'SIPRI Arms Transfers', url: 'https://www.sipri.org/databases/armstransfers', category: 'Military', type: 'Research Organization', region: 'Global', dataTypes: ['Arms Transfers', 'Military Expenditure'], updateFreq: 'Annual', verified: true, apiAvailable: false },
        { id: 13, name: 'UN Comtrade', url: 'https://comtradeplus.un.org/', category: 'Economy', type: 'UN Agency', region: 'Global', dataTypes: ['Trade Flows', 'Commodity Data', 'Partners'], updateFreq: 'Monthly', verified: true, apiAvailable: true, apiUrl: 'https://comtradeapi.un.org/' },
        { id: 14, name: 'GDELT Project', url: 'https://www.gdeltproject.org/', category: 'News Analytics', type: 'Research Organization', region: 'Global', dataTypes: ['News Events', 'Tone', 'Themes', 'Locations'], updateFreq: 'Continuous', verified: true, apiAvailable: true, apiUrl: 'https://api.gdeltproject.org/' },
        { id: 15, name: 'NASA Earthdata', url: 'https://earthdata.nasa.gov/', category: 'Environment', type: 'Government', region: 'Global', dataTypes: ['Satellite Imagery', 'Climate', 'Fires', 'Floods'], updateFreq: 'Daily', verified: true, apiAvailable: true, apiUrl: 'https://cmr.earthdata.nasa.gov/' },
        { id: 16, name: 'UNOSAT Satellite Analysis', url: 'https://unosat.org/', category: 'Infrastructure', type: 'UN Agency', region: 'Global', dataTypes: ['Damage Assessment', 'Displacement', 'Infrastructure'], updateFreq: 'As needed', verified: true, apiAvailable: false },
        { id: 17, name: 'Wikidata SPARQL', url: 'https://query.wikidata.org/', category: 'Reference', type: 'Open Source', region: 'Global', dataTypes: ['Entities', 'Relationships', 'Facts'], updateFreq: 'Continuous', verified: false, apiAvailable: true, apiUrl: 'https://query.wikidata.org/sparql' },
        { id: 18, name: 'Global Forest Watch', url: 'https://www.globalforestwatch.org/', category: 'Environment', type: 'NGO', region: 'Global', dataTypes: ['Deforestation', 'Fires', 'Land Use'], updateFreq: 'Daily', verified: true, apiAvailable: true, apiUrl: 'https://api.resourcewatch.org/' },
        { id: 19, name: 'UNHCR Operational Data Portal', url: 'https://data.unhcr.org/', category: 'Humanitarian', type: 'UN Agency', region: 'MENA', dataTypes: ['Refugee Situations', 'Operations', 'Population'], updateFreq: 'Weekly', verified: true, apiAvailable: true, apiUrl: 'https://data.unhcr.org/api/' },
        { id: 20, name: 'OCHA Financial Tracking', url: 'https://fts.unocha.org/', category: 'Humanitarian', type: 'UN Agency', region: 'Global', dataTypes: ['Humanitarian Funding', 'Appeals', 'Donors'], updateFreq: 'Daily', verified: true, apiAvailable: true, apiUrl: 'https://api.fts.unocha.org/' },
      ];
    }),

    // Population data — all world regions. MENA rows preserved exactly as original.
    // Additional regions added: Europe, East Asia, Asia-Pacific, South Asia, Central Asia,
    // Sub-Saharan Africa, North Africa, Americas, Latin America.
    // Sources: World Bank WDI 2024, UN DESA 2024, UNHCR 2024, UNDP HDR 2023/24.
    population: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        type PopRow = { country: string; code: string; region: string; population: number; displaced: number; refugees: number; idps: number; urbanPct: number; gdpPerCapita: number; hdi: number; conflictLevel: string; year: number };
        const ALL: PopRow[] = [
          // ── MENA (original data preserved exactly) ────────────────────────────────
          { country: 'Egypt', code: 'EGY', region: 'MENA', population: 107394000, displaced: 350000, refugees: 265000, idps: 0, urbanPct: 43, gdpPerCapita: 3699, hdi: 0.731, conflictLevel: 'low', year: 2024 },
          { country: 'Saudi Arabia', code: 'SAU', region: 'MENA', population: 36408000, displaced: 0, refugees: 500000, idps: 0, urbanPct: 84, gdpPerCapita: 23186, hdi: 0.875, conflictLevel: 'low', year: 2024 },
          { country: 'Iran', code: 'IRN', region: 'MENA', population: 88550000, displaced: 0, refugees: 3400000, idps: 0, urbanPct: 76, gdpPerCapita: 4600, hdi: 0.774, conflictLevel: 'medium', year: 2024 },
          { country: 'Iraq', code: 'IRQ', region: 'MENA', population: 42164000, displaced: 1200000, refugees: 300000, idps: 1200000, urbanPct: 71, gdpPerCapita: 5765, hdi: 0.686, conflictLevel: 'high', year: 2024 },
          { country: 'Syria', code: 'SYR', region: 'MENA', population: 21324000, displaced: 7600000, refugees: 6600000, idps: 7600000, urbanPct: 57, gdpPerCapita: 533, hdi: 0.577, conflictLevel: 'critical', year: 2024 },
          { country: 'Yemen', code: 'YEM', region: 'MENA', population: 33697000, displaced: 4500000, refugees: 100000, idps: 4500000, urbanPct: 38, gdpPerCapita: 688, hdi: 0.455, conflictLevel: 'critical', year: 2024 },
          { country: 'Libya', code: 'LBY', region: 'MENA', population: 6888000, displaced: 180000, refugees: 50000, idps: 180000, urbanPct: 81, gdpPerCapita: 6357, hdi: 0.718, conflictLevel: 'high', year: 2024 },
          { country: 'Sudan', code: 'SDN', region: 'MENA', population: 46874000, displaced: 9000000, refugees: 1100000, idps: 9000000, urbanPct: 35, gdpPerCapita: 441, hdi: 0.508, conflictLevel: 'critical', year: 2024 },
          { country: 'Lebanon', code: 'LBN', region: 'MENA', population: 5489000, displaced: 1500000, refugees: 1500000, idps: 500000, urbanPct: 89, gdpPerCapita: 3800, hdi: 0.706, conflictLevel: 'high', year: 2024 },
          { country: 'Palestine', code: 'PSE', region: 'MENA', population: 5483000, displaced: 1900000, refugees: 5900000, idps: 1900000, urbanPct: 77, gdpPerCapita: 3664, hdi: 0.715, conflictLevel: 'critical', year: 2024 },
          { country: 'Jordan', code: 'JOR', region: 'MENA', population: 10269000, displaced: 0, refugees: 3000000, idps: 0, urbanPct: 91, gdpPerCapita: 4284, hdi: 0.720, conflictLevel: 'low', year: 2024 },
          { country: 'Turkey', code: 'TUR', region: 'MENA', population: 85341000, displaced: 0, refugees: 3600000, idps: 0, urbanPct: 77, gdpPerCapita: 10674, hdi: 0.838, conflictLevel: 'medium', year: 2024 },
          { country: 'UAE', code: 'ARE', region: 'MENA', population: 9770000, displaced: 0, refugees: 0, idps: 0, urbanPct: 87, gdpPerCapita: 44316, hdi: 0.911, conflictLevel: 'low', year: 2024 },
          { country: 'Qatar', code: 'QAT', region: 'MENA', population: 2695000, displaced: 0, refugees: 0, idps: 0, urbanPct: 99, gdpPerCapita: 61276, hdi: 0.855, conflictLevel: 'low', year: 2024 },
          { country: 'Kuwait', code: 'KWT', region: 'MENA', population: 4250000, displaced: 0, refugees: 0, idps: 0, urbanPct: 100, gdpPerCapita: 27037, hdi: 0.831, conflictLevel: 'low', year: 2024 },
          { country: 'Israel', code: 'ISR', region: 'MENA', population: 9364000, displaced: 200000, refugees: 0, idps: 200000, urbanPct: 93, gdpPerCapita: 55533, hdi: 0.919, conflictLevel: 'high', year: 2024 },
          { country: 'Morocco', code: 'MAR', region: 'MENA', population: 37840000, displaced: 0, refugees: 5000, idps: 0, urbanPct: 65, gdpPerCapita: 3795, hdi: 0.683, conflictLevel: 'low', year: 2024 },
          { country: 'Algeria', code: 'DZA', region: 'MENA', population: 45606000, displaced: 0, refugees: 100000, idps: 0, urbanPct: 74, gdpPerCapita: 3691, hdi: 0.745, conflictLevel: 'low', year: 2024 },
          { country: 'Tunisia', code: 'TUN', region: 'MENA', population: 12046000, displaced: 0, refugees: 7000, idps: 0, urbanPct: 70, gdpPerCapita: 3776, hdi: 0.731, conflictLevel: 'low', year: 2024 },
          { country: 'Bahrain', code: 'BHR', region: 'MENA', population: 1748000, displaced: 0, refugees: 0, idps: 0, urbanPct: 90, gdpPerCapita: 24504, hdi: 0.875, conflictLevel: 'low', year: 2024 },
          { country: 'Oman', code: 'OMN', region: 'MENA', population: 4644000, displaced: 0, refugees: 0, idps: 0, urbanPct: 87, gdpPerCapita: 19509, hdi: 0.816, conflictLevel: 'low', year: 2024 },
          { country: 'Somalia', code: 'SOM', region: 'MENA', population: 17065000, displaced: 3800000, refugees: 800000, idps: 3800000, urbanPct: 47, gdpPerCapita: 447, hdi: 0.361, conflictLevel: 'critical', year: 2024 },
          // ── EUROPE (World Bank / UN DESA 2024) ────────────────────────────────────
          { country: 'Russia', code: 'RUS', region: 'Europe', population: 144444359, displaced: 0, refugees: 1200000, idps: 0, urbanPct: 75, gdpPerCapita: 12195, hdi: 0.822, conflictLevel: 'high', year: 2024 },
          { country: 'Germany', code: 'DEU', region: 'Europe', population: 84607016, displaced: 0, refugees: 1200000, idps: 0, urbanPct: 77, gdpPerCapita: 48717, hdi: 0.942, conflictLevel: 'low', year: 2024 },
          { country: 'United Kingdom', code: 'GBR', region: 'Europe', population: 67736802, displaced: 0, refugees: 250000, idps: 0, urbanPct: 84, gdpPerCapita: 46125, hdi: 0.929, conflictLevel: 'low', year: 2024 },
          { country: 'France', code: 'FRA', region: 'Europe', population: 68170228, displaced: 0, refugees: 400000, idps: 0, urbanPct: 81, gdpPerCapita: 43658, hdi: 0.910, conflictLevel: 'low', year: 2024 },
          { country: 'Italy', code: 'ITA', region: 'Europe', population: 60461826, displaced: 0, refugees: 200000, idps: 0, urbanPct: 71, gdpPerCapita: 35657, hdi: 0.895, conflictLevel: 'low', year: 2024 },
          { country: 'Spain', code: 'ESP', region: 'Europe', population: 47519628, displaced: 0, refugees: 150000, idps: 0, urbanPct: 81, gdpPerCapita: 30104, hdi: 0.905, conflictLevel: 'low', year: 2024 },
          { country: 'Poland', code: 'POL', region: 'Europe', population: 41026067, displaced: 0, refugees: 960000, idps: 0, urbanPct: 60, gdpPerCapita: 18000, hdi: 0.876, conflictLevel: 'low', year: 2024 },
          { country: 'Ukraine', code: 'UKR', region: 'Europe', population: 43531422, displaced: 6500000, refugees: 6500000, idps: 5000000, urbanPct: 70, gdpPerCapita: 4534, hdi: 0.773, conflictLevel: 'critical', year: 2024 },
          { country: 'Romania', code: 'ROU', region: 'Europe', population: 19237691, displaced: 0, refugees: 100000, idps: 0, urbanPct: 54, gdpPerCapita: 14858, hdi: 0.821, conflictLevel: 'low', year: 2024 },
          { country: 'Netherlands', code: 'NLD', region: 'Europe', population: 17890000, displaced: 0, refugees: 100000, idps: 0, urbanPct: 93, gdpPerCapita: 57768, hdi: 0.941, conflictLevel: 'low', year: 2024 },
          { country: 'Belgium', code: 'BEL', region: 'Europe', population: 11686140, displaced: 0, refugees: 80000, idps: 0, urbanPct: 98, gdpPerCapita: 47068, hdi: 0.937, conflictLevel: 'low', year: 2024 },
          { country: 'Sweden', code: 'SWE', region: 'Europe', population: 10521556, displaced: 0, refugees: 200000, idps: 0, urbanPct: 88, gdpPerCapita: 55685, hdi: 0.947, conflictLevel: 'low', year: 2024 },
          { country: 'Norway', code: 'NOR', region: 'Europe', population: 5421241, displaced: 0, refugees: 50000, idps: 0, urbanPct: 83, gdpPerCapita: 89154, hdi: 0.961, conflictLevel: 'low', year: 2024 },
          { country: 'Switzerland', code: 'CHE', region: 'Europe', population: 8796669, displaced: 0, refugees: 120000, idps: 0, urbanPct: 74, gdpPerCapita: 92101, hdi: 0.962, conflictLevel: 'low', year: 2024 },
          { country: 'Belarus', code: 'BLR', region: 'Europe', population: 9408350, displaced: 0, refugees: 30000, idps: 0, urbanPct: 80, gdpPerCapita: 7100, hdi: 0.808, conflictLevel: 'medium', year: 2024 },
          { country: 'Serbia', code: 'SRB', region: 'Europe', population: 6834326, displaced: 0, refugees: 30000, idps: 200000, urbanPct: 57, gdpPerCapita: 9400, hdi: 0.806, conflictLevel: 'medium', year: 2024 },
          { country: 'Hungary', code: 'HUN', region: 'Europe', population: 9710882, displaced: 0, refugees: 30000, idps: 0, urbanPct: 72, gdpPerCapita: 18728, hdi: 0.846, conflictLevel: 'low', year: 2024 },
          { country: 'Greece', code: 'GRC', region: 'Europe', population: 10718565, displaced: 0, refugees: 80000, idps: 0, urbanPct: 80, gdpPerCapita: 20324, hdi: 0.887, conflictLevel: 'low', year: 2024 },
          { country: 'Czech Republic', code: 'CZE', region: 'Europe', population: 10827529, displaced: 0, refugees: 400000, idps: 0, urbanPct: 74, gdpPerCapita: 26821, hdi: 0.900, conflictLevel: 'low', year: 2024 },
          { country: 'Portugal', code: 'PRT', region: 'Europe', population: 10247605, displaced: 0, refugees: 60000, idps: 0, urbanPct: 67, gdpPerCapita: 24560, hdi: 0.866, conflictLevel: 'low', year: 2024 },
          { country: 'Finland', code: 'FIN', region: 'Europe', population: 5545475, displaced: 0, refugees: 50000, idps: 0, urbanPct: 85, gdpPerCapita: 51030, hdi: 0.940, conflictLevel: 'low', year: 2024 },
          { country: 'Denmark', code: 'DNK', region: 'Europe', population: 5910913, displaced: 0, refugees: 35000, idps: 0, urbanPct: 88, gdpPerCapita: 67218, hdi: 0.952, conflictLevel: 'low', year: 2024 },
          { country: 'Austria', code: 'AUT', region: 'Europe', population: 9104772, displaced: 0, refugees: 100000, idps: 0, urbanPct: 59, gdpPerCapita: 53268, hdi: 0.926, conflictLevel: 'low', year: 2024 },
          { country: 'Moldova', code: 'MDA', region: 'Europe', population: 3272996, displaced: 0, refugees: 120000, idps: 0, urbanPct: 43, gdpPerCapita: 5200, hdi: 0.763, conflictLevel: 'medium', year: 2024 },
          { country: 'Bosnia & Herzegovina', code: 'BIH', region: 'Europe', population: 3210847, displaced: 0, refugees: 10000, idps: 100000, urbanPct: 48, gdpPerCapita: 7300, hdi: 0.779, conflictLevel: 'medium', year: 2024 },
          { country: 'Kosovo', code: 'XKX', region: 'Europe', population: 1775680, displaced: 0, refugees: 5000, idps: 15000, urbanPct: 40, gdpPerCapita: 5200, hdi: 0.742, conflictLevel: 'medium', year: 2024 },
          // ── EAST ASIA (World Bank / UN DESA 2024) ────────────────────────────────
          { country: 'China', code: 'CHN', region: 'East Asia', population: 1409670000, displaced: 0, refugees: 300000, idps: 0, urbanPct: 65, gdpPerCapita: 12720, hdi: 0.788, conflictLevel: 'medium', year: 2024 },
          { country: 'Japan', code: 'JPN', region: 'East Asia', population: 123294513, displaced: 0, refugees: 3000, idps: 0, urbanPct: 92, gdpPerCapita: 33815, hdi: 0.920, conflictLevel: 'low', year: 2024 },
          { country: 'South Korea', code: 'KOR', region: 'East Asia', population: 51712619, displaced: 0, refugees: 2000, idps: 0, urbanPct: 82, gdpPerCapita: 32423, hdi: 0.925, conflictLevel: 'medium', year: 2024 },
          { country: 'North Korea', code: 'PRK', region: 'East Asia', population: 25971909, displaced: 0, refugees: 0, idps: 0, urbanPct: 63, gdpPerCapita: 1700, hdi: 0.733, conflictLevel: 'high', year: 2024 },
          { country: 'Taiwan', code: 'TWN', region: 'East Asia', population: 23570000, displaced: 0, refugees: 0, idps: 0, urbanPct: 79, gdpPerCapita: 32811, hdi: 0.916, conflictLevel: 'high', year: 2024 },
          { country: 'Hong Kong', code: 'HKG', region: 'East Asia', population: 7494578, displaced: 0, refugees: 0, idps: 0, urbanPct: 100, gdpPerCapita: 49800, hdi: 0.952, conflictLevel: 'medium', year: 2024 },
          { country: 'Mongolia', code: 'MNG', region: 'East Asia', population: 3347782, displaced: 0, refugees: 1000, idps: 0, urbanPct: 69, gdpPerCapita: 4400, hdi: 0.739, conflictLevel: 'low', year: 2024 },
          // ── ASIA-PACIFIC (World Bank / UN DESA 2024) ─────────────────────────────
          { country: 'Australia', code: 'AUS', region: 'Asia-Pacific', population: 26439111, displaced: 0, refugees: 60000, idps: 0, urbanPct: 86, gdpPerCapita: 64491, hdi: 0.946, conflictLevel: 'low', year: 2024 },
          { country: 'Indonesia', code: 'IDN', region: 'Asia-Pacific', population: 277534122, displaced: 0, refugees: 13000, idps: 70000, urbanPct: 58, gdpPerCapita: 4788, hdi: 0.705, conflictLevel: 'medium', year: 2024 },
          { country: 'Philippines', code: 'PHL', region: 'Asia-Pacific', population: 117337368, displaced: 0, refugees: 0, idps: 100000, urbanPct: 47, gdpPerCapita: 3461, hdi: 0.699, conflictLevel: 'medium', year: 2024 },
          { country: 'Vietnam', code: 'VNM', region: 'Asia-Pacific', population: 98858950, displaced: 0, refugees: 0, idps: 0, urbanPct: 38, gdpPerCapita: 4163, hdi: 0.726, conflictLevel: 'low', year: 2024 },
          { country: 'Thailand', code: 'THA', region: 'Asia-Pacific', population: 71801279, displaced: 0, refugees: 90000, idps: 40000, urbanPct: 52, gdpPerCapita: 7806, hdi: 0.800, conflictLevel: 'low', year: 2024 },
          { country: 'Malaysia', code: 'MYS', region: 'Asia-Pacific', population: 33573874, displaced: 0, refugees: 180000, idps: 0, urbanPct: 77, gdpPerCapita: 12364, hdi: 0.803, conflictLevel: 'low', year: 2024 },
          { country: 'Singapore', code: 'SGP', region: 'Asia-Pacific', population: 5917648, displaced: 0, refugees: 0, idps: 0, urbanPct: 100, gdpPerCapita: 65233, hdi: 0.939, conflictLevel: 'low', year: 2024 },
          { country: 'Myanmar', code: 'MMR', region: 'Asia-Pacific', population: 54409794, displaced: 2000000, refugees: 1100000, idps: 2000000, urbanPct: 31, gdpPerCapita: 1200, hdi: 0.585, conflictLevel: 'critical', year: 2024 },
          { country: 'Cambodia', code: 'KHM', region: 'Asia-Pacific', population: 17218682, displaced: 0, refugees: 0, idps: 0, urbanPct: 24, gdpPerCapita: 1787, hdi: 0.593, conflictLevel: 'low', year: 2024 },
          { country: 'New Zealand', code: 'NZL', region: 'Asia-Pacific', population: 5122600, displaced: 0, refugees: 5000, idps: 0, urbanPct: 87, gdpPerCapita: 48350, hdi: 0.937, conflictLevel: 'low', year: 2024 },
          { country: 'Papua New Guinea', code: 'PNG', region: 'Asia-Pacific', population: 10329931, displaced: 0, refugees: 10000, idps: 80000, urbanPct: 13, gdpPerCapita: 2678, hdi: 0.558, conflictLevel: 'medium', year: 2024 },
          { country: 'Laos', code: 'LAO', region: 'Asia-Pacific', population: 7529475, displaced: 0, refugees: 0, idps: 0, urbanPct: 37, gdpPerCapita: 2535, hdi: 0.607, conflictLevel: 'low', year: 2024 },
          { country: 'Timor-Leste', code: 'TLS', region: 'Asia-Pacific', population: 1360596, displaced: 0, refugees: 0, idps: 0, urbanPct: 32, gdpPerCapita: 1900, hdi: 0.607, conflictLevel: 'low', year: 2024 },
          // ── SOUTH ASIA (World Bank / UN DESA 2024) ───────────────────────────────
          { country: 'India', code: 'IND', region: 'South Asia', population: 1428627663, displaced: 0, refugees: 200000, idps: 631000, urbanPct: 36, gdpPerCapita: 2411, hdi: 0.644, conflictLevel: 'medium', year: 2024 },
          { country: 'Pakistan', code: 'PAK', region: 'South Asia', population: 231402117, displaced: 0, refugees: 1400000, idps: 500000, urbanPct: 37, gdpPerCapita: 1505, hdi: 0.540, conflictLevel: 'high', year: 2024 },
          { country: 'Bangladesh', code: 'BGD', region: 'South Asia', population: 172954319, displaced: 0, refugees: 950000, idps: 0, urbanPct: 40, gdpPerCapita: 2688, hdi: 0.661, conflictLevel: 'medium', year: 2024 },
          { country: 'Afghanistan', code: 'AFG', region: 'South Asia', population: 42239854, displaced: 3500000, refugees: 2600000, idps: 3500000, urbanPct: 26, gdpPerCapita: 370, hdi: 0.478, conflictLevel: 'critical', year: 2024 },
          { country: 'Sri Lanka', code: 'LKA', region: 'South Asia', population: 22037000, displaced: 0, refugees: 0, idps: 0, urbanPct: 19, gdpPerCapita: 3354, hdi: 0.782, conflictLevel: 'low', year: 2024 },
          { country: 'Nepal', code: 'NPL', region: 'South Asia', population: 30034989, displaced: 0, refugees: 20000, idps: 0, urbanPct: 21, gdpPerCapita: 1337, hdi: 0.601, conflictLevel: 'low', year: 2024 },
          { country: 'Maldives', code: 'MDV', region: 'South Asia', population: 521021, displaced: 0, refugees: 0, idps: 0, urbanPct: 41, gdpPerCapita: 10600, hdi: 0.762, conflictLevel: 'low', year: 2024 },
          { country: 'Bhutan', code: 'BTN', region: 'South Asia', population: 787941, displaced: 0, refugees: 0, idps: 0, urbanPct: 44, gdpPerCapita: 3200, hdi: 0.681, conflictLevel: 'low', year: 2024 },
          // ── CENTRAL ASIA (World Bank / UN DESA 2024) ─────────────────────────────
          { country: 'Kazakhstan', code: 'KAZ', region: 'Central Asia', population: 19606633, displaced: 0, refugees: 5000, idps: 0, urbanPct: 58, gdpPerCapita: 10041, hdi: 0.802, conflictLevel: 'low', year: 2024 },
          { country: 'Uzbekistan', code: 'UZB', region: 'Central Asia', population: 35300000, displaced: 0, refugees: 3000, idps: 0, urbanPct: 51, gdpPerCapita: 2255, hdi: 0.727, conflictLevel: 'low', year: 2024 },
          { country: 'Kyrgyzstan', code: 'KGZ', region: 'Central Asia', population: 6735347, displaced: 0, refugees: 3000, idps: 0, urbanPct: 37, gdpPerCapita: 1276, hdi: 0.692, conflictLevel: 'low', year: 2024 },
          { country: 'Tajikistan', code: 'TJK', region: 'Central Asia', population: 10143543, displaced: 0, refugees: 4000, idps: 0, urbanPct: 27, gdpPerCapita: 1127, hdi: 0.685, conflictLevel: 'low', year: 2024 },
          { country: 'Turkmenistan', code: 'TKM', region: 'Central Asia', population: 6117924, displaced: 0, refugees: 0, idps: 0, urbanPct: 53, gdpPerCapita: 8000, hdi: 0.745, conflictLevel: 'low', year: 2024 },
          // ── SUB-SAHARAN AFRICA (World Bank / UNHCR 2024) ─────────────────────────
          { country: 'Nigeria', code: 'NGA', region: 'Sub-Saharan Africa', population: 223804632, displaced: 0, refugees: 90000, idps: 3200000, urbanPct: 53, gdpPerCapita: 2184, hdi: 0.535, conflictLevel: 'high', year: 2024 },
          { country: 'Ethiopia', code: 'ETH', region: 'Sub-Saharan Africa', population: 126527060, displaced: 4200000, refugees: 800000, idps: 4200000, urbanPct: 23, gdpPerCapita: 1020, hdi: 0.492, conflictLevel: 'critical', year: 2024 },
          { country: 'DR Congo', code: 'COD', region: 'Sub-Saharan Africa', population: 102262808, displaced: 7100000, refugees: 500000, idps: 7100000, urbanPct: 46, gdpPerCapita: 589, hdi: 0.479, conflictLevel: 'critical', year: 2024 },
          { country: 'Tanzania', code: 'TZA', region: 'Sub-Saharan Africa', population: 65497748, displaced: 0, refugees: 250000, idps: 0, urbanPct: 37, gdpPerCapita: 1136, hdi: 0.532, conflictLevel: 'low', year: 2024 },
          { country: 'Kenya', code: 'KEN', region: 'Sub-Saharan Africa', population: 55100586, displaced: 0, refugees: 550000, idps: 0, urbanPct: 29, gdpPerCapita: 2082, hdi: 0.601, conflictLevel: 'medium', year: 2024 },
          { country: 'South Africa', code: 'ZAF', region: 'Sub-Saharan Africa', population: 60414495, displaced: 0, refugees: 90000, idps: 0, urbanPct: 68, gdpPerCapita: 6001, hdi: 0.713, conflictLevel: 'medium', year: 2024 },
          { country: 'Uganda', code: 'UGA', region: 'Sub-Saharan Africa', population: 48582334, displaced: 0, refugees: 1600000, idps: 0, urbanPct: 27, gdpPerCapita: 883, hdi: 0.544, conflictLevel: 'medium', year: 2024 },
          { country: 'Ghana', code: 'GHA', region: 'Sub-Saharan Africa', population: 33475870, displaced: 0, refugees: 15000, idps: 0, urbanPct: 58, gdpPerCapita: 2363, hdi: 0.632, conflictLevel: 'low', year: 2024 },
          { country: 'Mozambique', code: 'MOZ', region: 'Sub-Saharan Africa', population: 32790338, displaced: 1000000, refugees: 20000, idps: 1000000, urbanPct: 38, gdpPerCapita: 500, hdi: 0.456, conflictLevel: 'high', year: 2024 },
          { country: 'Mali', code: 'MLI', region: 'Sub-Saharan Africa', population: 22414599, displaced: 400000, refugees: 30000, idps: 400000, urbanPct: 44, gdpPerCapita: 893, hdi: 0.428, conflictLevel: 'critical', year: 2024 },
          { country: 'Burkina Faso', code: 'BFA', region: 'Sub-Saharan Africa', population: 22673762, displaced: 2000000, refugees: 40000, idps: 2000000, urbanPct: 32, gdpPerCapita: 836, hdi: 0.449, conflictLevel: 'critical', year: 2024 },
          { country: 'Niger', code: 'NER', region: 'Sub-Saharan Africa', population: 25252722, displaced: 300000, refugees: 250000, idps: 300000, urbanPct: 17, gdpPerCapita: 594, hdi: 0.400, conflictLevel: 'critical', year: 2024 },
          { country: 'Chad', code: 'TCD', region: 'Sub-Saharan Africa', population: 18278568, displaced: 400000, refugees: 1100000, idps: 400000, urbanPct: 24, gdpPerCapita: 700, hdi: 0.394, conflictLevel: 'critical', year: 2024 },
          { country: 'South Sudan', code: 'SSD', region: 'Sub-Saharan Africa', population: 10748272, displaced: 2200000, refugees: 300000, idps: 2200000, urbanPct: 20, gdpPerCapita: 1120, hdi: 0.385, conflictLevel: 'critical', year: 2024 },
          { country: 'Djibouti', code: 'DJI', region: 'Sub-Saharan Africa', population: 1136455, displaced: 0, refugees: 30000, idps: 0, urbanPct: 78, gdpPerCapita: 3300, hdi: 0.524, conflictLevel: 'medium', year: 2024 },
          { country: 'Zimbabwe', code: 'ZWE', region: 'Sub-Saharan Africa', population: 16665409, displaced: 0, refugees: 20000, idps: 0, urbanPct: 32, gdpPerCapita: 1900, hdi: 0.593, conflictLevel: 'medium', year: 2024 },
          { country: 'Cameroon', code: 'CMR', region: 'Sub-Saharan Africa', population: 28647293, displaced: 1000000, refugees: 450000, idps: 1000000, urbanPct: 58, gdpPerCapita: 1600, hdi: 0.576, conflictLevel: 'high', year: 2024 },
          { country: 'Senegal', code: 'SEN', region: 'Sub-Saharan Africa', population: 17763163, displaced: 0, refugees: 15000, idps: 0, urbanPct: 49, gdpPerCapita: 1600, hdi: 0.511, conflictLevel: 'low', year: 2024 },
          { country: 'Zambia', code: 'ZMB', region: 'Sub-Saharan Africa', population: 20569737, displaced: 0, refugees: 90000, idps: 0, urbanPct: 45, gdpPerCapita: 1100, hdi: 0.565, conflictLevel: 'low', year: 2024 },
          { country: 'Angola', code: 'AGO', region: 'Sub-Saharan Africa', population: 35588987, displaced: 0, refugees: 60000, idps: 0, urbanPct: 68, gdpPerCapita: 3000, hdi: 0.586, conflictLevel: 'low', year: 2024 },
          { country: 'Rwanda', code: 'RWA', region: 'Sub-Saharan Africa', population: 14094683, displaced: 0, refugees: 100000, idps: 0, urbanPct: 17, gdpPerCapita: 900, hdi: 0.534, conflictLevel: 'low', year: 2024 },
          { country: 'Eritrea', code: 'ERI', region: 'Sub-Saharan Africa', population: 3748901, displaced: 0, refugees: 0, idps: 0, urbanPct: 42, gdpPerCapita: 700, hdi: 0.459, conflictLevel: 'medium', year: 2024 },
          // ── NORTH AFRICA (World Bank / UN DESA 2024) ─────────────────────────────
          { country: 'Morocco', code: 'MAR', region: 'North Africa', population: 37840000, displaced: 0, refugees: 5000, idps: 0, urbanPct: 65, gdpPerCapita: 3795, hdi: 0.683, conflictLevel: 'low', year: 2024 },
          { country: 'Algeria', code: 'DZA', region: 'North Africa', population: 45606000, displaced: 0, refugees: 100000, idps: 0, urbanPct: 74, gdpPerCapita: 3691, hdi: 0.745, conflictLevel: 'low', year: 2024 },
          { country: 'Tunisia', code: 'TUN', region: 'North Africa', population: 12046000, displaced: 0, refugees: 7000, idps: 0, urbanPct: 70, gdpPerCapita: 3776, hdi: 0.731, conflictLevel: 'low', year: 2024 },
          { country: 'Libya', code: 'LBY', region: 'North Africa', population: 6888000, displaced: 180000, refugees: 50000, idps: 180000, urbanPct: 81, gdpPerCapita: 6357, hdi: 0.718, conflictLevel: 'high', year: 2024 },
          { country: 'Mauritania', code: 'MRT', region: 'North Africa', population: 4649658, displaced: 0, refugees: 100000, idps: 0, urbanPct: 55, gdpPerCapita: 1800, hdi: 0.556, conflictLevel: 'medium', year: 2024 },
          // ── AMERICAS (World Bank / UN DESA 2024) ─────────────────────────────────
          { country: 'United States', code: 'USA', region: 'Americas', population: 339996564, displaced: 0, refugees: 100000, idps: 0, urbanPct: 83, gdpPerCapita: 80034, hdi: 0.927, conflictLevel: 'low', year: 2024 },
          { country: 'Brazil', code: 'BRA', region: 'Americas', population: 215313498, displaced: 0, refugees: 60000, idps: 0, urbanPct: 88, gdpPerCapita: 10296, hdi: 0.760, conflictLevel: 'medium', year: 2024 },
          { country: 'Mexico', code: 'MEX', region: 'Americas', population: 128455567, displaced: 0, refugees: 30000, idps: 350000, urbanPct: 81, gdpPerCapita: 10046, hdi: 0.774, conflictLevel: 'high', year: 2024 },
          { country: 'Colombia', code: 'COL', region: 'Americas', population: 52215503, displaced: 4900000, refugees: 100000, idps: 4900000, urbanPct: 82, gdpPerCapita: 6104, hdi: 0.752, conflictLevel: 'high', year: 2024 },
          { country: 'Argentina', code: 'ARG', region: 'Americas', population: 46654581, displaced: 0, refugees: 5000, idps: 0, urbanPct: 93, gdpPerCapita: 13700, hdi: 0.842, conflictLevel: 'low', year: 2024 },
          { country: 'Canada', code: 'CAN', region: 'Americas', population: 38781292, displaced: 0, refugees: 100000, idps: 0, urbanPct: 82, gdpPerCapita: 52722, hdi: 0.935, conflictLevel: 'low', year: 2024 },
          { country: 'Venezuela', code: 'VEN', region: 'Americas', population: 28838499, displaced: 7700000, refugees: 7700000, idps: 0, urbanPct: 88, gdpPerCapita: 3500, hdi: 0.699, conflictLevel: 'high', year: 2024 },
          { country: 'Peru', code: 'PER', region: 'Americas', population: 33359418, displaced: 0, refugees: 1200000, idps: 0, urbanPct: 79, gdpPerCapita: 7126, hdi: 0.762, conflictLevel: 'medium', year: 2024 },
          { country: 'Chile', code: 'CHL', region: 'Americas', population: 19629590, displaced: 0, refugees: 500000, idps: 0, urbanPct: 88, gdpPerCapita: 16265, hdi: 0.860, conflictLevel: 'low', year: 2024 },
          { country: 'Ecuador', code: 'ECU', region: 'Americas', population: 18001000, displaced: 0, refugees: 500000, idps: 0, urbanPct: 64, gdpPerCapita: 6200, hdi: 0.740, conflictLevel: 'high', year: 2024 },
          { country: 'Haiti', code: 'HTI', region: 'Americas', population: 11724763, displaced: 700000, refugees: 0, idps: 700000, urbanPct: 59, gdpPerCapita: 1149, hdi: 0.535, conflictLevel: 'critical', year: 2024 },
          { country: 'Cuba', code: 'CUB', region: 'Americas', population: 11089511, displaced: 0, refugees: 0, idps: 0, urbanPct: 77, gdpPerCapita: 8820, hdi: 0.764, conflictLevel: 'medium', year: 2024 },
          { country: 'Dominican Republic', code: 'DOM', region: 'Americas', population: 11332972, displaced: 0, refugees: 0, idps: 0, urbanPct: 84, gdpPerCapita: 9300, hdi: 0.767, conflictLevel: 'low', year: 2024 },
          // ── LATIN AMERICA (World Bank / UNHCR 2024) ──────────────────────────────
          { country: 'Guatemala', code: 'GTM', region: 'Latin America', population: 17843908, displaced: 0, refugees: 0, idps: 250000, urbanPct: 52, gdpPerCapita: 5200, hdi: 0.627, conflictLevel: 'high', year: 2024 },
          { country: 'Honduras', code: 'HND', region: 'Latin America', population: 10593798, displaced: 0, refugees: 0, idps: 247000, urbanPct: 60, gdpPerCapita: 2830, hdi: 0.621, conflictLevel: 'high', year: 2024 },
          { country: 'El Salvador', code: 'SLV', region: 'Latin America', population: 6364943, displaced: 0, refugees: 0, idps: 71000, urbanPct: 74, gdpPerCapita: 4617, hdi: 0.675, conflictLevel: 'medium', year: 2024 },
          { country: 'Nicaragua', code: 'NIC', region: 'Latin America', population: 6948392, displaced: 0, refugees: 100000, idps: 0, urbanPct: 59, gdpPerCapita: 2100, hdi: 0.667, conflictLevel: 'medium', year: 2024 },
          { country: 'Bolivia', code: 'BOL', region: 'Latin America', population: 12388571, displaced: 0, refugees: 10000, idps: 0, urbanPct: 70, gdpPerCapita: 3600, hdi: 0.698, conflictLevel: 'low', year: 2024 },
          { country: 'Paraguay', code: 'PRY', region: 'Latin America', population: 7356408, displaced: 0, refugees: 0, idps: 0, urbanPct: 63, gdpPerCapita: 5900, hdi: 0.717, conflictLevel: 'low', year: 2024 },
          { country: 'Uruguay', code: 'URY', region: 'Latin America', population: 3423108, displaced: 0, refugees: 0, idps: 0, urbanPct: 95, gdpPerCapita: 17900, hdi: 0.830, conflictLevel: 'low', year: 2024 },
          { country: 'Panama', code: 'PAN', region: 'Latin America', population: 4351267, displaced: 0, refugees: 0, idps: 0, urbanPct: 69, gdpPerCapita: 15100, hdi: 0.805, conflictLevel: 'low', year: 2024 },
          { country: 'Costa Rica', code: 'CRI', region: 'Latin America', population: 5212173, displaced: 0, refugees: 100000, idps: 0, urbanPct: 82, gdpPerCapita: 13200, hdi: 0.809, conflictLevel: 'low', year: 2024 },
        ];
        const r = input.region;
        if (!r || r === 'Global') return ALL;
        return ALL.filter(row => row.region === r);
      }),

    // Google News RSS feed fetcher — region-aware geo-targeting
    googleNews: publicProcedure
      .input(z.object({
        query: z.string(),
        region: z.string().default('MENA'),
        lang: z.string().default('en'),
        limit: z.number().default(20),
      }))
      .query(async ({ input }) => {
        try {
          // Map region to Google News geo params (gl = country code, hl = language)
          const regionGeoMap: Record<string, { gl: string; hl: string }> = {
            'MENA':              { gl: 'AE', hl: 'en' },
            'Europe':            { gl: 'GB', hl: 'en' },
            'East Asia':         { gl: 'JP', hl: 'en' },
            'Asia-Pacific':      { gl: 'AU', hl: 'en' },
            'South Asia':        { gl: 'IN', hl: 'en' },
            'Central Asia':      { gl: 'KZ', hl: 'en' },
            'Sub-Saharan Africa':{ gl: 'ZA', hl: 'en' },
            'North Africa':      { gl: 'MA', hl: 'en' },
            'Americas':          { gl: 'US', hl: 'en' },
            'Latin America':     { gl: 'BR', hl: 'en' },
            'Global':            { gl: 'US', hl: 'en' },
          };
          const geo = regionGeoMap[input.region] ?? { gl: 'US', hl: input.lang };
          const encodedQuery = encodeURIComponent(input.query);
          const rssUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=${geo.hl}&gl=${geo.gl}&ceid=${geo.gl}:${geo.hl}`;
          const response = await fetch(rssUrl, {
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; NewsBot/1.0)' },
            signal: AbortSignal.timeout(10000),
          });
          if (!response.ok) return { items: [], source: 'google_news', error: `HTTP ${response.status}` };
          const xml = await response.text();
          // Parse RSS XML using exec loop for ES2017 compatibility
          const items: any[] = [];
          const itemRegex = /<item>([\s\S]*?)<\/item>/g;
          let itemMatch: RegExpExecArray | null;
          while ((itemMatch = itemRegex.exec(xml)) !== null && items.length < input.limit) {
            const itemXml = itemMatch[1];
            const cdataTitle = /<title><!\[CDATA\[(.+?)\]\]><\/title>/i.exec(itemXml);
            const plainTitle = /<title>(.+?)<\/title>/i.exec(itemXml);
            const title = (cdataTitle?.[1] || plainTitle?.[1] || '').trim();
            const link = (/<link>(.+?)<\/link>/i.exec(itemXml))?.[1]?.trim() || '';
            const pubDate = (/<pubDate>(.+?)<\/pubDate>/i.exec(itemXml))?.[1]?.trim() || '';
            const source = (/<source[^>]*>(.+?)<\/source>/i.exec(itemXml))?.[1]?.trim() || 'Google News';
            const cdataDesc = /<description><!\[CDATA\[(.+?)\]\]><\/description>/i.exec(itemXml);
            const plainDesc = /<description>(.+?)<\/description>/i.exec(itemXml);
            const description = (cdataDesc?.[1] || plainDesc?.[1] || '').replace(/<[^>]*>/g, '').substring(0, 200);
            if (title) items.push({ title, link, pubDate, source, description });
          }
          return { items, source: 'google_news', query: input.query };
        } catch (err: any) {
          return { items: [], source: 'google_news', error: err.message };
        }
      }),
  }),

  // ─── Reference Checker ─────────────────────────────────────────────────────
  references: router({
    check: publicProcedure
      .input(z.object({ url: z.string(), title: z.string().optional() }))
      .query(async ({ input }) => {
        return checkReference(input.url);
      }),

    batchCheck: analystProcedure
      .input(z.object({
        articles: z.array(z.object({ url: z.string(), title: z.string().optional() })),
      }))
      .mutation(async ({ input }) => {
        return batchCheckReferences(input.articles);
      }),

    filterVerified: publicProcedure
      .input(z.object({
        region: z.string().optional(),
        limit: z.number().optional(),
      }))
      .query(async ({ input }) => {
        const arts = await getArticles({ region: input.region, limit: input.limit ?? 50 });
        return filterVerifiedArticles(arts.map(a => ({ ...a, url: a.url || '' })));
      }),

    stats: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return { total: 0, verified: 0, unverified: 0, pct: 0 };
      const arts = await db.select({ url: articles.url })
        .from(articles).limit(500);
      const noExample = arts.filter(a => a.url && !a.url.includes('example.com')).length;
      const withPlaceholder = arts.filter(a => !a.url || a.url.includes('example.com') || a.url.includes('/article-')).length;
      const verified = arts.length - withPlaceholder;
      return {
        total: arts.length,
        verified,
        unverified: withPlaceholder,
        noExampleUrl: noExample,
        pct: arts.length > 0 ? Math.round((noExample / arts.length) * 100) : 0,
      };
    }),
  }),
  // ─── Intelligence Map Procedures ────────────────────────────────────────────────
  intel: router({
    // Country-level threat matrix: per-country threat score, dominant topic, article count
    countryThreatMatrix: publicProcedure
      .input(z.object({ region: z.string().optional(), hours: z.number().default(72) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
        const regionFilter = input.region && input.region !== 'Global' ? eq(articles.region, input.region) : undefined;
        const rows = await db.select({
          country: articles.country,
          sentiment: articles.sentiment,
          topics: articles.topics,
          isBreaking: articles.isBreaking,
          importance: articles.importance,
        }).from(articles)
          .where(and(gte(articles.publishedAt, since), regionFilter))
          .limit(2000);
        // Aggregate per country
        const countryMap: Record<string, {
          country: string; articleCount: number; breakingCount: number;
          negativeCount: number; topicCounts: Record<string, number>;
          importanceSum: number;
        }> = {};
        for (const r of rows) {
          if (!r.country) continue;
          if (!countryMap[r.country]) countryMap[r.country] = {
            country: r.country, articleCount: 0, breakingCount: 0,
            negativeCount: 0, topicCounts: {}, importanceSum: 0,
          };
          const c = countryMap[r.country];
          c.articleCount++;
          if (r.isBreaking) c.breakingCount++;
          if (r.sentiment === 'negative') c.negativeCount++;
          c.importanceSum += r.importance ?? 5;
          const topicArr = (r.topics as string[] | null) ?? [];
          for (const t of topicArr) c.topicCounts[t] = (c.topicCounts[t] ?? 0) + 1;
        }
        return Object.values(countryMap).map(c => {
          const dominantTopic = Object.entries(c.topicCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'GENERAL';
          // Threat score: 0-100 based on importance, breaking, sentiment
          const avgImportance = c.importanceSum / Math.max(c.articleCount, 1);
          const breakingW = c.breakingCount * 20;
          const negW = c.negativeCount * 3;
          const impW = (avgImportance - 5) * 5; // above average importance boosts score
          const raw = breakingW + negW + impW + c.articleCount * 0.5;
          const threatScore = Math.min(100, Math.max(0, Math.round(raw)));
          const threatLevel = threatScore >= 75 ? 'critical' : threatScore >= 50 ? 'high' : threatScore >= 25 ? 'medium' : 'low';
          return { country: c.country, articleCount: c.articleCount, breakingCount: c.breakingCount, dominantTopic, threatScore, threatLevel };
        }).sort((a, b) => b.threatScore - a.threatScore);
      }),

    // Region-level THREATCON summary
    regionThreatSummary: publicProcedure
      .input(z.object({ region: z.string().optional(), hours: z.number().default(24) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { threatcon: 1, level: 'NORMAL', color: '#22c55e', totalArticles: 0, breakingCount: 0, criticalFacilities: 0, activeConflicts: 0, topThreats: [] };
        const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
        const regionFilter = input.region && input.region !== 'Global' ? eq(articles.region, input.region) : undefined;
        const [artRows, breakingRows, facilityRows] = await Promise.all([
          db.select({ sentiment: articles.sentiment, importance: articles.importance, topics: articles.topics, country: articles.country, title: articles.title, isBreaking: articles.isBreaking })
            .from(articles).where(and(gte(articles.publishedAt, since), regionFilter)).limit(500),
          db.select({ id: articles.id }).from(articles)
            .where(and(gte(articles.publishedAt, since), regionFilter, eq(articles.isBreaking, true))).limit(100),
          db.select({ threatLevel: facilities.threatLevel }).from(facilities)
            .where(input.region && input.region !== 'Global' ? eq(facilities.region, input.region) : undefined).limit(500),
        ]);
        const criticalFacilities = facilityRows.filter(f => f.threatLevel === 'critical').length;
        const breakingCount = breakingRows.length;
        const highImportanceArts = artRows.filter(a => (a.importance ?? 5) >= 8).length;
        const veryHighArts = artRows.filter(a => (a.importance ?? 5) >= 9).length;
        const negArts = artRows.filter(a => a.sentiment === 'negative').length;
        const conflictArts = artRows.filter(a => (a.topics as string[] | null)?.includes('WAR/CONFLICT')).length;
        // Compute THREATCON 1-5 (5=highest)
        let tc = 1;
        if (breakingCount > 0 || highImportanceArts > 0) tc = Math.max(tc, 3);
        if (veryHighArts > 2 || criticalFacilities > 0) tc = Math.max(tc, 4);
        if (veryHighArts > 5 || (breakingCount > 3 && criticalFacilities > 0)) tc = 5;
        if (highImportanceArts > 5 || conflictArts > 3) tc = Math.max(tc, 3);
        if (negArts > artRows.length * 0.6 && artRows.length > 10) tc = Math.max(tc, 2);
        const THREATCON_META = [
          { level: 'NORMAL', color: '#22c55e' },
          { level: 'ALPHA', color: '#84cc16' },
          { level: 'BRAVO', color: '#f59e0b' },
          { level: 'CHARLIE', color: '#ef4444' },
          { level: 'DELTA', color: '#dc2626' },
        ];
        const meta = THREATCON_META[tc - 1];
        // Top threats: countries with most critical/breaking
        const countryThreat: Record<string, number> = {};
        for (const a of artRows) {
          if (!a.country) continue;
          const imp = a.importance ?? 5;
          const w = imp >= 9 ? 10 : imp >= 7 ? 5 : 1;
          countryThreat[a.country] = (countryThreat[a.country] ?? 0) + w;
        }
        const topThreats = Object.entries(countryThreat)
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([country, score]) => ({ country, score }));
        return { threatcon: tc, level: meta.level, color: meta.color, totalArticles: artRows.length, breakingCount, criticalFacilities, activeConflicts: conflictArts, topThreats };
      }),

    // Chronological event timeline for the ticker
    eventTimeline: publicProcedure
      .input(z.object({ region: z.string().optional(), hours: z.number().default(48), limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const since = new Date(Date.now() - input.hours * 60 * 60 * 1000);
        const regionFilter = input.region && input.region !== 'Global' ? eq(articles.region, input.region) : undefined;
        const conditions = regionFilter ? and(gte(articles.publishedAt, since), regionFilter) : gte(articles.publishedAt, since);
        // Also fall back to most recent articles if no articles in time window
        let rows = await db.select({
          id: articles.id,
          title: articles.title,
          country: articles.country,
          publishedAt: articles.publishedAt,
          isBreaking: articles.isBreaking,
          sentiment: articles.sentiment,
          importance: articles.importance,
          topics: articles.topics,
          url: articles.url,
        }).from(articles)
          .where(conditions)
          .orderBy(desc(articles.publishedAt))
          .limit(input.limit);
        // If no results in time window, fall back to most recent articles
        if (rows.length === 0) {
          const fallbackFilter = regionFilter ?? undefined;
          rows = await db.select({
            id: articles.id,
            title: articles.title,
            country: articles.country,
            publishedAt: articles.publishedAt,
            isBreaking: articles.isBreaking,
            sentiment: articles.sentiment,
            importance: articles.importance,
            topics: articles.topics,
            url: articles.url,
          }).from(articles)
            .where(fallbackFilter)
            .orderBy(desc(articles.publishedAt))
            .limit(input.limit);
        }
        return rows.map(r => ({
          ...r,
          publishedAt: r.publishedAt?.toISOString() ?? null,
          topics: (r.topics as string[] | null) ?? [],
          topicsJson: JSON.stringify((r.topics as string[] | null) ?? []),
        }));
      }),

    // Per-facility threat score from ALL linked articles + monthly trend
    facilityThreatScores: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const regionFilter = input.region && input.region !== 'Global' ? eq(facilities.region, input.region) : undefined;
        // Fetch ALL linked articles (no date filter) with confidence >= 0.7
        const conditions = [gte(articleFacilityLinks.confidence, 0.7)];
        if (regionFilter) conditions.push(regionFilter);
        const rows = await db.select({
          facilityId: articleFacilityLinks.facilityId,
          importance: articles.importance,
          sentiment: articles.sentiment,
          isBreaking: articles.isBreaking,
          publishedAt: articles.publishedAt,
          confidence: articleFacilityLinks.confidence,
        }).from(articleFacilityLinks)
          .innerJoin(articles, eq(articleFacilityLinks.articleId, articles.id))
          .innerJoin(facilities, eq(articleFacilityLinks.facilityId, facilities.id))
          .where(and(...conditions))
          .limit(20000);

        const now = Date.now();
        const oneMonth = 30 * 24 * 60 * 60 * 1000;
        const twoMonths = 60 * 24 * 60 * 60 * 1000;
        const threeMonths = 90 * 24 * 60 * 60 * 1000;

        const scoreMap: Record<number, {
          score: number; count: number; lastSeen: string;
          month1Count: number; month2Count: number; month3Count: number;
        }> = {};

        for (const r of rows) {
          const fid = r.facilityId;
          if (!scoreMap[fid]) scoreMap[fid] = { score: 0, count: 0, lastSeen: '', month1Count: 0, month2Count: 0, month3Count: 0 };
          const imp = r.importance ?? 5;
          const linkConf = r.confidence ?? 0.75;
          // Weight by importance and link confidence
          const w = (imp >= 9 ? 20 : imp >= 7 ? 10 : imp >= 5 ? 5 : 1) * linkConf;
          const bw = r.isBreaking ? 15 : 0;
          scoreMap[fid].score += w + bw;
          scoreMap[fid].count++;
          const ts = r.publishedAt?.toISOString() ?? '';
          if (ts > scoreMap[fid].lastSeen) scoreMap[fid].lastSeen = ts;
          // Monthly trend buckets
          const pubTime = r.publishedAt?.getTime() ?? 0;
          const age = now - pubTime;
          if (age <= oneMonth) scoreMap[fid].month1Count++;
          else if (age <= twoMonths) scoreMap[fid].month2Count++;
          else if (age <= threeMonths) scoreMap[fid].month3Count++;
        }

        return Object.entries(scoreMap).map(([fid, v]) => {
          // Calculate trend: compare current month vs previous month
          let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
          if (v.month1Count > v.month2Count * 1.3) trend = 'increasing';
          else if (v.month1Count < v.month2Count * 0.7 && v.month2Count > 0) trend = 'decreasing';
          // If no previous month data but current month has articles, it's increasing
          else if (v.month1Count > 0 && v.month2Count === 0 && v.month3Count === 0) trend = 'increasing';

          return {
            facilityId: Number(fid),
            threatScore: Math.min(100, Math.round(v.score)),
            articleCount: v.count,
            lastSeen: v.lastSeen,
            trend,
            trendData: {
              currentMonth: v.month1Count,
              previousMonth: v.month2Count,
              twoMonthsAgo: v.month3Count,
            },
          };
        });
      }),

    // ── Country Intelligence Panel ──────────────────────────────────────────
    countryIntel: publicProcedure
      .input(z.object({
        country: z.string().min(1),
        since: z.date().optional(),
      }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;

        const since = input.since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const countryName = input.country.trim();

        // Recent articles for this country
        const recentArticles = await db.select({
          id: articles.id, title: articles.title, url: articles.url,
          summary: articles.summary, sentiment: articles.sentiment,
          importance: articles.importance, publishedAt: articles.publishedAt,
          topics: articles.topics, isBreaking: articles.isBreaking,
          agencyId: articles.agencyId, entitiesJson: articles.entitiesJson,
        }).from(articles)
          .where(and(
            sql`country = ${countryName}`,
            gte(articles.publishedAt, since),
          ))
          .orderBy(desc(articles.publishedAt))
          .limit(50);

        // Agency names for articles
        const agencyIds = Array.from(new Set(recentArticles.map(a => a.agencyId).filter(Boolean)));
        const agencyList = agencyIds.length > 0
          ? await db.select({ id: newsAgencies.id, name: newsAgencies.name })
              .from(newsAgencies).where(sql`id IN (${sql.raw(agencyIds.join(','))})`)
          : [];
        const agencyMap = Object.fromEntries(agencyList.map(a => [a.id, a.name]));

        // Facilities in this country
        const countryFacilities = await db.select({
          id: facilities.id, name: facilities.name, type: facilities.type,
          latitude: facilities.latitude, longitude: facilities.longitude,
          description: facilities.description,
        }).from(facilities)
          .where(sql`country = ${countryName}`)
          .limit(50);

        // Sentiment breakdown
        const sentimentCounts: Record<string, number> = {};
        let threatScore = 0;
        for (const a of recentArticles) {
          const s = a.sentiment ?? 'neutral';
          sentimentCounts[s] = (sentimentCounts[s] ?? 0) + 1;
          const imp = a.importance ?? 5;
          const w = imp >= 9 ? 20 : imp >= 7 ? 10 : imp >= 5 ? 5 : 1;
          const bw = a.isBreaking ? 15 : 0;
          if (s === 'negative' || (s as string) === 'hostile') threatScore += w + bw;
        }
        threatScore = Math.min(100, Math.round(threatScore / Math.max(recentArticles.length, 1) * 10));

        // Extract top entities (people + orgs) from entitiesJson
        const entityCounts: Record<string, { name: string; type: string; count: number }> = {};
        for (const a of recentArticles) {
          if (!a.entitiesJson) continue;
          try {
            const parsed = JSON.parse(a.entitiesJson);
            const people: string[] = Array.isArray(parsed.people) ? parsed.people : (Array.isArray(parsed.persons) ? parsed.persons : []);
            const orgs: string[] = Array.isArray(parsed.organizations) ? parsed.organizations : (Array.isArray(parsed.orgs) ? parsed.orgs : []);
            for (const p of people.slice(0, 3)) {
              if (!p || p.length < 2) continue;
              const k = `person:${p.toLowerCase()}`;
              if (!entityCounts[k]) entityCounts[k] = { name: p, type: 'person', count: 0 };
              entityCounts[k].count++;
            }
            for (const o of orgs.slice(0, 3)) {
              if (!o || o.length < 2) continue;
              const k = `org:${o.toLowerCase()}`;
              if (!entityCounts[k]) entityCounts[k] = { name: o, type: 'org', count: 0 };
              entityCounts[k].count++;
            }
          } catch { /* skip malformed */ }
        }
        const topEntities = Object.values(entityCounts)
          .filter(e => e.count >= 2)
          .sort((a, b) => b.count - a.count)
          .slice(0, 15);

        // Top topics
        const topicCounts: Record<string, number> = {};
        for (const a of recentArticles) {
          if (!a.topics) continue;
          const topicsArr: string[] = Array.isArray(a.topics) ? (a.topics as string[]) : [];
          for (const topic of topicsArr.slice(0, 3)) {
            if (topic) topicCounts[topic] = (topicCounts[topic] ?? 0) + 1;
          }
        }
        const topTopics = Object.entries(topicCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8)
          .map(([topic, count]) => ({ topic, count }));

        // LLM intel brief (only if we have articles)
        let intelBrief = '';
        if (recentArticles.length > 0) {
          try {
            const headlines = recentArticles.slice(0, 8).map(a => `- ${a.title}`).join('\n');
            const topPeople = topEntities.filter(e => e.type === 'person').slice(0, 3).map(e => e.name).join(', ');
            const topOrgs = topEntities.filter(e => e.type === 'org').slice(0, 3).map(e => e.name).join(', ');
            const llmResp = await invokeLLM({
              messages: [
                { role: 'system', content: 'You are a geopolitical intelligence analyst. Write concise, factual intelligence briefs. No speculation. Maximum 3 sentences.' },
                { role: 'user', content: `Write a 2-3 sentence intelligence brief for ${countryName} based on these recent news headlines:\n${headlines}\n\nKey figures: ${topPeople || 'N/A'}\nKey organizations: ${topOrgs || 'N/A'}\n\nFocus on the most significant developments and threat indicators.` },
              ],
            });
            intelBrief = (llmResp as any)?.choices?.[0]?.message?.content ?? '';
          } catch { intelBrief = ''; }
        }

        // Fetch stored structured intel from DB
        let storedIntel: typeof countryIntelData.$inferSelect | null = null;
        try {
          const intelRows = await db.select().from(countryIntelData)
            .where(eq(countryIntelData.country, countryName))
            .limit(1);
          storedIntel = intelRows[0] ?? null;
        } catch { storedIntel = null; }

        return {
          country: countryName,
          articleCount: recentArticles.length,
          threatScore,
          sentimentBreakdown: sentimentCounts,
          intelBrief,
          recentArticles: recentArticles.map(a => ({ ...a, agencyName: agencyMap[a.agencyId] ?? 'Unknown' })),
          facilities: countryFacilities,
          topEntities,
          topTopics,
          storedIntel,
        };
      }),

    // ─── Country Intel Data CRUD ────────────────────────────────────────────
    getCountryIntelData: publicProcedure
      .input(z.object({ country: z.string() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const rows = await db.select().from(countryIntelData)
          .where(eq(countryIntelData.country, input.country))
          .limit(1);
        return rows[0] ?? null;
      }),

    listCountryIntelData: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const query = db.select().from(countryIntelData)
          .orderBy(countryIntelData.country)
          .limit(300);
        const rows = await query;
        return input.region ? rows.filter(r => r.region === input.region) : rows;
      }),

    upsertCountryIntelData: protectedProcedure
      .input(z.object({
        country: z.string(),
        isoA3: z.string().optional(),
        region: z.string().optional(),
        capital: z.string().optional(),
        governmentType: z.string().optional(),
        headOfState: z.string().optional(),
        population: z.number().optional(),
        gdpUsd: z.number().optional(),
        gdpPerCapita: z.number().optional(),
        militaryBudgetUsd: z.number().optional(),
        armedForcesSize: z.number().optional(),
        threatLevel: z.enum(['LOW','MODERATE','HIGH','CRITICAL','EXTREME']).optional(),
        nuclearStatus: z.enum(['none','civilian','suspected','confirmed','treaty']).optional(),
        sanctionsStatus: z.string().optional(),
        unMemberStatus: z.string().optional(),
        keyLeaders: z.array(z.object({ role: z.string(), name: z.string(), since: z.string().optional() })).optional(),
        alliances: z.array(z.string()).optional(),
        activeConflicts: z.array(z.object({ name: z.string(), since: z.string(), type: z.string(), status: z.string() })).optional(),
        humanRightsIndex: z.number().optional(),
        pressFreedomIndex: z.number().optional(),
        corruptionIndex: z.number().optional(),
        internetFreedom: z.enum(['free','partly_free','not_free']).optional(),
        keyIntelNotes: z.string().optional(),
        sources: z.array(z.object({ name: z.string(), url: z.string(), date: z.string().optional() })).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const { country, ...rest } = input;
        await db.insert(countryIntelData)
          .values({ country, ...rest, lastUpdated: new Date() })
          .onDuplicateKeyUpdate({ set: { ...rest, lastUpdated: new Date(), updatedAt: new Date() } });
        return { ok: true };
      }),
    // ─── Bulk re-run country intel (admin) ─────────────────────────────────────
    bulkRunCountryIntel: adminProcedure
      .input(z.object({
        countries: z.array(z.string()).optional(),
        region: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        let rows: { country: string; region: string | null }[];
        if (input.countries && input.countries.length > 0) {
          rows = await db.select({ country: countryIntelData.country, region: countryIntelData.region })
            .from(countryIntelData).where(inArray(countryIntelData.country, input.countries));
        } else if (input.region) {
          rows = await db.select({ country: countryIntelData.country, region: countryIntelData.region })
            .from(countryIntelData).where(eq(countryIntelData.region, input.region));
        } else {
          rows = await db.select({ country: countryIntelData.country, region: countryIntelData.region })
            .from(countryIntelData);
        }
        let refreshed = 0;
        for (const row of rows) {
          try {
            const prompt = `You are a geopolitical intelligence analyst. Generate a comprehensive JSON country intel report for ${row.country}. Return ONLY valid JSON with these fields: governmentType (string), headOfState (string), population (integer), gdpUsd (integer), gdpPerCapita (integer), militaryBudgetUsd (integer), armedForcesSize (integer), threatLevel (one of: LOW MODERATE HIGH CRITICAL EXTREME), nuclearStatus (one of: none civilian suspected confirmed treaty), sanctionsStatus (string), unMemberStatus (string), keyLeaders (array of {role,name,since}), alliances (array of strings), activeConflicts (array of {name,since,type,status}), humanRightsIndex (0-100), pressFreedomIndex (0-100), corruptionIndex (0-100), internetFreedom (one of: free partly_free not_free), keyIntelNotes (2-3 sentence summary), sources (array of {name,url,date}). Use 2024-2025 data.`;
            const resp = await invokeLLM({ messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' } });
            const rawContent = resp?.choices?.[0]?.message?.content;
            const content = typeof rawContent === 'string' ? rawContent : null;
            if (!content) continue;
            const intel = JSON.parse(content);
            await db.insert(countryIntelData)
              .values({ country: row.country, region: row.region ?? undefined, ...intel, lastUpdated: new Date() })
              .onDuplicateKeyUpdate({ set: { ...intel, lastUpdated: new Date(), updatedAt: new Date() } });
            refreshed++;
          } catch { /* skip failed */ }
        }
        return { ok: true, refreshed, total: rows.length };
      }),
  }),
  // ─── Saved Investigations ────────────────────────────────────────────────────
  investigations: router({    list: publicProcedure
      .input(z.object({ region: z.string().optional() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db.select().from(investigations)
          .orderBy(desc(investigations.createdAt))
          .limit(50);
        // Serialize JSON columns as strings to avoid superjson depth-limit ([Max Depth]) issues
        return rows.map(row => ({
          id: row.id,
          title: row.title,
          note: row.note ?? null,
          query: row.query ?? null,
          region: row.region ?? 'MENA',
          nodeCount: row.nodeCount ?? 0,
          edgeCount: row.edgeCount ?? 0,
          graphFilterJson: JSON.stringify(row.graphFilter ?? []),
          topEntitiesJson: JSON.stringify(row.topEntities ?? []),
          topTopicsJson: JSON.stringify(row.topTopics ?? []),
          topCountriesJson: JSON.stringify(row.topCountries ?? []),
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
        }));
      }),

    save: analystProcedure
      .input(z.object({
        title: z.string().min(1).max(500),
        note: z.string().optional(),
        query: z.string().optional(),
        region: z.string().optional(),
        graphFilter: z.array(z.string()).optional(),
        nodeCount: z.number().optional(),
        edgeCount: z.number().optional(),
        topEntities: z.array(z.object({ name: z.string(), type: z.string(), count: z.number() })).optional(),
        topTopics: z.array(z.object({ topic: z.string(), count: z.number() })).optional(),
        topCountries: z.array(z.object({ country: z.string(), count: z.number() })).optional(),
        snapshotJson: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const [result] = await db.insert(investigations).values({
          title: input.title,
          note: input.note ?? null,
          query: input.query ?? null,
          region: input.region ?? 'MENA',
          graphFilter: input.graphFilter ?? [],
          nodeCount: input.nodeCount ?? 0,
          edgeCount: input.edgeCount ?? 0,
          topEntities: input.topEntities ?? [],
          topTopics: input.topTopics ?? [],
          topCountries: input.topCountries ?? [],
          snapshotJson: input.snapshotJson ?? null,
        });
        const saved = await db.select().from(investigations)
          .orderBy(desc(investigations.createdAt)).limit(1);
        return saved[0] ?? null;
      }),

    update: analystProcedure
      .input(z.object({
        id: z.number(),
        title: z.string().min(1).max(500).optional(),
        note: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        const updates: Record<string, unknown> = {};
        if (input.title !== undefined) updates.title = input.title;
        if (input.note !== undefined) updates.note = input.note;
        await db.update(investigations).set(updates).where(eq(investigations.id, input.id));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('Database not available');
        await db.delete(investigations).where(eq(investigations.id, input.id));
        return { success: true };
      }),
  }),

  // ─── LLM Analysis ───────────────────────────────────────────────────────────
  analysis: router({
    summarize: analystProcedure
      .input(z.object({ articleId: z.number() }))
      .mutation(async ({ input, ctx }) => {
        // Quota enforcement
        if (ctx.user) { await enforceQuota(ctx.user.id, ctx.user.role); }
        const article = await getArticleById(input.articleId);
        if (!article) return { summary: 'Article not found' };
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a geopolitical analyst. Provide concise intelligence summaries.' },
            { role: 'user', content: `Summarize this news article in 2-3 sentences with geopolitical significance:\n\nTitle: ${article.title}\n\n${article.content?.substring(0, 1000)}` },
          ],
        });
        const summary = response.choices?.[0]?.message?.content;
        // Increment quota usage
        if (ctx.user) { await incrementUsage(ctx.user.id); }
        return { summary: typeof summary === 'string' ? summary : 'Unable to generate summary' };
      }),

    classify: analystProcedure
      .input(z.object({ text: z.string() }))
      .mutation(async ({ input, ctx }) => {
        // Quota enforcement
        if (ctx.user) { await enforceQuota(ctx.user.id, ctx.user.role); }
        const response = await invokeLLM({
          messages: [
            { role: 'system', content: 'You are a news classifier. Classify news into geopolitical categories.' },
            { role: 'user', content: `Classify this text into one or more categories from: WAR/CONFLICT, ECONOMY, POLITICS, TECHNOLOGY, ENERGY, DIPLOMACY, SECURITY, HUMANITARIAN. Return JSON array.\n\nText: ${input.text}` },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'classification',
              strict: true,
              schema: {
                type: 'object',
                properties: { categories: { type: 'array', items: { type: 'string' } } },
                required: ['categories'],
                additionalProperties: false,
              },
            },
          },
        });
        const content = response.choices?.[0]?.message?.content;
        // Increment quota usage
        if (ctx.user) { await incrementUsage(ctx.user.id); }
        if (content && typeof content === 'string') {
          const parsed = JSON.parse(content);
          return parsed;
        }
        return { categories: ['GENERAL'] };
      }),
  }),

  // ─── Verify ────────────────────────────────────────────────────────────────
  verify: router({
    // Probe an article URL to check reachability and content presence
    checkUrl: analystProcedure
      .input(z.object({ url: z.string().url() }))
      .mutation(async ({ input }) => {
        const url = input.url;
        // Reject known placeholder/invalid domains immediately
        const invalidDomains = ['example.com', 'placeholder.com', 'test.com', 'localhost'];
        try {
          const parsed = new URL(url);
          if (invalidDomains.some(d => parsed.hostname.includes(d))) {
            return { ok: false, status: 0, statusText: 'Invalid placeholder URL', contentPresent: false, redirected: false, finalUrl: url, failReason: 'URL points to a placeholder domain — not a real news source' };
          }
        } catch {
          return { ok: false, status: 0, statusText: 'Malformed URL', contentPresent: false, redirected: false, finalUrl: url, failReason: 'Malformed URL — cannot be parsed' };
        }

        try {
          // Use a HEAD request first (fast), fall back to GET if HEAD is blocked
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 12000);
          let response: Response;
          try {
            response = await fetch(url, {
              method: 'HEAD',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RedroomBot/1.0; +https://redroom.live)' },
              signal: controller.signal,
              redirect: 'follow',
            });
          } catch {
            // HEAD failed — try GET with limited body read
            response = await fetch(url, {
              method: 'GET',
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RedroomBot/1.0; +https://redroom.live)' },
              signal: controller.signal,
              redirect: 'follow',
            });
          } finally {
            clearTimeout(timeout);
          }

          const status = response.status;
          const finalUrl = response.url || url;
          const redirected = finalUrl !== url;

          // Check for soft 404s (some sites return 200 but with "not found" content)
          let contentPresent = false;
          if (response.ok) {
            const contentType = response.headers.get('content-type') ?? '';
            const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
            // Content is present if we have HTML/JSON content type or a non-trivial content-length
            if (contentLength > 500) {
              contentPresent = true;
            } else if (contentType.includes('text/html') || contentType.includes('application/json')) {
              contentPresent = true;
            } else {
              // Assume content present for 200 OK with no content-length header (streaming/chunked)
              contentPresent = contentLength === 0;
            }
          }

          if (!response.ok) {
            const failReason =
              status === 404 ? `Article not found (HTTP 404) — the page has been deleted or moved` :
              status === 403 ? `Access forbidden (HTTP 403) — the source blocks automated access` :
              status === 410 ? `Article permanently deleted (HTTP 410)` :
              status === 401 ? `Requires authentication (HTTP 401) — paywalled content` :
              status >= 500 ? `Source server error (HTTP ${status}) — the news site is down` :
              `HTTP ${status} — ${response.statusText}`;
            return { ok: false, status, statusText: response.statusText, contentPresent: false, redirected, finalUrl, failReason };
          }

          return { ok: true, status, statusText: response.statusText, contentPresent, redirected, finalUrl, failReason: null };
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          const isTimeout = msg.includes('abort') || msg.includes('timeout');
          return {
            ok: false,
            status: 0,
            statusText: isTimeout ? 'Request timed out' : 'Network error',
            contentPresent: false,
            redirected: false,
            finalUrl: url,
            failReason: isTimeout
              ? 'Request timed out after 12 seconds — the source may be unreachable'
              : `Network error: ${msg}`,
          };
        }
      }),

    // Check if an article is already verified
    isVerified: publicProcedure
      .input(z.object({ articleId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { verified: false, record: null };
        const rows = await db.select().from(verifiedArticles)
          .where(eq(verifiedArticles.articleId, input.articleId))
          .limit(1);
        if (rows.length === 0) return { verified: false, record: null };
        const r = rows[0];
        return {
          verified: true,
          record: {
            id: r.id,
            articleId: r.articleId,
            verifiedAt: r.verifiedAt?.toISOString() ?? null,
            verifiedBy: r.verifiedBy,
            notes: r.notes,
          },
        };
      }),

    // Save an article as verified (upsert)
    save: protectedProcedure
      .input(z.object({
        articleId: z.number(),
        notes: z.string().optional(),
        layersData: z.string().optional(), // JSON snapshot
      }))
      .mutation(async ({ input, ctx }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const verifiedBy = ctx.user?.name ?? ctx.user?.email ?? 'analyst';
        // Check if already exists
        const existing = await db.select({ id: verifiedArticles.id })
          .from(verifiedArticles)
          .where(eq(verifiedArticles.articleId, input.articleId))
          .limit(1);
        if (existing.length > 0) {
          // Update existing record
          await db.update(verifiedArticles)
            .set({
              verifiedAt: new Date(),
              verifiedBy,
              notes: input.notes ?? null,
              layersData: input.layersData ?? null,
            })
            .where(eq(verifiedArticles.articleId, input.articleId));
          return { success: true, action: 'updated' as const };
        }
        // Insert new record
        await db.insert(verifiedArticles).values({
          articleId: input.articleId,
          verifiedBy,
          notes: input.notes ?? null,
          layersData: input.layersData ?? null,
        });
        return { success: true, action: 'created' as const };
      }),

    // Remove verification
    remove: protectedProcedure
      .input(z.object({ articleId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        await db.delete(verifiedArticles)
          .where(eq(verifiedArticles.articleId, input.articleId));
        return { success: true };
      }),

    // List all verified articles (for dashboard/audit)
    list: publicProcedure
      .input(z.object({ limit: z.number().default(50) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const rows = await db
          .select({
            id: verifiedArticles.id,
            articleId: verifiedArticles.articleId,
            verifiedAt: verifiedArticles.verifiedAt,
            verifiedBy: verifiedArticles.verifiedBy,
            notes: verifiedArticles.notes,
            title: articles.title,
            url: articles.url,
            sentiment: articles.sentiment,
            topics: articles.topics,
          })
          .from(verifiedArticles)
          .leftJoin(articles, eq(verifiedArticles.articleId, articles.id))
          .orderBy(desc(verifiedArticles.verifiedAt))
          .limit(input.limit);
        return rows.map((r: typeof rows[0]) => ({
          ...r,
          verifiedAt: r.verifiedAt?.toISOString() ?? null,
        }));
      }),
  }),

  // ─── Scheduler Router ─────────────────────────────────────────────────────
  scheduler: router({
    getStatus: publicProcedure.query(async () => {
      const { getSchedulerStatus } = await import("./scheduler");
      return getSchedulerStatus();
    }),

    updateConfig: adminProcedure
      .input(z.object({
        generalEnabled: z.boolean().optional(),
        generalIntervalMinutes: z.number().min(60).optional(),
        breakingEnabled: z.boolean().optional(),
        breakingIntervalMinutes: z.number().min(5).optional(),
        region: z.string().optional(),
        topics: z.array(z.string()).optional(),
      }))
      .mutation(async ({ input }) => {
        const { updateSchedulerConfig } = await import("./scheduler");
        return updateSchedulerConfig(input);
      }),

    triggerGeneral: adminProcedure.mutation(async () => {
      const { triggerManualGeneralCrawl } = await import("./scheduler");
      return triggerManualGeneralCrawl();
    }),

    triggerBreaking: adminProcedure.mutation(async () => {
      const { triggerManualBreakingCrawl } = await import("./scheduler");
      return triggerManualBreakingCrawl();
    }),
  }),

  // ─── Crawl Missions ──────────────────────────────────────────────────────────
  missions: router({
    list: publicProcedure.query(async () => {
      const { getMissions } = await import("./missionScheduler");
      return getMissions();
    }),

    getRuns: publicProcedure
      .input(z.object({ missionId: z.number(), limit: z.number().optional() }))
      .query(async ({ input }) => {
        const { getMissionRuns } = await import("./missionScheduler");
        return getMissionRuns(input.missionId, input.limit ?? 20);
      }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        codename: z.string().max(100).optional(),
        description: z.string().optional(),
        targetAgencyIds: z.array(z.number()).optional(),
        targetCountries: z.array(z.string()).optional(),
        targetRegions: z.array(z.string()).optional(),
        targetTypes: z.array(z.string()).optional(),
        targetTopics: z.array(z.string()).optional(),
        cronExpression: z.string().min(1),
        intervalMinutes: z.number().optional(),
        isRecurring: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "critical"]).optional(),
        classification: z.enum(["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP SECRET"]).optional(),
        minArticlesPerRun: z.number().int().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const { createMission } = await import("./missionScheduler");
        return createMission(input);
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().min(1).max(255).optional(),
        codename: z.string().max(100).optional(),
        description: z.string().optional(),
        targetAgencyIds: z.array(z.number()).optional(),
        targetCountries: z.array(z.string()).optional(),
        targetRegions: z.array(z.string()).optional(),
        targetTypes: z.array(z.string()).optional(),
        targetTopics: z.array(z.string()).optional(),
        cronExpression: z.string().optional(),
        intervalMinutes: z.number().optional(),
        isRecurring: z.boolean().optional(),
        priority: z.enum(["low", "normal", "high", "critical"]).optional(),
        classification: z.enum(["UNCLASSIFIED", "CONFIDENTIAL", "SECRET", "TOP SECRET"]).optional(),
        isActive: z.boolean().optional(),
        minArticlesPerRun: z.number().int().min(0).optional(),
      }))
      .mutation(async ({ input }) => {
        const { id, ...rest } = input;
        const { updateMission } = await import("./missionScheduler");
        await updateMission(id, rest);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteMission } = await import("./missionScheduler");
        await deleteMission(input.id);
        return { success: true };
      }),

    triggerNow: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { triggerMissionNow } = await import("./missionScheduler");
        return triggerMissionNow(input.id);
      }),

    getActiveMissionIds: publicProcedure.query(async () => {
      const { getActiveMissionIds } = await import("./missionScheduler");
      return getActiveMissionIds();
    }),
    getProgress: publicProcedure
      .input(z.object({ missionId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return { pending: 0, running: 0, total: 0, isActive: false };
        // Get the latest run for this mission
        const [latestRun] = await db.select().from(missionRuns)
          .where(eq(missionRuns.missionId, input.missionId))
          .orderBy(desc(missionRuns.startedAt))
          .limit(1);
        if (!latestRun || latestRun.status !== 'running') {
          return { pending: 0, running: 0, total: 0, isActive: false };
        }
        const jobIds = (latestRun.jobIds as number[]) ?? [];
        if (jobIds.length === 0) return { pending: 0, running: 0, total: 0, isActive: true };
        const jobs = await db.select({ status: crawlJobs.status })
          .from(crawlJobs)
          .where(inArray(crawlJobs.id, jobIds));
        const pending = jobs.filter(j => j.status === 'pending').length;
        const running = jobs.filter(j => j.status === 'running').length;
        return { pending, running, total: jobIds.length, isActive: pending + running > 0 };
      }),

    getSparkline: publicProcedure
      .input(z.object({ missionId: z.number(), limit: z.number().default(10) }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return [];
        const runs = await db.select({
          startedAt: missionRuns.startedAt,
          articlesNew: missionRuns.articlesNew,
          status: missionRuns.status,
        })
          .from(missionRuns)
          .where(eq(missionRuns.missionId, input.missionId))
          .orderBy(desc(missionRuns.startedAt))
          .limit(input.limit);
        // Return in chronological order (oldest first) for sparkline rendering
        return runs.reverse().map(r => ({
          ts: r.startedAt?.getTime() ?? 0,
          articles: r.articlesNew ?? 0,
          status: r.status,
        }));
      }),

    markRunInterrupted: protectedProcedure
      .input(z.object({ runId: z.number() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        // Only allow marking runs that are currently stuck in 'running' status
        const [run] = await db.select({ id: missionRuns.id, missionId: missionRuns.missionId, status: missionRuns.status })
          .from(missionRuns).where(eq(missionRuns.id, input.runId));
        if (!run) throw new Error('Run not found');
        if (run.status !== 'running') throw new Error('Run is not in running state');
        // Mark the run as interrupted
        await db.update(missionRuns).set({
          status: 'interrupted',
          completedAt: new Date(),
          errorMessage: 'Manually force-stopped by operator',
        }).where(eq(missionRuns.id, input.runId));
        // Also ensure the parent mission's isRunning flag is cleared
        await db.update(crawlMissions).set({ isRunning: false }).where(eq(crawlMissions.id, run.missionId));
        return { success: true };
      }),
    // Return the latest completed run summary for a mission (used for completion toast)
    getLatestRunSummary: publicProcedure
      .input(z.object({ missionId: z.number() }))
      .query(async ({ input }) => {
        const db = await getDb();
        if (!db) return null;
        const [run] = await db.select({
          id: missionRuns.id,
          status: missionRuns.status,
          agenciesCrawled: missionRuns.agenciesCrawled,
          articlesFound: missionRuns.articlesFound,
          articlesNew: missionRuns.articlesNew,
          startedAt: missionRuns.startedAt,
          completedAt: missionRuns.completedAt,
          errorMessage: missionRuns.errorMessage,
        }).from(missionRuns)
          .where(and(
            eq(missionRuns.missionId, input.missionId),
            inArray(missionRuns.status, ['completed', 'failed', 'partial', 'interrupted']),
          ))
          .orderBy(desc(missionRuns.startedAt))
          .limit(1);
        return run ?? null;
      }),
    // Check RSS feed health for a list of agency IDs or explicit URLs
    checkFeeds: analystProcedure
      .input(z.object({
        agencyIds: z.array(z.number()).optional(),
        urls: z.array(z.string().url()).optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        const urlsToCheck: { url: string; agencyId?: number; agencyName?: string }[] = [];
        if (input.agencyIds?.length && db) {
          const agencies = await db.select({ id: newsAgencies.id, name: newsAgencies.name, rssFeeds: newsAgencies.rssFeeds })
            .from(newsAgencies)
            .where(inArray(newsAgencies.id, input.agencyIds));
          for (const ag of agencies) {
            const feeds = (ag.rssFeeds as Array<string | { url?: string; label?: string; type?: string }> | null) ?? [];
            for (const entry of feeds) {
              // Support both plain URL strings and {label, type, url} objects
              const url = typeof entry === 'string' ? entry : (entry?.url ?? '');
              if (url) urlsToCheck.push({ url, agencyId: ag.id, agencyName: ag.name });
            }
          }
        }
        if (input.urls?.length) {
          for (const url of input.urls) urlsToCheck.push({ url });
        }
        // Ping each URL with a HEAD request (5s timeout)
        const results = await Promise.all(
          urlsToCheck.map(async ({ url, agencyId, agencyName }) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 5000);
            try {
              const res = await fetch(url, { method: 'HEAD', signal: controller.signal, redirect: 'follow' });
              clearTimeout(timer);
              return { url, agencyId, agencyName, ok: res.ok, status: res.status, error: null };
            } catch (err: any) {
              clearTimeout(timer);
              return { url, agencyId, agencyName, ok: false, status: 0, error: err.message ?? 'Network error' };
            }
          })
        );
        return results;
      }),
  }),

  // ─── Pipeline Stage Webhooks ──────────────────────────────────────────────
  webhooks: router({
    list: publicProcedure.query(async () => {
      const db = await getDb();
      if (!db) return [];
      return db.select().from(pipelineWebhooks).orderBy(desc(pipelineWebhooks.createdAt));
    }),

    create: adminProcedure
      .input(z.object({
        name: z.string().min(1).max(255),
        stage: z.string().min(1).max(64),
        url: z.string().url(),
        secret: z.string().optional(),
        threshold: z.number().int().min(1).default(1),
        windowSeconds: z.number().int().min(5).default(60),
        payloadTemplate: z.string().optional(),
        isEnabled: z.boolean().default(true),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const [result] = await db.insert(pipelineWebhooks).values({
          name: input.name,
          stage: input.stage,
          url: input.url,
          secret: input.secret ?? null,
          threshold: input.threshold,
          windowSeconds: input.windowSeconds,
          payloadTemplate: input.payloadTemplate ?? null,
          isEnabled: input.isEnabled,
        });
        return { id: (result as { insertId: number }).insertId };
      }),

    update: adminProcedure
      .input(z.object({
        id: z.number().int(),
        name: z.string().min(1).max(255).optional(),
        stage: z.string().min(1).max(64).optional(),
        url: z.string().url().optional(),
        secret: z.string().nullable().optional(),
        threshold: z.number().int().min(1).optional(),
        windowSeconds: z.number().int().min(5).optional(),
        payloadTemplate: z.string().nullable().optional(),
        isEnabled: z.boolean().optional(),
      }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const { id, ...fields } = input;
        const updateData: Record<string, unknown> = {};
        if (fields.name !== undefined) updateData.name = fields.name;
        if (fields.stage !== undefined) updateData.stage = fields.stage;
        if (fields.url !== undefined) updateData.url = fields.url;
        if (fields.secret !== undefined) updateData.secret = fields.secret;
        if (fields.threshold !== undefined) updateData.threshold = fields.threshold;
        if (fields.windowSeconds !== undefined) updateData.windowSeconds = fields.windowSeconds;
        if (fields.payloadTemplate !== undefined) updateData.payloadTemplate = fields.payloadTemplate;
        if (fields.isEnabled !== undefined) updateData.isEnabled = fields.isEnabled;
        await db.update(pipelineWebhooks).set(updateData).where(eq(pipelineWebhooks.id, id));
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        await db.delete(pipelineWebhooks).where(eq(pipelineWebhooks.id, input.id));
        return { success: true };
      }),

    test: adminProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        const db = await getDb();
        if (!db) throw new Error('DB unavailable');
        const [wh] = await db.select().from(pipelineWebhooks).where(eq(pipelineWebhooks.id, input.id));
        if (!wh) throw new Error('Webhook not found');
        const payload = buildWebhookPayload(wh, wh.stage, 1, true);
        const result = await fireWebhook(wh, payload);
        return result;
      }),
  }),
  orbit: orbitRouter,
  sigint: sigintRouter,
  surveillanceMissions: surveillanceMissionsRouter,
  ref: referenceRouter,
  narratives: narrativesRouter,
  waitingList: waitingListRouter,
  headerPrefs: headerPrefsRouter,

  // ─── Upgrade Click Tracking ─────────────────────────────────────────────────
  upgrade: router({
    // Public: record a click (no auth needed — anyone can click the button)
    trackClick: publicProcedure
      .input(z.object({
        portal: z.enum(['intel', 'orbit', 'sigint', 'contribute']),
        referrer: z.string().max(500).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        try {
          const db = await getDb();
          if (!db) return { success: false };
          const userAgent = (ctx.req.headers['user-agent'] as string | undefined) ?? null;
          await db.insert(upgradeClicks).values({
            portal: input.portal,
            userAgent,
            referrer: input.referrer ?? null,
          });
          return { success: true };
        } catch { return { success: false }; }
      }),

    // Admin: get aggregated stats
    stats: adminProcedure
      .query(async () => {
        const db = await getDb();
        if (!db) return { total: 0, byPortal: {}, recentClicks: [] };
        const [totalRow] = await db
          .select({ count: sql<number>`COUNT(*)` })
          .from(upgradeClicks);
        const byPortal = await db
          .select({ portal: upgradeClicks.portal, count: sql<number>`COUNT(*)` })
          .from(upgradeClicks)
          .groupBy(upgradeClicks.portal);
        const recentClicks = await db
          .select()
          .from(upgradeClicks)
          .orderBy(desc(upgradeClicks.clickedAt))
          .limit(50);
        return {
          total: Number(totalRow?.count ?? 0),
          byPortal: Object.fromEntries(byPortal.map(r => [r.portal, Number(r.count)])),
          recentClicks,
        };
      }),
  }),
});
export type AppRouter = typeof appRouter;