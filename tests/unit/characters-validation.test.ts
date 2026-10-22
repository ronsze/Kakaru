import { describe, expect, it } from 'vitest'
import {
  LIMITS,
  validateRegistration,
  type ImageInspector,
  type RegistrationInput
} from '../../src/shared/characters'
import { makeJpegLike, makePng, makeTruncatedPng } from './png-fixture'

/** 알파 값이 255가 아닌 픽셀이 있는지는 입력 바이트에 따라 정한다 (nativeImage 대신) */
function inspector(opaque: Set<Uint8Array> = new Set(), corrupt: Set<Uint8Array> = new Set()): ImageInspector {
  return {
    hasTransparentPixels(bytes) {
      if (corrupt.has(bytes)) return 'corrupt'
      return !opaque.has(bytes)
    }
  }
}

const S = 200
const walk = () => makePng({ width: S * 4, height: S })
const idle = () => makePng({ width: S, height: S })

function input(overrides: Partial<RegistrationInput> = {}): RegistrationInput {
  return { name: '고양이', frames: 4, walk: walk(), idle: idle(), ...overrides }
}

function codes(result: ReturnType<typeof validateRegistration>): string[] {
  return result.ok ? [] : result.errors.map((e) => e.code)
}

describe('validateRegistration 정상', () => {
  it('올바른 입력이면 ok와 프레임 한 변 크기를 돌려준다', () => {
    expect(validateRegistration(input(), inspector(), [])).toEqual({ ok: true, frameSize: S })
  })

  it('경계값(프레임 수 2와 32, 한 변 64와 512, 이름 1자와 30자)은 통과한다', () => {
    expect(
      validateRegistration(
        input({ frames: 2, name: 'a', walk: makePng({ width: 128, height: 64 }), idle: makePng({ width: 64, height: 64 }) }),
        inspector(),
        []
      )
    ).toEqual({ ok: true, frameSize: 64 })
    expect(
      validateRegistration(
        input({
          frames: 32,
          name: '가'.repeat(30),
          walk: makePng({ width: 512 * 32, height: 512 }),
          idle: makePng({ width: 512, height: 512 })
        }),
        inspector(),
        []
      )
    ).toEqual({ ok: true, frameSize: 512 })
  })
})

describe('validateRegistration 형식·용량·손상', () => {
  it('PNG가 아니면 not-png', () => {
    const r = validateRegistration(input({ walk: makeJpegLike() }), inspector(), [])
    expect(codes(r)).toEqual(['not-png'])
    if (!r.ok) expect(r.errors[0].target).toBe('walk')
  })

  it('5MB를 넘으면 too-large (헤더를 읽기 전에 거른다)', () => {
    const big = new Uint8Array(LIMITS.maxImageBytes + 1)
    expect(codes(validateRegistration(input({ idle: big }), inspector(), []))).toEqual(['too-large'])
  })

  it('정확히 5MB는 크기 오류가 아니다', () => {
    const exact = new Uint8Array(LIMITS.maxImageBytes) // PNG가 아니므로 not-png만 나온다
    expect(codes(validateRegistration(input({ idle: exact }), inspector(), []))).toEqual(['not-png'])
  })

  it('헤더가 잘린 PNG는 corrupt-image', () => {
    expect(codes(validateRegistration(input({ walk: makeTruncatedPng() }), inspector(), []))).toEqual(['corrupt-image'])
  })

  it('디코딩할 수 없는 이미지는 corrupt-image', () => {
    const w = walk()
    expect(codes(validateRegistration(input({ walk: w }), inspector(new Set(), new Set([w])), []))).toEqual([
      'corrupt-image'
    ])
  })
})

describe('validateRegistration 프레임 수와 크기', () => {
  it('프레임 수가 0, 1, 33이거나 정수가 아니면 bad-frame-count', () => {
    for (const frames of [0, 1, 33, 2.5, Number.NaN]) {
      expect(codes(validateRegistration(input({ frames }), inspector(), []))).toContain('bad-frame-count')
    }
  })

  it('걷기 이미지 너비가 높이×프레임 수가 아니면 bad-walk-size', () => {
    expect(codes(validateRegistration(input({ frames: 5 }), inspector(), []))).toEqual(['bad-walk-size'])
  })

  it('프레임 한 변이 63이거나 513이면 bad-walk-size', () => {
    for (const side of [63, 513]) {
      const r = validateRegistration(
        input({ frames: 2, walk: makePng({ width: side * 2, height: side }), idle: makePng({ width: side, height: side }) }),
        inspector(),
        []
      )
      expect(codes(r)).toContain('bad-walk-size')
    }
  })

  it('정지 이미지가 정사각형이 아니면 bad-idle-size', () => {
    expect(codes(validateRegistration(input({ idle: makePng({ width: S, height: S + 10 }) }), inspector(), []))).toEqual([
      'bad-idle-size'
    ])
  })

  it('정지 이미지 한 변이 걷기 프레임과 다르면 bad-idle-size', () => {
    expect(codes(validateRegistration(input({ idle: makePng({ width: 100, height: 100 }) }), inspector(), []))).toEqual([
      'bad-idle-size'
    ])
  })
})

describe('validateRegistration 투명 배경', () => {
  it('걷기 이미지가 불투명이면 not-transparent (target walk)', () => {
    const w = walk()
    const r = validateRegistration(input({ walk: w }), inspector(new Set([w])), [])
    expect(codes(r)).toEqual(['not-transparent'])
    if (!r.ok) expect(r.errors[0].target).toBe('walk')
  })

  it('정지 이미지가 불투명이면 not-transparent (target idle)', () => {
    const i = idle()
    const r = validateRegistration(input({ idle: i }), inspector(new Set([i])), [])
    expect(codes(r)).toEqual(['not-transparent'])
    if (!r.ok) expect(r.errors[0].target).toBe('idle')
  })

  it('알파 채널이 없는 RGB PNG는 디코딩 없이 not-transparent', () => {
    const rgb = makePng({ width: S * 4, height: S, colorType: 'rgb' })
    const r = validateRegistration(input({ walk: rgb }), inspector(), [])
    expect(codes(r)).toEqual(['not-transparent'])
  })
})

describe('validateRegistration 이름', () => {
  it('빈 이름·공백뿐인 이름·31자는 bad-name', () => {
    for (const name of ['', '   ', '가'.repeat(31)]) {
      expect(codes(validateRegistration(input({ name }), inspector(), []))).toEqual(['bad-name'])
    }
  })

  it('예약어 "기본"은 bad-name', () => {
    expect(codes(validateRegistration(input({ name: ' 기본 ' }), inspector(), []))).toEqual(['bad-name'])
  })

  it('앞뒤 공백을 제거한 이름이 기존 이름과 대소문자 무시로 같으면 duplicate-name', () => {
    expect(codes(validateRegistration(input({ name: '  Cat ' }), inspector(), ['cat']))).toEqual(['duplicate-name'])
  })
})

describe('validateRegistration 여러 오류', () => {
  it('여러 오류를 한 번에 모두 돌려준다', () => {
    const r = validateRegistration(input({ name: '', frames: 1, walk: makeJpegLike() }), inspector(), [])
    expect(codes(r).sort()).toEqual(['bad-frame-count', 'bad-name', 'not-png'].sort())
  })

  it('모든 오류에 한국어 설명이 있다', () => {
    const r = validateRegistration(input({ name: '', frames: 1, walk: makeJpegLike() }), inspector(), [])
    if (r.ok) throw new Error('오류가 있어야 한다')
    for (const e of r.errors) expect(e.message.length).toBeGreaterThan(5)
  })
})
