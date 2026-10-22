# Kakaru

데스크탑 화면 위를 스스로 돌아다니는 캐릭터 앱이다. 지원 OS는 macOS와 Windows이다.

현재 구현된 기능은 다음과 같다.

- **캐릭터 자율 이동**: 캐릭터가 화면 위를 스스로 돌아다닌다. 캐릭터가 없는 영역의 클릭은 아래 창으로 그대로 전달된다.
- **우클릭 메뉴**: 캐릭터를 우클릭하면 메뉴가 열리고 캐릭터는 멈춘다. 메뉴를 닫으면 그 자리에서 다시 움직인다.
- **캐릭터 설정**: 메뉴의 "캐릭터 설정"에서 내 이미지로 캐릭터를 등록하고, 선택·삭제하거나 기본 캐릭터로 되돌린다.

## 실행

```bash
npm install
npm run dev        # 개발 실행
npm run build      # 빌드
```

## 캐릭터 이미지 규격

설정 화면에서 캐릭터를 등록할 때 쓰는 이미지 규격이다. 기본 캐릭터(`src/renderer/assets/`, 폴리곤 고양이 8프레임)와 샘플 캐릭터(`resources/characters/bmm/`, "빨간 모자" 4프레임)도 같은 규격이다.
앱을 처음 실행하면 샘플이 등록된 캐릭터로 들어 있고, 선택하기 전에는 기본 캐릭터를 쓴다.

| 항목 | 규칙 |
|---|---|
| 형식 | PNG, 투명 배경, 이미지당 5MB 이하 |
| 걷기 이미지 | 같은 크기의 프레임을 가로로 이은 한 장. 높이 = 프레임 한 변(64~512px), 너비 = 한 변 × 프레임 수(2~32) |
| 정지 이미지 | 정사각형 한 장, 한 변이 걷기 프레임과 같아야 한다 |
| 방향 | 오른쪽을 보는 한 방향만 만든다. 왼쪽은 앱이 반전한다 |
| 권장 크기 | 화면에는 100×100으로 표시된다. 고해상도 화면을 위해 한 변 200px 권장 |

## 개발·테스트용 설정

- 환경 변수 `KAKARU_USER_DATA`: 저장 데이터와 단일 인스턴스 잠금을 이 폴더로 분리한다.
  예) `KAKARU_USER_DATA=/tmp/kakaru-test npm run dev`
- 앱 인자 `--open-settings`: 시작하자마자 캐릭터 설정 창을 연다.

## 테스트

```bash
npm test           # 단위 테스트 (Vitest)
npm run test:e2e   # Electron E2E (Playwright, 빌드 후 앱을 실제로 띄운다)
```

클릭 통과, 전체 화면 앱 위 표시, 멀티 모니터는 자동화가 어려워
`specs/001-character-autonomous-movement/quickstart.md`의 수동 절차로 확인한다.
결과는 `tests/manual/results.md`에 기록한다.

## 구조

- `src/main`: Electron 메인 프로세스 (오버레이 창, 시뮬레이션, 클릭 통과)
- `src/preload`: 렌더러에 노출하는 IPC API
- `src/renderer`: 오버레이 창의 Canvas 2D 렌더링
- `src/shared`: Electron에 의존하지 않는 순수 로직 (이동 상태 머신, 영역, 히트 판정)

설계 문서는 `specs/`와 `.specify/memory/constitution.md`(프로젝트 헌장)를 본다.
