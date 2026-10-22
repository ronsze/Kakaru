import { describe, expect, it } from 'vitest'
import { config } from '../../src/shared/config'
import { emptyLines, type Lines } from '../../src/shared/dialogue'
import { Speaker } from '../../src/shared/speaker'
import { seededRandom } from './helpers'

const lines = (over: Partial<Lines>): Lines => ({ ...emptyLines(), ...over })

function create(initial: Lines, seed = 1) {
  const state = { lines: initial }
  const speaker = new Speaker({ random: seededRandom(seed), getLines: () => state.lines, startAt: 0 })
  return { speaker, state }
}

/** 지정한 시각까지 100ms 단위로 update를 돌린다 */
function run(speaker: Speaker, from: number, to: number, muted = false): void {
  for (let t = from; t <= to; t += 100) speaker.update(t, { muted })
}

describe('Speaker 혼잣말 일정', () => {
  it('시작 직후에는 말하지 않고 첫 간격(20초) 안에 말하지 않는다 (SC-001의 반대편)', () => {
    const { speaker } = create(lines({ normal: ['a', 'b'] }))
    run(speaker, 0, config.speech.intervalMs.min - 100)
    expect(speaker.current(config.speech.intervalMs.min - 100)).toBeNull()
  })

  it('최대 간격(40초) 안에 첫 혼잣말을 한다', () => {
    const { speaker } = create(lines({ normal: ['a', 'b'] }))
    run(speaker, 0, config.speech.intervalMs.max)
    const spoken = ['a', 'b']
    let saw = false
    for (let t = config.speech.intervalMs.min; t <= config.speech.intervalMs.max; t += 100) {
      const s = speaker.current(t)
      if (s) {
        expect(spoken).toContain(s.text)
        saw = true
        break
      }
    }
    expect(saw).toBe(true)
  })

  it('혼잣말은 normal 분류에서만 고른다', () => {
    const { speaker } = create(lines({ normal: ['평소'], grabbed: ['잡힘'], struggling: ['발버둥'] }))
    const texts = new Set<string>()
    for (let t = 0; t < 10 * 60_000; t += 100) {
      speaker.update(t, { muted: false })
      const s = speaker.current(t)
      if (s) texts.add(s.text)
    }
    expect([...texts]).toEqual(['평소'])
  })

  it('normal 문장이 없으면 말풍선을 만들지 않는다 (FR-013)', () => {
    const { speaker } = create(lines({ grabbed: ['잡힘'] }))
    for (let t = 0; t < 5 * 60_000; t += 100) {
      speaker.update(t, { muted: false })
      expect(speaker.current(t)).toBeNull()
    }
  })

  it('muted(메뉴 열림·잡는 중)면 발화하지 않고 다음 시각을 다시 잡는다 (FR-011)', () => {
    const { speaker } = create(lines({ normal: ['a', 'b'] }))
    run(speaker, 0, 60_000, true)
    expect(speaker.current(60_000)).toBeNull()
    // 시각이 지난 뒤 muted가 풀려도 곧바로 밀린 말을 쏟아내지 않는다
    speaker.update(60_100, { muted: false })
    expect(speaker.current(60_100)).toBeNull()
  })

  it('같은 분류의 직전 문장을 곧바로 반복하지 않는다 (FR-006)', () => {
    const { speaker } = create(lines({ normal: ['a', 'b', 'c'] }))
    const texts: string[] = []
    let lastId = 0
    for (let t = 0; t < 60 * 60_000; t += 100) {
      speaker.update(t, { muted: false })
      const s = speaker.current(t)
      if (s && s.id !== lastId) {
        lastId = s.id
        texts.push(s.text)
      }
    }
    expect(texts.length).toBeGreaterThan(50)
    for (let i = 1; i < texts.length; i++) expect(texts[i]).not.toBe(texts[i - 1])
  })
})

describe('Speaker.say / 표시 시간', () => {
  it('say는 즉시 발화하고 이전 말풍선을 교체한다 (FR-004)', () => {
    const { speaker } = create(lines({ grabbed: ['앗'], struggling: ['놓아 줘'] }))
    expect(speaker.say('grabbed', 1000)).toBe(true)
    const first = speaker.current(1000)!
    expect(first.text).toBe('앗')
    expect(speaker.say('struggling', 2000)).toBe(true)
    const second = speaker.current(2000)!
    expect(second.text).toBe('놓아 줘')
    expect(second.id).toBeGreaterThan(first.id)
  })

  it('분류에 문장이 없으면 say는 아무것도 바꾸지 않는다', () => {
    const { speaker } = create(lines({ grabbed: ['앗'] }))
    speaker.say('grabbed', 0)
    expect(speaker.say('struggling', 100)).toBe(false)
    expect(speaker.current(100)?.text).toBe('앗')
  })

  it('표시 시간은 문장 길이에 비례하되 최소·최대로 제한된다', () => {
    const { speaker } = create(lines({ grabbed: ['짧'] }))
    speaker.say('grabbed', 0)
    expect(speaker.current(0)!.until).toBe(config.speech.displayMs.min)

    const mid = 'a'.repeat(20)
    const m = create(lines({ grabbed: [mid] }))
    m.speaker.say('grabbed', 0)
    expect(m.speaker.current(0)!.until).toBe(config.speech.baseMs + config.speech.perCharMs * 20)

    const long = 'a'.repeat(60)
    const l = create(lines({ grabbed: [long] }))
    l.speaker.say('grabbed', 0)
    expect(l.speaker.current(0)!.until).toBe(config.speech.displayMs.max)
  })

  it('만료 시각이 지나면 current는 null이다', () => {
    const { speaker } = create(lines({ grabbed: ['앗'] }))
    speaker.say('grabbed', 0)
    expect(speaker.current(config.speech.displayMs.min - 1)).not.toBeNull()
    expect(speaker.current(config.speech.displayMs.min)).toBeNull()
  })

  it('문장 공급자가 바뀌면 이후 발화는 새 문장에서 고른다 (FR-012)', () => {
    const { speaker, state } = create(lines({ grabbed: ['옛날 말'] }))
    speaker.say('grabbed', 0)
    state.lines = lines({ grabbed: ['새 말'] })
    speaker.say('grabbed', 10_000)
    expect(speaker.current(10_000)?.text).toBe('새 말')
  })
})

describe('Speaker 인사', () => {
  it('say("greeting")은 greeting 분류의 문장을 말한다', () => {
    const { speaker } = create(lines({ greeting: ['안녕!'], normal: ['평소'] }))
    expect(speaker.say('greeting', 0)).toBe(true)
    expect(speaker.current(0)?.text).toBe('안녕!')
  })

  it('인사 문장이 없으면 아무것도 말하지 않는다', () => {
    const { speaker } = create(lines({ normal: ['평소'] }))
    expect(speaker.say('greeting', 0)).toBe(false)
    expect(speaker.current(0)).toBeNull()
  })

  it('평소 혼잣말은 인사 문장을 고르지 않는다', () => {
    const { speaker } = create(lines({ greeting: ['안녕!'], normal: ['평소'] }))
    for (let t = 0; t < 5 * 60_000; t += 100) {
      speaker.update(t, { muted: false })
      const s = speaker.current(t)
      if (s) expect(s.text).toBe('평소')
    }
  })
})
