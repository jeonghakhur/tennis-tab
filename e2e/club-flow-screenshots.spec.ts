/**
 * 클럽 전체 플로우 스크린샷 캡처
 *
 * 실행: npx playwright test e2e/club-flow-screenshots.spec.ts --project=chromium
 *
 * 결과: public/guide/screenshots/club-flow/
 *   {step}-{name}-desktop.png   (1280×800)
 *   {step}-{name}-mobile.png    (390×844)
 */
import { test, type Page, type BrowserContext } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT_DIR = path.join(process.cwd(), "public/guide/screenshots/club-flow");

async function capture(page: Page, name: string, viewport: "desktop" | "mobile") {
  const dest = path.join(OUT_DIR, `${name}-${viewport}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`✅  ${path.basename(dest)}`);
}

/** 첫 번째 클럽 href 반환 */
async function getFirstClubHref(page: Page): Promise<string | null> {
  const link = page.locator("a[href^='/clubs/']").first();
  if ((await link.count()) === 0) return null;
  return link.getAttribute("href");
}

/** 탭 클릭 헬퍼 */
async function clickTab(page: Page, text: string | RegExp) {
  const tab = page.locator("button, a[role='tab']").filter({ hasText: text }).first();
  if ((await tab.count()) > 0) {
    await tab.click();
    await page.waitForTimeout(600);
  }
}

/** 첫 번째 세션 href 반환 */
async function getFirstSessionHref(page: Page): Promise<string | null> {
  const link = page
    .locator("a[href*='/sessions/']")
    .filter({ hasNot: page.locator("[href*='/manage']") })
    .first();
  if ((await link.count()) === 0) return null;
  return link.getAttribute("href");
}

// ────────────────────────────────────────────────────────────
// 공통 플로우 캡처 함수 (viewport별로 재사용)
// ────────────────────────────────────────────────────────────
async function captureClubFlow(
  page: Page,
  viewport: "desktop" | "mobile"
) {
  // 01. 클럽 목록
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "01-club-list", viewport);

  // 02. 클럽 목록 — 검색
  const searchInput = page
    .locator("input[type='search'], input[placeholder*='검색']")
    .first();
  if ((await searchInput.count()) > 0) {
    await searchInput.fill("테니스");
    await page.waitForTimeout(600);
    await capture(page, "02-club-search", viewport);
  }

  // 클럽 상세로 이동 — 검색 상태 무관하게 목록 다시 로드
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  const clubHref = await getFirstClubHref(page);
  if (!clubHref) {
    console.log(`⚠️  클럽 없음 — 상세 단계 생략 (${viewport})`);
    return;
  }

  // 03. 클럽 상세 — 기본(모임 탭)
  await page.goto(clubHref);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "03-club-detail-sessions", viewport);

  // 04. 클럽 상세 — 순위 탭
  await clickTab(page, /순위/);
  await capture(page, "04-club-detail-rankings", viewport);

  // 05. 클럽 상세 — 회원 탭 (공개 범위만)
  await clickTab(page, /회원/);
  await page.waitForTimeout(600);
  await capture(page, "05-club-detail-members", viewport);

  // 06. 클럽 상세 — 입상 탭
  await clickTab(page, /입상/);
  await page.waitForTimeout(600);
  await capture(page, "06-club-detail-awards", viewport);

  // 07. 클럽 상세 — 정보 탭
  await clickTab(page, /정보|소개|info/i);
  await page.waitForTimeout(600);
  await capture(page, "07-club-detail-info", viewport);

  // 모임 탭으로 돌아가서 세션 클릭
  await clickTab(page, /모임/);
  await page.waitForTimeout(600);

  const sessionHref = await getFirstSessionHref(page);
  if (!sessionHref) {
    console.log(`⚠️  세션 없음 — 세션 상세 생략 (${viewport})`);
    return;
  }

  // 08. 세션 상세 — 전체 뷰
  await page.goto(sessionHref);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "08-session-detail", viewport);

  // 09. 세션 상세 — 참석 응답 폼 (있는 경우)
  const attendanceForm = page
    .locator("button")
    .filter({ hasText: /참석|불참|응답/ })
    .first();
  if ((await attendanceForm.count()) > 0) {
    await attendanceForm.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, "09-session-attendance", viewport);
  }

  // 10. 세션 상세 — 경기 대진표 (있는 경우)
  const matchBoard = page.locator("[class*='match'], [class*='bracket']").first();
  if ((await matchBoard.count()) > 0) {
    await matchBoard.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await capture(page, "10-session-matchboard", viewport);
  }
}

// ────────────────────────────────────────────────────────────
// 인증 없이 접근 가능한 플로우 (GUEST)
// ────────────────────────────────────────────────────────────
test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

test("클럽 플로우 — 데스크탑 (1280×800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await captureClubFlow(page, "desktop");
});

test("클럽 플로우 — 모바일 (390×844)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureClubFlow(page, "mobile");
});

// ────────────────────────────────────────────────────────────
// 인증 필요 플로우 (로그인 환경변수 설정 시)
// ────────────────────────────────────────────────────────────
async function loginIfPossible(page: Page): Promise<boolean> {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;
  if (!email || !password) return false;

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  try {
    await page.waitForURL("/", { timeout: 8_000 });
    return true;
  } catch {
    return false;
  }
}

test("클럽 플로우 (로그인) — 데스크탑", async ({ page }) => {
  const loggedIn = await loginIfPossible(page);
  if (!loggedIn) {
    console.log("⚠️  로그인 생략 — 비인증 데스크탑 플로우만 실행됨");
    return;
  }

  await page.setViewportSize({ width: 1280, height: 800 });

  // 클럽 가입 버튼 UI
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const clubHref = await getFirstClubHref(page);
  if (!clubHref) return;

  await page.goto(clubHref);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "11-club-join-button-desktop", "desktop");

  // 관리 탭 (임원인 경우)
  const manageTab = page
    .locator("button, a[role='tab']")
    .filter({ hasText: /관리/ })
    .first();
  if ((await manageTab.count()) > 0) {
    await manageTab.click();
    await page.waitForTimeout(800);
    await capture(page, "12-club-manage-tab-desktop", "desktop");
  }
});

test("클럽 플로우 (로그인) — 모바일", async ({ page }) => {
  const loggedIn = await loginIfPossible(page);
  if (!loggedIn) return;

  await page.setViewportSize({ width: 390, height: 844 });

  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  const clubHref = await getFirstClubHref(page);
  if (!clubHref) return;

  await page.goto(clubHref);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "11-club-join-button-mobile", "mobile");
});
