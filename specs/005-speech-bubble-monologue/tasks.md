---

description: "말풍선과 혼잣말 작업 목록"
---

# Tasks: 말풍선과 혼잣말

**Input**: `/specs/005-speech-bubble-monologue/`의 plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 프로젝트 규칙(TDD)에 따라 구현보다 먼저 테스트를 쓰고 실패를 확인한다.

## Format: `[ID] [P?] [Story] 설명 (파일 경로)`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 가능

## Phase 1: Foundational (모든 스토리의 선행 조건)

**Purpose**: 문장 정리·선택, Speaker, 설정 값, IPC 필드. 이 단계가 끝나야 스토리를 구현할 수 있다.

- [x] T001 [P] `tests/unit/dialogue.test.ts` 작성: `sanitizeLines(raw)`가 모든 분류(`normal`, `grabbed`, `struggling`) 키를 항상 돌려주고, 문자열이 아닌 값·앞뒤 공백 제거 후 빈 문장·60자 초과 문장을 제외하며, 분류당 최대 50개로 자르고, 알 수 없는 분류 키는 무시하고, `version !== 1`이거나 객체가 아니면 모두 빈 목록인지 검증. `pickLine(candidates, last, random)`이 후보가 없으면 `null`, 후보가 둘 이상이면 `last`를 제외하고 고르며 하나뿐이면 그것을 돌려주는지 검증. 실패 확인.
- [x] T002 [P] `tests/unit/speaker.test.ts` 작성(시드 난수·시계 주입): 시작 후 첫 혼잣말은 간격(20~40초) 이후, 혼잣말은 `normal`에서만 고르고 후보가 없으면 발화하지 않고 다음 시각을 다시 잡는다. `say('grabbed')`는 즉시 발화하고 이전 말풍선을 교체(`id` 증가). 표시 시간은 `clamp(2000 + 150 × 글자 수, 3000, 8000)`. `update`에 `muted`(메뉴 열림 또는 잡는 중)가 true면 발화하지 않고 다음 시각만 다시 잡는다. 분류별 직전 문장이 반복되지 않는다. 만료 시각이 지나면 `current`가 `null`. 실패 확인.
- [x] T003 `src/shared/config.ts`에 `speech`(`intervalMs {20000,40000}`, `displayMs {3000,8000}`, `baseMs 2000`, `perCharMs 150`, `maxLength 60`, `maxPerCategory 50`)와 `struggleAfterMs: 5000`을 추가한다.
- [x] T004 `src/shared/dialogue.ts` 신규: `DIALOGUE_CATEGORIES`, `Category`, `Lines`, `emptyLines()`, `sanitizeLines`, `pickLine`을 구현한다(규칙은 data-model.md 그대로). T001 통과.
- [x] T005 `src/shared/speaker.ts` 신규: `Speaker`(주입: `random`, `getLines(): Lines`)가 `update(now, { muted })`, `say(category, now)`, `current(now)`를 구현한다(data-model.md의 Speaker 상태). T002 통과.
- [x] T006 [P] `src/shared/ipc.ts`의 `CharacterUpdate`에 `speech: { id: number; text: string; remainingMs: number } | null`을 추가한다(contracts/ipc.md).

**Checkpoint**: `npm test`와 타입 검사 통과(T006 때문에 `simulation.ts`의 update 생성부가 깨지면 T009에서 함께 맞춘다).

## Phase 2: User Story 1 - 캐릭터가 혼자 말한다 (Priority: P1) 🎯 MVP

**Goal**: 기본 캐릭터가 가끔 머리 위 말풍선으로 혼잣말을 하고 사라진다.

**Independent Test**: quickstart 수동 1~6번. 단위 테스트로 일정을 확인하고, E2E는 잡기(US3)와 함께 말풍선 표시를 확인한다.

