'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'
import ExplainerPanel from '../ExplainerPanel'
import { EXPLAINERS } from '@/lib/explainers'
import {
  CLUSTER_COLORS,
  initState,
  stepAlgorithm,
  type KState,
} from '@/lib/algorithms/kmeans'

// ─── Presentation constants ───────────────────────────────────────────────────

const CLUSTER_COLORS_DIM = [
  'rgba(0,229,255,0.25)',
  'rgba(124,58,237,0.25)',
  'rgba(245,158,11,0.25)',
]

const DEFAULT_INSIGHT: Insight = {
  title: 'K-Means Clustering',
  body: 'K-Means minimizes within-cluster variance. The centroid is always the mathematical mean of its cluster — that\'s literally where the name comes from. Convergence is guaranteed but the result depends heavily on initialization.',
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function getCanvasColors() {
  const dark =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('dark')
  return {
    bg: dark ? '#0d0d14' : '#fafaf8',
    surface: dark ? '#111118' : '#ffffff',
    border: dark ? '#1e1e2e' : '#e2e0d8',
    text: dark ? '#e2e8f0' : '#1a1a2e',
    muted: dark ? '#64748b' : '#6b7280',
  }
}

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: KState,
  _w: number,
  _h: number
): void {
  const colors = getCanvasColors()
  // Advance animation
  state.animProgress = Math.min(1, state.animProgress + 0.04)

  const W = 700
  const H = 440

  // Background
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, W, H)

  // Compute current centroid visual positions (lerp)
  const centroidPositions = state.centroids.map(c => ({
    cx: c.x + (c.tx - c.x) * state.animProgress,
    cy: c.y + (c.ty - c.y) * state.animProgress,
    color: c.color,
  }))

  // Snap after animation completes
  if (state.animProgress >= 1) {
    for (let i = 0; i < state.centroids.length; i++) {
      state.centroids[i].x = state.centroids[i].tx
      state.centroids[i].y = state.centroids[i].ty
    }
  }

  // Dashed lines from points to centroids
  ctx.save()
  ctx.setLineDash([4, 4])
  ctx.lineWidth = 1
  for (const p of state.points) {
    const ci = p.cluster
    const cp = centroidPositions[ci]
    if (!cp) continue
    ctx.strokeStyle = CLUSTER_COLORS_DIM[ci] ?? 'rgba(255,255,255,0.1)'
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(cp.cx, cp.cy)
    ctx.stroke()
  }
  ctx.setLineDash([])
  ctx.restore()

  // Draw points
  for (const p of state.points) {
    const color = CLUSTER_COLORS[p.cluster] ?? '#64748b'
    ctx.save()
    ctx.beginPath()
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.restore()
  }

  // Draw centroids as diamonds + optional convergence ring
  for (let i = 0; i < centroidPositions.length; i++) {
    const cp = centroidPositions[i]
    const size = 14

    ctx.save()
    ctx.translate(cp.cx, cp.cy)
    ctx.rotate(Math.PI / 4)

    // Diamond fill
    ctx.fillStyle = cp.color
    ctx.shadowColor = cp.color
    ctx.shadowBlur = 14
    ctx.fillRect(-size / 2, -size / 2, size, size)

    // White stroke
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'
    ctx.lineWidth = 1.5
    ctx.strokeRect(-size / 2, -size / 2, size, size)
    ctx.restore()

    // Convergence glow ring
    if (state.converged) {
      ctx.save()
      ctx.beginPath()
      ctx.arc(cp.cx, cp.cy, 22, 0, Math.PI * 2)
      ctx.strokeStyle = cp.color
      ctx.lineWidth = 2
      ctx.globalAlpha = 0.6
      ctx.stroke()
      ctx.restore()
    }
  }

  // Top-right labels
  ctx.save()
  ctx.font = '12px var(--font-jetbrains), monospace'
  ctx.fillStyle = colors.muted
  ctx.textAlign = 'right'
  ctx.fillText(`Iteration: ${state.iteration}`, W - 16, 24)

  if (state.converged) {
    ctx.fillStyle = '#10b981'
    ctx.fillText('✓ Converged', W - 16, 42)
  }
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function KMeansViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef<KState>(initState(3))
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logCountRef = useRef(0)

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [currentInsight, setCurrentInsight] = useState<Insight | null>(null)
  const [kValue, setKValue] = useState(3)

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    logCountRef.current++
    setLogs(prev => [
      ...prev.slice(-80),
      { id: Date.now() + Math.random(), step: logCountRef.current, message, type },
    ])
  }, [])

  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && canvas) drawCanvas(ctx, stateRef.current, canvas.width, canvas.height)
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const stepForward = useCallback(() => {
    const result = stepAlgorithm(stateRef.current)
    stateRef.current = result.state
    if (result.log) addLog(result.log.message, result.log.type)
    if (result.insight !== undefined) setCurrentInsight(result.insight)
    if (result.done) setIsPlaying(false)
  }, [addLog])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isPlaying) return
    const delays: Record<Speed, number> = { slow: 1600, normal: 800, fast: 200 }
    timerRef.current = setInterval(stepForward, delays[speed])
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPlaying, speed, stepForward])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    if (timerRef.current) clearInterval(timerRef.current)
    stateRef.current = initState(kValue)
    setLogs([])
    setCurrentInsight(null)
    logCountRef.current = 0
  }, [kValue])

  const handleKChange = useCallback((newK: number) => {
    setKValue(newK)
    setIsPlaying(false)
    if (timerRef.current) clearInterval(timerRef.current)
    stateRef.current = initState(newK)
    setLogs([])
    setCurrentInsight(null)
    logCountRef.current = 0
  }, [])

  const kSelector = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: 'var(--muted)' }}>
        K = {kValue}
      </span>
      <input
        type="range"
        min={2}
        max={5}
        value={kValue}
        onChange={e => handleKChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#00e5ff', cursor: 'pointer' }}
      />
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--border)' }}>2</span>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: 'var(--border)' }}>5</span>
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="viz-header-row">
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, color: 'var(--text)', margin: 0 }}>
            K-Means Clustering
          </h2>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#00e5ff',
          }}>O(nki)</span>
          <span style={{
            padding: '2px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: 'var(--muted)',
          }}>Unsupervised</span>
        </div>
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--muted)', margin: 0 }}>
          Iteratively assign points to nearest centroid, then recompute centroids as cluster means
        </p>
      </div>

      {/* Canvas */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
        background: 'var(--canvas-bg)',
      }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={440}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>

      {/* Bottom two-column layout */}
      <div className="viz-bottom-grid">
        <TerminalLog logs={logs} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Controls
            isPlaying={isPlaying}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onStep={stepForward}
            onReset={handleReset}
            speed={speed}
            onSpeedChange={setSpeed}
            extra={kSelector}
          />
          <InsightBox insight={currentInsight} defaultInsight={DEFAULT_INSIGHT} />
        </div>
      </div>

      <ExplainerPanel sections={EXPLAINERS['kmeans']} />
    </div>
  )
}
