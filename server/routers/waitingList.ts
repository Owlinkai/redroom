/**
 * Waiting List Router
 * - submit: public (anyone can join the waiting list)
 * - list / stats / updateStatus / delete: ownerOnly (x-sa-token, same auth as CMS)
 *
 * NOTE: The standard adminProcedure was intentionally NOT used here because the
 * CMS uses a separate super-admin token system (x-sa-token header). Using
 * adminProcedure caused FORBIDDEN errors for all CMS queries.
 */
import { router, publicProcedure } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import mysql from "mysql2/promise";

let _pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!_pool) _pool = mysql.createPool(process.env.DATABASE_URL!);
  return _pool;
}

// Mirrors the ownerOnly middleware in cms.ts — validates x-sa-token header.
const ownerOnly = publicProcedure.use(async ({ ctx, next }) => {
  const token = ctx.req.headers["x-sa-token"] as string | undefined;
  if (!token) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not found" });
  }
  try {
    const payload = JSON.parse(Buffer.from(token, "base64").toString());
    if (!payload.superAdmin || payload.exp < Date.now()) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not found" });
    }
    return next({ ctx });
  } catch {
    throw new TRPCError({ code: "FORBIDDEN", message: "Not found" });
  }
});

export const waitingListRouter = router({
  /** Submit a waiting list request (public) */
  submit: publicProcedure
    .input(z.object({
      name: z.string().min(2).max(255),
      email: z.string().email().max(255),
      company: z.string().max(255).optional(),
      phone: z.string().max(50).optional(),
      role: z.enum(["analyst", "admin"]),
      contribution: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      // Check for duplicate email
      const [existing] = await pool.query<mysql.RowDataPacket[]>(
        "SELECT id FROM waiting_list WHERE email = ? LIMIT 1",
        [input.email]
      );
      if ((existing as any[]).length > 0) {
        return { success: true, duplicate: true };
      }
      await pool.query(
        `INSERT INTO waiting_list (name, email, company, phone, role, contribution)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          input.name,
          input.email,
          input.company ?? null,
          input.phone ?? null,
          input.role,
          input.contribution ?? null,
        ]
      );
      return { success: true, duplicate: false };
    }),

  /** List waiting list entries (owner only) */
  list: ownerOnly
    .input(z.object({
      page: z.number().int().min(1).default(1),
      limit: z.number().int().min(1).max(100).default(20),
      status: z.enum(["all", "pending", "approved", "rejected"]).default("all"),
      role: z.enum(["all", "analyst", "admin"]).default("all"),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const pool = getPool();
      const offset = (input.page - 1) * input.limit;
      const conditions: string[] = [];
      const params: any[] = [];

      if (input.status !== "all") {
        conditions.push("status = ?");
        params.push(input.status);
      }
      if (input.role !== "all") {
        conditions.push("role = ?");
        params.push(input.role);
      }
      if (input.search) {
        conditions.push("(name LIKE ? OR email LIKE ? OR company LIKE ?)");
        const s = `%${input.search}%`;
        params.push(s, s, s);
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

      const [rows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT * FROM waiting_list ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [...params, input.limit, offset]
      );
      const [countRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM waiting_list ${where}`,
        params
      );
      const total = (countRows as any[])[0]?.total ?? 0;

      return {
        items: rows as any[],
        total,
        page: input.page,
        limit: input.limit,
        totalPages: Math.ceil(total / input.limit),
      };
    }),

  /** Update status / notes on a waiting list entry (owner only) */
  updateStatus: ownerOnly
    .input(z.object({
      id: z.number().int(),
      status: z.enum(["pending", "approved", "rejected"]),
      notes: z.string().max(1000).optional(),
    }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query(
        "UPDATE waiting_list SET status = ?, notes = ? WHERE id = ?",
        [input.status, input.notes ?? null, input.id]
      );
      return { success: true };
    }),

  /** Delete a waiting list entry (owner only) */
  delete: ownerOnly
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const pool = getPool();
      await pool.query("DELETE FROM waiting_list WHERE id = ?", [input.id]);
      return { success: true };
    }),

  /** Stats summary (owner only) */
  stats: ownerOnly.query(async () => {
    const pool = getPool();
    const [rows] = await pool.query<mysql.RowDataPacket[]>(
      `SELECT status, COUNT(*) as count FROM waiting_list GROUP BY status`
    );
    const result: { total: number; pending: number; approved: number; rejected: number } = {
      total: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    };
    for (const r of rows as any[]) {
      result[r.status as keyof typeof result] = Number(r.count);
      result.total += Number(r.count);
    }
    return result;
  }),
});
