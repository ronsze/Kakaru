# 계약: 메인 ↔ 렌더러 IPC

앱이 외부에 노출하는 인터페이스는 없고, 내부 프로세스 간 계약만 있다. 채널 이름과 페이로드는
`src/shared/ipc.ts`에 타입으로 정의하며 preload의 `contextBridge`를 통해서만 노출한다
(렌더러에 Node 접근을 주지 않는다).

## 메인 → 렌더러

### `character:update`

디스플레이별 오버레이 창에 보낸다. 캐릭터가 그 디스플레이 위에 있을 때만 `visible: true`.

```ts
type CharacterUpdate = {
  visible: boolean
  // 창 로컬 좌표(DIP). visible=false이면 무시.
  x: number
  y: number
  // 속도 (px/s, DIP). 이동 중이 아니면 0. 렌더러가 이 속도로 위치를 이어서 계산한다.
  vx: number
  vy: number
  heading: -1 | 1
  state: 'Walking' | 'Idle' | 'UserControlled'
}
```

- 전송 시점: 상태·방향·표시 디스플레이가 바뀔 때, 그리고 이동 중 1초마다 한 번(위치 보정).
  매 프레임 위치를 보내지 않는다. 렌더러는 마지막으로 받은 `(x, y)`에서 `(vx, vy)`로
  위치를 이어서 계산한다(CPU 절약, SC-006).

## 렌더러 → 메인

이번 기능에서는 렌더러가 메인에 보내는 입력 채널이 없다(히트 테스트는 메인이 커서를 폴링).
드래그 이동·우클릭 메뉴 기능이 추가될 때 아래 채널을 정의한다. 드래그 채널은 [004 계약](../../004-character-drag-move/contracts/ipc.md)으로 확정했다.

| 채널(예정) | 용도 |
|---|---|
| `character:grab-start` / `character:grab-end` | 드래그 잡기 시작·종료 → `UserControlled` 전이 (FR-006) |
| `character:menu-open` / `character:menu-close` | 우클릭 메뉴 열림·닫힘 → `UserControlled` 전이 (FR-006) |

## 메인 내부 계약 (모듈 경계)

```ts
// shared/behavior — 순수 로직, Electron 비의존
interface MovementEngine {
  tick(now: number, dt: number): Character
  setUserControlled(active: boolean, now: number): void
  setWalkableArea(area: WalkableArea): void
}

// main/platform — OS별 구현을 감추는 어댑터
interface PlatformAdapter {
  configureOverlay(win: BrowserWindow): void // 항상 위 레벨, 전체 화면 위 표시
}
```
