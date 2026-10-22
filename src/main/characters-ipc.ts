import { readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { basename } from 'node:path'
import { dialog, ipcMain, nativeImage } from 'electron'
import { LIMITS, type ImageInspector } from '../shared/characters'
import {
  CHANNEL_CHARACTERS_APPLY,
  CHANNEL_CHARACTERS_CHANGED,
  CHANNEL_CHARACTERS_DELETE,
  CHANNEL_CHARACTERS_EXPORT,
  CHANNEL_CHARACTERS_IMPORT,
  CHANNEL_CHARACTERS_LIST,
  CHANNEL_CHARACTERS_REGISTER,
  CHANNEL_CHARACTERS_VALIDATE,
  CHANNEL_LINES_GET,
  CHANNEL_LINES_RESTORE,
  CHANNEL_LINES_SAVE
} from '../shared/ipc-settings'
import type { ExportResult, ImportResult, RegisterInput } from '../shared/ipc'
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

export type CharactersIpcHooks = {
  /** 활성 캐릭터가 바뀌었을 수 있을 때(선택·삭제 후) 호출된다. 오버레이에 새 모습을 보낸다. */
  onAppearanceChanged(): void
}

/** 저장 대화상자로 위치를 받아 파일을 쓴다. 임시 파일에 쓴 뒤 이름을 바꾸므로 실패해도 기존 파일은 그대로다 */
async function exportCharacter(service: CharacterService, id: unknown): Promise<ExportResult> {
  if (typeof id !== 'string') return { ok: false, message: '기본 캐릭터는 내보낼 수 없습니다.' }
  const built = service.exportPackage(id)
  if (!built.ok) return built
  const options = {
    title: '캐릭터 내보내기',
    defaultPath: built.suggestedFileName,
    filters: [{ name: 'Kakaru 캐릭터', extensions: ['kakaru'] }]
  }
  const parent = getSettingsWindow()
  const picked = parent ? await dialog.showSaveDialog(parent, options) : await dialog.showSaveDialog(options)
  if (picked.canceled || !picked.filePath) return { ok: false, canceled: true }
  const tmp = `${picked.filePath}.tmp`
  try {
    writeFileSync(tmp, built.content)
    renameSync(tmp, picked.filePath)
  } catch (error) {
    rmSync(tmp, { force: true })
    return { ok: false, message: `저장하지 못했습니다: ${error instanceof Error ? error.message : String(error)}` }
  }
  return { ok: true, fileName: basename(picked.filePath) }
}

/** 열기 대화상자로 파일을 받아 새 캐릭터로 등록한다. 큰 파일은 읽기 전에 거부한다 */
async function importCharacter(service: CharacterService): Promise<ImportResult> {
  const options = {
    title: '캐릭터 가져오기',
    properties: ['openFile' as const],
    filters: [
      { name: 'Kakaru 캐릭터', extensions: ['kakaru'] },
      { name: '모든 파일', extensions: ['*'] }
    ]
  }
  const parent = getSettingsWindow()
  const picked = parent ? await dialog.showOpenDialog(parent, options) : await dialog.showOpenDialog(options)
  const path = picked.filePaths[0]
  if (picked.canceled || !path) return { ok: false, canceled: true }
  let text: string
  try {
    if (statSync(path).size > LIMITS.maxPackageBytes) {
      const mb = LIMITS.maxPackageBytes / (1024 * 1024)
      return { ok: false, message: `파일이 너무 큽니다. ${mb}MB 이하여야 합니다.`, details: [] }
    }
    text = readFileSync(path, 'utf8')
  } catch (error) {
    return { ok: false, message: `파일을 읽지 못했습니다: ${error instanceof Error ? error.message : String(error)}`, details: [] }
  }
  let result: ImportResult
  try {
    result = service.importPackage(text)
  } catch {
    return { ok: false, message: '등록하지 못했습니다. 다시 시도하세요.', details: [] }
  }
  // 활성 캐릭터는 바뀌지 않으므로 오버레이에는 알리지 않고 설정 창 목록만 갱신한다
  if (result.ok) notifyCharactersChanged()
  return result
}

export function registerCharactersIpc(service: CharacterService, hooks: CharactersIpcHooks): void {
  ipcMain.handle(CHANNEL_CHARACTERS_LIST, () => service.list())
  ipcMain.handle(CHANNEL_CHARACTERS_VALIDATE, (_event, input: unknown) =>
    service.validate(assertRegisterInput(input))
  )
  ipcMain.handle(CHANNEL_CHARACTERS_REGISTER, (_event, input: unknown) => {
    const result = service.register(assertRegisterInput(input))
    if (result.ok) notifyCharactersChanged()
    return result
  })
  ipcMain.handle(CHANNEL_CHARACTERS_IMPORT, () => importCharacter(service))
  ipcMain.handle(CHANNEL_CHARACTERS_EXPORT, (_event, id: unknown) => exportCharacter(service, id))
  ipcMain.handle(CHANNEL_CHARACTERS_APPLY, (_event, id: unknown) => {
    if (id !== null && typeof id !== 'string') return { ok: false, message: '요청 형식이 올바르지 않습니다.' }
    const result = service.apply(id)
    if (result.ok) {
      hooks.onAppearanceChanged()
      notifyCharactersChanged()
    }
    return result
  })
  const lineTarget = (id: unknown): string | null | undefined =>
    id === null || typeof id === 'string' ? id : undefined
  ipcMain.handle(CHANNEL_LINES_GET, (_event, id: unknown) => {
    const target = lineTarget(id)
    return target === undefined ? { ok: false, message: '요청 형식이 올바르지 않습니다.' } : service.getLines(target)
  })
  ipcMain.handle(CHANNEL_LINES_SAVE, (_event, id: unknown, input: unknown) => {
    const target = lineTarget(id)
    return target === undefined ? { ok: false, message: '요청 형식이 올바르지 않습니다.' } : service.saveLines(target, input)
  })
  ipcMain.handle(CHANNEL_LINES_RESTORE, (_event, id: unknown) => {
    const target = lineTarget(id)
    return target === undefined ? { ok: false, message: '요청 형식이 올바르지 않습니다.' } : service.restoreLines(target)
  })
  ipcMain.handle(CHANNEL_CHARACTERS_DELETE, (_event, id: unknown) => {
    if (typeof id !== 'string') return { ok: false, message: '기본 캐릭터는 삭제할 수 없습니다.' }
    const result = service.delete(id)
    if (result.ok) {
      hooks.onAppearanceChanged()
      notifyCharactersChanged()
    }
    return result
  })
}
