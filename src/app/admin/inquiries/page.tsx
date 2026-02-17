'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { InquiryCard } from '@/components/support/InquiryCard'
import { getAllInquiries } from '@/lib/support/actions'
import type { Inquiry, InquiryStatus } from '@/lib/support/types'
import { hasMinimumRole } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/supabase/types'
import { Inbox } from 'lucide-react'

const STATUS_TABS: { label: string; value: InquiryStatus | null }[] = [
  { label: '전체', value: null },
  { label: '대기중', value: 'PENDING' },
  { label: '처리중', value: 'IN_PROGRESS' },
  { label: '완료', value: 'RESOLVED' },
]

export default function AdminInquiriesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | null>(null)

  // 권한 체크
  useEffect(() => {
    if (authLoading) return
    if (!profile || !hasMinimumRole(profile.role as UserRole, 'ADMIN')) {
      router.replace('/admin')
    }
  }, [profile, authLoading, router])

  const loadInquiries = useCallback(async () => {
    setLoading(true)
    const result = await getAllInquiries(
      statusFilter ? { status: statusFilter } : undefined
    )
    if (!result.error) {
      setInquiries(result.data)
    }
    setLoading(false)
  }, [statusFilter])

  useEffect(() => {
    if (authLoading || !profile) return
    loadInquiries()
  }, [loadInquiries, authLoading, profile])

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="font-display text-2xl font-bold text-(--text-primary)">
          문의 관리
        </h1>
        <p className="text-(--text-secondary) mt-1">
          사용자 문의를 확인하고 답변할 수 있습니다.
        </p>
      </div>

      {/* 상태 필터 탭 */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.label}
            onClick={() => setStatusFilter(tab.value)}
            className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              statusFilter === tab.value
                ? 'bg-(--accent-color) text-(--bg-primary)'
                : 'text-(--text-secondary) hover:text-(--text-primary)'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 목록 */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="glass-card rounded-xl p-5 animate-pulse">
              <div className="h-5 w-48 rounded mb-2" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
              <div className="h-4 w-32 rounded" style={{ backgroundColor: 'var(--bg-card-hover)' }} />
            </div>
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Inbox
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <p style={{ color: 'var(--text-primary)' }}>
            {statusFilter ? '해당 상태의 문의가 없습니다.' : '접수된 문의가 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {inquiries.map((inquiry) => (
            <InquiryCard
              key={inquiry.id}
              inquiry={inquiry}
              linkPrefix="/admin/inquiries"
              showAuthor
            />
          ))}
        </div>
      )}
    </div>
  )
}
