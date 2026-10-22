# Data Model: 대사 설정 화면

저장 형식은 005의 `lines.json`을 그대로 쓴다([005 contracts/lines-file.md](../005-speech-bubble-monologue/contracts/lines-file.md)). 새 저장 위치만 추가한다([contracts/storage.md](./contracts/storage.md)).

## LinesInput (편집 화면 → 검증)

`Record<Category, string[]>`. 각 값은 입력한 줄들(줄바꿈이 섞여 있어도 된다).

## 검증 규칙 (validateLinesInput)

처리 순서와 결과:

| 단계 | 규칙 | 결과 |
|---|---|---|
| 분할 | 줄바꿈(`\n`, `\r\n`)으로 문장을 나눈다 | — |
| 정리 | 앞뒤 공백 제거 | — |
| 빈 문장 | 공백만이면 제외 | `dropped` 개수에 합산(오류 아님) |
| 중복 | 같은 분류 안의 같은 문장은 하나로 합침 | `merged` 개수에 합산(오류 아님) |
| 길이 | 정리 후 1~`maxLength`(60)자. 초과하면 오류 | `issues`에 `too-long`(줄 번호, 글자 수) |
| 개수 | 분류당 최대 `maxPerCategory`(50) | 초과하면 `issues`에 `too-many`(현재 개수) |

`ok`는 `issues`가 비어 있을 때만 true이며, 이때 `lines`가 저장할 정규화된 `Lines`다. 오류가 있으면 저장하지 않는다.

## LinesView (메인 → 편집 화면)

| 필드 | 설명 |
|---|---|
| `lines` | 지금 저장된 대화셋(`Lines`) |
| `restore` | `'default'`(기본 캐릭터·샘플: 처음 문장으로 되돌리기) 또는 `'clear'`(등록 캐릭터: 모두 비우기) |
| `modified` | 처음 문장과 다른지(기본·샘플일 때만 의미, 되돌리기 버튼 활성 판단) |

## 상태 전이 (캐릭터별 대화셋)

```text
처음 상태(기본·샘플: 처음 문장 / 등록: 빈 목록)
  --저장(검증 통과)--> 편집본
편집본 --처음 문장으로 되돌리기(기본·샘플)--> 처음 상태
편집본 --모두 비우기(등록)--> 빈 목록(빈 편집본)
등록 캐릭터 삭제 --> 편집본도 함께 삭제
```
