import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { makePng } from '../unit/png-fixture'

const ASSETS = join(process.cwd(), 'src', 'renderer', 'assets')
const WALK = join(ASSETS, 'walk.png') // 기본 캐릭터: 8프레임, 200×200
const IDLE = join(ASSETS, 'idle.png')

async function launch(userData: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--open-settings'],
    env: { ...process.env, KAKARU_USER_DATA: userData }
  })
}

async function settingsPage(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    for (const page of app.windows()) {
      if ((await page.title()) === '캐릭터 설정') return page
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('설정 창을 찾지 못했습니다')
}

test.describe('캐릭터 설정 창 (US2)', () => {
  let app: ElectronApplication
  let page: Page
  let dir: string

  test.beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'kakaru-e2e-settings-'))
    app = await launch(join(dir, 'userData'))
    page = await settingsPage(app)
  })
  test.afterEach(async () => {
    await app.close()
  })

  test('처음에는 기본 캐릭터와 샘플 캐릭터(빨간 모자)가 목록에 있고 기본 캐릭터를 쓴다', async () => {
    await expect(page.locator('#list li')).toHaveCount(2)
    await expect(page.locator('#list li').first()).toContainText('기본')
    await expect(page.locator('#list li').first()).toContainText('사용 중')
    await expect(page.locator('#list li').nth(1)).toContainText('빨간 모자')
  })

  test('올바른 이미지를 지정하면 등록할 수 있고 등록하면 목록에 나타난다', async () => {
    await page.fill('#name', '테스트 고양이')
    await page.fill('#frames', '8')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', IDLE)
    await expect(page.locator('#register')).toBeEnabled()
    await expect(page.locator('#preview-walk')).toBeVisible()
    await expect(page.locator('#preview-idle')).toBeVisible()

    await page.click('#register')
    await expect(page.locator('#status')).toContainText('등록했습니다')
    await expect(page.locator('#list li')).toHaveCount(3)
    await expect(page.locator('#list li').nth(2)).toContainText('테스트 고양이')
    // 등록 후 입력이 초기화된다
    await expect(page.locator('#name')).toHaveValue('')
    await expect(page.locator('#register')).toBeDisabled()
  })

  test('정사각형이 아닌 정지 이미지는 이유가 보이고 등록 버튼이 비활성화된다', async () => {
    const wrong = join(dir, 'idle-wrong.png')
    writeFileSync(wrong, makePng({ width: 200, height: 210 }))
    await page.fill('#name', '잘못된 이미지')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', wrong)
    await expect(page.locator('#error-idle')).toContainText('정사각형')
    await expect(page.locator('#register')).toBeDisabled()
  })

  test('프레임 수가 이미지와 맞지 않으면 걷기 이미지에 이유가 보인다', async () => {
    await page.fill('#name', '프레임 불일치')
    await page.fill('#frames', '5')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', IDLE)
    await expect(page.locator('#error-walk')).toContainText('프레임 수')
    await expect(page.locator('#register')).toBeDisabled()
  })

  test('이름이 비어 있으면 이름에 이유가 보이고, 이미 있는 이름이면 중복 안내가 보인다', async () => {
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', IDLE)
    await expect(page.locator('#error-name')).toContainText('1~30자')

    await page.fill('#name', '고양이')
    await expect(page.locator('#register')).toBeEnabled()
    await page.click('#register')
    await expect(page.locator('#list li')).toHaveCount(3)

    await page.fill('#name', ' 고양이 ')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', IDLE)
    await expect(page.locator('#error-name')).toContainText('이미 사용 중')
    await expect(page.locator('#register')).toBeDisabled()
  })

  test('불투명(알파 채널 없음) 이미지는 투명 배경 안내가 보인다', async () => {
    const opaque = join(dir, 'opaque.png')
    writeFileSync(opaque, makePng({ width: 200, height: 200, colorType: 'rgb' }))
    await page.fill('#name', '불투명')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', opaque)
    await expect(page.locator('#error-idle')).toContainText('투명')
  })
})

async function overlayPages(app: ElectronApplication): Promise<Page[]> {
  const pages: Page[] = []
  for (const page of app.windows()) {
    if ((await page.title()) === 'Kakaru') pages.push(page)
  }
  return pages
}

/** 모든 오버레이의 걷기 이미지가 사용자 캐릭터(data: URL)인지 */
async function overlaysUseCustom(app: ElectronApplication): Promise<boolean> {
  const pages = await overlayPages(app)
  if (pages.length === 0) return false
  const flags = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => (document.getElementById('walk') as HTMLImageElement).src.startsWith('data:image/png;base64,'))
    )
  )
  return flags.every(Boolean)
}

async function overlaysUseDefault(app: ElectronApplication): Promise<boolean> {
  const pages = await overlayPages(app)
  if (pages.length === 0) return false
  const flags = await Promise.all(
    pages.map((p) =>
      p.evaluate(() => !(document.getElementById('walk') as HTMLImageElement).src.startsWith('data:'))
    )
  )
  return flags.every(Boolean)
}

async function register(page: Page, name: string): Promise<void> {
  await page.fill('#name', name)
  await page.fill('#frames', '8')
  await page.setInputFiles('#walk', WALK)
  await page.setInputFiles('#idle', IDLE)
  await expect(page.locator('#register')).toBeEnabled()
  await page.click('#register')
  await expect(page.locator('#status')).toContainText('등록했습니다')
}

