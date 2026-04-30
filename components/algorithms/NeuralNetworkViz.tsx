'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'forward' | 'backward' | 'done'

interface NNState {
  W1: number[][]  // [4][3] hidden weights
  b1: number[]    // [4] hidden biases
  W2: number[][]  // [2][4] output weights
  b2: number[]    // [2] output biases
  a0: number[]    // input activations [3]
  z1: number[]    // pre-activation hidden [4]
  a1: number[]    // post-ReLU hidden [4]
  z2: number[]    // pre-activation output [2]
  a2: number[]    // softmax output [2]
  loss: number
  dW1: number[][] // gradients
  dW2: number[][]
  db1: number[]
  db2: number[]
  phase: Phase
  animStep: number  // which animation step within the current phase
  animProgress: number  // 0→1 for current pulse animation
  epoch: number
  totalLoss: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_POS: [number, number][][] = [
  [[110, 115], [110, 230], [110, 345]],           // input
  [[330, 90], [330, 200], [330, 310], [330, 420]], // hidden
  [[570, 160], [570, 310]],                        // output
]
const NODE_R = 24

const DEFAULT_INSIGHT: Insight = {
  title: 'Neural Network',
  body: 'Backprop is just the chain rule from calculus, applied layer by layer. Each weight gets a gradient — how much it contributed to the error. We nudge every weight slightly to reduce that contribution. The forward pass computes predictions; the backward pass fixes the weights.',
}

// ─── Math Helpers ─────────────────────────────────────────────────────────────

function relu(x: number): number { return Math.max(0, x) }
function reluGrad(x: number): number { return x > 0 ? 1 : 0 }

function softmax(z: number[]): number[] {
  const max = Math.max(...z)
  const exps = z.map(x => Math.exp(x - max))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map(e => e / sum)
}

function crossEntropy(pred: number[], label: number[]): number {
  return -label.reduce((acc, y, i) => acc + y * Math.log(Math.max(pred[i], 1e-10)), 0)
}

function matVec(W: number[][], x: number[]): number[] {
  return W.map(row => row.reduce((acc, w, i) => acc + w * x[i], 0))
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function initState(): NNState {
  const W1 = Array.from({ length: 4 }, () =>
    Array.from({ length: 3 }, () => (Math.random() - 0.5) * 1.5)
  )
  const b1 = Array(4).fill(0).map(() => (Math.random() - 0.5) * 0.3)
  const W2 = Array.from({ length: 2 }, () =>
    Array.from({ length: 4 }, () => (Math.random() - 0.5) * 1.2)
  )
  const b2 = Array(2).fill(0).map(() => (Math.random() - 0.5) * 0.3)
  return {
    W1, b1, W2, b2,
    a0: [0.5, 0.8, 0.3],
    z1: Array(4).fill(0), a1: Array(4).fill(0),
    z2: Array(2).fill(0), a2: [0.5, 0.5],
    loss: 0,
    dW1: Array.from({ length: 4 }, () => Array(3).fill(0)),
    dW2: Array.from({ length: 2 }, () => Array(4).fill(0)),
    db1: Array(4).fill(0), db2: Array(2).fill(0),
    phase: 'idle', animStep: 0, animProgress: 0,
    epoch: 0, totalLoss: 0,
  }
}

// ─── Forward Pass ─────────────────────────────────────────────────────────────

function forwardPass(state: NNState): NNState {
  const z1 = matVec(state.W1, state.a0).map((z, i) => z + state.b1[i])
  const a1 = z1.map(relu)
  const z2 = matVec(state.W2, a1).map((z, i) => z + state.b2[i])
  const a2 = softmax(z2)
  const loss = crossEntropy(a2, [1, 0])
  return { ...state, z1, a1, z2, a2, loss }
}

// ─── Backprop ─────────────────────────────────────────────────────────────────

function backprop(state: NNState): NNState {
  const label = [1, 0]
  const dz2 = state.a2.map((a, i) => a - label[i])
  const dW2 = dz2.map(d => state.a1.map(a => d * a))
  const db2 = [...dz2]
  const da1 = state.a1.map((_, j) =>
    dz2.reduce((acc, d, i) => acc + d * state.W2[i][j], 0)
  )
  const dz1 = da1.map((d, j) => d * reluGrad(state.z1[j]))
  const dW1 = dz1.map(d => state.a0.map(a => d * a))
  const db1 = [...dz1]
  const lr = 0.05
  const newW1 = state.W1.map((row, i) => row.map((w, j) => w - lr * dW1[i][j]))
  const newb1 = state.b1.map((b, i) => b - lr * db1[i])
  const newW2 = state.W2.map((row, i) => row.map((w, j) => w - lr * dW2[i][j]))
  const newb2 = state.b2.map((b, i) => b - lr * db2[i])
  return { ...state, dW1, dW2, db1, db2, W1: newW1, b1: newb1, W2: newW2, b2: newb2 }
}

// ─── Step Algorithm ───────────────────────────────────────────────────────────

interface StepResult {
  state: NNState
  log?: { message: string; type: LogEntry['type'] }
  insight?: Insight | null
  done: boolean
}

function stepAlgorithm(state: NNState): StepResult {
  let s: NNState = {
    ...state,
    W1: state.W1.map(r => [...r]),
    b1: [...state.b1],
    W2: state.W2.map(r => [...r]),
    b2: [...state.b2],
    a1: [...state.a1],
    a2: [...state.a2],
    z1: [...state.z1],
    z2: [...state.z2],
    dW1: state.dW1.map(r => [...r]),
    dW2: state.dW2.map(r => [...r]),
    db1: [...state.db1],
    db2: [...state.db2],
  }

  if (s.phase === 'idle') {
    s = forwardPass(s)
    s.phase = 'forward'
    s.animStep = 0
    s.animProgress = 0
    return {
      state: s,
      log: { message: `Forward pass — Input: [${s.a0.map(v => v.toFixed(2)).join(', ')}]`, type: 'info' },
      done: false,
    }
  }

  if (s.phase === 'forward') {
    s.animStep++
    s.animProgress = 0
    if (s.animStep === 2) {
      return {
        state: s,
        log: { message: `Hidden activations: [${s.a1.map(v => v.toFixed(3)).join(', ')}] (ReLU)`, type: 'info' },
        done: false,
      }
    }
    if (s.animStep === 4) {
      return {
        state: s,
        log: {
          message: `Output: [${s.a2.map(v => v.toFixed(3)).join(', ')}] → Predicted: Class ${s.a2[0] > s.a2[1] ? 'A' : 'B'} (${Math.max(...s.a2).toFixed(2)})`,
          type: 'key',
        },
        done: false,
      }
    }
    if (s.animStep === 5) {
      return {
        state: s,
        log: { message: `Loss: ${s.loss.toFixed(4)} (cross-entropy)`, type: s.loss > 0.5 ? 'warning' : 'info' },
        done: false,
      }
    }
    if (s.animStep > 5) {
      s = backprop(s)
      s.phase = 'backward'
      s.animStep = 0
      s.animProgress = 0
      s.epoch++
      return {
        state: s,
        log: { message: `Backprop — computing gradients for 26 weights`, type: 'info' },
        done: false,
      }
    }
    return { state: s, done: false }
  }

  if (s.phase === 'backward') {
    s.animStep++
    s.animProgress = 0
    if (s.animStep === 3) {
      return {
        state: s,
        log: { message: `Weights updated — epoch ${s.epoch} complete`, type: 'success' },
        done: false,
      }
    }
    if (s.animStep > 3) {
      s = forwardPass(s)
      s.phase = 'forward'
      s.animStep = 0
      s.animProgress = 0
      return {
        state: s,
        log: { message: `Forward pass — epoch ${s.epoch + 1}`, type: 'info' },
        done: false,
      }
    }
    return { state: s, done: false }
  }

  return { state: s, done: false }
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: NNState,
  _w: number,
  _h: number
): void {
  const W = 700
  const H = 460

  // Background
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, W, H)

  const { phase, animStep, animProgress, a0, a1, a2, dz2: _dz2, db1, W1, W2 } = state as NNState & { dz2?: number[] }
  void _dz2
  void db1

  // ── 1. Edges ────────────────────────────────────────────────────────────────
  // W1 edges (input → hidden)
  for (let h = 0; h < 4; h++) {
    for (let inp = 0; inp < 3; inp++) {
      const [x1, y1] = NODE_POS[0][inp]
      const [x2, y2] = NODE_POS[1][h]
      const w = W1[h][inp]
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = w >= 0 ? 'rgba(0,229,255,0.25)' : 'rgba(124,58,237,0.25)'
      ctx.lineWidth = Math.min(Math.max(Math.abs(w) * 2.5, 0.5), 4)
      ctx.stroke()
    }
  }
  // W2 edges (hidden → output)
  for (let o = 0; o < 2; o++) {
    for (let h = 0; h < 4; h++) {
      const [x1, y1] = NODE_POS[1][h]
      const [x2, y2] = NODE_POS[2][o]
      const w = W2[o][h]
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.strokeStyle = w >= 0 ? 'rgba(0,229,255,0.25)' : 'rgba(124,58,237,0.25)'
      ctx.lineWidth = Math.min(Math.max(Math.abs(w) * 2.5, 0.5), 4)
      ctx.stroke()
    }
  }

  // ── Phase-specific pulse animations ─────────────────────────────────────────
  if (phase === 'forward' && animStep === 1) {
    // Forward pulse along W1 edges
    for (let h = 0; h < 4; h++) {
      for (let inp = 0; inp < 3; inp++) {
        const [x1, y1] = NODE_POS[0][inp]
        const [x2, y2] = NODE_POS[1][h]
        const px = x1 + (x2 - x1) * animProgress
        const py = y1 + (y2 - y1) * animProgress
        ctx.save()
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#00e5ff'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#00e5ff'
        ctx.fill()
        ctx.restore()
      }
    }
  }

  if (phase === 'forward' && animStep === 3) {
    // Forward pulse along W2 edges
    for (let o = 0; o < 2; o++) {
      for (let h = 0; h < 4; h++) {
        const [x1, y1] = NODE_POS[1][h]
        const [x2, y2] = NODE_POS[2][o]
        const px = x1 + (x2 - x1) * animProgress
        const py = y1 + (y2 - y1) * animProgress
        ctx.save()
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#00e5ff'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#00e5ff'
        ctx.fill()
        ctx.restore()
      }
    }
  }

  if (phase === 'backward' && animStep === 1) {
    // Backward pulse along W2 edges (right-to-left)
    for (let o = 0; o < 2; o++) {
      for (let h = 0; h < 4; h++) {
        const [x2, y2] = NODE_POS[2][o]
        const [x1, y1] = NODE_POS[1][h]
        const px = x2 + (x1 - x2) * animProgress
        const py = y2 + (y1 - y2) * animProgress
        ctx.save()
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#f59e0b'
        ctx.fill()
        ctx.restore()
      }
    }
  }

  if (phase === 'backward' && animStep === 3) {
    // Backward pulse along W1 edges (right-to-left)
    for (let h = 0; h < 4; h++) {
      for (let inp = 0; inp < 3; inp++) {
        const [x2, y2] = NODE_POS[1][h]
        const [x1, y1] = NODE_POS[0][inp]
        const px = x2 + (x1 - x2) * animProgress
        const py = y2 + (y1 - y2) * animProgress
        ctx.save()
        ctx.beginPath()
        ctx.arc(px, py, 5, 0, Math.PI * 2)
        ctx.fillStyle = '#f59e0b'
        ctx.shadowBlur = 10
        ctx.shadowColor = '#f59e0b'
        ctx.fill()
        ctx.restore()
      }
    }
  }

  // ── 2. Nodes ─────────────────────────────────────────────────────────────────
  const NODE_CONFIGS = [
    { layer: 0, count: 3, stroke: 'rgba(0,229,255,0.4)', labels: ['x₁', 'x₂', 'x₃'] },
    { layer: 1, count: 4, stroke: 'rgba(0,229,255,0.3)', labels: ['h₁', 'h₂', 'h₃', 'h₄'] },
    { layer: 2, count: 2, stroke: 'rgba(124,58,237,0.4)', labels: ['y₁', 'y₂'] },
  ]

  for (const config of NODE_CONFIGS) {
    for (let n = 0; n < config.count; n++) {
      const [cx, cy] = NODE_POS[config.layer][n]

      // Glow effects
      ctx.save()
      // Input glow on forward step 0
      if (config.layer === 0 && phase === 'forward' && animStep === 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(0,229,255,0.15)'
        ctx.shadowBlur = 15
        ctx.shadowColor = '#00e5ff'
        ctx.fill()
      }
      // Hidden glow on forward step 2
      if (config.layer === 1 && phase === 'forward' && animStep === 2) {
        // Dead ReLU tint
        if (a1[n] === 0) {
          ctx.beginPath()
          ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(239,68,68,0.2)'
          ctx.fill()
        } else {
          ctx.beginPath()
          ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(0,229,255,0.15)'
          ctx.shadowBlur = 15
          ctx.shadowColor = '#00e5ff'
          ctx.fill()
        }
      }
      // Output glow on forward step 4
      if (config.layer === 2 && phase === 'forward' && animStep === 4) {
        ctx.beginPath()
        ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(124,58,237,0.2)'
        ctx.shadowBlur = 15
        ctx.shadowColor = '#7c3aed'
        ctx.fill()
      }
      // Output amber glow on backward step 0
      if (config.layer === 2 && phase === 'backward' && animStep === 0) {
        ctx.beginPath()
        ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(245,158,11,0.3)'
        ctx.shadowBlur = 15
        ctx.shadowColor = '#f59e0b'
        ctx.fill()
      }
      // Hidden amber glow on backward step 2
      if (config.layer === 1 && phase === 'backward' && animStep === 2) {
        ctx.beginPath()
        ctx.arc(cx, cy, NODE_R + 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(245,158,11,0.2)'
        ctx.shadowBlur = 12
        ctx.shadowColor = '#f59e0b'
        ctx.fill()
      }
      ctx.restore()

      // Node fill
      ctx.save()
      ctx.beginPath()
      ctx.arc(cx, cy, NODE_R, 0, Math.PI * 2)
      ctx.fillStyle = '#111118'
      ctx.fill()
      ctx.strokeStyle = config.stroke
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.restore()

      // Node label
      ctx.save()
      ctx.font = '11px var(--font-jetbrains), monospace'
      ctx.fillStyle = '#64748b'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(config.labels[n], cx, cy)
      ctx.restore()
    }
  }

  // ── 3. Activation values ──────────────────────────────────────────────────
  if (phase !== 'idle') {
    // a0 values (right of input nodes)
    ctx.save()
    ctx.font = '11px var(--font-jetbrains), monospace'
    ctx.fillStyle = '#e2e8f0'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 3; i++) {
      const [cx, cy] = NODE_POS[0][i]
      ctx.fillText(a0[i].toFixed(2), cx - NODE_R - 38, cy)
    }
    ctx.restore()
  }

  // a1 values (right of hidden nodes, shown from step 2+ in forward)
  if ((phase === 'forward' && animStep >= 2) || phase === 'backward') {
    ctx.save()
    ctx.font = '10px var(--font-jetbrains), monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = NODE_POS[1][i]
      const val = a1[i]
      ctx.fillStyle = val > 0 ? '#00e5ff' : '#ef4444'
      ctx.fillText(val.toFixed(3), cx + NODE_R + 6, cy - 7)
      ctx.fillStyle = '#64748b'
      ctx.fillText(val > 0 ? 'ReLU' : '0', cx + NODE_R + 6, cy + 7)
    }
    ctx.restore()
  }

