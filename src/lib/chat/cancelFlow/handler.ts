import { createAdminClient } from '@/lib/supabase/admin'
import { deleteEntry } from '@/lib/entries/actions'
import type { ChatEntities, HandlerResult } from '../types'
import type { CancelFlowSession, CancelFlowResult, CancelableEntry } from './types'

// ─── 세션 저장소 ─────────────────────────────────────

const sessionMap = new Map<string, CancelFlowSession>()

/** 세션 TTL: 10분 */
const SESSION_TTL_MS = 10 * 60 * 1000

let lastCleanup = Date.now()
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

function cleanupExpired(): void {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return
  lastCleanup = now

  for (const [key, session] of sessionMap) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionMap.delete(key)
    }
  }
}

/** 세션 조회 (만료 시 null + 삭제) */
export function getCancelSession(userId: string): CancelFlowSession | null {
  cleanupExpired()

  const session = sessionMap.get(userId)
  if (!session) return null

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessionMap.delete(userId)
    return null
  }

  return session
}

function setSession(userId: string, session: CancelFlowSession): void {
  session.updatedAt = Date.now()
  sessionMap.set(userId, session)
}

function deleteSession(userId: string): void {
  sessionMap.delete(userId)
}

// ─── 상태 레이블 매핑 ────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기',
  APPROVED: '승인',
  REJECTED: '거절',
  CONFIRMED: '확정',
  WAITLISTED: '대기자',
  CANCELLED: '취소',
}

const PAYMENT_LABELS: Record<string, string> = {
  UNPAID: '미납',
  PAID: '완납',
}

// ─── 진입점 (CANCEL_ENTRY 핸들러) ────────────────────

/**
 * CANCEL_ENTRY 핸들러 — 참가 취소 플로우 진입점
 * Gemini intent 분류 후 호출됨
 */
