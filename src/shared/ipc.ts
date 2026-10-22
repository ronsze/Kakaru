import type { Appearance, ValidationError } from './characters'
import type { Category, Lines, LinesIssue } from './dialogue'
import type { BehaviorState, Heading } from './types'

export const CHANNEL_CHARACTER_UPDATE = 'character:update'
export const CHANNEL_APPEARANCE = 'character:appearance'
export const CHANNEL_GRAB_START = 'character:grab-start'
export const CHANNEL_GRAB_END = 'character:grab-end'

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
  /** 말풍선. null이면 없다. 렌더러는 id가 바뀔 때만 숨김 타이머를 새로 건다 */
  speech: { id: number; text: string; remainingMs: number } | null
}

/** preload가 렌더러에 노출하는 API */
export type KakaruApi = {
  onCharacterUpdate(callback: (update: CharacterUpdate) => void): void
  onAppearance(callback: (appearance: Appearance) => void): void
  /** 캐릭터를 잡기 시작·끝냄 (드래그 이동) */
  grabStart(): void
  grabEnd(): void
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

/** 대사 편집 화면에 보여 줄 한 캐릭터의 대화셋 */
export type LinesView = {
  lines: Lines
  /** 'default': 처음 문장으로 되돌리기(기본·샘플), 'clear': 모두 비우기(등록 캐릭터) */
  restore: 'default' | 'clear'
  /** 되돌리기·비우기 버튼이 의미 있는지(처음 상태와 다르거나 비어 있지 않은지) */
  modified: boolean
}

export type GetLinesResult = { ok: true; view: LinesView } | { ok: false; message: string }

export type SaveLinesResult =
  | { ok: true; lines: Lines; dropped: number; merged: number }
  | { ok: false; issues: LinesIssue[] }
  | { ok: false; message: string }

export type RestoreLinesResult = { ok: true; lines: Lines } | { ok: false; message: string }

export type { Category, Lines, LinesIssue }

/** 캐릭터 내보내기. canceled는 사용자가 대화상자를 닫은 것이라 오류로 보이지 않는다 */
export type ExportResult =
  | { ok: true; fileName: string }
  | { ok: false; canceled: true }
  | { ok: false; message: string }

/** 캐릭터 가져오기. details는 이미지·이름·대사 위반 문구 목록(없으면 빈 배열) */
export type ImportResult =
  | { ok: true; id: string; name: string }
  | { ok: false; canceled: true }
  | { ok: false; message: string; details: string[] }

/** preload가 설정 창에 노출하는 API */
export type KakaruSettingsApi = {
  list(): Promise<ListResult>
  validate(input: RegisterInput): Promise<ValidationResult>
  register(input: RegisterInput): Promise<RegisterResult>
  /** id가 null이면 기본 캐릭터로 되돌린다 */
  apply(id: string | null): Promise<SimpleResult>
  delete(id: string): Promise<SimpleResult>
  /** id가 null이면 기본 캐릭터 */
  getLines(id: string | null): Promise<GetLinesResult>
  saveLines(id: string | null, input: Record<Category, string[]>): Promise<SaveLinesResult>
  restoreLines(id: string | null): Promise<RestoreLinesResult>
  /** 저장 대화상자를 열어 등록 캐릭터 하나를 .kakaru 파일로 내보낸다 */
  exportCharacter(id: string): Promise<ExportResult>
  /** 열기 대화상자를 열어 고른 .kakaru 파일로 새 캐릭터를 등록한다 */
  importCharacter(): Promise<ImportResult>
  onChanged(callback: () => void): void
}
