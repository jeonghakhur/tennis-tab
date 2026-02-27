/**
 * Chat Agent 확장 통합 테스트 (DEV 전용)
 * 실행: node scripts/test-chat-agent.mjs
 */

const BASE_URL = 'http://localhost:3000/api/chat/dev-test'
const TEST_USER_ID = 'e472e215-dfa2-4215-a996-4cb29b66e073'

const TEST_CASES = [
  // ═══ 1. 대회 목록 — 다양한 표현 ═══════════════════════════════════
  { id: 'L01', group: '목록', label: '기본 목록', message: '대회 목록 알려줘' },
  { id: 'L02', group: '목록', label: '신청 가능', message: '신청 가능한 대회 있어?' },
  { id: 'L03', group: '목록', label: '모집 중 표현', message: '지금 모집 중인 대회 뭐 있어?' },
  { id: 'L04', group: '목록', label: '진행 중', message: '현재 진행 중인 대회 알려줘' },
  { id: 'L05', group: '목록', label: '완료된 대회', message: '끝난 대회 알려줘' },

  // ═══ 2. 지역 검색 — 다양한 표현 ═══════════════════════════════════
  { id: 'R01', group: '지역', label: '마포구', message: '마포구 대회 있어?' },
  { id: 'R02', group: '지역', label: '마포대회 합성어', message: '마포대회 뭐 있어?' },
  { id: 'R03', group: '지역', label: '서울 접두 표현', message: '서울쪽 대회 알려줘' },
  { id: 'R04', group: '지역', label: '지역 in 문장', message: '마포에서 열리는 테니스 대회 있어?' },

  // ═══ 3. 날짜 / 일정 ═══════════════════════════════════════════════
  { id: 'D01', group: '일정', label: '이번 달', message: '이번 달 대회 일정 알려줘' },
  { id: 'D02', group: '일정', label: '다음 달', message: '다음 달 어떤 대회 있어?' },
  { id: 'D03', group: '일정', label: '4월 일정', message: '4월에 있는 대회 알려줘' },
  { id: 'D04', group: '일정', label: '봄 대회', message: '봄 대회 있어?' },
  { id: 'D05', group: '일정', label: '여름 대회', message: '여름 대회 있어?' },
  { id: 'D06', group: '일정', label: '이번 주', message: '이번 주 대회 있어?' },

  // ═══ 4. 대회 상세 ══════════════════════════════════════════════════
  { id: 'S01', group: '상세', label: '참가비 질문', message: '마포구청장기 참가비 얼마야?' },
  { id: 'S02', group: '상세', label: '요강 문의', message: '구협회장기 요강 알려줘' },
  { id: 'S03', group: '상세', label: '장소 문의', message: '마포구체육회장기 어디서 해?' },
  { id: 'S04', group: '상세', label: '부서 문의', message: '구협회장기 어떤 부서 있어?' },
  { id: 'S05', group: '상세', label: '접수 기간 문의', message: '마포구청장기 접수 언제까지야?' },

  // ═══ 5. 내 신청 내역 ════════════════════════════════════════════════
  { id: 'M01', group: '내 신청', label: '기본 조회', message: '내 신청 내역 보여줘', userId: TEST_USER_ID },
  { id: 'M02', group: '내 신청', label: '신청한 대회', message: '내가 신청한 대회 뭐야?', userId: TEST_USER_ID },
  { id: 'M03', group: '내 신청', label: '결제 안 한 것', message: '결제 안 한 신청 있어?', userId: TEST_USER_ID },
  { id: 'M04', group: '내 신청', label: '미납 조회', message: '참가비 미납인 신청 알려줘', userId: TEST_USER_ID },
  { id: 'M05', group: '내 신청', label: '승인된 신청', message: '승인된 신청 있어?', userId: TEST_USER_ID },

  // ═══ 6. 경기 일정/결과 ══════════════════════════════════════════════
  { id: 'G01', group: '경기', label: '내 경기 일정', message: '내 다음 경기 언제야?', userId: TEST_USER_ID },
  { id: 'G02', group: '경기', label: '내 경기 결과', message: '내 경기 결과 알려줘', userId: TEST_USER_ID },
  { id: 'G03', group: '경기', label: '내 전적', message: '나 지금까지 몇 승 몇 패야?', userId: TEST_USER_ID },
  { id: 'G04', group: '경기', label: '대진표 문의', message: '구협회장기 대진표 어떻게 돼?' },
  { id: 'G05', group: '경기', label: '경기 결과 조회', message: '구협회장기 경기 결과 알려줘' },

  // ═══ 7. 입상 기록 ════════════════════════════════════════════════════
  { id: 'A01', group: '입상', label: '전체 입상자', message: '최근 입상자 누구야?' },
  { id: 'A02', group: '입상', label: '명예의 전당', message: '명예의 전당 보여줘' },
  { id: 'A03', group: '입상', label: '우승자 문의', message: '최근 우승한 사람 알려줘' },
  { id: 'A04', group: '입상', label: '내 입상', message: '나 입상한 적 있어?', userId: TEST_USER_ID },
  { id: 'A05', group: '입상', label: '특정 연도', message: '2025년 입상자 알려줘' },

  // ═══ 8. 신청 플로우 ══════════════════════════════════════════════════
  { id: 'F01', group: '신청', label: '신청 시작', message: '대회 신청하고 싶어', userId: TEST_USER_ID },
  { id: 'F02', group: '신청', label: '특정 대회 신청', message: '구협회장기 신청할게', userId: TEST_USER_ID },
  { id: 'F03', group: '취소', label: '취소 요청', message: '신청 취소하고 싶어', userId: TEST_USER_ID },

  // ═══ 9. 복합 질의 ════════════════════════════════════════════════════
  { id: 'C01', group: '복합', label: '지역+날짜', message: '마포구에서 4월에 하는 대회 있어?' },
  { id: 'C02', group: '복합', label: '지역+상태', message: '서울에서 모집 중인 대회 있어?' },
  { id: 'C03', group: '복합', label: '날짜+참가비', message: '올 상반기 무료 대회 있어?' },
  { id: 'C04', group: '복합', label: '상세+비교', message: '신청 가능한 대회 중에 가장 빠른 거 알려줘' },
  { id: 'C05', group: '복합', label: '조건 여러 개', message: '서울에서 다음달에 신청 가능한 단식 대회 있어?' },

  // ═══ 10. 엣지케이스 ══════════════════════════════════════════════════
  { id: 'E01', group: '엣지', label: '없는 지역', message: '부산 대회 있어?' },
  { id: 'E02', group: '엣지', label: '없는 대회명', message: '강남오픈 2099 있어?' },
  { id: 'E03', group: '엣지', label: '인사', message: '안녕!' },
  { id: 'E04', group: '엣지', label: '도움말', message: '뭘 도와줄 수 있어?' },
  { id: 'E05', group: '엣지', label: '비로그인 내 정보', message: '내 신청 알려줘' },
  { id: 'E06', group: '엣지', label: '영어 질의', message: 'What tournaments are available?' },
  { id: 'E07', group: '엣지', label: '줄임말/은어', message: '테니스 대회 있냐' },
  { id: 'E08', group: '엣지', label: '오타 포함', message: '마표구 대회 알려줘' },
]

