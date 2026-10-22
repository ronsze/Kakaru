# 계약: 설정 창 ↔ 메인 IPC

채널 이름은 `src/shared/ipc-settings.ts`에 상수로 둔다(샌드박스 preload가 공유 청크를 만들지 않도록 값 공유는 이 파일에서만).

| 상수 | 값 | 방향 |
|---|---|---|
| `CHANNEL_CHARACTERS_EXPORT` | `characters:export` | 설정 창 → 메인 (`invoke`) |
| `CHANNEL_CHARACTERS_IMPORT` | `characters:import` | 설정 창 → 메인 (`invoke`) |

## `kakaruSettings.exportCharacter(id: string): Promise<ExportResult>`

메인이 하는 일: ① `id`가 문자열인지 확인 → ② 서비스에서 파일 내용과 기본 파일 이름을 만든다 → ③ 설정 창을 부모로 저장 대화상자를 연다 → ④ 임시 파일에 쓴 뒤 이름을 바꿔 저장한다.

```ts
type ExportResult =
  | { ok: true; fileName: string }          // 저장한 파일 이름(경로 제외)
  | { ok: false; canceled: true }           // 사용자가 대화상자를 취소 — 오류로 표시하지 않는다
  | { ok: false; message: string }          // 기본 캐릭터·없는 id·이미지 읽기 실패·쓰기 실패
```

## `kakaruSettings.importCharacter(): Promise<ImportResult>`

메인이 하는 일: ① 설정 창을 부모로 열기 대화상자를 연다(필터 `.kakaru`, 모든 파일도 선택 가능) → ② 크기 확인(16MB) → ③ 파일을 읽어 서비스에 넘긴다 → ④ 성공이면 `notifyCharactersChanged()`. 활성 캐릭터는 바꾸지 않으므로 오버레이 갱신(`onAppearanceChanged`)은 하지 않는다.

```ts
type ImportResult =
  | { ok: true; id: string; name: string }  // name은 번호가 붙었을 수 있는 최종 이름
  | { ok: false; canceled: true }
  | { ok: false; message: string; details: string[] }
  //   message: 한 줄 요약, details: 이미지·이름·대사 위반 문구 목록(없으면 빈 배열)
```

## 오류 문구 원칙

- `message`는 사용자가 다음 행동을 알 수 있게 쓴다(예: "캐릭터 파일이 아니거나 손상되었습니다.").
- `details`는 검증이 낸 문구를 그대로 쓴다. 이미지는 "걷기 이미지:" / "정지 이미지:", 대사는 "대사(평소):"처럼 대상을 앞에 붙인다.
- 내부 경로·스택은 노출하지 않는다.

## 서비스 계약 (`CharacterService`)

```ts
exportPackage(id: string): { ok: true; content: string; suggestedFileName: string } | { ok: false; message: string }
importPackage(text: string): { ok: true; id: string; name: string } | { ok: false; message: string; details: string[] }
```

- `exportPackage`: 기본 캐릭터(`null`)·등록되지 않은 id·이미지를 읽을 수 없는 캐릭터는 `ok:false`. 대사는 `store.readLinesOf(id)`(저장된 값).
- `importPackage`: 파일 내용(문자열)만 받는다. 파일 크기 확인과 대화상자는 IPC 계층이 한다. 검증을 모두 통과해야 `store.add(…, lines)`를 호출하며, 실패하면 아무것도 남기지 않는다.
