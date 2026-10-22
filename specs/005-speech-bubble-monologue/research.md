# Research: 말풍선과 혼잣말

## R1. 누가 언제 말할지: 메인의 Speaker

- **Decision**: 시뮬레이션 틱에서 `Speaker.update(now, ctx)`가 혼잣말 시점을 판정하고, 잡기 이벤트는 `say(category)`로 즉시 발화한다. `Speaker`는 shared의 순수 클래스이며 난수와 문장 공급자를 주입받는다.
- **Rationale**: 시계는 시뮬레이션 `clock`이 이미 있고, 메뉴 열림·잡기 상태가 메인에 있다. 렌더러에 타이머를 두면 두 곳의 상태가 어긋난다.
- **Alternatives**: 렌더러가 타이머로 말함(메뉴 열림·캐릭터 변경 상태를 모름).

## R2. 렌더러로 전달: 새 채널 없이 `character:update.speech`

- **Decision**: `CharacterUpdate`에 `speech: { id, text, remainingMs } | null`을 추가한다. 말을 시작·종료할 때 force broadcast하고, 이후 업데이트(위치 보정 등)에도 현재 값이 실려 간다. 렌더러는 `id`가 바뀔 때만 숨김 타이머(`remainingMs`)를 새로 건다.
- **Rationale**: 캐릭터가 다른 모니터로 가면 새 창이 업데이트를 받으며 남은 시간만큼 말풍선을 이어서 보여 줄 수 있다. 채널이 늘지 않는다(헌장 IV).
- **Alternatives**: `character:speech` 별도 채널(모니터 이동 때 상태 전달이 별도로 필요).

## R3. 말풍선이 캐릭터를 따라가게

- **Decision**: 말풍선 요소를 `#actor` 안(`#sprite` 형제)에 둔다. `#actor`가 CSS transition으로 움직이므로 말풍선도 같은 compositor 경로로 따라간다. 크기 배율은 `--scale`로 말풍선 아래 가장자리를 스프라이트 위쪽에 맞춘다. 스프라이트의 좌우 반전은 `#sprite`에만 걸려 있어 글자가 뒤집히지 않는다.
- **Rationale**: 프레임마다 JS가 필요 없다(CLAUDE.md 함정: 캔버스/JS 루프 금지).

## R4. 화면 가장자리 보정

- **Decision**: 말풍선이 보이는 동안 렌더러가 업데이트를 받을 때마다 창 로컬 좌표 `(x, y)`로 말풍선 가로 위치를 창 안으로 밀고, 위쪽이 모자라면 캐릭터 아래에 표시한다. 걷는 중 오차가 쌓이지 않도록 말풍선이 떠 있는 동안 위치 보정 주기를 1000ms에서 250ms로 줄인다.
- **Rationale**: 걷는 거리(80px/s)가 8초면 640px이라 처음 한 번만 보정하면 잘릴 수 있다. 타이머/rAF 루프 대신 이미 오는 업데이트를 이용한다.
- **Alternatives**: rAF로 매 프레임 보정(CPU 증가).

## R5. 문장 저장: 캐릭터 폴더의 lines.json

- **Decision**: 기본 캐릭터는 `shared/dialogue.ts`의 상수, 등록 캐릭터는 `characters/<id>/lines.json`(선택). 형식은 `contracts/lines-file.md`. 읽을 때마다 `sanitizeLines`가 정리한다: 문자열만 남기고 앞뒤 공백 제거, 빈 문장 제외, 문장 최대 60자(넘으면 잘라 내지 않고 제외), 분류당 최대 50개, 파싱 실패·알 수 없는 분류는 무시. 파일이 없으면 모든 분류가 빈 목록이다(기본 문장으로 대체하지 않는다, FR-013).
- **Rationale**: `settings.json`을 바꾸면 스키마 버전 문제가 생긴다. 파일이 없으면 비어 있다는 규칙이 "사용자 등록 캐릭터는 말하지 않는다"와 일치한다. 나중에 파일 편집이나 설정 창 편집을 얹기 쉽다.
- **Alternatives**: `settings.json`에 문장 포함(설정 파일 비대, 스키마 마이그레이션 필요).

## R6. 샘플 캐릭터 문장과 기존 설치

- **Decision**: 샘플의 문장은 `resources/characters/bmm/lines.json`에 두고, 새로 설치될 때 캐릭터 폴더로 복사한다. 005 이전에 이미 설치한 "빨간 모자"(설치 키 `bmm` 기록, `lines.json` 없음)는 앱 시작 시 같은 이름의 캐릭터 폴더에 `lines.json`이 없으면 복사해 채운다.
- **Rationale**: `seeded`에 키만 있고 id가 없어 이름으로 찾아야 한다. 같은 이름을 사용자가 직접 등록한 경우를 구분할 수 없는 점은 알려진 한계다(이름은 중복 등록할 수 없고, 샘플을 지웠다 같은 이름으로 등록하면 샘플 문장을 받을 수 있다).

## R7. 시간 값

- **Decision**: `config.speech = { intervalMs: {min: 20000, max: 40000}, displayMs: {min: 3000, max: 8000}, perCharMs: 150, baseMs: 2000, maxLength: 60, maxPerCategory: 50 }`. 표시 시간은 `clamp(baseMs + perCharMs × 글자수, min, max)`. 첫 혼잣말은 시작 후 한 간격이 지난 뒤. `config.struggleAfterMs = 5000`을 만들어 렌더러의 발버둥 시작과 "오래 잡혔을 때" 발화가 같은 값을 쓴다.
- **Rationale**: 직접 써 보며 조정하는 값이라 한 곳(config)에 모은다. 003과 같은 방식이다.

## R8. 발화 억제와 교체

- **Decision**: 메뉴가 열려 있으면 혼잣말 시점을 건너뛰고 다음 간격을 다시 잡는다. 잡는 중에는 평소 혼잣말을 하지 않는다. 새 발화는 현재 말풍선을 교체한다(`id` 증가). 활성 캐릭터가 바뀌어도 떠 있는 말풍선은 그대로 만료되고, 이후 선택부터 새 캐릭터 문장을 쓴다.
- **Rationale**: 단순한 규칙이 spec의 FR-004, FR-011, FR-012와 일치한다.

## R9. 직전 문장 반복 방지

- **Decision**: 분류별로 마지막에 말한 문장을 기억하고, 후보가 둘 이상이면 그 문장을 제외하고 고른다.
- **Rationale**: FR-006. 분류별로 따로 기억해 다른 분류에 영향을 주지 않는다.
