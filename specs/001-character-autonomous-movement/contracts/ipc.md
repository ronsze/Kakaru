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
  heading: -1 | 1
  state: 'Walking' | 'Idle' | 'UserControlled'
}
```

- 전송 주기: 시뮬레이션 틱(60Hz). 변화가 없는 틱은 생략할 수 있다.

## 렌더러 → 메인

이번 기능에서는 렌더러가 메인에 보내는 입력 채널이 없다(히트 테스트는 메인이 커서를 폴링).
롱프레스 이동·우클릭 메뉴 기능이 추가될 때 아래 채널을 정의한다.

| 채널(예정) | 용도 |
|---|---|
| `character:grab-start` / `character:grab-end` | 롱프레스 잡기 시작·종료 → `UserControlled` 전이 (FR-006) |
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
