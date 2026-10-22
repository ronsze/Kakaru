import { describe, expect, it } from 'vitest'
import { WalkableArea } from '../../src/shared/area'
import { MovementEngine } from '../../src/shared/behavior'
import { config } from '../../src/shared/config'
import { seededRandom } from './helpers'

const DT = 1 / 60
const area = new WalkableArea([{ x: 0, y: 0, width: 1920, height: 1080 }])

function create(seed = 1) {
  return new MovementEngine({ area, random: seededRandom(seed), startAt: 0 })
}

/** 지정한 상태가 될 때까지 틱을 돌리고 그 시각(ms)을 돌려준다 */
function runUntil(engine: MovementEngine, state: 'Walking' | 'Idle', from = 0): number {
  let now = from
  for (let i = 0; i < 60 * 60; i++) {
    now += DT * 1000
    if (engine.tick(now, DT).state === state) return now
  }
  throw new Error(`${state}에 도달하지 못함`)
}

describe('setUserControlled (FR-006, SC-004)', () => {
  it('Walking 중 진입하면 한 틱 안에 정지한다', () => {
    const engine = create()
    let now = runUntil(engine, 'Walking')
    now += DT * 1000
    engine.tick(now, DT)
    engine.setUserControlled(true, now)
    const c = engine.getCharacter()
    expect(c.state).toBe('UserControlled')
    expect(c.velocity).toEqual({ x: 0, y: 0 })
    expect(c.target).toBeNull()
  })

  it('Idle 중에도 진입할 수 있다', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    expect(engine.getCharacter().state).toBe('UserControlled')
  })

  it('조작 중에는 틱이 지나도 position이 변하지 않는다', () => {
    const engine = create()
    const now = runUntil(engine, 'Walking')
    engine.setUserControlled(true, now)
    const before = { ...engine.getCharacter().position }
    let t = now
    for (let i = 0; i < 60 * 30; i++) {
      t += DT * 1000
      engine.tick(t, DT)
    }
    expect(engine.getCharacter().position).toEqual(before)
    expect(engine.getCharacter().state).toBe('UserControlled')
  })

  it('조작이 끝나면 그 자리에서 Idle로 복귀하고 stateUntil을 새로 설정한다', () => {
    const engine = create()
    const now = runUntil(engine, 'Walking')
    engine.setUserControlled(true, now)
    const pos = { ...engine.getCharacter().position }
    const end = now + 10_000
    engine.setUserControlled(false, end)
    const c = engine.getCharacter()
    expect(c.state).toBe('Idle')
    expect(c.position).toEqual(pos)
    expect(c.stateUntil).toBeGreaterThanOrEqual(end + config.idleDurationMs.min)
    expect(c.stateUntil).toBeLessThanOrEqual(end + config.idleDurationMs.max)
  })

  it('복귀 후 다시 자율 이동한다', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.setUserControlled(false, 1000)
    expect(runUntil(engine, 'Walking', 1000)).toBeGreaterThan(1000)
  })

  it('조작 중이 아닐 때 false를 호출해도 상태가 바뀌지 않는다', () => {
    const engine = create()
    const before = engine.getCharacter().stateUntil
    engine.setUserControlled(false, 0)
    expect(engine.getCharacter().state).toBe('Idle')
    expect(engine.getCharacter().stateUntil).toBe(before)
  })

  it('조작 중 영역이 바뀌어도 자율 이동으로 돌아가지 않는다', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.setWalkableArea(new WalkableArea([{ x: 0, y: 0, width: 100, height: 100 }]))
    expect(engine.getCharacter().state).toBe('UserControlled')
  })
})
