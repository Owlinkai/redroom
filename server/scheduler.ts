/**
 * Scheduler — background cron jobs for automated news crawling.
 *
 * Two job types:
 *   - General crawl  : runs every N minutes (default 60) — fetches all active agencies
 *   - Breaking crawl : runs every N minutes (default 5)  — fetches only agencies with
 *                      high-priority / breaking-news RSS feeds
 *
 * Config is stored in-memory (survives hot-reload via module singleton) and can be
 * updated at runtime via the tRPC scheduler.* procedures.
 *
 * Each crawl now creates real crawl_jobs DB rows via createJobAndRun so that
 * the Fetching Monitor shows live progress.
 */
import cron from "node-cron";
import { getDb } from "./db";
import { newsAgencies } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { createJobAndRun } from "./crawler";

// ─── In-memory config ─────────────────────────────────────────────────────────
export interface SchedulerConfig {
  generalEnabled: boolean;
  generalIntervalMinutes: number; // min 60
  breakingEnabled: boolean;
  breakingIntervalMinutes: number; // min 5
  region: string;
  topics: string[];
}

export interface SchedulerStatus {
  config: SchedulerConfig;
  generalNextRun: string | null;
  breakingNextRun: string | null;
  generalLastRun: string | null;
  breakingLastRun: string | null;
  generalRunning: boolean;
  breakingRunning: boolean;
  totalJobsRun: number;
  totalArticlesIngested: number;
}

const DEFAULT_CONFIG: SchedulerConfig = {
  generalEnabled: false,
  generalIntervalMinutes: 60,
  breakingEnabled: false,
  breakingIntervalMinutes: 5,
  region: "MENA",
  topics: [],
};

// Singleton state
let config: SchedulerConfig = { ...DEFAULT_CONFIG };
let generalTask: ReturnType<typeof cron.schedule> | null = null;
let breakingTask: ReturnType<typeof cron.schedule> | null = null;
let generalLastRun: Date | null = null;
let breakingLastRun: Date | null = null;
let generalNextRun: Date | null = null;
let breakingNextRun: Date | null = null;
let generalRunning = false;
let breakingRunning = false;
let totalJobsRun = 0;
let totalArticlesIngested = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function minutesToCron(minutes: number): string {
  if (minutes < 60) return `*/${minutes} * * * *`;
  const hours = Math.floor(minutes / 60);
  return `0 */${hours} * * *`;
}

function computeNextRun(intervalMinutes: number): Date {
  return new Date(Date.now() + intervalMinutes * 60 * 1000);
}

async function runGeneralCrawl() {
  if (generalRunning) return;
  generalRunning = true;
  generalLastRun = new Date();
  generalNextRun = computeNextRun(config.generalIntervalMinutes);
  console.log(`[Scheduler] General crawl started — region: ${config.region}`);
  try {
    const db = await getDb();
    if (!db) return;
    const agencies = await db
      .select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
      .from(newsAgencies)
      .where(and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, config.region)));
    let jobsStarted = 0;
    for (const agency of agencies) {
      const feeds = (agency.rssFeeds as string[] | null) ?? [];
      if (feeds.length === 0) continue;
      // Each agency gets its own job row — fire and forget
      createJobAndRun(agency.id, config.region, config.topics)
        .then(() => { totalJobsRun++; })
        .catch(e => console.error(`[Scheduler] General crawl error for agency ${agency.id}:`, e));
      jobsStarted++;
    }
    totalArticlesIngested += jobsStarted; // approximate — real count is in job rows
    console.log(`[Scheduler] General crawl — ${jobsStarted} jobs started`);
  } catch (e) {
    console.error("[Scheduler] General crawl failed:", e);
  } finally {
    generalRunning = false;
  }
}

