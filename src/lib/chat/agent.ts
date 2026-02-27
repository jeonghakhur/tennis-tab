import { GoogleGenAI, Type, type Content, type FunctionDeclaration } from '@google/genai'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAwards } from '@/lib/awards/actions'
import { handleApplyTournament } from './handlers/applyTournament'
import { handleCancelEntry } from './cancelFlow/handler'
import type { ChatMessage } from './types'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY

/** 최대 tool 호출 라운드 (무한루프 방지) */
const MAX_TOOL_ROUNDS = 5

/** 히스토리 최대 턴 수 */
const MAX_HISTORY_TURNS = 10

type Link = { label: string; href: string }

type ToolResult = {
  content: string
  links?: Link[]
  flow_active?: boolean
}

export class GeminiQuotaError extends Error {
  constructor() {
    super('Gemini API 할당량이 초과되었습니다.')
    this.name = 'GeminiQuotaError'
  }
}

export type AgentResult = {
  message: string
  links?: Link[]
  flow_active?: boolean
}

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function escapeLike(v: string) {
  return v.replace(/%/g, '\\%').replace(/_/g, '\\_')
}

const STATUS_LABEL: Record<string, string> = {
  UPCOMING: '접수 예정',
  OPEN: '모집중',
  CLOSED: '마감',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
}

const ENTRY_STATUS_LABEL: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
  CONFIRMED: '확정',
  WAITLISTED: '대기자',
  CANCELLED: '취소',
}

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: '미납',
  PENDING: '미납',
  COMPLETED: '완납',
  FAILED: '실패',
  CANCELLED: '취소',
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const

function buildSystemPrompt() {
  const now = new Date()
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  const weekday = WEEKDAY[now.getDay()]

  return `당신은 테니스 대회 플랫폼 "Tennis Tab"의 AI 어시스턴트입니다.
사용자의 질문을 이해하고 적절한 도구를 호출하여 정보를 조회한 뒤, 자연스럽고 간결한 한국어로 답변합니다.

오늘 날짜: ${date} (${weekday}요일)

[응답 원칙]
- 질문에 꼭 필요한 정보만 포함 (과도한 상세 정보 지양)
- "목록" 또는 지역/날짜 검색 → 대회명과 상태 위주로 간결하게
- "일정"을 묻는 경우 → 날짜와 장소 위주
- "상세/자세히/요강" 요청 → 참가비, 부서, 기타 정보 포함
- 정보는 반드시 도구를 통해 조회 (임의로 데이터를 만들지 말 것)
- 날짜 표현은 오늘(${date}) 기준으로 변환하여 date_start/date_end 설정:
  - 이번 주 → 이번 주 월~일
  - 다음 달 → 다음 달 1일~말일
  - 봄 → 3~5월 (date_start: YYYY-03-01, date_end: YYYY-05-31)
  - 여름 → 6~8월 (date_start: YYYY-06-01, date_end: YYYY-08-31)
  - 가을 → 9~11월, 겨울 → 12~2월
  - 상반기 → 1~6월, 하반기 → 7~12월
- 참가비 관련: max_fee 파라미터 사용 (무료=0, 5만원 이하=50000 등)

[도구 호출 규칙 - 반드시 준수]
- 도구 이름(search_tournaments, initiate_apply_flow 등)을 응답 텍스트에 절대 노출하지 말 것
- 응답은 반드시 한국어만 사용. 다른 나라 언어(러시아어, 일본어, 중국어 등) 절대 사용 금지
- "대회 있어?", "대회 있냐", "대회 알려줘" 처럼 조건 없는 문의 → 즉시 search_tournaments 호출 (파라미터 없이 전체 조회, 되묻지 말 것)
- "신청 가능한 대회", "모집 중인 대회", "지금 신청 가능", "접수 중인", "지금 모집" → 즉시 search_tournaments(status:"OPEN") 호출 (되묻지 말 것)
- "접수 예정 대회", "곧 열리는 대회", "대기중인 대회", "곧 신청 가능한" → 즉시 search_tournaments(status:"UPCOMING") 호출
- "진행 중인 대회", "현재 진행 중" → 즉시 search_tournaments(status:"IN_PROGRESS") 호출
- "끝난 대회", "완료된 대회" → 즉시 search_tournaments(status:"COMPLETED") 호출
- "신청하고 싶어", "신청할게", "대회 신청", "신청해줘", "신청하려고" 등 신청 의사 표현 → 반드시 즉시 initiate_apply_flow 도구 호출. "신청을 시작합니다" 같은 텍스트 응답 절대 금지
- "취소하고 싶어", "신청 취소", "취소할게", "취소", "참가 취소", "등록 취소" → 즉시 initiate_cancel_flow 호출 (되묻지 말 것)
- "입상자", "입상 기록", "명예의 전당", "최근 우승자" → 즉시 get_awards 호출 (파라미터 없이 전체 조회)
- "가장 가까운 대회", "다음 대회" → search_tournaments 호출 후 날짜 기준 첫 번째 항목 사용
- "내가 신청한 대회", "내 신청 내역", "내가 참가 신청한" → 즉시 get_my_entries 호출 (파라미터 없이, 되묻지 말 것)
- "내 경기 일정", "다음 경기" → 즉시 get_my_schedule 호출
- "내 전적", "몇 승 몇 패" → 즉시 get_my_results 호출
- 응답에 PENDING, APPROVED, REJECTED, CONFIRMED, WAITLISTED, UNPAID, COMPLETED 등 영어 상태값 절대 노출 금지
- 추가 정보 없이도 호출 가능한 도구는 절대 되묻지 말고 즉시 호출할 것
- 사용자가 행동 의사를 표현하면 해당 도구를 즉시 호출하여 결과를 반환할 것`
}

