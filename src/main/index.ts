import { app } from 'electron'
import { createHitTest } from './hit-test'
import { OverlayManager } from './overlay'
import { startSimulation, stopSimulation } from './simulation'

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// 상시 실행 앱이므로 모든 창이 닫혀도 종료하지 않는다.
app.on('window-all-closed', () => {})
app.on('before-quit', stopSimulation)

app.whenReady().then(() => {
  if (process.platform === 'darwin') app.dock?.hide()
  const overlays = new OverlayManager()
  overlays.sync()
  // visibleOnFullScreen 설정이 Dock 아이콘을 다시 보이게 할 수 있어 창 생성 뒤 한 번 더 숨긴다
  if (process.platform === 'darwin') app.dock?.hide()
  startSimulation(overlays, createHitTest(overlays))
})
