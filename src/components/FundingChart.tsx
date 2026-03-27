import { useCallback, useEffect, useRef, useMemo, useState } from "react";
import type { PriceData } from "@/lib/types";

interface FundingSnapshot {
  timestamp: number;
  rate: number;
}

interface FundingChartProps {
  prices: Record<string, PriceData>;
  symbol: string;
}

const MAX_POINTS = 200;
const MIN_INTERVAL_MS = 3_000;

const COLORS = {
  line: "#818cf8",
  posFill: "rgba(16, 185, 129, 0.1)",
  negFill: "rgba(244, 63, 94, 0.1)",
  grid: "rgba(28, 31, 40, 0.5)",
  zero: "#5c6370",
} as const;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return (
    d.getHours().toString().padStart(2, "0") +
    ":" +
    d.getMinutes().toString().padStart(2, "0")
  );
}

export default function FundingChart({ prices, symbol }: FundingChartProps) {
  const snapshotsRef = useRef<FundingSnapshot[]>([]);
  const lastPushRef = useRef(0);
  const prevSymbolRef = useRef(symbol);
  const [tick, setTick] = useState(0);
  const forceRender = useCallback(() => setTick((v) => v + 1), []);

  // Reset snapshots when symbol changes
  useEffect(() => {
    if (prevSymbolRef.current !== symbol) {
      snapshotsRef.current = [];
      lastPushRef.current = 0;
      prevSymbolRef.current = symbol;
    }
  }, [symbol]);

  // Collect snapshots from price updates
  const priceData = prices[symbol];
  useEffect(() => {
    if (!priceData) return;

    const now = Date.now();
    if (now - lastPushRef.current < MIN_INTERVAL_MS) return;

    const rate = parseFloat(priceData.funding);
    if (Number.isNaN(rate)) return;

    snapshotsRef.current.push({ timestamp: now, rate });
    if (snapshotsRef.current.length > MAX_POINTS) {
      snapshotsRef.current = snapshotsRef.current.slice(-MAX_POINTS);
    }
    lastPushRef.current = now;
    forceRender();
  }, [priceData, forceRender]);

  const snapshots = snapshotsRef.current;

  // Collecting state -- not enough data yet
  if (snapshots.length < 2) {
    return (
      <div
        className="w-full section-card flex flex-col items-center justify-center gap-3"
        style={{ height: 400 }}
      >
        <div className="w-8 h-8 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
        <p className="text-muted text-sm font-mono">
          Collecting data... {snapshots.length} sample
          {snapshots.length !== 1 ? "s" : ""}
        </p>
        <p className="text-muted/60 text-xs">Chart will appear after 2 data points</p>
      </div>
    );
  }

  return <ChartSVG snapshots={snapshots} renderTick={tick} />;
}

/* ------------------------------------------------------------------ */
/*  Pure SVG renderer                                                  */
/* ------------------------------------------------------------------ */

