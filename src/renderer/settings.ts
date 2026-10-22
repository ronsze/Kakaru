import { LIMITS } from '../shared/characters'
import { config } from '../shared/config'
import { DIALOGUE_CATEGORIES, validateLinesInput, type Category, type Lines } from '../shared/dialogue'
import type { CharacterSummary, KakaruSettingsApi, ListResult, ValidationError } from '../shared/ipc'
import defaultIdleUrl from './assets/idle.png'

declare global {
  interface Window {
    kakaruSettings: KakaruSettingsApi
  }
}

const SIZE = 100
const MIN_CYCLE_MS = 560
const FRAME_MS = 70
const MAX_MB = LIMITS.maxImageBytes / (1024 * 1024)

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T
const nameInput = $<HTMLInputElement>('name')
const framesInput = $<HTMLInputElement>('frames')
const walkInput = $<HTMLInputElement>('walk')
const idleInput = $<HTMLInputElement>('idle')
const registerButton = $<HTMLButtonElement>('register')
const statusEl = $<HTMLDivElement>('status')
const hintEl = $<HTMLParagraphElement>('hint')
const previewWalk = $<HTMLImageElement>('preview-walk')
const previewIdle = $<HTMLImageElement>('preview-idle')
const listEl = $<HTMLUListElement>('list')
const noticeEl = $<HTMLDivElement>('notice')

const api = window.kakaruSettings

// ───────── 오류 표시 ─────────

const targets = ['name', 'frames', 'walk', 'idle'] as const

function showErrors(errors: ValidationError[]): void {
  for (const t of targets) {
    $<HTMLDivElement>(`error-${t}`).textContent = errors
      .filter((e) => e.target === t)
      .map((e) => e.message)
      .join(' ')
  }
}

function setStatus(text: string, kind: '' | 'ok' | 'fail' = ''): void {
  statusEl.textContent = text
  statusEl.className = kind
}

// ───────── 미리보기 ─────────

let walkUrl: string | null = null
let idleUrl: string | null = null

function revoke(url: string | null): void {
  if (url) URL.revokeObjectURL(url)
}

/** 걷기 이미지의 프레임 수에 맞춰 미리보기 애니메이션을 조정한다 (오버레이와 같은 계산) */
function applyFrames(frames: number): void {
  const root = document.documentElement.style
  root.setProperty('--frames', String(frames))
  root.setProperty('--strip', `${frames * SIZE}px`)
  root.setProperty('--cycle', `${Math.max(MIN_CYCLE_MS, frames * FRAME_MS)}ms`)
}

function currentFrames(): number {
  const n = Number(framesInput.value)
  return Number.isInteger(n) && n >= LIMITS.minFrames && n <= LIMITS.maxFrames ? n : LIMITS.defaultFrames
}

function updatePreview(): void {
  revoke(walkUrl)
  revoke(idleUrl)
  const walkFile = walkInput.files?.[0]
  const idleFile = idleInput.files?.[0]
  walkUrl = walkFile ? URL.createObjectURL(walkFile) : null
  idleUrl = idleFile ? URL.createObjectURL(idleFile) : null
  previewWalk.hidden = !walkUrl
  previewIdle.hidden = !idleUrl
  if (walkUrl) previewWalk.src = walkUrl
  if (idleUrl) previewIdle.src = idleUrl
  applyFrames(currentFrames())
}

// ───────── 검증·등록 ─────────

let seq = 0
let timer: ReturnType<typeof setTimeout> | undefined
let valid = false

function tooLargeError(target: 'walk' | 'idle'): ValidationError {
  return { code: 'too-large', target, message: `파일이 너무 큽니다. ${MAX_MB}MB 이하여야 합니다.` }
}

async function revalidate(): Promise<void> {
  const mine = ++seq
  valid = false
  registerButton.disabled = true
  const walkFile = walkInput.files?.[0]
  const idleFile = idleInput.files?.[0]

  // 용량이 크면 파일을 읽지 않고 바로 안내한다
  const early: ValidationError[] = []
  if (walkFile && walkFile.size > LIMITS.maxImageBytes) early.push(tooLargeError('walk'))
  if (idleFile && idleFile.size > LIMITS.maxImageBytes) early.push(tooLargeError('idle'))
  if (early.length > 0) {
    showErrors(early)
    hintEl.hidden = true
    return
  }
  if (!walkFile || !idleFile) {
    showErrors([])
    hintEl.hidden = false
    return
  }
  hintEl.hidden = true

  const [walk, idle] = await Promise.all([walkFile.arrayBuffer(), idleFile.arrayBuffer()])
  const result = await api.validate({
    name: nameInput.value,
    frames: Number(framesInput.value),
    walk,
    idle
  })
  if (mine !== seq) return // 그 사이 입력이 바뀌었다
  if (result.ok) {
    showErrors([])
    valid = true
    registerButton.disabled = false
  } else {
    showErrors(result.errors)
  }
}

