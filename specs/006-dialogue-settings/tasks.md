---

description: "대사 설정 화면 작업 목록"
---

# Tasks: 대사 설정 화면

**Input**: `/specs/006-dialogue-settings/`의 plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 프로젝트 규칙(TDD)에 따라 구현보다 먼저 테스트를 쓰고 실패를 확인한다.

## Format: `[ID] [P?] [Story] 설명 (파일 경로)`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 가능

## Phase 1: Foundational (모든 스토리의 선행 조건)

**Purpose**: 공용 검증 함수, 저장소(편집본 쓰기·기본 편집본), IPC 계약. 이 단계가 끝나야 화면을 만들 수 있다.

- [x] T001 [P] `tests/unit/dialogue-validate.test.ts` 작성: `validateLinesInput(input)`가 줄바꿈(`\n`, `\r\n`)으로 문장을 나누고 앞뒤 공백을 지우며, 빈 문장은 제외하고 `dropped`에 합산(오류 아님), 같은 분류의 중복은 하나로 합쳐 `merged`에 합산(오류 아님), 정리 후 60자 초과는 `issues`에 `too-long`(분류·원본 입력 기준 1부터의 줄 번호·글자 수 포함), 한 분류가 50개 초과면 `too-many`(현재 개수 포함), 모든 분류 키가 결과에 존재하고, `issues`가 비어 있을 때만 `ok`이며 `lines`는 정규화된 값인지 검증. 실패 확인.
- [x] T002 [P] `tests/unit/characters-store-lines-edit.test.ts` 작성: `writeLines(id, lines)`가 `characters/<id>/lines.json`을 `{version:1, lines}`로 원자적으로(tmp → rename, 실패하면 임시 파일 삭제·기존 파일 유지) 쓰고 `readLines()`가 그대로 돌려주는지, 기본 캐릭터(`null`)는 `default-lines.json`에 쓰고 읽을 때 유효하면 그것을 쓰고 없거나 깨졌으면 내장 `DEFAULT_LINES`를 쓰며 모든 분류가 빈 유효 편집본이면 빈 목록을 돌려주는지, 존재하지 않는 id는 거부하는지, `resetDefaultLines()`가 `default-lines.json`을 지워 내장 문장으로 돌아가는지, 캐릭터를 읽기 전용 폴더 등으로 쓰기 실패시키면 기존 내용이 그대로인지 검증. 실패 확인.
- [x] T003 `src/shared/dialogue.ts`에 `LinesIssue`(`{category, line, code: 'too-long' | 'too-many', message}`), `LinesValidation`, `validateLinesInput`을 추가한다(data-model.md 규칙, 문구는 한국어). `sanitizeLines`와 같은 `config.speech` 상수를 쓴다. T001 통과.
- [x] T004 `src/main/characters-store.ts`에 `writeLines(id: string | null, lines: Lines)`(원자적 쓰기, 등록 id 존재 확인), `readLines()`의 기본 캐릭터 분기(편집본 우선), `resetDefaultLines()`, `hasDefaultLinesOverride()`를 구현한다(contracts/storage.md). T002 통과.
- [x] T005 [P] `src/shared/ipc-settings.ts`에 채널 상수 `CHANNEL_LINES_GET = 'lines:get'`, `CHANNEL_LINES_SAVE = 'lines:save'`, `CHANNEL_LINES_RESTORE = 'lines:restore'`를 추가하고, `src/shared/ipc.ts`에 `LinesView`, `GetLinesResult`, `SaveLinesResult`, `RestoreLinesResult` 타입과 `KakaruSettingsApi`의 `getLines`/`saveLines`/`restoreLines`를 추가한다(contracts/ipc.md). `src/preload/settings.ts`에서 `ipcRenderer.invoke`로 노출한다. 빌드 후 `out/preload/`에 공유 청크가 생기지 않았는지 확인한다(CLAUDE.md 함정).

**Checkpoint**: `npm test`와 타입 검사 통과(T005 때문에 설정 창 렌더러가 아직 새 API를 쓰지 않아도 타입 오류는 없어야 한다).

## Phase 2: User Story 1 - 캐릭터의 대사를 편집한다 (Priority: P1) 🎯 MVP

**Goal**: 설정 창에서 캐릭터를 골라 세 분류의 문장을 편집·저장하고, 저장 후 다음 발화부터 반영된다.

**Independent Test**: quickstart 수동 1~4번, E2E 편집·저장 → 말풍선.

