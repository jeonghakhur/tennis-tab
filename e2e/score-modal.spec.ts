import { test } from '@playwright/test'

test('score modal', async ({ page }) => {
  await page.setViewportSize({width:390, height:844})
  await page.goto('http://localhost:3000/auth/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'e2e.admin@mapo-tennis-test.dev')
  await page.fill('input[type="password"]', 'Test1234!')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(3000)
  
  await page.goto('http://localhost:3000/tournaments/e608dacb-6b07-4e5b-8451-77ef71050ae3/bracket')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/darkmode-audit/bracket-view.png', fullPage: false })
  
  // 경기 카드 클릭 (점수입력 버튼)
  const btn = page.locator('text=점수 입력').first()
  if (await btn.count() > 0) {
    await btn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'e2e/darkmode-audit/score-modal.png', fullPage: false })
  }
})
