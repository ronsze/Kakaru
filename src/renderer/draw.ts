import type { CharacterUpdate, KakaruApi } from '../shared/ipc'

declare global {
  interface Window {
    kakaru: KakaruApi
  }
}

type Poly = [number, number][]

const SIZE = 200
const HALF = SIZE / 2
/** SC-007(30fps 이상)을 만족하는 최소 프레임 간격. 60fps로 돌릴 필요가 없다. */
const FRAME_INTERVAL_MS = 1000 / 32

const canvas = document.getElementById('stage') as HTMLCanvasElement
const ctx = canvas.getContext('2d')!

let latest: CharacterUpdate | null = null
/** latest를 받은 시각. 이동 중 위치는 속도로 이어서 계산한다. */
let receivedAt = 0
let rafId = 0
let lastFrameAt = 0

function setupCanvas(): void {
  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(SIZE * dpr)
  canvas.height = Math.round(SIZE * dpr)
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
  const bob = walking ? Math.abs(Math.sin(t / 90)) * -3 : 0

  ctx.save()
  ctx.translate(HALF, HALF + bob)
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

function place(t: number): void {
  if (!latest) return
  const elapsed = Math.max(0, (t - receivedAt) / 1000)
  const x = latest.x + latest.vx * elapsed
  const y = latest.y + latest.vy * elapsed
  canvas.style.transform = `translate(${x - HALF}px, ${y - HALF}px)`
}

function draw(t: number): void {
  if (!latest) return
  place(t)
  ctx.clearRect(0, 0, SIZE, SIZE)
  drawCharacter(latest, t)
}

/** 걷는 동안만 rAF로 계속 그린다. 정지 중에는 정지 자세를 한 번만 그리고 멈춘다 (CPU 절약). */
function loop(): void {
  rafId = 0
  if (!latest?.visible) return
  if (latest.state === 'Walking') {
    rafId = requestAnimationFrame((t) => {
      if (t - lastFrameAt >= FRAME_INTERVAL_MS) {
        lastFrameAt = t
        draw(t)
      }
      loop()
    })
  } else {
    draw(performance.now())
  }
}

function restart(): void {
  if (rafId) cancelAnimationFrame(rafId)
  loop()
}

function apply(update: CharacterUpdate): void {
  latest = update
  receivedAt = performance.now()
  if (!update.visible) {
    canvas.style.display = 'none'
    return
  }
  canvas.style.display = 'block'
  restart()
}

setupCanvas()
window.kakaru.onCharacterUpdate(apply)
