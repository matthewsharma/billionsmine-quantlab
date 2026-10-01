# Quantics - Quick Start Guide

## 5-Minute Setup

This package runs **fully locally** with built-in synthetic market data. No API keys, no credentials, no external accounts required.

### 1. Copy Files
Copy the `src` folder contents into your Next.js project:

```
your-project/
├── src/
│   ├── app/
│   │   ├── quantics/
│   │   │   └── page.tsx          ← Copy this
│   │   └── api/
│   │       └── quantics-data/
│   │           └── route.ts      ← Copy this
│   └── components/
│       └── quantics/
│           └── config-panel.tsx  ← Copy this
```

### 2. Install Dependencies
```bash
npm install recharts lucide-react
```

### 3. Create Stub Components
Create these two files to satisfy imports in `page.tsx`:

**File:** `src/components/dashboard/dashboard-header.tsx`
```tsx
export function DashboardHeader() {
  return (
    <header style={{ 
      backgroundColor: '#0a0a0f', 
      padding: '16px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>Quantics</h1>
    </header>
  )
}
```

**File:** `src/components/mobile-bottom-nav.tsx`
```tsx
export function MobileBottomNav() {
  return null // or build your own mobile nav
}
```

### 4. Create Stock Search API (Simple Mock)
This powers the instrument autocomplete. Fully local, no external calls.

**File:** `src/app/api/stock-search/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server'

const STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft' },
  { symbol: 'GOOGL', name: 'Alphabet' },
  { symbol: 'TSLA', name: 'Tesla' },
  { symbol: 'SPY', name: 'S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Nasdaq ETF' },
]

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.toUpperCase() || ''
  const results = STOCKS.filter(s => 
    s.symbol.includes(q) || s.name.toUpperCase().includes(q)
  )
  return NextResponse.json({ success: true, results })
}
```

### 5. Run Dev Server
```bash
npm run dev
```

### 6. Test It
Navigate to: `http://localhost:3000/quantics`

**Quick Test Checklist:**
- ✅ Type "SPY" in instrument field and click Set
- ✅ Click "Run Backtest" button
- ✅ Results appear instantly (synthetic data)
- ✅ Verify chart appears with price line
- ✅ Verify metrics show (Strategy Return, Alpha, etc.)
- ✅ Try different strategy from left panel
- ✅ Adjust parameter slider
- ✅ Click "Run Backtest" again

## About the Data

The `quantics-data` API generates **synthetic OHLCV market data** using a seeded random-walk model. This means:
- No API keys or credentials needed
- Same symbol always produces the same series (deterministic)
- All indicators, charts, and backtests work exactly like production
- You can develop and test the entire page offline

**To connect real market data later:** Open `src/app/api/quantics-data/route.ts` and replace the `generateBars(...)` call inside the `GET` handler with a fetch to your chosen data provider. Keep the same bar shape: `{ t, o, h, l, c, v }`.

## Troubleshooting

### Error: "Module not found"
**Cause:** Missing stub components  
**Fix:** Create `dashboard-header.tsx` and `mobile-bottom-nav.tsx` as shown above

### Chart not showing
**Cause:** recharts not installed  
**Fix:** Run `npm install recharts`

### Icons not showing
**Cause:** lucide-react not installed  
**Fix:** Run `npm install lucide-react`

### Suggestions not appearing
**Cause:** Stock search API not created  
**Fix:** Create `src/app/api/stock-search/route.ts` as shown above

## What's Working

After setup, you should have:
- ✅ Full Quantics page UI
- ✅ 20 strategy selection cards
- ✅ Interactive parameter sliders
- ✅ Instrument search with autocomplete
- ✅ Timeframe selector (5Min, 15Min, 1Hour, 1Day)
- ✅ Lookback selector (1M, 3M, 6M, 1Y, 3Y)
- ✅ Run Backtest functionality (synthetic data)
- ✅ Results display with 8 metrics
- ✅ Price chart with SMA overlays
- ✅ Live indicators panel
- ✅ CSV data export
- ✅ Collapsible config panel

## What's NOT Included

You'll add these separately when integrating into the full app:
- Full DashboardHeader (navigation, user account)
- Full MobileBottomNav (mobile navigation)
- Full stock-search API (currently mocked)
- Real market data provider (currently synthetic)
- User authentication (if needed)

## Next Steps

1. **Test All Strategies:**
   - Try each of the 20 strategies
   - Note: 4 are fully implemented (SMA Crossover, RSI Reversal, Bollinger Bands, MACD Crossover)
   - Others need backend logic added in `runBacktest`

2. **Customize UI:**
   - Adjust colors in config-panel.tsx
   - Modify chart styling
   - Add your branding

3. **Implement Missing Strategies:**
   - Open `src/app/api/quantics-data/route.ts`
   - Find the `runBacktest` function
   - Add cases for other strategy IDs

## File Structure Overview

```
QUANTICS_EXTRACTION/
├── README.md              # Full documentation
├── DEPENDENCIES.md        # Dependency details
├── QUICKSTART.md         # This file
├── PACKAGE_SUMMARY.md    # Architecture overview
├── FILE_MANIFEST.md      # File listing
└── src/
    ├── app/
    │   ├── quantics/
    │   │   └── page.tsx           # Main page (React client component)
    │   └── api/
    │       └── quantics-data/
    │           └── route.ts       # Backend API (synthetic data + backtest)
    └── components/
        └── quantics/
            └── config-panel.tsx   # Config UI (strategy + params)
```

## Testing Different Strategies

Try these combinations:

**Conservative:**
- Strategy: SMA Crossover, Params: fast=50, slow=200
- Symbol: SPY, Timeframe: 1Day, Lookback: 1Y

**Aggressive:**
- Strategy: RSI Mean Reversion, Params: period=7, oversold=20, overbought=80
- Symbol: TSLA, Timeframe: 15Min, Lookback: 1M

**Momentum:**
- Strategy: MACD Crossover, Params: fast=12, slow=26, signal=9
- Symbol: QQQ, Timeframe: 1Day, Lookback: 6M

**Mean Reversion:**
- Strategy: Bollinger Bands, Params: period=20, stdDev=2
- Symbol: AAPL, Timeframe: 1Hour, Lookback: 3M

## License

Proprietary - Billionsmine Platform
