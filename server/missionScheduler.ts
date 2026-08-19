/**
 * missionScheduler.ts — Redroom Crawl Mission Scheduler
 *
 * Manages the lifecycle of scheduled crawl missions. Each active mission in the
 * `crawl_missions` table is registered as a node-cron task. The scheduler:
 *
 *   - Loads all active missions from the database on startup.
 *   - Registers a cron job for each mission's `cronExpression`.
 *   - On each cron tick: creates a `mission_runs` record, selects matching
 *     news agencies (filtered by region, topic, source type), runs the crawler
 *     for each agency, and updates the run record with results.
 *   - Supports manual triggers (`triggerMissionNow`) that record the triggering
 *     admin's username in the `mission_runs.triggeredByUser` field.
 *   - Exposes CRUD helpers (`createMission`, `updateMission`, `deleteMission`)
 *     that keep the in-memory task registry in sync with the database.
 *
 * Called by: server/routers/cms.ts (CMS admin procedures)
 * Calls: server/crawler.ts (createJobAndRun)
 *
 * @module missionScheduler
 */
import cron from "node-cron";
import { CronExpressionParser } from "cron-parser";
import { getDb } from "./db";
import { crawlMissions, missionRuns, newsAgencies, crawlJobs } from "../drizzle/schema";
import { eq, and, inArray, or, sum, desc } from "drizzle-orm";
import { createJobAndRun } from "./crawler";
import { notifyOwner } from "./_core/notification";

// ─── In-memory task registry ──────────────────────────────────────────────────
const activeTasks = new Map<number, ReturnType<typeof cron.schedule>>();
const runningMissions = new Set<number>();

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeNextRun(expression: string): Date | null {
  try {
    const expr = CronExpressionParser.parse(expression);
    return expr.next().toDate();
  } catch {
    return null;
  }
}

export function minutesToCronExpr(minutes: number): string {
  if (minutes < 60) return `*/${minutes} * * * *`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `0 */${hours} * * *`;
  return `0 0 * * *`;
}

export function cronExprToMinutes(expr: string): number {
  const parts = expr.trim().split(/\s+/);
  if (parts.length < 5) return 60;
  const [min, hour] = parts;
  if (min.startsWith("*/")) return parseInt(min.slice(2), 10);
  if (hour.startsWith("*/")) return parseInt(hour.slice(2), 10) * 60;
  return 60;
}

