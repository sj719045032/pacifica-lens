# Pacifica Lens

A real-time perpetuals analytics dashboard built on the Pacifica API, covering 63+ markets across crypto, stocks, commodities, forex, and indices.

## What is this?

Pacifica Lens is a comprehensive analytics platform for perpetual futures traders on the Pacifica exchange. It transforms raw market data from 12+ Pacifica API endpoints into actionable intelligence across 11 specialized pages -- from funding rate arbitrage to whale copy trading to cross-asset correlation analysis. Every data point is live. Nothing is mocked.

Built for the **Pacifica 2026 Hackathon**, Track 2: Analytics & Data.

## Live Demo

- **Production:** https://pacifica-analytics.vercel.app
- **GitHub:** https://github.com/sj719045032/pacifica-lens

## Key Highlights

- **11 analytics pages** covering every dimension of perpetual futures trading: price action, funding, orderbook depth, trade flow, liquidations, and more.
- **12+ Pacifica API endpoints deeply integrated** -- REST for account/market data, WebSocket for real-time streaming. Zero mocked data.
- **Multi-asset class coverage** -- crypto, equities, commodities, forex, and indices analyzed side by side with cross-asset divergence detection.
- **Unique features not found in existing tools** -- whale copy intelligence with aggregate sentiment, automated rule-based AI insights from 12 signal types, real-time liquidation monitoring with mega-liq alerts.

## Features

### Market Analytics

**Market Overview** (`/`) --
Real-time dashboard showing aggregate 24h volume, open interest, gainer/loser counts, and average funding across all markets. A sortable, searchable table displays every market with live price flashing on updates, category badges (Crypto, Stock, Commodity, Forex, Index), and cross-page links to orderbook and trade flow. Traders use this as their home base to spot opportunities at a glance.

**Funding Rate Analysis** (`/funding`) --
Surfaces long and short funding arbitrage opportunities by ranking all markets by funding intensity. Shows current rate, next projected rate, annualized yield, and a visual intensity bar for each market. Includes a live SVG funding rate trend chart with per-symbol selection. Useful for traders running funding rate arbitrage strategies or timing position entries.

**Market Heatmap** (`/heatmap`) --
A squarified treemap visualization of all 63+ markets, sized by 24h volume or open interest and colored by 24h price change or funding rate. Hover tooltips show full market details. Gives traders an instant visual read on which markets are moving and where capital is concentrated.

**Market Screener** (`/screener`) --
Five preset filters (High Funding, Negative Funding, Most Volatile, Top Volume, New Markets) plus a custom filter panel supporting category, funding range, volume threshold, and leverage range. Results are sortable by any column including market age. Designed for traders scanning for specific setups across the full market universe.

### Deep Analysis

**Whale Tracker** (`/whales`) --
Pulls the top 20 traders by all-time PnL from the Pacifica leaderboard API, with sortable columns for 1d/7d/30d/all-time PnL, equity, open interest, and 30d volume. Clicking any trader expands an inline detail view showing their real-time positions with unrealized PnL computed against live mark prices. Below the leaderboard, an aggregate whale sentiment section shows net long/short positioning per symbol across all top traders. Traders use this to understand what the best-performing accounts are doing right now.

**Orderbook Depth** (`/orderbook`) --
Live Level-2 orderbook data with a 2-second auto-refresh cycle. Displays a dual-sided depth chart, bid/ask imbalance bar, spread in bps, total depth on each side, and automatic order wall detection (levels exceeding 2x average size are highlighted and pulsed). Any symbol is selectable, and the page accepts a `?symbol=` query parameter for cross-page deep linking from the overview table.

**Trade Flow** (`/tradeflow`) --
Real-time taker trade analysis with buy/sell pressure metrics, open vs close ratio tracking, and liquidation detection. Large trades above $50K are flagged as alerts. Net open interest change is tracked to show whether new positions are being opened or closed. The trade feed displays each fill with side (long/short), action (open/close), cause (normal/liquidation), and notional value.

### Intelligence

**Portfolio Analyzer** (`/portfolio`) --
Enter any Solana address or select from the top 10 whale quick-pick list to view a full account breakdown: equity, margin usage, available balance, current positions with live unrealized PnL, trade history with PnL per trade, and funding payment history. Supports Privy wallet connection so traders can analyze their own accounts directly. Trade pattern analysis identifies preferred pairs, hold times, and active trading sessions.

**AI Market Intelligence** (`/ai-insights`) --
An automated rule-based analysis engine that generates natural language insights from 12 signal types: funding rate anomalies, funding flips, volume surges, OI concentration, orderbook imbalance, whale activity clustering, cross-asset divergence, funding arbitrage opportunities, and more. Each insight includes a confidence level (high/medium/low), relevant signals, and actionable context. Auto-refreshes every 30 seconds, pulling from prices, leaderboard, orderbook, and market info endpoints simultaneously.

**Liquidation Monitor** (`/liquidations`) --
Polls the trades endpoint every 5 seconds across the top 10 symbols by volume, filtering for liquidation events (`cause: "liquidation"`). Displays a real-time feed with mega-liquidation alerts (above $50K), a per-symbol liquidation heatmap with explosion-sized dots proportional to notional value, and a long/short liquidation ratio. Useful for identifying cascade risk and crowded positions.

**Cross-Market Correlation** (`/correlation`) --
Compares performance, volume, and funding across all five asset classes (crypto, stocks, commodities, forex, indices). Generates cross-asset divergence alerts when asset classes that normally correlate begin moving in opposite directions. Shows top movers across all classes and funding rate comparisons by asset class. Helps traders spot macro regime shifts and relative value opportunities.

