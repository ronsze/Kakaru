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
  scale: { default: 1, step: 0.2, min: 0.5, max: 3 },
  /** 앱을 실행하고 이만큼(ms) 뒤에 인사한다 (오버레이 창이 뜨고 캐릭터가 보인 다음) */
  greetingDelayMs: 1500,
  /** 캐릭터를 이만큼(ms) 계속 잡고 있으면 발버둥 모션과 "오래 잡혔을 때" 대사가 시작된다 */
  struggleAfterMs: 5000,
  /**
   * 말풍선·혼잣말. 값은 써 보면서 조정한다.
   * 표시 시간은 baseMs + perCharMs × 글자 수를 displayMs 범위로 맞춘 값이다.
   */
  speech: {
    intervalMs: { min: 20_000, max: 40_000 },
    displayMs: { min: 3000, max: 8000 },
    baseMs: 2000,
    perCharMs: 150,
    maxLength: 60,
    maxPerCategory: 50
  }
} as const
