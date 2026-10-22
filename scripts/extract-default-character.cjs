/**
 * 샘플 캐릭터(빨간 모자) 이미지 추출기.
 * specs/bmm.png(서있는 자세 1장 + 걷기 프레임 3장이 한 장에 담긴 참고 이미지)에서 각 자세를 잘라
 * 흰 배경을 투명으로 만들고, 앱이 쓰는 규격의 PNG로 저장한다.
 * 앱이 처음 실행될 때 "빨간 모자" 캐릭터로 등록하는 샘플 이미지다(기본 캐릭터는 폴리곤 고양이).
 *
 * 실행: npx electron scripts/extract-default-character.cjs
 * 출력: resources/characters/bmm/walk.png (200x200 프레임 4장 가로 배열: 1,2,3,2 순서), idle.png (200x200)
 *       미리보기(어두운 배경 합성)는 인자로 경로를 주면 저장한다.
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const SOURCE = path.join(__dirname, '..', 'specs', 'bmm.png')
const OUT_DIR = path.join(__dirname, '..', 'resources', 'characters', 'bmm')
const PREVIEW = process.argv[2] // 선택: 미리보기 PNG 저장 경로

/** 페이지 안에서 실행된다 (자기 완결적이어야 한다). */
async function build(sourceDataUrl) {
  const FRAME = 200
  const BOXES = {
    idle: [14, 96, 172, 250],
    w1: [184, 108, 292, 246],
    w2: [292, 108, 402, 246],
    w3: [406, 108, 514, 246]
  }
  const NEAR_WHITE = 236

  const img = await new Promise((resolve, reject) => {
    const i = new Image()
    i.onload = () => resolve(i)
    i.onerror = reject
    i.src = sourceDataUrl
  })
  const src = document.createElement('canvas')
  src.width = img.width
  src.height = img.height
  const sctx = src.getContext('2d')
  sctx.drawImage(img, 0, 0)

  /** 박스를 잘라 가장자리에서 이어진 흰 배경을 투명하게 만들고, 남은 영역의 경계 상자로 다시 자른다 */
  function cut([x0, y0, x1, y1]) {
    const w = x1 - x0
    const h = y1 - y0
    const data = sctx.getImageData(x0, y0, w, h)
    const px = data.data
    const isBg = (i) => px[i + 3] > 0 && px[i] >= NEAR_WHITE && px[i + 1] >= NEAR_WHITE && px[i + 2] >= NEAR_WHITE
    const seen = new Uint8Array(w * h)
    const stack = []
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return
      const k = y * w + x
      if (seen[k] || !isBg(k * 4)) return
      seen[k] = 1
      stack.push(k)
    }
    for (let x = 0; x < w; x++) (push(x, 0), push(x, h - 1))
    for (let y = 0; y < h; y++) (push(0, y), push(w - 1, y))
    while (stack.length) {
      const k = stack.pop()
      px[k * 4 + 3] = 0
      const x = k % w
      const y = (k / w) | 0
      push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1)
    }
    // 화살표 같은 작은 조각·파란 조각은 지운다 (8방향으로 이어진 덩어리별로 판정)
    const label = new Int32Array(w * h)
    const comps = []
    for (let s = 0; s < w * h; s++) {
      if (px[s * 4 + 3] === 0 || label[s]) continue
      const id = comps.length + 1
      const members = [s]
      label[s] = id
      let sumR = 0, sumG = 0, sumB = 0
      for (let q = 0; q < members.length; q++) {
        const k = members[q]
        sumR += px[k * 4]; sumG += px[k * 4 + 1]; sumB += px[k * 4 + 2]
        const x = k % w
        const y = (k / w) | 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx
            const ny = y + dy
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue
            const nk = ny * w + nx
            if (label[nk] || px[nk * 4 + 3] === 0) continue
            label[nk] = id
            members.push(nk)
          }
      }
      const n = members.length
      const bluish = sumB / n - sumR / n > 40
      comps.push({ members, n, bluish })
    }
    for (const c of comps) {
      if (c.n < 60 || c.bluish) for (const k of c.members) px[k * 4 + 3] = 0
    }
    let minX = w, minY = h, maxX = -1, maxY = -1
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        if (px[(y * w + x) * 4 + 3] > 0) {
          if (x < minX) minX = x
          if (x > maxX) maxX = x
          if (y < minY) minY = y
          if (y > maxY) maxY = y
        }
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    c.getContext('2d').putImageData(data, 0, 0)
    return { canvas: c, x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 }
  }

  const cuts = Object.fromEntries(Object.entries(BOXES).map(([k, b]) => [k, cut(b)]))
  // 모든 자세에 같은 배율을 적용해 크기가 일정하게 보이도록 가장 큰 자세가 프레임에 들어가는 배율을 쓴다
  // 서있는 자세는 원본에서 걷기 프레임보다 크게 그려져 있어, 머리 크기가 같아 보이도록 줄인다
  const IDLE_FACTOR = 0.85
  const walkKeys = ['w1', 'w2', 'w3']
  const maxW = Math.max(...walkKeys.map((k) => cuts[k].w))
  const maxH = Math.max(...walkKeys.map((k) => cuts[k].h))
  const scale = Math.min((FRAME - 8) / maxW, (FRAME - 8) / maxH)

  /** 프레임 한 장에 자세를 그린다. 가로는 가운데, 세로는 바닥(그림자)을 맞춘다 */
  function draw(ctx, cutResult, ox, factor = 1) {
    const dw = Math.round(cutResult.w * scale * factor)
    const dh = Math.round(cutResult.h * scale * factor)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(
      cutResult.canvas,
      cutResult.x, cutResult.y, cutResult.w, cutResult.h,
      ox + Math.round((FRAME - dw) / 2), FRAME - 4 - dh, dw, dh
    )
  }

  const order = ['w1', 'w2', 'w3', 'w2']
  const walk = document.createElement('canvas')
  walk.width = FRAME * order.length
  walk.height = FRAME
  const wctx = walk.getContext('2d')
  order.forEach((k, i) => draw(wctx, cuts[k], i * FRAME))

  const idle = document.createElement('canvas')
  idle.width = FRAME
  idle.height = FRAME
  draw(idle.getContext('2d'), cuts.idle, 0, IDLE_FACTOR)

  // 미리보기: 어두운 배경에 합성해 투명 처리 상태를 확인한다
  const preview = document.createElement('canvas')
  preview.width = FRAME * (order.length + 1)
  preview.height = FRAME
  const pctx = preview.getContext('2d')
  pctx.fillStyle = '#2b2b3a'
  pctx.fillRect(0, 0, preview.width, preview.height)
  pctx.drawImage(idle, 0, 0)
  pctx.drawImage(walk, FRAME, 0)

  return {
    walk: walk.toDataURL('image/png'),
    idle: idle.toDataURL('image/png'),
    preview: preview.toDataURL('image/png'),
    info: { scale, sizes: Object.fromEntries(Object.entries(cuts).map(([k, c]) => [k, [c.w, c.h]])) }
  }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false, webPreferences: { webSecurity: false } })
  await win.loadURL('about:blank')
  const dataUrl = 'data:image/png;base64,' + fs.readFileSync(SOURCE).toString('base64')
  const result = await win.webContents.executeJavaScript(`(${build.toString()})(${JSON.stringify(dataUrl)})`)
  const save = (file, url) => fs.writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'))
  fs.mkdirSync(OUT_DIR, { recursive: true })
  save(path.join(OUT_DIR, 'walk.png'), result.walk)
  save(path.join(OUT_DIR, 'idle.png'), result.idle)
  if (PREVIEW) save(PREVIEW, result.preview)
  console.log(JSON.stringify(result.info))
  app.quit()
})
