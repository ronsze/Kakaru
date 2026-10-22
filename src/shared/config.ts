/** 행동 파라미터 (research R6). 사용자 설정 기능은 만들지 않는다. */
export const config = {
  /** 걷기 속도 (px/s, DIP) */
  walkSpeed: 80,
  /** 이동 구간 길이 범위 (ms) */
  walkDurationMs: { min: 2000, max: 6000 },
  /** 정지 길이 범위 (ms) */
  idleDurationMs: { min: 1000, max: 4000 },
  /** 앱 시작 후 첫 이동까지 최대 대기 (ms) */
  firstMoveWithinMs: 5000,
  /** 시뮬레이션 틱 (Hz) */
  tickHz: 60,
  /** 히트 영역 반지름 (DIP) */
  hitRadius: 40
} as const
