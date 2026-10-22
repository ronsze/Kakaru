import { describe, expect, it } from 'vitest'
import { HitTester, isCursorOnCharacter } from '../../src/shared/hit'
import { WalkableArea } from '../../src/shared/area'
import type { Character, Point } from '../../src/shared/types'

function character(position: Point, state: Character['state'] = 'Idle'): Character {
  return {
    position,
    heading: 1,
    velocity: { x: 0, y: 0 },
    state,
    target: null,
    stateUntil: 0,
    hitRadius: 40
  }
}

describe('isCursorOnCharacter', () => {
  it('hitRadius 이내이면 true', () => {
    expect(isCursorOnCharacter({ x: 110, y: 100 }, character({ x: 100, y: 100 }))).toBe(true)
    expect(isCursorOnCharacter({ x: 140, y: 100 }, character({ x: 100, y: 100 }))).toBe(true)
  })

  it('경계 바로 밖이면 false', () => {
    expect(isCursorOnCharacter({ x: 140.01, y: 100 }, character({ x: 100, y: 100 }))).toBe(false)
  })

  it('다른 디스플레이 좌표(가상 데스크탑 좌표)에서도 판정한다', () => {
    const c = character({ x: 2500, y: -300 })
    expect(isCursorOnCharacter({ x: 2510, y: -310 }, c)).toBe(true)
    expect(isCursorOnCharacter({ x: 100, y: 100 }, c)).toBe(false)
  })
})

describe('HitTester', () => {
  const area = new WalkableArea([
    { x: 0, y: 0, width: 1000, height: 600 },
    { x: 1000, y: 0, width: 1000, height: 600 }
  ])
  const displayIds = [11, 22]

  function setup(c: Character, cursor: Point) {
    const calls: [number, boolean][] = []
    const state = { cursor, c }
    const tester = new HitTester({
      getCursor: () => state.cursor,
      getCharacter: () => ({ character: state.c, area, displayIds }),
      setIgnore: (id, ignore) => calls.push([id, ignore])
    })
    return { tester, calls, state }
  }

  it('캐릭터 밖이면 모든 창이 클릭을 통과시킨다 (FR-005)', () => {
    const { tester, calls } = setup(character({ x: 500, y: 300 }), { x: 900, y: 500 })
    tester.update()
    expect(calls).toEqual([[11, true], [22, true]])
  })

  it('커서가 캐릭터 위에 있으면 캐릭터가 있는 디스플레이의 창만 통과를 해제한다', () => {
    const { tester, calls } = setup(character({ x: 1500, y: 300 }), { x: 1510, y: 300 })
    tester.update()
    expect(calls).toEqual([[11, true], [22, false]])
  })

  it('값이 바뀔 때만 setIgnore를 호출한다', () => {
    const { tester, calls, state } = setup(character({ x: 500, y: 300 }), { x: 900, y: 500 })
    tester.update()
    tester.update()
    expect(calls.length).toBe(2)
    state.cursor = { x: 510, y: 300 }
    tester.update()
    expect(calls.slice(2)).toEqual([[11, false]])
    tester.update()
    expect(calls.length).toBe(3)
  })

  it('커서가 캐릭터를 벗어나면 다시 통과시킨다', () => {
    const { tester, calls, state } = setup(character({ x: 500, y: 300 }), { x: 510, y: 300 })
    tester.update()
    state.cursor = { x: 900, y: 500 }
    tester.update()
    expect(calls.slice(-1)).toEqual([[11, true]])
  })

  it('사용자 조작 중에는 커서가 벗어나도 해제 상태를 유지한다', () => {
    const { tester, calls, state } = setup(
      character({ x: 500, y: 300 }, 'UserControlled'),
      { x: 900, y: 500 }
    )
    tester.update()
    expect(calls).toEqual([[11, false], [22, true]])
    state.cursor = { x: 1900, y: 500 }
    tester.update()
    expect(calls.length).toBe(2)
  })
})
