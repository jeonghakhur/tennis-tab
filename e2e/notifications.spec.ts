import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// ── 환경 설정 ──
const BASE_URL = 'http://localhost:3000'
const SUPABASE_URL = 'https://tigqwrehpzwaksnvcrrx.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ3F3cmVocHp3YWtzbnZjcnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3Mzk5MTgsImV4cCI6MjA4NTMxNTkxOH0.B0eK_cfB0KJg4pJjZnXnveHC2jSjspFPbQA3bM0Hj60'
const SUPABASE_SERVICE_KEY = 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'

const E2E_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const E2E_PASSWORD = 'E2ETest2026x'

const PROJECT_REF = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? ''
const COOKIE_NAME = `sb-${PROJECT_REF}-auth-token`

const SCREENSHOT_DIR = 'test-results/notifications'

// ── 14가지 알림 타입별 테스트 데이터 ──
const NOTIFICATION_TEST_DATA = [
  {
    type: 'ENTRY_APPROVED',
    title: '[E2E] 참가 신청이 승인되었습니다',
    message: '제3회 마포구청장배 테니스대회 혼합복식 참가 신청이 승인되었습니다.',
  },
  {
    type: 'ENTRY_REJECTED',
    title: '[E2E] 참가 신청이 거절되었습니다',
    message: '정원 초과로 참가 신청이 거절되었습니다. 다음 대회에 참가해주세요.',
  },
  {
    type: 'TOURNAMENT_STATUS_CHANGED',
    title: '[E2E] 대회 상태가 변경되었습니다',
    message: '제3회 마포구청장배 대회가 "모집중" 상태로 변경되었습니다.',
  },
  {
    type: 'BRACKET_GENERATED',
    title: '[E2E] 대진표가 생성되었습니다',
    message: '혼합복식 A조 대진표가 생성되었습니다. 경기 일정을 확인해주세요.',
  },
  {
    type: 'MATCH_RESULT_UPDATED',
    title: '[E2E] 경기 결과가 확정되었습니다',
    message: '준결승 - 홍길동/김철수 vs 이영희/박민수 결과가 입력되었습니다.',
  },
  {
    type: 'CLUB_MEMBER_APPROVED',
    title: '[E2E] 클럽 가입이 승인되었습니다',
    message: '마포 테니스 클럽 가입이 승인되었습니다. 환영합니다!',
  },
  {
    type: 'CLUB_MEMBER_REJECTED',
    title: '[E2E] 클럽 가입이 거절되었습니다',
    message: '마포 테니스 클럽 가입이 거절되었습니다.',
  },
  {
    type: 'CLUB_INVITED',
    title: '[E2E] 클럽에 초대되었습니다',
    message: '마포 테니스 클럽에서 회원으로 초대했습니다.',
  },
  {
    type: 'INQUIRY_REPLIED',
    title: '[E2E] 문의에 답변이 등록되었습니다',
    message: '"결제 관련 문의" 문의에 대한 답변이 등록되었습니다.',
  },
  {
    type: 'REFUND_COMPLETED',
    title: '[E2E] 환불이 완료되었습니다',
    message: '30,000원 환불 처리가 완료되었습니다.',
  },
  {
    type: 'ENTRY_SUBMITTED',
    title: '[E2E] 새 참가 신청이 접수되었습니다',
    message: '홍길동님이 혼합복식에 참가 신청했습니다.',
  },
  {
    type: 'ENTRY_CANCELLED',
    title: '[E2E] 참가 신청이 취소되었습니다',
    message: '이영희님이 혼합복식 참가를 취소했습니다.',
  },
  {
    type: 'PAYMENT_COMPLETED',
    title: '[E2E] 입금이 확인되었습니다',
    message: '홍길동님의 참가비 30,000원 입금이 확인되었습니다.',
  },
  {
    type: 'CLUB_JOIN_REQUESTED',
    title: '[E2E] 클럽 가입 신청이 있습니다',
    message: '홍길동님이 마포 테니스 클럽 가입을 신청했습니다.',
  },
]

