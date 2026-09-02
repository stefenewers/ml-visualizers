/**
 * K-Means: the algorithm, with no React, no canvas and no colours it does not need.
 *
 * This lived inside KMeansViz.tsx, which made it untestable without rendering a
 * component and a canvas. The visualisation imports these functions; so do the tests in
 * lib/algorithms/kmeans.test.ts, which is the whole reason for the split.
 *
 * `stepAlgorithm` is pure: it takes a state and returns a new one, and never mutates its
 * input. That is what makes convergence and cluster assignment assertable.
 */

import type { LogEntry, Insight } from '@/lib/types'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KPoint { x: number; y: number; cluster: number }
export interface KCentroid { x: number; y: number; tx: number; ty: number; color: string }
export interface KState {
  points: KPoint[]
  centroids: KCentroid[]
  iteration: number
  converged: boolean
  animProgress: number
  changedCount: number
  phase: 'assign' | 'update' | 'done'
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const CLUSTER_COLORS = ['#00e5ff', '#7c3aed', '#f59e0b']

// ─── Algorithm Helpers ────────────────────────────────────────────────────────

export function euclidean(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return dx * dx + dy * dy
}

export function initState(k: number = 3): KState {
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

export interface StepResult {
  state: KState
  log?: { message: string; type: LogEntry['type'] }
  insight?: Insight | null
  done: boolean
}

export function stepAlgorithm(prev: KState): StepResult {
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
