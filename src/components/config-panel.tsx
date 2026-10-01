'use client'

import { useState, useRef, useCallback, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Activity, Zap, TrendingUp, TrendingDown, Settings, Download, ChevronDown, ChevronUp, Trash2, Shield, Sliders, Layers } from 'lucide-react'
import { CustomSelect } from './custom-select'
import { BuiltinColorPicker } from './builtin-color-picker'

export interface DocItem {
  title: string
  tag?: string
  def: string
  why: string
  benchmark?: string
}

export interface StrategyRule {
  id: string
  strategy: string
  params: Record<string, number>
}

export interface PortfolioLeg {
  id: string
  symbol: string
  allocationPct: number
  strategy: string
  params: Record<string, number>
  ruleMode?: 'single' | 'multi'
  entryRules?: StrategyRule[]
  exitRules?: StrategyRule[]
  entryOperator?: 'AND' | 'OR'
  exitOperator?: 'AND' | 'OR'
  color?: string
}

export function NumberStepper({
  value,
  min = 1,
  max = 100,
  step = 1,
  onChange,
  darkMode = false,
  width = 72,
  suffix = ''
}: {
  value: number
  min?: number
  max?: number
  step?: number
  onChange: (val: number) => void
  darkMode?: boolean
  width?: number
  suffix?: string
}) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const latestValueRef = useRef(value)
  latestValueRef.current = value

  const clearTimers = useCallback(() => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null }
  }, [])

  // Clean up on unmount
  useEffect(() => clearTimers, [clearTimers])

  const startRepeat = useCallback((direction: 1 | -1) => {
    clearTimers()
    // Initial delay before repeat starts (200ms), then fast repeat at 80ms
    timeoutRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        const cur = latestValueRef.current || 0
        const next = direction === 1
          ? Math.min(max, cur + 1)
          : Math.max(min, cur - 1)
        if (next !== cur) onChange(next)
      }, 80)
    }, 200)
  }, [max, min, onChange, clearTimers])

  const handleInc = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = Math.min(max, (value || 0) + 1)
    onChange(next)
  }

  const handleDec = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const next = Math.max(min, (value || 0) - 1)
    onChange(next)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    if (raw === '') {
      onChange(min)
      return
    }
    const num = parseInt(raw, 10)
    if (!isNaN(num)) {
      onChange(Math.max(min, Math.min(max, num)))
    }
  }

  const bg = darkMode ? '#1e293b' : '#ffffff'
  const border = darkMode ? '#334155' : '#cbd5e1'
  const text = darkMode ? '#e2e8f0' : '#0f172a'
  const btnBg = darkMode ? '#1e293b' : '#f8fafc'
  const btnHoverBg = darkMode ? '#334155' : '#e2e8f0'
  const arrowColor = darkMode ? '#64748b' : '#64748b'

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: 6,
        overflow: 'hidden',
        width,
        height: 28,
        boxSizing: 'border-box'
      }}
    >
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={1}
        onChange={handleChange}
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        style={{
          width: '100%',
          flex: 1,
          border: 'none',
          outline: 'none',
          backgroundColor: 'transparent',
          color: text,
          fontSize: 12,
          fontWeight: 700,
          padding: '2px 2px 2px 7px',
          MozAppearance: 'textfield',
          appearance: 'textfield'
        }}
      />
      {suffix && (
        <span style={{ fontSize: 11, fontWeight: 700, color: arrowColor, paddingRight: 3 }}>
          {suffix}
        </span>
      )}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          borderLeft: `1px solid ${border}`,
          height: '100%',
          width: 17,
          flexShrink: 0
        }}
      >
        <button
          type="button"
          onClick={handleInc}
          onMouseDown={(e) => { e.preventDefault(); startRepeat(1) }}
          onMouseUp={clearTimers}
          onMouseLeave={clearTimers}
          disabled={value >= max}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            borderBottom: `1px solid ${border}`,
            backgroundColor: btnBg,
            color: arrowColor,
            cursor: value >= max ? 'not-allowed' : 'pointer',
            padding: 0,
            opacity: value >= max ? 0.35 : 1,
            transition: 'background-color 0.1s'
          }}
          title={`Increment (+1)`}
        >
          <ChevronUp size={9} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={handleDec}
          onMouseDown={(e) => { e.preventDefault(); startRepeat(-1) }}
          onMouseUp={clearTimers}
          onMouseLeave={clearTimers}
          disabled={value <= min}
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: 'none',
            backgroundColor: btnBg,
            color: arrowColor,
            cursor: value <= min ? 'not-allowed' : 'pointer',
            padding: 0,
            opacity: value <= min ? 0.35 : 1,
            transition: 'background-color 0.1s'
          }}
          title={`Decrement (-1)`}
        >
          <ChevronDown size={9} strokeWidth={2.5} />
        </button>
      </div>
    </div>
  )
}



export function ConfigInfoTooltip({
  title,
  tag = 'Parameter',
  def,
  why,
  benchmark,
  darkMode = false,
  align = 'left',
  placement = 'bottom'
}: {
  title: string
  tag?: string
  def: string
  why: string
  benchmark?: string
  darkMode?: boolean
  align?: 'left' | 'right'
  placement?: 'top' | 'bottom'
}) {
  const [show, setShow] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; left: number } | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const tooltipWidth = 260
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top

    // All config panel popups point down by default, only flipping up if clipped by the bottom of the window
    let placeAbove = false
    if (placement === 'bottom') {
      if (spaceBelow < 130 && spaceAbove > spaceBelow) {
        placeAbove = true
      }
    } else {
      if (spaceAbove >= 180 || spaceAbove > spaceBelow) {
        placeAbove = true
      }
    }

    let left = align === 'right' ? rect.right - tooltipWidth : rect.left - 6
    const pad = 12
    if (left < pad) left = pad
    if (left + tooltipWidth > window.innerWidth - pad) {
      left = window.innerWidth - tooltipWidth - pad
    }

    if (placeAbove) {
      setPos({
        bottom: Math.max(pad, window.innerHeight - rect.top + 6),
        left
      })
    } else {
      setPos({
        top: Math.max(pad, rect.bottom + 6),
        left
      })
    }
  }, [align, placement])

  useEffect(() => {
    if (!show) return
    updatePosition()

    const onScrollOrResize = () => updatePosition()
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)

    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [show, updatePosition])

  return (
    <div
      ref={triggerRef}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={() => {
        updatePosition()
        setShow(true)
      }}
      onMouseLeave={() => setShow(false)}
      onClick={e => {
        e.stopPropagation()
        updatePosition()
        setShow(p => !p)
      }}
    >
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '13px',
          height: '13px',
          borderRadius: '50%',
          fontSize: '9px',
          fontWeight: 800,
          cursor: 'pointer',
          color: darkMode ? '#94a3b8' : '#64748b',
          backgroundColor: darkMode ? '#334155' : '#e2e8f0',
          transition: 'all 0.15s ease',
          lineHeight: 1,
          userSelect: 'none'
        }}
      >
        ?
      </span>

      {mounted && show && pos && createPortal(
        <div
          style={{
            position: 'fixed',
            top: pos.top !== undefined ? `${pos.top}px` : undefined,
            bottom: pos.bottom !== undefined ? `${pos.bottom}px` : undefined,
            left: `${pos.left}px`,
            width: '260px',
            maxHeight: 'calc(100vh - 24px)',
            overflowY: 'auto',
            backgroundColor: darkMode ? '#0f172a' : '#ffffff',
            color: darkMode ? '#f1f5f9' : '#1e293b',
            border: `1px solid ${darkMode ? '#334155' : '#cbd5e1'}`,
            borderRadius: '8px',
            padding: '10px 12px',
            fontSize: '11px',
            lineHeight: 1.4,
            boxShadow: darkMode
              ? '0 10px 30px rgba(0,0,0,0.7), 0 0 1px rgba(255,255,255,0.2)'
              : '0 10px 25px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.08)',
            zIndex: 99999,
            pointerEvents: 'auto',
            textAlign: 'left'
          }}
          onClick={e => e.stopPropagation()}
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px', borderBottom: `1px solid ${darkMode ? '#1e293b' : '#f1f5f9'}`, paddingBottom: '3px' }}>
            <span style={{ fontWeight: 800, fontSize: '11px', color: '#2563eb' }}>
              {title}
            </span>
            <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '4px', backgroundColor: darkMode ? '#1e293b' : '#eff6ff', color: '#3b82f6' }}>
              {tag}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: darkMode ? '#cbd5e1' : '#334155', marginBottom: '5px' }}>
            {def}
          </div>

          <div style={{ fontSize: '10.5px', color: darkMode ? '#94a3b8' : '#475569', marginBottom: benchmark ? '5px' : '0', backgroundColor: darkMode ? '#1e293b88' : '#f8fafc', padding: '5px 7px', borderRadius: '5px' }}>
            <strong style={{ color: darkMode ? '#f1f5f9' : '#1e293b' }}>Why it matters: </strong>
            {why}
          </div>

          {benchmark && (
            <div style={{ fontSize: '10px', color: '#10b981', backgroundColor: darkMode ? '#064e3b33' : '#ecfdf5', padding: '5px 7px', borderRadius: '5px', border: `1px solid ${darkMode ? '#064e3b66' : '#a7f3d0'}` }}>
              <strong style={{ color: '#059669' }}>Rule of thumb: </strong>
              <span style={{ color: darkMode ? '#6ee7b7' : '#047857' }}>{benchmark}</span>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}

export function ParamSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  color = '#2563eb',
  darkMode = false,
  tooltipInfo
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onChange: (v: number) => void
  color?: string
  darkMode?: boolean
  tooltipInfo?: DocItem
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  const effectiveTooltip = tooltipInfo || PARAM_DOCS[label] || PARAM_DOCS[label.toLowerCase()] || (RISK_EXECUTION_DOCS as Record<string, DocItem>)[label.toLowerCase()] || {
    title: label,
    tag: 'Parameter',
    def: `Configurable parameter value for ${label}.`,
    why: 'Governs signal sensitivity and threshold calculations in the quantitative strategy.',
    benchmark: 'Adjust iteratively based on backtest risk-return metrics.'
  }

  const calc = useCallback((clientX: number) => {
    const t = trackRef.current
    if (!t) return
    const rect = t.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const raw = min + ratio * (max - min)
    const stepped = Math.round(raw / step) * step
    onChange(Math.max(min, Math.min(max, parseFloat(stepped.toFixed(10)))))
  }, [min, max, step, onChange])

  const onDown = (e: React.MouseEvent) => {
    e.preventDefault(); dragging.current = true; calc(e.clientX)
    const mv = (ev: MouseEvent) => { if (dragging.current) calc(ev.clientX) }
    const up = () => { dragging.current = false; window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up) }
    window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up)
  }
  const onTouch = (e: React.TouchEvent) => {
    dragging.current = true; calc(e.touches[0].clientX)
    const mv = (ev: TouchEvent) => { if (dragging.current) calc(ev.touches[0].clientX) }
    const up = () => { dragging.current = false; window.removeEventListener('touchmove', mv); window.removeEventListener('touchend', up) }
    window.addEventListener('touchmove', mv, { passive: true }); window.addEventListener('touchend', up)
  }

  const trackBg = darkMode ? '#334155' : '#e5e7eb'
  const labelColor = darkMode ? '#94a3b8' : '#475569'
  const thumbBg = darkMode ? '#1e293b' : '#fff'

  return (
    <div style={{ marginBottom: 13, userSelect: 'none', width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, paddingRight: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: labelColor }}>{label}</span>
          <ConfigInfoTooltip
            title={effectiveTooltip.title}
            tag={effectiveTooltip.tag || 'Parameter'}
            def={effectiveTooltip.def}
            why={effectiveTooltip.why}
            benchmark={effectiveTooltip.benchmark}
            darkMode={darkMode}
            align="left"
            placement="bottom"
          />
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
      </div>
      <div style={{ padding: '0 10px', boxSizing: 'border-box', width: '100%' }}>
        <div ref={trackRef} onMouseDown={onDown} onTouchStart={onTouch}
          style={{ position: 'relative', height: 22, display: 'flex', alignItems: 'center', cursor: 'pointer', width: '100%' }}>
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: 5, width: '100%', backgroundColor: trackBg, borderRadius: 3 }} />
          <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', height: 5, width: `${pct}%`, background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: 3, transition: 'width 0.05s' }} />
          <div style={{ position: 'absolute', left: `calc(${pct}% - 9px)`, top: '50%', transform: 'translateY(-50%)', width: 18, height: 18, backgroundColor: thumbBg, border: `3px solid ${color}`, borderRadius: '50%', boxShadow: '0 2px 6px rgba(0,0,0,0.2)', zIndex: 1, cursor: 'grab' }} />
        </div>
      </div>
    </div>
  )
}

