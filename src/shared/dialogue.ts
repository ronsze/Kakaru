import { config } from './config'

/** 대화셋 분류. 모든 캐릭터가 같은 분류를 쓰고, 문장만 캐릭터마다 다르다 */
export const DIALOGUE_CATEGORIES = ['normal', 'grabbed', 'struggling'] as const
export type Category = (typeof DIALOGUE_CATEGORIES)[number]

/** 한 캐릭터의 대화셋. 모든 분류 키가 항상 있고 비어 있을 수 있다 */
export type Lines = Record<Category, string[]>

export function emptyLines(): Lines {
  return { normal: [], grabbed: [], struggling: [] }
}

/**
 * lines.json의 내용(파싱된 값)을 안전한 대화셋으로 바꾼다 (contracts/lines-file.md).
 * 형식이 틀리면 모든 분류를 빈 목록으로 보고, 문장 단위로는 유효한 것만 남긴다.
 */
export function sanitizeLines(raw: unknown): Lines {
  const result = emptyLines()
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return result
  const file = raw as Record<string, unknown>
  if (file.version !== 1) return result
  const lines = file.lines
  if (typeof lines !== 'object' || lines === null || Array.isArray(lines)) return result
  for (const category of DIALOGUE_CATEGORIES) {
    const list = (lines as Record<string, unknown>)[category]
    if (!Array.isArray(list)) continue
    const valid: string[] = []
    for (const item of list) {
      if (typeof item !== 'string') continue
      const text = item.trim()
      if (text.length === 0 || text.length > config.speech.maxLength) continue
      valid.push(text)
      if (valid.length >= config.speech.maxPerCategory) break
    }
    result[category] = valid
  }
  return result
}

/** 후보에서 무작위로 하나를 고른다. 후보가 둘 이상이면 직전 문장은 제외한다 */
export function pickLine(
  candidates: readonly string[],
  last: string | null,
  random: () => number
): string | null {
  if (candidates.length === 0) return null
  const pool = candidates.length > 1 ? candidates.filter((c) => c !== last) : candidates
  return pool[Math.floor(random() * pool.length)]
}

/** 기본 캐릭터(폴리곤 고양이)의 대화셋 */
export const DEFAULT_LINES: Lines = {
  normal: [
    '오늘도 어슬렁어슬렁.',
    '어디 갈까?',
    '심심하다냥.',
    '화면이 넓어서 좋아.',
    '잠깐 쉬었다 갈까.'
  ],
  grabbed: ['앗!', '어? 누가 날 잡았어.', '내려 줘냥.'],
  struggling: ['놓아 줘!', '버둥버둥!', '이제 그만 놔 주라냥!']
}
