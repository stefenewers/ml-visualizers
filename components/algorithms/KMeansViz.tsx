'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface KPoint { x: number; y: number; cluster: number }
interface KCentroid { x: number; y: number; tx: number; ty: number; color: string }
interface KState {
  points: KPoint[]
  centroids: KCentroid[]
  iteration: number
  converged: boolean
  animProgress: number
  changedCount: number
  phase: 'assign' | 'update' | 'done'
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CLUSTER_COLORS = ['#00e5ff', '#7c3aed', '#f59e0b']
const CLUSTER_COLORS_DIM = [
  'rgba(0,229,255,0.25)',
  'rgba(124,58,237,0.25)',
  'rgba(245,158,11,0.25)',
]

const DEFAULT_INSIGHT: Insight = {
  title: 'K-Means Clustering',
  body: 'K-Means minimizes within-cluster variance. The centroid is always the mathematical mean of its cluster — that\'s literally where the name comes from. Convergence is guaranteed but the result depends heavily on initialization.',
}

// ─── Algorithm Helpers ────────────────────────────────────────────────────────

function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

function initState(k: number = 3): KState {
  const N = 40
  const points: KPoint[] = []
  for (let i = 0; i < N; i++) {
    points.push({
      x: 60 + Math.random() * 580,
      y: 60 + Math.random() * 320,
      cluster: 0,
    })
  }

  // K-Means++ centroid init
  const centroids: KCentroid[] = []
  const usedColors = CLUSTER_COLORS.slice(0, k)

  // Pick first centroid randomly
  const firstIdx = Math.floor(Math.random() * points.length)
  centroids.push({
    x: points[firstIdx].x,
    y: points[firstIdx].y,
    tx: points[firstIdx].x,
    ty: points[firstIdx].y,
    color: usedColors[0],
  })

  for (let ci = 1; ci < k; ci++) {
    // Compute distance² from each point to nearest existing centroid
    const dists = points.map(p => {
      let minD = Infinity
      for (const c of centroids) {
        const d = euclidean(p.x, p.y, c.x, c.y)
        if (d < minD) minD = d
      }
      return minD
    })
    const totalD = dists.reduce((s, d) => s + d, 0)
    let rand = Math.random() * totalD
    let chosen = points.length - 1
    for (let i = 0; i < dists.length; i++) {
      rand -= dists[i]
      if (rand <= 0) { chosen = i; break }
    }
    centroids.push({
      x: points[chosen].x,
      y: points[chosen].y,
      tx: points[chosen].x,
      ty: points[chosen].y,
      color: usedColors[ci],
    })
  }

  // Initial assignment
  for (const p of points) {
    let minD = Infinity
    let best = 0
    for (let ci = 0; ci < centroids.length; ci++) {
      const d = euclidean(p.x, p.y, centroids[ci].x, centroids[ci].y)
      if (d < minD) { minD = d; best = ci }
    }
    p.cluster = best
  }

  return {
    points,
    centroids,
    iteration: 0,
    converged: false,
    animProgress: 1,
    changedCount: 0,
    phase: 'assign',
  }
}

interface StepResult {
  state: KState
  log?: { message: string; type: LogEntry['type'] }
  insight?: Insight | null
  done: boolean
}

function stepAlgorithm(prev: KState): StepResult {
  if (prev.converged) {
    return { state: prev, done: true }
  }

  const points = prev.points.map(p => ({ ...p }))
  const centroids = prev.centroids.map(c => ({ ...c }))
  const k = centroids.length

  // Reassign
  let changedCount = 0
  for (const p of points) {
    const oldCluster = p.cluster
    let minD = Infinity
    let best = 0
    for (let ci = 0; ci < k; ci++) {
      const d = euclidean(p.x, p.y, centroids[ci].x, centroids[ci].y)
      if (d < minD) { minD = d; best = ci }
    }
    p.cluster = best
    if (p.cluster !== oldCluster) changedCount++
  }

  // Compute new centroids
  const logs: string[] = []
  for (let ci = 0; ci < k; ci++) {
    const members = points.filter(p => p.cluster === ci)
    if (members.length === 0) {
      // Empty cluster — keep position
      centroids[ci].tx = centroids[ci].x
      centroids[ci].ty = centroids[ci].y
      logs.push(`empty:${ci}`)
    } else {
      centroids[ci].tx = members.reduce((s, p) => s + p.x, 0) / members.length
      centroids[ci].ty = members.reduce((s, p) => s + p.y, 0) / members.length
    }
  }

  const iteration = prev.iteration + 1
  const converged = changedCount === 0
  const phase = converged ? 'done' : 'update'

  const newState: KState = {
    points,
    centroids,
    iteration,
    converged,
    animProgress: 0,
    changedCount,
    phase,
  }

  const logEntries: StepResult['log'][] = []

  // Empty cluster warnings
  for (const entry of logs) {
    const ci = parseInt(entry.split(':')[1])
    logEntries.push({
      message: `Cluster ${ci} is empty — keeping centroid position`,
      type: 'warning',
    })
  }

  const mainLog: LogEntry['type'] = changedCount > 0 ? 'info' : 'success'
  const mainMessage = converged
    ? `Converged after ${iteration} iterations — assignments stable`
    : `Iteration ${iteration} — ${changedCount} point${changedCount === 1 ? '' : 's'} changed cluster`

  return {
    state: newState,
    log: { message: mainMessage, type: converged ? 'success' : mainLog },
    insight: converged
      ? {
          title: 'Converged!',
          body: `Stable after ${iteration} iterations. All ${newState.points.length} points settled into their final clusters. The centroids represent the true "center of mass" of each group.`,
        }
      : null,
    done: converged,
  }
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: KState,
  _w: number,
  _h: number
): void {
  // Advance animation
  state.animProgress = Math.min(1, state.animProgress + 0.04)

  const W = 700
  const H = 440

  // Background
  ctx.fillStyle = '#0a0a0f'
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
  ctx.fillStyle = '#64748b'
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
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 11, color: '#64748b' }}>
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
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: '#1e1e2e' }}>2</span>
      <span style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 10, color: '#1e1e2e' }}>5</span>
    </div>
  )

  return (
    <div style={{ background: '#0a0a0f', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, color: '#e2e8f0', margin: 0 }}>
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
            background: '#111118',
            border: '1px solid #1e1e2e',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#64748b',
          }}>Unsupervised</span>
        </div>
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: '#64748b', margin: 0 }}>
          Iteratively assign points to nearest centroid, then recompute centroids as cluster means
        </p>
      </div>

      {/* Canvas */}
      <div style={{
        border: '1px solid #1e1e2e',
        borderRadius: 8,
        overflow: 'hidden',
        marginBottom: 16,
        background: '#0a0a0f',
      }}>
        <canvas
          ref={canvasRef}
          width={700}
          height={440}
          style={{ display: 'block', maxWidth: '100%' }}
        />
      </div>

      {/* Bottom two-column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 16 }}>
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

      {/* How it works */}
      <details style={{
        marginTop: 16,
        border: '1px solid #1e1e2e',
        borderRadius: 8,
        padding: '10px 16px',
      }}>
        <summary style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 12,
          color: '#64748b',
          cursor: 'pointer',
          userSelect: 'none',
        }}>
          How it works
        </summary>
        <p style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 12,
          color: '#94a3b8',
          marginTop: 10,
          lineHeight: 1.8,
        }}>
          K-Means assigns each point to its nearest centroid, then moves each centroid to the mean
          of its assigned points. These two steps repeat until no points change cluster. The algorithm
          always converges, but may find a local optimum rather than the global best clustering —
          which is why K-Means++ initialization (choosing initial centroids that are spread far apart)
          dramatically improves results.
        </p>
      </details>
    </div>
  )
}
