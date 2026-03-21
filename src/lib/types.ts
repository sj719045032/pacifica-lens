export interface MarketInfo {
  symbol: string;
  tick_size: string;
  min_tick: string;
  max_tick: string;
  lot_size: string;
  max_leverage: number;
  isolated_only: boolean;
  min_order_size: string;
  max_order_size: string;
  funding_rate: string;
  next_funding_rate: string;
  created_at: number;
}

export interface PriceData {
  symbol: string;
  funding: string;
  next_funding: string;
  oracle: string;
  mark: string;
  mid: string;
  yesterday_price: string;
  open_interest: string;
  volume_24h: string;
  timestamp: number;
}

export interface MarketSnapshot extends PriceData {
  max_leverage: number;
  change_pct: number;
  category: "crypto" | "stock" | "commodity" | "forex" | "index";
}

export type SortKey =
  | "symbol"
  | "mark"
  | "change_pct"
  | "volume_24h"
  | "open_interest"
  | "funding";
export type SortDir = "asc" | "desc";

const STOCKS = new Set([
  "NVDA",
  "TSLA",
  "GOOGL",
  "PLTR",
  "HOOD",
  "CRCL",
  "URNM",
]);
const COMMODITIES = new Set([
  "XAU",
  "XAG",
  "COPPER",
  "CL",
  "NATGAS",
  "PLATINUM",
  "PAXG",
]);
const FOREX = new Set(["USDJPY", "EURUSD"]);
const INDEX = new Set(["SP500"]);

export function getCategory(
  symbol: string
): MarketSnapshot["category"] {
  if (STOCKS.has(symbol)) return "stock";
  if (COMMODITIES.has(symbol)) return "commodity";
  if (FOREX.has(symbol)) return "forex";
  if (INDEX.has(symbol)) return "index";
  return "crypto";
}

export function formatNumber(n: number, decimals = 2): string {
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(decimals) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(decimals) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(decimals) + "K";
  return n.toFixed(decimals);
}

export function formatPrice(price: number): string {
  if (price >= 10000) return price.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (price >= 100) return price.toFixed(2);
  if (price >= 1) return price.toFixed(4);
  if (price >= 0.01) return price.toFixed(5);
  return price.toFixed(6);
}

export function formatFundingRate(rate: string): string {
  const pct = parseFloat(rate) * 100;
  return (pct >= 0 ? "+" : "") + pct.toFixed(4) + "%";
}

export function annualizedFunding(rate: string): number {
  return parseFloat(rate) * 3 * 365 * 100;
}
