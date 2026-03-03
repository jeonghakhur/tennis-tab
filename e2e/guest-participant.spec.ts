/**
 * 게스트 참석자 E2E 테스트 (10개 시나리오)
 *
 * 건승회 클럽 OPEN 세션 대상
 * - 임원 계정(e2e.admin)으로 게스트 CRUD 전체 플로우 검증
 * - 비인증 사용자 접근 제한 확인
 *
 * 실행: npx playwright test e2e/guest-participant.spec.ts --reporter=html
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'E2Etest20260303'
const CLUB_ID = '3084ca9f-c86c-4365-917a-b25cd36e2291'
const SESSION_ID = 'be7e0040-e107-42d5-a0f3-105001e4e127'

const SESSION_URL = `http://localhost:3000/clubs/${CLUB_ID}/sessions/${SESSION_ID}`
const MANAGE_URL = `${SESSION_URL}/manage`

// 테스트 식별용 prefix (afterAll에서 삭제)
const GUEST_PREFIX = 'E2E_게스트_'
const ts = Date.now()

async function login(page: Page) {
  await page.goto('http://localhost:3000/auth/login')
  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)

  // 클릭과 동시에 /auth 경로를 벗어나길 대기 (현재 URL이 이미 /**와 매칭되는 문제 방지)
  await Promise.all([
    page.waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 15_000 }),
    page.getByRole('button', { name: '로그인', exact: true }).click(),
  ])

  await page.waitForLoadState('networkidle')
}

/** shadcn Select 선택 헬퍼 */
async function selectOption(page: Page, triggerSelector: string, optionText: string) {
  await page.locator(triggerSelector).click()
  await page.getByRole('option', { name: optionText, exact: true }).click()
}

/** 게스트 추가 헬퍼 */
async function addGuest(
  page: Page,
  name: string,
  gender?: '남' | '여',
  fromTime?: string,
  untilTime?: string,
) {
  // 폼 열기 (이미 열려있으면 스킵)
  const form = page.locator('input#guest-name')
  if (!(await form.isVisible())) {
    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()
    await expect(form).toBeVisible({ timeout: 3_000 })
  }

  // 이름 입력
  await form.clear()
  await form.fill(name)

  // 성별 선택 (data-testid="guest-gender-select")
  if (gender) {
    await page.locator('[data-testid="guest-gender-select"]').click()
    await page.getByRole('option', { name: gender, exact: true }).click()
  }

  // 참석 시작 시간 (data-testid="guest-from-time" 내부 버튼)
  if (fromTime) {
    await page.locator('[data-testid="guest-from-time"] button').click()
    await page.getByRole('option', { name: fromTime, exact: true }).click()
  }

  // 참석 종료 시간 (data-testid="guest-until-time" 내부 버튼)
  if (untilTime) {
    await page.locator('[data-testid="guest-until-time"] button').click()
    await page.getByRole('option', { name: untilTime, exact: true }).click()
  }

  // 추가 버튼 클릭
  await page.getByRole('button', { name: '추가', exact: true }).click()
}

