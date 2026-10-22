import { join } from 'node:path'
import { BrowserWindow, screen, type Display } from 'electron'
import { getPlatformAdapter } from './platform'

export type OverlayOptions = {
  /** 오버레이 창을 새로 만들 때마다 호출된다 (우클릭 메뉴 연결 등) */
  onCreate?: (win: BrowserWindow) => void
}

/** 디스플레이마다 하나씩 두는 투명 오버레이 창을 관리한다. */
export class OverlayManager {
  private readonly windows = new Map<number, BrowserWindow>()

  constructor(private readonly options: OverlayOptions = {}) {}

  /** 현재 연결된 디스플레이에 맞춰 창을 만들고, 사라진 디스플레이의 창은 닫는다. */
  sync(): void {
    const displays = screen.getAllDisplays()
    const alive = new Set(displays.map((d) => d.id))
    for (const [id, win] of this.windows) {
      if (!alive.has(id)) {
        win.destroy()
        this.windows.delete(id)
      }
    }
    for (const display of displays) {
      const existing = this.windows.get(display.id)
      if (existing) existing.setBounds(display.bounds)
      else this.windows.set(display.id, this.create(display))
    }
  }

  get(displayId: number): BrowserWindow | undefined {
    return this.windows.get(displayId)
  }

  all(): [number, BrowserWindow][] {
    return [...this.windows]
  }

  private create(display: Display): BrowserWindow {
    const win = new BrowserWindow({
      ...display.bounds,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
      resizable: false,
      enableLargerThanScreen: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true
      }
    })
    // 기본은 모든 클릭을 아래 창으로 통과시킨다 (FR-005)
    win.setIgnoreMouseEvents(true)
    getPlatformAdapter().configureOverlay(win)
    win.setBounds(display.bounds)
    const devUrl = process.env['ELECTRON_RENDERER_URL']
    if (devUrl) void win.loadURL(devUrl)
    else void win.loadFile(join(__dirname, '../renderer/index.html'))
    win.once('ready-to-show', () => win.showInactive())
    this.options.onCreate?.(win)
    return win
  }
}
