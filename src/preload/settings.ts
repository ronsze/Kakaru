import { contextBridge, ipcRenderer } from 'electron'
import {
  CHANNEL_CHARACTERS_CHANGED,
  CHANNEL_CHARACTERS_LIST,
  CHANNEL_CHARACTERS_REGISTER,
  CHANNEL_CHARACTERS_VALIDATE
} from '../shared/ipc-settings'
import type { KakaruSettingsApi } from '../shared/ipc'

// 설정 창에 노출하는 API. apply/delete는 US3에서 추가한다.
const api: Pick<KakaruSettingsApi, 'list' | 'validate' | 'register' | 'onChanged'> = {
  list: () => ipcRenderer.invoke(CHANNEL_CHARACTERS_LIST),
  validate: (input) => ipcRenderer.invoke(CHANNEL_CHARACTERS_VALIDATE, input),
  register: (input) => ipcRenderer.invoke(CHANNEL_CHARACTERS_REGISTER, input),
  onChanged(callback) {
    ipcRenderer.on(CHANNEL_CHARACTERS_CHANGED, () => callback())
  }
}

contextBridge.exposeInMainWorld('kakaruSettings', api)
