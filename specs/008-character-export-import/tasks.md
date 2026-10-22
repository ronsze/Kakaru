---

description: "캐릭터 내보내기·가져오기 작업 목록"
---

# Tasks: 캐릭터 내보내기·가져오기

**Input**: `/specs/008-character-export-import/`의 plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 프로젝트 규칙(TDD)에 따라 구현보다 먼저 테스트를 쓰고 실패를 확인한다.

## Format: `[ID] [P?] [Story] 설명 (파일 경로)`

- **[P]**: 서로 다른 파일이고 미완료 작업에 의존하지 않아 병렬 가능

## Phase 1: Foundational (모든 스토리의 선행 조건)

**Purpose**: 파일 구조 순수 모듈, 저장소의 대사 동시 저장, IPC 계약. 이 단계가 끝나야 내보내기·가져오기를 만들 수 있다.

- [x] T001 [P] `tests/unit/character-package.test.ts` 작성. 대상은 `src/shared/character-package.ts`의 `buildCharacterPackage`, `parseCharacterPackage`, `exportFileName`, `uniqueName`. 검증: ① build 결과를 parse하면 `name`·`frames`·`walk`·`idle`(base64 문자열)·네 분류 대사가 그대로 돌아온다. build 결과에는 `format: "kakaru-character"`, `version: 1`이 있고 `id`·`createdAt`·경로 필드가 없다. ② 오류 코드: JSON이 아님/배열/`format` 불일치 → `not-package`, `version`이 1보다 큰 정수 → `unsupported-version`, `version`이 정수가 아니거나 `name`·`frames`·`walk`·`idle` 누락·형식 오류, `lines` 값이 문자열 배열이 아님 → `bad-field`, `walk`·`idle`이 표준 base64 문자 집합이 아님 → `bad-base64`. ③ `lines`가 없거나 일부 분류가 없으면 성공이고 없는 분류는 빈 목록, 알 수 없는 최상위 키·`lines` 키는 무시. ④ `exportFileName("나")`는 `나.kakaru`, `\ / : * ? " < > |`와 제어 문자는 `_`로 바뀌고 앞뒤 공백·마침표가 제거되며 비면 `character.kakaru`. ⑤ `uniqueName`: 안 겹치면 그대로, 겹치면(대소문자 무시) `이름 (2)`, `이름 (2)`도 있으면 `이름 (3)`, 결과가 30자를 넘으면 원래 이름 앞부분을 잘라 30자 이내로 맞춘다(번호 접미사는 유지). 실패 확인.
- [x] T002 [P] `tests/unit/characters-store.test.ts`에 케이스 추가: `add(meta, walk, idle, undefined, lines)`가 `characters/<id>/lines.json`을 `{version:1, lines}`로 이미지와 함께 쓰고 `readLinesOf(id)`가 그 값을 돌려준다. `lines`를 주지 않으면 기존처럼 `lines.json`이 생기지 않는다. `lines.json` 쓰기 또는 `settings.json` 저장이 실패하면 만든 폴더가 지워지고 목록에 추가되지 않는다. 실패 확인.
- [x] T003 `src/shared/character-package.ts` 구현(contracts/package-file.md, data-model.md). 순수 모듈로 Electron·Node API에 의존하지 않는다. 이름 상한은 `LIMITS.maxNameLength`를 쓴다. T001 통과.
- [x] T004 `src/main/characters-store.ts`의 `add()`에 선택 인자 `lines?: Lines`(5번째)를 추가한다. 있으면 이미지와 같은 `try` 안에서 `lines.json`을 쓴다(기존 `writeLines`와 같은 JSON 모양, 폴더는 이미 있음). 실패 시 기존 롤백(폴더 삭제)이 동작해야 한다. T002 통과.
- [x] T005 [P] `src/shared/characters.ts`의 `LIMITS`에 `maxPackageBytes: 16 * 1024 * 1024`를 추가한다. `src/shared/ipc-settings.ts`에 `CHANNEL_CHARACTERS_EXPORT = 'characters:export'`, `CHANNEL_CHARACTERS_IMPORT = 'characters:import'`를 추가하고, `src/shared/ipc.ts`에 `ExportResult`, `ImportResult` 타입과 `KakaruSettingsApi`의 `exportCharacter(id: string)`/`importCharacter()`를 추가한다(contracts/ipc.md). `src/preload/settings.ts`에서 `ipcRenderer.invoke`로 노출한다. 빌드 후 `out/preload/`에 공유 청크가 생기지 않았는지 확인한다(CLAUDE.md 함정).

