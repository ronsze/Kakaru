import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIMITS, validateRegistration, type Appearance, type ImageInspector } from '../shared/characters'
import type {
  CharacterSummary,
  GetLinesResult,
  ListResult,
  RegisterInput,
  RegisterResult,
  RestoreLinesResult,
  SaveLinesResult,
  SimpleResult,
  ValidationResult
} from '../shared/ipc'
import { config } from '../shared/config'
import { DEFAULT_LINES, DIALOGUE_CATEGORIES, emptyLines, sanitizeLines, validateLinesInput, type Lines } from '../shared/dialogue'
import type { CharacterStore } from './characters-store'

/** 기본 캐릭터 이미지의 프레임 한 변 (번들된 assets/walk.png, idle.png) */
const DEFAULT_FRAME_SIZE = 200

/** 처음 실행 때 등록해 둘 샘플 캐릭터. 이미지는 dir의 walk.png, idle.png다. */
export type SampleCharacter = {
  key: string
  name: string
  frames: number
  frameSize: number
  dir: string
}

export type ZoomState = { scale: number; canZoomIn: boolean; canZoomOut: boolean }

export type CharacterServiceOptions = {
  now?: () => number
  makeId?: () => string
}

/** IPC로 받은 ArrayBuffer(또는 뷰)를 바이트 배열로 바꾼다. 그 외 값은 거부한다. */
function toBytes(value: unknown): Uint8Array {
  if (value instanceof ArrayBuffer) return new Uint8Array(value)
  if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
  throw new Error('이미지 데이터가 올바르지 않습니다.')
}

function readOptional(path: string): Buffer | null {
  try {
    return readFileSync(path)
  } catch {
    return null
  }
}

/** IPC로 받은 값이 분류별 문자열 배열 모양인지 확인한다. 알 수 없는 분류 키나 문자열이 아닌 값은 거부한다 */
function parseLinesInput(value: unknown): Record<string, string[]> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const known = new Set<string>(DIALOGUE_CATEGORIES)
  const out: Record<string, string[]> = {}
  for (const [key, list] of Object.entries(value)) {
    if (!known.has(key) || !Array.isArray(list) || !list.every((x) => typeof x === 'string')) return null
    out[key] = list
  }
  return out
}

function toDataUrl(bytes: Buffer): string {
  return `data:image/png;base64,${bytes.toString('base64')}`
}

/**
 * 캐릭터 목록·검증·등록 로직. Electron에 의존하지 않고, 투명도 검사만 포트로 주입한다.
 * IPC 핸들러(characters-ipc.ts)는 이 서비스를 얇게 감싼다.
 */
export class CharacterService {
  private readonly now: () => number
  private readonly makeId: () => string
  /** 설치·백필에 넘어온 샘플 목록. 대사를 처음 문장으로 되돌릴 때 원본을 찾는 데 쓴다 */
  private samples: readonly SampleCharacter[] = []

  constructor(
    private readonly store: CharacterStore,
    private readonly inspector: ImageInspector,
    options: CharacterServiceOptions = {}
  ) {
    this.now = options.now ?? Date.now
    // ID_PATTERN(^[a-z0-9]{8,32}$)을 만족하는 12자리 16진 문자열
    this.makeId = options.makeId ?? (() => randomBytes(6).toString('hex'))
  }

  list(): ListResult {
    const characters: CharacterSummary[] = [
      {
        id: null,
        name: LIMITS.reservedName,
        frames: LIMITS.defaultFrames,
        frameSize: DEFAULT_FRAME_SIZE,
        idleUrl: '',
        builtin: true
      }
    ]
    for (const c of this.store.list()) {
      const summary: CharacterSummary = {
        id: c.id,
        name: c.name,
        frames: c.frames,
        frameSize: c.frameSize,
        idleUrl: '',
        builtin: false
      }
      try {
        summary.idleUrl = toDataUrl(readFileSync(join(this.store.characterDir(c.id), 'idle.png')))
      } catch {
        summary.problem = '이미지 파일을 읽을 수 없습니다.'
      }
      characters.push(summary)
    }
    const notice = this.store.takeNotice()
    return { characters, activeId: this.store.getActiveId(), ...(notice ? { notice } : {}) }
  }