- [x] T007 [P] [US1] `src/shared/dialogue.ts`에 기본 캐릭터 문장 `DEFAULT_LINES`(세 분류 모두 최소 3개, 문장당 60자 이하)를 추가하고, `tests/unit/dialogue.test.ts`에 `DEFAULT_LINES`가 `sanitizeLines`를 거쳐도 그대로인 것(모두 유효)을 검증하는 케이스를 추가한다.
- [x] T008 [US1] `src/main/characters-store.ts`에 `readLines(): Lines`를 추가한다. 활성 id가 `null`이면 `DEFAULT_LINES`, 아니면 `characters/<id>/lines.json`을 읽어 `sanitizeLines`에 넣고, 파일 없음·파싱 실패는 빈 목록으로 돌려준다(경로는 `characterDir`로만 만든다). `src/main/characters-service.ts`에 `lines()`로 노출한다. `tests/unit/characters-store-lines.test.ts`를 먼저 작성해 기본 캐릭터·파일 있음·파일 없음(빈 목록, 기본 문장으로 대체하지 않음)·깨진 JSON을 검증한다.
- [x] T009 [US1] `src/main/simulation.ts`: `Speaker`를 만들어 틱에서 `update(clock, { muted: menuOpen || drag.active })`를 호출하고, 말하기 시작·종료 시와 디스플레이 변경 시 `broadcast(…, true)`한다. `broadcast`가 보이는 창에는 `speech`(`remainingMs = until - clock`)를, 보이지 않는 창에는 `null`을 싣는다. 말풍선이 떠 있는 동안 걷는 중 위치 보정 주기(`RESYNC_MS`)를 250ms로 줄인다. `startSimulation` 인자로 문장 공급자(`getLines`)를 받는다.
- [x] T010 [US1] `src/main/index.ts`에서 `startSimulation`에 `() => characters.lines()`를 연결한다.
- [x] T011 [US1] `src/renderer/index.html`과 `draw.ts`: `#actor` 안에 말풍선 요소를 추가한다(둥근 사각형과 꼬리, `pointer-events: none`, 긴 문장은 줄바꿈하고 최대 폭 제한). 스프라이트 위쪽 가장자리에 배율(`--scale`)을 반영해 붙이고, 좌우 반전이 글자에 걸리지 않게 `#sprite` 밖에 둔다. `update.speech`의 `id`가 바뀔 때만 `remainingMs` 뒤 숨김 타이머를 걸고, `null`이면 즉시 숨긴다.
- [x] T012 [US1] `draw.ts`: 업데이트를 받을 때마다 말풍선의 가로 위치를 창 안으로 밀어 넣고(여백 8px), 캐릭터 위쪽 공간이 모자라면 캐릭터 아래에 표시한다. 창 크기는 `window.innerWidth/innerHeight`를 쓴다.
- [x] T013 [US1] 단위 테스트·타입 검사·기존 E2E 통과를 확인한다(SC-008).

**Checkpoint**: US1 단독으로 동작·검증 가능(MVP).

## Phase 3: User Story 2 - 캐릭터마다 다른 말투를 가진다 (Priority: P2)

**Goal**: 캐릭터를 바꾸면 그 캐릭터의 문장이 나오고, 문장이 없으면 말하지 않는다.

**Independent Test**: quickstart 수동 7번.

- [x] T014 [P] [US2] `resources/characters/bmm/lines.json`과 `resources/characters/me/lines.json`을 작성한다(contracts/lines-file.md 형식, 세 분류 모두 최소 3개, 각 캐릭터 개성에 맞는 문장).
- [x] T015 [US2] `tests/unit/characters-service.test.ts`(또는 store 테스트)에 케이스를 추가한다: 샘플 설치 시 샘플 폴더의 `lines.json`이 캐릭터 폴더로 복사된다, 이미 설치된 샘플(설치 키 있음, 같은 이름, `lines.json` 없음)은 시작할 때 백필된다, 사용자가 등록한 캐릭터는 `lines.json`이 없어 `readLines()`가 모두 빈 목록이다, 캐릭터를 삭제하면 `lines.json`도 사라진다. 실패 확인.
- [x] T016 [US2] `src/main/characters-store.ts`와 `characters-service.ts`: `installSamples`가 샘플 폴더에 `lines.json`이 있으면 함께 복사하고, `backfillSampleLines(samples)`가 이미 설치된 샘플에 `lines.json`이 없을 때만 채운다(research R6). `src/main/index.ts`에서 설치 직후 호출한다. T015 통과.
- [x] T017 [US2] 캐릭터를 바꾼 뒤 다음 선택부터 새 캐릭터 문장을 쓰는지(FR-012) `tests/unit/speaker.test.ts`에 케이스를 추가한다(`getLines` 공급자가 바뀐 값을 반환하면 이후 발화에 반영). 이미 통과하면 회귀 테스트로 유지한다.