**Checkpoint**: `npm test`와 타입 검사 통과. 설정 창 렌더러는 아직 새 API를 쓰지 않아도 타입 오류가 없어야 한다.

## Phase 2: User Story 1 - 캐릭터를 파일로 내보낸다 (Priority: P1) 🎯 MVP

**Goal**: 목록의 등록 캐릭터를 `.kakaru` 파일 하나로 저장한다. 기본 캐릭터는 대상이 아니다.

**Independent Test**: "나"를 내보내면 지정한 위치에 `.kakaru` 파일이 생기고, 그 파일을 `parseCharacterPackage`로 해석하면 이름·프레임·이미지·편집한 대사가 원본과 같다.

- [x] T006 [US1] `tests/unit/characters-service-transfer.test.ts` 작성(임시 폴더의 실제 `CharacterStore` + `CharacterService`, 기존 `tests/unit/characters-service.test.ts`의 구성과 `png-fixture.ts`를 따른다). `exportPackage(id)` 검증: 등록한 캐릭터는 `ok:true`이고 `content`를 parse하면 이름·프레임·이미지(base64를 디코딩하면 저장된 PNG와 바이트가 같음)·`readLinesOf(id)`의 대사와 같다. `suggestedFileName`은 `exportFileName(name)`. 대사를 저장한 캐릭터는 저장한 대사가 담긴다. `null`(기본 캐릭터)·등록되지 않은 id·이미지 파일이 없는 캐릭터는 `ok:false`와 `message`. 실패 확인.
- [x] T007 [US1] `src/main/characters-service.ts`에 `exportPackage(id)`를 구현한다(contracts/ipc.md의 서비스 계약). 이미지는 `store.readImage`, 대사는 `store.readLinesOf`. T006 통과.
- [x] T008 [US1] `src/main/characters-ipc.ts`에 `CHANNEL_CHARACTERS_EXPORT` 핸들러를 추가한다. `id`가 문자열이 아니면 오류 결과, 서비스 호출 후 `dialog.showSaveDialog(설정 창, { defaultPath: suggestedFileName, filters: [.kakaru] })`, 취소면 `{ok:false, canceled:true}`, 확정하면 `<경로>.tmp`에 쓴 뒤 `rename`(실패 시 임시 파일 삭제, 원본 유지)하고 `{ok:true, fileName}`. 설정 창이 없으면 부모 없이 연다.
- [x] T009 [US1] `src/renderer/settings.ts`의 `renderItem`에서 `!c.builtin && c.id !== null`인 항목에 `내보내기` 버튼(`btn-export`)을 `삭제` 앞에 추가한다. 클릭하면 `api.exportCharacter(c.id)`를 호출하고 성공이면 `"<이름>" 캐릭터를 <fileName>으로 내보냈습니다.`(ok), 취소면 아무것도 표시하지 않고, 실패면 `message`(fail)를 `setStatus`로 보인다. 기본 캐릭터 항목에는 버튼을 만들지 않는다.
- [x] T010 [US1] `tests/e2e/transfer.test.ts` 작성·통과(`tests/e2e/settings.test.ts`의 `launch`·`settingsPage` 구성을 따른다). `electronApp.evaluate`로 `dialog.showSaveDialog`를 스텁해 임시 경로를 돌려주게 하고 "나" 항목의 `.btn-export`를 눌러 파일이 생기고 상태 메시지가 보이는지, 기본 캐릭터 항목에 `.btn-export`가 없는지, 스텁을 `{canceled:true}`로 바꾸면 파일이 생기지 않고 `#status`가 비어 있는지 확인한다.

**Checkpoint**: 내보내기 단독으로 동작한다(quickstart 수동 1·2).

## Phase 3: User Story 2 - 파일로 새 캐릭터를 추가한다 (Priority: P1)

**Goal**: `.kakaru` 파일로 새 캐릭터를 등록한다. 기존 캐릭터와 현재 적용은 바뀌지 않는다.

**Independent Test**: 다른 `KAKARU_USER_DATA`로 앱을 띄우고 내보낸 파일을 가져오면 이름·이미지·대사가 같은 새 캐릭터가 목록에 생기고 "사용 중" 표시는 그대로다.

