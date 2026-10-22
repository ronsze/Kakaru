import { ipcMain, nativeImage } from 'electron'
import type { ImageInspector } from '../shared/characters'
import {
  CHANNEL_CHARACTERS_CHANGED,
  CHANNEL_CHARACTERS_LIST,
  CHANNEL_CHARACTERS_REGISTER,
  CHANNEL_CHARACTERS_VALIDATE
} from '../shared/ipc-settings'
import type { RegisterInput } from '../shared/ipc'
import type { CharacterService } from './characters-service'
import { getSettingsWindow } from './settings-window'

/** nativeImage로 이미지를 디코딩해 알파 값이 255가 아닌 픽셀이 있는지 확인한다 (research R6) */
export const nativeImageInspector: ImageInspector = {
  hasTransparentPixels(bytes) {
    const image = nativeImage.createFromBuffer(Buffer.from(bytes))
    if (image.isEmpty()) return 'corrupt'
    const bitmap = image.toBitmap() // BGRA, 픽셀당 4바이트
    for (let i = 3; i < bitmap.length; i += 4) {
      if (bitmap[i] !== 255) return true
    }
    return false
  }
}

/** 설정 창이 열려 있으면 목록·활성 캐릭터가 바뀌었다고 알린다 */
export function notifyCharactersChanged(): void {
  getSettingsWindow()?.webContents.send(CHANNEL_CHARACTERS_CHANGED)
}

/** 렌더러가 보낸 값이 RegisterInput 모양인지 확인한다 (렌더러를 신뢰하지 않는다) */
function assertRegisterInput(value: unknown): RegisterInput {
  const v = value as Partial<RegisterInput> | null
  if (!v || typeof v.name !== 'string' || typeof v.frames !== 'number') {
    throw new Error('등록 요청 형식이 올바르지 않습니다.')
  }
  return v as RegisterInput
}

export function registerCharactersIpc(service: CharacterService): void {
  ipcMain.handle(CHANNEL_CHARACTERS_LIST, () => service.list())
  ipcMain.handle(CHANNEL_CHARACTERS_VALIDATE, (_event, input: unknown) =>
    service.validate(assertRegisterInput(input))
  )
  ipcMain.handle(CHANNEL_CHARACTERS_REGISTER, (_event, input: unknown) => {
    const result = service.register(assertRegisterInput(input))
    if (result.ok) notifyCharactersChanged()
    return result
  })
}
