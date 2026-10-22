import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { CharacterService } from '../../src/main/characters-service'
import { CharacterStore } from '../../src/main/characters-store'
import { buildCharacterPackage, parseCharacterPackage } from '../../src/shared/character-package'
import { ID_PATTERN, LIMITS, type ImageInspector } from '../../src/shared/characters'
import type { RegisterInput } from '../../src/shared/ipc'
import { makePng } from './png-fixture'

let roots: string[]
beforeEach(() => {
  roots = []
})
afterEach(() => {
  for (const root of roots) rmSync(root, { recursive: true, force: true })
})

const alwaysTransparent: ImageInspector = { hasTransparentPixels: () => true }

/** 임시 사용자 데이터 폴더 하나에 저장소와 서비스를 만든다 (PC 한 대) */
function setup() {
  const root = mkdtempSync(join(tmpdir(), 'kakaru-transfer-'))
  roots.push(root)
  const store = new CharacterStore(root)
  store.load()
  return { root, store, service: new CharacterService(store, alwaysTransparent, { now: () => 1234 }) }
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

const savedLines = {
  greeting: ['안녕'],
  normal: ['평소 1', '평소 2'],
  grabbed: [],
  struggling: ['놓아 줘']
}

/** 캐릭터를 등록하고 대사를 저장해 id를 돌려준다 */
function register(service: CharacterService, name = '고양이'): string {
  const result = service.register(input(name))
  if (!result.ok) throw new Error('등록 실패')
  const saved = service.saveLines(result.id, savedLines)
  if (!saved.ok) throw new Error('대사 저장 실패')
  return result.id
}

describe('CharacterService.exportPackage', () => {
  it('등록한 캐릭터를 내보내면 이름·프레임·이미지·저장한 대사가 담긴 파일 내용과 기본 파일 이름을 돌려준다', () => {
    const { store, service } = setup()
    const id = register(service)
    const result = service.exportPackage(id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.suggestedFileName).toBe('고양이.kakaru')

    const parsed = parseCharacterPackage(result.content)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.data.name).toBe('고양이')
    expect(parsed.data.frames).toBe(4)
    expect(Buffer.from(parsed.data.walk, 'base64').equals(store.readImage(id, 'walk')!)).toBe(true)
    expect(Buffer.from(parsed.data.idle, 'base64').equals(store.readImage(id, 'idle')!)).toBe(true)
    expect(parsed.data.lines).toEqual(savedLines)
  })

  it('대사를 저장한 적이 없는 캐릭터도 내보낼 수 있고 네 분류가 모두 빈 목록이다', () => {
    const { service } = setup()
    const registered = service.register(input())
    if (!registered.ok) throw new Error('등록 실패')
    const result = service.exportPackage(registered.id)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const parsed = parseCharacterPackage(result.content)
    expect(parsed.ok && parsed.data.lines).toEqual({ greeting: [], normal: [], grabbed: [], struggling: [] })
  })

  it('파일에 내부 id·시각·경로가 들어가지 않는다', () => {
    const { root, service } = setup()
    const id = register(service)
    const result = service.exportPackage(id)
    if (!result.ok) throw new Error('내보내기 실패')
    expect(result.content).not.toContain(id)
    expect(result.content).not.toContain(root)
    expect(result.content).not.toContain('createdAt')
  })

  it('기본 캐릭터(null)는 내보낼 수 없다', () => {
    const { service } = setup()
    const result = service.exportPackage(null as unknown as string)
    expect(result).toMatchObject({ ok: false })
    expect(result.ok === false && result.message).toMatch(/기본 캐릭터/)
  })

  it('등록되지 않은 id는 거부한다', () => {
    const { service } = setup()
    expect(service.exportPackage('zzzz9999')).toMatchObject({ ok: false })
  })

  it('이미지 파일이 없는 캐릭터는 거부한다', () => {
    const { root, service } = setup()
    const id = register(service)
    rmSync(join(root, 'characters', id, 'walk.png'))
    const result = service.exportPackage(id)
    expect(result).toMatchObject({ ok: false })
    expect(result.ok === false && result.message).toMatch(/이미지/)
  })

  it('내보내기는 저장 데이터를 바꾸지 않는다', () => {
    const { root, store, service } = setup()
    const id = register(service)
    const before = JSON.stringify(store.list())
    const files = readdirSync(join(root, 'characters', id)).sort()
    service.exportPackage(id)
    expect(JSON.stringify(store.list())).toBe(before)
    expect(readdirSync(join(root, 'characters', id)).sort()).toEqual(files)
    expect(existsSync(join(root, 'characters', id, 'lines.json'))).toBe(true)
  })
})

