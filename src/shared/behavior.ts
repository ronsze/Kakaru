import { WalkableArea } from './area'
import { config } from './config'
import type { Character, Heading, Point } from './types'

export type MovementEngineOptions = {
  area: WalkableArea
  /** 시드 가능한 난수원. [0, 1) */
  random: () => number
  /** 시뮬레이션 시작 시각 (ms) */
  startAt: number
}

const CANDIDATES = 10
const LENGTH_SCALES = [1, 0.5, 0.25]

/**
 * 캐릭터 행동 상태 머신. Electron에 의존하지 않는 순수 로직이다.
 * 시각은 tick(now, dt)의 인자로만 받는다 (now: ms, dt: 초).
 */
export class MovementEngine {
  private area: WalkableArea
  private readonly random: () => number
  private character: Character
  private lastDirection: Heading = 1

  constructor(options: MovementEngineOptions) {
    this.area = options.area
    this.random = options.random
    const start = this.area.clamp(this.areaCenter())
    this.character = {
      position: start,
      heading: 1,
      velocity: { x: 0, y: 0 },
      state: 'Idle',
      target: null,
      stateUntil: options.startAt + this.range(config.idleDurationMs),
      hitRadius: config.hitRadius
    }
  }

  getCharacter(): Character {
    return this.character
  }

  setWalkableArea(area: WalkableArea): void {
    this.area = area
    const c = this.character
    c.position = area.clamp(c.position)
    if (c.state === 'Walking' && (!c.target || !area.containsSegment(c.position, c.target))) {
      this.toIdle(c.stateUntil)
    }
  }

  /**
   * 사용자 조작(롱프레스 잡기·우클릭 메뉴) 시작/종료를 알린다 (FR-006).
   * 시작하면 즉시 정지하고, 종료하면 현재 위치에서 Idle로 재개한다.
   */
  setUserControlled(active: boolean, now: number): void {
    const c = this.character
    if (active) {
      c.state = 'UserControlled'
      c.target = null
      c.velocity = { x: 0, y: 0 }
    } else if (c.state === 'UserControlled') {
      this.toIdle(now)
    }
  }

  tick(now: number, dt: number): Character {
    const c = this.character
    if (c.state === 'Walking') {
      this.stepWalking(now, dt)
    } else if (c.state === 'Idle' && now >= c.stateUntil) {
      this.startWalking(now)
    }
    return c
  }

  private stepWalking(now: number, dt: number): void {
    const c = this.character
    const target = c.target
    if (!target) return this.toIdle(now)
    const dx = target.x - c.position.x
    const dy = target.y - c.position.y
    const dist = Math.hypot(dx, dy)
    const step = config.walkSpeed * dt
    if (dist <= step || now >= c.stateUntil) {
      c.position = dist <= step ? { x: target.x, y: target.y } : c.position
      return this.toIdle(now)
    }
    c.position = { x: c.position.x + (dx / dist) * step, y: c.position.y + (dy / dist) * step }
  }

  private startWalking(now: number): void {
    const c = this.character
    const duration = this.range(config.walkDurationMs)
    const target = this.pickTarget(duration)
    if (!target) {
      c.stateUntil = now + this.range(config.idleDurationMs)
      return
    }
    const dx = target.x - c.position.x
    const dy = target.y - c.position.y
    const dist = Math.hypot(dx, dy)
    if (dx !== 0) {
      c.heading = dx > 0 ? 1 : -1
      this.lastDirection = c.heading
    }
    c.state = 'Walking'
    c.target = target
    c.velocity = { x: (dx / dist) * config.walkSpeed, y: (dy / dist) * config.walkSpeed }
    c.stateUntil = now + duration + 1000 // 도착 전에 시간이 끝나 멈추는 일을 막는 여유
  }

  private toIdle(now: number): void {
    const c = this.character
    c.state = 'Idle'
    c.target = null
    c.velocity = { x: 0, y: 0 }
    c.stateUntil = now + this.range(config.idleDurationMs)
  }

  /** 직전 이동 방향과 다른 쪽을 우선해 이동 가능 영역 안의 목표를 고른다 */
  private pickTarget(durationMs: number): Point | null {
    const from = this.character.position
    const full = config.walkSpeed * (durationMs / 1000)
    const valid: { target: Point; flips: boolean }[] = []
    for (let i = 0; i < CANDIDATES; i++) {
      const angle = this.random() * Math.PI * 2
      for (const scale of LENGTH_SCALES) {
        const len = full * scale
        const target = { x: from.x + Math.cos(angle) * len, y: from.y + Math.sin(angle) * len }
        if (this.area.contains(target) && this.area.containsSegment(from, target)) {
          const dir: Heading = target.x - from.x >= 0 ? 1 : -1
          valid.push({ target, flips: dir !== this.lastDirection })
          break
        }
      }
    }
    if (valid.length === 0) return null
    const preferred = valid.filter((v) => v.flips)
    const pool = preferred.length > 0 ? preferred : valid
    return pool[Math.floor(this.random() * pool.length)].target
  }

  private range(r: { min: number; max: number }): number {
    return r.min + this.random() * (r.max - r.min)
  }

  private areaCenter(): Point {
    const first = this.area.displays[0]
    return first
      ? { x: first.x + first.width / 2, y: first.y + first.height / 2 }
      : { x: 0, y: 0 }
  }
}