async function runBreakingCrawl() {
  if (breakingRunning) return;
  breakingRunning = true;
  breakingLastRun = new Date();
  breakingNextRun = computeNextRun(config.breakingIntervalMinutes);
  console.log(`[Scheduler] Breaking crawl started — region: ${config.region}`);
  try {
    const db = await getDb();
    if (!db) return;
    const agencies = await db
      .select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds, crawlFrequency: newsAgencies.crawlFrequency, type: newsAgencies.type })
      .from(newsAgencies)
      .where(and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, config.region)));
    // Breaking crawl: only high-priority agencies
    const priorityAgencies = agencies.filter(a =>
      (a.crawlFrequency ?? 30) <= 15 || a.type === "wire" || a.type === "international"
    );
    let jobsStarted = 0;
    for (const agency of priorityAgencies) {
      const feeds = (agency.rssFeeds as string[] | null) ?? [];
      if (feeds.length === 0) continue;
      createJobAndRun(agency.id, config.region, ["BREAKING", "SECURITY", "POLITICS"])
        .then(() => { totalJobsRun++; })
        .catch(e => console.error(`[Scheduler] Breaking crawl error for agency ${agency.id}:`, e));
      jobsStarted++;
    }
    console.log(`[Scheduler] Breaking crawl — ${jobsStarted} jobs started`);
  } catch (e) {
    console.error("[Scheduler] Breaking crawl failed:", e);
  } finally {
    breakingRunning = false;
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────
export function getSchedulerStatus(): SchedulerStatus {
  return {
    config: { ...config },
    generalNextRun: generalNextRun?.toISOString() ?? null,
    breakingNextRun: breakingNextRun?.toISOString() ?? null,
    generalLastRun: generalLastRun?.toISOString() ?? null,
    breakingLastRun: breakingLastRun?.toISOString() ?? null,
    generalRunning,
    breakingRunning,
    totalJobsRun,
    totalArticlesIngested,
  };
}

export function updateSchedulerConfig(newConfig: Partial<SchedulerConfig>): SchedulerStatus {
  config = { ...config, ...newConfig };
  if (config.generalIntervalMinutes < 60) config.generalIntervalMinutes = 60;
  if (config.breakingIntervalMinutes < 5) config.breakingIntervalMinutes = 5;

  if (generalTask) { generalTask.stop(); generalTask = null; }
  if (config.generalEnabled) {
    const expr = minutesToCron(config.generalIntervalMinutes);
    generalTask = cron.schedule(expr, runGeneralCrawl);
    generalNextRun = computeNextRun(config.generalIntervalMinutes);
    console.log(`[Scheduler] General crawl scheduled: ${expr}`);
  } else {
    generalNextRun = null;
  }

  if (breakingTask) { breakingTask.stop(); breakingTask = null; }
  if (config.breakingEnabled) {
    const expr = minutesToCron(config.breakingIntervalMinutes);
    breakingTask = cron.schedule(expr, runBreakingCrawl);
    breakingNextRun = computeNextRun(config.breakingIntervalMinutes);
    console.log(`[Scheduler] Breaking crawl scheduled: ${expr}`);
  } else {
    breakingNextRun = null;
  }

  return getSchedulerStatus();
}

export async function triggerManualGeneralCrawl(): Promise<{ articles: number; jobsStarted: number }> {
  const db = await getDb();
  if (!db) return { articles: 0, jobsStarted: 0 };
  const agencies = await db
    .select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds })
    .from(newsAgencies)
    .where(and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, config.region)));
  let jobsStarted = 0;
  for (const agency of agencies) {
    const feeds = (agency.rssFeeds as string[] | null) ?? [];
    if (feeds.length === 0) continue;
    createJobAndRun(agency.id, config.region, config.topics)
      .catch(e => console.error(`[Scheduler] Manual general crawl error for agency ${agency.id}:`, e));
    jobsStarted++;
  }
  totalJobsRun += jobsStarted;
  return { articles: 0, jobsStarted };
}

export async function triggerManualBreakingCrawl(): Promise<{ articles: number; jobsStarted: number }> {
  const db = await getDb();
  if (!db) return { articles: 0, jobsStarted: 0 };
  const agencies = await db
    .select({ id: newsAgencies.id, rssFeeds: newsAgencies.rssFeeds, crawlFrequency: newsAgencies.crawlFrequency, type: newsAgencies.type })
    .from(newsAgencies)
    .where(and(eq(newsAgencies.isActive, true), eq(newsAgencies.region, config.region)));
  const priorityAgencies = agencies.filter(a =>
    (a.crawlFrequency ?? 30) <= 15 || a.type === "wire" || a.type === "international"
  );
  let jobsStarted = 0;
  for (const agency of priorityAgencies) {
    const feeds = (agency.rssFeeds as string[] | null) ?? [];
    if (feeds.length === 0) continue;
    createJobAndRun(agency.id, config.region, ["BREAKING", "SECURITY", "POLITICS"])
      .catch(e => console.error(`[Scheduler] Manual breaking crawl error for agency ${agency.id}:`, e));
    jobsStarted++;
  }
  totalJobsRun += jobsStarted;
  return { articles: 0, jobsStarted };
}
