/**
 * Server-side In-Memory Cache Layer
 * 
 * Provides TTL-based caching for expensive DB queries and API calls.
 * This prevents 200K+ concurrent users from each hitting the database.
 * 
 * Strategy:
 * - Reference data (agencies, facilities, regions): 5 min TTL
 * - Satellite TLEs: 2 hour TTL (TLEs don't change faster)
 * - Article stats / threat summary: 30s TTL
 * - Live data (aviation, maritime): handled by existing caches in sigint.ts
 */

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
  fetchedAt: number;
}

class MemoryCache {
  private store = new Map<string, CacheEntry<any>>();
  private pendingFetches = new Map<string, Promise<any>>();

  /**
   * Get cached value or fetch it.
   * Uses "single-flight" pattern: if multiple requests arrive for the same key
   * while a fetch is in progress, they all await the same promise.
   * This prevents thundering herd on cache expiry.
   */
  async getOrFetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttlMs: number
  ): Promise<T> {
    const now = Date.now();
    const cached = this.store.get(key);

    // Return cached if still valid
    if (cached && cached.expiresAt > now) {
      return cached.data as T;
    }

    // Single-flight: if another request is already fetching this key, wait for it
    const pending = this.pendingFetches.get(key);
    if (pending) {
      return pending as Promise<T>;
    }

    // Fetch new data
    const fetchPromise = fetcher()
      .then((data) => {
        this.store.set(key, {
          data,
          expiresAt: now + ttlMs,
          fetchedAt: now,
        });
        this.pendingFetches.delete(key);
        return data;
      })
      .catch((err) => {
        this.pendingFetches.delete(key);
        // If we have stale data, return it rather than failing
        if (cached) {
          console.warn(`[Cache] Fetch failed for "${key}", returning stale data`);
          return cached.data as T;
        }
        throw err;
      });

    this.pendingFetches.set(key, fetchPromise);
    return fetchPromise;
  }

  /**
   * Manually set a cache entry (useful for warming)
   */
  set<T>(key: string, data: T, ttlMs: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + ttlMs,
      fetchedAt: Date.now(),
    });
  }

  /**
   * Invalidate a specific key
   */
  invalidate(key: string): void {
    this.store.delete(key);
  }

  /**
   * Invalidate all keys matching a prefix
   */
  invalidatePrefix(prefix: string): void {
    for (const key of Array.from(this.store.keys())) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Get cache stats for monitoring
   */
  getStats(): { entries: number; totalBytes: number; keys: string[] } {
    return {
      entries: this.store.size,
      totalBytes: 0, // Approximation not needed for monitoring
      keys: Array.from(this.store.keys()),
    };
  }

  /**
   * Cleanup expired entries (called periodically)
   */
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of Array.from(this.store.entries())) {
      if (entry.expiresAt < now) {
        this.store.delete(key);
      }
    }
  }
}

// Singleton instance
export const cache = new MemoryCache();

// Cleanup expired entries every 2 minutes
setInterval(() => cache.cleanup(), 2 * 60 * 1000);

// ─── Cache TTL Constants ─────────────────────────────────────────────────────

/** Reference data that rarely changes (agencies, facilities, regions) */
export const TTL_REFERENCE = 5 * 60 * 1000; // 5 minutes

/** Satellite TLE catalog (updates from CelesTrak every few hours) */
export const TTL_SATELLITES = 2 * 60 * 60 * 1000; // 2 hours

/** Article statistics and threat summaries */
export const TTL_STATS = 30 * 1000; // 30 seconds

/** Computed satellite positions (short-lived, recomputed frequently) */
export const TTL_POSITIONS = 10 * 1000; // 10 seconds

/** Header preferences and CMS config */
export const TTL_CONFIG = 60 * 1000; // 1 minute

/** Country intel briefs (LLM-generated, expensive) */
export const TTL_INTEL_BRIEF = 24 * 60 * 60 * 1000; // 24 hours

// ─── Cache Key Builders ──────────────────────────────────────────────────────

export const CacheKeys = {
  agencies: () => "ref:agencies",
  facilities: () => "ref:facilities",
  regions: () => "ref:regions",
  satellites: (groups: string[]) => `orbit:sats:${groups.sort().join(",")}`,
  positions: (groups: string[], ts?: number) => `orbit:pos:${groups.sort().join(",")}:${ts || "now"}`,
  articleStats: (region: string) => `stats:articles:${region}`,
  threatSummary: (region: string) => `stats:threat:${region}`,
  headerPrefs: (page: string) => `config:headerPrefs:${page}`,
  countryBrief: (country: string) => `intel:brief:${country.toLowerCase()}`,
  aviationData: () => "sigint:aviation",
  maritimeData: () => "sigint:maritime",
};
