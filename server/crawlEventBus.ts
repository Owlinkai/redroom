/**
 * crawlEventBus — in-memory event emitter for real-time crawl pipeline events.
 *
 * Every article that flows through the crawler emits a sequence of events:
 *   fetch_start  → HTTP fetch initiated for an RSS feed
 *   fetch_ok     → Feed fetched successfully (N items found)
 *   fetch_fail   → Feed fetch failed
 *   parse_item   → An individual article item parsed from the feed
 *   enrich_start → LLM enrichment started for an article
 *   enrich_done  → LLM enrichment completed
 *   db_insert    → Article inserted into the database (new)
 *   db_dup       → Article skipped (duplicate URL)
 *   job_start    → A crawl job started
 *   job_done     → A crawl job completed
 *   job_fail     → A crawl job failed
 *
 * SSE clients subscribe to this bus and receive events as they happen.
 * Events are also stored in a rolling buffer for polling clients.
 */
import { EventEmitter } from "events";

export type PipelineStage =
  | "fetch_start"
  | "fetch_ok"
  | "fetch_fail"
  | "parse_item"
  | "enrich_start"
  | "enrich_done"
  | "db_insert"
  | "db_dup"
  | "job_start"
  | "job_done"
  | "job_fail";

export interface PipelineEvent {
  id: string;           // unique event id (timestamp + random)
  ts: number;           // unix ms
  stage: PipelineStage;
  jobId: number;
  agencyId: number;
  agencyName: string;
  articleTitle?: string;
  articleUrl?: string;
  feedUrl?: string;
  itemsFound?: number;
  articlesNew?: number;
  error?: string;
  region?: string;
  topics?: string[];
}

class CrawlEventBus extends EventEmitter {
  private buffer: PipelineEvent[] = [];
  private readonly MAX_BUFFER = 500;

  emit(event: "pipeline", data: PipelineEvent): boolean;
  emit(event: string, ...args: unknown[]): boolean {
    return super.emit(event, ...args);
  }

  publish(data: Omit<PipelineEvent, "id" | "ts">) {
    const event: PipelineEvent = {
      ...data,
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      ts: Date.now(),
    };
    // Add to rolling buffer
    this.buffer.push(event);
    if (this.buffer.length > this.MAX_BUFFER) {
      this.buffer.splice(0, this.buffer.length - this.MAX_BUFFER);
    }
    super.emit("pipeline", event);
    return event;
  }

  /** Get recent events, optionally filtered by jobId or since a timestamp */
  getRecent(opts?: { since?: number; jobId?: number; limit?: number }): PipelineEvent[] {
    let events = this.buffer;
    if (opts?.since) events = events.filter(e => e.ts > opts.since!);
    if (opts?.jobId !== undefined) events = events.filter(e => e.jobId === opts.jobId);
    if (opts?.limit) events = events.slice(-opts.limit);
    return events;
  }

  /** Clear all buffered events */
  clear() {
    this.buffer = [];
  }
}

// Singleton — shared across all imports
export const crawlEventBus = new CrawlEventBus();
crawlEventBus.setMaxListeners(200); // allow many SSE clients
