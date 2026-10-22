import { describe, expect, it, vi } from 'vitest'
import { ContextMenuController } from '../../src/shared/context-menu-controller'

function setup(blocked = false) {
  const calls: string[] = []
  const controller = new ContextMenuController({
    setUserControlled: (active) => calls.push(`control:${active}`),
    openSettings: () => calls.push('settings'),
    zoom: () => undefined,
    zoomState: () => ({ canZoomIn: true, canZoomOut: true }),
    quit: () => undefined,
    isBlocked: () => blocked
  })
  let onClosed: (() => void) | undefined
  const popup = vi.fn((closed: () => void) => {
    calls.push('popup')
    onClosed = closed
  })
  return { controller, calls, popup, close: () => onClosed?.() }
}

describe('ContextMenuController', () => {
  it('드래그 중(차단)이면 메뉴를 열지 않고 이동 상태도 건드리지 않는다 (FR-009)', () => {
    const { controller, calls, popup } = setup(true)
    controller.handleContextMenu(popup)
    expect(popup).not.toHaveBeenCalled()
    expect(calls).toEqual([])
  })

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

describe('ContextMenuController 확대·축소·종료', () => {
  function setupActions() {
    const calls: string[] = []
    const controller = new ContextMenuController({
      setUserControlled: () => undefined,
      openSettings: () => calls.push('settings'),
      zoom: (direction) => calls.push(`zoom:${direction}`),
      zoomState: () => ({ canZoomIn: true, canZoomOut: false }),
      quit: () => calls.push('quit'),
      isBlocked: () => false
    })
    return { controller, calls }
  }

  it('"확대"는 +1, "축소"는 -1 방향으로 크기 변경을 요청한다', () => {
    const { controller, calls } = setupActions()
    controller.selectZoomIn()
    controller.selectZoomOut()
    expect(calls).toEqual(['zoom:1', 'zoom:-1'])
  })

  it('"종료"를 선택하면 앱 종료를 요청한다', () => {
    const { controller, calls } = setupActions()
    controller.selectQuit()
    expect(calls).toEqual(['quit'])
  })

  it('메뉴를 열 때의 확대·축소 가능 여부를 알려 준다', () => {
    const { controller } = setupActions()
    expect(controller.zoomState()).toEqual({ canZoomIn: true, canZoomOut: false })
  })
})
