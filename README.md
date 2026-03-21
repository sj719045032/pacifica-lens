# Pacifica Lens

Real-time perpetuals analytics dashboard for Pacifica exchange. Built for Pacifica Hackathon 2026 - Track 2: Analytics & Data.

## Live Demo

https://pacifica-lens-v2.vercel.app

## Features (9 pages)

### Market Overview

Real-time stats (volume, OI, gainers/losers), sortable market table with category filters (crypto, stocks, commodities, forex), search.

### Funding Rate Analysis

Long/Short arbitrage opportunities, all markets ranked by funding intensity with visual bars, annualized rates, live SVG funding rate trend chart.

### Market Heatmap

Treemap visualization sized by volume or OI, colored by 24h change or funding rate, category grouping, hover tooltips.

### Market Screener

5 preset filters (High Funding, Negative Funding, Most Volatile, Top Volume, New Markets), custom filter panel (category, funding range, volume, leverage), sortable results.

### Whale Tracker

Top 20 traders by PnL from leaderboard API, click to expand real-time positions with unrealized PnL, aggregate whale long/short sentiment per symbol.

### Orderbook Depth

Live Level-2 orderbook data, bid/ask depth chart, imbalance indicator, order wall detection, spread and depth metrics, 2-second auto-refresh.

### Trade Flow

Real-time taker flow analysis, buy/sell pressure metrics, open vs close ratio, liquidation detection, large trade alerts (>$50K), net OI change tracking.

### Portfolio Analyzer

Enter any Solana address to view: account equity and margin, current positions with live unrealized PnL, trade history with win rate, funding payment history. Supports Privy wallet connection for one-click analysis.

### AI Market Intelligence

Automated rule-based analysis engine generating natural language insights from 12 signal types: funding anomalies, orderbook imbalance, whale activity, cross-asset divergence, volume surges, funding arbitrage opportunities, and more. Auto-refreshes every 30 seconds.

## Pacifica API Integration

All data is sourced live from Pacifica infrastructure:

- **REST:** /info, /info/prices, /leaderboard, /book, /trades, /positions, /account, /positions/history, /funding/history, /orders/history
- **WebSocket:** prices channel (real-time), trades channel
- **Total:** 12+ API endpoints deeply integrated

No historical databases or third-party data providers are used. The dashboard connects directly to Pacifica APIs for a fully real-time experience.

## Sponsor Integration

- Privy (@privy-io/react-auth) for Solana wallet connection

## Tech Stack

- React 19, TypeScript, Vite 8, TailwindCSS 4
- React Router for SPA navigation
- Privy for wallet auth
- Pure CSS/SVG charts (no chart library dependency)
- Deployed on Vercel

## Getting Started

```bash
npm install
npm run dev
```

## Architecture

- `/src/hooks/use-pacifica-ws.ts` - WebSocket connection with auto-reconnect
- `/src/lib/types.ts` - Shared types and formatting utilities
- `/src/pages/` - 9 feature pages
- `/src/components/` - Reusable components (Sidebar, FundingChart, WalletButton)

## What's Next

- Historical funding rate charts with persistent data
- Cross-exchange funding rate comparison
- Liquidation cascade prediction
- Mobile responsive design
- AI-powered trade suggestions

## License

Built for the Pacifica 2026 Hackathon.
