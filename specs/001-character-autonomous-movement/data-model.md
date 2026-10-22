# 데이터 모델: 캐릭터 자율 이동

영속 저장은 없다(Storage: N/A). 아래는 메모리 상의 상태 모델이다.

## Character (캐릭터)

| 필드 | 타입 | 설명 |
|---|---|---|
| `position` | `{ x: number, y: number }` | 가상 데스크탑 좌표(DIP)에서의 캐릭터 중심 |
| `heading` | `-1 \| 1` | 좌(-1)/우(1) 방향. 스프라이트 반전에 사용 |
| `velocity` | `{ x: number, y: number }` | 현재 속도(px/s). Idle이면 0 |
| `state` | `Walking \| Idle \| UserControlled` | 행동 상태 |
| `target` | `{ x: number, y: number } \| null` | Walking 중 이동 목표 |
| `stateUntil` | `number` (ms, 시뮬레이션 시각) | 현재 상태가 끝나는 시각 |
| `hitRadius` | `number` | 클릭 통과 해제용 히트 영역 반지름(DIP) |

### 검증 규칙

- `position`은 항상 `WalkableArea` 안에 있어야 한다(FR-004, FR-008).
- `state === Walking`이면 `target !== null`이고, 현재 위치→`target` 직선이 `WalkableArea`
  안에 있어야 한다.
- `state !== Walking`이면 `velocity`는 0이다.
- `state === UserControlled`이면 자율 이동 로직은 `position`을 바꾸지 않는다(FR-006).

### 상태 전이

```text
          시작(앱 실행)
              │
              ▼
   ┌────────► Idle ───────┐  stateUntil 경과
   │           ▲          ▼
   │ stateUntil│       Walking ──(목표 도달/경계/막힘)──► Idle
   │ 경과       │          │
   │           │          │
   └───────────┴──────────┘
        │  ▲
  조작 시작│  │조작 종료 (현재 위치에서 Idle로 재개)
        ▼  │
     UserControlled   ← Idle/Walking 어디서든 진입 가능
```

- 앱 시작 직후 Idle(최대 5초 이내) 후 Walking으로 전이한다(SC-001).
- `UserControlled` 종료 시 항상 `Idle`로 복귀해 `stateUntil`을 새로 설정한다.
- 롱프레스 드래그 자체의 위치 변경은 별도 기능이며, 이 상태에서는 외부(드래그)가
  `position`을 설정할 수 있다.

## WalkableArea (이동 가능 영역)

| 필드 | 타입 | 설명 |
|---|---|---|
| `displays` | `Rect[]` | 연결된 각 디스플레이의 `bounds`(가상 데스크탑 좌표) |

### 연산

- `contains(point)`: 점이 어느 한 디스플레이 안에 있는지.
- `containsSegment(a, b)`: 두 점을 잇는 선분이 영역의 합집합 안에 있는지.
- `clamp(point)`: 영역 밖 점을 가장 가까운 내부 점으로 옮긴다(모니터 해제 시 복귀).
- `displayAt(point)`: 점이 속한 디스플레이(렌더링할 오버레이 창 결정).

### 갱신 규칙

- 디스플레이 추가·제거·메트릭 변경, 절전 복귀 시 재구성한다.
- 재구성 후 `Character.position`이 영역 밖이면 `clamp`한다.

## OverlayWindow (오버레이 창)

디스플레이마다 하나. 영속 데이터가 아니라 창 수명 관리 대상이다.

| 필드 | 타입 | 설명 |
|---|---|---|
| `displayId` | `number` | 대응하는 디스플레이 |
| `ignoreMouse` | `boolean` | 현재 클릭 통과 여부(기본 true) |
