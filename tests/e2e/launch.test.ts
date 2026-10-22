import { _electron as electron, expect, test } from '@playwright/test'

type Sample = { visible: boolean; x: number; y: number; vx: number; vy: number; state: string }

test('앱 기동 후 5초 안에 캐릭터가 이동을 시작한다 (SC-001)', async () => {
  const app = await electron.launch({ args: ['.'] })
  try {
    await app.firstWindow()
    // 오버레이 창이 모두 열릴 때까지 잠시 기다린다
    await new Promise((r) => setTimeout(r, 500))
    const pages = app.windows()
    expect(pages.length).toBeGreaterThan(0)

    // 각 오버레이 창에서 5.5초 동안 character:update를 수집한다
    const results = await Promise.all(
      pages.map((page) =>
        page.evaluate(
          () =>
            new Promise<Sample[]>((resolve) => {
              const samples: Sample[] = []
              ;(window as any).kakaru.onCharacterUpdate((u: Sample) => samples.push(u))
              setTimeout(() => resolve(samples), 5500)
            })
        )
      )
    )
    const visible = results.flat().filter((s) => s.visible)
    expect(visible.length).toBeGreaterThan(0)
    // 이동은 Walking 상태와 0이 아닌 속도로 시작된다
    const started = visible.some((s) => s.state === 'Walking' && (s.vx !== 0 || s.vy !== 0))
    expect(started).toBe(true)
  } finally {
    await app.close()
  }
})
