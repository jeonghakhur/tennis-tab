/**
 * UI 검증 테스트 — 대회/프로필 섹션
 * - 가독성 (텍스트, 버튼, 아이콘 대비)
 * - 다크모드 대응
 * - 컴포넌트 크기/너비 일관성
 */
import { test, expect, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'
const REPORT_DIR = 'e2e/ui-report'

const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'Test1234!'

async function shot(page: Page, name: string, fullPage = true) {
  await page.screenshot({ path: `${REPORT_DIR}/${name}.png`, fullPage })
}

async function checkButtonSize(page: Page) {
  return await page.evaluate(() => {
    const buttons = document.querySelectorAll('button, a[role="button"]')
    const small: string[] = []
    buttons.forEach((el) => {
      const rect = el.getBoundingClientRect()
      const text = el.textContent?.trim().slice(0, 20) || ''
      if (rect.width > 0 && rect.height > 0 && (rect.width < 36 || rect.height < 36)) {
        small.push(`[작은버튼] "${text}" ${Math.round(rect.width)}x${Math.round(rect.height)}px`)
      }
    })
    return small
  })
}

async function checkContainerWidth(page: Page) {
  return await page.evaluate(() => {
    const result: string[] = []
    const seen = new Set<number>()
    document.querySelectorAll('main > *, section, [class*="container"], [class*="max-w"]').forEach((el) => {
      const rect = el.getBoundingClientRect()
      const w = Math.round(rect.width)
      if (w > 0 && w < window.innerWidth && !seen.has(w)) {
        seen.add(w)
        const cls = el.className?.toString().slice(0, 50) || el.tagName
        result.push(`${w}px — ${cls}`)
      }
    })
    return result
  })
}

async function checkOverflow(page: Page) {
  return await page.evaluate(() => {
    const issues: string[] = []
    document.querySelectorAll('*').forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.right > window.innerWidth + 5 && rect.width > 0) {
        const cls = el.className?.toString().slice(0, 40) || el.tagName
        issues.push(`[오버플로] ${cls} right:${Math.round(rect.right)}px`)
      }
    })
    return [...new Set(issues)].slice(0, 15)
  })
}

async function checkDarkModeTexts(page: Page) {
  return await page.evaluate(() => {
    const issues: string[] = []
    document.querySelectorAll('h1,h2,h3,h4,p,span,label,td,th').forEach((el) => {
      const style = getComputedStyle(el)
      const color = style.color
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && (color === 'rgb(0, 0, 0)' || color === 'rgb(17, 24, 39)' || color === 'rgb(31, 41, 55)')) {
        issues.push(`[다크미대응] "${el.textContent?.trim().slice(0, 25)}" ${color}`)
      }
    })
    return [...new Set(issues)].slice(0, 20)
  })
}

async function login(page: Page) {
  await page.goto(`${BASE_URL}/auth/login`)
  await page.fill('input[type="email"]', TEST_EMAIL)
  await page.fill('input[type="password"]', TEST_PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(1000)
}

// ============================================================
// 대회 섹션
// ============================================================
test.describe('🎾 대회 섹션 UI 검증', () => {

  test('대회 목록 라이트모드', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await shot(page, '01-tournaments-list-light')

    const smallBtns = await checkButtonSize(page)
    const containers = await checkContainerWidth(page)
    const overflow = await checkOverflow(page)

    console.log('\n=== 대회목록 라이트 ===')
    console.log('작은버튼:', smallBtns.length ? smallBtns : '없음')
    console.log('컨테이너너비:', containers)
    console.log('오버플로:', overflow.length ? overflow : '없음')
  })

  test('대회 목록 다크모드', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') })
    await page.waitForTimeout(600)
    await shot(page, '02-tournaments-list-dark')

    const darkIssues = await checkDarkModeTexts(page)
    console.log('\n=== 대회목록 다크모드 텍스트 문제 ===')
    console.log(darkIssues.length ? darkIssues : '없음')
  })

  test('대회 목록 모바일(390px) 라이트', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await shot(page, '03-tournaments-mobile-light', false)
    const overflow = await checkOverflow(page)
    console.log('\n=== 대회 모바일 오버플로 ===', overflow.length ? overflow : '없음')
  })

  test('대회 목록 모바일(390px) 다크', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') })
    await page.waitForTimeout(600)
    await shot(page, '04-tournaments-mobile-dark', false)
    const darkIssues = await checkDarkModeTexts(page)
    console.log('\n=== 대회 모바일 다크 텍스트 ===', darkIssues.length ? darkIssues : '없음')
  })

  test('대회 상세 라이트모드', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/tournaments/"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await shot(page, '05-tournament-detail-light')
      const smallBtns = await checkButtonSize(page)
      const containers = await checkContainerWidth(page)
      console.log('\n=== 대회상세 라이트 ===')
      console.log('작은버튼:', smallBtns.length ? smallBtns : '없음')
      console.log('컨테이너너비:', containers)
    }
  })

  test('대회 상세 다크모드', async ({ page }) => {
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/tournaments/"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') })
      await page.waitForTimeout(600)
      await shot(page, '06-tournament-detail-dark')
      const darkIssues = await checkDarkModeTexts(page)
      console.log('\n=== 대회상세 다크 텍스트 ===', darkIssues.length ? darkIssues : '없음')
    }
  })

  test('대회 상세 모바일(390px)', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(`${BASE_URL}/tournaments`)
    await page.waitForLoadState('networkidle')
    const link = page.locator('a[href^="/tournaments/"]').first()
    if (await link.count() > 0) {
      await link.click()
      await page.waitForLoadState('networkidle')
      await shot(page, '07-tournament-detail-mobile', false)
      const overflow = await checkOverflow(page)
      console.log('\n=== 대회상세 모바일 오버플로 ===', overflow.length ? overflow : '없음')
    }
  })
})

