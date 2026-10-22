import { join } from 'node:path'
import { app, type BrowserWindow } from 'electron'
import { ContextMenuController } from '../shared/context-menu-controller'
import { CHANNEL_APPEARANCE } from '../shared/ipc'
import { CharacterService, type SampleCharacter } from './characters-service'
import { CharacterStore } from './characters-store'
import { nativeImageInspector, registerCharactersIpc } from './characters-ipc'
import { attachContextMenu } from './context-menu'
import { registerDragIpc } from './drag-ipc'
import { createHitTest } from './hit-test'
import { OverlayManager } from './overlay'
import { openSettingsWindow } from './settings-window'
import {
  isGrabbed,
  setCharacterScale,
  setMenuOpen,
  setUserControlled,
  startSimulation,
  stopSimulation
} from './simulation'

/** 처음 실행 때 등록된 캐릭터로 넣어 두는 샘플 (기본 캐릭터는 폴리곤 고양이) */
const SAMPLES: SampleCharacter[] = [
  {
    key: 'bmm',
    name: '빨간 모자',
    frames: 4,
    frameSize: 200,
    dir: join(app.getAppPath(), 'resources', 'characters', 'bmm')
  },
  {
    key: 'me',
    name: '나',
    frames: 8,
    frameSize: 200,
    dir: join(app.getAppPath(), 'resources', 'characters', 'me')
  }
]

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
  characters.installSamples(SAMPLES)
  // 활성 캐릭터의 모습. 오버레이 창이 로드를 마칠 때마다, 그리고 바뀔 때마다 보낸다.
  let appearance = characters.appearance()
  const sendAppearance = (win: BrowserWindow) => win.webContents.send(CHANNEL_APPEARANCE, appearance)

  /** 활성 캐릭터·크기가 바뀌었을 수 있을 때 오버레이에 새 모습을 보내고 히트 영역을 맞춘다 */
  const refreshAppearance = () => {
    appearance = characters.appearance()
    setCharacterScale(appearance.scale)
    for (const [, win] of overlays.all()) if (!win.isDestroyed()) sendAppearance(win)
  }

  const menu = new ContextMenuController({
    setUserControlled: (active) => {
      setMenuOpen(active)
      setUserControlled(active)
    },
    isBlocked: isGrabbed,
    openSettings: openSettingsWindow,
    zoom: (direction) => {
      characters.zoom(direction)
      refreshAppearance()
    },
    zoomState: () => characters.zoomState(),
    quit: () => app.quit()
  })
  const overlays = new OverlayManager({
    onCreate: (win) => {
      attachContextMenu(win, menu)
      win.webContents.on('did-finish-load', () => sendAppearance(win))
    }
  })
  registerDragIpc()
  registerCharactersIpc(characters, { onAppearanceChanged: refreshAppearance })
  overlays.sync()
  // visibleOnFullScreen 설정이 Dock 아이콘을 다시 보이게 할 수 있어 창 생성 뒤 한 번 더 숨긴다
  if (process.platform === 'darwin') app.dock?.hide()
  startSimulation(overlays, createHitTest(overlays))
  setCharacterScale(appearance.scale)

  // 개발·테스트용: 시작하자마자 설정 창을 연다
  if (process.argv.includes('--open-settings')) openSettingsWindow()
})