const PARAM_RANGES: Record<string, { min: number; max: number; step: number; color: string }> = {
  fast: { min: 2, max: 50, step: 1, color: '#2563eb' },
  slow: { min: 10, max: 200, step: 1, color: '#7c3aed' },
  period: { min: 5, max: 50, step: 1, color: '#2563eb' },
  oversold: { min: 10, max: 40, step: 1, color: '#059669' },
  overbought: { min: 60, max: 90, step: 1, color: '#dc2626' },
  stdDev: { min: 1, max: 4, step: 0.1, color: '#f59e0b' },
  signal: { min: 3, max: 20, step: 1, color: '#06b6d4' },
  topPct: { min: 5, max: 50, step: 5, color: '#2563eb' },
  rebalDays: { min: 5, max: 63, step: 1, color: '#7c3aed' },
  zEntry: { min: 0.5, max: 4, step: 0.1, color: '#dc2626' },
  zExit: { min: 0, max: 2, step: 0.1, color: '#059669' },
  window: { min: 10, max: 120, step: 5, color: '#2563eb' },
  entryLen: { min: 5, max: 100, step: 5, color: '#2563eb' },
  exitLen: { min: 5, max: 50, step: 5, color: '#7c3aed' },
  k: { min: 0.2, max: 2, step: 0.1, color: '#f59e0b' },
  atrLen: { min: 5, max: 30, step: 1, color: '#06b6d4' },
  lookback: { min: 21, max: 252, step: 21, color: '#2563eb' },
  cashThreshold: { min: -5, max: 5, step: 0.5, color: '#059669' },
  entry: { min: 10, max: 100, step: 5, color: '#2563eb' },
  exit: { min: 5, max: 50, step: 5, color: '#7c3aed' },
  mid: { min: 10, max: 50, step: 1, color: '#f59e0b' },
  devPct: { min: 0.5, max: 3, step: 0.1, color: '#dc2626' },
  gapPct: { min: 0.3, max: 3, step: 0.1, color: '#f59e0b' },
  halflife: { min: 5, max: 60, step: 5, color: '#06b6d4' },
  volWindow: { min: 20, max: 120, step: 10, color: '#2563eb' },
  smaLen: { min: 50, max: 400, step: 50, color: '#7c3aed' },
  tenkan: { min: 5, max: 20, step: 1, color: '#2563eb' },
  kijun: { min: 15, max: 50, step: 1, color: '#7c3aed' },
  senkou: { min: 30, max: 100, step: 5, color: '#059669' },
  atrMult: { min: 1, max: 6, step: 0.5, color: '#f59e0b' },
}

export const STRATEGY_DOCS: Record<string, DocItem> = {
  sma_crossover: {
    title: 'SMA Crossover',
    tag: 'Trend Following',
    def: 'Initiates a long position when a faster Simple Moving Average crosses above a slower SMA, and closes on death cross.',
    why: 'Filters out short-term market noise to capture sustained medium-to-long term momentum trends.',
    benchmark: 'Performs best in strong trending markets; suffers whipsaws in tight sideways ranges.'
  },
  momentum: {
    title: 'Momentum Factor',
    tag: 'Cross-Sectional Factor',
    def: 'Ranks assets by historical trailing returns, buying the top percentile performers and rebalancing periodically.',
    why: 'Exploits the empirical behavioral finance phenomenon where past winners tend to continue outperforming in the near term.',
    benchmark: 'Standard lookback periods range from 3 to 12 months with monthly rebalancing.'
  },
  mean_reversion_rsi: {
    title: 'RSI Mean Reversion',
    tag: 'Mean Reversion',
    def: 'Calculates the Relative Strength Index (RSI). Enters long when RSI dips into oversold territory and exits when overbought.',
    why: 'Capitalizes on overextended panic selling or euphoric buying when price deviates too far from historical equilibrium.',
    benchmark: 'Standard thresholds are oversold <= 30 and overbought >= 70 on a 14-period lookback.'
  },
  pairs_trading: {
    title: 'Pairs Trading / Stat-Arb',
    tag: 'Statistical Arbitrage',
    def: 'Monitors the historical price spread between co-integrated assets, buying when the spread diverges beyond Z-score thresholds.',
    why: 'Market-neutral strategy designed to generate alpha regardless of overall market direction.',
    benchmark: 'Typically enters when Z-score exceeds +/-2.0 and takes profit when spread reverts to 0 to 0.5.'
  },
  macd_crossover: {
    title: 'MACD Crossover',
    tag: 'Momentum & Trend',
    def: 'Calculates the Moving Average Convergence Divergence line and its 9-period EMA signal line, trading when they intersect.',
    why: 'Identifies shifts in price acceleration and momentum before they show up in raw price action.',
    benchmark: 'Standard settings are 12 fast, 26 slow, and 9 signal period.'
  },
  bollinger_revert: {
    title: 'Bollinger Bands',
    tag: 'Volatility Envelope',
    def: 'Constructs dynamic volatility bands at N standard deviations around an SMA. Buys when price touches the lower band and sells at upper band.',
    why: 'Adapts dynamically to market volatility: wider bands in high volatility, tighter bands in low volatility.',
    benchmark: 'Standard configuration is 20-period SMA with 2.0 standard deviations (encompassing ~95% of normal distribution).'
  },
  breakout: {
    title: 'Donchian Breakout',
    tag: 'Trend Following',
    def: 'Enters long when price breaks out to a new N-day high, using a shorter N-day low as a trailing exit.',
    why: 'Ensures participation in every massive secular trend; mathematically impossible to miss a big run.',
    benchmark: 'Richard Donchian standard uses 20-day breakout with 10-day trailing exit.'
  },
  vol_breakout: {
    title: 'Volatility Breakout',
    tag: 'Volatility Expansion',
    def: 'Monitors intraday or multi-day range contraction and buys when price expands beyond a multiple of the Average True Range (ATR).',
    why: 'Exploits the cyclical nature of volatility: periods of extreme compression are followed by explosive expansions.',
    benchmark: 'Typically uses 14-period ATR with expansion factor K = 0.5 to 0.8.'
  },
  dual_momentum: {
    title: 'Dual Momentum',
    tag: 'Asset Allocation',
    def: 'Combines relative momentum (picking the best performing asset) with absolute momentum (only holding if return is positive, else cash).',
    why: 'Captures upside in bull markets while stepping aside into cash or bonds during bear markets to drastically cut drawdown.',
    benchmark: 'Gary Antonacci model uses 126-day to 252-day lookbacks with 0% cash hurdle.'
  },
  turtle: {
    title: 'Turtle Trading System',
    tag: 'Systematic Trend',
    def: 'Legendary rules-based trend system that buys 55-day channel breakouts with a 20-day trailing stop and strict position sizing.',
    why: 'Designed to let profits run indefinitely while ruthlessly cutting losses when price breaks below trailing channels.',
    benchmark: 'System 1 uses 20/10 day channels; System 2 uses 55/20 day channels.'
  },
  ema_ribbon: {
    title: 'EMA Ribbon',
    tag: 'Multi-Timeframe Trend',
    def: 'Plots multiple exponential moving averages across fast, medium, and slow horizons, trading when all ribbons fan out in alignment.',
    why: 'Visualizes trend strength: parallel expanding ribbons signify strong institutional momentum.',
    benchmark: 'Commonly configured with 8, 21, and 55-period EMAs.'
  },
  vwap_reversion: {
    title: 'VWAP Reversion',
    tag: 'Intraday Mean Reversion',
    def: 'Calculates the Volume-Weighted Average Price benchmark and trades mean reversion when price stretches too far from institutional VWAP.',
    why: 'Institutional algorithms use VWAP as their benchmark execution price, creating strong magnetic reversion pull.',
    benchmark: 'Deviations of 1.0% to 2.5% from VWAP often trigger strong reversion bounces.'
  },
  overnight_gap: {
    title: 'Gap Fade',
    tag: 'Market Microstructure',
    def: 'Fades opening price gaps by betting that morning imbalances will close as liquidity normalizes during the trading session.',
    why: 'Retail traders often overreact to pre-market headlines, creating profitable mean-reverting entry prices at market open.',
    benchmark: 'Most effective on moderate gaps (0.5% to 1.5%) in liquid ETFs like SPY and QQQ.'
  },
  stat_arb: {
    title: 'Statistical Arbitrage',
    tag: 'Quantitative Stat-Arb',
    def: 'Applies Ornstein-Uhlenbeck mean-reversion modeling with beta-hedging to trade mean-reverting spreads with statistical confidence.',
    why: 'Isolates pure alpha from idiosyncratic mispricing while eliminating systematic market beta risk.',
    benchmark: 'Uses halflife estimates (typically 10-30 days) to optimize holding periods.'
  },
  risk_parity: {
    title: 'Risk Parity',
    tag: 'Portfolio Engineering',
    def: 'Allocates position sizes inversely proportional to trailing asset volatility so each position contributes equal risk.',
    why: 'Prevents high-volatility assets from dominating total portfolio drawdowns.',
    benchmark: 'Pioneered by Ray Dalio (Bridgewater All Weather); typical volatility window is 60 days.'
  },
  regime_filter: {
    title: 'Regime Filter',
    tag: 'Trend & Risk Filter',
    def: 'Restricts strategy execution to only taking long positions when the underlying asset trades above its long-term moving average (e.g. 200 SMA).',
    why: 'Drastically reduces catastrophic drawdowns by sitting in cash throughout extended bear markets.',
    benchmark: 'Paul Tudor Jones standard: only be long when above the 200-day moving average.'
  },
  mean_reversion_zscore: {
    title: 'Z-Score Reversion',
    tag: 'Statistical Reversion',
    def: 'Normalizes price distance from a rolling moving average into standard deviation units (Z-score), entering at statistical extremes.',
    why: 'Normalizes volatility across differing market environments so trigger thresholds remain statistically valid.',
    benchmark: 'Buys at Z < -2.0 and sells at Z > +2.0 (outside 95% expected distribution).'
  },
  rsi_divergence: {
    title: 'RSI Divergence',
    tag: 'Oscillator Divergence',
    def: 'Detects divergences where price creates a lower low but RSI creates a higher low (bullish divergence), signaling reversal.',
    why: 'Divergences signal that price momentum is decelerating under the surface before the actual price reversal occurs.',
    benchmark: 'Lookback window of 10 to 15 bars with 14-period RSI.'
  },
  ichimoku_cloud: {
    title: 'Ichimoku Cloud',
    tag: 'Multi-Factor Trend',
    def: 'Combines Tenkan-sen/Kijun-sen conversion lines with the Senkou Span Kumo cloud to determine trend direction, support, and momentum.',
    why: 'All-in-one Japanese equilibrium chart providing trend direction, dynamic support/resistance, and momentum triggers.',
    benchmark: 'Traditional Japanese settings: Tenkan 9, Kijun 26, Senkou Span 52.'
  },
  atr_trailing: {
    title: 'ATR Trailing Stop',
    tag: 'Volatility Adaptive Trend',
    def: 'Tracks the ongoing trend with a dynamic stop-loss placed N multiples of Average True Range below the highest peak price.',
    why: 'Gives trades room to breathe during noisy volatility while tightening stops as volatility contracts.',
    benchmark: 'Typically uses 2.5 to 3.5 multiples of 14-day ATR.'
  }
}

