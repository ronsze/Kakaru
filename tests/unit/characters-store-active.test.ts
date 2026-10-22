import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterStore } from '../../src/main/characters-store'
import { LIMITS, type CharacterSet } from '../../src/shared/characters'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-active-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

const meta = (id: string, name = id, frames = 6): CharacterSet => ({
  id,
  name,
  frames,
  frameSize: 128,
  createdAt: 1
})
const walk = Buffer.from('walk-bytes')
const idle = Buffer.from('idle-bytes')
const dataUrl = (b: Buffer) => `data:image/png;base64,${b.toString('base64')}`

function create() {
  const store = new CharacterStore(root)
  store.load()
  store.add(meta('aaaa1111'), walk, idle)
  store.add(meta('bbbb2222'), walk, idle)
  return store
}

describe('setActive', () => {
  it('활성 캐릭터를 저장하고 다시 로드해도 유지한다 (FR-012)', () => {
    const store = create()
    store.setActive('bbbb2222')
    expect(store.getActiveId()).toBe('bbbb2222')
    const again = new CharacterStore(root)
    again.load()
    expect(again.getActiveId()).toBe('bbbb2222')
  })

  it('없는 id는 거부하고 활성 캐릭터를 바꾸지 않는다', () => {
    const store = create()
    store.setActive('aaaa1111')
    expect(() => store.setActive('cccc3333')).toThrow()
    expect(store.getActiveId()).toBe('aaaa1111')
  })

  it('null은 기본 캐릭터로 되돌린다 (FR-014)', () => {
    const store = create()
    store.setActive('aaaa1111')
    store.setActive(null)
    expect(store.getActiveId()).toBeNull()
    const again = new CharacterStore(root)
    again.load()
    expect(again.getActiveId()).toBeNull()
  })
})

describe('remove', () => {
  it('목록과 이미지 폴더를 지운다', () => {
    const store = create()
    store.remove('aaaa1111')
    expect(store.list().map((c) => c.id)).toEqual(['bbbb2222'])
    expect(existsSync(join(root, 'characters', 'aaaa1111'))).toBe(false)
    const saved = JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8'))
    expect(saved.characters.map((c: CharacterSet) => c.id)).toEqual(['bbbb2222'])
  })

  it('활성 캐릭터를 지우면 활성이 null이 된다 (FR-013)', () => {
    const store = create()
    store.setActive('aaaa1111')
    store.remove('aaaa1111')
    expect(store.getActiveId()).toBeNull()
  })

  it('다른 캐릭터를 지워도 활성은 유지된다', () => {
    const store = create()
    store.setActive('bbbb2222')
    store.remove('aaaa1111')
    expect(store.getActiveId()).toBe('bbbb2222')
  })

  it('없는 id는 거부한다', () => {
    const store = create()
    expect(() => store.remove('cccc3333')).toThrow()
  })

  it('폴더 삭제가 실패해도 목록에서는 사라진 상태를 유지한다', () => {
    const store = create()
    // 폴더를 미리 지워 두면 rmSync(force)가 조용히 넘어가지만, 목록 갱신이 폴더에 의존하지 않음을 확인한다
    rmSync(join(root, 'characters', 'aaaa1111'), { recursive: true, force: true })
    expect(() => store.remove('aaaa1111')).not.toThrow()
    expect(store.list().map((c) => c.id)).toEqual(['bbbb2222'])
  })
})

describe('readAppearance', () => {
  it('기본 캐릭터이면 이미지 URL은 null이고 프레임 수는 기본값이다', () => {
    const store = create()
    expect(store.readAppearance()).toEqual({ walkUrl: null, idleUrl: null, frames: LIMITS.defaultFrames, scale: 1 })
  })

  it('사용자 캐릭터이면 이미지의 data URL과 프레임 수를 돌려준다', () => {
    const store = create()
    store.setActive('aaaa1111')
    expect(store.readAppearance()).toEqual({ walkUrl: dataUrl(walk), idleUrl: dataUrl(idle), frames: 6, scale: 1 })
  })

  it('활성 캐릭터의 이미지 파일이 없으면 기본 외형으로 대체하고 알림을 남긴다 (FR-015)', () => {
    const store = create()
    store.setActive('aaaa1111')
    rmSync(join(root, 'characters', 'aaaa1111', 'walk.png'))
    expect(store.readAppearance()).toEqual({ walkUrl: null, idleUrl: null, frames: LIMITS.defaultFrames, scale: 1 })
    expect(store.getActiveId()).toBeNull()
    expect(store.takeNotice()).toContain('aaaa1111') // meta()의 이름 기본값은 id
  })
})

describe('시작 시 활성 캐릭터 점검', () => {
  it('활성 캐릭터의 이미지가 사라진 채 시작하면 기본으로 되돌리고 알림을 남긴다 (FR-015)', () => {
    const store = create()
    store.setActive('aaaa1111')
    rmSync(join(root, 'characters', 'aaaa1111', 'idle.png'))
    const again = new CharacterStore(root)
    again.load()
    expect(again.getActiveId()).toBeNull()
    expect(again.takeNotice()).toBeTruthy()
    expect(again.takeNotice()).toBeUndefined() // 한 번 읽으면 지운다
  })
})
