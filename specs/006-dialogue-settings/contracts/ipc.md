# Contract: 대사 편집 IPC

설정 창 preload API(`KakaruSettingsApi`)에 추가한다. 채널 이름은 `src/shared/ipc-settings.ts`에 둔다(공유 청크 방지, CLAUDE.md 함정).

| 채널 | 메서드 | 요청 | 응답 |
|---|---|---|---|
| `lines:get` | `getLines(id)` | `id: string \| null` (null = 기본 캐릭터) | `{ ok: true, view: LinesView } \| { ok: false, message }` |
| `lines:save` | `saveLines(id, input)` | `id`, `input: Record<Category, string[]>` | `{ ok: true, lines: Lines, dropped: number, merged: number } \| { ok: false, issues: LinesIssue[] } \| { ok: false, message }` |
| `lines:restore` | `restoreLines(id)` | `id` | `{ ok: true, lines: Lines } \| { ok: false, message }` |

- 메인은 모든 요청의 `id`와 `input` 모양을 확인한다(문자열이 아닌 값, 알 수 없는 분류 키 거부).
- `saveLines`는 검증 실패 시 `issues`만 돌려주고 아무것도 쓰지 않는다. 존재하지 않는 캐릭터면 `message`로 거부한다(FR-011).
- `restoreLines`: 기본 캐릭터는 편집본 삭제, 샘플은 원본 복사, 등록 캐릭터는 빈 대화셋 저장("모두 비우기").
- 저장·복원이 성공해도 별도 알림은 보내지 않는다. 문장은 발화 시점에 읽히므로 즉시 반영된다.
- 응답의 `issues`는 `{ category, line, code, message }`이며 화면이 줄 번호와 함께 보여 준다.
