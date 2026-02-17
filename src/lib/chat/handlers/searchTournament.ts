import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'
import { formatDate } from '../entryFlow/steps'

/** ILIKE 쿼리용 와일드카드 이스케이프 */
function escapeLike(value: string): string {
  return value.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

/** 상태 한글 → DB enum 매핑 */
const STATUS_MAP: Record<string, string> = {
  '모집중': 'OPEN',
  '진행중': 'IN_PROGRESS',
  '완료': 'COMPLETED',
}

/** 상태 DB enum → 한글 표시 */
const STATUS_LABEL: Record<string, string> = {
  OPEN: '모집중',
  CLOSED: '마감',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
}

/** 신청 상태 DB enum → 한글 */
const ENTRY_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
  CONFIRMED: '확정',
  WAITLISTED: '대기자',
  CANCELLED: '취소',
}

/** 결제 상태 DB enum → 한글 */
const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: '미납',
  PENDING: '미납',
  COMPLETED: '완납',
  FAILED: '실패',
  CANCELLED: '취소',
}

/** 필터 조건 포함 헤더 문자열 생성 */
function buildMyEntriesHeader(count: number, entities?: ChatEntities): string {
  const filters: string[] = []
  if (entities?.entry_status) filters.push(`상태: ${entities.entry_status}`)
  if (entities?.payment_status) filters.push(`결제: ${entities.payment_status}`)

  const filterStr = filters.length > 0 ? ` (${filters.join(', ')})` : ''
  return `내 참가 신청 내역${filterStr} ${count}건:`
}

/** SEARCH_TOURNAMENT 핸들러 — 대회 검색 (scope 분기) */
export async function handleSearchTournament(
  entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult> {
  // scope: "my" → 내 신청 내역 조회
  if (entities.scope === 'my') {
    return handleMyEntries(userId, entities)
  }

  return handleSearchAll(entities)
}

// ─── scope: "my" — 내 신청 내역 ─────────────────────

/** 한글 → DB enum 역매핑 (신청 상태) */
const ENTRY_STATUS_MAP: Record<string, string> = {
  '대기': 'PENDING',
  '승인': 'APPROVED',
  '거절': 'REJECTED',
  '확정': 'CONFIRMED',
  '대기자': 'WAITLISTED',
}

/** 한글 → DB enum 역매핑 (결제 상태) */
const PAYMENT_STATUS_MAP: Record<string, string> = {
  '미납': 'UNPAID',
  '완납': 'COMPLETED',
}

async function handleMyEntries(userId?: string, entities?: ChatEntities): Promise<HandlerResult> {
  if (!userId) {
    return {
      success: false,
      message: '내 신청 내역을 보려면 로그인이 필요합니다.',
      links: [{ label: '로그인', href: '/auth/login' }],
    }
  }

  const admin = createAdminClient()
  let query = admin
    .from('tournament_entries')
    .select(`
      id, status, payment_status, player_name, club_name, team_order, created_at,
      tournament_divisions(name),
      tournaments(id, title, start_date, status)
    `)
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })
    .limit(5)

  // 신청 상태 필터
  if (entities?.entry_status) {
    const mapped = ENTRY_STATUS_MAP[entities.entry_status]
    if (mapped) query = query.eq('status', mapped)
  }

  // 결제 상태 필터
  if (entities?.payment_status) {
    const mapped = PAYMENT_STATUS_MAP[entities.payment_status]
    // "미납"은 UNPAID와 PENDING 모두 포함
    if (entities.payment_status === '미납') {
      query = query.in('payment_status', ['UNPAID', 'PENDING'])
    } else if (mapped) {
      query = query.eq('payment_status', mapped)
    }
  }

  const { data: entries, error } = await query

  if (error) {
    return { success: false, message: '신청 내역 조회 중 오류가 발생했습니다.' }
  }

  if (!entries || entries.length === 0) {
    // 필터 조건이 있을 때와 없을 때 메시지 분기
    const hasFilter = entities?.entry_status || entities?.payment_status
    const message = hasFilter
      ? '조건에 맞는 신청 내역이 없습니다.'
      : '참가 신청한 대회가 없습니다.\n\n"신청 가능한 대회" 를 입력하면 현재 접수 중인 대회를 확인할 수 있어요.'
    return { success: true, message }
  }

  const lines = entries.map((e, i) => {
    const t = e.tournaments as unknown as { id: string; title: string; start_date: string; status: string }
    const div = e.tournament_divisions as unknown as { name: string }
    const entryStatus = ENTRY_STATUS_LABEL[e.status] ?? e.status
    const paymentStatus = PAYMENT_LABEL[e.payment_status] ?? e.payment_status
    const tournamentStatus = STATUS_LABEL[t.status] ?? t.status

    let line = `${i + 1}. ${t.title} (${formatDate(t.start_date)})\n   부서: ${div.name} | 상태: ${entryStatus} | 결제: ${paymentStatus} | 대회: ${tournamentStatus}`
    if (e.club_name) {
      line += `\n   클럽: ${e.club_name}${e.team_order ? ` (${e.team_order}팀)` : ''}`
    }
    return line
  })

  const links = entries.map((e) => {
    const t = e.tournaments as unknown as { id: string; title: string }
    return { label: `${t.title} 상세`, href: `/tournaments/${t.id}` }
  })

  return {
    success: true,
    message: buildMyEntriesHeader(entries.length, entities) + `\n\n${lines.join('\n\n')}`,
    links: [{ label: '내 신청 관리', href: '/my/entries' }, ...links],
  }
}

