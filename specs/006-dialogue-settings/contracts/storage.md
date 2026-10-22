# Contract: 편집한 대화셋 저장

005의 `lines.json` 형식([contracts/lines-file.md](../../005-speech-bubble-monologue/contracts/lines-file.md))을 그대로 쓴다.

| 대상 | 위치 | 비고 |
|---|---|---|
| 등록·샘플 캐릭터 | `<userData>/characters/<id>/lines.json` | 기존 위치. 저장하면 덮어쓴다 |
| 기본 캐릭터 | `<userData>/default-lines.json` | 신규. 없거나 깨졌으면 내장 문장을 쓴다 |

- 쓰기는 `<파일>.tmp`에 쓴 뒤 `rename`한다. 실패하면 임시 파일을 지우고 기존 파일은 그대로 둔다.
- 기본 캐릭터의 편집본이 유효하지만 모든 분류가 비어 있으면 "말하지 않음"으로 읽는다(의도적으로 비운 경우).
- "처음 문장으로 되돌리기": 기본 캐릭터는 `default-lines.json` 삭제, 샘플은 `resources/characters/<키>/lines.json`을 `characters/<id>/lines.json`으로 복사한다.
- 캐릭터 삭제 시 `characters/<id>/` 폴더와 함께 `lines.json`이 지워진다(기존 동작).