export const PARAM_DOCS: Record<string, DocItem> = {
  fast: {
    title: 'Fast Period',
    tag: 'Lookback Window',
    def: 'The lookback window (number of bars) used to compute the responsive short-term moving average.',
    why: 'Reacts rapidly to recent price changes to detect early momentum shifts.',
    benchmark: 'Common values: 8, 10, 12, or 20 bars.'
  },
  slow: {
    title: 'Slow Period',
    tag: 'Baseline Window',
    def: 'The lookback window (number of bars) used to compute the smoother long-term moving average.',
    why: 'Establishes the macro trend baseline to filter out short-term market noise.',
    benchmark: 'Common values: 30, 50, 100, or 200 bars.'
  },
  mid: {
    title: 'Intermediate Period',
    tag: 'Ribbon Window',
    def: 'The middle moving average period in multi-line moving average ribbons.',
    why: 'Confirms trend acceleration across intermediate timeframes between fast and slow.',
    benchmark: 'Typically 21 to 34 bars.'
  },
  period: {
    title: 'Calculation Period',
    tag: 'Indicator Window',
    def: 'The historical rolling lookback window used to calculate indicator values.',
    why: 'Balances indicator responsiveness against noise reduction.',
    benchmark: 'RSI standard is 14; Bollinger standard is 20.'
  },
  oversold: {
    title: 'Oversold Threshold',
    tag: 'Buy Trigger',
    def: 'The lower indicator boundary level below which an asset is considered statistically oversold.',
    why: 'Triggers mean-reversion buy orders on exhaustion of selling pressure.',
    benchmark: 'Standard RSI oversold level is 30 (or 20 in strong bear markets).'
  },
  overbought: {
    title: 'Overbought Threshold',
    tag: 'Sell Trigger',
    def: 'The upper indicator boundary level above which an asset is considered statistically overbought.',
    why: 'Triggers profit-taking or short entries when buying momentum becomes exhausted.',
    benchmark: 'Standard RSI overbought level is 70 (or 80 in strong bull markets).'
  },
  stdDev: {
    title: 'Standard Deviation Multiplier',
    tag: 'Envelope Width',
    def: 'The multiplier of standard deviations added and subtracted from the mean to form upper and lower bands.',
    why: 'Governs band width: 2.0 captures approximately 95% of price distribution under normal conditions.',
    benchmark: 'Standard is 2.0; use 2.5 for lower frequency, higher conviction signals.'
  },
  signal: {
    title: 'Signal Smoothing Period',
    tag: 'MACD Trigger',
    def: 'The exponential moving average period applied to the MACD line to generate crossover triggers.',
    why: 'Smooths the MACD difference line to create timely, reliable buy and sell intersections.',
    benchmark: 'Standard setting is 9 bars.'
  },
  window: {
    title: 'Rolling Window',
    tag: 'Sample Size',
    def: 'The historical number of bars used to calculate the rolling mean and standard deviation.',
    why: 'Determines how far back the model looks to assess the baseline normal price level.',
    benchmark: 'Commonly 20 to 60 bars.'
  },
  zEntry: {
    title: 'Z-Score Entry Threshold',
    tag: 'Divergence Trigger',
    def: 'The number of standard deviations the price or spread must deviate from its mean to trigger a trade.',
    why: 'Ensures trades are only entered when price is at genuine statistical extremes.',
    benchmark: 'Typically set to 1.5 to 2.5 standard deviations.'
  },
  zExit: {
    title: 'Z-Score Exit Threshold',
    tag: 'Target Threshold',
    def: 'The Z-score level at which the mean-reverting position is closed to lock in profits.',
    why: 'Takes profit as the spread normalizes before potential overshooting in the opposite direction.',
    benchmark: 'Typically set to 0.0 (exact mean) to 0.5.'
  },
  entryLen: {
    title: 'Channel Entry Period',
    tag: 'Breakout Lookback',
    def: 'The lookback window used to find the highest high breakout price level.',
    why: 'Defines the upper resistance boundary that confirms the onset of a new trend.',
    benchmark: 'Standard Donchian channel is 20 bars.'
  },
  exitLen: {
    title: 'Channel Exit Period',
    tag: 'Trailing Lookback',
    def: 'The lookback window used to find the trailing lowest low exit price level.',
    why: 'Acts as a trailing stop that rises with the trend to protect accrued profits.',
    benchmark: 'Standard Donchian exit is 10 bars.'
  },
  entry: {
    title: 'Breakout Period',
    tag: 'Channel Length',
    def: 'The lookback period for breakout entry in the Turtle Trading system.',
    why: 'Catches major breakouts beyond multi-month highs.',
    benchmark: 'Turtle System 1 uses 20 days; System 2 uses 55 days.'
  },
  exit: {
    title: 'Trailing Exit Period',
    tag: 'Trailing Stop',
    def: 'The lookback period for trailing exits in the Turtle Trading system.',
    why: 'Rides trends as long as they stay above the trailing low channel.',
    benchmark: 'Turtle System 1 uses 10 days; System 2 uses 20 days.'
  },
  k: {
    title: 'Volatility Multiplier (K)',
    tag: 'ATR Expansion Factor',
    def: 'The multiplier applied to the Average True Range to establish the breakout trigger threshold above the open.',
    why: 'Calibrates how much range expansion is needed before opening momentum is confirmed.',
    benchmark: 'Typical values range between 0.4 and 0.8.'
  },
  atrLen: {
    title: 'ATR Calculation Period',
    tag: 'Volatility Horizon',
    def: 'The lookback window used to calculate Average True Range (ATR).',
    why: 'Measures the current market volatility regime without bias from price gaps.',
    benchmark: 'Standard Wilder setting is 14 bars.'
  },
  atrMult: {
    title: 'ATR Trailing Multiplier',
    tag: 'Stop Distance',
    def: 'The multiple of ATR subtracted from the highest price peak to form the dynamic trailing stop line.',
    why: 'Sizes the trailing stop dynamically according to current volatility: wider in high vol, tighter in low vol.',
    benchmark: 'Standard values range between 2.5 and 4.0.'
  },
  topPct: {
    title: 'Top Percentile Filter',
    tag: 'Relative Strength',
    def: 'The top percentage of assets selected based on trailing momentum performance score.',
    why: 'Focuses capital solely on the strongest market leaders.',
    benchmark: 'Standard factor investing uses the top 10% to 20% quintile.'
  },
  rebalDays: {
    title: 'Rebalance Frequency',
    tag: 'Holding Horizon',
    def: 'The number of trading days between portfolio rebalancing and ranking updates.',
    why: 'Balances momentum turnover with commission and slippage costs.',
    benchmark: 'Typically 21 trading days (monthly rebalancing).'
  },
  lookback: {
    title: 'Momentum Lookback',
    tag: 'Return Window',
    def: 'The historical window of bars used to measure cumulative price performance.',
    why: 'Captures the underlying momentum cycle length.',
    benchmark: 'Standard momentum lookbacks are 63 bars (3 months), 126 bars (6 months), or 252 bars (12 months).'
  },
  cashThreshold: {
    title: 'Cash Safety Threshold',
    tag: 'Absolute Momentum',
    def: 'The return hurdle below which capital is rotated completely into risk-free cash or Treasury bills.',
    why: 'Eliminates equity market downside exposure when all asset classes are falling.',
    benchmark: 'Standard is 0% (only invest when asset has positive absolute return).'
  },
  devPct: {
    title: 'VWAP Deviation (%)',
    tag: 'Reversion Threshold',
    def: 'The percentage deviation from institutional Volume-Weighted Average Price required to initiate a fade.',
    why: 'Identifies overextended prices with a high probability of snapping back toward VWAP.',
    benchmark: 'Commonly 1.0% to 2.5% on intraday and daily charts.'
  },
  gapPct: {
    title: 'Gap Threshold (%)',
    tag: 'Opening Gap',
    def: 'The minimum opening price gap compared to the previous close required to trade a gap fade.',
    why: 'Filters out negligible market noise to focus only on significant overnight liquidity imbalances.',
    benchmark: 'Typically 0.75% to 1.5%.'
  },
  halflife: {
    title: 'Mean Reversion Half-Life',
    tag: 'Speed of Reversion',
    def: 'The estimated number of bars expected for a price divergence to decay back halfway toward its mean.',
    why: 'Calibrates optimal holding time so capital is not tied up in non-reverting positions.',
    benchmark: 'Stat-arb models typically look for half-lives between 5 and 30 bars.'
  },
  volWindow: {
    title: 'Volatility Window',
    tag: 'Risk Parity Lookback',
    def: 'The lookback window used to estimate standard deviation of daily returns for inverse-volatility weighting.',
    why: 'Measures recent asset risk to dynamically adjust position sizes.',
    benchmark: 'Typically 30 to 60 days.'
  },
  smaLen: {
    title: 'Macro Regime Filter Period',
    tag: 'Bull/Bear Filter',
    def: 'The moving average period used to determine whether the broader market is in an overall bull or bear regime.',
    why: 'Suppresses long trades when market is structurally broken below its long-term average.',
    benchmark: 'The 200-day SMA is the universal institutional benchmark.'
  },
  tenkan: {
    title: 'Tenkan-sen Period',
    tag: 'Conversion Line',
    def: 'The lookback window used to calculate the average of highest high and lowest low over short horizon.',
    why: 'Serves as the short-term equilibrium signal line in the Ichimoku system.',
    benchmark: 'Traditional Japanese standard is 9 bars.'
  },
  kijun: {
    title: 'Kijun-sen Period',
    tag: 'Base Line',
    def: 'The lookback window used to calculate the average of highest high and lowest low over medium horizon.',
    why: 'Acts as dynamic support/resistance and indicator of trend confirmation.',
    benchmark: 'Traditional Japanese standard is 26 bars.'
  },
  senkou: {
    title: 'Senkou Span B Period',
    tag: 'Cloud Boundary',
    def: 'The long-term lookback window used to compute the trailing boundary of the Kumo cloud.',
    why: 'Forms the macro support and resistance cloud projected into the future.',
    benchmark: 'Traditional Japanese standard is 52 bars.'
  }
}

export const RISK_EXECUTION_DOCS: Record<string, DocItem> = {
  position_size: {
    title: 'Max Position Size (Lots / Pyramiding)',
    tag: 'Leverage & Pyramiding',
    def: 'The maximum number of lots that can be accumulated in a single direction. Consecutive entry signals scale in +1 lot up to this limit; reversal signals close out and immediately flip to 1 lot on the new side.',
    why: 'Allows the strategy to dynamically build position size in sustained high-conviction trends, increasing portfolio compounding while enforcing strict risk limits.',
    benchmark: 'Set to 1 for standard single-unit trading. Set to 2-5 lots to enable trend-following pyramiding.'
  },
  stop_loss: {
    title: 'Stop Loss (%)',
    tag: 'Risk Guardrail',
    def: 'Automatic risk threshold that closes a losing trade if the price falls X% below entry price.',
    why: 'Protects account capital against catastrophic market crashes and prevents outsized losses.',
    benchmark: 'Set to 0 to disable. Standard quant strategies use 2% to 5%.'
  },
  take_profit: {
    title: 'Take Profit (%)',
    tag: 'Target Threshold',
    def: 'Automatic profit threshold that locks in gains if the price rises X% above entry price.',
    why: 'Secures capital gains before market momentum exhausts or reverses.',
    benchmark: 'Set to 0 to disable. Standard quant targets range between 5% and 15%.'
  },
  slippage: {
    title: 'Slippage (bps)',
    tag: 'Execution Friction',
    def: 'Simulates price execution friction (bid-ask spread and market impact), measured in basis points (1 bps = 0.01%). A setting of 0 represents zero slippage (ideal fills).',
    why: 'Reflects real-world market friction where trade fills occur slightly worse than the nominal bar close price. (Not to be confused with execution latency, which is candle delay).',
    benchmark: 'Set to 0 for zero friction (ideal fills). Real equities typically experience 1 to 5 bps.'
  },
  commission: {
    title: 'Commission ($/trade)',
    tag: 'Transaction Cost',
    def: 'Fixed broker transaction fee charged per executed buy and sell order.',
    why: 'Accounts for brokerage friction. High-turnover strategies can see profits eroded by commissions.',
    benchmark: 'Set to 0 for commission-free backtesting. Retail brokers range from $0 to $1.'
  }
}

