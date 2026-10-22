import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { makePng } from '../unit/png-fixture'

const ASSETS = join(process.cwd(), 'src', 'renderer', 'assets')
const WALK = join(ASSETS, 'walk.png') // 4프레임, 200×200
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

  test('처음에는 기본 캐릭터만 목록에 있다', async () => {
    await expect(page.locator('#list li')).toHaveCount(1)
    await expect(page.locator('#list li').first()).toContainText('기본')
  })

  test('올바른 이미지를 지정하면 등록할 수 있고 등록하면 목록에 나타난다', async () => {
    await page.fill('#name', '테스트 고양이')
    await page.fill('#frames', '4')
    await page.setInputFiles('#walk', WALK)
    await page.setInputFiles('#idle', IDLE)
    await expect(page.locator('#register')).toBeEnabled()
    await expect(page.locator('#preview-walk')).toBeVisible()
    await expect(page.locator('#preview-idle')).toBeVisible()

    await page.click('#register')
    await expect(page.locator('#status')).toContainText('등록했습니다')
    await expect(page.locator('#list li')).toHaveCount(2)
    await expect(page.locator('#list li').nth(1)).toContainText('테스트 고양이')
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
    await expect(page.locator('#list li')).toHaveCount(2)

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