/** 한 PC에서 내보낸 파일 내용 */
function exported(service: CharacterService, id: string): string {
  const result = service.exportPackage(id)
  if (!result.ok) throw new Error('내보내기 실패')
  return result.content
}

describe('CharacterService.importPackage (성공 경로)', () => {
  it('다른 PC에서 내보낸 파일을 가져오면 이름·프레임·이미지·네 분류 대사가 같은 새 캐릭터가 생긴다', () => {
    const a = setup()
    const b = setup()
    const sourceId = register(a.service)
    const result = b.service.importPackage(exported(a.service, sourceId))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.id).toMatch(ID_PATTERN)
    expect(result.name).toBe('고양이')
    expect(b.store.list()).toEqual([
      { id: result.id, name: '고양이', frames: 4, frameSize: 200, createdAt: 1234 }
    ])
    expect(b.store.readImage(result.id, 'walk')!.equals(a.store.readImage(sourceId, 'walk')!)).toBe(true)
    expect(b.store.readImage(result.id, 'idle')!.equals(a.store.readImage(sourceId, 'idle')!)).toBe(true)
    expect(b.store.readLinesOf(result.id)).toEqual(savedLines)
  })

  it('가져와도 현재 적용 중인 캐릭터는 바뀌지 않는다', () => {
    const a = setup()
    const b = setup()
    const sourceId = register(a.service)
    const existing = register(b.service, '기존')
    b.service.apply(existing)
    const result = b.service.importPackage(exported(a.service, sourceId))
    expect(result.ok).toBe(true)
    expect(b.store.getActiveId()).toBe(existing)
  })

  it('같은 파일을 여러 번 가져오면 이름에 번호가 붙고 기존 캐릭터는 그대로다', () => {
    const a = setup()
    const b = setup()
    const content = exported(a.service, register(a.service))
    const first = b.service.importPackage(content)
    const second = b.service.importPackage(content)
    const third = b.service.importPackage(content)
    expect([first, second, third].map((r) => r.ok && r.name)).toEqual(['고양이', '고양이 (2)', '고양이 (3)'])
    expect(b.store.list().map((c) => c.name)).toEqual(['고양이', '고양이 (2)', '고양이 (3)'])
    if (first.ok) expect(b.store.list()[0].id).toBe(first.id)
    expect(new Set(b.store.list().map((c) => c.id)).size).toBe(3)
  })

  it('이름이 최대 길이라 번호를 붙이면 넘을 때는 앞부분을 줄여 최대 길이 이내로 맞춘다', () => {
    const a = setup()
    const b = setup()
    const long = '가'.repeat(LIMITS.maxNameLength)
    const content = exported(a.service, register(a.service, long))
    b.service.importPackage(content)
    const second = b.service.importPackage(content)
    expect(second.ok && second.name.length).toBe(LIMITS.maxNameLength)
    expect(second.ok && second.name.endsWith(' (2)')).toBe(true)
  })

  it('대사가 모두 빈 캐릭터도 가져오고 lines.json이 만들어진다', () => {
    const a = setup()
    const b = setup()
    const registered = a.service.register(input())
    if (!registered.ok) throw new Error('등록 실패')
    const result = b.service.importPackage(exported(a.service, registered.id))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(existsSync(join(b.root, 'characters', result.id, 'lines.json'))).toBe(true)
    expect(b.store.readLinesOf(result.id)).toEqual({ greeting: [], normal: [], grabbed: [], struggling: [] })
  })
})

