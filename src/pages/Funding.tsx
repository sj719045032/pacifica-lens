import { useMemo, useState } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import FundingChart from "@/components/FundingChart";
import {
  type PriceData,
  formatFundingRate,
  annualizedFunding,
  formatNumber,
} from "@/lib/types";

interface MarketRow {
  data: PriceData;
  fundingNum: number;
  annualized: number;
}

function buildRows(prices: Record<string, PriceData>): MarketRow[] {
  return Object.values(prices).map((d) => ({
    data: d,
    fundingNum: parseFloat(d.funding),
    annualized: annualizedFunding(d.funding),
  }));
}

function OpportunityCard({
  title,
  rows,
  kind,
  className,
}: {
  title: string;
  rows: MarketRow[];
  kind: "long" | "short";
  className?: string;
}) {
  const colorClass = kind === "long" ? "text-up" : "text-down";
  const tagBg = kind === "long" ? "bg-[#10b981]/10" : "bg-[#f43f5e]/10";
  const tagText = kind === "long" ? "text-up" : "text-down";

  return (
    <div className={`section-card p-5 flex-1 min-w-[340px] ${kind === "long" ? "border-t-2 border-t-[#10b981]/50" : "border-t-2 border-t-[#f43f5e]/50"} ${className ?? ""}`}>
      <div className="flex items-center gap-2 mb-4">
        <span className={`text-sm font-medium px-2 py-0.5 rounded ${tagBg} ${tagText}`}>
          {kind === "long" ? "LONG" : "SHORT"}
        </span>
        <h3 className="text-fg font-semibold text-sm">{title}</h3>
      </div>
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.data.symbol}
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-card-hover transition-colors duration-150 cursor-pointer"
          >
            <span className="text-fg font-medium text-sm w-28 truncate">
              {r.data.symbol}
            </span>
            <span className={`font-mono tabular-nums text-sm ${colorClass}`}>
              {formatFundingRate(r.data.funding)}
            </span>
            <span className="font-mono tabular-nums text-xs text-muted">
              {r.annualized >= 0 ? "+" : ""}
              {r.annualized.toFixed(1)}%/yr
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-muted text-sm text-center py-4">No data</p>
        )}
      </div>
    </div>
  );
}

function IntensityBar({ funding }: { funding: number }) {
  const absFunding = Math.abs(funding);
  const widthPct = Math.min((absFunding / 0.001) * 100, 100);
  const barColor = funding >= 0 ? "bg-[#10b981]" : "bg-[#f43f5e]";

  return (
    <div className="w-24 h-2 rounded-full bg-border overflow-hidden">
      <div
        className={`h-full rounded-full ${barColor} transition-all`}
        style={{ width: `${widthPct}%` }}
      />
    </div>
  );
}

export default function Funding() {
  const { prices } = usePacificaPrices();
  const [chartSymbol, setChartSymbol] = useState<string>("");

  const allRows = useMemo(() => buildRows(prices), [prices]);

  const topLong = useMemo(
    () =>
      [...allRows]
        .sort((a, b) => a.fundingNum - b.fundingNum)
        .slice(0, 5),
    [allRows],
  );

  const topShort = useMemo(
    () =>
      [...allRows]
        .sort((a, b) => b.fundingNum - a.fundingNum)
        .slice(0, 5),
    [allRows],
  );

  const sortedByAbsolute = useMemo(
    () =>
      [...allRows].sort(
        (a, b) => Math.abs(b.fundingNum) - Math.abs(a.fundingNum),
      ),
    [allRows],
  );

  // Default chart symbol: most extreme funding rate
  const defaultSymbol = sortedByAbsolute.length > 0 ? sortedByAbsolute[0].data.symbol : "";
  const activeSymbol = chartSymbol || defaultSymbol;
  const allSymbols = useMemo(
    () => sortedByAbsolute.map((r) => r.data.symbol),
    [sortedByAbsolute],
  );

  return (
    <div className="space-y-6 page-enter">
      {/* Opportunity Cards */}
      <section>
        <h2 className="text-fg font-semibold text-lg mb-3">
          Funding Opportunities
        </h2>
        <div className="flex flex-wrap gap-4">
          <OpportunityCard
            title="Top Long Opportunities"
            rows={topLong}
            kind="long"
            className=""
          />
          <OpportunityCard
            title="Top Short Opportunities"
            rows={topShort}
            kind="short"
            className=""
          />
        </div>
      </section>

      {/* Live Funding Rate Trend */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-fg font-semibold text-lg">
              Live Funding Rate Trend
            </h2>
            <p className="text-muted text-xs mt-0.5">
              Real-time funding rate tracking (updates every ~10 seconds)
            </p>
          </div>
          {allSymbols.length > 0 && (
            <select
              value={activeSymbol}
              onChange={(e) => setChartSymbol(e.target.value)}
              className="form-select text-sm"
            >
              {allSymbols.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          )}
        </div>
        {activeSymbol && (
          <FundingChart prices={prices} symbol={activeSymbol} />
        )}
      </section>

      {/* Full Markets Table */}
      <section className="section-card">
        <div className="section-header">
          <h2 className="text-fg font-semibold">
            All Markets{" "}
            <span className="text-muted font-normal text-sm">
              ({sortedByAbsolute.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm zebra-rows">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wider border-b border-border bg-bg/50">
                <th className="text-left px-5 py-3 font-medium">Symbol</th>
                <th className="text-right px-5 py-3 font-medium">
                  Funding (1h)
                </th>
                <th className="text-right px-5 py-3 font-medium">
                  Next Funding
                </th>
                <th className="text-right px-5 py-3 font-medium">
                  Annualized Rate
                </th>
                <th className="px-5 py-3 font-medium text-center">
                  Intensity
                </th>
                <th className="text-right px-5 py-3 font-medium">OI</th>
                <th className="text-right px-5 py-3 font-medium">Volume</th>
              </tr>
            </thead>
            <tbody>
              {sortedByAbsolute.map((row) => {
                const isPositive = row.fundingNum >= 0;
                const rateColor = isPositive ? "text-up" : "text-down";
                return (
                  <tr
                    key={row.data.symbol}
                    className="border-b border-border last:border-b-0 hover:bg-card-hover transition-colors"
                  >
                    <td className="px-5 py-3 text-fg font-medium">
                      {row.data.symbol}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums ${rateColor}`}
                    >
                      {formatFundingRate(row.data.funding)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums ${
                        parseFloat(row.data.next_funding) >= 0
                          ? "text-up"
                          : "text-down"
                      }`}
                    >
                      {formatFundingRate(row.data.next_funding)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono tabular-nums ${rateColor}`}
                    >
                      {row.annualized >= 0 ? "+" : ""}
                      {row.annualized.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <IntensityBar funding={row.fundingNum} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-muted">
                      ${formatNumber(parseFloat(row.data.open_interest))}
                    </td>
                    <td className="px-5 py-3 text-right font-mono tabular-nums text-muted">
                      ${formatNumber(parseFloat(row.data.volume_24h))}
                    </td>
                  </tr>
                );
              })}
              {sortedByAbsolute.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-12 text-center text-muted"
                  >
                    Waiting for market data...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
