'use client'
import { useState } from 'react'
import type { ExplainerSection } from '@/lib/explainers'

interface ExplainerPanelProps {
  sections: ExplainerSection[]
}

function renderContent(text: string): React.ReactNode[] {
  return text.split('\n').map((line, i) => {
    const isCodeLine = line.startsWith('  ') && line.trim().length > 0
    if (isCodeLine) {
      return (
        <span
          key={i}
          style={{
            display: 'block',
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: '0.82rem',
            color: 'var(--accent)',
            paddingLeft: 10,
            borderLeft: '2px solid var(--accent)',
            margin: '3px 0 3px 6px',
            opacity: 0.9,
          }}
        >
          {line.trimStart()}
        </span>
      )
    }
    if (line.trim() === '') {
      return <span key={i} style={{ display: 'block', height: 10 }} />
    }
    return (
      <span key={i} style={{ display: 'block', lineHeight: 1.85 }}>
        {line}
      </span>
    )
  })
}

export default function ExplainerPanel({ sections }: ExplainerPanelProps) {
  const [open, setOpen] = useState(false)

  return (
    <div
      style={{
        marginTop: 16,
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 16px',
          background: 'var(--surface)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 12,
          color: 'var(--muted)',
        }}
      >
        <span>How it works</span>
        <span
          style={{
            display: 'inline-block',
            transition: 'transform 0.2s',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        >
          ↓
        </span>
      </button>

      {open && (
        <div
          style={{
            maxHeight: 520,
            overflowY: 'auto',
            padding: '20px 24px',
            background: 'var(--surface)',
            borderTop: '1px solid var(--border)',
          }}
        >
          {sections.map((section, i) => (
            <div key={i} style={{ marginBottom: i < sections.length - 1 ? 24 : 0 }}>
              <div
                style={{
                  fontFamily: 'var(--font-jetbrains), monospace',
                  fontSize: '0.6rem',
                  color: 'var(--accent3)',
                  textTransform: 'uppercase' as const,
                  letterSpacing: '0.15em',
                  marginBottom: 10,
                  fontWeight: 700,
                }}
              >
                {section.header}
              </div>
              <div
                style={{
                  fontSize: '0.84rem',
                  color: 'var(--text)',
                  fontFamily:
                    'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {renderContent(section.content)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
