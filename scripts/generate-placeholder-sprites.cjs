/**
 * 임시 캐릭터 이미지 생성기.
 * 기존에 코드로 그리던 폴리곤 캐릭터를 캡처해 PNG 리소스로 저장한다.
 * 실제 디자인 이미지가 준비되면 src/renderer/assets/ 의 파일을 교체하고 이 스크립트는 지워도 된다.
 *
 * 실행: npx electron scripts/generate-placeholder-sprites.cjs
 * 출력: src/renderer/assets/walk.png (200x200 프레임 8장 가로 배열), idle.png (200x200 1장)
 */
const { app, BrowserWindow } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

/** 페이지 안에서 실행된다 (자기 완결적이어야 한다). */
function renderSheets() {
  const FRAME = 200 // 표시 크기(100px)의 2배 (고해상도 화면용)
  const WALK_FRAMES = 8

  function fillPoly(ctx, points, color) {
    ctx.beginPath()
    points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  }

  // 오른쪽을 보는 자세. 원점은 캐릭터 중심(1배 기준 좌표).
  function drawPose(ctx, swing, bob) {
    ctx.save()
    ctx.translate(FRAME / 2, FRAME / 2 + 4)
    ctx.scale(2, 2)
    ctx.translate(0, bob)
    fillPoly(ctx, [[-14, 14], [-6, 14], [-6 + swing * 6, 28], [-14 + swing * 6, 28]], '#c2703d')
    fillPoly(ctx, [[6, 14], [14, 14], [14 - swing * 6, 28], [6 - swing * 6, 28]], '#c2703d')
    fillPoly(ctx, [[-22, -2], [-34, -14 + swing * 3], [-30, -2 + swing * 3], [-22, 6]], '#c2703d')
    fillPoly(ctx, [[-22, -4], [-12, -16], [12, -16], [22, -4], [18, 16], [-18, 16]], '#e8924f')
    fillPoly(ctx, [[2, -34], [14, -40], [26, -34], [30, -22], [22, -12], [6, -12], [-2, -22]], '#e8924f')
    fillPoly(ctx, [[4, -34], [6, -48], [13, -39]], '#c2703d')
    fillPoly(ctx, [[18, -39], [25, -48], [27, -34]], '#c2703d')
    fillPoly(ctx, [[12, -28], [16, -28], [16, -22], [12, -22]], '#2b1d14')
    fillPoly(ctx, [[22, -28], [26, -28], [26, -22], [22, -22]], '#2b1d14')
    fillPoly(ctx, [[28, -22], [31, -22], [29.5, -19]], '#7a3b2e')
    ctx.restore()
  }

  const walk = document.createElement('canvas')
  walk.width = FRAME * WALK_FRAMES
  walk.height = FRAME
  const wctx = walk.getContext('2d')
  for (let k = 0; k < WALK_FRAMES; k++) {
    const phase = (k / WALK_FRAMES) * Math.PI * 2
    wctx.save()
    wctx.translate(k * FRAME, 0)
    drawPose(wctx, Math.sin(phase), -Math.abs(Math.sin(phase)) * 3)
    wctx.restore()
  }

  const idle = document.createElement('canvas')
  idle.width = FRAME
  idle.height = FRAME
  drawPose(idle.getContext('2d'), 0, 0)

  return { walk: walk.toDataURL('image/png'), idle: idle.toDataURL('image/png') }
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('about:blank')
  const sheets = await win.webContents.executeJavaScript(`(${renderSheets.toString()})()`)
  const outDir = path.join(__dirname, '..', 'src', 'renderer', 'assets')
  fs.mkdirSync(outDir, { recursive: true })
  for (const [name, dataUrl] of Object.entries(sheets)) {
    fs.writeFileSync(path.join(outDir, `${name}.png`), Buffer.from(dataUrl.split(',')[1], 'base64'))
  }
  app.quit()
})
