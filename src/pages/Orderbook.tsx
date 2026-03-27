import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import { LiveToggle } from "@/components/LiveBadge";
import { type MarketInfo, formatPrice, formatNumber } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface BookLevel {
  p: string;
  a: string;
  n: number;
}

interface BookData {
  s: string;
  l: [BookLevel[], BookLevel[]];
}

interface ProcessedLevel {
  price: number;
  size: number;
  total: number;
  orders: number;
  isWall: boolean;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = "https://api.pacifica.fi/api/v1";
const REFRESH_MS = 2_000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function processLevels(
  raw: BookLevel[],
  avgSize: number,
): ProcessedLevel[] {
  let cumulative = 0;
  return raw.map((lvl) => {
    const size = parseFloat(lvl.a);
    cumulative += size;
    return {
      price: parseFloat(lvl.p),
      size,
      total: cumulative,
      orders: lvl.n,
      isWall: size > avgSize * 2,
    };
  });
}

function fmtCompact(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (n >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (n >= 1e3) return (n / 1e3).toFixed(2) + "K";
  return n.toFixed(2);
}

function fmtBps(spread: number, mid: number): string {
  if (!mid) return "0.0";
  return ((spread / mid) * 10_000).toFixed(1);
}

/* ------------------------------------------------------------------ */
/*  Metric Card                                                        */
/* ------------------------------------------------------------------ */

function MetricCard({
  label,
  value,
  sub,
  color,
  className,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: "up" | "down" | "accent" | "fg";
  className?: string;
}) {
  const colorCls =
    color === "up"
      ? "text-up"
      : color === "down"
        ? "text-down"
        : color === "accent"
          ? "text-accent"
          : "text-fg";

  return (
    <div className={`stat-card flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
        {label}
      </span>
      <span className={`text-lg font-bold font-mono ${colorCls}`}>
        {value}
      </span>
      {sub && (
        <span className="text-[11px] text-muted font-mono">{sub}</span>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Imbalance Bar                                                      */
/* ------------------------------------------------------------------ */

function ImbalanceBar({ ratio }: { ratio: number }) {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  const bidDominant = pct > 60;
  const askDominant = pct < 40;
  return (
    <div className={`stat-card flex flex-col gap-2 ${bidDominant ? "" : askDominant ? "" : ""}`}>
      <span className="text-[11px] font-medium text-muted uppercase tracking-wider">
        Bid/Ask Imbalance
      </span>
      <div className="flex items-center gap-3">
        <span className="text-up font-mono text-base font-bold w-16 text-right">
          {pct.toFixed(1)}%
        </span>
        <div className="flex-1 h-8 rounded-full bg-down/20 overflow-hidden relative">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              background:
                "linear-gradient(90deg, #10b981 0%, #10b98188 100%)",
            }}
          />
          {/* Center tick */}
          <div className="absolute inset-y-0 left-1/2 w-px bg-fg/30" />
        </div>
        <span className="text-down font-mono text-base font-bold w-16">
          {(100 - pct).toFixed(1)}%
        </span>
      </div>
      <div className="flex justify-between text-[10px] text-muted">
        <span>Bids</span>
        <span>Asks</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Depth Chart (pure CSS)                                             */
/* ------------------------------------------------------------------ */

function DepthChart({
  bids,
  asks,
  midPrice,
}: {
  bids: ProcessedLevel[];
  asks: ProcessedLevel[];
  midPrice: number;
}) {
  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 0;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 0;
  const maxTotal = Math.max(maxBidTotal, maxAskTotal) || 1;

  // Show top N levels for the depth visualization
  const depthLevels = 25;
  const bidSlice = bids.slice(0, depthLevels);
  const askSlice = asks.slice(0, depthLevels);

  // Price range for display
  const lowestBid = bidSlice.length > 0 ? bidSlice[bidSlice.length - 1].price : midPrice;
  const highestAsk = askSlice.length > 0 ? askSlice[askSlice.length - 1].price : midPrice;

  return (
    <div className="section-card p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          Depth Chart
        </span>
        <div className="flex items-center gap-4 text-[11px] text-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-up/40" /> Bids
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-2 rounded-sm bg-down/40" /> Asks
          </span>
        </div>
      </div>

      {/* Depth visualization */}
      <div className="relative h-64 flex">
        {/* Bid side (right-aligned, grows left) */}
        <div className="flex-1 flex flex-col justify-center gap-px relative overflow-hidden">
          {bidSlice.map((lvl, i) => {
            const widthPct = (lvl.total / maxTotal) * 100;
            const opacity = 0.15 + (lvl.total / maxTotal) * 0.6;
            return (
              <div
                key={`bid-${i}`}
                className="h-full flex items-center justify-end relative"
              >
                {/* Fill bar from right */}
                <div
                  className="absolute right-0 top-0 bottom-0 rounded-l-sm transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(270deg, rgba(34,197,94,${opacity}) 0%, rgba(34,197,94,${opacity * 0.3}) 100%)`,
                  }}
                />
                {/* Price label */}
                <span className="relative z-10 text-[10px] font-mono text-up/80 pr-1.5 truncate">
                  {formatPrice(lvl.price)}
                </span>
              </div>
            );
          })}
          {/* Price axis label */}
          <div className="absolute bottom-0 left-1 text-[9px] text-muted font-mono">
            {formatPrice(lowestBid)}
          </div>
        </div>

        {/* Center line: mid price */}
        <div className="w-px bg-accent/40 relative flex-shrink-0 mx-1">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card border border-accent/60 rounded-lg px-2.5 py-1 whitespace-nowrap z-20">
            <span className="text-xs font-mono font-bold text-accent">
              ${formatPrice(midPrice)}
            </span>
          </div>
          {/* Vertical dashed line effect */}
          <div className="absolute inset-0 border-l border-dashed border-accent/20" />
        </div>

        {/* Ask side (left-aligned, grows right) */}
        <div className="flex-1 flex flex-col justify-center gap-px relative overflow-hidden">
          {askSlice.map((lvl, i) => {
            const widthPct = (lvl.total / maxTotal) * 100;
            const opacity = 0.15 + (lvl.total / maxTotal) * 0.6;
            return (
              <div
                key={`ask-${i}`}
                className="h-full flex items-center relative"
              >
                {/* Fill bar from left */}
                <div
                  className="absolute left-0 top-0 bottom-0 rounded-r-sm transition-all duration-300"
                  style={{
                    width: `${widthPct}%`,
                    background: `linear-gradient(90deg, rgba(239,68,68,${opacity}) 0%, rgba(239,68,68,${opacity * 0.3}) 100%)`,
                  }}
                />
                {/* Price label */}
                <span className="relative z-10 text-[10px] font-mono text-down/80 pl-1.5 truncate">
                  {formatPrice(lvl.price)}
                </span>
              </div>
            );
          })}
          {/* Price axis label */}
          <div className="absolute bottom-0 right-1 text-[9px] text-muted font-mono">
            {formatPrice(highestAsk)}
          </div>
        </div>
      </div>

      {/* Size axis label */}
      <div className="flex justify-between mt-1 text-[9px] text-muted font-mono">
        <span>{fmtCompact(maxTotal)}</span>
        <span>Cumulative Size</span>
        <span>{fmtCompact(maxTotal)}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Orderbook Table                                                    */
