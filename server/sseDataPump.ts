/**
 * SSE Data Pump
 * 
 * Server-side background loops that fetch upstream data at fixed intervals
 * and broadcast to all connected SSE clients.
 * 
 * This is the key scalability pattern:
 * - 1 upstream fetch every N seconds (regardless of client count)
 * - Broadcast result to all connected clients simultaneously
 * - 200K clients × 1 broadcast = same cost as 1 client
 */

import { sseHub, SSE_CHANNELS } from "./sseBroadcast";
import { cache, CacheKeys, TTL_STATS, TTL_POSITIONS } from "./cache";

// Track pump state
let pumpsStarted = false;

/**
 * Start all data pump loops.
 * Called once on server startup.
 */
export function startDataPumps(): void {
  if (pumpsStarted) return;
  pumpsStarted = true;

  console.log("[SSE Pump] Starting data broadcast pumps...");

  // ─── Aviation pump: every 5 seconds ─────────────────────────────────────────
  startAviationPump();

  // ─── Maritime pump: every 5 seconds ─────────────────────────────────────────
  startMaritimePump();

  // ─── Orbit positions pump: every 10 seconds ─────────────────────────────────
  startOrbitPump();

  // ─── Intel stats pump: every 30 seconds ─────────────────────────────────────
  startIntelStatsPump();
}

// ─── Aviation Pump ────────────────────────────────────────────────────────────

let aviationPumpInterval: ReturnType<typeof setInterval> | null = null;

function startAviationPump(): void {
  const INTERVAL = 5000; // 5 seconds

  const pump = async () => {
    // Only pump if there are subscribers
    const stats = sseHub.getStats();
    if (!stats.channels[SSE_CHANNELS.AVIATION]) return;

    try {
      // Import dynamically to avoid circular deps
      const { sigintRouter } = await import("./routers/sigint");
      // The sigint router already has internal caching (60s for aviation)
      // We just need to call the existing function and broadcast the result
      // Instead of calling the router, we call the cached function directly
      const { fetchAviationSnapshot } = await import("./sigintDataFetcher");
      const data = await fetchAviationSnapshot();
      if (data) {
        sseHub.broadcast(SSE_CHANNELS.AVIATION, data);
      }
    } catch (err) {
      console.error("[SSE Pump] Aviation fetch error:", err);
    }
  };

  // Initial fetch after 2s delay (let server fully start)
  setTimeout(pump, 2000);
  aviationPumpInterval = setInterval(pump, INTERVAL);
}

// ─── Maritime Pump ────────────────────────────────────────────────────────────

let maritimePumpInterval: ReturnType<typeof setInterval> | null = null;

function startMaritimePump(): void {
  const INTERVAL = 5000; // 5 seconds

  const pump = async () => {
    const stats = sseHub.getStats();
    if (!stats.channels[SSE_CHANNELS.MARITIME]) return;

    try {
      const { fetchMaritimeSnapshot } = await import("./sigintDataFetcher");
      const data = await fetchMaritimeSnapshot();
      if (data) {
        sseHub.broadcast(SSE_CHANNELS.MARITIME, data);
      }
    } catch (err) {
      console.error("[SSE Pump] Maritime fetch error:", err);
    }
  };

  setTimeout(pump, 3000);
  maritimePumpInterval = setInterval(pump, INTERVAL);
}

// ─── Orbit Positions Pump ─────────────────────────────────────────────────────

let orbitPumpInterval: ReturnType<typeof setInterval> | null = null;

function startOrbitPump(): void {
  const INTERVAL = 10000; // 10 seconds

  const pump = async () => {
    const stats = sseHub.getStats();
    if (!stats.channels[SSE_CHANNELS.ORBIT_POSITIONS]) return;

    try {
      const { fetchOrbitSnapshot } = await import("./sigintDataFetcher");
      const data = await fetchOrbitSnapshot();
      if (data) {
        sseHub.broadcast(SSE_CHANNELS.ORBIT_POSITIONS, data);
      }
    } catch (err) {
      console.error("[SSE Pump] Orbit fetch error:", err);
    }
  };

  setTimeout(pump, 4000);
  orbitPumpInterval = setInterval(pump, INTERVAL);
}

// ─── Intel Stats Pump ─────────────────────────────────────────────────────────

let intelPumpInterval: ReturnType<typeof setInterval> | null = null;

function startIntelStatsPump(): void {
  const INTERVAL = 30000; // 30 seconds

  const pump = async () => {
    const stats = sseHub.getStats();
    if (!stats.channels[SSE_CHANNELS.INTEL_STATS]) return;

    try {
      const { fetchIntelStatsSnapshot } = await import("./sigintDataFetcher");
      const data = await fetchIntelStatsSnapshot();
      if (data) {
        sseHub.broadcast(SSE_CHANNELS.INTEL_STATS, data);
      }
    } catch (err) {
      console.error("[SSE Pump] Intel stats fetch error:", err);
    }
  };

  setTimeout(pump, 5000);
  intelPumpInterval = setInterval(pump, INTERVAL);
}

/**
 * Stop all pumps (for graceful shutdown)
 */
export function stopDataPumps(): void {
  if (aviationPumpInterval) clearInterval(aviationPumpInterval);
  if (maritimePumpInterval) clearInterval(maritimePumpInterval);
  if (orbitPumpInterval) clearInterval(orbitPumpInterval);
  if (intelPumpInterval) clearInterval(intelPumpInterval);
  pumpsStarted = false;
}
