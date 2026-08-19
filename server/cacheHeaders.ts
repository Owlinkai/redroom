/**
 * HTTP Cache Headers Middleware
 * 
 * Sets appropriate Cache-Control headers so Cloudflare (and browsers)
 * can cache static assets and some API responses at the edge.
 * 
 * Strategy:
 * - Static assets (JS/CSS/fonts/images): immutable, 1 year (Vite hashes filenames)
 * - HTML shell: no-cache (always revalidate, but still cacheable with ETag)
 * - API responses (reference data): short TTL (30-60s) for Cloudflare edge
 * - Live data APIs: no-store (never cache)
 * - SSE streams: no-cache, no-transform
 */

import type { Request, Response, NextFunction } from "express";

/**
 * Middleware that sets cache headers based on the request path.
 * Place this BEFORE static file serving and tRPC middleware.
 */
export function cacheHeadersMiddleware(req: Request, res: Response, next: NextFunction): void {
  const path = req.path;

  // ─── Static assets with content hash (Vite build output) ────────────────────
  // These files have hashes in their names, so they're safe to cache forever
  if (path.match(/\.(js|css|woff2?|ttf|eot|svg|png|jpg|jpeg|gif|webp|avif|ico)$/)) {
    // If it has a hash in the filename (Vite pattern: name-[hash].ext)
    if (path.match(/[-\.][a-f0-9]{8,}\./)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } else {
      // Static but no hash — cache for 1 hour, revalidate
      res.setHeader("Cache-Control", "public, max-age=3600, must-revalidate");
    }
  }

  // ─── HTML pages — short cache, always revalidate ────────────────────────────
  else if (path === "/" || path.endsWith(".html") || (!path.includes(".") && !path.startsWith("/api/"))) {
    res.setHeader("Cache-Control", "public, max-age=60, must-revalidate");
  }

  // ─── Cacheable API endpoints (reference data) ───────────────────────────────
  else if (path.startsWith("/api/trpc/")) {
    const trpcPath = path.replace("/api/trpc/", "");
    
    // Reference data — cache at edge for 60s
    if (trpcPath.match(/^(ref\.|headerPrefs\.getPrefs|orbit\.getCategories)/)) {
      res.setHeader("Cache-Control", "public, max-age=60, s-maxage=60, stale-while-revalidate=120");
    }
    // Article stats — cache for 30s
    else if (trpcPath.match(/^(articles\.stats|intel\.regionThreatSummary)/)) {
      res.setHeader("Cache-Control", "public, max-age=30, s-maxage=30, stale-while-revalidate=60");
    }
    // Live data — never cache
    else if (trpcPath.match(/^(sigint\.|orbit\.getAllPositions|orbit\.getGroundTrack)/)) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    }
    // Mutations — never cache
    else if (req.method === "POST") {
      res.setHeader("Cache-Control", "no-store");
    }
    // Default API — short cache
    else {
      res.setHeader("Cache-Control", "private, max-age=10, must-revalidate");
    }
  }

  // ─── SSE streams — never cache ─────────────────────────────────────────────
  else if (path.startsWith("/api/live-stream") || path.startsWith("/api/crawl-stream")) {
    // SSE headers are already set in the endpoint handler
  }

  // ─── Other API routes — no cache ───────────────────────────────────────────
  else if (path.startsWith("/api/")) {
    res.setHeader("Cache-Control", "no-store");
  }

  next();
}

/**
 * Security headers middleware — adds standard security headers.
 * These also help with Cloudflare's security features.
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  // Don't set HSTS here — let Cloudflare handle it at the edge
  next();
}

/**
 * Compression hint headers — tell Cloudflare what to compress
 */
export function compressionHintsMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Cloudflare auto-compresses text-based responses, but we can hint
  const path = req.path;
  if (path.endsWith(".json") || path.startsWith("/api/trpc/")) {
    res.setHeader("Vary", "Accept-Encoding");
  }
  next();
}
