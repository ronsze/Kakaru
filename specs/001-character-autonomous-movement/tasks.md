---

description: "캐릭터 자율 이동 구현 작업 목록"
---

# Tasks: 캐릭터 자율 이동

**Input**: `/specs/001-character-autonomous-movement/`의 설계 문서

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc.md, quickstart.md

**Tests**: plan.md의 테스트 전략(R8)과 헌장 원칙 V에 따라 이동 로직·히트 판정의 단위 테스트와 앱 기동 E2E를 포함한다. 테스트는 구현보다 먼저 작성하고 실패를 확인한다.

**Organization**: 작업은 사용자 스토리별로 묶어 각 스토리를 독립적으로 구현·검증할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능(서로 다른 파일, 미완료 작업에 대한 의존 없음)
- **[Story]**: 소속 사용자 스토리(US1, US2, US3)
- 설명에 정확한 파일 경로를 포함한다

## Path Conventions

단일 Electron 프로젝트(저장소 루트의 `src/`, `tests/`). 구조는 plan.md의 Project Structure를 따른다.

---

## Phase 1: Setup (공통 인프라)

**Purpose**: 프로젝트 초기화와 기본 구조

- [ ] T001 저장소 루트에 `package.json` 생성: electron, typescript, electron-vite, vitest, @playwright/test 의존성과 `dev`, `build`, `test`(vitest run), `test:e2e`(playwright test) 스크립트 정의
- [ ] T002 [P] `tsconfig.json`, `tsconfig.node.json`(main/preload용), `tsconfig.web.json`(renderer용) 작성, `src/shared`는 양쪽에서 참조 가능하게 설정
- [ ] T003 [P] `electron.vite.config.ts` 작성: main(`src/main/index.ts`), preload(`src/preload/index.ts`), renderer(`src/renderer/index.html`) 3분할 진입점
- [ ] T004 [P] `vitest.config.ts`(대상 `tests/unit/**/*.test.ts`)와 `playwright.config.ts`(대상 `tests/e2e`) 작성
- [ ] T005 [P] `.gitignore`에 `node_modules/`, `out/`, `dist/` 추가

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**Purpose**: 어떤 사용자 스토리든 시작 전에 끝나야 하는 공통 타입·설정·IPC 뼈대

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 작업을 시작할 수 없다

- [ ] T006 [P] `src/shared/types.ts`에 data-model.md의 타입 정의: `Point {x,y}`, `Rect`, `Heading = -1 | 1`, `BehaviorState = 'Walking' | 'Idle' | 'UserControlled'`, `Character {position, heading, velocity, state, target: Point | null, stateUntil: number(ms, 시뮬레이션 시각), hitRadius: number(DIP)}`
- [ ] T007 [P] `src/shared/config.ts`에 research.md R6의 행동 파라미터를 상수로 정의: 걷기 속도 80px/s, 이동 구간 2~6초, 정지 1~4초(균등 무작위), 시작 후 5초 이내 첫 이동, 시뮬레이션 틱 60Hz, 기본 `hitRadius`
- [ ] T008 [P] `src/shared/ipc.ts`에 채널 이름 `character:update`와 페이로드 타입 `CharacterUpdate {visible: boolean, x: number, y: number, heading: -1 | 1, state: 'Walking' | 'Idle' | 'UserControlled'}` 정의(contracts/ipc.md 기준)
- [ ] T009 `src/preload/index.ts`에 `contextBridge`로 `onCharacterUpdate(callback)`만 노출(렌더러에 Node 접근을 주지 않는다), T008 타입 사용
- [ ] T010 `src/main/index.ts`에 앱 진입점 작성: `app.whenReady()`, 단일 인스턴스 잠금, macOS Dock 아이콘 숨김(`app.dock.hide()`), 모든 창이 닫혀도 앱 유지, 종료 처리
- [x] T011 `specs/001-character-autonomous-movement/spec.md` 보완 반영 확인: FR-003·FR-004·SC-003·SC-006·SC-007과 US3 범위 명시, quickstart.md 수동 #9 추가가 spec/quickstart에 반영돼 있는지 확인하고 research R9의 성능 기준과 일치시킨다(헌장 원칙 III: 수치 기준은 스펙에서 정의)

**Checkpoint**: 기반 완료 — 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 캐릭터가 스스로 화면을 돌아다닌다 (Priority: P1) 🎯 MVP

**Goal**: 앱 실행 후 입력 없이 5초 안에 캐릭터가 나타나 이동·정지·방향 전환을 반복하고, 이동 가능 영역 밖으로 나가지 않는다.

