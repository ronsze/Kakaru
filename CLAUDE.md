# Kakaru

데스크탑 화면 위를 스스로 돌아다니는 캐릭터 앱. Electron + TypeScript, 지원 OS는 macOS와 Windows(검증은 macOS만 됨).
새 세션이면 먼저 `specs/ROADMAP.md`(현재 상태, 다음 할 일, 미정 사항)와 `.specify/memory/constitution.md`(헌장)를 읽는다.

## 명령

```bash
npm install
npm run dev          # 개발 실행
npm run build        # 빌드 (out/ 생성)
npm test             # 단위 테스트 (Vitest)
npm run test:e2e     # 빌드 후 Playwright Electron E2E (앱이 실제로 뜬다)
npx tsc -p tsconfig.node.json && npx tsc -p tsconfig.web.json   # 타입 검사
```

- `KAKARU_USER_DATA=<폴더>`: 저장 데이터와 단일 인스턴스 잠금을 그 폴더로 분리한다. E2E와 측정은 항상 이걸 쓴다.
- 앱 인자 `--open-settings`: 시작하자마자 캐릭터 설정 창을 연다.
- 실제 사용자 데이터: `~/Library/Application Support/kakaru/` (`settings.json`, `characters/<id>/walk.png·idle.png`).

## 구조

- `src/main`: Electron 메인(오버레이 창, 시뮬레이션 틱, 클릭 통과, 우클릭 메뉴, 설정 창, 캐릭터 저장소·서비스·IPC)
- `src/preload`: `index.ts`(오버레이용), `settings.ts`(설정 창용)
- `src/renderer`: `index.html·draw.ts`(오버레이, `<img>`+CSS 애니메이션), `settings.html·settings.ts`(설정 화면), `assets/`(기본 캐릭터 이미지)
- `src/shared`: Electron에 의존하지 않는 순수 로직(이동 상태 머신, 영역, 히트 판정, 이미지 검증, 메뉴 상태, IPC 타입)
- `resources/characters/bmm/`: 처음 실행 때 등록되는 샘플 캐릭터 "빨간 모자" 이미지
- `specs/NNN-*/`: Spec Kit 산출물(spec, plan, research, data-model, contracts, quickstart, tasks)
- `tests/unit`, `tests/e2e`, `tests/manual/results.md`(수동 검증 기록)

## 작업 규칙

- 기능 개발은 Spec Kit 흐름(`/speckit-specify` → `plan` → `tasks` → `implement`, 필요하면 `clarify`·`analyze`)을 따른다. 아주 작은 변경은 짧은 spec만 만들고 바로 구현해도 된다(003 선례).
- Spec Kit이 만드는 모든 문서의 본문은 한국어(헌장). 코드·식별자·템플릿 고정 구조(FR-001, Given/When/Then)는 원문 유지.
- 커밋 작성자는 `ronsze <ljg5846@gmail.com>`(이 저장소의 로컬 git 설정에 이미 있음). 커밋 메시지 끝에 `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`를 붙인다. 브랜치는 `main`이고 기능마다 브랜치를 따로 만들지 않는다. 커밋·푸시는 사용자가 요청할 때만 한다.
- 테스트는 구현보다 먼저 쓰고 실패를 확인한다(TDD). 순수 로직은 `src/shared` 또는 Electron 비의존 모듈로 분리해 단위 테스트한다.
- 수동 검증은 사람이 해야 한다(화면 캡처·실제 마우스 입력·전체 화면 앱·Windows는 에이전트가 못 한다). 사용자가 "N번 수행 통과"라고 알려 주면 `tests/manual/results.md`의 표와 `tasks.md`를 갱신한다. 통과 여부를 모르면 묻는다.

## 주의할 함정

- **샌드박스 preload는 상대 경로 `require`를 못 한다.** 두 preload가 같은 모듈을 가져오면 번들러가 공유 청크를 만들어 preload가 통째로 실패한다. 그래서 설정 창 채널 상수를 `src/shared/ipc-settings.ts`로 따로 뒀다. preload에서는 `import type`만 공유하고, 값을 공유하려면 청크가 생기지 않는지 `out/preload/`를 확인한다.
- **사용자가 `npm run dev`로 앱을 띄워 둘 수 있다.** `pkill`로 `electron`을 광범위하게 죽이지 말고, E2E·측정은 `KAKARU_USER_DATA`로 격리한다(단일 인스턴스 잠금이 사용자 데이터 폴더 기준이라 충돌하지 않는다).
- 오버레이는 전체 화면 크기의 투명 창이고 기본이 클릭 통과다. 커서가 캐릭터 히트 영역 위일 때만 해당 창이 입력을 받는다(`src/main/hit-test.ts`, `src/shared/hit.ts`). 이 구조를 바꾸면 우클릭 메뉴(`webContents`의 `context-menu`)와 확대 시 히트 영역도 함께 확인한다.
- 걷기 애니메이션과 이동은 CSS(compositor)가 처리해 CPU를 아낀다(유휴 평균 약 8%, 기준 10% 이하). 프레임마다 JS가 도는 방식(캔버스 재그리기 등)으로 되돌리지 않는다.
- 기본 캐릭터는 코드 내장(폴리곤 고양이, 걷기 8프레임)이라 삭제 불가. 이미지 규격 변경 시 `LIMITS.defaultFrames`, `draw.ts`의 `DEFAULT_FRAMES`, 두 HTML의 CSS 변수 기본값을 함께 바꾼다.

## 사용자 선호

- 응답은 결과만 간결하게. 판단이 필요하면 선택지를 나열하고 추천 하나를 찍는다.
- 한국어로 소통한다.
