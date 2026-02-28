/**
 * 자연어 질의 500개 일괄 테스트 스크립트
 * 사용법: node scripts/test-chat-queries.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(__dirname, '..')

// ── 설정 ──
const API_URL = 'http://localhost:3000/api/chat/dev-test'
const SUPABASE_URL = 'https://tigqwrehpzwaksnvcrrx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ3F3cmVocHp3YWtzbnZjcnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3Mzk5MTgsImV4cCI6MjA4NTMxNTkxOH0.B0eK_cfB0KJg4pJjZnXnveHC2jSjspFPbQA3bM0Hj60'
const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'test1234!'
const DELAY_MS = 200

// ── 1. Supabase 로그인 → user_id 획득 ──
async function getTestUserId() {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ email: TEST_EMAIL, password: TEST_PASSWORD }),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Supabase 로그인 실패: ${res.status} ${err}`)
  }
  const data = await res.json()
  console.log(`✓ 로그인 성공 — user_id: ${data.user.id}`)
  return data.user.id
}

// ── 2. 마크다운 파일에서 질의 파싱 ──
function parseQueries(filePath) {
  const content = readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  let currentCategory = ''
  const queries = []

  for (const line of lines) {
    // ## N. 카테고리명
    const catMatch = line.match(/^## \d+\.\s+(.+)$/)
    if (catMatch) {
      currentCategory = catMatch[1].trim()
      continue
    }
    // N. 질의 내용
    const queryMatch = line.match(/^\d+\.\s+(.+)$/)
    if (queryMatch) {
      const text = queryMatch[1].trim()
      // (범위 외) 같은 주석 분리
      const noteMatch = text.match(/^(.+?)\s*\((.+?)\)\s*$/)
      queries.push({
        category: currentCategory,
        text: noteMatch ? noteMatch[1].trim() : text,
        note: noteMatch ? noteMatch[2] : null,
      })
    }
  }

  return queries
}

// ── 3. API 호출 ──
async function sendQuery(message, userId) {
  const start = Date.now()
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, user_id: userId }),
    })
    const elapsed = Date.now() - start
    const data = await res.json()
    return {
      status: res.status,
      success: data.success ?? false,
      intent: data.intent || null,
      message: data.message || data.error || '',
      error: data.error || null,
      elapsed,
    }
  } catch (err) {
    return {
      status: 0,
      success: false,
      intent: null,
      message: '',
      error: err.message,
      elapsed: Date.now() - start,
    }
  }
}

// ── 4. 리포트 생성 ──
function generateReport(results, queries) {
  const total = results.length
  const successes = results.filter((r) => r.success).length
  const failures = total - successes
  const rate = ((successes / total) * 100).toFixed(1)

  // 카테고리별 집계
  const catMap = new Map()
  for (let i = 0; i < results.length; i++) {
    const cat = queries[i].category
    if (!catMap.has(cat)) catMap.set(cat, { total: 0, success: 0 })
    const s = catMap.get(cat)
    s.total++
    if (results[i].success) s.success++
  }

  // 실패 케이스
  const failCases = []
  for (let i = 0; i < results.length; i++) {
    if (!results[i].success) {
      failCases.push({
        no: i + 1,
        category: queries[i].category,
        query: queries[i].text,
        error: results[i].error || results[i].message || `HTTP ${results[i].status}`,
      })
    }
  }

  const now = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })

  let md = `# 자연어 질의 테스트 리포트\n\n`
  md += `> 실행 시간: ${now}\n\n`

  // 요약
  md += `## 요약\n\n`
  md += `| 항목 | 값 |\n|------|----|\n`
  md += `| 총 테스트 수 | ${total} |\n`
  md += `| 성공 | ${successes} |\n`
  md += `| 실패 | ${failures} |\n`
  md += `| 성공률 | ${rate}% |\n\n`

  // 카테고리별
  md += `## 카테고리별 성공률\n\n`
  md += `| 카테고리 | 성공/전체 | 성공률 |\n|----------|-----------|--------|\n`
  for (const [cat, s] of catMap) {
    const catRate = ((s.success / s.total) * 100).toFixed(1)
    md += `| ${cat} | ${s.success}/${s.total} | ${catRate}% |\n`
  }
  md += '\n'

  // 실패 케이스
  if (failCases.length > 0) {
    md += `## 실패 케이스 (${failCases.length}건)\n\n`
    md += `| # | 카테고리 | 질의 | 에러 |\n|---|----------|------|------|\n`
    for (const f of failCases) {
      md += `| ${f.no} | ${f.category} | ${f.query} | ${f.error.substring(0, 80)} |\n`
    }
    md += '\n'
  }

  // 전체 결과 테이블
  md += `## 전체 결과\n\n`
  md += `| # | 카테고리 | 질의 | 성공 | intent | 응답 (50자) | 시간(ms) |\n`
  md += `|---|----------|------|------|--------|-------------|----------|\n`
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    const q = queries[i]
    const msgPreview = (r.message || '').replace(/\n/g, ' ').substring(0, 50)
    const successMark = r.success ? '✅' : '❌'
    md += `| ${i + 1} | ${q.category} | ${q.text} | ${successMark} | ${r.intent || '-'} | ${msgPreview} | ${r.elapsed} |\n`
  }

  return md
}

// ── 5. 메인 실행 ──
async function main() {
  console.log('=== 자연어 질의 테스트 시작 ===\n')

  // 로그인
  const userId = await getTestUserId()

  // 질의 파싱
  const queriesFile = resolve(ROOT, 'docs/natural-language-queries.md')
  const queries = parseQueries(queriesFile)
  console.log(`✓ 질의 ${queries.length}개 파싱 완료\n`)

  // 순차 실행
  const results = []
  for (let i = 0; i < queries.length; i++) {
    const q = queries[i]
    const progress = `[${String(i + 1).padStart(3)}/${queries.length}]`

    const result = await sendQuery(q.text, userId)
    results.push(result)

    const mark = result.success ? '✅' : '❌'
    const preview = (result.message || '').replace(/\n/g, ' ').substring(0, 40)
    console.log(`${progress} ${mark} ${q.text.substring(0, 30).padEnd(30)} → ${preview}`)

    // 딜레이
    if (i < queries.length - 1) {
      await new Promise((r) => setTimeout(r, DELAY_MS))
    }
  }

  // 리포트 생성
  const report = generateReport(results, queries)
  const reportPath = resolve(ROOT, 'docs/test-report-v2.md')
  writeFileSync(reportPath, report, 'utf-8')

  const successes = results.filter((r) => r.success).length
  const rate = ((successes / results.length) * 100).toFixed(1)
  console.log(`\n=== 테스트 완료 ===`)
  console.log(`총 ${results.length}개 | 성공 ${successes} | 실패 ${results.length - successes} | 성공률 ${rate}%`)
  console.log(`리포트 저장: ${reportPath}`)
}

main().catch((err) => {
  console.error('스크립트 에러:', err)
  process.exit(1)
})