function scheduleValidate(): void {
  setStatus('')
  updatePreview()
  clearTimeout(timer)
  timer = setTimeout(() => void revalidate(), 150)
}

async function register(): Promise<void> {
  const walkFile = walkInput.files?.[0]
  const idleFile = idleInput.files?.[0]
  if (!valid || !walkFile || !idleFile) return
  registerButton.disabled = true
  try {
    const [walk, idle] = await Promise.all([walkFile.arrayBuffer(), idleFile.arrayBuffer()])
    const result = await api.register({
      name: nameInput.value,
      frames: Number(framesInput.value),
      walk,
      idle
    })
    if (result.ok) {
      const registered = nameInput.value.trim()
      nameInput.value = ''
      framesInput.value = String(LIMITS.defaultFrames)
      walkInput.value = ''
      idleInput.value = ''
      showErrors([])
      updatePreview()
      hintEl.hidden = false
      valid = false
      setStatus(`"${registered}" 캐릭터를 등록했습니다.`, 'ok')
      await refreshList()
    } else {
      showErrors(result.errors)
      setStatus('등록하지 못했습니다. 안내된 문제를 고쳐 주세요.', 'fail')
    }
  } catch (error) {
    registerButton.disabled = false
    setStatus(`등록 중 오류가 발생했습니다: ${error instanceof Error ? error.message : String(error)}`, 'fail')
  }
}

// ───────── 목록 ─────────

function renderItem(c: CharacterSummary, activeId: string | null): HTMLLIElement {
  const li = document.createElement('li')
  li.dataset.id = c.id ?? ''

  const img = document.createElement('img')
  img.alt = ''
  img.src = c.builtin ? defaultIdleUrl : c.idleUrl
  li.append(img)

  const main = document.createElement('div')
  main.className = 'item-main'
  const name = document.createElement('div')
  name.className = 'item-name'
  name.textContent = c.name
  if (c.builtin) {
    const badge = document.createElement('span')
    badge.className = 'badge default'
    badge.textContent = '기본'
    name.append(badge)
  }
  const active = c.id === activeId
  if (active) {
    const badge = document.createElement('span')
    badge.className = 'badge active'
    badge.textContent = '사용 중'
    name.append(badge)
  }
  const meta = document.createElement('div')
  meta.className = 'item-meta'
  meta.textContent = `걷기 ${c.frames}프레임 · ${c.frameSize}px`
  main.append(name, meta)
  if (c.problem) {
    const problem = document.createElement('div')
    problem.className = 'item-problem'
    problem.textContent = c.problem
    main.append(problem)
  }
  li.append(main)

  const actions = document.createElement('div')
  actions.className = 'actions'
  if (!active) {
    const apply = document.createElement('button')
    apply.type = 'button'
    apply.className = 'btn-apply'
    apply.textContent = c.builtin ? '기본으로 되돌리기' : '선택'
    apply.addEventListener('click', () => void applyCharacter(c))
    actions.append(apply)
  }
  const edit = document.createElement('button')
  edit.type = 'button'
  edit.className = 'btn-lines'
  edit.textContent = '대사 편집'
  edit.addEventListener('click', () => requestLeave(() => void openLines(c)))
  actions.append(edit)
  if (!c.builtin && c.id !== null) {
    const del = document.createElement('button')
    del.type = 'button'
    del.className = 'btn-delete'
    del.textContent = '삭제'
    del.addEventListener('click', () => void deleteCharacter(c))
    actions.append(del)
  }
  li.append(actions)
  return li
}

async function applyCharacter(c: CharacterSummary): Promise<void> {
  const result = await api.apply(c.id)
  if (result.ok) {
    setStatus(c.builtin ? '기본 캐릭터로 되돌렸습니다.' : `"${c.name}" 캐릭터를 적용했습니다.`, 'ok')
  } else {
    setStatus(result.message, 'fail')
  }
  await refreshList()
}

