import { app, type BrowserWindow } from 'electron'
import { ContextMenuController } from '../shared/context-menu-controller'
import { CHANNEL_APPEARANCE } from '../shared/ipc'
import { CharacterService } from './characters-service'
import { CharacterStore } from './characters-store'
import { nativeImageInspector, registerCharactersIpc } from './characters-ipc'
import { attachContextMenu } from './context-menu'
import { createHitTest } from './hit-test'
import { OverlayManager } from './overlay'
import { openSettingsWindow } from './settings-window'
import { setUserControlled, startSimulation, stopSimulation } from './simulation'

// 테스트·개발에서 저장 데이터와 단일 인스턴스 잠금을 실제 사용자 데이터와 분리한다
if (process.env.KAKARU_USER_DATA) app.setPath('userData', process.env.KAKARU_USER_DATA)

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// 상시 실행 앱이므로 모든 창이 닫혀도 종료하지 않는다.
app.on('window-all-closed', () => {})
app.on('before-quit', stopSimulation)

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()

  const store = new CharacterStore(app.getPath('userData'))
  store.load()
  const characters = new CharacterService(store, nativeImageInspector)
  // 활성 캐릭터의 모습. 오버레이 창이 로드를 마칠 때마다, 그리고 바뀔 때마다 보낸다.
  let appearance = characters.appearance()
  const sendAppearance = (win: BrowserWindow) => win.webContents.send(CHANNEL_APPEARANCE, appearance)

  const menu = new ContextMenuController({ setUserControlled, openSettings: openSettingsWindow })
  const overlays = new OverlayManager({
    onCreate: (win) => {
      attachContextMenu(win, menu)
      win.webContents.on('did-finish-load', () => sendAppearance(win))
    }
  })
  registerCharactersIpc(characters, {
    onAppearanceChanged: () => {
      appearance = characters.appearance()
      for (const [, win] of overlays.all()) if (!win.isDestroyed()) sendAppearance(win)
    }
  })
  overlays.sync()
  // visibleOnFullScreen 설정이 Dock 아이콘을 다시 보이게 할 수 있어 창 생성 뒤 한 번 더 숨긴다
  if (process.platform === 'darwin') app.dock?.hide()
  startSimulation(overlays, createHitTest(overlays))

  // 개발·테스트용: 시작하자마자 설정 창을 연다
  if (process.argv.includes('--open-settings')) openSettingsWindow()
})
