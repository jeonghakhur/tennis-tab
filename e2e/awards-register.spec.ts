/**
 * 수상자 등록 E2E 테스트
 *
 * 테스트 전용 어드민 계정 사용 (e2e.admin@mapo-tennis-test.dev)
 * 실행: npx playwright test e2e/awards-register.spec.ts --reporter=html
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'E2ETest2026x'
const TEST_PLAYER = `E2E테스트_${Date.now()}`
const TOURNAMENT_LABEL = '2025년 · 제2회 마포구협회장배 시니어대회'
const DIVISION_NAME = '시니어부'

// ──────────────────────────────────────────────
// 어드민 로그인
// ──────────────────────────────────────────────
async function adminLogin(page: Page) {
  await page.goto('http://localhost:3000/auth/login')
  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  await page.waitForURL('http://localhost:3000/**', { timeout: 15_000 })
  await page.waitForLoadState('networkidle')
}

// ══════════════════════════════════════════════
// 비인증 사용자 — 어드민 버튼 숨김
// ══════════════════════════════════════════════
test('비인증: 수상자 등록 버튼 미표시 + 목록 확인', async ({ page }) => {
  await page.goto('http://localhost:3000/awards')
  await page.waitForLoadState('networkidle')

  await expect(page.getByRole('heading', { name: '명예의 전당' })).toBeVisible({ timeout: 10_000 })
  await expect(page.getByRole('button', { name: '수상자 등록' })).toBeHidden()

  await page.screenshot({
    path: 'test-results/awards-00-guest.png',
    fullPage: true,
  })
})

// ══════════════════════════════════════════════
// 어드민 등록 플로우 (serial: 순서 의존)
// ══════════════════════════════════════════════
test.describe('어드민 수상자 등록 플로우', () => {
  test.describe.configure({ mode: 'serial' })

  test.beforeEach(async ({ page }) => {
    await adminLogin(page)
  })

  // ─────────────────────────────────────
  // 1. 등록 전 상태
  // ─────────────────────────────────────
  test('1. 등록 전 — 어드민 버튼 + 기존 목록 스크린샷', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    await expect(page.getByRole('heading', { name: '명예의 전당' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: '수상자 등록' })).toBeVisible({ timeout: 5_000 })

    // 📸 등록 전 전체 스크린샷
    await page.screenshot({
      path: 'test-results/awards-01-before.png',
      fullPage: true,
    })
  })

  // ─────────────────────────────────────
  // 2. 모달 열기 + 빈 폼 캡처
  // ─────────────────────────────────────
  test('2. 수상자 등록 모달 열기 및 구조 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '수상자 등록' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // 필수 필드 레이블 확인 (label 태그로 정확히 매칭)
    await expect(modal.locator('label', { hasText: '대회' }).first()).toBeVisible()
    await expect(modal.locator('label', { hasText: '부문' }).first()).toBeVisible()
    await expect(modal.locator('label', { hasText: '순위' }).first()).toBeVisible()
    await expect(modal.locator('label', { hasText: '선수 이름' }).first()).toBeVisible()

    // 순위 버튼 4개 (exact: true — "우승"이 "준우승"에도 매칭되지 않도록)
    for (const rank of ['우승', '준우승', '공동3위', '3위']) {
      await expect(modal.getByRole('button', { name: rank, exact: true })).toBeVisible()
    }

    // 📸 빈 모달 스크린샷
    await page.screenshot({ path: 'test-results/awards-02-modal-empty.png' })

    // 닫기 버튼 (aria-label="닫기")
    await page.getByRole('button', { name: '닫기' }).click()
    await expect(modal).toBeHidden({ timeout: 3_000 })
  })

  // ─────────────────────────────────────
  // 3. 유효성 검사 — 대회 미선택
  // ─────────────────────────────────────
  test('3. 대회 미선택 시 에러 알럿', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '수상자 등록' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // 선수 입력 없이 바로 등록 시도
    await modal.getByRole('button', { name: /명 등록/ }).click()

    const alertDialog = page.getByRole('alertdialog')
    await expect(alertDialog).toBeVisible({ timeout: 3_000 })
    await expect(alertDialog).toContainText('대회를 선택해주세요')

    // 📸 유효성 에러 스크린샷
    await page.screenshot({ path: 'test-results/awards-03-validation.png' })

    await alertDialog.getByRole('button', { name: '확인' }).click()
    await modal.getByRole('button', { name: '취소' }).click()
  })

  // ─────────────────────────────────────
  // 4. 등록 성공
  // ─────────────────────────────────────
  test('4. 수상자 등록 성공 + 목록 반영 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    await page.getByRole('button', { name: '수상자 등록' }).click()
    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible()

    // ── 대회 선택 (shadcn Select: role=combobox) ──
    const selects = modal.locator('[role="combobox"]')
    await selects.nth(0).click()
    await page.getByRole('option', { name: TOURNAMENT_LABEL }).click()

    // ── 부문 선택 ──
    await selects.nth(1).click()
    await page.getByRole('option', { name: DIVISION_NAME }).click()

    // 대회 요약 박스 표시 확인 (요약 span — exact로 중복 방지)
    await expect(modal.getByText('제2회 마포구협회장배 시니어대회', { exact: true })).toBeVisible({ timeout: 3_000 })

    // ── 순위: 우승 (기본값) ──
    await expect(modal.getByRole('button', { name: '우승', exact: true })).toBeVisible()

    // ── 선수 이름: 첫 번째 컴보박스 (4번째 combobox: 대회/부문/클럽/선수) ──
    await selects.nth(3).click()

    // CommandInput에 이름 입력
    await page.locator('[cmdk-input]').fill(TEST_PLAYER)
    await page.waitForTimeout(200)

    // "직접 입력" 항목 클릭
    await page.getByText('직접 입력').first().click()

    // 선수 이름이 트리거에 반영되었는지 확인
    await expect(selects.nth(3)).toContainText(TEST_PLAYER)

    // 📸 폼 완성 스크린샷
    await page.screenshot({ path: 'test-results/awards-04-form-filled.png' })

    // ── 등록 ──
    await modal.getByRole('button', { name: '1명 등록' }).click()

    // Toast 확인
    await expect(page.getByText('수상자가 등록되었습니다')).toBeVisible({ timeout: 8_000 })
    await expect(modal).toBeHidden({ timeout: 5_000 })

    // 목록 새로고침 후 카드 확인
    await page.waitForLoadState('networkidle')
    await expect(page.getByText(TEST_PLAYER)).toBeVisible({ timeout: 10_000 })

    // 📸 등록 후 목록 스크린샷
    await page.screenshot({
      path: 'test-results/awards-05-after.png',
      fullPage: true,
    })
  })

  // ─────────────────────────────────────
  // 5. 등록된 카드 클릭 → 상세 모달
  // ─────────────────────────────────────
  test('5. 등록된 수상자 카드 클릭 → 어드민 상세 모달', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    const card = page.locator('button', { hasText: TEST_PLAYER })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5_000 })
    await expect(modal.getByText('수상자 점수 관리')).toBeVisible()
    await expect(modal.getByText(TEST_PLAYER)).toBeVisible()

    // 📸 상세 모달 스크린샷
    await page.screenshot({ path: 'test-results/awards-06-detail-modal.png' })

    // Footer의 닫기 버튼 (X 아이콘이 아닌 텍스트 버튼)
    await modal.getByRole('button', { name: '닫기' }).last().click()
    await expect(modal).toBeHidden({ timeout: 3_000 })
  })

  // ─────────────────────────────────────
  // 6. 수상자 삭제
  // ─────────────────────────────────────
  test('6. 수상자 삭제 → 목록에서 제거 확인', async ({ page }) => {
    await page.goto('http://localhost:3000/awards')
    await page.waitForLoadState('networkidle')

    // 등록된 카드 클릭
    const card = page.locator('button', { hasText: TEST_PLAYER })
    await expect(card).toBeVisible({ timeout: 10_000 })
    await card.click()

    const modal = page.getByRole('dialog')
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // 📸 삭제 버튼 있는 상태
    await page.screenshot({ path: 'test-results/awards-07-before-delete.png' })

    // 삭제 버튼 클릭
    await modal.getByRole('button', { name: '수상자 삭제' }).click()

    // 확인 다이얼로그
    const confirmDialog = page.getByRole('alertdialog')
    await expect(confirmDialog).toBeVisible({ timeout: 3_000 })
    await expect(confirmDialog).toContainText('삭제하시겠습니까')

    // 📸 확인 다이얼로그
    await page.screenshot({ path: 'test-results/awards-08-delete-confirm.png' })

    // 삭제 확인
    await confirmDialog.getByRole('button', { name: '삭제' }).click()

    // Toast + 모달 닫힘 확인
    await expect(page.getByText('수상자 기록이 삭제되었습니다')).toBeVisible({ timeout: 8_000 })
    await expect(modal).toBeHidden({ timeout: 5_000 })

    // 목록에서 제거 확인
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button', { hasText: TEST_PLAYER })).toBeHidden({ timeout: 10_000 })

    // 📸 삭제 후 목록
    await page.screenshot({ path: 'test-results/awards-09-after-delete.png', fullPage: true })
  })
})
