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
  /** 히트 영역 반지름 (DIP, 크기 1배 기준) */
  hitRadius: 40,
  /**
   * 캐릭터 확대·축소 (배율). 한 번에 변하는 양과 최소·최대는 써 보면서 조정한다.
   * 배율은 소수 둘째 자리로 반올림해 저장한다.
   */
  scale: { default: 1, step: 0.2, min: 0.5, max: 3 }
} as const
