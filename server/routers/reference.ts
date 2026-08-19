/**
 * Reference Data Router
 * Serves all DB-backed reference tables: regions, countries, topics,
 * google_news_topics, region_hotspots, threat_levels, population_data, un_sources
 *
 * ALL data comes from the database — nothing is hardcoded here.
 */
import { publicProcedure, adminProcedure, router } from "../_core/trpc";
import { z } from "zod";
import { eq, and, asc, desc, or, isNull } from "drizzle-orm";
import {
  regions,
  countries,
  topics,
  googleNewsTopics,
  regionHotspots,
  threatLevels,
  populationData,
  unSources,
} from "../../drizzle/schema";
import { getDb } from "../db";

export const referenceRouter = router({
  // ─── Regions ────────────────────────────────────────────────────────────────
  regions: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(regions).where(eq(regions.isActive, true)).orderBy(asc(regions.sortOrder));
  }),

  regionByName: publicProcedure
    .input(z.object({ name: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [r] = await db.select().from(regions).where(eq(regions.name, input.name));
      return r ?? null;
    }),

  // ─── Countries ───────────────────────────────────────────────────────────────
  countries: publicProcedure
    .input(z.object({ region: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const q = db.select().from(countries).where(eq(countries.isActive, true));
      if (input?.region && input.region !== "Global") {
        return db.select().from(countries)
          .where(and(eq(countries.isActive, true), eq(countries.region, input.region)))
          .orderBy(asc(countries.name));
      }
      return db.select().from(countries).where(eq(countries.isActive, true)).orderBy(asc(countries.name));
    }),

  countriesByRegion: publicProcedure
    .input(z.object({ region: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.region === "Global") {
        return db.select().from(countries).where(eq(countries.isActive, true)).orderBy(asc(countries.region), asc(countries.name));
      }
      return db.select().from(countries)
        .where(and(eq(countries.isActive, true), eq(countries.region, input.region)))
        .orderBy(asc(countries.name));
    }),

  // ─── Topics ──────────────────────────────────────────────────────────────────
  topics: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(topics).where(eq(topics.isActive, true)).orderBy(asc(topics.sortOrder));
  }),

  // ─── Google News Topics ──────────────────────────────────────────────────────
  googleNewsTopics: publicProcedure
    .input(z.object({ region: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      // For Global, return all topics (or just Global-tagged ones)
      if (input.region === "Global") {
        return db.select().from(googleNewsTopics)
          .where(and(eq(googleNewsTopics.isActive, true), eq(googleNewsTopics.region, "Global")))
          .orderBy(asc(googleNewsTopics.sortOrder));
      }
      return db.select().from(googleNewsTopics)
        .where(and(eq(googleNewsTopics.isActive, true), eq(googleNewsTopics.region, input.region)))
        .orderBy(asc(googleNewsTopics.sortOrder));
    }),

  // ─── Region Hotspots ─────────────────────────────────────────────────────────
  hotspots: publicProcedure
    .input(z.object({ region: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input?.region || input.region === "Global") {
        return db.select().from(regionHotspots).where(eq(regionHotspots.isActive, true));
      }
      return db.select().from(regionHotspots)
        .where(and(eq(regionHotspots.isActive, true), eq(regionHotspots.region, input.region)));
    }),

  // ─── Threat Levels ───────────────────────────────────────────────────────────
  threatLevels: publicProcedure.query(async () => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(threatLevels).where(eq(threatLevels.isActive, true)).orderBy(asc(threatLevels.sortOrder));
  }),

  // ─── Population Data ─────────────────────────────────────────────────────────
  populationData: publicProcedure
    .input(z.object({ region: z.string() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (input.region === "Global") {
        return db.select().from(populationData).orderBy(desc(populationData.population));
      }
      return db.select().from(populationData)
        .where(eq(populationData.region, input.region))
        .orderBy(desc(populationData.population));
    }),

  // ─── UN Sources ──────────────────────────────────────────────────────────────
  unSources: publicProcedure
    .input(z.object({ region: z.string().optional() }).optional())
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      if (!input?.region || input.region === "Global") {
        // Return Global sources + region-specific ones for all regions
        return db.select().from(unSources)
          .where(eq(unSources.isActive, true))
          .orderBy(asc(unSources.sortOrder));
      }
      // Return Global sources + this region's sources
      return db.select().from(unSources)
        .where(
          and(
            eq(unSources.isActive, true),
            or(eq(unSources.region, "Global"), eq(unSources.region, input.region))
          )
        )
        .orderBy(asc(unSources.sortOrder));
    }),

  // ─── Admin: Update region threat level ───────────────────────────────────────
  updateRegionThreat: adminProcedure
    .input(z.object({ name: z.string(), threatLevel: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(regions).set({ threatLevel: input.threatLevel }).where(eq(regions.name, input.name));
      return { success: true };
    }),

  // ─── Admin: Upsert hotspot ────────────────────────────────────────────────────
  upsertHotspot: adminProcedure
    .input(z.object({
      id: z.number().optional(),
      region: z.string(),
      name: z.string().optional(),
      lat: z.number(),
      lon: z.number(),
      intensity: z.number().min(0).max(1).optional(),
      threatLevel: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      if (input.id) {
        await db.update(regionHotspots).set({ ...input }).where(eq(regionHotspots.id, input.id));
        return { success: true, id: input.id };
      }
      const [result] = await db.insert(regionHotspots).values({ ...input });
      return { success: true };
    }),

  // ─── Admin: Toggle hotspot ────────────────────────────────────────────────────
  toggleHotspot: adminProcedure
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(regionHotspots).set({ isActive: input.isActive }).where(eq(regionHotspots.id, input.id));
      return { success: true };
    }),
});
