'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { createClubSession, updateClubSession } from '@/lib/clubs/session-actions'
import type { CreateSessionInput, ClubSession } from '@/lib/clubs/types'

interface SessionFormProps {
  clubId: string
  isOpen: boolean
  onClose: () => void
  onCreated: () => void
  session?: ClubSession
}

interface FormState {
  title: string
  venue_name: string
  court_numbers_text: string
  session_date: string
  start_time: string
  end_time: string
  max_attendees: string
  rsvp_deadline_date: string
  rsvp_deadline_time: string
  notes: string
}

const INITIAL_FORM: FormState = {
  title: '',
  venue_name: '',
  court_numbers_text: '',
  session_date: '',
  start_time: '09:00',
  end_time: '12:00',
  max_attendees: '',
  rsvp_deadline_date: '',
  rsvp_deadline_time: '',
  notes: '',
}

function sessionToForm(s: ClubSession): FormState {
  const rsvp = s.rsvp_deadline ? new Date(s.rsvp_deadline) : null
  return {
    title: s.title,
    venue_name: s.venue_name,
    court_numbers_text: s.court_numbers.join(', '),
    session_date: s.session_date,
    start_time: s.start_time.slice(0, 5),
    end_time: s.end_time.slice(0, 5),
    max_attendees: s.max_attendees?.toString() ?? '',
    rsvp_deadline_date: rsvp ? rsvp.toISOString().slice(0, 10) : '',
    rsvp_deadline_time: rsvp
      ? `${String(rsvp.getHours()).padStart(2, '0')}:${String(rsvp.getMinutes()).padStart(2, '0')}`
      : '',
    notes: s.notes ?? '',
  }
}

