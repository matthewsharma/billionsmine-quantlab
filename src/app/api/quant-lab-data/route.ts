import { NextRequest, NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

function seededRandom(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function hashString(str: string): number {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function generateBars(count: number, symbol: string, timeframe: string) {
  const seed = hashString(`${symbol}|${count}|${timeframe}`)
  const rand = seededRandom(seed)
  const basePrice = 50 + (hashString(symbol) % 400)
  const bars = []
  let price = basePrice
  const startDate = new Date('2024-01-02T09:30:00Z')
  let currentTradingDayOffset = 0

  while (bars.length < count) {
    const d = new Date(startDate)
    d.setUTCDate(d.getUTCDate() + currentTradingDayOffset)

    if (timeframe === '5Min') {
      const total5MinBars = 78
      for (let b = 0; b < total5MinBars && bars.length < count; b++) {
        const timeMs = d.getTime() + b * 5 * 60 * 1000
        const barDate = new Date(timeMs)
        const change = (rand() - 0.485) * price * 0.003
        const open = price
        price = Math.max(price * 0.7, price + change)
        const high = Math.max(open, price) * (1 + rand() * 0.001)
        const low = Math.min(open, price) * (1 - rand() * 0.001)
        bars.push({
          t: barDate.toISOString(),
          o: +open.toFixed(2),
          h: +high.toFixed(2),
          l: +low.toFixed(2),
          c: +price.toFixed(2),
          v: Math.floor(100000 + rand() * 200000)
        })
      }
    } else if (timeframe === '15Min') {
      const total15MinBars = 26
      for (let b = 0; b < total15MinBars && bars.length < count; b++) {
        const timeMs = d.getTime() + b * 15 * 60 * 1000
        const barDate = new Date(timeMs)
        const change = (rand() - 0.485) * price * 0.005
        const open = price
        price = Math.max(price * 0.7, price + change)
        const high = Math.max(open, price) * (1 + rand() * 0.0015)
        const low = Math.min(open, price) * (1 - rand() * 0.0015)
        bars.push({
          t: barDate.toISOString(),
          o: +open.toFixed(2),
          h: +high.toFixed(2),
          l: +low.toFixed(2),
          c: +price.toFixed(2),
          v: Math.floor(300000 + rand() * 500000)
        })
      }
    } else if (timeframe === '1Hour') {
      const total1HourBars = 7
      for (let b = 0; b < total1HourBars && bars.length < count; b++) {
        const timeMs = d.getTime() + b * 60 * 60 * 1000
        const barDate = new Date(timeMs)
        const change = (rand() - 0.485) * price * 0.008
        const open = price
        price = Math.max(price * 0.7, price + change)
        const high = Math.max(open, price) * (1 + rand() * 0.003)
        const low = Math.min(open, price) * (1 - rand() * 0.003)
        bars.push({
          t: barDate.toISOString(),
          o: +open.toFixed(2),
          h: +high.toFixed(2),
          l: +low.toFixed(2),
          c: +price.toFixed(2),
          v: Math.floor(1000000 + rand() * 2000000)
        })
      }
    } else {
      const change = (rand() - 0.48) * price * 0.018
      const open = price
      price = Math.max(price * 0.7, price + change)
      const high = Math.max(open, price) * (1 + rand() * 0.008)
      const low = Math.min(open, price) * (1 - rand() * 0.008)
      bars.push({
        t: d.toISOString(),
        o: +open.toFixed(2),
        h: +high.toFixed(2),
        l: +low.toFixed(2),
        c: +price.toFixed(2),
        v: Math.floor(50000000 + rand() * 80000000)
      })
    }
    currentTradingDayOffset++
  }
  return bars
}

function computeSMA(prices: number[], period: number): (number | null)[] {
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function computeEMA(prices: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1)
  const ema: (number | null)[] = []
  let prev: number | null = null
  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) { ema.push(null); continue }
    if (prev === null) {
      prev = prices.slice(0, period).reduce((a, b) => a + b, 0) / period
    } else {
      prev = prices[i] * k + prev * (1 - k)
    }
    ema.push(prev)
  }
  return ema
}

function computeRSI(prices: number[], period: number = 14): (number | null)[] {
  const rsi: (number | null)[] = [null]
  let avgGain = 0, avgLoss = 0
  for (let i = 1; i < prices.length; i++) {
    const change = prices[i] - prices[i - 1]
    const gain = change > 0 ? change : 0
    const loss = change < 0 ? -change : 0
    if (i <= period) {
      avgGain += gain / period
      avgLoss += loss / period
      rsi.push(i === period ? (avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss)) : null)
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period
      avgLoss = (avgLoss * (period - 1) + loss) / period
      rsi.push(avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss))
    }
  }
  return rsi
}

function computeMACD(prices: number[], fast = 12, slow = 26, signalPeriod = 9): { macd: (number | null)[]; signal: (number | null)[]; histogram: (number | null)[] } {
  const emaFast = computeEMA(prices, fast)
  const emaSlow = computeEMA(prices, slow)
  const macd = emaFast.map((eF, i) => (eF !== null && emaSlow[i] !== null) ? eF - emaSlow[i]! : null)
  const macdValues = macd.filter(v => v !== null) as number[]
  const signalRaw = computeEMA(macdValues, signalPeriod)
  let signalIdx = 0
  const signal = macd.map(v => { if (v === null) return null; return signalRaw[signalIdx++] ?? null })
  const histogram = macd.map((m, i) => (m !== null && signal[i] !== null) ? m - signal[i]! : null)
  return { macd, signal, histogram }
}

function computeBollingerBands(prices: number[], period: number = 20, stdDev: number = 2) {
  const middle = computeSMA(prices, period)
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < prices.length; i++) {
    if (middle[i] === null) { upper.push(null); lower.push(null); continue }
    const slice = prices.slice(i - period + 1, i + 1)
    const std = Math.sqrt(slice.reduce((sum, p) => sum + Math.pow(p - middle[i]!, 2), 0) / period)
    upper.push(middle[i]! + stdDev * std)
    lower.push(middle[i]! - stdDev * std)
  }
  return { upper, middle, lower }
}

function computeATR(bars: Array<{ h: number; l: number; c: number }>, period: number = 14) {
  const atr: (number | null)[] = [null]
  let sumTR = 0
  for (let i = 1; i < bars.length; i++) {
    const tr = Math.max(
      bars[i].h - bars[i].l,
      Math.abs(bars[i].h - bars[i - 1].c),
      Math.abs(bars[i].l - bars[i - 1].c)
    )
    if (i < period) {
      sumTR += tr
      atr.push(null)
    } else if (i === period) {
      sumTR += tr
      atr.push(sumTR / period)
    } else {
      const prevAtr = atr[i - 1]!
      atr.push((prevAtr * (period - 1) + tr) / period)
    }
  }
  return atr
}

function computeZScore(prices: number[], window: number = 20) {
  const z: (number | null)[] = []
  for (let i = 0; i < prices.length; i++) {
    if (i < window - 1) { z.push(null); continue }
    const slice = prices.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / window
    const std = Math.sqrt(slice.reduce((s, p) => s + Math.pow(p - mean, 2), 0) / window)
    z.push(std === 0 ? 0 : (prices[i] - mean) / std)
  }
  return z
}

function computeDonchian(bars: Array<{ h: number; l: number }>, period: number = 20) {
  const upper: (number | null)[] = []
  const lower: (number | null)[] = []
  for (let i = 0; i < bars.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue }
    const slice = bars.slice(i - period + 1, i + 1)
    upper.push(Math.max(...slice.map(b => b.h)))
    lower.push(Math.min(...slice.map(b => b.l)))
  }
  return { upper, lower }
}