**Independent Test**: 앱을 실행하고 입력 없이 1분 관찰해 캐릭터가 여러 위치로 이동하는지 확인한다(quickstart 수동 #1, #2, #6, #8).

### Tests for User Story 1 ⚠️

> **NOTE: 구현 전에 먼저 작성하고 실패를 확인한다**

- [ ] T012 [P] [US1] `tests/unit/area.test.ts`: `WalkableArea`의 `contains`, `containsSegment`(L자 배치처럼 비직사각형에서 빈 공간을 지나는 선분은 false), `clamp`(영역 밖 점을 가장 가까운 내부 점으로), `displayAt` 검증
- [ ] T013 [P] [US1] `tests/unit/behavior.test.ts`: 시작 후 5초 안에 Walking 진입(SC-001), 목표 도달 시 Walking→Idle, Idle 만료 시 Idle→Walking, 고정 시드와 고정 dt(1/60초)로 10분 분량을 시뮬레이션해 `position`이 항상 영역 안, 한 방향으로만 끝없이 이동하지 않음(FR-003), `state !== Walking`이면 `velocity`가 0

### Implementation for User Story 1

- [ ] T014 [P] [US1] `src/shared/area.ts`에 `WalkableArea` 구현: `displays: Rect[]`, `contains(point)`, `containsSegment(a, b)`, `clamp(point)`, `displayAt(point)` (data-model.md 연산 정의대로)
- [ ] T015 [US1] `src/shared/behavior.ts`에 `MovementEngine` 구현(T014 의존): `tick(now, dt): Character`, `setWalkableArea(area)`. 검증 규칙을 코드로 보장 — "`position`은 항상 `WalkableArea` 안에 있어야 한다", "`state === Walking`이면 `target !== null`이고, 현재 위치→`target` 직선이 `WalkableArea` 안에 있어야 한다", "`state !== Walking`이면 `velocity`는 0이다". 직선 경로가 막히면 다른 목표를 다시 고르고, 직전 이동 방향과 다른 쪽을 우선한다. 난수원은 시드 가능한 함수(`random: () => number`)를 생성자 인자로 받고, 시각은 `tick(now, dt)` 인자로만 받아 테스트가 결정적이다
- [ ] T016 [P] [US1] `src/renderer/index.html`과 `src/renderer/draw.ts`: 배경이 완전히 투명한 전체 크기 Canvas 2D, `onCharacterUpdate`를 받아 `visible`이면 `(x, y)`에 폴리곤으로 그린 캐릭터(몸·머리·다리·눈, research R11)를 `heading`에 따라 좌우 반전해 그리고 아니면 비움. `state`가 Walking이면 다리·몸 좌표를 시간에 따라 흔들고 Idle/UserControlled이면 숨쉬기 정도의 미세 움직임만 준다. 외부 이미지 파일은 사용하지 않는다
- [ ] T017 [US1] `src/main/overlay.ts`: 디스플레이마다 `BrowserWindow`를 만들어 해당 `bounds`에 맞춤. 옵션은 `transparent: true`, `frame: false`, `alwaysOnTop: true`, `skipTaskbar: true`, `focusable: false`, `hasShadow: false`, `webPreferences`에 preload 지정·`contextIsolation: true`. 생성 직후 `setIgnoreMouseEvents(true)`로 기본 클릭 통과 상태 유지. `displayId → window` 맵 제공
- [ ] T018 [US1] `src/main/simulation.ts`: 60Hz 틱 루프. `screen.getAllDisplays()`의 `bounds`로 `WalkableArea` 구성, `MovementEngine.tick` 호출, `area.displayAt(position)`에 해당하는 창에는 `visible: true`와 창 로컬 좌표, 나머지 창에는 `visible: false`로 `character:update` 전송. 히트 테스트가 쓸 수 있도록 현재 캐릭터와 이동 가능 영역을 반환하는 `getCharacter()`를 export한다
- [ ] T019 [US1] `src/main/index.ts`에서 `overlay`와 `simulation`을 연결해 앱 시작 시 오버레이 생성 및 시뮬레이션 시작(T010, T017, T018 의존)
- [ ] T020 [US1] `src/main/overlay.ts`와 `src/main/simulation.ts`에 `screen`의 `display-added`/`display-removed`/`display-metrics-changed` 구독 추가: 오버레이 창 재구성, `WalkableArea` 갱신, 영역 밖이면 `clamp` (FR-008)
- [ ] T021 [US1] `src/main/simulation.ts`에 `powerMonitor`의 `resume` 구독 추가: 틱 기준 시각을 초기화해 큰 시간 점프 방지
- [ ] T022 [US1] `tests/e2e/launch.test.ts`(T019 이후, Playwright Electron): 앱 기동 후 5초 안에 `character:update`의 위치가 변하고, 오버레이 창이 `setIgnoreMouseEvents(true)` 상태로 시작하는지 확인
- [ ] T023 [US1] macOS와 Windows에서 quickstart.md 수동 #1, #2, #6, #8을 실행하고 결과를 `tests/manual/results.md`에 기록

**Checkpoint**: 이 시점에 US1은 단독으로 완전히 동작하고 검증 가능해야 한다(MVP)

---

## Phase 4: User Story 2 - 작업을 방해하지 않고 이동한다 (Priority: P2)

**Goal**: 캐릭터가 없는 영역의 클릭·입력은 아래 창에 전달되고, 커서가 캐릭터 위에 있을 때만 캐릭터가 입력을 받는다. 전체 화면 앱 위에서도 입력을 가로채지 않는다.

**Independent Test**: 다른 앱 창을 띄우고 캐릭터가 이동하는 중 캐릭터가 없는 영역을 클릭·입력해 정상 동작하는지 확인한다(quickstart 수동 #3, #4, #5, #7).

### Tests for User Story 2 ⚠️

- [ ] T024 [P] [US2] `tests/unit/hit.test.ts`: 커서가 `position`에서 `hitRadius` 이내이면 true, 경계 바로 밖이면 false, 서로 다른 디스플레이 좌표에서도 가상 데스크탑 좌표 기준으로 판정

### Implementation for User Story 2

- [ ] T025 [P] [US2] `src/shared/hit.ts`에 순수 함수 `isCursorOnCharacter(cursor, character)` 구현(Electron 비의존, `Character.hitRadius` 사용)
- [ ] T026 [US2] `src/main/hit-test.ts`: 약 60Hz로 `screen.getCursorScreenPoint()`를 폴링하고 `simulation.getCharacter()`(T018)로 위치·상태를 얻어 `isCursorOnCharacter`가 true이면 캐릭터가 있는 디스플레이의 창만 `setIgnoreMouseEvents(false)`, 아니면 `true`. 값이 바뀔 때만 호출하고, 사용자 조작 중(`UserControlled`)에는 해제 상태를 유지(T018, T025 의존)
- [ ] T027 [P] [US2] `src/main/platform/index.ts`에 `PlatformAdapter { configureOverlay(win: BrowserWindow): void }`와 `process.platform` 기반 선택 로직 정의
- [ ] T028 [P] [US2] `src/main/platform/mac.ts`: `setAlwaysOnTop(true, 'screen-saver')`, `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`
- [ ] T029 [P] [US2] `src/main/platform/win.ts`: `setAlwaysOnTop(true, 'screen-saver')`
- [ ] T030 [US2] `src/main/overlay.ts`의 창 생성 직후 `platform.configureOverlay(win)` 호출, `src/main/index.ts`에서 `hit-test` 시작(T026, T027~T029 의존)
- [ ] T031 [US2] `tests/e2e/click-through.test.ts`(T030 이후): 커서를 캐릭터 밖으로 두면 오버레이 창이 통과 상태, 캐릭터 위로 옮기면 해제 상태가 되는지 메인 프로세스 평가로 확인
- [ ] T032 [US2] macOS와 Windows에서 quickstart.md 수동 #3, #4, #5, #7, #9(작업 표시줄·메뉴 막대·Dock 위 표시와 조작)를 실행하고, 캐릭터 진입 직후 첫 클릭이 유실되는지(research R2 검증 항목)와 전체 화면 앱 위 표시 여부(R3)를 `tests/manual/results.md`에 기록

**Checkpoint**: US1과 US2가 모두 독립적으로 동작해야 한다

---

## Phase 5: User Story 3 - 사용자 조작 중에는 자율 이동을 멈춘다 (Priority: P3)

**Goal**: 사용자 조작(롱프레스·우클릭 메뉴)이 시작되면 0.5초 안에 자율 이동이 멈추고, 조작이 끝나면 현재 위치에서 Idle로 재개된다. 롱프레스·메뉴 자체는 별도 기능이며 여기서는 상태 전이 능력만 마련한다.

**Independent Test**: `setUserControlled`를 호출해 상태가 멈추고 해제하면 현재 위치에서 재개되는지 단위 테스트로 확인한다.

### Tests for User Story 3 ⚠️

- [ ] T033 [P] [US3] `tests/unit/behavior-user-control.test.ts`: `setUserControlled(true)` 호출 후 한 틱 안에 `state === 'UserControlled'`, `velocity`는 0, 이후 틱에서 `position` 불변(FR-006, SC-004). Walking·Idle 어디서든 진입 가능. `setUserControlled(false)` 시 항상 `Idle`로 복귀하고 `stateUntil`을 새로 설정하며 `position`은 그 자리 유지

### Implementation for User Story 3

- [ ] T034 [US3] `src/shared/behavior.ts`에 `setUserControlled(active, now)` 구현: "`state === UserControlled`이면 자율 이동 로직은 `position`을 바꾸지 않는다", 종료 시 data-model.md 규칙대로 `Idle` 복귀(T015 의존)
- [ ] T035 [US3] `src/main/simulation.ts`에서 `setUserControlled(active)`를 내부 API로 export: 호출 즉시 엔진에 반영하고 다음 `character:update`의 `state`에 반영. 렌더러 입력 IPC 채널은 롱프레스·메뉴 기능에서 추가하므로 이번에는 만들지 않는다(contracts/ipc.md)

**Checkpoint**: 세 스토리가 모두 독립적으로 동작해야 한다

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 여러 스토리에 걸친 마무리

- [ ] T036 [P] 저장소 루트에 한국어 `README.md` 작성: 프로젝트 소개, 실행(`npm run dev`)·테스트(`npm test`, `npm run test:e2e`) 방법, 지원 OS
- [ ] T037 macOS와 Windows에서 유휴 평균 CPU와 메모리를 측정해 spec의 SC-006·SC-007 기준(CPU 3% 이하, 메모리 300MB 이하, 30fps 이상)과 비교하고 `tests/manual/results.md`에 기록
- [ ] T038 quickstart.md 전체 절차(자동 + 수동 #1~#9)를 macOS·Windows에서 최종 검증하고, T032의 전체 화면 앱 위 표시 결과를 spec Edge Cases에 OS별 차이로 반영한다(헌장: 한 OS에서만 되는 동작은 스펙에 명시)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 바로 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 사용자 스토리를 막는다
- **User Stories (Phase 3~5)**: Foundational 완료 후 시작
  - US2는 US1의 오버레이·시뮬레이션(T017~T019)에 의존한다(통과 해제를 걸 대상이 필요)
  - US3는 US1의 `MovementEngine`(T015)에 의존하고, US2와는 독립적이다
- **Polish (Phase 6)**: 원하는 스토리가 모두 끝난 뒤

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작, 다른 스토리에 의존 없음
- **US2 (P2)**: US1의 오버레이 창(T017)·시뮬레이션(T018) 위에 얹는다. 순수 로직(T025)은 먼저 시작 가능
- **US3 (P3)**: US1의 `behavior.ts`(T015) 이후. 같은 파일을 수정하므로 T015 완료 후 순차 진행

### Within Each User Story

- 테스트를 먼저 작성하고 실패를 확인한다
- 타입·순수 로직 → 엔진 → 메인 프로세스 연결 → 수동 검증 순서
- 같은 파일(`overlay.ts`, `simulation.ts`, `behavior.ts`, `index.ts`)을 건드리는 작업은 순차 진행한다

### Parallel Opportunities

- Setup: T002~T005 병렬
- Foundational: T006~T008 병렬
- US1: T012·T013(테스트), T014·T016 병렬
- US2: T024·T025, T027~T029 병렬
- 서로 다른 개발자가 US2의 순수 로직(T024·T025·T027~T029)과 US3 테스트(T033)를 동시에 진행할 수 있다

---

## Parallel Example: User Story 1

```bash
# US1 테스트를 함께 작성:
Task: "tests/unit/area.test.ts WalkableArea 검증"
Task: "tests/unit/behavior.test.ts 상태 전이·경계 검증"

# 서로 다른 파일 구현을 함께:
Task: "src/shared/area.ts WalkableArea 구현"
Task: "src/renderer/draw.ts Canvas 2D 렌더링"
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료(필수)
3. Phase 3 US1 완료
4. **멈추고 검증**: 오버레이가 기본 통과 상태이므로 US1만으로도 다른 앱 사용을 막지 않는다. quickstart #1, #2를 확인
5. 데모 가능

### Incremental Delivery

1. Setup + Foundational → 기반 완료
2. US1 → 독립 검증 → 데모(MVP)
3. US2 → 캐릭터 위 입력 수신과 전체 화면 위 표시 → 독립 검증
4. US3 → 사용자 조작 시 정지·재개 → 독립 검증
5. 각 스토리는 이전 스토리를 깨지 않고 가치를 더한다

---

## Notes

- [P] 작업은 서로 다른 파일이고 의존이 없다
- [Story] 라벨로 작업과 스토리를 추적한다
- 롱프레스 이동과 우클릭 메뉴는 별도 기능이다(US3는 그 기능이 쓸 상태 전이만 제공)
- 작업 또는 논리적 묶음마다 커밋한다
- 같은 파일 충돌과 스토리 간 의존을 피한다