// ─── scope: "all" — 전체 대회 검색 ──────────────────

/** 경기 유형 한글 표시 */
const MATCH_TYPE_LABEL: Record<string, string> = {
  INDIVIDUAL_SINGLES: '개인 단식',
  INDIVIDUAL_DOUBLES: '개인 복식',
  TEAM_SINGLES: '단체 단식',
  TEAM_DOUBLES: '단체 복식',
}

/** 대회 형식 한글 표시 */
const FORMAT_LABEL: Record<string, string> = {
  SINGLE_ELIMINATION: '단판 토너먼트',
  DOUBLE_ELIMINATION: '더블 엘리미네이션',
  LEAGUE: '리그전',
  MIXED: '혼합',
}

/** HTML 태그 제거 + 공백 정리 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** description 요약 (최대 maxLen자) */
function summarizeDescription(html: string, maxLen: number): string {
  const text = stripHtml(html)
  if (text.length <= maxLen) return text
  return text.slice(0, maxLen) + '...'
}

async function handleSearchAll(entities: ChatEntities): Promise<HandlerResult> {
  const admin = createAdminClient()
  let query = admin
    .from('tournaments')
    .select(`
      id, title, location, address, start_date, end_date, status,
      entry_fee, max_participants, host, organizer_name,
      match_type, format, ball_type, eligibility, description,
      entry_start_date, entry_end_date, opening_ceremony,
      tournament_divisions(name, match_date, match_location, prize_winner, prize_runner_up, notes)
    `)
    .order('start_date', { ascending: true })
    .limit(5)

  // 상태 필터
  if (entities.status) {
    const mapped = STATUS_MAP[entities.status]
    if (mapped) query = query.eq('status', mapped)
  } else {
    query = query.in('status', ['OPEN', 'CLOSED', 'IN_PROGRESS'])
  }

  // 지역 필터
  if (entities.location) {
    const escaped = escapeLike(entities.location)
    query = query.or(
      `location.ilike.%${escaped}%,address.ilike.%${escaped}%`,
    )
  }

  // 날짜 범위 필터
  if (entities.date_range?.start) {
    query = query.gte('start_date', entities.date_range.start)
  }
  if (entities.date_range?.end) {
    query = query.lte('start_date', entities.date_range.end)
  }

  // 대회명 검색
  if (entities.tournament_name) {
    const escaped = escapeLike(entities.tournament_name)
    query = query.ilike('title', `%${escaped}%`)
  }

  const { data: tournaments, error } = await query

  if (error) {
    return { success: false, message: '대회 검색 중 오류가 발생했습니다.' }
  }

  if (!tournaments || tournaments.length === 0) {
    return {
      success: true,
      message: '조건에 맞는 대회를 찾지 못했습니다. 다른 조건으로 검색해보세요!',
    }
  }

  const lines = tournaments.map((t, i) => {
    const parts: string[] = []
    const status = STATUS_LABEL[t.status] ?? t.status
    const location = [t.location, t.address].filter(Boolean).join(' ')
    const dateStr = t.end_date && t.end_date !== t.start_date
      ? `${formatDate(t.start_date)} ~ ${formatDate(t.end_date)}`
      : formatDate(t.start_date)

    // 기본 정보
    parts.push(`${i + 1}. ${t.title} (${status})`)
    parts.push(`   일시: ${dateStr}`)
    parts.push(`   장소: ${location || '미정'}`)

    // 경기 유형·형식
    const typeInfo: string[] = []
    if (t.match_type) typeInfo.push(MATCH_TYPE_LABEL[t.match_type] ?? t.match_type)
    if (t.format) typeInfo.push(FORMAT_LABEL[t.format] ?? t.format)
    if (typeInfo.length > 0) parts.push(`   종별: ${typeInfo.join(' / ')}`)

    // 참가비·인원
    const fee = t.entry_fee ? `${Number(t.entry_fee).toLocaleString()}원` : '무료'
    parts.push(`   참가비: ${fee} | 최대 ${t.max_participants ?? '제한 없음'}명`)

    // 접수 기간
    if (t.entry_start_date || t.entry_end_date) {
      const start = t.entry_start_date ? formatDate(t.entry_start_date) : ''
      const end = t.entry_end_date ? formatDate(t.entry_end_date) : ''
      if (start && end) {
        parts.push(`   접수 기간: ${start} ~ ${end}`)
      } else if (end) {
        parts.push(`   접수 마감: ${end}`)
      }
    }

    // 주최·사용구·자격
    if (t.host) parts.push(`   주최: ${t.host}`)
    if (t.ball_type) parts.push(`   사용구: ${t.ball_type}`)
    if (t.eligibility) parts.push(`   참가 자격: ${t.eligibility}`)

    // 개회식
    if (t.opening_ceremony) {
      parts.push(`   개회식: ${formatDate(t.opening_ceremony)}`)
    }

    // 부서 정보
    const divisions = t.tournament_divisions as unknown as Array<{
      name: string
      match_date: string | null
      match_location: string | null
      prize_winner: string | null
      prize_runner_up: string | null
      notes: string | null
    }>
    if (divisions && divisions.length > 0) {
      const divLines = divisions.map((d) => {
        let line = `     - ${d.name}`
        if (d.match_date) line += ` (${formatDate(d.match_date)})`
        if (d.match_location) line += ` @ ${d.match_location}`
        const prizes: string[] = []
        if (d.prize_winner) prizes.push(`우승: ${d.prize_winner}`)
        if (d.prize_runner_up) prizes.push(`준우승: ${d.prize_runner_up}`)
        if (prizes.length > 0) line += ` [${prizes.join(', ')}]`
        return line
      })
      parts.push(`   참가 부서:`)
      parts.push(...divLines)
    }

    // 대회 설명 요약 (200자)
    if (t.description) {
      const summary = summarizeDescription(t.description, 200)
      if (summary) parts.push(`   요강: ${summary}`)
    }

    return parts.join('\n')
  })

  const message = `검색 결과 ${tournaments.length}개의 대회를 찾았습니다:\n\n${lines.join('\n\n')}`

  const links = tournaments.map((t) => ({
    label: `${t.title} 상세`,
    href: `/tournaments/${t.id}`,
  }))

  return { success: true, message, data: tournaments, links }
}
