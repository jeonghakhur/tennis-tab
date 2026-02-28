/**
 * Club Session 전체 E2E 테스트 스크립트
 * 실행: node scripts/test-club-session.mjs
 *
 * 테스트 시나리오: 세션 CRUD → 참석 응답 → 대진 생성 → 결과 보고/분쟁 → 통계 → 완료/취소
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { writeFileSync, mkdirSync } from 'fs'

// ============================================================================
// 환경 설정
// ============================================================================

// .env.local 파싱
function loadEnv() {
  const raw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8')
  const env = {}
  for (const line of raw.split('\n')) {
    const match = line.match(/^([^#=]+)=(.*)$/)
    if (match) env[match[1].trim()] = match[2].trim()
  }
  return env
}

const ENV = loadEnv()
const SUPABASE_URL = ENV.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = ENV.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SERVICE_ROLE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY

const CLUB_ID = '3084ca9f-c86c-4365-917a-b25cd36e2291'
const TEST_EMAIL = 'e2e.admin@mapo-tennis-test.dev'
const TEST_PASSWORD = 'test1234!'

// 테스트 결과 저장
const results = []
let totalPass = 0
let totalFail = 0

// ============================================================================
// 유틸리티
// ============================================================================

function log(step, status, detail = '') {
  const emoji = status === 'PASS' ? '✅' : status === 'FAIL' ? '❌' : '⏭️'
  const msg = `${emoji} [${step}] ${status} ${detail}`
  console.log(msg)
  results.push({ step, status, detail })
  if (status === 'PASS') totalPass++
  if (status === 'FAIL') totalFail++
}

function assert(condition, step, successMsg, failMsg) {
  if (condition) {
    log(step, 'PASS', successMsg)
    return true
  } else {
    log(step, 'FAIL', failMsg)
    return false
  }
}

/** 내일 날짜 (YYYY-MM-DD) */
function getTomorrow() {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  return d.toISOString().split('T')[0]
}

// Admin client (Service Role Key — RLS 우회)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ============================================================================
// 테스트 헬퍼: 멤버 생성/조회
// ============================================================================

async function getOrCreateTestMembers() {
  // OWNER 멤버 (이미 존재 — user_id로 특정)
  const { data: ownerMember, error: ownerErr } = await admin
    .from('club_members')
    .select('id, user_id, name, role')
    .eq('club_id', CLUB_ID)
    .eq('user_id', 'e472e215-dfa2-4215-a996-4cb29b66e073')
    .eq('status', 'ACTIVE')
    .single()

  if (ownerErr) {
    console.error('  ⚠️ OWNER 조회 에러:', ownerErr.message, ownerErr.code)
  }

  // 테스트용 멤버 2, 3 생성 (비가입 유저)
  const member2Name = `E2E_멤버2_${Date.now()}`
  const member3Name = `E2E_멤버3_${Date.now()}`

  const { data: m2, error: m2Err } = await admin
    .from('club_members')
    .insert({
      club_id: CLUB_ID,
      name: member2Name,
      is_registered: false,
      role: 'MEMBER',
      status: 'ACTIVE',
    })
    .select('id, name, role')
    .single()

  if (m2Err) console.error('  ⚠️ 멤버2 생성 에러:', m2Err.message)

  const { data: m3, error: m3Err } = await admin
    .from('club_members')
    .insert({
      club_id: CLUB_ID,
      name: member3Name,
      is_registered: false,
      role: 'MEMBER',
      status: 'ACTIVE',
    })
    .select('id, name, role')
    .single()

  if (m3Err) console.error('  ⚠️ 멤버3 생성 에러:', m3Err.message)

  return { owner: ownerMember, member2: m2, member3: m3 }
}

/** 테스트 멤버 정리 */
async function cleanupTestMembers(memberIds) {
  if (!memberIds || memberIds.length === 0) return
  // 관련 데이터 삭제
  await admin.from('club_session_attendances').delete().in('club_member_id', memberIds)
  await admin.from('club_match_results').delete().or(
    memberIds.map((id) => `player1_member_id.eq.${id},player2_member_id.eq.${id}`).join(',')
  )
  await admin.from('club_member_stats').delete().in('club_member_id', memberIds)
  await admin.from('club_members').delete().in('id', memberIds)
}