export const STRATEGIES: Array<{ id: string; name: string; desc: string; params: Record<string, number> }> = [
  { id: 'sma_crossover', name: 'SMA Crossover', desc: 'Fast SMA crosses above slow SMA', params: { fast: 10, slow: 30 } },
  { id: 'momentum', name: 'Momentum Factor', desc: 'Top N% performers, rebalance monthly', params: { topPct: 20, rebalDays: 21 } },
  { id: 'mean_reversion_rsi', name: 'RSI Mean Reversion', desc: 'Buy oversold, sell overbought', params: { period: 14, oversold: 30, overbought: 70 } },
  { id: 'pairs_trading', name: 'Pairs Trading', desc: 'Z-score spread reversion', params: { zEntry: 2, zExit: 0.5, window: 60 } },
  { id: 'macd_crossover', name: 'MACD Crossover', desc: 'Signal line cross up/down', params: { fast: 12, slow: 26, signal: 9 } },
  { id: 'bollinger_revert', name: 'Bollinger Bands', desc: 'Buy lower band, sell upper', params: { period: 20, stdDev: 2 } },
  { id: 'breakout', name: 'Donchian Breakout', desc: '20-day high entry, trend follow', params: { entryLen: 20, exitLen: 10 } },
  { id: 'vol_breakout', name: 'Volatility Breakout', desc: 'ATR expansion entry', params: { k: 0.6, atrLen: 14 } },
  { id: 'dual_momentum', name: 'Dual Momentum', desc: 'Absolute + relative momentum', params: { lookback: 126, cashThreshold: 0 } },
  { id: 'turtle', name: 'Turtle Trading', desc: '55-day breakout, 20-day exit', params: { entry: 55, exit: 20 } },
  { id: 'ema_ribbon', name: 'EMA Ribbon', desc: 'Short EMA fan above long EMAs', params: { fast: 8, mid: 21, slow: 55 } },
  { id: 'vwap_reversion', name: 'VWAP Reversion', desc: 'Fade VWAP deviation', params: { devPct: 1.5 } },
  { id: 'overnight_gap', name: 'Gap Fade', desc: 'Fade opening gap intraday', params: { gapPct: 1.0 } },
  { id: 'stat_arb', name: 'Statistical Arb', desc: 'Beta-hedged mean reversion', params: { halflife: 20, zEntry: 1.5 } },
  { id: 'risk_parity', name: 'Risk Parity', desc: 'Inverse volatility weighting', params: { volWindow: 60 } },
  { id: 'regime_filter', name: 'Regime Filter', desc: 'Only long above SMA200', params: { smaLen: 200 } },
  { id: 'mean_reversion_zscore', name: 'Z-Score Reversion', desc: 'Buy z<-2, sell z>2', params: { window: 20, zEntry: 2 } },
  { id: 'rsi_divergence', name: 'RSI Divergence', desc: 'Price vs RSI divergence', params: { period: 14, lookback: 10 } },
  { id: 'ichimoku_cloud', name: 'Ichimoku Cloud', desc: 'Cloud + tenkan-kijun cross', params: { tenkan: 9, kijun: 26, senkou: 52 } },
  { id: 'atr_trailing', name: 'ATR Trailing Stop', desc: 'Dynamic N×ATR stop-loss', params: { atrMult: 3, atrLen: 14 } },
]


export interface SavedStrategy {
  id: string
  name: string
  timestamp: number
  mode: 'single' | 'multi' | 'portfolio'
  symbol: string
  timeframe: string
  lookback: string
  strategy?: string
  params?: Record<string, any>
  entryRules?: StrategyRule[]
  exitRules?: StrategyRule[]
  entryOperator?: 'AND' | 'OR'
  exitOperator?: 'AND' | 'OR'
  portfolioLegs?: PortfolioLeg[]
  pricePanels?: Array<{ id: string; viewMode: string }>
  result: {
    totalReturn: number; buyHoldReturn: number; alpha: number
    sharpe: number; winRate: number; maxDrawdown: number; trades: number; avgTrade: number
    sortino?: number; calmar?: number; profitFactor?: number
    avgWin?: number; avgLoss?: number; maxConsecLosses?: number
    tradeList?: any[]
    legResults?: any[]
    marketAlpha?: number
    spyBuyHoldReturn?: number
    correlation?: number
  }
}

function formatDateTime(timestamp: number) {
  if (!timestamp) return { dateStr: '—', timeStr: '' }
  try {
    const d = new Date(timestamp)
    if (isNaN(d.getTime())) return { dateStr: '—', timeStr: '' }
    const dateStr = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    const timeStr = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit', hour12: true })
    return { dateStr, timeStr }
  } catch {
    return { dateStr: String(timestamp), timeStr: '' }
  }
}

const SAVED_TABLE_COLUMNS = [
  { key: 'name', label: 'STRATEGY NAME', align: 'left' as const, sortable: true },
  { key: 'setup', label: 'MARKET / SETUP', align: 'left' as const, sortable: false },
  { key: 'totalReturn', label: 'RETURN', align: 'right' as const, sortable: true },
  { key: 'alpha', label: 'ALPHA', align: 'right' as const, sortable: true },
  { key: 'sharpe', label: 'SHARPE', align: 'right' as const, sortable: true },
  { key: 'sortino', label: 'SORTINO', align: 'right' as const, sortable: true },
  { key: 'winRate', label: 'WIN RATE', align: 'right' as const, sortable: true },
  { key: 'maxDrawdown', label: 'MAX DD', align: 'right' as const, sortable: true },
  { key: 'profitFactor', label: 'PROFIT FACTOR', align: 'right' as const, sortable: true },
  { key: 'trades', label: 'TRADES', align: 'right' as const, sortable: true },
  { key: 'timestamp', label: 'DATE / TIME SAVED', align: 'right' as const, sortable: true },
  { key: 'actions', label: 'ACTIONS', align: 'center' as const, sortable: false },
]

interface ConfigPanelProps {
  symbol: string; setSymbol: (s: string) => void
  timeframe: string; setTimeframe: (t: string) => void
  lookback: string; setLookback: (l: string) => void
  strategy: string; selectStrategy: (id: string) => void
  params: Record<string, number>; setParams: React.Dispatch<React.SetStateAction<Record<string, number>>>
  maxPositionSize: number; setMaxPositionSize: (v: number) => void
  stopLoss?: number; setStopLoss?: (v: number) => void
  takeProfit?: number; setTakeProfit?: (v: number) => void
  slippageBps?: number; setSlippageBps?: (v: number) => void
  commission?: number; setCommission?: (v: number) => void
  onDownloadCSV?: () => void; collapsed?: boolean; onToggleCollapse?: () => void
  backtestMode?: 'single' | 'multi' | 'portfolio' | 'saved'; setBacktestMode?: (mode: 'single' | 'multi' | 'portfolio' | 'saved') => void
  entryOperator?: 'AND' | 'OR'; setEntryOperator?: (op: 'AND' | 'OR') => void
  entryRules?: StrategyRule[]; setEntryRules?: React.Dispatch<React.SetStateAction<StrategyRule[]>>
  exitOperator?: 'AND' | 'OR'; setExitOperator?: (op: 'AND' | 'OR') => void
  exitRules?: StrategyRule[]; setExitRules?: React.Dispatch<React.SetStateAction<StrategyRule[]>>
  darkMode?: boolean
  savedStrategies?: SavedStrategy[]
  onDeleteSaved?: (id: string) => void
  onLoadSaved?: (saved: SavedStrategy) => void
  savedSortKey?: string
  setSavedSortKey?: (key: string) => void
  portfolioLegs?: PortfolioLeg[]
  setPortfolioLegs?: React.Dispatch<React.SetStateAction<PortfolioLeg[]>>
}