// ─── Tool 선언 ────────────────────────────────────────────────────────────────

const TOOL_DECLARATIONS = [
  {
    name: 'search_tournaments',
    description: '대회 목록 검색. 파라미터 없이 호출 가능(전체 조회). 지역, 날짜, 상태, 대회명으로 필터링 가능',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tournament_name: { type: Type.STRING, description: '대회명 키워드 (부분 일치). "마포대회"처럼 지역+대회 합성어는 location 파라미터에 지역명만 넣을 것' },
        location: { type: Type.STRING, description: '지역명 (예: 서울, 마포구, 마포). "마포대회"→location:"마포", "강남 대회"→location:"강남"' },
        status: { type: Type.STRING, description: 'UPCOMING(접수예정) | OPEN(모집중) | IN_PROGRESS(진행중) | COMPLETED(완료)' },
        date_start: { type: Type.STRING, description: '시작일 YYYY-MM-DD' },
        date_end: { type: Type.STRING, description: '종료일 YYYY-MM-DD' },
        max_fee: { type: Type.NUMBER, description: '최대 참가비 (무료=0, 3만원 이하=30000). 무료/저렴한 대회 검색 시 사용' },
      },
    },
  },
  {
    name: 'get_tournament_detail',
    description: '특정 대회의 전체 상세 정보 (참가비, 부서, 요강 포함)',
    parameters: {
      type: Type.OBJECT,
      required: ['tournament_name'],
      properties: {
        tournament_name: { type: Type.STRING, description: '조회할 대회명' },
      },
    },
  },
  {
    name: 'get_my_entries',
    description: '로그인 사용자의 참가 신청 내역. 파라미터 없이 호출 시 전체 내역 조회',
    parameters: {
      type: Type.OBJECT,
      properties: {
        entry_status: { type: Type.STRING, description: '신청 상태 필터: PENDING(대기)/APPROVED(승인)/REJECTED(거절)/CONFIRMED(확정)/WAITLISTED(대기자). 사용자가 한글로 요청해도 변환해서 사용. 응답에 영어값 노출 금지' },
        payment_status: { type: Type.STRING, description: '결제 상태 필터: UNPAID(미납)/COMPLETED(완납). 응답에 영어값 노출 금지' },
      },
    },
  },
  {
    name: 'get_bracket',
    description: '대회 대진표 및 경기 현황 조회',
    parameters: {
      type: Type.OBJECT,
      required: ['tournament_name'],
      properties: {
        tournament_name: { type: Type.STRING, description: '대회명' },
      },
    },
  },
  {
    name: 'get_match_results',
    description: '특정 대회의 경기 결과 조회',
    parameters: {
      type: Type.OBJECT,
      required: ['tournament_name'],
      properties: {
        tournament_name: { type: Type.STRING, description: '대회명' },
      },
    },
  },
  {
    name: 'get_my_schedule',
    description: '내 예정 경기 일정 조회 (로그인 필요, 파라미터 없음)',
  },
  {
    name: 'get_my_results',
    description: '내 경기 전적 및 결과 조회 (로그인 필요, 파라미터 없음)',
  },
  {
    name: 'get_awards',
    description: '입상 기록 / 명예의 전당 조회',
    parameters: {
      type: Type.OBJECT,
      properties: {
        player_name: { type: Type.STRING, description: '선수명' },
        year: { type: Type.NUMBER, description: '연도' },
        scope: { type: Type.STRING, description: 'my: 내 기록, all: 전체 기록' },
      },
    },
  },
  {
    name: 'initiate_apply_flow',
    description: '대회 참가 신청 플로우 시작. 사용자가 신청 의사를 표현하면 반드시 이 도구를 호출해야 함. "신청을 시작합니다" 같은 텍스트 응답 절대 금지.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        tournament_name: { type: Type.STRING, description: '신청할 대회명 (없으면 전체 모집중 목록)' },
      },
    },
  },
  {
    name: 'initiate_cancel_flow',
    description: '참가 신청 취소 플로우 시작 (로그인 필요, 파라미터 없음)',
  },
] as unknown as FunctionDeclaration[]

