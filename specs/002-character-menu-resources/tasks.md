---

description: "우클릭 메뉴와 캐릭터 리소스 설정 구현 작업 목록"
---

# Tasks: 우클릭 메뉴와 캐릭터 리소스 설정

**Input**: `/specs/002-character-menu-resources/`의 설계 문서

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ipc.md, contracts/storage.md, quickstart.md. 001의 코드(오버레이, `MovementEngine.setUserControlled`, 히트 테스트)를 이어서 쓴다.

**Tests**: plan.md의 테스트 전략과 헌장 원칙 V에 따라 검증 규칙·저장소·메뉴 상태의 단위 테스트와 설정 창 E2E를 포함한다. 테스트는 구현보다 먼저 작성하고 실패를 확인한다.

**Organization**: 작업은 사용자 스토리별로 묶어 각 스토리를 독립적으로 구현·검증할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 실행 가능(서로 다른 파일, 미완료 작업에 대한 의존 없음)
- **[Story]**: 소속 사용자 스토리(US1, US2, US3)
- 설명에 정확한 파일 경로를 포함한다

## Path Conventions

단일 Electron 프로젝트(저장소 루트의 `src/`, `tests/`). 구조는 plan.md의 Project Structure를 따른다.

---

## Phase 1: Setup (공통 인프라)

**Purpose**: 설정 창이 쓰는 두 번째 렌더러 페이지와 preload를 빌드에 추가

- [x] T001 `electron.vite.config.ts`의 `renderer.build.rollupOptions.input`에 `settings`(`src/renderer/settings.html`)를, `preload.build.rollupOptions.input`에 `settings`(`src/preload/settings.ts`)를 추가한다. 출력은 `out/renderer/settings.html`, `out/preload/settings.js`

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**Purpose**: 어떤 사용자 스토리든 시작 전에 끝나야 하는 공통 타입·IPC 타입·저장소

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 작업을 시작할 수 없다

- [x] T002 [P] `src/shared/characters.ts`에 data-model.md의 타입과 제한 상수를 정의한다: `CharacterSet {id: string(정규식 ^[a-z0-9]{8,32}$), name: string(앞뒤 공백 제거 후 1~30자), frames: number(정수 2~32), frameSize: number(64~512), createdAt: number(ms, epoch)}`, `Settings {version: 1, activeId: string | null, characters: CharacterSet[]}`, `Appearance {walkUrl: string | null, idleUrl: string | null, frames: number}`, `ValidationError {code, target, message}`와 9개 코드(`not-png`, `too-large`, `corrupt-image`, `bad-frame-count`, `bad-walk-size`, `bad-idle-size`, `not-transparent`, `bad-name`, `duplicate-name`), 상수(이미지당 최대 5MB, 예약어 "기본", 기본 캐릭터 프레임 수 4)
- [x] T003 [P] `src/shared/ipc.ts`에 contracts/ipc.md의 채널 이름(`character:appearance`, `characters:list`, `characters:validate`, `characters:register`, `characters:apply`, `characters:delete`, `characters:changed`)과 페이로드 타입(`CharacterSummary`, `ListResult`, `RegisterInput`, `ValidationResult`, `RegisterResult`)을 추가하고, `KakaruApi`에 `onAppearance(callback)`를, 새 `KakaruSettingsApi`(list, validate, register, apply, delete, onChanged)를 정의한다
- [x] T004 [P] `tests/unit/png-fixture.ts`에 테스트용 PNG 생성 도우미를 만든다: 너비·높이·색상 유형(RGBA, RGB)·투명 픽셀 유무를 받아 유효한 PNG 바이트를 만든다(Node `zlib`로 IDAT 압축, CRC 계산 포함). 잘린 파일과 시그니처가 틀린 파일을 만드는 함수도 둔다
- [x] T005 [P] `src/main/index.ts` 맨 위(앱 `ready` 이전)에 환경 변수 `KAKARU_USER_DATA`가 있으면 `app.setPath('userData', 값)`으로 사용자 데이터 폴더를 바꾸는 코드를 추가한다(E2E·단위 테스트 격리용, research R7)
- [x] T006 [P] `tests/unit/characters-store.test.ts`: 임시 폴더를 루트로 쓰는 `CharacterStore` 테스트. 빈 상태 로드, 캐릭터 추가 후 `characters/<id>/walk.png`·`idle.png` 생성과 `settings.json` 기록, 재로드 시 유지, `id`가 `^[a-z0-9]{8,32}$`가 아니면 거부(경로 조작 방지), 쓰기 후 `settings.json.tmp`가 남지 않음, 이미지 저장 중 실패하면 만든 폴더를 지움, `settings.json`이 깨졌으면 `settings.json.broken-<ms>`로 보존하고 빈 상태로 시작, `version` 불일치도 같은 처리
- [x] T007 `src/main/characters-store.ts`에 `CharacterStore`(루트 경로를 생성자 인자로 받는 Electron 비의존 클래스)를 구현한다(T002, T006 의존): `load()`, `list()`, `add(meta, walkBytes, idleBytes)`, 원자적 쓰기(임시 파일에 쓴 뒤 `rename`). 불변식을 코드로 보장 — "`activeId`가 `null`이 아니면 `characters`에 그 id가 있어야 하고 이미지 파일이 읽혀야 한다. 어긋나면 `activeId`를 `null`로 되돌리고 `problem`을 설정한다"

