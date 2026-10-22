import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
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

describe('CharacterStore 추가 (대사 동시 저장)', () => {
  const lines = { greeting: ['안녕'], normal: ['평소'], grabbed: [], struggling: ['놓아 줘'] }

  it('lines를 주면 이미지와 함께 lines.json을 쓰고 readLinesOf가 그대로 돌려준다', () => {
    const store = new CharacterStore(root)
    store.load()
    store.add(meta(), walk, idle, undefined, lines)
    const file = JSON.parse(readFileSync(join(root, 'characters', 'abcd1234', 'lines.json'), 'utf8'))
    expect(file).toEqual({ version: 1, lines })
    expect(store.readLinesOf('abcd1234')).toEqual(lines)
  })

  it('lines를 주지 않으면 lines.json이 생기지 않는다', () => {
    const store = new CharacterStore(root)
    store.load()
    store.add(meta(), walk, idle)
    expect(existsSync(join(root, 'characters', 'abcd1234', 'lines.json'))).toBe(false)
  })

  it('settings.json 저장이 실패하면 만든 폴더(이미지·lines.json)가 지워지고 목록에 추가되지 않는다', () => {
    const store = new CharacterStore(root)
    store.load()
    // settings.json.tmp 자리에 폴더를 만들어 저장을 실패시킨다
    mkdirSync(join(root, 'settings.json.tmp'), { recursive: true })
    expect(() => store.add(meta(), walk, idle, undefined, lines)).toThrow()
    expect(existsSync(join(root, 'characters', 'abcd1234'))).toBe(false)
    expect(store.list()).toEqual([])
  })
})

describe('CharacterStore 샘플 등록', () => {
  it('샘플을 처음 한 번만 등록하고 활성 캐릭터는 바꾸지 않는다', () => {
    const store = new CharacterStore(root)
    store.load()
    expect(store.seedSample('bmm', meta('sample01', '빨간 모자'), walk, idle)).toBe(true)
    expect(store.list().map((c) => c.name)).toEqual(['빨간 모자'])
    expect(store.getActiveId()).toBeNull()
    expect(store.seedSample('bmm', meta('sample02', '다른 이름'), walk, idle)).toBe(false)
    expect(store.list()).toHaveLength(1)
  })

  it('삭제한 뒤 다시 로드해도 샘플을 다시 넣지 않는다', () => {
    const a = new CharacterStore(root)
    a.load()
    a.seedSample('bmm', meta('sample01', '빨간 모자'), walk, idle)
    a.remove('sample01')
    const b = new CharacterStore(root)
    b.load()
    expect(b.seedSample('bmm', meta('sample03', '빨간 모자'), walk, idle)).toBe(false)
    expect(b.list()).toEqual([])
  })

  it('settings.json에 등록한 샘플 키가 기록된다', () => {
    const store = new CharacterStore(root)
    store.load()
    store.seedSample('bmm', meta('sample01', '빨간 모자'), walk, idle)
    const saved = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
    expect(saved.seeded).toEqual(['bmm'])
  })

  it('seeded가 문자열 배열이 아니면 손상으로 보고 빈 상태로 시작한다', () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ version: 1, activeId: null, characters: [], seeded: 'bmm' }))
    const store = new CharacterStore(root)
    store.load()
    expect(readdirSync(root).some((f) => f.startsWith('settings.json.broken-'))).toBe(true)
  })
})
