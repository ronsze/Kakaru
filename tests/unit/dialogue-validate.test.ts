import { describe, expect, it } from 'vitest'
import { DIALOGUE_CATEGORIES, validateLinesInput } from '../../src/shared/dialogue'
import { config } from '../../src/shared/config'

const input = (normal: string[], extra: Record<string, string[]> = {}) => ({ normal, ...extra })

describe('validateLinesInput', () => {
  it('줄바꿈으로 문장을 나누고 앞뒤 공백을 지운다 (FR-006)', () => {
    const r = validateLinesInput(input(['  안녕  \r\n반가워\n\n  또 봐 ']))
    expect(r.ok).toBe(true)
    expect(r.lines.normal).toEqual(['안녕', '반가워', '또 봐'])
  })

  it('모든 분류 키를 결과에 포함한다', () => {
    const r = validateLinesInput(input(['a']))
    expect(Object.keys(r.lines)).toEqual([...DIALOGUE_CATEGORIES])
    expect(r.lines.grabbed).toEqual([])
  })

  it('빈 문장은 오류 없이 제외하고 dropped로 센다', () => {
    const r = validateLinesInput(input(['a\n\n  \nb']))
    expect(r.ok).toBe(true)
    expect(r.lines.normal).toEqual(['a', 'b'])
    expect(r.dropped).toBe(2)
  })

  it('완전히 비어 있는 입력란은 정리한 줄로 세지 않는다', () => {
    const r = validateLinesInput(input([''], { grabbed: [''], struggling: [] }))
    expect(r.ok).toBe(true)
    expect(r.dropped).toBe(0)
  })

  it('같은 분류의 중복은 합치고 merged로 센다 (FR-005)', () => {
    const r = validateLinesInput(input(['a', 'b', 'a', ' a '], { grabbed: ['a'] }))
    expect(r.lines.normal).toEqual(['a', 'b'])
    expect(r.lines.grabbed).toEqual(['a']) // 다른 분류의 같은 문장은 합치지 않는다
    expect(r.merged).toBe(2)
  })

  it('60자를 넘는 문장은 줄 번호와 글자 수가 있는 too-long 오류다 (FR-004)', () => {
    const long = 'a'.repeat(config.speech.maxLength + 1)
    const r = validateLinesInput(input([`짧은 문장\n${long}`]))
    expect(r.ok).toBe(false)
    expect(r.issues).toHaveLength(1)
    expect(r.issues[0]).toMatchObject({ category: 'normal', line: 2, code: 'too-long' })
    expect(r.issues[0].message).toContain(String(config.speech.maxLength + 1))
  })

  it('정확히 60자는 통과한다', () => {
    expect(validateLinesInput(input(['a'.repeat(config.speech.maxLength)])).ok).toBe(true)
  })

  it('한 분류가 50개를 넘으면 too-many 오류다 (FR-004)', () => {
    const many = Array.from({ length: config.speech.maxPerCategory + 1 }, (_, i) => `문장${i}`).join('\n')
    const r = validateLinesInput(input([many]))
    expect(r.ok).toBe(false)
    expect(r.issues).toEqual([expect.objectContaining({ category: 'normal', code: 'too-many' })])
    expect(r.issues[0].message).toContain(String(config.speech.maxPerCategory + 1))
  })

  it('정확히 50개는 통과한다', () => {
    const fifty = Array.from({ length: config.speech.maxPerCategory }, (_, i) => `문장${i}`).join('\n')
    expect(validateLinesInput(input([fifty])).ok).toBe(true)
  })

  it('중복·빈 줄을 정리한 뒤의 개수로 50개를 센다', () => {
    const lines = Array.from({ length: config.speech.maxPerCategory }, (_, i) => `문장${i}`)
    const r = validateLinesInput(input([[...lines, '문장0', '', '  '].join('\n')]))
    expect(r.ok).toBe(true)
  })

  it('분류별로 독립적으로 검사한다', () => {
    const r = validateLinesInput(input(['a'], { struggling: ['x'.repeat(61)] }))
    expect(r.issues.map((i) => i.category)).toEqual(['struggling'])
  })
})
