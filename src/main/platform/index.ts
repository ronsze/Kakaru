import type { BrowserWindow } from 'electron'
import { macAdapter } from './mac'
import { winAdapter } from './win'

/** OS별 창 설정 차이를 감추는 어댑터 */
export interface PlatformAdapter {
  /** 오버레이 창을 항상 위, 전체 화면 앱 위에도 보이도록 설정한다 */
  configureOverlay(win: BrowserWindow): void
}

const fallback: PlatformAdapter = {
  configureOverlay(win) {
    win.setAlwaysOnTop(true, 'screen-saver')
  }
}

export function getPlatformAdapter(platform: NodeJS.Platform = process.platform): PlatformAdapter {
  if (platform === 'darwin') return macAdapter
  if (platform === 'win32') return winAdapter
  return fallback
}
