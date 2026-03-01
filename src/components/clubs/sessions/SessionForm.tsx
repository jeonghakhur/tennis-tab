'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Modal } from '@/components/common/Modal'
import { AlertDialog } from '@/components/common/AlertDialog'
import { createClubSession, updateClubSession } from '@/lib/clubs/session-actions'
import type { CreateSessionInput, ClubSession } from '@/lib/clubs/types'
import SessionDatePicker from './SessionDatePicker'

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

// 공통 input 스타일 (모든 필드 동일 높이/패딩)
const fieldStyle = {
  backgroundColor: 'var(--bg-input)',
  color: 'var(--text-primary)',
  border: '1px solid var(--border-color)',
}

const inputCls = 'w-full h-11 px-3 rounded-lg text-sm outline-none focus:ring-1 focus:ring-[var(--accent-color)] box-border'
const labelCls = 'block text-xs font-medium mb-1.5'

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
      setForm(sessionToForm(session))
    } else {
      const loadLast = async () => {
        try {
          const { getClubSessions } = await import('@/lib/clubs/session-actions')
          const sessions = await getClubSessions(clubId, { limit: 10 })
          const last = sessions.find(s => s.status === 'COMPLETED' || s.status === 'OPEN')
          setForm(last ? {
            ...INITIAL_FORM,
            venue_name: last.venue_name,
            court_numbers_text: last.court_numbers.join(', '),
            start_time: last.start_time.slice(0, 5),
            end_time: last.end_time.slice(0, 5),
            max_attendees: last.max_attendees?.toString() ?? '',
          } : INITIAL_FORM)
        } catch { setForm(INITIAL_FORM) }
      }
      loadLast()
    }
  }, [isOpen, session, clubId])

  const handleChange = useCallback(
    (field: keyof FormState) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value })),
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

    const courtNumbers = form.court_numbers_text.split(',').map(s => s.trim()).filter(Boolean)
    const rsvpDeadline = form.rsvp_deadline_date && form.rsvp_deadline_time
      ? `${form.rsvp_deadline_date}T${form.rsvp_deadline_time}:00`
      : undefined

    const payload = {
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

    const result = isEditMode && session
      ? await updateClubSession(session.id, payload)
      : await createClubSession({ club_id: clubId, ...payload } as CreateSessionInput)

    setSaving(false)
    if (result.error) { setAlert({ isOpen: true, message: result.error, type: 'error' }); return }
    onCreated()
    onClose()
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={isEditMode ? '모임 수정' : '모임 생성'} size="lg">
        <form onSubmit={handleSubmit} noValidate>
          <Modal.Body>
            <div className="space-y-4">

              {/* 제목 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>제목 *</label>
                <input
                  ref={el => { fieldRefs.current.title = el }}
                  value={form.title} onChange={handleChange('title')}
                  className={inputCls} style={fieldStyle}
                  placeholder="예: 3월 정기 모임"
                />
              </div>

              {/* 날짜 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>날짜 *</label>
                <SessionDatePicker
                  value={form.session_date}
                  onChange={(v) => setForm(prev => ({ ...prev, session_date: v }))}
                  placeholder="날짜를 선택하세요"
                />
              </div>

              {/* 시간 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>시간 *</label>
                <div className="flex items-center gap-2">
                  <input
                    ref={el => { fieldRefs.current.start_time = el }}
                    type="time" value={form.start_time} onChange={handleChange('start_time')}
                    className={`${inputCls} flex-1`} style={fieldStyle}
                  />
                  <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>~</span>
                  <input
                    ref={el => { fieldRefs.current.end_time = el }}
                    type="time" value={form.end_time} onChange={handleChange('end_time')}
                    className={`${inputCls} flex-1`} style={fieldStyle}
                  />
                </div>
              </div>

              {/* 코트장 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>코트장 *</label>
                <input
                  ref={el => { fieldRefs.current.venue_name = el }}
                  value={form.venue_name} onChange={handleChange('venue_name')}
                  className={inputCls} style={fieldStyle}
                  placeholder="예: 잠실 테니스장"
                />
              </div>

              {/* 사용 코트 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  사용 코트 <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(쉼표 구분)</span>
                </label>
                <input
                  value={form.court_numbers_text} onChange={handleChange('court_numbers_text')}
                  className={inputCls} style={fieldStyle}
                  placeholder="예: 1번, 2번"
                />
              </div>

              {/* 정원 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  정원 <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(선택)</span>
                </label>
                <input
                  type="number" value={form.max_attendees} onChange={handleChange('max_attendees')}
                  className={inputCls} style={fieldStyle}
                  placeholder="미입력 시 제한 없음" min={2}
                />
              </div>

              {/* 응답 마감 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  응답 마감 <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(선택)</span>
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1">
                    <SessionDatePicker
                      value={form.rsvp_deadline_date}
                      onChange={(v) => setForm(prev => ({ ...prev, rsvp_deadline_date: v }))}
                      placeholder="날짜 선택"
                    />
                  </div>
                  <span className="text-sm shrink-0" style={{ color: 'var(--text-muted)' }}>~</span>
                  <input
                    type="time" value={form.rsvp_deadline_time} onChange={handleChange('rsvp_deadline_time')}
                    className={`${inputCls} flex-1`} style={fieldStyle}
                  />
                </div>
              </div>

              {/* 메모 */}
              <div>
                <label className={labelCls} style={{ color: 'var(--text-secondary)' }}>
                  메모 <span style={{ color: 'var(--text-muted)', fontWeight: 'normal' }}>(선택)</span>
                </label>
                <textarea
                  value={form.notes} onChange={handleChange('notes')}
                  rows={2} placeholder="참고 사항을 적어주세요"
                  className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none box-border focus:ring-1 focus:ring-[var(--accent-color)]"
                  style={fieldStyle}
                />
              </div>

            </div>
          </Modal.Body>

          <Modal.Footer>
            <button type="button" onClick={onClose}
              className="flex-1 h-11 rounded-lg text-sm border"
              style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', borderColor: 'var(--border-color)' }}>
              취소
            </button>
            <button type="submit" disabled={saving}
              className="flex-1 h-11 rounded-lg text-sm font-semibold disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent-color)', color: 'var(--bg-primary)' }}>
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
