'use client'

import { useState, useMemo, useCallback } from 'react'
import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { Shield, Users, MapPin, Search } from 'lucide-react'
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
}

interface Props {
  clubs: ClubWithCounts[]
}

/** 클럽 목록 + 초성 검색 */
export function ClubList({ clubs }: Props) {
  const searchParams = useSearchParams()
  const pathname = usePathname()

  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') ?? '')

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
    if (!searchQuery) return clubs
    return clubs.filter((c) =>
      matchesKoreanSearch(c.name, searchQuery) ||
      (c.city && matchesKoreanSearch(c.city, searchQuery)) ||
      (c.district && matchesKoreanSearch(c.district, searchQuery)) ||
      (c.association_name && matchesKoreanSearch(c.association_name, searchQuery)),
    )
  }, [clubs, searchQuery])

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

      {/* 결과 카운트 */}
      {searchQuery && (
        <p className="text-sm text-(--text-muted)">
          검색 결과: <span className="font-semibold text-(--text-primary)">{filtered.length}</span>개
          {filtered.length !== clubs.length && (
            <span> / 전체 {clubs.length}개</span>
          )}
        </p>
      )}

      {/* 목록 */}
      {filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center space-y-4">
          <Shield className="w-12 h-12 mx-auto text-(--text-muted)" />
          <p className="text-(--text-muted)">
            {searchQuery ? '검색 결과가 없습니다.' : '관리 중인 클럽이 없습니다.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((club) => (
            <div key={club.id} className="glass-card rounded-xl p-5 space-y-3">
              <div>
                <h3 className="text-lg font-bold text-(--text-primary)">{club.name}</h3>
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
