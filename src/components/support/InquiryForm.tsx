'use client'

import { useState, useCallback, useRef } from 'react'
import { AlertDialog } from '@/components/common/AlertDialog'
import {
  validateInquiryInput,
  hasValidationErrors,
  type InquiryValidationErrors,
} from '@/lib/utils/validation'
import {
  INQUIRY_CATEGORY_LABELS,
  type InquiryCategory,
  type CreateInquiryInput,
} from '@/lib/support/types'

interface InquiryFormProps {
  onSubmit: (data: CreateInquiryInput) => Promise<void>
  isSubmitting?: boolean
}

const FIELD_ORDER: (keyof InquiryValidationErrors)[] = ['category', 'title', 'content']

const CONTENT_MAX_LENGTH = 3000

export function InquiryForm({ onSubmit, isSubmitting = false }: InquiryFormProps) {
  const [form, setForm] = useState<CreateInquiryInput>({
    category: '' as InquiryCategory,
    title: '',
    content: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Partial<InquiryValidationErrors>>({})
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const errorFieldRef = useRef<keyof InquiryValidationErrors | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement | null>>({})

  const validateForm = useCallback((): boolean => {
    const errors = validateInquiryInput(form)
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
    await onSubmit(form)
  }

  return (
    <>
      <form onSubmit={handleSubmit} noValidate className="space-y-6">
        {/* 문의 유형 */}
        <div>
          <label
            htmlFor="inquiry-category"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            문의 유형
          </label>
          <select
            id="inquiry-category"
            ref={(el) => { fieldRefs.current.category = el }}
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value as InquiryCategory })}
            className={`w-full px-3 py-2.5 rounded-lg bg-(--bg-input) border outline-none transition-colors ${
              fieldErrors.category
                ? 'border-red-500'
                : 'border-(--border-color) focus:border-(--accent-color)'
            }`}
            style={{ color: 'var(--text-primary)' }}
          >
            <option value="">유형을 선택하세요</option>
            {(Object.entries(INQUIRY_CATEGORY_LABELS) as [InquiryCategory, string][]).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </div>

        {/* 제목 */}
        <div>
          <label
            htmlFor="inquiry-title"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            제목
          </label>
          <input
            id="inquiry-title"
            ref={(el) => { fieldRefs.current.title = el }}
            type="text"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            maxLength={100}
            placeholder="문의 제목을 입력하세요"
            className={`w-full px-3 py-2.5 rounded-lg bg-(--bg-input) border outline-none transition-colors ${
              fieldErrors.title
                ? 'border-red-500'
                : 'border-(--border-color) focus:border-(--accent-color)'
            }`}
            style={{ color: 'var(--text-primary)' }}
          />
        </div>

        {/* 내용 */}
        <div>
          <label
            htmlFor="inquiry-content"
            className="block text-sm font-medium mb-2"
            style={{ color: 'var(--text-primary)' }}
          >
            문의 내용
          </label>
          <textarea
            id="inquiry-content"
            ref={(el) => { fieldRefs.current.content = el }}
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            maxLength={CONTENT_MAX_LENGTH}
            rows={8}
            placeholder="문의 내용을 상세히 작성해주세요"
            className={`w-full px-3 py-2.5 rounded-lg bg-(--bg-input) border outline-none transition-colors resize-none ${
              fieldErrors.content
                ? 'border-red-500'
                : 'border-(--border-color) focus:border-(--accent-color)'
            }`}
            style={{ color: 'var(--text-primary)' }}
          />
          <div className="flex justify-end mt-1">
            <span
              className="text-xs"
              style={{ color: form.content.length > CONTENT_MAX_LENGTH ? 'var(--color-danger)' : 'var(--text-muted)' }}
            >
              {form.content.length}/{CONTENT_MAX_LENGTH}
            </span>
          </div>
        </div>

        {/* 제출 버튼 */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg font-medium text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ backgroundColor: 'var(--accent-color)' }}
        >
          {isSubmitting ? '접수 중...' : '문의하기'}
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
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
