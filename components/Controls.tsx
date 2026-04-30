'use client'
import type { Speed } from '@/lib/types'

interface ControlsProps {
  isPlaying: boolean
  onPlay: () => void
  onPause: () => void
  onStep: () => void
  onReset: () => void
  speed: Speed
  onSpeedChange: (s: Speed) => void
  disabled?: boolean
  extra?: React.ReactNode
}

const btn = (active: boolean, variant: 'primary' | 'secondary' | 'ghost') => ({
  padding: '7px 14px',
  borderRadius: 6,
  fontFamily: 'var(--font-jetbrains), monospace',
  fontSize: 12,
  cursor: 'pointer',
  transition: 'all 0.15s',
  border: variant === 'primary'
    ? '1px solid rgba(0,229,255,0.5)'
    : variant === 'secondary'
    ? '1px solid #1e1e2e'
    : '1px solid transparent',
  background: variant === 'primary' ? 'rgba(0,229,255,0.1)' : variant === 'secondary' ? '#1e1e2e' : 'transparent',
  color: variant === 'primary' ? '#00e5ff' : '#e2e8f0',
  opacity: 1,
})

export default function Controls({ isPlaying, onPlay, onPause, onStep, onReset, speed, onSpeedChange, disabled, extra }: ControlsProps) {
  return (
    <div style={{ background: '#111118', border: '1px solid #1e1e2e', borderRadius: 8, padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <button
          onClick={isPlaying ? onPause : onPlay}
          disabled={disabled}
          style={btn(true, 'primary')}
        >
          {isPlaying ? '⏸ Pause' : '▶ Play'}
        </button>
        <button onClick={onStep} disabled={isPlaying || disabled} style={{ ...btn(false, 'secondary'), opacity: isPlaying ? 0.4 : 1 }}>
          ⏭ Step
        </button>
        <button onClick={onReset} style={btn(false, 'ghost')}>
          ↺ Reset
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: '#64748b' }}>Speed:</span>
        {(['slow', 'normal', 'fast'] as Speed[]).map(s => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            style={{
              padding: '3px 10px',
              borderRadius: 4,
              fontFamily: 'var(--font-jetbrains), monospace',
              fontSize: 11,
              cursor: 'pointer',
              border: speed === s ? '1px solid rgba(0,229,255,0.3)' : '1px solid transparent',
              background: speed === s ? 'rgba(0,229,255,0.1)' : 'transparent',
              color: speed === s ? '#00e5ff' : '#64748b',
            }}
          >
            {s}
          </button>
        ))}
      </div>
      {extra && <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #1e1e2e' }}>{extra}</div>}
    </div>
  )
}
