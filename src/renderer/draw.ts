import type { Appearance, CharacterUpdate, KakaruApi } from '../shared/ipc'
import idleUrl from './assets/idle.png'
import walkUrl from './assets/walk.png'

declare global {
  interface Window {
    kakaru: KakaruApi
  }
}

/** 표시 크기(CSS px). 이미지 프레임은 이 크기의 2배(고해상도 화면용)다. */
const SIZE = 100
const HALF = SIZE / 2
/**
 * 이동 중 위치는 마지막으로 받은 (x, y)에서 속도로 이어서 계산한다. 이 시간(초) 동안의 이동을
 * CSS transition으로 미리 걸어 두면 compositor가 위치를 옮기므로 프레임마다 JS가 돌지 않는다.
 * 메인이 이동 중 1초마다 위치를 보정하므로 그보다 약간 길게 잡는다.
 */
const GLIDE_SECONDS = 1.2

/** 번들에 포함된 기본 걷기 이미지의 프레임 수 (assets/walk.png, 200×200 프레임 8장) */
const DEFAULT_FRAMES = 8
/** 걷기 한 바퀴의 최소 시간(ms)과 프레임당 시간(ms). 프레임이 적어도 너무 빠르게 넘기지 않는다. */
const MIN_CYCLE_MS = 560
const FRAME_MS = 70

const actor = document.getElementById('actor') as HTMLDivElement
const sprite = document.getElementById('sprite') as HTMLDivElement

const walkImg = document.getElementById('walk') as HTMLImageElement
const idleImg = document.getElementById('idle') as HTMLImageElement

/** 활성 캐릭터의 모습을 반영한다. 이미지만 바뀌고 위치·방향·이동 상태는 그대로다 (FR-011). */
let usingDefault = true
let currentScale = 1

function applyAppearance(appearance: Appearance): void {
  usingDefault = appearance.walkUrl === null && appearance.idleUrl === null
  setFrames(appearance.frames)
  currentScale = appearance.scale
  document.documentElement.style.setProperty('--scale', String(appearance.scale))
  walkImg.src = appearance.walkUrl ?? walkUrl
  idleImg.src = appearance.idleUrl ?? idleUrl
}

/** 사용자 이미지를 불러오지 못하면 기본 캐릭터로 되돌린다 (FR-015) */
function useDefaultAppearance(): void {
  applyAppearance({ walkUrl: null, idleUrl: null, frames: DEFAULT_FRAMES, scale: currentScale })
}

for (const img of [walkImg, idleImg]) {
  img.addEventListener('error', () => {
    if (!usingDefault) useDefaultAppearance()
  })
}

let lastLook = ''

/** 걷기 이미지의 프레임 수에 맞춰 CSS 변수(steps 수, 이동 거리, 한 바퀴 시간)를 정한다 */
function setFrames(frames: number): void {
  const root = document.documentElement.style
  root.setProperty('--frames', String(frames))
  root.setProperty('--strip', `${frames * SIZE}px`)
  root.setProperty('--cycle', `${Math.max(MIN_CYCLE_MS, frames * FRAME_MS)}ms`)
}

function move(x: number, y: number, vx: number, vy: number): void {
  actor.style.transition = 'none'
  actor.style.transform = `translate(${x - HALF}px, ${y - HALF}px)`
  if (vx === 0 && vy === 0) return
  void actor.offsetWidth // transition을 끊고 현재 위치를 확정한다
  actor.style.transition = `transform ${GLIDE_SECONDS}s linear`
  actor.style.transform = `translate(${x + vx * GLIDE_SECONDS - HALF}px, ${y + vy * GLIDE_SECONDS - HALF}px)`
}

function apply(update: CharacterUpdate): void {
  if (!update.visible) {
    actor.style.display = 'none'
    return
  }
  actor.style.display = 'block'
  // 걷기 애니메이션이 위치 보정 때마다 처음부터 다시 시작하지 않도록 모습이 바뀔 때만 갱신한다
  const look = `${update.state === 'Walking' ? 'walking' : 'idle'}${update.heading === -1 ? ' facing-left' : ''}`
  if (look !== lastLook) {
    lastLook = look
    sprite.className = look
  }
  move(update.x, update.y, update.vx, update.vy)
}

useDefaultAppearance()
window.kakaru.onAppearance(applyAppearance)
window.kakaru.onCharacterUpdate(apply)

// 드래그 이동: 창은 커서가 캐릭터 히트 영역 위일 때만 입력을 받으므로 문서 전체의 누름이 곧 캐릭터를 누른 것이다.
// 위치 추적은 메인이 하고, 여기서는 누름과 뗌만 알린다.
let grabbing = false
/** 이만큼(ms) 계속 잡혀 있으면 발버둥 모션을 시작한다 */
const STRUGGLE_AFTER_MS = 5000
let struggleTimer: ReturnType<typeof setTimeout> | undefined

function releaseGrab(): void {
  if (!grabbing) return
  grabbing = false
  clearTimeout(struggleTimer)
  actor.classList.remove('struggling')
  window.kakaru.grabEnd()
}

document.addEventListener('dragstart', (e) => e.preventDefault())
document.addEventListener('pointerdown', (e) => {
  // macOS의 Ctrl+클릭은 우클릭 메뉴로 취급한다
  if (e.button !== 0 || e.ctrlKey || grabbing) return
  grabbing = true
  document.documentElement.setPointerCapture(e.pointerId)
  window.kakaru.grabStart()
  struggleTimer = setTimeout(() => actor.classList.add('struggling'), STRUGGLE_AFTER_MS)
})
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) {
  document.addEventListener(type, releaseGrab)
}
window.addEventListener('blur', releaseGrab)
