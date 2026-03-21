import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
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
  const prevPricesRef = useRef<Record<string, number>>({});
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

  /* ---- Loading state — skeleton screen preserves layout ---- */
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
        {/* Filter skeleton */}
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="skeleton h-8 w-16 rounded-lg" />
          ))}
          <div className="ml-auto skeleton h-9 w-64 rounded-lg" />
        </div>
        {/* Table skeleton */}
        <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card">
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-24 ml-auto" />
                <div className="skeleton h-4 w-16" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-20" />
                <div className="skeleton h-4 w-16" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-muted text-sm text-center animate-pulse">
          {connected ? "Waiting for market data..." : "Connecting to Pacifica..."}
        </p>
      </div>
    );
  }

  /* ---- Render ---- */
  return (
    <div className="space-y-5 page-enter">
      {/* ---------- Stats bar ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 stagger-item">
        <StatCard
          label="24h Volume"
          value={`$${formatNumber(stats.totalVolume)}`}
          accent="accent"
          icon={<svg className="w-3 h-3 text-accent" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20V10M18 20V4M6 20v-4"/></svg>}
          className=""
        />
        <StatCard
          label="Open Interest"
          value={`$${formatNumber(stats.totalOI)}`}
          accent="up"
          icon={<svg className="w-3 h-3 text-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v8M8 12h8"/></svg>}
          className=""
        />
        <StatCard
          label="Markets"
          value={String(stats.marketCount)}
          accent="purple"
          icon={<svg className="w-3 h-3 text-purple-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>}
          className=""
        />
        <StatCard
          label="Gainers / Losers"
          accent="up"
          icon={<svg className="w-3 h-3 text-up" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>}
          className={stats.gainers >= stats.losers ? "" : ""}
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
          accent={stats.avgFunding >= 0 ? "up" : "down"}
          icon={<svg className={`w-3 h-3 ${stats.avgFunding >= 0 ? "text-up" : "text-down"}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>}
          className={stats.avgFunding >= 0 ? "" : ""}
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 stagger-item">
        {/* Category pills */}
        <div className="flex flex-wrap gap-1.5" role="tablist">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`press-scale px-3 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                category === c
                  ? "bg-accent text-white scale-[1.02]"
                  : "bg-card text-muted hover:text-fg hover:bg-card-hover shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)] hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
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
            className="w-full bg-card border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-fg placeholder:text-muted focus:outline-none focus:border-accent/50 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.15)] transition-[border-color,box-shadow] duration-200 ease-out"
          />
        </div>
      </div>

      {/* ---------- Table ---------- */}
      <div className="bg-card rounded-xl border border-border overflow-hidden shadow-card stagger-item">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-border">
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-4 py-3.5 font-semibold text-muted text-[11px] uppercase tracking-widest cursor-pointer select-none hover:text-fg transition-[color] duration-150 ease-out ${col.align} whitespace-nowrap`}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <svg
                          className={`w-3 h-3 transition-transform duration-200 ease-out ${
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

                // Determine if price changed for flash effect
                const prev = prevPricesRef.current[r.symbol];
                let flashClass = "";
                if (prev !== undefined && prev !== mark) {
                  flashClass = mark > prev ? "flash-up" : "flash-down";
                }
                prevPricesRef.current[r.symbol] = mark;

                return (
                  <tr
                    key={r.symbol}
                    className="border-b border-border/50 hover:bg-card-hover transition-[background-color] duration-150 ease-out group"
                  >
                    {/* Market */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-fg mr-2">
                        {r.symbol}
                      </span>
                      {categoryBadge(r.category)}
                      <span className="inline-flex gap-1 ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        <Link to={`/orderbook?symbol=${r.symbol}`} title="Orderbook" className="text-muted hover:text-accent transition-colors press-scale p-0.5 rounded">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3h18v18H3zM3 9h18M3 15h18"/></svg>
                        </Link>
                        <Link to={`/tradeflow?symbol=${r.symbol}`} title="Trade Flow" className="text-muted hover:text-accent transition-colors press-scale p-0.5 rounded">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>
                        </Link>
                      </span>
                    </td>

                    {/* Price — flashes green/red on change */}
                    <td className={`px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap rounded ${flashClass}`} key={`${r.symbol}-${mark}`}>
                      ${formatPrice(mark)}
                    </td>

                    {/* 24h Change */}
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
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
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatNumber(parseFloat(r.volume_24h) || 0)}
                    </td>

                    {/* OI */}
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-fg whitespace-nowrap">
                      ${formatNumber(oiUsd)}
                    </td>

                    {/* Funding 1h */}
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
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
                      className={`px-4 py-3 text-right font-mono tabular-nums whitespace-nowrap ${
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
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-warn whitespace-nowrap">
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
      <p className="text-xs text-muted text-center pb-2 tabular-nums stagger-item">
        {rows.length} market{rows.length !== 1 ? "s" : ""} shown
        {!infoLoaded && " \u00b7 Loading leverage data..."}
      </p>

      {/* ---------- Pacifica Attribution ---------- */}
      <div className="border-t border-border pt-4 pb-2 flex flex-col items-center gap-2 stagger-item">
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
  accent = "accent",
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  accent?: "accent" | "up" | "down" | "purple" | "warn";
  icon?: React.ReactNode;
  className?: string;
}) {
  const borderColors: Record<string, string> = {
    accent: "border-l-accent",
    up: "border-l-up",
    down: "border-l-down",
    purple: "border-l-purple-500",
    warn: "border-l-warn",
  };
  return (
    <div className={`stat-card border-l-[3px] ${borderColors[accent] ?? "border-l-accent"} ${className ?? ""}`}>
      <p className="text-[11px] text-muted mb-2 flex items-center gap-1.5 uppercase tracking-wider font-medium">
        {icon}
        {label}
      </p>
      <p className="text-2xl font-bold font-mono tabular-nums text-fg">{value}</p>
    </div>
  );
}
