export type ContextMenuPorts = {
  /** 사용자 조작(메뉴 열림) 시작/종료를 시뮬레이션에 알린다 (001의 UserControlled) */
  setUserControlled(active: boolean): void
  openSettings(): void
}

/**
 * 우클릭 메뉴의 열림·닫힘 상태를 관리한다. Electron에 의존하지 않는다.
 * 메뉴가 열려 있는 동안 캐릭터를 멈추고(FR-003), 중복으로 열리지 않게 한다(FR-005).
 */
export class ContextMenuController {
  private open = false

  constructor(private readonly ports: ContextMenuPorts) {}

  /** @param popup 메뉴를 띄우고, 메뉴가 닫히면 인자로 받은 콜백을 호출한다 */
  handleContextMenu(popup: (onClosed: () => void) => void): void {
    if (this.open) return
    this.open = true
    this.ports.setUserControlled(true)
    try {
      popup(() => this.close())
    } catch (error) {
      this.close()
      throw error
    }
  }

  /** 메뉴의 "캐릭터 설정" 항목 선택 */
  selectSettings(): void {
    this.ports.openSettings()
  }

  private close(): void {
    if (!this.open) return
    this.open = false
    this.ports.setUserControlled(false)
  }
}
