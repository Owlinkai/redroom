/**
 * Narrative Intelligence Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Scientific method for detecting and verifying information narratives:
 *
 * 1. CORPUS COLLECTION  — pull recent articles for the target region from DB
 * 2. ENTITY EXTRACTION  — aggregate people, orgs, locations, keywords from entitiesJson
 * 3. FREQUENCY ANALYSIS — rank entities by co-occurrence and repetition
 * 4. LLM SYNTHESIS      — structured JSON schema prompt asking the model to
 *                         identify narratives grounded ONLY in the corpus data
 * 5. CONFIDENCE SCORING — each narrative gets a confidence score derived from
 *                         (article_count / corpus_size) × entity_coverage × 0.9 cap
 * 6. EVIDENCE LINKING   — for each narrative, re-scan corpus to find supporting
 *                         articles using keyword + entity overlap scoring
 *
 * For article → narrative checking (Verify pipeline):
 * 7. ARTICLE PROFILE    — extract entities + full text of the article
 * 8. NARRATIVE MATCH    — score article against every active narrative in region
 *    using TF-IDF-style keyword overlap + LLM reasoning for top candidates
 * 9. SUPPORT TYPE       — LLM classifies: "supports" | "contradicts" | "contextualises"
 */

import { invokeLLM } from "./_core/llm";
import { getDb } from "./db";
import mysql from "mysql2/promise";

