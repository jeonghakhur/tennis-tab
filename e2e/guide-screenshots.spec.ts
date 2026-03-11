/**
 * 이용 안내 페이지용 스크린샷 캡처 스크립트
 *
 * 실행: npx playwright test e2e/guide-screenshots.spec.ts --project=chromium
 *
 * 인증이 필요한 화면(AI 채팅)은 .env.local의 E2E_TEST_EMAIL / E2E_TEST_PASSWORD 필요.
 * 미설정 시 해당 단계는 건너뜁니다.
 *
 * 캡처 결과: public/guide/screenshots/
 */
import { test, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT_DIR = path.join(process.cwd(), "public/guide/screenshots");

// 캡처 헬퍼: 지정 경로에 PNG 저장
async function capture(page: Page, filename: string) {
  const dest = path.join(OUT_DIR, filename);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`✅  ${filename}`);
}

test.beforeAll(() => {
  fs.mkdirSync(OUT_DIR, { recursive: true });
});

// ── 뷰포트: 데스크탑 ──
test.use({ viewport: { width: 1280, height: 800 } });

// ────────────────────────────────────────────────
// 대회 참가 섹션 스크린샷
// ────────────────────────────────────────────────
test("01 대회 목록", async ({ page }) => {
  await page.goto("/tournaments");
  await page.waitForLoadState("networkidle");
  // 카드 최소 1개 대기 (없으면 빈 상태 그대로 캡처)
  await page.waitForTimeout(800);
  await capture(page, "tournament-list.png");
});

test("02 대회 상세 (첫 번째 대회)", async ({ page }) => {
  await page.goto("/tournaments");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // 첫 번째 대회 카드 클릭
  const firstCard = page.locator("a[href^='/tournaments/']").first();
  const count = await firstCard.count();
  if (count === 0) {
    console.log("⚠️  대회 없음 — tournament-detail.png 생략");
    return;
  }

  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "tournament-detail.png");
});

test("03 참가 신청 버튼 강조", async ({ page }) => {
  await page.goto("/tournaments");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const firstCard = page.locator("a[href^='/tournaments/']").first();
  if ((await firstCard.count()) === 0) {
    console.log("⚠️  대회 없음 — tournament-apply.png 생략");
    return;
  }
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);

  // 참가 신청 버튼 하이라이트 (JS로 스크롤 + 박스 강조)
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button")].find((b) =>
      b.textContent?.includes("참가 신청")
    );
    if (btn) {
      btn.scrollIntoView({ behavior: "instant", block: "center" });
      btn.style.outline = "3px solid #ccff00";
      btn.style.outlineOffset = "4px";
    }
  });
  await page.waitForTimeout(300);
  await capture(page, "tournament-apply.png");
});

test("04 대진표 화면", async ({ page }) => {
  // 대진표 링크가 있는 대회를 찾아 이동
  await page.goto("/tournaments");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // '진행중' 또는 '종료' 상태 대회 우선 탐색
  const bracketLink = page
    .locator("a[href*='bracket'], a[href*='대진표']")
    .first();
  const hasBracketLink = (await bracketLink.count()) > 0;

  if (!hasBracketLink) {
    // 첫 번째 대회 상세에서 대진표 버튼 탐색
    const firstCard = page.locator("a[href^='/tournaments/']").first();
    if ((await firstCard.count()) === 0) {
      console.log("⚠️  대회 없음 — tournament-bracket.png 생략");
      return;
    }
    await firstCard.click();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(500);

    const detailBracket = page
      .locator("a, button")
      .filter({ hasText: "대진표" })
      .first();
    if ((await detailBracket.count()) > 0) {
      await detailBracket.click();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await capture(page, "tournament-bracket.png");
    } else {
      console.log("⚠️  대진표 없음 — tournament-bracket.png 생략");
    }
    return;
  }

  await bracketLink.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "tournament-bracket.png");
});

// ────────────────────────────────────────────────
// 클럽 이용 섹션 스크린샷
// ────────────────────────────────────────────────
test("05 클럽 목록", async ({ page }) => {
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "club-list.png");
});

test("06 클럽 상세 (첫 번째 클럽)", async ({ page }) => {
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const firstCard = page.locator("a[href^='/clubs/']").first();
  if ((await firstCard.count()) === 0) {
    console.log("⚠️  클럽 없음 — club-detail.png 생략");
    return;
  }
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "club-detail.png");
});

test("07 클럽 모임 탭", async ({ page }) => {
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const firstCard = page.locator("a[href^='/clubs/']").first();
  if ((await firstCard.count()) === 0) {
    console.log("⚠️  클럽 없음 — club-session.png 생략");
    return;
  }
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // 모임 탭 클릭
  const sessionTab = page
    .locator("button, a")
    .filter({ hasText: /모임/ })
    .first();
  if ((await sessionTab.count()) > 0) {
    await sessionTab.click();
    await page.waitForTimeout(600);
  }
  await capture(page, "club-session.png");
});

test("08 클럽 순위 탭", async ({ page }) => {
  await page.goto("/clubs");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  const firstCard = page.locator("a[href^='/clubs/']").first();
  if ((await firstCard.count()) === 0) {
    console.log("⚠️  클럽 없음 — club-ranking.png 생략");
    return;
  }
  await firstCard.click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // 순위 탭 클릭
  const rankingTab = page
    .locator("button, a")
    .filter({ hasText: /순위/ })
    .first();
  if ((await rankingTab.count()) > 0) {
    await rankingTab.click();
    await page.waitForTimeout(600);
  }
  await capture(page, "club-ranking.png");
});

// ────────────────────────────────────────────────
// AI 채팅 섹션 스크린샷 (로그인 필요)
// ────────────────────────────────────────────────
test("09 AI 채팅 메인 (로그인)", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.log("⚠️  E2E_TEST_EMAIL/PASSWORD 미설정 — chat-main.png 생략");
    // 비로그인 상태 메인 페이지라도 캡처
    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(800);
    await capture(page, "chat-main.png");
    return;
  }

  // 로그인
  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(800);
  await capture(page, "chat-main.png");
});

test("10 AI 채팅 대화 예시 (로그인)", async ({ page }) => {
  const email = process.env.E2E_TEST_EMAIL;
  const password = process.env.E2E_TEST_PASSWORD;

  if (!email || !password) {
    console.log("⚠️  E2E_TEST_EMAIL/PASSWORD 미설정 — chat-conversation.png 생략");
    return;
  }

  await page.goto("/auth/login");
  await page.getByLabel("이메일").fill(email);
  await page.getByLabel("비밀번호").fill(password);
  await page.getByRole("button", { name: "로그인" }).click();
  await page.waitForURL("/", { timeout: 10_000 });
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);

  // 채팅 입력
  const input = page.locator("textarea, input[type='text']").last();
  if ((await input.count()) > 0) {
    await input.fill("지금 신청 가능한 대회 알려줘");
    await input.press("Enter");
    // AI 응답 대기 (최대 15초)
    await page.waitForTimeout(5_000);
  }
  await capture(page, "chat-conversation.png");
});
