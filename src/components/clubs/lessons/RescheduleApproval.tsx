'use client'

import { useState, useEffect } from 'react'
import { format, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import { Check, X, ArrowRight } from 'lucide-react'
import { getRescheduleRequests, approveReschedule, rejectReschedule } from '@/lib/lessons/reschedule'
import { Badge } from '@/components/common/Badge'
import { Toast } from '@/components/common/AlertDialog'
import type { RescheduleRequest, RescheduleStatus } from '@/lib/lessons/types'

const STATUS_BADGE: Record<RescheduleStatus, { label: string; variant: 'info' | 'success' | 'danger' }> = {
  PENDING: { label: '대기', variant: 'info' },
  APPROVED: { label: '수락', variant: 'success' },
  REJECTED: { label: '거절', variant: 'danger' },
}

interface RescheduleApprovalProps {
  sessionId: string
}

/** 시간 포맷: "09:00:00" → "09:00" */
function formatTime(time: string) {
  return time.slice(0, 5)
}

export function RescheduleApproval({ sessionId }: RescheduleApprovalProps) {
  const [requests, setRequests] = useState<RescheduleRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [toast, setToast] = useState<{ isOpen: boolean; message: string; type: 'success' | 'error' }>({ isOpen: false, message: '', type: 'success' })

  useEffect(() => {
    loadRequests()
  }, [sessionId])

  const loadRequests = async () => {
    const { data } = await getRescheduleRequests(sessionId)
    setRequests(data)
    setLoading(false)
  }

  const handleApprove = async (requestId: string) => {
    setActionLoading(requestId)
    const result = await approveReschedule(requestId)
    setActionLoading(null)

    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '일정 변경이 수락되었습니다.', type: 'success' })
    loadRequests()
  }

  const handleReject = async (requestId: string) => {
    setActionLoading(requestId)
    const result = await rejectReschedule(requestId)
    setActionLoading(null)

    if (result.error) {
      setToast({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '일정 변경이 거절되었습니다.', type: 'success' })
    loadRequests()
  }

  if (loading) {
    return (
      <div className="space-y-2 animate-pulse">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-16 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  if (requests.length === 0) {
    return (
      <p className="text-sm text-center py-6" style={{ color: 'var(--text-muted)' }}>
        일정 변경 요청이 없습니다.
      </p>
    )
  }

  return (
    <div>
      <div className="space-y-3">
        {requests.map((req) => {
          const badge = STATUS_BADGE[req.status]
          const isPending = req.status === 'PENDING'

          return (
            <div
              key={req.id}
              className="rounded-lg p-3"
              style={{
                backgroundColor: 'var(--bg-card-hover)',
                border: isPending ? '1px solid var(--accent-color)' : '1px solid var(--border-color)',
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {req.requester?.name || '알 수 없음'}
                  <span className="ml-1 font-normal" style={{ color: 'var(--text-muted)' }}>
                    ({req.requester_type === 'ADMIN' ? '관리자' : '수강생'})
                  </span>
                </span>
                <Badge variant={badge.variant}>{badge.label}</Badge>
              </div>

              {/* 일정 변경 내용 */}
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span>
                  {format(parseISO(req.original_date), 'M/d', { locale: ko })} {formatTime(req.original_start_time)}~{formatTime(req.original_end_time)}
                </span>
                <ArrowRight className="w-3 h-3" style={{ color: 'var(--text-muted)' }} />
                <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                  {format(parseISO(req.requested_date), 'M/d', { locale: ko })} {formatTime(req.requested_start_time)}~{formatTime(req.requested_end_time)}
                </span>
              </div>

              {req.reason && (
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  사유: {req.reason}
                </p>
              )}

              {/* 수락/거절 버튼 (PENDING만) */}
              {isPending && (
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => handleApprove(req.id)}
                    disabled={actionLoading === req.id}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md font-medium"
                    style={{ backgroundColor: 'var(--color-success)', color: 'white' }}
                  >
                    <Check className="w-3.5 h-3.5" />
                    수락
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionLoading === req.id}
                    className="flex-1 flex items-center justify-center gap-1 text-xs py-1.5 rounded-md font-medium"
                    style={{ backgroundColor: 'var(--color-danger)', color: 'white' }}
                  >
                    <X className="w-3.5 h-3.5" />
                    거절
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </div>
  )
}
