import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import { formatNumber, formatPrice } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface RawTrade {
  event_type: "fulfill_taker" | "fulfill_maker";
  price: string;
  amount: string;
  side: "open_long" | "open_short" | "close_long" | "close_short";
  cause: "normal" | "liquidation";
  created_at: number;
}

interface LiqEvent {
  id: string;
  symbol: string;
  price: number;
  size: number;
  notional: number;
  side: RawTrade["side"];
  timestamp: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const API = "https://api.pacifica.fi/api/v1";
const POLL_INTERVAL = 5_000;
const ONE_HOUR = 60 * 60 * 1_000;
const MEGA_LIQ_THRESHOLD = 50_000;
const LARGE_LIQ_THRESHOLD = 10_000;
const TOP_SYMBOLS_COUNT = 10;

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function isLongLiquidation(side: RawTrade["side"]): boolean {
  return side === "close_long";
}

function liqSideLabel(side: RawTrade["side"]): {
  text: string;
  colorClass: string;
} {
  if (isLongLiquidation(side)) {
    return { text: "LONG LIQUIDATED", colorClass: "text-down" };
  }
  return { text: "SHORT LIQUIDATED", colorClass: "text-up" };
}

/** Explosion dot size based on notional USD value. */
function explosionSize(notional: number): number {
  if (notional >= 100_000) return 20;
  if (notional >= 50_000) return 16;
  if (notional >= 25_000) return 12;
  if (notional >= 10_000) return 9;
  if (notional >= 5_000) return 7;
  return 5;
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  sub,
  colorClass,
  icon,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  colorClass?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <p className="text-[11px] text-muted uppercase tracking-wider mb-1 flex items-center gap-1.5 font-medium">
        {icon}
        {label}
      </p>
      <p
        className={`text-lg font-bold font-mono tabular-nums ${colorClass ?? "text-fg"}`}
      >
        {value}
      </p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function LiqFeedRow({
  event,
  isNew,
}: {
  event: LiqEvent;
  isNew?: boolean;
}) {
  const { text, colorClass } = liqSideLabel(event.side);
  const isMega = event.notional >= MEGA_LIQ_THRESHOLD;
  const dotSize = explosionSize(event.notional);

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-[background-color] duration-150 hover:bg-card-hover row-glow ${
        isNew ? "trade-enter" : ""
      } ${
        isMega
          ? "border-l-4 border-warn bg-warn/5 animate-[pulse_2s_ease-in-out_infinite]"
          : "border-l-4 border-transparent"
      }`}
    >
      {/* Explosion dot */}
      <div className="shrink-0 flex items-center justify-center w-6">
        <span
          className={`rounded-full ${
            isLongLiquidation(event.side) ? "bg-down" : "bg-up"
          } ${isMega ? "animate-pulse-glow" : ""}`}
          style={{
            width: dotSize,
            height: dotSize,
            boxShadow: isMega
              ? `0 0 ${dotSize}px ${isLongLiquidation(event.side) ? "rgba(239,68,68,0.6)" : "rgba(34,197,94,0.6)"}`
              : undefined,
          }}
        />
      </div>

      {/* Time */}
      <span className="text-[11px] font-mono tabular-nums text-muted w-[60px] shrink-0">
        {formatTime(event.timestamp)}
      </span>

      {/* Symbol */}
      <span className="text-xs font-mono font-semibold text-fg w-[56px] shrink-0">
        {event.symbol}
      </span>

      {/* Side badge */}
      <span className={`text-[10px] font-bold text-warn shrink-0`}>
        {text}
      </span>

      {/* MEGA LIQ badge */}
      {isMega && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warn/20 text-warn shrink-0 uppercase tracking-wider border border-warn/30 animate-pulse-glow">
          MEGA LIQ
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Price */}
      <span className="text-xs font-mono tabular-nums text-fg shrink-0">
        ${formatPrice(event.price)}
      </span>

      {/* Size */}
      <span
        className={`text-xs font-mono tabular-nums font-medium w-[80px] text-right shrink-0 ${
          isMega ? "text-warn" : colorClass
        }`}
      >
        ${formatNumber(event.notional)}
      </span>
    </div>
  );
}

function HeatmapBar({
  symbol,
  longVol,
  shortVol,
  maxVol,
}: {
  symbol: string;
  longVol: number;
  shortVol: number;
  maxVol: number;
}) {
  const total = longVol + shortVol;
  if (total === 0 || maxVol === 0) return null;
  const widthPct = (total / maxVol) * 100;
  const longPct = (longVol / total) * 100;
  const shortPct = (shortVol / total) * 100;

  return (
    <div className="flex items-center gap-3 py-1">
      <span className="text-xs font-mono font-medium text-fg w-[56px] shrink-0 text-right">
        {symbol}
      </span>
      <div className="flex-1 flex items-center">
        <div
          className="flex h-5 rounded overflow-hidden transition-all duration-500"
          style={{ width: `${Math.max(widthPct, 4)}%` }}
        >
          {longPct > 0 && (
            <div
              className="bg-down/80 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${longPct}%` }}
            >
              {longPct >= 30 && total >= 1000 && (
                <span className="text-[9px] font-mono font-bold text-white/80">
                  L
                </span>
              )}
            </div>
          )}
          {shortPct > 0 && (
            <div
              className="bg-up/80 transition-all duration-500 flex items-center justify-center"
              style={{ width: `${shortPct}%` }}
            >
              {shortPct >= 30 && total >= 1000 && (
                <span className="text-[9px] font-mono font-bold text-white/80">
                  S
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      <span className="text-[10px] font-mono tabular-nums text-muted w-[64px] text-right shrink-0">
        ${formatNumber(total)}
      </span>
    </div>
  );
}

function AlertCard({ event }: { event: LiqEvent }) {
  const { text, colorClass } = liqSideLabel(event.side);
  const isMega = event.notional >= MEGA_LIQ_THRESHOLD;

  return (
    <div
      className={`card-enter flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
        isMega
          ? "border-warn/50 bg-warn/5"
          : isLongLiquidation(event.side)
            ? "border-down/30 bg-down/5"
            : "border-up/30 bg-up/5"
      }`}
    >
      {/* Icon */}
      <div className="text-warn text-lg shrink-0">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-fg text-sm">
            {event.symbol}
          </span>
          <span className={`text-[10px] font-bold ${colorClass}`}>
            {text}
          </span>
          {isMega && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warn/15 text-warn uppercase tracking-wider">
              MEGA LIQ
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted font-mono mt-0.5">
          {formatTime(event.timestamp)} @ ${formatPrice(event.price)}
        </p>
      </div>

      <span
        className={`font-mono tabular-nums font-bold text-base shrink-0 ${
          isMega ? "text-warn" : colorClass
        }`}
      >
        ${formatNumber(event.notional)}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function Liquidations() {
  const { prices } = usePacificaPrices();

  const [liqEvents, setLiqEvents] = useState<LiqEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const seenIdsRef = useRef(new Set<string>());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  /* ---- Determine top 10 symbols by 24h volume from WS data ---- */
  const topSymbols = useMemo(() => {
    const entries = Object.values(prices);
    if (entries.length === 0) return [] as string[];
    return entries
      .slice()
      .sort(
        (a, b) =>
          (parseFloat(b.volume_24h) || 0) - (parseFloat(a.volume_24h) || 0),
      )
      .slice(0, TOP_SYMBOLS_COUNT)
      .map((p) => p.symbol);
  }, [prices]);

  /* ---- Fetch trades for all top symbols and extract liquidations ---- */
  const pollLiquidations = useCallback(async () => {
    if (topSymbols.length === 0) return;
    try {
      const results = await Promise.allSettled(
        topSymbols.map(async (symbol) => {
          const res = await fetch(
            `${API}/trades?symbol=${symbol}&limit=100`,
          );
          const json = await res.json();
          if (json.success && Array.isArray(json.data)) {
            return { symbol, trades: json.data as RawTrade[] };
          }
          return { symbol, trades: [] as RawTrade[] };
        }),
      );

      const newEvents: LiqEvent[] = [];

      for (const result of results) {
        if (result.status !== "fulfilled") continue;
        const { symbol, trades } = result.value;

        for (const t of trades) {
          if (t.cause !== "liquidation") continue;
          if (t.event_type !== "fulfill_taker") continue;

          const id = `${symbol}-${t.created_at}-${t.price}-${t.amount}-${t.side}`;
          if (seenIdsRef.current.has(id)) continue;
          seenIdsRef.current.add(id);

          const price = parseFloat(t.price);
          const amount = parseFloat(t.amount);

          newEvents.push({
            id,
            symbol,
            price,
            size: amount,
            notional: price * amount,
            side: t.side,
            timestamp: t.created_at,
          });
        }
      }

      if (newEvents.length > 0) {
        setLiqEvents((prev) => {
          const merged = [...newEvents, ...prev];
          merged.sort((a, b) => b.timestamp - a.timestamp);
          return merged;
        });

        // Auto-scroll feed to top
        if (feedRef.current) {
          feedRef.current.scrollTop = 0;
        }
      }

      setLastUpdated(Date.now());
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [topSymbols]);

  /* ---- Start polling when top symbols are available ---- */
  useEffect(() => {
    if (topSymbols.length === 0) return;
    // Initial fetch
    pollLiquidations();
  }, [topSymbols.length > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ---- Auto-refresh every 5 seconds ---- */
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefresh && topSymbols.length > 0) {
      intervalRef.current = setInterval(pollLiquidations, POLL_INTERVAL);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, pollLiquidations, topSymbols.length]);

  /* ---- Computed stats (last 1 hour) ---- */
  const hourAgo = Date.now() - ONE_HOUR;

  const recentEvents = useMemo(
    () => liqEvents.filter((e) => e.timestamp >= hourAgo),
    [liqEvents, hourAgo],
  );

  const stats = useMemo(() => {
    let totalVolume = 0;
    let largestSingle = 0;
    let longCount = 0;
    let shortCount = 0;
    const volBySymbol: Record<string, number> = {};

    for (const e of recentEvents) {
      totalVolume += e.notional;
      if (e.notional > largestSingle) largestSingle = e.notional;
      if (isLongLiquidation(e.side)) {
        longCount++;
      } else {
        shortCount++;
      }
      volBySymbol[e.symbol] = (volBySymbol[e.symbol] ?? 0) + e.notional;
    }

    let mostLiqSymbol = "---";
    let maxSymVol = 0;
    for (const [sym, vol] of Object.entries(volBySymbol)) {
      if (vol > maxSymVol) {
        maxSymVol = vol;
        mostLiqSymbol = sym;
      }
    }

    const totalCount = longCount + shortCount;
    const longPct = totalCount > 0 ? (longCount / totalCount) * 100 : 50;
    const shortPct = totalCount > 0 ? (shortCount / totalCount) * 100 : 50;

    return {
      totalCount: recentEvents.length,
      totalVolume,
      largestSingle,
      mostLiqSymbol,
      longCount,
      shortCount,
      longPct,
      shortPct,
    };
  }, [recentEvents]);

  /* ---- Heatmap data ---- */
  const heatmapData = useMemo(() => {
    const map: Record<string, { longVol: number; shortVol: number }> = {};
    for (const e of recentEvents) {
      if (!map[e.symbol]) map[e.symbol] = { longVol: 0, shortVol: 0 };
      if (isLongLiquidation(e.side)) {
        map[e.symbol].longVol += e.notional;
      } else {
        map[e.symbol].shortVol += e.notional;
      }
    }
    return Object.entries(map)
      .map(([symbol, data]) => ({
        symbol,
        ...data,
        total: data.longVol + data.shortVol,
      }))
      .sort((a, b) => b.total - a.total);
  }, [recentEvents]);

  const heatmapMax = useMemo(
    () => Math.max(...heatmapData.map((d) => d.total), 1),
    [heatmapData],
  );

  /* ---- Large liquidation alerts (>$10K) ---- */
  const alertEvents = useMemo(
    () =>
      recentEvents
        .filter((e) => e.notional >= LARGE_LIQ_THRESHOLD)
        .slice(0, 10),
    [recentEvents],
  );

  /* ---- Track new events for animation ---- */
  const prevEventCountRef = useRef(0);
  const newEventCount =
    liqEvents.length > prevEventCountRef.current
      ? liqEvents.length - prevEventCountRef.current
      : 0;
  useEffect(() => {
    prevEventCountRef.current = liqEvents.length;
  }, [liqEvents.length]);

  /* ---- Render ---- */
  return (
    <div className="space-y-5 page-enter">
      {/* ---------- Header Controls ---------- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-fg font-semibold text-lg flex items-center gap-2">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-warn"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Liquidation Monitor
          </h1>
          {loading && (
            <div className="w-4 h-4 border-2 border-warn border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-[10px] text-muted font-mono tabular-nums">
              Updated {formatTime(lastUpdated)}
            </span>
          )}
          <button
            onClick={() => setAutoRefresh((p) => !p)}
            className={`press-scale flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-all duration-200 ${
              autoRefresh
                ? "border-warn/30 bg-warn/10 text-warn shadow-[0_0_8px_rgba(234,179,8,0.15)]"
                : "border-border bg-card text-muted hover:text-fg hover:border-border/80"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autoRefresh ? "bg-warn live-pulse" : "bg-muted"
              }`}
            />
            {autoRefresh ? "LIVE" : "PAUSED"}
          </button>
        </div>
      </div>

      {/* ---------- Header Stats ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard
          label="Total Liquidations"
          value={String(stats.totalCount)}
          sub="Last 1 hour"
          colorClass={stats.totalCount > 0 ? "text-warn" : "text-muted"}
          icon={
            <svg
              className="w-3 h-3 text-warn"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          }
        />
        <StatCard
          label="Liq Volume"
          value={`$${formatNumber(stats.totalVolume)}`}
          sub="Last 1 hour (USD)"
          colorClass="text-warn"
          icon={
            <svg
              className="w-3 h-3 text-warn"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
            </svg>
          }
        />
        <StatCard
          label="Largest Single"
          value={
            stats.largestSingle > 0
              ? `$${formatNumber(stats.largestSingle)}`
              : "---"
          }
          sub="Biggest liquidation event"
          colorClass={
            stats.largestSingle >= MEGA_LIQ_THRESHOLD
              ? "text-warn"
              : "text-fg"
          }
          icon={
            <svg
              className="w-3 h-3 text-down"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 20V10M18 20V4M6 20v-4" />
            </svg>
          }
        />
        <StatCard
          label="Most Liquidated"
          value={stats.mostLiqSymbol}
          sub="By total volume"
          colorClass="text-accent"
          icon={
            <svg
              className="w-3 h-3 text-accent"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v8M8 12h8" />
            </svg>
          }
        />
        <StatCard
          label="Long / Short"
          value={
            <span>
              <span className="text-down">{stats.longPct.toFixed(0)}%</span>
              <span className="text-muted mx-1">/</span>
              <span className="text-up">{stats.shortPct.toFixed(0)}%</span>
            </span>
          }
          sub={`${stats.longCount}L / ${stats.shortCount}S liquidated`}
          icon={
            <svg
              className="w-3 h-3 text-muted"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          }
        />
      </div>

      {/* ---------- Long/Short Pressure Bar ---------- */}
      {stats.totalCount > 0 && (
        <div className="stat-card">
          <div className="flex items-center justify-between text-xs text-muted mb-2">
            <span className="text-down font-mono font-medium">
              LONG LIQ {stats.longPct.toFixed(1)}%
            </span>
            <span className="text-[11px] uppercase tracking-wider">
              Liquidation Bias
            </span>
            <span className="text-up font-mono font-medium">
              SHORT LIQ {stats.shortPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex h-6 rounded-full overflow-hidden bg-border">
            <div
              className="bg-down transition-all duration-500"
              style={{ width: `${stats.longPct}%` }}
            />
            <div
              className="bg-up transition-all duration-500"
              style={{ width: `${stats.shortPct}%` }}
            />
          </div>
        </div>
      )}

      {/* ---------- Main Content: Feed + Heatmap ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Liquidation Feed */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-fg font-semibold text-sm flex items-center gap-2">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-warn"
              >
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              Liquidation Feed
            </h2>
            <span className="text-[10px] text-muted font-mono tabular-nums">
              {liqEvents.length} event{liqEvents.length !== 1 ? "s" : ""}{" "}
              tracked
            </span>
          </div>
          <div
            ref={feedRef}
            className="overflow-y-auto max-h-[520px] p-2 space-y-0.5 scroll-fade"
          >
            {liqEvents.length > 0 ? (
              liqEvents.map((e, i) => (
                <LiqFeedRow
                  key={e.id}
                  event={e}
                  isNew={i < newEventCount}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-muted text-sm gap-2">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-warn border-t-transparent rounded-full animate-spin" />
                    <span>Scanning markets for liquidations...</span>
                  </>
                ) : topSymbols.length === 0 ? (
                  <span>Waiting for market data...</span>
                ) : (
                  <span>No liquidations detected yet. Monitoring...</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Heatmap + Info Column */}
        <div className="space-y-4">
          {/* Liquidation Heatmap */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-fg font-semibold text-sm">
                Liquidation Heatmap
              </h2>
              <p className="text-[10px] text-muted mt-0.5">
                Volume per symbol (1h)
              </p>
            </div>
            <div className="px-4 py-3 space-y-0.5">
              {heatmapData.length > 0 ? (
                <>
                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-2 text-[10px]">
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-down/80" />
                      <span className="text-muted">Long Liq</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-2.5 h-2.5 rounded-sm bg-up/80" />
                      <span className="text-muted">Short Liq</span>
                    </span>
                  </div>
                  {heatmapData.map((d) => (
                    <HeatmapBar
                      key={d.symbol}
                      symbol={d.symbol}
                      longVol={d.longVol}
                      shortVol={d.shortVol}
                      maxVol={heatmapMax}
                    />
                  ))}
                </>
              ) : (
                <p className="text-muted text-xs text-center py-6">
                  No heatmap data yet
                </p>
              )}
            </div>
          </div>

          {/* Monitoring info card */}
          <div className="stat-card">
            <h3 className="text-[11px] text-muted uppercase tracking-wider mb-3">
              Monitoring
            </h3>
            <div className="space-y-1.5">
              {topSymbols.length > 0 ? (
                topSymbols.map((sym) => (
                  <div
                    key={sym}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-up live-pulse" />
                    <span className="font-mono text-fg">{sym}</span>
                  </div>
                ))
              ) : (
                <p className="text-muted text-xs">
                  Loading symbol list...
                </p>
              )}
            </div>
            <p className="text-[10px] text-muted mt-3">
              Top {TOP_SYMBOLS_COUNT} by 24h volume, polled every{" "}
              {POLL_INTERVAL / 1_000}s
            </p>
          </div>
        </div>
      </div>

      {/* ---------- Liquidation Alerts Log ---------- */}
      {alertEvents.length > 0 && (
        <section>
          <h2 className="text-fg font-semibold text-sm mb-2 flex items-center gap-2">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-warn"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Large Liquidation Alerts
            <span className="text-[10px] text-muted font-normal">
              (&gt;$10K)
            </span>
            <span className="text-warn font-mono text-xs">
              {alertEvents.length}
            </span>
          </h2>
          <div className="space-y-2">
            {alertEvents.map((e) => (
              <AlertCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Footer ---------- */}
      <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted">
        <span>
          Data sourced from{" "}
          <span className="text-accent font-medium">Pacifica REST API</span>{" "}
          | Monitoring {topSymbols.length} symbols
        </span>
        <span className="font-mono tabular-nums">
          {autoRefresh
            ? `Auto-refresh ${POLL_INTERVAL / 1_000}s`
            : "Refresh paused"}
        </span>
      </div>
    </div>
  );
}
