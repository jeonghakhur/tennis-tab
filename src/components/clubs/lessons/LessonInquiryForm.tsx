'use client'

import { useState, useCallback, useRef } from 'react'
import { MessageCircle, Calendar } from 'lucide-react'
import { submitLessonInquiry } from '@/lib/lessons/actions'
import { AlertDialog, Toast } from '@/components/common/AlertDialog'
import {
  validateLessonInquiryInput,
  hasValidationErrors,
  type LessonInquiryValidationErrors,
} from '@/lib/utils/validation'
import type { LessonSession } from '@/lib/lessons/types'

interface LessonInquiryFormProps {
  programId: string
  /** 신청 가능한 세션 슬롯 목록 */
  availableSessions?: LessonSession[]
}

const FIELD_ORDER: (keyof LessonInquiryValidationErrors)[] = ['name', 'phone', 'message']

/** 날짜 + 시간 포맷 */
function formatSessionSlot(session: LessonSession): string {
  const date = new Date(session.session_date)
  const dateStr = date.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })
  const start = session.start_time.slice(0, 5)
  const end = session.end_time.slice(0, 5)
  return `${dateStr} ${start}~${end}`
}

export function LessonInquiryForm({ programId, availableSessions = [] }: LessonInquiryFormProps) {
  const [form, setForm] = useState({ name: '', phone: '', message: '' })
  const [preferredSessionId, setPreferredSessionId] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })

  const errorFieldRef = useRef<keyof LessonInquiryValidationErrors | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // SCHEDULED 상태인 슬롯만 표시
  const openSlots = availableSessions.filter((s) => s.status === 'SCHEDULED')

  const validateForm = useCallback((): boolean => {
    const errors = validateLessonInquiryInput(form)
    if (!hasValidationErrors(errors)) {
      setFieldErrors({})
      return true
    }
    for (const field of FIELD_ORDER) {
      if (errors[field]) {
        errorFieldRef.current = field
        setFieldErrors({ [field]: errors[field] })
        setAlert({ isOpen: true, message: errors[field]!, type: 'error' })
        return false
      }
    }
    return true
  }, [form])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setLoading(true)
    const { error } = await submitLessonInquiry(programId, {
      ...form,
      preferred_session_id: preferredSessionId,
    })
    setLoading(false)

    if (error) {
      setAlert({ isOpen: true, message: error, type: 'error' })
      return
    }

    setToast({ isOpen: true, message: '문의가 접수되었습니다. 담당자가 확인 후 연락드립니다.', type: 'success' })
    setForm({ name: '', phone: '', message: '' })
    setPreferredSessionId(null)
    setFieldErrors({})
  }

  const inputStyle = (field: string) => ({
    backgroundColor: 'var(--bg-secondary)',
    color: 'var(--text-primary)',
    borderColor: fieldErrors[field] ? 'var(--color-danger)' : 'var(--border-color)',
  })

  return (
    <section
      className="glass-card rounded-xl p-4"
      aria-labelledby="inquiry-section-title"
    >
      <h2
        id="inquiry-section-title"
        className="text-sm font-medium mb-3 flex items-center gap-1.5"
        style={{ color: 'var(--text-primary)' }}
      >
        <MessageCircle className="w-4 h-4" style={{ color: 'var(--accent-color)' }} />
        레슨 문의하기
      </h2>
      <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        궁금한 점이 있으시면 문의해주세요. 담당자가 확인 후 연락드립니다.
      </p>

      <form onSubmit={handleSubmit} noValidate className="space-y-3">
        {/* 희망 일정 선택 — 슬롯이 있을 때만 표시 */}
        {openSlots.length > 0 && (
          <fieldset>
            <legend
              className="block text-xs font-medium mb-2 flex items-center gap-1"
              style={{ color: 'var(--text-secondary)' }}
            >
              <Calendar className="w-3.5 h-3.5" />
              희망 레슨 일정 <span className="font-normal" style={{ color: 'var(--text-muted)' }}>(선택)</span>
            </legend>
            <div className="space-y-1.5">
              {openSlots.map((slot) => (
                <label
                  key={slot.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer text-xs transition-colors"
                  style={{
                    backgroundColor: preferredSessionId === slot.id
                      ? 'color-mix(in srgb, var(--accent-color) 15%, transparent)'
                      : 'var(--bg-card-hover)',
                    border: `1px solid ${preferredSessionId === slot.id ? 'var(--accent-color)' : 'transparent'}`,
                    color: 'var(--text-primary)',
                  }}
                >
                  <input
                    type="radio"
                    name="preferred_session"
                    value={slot.id}
                    checked={preferredSessionId === slot.id}
                    onChange={() => setPreferredSessionId(
                      preferredSessionId === slot.id ? null : slot.id
                    )}
                    className="accent-(--accent-color)"
                  />
                  <span>{formatSessionSlot(slot)}</span>
                  {slot.location && (
                    <span style={{ color: 'var(--text-muted)' }}>· {slot.location}</span>
                  )}
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* 이름 */}
        <div>
          <label htmlFor="inquiry-name" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            이름 <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            ref={(el) => { fieldRefs.current.name = el }}
            id="inquiry-name"
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="이름을 입력해주세요"
            maxLength={50}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={inputStyle('name')}
          />
        </div>

        {/* 연락처 */}
        <div>
          <label htmlFor="inquiry-phone" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            연락처 <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <input
            ref={(el) => { fieldRefs.current.phone = el }}
            id="inquiry-phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            placeholder="01012345678"
            maxLength={20}
            className="w-full px-3 py-2 rounded-lg border text-sm"
            style={inputStyle('phone')}
          />
        </div>

        {/* 문의 내용 */}
        <div>
          <label htmlFor="inquiry-message" className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
            문의 내용 <span style={{ color: 'var(--color-danger)' }}>*</span>
          </label>
          <textarea
            ref={(el) => { fieldRefs.current.message = el }}
            id="inquiry-message"
            value={form.message}
            onChange={(e) => setForm({ ...form, message: e.target.value })}
            placeholder="문의하실 내용을 입력해주세요"
            maxLength={1000}
            rows={4}
            className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
            style={inputStyle('message')}
          />
          <p className="text-right text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {form.message.length}/1000
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 rounded-xl text-sm font-medium"
          style={{
            backgroundColor: 'var(--accent-color)',
            color: 'var(--bg-primary)',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? '제출 중...' : '문의하기'}
        </button>
      </form>

      <AlertDialog
        isOpen={alert.isOpen}
        onClose={() => {
          setAlert({ ...alert, isOpen: false })
          const key = errorFieldRef.current
          if (key) {
            fieldRefs.current[key]?.focus()
            errorFieldRef.current = null
          }
        }}
        title="입력 오류"
        message={alert.message}
        type={alert.type}
      />
      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
    </section>
  )
}
