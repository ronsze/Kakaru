# Data Model: 캐릭터 내보내기·가져오기

저장 데이터(`settings.json`, `characters/<id>/…`)의 형식은 **바뀌지 않는다**. 이 기능은 새 저장 필드를 만들지 않는다.

## CharacterPackage (`.kakaru` 파일 내용)

| 필드 | 형식 | 규칙 |
|---|---|---|
| `format` | 문자열 | 정확히 `"kakaru-character"` |
| `version` | 정수 | 현재 `1`. 1보다 크면 "지원하지 않는 버전", 그 외 값은 형식 오류 |
| `name` | 문자열 | 앞뒤 공백 제거 후 1~30자, `"기본"` 불가 (가져올 때 검증) |
| `frames` | 정수 | 2~32 |
| `walk` | 문자열(base64) | PNG. 디코딩 후 5MB 이하 |
| `idle` | 문자열(base64) | PNG. 디코딩 후 5MB 이하 |
| `lines` | 객체 | 분류 키 `greeting`·`normal`·`grabbed`·`struggling`, 값은 문자열 배열. 없는 분류는 빈 목록으로 본다. 알 수 없는 키는 무시한다 |

- `frameSize`는 담지 않는다. 가져올 때 걷기 이미지의 높이에서 다시 계산한다(`validateRegistration`).
- 담지 않는 것: `id`, `createdAt`, 활성 여부, 경로 (FR-002).
- 파일 안의 알 수 없는 최상위 키는 무시한다.

## 가져오기로 만들어지는 CharacterSet

기존 `CharacterSet`(`id`, `name`, `frames`, `frameSize`, `createdAt`)과 같다.

| 필드 | 값 |
|---|---|
| `id` | 새로 발급(`randomBytes(6).toString('hex')`, 기존 `makeId`) |
| `name` | 파일의 이름. 겹치면 `이름 (n)` |
| `frames` | 파일 값 |
| `frameSize` | 걷기 이미지 높이 |
| `createdAt` | 가져온 시각 |

폴더에는 `walk.png`, `idle.png`, `lines.json`(`{"version":1,"lines":{…}}`, 기존 형식)이 생긴다. 대사가 모두 비어 있어도 `lines.json`을 쓴다.

## 오류 분류 (사용자에게 보이는 단위)

| 코드 | 상황 | 메시지 방향 |
|---|---|---|
| `too-large` | 파일이 16MB 초과 | 파일이 너무 크다 |
| `not-package` | JSON이 아님 / `format` 불일치 | 캐릭터 파일이 아니거나 손상됐다 |
| `unsupported-version` | `version > 1` | 이 앱이 지원하지 않는 버전이다. 앱을 업데이트하라 |
| `bad-field` | 필수 필드 누락·형식 오류 | 캐릭터 파일이 손상됐다 |
| `bad-base64` | base64가 아님 | 이미지 데이터가 손상됐다 |
| (기존) `ValidationErrorCode` | 이미지·이름·프레임 규칙 위반 | 이미지 등록 때와 같은 문구 |
| (기존) `LinesIssue` | 대사 규칙 위반 | 분류 이름과 함께 기존 문구 |

## 상태 전이

없음. 내보내기는 읽기 전용이고, 가져오기는 "없음 → 등록됨" 한 방향이다. 실패하면 "없음"으로 남는다.
