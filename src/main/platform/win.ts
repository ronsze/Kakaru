import type { PlatformAdapter } from './index'

export const winAdapter: PlatformAdapter = {
  configureOverlay(win) {
    win.setAlwaysOnTop(true, 'screen-saver')
  }
}
