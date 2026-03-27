import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import { LiveToggle } from "@/components/LiveBadge";
import type { PriceData, MarketInfo } from "@/lib/types";
import {
  getCategory,

  formatFundingRate,
  annualizedFunding,
} from "@/lib/types";

/* ================================================================== */
/*  Types                                                              */
/* ================================================================== */

interface Insight {
  type: "bullish" | "bearish" | "neutral" | "alert";
  symbol: string;
  title: string;
  description: string;
  confidence: "high" | "medium" | "low";
  signals: string[];
  timestamp: number;
}

interface LeaderboardEntry {
  address: string;
  username: string | null;
  pnl_1d: number;
  pnl_7d: number;
  pnl_all_time: number;
  equity_current: number;
  oi_current: number;
}

interface BookLevel {
  p: string;
  a: string;
  n: number;
}

interface BookData {
  s: string;
  l: [BookLevel[], BookLevel[]];
}

interface BookSnapshot {
  symbol: string;
  bidDepth: number;
  askDepth: number;
  ratio: number;
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const API_BASE = "https://api.pacifica.fi/api/v1";
const ANALYZE_INTERVAL = 30_000;
const TOP_BOOK_SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "XRP"];

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function changePct(p: PriceData): number {
  const mark = parseFloat(p.mark);
  const yesterday = parseFloat(p.yesterday_price);
  if (!yesterday) return 0;
  return ((mark - yesterday) / yesterday) * 100;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function fmtDollar(n: number): string {
  if (Math.abs(n) >= 1e9) return "$" + (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return "$" + (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return "$" + (n / 1e3).toFixed(1) + "K";
  return "$" + n.toFixed(2);
}

function timeAgo(ts: number): string {
  const diff = Math.floor((Date.now() - ts) / 1000);
  if (diff < 5) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

/* ================================================================== */
/*  Insight Generation Engine                                          */
/* ================================================================== */

function generateInsights(
  prices: Record<string, PriceData>,
  marketInfo: Record<string, MarketInfo>,
  leaderboard: LeaderboardEntry[],
  orderbooks: BookSnapshot[],
): Insight[] {
  const insights: Insight[] = [];
  const now = Date.now();
  const priceList = Object.values(prices);
  if (priceList.length === 0) return insights;

  /* ---- 1. Funding Rate Anomaly ---- */
  for (const p of priceList) {
    const rate = parseFloat(p.funding);
    if (isNaN(rate)) continue;
    const ratePct = rate * 100;
    const annual = annualizedFunding(p.funding);
    if (Math.abs(ratePct) > 0.005) {
      const side = rate > 0 ? "Longs" : "Shorts";
      insights.push({
        type: rate > 0 ? "bearish" : "bullish",
        symbol: p.symbol,
        title: `Extreme Funding on ${p.symbol}`,
        description: `${p.symbol} funding at ${ratePct >= 0 ? "+" : ""}${ratePct.toFixed(4)}% hourly (${annual >= 0 ? "+" : ""}${annual.toFixed(1)}% annualized). ${side} are paying significant premium.`,
        confidence: Math.abs(ratePct) > 0.01 ? "high" : "medium",
        signals: ["funding-anomaly", "premium"],
        timestamp: now,
      });
    }
  }

  /* ---- 2. Funding Flip ---- */
  for (const p of priceList) {
    const current = parseFloat(p.funding);
    const next = parseFloat(p.next_funding);
    if (isNaN(current) || isNaN(next)) continue;
    if (current !== 0 && next !== 0 && Math.sign(current) !== Math.sign(next)) {
      insights.push({
        type: "alert",
        symbol: p.symbol,
        title: `Funding Flip on ${p.symbol}`,
        description: `Funding rate flip detected on ${p.symbol}: current ${formatFundingRate(p.funding)} -> next ${formatFundingRate(p.next_funding)}. Sentiment shifting.`,
        confidence: "high",
        signals: ["funding-flip", "sentiment-shift"],
        timestamp: now,
      });
    }
  }

  /* ---- 3. Volume Surge ---- */
  const volumes = priceList.map((p) => {
    const vol = parseFloat(p.volume_24h) || 0;
    const oi = (parseFloat(p.open_interest) || 0) * (parseFloat(p.mark) || 0);
    return { symbol: p.symbol, vol, oi };
  });
  const oiNonZero = volumes.filter((v) => v.oi > 0);
  if (oiNonZero.length > 0) {
    const medianVolPerOi =
      median(oiNonZero.map((v) => (v.oi > 0 ? v.vol / v.oi : 0)));
    for (const v of oiNonZero) {
      const expected = medianVolPerOi * v.oi;
      if (expected > 0 && v.vol > expected * 3) {
        insights.push({
          type: "alert",
          symbol: v.symbol,
          title: `Volume Surge on ${v.symbol}`,
          description: `Unusual volume spike on ${v.symbol} \u2014 ${fmtDollar(v.vol)} (${(v.vol / expected).toFixed(1)}x above expected). Watch for breakout.`,
          confidence: v.vol > expected * 5 ? "high" : "medium",
          signals: ["volume-surge", "breakout-watch"],
          timestamp: now,
        });
      }
    }
  }

  /* ---- 4. OI Concentration ---- */
  const oiValues = priceList
    .map((p) => ({
      symbol: p.symbol,
      oi: (parseFloat(p.open_interest) || 0) * (parseFloat(p.mark) || 0),
    }))
    .sort((a, b) => b.oi - a.oi);
  const totalOI = oiValues.reduce((s, v) => s + v.oi, 0);
  if (totalOI > 0 && oiValues.length >= 3) {
    const top3OI = oiValues[0].oi + oiValues[1].oi + oiValues[2].oi;
    const pct = (top3OI / totalOI) * 100;
    if (pct > 80) {
      const topSymbols = oiValues
        .slice(0, 3)
        .map((v) => v.symbol)
        .join(", ");
      insights.push({
        type: "neutral",
        symbol: "MARKET",
        title: "OI Highly Concentrated",
        description: `Open interest highly concentrated in ${topSymbols}. ${pct.toFixed(1)}% of total OI (${fmtDollar(totalOI)}) in top 3 markets.`,
        confidence: pct > 90 ? "high" : "medium",
        signals: ["oi-concentration", "market-structure"],
        timestamp: now,
      });
    }
  }

  /* ---- 5. Orderbook Imbalance ---- */
  for (const book of orderbooks) {
    if (book.bidDepth + book.askDepth === 0) continue;
    const ratio = book.bidDepth / (book.askDepth || 1);
    if (ratio > 1.5) {
      insights.push({
        type: "bullish",
        symbol: book.symbol,
        title: `Bid-Heavy Orderbook on ${book.symbol}`,
        description: `Significant orderbook imbalance on ${book.symbol}: ${ratio.toFixed(2)}x more bid depth. Price may move up.`,
        confidence: ratio > 2 ? "high" : "medium",
        signals: ["book-imbalance", "bid-heavy"],
        timestamp: now,
      });
    } else if (ratio < 0.67) {
      const inv = (1 / ratio).toFixed(2);
      insights.push({
        type: "bearish",
        symbol: book.symbol,
        title: `Ask-Heavy Orderbook on ${book.symbol}`,
        description: `Significant orderbook imbalance on ${book.symbol}: ${inv}x more ask depth. Price may move down.`,
        confidence: ratio < 0.5 ? "high" : "medium",
        signals: ["book-imbalance", "ask-heavy"],
        timestamp: now,
      });
    }
  }

  /* ---- 6. Multi-Asset Divergence ---- */
  const btcData = prices["BTC"];
  if (btcData) {
    const btcChange = changePct(btcData);
    const alts = priceList.filter(
      (p) => p.symbol !== "BTC" && getCategory(p.symbol) === "crypto",
    );
    if (alts.length > 0) {
      const altChanges = alts.map((p) => changePct(p));
      const negativeAlts = altChanges.filter((c) => c < 0).length;
      const positiveAlts = altChanges.filter((c) => c > 0).length;

      if (btcChange > 1 && negativeAlts > alts.length * 0.6) {
        insights.push({
          type: "alert",
          symbol: "BTC",
          title: "BTC-Alt Divergence",
          description: `Market divergence: BTC ${btcChange >= 0 ? "+" : ""}${btcChange.toFixed(2)}% while ${negativeAlts} of ${alts.length} alts are negative. Rotation signal.`,
          confidence: negativeAlts > alts.length * 0.7 ? "high" : "medium",
          signals: ["divergence", "rotation"],
          timestamp: now,
        });
      } else if (btcChange < -1 && positiveAlts > alts.length * 0.6) {
        insights.push({
          type: "alert",
          symbol: "BTC",
          title: "Alt Strength vs BTC Weakness",
          description: `Market divergence: BTC ${btcChange.toFixed(2)}% while ${positiveAlts} of ${alts.length} alts are positive. Capital rotating into alts.`,
          confidence: positiveAlts > alts.length * 0.7 ? "high" : "medium",
          signals: ["divergence", "alt-rotation"],
          timestamp: now,
        });
      }
    }
  }

  /* ---- 7. Whale Activity ---- */
  if (leaderboard.length > 0) {
    const topWhale = leaderboard.reduce((best, t) =>
      Math.abs(t.pnl_1d) > Math.abs(best.pnl_1d) ? t : best,
    );
    if (Math.abs(topWhale.pnl_1d) > 10_000) {
      const isProfit = topWhale.pnl_1d > 0;
      insights.push({
        type: isProfit ? "bullish" : "bearish",
        symbol: "WHALE",
        title: `Top Whale ${isProfit ? "Profiting" : "Losing"} Big`,
        description: `Top whale made ${isProfit ? "+" : ""}${fmtDollar(topWhale.pnl_1d)} today with ${fmtDollar(topWhale.equity_current)} equity. ${topWhale.username ? `(${topWhale.username})` : truncAddr(topWhale.address)}.`,
        confidence: Math.abs(topWhale.pnl_1d) > 50_000 ? "high" : "medium",
        signals: ["whale-activity", "smart-money"],
        timestamp: now,
      });
    }
  }

  /* ---- 8. Cross-Asset Correlation Break ---- */
  const cryptos = priceList.filter((p) => getCategory(p.symbol) === "crypto");
  const equities = priceList.filter((p) => getCategory(p.symbol) === "stock");
  if (cryptos.length > 0 && equities.length > 0) {
    const avgCrypto =
      cryptos.reduce((s, p) => s + changePct(p), 0) / cryptos.length;
    const avgEquity =
      equities.reduce((s, p) => s + changePct(p), 0) / equities.length;
    if (
      Math.abs(avgCrypto - avgEquity) > 2 &&
      Math.sign(avgCrypto) !== Math.sign(avgEquity)
    ) {
      insights.push({
        type: "alert",
        symbol: "MACRO",
        title: "Crypto-Equity Decorrelation",
        description: `Crypto-equity decorrelation: crypto avg ${avgCrypto >= 0 ? "+" : ""}${avgCrypto.toFixed(2)}% while stocks avg ${avgEquity >= 0 ? "+" : ""}${avgEquity.toFixed(2)}%.`,
        confidence:
          Math.abs(avgCrypto - avgEquity) > 4 ? "high" : "medium",
        signals: ["decorrelation", "macro"],
        timestamp: now,
      });
    }
  }

  /* ---- 9. New Market Momentum ---- */
  const thirtyDaysAgo = now - 30 * 24 * 3600 * 1000;
  for (const p of priceList) {
    const info = marketInfo[p.symbol];
    if (!info) continue;
    const createdMs =
      info.created_at > 1e12 ? info.created_at : info.created_at * 1000;
    if (createdMs > thirtyDaysAgo) {
      const vol = parseFloat(p.volume_24h) || 0;
      const medianVol = median(
        priceList.map((q) => parseFloat(q.volume_24h) || 0).filter(Boolean),
      );
      if (vol > medianVol * 1.5) {
        insights.push({
          type: "bullish",
          symbol: p.symbol,
          title: `New Market Traction: ${p.symbol}`,
          description: `New market ${p.symbol} showing strong early traction \u2014 ${fmtDollar(vol)} in 24h volume. Listed ${Math.floor((now - createdMs) / 86400000)}d ago.`,
          confidence: vol > medianVol * 3 ? "high" : "low",
          signals: ["new-market", "early-momentum"],
          timestamp: now,
        });
      }
    }
  }

  /* ---- 10. Extreme Price Move ---- */
  for (const p of priceList) {
    const chg = changePct(p);
    if (Math.abs(chg) > 5) {
      insights.push({
        type: chg > 0 ? "bullish" : "bearish",
        symbol: p.symbol,
        title: `Large Move: ${p.symbol} ${chg > 0 ? "+" : ""}${chg.toFixed(2)}%`,
        description: `${p.symbol} moved ${chg > 0 ? "+" : ""}${chg.toFixed(2)}% in 24h. Monitor for continuation or reversal.`,
        confidence: Math.abs(chg) > 10 ? "high" : "medium",
        signals: ["extreme-move", Math.abs(chg) > 10 ? "volatility" : "momentum"],
        timestamp: now,
      });
    }
  }

  /* ---- 11. Market Breadth ---- */
  const gainers = priceList.filter((p) => changePct(p) > 0).length;
  const losers = priceList.filter((p) => changePct(p) < 0).length;
  const total = priceList.length;
  if (total > 0) {
    const gainerPct = gainers / total;
    const loserPct = losers / total;
    if (gainerPct > 0.7) {
      insights.push({
        type: "bullish",
        symbol: "MARKET",
        title: "Broad Market Strength",
        description: `Broad market strength: ${gainers}/${total} markets positive (${(gainerPct * 100).toFixed(0)}%). Risk-on sentiment prevailing.`,
        confidence: gainerPct > 0.85 ? "high" : "medium",
        signals: ["market-breadth", "risk-on"],
        timestamp: now,
      });
    } else if (loserPct > 0.7) {
      insights.push({
        type: "bearish",
        symbol: "MARKET",
        title: "Broad Market Weakness",
        description: `Broad market weakness: ${losers}/${total} markets negative (${(loserPct * 100).toFixed(0)}%). Risk-off sentiment prevailing.`,
        confidence: loserPct > 0.85 ? "high" : "medium",
        signals: ["market-breadth", "risk-off"],
        timestamp: now,
      });
    }
  }

  /* ---- 12. Funding Arbitrage ---- */
  const fundingData = priceList
    .map((p) => ({ symbol: p.symbol, rate: parseFloat(p.funding) }))
    .filter((f) => !isNaN(f.rate));
  if (fundingData.length >= 2) {
    fundingData.sort((a, b) => b.rate - a.rate);
    const mostPositive = fundingData[0];
    const mostNegative = fundingData[fundingData.length - 1];
    const spread = mostPositive.rate - mostNegative.rate;
    if (spread > 0.0001) {
      const spreadPct = (spread * 100).toFixed(4);
      const annSpread = (spread * 3 * 365 * 100).toFixed(1);
      insights.push({
        type: "neutral",
        symbol: "ARB",
        title: "Funding Arbitrage Opportunity",
        description: `Funding arb: Long ${mostNegative.symbol} (${formatFundingRate(String(mostNegative.rate))}) + Short ${mostPositive.symbol} (${formatFundingRate(String(mostPositive.rate))}) = ${spreadPct}% spread (${annSpread}% annualized).`,
        confidence: spread > 0.0005 ? "high" : "low",
        signals: ["funding-arb", "delta-neutral"],
        timestamp: now,
      });
    }
  }

  return insights;
}

function truncAddr(addr: string): string {
  if (!addr || addr.length <= 10) return addr;
  return addr.slice(0, 6) + "..." + addr.slice(-4);
}

/* ================================================================== */
/*  Sort insights: confidence (high first), then type (alerts first)   */
/* ================================================================== */

const CONFIDENCE_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
const TYPE_ORDER: Record<string, number> = {
  alert: 0,
  bearish: 1,
  bullish: 2,
  neutral: 3,
};

function sortInsights(insights: Insight[]): Insight[] {
  return [...insights].sort((a, b) => {
    const confDiff =
      (CONFIDENCE_ORDER[a.confidence] ?? 9) -
      (CONFIDENCE_ORDER[b.confidence] ?? 9);
    if (confDiff !== 0) return confDiff;
    return (TYPE_ORDER[a.type] ?? 9) - (TYPE_ORDER[b.type] ?? 9);
  });
}

/* ================================================================== */
/*  Generate market summary                                            */
/* ================================================================== */

function generateSummary(
  prices: Record<string, PriceData>,
  insights: Insight[],
): string {
  const priceList = Object.values(prices);
  if (priceList.length === 0) return "Waiting for market data...";

  const gainers = priceList.filter((p) => changePct(p) > 0).length;
  const losers = priceList.filter((p) => changePct(p) < 0).length;
  const total = priceList.length;
  const totalVol = priceList.reduce(
    (s, p) => s + (parseFloat(p.volume_24h) || 0),
    0,
  );
  const avgFunding =
    priceList.reduce((s, p) => s + (parseFloat(p.funding) || 0), 0) / total;

  const btc = prices["BTC"];
  const btcChg = btc ? changePct(btc) : 0;

  const breadth = gainers > losers ? "positive" : "negative";
  const sentiment =
    gainers > losers * 1.5
      ? "risk-on"
      : losers > gainers * 1.5
        ? "risk-off"
        : "mixed";

  let summary = `Across ${total} markets, ${gainers} are up and ${losers} are down, reflecting ${breadth} breadth. `;
  if (btc) {
    summary += `BTC is ${btcChg >= 0 ? "+" : ""}${btcChg.toFixed(2)}% on the session. `;
  }
  summary += `24h volume stands at ${fmtDollar(totalVol)} with average hourly funding at ${(avgFunding * 100).toFixed(4)}%. `;
  summary += `Overall sentiment appears ${sentiment}. `;
  summary += `Analysis detected ${insights.length} actionable signal${insights.length !== 1 ? "s" : ""}.`;

  return summary;
}

/* ================================================================== */
/*  Sentiment from insights                                            */
/* ================================================================== */

function deriveSentiment(insights: Insight[]): "bullish" | "neutral" | "bearish" {
  let score = 0;
  for (const i of insights) {
    const weight = i.confidence === "high" ? 2 : i.confidence === "medium" ? 1 : 0.5;
    if (i.type === "bullish") score += weight;
    else if (i.type === "bearish") score -= weight;
  }
  if (score > 2) return "bullish";
  if (score < -2) return "bearish";
  return "neutral";
}

/* ================================================================== */
/*  Icons                                                              */
/* ================================================================== */

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2a6 6 0 00-6 6c0 1.66.68 3.16 1.76 4.24L12 16l4.24-3.76A5.98 5.98 0 0018 8a6 6 0 00-6-6z" />
      <path d="M12 16v6" />
      <path d="M8 22h8" />
      <path d="M9 7.5a1.5 1.5 0 113 0" />
      <path d="M12 7.5a1.5 1.5 0 113 0" />
      <path d="M9 11c0-.83.34-1.58.88-2.12" />
      <path d="M15 11c0-.83-.34-1.58-.88-2.12" />
    </svg>
  );
}

function InsightIcon({ type }: { type: Insight["type"] }) {
  if (type === "bullish") {
    return (
      <svg
        className="w-5 h-5 text-up"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="18 15 12 9 6 15" />
      </svg>
    );
  }
  if (type === "bearish") {
    return (
      <svg
        className="w-5 h-5 text-down"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    );
  }
  if (type === "alert") {
    return (
      <svg
        className="w-5 h-5 text-warn"
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
    );
  }
  return (
    <svg
      className="w-5 h-5 text-muted"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

/* ================================================================== */
/*  Sub-components                                                     */
/* ================================================================== */

function SentimentGauge({
  sentiment,
}: {
  sentiment: "bullish" | "neutral" | "bearish";
}) {
  const positions = { bearish: "16.67%", neutral: "50%", bullish: "83.33%" };
  const colors = {
    bearish: "text-down",
    neutral: "text-muted",
    bullish: "text-up",
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-[10px] uppercase tracking-wider font-medium">
        <span className="text-down">Bearish</span>
        <span className="text-muted">Neutral</span>
        <span className="text-up">Bullish</span>
      </div>
      <div className="relative h-2.5 rounded-full bg-gradient-to-r from-down/30 via-muted/20 to-up/30 overflow-visible">
        <div
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full border-2 border-bg bg-fg shadow-[0_0_8px_rgba(255,255,255,0.2)] transition-[left] duration-700"
          style={{ left: positions[sentiment], transitionTimingFunction: "cubic-bezier(0.23, 1, 0.32, 1)" }}
        />
      </div>
      <p className={`text-sm font-semibold text-center ${colors[sentiment]}`}>
        {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}
      </p>
    </div>
  );
}

function ConfidenceBadge({ level }: { level: Insight["confidence"] }) {
  const styles = {
    high: "bg-[#10b981]/20 text-[#10b981] border-[#10b981]/30 shadow-[0_0_6px_rgba(34,197,94,0.2)]",
    medium: "bg-[#eab308]/20 text-[#eab308] border-[#eab308]/30 shadow-[0_0_6px_rgba(234,179,8,0.15)]",
    low: "bg-muted/15 text-muted border-muted/30",
  };
  return (
    <span
      className={`text-[10px] font-semibold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${styles[level]}`}
    >
      {level}
    </span>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  const borderColor = {
    bullish: "border-l-up/60",
    bearish: "border-l-down/60",
    alert: "border-l-warn/60",
    neutral: "border-l-muted/40",
  };

  return (
    <div
      className={`bg-card border border-border rounded-xl p-4 border-l-3 ${borderColor[insight.type]} hover:bg-card-hover transition-[background-color,box-shadow] duration-200 ease-out hover:shadow-card cursor-pointer`}
    >
      <div className="flex items-start gap-3">
        {/* Type Icon */}
        <div className="flex-shrink-0 mt-0.5">
          <InsightIcon type={insight.type} />
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <h3 className="text-fg font-semibold text-sm">{insight.title}</h3>
            <ConfidenceBadge level={insight.confidence} />
          </div>

          {/* Description */}
          <p className="text-muted text-sm leading-relaxed mb-2.5">
            {insight.description}
          </p>

          {/* Footer: signals + timestamp */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              {insight.signals.map((s) => {
                const tagColor = s.includes("bullish") || s.includes("bid") || s.includes("risk-on") || s.includes("momentum") || s.includes("early")
                  ? "text-up/90 bg-up/10"
                  : s.includes("bearish") || s.includes("ask") || s.includes("risk-off")
                    ? "text-down/90 bg-down/10"
                    : s.includes("alert") || s.includes("surge") || s.includes("volatility") || s.includes("breakout") || s.includes("flip") || s.includes("divergence") || s.includes("rotation")
                      ? "text-warn/90 bg-warn/10"
                      : "text-accent/80 bg-accent/10";
                return (
                  <span
                    key={s}
                    className={`text-[10px] font-mono ${tagColor} px-2 py-0.5 rounded-full`}
                  >
                    {s}
                  </span>
                );
              })}
            </div>
            <span className="text-[10px] text-muted font-mono flex-shrink-0">
              {timeAgo(insight.timestamp)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ================================================================== */
/*  Main Page Component                                                */
/* ================================================================== */

export default function AiInsights() {
  const { prices, connected } = usePacificaPrices();

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [orderbooks, setOrderbooks] = useState<BookSnapshot[]>([]);
  const [marketInfo, setMarketInfo] = useState<Record<string, MarketInfo>>({});
  const [lastAnalyzed, setLastAnalyzed] = useState(0);
  const [analysisCount, setAnalysisCount] = useState(0);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const analyzeTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /* Tick for "last analyzed" display */
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(t);
  }, []);

  /* ---- Fetch leaderboard ---- */
  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/leaderboard`);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        const entries: LeaderboardEntry[] = json.data
          .slice(0, 20)
          .map((t: Record<string, unknown>) => ({
            address: String(t.address ?? ""),
            username: t.username ? String(t.username) : null,
            pnl_1d: Number(t.pnl_1d) || 0,
            pnl_7d: Number(t.pnl_7d) || 0,
            pnl_all_time: Number(t.pnl_all_time) || 0,
            equity_current: Number(t.equity_current) || 0,
            oi_current: Number(t.oi_current) || 0,
          }));
        setLeaderboard(entries);
      }
    } catch {
      /* silently fail */
    }
  }, []);

  /* ---- Fetch orderbooks for top symbols ---- */
  const fetchOrderbooks = useCallback(async () => {
    const snapshots: BookSnapshot[] = [];
    await Promise.allSettled(
      TOP_BOOK_SYMBOLS.map(async (sym) => {
        try {
          const res = await fetch(`${API_BASE}/book?symbol=${sym}`);
          const json = await res.json();
          if (json.success && json.data) {
            const book = json.data as BookData;
            const bids = book.l?.[0] ?? [];
            const asks = book.l?.[1] ?? [];
            const bidDepth = bids.reduce(
              (s: number, l: BookLevel) =>
                s + parseFloat(l.a) * parseFloat(l.p),
              0,
            );
            const askDepth = asks.reduce(
              (s: number, l: BookLevel) =>
                s + parseFloat(l.a) * parseFloat(l.p),
              0,
            );
            const total = bidDepth + askDepth;
            snapshots.push({
              symbol: sym,
              bidDepth,
              askDepth,
              ratio: total > 0 ? bidDepth / (askDepth || 1) : 1,
            });
          }
        } catch {
          /* skip */
        }
      }),
    );
    setOrderbooks(snapshots);
  }, []);

  /* ---- Fetch market info ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/info`);
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          const map: Record<string, MarketInfo> = {};
          for (const m of json.data as MarketInfo[]) {
            map[m.symbol] = m;
          }
          setMarketInfo(map);
        }
      } catch {
        /* silently fail */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Initial data fetch + periodic refresh ---- */
  useEffect(() => {
    fetchLeaderboard();
    fetchOrderbooks();

    if (autoRefresh) {
      analyzeTimerRef.current = setInterval(() => {
        fetchLeaderboard();
        fetchOrderbooks();
        setAnalysisCount((c) => c + 1);
      }, ANALYZE_INTERVAL);
    }

    return () => {
      if (analyzeTimerRef.current) clearInterval(analyzeTimerRef.current);
    };
  }, [fetchLeaderboard, fetchOrderbooks, autoRefresh]);

  /* ---- Generate insights ---- */
  const insights = useMemo(() => {
    const priceList = Object.values(prices);
    if (priceList.length === 0) return [];
    const raw = generateInsights(prices, marketInfo, leaderboard, orderbooks);
    setLastAnalyzed(Date.now());
    return sortInsights(raw);
    // analysisCount forces re-computation on the timer cycle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prices, marketInfo, leaderboard, orderbooks, analysisCount]);

  const summary = useMemo(
    () => generateSummary(prices, insights),
    [prices, insights],
  );
  const sentiment = useMemo(() => deriveSentiment(insights), [insights]);

  /* ---- Signal counts ---- */
  const bullishCount = insights.filter((i) => i.type === "bullish").length;
  const bearishCount = insights.filter((i) => i.type === "bearish").length;
  const alertCount = insights.filter((i) => i.type === "alert").length;
  const neutralCount = insights.filter((i) => i.type === "neutral").length;

  const hasData = Object.keys(prices).length > 0;

  /* ---- Loading state ---- */
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4 page-enter">
        <div className="relative">
          <div className="w-12 h-12 border-2 border-accent/30 rounded-full" />
          <div className="absolute inset-0 w-12 h-12 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <BrainIcon className="absolute inset-0 m-auto w-5 h-5 text-accent" />
        </div>
        <p className="text-muted text-sm">
          {connected
            ? "Initializing AI analysis engine..."
            : "Connecting to Pacifica..."}
        </p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-5 page-enter">
      {/* ---- Analysis Status ---- */}
      <div className="flex items-center justify-end gap-3 stagger-item">
        <span className="text-[10px] font-medium text-accent/80 bg-accent/10 px-2.5 py-1 rounded-full border border-accent/20">
          Powered by on-chain data analysis
        </span>
        {lastAnalyzed > 0 && (
          <span className="text-[10px] text-muted font-mono">
            Analyzed {timeAgo(lastAnalyzed)}
          </span>
        )}
      </div>

      {/* ---- Market Summary Card ---- */}
      <div className="bg-gradient-to-r from-[#10b981]/20 via-[#6366f1]/20 to-[#f43f5e]/20 rounded-xl p-[1px] stagger-item">
      <div className="bg-card rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <svg
            className="w-4 h-4 text-accent"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <h2 className="text-fg font-semibold text-sm uppercase tracking-wider">
            Market Summary
          </h2>
        </div>

        <p className="text-muted text-base leading-relaxed font-mono">
          {summary}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {/* Sentiment Gauge */}
          <div className="stat-card">
            <SentimentGauge sentiment={sentiment} />
          </div>

          {/* Signal Breakdown */}
          <div className="stat-card">
            <p className="text-[10px] uppercase tracking-wider font-medium text-muted mb-3">
              Signal Breakdown
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums text-up">
                  {bullishCount}
                </p>
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Bullish</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums text-down">
                  {bearishCount}
                </p>
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Bearish</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums text-warn">
                  {alertCount}
                </p>
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Alerts</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold font-mono tabular-nums text-muted">
                  {neutralCount}
                </p>
                <p className="text-[10px] text-muted mt-1 uppercase tracking-wider">Neutral</p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </div>

      {/* ---- Insights Feed ---- */}
      <div className="stagger-item">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-fg font-semibold text-sm uppercase tracking-wider">
              Intelligence Feed
            </h2>
            <span className="text-[10px] font-mono text-muted bg-card border border-border rounded-full px-2.5 py-0.5">
              {insights.length} signal{insights.length !== 1 ? "s" : ""}
            </span>
          </div>
          <LiveToggle active={autoRefresh} onToggle={() => setAutoRefresh((p) => !p)} intervalSec={ANALYZE_INTERVAL / 1000} />
        </div>

        {insights.length === 0 ? (
          <div className="section-card p-12 text-center">
            <BrainIcon className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-muted text-sm">
              No actionable signals detected. Markets appear calm.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {insights.map((insight, idx) => (
              <div
                key={`${insight.symbol}-${insight.title}-${idx}`}
                className="card-enter"
                style={{ animationDelay: `${Math.min(idx * 50, 400)}ms` }}
              >
                <InsightCard insight={insight} />
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
