import { describe, expect, it } from 'vitest'
import { parsePngHeader } from '../../src/shared/characters'
import { makeJpegLike, makePng, makeTruncatedPng } from './png-fixture'

describe('parsePngHeader', () => {
  it('유효한 PNG의 너비·높이·색상 유형·비트 깊이를 읽는다', () => {
    const header = parsePngHeader(makePng({ width: 800, height: 200 }))
    expect(header).toEqual({ ok: true, width: 800, height: 200, colorType: 6, bitDepth: 8 })
  })

  it('RGB PNG는 색상 유형 2로 읽는다', () => {
    const header = parsePngHeader(makePng({ width: 64, height: 64, colorType: 'rgb' }))
    expect(header).toMatchObject({ ok: true, colorType: 2 })
  })

  it('시그니처가 PNG가 아니면 not-png', () => {
    expect(parsePngHeader(makeJpegLike())).toEqual({ ok: false, reason: 'not-png' })
  })

  it('빈 파일과 8바이트 미만 파일은 not-png', () => {
    expect(parsePngHeader(new Uint8Array(0))).toEqual({ ok: false, reason: 'not-png' })
    expect(parsePngHeader(new Uint8Array([0x89, 0x50, 0x4e]))).toEqual({ ok: false, reason: 'not-png' })
  })

  it('IHDR가 잘린 PNG는 corrupt-image', () => {
    expect(parsePngHeader(makeTruncatedPng())).toEqual({ ok: false, reason: 'corrupt-image' })
  })

  it('너비나 높이가 0이면 corrupt-image', () => {
    const png = Buffer.from(makePng({ width: 64, height: 64 }))
    png.writeUInt32BE(0, 16) // 너비를 0으로
    expect(parsePngHeader(png)).toEqual({ ok: false, reason: 'corrupt-image' })
  })
})
