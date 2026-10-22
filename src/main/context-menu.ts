import { Menu, type BrowserWindow } from 'electron'
import { ContextMenuController } from '../shared/context-menu-controller'

/** 오버레이 창의 우클릭(`context-menu`)을 네이티브 메뉴로 연결한다 (research R1·R2) */
export function attachContextMenu(win: BrowserWindow, controller: ContextMenuController): void {
  const menu = Menu.buildFromTemplate([
    { label: '캐릭터 설정', click: () => controller.selectSettings() }
  ])
  win.webContents.on('context-menu', (_event, params) => {
    controller.handleContextMenu((onClosed) =>
      menu.popup({ window: win, x: params.x, y: params.y, callback: onClosed })
    )
  })
}
