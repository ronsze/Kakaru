# Research: 캐릭터 드래그로 옮기기

## R1. 잡기 감지: 렌더러 이벤트 vs 메인 폴링

- **Decision**: 누름/뗌만 렌더러가 IPC로 알리고(`grab-start`/`grab-end`), 위치 추적은 메인이 매 틱 `screen.getCursorScreenPoint()`로 한다.
- **Rationale**: 메인은 이미 히트 테스트용으로 커서를 폴링한다. mousemove를 IPC로 보내지 않아 채널이 단순하고, 창 경계·디스플레이 경계와 무관하게 좌표가 전역으로 일관된다. 누름/뗌은 OS 버튼 상태를 메인에서 알 방법이 없어 렌더러 이벤트가 필요하다.
- **Alternatives**: 렌더러가 mousemove를 전부 전송(IPC 폭증, 창 간 좌표 변환 필요) / 네이티브 전역 마우스 훅(의존성·권한 추가, 헌장 IV 위배).

## R2. 입력 수신 조건

- **Decision**: 기존 히트 테스트가 커서가 캐릭터 위일 때만 창의 클릭 통과를 풀므로 mousedown은 캐릭터 위에서만 온다. 잡은 동안은 `UserControlled`라 `HitTester`가 창을 계속 풀어 둔다(커서가 히트 영역을 벗어나도 mouseup을 받음, FR-008). 렌더러는 mousedown에서 `setPointerCapture`를 건다.
- **Rationale**: 001에서 이미 "UserControlled 중 창 해제"가 구현돼 있어 추가 변경이 없다.
- **Alternatives**: 잡은 동안 모든 디스플레이 창을 해제(불필요하게 침습적).

## R3. 잡기 시작 시점과 움직임 없는 클릭

- **Decision**: mousedown 즉시 잡기를 시작하되 잡은 순간의 오프셋(캐릭터 위치 − 커서)을 저장하고, 위치는 `커서 + 오프셋`으로 설정한다. 움직임이 없으면 위치가 그대로라 FR-006을 자연히 만족한다. 시작 즉시 정지하므로 SC-001도 만족한다.
- **Rationale**: 이동 임계값(데드존)을 두면 정지가 늦고 코드가 늘어난다.
- **Alternatives**: 일정 픽셀 이상 움직여야 시작(정지 지연, 단순 클릭 시 걷기가 끊기지 않는 이점뿐).

## R4. 왼쪽 버튼만, Ctrl+클릭 제외

- **Decision**: `button === 0 && !ctrlKey`일 때만 잡는다. macOS의 Ctrl+클릭은 우클릭 메뉴로 취급되므로 제외한다.
- **Rationale**: 메뉴와 드래그 동시 발생 방지(FR-009).

## R5. 메뉴와 드래그의 상호 배제

- **Decision**: 둘 다 `setUserControlled`를 쓰지만 서로 상태를 모르므로, 잡는 중이면 메뉴를 열지 않고(`ContextMenuController`에 차단 포트), 메뉴가 열려 있으면 잡기를 시작하지 않는다(`DragController.start`가 거부). 참조 횟수 계산은 하지 않는다.
- **Rationale**: 상호 배제면 충분하고 더 단순하다.

## R6. 위치 제한

- **Decision**: 목표 `= 커서 + 오프셋`을 `WalkableArea.clamp`로 가장 가까운 디스플레이 영역에 맞춘다. 커서가 다른 디스플레이로 넘어가면 그 디스플레이로 넘어간다.
- **Rationale**: 기존 메서드 재사용. 확대 시 일부가 가장자리 밖에 걸치는 것은 001·003의 기존 한계와 동일하다(범위 밖).

## R7. 렌더러 위치 반영

- **Decision**: 드래그 중에는 틱마다 `UserControlled` 상태의 위치를 force broadcast하고, 렌더러는 `state === 'UserControlled'`일 때 속도 0이라 기존 `move()`가 transition 없이 즉시 배치한다. 단, 지금 렌더러는 `UserControlled`를 idle 모습으로 처리하므로 별도 변경이 없다.
- **Rationale**: 단일 창에 60Hz IPC는 가볍고, 걷기 애니메이션 CSS 구조를 건드리지 않는다. 변화가 없는 틱은 보내지 않는다(위치가 같으면 생략).
- **Alternatives**: 렌더러가 로컬 mousemove로 즉시 따라가고 메인은 뒤따라 확정(체감 지연은 줄지만 두 좌표계가 어긋날 위험). 지연이 눈에 띄면 후속으로 검토한다.

## R8. 비정상 해제 (FR-010)

- **Decision**: 아래 중 하나가 일어나면 `end()`를 호출한다: 렌더러의 `mouseup`/`pointercancel`/`lostpointercapture`/`blur`, 디스플레이 구성 변경, `powerMonitor resume`. `end()`는 멱등이다.
- **Rationale**: 메인은 버튼 상태를 알 수 없어 이벤트 기반 해제가 유일하다.
- **Risk**: 포인터 캡처가 창 밖 mouseup을 못 받는 OS 동작이 있으면 잡힌 채 남을 수 있다 → 수동 검증 항목(quickstart)으로 확인하고, 필요하면 후속으로 최대 잡기 시간 안전장치를 검토한다.

## R9. 헌장·문서의 "롱프레스" 표기

- **Decision**: 헌장 Principle II·V의 표기를 "드래그 이동"으로 PATCH 개정하고, `ROADMAP.md`, 001 `contracts/ipc.md`의 예고 채널 설명도 정정한다. 채널 이름(`character:grab-start`/`grab-end`)은 예고된 그대로 쓴다.