// ─── Tool 구현 ────────────────────────────────────────────────────────────────

async function toolSearchTournaments(args: Record<string, unknown>): Promise<ToolResult> {
  const admin = createAdminClient()
  let query = admin
    .from('tournaments')
    .select('id, title, location, address, start_date, end_date, status, entry_fee, max_participants')
    .order('start_date', { ascending: true })
    .limit(8)

  const status = args.status as string | undefined
  const location = args.location as string | undefined
  const name = args.tournament_name as string | undefined
  const dateStart = args.date_start as string | undefined
  const dateEnd = args.date_end as string | undefined
  const maxFee = args.max_fee as number | undefined

  if (status) query = query.eq('status', status)
  else query = query.in('status', ['OPEN', 'CLOSED', 'IN_PROGRESS'])
  if (location) {
    const esc = escapeLike(location)
    query = query.or(`location.ilike.%${esc}%,address.ilike.%${esc}%`)
  }
  if (name) {
    // title 뿐만 아니라 location, address에서도 검색
    // → "마포대회"를 tournament_name으로 받아도 location/address에서 매칭됨
    const esc = escapeLike(name)
    query = query.or(`title.ilike.%${esc}%,location.ilike.%${esc}%,address.ilike.%${esc}%`)
  }
  if (dateStart) query = query.gte('start_date', dateStart)
  if (dateEnd) query = query.lte('start_date', dateEnd)
  if (maxFee !== undefined) query = query.lte('entry_fee', maxFee)

  const { data } = await query
  if (!data || data.length === 0) return { content: '조건에 맞는 대회가 없습니다.' }

  const rows = data.map((t) => ({
    id: t.id,
    title: t.title,
    status: STATUS_LABEL[t.status] ?? t.status,
    start_date: t.start_date,
    end_date: t.end_date ?? null,
    location: [t.location, t.address].filter(Boolean).join(' ') || null,
    entry_fee: t.entry_fee ?? 0,
    max_participants: t.max_participants ?? null,
  }))

  return {
    content: JSON.stringify(rows),
    links: data.map((t) => ({ label: `${t.title} 상세`, href: `/tournaments/${t.id}` })),
  }
}

