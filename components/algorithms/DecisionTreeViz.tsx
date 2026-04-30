'use client'
import { useRef, useEffect, useState, useCallback } from 'react'
import Controls from '../Controls'
import TerminalLog from '../TerminalLog'
import InsightBox from '../InsightBox'
import type { LogEntry, Speed, Insight } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

interface DTPoint { xn: number; yn: number; cls: 0 | 1 }
interface Region {
  x0: number; y0: number; x1: number; y1: number
  points: number[]
  gini: number
  majority: 0 | 1
  depth: number
  id: number
}
interface Split {
  regionId: number
  axis: 'x' | 'y'
  threshold: number
  gini_before: number
  gini_after: number
  depth: number
  // Store the region bounds for drawing the split line
  rx0: number; ry0: number; rx1: number; ry1: number
}
interface TreeNode {
  split?: Split
  left?: TreeNode
  right?: TreeNode
  isLeaf?: boolean
  cls?: 0 | 1
  gini?: number
  n?: number
}
interface DTState {
  points: DTPoint[]
  regions: Region[]
  splits: Split[]
  tree: TreeNode | null
  depth: number
  done: boolean
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CANVAS_W = 700
const CANVAS_H = 460
const ML = 50   // margin left
const MT = 50   // margin top
const MR = 30   // margin right
const MB = 30   // margin bottom
const PLOT_W = CANVAS_W - ML - MR  // 620
const PLOT_H = CANVAS_H - MT - MB  // 380
const MAX_DEPTH = 4

const DEFAULT_INSIGHT: Insight = {
  title: 'Greedy Splitting',
  body: 'Decision trees ask greedy questions: at each step, pick the single best split available. This is why they can overfit — they keep splitting until every point is isolated. Depth limits and pruning are how we control that.',
}

// ─── Coordinate Helpers ───────────────────────────────────────────────────────

function px(xn: number): number { return ML + xn * PLOT_W }
function py(yn: number): number { return MT + (1 - yn) * PLOT_H }

// ─── Data Generation ──────────────────────────────────────────────────────────

function boxMuller(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1 === 0 ? 1e-10 : u1)) * Math.cos(2 * Math.PI * u2)
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

function generatePoints(): DTPoint[] {
  const pts: DTPoint[] = []
  // Class 0: center (0.28, 0.30), sigma=0.14
  for (let i = 0; i < 25; i++) {
    pts.push({
      xn: clamp(0.28 + boxMuller() * 0.14, 0.04, 0.96),
      yn: clamp(0.30 + boxMuller() * 0.14, 0.04, 0.96),
      cls: 0,
    })
  }
  // Class 1: center (0.72, 0.70), sigma=0.14
  for (let i = 0; i < 25; i++) {
    pts.push({
      xn: clamp(0.72 + boxMuller() * 0.14, 0.04, 0.96),
      yn: clamp(0.70 + boxMuller() * 0.14, 0.04, 0.96),
      cls: 1,
    })
  }
  return pts
}

// ─── Gini Impurity ────────────────────────────────────────────────────────────

function gini(classes: (0 | 1)[]): number {
  if (classes.length === 0) return 0
  const p1 = classes.filter(c => c === 1).length / classes.length
  const p0 = 1 - p1
  return 1 - p0 * p0 - p1 * p1
}

function weightedGini(left: (0 | 1)[], right: (0 | 1)[]): number {
  const n = left.length + right.length
  if (n === 0) return 0
  return (left.length / n) * gini(left) + (right.length / n) * gini(right)
}

function majorityClass(classes: (0 | 1)[]): 0 | 1 {
  const ones = classes.filter(c => c === 1).length
  return ones >= classes.length / 2 ? 1 : 0
}

// ─── Compute Gini for a set of point indices ──────────────────────────────────

function giniForIndices(indices: number[], points: DTPoint[]): number {
  return gini(indices.map(i => points[i].cls))
}

// ─── Best Split for a Region ──────────────────────────────────────────────────

