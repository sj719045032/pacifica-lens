# Pacifica Lens

**Real-time perpetuals analytics dashboard for Pacifica exchange.**

Pacifica 2026 Hackathon | Track 2: Analytics & Data

---

## Overview

Pacifica Lens is a comprehensive analytics dashboard purpose-built for the Pacifica perpetual futures exchange. It provides traders and analysts with real-time visibility into market dynamics across 63+ perpetual markets spanning crypto, stocks, commodities, forex, and indices.

- Live streaming data via Pacifica WebSocket API -- no mocked data
- Built with React + TypeScript + Vite + TailwindCSS
- Four distinct analytical views for different trading workflows

## Features

### Market Overview

A high-level snapshot of the entire Pacifica exchange. Displays real-time aggregate statistics including total trading volume, open interest, and top gainers/losers. A sortable and filterable market table lets users drill into individual markets, with category tags and search for quick navigation.

### Funding Rate Analysis

Surfaces long/short arbitrage opportunities by ranking all markets by funding rate intensity. Each market displays visual intensity bars and annualized rate calculations, making it straightforward to identify mispriced funding across the exchange.

### Market Heatmap

A treemap visualization where tile size represents volume or open interest, and color encodes 24-hour price change or funding rate. Markets are grouped by category with hover tooltips for detailed metrics -- useful for spotting outliers at a glance.

### Market Screener

Five preset filters (High Funding, Negative Funding, Most Volatile, Top Volume, New Markets) provide one-click access to common screens. Custom filters support category selection, funding rate ranges, volume thresholds, and leverage parameters. Results are fully sortable.

## Pacifica Integration

All data is sourced live from Pacifica infrastructure:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/info` | Market metadata and configuration |
| `wss://ws.pacifica.fi/ws` | Real-time prices, funding rates, open interest, and volume |

No historical databases or third-party data providers are used. The dashboard connects directly to Pacifica APIs for a fully real-time experience.

## Tech Stack

- **React 19** + **TypeScript** -- UI framework and type safety
- **Vite 8** -- Build tooling and development server
- **TailwindCSS 4** -- Utility-first styling
- **React Router** -- Client-side routing
- **Lightweight Charts** -- Available for future candlestick chart views

## Getting Started

```bash
npm install
npm run dev
```

The development server will start and the dashboard will begin streaming live data from Pacifica immediately.

## What's Next

- Wallet connection for personal PnL tracking
- Historical funding rate charts
- Liquidation level heatmap
- AI-powered market summaries
- Mobile responsive design

## License

Built for the Pacifica 2026 Hackathon.
