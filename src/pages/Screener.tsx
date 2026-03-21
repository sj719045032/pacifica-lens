import { useState, useEffect, useMemo } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import {
  type PriceData,
  type MarketInfo,
  getCategory,
  formatPrice,
  formatNumber,
  formatFundingRate,
  annualizedFunding,
} from "@/lib/types";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type PresetKey =
  | "high_funding"
  | "negative_funding"
  | "most_volatile"
  | "top_volume"
  | "new_markets";

type CategoryFilter = "all" | "crypto" | "stock" | "commodity" | "forex" | "index";

type SortKey =
  | "symbol"
  | "category"
  | "mark"
  | "change_pct"
  | "volume_24h"
  | "open_interest"
  | "funding"
  | "ann_funding"
  | "max_leverage"
  | "age";

type SortDir = "asc" | "desc";

interface EnrichedRow {
  symbol: string;
  category: ReturnType<typeof getCategory>;
  price: number;
  change_pct: number;
  volume: number;
  oi: number;
  funding: string;
  ann_funding: number;
  max_leverage: number;
  created_at: number;
  age_days: number;
}

/* ------------------------------------------------------------------ */
/*  Preset definitions                                                 */
/* ------------------------------------------------------------------ */

const PRESETS: { key: PresetKey; label: string; desc: string }[] = [
  { key: "high_funding", label: "High Funding", desc: "Funding > 0.01%" },
  { key: "negative_funding", label: "Negative Funding", desc: "Funding < -0.01%" },
  { key: "most_volatile", label: "Most Volatile", desc: "Top 10 by |24h change|" },
  { key: "top_volume", label: "Top Volume", desc: "Top 10 by volume" },
  { key: "new_markets", label: "New Markets", desc: "Created in last 30 days" },
];

const CATEGORY_OPTIONS: { value: CategoryFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "crypto", label: "Crypto" },
  { value: "stock", label: "Stocks" },
  { value: "commodity", label: "Commodities" },
  { value: "forex", label: "Forex" },
  { value: "index", label: "Index" },
];

