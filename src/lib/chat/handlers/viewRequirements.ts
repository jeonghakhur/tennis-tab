import { createAdminClient } from '@/lib/supabase/admin'
import type { ChatEntities, HandlerResult } from '../types'

/** 상태 표시 */
const STATUS_LABEL: Record<string, string> = {
  OPEN: '모집중',
  CLOSED: '마감',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  DRAFT: '준비중',
  CANCELLED: '취소',
}

/** VIEW_REQUIREMENTS 핸들러 — 참가 조건/대회 상세 조회 */
export async function handleViewRequirements(
  entities: ChatEntities,
  _userId?: string,
): Promise<HandlerResult> {
  if (!entities.tournament_name) {
    return {
      success: true,
      message: '어떤 대회의 참가 정보를 알고 싶으신가요? 대회명을 알려주세요.',
    }
  }

  const admin = createAdminClient()

  // 대회명으로 검색
  const { data: tournaments } = await admin
    .from('tournaments')
    .select('id, title, location, address, start_date, end_date, status, entry_fee, max_participants, format, match_type, description')
    .ilike('title', `%${entities.tournament_name.replace(/%/g, '\\%').replace(/_/g, '\\_')}%`)
    .neq('visibility', 'HIDDEN')
    .limit(1)

  if (!tournaments || tournaments.length === 0) {
    return {
      success: true,
      message: `"${entities.tournament_name}" 대회를 찾을 수 없습니다.`,
    }
  }

  const t = tournaments[0]
  const status = STATUS_LABEL[t.status] ?? t.status
  const fee = t.entry_fee ? `${Number(t.entry_fee).toLocaleString()}원` : '무료'
  const locationStr = [t.location, t.address].filter(Boolean).join(' ')
  const dateStr = t.end_date && t.end_date !== t.start_date
    ? `${t.start_date} ~ ${t.end_date}`
    : t.start_date

  const lines = [
    `"${t.title}" 참가 정보:`,
    '',
    `- 일시: ${dateStr}`,
    `- 장소: ${locationStr || '미정'}`,
    `- 참가비: ${fee}`,
    `- 최대 인원: ${t.max_participants ? `${t.max_participants}명` : '제한 없음'}`,
    t.format ? `- 대회 형식: ${t.format}` : null,
    t.match_type ? `- 경기 유형: ${t.match_type}` : null,
    `- 현재 상태: ${status}`,
  ].filter(Boolean)

  if (t.description) {
    lines.push('', `📝 ${t.description}`)
  }

  return {
    success: true,
    message: lines.join('\n'),
    data: t,
    links: [{ label: `${t.title} 상세`, href: `/tournaments/${t.id}` }],
  }
}
