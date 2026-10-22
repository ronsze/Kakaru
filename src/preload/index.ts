import { contextBridge, ipcRenderer } from 'electron'
import {
  CHANNEL_APPEARANCE,
  CHANNEL_CHARACTER_UPDATE,
  CHANNEL_GRAB_END,
  CHANNEL_GRAB_START,
  type Appearance,
  type CharacterUpdate,
  type KakaruApi
} from '../shared/ipc'

const api: KakaruApi = {
  onCharacterUpdate(callback) {
    ipcRenderer.on(CHANNEL_CHARACTER_UPDATE, (_event, update: CharacterUpdate) => callback(update))
  },
  onAppearance(callback) {
    ipcRenderer.on(CHANNEL_APPEARANCE, (_event, appearance: Appearance) => callback(appearance))
  },
  grabStart() {
    ipcRenderer.send(CHANNEL_GRAB_START)
  },
  grabEnd() {
    ipcRenderer.send(CHANNEL_GRAB_END)
  }
}

contextBridge.exposeInMainWorld('kakaru', api)
