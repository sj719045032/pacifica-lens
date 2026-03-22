# Pacifica Lens

Real-time perpetuals analytics dashboard for Pacifica exchange. Built for Pacifica Hackathon 2026 - Track 2: Analytics & Data.

## Live Demo

- Production: https://pacifica-analytics.vercel.app
- GitHub: https://github.com/sj719045032/pacifica-lens

## Features (11 pages)

### Market Overview
Real-time stats (volume, OI, gainers/losers), sortable market table with category filters (crypto, stocks, commodities, forex, index), search, cross-page symbol links.

### Funding Rate Analysis
Long/Short arbitrage opportunities, all markets ranked by funding intensity with visual bars, annualized rates, live SVG funding rate trend chart.

### Market Heatmap
Treemap visualization sized by volume or OI, colored by 24h change or funding rate, hover tooltips with full market details.

### Market Screener
5 preset filters (High Funding, Negative Funding, Most Volatile, Top Volume, New Markets), custom filter panel (category, funding range, volume, leverage), sortable results.

### Whale Tracker
Top 20 traders by PnL from leaderboard API, click to expand real-time positions with unrealized PnL, aggregate whale long/short sentiment per symbol.

### Orderbook Depth
Live Level-2 orderbook data, bid/ask depth chart, imbalance indicator, order wall detection, spread and depth metrics, 2-second auto-refresh.

### Trade Flow
Real-time taker flow analysis, buy/sell pressure metrics, open vs close ratio, liquidation detection, large trade alerts (>$50K), net OI change tracking.

### Portfolio Analyzer
Top 10 whale quick selector from leaderboard, enter any Solana address to view: account equity and margin, current positions with live unrealized PnL, trade history with win rate, funding payment history, trade pattern analysis (preferred pairs, hold time, active sessions). Supports Privy wallet connection.

### AI Market Intelligence
Automated rule-based analysis engine generating natural language insights from 12 signal types: funding anomalies, orderbook imbalance, whale activity, cross-asset divergence, volume surges, funding arbitrage opportunities. Auto-refreshes every 30 seconds.

### Liquidation Monitor
Real-time liquidation event detection across top 10 symbols, liquidation feed with mega-liq alerts, per-symbol liquidation heatmap, long/short liquidation ratio. Polls every 5 seconds.

### Cross-Market Correlation
Multi-asset class performance comparison (crypto, stocks, commodities, forex, index), cross-asset divergence alerts, top movers across all classes, funding rate comparison by asset class.

## Pacifica API Integration

12+ endpoints deeply integrated, all data live:

| Type | Endpoints |
|------|-----------|
| REST | /info, /info/prices, /leaderboard, /book, /trades, /positions, /account, /positions/history, /funding/history, /orders/history |
| WebSocket | prices channel (real-time all markets), trades channel (per symbol) |

## Sponsor Integration

- Privy (@privy-io/react-auth) for Solana wallet connection

## Tech Stack

- React 19, TypeScript, Vite 8, TailwindCSS 4
- React Router for SPA navigation
- Privy for wallet auth
- Pure CSS/SVG charts (no chart library dependency)
- Inter font (Google Fonts)
- Deployed on Vercel

## Development

### Prerequisites
- Node.js 18+
- npm

### Local Development
```bash
git clone https://github.com/sj719045032/pacifica-lens.git
cd pacifica-lens
npm install
npm run dev
# Open http://localhost:5173
```

### Type Check
```bash
npx tsc --noEmit
```

### Production Build
```bash
npm run build
# Output in dist/
```

### Deploy to Vercel
```bash
# First time: npx vercel login
npx vercel --prod --yes

# Update alias after deploy:
npx vercel alias pacifica-lens-v2.vercel.app pacifica-analytics.vercel.app
```

### Git Workflow
```bash
# Make changes, then:
git add -A
git commit -m "description"
git push

# Deploy:
npx vercel --prod --yes
npx vercel alias pacifica-lens-v2.vercel.app pacifica-analytics.vercel.app
```

### Common Issues

| Issue | Fix |
|-------|-----|
| Vercel build fails with unused vars | `npx tsc --noEmit` locally first, fix errors |
| `.npmrc` needed for peer deps | `legacy-peer-deps=true` already in .npmrc |
| Privy wallet not connecting | Check Privy dashboard: Authentication > External wallets enabled, Domains > localhost + vercel URL added |
| Heatmap tooltip offset | Tooltip uses `createPortal` to body to avoid CSS filter/transform issues |

## Architecture

```
src/
  hooks/
    use-pacifica-ws.ts    # WebSocket connection with auto-reconnect + ping
  lib/
    types.ts              # Shared types, formatters, category helpers
  components/
    Sidebar.tsx           # Fixed left nav with active indicator
    TopBar.tsx            # Fixed top bar with page title + wallet
    WalletButton.tsx      # Privy wallet connect/status
    FundingChart.tsx       # Live SVG funding rate chart
  pages/
    Overview.tsx          # Market overview dashboard
    Funding.tsx           # Funding rate analysis
    Heatmap.tsx           # Treemap visualization
    Screener.tsx          # Market screener/filter
    Whales.tsx            # Whale tracker + sentiment
    Orderbook.tsx         # Orderbook depth
    TradeFlow.tsx         # Trade flow analysis
    Portfolio.tsx         # Portfolio analyzer + whale copy
    AiInsights.tsx        # AI market intelligence
    Liquidations.tsx      # Liquidation monitor
    Correlation.tsx       # Cross-market correlation
```

## Hackathon Reference

See [HACKATHON.md](./HACKATHON.md) for full hackathon rules, judging criteria, and submission requirements.

See [DEMO_SCRIPT.md](./DEMO_SCRIPT.md) for the video recording script.

## Submission Checklist

- [x] Source code on GitHub
- [x] Live deployment on Vercel
- [x] Uses Pacifica API (12+ endpoints)
- [x] Sponsor integration (Privy)
- [x] README documentation
- [ ] Demo video (max 10 min, voice narration required)
- [ ] Submit via https://forms.gle/zYm9ZBH1SoUE9t9o7

## License

Built for the Pacifica 2026 Hackathon.
