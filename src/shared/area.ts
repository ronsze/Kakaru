import type { Point, Rect } from './types'

const EPS = 1e-6

function inRect(p: Point, r: Rect): boolean {
  return (
    p.x >= r.x - EPS &&
    p.x <= r.x + r.width + EPS &&
    p.y >= r.y - EPS &&
    p.y <= r.y + r.height + EPS
  )
}

function clampToRect(p: Point, r: Rect): Point {
  return {
    x: Math.min(Math.max(p.x, r.x), r.x + r.width),
    y: Math.min(Math.max(p.y, r.y), r.y + r.height)
  }
}

/** 선분 a→b가 사각형 안에 있는 매개변수 구간 [t0, t1] (없으면 null). Liang–Barsky. */
function clipSegment(a: Point, b: Point, r: Rect): [number, number] | null {
  let t0 = 0
  let t1 = 1
  const dx = b.x - a.x
  const dy = b.y - a.y
  const checks: [number, number][] = [
    [-dx, a.x - r.x],
    [dx, r.x + r.width - a.x],
    [-dy, a.y - r.y],
    [dy, r.y + r.height - a.y]
  ]
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < -EPS) return null
    } else {
      const t = q / p
      if (p < 0) t0 = Math.max(t0, t)
      else t1 = Math.min(t1, t)
    }
  }
  return t0 <= t1 + EPS ? [t0, t1] : null
}

/** 이동 가능 영역: 연결된 디스플레이 영역(bounds)의 합집합 */
export class WalkableArea {
  constructor(readonly displays: readonly Rect[]) {}

  contains(point: Point): boolean {
    return this.displays.some((r) => inRect(point, r))
  }

  /** 두 점을 잇는 선분 전체가 영역의 합집합 안에 있는지 */
  containsSegment(a: Point, b: Point): boolean {
    const intervals: [number, number][] = []
    for (const r of this.displays) {
      const iv = clipSegment(a, b, r)
      if (iv) intervals.push(iv)
    }
    intervals.sort((x, y) => x[0] - y[0])
    let covered = 0
    for (const [t0, t1] of intervals) {
      if (t0 > covered + EPS) return false
      covered = Math.max(covered, t1)
      if (covered >= 1 - EPS) return true
    }
    return covered >= 1 - EPS
  }

  /** 영역 밖의 점을 가장 가까운 내부 점으로 옮긴다. 안에 있으면 그대로 돌려준다. */
  clamp(point: Point): Point {
    if (this.contains(point)) return point
    let best: Point = point
    let bestDist = Infinity
    for (const r of this.displays) {
      const c = clampToRect(point, r)
      const d = Math.hypot(c.x - point.x, c.y - point.y)
      if (d < bestDist) {
        bestDist = d
        best = c
      }
    }
    return best
  }

  /** 점이 속한 디스플레이의 인덱스. 어디에도 속하지 않으면 null. */
  displayAt(point: Point): number | null {
    const i = this.displays.findIndex((r) => inRect(point, r))
    return i === -1 ? null : i
  }
}
