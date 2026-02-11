'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createAssociation, updateAssociation } from '@/lib/associations/actions'
import type { Association, CreateAssociationInput } from '@/lib/associations/types'
import { Toast } from '@/components/common/Toast'
import { AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import {
  sanitizeInput,
  validateAssociationInput,
  hasValidationErrors,
  type AssociationValidationErrors,
} from '@/lib/utils/validation'
import {
  generateAssociationDummy,
  generateAssociationInvalidDummy,
} from '@/lib/utils/devDummy'

const isDev = process.env.NODE_ENV === 'development'

interface AssociationFormProps {
  association?: Association | null
}

export function AssociationForm({ association }: AssociationFormProps) {
  const router = useRouter()
  const isEdit = !!association

  const [form, setForm] = useState<CreateAssociationInput>({
    name: association?.name || '',
    region: association?.region || '',
    district: association?.district || '',
    description: association?.description || '',
    president_name: association?.president_name || '',
    president_phone: association?.president_phone || '',
    president_email: association?.president_email || '',
    secretary_name: association?.secretary_name || '',
    secretary_phone: association?.secretary_phone || '',
    secretary_email: association?.secretary_email || '',
  })
  const [fieldErrors, setFieldErrors] = useState<AssociationValidationErrors>({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const errorFieldRef = useRef<keyof AssociationValidationErrors | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // 필드 변경 시 sanitize + 해당 필드 에러 클리어
  const handleChange = useCallback((field: keyof CreateAssociationInput, value: string) => {
    const sanitized = sanitizeInput(value)
    setForm((prev) => ({ ...prev, [field]: sanitized }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }, [])

  // 클라이언트 순차 검증 — 필드 순서대로 첫 에러만 AlertDialog로 표시
  const FIELD_ORDER: (keyof AssociationValidationErrors)[] = [
    'name', 'region', 'district', 'description',
    'president_name', 'president_phone', 'president_email',
    'secretary_name', 'secretary_phone', 'secretary_email',
  ]

  const validateForm = useCallback((): boolean => {
    const errors = validateAssociationInput(form)
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
    try {
      const result = isEdit
        ? await updateAssociation(association!.id, form)
        : await createAssociation(form)

      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }

      setToast({
        isOpen: true,
        message: isEdit ? '협회가 수정되었습니다.' : '협회가 생성되었습니다.',
        type: 'success',
      })

      setTimeout(() => router.push('/admin/associations'), 500)
    } finally {
      setLoading(false)
    }
  }

  // DEV 전용: 랜덤 더미 데이터로 폼 채우기
  const fillDummy = () => {
    setForm(generateAssociationDummy())
    setFieldErrors({})
  }

  // DEV 전용: 잘못된 데이터로 폼 채우기 (밸리데이션 테스트)
  const fillInvalidDummy = () => {
    setForm(generateAssociationInvalidDummy())
    setFieldErrors({})
  }

  // 공통 인풋 스타일
  const inputClass = (field: keyof AssociationValidationErrors) =>
    `w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border outline-none ${
      fieldErrors[field]
        ? 'border-red-500 focus:border-red-500'
        : 'border-(--border-color) focus:border-(--accent-color)'
    }`

  return (
    <>
      {loading && <LoadingOverlay message={isEdit ? '수정 중...' : '생성 중...'} />}

      <form onSubmit={handleSubmit} noValidate className="glass-card rounded-xl p-6 space-y-5">
        {/* DEV 전용: 더미 데이터 버튼 */}
        {isDev && !isEdit && (
          <div className="flex gap-2 pb-2 border-b border-dashed border-amber-500/30">
            <button
              type="button"
              onClick={fillDummy}
              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              DEV: 정상 더미 데이터
            </button>
            <button
              type="button"
              onClick={fillInvalidDummy}
              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              DEV: 잘못된 데이터
            </button>
          </div>
        )}

        {/* 협회 이름 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            협회 이름 <span className="text-red-500">*</span>
          </label>
          <input
            ref={(el) => { fieldRefs.current.name = el }}
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="예: 마포구테니스협회"
            maxLength={50}
            className={inputClass('name')}
          />
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>
          )}
        </div>

        {/* 지역 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              시/도
            </label>
            <input
              ref={(el) => { fieldRefs.current.region = el }}
              type="text"
              value={form.region || ''}
              onChange={(e) => handleChange('region', e.target.value)}
              placeholder="예: 서울특별시"
              maxLength={100}
              className={inputClass('region')}
            />
            {fieldErrors.region && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.region}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              구/군
            </label>
            <input
              ref={(el) => { fieldRefs.current.district = el }}
              type="text"
              value={form.district || ''}
              onChange={(e) => handleChange('district', e.target.value)}
              placeholder="예: 마포구"
              maxLength={100}
              className={inputClass('district')}
            />
            {fieldErrors.district && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.district}</p>
            )}
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            협회 소개
          </label>
          <textarea
            ref={(el) => { fieldRefs.current.description = el }}
            value={form.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="협회 소개를 입력하세요"
            rows={3}
            maxLength={500}
            className={`${inputClass('description')} resize-none`}
          />
          <div className="flex justify-between mt-1">
            {fieldErrors.description ? (
              <p className="text-xs text-red-500">{fieldErrors.description}</p>
            ) : <span />}
            <p className="text-xs text-(--text-muted)">{(form.description || '').length}/500</p>
          </div>
        </div>

        {/* 협회장 정보 */}
        <div>
          <p className="text-sm font-medium text-(--text-primary) mb-3">협회장</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">이름</label>
              <input
                ref={(el) => { fieldRefs.current.president_name = el }}
                type="text"
                value={form.president_name || ''}
                onChange={(e) => handleChange('president_name', e.target.value)}
                placeholder="협회장 이름"
                maxLength={100}
                className={inputClass('president_name')}
              />
              {fieldErrors.president_name && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.president_name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">연락처</label>
                <input
                  ref={(el) => { fieldRefs.current.president_phone = el }}
                  type="tel"
                  value={form.president_phone || ''}
                  onChange={(e) => handleChange('president_phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className={inputClass('president_phone')}
                />
                {fieldErrors.president_phone && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.president_phone}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">이메일</label>
                <input
                  ref={(el) => { fieldRefs.current.president_email = el }}
                  type="email"
                  value={form.president_email || ''}
                  onChange={(e) => handleChange('president_email', e.target.value)}
                  placeholder="president@example.com"
                  className={inputClass('president_email')}
                />
                {fieldErrors.president_email && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.president_email}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 사무장 정보 */}
        <div>
          <p className="text-sm font-medium text-(--text-primary) mb-3">사무장</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">이름</label>
              <input
                ref={(el) => { fieldRefs.current.secretary_name = el }}
                type="text"
                value={form.secretary_name || ''}
                onChange={(e) => handleChange('secretary_name', e.target.value)}
                placeholder="사무장 이름"
                maxLength={100}
                className={inputClass('secretary_name')}
              />
              {fieldErrors.secretary_name && (
                <p className="mt-1 text-xs text-red-500">{fieldErrors.secretary_name}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">연락처</label>
                <input
                  ref={(el) => { fieldRefs.current.secretary_phone = el }}
                  type="tel"
                  value={form.secretary_phone || ''}
                  onChange={(e) => handleChange('secretary_phone', e.target.value)}
                  placeholder="010-0000-0000"
                  className={inputClass('secretary_phone')}
                />
                {fieldErrors.secretary_phone && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.secretary_phone}</p>
                )}
              </div>
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">이메일</label>
                <input
                  ref={(el) => { fieldRefs.current.secretary_email = el }}
                  type="email"
                  value={form.secretary_email || ''}
                  onChange={(e) => handleChange('secretary_email', e.target.value)}
                  placeholder="secretary@example.com"
                  className={inputClass('secretary_email')}
                />
                {fieldErrors.secretary_email && (
                  <p className="mt-1 text-xs text-red-500">{fieldErrors.secretary_email}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary btn-sm flex-1"
          >
            취소
          </button>
          <button type="submit" className="btn-primary btn-sm flex-1">
            <span className="relative z-10">{isEdit ? '수정' : '생성'}</span>
          </button>
        </div>
      </form>

      <Toast
        isOpen={toast.isOpen}
        onClose={() => setToast({ ...toast, isOpen: false })}
        message={toast.message}
        type={toast.type}
      />
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
        title={alert.type === "error" ? "오류" : "알림"}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