async function toolGetTournamentDetail(args: Record<string, unknown>): Promise<ToolResult> {
  const name = args.tournament_name as string
  const admin = createAdminClient()

  const { data } = await admin
    .from('tournaments')
    .select(`
      id, title, location, address, start_date, end_date, status,
      entry_fee, max_participants, host, match_type, format,
      ball_type, eligibility, description, entry_start_date, entry_end_date, opening_ceremony,
      tournament_divisions(name, match_date, match_location, prize_winner, prize_runner_up)
    `)
    .ilike('title', `%${escapeLike(name)}%`)
    .limit(1)

  if (!data || data.length === 0) return { content: `"${name}" 대회를 찾을 수 없습니다.` }

  const t = data[0]
  return {
    content: JSON.stringify({ ...t, status: STATUS_LABEL[t.status] ?? t.status }),
    links: [{ label: `${t.title} 상세`, href: `/tournaments/${t.id}` }],
  }
}

async function toolGetMyEntries(args: Record<string, unknown>, userId: string): Promise<ToolResult> {
  const admin = createAdminClient()
  let query = admin
    .from('tournament_entries')
    .select('status, payment_status, club_name, tournament_divisions(name), tournaments(id, title, start_date, status)')
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })
    .limit(10)

  const entryStatus = args.entry_status as string | undefined
  const paymentStatus = args.payment_status as string | undefined
  if (entryStatus) query = query.eq('status', entryStatus)
  if (paymentStatus === 'UNPAID') query = query.in('payment_status', ['UNPAID', 'PENDING'])
  else if (paymentStatus) query = query.eq('payment_status', paymentStatus)

  const { data } = await query
  if (!data || data.length === 0) return { content: '참가 신청 내역이 없습니다.' }

  const rows = data.map((e) => {
    const t = e.tournaments as unknown as { id: string; title: string; start_date: string; status: string }
    const div = e.tournament_divisions as unknown as { name: string }
    return {
      tournament: t.title,
      tournament_id: t.id,
      start_date: t.start_date,
      tournament_status: STATUS_LABEL[t.status] ?? t.status,
      division: div?.name ?? null,
      entry_status: ENTRY_STATUS_LABEL[e.status] ?? e.status,
      payment_status: PAYMENT_LABEL[e.payment_status] ?? e.payment_status,
      club: e.club_name ?? null,
    }
  })

  return {
    content: JSON.stringify(rows),
    links: [{ label: '내 신청 관리', href: '/my/entries' }],
  }
}

async function toolGetBracket(args: Record<string, unknown>): Promise<ToolResult> {
  const name = args.tournament_name as string
  const admin = createAdminClient()

  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, title, status')
    .ilike('title', `%${escapeLike(name)}%`)
    .limit(1)

  if (!tournaments || tournaments.length === 0) return { content: `"${name}" 대회를 찾을 수 없습니다.` }

  const tournament = tournaments[0]
  const { data: divisions } = await admin
    .from('tournament_divisions')
    .select('id, name')
    .eq('tournament_id', tournament.id)

  if (!divisions || divisions.length === 0) {
    return {
      content: `"${tournament.title}" 대진표가 아직 생성되지 않았습니다.`,
      links: [{ label: `${tournament.title} 상세`, href: `/tournaments/${tournament.id}` }],
    }
  }

  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id, division_id')
    .in('division_id', divisions.map((d) => d.id))

  if (!configs || configs.length === 0) {
    return {
      content: `"${tournament.title}" 대진표가 아직 생성되지 않았습니다.`,
      links: [{ label: `${tournament.title} 상세`, href: `/tournaments/${tournament.id}` }],
    }
  }

  const divNameMap = new Map(divisions.map((d) => [d.id, d.name]))
  const summaries: Record<string, unknown>[] = []

  for (const config of configs) {
    const { data: matches } = await admin
      .from('bracket_matches')
      .select('round_number, status')
      .eq('bracket_config_id', config.id)
      .is('group_id', null)

    if (!matches || matches.length === 0) continue
    const total = matches.length
    const completed = matches.filter((m) => m.status === 'COMPLETED').length
    const maxRound = Math.max(...matches.map((m) => m.round_number))
    summaries.push({
      division: divNameMap.get(config.division_id) ?? '본선',
      total_matches: total,
      completed_matches: completed,
      max_round: maxRound,
    })
  }

  return {
    content: JSON.stringify({
      tournament: tournament.title,
      status: STATUS_LABEL[tournament.status] ?? tournament.status,
      bracket: summaries,
    }),
    links: [{ label: `${tournament.title} 대진표`, href: `/tournaments/${tournament.id}/bracket` }],
  }
}