// ============================================================
// 프로필 섹션
// ============================================================
test.describe('👤 프로필 섹션 UI 검증', () => {

  test('프로필 라이트모드', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    await shot(page, '08-profile-light')

    const smallBtns = await checkButtonSize(page)
    const containers = await checkContainerWidth(page)
    console.log('\n=== 프로필 라이트 ===')
    console.log('작은버튼:', smallBtns.length ? smallBtns : '없음')
    console.log('컨테이너너비:', containers)
  })

  test('프로필 다크모드', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') })
    await page.waitForTimeout(600)
    await shot(page, '09-profile-dark')

    const darkIssues = await checkDarkModeTexts(page)
    console.log('\n=== 프로필 다크 텍스트 문제 ===')
    console.log(darkIssues.length ? darkIssues : '없음')
  })

  test('프로필 모바일(390px) 라이트', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    await shot(page, '10-profile-mobile-light', false)
    const overflow = await checkOverflow(page)
    console.log('\n=== 프로필 모바일 오버플로 ===', overflow.length ? overflow : '없음')
  })

  test('프로필 모바일(390px) 다크', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    await page.evaluate(() => { document.documentElement.classList.add('dark'); localStorage.setItem('theme','dark') })
    await page.waitForTimeout(600)
    await shot(page, '11-profile-mobile-dark', false)
    const darkIssues = await checkDarkModeTexts(page)
    console.log('\n=== 프로필 모바일 다크 텍스트 ===', darkIssues.length ? darkIssues : '없음')
  })

  test('프로필 탭 — 참가 대회', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    const tab = page.locator('button,[role="tab"]').filter({ hasText: '참가 대회' }).first()
    if (await tab.count() > 0) { await tab.click(); await page.waitForTimeout(500) }
    await shot(page, '12-profile-tab-tournaments')
  })

  test('프로필 탭 — 내 경기', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    const tab = page.locator('button,[role="tab"]').filter({ hasText: '내 경기' }).first()
    if (await tab.count() > 0) { await tab.click(); await page.waitForTimeout(500) }
    await shot(page, '13-profile-tab-matches')
  })

  test('프로필 탭 — 입상 기록', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    const tab = page.locator('button,[role="tab"]').filter({ hasText: '입상' }).first()
    if (await tab.count() > 0) { await tab.click(); await page.waitForTimeout(500) }
    await shot(page, '14-profile-tab-awards')
  })

  test('프로필 탭 — 프로필 편집', async ({ page }) => {
    await login(page)
    await page.goto(`${BASE_URL}/my/profile`)
    await page.waitForLoadState('networkidle')
    const tab = page.locator('button,[role="tab"]').filter({ hasText: '프로필' }).first()
    if (await tab.count() > 0) { await tab.click(); await page.waitForTimeout(500) }
    await shot(page, '15-profile-tab-edit')
    const smallBtns = await checkButtonSize(page)
    console.log('\n=== 프로필 편집탭 작은버튼 ===', smallBtns.length ? smallBtns : '없음')
  })
})
