'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createAssociation, updateAssociation } from '@/lib/associations/actions'
import type { Association, CreateAssociationInput } from '@/lib/associations/types'
import { Toast } from '@/components/common/Toast'
import { AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'

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
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name.trim()) {
      setAlert({ isOpen: true, message: '협회 이름을 입력해주세요.', type: 'error' })
      return
    }

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

      // 생성 후 목록으로 이동
      setTimeout(() => router.push('/admin/associations'), 500)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {loading && <LoadingOverlay message={isEdit ? '수정 중...' : '생성 중...'} />}

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
        {/* 협회 이름 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            협회 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 마포구테니스협회"
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
          />
        </div>

        {/* 지역 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              시/도
            </label>
            <input
              type="text"
              value={form.region || ''}
              onChange={(e) => setForm({ ...form, region: e.target.value })}
              placeholder="예: 서울특별시"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">
              구/군
            </label>
            <input
              type="text"
              value={form.district || ''}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="예: 마포구"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            협회 소개
          </label>
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="협회 소개를 입력하세요"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none resize-none"
          />
        </div>

        {/* 협회장 정보 */}
        <div>
          <p className="text-sm font-medium text-(--text-primary) mb-3">협회장</p>
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-(--text-muted) mb-1">이름</label>
              <input
                type="text"
                value={form.president_name || ''}
                onChange={(e) => setForm({ ...form, president_name: e.target.value })}
                placeholder="협회장 이름"
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">연락처</label>
                <input
                  type="tel"
                  value={form.president_phone || ''}
                  onChange={(e) => setForm({ ...form, president_phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">이메일</label>
                <input
                  type="email"
                  value={form.president_email || ''}
                  onChange={(e) => setForm({ ...form, president_email: e.target.value })}
                  placeholder="president@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
                />
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
                type="text"
                value={form.secretary_name || ''}
                onChange={(e) => setForm({ ...form, secretary_name: e.target.value })}
                placeholder="사무장 이름"
                className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">연락처</label>
                <input
                  type="tel"
                  value={form.secretary_phone || ''}
                  onChange={(e) => setForm({ ...form, secretary_phone: e.target.value })}
                  placeholder="010-0000-0000"
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
                />
              </div>
              <div>
                <label className="block text-xs text-(--text-muted) mb-1">이메일</label>
                <input
                  type="email"
                  value={form.secretary_email || ''}
                  onChange={(e) => setForm({ ...form, secretary_email: e.target.value })}
                  placeholder="secretary@example.com"
                  className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
                />
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
            {isEdit ? '수정' : '생성'}
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
        onClose={() => setAlert({ ...alert, isOpen: false })}
        title={alert.type === "error" ? "오류" : "알림"}
        message={alert.message}
        type={alert.type}
      />
    </>
  )
}
