/** 캐릭터 등록·저장에 쓰는 타입과 제한 상수 (data-model.md, research R6) */

export const ID_PATTERN = /^[a-z0-9]{8,32}$/

export const LIMITS = {
  /** 이미지 파일 한 장의 최대 용량 (바이트) */
  maxImageBytes: 5 * 1024 * 1024,
  minFrames: 2,
  maxFrames: 32,
  /** 프레임 한 변의 픽셀 수 범위 */
  minFrameSize: 64,
  maxFrameSize: 512,
  maxNameLength: 30,
  /** 기본 캐릭터가 쓰는 이름이라 등록할 수 없다 */
  reservedName: '기본',
  /** 번들에 포함된 기본 걷기 이미지의 프레임 수 */
  defaultFrames: 4
} as const

/** 등록된 캐릭터 하나. 기본 캐릭터는 코드에 내장되어 있어 저장하지 않는다. */
export type CharacterSet = {
  /** 정규식 ID_PATTERN. 저장 폴더 이름으로 쓰인다 */
  id: string
  /** 앞뒤 공백 제거 후 1~30자 */
  name: string
  /** 걷기 프레임 수, 정수 2~32 */
  frames: number
  /** 프레임 한 변의 픽셀 수, 64~512 */
  frameSize: number
  /** 등록 시각 (ms, epoch) */
  createdAt: number
}

export type Settings = {
  version: 1
  /** null이면 기본 캐릭터 */
  activeId: string | null
  characters: CharacterSet[]
}

/** 오버레이에 적용되는 활성 캐릭터의 모습 (저장하지 않는 파생 값) */
export type Appearance = {
  /** data: URL. null이면 번들에 포함된 기본 걷기 이미지 */
  walkUrl: string | null
  /** data: URL. null이면 번들에 포함된 기본 정지 이미지 */
  idleUrl: string | null
  /** 걷기 프레임 수 */
  frames: number
}

export type ValidationErrorCode =
  | 'not-png'
  | 'too-large'
  | 'corrupt-image'
  | 'bad-frame-count'
  | 'bad-walk-size'
  | 'bad-idle-size'
  | 'not-transparent'
  | 'bad-name'
  | 'duplicate-name'

export type ValidationError = {
  code: ValidationErrorCode
  target: 'walk' | 'idle' | 'name' | 'frames'
  /** 사용자에게 보여 줄 한국어 설명 */
  message: string
}