// ─── Core execution ───────────────────────────────────────────────────────────
async function executeMission(missionId: number, forceRun = false, triggeredByUser?: string): Promise<void> {
  if (runningMissions.has(missionId)) {
    console.log(`[MissionScheduler] Mission ${missionId} already running, skipping`);
    return;
  }
  runningMissions.add(missionId);

  const db = await getDb();
  if (!db) { runningMissions.delete(missionId); return; }

  // Load mission
  const [mission] = await db.select().from(crawlMissions).where(eq(crawlMissions.id, missionId));
  // forceRun bypasses the isActive guard — used for manual "Execute Now" triggers
  if (!mission || (!mission.isActive && !forceRun)) { runningMissions.delete(missionId); return; }

  // Mark mission as running
  await db.update(crawlMissions).set({ isRunning: true, lastRunAt: new Date() }).where(eq(crawlMissions.id, missionId));

  // Create mission run record
  const [runResult] = await db.insert(missionRuns).values({
    missionId,
    startedAt: new Date(),
    status: "running",
    triggeredBy: triggeredByUser ? "manual" : "scheduled",
    triggeredByUser: triggeredByUser ?? null,
  });
  const runId = (runResult as any).insertId as number;

  console.log(`[MissionScheduler] Executing mission ${missionId} "${mission.name}" — run #${runId}`);

  try {
    // Build agency query based on target selection
    const targetIds = (mission.targetAgencyIds as number[]) ?? [];
    const targetCountries = (mission.targetCountries as string[]) ?? [];
    const targetRegions = (mission.targetRegions as string[]) ?? [];
    const targetTypes = (mission.targetTypes as string[]) ?? [];
    const targetTopics = (mission.targetTopics as string[]) ?? [];

    let agencyQuery = db.select({
      id: newsAgencies.id,
      rssFeeds: newsAgencies.rssFeeds,
      region: newsAgencies.region,
      type: newsAgencies.type,
    }).from(newsAgencies).where(eq(newsAgencies.isActive, true));

    // Apply filters — fetch all active then filter in-memory for flexibility
    let agencies = await agencyQuery;

    if (targetIds.length > 0) {
      agencies = agencies.filter(a => targetIds.includes(a.id));
    } else {
      // Apply country/region/type filters
      if (targetCountries.length > 0 || targetRegions.length > 0 || targetTypes.length > 0) {
        agencies = agencies.filter(a => {
          const matchCountry = targetCountries.length === 0; // will be checked via DB join — skip for now
          const matchRegion = targetRegions.length === 0 || targetRegions.includes(a.region ?? "");
          const matchType = targetTypes.length === 0 || targetTypes.includes(a.type ?? "");
          return matchRegion && matchType;
        });
      }
    }

    const region = targetRegions[0] ?? mission.targetRegions?.[0] ?? "MENA";
    const topics = targetTopics.length > 0 ? targetTopics : [];

    let jobsStarted = 0;
    const jobIds: number[] = [];
    // Track last dispatch time per host to avoid rate-limit bursts
    const hostLastDispatch = new Map<string, number>();

    for (const agency of agencies) {
      const feeds = (agency.rssFeeds as string[] | null) ?? [];
      if (feeds.length === 0) continue;
      try {
        // Stagger requests to the same host by at least 300ms to avoid ECONNRESET
        const firstFeed = feeds[0] ?? '';
        let host = '';
        try { host = new URL(firstFeed).hostname; } catch { host = ''; }
        if (host) {
          const last = hostLastDispatch.get(host) ?? 0;
          const now = Date.now();
          const wait = Math.max(0, last + 300 - now);
          if (wait > 0) await new Promise(r => setTimeout(r, wait));
          hostLastDispatch.set(host, Date.now());
        }
        const jobId = await createJobAndRun(agency.id, region, topics);
        if (jobId) jobIds.push(jobId);
        jobsStarted++;
      } catch (e) {
        console.error(`[MissionScheduler] Error crawling agency ${agency.id}:`, e);
      }
    }

    // Wait for all dispatched crawl jobs to finish (poll until none are pending/running)
    // Cap wait at 10 minutes to avoid hanging forever
    if (jobIds.length > 0) {
      const maxWaitMs = 10 * 60 * 1000;
      const pollIntervalMs = 3000;
      const deadline = Date.now() + maxWaitMs;
      while (Date.now() < deadline) {
        const pendingJobs = await db.select({ id: crawlJobs.id })
          .from(crawlJobs)
          .where(and(
            inArray(crawlJobs.id, jobIds),
            or(eq(crawlJobs.status, 'pending'), eq(crawlJobs.status, 'running'))
          ));
        if (pendingJobs.length === 0) break;
        await new Promise(r => setTimeout(r, pollIntervalMs));
      }
    }

    // Sum up actual articles inserted across all jobs
    let totalArticlesNew = 0;
    if (jobIds.length > 0) {
      const jobStats = await db.select({ articlesNew: crawlJobs.articlesNew })
        .from(crawlJobs)
        .where(inArray(crawlJobs.id, jobIds));
      totalArticlesNew = jobStats.reduce((acc, j) => acc + (j.articlesNew ?? 0), 0);
    }

    // Update mission run as completed
    await db.update(missionRuns).set({
      completedAt: new Date(),
      status: "completed",
      agenciesCrawled: jobsStarted,
      articlesNew: totalArticlesNew,
      jobIds: jobIds,
    }).where(eq(missionRuns.id, runId));

    // Update mission stats
    const nextRun = computeNextRun(mission.cronExpression);
    await db.update(crawlMissions).set({
      isRunning: false,
      totalRuns: (mission.totalRuns ?? 0) + 1,
      totalArticlesCollected: (mission.totalArticlesCollected ?? 0) + totalArticlesNew,
      nextRunAt: nextRun,
      lastRunJobIds: jobIds,
    }).where(eq(crawlMissions.id, missionId));

    console.log(`[MissionScheduler] Mission ${missionId} completed — ${jobsStarted} agencies crawled, ${totalArticlesNew} new articles`);
    // Yield threshold alert: notify owner if articles below configured minimum
    const minThreshold = (mission as any).minArticlesPerRun ?? 0;
    if (minThreshold > 0 && totalArticlesNew < minThreshold) {
      try {
        await notifyOwner({
          title: `⚠️ LOW YIELD ALERT — Mission "${mission.name}"`,
          content: `Mission "${mission.name}"${mission.codename ? ` (${mission.codename})` : ''} completed with only **${totalArticlesNew}** new articles — below the configured threshold of **${minThreshold}**.\n\nThis may indicate that target sources are inactive, blocked, or returning stale content. Please review source health in the GEO MAP and consider updating the mission targets.`,
        });
      } catch (notifyErr) {
        console.warn(`[MissionScheduler] notifyOwner failed for mission ${missionId}:`, notifyErr);
      }
    }

    // Auto-pause: check last N consecutive runs for zero yield
    const AUTO_PAUSE_THRESHOLD = 3;
    try {
      const recentRuns = await db.select({ articlesNew: missionRuns.articlesNew, status: missionRuns.status })
        .from(missionRuns)
        .where(eq(missionRuns.missionId, missionId))
        .orderBy(desc(missionRuns.startedAt))
        .limit(AUTO_PAUSE_THRESHOLD);
      if (
        recentRuns.length >= AUTO_PAUSE_THRESHOLD &&
        recentRuns.every(r => r.status === 'completed' && (r.articlesNew ?? 0) === 0)
      ) {
        // Auto-pause the mission
        await db.update(crawlMissions).set({ isActive: false }).where(eq(crawlMissions.id, missionId));
        unscheduleTask(missionId);
        console.warn(`[MissionScheduler] Auto-paused mission ${missionId} "${mission.name}" — ${AUTO_PAUSE_THRESHOLD} consecutive zero-yield runs`);
        try {
          await notifyOwner({
            title: `🚫 AUTO-PAUSED — Mission "${mission.name}"`,
            content: `Mission "${mission.name}"${mission.codename ? ` (${mission.codename})` : ''} has been **automatically paused** after **${AUTO_PAUSE_THRESHOLD} consecutive runs with 0 new articles**.\n\nThis strongly suggests the target sources are inactive, blocked (403/404), or returning only duplicate content. Please review source health in the GEO MAP and re-activate the mission once the issue is resolved.`,
          });
        } catch (notifyErr) {
          console.warn(`[MissionScheduler] notifyOwner (auto-pause) failed for mission ${missionId}:`, notifyErr);
        }
      }
    } catch (pauseErr) {
      console.warn(`[MissionScheduler] Auto-pause check failed for mission ${missionId}:`, pauseErr);
    }
  } catch (e: any) {
    console.error(`[MissionScheduler] Mission ${missionId} failed:`, e);
    await db.update(missionRuns).set({
      completedAt: new Date(),
      status: "failed",
      errorMessage: e?.message ?? "Unknown error",
    }).where(eq(missionRuns.id, runId));
    await db.update(crawlMissions).set({ isRunning: false }).where(eq(crawlMissions.id, missionId));
  } finally {
    runningMissions.delete(missionId);
  }
}

