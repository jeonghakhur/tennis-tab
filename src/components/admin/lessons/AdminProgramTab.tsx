'use client'

import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import {
  createLessonProgram,
  updateLessonProgram,
  updateProgramStatus,
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
  DRAFT: ['OPEN', 'CANCELLED'],
  OPEN: ['CLOSED', 'CANCELLED'],
  CLOSED: ['OPEN', 'CANCELLED'],
  CANCELLED: [],
}

interface AdminProgramTabProps {
  programs: LessonProgram[]
  loading: boolean
  onRefresh: () => void
}

interface ProgramFormData {
  coach_id: string
  title: string
  description: string
  target_level: string
  max_participants: number
  fee_description: string
}

const EMPTY_FORM: ProgramFormData = {
  coach_id: '',
  title: '',
  description: '',
  target_level: '전체',
  max_participants: 1,
  fee_description: '',
}

const TARGET_LEVELS = ['입문', '초급', '중급', '고급', '전체']

export function AdminProgramTab({ programs, loading, onRefresh }: AdminProgramTabProps) {
  const [coaches, setCoaches] = useState<Coach[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [editTarget, setEditTarget] = useState<LessonProgram | null>(null)
  const [formData, setFormData] = useState<ProgramFormData>(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [statusTarget, setStatusTarget] = useState<{ program: LessonProgram; next: LessonProgramStatus } | null>(null)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  useEffect(() => {
    getAllCoaches().then(({ data }) => setCoaches(data))
  }, [])

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
      target_level: program.target_level,
      max_participants: program.max_participants,
      fee_description: program.fee_description || '',
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

    if (editTarget) {
      const updateData: UpdateProgramInput = {
        coach_id: formData.coach_id,
        title: formData.title,
        description: formData.description || undefined,
        target_level: formData.target_level,
        max_participants: formData.max_participants,
        fee_description: formData.fee_description || undefined,
      }
      result = await updateLessonProgram(editTarget.id, updateData)
    } else {
      const createData: CreateProgramInput = {
        coach_id: formData.coach_id,
        title: formData.title,
        description: formData.description || undefined,
        target_level: formData.target_level,
        max_participants: formData.max_participants,
        fee_description: formData.fee_description || undefined,
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
    onRefresh()
  }

  const handleStatusChange = async () => {
    if (!statusTarget) return
    const result = await updateProgramStatus(statusTarget.program.id, statusTarget.next)
    setStatusTarget(null)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    setToast({ isOpen: true, message: '상태가 변경되었습니다.', type: 'success' })
    onRefresh()
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

      {programs.length === 0 ? (
        <p className="text-center py-12 text-sm" style={{ color: 'var(--text-muted)' }}>
          등록된 프로그램이 없습니다.
        </p>
      ) : (
        <div className="space-y-3">
          {programs.map((program) => {
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
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      코치: {program.coach?.name || '-'} · 대상: {program.target_level} · 정원: {program.max_participants}명
                    </p>
                    {program.fee_description && (
                      <p className="text-xs mt-1 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>
                        {program.fee_description}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => openEdit(program)}
                      className="text-xs px-2 py-1 rounded-md"
                      style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                    >
                      수정
                    </button>
                    {transitions.map((next) => (
                      <button
                        key={next}
                        onClick={() => setStatusTarget({ program, next })}
                        className="text-xs px-2 py-1 rounded-md"
                        style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}
                      >
                        {STATUS_CONFIG[next].label}으로 변경
                      </button>
                    ))}
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
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
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

              {/* 대상 + 정원 */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="prog-level" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                    대상
                  </label>
                  <select
                    id="prog-level"
                    value={formData.target_level}
                    onChange={(e) => setFormData({ ...formData, target_level: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                  >
                    {TARGET_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
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
              </div>

              {/* 수강료 */}
              <div>
                <label htmlFor="prog-fee" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                  수강료 안내
                </label>
                <textarea
                  id="prog-fee"
                  value={formData.fee_description}
                  onChange={(e) => setFormData({ ...formData, fee_description: e.target.value })}
                  placeholder="예: 주1회 100,000원 / 주2회 200,000원"
                  rows={2}
                  maxLength={500}
                  className="w-full px-3 py-2 rounded-lg text-sm resize-none"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                />
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
              disabled={submitting}
              className="flex-1 btn-primary"
            >
              {submitting ? '처리 중...' : editTarget ? '수정하기' : '등록하기'}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleStatusChange}
        title="상태 변경"
        message={statusTarget ? `"${statusTarget.program.title}"을 ${STATUS_CONFIG[statusTarget.next].label} 상태로 변경하시겠습니까?` : ''}
        type="warning"
      />

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title="오류" message={alert.message} type={alert.type} />
    </div>
  )
}
