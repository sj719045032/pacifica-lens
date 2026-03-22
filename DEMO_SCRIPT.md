# Pacifica Analytics - Demo Video Recording Script

> Total Duration: ~6:20 | Language: Chinese (technical terms in English)
> Format: Screen recording + voice narration | Resolution: 1920x1080

---

## Pre-Recording Checklist

- [ ] Open Pacifica Analytics in Chrome, full screen (F11)
- [ ] Confirm WebSocket connected (green "Live" dot visible)
- [ ] Clear browser console, close dev tools
- [ ] Test microphone, quiet environment
- [ ] Have the app on the Overview page before starting
- [ ] Close all other browser tabs (clean tab bar)
- [ ] Ensure screen recording software is ready (OBS / QuickTime / Loom)

---

## Section 1: Opening (0:00 - 0:30)

### Screen: Overview page already loaded, data flowing

### Narration:

> 大家好，我是 [你的名字]，这是我为 Pacifica 2026 Hackathon 开发的项目 -- Pacifica Analytics。
>
> 我们先来看一个问题。Pacifica 目前有超过 63 个永续合约市场，覆盖 crypto、美股、大宗商品、外汇、指数等多个资产类别，这在 DeFi 领域是非常独特的。但是，交易员目前缺少一个专门为 Pacifica 设计的专业分析工具。
>
> 他们需要什么？实时的市场全景、funding rate 套利机会发现、鲸鱼追踪、orderbook 深度分析、资金流向监控。Pacifica Analytics 就是为了解决这些问题而生的。

### Screen Action:
- **0:00** - 画面已经是 Overview 页面，数据在实时更新
- **0:15** - 鼠标慢慢滑过表格，展示数据在跳动（价格闪烁变化）
- **0:25** - 指向左上角 "Live" 绿点，强调实时性

---

## Section 2: Product Overview (0:30 - 1:00)

### Screen: Still on Overview, then scroll sidebar

### Narration:

> Pacifica Analytics 是一个实时的永续合约分析平台，完全基于 Pacifica API 构建。
>
> 整个产品有 11 个功能页面，深度集成了 12 个以上的 Pacifica API endpoint，包括 WebSocket 实时推送和 REST API。
>
> 每一个页面的每一条数据，都来自 Pacifica。这不是一个使用 mock data 的原型，而是一个真正连接 Pacifica 生产环境的实时工具。
>
> 下面让我带大家快速看一下每个核心功能。

### Screen Action:
- **0:30** - 鼠标移到左侧 sidebar，从上到下缓慢划过所有 11 个图标
- **0:40** - 指向页面底部 "Powered by Pacifica API | Real-time WebSocket data | 63+ perpetual markets" 字样
- **0:50** - 指向 "Built for Pacifica Hackathon 2026" badge

---

## Section 3: Live Demo - Overview (1:00 - 1:30)

### Screen: Overview page

### Narration:

> 首先是 Market Overview。这是整个平台的入口，展示 Pacifica 上所有市场的实时快照。
>
> 上方是关键统计指标：24 小时总交易量、全平台 Open Interest、市场数量、涨跌家数、以及平均 funding rate。这些数据全部通过 Pacifica WebSocket 实时更新。
>
> 下方的表格支持按资产类别筛选 -- 你可以看到 Crypto、Stocks、Commodities、Forex、Index，这是 Pacifica 的独特优势。
>
> 每个市场都显示了实时价格、24 小时涨跌幅、交易量、Open Interest、hourly funding rate、年化 funding rate、以及最大杠杆。支持点击任意列头排序。

### Screen Action:
- **1:00** - 指向顶部 5 个 stat cards，停留 2-3 秒
- **1:07** - 点击 "Stocks" filter，展示美股永续合约（NVDA, TSLA, GOOGL 等）
- **1:12** - 点击 "Commodities" filter，展示大宗商品（XAU, XAG 等）
- **1:17** - 点击回 "All"
- **1:20** - 点击 "Funding (1h)" 列头排序，展示 funding rate 最高/最低的
- **1:25** - 在 search 框输入 "BTC"，快速筛选

---

## Section 4: Live Demo - Funding Rates (1:30 - 2:00)

### Screen: Click Funding in sidebar

### Narration:

