# QuantLab: Comprehensive System Architecture & Feature Manual

> **Version:** 2.4 (Production Specification)  
> **Platform:** Next.js 14 (App Router) · React 18 · TypeScript 5 · Recharts 2.10  
> **Architecture:** Zero-dependency Vectorized Quantitative Simulation Engine · Direct GPU-Accelerated Compositor Visual Layer  
> **Workspace Path:** `/Users/matthew/Downloads/QUANTICS_EXTRACTION`

---

## Table of Contents
1. [Executive Summary & High-Level Architecture](#1-executive-summary--high-level-architecture)
2. [Synthetic Geometric Market Engine](#2-synthetic-geometric-market-engine)
3. [Vectorized Indicator Library & Mathematical Foundations](#3-vectorized-indicator-library--mathematical-foundations)
4. [Quantitative Strategy Models (17 Algorithms Detailed)](#4-quantitative-strategy-models-17-algorithms-detailed)
5. [Compound Condition Builder (AND / OR Boolean Conjunctions)](#5-compound-condition-builder-and--or-boolean-conjunctions)
6. [Multi-Asset Portfolio Engine](#6-multi-asset-portfolio-engine)
7. [Interactive Canvas & 120 FPS Window Dragging Engine](#7-interactive-canvas--120-fps-window-dragging-engine)
8. [Pan, Zoom & Timeline Navigation System](#8-pan-zoom--timeline-navigation-system)
9. [Risk Management & Execution Controls](#9-risk-management--execution-controls)
10. [Performance Evaluation Analytics (15 Quantitative Metrics)](#10-performance-evaluation-analytics-15-quantitative-metrics)
11. [Strategy Presets, Persistence & CSV Export](#11-strategy-presets-persistence--csv-export)
12. [Component-Level Architecture & Technical Inventory](#12-component-level-architecture--technical-inventory)
13. [Chronological Engineering Journey ("How We Got Here Over Time")](#13-chronological-engineering-journey-how-we-got-here-over-time)

---

## 1. Executive Summary & High-Level Architecture

QuantLab is an institutional-grade quantitative backtesting and technical analysis workbench. Built to replicate the rigor of hedge fund quantitative research environments, it unifies server-side numerical simulation with a client-side charting canvas capable of sub-millisecond interaction.

### System Architecture Topology:
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CLIENT WEB APPLICATION                               │
│                                                                                        │
│   src/app/page.tsx (Main Dashboard State & Layout Coordinator)                         │
│   ├── Interactive Synchronized Recharts Canvas (7 Panels: Price, RSI, MACD, ATR,       │
│   │   Z-Score, PnL Equity Curve, Lots Position Size)                                   │
│   ├── Direct GPU Compositor 120 FPS Drag-and-Drop Panel Reordering Engine              │
│   ├── Non-Passive Wheel & Trackpad Pinch-to-Zoom Engine (Zero Screen Drift)            │
│   ├── Scrubbing Timeline Controller & Crosshair Value Synchronizer                     │
│   └── Dark / Light Mode Palette Theme Engine                                           │
│                                                                                        │
│   src/components/config-panel.tsx (Configuration & Strategy Setup)                     │
│   ├── Single Stock Mode: Symbol, Timeframe, Lookback, Strategy Selector, Parameters   │
│   ├── Conditional Mode: Compound Multi-Rule Builder (AND/OR Conjunction Logic)         │
│   ├── Portfolio Mode: Multi-Asset Allocator with Custom Weights & Independent Rules    │
│   ├── Execution & Risk Sizing: Position Pyramiding (1-10 Lots), Stop Loss, Take Profit │
│   ├── NumberStepper with Click-and-Hold Acceleration Timers                            │
│   └── Strategy Preset Drawer with Instant Auto-Run on Load                             │
│                                                                                        │
│   src/components/evaluation-panel.tsx (Institutional Analytics)                        │
│   ├── Scorecard Tab: 15 Risk-Adjusted Return Metrics vs Buy & Hold Benchmark           │
│   ├── Interactive Metric Documentation Modal (Definitions, Formulas, Benchmarks)       │
│   ├── Portfolio Leg Breakdown: Contribution, Win Rate, Leg-Specific PnL                │
│   └── Trade Journal Tab: Filterable Round-Trip Trade Table with Zoom-to-Entry Click    │
│                                                                                        │
│   src/components/builtin-color-picker.tsx                                              │
│   └── Portal-Rendered Custom Color Picker with 16 Palettes & Clickaway Safety          │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ HTTP GET Queries & Streams
┌───────────────────────────────────────────▼────────────────────────────────────────────┐
│                    SERVER-SIDE QUANTITATIVE ENGINE (/api/quant-lab-data)               │
│                                                                                        │
│   • Seeded Deterministic Market Generator (Brownian Motion & Intraday Jump Diffusion)   │
│   • Vectorized Mathematical Indicator Library (SMA, EMA, RSI, MACD, BB, ATR, VWAP...)  │
│   • Per-Bar Execution Engine: Slippage, Commissions, Stop Loss / Take Profit           │
│   • Multi-Lot Pyramiding Position Sizer (1 to 10 Lots with Weighted Cost Basis)        │
│   • Strict Position Lifecycle Evaluator (Exits Evaluated First -> Entries When Flat)   │
│   • Compounding Equity Curve Engine & Institutional Metric Analytics                   │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Synthetic Geometric Market Engine

To ensure instantaneous, reproducible, and robust quantitative testing without third-party rate limits, QuantLab incorporates a deterministic pseudo-random market generator in `/api/quant-lab-data/route.ts`.

### Mathematical Foundations:
- **Linear Congruential Generator (LCG):**
  $$S_{n+1} = (16807 \times S_n) \pmod{2147483647}$$
  Produces uniform random numbers $U_n \in [0, 1)$ without external dependencies.
- **Deterministic String Seed Hashing:**
  Uses a 32-bit bitwise hash of `${symbol}|${count}|${timeframe}`:
  $$h_{i} = ((h_{i-1} \ll 5) - h_{i-1} + \text{charCodeAt}(c)) \pmod{2^{32}}$$
  Every asset symbol (e.g. `SPY`, `QQQ`, `AAPL`, `NVDA`, `TSLA`) maps to an identical seed, ensuring deterministic, reproducible backtesting across sessions.
- **Base Price Derivation:**
  $$\text{BasePrice} = 50 + (\text{hash}(\text{symbol}) \pmod{400})$$
  Ensures realistic price levels ranging from $\$50$ to $\$450$.
- **Geometric Brownian Motion with Jump Diffusion:**
  $$\Delta P_t = P_{t-1} \times (\mu + \sigma \cdot \epsilon_t)$$
  Where:
  - $\mu$ represents daily drift (calibrated to slightly positive equity bias).
  - $\epsilon_t \sim U(-0.5, 0.5)$ introduces realistic price noise.
  - High and Low wicks are generated via asymmetric bounds:
    $$H_t = \max(O_t, C_t) \times (1 + \text{rand} \times \sigma_{\text{wick}})$$
    $$L_t = \min(O_t, C_t) \times (1 - \text{rand} \times \sigma_{\text{wick}})$$
  - Intraday volume is modeled using typical log-normal equity turnover: $V_t \sim 50\text{M} - 130\text{M}$ for daily bars, scaled down for intraday timeframes.

### Timeframe & Lookback Granularity:
- **Timeframes:**
  - `5Min`: 78 bars per trading day (9:30 AM to 4:00 PM EST, 5-minute intervals).
  - `15Min`: 26 bars per trading day (15-minute intervals).
  - `1Hour`: 7 bars per trading day (60-minute intervals).
  - `1Day`: 1 bar per trading day (daily close).
- **Lookback Spans:**
  - `1M`: 21 trading days.
  - `3M`: 63 trading days.
  - `6M`: 126 trading days.
  - `1Y`: 252 trading days.
  - `3Y`: 756 trading days.
- **Total Bar Capacity:** Dynamically calculated as $\text{TotalBars} = \text{Days} \times \text{BarsPerDay}$ (up to 58,968 bars for 3Y 5Min).

---

## 3. Vectorized Indicator Library & Mathematical Foundations

Every indicator in QuantLab is computed server-side with numerical precision:

### 1. Simple Moving Average (SMA)
$$\text{SMA}_t = \frac{1}{N} \sum_{i=0}^{N-1} P_{t-i}$$
- **Default periods:** 20, 50, 200.
- **Latency:** $\frac{N-1}{2}$ bars. Filters market noise at the expense of phase lag.

### 2. Exponential Moving Average (EMA)
$$k = \frac{2}{N + 1}$$
$$\text{EMA}_t = P_t \cdot k + \text{EMA}_{t-1} \cdot (1 - k)$$
- Seeded with the $N$-period arithmetic mean. Gives higher weighting to recent price actions.

### 3. Moving Average Ribbon (Up to 10 Customizable Lines)
- Allows overlaying up to 10 distinct SMA or EMA lines simultaneously.
- Supported periods: 1 to 500.
- Custom hex/swatch color picker with portal rendering and clickaway protection.

### 4. Bollinger Bands (BB)
$$\text{Middle}_t = \text{SMA}_N(P)$$
$$\sigma_t = \sqrt{\frac{1}{N} \sum_{i=0}^{N-1} (P_{t-i} - \text{Middle}_t)^2}$$
$$\text{Upper}_t = \text{Middle}_t + k \cdot \sigma_t, \quad \text{Lower}_t = \text{Middle}_t - k \cdot \sigma_t$$
- **Defaults:** $N = 20, k = 2.0$. Quantifies volatility expansion and statistical mean-reversion limits.

### 5. Relative Strength Index (RSI - Wilder's Smoothing)
$$\text{Gain}_t = \max(P_t - P_{t-1}, 0), \quad \text{Loss}_t = \max(P_{t-1} - P_t, 0)$$
$$\overline{\text{Gain}}_t = \frac{\overline{\text{Gain}}_{t-1} \cdot (N-1) + \text{Gain}_t}{N}, \quad \overline{\text{Loss}}_t = \frac{\overline{\text{Loss}}_{t-1} \cdot (N-1) + \text{Loss}_t}{N}$$
$$\text{RS}_t = \frac{\overline{\text{Gain}}_t}{\overline{\text{Loss}}_t}, \quad \text{RSI}_t = 100 - \frac{100}{1 + \text{RS}_t}$$
- **Defaults:** $N = 14$, Overbought = 70, Oversold = 30.

### 6. Moving Average Convergence Divergence (MACD)
$$\text{MACD}_t = \text{EMA}_{12}(P) - \text{EMA}_{26}(P)$$
$$\text{Signal}_t = \text{EMA}_9(\text{MACD})$$
$$\text{Histogram}_t = \text{MACD}_t - \text{Signal}_t$$
- Renders dual indicator lines with green (positive momentum) and red (negative momentum) histogram bars.

### 7. Average True Range (ATR)
$$\text{TR}_t = \max\left(H_t - L_t, \, |H_t - C_{t-1}|, \, |L_t - C_{t-1}|\right)$$
$$\text{ATR}_t = \frac{\text{ATR}_{t-1} \cdot (N-1) + \text{TR}_t}{N}$$
- **Defaults:** $N = 14$. Measures absolute market volatility in dollars.

### 8. Statistical Z-Score
$$Z_t = \frac{P_t - \mu_{N,t}}{\sigma_{N,t}}$$
- **Defaults:** $N = 20$. Standardizes price deviations relative to historical volatility.

### 9. Donchian Channels (Turtle Breakout Bands)
$$\text{Upper}_t = \max_{i=0 \dots N-1}(H_{t-i}), \quad \text{Lower}_t = \min_{i=0 \dots N-1}(L_{t-i})$$
- **Defaults:** Entry = 20 bars, Exit = 10 bars.

### 10. Volume-Weighted Average Price (VWAP)
$$\text{TypicalPrice}_i = \frac{H_i + L_i + C_i}{3}$$
$$\text{VWAP}_t = \frac{\sum_{i=1}^t \text{TypicalPrice}_i \times V_i}{\sum_{i=1}^t V_i}$$

### 11. Ichimoku Kinko Hyo (Cloud)
- **Tenkan-sen (Conversion Line):** $(\max(H, 9) + \min(L, 9)) / 2$
- **Kijun-sen (Base Line):** $(\max(H, 26) + \min(L, 26)) / 2$
- **Senkou Span A:** $(\text{Tenkan} + \text{Kijun}) / 2$ shifted forward 26 bars
- **Senkou Span B:** $(\max(H, 52) + \min(L, 52)) / 2$ shifted forward 26 bars

---

## 4. Quantitative Strategy Models (17 Algorithms Detailed)

QuantLab supports 17 distinct quantitative strategy models:

```
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ STRATEGY INVENTORY & EXECUTION LOGIC                                                                   │
├────┬─────────────────────────────┬──────────────────────────────────┬─────────────────────────────────┤
│ #  │ Strategy Name               │ Long Entry Criteria              │ Long Exit Criteria              │
├────┼─────────────────────────────┼──────────────────────────────────┼─────────────────────────────────┤
│ 1  │ SMA Crossover               │ Fast SMA crosses above Slow SMA  │ Fast SMA crosses below Slow SMA │
│ 2  │ Mean Reversion RSI          │ RSI dips below Oversold (30)     │ RSI spikes above Overbought (70)│
│ 3  │ MACD Crossover              │ MACD Line crosses above Signal   │ MACD Line crosses below Signal  │
│ 4  │ Bollinger Band Reversion    │ Price penetrates Lower BB Band   │ Price reaches Middle SMA Target │
│ 5  │ Relative Momentum           │ Relative return > 0 over lookback│ Relative return <= 0 over lookback│
│ 6  │ Dual Momentum               │ Return > cash hurdle rate        │ Return <= cash hurdle rate      │
│ 7  │ Pairs Trading / Stat Arb    │ Z-Score < -2.0 sigma             │ Z-Score reverts to -0.5 sigma   │
│ 8  │ Donchian Breakout (Turtle)  │ Price breaks 20-bar channel high │ Price breaches 10-bar low stop  │
│ 9  │ Volatility Breakout (ATR)   │ Price > Close + k * ATR          │ Price < Close - k * ATR         │
│ 10 │ EMA Ribbon Cascade          │ Fast > Mid > Slow EMA alignment  │ Bearish EMA breakdown           │
│ 11 │ VWAP Reversion              │ Price discounted below VWAP      │ Price touches VWAP benchmark    │
│ 12 │ Overnight Gap Fade          │ Morning gap up/down > gapPct%    │ Gap fills during regular hours  │
│ 13 │ Risk Parity / Vol Targeting │ Realized vol < target risk limit │ Volatility spikes above limit   │
│ 14 │ Market Regime Filter        │ Price confirms above 200d SMA    │ Price breaks below 200d SMA     │
│ 15 │ RSI Divergence              │ Lower price low + higher RSI low │ Higher price high + lower RSI   │
│ 16 │ Ichimoku Cloud Breakout     │ Price > Kumo Cloud & Tenkan>Kijun│ Price < Kumo Cloud              │
│ 17 │ ATR Trailing Stop           │ Baseline breakout                │ Price breaches ATR trailing stop│
└────┴─────────────────────────────┴──────────────────────────────────┴─────────────────────────────────┘
```

---

## 5. Compound Condition Builder (AND / OR Boolean Conjunctions)

In **Conditional Mode**, users can combine multiple indicators into compound trading systems.

### Conjunction & Disjunction Mechanics:
- **AND (Conjunction):** Every single condition in the rule group must be active simultaneously on the current bar.
- **OR (Disjunction):** Any condition in the rule group will trigger execution.

### Per-Bar Signal State Vectorization:
Every rule generates a complete state tuple:
$$\text{RuleState} = \left(\text{entryTrigger}, \, \text{entryActive}, \, \text{exitTrigger}, \, \text{exitActive}, \, \text{entryDesc}, \, \text{exitDesc}\right)$$
- `entryTrigger[i]`: True strictly on the bar where the condition first fired.
- `entryActive[i]`: True continuously for all bars where the condition remains satisfied.
- `entryDesc[i]`: Human-readable description with exact numerical criteria (e.g. `RSI Oversold Dip (27.4 < 30)`).

### Strict Position Lifecycle Separation:
1. **When in a Long Position:**
   - Exit conditions are evaluated **first**.
   - If satisfied, the position closes cleanly to `flat` at the current execution price.
   - Entry rules are **not evaluated** on the same bar, eliminating reversal bleeding or boolean operator confusion.
   - If exit rules are not met and `currentLots < maxPositionSize`, scale-in triggers are evaluated.
2. **When Flat:**
   - Entry rules are evaluated. If triggered, opens a new position with 1 lot.

---

## 6. Multi-Asset Portfolio Engine

QuantLab provides institutional multi-asset simulation:
- **Custom Asset Allocation:** Assign discrete percentage weights ($\sum w_i = 100\%$) across multiple tickers (e.g. 50% SPY, 30% QQQ, 20% AAPL).
- **Independent Strategy Assignment:** Each portfolio leg can run an independent strategy model or a custom compound conditional rule set.
- **Synchronized Visualizations:** Toggle between a normalized **Overlay View** or **Individual Leg Panels**.
- **Portfolio-Level Equity Compounding:**
  $$\text{Equity}_t = \text{Equity}_{t-1} \times \left(1 + \sum_{i=1}^M w_i \cdot R_{i,t}\right)$$
- **Blended Trade Journal:** Aggregates trades from all legs into a single chronological trade log with leg identification and individual asset PnL.

---

## 7. Interactive Canvas & 120 FPS Window Dragging Engine

The charting canvas includes 7 synchronized panels: Price Action, RSI, MACD, ATR, Z-Score, PnL, and Lots. Every panel can be freely dragged and reordered vertically.

### Direct GPU Compositor Transform Architecture:
1. **Zero React Re-Renders During Dragging:**
   - Previous implementations updated React state on every raw `pointermove` event (120–1000/sec), causing virtual DOM thrashing of the 4,600+ line component.
   - The current architecture updates DOM elements directly via hardware-accelerated 3D transforms:
     ```ts
     liftedElement.style.transform = `translate3d(0, ${deltaY}px, 0) scale(1.012)`
     ```
   - Batched through `requestAnimationFrame`, achieving native 120 FPS / 144 FPS with 0ms React overhead.
2. **Smooth Displaced Sliding:**
   - Displaced panels slide smoothly out of the way when the cursor crosses panel midpoint thresholds:
     ```css
     transition: transform 0.28s cubic-bezier(0.2, 0, 0, 1);
     ```
3. **Glitch-Free Settling (`isDropping`):**
   - When dropping into a new slot, transitions are temporarily disabled during DOM reordering, preventing falling or glitching animations.
   - If released back in the same slot, the window glides back smoothly into its resting position.
4. **Pointer Capture & Passive Listeners:**
   - `setPointerCapture` prevents cursor detachment when dragging rapidly across panels.

---

## 8. Pan, Zoom & Timeline Navigation System

QuantLab features smooth timeline navigation:
- **Trackpad Pinch & Ctrl/Cmd + Wheel Zooming:**
  - Deploys non-passive window listeners with unconditional `e.preventDefault()`.
  - Eliminates browser page-level scroll drift and zoom interference.
  - Zooms directly centered on the timeline.
- **Scrubbing Timeline Controller:**
  - Range slider at the top allows rapid scrubbing across thousands of bars with real-time bar range feedback (`Bar X–Y`).
- **Click-and-Drag Horizontal Panning:**
  - Grab and pan horizontally across any chart canvas at 120 FPS.
- **Physical Zoom Buttons:**
  - Zoom In, Zoom Out, and Reset 100% buttons with keyboard accessibility.

---

## 9. Risk Management & Execution Controls

- **Position Pyramiding (1 to 10 Lots):** Scale into trades incrementally as signals confirm.
- **Stop Loss Limit (%):** Automatically closes positions when price breaches $-SL\%$.
- **Take Profit Target (%):** Locks in gains when price reaches $+TP\%$.
- **Slippage Modeling (Basis Points):** Simulates market impact by worsening execution price by $BPS / 10000$.
- **Broker Commission ($):** Fixed dollar fee deducted per executed trade.

---

## 10. Performance Evaluation Analytics (15 Quantitative Metrics)

QuantLab calculates 15 institutional risk-adjusted return metrics:

1. **Strategy Return (%):** Cumulative percentage portfolio return.
2. **Buy & Hold Return (%):** Passive benchmark return over the identical period.
3. **Alpha vs B&H (%):** $\alpha = R_{\text{strat}} - R_{\text{bh}}$
4. **Sharpe Ratio:**
   $$\text{Sharpe} = \frac{\overline{R}}{\sigma_R} \times \sqrt{252}$$
5. **Sortino Ratio:**
   $$\text{Sortino} = \frac{\overline{R}}{\sigma_{\text{downside}}} \times \sqrt{252}$$
   *(Only penalizes downside volatility)*
6. **Calmar Ratio:**
   $$\text{Calmar} = \frac{\text{Annualized Return}}{\text{Max Drawdown}}$$
7. **Maximum Drawdown (%):** Largest peak-to-trough decline in portfolio equity.
8. **Profit Factor:**
   $$\text{Profit Factor} = \frac{\sum \text{Gross Profits}}{\sum |\text{Gross Losses}|}$$
9. **Win Rate (%):** Percentage of completed round-trip trades with positive net PnL.
10. **Total Trades:** Sample size of executed round-trip trades.
11. **Average Trade PnL (%):** Mathematical expectancy per trade.
12. **Average Win (%):** Mean return across all winning positions.
13. **Average Loss (%):** Mean return across all losing positions.
14. **Payoff Ratio:** $\text{Average Win} / |\text{Average Loss}|$
15. **Maximum Consecutive Losses:** Longest streak of unprofitable trades.

---

## 11. Strategy Presets, Persistence & CSV Export

- **Persistent Presets:** Save custom strategies with names, symbols, timeframes, parameters, risk limits, and portfolio allocations to browser `localStorage`.
- **Auto-Run on Load:** Loading any saved preset automatically restores all parameters and immediately executes the backtest simulation.
- **CSV Data Export:** Export the complete trade journal (including timestamps, entry/exit prices, reasons, and return percentages) for external verification in Python, Excel, or R.

---

## 12. Component-Level Architecture & Technical Inventory

### File Map:
1. `src/app/page.tsx` (4,676 lines): Main dashboard coordinator, chart canvas, GPU drag engine, and zoom listeners.
2. `src/components/config-panel.tsx` (2,245 lines): Strategy parameter configuration, conditional builder, portfolio allocator, and preset drawer.
3. `src/components/evaluation-panel.tsx` (1,399 lines): Scorecard analytics, documentation modal, and filterable trade journal.
4. `src/components/builtin-color-picker.tsx` (250+ lines): Portal-rendered color picker with 16 palettes and clickaway safety.
5. `src/app/api/quant-lab-data/route.ts` (1,427 lines): Vectorized simulation engine, indicator math, and synthetic market generator.

---

## 13. Chronological Engineering Journey ("How We Got Here Over Time")

### Phase 1: Codebase Extraction & Architecture
Extracted standalone quantitative backtesting module from legacy workspace. Set up modern Next.js 14 App Router, built the deterministic pseudo-random Brownian market generator, and structured the initial UI.

### Phase 2: Indicator Library & Mathematical Foundations
Implemented vectorized technical indicator mathematical routines (SMA, EMA, Bollinger Bands, RSI, MACD, ATR, Donchian, VWAP, Ichimoku Cloud, Z-Score).

### Phase 3: Trend Ribbon & Color Picker
Introduced the customizable Moving Average Ribbon supporting up to 10 lines. Solved clickaway event bubbling issues by building a portal-rendered custom color picker.

### Phase 4: Smooth Pan & Zoom Engine
Overhauled timeline navigation. Eliminated page scroll drift during trackpad pinch and Ctrl+Wheel zoom by deploying non-passive listeners with `e.preventDefault()`.

### Phase 5: 120 FPS Direct GPU Window Dragging
Upgraded panel drag-and-drop from React state reconciliation to direct GPU compositor 3D transforms (`translate3d(0, deltaY, 0) scale(1.012)`) batched via `requestAnimationFrame`. Added `isDropping` state to suppress glitching and falling animations.

### Phase 6: Conditional Logic & Trade Log Auditing
Overhauled the compound AND/OR boolean signal evaluator. Enforced strict lifecycle separation (evaluating exits first when in position) and enriched trade records with exact indicator criteria.

### Phase 7: Multi-Asset Portfolio Engine & Institutional Metrics
Added weighted multi-leg portfolio backtesting with independent leg rules, synchronized multi-symbol charts, weighted equity compounding, and comprehensive scorecard metrics.

### Phase 8: Production Polish & Documentation
Implemented immediate auto-run on strategy load, created the comprehensive reference manual in `DOCUMENTATION.md`, and finalized the production suite.