const COLUMNS: { key: SortKey; label: string; align: "left" | "right" }[] = [
  { key: "symbol", label: "Symbol", align: "left" },
  { key: "category", label: "Category", align: "left" },
  { key: "mark", label: "Price", align: "right" },
  { key: "change_pct", label: "24h Change", align: "right" },
  { key: "volume_24h", label: "Volume", align: "right" },
  { key: "open_interest", label: "OI", align: "right" },
  { key: "funding", label: "Funding", align: "right" },
  { key: "ann_funding", label: "Ann. Funding", align: "right" },
  { key: "max_leverage", label: "Leverage", align: "right" },
  { key: "age", label: "Age", align: "right" },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function changePct(p: PriceData): number {
  const mark = parseFloat(p.mark);
  const yesterday = parseFloat(p.yesterday_price);
  if (!yesterday) return 0;
  return ((mark - yesterday) / yesterday) * 100;
}

function formatAge(days: number): string {
  if (days < 1) return "<1d";
  if (days < 30) return `${Math.floor(days)}d`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

function categoryLabel(c: EnrichedRow["category"]): string {
  const map: Record<string, string> = {
    crypto: "Crypto",
    stock: "Stock",
    commodity: "Commodity",
    forex: "Forex",
    index: "Index",
  };
  return map[c] ?? c;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function Screener() {
  const { prices, connected } = usePacificaPrices();
  const [marketInfo, setMarketInfo] = useState<Record<string, MarketInfo>>({});
  const [infoLoading, setInfoLoading] = useState(true);

  // Preset + custom filters
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [minFunding, setMinFunding] = useState("");
  const [maxFunding, setMaxFunding] = useState("");
  const [minVolume, setMinVolume] = useState("");
  const [minLeverage, setMinLeverage] = useState("");
  const [maxLeverage, setMaxLeverage] = useState("");

  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>("volume_24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ---- Fetch market info on mount ---- */
  useEffect(() => {
    let cancelled = false;
    async function fetchInfo() {
      try {
        const res = await fetch("https://api.pacifica.fi/api/v1/info");
        const data: MarketInfo[] = await res.json();
        if (cancelled) return;
        const map: Record<string, MarketInfo> = {};
        for (const m of data) {
          map[m.symbol] = m;
        }
        setMarketInfo(map);
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setInfoLoading(false);
      }
    }
    fetchInfo();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Build enriched rows ---- */
  const rows: EnrichedRow[] = useMemo(() => {
    const now = Date.now();
    return Object.values(prices).map((p) => {
      const info = marketInfo[p.symbol];
      const createdAt = info?.created_at ?? 0;
      const ageDays = createdAt ? (now - createdAt) / 86_400_000 : Infinity;
      return {
        symbol: p.symbol,
        category: getCategory(p.symbol),
        price: parseFloat(p.mark),
        change_pct: changePct(p),
        volume: parseFloat(p.volume_24h),
        oi: parseFloat(p.open_interest),
        funding: p.funding,
        ann_funding: annualizedFunding(p.funding),
        max_leverage: info?.max_leverage ?? 0,
        created_at: createdAt,
        age_days: ageDays,
      };
    });
  }, [prices, marketInfo]);

  /* ---- Apply preset ---- */
  function handlePreset(key: PresetKey) {
    const toggling = activePreset === key;
    setActivePreset(toggling ? null : key);
    // Reset custom filters when activating a preset
    if (!toggling) {
      setCategory("all");
      setMinFunding("");
      setMaxFunding("");
      setMinVolume("");
      setMinLeverage("");
      setMaxLeverage("");
    }
  }

  /* ---- Filter + sort ---- */
  const filtered = useMemo(() => {
    let result = [...rows];

    // Preset filters
    if (activePreset === "high_funding") {
      result = result.filter((r) => parseFloat(r.funding) * 100 > 0.01);
    } else if (activePreset === "negative_funding") {
      result = result.filter((r) => parseFloat(r.funding) * 100 < -0.01);
    } else if (activePreset === "most_volatile") {
      result.sort((a, b) => Math.abs(b.change_pct) - Math.abs(a.change_pct));
      result = result.slice(0, 10);
    } else if (activePreset === "top_volume") {
      result.sort((a, b) => b.volume - a.volume);
      result = result.slice(0, 10);
    } else if (activePreset === "new_markets") {
      result = result.filter((r) => r.age_days <= 30 && r.age_days !== Infinity);
    }

    // Custom filters (applied on top of preset results)
    if (category !== "all") {
      result = result.filter((r) => r.category === category);
    }
    if (minFunding) {
      const v = parseFloat(minFunding);
      if (!isNaN(v)) result = result.filter((r) => parseFloat(r.funding) * 100 >= v);
    }
    if (maxFunding) {
      const v = parseFloat(maxFunding);
      if (!isNaN(v)) result = result.filter((r) => parseFloat(r.funding) * 100 <= v);
    }
    if (minVolume) {
      const v = parseFloat(minVolume);
      if (!isNaN(v)) result = result.filter((r) => r.volume >= v);
    }
    if (minLeverage) {
      const v = parseFloat(minLeverage);
      if (!isNaN(v)) result = result.filter((r) => r.max_leverage >= v);
    }
    if (maxLeverage) {
      const v = parseFloat(maxLeverage);
      if (!isNaN(v)) result = result.filter((r) => r.max_leverage <= v);
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "symbol":
          cmp = a.symbol.localeCompare(b.symbol);
          break;
        case "category":
          cmp = a.category.localeCompare(b.category);
          break;
        case "mark":
          cmp = a.price - b.price;
          break;
        case "change_pct":
          cmp = a.change_pct - b.change_pct;
          break;
        case "volume_24h":
          cmp = a.volume - b.volume;
          break;
        case "open_interest":
          cmp = a.oi - b.oi;
          break;
        case "funding":
          cmp = parseFloat(a.funding) - parseFloat(b.funding);
          break;
        case "ann_funding":
          cmp = a.ann_funding - b.ann_funding;
          break;
        case "max_leverage":
          cmp = a.max_leverage - b.max_leverage;
          break;
        case "age":
          cmp = a.age_days - b.age_days;
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return result;
  }, [rows, activePreset, category, minFunding, maxFunding, minVolume, minLeverage, maxLeverage, sortKey, sortDir]);

  /* ---- Column sort handler ---- */
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" || key === "category" ? "asc" : "desc");
    }
  }

  /* ---- Render ---- */
  const loading = !connected || infoLoading || Object.keys(prices).length === 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Market Screener</h1>
          <p className="text-xs text-muted">Filter across all Pacifica perpetual markets using live WebSocket data</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-up" : "bg-down"
            }`}
          />
          <span className="text-xs text-muted">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* Preset cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            onClick={() => handlePreset(p.key)}
            className={`rounded-xl p-4 text-left transition-colors border ${
              activePreset === p.key
                ? "bg-accent/15 border-accent text-accent"
                : "bg-card border-border hover:bg-card-hover text-fg"
            }`}
          >
            <div className="text-sm font-semibold">{p.label}</div>
            <div className="text-xs text-muted mt-1">{p.desc}</div>
          </button>
        ))}
      </div>

      {/* Custom filters */}
      <div className="bg-card rounded-xl border border-border p-4">
        <div className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
          Custom Filters
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Category */}
          <div>
            <label className="block text-xs text-muted mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value as CategoryFilter);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent"
            >
              {CATEGORY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {/* Min funding */}
          <div>
            <label className="block text-xs text-muted mb-1">Min Funding %</label>
            <input
              type="text"
              placeholder="e.g. 0.01"
              value={minFunding}
              onChange={(e) => {
                setMinFunding(e.target.value);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent font-mono"
            />
          </div>

          {/* Max funding */}
          <div>
            <label className="block text-xs text-muted mb-1">Max Funding %</label>
            <input
              type="text"
              placeholder="e.g. 0.05"
              value={maxFunding}
              onChange={(e) => {
                setMaxFunding(e.target.value);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent font-mono"
            />
          </div>

          {/* Min volume */}
          <div>
            <label className="block text-xs text-muted mb-1">Min Volume</label>
            <input
              type="text"
              placeholder="e.g. 100000"
              value={minVolume}
              onChange={(e) => {
                setMinVolume(e.target.value);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent font-mono"
            />
          </div>

          {/* Min leverage */}
          <div>
            <label className="block text-xs text-muted mb-1">Min Leverage</label>
            <input
              type="text"
              placeholder="e.g. 5"
              value={minLeverage}
              onChange={(e) => {
                setMinLeverage(e.target.value);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent font-mono"
            />
          </div>

          {/* Max leverage */}
          <div>
            <label className="block text-xs text-muted mb-1">Max Leverage</label>
            <input
              type="text"
              placeholder="e.g. 50"
              value={maxLeverage}
              onChange={(e) => {
                setMaxLeverage(e.target.value);
                setActivePreset(null);
              }}
              className="w-full bg-card border border-border rounded-lg px-3 py-1.5 text-sm text-fg outline-none focus:border-accent font-mono"
            />
          </div>
        </div>
      </div>

      {/* Result count */}
      <div className="text-sm text-muted">
        {loading
          ? "Loading markets..."
          : `${filtered.length} market${filtered.length !== 1 ? "s" : ""} found`}
      </div>

      {/* Results table */}
      <div className="bg-card rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              {COLUMNS.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className={`px-4 py-3 font-medium text-muted cursor-pointer select-none hover:text-fg transition-colors whitespace-nowrap ${
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
            {loading ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted">
                  <div className="flex items-center justify-center gap-2">
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
                    Loading market data...
                  </div>
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={COLUMNS.length} className="px-4 py-12 text-center text-muted">
                  No markets match the current filters.
                </td>
              </tr>
            ) : (
              filtered.map((row) => {
                const fundingVal = parseFloat(row.funding);
                return (
                  <tr
                    key={row.symbol}
                    className="border-b border-border last:border-b-0 hover:bg-card-hover transition-colors"
                  >
                    {/* Symbol */}
                    <td className="px-4 py-3 font-semibold text-fg whitespace-nowrap">
                      {row.symbol}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      <span className="text-xs bg-card-hover rounded px-2 py-0.5">
                        {categoryLabel(row.category)}
                      </span>
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatPrice(row.price)}
                    </td>

                    {/* 24h Change */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        row.change_pct >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {row.change_pct >= 0 ? "+" : ""}
                      {row.change_pct.toFixed(2)}%
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatNumber(row.volume)}
                    </td>

                    {/* OI */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatNumber(row.oi)}
                    </td>

                    {/* Funding */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        fundingVal >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {formatFundingRate(row.funding)}
                    </td>

                    {/* Annualized Funding */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        row.ann_funding >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {row.ann_funding >= 0 ? "+" : ""}
                      {row.ann_funding.toFixed(2)}%
                    </td>

                    {/* Leverage */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      {row.max_leverage > 0 ? `${row.max_leverage}x` : "-"}
                    </td>

                    {/* Age */}
                    <td className="px-4 py-3 text-right font-mono text-muted whitespace-nowrap">
                      {row.age_days === Infinity ? "-" : formatAge(row.age_days)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
