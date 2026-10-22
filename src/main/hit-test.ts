import { screen } from 'electron'
import { config } from '../shared/config'
import { HitTester } from '../shared/hit'
import type { OverlayManager } from './overlay'
import { getCharacter } from './simulation'

let timer: NodeJS.Timeout | undefined

/** 약 60Hz로 커서를 폴링해 오버레이 창의 클릭 통과 상태를 갱신한다 (research R2) */
export function startHitTest(overlays: OverlayManager): void {
  const tester = new HitTester({
    getCursor: () => screen.getCursorScreenPoint(),
    getCharacter,
    setIgnore: (displayId, ignore) => {
      const win = overlays.get(displayId)
      if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore)
    }
  })
  timer = setInterval(() => tester.update(), 1000 / config.tickHz)
}

export function stopHitTest(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}