async function toolGetMatchResults(args: Record<string, unknown>): Promise<ToolResult> {
  const name = args.tournament_name as string
  const admin = createAdminClient()

  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, title')
    .ilike('title', `%${escapeLike(name)}%`)
    .limit(1)

  if (!tournaments || tournaments.length === 0) return { content: `"${name}" 대회를 찾을 수 없습니다.` }

  const tournament = tournaments[0]
  const { data: divisions } = await admin.from('tournament_divisions').select('id').eq('tournament_id', tournament.id)
  if (!divisions || divisions.length === 0) return { content: `"${tournament.title}" 경기 기록이 없습니다.` }

  const { data: configs } = await admin
    .from('bracket_configs')
    .select('id')
    .in('division_id', divisions.map((d) => d.id))
  if (!configs || configs.length === 0) return { content: `"${tournament.title}" 경기 기록이 없습니다.` }

  const { data: matches } = await admin
    .from('bracket_matches')
    .select('round_number, match_number, team1_score, team2_score, entry1:team1_entry_id(player_name), entry2:team2_entry_id(player_name), winner:winner_entry_id(player_name)')
    .in('bracket_config_id', configs.map((c) => c.id))
    .eq('status', 'COMPLETED')
    .order('updated_at', { ascending: false })
    .limit(10)

  if (!matches || matches.length === 0) {
    return {
      content: `"${tournament.title}" 완료된 경기가 없습니다.`,
      links: [{ label: `${tournament.title} 대진표`, href: `/tournaments/${tournament.id}/bracket` }],
    }
  }

  const rows = matches.map((m) => ({
    round: m.round_number,
    match: m.match_number,
    player1: (m.entry1 as unknown as { player_name: string } | null)?.player_name ?? '?',
    player2: (m.entry2 as unknown as { player_name: string } | null)?.player_name ?? '?',
    score: `${m.team1_score ?? 0}:${m.team2_score ?? 0}`,
    winner: (m.winner as unknown as { player_name: string } | null)?.player_name ?? '?',
  }))

  return {
    content: JSON.stringify({ tournament: tournament.title, results: rows }),
    links: [{ label: `${tournament.title} 전체 결과`, href: `/tournaments/${tournament.id}/bracket` }],
  }
}

async function toolGetMySchedule(userId: string): Promise<ToolResult> {
  const admin = createAdminClient()
  const { data: entries } = await admin
    .from('tournament_entries')
    .select('id, tournaments(id, title)')
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')

  if (!entries || entries.length === 0) return { content: '참가 중인 대회가 없습니다.' }

  const entryIds = entries.map((e) => e.id)
  const { data: matches } = await admin
    .from('bracket_matches')
    .select('round_number, match_number, status, court_number, entry1:team1_entry_id(id, player_name), entry2:team2_entry_id(id, player_name)')
    .or(`team1_entry_id.in.(${entryIds.join(',')}),team2_entry_id.in.(${entryIds.join(',')})`)
    .in('status', ['SCHEDULED', 'IN_PROGRESS'])
    .order('round_number')
    .limit(10)

  if (!matches || matches.length === 0) {
    return { content: '예정된 경기가 없습니다.', links: [{ label: '내 신청 확인', href: '/my/entries' }] }
  }

  const tournamentMap = new Map(
    entries.map((e) => {
      const t = e.tournaments as unknown as { id: string; title: string }
      return [e.id, t.title]
    }),
  )

  const rows = matches.map((m) => {
    const e1 = m.entry1 as unknown as { id: string; player_name: string } | null
    const e2 = m.entry2 as unknown as { id: string; player_name: string } | null
    const myId = e1 && entryIds.includes(e1.id) ? e1.id : e2?.id
    return {
      tournament: myId ? (tournamentMap.get(myId) ?? '') : '',
      round: m.round_number,
      match: m.match_number,
      opponent: entryIds.includes(e1?.id ?? '') ? (e2?.player_name ?? 'TBD') : (e1?.player_name ?? 'TBD'),
      court: m.court_number ?? null,
      in_progress: m.status === 'IN_PROGRESS',
    }
  })

  return {
    content: JSON.stringify(rows),
    links: [{ label: '내 신청 확인', href: '/my/entries' }],
  }
}

