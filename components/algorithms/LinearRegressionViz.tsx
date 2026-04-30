'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'
import ExplainerPanel from '../ExplainerPanel'
import { EXPLAINERS } from '@/lib/explainers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface LRPoint { xn: number; yn: number }
interface LRState {
  points: LRPoint[]
  m: number
  b: number
  epoch: number
  loss: number
  prevLoss: number
  lossHistory: number[]
  converged: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LR_RATE = 0.08
const MARGIN = { left: 60, right: 30, top: 30, bottom: 50 }
const PLOT_W = 700 - MARGIN.left - MARGIN.right   // 610
const PLOT_H = 440 - MARGIN.top - MARGIN.bottom   // 360

const DEFAULT_INSIGHT: Insight = {
  title: 'Gradient Descent',
  body: 'The gradient tells us which direction makes the loss worse. We step in the opposite direction. Learning rate controls step size — too large and we overshoot, too small and training takes forever. This exact process runs inside every neural network.',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gaussianNoise(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

function px(xn: number): number {
  return MARGIN.left + xn * PLOT_W
}
function py(yn: number): number {
  return MARGIN.top + (1 - yn) * PLOT_H
}

function computeLoss(points: LRPoint[], m: number, b: number): number {
  const n = points.length
  let sum = 0
  for (const p of points) {
    const pred = m * p.xn + b
    sum += (pred - p.yn) ** 2
  }
  return sum / n
}

function computeR2(points: LRPoint[], m: number, b: number): number {
  const meanY = points.reduce((s, p) => s + p.yn, 0) / points.length
  let ssTot = 0
  let ssRes = 0
  for (const p of points) {
    ssTot += (p.yn - meanY) ** 2
    const pred = m * p.xn + b
    ssRes += (p.yn - pred) ** 2
  }
  if (ssTot === 0) return 1
  return 1 - ssRes / ssTot
}

function generateData(): LRPoint[] {
  const points: LRPoint[] = []
  for (let i = 0; i < 30; i++) {
    const xn = 0.05 + Math.random() * 0.90
    const yn = Math.max(0, Math.min(1, 0.65 * xn + 0.15 + gaussianNoise() * 0.07))
    points.push({ xn, yn })
  }
  return points
}

function initState(): LRState {
  const points = generateData()
  const m = 0.05
  const b = 0.85
  const loss = computeLoss(points, m, b)
  return {
    points,
    m,
    b,
    epoch: 0,
    loss,
    prevLoss: loss,
    lossHistory: [loss],
    converged: false,
  }
}

// ─── Step ─────────────────────────────────────────────────────────────────────

interface StepResult {
  state: LRState
  log?: { message: string; type: LogEntry['type'] }
  insight?: Insight | null
  done: boolean
}

function stepAlgorithm(prev: LRState): StepResult {
  if (prev.converged) {
    return { state: prev, done: true }
  }

  const { points, m: prevM, b: prevB } = prev
  const n = points.length

  // Compute gradients
  let dLdm = 0
  let dLdb = 0
  for (const p of points) {
    const pred = prevM * p.xn + prevB
    const err = pred - p.yn
    dLdm += err * p.xn
    dLdb += err
  }
  dLdm = (2 / n) * dLdm
  dLdb = (2 / n) * dLdb

  // Update parameters
  let m = prevM - LR_RATE * dLdm
  let b = prevB - LR_RATE * dLdb

  // Clamp
  m = Math.max(-5, Math.min(5, m))
  b = Math.max(-2, Math.min(3, b))

  const prevLoss = prev.loss
  const loss = computeLoss(points, m, b)
  const lossHistory = [...prev.lossHistory, loss].slice(-80)
  const epoch = prev.epoch + 1
  const delta = loss - prevLoss

  const converged = Math.abs(delta) < 0.00005 && epoch > 20

  const newState: LRState = {
    points,
    m,
    b,
    epoch,
    loss,
    prevLoss,
    lossHistory,
    converged,
  }

  const logType: LogEntry['type'] = delta < 0 ? 'info' : 'warning'
  const deltaStr = `${delta > 0 ? '+' : ''}${delta.toFixed(4)}`
  const mainLog = converged
    ? `Converged — loss plateau reached (R² = ${computeR2(points, m, b).toFixed(3)})`
    : `Epoch ${epoch} — Loss: ${loss.toFixed(4)}, Δ: ${deltaStr}`

  const finalType: LogEntry['type'] = converged ? 'success' : logType

  return {
    state: newState,
    log: { message: mainLog, type: finalType },
    insight: converged
      ? {
          title: 'Converged!',
          body: `Training complete after ${epoch} epochs. R² = ${computeR2(points, m, b).toFixed(3)}. The line has found the least-squares fit — the same result as solving the normal equations, just computed iteratively.`,
        }
      : null,
    done: converged,
  }
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
  state: LRState,
  _w: number,
  _h: number
): void {
  const colors = getCanvasColors()
  const W = 700
  const H = 440

  // Background
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, W, H)

  // Axes
  ctx.save()
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.beginPath()
  // Y axis
  ctx.moveTo(MARGIN.left, MARGIN.top)
  ctx.lineTo(MARGIN.left, MARGIN.top + PLOT_H)
  // X axis
  ctx.moveTo(MARGIN.left, MARGIN.top + PLOT_H)
  ctx.lineTo(MARGIN.left + PLOT_W, MARGIN.top + PLOT_H)
  ctx.stroke()
  ctx.restore()

  // Axis tick marks (light)
  ctx.save()
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  for (let t = 0; t <= 4; t++) {
    const tx = MARGIN.left + (t / 4) * PLOT_W
    const ty = MARGIN.top + (t / 4) * PLOT_H
    // X grid
    ctx.beginPath()
    ctx.moveTo(tx, MARGIN.top)
    ctx.lineTo(tx, MARGIN.top + PLOT_H)
    ctx.stroke()
    // Y grid
    ctx.beginPath()
    ctx.moveTo(MARGIN.left, ty)
    ctx.lineTo(MARGIN.left + PLOT_W, ty)
    ctx.stroke()
  }
  ctx.restore()

  const { points, m, b } = state

  // Residual lines
  ctx.save()
  ctx.strokeStyle = 'rgba(239,68,68,0.4)'
  ctx.lineWidth = 1
  for (const p of points) {
    const predY = m * p.xn + b
    const x = px(p.xn)
    const y1 = py(p.yn)
    const y2 = py(predY)
    ctx.beginPath()
    ctx.moveTo(x, y1)
    ctx.lineTo(x, y2)
    ctx.stroke()
  }
  ctx.restore()

  // Regression line — clip to plot area
  const yAt0 = m * 0 + b
  const yAt1 = m * 1 + b
  let x0c = px(0)
  let y0c = py(yAt0)
  let x1c = px(1)
  let y1c = py(yAt1)

  // Clip to plot bounds
  const plotLeft = MARGIN.left
  const plotRight = MARGIN.left + PLOT_W
  const plotTop = MARGIN.top
  const plotBottom = MARGIN.top + PLOT_H

  // Simple clip: compute intersection with plot bounds
  function clipLine(
    xa: number, ya: number, xb: number, yb: number
  ): [number, number, number, number] {
    // Cohen-Sutherland simplified for our case — just clamp using parametric
    // t ranges from 0 (at xa,ya) to 1 (at xb,yb)
    let t0 = 0, t1 = 1
    const dx = xb - xa, dy = yb - ya

    function clip(p: number, q: number): boolean {
      if (p === 0) { if (q < 0) return false; return true }
      const r = q / p
      if (p < 0) { if (r > t1) return false; if (r > t0) t0 = r }
      else { if (r < t0) return false; if (r < t1) t1 = r }
      return true
    }

    if (!clip(-dx, xa - plotLeft)) return [xa, ya, xb, yb]
    if (!clip(dx, plotRight - xa)) return [xa, ya, xb, yb]
    if (!clip(-dy, ya - plotTop)) return [xa, ya, xb, yb]
    if (!clip(dy, plotBottom - ya)) return [xa, ya, xb, yb]

    return [
      xa + t0 * dx, ya + t0 * dy,
      xa + t1 * dx, ya + t1 * dy,
    ]
  }

  const [cx0, cy0, cx1, cy1] = clipLine(x0c, y0c, x1c, y1c)

  ctx.save()
  ctx.beginPath()
  ctx.rect(plotLeft, plotTop, PLOT_W, PLOT_H)
  ctx.clip()
  ctx.strokeStyle = '#00e5ff'
  ctx.lineWidth = 2
  ctx.shadowColor = '#00e5ff'
  ctx.shadowBlur = 8
  ctx.beginPath()
  ctx.moveTo(cx0, cy0)
  ctx.lineTo(cx1, cy1)
  ctx.stroke()
  ctx.restore()

  // Data points
  ctx.save()
  for (const p of points) {
    const x = px(p.xn)
    const y = py(p.yn)
    ctx.beginPath()
    ctx.arc(x, y, 4.5, 0, Math.PI * 2)
    ctx.fillStyle = colors.text
    ctx.fill()
    ctx.strokeStyle = 'rgba(100,116,139,0.5)'
    ctx.lineWidth = 1
    ctx.stroke()
  }
  ctx.restore()

  // Mini loss chart (160×80 at 510, 340)
  const chartX = 510
  const chartY = 320
  const chartW = 160
  const chartH = 80

  ctx.save()
  ctx.fillStyle = colors.surface
  ctx.fillRect(chartX, chartY, chartW, chartH)
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.strokeRect(chartX, chartY, chartW, chartH)

  // Loss label
  ctx.fillStyle = colors.muted
  ctx.font = '10px var(--font-jetbrains), monospace'
  ctx.textAlign = 'left'
  ctx.fillText('loss', chartX + 4, chartY + 12)

  // Draw loss history line
  const hist = state.lossHistory
  if (hist.length > 1) {
    const maxLoss = Math.max(...hist)
    const minLoss = Math.min(...hist)
    const lossRange = maxLoss - minLoss || 1

    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    for (let i = 0; i < hist.length; i++) {
      const hx = chartX + (i / (hist.length - 1)) * (chartW - 8) + 4
      const hn = (hist[i] - minLoss) / lossRange
      const hy = chartY + chartH - 8 - hn * (chartH - 16)
      if (i === 0) ctx.moveTo(hx, hy)
      else ctx.lineTo(hx, hy)
    }
    ctx.stroke()
  }
  ctx.restore()

  // Top labels
  ctx.save()
  ctx.font = '12px var(--font-jetbrains), monospace'

  // Top-left: Epoch
  ctx.fillStyle = colors.muted
  ctx.textAlign = 'left'
  ctx.fillText(`Epoch: ${state.epoch}`, MARGIN.left + 8, MARGIN.top + 16)

  // Top-right: MSE
  ctx.fillStyle = '#00e5ff'
  ctx.textAlign = 'right'
  ctx.fillText(`MSE: ${state.loss.toFixed(4)}`, W - MARGIN.right - 8, MARGIN.top + 16)

  // R² if converged
  if (state.converged) {
    const r2 = computeR2(state.points, state.m, state.b)
    ctx.fillStyle = '#10b981'
    ctx.textAlign = 'right'
    ctx.fillText(`R² = ${r2.toFixed(2)}`, W - MARGIN.right - 8, MARGIN.top + 34)
  }
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function LinearRegressionViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef<LRState>(initState())
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logCountRef = useRef(0)

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [currentInsight, setCurrentInsight] = useState<Insight | null>(null)

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
    stateRef.current = initState()
    setLogs([])
    setCurrentInsight(null)
    logCountRef.current = 0
  }, [])

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="viz-header-row">
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, color: 'var(--text)', margin: 0 }}>
            Linear Regression
          </h2>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#00e5ff',
          }}>O(n·e)</span>
          <span style={{
            padding: '2px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: 'var(--muted)',
          }}>Supervised</span>
        </div>
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: 'var(--muted)', margin: 0 }}>
          Gradient descent minimizes MSE loss to fit a line through noisy data
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
          />
          <InsightBox insight={currentInsight} defaultInsight={DEFAULT_INSIGHT} />
        </div>
      </div>

      <ExplainerPanel sections={EXPLAINERS['linear-regression']} />
    </div>
  )
}
