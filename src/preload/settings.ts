import { contextBridge, ipcRenderer } from 'electron'
import {
  CHANNEL_CHARACTERS_APPLY,
  CHANNEL_CHARACTERS_CHANGED,
  CHANNEL_CHARACTERS_DELETE,
  CHANNEL_CHARACTERS_LIST,
  CHANNEL_CHARACTERS_REGISTER,
  CHANNEL_CHARACTERS_VALIDATE
} from '../shared/ipc-settings'
import type { KakaruSettingsApi } from '../shared/ipc'

// 설정 창에 노출하는 API
const api: KakaruSettingsApi = {
  list: () => ipcRenderer.invoke(CHANNEL_CHARACTERS_LIST),
  validate: (input) => ipcRenderer.invoke(CHANNEL_CHARACTERS_VALIDATE, input),
  register: (input) => ipcRenderer.invoke(CHANNEL_CHARACTERS_REGISTER, input),
  apply: (id) => ipcRenderer.invoke(CHANNEL_CHARACTERS_APPLY, id),
  delete: (id) => ipcRenderer.invoke(CHANNEL_CHARACTERS_DELETE, id),
  onChanged(callback) {
    ipcRenderer.on(CHANNEL_CHARACTERS_CHANGED, () => callback())
  }
}

contextBridge.exposeInMainWorld('kakaruSettings', api)
