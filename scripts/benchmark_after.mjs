import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://tigqwrehpzwaksnvcrrx.supabase.co'
const SERVICE_KEY = 'sb_secret_DecDZr1nAkc4vX_fn_Ur9Q_xgTv4_V3'
const CLUB_ID = '3084ca9f-c86c-4365-917a-b25cd36e2291'
const SESSION_ID = 'be7e0040-e107-42d5-a0f3-105001e4e127'

const sb = createClient(SUPABASE_URL, SERVICE_KEY)

async function measure(label, fn) {
  const start = Date.now()
  const result = await fn()
  const elapsed = Date.now() - start
  console.log(`${label}: ${elapsed}ms`)
  return { label, elapsed }
}

async function main() {
  console.log('=== AFTER 최적화 벤치마크 ===\n')
  const results = []

  // 1. getClubSessions - 최적화: 특정 컬럼만 선택 (session_id 제거)
  results.push(await measure('getClubSessions', async () => {
    return sb.from('club_sessions')
      .select('id, club_id, title, venue_name, court_numbers, session_date, start_time, end_time, max_attendees, status, rsvp_deadline, notes, created_by, created_at, updated_at, club_session_attendances(status, club_member_id)')
      .eq('club_id', CLUB_ID)
      .order('session_date', { ascending: false })
  }))

  // 2. getSessionPageData - 이미 병렬 (변경 없음)
  results.push(await measure('getSessionPageData', async () => {
    return Promise.all([
      sb.from('club_sessions').select('*').eq('id', SESSION_ID).single(),
      sb.from('club_session_attendances')
        .select('*, club_members!inner(id, name, rating, is_registered)')
        .eq('session_id', SESSION_ID),
      sb.from('club_match_results')
        .select('*, player1:club_members!club_match_results_player1_member_id_fkey(id,name), player2:club_members!club_match_results_player2_member_id_fkey(id,name)')
        .eq('session_id', SESSION_ID),
    ])
  }))

  // 3. getClubsWithMyRoles - 이미 병렬 (변경 없음)
  results.push(await measure('getClubsWithMyRoles', async () => {
    return sb.from('clubs')
      .select('*, associations:association_id (name)')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
  }))

  // 4. getClubMembers - SELECT * (타입 전체 반환 필요)
  results.push(await measure('getClubMembers', async () => {
    return sb.from('club_members')
      .select('*')
      .eq('club_id', CLUB_ID)
      .order('role', { ascending: true })
  }))

  // 5. getClubRankings
  results.push(await measure('getClubRankings', async () => {
    return sb.from('club_member_stats')
      .select('*, club_members!inner(id, name, rating)')
      .eq('club_id', CLUB_ID)
      .eq('season', '2026')
      .gt('total_games', 0)
      .order('win_rate', { ascending: false })
  }))

  // 6. getSessionMatches
  results.push(await measure('getSessionMatches', async () => {
    return sb.from('club_match_results')
      .select('*, player1:club_members!club_match_results_player1_member_id_fkey(id, name), player2:club_members!club_match_results_player2_member_id_fkey(id, name), player1b:club_members!club_match_results_player1b_member_id_fkey(id, name), player2b:club_members!club_match_results_player2b_member_id_fkey(id, name)')
      .eq('session_id', SESSION_ID)
  }))

  // 7. getTournaments - 최적화: 필요한 컬럼만 + 병렬 처리 (user와 동시에)
  results.push(await measure('getTournaments', async () => {
    return sb.from('tournaments')
      .select('id, title, status, start_date, end_date, location, poster_url')
      .order('start_date', { ascending: false })
  }))

  // 8. getCommunityPosts - 변경 없음 (content가 FeedCard에서 필요)
  results.push(await measure('getCommunityPosts', async () => {
    return sb.from('posts')
      .select('*, author:profiles!author_id(name, avatar_url)', { count: 'exact' })
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, 19)
  }))

  // 9. getAdminDashboard - 이미 병렬
  results.push(await measure('getAdminDashboard', async () => {
    return Promise.all([
      sb.from('profiles').select('*', { count: 'exact', head: true }),
      sb.from('tournaments').select('*', { count: 'exact', head: true }),
      sb.from('tournaments').select('*', { count: 'exact', head: true }).in('status', ['OPEN', 'IN_PROGRESS']),
      sb.from('tournament_entries').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      sb.from('tournaments').select('id, title, status, start_date, location').order('created_at', { ascending: false }).limit(5),
      sb.from('profiles').select('id, name, email, created_at, role').order('created_at', { ascending: false }).limit(5),
    ])
  }))

  // 10. getMemberGameResults
  const { data: members } = await sb.from('club_members').select('id').eq('club_id', CLUB_ID).eq('status', 'ACTIVE').limit(1)
  const memberId = members?.[0]?.id
  if (memberId) {
    results.push(await measure('getMemberGameResults', async () => {
      return Promise.all([
        sb.from('club_match_results')
          .select('*, club_sessions!inner(id, title, session_date, club_id), player1:club_members!club_match_results_player1_member_id_fkey(id, name), player2:club_members!club_match_results_player2_member_id_fkey(id, name)')
          .eq('club_sessions.club_id', CLUB_ID)
          .eq('player1_member_id', memberId)
          .eq('status', 'COMPLETED'),
        sb.from('club_match_results')
          .select('*, club_sessions!inner(id, title, session_date, club_id), player1:club_members!club_match_results_player1_member_id_fkey(id, name), player2:club_members!club_match_results_player2_member_id_fkey(id, name)')
          .eq('club_sessions.club_id', CLUB_ID)
          .eq('player2_member_id', memberId)
          .eq('status', 'COMPLETED'),
      ])
    }))
  }

  console.log('\n=== 결과 요약 (느린 순) ===')
  results.sort((a, b) => b.elapsed - a.elapsed).forEach(r => console.log(`  ${r.elapsed}ms - ${r.label}`))
  console.log('\nJSON:', JSON.stringify(results))
}

main().catch(console.error)