export function QuantLabConfigPanel({
  symbol, setSymbol, timeframe, setTimeframe, lookback, setLookback,
  strategy, selectStrategy, params, setParams, maxPositionSize, setMaxPositionSize,
  stopLoss = 0, setStopLoss,
  takeProfit = 0, setTakeProfit,
  slippageBps = 0, setSlippageBps,
  commission = 0, setCommission,
  onDownloadCSV, collapsed, onToggleCollapse,
  backtestMode = 'single', setBacktestMode,
  entryOperator = 'AND', setEntryOperator,
  entryRules = [], setEntryRules,
  exitOperator = 'OR', setExitOperator,
  exitRules = [], setExitRules,
  darkMode = false,
  savedStrategies = [],
  onDeleteSaved,
  onLoadSaved,
  savedSortKey = 'timestamp',
  setSavedSortKey,
  portfolioLegs = [],
  setPortfolioLegs
}: ConfigPanelProps) {
  const [symbolInput, setSymbolInput] = useState(symbol)
  const [addEntryStrat, setAddEntryStrat] = useState('sma_crossover')
  const [addExitStrat, setAddExitStrat] = useState('mean_reversion_rsi')
  const [activeLegTab, setActiveLegTab] = useState<string>(portfolioLegs[0]?.id || 'leg_1')
  const [legAddEntryStrat, setLegAddEntryStrat] = useState<Record<string, string>>({})
  const [legAddExitStrat, setLegAddExitStrat] = useState<Record<string, string>>({})

  // Theme colors
  const t = darkMode ? {
    bg: '#1e293b', bgAlt: '#1a2332', bgCard: '#1e293b', bgHover: '#334155',
    border: '#334155', borderLight: '#2a3a50', text: '#e2e8f0', textSec: '#94a3b8',
    textMuted: '#64748b', inputBg: '#0f172a', inputBorder: '#475569'
  } : {
    bg: '#ffffff', bgAlt: '#fafbfd', bgCard: '#ffffff', bgHover: '#f8fafc',
    border: '#e5e7eb', borderLight: '#eef2f8', text: '#2b2f43', textSec: '#475569',
    textMuted: '#94a3b8', inputBg: '#fff', inputBorder: '#dbe4f0'
  }

  const handleAddEntryRule = () => {
    if (!setEntryRules) return
    const stratObj = STRATEGIES.find(s => s.id === addEntryStrat)
    const newRule: StrategyRule = {
      id: `entry_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      strategy: addEntryStrat,
      params: { ...(stratObj?.params || {}) }
    }
    setEntryRules(prev => [...(prev || []), newRule])
  }

  const handleRemoveEntryRule = (id: string) => {
    if (!setEntryRules) return
    setEntryRules(prev => (prev || []).filter(r => r.id !== id))
  }

  const handleUpdateEntryRuleParam = (ruleId: string, paramKey: string, val: number) => {
    if (!setEntryRules) return
    setEntryRules(prev => (prev || []).map(r => r.id === ruleId ? { ...r, params: { ...(r.params || {}), [paramKey]: val } } : r))
  }

  const handleAddExitRule = () => {
    if (!setExitRules) return
    const stratObj = STRATEGIES.find(s => s.id === addExitStrat)
    const newRule: StrategyRule = {
      id: `exit_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      strategy: addExitStrat,
      params: { ...(stratObj?.params || {}) }
    }
    setExitRules(prev => [...(prev || []), newRule])
  }

  const handleRemoveExitRule = (id: string) => {
    if (!setExitRules) return
    setExitRules(prev => (prev || []).filter(r => r.id !== id))
  }

  const handleUpdateExitRuleParam = (ruleId: string, paramKey: string, val: number) => {
    if (!setExitRules) return
    setExitRules(prev => (prev || []).map(r => r.id === ruleId ? { ...r, params: { ...(r.params || {}), [paramKey]: val } } : r))
  }

  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  const handleHeaderClick = (key: string) => {
    if (!setSavedSortKey) return
    if (savedSortKey === key) {
      setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')
    } else {
      setSavedSortKey(key)
      setSortDir(key === 'name' ? 'asc' : 'desc')
    }
  }

  const sortedSaved = useMemo(() => {
    return [...savedStrategies].sort((a, b) => {
      if (savedSortKey === 'name') {
        const cmp = a.name.localeCompare(b.name)
        return sortDir === 'asc' ? cmp : -cmp
      }
      let aVal = 0
      let bVal = 0
      if (savedSortKey === 'timestamp') {
        aVal = a.timestamp
        bVal = b.timestamp
      } else {
        aVal = Number((a.result as any)?.[savedSortKey] ?? 0)
        bVal = Number((b.result as any)?.[savedSortKey] ?? 0)
      }
      return sortDir === 'asc' ? aVal - bVal : bVal - aVal
    })
  }, [savedStrategies, savedSortKey, sortDir])

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ position: 'relative', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap', padding: '10px 0' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, position: 'relative', flexShrink: 0 }}>
            <input value={symbolInput} onChange={e => setSymbolInput(e.target.value.toUpperCase())}
              onKeyDown={e => { if (e.key === 'Enter') setSymbol(symbolInput) }}
              placeholder="SPY"
              style={{ width: 84, textAlign: 'center', padding: '7px 10px', fontSize: 13, fontWeight: 800, letterSpacing: '0.5px', backgroundColor: t.inputBg, border: `2px solid ${t.inputBorder}`, borderRadius: 999, color: t.text, outline: 'none', boxSizing: 'border-box' }}
            />
            <button onClick={() => setSymbol(symbolInput)}
              style={{ marginLeft: 10, padding: '7px 18px', fontSize: 12, fontWeight: 700, backgroundColor: '#2563eb', color: '#e8f0f8', border: 'none', borderRadius: 999, cursor: 'pointer', flexShrink: 0 }}>Set</button>
          </div>

          <div style={{ width: 1, height: 28, backgroundColor: t.border, flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <Zap size={14} color="#7c3aed" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: t.textSec, letterSpacing: '0.3px', marginRight: 4, whiteSpace: 'nowrap' }}>CANDLE SIZE:</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['5Min', '15Min', '1Hour', '1Day'].map(tf => (
                <button key={tf} onClick={() => setTimeframe(tf)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: timeframe === tf ? '2px solid #7c3aed' : `2px solid ${t.border}`, backgroundColor: timeframe === tf ? (darkMode ? '#2e1065' : '#f5f3ff') : t.bg, color: timeframe === tf ? '#7c3aed' : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>{tf}</button>
              ))}
            </div>
          </div>

          <div style={{ width: 1, height: 28, backgroundColor: t.border, flexShrink: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <TrendingUp size={14} color="#059669" style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 10, fontWeight: 800, color: t.textSec, letterSpacing: '0.3px', marginRight: 4, whiteSpace: 'nowrap' }}>LOOKBACK:</span>
            <div style={{ display: 'flex', gap: 5 }}>
              {['1M', '3M', '6M', '1Y', '3Y'].map(lb => (
                <button key={lb} onClick={() => setLookback(lb)} style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: lookback === lb ? '2px solid #059669' : `2px solid ${t.border}`, backgroundColor: lookback === lb ? (darkMode ? '#022c22' : '#ecfdf5') : t.bg, color: lookback === lb ? '#059669' : t.textMuted, cursor: 'pointer', whiteSpace: 'nowrap' }}>{lb}</button>
              ))}
            </div>
          </div>

          {setBacktestMode && (
            <div style={{ display: 'flex', backgroundColor: darkMode ? '#1a2332' : '#e2e8f0', borderRadius: 999, padding: 2, marginLeft: 'auto', flexShrink: 0 }}>
              <button onClick={() => setBacktestMode('single')} style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: 'none', backgroundColor: backtestMode === 'single' ? '#2563eb' : 'transparent', color: backtestMode === 'single' ? '#fff' : t.textMuted, cursor: 'pointer' }}>Single Strategy</button>
              <button onClick={() => setBacktestMode('multi')} style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: 'none', backgroundColor: backtestMode === 'multi' ? '#7c3aed' : 'transparent', color: backtestMode === 'multi' ? '#fff' : t.textMuted, cursor: 'pointer' }}>Conditional</button>
              <button onClick={() => setBacktestMode('portfolio')} style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: 'none', backgroundColor: backtestMode === 'portfolio' ? '#0284c7' : 'transparent', color: backtestMode === 'portfolio' ? '#fff' : t.textMuted, cursor: 'pointer' }}>Portfolio</button>
              <button onClick={() => setBacktestMode('saved')} style={{ padding: '5px 11px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: 'none', backgroundColor: backtestMode === 'saved' ? '#059669' : 'transparent', color: backtestMode === 'saved' ? '#fff' : t.textMuted, cursor: 'pointer' }}>Saved ({savedStrategies.length})</button>
            </div>
          )}

          {onDownloadCSV && (
            <button onClick={onDownloadCSV} style={{ marginLeft: setBacktestMode ? 8 : 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', fontSize: 11, fontWeight: 700, borderRadius: 999, border: `2px solid ${t.border}`, backgroundColor: t.bg, color: t.textMuted, cursor: 'pointer', flexShrink: 0 }}>
              <Download size={13} /> CSV
            </button>
          )}
          {onToggleCollapse && (
            <button onClick={onToggleCollapse} style={{ marginLeft: onDownloadCSV ? 8 : 'auto', width: 32, height: 32, borderRadius: 999, border: `2px solid ${t.border}`, backgroundColor: t.bg, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {collapsed ? <ChevronDown size={16} color={t.textMuted} /> : <ChevronUp size={16} color={t.textMuted} />}
            </button>
          )}
        </div>

        {!collapsed && (
          (() => {
            const renderRiskExecutionSection = () => (
              <div style={{ padding: '18px 4px 18px 22px', minWidth: 0, boxSizing: 'border-box', overflowY: 'auto', height: '100%', maxHeight: 382, display: 'flex', flexDirection: 'column' }}>
                <div style={{ paddingRight: 18, flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <Shield size={14} color="#fff" />
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>RISK &amp; EXECUTION</span>
                  </div>
                  <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14, paddingLeft: 37, marginTop: -2 }}>Sizing, guardrails &amp; friction</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 18, paddingLeft: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                  <ParamSlider
                    label={maxPositionSize > 1 ? `Max Position Size (${maxPositionSize} Lots / Pyramiding)` : 'Position Size (1 Lot / No Pyramiding)'}
                    value={maxPositionSize}
                    min={1}
                    max={10}
                    step={1}
                    color="#059669"
                    onChange={setMaxPositionSize}
                    darkMode={darkMode}
                    tooltipInfo={RISK_EXECUTION_DOCS.position_size}
                  />

                  <ParamSlider label={stopLoss > 0 ? `Stop Loss (${stopLoss}%)` : 'Stop Loss (Off)'} value={stopLoss} min={0} max={15} step={0.5} color="#ef4444"
                    onChange={v => setStopLoss?.(v)} darkMode={darkMode} tooltipInfo={RISK_EXECUTION_DOCS.stop_loss} />

                  <ParamSlider label={takeProfit > 0 ? `Take Profit (${takeProfit}%)` : 'Take Profit (Off)'} value={takeProfit} min={0} max={30} step={1} color="#10b981"
                    onChange={v => setTakeProfit?.(v)} darkMode={darkMode} tooltipInfo={RISK_EXECUTION_DOCS.take_profit} />

                  <ParamSlider label={slippageBps > 0 ? `Slippage (${slippageBps} bps)` : 'Slippage (0 bps / Off)'} value={slippageBps} min={0} max={20} step={1} color="#f59e0b"
                    onChange={v => setSlippageBps?.(v)} darkMode={darkMode} tooltipInfo={RISK_EXECUTION_DOCS.slippage} />

                  <ParamSlider label={commission > 0 ? `Commission ($${commission}/trade)` : 'Commission ($0 / Off)'} value={commission} min={0} max={5} step={0.5} color="#06b6d4"
                    onChange={v => setCommission?.(v)} darkMode={darkMode} tooltipInfo={RISK_EXECUTION_DOCS.commission} />
                </div>
              </div>
            )

            if (backtestMode === 'single') {
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1px 1.1fr 1px 1.1fr', minHeight: 382, height: 382, background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, marginTop: 8, boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  {/* 1. STRATEGY */}
                  <div style={{ padding: '18px 22px', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 382, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14, flexShrink: 0 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#4f46e5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Sliders size={14} color="#fff" />
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>STRATEGY</span>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 8 }}>
                      {STRATEGIES.map(s => {
                        const doc = STRATEGY_DOCS[s.id]
                        return (
                          <button key={s.id} onClick={() => selectStrategy(s.id)}
                            style={{ display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left', padding: '10px 13px', borderRadius: 12, border: strategy === s.id ? '2px solid #2563eb' : `1.5px solid ${t.borderLight}`, backgroundColor: strategy === s.id ? (darkMode ? '#172554' : '#eff6ff') : t.bgAlt, cursor: 'pointer', flexShrink: 0 }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: strategy === s.id ? '#2563eb' : t.text }}>{s.name}</div>
                                <ConfigInfoTooltip
                                  title={doc?.title || s.name}
                                  tag={doc?.tag || 'Strategy'}
                                  def={doc?.def || s.desc}
                                  why={doc?.why || 'Quantitative rules governing signal generation.'}
                                  benchmark={doc?.benchmark}
                                  darkMode={darkMode}
                                  align="right"
                                  placement="bottom"
                                />
                              </div>
                              <div style={{ fontSize: 10, color: t.textMuted, marginTop: 2 }}>{s.desc}</div>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div style={{ background: darkMode ? 'linear-gradient(180deg, transparent, #334155 20%, #334155 80%, transparent)' : 'linear-gradient(180deg, transparent, #e8edf5 20%, #e8edf5 80%, transparent)' }} />

                  {/* 2. TUNE PARAMETERS */}
                  <div style={{ padding: '18px 6px 18px 22px', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 382, overflow: 'hidden' }}>
                    <div style={{ paddingRight: 16, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 4 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Settings size={14} color="#fff" />
                        </div>
                        <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px', whiteSpace: 'nowrap' }}>TUNE PARAMETERS</span>
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14, paddingLeft: 37, marginTop: -2 }}>Signal parameters</div>
                    </div>
                    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 16, paddingBottom: 8 }}>
                      {!strategy || Object.entries(params || {}).length === 0 ? (
                        <div style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic', padding: '30px 16px', textAlign: 'center', backgroundColor: t.bgAlt, borderRadius: 8, border: `1px dashed ${t.border}` }}>
                          Select a strategy on the left to configure signal parameters.
                        </div>
                      ) : (
                        Object.entries(params || {}).map(([key, val]) => {
                          const range = PARAM_RANGES[key] || { min: 0, max: val * 3 || 100, step: 1, color: '#2563eb' }
                          return (
                            <ParamSlider key={key} label={key} value={val} min={range.min} max={range.max} step={range.step} color={range.color}
                              onChange={v => setParams(p => ({ ...p, [key]: v }))} darkMode={darkMode}
                              tooltipInfo={PARAM_DOCS[key]} />
                          )
                        })
                      )}
                    </div>
                  </div>

                  <div style={{ background: darkMode ? 'linear-gradient(180deg, transparent, #334155 20%, #334155 80%, transparent)' : 'linear-gradient(180deg, transparent, #e8edf5 20%, #e8edf5 80%, transparent)' }} />

                  {/* 3. RISK & EXECUTION ENGINE */}
                  {renderRiskExecutionSection()}
                </div>
              )
            }

            if (backtestMode === 'multi') {
              return (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1.1fr 1px 1.1fr 1px 1.1fr',
                  minHeight: 382,
                  height: 382,
                  background: t.bgCard,
                  borderRadius: 12,
                  border: `1px solid ${t.border}`,
                  marginTop: 8,
                  boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)',
                  overflow: 'hidden'
                }}>
                  {/* Column 1: Entry Conditions */}
                  <div style={{ padding: '18px 6px 18px 22px', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 382, overflow: 'hidden' }}>
                    <div style={{ paddingRight: 16, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingUp size={14} color="#fff" />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px' }}>ENTRY CONDITIONS</span>
                        </div>
                        {setEntryOperator && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: darkMode ? '#1a2332' : '#f1f5f9', borderRadius: 6, padding: 2 }}>
                            <button onClick={() => setEntryOperator('AND')} style={{ padding: '2px 8px', fontSize: 10, fontWeight: 800, border: 'none', borderRadius: 4, backgroundColor: entryOperator === 'AND' ? '#10b981' : 'transparent', color: entryOperator === 'AND' ? '#fff' : t.textMuted, cursor: 'pointer' }}>AND (All)</button>
                            <button onClick={() => setEntryOperator('OR')} style={{ padding: '2px 8px', fontSize: 10, fontWeight: 800, border: 'none', borderRadius: 4, backgroundColor: entryOperator === 'OR' ? '#10b981' : 'transparent', color: entryOperator === 'OR' ? '#fff' : t.textMuted, cursor: 'pointer' }}>OR (Any)</button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14, paddingLeft: 37, marginTop: -2 }}>Buy / long trigger rules</div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                        <CustomSelect
                          value={addEntryStrat}
                          onChange={val => setAddEntryStrat(val)}
                          options={STRATEGIES.map(s => ({ value: s.id, label: s.name, description: s.desc }))}
                          darkMode={darkMode}
                          style={{ flex: 1 }}
                        />
                        <button onClick={handleAddEntryRule} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>+ Add Rule</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 16, paddingBottom: 24 }}>
                      {(entryRules || []).length === 0 ? (
                        <div style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic', padding: 14, textAlign: 'center', backgroundColor: t.bgAlt, borderRadius: 8, border: `1px dashed ${t.border}` }}>
                          No entry conditions added yet. Select a strategy above to add.
                        </div>
                      ) : (entryRules || []).map((rule, idx) => {
                        const stratObj = STRATEGIES.find(s => s.id === rule.strategy)
                        const doc = STRATEGY_DOCS[rule.strategy]
                        return (
                          <div key={rule.id} style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#10b981' }}>#{idx + 1} {stratObj?.name || rule.strategy}</span>
                                <ConfigInfoTooltip
                                  title={doc?.title || stratObj?.name || rule.strategy}
                                  tag="Entry Rule"
                                  def={doc?.def || stratObj?.desc || ''}
                                  why={doc?.why || 'Trigger condition for opening positions.'}
                                  benchmark={doc?.benchmark}
                                  darkMode={darkMode}
                                  align="left"
                                  placement="bottom"
                                />
                              </div>
                              <button onClick={() => handleRemoveEntryRule(rule.id)} style={{ fontSize: 10, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>✕ Remove</button>
                            </div>
                            {Object.entries(rule.params || {}).map(([pKey, pVal]) => {
                              const range = PARAM_RANGES[pKey] || { min: 1, max: pVal * 3 || 50, step: 1, color: '#10b981' }
                              return (
                                <ParamSlider key={pKey} label={pKey} value={pVal} min={range.min} max={range.max} step={range.step} color="#10b981" onChange={v => handleUpdateEntryRuleParam(rule.id, pKey, v)} darkMode={darkMode}
                                  tooltipInfo={PARAM_DOCS[pKey]} />
                              )
                            })}
                          </div>
                        )
                      })}
                      <div style={{ height: 12, flexShrink: 0 }} />
                    </div>
                  </div>

                  {/* Divider 1 */}
                  <div style={{ background: darkMode ? 'linear-gradient(180deg, transparent, #334155 20%, #334155 80%, transparent)' : 'linear-gradient(180deg, transparent, #e8edf5 20%, #e8edf5 80%, transparent)' }} />

                  {/* Column 2: Exit Conditions */}
                  <div style={{ padding: '18px 6px 18px 22px', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 382, overflow: 'hidden' }}>
                    <div style={{ paddingRight: 16, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div style={{ width: 28, height: 28, borderRadius: 9, backgroundColor: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <TrendingDown size={14} color="#fff" />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px' }}>EXIT CONDITIONS</span>
                        </div>
                        {setExitOperator && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: darkMode ? '#1a2332' : '#f1f5f9', borderRadius: 6, padding: 2 }}>
                            <button onClick={() => setExitOperator('AND')} style={{ padding: '2px 8px', fontSize: 10, fontWeight: 800, border: 'none', borderRadius: 4, backgroundColor: exitOperator === 'AND' ? '#ef4444' : 'transparent', color: exitOperator === 'AND' ? '#fff' : t.textMuted, cursor: 'pointer' }}>AND (All)</button>
                            <button onClick={() => setExitOperator('OR')} style={{ padding: '2px 8px', fontSize: 10, fontWeight: 800, border: 'none', borderRadius: 4, backgroundColor: exitOperator === 'OR' ? '#ef4444' : 'transparent', color: exitOperator === 'OR' ? '#fff' : t.textMuted, cursor: 'pointer' }}>OR (Any)</button>
                          </div>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 14, paddingLeft: 37, marginTop: -2 }}>Sell / short trigger rules</div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                        <CustomSelect
                          value={addExitStrat}
                          onChange={val => setAddExitStrat(val)}
                          options={STRATEGIES.map(s => ({ value: s.id, label: s.name, description: s.desc }))}
                          darkMode={darkMode}
                          style={{ flex: 1 }}
                        />
                        <button onClick={handleAddExitRule} style={{ padding: '7px 12px', fontSize: 11, fontWeight: 700, backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', flexShrink: 0 }}>+ Add Rule</button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto', paddingRight: 16, paddingBottom: 24 }}>
                      {(exitRules || []).length === 0 ? (
                        <div style={{ fontSize: 11, color: t.textMuted, fontStyle: 'italic', padding: 14, textAlign: 'center', backgroundColor: t.bgAlt, borderRadius: 8, border: `1px dashed ${t.border}` }}>
                          No exit conditions added yet (defaults to reversal entry or stop loss/take profit).
                        </div>
                      ) : (exitRules || []).map((rule, idx) => {
                        const stratObj = STRATEGIES.find(s => s.id === rule.strategy)
                        const doc = STRATEGY_DOCS[rule.strategy]
                        return (
                          <div key={rule.id} style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: 10 }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontSize: 11, fontWeight: 700, color: '#ef4444' }}>#{idx + 1} {stratObj?.name || rule.strategy}</span>
                                <ConfigInfoTooltip
                                  title={doc?.title || stratObj?.name || rule.strategy}
                                  tag="Exit Rule"
                                  def={doc?.def || stratObj?.desc || ''}
                                  why={doc?.why || 'Trigger condition for closing positions.'}
                                  benchmark={doc?.benchmark}
                                  darkMode={darkMode}
                                  align="left"
                                  placement="bottom"
                                />
                              </div>
                              <button onClick={() => handleRemoveExitRule(rule.id)} style={{ fontSize: 10, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}>✕ Remove</button>
                            </div>
                            {Object.entries(rule.params || {}).map(([pKey, pVal]) => {
                              const range = PARAM_RANGES[pKey] || { min: 1, max: pVal * 3 || 50, step: 1, color: '#ef4444' }
                              return (
                                <ParamSlider key={pKey} label={pKey} value={pVal} min={range.min} max={range.max} step={range.step} color="#ef4444" onChange={v => handleUpdateExitRuleParam(rule.id, pKey, v)} darkMode={darkMode}
                                  tooltipInfo={PARAM_DOCS[pKey]} />
                              )
                            })}
                          </div>
                        )
                      })}
                      <div style={{ height: 12, flexShrink: 0 }} />
                    </div>
                  </div>

                  {/* Divider 2 */}
                  <div style={{ background: darkMode ? 'linear-gradient(180deg, transparent, #334155 20%, #334155 80%, transparent)' : 'linear-gradient(180deg, transparent, #e8edf5 20%, #e8edf5 80%, transparent)' }} />

                  {/* Column 3: Risk & Execution */}
                  {renderRiskExecutionSection()}
                </div>
              )
            }

            if (backtestMode === 'portfolio') {
              const totalWeight = portfolioLegs.reduce((sum, leg) => sum + (leg.allocationPct || 0), 0)
              const curLeg = portfolioLegs.find(l => l.id === activeLegTab) || portfolioLegs[0]
              const curIdx = portfolioLegs.findIndex(l => l.id === curLeg?.id)
              const legColors = ['#2563eb', '#10b981', '#f59e0b', '#a855f7']
              const curColor = curLeg?.color || legColors[curIdx >= 0 ? curIdx % legColors.length : 0]
              const otherWeight = portfolioLegs.filter(l => l.id !== curLeg?.id).reduce((sum, l) => sum + (l.allocationPct || 0), 0)
              const maxAllowedForCur = Math.max(0, 100 - otherWeight)

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1px 1fr', minHeight: 382, height: 382, background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, marginTop: 8, boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                  {/* Left Column: Compact Portfolio Legs & Rules */}
                  <div style={{ padding: '16px 20px', minWidth: 0, boxSizing: 'border-box', display: 'flex', flexDirection: 'column', height: '100%', maxHeight: 382, overflow: 'hidden' }}>
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexShrink: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <Layers size={14} color="#fff" />
                        </div>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px' }}>PORTFOLIO LEGS</span>
                            <span style={{
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 7px',
                              borderRadius: 4,
                              backgroundColor: totalWeight === 100 ? (darkMode ? '#064e3b' : '#ecfdf5') : (totalWeight > 100 ? (darkMode ? '#450a0a' : '#fef2f2') : (darkMode ? '#1e293b' : '#f1f5f9')),
                              color: totalWeight === 100 ? '#10b981' : (totalWeight > 100 ? '#ef4444' : '#0284c7')
                            }}>
                              Total: {totalWeight}% / 100%
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>Configure assets, weights &amp; entry/exit conditions</div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          if (portfolioLegs.length >= 4) return
                          const defaultSymbols = ['DIA', 'IWM', 'AAPL', 'MSFT', 'NVDA']
                          const usedSymbols = new Set(portfolioLegs.map(l => l.symbol.toUpperCase()))
                          const nextSym = defaultSymbols.find(s => !usedSymbols.has(s)) || 'DIA'
                          const newWeight = Math.min(25, Math.max(0, 100 - totalWeight))
                          const newId = `leg_${Date.now()}`
                          setPortfolioLegs && setPortfolioLegs(prev => [
                            ...prev,
                            { id: newId, symbol: nextSym, allocationPct: newWeight, strategy: 'sma_crossover', params: { fast: 10, slow: 30 } }
                          ])
                          setActiveLegTab(newId)
                        }}
                        disabled={portfolioLegs.length >= 4}
                        style={{
                          padding: '6px 11px',
                          fontSize: 11,
                          fontWeight: 700,
                          backgroundColor: portfolioLegs.length >= 4 ? (darkMode ? '#334155' : '#cbd5e1') : '#0284c7',
                          color: portfolioLegs.length >= 4 ? t.textMuted : '#fff',
                          border: 'none',
                          borderRadius: 6,
                          cursor: portfolioLegs.length >= 4 ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                        title={portfolioLegs.length >= 4 ? 'Max 4 assets allowed' : 'Add another stock to portfolio'}
                      >
                        {portfolioLegs.length >= 4 ? 'Max 4' : '+ Add Leg'}
                      </button>
                    </div>

                    {/* Stock Tabs */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2, flexShrink: 0 }}>
                      {portfolioLegs.map((leg, index) => {
                        const col = leg.color || legColors[index % legColors.length]
                        const isActive = leg.id === (curLeg?.id || portfolioLegs[0]?.id)
                        return (
                          <button
                            key={leg.id}
                            onClick={() => setActiveLegTab(leg.id)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              padding: '5px 12px',
                              borderRadius: 6,
                              border: isActive ? `1.5px solid ${col}` : `1px solid ${t.border}`,
                              backgroundColor: isActive ? (darkMode ? '#1e293b' : '#f8fafc') : 'transparent',
                              color: isActive ? col : t.textSec,
                              fontWeight: isActive ? 800 : 600,
                              fontSize: 11,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                          >
                            <span style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: col }} />
                            <span>{leg.symbol || `Leg ${index + 1}`}</span>
                            <span style={{ fontSize: 10, opacity: 0.8 }}>({leg.allocationPct}%)</span>
                          </button>
                        )
                      })}
                    </div>

                    {/* Active Leg Card */}
                    {curLeg && (
                      <div style={{ backgroundColor: t.bgAlt, border: `1px solid ${t.border}`, borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0, overflowY: 'auto' }}>
                        {/* Leg Settings Header Row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, paddingBottom: 8, borderBottom: `1px solid ${t.border}`, flexShrink: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSec }}>Ticker:</span>
                              <input
                                value={curLeg.symbol}
                                onChange={e => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, symbol: e.target.value.toUpperCase() } : l))}
                                placeholder="Ticker"
                                style={{ width: 62, padding: '4px 6px', fontSize: 11, fontWeight: 800, backgroundColor: t.inputBg, border: `1px solid ${t.inputBorder}`, borderRadius: 4, color: t.text, outline: 'none' }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSec }}>Weight:</span>
                              <NumberStepper
                                value={curLeg.allocationPct}
                                min={0}
                                max={maxAllowedForCur}
                                step={5}
                                suffix="%"
                                width={68}
                                darkMode={darkMode}
                                onChange={v => {
                                  const clamped = Math.min(maxAllowedForCur, Math.max(0, v))
                                  setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, allocationPct: clamped } : l))
                                }}
                              />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSec }}>Color:</span>
                              <BuiltinColorPicker
                                color={curLeg.color || curColor}
                                defaultColor={curColor}
                                onChange={val => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, color: val } : l))}
                                onReset={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, color: undefined } : l))}
                                darkMode={darkMode}
                                size={20}
                                title="Custom Stock Curve Color"
                              />
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            {/* Mode Toggle: Preset Strategy vs Entry/Exit Conditions */}
                            <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: darkMode ? '#0f172a' : '#e2e8f0', borderRadius: 6, padding: 2 }}>
                              <button
                                onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, ruleMode: 'single' } : l))}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 10,
                                  fontWeight: curLeg.ruleMode !== 'multi' ? 800 : 600,
                                  borderRadius: 4,
                                  border: 'none',
                                  backgroundColor: curLeg.ruleMode !== 'multi' ? '#0284c7' : 'transparent',
                                  color: curLeg.ruleMode !== 'multi' ? '#ffffff' : t.textMuted,
                                  cursor: 'pointer'
                                }}
                              >
                                Strategy Preset
                              </button>
                              <button
                                onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? {
                                  ...l,
                                  ruleMode: 'multi',
                                  entryRules: l.entryRules || [{ id: `ent_${Date.now()}`, strategy: l.strategy || 'sma_crossover', params: { ...(l.params || {}) } }],
                                  exitRules: l.exitRules || [{ id: `ext_${Date.now()}`, strategy: 'mean_reversion_rsi', params: { period: 14, overbought: 70, oversold: 30 } }]
                                } : l))}
                                style={{
                                  padding: '3px 8px',
                                  fontSize: 10,
                                  fontWeight: curLeg.ruleMode === 'multi' ? 800 : 600,
                                  borderRadius: 4,
                                  border: 'none',
                                  backgroundColor: curLeg.ruleMode === 'multi' ? '#0284c7' : 'transparent',
                                  color: curLeg.ruleMode === 'multi' ? '#ffffff' : t.textMuted,
                                  cursor: 'pointer'
                                }}
                              >
                                Entry / Exit Rules
                              </button>
                            </div>

                            {/* Remove Leg button */}
                            {portfolioLegs.length > 2 && (
                              <button
                                onClick={() => {
                                  setPortfolioLegs && setPortfolioLegs(prev => prev.filter(l => l.id !== curLeg.id))
                                  const remaining = portfolioLegs.filter(l => l.id !== curLeg.id)
                                  if (remaining[0]) setActiveLegTab(remaining[0].id)
                                }}
                                style={{ fontSize: 10, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}
                                title="Remove this stock leg"
                              >
                                ✕ Remove
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Mode 1: Preset Strategy */}
                        {curLeg.ruleMode !== 'multi' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              <span style={{ fontSize: 11, fontWeight: 700, color: t.textSec }}>Preset:</span>
                              <CustomSelect
                                value={curLeg.strategy}
                                onChange={val => {
                                  const newStrat = STRATEGIES.find(s => s.id === val)
                                  setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, strategy: val, params: { ...(newStrat?.params || {}) } } : l))
                                }}
                                options={STRATEGIES.map(s => ({ value: s.id, label: s.name, description: s.desc }))}
                                darkMode={darkMode}
                                style={{ flex: 1 }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingRight: 4, paddingBottom: 16 }}>
                              {Object.entries(curLeg.params || {}).map(([pKey, pVal]) => {
                                const range = PARAM_RANGES[pKey] || { min: 1, max: pVal * 3 || 50, step: 1, color: curColor }
                                return (
                                  <ParamSlider
                                    key={pKey}
                                    label={pKey}
                                    value={pVal}
                                    min={range.min}
                                    max={range.max}
                                    step={range.step}
                                    color={curColor}
                                    onChange={v => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, params: { ...l.params, [pKey]: v } } : l))}
                                    darkMode={darkMode}
                                    tooltipInfo={PARAM_DOCS[pKey]}
                                  />
                                )
                              })}
                              <div style={{ height: 8, flexShrink: 0 }} />
                            </div>
                          </div>
                        ) : (
                          /* Mode 2: Entry / Exit Conditions Per Stock */
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                            {/* Entry Conditions for Leg */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#10b981' }}>Entry Conditions</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: 4, padding: 2 }}>
                                  <button onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, entryOperator: 'AND' } : l))} style={{ padding: '2px 5px', fontSize: 9, fontWeight: 800, border: 'none', borderRadius: 3, backgroundColor: (curLeg.entryOperator || 'AND') === 'AND' ? '#10b981' : 'transparent', color: (curLeg.entryOperator || 'AND') === 'AND' ? '#fff' : t.textMuted, cursor: 'pointer' }}>AND</button>
                                  <button onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, entryOperator: 'OR' } : l))} style={{ padding: '2px 5px', fontSize: 9, fontWeight: 800, border: 'none', borderRadius: 3, backgroundColor: curLeg.entryOperator === 'OR' ? '#10b981' : 'transparent', color: curLeg.entryOperator === 'OR' ? '#fff' : t.textMuted, cursor: 'pointer' }}>OR</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <CustomSelect
                                  value={legAddEntryStrat[curLeg.id] || 'sma_crossover'}
                                  onChange={v => setLegAddEntryStrat(prev => ({ ...prev, [curLeg.id]: v }))}
                                  options={STRATEGIES.map(s => ({ value: s.id, label: s.name, description: s.desc }))}
                                  darkMode={darkMode}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  onClick={() => {
                                    const stratKey = legAddEntryStrat[curLeg.id] || 'sma_crossover'
                                    const sObj = STRATEGIES.find(s => s.id === stratKey)
                                    const newRule: StrategyRule = {
                                      id: `ent_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                                      strategy: stratKey,
                                      params: { ...(sObj?.params || {}) }
                                    }
                                    setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, entryRules: [...(l.entryRules || []), newRule] } : l))
                                  }}
                                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, backgroundColor: '#10b981', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                                >
                                  + Add
                                </button>
                              </div>
                              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 16 }}>
                                {(curLeg.entryRules || []).map((rule, rIdx) => {
                                  const stratObj = STRATEGIES.find(s => s.id === rule.strategy)
                                  return (
                                    <div key={rule.id} style={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', border: `1px solid ${t.border}`, borderRadius: 6, padding: '6px 8px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#10b981' }}>#{rIdx + 1} {stratObj?.name || rule.strategy}</span>
                                        <button
                                          onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, entryRules: (l.entryRules || []).filter(r => r.id !== rule.id) } : l))}
                                          style={{ fontSize: 9, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}
                                        >✕</button>
                                      </div>
                                      {Object.entries(rule.params || {}).map(([pKey, pVal]) => {
                                        const range = PARAM_RANGES[pKey] || { min: 1, max: pVal * 3 || 50, step: 1, color: '#10b981' }
                                        return (
                                          <ParamSlider
                                            key={pKey}
                                            label={pKey}
                                            value={pVal}
                                            min={range.min}
                                            max={range.max}
                                            step={range.step}
                                            color="#10b981"
                                            onChange={v => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? {
                                              ...l,
                                              entryRules: (l.entryRules || []).map(r => r.id === rule.id ? { ...r, params: { ...(r.params || {}), [pKey]: v } } : r)
                                            } : l))}
                                            darkMode={darkMode}
                                            tooltipInfo={PARAM_DOCS[pKey]}
                                          />
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                                <div style={{ height: 8, flexShrink: 0 }} />
                              </div>
                            </div>

                            {/* Exit Conditions for Leg */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                                <span style={{ fontSize: 11, fontWeight: 800, color: '#ef4444' }}>Exit Conditions</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 2, backgroundColor: darkMode ? '#0f172a' : '#f1f5f9', borderRadius: 4, padding: 2 }}>
                                  <button onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, exitOperator: 'AND' } : l))} style={{ padding: '2px 5px', fontSize: 9, fontWeight: 800, border: 'none', borderRadius: 3, backgroundColor: curLeg.exitOperator === 'AND' ? '#ef4444' : 'transparent', color: curLeg.exitOperator === 'AND' ? '#fff' : t.textMuted, cursor: 'pointer' }}>AND</button>
                                  <button onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, exitOperator: 'OR' } : l))} style={{ padding: '2px 5px', fontSize: 9, fontWeight: 800, border: 'none', borderRadius: 3, backgroundColor: (curLeg.exitOperator || 'OR') === 'OR' ? '#ef4444' : 'transparent', color: (curLeg.exitOperator || 'OR') === 'OR' ? '#fff' : t.textMuted, cursor: 'pointer' }}>OR</button>
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                <CustomSelect
                                  value={legAddExitStrat[curLeg.id] || 'mean_reversion_rsi'}
                                  onChange={v => setLegAddExitStrat(prev => ({ ...prev, [curLeg.id]: v }))}
                                  options={STRATEGIES.map(s => ({ value: s.id, label: s.name, description: s.desc }))}
                                  darkMode={darkMode}
                                  style={{ flex: 1 }}
                                />
                                <button
                                  onClick={() => {
                                    const stratKey = legAddExitStrat[curLeg.id] || 'mean_reversion_rsi'
                                    const sObj = STRATEGIES.find(s => s.id === stratKey)
                                    const newRule: StrategyRule = {
                                      id: `ext_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
                                      strategy: stratKey,
                                      params: { ...(sObj?.params || {}) }
                                    }
                                    setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, exitRules: [...(l.exitRules || []), newRule] } : l))
                                  }}
                                  style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, backgroundColor: '#ef4444', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', flexShrink: 0 }}
                                >
                                  + Add
                                </button>
                              </div>
                              <div style={{ maxHeight: 260, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingRight: 4, paddingBottom: 16 }}>
                                {(curLeg.exitRules || []).map((rule, rIdx) => {
                                  const stratObj = STRATEGIES.find(s => s.id === rule.strategy)
                                  return (
                                    <div key={rule.id} style={{ backgroundColor: darkMode ? '#0f172a' : '#ffffff', border: `1px solid ${t.border}`, borderRadius: 6, padding: '6px 8px' }}>
                                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                        <span style={{ fontSize: 10, fontWeight: 700, color: '#ef4444' }}>#{rIdx + 1} {stratObj?.name || rule.strategy}</span>
                                        <button
                                          onClick={() => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? { ...l, exitRules: (l.exitRules || []).filter(r => r.id !== rule.id) } : l))}
                                          style={{ fontSize: 9, color: '#ef4444', border: 'none', background: 'none', cursor: 'pointer', fontWeight: 700 }}
                                        >✕</button>
                                      </div>
                                      {Object.entries(rule.params || {}).map(([pKey, pVal]) => {
                                        const range = PARAM_RANGES[pKey] || { min: 1, max: pVal * 3 || 50, step: 1, color: '#ef4444' }
                                        return (
                                          <ParamSlider
                                            key={pKey}
                                            label={pKey}
                                            value={pVal}
                                            min={range.min}
                                            max={range.max}
                                            step={range.step}
                                            color="#ef4444"
                                            onChange={v => setPortfolioLegs && setPortfolioLegs(prev => prev.map(l => l.id === curLeg.id ? {
                                              ...l,
                                              exitRules: (l.exitRules || []).map(r => r.id === rule.id ? { ...r, params: { ...(r.params || {}), [pKey]: v } } : r)
                                            } : l))}
                                            darkMode={darkMode}
                                            tooltipInfo={PARAM_DOCS[pKey]}
                                          />
                                        )
                                      })}
                                    </div>
                                  )
                                })}
                                <div style={{ height: 8, flexShrink: 0 }} />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Divider */}
                  <div style={{ background: darkMode ? 'linear-gradient(180deg, transparent, #334155 20%, #334155 80%, transparent)' : 'linear-gradient(180deg, transparent, #e8edf5 20%, #e8edf5 80%, transparent)' }} />

                  {/* Right Column: Global Risk & Execution */}
                  {renderRiskExecutionSection()}
                </div>
              )
            }

            if (backtestMode === 'saved') {
              return (
                <div style={{ background: t.bgCard, borderRadius: 12, border: `1px solid ${t.border}`, padding: '20px 24px', marginTop: 8, boxShadow: darkMode ? '0 4px 20px rgba(0,0,0,0.35)' : '0 2px 10px rgba(0,0,0,0.04)' }}>
              {/* Header Bar */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 30, height: 30, borderRadius: 8, backgroundColor: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Activity size={16} color="#fff" />
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: t.text, letterSpacing: '0.3px' }}>SAVED STRATEGIES COMPARISON</span>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, backgroundColor: darkMode ? '#0f172a' : '#e2e8f0', color: t.textSec }}>
                        {savedStrategies.length}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: t.textMuted, marginTop: 1 }}>
                      Click any column header to sort · Click any row or &quot;Load&quot; to restore into backtester
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {setSavedSortKey && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: t.textMuted, letterSpacing: '0.4px' }}>SORT BY:</span>
                      <CustomSelect
                        value={savedSortKey}
                        onChange={val => {
                          setSavedSortKey(val)
                          setSortDir(val === 'name' ? 'asc' : 'desc')
                        }}
                        options={[
                          { value: 'timestamp', label: 'Date / Time (Newest)' },
                          { value: 'name', label: 'Strategy Name' },
                          { value: 'totalReturn', label: 'Total Return' },
                          { value: 'alpha', label: 'Alpha' },
                          { value: 'sharpe', label: 'Sharpe Ratio' },
                          { value: 'sortino', label: 'Sortino Ratio' },
                          { value: 'winRate', label: 'Win Rate' },
                          { value: 'maxDrawdown', label: 'Max Drawdown' },
                          { value: 'profitFactor', label: 'Profit Factor' },
                          { value: 'trades', label: 'Total Trades' },
                        ]}
                        darkMode={darkMode}
                        size="sm"
                        align="right"
                      />
                      <button
                        type="button"
                        onClick={() => setSortDir(prev => prev === 'desc' ? 'asc' : 'desc')}
                        title={`Current sort direction: ${sortDir === 'desc' ? 'Descending (High to Low)' : 'Ascending (Low to High)'}. Click to reverse.`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '5px 9px',
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          border: `1px solid ${t.inputBorder}`,
                          backgroundColor: t.inputBg,
                          color: t.text,
                          cursor: 'pointer'
                        }}
                      >
                        <span>{sortDir === 'desc' ? '▼ Desc' : '▲ Asc'}</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {sortedSaved.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 24px', backgroundColor: t.bgAlt, borderRadius: 10, border: `1px dashed ${t.border}` }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: darkMode ? '#1e293b' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                    <Activity size={20} color={t.textMuted} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: t.text, marginBottom: 6 }}>No saved strategies yet</div>
                  <div style={{ fontSize: 12, color: t.textMuted, maxWidth: 420, margin: '0 auto' }}>
                    Run a backtest and click &quot;Save Strategy&quot; to build your comparison matrix with performance metrics and timestamps.
                  </div>
                </div>
              ) : (
                <div style={{
                  overflowX: 'auto',
                  maxHeight: 460,
                  overflowY: 'auto',
                  borderRadius: 8,
                  border: `1px solid ${t.border}`,
                  backgroundColor: t.bg
                }}>
                  <table style={{ width: '100%', minWidth: 1060, borderCollapse: 'collapse', fontSize: 12, textAlign: 'left' }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: darkMode ? '#15202e' : '#f8fafc', boxShadow: `0 1px 0 ${t.border}` }}>
                      <tr>
                        {SAVED_TABLE_COLUMNS.map(col => {
                          const isActive = savedSortKey === col.key
                          return (
                            <th
                              key={col.key}
                              onClick={() => col.sortable && handleHeaderClick(col.key)}
                              style={{
                                padding: '10px 14px',
                                textAlign: col.align,
                                fontSize: 10,
                                fontWeight: 800,
                                letterSpacing: '0.5px',
                                color: isActive ? '#2563eb' : t.textSec,
                                borderBottom: `2px solid ${isActive ? '#2563eb' : t.border}`,
                                cursor: col.sortable ? 'pointer' : 'default',
                                userSelect: 'none',
                                whiteSpace: 'nowrap',
                                transition: 'color 0.15s, background-color 0.15s'
                              }}
                              onMouseEnter={e => {
                                if (col.sortable) e.currentTarget.style.backgroundColor = darkMode ? '#1e2d42' : '#f1f5f9'
                              }}
                              onMouseLeave={e => {
                                if (col.sortable) e.currentTarget.style.backgroundColor = 'transparent'
                              }}
                              title={col.sortable ? `Click to sort by ${col.label}` : undefined}
                            >
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, justifyContent: col.align === 'right' ? 'flex-end' : col.align === 'center' ? 'center' : 'flex-start' }}>
                                <span>{col.label}</span>
                                {col.sortable && (
                                  <span style={{ fontSize: 9, opacity: isActive ? 1 : 0.4, color: isActive ? '#2563eb' : 'inherit' }}>
                                    {isActive ? (sortDir === 'asc' ? '▲' : '▼') : '↕'}
                                  </span>
                                )}
                              </div>
                            </th>
                          )
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {sortedSaved.map(saved => {
                        const stratName = saved.mode === 'single'
                          ? (STRATEGIES.find(s => s.id === saved.strategy)?.name || saved.strategy || '—')
                          : saved.mode === 'portfolio'
                          ? `Portfolio (${(saved.portfolioLegs || []).map(l => `${l.symbol} ${l.allocationPct}%`).join(', ')})`
                          : `Conditional (${(saved.entryRules || []).length}E / ${(saved.exitRules || []).length}X)`
                        const dt = formatDateTime(saved.timestamp)
                        return (
                          <tr
                            key={saved.id}
                            onClick={() => onLoadSaved?.(saved)}
                            style={{
                              cursor: 'pointer',
                              borderBottom: `1px solid ${t.borderLight}`,
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => (e.currentTarget.style.backgroundColor = darkMode ? '#1e293b' : '#f8fafc')}
                            onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
                            title="Click row to load strategy parameters into backtester"
                          >
                            {/* Strategy Name */}
                            <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: t.text }}>{saved.name}</span>
                                  <span style={{
                                    fontSize: 9,
                                    fontWeight: 800,
                                    padding: '2px 6px',
                                    borderRadius: 4,
                                    backgroundColor: saved.mode === 'single' ? '#2563eb' : (saved.mode === 'portfolio' ? '#0284c7' : '#7c3aed'),
                                    color: '#fff',
                                    letterSpacing: '0.4px',
                                    flexShrink: 0
                                  }}>
                                    {saved.mode === 'single' ? 'SINGLE' : (saved.mode === 'portfolio' ? 'PORTFOLIO' : 'COND')}
                                  </span>
                                </div>
                                <span style={{ fontSize: 10, color: t.textMuted }}>{stratName}</span>
                              </div>
                            </td>

                            {/* Market / Setup */}
                            <td style={{ padding: '12px 14px', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap' }}>
                                <span style={{
                                  fontSize: 11,
                                  fontWeight: 800,
                                  padding: '2px 8px',
                                  borderRadius: 6,
                                  backgroundColor: darkMode ? '#0f172a' : '#f1f5f9',
                                  border: `1px solid ${t.border}`,
                                  color: t.text
                                }}>
                                  {saved.symbol}
                                </span>
                                <span style={{ fontSize: 11, color: t.textSec, whiteSpace: 'nowrap' }}>
                                  {saved.timeframe} · {saved.lookback}
                                </span>
                              </div>
                            </td>

                            {/* Return */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                <span style={{
                                  fontSize: 13,
                                  fontWeight: 800,
                                  color: saved.result.totalReturn >= 0 ? '#10b981' : '#ef4444'
                                }}>
                                  {saved.result.totalReturn >= 0 ? `+${saved.result.totalReturn.toFixed(1)}%` : `${saved.result.totalReturn.toFixed(1)}%`}
                                </span>
                                {saved.result.buyHoldReturn != null && (
                                  <span style={{ fontSize: 10, color: t.textMuted }}>
                                    B&H: {saved.result.buyHoldReturn >= 0 ? `+${saved.result.buyHoldReturn.toFixed(1)}%` : `${saved.result.buyHoldReturn.toFixed(1)}%`}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Alpha */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 13,
                                fontWeight: 800,
                                color: saved.result.alpha >= 0 ? '#10b981' : '#ef4444'
                              }}>
                                {saved.result.alpha >= 0 ? `+${saved.result.alpha.toFixed(1)}%` : `${saved.result.alpha.toFixed(1)}%`}
                              </span>
                            </td>

                            {/* Sharpe */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 800,
                                padding: '3px 8px',
                                borderRadius: 6,
                                backgroundColor: saved.result.sharpe >= 1 ? (darkMode ? '#064e3b' : '#ecfdf5') : saved.result.sharpe >= 0 ? (darkMode ? '#451a03' : '#fffbeb') : (darkMode ? '#450a0a' : '#fef2f2'),
                                color: saved.result.sharpe >= 1 ? '#10b981' : saved.result.sharpe >= 0 ? '#f59e0b' : '#ef4444',
                                border: `1px solid ${saved.result.sharpe >= 1 ? '#10b98144' : saved.result.sharpe >= 0 ? '#f59e0b44' : '#ef444444'}`
                              }}>
                                {saved.result.sharpe != null ? saved.result.sharpe.toFixed(2) : '—'}
                              </span>
                            </td>

                            {/* Sortino */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: (saved.result.sortino ?? 0) >= 1.5 ? '#10b981' : (saved.result.sortino ?? 0) >= 0 ? t.text : '#ef4444'
                              }}>
                                {saved.result.sortino != null ? saved.result.sortino.toFixed(2) : '—'}
                              </span>
                            </td>

                            {/* Win Rate */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: saved.result.winRate >= 50 ? '#10b981' : t.text
                              }}>
                                {saved.result.winRate != null ? `${saved.result.winRate.toFixed(1)}%` : '—'}
                              </span>
                            </td>

                            {/* Max DD */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: '#ef4444'
                              }}>
                                {saved.result.maxDrawdown != null ? `-${Math.abs(saved.result.maxDrawdown).toFixed(1)}%` : '—'}
                              </span>
                            </td>

                            {/* Profit Factor */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{
                                fontSize: 12,
                                fontWeight: 700,
                                color: (saved.result.profitFactor ?? 0) >= 1.5 ? '#10b981' : (saved.result.profitFactor ?? 0) >= 1 ? '#f59e0b' : t.text
                              }}>
                                {saved.result.profitFactor != null ? saved.result.profitFactor.toFixed(2) : '—'}
                              </span>
                            </td>

                            {/* Trades */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <span style={{ fontSize: 12, fontWeight: 700, color: t.text }}>
                                {saved.result.trades ?? '—'}
                              </span>
                            </td>

                            {/* Date / Time */}
                            <td style={{ padding: '12px 14px', textAlign: 'right', verticalAlign: 'middle' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                                <span style={{ fontSize: 11, fontWeight: 600, color: t.text, whiteSpace: 'nowrap' }}>{dt.dateStr}</span>
                                <span style={{ fontSize: 10, color: t.textMuted, whiteSpace: 'nowrap' }}>{dt.timeStr}</span>
                              </div>
                            </td>

                            {/* Actions */}
                            <td style={{ padding: '12px 14px', textAlign: 'center', verticalAlign: 'middle' }}>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }} onClick={e => e.stopPropagation()}>
                                <button
                                  type="button"
                                  onClick={() => onLoadSaved?.(saved)}
                                  style={{
                                    padding: '5px 12px',
                                    fontSize: 11,
                                    fontWeight: 700,
                                    backgroundColor: '#2563eb',
                                    color: '#fff',
                                    border: 'none',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    boxShadow: '0 1px 3px rgba(37,99,235,0.3)',
                                    transition: 'background-color 0.15s'
                                  }}
                                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#1d4ed8')}
                                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#2563eb')}
                                  title="Load parameters into backtester"
                                >
                                  Load
                                </button>
                                <button
                                  type="button"
                                  onClick={() => onDeleteSaved?.(saved.id)}
                                  style={{
                                    padding: 6,
                                    border: 'none',
                                    background: 'none',
                                    cursor: 'pointer',
                                    color: '#ef4444',
                                    opacity: 0.6,
                                    borderRadius: 4,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.backgroundColor = darkMode ? '#450a0a' : '#fee2e2' }}
                                  onMouseLeave={e => { e.currentTarget.style.opacity = '0.6'; e.currentTarget.style.backgroundColor = 'transparent' }}
                                  title="Delete saved strategy"
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        }

        return null
      })()
    )}
      </div>
    </div>
  )
}