async function deleteCharacter(c: CharacterSummary): Promise<void> {
  if (c.id === null) return
  if (!window.confirm(`"${c.name}" 캐릭터를 삭제할까요? 되돌릴 수 없습니다.`)) return
  const result = await api.delete(c.id)
  if (result.ok) setStatus(`"${c.name}" 캐릭터를 삭제했습니다.`, 'ok')
  else setStatus(result.message, 'fail')
  await refreshList()
}

function renderList(result: ListResult): void {
  listEl.replaceChildren(...result.characters.map((c) => renderItem(c, result.activeId)))
  noticeEl.style.display = result.notice ? 'block' : 'none'
  noticeEl.textContent = result.notice ?? ''
  // 편집 중인 캐릭터가 삭제되었으면 더 저장할 수 없다 (FR-011)
  if (editing && editing.id !== null && !result.characters.some((c) => c.id === editing!.id)) {
    editing.gone = true
    refreshLinesUi()
  }
}

async function refreshList(): Promise<void> {
  renderList(await api.list())
}

// ───────── 대사 편집 ─────────

const registerSection = $<HTMLElement>('register-section')
const linesPanel = $<HTMLElement>('lines-panel')
const linesTitle = $<HTMLElement>('lines-title')
const linesSave = $<HTMLButtonElement>('lines-save')
const linesRestore = $<HTMLButtonElement>('lines-restore')
const linesClose = $<HTMLButtonElement>('lines-close')
const linesStatus = $<HTMLDivElement>('lines-status')
const unsavedBar = $<HTMLElement>('lines-unsaved')
const goneEl = $<HTMLElement>('lines-gone')

const areas = Object.fromEntries(
  DIALOGUE_CATEGORIES.map((c) => [c, $<HTMLTextAreaElement>(`lines-${c}`)])
) as Record<Category, HTMLTextAreaElement>

/** 편집 중인 캐릭터와 마지막으로 저장한(또는 불러온) 대화셋 */
type Editing = { id: string | null; name: string; saved: Lines; restore: 'default' | 'clear'; modified: boolean; gone: boolean }
let editing: Editing | null = null
let pendingLeave: (() => void) | null = null

function setLinesStatus(text: string, kind: '' | 'ok' | 'fail' = ''): void {
  linesStatus.textContent = text
  linesStatus.className = kind
}

function readInput(): Record<Category, string[]> {
  return Object.fromEntries(DIALOGUE_CATEGORIES.map((c) => [c, [areas[c].value]])) as Record<Category, string[]>
}

function fillAreas(lines: Lines): void {
  for (const c of DIALOGUE_CATEGORIES) areas[c].value = lines[c].join('\n')
}

/** 입력이 마지막 저장본과 다른지. 규칙을 어긴 입력은 항상 변경으로 본다 */
function isDirty(): boolean {
  if (!editing) return false
  const v = validateLinesInput(readInput())
  return !v.ok || JSON.stringify(v.lines) !== JSON.stringify(editing.saved)
}

/** 검증 결과(개수·오류)와 버튼 상태를 화면에 반영한다 */
function refreshLinesUi(): void {
  if (!editing) return
  const v = validateLinesInput(readInput())
  for (const c of DIALOGUE_CATEGORIES) {
    const count = $<HTMLElement>(`count-${c}`)
    count.textContent = `${v.lines[c].length}/${config.speech.maxPerCategory}`
    count.classList.toggle('over', v.lines[c].length > config.speech.maxPerCategory)
    const list = $<HTMLUListElement>(`errors-${c}`)
    const issues = v.issues.filter((i) => i.category === c)
    list.replaceChildren(
      ...issues.map((i) => {
        const li = document.createElement('li')
        li.textContent = i.message
        return li
      })
    )
    areas[c].classList.toggle('invalid', issues.length > 0)
  }
  goneEl.hidden = !editing.gone
  linesSave.disabled = !(v.ok && isDirty()) || editing.gone
  linesRestore.textContent = editing.restore === 'default' ? '처음 문장으로 되돌리기' : '모두 비우기'
  linesRestore.disabled = !editing.modified || editing.gone
}

