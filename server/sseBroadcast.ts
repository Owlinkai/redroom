/**
 * SSE Broadcast Hub
 * 
 * Manages Server-Sent Event connections for real-time data push.
 * Instead of 200K clients each polling every 5-10s (= 20-40K req/s),
 * clients open ONE persistent SSE connection and receive push updates.
 * 
 * Channels:
 * - sigint:aviation — aircraft positions (every 5s)
 * - sigint:maritime — vessel positions (every 5s)
 * - orbit:positions — satellite positions (every 10s)
 * - intel:stats — article stats + threat level (every 30s)
 */

import type { Response } from "express";

interface SSEClient {
  id: string;
  res: Response;
  channels: Set<string>;
  connectedAt: number;
  lastPing: number;
}

class SSEBroadcastHub {
  private clients = new Map<string, SSEClient>();
  private channelSubscribers = new Map<string, Set<string>>(); // channel -> client IDs
  private clientIdCounter = 0;

  /**
   * Register a new SSE client connection
   */
  addClient(res: Response, channels: string[]): string {
    const id = `sse_${++this.clientIdCounter}_${Date.now()}`;
    const client: SSEClient = {
      id,
      res,
      channels: new Set(channels),
      connectedAt: Date.now(),
      lastPing: Date.now(),
    };

    this.clients.set(id, client);

    // Register in channel subscriber maps
    for (const channel of channels) {
      if (!this.channelSubscribers.has(channel)) {
        this.channelSubscribers.set(channel, new Set());
      }
      this.channelSubscribers.get(channel)!.add(id);
    }

    return id;
  }

  /**
   * Remove a client (on disconnect)
   */
  removeClient(id: string): void {
    const client = this.clients.get(id);
    if (!client) return;

    // Remove from channel subscriber maps
    for (const channel of Array.from(client.channels)) {
      const subs = this.channelSubscribers.get(channel);
      if (subs) {
        subs.delete(id);
        if (subs.size === 0) {
          this.channelSubscribers.delete(channel);
        }
      }
    }

    this.clients.delete(id);
  }

  /**
   * Broadcast data to all clients subscribed to a channel.
   * Uses chunked writes for efficiency.
   */
  broadcast(channel: string, data: any): void {
    const subs = this.channelSubscribers.get(channel);
    if (!subs || subs.size === 0) return;

    const payload = `event: ${channel}\ndata: ${JSON.stringify(data)}\n\n`;
    const deadClients: string[] = [];

    for (const clientId of Array.from(subs)) {
      const client = this.clients.get(clientId);
      if (!client) {
        deadClients.push(clientId);
        continue;
      }

      try {
        const ok = client.res.write(payload);
        if (typeof (client.res as any).flush === "function") {
          (client.res as any).flush();
        }
        if (!ok) {
          // Backpressure — client can't keep up, disconnect them
          deadClients.push(clientId);
        }
      } catch {
        deadClients.push(clientId);
      }
    }

    // Clean up dead clients
    for (const id of deadClients) {
      this.removeClient(id);
    }
  }

  /**
   * Send heartbeat to all connected clients (keeps connections alive through proxies)
   */
  heartbeat(): void {
    const deadClients: string[] = [];
    const payload = `: heartbeat ${Date.now()}\n\n`;

    for (const [id, client] of Array.from(this.clients.entries())) {
      try {
        client.res.write(payload);
        if (typeof (client.res as any).flush === "function") {
          (client.res as any).flush();
        }
        client.lastPing = Date.now();
      } catch {
        deadClients.push(id);
      }
    }

    for (const id of deadClients) {
      this.removeClient(id);
    }
  }

  /**
   * Get connection stats
   */
  getStats(): {
    totalClients: number;
    channels: Record<string, number>;
    oldestConnection: number;
  } {
    const channels: Record<string, number> = {};
    for (const [ch, subs] of Array.from(this.channelSubscribers.entries())) {
      channels[ch] = subs.size;
    }

    let oldest = Date.now();
    for (const client of Array.from(this.clients.values())) {
      if (client.connectedAt < oldest) oldest = client.connectedAt;
    }

    return {
      totalClients: this.clients.size,
      channels,
      oldestConnection: oldest,
    };
  }

  /**
   * Get total number of connected clients
   */
  getClientCount(): number {
    return this.clients.size;
  }
}

// Singleton
export const sseHub = new SSEBroadcastHub();

// Heartbeat every 15s to keep connections alive through Cloudflare/proxies
setInterval(() => sseHub.heartbeat(), 15000);

// ─── Channel Constants ───────────────────────────────────────────────────────

export const SSE_CHANNELS = {
  AVIATION: "sigint:aviation",
  MARITIME: "sigint:maritime",
  ORBIT_POSITIONS: "orbit:positions",
  INTEL_STATS: "intel:stats",
} as const;

export type SSEChannel = (typeof SSE_CHANNELS)[keyof typeof SSE_CHANNELS];
