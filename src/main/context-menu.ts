import { Menu, type BrowserWindow } from 'electron'
import { ContextMenuController } from '../shared/context-menu-controller'

/** 열 때마다 확대·축소 가능 여부를 반영해 메뉴를 만든다 */
function buildMenu(controller: ContextMenuController): Menu {
  const { canZoomIn, canZoomOut } = controller.zoomState()
  return Menu.buildFromTemplate([
    { label: '확대', enabled: canZoomIn, click: () => controller.selectZoomIn() },
    { label: '축소', enabled: canZoomOut, click: () => controller.selectZoomOut() },
    { type: 'separator' },
    { label: '캐릭터 설정', click: () => controller.selectSettings() },
    { type: 'separator' },
    { label: '종료', click: () => controller.selectQuit() }
  ])
}

/** 오버레이 창의 우클릭(`context-menu`)을 네이티브 메뉴로 연결한다 (research R1·R2) */
export function attachContextMenu(win: BrowserWindow, controller: ContextMenuController): void {
  win.webContents.on('context-menu', (_event, params) => {
    controller.handleContextMenu((onClosed) =>
      buildMenu(controller).popup({ window: win, x: params.x, y: params.y, callback: onClosed })
    )
  })
}
