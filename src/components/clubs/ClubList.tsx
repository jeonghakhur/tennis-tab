'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { Shield, Users, MapPin, Search } from 'lucide-react'
import { Badge } from '@/components/common/Badge'
import { matchesKoreanSearch } from '@/lib/utils/korean'
import type { ClubJoinType } from '@/lib/clubs/types'

const JOIN_TYPE_LABELS: Record<ClubJoinType, string> = {
  OPEN: '자유 가입',
  APPROVAL: '승인제',
  INVITE_ONLY: '초대 전용',
}

export interface ClubWithCounts {
  id: string
  name: string
  city: string | null
  district: string | null
  join_type: string
  association_name: string | null
  member_count: number
  is_active: boolean
  /** 올해(feeYear) 협회 연회비 납부 여부 */
  fee_paid: boolean
}

interface Props {
  clubs: ClubWithCounts[]
  /** 연회비 기준 연도 (KST 현재 연도) */
  feeYear: number
}

/** 클럽 목록 + 초성 검색 */
export function ClubList({ clubs, feeYear }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')
  // 연회비 미납 클럽만 보기 (활성 클럽 기준)
  const [unpaidOnly, setUnpaidOnly] = useState(false)

  // 요약 카운트 — 전체 / 활성 / 올해 납부 (활성 클럽 기준)
  const summary = useMemo(() => {
    const active = clubs.filter((c) => c.is_active)
    return {
      total: clubs.length,
      active: active.length,
      paid: active.filter((c) => c.fee_paid).length,
      unpaid: active.filter((c) => !c.fee_paid).length,
    }
  }, [clubs])

  // blur 시 URL 동기화 (동기적, 서버 refetch 없음)
  const syncUrlOnBlur = useCallback(() => {
    const params = new URLSearchParams(searchParams)
    if (searchQuery) {
      params.set('q', searchQuery)
    } else {
      params.delete('q')
    }
    const qs = params.toString()
    const url = qs ? `${pathname}?${qs}` : pathname
    window.history.replaceState(window.history.state, '', url)
  }, [searchQuery, searchParams, pathname])

  /** 검색어 포함 href 생성 */
  const withSearchQuery = useCallback((path: string) => {
    if (!searchQuery) return path
    const params = new URLSearchParams({ q: searchQuery })
    return `${path}?${params.toString()}`
  }, [searchQuery])

  const filtered = useMemo(() => {
    const base = unpaidOnly ? clubs.filter((c) => c.is_active && !c.fee_paid) : clubs
    if (!searchQuery) return base
    return base.filter((c) =>
      matchesKoreanSearch(c.name, searchQuery) ||
      (c.city && matchesKoreanSearch(c.city, searchQuery)) ||
      (c.district && matchesKoreanSearch(c.district, searchQuery)) ||
      (c.association_name && matchesKoreanSearch(c.association_name, searchQuery)),
    )
  }, [clubs, searchQuery, unpaidOnly])

  return (
    <div className="space-y-4">
      {/* 검색 입력 */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-(--text-muted)" />
        <input
          type="text"
          placeholder="클럽명, 지역, 소속 협회로 검색 (초성 지원: ㅅㅊ → 서초)"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onBlur={syncUrlOnBlur}
          aria-label="클럽 검색"
          className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-(--bg-secondary) border border-(--border-color) text-(--text-primary) placeholder:text-(--text-muted) focus:border-(--accent-color) focus:outline-none transition-colors"
        />
      </div>

      {/* 요약 카운트 + 미납 필터 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-(--text-muted)">
          전체 <span className="font-semibold text-(--text-primary)">{summary.total}</span>개
          <span className="mx-1.5">·</span>
          활성 <span className="font-semibold text-(--text-primary)">{summary.active}</span>개
          <span className="mx-1.5">·</span>
          {feeYear}년 연회비 납부{' '}
          <span className="font-semibold text-(--color-success)">{summary.paid}</span>
          <span> / {summary.active}</span>
          {(searchQuery || unpaidOnly) && (
            <span className="ml-2">
              (표시 <span className="font-semibold text-(--text-primary)">{filtered.length}</span>개)
            </span>
          )}
        </p>
        <button
          type="button"
          onClick={() => setUnpaidOnly((v) => !v)}
          aria-pressed={unpaidOnly}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border ${
            unpaidOnly
              ? 'bg-subtle-warning border-(--color-warning-border)'
              : 'bg-(--bg-secondary) text-(--text-secondary) border-(--border-color) hover:text-(--text-primary)'
          }`}
        >
          미납만 보기 ({summary.unpaid})
        </button>
      </div>

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-(--text-muted)" />
          <p className="text-(--text-muted)">
            {unpaidOnly && !searchQuery
              ? `${feeYear}년 연회비 미납 클럽이 없습니다.`
              : searchQuery
                ? '검색 결과가 없습니다.'
                : '관리 중인 클럽이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((club) => (
            <div key={club.id} className={`glass-card rounded-xl p-5 space-y-3 ${!club.is_active ? 'opacity-60 border border-red-500/30' : ''}`}>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className={`text-lg font-bold ${!club.is_active ? 'text-(--text-muted)' : 'text-(--text-primary)'}`}>{club.name}</h3>
                  {!club.is_active && <Badge variant="danger">비활성</Badge>}
                  {club.is_active && (
                    <Badge variant={club.fee_paid ? 'success' : 'warning'}>
                      {club.fee_paid ? '연회비 납부' : '연회비 미납'}
                    </Badge>
                  )}
                </div>
                {(club.city || club.district) && (
                  <p className="text-sm text-(--text-secondary) flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />
                    {[club.city, club.district].filter(Boolean).join(' ')}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 text-sm text-(--text-muted)">
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  회원 {club.member_count}명
                </span>
                <span>·</span>
                <span>{club.association_name || '독립 클럽'}</span>
                <span>·</span>
                <span>{JOIN_TYPE_LABELS[club.join_type as ClubJoinType] || club.join_type}</span>
              </div>
              <Link
                href={withSearchQuery(`/admin/clubs/${club.id}`)}
                className="btn-secondary btn-sm inline-block text-center"
              >
                관리
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
