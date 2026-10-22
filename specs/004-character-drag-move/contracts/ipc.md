# Contract: 드래그 IPC

001 `contracts/ipc.md`에서 예고된 채널을 확정한다.

## 렌더러 → 메인 (fire-and-forget, `ipcRenderer.send`)

| 채널 | 페이로드 | 발생 조건 |
|---|---|---|
| `character:grab-start` | 없음 | 캐릭터 위 `mousedown`, `button === 0 && !ctrlKey` |
| `character:grab-end` | 없음 | `mouseup`, `pointercancel`, `lostpointercapture`, `blur` 중 먼저 일어난 것 |

- 메인은 보낸 창을 구분하지 않는다(캐릭터는 하나). 잘못된 시점의 메시지는 무시한다(`start`는 이미 잡힘·메뉴 열림이면, `end`는 잡혀 있지 않으면).
- 커서 좌표는 보내지 않는다. 메인이 `screen.getCursorScreenPoint()`를 쓴다.

## preload API 추가 (`KakaruApi`)

```ts
grabStart(): void
grabEnd(): void
```

## 모듈 계약

```ts
// shared/drag-controller — Electron 비의존
type DragPorts = {
  getCursor(): Point
  getPosition(): Point
  isMenuOpen(): boolean
  setUserControlled(active: boolean): void
  moveTo(position: Point): void   // 내부에서 영역 clamp
}
class DragController {
  start(): void
  update(): void   // 매 틱
  end(): void
  get active(): boolean
}

// shared/behavior
MovementEngine.moveTo(point: Point): void   // UserControlled 상태에서만 위치 설정 + clamp
```

## 메인 → 렌더러

기존 `character:update`를 그대로 쓴다(`state: 'UserControlled'`, 속도 0). 변경 없음.
