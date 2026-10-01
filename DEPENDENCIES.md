# Dependencies Guide

## NPM Packages Required

### Core Dependencies
```json
{
  "dependencies": {
    "next": "^14.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "recharts": "^2.10.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "typescript": "^5.0.0"
  }
}
```

### Installation
```bash
npm install recharts lucide-react
# or
yarn add recharts lucide-react
```

## Missing Component Dependencies

The Quantics page imports two components that are NOT included in this extraction:

### 1. DashboardHeader
**Path:** `@/components/dashboard/dashboard-header`  
**Usage:** Navigation header with links, user account dropdown  
**Props:** None (self-contained)

**Options:**
- Copy from main project
- Create a stub component:
```tsx
// src/components/dashboard/dashboard-header.tsx
export function DashboardHeader() {
  return (
    <header style={{ 
      backgroundColor: '#0a0a0f', 
      padding: '16px 24px',
      borderBottom: '1px solid rgba(255,255,255,0.1)'
    }}>
      <h1 style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>
        Quantics
      </h1>
    </header>
  )
}
```

### 2. MobileBottomNav
**Path:** `@/components/mobile-bottom-nav`  
**Usage:** Mobile navigation bar at bottom of screen  
**Props:** None (self-contained)

**Options:**
- Copy from main project
- Create a stub component:
```tsx
// src/components/mobile-bottom-nav.tsx
export function MobileBottomNav() {
  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#0a0a0f',
      padding: '12px',
      borderTop: '1px solid rgba(255,255,255,0.1)',
      display: 'none'
    }}>
      {/* Mobile nav items */}
    </nav>
  )
}
```

## API Dependencies

### Stock Search API
**Path:** `/api/stock-search`  
**Usage:** Autocomplete for instrument search  
**Expected Response:**
```json
{
  "success": true,
  "results": [
    { "symbol": "AAPL", "name": "Apple Inc." },
    { "symbol": "MSFT", "name": "Microsoft Corporation" }
  ]
}
```

**Mock Implementation:**
```typescript
// src/app/api/stock-search/route.ts
import { NextRequest, NextResponse } from 'next/server'

const STOCKS = [
  { symbol: 'AAPL', name: 'Apple Inc.' },
  { symbol: 'MSFT', name: 'Microsoft Corporation' },
  { symbol: 'GOOGL', name: 'Alphabet Inc.' },
  { symbol: 'AMZN', name: 'Amazon.com Inc.' },
  { symbol: 'TSLA', name: 'Tesla Inc.' },
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF Trust' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
]

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get('q')?.toUpperCase() || ''
  const results = STOCKS.filter(s => 
    s.symbol.includes(q) || s.name.toUpperCase().includes(q)
  )
  return NextResponse.json({ success: true, results })
}
```

## Environment Variables

**None required.** This package runs fully locally using built-in synthetic market data. There are no API keys, secrets, or credentials to configure.

### Connecting a Real Data Provider (Optional)
If you later want live data, edit `src/app/api/quantics-data/route.ts` and replace the `generateBars(...)` call with a fetch to your provider. Store any provider credentials in your own `.env.local` — and never commit that file.

## TypeScript Configuration

Ensure your `tsconfig.json` includes path aliases:

```json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

## Next.js Configuration

Ensure API routes are not statically generated:

```javascript
// next.config.js
module.exports = {
  // ... other config
  experimental: {
    serverActions: true,
  },
}
```

## Icon Library Usage

The code uses `lucide-react` icons:

```tsx
import { Activity, Zap, Play, Download, Brain, TrendingUp, Settings, ChevronDown, ChevronUp } from 'lucide-react'
```

All icons are tree-shakeable, so only imported icons are bundled.

## Charting Library

The code uses `recharts` for visualization:

```tsx
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'
```

**Key Features Used:**
- `ResponsiveContainer` - Auto-sizing
- `LineChart` - Line chart container
- `Line` - Data series
- `XAxis`/`YAxis` - Axes (hidden in this case)
- `Tooltip` - Hover tooltips

## Styling Notes

### No CSS Modules
All styling is inline using React `style` props. No external CSS files required.

### Animations
CSS animations are defined inline with `<style jsx>`:
```tsx
<style jsx>{`
  @keyframes spin { 
    from { transform: rotate(0deg); } 
    to { transform: rotate(360deg); } 
  }
`}</style>
```

### Responsive Design
Responsive grid layouts using CSS Grid:
```tsx
style={{ 
  display: 'grid', 
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '8px'
}}
```

## Browser Compatibility

**Minimum Requirements:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

**Features Used:**
- ES2020+ syntax
- CSS Grid
- Flexbox
- Fetch API
- URLSearchParams
- IntersectionObserver (for future lazy loading)

## Development vs Production

### Development Mode
```bash
npm run dev
```
- Hot reload enabled
- API routes update live
- Console logs active

### Production Mode
```bash
npm run build
npm start
```
- Optimized bundles
- API routes cached (use `cache: 'no-store'` to disable)
- Console logs stripped (depending on config)

## Testing the Extraction

### Step-by-Step Test
1. Copy all files to your project
2. Install dependencies: `npm install`
3. Set up environment variables
4. Create stub components for DashboardHeader and MobileBottomNav
5. Create mock stock-search API route
6. Run dev server: `npm run dev`
7. Navigate to `http://localhost:3000/quantics`
8. Test each feature:
   - Instrument search
   - Timeframe selection
   - Strategy selection
   - Parameter adjustment
   - Run Backtest button
   - CSV export
   - Collapse/expand panel

### Common Issues

**Issue:** "Module not found: Can't resolve '@/components/dashboard/dashboard-header'"  
**Fix:** Create stub component or copy from main project

**Issue:** No data / empty chart  
**Fix:** The API generates synthetic data and always returns bars. Ensure the dev server is running and the fetch URL matches `/api/quantics-data`.

**Issue:** "No data returned"  
**Fix:** Synthetic data always returns bars. If you swapped in a real provider, try a different symbol or timeframe.

**Issue:** Chart not rendering  
**Fix:** Ensure `recharts` is installed: `npm install recharts`

**Issue:** Icons not showing  
**Fix:** Ensure `lucide-react` is installed: `npm install lucide-react`

## Performance Optimization

### Chart Sampling
Large datasets are auto-sampled for performance:
```tsx
chartData.filter((_: any, i: number) => 
  i % Math.max(1, Math.floor(chartData.length / 200)) === 0
)
```
This displays ~200 points regardless of total bars.

### Data Generation
The API generates synthetic bars on each request. The generator is deterministic (seeded by symbol/timeframe/lookback), so the same inputs always produce the same series.

### Component State
State is minimized and localized to reduce re-renders.

## Future Enhancements

Potential improvements your partner could work on:
- Add more strategy implementations (currently only 4 are coded)
- Implement trade visualization on chart
- Add parameter presets/favorites
- Export backtest results as PDF
- Add multi-symbol comparison
- Implement portfolio backtesting
- Add walk-forward optimization
- Implement custom strategy builder UI
- Add social sharing of backtest results
- Implement saved strategy configurations
