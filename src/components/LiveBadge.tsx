/**
 * Unified live status indicator used across all pages.
 * Two variants:
 *  - "indicator": static pill showing "LIVE" (for read-only display)
 *  - "toggle": clickable button toggling between LIVE/PAUSED
 */

interface LiveIndicatorProps {
  className?: string;
}

export function LiveIndicator({ className }: LiveIndicatorProps) {
  return (
    <span className={`inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-up/8 border border-up/15 ${className ?? ""}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-up live-pulse" />
      <span className="text-[10px] font-mono font-medium text-up/90 uppercase tracking-widest">Live</span>
    </span>
  );
}

interface LiveToggleProps {
  active: boolean;
  onToggle: () => void;
  intervalSec?: number;
  className?: string;
}

export function LiveToggle({ active, onToggle, intervalSec, className }: LiveToggleProps) {
  return (
    <button
      onClick={onToggle}
      className={`press-scale inline-flex items-center gap-1.5 text-[11px] font-mono font-medium px-2.5 py-1 rounded-full border transition-all duration-200 ${
        active
          ? "border-up/20 bg-up/8 text-up/90"
          : "border-border bg-card text-muted hover:text-fg hover:border-border/80"
      } ${className ?? ""}`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full transition-colors ${
          active ? "bg-up live-pulse" : "bg-muted"
        }`}
      />
      {active ? "LIVE" : "PAUSED"}
      {active && intervalSec != null && (
        <span className="text-up/50 ml-0.5">{intervalSec}s</span>
      )}
    </button>
  );
}
