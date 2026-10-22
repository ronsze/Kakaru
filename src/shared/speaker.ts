import { config } from './config'
import { pickLine, type Category, type Lines } from './dialogue'

export type Speech = {
  /** 발화마다 늘어나는 번호. 렌더러가 새 발화인지 판별한다 */
  id: number
  text: string
  /** 사라질 시각 (시뮬레이션 시계, ms) */
  until: number
}

export type SpeakerOptions = {
  random: () => number
  /** 지금 활성 캐릭터의 대화셋. 말하려 할 때마다 호출한다 */
  getLines: () => Lines
  startAt: number
}

/**
 * 혼잣말 일정과 말풍선 내용을 정한다. Electron에 의존하지 않는다 (시각은 인자로만 받는다).
 * 한 시점에 말풍선은 하나이며 새 발화가 이전 것을 교체한다.
 */
export class Speaker {
  private readonly random: () => number
  private readonly getLines: () => Lines
  private nextAt: number
  private nextId = 1
  private speech: Speech | null = null
  private readonly last = new Map<Category, string>()

  constructor(options: SpeakerOptions) {
    this.random = options.random
    this.getLines = options.getLines
    this.nextAt = options.startAt + this.interval()
  }

  /** 매 틱 호출한다. muted(메뉴 열림·잡는 중)면 시각만 다시 잡고 말하지 않는다 */
  update(now: number, ctx: { muted: boolean }): void {
    if (now < this.nextAt) return
    this.nextAt = now + this.interval()
    if (ctx.muted) return
    this.say('normal', now)
  }

  /** 분류에서 문장을 골라 즉시 말한다. 후보가 없으면 아무것도 바꾸지 않고 false */
  say(category: Category, now: number): boolean {
    const text = pickLine(this.getLines()[category], this.last.get(category) ?? null, this.random)
    if (text === null) return false
    this.last.set(category, text)
    this.speech = { id: this.nextId++, text, until: now + this.duration(text) }
    return true
  }

  /** 지금 보여 줄 말풍선. 만료됐으면 null */
  current(now: number): Speech | null {
    if (this.speech && now >= this.speech.until) this.speech = null
    return this.speech
  }

  private duration(text: string): number {
    const { baseMs, perCharMs, displayMs } = config.speech
    return Math.min(displayMs.max, Math.max(displayMs.min, baseMs + perCharMs * text.length))
  }

  private interval(): number {
    const { min, max } = config.speech.intervalMs
    return min + this.random() * (max - min)
  }
}