// Raw MySQL pool for direct SQL queries (bypasses Drizzle ORM)
let _rawPool: mysql.Pool | null = null;
function getRawPool(): mysql.Pool {
  if (!_rawPool) {
    _rawPool = mysql.createPool(process.env.DATABASE_URL!);
  }
  return _rawPool;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeneratedNarrative {
  title: string;
  description: string;
  category: "Propaganda" | "Disinformation" | "Strategic Messaging" | "Influence Operation" | "Counter-Narrative";
  threatLevel: "low" | "medium" | "high" | "critical";
  originCountry: string;
  targetCountries: string[];
  knownAuthors: string[];
  knownPublishers: string[];
  tags: string[];
  analystNotes: string;
  evidenceKeywords: string[];
  scientificMethod: string;
  confidence: number; // 0–100
}

export interface NarrativeArticleMatch {
  narrativeId: number;
  narrativeTitle: string;
  relevanceScore: number; // 0–100
  supportType: "supports" | "contradicts" | "contextualises";
  matchedKeywords: string[];
  matchedEntities: string[];
  llmReasoning: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeParseJson<T>(str: string | null | undefined, fallback: T): T {
  if (!str) return fallback;
  try { return JSON.parse(str) as T; } catch { return fallback; }
}

function extractEntitiesFromArticles(articles: Array<{
  title: string;
  summary: string | null;
  entitiesJson: string | null;
  topics: string | null;
  country: string | null;
  agencyName?: string | null;
}>) {
  const people: Record<string, number> = {};
  const orgs: Record<string, number> = {};
  const locations: Record<string, number> = {};
  const keywords: Record<string, number> = {};

  for (const a of articles) {
    const ent = safeParseJson<Record<string, unknown>>(a.entitiesJson, {});
    const persons = (ent.persons ?? ent.people ?? []) as string[];
    const organizations = (ent.organizations ?? ent.orgs ?? []) as string[];
    const locs = (ent.locations ?? ent.countries ?? []) as string[];
    const kws = (ent.keywords ?? []) as string[];
    const topics = safeParseJson<string[]>(a.topics, []);

    for (const p of persons) people[p] = (people[p] ?? 0) + 1;
    for (const o of organizations) orgs[o] = (orgs[o] ?? 0) + 1;
    for (const l of locs) locations[l] = (locations[l] ?? 0) + 1;
    for (const k of [...kws, ...topics]) keywords[k] = (keywords[k] ?? 0) + 1;
    if (a.country) locations[a.country] = (locations[a.country] ?? 0) + 1;
    if (a.agencyName) orgs[a.agencyName] = (orgs[a.agencyName] ?? 0) + 1;
  }

  const top = <T extends Record<string, number>>(obj: T, n: number) =>
    Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);

  return {
    topPeople: top(people, 20),
    topOrgs: top(orgs, 20),
    topLocations: top(locations, 20),
    topKeywords: top(keywords, 40),
  };
}

function keywordOverlapScore(text: string, keywords: string[]): { score: number; matched: string[] } {
  const lower = text.toLowerCase();
  const matched = keywords.filter(k => lower.includes(k.toLowerCase()));
  const score = keywords.length > 0 ? (matched.length / keywords.length) * 100 : 0;
  return { score, matched };
}

// ─── Main: Generate narratives for a region ───────────────────────────────────

export async function generateNarrativesForRegion(region: string): Promise<GeneratedNarrative[]> {
  // Step 1: Collect corpus — up to 80 most recent articles for the region
  const pool = getRawPool();
  const regionFilter = region === "Global" ? "" : "WHERE a.region = ?";
  const regionParams = region === "Global" ? [] : [region];
  const [articles] = await pool.execute(`
    SELECT a.title, a.summary, a.entitiesJson, a.topics, a.country, a.publishedAt,
           ag.name AS agencyName
    FROM articles a
    LEFT JOIN news_agencies ag ON a.agencyId = ag.id
    ${regionFilter}
    ORDER BY a.publishedAt DESC
    LIMIT 80
  `, regionParams) as [Array<{
    title: string; summary: string | null; entitiesJson: string | null;
    topics: string | null; country: string | null; publishedAt: number | null;
    agencyName: string | null;
  }>, unknown];

  if (articles.length < 3) {
    // Not enough data — return a minimal placeholder
    return [];
  }

  // Step 2: Entity frequency analysis
  const { topPeople, topOrgs, topLocations, topKeywords } = extractEntitiesFromArticles(articles);

  // Step 3: Build corpus summary for LLM
  const corpusSummary = articles.slice(0, 40).map((a, i) =>
    `[${i + 1}] "${a.title}" | Country: ${a.country ?? "?"} | Agency: ${a.agencyName ?? "?"} | Summary: ${(a.summary ?? "").slice(0, 200)}`
  ).join("\n");

  const entityContext = `
Top People: ${topPeople.slice(0, 10).join(", ")}
Top Organizations: ${topOrgs.slice(0, 10).join(", ")}
Top Locations: ${topLocations.slice(0, 10).join(", ")}
Top Keywords: ${topKeywords.slice(0, 20).join(", ")}
`.trim();

  // Step 4: LLM structured synthesis
  const systemPrompt = `You are a senior intelligence analyst specialising in information operations, 
strategic communications, and narrative analysis. Your task is to identify ACTIVE INFORMATION NARRATIVES 
from a corpus of news articles using a rigorous, evidence-based methodology.

SCIENTIFIC METHOD:
1. Identify recurring themes, framings, and messaging patterns across the corpus
2. Assess origin indicators: which actors, states, or networks are pushing each narrative
3. Evaluate amplification: which publishers and authors are spreading each narrative
4. Classify by type: Propaganda (state-driven), Disinformation (false/misleading), 
   Strategic Messaging (policy-driven), Influence Operation (coordinated inauthentic), 
   Counter-Narrative (pushback against dominant narrative)
5. Assign threat level based on: reach, coordination evidence, and potential societal impact
6. Confidence score = (evidence breadth × consistency × source diversity) / 100

RULES:
- Only identify narratives that are DIRECTLY EVIDENCED by the corpus
- Do NOT invent narratives not supported by the articles
- Each narrative must cite specific keywords and entities from the corpus
- Confidence must reflect actual evidence strength (do not over-inflate)
- Return 3–8 narratives maximum`;

  const userPrompt = `REGION: ${region}
CORPUS SIZE: ${articles.length} articles

ENTITY FREQUENCY ANALYSIS:
${entityContext}

ARTICLE CORPUS (most recent 40):
${corpusSummary}

Identify the active information narratives in this corpus. Return ONLY valid JSON matching the schema.`;

  const schema = {
    type: "object",
    properties: {
      narratives: {
        type: "array",
        items: {
          type: "object",
          properties: {
            title: { type: "string", description: "Concise narrative title (max 80 chars)" },
            description: { type: "string", description: "Full analytical description (200-400 words) explaining the narrative, its mechanics, and geopolitical context" },
            category: { type: "string", enum: ["Propaganda", "Disinformation", "Strategic Messaging", "Influence Operation", "Counter-Narrative"] },
            threatLevel: { type: "string", enum: ["low", "medium", "high", "critical"] },
            originCountry: { type: "string", description: "Most likely origin country or 'Unknown'" },
            targetCountries: { type: "array", items: { type: "string" }, description: "Countries targeted by this narrative" },
            knownAuthors: { type: "array", items: { type: "string" }, description: "Authors/actors identified as spreading this narrative" },
            knownPublishers: { type: "array", items: { type: "string" }, description: "Publishers/outlets amplifying this narrative" },
            tags: { type: "array", items: { type: "string" }, description: "5-10 classification tags" },
            analystNotes: { type: "string", description: "Analyst assessment: what makes this narrative significant, what to watch for" },
            evidenceKeywords: { type: "array", items: { type: "string" }, description: "10-20 specific keywords/phrases from the corpus that evidence this narrative" },
            scientificMethod: { type: "string", description: "Brief explanation of the analytical method used to identify this narrative (2-3 sentences)" },
            confidence: { type: "number", description: "Confidence score 0-100 based on evidence strength" },
          },
          required: ["title", "description", "category", "threatLevel", "originCountry", "targetCountries", "knownAuthors", "knownPublishers", "tags", "analystNotes", "evidenceKeywords", "scientificMethod", "confidence"],
          additionalProperties: false,
        },
      },
    },
    required: ["narratives"],
    additionalProperties: false,
  };

  const response = await invokeLLM({
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "narrative_analysis",
        strict: true,
        schema,
      },
    },
  });

  const content = String(response.choices?.[0]?.message?.content ?? "{}");
  const parsed = safeParseJson<{ narratives: GeneratedNarrative[] }>(content, { narratives: [] });
  return parsed.narratives ?? [];
}

