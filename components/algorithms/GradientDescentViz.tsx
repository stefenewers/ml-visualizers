'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'
import ExplainerPanel from '../ExplainerPanel'
import { EXPLAINERS } from '@/lib/explainers'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ball {
  x: number
  y: number
  loss: number
  vx: number
  vy: number
  trail: Array<{ x: number; y: number; loss: number }>
  color: string
  label: string
  stuck: boolean
  stuckCount: number
}

interface GDState {
  ballGD: Ball
  ballMom: Ball
  step: number
  lr: number
  done: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 700
const CANVAS_H = 460
const PLOT_L = 50
const PLOT_T = 40
const PLOT_W = 600
const PLOT_H = 370

const DEFAULT_INSIGHT: Insight = {
  title: 'Gradient Descent',
  body: "This is the engine underneath nearly every ML model. Neural nets, linear regression, SVMs — they all use some form of gradient descent to find parameters. The gradient points uphill, so we move the opposite direction. Momentum accumulates velocity, helping escape local minima.",
}

// ─── Coordinate Helpers ───────────────────────────────────────────────────────

function nx(x: number): number { return PLOT_L + ((x + 2) / 4) * PLOT_W }
function ny(y: number): number { return PLOT_T + ((2 - y) / 4) * PLOT_H }

// ─── Loss Function ────────────────────────────────────────────────────────────

function computeLoss(x: number, y: number): number {
  return Math.sin(2.5 * x) * Math.cos(2.5 * y) + 0.4 * (x * x + y * y) - 0.3
}

function computeGradient(x: number, y: number): { gx: number; gy: number } {
  const gx = 2.5 * Math.cos(2.5 * x) * Math.cos(2.5 * y) + 0.8 * x
  const gy = -2.5 * Math.sin(2.5 * x) * Math.sin(2.5 * y) + 0.8 * y
  return { gx, gy }
}

// ─── Heatmap ──────────────────────────────────────────────────────────────────

function buildHeatmap(ctx: CanvasRenderingContext2D): ImageData {
  const W = PLOT_W
  const H = PLOT_H
  const img = ctx.createImageData(W, H)

  // First pass: compute all losses
  const losses: number[] = []
  for (let py = 0; py < H; py++) {
    for (let px = 0; px < W; px++) {
      const x = (px / W) * 4 - 2
      const y = 2 - (py / H) * 4
      losses.push(computeLoss(x, y))
    }
  }
  const minL = Math.min(...losses)
  const maxL = Math.max(...losses)
  const range = maxL - minL

  // Second pass: map to colors
  for (let i = 0; i < losses.length; i++) {
    const t = (losses[i] - minL) / range
    let r: number, g: number, b: number
    if (t < 0.25) {
      const tt = t / 0.25
      r = 0
      g = Math.floor(tt * 50)
      b = Math.floor(100 + tt * 155)
    } else if (t < 0.5) {
      const tt = (t - 0.25) / 0.25
      r = 0
      g = Math.floor(50 + tt * 180)
      b = 255
    } else if (t < 0.75) {
      const tt = (t - 0.5) / 0.25
      r = Math.floor(tt * 200)
      g = Math.floor(230 - tt * 30)
      b = Math.floor(255 - tt * 255)
    } else {
      const tt = (t - 0.75) / 0.25
      r = Math.floor(200 + tt * 55)
      g = Math.floor(200 - tt * 200)
      b = 0
    }
    img.data[i * 4]     = Math.floor(r * 0.75)
    img.data[i * 4 + 1] = Math.floor(g * 0.75)
    img.data[i * 4 + 2] = Math.floor(b * 0.75)
    img.data[i * 4 + 3] = 255
  }
  return img
}

// ─── Init State ───────────────────────────────────────────────────────────────

function initState(lr: number): GDState {
  const startX = 1.4 + (Math.random() - 0.5) * 0.4
  const startY = 1.4 + (Math.random() - 0.5) * 0.4
  const initLoss = computeLoss(startX, startY)
  return {
    ballGD: {
      x: startX, y: startY, loss: initLoss,
      vx: 0, vy: 0, trail: [],
      color: '#00e5ff', label: 'GD',
      stuck: false, stuckCount: 0,
    },
    ballMom: {
      x: startX, y: startY, loss: initLoss,
      vx: 0, vy: 0, trail: [],
      color: '#7c3aed', label: 'Momentum',
      stuck: false, stuckCount: 0,
    },
    step: 0,
    lr,
    done: false,
  }
}

// ─── Step Functions ───────────────────────────────────────────────────────────

function stepBallGD(ball: Ball, lr: number): Ball {
  const { gx, gy } = computeGradient(ball.x, ball.y)
  const newX = ball.x - lr * gx
  const newY = ball.y - lr * gy
  const cX = Math.max(-1.95, Math.min(1.95, newX))
  const cY = Math.max(-1.95, Math.min(1.95, newY))
  const newLoss = computeLoss(cX, cY)
  const newTrail = [...ball.trail.slice(-59), { x: ball.x, y: ball.y, loss: ball.loss }]
  const stuckCount = Math.abs(newLoss - ball.loss) < 0.0005 ? ball.stuckCount + 1 : 0
  return { ...ball, x: cX, y: cY, loss: newLoss, trail: newTrail, stuck: stuckCount > 5, stuckCount }
}

function stepBallMomentum(ball: Ball, lr: number): Ball {
  const momentum = 0.85
  const { gx, gy } = computeGradient(ball.x, ball.y)
  const nvx = momentum * ball.vx - lr * gx
  const nvy = momentum * ball.vy - lr * gy
  const newX = ball.x + nvx
  const newY = ball.y + nvy
  const cX = Math.max(-1.95, Math.min(1.95, newX))
  const cY = Math.max(-1.95, Math.min(1.95, newY))
  const newLoss = computeLoss(cX, cY)
  const newTrail = [...ball.trail.slice(-59), { x: ball.x, y: ball.y, loss: ball.loss }]
  const stuckCount = Math.abs(newLoss - ball.loss) < 0.0005 ? ball.stuckCount + 1 : 0
  return { ...ball, x: cX, y: cY, vx: nvx, vy: nvy, loss: newLoss, trail: newTrail, stuck: stuckCount > 5, stuckCount }
}

interface StepResult {
  state: GDState
  log?: { message: string; type: LogEntry['type'] }
  extraLogs?: Array<{ message: string; type: LogEntry['type'] }>
  insight?: Insight | null
  done: boolean
}

function stepAlgorithm(state: GDState): StepResult {
  const newGD = stepBallGD(state.ballGD, state.lr)
  const newMom = stepBallMomentum(state.ballMom, state.lr)
  const newStep = state.step + 1

  const log = {
    message: `Step ${newStep} — GD: ${newGD.loss.toFixed(3)}, Momentum: ${newMom.loss.toFixed(3)} | Δ: ${(newGD.loss - state.ballGD.loss).toFixed(4)}`,
    type: 'info' as const,
  }

  const extraLogs: Array<{ message: string; type: LogEntry['type'] }> = []

  // GD just got stuck
  if (newGD.stuck && !state.ballGD.stuck) {
    extraLogs.push({
      message: `GD stuck in local minimum at (${newGD.x.toFixed(2)}, ${newGD.y.toFixed(2)})`,
      type: 'key',
    })
  }

  // Momentum escaped after being stuck
  if (state.ballMom.stuck && !newMom.stuck && newMom.loss < state.ballMom.loss - 0.01) {
    extraLogs.push({
      message: `Momentum escaped! Loss: ${state.ballMom.loss.toFixed(3)} → ${newMom.loss.toFixed(3)}`,
      type: 'key',
    })
  }

  let insight: Insight | null = null
  if (newGD.stuck && !state.ballGD.stuck) {
    insight = {
      title: 'Local Minimum',
      body: 'The GD ball is stuck in a local minimum — not the global best! Momentum can escape these traps by carrying velocity through shallow valleys.',
    }
  }

  const done = newStep >= 120

  if (done) {
    extraLogs.push({
      message: `Optimization complete — 120 steps`,
      type: 'success',
    })
  }

  return {
    state: { ...state, ballGD: newGD, ballMom: newMom, step: newStep, done },
    log,
    extraLogs,
    insight,
    done,
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
  state: GDState,
  heatmap: ImageData | null,
): void {
  const colors = getCanvasColors()
  // Background
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H)

  // Draw heatmap
  if (heatmap) {
    ctx.putImageData(heatmap, PLOT_L, PLOT_T)
  }

  // Contour lines — scan columns for sign changes
  const contourLevels = [-0.8, -0.4, 0, 0.4, 0.8, 1.2]
  ctx.strokeStyle = 'rgba(226,232,240,0.2)'
  ctx.lineWidth = 0.8
  for (const level of contourLevels) {
    ctx.beginPath()
    let penDown = false
    for (let px = PLOT_L; px < PLOT_L + PLOT_W; px++) {
      const x = (px - PLOT_L) / PLOT_W * 4 - 2
      for (let py = PLOT_T; py < PLOT_T + PLOT_H; py++) {
        const y = 2 - (py - PLOT_T) / PLOT_H * 4
        const loss = computeLoss(x, y)
        const prevY = 2 - (py - 1 - PLOT_T) / PLOT_H * 4
        const prevLoss = computeLoss(x, prevY)
        if ((loss - level) * (prevLoss - level) < 0) {
          if (!penDown) { ctx.moveTo(px, py); penDown = true }
          else { ctx.lineTo(px, py) }
        }
      }
      penDown = false
    }
    ctx.stroke()
  }

  // Trails
  for (const ball of [state.ballGD, state.ballMom]) {
    ball.trail.forEach((pos, i) => {
      const alpha = (i / ball.trail.length) * 0.4
      const alphaHex = Math.floor(alpha * 255).toString(16).padStart(2, '0')
      ctx.fillStyle = ball.color + alphaHex
      ctx.beginPath()
      ctx.arc(nx(pos.x), ny(pos.y), 3, 0, Math.PI * 2)
      ctx.fill()
    })
  }

  // Gradient arrow for GD ball
  const { gx, gy } = computeGradient(state.ballGD.x, state.ballGD.y)
  const mag = Math.sqrt(gx * gx + gy * gy)
  if (mag > 0.01) {
    const scale = 25 / mag
    const bx = nx(state.ballGD.x)
    const by = ny(state.ballGD.y)
    const ex = bx + gx * scale
    const ey = by - gy * scale
    ctx.strokeStyle = 'rgba(239,68,68,0.7)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    const angle = Math.atan2(ey - by, ex - bx)
    ctx.lineTo(ex - 6 * Math.cos(angle - 0.4), ey - 6 * Math.sin(angle - 0.4))
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex - 6 * Math.cos(angle + 0.4), ey - 6 * Math.sin(angle + 0.4))
    ctx.stroke()
  }

