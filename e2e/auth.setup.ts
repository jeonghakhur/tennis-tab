/**
 * Playwright 인증 Setup
 *
 * 이메일/비밀번호로 로그인 후 쿠키 상태를 저장합니다.
 * 저장된 상태는 `*.auth.spec.ts` 테스트에서 재사용됩니다.
 *
 * 필요 환경변수 (.env.local):
 *   E2E_TEST_EMAIL=test@example.com
 *   E2E_TEST_PASSWORD=yourpassword
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('이메일 로그인 후 세션 저장', async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD

  if (!email || !password) {
    console.warn(
      '⚠️  E2E_TEST_EMAIL / E2E_TEST_PASSWORD 환경변수 미설정\n' +
      '   .env.local에 추가하면 인증 테스트를 실행할 수 있습니다.'
    )
    // 빈 상태 저장 (인증 테스트 skip용)
    await page.context().storageState({ path: AUTH_FILE })
    return
  }

  await page.goto('/auth/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()

  // 로그인 성공 시 홈으로 리다이렉트 대기
  await page.waitForURL('/', { timeout: 10_000 })

  // 세션 저장
  await page.context().storageState({ path: AUTH_FILE })
})