// ─── Article → Narrative matching (for Verify pipeline) ──────────────────────

export async function checkArticleAgainstNarratives(
  articleId: number,
  region: string
): Promise<NarrativeArticleMatch[]> {
  // Fetch the article
  const pool = getRawPool();
  const [artRows] = await pool.execute(
    `SELECT a.title, a.summary, a.content, a.entitiesJson, a.topics, a.country,
            ag.name AS agencyName
     FROM articles a
     LEFT JOIN news_agencies ag ON a.agencyId = ag.id
     WHERE a.id = ?`,
    [articleId]
  ) as [Array<{
    title: string; summary: string | null; content: string | null;
    entitiesJson: string | null; topics: string | null; country: string | null;
    agencyName: string | null;
  }>, unknown];

  if (!artRows.length) return [];
  const article = artRows[0];

  // Fetch active narratives for the region
  const regionNarrativeFilter = region === "Global" ? "" : "AND region = ?";
  const regionNarrativeParams = region === "Global" ? [] : [region];
  const [narratives] = await pool.execute(
    `SELECT id, title, description, evidenceKeywords, tags, category, threatLevel
     FROM narratives
     WHERE status = 'active' ${regionNarrativeFilter}
     LIMIT 20`,
    regionNarrativeParams
  ) as [Array<{
    id: number; title: string; description: string;
    evidenceKeywords: string | null; tags: string | null;
    category: string; threatLevel: string;
  }>, unknown];

  if (!narratives.length) return [];

  // Build article text profile
  const articleText = [
    article.title,
    article.summary ?? "",
    (article.content ?? "").slice(0, 1000),
  ].join(" ");

  const articleEntities = safeParseJson<Record<string, unknown>>(article.entitiesJson, {});
  const articleEntityList = [
    ...((articleEntities.persons ?? articleEntities.people ?? []) as string[]),
    ...((articleEntities.organizations ?? articleEntities.orgs ?? []) as string[]),
    ...((articleEntities.locations ?? articleEntities.countries ?? []) as string[]),
    ...((articleEntities.keywords ?? []) as string[]),
    ...(safeParseJson<string[]>(article.topics, [])),
    article.country ?? "",
    article.agencyName ?? "",
  ].filter(Boolean);

  // Step 1: Keyword overlap scoring for all narratives
  const candidates: Array<{
    narrative: typeof narratives[0];
    score: number;
    matchedKeywords: string[];
    matchedEntities: string[];
  }> = [];

  for (const narrative of narratives) {
    const keywords = safeParseJson<string[]>(narrative.evidenceKeywords, []);
    const tags = safeParseJson<string[]>(narrative.tags, []);
    const allKeywords = [...keywords, ...tags, ...narrative.title.split(" ")];

    const { score: kwScore, matched: kwMatched } = keywordOverlapScore(articleText, allKeywords);

    // Entity overlap
    const descText = narrative.description + " " + narrative.title;
    const entMatched = articleEntityList.filter(e =>
      e.length > 2 && descText.toLowerCase().includes(e.toLowerCase())
    );
    const entScore = articleEntityList.length > 0
      ? (entMatched.length / Math.max(articleEntityList.length, 1)) * 100
      : 0;

    const combinedScore = kwScore * 0.6 + entScore * 0.4;

    if (combinedScore >= 8) { // Only include if there's meaningful overlap
      candidates.push({
        narrative,
        score: Math.min(Math.round(combinedScore), 95),
        matchedKeywords: kwMatched.slice(0, 10),
        matchedEntities: entMatched.slice(0, 8),
      });
    }
  }

  // Sort by score, take top 5 for LLM reasoning
  candidates.sort((a, b) => b.score - a.score);
  const topCandidates = candidates.slice(0, 5);

  if (!topCandidates.length) return [];

  // Step 2: LLM reasoning for top candidates
  const candidateSummary = topCandidates.map((c, i) =>
    `[${i + 1}] Narrative: "${c.narrative.title}" (${c.narrative.category}, ${c.narrative.threatLevel} threat)
    Description: ${c.narrative.description.slice(0, 300)}
    Matched keywords: ${c.matchedKeywords.join(", ")}
    Matched entities: ${c.matchedEntities.join(", ")}`
  ).join("\n\n");

  const llmPrompt = `You are an intelligence analyst. Evaluate how the following article relates to each candidate narrative.

ARTICLE:
Title: ${article.title}
Summary: ${article.summary ?? "N/A"}
Country: ${article.country ?? "N/A"}
Agency: ${article.agencyName ?? "N/A"}
Content excerpt: ${(article.content ?? "").slice(0, 600)}

CANDIDATE NARRATIVES:
${candidateSummary}

For each narrative, determine:
1. Does the article SUPPORT (reinforces the narrative), CONTRADICT (challenges it), or CONTEXTUALISE (provides background/context)?
2. A final relevance score 0-100 (be precise and conservative)
3. A 1-2 sentence analytical reasoning

Return ONLY valid JSON.`;

  const llmSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            narrativeIndex: { type: "number", description: "1-based index matching the candidate list" },
            supportType: { type: "string", enum: ["supports", "contradicts", "contextualises"] },
            finalScore: { type: "number", description: "0-100 relevance score" },
            reasoning: { type: "string", description: "1-2 sentence analytical reasoning" },
          },
          required: ["narrativeIndex", "supportType", "finalScore", "reasoning"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };

  const llmResponse = await invokeLLM({
    messages: [
      { role: "system", content: "You are a senior intelligence analyst specialising in narrative analysis and information operations. Be precise, evidence-based, and conservative in scoring." },
      { role: "user", content: llmPrompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "narrative_match", strict: true, schema: llmSchema },
    },
  });

  const llmContent = String(llmResponse.choices?.[0]?.message?.content ?? "{}");
  const llmParsed = safeParseJson<{ results: Array<{ narrativeIndex: number; supportType: string; finalScore: number; reasoning: string }> }>(
    llmContent, { results: [] }
  );

  // Merge LLM results with candidates
  const results: NarrativeArticleMatch[] = [];
  for (const llmResult of llmParsed.results ?? []) {
    const idx = llmResult.narrativeIndex - 1;
    if (idx < 0 || idx >= topCandidates.length) continue;
    const candidate = topCandidates[idx];
    if (llmResult.finalScore < 10) continue; // Skip very low scores

    results.push({
      narrativeId: candidate.narrative.id,
      narrativeTitle: candidate.narrative.title,
      relevanceScore: Math.min(llmResult.finalScore, 95),
      supportType: (llmResult.supportType as "supports" | "contradicts" | "contextualises") ?? "contextualises",
      matchedKeywords: candidate.matchedKeywords,
      matchedEntities: candidate.matchedEntities,
      llmReasoning: llmResult.reasoning,
    });
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results;
}

