import type { Insight } from '@/lib/types'

interface InsightBoxProps {
  insight: Insight | null
  defaultInsight: Insight
}

export default function InsightBox({ insight, defaultInsight }: InsightBoxProps) {
  const d = insight ?? defaultInsight
  return (
    <div style={{
      background: '#111118',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 8,
      padding: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
        <span style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 10,
          color: '#f59e0b',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.1em',
        }}>Key Insight</span>
      </div>
      <p style={{
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 12,
        color: '#e2e8f0',
        lineHeight: 1.7,
      }}>{d.body}</p>
    </div>
  )
}
