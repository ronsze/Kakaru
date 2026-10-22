import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIMITS, validateRegistration, type Appearance, type ImageInspector } from '../shared/characters'
import type {
  CharacterSummary,
  ListResult,
  RegisterInput,
  RegisterResult,
  SimpleResult,
  ValidationResult
} from '../shared/ipc'
import { config } from '../shared/config'
import type { Lines } from '../shared/dialogue'
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
