# 계약: 메인 ↔ 렌더러 IPC (캐릭터 메뉴·설정)

채널 이름과 페이로드 타입은 `src/shared/ipc.ts`에 정의하고, preload의 `contextBridge`로만 노출한다.
001의 `character:update`는 그대로 유지한다.

## 오버레이 창

### 메인 → 오버레이: `character:appearance`

활성 캐릭터가 바뀌었을 때, 그리고 오버레이 창 로드가 끝났을 때 보낸다.

```ts
type Appearance = {
  walkUrl: string | null // data: URL. null이면 번들에 포함된 기본 걷기 이미지
  idleUrl: string | null // data: URL. null이면 번들에 포함된 기본 정지 이미지
  frames: number // 걷기 프레임 수 (기본 캐릭터는 8)
}
```

preload가 노출하는 `window.kakaru`에 `onAppearance(callback)`를 추가한다.

## 설정 창 (`window.kakaruSettings`)

모든 요청은 `ipcRenderer.invoke`이고 응답은 아래 형태다.

### `characters:list` → `ListResult`

```ts
type CharacterSummary = {
  id: string | null // null = 기본 캐릭터
  name: string
  frames: number
  frameSize: number
  idleUrl: string // 목록 썸네일용 data: URL
  builtin: boolean
  problem?: string // 이미지가 손상·누락된 경우 이유
}
type ListResult = {
  characters: CharacterSummary[] // 맨 위가 기본 캐릭터
  activeId: string | null
  notice?: string // 활성 캐릭터를 읽을 수 없어 기본으로 되돌린 경우 등
}
```

### `characters:validate` → `ValidationResult`

등록 전 입력 검사(저장하지 않음). 등록 버튼을 누르기 전에 이유를 보여 주는 데 쓴다.

```ts
type RegisterInput = {
  name: string
  frames: number
  walk: ArrayBuffer // 걷기 이미지 파일 내용
  idle: ArrayBuffer // 정지 이미지 파일 내용
}
type ValidationError = {
  code:
    | 'not-png' | 'too-large' | 'corrupt-image'
    | 'bad-frame-count' | 'bad-walk-size' | 'bad-idle-size'
    | 'not-transparent' | 'bad-name' | 'duplicate-name'
  target: 'walk' | 'idle' | 'name' | 'frames'
  message: string // 사용자에게 보여 줄 한국어 설명
}
type ValidationResult = { ok: true; frameSize: number } | { ok: false; errors: ValidationError[] }
```

### `characters:register` → `RegisterResult`

```ts
type RegisterResult = { ok: true; id: string } | { ok: false; errors: ValidationError[] }
```

검증을 통과하면 이미지를 복사·저장하고 목록에 추가한다. 활성 캐릭터는 바꾸지 않는다.

### `characters:apply` → `{ ok: true } | { ok: false; message: string }`

인자는 `id: string | null`(`null` = 기본 캐릭터로 되돌리기). 저장 후 모든 오버레이에
`character:appearance`를 보내고 `characters:changed`를 설정 창에 알린다.

### `characters:delete` → `{ ok: true } | { ok: false; message: string }`

인자는 `id: string`. 기본 캐릭터(`null`)는 거부한다. 활성 캐릭터를 지우면 기본으로 되돌린다.

### 메인 → 설정 창: `characters:changed`

목록이나 활성 캐릭터가 바뀌면 보낸다. 페이로드 없음, 받으면 `characters:list`를 다시 호출한다.

## 메뉴

우클릭 메뉴는 메인 프로세스 안에서만 처리한다(렌더러에 입력 채널을 추가하지 않는다).

```ts
// main/context-menu — OS별 구현을 감추지 않고, 테스트를 위해 팝업 동작만 주입한다
interface MenuPopup {
  popup(onClosed: () => void): void
}
interface UserControl {
  setUserControlled(active: boolean): void // simulation.ts의 기존 API
}
```
