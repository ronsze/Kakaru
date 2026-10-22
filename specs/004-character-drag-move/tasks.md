---

description: "캐릭터 드래그로 옮기기 작업 목록"
---

# Tasks: 캐릭터 드래그로 옮기기

**Input**: `/specs/004-character-drag-move/`의 plan.md, spec.md, research.md, data-model.md, contracts/ipc.md, quickstart.md

**Tests**: 프로젝트 규칙(TDD)에 따라 구현보다 먼저 테스트를 쓰고 실패를 확인한다.

## Format: `[ID] [P?] [Story] 설명 (파일 경로)`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 가능

## Phase 1: Foundational (모든 스토리의 선행 조건)

**Purpose**: 엔진·IPC 계약·드래그 컨트롤러. 이 단계가 끝나야 스토리를 구현할 수 있다.

- [x] T001 [P] `tests/unit/behavior-drag.test.ts` 작성: `MovementEngine.moveTo(point)`가 `UserControlled`일 때만 위치를 바꾸고, 영역 밖 점은 `WalkableArea.clamp`로 맞추며, 다른 디스플레이로 넘어가는 점을 허용하고, 상태가 `UserControlled`가 아니면 무시하는지 검증. 실패 확인.
- [x] T002 [P] `tests/unit/drag-controller.test.ts` 작성(data-model.md 전이 그대로): `start()`는 메뉴가 열려 있거나 이미 잡혀 있으면 무시, `start()` 시 `setUserControlled(true)`와 오프셋(`캐릭터 위치 − 커서`) 저장, `update()`는 `moveTo(커서 + 오프셋)` 호출, 움직임 없으면 위치 불변(FR-006), `end()`는 `setUserControlled(false)`이고 잡히지 않았으면 무시(멱등). 실패 확인.
- [x] T003 `src/shared/behavior.ts`에 `moveTo(point)` 추가(`UserControlled`에서만, 위치를 `area.clamp`로 보정). T001 통과.
- [x] T004 `src/shared/drag-controller.ts` 신규: `DragPorts`(getCursor, getPosition, isMenuOpen, setUserControlled, moveTo)와 `DragController`(start, update, end, active) 구현. T002 통과.
- [x] T005 [P] `src/shared/ipc.ts`에 채널 상수 `CHANNEL_GRAB_START = 'character:grab-start'`, `CHANNEL_GRAB_END = 'character:grab-end'`와 `KakaruApi.grabStart()`/`grabEnd()` 추가. `src/preload/index.ts`에서 `ipcRenderer.send`로 노출. 빌드 후 `out/preload/`에 공유 청크가 생기지 않았는지 확인(CLAUDE.md 함정).

**Checkpoint**: `npm test`와 타입 검사 통과.

## Phase 2: User Story 1 - 캐릭터를 끌어서 옮긴다 (Priority: P1) 🎯 MVP

**Goal**: 누른 채 끌면 따라오고, 놓으면 그 자리에서 재개된다.

**Independent Test**: quickstart 수동 1~4번, E2E 잡기→이동→놓기.

- [x] T006 [US1] `tests/e2e/drag.test.ts` 작성(`KAKARU_USER_DATA` 격리): 오버레이 창에서 `grabStart()` 후 일정 시간 `character:update`의 `state`가 `UserControlled`이고 속도 0, `grabEnd()` 후 `Idle`로 돌아오며 위치가 놓은 자리에 머무는지 확인. 실패 확인.
- [x] T007 [US1] `src/main/simulation.ts`: 모듈에 `DragController` 연결(포트: `screen.getCursorScreenPoint`, 엔진 위치, `engine.moveTo`), `tick()`에서 `drag.update()` 호출, 잡은 동안 위치가 바뀌면 `broadcast(…, true)`로 즉시 전송. `startGrab()`/`endGrab()`을 export.
- [x] T008 [US1] `src/main/drag-ipc.ts` 신규: `ipcMain.on`으로 `grab-start`/`grab-end`를 `startGrab`/`endGrab`에 연결. `src/main/index.ts`에서 등록하고 `isMenuOpen`을 메뉴 컨트롤러 상태와 연결.
- [x] T009 [US1] `src/renderer/draw.ts`와 `index.html`: `#actor`의 `pointerdown`(`button === 0 && !ctrlKey`)에서 `setPointerCapture` + `window.kakaru.grabStart()`, `pointerup`/`pointercancel`/`lostpointercapture`/`window blur`에서 `grabEnd()`(중복 전송 방지 플래그). 드래그 중 `cursor: grabbing` 등 시각 변화는 넣지 않는다(범위 밖).
- [x] T010 [US1] E2E T006 통과 확인. 타입 검사와 `npm test` 통과.