- [x] T006 [P] [US1] `tests/unit/characters-service-lines.test.ts` 작성: `service.getLines(id)`가 기본 캐릭터·샘플·등록 캐릭터의 대화셋과 `restore`('default' 또는 'clear')·`modified`를 돌려주는지, `saveLines(id, input)`가 검증을 통과하면 저장하고 정규화된 `lines`와 `dropped`·`merged`를 돌려주며 검증 실패면 `issues`만 돌려주고 아무것도 쓰지 않는지, 존재하지 않는 id는 `message`로 거부(FR-011)하는지, 잘못된 입력 모양(분류 키가 알 수 없는 값, 문자열이 아닌 값)을 거부하는지, 저장 후 해당 캐릭터를 활성으로 하면 `lines()`가 새 문장을 돌려주는지(FR-003) 검증. 실패 확인.
- [x] T007 [US1] `src/main/characters-service.ts`에 `getLines(id)`, `saveLines(id, input)`를 구현한다(검증은 `validateLinesInput` 재사용, 입력 모양 확인, 샘플 여부는 `installSamples`/`backfillSampleLines`에 넘어온 샘플 목록과 설치 키·이름으로 판정해 `restore` 값 결정). T006 통과.
- [x] T008 [US1] `src/main/characters-ipc.ts`에 `lines:get`/`lines:save` 핸들러를 등록한다(`id`가 `null` 또는 문자열인지 확인하고 서비스에 위임).
- [x] T009 [US1] `src/renderer/settings.html`에 대사 편집 패널(`#lines-panel`, 제목·세 분류 블록(`<textarea>`, 개수 표시 `n/50`, 오류 목록)·저장 버튼·닫기 버튼·상태 줄)과 스타일을 추가하고, 오른쪽 영역에서 등록 폼과 패널을 전환할 수 있게 구조를 잡는다.
- [x] T010 [US1] `src/renderer/settings.ts`: 목록 항목에 "대사 편집" 버튼(`btn-lines`)을 추가하고, 누르면 `api.getLines(id)`로 불러와 패널을 채우고 보인다. 패널의 닫기 버튼은 등록 폼으로 돌아간다. 저장은 `api.saveLines`를 호출하고 성공하면 "저장했습니다" 안내와 정규화된 내용으로 갱신한다. 저장 실패(`message`)는 입력을 그대로 두고 이유를 보인다.
- [x] T011 [US1] `tests/e2e/dialogue-settings.test.ts` 작성(`KAKARU_USER_DATA` 격리, 설정 창 `--open-settings`): 등록한 캐릭터의 "대사 편집"을 열면 세 분류가 보이고, "잡혔을 때"에 문장을 쓰고 저장한 뒤 그 캐릭터를 선택하고 오버레이에서 잡으면(합성 `pointerdown`) 말풍선 텍스트가 저장한 문장이다(SC-002). 저장한 문장이 패널을 닫았다 다시 열어도 남아 있다. 기존 `settings.test.ts`의 등록 헬퍼를 재사용한다. 이미 구현된 뒤에 작성해도 되지만 통과 전에 먼저 실패를 확인한다.
- [x] T012 [US1] 미저장 변경 확인: 패널의 초안과 마지막 저장본을 비교해 dirty를 판정하고, dirty인 채 닫기 또는 다른 캐릭터의 "대사 편집"을 누르면 패널 상단에 인라인 막대(저장 / 버리기 / 계속 편집)를 보인다(FR-007). E2E에 막대 표시와 "버리기"·"계속 편집" 동작 검증을 추가한다.

**Checkpoint**: US1 단독으로 동작·검증 가능(MVP).

## Phase 3: User Story 2 - 잘못된 입력은 이유와 함께 막는다 (Priority: P2)

**Goal**: 규칙 위반은 저장 전에 이유와 함께 보이고 저장이 막힌다.

**Independent Test**: quickstart 수동 5~6번.

- [x] T013 [P] [US2] `tests/e2e/dialogue-settings.test.ts`에 케이스 추가: 61자 줄을 쓰면 줄 번호·글자 수 이유가 보이고 저장 버튼이 비활성화된다, 51줄을 쓰면 초과 이유와 개수가 보인다, 빈 줄은 오류 없이 정리 안내만 보인다, 같은 문장을 두 줄 쓰고 저장하면 합쳐졌다는 안내가 보인다. 실패 확인.
- [x] T014 [US2] `src/renderer/settings.ts`: 입력할 때마다 `validateLinesInput`(shared)로 분류별 검증을 돌려 `issues`를 줄 번호와 함께 분류 아래 오류 영역에 보이고, `issues`가 하나라도 있으면 저장 버튼을 비활성화한다. 개수 표시(`n/50`)를 갱신하고 50개를 넘으면 강조한다. 저장 성공 응답의 `dropped`·`merged`가 0보다 크면 "빈 줄 n개를 정리했고 중복 n개를 합쳤습니다" 안내를 보인다. T013 통과.

