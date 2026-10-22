import type { CharacterUpdate, KakaruApi } from '../shared/ipc'
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

const actor = document.getElementById('actor') as HTMLDivElement
const sprite = document.getElementById('sprite') as HTMLDivElement

;(document.getElementById('walk') as HTMLImageElement).src = walkUrl
;(document.getElementById('idle') as HTMLImageElement).src = idleUrl

let lastLook = ''

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

window.kakaru.onCharacterUpdate(apply)