**Checkpoint**: 기반 완료 — 사용자 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 캐릭터를 우클릭해 메뉴를 연다 (Priority: P1) 🎯 MVP

**Goal**: 캐릭터를 우클릭하면 0.5초 안에 "캐릭터 설정" 항목이 있는 메뉴가 열리고 캐릭터가 멈추며, 메뉴를 닫으면 같은 자리에서 다시 이동한다. 캐릭터가 없는 영역의 우클릭은 아래 창에 전달된다. "캐릭터 설정"을 선택하면 설정 창(골격)이 열린다.

**Independent Test**: 캐릭터를 우클릭해 메뉴가 열리고 캐릭터가 멈추는지, 닫으면 같은 자리에서 다시 이동하는지, 설정 창이 열리는지 확인한다(quickstart 수동 #1~#7).

### Tests for User Story 1 ⚠️

> **NOTE: 구현 전에 먼저 작성하고 실패를 확인한다**

- [ ] T008 [P] [US1] `tests/unit/context-menu.test.ts`: 메뉴 컨트롤러(팝업·`setUserControlled`·설정 창 열기를 포트로 주입). 우클릭하면 `setUserControlled(true)`와 `popup`이 한 번 호출됨, 메뉴가 열려 있는 동안 들어온 우클릭은 무시됨(FR-005), 닫힘 콜백에서 `setUserControlled(false)`가 호출되고 다시 열 수 있음, "캐릭터 설정" 항목을 선택하면 설정 창 열기가 호출되고 메뉴는 닫힘 처리됨

### Implementation for User Story 1

- [ ] T009 [US1] 스파이크(임시 코드, macOS): 오버레이 창에 `webContents.on('context-menu', …)`로 `Menu.popup()`을 연결해 research R1·R2의 두 가정을 확인한다 — `focusable: false` 오버레이에서 `context-menu`가 발생하는지, 최상위 레벨 오버레이 위·전체 화면 앱 위에서 네이티브 메뉴가 보이는지. 결과를 `research.md`의 R1·R2 "검증 필요" 항목에 기록한다. 이벤트가 발생하지 않으면 렌더러의 `contextmenu` DOM 이벤트를 IPC로 알리는 방식으로 plan을 수정한다
- [x] T010 [P] [US1] `src/renderer/settings.html`과 `src/renderer/settings.ts`와 `src/preload/settings.ts`에 설정 창 골격을 만든다: 제목 "캐릭터 설정"만 보이는 빈 페이지(이후 스토리에서 채움), preload는 빈 `kakaruSettings` 객체만 노출, CSP는 `default-src 'none'; script-src 'self'; style-src 'unsafe-inline'; img-src 'self' data: blob:`
- [ ] T011 [US1] `src/main/settings-window.ts`에 `openSettingsWindow()`를 구현한다(T010 의존): 프레임이 있는 포커스 가능 `BrowserWindow`(약 720×560, 크기 고정, 제목 "캐릭터 설정", `contextIsolation: true`, `sandbox: true`, preload는 `out/preload/settings.js`), 이미 열려 있으면 새로 만들지 않고 앞으로 가져옴, 닫히면 파괴. 개발 서버에서는 `${ELECTRON_RENDERER_URL}/settings.html`, 빌드 후에는 `out/renderer/settings.html`을 로드한다. 앱 인자 `--open-settings`가 있으면 시작 직후 연다
- [ ] T012 [US1] `src/shared/context-menu-controller.ts`(순수 메뉴 상태 로직)와 `src/main/context-menu.ts`(Electron 연결)를 구현한다(T008, T009, T011 의존): 메뉴 컨트롤러와 Electron 연결(`Menu.buildFromTemplate`로 "캐릭터 설정" 항목 하나, `popup({ window, callback })`). 메뉴를 열 때 `simulation.setUserControlled(true)`, 닫힘 콜백에서 `false`를 호출한다
- [ ] T013 [US1] `src/main/overlay.ts`의 오버레이 창 생성 시 `webContents`의 `context-menu` 이벤트를 메뉴 컨트롤러에 연결하고, `src/main/index.ts`에서 컨트롤러를 만들어 `openSettingsWindow`와 `setUserControlled`를 주입한다(T012 의존)
- [ ] T014 [US1] macOS에서 quickstart.md 수동 #1~#7을 실행하고 결과를 `tests/manual/results.md`의 002 섹션에 기록한다

**Checkpoint**: 이 시점에 US1은 단독으로 완전히 동작하고 검증 가능해야 한다(MVP)

---

## Phase 4: User Story 2 - 캐릭터 이미지를 등록한다 (Priority: P2)

**Goal**: 설정 창에서 이름·프레임 수·걷기 이미지·정지 이미지를 지정해 미리보기를 보고 등록한다. 조건에 맞지 않으면 이유와 함께 거부한다.

**Independent Test**: 올바른 이미지는 등록되어 목록에 나타나고, 잘못된 이미지는 거부되고 이유가 표시되는지 확인한다(quickstart 수동 #8, #9).

### Tests for User Story 2 ⚠️

- [ ] T015 [P] [US2] `tests/unit/png-header.test.ts`: `parsePngHeader`가 유효한 PNG의 너비·높이·색상 유형·비트 깊이를 돌려줌, 시그니처가 다르면(JPEG 등) `not-png`, IHDR가 잘린 파일은 `corrupt-image`로 판정(T004 도우미 사용)
- [ ] T016 [P] [US2] `tests/unit/characters-validation.test.ts`: `validateRegistration`이 9개 오류 코드를 각각 판정(`not-png`, `too-large`(5MB 초과), `corrupt-image`, `bad-frame-count`(0·1·33과 정수가 아닌 값), `bad-walk-size`(너비가 `높이×프레임 수`가 아님, 높이 63·513), `bad-idle-size`(정사각형이 아님·걷기와 한 변이 다름), `not-transparent`(걷기·정지 각각), `bad-name`(빈 이름·공백뿐·31자·"기본"), `duplicate-name`(대소문자 무시)), 경계값(프레임 수 2와 32, 한 변 64와 512, 이름 1자와 30자)은 통과, 여러 오류가 한 번에 모두 반환됨, 올바른 입력은 `{ ok: true, frameSize }`

### Implementation for User Story 2

- [ ] T017 [US2] `src/shared/characters.ts`에 `parsePngHeader(bytes)`와 `validateRegistration(input, inspector, existingNames)`를 구현한다(T002, T015, T016 의존). `ImageInspector` 포트는 `hasTransparentPixels(bytes): boolean | 'corrupt'`이며 Electron에 의존하지 않는다. 규칙은 research R6 표와 data-model.md 검증 규칙을 그대로 따른다 — "걷기 이미지의 크기는 `너비 = frameSize × frames, 높이 = frameSize`, 정지 이미지는 `너비 = 높이 = frameSize`", "두 이미지 모두 알파 값이 255가 아닌 픽셀이 하나 이상", "이미지는 PNG이고 각각 5MB 이하"
- [ ] T018 [US2] `src/main/characters-ipc.ts`에 `ipcMain.handle`로 `characters:list`, `characters:validate`, `characters:register`를 구현한다(T003, T007, T017 의존). `nativeImage.createFromBuffer`로 `ImageInspector`를 구현(`toBitmap()`을 훑어 알파 < 255인 픽셀 확인, 디코딩 실패는 `corrupt-image`), `crypto.randomBytes`로 `^[a-z0-9]{8,32}$` id 생성, 등록 성공 시 `characters:changed`를 설정 창에 보낸다(활성 캐릭터는 바꾸지 않음). `list`의 기본 캐릭터 항목은 `id: null`, `builtin: true`, `frames: 4`, `frameSize: 200`이고 `idleUrl`은 빈 문자열(설정 화면이 번들의 기본 이미지로 대체). `src/main/index.ts`에서 저장소를 만들고 핸들러를 등록한다
- [ ] T019 [US2] `src/preload/settings.ts`에 `kakaruSettings.list()`, `validate(input)`, `register(input)`, `onChanged(callback)`을 노출한다(T003 의존). `ArrayBuffer`는 그대로 `invoke`로 전달한다
- [ ] T020 [US2] `src/renderer/settings.html`과 `src/renderer/settings.ts`에 등록 화면을 구현한다(T019 의존): 이름 입력, 프레임 수 입력(기본 8), 걷기·정지 이미지용 `<input type="file" accept="image/png">`(파일을 `File.arrayBuffer()`로 읽어 5MB를 넘으면 읽지 않고 바로 안내), 입력이 바뀔 때마다 `validate`를 호출해 오류 메시지를 필드 옆에 표시하고 오류가 있으면 등록 버튼 비활성화, 미리보기(걷기는 프레임 수대로 `steps()`로 반복 재생하는 100×100 표시, 정지는 100×100, `Blob URL` 사용 후 `revokeObjectURL`), 등록 성공 후 입력 초기화와 완료 안내, 등록된 캐릭터 목록(기본 캐릭터가 맨 위, 이름·정지 이미지 썸네일만 표시, 동작 버튼은 US3에서 추가)
- [ ] T021 [P] [US2] `tests/e2e/settings.test.ts`(Playwright Electron, `KAKARU_USER_DATA`를 임시 폴더로, 앱 인자 `--open-settings`): 제목이 "캐릭터 설정"인 창을 찾아 이름 입력·`setInputFiles`로 `src/renderer/assets/walk.png`(프레임 수 4)·`idle.png`를 지정하면 오류가 없고 등록 버튼이 활성화됨, 등록하면 목록에 이름이 나타남, 정사각형이 아닌 정지 이미지(`tests/unit/png-fixture.ts`로 생성한 파일)를 지정하면 `bad-idle-size` 메시지가 보이고 등록 버튼이 비활성화됨(T018~T020 이후)
- [ ] T022 [US2] macOS에서 quickstart.md 수동 #8, #9(조건 위반 10종)를 실행하고 결과를 `tests/manual/results.md`에 기록한다

**Checkpoint**: US1과 US2가 모두 독립적으로 동작해야 한다

---

## Phase 5: User Story 3 - 등록한 캐릭터를 선택하고 관리한다 (Priority: P3)

**Goal**: 등록한 캐릭터를 선택하면 2초 안에 화면 위 캐릭터가 바뀌고(위치·방향 유지) 앱을 다시 실행해도 유지된다. 삭제와 기본 복귀가 되고, 이미지가 손상되면 기본으로 표시하며 문제를 알린다.

**Independent Test**: 캐릭터 두 개를 등록해 번갈아 선택하면 화면 위 모습이 바뀌고, 앱을 다시 실행해도 마지막 선택이 유지되는지 확인한다(quickstart 수동 #10~#13).

### Tests for User Story 3 ⚠️

- [ ] T023 [P] [US3] `tests/unit/characters-store-active.test.ts`: `setActive(id)`가 저장되고 재로드해도 유지됨, 없는 id는 거부, `setActive(null)`은 기본으로 복귀, `remove(id)`가 목록·폴더를 지우고 폴더 삭제가 실패해도 목록에서는 사라진 상태를 유지, 활성 캐릭터를 지우면 `activeId`가 `null`이 됨(FR-013), `readAppearance()`가 기본이면 `{ walkUrl: null, idleUrl: null, frames: 4 }`, 사용자 캐릭터이면 이미지의 `data:image/png;base64,…` URL과 `frames`를 돌려줌, 활성 캐릭터의 이미지 파일이 없으면 기본 외형으로 대체하고 `notice`를 설정함(FR-015)

### Implementation for User Story 3

- [ ] T024 [US3] `src/main/characters-store.ts`에 `setActive(id | null)`, `remove(id)`, `readAppearance()`를 구현한다(T007, T023 의존). 반환값에 문제 알림(`notice`)을 포함하고 `list()`는 이미지가 없는 항목에 `problem`을 채운다
- [ ] T025 [US3] `src/main/characters-ipc.ts`에 `characters:apply`(인자 `id | null`)와 `characters:delete`(기본 캐릭터 거부)를 구현하고(T018, T024 의존), 변경 후 모든 오버레이 창에 `character:appearance`를, 설정 창에 `characters:changed`를 보낸다. `src/main/overlay.ts`는 오버레이 창의 `did-finish-load`(모니터 추가로 새로 만든 창 포함) 때 현재 `Appearance`를 다시 보내고, 앱 시작 시에는 저장된 활성 캐릭터를 읽어 적용한다
- [ ] T026 [P] [US3] `src/preload/index.ts`에 `onAppearance(callback)`을, `src/preload/settings.ts`에 `apply(id)`, `delete(id)`를 추가한다(T003 의존)
- [ ] T027 [US3] `src/renderer/draw.ts`와 `src/renderer/index.html`이 `Appearance`를 반영하게 한다(T026 의존): `walkUrl`·`idleUrl`이 `null`이면 번들의 기본 이미지, 아니면 `data:` URL을 `<img>`에 지정. 프레임 수 `N`에 따라 CSS 변수(`--frames`, `--strip` = `N × 100px`, `--cycle` = `max(560ms, N × 70ms)`)로 `steps()`·이동 거리·한 바퀴 시간을 계산해 기본 캐릭터(4프레임, 0.56초)와 같은 결과를 낸다. 외형이 바뀌어도 위치·방향·이동 상태는 유지하고, `<img>` `onerror`에서는 기본 이미지로 되돌린다
- [ ] T028 [US3] `src/renderer/settings.ts`의 목록에 동작을 추가한다(T026 의존): 각 항목에 "선택" 버튼과 현재 활성 표시, 사용자 캐릭터에만 "삭제" 버튼(삭제 전 확인), 기본 캐릭터 항목은 삭제 버튼 없음, "기본 캐릭터로 되돌리기" 버튼, 활성 캐릭터의 문제 `notice`·항목별 `problem` 배너, `characters:changed`를 받으면 목록을 다시 불러옴
- [ ] T029 [P] [US3] `tests/e2e/settings.test.ts`를 확장한다(T025, T027, T028 이후): 캐릭터를 등록·선택하면 오버레이 창이 `walkUrl`이 `data:image/png`로 시작하는 `character:appearance`를 받음, 같은 `KAKARU_USER_DATA`로 앱을 다시 실행하면 오버레이가 같은 활성 캐릭터의 `character:appearance`를 받음(SC-007), 활성 캐릭터를 삭제하면 `walkUrl: null`(기본)을 받음, 기본 캐릭터 항목에는 삭제 버튼이 없음
- [ ] T030 [US3] macOS에서 quickstart.md 수동 #10~#13을 실행하고 결과를 `tests/manual/results.md`에 기록한다

**Checkpoint**: 세 스토리가 모두 독립적으로 동작해야 한다

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 여러 스토리에 걸친 마무리

- [ ] T031 [P] `README.md`에 메뉴와 캐릭터 설정 사용법, 이미지 규격(PNG, 프레임 한 변 64~512px, 프레임 수 2~32, 5MB 이하, 투명 배경, 오른쪽을 보는 한 방향), 개발·테스트용 환경 변수 `KAKARU_USER_DATA`와 앱 인자 `--open-settings`를 추가한다
- [ ] T032 macOS에서 설정 창을 닫은 유휴 상태의 CPU·메모리를 001과 같은 방법으로 측정해 SC-006(CPU 10% 이하, 메모리 300MB 이하) 유지 여부를 `tests/manual/results.md`에 기록한다(research R10)
- [ ] T033 quickstart.md 전체 절차(자동 + 수동 #1~#13)를 macOS에서 최종 검증하고, Windows 검증과 멀티 모니터·절전 상태에서의 메뉴 동작이 후속임을 spec Assumptions·`tests/manual/results.md`에 명시한다

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 의존 없음 — 바로 시작
- **Foundational (Phase 2)**: Setup 완료 후 — 모든 사용자 스토리를 막는다
- **User Stories (Phase 3~5)**: Foundational 완료 후 시작
  - US2는 US1의 설정 창 골격(T010, T011)에 UI를 채우므로 US1 이후에 진행한다. 순수 로직(T015~T017)은 먼저 시작 가능
  - US3는 US2의 등록·목록(T018, T020)에 선택·삭제를 얹는다
- **Polish (Phase 6)**: 원하는 스토리가 모두 끝난 뒤

### User Story Dependencies

- **US1 (P1)**: Foundational 이후 시작, 다른 스토리에 의존 없음. 설정 창은 빈 골격으로 열린다
- **US2 (P2)**: US1의 설정 창(T011)에 화면을 채운다. 검증 규칙(T017)은 US1과 독립
- **US3 (P3)**: US2의 `characters-ipc.ts`(T018)와 `settings.ts`(T020)를 확장하므로 같은 파일 수정은 순차 진행한다

### Within Each User Story

- 테스트를 먼저 작성하고 실패를 확인한다
- 타입·순수 로직 → 저장소 → 메인 프로세스 연결 → UI → 자동·수동 검증 순서
- 같은 파일(`characters-ipc.ts`, `characters-store.ts`, `overlay.ts`, `settings.ts`, `preload/settings.ts`, `main/index.ts`)을 건드리는 작업은 순차 진행한다

### Parallel Opportunities

- Foundational: T002~T006 병렬(서로 다른 파일)
- US1: T008(테스트)과 T010(설정 창 골격) 병렬
- US2: T015·T016(테스트) 병렬, T021(E2E)은 구현 뒤
- US3: T023(테스트)과 T026(preload) 병렬
- Polish: T031 병렬

---

## Parallel Example: Foundational

```bash
# 서로 다른 파일을 함께:
Task: "src/shared/characters.ts 타입·상수 정의"
Task: "src/shared/ipc.ts 채널·페이로드 타입 추가"
Task: "tests/unit/png-fixture.ts PNG 생성 도우미"
Task: "tests/unit/characters-store.test.ts 저장소 테스트"
```

---

## Implementation Strategy

### MVP First (User Story 1만)

1. Phase 1 Setup 완료
2. Phase 2 Foundational 완료(필수)
3. Phase 3 US1 완료 — 먼저 T009 스파이크로 두 가정(네이티브 메뉴 가시성, `context-menu` 이벤트)을 확인한다
4. **멈추고 검증**: 우클릭 → 메뉴 → 설정 창 열림, 메뉴 동안 정지·닫으면 재개를 확인한다(quickstart #1~#7)
5. 데모 가능

### Incremental Delivery

1. Setup + Foundational → 기반 완료
2. US1 → 독립 검증 → 데모(MVP)
3. US2 → 이미지 등록·거부 → 독립 검증
4. US3 → 선택·유지·삭제·복귀 → 독립 검증
5. 각 스토리는 이전 스토리를 깨지 않고 가치를 더한다

---

## Notes

- [P] 작업은 서로 다른 파일이고 의존이 없다
- [Story] 라벨로 작업과 스토리를 추적한다
- 앱 종료 메뉴 항목은 스펙 범위 밖이라 이 목록에 없다(research R11의 후속 후보)
- Windows 검증은 001과 같이 후속으로 둔다(T033에서 명시)
- 작업 또는 논리적 묶음마다 커밋한다
- 같은 파일 충돌과 스토리 간 의존을 피한다
