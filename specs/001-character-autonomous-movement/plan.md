# Implementation Plan: 캐릭터 자율 이동

**Branch**: `001-character-autonomous-movement` | **Date**: 2026-10-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-character-autonomous-movement/spec.md`

## Summary

데스크탑 화면 위의 캐릭터가 사용자 입력 없이 스스로 걷고 멈추며 돌아다니게 한다. 연결된
디스플레이마다 투명·항상 위 오버레이 창을 하나씩 두고, 캐릭터 상태는 메인 프로세스가 단일
출처로 시뮬레이션한다. 캐릭터 밖 영역은 클릭을 아래 창으로 통과시키고, 커서가 캐릭터 위에
있을 때만 통과를 해제한다. 상세 결정은 [research.md](./research.md) 참조.

## Technical Context

**Language/Version**: TypeScript 5.x, Node.js LTS, Electron(최신 안정 버전)

**Primary Dependencies**: Electron, electron-vite(Vite), 이미지 리소스(투명 PNG)와 CSS 애니메이션(렌더링, 캐릭터 규격은 research R11). 3D·물리(Three.js, Rapier)는 추후 도입이라 이번에는 추가하지 않는다.

**Storage**: N/A (메모리 상태만 사용, 설정 영속화 없음)

**Testing**: Vitest(단위), Playwright Electron(통합·E2E), 클릭 통과·멀티 모니터·전체 화면은 [quickstart.md](./quickstart.md)의 수동 절차

**Target Platform**: macOS, Windows (헌장: 두 OS에서 동일 동작)

**Project Type**: desktop-app

**Performance Goals**: 유휴 평균 CPU 10% 이하, 렌더링 30fps 이상, 사용자 조작 후 0.5초 안에 자율 이동 정지 (수치는 제안값이며 스펙 보완 후보 — research R9)

**Constraints**: 메모리 300MB 이하(제안값), 클릭 통과로 다른 앱 입력을 가로채지 않음, 두 OS 동일 동작

**Scale/Scope**: 캐릭터 1개, 오버레이 창은 디스플레이 수만큼, 사용자 설정 기능 없음

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 원칙 | 판정 | 근거 |
|---|---|---|
| I. 데스크탑 컴패니언 우선 | 통과 | 기능 전체가 화면 위 캐릭터의 이동이며 무관한 기능을 넣지 않는다 |
| II. 핵심 상호작용 3종 보장 | 통과 | 자율 이동을 구현하고, `UserControlled` 상태로 롱프레스·우클릭 메뉴와 공존하는 구조를 마련한다 (FR-006) |
| III. 비침습성 | 통과(수치 보완 필요) | 기본 클릭 통과 + 커서 폴링으로 구현(R2). 수치 기준은 스펙에 없어 plan에서 제안(R9) |
| IV. 단순성(YAGNI) | 통과 | 이미지 리소스 + CSS 애니메이션, 설정·영속화·3D 없음. OS 어댑터는 헌장의 "공통 인터페이스 뒤" 요구에 필요한 최소 구성 |
| V. 검증 가능한 스펙 | 통과 | 인수 시나리오를 단위·E2E·수동 절차에 매핑(quickstart.md) |
| 기술/플랫폼 제약 | 통과 | Electron, macOS·Windows, 전체 화면 오버레이 + 클릭 통과 |
| 문서 언어 | 통과 | 모든 산출물을 한국어로 작성 |

**Phase 1 설계 후 재검토**: 위반 없음. Complexity Tracking 항목 없음.

## Project Structure

### Documentation (this feature)

```text
specs/001-character-autonomous-movement/
├── plan.md              # 이 파일 (/speckit-plan 출력)
├── research.md          # Phase 0 출력
├── data-model.md        # Phase 1 출력
├── quickstart.md        # Phase 1 출력
├── contracts/
│   └── ipc.md           # 메인 ↔ 렌더러 IPC 계약
└── tasks.md             # Phase 2 출력 (/speckit-tasks에서 생성, 여기서는 생성 안 함)
```

### Source Code (repository root)

```text
src/
├── main/                  # Electron 메인 프로세스
│   ├── index.ts           # 앱 진입, 수명 주기
│   ├── overlay.ts         # 디스플레이별 오버레이 창 생성·재구성
│   ├── hit-test.ts        # 커서 폴링 → 클릭 통과 전환
│   ├── simulation.ts      # 60Hz 틱, MovementEngine 구동, IPC 송신
│   └── platform/          # PlatformAdapter (OS별 창 레벨 설정)
│       ├── index.ts
│       ├── mac.ts
│       └── win.ts
├── preload/
│   └── index.ts           # contextBridge로 IPC 노출
├── renderer/              # 오버레이 창 UI
│   ├── index.html
│   ├── draw.ts            # IPC 상태를 img·CSS 클래스에 반영
│   └── assets/            # walk.png(4프레임 시트), idle.png
└── shared/                # Electron 비의존 순수 로직
    ├── types.ts           # Character·Point·Rect 등 공용 타입
    ├── ipc.ts             # 채널·페이로드 타입
    ├── config.ts          # 행동 파라미터 상수
    ├── area.ts            # WalkableArea
    ├── hit.ts             # 커서-캐릭터 히트 판정(순수 함수)
    └── behavior.ts        # MovementEngine 상태 머신

tests/
├── unit/                  # shared/ 순수 로직
├── e2e/                   # Playwright Electron
└── manual/                # quickstart 수동 체크 기록용
```

**Structure Decision**: 단일 Electron 프로젝트. Electron API를 쓰지 않는 이동 로직은
`shared/`에 순수 함수로 분리해 단위 테스트하고, OS 차이는 `main/platform/` 뒤에 가둔다.

## Complexity Tracking

위반 없음.