**Checkpoint**: US1·US2 모두 통과.

## Phase 4: User Story 3 - 기본 문장으로 되돌린다 (Priority: P3)

**Goal**: 기본·샘플 캐릭터는 처음 문장으로 되돌리고, 등록 캐릭터는 모두 비울 수 있다.

**Independent Test**: quickstart 수동 8~9번.

- [x] T015 [P] [US3] `tests/unit/characters-service-lines.test.ts`에 케이스 추가: `restoreLines(null)`은 `default-lines.json`을 지워 내장 문장으로 돌아가고, 샘플은 샘플 폴더의 `lines.json`을 다시 복사해 원본을 복원하며, 등록 캐릭터는 빈 대화셋을 저장("모두 비우기")하고, 존재하지 않는 id는 거부하는지 검증. 실패 확인.
- [x] T016 [US3] `src/main/characters-service.ts`에 `restoreLines(id)`를 구현하고 `src/main/characters-ipc.ts`에 `lines:restore` 핸들러를 등록한다. T015 통과.
- [x] T017 [US3] `src/renderer/settings.ts`와 `settings.html`: 패널에 되돌리기 버튼을 추가한다. `restore`가 'default'면 "처음 문장으로 되돌리기", 'clear'면 "모두 비우기"로 표시하고(처음과 같으면 비활성), 누르면 `window.confirm`으로 확인한 뒤 `api.restoreLines`를 호출해 화면을 갱신한다. 취소하면 아무것도 바꾸지 않는다. E2E에 기본 캐릭터 편집 → 되돌리기, 등록 캐릭터 모두 비우기, 확인 취소 케이스를 추가한다.
- [x] T018 [US3] 편집 중인 캐릭터가 삭제되었을 때 처리: 목록 갱신 알림 후 패널이 가리키는 캐릭터가 없으면 패널에 "삭제된 캐릭터입니다" 안내를 보이고 저장을 비활성화한다. 서비스 단위 테스트로 삭제된 id 저장 거부(T006)와 E2E로 안내 표시를 확인한다.

## Phase 5: Polish & 문서

- [x] T019 [P] `README.md`의 대사 안내를 설정 창 편집 방법 중심으로 고치고(`lines.json`은 파일 형식 참고로 유지), `default-lines.json` 위치를 적는다. `specs/ROADMAP.md`에 006을 완료 기능 표에 추가("수동 검증 대기")하고 "사용자 등록 캐릭터의 대사 편집" 후속 항목을 제거한다.
- [x] T020 [P] `tests/manual/results.md`에 006 수동 검증 표(quickstart 1~10번, macOS "대기", Windows "후속")를 추가한다.
- [ ] T021 전체 단위 테스트·타입 검사·E2E를 돌려 통과를 확인한다(SC-006). spec.md 상태를 갱신하고, 수동 검증은 사용자가 "N번 통과"로 알려 주면 표와 이 파일을 갱신한다(에이전트는 실제 화면 조작을 확인할 수 없다).

## Dependencies & Execution Order

- Phase 1 → Phase 2(US1) → Phase 3(US2), Phase 4(US3). US2·US3는 US1 완료 후 서로 독립이다.
- Phase 1: T001·T002·T005 병렬 → T003(T001 후) → T004(T002·T003 후).
- US1: T006 → T007 → T008, T009는 T005 이후 어느 때나 가능, T010은 T008·T009 후, T011·T012는 T010 후.
- US3의 T016은 T007·T008 이후(같은 파일 수정이라 순차).

## Parallel Example

```text
Phase 1 시작: T001, T002, T005 동시 진행
US1: T006(서비스 테스트)과 T009(패널 마크업) 동시 진행
US2의 T013과 US3의 T015(테스트 작성)는 병렬 가능
Phase 5: T019, T020 동시 진행
```

## Implementation Strategy

1. Phase 1 + US1로 MVP를 만들어 `npm run dev -- --open-settings`로 직접 확인한다(등록 캐릭터의 대사를 채워 말하게 하기).
2. US2로 입력 검증과 이유 표시를 더한다.
3. US3로 되돌리기·모두 비우기를 더한다.
4. 매 단계 끝에 `npm test`, 타입 검사, `npm run test:e2e`를 돌린다. 수동 검증은 사용자가 수행한다.
