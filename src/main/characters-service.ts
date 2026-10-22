import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LIMITS, validateRegistration, type ImageInspector } from '../shared/characters'
import type {
  CharacterSummary,
  ListResult,
  RegisterInput,
  RegisterResult,
  ValidationResult
} from '../shared/ipc'
import type { CharacterStore } from './characters-store'

/** 기본 캐릭터 이미지의 프레임 한 변 (번들된 assets/walk.png, idle.png) */
const DEFAULT_FRAME_SIZE = 200

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
}
