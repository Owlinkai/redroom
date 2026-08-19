/**
 * Scalability Layer Tests — Cache, Rate Limiter, SSE Connection Tracking
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitKey,
  RATE_LIMITS,
  checkSSEConnectionLimit,
  releaseSSEConnection,
  getSSEConnectionCount,
  getServerLoadLevel,
  getServerHealth,
  getClientIP,
} from "./rateLimiter";
import { cache, CacheKeys, TTL_STATS, TTL_REFERENCE } from "./cache";

// Helper to access cache internals for testing
function getCacheEntry(key: string): any {
  return (cache as any).store.get(key);
}

describe("In-Memory Cache", () => {
  it("should store and retrieve values via set", () => {
    cache.set("test-key", { value: 42 }, 60000);
    const entry = getCacheEntry("test-key");
    expect(entry).toBeDefined();
    expect(entry.data).toEqual({ value: 42 });
  });

  it("should fetch and cache via getOrFetch", async () => {
    const result = await cache.getOrFetch("fetch-key", async () => ({ hello: "world" }), 60000);
    expect(result).toEqual({ hello: "world" });
    // Second call should return cached
    let fetchCalled = false;
    const result2 = await cache.getOrFetch("fetch-key", async () => { fetchCalled = true; return { hello: "new" }; }, 60000);
    expect(result2).toEqual({ hello: "world" });
    expect(fetchCalled).toBe(false);
  });

  it("should invalidate entries", () => {
    cache.set("inv-key", "data", 60000);
    cache.invalidate("inv-key");
    expect(getCacheEntry("inv-key")).toBeUndefined();
  });

  it("should have correct TTL constants", () => {
    expect(TTL_STATS).toBeGreaterThan(0);
    expect(TTL_REFERENCE).toBeGreaterThan(TTL_STATS);
  });

  it("should have predefined cache key builders", () => {
    expect(CacheKeys.articleStats("MENA")).toBe("stats:articles:MENA");
    expect(CacheKeys.agencies()).toBe("ref:agencies");
    expect(CacheKeys.facilities()).toBe("ref:facilities");
  });

  it("should report stats", () => {
    cache.set("stats-test", 123, 60000);
    const stats = cache.getStats();
    expect(stats.entries).toBeGreaterThan(0);
    expect(stats.keys).toContain("stats-test");
  });
});

describe("Rate Limiter", () => {
  it("should allow requests within limit", () => {
    const key = getRateLimitKey("test", "192.168.1.1");
    const result = checkRateLimit(key, { max: 10, windowMs: 60000 });
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(9);
  });

  it("should block requests exceeding limit", () => {
    const key = getRateLimitKey("block-test", "10.0.0.1");
    const config = { max: 3, windowMs: 60000 };

    checkRateLimit(key, config); // 1
    checkRateLimit(key, config); // 2
    checkRateLimit(key, config); // 3
    const result = checkRateLimit(key, config); // 4 → blocked

    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("should provide correct rate limit configurations", () => {
    expect(RATE_LIMITS.ANONYMOUS_QUERY.max).toBe(200);
    expect(RATE_LIMITS.ANONYMOUS_QUERY.windowMs).toBe(60000);
    expect(RATE_LIMITS.SSE_CONNECTION.max).toBe(5);
  });

  it("should extract client IP from CF-Connecting-IP header", () => {
    const mockReq = {
      headers: { "cf-connecting-ip": "1.2.3.4" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    expect(getClientIP(mockReq)).toBe("1.2.3.4");
  });

  it("should fall back to x-forwarded-for", () => {
    const mockReq = {
      headers: { "x-forwarded-for": "5.6.7.8, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    };
    expect(getClientIP(mockReq)).toBe("5.6.7.8");
  });

  it("should fall back to socket remote address", () => {
    const mockReq = {
      headers: {},
      socket: { remoteAddress: "192.168.1.100" },
    };
    expect(getClientIP(mockReq)).toBe("192.168.1.100");
  });
});

describe("SSE Connection Tracking", () => {
  beforeEach(() => {
    // Reset by releasing all connections
    for (let i = 0; i < 10; i++) {
      releaseSSEConnection("test-ip");
      releaseSSEConnection("other-ip");
    }
  });

  it("should allow connections within limit", () => {
    expect(checkSSEConnectionLimit("new-ip-1")).toBe(true);
    expect(checkSSEConnectionLimit("new-ip-1")).toBe(true);
  });

  it("should block connections exceeding per-IP limit", () => {
    const ip = "flood-ip-" + Date.now();
    for (let i = 0; i < 5; i++) {
      expect(checkSSEConnectionLimit(ip)).toBe(true);
    }
    // 6th connection should be blocked
    expect(checkSSEConnectionLimit(ip)).toBe(false);
  });

  it("should release connections properly", () => {
    const ip = "release-ip-" + Date.now();
    for (let i = 0; i < 5; i++) checkSSEConnectionLimit(ip);
    expect(checkSSEConnectionLimit(ip)).toBe(false); // at limit

    releaseSSEConnection(ip);
    expect(checkSSEConnectionLimit(ip)).toBe(true); // one slot freed
  });

  it("should track total connection count", () => {
    const initialCount = getSSEConnectionCount();
    const ip1 = "count-ip1-" + Date.now();
    const ip2 = "count-ip2-" + Date.now();
    checkSSEConnectionLimit(ip1);
    checkSSEConnectionLimit(ip2);
    checkSSEConnectionLimit(ip2);
    expect(getSSEConnectionCount()).toBe(initialCount + 3);
  });
});

describe("Server Health & Load Detection", () => {
  it("should return a valid load level", () => {
    const level = getServerLoadLevel();
    expect(["normal", "elevated", "critical"]).toContain(level);
  });

  it("should return health metrics", () => {
    const health = getServerHealth();
    expect(health).toHaveProperty("loadLevel");
    expect(health).toHaveProperty("heapUsedMB");
    expect(health).toHaveProperty("heapTotalMB");
    expect(health).toHaveProperty("rssMB");
    expect(health).toHaveProperty("sseConnections");
    expect(health).toHaveProperty("sseUniqueIPs");
    expect(health).toHaveProperty("rateLimitEntries");
    expect(health).toHaveProperty("uptime");
    expect(health.uptime).toBeGreaterThanOrEqual(0);
  });
});
