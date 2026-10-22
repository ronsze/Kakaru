# Data Model: 캐릭터 드래그로 옮기기

저장되는 데이터는 없다. 메모리 상태만 추가한다.

## 잡기 상태 (DragController 내부)

| 필드 | 설명 |
|---|---|
| `active` | 잡혀 있는지 |
| `offset` | 잡은 순간의 `캐릭터 위치 − 커서` (가상 데스크탑 좌표, DIP) |

## 상태 전이

```text
(자율) --start(): 메뉴가 닫혀 있고 active=false--> 잡힘(UserControlled, offset 저장)
잡힘 --update() 매 틱--> 위치 = clamp(커서 + offset)
잡힘 --end()--> Idle (놓은 위치에서 001의 Idle 규칙으로 재개)
```

- `start()`는 메뉴가 열려 있거나 이미 잡혀 있으면 무시한다.
- `end()`는 잡혀 있지 않으면 아무 일도 하지 않는다(멱등).
- 캐릭터 `Character.state`는 기존 `UserControlled`를 쓰며 새 상태는 없다.
