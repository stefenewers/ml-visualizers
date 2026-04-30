'use client'
import ThemeToggle from './ThemeToggle'

export default function Header() {
  return (
    <header
      style={{
        height: 56,
        background: 'var(--surface)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        flexShrink: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#00e5ff',
            boxShadow: '0 0 10px #00e5ff, 0 0 20px #00e5ff44',
          }}
        />
        <span
          style={{
            fontFamily: 'var(--font-syne), sans-serif',
            fontSize: 18,
            fontWeight: 800,
            color: 'var(--text)',
            letterSpacing: '0.05em',
          }}
        >
          ML Internals
        </span>
        <span style={{ color: 'var(--border)', margin: '0 6px' }}>|</span>
        <span
          style={{
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 12,
            color: 'var(--muted)',
          }}
        >
          Algorithm Visualizer
        </span>
      </div>

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            padding: '3px 10px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: 'var(--muted)',
          }}
        >
          v1.0
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
