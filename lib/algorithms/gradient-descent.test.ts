import { describe, it, expect } from 'vitest'
import {
  BOUND,
  MOMENTUM,
  computeLoss,
  computeGradient,
  stepBallGD,
  stepBallMomentum,
  type Ball,
} from './gradient-descent'

/**
 * A minimum of this surface, found by running descent to convergence from a grid of
 * starting points. Hard-coded rather than searched for at test time so a failure points
 * at the algorithm rather than at the search.
 */
const MINIMUM = { x: -0.556681, y: 0 }

function ball(x: number, y: number, extra: Partial<Ball> = {}): Ball {
  return {
    x,
    y,
    loss: computeLoss(x, y),
    vx: 0,
    vy: 0,
    trail: [],
    color: '#000',
    label: 'test',
    stuck: false,
    stuckCount: 0,
    ...extra,
  }
}

describe('computeGradient', () => {
  it('matches a numerical derivative of computeLoss', () => {
    // The gradient is written analytically. If the loss surface is ever edited without
    // updating the gradient, both optimisers silently descend the wrong function, and
    // nothing else in the app would notice.
    const h = 1e-6
    for (const [x, y] of [[0.3, -0.7], [-1.2, 0.4], [0.9, 0.9], [0, 0]]) {
      const { gx, gy } = computeGradient(x, y)
      const numericalX = (computeLoss(x + h, y) - computeLoss(x - h, y)) / (2 * h)
      const numericalY = (computeLoss(x, y + h) - computeLoss(x, y - h)) / (2 * h)
      expect(gx).toBeCloseTo(numericalX, 4)
      expect(gy).toBeCloseTo(numericalY, 4)
    }
  })

  it('vanishes at the surface\'s minimum', () => {
    // Located by running descent to convergence from a grid of starts. The origin is
    // NOT a critical point here: gx(0,0) is 2.5, because sin/cos ripples are centred on
    // the axes rather than flat across them.
    const { gx, gy } = computeGradient(MINIMUM.x, MINIMUM.y)
    expect(Math.abs(gx)).toBeLessThan(1e-5)
    expect(Math.abs(gy)).toBeLessThan(1e-5)
  })

  it('is not zero at the origin', () => {
    const { gx } = computeGradient(0, 0)
    expect(gx).toBeCloseTo(2.5, 6)
  })
})

describe('stepBallGD', () => {
  it('moves against the gradient', () => {
    const start = ball(1.0, 0.5)
    const { gx, gy } = computeGradient(start.x, start.y)
    const lr = 0.01
    const next = stepBallGD(start, lr)
    expect(next.x).toBeCloseTo(start.x - lr * gx, 10)
    expect(next.y).toBeCloseTo(start.y - lr * gy, 10)
  })

  it('decreases loss on a small step from a non-critical point', () => {
    const start = ball(1.2, 0.8)
    const next = stepBallGD(start, 0.005)
    expect(next.loss).toBeLessThan(start.loss)
  })

  it('clamps position to the plotted region', () => {
    // Without the clamp a large learning rate throws the ball off the visible surface
    // and the trail renders off-canvas.
    const escaping = ball(1.9, -1.9)
    const next = stepBallGD(escaping, 50)
    expect(next.x).toBeGreaterThanOrEqual(-BOUND)
    expect(next.x).toBeLessThanOrEqual(BOUND)
    expect(next.y).toBeGreaterThanOrEqual(-BOUND)
    expect(next.y).toBeLessThanOrEqual(BOUND)
  })

  it('records where it came from in the trail', () => {
    const start = ball(1.0, 1.0)
    const next = stepBallGD(start, 0.01)
    expect(next.trail.at(-1)).toEqual({ x: start.x, y: start.y, loss: start.loss })
  })

  it('caps the trail so it cannot grow without bound', () => {
    let b = ball(1.5, 1.5, { trail: Array.from({ length: 120 }, () => ({ x: 0, y: 0, loss: 0 })) })
    b = stepBallGD(b, 0.01)
    expect(b.trail.length).toBeLessThanOrEqual(60)
  })

  it('flags stuck only after the loss stops moving for several steps', () => {
    // At the minimum the gradient vanishes, so the loss stops changing and the
    // visualisation reports the ball as stuck.
    let b = ball(MINIMUM.x, MINIMUM.y)
    expect(b.stuck).toBe(false)
    for (let i = 0; i < 6; i++) b = stepBallGD(b, 0.05)
    expect(b.stuckCount).toBeGreaterThan(5)
    expect(b.stuck).toBe(true)
  })

  it('resets the stuck counter as soon as the loss moves again', () => {
    const stalled = ball(1.0, 1.0, { stuckCount: 4, loss: 999 })
    const next = stepBallGD(stalled, 0.02)
    expect(next.stuckCount).toBe(0)
    expect(next.stuck).toBe(false)
  })

  it('does not mutate the ball it was given', () => {
    const start = ball(1.0, 0.5)
    const snapshot = JSON.parse(JSON.stringify(start))
    stepBallGD(start, 0.01)
    expect(start).toEqual(snapshot)
  })
})

describe('stepBallMomentum', () => {
  it('accumulates velocity across steps', () => {
    const start = ball(1.2, 0.9)
    const first = stepBallMomentum(start, 0.01)
    const second = stepBallMomentum(first, 0.01)
    // Velocity starts at zero, so the second step must carry more of it than the first.
    expect(Math.abs(first.vx)).toBeGreaterThan(0)
    expect(Math.hypot(second.vx, second.vy)).toBeGreaterThan(Math.hypot(first.vx, first.vy))
  })

  it('applies the momentum coefficient to the previous velocity', () => {
    const moving = ball(0.5, 0.5, { vx: 0.1, vy: -0.2 })
    const lr = 0.01
    const { gx, gy } = computeGradient(moving.x, moving.y)
    const next = stepBallMomentum(moving, lr)
    expect(next.vx).toBeCloseTo(MOMENTUM * 0.1 - lr * gx, 10)
    expect(next.vy).toBeCloseTo(MOMENTUM * -0.2 - lr * gy, 10)
  })

  it('keeps moving where plain descent stalls', () => {
    // The comparison the whole visualisation exists to make. At the minimum the gradient
    // vanishes, so plain gradient descent has nothing left to move it. Momentum still
    // carries whatever velocity it arrived with.
    const plain = stepBallGD(ball(MINIMUM.x, MINIMUM.y), 0.05)
    expect(plain.x).toBeCloseTo(MINIMUM.x, 5)
    expect(plain.y).toBeCloseTo(MINIMUM.y, 5)

    const carrying = stepBallMomentum(
      ball(MINIMUM.x, MINIMUM.y, { vx: 0.05, vy: 0.05 }),
      0.05
    )
    const travelled = Math.hypot(carrying.x - MINIMUM.x, carrying.y - MINIMUM.y)
    expect(travelled).toBeGreaterThan(0.01)
  })

  it('clamps position like plain descent does', () => {
    const escaping = ball(1.9, 1.9, { vx: 5, vy: 5 })
    const next = stepBallMomentum(escaping, 0.5)
    expect(Math.abs(next.x)).toBeLessThanOrEqual(BOUND)
    expect(Math.abs(next.y)).toBeLessThanOrEqual(BOUND)
  })

  it('does not mutate the ball it was given', () => {
    const start = ball(1.0, 0.5, { vx: 0.02, vy: 0.03 })
    const snapshot = JSON.parse(JSON.stringify(start))
    stepBallMomentum(start, 0.01)
    expect(start).toEqual(snapshot)
  })
})
