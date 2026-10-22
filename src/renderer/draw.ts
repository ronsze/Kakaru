import type { CharacterUpdate, KakaruApi } from '../shared/ipc'

declare global {
  interface Window {
    kakaru: KakaruApi
  }
}

type Poly = [number, number][]

const canvas = document.getElementById('stage') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

let latest: CharacterUpdate | null = null
/** 지난 프레임에 그린 영역. 전체 화면을 매번 지우면 투명 창 합성 비용이 커서 이 영역만 지운다. */
let dirty: { x: number; y: number } | null = null
let rafId = 0
const MARGIN = 90
/** SC-007(30fps 이상)을 만족하는 최소 프레임 간격. 전체 화면 투명 창은 합성 비용이 커서 60fps로 돌리지 않는다. */
const FRAME_INTERVAL_MS = 1000 / 32
let lastFrameAt = 0

function resize(): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(window.innerWidth * dpr)
  canvas.height = Math.round(window.innerHeight * dpr)
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function fillPoly(points: Poly, color: string): void {
  ctx.beginPath()
  points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)))
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
}

/** 폴리곤으로 그린 임시 캐릭터 (research R11). 원점은 캐릭터 중심, 오른쪽이 정면. */
function drawCharacter(update: CharacterUpdate, t: number): void {
  const walking = update.state === 'Walking'
  const swing = walking ? Math.sin(t / 90) : 0
  const bob = walking ? Math.abs(Math.sin(t / 90)) * -3 : Math.sin(t / 600) * 1.5

  ctx.save()
  ctx.translate(update.x, update.y + bob)
  ctx.scale(update.heading, 1)

  // 다리 (앞뒤로 흔든다)
  fillPoly([[-14, 14], [-6, 14], [-6 + swing * 6, 28], [-14 + swing * 6, 28]], '#c2703d')
  fillPoly([[6, 14], [14, 14], [14 - swing * 6, 28], [6 - swing * 6, 28]], '#c2703d')
  // 꼬리
  fillPoly([[-22, -2], [-34, -14 + swing * 3], [-30, -2 + swing * 3], [-22, 6]], '#c2703d')
  // 몸
  fillPoly([[-22, -4], [-12, -16], [12, -16], [22, -4], [18, 16], [-18, 16]], '#e8924f')
  // 머리
  fillPoly([[2, -34], [14, -40], [26, -34], [30, -22], [22, -12], [6, -12], [-2, -22]], '#e8924f')
  // 귀
  fillPoly([[4, -34], [6, -48], [13, -39]], '#c2703d')
  fillPoly([[18, -39], [25, -48], [27, -34]], '#c2703d')
  // 눈, 코
  fillPoly([[12, -28], [16, -28], [16, -22], [12, -22]], '#2b1d14')
  fillPoly([[22, -28], [26, -28], [26, -22], [22, -22]], '#2b1d14')
  fillPoly([[28, -22], [31, -22], [29.5, -19]], '#7a3b2e')

  ctx.restore()
}

function clearDirty(): void {
  if (!dirty) return
  ctx.clearRect(dirty.x - MARGIN, dirty.y - MARGIN, MARGIN * 2, MARGIN * 2)
  dirty = null
}

function frame(t: number): void {
  rafId = 0
  if (t - lastFrameAt < FRAME_INTERVAL_MS) {
    rafId = requestAnimationFrame(frame)
    return
  }
  lastFrameAt = t
  clearDirty()
  if (latest?.visible) {
    drawCharacter(latest, t)
    dirty = { x: latest.x, y: latest.y }
    // 캐릭터가 보이는 동안만 프레임을 돌린다
    rafId = requestAnimationFrame(frame)
  }
}

function schedule(): void {
  if (!rafId) rafId = requestAnimationFrame(frame)
}

resize()
window.addEventListener('resize', () => {
  resize()
  dirty = null
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
})
window.kakaru.onCharacterUpdate((update) => {
  latest = update
  schedule()
})