async function runTest(tc) {
  const body = { message: tc.message }
  if (tc.userId) body.user_id = tc.userId

  const start = Date.now()
  let status = 0
  let result = null
  let error = null

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    status = res.status
    result = await res.json()
  } catch (e) {
    error = e.message
  }

  const elapsed = Date.now() - start
  return { tc, status, result, error, elapsed }
}

function assessResult({ tc, status, result, error, elapsed }) {
  const issues = []

  if (error) { issues.push(`네트워크 오류: ${error}`); return { pass: false, issues } }
  if (status !== 200) { issues.push(`HTTP ${status}: ${result?.error ?? ''}`); return { pass: false, issues } }
  if (!result?.success) { issues.push(`success=false: ${result?.error ?? ''}`); return { pass: false, issues } }
  if (!result.message?.trim()) { issues.push('빈 응답'); return { pass: false, issues } }

  const msg = result.message

  // 내부 도구명 노출 검사
  const toolNames = ['search_tournaments', 'get_tournament_detail', 'get_my_entries',
    'get_bracket', 'get_match_results', 'get_my_schedule', 'get_my_results',
    'get_awards', 'initiate_apply_flow', 'initiate_cancel_flow']
  for (const tool of toolNames) {
    if (msg.includes(tool)) issues.push(`도구명 노출: "${tool}"`)
  }

  // 영어 status 값 노출 검사 (응답에 있으면 안 됨)
  const rawStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'CONFIRMED', 'WAITLISTED',
    'UNPAID', 'OPEN', 'CLOSED', 'IN_PROGRESS', 'COMPLETED']
  for (const s of rawStatuses) {
    if (msg.includes(s)) issues.push(`영어 상태값 노출: "${s}"`)
  }

  // 신청 플로우 — flow_active 확인
  if (tc.id === 'F01' && result.flow_active !== true) {
    issues.push('신청 플로우 미시작')
  }
  if (tc.id === 'F02' && result.flow_active !== true) {
    issues.push('특정 대회 신청 플로우 미시작')
  }
  // 취소 플로우 — 신청 없으면 정상
  if (tc.id === 'F03' && !msg.includes('없') && result.flow_active !== true) {
    issues.push('취소 플로우 미시작')
  }

  // 비로그인 내 정보 → 로그인 안내
  if (tc.id === 'E05' && !msg.includes('로그인')) {
    issues.push('비로그인 케이스에 로그인 안내 없음')
  }

  // 지연 경고
  if (elapsed > 12000) issues.push(`응답 지연 (${elapsed}ms)`)

  return { pass: issues.length === 0, issues }
}

