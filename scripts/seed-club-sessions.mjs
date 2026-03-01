/**
 * 건승회 1~2월 주말 모임 시드 데이터 생성
 * 실행: node scripts/seed-club-sessions.mjs
 */

import { createClient } from '@supabase/supabase-js'

// ============================================================================
// 설정
// ============================================================================

const SUPABASE_URL = 'https://tigqwrehpzwaksnvcrrx.supabase.co'
const SERVICE_ROLE_KEY = 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const CLUB_ID = '3084ca9f-c86c-4365-917a-b25cd36e2291'
const CREATED_BY = 'e472e215-dfa2-4215-a996-4cb29b66e073' // e2e admin user_id

const MEMBERS = [
  { id: 'eacc70ca-2059-40a5-b92d-5bb13d8fac1d', name: 'E2E 테스터', role: 'OWNER' },
  { id: '1d656bc5-70e2-4a2f-9632-5368d7d47660', name: '최재원', role: 'MEMBER' },
  { id: '89b32214-604c-4c57-add0-f8b02322fe35', name: '김준석', role: 'MEMBER' },
  { id: '1f161427-b491-4f77-86e3-e1d542bbd488', name: '양진용', role: 'MEMBER' },
  { id: '3e36960a-df7c-4d9a-b2a1-c49c78b2e5b6', name: '김동현', role: 'MEMBER' },
  { id: '36b1d068-cc1f-4a87-bac6-3766f9f4b3a6', name: '윤슬', role: 'MEMBER' },
  { id: 'a484d910-119b-43d4-832a-cc23df898188', name: '박선우', role: 'MEMBER' },
  { id: '54d8b9a9-108c-4793-9fdd-95673e372611', name: '윤필재', role: 'MEMBER' },
  { id: '484b06ba-bfdb-4883-a3b0-1b1123e7cfb6', name: '김정은', role: 'MEMBER' },
  { id: '5d23abbd-c943-4251-a9b9-c3f372495968', name: '김용희', role: 'MEMBER' },
]

const SESSION_DATES = [
  '2026-01-03', '2026-01-10', '2026-01-17', '2026-01-24',
  '2026-02-07', '2026-02-14', '2026-02-21', '2026-02-28',
]

// 현실적인 테니스 점수 조합 (승자 기준)
const SCORE_PAIRS = [
  [6, 4], [6, 3], [6, 2], [6, 1], [7, 5], [7, 6], [6, 0],
]

// ============================================================================
// 유틸리티
// ============================================================================

/** 배열에서 n개 랜덤 선택 */
function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

/** 랜덤 점수 생성 (승자/패자 점수 반환) */
function randomScore() {
  const [winnerScore, loserScore] = SCORE_PAIRS[Math.floor(Math.random() * SCORE_PAIRS.length)]
  return { winnerScore, loserScore }
}

/** 2명 조합 생성 */
function combinations(arr) {
  const result = []
  for (let i = 0; i < arr.length; i++) {
    for (let j = i + 1; j < arr.length; j++) {
      result.push([arr[i], arr[j]])
    }
  }
  return result
}

// ============================================================================
// 메인
// ============================================================================

