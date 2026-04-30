'use client'
import { useEffect, useRef } from 'react'
import type { LogEntry } from '@/lib/types'

const logColor: Record<LogEntry['type'], string> = {
  info: '#00e5ff',
  key: '#f59e0b',
  success: '#10b981',
  warning: '#f59e0b',
}

export default function TerminalLog({ logs }: { logs: LogEntry[] }) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [logs])

  return (
    <div
      ref={containerRef}
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border)',
        borderRadius: 8,
        padding: '12px 14px',
        height: 200,
        overflowY: 'auto',
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 12,
      }}
    >
      <div style={{ color: 'var(--muted)', marginBottom: 8 }}>{'// terminal output'}</div>
      {logs.length === 0 && (
        <div style={{ color: 'var(--border)' }}>Press Play or Step to begin...</div>
      )}
      {logs.map(log => (
        <div key={log.id} style={{ marginBottom: 4, lineHeight: 1.6 }}>
          <span style={{ color: 'var(--muted)' }}>[{String(log.step).padStart(3, '0')}]</span>{' '}
          <span style={{ color: logColor[log.type] }}>{log.message}</span>
        </div>
      ))}
    </div>
  )
}
