import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import type { MarketInfo } from "@/lib/types";
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

interface Trade {
  price: number;
  amount: number;
  notional: number;
  side: RawTrade["side"];
  cause: RawTrade["cause"];
  createdAt: number;
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

const API = "https://api.pacifica.fi/api/v1";

function parseTakerTrades(raw: RawTrade[]): Trade[] {
  return raw
    .filter((t) => t.event_type === "fulfill_taker")
    .map((t) => {
      const price = parseFloat(t.price);
      const amount = parseFloat(t.amount);
      return {
        price,
        amount,
        notional: price * amount,
        side: t.side,
        cause: t.cause,
        createdAt: t.created_at,
      };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function sideLabel(side: Trade["side"]): { direction: string; action: string } {
  switch (side) {
    case "open_long":
      return { direction: "LONG", action: "OPEN" };
    case "open_short":
      return { direction: "SHORT", action: "OPEN" };
    case "close_long":
      return { direction: "LONG", action: "CLOSE" };
    case "close_short":
      return { direction: "SHORT", action: "CLOSE" };
  }
}

function isBuyPressure(side: Trade["side"]): boolean {
  return side === "open_long" || side === "close_short";
}

/* -------------------------------------------------------------------------- */
/*  Flow computation                                                           */
/* -------------------------------------------------------------------------- */

interface FlowStats {
  buyPressure: number;
  sellPressure: number;
  netFlow: number;
  openVolume: number;
  closeVolume: number;
  openCloseRatio: number;
  liquidationCount: number;
  liquidationVolume: number;
}

function computeFlow(trades: Trade[]): FlowStats {
  let buyPressure = 0;
  let sellPressure = 0;
  let openVolume = 0;
  let closeVolume = 0;
  let liquidationCount = 0;
  let liquidationVolume = 0;

  for (const t of trades) {
    if (isBuyPressure(t.side)) {
      buyPressure += t.notional;
    } else {
      sellPressure += t.notional;
    }

    if (t.side === "open_long" || t.side === "open_short") {
      openVolume += t.notional;
    } else {
      closeVolume += t.notional;
    }

    if (t.cause === "liquidation") {
      liquidationCount++;
      liquidationVolume += t.notional;
    }
  }

  return {
    buyPressure,
    sellPressure,
    netFlow: buyPressure - sellPressure,
    openVolume,
    closeVolume,
    openCloseRatio: closeVolume > 0 ? openVolume / closeVolume : openVolume > 0 ? Infinity : 0,
    liquidationCount,
    liquidationVolume,
  };
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function FlowCard({
  label,
  value,
  sub,
  colorClass,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  colorClass?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3 min-w-[140px]">
      <p className="text-[11px] text-muted uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-lg font-bold font-mono ${colorClass ?? "text-fg"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted mt-0.5">{sub}</p>}
    </div>
  );
}

function PressureBar({ buyPct, sellPct }: { buyPct: number; sellPct: number }) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between text-xs text-muted mb-2">
        <span className="text-up font-mono font-medium">BUY {buyPct.toFixed(1)}%</span>
        <span className="text-[11px] uppercase tracking-wider">Taker Pressure</span>
        <span className="text-down font-mono font-medium">SELL {sellPct.toFixed(1)}%</span>
      </div>
      <div className="flex h-3 rounded-full overflow-hidden bg-border">
        <div
          className="bg-[#22c55e] transition-all duration-500"
          style={{ width: `${buyPct}%` }}
        />
        <div
          className="bg-[#ef4444] transition-all duration-500"
          style={{ width: `${sellPct}%` }}
        />
      </div>
    </div>
  );
}

function TradeRow({ trade }: { trade: Trade }) {
  const { direction, action } = sideLabel(trade.side);
  const isLong = direction === "LONG";
  const isLiquidation = trade.cause === "liquidation";
  const isLarge = trade.notional > 10_000;
  const isWhale = trade.notional > 50_000;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-card-hover ${
        isWhale
          ? "border border-warn/40 bg-warn/5"
          : isLarge
            ? "border border-border/80 bg-card-hover/40"
            : ""
      }`}
    >
      {/* Time */}
      <span className="text-[11px] font-mono text-muted w-[60px] shrink-0">
        {formatTime(trade.createdAt)}
      </span>

      {/* Side badge */}
      <span
        className={`text-[10px] font-bold px-1.5 py-0.5 rounded w-[46px] text-center shrink-0 ${
          isLong ? "bg-[#22c55e]/15 text-up" : "bg-[#ef4444]/15 text-down"
        }`}
      >
        {direction}
      </span>

      {/* Action badge */}
      <span
        className={`text-[10px] font-medium px-1.5 py-0.5 rounded w-[44px] text-center shrink-0 ${
          action === "OPEN" ? "bg-accent/15 text-accent" : "bg-muted/15 text-muted"
        }`}
      >
        {action}
      </span>

      {/* Liquidation badge */}
      {isLiquidation && (
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warn/15 text-warn shrink-0 uppercase tracking-wider">
          LIQ
        </span>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Price */}
      <span className="text-xs font-mono text-fg shrink-0">
        ${formatPrice(trade.price)}
      </span>

      {/* Size */}
      <span
        className={`text-xs font-mono font-medium w-[80px] text-right shrink-0 ${
          isWhale ? "text-warn" : isBuyPressure(trade.side) ? "text-up" : "text-down"
        }`}
      >
        ${formatNumber(trade.notional)}
      </span>
    </div>
  );
}

function LargeTradeAlert({ trade, symbol }: { trade: Trade; symbol: string }) {
  const { direction, action } = sideLabel(trade.side);
  const isLong = direction === "LONG";
  const isLiquidation = trade.cause === "liquidation";

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 rounded-xl border-2 ${
        isLiquidation
          ? "border-warn/50 bg-warn/5"
          : isLong
            ? "border-[#22c55e]/30 bg-[#22c55e]/5"
            : "border-[#ef4444]/30 bg-[#ef4444]/5"
      }`}
    >
      {/* Whale icon */}
      <div className="text-warn text-lg shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-fg text-sm">{symbol}</span>
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
              isLong ? "bg-[#22c55e]/15 text-up" : "bg-[#ef4444]/15 text-down"
            }`}
          >
            {direction}
          </span>
          <span className="text-[10px] font-medium text-muted">{action}</span>
          {isLiquidation && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-warn/15 text-warn uppercase tracking-wider">
              LIQUIDATION
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted font-mono mt-0.5">
          {formatTime(trade.createdAt)} @ ${formatPrice(trade.price)}
        </p>
      </div>

      <span
        className={`font-mono font-bold text-base ${
          isLiquidation ? "text-warn" : isBuyPressure(trade.side) ? "text-up" : "text-down"
        }`}
      >
        ${formatNumber(trade.notional)}
      </span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Component                                                             */
/* -------------------------------------------------------------------------- */

export default function TradeFlow() {
  const { prices, connected } = usePacificaPrices();

  const [symbols, setSymbols] = useState<string[]>([]);
  const [selectedSymbol, setSelectedSymbol] = useState("BTC");
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* ---- Fetch symbol list from /api/v1/info ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API}/info`);
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          const syms = (json.data as MarketInfo[]).map((m) => m.symbol).sort();
          setSymbols(syms);
        }
      } catch {
        // retry silently
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Fetch trades ---- */
  const fetchTrades = useCallback(async (symbol: string) => {
    try {
      setLoading(true);
      const res = await fetch(`${API}/trades?symbol=${symbol}&limit=100`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setTrades(parseTakerTrades(json.data as RawTrade[]));
        setLastUpdated(Date.now());
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  /* ---- Initial fetch + on symbol change ---- */
  useEffect(() => {
    fetchTrades(selectedSymbol);
  }, [selectedSymbol, fetchTrades]);

  /* ---- Auto-refresh every 3 seconds ---- */
  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (autoRefresh) {
      intervalRef.current = setInterval(() => {
        fetchTrades(selectedSymbol);
      }, 3_000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [autoRefresh, selectedSymbol, fetchTrades]);

  /* ---- Computed flow stats ---- */
  const flow = useMemo(() => computeFlow(trades), [trades]);

  const buyPct = useMemo(() => {
    const total = flow.buyPressure + flow.sellPressure;
    return total > 0 ? (flow.buyPressure / total) * 100 : 50;
  }, [flow]);

  const sellPct = useMemo(() => 100 - buyPct, [buyPct]);

  const whaleTrades = useMemo(
    () => trades.filter((t) => t.notional > 50_000),
    [trades],
  );

  /* ---- Current mark price from WS for context ---- */
  const currentPrice = prices[selectedSymbol]
    ? parseFloat(prices[selectedSymbol].mark)
    : null;

  /* ---- Render ---- */
  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-fg">Trade Flow</h1>
          <p className="text-muted text-sm mt-0.5">
            Real-time taker flow analysis
            {currentPrice !== null && (
              <span className="ml-2 font-mono text-fg">
                {selectedSymbol} ${formatPrice(currentPrice)}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Auto-refresh toggle */}
          <button
            onClick={() => setAutoRefresh((p) => !p)}
            className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
              autoRefresh
                ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-up"
                : "border-border bg-card text-muted hover:text-fg"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                autoRefresh ? "bg-[#22c55e] animate-pulse" : "bg-muted"
              }`}
            />
            {autoRefresh ? "LIVE" : "PAUSED"}
          </button>

          {/* Connection status */}
          <span
            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border ${
              connected
                ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-up"
                : "border-[#ef4444]/30 bg-[#ef4444]/10 text-down"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                connected ? "bg-[#22c55e]" : "bg-[#ef4444]"
              }`}
            />
            {connected ? "WS" : "OFF"}
          </span>
        </div>
      </div>

      {/* ---------- Symbol Selector ---------- */}
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={selectedSymbol}
          onChange={(e) => setSelectedSymbol(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-2 text-sm text-fg font-mono focus:outline-none focus:border-accent/50 transition-colors cursor-pointer"
        >
          {symbols.length > 0
            ? symbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))
            : <option value="BTC">BTC</option>
          }
        </select>

        {loading && (
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        )}

        {lastUpdated && (
          <span className="text-[10px] text-muted font-mono">
            Updated {formatTime(lastUpdated)}
          </span>
        )}

        <span className="text-[10px] text-muted font-mono ml-auto">
          {trades.length} taker trade{trades.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* ---------- Flow Summary Cards ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <FlowCard
          label="Buy Pressure"
          value={`$${formatNumber(flow.buyPressure)}`}
          sub="Taker longs + close shorts"
          colorClass="text-up"
        />
        <FlowCard
          label="Sell Pressure"
          value={`$${formatNumber(flow.sellPressure)}`}
          sub="Taker shorts + close longs"
          colorClass="text-down"
        />
        <FlowCard
          label="Net Flow"
          value={`${flow.netFlow >= 0 ? "+" : ""}$${formatNumber(Math.abs(flow.netFlow))}`}
          sub={flow.netFlow >= 0 ? "Buyers dominant" : "Sellers dominant"}
          colorClass={flow.netFlow >= 0 ? "text-up" : "text-down"}
        />
        <FlowCard
          label="Open / Close"
          value={
            flow.openCloseRatio === Infinity
              ? "---"
              : flow.openCloseRatio === 0
                ? "0.00"
                : flow.openCloseRatio.toFixed(2) + "x"
          }
          sub={flow.openCloseRatio > 1 ? "OI expanding" : flow.openCloseRatio < 1 ? "OI contracting" : "Balanced"}
        />
        <FlowCard
          label="Liquidations"
          value={String(flow.liquidationCount)}
          sub={flow.liquidationVolume > 0 ? `$${formatNumber(flow.liquidationVolume)} vol` : "None detected"}
          colorClass={flow.liquidationCount > 0 ? "text-warn" : "text-muted"}
        />
      </div>

      {/* ---------- Buy/Sell Pressure Bar ---------- */}
      <PressureBar buyPct={buyPct} sellPct={sellPct} />

      {/* ---------- Large Trade Alerts ---------- */}
      {whaleTrades.length > 0 && (
        <section>
          <h2 className="text-fg font-semibold text-sm mb-2 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-warn">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            Large Trades (&gt;$50K)
            <span className="text-warn font-mono text-xs">{whaleTrades.length}</span>
          </h2>
          <div className="space-y-2">
            {whaleTrades.slice(0, 5).map((t, i) => (
              <LargeTradeAlert key={`${t.createdAt}-${i}`} trade={t} symbol={selectedSymbol} />
            ))}
          </div>
        </section>
      )}

      {/* ---------- Main content: Timeline + Aggregate ---------- */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Trade Flow Timeline */}
        <div className="lg:col-span-2 bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <h2 className="text-fg font-semibold text-sm">Trade Flow Timeline</h2>
            <span className="text-[10px] text-muted font-mono">Taker fills only</span>
          </div>
          <div className="overflow-y-auto max-h-[520px] p-2 space-y-0.5">
            {trades.length > 0 ? (
              trades.map((t, i) => (
                <TradeRow key={`${t.createdAt}-${i}`} trade={t} />
              ))
            ) : (
              <div className="flex items-center justify-center py-16 text-muted text-sm">
                {loading ? "Loading trades..." : "No trades found"}
              </div>
            )}
          </div>
        </div>

        {/* Aggregate Stats */}
        <div className="space-y-4">
          {/* Opening Flow */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[11px] text-muted uppercase tracking-wider mb-3">Opening Flow</h3>
            <p className="text-2xl font-bold font-mono text-fg">
              ${formatNumber(flow.openVolume)}
            </p>
            <p className="text-[11px] text-muted mt-1">
              New OI being created
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Open Long</span>
                <span className="font-mono text-up">
                  ${formatNumber(trades.filter((t) => t.side === "open_long").reduce((s, t) => s + t.notional, 0))}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Open Short</span>
                <span className="font-mono text-down">
                  ${formatNumber(trades.filter((t) => t.side === "open_short").reduce((s, t) => s + t.notional, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Closing Flow */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[11px] text-muted uppercase tracking-wider mb-3">Closing Flow</h3>
            <p className="text-2xl font-bold font-mono text-fg">
              ${formatNumber(flow.closeVolume)}
            </p>
            <p className="text-[11px] text-muted mt-1">
              OI being reduced
            </p>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Close Long</span>
                <span className="font-mono text-down">
                  ${formatNumber(trades.filter((t) => t.side === "close_long").reduce((s, t) => s + t.notional, 0))}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted">Close Short</span>
                <span className="font-mono text-up">
                  ${formatNumber(trades.filter((t) => t.side === "close_short").reduce((s, t) => s + t.notional, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Net OI Change */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="text-[11px] text-muted uppercase tracking-wider mb-3">Net OI Change</h3>
            {(() => {
              const netOI = flow.openVolume - flow.closeVolume;
              const isPositive = netOI >= 0;
              return (
                <>
                  <p className={`text-2xl font-bold font-mono ${isPositive ? "text-up" : "text-down"}`}>
                    {isPositive ? "+" : "-"}${formatNumber(Math.abs(netOI))}
                  </p>
                  <p className="text-[11px] text-muted mt-1">
                    {isPositive ? "Open interest expanding" : "Open interest contracting"}
                  </p>
                  {/* Mini bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-[10px] text-muted mb-1">
                      <span>Opening</span>
                      <span>Closing</span>
                    </div>
                    <div className="flex h-2 rounded-full overflow-hidden bg-border">
                      {(() => {
                        const total = flow.openVolume + flow.closeVolume;
                        const openPct = total > 0 ? (flow.openVolume / total) * 100 : 50;
                        return (
                          <>
                            <div
                              className="bg-accent transition-all duration-500"
                              style={{ width: `${openPct}%` }}
                            />
                            <div
                              className="bg-muted transition-all duration-500"
                              style={{ width: `${100 - openPct}%` }}
                            />
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ---------- Footer ---------- */}
      <div className="border-t border-border pt-3 flex items-center justify-between text-[10px] text-muted">
        <span>
          Data sourced from{" "}
          <span className="text-accent font-medium">Pacifica REST API</span>
          {" "}| Taker fills, {trades.length} trades
        </span>
        <span className="font-mono">
          {autoRefresh ? "Auto-refresh 3s" : "Refresh paused"}
        </span>
      </div>
    </div>
  );
}