function computeVWAP(bars: Array<{ h: number; l: number; c: number; v: number }>) {
  const vwap: number[] = []
  let cumulativePV = 0
  let cumulativeV = 0
  for (let i = 0; i < bars.length; i++) {
    const typicalPrice = (bars[i].h + bars[i].l + bars[i].c) / 3
    cumulativePV += typicalPrice * bars[i].v
    cumulativeV += bars[i].v
    vwap.push(cumulativeV === 0 ? typicalPrice : cumulativePV / cumulativeV)
  }
  return vwap
}

function computeIchimoku(bars: Array<{ h: number; l: number }>, tenkan: number, kijun: number, senkou: number) {
  const tLine: (number | null)[] = []
  const kLine: (number | null)[] = []
  const sA: (number | null)[] = new Array(bars.length).fill(null)
  const sB: (number | null)[] = new Array(bars.length).fill(null)
  for (let i = 0; i < bars.length; i++) {
    if (i >= tenkan - 1) {
      const slice = bars.slice(i - tenkan + 1, i + 1)
      tLine.push((Math.max(...slice.map(b => b.h)) + Math.min(...slice.map(b => b.l))) / 2)
    } else { tLine.push(null) }
    if (i >= kijun - 1) {
      const slice = bars.slice(i - kijun + 1, i + 1)
      kLine.push((Math.max(...slice.map(b => b.h)) + Math.min(...slice.map(b => b.l))) / 2)
    } else { kLine.push(null) }

    if (tLine[i] !== null && kLine[i] !== null && i + kijun < bars.length) {
      sA[i + kijun] = (tLine[i]! + kLine[i]!) / 2
    }
    if (i >= senkou - 1 && i + kijun < bars.length) {
      const slice = bars.slice(i - senkou + 1, i + 1)
      sB[i + kijun] = (Math.max(...slice.map(b => b.h)) + Math.min(...slice.map(b => b.l))) / 2
    }
  }
  return { tenkan: tLine, kijun: kLine, senkouA: sA, senkouB: sB }
}

function computeVolatility(prices: number[], window: number = 20) {
  const vol: (number | null)[] = [null]
  const returns = [0]
  for (let i = 1; i < prices.length; i++) {
    returns.push((prices[i] - prices[i - 1]) / prices[i - 1])
  }
  for (let i = 1; i < prices.length; i++) {
    if (i < window) { vol.push(null); continue }
    const slice = returns.slice(i - window + 1, i + 1)
    const mean = slice.reduce((a, b) => a + b, 0) / window
    const std = Math.sqrt(slice.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / window)
    vol.push(std)
  }
  return vol
}

export interface StrategyRule {
  id: string
  strategy: string
  params: Record<string, number>
}

export interface BacktestConfig {
  strategy?: string
  params: Record<string, any>
  entryOperator?: 'AND' | 'OR'
  entryRules?: StrategyRule[]
  exitOperator?: 'AND' | 'OR'
  exitRules?: StrategyRule[]
}

export interface RuleSignalEval {
  entryTrigger: boolean[]
  entryActive: boolean[]
  exitTrigger: boolean[]
  exitActive: boolean[]
  entryDesc: string[]
  exitDesc: string[]
}

