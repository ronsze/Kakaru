# Implementation Plan: 캐릭터 드래그로 옮기기

**Branch**: `004-character-drag-move` (main에서 작업, 기능별 브랜치 없음) | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-character-drag-move/spec.md`

## Summary

오버레이 창이 캐릭터 위 마우스 왼쪽 버튼 누름/뗌을 메인에 알리고(`character:grab-start`/`grab-end`), 메인이 잡은 동안 매 틱 커서 위치 + 잡은 오프셋으로 캐릭터를 옮긴다(이동 가능 영역으로 clamp). 잡은 동안은 기존 `UserControlled` 상태를 재사용해 자율 이동을 멈추고, 놓으면 `setUserControlled(false)`로 그 자리에서 Idle 재개한다. 드래그 로직은 Electron 비의존 `DragController`(shared)로 분리해 단위 테스트한다. 설계 결정은 [research.md](./research.md).

## Technical Context

**Language/Version**: TypeScript (Electron, electron-vite)

**Primary Dependencies**: Electron(기존), 신규 의존성 없음

**Storage**: N/A (잡기 상태는 저장하지 않는다)

**Testing**: Vitest(순수 로직 단위), Playwright Electron E2E(IPC 경유 잡기·이동·놓기), 실제 마우스 입력은 수동 검증

**Target Platform**: macOS(검증), Windows(후속)

**Project Type**: desktop-app

**Performance Goals**: 눌린 순간부터 0.5초 안에 정지(001 SC-004), 드래그 중 CPU 유휴 기준 10% 근처 유지

**Constraints**: 클릭 통과 구조 유지, 걷기 애니메이션은 CSS 유지(JS 프레임 루프 금지), 샌드박스 preload는 공유 청크 금지

**Scale/Scope**: 변경 파일 약 8개, 신규 모듈 1개(`src/shared/drag-controller.ts`)

## Constitution Check

| 원칙 | 판정 | 비고 |
|---|---|---|
| I 데스크탑 컴패니언 우선 | 통과 | 캐릭터 상호작용 기능 |
| II 핵심 상호작용 3종 | 통과(문구 정정 필요) | 이 기능이 두 번째 계약을 완성한다. 헌장의 "롱프레스 이동"은 "드래그 이동"으로 PATCH 개정(1.3.0→1.3.1) |
| III 비침습성 | 통과 | 잡은 동안만 창이 입력을 받고, 밖은 계속 통과. CPU는 SC-004로 측정 |
| IV 단순성 | 통과 | 새 모듈은 `DragController` 하나. 던지기·관성·잡힌 이미지 없음 |
| V 검증 가능한 스펙 | 통과 | 수용 조건이 입력·결과로 서술됨 |
| 플랫폼 제약 | 통과 | OS 전용 코드 없음. Windows 동작은 후속 검증 |

설계 후 재점검: 위반 없음. Complexity Tracking 해당 없음.

## Project Structure

### Documentation (this feature)

```text
specs/004-character-drag-move/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/ipc.md
├── checklists/requirements.md
└── tasks.md             # /speckit-tasks 에서 생성
```

### Source Code (repository root)

```text
src/
├── shared/
│   ├── drag-controller.ts      # 신규: 잡기 시작·갱신·끝 (순수 로직)
│   ├── behavior.ts             # moveTo(point) 추가 (UserControlled 중 위치 설정)
│   ├── context-menu-controller.ts  # 드래그 중 메뉴 열림 차단 포트
│   └── ipc.ts                  # grab 채널 상수, KakaruApi.grabStart/grabEnd
├── main/
│   ├── simulation.ts           # 틱에서 드래그 갱신, 강제 broadcast
│   ├── drag-ipc.ts             # 신규: ipcMain 채널 연결, 해제 트리거(blur·디스플레이 변경·resume)
│   └── index.ts                # 컨트롤러 조립
├── preload/index.ts            # grabStart/grabEnd 노출
└── renderer/draw.ts            # mousedown/up, 포인터 캡처, UserControlled 중 transition 없이 배치

tests/
├── unit/drag-controller.test.ts, behavior-drag.test.ts
└── e2e/drag.test.ts
```

**Structure Decision**: 기존 구조(shared 순수 로직 + main 연결 + preload/renderer)를 그대로 따른다. preload는 `import type`만 공유하고 채널 상수는 `ipc.ts`에서 값으로 가져오는 기존 방식을 쓰되, 청크가 생기는지 `out/preload/`를 확인한다(CLAUDE.md 함정).