// ─── Task registry management ─────────────────────────────────────────────────
function scheduleTask(mission: { id: number; cronExpression: string; name: string }): void {
  // Stop existing task if any
  const existing = activeTasks.get(mission.id);
  if (existing) { existing.stop(); activeTasks.delete(mission.id); }

  if (!cron.validate(mission.cronExpression)) {
    console.warn(`[MissionScheduler] Invalid cron expression for mission ${mission.id}: "${mission.cronExpression}"`);
    return;
  }

  const task = cron.schedule(mission.cronExpression, () => executeMission(mission.id));
  activeTasks.set(mission.id, task);
  console.log(`[MissionScheduler] Scheduled mission ${mission.id} "${mission.name}" → ${mission.cronExpression}`);
}

function unscheduleTask(missionId: number): void {
  const task = activeTasks.get(missionId);
  if (task) { task.stop(); activeTasks.delete(missionId); }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export async function initMissionScheduler(): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Clear any stuck isRunning flags left over from a previous server restart
  await db.update(crawlMissions)
    .set({ isRunning: false })
    .where(eq(crawlMissions.isRunning, true));
  // Mark any stuck mission_runs rows as interrupted
  await db.update(missionRuns)
    .set({ status: 'interrupted', completedAt: new Date(), errorMessage: 'Server restart — run interrupted' })
    .where(eq(missionRuns.status, 'running'));
  // Also mark any pending/running crawl_jobs as failed (orphaned by restart)
  await db.update(crawlJobs)
    .set({ status: 'failed', errorMessage: 'Server restart — job interrupted' })
    .where(or(eq(crawlJobs.status, 'pending'), eq(crawlJobs.status, 'running')));

  const missions = await db.select().from(crawlMissions).where(eq(crawlMissions.isActive, true));
  for (const m of missions) {
    if (m.isRecurring && m.cronExpression) {
      scheduleTask({ id: m.id, cronExpression: m.cronExpression, name: m.name });
    }
  }
  console.log(`[MissionScheduler] Initialized — ${missions.length} active missions loaded`);
}

