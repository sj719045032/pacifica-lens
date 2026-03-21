import { useEffect, useMemo, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import {
  type PriceData,
  type MarketInfo,
  type SortKey,
  type SortDir,
  getCategory,
  formatPrice,
  formatNumber,
  formatFundingRate,
  annualizedFunding,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  "All",
  "Crypto",
  "Stocks",
  "Commodities",
  "Forex",
  "Index",
] as const;

type CategoryFilter = (typeof CATEGORIES)[number];

const CATEGORY_MAP: Record<
  Exclude<CategoryFilter, "All">,
  ReturnType<typeof getCategory>
> = {
  Crypto: "crypto",
  Stocks: "stock",
  Commodities: "commodity",
  Forex: "forex",
  Index: "index",
};

const COLUMNS: { key: SortKey | "annualized" | "leverage"; label: string; align: string }[] = [
  { key: "symbol", label: "Market", align: "text-left" },
  { key: "mark", label: "Price", align: "text-right" },
  { key: "change_pct", label: "24h Change", align: "text-right" },
  { key: "volume_24h", label: "24h Volume", align: "text-right" },
  { key: "open_interest", label: "Open Interest", align: "text-right" },
  { key: "funding", label: "Funding (1h)", align: "text-right" },
  { key: "annualized", label: "Annual. Funding", align: "text-right" },
  { key: "leverage", label: "Leverage", align: "text-right" },
];

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function changePct(p: PriceData): number {
  const mark = parseFloat(p.mark);
  const yesterday = parseFloat(p.yesterday_price);
  if (!yesterday) return 0;
  return ((mark - yesterday) / yesterday) * 100;
}

function categoryBadge(cat: ReturnType<typeof getCategory>) {
  const colors: Record<string, string> = {
    crypto: "bg-accent/15 text-accent",
    stock: "bg-up/15 text-up",
    commodity: "bg-warn/15 text-warn",
    forex: "bg-purple-500/15 text-purple-400",
    index: "bg-cyan-500/15 text-cyan-400",
  };
  const labels: Record<string, string> = {
    crypto: "Crypto",
    stock: "Stock",
    commodity: "Cmdty",
    forex: "Forex",
    index: "Index",
  };
  return (
    <span
      className={`ml-2 px-1.5 py-0.5 text-[10px] font-medium rounded ${colors[cat] ?? "bg-muted/15 text-muted"}`}
    >
      {labels[cat] ?? cat}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export default function Overview() {
  const { prices, connected } = usePacificaPrices();
  const [marketInfo, setMarketInfo] = useState<Record<string, MarketInfo>>({});
  const [infoLoaded, setInfoLoaded] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<CategoryFilter>("All");
  const [sortKey, setSortKey] = useState<SortKey | "annualized" | "leverage">("volume_24h");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  /* ---- Fetch market info on mount ---- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("https://api.pacifica.fi/api/v1/info");
        const json = await res.json();
        if (!cancelled && json.success && Array.isArray(json.data)) {
          const map: Record<string, MarketInfo> = {};
          for (const m of json.data as MarketInfo[]) {
            map[m.symbol] = m;
          }
          setMarketInfo(map);
          setInfoLoaded(true);
        }
      } catch {
        /* silently retry after 5s */
        if (!cancelled) setTimeout(() => setInfoLoaded(false), 5000);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ---- Derived data ---- */
  const priceList = useMemo(() => Object.values(prices), [prices]);
  const hasData = priceList.length > 0;

  /* Stats */
  const stats = useMemo(() => {
    let totalVolume = 0;
    let totalOI = 0;
    let gainers = 0;
    let losers = 0;
    let fundingSum = 0;
    let fundingCount = 0;

    for (const p of priceList) {
      totalVolume += parseFloat(p.volume_24h) || 0;
      totalOI += (parseFloat(p.open_interest) || 0) * (parseFloat(p.mark) || 0);
      const chg = changePct(p);
      if (chg > 0) gainers++;
      else if (chg < 0) losers++;
      const f = parseFloat(p.funding);
      if (!isNaN(f)) {
        fundingSum += f;
        fundingCount++;
      }
    }

    return {
      totalVolume,
      totalOI,
      marketCount: priceList.length,
      gainers,
      losers,
      avgFunding: fundingCount ? fundingSum / fundingCount : 0,
    };
  }, [priceList]);

  /* Filtered + sorted rows */
  const rows = useMemo(() => {
    let list = priceList.map((p) => ({
      ...p,
      category: getCategory(p.symbol),
      change_pct: changePct(p),
      max_leverage: marketInfo[p.symbol]?.max_leverage ?? 0,
    }));

    if (category !== "All") {
      const mapped = CATEGORY_MAP[category];
      list = list.filter((r) => r.category === mapped);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.symbol.toLowerCase().includes(q));
    }

    list.sort((a, b) => {
      let av: number, bv: number;
      switch (sortKey) {
        case "symbol":
          return sortDir === "asc"
            ? a.symbol.localeCompare(b.symbol)
            : b.symbol.localeCompare(a.symbol);
        case "mark":
          av = parseFloat(a.mark);
          bv = parseFloat(b.mark);
          break;
        case "change_pct":
          av = a.change_pct;
          bv = b.change_pct;
          break;
        case "volume_24h":
          av = parseFloat(a.volume_24h);
          bv = parseFloat(b.volume_24h);
          break;
        case "open_interest":
          av = parseFloat(a.open_interest) * parseFloat(a.mark);
          bv = parseFloat(b.open_interest) * parseFloat(b.mark);
          break;
        case "funding":
          av = parseFloat(a.funding);
          bv = parseFloat(b.funding);
          break;
        case "annualized":
          av = annualizedFunding(a.funding);
          bv = annualizedFunding(b.funding);
          break;
        case "leverage":
          av = a.max_leverage;
          bv = b.max_leverage;
          break;
        default:
          return 0;
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });

    return list;
  }, [priceList, marketInfo, category, search, sortKey, sortDir]);

  /* ---- Sort handler ---- */
  function handleSort(key: SortKey | "annualized" | "leverage") {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "symbol" ? "asc" : "desc");
    }
  }

  /* ---- Loading state ---- */
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        <p className="text-muted text-sm">
          {connected ? "Waiting for market data..." : "Connecting to Pacifica..."}
        </p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-5">
      {/* ---------- Header ---------- */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-fg">Market Overview</h1>
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`inline-block w-2 h-2 rounded-full ${
              connected ? "bg-up animate-pulse" : "bg-down"
            }`}
          />
          <span className={connected ? "text-up" : "text-down"}>
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      {/* ---------- Stats bar ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        <StatCard label="24h Volume" value={`$${formatNumber(stats.totalVolume)}`} />
        <StatCard label="Open Interest" value={`$${formatNumber(stats.totalOI)}`} />
        <StatCard label="Markets" value={String(stats.marketCount)} />
        <StatCard
          label="Gainers / Losers"
          value={
            <span>
              <span className="text-up">{stats.gainers}</span>
              <span className="text-muted mx-1">/</span>
              <span className="text-down">{stats.losers}</span>
            </span>
          }
        />
        <StatCard
          label="Avg Funding (1h)"
          value={
            <span
              className={
                stats.avgFunding >= 0 ? "text-up" : "text-down"
              }
            >
              {(stats.avgFunding >= 0 ? "+" : "") +
                (stats.avgFunding * 100).toFixed(4) +
                "%"}
            </span>
          }
        />
      </div>

      {/* ---------- Filters ---------- */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                category === c
                  ? "bg-accent text-white"
                  : "bg-card text-muted hover:text-fg hover:bg-card-hover"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative sm:ml-auto w-full sm:w-64">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Search markets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-accent/50 transition-colors"
          />
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3 font-medium text-muted text-xs uppercase tracking-wider cursor-pointer select-none hover:text-fg transition-colors ${col.align} whitespace-nowrap`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <svg
                          className={`w-3 h-3 transition-transform ${
                            sortDir === "asc" ? "rotate-180" : ""
                          }`}
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M7 10l5 5 5-5z" />
                        </svg>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mark = parseFloat(r.mark);
                const oiUsd =
                  (parseFloat(r.open_interest) || 0) * mark;
                const ann = annualizedFunding(r.funding);
                const fundingVal = parseFloat(r.funding);

                return (
                  <tr
                    key={r.symbol}
                    className="border-b border-border/50 hover:bg-card-hover transition-colors"
                  >
                    {/* Market */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-fg">
                        {r.symbol}
                      </span>
                      {categoryBadge(r.category)}
                    </td>

                    {/* Price */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatPrice(mark)}
                    </td>

                    {/* 24h Change */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        r.change_pct > 0
                          ? "text-up"
                          : r.change_pct < 0
                            ? "text-down"
                            : "text-muted"
                      }`}
                    >
                      {r.change_pct > 0 ? "+" : ""}
                      {r.change_pct.toFixed(2)}%
                    </td>

                    {/* Volume */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatNumber(parseFloat(r.volume_24h) || 0)}
                    </td>

                    {/* OI */}
                    <td className="px-4 py-3 text-right font-mono text-fg whitespace-nowrap">
                      ${formatNumber(oiUsd)}
                    </td>

                    {/* Funding 1h */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        fundingVal > 0
                          ? "text-up"
                          : fundingVal < 0
                            ? "text-down"
                            : "text-muted"
                      }`}
                    >
                      {formatFundingRate(r.funding)}
                    </td>

                    {/* Annualized Funding */}
                    <td
                      className={`px-4 py-3 text-right font-mono whitespace-nowrap ${
                        ann > 0
                          ? "text-up"
                          : ann < 0
                            ? "text-down"
                            : "text-muted"
                      }`}
                    >
                      {ann >= 0 ? "+" : ""}
                      {ann.toFixed(2)}%
                    </td>

                    {/* Leverage */}
                    <td className="px-4 py-3 text-right font-mono text-warn whitespace-nowrap">
                      {r.max_leverage ? `${r.max_leverage}x` : "-"}
                    </td>
                  </tr>
                );
              })}

              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={COLUMNS.length}
                    className="px-4 py-12 text-center text-muted"
                  >
                    No markets found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- Footer ---------- */}
      <p className="text-xs text-muted text-center pb-2">
        {rows.length} market{rows.length !== 1 ? "s" : ""} shown
        {!infoLoaded && " \u00b7 Loading leverage data..."}
      </p>

      {/* ---------- Pacifica Attribution ---------- */}
      <div className="border-t border-border pt-4 pb-2 flex flex-col items-center gap-2">
        <p className="text-xs text-muted">
          Powered by <span className="text-accent font-semibold">Pacifica API</span> | Real-time WebSocket data | 63+ perpetual markets
        </p>
        <span className="text-[10px] font-medium text-accent/80 bg-accent/10 px-2.5 py-1 rounded-full">
          Built for Pacifica Hackathon 2026
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Stat Card (inline)                                                         */
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
