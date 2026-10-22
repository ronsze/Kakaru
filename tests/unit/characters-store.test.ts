import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterStore } from '../../src/main/characters-store'
import type { CharacterSet } from '../../src/shared/characters'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-store-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const meta = (id = 'abcd1234', name = '고양이'): CharacterSet => ({
  id,
  name,
  frames: 4,
  frameSize: 200,
  createdAt: 1_700_000_000_000
})
const walk = Buffer.from('walk-bytes')
const idle = Buffer.from('idle-bytes')

describe('CharacterStore 로드', () => {
  it('아무것도 없으면 빈 상태로 시작한다', () => {
    const store = new CharacterStore(root)
    store.load()
    expect(store.list()).toEqual([])
    expect(store.getActiveId()).toBeNull()
  })

  it('settings.json이 깨졌으면 .broken-<ms>로 보존하고 빈 상태로 시작한다', () => {
    writeFileSync(join(root, 'settings.json'), '{ 깨진 json')
    const store = new CharacterStore(root)
    store.load()
    expect(store.list()).toEqual([])
    const broken = readdirSync(root).filter((f) => f.startsWith('settings.json.broken-'))
    expect(broken.length).toBe(1)
    expect(readFileSync(join(root, broken[0]), 'utf8')).toBe('{ 깨진 json')
  })

  it('version이 다르면 같은 방식으로 보존하고 빈 상태로 시작한다', () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ version: 2, activeId: null, characters: [] }))
    const store = new CharacterStore(root)
    store.load()
    expect(store.list()).toEqual([])
    expect(readdirSync(root).some((f) => f.startsWith('settings.json.broken-'))).toBe(true)
  })

  it('스키마를 어기면(id 형식) 같은 방식으로 보존하고 빈 상태로 시작한다', () => {
    writeFileSync(
      join(root, 'settings.json'),
      JSON.stringify({ version: 1, activeId: null, characters: [{ ...meta('../evil') }] })
    )
    const store = new CharacterStore(root)
    store.load()
    expect(store.list()).toEqual([])
  })
})

describe('CharacterStore 추가', () => {
  it('이미지를 characters/<id>/에 저장하고 settings.json에 기록한다', () => {
    const store = new CharacterStore(root)
    store.load()
    store.add(meta(), walk, idle)
    expect(readFileSync(join(root, 'characters', 'abcd1234', 'walk.png'))).toEqual(walk)
    expect(readFileSync(join(root, 'characters', 'abcd1234', 'idle.png'))).toEqual(idle)
    const saved = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
    expect(saved).toEqual({ version: 1, activeId: null, characters: [meta()] })
  })

  it('다시 로드해도 유지된다', () => {
    const a = new CharacterStore(root)
    a.load()
    a.add(meta(), walk, idle)
    const b = new CharacterStore(root)
    b.load()
    expect(b.list()).toEqual([meta()])
  })

  it('쓰기 후 임시 파일이 남지 않는다', () => {
    const store = new CharacterStore(root)
    store.load()
    store.add(meta(), walk, idle)
    expect(existsSync(join(root, 'settings.json.tmp'))).toBe(false)
  })

  it('id가 ^[a-z0-9]{8,32}$가 아니면 거부한다 (경로 조작 방지)', () => {
    const store = new CharacterStore(root)
    store.load()
    for (const bad of ['../evil', 'ABCD1234', 'short', 'a/b/c/d/e/f', '']) {
      expect(() => store.add(meta(bad), walk, idle)).toThrow()
    }
    expect(existsSync(join(root, 'characters'))).toBe(false)
  })

  it('이미지 저장 중 실패하면 만든 폴더를 지우고 목록에 추가하지 않는다', () => {
    const store = new CharacterStore(root)
    store.load()
    // idle 쓰기를 실패시키려고 같은 이름의 폴더를 미리 만든다
    const dir = join(root, 'characters', 'abcd1234')
    store.add(meta('zzzz9999'), walk, idle)
    expect(() => store.add(meta(), walk, null as unknown as Buffer)).toThrow()
    expect(existsSync(dir)).toBe(false)
    expect(store.list().map((c) => c.id)).toEqual(['zzzz9999'])
  })
})