export async function handleCancelEntry(
  _entities: ChatEntities,
  userId?: string,
): Promise<HandlerResult & { flow_active?: boolean }> {
  // 비로그인
  if (!userId) {
    return {
      success: true,
      message: '참가 취소를 하려면 로그인이 필요합니다.',
      links: [{ label: '로그인', href: '/auth/login' }],
    }
  }

  // 취소 가능한 신청 조회
  const entries = await fetchCancelableEntries(userId)

  if (entries.length === 0) {
    return {
      success: true,
      message: '취소할 참가 신청이 없습니다.',
      links: [{ label: '대회 목록', href: '/tournaments' }],
    }
  }

  // 단일 신청 → 바로 CONFIRM_CANCEL
  if (entries.length === 1) {
    const entry = entries[0]
    const session: CancelFlowSession = {
      userId,
      step: 'CONFIRM_CANCEL',
      entries,
      selectedEntry: entry,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setSession(userId, session)

    return {
      success: true,
      message: buildSingleEntryMessage(entry),
      flow_active: true,
    }
  }

  // 복수 신청 → SELECT_ENTRY
  const session: CancelFlowSession = {
    userId,
    step: 'SELECT_ENTRY',
    entries,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
  setSession(userId, session)

  return {
    success: true,
    message: buildEntryListMessage(entries),
    flow_active: true,
  }
}

// ─── 플로우 핸들러 (활성 세션 메시지 처리) ───────────

/** 취소 키워드 */
const CANCEL_KEYWORDS = ['그만', 'cancel', '취소', '중단']

/** 활성 세션의 메시지 처리 (Gemini 스킵) */
export async function handleCancelFlow(
  userId: string,
  message: string,
): Promise<CancelFlowResult> {
  const session = getCancelSession(userId)
  if (!session) {
    return {
      success: false,
      message: '세션이 만료되었습니다. 다시 취소 요청을 해주세요.',
      flowActive: false,
    }
  }

  // 중단 처리
  if (CANCEL_KEYWORDS.includes(message.trim().toLowerCase())) {
    deleteSession(userId)
    return {
      success: true,
      message: '취소를 중단했습니다.',
      flowActive: false,
    }
  }

  switch (session.step) {
    case 'SELECT_ENTRY':
      return handleSelectEntryStep(session, message)
    case 'CONFIRM_CANCEL':
      return handleConfirmCancelStep(session, message)
    default:
      deleteSession(userId)
      return {
        success: false,
        message: '알 수 없는 상태입니다. 다시 시작해주세요.',
        flowActive: false,
      }
  }
}

// ─── Step 핸들러 ─────────────────────────────────────

/** SELECT_ENTRY: 번호 선택 */
function handleSelectEntryStep(
  session: CancelFlowSession,
  message: string,
): CancelFlowResult {
  const num = parseInt(message.trim(), 10)
  if (isNaN(num) || num < 1 || num > session.entries.length) {
    return {
      success: true,
      message: `1~${session.entries.length} 사이 번호를 입력해주세요. ("그만"으로 중단)`,
      flowActive: true,
    }
  }

  const selected = session.entries[num - 1]
  session.step = 'CONFIRM_CANCEL'
  session.selectedEntry = selected
  setSession(session.userId, session)

  return {
    success: true,
    message: `${selected.tournamentTitle} (${selected.divisionName}) 참가 신청을 취소할까요? (예/아니오)`,
    flowActive: true,
  }
}

/** CONFIRM_CANCEL: 예/아니오 확인 → deleteEntry 호출 */
async function handleConfirmCancelStep(
  session: CancelFlowSession,
  message: string,
): Promise<CancelFlowResult> {
  const answer = parseConfirm(message)

  if (answer === 'no') {
    deleteSession(session.userId)
    return {
      success: true,
      message: '취소를 중단했습니다.',
      flowActive: false,
    }
  }

  if (answer !== 'yes') {
    return {
      success: true,
      message: '"예" 또는 "아니오"로 답변해주세요.',
      flowActive: true,
    }
  }

  const entry = session.selectedEntry!
  const result = await deleteEntry(entry.id)
  deleteSession(session.userId)

  if (!result.success) {
    return {
      success: false,
      message: result.error ?? '참가 취소에 실패했습니다.',
      flowActive: false,
    }
  }

  return {
    success: true,
    message: `${entry.tournamentTitle} (${entry.divisionName}) 참가 신청이 취소되었습니다.`,
    flowActive: false,
    links: [{ label: '대회 목록', href: '/tournaments' }],
  }
}

// ─── 유틸리티 ────────────────────────────────────────

/** 취소 가능한 신청 목록 조회 (CANCELLED 제외) */
async function fetchCancelableEntries(userId: string): Promise<CancelableEntry[]> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('tournament_entries')
    .select(`
      id,
      status,
      payment_status,
      tournament_id,
      tournaments!inner(title),
      divisions!inner(name)
    `)
    .eq('user_id', userId)
    .neq('status', 'CANCELLED')
    .order('created_at', { ascending: false })

  if (error || !data) return []

  return data.map((row) => ({
    id: row.id as string,
    tournamentId: row.tournament_id as string,
    tournamentTitle: (row.tournaments as unknown as { title: string }).title,
    divisionName: (row.divisions as unknown as { name: string }).name,
    status: row.status as string,
    paymentStatus: row.payment_status as string,
  }))
}

/** "예"/"아니오" 파싱 */
function parseConfirm(message: string): 'yes' | 'no' | 'unknown' {
  const m = message.trim().toLowerCase()
  if (['예', '네', 'yes', 'y', '응', 'ㅇ', 'ㅇㅇ'].includes(m)) return 'yes'
  if (['아니오', '아니', 'no', 'n', 'ㄴ', 'ㄴㄴ'].includes(m)) return 'no'
  return 'unknown'
}

/** 복수 신청 목록 메시지 */
function buildEntryListMessage(entries: CancelableEntry[]): string {
  const lines = ['취소 가능한 신청 내역:']
  entries.forEach((e, i) => {
    const status = STATUS_LABELS[e.status] ?? e.status
    const payment = PAYMENT_LABELS[e.paymentStatus] ?? e.paymentStatus
    lines.push(`${i + 1}. ${e.tournamentTitle} (${e.divisionName}) — 상태: ${status} | 결제: ${payment}`)
  })
  lines.push('\n몇 번 신청을 취소하시겠어요? ("그만"으로 중단)')
  return lines.join('\n')
}

/** 단일 신청 확인 메시지 */
function buildSingleEntryMessage(entry: CancelableEntry): string {
  const status = STATUS_LABELS[entry.status] ?? entry.status
  const payment = PAYMENT_LABELS[entry.paymentStatus] ?? entry.paymentStatus
  return `취소 가능한 신청이 1건 있습니다:\n- ${entry.tournamentTitle} (${entry.divisionName}) — 상태: ${status} | 결제: ${payment}\n\n이 신청을 취소할까요? (예/아니오)`
}
