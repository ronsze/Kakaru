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

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

export type PngHeader =
  | { ok: true; width: number; height: number; colorType: number; bitDepth: number }
  | { ok: false; reason: 'not-png' | 'corrupt-image' }

/** PNG 파일 앞부분(시그니처와 IHDR)만 읽어 크기와 색상 유형을 알아낸다. 확장자·MIME은 신뢰하지 않는다. */
export function parsePngHeader(bytes: Uint8Array): PngHeader {
  if (bytes.length < PNG_SIGNATURE.length || PNG_SIGNATURE.some((b, i) => bytes[i] !== b)) {
    return { ok: false, reason: 'not-png' }
  }
  // 시그니처 8 + 청크 길이 4 + 청크 종류 4 + IHDR 13 = 29바이트가 있어야 한다
  if (bytes.length < 29) return { ok: false, reason: 'corrupt-image' }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const type = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15])
  if (view.getUint32(8) !== 13 || type !== 'IHDR') return { ok: false, reason: 'corrupt-image' }
  const width = view.getUint32(16)
  const height = view.getUint32(20)
  if (width === 0 || height === 0) return { ok: false, reason: 'corrupt-image' }
  return { ok: true, width, height, colorType: bytes[25], bitDepth: bytes[24] }
}

/** 이미지의 투명 픽셀 존재 여부를 판정하는 포트. 실제 구현은 메인에서 nativeImage로 한다. */
export interface ImageInspector {
  /** 알파 값이 255가 아닌 픽셀이 하나 이상 있는지. 디코딩할 수 없으면 'corrupt'. */
  hasTransparentPixels(bytes: Uint8Array): boolean | 'corrupt'
}

export type RegistrationInput = {
  name: string
  frames: number
  walk: Uint8Array
  idle: Uint8Array
}

export type RegistrationResult =
  | { ok: true; frameSize: number }
  | { ok: false; errors: ValidationError[] }

/** 색상 유형 중 알파 채널이 없는 것 (회색조 0, RGB 2). 이 경우 픽셀을 디코딩하지 않고 거른다. */
const NO_ALPHA_COLOR_TYPES = new Set([0, 2])

const MESSAGES = {
  'not-png': '파일 형식이 PNG가 아닙니다. PNG 이미지만 사용할 수 있습니다.',
  'too-large': `파일이 너무 큽니다. ${LIMITS.maxImageBytes / (1024 * 1024)}MB 이하여야 합니다.`,
  'corrupt-image': '이미지가 손상되어 읽을 수 없습니다.',
  'not-transparent': '배경이 투명하지 않습니다. 투명 배경의 PNG를 사용하세요.',
  'bad-frame-count': `프레임 수는 ${LIMITS.minFrames}~${LIMITS.maxFrames} 사이의 정수여야 합니다.`,
  'bad-name': `이름은 1~${LIMITS.maxNameLength}자여야 하고 "${LIMITS.reservedName}"은 쓸 수 없습니다.`,
  'duplicate-name': '이미 사용 중인 이름입니다.'
} as const

type Target = ValidationError['target']

/** 이미지 한 장의 형식·용량·손상·투명도를 확인하고, 통과하면 헤더를 돌려준다 */
function checkImage(
  bytes: Uint8Array,
  target: 'walk' | 'idle',
  inspector: ImageInspector,
  errors: ValidationError[]
): { width: number; height: number } | null {
  const fail = (code: keyof typeof MESSAGES) => {
    errors.push({ code, target, message: MESSAGES[code] })
    return null
  }
  if (bytes.length > LIMITS.maxImageBytes) return fail('too-large')
  const header = parsePngHeader(bytes)
  if (!header.ok) return fail(header.reason)
  if (NO_ALPHA_COLOR_TYPES.has(header.colorType)) return fail('not-transparent')
  const transparency = inspector.hasTransparentPixels(bytes)
  if (transparency === 'corrupt') return fail('corrupt-image')
  if (!transparency) return fail('not-transparent')
  return { width: header.width, height: header.height }
}

/**
 * 등록 입력을 검사한다 (FR-010, research R6). Electron에 의존하지 않는다.
 * 규칙: 걷기 이미지는 `너비 = 프레임 한 변 × 프레임 수, 높이 = 프레임 한 변`, 정지 이미지는 `너비 = 높이 = 프레임 한 변`.
 * @param existingNames 이미 등록된 캐릭터 이름들 (중복 검사용, 대소문자 무시)
 */
export function validateRegistration(
  input: RegistrationInput,
  inspector: ImageInspector,
  existingNames: readonly string[]
): RegistrationResult {
  const errors: ValidationError[] = []
  const push = (code: ValidationError['code'], target: Target, message: string) =>
    errors.push({ code, target, message })

  const name = input.name.trim()
  if (name.length < 1 || name.length > LIMITS.maxNameLength || name === LIMITS.reservedName) {
    push('bad-name', 'name', MESSAGES['bad-name'])
  } else if (existingNames.some((n) => n.trim().toLowerCase() === name.toLowerCase())) {
    push('duplicate-name', 'name', MESSAGES['duplicate-name'])
  }

  const framesOk =
    Number.isInteger(input.frames) && input.frames >= LIMITS.minFrames && input.frames <= LIMITS.maxFrames
  if (!framesOk) push('bad-frame-count', 'frames', MESSAGES['bad-frame-count'])

  const walk = checkImage(input.walk, 'walk', inspector, errors)
  const idle = checkImage(input.idle, 'idle', inspector, errors)

  let frameSize: number | null = null
  if (walk && framesOk) {
    const side = walk.height
    const sideOk = side >= LIMITS.minFrameSize && side <= LIMITS.maxFrameSize
    if (sideOk && walk.width === side * input.frames) {
      frameSize = side
    } else {
      push(
        'bad-walk-size',
        'walk',
        `걷기 이미지 크기가 맞지 않습니다. 높이는 ${LIMITS.minFrameSize}~${LIMITS.maxFrameSize}px이고 너비는 높이 × 프레임 수(${input.frames})여야 합니다. (현재 ${walk.width}×${walk.height})`
      )
    }
  }
  if (idle) {
    const square = idle.width === idle.height
    const inRange = idle.height >= LIMITS.minFrameSize && idle.height <= LIMITS.maxFrameSize
    const sameSide = frameSize === null || idle.height === frameSize
    if (!square || !inRange || !sameSide) {
      push(
        'bad-idle-size',
        'idle',
        `정지 이미지는 정사각형이어야 하고 한 변이 걷기 프레임(${frameSize ?? `${LIMITS.minFrameSize}~${LIMITS.maxFrameSize}`}px)과 같아야 합니다. (현재 ${idle.width}×${idle.height})`
      )
    }
  }

  if (errors.length > 0 || frameSize === null) {
    return { ok: false, errors }
  }
  return { ok: true, frameSize }
}
