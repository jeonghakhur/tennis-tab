'use client'

import { useState, useEffect, useMemo } from 'react'
import { Plus, Eye, EyeOff } from 'lucide-react'
import {
  createLessonProgram,
  updateLessonProgram,
  updateProgramStatus,
  deleteLessonProgram,
} from '@/lib/lessons/actions'
import { getAllCoaches } from '@/lib/coaches/actions'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import { Modal } from '@/components/common/Modal'
import { Toast, AlertDialog, ConfirmDialog } from '@/components/common/AlertDialog'
import type {
  LessonProgram,
  LessonProgramStatus,
  CreateProgramInput,
  UpdateProgramInput,
} from '@/lib/lessons/types'
import type { Coach } from '@/lib/lessons/types'

const STATUS_CONFIG: Record<LessonProgramStatus, { label: string; variant: BadgeVariant }> = {
  DRAFT: { label: '준비 중', variant: 'secondary' },
  OPEN: { label: '모집 중', variant: 'success' },
  CLOSED: { label: '마감', variant: 'orange' },
  CANCELLED: { label: '취소', variant: 'danger' },
}

const STATUS_TRANSITIONS: Record<LessonProgramStatus, LessonProgramStatus[]> = {
  DRAFT: ['OPEN'],
  OPEN: ['CLOSED'],
  CLOSED: ['OPEN'],
  CANCELLED: [],
}

interface AdminProgramTabProps {
  programs: LessonProgram[]
  loading: boolean
  onRefresh: () => void
}

const DURATION_OPTIONS = [20, 30, 60] as const
type DurationOption = typeof DURATION_OPTIONS[number]

interface ProgramFormData {
  coach_id: string
  title: string
  description: string
  max_participants: number
  session_duration_minutes: DurationOption
  fee_weekday_1: string
  fee_weekday_2: string
  fee_weekend_1: string
  fee_weekend_2: string
  fee_mixed_2: string
}

const EMPTY_FORM: ProgramFormData = {
  coach_id: '',
  title: '',
  description: '',
  max_participants: 1,
  session_duration_minutes: 20,
  fee_weekday_1: '',
  fee_weekday_2: '',
  fee_weekend_1: '',
  fee_weekend_2: '',
  fee_mixed_2: '',
}


const ALL_COACH_TAB = 'all' as const

