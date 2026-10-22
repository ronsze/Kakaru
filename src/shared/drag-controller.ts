import type { Point } from './types'

export type DragPorts = {
  getCursor(): Point
  getPosition(): Point
  /** 우클릭 메뉴가 열려 있으면 잡지 않는다 */
  isMenuOpen(): boolean
  /** 사용자 조작(잡기) 시작/종료를 시뮬레이션에 알린다 (001의 UserControlled) */
  setUserControlled(active: boolean): void
  /** 캐릭터 위치를 옮긴다 (영역 보정은 받는 쪽이 한다) */
  moveTo(position: Point): void
}

/**
 * 캐릭터 드래그(잡기) 상태를 관리한다. Electron에 의존하지 않는다.
 * 잡은 순간의 오프셋(캐릭터 위치 − 커서)을 유지하며 매 틱 커서를 따라간다.
 */
export class DragController {
  private grabbed = false
  private offset: Point = { x: 0, y: 0 }

  constructor(private readonly ports: DragPorts) {}

  get active(): boolean {
    return this.grabbed
  }

  start(): void {
    if (this.grabbed || this.ports.isMenuOpen()) return
    const cursor = this.ports.getCursor()
    const position = this.ports.getPosition()
    this.offset = { x: position.x - cursor.x, y: position.y - cursor.y }
    this.grabbed = true
    this.ports.setUserControlled(true)
  }

  /** 매 틱 호출한다 */
  update(): void {
    if (!this.grabbed) return
    const cursor = this.ports.getCursor()
    this.ports.moveTo({ x: cursor.x + this.offset.x, y: cursor.y + this.offset.y })
  }

  /** 멱등: 잡혀 있지 않으면 아무 일도 하지 않는다 */
  end(): void {
    if (!this.grabbed) return
    this.grabbed = false
    this.ports.setUserControlled(false)
  }
}
