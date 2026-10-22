import { describe, expect, it, vi } from 'vitest'
import { ContextMenuController } from '../../src/shared/context-menu-controller'

function setup() {
  const calls: string[] = []
  const controller = new ContextMenuController({
    setUserControlled: (active) => calls.push(`control:${active}`),
    openSettings: () => calls.push('settings')
  })
  let onClosed: (() => void) | undefined
  const popup = vi.fn((closed: () => void) => {
    calls.push('popup')
    onClosed = closed
  })
  return { controller, calls, popup, close: () => onClosed?.() }
}

describe('ContextMenuController', () => {
  it('우클릭하면 이동을 멈추고 메뉴를 한 번 띄운다 (FR-001, FR-003)', () => {
    const { controller, calls, popup } = setup()
    controller.handleContextMenu(popup)
    expect(calls).toEqual(['control:true', 'popup'])
    expect(popup).toHaveBeenCalledTimes(1)
  })

  it('메뉴가 열려 있는 동안 들어온 우클릭은 무시한다 (FR-005)', () => {
    const { controller, calls, popup } = setup()
    controller.handleContextMenu(popup)
    controller.handleContextMenu(popup)
    expect(popup).toHaveBeenCalledTimes(1)
    expect(calls.filter((c) => c === 'control:true').length).toBe(1)
  })

  it('메뉴가 닫히면 이동을 재개하고 다시 열 수 있다', () => {
    const { controller, calls, popup, close } = setup()
    controller.handleContextMenu(popup)
    close()
    expect(calls).toEqual(['control:true', 'popup', 'control:false'])
    controller.handleContextMenu(popup)
    expect(popup).toHaveBeenCalledTimes(2)
  })

  it('닫힘 콜백이 여러 번 와도 재개는 한 번만 호출한다', () => {
    const { controller, calls, popup, close } = setup()
    controller.handleContextMenu(popup)
    close()
    close()
    expect(calls.filter((c) => c === 'control:false').length).toBe(1)
  })

  it('"캐릭터 설정"을 선택하면 설정 창을 열고, 이어 메뉴가 닫히면 재개한다', () => {
    const { controller, calls, popup, close } = setup()
    controller.handleContextMenu(popup)
    controller.selectSettings()
    close()
    expect(calls).toEqual(['control:true', 'popup', 'settings', 'control:false'])
  })

  it('메뉴를 띄우다 실패하면 이동을 재개하고 다시 열 수 있다', () => {
    const { controller, calls } = setup()
    const failing = vi.fn(() => {
      throw new Error('popup 실패')
    })
    expect(() => controller.handleContextMenu(failing)).toThrow('popup 실패')
    expect(calls).toEqual(['control:true', 'control:false'])
    const ok = vi.fn()
    controller.handleContextMenu(ok)
    expect(ok).toHaveBeenCalledTimes(1)
  })
})
