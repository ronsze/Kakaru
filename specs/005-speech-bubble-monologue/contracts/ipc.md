# Contract: 말풍선 전달

새 채널은 없다. 메인 → 렌더러의 기존 `character:update` 페이로드에 필드를 더한다.

```ts
type CharacterUpdate = {
  // ...기존 필드
  speech: { id: number; text: string; remainingMs: number } | null
}
```

- `speech`가 `null`이면 말풍선이 없다. 캐릭터가 보이지 않는 창(`visible: false`)에는 `null`을 보낸다.
- 말을 시작하거나 끝낼 때와 캐릭터가 표시 디스플레이를 바꿀 때 즉시 전송한다. 이동 중 위치 보정 업데이트에도 현재 값을 싣는다. 말풍선이 떠 있는 동안 보정 주기는 250ms다.
- 렌더러는 `id`가 이전과 다를 때만 `remainingMs` 뒤 숨김 타이머를 새로 건다. 같은 `id`가 다시 오면 타이머를 건드리지 않는다.
- 말풍선은 `pointer-events: none`이며 입력을 받지 않는다.