## API Integration

| Type | Endpoint | Used By | Description |
|------|----------|---------|-------------|
| REST | `/api/v1/info` | Overview, Screener, Orderbook, AI Insights | Market metadata: tick sizes, leverage limits, creation dates, funding rates |
| REST | `/api/v1/book?symbol=` | Orderbook, AI Insights | Full Level-2 orderbook with bid/ask arrays, prices, sizes, and order counts |
| REST | `/api/v1/trades?symbol=` | Trade Flow, Liquidations | Recent trades with side, cause (normal/liquidation), price, and amount |
| REST | `/api/v1/leaderboard` | Whales, Portfolio, AI Insights | Top traders ranked by PnL with equity, OI, and volume stats |
| REST | `/api/v1/positions?account=` | Whales, Portfolio | Current open positions for a given account address |
| REST | `/api/v1/account?account=` | Whales, Portfolio | Account summary: equity, margin, balance, fee tier |
| REST | `/api/v1/positions/history?account=` | Portfolio | Historical position changes with PnL per trade |
| REST | `/api/v1/funding/history?account=` | Portfolio | Funding payment history per position |
| REST | `/api/v1/orders/history?account=` | Portfolio | Historical order log |
| REST | `/api/v1/info/prices` | Overview | Snapshot price data for all markets |
| WebSocket | `wss://ws.pacifica.fi/ws` (prices) | All pages | Real-time streaming of price, funding, OI, and volume for all markets |
| WebSocket | `wss://ws.pacifica.fi/ws` (trades) | Trade Flow | Per-symbol real-time trade stream |

## Sponsor Integration

- **Privy** (`@privy-io/react-auth`) -- Solana wallet connection for the Portfolio page, allowing traders to link their wallet and analyze their own account data directly.

## Tech Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| React | 19.2 | UI framework |
| TypeScript | 5.9 | Type safety |
| Vite | 8.0 | Build tooling and dev server |
| Tailwind CSS | 4.2 | Utility-first styling |
| React Router | 7.13 | Client-side SPA routing |
| Recharts | 3.8 | Charting library |
| Lightweight Charts | 5.1 | Financial charting |
| Privy | 3.18 | Wallet authentication |
| Solana Web3.js | 1.98 | Solana blockchain interaction |
| Vercel | -- | Deployment and hosting |

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Install and Run

```bash
git clone https://github.com/sj719045032/pacifica-lens.git
cd pacifica-lens
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

### Type Check

```bash
npx tsc --noEmit
```

### Production Build

```bash
npm run build
```

Output is written to `dist/`.

## Deploy

### Vercel (production)

```bash
# First-time setup
npx vercel login

# Deploy to production
npx vercel --prod --yes

# Set custom domain alias
npx vercel alias pacifica-lens-v2.vercel.app pacifica-analytics.vercel.app
```

The `vercel.json` in the repository configures a catch-all rewrite to `index.html` for SPA routing support.

### Common Issues

| Issue | Solution |
|-------|----------|
| Build fails with unused variable errors | Run `npx tsc --noEmit` locally and fix TypeScript errors before deploying |
| Peer dependency warnings during install | The `.npmrc` file sets `legacy-peer-deps=true` to resolve this |
| Privy wallet not connecting | Verify in the Privy dashboard that external wallets are enabled and both `localhost` and the Vercel URL are listed under allowed domains |
| Heatmap tooltip appears in the wrong position | The tooltip uses `createPortal` to render at the document body level, avoiding CSS `transform`/`filter` offset issues |

## Architecture

```
src/
  hooks/
    use-pacifica-ws.ts        WebSocket connection with auto-reconnect and keepalive ping
  lib/
    types.ts                  Shared types, number formatters, category classification
  components/
    Sidebar.tsx               Fixed left navigation rail with animated active indicator
    TopBar.tsx                Fixed top bar with page title, description, and wallet status
    WalletButton.tsx          Privy wallet connect and status display
    FundingChart.tsx           Live SVG funding rate trend chart
  pages/
    Overview.tsx              Market overview dashboard with stats, filters, and sortable table
    Funding.tsx               Funding rate analysis with arbitrage opportunities
    Heatmap.tsx               Squarified treemap visualization with configurable size/color
    Screener.tsx              Multi-filter market screener with presets
    Whales.tsx                Top trader leaderboard with position inspection and sentiment
    Orderbook.tsx             Live Level-2 orderbook with depth chart and wall detection
    TradeFlow.tsx             Real-time taker flow analysis with pressure metrics
    Portfolio.tsx             Account analyzer with positions, history, and funding payments
    AiInsights.tsx            Automated rule-based market intelligence engine
    Liquidations.tsx          Real-time liquidation event monitoring
    Correlation.tsx           Cross-asset class performance comparison
```

## Hackathon

| Detail | Value |
|--------|-------|
| Event | Pacifica 2026 Hackathon |
| Track | Track 2: Analytics & Data |
| Submission deadline | April 16, 2026 |
| Submission form | https://forms.gle/zYm9ZBH1SoUE9t9o7 |

See [HACKATHON.md](./HACKATHON.md) for full rules, judging criteria, prize structure, and video demo guide.

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the video recording script.

## Submission Checklist

- [x] Source code on GitHub
- [x] Live deployment on Vercel
- [x] Uses Pacifica API (12+ endpoints, REST + WebSocket)
- [x] Sponsor integration (Privy wallet auth)
- [x] Project documentation (README)
- [ ] Demo video (max 10 min, voice narration required)
- [ ] Submit via https://forms.gle/zYm9ZBH1SoUE9t9o7

## License

Built for the Pacifica 2026 Hackathon.
