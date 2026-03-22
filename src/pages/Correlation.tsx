import { useMemo, useRef, useEffect, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import type { PriceData } from "@/lib/types";
import {
  getCategory,
  formatNumber,
  formatFundingRate,
} from "@/lib/types";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

type AssetClass = "crypto" | "stock" | "commodity" | "forex" | "index";

interface ClassStats {
  label: string;
  key: AssetClass;
  color: string;
  colorBg: string;
  colorBorder: string;
  avgChange: number;
  totalVolume: number;
  totalOI: number;
  marketCount: number;
  avgFunding: number;
  bestSymbol: string;
  bestChange: number;
  worstSymbol: string;
  worstChange: number;
}

interface DivergenceAlert {
  id: string;
  severity: "high" | "medium" | "low";
  title: string;
  description: string;
  tag: string;
}

interface Mover {
  symbol: string;
  category: AssetClass;
  change: number;
  volume: number;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const CLASS_META: Record<
  AssetClass,
  { label: string; color: string; colorBg: string; colorBorder: string }
> = {
  crypto: {
    label: "Crypto",
    color: "#3b82f6",
    colorBg: "bg-[#3b82f6]/12",
    colorBorder: "border-l-[#3b82f6]",
  },
  stock: {
    label: "Stocks",
    color: "#a855f7",
    colorBg: "bg-[#a855f7]/12",
    colorBorder: "border-l-[#a855f7]",
  },
  commodity: {
    label: "Commodities",
    color: "#eab308",
    colorBg: "bg-[#eab308]/12",
    colorBorder: "border-l-[#eab308]",
  },
  forex: {
    label: "Forex",
    color: "#22c55e",
    colorBg: "bg-[#22c55e]/12",
    colorBorder: "border-l-[#22c55e]",
  },
  index: {
    label: "Index",
    color: "#ef4444",
    colorBg: "bg-[#ef4444]/12",
    colorBorder: "border-l-[#ef4444]",
  },
};

const CLASS_ORDER: AssetClass[] = [
  "crypto",
  "stock",
  "commodity",
  "forex",
  "index",
];

const SNAPSHOT_INTERVAL = 10_000;
const MAX_SNAPSHOTS = 360; // 1 hour of 10s snapshots

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function changePct(p: PriceData): number {
  const mark = parseFloat(p.mark);
  const yesterday = parseFloat(p.yesterday_price);
  if (!yesterday || !mark) return 0;
  return ((mark - yesterday) / yesterday) * 100;
}

function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(2) + "%";
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

function categoryBadgeInline(cat: AssetClass) {
  const meta = CLASS_META[cat];
  return (
    <span
      className="px-1.5 py-0.5 text-[10px] font-semibold rounded"
      style={{
        backgroundColor: meta.color + "20",
        color: meta.color,
      }}
    >
      {meta.label}
    </span>
  );
}

/* ================================================================== */
/*  Data computation                                                   */
/* ================================================================== */

function computeClassStats(
  prices: Record<string, PriceData>,
): ClassStats[] {
  const buckets: Record<AssetClass, PriceData[]> = {
    crypto: [],
    stock: [],
    commodity: [],
    forex: [],
    index: [],
  };

  for (const p of Object.values(prices)) {
    const cat = getCategory(p.symbol) as AssetClass;
    buckets[cat].push(p);
  }

  return CLASS_ORDER.map((key) => {
    const items = buckets[key];
    const meta = CLASS_META[key];

    let totalVolume = 0;
    let totalOI = 0;
    let weightedChangeSum = 0;
    let weightSum = 0;
    let fundingSum = 0;
    let fundingCount = 0;
    let bestSymbol = "";
    let bestChange = -Infinity;
    let worstSymbol = "";
    let worstChange = Infinity;

    for (const p of items) {
      const vol = parseFloat(p.volume_24h) || 0;
      const mark = parseFloat(p.mark) || 0;
      const oi = (parseFloat(p.open_interest) || 0) * mark;
      const chg = changePct(p);
      const funding = parseFloat(p.funding);

      totalVolume += vol;
      totalOI += oi;
      weightedChangeSum += chg * vol;
      weightSum += vol;

      if (!isNaN(funding)) {
        fundingSum += funding;
        fundingCount++;
      }

      if (chg > bestChange) {
        bestChange = chg;
        bestSymbol = p.symbol;
      }
      if (chg < worstChange) {
        worstChange = chg;
        worstSymbol = p.symbol;
      }
    }

    const avgChange = weightSum > 0 ? weightedChangeSum / weightSum : 0;
    const avgFunding = fundingCount > 0 ? fundingSum / fundingCount : 0;

    if (items.length === 0) {
      bestChange = 0;
      worstChange = 0;
    }

    return {
      label: meta.label,
      key,
      color: meta.color,
      colorBg: meta.colorBg,
      colorBorder: meta.colorBorder,
      avgChange,
      totalVolume,
      totalOI,
      marketCount: items.length,
      avgFunding,
      bestSymbol,
      bestChange,
      worstSymbol,
      worstChange,
    };
  });
}

/* ================================================================== */
/*  Divergence alert engine                                            */
/* ================================================================== */

function generateDivergenceAlerts(
  classStats: ClassStats[],
  prices: Record<string, PriceData>,
): DivergenceAlert[] {
  const alerts: DivergenceAlert[] = [];
  const statsMap = new Map(classStats.map((s) => [s.key, s]));

  const crypto = statsMap.get("crypto");
  const stocks = statsMap.get("stock");
  const commodity = statsMap.get("commodity");
  const forex = statsMap.get("forex");

  // 1. Cross-class divergence pairs
  const pairs: [AssetClass, AssetClass][] = [
    ["crypto", "stock"],
    ["crypto", "commodity"],
    ["stock", "commodity"],
    ["crypto", "forex"],
  ];

  for (const [a, b] of pairs) {
    const sa = statsMap.get(a);
    const sb = statsMap.get(b);
    if (!sa || !sb || sa.marketCount === 0 || sb.marketCount === 0) continue;
    const diff = Math.abs(sa.avgChange - sb.avgChange);
    if (
      diff > 1.5 &&
      Math.sign(sa.avgChange) !== Math.sign(sb.avgChange) &&
      sa.avgChange !== 0 &&
      sb.avgChange !== 0
    ) {
      const severity = diff > 3 ? "high" : "medium";
      alerts.push({
        id: `div-${a}-${b}`,
        severity,
        title: `${sa.label} (${fmtPct(sa.avgChange)}) diverging from ${sb.label} (${fmtPct(sb.avgChange)})`,
        description: `Cross-asset decorrelation signal: ${sa.label} and ${sb.label} are moving in opposite directions with a ${diff.toFixed(1)}% spread.`,
        tag: "decorrelation",
      });
    }
  }

  // 2. Gold vs BTC divergence
  const btcData = prices["BTC"];
  const xauData = prices["XAU"];
  if (btcData && xauData) {
    const btcChg = changePct(btcData);
    const xauChg = changePct(xauData);
    if (
      Math.abs(btcChg - xauChg) > 2 &&
      Math.sign(btcChg) !== Math.sign(xauChg) &&
      btcChg !== 0 &&
      xauChg !== 0
    ) {
      alerts.push({
        id: "div-btc-xau",
        severity: Math.abs(btcChg - xauChg) > 4 ? "high" : "medium",
        title: `Gold (XAU ${fmtPct(xauChg)}) and BTC (${fmtPct(btcChg)}) moving in opposite directions`,
        description: `Traditional safe haven and digital gold diverging. This may signal a shift in macro risk appetite.`,
        tag: "safe-haven",
      });
    }
  }

  // 3. Funding rate sentiment check
  if (crypto && crypto.marketCount > 0) {
    const cryptoPrices = Object.values(prices).filter(
      (p) => getCategory(p.symbol) === "crypto",
    );
    const negativeFundingCount = cryptoPrices.filter(
      (p) => parseFloat(p.funding) < 0,
    ).length;
    const positiveFundingCount = cryptoPrices.filter(
      (p) => parseFloat(p.funding) > 0,
    ).length;

    if (negativeFundingCount > cryptoPrices.length * 0.7 && cryptoPrices.length > 5) {
      alerts.push({
        id: "funding-all-negative",
        severity: negativeFundingCount > cryptoPrices.length * 0.85 ? "high" : "medium",
        title: `Funding rates negative across ${negativeFundingCount}/${cryptoPrices.length} crypto markets`,
        description: `Widespread negative funding indicates bearish sentiment. Shorts are dominant across most crypto perpetual markets.`,
        tag: "bearish-sentiment",
      });
    } else if (positiveFundingCount > cryptoPrices.length * 0.7 && cryptoPrices.length > 5) {
      alerts.push({
        id: "funding-all-positive",
        severity: positiveFundingCount > cryptoPrices.length * 0.85 ? "high" : "medium",
        title: `Funding rates positive across ${positiveFundingCount}/${cryptoPrices.length} crypto markets`,
        description: `Widespread positive funding indicates bullish sentiment. Longs are paying premium across most crypto perpetual markets.`,
        tag: "bullish-sentiment",
      });
    }
  }

  // 4. Commodity volume surge
  if (commodity && commodity.marketCount > 0) {
    const avgVolPerMarket = classStats.reduce(
      (s, c) => s + (c.marketCount > 0 ? c.totalVolume / c.marketCount : 0),
      0,
    ) / classStats.filter((c) => c.marketCount > 0).length;

    const commodityAvgVol = commodity.totalVolume / commodity.marketCount;
    if (commodityAvgVol > avgVolPerMarket * 2 && avgVolPerMarket > 0) {
      alerts.push({
        id: "commodity-volume-surge",
        severity: commodityAvgVol > avgVolPerMarket * 3 ? "high" : "medium",
        title: `Commodity sector showing unusual volume surge`,
        description: `Commodities averaging ${fmtDollar(commodityAvgVol)} volume per market vs ${fmtDollar(avgVolPerMarket)} overall average. Potential macro catalyst at play.`,
        tag: "volume-surge",
      });
    }
  }

  // 5. Stock sector divergence from market
  if (stocks && stocks.marketCount > 0 && crypto && crypto.marketCount > 0) {
    const allAvgChange = classStats.reduce(
      (s, c) => s + c.avgChange * c.marketCount,
      0,
    ) / classStats.reduce((s, c) => s + c.marketCount, 0);

    if (
      Math.abs(stocks.avgChange - allAvgChange) > 2 &&
      stocks.avgChange !== 0
    ) {
      const direction = stocks.avgChange > allAvgChange ? "outperforming" : "underperforming";
      alerts.push({
        id: "stock-divergence",
        severity: Math.abs(stocks.avgChange - allAvgChange) > 3 ? "high" : "medium",
        title: `Stocks ${direction} overall market by ${Math.abs(stocks.avgChange - allAvgChange).toFixed(1)}%`,
        description: `Stock perps averaging ${fmtPct(stocks.avgChange)} vs overall market ${fmtPct(allAvgChange)}. Equity-specific catalyst may be driving the move.`,
        tag: "sector-rotation",
      });
    }
  }

  // 6. Forex stability check
  if (forex && forex.marketCount > 0) {
    if (Math.abs(forex.avgChange) > 1) {
      alerts.push({
        id: "forex-volatility",
        severity: Math.abs(forex.avgChange) > 2 ? "high" : "medium",
        title: `Unusual forex volatility: ${fmtPct(forex.avgChange)} avg move`,
        description: `Forex pairs rarely move this much. Significant currency move may signal macro policy changes or geopolitical events.`,
        tag: "macro-event",
      });
    }
  }

  return alerts;
}

/* ================================================================== */
/*  Mover computation                                                  */
/* ================================================================== */

function computeMovers(prices: Record<string, PriceData>): {
  gainers: Mover[];
  losers: Mover[];
} {
  const all: Mover[] = Object.values(prices).map((p) => ({
    symbol: p.symbol,
    category: getCategory(p.symbol) as AssetClass,
    change: changePct(p),
    volume: parseFloat(p.volume_24h) || 0,
  }));

  const sorted = [...all].sort((a, b) => b.change - a.change);
  return {
    gainers: sorted.slice(0, 5),
    losers: sorted.slice(-5).reverse(),
  };
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function ClassPerformanceCard({ stats }: { stats: ClassStats }) {
  const isPositive = stats.avgChange >= 0;

  return (
    <div
      className={`stat-card border-l-[3px] ${stats.colorBorder} ${
        isPositive ? "glow-green" : "glow-red"
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: stats.color }}
        />
        <p className="text-[11px] text-muted uppercase tracking-wider font-medium">
          {stats.label}
        </p>
        <span className="ml-auto text-[10px] font-mono text-muted">
          {stats.marketCount} mkt{stats.marketCount !== 1 ? "s" : ""}
        </span>
      </div>

      <p
        className={`text-2xl font-bold font-mono tabular-nums ${
          isPositive ? "text-up" : "text-down"
        }`}
      >
        {fmtPct(stats.avgChange)}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
        <div>
          <span className="text-muted">Volume</span>
          <p className="font-mono tabular-nums text-fg">
            ${formatNumber(stats.totalVolume)}
          </p>
        </div>
        <div>
          <span className="text-muted">Open Interest</span>
          <p className="font-mono tabular-nums text-fg">
            ${formatNumber(stats.totalOI)}
          </p>
        </div>
      </div>
    </div>
  );
}

function AlertCard({ alert }: { alert: DivergenceAlert }) {
  const severityStyles = {
    high: "border-l-[#ef4444]/60 bg-[#ef4444]/5",
    medium: "border-l-[#eab308]/60 bg-[#eab308]/5",
    low: "border-l-muted/40",
  };

  const severityBadge = {
    high: "bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]/30",
    medium: "bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30",
    low: "bg-muted/15 text-muted border-muted/30",
  };

  const tagColors: Record<string, string> = {
    decorrelation: "text-[#eab308]/90 bg-[#eab308]/10",
    "safe-haven": "text-[#3b82f6]/90 bg-[#3b82f6]/10",
    "bearish-sentiment": "text-[#ef4444]/90 bg-[#ef4444]/10",
    "bullish-sentiment": "text-[#22c55e]/90 bg-[#22c55e]/10",
    "volume-surge": "text-[#a855f7]/90 bg-[#a855f7]/10",
    "sector-rotation": "text-[#3b82f6]/90 bg-[#3b82f6]/10",
    "macro-event": "text-[#ef4444]/90 bg-[#ef4444]/10",
  };

  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 border-l-3 ${severityStyles[alert.severity]} hover:bg-card-hover transition-[background-color,box-shadow] duration-200 ease-out hover:shadow-card`}
    >
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <svg
            className={`w-5 h-5 ${
              alert.severity === "high"
                ? "text-down"
                : alert.severity === "medium"
                  ? "text-warn"
                  : "text-muted"
            }`}
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
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-fg font-semibold text-sm">{alert.title}</h3>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${severityBadge[alert.severity]}`}
            >
              {alert.severity}
            </span>
          </div>
          <p className="text-muted text-sm leading-relaxed mb-2">
            {alert.description}
          </p>
          <span
            className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
              tagColors[alert.tag] ?? "text-accent/80 bg-accent/10"
            }`}
          >
            {alert.tag}
          </span>
        </div>
      </div>
    </div>
  );
}

function FundingBar({
  label,
  value,
  color,
  maxAbs,
}: {
  label: string;
  value: number;
  color: string;
  maxAbs: number;
}) {
  const pct = maxAbs > 0 ? Math.abs(value) / maxAbs : 0;
  const barWidth = Math.max(pct * 100, 2);
  const isPositive = value >= 0;

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-muted w-24 text-right shrink-0 font-medium">
        {label}
      </span>
      <div className="flex-1 flex items-center gap-2">
        <div className="flex-1 h-6 bg-bg rounded-md relative overflow-hidden">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full h-full relative">
              {/* Center line */}
              <div className="absolute left-1/2 top-0 bottom-0 w-px bg-border" />
              {/* Bar */}
              <div
                className="absolute top-1 bottom-1 rounded transition-all duration-500"
                style={{
                  backgroundColor: color + "40",
                  borderLeft: isPositive ? "none" : `2px solid ${color}`,
                  borderRight: isPositive ? `2px solid ${color}` : "none",
                  left: isPositive ? "50%" : `${50 - barWidth / 2}%`,
                  width: `${barWidth / 2}%`,
                  transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)",
                }}
              />
            </div>
          </div>
        </div>
        <span
          className={`text-xs font-mono tabular-nums w-20 shrink-0 ${
            isPositive ? "text-up" : "text-down"
          }`}
        >
          {formatFundingRate(String(value))}
        </span>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Page Component                                                */
/* ================================================================== */

export default function Correlation() {
  const { prices, connected } = usePacificaPrices();
  const snapshotsRef = useRef<Array<Record<string, number>>>([]);
  const lastSnapshotRef = useRef(0);

  /* Accumulate price snapshots every 10 seconds */
  useEffect(() => {
    const priceList = Object.values(prices);
    if (priceList.length === 0) return;

    const now = Date.now();
    if (now - lastSnapshotRef.current < SNAPSHOT_INTERVAL) return;
    lastSnapshotRef.current = now;

    const snap: Record<string, number> = {};
    for (const p of priceList) {
      snap[p.symbol] = parseFloat(p.mark) || 0;
    }

    snapshotsRef.current.push(snap);
    if (snapshotsRef.current.length > MAX_SNAPSHOTS) {
      snapshotsRef.current.shift();
    }
  }, [prices]);

  /* Tick for live updates */
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 5_000);
    return () => clearInterval(t);
  }, []);

  /* Derived data */
  const hasData = Object.keys(prices).length > 0;

  const classStats = useMemo(() => computeClassStats(prices), [prices]);

  const alerts = useMemo(
    () => generateDivergenceAlerts(classStats, prices),
    [classStats, prices],
  );

  const { gainers, losers } = useMemo(() => computeMovers(prices), [prices]);

  const maxAbsFunding = useMemo(() => {
    const vals = classStats.map((s) => Math.abs(s.avgFunding));
    return Math.max(...vals, 0.0001);
  }, [classStats]);

  const snapshotCount = snapshotsRef.current.length;

  /* Loading state */
  if (!hasData) {
    return (
      <div className="space-y-5 page-enter">
        {/* Stat cards skeleton */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="stat-card">
              <div className="skeleton h-3 w-20 mb-3" />
              <div className="skeleton h-7 w-28" />
            </div>
          ))}
        </div>
        {/* Table skeleton */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-4"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-24 ml-auto" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-muted text-sm text-center animate-pulse">
          {connected
            ? "Waiting for market data..."
            : "Connecting to Pacifica..."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5 page-enter">
      {/* ---- Header ---- */}
      <div className="flex items-center justify-between stagger-item">
        <div>
          <h1 className="text-lg font-bold text-fg">
            Cross-Market Correlation
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Crypto, stocks, commodities, forex, and indices -- all on one
            DEX. Analyze cross-asset dynamics unique to Pacifica.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {snapshotCount > 0 && (
            <span className="text-[10px] font-mono text-muted">
              {snapshotCount} snapshot{snapshotCount !== 1 ? "s" : ""}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-[10px] font-medium text-accent/80 bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
            <span className="w-1.5 h-1.5 bg-up rounded-full animate-pulse-glow" />
            Live
          </span>
        </div>
      </div>

      {/* ---- 1. Asset Class Performance Cards ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger-item">
        {classStats.map((s) => (
          <ClassPerformanceCard key={s.key} stats={s} />
        ))}
      </div>

      {/* ---- 2. Cross-Asset Comparison Table ---- */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card stagger-item">
        <div className="px-4 py-3 border-b border-border flex items-center gap-2">
          <svg
            className="w-4 h-4 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <h2 className="text-fg font-semibold text-sm uppercase tracking-wider">
            Cross-Asset Comparison
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                {[
                  { label: "Asset Class", align: "text-left" },
                  { label: "Avg Change", align: "text-right" },
                  { label: "Best Performer", align: "text-right" },
                  { label: "Worst Performer", align: "text-right" },
                  { label: "Total Volume", align: "text-right" },
                  { label: "Avg Funding (1h)", align: "text-right" },
                ].map((col) => (
                  <th
                    key={col.label}
                    className={`px-4 py-3 font-semibold text-muted text-[11px] uppercase tracking-widest ${col.align} whitespace-nowrap`}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {classStats.map((s) => {
                if (s.marketCount === 0) return null;

                // Highlight divergence: mark row if this class diverges from avg
                const overallAvg =
                  classStats.reduce(
                    (sum, c) => sum + c.avgChange * c.marketCount,
                    0,
                  ) / classStats.reduce((sum, c) => sum + c.marketCount, 0);
                const isDiverging =
                  Math.abs(s.avgChange - overallAvg) > 1.5 &&
                  Math.sign(s.avgChange) !== Math.sign(overallAvg) &&
                  overallAvg !== 0;

                return (
                  <tr
                    key={s.key}
                    className={`border-b border-border/50 hover:bg-card-hover transition-[background-color] duration-150 ease-out row-glow ${
                      isDiverging ? "bg-[#eab308]/5" : ""
                    }`}
                  >
                    {/* Class */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: s.color }}
                        />
                        <span className="font-medium text-fg">{s.label}</span>
                        <span className="text-[10px] font-mono text-muted">
                          ({s.marketCount})
                        </span>
                        {isDiverging && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-[#eab308]/15 text-[#eab308]">
                            DIVERGING
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Avg Change */}
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        s.avgChange > 0
                          ? "text-up"
                          : s.avgChange < 0
                            ? "text-down"
                            : "text-muted"
                      }`}
                    >
                      {fmtPct(s.avgChange)}
                    </td>

                    {/* Best Performer */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-medium text-fg mr-1.5">
                        {s.bestSymbol}
                      </span>
                      <span className="font-mono tabular-nums text-up text-xs">
                        {fmtPct(s.bestChange)}
                      </span>
                    </td>

                    {/* Worst Performer */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <span className="font-medium text-fg mr-1.5">
                        {s.worstSymbol}
                      </span>
                      <span className="font-mono tabular-nums text-down text-xs">
                        {fmtPct(s.worstChange)}
                      </span>
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatNumber(s.totalVolume)}
                    </td>

                    {/* Avg Funding */}
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
                        s.avgFunding > 0
                          ? "text-up"
                          : s.avgFunding < 0
                            ? "text-down"
                            : "text-muted"
                      }`}
                    >
                      {formatFundingRate(String(s.avgFunding))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- 3. Divergence Alerts ---- */}
      <div className="stagger-item">
        <div className="flex items-center gap-2 mb-3">
          <svg
            className="w-4 h-4 text-warn"
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
          <h2 className="text-fg font-semibold text-sm uppercase tracking-wider">
            Divergence Alerts
          </h2>
          {alerts.length > 0 && (
            <span className="text-[10px] font-mono text-muted ml-1">
              {alerts.length} signal{alerts.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {alerts.length === 0 ? (
          <div className="bg-card rounded-xl border border-border p-6 text-center">
            <p className="text-muted text-sm">
              No significant cross-asset divergences detected right now.
              Markets are moving in relative harmony.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((a) => (
              <AlertCard key={a.id} alert={a} />
            ))}
          </div>
        )}
      </div>

      {/* ---- 4. Top Movers Across All Classes ---- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-item">
        {/* Gainers */}
        <div className="bg-card rounded-xl border border-border overflow-hidden border-t-2 border-t-[#22c55e]/50">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <svg
              className="w-4 h-4 text-up"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <h3 className="text-fg font-semibold text-sm">
              Top 5 Gainers
            </h3>
            <span className="text-[10px] text-muted font-mono ml-auto">
              all markets
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {gainers.map((m, idx) => (
              <div
                key={m.symbol}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-card-hover transition-[background-color] duration-150 row-glow"
              >
                <span className="text-[10px] font-mono text-muted w-4">
                  {idx + 1}
                </span>
                <span className="font-medium text-fg text-sm">
                  {m.symbol}
                </span>
                {categoryBadgeInline(m.category)}
                <span className="ml-auto font-mono tabular-nums text-up text-sm">
                  {fmtPct(m.change)}
                </span>
                <span className="font-mono tabular-nums text-muted text-xs w-20 text-right">
                  ${formatNumber(m.volume)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="bg-card rounded-xl border border-border overflow-hidden border-t-2 border-t-[#ef4444]/50">
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <svg
              className="w-4 h-4 text-down"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            <h3 className="text-fg font-semibold text-sm">
              Top 5 Losers
            </h3>
            <span className="text-[10px] text-muted font-mono ml-auto">
              all markets
            </span>
          </div>
          <div className="divide-y divide-border/50">
            {losers.map((m, idx) => (
              <div
                key={m.symbol}
                className="px-4 py-2.5 flex items-center gap-3 hover:bg-card-hover transition-[background-color] duration-150 row-glow"
              >
                <span className="text-[10px] font-mono text-muted w-4">
                  {idx + 1}
                </span>
                <span className="font-medium text-fg text-sm">
                  {m.symbol}
                </span>
                {categoryBadgeInline(m.category)}
                <span className="ml-auto font-mono tabular-nums text-down text-sm">
                  {fmtPct(m.change)}
                </span>
                <span className="font-mono tabular-nums text-muted text-xs w-20 text-right">
                  ${formatNumber(m.volume)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- 5. Funding Rate Comparison ---- */}
      <div className="bg-card rounded-xl border border-border p-5 stagger-item">
        <div className="flex items-center gap-2 mb-4">
          <svg
            className="w-4 h-4 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" />
          </svg>
          <h2 className="text-fg font-semibold text-sm uppercase tracking-wider">
            Avg Funding Rate by Asset Class
          </h2>
        </div>
        <div className="space-y-3">
          {classStats
            .filter((s) => s.marketCount > 0)
            .map((s) => (
              <FundingBar
                key={s.key}
                label={s.label}
                value={s.avgFunding}
                color={s.color}
                maxAbs={maxAbsFunding}
              />
            ))}
        </div>
        <p className="text-[10px] text-muted mt-3 text-center">
          Positive funding = longs pay shorts | Negative funding = shorts
          pay longs
        </p>
      </div>

      {/* ---- Footer ---- */}
      <div className="border-t border-border pt-4 pb-2 flex flex-col items-center gap-2 stagger-item">
        <p className="text-xs text-muted">
          Powered by{" "}
          <span className="text-accent font-semibold text-neon">
            Pacifica API
          </span>{" "}
          | Cross-asset analytics unique to Pacifica DEX
        </p>
        <span className="text-[10px] font-medium text-accent/80 bg-accent/10 px-2.5 py-1 rounded-full">
          Built for Pacifica Hackathon 2026
        </span>
      </div>
    </div>
  );
}
