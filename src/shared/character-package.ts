import { LIMITS } from './characters'
import { DIALOGUE_CATEGORIES, type Category, type Lines } from './dialogue'

/** 캐릭터 내보내기 파일(.kakaru)의 구조 (contracts/package-file.md). Electron·Node에 의존하지 않는다 */

export const PACKAGE_FORMAT = 'kakaru-character'
export const PACKAGE_VERSION = 1

export type PackageData = {
  name: string
  frames: number
  /** base64 PNG */
  walk: string
  /** base64 PNG */
  idle: string
  /** 파일에 있던 분류만 들어 있다. 없는 분류는 빈 목록으로 본다 */
  lines: Partial<Record<Category, string[]>>
}

export type PackageParseErrorCode = 'not-package' | 'unsupported-version' | 'bad-field' | 'bad-base64'

export type PackageParseResult =
  | { ok: true; data: PackageData }
  | { ok: false; code: PackageParseErrorCode; message: string }

const MESSAGES: Record<PackageParseErrorCode, string> = {
  'not-package': '캐릭터 파일이 아니거나 손상되었습니다.',
  'unsupported-version': '이 앱이 지원하지 않는 버전의 캐릭터 파일입니다. 앱을 업데이트한 뒤 다시 시도하세요.',
  'bad-field': '캐릭터 파일이 손상되었습니다. 필요한 정보가 없거나 형식이 올바르지 않습니다.',
  'bad-base64': '캐릭터 파일의 이미지 데이터가 손상되었습니다.'
}

function fail(code: PackageParseErrorCode): PackageParseResult {
  return { ok: false, code, message: MESSAGES[code] }
}

/** 내보낼 파일 내용을 만든다. 이식에 필요한 정보만 담는다 (id·시각·경로는 넣지 않는다) */
export function buildCharacterPackage(input: {
  name: string
  frames: number
  walk: string
  idle: string
  lines: Lines
}): string {
  const lines = Object.fromEntries(DIALOGUE_CATEGORIES.map((category) => [category, input.lines[category]]))
  return JSON.stringify(
    {
      format: PACKAGE_FORMAT,
      version: PACKAGE_VERSION,
      name: input.name,
      frames: input.frames,
      walk: input.walk,
      idle: input.idle,
      lines
    },
    null,
    2
  )
}

/** 표준 base64 문자 집합인지 (정규식은 문자 클래스 하나라 큰 문자열에서도 안전하다) */
function isBase64(text: string): boolean {
  return text.length % 4 === 0 && /^[A-Za-z0-9+/]*={0,2}$/.test(text)
}

function parseLines(value: unknown): Partial<Record<Category, string[]>> | null {
  if (value === undefined) return {}
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const raw = value as Record<string, unknown>
  const out: Partial<Record<Category, string[]>> = {}
  for (const category of DIALOGUE_CATEGORIES) {
    const list = raw[category]
    if (list === undefined) continue
    if (!Array.isArray(list) || !list.every((x) => typeof x === 'string')) return null
    out[category] = list as string[]
  }
  return out
}

/** 파일 내용을 해석한다. 이미지·이름·대사의 규칙 검증은 하지 않고 구조만 확인한다 */
export function parseCharacterPackage(text: string): PackageParseResult {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return fail('not-package')
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return fail('not-package')
  const file = raw as Record<string, unknown>
  if (file.format !== PACKAGE_FORMAT) return fail('not-package')

  const { version } = file
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) return fail('bad-field')
  if (version > PACKAGE_VERSION) return fail('unsupported-version')

  const { name, frames, walk, idle } = file
  if (typeof name !== 'string' || typeof frames !== 'number' || !Number.isInteger(frames)) return fail('bad-field')
  if (typeof walk !== 'string' || walk === '' || typeof idle !== 'string' || idle === '') return fail('bad-field')
  const lines = parseLines(file.lines)
  if (!lines) return fail('bad-field')
  if (!isBase64(walk) || !isBase64(idle)) return fail('bad-base64')

  return { ok: true, data: { name, frames, walk, idle, lines } }
}

/** 저장 대화상자의 기본 파일 이름. 두 OS에서 쓸 수 없는 문자는 _로 바꾼다 */
export function exportFileName(name: string): string {
  const cleaned = name
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .trim()
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return `${cleaned === '' ? 'character' : cleaned}.kakaru`
}

/** 목록에 같은 이름(대소문자 무시)이 있으면 비어 있는 첫 번호를 붙인다. 최대 길이를 넘으면 앞부분을 줄인다 */
export function uniqueName(name: string, existing: readonly string[]): string {
  const taken = new Set(existing.map((n) => n.trim().toLowerCase()))
  if (!taken.has(name.toLowerCase())) return name
  for (let n = 2; ; n++) {
    const suffix = ` (${n})`
    const candidate = `${name.slice(0, LIMITS.maxNameLength - suffix.length)}${suffix}`
    if (!taken.has(candidate.toLowerCase())) return candidate
  }
}