/* ------------------------------------------------------------------ */

function OrderbookTable({
  bids,
  asks,
}: {
  bids: ProcessedLevel[];
  asks: ProcessedLevel[];
}) {
  const maxBidSize = Math.max(...bids.map((b) => b.size), 0.001);
  const maxAskSize = Math.max(...asks.map((a) => a.size), 0.001);
  const maxBidTotal = bids.length > 0 ? bids[bids.length - 1].total : 1;
  const maxAskTotal = asks.length > 0 ? asks[asks.length - 1].total : 1;

  const displayCount = Math.min(20, Math.max(bids.length, asks.length));

  return (
    <div className="section-card">
      <div className="section-header !py-3">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          Order Book
        </span>
      </div>
      <div className="grid grid-cols-2 divide-x divide-border">
        {/* Bids side */}
        <div>
          <div className="grid grid-cols-4 gap-0 px-3 py-2 border-b border-border text-[10px] font-medium text-muted uppercase tracking-wider">
            <span className="text-right">Orders</span>
            <span className="text-right">Total</span>
            <span className="text-right">Size</span>
            <span className="text-right">Bid Price</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto scroll-fade">
            {bids.slice(0, displayCount).map((lvl, i) => {
              const sizePct = (lvl.size / maxBidSize) * 100;
              const totalPct = (lvl.total / maxBidTotal) * 100;
              return (
                <div
                  key={`bid-row-${i}`}
                  className={`grid grid-cols-4 gap-0 px-3 py-1.5 text-xs font-mono relative group hover:bg-up/5 transition-[background-color] duration-150 ${
                    lvl.isWall ? "ring-1 ring-inset ring-up/30" : ""
                  }`}
                >
                  {/* Size fill bar (from right) */}
                  <div
                    className="absolute right-0 top-0 bottom-0 transition-all duration-300"
                    style={{
                      width: `${sizePct}%`,
                      background:
                        "linear-gradient(270deg, rgba(34,197,94,0.35) 0%, rgba(34,197,94,0.08) 100%)",
                    }}
                  />
                  {/* Total fill bar (subtle underlay) */}
                  <div
                    className="absolute right-0 top-0 bottom-0 transition-all duration-300"
                    style={{
                      width: `${totalPct}%`,
                      background: "rgba(34,197,94,0.12)",
                    }}
                  />
                  <span className="relative z-10 text-right text-muted">
                    {lvl.orders}
                  </span>
                  <span className="relative z-10 text-right text-muted">
                    {lvl.total < 1000
                      ? lvl.total.toFixed(3)
                      : fmtCompact(lvl.total)}
                  </span>
                  <span
                    className={`relative z-10 text-right ${
                      lvl.isWall ? "text-up font-bold" : "text-fg"
                    }`}
                  >
                    {lvl.size < 1 ? lvl.size.toFixed(5) : lvl.size.toFixed(3)}
                  </span>
                  <span className="relative z-10 text-right text-up font-semibold">
                    {formatPrice(lvl.price)}
                  </span>
                  {/* Wall glow */}
                  {lvl.isWall && (
                    <div className="absolute inset-0 bg-up/5 animate-pulse rounded-sm pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Asks side */}
        <div>
          <div className="grid grid-cols-4 gap-0 px-3 py-2 border-b border-border text-[10px] font-medium text-muted uppercase tracking-wider">
            <span>Ask Price</span>
            <span className="text-right">Size</span>
            <span className="text-right">Total</span>
            <span className="text-right">Orders</span>
          </div>
          <div className="max-h-[500px] overflow-y-auto scroll-fade">
            {asks.slice(0, displayCount).map((lvl, i) => {
              const sizePct = (lvl.size / maxAskSize) * 100;
              const totalPct = (lvl.total / maxAskTotal) * 100;
              return (
                <div
                  key={`ask-row-${i}`}
                  className={`grid grid-cols-4 gap-0 px-3 py-1.5 text-xs font-mono relative group hover:bg-down/5 transition-[background-color] duration-150 ${
                    lvl.isWall ? "ring-1 ring-inset ring-down/30" : ""
                  }`}
                >
                  {/* Size fill bar (from left) */}
                  <div
                    className="absolute left-0 top-0 bottom-0 transition-all duration-300"
                    style={{
                      width: `${sizePct}%`,
                      background:
                        "linear-gradient(90deg, rgba(239,68,68,0.35) 0%, rgba(239,68,68,0.08) 100%)",
                    }}
                  />
                  {/* Total fill bar */}
                  <div
                    className="absolute left-0 top-0 bottom-0 transition-all duration-300"
                    style={{
                      width: `${totalPct}%`,
                      background: "rgba(239,68,68,0.12)",
                    }}
                  />
                  <span className="relative z-10 text-down font-semibold">
                    {formatPrice(lvl.price)}
                  </span>
                  <span
                    className={`relative z-10 text-right ${
                      lvl.isWall ? "text-down font-bold" : "text-fg"
                    }`}
                  >
                    {lvl.size < 1 ? lvl.size.toFixed(5) : lvl.size.toFixed(3)}
                  </span>
                  <span className="relative z-10 text-right text-muted">
                    {lvl.total < 1000
                      ? lvl.total.toFixed(3)
                      : fmtCompact(lvl.total)}
                  </span>
                  <span className="relative z-10 text-right text-muted">
                    {lvl.orders}
                  </span>
                  {/* Wall glow */}
                  {lvl.isWall && (
                    <div className="absolute inset-0 bg-down/5 animate-pulse rounded-sm pointer-events-none" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */

function Spinner() {
  return (
    <div className="space-y-4">
      {/* Metric cards skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="stat-card">
            <div className="skeleton h-3 w-20 mb-2" />
            <div className="skeleton h-5 w-24 mb-1" />
            <div className="skeleton h-2 w-16" />
          </div>
        ))}
      </div>
      {/* Depth chart skeleton */}
      <div className="section-card p-4">
        <div className="skeleton h-3 w-24 mb-4" />
        <div className="skeleton h-48 w-full rounded-lg" />
      </div>
      {/* Orderbook table skeleton */}
      <div className="section-card p-4">
        <div className="skeleton h-3 w-20 mb-4" />
        <div className="grid grid-cols-2 gap-4">
          {[0, 1].map((side) => (
            <div key={side} className="space-y-2">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="skeleton h-5 w-full" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Page                                                          */
/* ------------------------------------------------------------------ */

export default function Orderbook() {
  const { prices } = usePacificaPrices();
  const [searchParams] = useSearchParams();
  const urlSymbol = searchParams.get("symbol");

  const [symbols, setSymbols] = useState<string[]>([]);
  const [symbol, setSymbol] = useState(urlSymbol || "BTC");
  const [bookRaw, setBookRaw] = useState<BookData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ---- Fetch symbol list from /info ---- */
  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      try {
        const res = await fetch(`${API_BASE}/info`);
        const json = await res.json();
        if (cancelled) return;
        const list: MarketInfo[] = json.success && Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
        const syms = list.map((m) => m.symbol).sort();
        setSymbols(syms);
      } catch {
        // silently fail, user can still manually type
      }
    }
    fetchInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Fetch orderbook on interval ---- */
  const fetchBook = useCallback(async (sym: string) => {
    // Abort any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch(`${API_BASE}/book?symbol=${sym}`, {
        signal: controller.signal,
      });
      const json = await res.json();
      if (json.success && json.data) {
        setBookRaw(json.data as BookData);
        setError(null);
      } else {
        setError("Invalid response from API");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError("Failed to fetch orderbook");
    } finally {
      setLoading(false);
      setLastUpdate(Date.now());
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setBookRaw(null);
    fetchBook(symbol);

    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchBook(symbol);
      }, REFRESH_MS);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      abortRef.current?.abort();
    };
  }, [symbol, fetchBook, autoRefresh]);

  /* ---- Process orderbook data ---- */
  const { bids, asks, metrics } = useMemo(() => {
    if (!bookRaw || !bookRaw.l) {
      return {
        bids: [] as ProcessedLevel[],
        asks: [] as ProcessedLevel[],
        metrics: null,
      };
    }

    const rawBids = bookRaw.l[0] ?? [];
    const rawAsks = bookRaw.l[1] ?? [];

    // Compute average size across all levels
    const allSizes = [...rawBids, ...rawAsks].map((l) => parseFloat(l.a));
    const avgSize =
      allSizes.length > 0
        ? allSizes.reduce((s, v) => s + v, 0) / allSizes.length
        : 1;

    const processedBids = processLevels(rawBids, avgSize);
    const processedAsks = processLevels(rawAsks, avgSize);

    // Metrics
    const bestBid = processedBids.length > 0 ? processedBids[0].price : 0;
    const bestAsk = processedAsks.length > 0 ? processedAsks[0].price : 0;
    const spread = bestAsk - bestBid;
    const mid = (bestBid + bestAsk) / 2;

    const totalBidDepth = processedBids.reduce(
      (s, l) => s + l.size * l.price,
      0,
    );
    const totalAskDepth = processedAsks.reduce(
      (s, l) => s + l.size * l.price,
      0,
    );
    const imbalance =
      totalBidDepth + totalAskDepth > 0
        ? totalBidDepth / (totalBidDepth + totalAskDepth)
        : 0.5;

    // Find walls (largest single level by size * price)
    const largestBid = processedBids.reduce(
      (best, l) =>
        l.size * l.price > best.value
          ? { price: l.price, size: l.size, value: l.size * l.price }
          : best,
      { price: 0, size: 0, value: 0 },
    );
    const largestAsk = processedAsks.reduce(
      (best, l) =>
        l.size * l.price > best.value
          ? { price: l.price, size: l.size, value: l.size * l.price }
          : best,
      { price: 0, size: 0, value: 0 },
    );

    return {
      bids: processedBids,
      asks: processedAsks,
      metrics: {
        spread,
        spreadBps: fmtBps(spread, mid),
        mid,
        totalBidDepth,
        totalAskDepth,
        imbalance,
        largestBid,
        largestAsk,
      },
    };
  }, [bookRaw]);

  /* ---- Current price from WebSocket ---- */
  const currentPrice = prices[symbol];
  const midPrice = currentPrice
    ? parseFloat(currentPrice.mid)
    : metrics?.mid ?? 0;

  /* ---- Time since last update ---- */
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 500);
    return () => clearInterval(t);
  }, []);
  const secAgo = lastUpdate
    ? Math.floor((Date.now() - lastUpdate) / 1000)
    : 0;

  return (
    <div className="space-y-5 page-enter">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Symbol selector */}
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            className="form-select text-sm font-semibold min-w-[120px]"
          >
            {symbols.length > 0
              ? symbols.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))
              : /* Fallback while loading info */
                ["BTC", "ETH", "SOL"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
          </select>
          <span className="text-[10px] text-muted uppercase tracking-wider">
            Perp
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-mono transition-colors duration-300 ${
            secAgo <= 1 ? "text-accent" : "text-muted"
          }`}>
            {secAgo}s ago
          </span>
          <LiveToggle active={autoRefresh} onToggle={() => setAutoRefresh((p) => !p)} intervalSec={REFRESH_MS / 1000} />
        </div>
      </div>

      {error && (
        <div className="bg-down/10 border border-down/20 rounded-xl px-4 py-3 text-sm text-down">
          {error}
        </div>
      )}

      {loading ? (
        <Spinner />
      ) : metrics ? (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <MetricCard
              label="Spread"
              value={`$${metrics.spread.toFixed(2)}`}
              sub={`${metrics.spreadBps} bps`}
              color="accent"
              className="relative overflow-hidden"
            />
            <MetricCard
              label="Total Bid Depth"
              value={`$${formatNumber(metrics.totalBidDepth)}`}
              sub={`${bids.length} levels`}
              color="up"
              className="border-l-2 border-l-[#10b981]"
            />
            <MetricCard
              label="Total Ask Depth"
              value={`$${formatNumber(metrics.totalAskDepth)}`}
              sub={`${asks.length} levels`}
              color="down"
              className="border-l-2 border-l-[#f43f5e]"
            />
            <MetricCard
              label="Largest Bid Wall"
              value={`$${formatPrice(metrics.largestBid.price)}`}
              sub={`${metrics.largestBid.size.toFixed(4)} @ $${fmtCompact(metrics.largestBid.value)}`}
              color="up"
              className=""
            />
            <MetricCard
              label="Largest Ask Wall"
              value={`$${formatPrice(metrics.largestAsk.price)}`}
              sub={`${metrics.largestAsk.size.toFixed(4)} @ $${fmtCompact(metrics.largestAsk.value)}`}
              color="down"
              className=""
            />
            <MetricCard
              label="Mid Price"
              value={`$${formatPrice(midPrice)}`}
              sub={currentPrice ? `Mark: $${formatPrice(parseFloat(currentPrice.mark))}` : undefined}
              color="fg"
              className=""
            />
          </div>

          {/* Imbalance Bar */}
          <ImbalanceBar ratio={metrics.imbalance} />

          {/* Depth Chart */}
          <DepthChart bids={bids} asks={asks} midPrice={midPrice} />

          {/* Orderbook Table */}
          <OrderbookTable bids={bids} asks={asks} />
        </>
      ) : (
        <div className="text-center text-muted py-12">
          No orderbook data available for {symbol}
        </div>
      )}
    </div>
  );
}
