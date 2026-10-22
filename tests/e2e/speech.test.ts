import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { DEFAULT_LINES } from '../../src/shared/dialogue'

async function launch(): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.'],
    env: { ...process.env, KAKARU_USER_DATA: mkdtempSync(join(tmpdir(), 'kakaru-e2e-')) }
  })
}

/** 모든 오버레이에서 보이는 말풍선의 텍스트를 모은다 (캐릭터가 있는 창에만 보인다) */
async function bubbleTexts(pages: Page[]): Promise<string[]> {
  const all = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => {
        const b = document.getElementById('bubble') as HTMLElement
        return getComputedStyle(b).display === 'none' ? null : b.textContent
      })
    )
  )
  return all.filter((t): t is string => t !== null)
}

// 실제 마우스 대신 포인터 이벤트를 직접 보낸다 (drag.test.ts 참고)
const press = (page: Page) =>
  page.evaluate(() =>
    document.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, bubbles: true }))
  )
const release = (page: Page) =>
  page.evaluate(() =>
    document.dispatchEvent(new PointerEvent('pointerup', { button: 0, pointerId: 1, bubbles: true }))
  )

test('잡으면 "잡혔을 때" 말풍선이 나타나고, 5초 넘게 잡으면 "오래 잡혔을 때"로 바뀐다 (FR-010)', async () => {
  const app = await launch()
  try {
    const first = await app.firstWindow()
    await new Promise((r) => setTimeout(r, 800))
    const pages = app.windows()
    expect(await bubbleTexts(pages)).toEqual([])

    await press(first)
    await expect.poll(async () => (await bubbleTexts(pages))[0], { timeout: 3000 }).toBeTruthy()
    const grabbed = (await bubbleTexts(pages))[0]
    expect(DEFAULT_LINES.grabbed).toContain(grabbed)

    await expect
      .poll(async () => DEFAULT_LINES.struggling.includes((await bubbleTexts(pages))[0]), { timeout: 8000 })
      .toBe(true)
    await release(first)
  } finally {
    await app.close()
  }
})

test('말풍선은 입력을 가로채지 않고 표시 시간이 지나면 사라진다 (FR-002, FR-003)', async () => {
  const app = await launch()
  try {
    const first = await app.firstWindow()
    await new Promise((r) => setTimeout(r, 800))
    const pages = app.windows()
    await press(first)
    await expect.poll(async () => (await bubbleTexts(pages)).length, { timeout: 3000 }).toBe(1)
    await release(first)
    const pointerEvents = await first.evaluate(() => getComputedStyle(document.getElementById('bubble')!).pointerEvents)
    expect(pointerEvents).toBe('none')
    // 표시 시간(최대 8초) 뒤에는 사라진다
    await expect.poll(async () => (await bubbleTexts(pages)).length, { timeout: 10_000 }).toBe(0)
  } finally {
    await app.close()
  }
})
