import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterStore } from '../../src/main/characters-store'
import { DEFAULT_LINES, emptyLines } from '../../src/shared/dialogue'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-lines-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const png = Buffer.from([0])
const meta = (id: string, name = '테스트') => ({ id, name, frames: 4, frameSize: 200, createdAt: 1 })

function create() {
  const store = new CharacterStore(root)
  store.load()
  return store
}

function writeLines(id: string, content: string): void {
  mkdirSync(join(root, 'characters', id), { recursive: true })
  writeFileSync(join(root, 'characters', id, 'lines.json'), content)
}

describe('CharacterStore.readLines', () => {
  it('기본 캐릭터는 내장 대화셋이다', () => {
    expect(create().readLines()).toEqual(DEFAULT_LINES)
  })

  it('활성 캐릭터의 lines.json을 읽는다', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    writeLines('abcd1234', JSON.stringify({ version: 1, lines: { normal: ['안녕', '  ', 3] } }))
    store.setActive('abcd1234')
    expect(store.readLines()).toEqual({ greeting: [], normal: ['안녕'], grabbed: [], struggling: [] })
  })

  it('lines.json이 없으면 모든 분류가 비어 있고 기본 문장으로 대체하지 않는다 (FR-013)', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    store.setActive('abcd1234')
    expect(store.readLines()).toEqual(emptyLines())
  })

  it('깨진 JSON도 오류 없이 빈 대화셋이다 (FR-009)', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    writeLines('abcd1234', '{ 깨짐')
    store.setActive('abcd1234')
    expect(store.readLines()).toEqual(emptyLines())
  })

  it('캐릭터를 삭제하면 lines.json도 사라진다', () => {
    const store = create()
    store.add(meta('abcd1234'), png, png)
    writeLines('abcd1234', JSON.stringify({ version: 1, lines: { normal: ['a'] } }))
    store.remove('abcd1234')
    expect(existsSync(join(root, 'characters', 'abcd1234'))).toBe(false)
  })
})