> 接下来是 Funding Rates 页面。资金费率是永续合约最重要的指标之一。
>
> 这里有两张机会卡片：左边是 Long Opportunities -- 也就是 funding rate 最负的市场，做多可以赚 funding；右边是 Short Opportunities -- funding rate 最正的市场，做空可以赚 funding。这对于 funding rate 套利交易员来说非常有价值。
>
> 下面是 Live Funding Rate Trend 实时图表，你可以选择任意市场查看 funding rate 的变化趋势。
>
> 再往下是完整的市场列表，按 funding rate 绝对值排序，还有 intensity bar 直观展示 funding rate 强度。

### Screen Action:
- **1:30** - 点击 sidebar 的 Funding 图标
- **1:33** - 指向 "LONG" 和 "SHORT" opportunity cards，停留 3 秒
- **1:40** - 指向 Live Funding Rate Trend chart
- **1:45** - 用 dropdown 切换到 BTC，再切换到 ETH，展示图表变化
- **1:52** - 滚动到下方 All Markets 表格，指向 intensity bar

---

## Section 5: Live Demo - Heatmap (2:00 - 2:15)

### Screen: Click Heatmap in sidebar

### Narration:

> 这是 Market Heatmap，用 treemap 可视化展示整个 Pacifica 生态的市场格局。
>
> 方块大小代表交易量或 Open Interest，颜色代表 24 小时涨跌幅或 funding rate。你可以自由切换这些维度。
>
> 鼠标悬停可以看到每个市场的详细信息。注意市场是按类别分组的 -- Crypto、Stocks、Commodities、Forex。一目了然。

### Screen Action:
- **2:00** - 点击 sidebar 的 Heatmap 图标
- **2:03** - 鼠标在热力图上移动，展示 tooltip 弹出
- **2:07** - 点击 Size 切换为 "Open Interest"
- **2:10** - 点击 Color 切换为 "Funding"
- **2:13** - 再切换回 "24h Change" + "Volume"

---

## Section 6: Live Demo - Whale Tracker (2:15 - 3:00)

### Screen: Click Whales in sidebar

### Narration:

> 这是我最想展示的功能之一 -- Whale Tracker，鲸鱼追踪。
>
> 这个页面使用了 Pacifica 的 leaderboard API 获取排名前 20 的交易员，展示他们的 1 天、7 天、30 天和全部 PnL、当前 equity 和 Open Interest。
>
> 点击任意一行可以展开，这时会调用 Pacifica 的 positions API 和 account API，实时查看这个鲸鱼当前持有的每一个仓位 -- 包括 symbol、方向、仓位大小、入场价、当前的 mark price（来自 WebSocket 实时更新）、以及实时计算的 unrealized PnL。
>
> 下面还有一个 Aggregate Whale Sentiment 图 -- 我们把所有 top 20 鲸鱼的持仓聚合起来，按 symbol 展示 long/short 比例。这让你一眼看到鲸鱼们整体偏多还是偏空。
>
> 这个功能组合了 leaderboard、positions、account 三个 Pacifica API，加上 WebSocket 实时价格，形成了一个完整的鲸鱼分析工具。

### Screen Action:
- **2:15** - 点击 sidebar 的 Whales 图标
- **2:20** - 停留在 leaderboard 表格，指向 PnL 列（展示绿色/红色数字）
- **2:28** - 点击排名第一的鲸鱼，展开 detail（等 1-2 秒 loading）
- **2:32** - 展开后，指向 Account Equity、Margin Used、Available Balance、Open Positions 四个卡片
- **2:37** - 指向 positions 表格，展示 Symbol、Side (LONG/SHORT badge)、Size、Entry Price、Mark Price、Unrealized PnL
- **2:45** - 收起这一行，滚动到下方 Aggregate Whale Sentiment
- **2:50** - 指向 sentiment bars，展示每个 symbol 的 long/short 比例

---

## Section 7: Live Demo - Orderbook (3:00 - 3:30)

### Screen: Click Orderbook in sidebar

### Narration:

> Orderbook Depth 页面提供 Level-2 订单簿深度分析。
>
> 数据来自 Pacifica 的 book API，每 2 秒自动刷新。上方是六个关键指标：Spread、Total Bid Depth、Total Ask Depth、最大的 Bid Wall 和 Ask Wall 位置、以及 mid price。
>
> 中间是 Bid/Ask Imbalance 指标条 -- 直观展示买卖双方力量对比。
>
> 下面是 Depth Chart 深度图 -- 左边绿色是 bid side，右边红色是 ask side，中间是 mid price。
>
> 再下面是完整的 orderbook table，大单会被高亮标注为 wall，帮助交易员识别关键支撑和阻力位。你可以用 dropdown 切换任意市场。

