import { LIMITS } from '../shared/characters'
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

function renderItem(c: CharacterSummary): HTMLLIElement {
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
    badge.className = 'badge'
    badge.textContent = '기본'
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
  return li
}

function renderList(result: ListResult): void {
  listEl.replaceChildren(...result.characters.map(renderItem))
  noticeEl.style.display = result.notice ? 'block' : 'none'
  noticeEl.textContent = result.notice ?? ''
}

async function refreshList(): Promise<void> {
  renderList(await api.list())
}

// ───────── 시작 ─────────

for (const el of [nameInput, framesInput]) el.addEventListener('input', scheduleValidate)
for (const el of [walkInput, idleInput]) el.addEventListener('change', scheduleValidate)
registerButton.addEventListener('click', () => void register())
api.onChanged(() => void refreshList())
applyFrames(LIMITS.defaultFrames)
void refreshList()
