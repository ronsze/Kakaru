import { ipcMain } from 'electron'
import { CHANNEL_GRAB_END, CHANNEL_GRAB_START } from '../shared/ipc'
import { endGrab, startGrab } from './simulation'

/** 렌더러의 잡기 시작·끝 알림을 시뮬레이션에 연결한다 (드래그 이동) */
export function registerDragIpc(): void {
  ipcMain.on(CHANNEL_GRAB_START, () => startGrab())
  ipcMain.on(CHANNEL_GRAB_END, () => endGrab())
}
