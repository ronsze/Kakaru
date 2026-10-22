import { join } from 'node:path'
import { app, BrowserWindow } from 'electron'

let settingsWindow: BrowserWindow | null = null

/** 열려 있는 설정 창 (없으면 null). 변경 알림을 보낼 때 쓴다. */
export function getSettingsWindow(): BrowserWindow | null {
  return settingsWindow && !settingsWindow.isDestroyed() ? settingsWindow : null
}

/** 캐릭터 설정 창을 연다. 이미 열려 있으면 새로 만들지 않고 앞으로 가져온다. 닫으면 파괴한다. */
export function openSettingsWindow(): BrowserWindow {
  const existing = getSettingsWindow()
  if (existing) {
    if (existing.isMinimized()) existing.restore()
    existing.show()
    existing.focus()
    return existing
  }

  const win = new BrowserWindow({
    width: 720,
    height: 560,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '캐릭터 설정',
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/settings.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  settingsWindow = win
  win.on('closed', () => {
    if (settingsWindow === win) settingsWindow = null
  })

  const devUrl = process.env['ELECTRON_RENDERER_URL']
  if (devUrl) void win.loadURL(`${devUrl}/settings.html`)
  else void win.loadFile(join(__dirname, '../renderer/settings.html'))

  win.once('ready-to-show', () => {
    // Dock에 보이지 않는 앱(macOS)은 직접 앞으로 가져와야 입력을 받을 수 있다
    if (process.platform === 'darwin') app.focus({ steal: true })
    win.show()
    win.focus()
  })
  return win
}
