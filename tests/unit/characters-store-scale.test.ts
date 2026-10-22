import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterStore } from '../../src/main/characters-store'
import { config } from '../../src/shared/config'

let root: string
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'kakaru-scale-'))
})
afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

function create() {
  const store = new CharacterStore(root)
  store.load()
  return store
}

describe('CharacterStore 크기(scale)', () => {
  it('처음에는 기본 크기다', () => {
    expect(create().getScale()).toBe(config.scale.default)
  })

  it('크기를 저장하고 다시 로드해도 유지한다', () => {
    const store = create()
    store.setScale(1.5)
    expect(store.getScale()).toBe(1.5)
    const again = new CharacterStore(root)
    again.load()
    expect(again.getScale()).toBe(1.5)
    expect(JSON.parse(readFileSync(join(root, 'settings.json'), 'utf8')).scale).toBe(1.5)
  })

  it('최소·최대 범위로 제한한다', () => {
    const store = create()
    store.setScale(100)
    expect(store.getScale()).toBe(config.scale.max)
    store.setScale(0.01)
    expect(store.getScale()).toBe(config.scale.min)
  })

  it('소수 둘째 자리로 반올림해 부동소수점 오차가 쌓이지 않는다', () => {
    const store = create()
    store.setScale(1.1 + 0.2) // 1.3000000000000003
    expect(store.getScale()).toBe(1.3)
  })

  it('숫자가 아닌 값은 거부한다', () => {
    const store = create()
    expect(() => store.setScale(Number.NaN)).toThrow()
    expect(store.getScale()).toBe(config.scale.default)
  })

  it('저장된 값이 범위를 벗어나 있으면 로드할 때 범위로 맞춘다', () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ version: 1, activeId: null, characters: [], scale: 9 }))
    const store = new CharacterStore(root)
    store.load()
    expect(store.getScale()).toBe(config.scale.max)
  })

  it('저장된 크기가 숫자가 아니면 손상으로 보고 기본 크기로 시작한다', () => {
    writeFileSync(join(root, 'settings.json'), JSON.stringify({ version: 1, activeId: null, characters: [], scale: 'big' }))
    const store = new CharacterStore(root)
    store.load()
    expect(store.getScale()).toBe(config.scale.default)
  })

  it('readAppearance에 현재 크기가 들어간다 (기본 캐릭터도 동일)', () => {
    const store = create()
    store.setScale(2)
    expect(store.readAppearance().scale).toBe(2)
  })
})
