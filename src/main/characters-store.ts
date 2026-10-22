import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { config } from '../shared/config'
import {
  ID_PATTERN,
  LIMITS,
  type Appearance,
  type CharacterSet,
  type Settings
} from '../shared/characters'

const SETTINGS_FILE = 'settings.json'

/** 배율을 최소~최대 범위로 맞추고 소수 둘째 자리로 반올림한다 */
export function normalizeScale(value: number): number {
  const clamped = Math.min(config.scale.max, Math.max(config.scale.min, value))
  return Math.round(clamped * 100) / 100
}

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
    s.characters.every(isCharacterSet) &&
    (s.seeded === undefined || (Array.isArray(s.seeded) && s.seeded.every((k) => typeof k === 'string'))) &&
    (s.scale === undefined || (typeof s.scale === 'number' && Number.isFinite(s.scale)))
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
    if (this.settings.scale !== undefined) this.settings.scale = normalizeScale(this.settings.scale)
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

  /**
   * 샘플 캐릭터를 처음 한 번만 등록한다. 한 번 등록한 적이 있으면(삭제했더라도) 다시 넣지 않는다.
   * 활성 캐릭터는 바꾸지 않는다. 새로 등록했으면 true.
   */
  seedSample(key: string, meta: CharacterSet, walk: Buffer, idle: Buffer): boolean {
    if (this.settings.seeded?.includes(key)) return false
    this.add(meta, walk, idle, key)
    return true
  }

  /** 이미지를 저장하고 목록에 추가한다. 중간에 실패하면 만든 폴더를 지운다. */
  add(meta: CharacterSet, walk: Buffer, idle: Buffer, seedKey?: string): void {
    const dir = this.characterDir(meta.id)
    if (this.settings.characters.some((c) => c.id === meta.id)) {
      throw new Error(`이미 있는 캐릭터 id: ${meta.id}`)
    }
    mkdirSync(dir, { recursive: true })
    try {
      writeFileSync(join(dir, 'walk.png'), walk)
      writeFileSync(join(dir, 'idle.png'), idle)
      this.settings.characters.push({ ...meta })
      if (seedKey) this.settings.seeded = [...(this.settings.seeded ?? []), seedKey]
      try {
        this.save()
      } catch (error) {
        this.settings.characters.pop()
        if (seedKey) this.settings.seeded = this.settings.seeded?.filter((k) => k !== seedKey)
        throw error
      }
    } catch (error) {
      rmSync(dir, { recursive: true, force: true })
      throw error
    }
  }

  /** 캐릭터 크기 배율 (확대·축소) */
  getScale(): number {
    return this.settings.scale ?? config.scale.default
  }

  /** 배율을 범위 안으로 맞춰 저장한다 */
  setScale(scale: number): void {
    if (typeof scale !== 'number' || !Number.isFinite(scale)) throw new Error('크기 값이 올바르지 않습니다.')
    const previous = this.settings.scale
    this.settings.scale = normalizeScale(scale)
    try {
      this.save()
    } catch (error) {
      this.settings.scale = previous
      throw error
    }
  }

  /** 활성 캐릭터를 바꾼다. null이면 기본 캐릭터로 되돌린다. */
  setActive(id: string | null): void {
    if (id !== null) {
      if (!this.settings.characters.some((c) => c.id === id)) {
        throw new Error(`등록되지 않은 캐릭터입니다: ${id}`)
      }
      if (!this.imagesExist(id)) throw new Error('캐릭터 이미지를 읽을 수 없습니다.')
    }
    const previous = this.settings.activeId
    this.settings.activeId = id
    try {
      this.save()
    } catch (error) {
      this.settings.activeId = previous
      throw error
    }
  }

  /** 캐릭터를 목록에서 빼고 이미지 폴더를 지운다. 활성 캐릭터였으면 기본으로 되돌린다. */
  remove(id: string): void {
    const index = this.settings.characters.findIndex((c) => c.id === id)
    if (index === -1) throw new Error(`등록되지 않은 캐릭터입니다: ${id}`)
    const [removed] = this.settings.characters.splice(index, 1)
    const previousActive = this.settings.activeId
    if (previousActive === id) this.settings.activeId = null
    try {
      this.save()
    } catch (error) {
      this.settings.characters.splice(index, 0, removed)
      this.settings.activeId = previousActive
      throw error
    }
    // 목록에서는 이미 사라졌으므로 폴더 삭제 실패는 무시한다
    try {
      rmSync(this.characterDir(id), { recursive: true, force: true })
    } catch {
      /* 무시 */
    }
  }

  /** 캐릭터 이미지를 읽는다. 없거나 읽을 수 없으면 null. */
  readImage(id: string, kind: 'walk' | 'idle'): Buffer | null {
    try {
      return readFileSync(join(this.characterDir(id), `${kind}.png`))
    } catch {
      return null
    }
  }

  /**
   * 활성 캐릭터를 오버레이에 적용할 모습으로 만든다. 기본 캐릭터이거나 이미지를 읽을 수 없으면
   * 기본 모습(URL이 null)을 돌려준다. 읽을 수 없는 경우 활성을 기본으로 되돌리고 알림을 남긴다 (FR-015).
   */
  readAppearance(): Appearance {
    const scale = this.getScale()
    const fallback: Appearance = { walkUrl: null, idleUrl: null, frames: LIMITS.defaultFrames, scale }
    const id = this.settings.activeId
    if (id === null) return fallback
    const character = this.settings.characters.find((c) => c.id === id)
    const walk = character ? this.readImage(id, 'walk') : null
    const idle = character ? this.readImage(id, 'idle') : null
    if (!character || !walk || !idle) {
      this.settings.activeId = null
      this.notice = `선택한 캐릭터${character ? ` "${character.name}"` : ''}의 이미지를 읽을 수 없어 기본 캐릭터로 표시합니다.`
      try {
        this.save()
      } catch {
        /* 저장 실패해도 이번 실행에서는 기본으로 표시한다 */
      }
      return fallback
    }
    return {
      walkUrl: `data:image/png;base64,${walk.toString('base64')}`,
      idleUrl: `data:image/png;base64,${idle.toString('base64')}`,
      frames: character.frames,
      scale
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
