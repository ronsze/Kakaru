import { describe, expect, it } from 'vitest'
import {
  buildCharacterPackage,
  exportFileName,
  parseCharacterPackage,
  uniqueName
} from '../../src/shared/character-package'
import { LIMITS } from '../../src/shared/characters'

const lines = {
  greeting: ['안녕'],
  normal: ['평소 1', '평소 2'],
  grabbed: [],
  struggling: ['놓아 줘']
}

const base = { name: '고양이', frames: 4, walk: 'd2Fsaw==', idle: 'aWRsZQ==', lines }

function valid(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({ format: 'kakaru-character', version: 1, ...base, ...overrides })
}

describe('buildCharacterPackage / parseCharacterPackage', () => {
  it('만든 파일을 해석하면 이름·프레임·이미지·네 분류 대사가 그대로 돌아온다', () => {
    const result = parseCharacterPackage(buildCharacterPackage(base))
    expect(result).toEqual({ ok: true, data: base })
  })

  it('format과 version이 들어 있고 id·시각·경로 같은 환경 정보는 없다', () => {
    const parsed = JSON.parse(buildCharacterPackage(base))
    expect(parsed.format).toBe('kakaru-character')
    expect(parsed.version).toBe(1)
    expect(Object.keys(parsed).sort()).toEqual(['format', 'frames', 'idle', 'lines', 'name', 'version', 'walk'])
  })

  it('JSON이 아니면 not-package', () => {
    expect(parseCharacterPackage('이건 텍스트')).toMatchObject({ ok: false, code: 'not-package' })
  })

  it.each([[`[]`], [`"문자열"`], [`null`], [JSON.stringify({ ...base, version: 1 })], [valid({ format: 'other' })]])(
    '객체가 아니거나 format이 다르면 not-package: %s',
    (text) => {
      expect(parseCharacterPackage(text)).toMatchObject({ ok: false, code: 'not-package' })
    }
  )

  it('version이 1보다 큰 정수면 unsupported-version', () => {
    expect(parseCharacterPackage(valid({ version: 2 }))).toMatchObject({ ok: false, code: 'unsupported-version' })
  })

  it.each([['1'], [1.5], [0], [-1], [null]])('version이 %j이면 bad-field', (version) => {
    expect(parseCharacterPackage(valid({ version }))).toMatchObject({ ok: false, code: 'bad-field' })
  })

  it.each([
    ['name 누락', { name: undefined }],
    ['name이 숫자', { name: 3 }],
    ['frames 누락', { frames: undefined }],
    ['frames가 문자열', { frames: '4' }],
    ['frames가 소수', { frames: 4.5 }],
    ['walk 누락', { walk: undefined }],
    ['walk가 빈 문자열', { walk: '' }],
    ['idle이 숫자', { idle: 7 }],
    ['lines가 배열', { lines: [] }],
    ['lines 값이 문자열', { lines: { normal: '평소' } }],
    ['lines 항목이 문자열이 아님', { lines: { normal: ['가', 3] } }]
  ])('필수 필드 누락·형식 오류는 bad-field: %s', (_label, overrides) => {
    expect(parseCharacterPackage(valid(overrides))).toMatchObject({ ok: false, code: 'bad-field' })
  })

  it.each([['이미지!'], ['abc'], ['ab=c'], ['a b c d']])('walk·idle이 base64가 아니면 bad-base64: %j', (text) => {
    expect(parseCharacterPackage(valid({ walk: text }))).toMatchObject({ ok: false, code: 'bad-base64' })
    expect(parseCharacterPackage(valid({ idle: text }))).toMatchObject({ ok: false, code: 'bad-base64' })
  })

  it('lines가 없으면 모든 분류가 비어 있는 것으로 본다 (일부 분류만 있어도 성공)', () => {
    const none = JSON.parse(valid())
    delete none.lines
    expect(parseCharacterPackage(JSON.stringify(none))).toMatchObject({ ok: true, data: { lines: {} } })
    expect(parseCharacterPackage(valid({ lines: { normal: ['가'] } }))).toMatchObject({
      ok: true,
      data: { lines: { normal: ['가'] } }
    })
  })

  it('알 수 없는 최상위 키와 lines 키는 무시한다', () => {
    const result = parseCharacterPackage(valid({ extra: 1, lines: { normal: ['가'], future: ['x'] } }))
    expect(result).toMatchObject({ ok: true })
    if (result.ok) {
      expect(result.data).not.toHaveProperty('extra')
      expect(result.data.lines).toEqual({ normal: ['가'] })
    }
  })

  it('오류에는 사용자에게 보여 줄 한국어 message가 있다', () => {
    const result = parseCharacterPackage('x')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/캐릭터 파일/)
  })
})

describe('exportFileName', () => {
  it('이름에 .kakaru를 붙인다', () => {
    expect(exportFileName('나')).toBe('나.kakaru')
  })

  it('파일명에 쓸 수 없는 문자와 제어 문자는 _로 바꾼다', () => {
    expect(exportFileName('a\\b/c:d*e?f"g<h>i|j\nk')).toBe('a_b_c_d_e_f_g_h_i_j_k.kakaru')
  })

  it('앞뒤 공백과 마침표는 지운다', () => {
    expect(exportFileName('  . 고양이 . ')).toBe('고양이.kakaru')
  })

  it('비면 character를 쓴다', () => {
    expect(exportFileName('  ')).toBe('character.kakaru')
    expect(exportFileName('...')).toBe('character.kakaru')
  })
})

describe('uniqueName', () => {
  it('겹치지 않으면 그대로다', () => {
    expect(uniqueName('고양이', ['강아지'])).toBe('고양이')
  })

  it('겹치면(대소문자 무시) 비어 있는 첫 번호를 붙인다', () => {
    expect(uniqueName('Cat', ['cat'])).toBe('Cat (2)')
    expect(uniqueName('Cat', ['cat', 'Cat (2)'])).toBe('Cat (3)')
    expect(uniqueName('Cat', ['cat', 'Cat (3)'])).toBe('Cat (2)')
  })

  it('번호를 붙여 최대 길이를 넘으면 앞부분을 줄여 맞춘다', () => {
    const name = '가'.repeat(LIMITS.maxNameLength)
    const result = uniqueName(name, [name])
    expect(result).toBe(`${'가'.repeat(LIMITS.maxNameLength - 4)} (2)`)
    expect(result.length).toBe(LIMITS.maxNameLength)
  })
})
