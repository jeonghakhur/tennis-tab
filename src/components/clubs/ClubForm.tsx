'use client'

import { useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClub, updateClub } from '@/lib/clubs/actions'
import type { Club, CreateClubInput, ClubJoinType } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'
import {
  sanitizeInput,
  validateClubInput,
  hasValidationErrors,
  type ClubValidationErrors,
} from '@/lib/utils/validation'
import {
  generateClubDummy,
  generateClubInvalidDummy,
} from '@/lib/utils/devDummy'
import { AssociationCombobox, type AssociationValue } from './AssociationCombobox'

const isDev = process.env.NODE_ENV === 'development'

interface ClubFormProps {
  club?: Club | null
  associations?: Array<{ id: string; name: string }>
}

const JOIN_TYPE_OPTIONS: { value: ClubJoinType; label: string; desc: string }[] = [
  { value: 'APPROVAL', label: '승인제', desc: '가입 신청 후 관리자 승인 필요' },
  { value: 'OPEN', label: '자유 가입', desc: '누구나 즉시 가입 가능' },
  { value: 'INVITE_ONLY', label: '초대 전용', desc: '관리자가 초대한 회원만 가입' },
]

export function ClubForm({ club, associations = [] }: ClubFormProps) {
  const router = useRouter()
  const isEdit = !!club

  const [form, setForm] = useState<CreateClubInput>({
    name: club?.name || '',
    representative_name: club?.representative_name || '',
    description: club?.description || '',
    city: club?.city || '',
    district: club?.district || '',
    address: club?.address || '',
    contact_phone: club?.contact_phone || '',
    contact_email: club?.contact_email || '',
    join_type: club?.join_type || 'APPROVAL',
    max_members: club?.max_members || undefined,
    association_id: club?.association_id ?? null,
    association_name: '',
  })
  // 협회 combobox 상태 (association_id + association_name을 함께 관리)
  const [assocValue, setAssocValue] = useState<AssociationValue>({
    association_id: club?.association_id ?? null,
    association_name: (club?.associations as { name: string } | null)?.name || '',
  })
  const [fieldErrors, setFieldErrors] = useState<ClubValidationErrors>({})
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })
  const errorFieldRef = useRef<keyof ClubValidationErrors | null>(null)
  const fieldRefs = useRef<Record<string, HTMLInputElement | HTMLTextAreaElement | null>>({})

  // 필드 변경 시 sanitize + 에러 클리어
  const handleChange = useCallback((field: keyof CreateClubInput, value: string) => {
    const sanitized = sanitizeInput(value)
    setForm((prev) => ({ ...prev, [field]: sanitized }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
  }, [])

  // 협회 combobox 변경 → form에 반영
  const handleAssocChange = useCallback((val: AssociationValue) => {
    setAssocValue(val)
    if (val.association_id) {
      // 기존 협회 선택
      setForm((prev) => ({ ...prev, association_id: val.association_id, association_name: '' }))
    } else if (val.association_name) {
      // 직접 입력
      setForm((prev) => ({ ...prev, association_id: null, association_name: val.association_name }))
    } else {
      // 독립 클럽
      setForm((prev) => ({ ...prev, association_id: null, association_name: '' }))
    }
  }, [])

  // 클라이언트 순차 검증 — 필드 순서대로 첫 에러만 AlertDialog로 표시
  const FIELD_ORDER: (keyof ClubValidationErrors)[] = [
    'name', 'representative_name', 'contact_phone', 'contact_email',
    'city', 'district', 'address', 'description', 'max_members',
  ]

  const validateForm = useCallback((): boolean => {
    const errors = validateClubInput(form)
    if (!hasValidationErrors(errors)) {
      setFieldErrors({})
      return true
    }
    // 순서대로 첫 번째 에러 찾기 → AlertDialog + 포커스 대상 저장
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
        ? await updateClub(club!.id, form)
        : await createClub(form)

      if (result.error) {
        setAlert({ isOpen: true, message: result.error, type: 'error' })
        return
      }

      setToast({
        isOpen: true,
        message: isEdit ? '클럽이 수정되었습니다.' : '클럽이 생성되었습니다.',
        type: 'success',
      })
      setTimeout(() => router.push('/admin/clubs'), 500)
    } finally {
      setLoading(false)
    }
  }

  // 공통 인풋 스타일
  const inputClass = (field: keyof ClubValidationErrors) =>
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
              onClick={() => { setForm(generateClubDummy()); setFieldErrors({}) }}
              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              DEV: 정상 더미 데이터
            </button>
            <button
              type="button"
              onClick={() => { setForm(generateClubInvalidDummy()); setFieldErrors({}) }}
              className="px-3 py-1.5 text-xs font-mono rounded-lg bg-red-500/10 text-red-500 border border-red-500/30 hover:bg-red-500/20 transition-colors"
            >
              DEV: 잘못된 데이터
            </button>
          </div>
        )}

        {/* 클럽 이름 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            클럽 이름 <span className="text-red-500">*</span>
          </label>
          <input
            ref={(el) => { fieldRefs.current.name = el }}
            type="text"
            value={form.name}
            onChange={(e) => handleChange('name', e.target.value)}
            placeholder="예: 마포테니스클럽"
            maxLength={50}
            className={inputClass('name')}
          />
          {fieldErrors.name && <p className="mt-1 text-xs text-red-500">{fieldErrors.name}</p>}
        </div>

        {/* 소속 협회 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            소속 협회
          </label>
          <AssociationCombobox
            associations={associations}
            value={assocValue}
            onChange={handleAssocChange}
          />
        </div>

        {/* 대표자명 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            대표자명 <span className="text-red-500">*</span>
          </label>
          <input
            ref={(el) => { fieldRefs.current.representative_name = el }}
            type="text"
            value={form.representative_name}
            onChange={(e) => handleChange('representative_name', e.target.value)}
            placeholder="예: 홍길동"
            maxLength={100}
            className={inputClass('representative_name')}
          />
          {fieldErrors.representative_name && <p className="mt-1 text-xs text-red-500">{fieldErrors.representative_name}</p>}
        </div>

        {/* 지역 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">시/도</label>
            <input
              ref={(el) => { fieldRefs.current.city = el }}
              type="text"
              value={form.city || ''}
              onChange={(e) => handleChange('city', e.target.value)}
              placeholder="예: 서울특별시"
              maxLength={100}
              className={inputClass('city')}
            />
            {fieldErrors.city && <p className="mt-1 text-xs text-red-500">{fieldErrors.city}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">구/군</label>
            <input
              ref={(el) => { fieldRefs.current.district = el }}
              type="text"
              value={form.district || ''}
              onChange={(e) => handleChange('district', e.target.value)}
              placeholder="예: 마포구"
              maxLength={100}
              className={inputClass('district')}
            />
            {fieldErrors.district && <p className="mt-1 text-xs text-red-500">{fieldErrors.district}</p>}
          </div>
        </div>

        {/* 상세 주소 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">상세 주소 (코트 위치)</label>
          <input
            ref={(el) => { fieldRefs.current.address = el }}
            type="text"
            value={form.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="예: 마포구 월드컵로 212 테니스장"
            maxLength={200}
            className={inputClass('address')}
          />
          {fieldErrors.address && <p className="mt-1 text-xs text-red-500">{fieldErrors.address}</p>}
        </div>

        {/* 연락처 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              연락처 <span className="text-red-500">*</span>
            </label>
            <input
              ref={(el) => { fieldRefs.current.contact_phone = el }}
              type="tel"
              inputMode="numeric"
              value={form.contact_phone}
              onChange={(e) => handleChange('contact_phone', e.target.value)}
              placeholder="01012345678"
              className={inputClass('contact_phone')}
            />
            {fieldErrors.contact_phone && <p className="mt-1 text-xs text-red-500">{fieldErrors.contact_phone}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              이메일 <span className="text-red-500">*</span>
            </label>
            <input
              ref={(el) => { fieldRefs.current.contact_email = el }}
              type="email"
              value={form.contact_email}
              onChange={(e) => handleChange('contact_email', e.target.value)}
              placeholder="club@example.com"
              className={inputClass('contact_email')}
            />
            {fieldErrors.contact_email && <p className="mt-1 text-xs text-red-500">{fieldErrors.contact_email}</p>}
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">클럽 소개</label>
          <textarea
            ref={(el) => { fieldRefs.current.description = el }}
            value={form.description || ''}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="클럽 소개를 입력하세요"
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

        {/* 가입 방식 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-2">가입 방식</label>
          <div className="space-y-2">
            {JOIN_TYPE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.join_type === opt.value
                    ? 'border-(--accent-color) bg-(--accent-color)/5'
                    : 'border-(--border-color) hover:bg-(--bg-primary)'
                }`}
              >
                <input
                  type="radio"
                  name="join_type"
                  value={opt.value}
                  checked={form.join_type === opt.value}
                  onChange={() => setForm({ ...form, join_type: opt.value })}
                  className="mt-0.5 accent-(--accent-color)"
                />
                <div>
                  <p className="text-sm font-medium text-(--text-primary)">{opt.label}</p>
                  <p className="text-xs text-(--text-muted)">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* 최대 회원 수 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">최대 회원 수</label>
          <input
            ref={(el) => { fieldRefs.current.max_members = el }}
            type="number"
            value={form.max_members || ''}
            onChange={(e) => {
              setForm({ ...form, max_members: e.target.value ? Number(e.target.value) : undefined })
              setFieldErrors((prev) => ({ ...prev, max_members: undefined }))
            }}
            placeholder="비워두면 무제한"
            min={1}
            className={inputClass('max_members')}
          />
          {fieldErrors.max_members && <p className="mt-1 text-xs text-red-500">{fieldErrors.max_members}</p>}
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary btn-sm flex-1">
            취소
          </button>
          <button type="submit" className="btn-primary btn-sm flex-1">
            <span className="relative z-10">{isEdit ? '수정' : '생성'}</span>
          </button>
        </div>
      </form>

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => {
        setAlert({ ...alert, isOpen: false })
        // 에러 필드로 포커스 이동
        const key = errorFieldRef.current
        if (key) {
          fieldRefs.current[key]?.focus()
          errorFieldRef.current = null
        }
      }} title={alert.type === "error" ? "오류" : "알림"} message={alert.message} type={alert.type} />
    </>
  )
}
