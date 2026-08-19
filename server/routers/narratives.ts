import { publicProcedure, protectedProcedure, analystProcedure, adminProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { narratives, narrativeInvestigations } from "../../drizzle/schema";
import { eq, desc, and, like, or } from "drizzle-orm";
import { z } from "zod";
import mysql from "mysql2/promise";
import { generateNarrativesForRegion, checkArticleAgainstNarratives, backfillNarrativeLinks } from "../narrativeEngine";
import { invokeLLM } from "../_core/llm";

// Raw pool for direct SQL (narrative_article_links table not in Drizzle schema yet)
let _pool: mysql.Pool | null = null;
function getPool(): mysql.Pool {
  if (!_pool) _pool = mysql.createPool(process.env.DATABASE_URL!);
  return _pool;
}

export const narrativesRouter = router({
  /** List narratives, optionally filtered by region / category / status */
  list: publicProcedure
    .input(z.object({
      region: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      let q = db.select().from(narratives).$dynamic();

      const conditions = [];
      if (input.region && input.region !== "Global") {
        conditions.push(eq(narratives.region, input.region));
      }
      if (input.category) {
        conditions.push(eq(narratives.category, input.category));
      }
      if (input.status) {
        conditions.push(eq(narratives.status, input.status));
      }
      if (input.search) {
        const term = `%${input.search}%`;
        conditions.push(
          or(
            like(narratives.title, term),
            like(narratives.description, term),
            like(narratives.originCountry, term)
          )
        );
      }

      if (conditions.length > 0) {
        q = q.where(and(...conditions));
      }

      const rows = await q.orderBy(desc(narratives.lastSeen));
      return rows;
    }),

  /** Get a single narrative by id */
  byId: publicProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return null;
      const [row] = await db.select().from(narratives).where(eq(narratives.id, input.id));
      return row ?? null;
    }),

  /**
   * LLM-generate narratives for a region using the scientific corpus analysis method.
   * Clears existing LLM-generated narratives for the region and replaces them.
   * Protected: any logged-in user can trigger a re-fetch.
   */
  generateForRegion: protectedProcedure
    .input(z.object({ region: z.string() }))
    .mutation(async ({ input }) => {
      const { region } = input;
      const pool = getPool();

      // Generate new narratives via LLM engine
      const generated = await generateNarrativesForRegion(region);

      if (!generated.length) {
        return { inserted: 0, message: "Insufficient corpus data to generate narratives for this region. Try crawling more sources first." };
      }

      // Delete existing LLM-generated narratives for this region (keep manual ones)
      if (region === "Global") {
        await pool.execute(`DELETE FROM narratives WHERE llmGenerated = 1`);
      } else {
        await pool.execute(`DELETE FROM narratives WHERE llmGenerated = 1 AND region = ?`, [region]);
      }

      const now = Date.now();
      let inserted = 0;

      for (const n of generated) {
        try {
          await pool.execute(
            `INSERT INTO narratives 
             (title, description, region, category, status, threatLevel, originCountry,
              targetCountries, linkedFacilityIds, linkedAgencyIds, knownAuthors, knownPublishers,
              firstDetected, lastSeen, articleCount, confidence, tags, analystNotes,
              llmGenerated, generatedAt, evidenceKeywords, scientificMethod)
             VALUES (?, ?, ?, ?, 'active', ?, ?, ?, '[]', '[]', ?, ?, NOW(), NOW(), 0, ?, ?, ?, 1, ?, ?, ?)`,
            [
              n.title.slice(0, 499),
              n.description,
              region,
              n.category,
              n.threatLevel,
              n.originCountry,
              JSON.stringify(n.targetCountries),
              JSON.stringify(n.knownAuthors),
              JSON.stringify(n.knownPublishers),
              Math.round(n.confidence) / 100, // store as 0–1
              JSON.stringify(n.tags),
              n.analystNotes,
              now,
              JSON.stringify(n.evidenceKeywords),
              n.scientificMethod,
            ]
          );
          inserted++;
        } catch (err) {
          console.error("[narrativesRouter] Insert error:", err);
        }
      }

      return { inserted, message: `Generated ${inserted} narratives for ${region} using corpus analysis.` };
    }),

  /**
   * Get article evidence links for a narrative
   */
  articleLinks: publicProcedure
    .input(z.object({ narrativeId: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getPool();
      const [rows] = await pool.execute(
        `SELECT nal.*, a.title AS articleTitle, a.url AS articleUrl, a.country AS articleCountry,
                a.publishedAt, ag.name AS agencyName
         FROM narrative_article_links nal
         JOIN articles a ON a.id = nal.articleId
         LEFT JOIN news_agencies ag ON a.agencyId = ag.id
         WHERE nal.narrativeId = ?
         ORDER BY nal.relevanceScore DESC
         LIMIT 30`,
        [input.narrativeId]
      ) as [Array<{
        id: number; narrativeId: number; articleId: number;
        relevanceScore: number; matchedKeywords: string | null;
        matchedEntities: string | null; supportType: string;
        llmReasoning: string | null; addedAt: number;
        articleTitle: string; articleUrl: string;
        articleCountry: string | null; publishedAt: number | null;
        agencyName: string | null;
      }>, unknown];
      return rows;
    }),

  /**
   * Check an article against all active narratives in a region.
   * Returns ranked narrative matches with LLM reasoning.
   * Used by the Verify pipeline post-verification.
   */
  checkArticle: protectedProcedure
    .input(z.object({
      articleId: z.number().int(),
      region: z.string(),
    }))
    .mutation(async ({ input }) => {
      const matches = await checkArticleAgainstNarratives(input.articleId, input.region);

      // Persist the links for future reference
      if (matches.length > 0) {
        const pool = getPool();
        const now = Date.now();
        for (const m of matches) {
          try {
            await pool.execute(
              `INSERT INTO narrative_article_links
               (narrativeId, articleId, relevanceScore, matchedKeywords, matchedEntities, supportType, llmReasoning, addedAt)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)
               ON DUPLICATE KEY UPDATE
                 relevanceScore = VALUES(relevanceScore),
                 matchedKeywords = VALUES(matchedKeywords),
                 matchedEntities = VALUES(matchedEntities),
                 supportType = VALUES(supportType),
                 llmReasoning = VALUES(llmReasoning),
                 addedAt = VALUES(addedAt)`,
              [
                m.narrativeId,
                input.articleId,
                m.relevanceScore,
                JSON.stringify(m.matchedKeywords),
                JSON.stringify(m.matchedEntities),
                m.supportType,
                m.llmReasoning,
                now,
              ]
            );
          } catch (err) {
            console.error("[narrativesRouter] Link insert error:", err);
          }
        }
      }

      return matches;
    }),

  /** Create a narrative (admin only) */
  create: adminProcedure
    .input(z.object({
      title: z.string().min(3),
      description: z.string().min(10),
      region: z.string(),
      category: z.string(),
      status: z.string().default("active"),
      threatLevel: z.string().default("medium"),
      originCountry: z.string().optional(),
      targetCountries: z.array(z.string()).default([]),
      linkedFacilityIds: z.array(z.number()).default([]),
      linkedAgencyIds: z.array(z.number()).default([]),
      knownAuthors: z.array(z.string()).default([]),
      knownPublishers: z.array(z.string()).default([]),
      firstDetected: z.string(),
      lastSeen: z.string(),
      articleCount: z.number().default(0),
      confidence: z.number().min(0).max(1).default(0.5),
      tags: z.array(z.string()).default([]),
      analystNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const [result] = await db.insert(narratives).values({
        ...input,
        firstDetected: new Date(input.firstDetected),
        lastSeen: new Date(input.lastSeen),
      });
      return { id: (result as any).insertId };
    }),

  /** Update a narrative (admin only) */
  update: adminProcedure
    .input(z.object({
      id: z.number().int(),
      title: z.string().min(3).optional(),
      description: z.string().optional(),
      region: z.string().optional(),
      category: z.string().optional(),
      status: z.string().optional(),
      threatLevel: z.string().optional(),
      originCountry: z.string().optional(),
      targetCountries: z.array(z.string()).optional(),
      linkedFacilityIds: z.array(z.number()).optional(),
      linkedAgencyIds: z.array(z.number()).optional(),
      knownAuthors: z.array(z.string()).optional(),
      knownPublishers: z.array(z.string()).optional(),
      articleCount: z.number().optional(),
      confidence: z.number().min(0).max(1).optional(),
      tags: z.array(z.string()).optional(),
      analystNotes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...rest } = input;
      await db.update(narratives).set(rest).where(eq(narratives.id, id));
      return { success: true };
    }),

  /** Delete a narrative (admin only) */
  delete: adminProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(narratives).where(eq(narratives.id, input.id));
      return { success: true };
    }),

  /**
   * Backfill article evidence links for a narrative using the narrative engine.
   * Finds and scores the top matching articles from the corpus and persists them.
   */
  backfillLinks: protectedProcedure
    .input(z.object({ narrativeId: z.number().int() }))
    .mutation(async ({ input }) => {
      const inserted = await backfillNarrativeLinks(input.narrativeId, 15);
      return { inserted, message: `Linked ${inserted} articles to this narrative.` };
    }),

  /**
   * Auto-backfill: called automatically when a narrative detail panel opens.
   * If fewer than 3 links exist, triggers backfill silently then returns all links.
   * Public so unauthenticated users also see evidence.
   */
  autoBackfillLinks: publicProcedure
    .input(z.object({ narrativeId: z.number().int() }))
    .query(async ({ input }) => {
      const pool = getPool();
      // Check existing count
      const [countRows] = await pool.execute(
        `SELECT COUNT(*) as cnt FROM narrative_article_links WHERE narrativeId = ?`,
        [input.narrativeId]
      ) as [Array<{ cnt: number }>, unknown];
      const existingCount = Number(countRows[0]?.cnt ?? 0);
      // If fewer than 3 links, trigger backfill (best effort)
      if (existingCount < 3) {
        try {
          await backfillNarrativeLinks(input.narrativeId, 15);
        } catch {
          // silent
        }
      }
      // Return full article links with article metadata
      const [rows] = await pool.execute(
        `SELECT nal.id, nal.narrativeId, nal.articleId, nal.relevanceScore,
                nal.matchedKeywords, nal.matchedEntities, nal.supportType, nal.llmReasoning, nal.addedAt,
                a.title AS articleTitle, a.url AS articleUrl, a.country AS articleCountry,
                a.publishedAt, a.summary AS articleSummary,
                ag.name AS agencyName
         FROM narrative_article_links nal
         JOIN articles a ON a.id = nal.articleId
         LEFT JOIN news_agencies ag ON a.agencyId = ag.id
         WHERE nal.narrativeId = ?
         ORDER BY nal.relevanceScore DESC
         LIMIT 30`,
        [input.narrativeId]
      ) as [Array<{
        id: number; narrativeId: number; articleId: number;
        relevanceScore: number; matchedKeywords: string | null;
        matchedEntities: string | null; supportType: string;
        llmReasoning: string | null; addedAt: number;
        articleTitle: string; articleUrl: string;
        articleCountry: string | null; publishedAt: number | null;
        articleSummary: string | null; agencyName: string | null;
      }>, unknown];
      return rows;
    }),

  /** Scientific hypothesis investigation (simulation mode) */
  investigateHypothesis: analystProcedure
    .input(z.object({
      narrativeId: z.number().int(),
      hypothesis: z.string().min(5).max(500),
      region: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");

      // Fetch the narrative
      const rows = await db.select().from(narratives).where(eq(narratives.id, input.narrativeId)).limit(1);
      if (!rows.length) throw new Error("Narrative not found");
      const nar = rows[0];

      // Fetch recent linked articles for context
      const pool = getPool();
      const [linkRows] = await pool.query<mysql.RowDataPacket[]>(
        `SELECT nal.support_type, nal.relevance_score, nal.llm_reasoning, nal.matched_keywords,
                a.title, a.content_summary
         FROM narrative_article_links nal
         LEFT JOIN articles a ON a.id = nal.article_id
         WHERE nal.narrative_id = ?
         ORDER BY nal.relevance_score DESC LIMIT 10`,
        [input.narrativeId]
      );

      const articleContext = (linkRows as any[]).map((r: any) => {
        const kws = (() => { try { return JSON.parse(r.matched_keywords || "[]"); } catch { return []; } })();
        return `[${r.support_type?.toUpperCase() ?? "LINK"}] "${r.title}" — ${r.content_summary ?? ""} (keywords: ${kws.join(", ")})`;
      }).join("\n");

      const systemPrompt = `You are a senior intelligence analyst applying the scientific method to investigate narrative hypotheses.
You must evaluate the hypothesis rigorously using available evidence, returning a structured JSON response.
This is a simulation — clearly note uncertainty. Be precise, evidence-based, and analytical.`;

      const userPrompt = `NARRATIVE UNDER INVESTIGATION:
Title: ${nar.title}
Category: ${nar.category}
Origin: ${nar.originCountry ?? "Unknown"}
Description: ${nar.description}
Analyst Notes: ${nar.analystNotes ?? "None"}
Known Authors: ${nar.knownAuthors ?? "Unknown"}
Known Publishers: ${nar.knownPublishers ?? "Unknown"}
Target Countries: ${nar.targetCountries ?? "Unknown"}
Threat Level: ${nar.threatLevel}
Confidence: ${Math.round((nar.confidence ?? 0.5) * 100)}%

LINKED ARTICLE EVIDENCE:
${articleContext || "No linked articles yet."}

HYPOTHESIS TO INVESTIGATE:
"${input.hypothesis}"

Apply the scientific method:
1. State the hypothesis clearly
2. Gather evidence from the narrative data and linked articles
3. Identify supporting and counter evidence
4. Assess probability (0.0–1.0)
5. Render a verdict: SUPPORTED, REFUTED, or INCONCLUSIVE

Return a JSON object with these exact keys:
- verdict: "SUPPORTED" | "REFUTED" | "INCONCLUSIVE"
- confidence: number (0.0–1.0)
- reasoning: string (2–4 sentences of scientific reasoning)
- supportingEvidence: string[] (3–5 specific evidence points)
- counterEvidence: string[] (2–4 counter-evidence points)
- attributes: object with keys like "state_sponsored", "coordinated", "amplification_method", "primary_target" (values as strings)`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "hypothesis_investigation",
            strict: true,
            schema: {
              type: "object",
              properties: {
                verdict: { type: "string", enum: ["SUPPORTED", "REFUTED", "INCONCLUSIVE"] },
                confidence: { type: "number" },
                reasoning: { type: "string" },
                supportingEvidence: { type: "array", items: { type: "string" } },
                counterEvidence: { type: "array", items: { type: "string" } },
                attributes: { type: "object", additionalProperties: { type: "string" } },
              },
              required: ["verdict", "confidence", "reasoning", "supportingEvidence", "counterEvidence", "attributes"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response?.choices?.[0]?.message?.content;
      if (!content) throw new Error("LLM returned no content");
      const result = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      return result;
    }),

  /** Save an investigation result to the DB — auth required */
  saveInvestigation: analystProcedure
    .input(z.object({
      narrativeId: z.number().int(),
      hypothesis: z.string(),
      verdict: z.enum(["SUPPORTED", "REFUTED", "INCONCLUSIVE"]),
      confidence: z.number(),
      reasoning: z.string().optional(),
      supportingEvidence: z.array(z.string()).optional(),
      counterEvidence: z.array(z.string()).optional(),
      attributes: z.record(z.string(), z.string()).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const user = ctx.user!;
      const pool = getPool();
      await pool.query(
        `INSERT INTO narrative_investigations (narrativeId, hypothesis, verdict, confidence, reasoning, supportingEvidence, counterEvidence, attributes, analystId, analystName)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.narrativeId,
          input.hypothesis,
          input.verdict,
          input.confidence,
          input.reasoning ?? null,
          JSON.stringify(input.supportingEvidence ?? []),
          JSON.stringify(input.counterEvidence ?? []),
          JSON.stringify(input.attributes ?? {}),
          user.openId,
          user.name ?? "Analyst",
        ]
      );
      return { ok: true };
    }),

  /** List saved investigations for a narrative */
  listInvestigations: protectedProcedure
    .input(z.object({ narrativeId: z.number().int() }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) return [];
      return db
        .select()
        .from(narrativeInvestigations)
        .where(eq(narrativeInvestigations.narrativeId, input.narrativeId))
        .orderBy(desc(narrativeInvestigations.createdAt))
        .limit(20);
    }),
});