test.describe('캐릭터 선택·관리 (US3)', () => {
  let userData: string
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    userData = join(mkdtempSync(join(tmpdir(), 'kakaru-e2e-active-')), 'userData')
    app = await launch(userData)
    page = await settingsPage(app)
    page.on('dialog', (d) => void d.accept())
  })
  test.afterEach(async () => {
    await app.close().catch(() => undefined)
  })

  test('선택하면 오버레이가 사용자 캐릭터 이미지로 바뀌고, 기본으로 되돌리면 기본 이미지로 돌아온다', async () => {
    expect(await overlaysUseDefault(app)).toBe(true)
    await register(page, '고양이')
    await page.locator('#list li').nth(2).locator('.btn-apply').click()
    await expect(page.locator('#list li').nth(2)).toContainText('사용 중')
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)

    await page.locator('#list li').first().locator('.btn-apply').click()
    await expect(page.locator('#list li').first()).toContainText('사용 중')
    await expect.poll(() => overlaysUseDefault(app)).toBe(true)
  })

  test('앱을 다시 실행해도 마지막에 선택한 캐릭터가 유지된다 (SC-007)', async () => {
    await register(page, '고양이')
    await page.locator('#list li').nth(2).locator('.btn-apply').click()
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)
    await app.close()

    app = await launch(userData)
    page = await settingsPage(app)
    await expect(page.locator('#list li').nth(2)).toContainText('사용 중')
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)
  })

  test('사용 중인 캐릭터를 삭제하면 기본 캐릭터로 바뀐다', async () => {
    await register(page, '고양이')
    await page.locator('#list li').nth(2).locator('.btn-apply').click()
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)

    await page.locator('#list li').nth(2).locator('.btn-delete').click()
    await expect(page.locator('#list li')).toHaveCount(2)
    await expect(page.locator('#list li').first()).toContainText('사용 중')
    await expect.poll(() => overlaysUseDefault(app)).toBe(true)
  })

  test('샘플 캐릭터(빨간 모자)를 선택하면 4프레임 걷기 설정으로 바뀐다', async () => {
    await page.locator('#list li').nth(1).locator('.btn-apply').click()
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)
    const pages = await overlayPages(app)
    const frames = await pages[0].evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--frames').trim()
    )
    expect(frames).toBe('4')

    await page.locator('#list li').first().locator('.btn-apply').click()
    await expect.poll(() => overlaysUseDefault(app)).toBe(true)
    const defaultFrames = await pages[0].evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--frames').trim()
    )
    expect(defaultFrames).toBe('8')
  })

  test('샘플 캐릭터를 삭제하면 다시 실행해도 다시 나타나지 않는다', async () => {
    await page.locator('#list li').nth(1).locator('.btn-delete').click()
    await expect(page.locator('#list li')).toHaveCount(1)
    await app.close()

    app = await launch(userData)
    page = await settingsPage(app)
    await expect(page.locator('#list li')).toHaveCount(1)
    await expect(page.locator('#list li').first()).toContainText('기본')
  })

  test('오버레이는 기본 크기(배율 1)로 시작한다', async () => {
    const pages = await overlayPages(app)
    expect(pages.length).toBeGreaterThan(0)
    for (const p of pages) {
      const scale = await p.evaluate(() =>
        getComputedStyle(document.documentElement).getPropertyValue('--scale').trim()
      )
      expect(scale).toBe('1')
    }
  })

  test('저장된 배율로 시작하면 오버레이에 그 배율이 적용된다', async () => {
    await app.close()
    const { writeFileSync, mkdirSync } = await import('node:fs')
    mkdirSync(userData, { recursive: true })
    writeFileSync(
      join(userData, 'settings.json'),
      JSON.stringify({ version: 1, activeId: null, characters: [], seeded: ['bmm'], scale: 1.7 })
    )
    app = await launch(userData)
    page = await settingsPage(app)
    await expect
      .poll(async () => {
        const pages = await overlayPages(app)
        const values = await Promise.all(
          pages.map((p) =>
            p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--scale').trim())
          )
        )
        return values.length > 0 && values.every((v) => v === '1.7')
      })
      .toBe(true)
  })

  test('기본 캐릭터 항목에는 삭제 버튼이 없다', async () => {
    await expect(page.locator('#list li').first().locator('.btn-delete')).toHaveCount(0)
  })

  test('활성 캐릭터의 이미지 파일이 사라진 채 실행하면 기본으로 표시하고 설정 화면에 알린다 (FR-015)', async () => {
    await register(page, '고양이')
    await page.locator('#list li').nth(2).locator('.btn-apply').click()
    await expect.poll(() => overlaysUseCustom(app)).toBe(true)
    await app.close()

    const { readdirSync, rmSync } = await import('node:fs')
    const charactersDir = join(userData, 'characters')
    for (const id of readdirSync(charactersDir)) rmSync(join(charactersDir, id, 'walk.png'))

    app = await launch(userData)
    page = await settingsPage(app)
    await expect(page.locator('#notice')).toBeVisible()
    await expect(page.locator('#notice')).toContainText('읽을 수 없')
    await expect.poll(() => overlaysUseDefault(app)).toBe(true)
  })
})
