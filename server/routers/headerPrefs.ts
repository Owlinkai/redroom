/**
 * headerPrefs router — DB-backed header layout preferences
 * 
 * getPrefs: public procedure that returns the saved prefs for a page (or defaults)
 * savePrefs: protected procedure that upserts the prefs for a page
 */
import { z } from "zod";
import { publicProcedure, protectedProcedure, router } from "../_core/trpc";
import { headerPrefs } from "../../drizzle/schema";
import { getDb } from "../db";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

async function requireDb() {
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  return db;
}

// Default configs — must match the client-side defaults in lib/headerPrefs.ts
const INTEL_DEFAULTS = [
  { id: "datetime", label: "Date / Time", visible: true, order: 0 },
  { id: "articles", label: "Article Stats", visible: true, order: 1 },
  { id: "threatcon", label: "THREATCON Level", visible: true, order: 2 },
  { id: "region", label: "Region Filter", visible: true, order: 3 },
  { id: "globe", label: "Globe Selector", visible: true, order: 4 },
  { id: "crawl", label: "CRAWL Button", visible: true, order: 5 },
  { id: "notifs", label: "Notifications", visible: true, order: 6 },
  { id: "fullscreen", label: "Fullscreen", visible: true, order: 7 },
  { id: "upgrade", label: "Upgrade Button", visible: true, order: 8 },
  { id: "docs", label: "DOCS Link", visible: true, order: 9 },
  { id: "theme", label: "Theme Toggle", visible: true, order: 10 },
];

const ORBIT_DEFAULTS = [
  { id: "satcounts", label: "Satellite Counts", visible: true, order: 0 },
  { id: "tabs", label: "Globe/Surv/Intel/Miss Tabs", visible: true, order: 1 },
  { id: "aoi", label: "AOI Button", visible: true, order: 2 },
  { id: "poly", label: "POLY Button", visible: true, order: 3 },
  { id: "cmp", label: "CMP Button", visible: true, order: 4 },
  { id: "nightmode", label: "Night Mode", visible: true, order: 5 },
  { id: "live", label: "LIVE/PAUSED Toggle", visible: true, order: 6 },
  { id: "upgrade", label: "Upgrade Button", visible: true, order: 7 },
  { id: "docs", label: "DOCS Link", visible: true, order: 8 },
  { id: "fullscreen", label: "Fullscreen", visible: true, order: 9 },
  { id: "theme", label: "Theme Toggle", visible: true, order: 10 },
  { id: "back", label: "← INTEL Back Link", visible: true, order: 11 },
];

const SIGINT_DEFAULTS = [
  { id: "stats", label: "Signal Stats Bar", visible: true, order: 0 },
  { id: "viewmode", label: "Map/Globe Toggle", visible: true, order: 1 },
  { id: "live", label: "LIVE/PAUSED Toggle", visible: true, order: 2 },
  { id: "upgrade", label: "Upgrade Button", visible: true, order: 3 },
  { id: "docs", label: "DOCS Link", visible: true, order: 4 },
  { id: "fullscreen", label: "Fullscreen", visible: true, order: 5 },
  { id: "theme", label: "Theme Toggle", visible: true, order: 6 },
  { id: "back", label: "← INTEL Back Link", visible: true, order: 7 },
];

const PAGE_DEFAULTS: Record<string, unknown[]> = {
  intel: INTEL_DEFAULTS,
  orbit: ORBIT_DEFAULTS,
  sigint: SIGINT_DEFAULTS,
};

export const headerPrefsRouter = router({
  getPrefs: publicProcedure
    .input(z.object({ page: z.enum(["intel", "orbit", "sigint"]) }))
    .query(async ({ input }) => {
      const db = await requireDb();
      const row = await db.select().from(headerPrefs).where(eq(headerPrefs.page, input.page)).limit(1);
      if (row.length > 0) {
        return row[0].prefs as unknown[];
      }
      return PAGE_DEFAULTS[input.page] ?? [];
    }),

  savePrefs: protectedProcedure
    .input(z.object({
      page: z.enum(["intel", "orbit", "sigint"]),
      prefs: z.array(z.any()),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await requireDb();
      // Upsert: insert or update on duplicate page key
      const existing = await db.select({ id: headerPrefs.id }).from(headerPrefs).where(eq(headerPrefs.page, input.page)).limit(1);
      if (existing.length > 0) {
        await db.update(headerPrefs)
          .set({ prefs: input.prefs, updatedBy: ctx.user?.name ?? ctx.user?.openId ?? "unknown" })
          .where(eq(headerPrefs.page, input.page));
      } else {
        await db.insert(headerPrefs).values({
          page: input.page,
          prefs: input.prefs,
          updatedBy: ctx.user?.name ?? ctx.user?.openId ?? "unknown",
        });
      }
      return { success: true };
    }),

  resetPrefs: protectedProcedure
    .input(z.object({ page: z.enum(["intel", "orbit", "sigint"]) }))
    .mutation(async ({ input }) => {
      const db = await requireDb();
      // Delete the row so it falls back to defaults
      await db.delete(headerPrefs).where(eq(headerPrefs.page, input.page));
      return { success: true, defaults: PAGE_DEFAULTS[input.page] ?? [] };
    }),
});