async function main() {
  console.log('═'.repeat(65))
  console.log('Tennis Tab Chat Agent 확장 통합 테스트')
  console.log(`대상: ${BASE_URL}`)
  console.log('═'.repeat(65))
  console.log()

  const results = []
  let currentGroup = ''

  for (const tc of TEST_CASES) {
    if (tc.group !== currentGroup) {
      currentGroup = tc.group
      console.log(`\n── ${tc.group} ─────────────────────────────────`)
    }

    process.stdout.write(`  [${tc.id}] ${tc.label.padEnd(18)} `)
    const r = await runTest(tc)
    const { pass, issues } = assessResult(r)
    const mark = pass ? '✅' : '❌'
    console.log(`${mark} (${r.elapsed}ms)`)
    if (!pass) {
      for (const issue of issues) console.log(`        ⚠️  ${issue}`)
    }
    if (r.result?.message) {
      const preview = r.result.message.replace(/\n/g, ' ').slice(0, 90)
      console.log(`        💬 ${preview}${r.result.message.length > 90 ? '…' : ''}`)
    }
    results.push({ tc, pass, issues, r })
  }

  console.log()
  console.log('═'.repeat(65))
  const passed = results.filter(r => r.pass).length
  const failed = results.filter(r => !r.pass).length
  console.log(`최종: ${passed}/${results.length} 통과  (실패: ${failed})`)

  if (failed > 0) {
    console.log('\n실패 목록:')
    for (const r of results.filter(r => !r.pass)) {
      console.log(`  [${r.tc.id}] ${r.tc.label}: ${r.issues.join(' / ')}`)
    }
  }

  console.log('═'.repeat(65))
  process.exit(failed > 0 ? 1 : 0)
}

main()
