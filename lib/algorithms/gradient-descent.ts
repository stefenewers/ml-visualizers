/**
 * The optimisation core: the loss surface, its analytic gradient, and one step of each
 * optimiser. No React, no canvas.
 *
 * These lived inside GradientDescentViz.tsx, where the only way to check that momentum
 * actually carries velocity through a flat region was to watch it. They are pure
 * functions of their inputs, so lib/algorithms/gradient-descent.test.ts asserts it
 * instead.
 *
 * The surface is deliberately non-convex: sin/cos ripples over a quadratic bowl, which
 * is what gives plain gradient descent somewhere to get stuck.
 */

/** The position bound the visualisation clamps to, on both axes. */
export const BOUND = 1.95

/** Momentum coefficient for the momentum optimiser. */
export const MOMENTUM = 0.85

/** Loss changing by less than this for six consecutive steps counts as stuck. */
export const STUCK_EPSILON = 0.0005
export const STUCK_STEPS = 5

export interface Ball {
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

export function computeLoss(x: number, y: number): number {
  return Math.sin(2.5 * x) * Math.cos(2.5 * y) + 0.4 * (x * x + y * y) - 0.3
}

export function computeGradient(x: number, y: number): { gx: number; gy: number } {
  const gx = 2.5 * Math.cos(2.5 * x) * Math.cos(2.5 * y) + 0.8 * x
  const gy = -2.5 * Math.sin(2.5 * x) * Math.sin(2.5 * y) + 0.8 * y
  return { gx, gy }
}

export function stepBallGD(ball: Ball, lr: number): Ball {
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

export function stepBallMomentum(ball: Ball, lr: number): Ball {
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