- [x] T011 [US2] `tests/unit/characters-service-transfer.test.ts`에 `importPackage(text)` 성공 경로 케이스 추가: ① 한 저장소에서 `exportPackage`한 내용을 다른 임시 저장소의 서비스에 가져오면 `ok:true`, 새 id(`ID_PATTERN`), 같은 이름·프레임·`frameSize`, 두 PNG 바이트 일치, 네 분류 대사 일치. ② 가져온 뒤 `store.getActiveId()`가 가져오기 전과 같다. ③ 같은 내용을 두 번 가져오면 두 번째는 `이름 (2)`이고 첫 캐릭터는 바뀌지 않으며 목록이 하나 늘었다. 세 번째는 `이름 (3)`. ④ 이름이 30자이고 이미 있으면 번호를 붙여도 30자 이내. ⑤ 대사가 모두 빈 캐릭터도 가져와지고 `lines.json`이 생긴다. ⑥ 반환된 `name`이 최종 이름. 실패 확인.
- [x] T012 [US2] `src/main/characters-service.ts`에 `importPackage(text)`를 구현한다. 순서: `parseCharacterPackage` → base64 디코딩(`Buffer.from(…, 'base64')`) → `validateRegistration({name, frames, walk, idle}, inspector, [])` → `validateLinesInput(lines)` → 모두 통과해야 `uniqueName(name.trim(), store.list().map(c => c.name))`으로 최종 이름을 정하고 `store.add({id: makeId(), name, frames, frameSize, createdAt: now()}, walk, idle, undefined, result.lines)`. 실패 결과는 `{ok:false, message, details}`(검증 위반 처리는 T016). T011 통과.
- [x] T013 [US2] `src/main/characters-ipc.ts`에 `CHANNEL_CHARACTERS_IMPORT` 핸들러를 추가한다. `dialog.showOpenDialog(설정 창, { properties: ['openFile'], filters: [.kakaru, 모든 파일] })`, 취소면 `{ok:false, canceled:true}`, 선택한 파일의 `stat().size`가 `LIMITS.maxPackageBytes`를 넘으면 읽지 않고 `{ok:false, message:'파일이 너무 큽니다. …MB 이하여야 합니다.', details:[]}`, 아니면 UTF-8로 읽어 `service.importPackage`. 파일 읽기 오류는 `message`로 돌려준다. 성공이면 `notifyCharactersChanged()`를 호출한다(활성 캐릭터가 바뀌지 않으므로 `onAppearanceChanged`는 호출하지 않는다).
- [x] T014 [US2] `src/renderer/settings.html`에 `<button id="import" type="button">파일에서 가져오기</button>`와 결과 영역(`#import-details` `<ul>`)을 목록 아래 등록 섹션 위에 추가하고 기존 스타일 클래스를 따른다. `src/renderer/settings.ts`에서 클릭하면 버튼을 비활성화하고 `api.importCharacter()`를 호출한다. 성공이면 `"<이름>" 캐릭터를 가져왔습니다.`(ok)와 `refreshList()`, 취소면 아무것도 바꾸지 않고, 실패면 `message`(fail)와 `details`를 `#import-details`에 줄마다 보인다. 다음 시도·성공 시 `#import-details`를 비운다. 끝나면 버튼을 다시 활성화한다.
- [x] T015 [US2] `tests/e2e/transfer.test.ts`에 왕복 케이스 추가: 앱 A에서 "나"를 내보낸 파일을 앱 B(새 `KAKARU_USER_DATA`)의 `dialog.showOpenDialog` 스텁으로 가져오면 목록이 하나 늘고(`#list li` 4개) 새 항목 이름이 "나 (2)"(B에는 샘플 "나"가 이미 있으므로), "사용 중"은 기본 캐릭터에 그대로 있으며, 그 항목의 `대사 편집`을 열면 `#lines-normal`에 원본 문장이 들어 있다. 취소 스텁이면 목록이 그대로다.

**Checkpoint**: 내보내기→가져오기 왕복이 동작한다(quickstart 수동 3·4·5).

## Phase 4: User Story 3 - 잘못된 파일은 거부하고 이유를 알려 준다 (Priority: P2)

**Goal**: 규격 위반·손상·새 버전 파일을 아무것도 남기지 않고 거부하며 이유를 보여 준다.

**Independent Test**: 이미지 규격·대사 규칙을 어긴 파일, 손상된 파일, 임의 파일, 새 버전 파일을 가져오면 모두 거부 안내가 나오고 목록·저장 폴더가 가져오기 전과 같다.

