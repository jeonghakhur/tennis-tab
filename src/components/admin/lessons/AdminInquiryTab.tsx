'use client'

import { useState, useEffect } from 'react'
import { Phone, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react'
import { getAdminLessonInquiries, updateInquiryStatus } from '@/lib/lessons/slot-actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import type { LessonInquiry, LessonInquiryStatus } from '@/lib/lessons/types'

const STATUS_CONFIG: Record<LessonInquiryStatus, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: '대기', variant: 'warning' },
  RESPONDED: { label: '응대 완료', variant: 'success' },
  CLOSED: { label: '종료', variant: 'secondary' },
}

const STATUS_TRANSITIONS: Record<LessonInquiryStatus, LessonInquiryStatus[]> = {
  PENDING: ['RESPONDED', 'CLOSED'],
  RESPONDED: ['CLOSED'],
  CLOSED: [],
}

type FilterStatus = 'ALL' | LessonInquiryStatus

export function AdminInquiryTab() {
  const [inquiries, setInquiries] = useState<LessonInquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('ALL')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [noteEdits, setNoteEdits] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    loadInquiries()
  }, [])

  const loadInquiries = async () => {
    setLoading(true)
    const { data, error } = await getAdminLessonInquiries()
    if (error) {
      setAlert({ isOpen: true, message: error, type: 'error' })
    }
    setInquiries(data)
    setLoading(false)
  }

  const handleStatusChange = async (inquiry: LessonInquiry, next: LessonInquiryStatus) => {
    setSavingId(inquiry.id)
    const adminNote = noteEdits[inquiry.id] ?? inquiry.admin_note ?? undefined
    // 낙관적 로컬 업데이트
    setInquiries((prev) =>
      prev.map((i) => i.id === inquiry.id ? { ...i, status: next, admin_note: adminNote ?? i.admin_note } : i)
    )
    const result = await updateInquiryStatus(inquiry.id, next, adminNote)
    setSavingId(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      await loadInquiries() // 에러 시에만 서버 재조회
      return
    }
    setToast({ isOpen: true, message: '상태가 변경되었습니다.', type: 'success' })
  }

  const handleNoteSave = async (inquiry: LessonInquiry) => {
    setSavingId(inquiry.id)
    const note = noteEdits[inquiry.id] ?? ''
    // 낙관적 로컬 업데이트
    setInquiries((prev) =>
      prev.map((i) => i.id === inquiry.id ? { ...i, admin_note: note } : i)
    )
    setNoteEdits((prev) => { const n = { ...prev }; delete n[inquiry.id]; return n })
    const result = await updateInquiryStatus(inquiry.id, inquiry.status, note)
    setSavingId(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      await loadInquiries() // 에러 시에만 서버 재조회
      return
    }
    setToast({ isOpen: true, message: '메모가 저장되었습니다.', type: 'success' })
  }

  const filtered = filter === 'ALL' ? inquiries : inquiries.filter((i) => i.status === filter)

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      {/* 필터 */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {(['ALL', 'PENDING', 'RESPONDED', 'CLOSED'] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: filter === s ? 'var(--accent-color)' : 'var(--bg-card)',
              color: filter === s ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${filter === s ? 'var(--accent-color)' : 'var(--border-color)'}`,
            }}
          >
            {s === 'ALL' ? `전체 (${inquiries.length})` : `${STATUS_CONFIG[s as LessonInquiryStatus].label} (${inquiries.filter((i) => i.status === s).length})`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          문의가 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((inquiry) => {
            const isExpanded = expandedId === inquiry.id
            const conf = STATUS_CONFIG[inquiry.status]
            const transitions = STATUS_TRANSITIONS[inquiry.status]
            const currentNote = noteEdits[inquiry.id] ?? inquiry.admin_note ?? ''
            const hasNoteChange = inquiry.id in noteEdits && noteEdits[inquiry.id] !== (inquiry.admin_note ?? '')

            return (
              <div
                key={inquiry.id}
                className="rounded-xl overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                {/* 요약 행 */}
                <button
                  className="w-full flex items-start justify-between p-4 text-left"
                  onClick={() => setExpandedId(isExpanded ? null : inquiry.id)}
                  aria-expanded={isExpanded}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {inquiry.name}
                      </span>
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(inquiry.created_at)}
                    </p>
                  </div>
                  <div className="shrink-0 ml-2 mt-0.5">
                    {isExpanded
                      ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                      : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    }
                  </div>
                </button>

                {/* 상세 펼치기 */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                    <div className="pt-3 space-y-3">
                      {/* 연락처 */}
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
                        <a
                          href={`tel:${inquiry.phone}`}
                          className="hover:underline"
                          style={{ color: 'var(--accent-color)' }}
                        >
                          {inquiry.phone}
                        </a>
                      </div>

                      {/* 문의 내용 */}
                      <div>
                        <p className="text-xs font-medium mb-1 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                          <MessageSquare className="w-3.5 h-3.5" />
                          문의 내용
                        </p>
                        <p
                          className="text-sm whitespace-pre-wrap p-3 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
                        >
                          {inquiry.message}
                        </p>
                      </div>

                      {/* 관리자 메모 */}
                      <div>
                        <label
                          htmlFor={`note-${inquiry.id}`}
                          className="block text-xs font-medium mb-1"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          관리자 메모
                        </label>
                        <textarea
                          id={`note-${inquiry.id}`}
                          value={currentNote}
                          onChange={(e) => setNoteEdits((prev) => ({ ...prev, [inquiry.id]: e.target.value }))}
                          placeholder="응대 내용, 메모 등"
                          rows={2}
                          maxLength={500}
                          className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                          style={{
                            backgroundColor: 'var(--bg-secondary)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-color)',
                          }}
                        />
                        {hasNoteChange && (
                          <button
                            onClick={() => handleNoteSave(inquiry)}
                            disabled={savingId === inquiry.id}
                            className="text-xs mt-1 px-2 py-1 rounded-md"
                            style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                          >
                            {savingId === inquiry.id ? '저장 중...' : '메모 저장'}
                          </button>
                        )}
                      </div>

                      {/* 상태 변경 버튼 */}
                      {transitions.length > 0 && (
                        <div className="flex gap-2">
                          {transitions.map((next) => (
                            <button
                              key={next}
                              onClick={() => handleStatusChange(inquiry, next)}
                              disabled={savingId === inquiry.id}
                              className="text-xs px-3 py-1.5 rounded-lg font-medium"
                              style={{
                                backgroundColor: next === 'RESPONDED' ? 'var(--color-success)' : 'var(--bg-card-hover)',
                                color: next === 'RESPONDED' ? 'white' : 'var(--text-secondary)',
                                opacity: savingId === inquiry.id ? 0.6 : 1,
                              }}
                            >
                              {STATUS_CONFIG[next].label}으로 변경
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
