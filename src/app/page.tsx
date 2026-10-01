'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Play, Download, Brain, Settings, Sun, Moon, Save, GripVertical, ZoomIn, ZoomOut, RotateCcw, ChevronLeft, ChevronRight, Layers, RefreshCw, ChevronDown } from 'lucide-react'
import { ComposedChart, LineChart, Line, Bar, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, ReferenceArea, Legend } from 'recharts'
import { QuantLabConfigPanel, STRATEGIES, StrategyRule, SavedStrategy, NumberStepper } from '@/components/config-panel'
import { CustomCheckbox } from '@/components/custom-checkbox'
import { CustomSelect } from '@/components/custom-select'
import { EvaluationPanel, TradeItem } from '@/components/evaluation-panel'
import { PortfolioLeg } from '@/components/config-panel'
import { BuiltinColorPicker } from '@/components/builtin-color-picker'

interface BacktestResult {
  totalReturn: number; buyHoldReturn: number; alpha: number
  sharpe: number; winRate: number; maxDrawdown: number; trades: number; avgTrade: number
  sortino?: number; calmar?: number; profitFactor?: number
  avgWin?: number; avgLoss?: number; maxConsecLosses?: number
  tradeList?: TradeItem[]
  legResults?: any[]
  marketAlpha?: number
  spyBuyHoldReturn?: number
  correlation?: number
}

