import { screen } from 'electron'
import { HitTester } from '../shared/hit'
import type { OverlayManager } from './overlay'
import { getCharacter } from './simulation'

/**
 * 오버레이 창의 클릭 통과 상태를 갱신하는 함수를 만든다 (research R2).
 * 시뮬레이션 틱(60Hz)마다 호출되며, 커서 폴링용 타이머를 따로 두지 않는다.
 */
export function createHitTest(overlays: OverlayManager): () => void {
  const tester = new HitTester({
    getCursor: () => screen.getCursorScreenPoint(),
    getCharacter,
    setIgnore: (displayId, ignore) => {
      const win = overlays.get(displayId)
      if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore)
    }
  })
  return () => tester.update()
}