function showRegister(): void {
  editing = null
  pendingLeave = null
  unsavedBar.hidden = true
  linesPanel.hidden = true
  registerSection.hidden = false
}

/** 미저장 변경이 있으면 막대로 확인을 받고, 없으면 바로 진행한다 (FR-007) */
function requestLeave(next: () => void): void {
  if (!editing || !isDirty()) {
    next()
    return
  }
  pendingLeave = next
  unsavedBar.hidden = false
}

async function openLines(c: CharacterSummary): Promise<void> {
  const result = await api.getLines(c.id)
  if (!result.ok) {
    setStatus(result.message, 'fail')
    return
  }
  editing = { id: c.id, name: c.name, saved: result.view.lines, restore: result.view.restore, modified: result.view.modified, gone: false }
  linesTitle.textContent = `"${c.name}" 대사 편집`
  fillAreas(result.view.lines)
  setLinesStatus('')
  unsavedBar.hidden = true
  registerSection.hidden = true
  linesPanel.hidden = false
  refreshLinesUi()
}

/** 저장한다. 성공하면 true */
async function saveLines(): Promise<boolean> {
  if (!editing) return false
  const target = editing
  const result = await api.saveLines(target.id, readInput())
  if (!result.ok) {
    if ('issues' in result) {
      setLinesStatus('규칙에 맞지 않는 문장이 있어 저장하지 못했습니다.', 'fail')
      refreshLinesUi()
    } else {
      setLinesStatus(result.message, 'fail')
    }
    return false
  }
  target.saved = result.lines
  fillAreas(result.lines)
  const notes = [
    result.dropped > 0 ? `빈 줄 ${result.dropped}개를 정리했습니다.` : '',
    result.merged > 0 ? `중복 문장 ${result.merged}개를 합쳤습니다.` : ''
  ].filter(Boolean)
  setLinesStatus(['저장했습니다.', ...notes].join(' '), 'ok')
  const view = await api.getLines(target.id)
  if (view.ok) {
    target.modified = view.view.modified
    target.restore = view.view.restore
  }
  refreshLinesUi()
  return true
}

async function restoreLines(): Promise<void> {
  if (!editing) return
  const label = editing.restore === 'default' ? '처음 문장으로 되돌릴까요?' : '모든 문장을 비울까요?'
  if (!window.confirm(`"${editing.name}": ${label} 지금까지 저장한 문장은 사라집니다.`)) return
  const target = editing
  const result = await api.restoreLines(target.id)
  if (!result.ok) {
    setLinesStatus(result.message, 'fail')
    return
  }
  target.saved = result.lines
  fillAreas(result.lines)
  const view = await api.getLines(target.id)
  if (view.ok) target.modified = view.view.modified
  setLinesStatus(target.restore === 'default' ? '처음 문장으로 되돌렸습니다.' : '모든 문장을 비웠습니다.', 'ok')
  refreshLinesUi()
}

for (const c of DIALOGUE_CATEGORIES) areas[c].addEventListener('input', () => {
  setLinesStatus('')
  refreshLinesUi()
})
linesSave.addEventListener('click', () => void saveLines())
linesRestore.addEventListener('click', () => void restoreLines())
linesClose.addEventListener('click', () => requestLeave(showRegister))
$<HTMLButtonElement>('unsaved-save').addEventListener('click', () => {
  const next = pendingLeave
  void saveLines().then((ok) => {
    if (ok && next) {
      unsavedBar.hidden = true
      pendingLeave = null
      next()
    }
  })
})
$<HTMLButtonElement>('unsaved-discard').addEventListener('click', () => {
  const next = pendingLeave
  unsavedBar.hidden = true
  pendingLeave = null
  // 버리기: 입력을 마지막 저장본으로 돌려 변경이 없는 상태로 만든 뒤 진행한다
  if (editing) fillAreas(editing.saved)
  next?.()
})
$<HTMLButtonElement>('unsaved-keep').addEventListener('click', () => {
  unsavedBar.hidden = true
  pendingLeave = null
})

// ───────── 시작 ─────────

for (const el of [nameInput, framesInput]) el.addEventListener('input', scheduleValidate)
for (const el of [walkInput, idleInput]) el.addEventListener('change', scheduleValidate)
registerButton.addEventListener('click', () => void register())
api.onChanged(() => void refreshList())
applyFrames(LIMITS.defaultFrames)
void refreshList()
