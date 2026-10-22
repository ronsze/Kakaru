# Quickstart: 캐릭터 내보내기·가져오기 검증

## 준비

```bash
npm install
npx tsc -p tsconfig.node.json && npx tsc -p tsconfig.web.json
npm test
npm run test:e2e
```

E2E와 수동 확인은 항상 `KAKARU_USER_DATA`로 격리한다(사용자의 `npm run dev` 인스턴스와 충돌하지 않는다).

## 자동 검증

| 범위 | 확인 내용 | 명령 |
|---|---|---|
| 단위 | 파일 구조 생성·해석, 오류 코드, 파일명 정리, 이름 번호 붙이기 | `npx vitest run tests/unit/character-package.test.ts` |
| 단위 | 서비스 왕복(내보내기→가져오기), 검증 거부 5종, 부분 실패 롤백 | `npx vitest run tests/unit/characters-service-transfer.test.ts tests/unit/characters-store.test.ts` |
| E2E | 설정 창 버튼 → 파일 → 새 사용자 데이터에서 가져오기 | `npx playwright test tests/e2e/transfer.test.ts` (먼저 `npm run build`) |

기대 결과: 모두 통과, 기존 단위·E2E도 그대로 통과(SC-005).

## 수동 검증 (macOS, 사람이 한다 — 네이티브 대화상자는 에이전트가 못 본다)

앱은 `KAKARU_USER_DATA=/tmp/kakaru-a npm run dev -- --open-settings`로 띄운다.

1. **내보내기**: 목록에서 "나"의 [내보내기] → 저장 대화상자의 기본 이름이 `나.kakaru` → 바탕화면에 저장 → "내보냈습니다" 메시지. 기본 캐릭터 항목에는 버튼이 없다.
2. **취소**: 같은 흐름에서 대화상자를 취소 → 메시지·오류 없음, 파일 없음.
3. **가져오기**: 다른 사용자 데이터(`KAKARU_USER_DATA=/tmp/kakaru-b`)로 앱을 띄우고 [가져오기] → 방금 파일 선택 → 목록에 이름·이미지가 같은 캐릭터가 생긴다. "사용 중" 표시는 바뀌지 않는다.
4. **대사**: 가져온 캐릭터의 [대사 편집]을 열어 네 분류가 원본과 같다. [선택]으로 적용하고 캐릭터가 걷고 말풍선이 나오는지 본다.
5. **겹침**: 같은 파일을 한 번 더 가져온다 → `나 (2)`가 생기고 원래 캐릭터는 그대로다.
6. **불량 파일**: 아무 텍스트 파일 이름을 `x.kakaru`로 바꿔 가져온다 → "캐릭터 파일이 아니거나 손상되었습니다" 안내, 목록 그대로.
7. **회귀**: 우클릭 메뉴·드래그·자율 이동이 평소처럼 동작한다(오버레이 코드는 바뀌지 않았음을 확인).

통과 여부를 `tests/manual/results.md`에 기록한다. Windows 열은 "후속"으로 둔다.

## 계약 참조

- 파일 형식: [contracts/package-file.md](./contracts/package-file.md)
- 채널·결과 타입: [contracts/ipc.md](./contracts/ipc.md)
- 데이터·오류 분류: [data-model.md](./data-model.md)
