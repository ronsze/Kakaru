import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterService } from '../../src/main/characters-service'
import { CharacterStore } from '../../src/main/characters-store'
import { ID_PATTERN, LIMITS, type ImageInspector } from '../../src/shared/characters'
import { config } from '../../src/shared/config'
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

describe('CharacterService.apply / delete', () => {
  it('apply(id)로 활성 캐릭터를 바꾸고 appearance가 그 이미지를 돌려준다', () => {
    const { service } = setup()
    const r = service.register(input('가'))
    if (!r.ok) throw new Error('등록 실패')
    expect(service.apply(r.id)).toEqual({ ok: true })
    expect(service.list().activeId).toBe(r.id)
    expect(service.appearance().walkUrl?.startsWith('data:image/png;base64,')).toBe(true)
    expect(service.appearance().frames).toBe(4)
  })

  it('apply(null)은 기본 캐릭터로 되돌린다', () => {
    const { service } = setup()
    const r = service.register(input('가'))
    if (!r.ok) throw new Error('등록 실패')
    service.apply(r.id)
    expect(service.apply(null)).toEqual({ ok: true })
    expect(service.list().activeId).toBeNull()
    expect(service.appearance()).toEqual({ walkUrl: null, idleUrl: null, frames: LIMITS.defaultFrames, scale: 1 })
  })

  it('등록되지 않은 id를 적용하면 실패 메시지를 돌려준다', () => {
    const { service } = setup()
    const r = service.apply('zzzz9999')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.message.length).toBeGreaterThan(0)
  })

  it('delete는 목록에서 지우고, 활성 캐릭터이면 기본으로 돌아간다 (FR-013)', () => {
    const { service } = setup()
    const r = service.register(input('가'))
    if (!r.ok) throw new Error('등록 실패')
    service.apply(r.id)
    expect(service.delete(r.id)).toEqual({ ok: true })
    const list = service.list()
    expect(list.characters.map((c) => c.name)).toEqual([LIMITS.reservedName])
    expect(list.activeId).toBeNull()
  })

  it('기본 캐릭터(null)는 삭제할 수 없다 (FR-014)', () => {
    const { service } = setup()
    const r = service.delete(null as unknown as string)
    expect(r.ok).toBe(false)
  })

  it('활성 캐릭터 이미지가 사라지면 appearance는 기본으로 대체하고 list에 알림이 나타난다 (FR-015)', () => {
    const { service, store } = setup()
    const r = service.register(input('가'))
    if (!r.ok) throw new Error('등록 실패')
    service.apply(r.id)
    rmSync(join(store.characterDir(r.id), 'walk.png'))
    expect(service.appearance()).toEqual({ walkUrl: null, idleUrl: null, frames: LIMITS.defaultFrames, scale: 1 })
    const list = service.list()
    expect(list.notice).toBeTruthy()
    expect(list.activeId).toBeNull()
  })
})

describe('CharacterService.installSamples', () => {
  function sampleDir(): string {
    const dir = mkdtempSync(join(tmpdir(), 'kakaru-sample-'))
    writeFileSync(join(dir, 'walk.png'), makePng({ width: 800, height: 200 }))
    writeFileSync(join(dir, 'idle.png'), makePng({ width: 200, height: 200 }))
    return dir
  }
  const sample = (dir: string) => ({ key: 'bmm', name: '빨간 모자', frames: 4, frameSize: 200, dir })

  it('처음에는 샘플이 등록된 캐릭터로 들어가고 활성 캐릭터는 기본이다', () => {
    const { service } = setup()
    const dir = sampleDir()
    expect(service.installSamples([sample(dir)])).toBe(1)
    const list = service.list()
    expect(list.characters.map((c) => c.name)).toEqual([LIMITS.reservedName, '빨간 모자'])
    expect(list.characters[1]).toMatchObject({ builtin: false, frames: 4, frameSize: 200 })
    expect(list.activeId).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })

  it('다시 호출하거나 삭제한 뒤에도 다시 넣지 않는다', () => {
    const { service } = setup()
    const dir = sampleDir()
    service.installSamples([sample(dir)])
    expect(service.installSamples([sample(dir)])).toBe(0)
    const id = service.list().characters[1].id as string
    service.delete(id)
    expect(service.installSamples([sample(dir)])).toBe(0)
    expect(service.list().characters).toHaveLength(1)
    rmSync(dir, { recursive: true, force: true })
  })

  it('이미지 파일이 없으면 건너뛴다', () => {
    const { service } = setup()
    expect(service.installSamples([sample(join(root, 'nothing'))])).toBe(0)
    expect(service.list().characters).toHaveLength(1)
  })
})

describe('CharacterService.zoom (확대·축소)', () => {
  it('확대하면 한 단계(step)만큼 커지고 appearance에 반영된다', () => {
    const { service } = setup()
    const r = service.zoom(1)
    expect(r.scale).toBe(Math.round((config.scale.default + config.scale.step) * 100) / 100)
    expect(service.appearance().scale).toBe(r.scale)
  })

  it('축소하면 한 단계만큼 작아진다', () => {
    const { service } = setup()
    expect(service.zoom(-1).scale).toBe(Math.round((config.scale.default - config.scale.step) * 100) / 100)
  })

  it('최대에서는 더 커지지 않고 canZoomIn이 false다', () => {
    const { service } = setup()
    let last = service.zoom(1)
    for (let i = 0; i < 100; i++) last = service.zoom(1)
    expect(last.scale).toBe(config.scale.max)
    expect(last.canZoomIn).toBe(false)
    expect(last.canZoomOut).toBe(true)
  })

  it('최소에서는 더 작아지지 않고 canZoomOut이 false다', () => {
    const { service } = setup()
    let last = service.zoom(-1)
    for (let i = 0; i < 100; i++) last = service.zoom(-1)
    expect(last.scale).toBe(config.scale.min)
    expect(last.canZoomOut).toBe(false)
    expect(last.canZoomIn).toBe(true)
  })

  it('zoomState는 현재 크기에서 확대·축소가 가능한지 알려 준다', () => {
    const { service } = setup()
    expect(service.zoomState()).toEqual({ scale: config.scale.default, canZoomIn: true, canZoomOut: true })
  })

  it('확대·축소 여러 번 후에도 크기가 한 단계씩 정확히 변한다 (오차 누적 없음)', () => {
    const { service } = setup()
    for (let i = 0; i < 7; i++) service.zoom(1)
    expect(service.zoomState().scale).toBe(1.7)
    for (let i = 0; i < 3; i++) service.zoom(-1)
    expect(service.zoomState().scale).toBe(1.4)
  })
})