  // Balls — momentum behind GD
  for (const ball of [state.ballMom, state.ballGD]) {
    const bx = nx(ball.x)
    const by = ny(ball.y)

    // Stuck indicator: pulsing ring
    if (ball.stuck) {
      ctx.strokeStyle = '#f59e0b'
      ctx.lineWidth = 1.5
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.arc(bx, by, 14, 0, Math.PI * 2)
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    ctx.shadowBlur = 15
    ctx.shadowColor = ball.color
    ctx.fillStyle = ball.color
    ctx.beginPath()
    ctx.arc(bx, by, 8, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0

    // White center dot
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.arc(bx, by, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  // Legend (top-right corner inside plot)
  const lx = PLOT_L + PLOT_W - 85
  const ly = PLOT_T + 8
  ctx.fillStyle = 'rgba(17,17,24,0.88)'
  ctx.fillRect(lx - 6, ly - 6, 90, 56)
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.strokeRect(lx - 6, ly - 6, 90, 56)
  ctx.font = '10px var(--font-jetbrains), monospace'
  ctx.fillStyle = '#00e5ff'
  ctx.fillText('● Standard GD', lx, ly + 10)
  ctx.fillStyle = '#7c3aed'
  ctx.fillText('● Momentum', lx, ly + 26)
  ctx.fillStyle = colors.muted
  ctx.fillText(`lr = ${state.lr.toFixed(2)}`, lx, ly + 42)

  // Step counter and losses (top bar)
  ctx.font = '12px var(--font-jetbrains), monospace'
  ctx.fillStyle = colors.muted
  ctx.fillText(`Step: ${state.step}`, PLOT_L + 4, PLOT_T - 12)
  ctx.fillStyle = '#00e5ff'
  ctx.fillText(`GD: ${state.ballGD.loss.toFixed(3)}`, 280, PLOT_T - 12)
  ctx.fillStyle = '#7c3aed'
  ctx.fillText(`Mom: ${state.ballMom.loss.toFixed(3)}`, 420, PLOT_T - 12)

  // Done label
  if (state.done) {
    ctx.font = '11px var(--font-jetbrains), monospace'
    ctx.fillStyle = '#10b981'
    ctx.fillText('✓ Complete', PLOT_L + PLOT_W - 100, PLOT_T - 12)
  }

  // Plot border
  ctx.strokeStyle = colors.border
  ctx.lineWidth = 1
  ctx.strokeRect(PLOT_L, PLOT_T, PLOT_W, PLOT_H)
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradientDescentViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef<GDState>(initState(0.05))
  const heatmapRef = useRef<ImageData | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const logCountRef = useRef(0)

  const [logs, setLogs] = useState<LogEntry[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [speed, setSpeed] = useState<Speed>('normal')
  const [currentInsight, setCurrentInsight] = useState<Insight | null>(null)
  const [lrValue, setLrValue] = useState(0.05)

  // Build heatmap once after mount
  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return
    heatmapRef.current = buildHeatmap(ctx)
  }, [])

  // Render loop
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && canvas) {
        drawCanvas(ctx, stateRef.current, heatmapRef.current)
      }
      rafRef.current = requestAnimationFrame(loop)
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    logCountRef.current++
    const entry: LogEntry = {
      id: Date.now() + Math.random(),
      step: logCountRef.current,
      message,
      type,
    }
    setLogs(prev => [...prev.slice(-80), entry])
  }, [])

