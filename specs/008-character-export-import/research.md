# Research: 캐릭터 내보내기·가져오기

## R1. 파일 형식

- **Decision**: UTF-8 JSON 한 파일, 확장자 `.kakaru`. 이미지는 base64 문자열로 담는다. 최상위에 `format`·`version`을 둔다.
- **Rationale**: 새 의존성 없이 구현된다(FR-010). 사람이 열어 확인할 수 있고, 기존 `lines.json`·`settings.json`과 같은 JSON+`version` 관례를 따른다. 200px 이미지 기준 크기 부담이 작다.
- **Alternatives**: zip(압축 라이브러리 필요 → 헌장 IV), 폴더(옮기기 불편), 바이너리 자체 포맷(확인·디버깅 어려움, 이득 없음).

## R2. 파일 입출력 위치

- **Decision**: 대화상자(`dialog.showSaveDialog`/`showOpenDialog`)와 파일 읽기·쓰기는 메인 IPC 핸들러에서만 한다. 렌더러는 캐릭터 id만 보내고(내보내기), 아무것도 보내지 않는다(가져오기).
- **Rationale**: 렌더러를 신뢰하지 않는 기존 방침(`assertRegisterInput`)과 같다. 경로·파일 내용이 렌더러를 거치지 않아 위조·경로 조작 여지가 없고, 5MB급 ArrayBuffer를 IPC로 오가지 않는다.
- **Alternatives**: 렌더러가 `<input type=file>`로 읽어 내용을 보냄(가져오기는 가능하나 내보내기 저장 대화상자가 없다. 두 기능의 방식이 달라진다).

## R3. 가져오기 검증 재사용

- **Decision**: 이미지·이름·프레임은 `validateRegistration`(existingNames는 빈 배열), 대사는 `validateLinesInput`을 그대로 쓴다. 대사는 `sanitizeLines`(조용히 버림)가 아니라 `validateLinesInput`(위반 보고)을 쓴다.
- **Rationale**: 스펙은 위반 시 거부하고 이유를 보여 주길 요구한다(FR-006, FR-007). `sanitizeLines`는 문장을 말없이 잘라 데이터를 바꾼다. 같은 검증을 쓰면 등록 화면·대사 설정과 규칙이 어긋나지 않는다. 같은 분류 안의 중복 문장은 `validateLinesInput`이 합친다(대사 설정과 같은 동작).
- **Alternatives**: 가져오기용 별도 검증(규칙 중복, 어긋날 위험).

## R4. 이름 겹침

- **Decision**: 가져온 이름이 목록에 이미 있으면(대소문자 무시, 기존 규칙과 같음) `이름 (2)`, `이름 (3)`…으로 비어 있는 첫 번호를 붙인다. 붙여서 30자를 넘으면 원래 이름의 앞부분을 잘라 맞춘다. 빈 이름·30자 초과·"기본"은 거부한다.
- **Rationale**: 기존 등록 규칙은 이름 중복을 막는다(`duplicate-name`). 같은 파일을 두 번 가져오는 정상 흐름(스펙 SC-004)이 거부로 끝나면 안 된다. 또 샘플 판별(`sampleOf`)이 이름 기준이라 같은 이름이 둘이면 가져온 캐릭터가 샘플로 오인된다.
- **Alternatives**: 같은 이름 허용(샘플 오인·목록 혼동), 거부(재가져오기 불가), 사용자에게 이름 입력을 다시 받기(대화상자 추가, 단순성 위배).

## R5. 원자성

- **Decision**: `CharacterStore.add()`에 선택 인자 `lines`를 더해 이미지와 같은 `try` 안에서 `lines.json`을 쓴다. 실패하면 기존 롤백(폴더 삭제)이 그대로 동작한다.
- **Rationale**: 이미지 등록 뒤 대사를 따로 쓰면 그 사이 실패 시 "이미지만 있는 캐릭터"가 남는다(FR-009 위반). 저장 순서(폴더 → 이미지 → lines → settings.json)를 유지한다.
- **Alternatives**: 등록 후 `writeLines` 호출(실패 시 정리 필요), 임시 폴더에 만든 뒤 이름 변경(기존 방식과 달라짐).

## R6. 크기 상한

- **Decision**: 파일 16MB 상한(`LIMITS.maxPackageBytes`). 열기 전에 `stat`으로 확인한다. 디코딩한 이미지는 기존 5MB 상한을 그대로 적용한다.
- **Rationale**: 이미지 2장(각 5MB)의 base64는 약 14MB다. 임의 큰 파일을 메모리에 올리지 않기 위한 방어선이다.

## R7. 파일 이름·확장자

- **Decision**: 저장 대화상자의 기본 이름은 `<캐릭터 이름>.kakaru`. 이름에서 `\ / : * ? " < > |`와 제어 문자는 `_`로 바꾸고, 앞뒤 공백·마침표를 지우며, 비면 `character`를 쓴다. 열기 대화상자는 `.kakaru` 필터를 쓰되 다른 파일도 고를 수 있다(내용으로 판별).
- **Rationale**: 확장자는 편의일 뿐 판별은 내용(`format` 필드)이 한다. 필터에서 막으면 메신저가 확장자를 바꾼 경우 가져올 수 없다.

## R8. 테스트에서 대화상자

- **Decision**: E2E는 `electronApp.evaluate`로 `dialog.showSaveDialog`·`showOpenDialog`를 스텁한다. 앱 코드에 테스트 전용 분기를 넣지 않는다.
- **Rationale**: 네이티브 대화상자는 Playwright가 조작할 수 없다. 스텁은 앱 코드를 바꾸지 않고 경로만 지정한다. 대화상자 자체의 동작(취소 포함 실제 UI)은 수동 검증으로 남긴다.
