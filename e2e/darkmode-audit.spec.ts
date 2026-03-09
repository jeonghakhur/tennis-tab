/**
 * 전체 페이지 다크모드 감사
 * - input, card, modal 배경 흰색 여부
 * - 텍스트 색상 미대응 여부
 */
import { test, Page } from '@playwright/test'
import * as fs from 'fs'

const BASE_URL = 'http://localhost:3000'
const REPORT_DIR = 'e2e/darkmode-audit'

async function enableDark(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(1200)
}

async function auditDarkMode(page: Page, pageName: string) {
  const issues = await page.evaluate(() => {
    const results: Array<{ type: string; element: string; color: string; problem: string }> = []

    const WHITE = ['rgb(255, 255, 255)', 'rgba(255, 255, 255', 'rgb(248, 250, 252)', 'rgb(249, 250, 251)', 'rgb(243, 244, 246)', 'rgb(241, 245, 249)', 'rgb(239, 246, 255)']
    const DARK_TEXT = ['rgb(0, 0, 0)', 'rgb(17, 24, 39)', 'rgb(31, 41, 55)', 'rgb(55, 65, 81)']

    // 입력 필드 배경
    document.querySelectorAll('input, textarea, select').forEach(el => {
      const style = getComputedStyle(el)
      const bg = style.backgroundColor
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && WHITE.some(w => bg.startsWith(w.replace('rgba(255, 255, 255', '')))) {
        results.push({ type: '입력필드', element: `${el.tagName} placeholder="${(el as HTMLInputElement).placeholder?.slice(0,20)}"`, color: bg, problem: '흰색 배경 유지' })
      }
    })

    // 카드/패널 배경
    document.querySelectorAll('[class*="card"], [class*="Card"], [class*="panel"], [class*="modal"], [class*="Modal"], [class*="dialog"], [class*="bg-white"], [class*="rounded"]').forEach(el => {
      const style = getComputedStyle(el)
      const bg = style.backgroundColor
      const rect = el.getBoundingClientRect()
      if (rect.width > 100 && rect.height > 40 && WHITE.some(w => bg.startsWith(w.replace('rgba(255, 255, 255', '').replace('b(', 'b(')))) {
        const cls = el.className?.toString().slice(0, 50) || el.tagName
        results.push({ type: '카드/컨테이너', element: cls, color: bg, problem: '흰색 배경 유지' })
      }
    })

    // 텍스트 미대응
    document.querySelectorAll('h1,h2,h3,p,span,label,button,td,th').forEach(el => {
      const style = getComputedStyle(el)
      const color = style.color
      const rect = el.getBoundingClientRect()
      if (rect.width > 0 && DARK_TEXT.includes(color)) {
        const text = el.textContent?.trim().slice(0, 20) || ''
        if (text) results.push({ type: '텍스트', element: `"${text}"`, color, problem: '검정 텍스트 유지' })
      }
    })

    return results.slice(0, 30)
  })

  return { pageName, issues, count: issues.length }
}

const PAGES = [
  { name: '대회목록', path: '/tournaments', needLogin: false },
  { name: '대회상세', path: '/tournaments', needLogin: false, clickFirst: 'a[href^="/tournaments/"]' },
  { name: '클럽목록', path: '/clubs', needLogin: false },
  { name: '커뮤니티', path: '/community', needLogin: false },
  { name: '로그인', path: '/auth/login', needLogin: false },
  { name: '회원가입', path: '/auth/signup', needLogin: false },
  { name: '수상내역', path: '/awards', needLogin: false },
  { name: 'FAQ지원', path: '/support', needLogin: false },
]

test('🌙 전체 페이지 다크모드 감사', async ({ page }) => {
  const allResults: any[] = []

  for (const { name, path, clickFirst } of PAGES) {
    await page.goto(`${BASE_URL}${path}`)
    await page.waitForLoadState('networkidle')

    if (clickFirst) {
      const link = page.locator(clickFirst).first()
      if (await link.count() > 0) {
        await link.click()
        await page.waitForLoadState('networkidle')
      }
    }

    await enableDark(page)
    await page.screenshot({ path: `${REPORT_DIR}/${name}.png`, fullPage: true })

    const result = await auditDarkMode(page, name)
    allResults.push(result)
    console.log(`\n📄 [${name}] 문제 ${result.count}건`)
    result.issues.forEach(i => console.log(`  ${i.type}: ${i.element} → ${i.problem} (${i.color})`))
  }

  // 리포트 저장
  const report = allResults.map(r => `
## ${r.pageName} (${r.count}건)
${r.count === 0 ? '✅ 이상 없음' : r.issues.map((i: any) => `- [${i.type}] ${i.element}: ${i.problem}`).join('\n')}
`).join('\n')

  fs.writeFileSync(`${REPORT_DIR}/darkmode-report.md`, `# 다크모드 감사 리포트\n${report}`)
  console.log('\n📊 리포트 저장 완료: e2e/darkmode-audit/darkmode-report.md')
})