### Screen Action:
- **3:00** - 点击 sidebar 的 Orderbook 图标
- **3:03** - 指向顶部 6 个 metric cards
- **3:08** - 指向 Imbalance bar，观察百分比
- **3:12** - 指向 Depth Chart，解释左右两边
- **3:18** - 滚动到 orderbook table，指向 wall 高亮行（发光效果）
- **3:23** - 用 dropdown 切换到 ETH，等数据加载
- **3:27** - 指向右上角 "2s refresh" indicator

---

## Section 8: Live Demo - Trade Flow (3:30 - 4:00)

### Screen: Click Trade Flow in sidebar

### Narration:

> Trade Flow 页面分析实时成交数据。数据来自 Pacifica 的 trades API。
>
> 上方是五个 flow summary cards：Buy Pressure、Sell Pressure、Net Flow（净买/卖）、Open/Close ratio（开仓 vs 平仓比例，判断 OI 是在扩张还是收缩）、以及 Liquidation 清算检测。
>
> Taker Pressure bar 直观展示买卖力量对比。
>
> 如果有超过 5 万美元的大单，会被标记为 Large Trade Alert，顶部会出现醒目的告警卡片。清算交易也会被特殊标记。
>
> 左边是完整的 trade flow timeline，每一笔成交都标注了方向（LONG/SHORT）、动作（OPEN/CLOSE）、价格和金额。右边是 Opening Flow、Closing Flow 和 Net OI Change 的聚合统计。

### Screen Action:
- **3:30** - 点击 sidebar 的 Trade Flow 图标
- **3:33** - 指向 5 个 summary cards，特别指出 Net Flow 的颜色（绿/红）
- **3:38** - 指向 Taker Pressure bar
- **3:42** - 如果有 Large Trade Alerts，指向它们；如果没有，说 "当前没有大单告警"
- **3:46** - 指向 trade flow timeline，展示 LONG/SHORT 和 OPEN/CLOSE badges
- **3:50** - 指向右边的 Opening Flow、Closing Flow、Net OI Change 面板
- **3:55** - 指向 "LIVE" 按钮和自动刷新状态

---

## Section 9: Live Demo - Portfolio (4:00 - 4:25)

### Screen: Click Portfolio in sidebar

### Narration:

> Portfolio Analyzer 可以分析任何 Pacifica 账户。
>
> 你可以手动输入一个 Solana 地址，或者直接从 Whale Selector 里选择一个排名靠前的鲸鱼地址。这里还集成了 Privy 钱包连接 -- 如果你连接了自己的钱包，可以直接分析自己的 portfolio。
>
> 让我从 Whale Selector 里点击一个鲸鱼地址。这会同时调用 4 个 Pacifica API：account（账户总览）、positions（当前仓位）、positions/history（交易历史）、funding/history（funding 收付记录）。
>
> 你可以看到完整的 Account Overview、Current Positions with real-time unrealized PnL、Trade History with win rate 统计、以及 Funding History。
>
> 注意底部还有 Trade Pattern Analysis -- 它基于交易历史自动分析交易行为模式，包括持仓时长分布、偏好的交易时段、常交易的 symbol 集中度等。帮助理解一个交易员的风格。

### Screen Action:
- **4:00** - 点击 sidebar 的 Portfolio 图标
- **4:03** - 点击 Whale Selector，选择一个鲸鱼地址
- **4:06** - 等待 loading（1-2 秒），数据出现
- **4:08** - 快速指向 Account Overview 卡片（Equity, Available Balance, Margin Used, etc.）
- **4:12** - 滚动到 Current Positions table，指向 unrealized PnL column
- **4:15** - 快速滚动到 Trade History，指向 Win Rate stat card
- **4:18** - 快速展示 Funding History section
- **4:20** - 滚动到 Trade Pattern Analysis，指向持仓时长分布和交易时段偏好

---

## Section 10: Live Demo - AI Insights (4:20 - 4:30)

### Screen: Click AI Insights in sidebar

### Narration:

> 最后是 AI Insights 页面。它自动分析来自多个 Pacifica API 的数据，生成 12 种类型的市场洞察信号 -- 包括 funding rate anomaly、funding flip、volume surge、OI concentration、orderbook imbalance、BTC-alt divergence、whale activity 等等。
>
> 每条 insight 都标注了方向（bullish、bearish、neutral、alert）、相关 symbol、置信度、和关联的信号标签。完全自动化，每 30 秒刷新一次。

