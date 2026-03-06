/**
 * FAQ 관리 CRUD E2E 테스트
 *
 * 실행: npx playwright test e2e/faq-admin.spec.ts
 * UI 모드: npx playwright test e2e/faq-admin.spec.ts --ui
 *
 * - 공개 FAQ 테스트: 인증 불필요
 * - 어드민 CRUD 테스트:
 *   E2E_TEST_EMAIL=admin@example.com
 *   E2E_TEST_PASSWORD=yourpassword
 *   (해당 계정이 ADMIN 이상 권한 필요)
 */
import { test, expect, type Page } from '@playwright/test'

const ADMIN_FAQ_URL = '/admin/faq'
const SUPPORT_URL = '/support'

// 테스트용 고유 식별자 (병렬 실행 시 충돌 방지)
const UNIQUE_ID = `E2E-${Date.now()}`
const TEST_FAQ = {
  question: `[${UNIQUE_ID}] 테스트 FAQ 질문입니다`,
  answer: `[${UNIQUE_ID}] 테스트 FAQ 답변입니다. Playwright 자동화 테스트용 데이터입니다.`,
  updatedQuestion: `[${UNIQUE_ID}] 수정된 FAQ 질문`,
  updatedAnswer: `[${UNIQUE_ID}] 수정된 FAQ 답변입니다.`,
}

// ──────────────────────────────────────────────
// 헬퍼 함수
// ──────────────────────────────────────────────

/** 어드민 로그인 */
async function adminLogin(page: Page) {
  const email = process.env.E2E_TEST_EMAIL
  const password = process.env.E2E_TEST_PASSWORD
  if (!email || !password) return false

  await page.goto('/auth/login')
  await page.getByLabel('이메일').fill(email)
  await page.getByLabel('비밀번호').fill(password)
  await page.getByRole('button', { name: '로그인' }).click()
  await page.waitForURL('/', { timeout: 10_000 })
  return true
}

/** Toast 메시지 표시 확인 */
async function expectToast(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5_000 })
}

/** ConfirmDialog 확인 클릭 */
async function confirmDialog(page: Page) {
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toBeVisible({ timeout: 3_000 })
  await dialog.getByRole('button', { name: '확인' }).click()
}

/** FAQ 모달 폼 채우기 */
async function fillFaqForm(
  page: Page,
  opts: { category?: string; question: string; answer: string },
) {
  const modal = page.getByRole('dialog')
  await expect(modal).toBeVisible({ timeout: 3_000 })

  if (opts.category) {
    await modal.locator('#faq-category').selectOption({ label: opts.category })
  }
  await modal.locator('#faq-question').fill(opts.question)
  await modal.locator('#faq-answer').fill(opts.answer)
}

// ══════════════════════════════════════════════
// 1. 공개 FAQ 페이지 테스트 (인증 불필요)
// ══════════════════════════════════════════════
test.describe('공개 FAQ (고객센터)', () => {
  test('고객센터 FAQ 섹션 표시 확인', async ({ page }) => {
    await page.goto(SUPPORT_URL)

    // 고객센터 헤더
    await expect(page.getByRole('heading', { name: '고객센터' })).toBeVisible({ timeout: 10_000 })

    // 자주하는 질문 헤더
    await expect(page.getByRole('heading', { name: '자주하는 질문' })).toBeVisible()

    // FAQ 검색창
    await expect(page.getByPlaceholder('질문을 검색하세요')).toBeVisible()

    // 카테고리 탭 존재 (최소 1개)
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()
    expect(tabCount).toBeGreaterThanOrEqual(1)
  })

  test('FAQ 카테고리 탭 전환', async ({ page }) => {
    await page.goto(SUPPORT_URL)
    await expect(page.getByRole('heading', { name: '자주하는 질문' })).toBeVisible({ timeout: 10_000 })

    // 탭 목록 확인
    const tabList = page.getByRole('tablist')
    await expect(tabList).toBeVisible()

    // 두 번째 탭 클릭 (있다면)
    const tabs = page.getByRole('tab')
    const tabCount = await tabs.count()
    if (tabCount >= 2) {
      const secondTab = tabs.nth(1)
      await secondTab.click()
      await expect(secondTab).toHaveAttribute('aria-selected', 'true')
    }
  })

  test('FAQ 검색 기능 동작', async ({ page }) => {
    await page.goto(SUPPORT_URL)
    await expect(page.getByRole('heading', { name: '자주하는 질문' })).toBeVisible({ timeout: 10_000 })

    const searchInput = page.getByPlaceholder('질문을 검색하세요')

    // 검색어 입력 시 카테고리 탭 숨김
    await searchInput.fill('로그인')
    await page.waitForTimeout(300)
    await expect(page.getByRole('tablist')).toBeHidden()

    // 검색어 삭제 시 탭 복귀
    await searchInput.clear()
    await page.waitForTimeout(300)
    await expect(page.getByRole('tablist')).toBeVisible()
  })

  test('FAQ 아코디언 열기/닫기', async ({ page }) => {
    await page.goto(SUPPORT_URL)
    await expect(page.getByRole('heading', { name: '자주하는 질문' })).toBeVisible({ timeout: 10_000 })

    // 첫 번째 FAQ 질문 버튼 (main 영역으로 스코프 — 네비 햄버거 버튼 제외)
    const firstQuestion = page.locator('main').locator('button[aria-expanded]').first()
    if ((await firstQuestion.count()) === 0) {
      test.skip()
      return
    }

    // 초기: 닫힘
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')

    // 클릭: 열기
    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'true')

    // 다시 클릭: 닫기
    await firstQuestion.click()
    await expect(firstQuestion).toHaveAttribute('aria-expanded', 'false')
  })

  test('검색 결과 없을 때 안내 문구 표시', async ({ page }) => {
    await page.goto(SUPPORT_URL)
    await expect(page.getByRole('heading', { name: '자주하는 질문' })).toBeVisible({ timeout: 10_000 })

    // 존재하지 않는 검색어
    await page.getByPlaceholder('질문을 검색하세요').fill('xyzabc존재하지않는질문')
    await page.waitForTimeout(300)

    await expect(page.getByText('검색 결과가 없습니다.')).toBeVisible()
  })
})

