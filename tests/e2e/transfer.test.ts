import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test, type ElectronApplication, type Page } from '@playwright/test'
import { buildCharacterPackage, parseCharacterPackage } from '../../src/shared/character-package'

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

/** 네이티브 저장 대화상자를 스텁한다. path가 null이면 사용자가 취소한 것이다 */
async function stubSave(app: ElectronApplication, path: string | null): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showSaveDialog = (async () =>
      p === null ? { canceled: true, filePath: '' } : { canceled: false, filePath: p }) as typeof dialog.showSaveDialog
  }, path)
}

/** 네이티브 열기 대화상자를 스텁한다. path가 null이면 사용자가 취소한 것이다 */
async function stubOpen(app: ElectronApplication, path: string | null): Promise<void> {
  await app.evaluate(({ dialog }, p) => {
    dialog.showOpenDialog = (async () =>
      p === null ? { canceled: true, filePaths: [] } : { canceled: false, filePaths: [p] }) as typeof dialog.showOpenDialog
  }, path)
}

test.describe('캐릭터 내보내기·가져오기', () => {
  let app: ElectronApplication
  let page: Page
  let dir: string

  test.beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), 'kakaru-e2e-transfer-'))
    app = await launch(join(dir, 'userData'))
    page = await settingsPage(app)
  })
  test.afterEach(async () => {
    await app.close()
  })

  test.describe('내보내기 (US1)', () => {
    test('샘플 "나"를 내보내면 .kakaru 파일이 생기고 이름·프레임·대사가 담긴다', async () => {
      const file = join(dir, 'me.kakaru')
      await stubSave(app, file)
      await page.locator('#list li', { hasText: '나' }).last().locator('.btn-export').click()
      await expect(page.locator('#status')).toContainText('내보냈습니다')
      await expect(page.locator('#status')).toContainText('me.kakaru')

      expect(existsSync(file)).toBe(true)
      const parsed = parseCharacterPackage(readFileSync(file, 'utf8'))
      expect(parsed.ok).toBe(true)
      if (!parsed.ok) return
      expect(parsed.data.name).toBe('나')
      expect(parsed.data.frames).toBe(8)
      expect(parsed.data.lines.normal?.length ?? 0).toBeGreaterThan(0)
    })

    test('기본 캐릭터 항목에는 내보내기 버튼이 없고 등록 캐릭터에는 있다', async () => {
      await expect(page.locator('#list li')).toHaveCount(3)
      await expect(page.locator('#list li').first().locator('.btn-export')).toHaveCount(0)
      await expect(page.locator('#list li').nth(1).locator('.btn-export')).toHaveCount(1)
      await expect(page.locator('#list li').nth(2).locator('.btn-export')).toHaveCount(1)
    })

    test('저장 대화상자를 취소하면 파일이 없고 안내도 없다', async () => {
      const file = join(dir, 'cancel.kakaru')
      await stubSave(app, null)
      await page.locator('#list li').nth(2).locator('.btn-export').click()
      // 취소는 동기적으로 끝나지 않으므로 목록이 그대로이고 상태가 비어 있는지 잠시 뒤 확인한다
      await page.waitForTimeout(300)
      await expect(page.locator('#status')).toHaveText('')
      expect(existsSync(file)).toBe(false)
    })
  })
  test.describe('가져오기 (US2)', () => {
    test('다른 PC에서 내보낸 파일을 가져오면 새 캐릭터가 생기고 대사까지 같으며 적용 중인 캐릭터는 그대로다', async () => {
      // 앱 A에서 샘플 "나"를 내보낸다
      const file = join(dir, 'me.kakaru')
      await stubSave(app, file)
      await page.locator('#list li').nth(2).locator('.btn-export').click()
      await expect(page.locator('#status')).toContainText('내보냈습니다')
      const original = parseCharacterPackage(readFileSync(file, 'utf8'))
      if (!original.ok) throw new Error('내보낸 파일을 해석하지 못했습니다')

      // 앱 B(새 사용자 데이터)에서 가져온다
      const appB = await launch(join(dir, 'userDataB'))
      try {
        const pageB = await settingsPage(appB)
        await expect(pageB.locator('#list li')).toHaveCount(3)
        await stubOpen(appB, file)
        await pageB.click('#import')
        await expect(pageB.locator('#status')).toContainText('가져왔습니다')

        // B에는 샘플 "나"가 이미 있으므로 번호가 붙는다
        await expect(pageB.locator('#list li')).toHaveCount(4)
        const imported = pageB.locator('#list li').nth(3)
        await expect(imported).toContainText('나 (2)')
        await expect(pageB.locator('#list li').first()).toContainText('사용 중')
        await expect(imported).not.toContainText('사용 중')

        await imported.locator('.btn-lines').click()
        const normal = original.data.lines.normal ?? []
        expect(normal.length).toBeGreaterThan(0)
        await expect(pageB.locator('#lines-normal')).toHaveValue(normal.join('\n'))
      } finally {
        await appB.close()
      }
    })

    test('열기 대화상자를 취소하면 목록과 안내가 그대로다', async () => {
      await stubOpen(app, null)
      await page.click('#import')
      await page.waitForTimeout(300)
      await expect(page.locator('#list li')).toHaveCount(3)
      await expect(page.locator('#status')).toHaveText('')
      await expect(page.locator('#import')).toBeEnabled()
    })
  })
  test.describe('잘못된 파일 (US3)', () => {
    test('캐릭터 파일이 아닌 파일은 거부 안내가 나오고 목록이 그대로다', async () => {
      const file = join(dir, 'fake.kakaru')
      writeFileSync(file, '아무 텍스트')
      await stubOpen(app, file)
      await page.click('#import')
      await expect(page.locator('#status')).toContainText('캐릭터 파일이 아니거나 손상')
      await expect(page.locator('#status')).toHaveClass(/fail/)
      await expect(page.locator('#list li')).toHaveCount(3)
    })

    test('이미지 규격과 대사 규칙을 어긴 파일은 이유를 목록으로 보여 주고 목록이 그대로다', async () => {
      const file = join(dir, 'bad.kakaru')
      writeFileSync(
        file,
        buildCharacterPackage({
          name: '불량',
          frames: 4,
          walk: Buffer.from('png 아님').toString('base64'),
          idle: Buffer.from('png 아님').toString('base64'),
          lines: { greeting: [], normal: ['가'.repeat(61)], grabbed: [], struggling: [] }
        })
      )
      await stubOpen(app, file)
      await page.click('#import')
      await expect(page.locator('#status')).toHaveClass(/fail/)
      await expect(page.locator('#import-details li').filter({ hasText: '걷기 이미지' })).toHaveCount(1)
      await expect(page.locator('#import-details li').filter({ hasText: '정지 이미지' })).toHaveCount(1)
      await expect(page.locator('#import-details li').filter({ hasText: '대사(평소)' })).toHaveCount(1)
      await expect(page.locator('#list li')).toHaveCount(3)
    })

    test('거부 뒤에 올바른 파일을 가져오면 이전 거부 이유가 지워진다', async () => {
      const bad = join(dir, 'bad.kakaru')
      writeFileSync(bad, buildCharacterPackage({ name: '불량', frames: 4, walk: 'AAAA', idle: 'AAAA', lines: { greeting: [], normal: [], grabbed: [], struggling: [] } }))
      await stubOpen(app, bad)
      await page.click('#import')
      await expect(page.locator('#import-details li').first()).toBeVisible()

      const good = join(dir, 'good.kakaru')
      await stubSave(app, good)
      await page.locator('#list li').nth(2).locator('.btn-export').click()
      await expect(page.locator('#status')).toContainText('내보냈습니다')
      await stubOpen(app, good)
      await page.click('#import')
      await expect(page.locator('#status')).toContainText('가져왔습니다')
      await expect(page.locator('#import-details li')).toHaveCount(0)
      await expect(page.locator('#list li')).toHaveCount(4)
    })
  })
})
