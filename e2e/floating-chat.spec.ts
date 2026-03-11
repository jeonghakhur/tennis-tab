import { test, expect } from '@playwright/test'

test('FloatingChat NL 동작 테스트', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })

  // 로그인
  await page.goto('http://localhost:3000/auth/login')
  await page.waitForLoadState('networkidle')
  await page.fill('input[type="email"]', 'e2e.admin@mapo-tennis-test.dev')
  await page.fill('input[type="password"]', 'Test1234!')
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(?!auth)/, { timeout: 10000 })
  await page.waitForTimeout(2000)

  // 홈으로 이동
  await page.goto('http://localhost:3000')
  await page.waitForLoadState('networkidle')
  await page.waitForTimeout(2000)
  await page.screenshot({ path: 'e2e/darkmode-audit/fc-home.png' })

  // 플로팅 버튼 존재 확인
  const floatBtn = page.locator('button[aria-label="AI 어시스턴트 열기"]')
  console.log('플로팅 버튼 존재:', await floatBtn.count())

  // 클릭해서 열기
  await floatBtn.click()
  await page.waitForTimeout(1000)
  await page.screenshot({ path: 'e2e/darkmode-audit/fc-open.png' })

  // 입력창 확인
  const input = page.locator('input[type="text"], input:not([type])').last()
  console.log('입력창 존재:', await input.count())

  // 메시지 전송
  await input.fill('진행중인 대회 알려줘')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(5000)
  await page.screenshot({ path: 'e2e/darkmode-audit/fc-response.png' })

  // 응답 확인
  const messages = await page.locator('[class*="message"], [class*="chat"]').allTextContents()
  console.log('메시지들:', messages.slice(0, 5))
})
