import { useMemo } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
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
}: {
  title: string;
  rows: MarketRow[];
  kind: "long" | "short";
}) {
  const colorClass = kind === "long" ? "text-up" : "text-down";
  const tagBg = kind === "long" ? "bg-[#22c55e]/10" : "bg-[#ef4444]/10";
  const tagText = kind === "long" ? "text-up" : "text-down";

  return (
    <div className="bg-card rounded-xl border border-border p-5 flex-1 min-w-[340px]">
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
            className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-card-hover transition-colors"
          >
            <span className="text-fg font-medium text-sm w-28 truncate">
              {r.data.symbol}
            </span>
            <span className={`font-mono text-sm ${colorClass}`}>
              {formatFundingRate(r.data.funding)}
            </span>
            <span className="font-mono text-xs text-muted">
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
  const barColor = funding >= 0 ? "bg-[#22c55e]" : "bg-[#ef4444]";

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
  const { prices, connected } = usePacificaPrices();

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

  return (
    <div className="space-y-6">
      {/* Pacifica data source banner */}
      <p className="text-xs text-muted">Data sourced from Pacifica WebSocket API in real-time</p>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-fg">Funding Rates</h1>
          <p className="text-muted text-sm mt-1">
            Analyze funding rate opportunities across all markets
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border ${
            connected
              ? "border-[#22c55e]/30 bg-[#22c55e]/10 text-up"
              : "border-[#ef4444]/30 bg-[#ef4444]/10 text-down"
          }`}
        >
          <span
            className={`w-1.5 h-1.5 rounded-full ${
              connected ? "bg-[#22c55e]" : "bg-[#ef4444]"
            }`}
          />
          {connected ? "Connected" : "Disconnected"}
        </span>
      </div>

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
          />
          <OpportunityCard
            title="Top Short Opportunities"
            rows={topShort}
            kind="short"
          />
        </div>
      </section>

      {/* Full Markets Table */}
      <section className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="text-fg font-semibold">
            All Markets{" "}
            <span className="text-muted font-normal text-sm">
              ({sortedByAbsolute.length})
            </span>
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted text-xs uppercase tracking-wider border-b border-border">
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
                      className={`px-5 py-3 text-right font-mono ${rateColor}`}
                    >
                      {formatFundingRate(row.data.funding)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono ${
                        parseFloat(row.data.next_funding) >= 0
                          ? "text-up"
                          : "text-down"
                      }`}
                    >
                      {formatFundingRate(row.data.next_funding)}
                    </td>
                    <td
                      className={`px-5 py-3 text-right font-mono ${rateColor}`}
                    >
                      {row.annualized >= 0 ? "+" : ""}
                      {row.annualized.toFixed(2)}%
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-center">
                        <IntensityBar funding={row.fundingNum} />
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted">
                      ${formatNumber(parseFloat(row.data.open_interest))}
                    </td>
                    <td className="px-5 py-3 text-right font-mono text-muted">
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
