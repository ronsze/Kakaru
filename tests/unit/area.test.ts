import { describe, expect, it } from 'vitest'
import { WalkableArea } from '../../src/shared/area'
import type { Rect } from '../../src/shared/types'

const single: Rect[] = [{ x: 0, y: 0, width: 1000, height: 600 }]
// L자 배치: 세로 막대 + 오른쪽 아래 블록. 오른쪽 위(100~200, 0~100)는 빈 공간.
const lShape: Rect[] = [
  { x: 0, y: 0, width: 100, height: 200 },
  { x: 100, y: 100, width: 100, height: 100 }
]

describe('WalkableArea.contains', () => {
  it('영역 안과 경계는 true, 밖은 false', () => {
    const area = new WalkableArea(single)
    expect(area.contains({ x: 500, y: 300 })).toBe(true)
    expect(area.contains({ x: 0, y: 0 })).toBe(true)
    expect(area.contains({ x: 1000, y: 600 })).toBe(true)
    expect(area.contains({ x: 1001, y: 300 })).toBe(false)
  })

  it('여러 디스플레이의 합집합을 본다', () => {
    const area = new WalkableArea(lShape)
    expect(area.contains({ x: 50, y: 50 })).toBe(true)
    expect(area.contains({ x: 150, y: 150 })).toBe(true)
    expect(area.contains({ x: 150, y: 50 })).toBe(false)
  })
})

describe('WalkableArea.containsSegment', () => {
  it('한 디스플레이 안의 선분은 true', () => {
    const area = new WalkableArea(single)
    expect(area.containsSegment({ x: 10, y: 10 }, { x: 900, y: 500 })).toBe(true)
  })

  it('영역 밖으로 나가는 선분은 false', () => {
    const area = new WalkableArea(single)
    expect(area.containsSegment({ x: 10, y: 10 }, { x: 1100, y: 500 })).toBe(false)
  })

  it('L자 배치에서 빈 공간을 지나는 선분은 false', () => {
    const area = new WalkableArea(lShape)
    expect(area.containsSegment({ x: 50, y: 50 }, { x: 150, y: 50 })).toBe(false)
  })

  it('인접한 디스플레이 경계를 가로지르는 선분은 true', () => {
    const area = new WalkableArea(lShape)
    expect(area.containsSegment({ x: 50, y: 150 }, { x: 150, y: 150 })).toBe(true)
    expect(area.containsSegment({ x: 50, y: 50 }, { x: 150, y: 150 })).toBe(true)
  })
})

describe('WalkableArea.clamp', () => {
  it('영역 안의 점은 그대로 둔다', () => {
    const area = new WalkableArea(single)
    expect(area.clamp({ x: 500, y: 300 })).toEqual({ x: 500, y: 300 })
  })

  it('영역 밖의 점은 가장 가까운 내부 점으로 옮긴다', () => {
    const area = new WalkableArea(single)
    expect(area.clamp({ x: -10, y: -10 })).toEqual({ x: 0, y: 0 })
    expect(area.clamp({ x: 2000, y: 300 })).toEqual({ x: 1000, y: 300 })
  })

  it('빈 공간의 점도 영역 안으로 옮긴다', () => {
    const area = new WalkableArea(lShape)
    const p = area.clamp({ x: 150, y: 50 })
    expect(area.contains(p)).toBe(true)
    expect(Math.hypot(p.x - 150, p.y - 50)).toBeCloseTo(50)
  })
})

describe('WalkableArea.displayAt', () => {
  it('점이 속한 디스플레이의 인덱스를 돌려준다', () => {
    const area = new WalkableArea(lShape)
    expect(area.displayAt({ x: 50, y: 50 })).toBe(0)
    expect(area.displayAt({ x: 150, y: 150 })).toBe(1)
  })

  it('어느 디스플레이에도 속하지 않으면 null', () => {
    const area = new WalkableArea(lShape)
    expect(area.displayAt({ x: 150, y: 50 })).toBeNull()
  })
})
