import type { BehaviorState, Heading } from './types'

export const CHANNEL_CHARACTER_UPDATE = 'character:update'

/**
 * 디스플레이별 오버레이 창에 보내는 캐릭터 상태. x, y는 창 로컬 좌표(DIP).
 * 이동 중 매 프레임 위치를 보내지 않고, 상태가 바뀔 때(와 주기적 보정 때) 위치와 속도를 보내면
 * 렌더러가 속도로 위치를 이어서 계산한다.
 */
export type CharacterUpdate = {
  visible: boolean
  x: number
  y: number
  /** 속도 (px/s, DIP). 이동 중이 아니면 0 */
  vx: number
  vy: number
  heading: Heading
  state: BehaviorState
}

/** preload가 렌더러에 노출하는 API */
export type KakaruApi = {
  onCharacterUpdate(callback: (update: CharacterUpdate) => void): void
}