- [x] T016 [US3] `tests/unit/characters-service-transfer.test.ts`에 거부 케이스 추가(각 케이스에서 `store.list()`와 `characters/` 폴더 목록이 가져오기 전과 같은지 함께 검증): ① 이미지 규격 위반(높이와 프레임 수가 안 맞는 걷기, PNG가 아닌 바이트, 알파 없는 이미지) → `ok:false`, `details`에 걷기/정지 대상과 기존 `validateRegistration`의 문구가 들어간다. ② 대사: 한 문장 61자, 한 분류 51개 → `details`에 분류 이름과 `validateLinesInput`의 문구. ③ 빈 이름·31자 이름·`"기본"` → 거부. ④ JSON이 아님 → `message`가 "캐릭터 파일이 아니거나 손상"을 뜻함. ⑤ `version: 2` → "지원하지 않는 버전"을 뜻함. ⑥ base64가 아닌 문자열 → 손상. ⑦ 이미지·대사 위반이 동시에 있으면 `details`에 둘 다 나온다. ⑧ `store.add`가 던지도록(읽기 전용 폴더 등) 만들면 `ok:false`와 `message`, 폴더가 남지 않는다. 실패 확인.
- [x] T017 [US3] `src/main/characters-service.ts`의 `importPackage`가 모든 위반을 모아 `{ok:false, message, details}`로 돌려주도록 완성한다. `details` 접두: 이미지 `걷기 이미지: `/`정지 이미지: `/`이름: `/`프레임 수: `(`ValidationError.target` 기준), 대사 `대사(<분류 한글명>): `(`인사`·`평소`·`잡혔을 때`·`오래 잡혔을 때`). 해석 오류 코드별 `message`는 data-model.md의 "메시지 방향"을 따른다. `store.add` 예외는 잡아 `message`로 바꾸고 내부 경로를 노출하지 않는다. T016 통과.
- [x] T018 [US3] `tests/e2e/transfer.test.ts`에 거부 케이스 추가: 텍스트 파일(`x.kakaru`), 이미지 규격을 망가뜨린 패키지를 가져오는 스텁에서 `#status`가 실패로 표시되고 `#import-details`에 이유가 보이며 `#list li` 개수가 그대로다.

**Checkpoint**: quickstart 수동 6까지 확인한다.

## Phase 5: Polish & Cross-Cutting

- [x] T019 전체 검증: `npx tsc -p tsconfig.node.json && npx tsc -p tsconfig.web.json`, `npm test`, `npm run test:e2e` 통과. `npm run build` 후 `out/preload/`에 공유 청크(별도 chunk 파일)가 없는지 확인한다.
- [x] T020 [P] 문서 갱신: `specs/ROADMAP.md` 완료 표에 008 행 추가("자동 검증 통과, 수동 검증 대기(macOS)")와 "범위 밖으로 미뤄 둔 작은 것들"의 002 항목에서 "내보내기·공유"를 제거하고 마지막 갱신 날짜를 고친다. `README.md`에 `.kakaru` 파일 한 줄 안내(설정 창에서 내보내기·가져오기)를 추가한다. `specs/008-character-export-import/spec.md`의 Status를 "구현 완료, macOS 수동 검증 대기"로 고친다.
- [x] T021 [P] `tests/manual/results.md`에 008 표를 추가한다(quickstart의 수동 검증 1~7, macOS 열은 "대기", Windows 열은 "후속"). 통과 여부를 사용자가 알려 주면 표와 이 파일의 체크 상태를 갱신한다.
- [ ] T022 `/speckit-analyze`로 spec·plan·tasks 정합을 한 번 점검하고 발견을 처리한다(선택).

## Dependencies & Execution Order

- Phase 1 → Phase 2·3·4. T001·T002·T005는 병렬. T003은 T001 뒤, T004는 T002 뒤.
- US1(Phase 2)은 T003·T005에 의존, US2(Phase 3)는 T003·T004·T005에 의존하며 US1과 독립이다(같은 `characters-service-transfer.test.ts`·`characters-ipc.ts`·`settings.ts`를 쓰므로 병합 충돌을 피하려면 순서대로 한다).
- US3(Phase 4)는 US2의 `importPackage` 위에 검증 보고를 완성한다(T012의 골격이 먼저 있어야 한다).
- Phase 5는 모든 스토리 뒤.

## Implementation Strategy

1. **MVP = Phase 1 + US1**: 내보내기만으로도 백업 파일이 생긴다. 다만 쓸모는 가져오기와 한 쌍이므로 US1과 US2를 같이 끝내는 것을 권장한다.
2. **증분**: Phase 1 → US1 → US2 → US3 → Polish. 각 Checkpoint에서 `npm test`와 타입 검사를 통과시킨다.
3. **오버레이 코드(`overlay.ts`, `simulation.ts`, `hit-test.ts`, `draw.ts`)는 건드리지 않는다**(FR-011). 건드릴 필요가 생기면 멈추고 plan을 고친다.
