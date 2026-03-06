import { defineConfig, devices } from '@playwright/test'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// .env.local을 직접 파싱하여 process.env에 주입 (dotenv 없이)
try {
  const envPath = resolve(process.cwd(), '.env.local')
  const lines = readFileSync(envPath, 'utf-8').split('\n')
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '')
    if (key && !process.env[key]) process.env[key] = val
  }
} catch {
  // .env.local 없으면 무시 (CI 환경 등)
}

/**
 * Playwright E2E 테스트 설정
 *
 * 실행 전 개발 서버가 필요합니다: npm run dev
 * 실행: npx playwright test
 * UI 모드: npx playwright test --ui
 * 특정 파일: npx playwright test e2e/inquiry.spec.ts
 *
 * 인증이 필요한 테스트는 .env.local에 다음 환경변수를 설정하세요:
 *   E2E_TEST_EMAIL=test@example.com
 *   E2E_TEST_PASSWORD=yourpassword
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? 'github' : 'html',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'on',
  },

  projects: [
    // 인증 setup 프로젝트 (다른 프로젝트에서 저장된 세션 재사용)
    {
      name: 'setup',
      testMatch: /.*\.setup\.ts/,
    },
    // 비인증 테스트 (setup 불필요)
    {
      name: 'chromium-guest',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.guest\.spec\.ts/,
    },
    // 인증 테스트 (setup에서 저장된 쿠키 사용)
    {
      name: 'chromium-auth',
      use: {
        ...devices['Desktop Chrome'],
        storageState: 'e2e/.auth/user.json',
      },
      testMatch: /.*\.auth\.spec\.ts/,
      dependencies: ['setup'],
    },
    // 혼합 테스트 (setup 없이, 파일 내에서 인증 처리)
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      testIgnore: /.*\.(guest|auth)\.spec\.ts/,
    },
  ],

  // 개발 서버 자동 시작 (CI 환경에서 유용)
  // webServer: {
  //   command: 'npm run dev',
  //   url: 'http://localhost:3000',
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
})
