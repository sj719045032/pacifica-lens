import { useState, useMemo, useCallback, useRef } from "react";
import { usePacificaPrices } from "@/hooks/use-pacifica-ws";
import {
  type PriceData,
  getCategory,
  formatPrice,
  formatNumber,
  formatFundingRate,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type SizeMetric = "volume" | "oi";
type ColorMetric = "change" | "funding";
type Category = ReturnType<typeof getCategory>;

interface TreemapItem {
  symbol: string;
  price: PriceData;
  category: Category;
  sizeValue: number;
  colorValue: number;
}

interface LayoutRect {
  x: number;
  y: number;
  w: number;
  h: number;
  item: TreemapItem;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function changePct(p: PriceData): number {
  const mark = parseFloat(p.mark);
  const yesterday = parseFloat(p.yesterday_price);
  if (!yesterday || !mark) return 0;
  return ((mark - yesterday) / yesterday) * 100;
}

function fundingPct(p: PriceData): number {
  return parseFloat(p.funding) * 100;
}

/**
 * Map a value to a CSS color.
 * Positive -> green shades, negative -> red shades.
 * Intensity proportional to magnitude, clamped at +-10 for change and +-0.05 for funding.
 */
function colorForValue(value: number, metric: ColorMetric): string {
  const maxMag = metric === "change" ? 10 : 0.05;
  const clamped = Math.max(-maxMag, Math.min(maxMag, value));
  const t = Math.abs(clamped) / maxMag; // 0..1

  // Base color (dark bg): rgb(20, 24, 32)
  // Interpolate toward vivid green or red for high intensity
  if (value >= 0) {
    // Interpolate from dark base toward rgb(34, 197, 94) (vivid green)
    const r = Math.round(20 + t * (34 - 20));
    const g = Math.round(24 + t * (197 - 24));
    const b = Math.round(32 + t * (94 - 32));
    return `rgb(${r}, ${g}, ${b})`;
  }
  // Interpolate from dark base toward rgb(239, 68, 68) (vivid red)
  const r = Math.round(20 + t * (239 - 20));
  const g = Math.round(24 + t * (68 - 24));
  const b = Math.round(32 + t * (68 - 32));
  return `rgb(${r}, ${g}, ${b})`;
}

function borderForValue(value: number, metric: ColorMetric): string {
  const maxMag = metric === "change" ? 10 : 0.05;
  const clamped = Math.max(-maxMag, Math.min(maxMag, value));
  const t = Math.abs(clamped) / maxMag;

  if (value >= 0) {
    return `rgba(34, 197, 94, ${0.15 + t * 0.4})`;
  }
  return `rgba(239, 68, 68, ${0.15 + t * 0.4})`;
}

// ---------------------------------------------------------------------------
// Squarified Treemap Layout
// ---------------------------------------------------------------------------

function worstAspectRatio(
  row: number[],
  rowTotal: number,
  sideLength: number,
): number {
  if (row.length === 0 || sideLength === 0) return Infinity;
  const s2 = sideLength * sideLength;
  const rPlus = Math.max(...row);
  const rMinus = Math.min(...row);
  const totalSq = rowTotal * rowTotal;
  return Math.max(
    (s2 * rPlus) / totalSq,
    totalSq / (s2 * rMinus),
  );
}

function layoutRow(
  row: TreemapItem[],
  rowValues: number[],
  rect: { x: number; y: number; w: number; h: number },
  totalArea: number,
): { rects: LayoutRect[]; remaining: { x: number; y: number; w: number; h: number } } {
  const rowSum = rowValues.reduce((a, b) => a + b, 0);
  const rects: LayoutRect[] = [];

  if (rect.w >= rect.h) {
    // lay out vertically along left side
    const rowWidth = totalArea > 0 ? (rowSum / totalArea) * rect.w : 0;
    let y = rect.y;
    for (let i = 0; i < row.length; i++) {
      const h = rowWidth > 0 ? (rowValues[i] / rowSum) * rect.h : 0;
      rects.push({ x: rect.x, y, w: rowWidth, h, item: row[i] });
      y += h;
    }
    return {
      rects,
      remaining: {
        x: rect.x + rowWidth,
        y: rect.y,
        w: rect.w - rowWidth,
        h: rect.h,
      },
    };
  }

  // lay out horizontally along top
  const rowHeight = totalArea > 0 ? (rowSum / totalArea) * rect.h : 0;
  let x = rect.x;
  for (let i = 0; i < row.length; i++) {
    const w = rowHeight > 0 ? (rowValues[i] / rowSum) * rect.w : 0;
    rects.push({ x, y: rect.y, w, h: rowHeight, item: row[i] });
    x += w;
  }
  return {
    rects,
    remaining: {
      x: rect.x,
      y: rect.y + rowHeight,
      w: rect.w,
      h: rect.h - rowHeight,
    },
  };
}

function squarify(
  items: TreemapItem[],
  rect: { x: number; y: number; w: number; h: number },
): LayoutRect[] {
  if (items.length === 0) return [];
  if (items.length === 1) {
    return [{ x: rect.x, y: rect.y, w: rect.w, h: rect.h, item: items[0] }];
  }

  const totalValue = items.reduce((a, b) => a + b.sizeValue, 0);
  if (totalValue <= 0) return [];

  const totalArea = rect.w * rect.h;
  // Normalize values to areas
  const areas = items.map((it) => (it.sizeValue / totalValue) * totalArea);

  const result: LayoutRect[] = [];

  let currentRow: TreemapItem[] = [];
  let currentRowValues: number[] = [];
  let currentRowTotal = 0;
  let remainingArea = totalArea;
  let currentRect = { ...rect };
  let idx = 0;

  while (idx < items.length) {
    const area = areas[idx];
    const newRow = [...currentRowValues, area];
    const newTotal = currentRowTotal + area;
    const side = Math.min(currentRect.w, currentRect.h);

    if (
      currentRow.length === 0 ||
      worstAspectRatio(newRow, newTotal, side) <=
        worstAspectRatio(currentRowValues, currentRowTotal, side)
    ) {
      currentRow.push(items[idx]);
      currentRowValues.push(area);
      currentRowTotal = newTotal;
      idx++;
    } else {
      // Flush current row
      const { rects, remaining } = layoutRow(
        currentRow,
        currentRowValues,
        currentRect,
        remainingArea,
      );
      result.push(...rects);
      remainingArea -= currentRowTotal;
      currentRect = remaining;
      currentRow = [];
      currentRowValues = [];
      currentRowTotal = 0;
    }
  }

  // Flush last row
  if (currentRow.length > 0) {
    const { rects } = layoutRow(
      currentRow,
      currentRowValues,
      currentRect,
      remainingArea,
    );
    result.push(...rects);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Category config
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<Category, string> = {
  crypto: "Crypto",
  stock: "Stocks",
  commodity: "Commodities",
  forex: "Forex",
  index: "Indices",
};

const CATEGORY_ORDER: Category[] = ["crypto", "stock", "commodity", "forex", "index"];

// ---------------------------------------------------------------------------
// Toggle Button component
// ---------------------------------------------------------------------------

function ToggleGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted text-xs font-medium uppercase tracking-wider">
        {label}
      </span>
      <div className="flex rounded-lg bg-bg border border-border overflow-hidden">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 text-xs font-medium transition-all ${
              value === opt.value
                ? "bg-accent/20 text-accent"
                : "text-muted hover:text-fg hover:bg-card-hover"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

interface TooltipInfo {
  item: TreemapItem;
  x: number;
  y: number;
}

function Tooltip({ info }: { info: TooltipInfo }) {
  const { item } = info;
  const p = item.price;
  const change = changePct(p);
  const vol = parseFloat(p.volume_24h);
  const oi = parseFloat(p.open_interest);
  const mark = parseFloat(p.mark);

  const tooltipWidth = 220;
  const tooltipHeight = 200;
  const offsetX = info.x + tooltipWidth + 20 > window.innerWidth ? -tooltipWidth - 14 : 14;
  const offsetY = info.y + tooltipHeight + 20 > window.innerHeight ? -tooltipHeight - 14 : 14;

  return (
    <div
      className="fixed z-[100] pointer-events-none"
      style={{ left: info.x + offsetX, top: info.y + offsetY }}
    >
      <div className="bg-card border border-border rounded-xl px-4 py-3 shadow-2xl shadow-black/50 min-w-[200px]">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-fg font-bold text-sm">{item.symbol}</span>
          <span className="text-[10px] text-muted bg-bg px-1.5 py-0.5 rounded">
            {CATEGORY_LABELS[item.category]}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <span className="text-muted">Price</span>
          <span className="text-fg text-right font-mono">
            ${formatPrice(mark)}
          </span>
          <span className="text-muted">24h Change</span>
          <span
            className={`text-right font-mono ${change >= 0 ? "text-up" : "text-down"}`}
          >
            {change >= 0 ? "+" : ""}
            {change.toFixed(2)}%
          </span>
          <span className="text-muted">Volume 24h</span>
          <span className="text-fg text-right font-mono">
            ${formatNumber(vol)}
          </span>
          <span className="text-muted">Open Interest</span>
          <span className="text-fg text-right font-mono">
            ${formatNumber(oi)}
          </span>
          <span className="text-muted">Funding</span>
          <span
            className={`text-right font-mono ${
              parseFloat(p.funding) >= 0 ? "text-up" : "text-down"
            }`}
          >
            {formatFundingRate(p.funding)}
          </span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Treemap Cell
// ---------------------------------------------------------------------------

function TreemapCell({
  rect,
  colorMetric,
  onMouseEnter,
  onMouseLeave,
}: {
  rect: LayoutRect;
  colorMetric: ColorMetric;
  onMouseEnter: (e: React.MouseEvent, item: TreemapItem) => void;
  onMouseLeave: () => void;
}) {
  const { item } = rect;
  const change = changePct(item.price);
  const funding = fundingPct(item.price);
  const colorVal = colorMetric === "change" ? change : funding;
  const displayVal =
    colorMetric === "change"
      ? `${colorVal >= 0 ? "+" : ""}${colorVal.toFixed(2)}%`
      : formatFundingRate(item.price.funding);

  const bg = colorForValue(colorVal, colorMetric);
  const border = borderForValue(colorVal, colorMetric);

  const isLarge = rect.w >= 120 && rect.h >= 70;
  const isSmall = rect.w < 70 || rect.h < 45;
  const isTiny = rect.w < 45 || rect.h < 30;

  // 1px gap via inset positioning
  const GAP = 1;

  return (
    <div
      className="absolute rounded-[6px] overflow-hidden cursor-pointer transition-all duration-150 hover:brightness-125 hover:z-10 flex flex-col items-center justify-center"
      style={{
        left: rect.x + GAP,
        top: rect.y + GAP,
        width: Math.max(rect.w - GAP * 2, 0),
        height: Math.max(rect.h - GAP * 2, 0),
        background: bg,
        border: `1px solid ${border}`,
        padding: isTiny ? "2px" : "4px",
      }}
      onMouseEnter={(e) => onMouseEnter(e, item)}
      onMouseLeave={onMouseLeave}
    >
      {!isTiny && (
        <>
          <span
            className="font-bold text-fg truncate w-full text-center leading-tight"
            style={{ fontSize: isLarge ? "16px" : isSmall ? "10px" : "13px" }}
          >
            {item.symbol}
          </span>
          <span
            className={`font-mono leading-tight ${
              colorVal >= 0 ? "text-up" : "text-down"
            }`}
            style={{ fontSize: isLarge ? "13px" : isSmall ? "9px" : "11px" }}
          >
            {displayVal}
          </span>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Category Group
// ---------------------------------------------------------------------------

function CategoryTreemap({
  category,
  items,
  rect,
  colorMetric,
  onMouseEnter,
  onMouseLeave,
}: {
  category: Category;
  items: TreemapItem[];
  rect: { x: number; y: number; w: number; h: number };
  colorMetric: ColorMetric;
  onMouseEnter: (e: React.MouseEvent, item: TreemapItem) => void;
  onMouseLeave: () => void;
}) {
  const LABEL_HEIGHT = 22;

  const rects = useMemo(() => {
    const treemapRect = {
      x: 0,
      y: LABEL_HEIGHT,
      w: rect.w,
      h: rect.h - LABEL_HEIGHT,
    };
    return squarify(items, treemapRect);
  }, [items, rect.w, rect.h]);

  return (
    <div
      className="absolute rounded-xl overflow-hidden"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
    >
      {/* Category label */}
      <div
        className="absolute top-0 left-0 w-full flex items-center px-2 z-20"
        style={{ height: LABEL_HEIGHT }}
      >
        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted/70">
          {CATEGORY_LABELS[category]}
        </span>
      </div>
      {/* Cells */}
      <div className="absolute inset-0" style={{ top: LABEL_HEIGHT }}>
        <div className="relative w-full h-full">
          {rects.map((r) => (
            <TreemapCell
              key={r.item.symbol}
              rect={r}
              colorMetric={colorMetric}
              onMouseEnter={onMouseEnter}
              onMouseLeave={onMouseLeave}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function Heatmap() {
  const { prices } = usePacificaPrices();
  const [sizeMetric, setSizeMetric] = useState<SizeMetric>("volume");
  const [colorMetric, setColorMetric] = useState<ColorMetric>("change");
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerSize, setContainerSize] = useState({ w: 0, h: 0 });

  // Track container size with ResizeObserver
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const setContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
    }
    if (node) {
      containerRef.current = node;
      const ro = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setContainerSize({ w: width, h: height });
        }
      });
      ro.observe(node);
      resizeObserverRef.current = ro;
      // Initial size
      const rect = node.getBoundingClientRect();
      setContainerSize({ w: rect.width, h: rect.height });
    }
  }, []);

  // Build grouped items sorted by size value descending
  const groupedItems = useMemo(() => {
    const entries = Object.values(prices) as PriceData[];
    if (entries.length === 0) return new Map<Category, TreemapItem[]>();

    const groups = new Map<Category, TreemapItem[]>();

    for (const p of entries) {
      const cat = getCategory(p.symbol);
      const sizeValue =
        sizeMetric === "volume"
          ? parseFloat(p.volume_24h) || 0
          : parseFloat(p.open_interest) || 0;
      const colorValue =
        colorMetric === "change" ? changePct(p) : fundingPct(p);

      if (sizeValue <= 0) continue;

      const item: TreemapItem = {
        symbol: p.symbol,
        price: p,
        category: cat,
        sizeValue,
        colorValue,
      };

      const list = groups.get(cat);
      if (list) {
        list.push(item);
      } else {
        groups.set(cat, [item]);
      }
    }

    // Sort each group descending by size
    for (const [, list] of groups) {
      list.sort((a, b) => b.sizeValue - a.sizeValue);
    }

    return groups;
  }, [prices, sizeMetric, colorMetric]);

  // Layout categories as a top-level treemap so bigger categories get more space
  const categoryLayouts = useMemo(() => {
    if (containerSize.w === 0 || containerSize.h === 0) return [];

    const GAP = 6;
    const ordered = CATEGORY_ORDER.filter((c) => groupedItems.has(c));
    if (ordered.length === 0) return [];

    // Compute total value per category
    const catValues = ordered.map((c) => ({
      category: c,
      items: groupedItems.get(c)!,
      total: groupedItems.get(c)!.reduce((s, it) => s + it.sizeValue, 0),
    }));

    const totalValue = catValues.reduce((s, cv) => s + cv.total, 0);
    if (totalValue <= 0) return [];

    // Simple horizontal strip layout for categories, proportional to value
    const layouts: {
      category: Category;
      items: TreemapItem[];
      rect: { x: number; y: number; w: number; h: number };
    }[] = [];

    // Use a simplified squarify for categories too
    // For simplicity, do a horizontal strip layout
    let x = 0;
    const availableW = containerSize.w - (ordered.length - 1) * GAP;

    for (let i = 0; i < catValues.length; i++) {
      const fraction = catValues[i].total / totalValue;
      const w = i === catValues.length - 1
        ? containerSize.w - x // last one gets remaining to avoid rounding gaps
        : Math.round(fraction * availableW);

      layouts.push({
        category: catValues[i].category,
        items: catValues[i].items,
        rect: {
          x,
          y: 0,
          w: Math.max(w, 0),
          h: containerSize.h,
        },
      });

      x += w + GAP;
    }

    return layouts;
  }, [groupedItems, containerSize]);

  // Tooltip handlers
  const handleMouseEnter = useCallback(
    (e: React.MouseEvent, item: TreemapItem) => {
      setTooltip({ item, x: e.clientX, y: e.clientY });
    },
    [],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (tooltip) {
        setTooltip((prev) =>
          prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
        );
      }
    },
    [tooltip],
  );

  const handleMouseLeave = useCallback(() => {
    setTooltip(null);
  }, []);

  const count = Object.keys(prices).length;

  return (
    <div className="flex flex-col h-[calc(100vh-7rem)] gap-4 page-enter">
      {/* Controls */}
      <div className="flex items-center justify-end flex-shrink-0">
        <div className="flex items-center gap-4">
          <ToggleGroup
            label="Size"
            options={[
              { value: "volume", label: "Volume" },
              { value: "oi", label: "Open Interest" },
            ]}
            value={sizeMetric}
            onChange={(v) => setSizeMetric(v as SizeMetric)}
          />
          <div className="w-px h-6 bg-border" />
          <ToggleGroup
            label="Color"
            options={[
              { value: "change", label: "24h Change" },
              { value: "funding", label: "Funding" },
            ]}
            value={colorMetric}
            onChange={(v) => setColorMetric(v as ColorMetric)}
          />
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 flex-shrink-0">
        <div className="flex items-center gap-1.5">
          <div className="flex h-3 rounded-sm overflow-hidden">
            {[0.9, 0.7, 0.5, 0.3, 0.1].map((t) => (
              <div
                key={`r${t}`}
                className="w-4 h-full"
                style={{
                  background: colorForValue(
                    -(colorMetric === "change" ? 10 : 0.05) * t,
                    colorMetric,
                  ),
                }}
              />
            ))}
            {[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => (
              <div
                key={`g${t}`}
                className="w-4 h-full"
                style={{
                  background: colorForValue(
                    (colorMetric === "change" ? 10 : 0.05) * t,
                    colorMetric,
                  ),
                }}
              />
            ))}
          </div>
          <span className="text-[10px] text-muted ml-1">
            {colorMetric === "change" ? "-10% ... +10%" : "-0.05% ... +0.05%"}
          </span>
        </div>
        <span className="text-[10px] text-muted">
          Size = {sizeMetric === "volume" ? "24h Volume" : "Open Interest"}
        </span>
      </div>

      {/* Treemap Container */}
      <div
        ref={setContainerRef}
        className="flex-1 relative rounded-xl bg-card border border-border overflow-hidden"
        onMouseMove={handleMouseMove}
      >
        {count === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
              <span className="text-muted text-sm">Loading market data...</span>
            </div>
          </div>
        ) : (
          categoryLayouts.map((cl) => (
            <CategoryTreemap
              key={cl.category}
              category={cl.category}
              items={cl.items}
              rect={cl.rect}
              colorMetric={colorMetric}
              onMouseEnter={handleMouseEnter}
              onMouseLeave={handleMouseLeave}
            />
          ))
        )}
      </div>

      {/* Tooltip */}
      {tooltip && <Tooltip info={tooltip} />}
    </div>
  );
}