### Screen Action:
- **4:20** - 点击 sidebar 的 AI Insights 图标
- **4:23** - 等待 insights 加载
- **4:25** - 滚动展示几条 insight cards，指向 bullish/bearish/alert badges
- **4:28** - 指向 confidence tags 和 signal labels

---

## Section 10B: Live Demo - Liquidation Monitor (4:30 - 4:45)

### Screen: Click Liquidation Monitor in sidebar

### Narration:

> 这是 Liquidation Monitor，清算监控页面。它实时追踪 Pacifica 全平台的清算事件。
>
> 上方是 24 小时清算统计 -- 总清算金额、long 和 short 各占多少、以及最大的单笔清算。下面是清算事件 timeline，每一笔都标注了 symbol、方向、金额和时间。如果出现密集清算，说明市场正在经历高波动或连环清算，这对判断市场状态非常关键。

### Screen Action:
- **4:30** - 点击 sidebar 的 Liquidation Monitor 图标
- **4:33** - 指向 24 小时清算统计卡片（总金额、long/short 分布）
- **4:38** - 滚动展示清算事件 timeline
- **4:42** - 指向最大单笔清算事件

---

## Section 10C: Live Demo - Cross-Market Correlation (4:45 - 5:05)

### Screen: Click Cross-Market Correlation in sidebar

### Narration:

> Cross-Market Correlation 是 Pacifica Analytics 的独特功能。Pacifica 不仅有 crypto，还有美股、大宗商品、外汇、指数 -- 这意味着我们可以分析跨资产类别的相关性。
>
> 这个页面展示了各市场之间的实时相关性矩阵。你可以看到 BTC 和美股（比如 NVDA、TSLA）之间的相关性，BTC 和黄金 XAU 的相关性，以及各 crypto 之间的相关性。颜色深浅代表相关性强弱。
>
> 这对于分散风险和发现跨市场套利机会非常有价值，也是只有 Pacifica 这种多资产 perp DEX 才能提供的独特视角。

### Screen Action:
- **4:45** - 点击 sidebar 的 Cross-Market Correlation 图标
- **4:48** - 指向相关性矩阵，展示颜色编码（正相关/负相关）
- **4:55** - 鼠标悬停在 BTC 和某个美股之间的格子上，展示 tooltip
- **5:00** - 指向 crypto vs commodities 的相关性区域

---

## Section 11: Pacifica Integration (5:05 - 5:35)

### Screen: Stay on any page, or scroll to show "Powered by Pacifica API" footer

### Narration:

> 让我明确说明一下 Pacifica API 的集成深度。
>
> REST API 方面，我们使用了：
> - `/api/v1/info` -- 获取市场元数据和 funding rate
> - `/api/v1/leaderboard` -- 获取 top trader 排名
> - `/api/v1/book` -- 获取 Level-2 orderbook 数据
> - `/api/v1/trades` -- 获取成交数据
> - `/api/v1/positions` -- 查询账户持仓
> - `/api/v1/account` -- 查询账户信息
> - `/api/v1/funding/history` -- 查询 funding 收付历史
> - `/api/v1/positions/history` -- 查询交易历史
>
> WebSocket 方面，我们使用了 `prices` channel 实时获取所有市场的价格、funding rate、open interest 和交易量。
>
> 可以说，Pacifica API 是这个产品的核心基础设施，不是可选的 -- 没有 Pacifica API，这个产品完全无法运行。每一个页面、每一条数据，都深度依赖 Pacifica。
>
> 此外，我们还集成了 Privy 作为钱包连接方案，这是 Pacifica Hackathon 的赞助商工具之一。

### Screen Action:
- **5:05** - 可以打开浏览器 Network tab 快速展示 API calls（optional，如果怕太技术可以跳过）
- **5:15** - 或者就在界面上指向各页面的 "Pacifica REST + WS" badge、"Data sourced from Pacifica API" 等标注
- **5:25** - 切回 Overview 页面，指向底部 "Powered by Pacifica API" 字样
- **5:30** - 点击 sidebar 底部的 Pacifica 外链图标

---

## Section 12: Value & Impact (5:35 - 6:05)

### Screen: Overview page, data flowing

### Narration:

