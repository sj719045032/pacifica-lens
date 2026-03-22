# Pacifica 2026 Hackathon - Complete Reference

## Our Track: Analytics & Data

---

## Timeline

| Date | Phase |
|------|-------|
| Feb 25 | Announcement + API walkthrough AMA |
| Mar 16 - Apr 16 | Development (weekly office hours available) |
| **Apr 16** | **Submission Deadline** |
| Post-Apr 16 | Demo Day - present to judges |

---

## Prize Structure ($15,000 + 100,000 points)

| Award | Cash | Points | Count |
|-------|------|--------|-------|
| Grand Prize (Best Overall) | $5,000 | 30,000 | 1 |
| Track Winner | $2,000 | 14,000 | 4 (one per track) |
| Special Award | $1,000 | 7,000 | 2 (Most Innovative / Best UX) |

*Grand Prize winner also counts as their track winner (overlaps)*

**Maximum possible: $7,000** (Grand Prize + Track Winner overlap, or Grand Prize + Special Award)

---

## Judging Criteria (No Weights Specified)

1. **Innovation** - novelty and creative use of infrastructure
2. **Technical Execution** - code quality, API integration, development rigor
3. **User Experience** - polish, usability, intuitive design
4. **Potential Impact** - adoption likelihood
5. **Presentation** - demo clarity and effectiveness

---

## Tracks & Official Project Ideas

### Track 1: Trading Applications & Bots
- Grid Trading Bot (Medium)
- Funding Rate Arbitrage Bot (Medium)
- Smart TP/SL Manager (Low-Medium)
- TradingView Webhook Executor (Low)
- Cross-Exchange Spread Bot (High)
- Hummingbot strategy (High)

### Track 2: Analytics & Data (OUR TRACK)
- **Whale Watcher** - Track large position changes, alert when big players enter/exit (Medium)
- **Orderbook Imbalance Indicator** - Real-time bid/ask pressure visualization from WebSocket orderbook data (Medium)

### Track 3: Social & Gamification
- Prediction Market Overlay (High)
- Funded Challenges Platform (High)

### Track 4: DeFi Composability
- Vault Strategy Manager (High)
- Basis Trade Vault (High)
- Options-like Payoffs (High)
- Cross-Chain Bridge Interface (High)
- Margin Efficiency Tool (Medium)

**NOTE:** Track 2 only has 2 official ideas listed - this means there's lots of room for original ideas, and our multi-feature analytics dashboard is differentiated!

---

## Team Rules

- Solo or up to 5 members max
- Must register via official form AND join Discord
- Kickoff and demo day attendance recommended
- **Must use Pacifica API and/or Builder Code**
- **All work must be created DURING the hackathon period** (no pre-built projects)
- External code must be clearly acknowledged
- Member changes only during first half of hackathon

---

## Submission Requirements

### Deadline: April 16, 2026

### Required Materials:
1. **Source Code** (GitHub repository)
2. **Demo Video** (see video guide below)
3. **Documentation**

### Submission Form: https://forms.gle/zYm9ZBH1SoUE9t9o7

---

## Video Demo Guide (CRITICAL - submissions without compliant video WILL NOT be judged)

### Format Requirements:
- **Max 10 minutes** (shorter is better)
- Voice narration is **required** (live or recorded)
- Screen recording strongly recommended
- Slides allowed only if paired with live demo
- Camera-on is optional

### Recommended Structure:

1. **Problem & Idea (30-45 sec)**
   - What problem are you solving?
   - Who is this for?
   - Why does this matter for perp trading / DeFi?

2. **Solution Overview (30-45 sec)**
   - What you built
   - What kind of product it is
   - How it fits into the Pacifica ecosystem

3. **Live Product Walkthrough (1.5-3 min)** ← MOST IMPORTANT
   - Show the UI, dashboard, bot logs, or CLI
   - Key user flows
   - Real or testnet data where possible
   - **Judges want to SEE IT WORKING**

4. **Pacifica Integration (30-60 sec)**
   - Which Pacifica APIs used
   - How orders, positions, funding, or margin are handled
   - How builder code is integrated (if applicable)
   - **Make it obvious that Pacifica is CORE, not optional**

5. **Value & Impact (20-40 sec)**
   - Why traders would actually use this
   - What makes this better than existing tools

6. **What's Next (20-30 sec)**
   - Features you'd build with more time
   - Post-hackathon evolution

### What Judges Want to Answer:
- Does this solve a real problem?
- Does it work?
- Is Pacifica meaningfully used?
- Would someone realistically use this?

### What to AVOID:
- No narration or explanation
- Long theory-only explanations
- Pure slide decks with no demo
- Overly technical deep-dives (save those for code)

> "Pretend you have 5 minutes to convince an investor or potential user to care."
> "If judges understand what it is, how it works, and why it's valuable, you've done it right."

---

## Developer Resources

| Resource | URL |
|----------|-----|
| Builder Program | https://docs.pacifica.fi/builder-program |
| API Documentation | https://docs.pacifica.fi/api-documentation/api |
| Python SDK | https://github.com/pacifica-fi/python-sdk |
| Testnet App | https://test-app.pacifica.fi/ (Code: "Pacifica") |
| Mainnet App | https://app.pacifica.fi |
| Discord API Channel | https://discord.com/channels/1325864651816435822/1378723526957334548 |
| Builder Channel | https://discord.com/channels/1325864651816435822/1466029551498035241 |
| Office Hours | https://discord.com/channels/1325864651816435822/1466029925218914396 |
| Discord Invite | http://discord.gg/pacifica |

### API Endpoints Discovered:
- REST: `https://api.pacifica.fi/api/v1/info` - Market metadata + funding rates
- WebSocket: `wss://ws.pacifica.fi/ws`
  - `prices` channel - real-time prices, funding, OI, volume for all markets
  - `trades` channel - per-symbol trades stream

### Sponsor Tools (can integrate for bonus points):
- **Fuul** (https://www.fuul.xyz/) - referral/attribution
- **Rhinofi** (https://rhino.fi) - cross-chain bridging
- **Privy** (https://www.privy.io/) - wallet auth
- **Elfa AI** (https://www.elfa.ai/) - social intelligence

---

## Registration Links

- Hackathon Registration: https://forms.gle/1FP2EuvZqYiP7Tiy7
- Submission Form: https://forms.gle/zYm9ZBH1SoUE9t9o7

---

## Key Takeaways for Our Project (Pacifica Lens)

### Strengths:
- [x] 11 feature pages (was 4 originally)
- [x] 12+ Pacifica API endpoints (REST + WebSocket)
- [x] Real-time data, not mocked
- [x] Privy wallet integration (sponsor tool)
- [x] Covers both official Track 2 ideas (Whale Watcher + Orderbook Imbalance)
- [x] Goes far beyond with: Liquidation Monitor, Cross-Market Correlation, AI Intelligence, Trade Pattern Analysis
- [x] Cinema dark UI with glassmorphism, ambient lighting, Inter font
- [x] Deployed at https://pacifica-analytics.vercel.app

### Remaining:
- [ ] Record demo video (CRITICAL - max 10 min, voice narration required)
- [ ] Submit via https://forms.gle/zYm9ZBH1SoUE9t9o7
