import { config } from './config'

/** 대화셋 분류. 모든 캐릭터가 같은 분류를 쓰고, 문장만 캐릭터마다 다르다 */
export const DIALOGUE_CATEGORIES = ['greeting', 'normal', 'grabbed', 'struggling'] as const
export type Category = (typeof DIALOGUE_CATEGORIES)[number]

/** 한 캐릭터의 대화셋. 모든 분류 키가 항상 있고 비어 있을 수 있다 */
export type Lines = Record<Category, string[]>

export function emptyLines(): Lines {
  return { greeting: [], normal: [], grabbed: [], struggling: [] }
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
  greeting: ['안녕! 오늘도 잘 부탁해냥.', '왔구나, 반가워!', '나 왔어! 잘 지냈어?'],
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

export type LinesIssue = {
  category: Category
  /** 입력한 텍스트의 줄 번호(1부터). 개수 초과처럼 특정 줄이 아니면 0 */
  line: number
  code: 'too-long' | 'too-many'
  message: string
}

export type LinesValidation = {
  /** issues가 없을 때만 true. 이때 lines를 저장한다 */
  ok: boolean
  lines: Lines
  issues: LinesIssue[]
  /** 공백뿐이라 제외한 줄 수 */
  dropped: number
  /** 같은 분류의 중복이라 합친 문장 수 */
  merged: number
}

/**
 * 편집 화면의 입력을 검증·정규화한다 (spec FR-004~006, data-model.md).
 * 각 분류의 값은 입력한 문자열들이며 줄바꿈이 섞여 있어도 된다. 화면(입력 중)과 메인(저장 직전)이 함께 쓴다.
 */
export function validateLinesInput(input: Partial<Record<Category, readonly string[]>>): LinesValidation {
  const { maxLength, maxPerCategory } = config.speech
  const result: LinesValidation = { ok: true, lines: emptyLines(), issues: [], dropped: 0, merged: 0 }
  for (const category of DIALOGUE_CATEGORIES) {
    const seen = new Set<string>()
    const kept: string[] = []
    let lineNo = 0
    for (const chunk of input[category] ?? []) {
      if (chunk === '') continue // 비어 있는 입력란은 정리한 줄로 세지 않는다
      for (const raw of chunk.split(/\r\n|\r|\n/)) {
        lineNo++
        const text = raw.trim()
        if (text.length === 0) {
          result.dropped++
        } else if (text.length > maxLength) {
          result.issues.push({
            category,
            line: lineNo,
            code: 'too-long',
            message: `${lineNo}번째 줄이 ${text.length}자입니다. ${maxLength}자 이하여야 합니다.`
          })
        } else if (seen.has(text)) {
          result.merged++
        } else {
          seen.add(text)
          kept.push(text)
        }
      }
    }
    if (kept.length > maxPerCategory) {
      result.issues.push({
        category,
        line: 0,
        code: 'too-many',
        message: `문장이 ${kept.length}개입니다. 분류당 최대 ${maxPerCategory}개까지 저장할 수 있습니다.`
      })
    }
    result.lines[category] = kept
  }
  result.ok = result.issues.length === 0
  return result
}