function bestSplitForRegion(
  region: Region,
  points: DTPoint[]
): { axis: 'x' | 'y'; threshold: number; giniAfter: number } | null {
  const { points: indices } = region
  if (indices.length <= 3 || region.gini <= 0.08) return null

  let bestAxis: 'x' | 'y' = 'x'
  let bestThreshold = 0
  let bestGiniAfter = Infinity

  for (const axis of ['x', 'y'] as const) {
    // Gather the coordinates of points in this region
    const coords = indices.map(i => axis === 'x' ? points[i].xn : points[i].yn)
    const sorted = [...new Set(coords)].sort((a, b) => a - b)

    // Use up to 15 threshold candidates: midpoints between consecutive unique values
    const candidates: number[] = []
    for (let i = 0; i < sorted.length - 1 && candidates.length < 15; i++) {
      candidates.push((sorted[i] + sorted[i + 1]) / 2)
    }
    // If fewer than 15 unique values, also try the actual values as thresholds
    if (candidates.length < 15 && sorted.length > 0) {
      for (const v of sorted) {
        if (candidates.length >= 15) break
        if (!candidates.includes(v)) candidates.push(v)
      }
    }

    for (const threshold of candidates) {
      const leftIndices = indices.filter(i =>
        (axis === 'x' ? points[i].xn : points[i].yn) < threshold
      )
      const rightIndices = indices.filter(i =>
        (axis === 'x' ? points[i].xn : points[i].yn) >= threshold
      )
      if (leftIndices.length === 0 || rightIndices.length === 0) continue

      const leftCls = leftIndices.map(i => points[i].cls)
      const rightCls = rightIndices.map(i => points[i].cls)
      const g = weightedGini(leftCls, rightCls)

      if (g < bestGiniAfter) {
        bestGiniAfter = g
        bestAxis = axis
        bestThreshold = threshold
      }
    }
  }

  if (bestGiniAfter === Infinity) return null
  return { axis: bestAxis, threshold: bestThreshold, giniAfter: bestGiniAfter }
}

// ─── Init State ───────────────────────────────────────────────────────────────

function initState(): DTState {
  const points = generatePoints()
  const allIndices = points.map((_, i) => i)
  const classes = points.map(p => p.cls)
  const g = gini(classes)
  const maj = majorityClass(classes)

  const rootRegion: Region = {
    x0: 0, y0: 0, x1: 1, y1: 1,
    points: allIndices,
    gini: g,
    majority: maj,
    depth: 0,
    id: 0,
  }

  return {
    points,
    regions: [rootRegion],
    splits: [],
    tree: null,
    depth: 0,
    done: false,
  }
}

// ─── Step Algorithm ───────────────────────────────────────────────────────────

interface StepResult {
  state: DTState
  log?: { message: string; type: LogEntry['type'] }
  insight?: Insight | null
  done: boolean
}