> 交易员可以用 Pacifica Analytics 做什么？
>
> 第一，发现 funding rate 套利机会。Funding 页面直接告诉你哪些市场的 funding rate 异常，年化收益可以高达百分之几十甚至更高。
>
> 第二，追踪鲸鱼动向。Whale Tracker 让你实时看到 top 20 鲸鱼在做什么，他们的 aggregate sentiment 是偏多还是偏空。
>
> 第三，分析 orderbook 深度。在大波动之前，orderbook 的 imbalance 和 wall detection 可以提供早期预警。
>
> 第四，监控资金流向。Trade Flow 告诉你当前是 buyer dominant 还是 seller dominant，OI 在扩张还是收缩，有没有发生 liquidation。
>
> 为什么比现有工具更好？因为 Pacifica Analytics 是 Pacifica 原生的。数据直接来自 Pacifica API，最准确、最实时、零延迟。而其他第三方工具要么不覆盖 Pacifica 这样的多资产 perp DEX，要么数据有延迟。
>
> 目标用户就是 Pacifica 上的活跃交易员 -- 无论是手动交易还是做策略的。

### Screen Action:
- **5:35** - 保持在 Overview 页面
- **5:45** - 可以快速切到 Funding 页面，指向 opportunity card
- **5:50** - 切到 Whales 页面，指向 sentiment bar
- **5:55** - 切回 Overview

---

## Section 13: What's Next (6:05 - 6:20)

### Screen: Overview page

### Narration:

> 如果给我更多时间，我会继续完善以下功能：
>
> 第一，历史数据图表 -- 目前我们展示的是实时数据，未来会加入 historical charts，比如 funding rate 历史走势、OI 变化趋势。
>
> 第二，跨交易所 funding rate 对比 -- 对比 Pacifica 和 Binance、Bybit 等中心化交易所的 funding rate，发现跨所套利机会。
>
> 第三，liquidation cascade 预测 -- 根据当前的持仓分布和 leverage 分布，预测可能的连环清算区间。
>
> 第四，移动端适配 -- 让交易员可以随时随地监控市场。
>
> 感谢大家的时间。这就是 Pacifica Analytics -- 一个为 Pacifica 交易员打造的实时分析平台。谢谢！

### Screen Action:
- **6:05** - 保持在 Overview 页面，数据继续实时更新
- **6:15** - 鼠标放到 "PL" logo 上
- **6:20** - 结束录制

---

## Recording Tips

### Voice
- Speak at a natural, confident pace -- not too fast, not robotic
- Pause briefly (0.5s) between sections for breathing room
- Emphasize key phrases: "实时", "Pacifica API", "鲸鱼追踪", "套利机会"
- If you fumble a word, keep going -- minor imperfections sound more natural than a perfectly polished read

### Screen
- Move the mouse deliberately and slowly -- avoid quick jittery movements
- Hover on important elements for 2-3 seconds so judges can read them
- When clicking, pause briefly after the click to let the page load/transition
- Keep scrolling smooth and controlled

### Timing
- The most important section is the live demo (Sections 3-10C). If you need to cut time, shorten Section 12 (Value) and Section 13 (What's Next)
- If a page takes time to load, fill with a brief comment: "数据正在加载中，这都是实时从 Pacifica API 获取的真实数据"
- Target total: 6:20. Acceptable range: 5:30 - 7:00. Absolute maximum: 10:00

### Common Pitfalls to Avoid
- Do NOT spend time showing code or architecture diagrams -- judges want to see it working
- Do NOT apologize for anything -- be confident
- Do NOT read your narration word-for-word in a flat monotone -- use the script as a guide, speak naturally
- Do NOT switch away from the app to show slides -- everything should be a live product walkthrough

---

## API Endpoint Reference (for your confidence during recording)

| API | Endpoint | Used In |
|-----|----------|---------|
| Market Info | `GET /api/v1/info` | Overview, Orderbook, TradeFlow, Screener |
| Leaderboard | `GET /api/v1/leaderboard` | Whales, AI Insights |
| Orderbook | `GET /api/v1/book?symbol=X` | Orderbook, AI Insights |
| Trades | `GET /api/v1/trades?symbol=X` | Trade Flow |
| Positions | `GET /api/v1/positions?account=X` | Whales, Portfolio |
| Account | `GET /api/v1/account?account=X` | Whales, Portfolio |
| Position History | `GET /api/v1/positions/history?account=X` | Portfolio |
| Funding History | `GET /api/v1/funding/history?account=X` | Portfolio |
| WebSocket Prices | `wss://ws.pacifica.fi/ws` (prices channel) | ALL pages |
| **Sponsor: Privy** | Wallet connect | Portfolio (Privy wallet integration) |

**Total: 8 REST endpoints + 1 WebSocket channel + 1 sponsor tool = deep Pacifica integration**