  validate(input: RegisterInput): ValidationResult {
    return validateRegistration(
      { name: input.name, frames: input.frames, walk: toBytes(input.walk), idle: toBytes(input.idle) },
      this.inspector,
      this.store.list().map((c) => c.name)
    )
  }

  /** 검증을 통과하면 이미지를 복사·저장한다. 활성 캐릭터는 바꾸지 않는다. */
  register(input: RegisterInput): RegisterResult {
    const result = this.validate(input)
    if (!result.ok) return result
    const id = this.makeId()
    this.store.add(
      {
        id,
        name: input.name.trim(),
        frames: input.frames,
        frameSize: result.frameSize,
        createdAt: this.now()
      },
      Buffer.from(toBytes(input.walk)),
      Buffer.from(toBytes(input.idle))
    )
    return { ok: true, id }
  }

  /** 활성 캐릭터를 바꾼다. id가 null이면 기본 캐릭터로 되돌린다. */
  apply(id: string | null): SimpleResult {
    try {
      this.store.setActive(id)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 등록한 캐릭터를 지운다. 기본 캐릭터(null)는 지울 수 없다. */
  delete(id: string | null): SimpleResult {
    if (id === null || typeof id !== 'string') {
      return { ok: false, message: '기본 캐릭터는 삭제할 수 없습니다.' }
    }
    try {
      this.store.remove(id)
      return { ok: true }
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
  }

  /** 오버레이에 적용할 활성 캐릭터의 모습 */
  appearance(): Appearance {
    return this.store.readAppearance()
  }

  /**
   * 샘플 캐릭터를 처음 실행 때 한 번만 등록된 캐릭터로 넣는다. 이미지 파일이 없으면 건너뛴다.
   * 활성 캐릭터는 바꾸지 않으므로 사용자가 선택하기 전에는 기본 캐릭터를 쓴다.
   */
  installSamples(samples: readonly SampleCharacter[]): number {
    this.samples = samples
    let installed = 0
    for (const sample of samples) {
      let walk: Buffer
      let idle: Buffer
      try {
        walk = readFileSync(join(sample.dir, 'walk.png'))
        idle = readFileSync(join(sample.dir, 'idle.png'))
      } catch {
        continue
      }
      const meta = {
        id: this.makeId(),
        name: sample.name,
        frames: sample.frames,
        frameSize: sample.frameSize,
        createdAt: this.now()
      }
      if (this.store.seedSample(sample.key, meta, walk, idle)) {
        installed++
        const lines = readOptional(join(sample.dir, 'lines.json'))
        if (lines) this.store.writeLinesFile(meta.id, lines)
      }
    }
    return installed
  }

  /**
   * 대화셋(lines.json)이 생기기 전에 설치한 샘플에 문장을 채운다. 설치 기록(키)이 있고 같은 이름의
   * 캐릭터에 lines.json이 없을 때만 복사하며, 이미 있으면 덮어쓰지 않는다. (research R6)
   */
  backfillSampleLines(samples: readonly SampleCharacter[]): number {
    this.samples = samples
    let filled = 0
    for (const sample of samples) {
      if (!this.store.isSeeded(sample.key)) continue
      const character = this.store.list().find((c) => c.name === sample.name)
      if (!character || this.store.hasLinesFile(character.id)) continue
      const lines = readOptional(join(sample.dir, 'lines.json'))
      if (!lines) continue
      this.store.writeLinesFile(character.id, lines)
      filled++
    }
    return filled
  }

  /** 활성 캐릭터의 대화셋 */
  lines(): Lines {
    return this.store.readLines()
  }

  /** id의 샘플 정의. 설치 기록이 있고 이름이 같은 등록 캐릭터만 샘플로 본다 */
  private sampleOf(id: string): SampleCharacter | undefined {
    const character = this.store.list().find((c) => c.id === id)
    if (!character) return undefined
    return this.samples.find((s) => this.store.isSeeded(s.key) && s.name === character.name)
  }

  private exists(id: string | null): boolean {
    return id === null || this.store.list().some((c) => c.id === id)
  }

  /** 처음 문장(기본 캐릭터·샘플). 등록 캐릭터는 빈 목록이다 */
  private initialLines(id: string | null): Lines {
    if (id === null) return DEFAULT_LINES
    const sample = this.sampleOf(id)
    const bytes = sample ? readOptional(join(sample.dir, 'lines.json')) : null
    if (!bytes) return emptyLines()
    try {
      return sanitizeLines(JSON.parse(bytes.toString('utf8')))
    } catch {
      return emptyLines()
    }
  }

  /** 대사 편집 화면에 보여 줄 대화셋과 복원 종류 */
  getLines(id: string | null): GetLinesResult {
    if (!this.exists(id)) return { ok: false, message: '등록되지 않은 캐릭터입니다.' }
    const lines = this.store.readLinesOf(id)
    const restorable = id === null || this.sampleOf(id) !== undefined
    const initial = this.initialLines(id)
    const modified = JSON.stringify(lines) !== JSON.stringify(initial)
    return { ok: true, view: { lines, restore: restorable ? 'default' : 'clear', modified } }
  }

  /** 편집한 대화셋을 검증하고 저장한다. 렌더러를 신뢰하지 않고 메인에서 다시 검증한다 */
  saveLines(id: string | null, input: unknown): SaveLinesResult {
    if (!this.exists(id)) return { ok: false, message: '등록되지 않은 캐릭터입니다. 삭제되었을 수 있습니다.' }
    const parsed = parseLinesInput(input)
    if (!parsed) return { ok: false, message: '대사 입력 형식이 올바르지 않습니다.' }
    const result = validateLinesInput(parsed)
    if (!result.ok) return { ok: false, issues: result.issues }
    try {
      this.store.writeLines(id, result.lines)
    } catch (error) {
      return { ok: false, message: `저장하지 못했습니다: ${error instanceof Error ? error.message : String(error)}` }
    }
    return { ok: true, lines: result.lines, dropped: result.dropped, merged: result.merged }
  }

  /** 기본 캐릭터·샘플은 처음 문장으로 되돌리고, 등록 캐릭터는 모두 비운다 */
  restoreLines(id: string | null): RestoreLinesResult {
    if (!this.exists(id)) return { ok: false, message: '등록되지 않은 캐릭터입니다.' }
    try {
      if (id === null) {
        this.store.resetDefaultLines()
      } else {
        const sample = this.sampleOf(id)
        const original = sample ? readOptional(join(sample.dir, 'lines.json')) : null
        if (original) this.store.writeLinesFile(id, original)
        else this.store.writeLines(id, emptyLines())
      }
    } catch (error) {
      return { ok: false, message: `되돌리지 못했습니다: ${error instanceof Error ? error.message : String(error)}` }
    }
    return { ok: true, lines: this.store.readLinesOf(id) }
  }

  /** 현재 크기와 더 확대·축소할 수 있는지 (메뉴 항목의 활성 여부에 쓴다) */
  zoomState(): ZoomState {
    const scale = this.store.getScale()
    return { scale, canZoomIn: scale < config.scale.max, canZoomOut: scale > config.scale.min }
  }

  /** 캐릭터를 한 단계 확대(+1) 또는 축소(-1)한다. 범위를 넘으면 최대·최소에서 멈춘다. */
  zoom(direction: 1 | -1): ZoomState {
    this.store.setScale(this.store.getScale() + direction * config.scale.step)
    return this.zoomState()
  }
}
