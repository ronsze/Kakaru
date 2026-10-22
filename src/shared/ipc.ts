import type { BehaviorState, Heading } from './types'

export const CHANNEL_CHARACTER_UPDATE = 'character:update'

/** 디스플레이별 오버레이 창에 보내는 캐릭터 상태. x, y는 창 로컬 좌표(DIP). */
export type CharacterUpdate = {
  visible: boolean
  x: number
  y: number
  heading: Heading
  state: BehaviorState
}

/** preload가 렌더러에 노출하는 API */
export type KakaruApi = {
  onCharacterUpdate(callback: (update: CharacterUpdate) => void): void
}
