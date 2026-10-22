import type { Appearance, ValidationError } from './characters'
import type { BehaviorState, Heading } from './types'

export const CHANNEL_CHARACTER_UPDATE = 'character:update'
export const CHANNEL_APPEARANCE = 'character:appearance'

/**
 * 디스플레이별 오버레이 창에 보내는 캐릭터 상태. x, y는 창 로컬 좌표(DIP).
 * 이동 중 매 프레임 위치를 보내지 않고, 상태가 바뀔 때(와 주기적 보정 때) 위치와 속도를 보내면
 * 렌더러가 속도로 위치를 이어서 계산한다.
 */
export type CharacterUpdate = {
  visible: boolean
  x: number
  y: number
  /** 속도 (px/s, DIP). 이동 중이 아니면 0 */
  vx: number
  vy: number
  heading: Heading
  state: BehaviorState
}

/** preload가 렌더러에 노출하는 API */
export type KakaruApi = {
  onCharacterUpdate(callback: (update: CharacterUpdate) => void): void
  onAppearance(callback: (appearance: Appearance) => void): void
}

export type { Appearance, ValidationError }

export type CharacterSummary = {
  /** null = 기본 캐릭터 */
  id: string | null
  name: string
  frames: number
  frameSize: number
  /** 목록 썸네일용 data: URL. 기본 캐릭터는 빈 문자열(설정 화면이 번들의 기본 이미지로 대체) */
  idleUrl: string
  builtin: boolean
  /** 이미지가 손상·누락된 경우 이유 */
  problem?: string
}

export type ListResult = {
  characters: CharacterSummary[]
  activeId: string | null
  /** 활성 캐릭터를 읽을 수 없어 기본으로 되돌린 경우 등 */
  notice?: string
}

export type RegisterInput = {
  name: string
  frames: number
  /** 걷기 이미지 파일 내용 */
  walk: ArrayBuffer
  /** 정지 이미지 파일 내용 */
  idle: ArrayBuffer
}

export type ValidationResult = { ok: true; frameSize: number } | { ok: false; errors: ValidationError[] }

export type RegisterResult = { ok: true; id: string } | { ok: false; errors: ValidationError[] }

export type SimpleResult = { ok: true } | { ok: false; message: string }

/** preload가 설정 창에 노출하는 API */
export type KakaruSettingsApi = {
  list(): Promise<ListResult>
  validate(input: RegisterInput): Promise<ValidationResult>
  register(input: RegisterInput): Promise<RegisterResult>
  /** id가 null이면 기본 캐릭터로 되돌린다 */
  apply(id: string | null): Promise<SimpleResult>
  delete(id: string): Promise<SimpleResult>
  onChanged(callback: () => void): void
}
