/**
 * 다크모드 재테스트 — data-theme 방식으로 수정
 */
import { test, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const REPORT_DIR = 'e2e/ui-report'

async function shot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: `${REPORT_DIR}/${name}.png`, fullPage })
}

async function enableDark(page: Page) {
  // 페이지 로드 완료 후 다크모드 활성화
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')
  })
  await page.waitForTimeout(1500) // CSS 변수 반영 대기
}

async function checkDarkModeTexts(page: Page) {
  return await page.evaluate(() => {
    const issues: string[] = []
    document.querySelectorAll('h1,h2,h3,h4,p,span,label,td,th,button').forEach((el) => {
      const style = getComputedStyle(el)
      const color = style.color
      const bg = getComputedStyle(document.documentElement).getPropertyValue('--background') || ''
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (color === 'rgb(0, 0, 0)' || color === 'rgb(17, 24, 39)' || color === 'rgb(31, 41, 55)')) {
        issues.push(`[다크미대응] "${el.textContent?.trim().slice(0, 25)}" ${color}`)
      }
    })
    return [...new Set(issues)].slice(0, 20)
  })
}

test.describe('🌙 다크모드 재테스트 (data-theme 방식)', () => {

  test('대회 목록 — 다크모드 (재촬영)', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await enableDark(page)
    await shot(page, 'dark-01-tournaments-list')

    const issues = await checkDarkModeTexts(page)
    console.log('\n=== 대회목록 다크 텍스트 문제 ===')
    console.log(issues.length ? issues : '없음')
  })

  test('대회 목록 — 다크모드 모바일', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await enableDark(page)
    await shot(page, 'dark-02-tournaments-mobile', false)
  })

  test('대회 상세 — 다크모드 (재촬영)', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/tournaments/"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await enableDark(page)
      await shot(page, 'dark-03-tournament-detail')

      const issues = await checkDarkModeTexts(page)
      console.log('\n=== 대회상세 다크 텍스트 문제 ===')
      console.log(issues.length ? issues : '없음')
    }
  })

  test('대회 상세 — 다크모드 모바일', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/tournaments/"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await enableDark(page)
      await shot(page, 'dark-04-tournament-detail-mobile', false)
    }
  })

  test('로그인 페이지 — 다크모드 (재촬영)', async ({ page }) => {
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState('networkidle')
    await enableDark(page)
    await shot(page, 'dark-05-login')

    const issues = await checkDarkModeTexts(page)
    console.log('\n=== 로그인 다크 텍스트 문제 ===')
    console.log(issues.length ? issues : '없음')
  })

  test('로그인 페이지 — 다크모드 모바일', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/auth/login`)
    await page.waitForLoadState('networkidle')
    await enableDark(page)
    await shot(page, 'dark-06-login-mobile', false)
  })
})
