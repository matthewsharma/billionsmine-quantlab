'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

export interface SelectOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
}

export interface CustomSelectProps {
  value: string
  options: SelectOption[]
  onChange: (val: string) => void
  placeholder?: string
  size?: 'sm' | 'md'
  darkMode?: boolean
  width?: string | number
  style?: React.CSSProperties
  align?: 'left' | 'right'
}

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  size = 'md',
  darkMode = false,
  width,
  style,
  align = 'left'
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number; maxHeight: number }>({
    top: 0,
    left: 0,
    width: 220,
    maxHeight: 260
  })
  const containerRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const selectedOption = options.find(o => o.value === value)

  const updateDropdownPos = useCallback(() => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom
    const spaceAbove = rect.top
    const estHeight = Math.min(260, options.length * 38 + 12)
    const openUp = spaceBelow < estHeight && spaceAbove > spaceBelow

    const top = openUp ? Math.max(8, rect.top - estHeight - 4) : rect.bottom + 4
    const dropdownWidth = Math.max(rect.width, 220)
    let left = align === 'right' ? rect.right - dropdownWidth : rect.left

    if (left + dropdownWidth > window.innerWidth - 8) {
      left = Math.max(8, window.innerWidth - dropdownWidth - 8)
    }
    if (left < 8) left = 8

    const availableHeight = openUp ? Math.min(260, rect.top - 12) : Math.min(260, window.innerHeight - rect.bottom - 12)

    setDropdownPos({
      top,
      left,
      width: dropdownWidth,
      maxHeight: Math.max(120, availableHeight)
    })
  }, [align, options.length])

  // Reposition or close on scroll / resize
  useEffect(() => {
    if (!open) return
    updateDropdownPos()

    const handleScrollOrResize = (e: Event) => {
      if (dropdownRef.current && dropdownRef.current.contains(e.target as Node)) {
        return
      }
      updateDropdownPos()
    }

    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
  }, [open, updateDropdownPos])

  // Click-away and escape key dismissal
  useEffect(() => {
    if (!open) return
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node
      if (containerRef.current && containerRef.current.contains(target)) return
      if (dropdownRef.current && dropdownRef.current.contains(target)) return
      setOpen(false)
    }
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('touchstart', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('touchstart', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  const t = darkMode ? {
    bg: '#0f172a',
    bgCard: '#1e293b',
    bgHover: '#2a3a50',
    border: '#475569',
    text: '#f1f5f9',
    textSec: '#94a3b8',
    textMuted: '#64748b',
    shadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
    activeBg: '#1e3a8a33',
    activeText: '#38bdf8'
  } : {
    bg: '#ffffff',
    bgCard: '#ffffff',
    bgHover: '#f1f5f9',
    border: '#cbd5e1',
    text: '#1e293b',
    textSec: '#475569',
    textMuted: '#94a3b8',
    shadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
    activeBg: '#eff6ff',
    activeText: '#2563eb'
  }

  const isSmall = size === 'sm'

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        display: 'inline-block',
        width: width || (style?.flex ? '100%' : 'auto'),
        ...style
      }}
    >
      <button
        type="button"
        onClick={() => {
          if (!open) updateDropdownPos()
          setOpen(!open)
        }}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: isSmall ? '4px 8px' : '6px 12px',
          fontSize: isSmall ? 11 : 12,
          fontWeight: 600,
          color: selectedOption ? t.text : t.textMuted,
          backgroundColor: t.bg,
          border: `1.5px solid ${open ? '#2563eb' : t.border}`,
          borderRadius: 6,
          cursor: 'pointer',
          outline: 'none',
          boxShadow: open ? '0 0 0 2px rgba(37,99,235,0.2)' : 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          whiteSpace: 'nowrap'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown
          size={isSmall ? 12 : 14}
          color={t.textMuted}
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s ease',
            flexShrink: 0
          }}
        />
      </button>

      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            maxWidth: 'calc(100vw - 16px)',
            maxHeight: dropdownPos.maxHeight,
            overflowY: 'auto',
            backgroundColor: t.bgCard,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            boxShadow: t.shadow,
            padding: '4px',
            zIndex: 999999,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          {options.map(option => {
            const isSelected = option.value === value
            return (
              <div
                key={option.value}
                onClick={(e) => {
                  e.stopPropagation()
                  onChange(option.value)
                  setOpen(false)
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: isSmall ? '5px 8px' : '7px 12px',
                  borderRadius: 5,
                  fontSize: isSmall ? 11 : 12,
                  fontWeight: isSelected ? 700 : 500,
                  color: isSelected ? t.activeText : t.text,
                  backgroundColor: isSelected ? t.activeBg : 'transparent',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'background-color 0.12s ease'
                }}
                onMouseEnter={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = t.bgHover
                }}
                onMouseLeave={e => {
                  if (!isSelected) e.currentTarget.style.backgroundColor = 'transparent'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{option.label}</span>
                  {option.description && (
                    <span style={{ fontSize: 10, color: t.textMuted }}>{option.description}</span>
                  )}
                </div>
                {isSelected && <Check size={13} color={t.activeText} style={{ flexShrink: 0 }} />}
              </div>
            )
          })}
        </div>,
        document.body
      )}
    </div>
  )
}
