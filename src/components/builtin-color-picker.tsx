'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { RotateCcw } from 'lucide-react'

// 12 distinct, orderly preset trading colors (Row 1: Cool/Teal/Green, Row 2: Warm/Orange/Red/Purple)
// Zero duplicates, arranged by spectrum
export const PRESET_SWATCH_COLORS = [
  '#2563eb', // Royal Blue
  '#0284c7', // Sky Blue
  '#06b6d4', // Cyan
  '#14b8a6', // Teal
  '#10b981', // Emerald
  '#84cc16', // Lime
  '#eab308', // Yellow
  '#f59e0b', // Amber
  '#f97316', // Orange
  '#ef4444', // Red
  '#ec4899', // Pink / Rose
  '#8b5cf6'  // Purple
]

const RECENT_COLORS_KEY = 'quantics_recent_colors'
const RECENT_COLORS_EVENT = 'quantics_recent_colors_updated'

function getStoredRecentColors(): string[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_COLORS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveRecentColor(color: string) {
  if (typeof window === 'undefined' || !color || !color.startsWith('#')) return
  try {
    const current = getStoredRecentColors()
    const hex = color.toLowerCase()
    const next = [hex, ...current.filter(c => c.toLowerCase() !== hex)].slice(0, 6)
    localStorage.setItem(RECENT_COLORS_KEY, JSON.stringify(next))
    window.dispatchEvent(new CustomEvent(RECENT_COLORS_EVENT, { detail: next }))
  } catch {
    // ignore
  }
}

export interface BuiltinColorPickerProps {
  color: string
  defaultColor?: string
  onChange: (color: string) => void
  onReset?: () => void
  darkMode?: boolean
  size?: number
  title?: string
}

export function BuiltinColorPicker({
  color,
  defaultColor,
  onChange,
  onReset,
  darkMode = false,
  size = 22,
  title = 'Select color'
}: BuiltinColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number }>({ top: 0, left: 0 })
  const [mounted, setMounted] = useState(false)
  const [recentColors, setRecentColors] = useState<string[]>([])

  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
    setRecentColors(getStoredRecentColors())

    const handleRecentUpdate = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setRecentColors(e.detail)
      } else {
        setRecentColors(getStoredRecentColors())
      }
    }
    window.addEventListener(RECENT_COLORS_EVENT, handleRecentUpdate)
    return () => {
      window.removeEventListener(RECENT_COLORS_EVENT, handleRecentUpdate)
    }
  }, [])

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const popoverWidth = 200
    const popoverHeight = 230

    let top = rect.bottom + 6
    let left = rect.left

    // If opening off the bottom of the screen, flip above
    if (top + popoverHeight > window.innerHeight - 8) {
      top = Math.max(8, rect.top - popoverHeight - 6)
    }
    // If opening off the right of the screen, shift left
    if (left + popoverWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - popoverWidth - 8)
    }

    setCoords({ top: Math.round(top), left: Math.round(left) })
  }, [])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition, true)
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition, true)
      }
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    if (!isOpen) return
    const handleDocumentClick = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }
      setIsOpen(false)
    }
    document.addEventListener('mousedown', handleDocumentClick)
    document.addEventListener('touchstart', handleDocumentClick)
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick)
      document.removeEventListener('touchstart', handleDocumentClick)
    }
  }, [isOpen])

  const handleColorSelected = (newColor: string, close = true) => {
    onChange(newColor)
    saveRecentColor(newColor)
    if (close) {
      setIsOpen(false)
    }
  }

  const t = {
    bg: darkMode ? '#1e293b' : '#ffffff',
    border: darkMode ? '#334155' : '#e2e8f0',
    text: darkMode ? '#f1f5f9' : '#0f172a',
    textMuted: darkMode ? '#94a3b8' : '#64748b',
    shadow: darkMode ? '0 12px 30px rgba(0,0,0,0.65)' : '0 8px 24px rgba(0,0,0,0.15)'
  }

  const activeColor = color || defaultColor || '#2563eb'

  return (
    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        title={title}
        style={{
          width: size,
          height: size,
          padding: 0,
          borderRadius: 5,
          backgroundColor: activeColor,
          border: `1.5px solid ${darkMode ? '#475569' : '#cbd5e1'}`,
          cursor: 'pointer',
          boxShadow: `0 0 0 1px ${darkMode ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.05)'}`,
          transition: 'transform 0.1s ease',
          outline: 'none',
          flexShrink: 0
        }}
      />

      {isOpen && mounted && createPortal(
        <div
          ref={popoverRef}
          data-color-picker-portal="true"
          onMouseDown={e => e.stopPropagation()}
          onTouchStart={e => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: coords.top,
            left: coords.left,
            zIndex: 99999,
            backgroundColor: t.bg,
            border: `1px solid ${t.border}`,
            borderRadius: 9,
            padding: '10px 11px',
            boxShadow: t.shadow,
            width: '196px',
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            animation: 'fadeInPopover 0.12s ease-out'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 800, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
              Color Palette
            </span>
            {onReset && defaultColor && color && color.toLowerCase() !== defaultColor.toLowerCase() && (
              <button
                type="button"
                onClick={() => {
                  onReset()
                  setIsOpen(false)
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '4px',
                  border: `1px solid ${t.border}`,
                  backgroundColor: 'transparent',
                  color: t.textMuted,
                  cursor: 'pointer'
                }}
                title="Reset to default color"
              >
                <RotateCcw size={8} /> Default
              </button>
            )}
          </div>

          {/* Quick preset color swatches - 2 orderly rows of 6 */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(6, 1fr)',
              gap: '4px'
            }}
          >
            {PRESET_SWATCH_COLORS.map(swatch => {
              const isSelected = activeColor.toLowerCase() === swatch.toLowerCase()
              return (
                <button
                  key={swatch}
                  type="button"
                  onMouseDown={(e) => { e.stopPropagation(); handleColorSelected(swatch, true) }}
                  onClick={(e) => { e.stopPropagation(); handleColorSelected(swatch, true) }}
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '4px',
                    backgroundColor: swatch,
                    border: isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.18)',
                    outline: isSelected ? `2px solid ${swatch}` : 'none',
                    cursor: 'pointer',
                    padding: 0,
                    transition: 'transform 0.1s ease',
                    boxShadow: isSelected ? '0 0 5px rgba(0,0,0,0.35)' : 'none'
                  }}
                  title={swatch}
                />
              )
            })}
          </div>

          {/* Recently Used / Custom Swatches (if any chosen) */}
          {recentColors.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingTop: '4px', borderTop: `1px solid ${t.border}` }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: t.textMuted, textTransform: 'uppercase', letterSpacing: '0.3px' }}>
                Recent / Matching
              </span>
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexWrap: 'wrap' }}>
                {recentColors.slice(0, 6).map(rc => {
                  const isSelected = activeColor.toLowerCase() === rc.toLowerCase()
                  return (
                    <button
                      key={`recent-${rc}`}
                      type="button"
                      onMouseDown={(e) => { e.stopPropagation(); handleColorSelected(rc, true) }}
                      onClick={(e) => { e.stopPropagation(); handleColorSelected(rc, true) }}
                      style={{
                        width: '22px',
                        height: '22px',
                        borderRadius: '4px',
                        backgroundColor: rc,
                        border: isSelected ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.18)',
                        outline: isSelected ? `2px solid ${rc}` : 'none',
                        cursor: 'pointer',
                        padding: 0,
                        transition: 'transform 0.1s ease'
                      }}
                      title={`Reuse custom color ${rc}`}
                    />
                  )
                })}
              </div>
            </div>
          )}

          {/* Custom hex / native input row */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              paddingTop: '5px',
              borderTop: `1px solid ${t.border}`
            }}
          >
            <input
              type="color"
              value={activeColor.startsWith('#') && activeColor.length === 7 ? activeColor : '#2563eb'}
              onMouseDown={e => e.stopPropagation()}
              onChange={e => handleColorSelected(e.target.value, false)}
              style={{
                width: '24px',
                height: '24px',
                padding: 0,
                border: `1px solid ${t.border}`,
                borderRadius: '4px',
                cursor: 'pointer',
                background: 'transparent'
              }}
              title="Open full color wheel"
            />
            <input
              type="text"
              value={activeColor.toUpperCase()}
              onChange={e => {
                const val = e.target.value
                if (val.startsWith('#') && val.length <= 7) {
                  handleColorSelected(val, false)
                } else if (!val.startsWith('#') && val.length <= 6) {
                  handleColorSelected(`#${val}`, false)
                }
              }}
              placeholder="#2563EB"
              style={{
                flex: 1,
                fontSize: '11px',
                fontWeight: 700,
                fontFamily: 'monospace',
                padding: '4px 6px',
                borderRadius: '4px',
                border: `1px solid ${t.border}`,
                backgroundColor: darkMode ? '#0f172a' : '#f8fafc',
                color: t.text,
                outline: 'none'
              }}
            />
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
