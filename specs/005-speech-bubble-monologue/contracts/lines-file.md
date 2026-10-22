# Contract: lines.json

`<userData>/characters/<id>/lines.json` (선택 파일). 샘플 캐릭터의 원본은 `resources/characters/<key>/lines.json`.

```json
{
  "version": 1,
  "lines": {
    "normal": ["오늘은 날씨가 좋네.", "..."],
    "grabbed": ["어어?"],
    "struggling": ["놓아 줘!"]
  }
}
```

- `version`은 1이어야 한다. 다르면 파일 전체를 무시하고 모든 분류를 빈 목록으로 본다.
- 분류 키는 `normal`, `grabbed`, `struggling`이다. 없는 분류는 빈 목록, 그 밖의 키는 무시한다.
- 문장 규칙은 [data-model.md](../data-model.md)를 따른다.
- 읽기만 하고 앱이 쓰지 않는다(편집 수단은 이번 범위가 아님). 읽는 시점은 말을 하려 할 때마다이며, 파일이 없거나 깨져 있으면 오류 없이 빈 목록이다.
- 캐릭터 삭제 시 폴더와 함께 지워진다.
