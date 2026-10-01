# Quantics Module

Standalone backtest & strategy visualization module.

## Setup

```
npm install
npm run dev
```

Runs on http://localhost:4000

## Structure

```
src/
  app/
    page.tsx                    ← Main quantics page
    api/quantics-data/route.ts  ← Data + backtest engine
  components/
    config-panel.tsx            ← Strategy selector + parameter sliders
```

## API

`GET /api/quantics-data`

| Param | Values |
|-------|--------|
| symbol | Any ticker |
| timeframe | 5Min, 15Min, 1Hour, 1Day |
| lookback | 1M, 3M, 6M, 1Y, 3Y |
| action | bars, indicators, backtest |
| strategy | sma_crossover, mean_reversion_rsi, macd_crossover, bollinger_revert, etc. |
| params | JSON-encoded parameter object |

## Strategies

20 strategies defined in config-panel.tsx. Backtest engine in the API route currently implements 4 — the rest need implementation matching the same pattern.

## Return Format (backtest)

```json
{
  "success": true,
  "totalReturn": 4.52,
  "buyHoldReturn": 8.31,
  "alpha": -3.79,
  "sharpe": 0.42,
  "winRate": 55.0,
  "maxDrawdown": -6.21,
  "trades": 12,
  "avgTrade": 0.377
}
```
