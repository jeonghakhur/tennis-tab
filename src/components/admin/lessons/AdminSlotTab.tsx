'use client'

import { useState, useEffect } from 'react'
import { Plus, CalendarX } from 'lucide-react'
import {
  getLessonProgramDetail,
  createLessonSession,
  updateSessionStatus,
} from '@/lib/lessons/actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonProgram, LessonSession, LessonSessionStatus, CreateSessionInput } from '@/lib/lessons/types'

const SESSION_STATUS_CONFIG: Record<LessonSessionStatus, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: '예정', variant: 'info' },
  COMPLETED: { label: '완료', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

interface AdminSlotTabProps {
  programs: LessonProgram[]
  programsLoading: boolean
}

const EMPTY_SLOT: CreateSessionInput = {
  session_date: '',
  start_time: '',
  end_time: '',
  location: '',
  notes: '',
}

export function AdminSlotTab({ programs, programsLoading }: AdminSlotTabProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [sessions, setSessions] = useState<LessonSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [slotFormOpen, setSlotFormOpen] = useState(false)
  const [slotData, setSlotData] = useState<CreateSessionInput>(EMPTY_SLOT)
  const [submitting, setSubmitting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<LessonSession | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  // 프로그램 선택 시 세션 로드
  useEffect(() => {
    if (!selectedProgramId) {
      setSessions([])
      return
    }
    setSessionsLoading(true)
    getLessonProgramDetail(selectedProgramId).then(({ data }) => {
      setSessions(data?.sessions || [])
      setSessionsLoading(false)
    })
  }, [selectedProgramId])

  // 프로그램 목록이 로드되면 첫 번째 선택
  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  const handleCreateSlot = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProgramId) return
    if (!slotData.session_date || !slotData.start_time || !slotData.end_time) {
      setAlert({ isOpen: true, message: '날짜와 시간을 입력해주세요.', type: 'error' })
      return
    }

    setSubmitting(true)
    const result = await createLessonSession(selectedProgramId, {
      ...slotData,
      location: slotData.location || undefined,
      notes: slotData.notes || undefined,
    })
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '슬롯이 등록되었습니다.', type: 'success' })
    setSlotFormOpen(false)
    setSlotData(EMPTY_SLOT)
    // 세션 목록 새로고침
    const { data } = await getLessonProgramDetail(selectedProgramId)
    setSessions(data?.sessions || [])
  }

  const handleCancelSlot = async () => {
    if (!cancelTarget) return
    const result = await updateSessionStatus(cancelTarget.id, 'CANCELLED')
    setCancelTarget(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: '슬롯이 취소되었습니다.', type: 'success' })
    if (selectedProgramId) {
      const { data } = await getLessonProgramDetail(selectedProgramId)
      setSessions(data?.sessions || [])
    }
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr)
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  }

  return (
    <div>
      {/* 프로그램 선택 */}
      <div className="mb-4">
        <label htmlFor="slot-program-select" className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-primary)' }}>
          프로그램 선택
        </label>
        {programsLoading ? (
          <div className="h-10 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ) : (
          <select
            id="slot-program-select"
            value={selectedProgramId}
            onChange={(e) => setSelectedProgramId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
          >
            <option value="">프로그램을 선택하세요</option>
            {programs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} ({p.coach?.name || '코치 미배정'})
              </option>
            ))}
          </select>
        )}
      </div>

      {selectedProgramId && (
        <>
          <div className="flex justify-end mb-4">
            <button
              onClick={() => setSlotFormOpen(true)}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
            >
              <Plus className="w-4 h-4" />
              슬롯 추가
            </button>
          </div>

          {sessionsLoading ? (
            <div className="space-y-2 animate-pulse">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 rounded-lg" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12">
              <CalendarX className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>등록된 슬롯이 없습니다.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const conf = SESSION_STATUS_CONFIG[session.status]
                return (
                  <div
                    key={session.id}
                    className="flex items-center justify-between px-4 py-3 rounded-lg"
                    style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                        {formatDate(session.session_date)}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {session.start_time.slice(0, 5)} ~ {session.end_time.slice(0, 5)}
                        {session.location && ` · ${session.location}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={conf.variant}>{conf.label}</Badge>
                      {session.status === 'SCHEDULED' && (
                        <button
                          onClick={() => setCancelTarget(session)}
                          className="text-xs px-2 py-1 rounded-md"
                          style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                        >
                          취소
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* 슬롯 등록 모달 */}
      <Modal
        isOpen={slotFormOpen}
        onClose={() => setSlotFormOpen(false)}
        title="레슨 슬롯 추가"
        size="md"
      >
        <form onSubmit={handleCreateSlot} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="slot-date" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  날짜 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="slot-date"
                  type="date"
                  value={slotData.session_date}
                  onChange={(e) => setSlotData({ ...slotData, session_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="slot-start" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    시작 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="slot-start"
                    type="time"
                    value={slotData.start_time}
                    onChange={(e) => setSlotData({ ...slotData, start_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
                <div>
                  <label htmlFor="slot-end" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    종료 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                  </label>
                  <input
                    id="slot-end"
                    type="time"
                    value={slotData.end_time}
                    onChange={(e) => setSlotData({ ...slotData, end_time: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  />
                </div>
              </div>
              <div>
                <label htmlFor="slot-location" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  장소
                </label>
                <input
                  id="slot-location"
                  type="text"
                  value={slotData.location || ''}
                  onChange={(e) => setSlotData({ ...slotData, location: e.target.value })}
                  placeholder="예: 마포구 테니스장 1코트"
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
              <div>
                <label htmlFor="slot-notes" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  메모
                </label>
                <textarea
                  id="slot-notes"
                  value={slotData.notes || ''}
                  onChange={(e) => setSlotData({ ...slotData, notes: e.target.value })}
                  placeholder="특이사항 또는 안내 사항"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button
              type="button"
              onClick={() => setSlotFormOpen(false)}
              className="flex-1 px-4 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
            >
              취소
            </button>
            <button type="submit" disabled={submitting} className="flex-1 btn-primary">
              {submitting ? '등록 중...' : '슬롯 등록'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!cancelTarget}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelSlot}
        title="슬롯 취소"
        message={cancelTarget ? `${formatDate(cancelTarget.session_date)} 슬롯을 취소하시겠습니까?` : ''}
        type="warning"
      />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
