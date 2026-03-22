import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import type { PriceData } from "@/lib/types";
import { formatNumber, formatPrice } from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface LeaderboardEntry {
  address: string;
  username: string | null;
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  pnl_all_time: number;
  equity_current: number;
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
  created_at: number;
  updated_at: number;
}

interface PositionHistory {
  history_id: string;
  order_id: string;
  symbol: string;
  amount: string;
  price: string;
  entry_price: string;
  fee: string;
  pnl: string;
  event_type: string;
  side: string;
  created_at: number;
  cause: string;
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

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const API_BASE = "https://api.pacifica.fi/api/v1";
const REFRESH_INTERVAL = 15_000;

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return addr.slice(0, 4) + "..." + addr.slice(-3);
}

function formatUsd(n: number): string {
  if (Math.abs(n) < 0.01) return "$0.00";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return sign + "$" + formatNumber(abs);
  return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPnl(val: number): string {
  const prefix = val >= 0 ? "+$" : "-$";
  return prefix + formatNumber(Math.abs(val));
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function pnlColor(val: number): string {
  if (val > 0) return "text-up";
  if (val < 0) return "text-down";
  return "text-muted";
}

function timeAgo(ts: number): string {
  const now = Date.now();
  const diff = now - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return `${Math.floor(days / 7)}w ago`;
}

function dayLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.floor((today.getTime() - target.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTradingHour(ts: number): number {
  return new Date(ts).getUTCHours();
}

function getSessionLabel(hour: number): string {
  if (hour >= 0 && hour < 8) return "Asian session (00:00-08:00 UTC)";
  if (hour >= 8 && hour < 16) return "European session (08:00-16:00 UTC)";
  return "US session (16:00-00:00 UTC)";
}

/* ------------------------------------------------------------------ */
/*  Data fetchers                                                      */
/* ------------------------------------------------------------------ */

async function fetchLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/leaderboard`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) {
      const all: LeaderboardEntry[] = json.data.map((t: Record<string, unknown>) => ({
        address: String(t.address ?? ""),
        username: t.username ? String(t.username) : null,
        pnl_1d: Number(t.pnl_1d) || 0,
        pnl_7d: Number(t.pnl_7d) || 0,
        pnl_30d: Number(t.pnl_30d) || 0,
        pnl_all_time: Number(t.pnl_all_time) || 0,
        equity_current: Number(t.equity_current) || 0,
      }));
      all.sort((a, b) => b.pnl_all_time - a.pnl_all_time);
      return all.slice(0, 10);
    }
  } catch { /* ignore */ }
  return [];
}

async function fetchPositions(address: string): Promise<Position[]> {
  try {
    const res = await fetch(`${API_BASE}/positions?account=${address}`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch { /* ignore */ }
  return [];
}

async function fetchPositionHistory(address: string): Promise<PositionHistory[]> {
  try {
    const res = await fetch(`${API_BASE}/positions/history?account=${address}&limit=50`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch { /* ignore */ }
  return [];
}

async function fetchAccount(address: string): Promise<AccountInfo | null> {
  try {
    const res = await fetch(`${API_BASE}/account?account=${address}`);
    const json = await res.json();
    if (json.success) return json.data;
  } catch { /* ignore */ }
  return null;
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
/*  Rank Badge                                                         */
/* ------------------------------------------------------------------ */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-500">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-gray-400/20 text-gray-400">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold bg-orange-500/20 text-orange-500">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium text-muted bg-border/50">
      {rank}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Whale Selector Card                                                */
/* ------------------------------------------------------------------ */

function WhaleCard({
  whale,
  rank,
  selected,
  onClick,
}: {
  whale: LeaderboardEntry;
  rank: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-shrink-0 w-48 p-4 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
        selected
          ? "bg-accent/10 border-accent/50 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
          : "bg-card border-border hover:border-border hover:bg-card-hover"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <RankBadge rank={rank} />
        <span className="text-fg font-mono text-sm truncate">
          {whale.username ?? truncateAddress(whale.address)}
        </span>
      </div>
      <div className={`text-sm font-mono tabular-nums font-semibold ${pnlColor(whale.pnl_all_time)}`}>
        {formatPnl(whale.pnl_all_time)}
      </div>
      <div className="text-xs text-muted font-mono tabular-nums mt-1">
        ${formatNumber(whale.equity_current)}
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Performance Cards                                                  */
/* ------------------------------------------------------------------ */

function PerformanceCards({
  whale,
  account,
  history,
  positionCount,
}: {
  whale: LeaderboardEntry;
  account: AccountInfo | null;
  history: PositionHistory[];
  positionCount: number;
}) {
  const stats = useMemo(() => {
    if (history.length === 0) return { winRate: 0, wins: 0, total: 0 };
    let wins = 0;
    let total = 0;
    for (const t of history) {
      const pnl = parseFloat(t.pnl);
      if (pnl > 0) wins++;
      if (pnl !== 0) total++;
    }
    return { winRate: total > 0 ? (wins / total) * 100 : 0, wins, total };
  }, [history]);

  const cards = [
    {
      label: "PnL (1d)",
      value: <span className={pnlColor(whale.pnl_1d)}>{formatPnl(whale.pnl_1d)}</span>,
    },
    {
      label: "PnL (7d)",
      value: <span className={pnlColor(whale.pnl_7d)}>{formatPnl(whale.pnl_7d)}</span>,
    },
    {
      label: "PnL (30d)",
      value: <span className={pnlColor(whale.pnl_30d)}>{formatPnl(whale.pnl_30d)}</span>,
    },
    {
      label: "All-time PnL",
      value: <span className={pnlColor(whale.pnl_all_time)}>{formatPnl(whale.pnl_all_time)}</span>,
    },
    {
      label: "Current Equity",
      value: formatUsd(account?.account_equity ?? whale.equity_current),
    },
    {
      label: "Win Rate",
      value: (
        <span className={stats.winRate >= 50 ? "text-up" : stats.winRate > 0 ? "text-down" : "text-muted"}>
          {stats.winRate.toFixed(1)}%
          <span className="text-xs text-muted ml-1">
            ({stats.wins}/{stats.total})
          </span>
        </span>
      ),
    },
    {
      label: "Active Positions",
      value: String(positionCount),
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
      {cards.map((c) => (
        <div key={c.label} className="stat-card">
          <p className="text-xs text-muted mb-1">{c.label}</p>
          <p className="text-base font-semibold font-mono tabular-nums text-fg">{c.value}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Current Positions Table                                            */
/* ------------------------------------------------------------------ */

function PositionsTable({
  positions,
  prices,
}: {
  positions: Position[];
  prices: Record<string, PriceData>;
}) {
  const enriched = useMemo(() => {
    return positions.map((p) => {
      const entry = parseFloat(p.entry_price);
      const amount = parseFloat(p.amount);
      const margin = parseFloat(p.margin);
      const priceData = prices[p.symbol];
      const mark = priceData ? parseFloat(priceData.mark) : null;

      let upnl: number | null = null;
      let roe: number | null = null;
      const sizeUsd = entry * Math.abs(amount);

      if (mark !== null) {
        upnl =
          p.side.toLowerCase() === "bid"
            ? (mark - entry) * Math.abs(amount)
            : (entry - mark) * Math.abs(amount);
        roe = margin > 0 ? (upnl / margin) * 100 : 0;
      }

      return { ...p, entry, amount, mark, upnl, roe, sizeUsd, margin };
    });
  }, [positions, prices]);

  const biggestIdx = useMemo(() => {
    let maxSize = 0;
    let idx = -1;
    enriched.forEach((p, i) => {
      if (p.sizeUsd > maxSize) {
        maxSize = p.sizeUsd;
        idx = i;
      }
    });
    return idx;
  }, [enriched]);

  if (positions.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted text-sm">No open positions</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Symbol", "Direction", "Size ($)", "Entry Price", "Current Price", "Unrealized PnL", "ROE %"].map(
                (label) => (
                  <th
                    key={label}
                    className={`px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap ${
                      label === "Symbol" || label === "Direction" ? "text-left" : "text-right"
                    }`}
                  >
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {enriched.map((p, i) => {
              const isLong = p.side.toLowerCase() === "bid";
              const isBiggest = i === biggestIdx;

              return (
                <tr
                  key={p.symbol + "-" + i}
                  className={`border-b border-border/50 hover:bg-card-hover transition-colors ${
                    isBiggest ? "border-l-2 border-l-accent" : ""
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">
                    {p.symbol}
                    {isBiggest && (
                      <span className="ml-2 text-[10px] font-medium text-accent bg-accent/10 px-1.5 py-0.5 rounded">
                        BIGGEST
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded ${
                        isLong ? "bg-up/15 text-up" : "bg-down/15 text-down"
                      }`}
                    >
                      {isLong ? "LONG" : "SHORT"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                    ${formatNumber(p.sizeUsd)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                    ${formatPrice(p.entry)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                    {p.mark !== null ? `$${formatPrice(p.mark)}` : <span className="text-muted">--</span>}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                      p.upnl === null ? "text-muted" : p.upnl >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {p.upnl !== null ? formatUsd(p.upnl) : "--"}
                  </td>
                  <td
                    className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                      p.roe === null ? "text-muted" : p.roe >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {p.roe !== null ? formatPct(p.roe) : "--"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent Trades Timeline                                             */
/* ------------------------------------------------------------------ */

function TradesTimeline({ history }: { history: PositionHistory[] }) {
  const grouped = useMemo(() => {
    const groups: { label: string; trades: PositionHistory[] }[] = [];
    let currentLabel = "";

    const sorted = [...history].sort((a, b) => b.created_at - a.created_at);

    for (const trade of sorted) {
      const label = dayLabel(trade.created_at);
      if (label !== currentLabel) {
        groups.push({ label, trades: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].trades.push(trade);
    }
    return groups;
  }, [history]);

  if (history.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted text-sm">No trade history</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {grouped.map((group) => (
        <div key={group.label}>
          <div className="flex items-center gap-3 mb-3">
            <span className="text-xs font-semibold text-accent uppercase tracking-wider">
              {group.label}
            </span>
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted font-mono">
              {group.trades.length} trade{group.trades.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="space-y-2">
            {group.trades.map((t) => {
              const pnl = parseFloat(t.pnl);
              const entryPrice = parseFloat(t.entry_price);
              const exitPrice = parseFloat(t.price);
              const amount = parseFloat(t.amount);
              const sizeUsd = entryPrice * Math.abs(amount);
              const isLong = t.side === "bid";

              return (
                <div
                  key={t.history_id}
                  className="bg-card rounded-xl border border-border p-3 flex items-center gap-4 hover:bg-card-hover transition-colors"
                >
                  {/* Time */}
                  <span className="text-xs text-muted w-16 flex-shrink-0 font-mono">
                    {timeAgo(t.created_at)}
                  </span>

                  {/* Symbol + Direction */}
                  <div className="flex items-center gap-2 w-32 flex-shrink-0">
                    <span className="font-medium text-fg text-sm">{t.symbol}</span>
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                        isLong ? "bg-up/15 text-up" : "bg-down/15 text-down"
                      }`}
                    >
                      {isLong ? "LONG" : "SHORT"}
                    </span>
                  </div>

                  {/* Size */}
                  <span className="text-xs text-muted font-mono tabular-nums w-20 flex-shrink-0 text-right">
                    ${formatNumber(sizeUsd)}
                  </span>

                  {/* Entry -> Exit */}
                  <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-fg flex-shrink-0">
                    <span>${formatPrice(entryPrice)}</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted flex-shrink-0">
                      <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                    <span>${formatPrice(exitPrice)}</span>
                  </div>

                  {/* PnL */}
                  <span className={`ml-auto text-sm font-mono tabular-nums font-semibold ${pnlColor(pnl)}`}>
                    {formatPnl(pnl)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Trade Pattern Analysis                                             */
/* ------------------------------------------------------------------ */

function TradePatternAnalysis({
  history,
  positions,
}: {
  history: PositionHistory[];
  positions: Position[];
}) {
  const insights = useMemo(() => {
    if (history.length === 0) return [];

    const lines: { icon: string; text: string; color: string }[] = [];

    // Symbol volume distribution
    const volumeBySymbol: Record<string, number> = {};
    let totalVolume = 0;
    for (const t of history) {
      const vol = Math.abs(parseFloat(t.amount)) * parseFloat(t.entry_price);
      volumeBySymbol[t.symbol] = (volumeBySymbol[t.symbol] ?? 0) + vol;
      totalVolume += vol;
    }
    const topSymbols = Object.entries(volumeBySymbol)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    if (topSymbols.length > 0 && totalVolume > 0) {
      const topPct = topSymbols.reduce((s, [, v]) => s + v, 0) / totalVolume * 100;
      const names = topSymbols.map(([s]) => s).join(" and ");
      lines.push({
        icon: "target",
        text: `Prefers ${names} (${topPct.toFixed(0)}% of volume)`,
        color: "text-accent",
      });
    }

    // Average hold time (based on created_at timestamps of consecutive trades of same symbol)
    const sortedTrades = [...history].sort((a, b) => a.created_at - b.created_at);
    if (sortedTrades.length >= 2) {
      const holdTimes: number[] = [];
      const symbolTrades: Record<string, number[]> = {};
      for (const t of sortedTrades) {
        if (!symbolTrades[t.symbol]) symbolTrades[t.symbol] = [];
        symbolTrades[t.symbol].push(t.created_at);
      }
      for (const timestamps of Object.values(symbolTrades)) {
        for (let i = 1; i < timestamps.length; i++) {
          holdTimes.push(timestamps[i] - timestamps[i - 1]);
        }
      }
      if (holdTimes.length > 0) {
        const avgMs = holdTimes.reduce((s, v) => s + v, 0) / holdTimes.length;
        const avgHours = avgMs / 3_600_000;
        let holdLabel: string;
        if (avgHours < 1) holdLabel = `~${Math.round(avgHours * 60)} minutes`;
        else if (avgHours < 24) holdLabel = `~${Math.round(avgHours)} hours`;
        else holdLabel = `~${Math.round(avgHours / 24)} days`;
        lines.push({
          icon: "clock",
          text: `Average hold time: ${holdLabel}`,
          color: "text-fg",
        });
      }
    }

    // Win rate
    let wins = 0;
    let losses = 0;
    let winSum = 0;
    let lossSum = 0;
    for (const t of history) {
      const pnl = parseFloat(t.pnl);
      if (pnl > 0) { wins++; winSum += pnl; }
      else if (pnl < 0) { losses++; lossSum += Math.abs(pnl); }
    }
    const total = wins + losses;
    if (total > 0) {
      const wr = (wins / total) * 100;
      lines.push({
        icon: "chart",
        text: `Win rate: ${wr.toFixed(0)}% (${wins}/${total} trades profitable)`,
        color: wr >= 50 ? "text-up" : "text-down",
      });
    }

    // Average winning/losing trade
    if (wins > 0 || losses > 0) {
      const avgWin = wins > 0 ? winSum / wins : 0;
      const avgLoss = losses > 0 ? lossSum / losses : 0;
      lines.push({
        icon: "scale",
        text: `Average winning trade: +$${formatNumber(avgWin)} | Average losing trade: -$${formatNumber(avgLoss)}`,
        color: "text-fg",
      });
    }

    // Current net positioning
    if (positions.length > 0) {
      const longs = positions.filter((p) => p.side.toLowerCase() === "bid").length;
      const shorts = positions.filter((p) => p.side.toLowerCase() === "ask").length;
      const bias = longs > shorts ? "net long" : longs < shorts ? "net short" : "neutral";
      lines.push({
        icon: "position",
        text: `Currently ${bias} with ${positions.length} position${positions.length !== 1 ? "s" : ""}`,
        color: longs > shorts ? "text-up" : longs < shorts ? "text-down" : "text-muted",
      });
    }

    // Most active trading hours
    const hourBuckets: Record<string, number> = { asian: 0, european: 0, us: 0 };
    for (const t of history) {
      const h = getTradingHour(t.created_at);
      if (h >= 0 && h < 8) hourBuckets.asian++;
      else if (h >= 8 && h < 16) hourBuckets.european++;
      else hourBuckets.us++;
    }
    const maxSession = Object.entries(hourBuckets).sort((a, b) => b[1] - a[1])[0];
    if (maxSession && maxSession[1] > 0) {
      const peakHours = history.map((t) => getTradingHour(t.created_at));
      const avgHour = peakHours.reduce((s, v) => s + v, 0) / peakHours.length;
      lines.push({
        icon: "clock",
        text: `Most active during ${getSessionLabel(Math.round(avgHour))}`,
        color: "text-fg",
      });
    }

    return lines;
  }, [history, positions]);

  if (insights.length === 0) {
    return (
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted text-sm">Not enough data for pattern analysis</p>
      </div>
    );
  }

  const iconMap: Record<string, JSX.Element> = {
    target: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
      </svg>
    ),
    clock: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    chart: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    scale: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />
      </svg>
    ),
    position: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2v20M2 12h20" />
      </svg>
    ),
  };

  return (
    <div className="bg-card rounded-xl border border-border p-5">
      <div className="flex items-center gap-2 mb-4">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
          <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z" />
        </svg>
        <h3 className="text-fg font-semibold">
          Trade Pattern <span className="gradient-text">Analysis</span>
        </h3>
      </div>
      <div className="space-y-3">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-bg/50 border border-border/50">
            <span className={`flex-shrink-0 mt-0.5 ${insight.color}`}>
              {iconMap[insight.icon] ?? iconMap.chart}
            </span>
            <p className="text-sm text-fg leading-relaxed">{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */

export default function CopyTracker() {
  const { prices, connected } = usePacificaPrices();

  /* -- Leaderboard state -- */
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const [lbError, setLbError] = useState<string | null>(null);

  /* -- Selected whale state -- */
  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [history, setHistory] = useState<PositionHistory[]>([]);
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [whaleLoading, setWhaleLoading] = useState(false);
  const [whaleError, setWhaleError] = useState<string | null>(null);

  /* -- Auto-refresh tracking -- */
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastRefresh, setLastRefresh] = useState<number>(0);

  /* ---- Fetch leaderboard on mount ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchLeaderboard();
        if (cancelled) return;
        if (data.length > 0) {
          setLeaderboard(data);
        } else {
          setLbError("No leaderboard data available");
        }
      } catch {
        if (!cancelled) setLbError("Failed to load leaderboard");
      } finally {
        if (!cancelled) setLbLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---- Load whale data when selected ---- */
  const loadWhaleData = useCallback(async (address: string) => {
    setWhaleLoading(true);
    setWhaleError(null);

    try {
      const [pos, hist, acct] = await Promise.all([
        fetchPositions(address),
        fetchPositionHistory(address),
        fetchAccount(address),
      ]);
      setPositions(pos);
      setHistory(hist);
      setAccount(acct);
      setLastRefresh(Date.now());
    } catch {
      setWhaleError("Failed to load whale data");
    } finally {
      setWhaleLoading(false);
    }
  }, []);

  const selectWhale = useCallback(
    (address: string) => {
      if (selectedAddr === address) return;
      setSelectedAddr(address);
      setPositions([]);
      setHistory([]);
      setAccount(null);
      loadWhaleData(address);
    },
    [selectedAddr, loadWhaleData],
  );

  /* ---- Auto-refresh positions every 15s ---- */
  useEffect(() => {
    if (!selectedAddr) return;

    if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);

    refreshTimerRef.current = setInterval(async () => {
      const pos = await fetchPositions(selectedAddr);
      setPositions(pos);
      setLastRefresh(Date.now());
    }, REFRESH_INTERVAL);

    return () => {
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
    };
  }, [selectedAddr]);

  /* ---- Currently selected whale data ---- */
  const selectedWhale = useMemo(
    () => leaderboard.find((w) => w.address === selectedAddr) ?? null,
    [leaderboard, selectedAddr],
  );

  /* ---- Render ---- */
  return (
    <div className="space-y-6 page-enter">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-fg">
            Whale <span className="gradient-text">Copy Tracker</span>
          </h1>
          <p className="text-sm text-muted mt-1">
            Track top traders' positions and trades in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-up animate-pulse" : "bg-down"
            }`}
          />
          <span className="text-xs text-muted">
            {connected ? "Live" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* ---- Whale Selector ---- */}
      <section className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-fg font-semibold">
            Top 10 Traders
          </h2>
          <p className="text-xs text-muted">
            Select a whale to track
          </p>
        </div>

        {lbLoading ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex-shrink-0 w-48 h-24 rounded-xl skeleton" />
            ))}
          </div>
        ) : lbError ? (
          <p className="text-down text-sm text-center py-6">{lbError}</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto pb-2 scroll-fade">
            {leaderboard.map((whale, idx) => (
              <WhaleCard
                key={whale.address}
                whale={whale}
                rank={idx + 1}
                selected={selectedAddr === whale.address}
                onClick={() => selectWhale(whale.address)}
              />
            ))}
          </div>
        )}
      </section>

      {/* ---- Selected Whale Dashboard ---- */}
      {selectedAddr && (
        <>
          {/* Whale header bar */}
          <div className="flex items-center justify-between bg-card rounded-xl border border-border px-5 py-3">
            <div className="flex items-center gap-3">
              <span className="text-fg font-semibold">Tracking:</span>
              <span className="font-mono text-accent text-sm bg-accent/10 px-2.5 py-1 rounded-lg">
                {selectedWhale?.username ?? truncateAddress(selectedAddr)}
              </span>
              <span className="text-xs text-muted font-mono">
                {truncateAddress(selectedAddr)}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lastRefresh > 0 && (
                <span className="text-[10px] text-muted font-mono">
                  Updated {timeAgo(lastRefresh)}
                </span>
              )}
              <span className="inline-flex items-center gap-1.5 text-[10px] text-accent font-medium bg-accent/10 px-2 py-1 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
                Auto-refresh 15s
              </span>
            </div>
          </div>

          {whaleLoading ? (
            <Spinner text="Loading whale data..." />
          ) : whaleError ? (
            <div className="bg-down/10 border border-down/30 rounded-xl px-5 py-3 text-sm text-down">
              {whaleError}
            </div>
          ) : (
            <>
              {/* Performance Cards */}
              {selectedWhale && (
                <section>
                  <h2 className="text-lg font-semibold text-fg mb-3">Performance</h2>
                  <PerformanceCards
                    whale={selectedWhale}
                    account={account}
                    history={history}
                    positionCount={positions.length}
                  />
                </section>
              )}

              {/* Current Positions */}
              <section>
                <h2 className="text-lg font-semibold text-fg mb-3">
                  Current Positions
                  {positions.length > 0 && (
                    <span className="text-sm font-normal text-muted ml-2">
                      ({positions.length})
                    </span>
                  )}
                </h2>
                <PositionsTable positions={positions} prices={prices} />
              </section>

              {/* Recent Trades Timeline */}
              <section>
                <h2 className="text-lg font-semibold text-fg mb-3">
                  Recent Trades
                  {history.length > 0 && (
                    <span className="text-sm font-normal text-muted ml-2">
                      (Last {history.length})
                    </span>
                  )}
                </h2>
                <TradesTimeline history={history} />
              </section>

              {/* Trade Pattern Analysis */}
              <section>
                <TradePatternAnalysis history={history} positions={positions} />
              </section>
            </>
          )}
        </>
      )}

      {/* Empty state when no whale is selected */}
      {!selectedAddr && !lbLoading && (
        <div className="bg-card rounded-xl border border-border p-12 text-center space-y-3">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-muted/50">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          <p className="text-muted text-sm">
            Select a whale above to start tracking their trades and positions
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="border-t border-border pt-4 pb-2 flex flex-col items-center gap-2">
        <p className="text-xs text-muted">
          Powered by{" "}
          <span className="text-accent font-semibold">Pacifica API</span> |
          Real-time WebSocket + REST data
        </p>
        <span className="text-[10px] font-medium text-accent/80 bg-accent/10 px-2.5 py-1 rounded-full">
          Built for Pacifica Hackathon 2026
        </span>
      </div>
    </div>
  );
}
