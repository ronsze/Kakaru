import { deflateSync } from 'node:zlib'

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(buf: Buffer): number {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

export type PngOptions = {
  width: number
  height: number
  /** RGBA(알파 채널 있음) 또는 RGB(알파 없음). 기본 RGBA */
  colorType?: 'rgba' | 'rgb'
  /** RGBA일 때 투명 픽셀(알파 0)을 하나 이상 넣을지. 기본 true */
  transparent?: boolean
}

/** 테스트용 유효한 PNG 바이트를 만든다. 왼쪽 위 픽셀만 투명하고 나머지는 불투명한 빨간색이다. */
export function makePng({ width, height, colorType = 'rgba', transparent = true }: PngOptions): Buffer {
  const channels = colorType === 'rgba' ? 4 : 3
  const raw = Buffer.alloc((width * channels + 1) * height)
  for (let y = 0; y < height; y++) {
    const row = y * (width * channels + 1)
    raw[row] = 0 // 필터 없음
    for (let x = 0; x < width; x++) {
      const i = row + 1 + x * channels
      raw[i] = 220
      raw[i + 1] = 40
      raw[i + 2] = 40
      if (channels === 4) raw[i + 3] = transparent && x === 0 && y === 0 ? 0 : 255
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // 비트 깊이
  ihdr[9] = colorType === 'rgba' ? 6 : 2
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

/** 시그니처가 PNG가 아닌 파일 (JPEG 시작 바이트) */
export function makeJpegLike(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01])
}

/** PNG 시그니처와 IHDR 일부만 있고 잘린 파일 */
export function makeTruncatedPng(): Buffer {
  return makePng({ width: 64, height: 64 }).subarray(0, 20)
}