/** 테스트 세션 삭제 */
async function cleanupTestSessions(sessionIds) {
  if (!sessionIds || sessionIds.length === 0) return
  await admin.from('club_session_attendances').delete().in('session_id', sessionIds)
  await admin.from('club_match_results').delete().in('session_id', sessionIds)
  await admin.from('club_sessions').delete().in('id', sessionIds)
}

// ============================================================================
// 메인 테스트
// ============================================================================

async function main() {
  console.log('='.repeat(60))
  console.log('🎾 Club Session E2E 테스트 시작')
  console.log('='.repeat(60))
  console.log()

  // 상태 추적
  let accessToken = null
  let sessionId = null
  let session2Id = null  // 취소 테스트용
  const createdSessionIds = []
  const createdMemberIds = []

  try {
    // ================================================================
    // [A] 로그인 + 멤버 준비
    // ================================================================
    console.log('\n--- [A] 로그인 + 멤버 준비 ---')

    // A1: 로그인
    const { data: authData, error: authError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: TEST_EMAIL,
    })
    // signInWithPassword 사용
    const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: signInData, error: signInError } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    })
    assert(!signInError && signInData?.session, 'A1-로그인',
      `access_token 획득 (user_id: ${signInData?.user?.id})`,
      `로그인 실패: ${signInError?.message}`)
    accessToken = signInData?.session?.access_token

    // A2: 테스트 멤버 준비
    const members = await getOrCreateTestMembers()
    assert(members.owner && members.member2 && members.member3, 'A2-멤버준비',
      `OWNER: ${members.owner?.name}, M2: ${members.member2?.name}, M3: ${members.member3?.name}`,
      '멤버 준비 실패')
    if (members.member2) createdMemberIds.push(members.member2.id)
    if (members.member3) createdMemberIds.push(members.member3.id)

    // ================================================================
    // [B] 세션 생성
    // ================================================================
    console.log('\n--- [B] 세션 생성 ---')

    const tomorrow = getTomorrow()
    const sessionInput = {
      club_id: CLUB_ID,
      title: `E2E 테스트 모임 ${Date.now()}`,
      venue_name: '마포 테니스장',
      court_numbers: ['1번', '2번'],
      session_date: tomorrow,
      start_time: '09:00',
      end_time: '12:00',
      max_attendees: 10,
      created_by: members.owner.user_id,
    }

    const { data: newSession, error: sessionErr } = await admin
      .from('club_sessions')
      .insert(sessionInput)
      .select()
      .single()

    assert(!sessionErr && newSession, 'B1-세션생성',
      `session_id: ${newSession?.id}, title: ${newSession?.title}`,
      `생성 실패: ${sessionErr?.message}`)
    sessionId = newSession?.id
    if (sessionId) createdSessionIds.push(sessionId)

    // ================================================================
    // [C] 세션 조회
    // ================================================================
    console.log('\n--- [C] 세션 조회 ---')

    // C1: 목록 조회
    const { data: sessionList } = await admin
      .from('club_sessions')
      .select('*')
      .eq('club_id', CLUB_ID)
      .in('status', ['OPEN', 'CLOSED'])
      .order('session_date', { ascending: false })
      .limit(20)

    const foundInList = sessionList?.some((s) => s.id === sessionId)
    assert(foundInList, 'C1-목록조회', `${sessionList?.length}건 중 생성한 세션 발견`, '목록에 세션 없음')

    // C2: 상세 조회
    const { data: detail } = await admin
      .from('club_sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    assert(detail?.title === sessionInput.title, 'C2-상세조회',
      `title: ${detail?.title}, venue: ${detail?.venue_name}`,
      '상세 조회 실패')

    // ================================================================
    // [D] 세션 수정
    // ================================================================
    console.log('\n--- [D] 세션 수정 ---')

    const updatedTitle = `E2E 수정된 모임 ${Date.now()}`
    const { error: updateErr } = await admin
      .from('club_sessions')
      .update({ title: updatedTitle, notes: 'E2E 테스트 메모' })
      .eq('id', sessionId)

    assert(!updateErr, 'D1-세션수정', `제목 변경: ${updatedTitle}`, `수정 실패: ${updateErr?.message}`)

    // 변경 확인
    const { data: updated } = await admin
      .from('club_sessions')
      .select('title, notes')
      .eq('id', sessionId)
      .single()

    assert(updated?.title === updatedTitle && updated?.notes === 'E2E 테스트 메모',
      'D2-수정확인', `title: ${updated?.title}, notes: ${updated?.notes}`, '수정 내용 불일치')

    // ================================================================
    // [E] 참석 응답
    // ================================================================
    console.log('\n--- [E] 참석 응답 ---')

    // E1: OWNER 참석
    const { error: rsvpErr1 } = await admin
      .from('club_session_attendances')
      .upsert({
        session_id: sessionId,
        club_member_id: members.owner.id,
        status: 'ATTENDING',
        available_from: '09:00',
        available_until: '12:00',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'session_id,club_member_id' })

    assert(!rsvpErr1, 'E1-OWNER참석', 'ATTENDING 응답 등록', `실패: ${rsvpErr1?.message}`)

    // E2: 멤버2 참석
    const { error: rsvpErr2 } = await admin
      .from('club_session_attendances')
      .upsert({
        session_id: sessionId,
        club_member_id: members.member2.id,
        status: 'ATTENDING',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'session_id,club_member_id' })

    assert(!rsvpErr2, 'E2-멤버2참석', 'ATTENDING 응답 등록', `실패: ${rsvpErr2?.message}`)

    // E3: 멤버3 불참
    const { error: rsvpErr3 } = await admin
      .from('club_session_attendances')
      .upsert({
        session_id: sessionId,
        club_member_id: members.member3.id,
        status: 'NOT_ATTENDING',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'session_id,club_member_id' })

    assert(!rsvpErr3, 'E3-멤버3불참', 'NOT_ATTENDING 응답 등록', `실패: ${rsvpErr3?.message}`)

    // E4: 응답 현황 확인
    const { data: attendances } = await admin
      .from('club_session_attendances')
      .select('*, club_members!inner(id, name, rating, is_registered)')
      .eq('session_id', sessionId)

    const attending = attendances?.filter((a) => a.status === 'ATTENDING').length
    const notAttending = attendances?.filter((a) => a.status === 'NOT_ATTENDING').length
    assert(attending === 2 && notAttending === 1, 'E4-응답현황',
      `참석 ${attending}명, 불참 ${notAttending}명`, `예상: 참석2 불참1, 실제: 참석${attending} 불참${notAttending}`)

    // ================================================================
    // [F] 참석 응답 수정/취소
    // ================================================================
    console.log('\n--- [F] 참석 응답 수정/취소 ---')

    // F1: OWNER 참석→불참
    const { error: rsvpUpdateErr1 } = await admin
      .from('club_session_attendances')
      .upsert({
        session_id: sessionId,
        club_member_id: members.owner.id,
        status: 'NOT_ATTENDING',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'session_id,club_member_id' })

    assert(!rsvpUpdateErr1, 'F1-참석→불참', 'OWNER NOT_ATTENDING 변경', `실패: ${rsvpUpdateErr1?.message}`)

    // F2: 다시 참석
    const { error: rsvpUpdateErr2 } = await admin
      .from('club_session_attendances')
      .upsert({
        session_id: sessionId,
        club_member_id: members.owner.id,
        status: 'ATTENDING',
        available_from: '09:00',
        available_until: '12:00',
        responded_at: new Date().toISOString(),
      }, { onConflict: 'session_id,club_member_id' })

    assert(!rsvpUpdateErr2, 'F2-불참→참석', 'OWNER ATTENDING 복원', `실패: ${rsvpUpdateErr2?.message}`)

    // F3: 응답 마감 (OPEN → CLOSED)
    const { error: closeErr } = await admin
      .from('club_sessions')
      .update({ status: 'CLOSED' })
      .eq('id', sessionId)

    assert(!closeErr, 'F3-응답마감', 'OPEN → CLOSED 전환', `실패: ${closeErr?.message}`)

    // F4: 마감 후 응답 시도 (서버 액션 로직에서 차단 — DB 레벨에서는 허용)
    // 서버 액션의 session.status !== 'OPEN' 체크를 DB 레벨에서 시뮬레이션
    const { data: closedSession } = await admin
      .from('club_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    assert(closedSession?.status === 'CLOSED', 'F4-마감확인',
      '세션 상태 CLOSED 확인', `상태: ${closedSession?.status}`)

    // ================================================================
    // [G] 대진 생성 (라운드로빈)
    // ================================================================
    console.log('\n--- [G] 대진 생성 ---')

    // 참석 멤버: owner + member2
    const attendingMembers = [members.owner.id, members.member2.id]

    // 라운드로빈 조합 생성
    const matchPairs = []
    for (let i = 0; i < attendingMembers.length; i++) {
      for (let j = i + 1; j < attendingMembers.length; j++) {
        matchPairs.push({
          session_id: sessionId,
          player1_member_id: attendingMembers[i],
          player2_member_id: attendingMembers[j],
        })
      }
    }

    const { data: matches, error: matchErr } = await admin
      .from('club_match_results')
      .insert(matchPairs)
      .select()

    assert(!matchErr && matches?.length > 0, 'G1-라운드로빈',
      `${matches?.length}건 대진 생성 (${attendingMembers.length}명)`,
      `생성 실패: ${matchErr?.message}`)

    // G2: 경기 목록 조회
    const { data: matchList } = await admin
      .from('club_match_results')
      .select(`
        *,
        player1:club_members!club_match_results_player1_member_id_fkey(id, name),
        player2:club_members!club_match_results_player2_member_id_fkey(id, name)
      `)
      .eq('session_id', sessionId)

    assert(matchList?.length === matchPairs.length, 'G2-경기목록',
      `${matchList?.length}건 조회, 상태: ${matchList?.[0]?.status}`,
      `예상 ${matchPairs.length}건, 실제 ${matchList?.length}건`)

    // ================================================================
    // [H] 경기 결과 보고 + 분쟁
    // ================================================================
    console.log('\n--- [H] 경기 결과 보고 ---')

    const match1 = matchList?.[0]
    if (match1) {
      // H1: player1(owner)이 결과 보고: 6-4
      const { error: r1Err } = await admin
        .from('club_match_results')
        .update({
          player1_reported_score_p1: 6,
          player1_reported_score_p2: 4,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match1.id)

      assert(!r1Err, 'H1-P1결과보고', 'player1: 6-4 보고', `실패: ${r1Err?.message}`)

      // H2: player2(member2)가 같은 결과 보고: 4-6 → 양측 일치 → COMPLETED
      const { error: r2Err } = await admin
        .from('club_match_results')
        .update({
          player2_reported_score_p1: 6,
          player2_reported_score_p2: 4,
          // 일치: player1_score=6, player2_score=4, status=COMPLETED
          player1_score: 6,
          player2_score: 4,
          winner_member_id: match1.player1_member_id,
          status: 'COMPLETED',
          updated_at: new Date().toISOString(),
        })
        .eq('id', match1.id)

      assert(!r2Err, 'H2-P2결과보고(일치)', 'player2: 4-6 보고 → COMPLETED', `실패: ${r2Err?.message}`)

      // H3: 결과 확인
      const { data: completedMatch } = await admin
        .from('club_match_results')
        .select('status, player1_score, player2_score, winner_member_id')
        .eq('id', match1.id)
        .single()

      assert(completedMatch?.status === 'COMPLETED' && completedMatch?.player1_score === 6,
        'H3-결과확인',
        `status: ${completedMatch?.status}, score: ${completedMatch?.player1_score}-${completedMatch?.player2_score}`,
        `예상: COMPLETED 6-4`)

      // 통계 갱신 (서버 액션의 updateStatsAfterMatch 시뮬레이션)
      const season = new Date().getFullYear().toString()
      for (const playerId of [match1.player1_member_id, match1.player2_member_id]) {
        const isWinner = playerId === match1.player1_member_id  // p1이 승자 (6-4)

        const { data: existingStat } = await admin
          .from('club_member_stats')
          .select('id, total_games, wins, losses')
          .eq('club_id', CLUB_ID)
          .eq('club_member_id', playerId)
          .eq('season', season)
          .single()

        if (existingStat) {
          await admin
            .from('club_member_stats')
            .update({
              total_games: existingStat.total_games + 1,
              wins: existingStat.wins + (isWinner ? 1 : 0),
              losses: existingStat.losses + (!isWinner ? 1 : 0),
              last_played_at: new Date().toISOString(),
            })
            .eq('id', existingStat.id)
        } else {
          await admin.from('club_member_stats').insert({
            club_id: CLUB_ID,
            club_member_id: playerId,
            season,
            total_games: 1,
            wins: isWinner ? 1 : 0,
            losses: !isWinner ? 1 : 0,
            last_played_at: new Date().toISOString(),
          })
        }
      }
    }

    // ================================================================
    // [H-2] 분쟁 시나리오 (새 경기 추가)
    // ================================================================
    console.log('\n--- [H-2] 분쟁 시나리오 ---')

    // 분쟁 테스트용 두 번째 경기 생성
    const { data: disputeMatch, error: dMatchErr } = await admin
      .from('club_match_results')
      .insert({
        session_id: sessionId,
        player1_member_id: members.owner.id,
        player2_member_id: members.member2.id,
      })
      .select()
      .single()

    assert(!dMatchErr && disputeMatch, 'H4-분쟁경기생성',
      `match_id: ${disputeMatch?.id}`, `실패: ${dMatchErr?.message}`)

    if (disputeMatch) {
      // H5: player1이 6-4 보고
      await admin
        .from('club_match_results')
        .update({
          player1_reported_score_p1: 6,
          player1_reported_score_p2: 4,
        })
        .eq('id', disputeMatch.id)

      // H6: player2가 6-3 보고 (불일치) → DISPUTED
      const { error: disputeErr } = await admin
        .from('club_match_results')
        .update({
          player2_reported_score_p1: 3,
          player2_reported_score_p2: 6,
          status: 'DISPUTED',
        })
        .eq('id', disputeMatch.id)

      assert(!disputeErr, 'H5-불일치→DISPUTED', 'P1: 6-4 vs P2: 6-3 → DISPUTED', `실패: ${disputeErr?.message}`)

      // H6: 상태 확인
      const { data: disputedMatch } = await admin
        .from('club_match_results')
        .select('status')
        .eq('id', disputeMatch.id)
        .single()

      assert(disputedMatch?.status === 'DISPUTED', 'H6-분쟁상태확인',
        `status: ${disputedMatch?.status}`, `예상: DISPUTED`)

      // H7: 관리자가 분쟁 해결
      const { error: resolveErr } = await admin
        .from('club_match_results')
        .update({
          player1_score: 6,
          player2_score: 4,
          winner_member_id: members.owner.id,
          status: 'COMPLETED',
          dispute_resolved_by: members.owner.user_id,
          dispute_resolved_at: new Date().toISOString(),
        })
        .eq('id', disputeMatch.id)

      assert(!resolveErr, 'H7-분쟁해결',
        `관리자 결정: 6-4 (승자: OWNER)`, `실패: ${resolveErr?.message}`)

      // 통계 갱신 (분쟁 해결 후)
      const season = new Date().getFullYear().toString()
      for (const playerId of [members.owner.id, members.member2.id]) {
        const isWinner = playerId === members.owner.id

        const { data: existingStat } = await admin
          .from('club_member_stats')
          .select('id, total_games, wins, losses')
          .eq('club_id', CLUB_ID)
          .eq('club_member_id', playerId)
          .eq('season', season)
          .single()

        if (existingStat) {
          await admin
            .from('club_member_stats')
            .update({
              total_games: existingStat.total_games + 1,
              wins: existingStat.wins + (isWinner ? 1 : 0),
              losses: existingStat.losses + (!isWinner ? 1 : 0),
              last_played_at: new Date().toISOString(),
            })
            .eq('id', existingStat.id)
        } else {
          await admin.from('club_member_stats').insert({
            club_id: CLUB_ID,
            club_member_id: playerId,
            season,
            total_games: 1,
            wins: isWinner ? 1 : 0,
            losses: !isWinner ? 1 : 0,
            last_played_at: new Date().toISOString(),
          })
        }
      }
    }

    // ================================================================
    // [I] 통계 확인
    // ================================================================
    console.log('\n--- [I] 통계 확인 ---')

    const season = new Date().getFullYear().toString()

    // I1: 클럽 순위 조회
    const { data: rankings } = await admin
      .from('club_member_stats')
      .select('*, club_members!inner(id, name, rating)')
      .eq('club_id', CLUB_ID)
      .eq('season', season)
      .gt('total_games', 0)
      .order('win_rate', { ascending: false })

    assert(rankings && rankings.length > 0, 'I1-순위조회',
      `${rankings?.length}명 순위 데이터 (1위: ${rankings?.[0]?.club_members?.name}, 승률 ${rankings?.[0]?.win_rate}%)`,
      '순위 데이터 없음')

    // I2: OWNER 통계 확인
    const ownerStat = rankings?.find((r) => r.club_member_id === members.owner.id)
    assert(ownerStat && ownerStat.total_games >= 2, 'I2-OWNER통계',
      `경기 ${ownerStat?.total_games}, 승 ${ownerStat?.wins}, 패 ${ownerStat?.losses}, 승률 ${ownerStat?.win_rate}%`,
      `OWNER 통계 부족: ${JSON.stringify(ownerStat)}`)

    // I3: 멤버2 통계 확인
    const m2Stat = rankings?.find((r) => r.club_member_id === members.member2.id)
    assert(m2Stat && m2Stat.total_games >= 2, 'I3-멤버2통계',
      `경기 ${m2Stat?.total_games}, 승 ${m2Stat?.wins}, 패 ${m2Stat?.losses}, 승률 ${m2Stat?.win_rate}%`,
      `멤버2 통계 부족: ${JSON.stringify(m2Stat)}`)

    // ================================================================
    // [J] 세션 완료 처리
    // ================================================================
    console.log('\n--- [J] 세션 완료 처리 ---')

    // CLOSED 상태에서만 완료 가능
    const { data: sessionBeforeComplete } = await admin
      .from('club_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    assert(sessionBeforeComplete?.status === 'CLOSED', 'J1-완료전상태', 'CLOSED 상태 확인', `상태: ${sessionBeforeComplete?.status}`)

    // 참석자 sessions_attended 갱신
    const { data: attendingForComplete } = await admin
      .from('club_session_attendances')
      .select('club_member_id')
      .eq('session_id', sessionId)
      .eq('status', 'ATTENDING')

    if (attendingForComplete) {
      for (const a of attendingForComplete) {
        const { data: existingStat } = await admin
          .from('club_member_stats')
          .select('id, sessions_attended')
          .eq('club_id', CLUB_ID)
          .eq('club_member_id', a.club_member_id)
          .eq('season', season)
          .single()

        if (existingStat) {
          await admin
            .from('club_member_stats')
            .update({ sessions_attended: existingStat.sessions_attended + 1 })
            .eq('id', existingStat.id)
        } else {
          await admin.from('club_member_stats').insert({
            club_id: CLUB_ID,
            club_member_id: a.club_member_id,
            season,
            sessions_attended: 1,
          })
        }
      }
    }

    // COMPLETED 처리
    const { error: completeErr } = await admin
      .from('club_sessions')
      .update({ status: 'COMPLETED' })
      .eq('id', sessionId)

    assert(!completeErr, 'J2-완료처리', 'CLOSED → COMPLETED 전환', `실패: ${completeErr?.message}`)

    // 완료 확인
    const { data: completedSession } = await admin
      .from('club_sessions')
      .select('status')
      .eq('id', sessionId)
      .single()

    assert(completedSession?.status === 'COMPLETED', 'J3-완료확인',
      `status: ${completedSession?.status}`, `예상: COMPLETED`)

    // ================================================================
    // [K] 세션 취소
    // ================================================================
    console.log('\n--- [K] 세션 취소 ---')

    // 새 세션 생성 후 취소
    const { data: session2, error: s2Err } = await admin
      .from('club_sessions')
      .insert({
        club_id: CLUB_ID,
        title: `E2E 취소 테스트 ${Date.now()}`,
        venue_name: '테스트 코트',
        court_numbers: ['A'],
        session_date: tomorrow,
        start_time: '14:00',
        end_time: '16:00',
        created_by: members.owner.user_id,
      })
      .select()
      .single()

    assert(!s2Err && session2, 'K1-취소용세션생성',
      `session_id: ${session2?.id}`, `실패: ${s2Err?.message}`)
    session2Id = session2?.id
    if (session2Id) createdSessionIds.push(session2Id)

    // 취소
    const { error: cancelErr } = await admin
      .from('club_sessions')
      .update({ status: 'CANCELLED' })
      .eq('id', session2Id)

    assert(!cancelErr, 'K2-세션취소', 'OPEN → CANCELLED', `실패: ${cancelErr?.message}`)

    const { data: cancelledSession } = await admin
      .from('club_sessions')
      .select('status')
      .eq('id', session2Id)
      .single()

    assert(cancelledSession?.status === 'CANCELLED', 'K3-취소확인',
      `status: ${cancelledSession?.status}`, `예상: CANCELLED`)

    // ================================================================
    // [L] 경기 삭제 테스트
    // ================================================================
    console.log('\n--- [L] 경기 삭제 테스트 ---')

    // 취소용 세션에 경기 추가 후 삭제
    const { data: delMatch, error: delMatchErr } = await admin
      .from('club_match_results')
      .insert({
        session_id: session2Id,
        player1_member_id: members.owner.id,
        player2_member_id: members.member2.id,
        status: 'SCHEDULED',
      })
      .select()
      .single()

    assert(!delMatchErr, 'L1-삭제용경기생성', `match_id: ${delMatch?.id}`, `실패: ${delMatchErr?.message}`)

    if (delMatch) {
      const { error: deleteErr } = await admin
        .from('club_match_results')
        .delete()
        .eq('id', delMatch.id)

      assert(!deleteErr, 'L2-경기삭제', 'SCHEDULED 경기 삭제 성공', `실패: ${deleteErr?.message}`)

      // 삭제 확인
      const { data: deletedMatch } = await admin
        .from('club_match_results')
        .select('id')
        .eq('id', delMatch.id)
        .single()

      assert(!deletedMatch, 'L3-삭제확인', '경기 데이터 제거 확인', '삭제 안 됨')
    }

  } catch (error) {
    log('ERROR', 'FAIL', `예외 발생: ${error.message}\n${error.stack}`)
  } finally {
    // ================================================================
    // 정리 (cleanup)
    // ================================================================
    console.log('\n--- 테스트 데이터 정리 ---')

    // 통계 삭제
    await admin.from('club_member_stats')
      .delete()
      .in('club_member_id', createdMemberIds)

    // 세션 관련 데이터 삭제
    await cleanupTestSessions(createdSessionIds)

    // 멤버 삭제
    await cleanupTestMembers(createdMemberIds)

    console.log('정리 완료')
  }

  // ================================================================
  // 결과 요약
  // ================================================================
  console.log('\n' + '='.repeat(60))
  console.log(`🎾 테스트 결과: ${totalPass} PASS / ${totalFail} FAIL (총 ${totalPass + totalFail}건)`)
  console.log('='.repeat(60))

  // 보고서 생성
  generateReport()

  if (totalFail > 0) {
    process.exit(1)
  }
}

