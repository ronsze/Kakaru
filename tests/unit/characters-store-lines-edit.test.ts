import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterStore } from '../../src/main/characters-store'
import { DEFAULT_LINES, emptyLines, type Lines } from '../../src/shared/dialogue'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-lines-edit-'))
})
afterEach(() => {
  try {
    chmodSync(join(root, 'characters', 'abcd1234'), 0o700)
  } catch {
    /* 없을 수 있다 */
  }
  rmSync(root, { recursive: true, force: true })
})

const png = Buffer.from([0])
const meta = (id: string) => ({ id, name: '테스트', frames: 4, frameSize: 200, createdAt: 1 })
const lines = (normal: string[]): Lines => ({ ...emptyLines(), normal })

function create() {
  const store = new CharacterStore(root)
  store.load()
  return store
}

describe('CharacterStore.writeLines / readLinesOf', () => {
  it('등록 캐릭터의 lines.json을 version 1 형식으로 쓰고 그대로 읽는다', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    store.writeLines('abcd1234', lines(['안녕', '또 봐']))
    const file = JSON.parse(readFileSync(join(root, 'characters', 'abcd1234', 'lines.json'), 'utf8'))
    expect(file.version).toBe(1)
    expect(store.readLinesOf('abcd1234').normal).toEqual(['안녕', '또 봐'])
    expect(readdirSync(join(root, 'characters', 'abcd1234')).some((f) => f.endsWith('.tmp'))).toBe(false)
  })

  it('존재하지 않는 캐릭터에는 쓰지 않는다 (FR-011)', () => {
    const store = create()
    expect(() => store.writeLines('abcd1234', lines(['a']))).toThrow()
    expect(existsSync(join(root, 'characters', 'abcd1234'))).toBe(false)
  })

  it('쓰기에 실패하면 기존 내용이 그대로 남는다 (FR-010)', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    store.writeLines('abcd1234', lines(['옛날 말']))
    chmodSync(join(root, 'characters', 'abcd1234'), 0o500)
    expect(() => store.writeLines('abcd1234', lines(['새 말']))).toThrow()
    chmodSync(join(root, 'characters', 'abcd1234'), 0o700)
    expect(store.readLinesOf('abcd1234').normal).toEqual(['옛날 말'])
  })

  it('손상된 파일은 정상 파일로 덮어쓸 수 있다 (FR-013)', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    writeFileSync(join(root, 'characters', 'abcd1234', 'lines.json'), '{ 깨짐')
    expect(store.readLinesOf('abcd1234')).toEqual(emptyLines())
    store.writeLines('abcd1234', lines(['복구']))
    expect(store.readLinesOf('abcd1234').normal).toEqual(['복구'])
  })
})

describe('기본 캐릭터 편집본', () => {
  it('편집본이 없으면 내장 문장이다', () => {
    expect(create().readLinesOf(null)).toEqual(DEFAULT_LINES)
  })

  it('저장하면 default-lines.json에 쓰고 이후 그 값을 쓴다', () => {
    const store = create()
    store.writeLines(null, lines(['고친 말']))
    expect(existsSync(join(root, 'default-lines.json'))).toBe(true)
    expect(store.readLinesOf(null)).toEqual(lines(['고친 말']))
    expect(store.hasDefaultLinesOverride()).toBe(true)
  })

  it('모두 비운 유효한 편집본은 말하지 않음으로 읽는다', () => {
    const store = create()
    store.writeLines(null, emptyLines())
    expect(store.readLinesOf(null)).toEqual(emptyLines())
  })

  it('깨진 편집본은 내장 문장으로 되돌아간다', () => {
    const store = create()
    writeFileSync(join(root, 'default-lines.json'), '{ 깨짐')
    expect(store.readLinesOf(null)).toEqual(DEFAULT_LINES)
  })

  it('resetDefaultLines는 편집본을 지워 내장 문장으로 돌아간다', () => {
    const store = create()
    store.writeLines(null, lines(['고친 말']))
    store.resetDefaultLines()
    expect(store.readLinesOf(null)).toEqual(DEFAULT_LINES)
    expect(store.hasDefaultLinesOverride()).toBe(false)
  })

  it('readLines는 활성 캐릭터의 편집본을 읽는다', () => {
    const store = create()
    store.writeLines(null, lines(['기본 편집']))
    expect(store.readLines().normal).toEqual(['기본 편집'])
    store.add(meta('abcd1234'), png, png)
    store.setActive('abcd1234')
    expect(store.readLines()).toEqual(emptyLines())
  })
})

describe('인사 분류가 생기기 전의 기본 캐릭터 편집본', () => {
  it('greeting 항목이 없는 편집본은 내장 인사를 쓰고 나머지는 편집본을 따른다', () => {
    const store = create()
    writeFileSync(join(root, 'default-lines.json'), JSON.stringify({ version: 1, lines: { normal: ['옛 편집'] } }))
    const lines = store.readLinesOf(null)
    expect(lines.normal).toEqual(['옛 편집'])
    expect(lines.greeting).toEqual(DEFAULT_LINES.greeting)
  })

  it('greeting 항목이 비어 있으면(저장한 값) 인사하지 않는다', () => {
    const store = create()
    writeFileSync(join(root, 'default-lines.json'), JSON.stringify({ version: 1, lines: { greeting: [], normal: ['a'] } }))
    expect(store.readLinesOf(null).greeting).toEqual([])
  })
})
