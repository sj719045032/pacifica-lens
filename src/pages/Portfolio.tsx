import { useCallback, useEffect, useMemo, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
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

/* -------------------------------------------------------------------------- */
/*  Constants                                                                   */
/* -------------------------------------------------------------------------- */

const API_BASE = "https://api.pacifica.fi/api/v1";

const WHALE_ADDRESSES = [
  "YjCD9Gek6MVY9t3MLEGYYdZLeaF6MZrpgZraayWsv9E",
  "HtC4WT6JhKz8eojNigfiqSWykG74kfQmyDeM9f753aPQ",
  "GTU92nBC8LMyt9W4Qqc319BFR1vpkNNPAbt4QCnX7kZ6",
];

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

/* -------------------------------------------------------------------------- */
/*  Component                                                                   */
/* -------------------------------------------------------------------------- */

export default function Portfolio() {
  const { prices, connected } = usePacificaPrices();

  /* -- Input state -- */
  const [inputAddr, setInputAddr] = useState("");
  const [activeAddr, setActiveAddr] = useState("");

  /* -- Data state -- */
  const [account, setAccount] = useState<AccountData | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [posHistory, setPosHistory] = useState<PositionHistory[]>([]);
  const [fundHistory, setFundHistory] = useState<FundingHistory[]>([]);

  /* -- Loading state -- */
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
      setError("Account not found or API error. Please verify the address.");
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

  /* ---- Auto-refresh positions every 30s ---- */
  useEffect(() => {
    if (!activeAddr) return;
    const interval = setInterval(() => {
      fetchPositions(activeAddr).then(setPositions);
    }, 30_000);
    return () => clearInterval(interval);
  }, [activeAddr]);

  /* ---- Render ---- */
  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Portfolio Analyzer</h1>
          <p className="text-xs text-muted mt-1">
            Analyze any Pacifica account -- positions, trade history, and funding
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-up animate-pulse" : "bg-down"
            }`}
          />
          <span className="text-xs text-muted">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* ---------- Address Input ---------- */}
      <div className="bg-card rounded-xl border border-border p-5 space-y-3">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Enter Solana address..."
            value={inputAddr}
            onChange={(e) => setInputAddr(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") analyze(inputAddr);
            }}
            className="flex-1 bg-bg border border-border rounded-lg px-4 py-2.5 text-sm text-fg font-mono placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
          <button
            onClick={() => analyze(inputAddr)}
            disabled={loading || !inputAddr.trim()}
            className="px-6 py-2.5 bg-accent text-white text-sm font-semibold rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Loading..." : "Analyze"}
          </button>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted">Try a whale:</span>
          {WHALE_ADDRESSES.map((addr) => (
            <button
              key={addr}
              onClick={() => analyze(addr)}
              className="text-xs font-mono text-accent hover:text-accent/80 bg-accent/10 px-2 py-1 rounded-lg transition-colors"
            >
              {truncateAddress(addr)}
            </button>
          ))}
        </div>
      </div>

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

          {/* ---------- Footer ---------- */}
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
        <StatCard label="Total Equity" value={formatUsd(equity)} />
        <StatCard label="Available Balance" value={formatUsd(available)} />
        <StatCard label="Margin Used" value={formatUsd(marginUsed)} />
        <StatCard
          label="Margin Used %"
          value={
            <span className={marginPct > 80 ? "text-down" : marginPct > 50 ? "text-warn" : "text-fg"}>
              {marginPct.toFixed(1)}%
            </span>
          }
        />
        <StatCard
          label="Unrealized PnL"
          value={
            <span className={totalUnrealizedPnl >= 0 ? "text-up" : "text-down"}>
              {formatUsd(totalUnrealizedPnl)}
            </span>
          }
        />
        <StatCard
          label="Positions"
          value={String(account.positions_count)}
        />
        <StatCard
          label="Open Orders"
          value={String(account.orders_count)}
        />
        <StatCard
          label="Fee Tier"
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

interface EnrichedPosition extends Position {
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
      <div className="bg-card rounded-xl border border-border p-8 text-center">
        <p className="text-muted text-sm">No open positions</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold text-fg">Current Positions</h2>
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
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
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      {p.amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatPrice(p.entryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      {p.markPrice !== null ? (
                        "$" + formatPrice(p.markPrice)
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
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
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        p.roe === null
                          ? "text-muted"
                          : p.roe >= 0
                            ? "text-up"
                            : "text-down"
                      }`}
                    >
                      {p.roe !== null ? formatPct(p.roe) : "--"}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-warn whitespace-nowrap">
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
                  className={`px-4 py-3 text-right font-mono font-semibold whitespace-nowrap ${
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
      <div className="bg-card rounded-xl border border-border p-8 text-center">
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
            value={
              <span className={stats.totalPnl >= 0 ? "text-up" : "text-down"}>
                {formatUsd(stats.totalPnl)}
              </span>
            }
          />
          <StatCard
            label="Win Rate"
            value={
              <span className={stats.winRate >= 50 ? "text-up" : "text-down"}>
                {stats.winRate.toFixed(1)}%
              </span>
            }
          />
          <StatCard
            label="Avg Win"
            value={
              <span className="text-up">{formatUsd(stats.avgWin)}</span>
            }
          />
          <StatCard
            label="Avg Loss"
            value={
              <span className="text-down">{formatUsd(stats.avgLoss)}</span>
            }
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
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
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      {amount.toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatPrice(entryPrice)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatPrice(exitPrice)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        pnl >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatUsd(pnl)}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
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
      <div className="bg-card rounded-xl border border-border p-8 text-center">
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
            value={<span className="text-up">{formatUsd(stats.received)}</span>}
          />
          <StatCard
            label="Total Paid"
            value={<span className="text-down">{formatUsd(stats.paid)}</span>}
          />
          <StatCard
            label="Net Funding"
            value={
              <span className={stats.net >= 0 ? "text-up" : "text-down"}>
                {formatUsd(stats.net)}
              </span>
            }
          />
        </div>
      )}

      {/* Table */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
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
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      {parseFloat(f.amount).toLocaleString("en-US", { maximumFractionDigits: 6 })}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        rate >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {(rate * 100).toFixed(4)}%
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
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
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3">
      <p className="text-xs text-muted mb-1">{label}</p>
      <p className="text-lg font-semibold font-mono text-fg">{value}</p>
    </div>
  );
}
