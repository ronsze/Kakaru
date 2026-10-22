# 계약: 저장 형식

## 위치

`<userData>/characters/<id>/walk.png`, `<userData>/characters/<id>/idle.png`,
`<userData>/settings.json`. `<userData>`는 `app.getPath('userData')`이고 환경 변수
`KAKARU_USER_DATA`가 있으면 그 경로를 쓴다.

## settings.json (version 1)

```json
{
  "version": 1,
  "activeId": "k3x9a1b2",
  "seeded": ["bmm"],
  "characters": [
    { "id": "k3x9a1b2", "name": "고양이", "frames": 8, "frameSize": 200, "createdAt": 1792000000000 }
  ]
}
```

- `activeId`가 `null`이면 기본 캐릭터다.
- `seeded`(선택)는 처음 실행 때 등록한 샘플 캐릭터 키 목록이다. 키가 있으면 그 샘플을 다시 등록하지 않는다.
- `id`는 `^[a-z0-9]{8,32}$`만 허용하며, 이미지 경로는 항상 `characters/<id>/walk.png`,
  `characters/<id>/idle.png`로 고정한다(경로 조작 방지).
- 읽기: 파일이 없으면 빈 상태, JSON 파싱 실패·`version` 불일치·스키마 위반이면
  `settings.json.broken-<ms>`로 옮기고 빈 상태로 시작한다.
- 쓰기: `settings.json.tmp`에 쓴 뒤 `rename`한다. 이미지는 `characters/<id>/`를 먼저 만들고 두 파일을
  쓴 다음 `settings.json`에 추가한다(중간에 실패하면 만든 폴더를 지운다).
- 삭제: `settings.json`에서 항목을 빼 저장한 뒤 폴더를 지운다. 폴더 삭제가 실패해도 목록에서는 사라진
  상태를 유지한다.
