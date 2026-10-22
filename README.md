# Kakaru

데스크탑 화면 위를 스스로 돌아다니는 캐릭터 앱이다. 지원 OS는 macOS와 Windows이다.

현재 구현된 기능은 캐릭터 자율 이동이다. 캐릭터는 폴리곤으로 그린 임시 디자인이며,
캐릭터가 없는 영역의 클릭은 아래 창으로 그대로 전달된다.

## 실행

```bash
npm install
npm run dev        # 개발 실행
npm run build      # 빌드
```

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