function evaluateRuleSignals(bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>, rule: StrategyRule): RuleSignalEval {
  const prices = bars.map(b => b.c)
  const len = prices.length
  const entryTrigger = new Array(len).fill(false)
  const entryActive = new Array(len).fill(false)
  const exitTrigger = new Array(len).fill(false)
  const exitActive = new Array(len).fill(false)
  const entryDesc = new Array(len).fill('')
  const exitDesc = new Array(len).fill('')

  const strat = rule.strategy
  const p = rule.params || {}

  if (strat === 'sma_crossover') {
    const fastP = p.fast || 10
    const slowP = p.slow || 30
    const fast = computeSMA(prices, fastP)
    const slow = computeSMA(prices, slowP)
    for (let i = 1; i < len; i++) {
      if (fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) continue
      const isCrossUp = fast[i - 1]! <= slow[i - 1]! && fast[i]! > slow[i]!
      const isCrossDown = fast[i - 1]! >= slow[i - 1]! && fast[i]! < slow[i]!
      if (isCrossUp) {
        entryTrigger[i] = true
        entryDesc[i] = `SMA Golden Cross (Fast ${fastP} > Slow ${slowP})`
      }
      if (fast[i]! > slow[i]!) {
        entryActive[i] = true
        if (!entryDesc[i]) entryDesc[i] = `SMA Bullish Trend (Fast ${fastP} > Slow ${slowP})`
      }
      if (isCrossDown) {
        exitTrigger[i] = true
        exitDesc[i] = `SMA Death Cross (Fast ${fastP} < Slow ${slowP})`
      }
      if (fast[i]! < slow[i]!) {
        exitActive[i] = true
        if (!exitDesc[i]) exitDesc[i] = `SMA Bearish Trend (Fast ${fastP} < Slow ${slowP})`
      }
    }
  } else if (strat === 'mean_reversion_rsi') {
    const period = p.period || 14
    const oversold = p.oversold || 30
    const overbought = p.overbought || 70
    const rsi = computeRSI(prices, period)
    for (let i = 1; i < len; i++) {
      if (rsi[i] === null || rsi[i - 1] === null) continue
      const isDip = rsi[i - 1]! >= oversold && rsi[i]! < oversold
      const isSpike = rsi[i - 1]! <= overbought && rsi[i]! > overbought
      if (isDip || rsi[i]! < oversold) {
        entryTrigger[i] = isDip || i === 1
        entryActive[i] = rsi[i]! < oversold
        entryDesc[i] = `RSI Oversold Dip (${rsi[i]!.toFixed(1)} < ${oversold})`
      }
      if (isSpike || rsi[i]! > overbought) {
        exitTrigger[i] = isSpike || i === 1
        exitActive[i] = rsi[i]! > overbought
        exitDesc[i] = `RSI Overbought (${rsi[i]!.toFixed(1)} > ${overbought})`
      }
    }
  } else if (strat === 'macd_crossover') {
    const fastP = p.fast || 12
    const slowP = p.slow || 26
    const sigP = p.signal || 9
    const { macd, signal } = computeMACD(prices, fastP, slowP, sigP)
    for (let i = 1; i < len; i++) {
      if (macd[i] === null || signal[i] === null || macd[i - 1] === null || signal[i - 1] === null) continue
      const isBull = macd[i - 1]! <= signal[i - 1]! && macd[i]! > signal[i]!
      const isBear = macd[i - 1]! >= signal[i - 1]! && macd[i]! < signal[i]!
      if (isBull) {
        entryTrigger[i] = true
        entryDesc[i] = `MACD Bullish Cross (MACD > Signal)`
      }
      if (macd[i]! > signal[i]!) {
        entryActive[i] = true
        if (!entryDesc[i]) entryDesc[i] = `MACD Positive Momentum`
      }
      if (isBear) {
        exitTrigger[i] = true
        exitDesc[i] = `MACD Bearish Cross (MACD < Signal)`
      }
      if (macd[i]! < signal[i]!) {
        exitActive[i] = true
        if (!exitDesc[i]) exitDesc[i] = `MACD Negative Momentum`
      }
    }
  } else if (strat === 'bollinger_revert') {
    const period = p.period || 20
    const stdDev = p.stdDev || 2
    const bb = computeBollingerBands(prices, period, stdDev)
    for (let i = 1; i < len; i++) {
      if (bb.lower[i] === null || bb.upper[i] === null || bb.middle[i] === null) continue
      if (prices[i] < bb.lower[i]!) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `Bollinger Lower Band Dip ($${prices[i].toFixed(2)} < $${bb.lower[i]!.toFixed(2)})`
      }
      if (prices[i] >= bb.middle[i]! || prices[i] > bb.upper[i]!) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `Bollinger Target Hit ($${prices[i].toFixed(2)} >= $${bb.middle[i]!.toFixed(2)})`
      }
    }
  } else if (strat === 'breakout' || strat === 'turtle' || strat === 'donchian_breakout') {
    const entryLen = p.entryLen || p.entry || 20
    const exitLen = p.exitLen || p.exit || 10
    const donchianEntry = computeDonchian(bars, entryLen)
    const donchianExit = computeDonchian(bars, exitLen)
    for (let i = 1; i < len; i++) {
      if (donchianEntry.upper[i - 1] === null || donchianExit.lower[i - 1] === null) continue
      if (prices[i] > donchianEntry.upper[i - 1]!) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `Donchian Breakout Above ${entryLen}d High ($${prices[i].toFixed(2)})`
      }
      if (prices[i] < donchianExit.lower[i - 1]!) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `Donchian Exit Below ${exitLen}d Low ($${prices[i].toFixed(2)})`
      }
    }
  } else if (strat === 'vol_breakout') {
    const k = p.k || 0.6
    const atrLen = p.atrLen || 14
    const atr = computeATR(bars, atrLen)
    for (let i = 1; i < len; i++) {
      if (atr[i - 1] === null) continue
      const upperBand = bars[i - 1].c + k * atr[i - 1]!
      const lowerBand = bars[i - 1].c - k * atr[i - 1]!
      if (prices[i] > upperBand) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `Volatility Breakout (> Upper ATR Band +$${(k * atr[i - 1]!).toFixed(2)})`
      }
      if (prices[i] < lowerBand) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `Volatility Breakdown (< Lower ATR Band -$${(k * atr[i - 1]!).toFixed(2)})`
      }
    }
  } else if (strat === 'ema_ribbon') {
    const fastP = p.fast || 8
    const midP = p.mid || 21
    const slowP = p.slow || 55
    const fast = computeEMA(prices, fastP)
    const mid = computeEMA(prices, midP)
    const slow = computeEMA(prices, slowP)
    for (let i = 1; i < len; i++) {
      if (fast[i] === null || mid[i] === null || slow[i] === null) continue
      if (fast[i]! > mid[i]! && mid[i]! > slow[i]!) {
        entryTrigger[i] = !(fast[i - 1]! > mid[i - 1]! && mid[i - 1]! > slow[i - 1]!)
        entryActive[i] = true
        entryDesc[i] = `EMA Ribbon Bullish (${fastP} > ${midP} > ${slowP})`
      }
      if (fast[i]! < mid[i]! || fast[i]! < slow[i]!) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `EMA Ribbon Bearish Breakdown`
      }
    }
  } else if (strat === 'vwap_reversion') {
    const devPct = p.devPct || 1.5
    const vwap = computeVWAP(bars)
    for (let i = 1; i < len; i++) {
      const lower = vwap[i] * (1 - devPct / 100)
      const upper = vwap[i] * (1 + devPct / 100)
      if (prices[i] < lower) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `VWAP Discount Entry (< VWAP -${devPct}%)`
      }
      if (prices[i] >= vwap[i] || prices[i] > upper) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `VWAP Target Hit (>= VWAP $${vwap[i].toFixed(2)})`
      }
    }
  } else if (strat === 'pairs_trading' || strat === 'stat_arb' || strat === 'mean_reversion_zscore') {
    const window = p.window || p.halflife || 20
    const zEntry = p.zEntry || 2
    const zExit = p.zExit || 0.5
    const zScores = computeZScore(prices, window)
    for (let i = 1; i < len; i++) {
      if (zScores[i] === null) continue
      if (zScores[i]! < -zEntry) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `Z-Score Oversold (${zScores[i]!.toFixed(2)} < -${zEntry})`
      }
      if (zScores[i]! >= -zExit) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `Z-Score Mean Target (${zScores[i]!.toFixed(2)} >= -${zExit})`
      }
    }
  } else if (strat === 'ichimoku_cloud') {
    const t = p.tenkan || 9
    const k = p.kijun || 26
    const s = p.senkou || 52
    const ichi = computeIchimoku(bars, t, k, s)
    for (let i = 1; i < len; i++) {
      if (ichi.tenkan[i] === null || ichi.kijun[i] === null || ichi.senkouA[i] === null || ichi.senkouB[i] === null) continue
      const cloudTop = Math.max(ichi.senkouA[i]!, ichi.senkouB[i]!)
      const cloudBottom = Math.min(ichi.senkouA[i]!, ichi.senkouB[i]!)
      if (prices[i] > cloudTop && ichi.tenkan[i]! > ichi.kijun[i]!) {
        entryTrigger[i] = true
        entryActive[i] = true
        entryDesc[i] = `Ichimoku Bullish Cloud Breakout`
      }
      if (prices[i] < cloudBottom || ichi.tenkan[i]! < ichi.kijun[i]!) {
        exitTrigger[i] = true
        exitActive[i] = true
        exitDesc[i] = `Ichimoku Bearish Cloud Breakdown`
      }
    }
  } else {
    const fast = computeSMA(prices, 10)
    const slow = computeSMA(prices, 30)
    for (let i = 1; i < len; i++) {
      if (fast[i] === null || slow[i] === null || fast[i - 1] === null || slow[i - 1] === null) continue
      if (fast[i - 1]! <= slow[i - 1]! && fast[i]! > slow[i]!) {
        entryTrigger[i] = true; entryActive[i] = true; entryDesc[i] = `Trend Signal Bullish Cross`
      }
      if (fast[i - 1]! >= slow[i - 1]! && fast[i]! < slow[i]!) {
        exitTrigger[i] = true; exitActive[i] = true; exitDesc[i] = `Trend Signal Bearish Cross`
      }
    }
  }

  return { entryTrigger, entryActive, exitTrigger, exitActive, entryDesc, exitDesc }
}

