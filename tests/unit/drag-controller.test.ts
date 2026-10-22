import { describe, expect, it } from 'vitest'
import { WalkableArea } from '../../src/shared/area'
import { MovementEngine } from '../../src/shared/behavior'
import { DragController } from '../../src/shared/drag-controller'
import type { Point } from '../../src/shared/types'
import { seededRandom } from './helpers'

function setup(menuOpen = false) {
  const calls: string[] = []
  const state = { cursor: { x: 110, y: 120 } as Point, position: { x: 100, y: 100 } as Point, menuOpen }
  const moves: Point[] = []
  const drag = new DragController({
    getCursor: () => state.cursor,
    getPosition: () => state.position,
    isMenuOpen: () => state.menuOpen,
    setUserControlled: (active) => calls.push(`control:${active}`),
    moveTo: (p) => {
      moves.push(p)
      state.position = p
    }
  })
  return { drag, calls, state, moves }
}

describe('DragController', () => {
  it('start는 이동을 멈추고 잡은 상태가 된다', () => {
    const { drag, calls } = setup()
    drag.start()
    expect(drag.active).toBe(true)
    expect(calls).toEqual(['control:true'])
  })

  it('update는 잡은 지점의 오프셋을 유지하며 커서를 따라간다 (FR-003)', () => {
    const { drag, state, moves } = setup()
    drag.start() // 오프셋 = (-10, -20)
    state.cursor = { x: 510, y: 320 }
    drag.update()
    expect(moves.at(-1)).toEqual({ x: 500, y: 300 })
  })

  it('움직임 없이 update해도 위치는 그대로다 (FR-006)', () => {
    const { drag, state } = setup()
    drag.start()
    drag.update()
    expect(state.position).toEqual({ x: 100, y: 100 })
  })

  it('end는 이동을 재개하고, 잡혀 있지 않으면 무시한다 (멱등)', () => {
    const { drag, calls } = setup()
    drag.end()
    expect(calls).toEqual([])
    drag.start()
    drag.end()
    drag.end()
    expect(drag.active).toBe(false)
    expect(calls).toEqual(['control:true', 'control:false'])
  })

  it('메뉴가 열려 있거나 이미 잡혀 있으면 start를 무시한다', () => {
    const open = setup(true)
    open.drag.start()
    expect(open.drag.active).toBe(false)
    expect(open.calls).toEqual([])

    const twice = setup()
    twice.drag.start()
    twice.drag.start()
    expect(twice.calls).toEqual(['control:true'])
  })

  it('잡혀 있지 않으면 update는 아무것도 하지 않는다', () => {
    const { drag, moves } = setup()
    drag.update()
    expect(moves).toEqual([])
  })

  it('실제 엔진과 결합: 영역 밖 커서에서도 디스플레이 안에 머물고 다른 디스플레이로 넘어간다 (US2)', () => {
    const area = new WalkableArea([
      { x: 0, y: 0, width: 1000, height: 800 },
      { x: 1000, y: 0, width: 1000, height: 800 }
    ])
    const engine = new MovementEngine({ area, random: seededRandom(3), startAt: 0 })
    let cursor: Point = engine.getCharacter().position
    const drag = new DragController({
      getCursor: () => cursor,
      getPosition: () => engine.getCharacter().position,
      isMenuOpen: () => false,
      setUserControlled: (active) => engine.setUserControlled(active, 0),
      moveTo: (p) => engine.moveTo(p)
    })
    drag.start()
    cursor = { x: -500, y: -500 }
    drag.update()
    expect(engine.getCharacter().position).toEqual({ x: 0, y: 0 })
    cursor = { x: 1500, y: 400 }
    drag.update()
    expect(area.displayAt(engine.getCharacter().position)).toBe(1)
    drag.end()
    expect(engine.getCharacter().state).toBe('Idle')
  })
})