// ── 공용 유틸 ──

function createAdminClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

async function loginViaCookie(page: import('@playwright/test').Page) {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const {
    data: { session },
    error,
  } = await supabase.auth.signInWithPassword({
    email: E2E_EMAIL,
    password: E2E_PASSWORD,
  })
  if (error || !session) throw new Error(`로그인 실패: ${error?.message}`)

  const tokenValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  })

  await page.context().addCookies([
    {
      name: COOKIE_NAME,
      value: encodeURIComponent(tokenValue),
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      secure: false,
    },
  ])

  return session.user.id
}

async function cleanupAllNotifications(userId: string) {
  const admin = createAdminClient()
  await admin.from('notifications').delete().eq('user_id', userId)
}

async function cleanupTestNotifications(userId: string) {
  const admin = createAdminClient()
  await admin.from('notifications').delete().eq('user_id', userId).like('title', '[E2E]%')
}

async function insertSingleNotification(
  userId: string,
  data: { type: string; title: string; message: string },
) {
  const admin = createAdminClient()
  const { error } = await admin.from('notifications').insert({
    user_id: userId,
    type: data.type,
    title: data.title,
    message: data.message,
    is_read: false,
    metadata: {},
  })
  if (error) throw new Error(`알림 삽입 실패: ${error.message}`)
}

async function insertTestNotifications(userId: string) {
  const admin = createAdminClient()
  const rows = NOTIFICATION_TEST_DATA.map((n, i) => ({
    user_id: userId,
    type: n.type,
    title: n.title,
    message: n.message,
    is_read: false,
    metadata: {},
    created_at: new Date(Date.now() - (NOTIFICATION_TEST_DATA.length - i) * 60000).toISOString(),
  }))
  const { error } = await admin.from('notifications').insert(rows)
  if (error) throw new Error(`알림 삽입 실패: ${error.message}`)
}

/** 알림 페이지 이동 + networkidle 대기 */
async function goToNotifications(page: import('@playwright/test').Page) {
  await page.goto(`${BASE_URL}/my/notifications`)
  await page.waitForLoadState('networkidle')
}

/** 알림 아이템 버튼 로케이터 (제목 텍스트 기반) */
function getNotifItem(page: import('@playwright/test').Page, title: string) {
  return page.locator('button', { has: page.getByText(title, { exact: true }) }).first()
}

// ──────────────────────────────────────────────────────────────────
// 테스트
// ──────────────────────────────────────────────────────────────────

