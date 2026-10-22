import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'

type Sample = { visible: boolean; x: number; y: number; state: string }

test('잡으면 정지하고 놓으면 그 자리에서 재개한다 (FR-002, FR-004)', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, KAKARU_USER_DATA: mkdtempSync(join(tmpdir(), 'kakaru-e2e-')) }
  })
  try {
    await app.firstWindow()
    await new Promise((r) => setTimeout(r, 500))
    const pages = app.windows()

    // 모든 창에서 update를 모으고, 1초 뒤 잡고, 1초 뒤 놓고, 1초 더 모은다
    const runs = await Promise.all(
      pages.map((page) =>
        page.evaluate(
          () =>
            new Promise<{ before: Sample[]; held: Sample[]; after: Sample[] }>((resolve) => {
              const k = (window as any).kakaru
              let bucket: Sample[] = []
              const out = { before: [] as Sample[], held: [] as Sample[], after: [] as Sample[] }
              k.onCharacterUpdate((u: Sample) => bucket.push(u))
              setTimeout(() => {
                out.before = bucket
                bucket = []
                k.grabStart()
              }, 1000)
              setTimeout(() => {
                out.held = bucket
                bucket = []
                k.grabEnd()
              }, 2500)
              setTimeout(() => {
                out.after = bucket
                resolve(out)
              }, 4000)
            })
        )
      )
    )
    const held = runs.flatMap((r) => r.held).filter((s) => s.visible)
    expect(held.length).toBeGreaterThan(0)
    expect(held.every((s) => s.state === 'UserControlled')).toBe(true)

    const heldLast = held.at(-1)!
    const after = runs.flatMap((r) => r.after).filter((s) => s.visible)
    expect(after.some((s) => s.state === 'Idle' || s.state === 'Walking')).toBe(true)
    // 놓은 직후 위치는 잡고 있던 마지막 위치 근처다(자율 이동은 정지 후 Idle 대기를 거친다)
    const first = after[0]
    expect(Math.hypot(first.x - heldLast.x, first.y - heldLast.y)).toBeLessThan(5)
  } finally {
    await app.close()
  }
})

test('잡고 커서가 움직이면 캐릭터가 오프셋을 유지하며 따라온다 (FR-003)', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, KAKARU_USER_DATA: mkdtempSync(join(tmpdir(), 'kakaru-e2e-')) }
  })
  try {
    const page = await app.firstWindow()
    await new Promise((r) => setTimeout(r, 800))
    await page.evaluate(() => {
      ;(window as any).__u = []
      ;(window as any).kakaru.onCharacterUpdate((u: Sample) => (window as any).__u.push(u))
    })
    // 실제 마우스 대신 메인의 커서 위치를 고정값으로 바꿔 끄는 동작을 흉내 낸다
    await app.evaluate(({ screen }) => {
      ;(globalThis as any).__cur = { x: 500, y: 500 }
      screen.getCursorScreenPoint = () => (globalThis as any).__cur
    })
    await page.mouse.move(500, 500)
    await page.mouse.down()
    await new Promise((r) => setTimeout(r, 300))
    const start = (await page.evaluate(() => (window as any).__u.at(-1))) as Sample
    await app.evaluate(() => ((globalThis as any).__cur = { x: 700, y: 560 }))
    await new Promise((r) => setTimeout(r, 300))
    const moved = (await page.evaluate(() => (window as any).__u.at(-1))) as Sample
    await page.mouse.up()
    expect(moved.state).toBe('UserControlled')
    expect(moved.x - start.x).toBeCloseTo(200, 0)
    expect(moved.y - start.y).toBeCloseTo(60, 0)
  } finally {
    await app.close()
  }
})

test('이미지는 브라우저 드래그가 시작되지 않게 막혀 있다', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, KAKARU_USER_DATA: mkdtempSync(join(tmpdir(), 'kakaru-e2e-')) }
  })
  try {
    const page = await app.firstWindow()
    const drag = await page.evaluate(() =>
      getComputedStyle(document.getElementById('idle')!).getPropertyValue('-webkit-user-drag')
    )
    expect(drag).toBe('none')
  } finally {
    await app.close()
  }
})

test('5초 넘게 잡으면 발버둥 모션이 시작되고 놓으면 사라진다 (FR-012)', async () => {
  const app = await electron.launch({
    args: ['.'],
    env: { ...process.env, KAKARU_USER_DATA: mkdtempSync(join(tmpdir(), 'kakaru-e2e-')) }
  })
  try {
    const page = await app.firstWindow()
    await new Promise((r) => setTimeout(r, 800))
    const struggling = () =>
      page.evaluate(() => document.getElementById('actor')!.classList.contains('struggling'))
    await app.evaluate(({ screen }) => {
      screen.getCursorScreenPoint = () => ({ x: 500, y: 500 })
    })
    await page.mouse.move(500, 500)
    await page.mouse.down()
    await new Promise((r) => setTimeout(r, 4000))
    expect(await struggling()).toBe(false)
    await new Promise((r) => setTimeout(r, 1500))
    expect(await struggling()).toBe(true)
    await page.mouse.up()
    expect(await struggling()).toBe(false)
  } finally {
    await app.close()
  }
})