function runBacktest(bars: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>, config: BacktestConfig) {
  const maxPositionSize = Math.max(1, Math.min(10, Math.floor(Number(config.params?.maxPositionSize) || 1)))
  const slippageBps = Number(config.params?.slippageBps) || 0
  const slippageRate = slippageBps / 10000
  const commission = Number(config.params?.commission) || 0
  const stopLossPct = Number(config.params?.stopLoss) || 0
  const takeProfitPct = Number(config.params?.takeProfit) || 0

  const prices = bars.map(b => b.c)
  const trades: Array<{
    entry: number;
    exit: number;
    entryPrice: number;
    exitPrice: number;
    pnl: number;
    side: string;
    size: number;
    entryReason: string;
    exitReason: string;
    exitReasonText: string;
  }> = []

  interface OpenLot {
    lotIndex: number;
    entryIdx: number;
    entryPrice: number;
    rawPrice: number;
    entryReason: string;
  }

  let position = 'flat' as string
  let currentLots = 0
  let openLots: OpenLot[] = []
  let currentEntryReason = ''

  const signalEvents: Array<{ signal: 'buy' | 'sell'; type: 'entry' | 'exit'; reason: string } | null> = new Array(prices.length).fill(null)
  const positionHistory: string[] = new Array(prices.length).fill('flat')
  const positionSizeHistory: number[] = new Array(prices.length).fill(0)

  function openPosition(idx: number, side: 'long' | 'short', reason?: string, customRawPrice?: number) {
    const p = customRawPrice !== undefined ? customRawPrice : prices[idx]
    const execPrice = side === 'long'
      ? p * (1 + slippageRate)
      : p * (1 - slippageRate)
    
    currentLots = 1
    position = side
    currentEntryReason = reason || (side === 'long' ? 'Long Strategy Entry Signal' : 'Short Strategy Entry Signal')
    openLots = [{
      lotIndex: 1,
      entryIdx: idx,
      entryPrice: execPrice,
      rawPrice: p,
      entryReason: currentEntryReason
    }]

    signalEvents[idx] = {
      signal: side === 'long' ? 'buy' : 'sell',
      type: 'entry',
      reason: currentEntryReason
    }
  }

  function scaleInPosition(idx: number, side: 'long' | 'short', reason?: string, customRawPrice?: number) {
    if (position !== side || currentLots >= maxPositionSize) return
    const p = customRawPrice !== undefined ? customRawPrice : prices[idx]
    const newExecPrice = side === 'long'
      ? p * (1 + slippageRate)
      : p * (1 - slippageRate)

    const newLots = currentLots + 1
    currentLots = newLots

    const scaleReason = reason
      ? `${reason} (Lot ${newLots}/${maxPositionSize} @ $${newExecPrice.toFixed(2)})`
      : `Scale-In: Added Lot ${newLots}/${maxPositionSize} @ $${newExecPrice.toFixed(2)}`

    openLots.push({
      lotIndex: newLots,
      entryIdx: idx,
      entryPrice: newExecPrice,
      rawPrice: p,
      entryReason: scaleReason
    })

    signalEvents[idx] = {
      signal: side === 'long' ? 'buy' : 'sell',
      type: 'entry',
      reason: scaleReason
    }
  }

  function closePosition(idx: number, customRawPrice?: number, reason: string = 'signal') {
    if (position === 'flat' || currentLots <= 0 || openLots.length === 0) return
    const p = customRawPrice !== undefined ? customRawPrice : prices[idx]
    const isLong = position === 'long'
    const execExitPrice = isLong
      ? p * (1 - slippageRate)
      : p * (1 + slippageRate)
    
    let exitReasonText = 'Strategy Exit Signal'
    if (reason === 'stop_loss') {
      exitReasonText = `Stop Loss Limit Hit (-${stopLossPct}%)`
    } else if (reason === 'take_profit') {
      exitReasonText = `Take Profit Target Reached (+${takeProfitPct}%)`
    } else if (reason === 'end_of_data') {
      exitReasonText = 'Backtest Period Concluded (Market Close)'
    } else if (reason && reason !== 'signal') {
      exitReasonText = reason
    }

    const lotsClosed = openLots.length
    for (const lot of openLots) {
      const grossDiff = isLong ? (execExitPrice - lot.entryPrice) : (lot.entryPrice - execExitPrice)
      const tradePnl = grossDiff - (commission * 2)

      trades.push({
        entry: lot.entryIdx,
        exit: idx,
        entryPrice: parseFloat(lot.entryPrice.toFixed(2)),
        exitPrice: parseFloat(execExitPrice.toFixed(2)),
        pnl: parseFloat(tradePnl.toFixed(2)),
        side: position,
        size: 1,
        entryReason: lot.entryReason,
        exitReason: reason,
        exitReasonText: lotsClosed > 1 ? `${exitReasonText} (Closed ${lotsClosed} Lots)` : exitReasonText
      })
    }

    signalEvents[idx] = {
      signal: isLong ? 'sell' : 'buy',
      type: 'exit',
      reason: lotsClosed > 1 ? `${exitReasonText} (Closed ${lotsClosed} Lots)` : exitReasonText
    }

    position = 'flat'
    currentLots = 0
    openLots = []
  }

  function handleSignal(idx: number, side: 'long' | 'short', reason: string, customRawPrice?: number) {
    if (position === 'flat') {
      openPosition(idx, side, reason, customRawPrice)
    } else if (position === side) {
      if (currentLots < maxPositionSize) {
        scaleInPosition(idx, side, reason, customRawPrice)
      }
    } else {
      // Reversal: close existing position across all accumulated lots, then immediately open 1 lot on opposing side
      const closeReason = `Reversal to ${side === 'long' ? 'LONG' : 'SHORT'}: ${reason}`
      closePosition(idx, customRawPrice, closeReason)
      openPosition(idx, side, reason, customRawPrice)
    }
  }

  function checkRiskExit(i: number): boolean {
    if (position === 'flat' || currentLots <= 0 || openLots.length === 0) return false
    const avgRawPrice = openLots.reduce((s, l) => s + l.rawPrice, 0) / openLots.length
    if (position === 'long') {
      if (stopLossPct > 0) {
        const slPrice = avgRawPrice * (1 - stopLossPct / 100)
        if (bars[i].l <= slPrice) {
          closePosition(i, slPrice, 'stop_loss')
          return true
        }
      }
      if (takeProfitPct > 0) {
        const tpPrice = avgRawPrice * (1 + takeProfitPct / 100)
        if (bars[i].h >= tpPrice) {
          closePosition(i, tpPrice, 'take_profit')
          return true
        }
      }
    } else if (position === 'short') {
      if (stopLossPct > 0) {
        const slPrice = avgRawPrice * (1 + stopLossPct / 100)
        if (bars[i].h >= slPrice) {
          closePosition(i, slPrice, 'stop_loss')
          return true
        }
      }
      if (takeProfitPct > 0) {
        const tpPrice = avgRawPrice * (1 - takeProfitPct / 100)
        if (bars[i].l <= tpPrice) {
          closePosition(i, tpPrice, 'take_profit')
          return true
        }
      }
    }
    return false
  }

  if (config.entryRules && config.entryRules.length > 0) {
    const entryEvaluations = config.entryRules.map(r => evaluateRuleSignals(bars, r))
    const exitEvaluations = (config.exitRules || []).map(r => evaluateRuleSignals(bars, r))

    const entryOp = config.entryOperator || 'AND'
    const exitOp = config.exitOperator || 'OR'

    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (position === 'long') {
          // --- IN A POSITION: EVALUATE EXIT CONDITIONS FIRST ---
          let exitTriggered = false
          let exitReasonText = ''

          if (exitEvaluations.length > 0) {
            if (exitOp === 'AND') {
              // ALL exit rules must be met
              const allMet = exitEvaluations.every(e => e.exitActive[i] || e.exitTrigger[i])
              if (allMet) {
                exitTriggered = true
                exitReasonText = `Exit Condition (AND): ` + exitEvaluations.map(e => e.exitDesc[i]).filter(Boolean).join(' + ')
              }
            } else {
              // OR (Any exit rule met)
              const satisfied = exitEvaluations.filter(e => e.exitTrigger[i] || e.exitActive[i])
              if (satisfied.length > 0) {
                exitTriggered = true
                exitReasonText = `Exit Condition (OR): ` + satisfied.map(e => e.exitDesc[i]).filter(Boolean).join(', ')
              }
            }
          } else {
            // No exit rules defined by user: check if entry rule's natural exit occurred
            const satisfiedNatural = entryEvaluations.filter(e => e.exitTrigger[i])
            if (satisfiedNatural.length > 0) {
              exitTriggered = true
              exitReasonText = `Strategy Exit Signal: ` + satisfiedNatural.map(e => e.exitDesc[i]).filter(Boolean).join(', ')
            }
          }

          if (exitTriggered) {
            closePosition(i, prices[i], exitReasonText)
          } else if (currentLots < maxPositionSize) {
            // Position stays open: check if entry conditions re-trigger to scale in
            let scaleTriggered = false
            let scaleDesc = ''
            if (entryOp === 'AND') {
              const allActive = entryEvaluations.every(e => e.entryActive[i])
              const anyJustTriggered = entryEvaluations.some(e => e.entryTrigger[i])
              if (allActive && anyJustTriggered) {
                scaleTriggered = true
                scaleDesc = `Scale-In (AND): ` + entryEvaluations.map(e => e.entryDesc[i]).filter(Boolean).join(' + ')
              }
            } else {
              const satisfied = entryEvaluations.filter(e => e.entryTrigger[i])
              if (satisfied.length > 0) {
                scaleTriggered = true
                scaleDesc = `Scale-In (OR): ` + satisfied.map(e => e.entryDesc[i]).filter(Boolean).join(', ')
              }
            }
            if (scaleTriggered) {
              scaleInPosition(i, 'long', scaleDesc)
            }
          }
        } else if (position === 'flat') {
          // --- POSITION IS FLAT: EVALUATE ENTRY CONDITIONS ---
          let entryTriggered = false
          let entryReasonText = ''

          if (entryOp === 'AND') {
            const allActive = entryEvaluations.every(e => e.entryActive[i] || e.entryTrigger[i])
            const anyTrigger = entryEvaluations.some(e => e.entryTrigger[i]) || entryEvaluations.every(e => e.entryActive[i] && !e.entryActive[i - 1])
            if (allActive && (anyTrigger || i === 1)) {
              entryTriggered = true
              entryReasonText = `Entry Condition (AND): ` + entryEvaluations.map(e => e.entryDesc[i]).filter(Boolean).join(' + ')
            }
          } else {
            // OR (Any entry rule met)
            const satisfied = entryEvaluations.filter(e => e.entryTrigger[i] || (e.entryActive[i] && !e.entryActive[i - 1]))
            if (satisfied.length > 0) {
              entryTriggered = true
              entryReasonText = `Entry Condition (OR): ` + satisfied.map(e => e.entryDesc[i]).filter(Boolean).join(', ')
            }
          }

          if (entryTriggered) {
            openPosition(i, 'long', entryReasonText)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'sma_crossover') {
    const fastPeriod = config.params.fast || 10
    const slowPeriod = config.params.slow || 30
    const fast = computeSMA(prices, fastPeriod)
    const slow = computeSMA(prices, slowPeriod)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (fast[i] !== null && slow[i] !== null && fast[i - 1] !== null && slow[i - 1] !== null) {
          const isCrossUp = fast[i - 1]! <= slow[i - 1]! && fast[i]! > slow[i]!
          const isCrossDown = fast[i - 1]! >= slow[i - 1]! && fast[i]! < slow[i]!
          if (isCrossUp) {
            handleSignal(i, 'long', `Golden Cross: Fast SMA (${fastPeriod}) crossed above Slow SMA (${slowPeriod})`)
          } else if (isCrossDown) {
            handleSignal(i, 'short', `Death Cross: Fast SMA (${fastPeriod}) crossed below Slow SMA (${slowPeriod})`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'mean_reversion_rsi') {
    const period = config.params.period || 14
    const oversold = config.params.oversold || 30
    const overbought = config.params.overbought || 70
    const rsi = computeRSI(prices, period)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (rsi[i] !== null && rsi[i - 1] !== null) {
          if (rsi[i - 1]! >= oversold && rsi[i]! < oversold) {
            handleSignal(i, 'long', `Oversold Entry: RSI crossed below ${oversold} (${rsi[i]!.toFixed(1)})`)
          } else if (rsi[i - 1]! <= overbought && rsi[i]! > overbought) {
            handleSignal(i, 'short', `Overbought Entry: RSI crossed above ${overbought} (${rsi[i]!.toFixed(1)})`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'macd_crossover') {
    const { macd, signal } = computeMACD(prices, config.params.fast || 12, config.params.slow || 26, config.params.signal || 9)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (macd[i] !== null && signal[i] !== null && macd[i - 1] !== null && signal[i - 1] !== null) {
          const isBullCross = macd[i - 1]! <= signal[i - 1]! && macd[i]! > signal[i]!
          const isBearCross = macd[i - 1]! >= signal[i - 1]! && macd[i]! < signal[i]!
          if (isBullCross) {
            handleSignal(i, 'long', 'Bullish Momentum: MACD Line crossed above Signal Line')
          } else if (isBearCross) {
            handleSignal(i, 'short', 'Bearish Momentum: MACD Line crossed below Signal Line')
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'bollinger_revert') {
    const bb = computeBollingerBands(prices, config.params.period || 20, config.params.stdDev || 2)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (bb.lower[i] !== null && bb.upper[i] !== null && bb.lower[i-1] !== null && bb.upper[i-1] !== null) {
          if (prices[i - 1] >= bb.lower[i - 1]! && prices[i] < bb.lower[i]!) {
            handleSignal(i, 'long', `Statistical Dip: Price ($${prices[i].toFixed(2)}) pierced Lower Bollinger Band ($${bb.lower[i]!.toFixed(2)})`)
          } else if (prices[i - 1] <= bb.upper[i - 1]! && prices[i] > bb.upper[i]!) {
            handleSignal(i, 'short', `Statistical Spike: Price ($${prices[i].toFixed(2)}) pierced Upper Bollinger Band ($${bb.upper[i]!.toFixed(2)})`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'momentum') {
    const lookback = config.params.rebalDays || 21
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (i > lookback) {
          const ret = (prices[i] - prices[i - lookback]) / prices[i - lookback]
          const retPrev = (prices[i - 1] - prices[i - 1 - lookback]) / prices[i - 1 - lookback]
          if (retPrev <= 0 && ret > 0) {
            handleSignal(i, 'long', `Positive Momentum Shift: +${(ret * 100).toFixed(1)}% price gain over ${lookback} bars`)
          } else if (retPrev > 0 && ret <= 0) {
            handleSignal(i, 'short', `Negative Momentum Shift: ${(ret * 100).toFixed(1)}% price drop over ${lookback} bars`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'dual_momentum') {
    const lookback = config.params.lookback || 126
    const cashThreshold = config.params.cashThreshold || 0
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (i >= lookback) {
          const ret = (prices[i] - prices[i - lookback]) / prices[i - lookback]
          if (ret > cashThreshold) {
            handleSignal(i, 'long', `Dual Momentum: Return (+${(ret * 100).toFixed(1)}%) exceeded hurdle (${cashThreshold}%)`)
          } else if (ret <= cashThreshold && position !== 'flat') {
            closePosition(i, prices[i], `Risk-Off Exit: Momentum (${(ret * 100).toFixed(1)}%) dropped below cash hurdle`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'pairs_trading' || config.strategy === 'stat_arb' || config.strategy === 'mean_reversion_zscore') {
    const window = config.params.window || config.params.halflife || 20
    const zEntry = config.params.zEntry || 2
    const zExit = config.params.zExit || 0.5
    const zScores = computeZScore(prices, window)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (zScores[i] !== null && zScores[i - 1] !== null) {
          if (zScores[i - 1]! >= -zEntry && zScores[i]! < -zEntry) {
            handleSignal(i, 'long', `Statistical Oversold: Z-Score reached -${Math.abs(zScores[i]!).toFixed(2)}σ (below -${zEntry}σ)`)
          } else if (zScores[i - 1]! <= zEntry && zScores[i]! > zEntry) {
            handleSignal(i, 'short', `Statistical Overbought: Z-Score reached +${zScores[i]!.toFixed(2)}σ (above +${zEntry}σ)`)
          } else if (position === 'long' && zScores[i - 1]! <= -zExit && zScores[i]! > -zExit) {
            closePosition(i, prices[i], `Z-Score Reversion Target Achieved (>-${zExit}σ)`)
          } else if (position === 'short' && zScores[i - 1]! >= zExit && zScores[i]! < zExit) {
            closePosition(i, prices[i], `Z-Score Reversion Target Achieved (<+${zExit}σ)`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'breakout' || config.strategy === 'turtle') {
    const entryLen = config.params.entryLen || config.params.entry || 20
    const exitLen = config.params.exitLen || config.params.exit || 10
    const donchianEntry = computeDonchian(bars, entryLen)
    const donchianExit = computeDonchian(bars, exitLen)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (donchianEntry.upper[i - 1] !== null && donchianExit.lower[i - 1] !== null) {
          if (prices[i] > donchianEntry.upper[i - 1]!) {
            handleSignal(i, 'long', `Donchian Breakout: Price ($${prices[i].toFixed(2)}) broke above ${entryLen}-bar high ($${donchianEntry.upper[i - 1]!.toFixed(2)})`)
          } else if (prices[i] < donchianEntry.lower[i - 1]!) {
            handleSignal(i, 'short', `Donchian Breakdown: Price ($${prices[i].toFixed(2)}) fell below ${entryLen}-bar low ($${donchianEntry.lower[i - 1]!.toFixed(2)})`)
          } else if (position === 'long' && prices[i] < donchianExit.lower[i - 1]!) {
            closePosition(i, prices[i], `Trailing Donchian Exit: Price touched ${exitLen}-bar low boundary`)
          } else if (position === 'short' && prices[i] > donchianExit.upper[i - 1]!) {
            closePosition(i, prices[i], `Trailing Donchian Exit: Price touched ${exitLen}-bar high boundary`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'vol_breakout') {
    const k = config.params.k || 0.6
    const atrLen = config.params.atrLen || 14
    const atr = computeATR(bars, atrLen)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (atr[i - 1] !== null) {
          const upperBand = bars[i - 1].c + k * atr[i - 1]!
          const lowerBand = bars[i - 1].c - k * atr[i - 1]!
          if (prices[i] > upperBand) {
            handleSignal(i, 'long', `Volatility Breakout: Price broke above ATR expansion threshold ($${upperBand.toFixed(2)})`)
          } else if (prices[i] < lowerBand) {
            handleSignal(i, 'short', `Volatility Breakdown: Price broke below ATR expansion threshold ($${lowerBand.toFixed(2)})`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'ema_ribbon') {
    const fast = computeEMA(prices, config.params.fast || 8)
    const mid = computeEMA(prices, config.params.mid || 21)
    const slow = computeEMA(prices, config.params.slow || 55)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (fast[i] !== null && mid[i] !== null && slow[i] !== null) {
          const isBull = fast[i]! > mid[i]! && mid[i]! > slow[i]!
          const isBear = fast[i]! < mid[i]! && mid[i]! < slow[i]!
          const wasBull = fast[i - 1] !== null && fast[i - 1]! > mid[i - 1]! && mid[i - 1]! > slow[i - 1]!
          const wasBear = fast[i - 1] !== null && fast[i - 1]! < mid[i - 1]! && mid[i - 1]! < slow[i - 1]!
          if (isBull && !wasBull) {
            handleSignal(i, 'long', 'Bullish Trend Ribbon: Fast EMA > Mid EMA > Slow EMA in bull cascade')
          } else if (isBear && !wasBear) {
            handleSignal(i, 'short', 'Bearish Trend Ribbon: Fast EMA < Mid EMA < Slow EMA in bear cascade')
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'vwap_reversion') {
    const devPct = config.params.devPct || 1.5
    const vwap = computeVWAP(bars)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        const upper = vwap[i] * (1 + devPct / 100)
        const lower = vwap[i] * (1 - devPct / 100)
        const prevUpper = vwap[i - 1] * (1 + devPct / 100)
        const prevLower = vwap[i - 1] * (1 - devPct / 100)
        if (prices[i - 1] <= prevUpper && prices[i] > upper) {
          handleSignal(i, 'short', `Institutional Premium: Price stretched >${devPct}% above VWAP ($${vwap[i].toFixed(2)})`)
        } else if (prices[i - 1] >= prevLower && prices[i] < lower) {
          handleSignal(i, 'long', `Institutional Discount: Price stretched >${devPct}% below VWAP ($${vwap[i].toFixed(2)})`)
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'overnight_gap') {
    const gapPct = config.params.gapPct || 1.0
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        const gap = (bars[i].o - bars[i - 1].c) / bars[i - 1].c * 100
        if (gap > gapPct) {
          handleSignal(i, 'short', `Opening Gap Fade: +${gap.toFixed(1)}% morning gap above previous close`, bars[i].o)
        } else if (gap < -gapPct) {
          handleSignal(i, 'long', `Opening Gap Fade: ${gap.toFixed(1)}% morning gap down below previous close`, bars[i].o)
        } else if (position !== 'flat') {
          closePosition(i, prices[i], 'Intraday Gap Fill Concluded')
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'risk_parity') {
    const volWindow = config.params.volWindow || 60
    const vol = computeVolatility(prices, volWindow)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (vol[i] !== null) {
          if (vol[i]! < 0.02) {
            handleSignal(i, 'long', 'Volatility Contraction: Realized volatility dropped below 2% risk threshold')
          } else if (vol[i]! >= 0.02 && position !== 'flat') {
            closePosition(i, prices[i], 'Volatility Expansion: Volatility spiked above 2% risk threshold')
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'regime_filter') {
    const smaLen = config.params.smaLen || 200
    const sma = computeSMA(prices, smaLen)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (sma[i] !== null) {
          if (prices[i] > sma[i]!) {
            handleSignal(i, 'long', `Market Regime Filter: Price ($${prices[i].toFixed(2)}) crossed above ${smaLen}-period Moving Average`)
          } else if (prices[i] <= sma[i]! && position !== 'flat') {
            closePosition(i, prices[i], `Market Regime Filter: Price ($${prices[i].toFixed(2)}) fell below ${smaLen}-period Moving Average`)
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'rsi_divergence') {
    const period = config.params.period || 14
    const lookback = config.params.lookback || 10
    const rsi = computeRSI(prices, period)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (i >= lookback && rsi[i] !== null) {
          const priceSlice = prices.slice(i - lookback, i)
          const rsiSlice = rsi.slice(i - lookback, i) as number[]
          if (prices[i] < Math.min(...priceSlice) && rsi[i]! > Math.min(...rsiSlice)) {
            handleSignal(i, 'long', 'Bullish Divergence: Lower price low accompanied by higher RSI momentum low')
          } else if (prices[i] > Math.max(...priceSlice) && rsi[i]! < Math.max(...rsiSlice)) {
            handleSignal(i, 'short', 'Bearish Divergence: Higher price high accompanied by weakening RSI momentum high')
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'ichimoku_cloud') {
    const t = config.params.tenkan || 9
    const k = config.params.kijun || 26
    const s = config.params.senkou || 52
    const ichi = computeIchimoku(bars, t, k, s)
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (ichi.tenkan[i] !== null && ichi.kijun[i] !== null && ichi.senkouA[i] !== null && ichi.senkouB[i] !== null) {
          const cloudTop = Math.max(ichi.senkouA[i]!, ichi.senkouB[i]!)
          const cloudBottom = Math.min(ichi.senkouA[i]!, ichi.senkouB[i]!)
          const isBull = prices[i] > cloudTop && ichi.tenkan[i]! > ichi.kijun[i]!
          const isBear = prices[i] < cloudBottom && ichi.tenkan[i]! < ichi.kijun[i]!

          if (isBull) {
            handleSignal(i, 'long', 'Bullish Kumo Breakout: Price trading above Cloud with Tenkan > Kijun')
          } else if (isBear) {
            handleSignal(i, 'short', 'Bearish Kumo Breakdown: Price trading below Cloud with Tenkan < Kijun')
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  } else if (config.strategy === 'atr_trailing') {
    const atrMult = config.params.atrMult || 3
    const atrLen = config.params.atrLen || 14
    const atr = computeATR(bars, atrLen)
    const sma = computeSMA(prices, 20)
    let highestHigh = 0
    let lowestLow = 1e9
    for (let i = 1; i < prices.length; i++) {
      if (!checkRiskExit(i)) {
        if (atr[i] !== null && sma[i] !== null) {
          if (position === 'flat') {
            if (prices[i] > sma[i]!) {
              handleSignal(i, 'long', 'Baseline Breakout: Price crossed above 20-period baseline')
              highestHigh = prices[i]
            } else {
              handleSignal(i, 'short', 'Baseline Breakdown: Price crossed below 20-period baseline')
              lowestLow = prices[i]
            }
          } else if (position === 'long') {
            highestHigh = Math.max(highestHigh, prices[i])
            const trailingStop = highestHigh - atrMult * atr[i]!
            if (prices[i] < trailingStop) {
              closePosition(i, prices[i], `ATR Trailing Stop Limit Hit (${atrMult}x ATR below peak)`)
            } else if (currentLots < maxPositionSize && prices[i] > highestHigh) {
              handleSignal(i, 'long', `ATR Trend Expansion: Price reached new trend high ($${prices[i].toFixed(2)})`)
            }
          } else if (position === 'short') {
            lowestLow = Math.min(lowestLow, prices[i])
            const trailingStop = lowestLow + atrMult * atr[i]!
            if (prices[i] > trailingStop) {
              closePosition(i, prices[i], `ATR Trailing Stop Limit Hit (${atrMult}x ATR above trough)`)
            } else if (currentLots < maxPositionSize && prices[i] < lowestLow) {
              handleSignal(i, 'short', `ATR Trend Expansion: Price reached new trend low ($${prices[i].toFixed(2)})`)
            }
          }
        }
      }
      positionHistory[i] = position
      positionSizeHistory[i] = currentLots
    }
  }

  if (position === 'long' || position === 'short') {
    closePosition(prices.length - 1, prices[prices.length - 1], 'end_of_data')
  }

  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0)
  const wins = trades.filter(t => t.pnl > 0).length
  const losses = trades.filter(t => t.pnl <= 0).length
  const initialPrice = prices[0]
  const totalReturn = (totalPnl / initialPrice) * 100
  const buyHoldReturn = ((prices[prices.length - 1] - prices[0]) / prices[0]) * 100
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0
  const returns = trades.map(t => (t.entryPrice && t.size) ? t.pnl / (t.entryPrice * t.size) : 0)
  const avgReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0
  const stdReturn = returns.length > 1 ? Math.sqrt(returns.reduce((s, r) => s + Math.pow(r - avgReturn, 2), 0) / (returns.length - 1)) : 1
  const sharpe = stdReturn > 0 ? (avgReturn / stdReturn) * Math.sqrt(252 / Math.max(1, bars.length / 78)) : 0
  let peak = initialPrice, maxDD = 0, equity = initialPrice
  for (const t of trades) { equity += t.pnl; if (equity > peak) peak = equity; const dd = (peak - equity) / peak * 100; if (dd > maxDD) maxDD = dd }

  // Sortino ratio: only penalize downside deviation
  const negReturns = returns.filter(r => r < 0)
  const downsideDev = negReturns.length > 1 ? Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length) : 1
  const sortino = downsideDev > 0 ? (avgReturn / downsideDev) * Math.sqrt(252 / Math.max(1, bars.length / 78)) : 0

  // Calmar ratio: annualized return / max drawdown
  const annualizedReturn = totalReturn * (252 / Math.max(1, bars.length))
  const calmar = maxDD > 0 ? annualizedReturn / maxDD : 0

  // Profit factor: gross profit / gross loss
  const grossProfit = trades.filter(t => t.pnl > 0).reduce((s, t) => s + t.pnl, 0)
  const grossLoss = Math.abs(trades.filter(t => t.pnl <= 0).reduce((s, t) => s + t.pnl, 0))
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0

  // Average win / loss %
  const winTrades = trades.filter(t => t.pnl > 0)
  const lossTrades = trades.filter(t => t.pnl <= 0)
  const avgWin = winTrades.length > 0 ? (winTrades.reduce((s, t) => s + ((t.entryPrice && t.size) ? t.pnl / (t.entryPrice * t.size) : 0), 0) / winTrades.length) * 100 : 0
  const avgLoss = lossTrades.length > 0 ? (lossTrades.reduce((s, t) => s + ((t.entryPrice && t.size) ? t.pnl / (t.entryPrice * t.size) : 0), 0) / lossTrades.length) * 100 : 0

  // Max consecutive losses
  let maxConsecLosses = 0, consecLosses = 0
  for (const t of trades) {
    if (t.pnl <= 0) { consecLosses++; if (consecLosses > maxConsecLosses) maxConsecLosses = consecLosses }
    else consecLosses = 0
  }

  const lots = positionHistory.map((pos, idx) => pos === 'long' ? positionSizeHistory[idx] : pos === 'short' ? -positionSizeHistory[idx] : 0)

  const signals: (string | null)[] = new Array(prices.length).fill(null)
  for (let i = 0; i < prices.length; i++) {
    if (signalEvents[i]) {
      signals[i] = signalEvents[i]!.signal
    }
  }

  const equityCurve: number[] = new Array(prices.length).fill(100)
  let currentEquity = 100
  equityCurve[0] = currentEquity
  for (let i = 1; i < prices.length; i++) {
    const prevPosition = positionHistory[i - 1]
    const currentSize = positionSizeHistory[i - 1] || 0
    const priceChangePct = (prices[i] - prices[i - 1]) / prices[i - 1]
    if (prevPosition === 'long') {
      currentEquity = currentEquity * (1 + priceChangePct * currentSize)
    } else if (prevPosition === 'short') {
      currentEquity = currentEquity * (1 - priceChangePct * currentSize)
    }
    equityCurve[i] = parseFloat(currentEquity.toFixed(2))
  }

  const tradeList = trades.map((t, idx) => {
    const returnPct = t.side === 'long'
      ? ((t.exitPrice - t.entryPrice) / t.entryPrice) * 100
      : ((t.entryPrice - t.exitPrice) / t.entryPrice) * 100
    return {
      id: idx + 1,
      side: t.side,
      size: t.size,
      entryIdx: t.entry,
      exitIdx: t.exit,
      entryTime: bars[t.entry]?.t || '',
      exitTime: bars[t.exit]?.t || '',
      entryPrice: parseFloat(t.entryPrice.toFixed(2)),
      exitPrice: parseFloat(t.exitPrice.toFixed(2)),
      pnl: parseFloat(t.pnl.toFixed(2)),
      returnPct: parseFloat(returnPct.toFixed(2)),
      durationBars: t.exit - t.entry,
      exitReason: t.exitReason || 'signal',
      entryReason: t.entryReason,
      exitReasonText: t.exitReasonText
    }
  })

  return {
    totalReturn: parseFloat(totalReturn.toFixed(2)),
    buyHoldReturn: parseFloat(buyHoldReturn.toFixed(2)),
    alpha: parseFloat((totalReturn - buyHoldReturn).toFixed(2)),
    sharpe: parseFloat(sharpe.toFixed(2)),
    winRate: parseFloat(winRate.toFixed(1)),
    maxDrawdown: parseFloat((-maxDD).toFixed(2)),
    trades: trades.length,
    avgTrade: trades.length > 0 ? parseFloat(((totalPnl / trades.length) / initialPrice * 100).toFixed(3)) : 0,
    sortino: parseFloat(sortino.toFixed(2)),
    calmar: parseFloat(calmar.toFixed(2)),
    profitFactor: profitFactor === Infinity ? 999 : parseFloat(profitFactor.toFixed(2)),
    avgWin: parseFloat(avgWin.toFixed(3)),
    avgLoss: parseFloat(avgLoss.toFixed(3)),
    maxConsecLosses,
    lots,
    equityCurve,
    signals,
    signalEvents,
    tradeList,
  }
}

export async function GET(request: NextRequest) {
  const symbol = request.nextUrl.searchParams.get('symbol')?.toUpperCase() || 'SPY'
  const action = request.nextUrl.searchParams.get('action') || 'bars'
  const strategy = request.nextUrl.searchParams.get('strategy') || ''
  const params = request.nextUrl.searchParams.get('params') || '{}'
  const lookback = request.nextUrl.searchParams.get('lookback') || '6M'
  const ribbonLinesParam = request.nextUrl.searchParams.get('ribbonLines') || '[]'
  let ribbonLines: Array<{ type: 'SMA' | 'EMA'; period: number }> = []

  try {
    ribbonLines = JSON.parse(ribbonLinesParam)
    if (!Array.isArray(ribbonLines)) ribbonLines = []
  } catch (e) {
    const ribbonType = request.nextUrl.searchParams.get('ribbonType') || 'SMA'
    const ribbonPeriodsParam = request.nextUrl.searchParams.get('ribbonPeriods') || ''
    const periods = ribbonPeriodsParam.split(',').map(p => parseInt(p.trim(), 10)).filter(p => !isNaN(p) && p >= 1 && p <= 500)
    ribbonLines = periods.map(p => ({ type: ribbonType as 'SMA' | 'EMA', period: p }))
  }

  ribbonLines = ribbonLines
    .filter(l => l && typeof l === 'object' && !isNaN(l.period) && l.period >= 1 && l.period <= 500)
    .slice(0, 10)

  const timeframe = request.nextUrl.searchParams.get('timeframe') || '1Day'
  let barsPerDay = 1
  if (timeframe === '5Min') barsPerDay = 78
  else if (timeframe === '15Min') barsPerDay = 26
  else if (timeframe === '1Hour') barsPerDay = 7
  else if (timeframe === '1Day') barsPerDay = 1

  let days = 126
  switch (lookback) {
    case '1M': days = 21; break
    case '3M': days = 63; break
    case '6M': days = 126; break
    case '1Y': days = 252; break
    case '3Y': days = 756; break
  }

  const barCount = days * barsPerDay
  const bars = generateBars(barCount, symbol, timeframe)
  const prices = bars.map(b => b.c)

  if (action === 'bars') {
    return NextResponse.json({ success: true, symbol, bars: bars.map(b => ({ time: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v })), count: bars.length })
  }

  if (action === 'indicators') {
    const rsiPeriod = parseInt(request.nextUrl.searchParams.get('rsiPeriod') || '14', 10)
    const bbPeriod = parseInt(request.nextUrl.searchParams.get('bbPeriod') || '20', 10)
    const bbStdDev = parseFloat(request.nextUrl.searchParams.get('bbStdDev') || '2')
    const macdFast = parseInt(request.nextUrl.searchParams.get('macdFast') || '12', 10)
    const macdSlow = parseInt(request.nextUrl.searchParams.get('macdSlow') || '26', 10)
    const macdSignal = parseInt(request.nextUrl.searchParams.get('macdSignal') || '9', 10)
    const donchianPeriod = parseInt(request.nextUrl.searchParams.get('donchianPeriod') || '20', 10)
    const atrPeriod = parseInt(request.nextUrl.searchParams.get('atrPeriod') || '14', 10)
    const ichiTenkan = parseInt(request.nextUrl.searchParams.get('ichiTenkan') || '9', 10)
    const ichiKijun = parseInt(request.nextUrl.searchParams.get('ichiKijun') || '26', 10)
    const ichiSenkou = parseInt(request.nextUrl.searchParams.get('ichiSenkou') || '52', 10)
    const zScoreWindow = parseInt(request.nextUrl.searchParams.get('zScoreWindow') || '20', 10)

    const rsi = computeRSI(prices, rsiPeriod)
    const { macd, signal, histogram } = computeMACD(prices, macdFast, macdSlow, macdSignal)
    const bb = computeBollingerBands(prices, bbPeriod, bbStdDev)
    const sma20 = computeSMA(prices, 20)
    const sma50 = computeSMA(prices, 50)
    const vwap = computeVWAP(bars)
    const donchian = computeDonchian(bars, donchianPeriod)
    const atr = computeATR(bars, atrPeriod)
    const ichimoku = computeIchimoku(bars, ichiTenkan, ichiKijun, ichiSenkou)
    const zscore = computeZScore(prices, zScoreWindow)

    const ribbons: Record<string, (number | null)[]> = {}
    for (const line of ribbonLines) {
      const key = `ribbon_${line.type.toLowerCase()}_${line.period}`
      ribbons[key] = line.type === 'SMA' ? computeSMA(prices, line.period) : computeEMA(prices, line.period)
    }

    const seriesData = bars.map((b, i) => {
      const item: any = {
        time: b.t,
        open: b.o,
        high: b.h,
        low: b.l,
        close: b.c,
        volume: b.v,
        rsi: rsi[i],
        bbUpper: bb.upper[i],
        bbMiddle: bb.middle[i],
        bbLower: bb.lower[i],
        macd: macd[i],
        macdSignal: signal[i],
        macdHistogram: histogram[i],
        sma20: sma20[i],
        sma50: sma50[i],
        vwap: vwap[i],
        donchianUpper: donchian.upper[i],
        donchianLower: donchian.lower[i],
        atr: atr[i],
        ichiTenkan: ichimoku.tenkan[i],
        ichiKijun: ichimoku.kijun[i],
        ichiSenkouA: ichimoku.senkouA[i],
        ichiSenkouB: ichimoku.senkouB[i],
        zscore: zscore[i]
      };

      for (const line of ribbonLines) {
        const key = `ribbon_${line.type.toLowerCase()}_${line.period}`;
        item[key] = ribbons[key][i];
      }
      return item;
    });

    return NextResponse.json({
      success: true,
      symbol,
      count: bars.length,
      indicators: {
        rsi: rsi[rsi.length - 1],
        macd: macd[macd.length - 1],
        macdSignal: signal[signal.length - 1],
        sma20: sma20[sma20.length - 1],
        sma50: sma50[sma50.length - 1],
        bollingerUpper: bb.upper[bb.upper.length - 1],
        bollingerLower: bb.lower[bb.lower.length - 1],
        currentPrice: prices[prices.length - 1]
      },
      series: seriesData
    });
  }

  if (action === 'backtest') {
    const rawEntryRules = request.nextUrl.searchParams.get('entryRules')
    const rawExitRules = request.nextUrl.searchParams.get('exitRules')
    const entryOperator = (request.nextUrl.searchParams.get('entryOperator') || 'AND') as 'AND' | 'OR'
    const exitOperator = (request.nextUrl.searchParams.get('exitOperator') || 'OR') as 'AND' | 'OR'

    const config: BacktestConfig = {
      strategy,
      params: typeof params === 'string' ? JSON.parse(params) : (params || {}),
      entryOperator,
      entryRules: rawEntryRules ? JSON.parse(rawEntryRules) : undefined,
      exitOperator,
      exitRules: rawExitRules ? JSON.parse(rawExitRules) : undefined
    }
    const result = runBacktest(bars, config)
    return NextResponse.json({ success: true, symbol, strategy, ...result })
  }

  return NextResponse.json({ success: false, error: 'Invalid action' })
}