async function toolGetMyResults(userId: string): Promise<ToolResult> {
  const admin = createAdminClient()
  const { data: entries } = await admin
    .from('tournament_entries')
    .select('id')
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')

  if (!entries || entries.length === 0) return { content: '참가한 대회가 없습니다.' }

  const entryIds = entries.map((e) => e.id)
  const { data: matches } = await admin
    .from('bracket_matches')
    .select('round_number, team1_score, team2_score, entry1:team1_entry_id(id, player_name), entry2:team2_entry_id(id, player_name), winner:winner_entry_id(id, player_name)')
    .or(`team1_entry_id.in.(${entryIds.join(',')}),team2_entry_id.in.(${entryIds.join(',')})`)
    .eq('status', 'COMPLETED')
    .order('completed_at', { ascending: false })
    .limit(10)

  if (!matches || matches.length === 0) {
    return { content: '완료된 경기가 없습니다.', links: [{ label: '내 신청 확인', href: '/my/entries' }] }
  }

  let wins = 0
  let losses = 0
  const rows = matches.map((m) => {
    const e1 = m.entry1 as unknown as { id: string; player_name: string } | null
    const e2 = m.entry2 as unknown as { id: string; player_name: string } | null
    const w = m.winner as unknown as { id: string } | null
    const isWin = !!w && entryIds.includes(w.id)
    if (isWin) wins++
    else losses++
    return {
      round: m.round_number,
      opponent: entryIds.includes(e1?.id ?? '') ? (e2?.player_name ?? '?') : (e1?.player_name ?? '?'),
      score: `${m.team1_score ?? 0}:${m.team2_score ?? 0}`,
      result: isWin ? '승' : '패',
    }
  })

  return {
    content: JSON.stringify({ wins, losses, matches: rows }),
    links: [{ label: '내 신청 확인', href: '/my/entries' }],
  }
}

async function toolGetAwards(args: Record<string, unknown>, userId?: string): Promise<ToolResult> {
  try {
    const awards = await getAwards({
      playerName: args.player_name as string | undefined,
      year: args.year as number | undefined,
      userId: args.scope === 'my' ? userId : undefined,
    })

    if (awards.length === 0) {
      return { content: '입상 기록이 없습니다.', links: [{ label: '명예의 전당', href: '/awards' }] }
    }

    return {
      content: JSON.stringify(awards.slice(0, 15)),
      links: [{ label: '명예의 전당 전체 보기', href: '/awards' }],
    }
  } catch {
    return { content: '입상 기록 조회 중 오류가 발생했습니다.' }
  }
}

async function toolInitiateApplyFlow(args: Record<string, unknown>, userId?: string): Promise<ToolResult> {
  const result = await handleApplyTournament(
    { tournament_name: args.tournament_name as string | undefined },
    userId,
  )
  return { content: result.message, links: result.links, flow_active: result.flow_active }
}

async function toolInitiateCancelFlow(userId?: string): Promise<ToolResult> {
  const result = await handleCancelEntry({}, userId)
  return { content: result.message, links: result.links, flow_active: result.flow_active }
}

// ─── Tool dispatcher ──────────────────────────────────────────────────────────

