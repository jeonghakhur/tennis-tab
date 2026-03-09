/**
 * 텍스트 크기 & 명도 대비 감사
 * - WCAG AA: 일반 텍스트 4.5:1, 큰 텍스트(18px+) 3:1
 * - 최소 텍스트 크기: 12px
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
  await page.waitForTimeout(1000)
}

// 상대 밝기 계산 (WCAG 공식)
function relativeLuminance(r: number, g: number, b: number): number {
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

function contrastRatio(l1: number, l2: number): number {
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function parseRgb(color: string): [number, number, number] | null {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return null
  return [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])]
}

async function auditText(page: Page, pageName: string, isDark: boolean) {
  return await page.evaluate(({ isDark }) => {
    const results: Array<{
      type: string
      text: string
      fontSize: number
      color: string
      bgColor: string
      issue: string
      element: string
    }> = []

    const elements = document.querySelectorAll('h1,h2,h3,h4,h5,h6,p,span,label,button,a,td,th,li,small')

    elements.forEach((el) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return

      const style = getComputedStyle(el)
      const fontSize = parseFloat(style.fontSize)
      const color = style.color
      const text = el.textContent?.trim().slice(0, 30) || ''
      if (!text) return

      // 부모 체인에서 실제 배경색 찾기
      let bgEl: Element | null = el
      let bgColor = 'rgba(0, 0, 0, 0)'
      while (bgEl) {
        const bg = getComputedStyle(bgEl).backgroundColor
        if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') {
          bgColor = bg
          break
        }
        bgEl = bgEl.parentElement
      }
      if (bgColor === 'rgba(0, 0, 0, 0)') {
        bgColor = isDark ? 'rgb(10, 10, 10)' : 'rgb(255, 255, 255)'
      }

      const issues: string[] = []

      // 1. 텍스트 크기 너무 작음
      if (fontSize < 11) {
        issues.push(`극소 텍스트 ${Math.round(fontSize)}px (최소 12px 권장)`)
      } else if (fontSize < 12) {
        issues.push(`소형 텍스트 ${Math.round(fontSize)}px`)
      }

      // 2. 명도 대비 계산
      const colorMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      const bgMatch = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
      if (colorMatch && bgMatch) {
        const toLinear = (c: number) => {
          const s = c / 255
          return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
        }
        const lum = (r: number, g: number, b: number) =>
          0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)

        const l1 = lum(+colorMatch[1], +colorMatch[2], +colorMatch[3])
        const l2 = lum(+bgMatch[1], +bgMatch[2], +bgMatch[3])
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        const ratio = (lighter + 0.05) / (darker + 0.05)

        const isLargeText = fontSize >= 18 || (fontSize >= 14 && style.fontWeight >= '700')
        const required = isLargeText ? 3.0 : 4.5

        if (ratio < required) {
          issues.push(`대비율 ${ratio.toFixed(1)}:1 (${isLargeText ? '큰텍스트' : '일반'} 기준 ${required}:1 미달)`)
        }
      }

      if (issues.length > 0) {
        results.push({
          type: fontSize >= 18 ? '제목' : '본문',
          text: `"${text}"`,
          fontSize: Math.round(fontSize),
          color,
          bgColor,
          issue: issues.join(' / '),
          element: el.tagName.toLowerCase()
        })
      }
    })

    // 중복 제거 (같은 텍스트+이슈)
    const seen = new Set<string>()
    return results.filter(r => {
      const key = `${r.text}|${r.issue}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }).slice(0, 40)
  }, { isDark })
}

const PAGES = [
  { name: '대회목록', path: '/tournaments', dark: false },
  { name: '대회목록(다크)', path: '/tournaments', dark: true },
  { name: '대회상세', path: '/tournaments', dark: false, clickFirst: 'a[href^="/tournaments/"]' },
  { name: '대회상세(다크)', path: '/tournaments', dark: true, clickFirst: 'a[href^="/tournaments/"]' },
  { name: '클럽목록', path: '/clubs', dark: false },
  { name: '클럽목록(다크)', path: '/clubs', dark: true },
  { name: '로그인', path: '/auth/login', dark: false },
  { name: '로그인(다크)', path: '/auth/login', dark: true },
  { name: '커뮤니티', path: '/community', dark: false },
  { name: '커뮤니티(다크)', path: '/community', dark: true },
]

test('📝 텍스트 크기 & 명도 대비 감사', async ({ page }) => {
  const allResults: any[] = []

  for (const { name, path, dark, clickFirst } of PAGES) {
    await page.goto(`${BASE_URL}${path}`)
    await page.waitForLoadState('networkidle')

    if (clickFirst) {
      const link = page.locator(clickFirst).first()
      if (await link.count() > 0) {
        await link.click()
        await page.waitForLoadState('networkidle')
      }
    }

    if (dark) await enableDark(page)

    const issues = await auditText(page, name, dark)
    allResults.push({ name, dark, issues })

    const contrastIssues = issues.filter(i => i.issue.includes('대비율'))
    const sizeIssues = issues.filter(i => i.issue.includes('텍스트'))

    console.log(`\n📄 [${name}] 총 ${issues.length}건 (대비:${contrastIssues.length} / 크기:${sizeIssues.length})`)
    issues.slice(0, 10).forEach(i => {
      console.log(`  [${i.element} ${i.fontSize}px] ${i.text} → ${i.issue}`)
    })
  }

  // 마크다운 리포트
  let md = '# 텍스트 크기 & 명도 대비 감사 리포트\n\n'
  md += '> WCAG AA 기준: 일반 텍스트 4.5:1 / 큰 텍스트(18px+) 3:1 / 최소 크기 12px\n\n'

  for (const { name, dark, issues } of allResults) {
    const contrastIssues = issues.filter((i: any) => i.issue.includes('대비율'))
    const sizeIssues = issues.filter((i: any) => i.issue.includes('텍스트'))
    md += `## ${name} ${dark ? '🌙' : '☀️'}\n`
    md += `- 대비율 문제: ${contrastIssues.length}건 / 크기 문제: ${sizeIssues.length}건\n\n`
    if (issues.length > 0) {
      md += '| 요소 | 텍스트 | 크기 | 문제 |\n|---|---|---|---|\n'
      issues.slice(0, 20).forEach((i: any) => {
        md += `| ${i.element} | ${i.text} | ${i.fontSize}px | ${i.issue} |\n`
      })
    } else {
      md += '✅ 이상 없음\n'
    }
    md += '\n'
  }

  fs.writeFileSync(`${REPORT_DIR}/text-audit-report.md`, md)
  console.log('\n✅ 리포트 저장: e2e/darkmode-audit/text-audit-report.md')
})
