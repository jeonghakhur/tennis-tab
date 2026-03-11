/**
 * 클럽 모임 탭 / 순위 탭 전체 기능 스크린샷 캡처 (인증 필요)
 *
 * 전제: npx playwright test --project=setup 으로 세션 저장 필요
 *
 * 실행: npx playwright test e2e/club-tabs-screenshots.auth.spec.ts --project=chromium-auth
 *
 * 결과: public/guide/screenshots/club-flow/
 *   sessions-{name}-desktop.png
 *   sessions-{name}-mobile.png
 *   rankings-{name}-desktop.png
 *   rankings-{name}-mobile.png
 */
import { test, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT_DIR = path.join(process.cwd(), "public/guide/screenshots/club-flow");

// 건승회 클럽 URL
const CLUB_URL = "http://localhost:3000/clubs/3084ca9f-c86c-4365-917a-b25cd36e2291";

// 테스트 타임아웃 3분
test.setTimeout(180_000);

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

// ── 헬퍼 ──────────────────────────────────────────────────
async function capture(page: Page, name: string) {
  const dest = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`✅  ${path.basename(dest)}`);
}

/** 클럽 페이지로 이동 후 탭 버튼 대기, 콘텐츠 로드 대기 */
async function goToClubTab(page: Page, tabKey: string, tabPattern: RegExp) {
  // 탭 URL 파라미터로 직접 이동
  await page.goto(`${CLUB_URL}?tab=${tabKey}`);
  try {
    await page.waitForLoadState("networkidle", { timeout: 8_000 });
  } catch { /* 계속 */ }
  await page.waitForTimeout(1_000);

  // 멤버십 확인 후 탭이 나타날 때까지 대기 (최대 20초)
  const tabBtn = page.locator("button").filter({ hasText: tabPattern }).first();
  try {
    await tabBtn.waitFor({ state: "visible", timeout: 20_000 });
    console.log(`✅  탭 확인: ${tabPattern}`);
  } catch {
    console.log(`⚠️  탭 버튼 없음: ${tabPattern} — 현재 페이지 상태 캡처`);
  }

  // 콘텐츠 로드까지 polling (최대 15초)
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(1000);
    const loading = await page.locator("text=불러오는 중").count();
    const cards = await page.locator("button.glass-card").count();
    const table = await page.locator("table").count();
    const empty = await page.locator("text=아직 모임이 없습니다").count()
      + await page.locator("text=경기 기록이 없습니다").count();
    if (loading === 0 && (cards > 0 || table > 0 || empty > 0)) break;
  }
  await page.waitForTimeout(500);
}

// ── 모임 탭 캡처 ────────────────────────────────────────
async function captureSessionsTab(page: Page, suffix: string) {
  const SESSION_CARD = "button.glass-card";

  // S01: 모임 탭 기본 목록
  await goToClubTab(page, "sessions", /모임/);

  const evalCount = await page.evaluate(() => document.querySelectorAll('button.glass-card').length);
  const locCount = await page.locator(SESSION_CARD).count();
  console.log(`📊 button.glass-card — evaluate: ${evalCount}, locator: ${locCount}`);

  await capture(page, `sessions-01-list-${suffix}`);

  // S02: 세션 카드가 있으면 hover 캡처
  const firstCard = page.locator(SESSION_CARD).first();

  if (evalCount > 0) {
    await firstCard.hover();
    await page.waitForTimeout(200);
    await capture(page, `sessions-02-card-hover-${suffix}`);
  } else {
    await capture(page, `sessions-02-empty-${suffix}`);
  }

  // S03~S09: 첫 번째 세션 상세 진입
  if (evalCount === 0) {
    console.log(`⚠️  세션 없음 — 세션 상세 단계 생략 (${suffix})`);
    return;
  }

  await firstCard.click();
  await page.waitForLoadState("domcontentloaded");
  await page.waitForTimeout(1500);

  // S03: 세션 상세 전체
  await capture(page, `sessions-03-detail-${suffix}`);

  // S04: 상단으로 스크롤
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await capture(page, `sessions-04-detail-top-${suffix}`);

  // S05: 참석 응답 버튼 영역
  const attendanceBtn = page
    .locator("button")
    .filter({ hasText: /^참석$|^불참$|^미정$|응답 변경/ })
    .first();
  if ((await attendanceBtn.count()) > 0) {
    await attendanceBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, `sessions-05-attendance-form-${suffix}`);
  }

  // S06: 참석자 목록 영역
  const attendanceSection = page
    .locator("[class*='attendance'], [class*='Attendance']")
    .first();
  if ((await attendanceSection.count()) > 0) {
    await attendanceSection.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, `sessions-06-attendance-list-${suffix}`);
  }

  // S07: 경기 대진표 영역
  const matchBoard = page
    .locator("[class*='match'], [class*='Match'], [class*='bracket']")
    .first();
  if ((await matchBoard.count()) > 0) {
    await matchBoard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(400);
    await capture(page, `sessions-07-matchboard-${suffix}`);
  }

  // S08: 댓글 영역
  const commentArea = page
    .locator("textarea[placeholder*='댓글'], [class*='comment'], [class*='Comment']")
    .first();
  if ((await commentArea.count()) > 0) {
    await commentArea.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, `sessions-08-comments-${suffix}`);
  }

  // S09: 페이지 하단
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(400);
  await capture(page, `sessions-09-detail-bottom-${suffix}`);
}

