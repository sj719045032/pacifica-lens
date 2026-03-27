import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import { LiveToggle } from "@/components/LiveBadge";
import { formatPrice, formatNumber } from "@/lib/types";
import type { PriceData } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

interface AccountData {
  balance: string;
  fee_level: string;
  maker_fee: string;
  taker_fee: string;
  account_equity: string;
  spot_collateral: string;
  available_to_spend: string;
  available_to_withdraw: string;
  pending_balance: string;
  pending_interest: string;
  total_margin_used: string;
  cross_mmr: string;
  positions_count: number;
  orders_count: number;
  stop_orders_count: number;
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

interface FundingHistory {
  history_id: string;
  symbol: string;
  side: string;
  amount: string;
  payout: string;
  rate: string;
  created_at: number;
}

interface LeaderboardEntry {
  address: string;
  username: string | null;
  pnl_1d: number;
  pnl_7d: number;
  pnl_30d: number;
  pnl_all_time: number;
  equity_current: number;
}

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const API_BASE = "https://api.pacifica.fi/api/v1";

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

function formatUsd(n: number): string {
  if (Math.abs(n) < 0.01) return "$0.00";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return sign + "$" + formatNumber(abs);
  return sign + "$" + abs.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return sign + n.toFixed(2) + "%";
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    " " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function feeTierLabel(level: string): string {
  const n = parseInt(level, 10);
  if (isNaN(n) || n <= 1) return "Tier 1";
  return `Tier ${n}`;
}

function formatPnl(val: number): string {
  const prefix = val >= 0 ? "+$" : "-$";
  return prefix + formatNumber(Math.abs(val));
}

function pnlColor(val: number): string {
  if (val > 0) return "text-up";
  if (val < 0) return "text-down";
  return "text-muted";
}

function getTradingHour(ts: number): number {
  return new Date(ts).getUTCHours();
}

function getSessionLabel(hour: number): string {
  if (hour >= 0 && hour < 8) return "Asian session (00:00-08:00 UTC)";
  if (hour >= 8 && hour < 16) return "European session (08:00-16:00 UTC)";
  return "US session (16:00-00:00 UTC)";
}

/* -------------------------------------------------------------------------- */
/*  Data fetchers                                                               */
/* -------------------------------------------------------------------------- */

async function fetchAccount(address: string): Promise<AccountData | null> {
  try {
    const res = await fetch(`${API_BASE}/account?account=${address}`);
    const json = await res.json();
    if (json.success) return json.data;
  } catch { /* ignore */ }
  return null;
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

async function fetchFundingHistory(address: string): Promise<FundingHistory[]> {
  try {
    const res = await fetch(`${API_BASE}/funding/history?account=${address}&limit=50`);
    const json = await res.json();
    if (json.success && Array.isArray(json.data)) return json.data;
  } catch { /* ignore */ }
  return [];
}

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

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function Portfolio() {
  const { prices } = usePacificaPrices();
  const { user, authenticated } = usePrivy();
  const walletAddress = authenticated ? user?.wallet?.address ?? null : null;

  /* -- Input state -- */
  const [inputAddr, setInputAddr] = useState("");
  const [activeAddr, setActiveAddr] = useState("");
  const [manualEntry, setManualEntry] = useState(false);

  /* -- Data state -- */
  const [account, setAccount] = useState<AccountData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [posHistory, setPosHistory] = useState<PositionHistory[]>([]);
  const [fundHistory, setFundHistory] = useState<FundingHistory[]>([]);

  /* -- Loading state -- */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);

  /* -- Leaderboard state -- */
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [lbLoading, setLbLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  /* ---- Analyze handler ---- */
  const analyze = useCallback(async (address: string) => {
    const trimmed = address.trim();
    if (!trimmed) return;

    setActiveAddr(trimmed);
    setInputAddr(trimmed);
    setLoading(true);
    setError("");
    setAccount(null);
    setPositions([]);
    setPosHistory([]);
    setFundHistory([]);

    const [acct, pos, posHist, fundHist] = await Promise.all([
      fetchAccount(trimmed),
      fetchPositions(trimmed),
      fetchPositionHistory(trimmed),
      fetchFundingHistory(trimmed),
    ]);

    if (!acct) {
      setError("This address has no trading history on Pacifica. Only accounts that have traded on Pacifica will show data. Try a whale address below.");
      setLoading(false);
      return;
    }

    setAccount(acct);
    setPositions(pos);
    setPosHistory(posHist);
    setFundHistory(fundHist);
    setLoading(false);
  }, []);

  /* ---- Computed: positions with mark prices ---- */
  const enrichedPositions = useMemo(() => {
    return positions.map((p) => {
      const priceData: PriceData | undefined = prices[p.symbol];
      const markPrice = priceData ? parseFloat(priceData.mark) : null;
      const entryPrice = parseFloat(p.entry_price);
      const amount = parseFloat(p.amount);

      let unrealizedPnl: number | null = null;
      let roe: number | null = null;

      if (markPrice !== null) {
        unrealizedPnl =
          p.side === "bid"
            ? (markPrice - entryPrice) * amount
            : (entryPrice - markPrice) * amount;
        const margin = parseFloat(p.margin);
        roe = margin > 0 ? (unrealizedPnl / margin) * 100 : 0;
      }

      return { ...p, markPrice, entryPrice, amount, unrealizedPnl, roe };
    });
  }, [positions, prices]);

  const totalUnrealizedPnl = useMemo(() => {
    let sum = 0;
    for (const p of enrichedPositions) {
      if (p.unrealizedPnl !== null) sum += p.unrealizedPnl;
    }
    return sum;
  }, [enrichedPositions]);

  /* ---- Computed: trade history stats ---- */
  const tradeStats = useMemo(() => {
    if (posHistory.length === 0) return null;

    let totalPnl = 0;
    let wins = 0;
    let losses = 0;
    let winSum = 0;
    let lossSum = 0;

    for (const t of posHistory) {
      const pnl = parseFloat(t.pnl);
      totalPnl += pnl;
      if (pnl > 0) {
        wins++;
        winSum += pnl;
      } else if (pnl < 0) {
        losses++;
        lossSum += pnl;
      }
    }

    const total = wins + losses;
    return {
      totalPnl,
      winRate: total > 0 ? (wins / total) * 100 : 0,
      avgWin: wins > 0 ? winSum / wins : 0,
      avgLoss: losses > 0 ? lossSum / losses : 0,
    };
  }, [posHistory]);

  /* ---- Computed: funding stats ---- */
  const fundingStats = useMemo(() => {
    if (fundHistory.length === 0) return null;

    let received = 0;
    let paid = 0;

    for (const f of fundHistory) {
      const payout = parseFloat(f.payout);
      if (payout > 0) received += payout;
      else paid += payout;
    }

    return {
      received,
      paid,
      net: received + paid,
    };
  }, [fundHistory]);

  /* ---- Fetch leaderboard on mount ---- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchLeaderboard();
        if (!cancelled && data.length > 0) setLeaderboard(data);
      } catch { /* ignore */ }
      if (!cancelled) setLbLoading(false);
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ---- Auto-refresh positions every 30s ---- */
  useEffect(() => {
    if (!activeAddr || !autoRefresh) return;
    const interval = setInterval(() => {
      fetchPositions(activeAddr).then(setPositions);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeAddr, autoRefresh]);

  /* ---- Render ---- */
  return (
    <div className="space-y-6 page-enter">
      {/* ---------- Address Input ---------- */}
      <div className={`section-card p-5 space-y-3 ${!activeAddr && !loading ? "mt-8 mb-4" : ""}`}>
        {!activeAddr && !loading && (
          <p className="text-muted text-sm mb-2">
            Enter any Solana address to view positions, trade history, and funding payments
          </p>
        )}
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter Solana address..."
            value={inputAddr}
            onChange={(e) => {
              setInputAddr(e.target.value);
              setManualEntry(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") analyze(inputAddr);
            }}
            className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-fg font-mono placeholder:text-muted focus:outline-none focus:border-accent/50 transition-all duration-200"
          />
          <button
            onClick={() => analyze(inputAddr)}
            disabled={loading || !inputAddr.trim()}
            className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Analyze"}
          </button>
        </div>
        {/* Top 10 Whale Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted">Top 10 whales — click to analyze:</span>
            {activeAddr && <LiveToggle active={autoRefresh} onToggle={() => setAutoRefresh((p) => !p)} intervalSec={30} />}
          </div>
          {lbLoading ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex-shrink-0 w-44 h-20 rounded-xl skeleton" />
              ))}
            </div>
          ) : leaderboard.length > 0 ? (
            <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-2 scroll-fade">
              {leaderboard.map((whale, idx) => (
                <button
                  key={whale.address}
                  onClick={() => analyze(whale.address)}
                  className={`flex-shrink-0 w-44 p-3 rounded-xl border transition-all duration-200 cursor-pointer text-left ${
                    activeAddr === whale.address
                      ? "bg-accent/10 border-accent/50 shadow-[0_0_16px_rgba(59,130,246,0.15)]"
                      : "bg-bg border-border hover:border-border hover:bg-card-hover"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <RankBadge rank={idx + 1} />
                    <span className="text-fg font-mono text-xs truncate">
                      {whale.username ?? truncateAddress(whale.address)}
                    </span>
                  </div>
                  <div className={`text-sm font-mono tabular-nums font-semibold ${pnlColor(whale.pnl_all_time)}`}>
                    {formatPnl(whale.pnl_all_time)}
                  </div>
                  <div className="text-xs text-muted font-mono tabular-nums mt-0.5">
                    ${formatNumber(whale.equity_current)}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* ---------- Connected Wallet Banner ---------- */}
      {walletAddress && !manualEntry && !activeAddr && (
        <div className="bg-accent/10 border border-accent/30 rounded-xl px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="text-sm text-fg">
              Wallet connected:{" "}
              <span className="font-mono text-accent">
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            </span>
          </div>
          <button
            onClick={() => analyze(walletAddress)}
            className="px-4 py-1.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors"
          >
            Analyze My Portfolio
          </button>
        </div>
      )}

      {/* ---------- Error ---------- */}
      {error && (
        <div className="bg-down/10 border border-down/30 rounded-xl px-5 py-3 text-sm text-down">
          {error}
        </div>
      )}

      {/* ---------- Loading Spinner ---------- */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 gap-3">
          <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <p className="text-muted text-sm">Fetching account data...</p>
        </div>
      )}

      {/* ---------- Account Overview ---------- */}
      {account && !loading && (
        <>
          <AccountOverview
            account={account}
            address={activeAddr}
            totalUnrealizedPnl={totalUnrealizedPnl}
          />

          <PositionsTable
            positions={enrichedPositions}
            totalUnrealizedPnl={totalUnrealizedPnl}
          />

          <TradeHistory history={posHistory} stats={tradeStats} />

          <FundingHistorySection history={fundHistory} stats={fundingStats} />

          <TradePatternAnalysis history={posHistory} positions={positions} />
        </>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Account Overview                                                            */
/* -------------------------------------------------------------------------- */

function AccountOverview({
  account,
  address,
  totalUnrealizedPnl,
}: {
  account: AccountData;
  address: string;
  totalUnrealizedPnl: number;
}) {
  const equity = parseFloat(account.account_equity);
  const available = parseFloat(account.available_to_spend);
  const marginUsed = parseFloat(account.total_margin_used);
  const marginPct = equity > 0 ? (marginUsed / equity) * 100 : 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold text-fg">Account Overview</h2>
        <span className="text-xs font-mono text-muted bg-card-hover px-2 py-0.5 rounded">
          {truncateAddress(address)}
        </span>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard label="Total Equity" value={formatUsd(equity)} className="" />
        <StatCard label="Available Balance" value={formatUsd(available)} className="" />
        <StatCard label="Margin Used" value={formatUsd(marginUsed)} className={marginPct > 80 ? "" : ""} />
        <StatCard
          label="Margin Used %"
          className={marginPct > 80 ? "" : marginPct > 50 ? "" : ""}
          value={
            <span className={marginPct > 80 ? "text-down" : marginPct > 50 ? "text-warn" : "text-fg"}>
              {marginPct.toFixed(1)}%
            </span>
          }
        />
        <StatCard
          label="Unrealized PnL"
          className={totalUnrealizedPnl >= 0 ? "" : ""}
          value={
            <span className={totalUnrealizedPnl >= 0 ? "text-up" : "text-down"}>
              {formatUsd(totalUnrealizedPnl)}
            </span>
          }
        />
        <StatCard
          label="Positions"
          value={String(account.positions_count)}
          className=""
        />
        <StatCard
          label="Open Orders"
          value={String(account.orders_count)}
          className=""
        />
        <StatCard
          label="Fee Tier"
          className=""
          value={
            <span className="text-accent">
              {feeTierLabel(account.fee_level)}
              <span className="text-xs text-muted ml-2">
                M: {(parseFloat(account.maker_fee) * 100).toFixed(3)}% / T: {(parseFloat(account.taker_fee) * 100).toFixed(3)}%
              </span>
            </span>
          }
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Positions Table                                                             */
/* -------------------------------------------------------------------------- */

interface EnrichedPosition extends Omit<Position, "amount"> {
  markPrice: number | null;
  entryPrice: number;
  amount: number;
  unrealizedPnl: number | null;
  roe: number | null;
}

function PositionsTable({
  positions,
  totalUnrealizedPnl,
}: {
  positions: EnrichedPosition[];
  totalUnrealizedPnl: number;
}) {
  if (positions.length === 0) {
    return (
      <div className="section-card p-8 text-center">
        <p className="text-muted text-sm">No open positions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Current Positions</h2>
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm zebra-rows">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                {["Symbol", "Side", "Size", "Entry Price", "Current Price", "Unrealized PnL", "ROE %", "Liq Price"].map(
                  (label) => (
                    <th
                      key={label}
                      className={`px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap ${
                        label === "Symbol" || label === "Side" ? "text-left" : "text-right"
                      }`}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {positions.map((p, i) => {
                const isLong = p.side === "bid";
                const liqPrice = parseFloat(p.liquidation_price);

                return (
                  <tr
                    key={p.symbol + "-" + i}
                    className="border-b border-border/50 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">
                      {p.symbol}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          isLong
                            ? "bg-up/15 text-up"
                            : "bg-down/15 text-down"
                        }`}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      {p.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatPrice(p.entryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      {p.markPrice !== null ? (
                        "$" + formatPrice(p.markPrice)
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        p.unrealizedPnl === null
                          ? "text-muted"
                          : p.unrealizedPnl >= 0
                            ? "text-up"
                            : "text-down"
                      }`}
                    >
                      {p.unrealizedPnl !== null ? formatUsd(p.unrealizedPnl) : "--"}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        p.roe === null
                          ? "text-muted"
                          : p.roe >= 0
                            ? "text-up"
                            : "text-down"
                      }`}
                    >
                      {p.roe !== null ? formatPct(p.roe) : "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-warn whitespace-nowrap">
                      {liqPrice > 0 ? "$" + formatPrice(liqPrice) : "--"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t border-border">
                <td colSpan={5} className="px-4 py-3 text-right text-xs text-muted font-medium uppercase tracking-wider">
                  Total Unrealized PnL
                </td>
                <td
                  className={`px-4 py-3 text-right font-mono tabular-nums font-semibold whitespace-nowrap ${
                    totalUnrealizedPnl >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {formatUsd(totalUnrealizedPnl)}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trade History                                                               */
/* -------------------------------------------------------------------------- */

function TradeHistory({
  history,
  stats,
}: {
  history: PositionHistory[];
  stats: { totalPnl: number; winRate: number; avgWin: number; avgLoss: number } | null;
}) {
  if (history.length === 0) {
    return (
      <div className="section-card p-8 text-center">
        <p className="text-muted text-sm">No trade history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Trade History</h2>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard
            label="Total Realized PnL"
            className={stats.totalPnl >= 0 ? "" : ""}
            value={
              <span className={stats.totalPnl >= 0 ? "text-up" : "text-down"}>
                {formatUsd(stats.totalPnl)}
              </span>
            }
          />
          <StatCard
            label="Win Rate"
            className={stats.winRate >= 50 ? "" : ""}
            value={
              <span className={stats.winRate >= 50 ? "text-up" : "text-down"}>
                {stats.winRate.toFixed(1)}%
              </span>
            }
          />
          <StatCard
            label="Avg Win"
            className=""
            value={
              <span className="text-up">{formatUsd(stats.avgWin)}</span>
            }
          />
          <StatCard
            label="Avg Loss"
            className=""
            value={
              <span className="text-down">{formatUsd(stats.avgLoss)}</span>
            }
          />
        </div>
      )}

      {/* Table */}
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm zebra-rows">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                {["Time", "Symbol", "Side", "Size", "Entry", "Exit", "PnL ($)", "PnL (%)"].map(
                  (label) => (
                    <th
                      key={label}
                      className={`px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap ${
                        label === "Time" || label === "Symbol" || label === "Side"
                          ? "text-left"
                          : "text-right"
                      }`}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {history.map((t) => {
                const pnl = parseFloat(t.pnl);
                const entryPrice = parseFloat(t.entry_price);
                const exitPrice = parseFloat(t.price);
                const amount = parseFloat(t.amount);
                const cost = entryPrice * amount;
                const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                const isLong = t.side === "bid";

                return (
                  <tr
                    key={t.history_id}
                    className="border-b border-border/50 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {formatTimestamp(t.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">
                      {t.symbol}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          isLong
                            ? "bg-up/15 text-up"
                            : "bg-down/15 text-down"
                        }`}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      {amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatPrice(entryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatPrice(exitPrice)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        pnl >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatUsd(pnl)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        pnlPct >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatPct(pnlPct)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Funding History                                                             */
/* -------------------------------------------------------------------------- */

function FundingHistorySection({
  history,
  stats,
}: {
  history: FundingHistory[];
  stats: { received: number; paid: number; net: number } | null;
}) {
  if (history.length === 0) {
    return (
      <div className="section-card p-8 text-center">
        <p className="text-muted text-sm">No funding history</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Funding History</h2>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <StatCard
            label="Total Received"
            className=""
            value={<span className="text-up">{formatUsd(stats.received)}</span>}
          />
          <StatCard
            label="Total Paid"
            className=""
            value={<span className="text-down">{formatUsd(stats.paid)}</span>}
          />
          <StatCard
            label="Net Funding"
            className={stats.net >= 0 ? "" : ""}
            value={
              <span className={stats.net >= 0 ? "text-up" : "text-down"}>
                {formatUsd(stats.net)}
              </span>
            }
          />
        </div>
      )}

      {/* Table */}
      <div className="section-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm zebra-rows">
            <thead>
              <tr className="border-b border-border bg-bg/50">
                {["Time", "Symbol", "Side", "Position Size", "Rate", "Payout"].map(
                  (label) => (
                    <th
                      key={label}
                      className={`px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider whitespace-nowrap ${
                        label === "Time" || label === "Symbol" || label === "Side"
                          ? "text-left"
                          : "text-right"
                      }`}
                    >
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {history.map((f) => {
                const payout = parseFloat(f.payout);
                const rate = parseFloat(f.rate);
                const isLong = f.side === "bid";

                return (
                  <tr
                    key={f.history_id}
                    className="border-b border-border/50 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-4 py-3 text-muted text-xs whitespace-nowrap">
                      {formatTimestamp(f.created_at)}
                    </td>
                    <td className="px-4 py-3 font-medium text-fg whitespace-nowrap">
                      {f.symbol}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          isLong
                            ? "bg-up/15 text-up"
                            : "bg-down/15 text-down"
                        }`}
                      >
                        {isLong ? "LONG" : "SHORT"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      {parseFloat(f.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        rate >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {(rate * 100).toFixed(4)}%
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        payout >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatUsd(payout)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stat Card                                                                   */
/* -------------------------------------------------------------------------- */

function StatCard({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`stat-card ${className ?? ""}`}>
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-lg font-semibold font-mono text-fg">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Rank Badge                                                                  */
/* -------------------------------------------------------------------------- */

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-yellow-500/20 text-yellow-500">
        1
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-gray-400/20 text-gray-400">
        2
      </span>
    );
  }
  if (rank === 3) {
    return (
      <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold bg-orange-500/20 text-orange-500">
        3
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-medium text-muted bg-border/50">
      {rank}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Trade Pattern Analysis                                                      */
/* -------------------------------------------------------------------------- */

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

    // Average hold time
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

    // Most active trading session
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
      <div className="section-card p-8 text-center">
        <p className="text-muted text-sm">Not enough data for pattern analysis</p>
      </div>
    );
  }

  const iconMap: Record<string, React.ReactNode> = {
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
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Trade Pattern Analysis</h2>
      <div className="section-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-accent">
            <path d="M12 2a4 4 0 014 4v1a1 1 0 001 1h1a4 4 0 010 8h-1a1 1 0 00-1 1v1a4 4 0 01-8 0v-1a1 1 0 00-1-1H6a4 4 0 010-8h1a1 1 0 001-1V6a4 4 0 014-4z" />
          </svg>
          <h3 className="text-fg font-semibold">
            Pattern <span className="gradient-text">Insights</span>
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
    </div>
  );
}
