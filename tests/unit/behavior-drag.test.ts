import { describe, expect, it } from 'vitest'
import { WalkableArea } from '../../src/shared/area'
import { MovementEngine } from '../../src/shared/behavior'
import { seededRandom } from './helpers'

const DT = 1 / 60
const area = new WalkableArea([
  { x: 0, y: 0, width: 1920, height: 1080 },
  { x: 1920, y: 0, width: 1280, height: 720 }
])

function create() {
  return new MovementEngine({ area, random: seededRandom(1), startAt: 0 })
}

describe('moveTo (드래그 중 위치 설정)', () => {
  it('UserControlled일 때 위치를 바꾼다', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.moveTo({ x: 300, y: 400 })
    expect(engine.getCharacter().position).toEqual({ x: 300, y: 400 })
  })

  it('UserControlled가 아니면 무시한다', () => {
    const engine = create()
    const before = { ...engine.getCharacter().position }
    engine.moveTo({ x: 300, y: 400 })
    expect(engine.getCharacter().position).toEqual(before)
  })

  it('영역 밖 점은 가장 가까운 디스플레이 안으로 맞춘다 (FR-005)', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.moveTo({ x: -50, y: 2000 })
    expect(engine.getCharacter().position).toEqual({ x: 0, y: 1080 })
  })

  it('다른 디스플레이로 옮길 수 있다 (US2-2)', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.moveTo({ x: 2500, y: 300 })
    expect(area.displayAt(engine.getCharacter().position)).toBe(1)
  })

  it('놓은 뒤 자율 이동은 영역 안에서만 이뤄진다 (FR-011)', () => {
    const engine = create()
    engine.setUserControlled(true, 0)
    engine.moveTo({ x: 3000, y: 700 })
    engine.setUserControlled(false, 0)
    expect(engine.getCharacter().state).toBe('Idle')
    let now = 0
    for (let i = 0; i < 60 * 120; i++) {
      now += DT * 1000
      expect(area.contains(engine.tick(now, DT).position)).toBe(true)
    }
  })
})
