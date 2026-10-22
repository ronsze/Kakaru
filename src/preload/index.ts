import { contextBridge, ipcRenderer } from 'electron'
import { CHANNEL_CHARACTER_UPDATE, type CharacterUpdate, type KakaruApi } from '../shared/ipc'

const api: KakaruApi = {
  onCharacterUpdate(callback) {
    ipcRenderer.on(CHANNEL_CHARACTER_UPDATE, (_event, update: CharacterUpdate) => callback(update))
  }
}

contextBridge.exposeInMainWorld('kakaru', api)