export function AdminProgramTab({ programs, loading, onRefresh }: AdminProgramTabProps) {
  // 낙관적 업데이트용 로컬 상태 — 서버 prop이 변경되면 동기화
  const [localPrograms, setLocalPrograms] = useState<LessonProgram[]>(programs)
  useEffect(() => {
    setLocalPrograms(programs)
  }, [programs])

  const [coaches, setCoaches] = useState<Coach[]>([])
  const [selectedCoachId, setSelectedCoachId] = useState<string>(ALL_COACH_TAB)
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LessonProgram | null>(null)
  const [formData, setFormData] = useState<ProgramFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{ program: LessonProgram; next: LessonProgramStatus } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<LessonProgram | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    getAllCoaches().then(({ data }) => setCoaches(data))
  }, [])

  // 프로그램에 등장하는 코치만 탭으로 표시
  const coachTabs = useMemo(() => {
    const coachIds = new Set(localPrograms.map((p) => p.coach_id))
    return coaches.filter((c) => coachIds.has(c.id))
  }, [coaches, localPrograms])

  const filteredPrograms = useMemo(() => {
    if (selectedCoachId === ALL_COACH_TAB) return localPrograms
    return localPrograms.filter((p) => p.coach_id === selectedCoachId)
  }, [localPrograms, selectedCoachId])

  const openCreate = () => {
    setEditTarget(null)
    setFormData(EMPTY_FORM)
    setFormOpen(true)
  }

  const openEdit = (program: LessonProgram) => {
    setEditTarget(program)
    setFormData({
      coach_id: program.coach_id,
      title: program.title,
      description: program.description || '',
      max_participants: program.max_participants,
      session_duration_minutes: (DURATION_OPTIONS.includes(program.session_duration_minutes as DurationOption)
        ? program.session_duration_minutes
        : 20) as DurationOption,
      fee_weekday_1: program.fee_weekday_1?.toString() || '',
      fee_weekday_2: program.fee_weekday_2?.toString() || '',
      fee_weekend_1: program.fee_weekend_1?.toString() || '',
      fee_weekend_2: program.fee_weekend_2?.toString() || '',
      fee_mixed_2: program.fee_mixed_2?.toString() || '',
    })
    setFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.coach_id) {
      setAlert({ isOpen: true, message: '코치를 선택해주세요.', type: 'error' })
      return
    }
    if (!formData.title.trim()) {
      setAlert({ isOpen: true, message: '프로그램 제목을 입력해주세요.', type: 'error' })
      return
    }

    setSubmitting(true)
    let result: { error: string | null }

    const feeWeekday1 = formData.fee_weekday_1 ? parseInt(formData.fee_weekday_1) : undefined
    const feeWeekday2 = formData.fee_weekday_2 ? parseInt(formData.fee_weekday_2) : undefined
    const feeWeekend1 = formData.fee_weekend_1 ? parseInt(formData.fee_weekend_1) : undefined
    const feeWeekend2 = formData.fee_weekend_2 ? parseInt(formData.fee_weekend_2) : undefined
    const feeMixed2 = formData.fee_mixed_2 ? parseInt(formData.fee_mixed_2) : undefined

    if (editTarget) {
      const updateData: UpdateProgramInput = {
        coach_id: formData.coach_id,
        title: formData.title,
        description: formData.description || undefined,
        target_level: '전체',
        max_participants: formData.max_participants,
        session_duration_minutes: formData.session_duration_minutes,
        fee_weekday_1: feeWeekday1 ?? null,
        fee_weekday_2: feeWeekday2 ?? null,
        fee_weekend_1: feeWeekend1 ?? null,
        fee_weekend_2: feeWeekend2 ?? null,
        fee_mixed_2: feeMixed2 ?? null,
      }
      result = await updateLessonProgram(editTarget.id, updateData)
    } else {
      const createData: CreateProgramInput = {
        coach_id: formData.coach_id,
        title: formData.title,
        description: formData.description || undefined,
        target_level: '전체',
        max_participants: formData.max_participants,
        session_duration_minutes: formData.session_duration_minutes,
        fee_weekday_1: feeWeekday1,
        fee_weekday_2: feeWeekday2,
        fee_weekend_1: feeWeekend1,
        fee_weekend_2: feeWeekend2,
        fee_mixed_2: feeMixed2,
      }
      result = await createLessonProgram(createData)
    }

    setSubmitting(false)

    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: editTarget ? '프로그램이 수정되었습니다.' : '프로그램이 등록되었습니다.', type: 'success' })
    setFormOpen(false)
    // 생성/수정은 서버 생성 데이터(ID, coach JOIN 등)가 필요하므로 서버 재조회
    onRefresh()
  }

  const handleStatusChange = async () => {
    if (!statusTarget) return
    const { program, next } = statusTarget
    const snapshot = localPrograms // 이 액션 직전 스냅샷 — 독립적 롤백
    // 낙관적 로컬 업데이트
    setLocalPrograms((prev) => prev.map((p) => p.id === program.id ? { ...p, status: next } : p))
    setStatusTarget(null)
    const result = await updateProgramStatus(program.id, next)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      setLocalPrograms(snapshot) // 이 액션만 롤백
      return
    }
    setToast({ isOpen: true, message: '상태가 변경되었습니다.', type: 'success' })
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    const snapshot = localPrograms // 이 액션 직전 스냅샷 — 독립적 롤백
    // 낙관적 로컬 제거
    setLocalPrograms((prev) => prev.filter((p) => p.id !== targetId))
    setDeleteTarget(null)
    const result = await deleteLessonProgram(targetId)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      setLocalPrograms(snapshot) // 이 액션만 롤백
      return
    }
    setToast({ isOpen: true, message: '프로그램이 삭제되었습니다.', type: 'success' })
  }

  if (loading) {
    return (
      <div className="space-y-3 animate-pulse">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg font-medium"
          style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}
        >
          <Plus className="w-4 h-4" />
          프로그램 등록
        </button>
      </div>

      {/* 코치별 필터 탭 */}
      {coachTabs.length > 1 && (
        <div className="flex gap-2 mb-4 overflow-x-auto" role="tablist" aria-label="코치별 필터">
          <button
            role="tab"
            aria-selected={selectedCoachId === ALL_COACH_TAB}
            onClick={() => setSelectedCoachId(ALL_COACH_TAB)}
            className="px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
            style={{
              backgroundColor: selectedCoachId === ALL_COACH_TAB ? 'var(--accent-color)' : 'var(--bg-card)',
              color: selectedCoachId === ALL_COACH_TAB ? 'var(--bg-primary)' : 'var(--text-secondary)',
              border: `1px solid ${selectedCoachId === ALL_COACH_TAB ? 'var(--accent-color)' : 'var(--border-color)'}`,
            }}
          >
            전체
          </button>
          {coachTabs.map((coach) => {
            const isActive = selectedCoachId === coach.id
            return (
              <button
                key={coach.id}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCoachId(coach.id)}
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? 'var(--accent-color)' : 'var(--bg-card)',
                  color: isActive ? 'var(--bg-primary)' : 'var(--text-secondary)',
                  border: `1px solid ${isActive ? 'var(--accent-color)' : 'var(--border-color)'}`,
                }}
              >
                {coach.name}
              </button>
            )
          })}
        </div>
      )}

      {filteredPrograms.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          {selectedCoachId === ALL_COACH_TAB ? '등록된 프로그램이 없습니다.' : '해당 코치의 프로그램이 없습니다.'}
        </p>
      ) : (
        <div className="space-y-3">
          {filteredPrograms.map((program) => {
            const statusConf = STATUS_CONFIG[program.status]
            const transitions = STATUS_TRANSITIONS[program.status]
            return (
              <div
                key={program.id}
                className="rounded-xl p-4"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>
                        {program.title}
                      </span>
                      <Badge variant={statusConf.variant}>{statusConf.label}</Badge>
                    </div>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      코치: {program.coach?.name || '-'} · 정원: {program.max_participants}명 · {program.session_duration_minutes}분
                    </p>
                    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                      {[
                        program.fee_weekday_1 ? `주중1회 ${program.fee_weekday_1.toLocaleString()}원` : null,
                        program.fee_weekday_2 ? `주중2회 ${program.fee_weekday_2.toLocaleString()}원` : null,
                        program.fee_weekend_1 ? `주말1회 ${program.fee_weekend_1.toLocaleString()}원` : null,
                        program.fee_weekend_2 ? `주말2회 ${program.fee_weekend_2.toLocaleString()}원` : null,
                      ].filter(Boolean).join(' · ') || '요금 미설정'}
                    </p>
                  </div>
                  <div className="flex flex-col md:flex-row md:flex-wrap md:items-center gap-1.5 shrink-0 items-end">
                    {/* 노출 토글 */}
                    <button
                      type="button"
                      onClick={async () => {
                        const newVisible = !program.is_visible
                        const snapshot = localPrograms // 이 액션 직전 스냅샷
                        // 낙관적 로컬 업데이트
                        setLocalPrograms((prev) => prev.map((p) => p.id === program.id ? { ...p, is_visible: newVisible } : p))
                        const result = await updateLessonProgram(program.id, { is_visible: newVisible })
                        if (result.error) {
                          setAlert({ isOpen: true, message: result.error, type: 'error' })
                          setLocalPrograms(snapshot) // 이 액션만 롤백
                        } else {
                          setToast({ isOpen: true, message: newVisible ? '프론트에 노출했습니다.' : '프론트에서 숨겼습니다.', type: 'success' })
                        }
                      }}
                      className="inline-flex items-center justify-center gap-1 text-sm px-3 py-1.5 rounded-md min-w-[72px]"
                      style={{
                        backgroundColor: program.is_visible ? 'var(--bg-card-hover)' : 'var(--color-warning-subtle, #fef3c7)',
                        color: program.is_visible ? 'var(--accent-color)' : 'var(--color-warning)',
                      }}
                      title={program.is_visible ? '클릭하면 프론트에서 숨김' : '클릭하면 프론트에 노출'}
                    >
                      {program.is_visible
                        ? <><Eye className="w-3 h-3" /> 노출 중</>
                        : <><EyeOff className="w-3 h-3" /> 숨김</>
                      }
                    </button>
                    <button
                      onClick={() => openEdit(program)}
                      className="text-sm px-3 py-1.5 rounded-md min-w-[52px] text-center"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                    >
                      수정
                    </button>
                    {transitions.map((next) => (
                      <button
                        key={next}
                        onClick={() => setStatusTarget({ program, next })}
                        className="text-sm px-3 py-1.5 rounded-md min-w-[100px] text-center"
                        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                      >
                        {STATUS_CONFIG[next].label}으로 변경
                      </button>
                    ))}
                    <button
                      onClick={() => setDeleteTarget(program)}
                      className="text-sm px-3 py-1.5 rounded-md min-w-[52px] text-center"
                      style={{ backgroundColor: 'var(--color-danger-subtle, #fee2e2)', color: 'var(--color-danger)' }}
                    >
                      삭제
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 프로그램 등록/수정 모달 */}
      <Modal
        isOpen={formOpen}
        onClose={() => setFormOpen(false)}
        title={editTarget ? '프로그램 수정' : '프로그램 등록'}
        size="lg"
      >
        <Modal.Body>
          <form id="program-form" onSubmit={handleSubmit} noValidate>
            <div className="space-y-4">
              {/* 코치 선택 */}
              <div>
                <label htmlFor="prog-coach" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  코치 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <select
                  id="prog-coach"
                  value={formData.coach_id}
                  onChange={(e) => setFormData({ ...formData, coach_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                >
                  <option value="">코치를 선택하세요</option>
                  {coaches.filter((c) => c.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name} 코치</option>
                  ))}
                </select>
              </div>

              {/* 제목 */}
              <div>
                <label htmlFor="prog-title" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  제목 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <input
                  id="prog-title"
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="레슨 프로그램 제목"
                  maxLength={100}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* 정원 */}
              <div>
                <label htmlFor="prog-max" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  정원
                </label>
                <input
                  id="prog-max"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.max_participants}
                  onChange={(e) => setFormData({ ...formData, max_participants: Number(e.target.value) })}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>

              {/* 레슨 시간 */}
              <div>
                <label htmlFor="prog-duration" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  레슨 시간 <span style={{ color: 'var(--color-danger)' }}>*</span>
                </label>
                <div className="flex gap-2 flex-wrap">
                  {DURATION_OPTIONS.map((min) => (
                    <button
                      key={min}
                      type="button"
                      onClick={() => setFormData({ ...formData, session_duration_minutes: min })}
                      className="px-3 py-2 rounded-lg text-sm font-medium"
                      style={{
                        backgroundColor: formData.session_duration_minutes === min ? 'var(--accent-color)' : 'var(--bg-card-hover)',
                        color: formData.session_duration_minutes === min ? 'var(--bg-primary)' : 'var(--text-primary)',
                      }}
                    >
                      {min}분
                    </button>
                  ))}
                </div>
              </div>

              {/* 수강료 */}
              <div>
                <p className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  수강료 <span className="font-normal text-sm ml-1" style={{ color: 'var(--text-muted)' }}>(월 요금 · 빈칸은 미설정)</span>
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { key: 'fee_weekday_1', label: '주중 1회' },
                    { key: 'fee_weekday_2', label: '주중 2회' },
                    { key: 'fee_weekend_1', label: '주말 1회' },
                    { key: 'fee_weekend_2', label: '주말 2회' },
                  ] as const).map(({ key, label }) => (
                    <div key={key}>
                      <label htmlFor={`prog-${key}`} className="block text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </label>
                      <div className="relative">
                        <input
                          id={`prog-${key}`}
                          type="number"
                          min={0}
                          step={1000}
                          value={formData[key]}
                          onChange={(e) => setFormData({ ...formData, [key]: e.target.value })}
                          placeholder="0"
                          className="w-full px-3 py-2 pr-8 rounded-lg text-sm"
                          style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm pointer-events-none" style={{ color: 'var(--text-muted)' }}>원</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 설명 */}
              <div>
                <label htmlFor="prog-desc" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  프로그램 설명
                </label>
                <textarea
                  id="prog-desc"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="프로그램 상세 설명"
                  rows={3}
                  maxLength={1000}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
              </div>
            </div>
          </form>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setFormOpen(false)}
            className="flex-1 px-4 py-2 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          >
            취소
          </button>
          <button
            type="submit"
            form="program-form"
            disabled={submitting}
            className="flex-1 btn-primary"
          >
            {submitting ? '처리 중...' : editTarget ? '수정하기' : '등록하기'}
          </button>
        </Modal.Footer>
      </Modal>

      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        title="상태 변경"
        message={statusTarget ? `"${statusTarget.program.title}"을 ${STATUS_CONFIG[statusTarget.next].label} 상태로 변경하시겠습니까?` : ''}
        type="warning"
      />

      <ConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="프로그램 삭제"
        message={deleteTarget ? `"${deleteTarget.title}" 프로그램을 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.` : ''}
        type="error"
      />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
