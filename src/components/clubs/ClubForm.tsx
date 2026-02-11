'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClub, updateClub } from '@/lib/clubs/actions'
import type { Club, CreateClubInput, ClubJoinType } from '@/lib/clubs/types'
import { Toast, AlertDialog } from '@/components/common/AlertDialog'
import { LoadingOverlay } from '@/components/common/LoadingOverlay'

interface ClubFormProps {
  club?: Club | null
}

const JOIN_TYPE_OPTIONS: { value: ClubJoinType; label: string; desc: string }[] = [
  { value: 'APPROVAL', label: '승인제', desc: '가입 신청 후 관리자 승인 필요' },
  { value: 'OPEN', label: '자유 가입', desc: '누구나 즉시 가입 가능' },
  { value: 'INVITE_ONLY', label: '초대 전용', desc: '관리자가 초대한 회원만 가입' },
]

export function ClubForm({ club }: ClubFormProps) {
  const router = useRouter()
  const isEdit = !!club

  const [form, setForm] = useState<CreateClubInput>({
    name: club?.name || '',
    description: club?.description || '',
    city: club?.city || '',
    district: club?.district || '',
    address: club?.address || '',
    contact_phone: club?.contact_phone || '',
    contact_email: club?.contact_email || '',
    join_type: club?.join_type || 'APPROVAL',
    max_members: club?.max_members || undefined,
  })
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState({ isOpen: false, message: '', type: 'success' as const })
  const [alert, setAlert] = useState({ isOpen: false, message: '', type: 'error' as const })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.name?.trim()) {
      setAlert({ isOpen: true, message: '클럽 이름을 입력해주세요.', type: 'error' })
      return
    }

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

  return (
    <>
      {loading && <LoadingOverlay message={isEdit ? '수정 중...' : '생성 중...'} />}

      <form onSubmit={handleSubmit} className="glass-card rounded-xl p-6 space-y-5">
        {/* 클럽 이름 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">
            클럽 이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="예: 마포테니스클럽"
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
          />
        </div>

        {/* 지역 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">시/도</label>
            <input
              type="text"
              value={form.city || ''}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="예: 서울특별시"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">구/군</label>
            <input
              type="text"
              value={form.district || ''}
              onChange={(e) => setForm({ ...form, district: e.target.value })}
              placeholder="예: 마포구"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
        </div>

        {/* 상세 주소 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">상세 주소 (코트 위치)</label>
          <input
            type="text"
            value={form.address || ''}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            placeholder="예: 마포구 월드컵로 212 테니스장"
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
          />
        </div>

        {/* 연락처 */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">연락처</label>
            <input
              type="text"
              value={form.contact_phone || ''}
              onChange={(e) => setForm({ ...form, contact_phone: e.target.value })}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-(--text-primary) mb-1">이메일</label>
            <input
              type="email"
              value={form.contact_email || ''}
              onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
              placeholder="club@example.com"
              className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
            />
          </div>
        </div>

        {/* 설명 */}
        <div>
          <label className="block text-sm font-medium text-(--text-primary) mb-1">클럽 소개</label>
          <textarea
            value={form.description || ''}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="클럽 소개를 입력하세요"
            rows={3}
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none resize-none"
          />
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
            type="number"
            value={form.max_members || ''}
            onChange={(e) => setForm({ ...form, max_members: e.target.value ? Number(e.target.value) : undefined })}
            placeholder="비워두면 무제한"
            min={1}
            className="w-full px-3 py-2 rounded-lg bg-(--bg-input) text-(--text-primary) border border-(--border-color) focus:border-(--accent-color) outline-none"
          />
        </div>

        {/* 버튼 */}
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={() => router.back()} className="btn-secondary btn-sm flex-1">
            취소
          </button>
          <button type="submit" className="btn-primary btn-sm flex-1">
            {isEdit ? '수정' : '생성'}
          </button>
        </div>
      </form>

      <Toast isOpen={toast.isOpen} onClose={() => setToast({ ...toast, isOpen: false })} message={toast.message} type={toast.type} />
      <AlertDialog isOpen={alert.isOpen} onClose={() => setAlert({ ...alert, isOpen: false })} title={alert.type === "error" ? "오류" : "알림"} message={alert.message} type={alert.type} />
    </>
  )
}
