/**
 * Rate Limiter — In-memory sliding window rate limiter for tRPC procedures.
 * Enhanced for 200K+ concurrent users with SSE connection tracking and
 * graceful degradation under load.
 * 
 * Tiers:
 * - Anonymous queries: 200 requests/minute per IP (higher since SSE reduces polling)
 * - Analyst mutations: 30 requests/minute per user
 * - LLM calls: 20 requests/day per user (analyst), 5/day for anonymous
 * - Admin: no limits
 * - SSE: max 5 connections per IP
 */

interface RateLimitEntry {
  count: number;
  windowStart: number;
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store.entries())) {
    if (now - entry.windowStart > 86400000) { // 24h
      store.delete(key);
    }
  }
}, 300000);

export interface RateLimitConfig {
  /** Maximum requests allowed in the window */
  max: number;
  /** Window duration in milliseconds */
  windowMs: number;
}

export const RATE_LIMITS = {
  /** Anonymous read queries — higher limit since SSE reduces polling */
  ANONYMOUS_QUERY: { max: 200, windowMs: 60000 } as RateLimitConfig,
  /** Analyst write operations */
  ANALYST_MUTATION: { max: 30, windowMs: 60000 } as RateLimitConfig,
  /** LLM calls for analysts */
  LLM_ANALYST: { max: 20, windowMs: 86400000 } as RateLimitConfig,
  /** LLM calls for anonymous (via public endpoints) */
  LLM_ANONYMOUS: { max: 5, windowMs: 86400000 } as RateLimitConfig,
  /** Heavy operations (crawl, bulk) for admins */
  ADMIN_HEAVY: { max: 10, windowMs: 60000 } as RateLimitConfig,
  /** SSE connections per IP */
  SSE_CONNECTION: { max: 5, windowMs: 60000 } as RateLimitConfig,
};

/**
 * Check if a request is within rate limits.
 * @returns true if allowed, false if rate limited
 */
export function checkRateLimit(key: string, config: RateLimitConfig): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now - entry.windowStart > config.windowMs) {
    // New window
    store.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: config.max - 1, resetAt: now + config.windowMs };
  }

  if (entry.count >= config.max) {
    return { allowed: false, remaining: 0, resetAt: entry.windowStart + config.windowMs };
  }

  entry.count++;
  return { allowed: true, remaining: config.max - entry.count, resetAt: entry.windowStart + config.windowMs };
}

/**
 * Get a rate limit key based on IP or user ID.
 */
export function getRateLimitKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

/**
 * Extract real client IP from request headers.
 * Respects Cloudflare's CF-Connecting-IP for accurate identification.
 */
export function getClientIP(req: any): string {
  return req.headers['cf-connecting-ip']
    || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress || 'unknown';
}

/**
 * Express middleware for rate limiting API routes.
 * Respects Cloudflare's CF-Connecting-IP header for accurate client identification.
 */
export function rateLimitMiddleware(config: RateLimitConfig) {
  return (req: any, res: any, next: any) => {
    const ip = getClientIP(req);
    const key = getRateLimitKey('api', ip);
    const result = checkRateLimit(key, config);

    res.setHeader('X-RateLimit-Limit', config.max);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000));

    if (!result.allowed) {
      res.setHeader('Retry-After', Math.ceil((result.resetAt - Date.now()) / 1000));
      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests. Please slow down.',
        retryAfter: Math.ceil((result.resetAt - Date.now()) / 1000),
      });
      return;
    }

    next();
  };
}

// ─── SSE Connection Tracking ──────────────────────────────────────────────────

const sseConnections = new Map<string, number>();

/**
 * Check if an IP can open another SSE connection.
 * Returns true if allowed, false if at limit.
 */
export function checkSSEConnectionLimit(ip: string, maxPerIP = 5): boolean {
  const current = sseConnections.get(ip) || 0;
  if (current >= maxPerIP) return false;
  sseConnections.set(ip, current + 1);
  return true;
}

/**
 * Release an SSE connection slot for an IP.
 */
export function releaseSSEConnection(ip: string): void {
  const current = sseConnections.get(ip) || 0;
  if (current <= 1) {
    sseConnections.delete(ip);
  } else {
    sseConnections.set(ip, current - 1);
  }
}

/**
 * Get total number of active SSE connections across all IPs.
 */
export function getSSEConnectionCount(): number {
  let total = 0;
  for (const [, count] of Array.from(sseConnections.entries())) total += count;
  return total;
}

/**
 * Get number of unique IPs with SSE connections.
 */
export function getSSEUniqueIPs(): number {
  return sseConnections.size;
}

// ─── Graceful Degradation ─────────────────────────────────────────────────────

export type LoadLevel = 'normal' | 'elevated' | 'critical';

/**
 * Assess current server load level for graceful degradation.
 * 
 * - normal: full fidelity data, all features
 * - elevated: reduce data payload sizes, skip non-essential computations
 * - critical: minimal data, drop non-essential SSE channels
 */
export function getServerLoadLevel(): LoadLevel {
  const memUsage = process.memoryUsage();
  const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
  const totalConnections = getSSEConnectionCount();
  
  // Cloud Run: 512 MiB RAM. In production, heap is much lower than dev mode.
  // Dev mode (tsx watch + Vite) uses ~350-400MB; production uses ~80-150MB.
  if (heapUsedMB > 450 || totalConnections > 50000) return 'critical';
  if (heapUsedMB > 380 || totalConnections > 20000) return 'elevated';
  return 'normal';
}

/**
 * Get server health metrics for monitoring.
 */
export function getServerHealth() {
  const memUsage = process.memoryUsage();
  return {
    loadLevel: getServerLoadLevel(),
    heapUsedMB: Math.round(memUsage.heapUsed / 1024 / 1024),
    heapTotalMB: Math.round(memUsage.heapTotal / 1024 / 1024),
    rssMB: Math.round(memUsage.rss / 1024 / 1024),
    sseConnections: getSSEConnectionCount(),
    sseUniqueIPs: getSSEUniqueIPs(),
    rateLimitEntries: store.size,
    uptime: Math.round(process.uptime()),
  };
}