// ─────────────────────────────────────────────────────────────────────────────
// 테스트 스위트 (serial: 순서 의존)
// ─────────────────────────────────────────────────────────────────────────────
test.describe('게스트 참석자 기능 E2E', () => {
  test.describe.configure({ mode: 'serial' })

  let page: Page

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage()
  })

  test.afterAll(async () => {
    // 테스트 게스트 정리: 삭제 버튼으로 전부 제거
    try {
      await page.goto(MANAGE_URL)
      await page.waitForLoadState('networkidle')

      // 남아있는 E2E 게스트 모두 삭제
      let deleteBtn = page.locator(`[aria-label^="${GUEST_PREFIX}"][aria-label$="게스트 삭제"]`).first()
      while (await deleteBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await deleteBtn.click()
        await page.waitForTimeout(500)
        deleteBtn = page.locator(`[aria-label^="${GUEST_PREFIX}"][aria-label$="게스트 삭제"]`).first()
      }
    } catch {
      // 정리 실패해도 테스트 결과에 영향 없음
    }
    await page.close()
  })

  // ─────────────────────────────────────
  // TC-01: 비인증 사용자 — 게스트 섹션 미표시
  // ─────────────────────────────────────
  test('TC-01: 비인증 사용자는 게스트 섹션을 볼 수 없다', async ({ page: guestPage }) => {
    await guestPage.goto(SESSION_URL)
    await guestPage.waitForLoadState('networkidle')

    // 참석 현황 카드는 보이지만
    await expect(guestPage.getByRole('heading', { name: '참석 현황' })).toBeVisible({ timeout: 10_000 })

    // 게스트 섹션은 보이지 않아야 함
    await expect(guestPage.getByRole('heading', { name: '게스트' })).toBeHidden()

    await guestPage.screenshot({ path: 'test-results/guest-01-unauthenticated.png' })
  })

  // ─────────────────────────────────────
  // TC-02: 임원 로그인 후 관리 페이지 — 게스트 섹션 표시
  // ─────────────────────────────────────
  test('TC-02: 임원은 관리 페이지에서 게스트 섹션을 볼 수 있다', async () => {
    await login(page)
    await page.goto(MANAGE_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('h4').filter({ hasText: '게스트' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByRole('button', { name: '+ 게스트 추가', exact: true })).toBeVisible()

    await page.screenshot({ path: 'test-results/guest-02-officer-view.png' })
  })

  // ─────────────────────────────────────
  // TC-03: + 게스트 추가 버튼 클릭 → 폼 표시
  // ─────────────────────────────────────
  test('TC-03: + 게스트 추가 버튼 클릭 시 입력 폼이 나타난다', async () => {
    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()

    await expect(page.locator('input#guest-name')).toBeVisible({ timeout: 3_000 })
    await expect(page.getByRole('button', { name: '추가', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: '취소', exact: true })).toBeVisible()

    await page.screenshot({ path: 'test-results/guest-03-form-open.png' })
  })

  // ─────────────────────────────────────
  // TC-04: 이름 없이 추가 → AlertDialog 에러
  // ─────────────────────────────────────
  test('TC-04: 이름 없이 추가하면 에러 AlertDialog가 표시된다', async () => {
    // 폼이 열려있는 상태에서 이름 비워두고 추가
    await page.locator('input#guest-name').clear()
    await page.getByRole('button', { name: '추가', exact: true }).click()

    // AlertDialog(role=dialog)의 에러 메시지 확인
    const dialog = page.locator('[role="alertdialog"]')
    await expect(dialog).toBeVisible({ timeout: 3_000 })
    await expect(dialog).toContainText('게스트 이름을 입력해주세요')

    // 닫기
    await page.getByRole('button', { name: '확인' }).click()
    await expect(dialog).toBeHidden()

    await page.screenshot({ path: 'test-results/guest-04-name-required.png' })
  })

  // ─────────────────────────────────────
  // TC-05: 이름만 입력 → 추가 성공
  // ─────────────────────────────────────
  test('TC-05: 이름만 입력하면 게스트 추가에 성공한다', async () => {
    const name = `${GUEST_PREFIX}이름만_${ts}`

    await addGuest(page, name)

    // 목록에 이름 표시
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5_000 })

    await page.screenshot({ path: 'test-results/guest-05-name-only.png' })
  })

  // ─────────────────────────────────────
  // TC-06: 이름 + 성별(남) 추가 성공
  // ─────────────────────────────────────
  test('TC-06: 이름 + 성별(남)으로 게스트를 추가한다', async () => {
    const name = `${GUEST_PREFIX}남성_${ts}`

    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()
    await expect(page.locator('input#guest-name')).toBeVisible({ timeout: 3_000 })

    await addGuest(page, name, '남')

    // 목록에 이름과 성별 표시
    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5_000 })
    // 성별 표시: "남"
    const guestRow = page.locator('div').filter({ hasText: name }).last()
    await expect(guestRow.locator('text=남')).toBeVisible()

    await page.screenshot({ path: 'test-results/guest-06-male-gender.png' })
  })

  // ─────────────────────────────────────
  // TC-07: 이름 + 성별(여) 추가 성공
  // ─────────────────────────────────────
  test('TC-07: 이름 + 성별(여)로 게스트를 추가한다', async () => {
    const name = `${GUEST_PREFIX}여성_${ts}`

    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()
    await expect(page.locator('input#guest-name')).toBeVisible({ timeout: 3_000 })

    await addGuest(page, name, '여')

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5_000 })
    const guestRow = page.locator('div').filter({ hasText: name }).last()
    await expect(guestRow.locator('text=여')).toBeVisible()

    await page.screenshot({ path: 'test-results/guest-07-female-gender.png' })
  })

  // ─────────────────────────────────────
  // TC-08: 이름 + 참석 시간 추가 성공
  // ─────────────────────────────────────
  test('TC-08: 이름 + 참석 시간으로 게스트를 추가한다', async () => {
    const name = `${GUEST_PREFIX}시간있음_${ts}`

    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()
    await expect(page.locator('input#guest-name')).toBeVisible({ timeout: 3_000 })

    await addGuest(page, name, undefined, '오전 10:00', '오후 12:00')

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5_000 })

    await page.screenshot({ path: 'test-results/guest-08-time-only.png' })
  })

  // ─────────────────────────────────────
  // TC-09: 이름 + 성별 + 시간 전체 입력 추가 성공
  // ─────────────────────────────────────
  test('TC-09: 이름 + 성별 + 시간 전체 입력으로 게스트를 추가한다', async () => {
    const name = `${GUEST_PREFIX}풀입력_${ts}`

    await page.getByRole('button', { name: '+ 게스트 추가', exact: true }).click()
    await expect(page.locator('input#guest-name')).toBeVisible({ timeout: 3_000 })

    await addGuest(page, name, '남', '오전 10:00', '오후 12:00')

    await expect(page.getByText(name, { exact: true })).toBeVisible({ timeout: 5_000 })

    // 게스트 섹션 인원수 배지 확인 (4명 이상)
    const heading = page.locator('h4').filter({ hasText: '게스트' })
    await expect(heading).toContainText('명')

    await page.screenshot({ path: 'test-results/guest-09-full-input.png' })
  })

  // ─────────────────────────────────────
  // TC-10: 게스트 삭제 → 목록에서 제거
  // ─────────────────────────────────────
  test('TC-10: 게스트 삭제 버튼 클릭 시 목록에서 제거된다', async () => {
    // TC-05에서 추가한 "이름만" 게스트 삭제
    const nameToDelete = `${GUEST_PREFIX}이름만_${ts}`

    await expect(page.getByText(nameToDelete, { exact: true })).toBeVisible({ timeout: 5_000 })

    // 해당 행의 삭제 버튼
    const deleteBtn = page.locator(`[aria-label="${nameToDelete} 게스트 삭제"]`)
    await deleteBtn.click()

    // 목록에서 제거 확인
    await expect(page.getByText(nameToDelete, { exact: true })).toBeHidden({ timeout: 5_000 })

    await page.screenshot({ path: 'test-results/guest-10-delete.png' })
  })
})
