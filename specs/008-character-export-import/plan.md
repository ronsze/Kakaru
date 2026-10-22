# Implementation Plan: 캐릭터 내보내기·가져오기

**Branch**: `main` (기능 브랜치를 만들지 않는다) | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/008-character-export-import/spec.md`

## Summary

설정 창 캐릭터 목록에서 캐릭터 하나를 `.kakaru` 파일(JSON 하나에 이름·프레임 수·이미지 2장(base64)·대사 4분류)로 내보내고, 그 파일로 새 캐릭터를 등록한다. 파일 구조의 생성·해석은 Electron에 의존하지 않는 순수 모듈(`src/shared/character-package.ts`)로 두고, 저장소·서비스(`CharacterService`)가 기존 이미지·대사 검증을 그대로 재사용해 가져오기를 검증한다. 파일 대화상자와 파일 읽기·쓰기는 메인 프로세스에서만 하고(렌더러는 경로를 모른다), 설정 창에는 버튼과 결과 표시만 더한다. 새 의존성은 없다.

## Technical Context

**Language/Version**: TypeScript (Electron 45, Node 내장 `Buffer`·`fs`)

**Primary Dependencies**: 추가 없음 (Electron `dialog`, Node `fs`·`crypto`)

**Storage**: 기존 `characters/<id>/{walk.png,idle.png,lines.json}` + `settings.json`. 저장 형식은 바뀌지 않는다. 새로 생기는 것은 사용자가 고른 위치의 `.kakaru` 파일뿐이다.

**Testing**: Vitest(단위: 패키지 모듈·서비스·저장소), Playwright Electron(E2E: 내보내기→가져오기 왕복, 대화상자는 `dialog` 메서드를 스텁)

**Target Platform**: macOS(검증), Windows(후속). 파일명에 쓸 수 없는 문자(`\ / : * ? " < > |`·제어 문자)는 치환해 두 OS에서 동일하게 동작시킨다.

**Project Type**: desktop-app (Electron)

**Performance Goals**: 내보내기·가져오기 각각 1초 이내(이미지 5MB×2 상한에서도 체감 지연 없음). 오버레이·시뮬레이션 틱과 무관(설정 창 동작만).

**Constraints**: 가져오기 파일 상한 16MB(이미지 5MB×2를 base64로 부풀린 약 14MB + 대사·여유). 읽기 전에 크기를 확인해 초과하면 읽지 않고 거부한다. 렌더러에서 경로·파일 내용을 받지 않는다(샌드박스 preload 함정 회피: 값 공유는 `ipc-settings.ts`에만).

**Scale/Scope**: 캐릭터 1개 단위. 새 파일 1개(shared) + 기존 6개 파일 수정 + 테스트 3개.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 데스크탑 컴패니언 우선 | 통과 | 캐릭터(이미지·대사)를 옮기는 기능이라 정체성에 속한다. |
| II. 핵심 상호작용 3종 | 통과 | 오버레이·이동·히트 판정·메뉴 코드를 건드리지 않는다. 변경은 설정 창·저장소에 한정(FR-011). |
| III. 비침습성 | 통과 | 오버레이 창을 쓰지 않는다. 대화상자는 설정 창의 부모로 연다. 상시 CPU·메모리 영향 없음. |
| IV. 단순성 | 통과 | 새 의존성 없음(zip 제외, FR-010). 새 추상화는 순수 모듈 하나. 포맷 버전 필드 외 확장 지점을 만들지 않는다. |
| V. 검증 가능한 스펙 | 통과 | 수용 시나리오·성공 기준이 입력(버튼·파일)과 결과로 서술돼 있다. |
| 플랫폼 제약 | 통과 | 두 OS 공통 API만 사용. Windows는 후속 검증. |

설계 후 재검토(Phase 1 이후): 위반 없음. Complexity Tracking 비움.

## Project Structure

### Documentation (this feature)

```text
specs/008-character-export-import/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── package-file.md   # .kakaru 파일 형식
│   └── ipc.md            # 설정 창 ↔ 메인 채널
├── checklists/requirements.md
└── tasks.md              # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── character-package.ts   # 신규: 파일 구조 생성·해석(순수), 파일명 정리, 겹치는 이름 번호 붙이기
│   ├── characters.ts          # LIMITS.maxPackageBytes 추가
│   ├── ipc.ts                 # ExportResult·ImportResult, KakaruSettingsApi 확장
│   └── ipc-settings.ts        # CHANNEL_CHARACTERS_EXPORT / IMPORT
├── main/
│   ├── characters-store.ts    # add()에 lines 선택 인자 추가(이미지와 같은 원자성)
│   ├── characters-service.ts  # exportPackage(id), importPackage(text)
│   └── characters-ipc.ts      # 대화상자·파일 입출력 핸들러
├── preload/settings.ts        # exportCharacter, importCharacter 노출
└── renderer/
    ├── settings.html          # 가져오기 버튼·결과 영역
    └── settings.ts            # 목록 항목의 내보내기 버튼, 가져오기 처리

tests/
├── unit/character-package.test.ts          # 신규
├── unit/characters-service-transfer.test.ts # 신규(서비스+실제 임시 폴더 저장소)
├── unit/characters-store.test.ts           # add(lines) 케이스 추가
└── e2e/transfer.test.ts                    # 신규
```

**Structure Decision**: 기존 구조를 그대로 따른다. 순수 로직은 `src/shared`, 파일 시스템·Electron은 `src/main`, 화면은 `src/renderer`. 파일 형식 정의는 한 곳(`character-package.ts`)에만 둬서 내보내기와 가져오기가 어긋나지 않게 한다.

## 구현 순서 (TDD)

1. `character-package.ts` 단위 테스트(Red) → 구현. 해석 오류 코드: `not-package`, `unsupported-version`, `bad-field`, `bad-base64`, `too-large`.
2. 저장소 `add(..., lines)` 테스트 → 구현. lines.json 쓰기가 실패하면 폴더를 지운다(기존 실패 롤백 경로 재사용).
3. 서비스 `importPackage`/`exportPackage` 테스트 → 구현. 이미지 검증은 `validateRegistration(…, existingNames=[])`, 대사는 `validateLinesInput`, 이름 겹침은 번호 붙이기.
4. IPC·preload·타입, 렌더러 UI.
5. E2E: 내보내기 → 새 `KAKARU_USER_DATA`로 앱 실행 → 가져오기 → 이름·대사 일치 확인, 불량 파일 거부.
6. 문서: ROADMAP 완료 목록·`tests/manual/results.md`(수동 검증 대기)·README 파일 형식 한 줄.

## 위험과 대응

- **샘플 판별이 이름 기준** (`sampleOf`, `backfillSampleLines`가 이름이 같은 첫 캐릭터를 샘플로 본다): 가져오기가 겹치는 이름에 번호를 붙이므로 가져온 캐릭터가 샘플로 오인되지 않는다. 샘플을 내보내 다른 PC에서 가져와도 그 PC에서 "일반 등록 캐릭터"가 된다(처음 문장 되돌리기 대신 비우기).
- **base64 부풀림으로 큰 파일**: 상한 16MB와 읽기 전 크기 확인. 상한 안에서는 한 번에 메모리에 올려도 부담 없다.
- **부분 실패**: 이미지·lines.json을 쓴 뒤 settings.json 저장이 마지막이다. 어느 단계든 실패하면 폴더를 지운다(기존 `add` 동작).
- **내보내기 중 파일 손상**: 임시 파일에 쓴 뒤 이름을 바꾼다. 실패 시 임시 파일 삭제.

## Complexity Tracking

위반 없음.
