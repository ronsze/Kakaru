# Quickstart: 드래그 이동 검증

## 자동 검증

```bash
npm test                                   # DragController·MovementEngine.moveTo 단위 테스트
npx tsc -p tsconfig.node.json && npx tsc -p tsconfig.web.json
npm run test:e2e                           # grab-start → 위치 이동 → grab-end → Idle 재개
```

E2E는 `KAKARU_USER_DATA`로 격리하며, IPC 채널로 잡기를 흘려 보내 상태를 확인한다(실제 마우스 아님).

## 수동 검증 (사람이 수행, `tests/manual/results.md`에 기록)

`npm run dev` 후:

1. 캐릭터 가장자리(왼쪽 위)를 잡고 끈다 → 잡은 지점이 커서 아래에 유지된다 (US1-2).
2. 걷는 중에 누르는 순간 멈춘다 (US1-1). 놓으면 그 자리에서 다시 걷는다 (US1-3).
3. 확대(1.6배 등)한 상태에서 끌어 본다 (US1-4).
4. 캐릭터 옆 빈 곳을 누르고 끈다 → 아래 창이 평소처럼 반응한다 (US1-5).
5. 화면 가장자리 밖으로 끈다 → 캐릭터가 가장자리에 머문다 (US2-1).
6. 모니터가 둘이면 다른 모니터로 끈다 (US2-2, 3).
7. 끈 직후 우클릭 → 메뉴가 열린다 (US3-1). 움직임 없는 클릭 → 위치 불변 (US3-2).
8. 끌다가 커서를 캐릭터 밖·창 밖으로 크게 벗어나 놓는다 → 잡힌 채 남지 않는다 (엣지, FR-010).
9. 20회 반복해 굳거나 화면 밖에 남지 않는지 본다 (SC-003). 드래그 중 활성 상태 모니터로 CPU를 본다 (SC-004).

macOS에서만 수행한다. Windows 열은 "후속".
