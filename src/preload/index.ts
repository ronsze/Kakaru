import { contextBridge, ipcRenderer } from 'electron'
import {
  CHANNEL_APPEARANCE,
  CHANNEL_CHARACTER_UPDATE,
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
  }
}

contextBridge.exposeInMainWorld('kakaru', api)