export async function createMission(input: {
  name: string;
  codename?: string;
  description?: string;
  targetAgencyIds?: number[];
  targetCountries?: string[];
  targetRegions?: string[];
  targetTypes?: string[];
  targetTopics?: string[];
  cronExpression: string;
  intervalMinutes?: number;
  isRecurring?: boolean;
  priority?: "low" | "normal" | "high" | "critical";
  classification?: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  minArticlesPerRun?: number;
  createdBy?: string;           // super-admin username
  createdByCredId?: number;     // super_admin_credentials.id
}): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const intervalMinutes = input.intervalMinutes ?? cronExprToMinutes(input.cronExpression);
  const nextRun = computeNextRun(input.cronExpression);

  const [result] = await db.insert(crawlMissions).values({
    name: input.name,
    codename: input.codename,
    description: input.description,
    targetAgencyIds: input.targetAgencyIds ?? [],
    targetCountries: input.targetCountries ?? [],
    targetRegions: input.targetRegions ?? [],
    targetTypes: input.targetTypes ?? [],
    targetTopics: input.targetTopics ?? [],
    cronExpression: input.cronExpression,
    intervalMinutes,
    isRecurring: input.isRecurring ?? true,
    priority: input.priority ?? "normal",
    classification: input.classification ?? "UNCLASSIFIED",
    isActive: true,
    nextRunAt: nextRun,
    minArticlesPerRun: input.minArticlesPerRun ?? 0,
    createdBy: input.createdBy ?? null,
    createdByCredId: input.createdByCredId ?? null,
  });
  const id = (result as any).insertId as number;

  if (input.isRecurring !== false) {
    scheduleTask({ id, cronExpression: input.cronExpression, name: input.name });
  }

  return { id };
}

export async function updateMission(id: number, input: Partial<{
  name: string;
  codename: string;
  description: string;
  targetAgencyIds: number[];
  targetCountries: string[];
  targetRegions: string[];
  targetTypes: string[];
  targetTopics: string[];
  cronExpression: string;
  intervalMinutes: number;
  isRecurring: boolean;
  priority: "low" | "normal" | "high" | "critical";
  classification: "UNCLASSIFIED" | "CONFIDENTIAL" | "SECRET" | "TOP SECRET";
  isActive: boolean;
  minArticlesPerRun: number;
}>): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");

  const updates: Record<string, any> = { ...input };
  if (input.cronExpression) {
    updates.intervalMinutes = input.intervalMinutes ?? cronExprToMinutes(input.cronExpression);
    updates.nextRunAt = computeNextRun(input.cronExpression);
  }

  await db.update(crawlMissions).set(updates).where(eq(crawlMissions.id, id));

  // Re-schedule if cron or active state changed
  const [updated] = await db.select().from(crawlMissions).where(eq(crawlMissions.id, id));
  if (!updated) return;

  unscheduleTask(id);
  if (updated.isActive && updated.isRecurring && updated.cronExpression) {
    scheduleTask({ id, cronExpression: updated.cronExpression, name: updated.name });
  }
}

export async function deleteMission(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  unscheduleTask(id);
  await db.delete(crawlMissions).where(eq(crawlMissions.id, id));
}

export async function triggerMissionNow(id: number, triggeredByUser?: string): Promise<{ started: boolean }> {
  const db = await getDb();
  if (!db) return { started: false };
  const [mission] = await db.select().from(crawlMissions).where(eq(crawlMissions.id, id));
  if (!mission) return { started: false };
  // Clear any stuck isRunning flag so a previously-stuck mission can be re-triggered
  if (mission.isRunning && !runningMissions.has(id)) {
    await db.update(crawlMissions).set({ isRunning: false }).where(eq(crawlMissions.id, id));
  }
  // Fire async — don't await. Pass forceRun=true so manual triggers bypass the isActive guard.
  executeMission(id, true, triggeredByUser).catch(e => console.error(`[MissionScheduler] Trigger error for mission ${id}:`, e));
  return { started: true };
}

export async function getMissions(): Promise<typeof crawlMissions.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(crawlMissions).orderBy(crawlMissions.priority, crawlMissions.createdAt);
}

export async function getMissionRuns(missionId: number, limit = 20): Promise<typeof missionRuns.$inferSelect[]> {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(missionRuns)
    .where(eq(missionRuns.missionId, missionId))
    .orderBy(desc(missionRuns.startedAt))
    .limit(limit);
}

export function getActiveMissionIds(): number[] {
  return Array.from(activeTasks.keys());
}