describe('CharacterService.importPackage (거부)', () => {
  /** 가져오기 전후로 같아야 하는 저장 상태 */
  function snapshot(env: ReturnType<typeof setup>) {
    const dir = join(env.root, 'characters')
    return { list: env.store.list(), dirs: existsSync(dir) ? readdirSync(dir).sort() : [] }
  }

  const png = (width: number, height: number) => makePng({ width, height }).toString('base64')
  const goodWalk = png(800, 200)
  const goodIdle = png(200, 200)

  function pkg(overrides: Partial<Parameters<typeof buildCharacterPackage>[0]> = {}): string {
    return buildCharacterPackage({
      name: '고양이',
      frames: 4,
      walk: goodWalk,
      idle: goodIdle,
      lines: savedLines,
      ...overrides
    })
  }

  function rejects(text: string) {
    const env = setup()
    const before = snapshot(env)
    const result = env.service.importPackage(text)
    expect(result.ok).toBe(false)
    expect(snapshot(env)).toEqual(before)
    if (result.ok) throw new Error('거부되어야 합니다')
    return result
  }

  it('걷기 이미지 크기가 프레임 수와 맞지 않으면 거부하고 걷기 이미지 문구를 details에 담는다', () => {
    const result = rejects(pkg({ walk: png(100, 200) }))
    expect(result.details.some((d) => d.startsWith('걷기 이미지: ') && d.includes('크기가 맞지 않습니다'))).toBe(true)
  })

  it('PNG가 아닌 이미지는 거부한다', () => {
    const result = rejects(pkg({ idle: Buffer.from('png 아님').toString('base64') }))
    expect(result.details.some((d) => d.startsWith('정지 이미지: ') && d.includes('PNG'))).toBe(true)
  })

  it('알파 채널이 없는 이미지는 거부한다', () => {
    const rgb = makePng({ width: 800, height: 200, colorType: 'rgb' }).toString('base64')
    const result = rejects(pkg({ walk: rgb }))
    expect(result.details.some((d) => d.startsWith('걷기 이미지: ') && d.includes('투명'))).toBe(true)
  })

  it('61자 문장은 거부하고 분류 이름과 줄 번호를 details에 담는다', () => {
    const result = rejects(pkg({ lines: { ...savedLines, normal: ['평소', '가'.repeat(61)] } }))
    expect(result.details.some((d) => d.startsWith('대사(평소): ') && d.includes('2번째 줄'))).toBe(true)
  })

  it('한 분류가 51개를 넘으면 거부한다', () => {
    const many = Array.from({ length: 51 }, (_, i) => `문장 ${i}`)
    const result = rejects(pkg({ lines: { ...savedLines, grabbed: many } }))
    expect(result.details.some((d) => d.startsWith('대사(잡혔을 때): ') && d.includes('51개'))).toBe(true)
  })

  it.each([
    ['빈 이름', ''],
    ['공백뿐인 이름', '   '],
    ['31자 이름', '가'.repeat(LIMITS.maxNameLength + 1)],
    ['예약 이름', LIMITS.reservedName]
  ])('이름 규칙을 어기면(%s) 거부한다', (_label, name) => {
    const result = rejects(pkg({ name }))
    expect(result.details.some((d) => d.startsWith('이름: '))).toBe(true)
  })

  it('JSON이 아닌 파일은 캐릭터 파일이 아니거나 손상되었다고 안내한다', () => {
    expect(rejects('아무 텍스트').message).toMatch(/캐릭터 파일이 아니거나 손상/)
  })

  it('새 버전(version 2) 파일은 지원하지 않는 버전이라고 안내한다', () => {
    const v2 = JSON.stringify({ ...JSON.parse(pkg()), version: 2 })
    expect(rejects(v2).message).toMatch(/지원하지 않는 버전/)
  })

  it('base64가 아닌 이미지 데이터는 손상으로 안내한다', () => {
    const broken = JSON.stringify({ ...JSON.parse(pkg()), walk: '이미지!' })
    expect(rejects(broken).message).toMatch(/이미지 데이터가 손상/)
  })

  it('이미지와 대사 위반이 함께 있으면 둘 다 details에 나온다', () => {
    const result = rejects(pkg({ walk: png(100, 200), lines: { ...savedLines, normal: ['가'.repeat(61)] } }))
    expect(result.details.some((d) => d.startsWith('걷기 이미지: '))).toBe(true)
    expect(result.details.some((d) => d.startsWith('대사(평소): '))).toBe(true)
  })

  it('저장 단계가 실패하면 오류 안내만 하고 반쯤 만들어진 캐릭터를 남기지 않는다', () => {
    const env = setup()
    // settings.json.tmp 자리에 폴더를 만들어 저장을 실패시킨다
    mkdirSync(join(env.root, 'settings.json.tmp'), { recursive: true })
    const result = env.service.importPackage(pkg())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.message).toMatch(/등록하지 못했습니다/)
      expect(result.message).not.toContain(env.root)
    }
    expect(env.store.list()).toEqual([])
    expect(readdirSync(join(env.root, 'characters'))).toEqual([])
  })
})