**Checkpoint**: US1 단독으로 동작·검증 가능(MVP).

## Phase 3: User Story 2 - 화면 밖으로 잃어버리지 않는다 (Priority: P2)

**Goal**: 커서가 화면 밖이어도 캐릭터는 디스플레이 영역 안, 모니터 간 이동은 허용.

**Independent Test**: quickstart 수동 5~6번.

- [x] T011 [P] [US2] `tests/unit/drag-controller.test.ts`에 영역 밖 커서·다른 디스플레이 커서 케이스 추가(실제 `WalkableArea`와 `MovementEngine` 결합): 위치가 가장 가까운 디스플레이 안, 두 디스플레이 사이 경계 이동. 실패하면 T003/T004 수정, 이미 통과하면 회귀 테스트로 유지.
- [x] T012 [US2] 놓은 뒤 자율 이동이 해당 디스플레이 영역 안에서만 이뤄지는지(FR-011) `tests/unit/behavior-drag.test.ts`에 케이스 추가: 두 번째 디스플레이로 `moveTo`한 뒤 `setUserControlled(false)`하고 수백 틱 동안 위치가 `area.contains`를 유지.

**Checkpoint**: US1·US2 모두 단위 수준에서 통과.

## Phase 4: User Story 3 - 메뉴·클릭과 충돌하지 않는다 (Priority: P3)

**Goal**: 드래그와 우클릭 메뉴가 서로 방해하지 않고, 비정상 상황에서 잡힘이 풀린다.

**Independent Test**: quickstart 수동 7~8번.

- [x] T013 [P] [US3] `tests/unit/context-menu.test.ts`에 케이스 추가: 차단 포트가 `true`(드래그 중)면 `handleContextMenu`가 메뉴를 열지 않고 `setUserControlled`도 부르지 않는다. 실패 확인.
- [x] T014 [US3] `src/shared/context-menu-controller.ts`: `ContextMenuPorts`에 `isBlocked(): boolean` 추가, `handleContextMenu` 앞부분에서 차단 시 반환. `src/main/index.ts`에서 `isBlocked: () => drag.active`로 연결. T013 통과.
- [x] T015 [US3] 비정상 해제(FR-010): `src/main/simulation.ts`의 `onDisplaysChanged`와 `powerMonitor resume` 핸들러에서 `endGrab()` 호출. 렌더러의 blur·`lostpointercapture` 해제는 T009에서 처리됨을 확인.
- [x] T016 [US3] 기존 E2E(`launch`, `settings`)와 단위 테스트 전체 통과 확인(SC-005).

## Phase 5: Polish & 문서

- [x] T017 [P] 로드맵 정정: `specs/ROADMAP.md`의 "롱프레스" 표기를 드래그로 바꾸고 004를 완료 기능 표에 추가(검증 전이면 "수동 검증 대기"), 다음 할 일 1번 제거·5번 정리.
- [x] T018 [P] `specs/001-character-autonomous-movement/contracts/ipc.md`의 "롱프레스 잡기" 표기를 "드래그 잡기"로 정정하고 채널 확정을 004 계약으로 링크.
- [x] T019 [P] `tests/manual/results.md`에 004 수동 검증 표(quickstart 1~9번, macOS "대기", Windows "후속") 추가. `CLAUDE.md`의 해당 문구가 있으면 함께 정정.
- [ ] T020 spec.md 상태를 갱신하고, 수동 검증은 사용자가 "N번 통과"로 알려 주면 표와 이 파일을 갱신한다(에이전트는 실제 마우스 입력을 못 한다).

## Dependencies & Execution Order

- Phase 1 → Phase 2(US1) → Phase 3(US2), Phase 4(US3). US2·US3는 US1 완료 후 서로 독립이다.
- Phase 1: T001·T002·T005 병렬 → T003(T001 후) → T004(T002·T003 후).
- US1: T006(E2E 먼저) → T007 → T008 → T009 → T010.
- US3의 T015는 T007(simulation 연결) 이후.

## Parallel Example

```text
Phase 1 시작: T001, T002, T005 동시 진행
US2와 US3의 테스트 작성: T011, T013 동시 진행
Phase 5: T017, T018, T019 동시 진행
```

## Implementation Strategy

1. Phase 1 + US1로 MVP를 만들어 `npm run dev`로 직접 확인한다.
2. US2·US3로 안전장치와 회귀 방지를 더한다.
3. 매 단계 끝에 `npm test`, 타입 검사, `npm run test:e2e`를 돌린다. 수동 검증은 사용자가 수행한다.
