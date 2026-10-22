import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { ID_PATTERN, LIMITS, type CharacterSet, type Settings } from '../shared/characters'

const SETTINGS_FILE = 'settings.json'

function isCharacterSet(v: unknown): v is CharacterSet {
  if (typeof v !== 'object' || v === null) return false
  const c = v as Record<string, unknown>
  return (
    typeof c.id === 'string' &&
    ID_PATTERN.test(c.id) &&
    typeof c.name === 'string' &&
    Number.isInteger(c.frames) &&
    (c.frames as number) >= LIMITS.minFrames &&
    (c.frames as number) <= LIMITS.maxFrames &&
    Number.isInteger(c.frameSize) &&
    (c.frameSize as number) >= LIMITS.minFrameSize &&
    (c.frameSize as number) <= LIMITS.maxFrameSize &&
    typeof c.createdAt === 'number'
  )
}

function isSettings(v: unknown): v is Settings {
  if (typeof v !== 'object' || v === null) return false
  const s = v as Record<string, unknown>
  return (
    s.version === 1 &&
    (s.activeId === null || typeof s.activeId === 'string') &&
    Array.isArray(s.characters) &&
    s.characters.every(isCharacterSet)
  )
}

/**
 * 등록한 캐릭터를 파일로 저장하는 저장소 (contracts/storage.md).
 * Electron에 의존하지 않도록 루트 경로(사용자 데이터 폴더)를 생성자로 받는다.
 */
export class CharacterStore {
  private settings: Settings = { version: 1, activeId: null, characters: [] }
  private notice: string | undefined

  constructor(private readonly root: string) {}

  private get settingsPath(): string {
    return join(this.root, SETTINGS_FILE)
  }

  /** 캐릭터 이미지 폴더. id 형식을 검증해 경로 조작을 막는다. */
  characterDir(id: string): string {
    if (!ID_PATTERN.test(id)) throw new Error(`잘못된 캐릭터 id: ${id}`)
    return join(this.root, 'characters', id)
  }

  /** settings.json을 읽는다. 깨졌으면 보존하고 빈 상태로 시작한다. */
  load(): void {
    this.notice = undefined
    if (!existsSync(this.settingsPath)) {
      this.settings = { version: 1, activeId: null, characters: [] }
      return
    }
    let parsed: unknown
    try {
      parsed = JSON.parse(readFileSync(this.settingsPath, 'utf8'))
    } catch {
      parsed = undefined
    }
    if (!isSettings(parsed)) {
      renameSync(this.settingsPath, `${this.settingsPath}.broken-${Date.now()}`)
      this.settings = { version: 1, activeId: null, characters: [] }
      this.notice = '저장된 캐릭터 설정을 읽을 수 없어 기본 캐릭터로 시작했습니다.'
      return
    }
    this.settings = parsed
    this.ensureActiveReadable()
  }

  /** 활성 캐릭터가 없거나 이미지를 읽을 수 없으면 기본으로 되돌린다 (FR-015) */
  private ensureActiveReadable(): void {
    const id = this.settings.activeId
    if (id === null) return
    const character = this.settings.characters.find((c) => c.id === id)
    if (!character || !this.imagesExist(id)) {
      this.settings.activeId = null
      this.notice = `선택한 캐릭터${character ? ` "${character.name}"` : ''}의 이미지를 읽을 수 없어 기본 캐릭터로 표시합니다.`
      this.save()
    }
  }

  imagesExist(id: string): boolean {
    const dir = this.characterDir(id)
    return existsSync(join(dir, 'walk.png')) && existsSync(join(dir, 'idle.png'))
  }

  list(): CharacterSet[] {
    return this.settings.characters.map((c) => ({ ...c }))
  }

  getActiveId(): string | null {
    return this.settings.activeId
  }

  /** 시작·조회 때 생긴 문제 알림. 한 번 읽으면 지운다. */
  takeNotice(): string | undefined {
    const n = this.notice
    this.notice = undefined
    return n
  }

  /** 이미지를 저장하고 목록에 추가한다. 중간에 실패하면 만든 폴더를 지운다. */
  add(meta: CharacterSet, walk: Buffer, idle: Buffer): void {
    const dir = this.characterDir(meta.id)
    if (this.settings.characters.some((c) => c.id === meta.id)) {
      throw new Error(`이미 있는 캐릭터 id: ${meta.id}`)
    }
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, 'walk.png'), walk)
      writeFileSync(join(dir, 'idle.png'), idle)
      this.settings.characters.push({ ...meta })
      try {
        this.save()
      } catch (error) {
        this.settings.characters.pop()
        throw error
      }
    } catch (error) {
      rmSync(dir, { recursive: true, force: true })
      throw error
    }
  }

  /** 임시 파일에 쓴 뒤 이름을 바꿔 원자적으로 반영한다 */
  private save(): void {
    mkdirSync(this.root, { recursive: true })
    const tmp = `${this.settingsPath}.tmp`
    writeFileSync(tmp, JSON.stringify(this.settings, null, 2))
    renameSync(tmp, this.settingsPath)
  }
}
