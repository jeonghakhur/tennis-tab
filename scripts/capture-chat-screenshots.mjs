/**
 * 채팅 AI 어시스턴트 스크린샷 캡쳐 스크립트
 * 실행: node scripts/capture-chat-screenshots.mjs
 */
import { chromium } from 'playwright'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = path.join(__dirname, '../public/guide/screenshots')
const BASE_URL = 'http://localhost:3000'

const SCENARIOS = [
  { key: 'tournament-search', label: '대회 검색' },
  { key: 'my-application', label: '나의 참가 신청' },
  { key: 'winners', label: '우승자 조회' },
  { key: 'club-schedule', label: '클럽 모임 일정' },
]

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 800 },
  { name: 'mobile', width: 390, height: 844 },
]

async function run() {
  const browser = await chromium.launch({ headless: true })

  for (const vp of VIEWPORTS) {
    console.log(`\n📐 ${vp.name} (${vp.width}x${vp.height})`)

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 2,
    })

    for (const scenario of SCENARIOS) {
      console.log(`  🔍 ${scenario.label}`)

      const page = await context.newPage()
      const url = `${BASE_URL}/screenshot-demo?type=${scenario.key}`
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 })
      await page.waitForTimeout(800)

      const filename = `chat-${scenario.key}-${vp.name}.png`
      const filepath = path.join(OUTPUT_DIR, filename)
      await page.screenshot({ path: filepath, fullPage: false })
      console.log(`    ✓ ${filename}`)

      await page.close()
    }

    await context.close()
  }

  await browser.close()
  console.log('\n✅ 모든 스크린샷 캡쳐 완료')
}

run().catch(console.error)
