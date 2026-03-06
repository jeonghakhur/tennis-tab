/**
 * 복식 partner_user_id E2E 테스트
 *
 * 테스트 시나리오:
 * 1. partner_user_id로 연동된 엔트리가 내 경기에 표시되는지 검증
 * 2. searchPartnerByName API — profiles에서 이름 검색 결과 확인
 *
 * 전제:
 * - entry d48cfd39 (허정학 + 잘될꺼야 율 파트너) — 복식 대회 CONFIRMED + bracket_matches 존재
 * - e2e 어드민 계정을 테스트 내에서 partner_user_id로 임시 설정 후 복구
 *
 * 실행: npx playwright test e2e/partner-entry.spec.ts --reporter=html
 */
import { test, expect, type Page } from '@playwright/test'

const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'E2ETest2026x'
const E2E_ADMIN_USER_ID = 'e472e215-dfa2-4215-a996-4cb29b66e073'

// 허정학 엔트리 (partner_data.name = 잘될꺼야 율, bracket_matches COMPLETED)
const TARGET_ENTRY_ID = 'd48cfd39-4d58-496a-bff3-d939c9b763da'
const TOURNAMENT_TITLE = '제8회 마포구체육회장기 테니스대회'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Supabase REST API로 partner_user_id 업데이트 (Service Role) */
async function setPartnerUserId(entryId: string, userId: string | null) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/tournament_entries?id=eq.${entryId}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ partner_user_id: userId }),
  })
  if (!resp.ok) throw new Error(`partner_user_id 업데이트 실패: ${resp.status}`)
}

async function login(page: Page) {
  await page.goto('http://localhost:3000/auth/login')
  await page.waitForLoadState('networkidle')
  await page.getByLabel('이메일').fill(TEST_EMAIL)
  await page.getByLabel('비밀번호').fill(TEST_PASSWORD)
  await page.getByRole('button', { name: '로그인', exact: true }).click()
  // 로그인 완료 후 홈('/')으로 이동
  await page.waitForURL('http://localhost:3000/', { timeout: 20_000 })
  await page.waitForLoadState('networkidle')
}

// ══════════════════════════════════════════════
// 1. 내 경기 — partner_user_id 기반 경기 표시
// 순서 의존성이 있으므로 serial 모드 실행
// ══════════════════════════════════════════════
test.describe.configure({ mode: 'serial' })

test.describe('내 경기: 파트너 연동 엔트리 표시', () => {
  test.beforeAll(async () => {
    // e2e 어드민을 파트너로 임시 설정
    await setPartnerUserId(TARGET_ENTRY_ID, E2E_ADMIN_USER_ID)
  })

  test.afterAll(async () => {
    // 테스트 후 원복
    await setPartnerUserId(TARGET_ENTRY_ID, null)
  })

  test('파트너로 등록된 대회 경기가 내 경기 탭에 표시된다', async ({ page }) => {
    await login(page)
    await page.goto('http://localhost:3000/my/profile')
    await page.waitForLoadState('networkidle')

    // 내 경기 탭 버튼 클릭 (role="button" 사용)
    const matchTabBtn = page.getByRole('button', { name: /내 경기/ })
    await expect(matchTabBtn).toBeVisible({ timeout: 10_000 })
    await matchTabBtn.click()
    await page.waitForLoadState('networkidle')

    // 해당 대회 경기가 표시되어야 함
    await expect(
      page.getByText(TOURNAMENT_TITLE).first()
    ).toBeVisible({ timeout: 10_000 })
  })

  test('파트너 연동 해제 후 해당 경기가 내 경기 목록에서 제거된다', async ({ page }) => {
    // partner_user_id null로 설정
    await setPartnerUserId(TARGET_ENTRY_ID, null)

    await login(page)
    await page.goto('http://localhost:3000/my/profile')
    await page.waitForLoadState('networkidle')

    const matchTabBtn = page.getByRole('button', { name: /내 경기/ })
    await expect(matchTabBtn).toBeVisible({ timeout: 10_000 })
    await matchTabBtn.click()
    await page.waitForLoadState('networkidle')

    // e2e 어드민은 본인 신청 없음 + partner_user_id null → 대회 타이틀 미표시
    await expect(page.getByText(TOURNAMENT_TITLE)).toHaveCount(0)
  })
})

// ══════════════════════════════════════════════
// 2. searchPartnerByName API 검증 (Supabase REST)
// ══════════════════════════════════════════════
test.describe('파트너 검색 API', () => {
  test('이름으로 profiles 검색 시 일치하는 사용자가 반환된다', async ({ request }) => {
    const resp = await request.get(
      `${SUPABASE_URL}/rest/v1/profiles?name=ilike.*허정*&select=id,name,rating,club&limit=5`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      }
    )
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(Array.isArray(data)).toBe(true)

    const found = (data as Array<{ id: string; name: string }>).find((p) => p.name === '허정학')
    expect(found).toBeDefined()
    expect(found!.id).toBe('08df4f8f-7409-4267-8d5d-69dd6cdcd531')
  })

  test('2자 미만 검색어도 DB 레벨에서는 결과 반환 (서버 액션 레벨에서 가드됨)', async ({ request }) => {
    // searchPartnerByName 서버 액션은 2자 미만이면 빈 배열 반환 (코드 레벨 가드)
    // Supabase REST는 1자도 검색 가능 — 이 테스트는 API 레이어 정상 동작 확인
    const resp = await request.get(
      `${SUPABASE_URL}/rest/v1/profiles?name=ilike.*허*&select=id,name&limit=5`,
      {
        headers: {
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
      }
    )
    expect(resp.ok()).toBeTruthy()
    const data = await resp.json()
    expect(Array.isArray(data)).toBe(true)
  })
})
