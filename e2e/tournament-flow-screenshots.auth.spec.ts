/**
 * 대회 전체 플로우 스크린샷 캡처 (인증 필요)
 *
 * 실행: npx playwright test e2e/tournament-flow-screenshots.auth.spec.ts --project=chromium-auth
 *
 * 결과: public/guide/screenshots/tournament-flow/
 *   01-list-desktop.png       / 01-list-mobile.png
 *   02-detail-desktop.png     / 02-detail-mobile.png
 *   03-detail-scroll-desktop.png / 03-detail-scroll-mobile.png
 *   04-apply-btn-desktop.png  / 04-apply-btn-mobile.png       (접수중 대회 있을 때만)
 *   05-apply-form-desktop.png / 05-apply-form-mobile.png      (접수중 대회 있을 때만)
 *   06-bracket-desktop.png    / 06-bracket-mobile.png
 *   07-my-entries-desktop.png / 07-my-entries-mobile.png
 */
import { test, type Page } from "@playwright/test";
import path from "path";
import fs from "fs";

const OUT_DIR = path.join(process.cwd(), "public/guide/screenshots/tournament-flow");
const BASE = "http://localhost:3000";

test.setTimeout(240_000);

test.beforeAll(() => {
  // 기존 이미지 전체 삭제 후 새로 캡처 (병렬 실행 시 ENOENT 무시)
  if (fs.existsSync(OUT_DIR)) {
    for (const f of fs.readdirSync(OUT_DIR)) {
      try { fs.unlinkSync(path.join(OUT_DIR, f)); } catch { /* 이미 삭제됨 */ }
    }
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log("🗑️  tournament-flow 폴더 초기화 완료");
});

// ── 헬퍼 ──────────────────────────────────────────────────────
async function capture(page: Page, name: string) {
  const dest = path.join(OUT_DIR, `${name}.png`);
  await page.screenshot({ path: dest, fullPage: false });
  console.log(`✅  ${path.basename(dest)}`);
}

async function gotoSafe(page: Page, url: string) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
      return;
    } catch (e) {
      if (attempt === 3) throw e;
      console.log(`⚠️  goto 재시도 ${attempt}/3: ${url}`);
      await page.waitForTimeout(3_000);
    }
  }
}

async function settle(page: Page, ms = 1_000) {
  try { await page.waitForLoadState("networkidle", { timeout: 6_000 }); } catch { /* 계속 */ }
  await page.waitForTimeout(ms);
}

// ── 플로우 캡처 ────────────────────────────────────────────────
async function captureTournamentFlow(page: Page, suffix: string) {
  // ─────────────────────────────────────
  // 01: 대회 목록
  // ─────────────────────────────────────
  await gotoSafe(page, `${BASE}/tournaments`);
  await settle(page, 800);
  await capture(page, `01-list-${suffix}`);

  // 첫 번째 대회 링크 수집
  const cards = page.locator("a[href^='/tournaments/']");
  const cardCount = await cards.count();
  if (cardCount === 0) {
    console.log(`⚠️  대회 없음 — 상세 이후 단계 생략 (${suffix})`);
    return;
  }

  const firstHref = await cards.first().getAttribute("href");
  if (!firstHref) return;

  // ─────────────────────────────────────
  // 02: 대회 상세 — 상단 (제목 + 기본 정보)
  // ─────────────────────────────────────
  await gotoSafe(page, `${BASE}${firstHref}`);
  await settle(page, 1_000);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);
  await capture(page, `02-detail-${suffix}`);

  // ─────────────────────────────────────
  // 03: 대회 상세 — 스크롤 (요강·부서·지도)
  // ─────────────────────────────────────
  await page.evaluate(() => window.scrollBy({ top: 400, behavior: "instant" }));
  await page.waitForTimeout(400);
  await capture(page, `03-detail-scroll-${suffix}`);

  // ─────────────────────────────────────
  // 04: 참가 신청 버튼 강조 (접수중 대회)
  // ─────────────────────────────────────
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
  await page.waitForTimeout(300);

  const applyBtn = page.locator("button").filter({ hasText: /참가 신청|신청하기/ }).first();
  const hasApply = (await applyBtn.count()) > 0;

  if (hasApply) {
    await applyBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    // 버튼 하이라이트
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /참가 신청|신청하기/.test(b.textContent ?? "")
      );
      if (btn) {
        (btn as HTMLElement).style.outline = "3px solid #ccff00";
        (btn as HTMLElement).style.outlineOffset = "4px";
      }
    });
    await page.waitForTimeout(200);
    await capture(page, `04-apply-btn-${suffix}`);

    // ─────────────────────────────────────
    // 05: 신청 폼 (모달 or 페이지)
    // ─────────────────────────────────────
    // 하이라이트 제거 후 클릭
    await page.evaluate(() => {
      const btn = [...document.querySelectorAll("button")].find((b) =>
        /참가 신청|신청하기/.test(b.textContent ?? "")
      );
      if (btn) {
        (btn as HTMLElement).style.outline = "";
        (btn as HTMLElement).style.outlineOffset = "";
      }
    });
    await applyBtn.click();
    await settle(page, 1_200);

    const modal = page.locator("[role='dialog']").first();
    const form  = page.locator("form").first();
    if ((await modal.count()) > 0 || (await form.count()) > 0) {
      await capture(page, `05-apply-form-${suffix}`);
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
  } else {
    console.log(`ℹ️  참가 신청 버튼 없음 (${suffix}) — 현재 접수 중인 대회 없음`);
  }

  // ─────────────────────────────────────
  // 06: 대진표 탭 or /bracket 경로
  // ─────────────────────────────────────
  // 대진표 탭 버튼 탐색
  await gotoSafe(page, `${BASE}${firstHref}`);
  await settle(page, 800);

  const bracketTab = page.locator("button, a").filter({ hasText: /대진표/ }).first();
  if ((await bracketTab.count()) > 0) {
    await bracketTab.scrollIntoViewIfNeeded();
    await bracketTab.click();
    await settle(page, 1_000);
    await capture(page, `06-bracket-${suffix}`);
  } else {
    // 직접 경로 시도
    await gotoSafe(page, `${BASE}${firstHref}/bracket`);
    await settle(page, 1_500);
    const hasBracket = await page.locator("table, [class*='bracket'], svg").count();
    if (hasBracket > 0) {
      await capture(page, `06-bracket-${suffix}`);
    } else {
      console.log(`ℹ️  대진표 없음 (${suffix}) — 아직 생성 전`);
    }
  }

  // ─────────────────────────────────────
  // 07: 내 신청 내역
  // ─────────────────────────────────────
  await gotoSafe(page, `${BASE}/my/entries`);
  await settle(page, 1_000);
  await capture(page, `07-my-entries-${suffix}`);
}

// ── 데스크탑 (1280×800) ──────────────────────────────────────
test("대회 플로우 — 데스크탑 (1280×800)", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await captureTournamentFlow(page, "desktop");
});

// ── 모바일 (390×844) ────────────────────────────────────────
test("대회 플로우 — 모바일 (390×844)", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await captureTournamentFlow(page, "mobile");
});