**Checkpoint**: US1·US2 모두 단위 수준에서 통과.

## Phase 4: User Story 3 - 상황에 맞는 말을 한다 (Priority: P3)

**Goal**: 잡았을 때와 오래 잡았을 때 해당 분류의 문장이 나오고, 메뉴가 열려 있으면 말하지 않는다.

**Independent Test**: quickstart 수동 8~9번, E2E 잡기 → 말풍선.

- [x] T018 [US3] `tests/e2e/speech.test.ts` 작성(`KAKARU_USER_DATA` 격리, 실제 마우스 대신 `pointerdown` 합성 이벤트 사용): 잡으면 오버레이의 말풍선이 보이고 텍스트가 기본 캐릭터 `grabbed` 문장 중 하나이며, 놓은 뒤에도 표시 시간 후 사라지고, 5초 넘게 잡으면 말풍선이 `struggling` 문장으로 바뀐다. 실패 확인.
- [x] T019 [US3] `src/main/simulation.ts`: `startGrab` 시 `speaker.say('grabbed', clock)`, 잡은 지 `config.struggleAfterMs`가 지나면 한 번 `speaker.say('struggling', clock)`를 호출한다(잡기 시작 시각을 기억하고 `endGrab` 때 초기화). 우클릭 메뉴가 열려 있으면 잡기 발화도 하지 않는다(`menuOpen`). `src/renderer/draw.ts`의 발버둥 시작도 `config.struggleAfterMs`를 쓴다.
- [x] T020 [US3] T018 통과 확인. 기존 드래그 E2E(`drag.test.ts`)와 메뉴 단위 테스트가 그대로 통과하는지 확인한다(SC-008).

## Phase 5: Polish & 문서

- [x] T021 [P] `specs/ROADMAP.md`에 005를 완료 기능 표에 추가("수동 검증 대기")하고, "상태별 이미지"·"AI 대화" 후속을 정리한다. 사용자 등록 캐릭터의 문장 편집 수단을 후속 후보로 적는다.
- [x] T022 [P] `tests/manual/results.md`에 005 수동 검증 표(quickstart 1~11번, macOS "대기", Windows "후속")를 추가한다. `README.md`에 `lines.json` 형식 안내(위치·분류·제한)를 추가한다.
- [ ] T023 spec.md 상태를 갱신하고, 수동 검증은 사용자가 "N번 통과"로 알려 주면 표와 이 파일을 갱신한다(에이전트는 실제 마우스 입력과 화면 가장자리·멀티 모니터를 확인할 수 없다).

## Dependencies & Execution Order

- Phase 1 → Phase 2(US1) → Phase 3(US2), Phase 4(US3). US2·US3는 US1 완료 후 서로 독립이다.
- Phase 1: T001·T002·T006 병렬 → T003 → T004(T001 후) → T005(T002·T003·T004 후).
- US1: T007·T008 병렬 가능(파일 다름), T009는 T005·T006·T008 후, T010은 T009 후, T011 → T012는 T006 이후 어느 시점에나 가능하나 화면 확인은 T009 이후.
- US3의 T019는 T009(Speaker 연결) 이후.

## Parallel Example

```text
Phase 1 시작: T001, T002, T006 동시 진행
US1: T007, T008 동시 진행
US2의 T014(샘플 문장 작성)는 어느 단계에서든 병렬 진행 가능
Phase 5: T021, T022 동시 진행
```

## Implementation Strategy

1. Phase 1 + US1로 MVP를 만들어 `npm run dev`로 직접 확인한다(기본 캐릭터가 혼잣말).
2. US2로 샘플 캐릭터 문장과 "비어 있으면 말하지 않음"을 더한다.
3. US3로 잡았을 때 반응을 더한다.
4. 매 단계 끝에 `npm test`, 타입 검사, `npm run test:e2e`를 돌린다. 수동 검증은 사용자가 수행한다.