  // a2 values (right of output nodes, shown from step 4+ in forward)
  if ((phase === 'forward' && animStep >= 4) || phase === 'backward') {
    ctx.save()
    ctx.font = '11px var(--font-jetbrains), monospace'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 2; i++) {
      const [cx, cy] = NODE_POS[2][i]
      ctx.fillStyle = '#7c3aed'
      ctx.fillText(a2[i].toFixed(3), cx + NODE_R + 6, cy - 7)
      ctx.fillStyle = '#64748b'
      ctx.fillText(`→ Class ${i === 0 ? 'A' : 'B'}`, cx + NODE_R + 6, cy + 7)
    }
    ctx.restore()
  }

  // Gradient values next to output on backward step 0
  if (phase === 'backward' && animStep >= 0) {
    const dz2 = state.a2.map((a, i) => a - [1, 0][i])
    ctx.save()
    ctx.font = '10px var(--font-jetbrains), monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 2; i++) {
      const [cx, cy] = NODE_POS[2][i]
      ctx.fillStyle = '#f59e0b'
      ctx.fillText(`∂L=${dz2[i].toFixed(3)}`, cx - NODE_R - 6, cy)
    }
    ctx.restore()
  }

  // Hidden gradient values on backward step 2
  if (phase === 'backward' && animStep >= 2) {
    ctx.save()
    ctx.font = '10px var(--font-jetbrains), monospace'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = NODE_POS[1][i]
      ctx.fillStyle = '#f59e0b'
      ctx.fillText(`δ=${state.db1[i].toFixed(3)}`, cx - NODE_R - 6, cy)
    }
    ctx.restore()
  }

  // ── 4. Loss display ────────────────────────────────────────────────────────
  if (phase === 'forward' && animStep === 5) {
    const loss = state.loss
    let lossColor = '#ef4444'
    if (loss < 0.3) lossColor = '#10b981'
    else if (loss < 0.5) lossColor = '#f59e0b'
    ctx.save()
    ctx.font = 'bold 14px var(--font-jetbrains), monospace'
    ctx.fillStyle = lossColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.shadowBlur = 10
    ctx.shadowColor = lossColor
    ctx.fillText(`Loss: ${loss.toFixed(3)}`, W / 2, 16)
    ctx.restore()
  }

  // ── 5. Idle info ───────────────────────────────────────────────────────────
  if (phase === 'idle') {
    ctx.save()
    ctx.font = '11px var(--font-jetbrains), monospace'
    ctx.fillStyle = '#64748b'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText('Input: [0.50, 0.80, 0.30]', 12, 12)
    ctx.restore()
  }

  // ── 6. Epoch counter (top-right) ───────────────────────────────────────────
  ctx.save()
  ctx.font = '12px var(--font-jetbrains), monospace'
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'top'
  ctx.fillText(`Epoch: ${state.epoch}`, W - 16, 12)
  ctx.restore()

  // ── 7. Prediction (bottom-right) ──────────────────────────────────────────
  if (phase !== 'idle') {
    const predClass = a2[0] > a2[1] ? 'A' : 'B'
    const predConf = Math.max(a2[0], a2[1])
    const predColor = predClass === 'A' ? '#7c3aed' : '#00e5ff'
    ctx.save()
    ctx.font = '11px var(--font-jetbrains), monospace'
    ctx.fillStyle = predColor
    ctx.textAlign = 'right'
    ctx.textBaseline = 'bottom'
    ctx.fillText(`Pred: Class ${predClass} (${predConf.toFixed(2)})`, W - 16, H - 12)
    ctx.restore()
  }

  // ── 8. Layer labels ────────────────────────────────────────────────────────
  ctx.save()
  ctx.font = '10px var(--font-jetbrains), monospace'
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'bottom'
  const LAYER_X = [110, 330, 570]
  const LAYER_LABELS = ['Input (3)', 'Hidden (4)', 'Output (2)']
  for (let i = 0; i < 3; i++) {
    ctx.fillText(LAYER_LABELS[i], LAYER_X[i], H - 12)
  }
  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function NeuralNetworkViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef<NNState>(initState())
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

  // rAF loop — advance animProgress each frame
  useEffect(() => {
    const loop = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (ctx && canvas) {
        stateRef.current.animProgress = Math.min(
          1,
          stateRef.current.animProgress + 0.025
        )
        drawCanvas(ctx, stateRef.current, canvas.width, canvas.height)
      }
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

  // Auto-play timer — waits for animProgress to reach 1, then steps
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isPlaying) return
    const delays: Record<Speed, number> = { slow: 1200, normal: 600, fast: 150 }
    timerRef.current = setInterval(() => {
      if (stateRef.current.animProgress >= 1) {
        stepForward()
      }
    }, delays[speed])
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
    <div style={{ background: '#0a0a0f', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, color: '#e2e8f0', margin: 0 }}>
            Neural Network — Forward Pass + Backprop
          </h2>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#00e5ff',
          }}>O(l·n·e)</span>
          <span style={{
            padding: '2px 8px',
            background: '#111118',
            border: '1px solid #1e1e2e',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#64748b',
          }}>Deep Learning</span>
        </div>
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: '#64748b', margin: 0 }}>
          3→4→2 network trained with gradient descent
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
          height={460}
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
          Data flows forward through layers (forward pass): each neuron computes a weighted sum of its
          inputs, adds a bias, then applies a non-linear activation (ReLU). At the output, we compute
          how wrong the prediction was (cross-entropy loss). Backpropagation uses the chain rule to
          compute how much each weight contributed to the error, then nudges every weight in the
          direction that reduces it. After many iterations, the network learns to associate inputs with
          correct outputs.
        </p>
      </details>
    </div>
  )
}
