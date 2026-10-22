import type { WalkableArea } from './area'
import type { Character, Point } from './types'

/** 커서(가상 데스크탑 좌표)가 캐릭터 히트 영역 안에 있는지 */
export function isCursorOnCharacter(
  cursor: Point,
  character: Pick<Character, 'position' | 'hitRadius'>
): boolean {
  return (
    Math.hypot(cursor.x - character.position.x, cursor.y - character.position.y) <=
    character.hitRadius
  )
}

export type HitPorts = {
  getCursor(): Point
  getCharacter(): { character: Character; area: WalkableArea; displayIds: number[] }
  /** displayId의 오버레이 창이 클릭을 통과시킬지 설정 */
  setIgnore(displayId: number, ignore: boolean): void
}

/**
 * 오버레이 창의 클릭 통과 상태를 결정한다 (research R2).
 * 기본은 모든 창 통과, 커서가 캐릭터 위(또는 사용자 조작 중)일 때만 캐릭터가 있는 창을 해제한다.
 * Electron에 의존하지 않도록 입출력은 ports로 주입한다.
 */
export class HitTester {
  private readonly applied = new Map<number, boolean>()

  constructor(private readonly ports: HitPorts) {}

  update(): void {
    const { character, area, displayIds } = this.ports.getCharacter()
    const index = area.displayAt(character.position)
    const grabbed =
      character.state === 'UserControlled' ||
      isCursorOnCharacter(this.ports.getCursor(), character)
    const releasedId = index !== null && grabbed ? displayIds[index] : null
    for (const id of displayIds) {
      const ignore = id !== releasedId
      if (this.applied.get(id) !== ignore) {
        this.applied.set(id, ignore)
        this.ports.setIgnore(id, ignore)
      }
    }
  }
}
