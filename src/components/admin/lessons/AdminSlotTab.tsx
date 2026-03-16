'use client'

import { useState, useEffect } from 'react'
import { Plus, CalendarX, RefreshCw } from 'lucide-react'
import {
  getLessonProgramDetail,
  updateSessionStatus,
  createRecurringSessions,
} from '@/lib/lessons/actions'
import SessionDatePicker from '@/components/clubs/sessions/SessionDatePicker'
import SessionTimePicker from '@/components/clubs/sessions/SessionTimePicker'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type { LessonProgram, LessonSession, LessonSessionStatus, CreateSessionInput } from '@/lib/lessons/types'

const SESSION_STATUS_CONFIG: Record<LessonSessionStatus, { label: string; variant: BadgeVariant }> = {
  SCHEDULED: { label: '예정', variant: 'info' },
  COMPLETED: { label: '완료', variant: 'success' },
  CANCELLED: { label: '취소', variant: 'secondary' },
}

const DAYS_OF_WEEK = [
  { value: 1, label: '월' },
  { value: 2, label: '화' },
  { value: 3, label: '수' },
  { value: 4, label: '목' },
  { value: 5, label: '금' },
  { value: 6, label: '토' },
  { value: 0, label: '일' },
]

type WeeklyFrequency = 1 | 2
type DayType = 'WEEKDAY' | 'WEEKEND' | 'CUSTOM'

interface SlotPattern {
  startDate: string
  endDate: string
  startTime: string
  endTime: string
  location: string
  frequency: WeeklyFrequency    // 주 1회 or 주 2회
  dayType: DayType
  customDays: number[]          // dayType === 'CUSTOM' 일 때 사용
}

const EMPTY_PATTERN: SlotPattern = {
  startDate: '',
  endDate: '',
  startTime: '10:00',
  endTime: '10:20',
  location: '',
  frequency: 1,
  dayType: 'WEEKDAY',
  customDays: [],
}

/** 패턴으로 날짜 목록 생성 */
function generateDates(pattern: SlotPattern): string[] {
  const { startDate, endDate, frequency, dayType, customDays } = pattern
  if (!startDate || !endDate) return []

  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  if (start > end) return []

  // 허용 요일 집합
  const allowedDays = new Set<number>()
  if (dayType === 'WEEKDAY') {
    [1, 2, 3, 4, 5].forEach((d) => allowedDays.add(d))
  } else if (dayType === 'WEEKEND') {
    [0, 6].forEach((d) => allowedDays.add(d))
  } else {
    customDays.forEach((d) => allowedDays.add(d))
  }

  if (allowedDays.size === 0) return []

  const allDates: string[] = []
  const cur = new Date(start)

  while (cur <= end) {
    if (allowedDays.has(cur.getDay())) {
      allDates.push(cur.toISOString().substring(0, 10))
    }
    cur.setDate(cur.getDate() + 1)
  }

  // 주 1회: 같은 요일로 첫 번째만 유지 (매주)
  // 주 2회: 모든 허용 날짜 포함 (단, 같은 주에 2개 이하)
  if (frequency === 1) {
    // 같은 요일 중 가장 먼저 나오는 요일(들)만 한 개씩
    // 실제로는 allowedDays에서 첫 번째 요일만 사용
    const firstDay = [...allowedDays].sort((a, b) => {
      // 월요일(1) 기준으로 정렬
      const norm = (d: number) => (d === 0 ? 7 : d)
      return norm(a) - norm(b)
    })[0]

    return allDates.filter((d) => {
      const dow = new Date(d + 'T00:00:00').getDay()
      return dow === firstDay
    })
  }

  // 주 2회: 첫 번째와 두 번째 허용 요일
  if (frequency === 2) {
    const sorted = [...allowedDays].sort((a, b) => {
      const norm = (d: number) => (d === 0 ? 7 : d)
      return norm(a) - norm(b)
    })
    const first = sorted[0]
    const second = sorted[1]
    if (second === undefined) return allDates  // 허용 요일이 1개면 그냥 다
    return allDates.filter((d) => {
      const dow = new Date(d + 'T00:00:00').getDay()
      return dow === first || dow === second
    })
  }

  return allDates
}

