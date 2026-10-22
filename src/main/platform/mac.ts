import type { PlatformAdapter } from './index'

export const macAdapter: PlatformAdapter = {
  configureOverlay(win) {
    win.setAlwaysOnTop(true, 'screen-saver')
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }
}