// ══════════════════════════════════════════════
// 2. 어드민 FAQ CRUD 테스트 (인증 필요, 순차 실행)
// ══════════════════════════════════════════════
test.describe('어드민 FAQ CRUD', () => {
  // CRUD 테스트는 순서 의존적 (생성 → 수정 → 토글 → 삭제)
  test.describe.configure({ mode: 'serial' })

  const HAS_CREDENTIALS = !!(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD)

  test.beforeEach(async ({ page }) => {
    if (!HAS_CREDENTIALS) {
      test.skip()
      return
    }
    await adminLogin(page)
  })

  test('어드민 FAQ 페이지 로드', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)

    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: 'FAQ 추가' })).toBeVisible()
    await expect(page.getByRole('button', { name: '전체' })).toBeVisible()
  })

  test('카테고리 필터 탭 전환', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: '계정/인증' }).click()
    await page.waitForTimeout(300)
    await page.getByRole('button', { name: '전체' }).click()
    await page.waitForTimeout(300)
  })

  test('FAQ 생성 - 빈 질문 유효성 검사', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'FAQ 추가' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // 답변만 입력
    await modal.locator('#faq-answer').fill('답변만 입력')
    await modal.getByRole('button', { name: '추가' }).click()

    // 에러 표시
    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 3_000 })
    await expect(alertDialog).toContainText('질문')
    await alertDialog.getByRole('button', { name: '확인' }).click()
  })

  test('FAQ 생성 성공', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    await page.getByRole('button', { name: 'FAQ 추가' }).click()

    await fillFaqForm(page, {
      category: '계정/인증',
      question: TEST_FAQ.question,
      answer: TEST_FAQ.answer,
    })

    const modal = page.getByRole('dialog')
    await modal.getByRole('button', { name: '추가' }).click()

    await expectToast(page, 'FAQ가 추가되었습니다.')
    await expect(modal).toBeHidden({ timeout: 3_000 })
    await expect(page.getByText(TEST_FAQ.question)).toBeVisible({ timeout: 5_000 })
  })

  test('FAQ 수정 성공', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    // 테스트 FAQ 카드 찾기
    const faqCard = page.locator('.glass-card', { hasText: TEST_FAQ.question })
    await expect(faqCard).toBeVisible({ timeout: 5_000 })

    // 수정 버튼 클릭
    await faqCard.getByRole('button', { name: '수정' }).click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // 기존 데이터 확인
    await expect(modal.locator('#faq-question')).toHaveValue(TEST_FAQ.question)

    // 수정
    await modal.locator('#faq-question').fill(TEST_FAQ.updatedQuestion)
    await modal.locator('#faq-answer').fill(TEST_FAQ.updatedAnswer)
    await modal.getByRole('button', { name: '수정' }).click()

    await expectToast(page, 'FAQ가 수정되었습니다.')
    await expect(modal).toBeHidden({ timeout: 3_000 })
    await expect(page.getByText(TEST_FAQ.updatedQuestion)).toBeVisible({ timeout: 5_000 })
  })

  test('FAQ 비활성화 토글', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    const faqCard = page.locator('.glass-card', { hasText: TEST_FAQ.updatedQuestion })
    await expect(faqCard).toBeVisible({ timeout: 5_000 })

    // 비활성화
    await faqCard.getByRole('button', { name: '비활성화' }).click()
    await expectToast(page, '비활성화되었습니다.')

    // 다시 활성화
    await page.waitForTimeout(500)
    const updatedCard = page.locator('.glass-card', { hasText: TEST_FAQ.updatedQuestion })
    await updatedCard.getByRole('button', { name: '활성화' }).click()
    await expectToast(page, '활성화되었습니다.')
  })

  test('FAQ 삭제 성공', async ({ page }) => {
    await page.goto(ADMIN_FAQ_URL)
    await expect(page.getByRole('heading', { name: /FAQ 관리/ })).toBeVisible({ timeout: 10_000 })

    const faqCard = page.locator('.glass-card', { hasText: TEST_FAQ.updatedQuestion })
    await expect(faqCard).toBeVisible({ timeout: 5_000 })

    // 삭제
    await faqCard.getByRole('button', { name: '삭제' }).click()
    await confirmDialog(page)

    await expectToast(page, 'FAQ가 삭제되었습니다.')
    await expect(page.getByText(TEST_FAQ.updatedQuestion)).toBeHidden({ timeout: 5_000 })
  })
})