export default function SessionForm({ clubId, isOpen, onClose, onCreated, session }: SessionFormProps) {
  const isEditMode = !!session
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const errorFieldRef = useRef<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  useEffect(() => {
    if (!isOpen) return

    if (session) {
      // 수정 모드: 기존 데이터로 채우기
      setForm(sessionToForm(session))
    } else {
      // 생성 모드: 마지막 모임 데이터로 장소/시간 기본값 채우기
      const loadLast = async () => {
        try {
          const { getClubSessions } = await import('@/lib/clubs/session-actions')
          const sessions = await getClubSessions(clubId, { limit: 10 })
          const last = sessions.find(s => s.status === 'COMPLETED' || s.status === 'OPEN')
          if (last) {
            setForm({
              ...INITIAL_FORM,
              venue_name: last.venue_name,
              court_numbers_text: last.court_numbers.join(', '),
              start_time: last.start_time.slice(0, 5),
              end_time: last.end_time.slice(0, 5),
              max_attendees: last.max_attendees?.toString() ?? '',
            })
          } else {
            setForm(INITIAL_FORM)
          }
        } catch {
          setForm(INITIAL_FORM)
        }
      }
      loadLast()
    }
  }, [isOpen, session, clubId])

  const handleChange = useCallback(
    (field: keyof FormState) =>
      (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        setForm((prev) => ({ ...prev, [field]: e.target.value }))
      },
    []
  )

  const validate = useCallback((): boolean => {
    const checks: [string, string, boolean][] = [
      ['title', '제목을 입력해주세요.', !form.title.trim()],
      ['venue_name', '코트장 이름을 입력해주세요.', !form.venue_name.trim()],
      ['session_date', '날짜를 선택해주세요.', !form.session_date],
      ['start_time', '시작 시간을 입력해주세요.', !form.start_time],
      ['end_time', '종료 시간을 입력해주세요.', !form.end_time],
      ['end_time', '종료 시간은 시작 시간 이후여야 합니다.', form.start_time >= form.end_time],
    ]
    for (const [field, message, condition] of checks) {
      if (condition) {
        errorFieldRef.current = field
        setAlert({ isOpen: true, message, type: 'error' })
        return false
      }
    }
    return true
  }, [form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)

    const courtNumbers = form.court_numbers_text
      .split(',').map((s) => s.trim()).filter(Boolean)

    let rsvpDeadline: string | undefined
    if (form.rsvp_deadline_date && form.rsvp_deadline_time) {
      rsvpDeadline = `${form.rsvp_deadline_date}T${form.rsvp_deadline_time}:00`
    }

    let result: { error?: string }

    if (isEditMode && session) {
      result = await updateClubSession(session.id, {
        title: form.title.trim(),
        venue_name: form.venue_name.trim(),
        court_numbers: courtNumbers,
        session_date: form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        max_attendees: form.max_attendees ? Number(form.max_attendees) : undefined,
        rsvp_deadline: rsvpDeadline,
        notes: form.notes.trim() || undefined,
      })
    } else {
      const input: CreateSessionInput = {
        club_id: clubId,
        title: form.title.trim(),
        venue_name: form.venue_name.trim(),
        court_numbers: courtNumbers,
        session_date: form.session_date,
        start_time: form.start_time,
        end_time: form.end_time,
        max_attendees: form.max_attendees ? Number(form.max_attendees) : undefined,
        rsvp_deadline: rsvpDeadline,
        notes: form.notes.trim() || undefined,
      }
      result = await createClubSession(input)
    }

    setSaving(false)
    if (result.error) {
      setAlert({ isOpen: true, message: result.error, type: 'error' })
      return
    }
    onCreated()
    onClose()
  }

  const inputClass =
    'w-full max-w-full box-border px-3 py-2.5 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color) text-sm'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? '모임 수정' : '모임 생성'} size="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-3">

              {/* 제목 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">제목 *</label>
                <input
                  ref={(el) => { fieldRefs.current.title = el }}
                  value={form.title} onChange={handleChange('title')}
                  className={inputClass} placeholder="예: 3월 정기 모임"
                />
              </div>

              {/* 날짜 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">날짜 *</label>
                <input
                  ref={(el) => { fieldRefs.current.session_date = el }}
                  type="date" value={form.session_date} onChange={handleChange('session_date')}
                  className={inputClass}
                />
              </div>

              {/* 시작/종료 시간: 한 라벨 아래 가로 배치 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">시간 *</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={(el) => { fieldRefs.current.start_time = el }}
                    type="time" value={form.start_time} onChange={handleChange('start_time')}
                    className={`${inputClass} flex-1 min-w-0`}
                  />
                  <span className="text-(--text-muted) text-sm shrink-0">~</span>
                  <input
                    ref={(el) => { fieldRefs.current.end_time = el }}
                    type="time" value={form.end_time} onChange={handleChange('end_time')}
                    className={`${inputClass} flex-1 min-w-0`}
                  />
                </div>
              </div>

              {/* 코트장 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">코트장 *</label>
                <input
                  ref={(el) => { fieldRefs.current.venue_name = el }}
                  value={form.venue_name} onChange={handleChange('venue_name')}
                  className={inputClass} placeholder="예: 잠실 테니스장"
                />
              </div>

              {/* 사용 코트 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">사용 코트 <span className="font-normal opacity-60">(쉼표 구분)</span></label>
                <input
                  value={form.court_numbers_text} onChange={handleChange('court_numbers_text')}
                  className={inputClass} placeholder="예: 1번, 2번"
                />
              </div>

              {/* 정원 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">정원 <span className="font-normal opacity-60">(선택)</span></label>
                <input
                  type="number" value={form.max_attendees} onChange={handleChange('max_attendees')}
                  className={inputClass} placeholder="미입력 시 제한 없음" min={2}
                />
              </div>

              {/* 응답 마감 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">응답 마감 <span className="font-normal opacity-60">(선택)</span></label>
                <div className="space-y-2">
                  <input
                    type="date" value={form.rsvp_deadline_date}
                    onChange={handleChange('rsvp_deadline_date')}
                    className={inputClass}
                  />
                  <input
                    type="time" value={form.rsvp_deadline_time}
                    onChange={handleChange('rsvp_deadline_time')}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className="block text-xs font-medium text-(--text-secondary) mb-1">메모 <span className="font-normal opacity-60">(선택)</span></label>
                <textarea
                  value={form.notes} onChange={handleChange('notes')}
                  className={`${inputClass} resize-none`} rows={2}
                  placeholder="참고 사항을 적어주세요"
                />
              </div>

            </div>
          </Modal.Body>

          <Modal.Footer>
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg bg-(--bg-secondary) text-(--text-primary) border border-(--border-color) text-sm">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2.5 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold text-sm disabled:opacity-50">
              {saving ? (isEditMode ? '수정 중...' : '생성 중...') : (isEditMode ? '수정' : '생성')}
            </button>
          </Modal.Footer>
        </form>
      </Modal>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert({ ...alert, isOpen: false })
          const key = errorFieldRef.current
          if (key) { fieldRefs.current[key]?.focus(); errorFieldRef.current = null }
        }}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
