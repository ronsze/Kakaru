import { performance } from 'node:perf_hooks'
import { powerMonitor, screen } from 'electron'
import { WalkableArea } from '../shared/area'
import { MovementEngine } from '../shared/behavior'
import { config } from '../shared/config'
import { CHANNEL_CHARACTER_UPDATE, type CharacterUpdate } from '../shared/ipc'
import type { Character } from '../shared/types'
import type { OverlayManager } from './overlay'

const MAX_DT_SECONDS = 0.1

export type SimulationSnapshot = {
  character: Character
  area: WalkableArea
  /** area.displays와 같은 순서의 디스플레이 id */
  displayIds: number[]
}

let engine: MovementEngine
let area: WalkableArea
let displayIds: number[] = []
let overlays: OverlayManager
let timer: NodeJS.Timeout | undefined
let lastTime = 0
let clock = 0
const lastVisible = new Map<number, boolean>()

function buildArea(): void {
  const displays = screen.getAllDisplays()
  displayIds = displays.map((d) => d.id)
  area = new WalkableArea(displays.map((d) => d.bounds))
}

/** 디스플레이 구성이 바뀌면 오버레이 창과 이동 가능 영역을 다시 만든다 (FR-008) */
function onDisplaysChanged(): void {
  overlays.sync()
  buildArea()
  engine.setWalkableArea(area)
}

function broadcast(character: Character): void {
  const index = area.displayAt(character.position)
  const rect = index === null ? null : area.displays[index]
  for (const [id, win] of overlays.all()) {
    if (win.isDestroyed()) continue
    const visible = index !== null && displayIds[index] === id
    const wasVisible = lastVisible.get(id)
    if (!visible && wasVisible === false) continue
    lastVisible.set(id, visible)
    const update: CharacterUpdate = {
      visible,
      x: visible && rect ? character.position.x - rect.x : 0,
      y: visible && rect ? character.position.y - rect.y : 0,
      heading: character.heading,
      state: character.state
    }
    win.webContents.send(CHANNEL_CHARACTER_UPDATE, update)
  }
}

function tick(): void {
  const t = performance.now()
  const dt = Math.min((t - lastTime) / 1000, MAX_DT_SECONDS)
  lastTime = t
  clock += dt * 1000
  broadcast(engine.tick(clock, dt))
}

export function startSimulation(manager: OverlayManager): void {
  overlays = manager
  buildArea()
  engine = new MovementEngine({ area, random: Math.random, startAt: 0 })

  screen.on('display-added', onDisplaysChanged)
  screen.on('display-removed', onDisplaysChanged)
  screen.on('display-metrics-changed', onDisplaysChanged)
  // 절전 복귀 후 큰 시간 점프로 캐릭터가 튀지 않게 기준 시각을 초기화한다
  powerMonitor.on('resume', () => {
    lastTime = performance.now()
  })

  lastTime = performance.now()
  timer = setInterval(tick, 1000 / config.tickHz)
}

export function stopSimulation(): void {
  if (timer) clearInterval(timer)
  timer = undefined
}

/**
 * 사용자 조작(롱프레스·우클릭 메뉴) 시작/종료를 엔진에 즉시 반영한다.
 * 렌더러 입력 IPC 채널은 해당 기능에서 추가하며, 지금은 내부 API로만 제공한다.
 */
export function setUserControlled(active: boolean): void {
  engine.setUserControlled(active, clock)
  broadcast(engine.getCharacter())
}

/** 히트 테스트가 쓰는 현재 캐릭터·이동 가능 영역 */
export function getCharacter(): SimulationSnapshot {
  return { character: engine.getCharacter(), area, displayIds }
}