  const stepForward = useCallback(() => {
    const result = stepAlgorithm(stateRef.current)
    stateRef.current = result.state
    if (result.log) addLog(result.log.message, result.log.type)
    if (result.extraLogs) {
      for (const el of result.extraLogs) addLog(el.message, el.type)
    }
    if (result.insight !== undefined) setCurrentInsight(result.insight)
    if (result.done) setIsPlaying(false)
  }, [addLog])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isPlaying) return
    const delays: Record<Speed, number> = { slow: 1600, normal: 500, fast: 80 }
    timerRef.current = setInterval(stepForward, delays[speed])
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isPlaying, speed, stepForward])

  const handleReset = useCallback(() => {
    setIsPlaying(false)
    if (timerRef.current) clearInterval(timerRef.current)
    stateRef.current = initState(lrValue)
    setLogs([])
    setCurrentInsight(null)
    logCountRef.current = 0
  }, [lrValue])

  const handleLrChange = useCallback((newLr: number) => {
    setLrValue(newLr)
    setIsPlaying(false)
    if (timerRef.current) clearInterval(timerRef.current)
    stateRef.current = initState(newLr)
    setLogs([])
    setCurrentInsight(null)
    logCountRef.current = 0
  }, [])

  const lrSelector = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <span style={{
        fontFamily: 'var(--font-jetbrains), monospace',
        fontSize: 11,
        color: 'var(--muted)',
        minWidth: 56,
      }}>
        lr = {lrValue.toFixed(2)}
      </span>
      <input
        type="range"
        min={0.01}
        max={0.15}
        step={0.01}
        value={lrValue}
        onChange={e => handleLrChange(Number(e.target.value))}
        style={{ flex: 1, accentColor: '#00e5ff', cursor: 'pointer' }}
      />
    </div>
  )

  return (
    <div style={{ background: 'var(--bg)', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div className="viz-header-row">
          <h2 style={{
            fontFamily: 'var(--font-syne)',
            fontSize: 22,
            color: 'var(--text)',
            margin: 0,
          }}>
            Gradient Descent — Loss Surface
          </h2>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#00e5ff',
          }}>O(s)</span>
          <span style={{
            padding: '2px 8px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: 'var(--muted)',
          }}>Optimization</span>
        </div>
        <p style={{
          fontFamily: 'var(--font-jetbrains), monospace',
          fontSize: 12,
          color: 'var(--muted)',
          margin: 0,
        }}>
          A ball rolls downhill on a 2D loss landscape
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
          width={CANVAS_W}
          height={CANVAS_H}
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
            extra={lrSelector}
          />
          <InsightBox insight={currentInsight} defaultInsight={DEFAULT_INSIGHT} />
        </div>
      </div>

      <ExplainerPanel sections={EXPLAINERS['gradient-descent']} />
    </div>
  )
}
