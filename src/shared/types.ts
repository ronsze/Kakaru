export type Point = { x: number; y: number }

export type Rect = { x: number; y: number; width: number; height: number }

export type Heading = -1 | 1

export type BehaviorState = 'Walking' | 'Idle' | 'UserControlled'

export type Character = {
  /** 가상 데스크탑 좌표(DIP)에서의 캐릭터 중심 */
  position: Point
  heading: Heading
  /** px/s. Walking이 아니면 항상 0 */
  velocity: Point
  state: BehaviorState
  /** Walking 중 이동 목표. Walking이 아니면 null */
  target: Point | null
  /** 현재 상태가 끝나는 시각(ms, 시뮬레이션 시각) */
  stateUntil: number
  /** 클릭 통과 해제용 히트 영역 반지름(DIP) */
  hitRadius: number
}
