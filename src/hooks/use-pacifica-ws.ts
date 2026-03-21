import { useEffect, useRef, useState, useCallback } from "react";
import type { PriceData } from "@/lib/types";

const WS_URL = "wss://ws.pacifica.fi/ws";
const PING_INTERVAL = 25_000;
const RECONNECT_DELAY = 3_000;

export function usePacificaPrices() {
  const [prices, setPrices] = useState<Record<string, PriceData>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const pingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountedRef.current) return;
      setConnected(true);
      ws.send(JSON.stringify({ method: "subscribe", params: { source: "prices" } }));
      pingRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ method: "ping" }));
        }
      }, PING_INTERVAL);
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);
        if (msg.channel === "prices" && Array.isArray(msg.data)) {
          setPrices((prev) => {
            const next = { ...prev };
            for (const item of msg.data) {
              next[item.symbol] = item;
            }
            return next;
          });
        }
      } catch {
        // ignore parse errors
      }
    };

    ws.onclose = () => {
      if (!mountedRef.current) return;
      setConnected(false);
      if (pingRef.current) clearInterval(pingRef.current);
      setTimeout(connect, RECONNECT_DELAY);
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    connect();
    return () => {
      mountedRef.current = false;
      if (pingRef.current) clearInterval(pingRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { prices, connected };
}
