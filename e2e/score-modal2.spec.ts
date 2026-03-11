import { test } from '@playwright/test'

test('score modal with admin', async ({ page }) => {
  await page.setViewportSize({width:390, height:844})
  
  // 먼저 로그인
  await page.goto('http://localhost:3000/auth/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'e2e.admin@mapo-tennis-test.dev')
  await page.fill('input[type="password"]', 'Test1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(?!auth)/, { timeout: 10000 })
  await page.waitForTimeout(2000)
  
  // 대회를 IN_PROGRESS로 변경 (관리자 액션)
  await page.goto('http://localhost:3000/tournaments/e608dacb-6b07-4e5b-8451-77ef71050ae3/bracket')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(3000)
  await page.screenshot({ path: 'e2e/darkmode-audit/bracket-loggedin.png', fullPage: false })
  
  // 경기 카드 클릭
  const matchCard = page.locator('.glass-card, [class*="rounded-xl"]').filter({ hasText: /vs/ }).first()
  if (await matchCard.count() > 0) {
    await matchCard.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'e2e/darkmode-audit/score-modal.png', fullPage: false })
  }
  
  // 점수 입력 버튼이 있으면 클릭
  const scoreBtn = page.locator('button').filter({ hasText: /점수|입력/ }).first()
  if (await scoreBtn.count() > 0) {
    await scoreBtn.click()
    await page.waitForTimeout(1500)
    await page.screenshot({ path: 'e2e/darkmode-audit/score-modal-open.png', fullPage: false })
  }
})
