/**
 * LLM Quota Enforcement Module
 * 
 * Provides checkQuota() and incrementUsage() helpers that can be called
 * before/after any invokeLLM call to enforce per-user daily/monthly limits.
 * 
 * Auto-resets counters when a new day/month begins.
 */

import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { llmQuotas } from "../drizzle/schema";
import { TRPCError } from "@trpc/server";

export interface QuotaCheckResult {
  allowed: boolean;
  dailyRemaining: number;
  monthlyRemaining: number;
  dailyLimit: number;
  monthlyLimit: number;
  usedToday: number;
  usedThisMonth: number;
  resetInfo?: {
    dailyResetsIn: string;
    monthlyResetsIn: string;
  };
}

/**
 * Check if a user is within their LLM quota.
 * If no quota record exists, the user is treated as having NO access (must be assigned quota first).
 * Admin users (role === 'admin') bypass quota checks.
 * 
 * @param userId - The user's database ID
 * @param userRole - The user's role (admin bypasses)
 * @returns QuotaCheckResult with allowed status and remaining counts
 */
export async function checkQuota(userId: number, userRole?: string): Promise<QuotaCheckResult> {
  // Admin/owner bypasses quota
  if (userRole === "admin") {
    return {
      allowed: true,
      dailyRemaining: Infinity,
      monthlyRemaining: Infinity,
      dailyLimit: Infinity,
      monthlyLimit: Infinity,
      usedToday: 0,
      usedThisMonth: 0,
    };
  }

  const db = await getDb();
  if (!db) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  }

  const rows = await db.select().from(llmQuotas).where(eq(llmQuotas.userId, userId)).limit(1);

  if (rows.length === 0) {
    // No quota assigned — deny access
    return {
      allowed: false,
      dailyRemaining: 0,
      monthlyRemaining: 0,
      dailyLimit: 0,
      monthlyLimit: 0,
      usedToday: 0,
      usedThisMonth: 0,
      resetInfo: { dailyResetsIn: "No quota assigned", monthlyResetsIn: "No quota assigned" },
    };
  }

  const quota = rows[0];
  const now = new Date();

  // Auto-reset daily counter if last reset was a different day
  let usedToday = quota.usedToday;
  let usedThisMonth = quota.usedThisMonth;
  let needsUpdate = false;
  const updates: Record<string, unknown> = {};

  const lastDailyReset = new Date(quota.lastDailyReset);
  if (lastDailyReset.toDateString() !== now.toDateString()) {
    usedToday = 0;
    updates.usedToday = 0;
    updates.lastDailyReset = now;
    needsUpdate = true;
  }

  const lastMonthlyReset = new Date(quota.lastMonthlyReset);
  if (lastMonthlyReset.getMonth() !== now.getMonth() || lastMonthlyReset.getFullYear() !== now.getFullYear()) {
    usedThisMonth = 0;
    updates.usedThisMonth = 0;
    updates.lastMonthlyReset = now;
    needsUpdate = true;
  }

  // Apply resets if needed
  if (needsUpdate) {
    await db.update(llmQuotas).set(updates).where(eq(llmQuotas.userId, userId));
  }

  const dailyRemaining = Math.max(0, quota.dailyLimit - usedToday);
  const monthlyRemaining = Math.max(0, quota.monthlyLimit - usedThisMonth);
  const allowed = dailyRemaining > 0 && monthlyRemaining > 0;

  // Calculate reset times
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const dailyResetsIn = formatTimeRemaining(endOfDay.getTime() - now.getTime());

  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthlyResetsIn = formatTimeRemaining(endOfMonth.getTime() - now.getTime());

  return {
    allowed,
    dailyRemaining,
    monthlyRemaining,
    dailyLimit: quota.dailyLimit,
    monthlyLimit: quota.monthlyLimit,
    usedToday,
    usedThisMonth,
    resetInfo: { dailyResetsIn, monthlyResetsIn },
  };
}

/**
 * Increment the user's LLM usage counters after a successful call.
 * @param userId - The user's database ID
 * @param count - Number of calls to increment (default 1)
 */
export async function incrementUsage(userId: number, count: number = 1): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const rows = await db.select().from(llmQuotas).where(eq(llmQuotas.userId, userId)).limit(1);
  if (rows.length === 0) return;

  const quota = rows[0];
  await db.update(llmQuotas).set({
    usedToday: quota.usedToday + count,
    usedThisMonth: quota.usedThisMonth + count,
  }).where(eq(llmQuotas.userId, userId));
}

/**
 * Enforce quota — throws TRPCError if quota exceeded.
 * Use this before any invokeLLM call in protected procedures.
 * 
 * @param userId - The user's database ID
 * @param userRole - The user's role
 * @throws TRPCError with code TOO_MANY_REQUESTS if quota exceeded
 */
export async function enforceQuota(userId: number, userRole?: string): Promise<void> {
  const result = await checkQuota(userId, userRole);
  if (!result.allowed) {
    const reason = result.dailyLimit === 0 && result.monthlyLimit === 0
      ? "No LLM quota assigned. Contact the platform administrator."
      : result.dailyRemaining === 0
        ? `Daily LLM quota exceeded (${result.dailyLimit} calls/day). Resets in ${result.resetInfo?.dailyResetsIn}.`
        : `Monthly LLM quota exceeded (${result.monthlyLimit} calls/month). Resets in ${result.resetInfo?.monthlyResetsIn}.`;

    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: reason,
    });
  }
}

function formatTimeRemaining(ms: number): string {
  if (ms <= 0) return "now";
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 24) {
    const days = Math.floor(hours / 24);
    return `${days}d ${hours % 24}h`;
  }
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}