// ============================================================================
// 보고서 생성
// ============================================================================

function generateReport() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19)
  let md = `# Club Session E2E 테스트 보고서\n\n`
  md += `- **실행 일시**: ${now}\n`
  md += `- **결과**: ${totalPass} PASS / ${totalFail} FAIL (총 ${totalPass + totalFail}건)\n`
  md += `- **테스트 계정**: ${TEST_EMAIL}\n`
  md += `- **클럽 ID**: ${CLUB_ID}\n\n`

  md += `## 상세 결과\n\n`
  md += `| # | 테스트 | 결과 | 상세 |\n`
  md += `|---|--------|------|------|\n`

  results.forEach((r, i) => {
    const emoji = r.status === 'PASS' ? '✅' : '❌'
    md += `| ${i + 1} | ${r.step} | ${emoji} ${r.status} | ${r.detail} |\n`
  })

  md += `\n## 테스트 시나리오\n\n`
  md += `1. **[A] 로그인 + 멤버 준비**: 테스트 계정 로그인, OWNER + 비가입 멤버 2명 생성\n`
  md += `2. **[B] 세션 생성**: 내일 날짜로 세션 생성 (코트 2개, 정원 10명)\n`
  md += `3. **[C] 세션 조회**: 목록 + 상세 조회\n`
  md += `4. **[D] 세션 수정**: 제목, 메모 변경\n`
  md += `5. **[E] 참석 응답**: OWNER 참석, 멤버2 참석, 멤버3 불참\n`
  md += `6. **[F] 응답 수정/마감**: 참석↔불참 전환, RSVP 마감 (CLOSED)\n`
  md += `7. **[G] 대진 생성**: 라운드로빈 자동 생성\n`
  md += `8. **[H] 결과 보고**: 양측 일치 → COMPLETED, 불일치 → DISPUTED\n`
  md += `9. **[H-2] 분쟁 해결**: 관리자가 최종 점수 결정\n`
  md += `10. **[I] 통계 확인**: 순위, 승률, 경기수\n`
  md += `11. **[J] 세션 완료**: CLOSED → COMPLETED (sessions_attended 갱신)\n`
  md += `12. **[K] 세션 취소**: 새 세션 → CANCELLED\n`
  md += `13. **[L] 경기 삭제**: SCHEDULED 경기 삭제\n`

  mkdirSync(new URL('../docs', import.meta.url), { recursive: true })
  writeFileSync(new URL('../docs/test-club-session-report.md', import.meta.url), md)
  console.log('\n📄 보고서 저장: docs/test-club-session-report.md')
}

// ============================================================================
// 실행
// ============================================================================

main()
