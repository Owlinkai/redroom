/**
 * useLiveStream — Client-side hook for Server-Sent Events (SSE)
 * 
 * Replaces polling with push-based real-time updates.
 * The server broadcasts data snapshots every few seconds;
 * this hook subscribes to specific channels and provides
 * the latest data to consuming components.
 * 
 * Usage:
 *   const { data, connected, error } = useLiveStream<AviationData>('sigint:aviation');
 *   const { data: orbitData } = useLiveStream<OrbitData>('orbit:positions');
 */

import { useState, useEffect, useRef, useCallback } from "react";

export type SSEChannel =
  | "sigint:aviation"
  | "sigint:maritime"
  | "orbit:positions"
  | "intel:stats";

interface LiveStreamState<T> {
  data: T | null;
  connected: boolean;
  error: string | null;
  lastUpdate: number | null;
}

interface UseLiveStreamOptions {
  /** Whether the stream should be active (default: true) */
  enabled?: boolean;
  /** Reconnect delay in ms after disconnect (default: 3000) */
  reconnectDelay?: number;
  /** Max reconnect attempts before giving up (default: 10) */
  maxReconnects?: number;
  /** Fallback polling function if SSE fails */
  fallbackFetch?: () => Promise<any>;
  /** Fallback polling interval in ms (default: 10000) */
  fallbackInterval?: number;
}

export function useLiveStream<T = any>(
  channel: SSEChannel | SSEChannel[],
  options: UseLiveStreamOptions = {}
): LiveStreamState<T> & { reconnect: () => void } {
  const {
    enabled = true,
    reconnectDelay = 3000,
    maxReconnects = 10,
    fallbackFetch,
    fallbackInterval = 10000,
  } = options;

  const [state, setState] = useState<LiveStreamState<T>>({
    data: null,
    connected: false,
    error: null,
    lastUpdate: null,
  });

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const channels = Array.isArray(channel) ? channel : [channel];
  const channelsKey = channels.sort().join(",");

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (fallbackTimerRef.current) {
      clearInterval(fallbackTimerRef.current);
      fallbackTimerRef.current = null;
    }
  }, []);

  const startFallbackPolling = useCallback(() => {
    if (!fallbackFetch || fallbackTimerRef.current) return;
    console.log(`[SSE] Falling back to polling for: ${channelsKey}`);
    
    // Immediate first fetch
    fallbackFetch().then((data) => {
      if (mountedRef.current) {
        setState((prev) => ({ ...prev, data, lastUpdate: Date.now() }));
      }
    }).catch(() => {});

    fallbackTimerRef.current = setInterval(() => {
      fallbackFetch!().then((data) => {
        if (mountedRef.current) {
          setState((prev) => ({ ...prev, data, lastUpdate: Date.now() }));
        }
      }).catch(() => {});
    }, fallbackInterval);
  }, [fallbackFetch, fallbackInterval, channelsKey]);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;
    cleanup();

    const url = `/api/live-stream?channels=${encodeURIComponent(channelsKey)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      reconnectCountRef.current = 0;
      setState((prev) => ({ ...prev, connected: true, error: null }));
      // Stop fallback polling if SSE reconnects
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    // Listen for each channel's events
    channels.forEach((ch) => {
      es.addEventListener(ch, (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data) as T;
          setState((prev) => ({
            ...prev,
            data: parsed,
            lastUpdate: Date.now(),
            error: null,
          }));
        } catch (e) {
          console.warn(`[SSE] Failed to parse ${ch} data:`, e);
        }
      });
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      eventSourceRef.current = null;
      setState((prev) => ({ ...prev, connected: false }));

      if (reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++;
        const delay = reconnectDelay * Math.min(reconnectCountRef.current, 5);
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      } else {
        setState((prev) => ({
          ...prev,
          error: "Max reconnection attempts reached. Using fallback polling.",
        }));
        startFallbackPolling();
      }
    };
  }, [enabled, channelsKey, cleanup, reconnectDelay, maxReconnects, startFallbackPolling]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) {
      connect();
    }
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, channelsKey]);

  const reconnect = useCallback(() => {
    reconnectCountRef.current = 0;
    connect();
  }, [connect]);

  return { ...state, reconnect };
}

/**
 * useMultiChannelStream — Subscribe to multiple channels and get data per channel
 */
export function useMultiChannelStream(
  channels: SSEChannel[],
  options: UseLiveStreamOptions = {}
) {
  const { enabled = true, reconnectDelay = 3000, maxReconnects = 10 } = options;

  const [dataMap, setDataMap] = useState<Record<string, any>>({});
  const [connected, setConnected] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  const channelsKey = channels.sort().join(",");

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (!enabled || !mountedRef.current) return;
    cleanup();

    const url = `/api/live-stream?channels=${encodeURIComponent(channelsKey)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onopen = () => {
      if (!mountedRef.current) return;
      reconnectCountRef.current = 0;
      setConnected(true);
    };

    channels.forEach((ch) => {
      es.addEventListener(ch, (event: MessageEvent) => {
        if (!mountedRef.current) return;
        try {
          const parsed = JSON.parse(event.data);
          setDataMap((prev) => ({ ...prev, [ch]: parsed }));
        } catch (e) {
          console.warn(`[SSE] Failed to parse ${ch}:`, e);
        }
      });
    });

    es.onerror = () => {
      if (!mountedRef.current) return;
      es.close();
      eventSourceRef.current = null;
      setConnected(false);

      if (reconnectCountRef.current < maxReconnects) {
        reconnectCountRef.current++;
        const delay = reconnectDelay * Math.min(reconnectCountRef.current, 5);
        reconnectTimerRef.current = setTimeout(() => {
          if (mountedRef.current) connect();
        }, delay);
      }
    };
  }, [enabled, channelsKey, cleanup, reconnectDelay, maxReconnects]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled) connect();
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [enabled, channelsKey]);

  return { dataMap, connected };
}
