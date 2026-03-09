/**
 * 버튼 텍스트 가시성 감사 — 다크모드
 */
import { test, Page } from '@playwright/test'

const BASE_URL = 'http://localhost:3000'

async function enableDark(page: Page) {
  await page.evaluate(() => {
    localStorage.setItem('theme', 'dark')
    document.documentElement.setAttribute('data-theme', 'dark')
    document.documentElement.classList.add('dark')
  })
  await page.waitForTimeout(1200)
}

async function auditButtons(page: Page) {
  return await page.evaluate(() => {
    const results: Array<{
      text: string
      color: string
      bg: string
      ratio: number
      selector: string
    }> = []

    const toLinear = (c: number) => {
      const s = c / 255
      return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
    }
    const lum = (r: number, g: number, b: number) =>
      0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
    const parseRgb = (s: string) => s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)

    const btns = document.querySelectorAll('button, a[role="button"], [class*="rounded"][class*="px"]')
    btns.forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width < 20 || rect.height < 20) return
      const text = el.textContent?.trim().slice(0, 25) || ''
      if (!text) return

      const style = getComputedStyle(el)
      const color = style.color

      // 실제 배경 찾기
      let bgEl: Element | null = el
      let bgColor = ''
      while (bgEl) {
        const bg = getComputedStyle(bgEl).backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          bgColor = bg
          break
        }
        bgEl = bgEl.parentElement
      }
      if (!bgColor) bgColor = 'rgb(10, 10, 10)'

      const cm = parseRgb(color)
      const bm = parseRgb(bgColor)
      if (!cm || !bm) return

      const l1 = lum(+cm[1], +cm[2], +cm[3])
      const l2 = lum(+bm[1], +bm[2], +bm[3])
      const lighter = Math.max(l1, l2)
      const darker = Math.min(l1, l2)
      const ratio = (lighter + 0.05) / (darker + 0.05)

      if (ratio < 3.0) {
        results.push({
          text: `"${text}"`,
          color,
          bg: bgColor,
          ratio: +ratio.toFixed(2),
          selector: el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '')
        })
      }
    })

    // 중복 제거
    const seen = new Set<string>()
    return results.filter(r => {
      const key = `${r.text}|${r.bg}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 30)
  })
}

const PAGES = [
  { name: '대회목록', path: '/tournaments' },
  { name: '대회상세', path: '/tournaments/e5d00a2d-c6c3-4d6e-bf2a-8920d3754caf' },
  { name: '대진표', path: '/tournaments/e5d00a2d-c6c3-4d6e-bf2a-8920d3754caf/bracket' },
  { name: '클럽목록', path: '/clubs' },
  { name: '클럽상세', path: '/clubs/3084ca9f-c86c-4365-917a-b25cd36e2291' },
  { name: '커뮤니티', path: '/community' },
  { name: '수상내역', path: '/awards' },
  { name: 'FAQ', path: '/support' },
  { name: '로그인', path: '/auth/login' },
]

test('🔘 전체 버튼 텍스트 가시성 감사 (다크모드)', async ({ page }) => {
  const allIssues: Record<string, any[]> = {}
  let totalIssues = 0

  for (const { name, path } of PAGES) {
    await page.goto(`${BASE_URL}${path}`)
    await page.waitForLoadState('networkidle')
    await enableDark(page)

    const issues = await auditButtons(page)
    allIssues[name] = issues
    totalIssues += issues.length

    console.log(`\n📄 [${name}] 버튼 대비 문제 ${issues.length}건`)
    issues.forEach(i => {
      console.log(`  [${i.ratio}:1] ${i.text}`)
      console.log(`    텍스트: ${i.color} / 배경: ${i.bg}`)
    })
  }

  console.log(`\n🔢 전체 문제: ${totalIssues}건`)

  // JSON 저장
  const fs = require('fs')
  fs.writeFileSync('e2e/darkmode-audit/button-audit.json', JSON.stringify(allIssues, null, 2))
})
