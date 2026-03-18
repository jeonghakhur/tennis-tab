'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { RotateCcw, Check, X, MessageSquare } from 'lucide-react'
import {
  getExtensionRequests,
  updateExtensionRequest,
  markExtensionApproved,
  type LessonExtensionRequest,
  type ExtensionStatus,
} from '@/lib/lessons/extension-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import { BOOKING_TYPE_LABEL } from '@/lib/lessons/slot-types'
import type { SlotSession, LessonSlot } from '@/lib/lessons/slot-types'
import { CreateSlotModal, type SlotPrefill } from './CreateSlotModal'

// ── 상태 config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ExtensionStatus, { label: string; variant: BadgeVariant }> = {
  PENDING:  { label: '대기', variant: 'warning' },
  APPROVED: { label: '승인', variant: 'success' },
  REJECTED: { label: '거절', variant: 'danger'  },
}

type StatusFilter = 'ALL' | ExtensionStatus

// ── 날짜 포맷 ──────────────────────────────────────────────────────────────

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const M = d.getMonth() + 1
  const D = d.getDate()
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${M}/${D} ${h}:${m}`
}

// ── 처리 모달 (거절 전용) ──────────────────────────────────────────────────

function ProcessModal({
  request,
  onClose,
  onApprove,
  onReject,
}: {
  request: LessonExtensionRequest
  onClose: () => void
  /** 승인 버튼 클릭 — adminNote 넘기고 위자드로 전환 */
  onApprove: (adminNote: string) => void
  /** 거절 확정 */
  onReject: (reason: string) => Promise<void>
}) {
  const [adminNote, setAdminNote] = useState(request.admin_note ?? '')
  const [noteError, setNoteError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const memberName = (request.member as { name: string } | null)?.name ?? '-'
  const coachData  = (request.slot as { coach?: { name: string } } | null)?.coach
  const coachName  = coachData?.name ?? '-'
  const slotRaw    = request.slot as { total_sessions?: number } | null
  const totalSessions = slotRaw?.total_sessions ?? '-'
  const bookingRaw = request.booking as { booking_type?: string } | null
  const bookingType = bookingRaw?.booking_type
    ? (BOOKING_TYPE_LABEL[bookingRaw.booking_type as keyof typeof BOOKING_TYPE_LABEL] ?? bookingRaw.booking_type)
    : '-'

  const handleReject = async () => {
    if (!adminNote.trim()) { setNoteError(true); return }
    setSubmitting(true)
    await onReject(adminNote.trim())
    setSubmitting(false)
  }

  return (
    <Modal isOpen onClose={onClose} title="연장 신청 처리" size="md">
      <Modal.Body>
        <div className="space-y-4">
          {/* 신청 정보 */}
          <div className="rounded-lg p-4 space-y-2 text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>회원</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{memberName}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>코치</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{coachName}</span>
            </div>
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>패키지</span>
              <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                {bookingType} · {totalSessions}회
              </span>
            </div>
            {request.kakao_sent && (
              <div className="flex justify-between">
                <span style={{ color: 'var(--text-muted)' }}>알림톡</span>
                <span className="text-sm" style={{ color: 'var(--color-success)' }}>발송 완료</span>
              </div>
            )}
          </div>

          {/* 회원 메시지 */}
          {request.message && (
            <div>
              <p className="text-sm font-medium mb-1.5" style={{ color: 'var(--text-muted)' }}>
                회원 메시지
              </p>
              <p className="text-sm px-3 py-2.5 rounded-lg"
                style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                {request.message}
              </p>
            </div>
          )}

          {/* 처리 메모 / 거절 사유 */}
          <div>
            <label htmlFor="admin-note" className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}>
              처리 메모{' '}
              <span style={{ color: noteError ? 'var(--color-danger)' : 'var(--text-muted)' }}>
                (거절 시 필수)
              </span>
            </label>
            <textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => { setAdminNote(e.target.value); setNoteError(false) }}
              rows={2}
              placeholder="거절 사유 또는 전달 메시지"
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: `1px solid ${noteError ? 'var(--color-danger)' : 'var(--border-color)'}`,
              }}
            />
            {noteError && (
              <p className="text-xs mt-1" style={{ color: 'var(--color-danger)' }}>
                거절 사유를 입력해주세요.
              </p>
            )}
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={handleReject} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--color-danger)', border: '1px solid var(--color-danger)30' }}>
          <X className="w-4 h-4" />
          {submitting ? '처리 중...' : '거절'}
        </button>
        <button type="button" onClick={() => onApprove(adminNote)} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}>
          <Check className="w-4 h-4" />
          승인 (일정 설정)
        </button>
      </Modal.Footer>
    </Modal>
  )
}

// ── 슬롯 prefill 변환 ──────────────────────────────────────────────────────

function buildExtensionPrefill(slot: LessonSlot | null): SlotPrefill | undefined {
  if (!slot?.sessions || slot.sessions.length === 0) return undefined

  const activeSessions = (slot.sessions as SlotSession[]).filter(
    (s) => s.status !== 'CANCELLED' && s.status !== 'RESCHEDULED',
  )
  if (activeSessions.length === 0) return undefined

  const dowMap = new Map<number, string>()
  for (const s of activeSessions) {
    const dow = new Date(s.slot_date + 'T00:00:00').getDay()
    if (!dowMap.has(dow)) dowMap.set(dow, s.start_time.slice(0, 5))
  }
  const selectedDays = [...dowMap.keys()].sort((a, b) => a - b)
  const times: [string, string] = [
    dowMap.get(selectedDays[0]) ?? '',
    dowMap.get(selectedDays[1]) ?? '',
  ]
  const lastSessionDate = activeSessions.map((s) => s.slot_date).sort().reverse()[0]

  return {
    frequency: (slot.frequency as 1 | 2) ?? 1,
    duration: (slot.duration_minutes as 20 | 30) ?? 20,
    selectedDays,
    times,
    lastSessionDate,
    feeInput: slot.fee_amount != null ? String(slot.fee_amount) : '',
  }
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────

interface AdminExtensionTabProps {
  /** 코치 모드: 이 coachId의 연장 신청만 표시 */
  coachId?: string
}

export function AdminExtensionTab({ coachId: fixedCoachId }: AdminExtensionTabProps = {}) {
  const [requests, setRequests]     = useState<LessonExtensionRequest[]>([])
  const [loading, setLoading]       = useState(true)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [selected, setSelected]     = useState<LessonExtensionRequest | null>(null)
  /** 승인 위자드 대상 — 처리 모달에서 승인 클릭 시 설정 */
  const [approveInfo, setApproveInfo] = useState<{
    request: LessonExtensionRequest
    adminNote: string
  } | null>(null)
  const [toast, setToast]           = useState({ isOpen: false, message: '', type: 'success' as const })

  const loadData = useCallback(async () => {
    setLoading(true)
    const { data } = await getExtensionRequests(fixedCoachId ? { coachId: fixedCoachId } : undefined)
    setRequests(data)
    setLoading(false)
  }, [fixedCoachId])

  useEffect(() => { loadData() }, [loadData])

  const filtered = requests.filter((r) =>
    statusFilter === 'ALL' ? true : r.status === statusFilter
  )

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length

  // 승인 위자드용 prefill + coachId
  const approvePrefill = useMemo(() => {
    if (!approveInfo) return undefined
    const slot = approveInfo.request.slot as LessonSlot | null
    return buildExtensionPrefill(slot)
  }, [approveInfo])

  const approveCoachId = useMemo(() => {
    if (!approveInfo) return ''
    const slot = approveInfo.request.slot as { coach_id?: string } | null
    return slot?.coach_id ?? ''
  }, [approveInfo])

  const approveSlotId = useMemo(() => {
    if (!approveInfo) return ''
    const slot = approveInfo.request.slot as { id?: string } | null
    return slot?.id ?? ''
  }, [approveInfo])

  // 승인 위자드 완료 핸들러 — CreateSlotModal이 슬롯+예약 생성 완료 후 호출
  const handleApproveWizardSuccess = async (count: number) => {
    if (!approveInfo) return
    // 연장 신청 상태를 APPROVED로 마킹 (슬롯 생성은 위자드에서 완료됨)
    const result = await markExtensionApproved(approveInfo.request.id, approveInfo.adminNote || undefined)
    setApproveInfo(null)
    if (result.error) {
      setToast({ isOpen: true, message: `슬롯 생성됐으나 승인 마킹 실패: ${result.error}`, type: 'error' as 'success' })
    } else {
      setToast({ isOpen: true, message: `패키지가 연장 승인되었습니다. (${count}회)`, type: 'success' })
    }
    loadData()
  }

  return (
    <div>
      {/* 필터 + 건수 */}
      <div className="flex items-center gap-3 mb-4">
        {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => {
          const isActive = statusFilter === s
          const label = s === 'ALL' ? `전체 (${requests.length})` : s === 'PENDING'
            ? `대기 ${pendingCount > 0 ? `(${pendingCount})` : ''}`
            : s === 'APPROVED' ? '승인' : '거절'
          return (
            <button key={s} type="button" onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-secondary)',
                color: isActive ? '#fff' : 'var(--text-secondary)',
              }}>
              {label}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-2 animate-pulse">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <RotateCcw className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>연장 신청이 없습니다.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg" style={{ border: '1px solid var(--border-color)' }}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)' }}>
                {['회원', '코치', '패키지', '알림톡', '신청일', '상태', ''].map((h) => (
                  <th key={h} className="px-4 py-3 text-left font-medium whitespace-nowrap"
                    style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((req, idx) => {
                const memberName = (req.member as { name: string } | null)?.name ?? '-'
                const coachData  = (req.slot as { coach?: { name: string } } | null)?.coach
                const coachName  = coachData?.name ?? '-'
                const slotRaw    = req.slot as { total_sessions?: number } | null
                const totalSessions = slotRaw?.total_sessions
                const bookingRaw = req.booking as { booking_type?: string } | null
                const bookingType = bookingRaw?.booking_type
                  ? (BOOKING_TYPE_LABEL[bookingRaw.booking_type as keyof typeof BOOKING_TYPE_LABEL] ?? bookingRaw.booking_type)
                  : '-'
                const isLast = idx === filtered.length - 1

                return (
                  <tr key={req.id}
                    style={{
                      borderBottom: isLast ? 'none' : '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-card)',
                    }}>
                    <td className="px-4 py-3 font-medium whitespace-nowrap"
                      style={{ color: 'var(--text-primary)' }}>{memberName}</td>
                    <td className="px-4 py-3 whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>{coachName}</td>
                    <td className="px-4 py-3 whitespace-nowrap"
                      style={{ color: 'var(--text-secondary)' }}>
                      {bookingType}{totalSessions ? ` · ${totalSessions}회` : ''}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      {req.kakao_sent ? (
                        <span style={{ color: 'var(--color-success)' }}>✓ 발송</span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>미발송</span>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap"
                      style={{ color: 'var(--text-muted)' }}>{fmtDateTime(req.created_at)}</td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={STATUS_CONFIG[req.status].variant}>
                        {STATUS_CONFIG[req.status].label}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      {req.status === 'PENDING' ? (
                        <button type="button" onClick={() => setSelected(req)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium ml-auto"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                          <MessageSquare className="w-3.5 h-3.5" />
                          처리
                        </button>
                      ) : (
                        req.admin_note && (
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {req.admin_note}
                          </span>
                        )
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* 처리 모달 (거절/승인 선택) */}
      {selected && (
        <ProcessModal
          request={selected}
          onClose={() => setSelected(null)}
          onApprove={(adminNote) => {
            // 승인: 위자드로 전환
            setApproveInfo({ request: selected, adminNote })
            setSelected(null)
          }}
          onReject={async (reason) => {
            const result = await updateExtensionRequest(selected.id, 'REJECTED', reason)
            if (result.error) {
              setToast({ isOpen: true, message: result.error, type: 'error' as 'success' })
              return
            }
            setSelected(null)
            setToast({ isOpen: true, message: '거절 처리되었습니다.', type: 'success' })
            loadData()
          }}
        />
      )}

      {/* 승인 위자드 모달 */}
      {approveInfo && approveCoachId && approveSlotId && (
        <CreateSlotModal
          isOpen={!!approveInfo}
          onClose={() => setApproveInfo(null)}
          coachId={approveCoachId}
          extendSlotId={approveSlotId}
          prefill={approvePrefill}
          onSuccess={handleApproveWizardSuccess}
          onError={(msg) => setToast({ isOpen: true, message: msg, type: 'error' as 'success' })}
        />
      )}

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}
