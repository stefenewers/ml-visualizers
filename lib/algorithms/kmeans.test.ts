import { describe, it, expect } from 'vitest'
import {
  euclidean,
  initState,
  stepAlgorithm,
  CLUSTER_COLORS,
  type KState,
  type KPoint,
  type KCentroid,
} from './kmeans'

/**
 * Builds a state with no randomness, so every assertion below is about the algorithm
 * rather than about which points happened to be generated.
 */
function state(points: Array<[number, number, number]>, centroids: Array<[number, number]>): KState {
  return {
    points: points.map(([x, y, cluster]): KPoint => ({ x, y, cluster })),
    centroids: centroids.map(([x, y], i): KCentroid => ({
      x, y, tx: x, ty: y, color: CLUSTER_COLORS[i] ?? '#000',
    })),
    iteration: 0,
    converged: false,
    animProgress: 1,
    changedCount: 0,
    phase: 'assign',
  }
}

describe('euclidean', () => {
  it('returns squared distance, not distance', () => {
    // Squared is what the assignment loop compares, and skipping the sqrt is the reason.
    expect(euclidean(0, 0, 3, 4)).toBe(25)
  })

  it('is zero for a point against itself, and symmetric', () => {
    expect(euclidean(7, -2, 7, -2)).toBe(0)
    expect(euclidean(1, 2, 5, 9)).toBe(euclidean(5, 9, 1, 2))
  })
})

describe('stepAlgorithm assignment', () => {
  it('assigns every point to its nearest centroid', () => {
    // Two tight groups, one centroid parked beside each.
    const prev = state(
      [[0, 0, 1], [1, 1, 1], [100, 100, 0], [101, 101, 0]],
      [[0, 0], [100, 100]]
    )
    const { state: next } = stepAlgorithm(prev)
    expect(next.points.map((p) => p.cluster)).toEqual([0, 0, 1, 1])
  })

  it('counts only the points that actually changed cluster', () => {
    const prev = state([[0, 0, 1], [100, 100, 1]], [[0, 0], [100, 100]])
    const { state: next } = stepAlgorithm(prev)
    // The first point moves from cluster 1 to 0; the second was already correct.
    expect(next.changedCount).toBe(1)
  })

  it('moves each centroid to the mean of its members', () => {
    const prev = state([[0, 0, 0], [10, 20, 0], [200, 200, 1]], [[1, 1], [200, 200]])
    const { state: next } = stepAlgorithm(prev)
    expect(next.centroids[0].tx).toBeCloseTo(5)
    expect(next.centroids[0].ty).toBeCloseTo(10)
  })

  it('leaves an empty cluster where it is instead of moving it to NaN', () => {
    // Dividing by zero members is the obvious bug here; the centroid must hold position.
    const prev = state([[0, 0, 0], [1, 1, 0]], [[0, 0], [999, 999]])
    const { state: next } = stepAlgorithm(prev)
    expect(next.points.every((p) => p.cluster === 0)).toBe(true)
    expect(next.centroids[1].tx).toBe(999)
    expect(next.centroids[1].ty).toBe(999)
    expect(Number.isNaN(next.centroids[1].tx)).toBe(false)
  })
})

describe('stepAlgorithm convergence', () => {
  it('reports convergence when no point changes cluster', () => {
    const prev = state([[0, 0, 0], [100, 100, 1]], [[0, 0], [100, 100]])
    const result = stepAlgorithm(prev)
    expect(result.state.changedCount).toBe(0)
    expect(result.state.converged).toBe(true)
    expect(result.state.phase).toBe('done')
    expect(result.done).toBe(true)
  })

  it('is a no-op once converged', () => {
    const converged: KState = { ...state([[0, 0, 0]], [[0, 0]]), converged: true }
    const result = stepAlgorithm(converged)
    expect(result.state).toBe(converged)
    expect(result.done).toBe(true)
  })

  it('increments the iteration counter on every step that runs', () => {
    let current = state([[0, 0, 1], [1, 0, 1], [50, 50, 0]], [[0, 0], [50, 50]])
    current = stepAlgorithm(current).state
    expect(current.iteration).toBe(1)
    current = stepAlgorithm(current).state
    expect(current.iteration).toBe(2)
  })

  it('reaches a stable assignment on separable data', () => {
    let current = state(
      [[0, 0, 1], [2, 1, 1], [1, 2, 1], [80, 80, 0], [82, 81, 0], [81, 82, 0]],
      [[0, 0], [80, 80]]
    )
    let steps = 0
    while (!current.converged && steps < 25) {
      current = stepAlgorithm(current).state
      steps++
    }
    expect(current.converged).toBe(true)
    // Two well-separated groups must not end up sharing a cluster label.
    const [a, b] = [current.points.slice(0, 3), current.points.slice(3)]
    expect(new Set(a.map((p) => p.cluster)).size).toBe(1)
    expect(new Set(b.map((p) => p.cluster)).size).toBe(1)
    expect(a[0].cluster).not.toBe(b[0].cluster)
  })
})

describe('stepAlgorithm purity', () => {
  it('does not mutate the state it was given', () => {
    const prev = state([[0, 0, 1], [100, 100, 0]], [[0, 0], [100, 100]])
    const snapshot = JSON.parse(JSON.stringify(prev))
    stepAlgorithm(prev)
    // The visualisation keeps the previous state to animate from, so a mutation here
    // would make the transition render from the wrong place.
    expect(prev).toEqual(snapshot)
  })
})

describe('initState', () => {
  it('creates the requested number of centroids, each with a colour', () => {
    for (const k of [2, 3]) {
      const s = initState(k)
      expect(s.centroids).toHaveLength(k)
      expect(s.centroids.every((c) => typeof c.color === 'string' && c.color.length > 0)).toBe(true)
    }
  })

  it('seeds centroids on real data points, as k-means++ requires', () => {
    const s = initState(3)
    for (const c of s.centroids) {
      expect(s.points.some((p) => p.x === c.x && p.y === c.y)).toBe(true)
    }
  })

  it('starts every point assigned to its nearest centroid', () => {
    const s = initState(3)
    for (const p of s.points) {
      const distances = s.centroids.map((c) => euclidean(p.x, p.y, c.x, c.y))
      expect(distances[p.cluster]).toBe(Math.min(...distances))
    }
  })

  it('starts unconverged, at iteration zero', () => {
    const s = initState(3)
    expect(s.iteration).toBe(0)
    expect(s.converged).toBe(false)
    expect(s.points).toHaveLength(40)
  })
})
