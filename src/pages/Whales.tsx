import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import { type PriceData, formatNumber, formatPrice } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  address: string;
  username: string;
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  pnl_all_time: number;
  equity_current: number;
  oi_current: number;
  volume_1d: number;
  volume_7d: number;
  volume_30d: number;
  volume_all_time: number;
}

interface Position {
  symbol: string;
  side: string;
  amount: string;
  entry_price: string;
  margin: string;
  funding: string;
  isolated: boolean;
  liquidation_price: string;
  created_at: string;
  updated_at: string;
}

interface AccountInfo {
  balance: number;
  fee_level: number;
  maker_fee: number;
  taker_fee: number;
  account_equity: number;
  available_to_spend: number;
  total_margin_used: number;
  positions_count: number;
  orders_count: number;
}

type SortKey =
  | "rank"
  | "pnl_1d"
  | "pnl_7d"
  | "pnl_30d"
  | "pnl_all_time"
  | "equity_current"
  | "oi_current"
  | "volume_30d";

type SortDir = "asc" | "desc";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 4) + "..." + addr.slice(-3);
}

function pnlColor(val: number): string {
  if (val > 0) return "text-up";
  if (val < 0) return "text-down";
  return "text-muted";
}

function formatPnl(val: number): string {
  const prefix = val >= 0 ? "+$" : "-$";
  return prefix + formatNumber(Math.abs(val));
}

function calcUnrealizedPnl(
  side: string,
  entryPrice: number,
  markPrice: number,
  amount: number,
): number {
  if (side.toLowerCase() === "long") {
    return (markPrice - entryPrice) * Math.abs(amount);
  }
  return (entryPrice - markPrice) * Math.abs(amount);
}

/* ------------------------------------------------------------------ */
/*  Spinner                                                            */
/* ------------------------------------------------------------------ */