function stepAlgorithm(prev: DTState): StepResult {
  if (prev.done) return { state: prev, done: true }

  const points = prev.points  // immutable reference — we don't mutate points

  // Find the region with the highest gini that is splittable
  const splittable = prev.regions.filter(r =>
    r.points.length > 3 &&
    r.gini > 0.08 &&
    r.depth < MAX_DEPTH
  )

  if (splittable.length === 0) {
    const newState: DTState = { ...prev, done: true }

    // Check if we stopped due to max depth
    const hitMaxDepth = prev.regions.some(r => r.depth >= MAX_DEPTH && r.gini > 0.08 && r.points.length > 3)
    const logMsg = hitMaxDepth
      ? `Max depth (${MAX_DEPTH}) reached`
      : `Tree complete — ${prev.splits.length} splits, ${prev.regions.length} regions`
    const logType: LogEntry['type'] = hitMaxDepth ? 'warning' : 'success'

    return {
      state: newState,
      log: { message: logMsg, type: logType },
      insight: null,
      done: true,
    }
  }

  // Pick region with highest gini
  const targetRegion = splittable.reduce((best, r) => r.gini > best.gini ? r : best)

  const splitResult = bestSplitForRegion(targetRegion, points)

  if (!splitResult) {
    // Can't split this region — mark done if no others
    const remaining = splittable.filter(r => r.id !== targetRegion.id)
    if (remaining.length === 0) {
      return {
        state: { ...prev, done: true },
        log: { message: `Tree complete — ${prev.splits.length} splits, ${prev.regions.length} regions`, type: 'success' },
        done: true,
      }
    }
    return { state: prev, done: false }
  }

  const { axis, threshold, giniAfter } = splitResult
  const splitN = prev.splits.length + 1

  // Build the Split record
  const split: Split = {
    regionId: targetRegion.id,
    axis,
    threshold,
    gini_before: targetRegion.gini,
    gini_after: giniAfter,
    depth: targetRegion.depth,
    rx0: targetRegion.x0,
    ry0: targetRegion.y0,
    rx1: targetRegion.x1,
    ry1: targetRegion.y1,
  }

  // Split the points
  const leftIndices = targetRegion.points.filter(i =>
    (axis === 'x' ? points[i].xn : points[i].yn) < threshold
  )
  const rightIndices = targetRegion.points.filter(i =>
    (axis === 'x' ? points[i].xn : points[i].yn) >= threshold
  )

  const nextId = prev.regions.reduce((max, r) => Math.max(max, r.id), 0) + 1

  // Build child regions
  const leftCls = leftIndices.map(i => points[i].cls)
  const rightCls = rightIndices.map(i => points[i].cls)

  const leftRegion: Region = {
    x0: targetRegion.x0,
    y0: axis === 'y' ? threshold : targetRegion.y0,
    x1: axis === 'x' ? threshold : targetRegion.x1,
    y1: targetRegion.y1,
    points: leftIndices,
    gini: gini(leftCls),
    majority: majorityClass(leftCls),
    depth: targetRegion.depth + 1,
    id: nextId,
  }

  const rightRegion: Region = {
    x0: axis === 'x' ? threshold : targetRegion.x0,
    y0: targetRegion.y0,
    x1: targetRegion.x1,
    y1: axis === 'y' ? threshold : targetRegion.y1,
    points: rightIndices,
    gini: gini(rightCls),
    majority: majorityClass(rightCls),
    depth: targetRegion.depth + 1,
    id: nextId + 1,
  }

  const newRegions = prev.regions.filter(r => r.id !== targetRegion.id).concat([leftRegion, rightRegion])
  const newSplits = [...prev.splits, split]
  const newDepth = Math.max(...newSplits.map(s => s.depth + 1))

  const newState: DTState = {
    points: prev.points,
    regions: newRegions,
    splits: newSplits,
    tree: prev.tree,
    depth: newDepth,
    done: false,
  }

  // Build log message
  const axisLabel = axis === 'x' ? 'x₁' : 'x₂'
  const logMsg = `Split ${splitN}: ${axisLabel} < ${threshold.toFixed(3)} — Gini: ${targetRegion.gini.toFixed(3)} → ${giniAfter.toFixed(3)}`

  const logs: Array<{ message: string; type: LogEntry['type'] }> = [
    { message: logMsg, type: 'info' },
  ]

  // Check for pure leaves
  for (const childRegion of [leftRegion, rightRegion]) {
    if (childRegion.gini < 0.01) {
      logs.push({
        message: `Pure leaf — region is 100% class ${childRegion.majority}`,
        type: 'key',
      })
    }
  }

  return {
    state: newState,
    log: logs[0],
    insight: logs.length > 1 ? {
      title: 'Pure Region Found',
      body: `A pure leaf was created — all ${leftRegion.gini < 0.01 ? leftIndices.length : rightIndices.length} points in this region belong to the same class. No further splitting needed here.`,
    } : null,
    done: false,
    // We return extra logs via the main log; subsequent logs need to be handled in the caller
    ...(logs.length > 1 ? { extraLogs: logs.slice(1) } : {}),
  } as StepResult & { extraLogs?: Array<{ message: string; type: LogEntry['type'] }> }
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────

function drawCanvas(
  ctx: CanvasRenderingContext2D,
  state: DTState,
  _w: number,
  _h: number
): void {
  const W = CANVAS_W
  const H = CANVAS_H

  // 1. Background
  ctx.fillStyle = '#0a0a0f'
  ctx.fillRect(0, 0, W, H)

  // 2. Region shading
  for (const region of state.regions) {
    const isPure = region.gini < 0.01
    const alpha = isPure ? 0.22 : 0.10
    if (region.majority === 0) {
      ctx.fillStyle = `rgba(0,229,255,${alpha})`
    } else {
      ctx.fillStyle = `rgba(124,58,237,${alpha})`
    }
    // Map region coords to canvas coords
    const rx = px(region.x0)
    const ry = py(region.y1)   // top of region in canvas coords (y1 is higher in normalized space)
    const rw = px(region.x1) - px(region.x0)
    const rh = py(region.y0) - py(region.y1)  // height in canvas coords
    ctx.fillRect(rx, ry, rw, rh)
  }

  // 3. Split lines
  ctx.save()
  ctx.strokeStyle = 'rgba(226,232,240,0.6)'
  ctx.lineWidth = 1.2
  for (const split of state.splits) {
    ctx.beginPath()
    if (split.axis === 'x') {
      // Vertical line at px(threshold), from py(ry1) to py(ry0)
      const lineX = px(split.threshold)
      const lineY1 = py(split.ry1)
      const lineY0 = py(split.ry0)
      ctx.moveTo(lineX, lineY1)
      ctx.lineTo(lineX, lineY0)
    } else {
      // Horizontal line at py(threshold), from px(rx0) to px(rx1)
      const lineY = py(split.threshold)
      const lineX0 = px(split.rx0)
      const lineX1 = px(split.rx1)
      ctx.moveTo(lineX0, lineY)
      ctx.lineTo(lineX1, lineY)
    }
    ctx.stroke()
  }
  ctx.restore()

  // 4. Gini labels
  ctx.save()
  ctx.font = '10px var(--font-jetbrains), monospace'
  ctx.fillStyle = 'rgba(100,116,139,0.8)'
  ctx.textAlign = 'center'
  for (const region of state.regions) {
    const cx = (px(region.x0) + px(region.x1)) / 2
    const cy = (py(region.y0) + py(region.y1)) / 2
    ctx.fillText(`G=${region.gini.toFixed(2)}`, cx, cy)
  }
  ctx.restore()

  // 5. Points
  for (const pt of state.points) {
    const cx = px(pt.xn)
    const cy = py(pt.yn)
    const color = pt.cls === 0 ? '#00e5ff' : '#7c3aed'
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, 5, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 6
    ctx.fill()
    ctx.restore()
  }

  // 6. Axes border
  ctx.save()
  ctx.strokeStyle = '#1e1e2e'
  ctx.lineWidth = 1
  ctx.strokeRect(ML, MT, PLOT_W, PLOT_H)
  ctx.restore()

  // 7. Top-left: "Depth: N"
  ctx.save()
  ctx.font = '12px var(--font-jetbrains), monospace'
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'left'
  ctx.fillText(`Depth: ${state.depth}`, 16, 24)
  ctx.restore()

  // 8. If done: "✓ Complete"
  if (state.done) {
    ctx.save()
    ctx.font = '12px var(--font-jetbrains), monospace'
    ctx.fillStyle = '#10b981'
    ctx.textAlign = 'right'
    ctx.fillText('✓ Complete', W - 16, 24)
    ctx.restore()
  }

  // ─── Mini Tree Diagram ───────────────────────────────────────────────────────
  const treeX = 490
  const treeY = 300
  const treeW = 180
  const treeH = 130

  ctx.save()
  ctx.fillStyle = '#111118'
  ctx.fillRect(treeX, treeY, treeW, treeH)
  ctx.strokeStyle = '#1e1e2e'
  ctx.lineWidth = 1
  ctx.strokeRect(treeX, treeY, treeW, treeH)

  ctx.font = '9px var(--font-jetbrains), monospace'
  ctx.fillStyle = '#64748b'
  ctx.textAlign = 'left'
  ctx.fillText('decision tree', treeX + 6, treeY + 12)

  // Draw splits as indented text
  const visibleSplits = state.splits.slice(0, 5)
  const lineHeight = 14
  let lineY = treeY + 18

  ctx.fillStyle = '#94a3b8'
  ctx.font = '9px var(--font-jetbrains), monospace'

  for (let i = 0; i < visibleSplits.length; i++) {
    const s = visibleSplits[i]
    const indent = '  '.repeat(s.depth)
    const axisLabel = s.axis === 'x' ? 'x₁' : 'x₂'
    const text = `${indent}${axisLabel} < ${s.threshold.toFixed(3)}`
    lineY += lineHeight
    ctx.fillText(text, treeX + 6, lineY)
  }

  if (state.splits.length > 5) {
    lineY += lineHeight
    ctx.fillStyle = '#64748b'
    ctx.fillText('  ...', treeX + 6, lineY)
  }

  ctx.restore()
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function DecisionTreeViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>(0)
  const stateRef = useRef<DTState>(initState())
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
    const result = stepAlgorithm(stateRef.current) as StepResult & {
      extraLogs?: Array<{ message: string; type: LogEntry['type'] }>
    }
    stateRef.current = result.state
    if (result.log) addLog(result.log.message, result.log.type)
    if (result.extraLogs) {
      for (const el of result.extraLogs) {
        addLog(el.message, el.type)
      }
    }
    if (result.insight !== undefined) setCurrentInsight(result.insight)
    if (result.done) setIsPlaying(false)
  }, [addLog])

  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (!isPlaying) return
    const delays: Record<Speed, number> = { slow: 1600, normal: 900, fast: 250 }
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
    <div style={{ background: '#0a0a0f', minHeight: '100%' }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <h2 style={{ fontFamily: 'var(--font-syne)', fontSize: 22, color: '#e2e8f0', margin: 0 }}>Decision Tree</h2>
          <span style={{
            padding: '2px 8px',
            background: 'rgba(0,229,255,0.1)',
            border: '1px solid rgba(0,229,255,0.25)',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#00e5ff',
          }}>O(n&middot;d&middot;log n)</span>
          <span style={{
            padding: '2px 8px',
            background: '#111118',
            border: '1px solid #1e1e2e',
            borderRadius: 4,
            fontFamily: 'var(--font-jetbrains), monospace',
            fontSize: 11,
            color: '#64748b',
          }}>Supervised Learning</span>
        </div>
        <p style={{ fontFamily: 'var(--font-jetbrains), monospace', fontSize: 12, color: '#64748b', margin: 0 }}>
          Recursively splits data on the feature that best separates classes
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
          Decision trees split the feature space into rectangular regions by asking binary questions (is x&#x2081; &lt; 0.45?). At each step, the algorithm finds the single split that most reduces Gini impurity &mdash; a measure of class mixing. The process repeats recursively until regions are pure or a depth limit is hit. Because each split only looks locally, trees are &quot;greedy&quot; and prone to overfitting &mdash; every point can be perfectly classified by growing the tree deep enough.
        </p>
      </details>
    </div>
  )
}
