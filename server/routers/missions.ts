import { z } from "zod";
import { router, publicProcedure, adminProcedure, analystProcedure } from "../_core/trpc";
import { getDb } from "../db";
import { surveillanceMissions } from "../../drizzle/schema";
import { eq, desc, and } from "drizzle-orm";

// ─── Missions Router ──────────────────────────────────────────────────────────
export const missionsRouter = router({

  // List all missions
  list: publicProcedure
    .input(z.object({
      status: z.enum(["planning", "active", "paused", "completed", "archived"]).optional(),
      limit: z.number().default(50),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      const conditions = input.status ? [eq(surveillanceMissions.status, input.status)] : [];
      return db
        .select()
        .from(surveillanceMissions)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(surveillanceMissions.updatedAt))
        .limit(input.limit);
    }),

  // Get a single mission by ID
  get: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [mission] = await db
        .select()
        .from(surveillanceMissions)
        .where(eq(surveillanceMissions.id, input.id))
        .limit(1);
      if (!mission) throw new Error("Mission not found");
      return mission;
    }),

  // Create a new mission
  create: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      codename: z.string().max(100).optional(),
      description: z.string().optional(),
      status: z.enum(["planning", "active", "paused", "completed", "archived"]).default("planning"),
      priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
      classification: z.enum(["unclassified", "confidential", "secret", "top_secret"]).default("unclassified"),
      aoiLat: z.number().optional(),
      aoiLon: z.number().optional(),
      aoiRadiusKm: z.number().optional(),
      aoiName: z.string().optional(),
      assignedSatellites: z.array(z.number()).default([]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      objectives: z.string().optional(),
      notes: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(surveillanceMissions).values({
        name: input.name,
        codename: input.codename ?? null,
        description: input.description ?? null,
        status: input.status,
        priority: input.priority,
        classification: input.classification,
        aoiLat: input.aoiLat ?? null,
        aoiLon: input.aoiLon ?? null,
        aoiRadiusKm: input.aoiRadiusKm ?? null,
        aoiName: input.aoiName ?? null,
        assignedSatellites: input.assignedSatellites,
        startDate: input.startDate ? new Date(input.startDate) : null,
        endDate: input.endDate ? new Date(input.endDate) : null,
        objectives: input.objectives ?? null,
        notes: input.notes ?? null,
        tags: input.tags,
      });
      const insertId = (result as any).insertId;
      const [mission] = await db.select().from(surveillanceMissions).where(eq(surveillanceMissions.id, insertId)).limit(1);
      return mission;
    }),

  // Update a mission
  update: publicProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      codename: z.string().max(100).nullable().optional(),
      description: z.string().nullable().optional(),
      status: z.enum(["planning", "active", "paused", "completed", "archived"]).optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      classification: z.enum(["unclassified", "confidential", "secret", "top_secret"]).optional(),
      aoiLat: z.number().nullable().optional(),
      aoiLon: z.number().nullable().optional(),
      aoiRadiusKm: z.number().nullable().optional(),
      aoiName: z.string().nullable().optional(),
      assignedSatellites: z.array(z.number()).optional(),
      startDate: z.string().nullable().optional(),
      endDate: z.string().nullable().optional(),
      objectives: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, startDate, endDate, ...rest } = input;
      const updateData: Record<string, unknown> = { ...rest };
      if (startDate !== undefined) updateData.startDate = startDate ? new Date(startDate) : null;
      if (endDate !== undefined) updateData.endDate = endDate ? new Date(endDate) : null;
      await db.update(surveillanceMissions).set(updateData).where(eq(surveillanceMissions.id, id));
      const [mission] = await db.select().from(surveillanceMissions).where(eq(surveillanceMissions.id, id)).limit(1);
      return mission;
    }),

  // Delete a mission
  delete: adminProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(surveillanceMissions).where(eq(surveillanceMissions.id, input.id));
      return { success: true };
    }),

  // Assign satellites to a mission
  assignSatellites: analystProcedure
    .input(z.object({
      id: z.number(),
      noradIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(surveillanceMissions)
        .set({ assignedSatellites: input.noradIds })
        .where(eq(surveillanceMissions.id, input.id));
      return { success: true, count: input.noradIds.length };
    }),

  // Update mission status
  setStatus: analystProcedure
    .input(z.object({
      id: z.number(),
      status: z.enum(["planning", "active", "paused", "completed", "archived"]),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(surveillanceMissions)
        .set({ status: input.status })
        .where(eq(surveillanceMissions.id, input.id));
      return { success: true };
    }),

  // Increment pass count
  recordPass: analystProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [mission] = await db.select().from(surveillanceMissions).where(eq(surveillanceMissions.id, input.id)).limit(1);
      if (!mission) throw new Error("Mission not found");
      await db.update(surveillanceMissions)
        .set({ passCount: (mission.passCount ?? 0) + 1, lastPassAt: new Date() })
        .where(eq(surveillanceMissions.id, input.id));
      return { success: true };
    }),
});