test.describe('알림 시스템 E2E 테스트', () => {
  test.describe.configure({ mode: 'serial' })

  let userId: string

  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext()
    const page = await ctx.newPage()
    userId = await loginViaCookie(page)
    await cleanupAllNotifications(userId)
    await ctx.close()
  })

  test.afterAll(async () => {
    if (userId) await cleanupTestNotifications(userId)
  })

  // ── 14개 타입별 10개 시나리오 ──
  for (const notifData of NOTIFICATION_TEST_DATA) {
    test.describe(`[${notifData.type}]`, () => {
      test.describe.configure({ mode: 'serial' })

      // 01. 제목 텍스트 표시 확인
      test('01-제목 표시', async ({ page }) => {
        await cleanupAllNotifications(userId)
        await insertSingleNotification(userId, notifData)
        await loginViaCookie(page)
        await goToNotifications(page)

        await expect(page.getByText(notifData.title, { exact: true })).toBeVisible({
          timeout: 10000,
        })

        await page.screenshot({
          path: `${SCREENSHOT_DIR}/${notifData.type.toLowerCase()}-01-display.png`,
          fullPage: true,
        })
      })

      // 02. 메시지 내용 표시 확인
      test('02-메시지 표시', async ({ page }) => {
        await loginViaCookie(page)
        await goToNotifications(page)

        await expect(page.getByText(notifData.message)).toBeVisible({ timeout: 10000 })
      })

      // 03. 미읽음 파란 점 표시 확인
      test('03-미읽음 파란 점', async ({ page }) => {
        await loginViaCookie(page)
        await goToNotifications(page)

        const notifItem = getNotifItem(page, notifData.title)
        await expect(notifItem.locator('span.bg-blue-500')).toBeVisible({ timeout: 10000 })
      })

      // 04. 클릭 후 읽음 처리 (파란 점 제거)
      test('04-클릭 후 읽음 처리', async ({ page }) => {
        await loginViaCookie(page)
        await goToNotifications(page)

        const notifItem = getNotifItem(page, notifData.title)
        // 버튼 전체를 클릭하여 읽음 처리
        await notifItem.click()

        // 클라이언트 상태 업데이트로 파란 점 사라짐 대기
        await expect(notifItem.locator('span.bg-blue-500')).toHaveCount(0, { timeout: 10000 })
      })

      // 05. 벨 배지 미읽음 카운트 반영
      test('05-벨 배지 미읽음 카운트', async ({ page }) => {
        // 이전 테스트에서 읽음 처리됨 → 새로 삽입
        await cleanupAllNotifications(userId)
        await insertSingleNotification(userId, notifData)

        await loginViaCookie(page)
        await page.goto(`${BASE_URL}/tournaments`)
        await page.waitForLoadState('networkidle')

        const bell = page.locator('button[aria-label*="알림"]')
        await expect(bell).toBeVisible({ timeout: 10000 })

        const badge = bell.locator('span.bg-red-500')
        await expect(badge).toBeVisible({ timeout: 10000 })
        await expect(badge).toHaveText('1')
      })

      // 06. 읽음 후 벨 배지 카운트 감소
      test('06-읽음 후 벨 배지 감소', async ({ page }) => {
        // DB에서 직접 읽음 처리
        const admin = createAdminClient()
        await admin
          .from('notifications')
          .update({ is_read: true })
          .eq('user_id', userId)
          .like('title', '[E2E]%')

        await loginViaCookie(page)
        await page.goto(`${BASE_URL}/tournaments`)
        await page.waitForLoadState('networkidle')

        const bell = page.locator('button[aria-label*="알림"]')
        await expect(bell).toBeVisible({ timeout: 10000 })

        // 배지가 사라져야 함 (미읽음 0)
        const badge = bell.locator('span.bg-red-500')
        await expect(badge).toBeHidden({ timeout: 10000 })
      })

      // 07. 아이콘 표시 확인
      test('07-아이콘 표시', async ({ page }) => {
        await cleanupAllNotifications(userId)
        await insertSingleNotification(userId, notifData)

        await loginViaCookie(page)
        await goToNotifications(page)

        const notifItem = getNotifItem(page, notifData.title)
        await expect(notifItem.locator('svg').first()).toBeVisible({ timeout: 10000 })
      })

      // 08. 시간 텍스트 표시 확인
      test('08-시간 표시', async ({ page }) => {
        await loginViaCookie(page)
        await goToNotifications(page)

        const notifItem = getNotifItem(page, notifData.title)
        // 방금 삽입된 알림이므로 상대시간 텍스트 존재
        await expect(
          notifItem.getByText(/방금 전|\d+분 전|\d+시간 전|어제|\d+일 전|\d+주 전/),
        ).toBeVisible({ timeout: 10000 })
      })

      // 09. 동일 타입 2개 삽입 후 모두 표시
      test('09-동일 타입 2개 표시', async ({ page }) => {
        await cleanupAllNotifications(userId)
        await insertSingleNotification(userId, {
          ...notifData,
          title: `${notifData.title} #1`,
        })
        await insertSingleNotification(userId, {
          ...notifData,
          title: `${notifData.title} #2`,
        })

        await loginViaCookie(page)
        await goToNotifications(page)

        await expect(
          page.getByText(`${notifData.title} #1`, { exact: true }),
        ).toBeVisible({ timeout: 10000 })
        await expect(
          page.getByText(`${notifData.title} #2`, { exact: true }),
        ).toBeVisible({ timeout: 10000 })
      })

      // 10. 삭제 후 재삽입 표시
      test('10-삭제 후 재삽입', async ({ page }) => {
        await cleanupAllNotifications(userId)
        await insertSingleNotification(userId, notifData)

        await loginViaCookie(page)
        await goToNotifications(page)
        await expect(page.getByText(notifData.title, { exact: true })).toBeVisible({
          timeout: 10000,
        })

        // 삭제
        const admin = createAdminClient()
        await admin
          .from('notifications')
          .delete()
          .eq('user_id', userId)
          .eq('type', notifData.type)

        await page.reload()
        await page.waitForLoadState('networkidle')
        await expect(page.getByText('알림이 없습니다')).toBeVisible({ timeout: 10000 })

        // 재삽입
        await insertSingleNotification(userId, notifData)
        await page.reload()
        await page.waitForLoadState('networkidle')
        await expect(page.getByText(notifData.title, { exact: true })).toBeVisible({
          timeout: 10000,
        })
      })
    })
  }

  // ── 통합 시나리오 ──
  test.describe('통합 시나리오', () => {
    test.describe.configure({ mode: 'serial' })

    // 통합 01. 14개 타입 전부 삽입 후 목록 전체 표시
    test('01-14개 타입 전체 표시', async ({ page }) => {
      await cleanupAllNotifications(userId)
      await insertTestNotifications(userId)

      await loginViaCookie(page)
      await goToNotifications(page)

      for (const data of NOTIFICATION_TEST_DATA) {
        await expect(page.getByText(data.title, { exact: true })).toBeVisible({
          timeout: 10000,
        })
      }

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/integration-01-all-types.png`,
        fullPage: true,
      })
    })

    // 통합 02. 모두읽음 버튼으로 전체 읽음 처리
    test('02-모두 읽음 처리', async ({ page }) => {
      await loginViaCookie(page)
      await goToNotifications(page)

      const markAllBtn = page.getByRole('button', { name: '모두 읽음' })
      await expect(markAllBtn).toBeVisible({ timeout: 10000 })
      await markAllBtn.click()

      // 파란 점 전부 사라짐
      await expect(page.locator('span.bg-blue-500.rounded-full')).toHaveCount(0, {
        timeout: 10000,
      })

      // 모두 읽음 버튼 사라짐
      await expect(markAllBtn).toBeHidden({ timeout: 5000 })

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/integration-02-mark-all-read.png`,
        fullPage: true,
      })
    })

    // 통합 03. 빈 상태 표시
    test('03-빈 상태', async ({ page }) => {
      await cleanupAllNotifications(userId)

      await loginViaCookie(page)
      await goToNotifications(page)

      await expect(page.getByText('알림이 없습니다')).toBeVisible({ timeout: 10000 })

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/integration-03-empty-state.png`,
      })
    })

    // 통합 04. 벨 아이콘 9+ 배지 표시
    test('04-벨 배지 9+', async ({ page }) => {
      await cleanupAllNotifications(userId)
      await insertTestNotifications(userId)

      await loginViaCookie(page)
      await page.goto(`${BASE_URL}/tournaments`)
      await page.waitForLoadState('networkidle')

      const bell = page.locator('button[aria-label*="알림"]')
      await expect(bell).toBeVisible({ timeout: 10000 })

      const badge = bell.locator('span.bg-red-500')
      await expect(badge).toBeVisible({ timeout: 10000 })
      await expect(badge).toHaveText('9+')

      await page.screenshot({
        path: `${SCREENSHOT_DIR}/integration-04-bell-badge-9plus.png`,
      })
    })
  })
})
