/**
 * SIGINT/ORBIT Data Fetcher
 * 
 * Provides snapshot functions that the SSE data pump calls.
 * These functions directly call the underlying data functions
 * (not via tRPC) to avoid context/auth overhead.
 * 
 * The key insight: the existing aviation/maritime caches already prevent
 * hitting upstream APIs too frequently. We just expose cached data for broadcast.
 */

import { cache, CacheKeys, TTL_STATS, TTL_POSITIONS } from "./cache";
import * as db from "./db";

// ─── Aviation Snapshot ────────────────────────────────────────────────────────

// We'll lazily import the internal fetch function from sigint router
let _fetchAviationFn: (() => Promise<any>) | null = null;

async function getAviationFetcher() {
  if (!_fetchAviationFn) {
    // The sigint module exports the router; we need the internal fetch function
    // We'll use a wrapper that calls the same logic the router uses
    const mod = await import("./routers/sigint");
    // The router's getAviationData calls fetchRealAviationData internally
    // Since that's not exported, we'll call through the router procedure directly
    // by creating a minimal context-free call
    _fetchAviationFn = async () => {
      // Access the internal aviation cache by calling the procedure's resolver
      // tRPC v11: we can call the procedure's _def.query directly
      const proc = (mod.sigintRouter as any)._def.procedures.getAviationData;
      if (proc && proc._def && proc._def.query) {
        return proc._def.query({ ctx: {}, input: undefined });
      }
      return null;
    };
  }
  return _fetchAviationFn;
}

/**
 * Returns the latest aviation data snapshot.
 */
export async function fetchAviationSnapshot(): Promise<any | null> {
  try {
    const fetcher = await getAviationFetcher();
    return await fetcher();
  } catch (err) {
    console.error("[DataFetcher] Aviation snapshot error:", err);
    return null;
  }
}

// ─── Maritime Snapshot ────────────────────────────────────────────────────────

let _fetchMaritimeFn: (() => Promise<any>) | null = null;

async function getMaritimeFetcher() {
  if (!_fetchMaritimeFn) {
    const mod = await import("./routers/sigint");
    _fetchMaritimeFn = async () => {
      const proc = (mod.sigintRouter as any)._def.procedures.getMaritimeData;
      if (proc && proc._def && proc._def.query) {
        return proc._def.query({ ctx: {}, input: undefined });
      }
      return null;
    };
  }
  return _fetchMaritimeFn;
}

export async function fetchMaritimeSnapshot(): Promise<any | null> {
  try {
    const fetcher = await getMaritimeFetcher();
    return await fetcher();
  } catch (err) {
    console.error("[DataFetcher] Maritime snapshot error:", err);
    return null;
  }
}

// ─── Orbit Positions Snapshot ─────────────────────────────────────────────────

/**
 * Returns all satellite positions.
 * Uses cache to avoid recomputing SGP4 propagation every broadcast.
 */
export async function fetchOrbitSnapshot(): Promise<any | null> {
  try {
    return await cache.getOrFetch(
      "orbit:broadcast:all",
      async () => {
        const mod = await import("./routers/orbit");
        const proc = (mod.orbitRouter as any)._def.procedures.getAllPositions;
        if (proc && proc._def && proc._def.query) {
          const groups = ["starlink", "oneweb", "gps", "glonass", "iridium", "military", "beidou", "galileo", "eo", "reconnaissance"];
          return proc._def.query({ ctx: {}, input: { groups } });
        }
        return null;
      },
      TTL_POSITIONS
    );
  } catch (err) {
    console.error("[DataFetcher] Orbit snapshot error:", err);
    return null;
  }
}

// ─── Intel Stats Snapshot ─────────────────────────────────────────────────────

/**
 * Returns article stats and threat summary.
 * Cached for 30s since this data doesn't change rapidly.
 */
export async function fetchIntelStatsSnapshot(): Promise<any | null> {
  try {
    return await cache.getOrFetch(
      "intel:stats:broadcast",
      async () => {
        const [stats, articles] = await Promise.allSettled([
          db.getArticleStats("MENA"),
          db.getArticles({ region: "MENA", limit: 5 }),
        ]);
        return {
          stats: stats.status === "fulfilled" ? stats.value : null,
          latestArticles: articles.status === "fulfilled" ? articles.value : null,
          timestamp: Date.now(),
        };
      },
      TTL_STATS
    );
  } catch (err) {
    console.error("[DataFetcher] Intel stats snapshot error:", err);
    return null;
  }
}