async function executeTool(name: string, args: Record<string, unknown>, userId?: string): Promise<ToolResult> {
  switch (name) {
    case 'search_tournaments':  return toolSearchTournaments(args)
    case 'get_tournament_detail': return toolGetTournamentDetail(args)
    case 'get_my_entries':      return userId ? toolGetMyEntries(args, userId) : { content: '내 신청 내역을 보려면 로그인이 필요합니다.' }
    case 'get_bracket':         return toolGetBracket(args)
    case 'get_match_results':   return toolGetMatchResults(args)
    case 'get_my_schedule':     return userId ? toolGetMySchedule(userId) : { content: '내 경기 일정을 보려면 로그인이 필요합니다.' }
    case 'get_my_results':      return userId ? toolGetMyResults(userId) : { content: '내 경기 결과를 보려면 로그인이 필요합니다.' }
    case 'get_awards':          return toolGetAwards(args, userId)
    case 'initiate_apply_flow': return toolInitiateApplyFlow(args, userId)
    case 'initiate_cancel_flow': return toolInitiateCancelFlow(userId)
    default:                    return { content: `알 수 없는 도구: ${name}` }
  }
}

// ─── Main agent loop ──────────────────────────────────────────────────────────

export async function runAgent(
  message: string,
  history: ChatMessage[],
  userId?: string,
): Promise<AgentResult> {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY 환경변수가 설정되지 않았습니다.')

  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY })
  const collectedLinks: Link[] = []
  let flowActive: boolean | undefined

  let contents: Content[] = [
    ...history.slice(-(MAX_HISTORY_TURNS * 2)).map((msg) => ({
      role: (msg.role === 'user' ? 'user' : 'model') as 'user' | 'model',
      parts: [{ text: msg.content }],
    })),
    { role: 'user' as const, parts: [{ text: message }] },
  ]

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response
    try {
      response = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents,
        config: {
          systemInstruction: buildSystemPrompt(),
          tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
          temperature: 0.4,
        },
      })
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error)
      if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429') || msg.includes('quota')) {
        throw new GeminiQuotaError()
      }
      throw error
    }

    const candidate = response.candidates?.[0]
    const parts = candidate?.content?.parts ?? []

    // functionCall part 탐색
    const fnCallPart = parts.find((p) => p.functionCall?.name)

    // function call 없으면 최종 텍스트 응답
    if (!fnCallPart?.functionCall) {
      // response.text가 없을 때 parts에서 직접 텍스트 추출 (SDK 버전 차이 대응)
      const responseText =
        response.text ||
        parts.find((p) => p.text)?.text ||
        null

      return {
        message: responseText ?? '죄송합니다, 요청을 처리하지 못했습니다. 다시 말씀해 주세요.',
        links: collectedLinks.length > 0 ? collectedLinks : undefined,
        flow_active: flowActive,
      }
    }

    const fnCall = fnCallPart.functionCall
    const toolName = fnCall.name ?? ''
    const toolArgs = (fnCall.args ?? {}) as Record<string, unknown>

    // Tool 실행 (내부 오류는 content 메시지로 반환, agent 전체를 죽이지 않음)
    let toolResult: ToolResult
    try {
      toolResult = await executeTool(toolName, toolArgs, userId)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[agent] tool "${toolName}" 실행 오류:`, errMsg)
      toolResult = { content: `도구 실행 중 오류가 발생했습니다: ${errMsg}` }
    }

    // 링크 수집 (중복 제거)
    for (const link of toolResult.links ?? []) {
      if (!collectedLinks.find((l) => l.href === link.href)) collectedLinks.push(link)
    }

    // 플로우 시작된 경우 (apply/cancel): 바로 반환 (이후 메시지는 entryFlow/cancelFlow에서 처리)
    if (toolResult.flow_active !== undefined) {
      return {
        message: toolResult.content,
        links: collectedLinks.length > 0 ? collectedLinks : undefined,
        flow_active: toolResult.flow_active,
      }
    }

    // Gemini에게 tool 결과 전달
    // - candidate.content.parts를 그대로 사용해 functionCall id 등 원본 필드 보존
    contents = [
      ...contents,
      { role: 'model' as const, parts: candidate?.content?.parts ?? [{ functionCall: fnCall }] },
      {
        role: 'user' as const,
        parts: [{
          functionResponse: {
            id: fnCall.id,      // functionCall id 매칭 (Gemini 멀티턴 필수)
            name: toolName,
            response: { content: toolResult.content },
          },
        }],
      },
    ]
  }

  return { message: '요청 처리 중 문제가 발생했습니다. 다시 시도해주세요.' }
}