function computeSMA(prices: number[], period: number): (number | null)[] {
  if (period <= 0) return prices.map(() => null)
  return prices.map((_, i) => {
    if (i < period - 1) return null
    const slice = prices.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function computeEMA(prices: number[], period: number): (number | null)[] {
  if (period <= 0) return prices.map(() => null)
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
  if (period <= 0) return prices.map(() => null)
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

function computeMACD(prices: number[], fast = 12, slow = 26, signalPeriod = 9) {
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
  if (period <= 0) return bars.map(() => null)
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
  if (window <= 0) return prices.map(() => null)
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
  if (period <= 0) return { upper: bars.map(() => null), lower: bars.map(() => null) }
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

const CustomCandlestick = React.memo((props: any) => {
  const { x, y, width, height, payload, showMarkers, darkMode, legId, visibleSignals } = props;
  if (x === undefined || y === undefined || width === undefined || height === undefined || !payload) return null;

  const legOpen = legId ? payload[`open_${legId}`] : undefined;
  const legClose = legId ? payload[`close_${legId}`] : undefined;
  const legHigh = legId ? payload[`high_${legId}`] : undefined;
  const legLow = legId ? payload[`low_${legId}`] : undefined;

  const open = props.open !== undefined ? props.open : (legOpen !== undefined ? legOpen : payload.open);
  const close = props.close !== undefined ? props.close : (legClose !== undefined ? legClose : payload.close);
  const high = props.high !== undefined ? props.high : (legHigh !== undefined ? legHigh : payload.high);
  const low = props.low !== undefined ? props.low : (legLow !== undefined ? legLow : payload.low);

  const isGreen = close >= open;
  const fill = isGreen ? '#10b981' : '#ef4444';

  const cx = x + width / 2;
  const range = high - low;
  const scale = range === 0 ? 0 : height / range;

  const yOpen = y + (high - open) * scale;
  const yClose = y + (high - close) * scale;

  const bodyY = Math.min(yOpen, yClose);
  const bodyHeight = Math.max(1.5, Math.abs(yOpen - yClose));

  const bodyWidth = Math.max(1.5, width > 3 ? width - 1 : width);
  const bodyX = cx - bodyWidth / 2;

  let signalArrows: any[] = [];
  if (showMarkers) {
    let activeSignals: any[] = [];
    if (payload.portfolioSignals && payload.portfolioSignals.length > 0) {
      activeSignals = payload.portfolioSignals.filter((s: any) => {
        if (legId && s.legId !== legId) return false;
        if (visibleSignals && visibleSignals[s.legId] === false) return false;
        return true;
      });
    } else if (legId && (payload[`signal_${legId}`] || payload.signal)) {
      activeSignals = [{
        legId,
        symbol: payload[`signalSymbol_${legId}`] || payload.symbol,
        signal: payload[`signal_${legId}`] || payload.signal,
        signalType: payload[`signalType_${legId}`] || payload.signalType,
        signalReason: payload[`signalReason_${legId}`] || payload.signalReason,
        trade: payload[`trade_${legId}`] || payload.trade
      }];
    } else if (!legId && payload.signal) {
      activeSignals = [{
        signal: payload.signal,
        signalType: payload.signalType,
        signalReason: payload.signalReason,
        trade: payload.trade
      }];
    }

    signalArrows = activeSignals.map((sig: any, idx: number) => {
      const isBuy = sig.signal === 'buy';
      const isEntry = sig.signalType === 'entry';
      const trade = sig.trade;
      const tradeDesc = sig.signalReason
        ? sig.signalReason
        : (trade ? (isEntry ? trade.entryReason : (trade.exitReasonText || (trade.exitReason === 'stop_loss' ? 'Stop Loss Hit' : trade.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Strategy Exit Signal'))) : '');
      const pnlText = (trade && !isEntry && trade.returnPct !== undefined)
        ? ` | Return: ${trade.returnPct >= 0 ? '+' : ''}${trade.returnPct}% ($${trade.pnl >= 0 ? '+' : ''}${trade.pnl})`
        : '';
      const titleText = tradeDesc
        ? `${sig.symbol ? sig.symbol + ' ' : ''}${isBuy ? 'BUY' : 'SELL'} (${isEntry ? 'Entry' : 'Exit'}): ${tradeDesc}${pnlText}`
        : `${sig.symbol ? sig.symbol + ' ' : ''}${isBuy ? 'Buy' : 'Sell'} Signal`;

      if (isBuy) {
        // Tip points UP at bottom of lower candle wick + 5px
        const tipY = y + height + 5 + (idx * 18);
        return (
          <g key={`arrow-buy-${cx}-${y}-${idx}`}>
            <title>{titleText}</title>
            <path
              d={`M ${cx} ${tipY} L ${cx - 5} ${tipY + 9} L ${cx + 5} ${tipY + 9} Z`}
              fill="#10b981"
              stroke={darkMode ? '#0f172a' : '#ffffff'}
              strokeWidth={1}
            />
            {sig.symbol && (
              <text x={cx} y={tipY + 18} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#10b981" style={{ pointerEvents: 'none' }}>
                {sig.symbol}
              </text>
            )}
          </g>
        );
      } else if (sig.signal === 'sell') {
        // Tip points DOWN at top of upper candle wick - 5px
        const tipY = y - 5 - (idx * 18);
        return (
          <g key={`arrow-sell-${cx}-${y}-${idx}`}>
            <title>{titleText}</title>
            <path
              d={`M ${cx} ${tipY} L ${cx - 5} ${tipY - 9} L ${cx + 5} ${tipY - 9} Z`}
              fill="#ef4444"
              stroke={darkMode ? '#0f172a' : '#ffffff'}
              strokeWidth={1}
            />
            {sig.symbol && (
              <text x={cx} y={tipY - 14} textAnchor="middle" fontSize={8} fontWeight="bold" fill="#ef4444" style={{ pointerEvents: 'none' }}>
                {sig.symbol}
              </text>
            )}
          </g>
        );
      }
      return null;
    });
  }

  return (
    <g key={`candle-${cx}-${y}`}>
      <line x1={cx} y1={y} x2={cx} y2={y + height} stroke={fill} strokeWidth={width > 4 ? 1.5 : 1} />
      <rect x={bodyX} y={bodyY} width={bodyWidth} height={bodyHeight} fill={fill} stroke={fill} strokeWidth={0.5} />
      {signalArrows}
    </g>
  );
});

const CustomTooltip = ({ active, payload, darkMode, isPortfolioOverlay = false, portfolioLegs = [], activeLegId, activeLegSymbol }: any) => {
  if (active && payload && payload.length) {
    const rawData = payload[0].payload;
    const bg = darkMode ? '#1e293b' : '#ffffff';
    const border = darkMode ? '#334155' : '#e5e7eb';
    const text = darkMode ? '#e2e8f0' : '#1e293b';
    const textMuted = darkMode ? '#94a3b8' : '#64748b';
    const divBorder = darkMode ? '#334155' : '#f1f5f9';

    const priceData = { ...rawData };
    if (activeLegId) {
      if (rawData[`open_${activeLegId}`] !== undefined) priceData.open = rawData[`open_${activeLegId}`];
      if (rawData[`high_${activeLegId}`] !== undefined) priceData.high = rawData[`high_${activeLegId}`];
      if (rawData[`low_${activeLegId}`] !== undefined) priceData.low = rawData[`low_${activeLegId}`];
      if (rawData[`close_${activeLegId}`] !== undefined) priceData.close = rawData[`close_${activeLegId}`];

      const legSig = rawData[`signal_${activeLegId}`] || rawData.portfolioSignals?.find((s: any) => s.legId === activeLegId)?.signal;
      const legSigType = rawData[`signalType_${activeLegId}`] || rawData.portfolioSignals?.find((s: any) => s.legId === activeLegId)?.signalType;
      const legSigReason = rawData[`signalReason_${activeLegId}`] || rawData.portfolioSignals?.find((s: any) => s.legId === activeLegId)?.signalReason;
      const legTrade = rawData[`trade_${activeLegId}`] || rawData.portfolioSignals?.find((s: any) => s.legId === activeLegId)?.trade;

      if (legSig) {
        priceData.signal = legSig;
        priceData.signalType = legSigType || (legTrade ? 'exit' : 'entry');
        priceData.trade = legTrade;
        priceData.signalSymbol = activeLegSymbol || rawData[`signalSymbol_${activeLegId}`];
        priceData.signalReason = legSigReason || (legTrade ? (legSigType === 'exit' ? (legTrade.exitReasonText || (legTrade.exitReason === 'stop_loss' ? 'Stop Loss Hit' : legTrade.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Strategy Exit Signal')) : legTrade.entryReason) : '');
      } else {
        priceData.signal = undefined;
        priceData.signalType = undefined;
        priceData.trade = undefined;
        priceData.signalReason = undefined;
      }
    }

    return (
      <div style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '11px',
        boxShadow: darkMode ? '0 8px 24px rgba(0,0,0,0.5)' : '0 4px 12px rgba(0,0,0,0.08)',
        color: text,
        minWidth: '190px',
        maxWidth: '340px'
      }}>
        <div style={{ fontWeight: 600, marginBottom: '6px', color: textMuted, borderBottom: `1px solid ${divBorder}`, paddingBottom: '4px' }}>
          {new Date(priceData.time).toLocaleString()}
        </div>

        {isPortfolioOverlay && portfolioLegs && portfolioLegs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '6px', borderBottom: (payload.length > portfolioLegs.length || priceData.signal) ? `1px solid ${divBorder}` : 'none', paddingBottom: (payload.length > portfolioLegs.length || priceData.signal) ? '6px' : '0' }}>
            <div style={{ fontSize: '9.5px', fontWeight: 800, color: textMuted, textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '2px' }}>
              Asset Prices
            </div>
            {portfolioLegs.map((leg: any, idx: number) => {
              const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length];
              const pVal = priceData[`close_${leg.id}`] ?? (idx === 0 ? priceData.close : undefined);
              return (
                <div key={leg.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: legColor, display: 'inline-block' }} />
                    <span style={{ fontWeight: 600, color: text }}>{leg.symbol}</span>
                    <span style={{ fontSize: '9.5px', color: textMuted }}>({leg.allocationPct}%)</span>
                  </div>
                  <span style={{ fontWeight: 700, fontFamily: 'monospace', color: text }}>
                    {typeof pVal === 'number' ? `$${pVal.toFixed(2)}` : '--'}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: '6px', borderBottom: (payload.length > 1 || priceData.signal) ? `1px solid ${divBorder}` : 'none', paddingBottom: (payload.length > 1 || priceData.signal) ? '6px' : '0' }}>
            <div><span style={{ color: textMuted }}>O:</span> ${priceData.open?.toFixed(2)}</div>
            <div><span style={{ color: '#10b981' }}>H:</span> ${priceData.high?.toFixed(2)}</div>
            <div><span style={{ color: '#ef4444' }}>L:</span> ${priceData.low?.toFixed(2)}</div>
            <div><span style={{ color: '#2563eb' }}>C:</span> ${priceData.close?.toFixed(2)}</div>
          </div>
        )}

        {payload.length > 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', borderBottom: (priceData.signal || (isPortfolioOverlay && priceData.portfolioSignals?.length > 0)) ? `1px solid ${divBorder}` : 'none', paddingBottom: (priceData.signal || (isPortfolioOverlay && priceData.portfolioSignals?.length > 0)) ? '6px' : '0' }}>
            {payload.slice(1).map((p: any, idx: number) => {
              if (p.value === null || p.value === undefined || p.name === 'Wick' || p.name === 'Price' || (isPortfolioOverlay && (p.name?.includes('($)') || p.name?.includes('Candles')))) return null;
              return (
                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px' }}>
                  <span style={{ color: p.color || textMuted, fontWeight: 500 }}>{p.name}:</span>
                  <span style={{ fontWeight: 600 }}>{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Educational Why Did The Trade Happen Execution Card for Single / Individual Stock views */}
        {priceData.signal && !isPortfolioOverlay && (
          <div style={{
            marginTop: '6px',
            padding: '7px 9px',
            borderRadius: '6px',
            backgroundColor: priceData.signal === 'buy'
              ? (darkMode ? '#064e3b33' : '#ecfdf5')
              : (darkMode ? '#450a0a33' : '#fef2f2'),
            border: `1px solid ${priceData.signal === 'buy' ? '#10b98155' : '#ef444455'}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 800,
                textTransform: 'uppercase',
                letterSpacing: '0.4px',
                color: priceData.signal === 'buy' ? '#10b981' : '#ef4444'
              }}>
                {priceData.signalSymbol ? `${priceData.signalSymbol} ` : ''}
                {priceData.signalType === 'entry'
                  ? (priceData.signal === 'buy' ? 'Buy / Long Entry' : 'Short Entry')
                  : (priceData.trade?.exitReason === 'stop_loss'
                      ? 'Stop Loss Hit'
                      : priceData.trade?.exitReason === 'take_profit'
                      ? 'Take Profit Hit'
                      : 'Position Exit')}
              </span>
              {priceData.trade && priceData.signalType === 'exit' && (
                <span style={{
                  fontSize: '10px',
                  fontWeight: 800,
                  color: priceData.trade.pnl >= 0 ? '#10b981' : '#ef4444'
                }}>
                  {priceData.trade.returnPct >= 0 ? `+${priceData.trade.returnPct}%` : `${priceData.trade.returnPct}%`}
                </span>
              )}
            </div>

            {priceData.signalReason && (
              <div style={{ fontSize: '10.5px', lineHeight: 1.35, color: text }}>
                <span style={{ fontWeight: 700, color: priceData.signal === 'buy' ? '#10b981' : '#ef4444' }}>Why: </span>
                {priceData.signalReason}
              </div>
            )}

            {priceData.trade && priceData.signalType === 'exit' && (
              <div style={{ fontSize: '9.5px', color: textMuted, marginTop: '1px', display: 'flex', justifyContent: 'space-between' }}>
                <span>Held {priceData.trade.durationBars} bars</span>
                <span style={{ fontWeight: 600, color: priceData.trade.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                  {priceData.trade.pnl >= 0 ? `+$${priceData.trade.pnl}` : `-$${Math.abs(priceData.trade.pnl)}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Portfolio Overlay Multi-Signal Cards */}
        {isPortfolioOverlay && priceData.portfolioSignals && priceData.portfolioSignals.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
            {priceData.portfolioSignals.map((sig: any, sIdx: number) => {
              const isBuy = sig.signal === 'buy';
              const isEntry = sig.signalType === 'entry';
              const trade = sig.trade;
              const cardBg = isBuy ? (darkMode ? '#064e3b33' : '#ecfdf5') : (darkMode ? '#450a0a33' : '#fef2f2');
              const cardBorder = isBuy ? '#10b98155' : '#ef444455';
              const titleColor = isBuy ? '#10b981' : '#ef4444';
              const sigReason = sig.signalReason || (trade ? (isEntry ? trade.entryReason : (trade.exitReasonText || (trade.exitReason === 'stop_loss' ? 'Stop Loss Hit' : trade.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Strategy Exit Signal'))) : '');

              return (
                <div key={sIdx} style={{
                  padding: '7px 9px',
                  borderRadius: '6px',
                  backgroundColor: cardBg,
                  border: `1px solid ${cardBorder}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.4px', color: titleColor }}>
                      {sig.symbol ? `${sig.symbol} ` : ''}
                      {isEntry ? (isBuy ? 'Buy / Long Entry' : 'Short Entry') : (trade?.exitReason === 'stop_loss' ? 'Stop Loss Hit' : trade?.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Position Exit')}
                    </span>
                    {trade && !isEntry && (
                      <span style={{ fontSize: '10px', fontWeight: 800, color: trade.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        {trade.returnPct >= 0 ? `+${trade.returnPct}%` : `${trade.returnPct}%`}
                      </span>
                    )}
                  </div>
                  {sigReason && (
                    <div style={{ fontSize: '10.5px', lineHeight: 1.35, color: text }}>
                      <span style={{ fontWeight: 700, color: titleColor }}>Why: </span>
                      {sigReason}
                    </div>
                  )}
                  {trade && !isEntry && (
                    <div style={{ fontSize: '9.5px', color: textMuted, marginTop: '1px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>Held {trade.durationBars} bars</span>
                      <span style={{ fontWeight: 600, color: trade.pnl >= 0 ? '#10b981' : '#ef4444' }}>
                        {trade.pnl >= 0 ? `+$${trade.pnl}` : `-$${Math.abs(trade.pnl)}`}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }
  return null;
};

function ClickAwayWrapper({
  isOpen,
  onClose,
  children,
  style
}: {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest && target.closest('[data-color-picker-portal]')) {
        return
      }
      if (containerRef.current && e.target instanceof Node && !containerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('touchstart', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('touchstart', handleDocumentClick)
    }
  }, [isOpen, onClose])

  return (
    <div ref={containerRef} style={style}>
      {children}
    </div>
  )
}

function PortalPopover({
  isOpen,
  onClose,
  trigger,
  children,
  width = 240,
  darkMode = false
}: {
  isOpen: boolean
  onClose: () => void
  trigger: React.ReactNode
  children: React.ReactNode
  width?: number | string
  darkMode?: boolean
}) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    const updatePos = () => {
      if (triggerRef.current) {
        const rect = triggerRef.current.getBoundingClientRect()
        const popupW = typeof width === 'number' ? width : 240
        const left = Math.min(rect.left, window.innerWidth - popupW - 14)
        setCoords({ top: rect.bottom + 6, left: Math.max(10, left) })
      }
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [isOpen, width])

  useEffect(() => {
    if (!isOpen) return
    const handleDocClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as HTMLElement | null
      if (target && target.closest && target.closest('[data-color-picker-portal]')) {
        return
      }
      if (
        triggerRef.current &&
        popupRef.current &&
        !triggerRef.current.contains(e.target as Node) &&
        !popupRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleDocClick)
    document.addEventListener('touchstart', handleDocClick)
    return () => {
      document.removeEventListener('mousedown', handleDocClick)
      document.removeEventListener('touchstart', handleDocClick)
    }
  }, [isOpen, onClose])

  return (
    <div ref={triggerRef} style={{ display: 'inline-flex', flexShrink: 0 }}>
      {trigger}
      {isOpen && mounted && coords && createPortal(
        <div
          ref={popupRef}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            width,
            zIndex: 9999,
            backgroundColor: darkMode ? '#1e293b' : '#ffffff',
            border: `1px solid ${darkMode ? '#334155' : '#e2e8f0'}`,
            borderRadius: 8,
            padding: '10px 12px',
            boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.12)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8
          }}
        >
          {children}
        </div>,
        document.body
      )}
    </div>
  )
}

const LEG_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#a855f7']

function SegmentedSlider({
  options,
  value,
  onChange,
  darkMode,
  size = 'sm'
}: {
  options: Array<{ value: string; label: string; color?: string; badgeColor?: string }>
  value: string
  onChange: (val: string) => void
  darkMode: boolean
  size?: 'sm' | 'xs'
}) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: darkMode ? '#0f172a' : '#f1f5f9',
        border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
        borderRadius: 20,
        padding: '2px',
        gap: '2px',
        userSelect: 'none'
      }}
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        return (
          <button
            key={opt.value}
            onClick={(e) => {
              e.stopPropagation()
              onChange(opt.value)
            }}
            style={{
              padding: size === 'xs' ? '2px 8px' : '3px 10px',
              fontSize: size === 'xs' ? '10px' : '11px',
              fontWeight: isActive ? 800 : 600,
              borderRadius: 16,
              border: 'none',
              backgroundColor: isActive
                ? (opt.color || '#2563eb')
                : 'transparent',
              color: isActive ? '#ffffff' : (darkMode ? '#94a3b8' : '#64748b'),
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.25)' : 'none'
            }}
          >
            {opt.badgeColor && (
              <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: isActive ? '#fff' : opt.badgeColor }} />
            )}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

export default function QuantLabPage() {
  const [symbol, setSymbol] = useState('SPY')
  const [timeframe, setTimeframe] = useState('1Day')
  const [lookback, setLookback] = useState('6M')
  const [strategy, setStrategy] = useState('')
  const [params, setParams] = useState<Record<string, number>>({})
  const [result, setResult] = useState<BacktestResult | null>(null)
  const [indicators, setIndicators] = useState<any>(null)
  const [chartData, setChartData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [dataCount, setDataCount] = useState(0)
  const [configCollapsed, setConfigCollapsed] = useState(false)
  const [userExpanded, setUserExpanded] = useState(false)
  const [showMarkers, setShowMarkers] = useState(true)

  const [showRibbon, setShowRibbon] = useState(true)
  const [ribbonLines, setRibbonLines] = useState<Array<{ id: number; type: 'SMA' | 'EMA'; period: number; color?: string }>>([
    { id: 1, type: 'SMA', period: 10 },
    { id: 2, type: 'SMA', period: 20 },
    { id: 3, type: 'SMA', period: 30 },
    { id: 4, type: 'SMA', period: 50 }
  ])
  const DEFAULT_RIBBON_COLORS = ['#f59e0b', '#06b6d4', '#8b5cf6', '#ec4899', '#f43f5e', '#10b981', '#3b82f6', '#eab308', '#6366f1', '#14b8a6']
  const DEFAULT_INDICATOR_COLORS: Record<string, string> = {
    bb: '#94a3b8',
    rsi: '#ef4444',
    macd: '#2563eb',
    macdSignal: '#f59e0b',
    donchian: '#8b5cf6',
    atr: '#8b5cf6',
    ichiTenkan: '#3b82f6',
    ichiKijun: '#ef4444',
    ichiSenkouA: '#10b981',
    ichiSenkouB: '#f43f5e',
    zscore: '#2563eb',
  }
  const [indicatorColors, setIndicatorColors] = useState<Record<string, string>>({})
  const [backtestAnimKey, setBacktestAnimKey] = useState<number>(0)
  const [isBacktestAnimating, setIsBacktestAnimating] = useState<boolean>(false)
  const animTimerRef = useRef<NodeJS.Timeout | null>(null)
  const [chartColumnHeight, setChartColumnHeight] = useState<number | undefined>(undefined)

  const triggerBacktestAnimation = useCallback(() => {
    setBacktestAnimKey(k => k + 1)
    setIsBacktestAnimating(true)
    if (animTimerRef.current) clearTimeout(animTimerRef.current)
    animTimerRef.current = setTimeout(() => {
      setIsBacktestAnimating(false)
    }, 1150)
  }, [])
  const [chartType, setChartType] = useState<'line' | 'candles'>('line')
  const [showPnL, setShowPnL] = useState(true)
  const [showPrice, setShowPrice] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showAdvancedMetrics, setShowAdvancedMetrics] = useState(false)
  const [evalOpen, setEvalOpen] = useState(false)
  const [zoomRange, setZoomRange] = useState<{ start: number; end: number } | null>(null)
  const isDraggingPan = useRef(false)
  const panStartX = useRef(0)
  const panStartRange = useRef<{ start: number; end: number } | null>(null)
  const [isPanningActive, setIsPanningActive] = useState(false)

  const [savedStrategies, setSavedStrategies] = useState<SavedStrategy[]>([])
  const [savedSortKey, setSavedSortKey] = useState('timestamp')
  const [saveModalOpen, setSaveModalOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [maxPositionSize, setMaxPositionSize] = useState<number>(1)
  const [stopLoss, setStopLoss] = useState<number>(0)
  const [takeProfit, setTakeProfit] = useState<number>(0)
  const [slippageBps, setSlippageBps] = useState<number>(0)
  const [commission, setCommission] = useState<number>(0)

  const [backtestMode, setBacktestMode] = useState<'single' | 'multi' | 'portfolio' | 'saved'>('single')
  const [portfolioLegs, setPortfolioLegs] = useState<PortfolioLeg[]>([
    { id: 'leg_1', symbol: 'SPY', allocationPct: 50, strategy: 'sma_crossover', params: { fast: 10, slow: 30 } },
    { id: 'leg_2', symbol: 'QQQ', allocationPct: 50, strategy: 'macd_crossover', params: { fast: 12, slow: 26, signal: 9 } }
  ])
  const [selectedLeg, setSelectedLeg] = useState<string>('portfolio')
  const [entryOperator, setEntryOperator] = useState<'AND' | 'OR'>('AND')
  const [entryRules, setEntryRules] = useState<StrategyRule[]>([
    { id: 'entry_1', strategy: 'sma_crossover', params: { fast: 10, slow: 30 } }
  ])
  const [exitOperator, setExitOperator] = useState<'AND' | 'OR'>('OR')
  const [exitRules, setExitRules] = useState<StrategyRule[]>([
    { id: 'exit_1', strategy: 'mean_reversion_rsi', params: { period: 14, overbought: 70, oversold: 30 } }
  ])

  // Multi-Asset Portfolio controls & indicator instances
  const [priceActionViewMode, setPriceActionViewMode] = useState<string>('overlay') // 'overlay' | leg.id
  const [pricePanels, setPricePanels] = useState<Array<{ id: string; viewMode: string }>>([
    { id: 'price', viewMode: 'overlay' }
  ])
  const [pnlSliderMode, setPnlSliderMode] = useState<string>('overlay') // 'overlay' | leg.id
  const [pnlLinesOpen, setPnlLinesOpen] = useState(false)
  const [signalDropdownOpen, setSignalDropdownOpen] = useState(false)
  const [visiblePnLLines, setVisiblePnLLines] = useState<Record<string, boolean>>({ overall: true })
  const [visibleSignals, setVisibleSignals] = useState<Record<string, boolean>>({})
  const [lotsSliderMode, setLotsSliderMode] = useState<string>('overlay') // 'overlay' | leg.id
  const [rsiPanels, setRsiPanels] = useState<Array<{ id: string; legId: string; period: number; overbought: number; oversold: number }>>([
    { id: 'rsi_1', legId: 'leg_1', period: 14, overbought: 70, oversold: 30 }
  ])
  const [macdLegId, setMacdLegId] = useState<string>('leg_1')
  const [atrLegId, setAtrLegId] = useState<string>('leg_1')
  const [zScoreLegId, setZScoreLegId] = useState<string>('leg_1')

  const handleAddPricePanel = () => {
    if (pricePanels.length >= portfolioLegs.length) return
    const unusedLeg = portfolioLegs.find(l => !pricePanels.some(p => p.viewMode === l.id)) || portfolioLegs[pricePanels.length % portfolioLegs.length]
    const newId = `price_panel_${Date.now()}`
    const newPanel = { id: newId, viewMode: unusedLeg.id }
    setPricePanels(prev => [...prev, newPanel])
    setPanelOrder(prev => {
      const lastPriceIdx = Math.max(...prev.map((id, idx) => (id === 'price' || id.startsWith('price_panel_')) ? idx : -1))
      const next = [...prev]
      if (lastPriceIdx >= 0) {
        next.splice(lastPriceIdx + 1, 0, newId)
      } else {
        next.unshift(newId)
      }
      return next
    })
  }

  const handleRemovePricePanel = (panelId: string) => {
    if (pricePanels.length <= 1) return
    setPricePanels(prev => prev.filter(p => p.id !== panelId))
    setPanelOrder(prev => prev.filter(id => id !== panelId))
  }

  const handleUpdatePricePanelViewMode = (panelId: string, newMode: string) => {
    setPricePanels(prev => prev.map(p => p.id === panelId ? { ...p, viewMode: newMode } : p))
    if (panelId === 'price') {
      setPriceActionViewMode(newMode)
    }
  }

  // Keep visiblePnLLines and visibleSignals synced when legs change
  useEffect(() => {
    setVisiblePnLLines(prev => {
      const updated = { ...prev }
      if (updated.overall === undefined) updated.overall = true
      portfolioLegs.forEach(leg => {
        if (updated[leg.id] === undefined) updated[leg.id] = true
      })
      return updated
    })
    setVisibleSignals(prev => {
      const updated = { ...prev }
      portfolioLegs.forEach(leg => {
        if (updated[leg.id] === undefined) updated[leg.id] = true
      })
      return updated
    })
  }, [portfolioLegs])

  // Keep technical indicator and price panel legs synced when portfolio legs change
  useEffect(() => {
    if (backtestMode === 'portfolio' && portfolioLegs.length > 0) {
      setPricePanels(prev => {
        return prev.map(p => {
          if (p.viewMode !== 'overlay' && !portfolioLegs.some(l => l.id === p.viewMode)) {
            return { ...p, viewMode: portfolioLegs[0].id }
          }
          return p
        })
      })
      setRsiPanels(prev => {
        const valid = prev.filter(p => portfolioLegs.some(l => l.id === p.legId))
        if (valid.length === 0) {
          return [{ id: 'rsi_1', legId: portfolioLegs[0].id, period: 14, overbought: 70, oversold: 30 }]
        }
        return valid
      })
      if (!portfolioLegs.some(l => l.id === macdLegId)) {
        setMacdLegId(portfolioLegs[0].id)
      }
      if (!portfolioLegs.some(l => l.id === atrLegId)) {
        setAtrLegId(portfolioLegs[0].id)
      }
      if (!portfolioLegs.some(l => l.id === zScoreLegId)) {
        setZScoreLegId(portfolioLegs[0].id)
      }
    }
  }, [portfolioLegs, backtestMode, macdLegId, atrLegId, zScoreLegId])

  const handleAddRsiPanel = () => {
    if (rsiPanels.length >= portfolioLegs.length) return
    const unusedLeg = portfolioLegs.find(l => !rsiPanels.some(p => p.legId === l.id)) || portfolioLegs[0]
    setRsiPanels(prev => [
      ...prev,
      {
        id: `rsi_${Date.now()}`,
        legId: unusedLeg.id,
        period: 14,
        overbought: 70,
        oversold: 30
      }
    ])
  }

  const handleRemoveRsiPanel = (id: string) => {
    if (rsiPanels.length <= 1) return
    setRsiPanels(prev => prev.filter(p => p.id !== id))
  }

  const priceSliderOptions = useMemo(() => {
    if (backtestMode !== 'portfolio') return []
    return [
      { value: 'overlay', label: 'Overlay (Multi-Axis)' },
      ...portfolioLegs.map((leg, idx) => ({
        value: leg.id,
        label: leg.symbol,
        color: LEG_COLORS[idx % LEG_COLORS.length]
      }))
    ]
  }, [backtestMode, portfolioLegs])

  const pnlSliderOptions = useMemo(() => {
    if (backtestMode !== 'portfolio') return []
    return [
      { value: 'overlay', label: 'All PnL (Overlay)' },
      { value: 'overall', label: 'Overall Portfolio' },
      ...portfolioLegs.map((leg, idx) => ({
        value: leg.id,
        label: leg.symbol,
        color: LEG_COLORS[idx % LEG_COLORS.length]
      }))
    ]
  }, [backtestMode, portfolioLegs])

  const lotsSliderOptions = useMemo(() => {
    if (backtestMode !== 'portfolio') return []
    return [
      { value: 'overlay', label: 'Overlay (All Assets)' },
      { value: 'overall', label: 'Net Portfolio' },
      ...portfolioLegs.map((leg, idx) => ({
        value: leg.id,
        label: leg.symbol,
        color: LEG_COLORS[idx % LEG_COLORS.length]
      }))
    ]
  }, [backtestMode, portfolioLegs])

  // Load saved strategies from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('quantlab_saved_strategies')
      if (raw) setSavedStrategies(JSON.parse(raw))
    } catch (e) { console.error('Failed to load saved strategies', e) }
  }, [])

  // Persist saved strategies to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('quantlab_saved_strategies', JSON.stringify(savedStrategies))
    } catch (e) { console.error('Failed to save strategies', e) }
  }, [savedStrategies])

  const handleSaveStrategy = () => {
    if (!result || !saveName.trim()) return
    const saved: SavedStrategy = {
      id: `saved_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: saveName.trim(),
      timestamp: Date.now(),
      mode: backtestMode === 'multi' ? 'multi' : (backtestMode === 'portfolio' ? 'portfolio' : 'single'),
      symbol: backtestMode === 'portfolio' ? portfolioLegs.map(l => l.symbol).join(', ') : symbol,
      timeframe, lookback,
      strategy: backtestMode === 'single' ? strategy : undefined,
      params: {
        ...(backtestMode === 'single' ? params : {}),
        maxPositionSize,
        stopLoss,
        takeProfit,
        slippageBps,
        commission
      },
      entryRules: backtestMode === 'multi' ? entryRules : undefined,
      exitRules: backtestMode === 'multi' ? exitRules : undefined,
      entryOperator: backtestMode === 'multi' ? entryOperator : undefined,
      exitOperator: backtestMode === 'multi' ? exitOperator : undefined,
      portfolioLegs: backtestMode === 'portfolio' ? portfolioLegs.map(l => ({ ...l, params: { ...(l.params || {}) } })) : undefined,
      pricePanels: backtestMode === 'portfolio' ? [...pricePanels] : undefined,
      result: { ...result }
    }
    setSavedStrategies(prev => [saved, ...prev])
    setSaveModalOpen(false)
    setSaveName('')
  }

  const handleDeleteSaved = (id: string) => {
    setSavedStrategies(prev => prev.filter(s => s.id !== id))
  }

  // Dark mode theme
  const th = darkMode ? {
    bg: '#0f172a', bgCard: '#1e293b', bgAlt: '#1a2332',
    border: '#334155', text: '#e2e8f0', textSec: '#94a3b8', textMuted: '#64748b',
    shadow: 'rgba(0,0,0,0.3)', inputBg: '#1e293b', inputBorder: '#475569'
  } : {
    bg: '#f9fafb', bgCard: '#ffffff', bgAlt: '#f8fafc',
    border: '#e5e7eb', text: '#2b2f43', textSec: '#475569', textMuted: '#94a3b8',
    shadow: 'rgba(0,0,0,0.02)', inputBg: '#fff', inputBorder: '#cbd5e1'
  }

  useEffect(() => {
    document.documentElement.style.backgroundColor = th.bg
    document.body.style.backgroundColor = th.bg
    document.body.style.color = th.text
  }, [th.bg, th.text])
  const [showBb, setShowBb] = useState(false)
  const [showRsi, setShowRsi] = useState(false)
  const [showMacd, setShowMacd] = useState(false)
  const [rsiPeriod, setRsiPeriod] = useState<number>(14)
  const [rsiOverbought, setRsiOverbought] = useState<number>(70)
  const [rsiOversold, setRsiOversold] = useState<number>(30)
  const [bbPeriod, setBbPeriod] = useState<number>(20)
  const [bbStdDev, setBbStdDev] = useState<number>(2.0)
  const [macdFast, setMacdFast] = useState<number>(12)
  const [macdSlow, setMacdSlow] = useState<number>(26)
  const [macdSignal, setMacdSignal] = useState<number>(9)
  const [showVwap, setShowVwap] = useState(false)
  const [showDonchian, setShowDonchian] = useState(false)
  const [donchianPeriod, setDonchianPeriod] = useState<number>(20)
  const [showAtr, setShowAtr] = useState(false)
  const [atrPeriod, setAtrPeriod] = useState<number>(14)
  const [showIchimoku, setShowIchimoku] = useState(false)
  const [ichiTenkan, setIchiTenkan] = useState<number>(9)
  const [ichiKijun, setIchiKijun] = useState<number>(26)
  const [ichiSenkou, setIchiSenkou] = useState<number>(52)
  const [showZScore, setShowZScore] = useState(false)
  const [zScoreWindow, setZScoreWindow] = useState<number>(20)

  const [indicatorDropdownOpen, setIndicatorDropdownOpen] = useState(false)
  const [ribbonOpen, setRibbonOpen] = useState(false)
  const [bbOpen, setBbOpen] = useState(false)
  const [rsiOpen, setRsiOpen] = useState(false)
  const [macdOpen, setMacdOpen] = useState(false)
  const [donchianOpen, setDonchianOpen] = useState(false)
  const [atrOpen, setAtrOpen] = useState(false)
  const [ichiOpen, setIchiOpen] = useState(false)
  const [zScoreOpen, setZScoreOpen] = useState(false)

  const [panelOrder, setPanelOrder] = useState<string[]>(['price', 'rsi', 'macd', 'atr', 'zscore', 'pnl', 'lots'])
  const [activeDragIndex, setActiveDragIndex] = useState<number | null>(null)
  const [isDropping, setIsDropping] = useState(false)
  const dragInfoRef = useRef<{
    activeIndex: number
    targetIndex: number
    startY: number
    draggedHeight: number
    panelMidpoints: { index: number; midY: number }[]
    animFrameId: number | null
    latestClientY: number
  } | null>(null)
  const dropTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const panelRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const [isInteracting, setIsInteracting] = useState(false)
  const interactionTimerRef = useRef<NodeJS.Timeout | null>(null)

  const triggerInteraction = useCallback(() => {
    setIsInteracting(true)
    if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current)
    interactionTimerRef.current = setTimeout(() => {
      setIsInteracting(false)
    }, 180)
  }, [])

  const handleAddRibbonLine = () => {
    setRibbonLines(prev => {
      if (prev.length >= 10) return prev
      const nextId = prev.length > 0 ? Math.max(...prev.map(l => l.id)) + 1 : 1
      return [...prev, { id: nextId, type: 'SMA', period: 20 }]
    })
  }

  const handleRemoveRibbonLine = (id: number) => {
    setRibbonLines(prev => prev.filter(l => l.id !== id))
  }

  const handleUpdateRibbonLine = (id: number, fields: Partial<{ type: 'SMA' | 'EMA'; period: number; color?: string }>) => {
    setRibbonLines(prev => prev.map(l => l.id === id ? { ...l, ...fields } : l))
  }

  const handleDragHandlePointerDown = (e: React.PointerEvent, pIdx: number) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()

    if (dropTimeoutRef.current) {
      clearTimeout(dropTimeoutRef.current)
      dropTimeoutRef.current = null
    }

    // Reset any lingering inline transforms
    Object.values(panelRefs.current).forEach(el => {
      if (el) {
        el.style.transform = ''
        el.style.transition = ''
      }
    })

    setIsDropping(false)

    const midpoints: { index: number; midY: number }[] = []
    let draggedHeight = 150

    Object.keys(panelRefs.current).forEach(k => {
      const idx = Number(k)
      const el = panelRefs.current[idx]
      if (el && document.body.contains(el)) {
        const rect = el.getBoundingClientRect()
        midpoints.push({ index: idx, midY: rect.top + rect.height / 2 })
        if (idx === pIdx) {
          draggedHeight = rect.height
        }
      }
    })

    midpoints.sort((a, b) => a.index - b.index)

    dragInfoRef.current = {
      activeIndex: pIdx,
      targetIndex: pIdx,
      startY: e.clientY,
      draggedHeight,
      panelMidpoints: midpoints,
      animFrameId: null,
      latestClientY: e.clientY
    }

    setActiveDragIndex(pIdx)

    const prevUserSelect = document.body.style.userSelect
    const prevCursor = document.body.style.cursor
    document.body.style.userSelect = 'none'
    document.body.style.cursor = 'grabbing'

    const targetEl = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    try {
      targetEl.setPointerCapture(pointerId)
    } catch (_) {}

    const updateDragFrame = () => {
      if (!dragInfoRef.current) return
      dragInfoRef.current.animFrameId = null

      const { activeIndex, startY, draggedHeight, panelMidpoints, latestClientY } = dragInfoRef.current
      const deltaY = latestClientY - startY

      // Directly update the lifted panel via hardware-accelerated 3D transform (0ms CPU / React overhead)
      const liftedEl = panelRefs.current[activeIndex]
      if (liftedEl) {
        liftedEl.style.transform = `translate3d(0, ${deltaY}px, 0) scale(1.012)`
      }

      // Determine target slot from midpoints
      let target = activeIndex
      let minDiff = Infinity
      for (const p of panelMidpoints) {
        const diff = Math.abs(latestClientY - p.midY)
        if (diff < minDiff) {
          minDiff = diff
          target = p.index
        }
      }

      // When crossing a slot boundary, slide displaced panels smoothly via CSS transition on GPU
      if (target !== dragInfoRef.current.targetIndex) {
        dragInfoRef.current.targetIndex = target
        const shift = draggedHeight + 8

        Object.keys(panelRefs.current).forEach(k => {
          const idx = Number(k)
          if (idx === activeIndex) return
          const el = panelRefs.current[idx]
          if (!el) return

          let translateY = 0
          if (target > activeIndex) {
            if (idx > activeIndex && idx <= target) {
              translateY = -shift
            }
          } else if (target < activeIndex) {
            if (idx >= target && idx < activeIndex) {
              translateY = shift
            }
          }

          el.style.transform = translateY !== 0 ? `translate3d(0, ${translateY}px, 0)` : 'none'
          el.style.transition = 'transform 0.28s cubic-bezier(0.2, 0, 0, 1)'
        })
      }
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!dragInfoRef.current) return
      dragInfoRef.current.latestClientY = ev.clientY

      if (dragInfoRef.current.animFrameId === null) {
        dragInfoRef.current.animFrameId = requestAnimationFrame(updateDragFrame)
      }
    }

    const onPointerUp = () => {
      if (dragInfoRef.current?.animFrameId) {
        cancelAnimationFrame(dragInfoRef.current.animFrameId)
        dragInfoRef.current.animFrameId = null
      }

      try {
        if (targetEl && targetEl.hasPointerCapture(pointerId)) {
          targetEl.releasePointerCapture(pointerId)
        }
      } catch (_) {}

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('pointercancel', onPointerUp)
      document.body.style.userSelect = prevUserSelect
      document.body.style.cursor = prevCursor

      if (!dragInfoRef.current) {
        setActiveDragIndex(null)
        return
      }

      const { activeIndex, targetIndex, startY, latestClientY } = dragInfoRef.current
      const deltaY = latestClientY - startY

      if (activeIndex !== targetIndex) {
        // Reordering to new slot:
        // Clear all inline transforms so React DOM update takes over cleanly
        Object.values(panelRefs.current).forEach(el => {
          if (el) {
            el.style.transform = ''
            el.style.transition = ''
          }
        })

        setIsDropping(true)
        setPanelOrder(prev => {
          const next = [...prev]
          const [removed] = next.splice(activeIndex, 1)
          next.splice(targetIndex, 0, removed)
          return next
        })
        setActiveDragIndex(null)
        dragInfoRef.current = null

        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            setIsDropping(false)
          })
        })
      } else {
        // Released in same slot: smoothly glide back if moved
        const liftedEl = panelRefs.current[activeIndex]
        if (liftedEl && Math.abs(deltaY) > 2) {
          liftedEl.style.transition = 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)'
          liftedEl.style.transform = 'translate3d(0, 0, 0) scale(1)'

          dropTimeoutRef.current = setTimeout(() => {
            Object.values(panelRefs.current).forEach(el => {
              if (el) {
                el.style.transform = ''
                el.style.transition = ''
              }
            })
            setActiveDragIndex(null)
            dragInfoRef.current = null
          }, 220)
        } else {
          Object.values(panelRefs.current).forEach(el => {
            if (el) {
              el.style.transform = ''
              el.style.transition = ''
            }
          })
          setActiveDragIndex(null)
          dragInfoRef.current = null
        }
      }
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('pointerup', onPointerUp)
    window.addEventListener('pointercancel', onPointerUp)
  }

  const getDraggablePanelProps = (pIdx: number, extraMarginTop = false) => {
    const isLifted = activeDragIndex === pIdx
    const disableTransition = isLifted || isDropping

    return {
      ref: (el: HTMLDivElement | null) => {
        panelRefs.current[pIdx] = el
      },
      className: `chart-gpu-accelerated`,
      style: {
        display: 'flex',
        gap: '8px',
        alignItems: 'stretch',
        padding: '10px 12px',
        borderRadius: '10px',
        marginTop: extraMarginTop ? '8px' : '0',
        border: isLifted ? '2px dashed #2563eb' : `1px solid ${th.border}`,
        backgroundColor: isLifted
          ? (darkMode ? 'rgba(30, 41, 59, 0.75)' : 'rgba(255, 255, 255, 0.82)')
          : th.bgCard,
        boxShadow: isLifted
          ? (darkMode ? '0 25px 50px -10px rgba(0,0,0,0.85), 0 0 0 2px #2563eb' : '0 20px 40px -10px rgba(37,99,235,0.35), 0 0 0 2px #2563eb')
          : 'none',
        opacity: isLifted ? 0.75 : 1,
        transform: isLifted ? 'translate3d(0, 0, 0) scale(1.012)' : 'none',
        backdropFilter: isLifted ? 'blur(8px)' : 'none',
        WebkitBackdropFilter: isLifted ? 'blur(8px)' : 'none',
        zIndex: isLifted ? 9999 : 1,
        position: 'relative' as const,
        pointerEvents: (isLifted ? 'none' : 'auto') as any,
        willChange: activeDragIndex !== null ? 'transform' : 'auto',
        transition: disableTransition
          ? 'none'
          : 'transform 0.28s cubic-bezier(0.2, 0, 0, 1), box-shadow 0.2s ease, border-color 0.2s ease'
      }
    }
  }

  const renderDragHandle = (pIdx: number) => {
    const isDraggingThis = activeDragIndex === pIdx
    return (
      <div
        onPointerDown={(e) => handleDragHandlePointerDown(e, pIdx)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: isDraggingThis ? 'grabbing' : 'grab',
          width: '22px',
          color: isDraggingThis ? '#2563eb' : th.textMuted,
          borderRadius: '4px',
          touchAction: 'none',
          userSelect: 'none',
          transition: 'color 0.15s, background-color 0.15s'
        }}
        title="Drag handle to reorder window"
      >
        <GripVertical size={16} />
      </div>
    )
  }

  const renderDotCustom = useCallback((props: any, filterLegId?: string) => {
    const { cx, cy, payload } = props;
    if (!payload || !showMarkers) return null;

    if (payload.portfolioSignals && payload.portfolioSignals.length > 0) {
      const activeSignals = payload.portfolioSignals.filter((sig: any) => {
        if (visibleSignals[sig.legId] === false) return false
        if (filterLegId && sig.legId !== filterLegId) return false
        return true
      })
      if (activeSignals.length === 0) return null;

      return (
        <g key={`dot-port-${cx}-${cy}-${filterLegId || 'all'}`}>
          {activeSignals.map((sigObj: any, idx: number) => {
            const isBuy = sigObj.signal === 'buy';
            const isEntry = sigObj.signalType === 'entry';
            const trade = sigObj.trade;
            const tradeDesc = sigObj.signalReason 
              ? sigObj.signalReason 
              : (trade ? (isEntry ? trade.entryReason : (trade.exitReasonText || (trade.exitReason === 'stop_loss' ? 'Stop Loss Hit' : trade.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Strategy Exit Signal'))) : '');
            const pnlText = (trade && !isEntry && trade.returnPct !== undefined)
              ? ` | Return: ${trade.returnPct >= 0 ? '+' : ''}${trade.returnPct}% ($${trade.pnl >= 0 ? '+' : ''}${trade.pnl})`
              : '';
            const titleText = tradeDesc 
              ? `${sigObj.symbol ? sigObj.symbol + ' ' : ''}${isBuy ? 'BUY' : 'SELL'} (${isEntry ? 'Entry' : 'Exit'}): ${tradeDesc}${pnlText}`
              : `${sigObj.symbol ? sigObj.symbol + ' ' : ''}${isBuy ? 'Buy' : 'Sell'} Signal`;
            
            const tipY = isBuy ? cy + 6 + (idx * 16) : cy - 6 - (idx * 16);
            const fill = isBuy ? '#10b981' : '#ef4444';
            
            return (
              <g key={`sig-${idx}`}>
                <title>{titleText}</title>
                {isBuy ? (
                  <path d={`M ${cx} ${tipY} L ${cx - 4} ${tipY + 7} L ${cx + 4} ${tipY + 7} Z`} fill={fill} stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={0.5} />
                ) : (
                  <path d={`M ${cx} ${tipY} L ${cx - 4} ${tipY - 7} L ${cx + 4} ${tipY - 7} Z`} fill={fill} stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={0.5} />
                )}
                <text x={cx} y={isBuy ? tipY + 16 : tipY - 12} textAnchor="middle" fontSize={8} fontWeight="bold" fill={fill} style={{ pointerEvents: 'none' }}>
                  {sigObj.symbol}
                </text>
              </g>
            )
          })}
        </g>
      )
    }

    if (filterLegId && payload[`signal_${filterLegId}`]) {
      const isBuy = payload[`signal_${filterLegId}`] === 'buy';
      const isEntry = payload[`signalType_${filterLegId}`] === 'entry';
      const trade = payload[`trade_${filterLegId}`];
      const tradeDesc = payload[`signalReason_${filterLegId}`] || (trade ? (isEntry ? trade.entryReason : (trade.exitReasonText || (trade.exitReason === 'stop_loss' ? 'Stop Loss Hit' : trade.exitReason === 'take_profit' ? 'Take Profit Hit' : 'Strategy Exit Signal'))) : '');
      const pnlText = (trade && !isEntry && trade.returnPct !== undefined)
        ? ` | Return: ${trade.returnPct >= 0 ? '+' : ''}${trade.returnPct}% ($${trade.pnl >= 0 ? '+' : ''}${trade.pnl})`
        : '';
      const sym = payload[`signalSymbol_${filterLegId}`] || '';
      const titleText = tradeDesc
        ? `${sym ? sym + ' ' : ''}${isBuy ? 'BUY' : 'SELL'} (${isEntry ? 'Entry' : 'Exit'}): ${tradeDesc}${pnlText}`
        : `${sym ? sym + ' ' : ''}${isBuy ? 'Buy' : 'Sell'} Signal`;

      const tipY = isBuy ? cy + 6 : cy - 6;
      const fill = isBuy ? '#10b981' : '#ef4444';
      return (
        <g key={`dot-leg-${filterLegId}-${cx}-${cy}`}>
          <title>{titleText}</title>
          {isBuy ? (
            <path d={`M ${cx} ${tipY} L ${cx - 5} ${tipY + 9} L ${cx + 5} ${tipY + 9} Z`} fill={fill} stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={1} />
          ) : (
            <path d={`M ${cx} ${tipY} L ${cx - 5} ${tipY - 9} L ${cx + 5} ${tipY - 9} Z`} fill={fill} stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={1} />
          )}
        </g>
      );
    }

    if (filterLegId) return null;

    if (!payload.signal) return null;

    const isBuy = payload.signal === 'buy';
    const isEntry = payload.signalType === 'entry';
    const titleText = payload.signalReason 
      ? `${isBuy ? 'BUY' : 'SELL'} (${isEntry ? 'Entry' : 'Exit'}): ${payload.signalReason}`
      : `${isBuy ? 'Buy' : 'Sell'} Signal`;

    if (isBuy) {
      const tipY = cy + 6;
      return (
        <g key={`dot-buy-${cx}-${cy}`}>
          <title>{titleText}</title>
          <path d={`M ${cx} ${tipY} L ${cx - 5} ${tipY + 9} L ${cx + 5} ${tipY + 9} Z`} fill="#10b981" stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={1} />
        </g>
      );
    } else if (payload.signal === 'sell') {
      const tipY = cy - 6;
      return (
        <g key={`dot-sell-${cx}-${cy}`}>
          <title>{titleText}</title>
          <path d={`M ${cx} ${tipY} L ${cx - 5} ${tipY - 9} L ${cx + 5} ${tipY - 9} Z`} fill="#ef4444" stroke={darkMode ? '#0f172a' : '#ffffff'} strokeWidth={1} />
        </g>
      );
    }
    return null;
  }, [showMarkers, visibleSignals, darkMode]);

  const renderDot = useCallback((props: any) => renderDotCustom(props), [renderDotCustom]);

  const legDotRenderers = useMemo(() => {
    const map: Record<string, (props: any) => any> = {}
    portfolioLegs.forEach(leg => {
      map[leg.id] = (props: any) => renderDotCustom(props, leg.id)
    })
    return map
  }, [portfolioLegs, renderDotCustom])

  const renderPnLDot = useCallback((props: any, filterLegId?: string) => renderDotCustom(props, filterLegId), [renderDotCustom]);

  const handleToggleCollapse = () => {
    const next = !configCollapsed
    setConfigCollapsed(next)
    if (!next) setUserExpanded(true)
  }

  const handleSyncChartParams = () => {
    if (backtestMode === 'single') {
      if (!strategy) return

      // Clean up strategy params so only defined parameters for this strategy remain
      const stratObj = STRATEGIES.find(s => s.id === strategy)
      if (stratObj) {
        setParams(prev => {
          const cleaned: Record<string, number> = {}
          Object.keys(stratObj.params).forEach(k => {
            cleaned[k] = prev[k] !== undefined ? prev[k] : stratObj.params[k]
          })
          return cleaned
        })
      }

      // Hide all old unused indicators from previous strategies
      setShowRibbon(false)
      setShowBb(false)
      setShowRsi(false)
      setShowMacd(false)
      setShowVwap(false)
      setShowDonchian(false)
      setShowAtr(false)
      setShowIchimoku(false)
      setShowZScore(false)

      if (strategy === 'sma_crossover') {
        const fast = params.fast || 10
        const slow = params.slow || 30
        setRibbonLines([
          { id: 1, type: 'SMA', period: fast },
          { id: 2, type: 'SMA', period: slow }
        ])
        setShowRibbon(true)
      } else if (strategy === 'mean_reversion_rsi') {
        const period = params.period || 14
        const overbought = params.overbought || 70
        const oversold = params.oversold || 30
        setRsiPeriod(period)
        setRsiOverbought(overbought)
        setRsiOversold(oversold)
        setShowRsi(true)
      } else if (strategy === 'macd_crossover') {
        const fast = params.fast || 12
        const slow = params.slow || 26
        const signalVal = params.signal || 9
        setMacdFast(fast)
        setMacdSlow(slow)
        setMacdSignal(signalVal)
        setShowMacd(true)
      } else if (strategy === 'bollinger_revert') {
        const period = params.period || 20
        const stdDev = params.stdDev || 2
        setBbPeriod(period)
        setBbStdDev(stdDev)
        setShowBb(true)
      } else if (strategy === 'breakout' || strategy === 'turtle') {
        const period = params.entryLen || params.entry || 20
        setDonchianPeriod(period)
        setShowDonchian(true)
      } else if (strategy === 'vol_breakout' || strategy === 'atr_trailing') {
        const period = params.atrLen || 14
        setAtrPeriod(period)
        setShowAtr(true)
      } else if (strategy === 'vwap_reversion') {
        setShowVwap(true)
      } else if (strategy === 'ichimoku_cloud') {
        setIchiTenkan(params.tenkan || 9)
        setIchiKijun(params.kijun || 26)
        setIchiSenkou(params.senkou || 52)
        setShowIchimoku(true)
      } else if (strategy === 'mean_reversion_zscore' || strategy === 'pairs_trading' || strategy === 'stat_arb') {
        const window = params.window || params.halflife || 20
        setZScoreWindow(window)
        setShowZScore(true)
      } else if (strategy === 'ema_ribbon') {
        const fast = params.fast || 8
        const mid = params.mid || 21
        const slow = params.slow || 55
        setRibbonLines([
          { id: 1, type: 'EMA', period: fast },
          { id: 2, type: 'EMA', period: mid },
          { id: 3, type: 'EMA', period: slow }
        ])
        setShowRibbon(true)
      }
    } else if (backtestMode === 'multi') {
      const allRules = [...(entryRules || []), ...(exitRules || [])]
      const activeStrategies = new Set(allRules.map(r => r.strategy))

      // Clean unused indicators not part of any conditional rule
      const needsRibbon = activeStrategies.has('sma_crossover') || activeStrategies.has('ema_ribbon')
      const needsRsi = activeStrategies.has('mean_reversion_rsi')
      const needsMacd = activeStrategies.has('macd_crossover')
      const needsBb = activeStrategies.has('bollinger_revert')
      const needsDonchian = activeStrategies.has('breakout') || activeStrategies.has('turtle')
      const needsAtr = activeStrategies.has('vol_breakout') || activeStrategies.has('atr_trailing')
      const needsVwap = activeStrategies.has('vwap_reversion')
      const needsIchimoku = activeStrategies.has('ichimoku_cloud')
      const needsZScore = activeStrategies.has('mean_reversion_zscore') || activeStrategies.has('pairs_trading') || activeStrategies.has('stat_arb')

      setShowRibbon(needsRibbon)
      setShowRsi(needsRsi)
      setShowMacd(needsMacd)
      setShowBb(needsBb)
      setShowDonchian(needsDonchian)
      setShowAtr(needsAtr)
      setShowVwap(needsVwap)
      setShowIchimoku(needsIchimoku)
      setShowZScore(needsZScore)

      // Sync parameters from the rules to the chart indicators
      for (const rule of allRules) {
        const p = rule.params || {}
        if (rule.strategy === 'mean_reversion_rsi') {
          if (p.period) setRsiPeriod(p.period)
          if (p.overbought) setRsiOverbought(p.overbought)
          if (p.oversold) setRsiOversold(p.oversold)
        } else if (rule.strategy === 'macd_crossover') {
          if (p.fast) setMacdFast(p.fast)
          if (p.slow) setMacdSlow(p.slow)
          if (p.signal) setMacdSignal(p.signal)
        } else if (rule.strategy === 'bollinger_revert') {
          if (p.period) setBbPeriod(p.period)
          if (p.stdDev) setBbStdDev(p.stdDev)
        } else if (rule.strategy === 'breakout' || rule.strategy === 'turtle') {
          if (p.entryLen || p.entry) setDonchianPeriod(p.entryLen || p.entry)
        } else if (rule.strategy === 'vol_breakout' || rule.strategy === 'atr_trailing') {
          if (p.atrLen) setAtrPeriod(p.atrLen)
        } else if (rule.strategy === 'ichimoku_cloud') {
          if (p.tenkan) setIchiTenkan(p.tenkan)
          if (p.kijun) setIchiKijun(p.kijun)
          if (p.senkou) setIchiSenkou(p.senkou)
        } else if (rule.strategy === 'mean_reversion_zscore' || rule.strategy === 'pairs_trading' || rule.strategy === 'stat_arb') {
          if (p.window || p.halflife) setZScoreWindow(p.window || p.halflife)
        } else if (rule.strategy === 'sma_crossover') {
          setRibbonLines([
            { id: 1, type: 'SMA', period: p.fast || 10 },
            { id: 2, type: 'SMA', period: p.slow || 30 }
          ])
        } else if (rule.strategy === 'ema_ribbon') {
          setRibbonLines([
            { id: 1, type: 'EMA', period: p.fast || 8 },
            { id: 2, type: 'EMA', period: p.mid || 21 },
            { id: 3, type: 'EMA', period: p.slow || 55 }
          ])
        }
      }
    } else if (backtestMode === 'portfolio') {
      if (!portfolioLegs || portfolioLegs.length === 0) return

      // 1. Clean each leg's params: remove stale params not belonging to leg.strategy, fill missing defaults
      const updatedLegs = portfolioLegs.map(leg => {
        if (leg.ruleMode === 'multi') {
          const cleanedEntry = (leg.entryRules || []).map(r => {
            const sObj = STRATEGIES.find(s => s.id === r.strategy)
            const cleaned: Record<string, number> = {}
            if (sObj) {
              Object.keys(sObj.params).forEach(k => {
                cleaned[k] = r.params?.[k] !== undefined ? r.params[k] : sObj.params[k]
              })
            }
            return { ...r, params: cleaned }
          })
          const cleanedExit = (leg.exitRules || []).map(r => {
            const sObj = STRATEGIES.find(s => s.id === r.strategy)
            const cleaned: Record<string, number> = {}
            if (sObj) {
              Object.keys(sObj.params).forEach(k => {
                cleaned[k] = r.params?.[k] !== undefined ? r.params[k] : sObj.params[k]
              })
            }
            return { ...r, params: cleaned }
          })
          return { ...leg, entryRules: cleanedEntry, exitRules: cleanedExit }
        } else {
          const sObj = STRATEGIES.find(s => s.id === leg.strategy)
          const cleaned: Record<string, number> = {}
          if (sObj) {
            Object.keys(sObj.params).forEach(k => {
              cleaned[k] = leg.params?.[k] !== undefined ? leg.params[k] : sObj.params[k]
            })
          }
          return { ...leg, params: cleaned }
        }
      })
      setPortfolioLegs(updatedLegs)

      // 2. Collect all active strategies across all portfolio legs
      const activeStrategies = new Set<string>()
      const allRulesOrParams: Array<{ strategy: string; params: Record<string, number> }> = []
      updatedLegs.forEach(leg => {
        if (leg.ruleMode === 'multi') {
          (leg.entryRules || []).forEach(r => {
            activeStrategies.add(r.strategy)
            allRulesOrParams.push({ strategy: r.strategy, params: r.params || {} })
          });
          (leg.exitRules || []).forEach(r => {
            activeStrategies.add(r.strategy)
            allRulesOrParams.push({ strategy: r.strategy, params: r.params || {} })
          })
        } else if (leg.strategy) {
          activeStrategies.add(leg.strategy)
          allRulesOrParams.push({ strategy: leg.strategy, params: leg.params || {} })
        }
      })

      // 3. Set indicator visibility based on active strategies
      const needsRibbon = activeStrategies.has('sma_crossover') || activeStrategies.has('ema_ribbon')
      const needsRsi = activeStrategies.has('mean_reversion_rsi')
      const needsMacd = activeStrategies.has('macd_crossover')
      const needsBb = activeStrategies.has('bollinger_revert')
      const needsDonchian = activeStrategies.has('breakout') || activeStrategies.has('turtle')
      const needsAtr = activeStrategies.has('vol_breakout') || activeStrategies.has('atr_trailing')
      const needsVwap = activeStrategies.has('vwap_reversion')
      const needsIchimoku = activeStrategies.has('ichimoku_cloud')
      const needsZScore = activeStrategies.has('mean_reversion_zscore') || activeStrategies.has('pairs_trading') || activeStrategies.has('stat_arb')

      setShowRibbon(needsRibbon)
      setShowRsi(needsRsi)
      setShowMacd(needsMacd)
      setShowBb(needsBb)
      setShowDonchian(needsDonchian)
      setShowAtr(needsAtr)
      setShowVwap(needsVwap)
      setShowIchimoku(needsIchimoku)
      setShowZScore(needsZScore)

      // Automatically target indicator selectors to the specific leg utilizing that strategy
      const macdLeg = updatedLegs.find(l => l.ruleMode === 'multi' ? (l.entryRules?.some(r => r.strategy === 'macd_crossover') || l.exitRules?.some(r => r.strategy === 'macd_crossover')) : l.strategy === 'macd_crossover')
      if (macdLeg) setMacdLegId(macdLeg.id)

      const atrLeg = updatedLegs.find(l => l.ruleMode === 'multi' ? (l.entryRules?.some(r => r.strategy === 'vol_breakout' || r.strategy === 'atr_trailing') || l.exitRules?.some(r => r.strategy === 'vol_breakout' || r.strategy === 'atr_trailing')) : (l.strategy === 'vol_breakout' || l.strategy === 'atr_trailing'))
      if (atrLeg) setAtrLegId(atrLeg.id)

      const zScoreLeg = updatedLegs.find(l => l.ruleMode === 'multi' ? (l.entryRules?.some(r => r.strategy === 'mean_reversion_zscore' || r.strategy === 'pairs_trading' || r.strategy === 'stat_arb') || l.exitRules?.some(r => r.strategy === 'mean_reversion_zscore' || r.strategy === 'pairs_trading' || r.strategy === 'stat_arb')) : (l.strategy === 'mean_reversion_zscore' || l.strategy === 'pairs_trading' || l.strategy === 'stat_arb'))
      if (zScoreLeg) setZScoreLegId(zScoreLeg.id)

      const rsiLeg = updatedLegs.find(l => l.ruleMode === 'multi' ? (l.entryRules?.some(r => r.strategy === 'mean_reversion_rsi') || l.exitRules?.some(r => r.strategy === 'mean_reversion_rsi')) : l.strategy === 'mean_reversion_rsi')
      if (rsiLeg) {
        setRsiPanels(prev => {
          if (prev.length > 0) {
            return prev.map((p, idx) => idx === 0 ? { ...p, legId: rsiLeg.id } : p)
          }
          return [{ id: 'rsi_1', legId: rsiLeg.id, period: 14, overbought: 70, oversold: 30 }]
        })
      }

      // 4. Sync chart indicator values from parameters
      for (const item of allRulesOrParams) {
        const p = item.params || {}
        if (item.strategy === 'mean_reversion_rsi') {
          if (p.period) setRsiPeriod(p.period)
          if (p.overbought) setRsiOverbought(p.overbought)
          if (p.oversold) setRsiOversold(p.oversold)
          setRsiPanels(prev => prev.map(pan => ({
            ...pan,
            period: p.period || pan.period,
            overbought: p.overbought || pan.overbought,
            oversold: p.oversold || pan.oversold
          })))
        } else if (item.strategy === 'macd_crossover') {
          if (p.fast) setMacdFast(p.fast)
          if (p.slow) setMacdSlow(p.slow)
          if (p.signal) setMacdSignal(p.signal)
        } else if (item.strategy === 'bollinger_revert') {
          if (p.period) setBbPeriod(p.period)
          if (p.stdDev) setBbStdDev(p.stdDev)
        } else if (item.strategy === 'breakout' || item.strategy === 'turtle') {
          if (p.entryLen || p.entry) setDonchianPeriod(p.entryLen || p.entry)
        } else if (item.strategy === 'vol_breakout' || item.strategy === 'atr_trailing') {
          if (p.atrLen) setAtrPeriod(p.atrLen)
        } else if (item.strategy === 'ichimoku_cloud') {
          if (p.tenkan) setIchiTenkan(p.tenkan)
          if (p.kijun) setIchiKijun(p.kijun)
          if (p.senkou) setIchiSenkou(p.senkou)
        } else if (item.strategy === 'mean_reversion_zscore' || item.strategy === 'pairs_trading' || item.strategy === 'stat_arb') {
          if (p.window || p.halflife) setZScoreWindow(p.window || p.halflife)
        } else if (item.strategy === 'sma_crossover') {
          setRibbonLines([
            { id: 1, type: 'SMA', period: p.fast || 10 },
            { id: 2, type: 'SMA', period: p.slow || 30 }
          ])
        } else if (item.strategy === 'ema_ribbon') {
          setRibbonLines([
            { id: 1, type: 'EMA', period: p.fast || 8 },
            { id: 2, type: 'EMA', period: p.mid || 21 },
            { id: 3, type: 'EMA', period: p.slow || 55 }
          ])
        }
      }
    }
  }

  const processSeries = (rawSeries: any[]) => {
    return rawSeries.map(item => {
      const o = item.open !== undefined ? item.open : item.close;
      const c = item.close;
      const h = item.high !== undefined ? item.high : item.close;
      const l = item.low !== undefined ? item.low : item.close;
      return { ...item, open: o, high: h, low: l, candleRange: [Math.min(o, c), Math.max(o, c)], wickRange: [l, h] };
    });
  };

  const fetchMarketData = async () => {
    setLoading(true)
    try {
      const urlParams = `symbol=${symbol}&timeframe=${timeframe}&lookback=${lookback}&action=indicators&ribbonLines=${encodeURIComponent(JSON.stringify(ribbonLines))}&rsiPeriod=${rsiPeriod}&bbPeriod=${bbPeriod}&bbStdDev=${bbStdDev}&macdFast=${macdFast}&macdSlow=${macdSlow}&macdSignal=${macdSignal}&donchianPeriod=${donchianPeriod}&atrPeriod=${atrPeriod}&ichiTenkan=${ichiTenkan}&ichiKijun=${ichiKijun}&ichiSenkou=${ichiSenkou}&zScoreWindow=${zScoreWindow}`
      const indRes = await fetch(`/api/quant-lab-data?${urlParams}`)
      const indData = await indRes.json()

      if (indData.success) {
        setIndicators(indData.indicators)
        const series = processSeries(indData.series || [])
        setDataCount(indData.count)
        setChartData(series)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const runBacktest = async (overrideConfig?: any) => {
    const isOverride = overrideConfig && typeof overrideConfig === 'object' && !('nativeEvent' in overrideConfig) && !('target' in overrideConfig) && ('strategy' in overrideConfig || 'mode' in overrideConfig || 'symbol' in overrideConfig)

    const effectiveMode = (isOverride && overrideConfig.mode) ? overrideConfig.mode : backtestMode
    const effectiveStrategy = (isOverride && overrideConfig.strategy) ? overrideConfig.strategy : strategy
    const effectiveSymbol = (isOverride && overrideConfig.symbol) ? overrideConfig.symbol : symbol
    const effectiveTimeframe = (isOverride && overrideConfig.timeframe) ? overrideConfig.timeframe : timeframe
    const effectiveLookback = (isOverride && overrideConfig.lookback) ? overrideConfig.lookback : lookback

    const effectiveEntryRules = (isOverride && overrideConfig.entryRules) ? overrideConfig.entryRules : entryRules
    const effectiveExitRules = (isOverride && overrideConfig.exitRules) ? overrideConfig.exitRules : exitRules
    const effectiveEntryOperator = (isOverride && overrideConfig.entryOperator) ? overrideConfig.entryOperator : entryOperator
    const effectiveExitOperator = (isOverride && overrideConfig.exitOperator) ? overrideConfig.exitOperator : exitOperator

    const effectivePortfolioLegs = (isOverride && overrideConfig.portfolioLegs) ? overrideConfig.portfolioLegs : portfolioLegs

    const overrideParams = (isOverride && overrideConfig.params) ? overrideConfig.params : null
    let effectiveParams = params
    if (overrideParams) {
      const cleaned: Record<string, number> = {}
      Object.entries(overrideParams).forEach(([k, v]) => {
        if (!['maxPositionSize', 'stopLoss', 'takeProfit', 'slippageBps', 'commission'].includes(k)) {
          cleaned[k] = Number(v)
        }
      })
      effectiveParams = cleaned
    }

    const effectiveMaxPos = (overrideParams && overrideParams.maxPositionSize !== undefined) ? overrideParams.maxPositionSize : maxPositionSize
    const effectiveStopLoss = (overrideParams && overrideParams.stopLoss !== undefined) ? overrideParams.stopLoss : stopLoss
    const effectiveTakeProfit = (overrideParams && overrideParams.takeProfit !== undefined) ? overrideParams.takeProfit : takeProfit
    const effectiveSlippage = (overrideParams && overrideParams.slippageBps !== undefined) ? overrideParams.slippageBps : slippageBps
    const effectiveCommission = (overrideParams && overrideParams.commission !== undefined) ? overrideParams.commission : commission

    if (effectiveMode === 'single' && !effectiveStrategy) {
      alert('Please select a strategy from the configuration panel to run the backtest.')
      return
    }
    if (effectiveMode === 'multi' && (!effectiveEntryRules || effectiveEntryRules.length === 0)) {
      alert('Please add at least one entry rule to run the conditional backtest.')
      return
    }
    setLoading(true); setResult(null)
    try {
      if (effectiveMode === 'portfolio') {
        if (effectivePortfolioLegs.length === 0) {
          alert('Please add at least one leg to the portfolio.')
          setLoading(false)
          return
        }

        const legResults = await Promise.all(effectivePortfolioLegs.map(async (leg: any) => {
          const urlParams = `symbol=${leg.symbol}&timeframe=${effectiveTimeframe}&lookback=${effectiveLookback}&action=indicators&rsiPeriod=${rsiPeriod}&bbPeriod=${bbPeriod}&bbStdDev=${bbStdDev}&macdFast=${macdFast}&macdSlow=${macdSlow}&macdSignal=${macdSignal}&donchianPeriod=${donchianPeriod}&atrPeriod=${atrPeriod}&ichiTenkan=${ichiTenkan}&ichiKijun=${ichiKijun}&ichiSenkou=${ichiSenkou}&zScoreWindow=${zScoreWindow}`
          const indRes = await fetch(`/api/quant-lab-data?${urlParams}`)
          const indData = await indRes.json()

          let series: any[] = []
          if (indData.success) {
            series = processSeries(indData.series || [])
          }

          let btUrl = `/api/quant-lab-data?symbol=${leg.symbol}&timeframe=${effectiveTimeframe}&lookback=${effectiveLookback}&action=backtest`
          const riskPayload = { maxPositionSize: effectiveMaxPos, stopLoss: effectiveStopLoss, takeProfit: effectiveTakeProfit, slippageBps: effectiveSlippage, commission: effectiveCommission }
          if (leg.ruleMode === 'multi' && (leg.entryRules && leg.entryRules.length > 0)) {
            btUrl += `&entryOperator=${leg.entryOperator || 'AND'}&entryRules=${encodeURIComponent(JSON.stringify(leg.entryRules))}&exitOperator=${leg.exitOperator || 'OR'}&exitRules=${encodeURIComponent(JSON.stringify(leg.exitRules || []))}&params=${encodeURIComponent(JSON.stringify(riskPayload))}`
          } else {
            btUrl += `&strategy=${leg.strategy}&params=${encodeURIComponent(JSON.stringify({ ...leg.params, ...riskPayload }))}`
          }
          const btRes = await fetch(btUrl)
          const btData = await btRes.json()
          
          return { leg, indData, series, btData }
        }))

        if (legResults.length === 0 || legResults.some(r => !r.btData.success)) {
          setLoading(false)
          return
        }

        const baseLength = legResults[0].series.length
        let totalWeight = effectivePortfolioLegs.reduce((sum: number, leg: any) => sum + (leg.allocationPct || 0), 0)
        if (totalWeight === 0) totalWeight = 1 // avoid div by zero

        const tradesByEntry = new Map<number, any[]>()
        const tradesByExit = new Map<number, any[]>()
        const combinedTradeList: any[] = []
        let totalWins = 0

        legResults.forEach((r) => {
          if (r.btData.tradeList && Array.isArray(r.btData.tradeList)) {
            r.btData.tradeList.forEach((t: any) => {
              const enhancedTrade = {
                ...t,
                legId: r.leg.id,
                symbol: r.leg.symbol,
                uniqueId: `${r.leg.symbol}_${t.id}_${t.entryIdx}`
              }
              combinedTradeList.push(enhancedTrade)
              if (enhancedTrade.pnl > 0) totalWins++
              
              if (!tradesByEntry.has(t.entryIdx)) tradesByEntry.set(t.entryIdx, [])
              tradesByEntry.get(t.entryIdx)!.push(enhancedTrade)

              if (!tradesByExit.has(t.exitIdx)) tradesByExit.set(t.exitIdx, [])
              tradesByExit.get(t.exitIdx)!.push(enhancedTrade)
            })
          }
        })
        // Sort chronologically by trade occurrence (entryIdx, then exitIdx)
        combinedTradeList.sort((a, b) => {
          if (a.entryIdx !== b.entryIdx) return a.entryIdx - b.entryIdx
          return a.exitIdx - b.exitIdx
        })
        // Re-index sequentially in order of occurrence
        combinedTradeList.forEach((t, idx) => {
          t.id = idx + 1
        })

        const mergedSeries = new Array(baseLength).fill(null).map((_, i) => {
          const item: any = { time: legResults[0].series[i]?.time || '' }
          let sumEquity = 0
          let sumLots = 0

          legResults.forEach((res) => {
            const legId = res.leg.id
            const weight = res.leg.allocationPct / totalWeight
            
            const legSeriesItem = res.series[i] || {}
            item[`open_${legId}`] = legSeriesItem.open
            item[`high_${legId}`] = legSeriesItem.high
            item[`low_${legId}`] = legSeriesItem.low
            item[`close_${legId}`] = legSeriesItem.close
            item[`volume_${legId}`] = legSeriesItem.volume
            
            const legEquity = res.btData.equityCurve ? res.btData.equityCurve[i] : 100
            const legLot = res.btData.lots ? res.btData.lots[i] : 0
            item[`equity_${legId}`] = legEquity
            item[`lots_${legId}`] = legLot
            
            sumEquity += legEquity * weight
            sumLots += legLot
            
            const sigEvent = res.btData.signalEvents ? res.btData.signalEvents[i] : null
            const legEntryTrades = tradesByEntry.get(i)?.filter((t: any) => t.legId === legId)
            const legExitTrades = tradesByExit.get(i)?.filter((t: any) => t.legId === legId)
            const legEntryTrade = legEntryTrades && legEntryTrades.length > 0 ? legEntryTrades[0] : null
            const legExitTrade = legExitTrades && legExitTrades.length > 0 ? legExitTrades[0] : null
            const legTrade = legEntryTrade || legExitTrade || null

            const sig = sigEvent ? sigEvent.signal : (res.btData.signals ? res.btData.signals[i] : (legTrade ? (legTrade.side === 'long' ? (legEntryTrade ? 'buy' : 'sell') : (legEntryTrade ? 'sell' : 'buy')) : null))

            let legSignalType: 'entry' | 'exit' | null = null
            let legSignalReason = ''

            if (sigEvent) {
              legSignalType = sigEvent.type
              legSignalReason = sigEvent.reason || ''
            } else if (legEntryTrade) {
              legSignalType = 'entry'
              legSignalReason = legEntryTrade.entryReason || `${legEntryTrade.side === 'long' ? 'Long' : 'Short'} Strategy Entry Signal`
            } else if (legExitTrade) {
              legSignalType = 'exit'
              legSignalReason = legExitTrade.exitReasonText || (legExitTrade.exitReason === 'stop_loss' ? 'Stop Loss Triggered' : legExitTrade.exitReason === 'take_profit' ? 'Take Profit Target Reached' : 'Strategy Exit Signal')
            }

            if (!legSignalReason && legTrade) {
              if (legSignalType === 'exit' || legExitTrade) {
                legSignalReason = legTrade.exitReasonText || (legTrade.exitReason === 'stop_loss' ? 'Stop Loss Triggered' : legTrade.exitReason === 'take_profit' ? 'Take Profit Target Reached' : 'Strategy Exit Signal')
              } else {
                legSignalReason = legTrade.entryReason || `${legTrade.side === 'long' ? 'Long' : 'Short'} Strategy Entry Signal`
              }
            }

            item[`signal_${legId}`] = sig
            item[`signalType_${legId}`] = legSignalType || (sigEvent ? sigEvent.type : (sig ? 'entry' : null))
            item[`signalReason_${legId}`] = legSignalReason
            item[`signalSymbol_${legId}`] = res.leg.symbol
            item[`trade_${legId}`] = legTrade
          })
          
          const base0 = legResults[0]?.series[i] || {}
          item.close = base0.close
          item.open = base0.open !== undefined ? base0.open : base0.close
          item.high = base0.high !== undefined ? base0.high : base0.close
          item.low = base0.low !== undefined ? base0.low : base0.close
          item.volume = base0.volume || 0
          item.equity = parseFloat(sumEquity.toFixed(2))
          item.lots = sumLots
          
          const entryTrades = tradesByEntry.get(i)
          const exitTrades = tradesByExit.get(i)
          item.trade = (entryTrades && entryTrades.length > 0) ? entryTrades[0] : ((exitTrades && exitTrades.length > 0) ? exitTrades[0] : null)

          return item
        })
        
        const firstPrices = legResults.map(r => r.series[0]?.close || 1)
        const lastPrices = legResults.map(r => r.series[r.series.length - 1]?.close || 1)
        
        let buyHoldReturn = 0
        legResults.forEach((r, idx) => {
          const weight = r.leg.allocationPct / totalWeight
          buyHoldReturn += ((lastPrices[idx] - firstPrices[idx]) / firstPrices[idx]) * 100 * weight
        })
        
        const totalReturn = mergedSeries[mergedSeries.length - 1].equity - 100
        const alpha = totalReturn - buyHoldReturn
        const winRate = combinedTradeList.length > 0 ? (totalWins / combinedTradeList.length) * 100 : 0
        
        let peak = 100, maxDD = 0
        mergedSeries.forEach(item => {
          if (item.equity > peak) peak = item.equity
          const dd = (peak - item.equity) / peak * 100
          if (dd > maxDD) maxDD = dd
        })

        // Detailed trade statistics for portfolio
        const totalTradePnl = combinedTradeList.reduce((s, t) => s + (t.pnlPct !== undefined ? t.pnlPct : (t.entryPrice && t.size ? (t.pnl / (t.entryPrice * t.size)) * 100 : t.pnl)), 0)
        const avgTrade = combinedTradeList.length > 0 ? totalTradePnl / combinedTradeList.length : 0

        const winTrades = combinedTradeList.filter(t => t.pnl > 0)
        const lossTrades = combinedTradeList.filter(t => t.pnl <= 0)
        const grossProfit = winTrades.reduce((s, t) => s + t.pnl, 0)
        const grossLoss = Math.abs(lossTrades.reduce((s, t) => s + t.pnl, 0))
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.99 : 0)

        const avgWin = winTrades.length > 0 ? (winTrades.reduce((s, t) => s + (t.pnlPct !== undefined ? t.pnlPct : (t.entryPrice && t.size ? (t.pnl / (t.entryPrice * t.size)) * 100 : 0)), 0) / winTrades.length) : 0
        const avgLoss = lossTrades.length > 0 ? (lossTrades.reduce((s, t) => s + (t.pnlPct !== undefined ? t.pnlPct : (t.entryPrice && t.size ? (t.pnl / (t.entryPrice * t.size)) * 100 : 0)), 0) / lossTrades.length) : 0

        let maxConsecLosses = 0, consecLosses = 0
        for (const t of combinedTradeList) {
          if (t.pnl <= 0) { consecLosses++; if (consecLosses > maxConsecLosses) maxConsecLosses = consecLosses }
          else consecLosses = 0
        }

        // Sharpe, Sortino, Calmar calculated on portfolio daily equity returns
        const equityReturns: number[] = []
        for (let i = 1; i < mergedSeries.length; i++) {
          const prevEq = mergedSeries[i - 1].equity
          const curEq = mergedSeries[i].equity
          if (prevEq > 0) equityReturns.push((curEq - prevEq) / prevEq)
        }
        const avgEqRet = equityReturns.length > 0 ? equityReturns.reduce((a, b) => a + b, 0) / equityReturns.length : 0
        const stdEqRet = equityReturns.length > 1 ? Math.sqrt(equityReturns.reduce((s, r) => s + Math.pow(r - avgEqRet, 2), 0) / (equityReturns.length - 1)) : 0
        const annualFactor = Math.sqrt(252 / Math.max(1, baseLength / 78))
        const sharpe = stdEqRet > 0 ? (avgEqRet / stdEqRet) * annualFactor : 0

        const negReturns = equityReturns.filter(r => r < 0)
        const downsideDev = negReturns.length > 1 ? Math.sqrt(negReturns.reduce((s, r) => s + r * r, 0) / negReturns.length) : 0
        const sortino = downsideDev > 0 ? (avgEqRet / downsideDev) * annualFactor : 0

        const annualizedReturn = totalReturn * (252 / Math.max(1, baseLength))
        const calmar = maxDD > 0 ? annualizedReturn / maxDD : 0

        // calculate correlation
        let correlation = 0;
        if (legResults.length >= 2) {
            const seriesA = legResults[0].btData.equityCurve || [];
            const seriesB = legResults[1].btData.equityCurve || [];
            if (seriesA.length === seriesB.length && seriesA.length > 1) {
                const meanA = seriesA.reduce((s: number, v: number) => s + v, 0) / seriesA.length;
                const meanB = seriesB.reduce((s: number, v: number) => s + v, 0) / seriesB.length;
                let cov = 0, varA = 0, varB = 0;
                for (let i = 0; i < seriesA.length; i++) {
                    cov += (seriesA[i] - meanA) * (seriesB[i] - meanB);
                    varA += Math.pow(seriesA[i] - meanA, 2);
                    varB += Math.pow(seriesB[i] - meanB, 2);
                }
                correlation = varA > 0 && varB > 0 ? cov / Math.sqrt(varA * varB) : 0;
            }
        }

        // Market benchmark comparison (SPY Buy & Hold)
        let spyBuyHoldReturn = buyHoldReturn
        const spyLeg = legResults.find(r => r.leg.symbol.toUpperCase() === 'SPY')
        if (spyLeg && spyLeg.series && spyLeg.series.length > 0) {
          const s0 = spyLeg.series[0]?.close || 1
          const s1 = spyLeg.series[spyLeg.series.length - 1]?.close || 1
          spyBuyHoldReturn = ((s1 - s0) / s0) * 100
        } else {
          try {
            const spyRes = await fetch(`/api/quant-lab-data?symbol=SPY&timeframe=${timeframe}&lookback=${lookback}&action=indicators`)
            const spyData = await spyRes.json()
            if (spyData.success && spyData.series && spyData.series.length > 0) {
              const s0 = spyData.series[0].close || 1
              const s1 = spyData.series[spyData.series.length - 1].close || 1
              spyBuyHoldReturn = ((s1 - s0) / s0) * 100
            }
          } catch (e) {
            spyBuyHoldReturn = buyHoldReturn
          }
        }
        const marketAlpha = totalReturn - spyBuyHoldReturn
        
        const combinedResult = {
          totalReturn: parseFloat(totalReturn.toFixed(2)),
          buyHoldReturn: parseFloat(buyHoldReturn.toFixed(2)),
          alpha: parseFloat(alpha.toFixed(2)),
          marketAlpha: parseFloat(marketAlpha.toFixed(2)),
          spyBuyHoldReturn: parseFloat(spyBuyHoldReturn.toFixed(2)),
          sharpe: parseFloat(sharpe.toFixed(2)),
          sortino: parseFloat(sortino.toFixed(2)),
          calmar: parseFloat(calmar.toFixed(2)),
          profitFactor: parseFloat(profitFactor.toFixed(2)),
          winRate: parseFloat(winRate.toFixed(1)),
          maxDrawdown: parseFloat((-maxDD).toFixed(2)),
          trades: combinedTradeList.length,
          avgTrade: parseFloat(avgTrade.toFixed(2)),
          avgWin: parseFloat(avgWin.toFixed(2)),
          avgLoss: parseFloat(avgLoss.toFixed(2)),
          maxConsecLosses,
          tradeList: combinedTradeList,
          legResults,
          correlation: parseFloat(correlation.toFixed(2))
        }
        
        setResult(combinedResult)
        setEvalOpen(true)
        setChartData(mergedSeries)
        triggerBacktestAnimation()
        setDataCount(baseLength)
        setLoading(false)
        return
      }

      const urlParams = `symbol=${effectiveSymbol}&timeframe=${effectiveTimeframe}&lookback=${effectiveLookback}&action=indicators&ribbonLines=${encodeURIComponent(JSON.stringify(ribbonLines))}&rsiPeriod=${rsiPeriod}&bbPeriod=${bbPeriod}&bbStdDev=${bbStdDev}&macdFast=${macdFast}&macdSlow=${macdSlow}&macdSignal=${macdSignal}&donchianPeriod=${donchianPeriod}&atrPeriod=${atrPeriod}&ichiTenkan=${ichiTenkan}&ichiKijun=${ichiKijun}&ichiSenkou=${ichiSenkou}&zScoreWindow=${zScoreWindow}`
      const indRes = await fetch(`/api/quant-lab-data?${urlParams}`)
      const indData = await indRes.json()

      let series = []
      if (indData.success) {
        setIndicators(indData.indicators)
        series = processSeries(indData.series || [])
        setDataCount(indData.count)
        setChartData(series)
      }

      let btUrl = `/api/quant-lab-data?symbol=${effectiveSymbol}&timeframe=${effectiveTimeframe}&lookback=${effectiveLookback}&action=backtest`
      const riskPayload = {
        maxPositionSize: effectiveMaxPos,
        stopLoss: effectiveStopLoss,
        takeProfit: effectiveTakeProfit,
        slippageBps: effectiveSlippage,
        commission: effectiveCommission
      }
      if (effectiveMode === 'multi') {
        btUrl += `&entryOperator=${effectiveEntryOperator}&entryRules=${encodeURIComponent(JSON.stringify(effectiveEntryRules))}&exitOperator=${effectiveExitOperator}&exitRules=${encodeURIComponent(JSON.stringify(effectiveExitRules))}&params=${encodeURIComponent(JSON.stringify(riskPayload))}`
      } else {
        btUrl += `&strategy=${effectiveStrategy}&params=${encodeURIComponent(JSON.stringify({ ...effectiveParams, ...riskPayload }))}`
      }
      const btRes = await fetch(btUrl)
      const btData = await btRes.json()

      if (btData.success) {
        setResult(btData)
        setEvalOpen(true)
        if (series.length > 0) {
          const tradesByEntry = new Map<number, any>()
          const tradesByExit = new Map<number, any>()
          if (btData.tradeList && Array.isArray(btData.tradeList)) {
            btData.tradeList.forEach((tr: any) => {
              tradesByEntry.set(tr.entryIdx, tr)
              tradesByExit.set(tr.exitIdx, tr)
            })
          }

          const merged = series.map((item: any, idx: number) => {
            const entryTrade = tradesByEntry.get(idx)
            const exitTrade = tradesByExit.get(idx)
            const trade = entryTrade || exitTrade
            const sigEvent = btData.signalEvents ? btData.signalEvents[idx] : null
            const sig = sigEvent ? sigEvent.signal : (btData.signals ? btData.signals[idx] : null)
            let signalReason = ''
            let signalType: 'entry' | 'exit' | null = null

            if (sigEvent) {
              signalType = sigEvent.type
              signalReason = sigEvent.reason
            } else if (entryTrade) {
              signalType = 'entry'
              signalReason = entryTrade.entryReason || `${entryTrade.side === 'long' ? 'Long' : 'Short'} Strategy Entry Signal`
            } else if (exitTrade) {
              signalType = 'exit'
              signalReason = exitTrade.exitReasonText || (exitTrade.exitReason === 'stop_loss' ? 'Stop Loss Triggered' : exitTrade.exitReason === 'take_profit' ? 'Take Profit Target Reached' : 'Strategy Exit Signal')
            }

            return {
              ...item,
              equity: btData.equityCurve ? btData.equityCurve[idx] : null,
              signal: sig,
              signalType,
              signalReason,
              trade,
              lots: btData.lots ? btData.lots[idx] : 0
            }
          })
          setChartData(merged)
          triggerBacktestAnimation()
        } else {
          setChartData(series)
          triggerBacktestAnimation()
        }
      } else {
        setChartData(series)
        triggerBacktestAnimation()
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleLoadSaved = (saved: SavedStrategy) => {
    if (saved.mode === 'single' && saved.strategy) {
      setBacktestMode('single')
      setStrategy(saved.strategy)
      if (saved.params) {
        const cleaned: Record<string, number> = {}
        Object.entries(saved.params).forEach(([k, v]) => {
          if (!['maxPositionSize', 'stopLoss', 'takeProfit', 'slippageBps', 'commission'].includes(k)) {
            cleaned[k] = v
          }
        })
        setParams(cleaned)
      }
      if (saved.symbol) setSymbol(saved.symbol)
    } else if (saved.mode === 'multi') {
      setBacktestMode('multi')
      if (saved.entryRules) setEntryRules([...saved.entryRules])
      if (saved.exitRules) setExitRules([...saved.exitRules])
      if (saved.entryOperator) setEntryOperator(saved.entryOperator)
      if (saved.exitOperator) setExitOperator(saved.exitOperator)
      if (saved.symbol) setSymbol(saved.symbol)
    } else if (saved.mode === 'portfolio') {
      setBacktestMode('portfolio')
      if (saved.portfolioLegs && saved.portfolioLegs.length > 0) {
        setPortfolioLegs(saved.portfolioLegs.map(l => ({ ...l, params: { ...(l.params || {}) } })))
      }
      if (saved.pricePanels && saved.pricePanels.length > 0) {
        setPricePanels([...saved.pricePanels])
      }
    }

    if (saved.params) {
      if (saved.params.maxPositionSize !== undefined) setMaxPositionSize(saved.params.maxPositionSize)
      if (saved.params.stopLoss !== undefined) setStopLoss(saved.params.stopLoss)
      if (saved.params.takeProfit !== undefined) setTakeProfit(saved.params.takeProfit)
      if (saved.params.slippageBps !== undefined) setSlippageBps(saved.params.slippageBps)
      if (saved.params.commission !== undefined) setCommission(saved.params.commission)
    }

    if (saved.timeframe) setTimeframe(saved.timeframe)
    if (saved.lookback) setLookback(saved.lookback)

    if (saved.result) {
      setResult(saved.result)
      setEvalOpen(true)
    }

    // Auto-run the backtest immediately with the loaded configuration
    runBacktest(saved)
  }


  const selectStrategy = (id: string) => {
    setStrategy(id)
    const s = STRATEGIES.find(st => st.id === id)
    if (s) setParams({ ...s.params })
  }

  const downloadCSV = async () => {
    try {
      const res = await fetch(`/api/quant-lab-data?symbol=${symbol}&timeframe=${timeframe}&lookback=${lookback}&action=bars`)
      const data = await res.json();
      if (data.success && data.bars) {
        const headers = ['time', 'open', 'high', 'low', 'close', 'volume'];
        const csvContent = [
          headers.join(','),
          ...data.bars.map((b: any) => headers.map((h: string) => b[h]).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `${symbol}_${timeframe}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    } catch (e) {
      console.error('Download failed', e);
    }
  }

  const processedChartData = useMemo(() => {
    if (!chartData || chartData.length === 0) return []

    const prices = chartData.map(item => item.close)
    const bars = chartData.map(item => ({
      o: item.open !== undefined ? item.open : item.close,
      h: item.high !== undefined ? item.high : item.close,
      l: item.low !== undefined ? item.low : item.close,
      c: item.close,
      v: item.volume !== undefined ? item.volume : 0
    }))

    // Stock-specific RSI calculations for all active RSI panels
    const rsiResults: Record<string, (number | null)[]> = {}
    for (const rsiCfg of rsiPanels) {
      let rsiPrices = prices
      if (backtestMode === 'portfolio' && rsiCfg.legId) {
        rsiPrices = chartData.map(item => item[`close_${rsiCfg.legId}`] !== undefined ? item[`close_${rsiCfg.legId}`] : item.close)
      }
      rsiResults[rsiCfg.id] = computeRSI(rsiPrices, rsiCfg.period)
    }

    // Stock-specific MACD calculation
    let macdPrices = prices
    if (backtestMode === 'portfolio' && macdLegId) {
      macdPrices = chartData.map(item => item[`close_${macdLegId}`] !== undefined ? item[`close_${macdLegId}`] : item.close)
    }
    const { macd, signal: macdSig, histogram } = computeMACD(macdPrices, macdFast, macdSlow, macdSignal)

    // Stock-specific ATR calculation
    let atrBars = bars
    if (backtestMode === 'portfolio' && atrLegId) {
      atrBars = chartData.map(item => {
        const c = item[`close_${atrLegId}`] !== undefined ? item[`close_${atrLegId}`] : item.close
        const o = item[`open_${atrLegId}`] !== undefined ? item[`open_${atrLegId}`] : c
        const h = item[`high_${atrLegId}`] !== undefined ? item[`high_${atrLegId}`] : c
        const l = item[`low_${atrLegId}`] !== undefined ? item[`low_${atrLegId}`] : c
        const v = item[`volume_${atrLegId}`] || 0
        return { o, h, l, c, v }
      })
    }
    const atr = computeATR(atrBars, atrPeriod)

    // Stock-specific ZScore calculation
    let zScorePrices = prices
    if (backtestMode === 'portfolio' && zScoreLegId) {
      zScorePrices = chartData.map(item => item[`close_${zScoreLegId}`] !== undefined ? item[`close_${zScoreLegId}`] : item.close)
    }
    const zscore = computeZScore(zScorePrices, zScoreWindow)

    const bb = computeBollingerBands(prices, bbPeriod, bbStdDev)
    const vwap = computeVWAP(bars)
    const donchian = computeDonchian(bars, donchianPeriod)
    const ichimoku = computeIchimoku(bars, ichiTenkan, ichiKijun, ichiSenkou)

    const ribbons: Record<string, (number | null)[]> = {}
    for (const line of ribbonLines) {
      if (!line || typeof line.period !== 'number' || isNaN(line.period) || line.period < 1) continue
      const key = `ribbon_${line.type.toLowerCase()}_${line.period}`
      ribbons[key] = line.type === 'SMA' ? computeSMA(prices, line.period) : computeEMA(prices, line.period)
    }

    const legIndicators: Record<string, any> = {}
    if (backtestMode === 'portfolio') {
      portfolioLegs.forEach(leg => {
        const legPrices = chartData.map(d => d[`close_${leg.id}`] !== undefined ? d[`close_${leg.id}`] : d.close)
        const legBars = chartData.map(d => ({
          o: d[`open_${leg.id}`] !== undefined ? d[`open_${leg.id}`] : (d[`close_${leg.id}`] || 0),
          h: d[`high_${leg.id}`] !== undefined ? d[`high_${leg.id}`] : (d[`close_${leg.id}`] || 0),
          l: d[`low_${leg.id}`] !== undefined ? d[`low_${leg.id}`] : (d[`close_${leg.id}`] || 0),
          c: d[`close_${leg.id}`] || 0,
          v: d[`volume_${leg.id}`] || 0
        }))

        const legBb = computeBollingerBands(legPrices, bbPeriod, bbStdDev)
        const legVwap = computeVWAP(legBars)
        const legDonchian = computeDonchian(legBars, donchianPeriod)
        const legRibbons: Record<string, (number | null)[]> = {}
        for (const line of ribbonLines) {
          if (!line || typeof line.period !== 'number' || isNaN(line.period) || line.period < 1) continue
          const key = `ribbon_${leg.id}_${line.type.toLowerCase()}_${line.period}`
          legRibbons[key] = line.type === 'SMA' ? computeSMA(legPrices, line.period) : computeEMA(legPrices, line.period)
        }

        legIndicators[leg.id] = {
          bb: legBb,
          vwap: legVwap,
          donchian: legDonchian,
          ribbons: legRibbons
        }
      })
    }

    return chartData.map((item, i) => {
      const res: any = {
        ...item,
        bbUpper: bb.upper[i],
        bbMiddle: bb.middle[i],
        bbLower: bb.lower[i],
        macd: macd[i],
        macdSignal: macdSig[i],
        macdHistogram: histogram[i],
        vwap: vwap[i],
        donchianUpper: donchian.upper[i],
        donchianLower: donchian.lower[i],
        atr: atr[i],
        ichiTenkan: ichimoku.tenkan[i],
        ichiKijun: ichimoku.kijun[i],
        ichiSenkouA: ichimoku.senkouA[i],
        ichiSenkouB: ichimoku.senkouB[i],
        zscore: zscore[i]
      }

      for (const rsiCfg of rsiPanels) {
        res[`rsi_${rsiCfg.id}`] = rsiResults[rsiCfg.id] ? rsiResults[rsiCfg.id][i] : null
      }
      res.rsi = rsiPanels[0] ? (rsiResults[rsiPanels[0].id] ? rsiResults[rsiPanels[0].id][i] : null) : null

      for (const line of ribbonLines) {
        if (!line || typeof line.period !== 'number' || isNaN(line.period) || line.period < 1) continue
        const key = `ribbon_${line.type.toLowerCase()}_${line.period}`
        res[key] = ribbons[key] ? ribbons[key][i] : null
      }

      if (backtestMode === 'portfolio') {
        portfolioLegs.forEach(leg => {
          const ind = legIndicators[leg.id]
          if (ind) {
            res[`bbUpper_${leg.id}`] = ind.bb.upper[i]
            res[`bbMiddle_${leg.id}`] = ind.bb.middle[i]
            res[`bbLower_${leg.id}`] = ind.bb.lower[i]
            res[`vwap_${leg.id}`] = ind.vwap[i]
            res[`donchianUpper_${leg.id}`] = ind.donchian.upper[i]
            res[`donchianLower_${leg.id}`] = ind.donchian.lower[i]
            for (const line of ribbonLines) {
              if (!line || typeof line.period !== 'number' || isNaN(line.period) || line.period < 1) continue
              const key = `ribbon_${leg.id}_${line.type.toLowerCase()}_${line.period}`
              res[key] = ind.ribbons[key] ? ind.ribbons[key][i] : null
            }
          }
        })
      }

      return res
    })
  }, [chartData, ribbonLines, rsiPanels, macdLegId, atrLegId, zScoreLegId, backtestMode, portfolioLegs, bbPeriod, bbStdDev, macdFast, macdSlow, macdSignal, donchianPeriod, atrPeriod, ichiTenkan, ichiKijun, ichiSenkou, zScoreWindow])

  // Reset zoom on data change
  useEffect(() => {
    setZoomRange(null)
  }, [symbol, timeframe, lookback, chartData.length])

  const totalBars = processedChartData.length
  const currentStart = zoomRange ? Math.max(0, Math.min(zoomRange.start, totalBars - 1)) : 0
  const currentEnd = zoomRange ? Math.max(currentStart + 4, Math.min(zoomRange.end, totalBars - 1)) : Math.max(0, totalBars - 1)
  const visibleCount = Math.max(1, currentEnd - currentStart + 1)
  const isZoomed = totalBars > 5 && (currentStart > 0 || currentEnd < totalBars - 1)

  const filteredChartData = useMemo(() => {
    if (totalBars === 0) return []
    let data = processedChartData.slice(currentStart, currentEnd + 1)
    
    if (backtestMode === 'portfolio') {
      data = data.map(item => {
        const portfolioSignals: any[] = []
        portfolioLegs.forEach(leg => {
          if (item[`signal_${leg.id}`]) {
            portfolioSignals.push({
              legId: leg.id,
              symbol: leg.symbol,
              signal: item[`signal_${leg.id}`],
              signalType: item[`signalType_${leg.id}`],
              signalReason: item[`signalReason_${leg.id}`],
              trade: item[`trade_${leg.id}`],
            })
          }
        })

        const enhanced: any = {
          ...item,
          portfolioSignals
        }

        portfolioLegs.forEach(leg => {
          const o = item[`open_${leg.id}`] !== undefined ? item[`open_${leg.id}`] : item[`close_${leg.id}`]
          const c = item[`close_${leg.id}`]
          const h = item[`high_${leg.id}`] !== undefined ? item[`high_${leg.id}`] : c
          const l = item[`low_${leg.id}`] !== undefined ? item[`low_${leg.id}`] : c
          enhanced[`candleRange_${leg.id}`] = [Math.min(o || 0, c || 0), Math.max(o || 0, c || 0)]
          enhanced[`wickRange_${leg.id}`] = [l || 0, h || 0]
        })

        const activeLegId = (priceActionViewMode !== 'overlay' && priceActionViewMode !== 'separate')
          ? priceActionViewMode
          : portfolioLegs[0]?.id
        if (activeLegId && item[`close_${activeLegId}`] !== undefined) {
          enhanced.close = item[`close_${activeLegId}`]
          enhanced.open = item[`open_${activeLegId}`]
          enhanced.high = item[`high_${activeLegId}`]
          enhanced.low = item[`low_${activeLegId}`]
          enhanced.volume = item[`volume_${activeLegId}`]
          enhanced.wickRange = enhanced[`wickRange_${activeLegId}`]
          enhanced.candleRange = enhanced[`candleRange_${activeLegId}`]
          if (item[`signal_${activeLegId}`]) {
            enhanced.signal = item[`signal_${activeLegId}`]
            enhanced.signalType = item[`signalType_${activeLegId}`]
            enhanced.signalReason = item[`signalReason_${activeLegId}`]
            enhanced.trade = item[`trade_${activeLegId}`]
            enhanced.signalSymbol = item[`signalSymbol_${activeLegId}`]
          }
        }

        return enhanced
      })
    }
    return data
  }, [processedChartData, currentStart, currentEnd, totalBars, backtestMode, portfolioLegs, priceActionViewMode])

  // Intelligent Adaptive Level-of-Detail (LOD) downsampling for Recharts SVG rendering
  const displayChartData = useMemo(() => {
    const count = filteredChartData.length
    if (count <= 0) return []
    // Adaptive LOD: 150 points during active pan/zoom for high-FPS fluidity; 280 points when idle for maximum fidelity
    const MAX_POINTS = (isPanningActive || isInteracting) ? 150 : 280
    if (count <= MAX_POINTS) {
      return filteredChartData
    }

    const step = Math.ceil(count / MAX_POINTS)
    const sampled: any[] = []

    for (let i = 0; i < count; i += step) {
      const chunk = filteredChartData.slice(i, Math.min(i + step, count))
      if (chunk.length === 0) continue

      const first = chunk[0]
      const last = chunk[chunk.length - 1]

      let high = -Infinity
      let low = Infinity
      let volume = 0
      let preservedSignal: 'buy' | 'sell' | undefined = undefined
      let preservedTrade: any = undefined
      let preservedSignalType: 'entry' | 'exit' | null | undefined = undefined
      let preservedSignalReason: string | undefined = undefined

      const chunkPortfolioSignals: any[] = []
      for (let j = 0; j < chunk.length; j++) {
        const bar = chunk[j]
        const barH = bar.high !== undefined ? bar.high : bar.close
        const barL = bar.low !== undefined ? bar.low : bar.close
        if (barH > high) high = barH
        if (barL < low) low = barL
        if (bar.volume) volume += bar.volume
        if (bar.signal) {
          preservedSignal = bar.signal
          preservedTrade = bar.trade
          preservedSignalType = bar.signalType
          preservedSignalReason = bar.signalReason
        }
        if (bar.portfolioSignals && bar.portfolioSignals.length > 0) {
          chunkPortfolioSignals.push(...bar.portfolioSignals)
        }
      }

      if (high === -Infinity) high = Math.max(first.close, last.close)
      if (low === Infinity) low = Math.min(first.close, last.close)

      const legCandleProps: Record<string, any> = {}
      const legSignalProps: Record<string, any> = {}
      if (backtestMode === 'portfolio') {
        portfolioLegs.forEach(leg => {
          let legH = -Infinity
          let legL = Infinity
          for (let j = 0; j < chunk.length; j++) {
            const b = chunk[j]
            const h = b[`high_${leg.id}`] !== undefined ? b[`high_${leg.id}`] : b[`close_${leg.id}`]
            const l = b[`low_${leg.id}`] !== undefined ? b[`low_${leg.id}`] : b[`close_${leg.id}`]
            if (h !== undefined && h > legH) legH = h
            if (l !== undefined && l < legL) legL = l
            if (b[`signal_${leg.id}`]) {
              legSignalProps[`signal_${leg.id}`] = b[`signal_${leg.id}`]
              legSignalProps[`signalType_${leg.id}`] = b[`signalType_${leg.id}`]
              legSignalProps[`signalReason_${leg.id}`] = b[`signalReason_${leg.id}`]
              legSignalProps[`signalSymbol_${leg.id}`] = b[`signalSymbol_${leg.id}`]
              legSignalProps[`trade_${leg.id}`] = b[`trade_${leg.id}`]
            }
          }
          const o = first[`open_${leg.id}`] !== undefined ? first[`open_${leg.id}`] : first[`close_${leg.id}`]
          const c = last[`close_${leg.id}`]
          if (legH !== -Infinity && legL !== Infinity) {
            legCandleProps[`open_${leg.id}`] = o
            legCandleProps[`close_${leg.id}`] = c
            legCandleProps[`high_${leg.id}`] = legH
            legCandleProps[`low_${leg.id}`] = legL
            legCandleProps[`wickRange_${leg.id}`] = [legL, legH]
            legCandleProps[`candleRange_${leg.id}`] = [Math.min(o || 0, c || 0), Math.max(o || 0, c || 0)]
          }
        })
      }

      sampled.push({
        ...last,
        ...legCandleProps,
        ...legSignalProps,
        open: first.open !== undefined ? first.open : first.close,
        high,
        low,
        close: last.close,
        wickRange: [low, high],
        volume,
        signal: preservedSignal !== undefined ? preservedSignal : last.signal,
        trade: preservedTrade !== undefined ? preservedTrade : last.trade,
        signalType: preservedSignalType !== undefined ? preservedSignalType : last.signalType,
        signalReason: preservedSignalReason !== undefined ? preservedSignalReason : last.signalReason,
        portfolioSignals: chunkPortfolioSignals.length > 0 ? chunkPortfolioSignals : last.portfolioSignals
      })
    }

    return sampled
  }, [filteredChartData, backtestMode, portfolioLegs, isPanningActive, isInteracting])

  const dynamicBarSize = useMemo(() => {
    const count = displayChartData.length
    if (count <= 0) return 8
    const approxWidth = 850
    const slot = approxWidth / count
    return Math.max(2, Math.min(10, Math.floor(slot * 0.72)))
  }, [displayChartData.length])

  const splineType = (displayChartData.length > 80 || isPanningActive || isInteracting) ? 'linear' : 'monotone'

  const formatXAxisTick = useCallback((timeStr: string) => {
    if (!timeStr) return ''
    try {
      const d = new Date(timeStr)
      if (isNaN(d.getTime())) return timeStr

      if (displayChartData && displayChartData.length > 0) {
        const firstTime = new Date(displayChartData[0]?.time).getTime()
        const lastTime = new Date(displayChartData[displayChartData.length - 1]?.time).getTime()
        const spanMs = Math.abs(lastTime - firstTime)
        const spanDays = spanMs / (1000 * 60 * 60 * 24)

        if (spanDays <= 1) {
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
        } else if (spanDays <= 5) {
          return `${d.toLocaleDateString([], { month: 'numeric', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
        } else if (spanDays <= 120) {
          if (timeframe === '1Day') {
            return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
          }
          return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`
        } else {
          return d.toLocaleDateString([], { month: 'short', year: '2-digit' })
        }
      }
      return d.toLocaleDateString()
    } catch {
      return timeStr
    }
  }, [displayChartData, timeframe])

  const startBarDate = useMemo(() => {
    if (filteredChartData.length === 0 || !filteredChartData[0]?.time) return ''
    try {
      const d = new Date(filteredChartData[0].time)
      return isNaN(d.getTime()) ? filteredChartData[0].time : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return '' }
  }, [filteredChartData])

  const endBarDate = useMemo(() => {
    if (filteredChartData.length === 0) return ''
    const last = filteredChartData[filteredChartData.length - 1]
    if (!last?.time) return ''
    try {
      const d = new Date(last.time)
      return isNaN(d.getTime()) ? last.time : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    } catch { return '' }
  }, [filteredChartData])

  const handleZoomIn = () => {
    if (totalBars <= 5) return
    const span = currentEnd - currentStart
    const newSpan = Math.max(5, Math.round(span * 0.72))
    const mid = (currentStart + currentEnd) / 2
    const half = newSpan / 2
    let newStart = Math.max(0, Math.round(mid - half))
    let newEnd = Math.min(totalBars - 1, newStart + newSpan)
    if (newEnd >= totalBars - 1) {
      newEnd = totalBars - 1
      newStart = Math.max(0, newEnd - newSpan)
    }
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handleZoomOut = () => {
    if (!isZoomed) return
    const span = currentEnd - currentStart
    const newSpan = Math.round(span * 1.38)
    if (newSpan >= totalBars - 1) {
      setZoomRange(null)
      return
    }
    const mid = (currentStart + currentEnd) / 2
    const half = newSpan / 2
    let newStart = Math.max(0, Math.round(mid - half))
    let newEnd = Math.min(totalBars - 1, newStart + newSpan)
    if (newEnd >= totalBars - 1) {
      newEnd = totalBars - 1
      newStart = Math.max(0, newEnd - newSpan)
    }
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handlePanLeft = () => {
    if (!isZoomed || currentStart <= 0) return
    const span = currentEnd - currentStart
    const shift = Math.max(1, Math.round(span * 0.2))
    const newStart = Math.max(0, currentStart - shift)
    const newEnd = newStart + span
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handlePanRight = () => {
    if (!isZoomed || currentEnd >= totalBars - 1) return
    const span = currentEnd - currentStart
    const shift = Math.max(1, Math.round(span * 0.2))
    const newEnd = Math.min(totalBars - 1, currentEnd + shift)
    const newStart = Math.max(0, newEnd - span)
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handlePreset = (pct: number) => {
    if (pct >= 1) {
      setZoomRange(null)
      return
    }
    const newSpan = Math.max(5, Math.round(totalBars * pct))
    const newStart = Math.max(0, totalBars - 1 - newSpan)
    const newEnd = totalBars - 1
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handleLastNBars = (n: number) => {
    if (n >= totalBars) {
      setZoomRange(null)
      return
    }
    const newStart = Math.max(0, totalBars - n)
    const newEnd = totalBars - 1
    setZoomRange({ start: newStart, end: newEnd })
  }

  const handleScrubberChange = (val: number) => {
    const span = currentEnd - currentStart
    const newStart = Math.max(0, Math.min(totalBars - 1 - span, val))
    const newEnd = Math.min(totalBars - 1, newStart + span)
    setZoomRange({ start: newStart, end: newEnd })
  }

  const panRafRef = useRef<number | null>(null)

  const handleChartMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0 || totalBars <= 5) return
    isDraggingPan.current = true
    panStartX.current = e.clientX
    panStartRange.current = { start: currentStart, end: currentEnd }
    setIsPanningActive(true)
  }

  const handleChartMouseMove = useCallback((e: MouseEvent) => {
    if (!isDraggingPan.current || !panStartRange.current) return
    const clientX = e.clientX

    if (panRafRef.current !== null) {
      cancelAnimationFrame(panRafRef.current)
    }

    triggerInteraction()

    panRafRef.current = requestAnimationFrame(() => {
      if (!isDraggingPan.current || !panStartRange.current) return
      const deltaX = clientX - panStartX.current
      if (Math.abs(deltaX) < 1) return

      const total = processedChartData.length
      if (total <= 5) return

      const span = panStartRange.current.end - panStartRange.current.start
      const approxWidth = window.innerWidth > 1400 ? 950 : 700
      const pxPerBar = Math.max(1, approxWidth / Math.max(1, span))
      const barsShift = Math.round(deltaX / pxPerBar)

      if (barsShift !== 0) {
        const newStart = Math.max(0, Math.min(total - 1 - span, panStartRange.current.start - barsShift))
        const newEnd = Math.min(total - 1, newStart + span)
        setZoomRange({ start: newStart, end: newEnd })
      }
    })
  }, [processedChartData.length, triggerInteraction])

  const handleChartMouseUp = useCallback(() => {
    if (panRafRef.current !== null) {
      cancelAnimationFrame(panRafRef.current)
      panRafRef.current = null
    }
    if (isDraggingPan.current) {
      isDraggingPan.current = false
      panStartRange.current = null
      setIsPanningActive(false)
    }
  }, [])

  useEffect(() => {
    window.addEventListener('mousemove', handleChartMouseMove)
    window.addEventListener('mouseup', handleChartMouseUp)
    return () => {
      if (panRafRef.current !== null) {
        cancelAnimationFrame(panRafRef.current)
      }
      window.removeEventListener('mousemove', handleChartMouseMove)
      window.removeEventListener('mouseup', handleChartMouseUp)
    }
  }, [handleChartMouseMove, handleChartMouseUp])

  const chartsContainerRef = useRef<HTMLDivElement>(null)
  const wheelAccumulatorRef = useRef(0)
  const panXAccumulatorRef = useRef(0)

  // Track height of chart column to dynamically scale evaluation panel height
  useEffect(() => {
    const el = chartsContainerRef.current
    if (!el) return
    const updateHeight = () => {
      if (el) {
        const h = el.getBoundingClientRect().height
        if (h > 0) setChartColumnHeight(Math.round(h))
      }
    }
    updateHeight()
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.height > 0) {
          setChartColumnHeight(Math.round(entry.contentRect.height))
        }
      }
    })
    ro.observe(el)
    window.addEventListener('resize', updateHeight)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateHeight)
    }
  }, [panelOrder, pricePanels, chartData.length])

  // Cleanup backtest animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearTimeout(animTimerRef.current)
      if (interactionTimerRef.current) clearTimeout(interactionTimerRef.current)
      if (dropTimeoutRef.current) clearTimeout(dropTimeoutRef.current)
    }
  }, [])

  // Non-passive wheel event listener on chart container for smooth continuous zoom and smooth horizontal panning
  useEffect(() => {
    const el = chartsContainerRef.current
    if (!el) return

    const onWheel = (e: WheelEvent) => {
      // 1. Continuous smooth zooming ONLY when Ctrl or Cmd is held (or trackpad pinch-to-zoom)
      if (e.ctrlKey || e.metaKey) {
        // Unconditionally prevent default browser viewport zoom and micro scroll drift
        e.preventDefault()

        if (totalBars <= 5 || Math.abs(e.deltaY) < 0.2) return
        triggerInteraction()

        const span = currentEnd - currentStart
        // Proportional continuous zoom factor based on deltaY
        const clampedDelta = Math.max(-80, Math.min(80, e.deltaY))
        const zoomFactor = Math.exp(clampedDelta * 0.0028)
        const newSpan = Math.max(5, Math.min(totalBars - 1, Math.round(span * zoomFactor)))

        if (newSpan >= totalBars - 1) {
          setZoomRange(null)
          return
        }

        // Focal zoom centered on cursor's relative horizontal position
        const rect = el.getBoundingClientRect()
        const mouseRatio = rect.width > 0 ? Math.max(0.05, Math.min(0.95, (e.clientX - rect.left) / rect.width)) : 0.5
        const focalBar = currentStart + span * mouseRatio

        let newStart = Math.max(0, Math.round(focalBar - newSpan * mouseRatio))
        let newEnd = Math.min(totalBars - 1, newStart + newSpan)
        if (newEnd >= totalBars - 1) {
          newEnd = totalBars - 1
          newStart = Math.max(0, newEnd - newSpan)
        }

        setZoomRange({ start: newStart, end: newEnd })
        return
      }

      // 2. Continuous horizontal panning ONLY if explicitly intending horizontal pan:
      // either holding Shift with wheel, or a clearly dominant horizontal trackpad swipe
      const isShiftPan = e.shiftKey && Math.abs(e.deltaY) > 3
      const isDominantHorizontalSwipe = Math.abs(e.deltaX) > 10 && Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2.5

      if ((isShiftPan || isDominantHorizontalSwipe) && totalBars > 5) {
        e.preventDefault()
        triggerInteraction()

        const scrollDelta = isShiftPan ? e.deltaY : e.deltaX
        panXAccumulatorRef.current += scrollDelta

        const span = currentEnd - currentStart
        const approxWidth = el.clientWidth || 900
        const pxPerBar = Math.max(1, approxWidth / Math.max(1, span))
        const shiftBars = panXAccumulatorRef.current / pxPerBar

        if (Math.abs(shiftBars) >= 1) {
          const barsToMove = Math.trunc(shiftBars)
          panXAccumulatorRef.current -= barsToMove * pxPerBar

          const newStart = Math.max(0, Math.min(totalBars - 1 - span, currentStart + barsToMove))
          const newEnd = Math.min(totalBars - 1, newStart + span)
          setZoomRange({ start: newStart, end: newEnd })
        }
      }
      // If regular vertical scrolling (or accidental drift), do NOT intercept or trigger interaction at all!
    }

    el.addEventListener('wheel', onWheel, { passive: false })

    return () => {
      el.removeEventListener('wheel', onWheel)
    }
  }, [totalBars, currentStart, currentEnd, triggerInteraction])

  const handleSelectTrade = (trade: TradeItem) => {
    if (totalBars <= 0) return
    const start = Math.max(0, trade.entryIdx - 8)
    const end = Math.min(totalBars - 1, trade.exitIdx + 8)
    setZoomRange({ start, end })
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', backgroundColor: th.bg, color: th.text, transition: 'background-color 0.2s, color 0.2s' }}>
      <div style={{ padding: '24px', maxWidth: '1750px', margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
        <QuantLabConfigPanel
          symbol={symbol} setSymbol={setSymbol}
          timeframe={timeframe} setTimeframe={setTimeframe}
          lookback={lookback} setLookback={setLookback}
          strategy={strategy} selectStrategy={selectStrategy}
          params={params} setParams={setParams}
          maxPositionSize={maxPositionSize} setMaxPositionSize={setMaxPositionSize}
          stopLoss={stopLoss} setStopLoss={setStopLoss}
          takeProfit={takeProfit} setTakeProfit={setTakeProfit}
          slippageBps={slippageBps} setSlippageBps={setSlippageBps}
          commission={commission} setCommission={setCommission}
          onDownloadCSV={downloadCSV}
          collapsed={configCollapsed} onToggleCollapse={handleToggleCollapse}
          backtestMode={backtestMode} setBacktestMode={setBacktestMode}
          entryOperator={entryOperator} setEntryOperator={setEntryOperator}
          entryRules={entryRules} setEntryRules={setEntryRules}
          exitOperator={exitOperator} setExitOperator={setExitOperator}
          exitRules={exitRules} setExitRules={setExitRules}
          darkMode={darkMode}
          savedStrategies={savedStrategies}
          onDeleteSaved={handleDeleteSaved}
          onLoadSaved={handleLoadSaved}
          savedSortKey={savedSortKey}
          setSavedSortKey={setSavedSortKey}
          portfolioLegs={portfolioLegs}
          setPortfolioLegs={setPortfolioLegs}
        />

        <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', alignItems: 'center', width: '100%', minWidth: 0 }}>
          {/* Static Left Action Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <button onClick={runBacktest} disabled={loading} style={{ padding: '8px 16px', backgroundColor: '#2563eb', color: '#fff', borderRadius: '8px', border: 'none', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
              {loading ? 'Running...' : <><Play size={14} /> Run Backtest</>}
            </button>

            {result && (
              <ClickAwayWrapper isOpen={saveModalOpen} onClose={() => { setSaveModalOpen(false); setSaveName('') }} style={{ position: 'relative' }}>
                <button onClick={() => setSaveModalOpen(!saveModalOpen)} style={{ padding: '8px 16px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', color: '#059669', borderRadius: '8px', border: `1px solid ${th.border}`, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
                  <Save size={14} /> Save Strategy
                </button>
                {saveModalOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '12px', zIndex: 80, boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.5)' : `0 4px 12px ${th.shadow}`, display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="Strategy name..." onKeyDown={e => { if (e.key === 'Enter') handleSaveStrategy() }}
                      style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '6px', border: `1px solid ${th.inputBorder}`, backgroundColor: th.inputBg, color: th.text, outline: 'none', width: '180px' }} />
                    <button onClick={handleSaveStrategy} disabled={!saveName.trim()}
                      style={{ padding: '6px 14px', fontSize: '12px', fontWeight: 700, backgroundColor: saveName.trim() ? '#059669' : th.border, color: '#fff', border: 'none', borderRadius: '6px', cursor: saveName.trim() ? 'pointer' : 'default' }}>Save</button>
                    <button onClick={() => { setSaveModalOpen(false); setSaveName('') }}
                      style={{ padding: '6px 10px', fontSize: '12px', fontWeight: 600, backgroundColor: 'transparent', color: th.textMuted, border: `1px solid ${th.border}`, borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                  </div>
                )}
              </ClickAwayWrapper>
            )}

            {result && (
              <button
                onClick={() => setEvalOpen(!evalOpen)}
                style={{
                  padding: '8px 14px',
                  backgroundColor: evalOpen ? (darkMode ? '#1e293b' : '#f0fdf4') : (darkMode ? '#0f172a' : '#f8fafc'),
                  color: evalOpen ? '#10b981' : th.textSec,
                  borderRadius: '8px',
                  border: `1px solid ${evalOpen ? '#10b981' : th.border}`,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '13px',
                  transition: 'all 0.15s ease'
                }}
                title="Toggle Evaluation Rail"
              >
                <Activity size={14} />
                {evalOpen ? 'Hide Evaluation Rail' : 'Show Evaluation Rail'}
              </button>
            )}

            <ClickAwayWrapper isOpen={indicatorDropdownOpen} onClose={() => setIndicatorDropdownOpen(false)} style={{ position: 'relative' }}>
              <button
                onClick={() => setIndicatorDropdownOpen(!indicatorDropdownOpen)}
                style={{
                  padding: '8px 14px',
                  fontSize: '13px',
                  fontWeight: 600,
                  border: `1px solid ${th.border}`,
                  borderRadius: '8px',
                  backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
                  color: th.text,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.15s ease'
                }}
              >
                <Layers size={14} color="#2563eb" />
                <span>Select Indicators</span>
                <ChevronDown size={13} color={th.textMuted} />
              </button>
              {indicatorDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: '6px', backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '8px', padding: '12px', zIndex: 70, boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.5)' : `0 4px 12px ${th.shadow}`, width: '160px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <CustomCheckbox checked={showRibbon} onChange={setShowRibbon} label="Ribbon" darkMode={darkMode} />
                  <CustomCheckbox checked={showBb} onChange={setShowBb} label="BB Bands" darkMode={darkMode} />
                  <CustomCheckbox checked={showRsi} onChange={setShowRsi} label="RSI" darkMode={darkMode} />
                  <CustomCheckbox checked={showMacd} onChange={setShowMacd} label="MACD" darkMode={darkMode} />
                  <CustomCheckbox checked={showVwap} onChange={setShowVwap} label="VWAP" darkMode={darkMode} />
                  <CustomCheckbox checked={showDonchian} onChange={setShowDonchian} label="Donchian" darkMode={darkMode} />
                  <CustomCheckbox checked={showAtr} onChange={setShowAtr} label="ATR" darkMode={darkMode} />
                  <CustomCheckbox checked={showIchimoku} onChange={setShowIchimoku} label="Ichimoku" darkMode={darkMode} />
                  <CustomCheckbox checked={showZScore} onChange={setShowZScore} label="Z-Score" darkMode={darkMode} />
                  <button onClick={() => setIndicatorDropdownOpen(false)} style={{ fontSize: '11px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', padding: '6px', cursor: 'pointer', textAlign: 'center', marginTop: '4px' }}>Done</button>
                </div>
              )}
            </ClickAwayWrapper>

            <button
              onClick={handleSyncChartParams}
              style={{
                padding: '8px 14px',
                fontSize: '13px',
                fontWeight: 600,
                border: `1px solid ${th.border}`,
                borderRadius: '8px',
                backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
                color: th.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                transition: 'all 0.15s ease'
              }}
              title="Sync chart parameters with active strategy settings"
            >
              <RefreshCw size={14} color="#7c3aed" />
              <span>Sync Params</span>
            </button>
          </div>

          {/* Horizontally Scrollable Active Indicators Strip */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              overflowX: 'auto',
              flex: 1,
              minWidth: 0,
              padding: '4px 2px',
              scrollbarWidth: 'thin'
            }}
          >
            {showRibbon && (
              <PortalPopover
                isOpen={ribbonOpen}
                onClose={() => setRibbonOpen(false)}
                darkMode={darkMode}
                width={280}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>Ribbon</span>
                    <button onClick={() => setRibbonOpen(!ribbonOpen)} title="Ribbon Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>Ribbon Settings</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '180px', overflowY: 'auto', paddingRight: '4px' }}>
                  {ribbonLines.map((line, idx) => (
                    <div key={line.id} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <CustomSelect
                        value={line.type}
                        onChange={v => handleUpdateRibbonLine(line.id, { type: v as any })}
                        options={[{ value: 'SMA', label: 'SMA' }, { value: 'EMA', label: 'EMA' }]}
                        darkMode={darkMode}
                        size="sm"
                        width={65}
                      />
                      <NumberStepper
                        value={line.period}
                        min={1}
                        max={500}
                        step={1}
                        darkMode={darkMode}
                        width={52}
                        onChange={val => handleUpdateRibbonLine(line.id, { period: val || 10 })}
                      />
                      <BuiltinColorPicker
                        color={line.color || DEFAULT_RIBBON_COLORS[idx % DEFAULT_RIBBON_COLORS.length]}
                        defaultColor={DEFAULT_RIBBON_COLORS[idx % DEFAULT_RIBBON_COLORS.length]}
                        onChange={hex => handleUpdateRibbonLine(line.id, { color: hex })}
                        onReset={() => handleUpdateRibbonLine(line.id, { color: undefined })}
                        darkMode={darkMode}
                        size={20}
                        title="Line color"
                      />
                      <button onClick={() => handleRemoveRibbonLine(line.id)} style={{ fontSize: '10px', width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#ef4444', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>-</button>
                    </div>
                  ))}
                </div>
                {ribbonLines.length < 10 && (
                  <button onClick={handleAddRibbonLine} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>+ Add Line</button>
                )}
                <button onClick={() => setRibbonOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showBb && (
              <PortalPopover
                isOpen={bbOpen}
                onClose={() => setBbOpen(false)}
                darkMode={darkMode}
                width={190}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>BB Bands</span>
                    <button onClick={() => setBbOpen(!bbOpen)} title="Bollinger Bands Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>BB Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Period: {bbPeriod}
                  <input type="range" min={5} max={50} value={bbPeriod} onChange={e => setBbPeriod(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Std Dev: {bbStdDev}
                  <input type="range" min={1} max={4} step={0.1} value={bbStdDev} onChange={e => setBbStdDev(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.bb || DEFAULT_INDICATOR_COLORS.bb}
                    defaultColor={DEFAULT_INDICATOR_COLORS.bb}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, bb: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.bb; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setBbOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showRsi && (
              <PortalPopover
                isOpen={rsiOpen}
                onClose={() => setRsiOpen(false)}
                darkMode={darkMode}
                width={190}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>RSI</span>
                    <button onClick={() => setRsiOpen(!rsiOpen)} title="RSI Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>RSI Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Period: {rsiPeriod}
                  <input type="range" min={5} max={50} value={rsiPeriod} onChange={e => setRsiPeriod(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Overbought: {rsiOverbought}
                  <input type="range" min={50} max={95} value={rsiOverbought} onChange={e => setRsiOverbought(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Oversold: {rsiOversold}
                  <input type="range" min={5} max={50} value={rsiOversold} onChange={e => setRsiOversold(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>RSI Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.rsi || DEFAULT_INDICATOR_COLORS.rsi}
                    defaultColor={DEFAULT_INDICATOR_COLORS.rsi}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, rsi: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.rsi; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setRsiOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showMacd && (
              <PortalPopover
                isOpen={macdOpen}
                onClose={() => setMacdOpen(false)}
                darkMode={darkMode}
                width={190}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>MACD</span>
                    <button onClick={() => setMacdOpen(!macdOpen)} title="MACD Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>MACD Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Fast: {macdFast}
                  <input type="range" min={5} max={50} value={macdFast} onChange={e => setMacdFast(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Slow: {macdSlow}
                  <input type="range" min={10} max={200} value={macdSlow} onChange={e => setMacdSlow(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Signal: {macdSignal}
                  <input type="range" min={3} max={20} value={macdSignal} onChange={e => setMacdSignal(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>MACD Line:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.macd || DEFAULT_INDICATOR_COLORS.macd}
                    defaultColor={DEFAULT_INDICATOR_COLORS.macd}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, macd: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.macd; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Signal Line:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.macdSignal || DEFAULT_INDICATOR_COLORS.macdSignal}
                    defaultColor={DEFAULT_INDICATOR_COLORS.macdSignal}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, macdSignal: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.macdSignal; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setMacdOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showDonchian && (
              <PortalPopover
                isOpen={donchianOpen}
                onClose={() => setDonchianOpen(false)}
                darkMode={darkMode}
                width={180}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>Donchian</span>
                    <button onClick={() => setDonchianOpen(!donchianOpen)} title="Donchian Channels Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>Donchian Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Period: {donchianPeriod}
                  <input type="range" min={5} max={100} value={donchianPeriod} onChange={e => setDonchianPeriod(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.donchian || DEFAULT_INDICATOR_COLORS.donchian}
                    defaultColor={DEFAULT_INDICATOR_COLORS.donchian}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, donchian: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.donchian; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setDonchianOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showAtr && (
              <PortalPopover
                isOpen={atrOpen}
                onClose={() => setAtrOpen(false)}
                darkMode={darkMode}
                width={180}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>ATR</span>
                    <button onClick={() => setAtrOpen(!atrOpen)} title="ATR Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>ATR Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Period: {atrPeriod}
                  <input type="range" min={5} max={100} value={atrPeriod} onChange={e => setAtrPeriod(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.atr || DEFAULT_INDICATOR_COLORS.atr}
                    defaultColor={DEFAULT_INDICATOR_COLORS.atr}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, atr: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.atr; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setAtrOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showIchimoku && (
              <PortalPopover
                isOpen={ichiOpen}
                onClose={() => setIchiOpen(false)}
                darkMode={darkMode}
                width={180}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>Ichimoku</span>
                    <button onClick={() => setIchiOpen(!ichiOpen)} title="Ichimoku Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>Ichimoku Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Tenkan: {ichiTenkan}
                  <input type="range" min={5} max={50} value={ichiTenkan} onChange={e => setIchiTenkan(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Kijun: {ichiKijun}
                  <input type="range" min={10} max={100} value={ichiKijun} onChange={e => setIchiKijun(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Senkou: {ichiSenkou}
                  <input type="range" min={20} max={150} value={ichiSenkou} onChange={e => setIchiSenkou(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Tenkan Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.ichiTenkan || DEFAULT_INDICATOR_COLORS.ichiTenkan}
                    defaultColor={DEFAULT_INDICATOR_COLORS.ichiTenkan}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, ichiTenkan: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.ichiTenkan; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setIchiOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}

            {showZScore && (
              <PortalPopover
                isOpen={zScoreOpen}
                onClose={() => setZScoreOpen(false)}
                darkMode={darkMode}
                width={180}
                trigger={
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', border: `1px solid ${th.border}`, borderRadius: '8px', padding: '6px 10px', backgroundColor: darkMode ? '#1e293b' : '#f8fafc', fontSize: '12px', fontWeight: 600, color: th.text, whiteSpace: 'nowrap' }}>
                    <span>Z-Score</span>
                    <button onClick={() => setZScoreOpen(!zScoreOpen)} title="Z-Score Settings" style={{ width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', color: th.textMuted, borderRadius: '4px' }}>
                      <Settings size={12} />
                    </button>
                  </div>
                }
              >
                <div style={{ fontSize: '10px', fontWeight: 600, color: th.text }}>Z-Score Settings</div>
                <label style={{ fontSize: '10px', color: th.textSec, display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  Window: {zScoreWindow}
                  <input type="range" min={5} max={100} value={zScoreWindow} onChange={e => setZScoreWindow(parseInt(e.target.value))} style={{ width: '100%', accentColor: '#2563eb' }} />
                </label>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textSec }}>Color:</span>
                  <BuiltinColorPicker
                    color={indicatorColors.zscore || DEFAULT_INDICATOR_COLORS.zscore}
                    defaultColor={DEFAULT_INDICATOR_COLORS.zscore}
                    onChange={hex => setIndicatorColors(prev => ({ ...prev, zscore: hex }))}
                    onReset={() => setIndicatorColors(prev => { const n = { ...prev }; delete n.zscore; return n })}
                    darkMode={darkMode}
                    size={20}
                  />
                </div>
                <button onClick={() => setZScoreOpen(false)} style={{ fontSize: '9px', fontWeight: 700, backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '3px', cursor: 'pointer', textAlign: 'center' }}>Close</button>
              </PortalPopover>
            )}
          </div>

          {/* Right Controls - Fixed position, never pushed off */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0, marginLeft: 'auto' }}>
            <div style={{ display: 'inline-flex', border: `1px solid ${th.inputBorder}`, borderRadius: '6px', overflow: 'hidden', backgroundColor: th.inputBg }}>
              <button onClick={() => setChartType('line')} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 600, border: 'none', backgroundColor: chartType === 'line' ? '#2563eb' : th.inputBg, color: chartType === 'line' ? '#fff' : th.textMuted, cursor: 'pointer' }}>
                Line
              </button>
              <button onClick={() => setChartType('candles')} style={{ padding: '5px 11px', fontSize: '11px', fontWeight: 600, border: 'none', backgroundColor: chartType === 'candles' ? '#2563eb' : th.inputBg, color: chartType === 'candles' ? '#fff' : th.textMuted, cursor: 'pointer' }}>
                Candles
              </button>
            </div>

            <CustomCheckbox checked={showPrice} onChange={setShowPrice} label="Price" darkMode={darkMode} />
            <CustomCheckbox checked={showPnL} onChange={setShowPnL} label="PnL" darkMode={darkMode} />

            {backtestMode === 'portfolio' ? (
              <div style={{ position: 'relative' }}>
                <button
                  onClick={() => setSignalDropdownOpen(p => !p)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '5px 10px',
                    fontSize: '11px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: `1px solid ${signalDropdownOpen ? '#2563eb' : th.inputBorder}`,
                    backgroundColor: signalDropdownOpen ? (darkMode ? '#1e3a8a' : '#eff6ff') : th.inputBg,
                    color: signalDropdownOpen ? '#2563eb' : th.text,
                    cursor: 'pointer'
                  }}
                  title="Toggle buy & sell signal markers across portfolio price action and PnL"
                >
                  <span>Markers ▾</span>
                  <span style={{
                    fontSize: '9px',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '4px',
                    backgroundColor: showMarkers && portfolioLegs.some(l => visibleSignals[l.id] !== false) ? (darkMode ? '#064e3b' : '#ecfdf5') : (darkMode ? '#334155' : '#e2e8f0'),
                    color: showMarkers && portfolioLegs.some(l => visibleSignals[l.id] !== false) ? '#10b981' : th.textMuted
                  }}>
                    {!showMarkers ? 'Off' : `${portfolioLegs.filter(l => visibleSignals[l.id] !== false).length}/${portfolioLegs.length}`}
                  </span>
                </button>
                {signalDropdownOpen && (
                  <ClickAwayWrapper isOpen={signalDropdownOpen} onClose={() => setSignalDropdownOpen(false)} style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    width: '200px',
                    backgroundColor: th.bgCard,
                    border: `1px solid ${th.border}`,
                    borderRadius: '8px',
                    padding: '8px 10px',
                    boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.6)' : '0 4px 16px rgba(0,0,0,0.1)',
                    zIndex: 80
                  }}>
                    <div style={{ fontSize: '10px', fontWeight: 800, color: th.textMuted, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                      Signal Markers (Price & PnL)
                    </div>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 700, color: th.text, borderBottom: `1px solid ${th.border}`, paddingBottom: '6px', marginBottom: '4px' }}>
                      <input
                        type="checkbox"
                        checked={showMarkers && portfolioLegs.every(l => visibleSignals[l.id] !== false)}
                        onChange={(e) => {
                          const checked = e.target.checked
                          setShowMarkers(checked)
                          const updated: Record<string, boolean> = {}
                          portfolioLegs.forEach(l => { updated[l.id] = checked })
                          setVisibleSignals(updated)
                        }}
                        style={{ accentColor: '#2563eb', cursor: 'pointer' }}
                      />
                      <span>All Signal Markers</span>
                    </label>
                    {portfolioLegs.map((leg, idx) => {
                      const isLegOn = showMarkers && visibleSignals[leg.id] !== false
                      const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                      return (
                        <label key={`topbar-sig-${leg.id}`} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: th.text }}>
                          <input
                            type="checkbox"
                            checked={isLegOn}
                            onChange={(e) => {
                              const checked = e.target.checked
                              const nextVisible = { ...visibleSignals, [leg.id]: checked }
                              setVisibleSignals(nextVisible)
                              if (checked) {
                                setShowMarkers(true)
                              } else if (portfolioLegs.every(l => (l.id === leg.id ? false : nextVisible[l.id] === false))) {
                                setShowMarkers(false)
                              }
                            }}
                            style={{ accentColor: legColor, cursor: 'pointer' }}
                          />
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: legColor, display: 'inline-block' }} />
                          <span>{leg.symbol} Signals (▲/▼)</span>
                        </label>
                      )
                    })}
                  </ClickAwayWrapper>
                )}
              </div>
            ) : (
              <CustomCheckbox checked={showMarkers} onChange={setShowMarkers} label="Markers" darkMode={darkMode} />
            )}

            <div style={{ width: '1px', height: '20px', backgroundColor: th.border, flexShrink: 0 }} />

            <button onClick={() => setDarkMode(!darkMode)} style={{ width: 34, height: 34, borderRadius: '8px', border: `1px solid ${th.border}`, backgroundColor: th.bgCard, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease' }}>
              {darkMode ? <Sun size={16} color="#f59e0b" /> : <Moon size={16} color="#64748b" />}
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: evalOpen && result ? 'minmax(0, 1fr) 420px' : '1fr',
            gap: '20px',
            alignItems: 'start'
          }}
        >
          {/* Main Chart Column */}
          <div ref={chartsContainerRef} style={{ display: 'flex', flexDirection: 'column', gap: '12px', minWidth: 0, touchAction: 'pan-y', overscrollBehavior: 'contain' }}>
            {chartData.length === 0 ? (
              <div
                style={{
                  backgroundColor: th.bgCard,
                  border: `1px solid ${th.border}`,
                  borderRadius: '12px',
                  padding: '70px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  minHeight: '380px',
                  boxShadow: `0 1px 3px ${th.shadow}`
                }}
              >
                <div
                  style={{
                    width: 58,
                    height: 58,
                    borderRadius: 16,
                    backgroundColor: darkMode ? '#1e293b' : '#eff6ff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                    border: `1px solid ${darkMode ? '#334155' : '#dbeafe'}`
                  }}
                >
                  <Activity size={30} color="#2563eb" />
                </div>
                <div style={{ fontSize: '17px', fontWeight: 800, color: th.text, marginBottom: 8, letterSpacing: '0.2px' }}>
                  No Strategy Executed Yet
                </div>
                <div style={{ fontSize: '13px', color: th.textMuted, maxWidth: '440px', lineHeight: 1.6, marginBottom: 22 }}>
                  Configure your strategy rules and risk parameters above, then click <strong>Run Backtest</strong> to load market bars, simulate execution, and view full performance analytics.
                </div>
                <button
                  onClick={runBacktest}
                  disabled={loading}
                  style={{
                    padding: '9px 20px',
                    backgroundColor: '#2563eb',
                    color: '#fff',
                    borderRadius: '8px',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '13px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <Play size={14} /> Run Backtest
                </button>
              </div>
            ) : (
              <>
                {/* Synchronized Zoom & Pan Controller Toolbar */}
                <div
                  style={{
                    backgroundColor: th.bgCard,
                    border: `1px solid ${th.border}`,
                borderRadius: '10px',
                padding: '9px 13px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxShadow: `0 1px 3px ${th.shadow}`
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                {/* Left: Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleZoomIn}
                    disabled={totalBars <= 5 || visibleCount <= 6}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: `1px solid ${th.border}`,
                      backgroundColor: th.inputBg,
                      color: (totalBars <= 5 || visibleCount <= 6) ? th.textMuted : th.text,
                      cursor: (totalBars <= 5 || visibleCount <= 6) ? 'not-allowed' : 'pointer'
                    }}
                    title="Zoom In (or hold Ctrl/Cmd and scroll wheel up on charts)"
                  >
                    <ZoomIn size={13} /> Zoom In
                  </button>

                  <button
                    onClick={handleZoomOut}
                    disabled={!isZoomed}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: `1px solid ${th.border}`,
                      backgroundColor: th.inputBg,
                      color: !isZoomed ? th.textMuted : th.text,
                      cursor: !isZoomed ? 'not-allowed' : 'pointer'
                    }}
                    title="Zoom Out (or hold Ctrl/Cmd and scroll wheel down on charts)"
                  >
                    <ZoomOut size={13} /> Zoom Out
                  </button>

                  <button
                    onClick={() => setZoomRange(null)}
                    disabled={!isZoomed}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: '4px 9px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: `1px solid ${isZoomed ? '#2563eb' : th.border}`,
                      backgroundColor: isZoomed ? (darkMode ? '#1e3a8a' : '#eff6ff') : th.inputBg,
                      color: isZoomed ? '#2563eb' : th.textMuted,
                      cursor: !isZoomed ? 'not-allowed' : 'pointer'
                    }}
                    title="Reset zoom to view all bars"
                  >
                    <RotateCcw size={13} /> Reset
                  </button>

                  <div style={{ width: '1px', height: '16px', backgroundColor: th.border, margin: '0 2px' }} />

                  <button
                    onClick={handlePanLeft}
                    disabled={!isZoomed || currentStart === 0}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: `1px solid ${th.border}`,
                      backgroundColor: th.inputBg,
                      color: (!isZoomed || currentStart === 0) ? th.textMuted : th.text,
                      cursor: (!isZoomed || currentStart === 0) ? 'not-allowed' : 'pointer'
                    }}
                    title="Pan Left (move backwards in time)"
                  >
                    <ChevronLeft size={13} /> Pan Left
                  </button>

                  <button
                    onClick={handlePanRight}
                    disabled={!isZoomed || currentEnd >= totalBars - 1}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      padding: '4px 8px',
                      fontSize: '11px',
                      fontWeight: 700,
                      borderRadius: '6px',
                      border: `1px solid ${th.border}`,
                      backgroundColor: th.inputBg,
                      color: (!isZoomed || currentEnd >= totalBars - 1) ? th.textMuted : th.text,
                      cursor: (!isZoomed || currentEnd >= totalBars - 1) ? 'not-allowed' : 'pointer'
                    }}
                    title="Pan Right (move forward in time)"
                  >
                    Pan Right <ChevronRight size={13} />
                  </button>

                  <div style={{ width: '1px', height: '16px', backgroundColor: th.border, margin: '0 2px' }} />

                  {/* Presets */}
                  <div style={{ display: 'inline-flex', gap: '3px' }}>
                    {[
                      { label: 'All', fn: () => setZoomRange(null), active: !isZoomed },
                      { label: '50%', fn: () => handlePreset(0.5), active: isZoomed && Math.abs(visibleCount / Math.max(1, totalBars) - 0.5) < 0.1 },
                      { label: '25%', fn: () => handlePreset(0.25), active: isZoomed && Math.abs(visibleCount / Math.max(1, totalBars) - 0.25) < 0.08 },
                      ...(totalBars > 30 ? [{ label: 'Last 30b', fn: () => handleLastNBars(30), active: isZoomed && visibleCount === 30 && currentEnd === totalBars - 1 }] : [])
                    ].map(p => (
                      <button
                        key={p.label}
                        onClick={p.fn}
                        style={{
                          padding: '3px 7px',
                          fontSize: '10px',
                          fontWeight: 700,
                          borderRadius: '5px',
                          border: p.active ? '1px solid #2563eb' : `1px solid ${th.border}`,
                          backgroundColor: p.active ? '#2563eb' : th.bgAlt,
                          color: p.active ? '#fff' : th.textSec,
                          cursor: 'pointer'
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Right: Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: th.textSec, marginLeft: 'auto' }}>
                  {startBarDate && endBarDate && (
                    <span style={{ fontWeight: 600 }}>
                      {startBarDate} → {endBarDate}
                    </span>
                  )}
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: '4px',
                      backgroundColor: isZoomed ? (darkMode ? '#1e3a8a' : '#dbeafe') : (darkMode ? '#1e293b' : '#f1f5f9'),
                      color: isZoomed ? '#2563eb' : th.textMuted
                    }}
                  >
                    {visibleCount} of {totalBars} bars ({Math.round((visibleCount / Math.max(1, totalBars)) * 100)}%)
                  </span>
                  {displayChartData.length < filteredChartData.length && (
                    <span
                      style={{
                        fontSize: '9px',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: darkMode ? 'rgba(16,185,129,0.15)' : '#ecfdf5',
                        color: '#10b981',
                        border: '1px solid rgba(16,185,129,0.3)'
                      }}
                      title="Adaptive Level-of-Detail is active to keep rendering butter-smooth at 60 FPS. Zoom in to view raw unaggregated bars."
                    >
                      LOD Optimized ({displayChartData.length} pts)
                    </span>
                  )}
                  <span
                    style={{ fontSize: '10px', color: th.textMuted }}
                    title="You can also drag on any chart to pan horizontally, or hold Ctrl/Cmd and scroll to zoom in/out."
                  >
                    Drag to pan · Ctrl+Scroll
                  </span>
                </div>
              </div>

              {/* Scrubber slider when zoomed */}
              {isZoomed && totalBars > visibleCount && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '4px', borderTop: `1px solid ${th.border}` }}>
                  <span style={{ fontSize: '10px', color: th.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    Timeline Scrubber:
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={totalBars - visibleCount}
                    value={currentStart}
                    onChange={e => handleScrubberChange(parseInt(e.target.value))}
                    style={{
                      flex: 1,
                      accentColor: '#2563eb',
                      cursor: 'ew-resize',
                      height: '6px'
                    }}
                    title="Slide to move viewport across time"
                  />
                  <span style={{ fontSize: '10px', color: th.textMuted, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    Bar {currentStart + 1}–{currentEnd + 1}
                  </span>
                </div>
              )}
            </div>

        {panelOrder.map((panelId, pIdx) => {
          if (panelId === 'price' || panelId.startsWith('price_panel_')) {
            if (!showPrice) return null
            if (backtestMode === 'portfolio') {
              const curPricePanel = pricePanels.find(p => p.id === panelId)
              // Skip orphaned panels that exist in panelOrder but not in pricePanels
              if (!curPricePanel && panelId !== 'price') return null
              const resolvedPanel = curPricePanel || { id: panelId, viewMode: priceActionViewMode }
              const curView = resolvedPanel.viewMode

              if (curView === 'overlay') {
                return (
                  <div key={`panel-price-${panelId}`} {...getDraggablePanelProps(pIdx)}>
                    {renderDragHandle(pIdx)}
                    <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: th.text }}>Portfolio Price Action</span>
                          <span style={{ fontSize: '10px', fontWeight: 600, color: th.textMuted, backgroundColor: darkMode ? '#1e293b' : '#f1f5f9', padding: '2px 7px', borderRadius: '4px' }}>{timeframe}</span>
                          <SegmentedSlider
                            options={priceSliderOptions}
                            value={curView}
                            onChange={(val) => handleUpdatePricePanelViewMode(resolvedPanel.id, val)}
                            darkMode={darkMode}
                            size="xs"
                          />
                          {displayChartData.length > 0 && portfolioLegs.map((leg, idx) => {
                            const lastBar = displayChartData[displayChartData.length - 1]
                            const pVal = lastBar ? (lastBar[`close_${leg.id}`] ?? lastBar.close) : null
                            const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                            return (
                              <span
                                key={leg.id}
                                style={{
                                  fontSize: '10px',
                                  fontWeight: 700,
                                  color: legColor,
                                  backgroundColor: darkMode ? '#1e293b' : '#f8fafc',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  border: `1px solid ${th.border}`
                                }}
                              >
                                {leg.symbol}: {typeof pVal === 'number' ? `$${pVal.toFixed(2)}` : '--'}
                              </span>
                            )
                          })}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {pricePanels.length < portfolioLegs.length && (
                            <button
                              onClick={handleAddPricePanel}
                              style={{
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: '#0284c7',
                                color: '#fff',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="Add an individual moveable price chart for another portfolio asset"
                            >
                              + Add Stock Chart
                            </button>
                          )}
                          {pricePanels.length > 1 && panelId !== 'price' && (
                            <button
                              onClick={() => handleRemovePricePanel(resolvedPanel.id)}
                              style={{
                                padding: '3px 8px',
                                fontSize: '10px',
                                fontWeight: 700,
                                backgroundColor: 'transparent',
                                color: '#ef4444',
                                border: 'none',
                                cursor: 'pointer'
                              }}
                              title="Remove this price chart panel"
                            >
                              ✕ Remove
                            </button>
                          )}
                          <span style={{ fontSize: '10px', fontWeight: 600, color: th.textMuted, backgroundColor: darkMode ? '#1e293b' : '#f8fafc', padding: '2px 8px', borderRadius: '4px', border: `1px solid ${th.border}` }}>
                            {portfolioLegs.length} Color-Coded Y-Axes
                          </span>
                        </div>
                      </div>
                      <div key={`chart-sweep-overlay-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '340px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart
                            barGap="-100%"
                            data={displayChartData}
                            margin={{
                              top: 24,
                              right: portfolioLegs.length > 2 ? 15 : 10,
                              left: portfolioLegs.length > 2 ? 15 : 5,
                              bottom: 5
                            }}
                          >
                            <XAxis
                              dataKey="time"
                              height={20}
                              tickLine={false}
                              axisLine={{ stroke: th.border, strokeWidth: 1 }}
                              tick={{ fill: th.textMuted, fontSize: 9.5 }}
                              tickFormatter={formatXAxisTick}
                              minTickGap={50}
                              interval="preserveStartEnd"
                            />
                            {portfolioLegs.map((leg, idx) => {
                              const orientation = idx % 2 === 0 ? 'left' : 'right'
                              const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                              return (
                                <YAxis
                                  key={`yaxis-${leg.id}`}
                                  yAxisId={`axis_${idx}`}
                                  orientation={orientation}
                                  domain={['dataMin - 1', 'dataMax + 1']}
                                  hide={false}
                                  width={52}
                                  tickFormatter={(val) => `$${val.toFixed(0)}`}
                                  stroke={legColor}
                                  style={{ fontSize: '10px', fontWeight: 600 }}
                                  tickLine={{ stroke: legColor }}
                                />
                              )
                            })}
                            <Tooltip content={<CustomTooltip darkMode={darkMode} isPortfolioOverlay={true} portfolioLegs={portfolioLegs} />} />
                            <Legend
                              verticalAlign="top"
                              align="right"
                              height={24}
                              iconSize={10}
                              wrapperStyle={{ fontSize: '11px', top: 2, right: 10 }}
                              formatter={(value) => <span style={{ color: th.text, fontSize: '11px', fontWeight: 600, marginRight: '8px' }}>{value}</span>}
                            />
                            {portfolioLegs.map((leg, idx) => {
                              const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                              return (
                                <Line
                                  key={`line-${leg.id}`}
                                  yAxisId={`axis_${idx}`}
                                  type={splineType}
                                  dataKey={`close_${leg.id}`}
                                  stroke={legColor}
                                  strokeWidth={2.2}
                                  dot={showMarkers ? ((legDotRenderers[leg.id] || renderDot) as any) : false}
                                  name={`${leg.symbol} ($)`}
                                  isAnimationActive={false}
                                />
                              )
                            })}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )
              }

              // Single Leg view in portfolio mode (e.g. curView)
              const activeLeg = portfolioLegs.find(l => l.id === curView) || portfolioLegs[0]
              const activeIdx = portfolioLegs.findIndex(l => l.id === activeLeg.id)
              const legColor = activeLeg.color || LEG_COLORS[activeIdx >= 0 ? activeIdx % LEG_COLORS.length : 0]

              // Calculate dedicated Y-axis domain based strictly on this active stock's price action
              const legPrices = displayChartData
                .map(d => [d[`open_${activeLeg.id}`], d[`high_${activeLeg.id}`], d[`low_${activeLeg.id}`], d[`close_${activeLeg.id}`]])
                .flat()
                .filter(v => typeof v === 'number' && !isNaN(v) && v > 0)
              const minP = legPrices.length > 0 ? Math.min(...legPrices) : 0
              const maxP = legPrices.length > 0 ? Math.max(...legPrices) : 100
              const pad = Math.max(1, (maxP - minP) * 0.05)
              const yDomain = [Math.max(0, Math.floor(minP - pad)), Math.ceil(maxP + pad)]

              return (
                <div key={`panel-price-${panelId}`} {...getDraggablePanelProps(pIdx)}>
                  {renderDragHandle(pIdx)}
                  <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '12px', fontWeight: 700, color: th.text }}>{activeLeg.symbol} Price Action</span>
                        <span style={{ fontSize: '10px', fontWeight: 600, color: th.textMuted, backgroundColor: darkMode ? '#1e293b' : '#f8fafc', padding: '2px 7px', borderRadius: '4px' }}>{timeframe}</span>
                        <span style={{ fontSize: '10px', fontWeight: 800, color: '#fff', backgroundColor: legColor, padding: '2px 7px', borderRadius: '4px' }}>
                          Leg {activeIdx + 1} ({activeLeg.allocationPct}%)
                        </span>
                        <SegmentedSlider
                          options={priceSliderOptions}
                          value={curView}
                          onChange={(val) => handleUpdatePricePanelViewMode(resolvedPanel.id, val)}
                          darkMode={darkMode}
                          size="xs"
                        />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {pricePanels.length < portfolioLegs.length && (
                          <button
                            onClick={handleAddPricePanel}
                            style={{
                              padding: '3px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: '#0284c7',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              transition: 'all 0.15s ease'
                            }}
                            title="Add an individual moveable price chart for another portfolio asset"
                          >
                            + Add Stock Chart
                          </button>
                        )}
                        {pricePanels.length > 1 && panelId !== 'price' && (
                          <button
                            onClick={() => handleRemovePricePanel(resolvedPanel.id)}
                            style={{
                              padding: '3px 8px',
                              fontSize: '10px',
                              fontWeight: 700,
                              backgroundColor: 'transparent',
                              color: '#ef4444',
                              border: 'none',
                              cursor: 'pointer'
                            }}
                            title="Remove this price chart panel"
                          >
                            ✕ Remove
                          </button>
                        )}
                      </div>
                    </div>
                    <div key={`chart-sweep-single-${activeLeg.id}-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '320px', width: '100%' }}>
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart barGap="-100%" data={displayChartData} margin={{ top: 24, right: 10, left: 5, bottom: 5 }}>
                          <XAxis
                            dataKey="time"
                            height={20}
                            tickLine={false}
                            axisLine={{ stroke: th.border, strokeWidth: 1 }}
                            tick={{ fill: th.textMuted, fontSize: 9.5 }}
                            tickFormatter={formatXAxisTick}
                            minTickGap={50}
                            interval="preserveStartEnd"
                          />
                          <YAxis yAxisId="left" domain={yDomain} hide={false} width={55} tickFormatter={(val) => `$${val.toFixed(2)}`} style={{ fontSize: '10px' }} stroke={legColor} />
                          <Tooltip content={<CustomTooltip darkMode={darkMode} activeLegId={activeLeg.id} activeLegSymbol={activeLeg.symbol} />} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            height={24}
                            iconSize={10}
                            wrapperStyle={{ fontSize: '11px', top: 2, right: 10 }}
                            formatter={(value) => <span style={{ color: th.textSec, fontSize: '11px', marginRight: '6px' }}>{value}</span>}
                          />
                          {showPrice ? (
                            chartType === 'line' ? (
                              <Line yAxisId="left" type={splineType} dataKey={`close_${activeLeg.id}`} stroke={legColor} strokeWidth={2} dot={showMarkers ? ((legDotRenderers[activeLeg.id] || renderDot) as any) : false} name={`${activeLeg.symbol} Price`} isAnimationActive={false} />
                            ) : (
                              <>
                                <Bar yAxisId="left" dataKey={`wickRange_${activeLeg.id}`} barSize={dynamicBarSize} shape={(p: any) => <CustomCandlestick {...p} open={p.payload[`open_${activeLeg.id}`]} close={p.payload[`close_${activeLeg.id}`]} high={p.payload[`high_${activeLeg.id}`]} low={p.payload[`low_${activeLeg.id}`]} showMarkers={showMarkers} darkMode={darkMode} legId={activeLeg.id} visibleSignals={visibleSignals} />} name={`${activeLeg.symbol} Candles`} isAnimationActive={false} />
                                <Line yAxisId="left" type={splineType} dataKey={`close_${activeLeg.id}`} stroke="transparent" activeDot={false} dot={false} legendType="none" isAnimationActive={false} />
                              </>
                            )
                          ) : (
                            <Line yAxisId="left" type={splineType} dataKey={`close_${activeLeg.id}`} stroke="transparent" activeDot={false} dot={showMarkers ? ((legDotRenderers[activeLeg.id] || renderDot) as any) : false} legendType="none" isAnimationActive={false} />
                          )}
                          {showRibbon && ribbonLines.map((line, idx) => {
                            if (line.period <= 0) return null;
                            const colors = DEFAULT_RIBBON_COLORS;
                            return <Line key={`ribbon-line-${activeLeg.id}-${line.id}`} yAxisId="left" type={splineType} dataKey={`ribbon_${activeLeg.id}_${line.type.toLowerCase()}_${line.period}`} stroke={line.color || colors[idx % colors.length]} strokeWidth={1.5} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} ${line.type} ${line.period}`} />
                          })}
                          {showBb && <Line yAxisId="left" type={splineType} dataKey={`bbUpper_${activeLeg.id}`} stroke={indicatorColors.bb || '#94a3b8'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} BB Upper`} />}
                          {showBb && <Line yAxisId="left" type={splineType} dataKey={`bbMiddle_${activeLeg.id}`} stroke={indicatorColors.bb || '#cbd5e1'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} BB Middle`} />}
                          {showBb && <Line yAxisId="left" type={splineType} dataKey={`bbLower_${activeLeg.id}`} stroke={indicatorColors.bb || '#94a3b8'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} BB Lower`} />}
                          {showVwap && <Line yAxisId="left" type={splineType} dataKey={`vwap_${activeLeg.id}`} stroke="#eab308" strokeWidth={1.5} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} VWAP`} />}
                          {showDonchian && <Line yAxisId="left" type="stepAfter" dataKey={`donchianUpper_${activeLeg.id}`} stroke={indicatorColors.donchian || '#8b5cf6'} strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} Donchian Upper`} />}
                          {showDonchian && <Line yAxisId="left" type="stepAfter" dataKey={`donchianLower_${activeLeg.id}`} stroke={indicatorColors.donchian || '#8b5cf6'} strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} name={`${activeLeg.symbol} Donchian Lower`} />}
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )
            }

            // Single / Multi-Rule stock mode
            return (
              <div key="panel-price" {...getDraggablePanelProps(pIdx)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: th.text, display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{symbol} Price Action</span>
                      <span style={{ fontSize: '10px', fontWeight: 600, color: th.textMuted, backgroundColor: darkMode ? '#1e293b' : '#f1f5f9', padding: '2px 7px', borderRadius: '4px' }}>{timeframe}</span>
                    </div>
                  </div>
                  <div key={`chart-sweep-price-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '320px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart barGap="-100%" data={displayChartData} margin={{ top: 24, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={20}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9.5 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis yAxisId="left" domain={['dataMin - 5', 'dataMax + 5']} hide={false} width={55} tickFormatter={(val) => `$${val.toFixed(2)}`} style={{ fontSize: '10px' }} stroke={th.textMuted} />
                        <Tooltip content={<CustomTooltip darkMode={darkMode} />} />
                        <Legend
                          verticalAlign="top"
                          align="right"
                          height={24}
                          iconSize={10}
                          wrapperStyle={{ fontSize: '11px', top: 2, right: 10 }}
                          formatter={(value) => <span style={{ color: th.textSec, fontSize: '11px', marginRight: '6px' }}>{value}</span>}
                        />
                        {showPrice ? (
                          chartType === 'line' ? (
                            <Line yAxisId="left" type={splineType} dataKey="close" stroke="#2563eb" strokeWidth={1.5} dot={showMarkers ? (renderDot as any) : false} name={`${symbol} Price`} isAnimationActive={false} />
                          ) : (
                            <>
                              <Bar yAxisId="left" dataKey="wickRange" barSize={dynamicBarSize} shape={(p: any) => <CustomCandlestick {...p} showMarkers={showMarkers} darkMode={darkMode} />} name={`${symbol} Candles`} isAnimationActive={false} />
                              <Line yAxisId="left" type={splineType} dataKey="close" stroke="transparent" activeDot={false} dot={false} legendType="none" isAnimationActive={false} />
                            </>
                          )
                        ) : (
                          <Line yAxisId="left" type={splineType} dataKey="close" stroke="transparent" activeDot={false} dot={showMarkers ? (renderDot as any) : false} legendType="none" isAnimationActive={false} />
                        )}
                        {showRibbon && ribbonLines.map((line, idx) => {
                          if (line.period <= 0) return null;
                          const colors = DEFAULT_RIBBON_COLORS;
                          return <Line key={`ribbon-line-${line.id}`} yAxisId="left" type={splineType} dataKey={`ribbon_${line.type.toLowerCase()}_${line.period}`} stroke={line.color || colors[idx % colors.length]} strokeWidth={1.5} dot={false} isAnimationActive={false} name={`${line.type} ${line.period}`} />
                        })}
                        {showBb && <Line yAxisId="left" type={splineType} dataKey="bbUpper" stroke={indicatorColors.bb || '#94a3b8'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name="BB Upper" />}
                        {showBb && <Line yAxisId="left" type={splineType} dataKey="bbMiddle" stroke={indicatorColors.bb || '#cbd5e1'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name="BB Middle" />}
                        {showBb && <Line yAxisId="left" type={splineType} dataKey="bbLower" stroke={indicatorColors.bb || '#94a3b8'} strokeDasharray="3 3" strokeWidth={1} dot={false} isAnimationActive={false} name="BB Lower" />}
                        {showVwap && <Line yAxisId="left" type={splineType} dataKey="vwap" stroke="#eab308" strokeWidth={1.5} dot={false} isAnimationActive={false} name="VWAP" />}
                        {showDonchian && <Line yAxisId="left" type="stepAfter" dataKey="donchianUpper" stroke={indicatorColors.donchian || '#8b5cf6'} strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} name="Donchian Upper" />}
                        {showDonchian && <Line yAxisId="left" type="stepAfter" dataKey="donchianLower" stroke={indicatorColors.donchian || '#8b5cf6'} strokeDasharray="4 4" strokeWidth={1} dot={false} isAnimationActive={false} name="Donchian Lower" />}
                        {showIchimoku && <Line yAxisId="left" type={splineType} dataKey="ichiTenkan" stroke={indicatorColors.ichiTenkan || '#3b82f6'} strokeWidth={1} dot={false} isAnimationActive={false} name="Tenkan-sen" />}
                        {showIchimoku && <Line yAxisId="left" type={splineType} dataKey="ichiKijun" stroke={indicatorColors.ichiKijun || '#ef4444'} strokeWidth={1} dot={false} isAnimationActive={false} name="Kijun-sen" />}
                        {showIchimoku && <Line yAxisId="left" type="stepAfter" dataKey="ichiSenkouA" stroke={indicatorColors.ichiSenkouA || '#10b981'} strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} name="Senkou Span A" />}
                        {showIchimoku && <Line yAxisId="left" type="stepAfter" dataKey="ichiSenkouB" stroke={indicatorColors.ichiSenkouB || '#f43f5e'} strokeWidth={1} strokeDasharray="2 2" dot={false} isAnimationActive={false} name="Senkou Span B" />}
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'rsi' && showRsi) {
            if (backtestMode === 'portfolio') {
              return (
                <div key="panel-rsi-multi" style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                  {rsiPanels.map((rsiCfg) => {
                    const legIdx = portfolioLegs.findIndex(l => l.id === rsiCfg.legId)
                    const leg = portfolioLegs[legIdx] || portfolioLegs[0]
                    const legColor = leg?.color || LEG_COLORS[legIdx >= 0 ? legIdx % LEG_COLORS.length : 0]
                    return (
                      <div
                        key={`panel-rsi-${rsiCfg.id}`}
                        {...getDraggablePanelProps(pIdx)}
                      >
                        {renderDragHandle(pIdx)}
                        <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '11px', fontWeight: 700, color: th.text }}>RSI ({rsiCfg.period})</span>
                              <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff', backgroundColor: legColor, padding: '1px 6px', borderRadius: '3px' }}>
                                {leg?.symbol || 'STOCK'}
                              </span>
                              <SegmentedSlider
                                options={portfolioLegs.map((l, i) => ({ value: l.id, label: l.symbol, color: l.color || LEG_COLORS[i % LEG_COLORS.length] }))}
                                value={rsiCfg.legId}
                                onChange={(newLegId) => {
                                  setRsiPanels(prev => prev.map(p => p.id === rsiCfg.id ? { ...p, legId: newLegId } : p))
                                }}
                                darkMode={darkMode}
                                size="xs"
                              />
                              <span style={{ fontSize: '10px', color: th.textMuted }}>
                                Overbought {rsiCfg.overbought} / Oversold {rsiCfg.oversold}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {rsiPanels.length < portfolioLegs.length && (
                                <button
                                  onClick={handleAddRsiPanel}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '3px',
                                    padding: '2px 8px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    borderRadius: '5px',
                                    border: `1px solid ${th.border}`,
                                    backgroundColor: th.inputBg,
                                    color: '#2563eb',
                                    cursor: 'pointer'
                                  }}
                                  title="Add another RSI chart for a different stock leg"
                                >
                                  + Add RSI for Stock
                                </button>
                              )}
                              {rsiPanels.length > 1 && (
                                <button
                                  onClick={() => handleRemoveRsiPanel(rsiCfg.id)}
                                  style={{
                                    padding: '2px 6px',
                                    fontSize: '10px',
                                    fontWeight: 700,
                                    borderRadius: '4px',
                                    border: 'none',
                                    backgroundColor: 'transparent',
                                    color: th.textMuted,
                                    cursor: 'pointer'
                                  }}
                                  title="Remove this RSI panel"
                                >
                                  ✕
                                </button>
                              )}
                            </div>
                          </div>
                          <div key={`chart-sweep-multirsi-${rsiCfg.id}-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '135px', width: '100%' }}>
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart data={displayChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                                <XAxis
                                  dataKey="time"
                                  height={18}
                                  tickLine={false}
                                  axisLine={{ stroke: th.border, strokeWidth: 1 }}
                                  tick={{ fill: th.textMuted, fontSize: 9 }}
                                  tickFormatter={formatXAxisTick}
                                  minTickGap={50}
                                  interval="preserveStartEnd"
                                />
                                <YAxis domain={[0, 100]} ticks={[rsiCfg.oversold, 50, rsiCfg.overbought]} width={50} style={{ fontSize: '10px' }} stroke={th.textMuted} />
                                <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                                <ReferenceArea y1={rsiCfg.overbought} y2={100} fill="#fca5a5" fillOpacity={0.15} />
                                <ReferenceArea y1={0} y2={rsiCfg.oversold} fill="#86efac" fillOpacity={0.15} />
                                <Line type={splineType} dataKey={`rsi_${rsiCfg.id}`} stroke={indicatorColors.rsi || legColor} strokeWidth={1.8} dot={false} name={`${leg?.symbol} RSI`} isAnimationActive={false} />
                                <ReferenceLine y={rsiCfg.overbought} stroke="#fca5a5" strokeDasharray="3 3" />
                                <ReferenceLine y={rsiCfg.oversold} stroke="#86efac" strokeDasharray="3 3" />
                              </LineChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            }

            return (
              <div key="panel-rsi" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: th.textMuted, marginBottom: '6px' }}>RSI ({rsiPeriod}) · Overbought {rsiOverbought} / Oversold {rsiOversold}</div>
                  <div key={`chart-sweep-rsi-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '135px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis domain={[0, 100]} ticks={[rsiOversold, 50, rsiOverbought]} width={50} style={{ fontSize: '10px' }} stroke={th.textMuted} />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <ReferenceArea y1={rsiOverbought} y2={100} fill="#fca5a5" fillOpacity={0.15} />
                        <ReferenceArea y1={0} y2={rsiOversold} fill="#86efac" fillOpacity={0.15} />
                        <Line type={splineType} dataKey="rsi" stroke={indicatorColors.rsi || '#ef4444'} strokeWidth={1.5} dot={false} name="RSI" isAnimationActive={false} />
                        <ReferenceLine y={rsiOverbought} stroke="#fca5a5" strokeDasharray="3 3" />
                        <ReferenceLine y={rsiOversold} stroke="#86efac" strokeDasharray="3 3" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'macd' && showMacd) {
            const macdLeg = portfolioLegs.find(l => l.id === macdLegId) || portfolioLegs[0]
            return (
              <div key="panel-macd" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: th.textMuted }}>
                        MACD ({macdFast}, {macdSlow}, {macdSignal})
                      </span>
                      {backtestMode === 'portfolio' && (() => {
                        const macdLegIdx = portfolioLegs.findIndex(l => l.id === macdLeg?.id)
                        const macdLegColor = macdLeg?.color || LEG_COLORS[macdLegIdx >= 0 ? macdLegIdx % LEG_COLORS.length : 0]
                        return (
                          <>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff', backgroundColor: macdLegColor, padding: '1px 6px', borderRadius: '3px' }}>
                              {macdLeg?.symbol || 'STOCK'}
                            </span>
                            <SegmentedSlider
                              options={portfolioLegs.map((l, i) => ({ value: l.id, label: l.symbol, color: l.color || LEG_COLORS[i % LEG_COLORS.length] }))}
                              value={macdLegId}
                              onChange={setMacdLegId}
                              darkMode={darkMode}
                              size="xs"
                            />
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div key={`chart-sweep-macd-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '135px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={displayChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis width={50} style={{ fontSize: '10px' }} tickFormatter={(val) => val.toFixed(2)} stroke={th.textMuted} />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <Bar dataKey="macdHistogram" fill={darkMode ? '#475569' : '#cbd5e1'} name="Histogram" isAnimationActive={false} />
                        <Line type={splineType} dataKey="macd" stroke={indicatorColors.macd || '#2563eb'} strokeWidth={1.5} dot={false} name="MACD" isAnimationActive={false} />
                        <Line type={splineType} dataKey="macdSignal" stroke={indicatorColors.macdSignal || '#f59e0b'} strokeWidth={1.5} dot={false} name="Signal" isAnimationActive={false} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'atr' && showAtr) {
            const atrLeg = portfolioLegs.find(l => l.id === atrLegId) || portfolioLegs[0]
            return (
              <div key="panel-atr" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: th.textMuted }}>
                        ATR ({atrPeriod}) · Average True Range
                      </span>
                      {backtestMode === 'portfolio' && (() => {
                        const atrLegIdx = portfolioLegs.findIndex(l => l.id === atrLeg?.id)
                        const atrLegColor = atrLeg?.color || LEG_COLORS[atrLegIdx >= 0 ? atrLegIdx % LEG_COLORS.length : 0]
                        return (
                          <>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff', backgroundColor: atrLegColor, padding: '1px 6px', borderRadius: '3px' }}>
                              {atrLeg?.symbol || 'STOCK'}
                            </span>
                            <SegmentedSlider
                              options={portfolioLegs.map((l, i) => ({ value: l.id, label: l.symbol, color: l.color || LEG_COLORS[i % LEG_COLORS.length] }))}
                              value={atrLegId}
                              onChange={setAtrLegId}
                              darkMode={darkMode}
                              size="xs"
                            />
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div key={`chart-sweep-atr-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '135px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayChartData} margin={{ top: 8, right: 10, left: 5, bottom: 8 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          width={50}
                          style={{ fontSize: '10px' }}
                          tickFormatter={(val) => val.toFixed(2)}
                          domain={[
                            (dataMin: number) => Math.max(0, parseFloat((dataMin * 0.94).toFixed(2))),
                            (dataMax: number) => parseFloat((dataMax * 1.06).toFixed(2))
                          ]}
                          stroke={th.textMuted}
                        />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <Line type={splineType} dataKey="atr" stroke={indicatorColors.atr || '#8b5cf6'} strokeWidth={1.5} dot={false} name="ATR" isAnimationActive={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'zscore' && showZScore) {
            const zLeg = portfolioLegs.find(l => l.id === zScoreLegId) || portfolioLegs[0]
            return (
              <div key="panel-zscore" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: th.textMuted }}>
                        Z-Score ({zScoreWindow}) · Standard Deviations from Mean
                      </span>
                      {backtestMode === 'portfolio' && (() => {
                        const zLegIdx = portfolioLegs.findIndex(l => l.id === zLeg?.id)
                        const zLegColor = zLeg?.color || LEG_COLORS[zLegIdx >= 0 ? zLegIdx % LEG_COLORS.length : 0]
                        return (
                          <>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: '#fff', backgroundColor: zLegColor, padding: '1px 6px', borderRadius: '3px' }}>
                              {zLeg?.symbol || 'STOCK'}
                            </span>
                            <SegmentedSlider
                              options={portfolioLegs.map((l, i) => ({ value: l.id, label: l.symbol, color: l.color || LEG_COLORS[i % LEG_COLORS.length] }))}
                              value={zScoreLegId}
                              onChange={setZScoreLegId}
                              darkMode={darkMode}
                              size="xs"
                            />
                          </>
                        )
                      })()}
                    </div>
                  </div>
                  <div key={`chart-sweep-zscore-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '135px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={displayChartData} margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis width={50} style={{ fontSize: '10px' }} tickFormatter={(val) => val.toFixed(2)} domain={[-4, 4]} stroke={th.textMuted} />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <ReferenceArea y1={2} y2={4} fill="#fca5a5" fillOpacity={0.15} />
                        <ReferenceArea y1={-4} y2={-2} fill="#86efac" fillOpacity={0.15} />
                        <Line type={splineType} dataKey="zscore" stroke={indicatorColors.zscore || '#2563eb'} strokeWidth={1.5} dot={false} name="Z-Score" isAnimationActive={false} />
                        <ReferenceLine y={2} stroke="#fca5a5" strokeDasharray="3 3" />
                        <ReferenceLine y={-2} stroke="#86efac" strokeDasharray="3 3" />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'pnl' && showPnL && chartData.length > 0 && chartData[0]?.equity !== undefined) {
            return (
              <div key="panel-pnl" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: th.text }}>Portfolio PnL (Equity Curve %)</span>
                      {backtestMode === 'portfolio' && (
                        <SegmentedSlider
                          options={pnlSliderOptions}
                          value={pnlSliderMode}
                          onChange={setPnlSliderMode}
                          darkMode={darkMode}
                          size="xs"
                        />
                      )}
                    </div>

                    {backtestMode === 'portfolio' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {/* PnL Lines Dropdown */}
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setPnlLinesOpen(p => !p)
                              setSignalDropdownOpen(false)
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontWeight: 700,
                              borderRadius: '6px',
                              border: `1px solid ${pnlLinesOpen ? '#2563eb' : th.border}`,
                              backgroundColor: pnlLinesOpen ? (darkMode ? '#1e3a8a' : '#eff6ff') : th.inputBg,
                              color: pnlLinesOpen ? '#2563eb' : th.text,
                              cursor: 'pointer'
                            }}
                          >
                            <span>PnL Lines ▾</span>
                            <span style={{
                              fontSize: '9px',
                              fontWeight: 800,
                              padding: '1px 5px',
                              borderRadius: '4px',
                              backgroundColor: darkMode ? '#334155' : '#e2e8f0',
                              color: th.textSec
                            }}>
                              {(visiblePnLLines.overall !== false ? 1 : 0) + portfolioLegs.filter(l => visiblePnLLines[l.id] !== false).length} on
                            </span>
                          </button>

                          {pnlLinesOpen && (
                            <ClickAwayWrapper isOpen={pnlLinesOpen} onClose={() => setPnlLinesOpen(false)} style={{
                              position: 'absolute',
                              top: 'calc(100% + 4px)',
                              right: 0,
                              width: '210px',
                              backgroundColor: darkMode ? '#0f172a' : '#ffffff',
                              border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
                              borderRadius: '8px',
                              padding: '8px 10px',
                              boxShadow: darkMode ? '0 10px 25px rgba(0,0,0,0.6)' : '0 10px 25px rgba(0,0,0,0.1)',
                              zIndex: 50
                            }}>
                              <div style={{ fontSize: '10px', fontWeight: 800, color: th.textMuted, textTransform: 'uppercase', marginBottom: '6px', letterSpacing: '0.4px' }}>
                                Toggle PnL Curves
                              </div>
                              <label style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: th.text }}>
                                <input
                                  type="checkbox"
                                  checked={visiblePnLLines.overall !== false}
                                  onChange={(e) => setVisiblePnLLines(prev => ({ ...prev, overall: e.target.checked }))}
                                  style={{ accentColor: '#10b981', cursor: 'pointer' }}
                                />
                                <span style={{ width: '12px', height: '3px', backgroundColor: '#10b981', borderRadius: '2px', display: 'inline-block' }} />
                                <span>Overall Portfolio (Thick)</span>
                              </label>
                              {portfolioLegs.map((leg, idx) => (
                                <label key={leg.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '4px 0', cursor: 'pointer', fontSize: '11px', fontWeight: 600, color: th.text }}>
                                  <input
                                    type="checkbox"
                                    checked={visiblePnLLines[leg.id] !== false}
                                    onChange={(e) => setVisiblePnLLines(prev => ({ ...prev, [leg.id]: e.target.checked }))}
                                    style={{ accentColor: leg.color || LEG_COLORS[idx % LEG_COLORS.length], cursor: 'pointer' }}
                                  />
                                  <span style={{ width: '12px', height: '1.5px', backgroundColor: leg.color || LEG_COLORS[idx % LEG_COLORS.length], borderRadius: '1px', display: 'inline-block' }} />
                                  <span>{leg.symbol} PnL</span>
                                </label>
                              ))}
                            </ClickAwayWrapper>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div key={`chart-sweep-pnl-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '170px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayChartData} margin={{ top: 20, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis domain={['dataMin - 2', 'dataMax + 2']} hide={false} width={50} tickCount={6} tickFormatter={(val) => `${val.toFixed(1)}%`} style={{ fontSize: '10px' }} stroke={th.textMuted} />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <Legend verticalAlign="top" align="right" height={22} iconSize={10} wrapperStyle={{ fontSize: '10px', top: 2, right: 10 }} />

                        {backtestMode === 'portfolio' ? (
                          pnlSliderMode === 'overlay' ? (
                            <>
                              {/* Overall Portfolio PnL - THICKER LINE (strokeWidth 3) */}
                              {visiblePnLLines.overall !== false && (
                                <Line type={splineType} dataKey="equity" stroke="#10b981" strokeWidth={3} dot={((p: any) => renderPnLDot(p)) as any} name="Overall Portfolio PnL" isAnimationActive={false} />
                              )}
                              {/* Individual Leg PnL - THINNER LINES (strokeWidth 1.2) */}
                              {portfolioLegs.map((leg, idx) => {
                                if (visiblePnLLines[leg.id] === false) return null
                                const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                                return (
                                  <Line
                                    key={leg.id}
                                    type={splineType}
                                    dataKey={`equity_${leg.id}`}
                                    stroke={legColor}
                                    strokeWidth={1.2}
                                    dot={false}
                                    name={`${leg.symbol} PnL`}
                                    isAnimationActive={false}
                                  />
                                )
                              })}
                            </>
                          ) : pnlSliderMode === 'overall' ? (
                            <Line type={splineType} dataKey="equity" stroke="#10b981" strokeWidth={3} dot={((p: any) => renderPnLDot(p)) as any} name="Overall Portfolio PnL" isAnimationActive={false} />
                          ) : (
                            (() => {
                              const legIdx = portfolioLegs.findIndex(l => l.id === pnlSliderMode)
                              const leg = portfolioLegs[legIdx]
                              if (!leg) return null
                              const legColor = leg.color || LEG_COLORS[legIdx % LEG_COLORS.length]
                              return (
                                <Line
                                  type={splineType}
                                  dataKey={`equity_${leg.id}`}
                                  stroke={legColor}
                                  strokeWidth={2.5}
                                  dot={((p: any) => renderPnLDot(p, leg.id)) as any}
                                  name={`${leg.symbol} PnL`}
                                  isAnimationActive={false}
                                />
                              )
                            })()
                          )
                        ) : (
                          <Line type={splineType} dataKey="equity" stroke="#10b981" strokeWidth={2} dot={((p: any) => renderPnLDot(p)) as any} name="Portfolio PnL" isAnimationActive={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          if (panelId === 'lots' && chartData.length > 0 && chartData[0]?.lots !== undefined) {
            return (
              <div key="panel-lots" {...getDraggablePanelProps(pIdx, true)}>
                {renderDragHandle(pIdx)}
                <div onMouseDown={handleChartMouseDown} style={{ flex: 1, minWidth: 0, cursor: isPanningActive ? 'grabbing' : (isZoomed ? 'grab' : 'crosshair'), userSelect: 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '11px', fontWeight: 600, color: th.textMuted }}>Position Lots</span>
                      {backtestMode === 'portfolio' && (
                        <SegmentedSlider
                          options={lotsSliderOptions}
                          value={lotsSliderMode}
                          onChange={setLotsSliderMode}
                          darkMode={darkMode}
                          size="xs"
                        />
                      )}
                    </div>
                    <div style={{ fontSize: '10px', color: th.textMuted }}>
                      (+{maxPositionSize} Long, 0 Flat, -{maxPositionSize} Short)
                    </div>
                  </div>
                  <div key={`chart-sweep-lots-${backtestAnimKey}`} className={isBacktestAnimating ? 'chart-sweep-active' : ''} style={{ height: '125px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={displayChartData} margin={{ top: 20, right: 10, left: 5, bottom: 5 }}>
                        <XAxis
                          dataKey="time"
                          height={18}
                          tickLine={false}
                          axisLine={{ stroke: th.border, strokeWidth: 1 }}
                          tick={{ fill: th.textMuted, fontSize: 9 }}
                          tickFormatter={formatXAxisTick}
                          minTickGap={50}
                          interval="preserveStartEnd"
                        />
                        <YAxis domain={[-maxPositionSize - 0.2, maxPositionSize + 0.2]} ticks={[-maxPositionSize, 0, maxPositionSize]} hide={false} width={30} style={{ fontSize: '10px' }} stroke={th.textMuted} />
                        <Tooltip contentStyle={{ backgroundColor: th.bgCard, border: `1px solid ${th.border}`, borderRadius: '6px', fontSize: '10px', color: th.text }} />
                        <Legend verticalAlign="top" align="right" height={22} iconSize={8} wrapperStyle={{ fontSize: '10px', top: 2, right: 10 }} />

                        {backtestMode === 'portfolio' ? (
                          lotsSliderMode === 'overlay' ? (
                            <>
                              {portfolioLegs.map((leg, idx) => {
                                const legColor = leg.color || LEG_COLORS[idx % LEG_COLORS.length]
                                return (
                                  <Line
                                    key={leg.id}
                                    type="stepAfter"
                                    dataKey={`lots_${leg.id}`}
                                    stroke={legColor}
                                    strokeWidth={1.5}
                                    dot={false}
                                    name={`${leg.symbol} Lots`}
                                    isAnimationActive={false}
                                  />
                                )
                              })}
                              <Line
                                type="stepAfter"
                                dataKey="lots"
                                stroke={darkMode ? '#e2e8f0' : '#1e293b'}
                                strokeWidth={2}
                                strokeDasharray="3 3"
                                dot={false}
                                name="Net Portfolio Lots"
                                isAnimationActive={false}
                              />
                            </>
                          ) : lotsSliderMode === 'overall' ? (
                            <Line type="stepAfter" dataKey="lots" stroke="#7c3aed" strokeWidth={2} dot={false} name="Net Portfolio Lots" isAnimationActive={false} />
                          ) : (
                            (() => {
                              const legIdx = portfolioLegs.findIndex(l => l.id === lotsSliderMode)
                              const leg = portfolioLegs[legIdx]
                              if (!leg) return null
                              const legColor = leg.color || LEG_COLORS[legIdx % LEG_COLORS.length]
                              return (
                                <Line
                                  type="stepAfter"
                                  dataKey={`lots_${leg.id}`}
                                  stroke={legColor}
                                  strokeWidth={2}
                                  dot={false}
                                  name={`${leg.symbol} Lots`}
                                  isAnimationActive={false}
                                />
                              )
                            })()
                          )
                        ) : (
                          <Line type="stepAfter" dataKey="lots" stroke="#7c3aed" strokeWidth={2} dot={false} name="Lots" isAnimationActive={false} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })}
              </>
            )}
          </div>

          {/* Right-Side Evaluation Rail */}
          {evalOpen && result && (
            <div style={{ minWidth: 0 }}>
              <EvaluationPanel
                result={result}
                symbol={backtestMode === 'portfolio' ? 'Portfolio' : symbol}
                strategyName={backtestMode === 'portfolio' ? 'Multi-Asset Portfolio Strategy' : (backtestMode === 'multi' ? 'Conditional Strategy' : (STRATEGIES.find(s => s.id === strategy)?.name || strategy))}
                darkMode={darkMode}
                onClose={() => setEvalOpen(false)}
                savedStrategies={savedStrategies}
                onSelectTrade={handleSelectTrade}
                portfolioResult={backtestMode === 'portfolio' ? result : undefined}
                portfolioLegs={backtestMode === 'portfolio' ? portfolioLegs.map(l => ({ id: l.id, symbol: l.symbol, strategy: l.strategy, allocationPct: l.allocationPct })) : undefined}
                panelHeight={chartColumnHeight}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}