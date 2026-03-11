import { test } from '@playwright/test'
import * as fs from 'fs'
import * as path from 'path'
import { createClient } from '@supabase/supabase-js'

const BASE_URL = 'http://localhost:3000'
const SUPABASE_URL = 'https://tigqwrehpzwaksnvcrrx.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpZ3F3cmVocHp3YWtzbnZjcnJ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3Mzk5MTgsImV4cCI6MjA4NTMxNTkxOH0.B0eK_cfB0KJg4pJjZnXnveHC2jSjspFPbQA3bM0Hj60'

const QUESTIONS = [
  // 1. 대회 목록 검색
  { id: 1,  cat: '대회목록', q: '대회 있어?' },
  { id: 2,  cat: '대회목록', q: '요즘 테니스 대회 뭐 있어?' },
  { id: 3,  cat: '대회목록', q: '대회 목록 보여줘' },
  { id: 4,  cat: '대회목록', q: '마포구 대회 있냐' },
  { id: 5,  cat: '대회목록', q: '이번 달 대회 알려줘' },
  { id: 6,  cat: '대회목록', q: '다음 달에 대회 있어?' },
  { id: 7,  cat: '대회목록', q: '봄에 열리는 대회 있어?' },
  { id: 8,  cat: '대회목록', q: '서울 대회 찾아줘' },
  { id: 9,  cat: '대회목록', q: '상반기 대회 일정' },
  { id: 10, cat: '대회목록', q: '대회 리스트 보고 싶어' },

  // 2. 신청 가능한 대회
  { id: 11, cat: '모집중대회', q: '신청 가능한 대회 있어?' },
  { id: 12, cat: '모집중대회', q: '지금 접수 중인 대회 뭐야?' },
  { id: 13, cat: '모집중대회', q: '모집 중인 대회 알려줘' },
  { id: 14, cat: '모집중대회', q: '지금 신청할 수 있는 대회 있어?' },
  { id: 15, cat: '모집중대회', q: '참가 신청 받는 대회 있냐' },

  // 3. 진행중 대회
  { id: 16, cat: '진행중대회', q: '지금 진행 중인 대회 있어?' },
  { id: 17, cat: '진행중대회', q: '현재 진행 중인 테니스 대회' },
  { id: 18, cat: '진행중대회', q: '요즘 뭔 대회 하고 있어?' },

  // 4. 대회 상세
  { id: 19, cat: '대회상세', q: '구협회장기 대회 참가비 얼마야?' },
  { id: 20, cat: '대회상세', q: '마포구청장기 요강 알려줘' },
  { id: 21, cat: '대회상세', q: '구협회장기 부서가 뭐 있어?' },
  { id: 22, cat: '대회상세', q: '구협회장기 언제 어디서 해?' },
  { id: 23, cat: '대회상세', q: '마포구청장기 접수 기간이 어떻게 돼?' },
  { id: 24, cat: '대회상세', q: '구협회장기 상금 얼마야?' },
  { id: 25, cat: '대회상세', q: '구협회장기 신청 마감이 언제야?' },
  { id: 26, cat: '대회상세', q: '마포구청장기 자세히 알려줘' },
  { id: 27, cat: '대회상세', q: '구협회장기 제한 나이 있어?' },

  // 5. 내 신청 내역
  { id: 28, cat: '내신청', q: '내가 신청한 대회 있어?' },
  { id: 29, cat: '내신청', q: '내 신청 내역 보여줘' },
  { id: 30, cat: '내신청', q: '내가 참가 신청한 거 뭐 있어?' },
  { id: 31, cat: '내신청', q: '내 등록 현황 알려줘' },
  { id: 32, cat: '내신청', q: '내가 신청한 대회 목록' },

  // 6. 내 경기 일정
  { id: 33, cat: '내일정', q: '다음 경기 언제야?' },
  { id: 34, cat: '내일정', q: '내 다음 경기 알려줘' },
  { id: 35, cat: '내일정', q: '내 경기 일정 뭐야?' },
  { id: 36, cat: '내일정', q: '나 언제 경기야?' },

  // 7. 내 전적
  { id: 37, cat: '내전적', q: '내 전적 알려줘' },
  { id: 38, cat: '내전적', q: '나 몇 승 몇 패야?' },
  { id: 39, cat: '내전적', q: '내 경기 결과 보여줘' },
  { id: 40, cat: '내전적', q: '내가 이긴 경기 몇 개야?' },

  // 8. 대진표
  { id: 41, cat: '대진표', q: '구협회장기 대진표 보여줘' },
  { id: 42, cat: '대진표', q: '마포구청장기 대진 어떻게 돼?' },
  { id: 43, cat: '대진표', q: '구협회장기 마스터부 대진표' },
  { id: 44, cat: '대진표', q: '대진표 조회해줘' },

  // 9. 경기 결과
  { id: 45, cat: '경기결과', q: '구협회장기 결과 어떻게 됐어?' },
  { id: 46, cat: '경기결과', q: '마포구청장기 경기 결과 알려줘' },
  { id: 47, cat: '경기결과', q: '최근 경기 결과 보여줘' },

  // 10. 입상 기록
  { id: 48, cat: '입상기록', q: '최근 우승자 누구야?' },
  { id: 49, cat: '입상기록', q: '입상 기록 보여줘' },
  { id: 50, cat: '입상기록', q: '마포구 테니스 명예의 전당' },
  { id: 51, cat: '입상기록', q: '구협회장기 역대 우승자 알려줘' },
  { id: 52, cat: '입상기록', q: '올해 입상자 누구야?' },

  // 11. 참가 신청 플로우
  { id: 53, cat: '신청플로우', q: '대회 신청하고 싶어' },
  { id: 54, cat: '신청플로우', q: '구협회장기 신청할게' },
  { id: 55, cat: '신청플로우', q: '대회 참가 신청 해줘' },

  // 12. 참가 취소 플로우
  { id: 56, cat: '취소플로우', q: '신청 취소하고 싶어' },
  { id: 57, cat: '취소플로우', q: '대회 참가 취소할게' },

  // 13. 복합 조건 검색
  { id: 58, cat: '복합검색', q: '마포구에서 이번 달에 열리는 대회 있어?' },
  { id: 59, cat: '복합검색', q: '참가비 10만원 이하 대회 있어?' },
  { id: 60, cat: '복합검색', q: '서울에서 신청 가능한 대회 알려줘' },
  { id: 61, cat: '복합검색', q: '4월에 마포구 대회 있어?' },
  { id: 62, cat: '복합검색', q: '무료 대회 있어?' },

  // 14. 인사/잡담
  { id: 63, cat: '잡담', q: '안녕' },
  { id: 64, cat: '잡담', q: '뭐 할 수 있어?' },
  { id: 65, cat: '잡담', q: '도움말' },
  { id: 66, cat: '잡담', q: '테니스 잘 치려면 어떻게 해야 해?' },
  { id: 67, cat: '잡담', q: '날씨 어때?' },

  // 15. 오타/약어
  { id: 68, cat: '오타', q: '대회 있엉?' },
  { id: 69, cat: '오타', q: '구협장기 알려줘' },
  { id: 70, cat: '오타', q: '신청된 대회 있음?' },
  { id: 71, cat: '오타', q: '대지표 보여줘' },

  // 16. 영어 질문
  { id: 72, cat: '영어질문', q: 'What tournaments are available?' },
  { id: 73, cat: '영어질문', q: 'Show me my entries' },
  { id: 74, cat: '영어질문', q: 'How do I register for a tournament?' },

  // 17. 없는 대회/지역
  { id: 75, cat: '엣지케이스', q: '강남구 테니스 대회 있어?' },
  { id: 76, cat: '엣지케이스', q: '부산 대회 알려줘' },
  { id: 77, cat: '엣지케이스', q: '없는대회 요강 알려줘' },
  { id: 78, cat: '엣지케이스', q: '100년 전 대회 결과 알려줘' },

  // 18. 클럽 관련
  { id: 79, cat: '클럽', q: '건승회 클럽 정보 알려줘' },
  { id: 80, cat: '클럽', q: '마포구 테니스 클럽 있어?' },
  { id: 81, cat: '클럽', q: '건승회 가입하려면 어떻게 해?' },

  // 19. FAQ 관련
  { id: 82, cat: 'FAQ', q: '참가비 환불 되나요?' },
  { id: 83, cat: 'FAQ', q: '참가 신청 방법 알려줘' },
  { id: 84, cat: 'FAQ', q: '대회 당일 취소하면 어떻게 돼?' },
  { id: 85, cat: 'FAQ', q: '단체전 팀원은 몇 명이야?' },
  { id: 86, cat: 'FAQ', q: '신청 확인은 어떻게 해?' },

  // 20. 상황별 자연스러운 질문
  { id: 87, cat: '자연스러운질문', q: '이번 주말에 뭔 대회 있어?' },
  { id: 88, cat: '자연스러운질문', q: '참가비 제일 저렴한 대회가 뭐야?' },
  { id: 89, cat: '자연스러운질문', q: '구협회장기 몇 명이나 참가했어?' },
  { id: 90, cat: '자연스러운질문', q: '내가 우승한 대회 있어?' },
  { id: 91, cat: '자연스러운질문', q: '3월에 있는 대회 다 알려줘' },
  { id: 92, cat: '자연스러운질문', q: '복식 대회 있어?' },
  { id: 93, cat: '자연스러운질문', q: '단체전 대회 언제야?' },
  { id: 94, cat: '자연스러운질문', q: '60세 이상 대회 있어?' },
  { id: 95, cat: '자연스러운질문', q: '여성부 대회 있어?' },
  { id: 96, cat: '자연스러운질문', q: '마포구 협회 대회 일정 알려줘' },
  { id: 97, cat: '자연스러운질문', q: '내 경기 이겼어 결과 어떻게 입력해?' },
  { id: 98, cat: '자연스러운질문', q: '대회 등록 마감이 언제야?' },
  { id: 99, cat: '자연스러운질문', q: '예선전이 있는 대회 알려줘' },
  { id: 100, cat: '자연스러운질문', q: '우리 클럽 이번 달 모임 언제야?' },
]

