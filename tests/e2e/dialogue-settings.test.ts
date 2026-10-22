import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { DEFAULT_LINES } from '../../src/shared/dialogue'

const ASSETS = join(process.cwd(), 'src', 'renderer', 'assets')
const WALK = join(ASSETS, 'walk.png')
const IDLE = join(ASSETS, 'idle.png')

async function launch(userData: string): Promise<ElectronApplication> {
  return electron.launch({
    args: ['.', '--open-settings'],
    env: { ...process.env, KAKARU_USER_DATA: userData }
  })
}

async function windowByTitle(app: ElectronApplication, title: string): Promise<Page[]> {
  const found: Page[] = []
  for (const page of app.windows()) if ((await page.title()) === title) found.push(page)
  return found
}

async function settingsPage(app: ElectronApplication): Promise<Page> {
  for (let i = 0; i < 50; i++) {
    const [page] = await windowByTitle(app, '캐릭터 설정')
    if (page) return page
    await new Promise((r) => setTimeout(r, 200))
  }
  throw new Error('설정 창을 찾지 못했습니다')
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

/** 목록에서 이름이 name인 항목 */
const item = (page: Page, name: string) => page.locator('#list li', { hasText: name })

const press = (page: Page) =>
  page.evaluate(() =>
    document.dispatchEvent(new PointerEvent('pointerdown', { button: 0, pointerId: 1, bubbles: true }))
  )

test.describe('대사 설정 화면 (006)', () => {
  let userData: string
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async () => {
    userData = join(mkdtempSync(join(tmpdir(), 'kakaru-e2e-lines-')), 'userData')
    app = await launch(userData)
    page = await settingsPage(app)
    page.on('dialog', (d) => void d.accept())
  })
  test.afterEach(async () => {
    await app.close().catch(() => undefined)
  })

  test('등록한 캐릭터의 대사를 편집·저장하면 그 캐릭터가 저장한 문장으로 말한다 (US1, SC-002)', async () => {
    await register(page, '말하는 친구')
    await item(page, '말하는 친구').locator('.btn-lines').click()
    await expect(page.locator('#lines-title')).toContainText('말하는 친구')
    for (const c of ['normal', 'grabbed', 'struggling']) await expect(page.locator(`#lines-${c}`)).toHaveValue('')

    await page.fill('#lines-grabbed', '저장한 반응 하나\n저장한 반응 둘')
    await page.click('#lines-save')
    await expect(page.locator('#lines-status')).toContainText('저장했습니다')

    // 닫았다 다시 열어도 남아 있다
    await page.click('#lines-close')
    await item(page, '말하는 친구').locator('.btn-lines').click()
    await expect(page.locator('#lines-grabbed')).toHaveValue('저장한 반응 하나\n저장한 반응 둘')
    expect(existsSync(join(userData, 'characters'))).toBe(true)

    // 그 캐릭터를 사용하고 잡으면 저장한 문장이 말풍선으로 나온다
    await item(page, '말하는 친구').locator('.btn-apply').click()
    const overlays = await windowByTitle(app, 'Kakaru')
    await press(overlays[0])
    await expect
      .poll(
        async () => {
          const texts = await Promise.all(
            overlays.map((p) =>
              p.evaluate(() => {
                const b = document.getElementById('bubble') as HTMLElement
                return getComputedStyle(b).display === 'none' ? '' : (b.textContent ?? '')
              })
            )
          )
          return texts.some((t) => t === '저장한 반응 하나' || t === '저장한 반응 둘')
        },
        { timeout: 5000 }
      )
      .toBe(true)
  })

  test('저장하지 않은 변경이 있는 채 닫으면 확인 막대가 나온다 (FR-007)', async () => {
    await register(page, '확인용')
    await item(page, '확인용').locator('.btn-lines').click()
    await page.fill('#lines-normal', '바꾼 말')
    await page.click('#lines-close')
    await expect(page.locator('#lines-unsaved')).toBeVisible()

    // 계속 편집: 막대가 사라지고 입력은 남는다
    await page.click('#unsaved-keep')
    await expect(page.locator('#lines-unsaved')).toBeHidden()
    await expect(page.locator('#lines-normal')).toHaveValue('바꾼 말')

    // 버리기: 등록 화면으로 돌아가고 저장되지 않았다
    await page.click('#lines-close')
    await page.click('#unsaved-discard')
    await expect(page.locator('#lines-panel')).toBeHidden()
    await item(page, '확인용').locator('.btn-lines').click()
    await expect(page.locator('#lines-normal')).toHaveValue('')

    // 저장: 저장한 뒤 이동한다
    await page.fill('#lines-normal', '저장할 말')
    await page.click('#lines-close')
    await page.click('#unsaved-save')
    await expect(page.locator('#lines-panel')).toBeHidden()
    await item(page, '확인용').locator('.btn-lines').click()
    await expect(page.locator('#lines-normal')).toHaveValue('저장할 말')
  })

  test('규칙을 어기면 줄 번호와 이유가 보이고 저장할 수 없다 (US2)', async () => {
    await register(page, '규칙용')
    await item(page, '규칙용').locator('.btn-lines').click()

    await page.fill('#lines-normal', `짧은 문장\n${'가'.repeat(61)}`)
    await expect(page.locator('#errors-normal')).toContainText('2번째 줄')
    await expect(page.locator('#errors-normal')).toContainText('61자')
    await expect(page.locator('#lines-save')).toBeDisabled()

    const fiftyOne = Array.from({ length: 51 }, (_, i) => `문장 ${i}`).join('\n')
    await page.fill('#lines-normal', fiftyOne)
    await expect(page.locator('#errors-normal')).toContainText('최대 50개')
    await expect(page.locator('#count-normal')).toHaveText('51/50')
    await expect(page.locator('#lines-save')).toBeDisabled()

    // 빈 줄과 중복은 오류가 아니고 저장할 때 정리된다
    await page.fill('#lines-normal', '같은 말\n\n같은 말\n다른 말')
    await expect(page.locator('#errors-normal')).toBeEmpty()
    await expect(page.locator('#lines-save')).toBeEnabled()
    await page.click('#lines-save')
    await expect(page.locator('#lines-status')).toContainText('빈 줄 1개를 정리')
    await expect(page.locator('#lines-status')).toContainText('중복 문장 1개를 합쳤')
    await expect(page.locator('#lines-normal')).toHaveValue('같은 말\n다른 말')
  })

  test('기본 캐릭터를 고쳐도 처음 문장으로 되돌릴 수 있다 (US3)', async () => {
    await item(page, '기본').first().locator('.btn-lines').click()
    await expect(page.locator('#lines-normal')).toHaveValue(DEFAULT_LINES.normal.join('\n'))
    await expect(page.locator('#lines-restore')).toBeDisabled()

    await page.fill('#lines-normal', '내가 고친 기본 문장')
    await page.click('#lines-save')
    await expect(page.locator('#lines-status')).toContainText('저장했습니다')
    expect(readFileSync(join(userData, 'default-lines.json'), 'utf8')).toContain('내가 고친 기본 문장')
    await expect(page.locator('#lines-restore')).toBeEnabled()
    await expect(page.locator('#lines-restore')).toHaveText('처음 문장으로 되돌리기')

    await page.click('#lines-restore') // 대화상자는 beforeEach에서 수락한다
    await expect(page.locator('#lines-status')).toContainText('되돌렸습니다')
    await expect(page.locator('#lines-normal')).toHaveValue(DEFAULT_LINES.normal.join('\n'))
    expect(existsSync(join(userData, 'default-lines.json'))).toBe(false)
  })

  test('되돌리기 확인을 취소하면 아무것도 바뀌지 않는다 (US3-3)', async () => {
    page.removeAllListeners('dialog')
    page.on('dialog', (d) => void d.dismiss())
    await item(page, '기본').first().locator('.btn-lines').click()
    await page.fill('#lines-normal', '고친 문장')
    await page.click('#lines-save')
    await expect(page.locator('#lines-status')).toContainText('저장했습니다')
    await page.click('#lines-restore')
    await expect(page.locator('#lines-normal')).toHaveValue('고친 문장')
    expect(existsSync(join(userData, 'default-lines.json'))).toBe(true)
  })

  test('등록한 캐릭터는 "모두 비우기"로 비울 수 있다 (US3-2)', async () => {
    await register(page, '비울 친구')
    await item(page, '비울 친구').locator('.btn-lines').click()
    await expect(page.locator('#lines-restore')).toHaveText('모두 비우기')
    await expect(page.locator('#lines-restore')).toBeDisabled()
    await page.fill('#lines-normal', '지울 문장')
    await page.click('#lines-save')
    await expect(page.locator('#lines-restore')).toBeEnabled()
    await page.click('#lines-restore')
    await expect(page.locator('#lines-normal')).toHaveValue('')
    await expect(page.locator('#lines-status')).toContainText('비웠습니다')
  })

  test('편집 중인 캐릭터를 삭제하면 안내가 나오고 저장할 수 없다 (FR-011)', async () => {
    await register(page, '사라질 친구')
    await item(page, '사라질 친구').locator('.btn-lines').click()
    await page.fill('#lines-normal', '남기고 싶은 말')
    await item(page, '사라질 친구').locator('.btn-delete').click()
    await expect(page.locator('#lines-gone')).toBeVisible()
    await expect(page.locator('#lines-save')).toBeDisabled()
  })
})
