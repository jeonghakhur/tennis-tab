import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

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

/** SEARCH_TOURNAMENT 핸들러 — 대회 검색 */
export async function handleSearchTournament(
  entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
  const admin = createAdminClient()
  let query = admin
    .from('tournaments')
    .select('id, title, location, address, start_date, end_date, status, entry_fee, max_participants')
    .in('status', ['OPEN', 'CLOSED', 'IN_PROGRESS'])
    .order('start_date', { ascending: true })
    .limit(5)

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

  // 상태 필터 (사용자가 명시적으로 요청한 경우)
  if (entities.status) {
    const mapped = STATUS_MAP[entities.status]
    if (mapped) query = query.eq('status', mapped)
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

  // 응답 포매팅
  const lines = tournaments.map((t, i) => {
    const status = STATUS_LABEL[t.status] ?? t.status
    const fee = t.entry_fee ? `참가비: ${Number(t.entry_fee).toLocaleString()}원` : '참가비: 무료'
    const location = [t.location, t.address].filter(Boolean).join(' ')
    return `${i + 1}. ${t.title} — ${t.start_date} / ${location} (${status})\n   ${fee} | 최대 ${t.max_participants ?? '제한 없음'}명`
  })

  const message = `검색 결과 ${tournaments.length}개의 대회를 찾았습니다:\n\n${lines.join('\n\n')}\n\n대회 상세 정보는 아래 링크에서 확인하세요.`

  const links = tournaments.map((t) => ({
    label: `${t.title} 상세`,
    href: `/tournaments/${t.id}`,
  }))

  return { success: true, message, data: tournaments, links }
}