interface Result {
  id: number
  cat: string
  q: string
  response: string
  status: 'PASS' | 'FAIL' | 'WARN'
  reason: string
  ms: number
}

function evaluate(q: string, res: string): { status: 'PASS' | 'FAIL' | 'WARN'; reason: string } {
  if (!res || res.trim().length === 0) return { status: 'FAIL', reason: '빈 응답' }
  if (res.includes('오류') && res.includes('다시')) return { status: 'FAIL', reason: '에러 응답' }
  if (/^(undefined|null|error)/i.test(res)) return { status: 'FAIL', reason: '에러 응답' }
  
  // 영어 상태값 노출 체크
  if (/\b(PENDING|APPROVED|REJECTED|CONFIRMED|WAITLISTED|CANCELLED|COMPLETED|OPEN|DRAFT)\b/.test(res)) {
    return { status: 'WARN', reason: '영어 상태값 노출' }
  }
  // 도구 이름 노출 체크
  if (/search_tournaments|get_tournament|initiate_apply|get_my_entries/.test(res)) {
    return { status: 'WARN', reason: '도구명 노출' }
  }
  // 한국어 응답 체크
  if (!/[가-힣]/.test(res)) {
    return { status: 'WARN', reason: '한국어 미포함' }
  }
  return { status: 'PASS', reason: '정상' }
}

