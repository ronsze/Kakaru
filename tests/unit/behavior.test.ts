import { describe, expect, it } from 'vitest'
import { WalkableArea } from '../../src/shared/area'
import { MovementEngine } from '../../src/shared/behavior'
import { config } from '../../src/shared/config'
import type { Character, Rect } from '../../src/shared/types'
import { seededRandom } from './helpers'

const DT = 1 / 60
const screen: Rect[] = [{ x: 0, y: 0, width: 1920, height: 1080 }]
const lShape: Rect[] = [
  { x: 0, y: 0, width: 400, height: 800 },
  { x: 400, y: 400, width: 600, height: 400 }
]

function createEngine(displays: Rect[], seed = 1) {
  return new MovementEngine({
    area: new WalkableArea(displays),
    random: seededRandom(seed),
    startAt: 0
  })
}

/** 지정한 시간(ms)만큼 틱을 돌리며 매 틱의 캐릭터 스냅샷을 돌려준다 */
function run(engine: MovementEngine, fromMs: number, durationMs: number): Character[] {
  const out: Character[] = []
  const ticks = Math.round((durationMs / 1000) * 60)
  for (let i = 1; i <= ticks; i++) {
    const c = engine.tick(fromMs + i * DT * 1000, DT)
    out.push(structuredClone(c))
  }
  return out
}

describe('MovementEngine 시작 (SC-001)', () => {
  it('시작은 Idle이고 5초 안에 Walking에 들어간다', () => {
    const engine = createEngine(screen)
    const log = run(engine, 0, config.firstMoveWithinMs)
    expect(log[0].state).toBe('Idle')
    expect(log.some((c) => c.state === 'Walking')).toBe(true)
  })

  it('다른 시드에서도 5초 안에 Walking에 들어간다', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const log = run(createEngine(screen, seed), 0, config.firstMoveWithinMs)
      expect(log.some((c) => c.state === 'Walking')).toBe(true)
    }
  })
})

describe('MovementEngine 상태 전이', () => {
  it('Walking은 목표에 도달하면 Idle이 되고 속도 0, 목표 null이 된다', () => {
    const engine = createEngine(screen)
    const log = run(engine, 0, 20_000)
    const i = log.findIndex((c, k) => k > 0 && log[k - 1].state === 'Walking' && c.state === 'Idle')
    expect(i).toBeGreaterThan(0)
    expect(log[i].velocity).toEqual({ x: 0, y: 0 })
    expect(log[i].target).toBeNull()
  })

  it('Idle은 stateUntil이 지나면 Walking이 된다', () => {
    const engine = createEngine(screen)
    const log = run(engine, 0, 20_000)
    const i = log.findIndex((c, k) => k > 0 && log[k - 1].state === 'Idle' && c.state === 'Walking')
    expect(i).toBeGreaterThan(0)
    expect(log[i].target).not.toBeNull()
  })
})

describe('MovementEngine 10분 시뮬레이션', () => {
  for (const [name, displays] of [
    ['단일 화면', screen],
    ['L자 멀티 화면', lShape]
  ] as const) {
    it(`${name}: 항상 영역 안에 있고 검증 규칙을 지킨다`, () => {
      const area = new WalkableArea(displays)
      const engine = createEngine(displays, 7)
      const log = run(engine, 0, 10 * 60 * 1000)
      for (const c of log) {
        expect(area.contains(c.position)).toBe(true)
        if (c.state === 'Walking') {
          expect(c.target).not.toBeNull()
        } else {
          expect(c.velocity).toEqual({ x: 0, y: 0 })
          expect(c.target).toBeNull()
        }
      }
    })

    it(`${name}: 한 방향으로만 끝없이 이동하지 않는다 (FR-003)`, () => {
      const engine = createEngine(displays, 7)
      const log = run(engine, 0, 60_000)
      let stops = 0
      let turns = 0
      for (let k = 1; k < log.length; k++) {
        if (log[k - 1].state === 'Walking' && log[k].state === 'Idle') stops++
        if (log[k].heading !== log[k - 1].heading) turns++
      }
      expect(stops).toBeGreaterThanOrEqual(2)
      expect(turns).toBeGreaterThanOrEqual(3)
    })
  }

  it('Walking 중 직선 경로가 이동 가능 영역 안에 있다', () => {
    const area = new WalkableArea(lShape)
    const engine = createEngine(lShape, 3)
    for (const c of run(engine, 0, 5 * 60 * 1000)) {
      if (c.state === 'Walking') expect(area.containsSegment(c.position, c.target!)).toBe(true)
    }
  })
})

describe('MovementEngine 영역 변경 (FR-008)', () => {
  it('영역이 줄어 캐릭터가 밖에 놓이면 가장 가까운 내부 점으로 옮긴다', () => {
    const engine = createEngine(screen, 5)
    run(engine, 0, 30_000)
    const small = new WalkableArea([{ x: 0, y: 0, width: 100, height: 100 }])
    engine.setWalkableArea(small)
    const c = engine.tick(30_000 + DT * 1000, DT)
    expect(small.contains(c.position)).toBe(true)
  })
})
