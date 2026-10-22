# Implementation Plan: 말풍선과 혼잣말

**Branch**: `005-speech-bubble-monologue` (main에서 작업) | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

## Summary

메인의 시뮬레이션 틱이 `Speaker`(shared, 순수 로직)를 돌려 "언제, 어떤 분류의, 어떤 문장"을 말할지 정한다. 말한 문장은 기존 `character:update`에 `speech` 필드(id, 텍스트, 남은 시간)로 실어 캐릭터가 있는 오버레이 창에 보낸다. 렌더러는 `#actor` 안에 말풍선 요소를 두어 캐릭터가 걷는 동안 CSS로 함께 움직이게 하고, 화면 가장자리에서 잘리지 않게 위치만 보정한다. 문장은 캐릭터별 `lines.json`(분류별 목록)에서 읽고, 기본 캐릭터는 코드 내장 문장을 쓴다. 설계 결정은 [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (Electron, electron-vite)

**Primary Dependencies**: 신규 없음

**Storage**: 캐릭터 폴더의 `characters/<id>/lines.json` (선택 파일). `settings.json`은 바꾸지 않는다

**Testing**: Vitest(문장 정리·선택·`Speaker` 일정, 저장소 읽기), Playwright E2E(잡으면 말풍선이 나타난다), 위치·모양은 수동 검증

**Target Platform**: macOS(검증), Windows(후속)

**Project Type**: desktop-app

**Performance Goals**: 유휴 CPU 평균 10% 이하 유지(SC-007). 말풍선 표시 중에도 프레임마다 JS를 돌리지 않는다

**Constraints**: 클릭 통과 유지(말풍선은 입력을 받지 않는다), 샌드박스 preload 공유 청크 금지, 새 IPC 채널 없이 기존 `character:update`를 확장

**Scale/Scope**: 신규 모듈 2개(`shared/dialogue.ts`, `shared/speaker.ts`), 변경 파일 약 8개

## Constitution Check

| 원칙 | 판정 | 비고 |
|---|---|---|
| I 데스크탑 컴패니언 우선 | 통과 | 캐릭터 표현 기능 |
| II 핵심 상호작용 3종 | 통과 | 이동·드래그·메뉴를 건드리지 않고 말풍선이 입력을 가로채지 않는다 |
| III 비침습성 | 통과 | 말풍선은 클릭 통과. 표시 중에도 CSS 이동만 쓴다 |
| IV 단순성 | 통과 | 분류 3개 고정, 설정 UI 없음, 새 IPC 채널 없음. 문장 편집 수단은 만들지 않는다 |
| V 검증 가능한 스펙 | 통과 | 수용 조건이 입력·결과로 서술됨 |
| 플랫폼 제약 | 통과 | OS 전용 코드 없음 |

설계 후 재점검: 위반 없음. Complexity Tracking 해당 없음.

## Project Structure

### Documentation (this feature)

```text
specs/005-speech-bubble-monologue/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/{ipc.md, lines-file.md}
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── dialogue.ts          # 신규: 분류 상수, Lines 타입, sanitizeLines, pickLine, 기본 캐릭터 문장
│   ├── speaker.ts           # 신규: 혼잣말 일정·발화 (순수 로직)
│   ├── config.ts            # speech(간격·표시 시간·최대 길이), struggleAfterMs 추가
│   └── ipc.ts               # CharacterUpdate.speech 추가
├── main/
│   ├── characters-store.ts  # readLines(), 샘플 lines 백필
│   ├── characters-service.ts# lines() 노출, 샘플 설치 시 lines.json 복사
│   ├── simulation.ts        # 틱에서 Speaker 구동, speech를 broadcast에 포함
│   └── index.ts             # Speaker에 문장 공급자·메뉴 열림 상태 연결
├── renderer/
│   ├── index.html           # 말풍선 스타일
│   └── draw.ts              # 말풍선 표시·위치 보정, 발버둥 5초를 config로 통일
└── resources/characters/bmm/lines.json   # 샘플 캐릭터 문장

tests/
├── unit/dialogue.test.ts, speaker.test.ts, characters-store-lines.test.ts
└── e2e/speech.test.ts
```

**Structure Decision**: 기존 구조(shared 순수 로직 + main 연결 + renderer 표시)를 따른다. 말풍선 표시 상태는 `Speaker`가 소유하고 렌더러는 받은 값만 그린다.