test('🤖 자연어 100문항 테스트', async ({ page }) => {
  test.setTimeout(60 * 60 * 1000) // 60분
  await page.setViewportSize({ width: 390, height: 844 })

  // Supabase 세션 직접 주입 (느린 홈페이지 렌더링 우회)
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: { session }, error: authError } = await supabase.auth.signInWithPassword({
    email: 'e2e.admin@mapo-tennis-test.dev',
    password: 'E2ETest2026x',
  })
  if (authError || !session) throw new Error(`로그인 실패: ${authError?.message}`)

  // 쿠키 직접 주입
  const projectRef = SUPABASE_URL.match(/https:\/\/([^.]+)/)?.[1] ?? ''
  const cookieName = `sb-${projectRef}-auth-token`
  const tokenValue = JSON.stringify({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    token_type: 'bearer',
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    user: session.user,
  })

  await page.context().addCookies([{
    name: cookieName,
    value: encodeURIComponent(tokenValue),
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
  }])

  // 간단한 페이지로 이동하여 세션 확인
  await page.goto(`${BASE_URL}/tournaments`)
  await page.waitForLoadState('domcontentloaded')
  console.log('✅ 로그인 완료 (세션 주입)')

  const results: Result[] = []

  for (const { id, cat, q } of QUESTIONS) {
    console.log(`\n[${id}/100] [${cat}] ${q}`)
    const start = Date.now()

    try {
      const res = await page.evaluate(async (question: string) => {
        const r = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ message: question, history: [] }),
        })
        const data = await r.json()
        return data.success ? data.message : `ERROR: ${data.error}`
      }, q)

      const ms = Date.now() - start
      const { status, reason } = evaluate(q, res)
      const preview = res.slice(0, 80).replace(/\n/g, ' ')
      console.log(`  → [${status}] ${preview}… (${ms}ms)`)
      results.push({ id, cat, q, response: res, status, reason, ms })
    } catch (e) {
      results.push({ id, cat, q, response: '', status: 'FAIL', reason: String(e), ms: 0 })
      console.log(`  → [FAIL] 예외: ${e}`)
    }

    // Rate limit 방지 (10초 간격)
    if (id < QUESTIONS.length) await page.waitForTimeout(10000)
  }

  // 통계
  const pass = results.filter(r => r.status === 'PASS').length
  const warn = results.filter(r => r.status === 'WARN').length
  const fail = results.filter(r => r.status === 'FAIL').length
  console.log(`\n📊 결과: PASS ${pass} / WARN ${warn} / FAIL ${fail} / 총 ${results.length}`)

  // HTML 리포트 생성
  const cats = [...new Set(results.map(r => r.cat))]
  const byCategory = cats.map(cat => ({
    cat,
    items: results.filter(r => r.cat === cat),
    pass: results.filter(r => r.cat === cat && r.status === 'PASS').length,
    warn: results.filter(r => r.cat === cat && r.status === 'WARN').length,
    fail: results.filter(r => r.cat === cat && r.status === 'FAIL').length,
  }))

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>자연어 NL 100문항 테스트 리포트</title>
<style>
  body { font-family: -apple-system, sans-serif; background: #0a0a0a; color: #f5f5f5; margin: 0; padding: 24px; }
  h1 { color: #ccff00; font-size: 22px; }
  .summary { display: flex; gap: 16px; margin: 20px 0; flex-wrap: wrap; }
  .stat { background: #111; border-radius: 12px; padding: 16px 24px; text-align: center; }
  .stat .num { font-size: 36px; font-weight: 700; }
  .stat .label { font-size: 12px; color: #888; margin-top: 4px; }
  .pass .num { color: #4ade80; }
  .warn .num { color: #fbbf24; }
  .fail .num { color: #f87171; }
  .total .num { color: #ccff00; }
  .cat-section { margin: 24px 0; }
  .cat-title { font-size: 14px; font-weight: 700; color: #ccff00; margin-bottom: 8px; background: #111; padding: 8px 12px; border-radius: 8px; display: flex; justify-content: space-between; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #1a1a1a; padding: 8px 10px; text-align: left; color: #888; font-weight: 500; }
  td { padding: 8px 10px; border-bottom: 1px solid #222; vertical-align: top; }
  tr:hover td { background: #111; }
  .q { color: #e0e0e0; max-width: 200px; }
  .res { color: #aaa; max-width: 360px; font-size: 12px; line-height: 1.5; }
  .PASS { color: #4ade80; font-weight: 700; }
  .WARN { color: #fbbf24; font-weight: 700; }
  .FAIL { color: #f87171; font-weight: 700; }
  .reason { color: #888; font-size: 11px; }
  .ms { color: #555; font-size: 11px; }
  .bar { height: 6px; border-radius: 3px; background: #222; margin: 4px 0; }
  .bar-inner { height: 100%; border-radius: 3px; }
</style>
</head>
<body>
<h1>🤖 자연어 NL 100문항 테스트 리포트</h1>
<p style="color:#888;font-size:13px;">생성: ${new Date().toLocaleString('ko-KR')} | 테스트 계정: e2e.admin@mapo-tennis-test.dev</p>

<div class="summary">
  <div class="stat total"><div class="num">${results.length}</div><div class="label">총 문항</div></div>
  <div class="stat pass"><div class="num">${pass}</div><div class="label">PASS ✅</div></div>
  <div class="stat warn"><div class="num">${warn}</div><div class="label">WARN ⚠️</div></div>
  <div class="stat fail"><div class="num">${fail}</div><div class="label">FAIL ❌</div></div>
  <div class="stat total"><div class="num">${Math.round(pass/results.length*100)}%</div><div class="label">통과율</div></div>
  <div class="stat total"><div class="num">${Math.round(results.reduce((a,r)=>a+r.ms,0)/results.length)}ms</div><div class="label">평균 응답</div></div>
</div>

${byCategory.map(({ cat, items, pass: cp, warn: cw, fail: cf }) => `
<div class="cat-section">
  <div class="cat-title">
    <span>${cat} (${items.length}문항)</span>
    <span>✅${cp} ⚠️${cw} ❌${cf}</span>
  </div>
  <table>
    <tr><th>#</th><th>질문</th><th>응답</th><th>결과</th><th>사유</th><th>ms</th></tr>
    ${items.map(r => `
    <tr>
      <td style="color:#555">${r.id}</td>
      <td class="q">${r.q}</td>
      <td class="res">${r.response.slice(0,120).replace(/</g,'&lt;')}${r.response.length>120?'…':''}</td>
      <td><span class="${r.status}">${r.status}</span></td>
      <td class="reason">${r.reason}</td>
      <td class="ms">${r.ms}</td>
    </tr>`).join('')}
  </table>
</div>`).join('')}
</body>
</html>`

  const reportDir = 'e2e/darkmode-audit'
  fs.writeFileSync(path.join(reportDir, 'nl-100-report.html'), html)
  fs.writeFileSync(path.join(reportDir, 'nl-100-results.json'), JSON.stringify(results, null, 2))
  console.log(`\n✅ 리포트 저장 완료: ${reportDir}/nl-100-report.html`)
})
