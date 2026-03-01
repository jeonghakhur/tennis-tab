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
  // 수정 모드: session 전달 시 수정, 없으면 생성
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

function sessionToForm(session: ClubSession): FormState {
  const rsvp = session.rsvp_deadline ? new Date(session.rsvp_deadline) : null
  return {
    title: session.title,
    venue_name: session.venue_name,
    court_numbers_text: session.court_numbers.join(', '),
    session_date: session.session_date,
    start_time: session.start_time.slice(0, 5),
    end_time: session.end_time.slice(0, 5),
    max_attendees: session.max_attendees?.toString() ?? '',
    rsvp_deadline_date: rsvp ? rsvp.toISOString().slice(0, 10) : '',
    rsvp_deadline_time: rsvp ? `${String(rsvp.getHours()).padStart(2,'0')}:${String(rsvp.getMinutes()).padStart(2,'0')}` : '',
    notes: session.notes ?? '',
  }
}

export default function SessionForm({ clubId, isOpen, onClose, onCreated, session }: SessionFormProps) {
  const isEditMode = !!session
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [saving, setSaving] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const errorFieldRef = useRef<string | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // 수정 모드일 때 폼 초기화
  useEffect(() => {
    if (isOpen) {
      setForm(session ? sessionToForm(session) : INITIAL_FORM)
    }
  }, [isOpen, session])

  const handleChange = useCallback(
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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
    'w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) outline-none focus:border-(--accent-color)'

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? '모임 수정' : '모임 생성'} size="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-4">
              <div>
                <label htmlFor="session-title" className="block text-sm font-medium text-(--text-secondary) mb-1">제목 *</label>
                <input id="session-title" ref={(el) => { fieldRefs.current.title = el }}
                  value={form.title} onChange={handleChange('title')}
                  className={inputClass} placeholder="예: 3월 정기 모임" />
              </div>
              <div>
                <label htmlFor="session-venue" className="block text-sm font-medium text-(--text-secondary) mb-1">코트장 *</label>
                <input id="session-venue" ref={(el) => { fieldRefs.current.venue_name = el }}
                  value={form.venue_name} onChange={handleChange('venue_name')}
                  className={inputClass} placeholder="예: 잠실 테니스장" />
              </div>
              <div>
                <label htmlFor="session-courts" className="block text-sm font-medium text-(--text-secondary) mb-1">사용 코트 (쉼표 구분)</label>
                <input id="session-courts" value={form.court_numbers_text} onChange={handleChange('court_numbers_text')}
                  className={inputClass} placeholder="예: 1번, 2번, 3번" />
              </div>
              <div>
                <label htmlFor="session-date" className="block text-sm font-medium text-(--text-secondary) mb-1">날짜 *</label>
                <input id="session-date" ref={(el) => { fieldRefs.current.session_date = el }}
                  type="date" value={form.session_date} onChange={handleChange('session_date')} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="session-start" className="block text-sm font-medium text-(--text-secondary) mb-1">시작 시간 *</label>
                  <input id="session-start" ref={(el) => { fieldRefs.current.start_time = el }}
                    type="time" value={form.start_time} onChange={handleChange('start_time')} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="session-end" className="block text-sm font-medium text-(--text-secondary) mb-1">종료 시간 *</label>
                  <input id="session-end" ref={(el) => { fieldRefs.current.end_time = el }}
                    type="time" value={form.end_time} onChange={handleChange('end_time')} className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="session-max" className="block text-sm font-medium text-(--text-secondary) mb-1">정원 (선택)</label>
                <input id="session-max" type="number" value={form.max_attendees} onChange={handleChange('max_attendees')}
                  className={inputClass} placeholder="미입력 시 제한 없음" min={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="session-rsvp-date" className="block text-sm font-medium text-(--text-secondary) mb-1">응답 마감일 (선택)</label>
                  <input id="session-rsvp-date" type="date" value={form.rsvp_deadline_date}
                    onChange={handleChange('rsvp_deadline_date')} className={inputClass} />
                </div>
                <div>
                  <label htmlFor="session-rsvp-time" className="block text-sm font-medium text-(--text-secondary) mb-1">마감 시간</label>
                  <input id="session-rsvp-time" type="time" value={form.rsvp_deadline_time}
                    onChange={handleChange('rsvp_deadline_time')} className={inputClass} />
                </div>
              </div>
              <div>
                <label htmlFor="session-notes" className="block text-sm font-medium text-(--text-secondary) mb-1">메모 (선택)</label>
                <textarea id="session-notes" value={form.notes} onChange={handleChange('notes')}
                  className={`${inputClass} resize-none`} rows={3} placeholder="참고 사항을 적어주세요" />
              </div>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg bg-(--bg-secondary) text-(--text-primary) border border-(--border-color)">
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-(--accent-color) text-(--bg-primary) font-semibold disabled:opacity-50">
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
