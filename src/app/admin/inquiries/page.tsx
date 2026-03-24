'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/components/AuthProvider'
import { InquiryCard } from '@/components/support/InquiryCard'
import { getAllInquiries } from '@/lib/support/actions'
import { formatKoreanDate } from '@/lib/utils/formatDate'
import { Badge, type BadgeVariant } from '@/components/common/Badge'
import type { Inquiry, InquiryStatus } from '@/lib/support/types'
import {
  INQUIRY_CATEGORY_LABELS,
  INQUIRY_STATUS_LABELS,
} from '@/lib/support/types'
import { hasMinimumRole } from '@/lib/auth/roles'
import type { UserRole } from '@/lib/supabase/types'
import { Inbox, Search } from 'lucide-react'
import Link from 'next/link'

const STATUS_VARIANT: Record<InquiryStatus, BadgeVariant> = {
  PENDING: 'warning',
  IN_PROGRESS: 'info',
  RESOLVED: 'success',
}

const STATUS_TABS: { label: string; value: InquiryStatus | null }[] = [
  { label: '전체', value: null },
  { label: '대기중', value: 'PENDING' },
  { label: '처리중', value: 'IN_PROGRESS' },
  { label: '완료', value: 'RESOLVED' },
]

export default function AdminInquiriesPage() {
  const router = useRouter()
  const { profile, loading: authLoading } = useAuth()
  const [allInquiries, setAllInquiries] = useState<Inquiry[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<InquiryStatus | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // 권한 체크
  useEffect(() => {
    if (authLoading) return
    if (!profile || !hasMinimumRole(profile.role as UserRole, 'ADMIN')) {
      router.replace('/admin')
    }
  }, [profile, authLoading, router])

  // 전체 문의 한 번에 로드 (클라이언트 필터링)
  const loadInquiries = useCallback(async () => {
    setLoading(true)
    const result = await getAllInquiries()
    if (!result.error) {
      setAllInquiries(result.data)
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    if (authLoading || !profile) return
    loadInquiries()
  }, [loadInquiries, authLoading, profile])

  // 상태별 건수 계산
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allInquiries.length }
    for (const inquiry of allInquiries) {
      counts[inquiry.status] = (counts[inquiry.status] || 0) + 1
    }
    return counts
  }, [allInquiries])

  // 검색 + 상태 필터링
  const filteredInquiries = useMemo(() => {
    let filtered = allInquiries

    if (statusFilter) {
      filtered = filtered.filter((i) => i.status === statusFilter)
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (i) =>
          i.title.toLowerCase().includes(query) ||
          i.author?.name?.toLowerCase().includes(query) ||
          i.author?.email?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [allInquiries, statusFilter, searchQuery])

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

      {/* 검색바 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
        <input
          type="text"
          placeholder="제목, 작성자명으로 검색..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="문의 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-card) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent-color) focus:outline-none transition-colors"
        />
      </div>

      {/* 상태 필터 탭 (건수 포함) */}
      <div
        className="flex gap-1 p-1 rounded-lg"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {STATUS_TABS.map((tab) => {
          const count = tab.value ? statusCounts[tab.value] ?? 0 : statusCounts.ALL ?? 0
          return (
            <button
              key={tab.label}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? 'bg-(--accent-color) text-(--bg-primary)'
                  : 'text-(--text-secondary) hover:text-(--text-primary)'
              }`}
            >
              {tab.label} ({count})
            </button>
          )
        })}
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
      ) : filteredInquiries.length === 0 ? (
        <div className="glass-card rounded-xl p-12 text-center">
          <Inbox
            className="w-12 h-12 mx-auto mb-4"
            style={{ color: 'var(--text-muted)' }}
          />
          <p style={{ color: 'var(--text-primary)' }}>
            {searchQuery
              ? '검색 결과가 없습니다.'
              : statusFilter
                ? '해당 상태의 문의가 없습니다.'
                : '접수된 문의가 없습니다.'}
          </p>
        </div>
      ) : (
        <>
          {/* 데스크탑: 테이블 레이아웃 */}
          <div className="hidden md:block glass-card rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-(--border-color)">
                    <th className="text-left p-4 font-medium text-(--text-secondary)">카테고리</th>
                    <th className="text-left p-4 font-medium text-(--text-secondary)">제목</th>
                    <th className="text-left p-4 font-medium text-(--text-secondary)">작성자</th>
                    <th className="text-left p-4 font-medium text-(--text-secondary)">날짜</th>
                    <th className="text-left p-4 font-medium text-(--text-secondary)">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInquiries.map((inquiry) => (
                    <tr
                      key={inquiry.id}
                      className="border-b border-(--border-color) last:border-b-0 hover:bg-(--bg-card-hover) transition-colors"
                    >
                      <td className="p-4">
                        <Badge variant="secondary">
                          {INQUIRY_CATEGORY_LABELS[inquiry.category]}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <Link
                          href={`/admin/inquiries/${inquiry.id}`}
                          className="text-sm font-medium text-(--text-primary) hover:text-(--accent-color) hover:underline transition-colors"
                        >
                          {inquiry.title}
                        </Link>
                      </td>
                      <td className="p-4">
                        {inquiry.author ? (
                          <div className="min-w-0">
                            <p className="text-sm text-(--text-primary)">{inquiry.author.name}</p>
                            <p className="text-xs text-(--text-muted) truncate max-w-[180px]" title={inquiry.author.email}>
                              {inquiry.author.email}
                            </p>
                          </div>
                        ) : (
                          <span className="text-sm text-(--text-muted)">-</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="text-sm text-(--text-secondary) whitespace-nowrap">
                          {formatKoreanDate(inquiry.created_at)}
                        </span>
                      </td>
                      <td className="p-4">
                        <Badge variant={STATUS_VARIANT[inquiry.status]}>
                          {INQUIRY_STATUS_LABELS[inquiry.status]}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* 모바일: 카드형 유지 */}
          <div className="md:hidden space-y-3">
            {filteredInquiries.map((inquiry) => (
              <InquiryCard
                key={inquiry.id}
                inquiry={inquiry}
                linkPrefix="/admin/inquiries"
                showAuthor
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
