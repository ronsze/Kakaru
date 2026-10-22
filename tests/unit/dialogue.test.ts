import { describe, expect, it } from 'vitest'
import { DEFAULT_LINES, DIALOGUE_CATEGORIES, pickLine, sanitizeLines } from '../../src/shared/dialogue'
import { config } from '../../src/shared/config'
import { seededRandom } from './helpers'

const file = (lines: unknown) => ({ version: 1, lines })

describe('sanitizeLines', () => {
  it('모든 분류 키를 항상 돌려준다', () => {
    const lines = sanitizeLines(file({ normal: ['안녕'] }))
    expect(Object.keys(lines)).toEqual([...DIALOGUE_CATEGORIES])
    expect(lines.normal).toEqual(['안녕'])
    expect(lines.grabbed).toEqual([])
    expect(lines.struggling).toEqual([])
  })

  it('문자열이 아닌 값, 빈 문장, 공백만 있는 문장을 제외하고 앞뒤 공백을 지운다 (FR-013)', () => {
    const lines = sanitizeLines(file({ normal: ['  안녕  ', '', '   ', 3, null, { a: 1 }, '또 만났네'] }))
    expect(lines.normal).toEqual(['안녕', '또 만났네'])
  })

  it('최대 길이를 넘는 문장을 제외한다', () => {
    const ok = 'a'.repeat(config.speech.maxLength)
    const long = 'a'.repeat(config.speech.maxLength + 1)
    expect(sanitizeLines(file({ normal: [ok, long] })).normal).toEqual([ok])
  })

  it('분류당 최대 개수까지만 남긴다', () => {
    const many = Array.from({ length: config.speech.maxPerCategory + 10 }, (_, i) => `문장${i}`)
    expect(sanitizeLines(file({ normal: many })).normal).toHaveLength(config.speech.maxPerCategory)
  })

  it('알 수 없는 분류 키는 무시한다', () => {
    const lines = sanitizeLines(file({ normal: ['a'], unknown: ['b'] }))
    expect(Object.keys(lines)).toEqual([...DIALOGUE_CATEGORIES])
  })

  it('버전이 다르거나 형식이 틀리면 모두 빈 목록이다', () => {
    for (const raw of [null, 3, 'x', [], { version: 2, lines: { normal: ['a'] } }, { version: 1 }, { version: 1, lines: 'x' }]) {
      const lines = sanitizeLines(raw)
      expect(DIALOGUE_CATEGORIES.every((c) => lines[c].length === 0)).toBe(true)
    }
  })
})

describe('DEFAULT_LINES', () => {
  it('모든 분류에 문장이 3개 이상 있고 정리를 거쳐도 그대로다', () => {
    for (const c of DIALOGUE_CATEGORIES) expect(DEFAULT_LINES[c].length).toBeGreaterThanOrEqual(3)
    expect(sanitizeLines({ version: 1, lines: DEFAULT_LINES })).toEqual(DEFAULT_LINES)
  })
})

describe('pickLine', () => {
  const random = seededRandom(7)

  it('후보가 없으면 null이다', () => {
    expect(pickLine([], null, random)).toBeNull()
  })

  it('후보가 하나뿐이면 직전 문장이어도 그것을 고른다', () => {
    expect(pickLine(['a'], 'a', random)).toBe('a')
  })

  it('후보가 둘 이상이면 직전 문장을 제외한다 (FR-006)', () => {
    for (let i = 0; i < 50; i++) expect(pickLine(['a', 'b', 'c'], 'b', random)).not.toBe('b')
  })

  it('무작위로 모든 후보가 골라진다', () => {
    const seen = new Set<string>()
    for (let i = 0; i < 100; i++) seen.add(pickLine(['a', 'b', 'c'], null, random)!)
    expect(seen.size).toBe(3)
  })
})
