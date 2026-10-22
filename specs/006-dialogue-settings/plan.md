# Implementation Plan: 대사 설정 화면

**Branch**: `006-dialogue-settings` (main에서 작업) | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

## Summary

캐릭터 설정 창의 목록 항목에 "대사 편집"을 추가하고, 오른쪽 영역을 등록 폼 대신 대사 편집 패널로 바꿔 보여 준다. 패널은 세 분류마다 텍스트 영역(한 줄이 한 문장)을 두고, 입력 단계에서 005의 문장 규칙을 검증해 위반 줄 옆에 이유를 보인다. 저장은 메인의 `CharacterService`가 같은 검증 함수로 다시 검증한 뒤 `lines.json`(기본 캐릭터는 `default-lines.json`)에 원자적으로 써서 즉시 반영한다(발화 시점에 파일을 읽으므로 재시작이 필요 없다). 설계 결정은 [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (Electron, electron-vite)

**Primary Dependencies**: 신규 없음

**Storage**: `<userData>/characters/<id>/lines.json`(기존), `<userData>/default-lines.json`(신규, 기본 캐릭터 편집본). 둘 다 005의 `lines.json` 형식. `settings.json`은 바꾸지 않는다

**Testing**: Vitest(검증 함수·저장·복원), Playwright E2E(설정 창에서 편집·저장·오류 표시·복원, 저장한 문장이 잡았을 때 말풍선에 나옴)

**Target Platform**: macOS(검증), Windows(후속)

**Project Type**: desktop-app

**Performance Goals**: 검증은 입력마다 즉시(동기, 순수 함수). 저장은 사용자가 체감할 지연 없음

**Constraints**: 샌드박스 preload 공유 청크 금지(채널 상수는 `ipc-settings.ts`, preload는 `import type`만), 렌더러를 신뢰하지 않고 메인에서 재검증, 저장은 원자적

**Scale/Scope**: 변경 파일 약 10개, 신규 모듈 없음(`shared/dialogue.ts`에 검증 함수 추가)

## Constitution Check

| 원칙 | 판정 | 비고 |
|---|---|---|
| I 데스크탑 컴패니언 우선 | 통과 | 캐릭터 대사 설정 |
| II 핵심 상호작용 3종 | 통과 | 이동·드래그·메뉴를 건드리지 않는다 |
| III 비침습성 | 통과 | 설정 창 내부 기능 |
| IV 단순성 | 통과 | 분류 고정, 텍스트 영역 한 종류, 가져오기·순서 변경·가중치 없음. 새 의존성 없음 |
| V 검증 가능한 스펙 | 통과 | 수용 조건이 입력·결과로 서술됨 |
| 플랫폼 제약 | 통과 | OS 전용 코드 없음 |

설계 후 재점검: 위반 없음. Complexity Tracking 해당 없음.

## Project Structure

### Documentation (this feature)

```text
specs/006-dialogue-settings/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/{ipc.md, storage.md}
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── dialogue.ts          # validateLinesInput(), LinesIssue 타입 추가
│   ├── ipc.ts               # LinesView, SaveLinesResult, KakaruSettingsApi 확장
│   └── ipc-settings.ts      # 채널 상수 3개
├── main/
│   ├── characters-store.ts  # lines 저장·읽기(기본 편집본 포함), 복원, 원자적 쓰기
│   ├── characters-service.ts# getLines/saveLines/restoreLines, 샘플 인식
│   └── characters-ipc.ts    # 핸들러 3개
├── preload/settings.ts      # API 노출
└── renderer/
    ├── settings.html        # 대사 패널 마크업·스타일
    └── settings.ts          # 패널 전환, 실시간 검증, 저장, 미저장 확인, 복원

tests/
├── unit/dialogue-validate.test.ts, characters-store-lines-edit.test.ts, characters-service-lines.test.ts
└── e2e/dialogue-settings.test.ts
```

**Structure Decision**: 기존 구조(shared 순수 로직 + main 서비스 + 설정 창 렌더러)를 따른다. 검증은 shared의 순수 함수로 렌더러와 메인이 함께 쓴다.