// ── 순위 탭 캡처 ────────────────────────────────────────
async function captureRankingsTab(page: Page, suffix: string) {
  // R01: 순위 탭 기본
  await goToClubTab(page, "rankings", /순위/);
  await capture(page, `rankings-01-default-${suffix}`);

  // R02: 빈 상태
  const noData = page.locator("text=경기 기록이 없습니다").first();
  if ((await noData.count()) > 0) {
    await capture(page, `rankings-02-empty-${suffix}`);
    console.log(`ℹ️  순위 데이터 없음 (${suffix}) — 정렬/필터 단계 생략`);
    return;
  }

  // R03~R04: 승률 기준 정렬
  const winRateBtn = page.locator("button").filter({ hasText: "승률" }).first();
  if ((await winRateBtn.count()) > 0) {
    await winRateBtn.click();
    await page.waitForTimeout(500);
    await capture(page, `rankings-03-sort-winrate-${suffix}`);
    await winRateBtn.click();
    await page.waitForTimeout(400);
    await capture(page, `rankings-04-sort-winrate-desc-${suffix}`);
  }

  // R05: 승점 기준 정렬
  const winPointsBtn = page.locator("button").filter({ hasText: "승점" }).first();
  if ((await winPointsBtn.count()) > 0) {
    await winPointsBtn.click();
    await page.waitForTimeout(500);
    await capture(page, `rankings-05-sort-winpoints-${suffix}`);
  }

  // R06: 직접 설정 기간 필터
  const customPeriodBtn = page
    .locator("button")
    .filter({ hasText: /직접 설정/ })
    .first();
  if ((await customPeriodBtn.count()) > 0) {
    await customPeriodBtn.click();
    await page.waitForTimeout(500);
    await capture(page, `rankings-06-custom-period-${suffix}`);
  }

  // R07: 첫 번째 순위 행 클릭 → 회원 상세 모달
  await goToClubTab(page, "rankings", /순위/);
  await page.waitForTimeout(500);

  const rankRow = page
    .locator("button")
    .filter({ hasText: /^\s*\d+/ })
    .first();
  const tableRow = page
    .locator("tr[role='button'], tr button, [class*='row'] button")
    .first();

  if ((await rankRow.count()) > 0) {
    await rankRow.click();
    await page.waitForTimeout(700);
    await capture(page, `rankings-07-member-modal-${suffix}`);
  } else if ((await tableRow.count()) > 0) {
    await tableRow.click();
    await page.waitForTimeout(700);
    await capture(page, `rankings-07-member-modal-${suffix}`);
  }
}

// ── 데스크탑 테스트 ──────────────────────────────────────
test("모임/순위 탭 전체 기능 — 데스크탑 (1280×800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await captureSessionsTab(page, "desktop");
  await captureRankingsTab(page, "desktop");
});

// ── 모바일 테스트 ────────────────────────────────────────
test("모임/순위 탭 전체 기능 — 모바일 (390×844)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureSessionsTab(page, "mobile");
  await captureRankingsTab(page, "mobile");
});
