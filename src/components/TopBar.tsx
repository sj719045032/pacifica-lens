import { useLocation } from "react-router-dom";
import { WalletStatus } from "./WalletButton";
import { LiveIndicator } from "./LiveBadge";

const PAGE_META: Record<string, { title: string; description: string }> = {
  "/": { title: "Market Overview", description: "Real-time perpetuals analytics" },
  "/funding": { title: "Funding Rates", description: "Analyze funding rate opportunities" },
  "/heatmap": { title: "Market Heatmap", description: "Visual market overview" },
  "/screener": { title: "Market Screener", description: "Filter and discover markets" },
  "/whales": { title: "Whale Tracker", description: "Track top traders" },
  "/orderbook": { title: "Orderbook Depth", description: "Live Level-2 data" },
  "/tradeflow": { title: "Trade Flow", description: "Real-time order flow" },
  "/portfolio": { title: "Portfolio Analyzer", description: "Account analysis" },
  "/ai-insights": { title: "AI Intelligence", description: "Automated market analysis" },
  "/liquidations": { title: "Liquidation Monitor", description: "Real-time liquidation events" },
  "/correlation": { title: "Cross-Market Correlation", description: "Multi-asset class analysis" },
};

function splitFirstWord(text: string): [string, string] {
  const idx = text.indexOf(" ");
  if (idx === -1) return [text, ""];
  return [text.slice(0, idx), text.slice(idx)];
}

export function TopBar() {
  const location = useLocation();

  const meta = PAGE_META[location.pathname] ?? PAGE_META["/"];
  const [firstWord, rest] = splitFirstWord(meta.title);

  return (
    <header className="fixed top-0 left-16 right-0 h-14 z-40 flex items-center justify-between px-6 glass border-b border-border/40">
      {/* Left: Page title + description */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="min-w-0">
          <h1 className="text-[15px] font-bold text-fg leading-tight truncate tracking-tight">
            <span className="gradient-text text-neon">{firstWord}</span>{rest}
          </h1>
          <p className="text-[11px] text-muted/70 leading-tight truncate font-light tracking-wide">{meta.description}</p>
        </div>
      </div>

      {/* Center: Live indicator */}
      <div className="hidden md:block">
        <LiveIndicator />
      </div>

      {/* Right: Wallet */}
      <div className="flex items-center">
        <WalletStatus />
      </div>
      <div className="absolute bottom-0 left-0 right-0 divider-gradient" />
    </header>
  );
}
