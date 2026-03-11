/**
 * 대회 플로우 스크린샷 캡쳐 스크립트
 * 실행: node scripts/capture-tournament-screenshots.mjs
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../public/guide/screenshots/tournament-flow')
const BASE_URL = 'http://localhost:3000'

const STEPS = [
  { key: 'list',       label: '대회 목록' },
  { key: 'detail',     label: '대회 상세' },
  { key: 'apply',      label: '참가 신청 폼' },
  { key: 'payment',    label: '계좌이체 안내' },
  { key: 'pending',    label: '입금 확인 대기' },
  { key: 'my-entries', label: '내 신청 내역' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile',  width: 390,  height: 844 },
]

async function run() {
  const browser = await chromium.launch({ headless: true })

  for (const vp of VIEWPORTS) {
    console.log(`\n📐 ${vp.name} (${vp.width}x${vp.height})`)

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    })

    await context.addInitScript(() => {
      localStorage.setItem('guide_onboarding_dismissed', 'true')
    })

    for (const step of STEPS) {
      const page = await context.newPage()
      const url = `${BASE_URL}/screenshot-demo/tournament?step=${step.key}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(600)

      const filename = `${step.key}-${vp.name}.png`
      const filepath = path.join(OUTPUT_DIR, filename)
      await page.screenshot({ path: filepath, fullPage: false })
      console.log(`  ✓ ${filename}  (${step.label})`)
      await page.close()
    }

    await context.close()
  }

  await browser.close()
  console.log('\n✅ 대회 플로우 스크린샷 캡쳐 완료')
}

run().catch(console.error)
