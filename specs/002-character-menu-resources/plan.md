# Implementation Plan: 우클릭 메뉴와 캐릭터 리소스 설정

**Branch**: `002-character-menu-resources` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-character-menu-resources/spec.md`

## Summary

캐릭터를 우클릭하면 OS 네이티브 메뉴가 열려 캐릭터가 멈추고, 메뉴의 "캐릭터 설정"으로 별도 설정 창을
연다. 설정 창에서 사용자가 이름·걷기 이미지(프레임 시트)·정지 이미지를 등록하고, 목록에서 선택·삭제·
기본 복귀를 한다. 등록 이미지는 사용자 데이터 폴더에 복사·저장하고, 활성 캐릭터는 `data:` URL로
오버레이에 전달해 위치와 이동 상태를 유지한 채 모습만 바꾼다. 001의 오버레이·시뮬레이션·히트 테스트와
`setUserControlled`를 그대로 이어서 쓴다. 상세 결정은 [research.md](./research.md) 참조.

## Technical Context

**Language/Version**: TypeScript 5.x+, Node.js LTS, Electron(001과 동일)

**Primary Dependencies**: 신규 의존성 없음. Electron의 `Menu`, `BrowserWindow`, `ipcMain`, `nativeImage`와 Node `fs`·`crypto`만 사용. 설정 화면은 프레임워크 없이 HTML·CSS·TypeScript

**Storage**: 사용자 데이터 폴더의 파일(`settings.json` + 캐릭터별 이미지 폴더). 형식은 [contracts/storage.md](./contracts/storage.md)

**Testing**: Vitest(이미지 검증 규칙, PNG 헤더 파싱, `CharacterStore`, 메뉴 상태), Playwright Electron(설정 창 등록·적용·유지), 네이티브 메뉴·우클릭·전체 화면 위 동작은 [quickstart.md](./quickstart.md)의 수동 절차

**Target Platform**: macOS, Windows (헌장: 두 OS에서 동일 동작). 이번 수동 검증은 macOS 우선

**Project Type**: desktop-app

**Performance Goals**: 우클릭 후 0.5초 안에 메뉴·정지, 메뉴 닫힘 후 1초 안에 재개, 캐릭터 선택 후 2초 안에 반영. 유휴 CPU 10% 이하 유지(001 SC-006) — 메뉴·설정 창은 필요할 때만 생성

**Constraints**: 이미지당 5MB 이하, 프레임 한 변 64~512px, 프레임 수 2~32, PNG 전용. 렌더러는 샌드박스·`contextIsolation`이며 경로가 아니라 파일 바이트를 메인에 전달

**Scale/Scope**: 등록 캐릭터 수 상한 없음, 오버레이 창은 디스플레이 수만큼, 설정 창은 동시에 최대 1개

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 데스크탑 컴패니언 우선 | 통과 | 캐릭터를 우클릭해 여는 메뉴와 캐릭터 모습 설정으로, 화면 위 캐릭터라는 정체성에서 벗어나지 않는다 |
| II. 핵심 상호작용 3종 보장 | 통과 | 우클릭 메뉴를 구현한다. 메뉴 열림 중 `UserControlled`로 자율 이동과 공존하고, 롱프레스 이동은 건드리지 않는다 |
| III. 비침습성 | 통과 | 캐릭터 밖 우클릭은 아래 창으로 전달된다(R2). 메뉴·설정 창은 필요할 때만 만들어 유휴 비용이 없다(R10) |
| IV. 단순성(YAGNI) | 통과 | 커스텀 메뉴 창·UI 프레임워크·커스텀 프로토콜을 만들지 않는다. 설정 창용 두 번째 preload와 두 번째 렌더러 페이지는 설정 화면 분리에 필요한 최소 구성 |
| V. 검증 가능한 스펙 | 통과 | 수용 조건을 단위·E2E·수동 절차(13개)에 매핑했다(quickstart.md) |
| 기술/플랫폼 제약 | 통과 | Electron, macOS·Windows. OS별 차이는 네이티브 메뉴가 흡수하며 별도 어댑터가 필요 없다 |
| 문서 언어 | 통과 | 모든 산출물을 한국어로 작성 |

**Phase 1 설계 후 재검토**: 위반 없음. Complexity Tracking 항목 없음. 다만 "검증 필요" 가정 두 가지(R1 네이티브
메뉴가 최상위 오버레이 위에 보이는지, R2 `focusable: false` 창에서 `context-menu`가 발생하는지)는 구현 첫
단계에서 실제로 확인한다.

## Project Structure

### Documentation (this feature)

```text
specs/002-character-menu-resources/
├── plan.md              # 이 파일 (/speckit-plan 출력)
├── research.md          # Phase 0 출력
├── data-model.md        # Phase 1 출력
├── quickstart.md        # Phase 1 출력
├── contracts/
│   ├── ipc.md           # 오버레이·설정 창 IPC 계약
│   └── storage.md       # settings.json·이미지 저장 형식
└── tasks.md             # Phase 2 출력 (/speckit-tasks에서 생성, 여기서는 생성 안 함)
```

### Source Code (repository root)

```text
src/
├── main/
│   ├── context-menu.ts        # 오버레이 우클릭 → 네이티브 메뉴 연결
│   ├── settings-window.ts     # 설정 창 생성·재사용·파괴
│   ├── characters-store.ts    # 파일 저장소(Electron 비의존, 루트 경로 주입)
│   ├── characters-service.ts  # 목록·검증·등록 로직(Electron 비의존, 투명도 검사는 포트 주입)
│   ├── characters-ipc.ts      # ipcMain 핸들러, nativeImage 투명도 검사, appearance 전달
│   └── overlay.ts             # (수정) context-menu 연결, 로드 후 appearance 재전송
├── preload/
│   ├── index.ts               # (수정) onAppearance 추가
│   └── settings.ts            # kakaruSettings API
├── renderer/
│   ├── index.html, draw.ts    # (수정) appearance 적용, 프레임 수 CSS 변수
│   ├── settings.html          # 캐릭터 설정 화면
│   └── settings.ts            # 목록·등록 폼·미리보기
└── shared/
    ├── characters.ts          # 타입, 검증 규칙(순수), PNG 헤더 파싱(순수)
    ├── context-menu-controller.ts  # 메뉴 열림·닫힘 상태(순수), 이동 정지 연동·중복 열림 방지
    ├── ipc-settings.ts        # 설정 창 채널 이름(preload 공유 청크 방지를 위해 분리)
    └── ipc.ts                 # (수정) 오버레이 채널·페이로드 타입 추가

tests/
├── unit/
│   ├── characters-validation.test.ts
│   ├── png-header.test.ts
│   ├── characters-store.test.ts
│   ├── characters-service.test.ts
│   └── context-menu.test.ts
├── e2e/
│   └── settings.test.ts
└── manual/
    └── results.md
```

**Structure Decision**: 001의 단일 Electron 프로젝트에 이어 붙인다. 검증·저장소·메뉴 상태 로직은 Electron에
의존하지 않는 모듈로 분리해 단위 테스트하고, Electron API를 쓰는 부분(`nativeImage`, `Menu`,
`BrowserWindow`, `ipcMain`)은 얇은 어댑터로만 둔다.

## Complexity Tracking

위반 없음.