function ChartSVG({
  snapshots,
  renderTick,
}: {
  snapshots: FundingSnapshot[];
  renderTick: number;
}) {
  const padding = { top: 20, right: 70, bottom: 30, left: 60 };
  const viewW = 800;
  const viewH = 400;
  const chartW = viewW - padding.left - padding.right;
  const chartH = viewH - padding.top - padding.bottom;

  const { yLabels, xLabels, zeroY, points, posPath, negPath } = useMemo(() => {
    const rates = snapshots.map((s) => s.rate);
    let min = Math.min(...rates);
    let max = Math.max(...rates);

    // Ensure some vertical range
    if (max - min < 1e-8) {
      const mid = (max + min) / 2;
      min = mid - 0.0001;
      max = mid + 0.0001;
    }

    // Add 10% vertical padding
    const rangePad = (max - min) * 0.1;
    min -= rangePad;
    max += rangePad;

    const tMin = snapshots[0].timestamp;
    const tMax = snapshots[snapshots.length - 1].timestamp;
    const tRange = Math.max(tMax - tMin, 1);

    // Map data to SVG coords
    const scaleX = (t: number) =>
      padding.left + ((t - tMin) / tRange) * chartW;
    const scaleY = (r: number) =>
      padding.top + ((max - r) / (max - min)) * chartH;

    const pts = snapshots.map((s) => ({
      x: scaleX(s.timestamp),
      y: scaleY(s.rate),
    }));

    // Zero line Y position
    const zy =
      max >= 0 && min <= 0
        ? scaleY(0)
        : max < 0
          ? padding.top
          : padding.top + chartH;

    const clampedZeroY = Math.max(
      padding.top,
      Math.min(padding.top + chartH, zy),
    );

    // Positive fill: area above zero line (where rate > 0)
    let posAreaPath = `M${pts[0].x},${clampedZeroY}`;
    for (const p of pts) {
      posAreaPath += ` L${p.x},${Math.min(p.y, clampedZeroY)}`;
    }
    posAreaPath += ` L${pts[pts.length - 1].x},${clampedZeroY} Z`;

    // Negative fill: area below zero line (where rate < 0)
    let negAreaPath = `M${pts[0].x},${clampedZeroY}`;
    for (const p of pts) {
      negAreaPath += ` L${p.x},${Math.max(p.y, clampedZeroY)}`;
    }
    negAreaPath += ` L${pts[pts.length - 1].x},${clampedZeroY} Z`;

    // Y-axis labels (5 ticks)
    const yTicks: { y: number; label: string }[] = [];
    for (let i = 0; i <= 4; i++) {
      const rate = max - (i / 4) * (max - min);
      yTicks.push({
        y: scaleY(rate),
        label: (rate * 100).toFixed(4) + "%",
      });
    }

    // X-axis labels (up to 6 ticks)
    const xTickCount = Math.min(6, snapshots.length);
    const xTicks: { x: number; label: string }[] = [];
    for (let i = 0; i < xTickCount; i++) {
      const idx = Math.round((i / (xTickCount - 1)) * (snapshots.length - 1));
      xTicks.push({
        x: scaleX(snapshots[idx].timestamp),
        label: formatTime(snapshots[idx].timestamp),
      });
    }

    return {
      yLabels: yTicks,
      xLabels: xTicks,
      zeroY: clampedZeroY,
      points: pts,
      posPath: posAreaPath,
      negPath: negAreaPath,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshots, renderTick]);

  // Line path
  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`)
    .join(" ");

  // Current value
  const currentRate = snapshots[snapshots.length - 1].rate;
  const currentY = points[points.length - 1].y;
  const currentLabel =
    (currentRate >= 0 ? "+" : "") + (currentRate * 100).toFixed(4) + "%";

  return (
    <div className="w-full section-card">
      <svg
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full"
        style={{ height: 400 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid horizontal lines */}
        {yLabels.map((t, i) => (
          <line
            key={`hg-${i}`}
            x1={padding.left}
            y1={t.y}
            x2={viewW - padding.right}
            y2={t.y}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
        ))}

        {/* Grid vertical lines */}
        {xLabels.map((t, i) => (
          <line
            key={`vg-${i}`}
            x1={t.x}
            y1={padding.top}
            x2={t.x}
            y2={viewH - padding.bottom}
            stroke={COLORS.grid}
            strokeWidth={1}
          />
        ))}

        {/* Zero line */}
        {zeroY >= padding.top && zeroY <= padding.top + chartH && (
          <line
            x1={padding.left}
            y1={zeroY}
            x2={viewW - padding.right}
            y2={zeroY}
            stroke={COLORS.zero}
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        )}

        {/* Positive fill */}
        <path d={posPath} fill={COLORS.posFill} />

        {/* Negative fill */}
        <path d={negPath} fill={COLORS.negFill} />

        {/* Data line */}
        <path
          d={linePath}
          fill="none"
          stroke={COLORS.line}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Y-axis labels */}
        {yLabels.map((t, i) => (
          <text
            key={`yl-${i}`}
            x={padding.left - 8}
            y={t.y + 4}
            textAnchor="end"
            className="fill-muted"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {t.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((t, i) => (
          <text
            key={`xl-${i}`}
            x={t.x}
            y={viewH - padding.bottom + 18}
            textAnchor="middle"
            className="fill-muted"
            style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
          >
            {t.label}
          </text>
        ))}

        {/* Current value dot */}
        <circle
          cx={points[points.length - 1].x}
          cy={currentY}
          r={4}
          fill={COLORS.line}
        />

        {/* Current value label */}
        <rect
          x={viewW - padding.right + 6}
          y={currentY - 10}
          width={56}
          height={20}
          rx={4}
          fill={
            currentRate >= 0
              ? "rgba(16, 185, 129, 0.2)"
              : "rgba(244, 63, 94, 0.2)"
          }
        />
        <text
          x={viewW - padding.right + 34}
          y={currentY + 4}
          textAnchor="middle"
          fill={currentRate >= 0 ? "#10b981" : "#f43f5e"}
          style={{
            fontSize: 10,
            fontFamily: "ui-monospace, monospace",
            fontWeight: 600,
          }}
        >
          {currentLabel}
        </text>
      </svg>
    </div>
  );
}
