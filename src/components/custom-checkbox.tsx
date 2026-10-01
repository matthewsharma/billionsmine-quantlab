'use client'

import React from 'react'

export interface CustomCheckboxProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: React.ReactNode
  darkMode?: boolean
  color?: string
  id?: string
  disabled?: boolean
}

export function CustomCheckbox({
  checked,
  onChange,
  label,
  darkMode = false,
  color = '#2563eb',
  id,
  disabled = false
}: CustomCheckboxProps) {
  return (
    <label
      htmlFor={id}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: checked ? 600 : 500,
        color: checked
          ? (darkMode ? '#f1f5f9' : '#1e293b')
          : (darkMode ? '#94a3b8' : '#64748b'),
        cursor: disabled ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        opacity: disabled ? 0.5 : 1,
        transition: 'color 0.15s ease'
      }}
    >
      <span
        style={{
          width: '15px',
          height: '15px',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? color : (darkMode ? '#0f172a' : '#ffffff'),
          border: `1.5px solid ${checked ? color : (darkMode ? '#475569' : '#cbd5e1')}`,
          boxShadow: checked ? `0 1px 4px ${color}40` : 'none',
          transition: 'all 0.15s ease',
          flexShrink: 0
        }}
      >
        {checked && (
          <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M1.5 4.2L3.8 6.5L8.5 1.5"
              stroke="#ffffff"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </span>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        disabled={disabled}
        onChange={e => onChange(e.target.checked)}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0, pointerEvents: 'none' }}
      />
      {label && <span>{label}</span>}
    </label>
  )
}