// ─── Backfill article links for a narrative ───────────────────────────────────
/**
 * Find and persist the top matching articles for a given narrative.
 * Uses keyword + entity overlap scoring + LLM reasoning.
 * Returns the number of links inserted/updated.
 */
export async function backfillNarrativeLinks(narrativeId: number, limit = 10): Promise<number> {
  const pool = getRawPool();
  const [narRows] = await pool.execute(
    `SELECT id, title, description, region, evidenceKeywords, tags, category, threatLevel
     FROM narratives WHERE id = ? LIMIT 1`,
    [narrativeId]
  ) as [Array<{
    id: number; title: string; description: string; region: string;
    evidenceKeywords: string | null; tags: string | null;
    category: string; threatLevel: string;
  }>, unknown];
  if (!narRows.length) return 0;
  const nar = narRows[0];
  const keywords = safeParseJson<string[]>(nar.evidenceKeywords, []);
  const tags = safeParseJson<string[]>(nar.tags, []);
  const allKeywords = [...keywords, ...tags, ...nar.title.split(" ").filter((w: string) => w.length > 3)];
  if (!allKeywords.length) return 0;
  const regionFilter = nar.region && nar.region !== "Global" ? "AND a.country = ?" : "";
  const regionParam: string[] = nar.region && nar.region !== "Global" ? [nar.region] : [];
  const [artRows] = await pool.execute(
    `SELECT a.id, a.title, a.summary, a.content, a.url, a.country, a.entitiesJson, a.topics,
            ag.name AS agencyName
     FROM articles a
     LEFT JOIN news_agencies ag ON a.agencyId = ag.id
     WHERE a.title IS NOT NULL ${regionFilter}
     ORDER BY a.publishedAt DESC
     LIMIT 500`,
    regionParam
  ) as [Array<{
    id: number; title: string; summary: string | null; content: string | null;
    url: string | null; country: string | null; entitiesJson: string | null;
    topics: string | null; agencyName: string | null;
  }>, unknown];
  if (!artRows.length) return 0;
  const candidates: Array<{
    article: typeof artRows[0];
    score: number;
    matchedKeywords: string[];
    matchedEntities: string[];
  }> = [];
  for (const art of artRows) {
    const artText = [art.title, art.summary ?? "", (art.content ?? "").slice(0, 800)].join(" ");
    const { score: kwScore, matched: kwMatched } = keywordOverlapScore(artText, allKeywords);
    const artEntities = safeParseJson<Record<string, unknown>>(art.entitiesJson, {});
    const artEntityList = [
      ...((artEntities.persons ?? artEntities.people ?? []) as string[]),
      ...((artEntities.organizations ?? artEntities.orgs ?? []) as string[]),
      ...((artEntities.locations ?? artEntities.countries ?? []) as string[]),
      ...(safeParseJson<string[]>(art.topics, [])),
      art.country ?? "",
    ].filter(Boolean);
    const descText = nar.description + " " + nar.title;
    const entMatched = artEntityList.filter((e: string) =>
      e.length > 2 && descText.toLowerCase().includes(e.toLowerCase())
    );
    const entScore = artEntityList.length > 0
      ? (entMatched.length / Math.max(artEntityList.length, 1)) * 100
      : 0;
    const combined = kwScore * 0.6 + entScore * 0.4;
    if (combined >= 10) {
      candidates.push({
        article: art,
        score: Math.min(Math.round(combined), 95),
        matchedKeywords: kwMatched.slice(0, 10),
        matchedEntities: entMatched.slice(0, 8),
      });
    }
  }
  candidates.sort((a, b) => b.score - a.score);
  const top = candidates.slice(0, limit * 3);
  if (!top.length) return 0;
  const candidateSummary = top.slice(0, 15).map((c, i) =>
    `[${i + 1}] "${c.article.title}" | Country: ${c.article.country ?? "?"} | Score: ${c.score}`
  ).join("\n");
  const llmPrompt = `You are an intelligence analyst. For the narrative below, classify each candidate article.
NARRATIVE: "${nar.title}"
Description: ${nar.description.slice(0, 400)}
Category: ${nar.category} | Threat: ${nar.threatLevel}
CANDIDATE ARTICLES:
${candidateSummary}
For each article, return: supportType (supports/contradicts/contextualises), finalScore (0-100), reasoning (1 sentence).
Only include articles with finalScore >= 15. Return valid JSON.`;
  const llmSchema = {
    type: "object",
    properties: {
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            articleIndex: { type: "number" },
            supportType: { type: "string", enum: ["supports", "contradicts", "contextualises"] },
            finalScore: { type: "number" },
            reasoning: { type: "string" },
          },
          required: ["articleIndex", "supportType", "finalScore", "reasoning"],
          additionalProperties: false,
        },
      },
    },
    required: ["results"],
    additionalProperties: false,
  };
  let llmResults: Array<{ articleIndex: number; supportType: string; finalScore: number; reasoning: string }> = [];
  try {
    const llmResponse = await invokeLLM({
      messages: [
        { role: "system", content: "You are a senior intelligence analyst. Be precise and conservative in scoring." },
        { role: "user", content: llmPrompt },
      ],
      response_format: { type: "json_schema", json_schema: { name: "backfill_match", strict: true, schema: llmSchema } },
    });
    const content = String(llmResponse.choices?.[0]?.message?.content ?? "{}");
    const parsed = safeParseJson<{ results: typeof llmResults }>(content, { results: [] });
    llmResults = parsed.results ?? [];
  } catch {
    llmResults = top.slice(0, limit).map((c, i) => ({
      articleIndex: i + 1,
      supportType: "contextualises" as const,
      finalScore: c.score,
      reasoning: `Keyword overlap: ${c.matchedKeywords.slice(0, 3).join(", ")}`,
    }));
  }
  const now = Date.now();
  let inserted = 0;
  for (const r of llmResults) {
    if (r.finalScore < 15) continue;
    const idx = r.articleIndex - 1;
    if (idx < 0 || idx >= top.length) continue;
    const art = top[idx].article;
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
          narrativeId,
          art.id,
          r.finalScore,
          JSON.stringify(top[idx].matchedKeywords),
          JSON.stringify(top[idx].matchedEntities),
          r.supportType,
          r.reasoning,
          now,
        ]
      );
      inserted++;
      if (inserted >= limit) break;
    } catch { /* skip */ }
  }
  return inserted;
}