function Spinner({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted">
      <svg
        className="animate-spin h-4 w-4 text-accent"
        viewBox="0 0 24 24"
        fill="none"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        />
      </svg>
      {text}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trader Detail (expanded row)                                       */
/* ------------------------------------------------------------------ */

function TraderDetail({
  address,
  prices,
}: {
  address: string;
  prices: Record<string, PriceData>;
}) {
  const [positions, setPositions] = useState<Position[] | null>(null);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`https://api.pacifica.fi/api/v1/positions?account=${address}`)
        .then((r) => r.json())
        .then((d) => d.data as Position[]),
      fetch(`https://api.pacifica.fi/api/v1/account?account=${address}`)
        .then((r) => r.json())
        .then((d) => d.data as AccountInfo),
    ])
      .then(([pos, acc]) => {
        if (cancelled) return;
        setPositions(pos ?? []);
        setAccount(acc ?? null);
      })
      .catch(() => {
        if (!cancelled) setError("Failed to load trader data");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [address]);

  if (loading) return <Spinner text="Loading trader details..." />;
  if (error)
    return <p className="text-down text-sm text-center py-6">{error}</p>;

  return (
    <div className="space-y-4 p-4 border-l-2 border-accent">
      {/* Account summary */}
      {account && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Account Equity", value: `$${formatNumber(account.account_equity)}`, glow: "" },
            { label: "Margin Used", value: `$${formatNumber(account.total_margin_used)}`, glow: "" },
            { label: "Available Balance", value: `$${formatNumber(account.available_to_spend)}`, glow: "" },
            { label: "Open Positions", value: String(account.positions_count), glow: "" },
          ].map((item) => (
            <div
              key={item.label}
              className={`stat-card ${item.glow}`}
            >
              <div className="text-xs text-muted mb-1">{item.label}</div>
              <div className="text-fg font-mono font-semibold text-sm">
                {item.value}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Positions table */}
      {positions && positions.length > 0 ? (
        <div className="bg-bg rounded-xl border border-border overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wider border-b border-border">
                <th className="text-left px-4 py-2.5 font-medium">Symbol</th>
                <th className="text-left px-4 py-2.5 font-medium">Side</th>
                <th className="text-right px-4 py-2.5 font-medium">Size</th>
                <th className="text-right px-4 py-2.5 font-medium">
                  Entry Price
                </th>
                <th className="text-right px-4 py-2.5 font-medium">
                  Mark Price
                </th>
                <th className="text-right px-4 py-2.5 font-medium">
                  Unrealized PnL
                </th>
                <th className="text-right px-4 py-2.5 font-medium">Margin</th>
                <th className="text-right px-4 py-2.5 font-medium">
                  Liq. Price
                </th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos, idx) => {
                const entry = parseFloat(pos.entry_price);
                const amount = parseFloat(pos.amount);
                const priceData = prices[pos.symbol];
                const mark = priceData ? parseFloat(priceData.mark) : null;
                const upnl =
                  mark !== null
                    ? calcUnrealizedPnl(pos.side, entry, mark, amount)
                    : null;

                return (
                  <tr
                    key={`${pos.symbol}-${idx}`}
                    className="border-b border-border last:border-b-0 hover:bg-card-hover/50 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium">
                      <Link to={`/orderbook?symbol=${pos.symbol}`} className="text-fg hover:text-accent transition-colors" title="View Orderbook">
                        {pos.symbol}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          pos.side.toLowerCase() === "bid"
                            ? "bg-[#22c55e]/10 text-up"
                            : "bg-[#ef4444]/10 text-down"
                        }`}
                      >
                        {pos.side.toLowerCase() === "bid" ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">
                      {formatNumber(Math.abs(amount))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">
                      ${formatPrice(entry)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-fg">
                      {mark !== null ? `$${formatPrice(mark)}` : "-"}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-mono ${
                        upnl === null
                          ? "text-muted"
                          : upnl >= 0
                            ? "text-up"
                            : "text-down"
                      }`}
                    >
                      {upnl !== null ? formatPnl(upnl) : "-"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      ${formatNumber(parseFloat(pos.margin))}
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono text-muted">
                      ${formatPrice(parseFloat(pos.liquidation_price))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-muted text-sm text-center py-4">
          No open positions
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sentiment Bar                                                      */
/* ------------------------------------------------------------------ */

function SentimentBar({
  symbol,
  longs,
  shorts,
}: {
  symbol: string;
  longs: number;
  shorts: number;
}) {
  const total = longs + shorts;
  if (total === 0) return null;
  const longPct = (longs / total) * 100;
  const shortPct = (shorts / total) * 100;

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-fg font-medium text-sm w-24 truncate">
        {symbol}
      </span>
      <div className="flex-1 flex h-5 rounded overflow-hidden bg-border">
        {longPct > 0 && (
          <div
            className="bg-[#22c55e] transition-all duration-500 ease-out flex items-center justify-center"
            style={{ width: `${longPct}%` }}
          >
            {longPct >= 20 && (
              <span className="text-[10px] font-mono font-bold text-bg">
                {longPct.toFixed(0)}%
              </span>
            )}
          </div>
        )}
        {shortPct > 0 && (
          <div
            className="bg-[#ef4444] transition-all duration-500 ease-out flex items-center justify-center"
            style={{ width: `${shortPct}%` }}
          >
            {shortPct >= 20 && (
              <span className="text-[10px] font-mono font-bold text-bg">
                {shortPct.toFixed(0)}%
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs font-mono w-28 justify-end">
        <span className="text-up">{longs}L</span>
        <span className="text-muted">/</span>
        <span className="text-down">{shorts}S</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Leaderboard column definitions                                     */
/* ------------------------------------------------------------------ */

const LEADERBOARD_COLUMNS: {
  key: SortKey;
  label: string;
  align: "left" | "right";
}[] = [
  { key: "rank", label: "#", align: "left" },
  { key: "pnl_1d", label: "PnL (1d)", align: "right" },
  { key: "pnl_7d", label: "PnL (7d)", align: "right" },
  { key: "pnl_30d", label: "PnL (30d)", align: "right" },
  { key: "pnl_all_time", label: "PnL (All)", align: "right" },
  { key: "equity_current", label: "Equity", align: "right" },
  { key: "oi_current", label: "Open Interest", align: "right" },
  { key: "volume_30d", label: "Volume (30d)", align: "right" },
];

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function Whales() {
  const { prices } = usePacificaPrices();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [lbError, setLbError] = useState<string | null>(null);

  const [expandedAddr, setExpandedAddr] = useState<string | null>(null);

  // Positions cache for sentiment aggregation
  const [allPositions, setAllPositions] = useState<
    Record<string, Position[]>
  >({});

  // Sort state for leaderboard
  const [sortKey, setSortKey] = useState<SortKey>("pnl_all_time");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ---- Fetch leaderboard on mount ---- */
  useEffect(() => {
    let cancelled = false;
    async function fetchLeaderboard() {
      try {
        const res = await fetch(
          "https://api.pacifica.fi/api/v1/leaderboard",
        );
        const json = await res.json();
        if (cancelled) return;
        if (json.success && Array.isArray(json.data)) {
          const all: LeaderboardEntry[] = json.data.map((t: Record<string, unknown>) => ({
            address: String(t.address ?? ""),
            username: t.username ? String(t.username) : null,
            pnl_1d: Number(t.pnl_1d) || 0,
            pnl_7d: Number(t.pnl_7d) || 0,
            pnl_30d: Number(t.pnl_30d) || 0,
            pnl_all_time: Number(t.pnl_all_time) || 0,
            equity_current: Number(t.equity_current) || 0,
            oi_current: Number(t.oi_current) || 0,
            volume_1d: Number(t.volume_1d) || 0,
            volume_7d: Number(t.volume_7d) || 0,
            volume_30d: Number(t.volume_30d) || 0,
            volume_all_time: Number(t.volume_all_time) || 0,
          }));
          all.sort((a, b) => b.pnl_all_time - a.pnl_all_time);
          setLeaderboard(all.slice(0, 20));
        } else {
          setLbError("Unexpected API response");
        }
      } catch {
        if (!cancelled) setLbError("Failed to load leaderboard");
      } finally {
        if (!cancelled) setLbLoading(false);
      }
    }
    fetchLeaderboard();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Fetch all top-20 positions for sentiment (runs once leaderboard loads) ---- */
  useEffect(() => {
    if (leaderboard.length === 0) return;
    let cancelled = false;

    async function fetchAllPositions() {
      const results: Record<string, Position[]> = {};
      await Promise.allSettled(
        leaderboard.map(async (trader) => {
          try {
            const res = await fetch(
              `https://api.pacifica.fi/api/v1/positions?account=${trader.address}`,
            );
            const json = await res.json();
            if (!cancelled && json.success && Array.isArray(json.data)) {
              results[trader.address] = json.data;
            }
          } catch {
            // skip this trader silently
          }
        }),
      );
      if (!cancelled) setAllPositions(results);
    }
    fetchAllPositions();
    return () => {
      cancelled = true;
    };
  }, [leaderboard]);

  /* ---- Toggle expanded row ---- */
  const toggleExpand = useCallback((addr: string) => {
    setExpandedAddr((prev) => (prev === addr ? null : addr));
  }, []);

  /* ---- Sort leaderboard ---- */
  const sorted = useMemo(() => {
    const rows = leaderboard.map((entry, idx) => ({ ...entry, rank: idx + 1 }));
    rows.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "rank":
          cmp = a.rank - b.rank;
          break;
        case "pnl_1d":
          cmp = a.pnl_1d - b.pnl_1d;
          break;
        case "pnl_7d":
          cmp = a.pnl_7d - b.pnl_7d;
          break;
        case "pnl_30d":
          cmp = a.pnl_30d - b.pnl_30d;
          break;
        case "pnl_all_time":
          cmp = a.pnl_all_time - b.pnl_all_time;
          break;
        case "equity_current":
          cmp = a.equity_current - b.equity_current;
          break;
        case "oi_current":
          cmp = a.oi_current - b.oi_current;
          break;
        case "volume_30d":
          cmp = a.volume_30d - b.volume_30d;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [leaderboard, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "rank" ? "asc" : "desc");
    }
  }

  /* ---- Aggregate sentiment from all fetched positions ---- */
  const sentiment = useMemo(() => {
    const map: Record<string, { longs: number; shorts: number }> = {};
    for (const positions of Object.values(allPositions)) {
      for (const pos of positions) {
        if (!map[pos.symbol]) map[pos.symbol] = { longs: 0, shorts: 0 };
        if (pos.side.toLowerCase() === "bid") {
          map[pos.symbol].longs += 1;
        } else {
          map[pos.symbol].shorts += 1;
        }
      }
    }
    return Object.entries(map)
      .map(([symbol, counts]) => ({
        symbol,
        ...counts,
        total: counts.longs + counts.shorts,
      }))
      .sort((a, b) => b.total - a.total);
  }, [allPositions]);

  /* ---- Render ---- */
  return (
    <div className="space-y-6 page-enter">
      {/* Leaderboard */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between">
          <h2 className="text-fg font-semibold">
            Top Traders{" "}
            <span className="text-muted font-normal text-sm">
              (Top 20 by All-time PnL)
            </span>
          </h2>
          <p className="text-xs text-muted">
            Click a row to inspect positions
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wider border-b border-border">
                {/* Rank + address header (combined, non-sortable for address) */}
                <th
                  onClick={() => handleSort("rank")}
                  className="text-left px-5 py-3 font-medium cursor-pointer select-none hover:text-fg transition-colors whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1">
                    #
                    {sortKey === "rank" && (
                      <span className="text-accent text-xs">
                        {sortDir === "asc" ? "\u2191" : "\u2193"}
                      </span>
                    )}
                  </span>
                </th>
                <th className="text-left px-5 py-3 font-medium whitespace-nowrap">
                  Address
                </th>
                {LEADERBOARD_COLUMNS.slice(1).map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-5 py-3 font-medium cursor-pointer select-none hover:text-fg transition-colors whitespace-nowrap ${
                      col.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-accent text-xs">
                          {sortDir === "asc" ? "\u2191" : "\u2193"}
                        </span>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lbLoading ? (
                <>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <tr key={`skel-${i}`} className="border-b border-border">
                      <td className="px-5 py-3"><div className="skeleton h-4 w-6" /></td>
                      <td className="px-5 py-3"><div className="skeleton h-4 w-28" /></td>
                      {Array.from({ length: 7 }).map((_, j) => (
                        <td key={j} className="px-5 py-3"><div className="skeleton h-4 w-20 ml-auto" /></td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : lbError ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-down"
                  >
                    {lbError}
                  </td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-5 py-12 text-center text-muted"
                  >
                    No traders found.
                  </td>
                </tr>
              ) : (
                sorted.map((trader) => {
                  const isExpanded = expandedAddr === trader.address;
                  return (
                    <React.Fragment key={trader.address}>
                      <tr
                        onClick={() => toggleExpand(trader.address)}
                        className={`border-b border-border cursor-pointer transition-[background-color,box-shadow] duration-150 ease-out group ${
                          isExpanded
                            ? "bg-accent/5 shadow-[inset_2px_0_0_0_rgba(59,130,246,0.5)]"
                            : trader.rank % 2 === 0
                              ? "bg-card-hover/20 hover:bg-card-hover active:bg-card-hover/60"
                              : "hover:bg-card-hover active:bg-card-hover/60"
                        }`}
                      >
                        <td className="px-5 py-3 font-mono w-12">
                          {trader.rank <= 3 ? (
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${
                                trader.rank === 1
                                  ? "bg-yellow-500/20 text-yellow-500"
                                  : trader.rank === 2
                                    ? "bg-gray-400/20 text-gray-400"
                                    : "bg-orange-500/20 text-orange-500"
                              }`}
                            >
                              {trader.rank}
                            </span>
                          ) : (
                            <span className="text-muted">{trader.rank}</span>
                          )}
                        </td>
                        <td className="px-5 py-3 text-fg font-mono whitespace-nowrap">
                          <span className="flex items-center gap-2">
                            {truncateAddress(trader.address)}
                            {trader.username && (
                              <span className="text-xs text-muted">
                                ({trader.username})
                              </span>
                            )}
                            <svg
                              className={`w-3.5 h-3.5 transition-transform duration-200 ease-out ${
                                isExpanded ? "rotate-180 text-accent" : "text-muted group-hover:text-fg"
                              }`}
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </span>
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono whitespace-nowrap ${pnlColor(trader.pnl_1d)}`}
                        >
                          {formatPnl(trader.pnl_1d)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono whitespace-nowrap ${pnlColor(trader.pnl_7d)}`}
                        >
                          {formatPnl(trader.pnl_7d)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono whitespace-nowrap ${pnlColor(trader.pnl_30d)}`}
                        >
                          {formatPnl(trader.pnl_30d)}
                        </td>
                        <td
                          className={`px-5 py-3 text-right font-mono whitespace-nowrap ${pnlColor(trader.pnl_all_time)}`}
                        >
                          {formatPnl(trader.pnl_all_time)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-fg whitespace-nowrap">
                          ${formatNumber(trader.equity_current)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-fg whitespace-nowrap">
                          ${formatNumber(trader.oi_current)}
                        </td>
                        <td className="px-5 py-3 text-right font-mono text-fg whitespace-nowrap">
                          ${formatNumber(trader.volume_30d)}
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-card-hover/30 border-b border-border">
                          <td colSpan={9} className="row-expand-enter">
                            <TraderDetail
                              address={trader.address}
                              prices={prices}
                            />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Whale Sentiment */}
      <section className="bg-card rounded-xl border border-border p-5">
        <div className="mb-4">
          <h2 className="text-fg font-semibold">Aggregate <span className="gradient-text">Whale Sentiment</span></h2>
          <p className="text-xs text-muted mt-1">
            Net long/short positioning across top 20 traders per symbol
          </p>
        </div>

        {Object.keys(allPositions).length === 0 ? (
          <Spinner text="Aggregating whale positions..." />
        ) : sentiment.length === 0 ? (
          <p className="text-muted text-sm text-center py-6">
            No position data available
          </p>
        ) : (
          <div className="space-y-1">
            {/* Summary */}
            <div className="text-xs text-muted mb-2 font-mono">
              {sentiment.length} symbols tracked{" "}
              <span className="text-muted/50">|</span>{" "}
              <span className="text-up">{sentiment.reduce((s, x) => s + x.longs, 0)} net long</span>{" "}
              <span className="text-muted/50">|</span>{" "}
              <span className="text-down">{sentiment.reduce((s, x) => s + x.shorts, 0)} net short</span>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mb-3 text-xs">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#22c55e]" />
                <span className="text-muted">Long</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-[#ef4444]" />
                <span className="text-muted">Short</span>
              </span>
            </div>

            {sentiment.map((s) => (
              <SentimentBar
                key={s.symbol}
                symbol={s.symbol}
                longs={s.longs}
                shorts={s.shorts}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
