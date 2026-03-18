'use client'

import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Check, X, MessageSquare } from 'lucide-react'
import {
  getExtensionRequests,
  updateExtensionRequest,
  type LessonExtensionRequest,
  type ExtensionStatus,
} from '@/lib/lessons/extension-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast } from '@/components/common/AlertDialog'
import { BOOKING_TYPE_LABEL } from '@/lib/lessons/slot-types'

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

// ── 처리 모달 ─────────────────────────────────────────────────────────────

function ProcessModal({
  request,
  onClose,
  onDone,
}: {
  request: LessonExtensionRequest
  onClose: () => void
  onDone: () => void
}) {
  const [adminNote, setAdminNote] = useState(request.admin_note ?? '')
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

  const handle = async (status: 'APPROVED' | 'REJECTED') => {
    setSubmitting(true)
    const result = await updateExtensionRequest(request.id, status, adminNote)
    setSubmitting(false)
    if (!result.error) { onDone(); onClose() }
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
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>연장 희망</span>
              <span className="font-semibold" style={{ color: 'var(--accent-color)' }}>
                {request.requested_weeks}주
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

          {/* 관리자 메모 */}
          <div>
            <label htmlFor="admin-note" className="block text-sm font-medium mb-1.5"
              style={{ color: 'var(--text-primary)' }}>
              처리 메모 <span style={{ color: 'var(--text-muted)' }}>(선택)</span>
            </label>
            <textarea
              id="admin-note"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              rows={2}
              placeholder="처리 사유 또는 전달 메시지"
              className="w-full px-3 py-2 rounded-lg text-sm resize-none"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)',
              }}
            />
          </div>
        </div>
      </Modal.Body>
      <Modal.Footer>
        <button type="button" onClick={() => handle('REJECTED')} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--color-danger)', border: '1px solid var(--border-color)' }}>
          <X className="w-4 h-4" />
          거절
        </button>
        <button type="button" onClick={() => handle('APPROVED')} disabled={submitting}
          className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent-color)', color: '#fff' }}>
          <Check className="w-4 h-4" />
          {submitting ? '처리 중...' : '승인'}
        </button>
      </Modal.Footer>
    </Modal>
  )
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
                {['회원', '코치', '패키지', '연장 희망', '알림톡', '신청일', '상태', ''].map((h) => (
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
                    <td className="px-4 py-3 whitespace-nowrap font-semibold"
                      style={{ color: 'var(--accent-color)' }}>
                      {req.requested_weeks}주
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

      {/* 처리 모달 */}
      {selected && (
        <ProcessModal
          request={selected}
          onClose={() => setSelected(null)}
          onDone={() => {
            setToast({ isOpen: true, message: '처리되었습니다.', type: 'success' })
            loadData()
          }}
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