async function main() {
  console.log('🎾 건승회 1~2월 시드 데이터 생성 시작\n')

  // 기존 데이터 정리 (해당 클럽의 세션 데이터)
  console.log('🗑️  기존 세션 데이터 삭제...')
  const { data: existingSessions } = await admin
    .from('club_sessions')
    .select('id')
    .eq('club_id', CLUB_ID)
    .in('session_date', SESSION_DATES)

  if (existingSessions?.length) {
    const sessionIds = existingSessions.map((s) => s.id)
    // cascade로 attendances, matches 자동 삭제
    const { error } = await admin.from('club_sessions').delete().in('id', sessionIds)
    if (error) throw new Error(`기존 데이터 삭제 실패: ${error.message}`)
    console.log(`   ${sessionIds.length}개 기존 세션 삭제 완료`)
  }

  // 기존 통계도 삭제
  await admin
    .from('club_member_stats')
    .delete()
    .eq('club_id', CLUB_ID)
    .eq('season', '2026')

  // 1. 세션 생성
  console.log('\n📅 세션 생성...')
  const sessionRows = SESSION_DATES.map((date, i) => {
    const month = date.startsWith('2026-01') ? '1월' : '2월'
    const weekNum = date.startsWith('2026-01') ? i + 1 : i - 3
    return {
      club_id: CLUB_ID,
      title: `${month} ${weekNum}주차 정기 모임`,
      venue_name: '망원한강공원 테니스장',
      court_numbers: ['1번', '2번'],
      session_date: date,
      start_time: '10:00',
      end_time: '14:00',
      status: 'COMPLETED',
      created_by: CREATED_BY,
    }
  })

  const { data: sessions, error: sessionErr } = await admin
    .from('club_sessions')
    .insert(sessionRows)
    .select('id, session_date, title')

  if (sessionErr) throw new Error(`세션 생성 실패: ${sessionErr.message}`)
  console.log(`   ${sessions.length}개 세션 생성 완료`)

  // 멤버별 통계 누적용
  const stats = {}
  for (const m of MEMBERS) {
    stats[m.id] = { wins: 0, losses: 0, totalGames: 0, sessionsAttended: 0, lastPlayedAt: null }
  }

  // 2. 각 세션별 참석 + 경기 생성
  for (const session of sessions) {
    console.log(`\n🏟️  ${session.title} (${session.session_date})`)

    // 참석자 7~8명 랜덤 선택
    const attendeeCount = 7 + Math.floor(Math.random() * 2) // 7 or 8
    const attendees = pickRandom(MEMBERS, attendeeCount)
    const absentees = MEMBERS.filter((m) => !attendees.find((a) => a.id === m.id))

    // 참석 응답 생성
    const attendanceRows = [
      ...attendees.map((m) => ({
        session_id: session.id,
        club_member_id: m.id,
        status: 'ATTENDING',
        available_from: '10:00',
        available_until: '14:00',
        responded_at: new Date(`${session.session_date}T00:00:00+09:00`).toISOString(),
      })),
      ...absentees.map((m) => ({
        session_id: session.id,
        club_member_id: m.id,
        status: 'NOT_ATTENDING',
        responded_at: new Date(`${session.session_date}T00:00:00+09:00`).toISOString(),
      })),
    ]

    const { error: attErr } = await admin.from('club_session_attendances').insert(attendanceRows)
    if (attErr) throw new Error(`참석 응답 생성 실패: ${attErr.message}`)
    console.log(`   참석: ${attendees.map((a) => a.name).join(', ')}`)

    // 참석 통계
    for (const a of attendees) {
      stats[a.id].sessionsAttended++
    }

    // 라운드로빈 경기 생성
    const matchups = combinations(attendees)
    const courts = ['1번', '2번']
    const matchRows = matchups.map(([p1, p2], idx) => {
      const { winnerScore, loserScore } = randomScore()
      // 50% 확률로 승자 결정
      const p1Wins = Math.random() > 0.5
      const p1Score = p1Wins ? winnerScore : loserScore
      const p2Score = p1Wins ? loserScore : winnerScore
      const winnerId = p1Wins ? p1.id : p2.id

      return {
        session_id: session.id,
        player1_member_id: p1.id,
        player2_member_id: p2.id,
        court_number: courts[idx % courts.length],
        player1_score: p1Score,
        player2_score: p2Score,
        winner_member_id: winnerId,
        status: 'COMPLETED',
      }
    })

    const { error: matchErr } = await admin.from('club_match_results').insert(matchRows)
    if (matchErr) throw new Error(`경기 결과 생성 실패: ${matchErr.message}`)
    console.log(`   경기: ${matchRows.length}개 (라운드로빈)`)

    // 통계 누적
    const sessionDate = new Date(`${session.session_date}T14:00:00+09:00`).toISOString()
    for (const match of matchRows) {
      stats[match.player1_member_id].totalGames++
      stats[match.player2_member_id].totalGames++

      if (match.winner_member_id === match.player1_member_id) {
        stats[match.player1_member_id].wins++
        stats[match.player2_member_id].losses++
      } else {
        stats[match.player2_member_id].wins++
        stats[match.player1_member_id].losses++
      }

      stats[match.player1_member_id].lastPlayedAt = sessionDate
      stats[match.player2_member_id].lastPlayedAt = sessionDate
    }
  }

  // 3. 통계 upsert
  console.log('\n📊 통계 저장...')
  const statRows = MEMBERS
    .filter((m) => stats[m.id].totalGames > 0)
    .map((m) => ({
      club_id: CLUB_ID,
      club_member_id: m.id,
      season: '2026',
      total_games: stats[m.id].totalGames,
      wins: stats[m.id].wins,
      losses: stats[m.id].losses,
      sessions_attended: stats[m.id].sessionsAttended,
      last_played_at: stats[m.id].lastPlayedAt,
    }))

  const { error: statErr } = await admin
    .from('club_member_stats')
    .upsert(statRows, { onConflict: 'club_id,club_member_id,season' })
  if (statErr) throw new Error(`통계 저장 실패: ${statErr.message}`)

  // 결과 출력
  console.log('\n📈 멤버별 통계:')
  console.log('─'.repeat(60))
  console.log(
    '이름'.padEnd(10) +
      '참석'.padStart(4) +
      '경기'.padStart(6) +
      '승'.padStart(4) +
      '패'.padStart(4) +
      '승률'.padStart(8)
  )
  console.log('─'.repeat(60))

  for (const m of MEMBERS) {
    const s = stats[m.id]
    if (s.totalGames === 0) continue
    const winRate = ((s.wins / s.totalGames) * 100).toFixed(1)
    console.log(
      m.name.padEnd(10) +
        `${s.sessionsAttended}`.padStart(4) +
        `${s.totalGames}`.padStart(6) +
        `${s.wins}`.padStart(4) +
        `${s.losses}`.padStart(4) +
        `${winRate}%`.padStart(8)
    )
  }

  console.log('\n✅ 시드 데이터 생성 완료!')
}

main().catch((err) => {
  console.error('\n❌ 에러:', err.message)
  process.exit(1)
})