interface AdminSlotTabProps {
  programs: LessonProgram[]
  programsLoading: boolean
}

export function AdminSlotTab({ programs, programsLoading }: AdminSlotTabProps) {
  const [selectedProgramId, setSelectedProgramId] = useState<string>('')
  const [sessions, setSessions] = useState<LessonSession[]>([])
  const [sessionsLoading, setSessionsLoading] = useState(false)
  const [slotFormOpen, setSlotFormOpen] = useState(false)
  const [pattern, setPattern] = useState<SlotPattern>(EMPTY_PATTERN)
  const [preview, setPreview] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [cancelTarget, setCancelTarget] = useState<LessonSession | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    if (!selectedProgramId) { setSessions([]); return }
    setSessionsLoading(true)
    getLessonProgramDetail(selectedProgramId).then(({ data }) => {
      setSessions(data?.sessions || [])
      setSessionsLoading(false)
    })
  }, [selectedProgramId])

  useEffect(() => {
    if (programs.length > 0 && !selectedProgramId) {
      setSelectedProgramId(programs[0].id)
    }
  }, [programs, selectedProgramId])

  // 패턴 변경 시 미리보기 자동 갱신
  useEffect(() => {
    setPreview(generateDates(pattern))
  }, [pattern])

  const refreshSessions = async () => {
    if (!selectedProgramId) return
    setSessionsLoading(true)
    const { data } = await getLessonProgramDetail(selectedProgramId)
    setSessions(data?.sessions || [])
    setSessionsLoading(false)
  }

  const handleCreateSlots = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedProgramId) return
    if (!pattern.startTime || !pattern.endTime) {
      setAlert({ isOpen: true, message: '시작/종료 시간을 선택해주세요.', type: 'error' })
      return
    }
    if (preview.length === 0) {
      setAlert({ isOpen: true, message: '생성할 슬롯이 없습니다. 날짜 범위와 요일 설정을 확인해주세요.', type: 'error' })
      return
    }

    const slots: CreateSessionInput[] = preview.map((date) => ({
      session_date: date,
      start_time: pattern.startTime,
      end_time: pattern.endTime,
      location: pattern.location || undefined,
    }))

    setSubmitting(true)
    const result = await createRecurringSessions(selectedProgramId, slots)
    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: `${result.count}개 슬롯이 등록되었습니다.`, type: 'success' })
    setSlotFormOpen(false)
    setPattern(EMPTY_PATTERN)
    await refreshSessions()
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
    await refreshSessions()
  }

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
  }

  const toggleCustomDay = (day: number) => {
    setPattern((prev) => ({
      ...prev,
      customDays: prev.customDays.includes(day)
        ? prev.customDays.filter((d) => d !== day)
        : [...prev.customDays, day],
    }))
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
              반복 슬롯 등록
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

      {/* 반복 슬롯 등록 모달 */}
      <Modal
        isOpen={slotFormOpen}
        onClose={() => setSlotFormOpen(false)}
        title="반복 레슨 슬롯 등록"
        size="lg"
      >
        <form onSubmit={handleCreateSlots} noValidate>
          <Modal.Body>
            <div className="space-y-5">

              {/* 날짜 범위 */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  기간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>시작일</label>
                    <SessionDatePicker
                      value={pattern.startDate}
                      onChange={(v) => setPattern({ ...pattern, startDate: v })}
                      placeholder="시작일 선택"
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>종료일</label>
                    <SessionDatePicker
                      value={pattern.endDate}
                      onChange={(v) => setPattern({ ...pattern, endDate: v })}
                      placeholder="종료일 선택"
                    />
                  </div>
                </div>
              </div>

              {/* 시간 */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  레슨 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>시작</label>
                    <SessionTimePicker
                      value={pattern.startTime}
                      onChange={(v) => setPattern({ ...pattern, startTime: v })}
                    />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>종료</label>
                    <SessionTimePicker
                      value={pattern.endTime}
                      onChange={(v) => setPattern({ ...pattern, endTime: v })}
                    />
                  </div>
                </div>
              </div>

              {/* 주 횟수 */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  주 레슨 횟수 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </p>
                <div className="flex gap-2" role="radiogroup" aria-label="주 레슨 횟수">
                  {([1, 2] as WeeklyFrequency[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      role="radio"
                      aria-checked={pattern.frequency === f}
                      onClick={() => setPattern({ ...pattern, frequency: f })}
                      className="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                      style={{
                        backgroundColor: pattern.frequency === f ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                        color: pattern.frequency === f ? 'var(--bg-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      주 {f}회
                    </button>
                  ))}
                </div>
              </div>

              {/* 요일 타입 */}
              <div>
                <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  요일 구분 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </p>
                <div className="flex gap-2 mb-3" role="radiogroup" aria-label="요일 구분">
                  {(['WEEKDAY', 'WEEKEND', 'CUSTOM'] as DayType[]).map((type) => {
                    const label = type === 'WEEKDAY' ? '주중(월-금)' : type === 'WEEKEND' ? '주말(토·일)' : '직접 선택'
                    return (
                      <button
                        key={type}
                        type="button"
                        role="radio"
                        aria-checked={pattern.dayType === type}
                        onClick={() => setPattern({ ...pattern, dayType: type, customDays: [] })}
                        className="flex-1 py-2 rounded-lg text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: pattern.dayType === type ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                          color: pattern.dayType === type ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>

                {/* 직접 요일 선택 */}
                {pattern.dayType === 'CUSTOM' && (
                  <div className="flex gap-1.5 flex-wrap" role="group" aria-label="요일 선택">
                    {DAYS_OF_WEEK.map((d) => (
                      <button
                        key={d.value}
                        type="button"
                        aria-pressed={pattern.customDays.includes(d.value)}
                        onClick={() => toggleCustomDay(d.value)}
                        className="w-10 h-10 rounded-full text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: pattern.customDays.includes(d.value) ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                          color: pattern.customDays.includes(d.value) ? 'var(--bg-primary)' : 'var(--text-secondary)',
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 장소 */}
              <div>
                <label htmlFor="slot-location" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  장소
                </label>
                <input
                  id="slot-location"
                  type="text"
                  value={pattern.location}
                  onChange={(e) => setPattern({ ...pattern, location: e.target.value })}
                  placeholder="예: 마포구 테니스장 1코트"
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* 미리보기 */}
              {preview.length > 0 && (
                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5" style={{ color: 'var(--text-primary)' }}>
                    <RefreshCw className="w-3.5 h-3.5" />
                    생성 예정 슬롯 ({preview.length}개)
                  </p>
                  <div
                    className="rounded-lg p-3 text-xs space-y-1 max-h-40 overflow-y-auto"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    {preview.slice(0, 20).map((date) => (
                      <div key={date} style={{ color: 'var(--text-secondary)' }}>
                        {formatDate(date)} {pattern.startTime} ~ {pattern.endTime}
                      </div>
                    ))}
                    {preview.length > 20 && (
                      <p style={{ color: 'var(--text-muted)' }}>... 외 {preview.length - 20}개</p>
                    )}
                  </div>
                </div>
              )}
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
            <button
              type="submit"
              disabled={submitting || preview.length === 0}
              className="flex-1 btn-primary"
              style={{ opacity: preview.length === 0 ? 0.5 : 1 }}
            >
              {submitting ? '등록 중...' : `${preview.length}개 슬롯 등록`}
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
