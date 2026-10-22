import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterService } from '../../src/main/characters-service'
import { CharacterStore } from '../../src/main/characters-store'
import { ID_PATTERN, LIMITS, type ImageInspector } from '../../src/shared/characters'
import type { RegisterInput } from '../../src/shared/ipc'
import { makePng } from './png-fixture'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-service-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const alwaysTransparent: ImageInspector = { hasTransparentPixels: () => true }

function setup() {
  const store = new CharacterStore(root)
  store.load()
  return { store, service: new CharacterService(store, alwaysTransparent, { now: () => 1234 }) }
}

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}

function input(name = '고양이', frames = 4, side = 200): RegisterInput {
  return {
    name,
    frames,
    walk: toArrayBuffer(makePng({ width: side * frames, height: side })),
    idle: toArrayBuffer(makePng({ width: side, height: side }))
  }
}

describe('CharacterService.list', () => {
  it('처음에는 기본 캐릭터만 있고 활성은 null이다', () => {
    const { service } = setup()
    const list = service.list()
    expect(list.activeId).toBeNull()
    expect(list.characters).toHaveLength(1)
    expect(list.characters[0]).toMatchObject({
      id: null,
      name: LIMITS.reservedName,
      builtin: true,
      frames: LIMITS.defaultFrames,
      idleUrl: ''
    })
  })

  it('등록한 캐릭터가 기본 캐릭터 아래에 등록 순서대로 나타나고 정지 이미지가 data URL이다', () => {
    const { service } = setup()
    service.register(input('가'))
    service.register(input('나'))
    const names = service.list().characters.map((c) => c.name)
    expect(names).toEqual([LIMITS.reservedName, '가', '나'])
    expect(service.list().characters[1].idleUrl.startsWith('data:image/png;base64,')).toBe(true)
  })
})

describe('CharacterService.validate', () => {
  it('저장하지 않고 검사 결과만 돌려준다', () => {
    const { service, store } = setup()
    expect(service.validate(input())).toEqual({ ok: true, frameSize: 200 })
    expect(store.list()).toEqual([])
  })

  it('이미 등록된 이름은 duplicate-name', () => {
    const { service } = setup()
    service.register(input('고양이'))
    const r = service.validate(input(' 고양이 '))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.errors.map((e) => e.code)).toEqual(['duplicate-name'])
  })
})

describe('CharacterService.register', () => {
  it('앞뒤 공백을 지운 이름과 프레임 크기로 저장하고 활성 캐릭터는 바꾸지 않는다', () => {
    const { service, store } = setup()
    const r = service.register(input('  고양이  '))
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(ID_PATTERN.test(r.id)).toBe(true)
    expect(store.list()).toEqual([
      { id: r.id, name: '고양이', frames: 4, frameSize: 200, createdAt: 1234 }
    ])
    expect(store.getActiveId()).toBeNull()
    expect(readdirSync(join(root, 'characters', r.id)).sort()).toEqual(['idle.png', 'walk.png'])
  })

  it('검증에 실패하면 저장하지 않는다', () => {
    const { service, store } = setup()
    const r = service.register(input('', 4))
    expect(r.ok).toBe(false)
    expect(store.list()).toEqual([])
  })

  it('ArrayBuffer가 아닌 입력은 거부한다', () => {
    const { service } = setup()
    expect(() => service.register({ ...input(), walk: 'x' as unknown as ArrayBuffer })).toThrow()
  })
})
